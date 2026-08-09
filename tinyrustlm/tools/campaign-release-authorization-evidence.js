"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { CampaignEvidenceStore, canonicalJson } = require("./campaign-evidence-store.js");
const {
  finalAttestationSchema,
  releaseSignatureReceiptType,
  validateFinalAttestation
} = require("./campaign-final-attestation.js");
const { parseStrictJson, strictJsonProfile } = require("./strict-json.js");

const authorityRegistrySchema = "tinyrustlm.release_authority_registry.v1";
const authorizationEnvelopeSchema = "tinyrustlm.release_authorization_envelope.v1";
const authorizationVerificationSchema = "tinyrustlm.release_attestation_verification.v1";
const maximumInputBytes = 512 * 1024;
const maximumAuthorizationLifetimeMilliseconds = 24 * 60 * 60 * 1000;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const safeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,255}$/u;
const utcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactFields(value, expected, label) {
  invariant(isPlainObject(value), `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  const unknown = actual.filter((key) => !required.includes(key));
  const missing = required.filter((key) => !actual.includes(key));
  invariant(unknown.length === 0, `${label} has unknown field ${unknown[0]}`);
  invariant(missing.length === 0, `${label} is missing field ${missing[0]}`);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function boundedString(value, label, maximum = 2048) {
  const text = String(value ?? "");
  invariant(text.length > 0 && text.length <= maximum, `${label} is invalid`);
  invariant(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(text),
    `${label} contains controls`);
  return text;
}

function safeId(value, label) {
  const text = boundedString(value, label, 256);
  invariant(safeIdPattern.test(text), `${label} is invalid`);
  return text;
}

function utc(value, label) {
  const text = String(value || "");
  invariant(utcPattern.test(text) && Number.isFinite(Date.parse(text)), `${label} must be UTC`);
  return text;
}

function digest(value, label) {
  const text = String(value || "").toLowerCase();
  invariant(sha256Pattern.test(text), `${label} must be SHA-256`);
  return text;
}

function decodeBase64(value, label, expectedLength = null) {
  const text = String(value || "");
  invariant(text.length > 0 && text.length <= 8192 &&
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(text),
  `${label} is not canonical base64`);
  const bytes = Buffer.from(text, "base64");
  invariant(bytes.toString("base64") === text, `${label} is not canonical base64`);
  if (expectedLength !== null) invariant(bytes.length === expectedLength, `${label} length is invalid`);
  return bytes;
}

function readJsonFile(filePath, label) {
  const resolved = path.resolve(String(filePath || ""));
  const stat = fs.lstatSync(resolved, { throwIfNoEntry: false });
  invariant(stat?.isFile() && !stat.isSymbolicLink() && stat.size > 0 &&
    stat.size <= maximumInputBytes, `${label} must be a bounded regular non-symlink file`);
  const bytes = fs.readFileSync(resolved);
  try {
    const value = parseStrictJson(bytes, { maximumBytes: maximumInputBytes });
    return Object.freeze({ path: resolved, bytes, sha256: sha256(bytes), value });
  } catch (error) {
    throw new Error(`${label} is not valid ${strictJsonProfile}: ${error.message}`);
  }
}

function validateAuthorityRegistry(value, expectedCampaignId, nowUtc) {
  exactFields(value, [
    "schema", "campaignId", "registryId", "validFromUtc", "validUntilUtc", "authorities"
  ], "release authority registry");
  invariant(value.schema === authorityRegistrySchema, "release authority registry is unsupported");
  invariant(value.campaignId === expectedCampaignId, "release authority campaign ID does not match");
  const registryId = safeId(value.registryId, "release authority registry ID");
  const validFromUtc = utc(value.validFromUtc, "release authority registry valid-from time");
  const validUntilUtc = utc(value.validUntilUtc, "release authority registry valid-until time");
  const now = Date.parse(utc(nowUtc, "release authorization verification time"));
  invariant(Date.parse(validFromUtc) <= now && now < Date.parse(validUntilUtc),
    "release authority registry is not currently valid");
  invariant(Array.isArray(value.authorities) && value.authorities.length > 0 &&
    value.authorities.length <= 64, "release authority registry must contain authorities");
  const authorities = value.authorities.map((authority, index) => {
    const label = `release authority ${index}`;
    exactFields(authority, [
      "authorityId", "keyId", "algorithm", "publicKeySpkiBase64",
      "publicKeySpkiSha256", "role", "status"
    ], label);
    invariant(authority.algorithm === "ed25519", `${label} algorithm is unsupported`);
    invariant(authority.role === "release-authorizer", `${label} role is invalid`);
    invariant(["active", "revoked"].includes(authority.status), `${label} status is invalid`);
    const publicKeySpki = decodeBase64(authority.publicKeySpkiBase64,
      `${label} public key`);
    const publicKeySpkiSha256 = digest(authority.publicKeySpkiSha256,
      `${label} public key hash`);
    invariant(sha256(publicKeySpki) === publicKeySpkiSha256,
      `${label} public key hash does not match`);
    let publicKey;
    try {
      publicKey = crypto.createPublicKey({ key: publicKeySpki, format: "der", type: "spki" });
    } catch (_error) {
      throw new Error(`${label} public key is not valid SPKI DER`);
    }
    invariant(publicKey.asymmetricKeyType === "ed25519", `${label} key is not Ed25519`);
    return Object.freeze({
      authorityId: safeId(authority.authorityId, `${label} authority ID`),
      keyId: safeId(authority.keyId, `${label} key ID`),
      algorithm: "ed25519",
      publicKeySpkiBase64: authority.publicKeySpkiBase64,
      publicKeySpkiSha256,
      publicKey,
      role: "release-authorizer",
      status: authority.status
    });
  });
  const identities = authorities.map((authority) => `${authority.authorityId}\u0000${authority.keyId}`);
  invariant(new Set(identities).size === identities.length,
    "release authority registry contains duplicate authority keys");
  return Object.freeze({
    schema: authorityRegistrySchema,
    campaignId: expectedCampaignId,
    registryId,
    validFromUtc,
    validUntilUtc,
    authorities: Object.freeze(authorities)
  });
}

function authorizationPayload(value, expected) {
  exactFields(value, [
    "schema", "campaignId", "sourceRevision", "predicateSha256", "decision",
    "authorityId", "keyId", "issuedAtUtc", "expiresAtUtc", "nonce", "signature"
  ], "release authorization envelope");
  invariant(value.schema === authorizationEnvelopeSchema,
    "release authorization envelope is unsupported");
  invariant(value.campaignId === expected.campaignId,
    "release authorization campaign ID does not match");
  invariant(value.sourceRevision === expected.sourceRevision,
    "release authorization source revision does not match");
  invariant(digest(value.predicateSha256, "release authorization predicate") ===
    expected.predicateSha256, "release authorization predicate does not match");
  invariant(value.decision === "authorize-release", "release authorization decision is invalid");
  const issuedAtUtc = utc(value.issuedAtUtc, "release authorization issue time");
  const expiresAtUtc = utc(value.expiresAtUtc, "release authorization expiry time");
  const issuedAt = Date.parse(issuedAtUtc);
  const expiresAt = Date.parse(expiresAtUtc);
  const now = Date.parse(expected.nowUtc);
  invariant(issuedAt <= now && now < expiresAt,
    "release authorization is not currently valid");
  invariant(expiresAt > issuedAt &&
    expiresAt - issuedAt <= maximumAuthorizationLifetimeMilliseconds,
  "release authorization lifetime is invalid");
  const payload = Object.freeze({
    schema: authorizationEnvelopeSchema,
    campaignId: expected.campaignId,
    sourceRevision: expected.sourceRevision,
    predicateSha256: expected.predicateSha256,
    decision: "authorize-release",
    authorityId: safeId(value.authorityId, "release authorization authority ID"),
    keyId: safeId(value.keyId, "release authorization key ID"),
    issuedAtUtc,
    expiresAtUtc,
    nonce: safeId(value.nonce, "release authorization nonce")
  });
  exactFields(value.signature, ["algorithm", "valueBase64"], "release authorization signature");
  invariant(value.signature.algorithm === "ed25519",
    "release authorization signature algorithm is unsupported");
  const signature = decodeBase64(value.signature.valueBase64,
    "release authorization signature", 64);
  return Object.freeze({ payload, signature });
}

function verifyReleaseAuthorization(input) {
  invariant(isPlainObject(input), "release authorization verification input is invalid");
  const allowed = new Set([
    "attestation", "attestationFileSha256", "authorityRegistry", "authorityRegistrySha256",
    "authorizationEnvelope", "authorizationEnvelopeSha256", "campaignId", "nowUtc",
    "sourceRevision"
  ]);
  for (const key of Object.keys(input)) invariant(allowed.has(key),
    `unknown release authorization verification input: ${key}`);
  validateFinalAttestation(input.attestation);
  const campaignId = safeId(input.campaignId, "release authorization campaign ID");
  const sourceRevision = boundedString(input.sourceRevision, "release authorization source revision", 256);
  const nowUtc = utc(input.nowUtc, "release authorization verification time");
  invariant(input.attestation.schema === finalAttestationSchema &&
    input.attestation.campaignId === campaignId && input.attestation.sourceRevision === sourceRevision,
  "release authorization attestation identity does not match");
  invariant(input.attestation.campaignDecision?.campaignPrerequisitesPassed === true,
    "release authorization refuses an incomplete campaign predicate");
  invariant(input.attestation.status === "incomplete" &&
    input.attestation.authentication?.signatureVerified === false,
  "release authorization requires the unsigned final predicate");
  const registry = validateAuthorityRegistry(input.authorityRegistry, campaignId, nowUtc);
  const parsedEnvelope = authorizationPayload(input.authorizationEnvelope, {
    campaignId,
    sourceRevision,
    predicateSha256: input.attestation.predicateSha256,
    nowUtc
  });
  const authority = registry.authorities.find((candidate) =>
    candidate.authorityId === parsedEnvelope.payload.authorityId &&
    candidate.keyId === parsedEnvelope.payload.keyId);
  invariant(authority && authority.status === "active",
    "release authorization key is absent or revoked");
  const signedPayload = Buffer.from(canonicalJson(parsedEnvelope.payload), "utf8");
  invariant(crypto.verify(null, signedPayload, authority.publicKey, parsedEnvelope.signature),
    "release authorization Ed25519 signature is invalid");
  return Object.freeze({
    schema: authorizationVerificationSchema,
    campaignId,
    sourceRevision,
    predicateSha256: input.attestation.predicateSha256,
    attestationContentSha256: input.attestation.attestationContentSha256,
    attestationFileSha256: digest(input.attestationFileSha256, "final attestation file hash"),
    authorityRegistrySha256: digest(input.authorityRegistrySha256,
      "release authority registry hash"),
    authorizationEnvelopeSha256: digest(input.authorizationEnvelopeSha256,
      "release authorization envelope hash"),
    signedPayloadSha256: sha256(signedPayload),
    publicKeySpkiSha256: authority.publicKeySpkiSha256,
    registryId: registry.registryId,
    signingAuthorityId: authority.authorityId,
    signingKeyId: authority.keyId,
    algorithm: "ed25519",
    decision: "authorize-release",
    issuedAtUtc: parsedEnvelope.payload.issuedAtUtc,
    expiresAtUtc: parsedEnvelope.payload.expiresAtUtc,
    verifiedAtUtc: nowUtc,
    signatureVerified: true,
    authorizedRelease: true
  });
}

function currentReceipts(receipts) {
  const superseded = new Set(receipts.flatMap((receipt) => receipt.supersedesReceiptIds || []));
  return receipts.filter((receipt) => !superseded.has(receipt.receiptId));
}

function runtimeIdentifier() {
  const osName = process.platform === "win32" ? "win" :
    process.platform === "darwin" ? "osx" : process.platform;
  return `${osName}-${process.arch}`;
}

function recordReleaseAuthorizationVerification(options) {
  invariant(isPlainObject(options), "release authorization evidence options are invalid");
  const allowed = new Set([
    "campaignId", "evidenceRoot", "attestationPath", "authorityRegistryPath",
    "authorizationEnvelopePath", "sourceRevision", "nowUtc"
  ]);
  for (const key of Object.keys(options)) invariant(allowed.has(key),
    `unknown release authorization evidence option: ${key}`);
  const campaignId = safeId(options.campaignId, "release authorization campaign ID");
  const sourceRevision = boundedString(options.sourceRevision, "release authorization source revision", 256);
  const nowUtc = utc(options.nowUtc || new Date().toISOString(),
    "release authorization verification time");
  const attestationFile = readJsonFile(options.attestationPath, "final attestation");
  const registryFile = readJsonFile(options.authorityRegistryPath, "release authority registry");
  const envelopeFile = readJsonFile(options.authorizationEnvelopePath,
    "release authorization envelope");
  const result = verifyReleaseAuthorization({
    attestation: attestationFile.value,
    attestationFileSha256: attestationFile.sha256,
    authorityRegistry: registryFile.value,
    authorityRegistrySha256: registryFile.sha256,
    authorizationEnvelope: envelopeFile.value,
    authorizationEnvelopeSha256: envelopeFile.sha256,
    campaignId,
    nowUtc,
    sourceRevision
  });
  const store = new CampaignEvidenceStore(options.evidenceRoot);
  const rebuilt = store.rebuild();
  invariant(rebuilt.quarantined.length === 0 &&
    fs.readdirSync(store.quarantinePath, { withFileTypes: true }).every((entry) => !entry.isFile()),
  "release authorization refuses a quarantined evidence store");
  const history = store.listReceipts((receipt) => receipt.campaignId === campaignId &&
    receipt.receiptType === releaseSignatureReceiptType);
  const current = currentReceipts(history);
  invariant(current.length <= 1, "several current release authorization receipts exist");
  const existing = current.find((receipt) =>
    receipt.inputHashes.releasePredicate === result.predicateSha256 &&
    receipt.inputHashes.authorizationEnvelope === result.authorizationEnvelopeSha256 &&
    receipt.sourceRevision === sourceRevision);
  if (existing) return Object.freeze({ result, receipt: existing });
  const attempt = history.reduce((maximum, receipt) => Math.max(maximum, receipt.attempt), 0) + 1;
  const strictJsonSourcePath = require.resolve("./strict-json.js");
  const toolHash = sha256(canonicalJson({
    schema: "tinyrustlm.tool_source_closure.v1",
    tool: "tinyrustlm-release-authorization-verifier",
    version: "2",
    sources: [
      { name: "campaign-release-authorization-evidence.js",
        sha256: sha256(fs.readFileSync(__filename)) },
      { name: "strict-json.js", sha256: sha256(fs.readFileSync(strictJsonSourcePath)) }
    ]
  }));
  const receipt = store.putReceipt({
    receiptType: releaseSignatureReceiptType,
    campaignId,
    phase: "release-attestation-verification",
    attempt,
    status: "pass",
    createdAtUtc: result.issuedAtUtc,
    completedAtUtc: result.verifiedAtUtc,
    inputReceiptIds: [],
    inputHashes: {
      finalAttestationContent: result.attestationContentSha256,
      finalAttestationFile: result.attestationFileSha256,
      releasePredicate: result.predicateSha256,
      authorityRegistry: result.authorityRegistrySha256,
      authorizationEnvelope: result.authorizationEnvelopeSha256,
      signedPayload: result.signedPayloadSha256,
      authorityPublicKey: result.publicKeySpkiSha256
    },
    outputHashes: {
      releasePredicate: result.predicateSha256,
      verifiedAuthorizationEnvelope: result.authorizationEnvelopeSha256,
      verifiedSignedPayload: result.signedPayloadSha256
    },
    sourceRevision,
    toolNames: ["tinyrustlm-release-authorization-verifier"],
    toolVersions: ["2"],
    toolBinaryHashes: [toolHash],
    runtimeIdentifier: runtimeIdentifier(),
    operatingSystem: process.platform,
    architecture: process.arch,
    hardwareEvidence: {
      cryptographicSignatureVerification: true,
      signatureAlgorithm: "ed25519"
    },
    configurationHash: sha256(canonicalJson({
      authorityRegistrySha256: result.authorityRegistrySha256,
      authorizationVerificationSchema,
      strictJsonProfile,
      sourceRevision
    })),
    publicSafeParameters: result,
    boundedDiagnostics: { decision: result.decision, strictJsonProfile },
    blockerCode: null,
    externalEvidenceReferences: [],
    redactionVersion: "tinyrustlm.public-receipt-redaction.v1",
    evidenceClass: "deployment",
    supersedesReceiptIds: current.map((receipt) => receipt.receiptId),
    attestationReference: `sha256:${result.authorizationEnvelopeSha256}`
  }).receipt;
  return Object.freeze({ result, receipt });
}

function parseCliArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    const value = argv[index + 1];
    invariant([
      "--campaign-id", "--evidence-root", "--attestation", "--authority-registry",
      "--authorization-envelope", "--source-revision"
    ].includes(name), `unknown release authorization argument: ${name}`);
    invariant(value !== undefined, `release authorization argument requires a value: ${name}`);
    if (name === "--campaign-id") options.campaignId = value;
    if (name === "--evidence-root") options.evidenceRoot = value;
    if (name === "--attestation") options.attestationPath = value;
    if (name === "--authority-registry") options.authorityRegistryPath = value;
    if (name === "--authorization-envelope") options.authorizationEnvelopePath = value;
    if (name === "--source-revision") options.sourceRevision = value;
    index += 1;
  }
  invariant(options.campaignId && options.evidenceRoot && options.attestationPath &&
    options.authorityRegistryPath && options.authorizationEnvelopePath && options.sourceRevision,
  "release authorization requires campaign, evidence, attestation, registry, envelope, and revision");
  return options;
}

if (require.main === module) {
  const result = recordReleaseAuthorizationVerification(parseCliArguments(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify({
    schema: result.result.schema,
    predicateSha256: result.result.predicateSha256,
    signingAuthorityId: result.result.signingAuthorityId,
    signingKeyId: result.result.signingKeyId,
    expiresAtUtc: result.result.expiresAtUtc,
    receiptId: result.receipt.receiptId
  }, null, 2)}\n`);
}

module.exports = Object.freeze({
  authorityRegistrySchema,
  authorizationEnvelopeSchema,
  authorizationVerificationSchema,
  recordReleaseAuthorizationVerification,
  validateAuthorityRegistry,
  verifyReleaseAuthorization
});
