"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const {
  directoryFlushHelperVerificationProfileId,
  directoryFlushHelperVerificationProfileSha256,
  verifyDirectoryFlushHelperEvidence
} = require("./directory-flush-helper-verification.js");
const { parseStrictJson } = require("./strict-json.js");
const { canonicalizeVnextJcsBytes } = require("./vnext-jcs.js");
const { failEvidence } = require("./vnext-evidence-error.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const profileRelativePath =
  "contracts/vnext/controlled-power-loss-verification-profile.v1.json";
const profilePath = path.join(repositoryRoot, ...profileRelativePath.split("/"));
const profileBytes = fs.readFileSync(profilePath);
const controlledPowerLossVerificationProfileSha256 = sha256(profileBytes);
const sha256Pattern = /^[a-f0-9]{64}$/u;
const sourceRevisionPattern = /^[a-f0-9]{40}$/u;
const safeIdPattern = /^[a-z0-9][a-z0-9._:-]{2,159}$/u;
const utcPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/u;
const ed25519SpkiPrefix = Buffer.from("302a300506032b6570032100", "hex");

const profileKeys = Object.freeze([
  "acceptedInterruptionClasses", "acceptedRuntimePlatforms",
  "acceptedStorageCacheClasses", "canonicalJsonProfile", "claimScope",
  "evidenceFiles", "hashAlgorithm", "helper", "helperIdentityFields", "limits",
  "nonClaims", "postRestartFields", "preInterruptionFields",
  "preregistrationFields", "profileId", "receiptIdentityDomain", "schemas",
  "signatureAlgorithm", "signatureDomain", "stateFields", "stateMemberFields",
  "status", "trustedWitnessFields", "verificationReceiptFields",
  "verificationSourceClosureMembers", "versionPolicy", "witnessRole",
  "witnessSignatureFields", "schema"
]);
const schemaKeys = Object.freeze([
  "postRestart", "preInterruption", "preregistration", "verificationReceipt"
]);
const evidenceFileKeys = Object.freeze([
  "postRestart", "preInterruption", "preregistration"
]);
const helperProfileKeys = Object.freeze([
  "acceptedTrustClasses", "manifestFile", "provenanceFile",
  "releaseEligibleTrustClass", "verificationProfileId", "verificationReceiptFile"
]);
const runtimePlatformKeys = Object.freeze([
  "architecture", "filesystems", "method", "operatingSystem", "runtimeIdentifier"
]);
const limitKeys = Object.freeze([
  "maximumDocumentBytes", "maximumEvidenceBytes", "maximumHelperMemberBytes",
  "maximumObservationDelaySeconds", "maximumPathCodeUnits", "maximumPayloadBytes",
  "maximumSigningLagSeconds", "maximumSourceMemberBytes"
]);
const trustedWitnessStatuses = new Set(["active", "retired", "revoked"]);

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertDataObject(value, expectedKeys, code, step) {
  if (!isPlainObject(value)) failEvidence(code, step);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Object.keys(descriptors).sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length ||
      actual.some((name, index) => name !== expected[index])) {
    failEvidence(code, step);
  }
  for (const name of actual) {
    const descriptor = descriptors[name];
    if (!Object.hasOwn(descriptor, "value") || descriptor.enumerable !== true) {
      failEvidence(code, step);
    }
  }
}

function exactStringArray(value, expected, code, step) {
  if (!Array.isArray(value) || value.length !== expected.length ||
      value.some((entry, index) => entry !== expected[index])) {
    failEvidence(code, step);
  }
}

function sortedUniqueStrings(value, code, step) {
  if (!Array.isArray(value) || value.length === 0 ||
      value.some((entry) => typeof entry !== "string" || entry.length === 0)) {
    failEvidence(code, step);
  }
  const sorted = [...value].sort();
  if (value.some((entry, index) => entry !== sorted[index]) ||
      new Set(value).size !== value.length) {
    failEvidence(code, step);
  }
}

function validateProfile(value) {
  const code = "controlled_power_loss_profile_invalid";
  const step = "controlled-power-loss-profile";
  assertDataObject(value, profileKeys, code, step);
  if (value.schema !==
        "tinyrustlm.vnext.controlled_power_loss_verification_profile.v1" ||
      value.profileId !== "tinyrustlm.vnext.controlled-power-loss-verification.v1" ||
      value.status !== "frozen" ||
      value.versionPolicy !== "single-current-profile-no-compatibility-reader" ||
      value.canonicalJsonProfile !== "rfc8785-jcs+tinyrustlm.strict-json.v1" ||
      value.hashAlgorithm !== "sha256" ||
      value.receiptIdentityDomain !==
        "tinyrustlm.controlled-power-loss.verification-receipt.v1" ||
      value.signatureAlgorithm !== "ed25519" ||
      value.signatureDomain !==
        "tinyrustlm.controlled-power-loss.physical-witness.v1" ||
      value.witnessRole !== "physical-durability-observer" ||
      value.claimScope !==
        "one-exact-helper-package-machine-volume-filesystem-and-controlled-physical-power-loss-attempt") {
    failEvidence(code, step);
  }
  assertDataObject(value.schemas, schemaKeys, code, step);
  assertDataObject(value.evidenceFiles, evidenceFileKeys, code, step);
  assertDataObject(value.helper, helperProfileKeys, code, step);
  assertDataObject(value.limits, limitKeys, code, step);
  if (value.schemas.preregistration !==
        "tinyrustlm.vnext.controlled_power_loss_preregistration.v1" ||
      value.schemas.preInterruption !==
        "tinyrustlm.vnext.controlled_power_loss_pre_interruption_record.v1" ||
      value.schemas.postRestart !==
        "tinyrustlm.vnext.controlled_power_loss_post_restart_observation.v1" ||
      value.schemas.verificationReceipt !==
        "tinyrustlm.vnext.controlled_power_loss_verification_receipt.v1" ||
      value.evidenceFiles.preregistration !==
        "controlled-power-loss-preregistration.v1.json" ||
      value.evidenceFiles.preInterruption !==
        "controlled-power-loss-pre-interruption.v1.json" ||
      value.evidenceFiles.postRestart !==
        "controlled-power-loss-post-restart.v1.json") {
    failEvidence(code, step);
  }
  if (value.helper.verificationProfileId !== directoryFlushHelperVerificationProfileId ||
      value.helper.verificationReceiptFile !==
        "directory-flush-helper-verification.v1.json" ||
      value.helper.manifestFile !== "directory-flush-helper-manifest.v1.json" ||
      value.helper.provenanceFile !== "directory-flush-helper-provenance.v1.json" ||
      value.helper.releaseEligibleTrustClass !== "release-package") {
    failEvidence(code, step);
  }
  exactStringArray(value.helper.acceptedTrustClasses,
    ["local-test-build", "release-package"], code, step);
  exactStringArray(value.acceptedInterruptionClasses,
    ["external-ac-power-removal", "managed-pdu-power-cut"], code, step);
  exactStringArray(value.acceptedStorageCacheClasses, [
    "unknown", "volatile-with-power-loss-protection",
    "volatile-without-power-loss-protection", "write-through"
  ], code, step);
  if (!Array.isArray(value.acceptedRuntimePlatforms) ||
      value.acceptedRuntimePlatforms.length !== 3) {
    failEvidence(code, step);
  }
  for (const entry of value.acceptedRuntimePlatforms) {
    assertDataObject(entry, runtimePlatformKeys, code, step);
    sortedUniqueStrings(entry.filesystems, code, step);
  }
  exactStringArray(value.acceptedRuntimePlatforms.map((entry) => entry.runtimeIdentifier),
    ["linux-arm64", "linux-x64", "win-x64"], code, step);
  const expectedPlatforms = Object.freeze({
    "linux-arm64": Object.freeze({
      architecture: "aarch64", operatingSystem: "linux",
      method: "posix-directory-fsync", filesystems: ["ext4"]
    }),
    "linux-x64": Object.freeze({
      architecture: "x86_64", operatingSystem: "linux",
      method: "posix-directory-fsync", filesystems: ["ext4"]
    }),
    "win-x64": Object.freeze({
      architecture: "x86_64", operatingSystem: "windows",
      method: "win32-backup-semantics-flush-file-buffers", filesystems: ["ntfs"]
    })
  });
  for (const entry of value.acceptedRuntimePlatforms) {
    const expected = expectedPlatforms[entry.runtimeIdentifier];
    if (!expected || entry.architecture !== expected.architecture ||
        entry.operatingSystem !== expected.operatingSystem ||
        entry.method !== expected.method) {
      failEvidence(code, step);
    }
    exactStringArray(entry.filesystems, expected.filesystems, code, step);
  }
  const fieldLists = [
    "trustedWitnessFields", "witnessSignatureFields", "helperIdentityFields",
    "stateFields", "stateMemberFields", "preregistrationFields",
    "preInterruptionFields", "postRestartFields", "verificationReceiptFields",
    "verificationSourceClosureMembers"
  ];
  for (const name of fieldLists) sortedUniqueStrings(value[name], code, step);
  if (!Number.isSafeInteger(value.limits.maximumDocumentBytes) ||
      value.limits.maximumDocumentBytes !== 65536 ||
      value.limits.maximumEvidenceBytes !== 196608 ||
      value.limits.maximumHelperMemberBytes !== 67108864 ||
      value.limits.maximumPathCodeUnits !== 4096 ||
      value.limits.maximumPayloadBytes !== 17592186044416 ||
      value.limits.maximumObservationDelaySeconds !== 86400 ||
      value.limits.maximumSigningLagSeconds !== 300 ||
      value.limits.maximumSourceMemberBytes !== 16777216) {
    failEvidence(code, step);
  }
  if (!Array.isArray(value.nonClaims) || value.nonClaims.length !== 6 ||
      value.nonClaims.some((entry) => typeof entry !== "string" ||
        entry.length < 20 || entry.length > 512)) {
    failEvidence(code, step);
  }
  return value;
}

let parsedProfile;
try {
  parsedProfile = parseStrictJson(profileBytes);
} catch (error) {
  failEvidence("controlled_power_loss_profile_invalid",
    "controlled-power-loss-profile", error?.code);
}
const controlledPowerLossVerificationProfile = deepFreeze(validateProfile(parsedProfile));
const controlledPowerLossVerificationProfileId =
  controlledPowerLossVerificationProfile.profileId;

function normalizeAbsolutePath(value, code) {
  if (typeof value !== "string" || value.length === 0 ||
      value.length > controlledPowerLossVerificationProfile.limits.maximumPathCodeUnits ||
      !path.isAbsolute(value) || path.resolve(value) !== value) {
    failEvidence(code, "controlled-power-loss-path");
  }
  return value;
}

function assertDirectoryNotLink(directoryPath, code) {
  let stat;
  try {
    stat = fs.lstatSync(directoryPath);
  } catch (error) {
    failEvidence(code, "controlled-power-loss-path", error?.code);
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    failEvidence(code, "controlled-power-loss-path");
  }
}

function rootsOverlap(left, right) {
  const leftToRight = path.relative(left, right);
  const rightToLeft = path.relative(right, left);
  return leftToRight === "" || rightToLeft === "" ||
    (!leftToRight.startsWith("..") && !path.isAbsolute(leftToRight)) ||
    (!rightToLeft.startsWith("..") && !path.isAbsolute(rightToLeft));
}

function assertDisjointRoots(roots) {
  for (let left = 0; left < roots.length; left += 1) {
    for (let right = left + 1; right < roots.length; right += 1) {
      if (rootsOverlap(roots[left], roots[right])) {
        failEvidence("controlled_power_loss_roots_overlap", "controlled-power-loss-path");
      }
    }
  }
}

function readBoundedRegularFile(filePath, maximumBytes, code, step) {
  let stat;
  try {
    stat = fs.lstatSync(filePath);
  } catch (error) {
    failEvidence(code, step, error?.code);
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0 ||
      stat.size > maximumBytes) {
    failEvidence(code, step);
  }
  let bytes;
  try {
    bytes = fs.readFileSync(filePath);
  } catch (error) {
    failEvidence(code, step, error?.code);
  }
  if (bytes.length !== stat.size) failEvidence(code, step);
  return bytes;
}

function readCanonicalDocument(filePath, expectedFields, schema, code) {
  const bytes = readBoundedRegularFile(filePath,
    controlledPowerLossVerificationProfile.limits.maximumDocumentBytes,
    code, "controlled-power-loss-document");
  let value;
  try {
    value = parseStrictJson(bytes);
  } catch (error) {
    failEvidence(code, "controlled-power-loss-document", error?.code);
  }
  assertDataObject(value, expectedFields, code, "controlled-power-loss-document");
  if (value.schema !== schema || !canonicalizeVnextJcsBytes(value).equals(bytes)) {
    failEvidence(code, "controlled-power-loss-document");
  }
  return Object.freeze({ bytes, sha256: sha256(bytes), value });
}

function readEvidenceSnapshot(evidenceRoot) {
  assertDirectoryNotLink(evidenceRoot, "controlled_power_loss_evidence_path_invalid");
  let entries;
  try {
    entries = fs.readdirSync(evidenceRoot).sort();
  } catch (error) {
    failEvidence("controlled_power_loss_evidence_path_invalid",
      "controlled-power-loss-path", error?.code);
  }
  const expected = Object.values(controlledPowerLossVerificationProfile.evidenceFiles).sort();
  if (entries.length !== expected.length ||
      entries.some((entry, index) => entry !== expected[index])) {
    failEvidence("controlled_power_loss_evidence_file_set_invalid",
      "controlled-power-loss-document");
  }
  const preregistration = readCanonicalDocument(
    path.join(evidenceRoot,
      controlledPowerLossVerificationProfile.evidenceFiles.preregistration),
    controlledPowerLossVerificationProfile.preregistrationFields,
    controlledPowerLossVerificationProfile.schemas.preregistration,
    "controlled_power_loss_preregistration_invalid");
  const preInterruption = readCanonicalDocument(
    path.join(evidenceRoot,
      controlledPowerLossVerificationProfile.evidenceFiles.preInterruption),
    controlledPowerLossVerificationProfile.preInterruptionFields,
    controlledPowerLossVerificationProfile.schemas.preInterruption,
    "controlled_power_loss_pre_interruption_invalid");
  const postRestart = readCanonicalDocument(
    path.join(evidenceRoot,
      controlledPowerLossVerificationProfile.evidenceFiles.postRestart),
    controlledPowerLossVerificationProfile.postRestartFields,
    controlledPowerLossVerificationProfile.schemas.postRestart,
    "controlled_power_loss_post_restart_invalid");
  const total = preregistration.bytes.length + preInterruption.bytes.length +
    postRestart.bytes.length;
  if (total > controlledPowerLossVerificationProfile.limits.maximumEvidenceBytes) {
    failEvidence("controlled_power_loss_evidence_size_invalid",
      "controlled-power-loss-document");
  }
  return Object.freeze({ postRestart, preInterruption, preregistration });
}

function parseCanonicalHelperJson(filePath, maximumBytes, code) {
  const bytes = readBoundedRegularFile(filePath, maximumBytes, code,
    "controlled-power-loss-helper");
  let value;
  try {
    value = parseStrictJson(bytes);
  } catch (error) {
    failEvidence(code, "controlled-power-loss-helper", error?.code);
  }
  if (!canonicalizeVnextJcsBytes(value).equals(bytes)) {
    failEvidence(code, "controlled-power-loss-helper");
  }
  return Object.freeze({ bytes, sha256: sha256(bytes), value });
}

function helperExecutableFile(runtimeIdentifier) {
  return runtimeIdentifier === "win-x64"
    ? "tinyrustlm-directory-flush.exe"
    : "tinyrustlm-directory-flush";
}

function readHelperSnapshot(helperPackageRoot, helperEvidenceRoot) {
  const profile = controlledPowerLossVerificationProfile;
  const helperReceipt = parseCanonicalHelperJson(
    path.join(helperEvidenceRoot, profile.helper.verificationReceiptFile),
    profile.limits.maximumDocumentBytes,
    "controlled_power_loss_helper_receipt_invalid");
  const manifest = parseCanonicalHelperJson(
    path.join(helperPackageRoot, profile.helper.manifestFile),
    profile.limits.maximumDocumentBytes,
    "controlled_power_loss_helper_manifest_invalid");
  const provenance = parseCanonicalHelperJson(
    path.join(helperPackageRoot, profile.helper.provenanceFile),
    profile.limits.maximumDocumentBytes,
    "controlled_power_loss_helper_provenance_invalid");
  const receipt = helperReceipt.value;
  const manifestValue = manifest.value;
  const executableFile = helperExecutableFile(receipt.runtimeIdentifier);
  if (manifestValue.executableFile !== executableFile) {
    failEvidence("controlled_power_loss_helper_manifest_invalid",
      "controlled-power-loss-helper");
  }
  const executableBytes = readBoundedRegularFile(
    path.join(helperPackageRoot, executableFile),
    profile.limits.maximumHelperMemberBytes,
    "controlled_power_loss_helper_executable_invalid",
    "controlled-power-loss-helper");
  if (!Array.isArray(receipt.cases) || receipt.cases.length === 0 ||
      receipt.cases.some((entry) => !isPlainObject(entry) ||
        entry.method !== receipt.cases[0].method)) {
    failEvidence("controlled_power_loss_helper_receipt_invalid",
      "controlled-power-loss-helper");
  }
  const identity = {
    architecture: receipt.architecture,
    buildProfile: receipt.buildProfile,
    clientProfileSha256: receipt.clientProfileSha256,
    clientSourceClosureSha256: receipt.clientSourceClosureSha256,
    directoryFlushProfileSha256: manifestValue.directoryFlushProfileSha256,
    executableByteCount: executableBytes.length,
    executableSha256: sha256(executableBytes),
    helperManifestSha256: manifest.sha256,
    helperPackageBuilderSourceClosureSha256:
      receipt.helperPackageBuilderSourceClosureSha256,
    helperProvenanceSha256: provenance.sha256,
    helperSourceClosureSha256: receipt.helperSourceClosureSha256,
    helperSourceRevision: receipt.helperSourceRevision,
    helperSourceWorktreeClean: receipt.helperSourceWorktreeClean,
    method: receipt.cases[0].method,
    operatingSystem: receipt.operatingSystem,
    runtimeIdentifier: receipt.runtimeIdentifier,
    trustClass: receipt.trustClass,
    verificationProfileSha256: receipt.profileSha256,
    verificationReceiptSha256: helperReceipt.sha256,
    verificationSourceClosureSha256: receipt.verificationSourceClosureSha256
  };
  assertDataObject(identity, profile.helperIdentityFields,
    "controlled_power_loss_helper_identity_invalid", "controlled-power-loss-helper");
  if (receipt.profileId !== profile.helper.verificationProfileId ||
      receipt.profileSha256 !== directoryFlushHelperVerificationProfileSha256 ||
      receipt.verdict !== "pass" ||
      receipt.executableByteCount !== identity.executableByteCount ||
      receipt.executableSha256 !== identity.executableSha256 ||
      receipt.helperManifestSha256 !== identity.helperManifestSha256 ||
      receipt.helperProvenanceSha256 !== identity.helperProvenanceSha256 ||
      manifestValue.executableByteCount !== identity.executableByteCount ||
      manifestValue.executableSha256 !== identity.executableSha256 ||
      !sourceRevisionPattern.test(identity.helperSourceRevision) ||
      !profile.helper.acceptedTrustClasses.includes(identity.trustClass) ||
      typeof identity.helperSourceWorktreeClean !== "boolean") {
    failEvidence("controlled_power_loss_helper_identity_invalid",
      "controlled-power-loss-helper");
  }
  for (const name of profile.helperIdentityFields) {
    const value = identity[name];
    if (name.endsWith("Sha256") && !sha256Pattern.test(value)) {
      failEvidence("controlled_power_loss_helper_identity_invalid",
        "controlled-power-loss-helper");
    }
  }
  return deepFreeze({
    identity,
    memberHashes: {
      executable: identity.executableSha256,
      manifest: manifest.sha256,
      provenance: provenance.sha256,
      receipt: helperReceipt.sha256
    }
  });
}

function helperSnapshotsEqual(left, right) {
  return canonicalizeVnextJcsBytes(left).equals(canonicalizeVnextJcsBytes(right));
}

function sourceClosureIdentity() {
  const members = controlledPowerLossVerificationProfile.verificationSourceClosureMembers
    .map((relativePath) => {
      const filePath = path.resolve(repositoryRoot, ...relativePath.split("/"));
      const relative = path.relative(repositoryRoot, filePath);
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
        failEvidence("controlled_power_loss_source_closure_invalid",
          "controlled-power-loss-source");
      }
      const bytes = readBoundedRegularFile(filePath,
        controlledPowerLossVerificationProfile.limits.maximumSourceMemberBytes,
        "controlled_power_loss_source_closure_invalid",
        "controlled-power-loss-source");
      return { byteCount: bytes.length, path: relativePath, sha256: sha256(bytes) };
    });
  return Object.freeze({
    members: deepFreeze(members),
    sha256: sha256(canonicalizeVnextJcsBytes(members))
  });
}

const verificationSourceClosure = sourceClosureIdentity();

function requireSha256(value, code, step) {
  if (!sha256Pattern.test(String(value || ""))) failEvidence(code, step);
  return value;
}

function requireSafeId(value, code, step) {
  if (!safeIdPattern.test(String(value || ""))) failEvidence(code, step);
  return value;
}

function parseUtc(value, code, step) {
  const match = utcPattern.exec(String(value || ""));
  if (!match) failEvidence(code, step);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) ||
      new Date(milliseconds).toISOString() !== `${value.slice(0, -1)}.000Z`) {
    failEvidence(code, step);
  }
  return milliseconds;
}

function decodeCanonicalBase64(value, expectedBytes, code, step) {
  if (typeof value !== "string" || value.length === 0) failEvidence(code, step);
  let bytes;
  try {
    bytes = Buffer.from(value, "base64");
  } catch (error) {
    failEvidence(code, step, error?.code);
  }
  if (bytes.length !== expectedBytes || bytes.toString("base64") !== value) {
    failEvidence(code, step);
  }
  return bytes;
}

function validateTrustedWitness(value, verificationTimeUtc) {
  const code = "controlled_power_loss_trusted_witness_invalid";
  const step = "controlled-power-loss-trust";
  assertDataObject(value, controlledPowerLossVerificationProfile.trustedWitnessFields,
    code, step);
  requireSafeId(value.witnessId, code, step);
  requireSafeId(value.keyId, code, step);
  if (value.role !== controlledPowerLossVerificationProfile.witnessRole ||
      !trustedWitnessStatuses.has(value.status)) {
    failEvidence(code, step);
  }
  const publicKeyBytes = decodeCanonicalBase64(value.publicKey, 32, code, step);
  const validFrom = parseUtc(value.validFromUtc, code, step);
  const validUntil = value.validUntilUtc === null
    ? null
    : parseUtc(value.validUntilUtc, code, step);
  const revokedAt = value.revokedAtUtc === null
    ? null
    : parseUtc(value.revokedAtUtc, code, step);
  const compromisedAt = value.compromisedAtUtc === null
    ? null
    : parseUtc(value.compromisedAtUtc, code, step);
  const verificationTime = parseUtc(verificationTimeUtc, code, step);
  if (validUntil !== null && validUntil <= validFrom ||
      (value.status === "revoked") !== (revokedAt !== null) ||
      revokedAt !== null && revokedAt < validFrom ||
      compromisedAt !== null && compromisedAt < validFrom) {
    failEvidence(code, step);
  }
  return Object.freeze({
    compromisedAt,
    current: value.status === "active" && revokedAt === null &&
      compromisedAt === null && verificationTime >= validFrom &&
      (validUntil === null || verificationTime < validUntil),
    keyId: value.keyId,
    publicKeyBytes,
    publicKeySha256: sha256(publicKeyBytes),
    revokedAt,
    status: value.status,
    validFrom,
    validUntil,
    verificationTime,
    witnessId: value.witnessId
  });
}

function signaturePayload(document) {
  const payload = {};
  for (const [name, value] of Object.entries(document)) {
    if (name !== "witness") payload[name] = value;
  }
  return payload;
}

function verifyWitnessDocument(document, eventTimeUtc, trusted) {
  const code = "controlled_power_loss_witness_signature_invalid";
  const step = "controlled-power-loss-signature";
  assertDataObject(document.witness,
    controlledPowerLossVerificationProfile.witnessSignatureFields, code, step);
  const witness = document.witness;
  if (witness.witnessId !== trusted.witnessId || witness.keyId !== trusted.keyId ||
      witness.signatureDomain !== controlledPowerLossVerificationProfile.signatureDomain) {
    failEvidence(code, step);
  }
  const eventTime = parseUtc(eventTimeUtc, code, step);
  const signedAt = parseUtc(witness.signedAtUtc, code, step);
  const maximumLag = controlledPowerLossVerificationProfile.limits
    .maximumSigningLagSeconds * 1000;
  if (signedAt < eventTime || signedAt - eventTime > maximumLag ||
      signedAt < trusted.validFrom ||
      trusted.validUntil !== null && signedAt >= trusted.validUntil ||
      trusted.revokedAt !== null && signedAt >= trusted.revokedAt ||
      trusted.compromisedAt !== null && signedAt >= trusted.compromisedAt) {
    failEvidence("controlled_power_loss_witness_authority_invalid", step);
  }
  const payloadBytes = canonicalizeVnextJcsBytes(signaturePayload(document));
  const payloadSha256 = sha256(payloadBytes);
  if (witness.signedPayloadSha256 !== payloadSha256) failEvidence(code, step);
  const signature = decodeCanonicalBase64(witness.signature, 64, code, step);
  let publicKey;
  try {
    publicKey = crypto.createPublicKey({
      key: Buffer.concat([ed25519SpkiPrefix, trusted.publicKeyBytes]),
      format: "der",
      type: "spki"
    });
  } catch (error) {
    failEvidence("controlled_power_loss_trusted_witness_invalid", step, error?.code);
  }
  const signingBytes = Buffer.concat([
    Buffer.from(controlledPowerLossVerificationProfile.signatureDomain, "utf8"),
    Buffer.from([0]),
    payloadBytes
  ]);
  let verified = false;
  try {
    verified = crypto.verify(null, signingBytes, publicKey, signature);
  } catch (error) {
    failEvidence(code, step, error?.code);
  }
  if (!verified) failEvidence(code, step);
  return Object.freeze({ payloadSha256, signedAt });
}

function validateHelperIdentity(value, expected) {
  const code = "controlled_power_loss_helper_binding_invalid";
  const step = "controlled-power-loss-binding";
  assertDataObject(value, controlledPowerLossVerificationProfile.helperIdentityFields,
    code, step);
  for (const name of controlledPowerLossVerificationProfile.helperIdentityFields) {
    if (name.endsWith("Sha256") && !sha256Pattern.test(String(value[name] || ""))) {
      failEvidence(code, step);
    }
  }
  if (!sourceRevisionPattern.test(String(value.helperSourceRevision || "")) ||
      !Number.isSafeInteger(value.executableByteCount) || value.executableByteCount <= 0 ||
      typeof value.helperSourceWorktreeClean !== "boolean" ||
      !controlledPowerLossVerificationProfile.helper.acceptedTrustClasses
        .includes(value.trustClass)) {
    failEvidence(code, step);
  }
  if (!canonicalizeVnextJcsBytes(value).equals(canonicalizeVnextJcsBytes(expected))) {
    failEvidence(code, step);
  }
}

function validateState(value, code) {
  const step = "controlled-power-loss-state";
  assertDataObject(value, controlledPowerLossVerificationProfile.stateFields, code, step);
  for (const name of controlledPowerLossVerificationProfile.stateFields) {
    const member = value[name];
    assertDataObject(member, controlledPowerLossVerificationProfile.stateMemberFields,
      code, step);
    if (!Number.isSafeInteger(member.byteCount) || member.byteCount <= 0 ||
        member.byteCount > controlledPowerLossVerificationProfile.limits.maximumPayloadBytes ||
        !sha256Pattern.test(String(member.sha256 || ""))) {
      failEvidence(code, step);
    }
  }
  return value;
}

function validateDocumentBindings(snapshot, helperIdentity, trusted, verificationTimeUtc) {
  const profile = controlledPowerLossVerificationProfile;
  const preregistration = snapshot.preregistration.value;
  const pre = snapshot.preInterruption.value;
  const post = snapshot.postRestart.value;
  const code = "controlled_power_loss_binding_invalid";
  const step = "controlled-power-loss-binding";

  for (const value of [preregistration, pre, post]) {
    requireSafeId(value.testId, code, step);
    requireSafeId(value.targetId, code, step);
    requireSha256(value.machineIdentitySha256, code, step);
    requireSha256(value.volumeIdentitySha256, code, step);
    requireSha256(value.preBootIdentitySha256, code, step);
    validateHelperIdentity(value.helper, helperIdentity);
  }
  requireSha256(preregistration.witnessChallengeSha256, code, step);
  requireSha256(post.postBootIdentitySha256, code, step);
  if (!Number.isSafeInteger(preregistration.maximumObservationDelaySeconds) ||
      preregistration.maximumObservationDelaySeconds <= 0 ||
      preregistration.maximumObservationDelaySeconds >
        profile.limits.maximumObservationDelaySeconds ||
      !profile.acceptedInterruptionClasses.includes(
        preregistration.plannedInterruptionClass) ||
      !profile.acceptedStorageCacheClasses.includes(preregistration.storageCacheClass)) {
    failEvidence(code, step);
  }
  const platform = profile.acceptedRuntimePlatforms.find((entry) =>
    entry.runtimeIdentifier === helperIdentity.runtimeIdentifier);
  if (!platform || platform.operatingSystem !== helperIdentity.operatingSystem ||
      platform.architecture !== helperIdentity.architecture ||
      platform.method !== helperIdentity.method ||
      !platform.filesystems.includes(preregistration.filesystem)) {
    failEvidence("controlled_power_loss_platform_invalid", step);
  }
  const commonFields = [
    "testId", "targetId", "machineIdentitySha256", "volumeIdentitySha256",
    "preBootIdentitySha256", "filesystem", "storageCacheClass"
  ];
  for (const name of commonFields) {
    if (pre[name] !== preregistration[name] || post[name] !== preregistration[name]) {
      failEvidence(code, step);
    }
  }
  if (pre.plannedInterruptionClass !== preregistration.plannedInterruptionClass ||
      post.interruptionObserved !== preregistration.plannedInterruptionClass ||
      pre.preregistrationSha256 !== snapshot.preregistration.sha256 ||
      post.preregistrationSha256 !== snapshot.preregistration.sha256 ||
      post.preInterruptionRecordSha256 !== snapshot.preInterruption.sha256) {
    failEvidence(code, step);
  }
  const expectedState = validateState(preregistration.expectedState,
    "controlled_power_loss_expected_state_invalid");
  const preState = validateState(pre.observedState,
    "controlled_power_loss_pre_state_invalid");
  const postState = validateState(post.observedState,
    "controlled_power_loss_post_state_invalid");
  const expectedBytes = canonicalizeVnextJcsBytes(expectedState);
  if (!expectedBytes.equals(canonicalizeVnextJcsBytes(preState)) ||
      !expectedBytes.equals(canonicalizeVnextJcsBytes(postState))) {
    failEvidence("controlled_power_loss_state_mismatch", step);
  }
  if (pre.armedMarkerPresent !== true || pre.gracefulDisarmMarkerPresent !== false ||
      pre.gracefulShutdownRequested !== false || pre.interruptionAuthorized !== true ||
      post.armedMarkerPresent !== true ||
      post.gracefulDisarmMarkerPresent !== false ||
      post.gracefulShutdownObserved !== false || post.bootIdentityChanged !== true) {
    failEvidence("controlled_power_loss_marker_state_invalid", step);
  }
  if (post.preBootIdentitySha256 === post.postBootIdentitySha256) {
    failEvidence("controlled_power_loss_boot_identity_unchanged", step);
  }
  const preregistrationSignature = verifyWitnessDocument(
    preregistration, preregistration.registeredAtUtc, trusted);
  const preSignature = verifyWitnessDocument(pre, pre.recordedAtUtc, trusted);
  const postSignature = verifyWitnessDocument(post, post.observedAtUtc, trusted);
  const registeredAt = parseUtc(preregistration.registeredAtUtc, code, step);
  const recordedAt = parseUtc(pre.recordedAtUtc, code, step);
  const observedAt = parseUtc(post.observedAtUtc, code, step);
  const verificationTime = parseUtc(verificationTimeUtc, code, step);
  if (registeredAt > preregistrationSignature.signedAt ||
      preregistrationSignature.signedAt > recordedAt ||
      recordedAt > preSignature.signedAt ||
      preSignature.signedAt >= observedAt ||
      observedAt > postSignature.signedAt ||
      postSignature.signedAt > verificationTime) {
    failEvidence("controlled_power_loss_timeline_invalid", step);
  }
  const observationDelaySeconds = (observedAt - preSignature.signedAt) / 1000;
  if (!Number.isSafeInteger(observationDelaySeconds) || observationDelaySeconds <= 0 ||
      observationDelaySeconds > preregistration.maximumObservationDelaySeconds) {
    failEvidence("controlled_power_loss_observation_delay_invalid", step);
  }
  return Object.freeze({ observationDelaySeconds, platform });
}

function receiptContent(receipt) {
  const content = {};
  for (const [name, value] of Object.entries(receipt)) {
    if (name !== "receiptId" && name !== "canonicalContentSha256") content[name] = value;
  }
  return content;
}

function finalizeVerificationReceipt(body) {
  const profile = controlledPowerLossVerificationProfile;
  const digest = crypto.createHash("sha256")
    .update(Buffer.from(profile.receiptIdentityDomain, "utf8"))
    .update(Buffer.from([0]))
    .update(canonicalizeVnextJcsBytes(body))
    .digest("hex");
  const receipt = {
    ...body,
    receiptId: `sha256:${digest}`,
    canonicalContentSha256: digest
  };
  return validateControlledPowerLossVerificationReceipt(
    canonicalizeVnextJcsBytes(receipt));
}

function validateControlledPowerLossVerificationReceipt(input) {
  const profile = controlledPowerLossVerificationProfile;
  const code = "controlled_power_loss_verification_receipt_invalid";
  const step = "controlled-power-loss-receipt";
  const bytes = Buffer.isBuffer(input)
    ? Buffer.from(input)
    : input instanceof Uint8Array
      ? Buffer.from(input.buffer, input.byteOffset, input.byteLength)
      : null;
  if (bytes === null || bytes.length <= 0 ||
      bytes.length > profile.limits.maximumDocumentBytes) {
    failEvidence(code, step);
  }
  let receipt;
  try {
    receipt = parseStrictJson(bytes);
  } catch (error) {
    failEvidence(code, step, error?.code);
  }
  assertDataObject(receipt, profile.verificationReceiptFields, code, step);
  if (!canonicalizeVnextJcsBytes(receipt).equals(bytes) ||
      receipt.schema !== profile.schemas.verificationReceipt ||
      receipt.profileId !== profile.profileId ||
      receipt.profileSha256 !== controlledPowerLossVerificationProfileSha256 ||
      !["fixture-only", "historical-only", "pass"].includes(receipt.verdict) ||
      !["fixture-only", "historical-physical-executed", "physical-executed"]
        .includes(receipt.evidenceTier) ||
      receipt.claimScope !== profile.claimScope ||
      receipt.signedWitnessDocumentsVerified !== true ||
      receipt.broadDurabilityClaimAuthorized !== false ||
      receipt.releaseAuthorized !== false ||
      receipt.campaignProgressAuthorized !== false ||
      !sourceRevisionPattern.test(String(receipt.sourceRevision || "")) ||
      receipt.verificationSourceClosureSha256 !== verificationSourceClosure.sha256) {
    failEvidence(code, step);
  }
  for (const name of [
    "machineIdentitySha256", "volumeIdentitySha256", "preBootIdentitySha256",
    "postBootIdentitySha256", "preregistrationSha256",
    "preInterruptionRecordSha256", "postRestartObservationSha256",
    "profileSha256", "verificationSourceClosureSha256", "witnessPublicKeySha256",
    "trustedWitnessContextSha256", "canonicalContentSha256"
  ]) requireSha256(receipt[name], code, step);
  requireSafeId(receipt.testId, code, step);
  requireSafeId(receipt.targetId, code, step);
  requireSafeId(receipt.witnessId, code, step);
  requireSafeId(receipt.witnessKeyId, code, step);
  validateHelperIdentity(receipt.helper, receipt.helper);
  parseUtc(receipt.verificationTimeUtc, code, step);
  if (!controlledPowerLossVerificationProfile.acceptedInterruptionClasses
      .includes(receipt.interruptionClass) ||
      !controlledPowerLossVerificationProfile.acceptedStorageCacheClasses
        .includes(receipt.storageCacheClass) ||
      typeof receipt.witnessCurrentlyTrusted !== "boolean" ||
      receipt.sourceRevision !== receipt.helper.helperSourceRevision) {
    failEvidence(code, step);
  }
  const platform = controlledPowerLossVerificationProfile.acceptedRuntimePlatforms
    .find((entry) => entry.runtimeIdentifier === receipt.helper.runtimeIdentifier);
  if (!platform || platform.operatingSystem !== receipt.helper.operatingSystem ||
      platform.architecture !== receipt.helper.architecture ||
      platform.method !== receipt.helper.method ||
      !platform.filesystems.includes(receipt.filesystem)) {
    failEvidence(code, step);
  }
  if (!Number.isSafeInteger(receipt.observationDelaySeconds) ||
      receipt.observationDelaySeconds <= 0 ||
      receipt.preBootIdentitySha256 === receipt.postBootIdentitySha256 ||
      receipt.receiptId !== `sha256:${receipt.canonicalContentSha256}`) {
    failEvidence(code, step);
  }
  const digest = crypto.createHash("sha256")
    .update(Buffer.from(profile.receiptIdentityDomain, "utf8"))
    .update(Buffer.from([0]))
    .update(canonicalizeVnextJcsBytes(receiptContent(receipt)))
    .digest("hex");
  if (digest !== receipt.canonicalContentSha256) failEvidence(code, step);
  const validDerivedState =
    receipt.verdict === "fixture-only" && receipt.evidenceTier === "fixture-only" ||
    receipt.verdict === "historical-only" &&
      receipt.evidenceTier === "historical-physical-executed" ||
    receipt.verdict === "pass" && receipt.evidenceTier === "physical-executed";
  const helperReleaseEligible =
    receipt.helper.trustClass === profile.helper.releaseEligibleTrustClass &&
    receipt.helper.helperSourceWorktreeClean === true;
  const expectedVerdict = !helperReleaseEligible
    ? "fixture-only"
    : receipt.witnessCurrentlyTrusted
      ? "pass"
      : "historical-only";
  if (!validDerivedState || receipt.verdict !== expectedVerdict ||
      receipt.verdict === "pass" && receipt.witnessCurrentlyTrusted !== true ||
      receipt.verdict === "historical-only" && receipt.witnessCurrentlyTrusted !== false ||
      receipt.observationDelaySeconds > profile.limits.maximumObservationDelaySeconds) {
    failEvidence(code, step);
  }
  return immutableReceiptResult(receipt, bytes);
}

function verifyControlledPowerLossEvidence(options) {
  const code = "controlled_power_loss_options_invalid";
  const step = "controlled-power-loss-options";
  assertDataObject(options, [
    "evidenceRoot", "helperEvidenceRoot", "helperPackageRoot",
    "trustedWitness", "verificationTimeUtc"
  ], code, step);
  const evidenceRoot = normalizeAbsolutePath(options.evidenceRoot, code);
  const helperEvidenceRoot = normalizeAbsolutePath(options.helperEvidenceRoot, code);
  const helperPackageRoot = normalizeAbsolutePath(options.helperPackageRoot, code);
  assertDisjointRoots([evidenceRoot, helperEvidenceRoot, helperPackageRoot]);
  const trusted = validateTrustedWitness(options.trustedWitness,
    options.verificationTimeUtc);

  const firstHelperVerification = verifyDirectoryFlushHelperEvidence({
    evidenceRoot: helperEvidenceRoot,
    packageRoot: helperPackageRoot
  });
  const firstHelper = readHelperSnapshot(helperPackageRoot, helperEvidenceRoot);
  if (firstHelperVerification.receiptSha256 !==
      firstHelper.identity.verificationReceiptSha256 ||
      firstHelperVerification.runtimeIdentifier !== firstHelper.identity.runtimeIdentifier ||
      firstHelperVerification.verdict !== "pass") {
    failEvidence("controlled_power_loss_helper_verification_invalid",
      "controlled-power-loss-helper");
  }
  const firstEvidence = readEvidenceSnapshot(evidenceRoot);
  const bindings = validateDocumentBindings(firstEvidence, firstHelper.identity,
    trusted, options.verificationTimeUtc);
  const finalEvidence = readEvidenceSnapshot(evidenceRoot);
  const secondHelperVerification = verifyDirectoryFlushHelperEvidence({
    evidenceRoot: helperEvidenceRoot,
    packageRoot: helperPackageRoot
  });
  const finalHelper = readHelperSnapshot(helperPackageRoot, helperEvidenceRoot);
  if (!helperSnapshotsEqual(firstHelper, finalHelper) ||
      firstHelperVerification.receiptSha256 !== secondHelperVerification.receiptSha256 ||
      firstEvidence.preregistration.sha256 !== finalEvidence.preregistration.sha256 ||
      firstEvidence.preInterruption.sha256 !== finalEvidence.preInterruption.sha256 ||
      firstEvidence.postRestart.sha256 !== finalEvidence.postRestart.sha256) {
    failEvidence("controlled_power_loss_inputs_changed",
      "controlled-power-loss-readback");
  }

  const helperReleaseEligible =
    firstHelper.identity.trustClass ===
      controlledPowerLossVerificationProfile.helper.releaseEligibleTrustClass &&
    firstHelper.identity.helperSourceWorktreeClean === true;
  const verdict = !helperReleaseEligible
    ? "fixture-only"
    : trusted.current
      ? "pass"
      : "historical-only";
  const evidenceTier = verdict === "fixture-only"
    ? "fixture-only"
    : verdict === "pass"
      ? "physical-executed"
      : "historical-physical-executed";
  return finalizeVerificationReceipt({
    schema: controlledPowerLossVerificationProfile.schemas.verificationReceipt,
    profileId: controlledPowerLossVerificationProfileId,
    profileSha256: controlledPowerLossVerificationProfileSha256,
    verdict,
    testId: firstEvidence.preregistration.value.testId,
    sourceRevision: firstHelper.identity.helperSourceRevision,
    preregistrationSha256: firstEvidence.preregistration.sha256,
    preInterruptionRecordSha256: firstEvidence.preInterruption.sha256,
    postRestartObservationSha256: firstEvidence.postRestart.sha256,
    verificationSourceClosureSha256: verificationSourceClosure.sha256,
    helper: firstHelper.identity,
    witnessId: trusted.witnessId,
    witnessKeyId: trusted.keyId,
    witnessPublicKeySha256: trusted.publicKeySha256,
    trustedWitnessContextSha256:
      sha256(canonicalizeVnextJcsBytes(options.trustedWitness)),
    witnessCurrentlyTrusted: trusted.current,
    verificationTimeUtc: options.verificationTimeUtc,
    signedWitnessDocumentsVerified: true,
    machineIdentitySha256:
      firstEvidence.preregistration.value.machineIdentitySha256,
    volumeIdentitySha256: firstEvidence.preregistration.value.volumeIdentitySha256,
    preBootIdentitySha256: firstEvidence.preregistration.value.preBootIdentitySha256,
    postBootIdentitySha256: firstEvidence.postRestart.value.postBootIdentitySha256,
    filesystem: firstEvidence.preregistration.value.filesystem,
    interruptionClass:
      firstEvidence.preregistration.value.plannedInterruptionClass,
    storageCacheClass: firstEvidence.preregistration.value.storageCacheClass,
    targetId: firstEvidence.preregistration.value.targetId,
    observationDelaySeconds: bindings.observationDelaySeconds,
    evidenceTier,
    claimScope: controlledPowerLossVerificationProfile.claimScope,
    broadDurabilityClaimAuthorized: false,
    releaseAuthorized: false,
    campaignProgressAuthorized: false
  });
}

function verifyControlledPowerLossReceiptReplay(options) {
  const code = "controlled_power_loss_receipt_replay_invalid";
  const step = "controlled-power-loss-replay";
  assertDataObject(options, [
    "evidenceRoot", "helperEvidenceRoot", "helperPackageRoot", "receiptBytes",
    "trustedWitness", "verificationTimeUtc"
  ], code, step);
  const supplied = validateControlledPowerLossVerificationReceipt(options.receiptBytes);
  const regenerated = verifyControlledPowerLossEvidence({
    evidenceRoot: options.evidenceRoot,
    helperEvidenceRoot: options.helperEvidenceRoot,
    helperPackageRoot: options.helperPackageRoot,
    trustedWitness: options.trustedWitness,
    verificationTimeUtc: options.verificationTimeUtc
  });
  if (!supplied.bytes.equals(regenerated.bytes)) {
    failEvidence("controlled_power_loss_receipt_replay_mismatch", step);
  }
  return supplied;
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value)) deepFreeze(entry);
    if (!Object.isFrozen(value)) Object.freeze(value);
  }
  return value;
}

function immutableReceiptResult(receipt, bytes) {
  const canonical = Buffer.from(bytes);
  const result = {};
  Object.defineProperties(result, {
    receipt: { enumerable: true, value: deepFreeze(receipt) },
    bytes: { enumerable: true, get: () => Buffer.from(canonical) }
  });
  return Object.freeze(result);
}

module.exports = Object.freeze({
  controlledPowerLossVerificationProfile,
  controlledPowerLossVerificationProfileId,
  controlledPowerLossVerificationProfileSha256,
  verificationSourceClosureSha256: verificationSourceClosure.sha256,
  verifyControlledPowerLossEvidence,
  verifyControlledPowerLossReceiptReplay
});
