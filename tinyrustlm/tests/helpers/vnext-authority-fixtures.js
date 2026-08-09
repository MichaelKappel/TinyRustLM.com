"use strict";

const crypto = require("node:crypto");

const {
  finalizeVnextIdentityDocument
} = require("../../tools/vnext-content-identity.js");
const {
  finalizeVnextReceipt
} = require("../../tools/vnext-receipt-identity.js");
const {
  deriveVnextSignatureMaterial
} = require("../../tools/vnext-signature-payload.js");

const campaignId = "campaign-vnext-001";
const sourceRevision = `git-sha1:${"a".repeat(40)}`;
const redaction = Object.freeze({
  profile: "tinyrustlm.vnext.public_safe.v1",
  decision: "public-safe"
});

function hash(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

function authorityKey({
  keyId,
  signerId,
  role,
  status = "active",
  validFromUtc = "2026-08-01T00:00:00Z",
  validUntilUtc = "2027-08-01T00:00:00Z"
}) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const publicKeyBytes = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  return Object.freeze({
    privateKey,
    record: Object.freeze({
      keyId,
      signerId,
      role,
      publicKey: publicKeyBytes.toString("base64"),
      status,
      validFromUtc,
      validUntilUtc
    })
  });
}

function baseReceiptDraft({
  receiptType,
  attemptId,
  phase = receiptType,
  startedAtUtc = "2026-08-09T00:00:00Z",
  completedAtUtc = startedAtUtc,
  inputReceiptIds = [],
  inputHashes = []
}) {
  return {
    schema: "tinyrustlm.vnext.receipt.v1",
    receiptType,
    campaignId,
    attemptId,
    phase,
    status: "pass",
    startedAtUtc,
    completedAtUtc,
    sourceRevision,
    inputReceiptIds: [...inputReceiptIds].sort(),
    inputHashes: [...inputHashes].sort((left, right) => left.name.localeCompare(right.name)),
    outputHashes: [],
    tools: [{
      name: "vnext-authority-fixture",
      version: "1.0.0",
      binarySha256: hash("vnext-authority-fixture")
    }],
    configurationSha256: hash(`configuration:${attemptId}`),
    runtime: {
      runtimeIdentifier: "node-vnext-authority-test",
      operatingSystem: "windows",
      architecture: "x86_64",
      executionClass: "local"
    },
    publicParameters: [],
    error: null,
    blockerCode: null,
    externalEvidenceReferences: [],
    redaction,
    attestationReference: null,
    signatureEnvelope: null,
    authorityRegistry: null,
    keyRevocation: null,
    offlineBundle: null,
    supersedesReceiptIds: []
  };
}

function makeAuthorityRegistry({
  label,
  keys,
  previous = null,
  environment = "production",
  effectiveAtUtc = "2026-08-01T00:00:00Z",
  expiresAtUtc = "2027-08-01T00:00:00Z",
  allowedClockSkewSeconds = 300
}) {
  const previousId = previous === null ? null : previous.receipt.receiptId;
  const draft = baseReceiptDraft({
    receiptType: "authority-registry",
    attemptId: `registry-${label}`,
    startedAtUtc: effectiveAtUtc,
    completedAtUtc: effectiveAtUtc,
    inputReceiptIds: previousId === null ? [] : [previousId]
  });
  draft.authorityRegistry = {
    environment,
    previousRegistryReceiptId: previousId,
    effectiveAtUtc,
    expiresAtUtc,
    allowedClockSkewSeconds,
    keys: keys.map((entry) => entry.record ?? entry)
      .map((entry) => ({ ...entry }))
      .sort((left, right) => left.keyId.localeCompare(right.keyId))
  };
  return finalizeVnextReceipt(draft);
}

function makeOutsideProof({
  label,
  authorityRegistry,
  observerKey,
  nonceHash = hash(`nonce:${label}`),
  observedAtUtc = "2026-08-09T00:00:00Z",
  issuedAtUtc = "2026-08-09T00:00:01Z",
  expiresAtUtc = "2026-08-09T01:00:01Z"
}) {
  return finalizeVnextIdentityDocument({
    schema: "tinyrustlm.vnext.outside_proof.v2",
    campaignId,
    modelArtifactId: `sha256:${hash(`model:${label}`)}`,
    p2pManifestId: `sha256:${hash(`p2p:${label}`)}`,
    laneId: `lane-${label}`,
    processInstanceId: `process-${label}`,
    endpoint: `https://${label}.peer.example.com/`,
    observerId: observerKey.record.signerId,
    observerRegistryId: authorityRegistry.receipt.receiptId,
    nonceHash,
    implementationSha256: hash(`implementation:${label}`),
    checkedRoutes: [
      { method: "GET", path: "/artifact", status: 200, byteLength: 1,
        responseSha256: hash(`artifact:${label}`) },
      { method: "GET", path: "/manifest", status: 200, byteLength: 2,
        responseSha256: hash(`manifest:${label}`) },
      { method: "GET", path: "/pieces/0", status: 200, byteLength: 1,
        responseSha256: hash(`piece:${label}`) }
    ],
    completeTransferSha256: hash(`artifact:${label}`),
    completeTransferBytes: 1,
    networkScope: "outside-host-and-local-network",
    observedAtUtc,
    issuedAtUtc,
    expiresAtUtc,
    redaction
  });
}

function subjectFacts(subject) {
  if (subject && subject.receipt) {
    return {
      schema: subject.receipt.schema,
      subjectId: subject.receipt.receiptId,
      canonicalContentSha256: subject.receipt.canonicalContentSha256,
      receipt: true
    };
  }
  return {
    schema: subject.schema,
    subjectId: subject.subjectId,
    canonicalContentSha256: subject.canonicalContentSha256,
    receipt: false
  };
}

function makeSignatureReceipt({
  label,
  authorityRegistry,
  subject,
  signingKey,
  role = signingKey.record.role,
  scope,
  signatureDomain,
  issuedAtUtc = "2026-08-09T00:00:01Z",
  expiresAtUtc = "2026-08-09T01:00:01Z",
  nonceHash = hash(`signature-nonce:${label}`),
  releaseId = null,
  tamperSignature = false
}) {
  const facts = subjectFacts(subject);
  const domains = {
    "local-recorder": "tinyrustlm.signature.local-recorder.v1",
    "outside-network-observer": "tinyrustlm.signature.outside-network-observer.v1",
    "p2p-publisher": "tinyrustlm.signature.p2p-publisher.v1",
    "release-authorizer": "tinyrustlm.signature.release-authorizer.v1",
    "site-publisher": "tinyrustlm.signature.site-publisher.v1"
  };
  const unsigned = {
    algorithm: "ed25519",
    role,
    signatureDomain: signatureDomain ?? domains[role],
    signerId: signingKey.record.signerId,
    keyId: signingKey.record.keyId,
    authorityRegistryReceiptId: authorityRegistry.receipt.receiptId,
    signedSubjectId: facts.subjectId,
    signedSchema: facts.schema,
    campaignId,
    releaseId,
    scope,
    signedPayloadSha256: "0".repeat(64),
    nonceHash,
    issuedAtUtc,
    expiresAtUtc,
    signature: Buffer.alloc(64).toString("base64")
  };
  const material = deriveVnextSignatureMaterial(unsigned);
  let signature = crypto.sign(null, material.signingBytes, signingKey.privateKey);
  if (tamperSignature) signature = Buffer.from(signature.map((value, index) =>
    index === 0 ? value ^ 1 : value));
  const envelope = {
    ...unsigned,
    signedPayloadSha256: material.signedPayloadSha256,
    signature: signature.toString("base64")
  };
  const inputReceiptIds = [authorityRegistry.receipt.receiptId];
  const inputHashes = [];
  if (facts.receipt) inputReceiptIds.push(facts.subjectId);
  else inputHashes.push({
    name: "signed-subject-canonical-content",
    sha256: facts.canonicalContentSha256
  });
  const draft = baseReceiptDraft({
    receiptType: "signature-envelope",
    attemptId: `signature-${label}`,
    startedAtUtc: issuedAtUtc,
    completedAtUtc: issuedAtUtc,
    inputReceiptIds,
    inputHashes
  });
  draft.signatureEnvelope = envelope;
  return finalizeVnextReceipt(draft);
}

function makeRevocationReceipt({
  label,
  predecessor,
  successor,
  key,
  replacementKey = null,
  effectiveAtUtc,
  compromiseAtUtc = null
}) {
  const draft = baseReceiptDraft({
    receiptType: "key-revocation",
    attemptId: `revocation-${label}`,
    startedAtUtc: effectiveAtUtc,
    completedAtUtc: effectiveAtUtc,
    inputReceiptIds: [predecessor.receipt.receiptId, successor.receipt.receiptId]
  });
  draft.keyRevocation = {
    authorityRegistryReceiptId: successor.receipt.receiptId,
    keyId: key.record.keyId,
    role: key.record.role,
    effectiveAtUtc,
    compromiseAtUtc,
    reasonCode: "key-compromise",
    scope: "production-authority",
    predecessorRegistryReceiptId: predecessor.receipt.receiptId,
    replacementKeyId: replacementKey === null ? null : replacementKey.record.keyId
  };
  return finalizeVnextReceipt(draft);
}

function makeRootProofGraph({
  proofLabel = "alpha",
  verificationTimeUtc = "2026-08-09T00:30:00Z",
  proofExpiresAtUtc = "2026-08-09T01:00:01Z",
  nonceHash = hash(`nonce:${proofLabel}`),
  observerRole = "outside-network-observer"
} = {}) {
  const observerKey = authorityKey({
    keyId: "observer-key-001",
    signerId: "observer-external-001",
    role: observerRole
  });
  const releaseKey = authorityKey({
    keyId: "release-key-001",
    signerId: "release-authorizer-001",
    role: "release-authorizer"
  });
  const root = makeAuthorityRegistry({ label: "root", keys: [observerKey, releaseKey] });
  const proof = makeOutsideProof({
    label: proofLabel,
    authorityRegistry: root,
    observerKey,
    nonceHash,
    expiresAtUtc: proofExpiresAtUtc
  });
  const signature = makeSignatureReceipt({
    label: proofLabel,
    authorityRegistry: root,
    subject: proof,
    signingKey: observerKey,
    role: "outside-network-observer",
    scope: "outside-proof",
    nonceHash,
    expiresAtUtc: proofExpiresAtUtc
  });
  return {
    campaignId,
    environment: "production",
    verificationTimeUtc,
    trustedRootRegistryReceiptId: root.receipt.receiptId,
    expectedTerminalRegistryReceiptId: root.receipt.receiptId,
    receiptBytes: [root.bytes, signature.bytes],
    subjectBytes: [proof.bytes],
    observerKey,
    releaseKey,
    root,
    proof,
    signature
  };
}

module.exports = Object.freeze({
  authorityKey,
  baseReceiptDraft,
  campaignId,
  hash,
  makeAuthorityRegistry,
  makeOutsideProof,
  makeRevocationReceipt,
  makeRootProofGraph,
  makeSignatureReceipt
});
