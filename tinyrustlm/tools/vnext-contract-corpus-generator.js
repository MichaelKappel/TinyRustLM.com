"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const corpusSchema = "tinyrustlm.vnext.contract_corpus.v1";
const registryPath = path.resolve(__dirname, "../../contracts/vnext/contract-family.v1.json");
const corpusPath = path.resolve(__dirname, "../../contracts/vnext/contract-corpus.v1.json");
const hashes = Object.freeze(Array.from({ length: 16 }, (_value, index) =>
  index.toString(16).repeat(64)));
const ids = Object.freeze(hashes.map((hash) => `sha256:${hash}`));
const byteArtifactHash = "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d";
const emptyHash = crypto.createHash("sha256").update(Buffer.alloc(0)).digest("hex");
const merkleRoot = "51edd1c5a2cd41fa59641dbc62cf6ae372966acba86c1059df84ab7114b99c02";
const sourceRevision = `git-sha1:${"a".repeat(40)}`;
const redaction = Object.freeze({
  profile: "tinyrustlm.vnext.public_safe.v1",
  decision: "public-safe"
});
const schemas = Object.freeze({
  artifact: "tinyrustlm.vnext.artifact_manifest.v1",
  receipt: "tinyrustlm.vnext.receipt.v1",
  context: "tinyrustlm.vnext.context.v1",
  worker: "tinyrustlm.vnext.worker_message.v1",
  companion: "tinyrustlm.vnext.companion_message.v1",
  p2p: "tinyrustlm.vnext.p2p_manifest.v1",
  proof: "tinyrustlm.vnext.outside_proof.v2",
  release: "tinyrustlm.vnext.release_manifest.v3",
  claim: "tinyrustlm.vnext.claim.v2"
});

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function contentHash(text) {
  return crypto.createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
}

function baseReceipt(receiptId = ids[3]) {
  return {
    schema: schemas.receipt,
    receiptId,
    canonicalContentSha256: hashes[3],
    receiptType: "acquisition",
    campaignId: "campaign-vnext-001",
    attemptId: "attempt-vnext-001",
    phase: "acquisition",
    status: "pass",
    startedAtUtc: "2026-08-09T00:00:00Z",
    completedAtUtc: "2026-08-09T00:00:01Z",
    sourceRevision,
    inputReceiptIds: [],
    inputHashes: [],
    outputHashes: [],
    tools: [{
      name: "tinyrustlm-validator",
      version: "1.0.0",
      binarySha256: hashes[4]
    }],
    configurationSha256: hashes[5],
    runtime: {
      runtimeIdentifier: "node-vnext-validator",
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

function securityReceipt(type, id, field, payload) {
  const value = baseReceipt(id);
  value.receiptType = type;
  value.phase = type;
  value[field] = payload;
  return value;
}

function validDocuments() {
  const artifact = {
    schema: schemas.artifact,
    artifactId: `sha256:${byteArtifactHash}`,
    canonicalContentSha256: hashes[0],
    artifactClass: "base-model",
    formatProfile: "slm2.0",
    byteLength: 1,
    artifactSha256: byteArtifactHash,
    metadataSha256: hashes[1],
    dependencyArtifactIds: [],
    pieceManifestId: null,
    provenanceReceiptId: ids[2],
    qualificationReceiptId: null,
    licenseExpression: "Apache-2.0",
    createdAtUtc: "2026-08-09T00:00:00Z",
    redaction
  };
  const receipt = baseReceipt();
  const policyText = "Follow current product policy.";
  const userText = "Choose blue.";
  const context = {
    schema: schemas.context,
    contextId: ids[4],
    canonicalContentSha256: hashes[4],
    modelArtifactId: artifact.artifactId,
    compositionArtifactId: null,
    tokenizerArtifactId: ids[5],
    templateArtifactId: ids[6],
    policyArtifactId: ids[7],
    compilerProfile: "context-compiler-vnext-1",
    compilerSha256: hashes[8],
    kvProfile: "kv-f32-v1",
    conversationIdHash: hashes[9],
    turnId: "turn-vnext-001",
    memorySnapshotReceiptId: null,
    startupPackageId: null,
    segments: [
      {
        ordinal: 0,
        role: "system",
        sourceKind: "product-policy",
        trust: "authoritative",
        content: policyText,
        contentSha256: contentHash(policyText),
        sourceRecordIds: [],
        sourceReceiptIds: [],
        supersedesSourceRecordIds: [],
        conflictGroupId: null
      },
      {
        ordinal: 1,
        role: "user",
        sourceKind: "current-user",
        trust: "authoritative",
        content: userText,
        contentSha256: contentHash(userText),
        sourceRecordIds: [],
        sourceReceiptIds: [],
        supersedesSourceRecordIds: [],
        conflictGroupId: null
      }
    ],
    tokenBudget: {
      contextLimit: 128,
      reservedOutputTokens: 32,
      suppliedTokens: 64,
      truncatedTokens: 0
    },
    privacyClass: "private-volatile",
    persistence: "memory-only",
    createdAtUtc: "2026-08-09T00:00:02Z"
  };
  const worker = {
    schema: schemas.worker,
    protocol: "tinyrustlm-worker-vnext-1",
    messageId: "worker-message-001",
    sessionIdHash: hashes[1],
    generationId: null,
    direction: "request",
    operation: "status",
    deadlineMilliseconds: 5000,
    subjectId: null,
    payloadBytes: 0,
    payloadSha256: emptyHash,
    transferCount: 0,
    sentAtUtc: "2026-08-09T00:00:03Z",
    privacyClass: "private-session"
  };
  const companion = {
    schema: schemas.companion,
    protocol: "tinyrustlm-companion-vnext-1",
    messageId: "companion-message-001",
    direction: "request",
    operation: "status",
    sessionIdHash: hashes[2],
    origin: "https://tinyrustlm.com/",
    scope: "status",
    idempotencyKeyHash: null,
    subjectId: null,
    bodyBytes: 0,
    bodySha256: emptyHash,
    createdAtUtc: "2026-08-09T00:00:04Z",
    privacyClass: "private-session"
  };
  const p2p = {
    schema: schemas.p2p,
    manifestId: ids[5],
    canonicalContentSha256: hashes[5],
    artifactManifestId: ids[6],
    artifactId: artifact.artifactId,
    artifactSha256: byteArtifactHash,
    artifactBytes: 1,
    pieceBytes: 4194304,
    pieceCount: 1,
    pieces: [{ index: 0, offset: 0, length: 1, sha256: byteArtifactHash }],
    merkleProfile: "tinyrustlm.merkle.sha256-4mib.v1",
    merkleRootSha256: merkleRoot,
    compositionArtifactIds: [],
    qualificationReceiptId: ids[7],
    provenanceReceiptId: ids[8],
    licenseExpression: "Apache-2.0",
    createdAtUtc: "2026-08-09T00:00:05Z",
    redaction
  };
  const proof = {
    schema: schemas.proof,
    proofId: ids[6],
    canonicalContentSha256: hashes[6],
    campaignId: "campaign-vnext-001",
    modelArtifactId: artifact.artifactId,
    p2pManifestId: p2p.manifestId,
    laneId: "lane-alpha-001",
    processInstanceId: "process-alpha-001",
    endpoint: "https://peer.example.com/",
    observerId: "observer-external-001",
    observerRegistryId: ids[9],
    nonceHash: hashes[10],
    implementationSha256: hashes[11],
    checkedRoutes: [
      { method: "GET", path: "/artifact", status: 200, byteLength: 1, responseSha256: byteArtifactHash },
      { method: "GET", path: "/manifest", status: 200, byteLength: 100, responseSha256: hashes[12] },
      { method: "GET", path: "/pieces/0", status: 200, byteLength: 1, responseSha256: byteArtifactHash }
    ],
    completeTransferSha256: byteArtifactHash,
    completeTransferBytes: 1,
    networkScope: "outside-host-and-local-network",
    observedAtUtc: "2026-08-09T00:01:00Z",
    issuedAtUtc: "2026-08-09T00:01:01Z",
    expiresAtUtc: "2026-08-09T01:01:01Z",
    redaction
  };
  const release = {
    schema: schemas.release,
    releaseId: ids[7],
    canonicalContentSha256: hashes[7],
    productId: "tinyrustlm",
    version: "1.0.0",
    releaseDate: "2026-08-09",
    sourceRevision,
    campaignPlanSha256: hashes[4],
    campaignProjectionSha256: hashes[5],
    campaignAttestationReceiptId: ids[8],
    artifactManifestIds: [ids[6]],
    packageReceiptIds: [ids[9]],
    claimIds: [ids[11]],
    sbomArtifactId: ids[12],
    provenanceReceiptId: ids[13],
    changelogSha256: hashes[15],
    publicOrigin: "https://tinyrustlm.example.com/",
    webBuildReceiptId: ids[14],
    webDeploymentManifestSha256: hashes[2],
    webSecurityHeaderProfileSha256: hashes[1],
    webPublicationGeneratorSha256: hashes[3],
    webAssets: [
      { path: "/", role: "bootstrap", byteLength: 1, sha256: hashes[4], contentType: "text/html", cachePolicy: "no-store", securityHeaderProfileSha256: hashes[1] },
      { path: `/assets/${hashes[5]}.css`, role: "style", byteLength: 2, sha256: hashes[5], contentType: "text/css", cachePolicy: "immutable", securityHeaderProfileSha256: hashes[1] },
      { path: `/assets/${hashes[6]}.js`, role: "application", byteLength: 3, sha256: hashes[6], contentType: "application/javascript", cachePolicy: "immutable", securityHeaderProfileSha256: hashes[1] },
      { path: `/assets/${hashes[8]}.wasm`, role: "runtime", byteLength: 4, sha256: hashes[8], contentType: "application/wasm", cachePolicy: "immutable", securityHeaderProfileSha256: hashes[1] }
    ].sort((left, right) => left.path.localeCompare(right.path)),
    generatedPublicationFiles: [
      { path: "/.well-known/site-release-history.json", role: "release-history", contentType: "application/json", cachePolicy: "no-store", securityHeaderProfileSha256: hashes[1] },
      { path: "/.well-known/site-release.json", role: "current-release-pointer", contentType: "application/json", cachePolicy: "no-store", securityHeaderProfileSha256: hashes[1] }
    ],
    retiredPublicPaths: ["/app/models/retired.slm"],
    webTotalBytes: 10,
    offlineCapability: "network-only",
    serviceWorkerPath: null,
    remainingRiskCodes: ["training-compute-unavailable"],
    createdAtUtc: "2026-08-09T02:00:00Z",
    redaction
  };
  const claim = {
    schema: schemas.claim,
    claimId: ids[8],
    canonicalContentSha256: hashes[8],
    subjectId: artifact.artifactId,
    siteId: "tinyrustlm-com",
    route: "/status",
    component: "model-status",
    wordingClass: "status",
    claimType: "runtime-smoke-only",
    evidenceTier: "local-executed",
    status: "approved-for-publication",
    scope: "One exact model artifact.",
    publicWording: "The runtime smoke test completed locally.",
    evidenceReceiptIds: [ids[3]],
    sourceRevision,
    releaseId: null,
    effectiveAtUtc: "2026-08-09T02:00:00Z",
    expiresAtUtc: null,
    reviewAtUtc: "2026-08-10T02:00:00Z",
    ownerId: "release-owner-001",
    blockerCodes: [],
    lastVerifiedAtUtc: "2026-08-09T02:00:00Z",
    supersedesClaimIds: [],
    redaction
  };
  const signature = securityReceipt("signature-envelope", ids[9], "signatureEnvelope", {
    algorithm: "ed25519",
    role: "outside-network-observer",
    signatureDomain: "tinyrustlm.signature.outside-network-observer.v1",
    signerId: "observer-external-001",
    keyId: "observer-key-001",
    authorityRegistryReceiptId: ids[10],
    signedSubjectId: proof.proofId,
    signedSchema: schemas.proof,
    campaignId: "campaign-vnext-001",
    releaseId: null,
    scope: "outside-proof",
    signedPayloadSha256: hashes[10],
    nonceHash: hashes[11],
    issuedAtUtc: "2026-08-09T00:01:01Z",
    expiresAtUtc: "2026-08-09T01:01:01Z",
    signature: Buffer.alloc(64, 7).toString("base64")
  });
  const authority = securityReceipt("authority-registry", ids[10], "authorityRegistry", {
    environment: "production",
    previousRegistryReceiptId: null,
    effectiveAtUtc: "2026-08-01T00:00:00Z",
    expiresAtUtc: "2027-08-01T00:00:00Z",
    allowedClockSkewSeconds: 300,
    keys: [{
      keyId: "observer-key-001",
      signerId: "observer-external-001",
      role: "outside-network-observer",
      publicKey: Buffer.alloc(32, 5).toString("base64"),
      status: "active",
      validFromUtc: "2026-08-01T00:00:00Z",
      validUntilUtc: "2027-08-01T00:00:00Z"
    }]
  });
  const revocation = securityReceipt("key-revocation", ids[11], "keyRevocation", {
    authorityRegistryReceiptId: ids[10],
    keyId: "observer-key-000",
    role: "outside-network-observer",
    effectiveAtUtc: "2026-08-09T00:00:00Z",
    compromiseAtUtc: "2026-08-08T00:00:00Z",
    reasonCode: "scheduled-retirement",
    scope: "production-observer",
    predecessorRegistryReceiptId: ids[9],
    replacementKeyId: "observer-key-001"
  });
  const schemaHashes = Object.values(schemas).sort().map((name) => ({ name, sha256: hashes[12] }));
  const offline = securityReceipt("offline-verification-bundle", ids[12], "offlineBundle", {
    bundleManifestSha256: hashes[13],
    receiptIds: [ids[3]],
    signatureEnvelopeReceiptIds: [ids[9]],
    authorityRegistryReceiptIds: [ids[10]],
    revocationReceiptIds: [ids[11]],
    schemaHashes,
    createdAtUtc: "2026-08-09T02:00:00Z"
  });
  const scan = baseReceipt(ids[13]);
  scan.receiptType = "redaction-scan";
  scan.phase = "redaction-scan";
  scan.inputHashes = [{ name: "target-canonical-content", sha256: hashes[14] }];

  return { artifact, receipt, context, worker, companion, p2p, proof, release, claim,
    signature, authority, revocation, offline, scan };
}

function caseRecord(id, contractClass, expected, bytes) {
  return {
    id,
    contractClass,
    expected,
    payloadBytes: bytes.length,
    payloadSha256: sha256(bytes),
    payloadBase64: bytes.toString("base64")
  };
}

function jsonBytes(value) {
  return Buffer.from(JSON.stringify(value), "utf8");
}

function buildCases() {
  const valid = validDocuments();
  const cases = [];
  const accept = (id, contractClass, value) =>
    cases.push(caseRecord(id, contractClass, "accept", jsonBytes(value)));
  const rejectValue = (id, contractClass, source, mutate) => {
    const value = clone(source);
    mutate(value);
    cases.push(caseRecord(id, contractClass, "reject", jsonBytes(value)));
  };
  const rejectBytes = (id, contractClass, bytes) =>
    cases.push(caseRecord(id, contractClass, "reject", bytes));

  for (const [name, contractClass] of [
    ["artifact", "artifact"], ["receipt", "receipt"], ["context", "context"],
    ["worker", "worker"], ["companion", "companion"], ["p2p", "p2p"],
    ["proof", "proof"], ["release", "release"], ["claim", "claim"],
    ["signature", "receipt"], ["authority", "receipt"], ["revocation", "receipt"],
    ["offline", "receipt"], ["scan", "receipt"]
  ]) accept(`valid-${name}`, contractClass, valid[name]);

  for (const [name, contractClass] of [
    ["artifact", "artifact"], ["receipt", "receipt"], ["context", "context"],
    ["worker", "worker"], ["companion", "companion"], ["p2p", "p2p"],
    ["proof", "proof"], ["release", "release"], ["claim", "claim"]
  ]) {
    rejectValue(`reject-${name}-unknown-field`, contractClass, valid[name], (value) => {
      value.legacy = true;
    });
  }

  rejectValue("reject-artifact-id-mismatch", "artifact", valid.artifact, (value) => { value.artifactSha256 = hashes[1]; });
  rejectValue("reject-artifact-profile-mismatch", "artifact", valid.artifact, (value) => { value.formatProfile = "lora2.0"; });
  rejectValue("reject-receipt-pass-with-error", "receipt", valid.receipt, (value) => { value.error = { code: "failure", failureStep: "acquisition", retryStatus: "terminal", rollbackStatus: "not-required" }; });
  rejectValue("reject-receipt-security-payload-missing", "receipt", valid.receipt, (value) => { value.receiptType = "authority-registry"; });
  rejectValue("reject-signature-role-domain", "receipt", valid.signature, (value) => { value.signatureEnvelope.signatureDomain = "tinyrustlm.signature.release-authorizer.v1"; });
  rejectValue("reject-signature-expiry-too-long", "receipt", valid.signature, (value) => { value.signatureEnvelope.expiresAtUtc = "2026-08-20T00:00:00Z"; });
  rejectValue("reject-authority-window-too-long", "receipt", valid.authority, (value) => { value.authorityRegistry.expiresAtUtc = "2028-08-01T00:00:00Z"; });
  rejectValue("reject-revocation-compromise-after-effective", "receipt", valid.revocation, (value) => { value.keyRevocation.compromiseAtUtc = "2026-08-10T00:00:00Z"; });
  rejectValue("reject-offline-missing-schema", "receipt", valid.offline, (value) => { value.offlineBundle.schemaHashes.shift(); });
  rejectValue("reject-scan-without-target-hash", "receipt", valid.scan, (value) => { value.inputHashes[0].name = "other-content"; });
  rejectValue("reject-context-duplicate-current-user", "context", valid.context, (value) => { const copy = clone(value.segments[1]); copy.ordinal = 2; value.segments.push(copy); });
  rejectValue("reject-context-no-product-policy", "context", valid.context, (value) => { value.segments[0].sourceKind = "prior-assistant"; value.segments[0].role = "assistant"; value.segments[0].trust = "trusted"; });
  rejectValue("reject-context-content-hash", "context", valid.context, (value) => { value.segments[1].contentSha256 = hashes[1]; });
  rejectValue("reject-context-token-overflow", "context", valid.context, (value) => { value.tokenBudget.suppliedTokens = 120; });
  rejectValue("reject-context-authoritative-memory", "context", valid.context, (value) => { value.segments[0].sourceKind = "trusted-memory"; value.segments[0].sourceRecordIds = [ids[1]]; });
  rejectValue("reject-worker-direction-operation", "worker", valid.worker, (value) => { value.direction = "event"; value.operation = "load"; });
  rejectValue("reject-worker-generation-id-missing", "worker", valid.worker, (value) => { value.operation = "generate"; });
  rejectValue("reject-worker-empty-payload-hash", "worker", valid.worker, (value) => { value.payloadSha256 = hashes[1]; });
  rejectValue("reject-companion-private-origin", "companion", valid.companion, (value) => { value.origin = "https://localhost/"; });
  rejectValue("reject-companion-scope", "companion", valid.companion, (value) => { value.scope = "inventory"; });
  rejectValue("reject-companion-mutation-without-key", "companion", valid.companion, (value) => { value.operation = "acquire"; value.scope = "acquire"; });
  rejectValue("reject-companion-event-operation", "companion", valid.companion, (value) => { value.direction = "event"; value.operation = "acquire"; value.scope = "acquire"; value.idempotencyKeyHash = hashes[1]; });
  rejectValue("reject-companion-session-missing", "companion", valid.companion, (value) => { value.sessionIdHash = null; });
  rejectValue("reject-p2p-offset", "p2p", valid.p2p, (value) => { value.pieces[0].offset = 1; });
  rejectValue("reject-p2p-merkle", "p2p", valid.p2p, (value) => { value.merkleRootSha256 = hashes[1]; });
  rejectValue("reject-p2p-piece-count", "p2p", valid.p2p, (value) => { value.pieceCount = 2; });
  rejectValue("reject-proof-private-endpoint", "proof", valid.proof, (value) => { value.endpoint = "https://127.0.0.1/"; });
  rejectValue("reject-proof-expiry-policy", "proof", valid.proof, (value) => { value.expiresAtUtc = "2026-08-11T00:01:01Z"; });
  rejectValue("reject-proof-issued-before-observed", "proof", valid.proof, (value) => { value.issuedAtUtc = "2026-08-08T00:00:00Z"; });
  rejectValue("reject-proof-route-order", "proof", valid.proof, (value) => { value.checkedRoutes.reverse(); });
  rejectValue("reject-proof-cyclic-signature-field", "proof", valid.proof, (value) => { value.signatureEnvelopeId = ids[10]; });
  rejectValue("reject-release-date", "release", valid.release, (value) => { value.releaseDate = "2026-08-08"; });
  rejectValue("reject-release-parent-order", "release", valid.release, (value) => { value.artifactManifestIds = [ids[2], ids[1]]; });
  rejectValue("reject-release-postpublication-back-reference", "release", valid.release, (value) => { value.sitePublicationReceiptIds = [ids[10]]; });
  rejectValue("reject-release-authorization-back-reference", "release", valid.release, (value) => { value.authorizationReceiptId = ids[14]; });
  rejectValue("reject-release-web-path-collision", "release", valid.release, (value) => { value.retiredPublicPaths = [value.webAssets.find((entry) => entry.role === "application").path]; });
  rejectValue("reject-release-web-total-mismatch", "release", valid.release, (value) => { value.webTotalBytes += 1; });
  rejectValue("reject-release-web-bootstrap-missing", "release", valid.release, (value) => { value.webAssets.shift(); value.webTotalBytes = 9; });
  rejectValue("reject-release-generated-pointer-role", "release", valid.release, (value) => { value.generatedPublicationFiles[1].role = "release-history"; });
  rejectValue("reject-release-model-byte-route", "release", valid.release, (value) => {
    value.webAssets.splice(3, 0, {
      path: "/models/active.slm",
      role: "runtime",
      byteLength: 1,
      sha256: hashes[9],
      contentType: "application/octet-stream",
      cachePolicy: "immutable",
      securityHeaderProfileSha256: hashes[1]
    });
    value.webTotalBytes = 11;
  });
  rejectValue("reject-release-web-header-profile-drift", "release", valid.release, (value) => { value.webAssets[1].securityHeaderProfileSha256 = hashes[2]; });
  rejectValue("reject-release-immutable-stable-path", "release", valid.release, (value) => { value.webAssets.find((entry) => entry.role === "application").path = "/assets/app.js"; value.webAssets.sort((left, right) => left.path.localeCompare(right.path)); });
  rejectValue("reject-release-network-only-worker", "release", valid.release, (value) => { value.serviceWorkerPath = "/service-worker.js"; });
  rejectValue("reject-claim-approved-with-release", "claim", valid.claim, (value) => { value.releaseId = ids[7]; });
  rejectValue("reject-claim-approved-without-evidence", "claim", valid.claim, (value) => { value.evidenceReceiptIds = []; });
  rejectValue("reject-claim-published-without-release", "claim", valid.claim, (value) => { value.status = "published"; });
  rejectValue("reject-claim-blocked-without-code", "claim", valid.claim, (value) => { value.status = "blocked"; });
  rejectValue("reject-claim-route-traversal", "claim", valid.claim, (value) => { value.route = "/../admin"; });
  rejectValue("reject-claim-review-before-verification", "claim", valid.claim, (value) => { value.reviewAtUtc = "2026-08-08T00:00:00Z"; });

  const artifactJson = JSON.stringify(valid.artifact);
  rejectBytes("reject-parser-duplicate-key", "parser", Buffer.from(`{"schema":"${schemas.artifact}","schema":"${schemas.artifact}"}`, "utf8"));
  rejectBytes("reject-parser-escaped-duplicate-key", "parser", Buffer.from(`{"schema":"${schemas.artifact}","\\u0073chema":"${schemas.artifact}"}`, "utf8"));
  rejectBytes("reject-parser-invalid-utf8", "parser", Buffer.from([0xff]));
  rejectBytes("reject-parser-bom", "parser", Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(artifactJson, "utf8")]));
  rejectBytes("reject-parser-negative-zero", "parser", Buffer.from(`{"schema":"${schemas.worker}","n":-0}`, "utf8"));
  rejectBytes("reject-parser-unsafe-integer", "parser", Buffer.from(`{"schema":"${schemas.worker}","n":9007199254740992}`, "utf8"));
  rejectBytes("reject-parser-trailing-data", "parser", Buffer.from(`${artifactJson}x`, "utf8"));
  rejectBytes("reject-parser-depth", "parser", Buffer.from(`${"[".repeat(33)}0${"]".repeat(33)}`, "utf8"));
  rejectBytes("reject-schema-unknown", "parser", Buffer.from("{\"schema\":\"tinyrustlm.vnext.unknown.v1\"}", "utf8"));
  rejectBytes("reject-schema-dated", "artifact", Buffer.from("{\"schema\":\"tinyrustlm.artifact_manifest.2026-08-09.v1\"}", "utf8"));
  return cases;
}

function normalizedSourceHash() {
  const source = fs.readFileSync(__filename, "utf8").replace(/\r\n/gu, "\n");
  return sha256(Buffer.from(source, "utf8"));
}

function buildCorpus() {
  const registryBytes = fs.readFileSync(registryPath);
  const cases = buildCases();
  return {
    schema: corpusSchema,
    registrySha256: sha256(registryBytes),
    generatorSourceSha256: normalizedSourceHash(),
    encoding: "base64-raw-json",
    caseCount: cases.length,
    cases
  };
}

function buildCorpusText() {
  return `${JSON.stringify(buildCorpus(), null, 2)}\n`;
}

if (require.main === module) {
  fs.writeFileSync(corpusPath, buildCorpusText(), { encoding: "utf8", flag: "w" });
}

module.exports = Object.freeze({
  buildCorpus,
  buildCorpusText,
  corpusPath,
  corpusSchema
});
