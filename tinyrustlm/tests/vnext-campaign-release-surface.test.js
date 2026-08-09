"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  campaignReleaseSurfaceProfile,
  campaignReleaseSurfaceProfileSha256,
  createVnextCampaignReleaseSurface
} = require("../tools/vnext-campaign-release-surface.js");
const {
  createVnextCampaignRunner
} = require("../tools/vnext-campaign-runner.js");
const {
  createVnextCampaignArtifactStore
} = require("../tools/vnext-campaign-artifact-store.js");
const {
  finalizeVnextIdentityDocument,
  validateVnextIdentityDocumentBytes
} = require("../tools/vnext-content-identity.js");
const {
  collectParentReceiptIds,
  createVnextReceiptStore
} = require("../tools/vnext-receipt-store.js");
const {
  createVnextSubjectStore
} = require("../tools/vnext-subject-store.js");
const {
  domainSeparatedDigest,
  finalizeVnextReceipt,
  validateVnextReceiptBytes
} = require("../tools/vnext-receipt-identity.js");
const {
  classifyVnextPhaseReceipts
} = require("../tools/vnext-phase-invalidation.js");
const {
  createVnextRedactionScanReceipt,
  scanVnextPublicDocumentBytes
} = require("../tools/vnext-public-safe-redaction.js");
const { parseStrictJson } = require("../tools/strict-json.js");
const {
  authorityKey,
  makeAuthorityRegistry,
  makeSignatureReceipt
} = require("./helpers/vnext-authority-fixtures.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "campaign-release-surface-profile.v1.json");
const planPath = path.join(repositoryRoot, "contracts", "vnext",
  "campaign-plan-parity-fixture.v1.json");
const vectorsPath = path.join(repositoryRoot, "contracts", "vnext",
  "campaign-projection-rust-vectors.v1.json");
const wasmPath = path.join(repositoryRoot, "target", "wasm32-unknown-unknown", "release",
  "tinyrustlm_evidence_wasm.wasm");
const ownedPrefix = "tinyrustlm-vnext-release-surface-";
const sourceRevision = `git-sha1:${"b".repeat(40)}`;
const vectors = JSON.parse(fs.readFileSync(vectorsPath, "utf8"));
const receipts = new Map(vectors.receipts.map((entry) => [
  entry.receiptId,
  Buffer.from(entry.bytesBase64, "base64")
]));
const subjects = new Map(vectors.subjects.map((entry) => [
  entry.subjectId,
  Buffer.from(entry.bytesBase64, "base64")
]));
let wasmBytes;

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function operationId(label) {
  return `sha256:${sha256(Buffer.from(label, "utf8"))}`;
}

function buildWasm() {
  if (wasmBytes) return wasmBytes;
  const cargo = process.env.CARGO || (process.platform === "win32" && process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, ".cargo", "bin", "cargo.exe")
    : "cargo");
  const result = childProcess.spawnSync(cargo, [
    "build", "-p", "tinyrustlm-evidence-wasm", "--release",
    "--target", "wasm32-unknown-unknown", "--locked", "--offline"
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
    windowsHide: true
  });
  assert.equal(result.error, undefined, `WASM build spawn failed: ${result.error?.code}`);
  assert.equal(result.status, 0, `WASM build failed:\n${result.stdout}\n${result.stderr}`);
  wasmBytes = fs.readFileSync(wasmPath);
  return wasmBytes;
}

function makeRoots(t) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), ownedPrefix));
  const roots = Object.freeze({
    parent,
    artifacts: path.join(parent, "artifacts"),
    receipts: path.join(parent, "receipts"),
    runner: path.join(parent, "runner"),
    subjects: path.join(parent, "subjects")
  });
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  return roots;
}

function acceptedCase(name) {
  const entry = vectors.acceptedCases.find((candidate) => candidate.name === name);
  assert.ok(entry, `missing accepted case ${name}`);
  return entry;
}

function addReceipts(store, receiptIds) {
  const requested = new Set(receiptIds);
  const complete = new Set();
  function add(receiptId) {
    if (complete.has(receiptId)) return;
    const bytes = receipts.get(receiptId);
    assert.ok(bytes, `missing receipt ${receiptId}`);
    const validated = validateVnextReceiptBytes(bytes);
    for (const parent of collectParentReceiptIds(validated.receipt)) {
      assert.ok(requested.has(parent), `case omits receipt parent ${parent}`);
      add(parent);
    }
    store.put(bytes);
    complete.add(receiptId);
  }
  for (const receiptId of receiptIds) add(receiptId);
}

function seedCase(roots, entry) {
  const artifactStore = createVnextCampaignArtifactStore(roots.artifacts);
  artifactStore.putPlan(fs.readFileSync(planPath));
  const receiptStore = createVnextReceiptStore(roots.receipts);
  addReceipts(receiptStore, entry.receiptIds);
  const subjectStore = createVnextSubjectStore(roots.subjects);
  for (const subjectId of entry.subjectIds) {
    const bytes = subjects.get(subjectId);
    assert.ok(bytes, `missing subject ${subjectId}`);
    subjectStore.put(bytes);
  }
}

function seedEphemeralAuthorityCase(roots, entry, options = {}) {
  const artifactStore = createVnextCampaignArtifactStore(roots.artifacts);
  artifactStore.putPlan(fs.readFileSync(planPath));
  const original = new Map(entry.receiptIds.map((receiptId) => {
    const bytes = receipts.get(receiptId);
    assert.ok(bytes, `missing receipt ${receiptId}`);
    return [receiptId, validateVnextReceiptBytes(bytes)];
  }));
  const objective = new Map([...original].filter(([, validated]) =>
    !["authority-registry", "signature-envelope"].includes(
      validated.receipt.receiptType
    )));
  const receiptStore = createVnextReceiptStore(roots.receipts);
  const complete = new Set();
  function addObjective(receiptId) {
    if (complete.has(receiptId)) return;
    const validated = objective.get(receiptId);
    assert.ok(validated, `missing objective parent ${receiptId}`);
    for (const parentId of collectParentReceiptIds(validated.receipt)) {
      addObjective(parentId);
    }
    receiptStore.put(validated.bytes);
    complete.add(receiptId);
  }
  for (const receiptId of objective.keys()) addObjective(receiptId);

  const authority = {
    localKey: authorityKey({
      keyId: "release-surface-local-key",
      signerId: "release-surface-local-recorder",
      role: "local-recorder"
    }),
    observerKey: authorityKey({
      keyId: "release-surface-observer-key",
      signerId: "release-surface-outside-observer",
      role: "outside-network-observer"
    }),
    p2pKey: authorityKey({
      keyId: "release-surface-p2p-key",
      signerId: "release-surface-p2p-publisher",
      role: "p2p-publisher"
    }),
    releaseKey: authorityKey({
      keyId: "release-surface-authorizer-key",
      signerId: "release-surface-authorizer",
      role: "release-authorizer",
      status: options.releaseKeyStatus ?? "active"
    })
  };
  authority.root = makeAuthorityRegistry({
    label: "release-surface-ephemeral-root",
    keys: [
      authority.localKey,
      authority.observerKey,
      authority.p2pKey,
      authority.releaseKey
    ]
  });
  receiptStore.put(authority.root.bytes);
  for (const validated of objective.values()) {
    const isCatalog = validated.receipt.receiptType === "catalog-announcement";
    const signature = makeSignatureReceipt({
      authorityRegistry: authority.root,
      label: `release-surface-${validated.receipt.receiptId.slice(7, 23)}`,
      scope: isCatalog ? "p2p-publication" : "receipt-recording",
      signingKey: isCatalog ? authority.p2pKey : authority.localKey,
      subject: validated
    });
    receiptStore.put(signature.bytes);
  }

  const subjectStore = createVnextSubjectStore(roots.subjects);
  for (const subjectId of entry.subjectIds) {
    const originalBytes = subjects.get(subjectId);
    assert.ok(originalBytes, `missing subject ${subjectId}`);
    const originalProof = validateVnextIdentityDocumentBytes(originalBytes);
    assert.equal(originalProof.schema, "tinyrustlm.vnext.outside_proof.v2");
    const { proofId: _proofId, canonicalContentSha256: _canonicalHash,
      ...proofDraft } = originalProof.value;
    const proof = finalizeVnextIdentityDocument({
      ...proofDraft,
      observerId: authority.observerKey.record.signerId,
      observerRegistryId: authority.root.receipt.receiptId
    });
    subjectStore.put(proof.bytes);
    const signature = makeSignatureReceipt({
      authorityRegistry: authority.root,
      expiresAtUtc: proof.value.expiresAtUtc,
      issuedAtUtc: proof.value.issuedAtUtc,
      label: `release-surface-proof-${proof.subjectId.slice(7, 23)}`,
      nonceHash: proof.value.nonceHash,
      scope: "outside-proof",
      signingKey: authority.observerKey,
      subject: proof
    });
    receiptStore.put(signature.bytes);
  }
  return Object.freeze(authority);
}

function runnerOptions(roots) {
  const wasm = buildWasm();
  return {
    campaignArtifactStoreRoot: roots.artifacts,
    expectedWasmModuleSha256: sha256(wasm),
    receiptStoreRoot: roots.receipts,
    subjectStoreRoot: roots.subjects,
    wasmModuleBytes: wasm
  };
}

function surfaceInput(entry, label, overrides = {}) {
  return {
    campaignPlanSha256: entry.expectedCampaignPlanSha256,
    expectedCampaignId: entry.expectedCampaignId,
    expectedEnvironment: entry.expectedEnvironment,
    expectedTerminalRegistryReceiptId: entry.expectedTerminalRegistryReceiptId,
    knownSecrets: [],
    operationId: operationId(label),
    sourceRevision,
    trustedRootRegistryReceiptId: entry.trustedRootRegistryReceiptId,
    verificationTimeUtc: entry.verificationTimeUtc,
    ...overrides
  };
}

function fixtureRuntime() {
  return {
    architecture: "x86_64",
    executionClass: "local",
    operatingSystem: "windows",
    runtimeIdentifier: "node.test.release-preparation"
  };
}

function phaseReceipt(entry, input) {
  return finalizeVnextReceipt({
    schema: "tinyrustlm.vnext.receipt.v1",
    receiptType: input.receiptType,
    campaignId: entry.expectedCampaignId,
    attemptId: input.attemptId,
    phase: input.phase,
    status: "pass",
    startedAtUtc: entry.verificationTimeUtc,
    completedAtUtc: entry.verificationTimeUtc,
    sourceRevision,
    inputReceiptIds: [],
    inputHashes: [...input.inputHashes].sort((left, right) =>
      left.name.localeCompare(right.name)),
    outputHashes: [...input.outputHashes].sort((left, right) =>
      left.name.localeCompare(right.name)),
    tools: [{
      name: "tinyrustlm.vnext.release-preparation-test",
      version: "1.0.0",
      binarySha256: sha256(Buffer.from("release-preparation-test", "utf8"))
    }],
    configurationSha256: sha256(Buffer.from("release-preparation-fixture", "utf8")),
    runtime: fixtureRuntime(),
    publicParameters: [
      { name: "operation_id", value: operationId(input.attemptId), unit: null },
      { name: "subject_id", value: input.subjectId, unit: null },
      ...(input.publicParameters ?? [])
    ].sort((left, right) => left.name.localeCompare(right.name)),
    error: null,
    blockerCode: null,
    externalEvidenceReferences: [],
    redaction: {
      profile: "tinyrustlm.vnext.public_safe.v1",
      decision: "public-safe"
    },
    attestationReference: null,
    signatureEnvelope: null,
    authorityRegistry: null,
    keyRevocation: null,
    offlineBundle: null,
    supersedesReceiptIds: input.supersedesReceiptIds ?? []
  });
}

function qualificationRecords(entry) {
  return entry.receiptIds.map((receiptId) =>
    validateVnextReceiptBytes(receipts.get(receiptId)).receipt)
    .filter((receipt) => receipt.receiptType === "qualification")
    .map((receipt) => ({
      artifactId: receipt.publicParameters.find((parameter) =>
        parameter.name === "artifact_id").value,
      qualificationReceiptId: receipt.receiptId
    }))
    .sort((left, right) => left.artifactId.localeCompare(right.artifactId));
}

function releaseArtifact(input) {
  return finalizeVnextIdentityDocument({
    schema: "tinyrustlm.vnext.artifact_manifest.v1",
    artifactId: input.artifactId,
    artifactClass: input.artifactClass,
    formatProfile: input.formatProfile,
    byteLength: input.byteLength,
    artifactSha256: input.artifactId.slice("sha256:".length),
    metadataSha256: sha256(Buffer.from(`metadata:${input.artifactId}`, "utf8")),
    dependencyArtifactIds: input.dependencyArtifactIds ?? [],
    pieceManifestId: null,
    provenanceReceiptId: input.provenanceReceiptId,
    qualificationReceiptId: input.qualificationReceiptId,
    licenseExpression: "Apache-2.0",
    createdAtUtc: "2026-08-08T00:00:00Z",
    redaction: {
      profile: "tinyrustlm.vnext.public_safe.v1",
      decision: "public-safe"
    }
  });
}

function approvedClaim(entry, input) {
  return finalizeVnextIdentityDocument({
    schema: "tinyrustlm.vnext.claim.v2",
    subjectId: input.subjectId,
    siteId: "tinyrustlm.com",
    route: input.route,
    component: input.component,
    wordingClass: input.wordingClass,
    claimType: "conversation-proven",
    evidenceTier: "local-executed",
    status: "approved-for-publication",
    scope: "The selected qualified TinyRustLM artifact under the bound campaign.",
    publicWording: input.publicWording,
    evidenceReceiptIds: [input.evidenceReceiptId],
    sourceRevision,
    releaseId: null,
    effectiveAtUtc: "2026-08-08T00:00:00Z",
    expiresAtUtc: input.expiresAtUtc ?? "2026-08-10T00:00:00Z",
    reviewAtUtc: input.reviewAtUtc ?? "2026-08-10T00:00:00Z",
    ownerId: "release-owner",
    blockerCodes: [],
    lastVerifiedAtUtc: "2026-08-09T00:00:00Z",
    supersedesClaimIds: [],
    redaction: {
      profile: "tinyrustlm.vnext.public_safe.v1",
      decision: "public-safe"
    }
  });
}

function seedReleaseInputs(roots, entry, options = {}) {
  const qualifications = qualificationRecords(entry);
  assert.equal(qualifications.length, 20);
  const sbomArtifactId = operationId("release-sbom-artifact");
  const artifactManifestIds = [...qualifications.map((entryValue) =>
    entryValue.artifactId), sbomArtifactId].sort();
  const artifactSetSha256 = domainSeparatedDigest(
    "tinyrustlm.release-artifact-set.v1",
    artifactManifestIds
  );
  const provenance = phaseReceipt(entry, {
    attemptId: "release-provenance-001",
    inputHashes: [{ name: "release-artifact-set", sha256: artifactSetSha256 }],
    outputHashes: [{
      name: "provenance-statement",
      sha256: sha256(Buffer.from("release-provenance-statement", "utf8"))
    }],
    phase: "release-provenance",
    receiptType: "review",
    subjectId: sbomArtifactId
  });
  const packageReceipt = phaseReceipt(entry, {
    attemptId: "release-package-001",
    inputHashes: [{ name: "release-artifact-set", sha256: artifactSetSha256 }],
    outputHashes: [{
      name: "release-package",
      sha256: sha256(Buffer.from("release-package", "utf8"))
    }],
    phase: "package",
    receiptType: "package",
    subjectId: sbomArtifactId
  });
  const changelogBytes = options.changelogBytes ?? Buffer.from(
    "# TinyRustLM 1.0.0\n\n- Prepared the complete evidence-bound release.\n",
    "utf8"
  );
  const publicOrigin = "https://tinyrustlm.example.com/";
  const webDeploymentManifestBytes = Buffer.from(
    "{\"schema\":\"tinyrustlm.web_deployment_manifest.v3\"}\n",
    "utf8"
  );
  const webSecurityHeaderProfileBytes = Buffer.from(
    "default-src 'self'; object-src 'none'; base-uri 'none'\n",
    "utf8"
  );
  const webPublicationGeneratorBytes = Buffer.from(
    "export const publicationProfile = 'tinyrustlm.web-publication.v1';\n",
    "utf8"
  );
  const webSecurityHeaderProfileSha256 = sha256(webSecurityHeaderProfileBytes);
  const webCssSha256 = sha256(Buffer.from("web-css", "utf8"));
  const webAppSha256 = sha256(Buffer.from("web-app", "utf8"));
  const webWasmSha256 = sha256(Buffer.from("web-wasm", "utf8"));
  const webAssets = [
    {
      path: "/",
      role: "bootstrap",
      byteLength: 128,
      sha256: sha256(Buffer.from("web-root", "utf8")),
      contentType: "text/html",
      cachePolicy: "no-store",
      securityHeaderProfileSha256: webSecurityHeaderProfileSha256
    },
    {
      path: `/assets/${webCssSha256}.css`,
      role: "style",
      byteLength: 256,
      sha256: webCssSha256,
      contentType: "text/css",
      cachePolicy: "immutable",
      securityHeaderProfileSha256: webSecurityHeaderProfileSha256
    },
    {
      path: `/assets/${webAppSha256}.js`,
      role: "application",
      byteLength: 512,
      sha256: webAppSha256,
      contentType: "application/javascript",
      cachePolicy: "immutable",
      securityHeaderProfileSha256: webSecurityHeaderProfileSha256
    },
    {
      path: `/assets/${webWasmSha256}.wasm`,
      role: "runtime",
      byteLength: 1024,
      sha256: webWasmSha256,
      contentType: "application/wasm",
      cachePolicy: "immutable",
      securityHeaderProfileSha256: webSecurityHeaderProfileSha256
    }
  ].sort((left, right) => left.path.localeCompare(right.path));
  const generatedPublicationFiles = [
    {
      path: "/.well-known/site-release-history.json",
      role: "release-history",
      contentType: "application/json",
      cachePolicy: "no-store",
      securityHeaderProfileSha256: webSecurityHeaderProfileSha256
    },
    {
      path: "/.well-known/site-release.json",
      role: "current-release-pointer",
      contentType: "application/json",
      cachePolicy: "no-store",
      securityHeaderProfileSha256: webSecurityHeaderProfileSha256
    }
  ];
  const webAssetInventorySha256 = domainSeparatedDigest(
    "tinyrustlm.web-asset-inventory.v1",
    webAssets
  );
  const webBuildReceipt = phaseReceipt(entry, {
    attemptId: "web-build-001",
    inputHashes: [
      { name: "web-deployment-manifest", sha256: sha256(webDeploymentManifestBytes) },
      { name: "web-publication-generator", sha256: sha256(webPublicationGeneratorBytes) },
      { name: "web-release-changelog", sha256: sha256(changelogBytes) },
      { name: "web-security-header-profile", sha256: webSecurityHeaderProfileSha256 }
    ],
    outputHashes: [
      { name: "web-asset-inventory", sha256: webAssetInventorySha256 }
    ],
    phase: "web-build",
    publicParameters: [
      { name: "public-origin", value: publicOrigin, unit: null }
    ],
    receiptType: "build",
    subjectId: "tinyrustlm"
  });
  const receiptStore = createVnextReceiptStore(roots.receipts);
  receiptStore.put(provenance.bytes);
  receiptStore.put(packageReceipt.bytes);
  receiptStore.put(webBuildReceipt.bytes);
  let supersedingPackage = null;
  if (options.supersedePackage === true) {
    supersedingPackage = phaseReceipt(entry, {
      attemptId: "release-package-001",
      inputHashes: [{
        name: "release-artifact-set",
        sha256: sha256(Buffer.from("changed-release-artifact-set", "utf8"))
      }],
      outputHashes: [{
        name: "release-package",
        sha256: sha256(Buffer.from("changed-release-package", "utf8"))
      }],
      phase: "package",
      receiptType: "package",
      subjectId: sbomArtifactId,
      supersedesReceiptIds: [packageReceipt.receipt.receiptId]
    });
    receiptStore.put(supersedingPackage.bytes);
  }

  const subjectStore = createVnextSubjectStore(roots.subjects);
  for (const [index, qualification] of qualifications.entries()) {
    const artifact = releaseArtifact({
      artifactId: qualification.artifactId,
      artifactClass: index === 0 ? "base-model" : "specialist-model",
      byteLength: 1024 + index,
      formatProfile: "slm2.0",
      provenanceReceiptId: provenance.receipt.receiptId,
      qualificationReceiptId: qualification.qualificationReceiptId
    });
    subjectStore.put(artifact.bytes);
  }
  const sbom = releaseArtifact({
    artifactId: sbomArtifactId,
    artifactClass: "sbom",
    byteLength: 2048,
    formatProfile: "cyclonedx-json-1.6",
    provenanceReceiptId: provenance.receipt.receiptId,
    qualificationReceiptId: null
  });
  subjectStore.put(sbom.bytes);

  const claims = [];
  const claimCount = options.claimCount ?? 1;
  for (let index = 0; index < claimCount; index += 1) {
    const claim = approvedClaim(entry, {
      component: `qualified-model-${index + 1}`,
      evidenceReceiptId: qualifications[index].qualificationReceiptId,
      expiresAtUtc: options.claimExpiresAtUtc,
      publicWording: `Qualified model ${index + 1} completed the bound conversation campaign.`,
      route: `/models/${index + 1}`,
      subjectId: qualifications[index].artifactId,
      wordingClass: "quality"
    });
    subjectStore.put(claim.bytes);
    claims.push(claim);
  }

  return {
    artifactManifestIds,
    changelogBytes,
    claimIds: claims.map((claim) => claim.subjectId).sort(),
    generatedPublicationFiles,
    offlineCapability: "network-only",
    packageReceiptIds: [packageReceipt.receipt.receiptId],
    productId: "tinyrustlm",
    provenanceReceiptId: provenance.receipt.receiptId,
    publicOrigin,
    remainingRiskCodes: ["authorized-publication-pending"],
    retiredPublicPaths: ["/app/models/retired.slm"],
    sbomArtifactId,
    serviceWorkerPath: null,
    supersedingPackageReceiptId: supersedingPackage?.receipt.receiptId ?? null,
    version: "1.0.0",
    webAssets,
    webBuildReceiptId: webBuildReceipt.receipt.receiptId,
    webDeploymentManifestBytes,
    webPublicationGeneratorBytes,
    webSecurityHeaderProfileBytes
  };
}

function prepareInput(entry, label, releaseInput, overrides = {}) {
  return {
    ...surfaceInput(entry, label),
    artifactManifestIds: releaseInput.artifactManifestIds,
    changelogBytes: releaseInput.changelogBytes,
    claimIds: releaseInput.claimIds,
    packageReceiptIds: releaseInput.packageReceiptIds,
    productId: releaseInput.productId,
    provenanceReceiptId: releaseInput.provenanceReceiptId,
    publicOrigin: releaseInput.publicOrigin,
    webBuildReceiptId: releaseInput.webBuildReceiptId,
    webDeploymentManifestBytes: releaseInput.webDeploymentManifestBytes,
    webSecurityHeaderProfileBytes: releaseInput.webSecurityHeaderProfileBytes,
    webPublicationGeneratorBytes: releaseInput.webPublicationGeneratorBytes,
    webAssets: releaseInput.webAssets,
    generatedPublicationFiles: releaseInput.generatedPublicationFiles,
    retiredPublicPaths: releaseInput.retiredPublicPaths,
    offlineCapability: releaseInput.offlineCapability,
    serviceWorkerPath: releaseInput.serviceWorkerPath,
    remainingRiskCodes: releaseInput.remainingRiskCodes,
    sbomArtifactId: releaseInput.sbomArtifactId,
    version: releaseInput.version,
    ...overrides
  };
}

function authorizeInput(entry, authority, prepared, releaseInput,
  authorizationReceipt, overrides = {}) {
  return {
    authorizationReceiptBytes: authorizationReceipt.bytes,
    changelogBytes: releaseInput.changelogBytes,
    expectedCampaignId: entry.expectedCampaignId,
    expectedEnvironment: entry.expectedEnvironment,
    expectedTerminalRegistryReceiptId: authority.root.receipt.receiptId,
    knownSecrets: [],
    releaseManifestId: prepared.releaseManifestId,
    sourceRevision,
    trustedRootRegistryReceiptId: authority.root.receipt.receiptId,
    verificationTimeUtc: "2026-08-09T00:32:00Z",
    webDeploymentManifestBytes: releaseInput.webDeploymentManifestBytes,
    webSecurityHeaderProfileBytes: releaseInput.webSecurityHeaderProfileBytes,
    webPublicationGeneratorBytes: releaseInput.webPublicationGeneratorBytes,
    ...overrides
  };
}

function deploymentAttemptReceipt(entry, prepared, authorizationReceipt,
  releaseInput, label, overrides = {}) {
  const attemptId = operationId(label);
  const webAssetInventorySha256 = domainSeparatedDigest(
    "tinyrustlm.web-asset-inventory.v1",
    releaseInput.webAssets
  );
  const base = {
    schema: "tinyrustlm.vnext.receipt.v1",
    receiptType: "deployment",
    campaignId: entry.expectedCampaignId,
    attemptId,
    phase: "deployment",
    status: "pass",
    startedAtUtc: "2026-08-09T00:33:00Z",
    completedAtUtc: "2026-08-09T00:33:30Z",
    sourceRevision,
    inputReceiptIds: [releaseInput.webBuildReceiptId],
    inputHashes: [
      {
        name: "release-manifest-canonical-content",
        sha256: prepared.releaseManifestSha256
      },
      { name: "web-asset-inventory", sha256: webAssetInventorySha256 },
      {
        name: "web-deployment-manifest",
        sha256: sha256(releaseInput.webDeploymentManifestBytes)
      },
      {
        name: "web-publication-generator",
        sha256: sha256(releaseInput.webPublicationGeneratorBytes)
      },
      {
        name: "web-security-header-profile",
        sha256: sha256(releaseInput.webSecurityHeaderProfileBytes)
      }
    ],
    outputHashes: [
      {
        name: "deployment-attempt-transcript",
        sha256: sha256(Buffer.from(`deployment-transcript:${label}`, "utf8"))
      },
      {
        name: "submitted-web-asset-inventory",
        sha256: webAssetInventorySha256
      }
    ],
    tools: [{
      name: "tinyrustlm.vnext.deployment-executor-test",
      version: "1.0.0",
      binarySha256: sha256(Buffer.from("deployment-executor-test", "utf8"))
    }],
    configurationSha256: sha256(Buffer.from("deployment-executor-config", "utf8")),
    runtime: {
      architecture: "x86_64",
      executionClass: "deployment",
      operatingSystem: "windows",
      runtimeIdentifier: "node.test.deployment-executor"
    },
    publicParameters: [
      {
        name: "asset-count",
        value: String(releaseInput.webAssets.length),
        unit: "assets"
      },
      {
        name: "authorization-receipt-id",
        value: authorizationReceipt.receipt.receiptId,
        unit: null
      },
      { name: "evidence-scope", value: "deployment-attempt-only", unit: null },
      { name: "operation_id", value: attemptId, unit: null },
      { name: "public-origin", value: releaseInput.publicOrigin, unit: null },
      { name: "subject_id", value: prepared.releaseManifestId, unit: null },
      {
        name: "total-bytes",
        value: String(releaseInput.webAssets.reduce((total, asset) =>
          total + asset.byteLength, 0)),
        unit: "bytes"
      }
    ].sort((left, right) => left.name.localeCompare(right.name)),
    error: null,
    blockerCode: null,
    externalEvidenceReferences: [
      { kind: "https", value: releaseInput.publicOrigin },
      { kind: "receipt", value: authorizationReceipt.receipt.receiptId }
    ].sort((left, right) => left.value.localeCompare(right.value)),
    redaction: {
      profile: "tinyrustlm.vnext.public_safe.v1",
      decision: "public-safe"
    },
    attestationReference: prepared.attestationReceiptId,
    signatureEnvelope: null,
    authorityRegistry: null,
    keyRevocation: null,
    offlineBundle: null,
    supersedesReceiptIds: []
  };
  return finalizeVnextReceipt({
    ...base,
    ...overrides,
    inputHashes: overrides.inputHashes ?? base.inputHashes,
    inputReceiptIds: overrides.inputReceiptIds ?? base.inputReceiptIds,
    outputHashes: overrides.outputHashes ?? base.outputHashes,
    publicParameters: overrides.publicParameters ?? base.publicParameters,
    runtime: overrides.runtime ? { ...base.runtime, ...overrides.runtime } : base.runtime
  });
}

function deploymentInput(entry, authority, prepared, releaseInput,
  authorizationReceipt, deploymentReceipt, overrides = {}) {
  return {
    authorizationReceiptId: authorizationReceipt.receipt.receiptId,
    changelogBytes: releaseInput.changelogBytes,
    deploymentReceiptBytes: deploymentReceipt.bytes,
    expectedCampaignId: entry.expectedCampaignId,
    expectedEnvironment: entry.expectedEnvironment,
    expectedTerminalRegistryReceiptId: authority.root.receipt.receiptId,
    knownSecrets: [],
    releaseManifestId: prepared.releaseManifestId,
    sourceRevision,
    trustedRootRegistryReceiptId: authority.root.receipt.receiptId,
    verificationTimeUtc: "2026-08-09T00:34:00Z",
    webDeploymentManifestBytes: releaseInput.webDeploymentManifestBytes,
    webSecurityHeaderProfileBytes: releaseInput.webSecurityHeaderProfileBytes,
    webPublicationGeneratorBytes: releaseInput.webPublicationGeneratorBytes,
    ...overrides
  };
}

async function rejectsCode(callback, code) {
  await assert.rejects(callback, (error) => error?.code === code, `expected ${code}`);
}

test("freezes one no-compatibility campaign release surface profile", () => {
  const bytes = fs.readFileSync(profilePath);
  const profile = parseStrictJson(bytes);
  assert.equal(campaignReleaseSurfaceProfileSha256, sha256(bytes));
  assert.equal(campaignReleaseSurfaceProfileSha256,
    "d867dc809b5fc1f504469edfd25c7b1f3b93e8448ba5571558f6a5f4b9079bed");
  assert.equal(campaignReleaseSurfaceProfile.profileId,
    "tinyrustlm.vnext.campaign-release-surface.v1");
  assert.equal(profile.status, "frozen");
  assert.equal(profile.storedProjectionPolicy, "forbidden");
  assert.equal(profile.callerVerdictPolicy, "forbidden");
  assert.equal(profile.callerCounterPolicy, "forbidden");
  assert.equal(profile.mutablePointerPolicy, "forbidden");
  assert.equal(profile.networkAccess, "forbidden-until-public-readback-operation");
  assert.equal(profile.releasePreparation.authorizationPolicy,
    "forbidden-in-preparation");
  assert.equal(profile.releasePreparation.artifactCoverage,
    "all-campaign-qualified-artifacts-plus-explicit-dependency-closure-and-sbom");
  assert.equal(profile.releasePreparation.claimSelection,
    "all-current-approved-claims-for-source-revision");
  assert.equal(profile.releaseAuthorization.role, "release-authorizer");
  assert.equal(profile.releaseAuthorization.scope, "release-authorization");
  assert.equal(profile.releaseAuthorization.authorityPolicy,
    "exactly-one-current-evidence-eligible-signature");
  assert.equal(profile.releaseAuthorization.callerDecisionPolicy, "forbidden");
  assert.equal(profile.releaseDeployment.evidenceScope, "deployment-attempt-only");
  assert.equal(profile.releaseDeployment.callerSuccessPolicy, "forbidden");
  assert.equal(profile.releaseDeployment.publicReadbackPolicy,
    "required-before-any-deployed-or-published-claim");
  assert.equal(profile.operatorStatus.doneState,
    "forbidden-before-authorized-release-and-public-readback");
  assert.doesNotMatch(bytes.toString("utf8"),
    /fallback|migration|deprecated|alias|dual-reader|dual-writer/iu);
});

test("attests an honest zero projection without claiming release completion", {
  timeout: 180_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("honest-zero");
  seedCase(roots, entry);
  const surface = await createVnextCampaignReleaseSurface(roots.runner,
    runnerOptions(roots));
  const input = surfaceInput(entry, "honest-zero-attestation");
  const result = await surface.attestCampaign(input);

  assert.equal(result.campaignComplete, false);
  assert.equal(result.releaseEligible, false);
  assert.match(result.attestationReceiptId, /^sha256:[a-f0-9]{64}$/u);
  assert.match(result.redactionReceiptId, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(result.operatorStatus.state, "campaign-incomplete");
  assert.equal(result.operatorStatus.releaseEligible, false);
  assert.deepEqual(result.operatorStatus.counts, {
    announcedModels: { current: 0, target: 20 },
    cleanBrowserRounds: { current: 0, target: 50 },
    liveMemoryRounds: { current: 0, target: 25 },
    outsideProvenLanes: { current: 0, target: 40 },
    qualifiedModels: { current: 0, target: 20 }
  });
  assert.doesNotMatch(result.operatorStatusBytes.toString("utf8"), /\bdone\b/iu);

  const store = createVnextReceiptStore(roots.receipts);
  const attestation = store.read(result.attestationReceiptId).receipt;
  const redaction = store.read(result.redactionReceiptId).receipt;
  assert.equal(attestation.receiptType, "final-attestation");
  assert.equal(attestation.status, "blocked");
  assert.equal(attestation.blockerCode, "campaign-objectives-incomplete");
  assert.deepEqual(attestation.inputReceiptIds, []);
  assert.equal(redaction.receiptType, "redaction-scan");
  assert.equal(redaction.status, "pass");
  assert.equal(redaction.inputHashes.some((binding) =>
    binding.name === "target-canonical-content" &&
      binding.sha256 === attestation.canonicalContentSha256), true);

  await rejectsCode(() => surface.attestCampaign(input),
    "release_surface_operation_not_fresh");
});

test("attests exact complete capacity while remaining prepublication", {
  timeout: 180_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("complete-capacity");
  seedCase(roots, entry);
  const surface = await createVnextCampaignReleaseSurface(roots.runner,
    runnerOptions(roots));
  const result = await surface.attestCampaign(surfaceInput(entry, "complete-attestation"));

  assert.equal(result.campaignComplete, true);
  assert.equal(result.releaseEligible, true);
  assert.equal(result.operatorStatus.state, "campaign-complete-awaiting-release-inputs");
  assert.deepEqual(result.operatorStatus.blockerCodes, []);
  assert.deepEqual(result.operatorStatus.counts, {
    announcedModels: { current: 20, target: 20 },
    cleanBrowserRounds: { current: 50, target: 50 },
    liveMemoryRounds: { current: 25, target: 25 },
    outsideProvenLanes: { current: 40, target: 40 },
    qualifiedModels: { current: 20, target: 20 }
  });
  const store = createVnextReceiptStore(roots.receipts);
  const attestation = store.read(result.attestationReceiptId).receipt;
  assert.equal(attestation.status, "pass");
  assert.equal(attestation.blockerCode, null);
  assert.equal(attestation.inputReceiptIds.length, 271);
  assert.deepEqual(attestation.supersedesReceiptIds, []);
  assert.equal(attestation.inputHashes.find((entryValue) =>
    entryValue.name === "campaign-projection-result").sha256,
  result.projectionResultSha256);
});

test("rejects stored projection, caller verdict, counter drift, and accessors", {
  timeout: 180_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("honest-zero");
  seedCase(roots, entry);
  const surface = await createVnextCampaignReleaseSurface(roots.runner,
    runnerOptions(roots));
  const base = surfaceInput(entry, "forbidden-caller-truth");
  for (const injected of [
    { projectionResultBytes: Buffer.from("{}", "utf8") },
    { complete: true },
    { counts: { qualifiedModels: { current: 20, target: 20 } } },
    { dashboard: { done: true } }
  ]) {
    await rejectsCode(() => surface.attestCampaign({ ...base, ...injected }),
      "release_surface_input_invalid");
  }
  let invoked = false;
  const hostile = { ...base };
  Object.defineProperty(hostile, "knownSecrets", {
    enumerable: true,
    get() {
      invoked = true;
      return [];
    }
  });
  await rejectsCode(() => surface.attestCampaign(hostile),
    "release_surface_input_invalid_accessor");
  assert.equal(invoked, false);

  const hostilePrepare = {
    ...base,
    artifactManifestIds: [operationId("hostile-artifact")],
    claimIds: [operationId("hostile-claim")],
    packageReceiptIds: [operationId("hostile-package")],
    productId: "tinyrustlm",
    provenanceReceiptId: operationId("hostile-provenance"),
    publicOrigin: "https://tinyrustlm.example.com/",
    webBuildReceiptId: operationId("hostile-web-build"),
    webDeploymentManifestBytes: Buffer.from("{}", "utf8"),
    webSecurityHeaderProfileBytes: Buffer.from("test", "utf8"),
    webPublicationGeneratorBytes: Buffer.from("test", "utf8"),
    webAssets: [],
    generatedPublicationFiles: [],
    retiredPublicPaths: [],
    offlineCapability: "network-only",
    serviceWorkerPath: null,
    remainingRiskCodes: [],
    sbomArtifactId: operationId("hostile-artifact"),
    version: "1.0.0"
  };
  Object.defineProperty(hostilePrepare, "changelogBytes", {
    enumerable: true,
    get() {
      invoked = true;
      return Buffer.from("# Unsafe accessor\n", "utf8");
    }
  });
  await rejectsCode(() => surface.prepareRelease(hostilePrepare),
    "release_surface_prepare_input_invalid_accessor");
  assert.equal(invoked, false);
  assert.deepEqual(createVnextReceiptStore(roots.receipts).rebuild().activeReceiptIds, []);
});

test("rejects malformed web publication graphs before campaign replay", {
  timeout: 180_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("complete-capacity");
  seedCase(roots, entry);
  const releaseInput = seedReleaseInputs(roots, entry);
  const surface = await createVnextCampaignReleaseSurface(roots.runner,
    runnerOptions(roots));
  const base = prepareInput(entry, "invalid-web-graph", releaseInput);
  const rootlessAssets = releaseInput.webAssets.slice(1);
  const modelRouteAssets = releaseInput.webAssets.map((asset) =>
    asset.role === "application" ? { ...asset, path: "/models/active.slm" } : asset)
    .sort((left, right) => left.path.localeCompare(right.path));
  const stableImmutableAssets = releaseInput.webAssets.map((asset) =>
    asset.role === "application" ? { ...asset, path: "/assets/app.js" } : asset)
    .sort((left, right) => left.path.localeCompare(right.path));
  const wrongGeneratedRole = releaseInput.generatedPublicationFiles.map((entryValue) =>
    entryValue.role === "current-release-pointer" ?
      { ...entryValue, role: "release-history" } : entryValue);
  const generatedBackReference = releaseInput.generatedPublicationFiles.map((entryValue) =>
    entryValue.role === "current-release-pointer" ?
      { ...entryValue, releaseManifestId: operationId("forbidden-back-reference") } :
      entryValue);
  const wrongHeaderAssets = releaseInput.webAssets.map((asset) =>
    asset.role === "style" ? {
      ...asset,
      securityHeaderProfileSha256: sha256(Buffer.from("wrong-header-profile", "utf8"))
    } : asset);
  const cases = [
    ["private-origin", { publicOrigin: "https://127.0.0.1/" },
      "release_surface_public_origin_invalid"],
    ["active-retired-collision", {
      retiredPublicPaths: [releaseInput.webAssets.find((asset) =>
        asset.role === "application").path]
    },
      "release_surface_web_graph_invalid"],
    ["missing-root", { webAssets: rootlessAssets },
      "release_surface_web_graph_invalid"],
    ["model-byte-route", { webAssets: modelRouteAssets },
      "release_surface_web_graph_invalid"],
    ["stable-immutable-path", { webAssets: stableImmutableAssets },
      "release_surface_web_graph_invalid"],
    ["wrong-generated-role", { generatedPublicationFiles: wrongGeneratedRole },
      "release_surface_web_graph_invalid"],
    ["generated-back-reference", { generatedPublicationFiles: generatedBackReference },
      "release_surface_generated_files_invalid"],
    ["header-profile-drift", { webAssets: wrongHeaderAssets },
      "release_surface_web_assets_invalid"],
    ["network-only-worker", { serviceWorkerPath: "/service-worker.js" },
      "release_surface_web_graph_invalid"]
  ];
  for (const [label, overrides, expectedCode] of cases) {
    await rejectsCode(() => surface.prepareRelease({
      ...base,
      operationId: operationId(`invalid-web-${label}`),
      ...overrides
    }), expectedCode);
  }
  const missingWebAssets = { ...base };
  delete missingWebAssets.webAssets;
  await rejectsCode(() => surface.prepareRelease(missingWebAssets),
    "release_surface_prepare_input_invalid");
  await rejectsCode(() => surface.prepareRelease({ ...base, compatibilityMode: true }),
    "release_surface_prepare_input_invalid");
  assert.equal(createVnextSubjectStore(roots.subjects).rebuild().activeSubjectIds.some(
    (subjectId) => createVnextSubjectStore(roots.subjects).read(subjectId).schema ===
      "tinyrustlm.vnext.release_manifest.v3"), false);
});

test("rejects a valid-looking web inventory that drifts from build evidence", {
  timeout: 180_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("complete-capacity");
  seedCase(roots, entry);
  const releaseInput = seedReleaseInputs(roots, entry);
  const surface = await createVnextCampaignReleaseSurface(roots.runner,
    runnerOptions(roots));
  const driftedAssets = releaseInput.webAssets.map((asset) =>
    asset.role === "application" ? {
      ...asset,
      byteLength: asset.byteLength + 1,
      sha256: sha256(Buffer.from("drifted-web-app", "utf8")),
      contentType: "application/json",
      cachePolicy: "no-cache"
    } : asset);
  await rejectsCode(() => surface.prepareRelease(prepareInput(
    entry,
    "drifted-web-inventory",
    releaseInput,
    { webAssets: driftedAssets }
  )), "release_surface_web_build_binding_invalid");
  const subjectStore = createVnextSubjectStore(roots.subjects);
  assert.equal(subjectStore.rebuild().activeSubjectIds.some((subjectId) =>
    subjectStore.read(subjectId).schema === "tinyrustlm.vnext.release_manifest.v3"), false);
});

test("rejects campaign, environment, and authority pin mismatches", {
  timeout: 180_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("honest-zero");
  seedCase(roots, entry);
  const surface = await createVnextCampaignReleaseSurface(roots.runner,
    runnerOptions(roots));
  const cases = [
    ["campaign", { expectedCampaignId: "campaign-vnext-wrong" },
      "campaign_plan_projection_mismatch"],
    ["environment", { expectedEnvironment: "preview" },
      "campaign_projection_input_invalid"],
    ["authority", {
      expectedTerminalRegistryReceiptId: `sha256:${"0".repeat(64)}`,
      trustedRootRegistryReceiptId: `sha256:${"0".repeat(64)}`
    }, "authority_registry_count_invalid"]
  ];
  for (const [label, overrides, expectedCode] of cases) {
    await rejectsCode(() => surface.attestCampaign(surfaceInput(
      entry,
      `mismatch-${label}`,
      overrides
    )), expectedCode);
  }
});

test("rejects failed and interrupted operation histories instead of resuming them", {
  timeout: 240_000
}, async (t) => {
  const failedRoots = makeRoots(t);
  const entry = acceptedCase("honest-zero");
  seedCase(failedRoots, entry);
  const failedInput = surfaceInput(entry, "failed-before-release", {
    expectedCampaignId: "campaign-vnext-wrong"
  });
  const failedRunner = await createVnextCampaignRunner(failedRoots.runner,
    runnerOptions(failedRoots));
  await rejectsCode(() => failedRunner.runProjection({
    campaignPlanSha256: failedInput.campaignPlanSha256,
    expectedCampaignId: failedInput.expectedCampaignId,
    expectedEnvironment: failedInput.expectedEnvironment,
    expectedTerminalRegistryReceiptId: failedInput.expectedTerminalRegistryReceiptId,
    operationId: failedInput.operationId,
    trustedRootRegistryReceiptId: failedInput.trustedRootRegistryReceiptId,
    verificationTimeUtc: failedInput.verificationTimeUtc
  }), "campaign_plan_projection_mismatch");
  const failedSurface = await createVnextCampaignReleaseSurface(failedRoots.runner,
    runnerOptions(failedRoots));
  await rejectsCode(() => failedSurface.attestCampaign(failedInput),
    "release_surface_operation_not_fresh");

  const interruptedRoots = makeRoots(t);
  seedCase(interruptedRoots, entry);
  const interruptedInput = surfaceInput(entry, "interrupted-before-release");
  const script = String.raw`
    const fs = require("node:fs");
    const { createVnextCampaignRunner } = require(process.argv[1]);
    const roots = JSON.parse(process.argv[2]);
    const input = JSON.parse(process.argv[3]);
    const wasm = fs.readFileSync(process.argv[4]);
    const expected = process.argv[5];
    let armed = false;
    const io = new Proxy(fs, { get(target, property) {
      if (property === "linkSync") return (source, destination) => {
        const value = fs.linkSync(source, destination);
        if (armed && String(destination).includes("operations") &&
            String(destination).endsWith(".json")) process.exit(77);
        return value;
      };
      return Reflect.get(target, property, target);
    }});
    (async () => {
      const runner = await createVnextCampaignRunner(roots.runner, {
        campaignArtifactStoreRoot: roots.artifacts,
        expectedWasmModuleSha256: expected,
        io,
        receiptStoreRoot: roots.receipts,
        subjectStoreRoot: roots.subjects,
        wasmModuleBytes: wasm
      });
      armed = true;
      await runner.runProjection(input);
      process.exit(2);
    })().catch(() => process.exit(3));
  `;
  const runnerModule = path.join(repositoryRoot, "tinyrustlm", "tools",
    "vnext-campaign-runner.js");
  const child = childProcess.spawnSync(process.execPath, [
    "-e", script,
    runnerModule,
    JSON.stringify(interruptedRoots),
    JSON.stringify({
      campaignPlanSha256: interruptedInput.campaignPlanSha256,
      expectedCampaignId: interruptedInput.expectedCampaignId,
      expectedEnvironment: interruptedInput.expectedEnvironment,
      expectedTerminalRegistryReceiptId:
        interruptedInput.expectedTerminalRegistryReceiptId,
      operationId: interruptedInput.operationId,
      trustedRootRegistryReceiptId: interruptedInput.trustedRootRegistryReceiptId,
      verificationTimeUtc: interruptedInput.verificationTimeUtc
    }),
    wasmPath,
    sha256(buildWasm())
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    timeout: 120_000,
    windowsHide: true
  });
  assert.equal(child.status, 77, `${child.stdout}\n${child.stderr}`);
  const interruptedSurface = await createVnextCampaignReleaseSurface(
    interruptedRoots.runner,
    runnerOptions(interruptedRoots)
  );
  await rejectsCode(() => interruptedSurface.attestCampaign(interruptedInput),
    "release_surface_operation_not_fresh");
});

test("records only a public-safe redaction failure when an attestation contains a known secret", {
  timeout: 180_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("complete-capacity");
  seedCase(roots, entry);
  const secret = entry.receiptIds[0].slice("sha256:".length, "sha256:".length + 20);
  const surface = await createVnextCampaignReleaseSurface(roots.runner,
    runnerOptions(roots));
  const result = await surface.attestCampaign(surfaceInput(entry, "secret-attestation", {
    knownSecrets: [secret]
  }));

  assert.equal(result.campaignComplete, true);
  assert.equal(result.releaseEligible, false);
  assert.equal(result.attestationReceiptId, null);
  assert.equal(result.attestationReceiptBytes, null);
  assert.equal(result.operatorStatus.state, "release-evidence-redaction-blocked");
  assert.deepEqual(result.operatorStatus.blockerCodes,
    ["public-evidence-secret-scan-failed"]);
  const store = createVnextReceiptStore(roots.receipts);
  const rebuilt = store.rebuild();
  assert.equal(rebuilt.activeReceiptIds.length, entry.receiptIds.length + 1);
  const redaction = store.read(result.redactionReceiptId).receipt;
  assert.equal(redaction.status, "fail");
  assert.equal(redaction.blockerCode, "public-evidence-secret-scan-failed");
  assert.doesNotMatch(result.redactionReceiptBytes.toString("utf8"), new RegExp(secret, "u"));
});

test("prepares one complete public-safe release without authorizing publication", {
  timeout: 240_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("complete-capacity");
  seedCase(roots, entry);
  const releaseInput = seedReleaseInputs(roots, entry);
  const surface = await createVnextCampaignReleaseSurface(roots.runner,
    runnerOptions(roots));
  const result = await surface.prepareRelease(prepareInput(
    entry,
    "complete-release-preparation",
    releaseInput
  ));

  assert.equal(result.campaignComplete, true);
  assert.equal(result.releasePrepared, true);
  assert.equal(result.authorizationStatus, "not-authorized");
  assert.equal(result.state, "release-prepared-awaiting-authorization");
  assert.match(result.releaseManifestId, /^sha256:[a-f0-9]{64}$/u);
  assert.match(result.changelogRedactionReceiptId, /^sha256:[a-f0-9]{64}$/u);
  assert.match(result.releaseRedactionReceiptId, /^sha256:[a-f0-9]{64}$/u);
  assert.doesNotMatch(result.releaseManifestBytes.toString("utf8"), /\bdone\b/iu);

  const subjectStore = createVnextSubjectStore(roots.subjects);
  const release = subjectStore.read(result.releaseManifestId).value;
  assert.equal(release.schema, "tinyrustlm.vnext.release_manifest.v3");
  assert.equal(release.releaseId, result.releaseManifestId);
  assert.equal(release.releaseDate, "2026-08-09");
  assert.equal(release.createdAtUtc, entry.verificationTimeUtc);
  assert.equal(release.campaignAttestationReceiptId, result.attestationReceiptId);
  assert.equal(release.artifactManifestIds.length, 21);
  assert.deepEqual(release.artifactManifestIds, releaseInput.artifactManifestIds);
  assert.deepEqual(release.packageReceiptIds, releaseInput.packageReceiptIds);
  assert.deepEqual(release.claimIds, releaseInput.claimIds);
  assert.equal(release.sbomArtifactId, releaseInput.sbomArtifactId);
  assert.equal(release.provenanceReceiptId, releaseInput.provenanceReceiptId);
  assert.equal(release.changelogSha256, sha256(releaseInput.changelogBytes));

  const receiptStore = createVnextReceiptStore(roots.receipts);
  assert.equal(receiptStore.read(result.attestationReceiptId).receipt.status, "pass");
  assert.equal(receiptStore.read(result.changelogRedactionReceiptId).receipt.status, "pass");
  const releaseRedaction = receiptStore.read(result.releaseRedactionReceiptId).receipt;
  assert.equal(releaseRedaction.status, "pass");
  assert.equal(releaseRedaction.inputHashes.some((binding) =>
    binding.name === "target-canonical-content" &&
      binding.sha256 === release.canonicalContentSha256), true);

  const first = result.releaseManifestBytes;
  first.fill(0);
  assert.equal(result.releaseManifestBytes.equals(first), false);

  const subsequent = await surface.attestCampaign(surfaceInput(
    entry,
    "post-release-preparation-attestation"
  ));
  assert.equal(subsequent.campaignComplete, true);
  assert.equal(subsequent.releaseEligible, true);
  assert.equal(subsequent.operatorStatus.state,
    "campaign-complete-awaiting-release-inputs");

  await rejectsCode(() => surface.prepareRelease(prepareInput(
    entry,
    "complete-release-preparation",
    releaseInput
  )), "release_surface_operation_not_fresh");
});

test("authorizes only the exact prepared manifest through current Ed25519 authority", {
  timeout: 360_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("complete-capacity");
  const authority = seedEphemeralAuthorityCase(roots, entry);
  const releaseInput = seedReleaseInputs(roots, entry);
  const preparationSurface = await createVnextCampaignReleaseSurface(roots.runner,
    runnerOptions(roots));
  const prepared = await preparationSurface.prepareRelease(prepareInput(
    entry,
    "authorized-release-preparation",
    releaseInput,
    {
      expectedTerminalRegistryReceiptId: authority.root.receipt.receiptId,
      trustedRootRegistryReceiptId: authority.root.receipt.receiptId
    }
  ));
  const release = createVnextSubjectStore(roots.subjects).read(
    prepared.releaseManifestId
  );
  const authorizationReceipt = makeSignatureReceipt({
    authorityRegistry: authority.root,
    expiresAtUtc: "2026-08-09T01:00:00Z",
    issuedAtUtc: "2026-08-09T00:31:00Z",
    label: "authorize-exact-prepared-release",
    receiptSourceRevision: sourceRevision,
    releaseId: prepared.releaseManifestId,
    scope: "release-authorization",
    signingKey: authority.releaseKey,
    subject: release
  });
  const input = authorizeInput(
    entry,
    authority,
    prepared,
    releaseInput,
    authorizationReceipt
  );
  const authorizingSurface = await createVnextCampaignReleaseSurface(roots.runner,
    runnerOptions(roots));
  const result = await authorizingSurface.authorizeRelease(input);

  assert.equal(result.authorizationStatus, "authorized");
  assert.equal(result.state, "release-authorized-awaiting-deployment");
  assert.equal(result.releaseManifestId, prepared.releaseManifestId);
  assert.equal(result.authorizationReceiptId,
    authorizationReceipt.receipt.receiptId);
  assert.equal(result.authorizationResult.signatureVerified, true);
  assert.equal(result.authorizationResult.currentEvidenceEligible, true);
  assert.equal(result.authorizationResult.signerId,
    authority.releaseKey.record.signerId);
  assert.equal(result.authorizationResult.keyId,
    authority.releaseKey.record.keyId);
  assert.equal(result.authorizationResult.releaseManifestId,
    prepared.releaseManifestId);
  assert.doesNotMatch(result.authorizationResultBytes.toString("utf8"),
    /\bdone\b|published|deployed/iu);
  assert.deepEqual(result.releaseManifestBytes, prepared.releaseManifestBytes);

  const receiptStore = createVnextReceiptStore(roots.receipts);
  assert.deepEqual(receiptStore.read(result.authorizationReceiptId).bytes,
    authorizationReceipt.bytes);
  assert.equal(receiptStore.read(result.authorizationRedactionReceiptId)
    .receipt.status, "pass");
  const storedRelease = createVnextSubjectStore(roots.subjects).read(
    prepared.releaseManifestId
  ).value;
  assert.equal(Object.hasOwn(storedRelease, "authorizationReceiptId"), false);

  const repeated = await authorizingSurface.authorizeRelease(input);
  assert.equal(repeated.authorizationReceiptId, result.authorizationReceiptId);
  assert.equal(repeated.authorizationResultSha256,
    result.authorizationResultSha256);
  assert.equal(repeated.authorizationPersistence.disposition,
    "existing-byte-identical");
  assert.equal(repeated.authorizationRedactionPersistence.disposition,
    "existing-byte-identical");
});

test("admits only an exact deployment-attempt receipt without claiming deployment", {
  timeout: 360_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("complete-capacity");
  const authority = seedEphemeralAuthorityCase(roots, entry);
  const releaseInput = seedReleaseInputs(roots, entry);
  const surface = await createVnextCampaignReleaseSurface(roots.runner,
    runnerOptions(roots));
  const prepared = await surface.prepareRelease(prepareInput(
    entry,
    "deployment-admission-preparation",
    releaseInput,
    {
      expectedTerminalRegistryReceiptId: authority.root.receipt.receiptId,
      trustedRootRegistryReceiptId: authority.root.receipt.receiptId
    }
  ));
  const release = createVnextSubjectStore(roots.subjects).read(
    prepared.releaseManifestId
  );
  const authorizationReceipt = makeSignatureReceipt({
    authorityRegistry: authority.root,
    expiresAtUtc: "2026-08-09T01:00:00Z",
    issuedAtUtc: "2026-08-09T00:31:00Z",
    label: "deployment-admission-authorization",
    receiptSourceRevision: sourceRevision,
    releaseId: prepared.releaseManifestId,
    scope: "release-authorization",
    signingKey: authority.releaseKey,
    subject: release
  });
  await surface.authorizeRelease(authorizeInput(
    entry,
    authority,
    prepared,
    releaseInput,
    authorizationReceipt
  ));
  const deploymentReceipt = deploymentAttemptReceipt(
    entry,
    prepared,
    authorizationReceipt,
    releaseInput,
    "deployment-admission-attempt"
  );
  const input = deploymentInput(
    entry,
    authority,
    prepared,
    releaseInput,
    authorizationReceipt,
    deploymentReceipt
  );
  const result = await surface.admitDeploymentAttempt(input);

  assert.equal(result.state,
    "deployment-attempt-admitted-awaiting-public-readback");
  assert.equal(result.deploymentStatus, "attempt-admitted");
  assert.equal(result.publicReadbackStatus, "required-not-performed");
  assert.equal(result.deploymentReceiptId, deploymentReceipt.receipt.receiptId);
  assert.equal(result.deploymentResult.evidenceScope, "deployment-attempt-only");
  assert.doesNotMatch(result.deploymentResultBytes.toString("utf8"),
    /"(?:deployed|done|published)"\s*:\s*(?:true|"pass")/iu);
  const receiptStore = createVnextReceiptStore(roots.receipts);
  assert.deepEqual(receiptStore.read(result.deploymentReceiptId).bytes,
    deploymentReceipt.bytes);
  assert.equal(receiptStore.read(result.deploymentRedactionReceiptId)
    .receipt.status, "pass");
  const phaseCurrentness = classifyVnextPhaseReceipts({
    campaignId: entry.expectedCampaignId,
    receiptBytes: [
      receiptStore.read(releaseInput.webBuildReceiptId).bytes,
      deploymentReceipt.bytes
    ]
  });
  const deploymentCurrentness = phaseCurrentness.result.records.find((record) =>
    record.receiptId === deploymentReceipt.receipt.receiptId);
  assert.equal(deploymentCurrentness.state, "current-pass");
  assert.equal(deploymentCurrentness.reasonCode, null);

  const repeated = await surface.admitDeploymentAttempt(input);
  assert.equal(repeated.deploymentReceiptId, result.deploymentReceiptId);
  assert.equal(repeated.deploymentResultSha256, result.deploymentResultSha256);
  assert.equal(repeated.deploymentPersistence.disposition,
    "existing-byte-identical");
  assert.equal(repeated.deploymentRedactionPersistence.disposition,
    "existing-byte-identical");
});

test("rejects caller deployment truth and deployment-attempt binding drift", {
  timeout: 360_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("complete-capacity");
  const authority = seedEphemeralAuthorityCase(roots, entry);
  const releaseInput = seedReleaseInputs(roots, entry);
  const protectedValue = "deployment-receipt-protected-value";
  const surface = await createVnextCampaignReleaseSurface(roots.runner,
    runnerOptions(roots));
  const prepared = await surface.prepareRelease(prepareInput(
    entry,
    "hostile-deployment-preparation",
    releaseInput,
    {
      expectedTerminalRegistryReceiptId: authority.root.receipt.receiptId,
      knownSecrets: [protectedValue],
      trustedRootRegistryReceiptId: authority.root.receipt.receiptId
    }
  ));
  const release = createVnextSubjectStore(roots.subjects).read(
    prepared.releaseManifestId
  );
  const authorizationReceipt = makeSignatureReceipt({
    authorityRegistry: authority.root,
    expiresAtUtc: "2026-08-09T01:00:00Z",
    issuedAtUtc: "2026-08-09T00:31:00Z",
    label: "hostile-deployment-authorization",
    receiptSourceRevision: sourceRevision,
    releaseId: prepared.releaseManifestId,
    scope: "release-authorization",
    signingKey: authority.releaseKey,
    subject: release
  });
  await surface.authorizeRelease(authorizeInput(
    entry,
    authority,
    prepared,
    releaseInput,
    authorizationReceipt,
    { knownSecrets: [protectedValue] }
  ));
  const valid = deploymentAttemptReceipt(
    entry,
    prepared,
    authorizationReceipt,
    releaseInput,
    "hostile-deployment-reference"
  );
  const validInput = deploymentInput(
    entry,
    authority,
    prepared,
    releaseInput,
    authorizationReceipt,
    valid,
    { knownSecrets: [protectedValue] }
  );
  await rejectsCode(() => surface.admitDeploymentAttempt({
    ...validInput,
    deploymentSucceeded: true
  }), "release_surface_deployment_input_invalid");

  const wrongScope = deploymentAttemptReceipt(
    entry,
    prepared,
    authorizationReceipt,
    releaseInput,
    "hostile-deployment-scope",
    {
      publicParameters: valid.receipt.publicParameters.map((parameter) =>
        parameter.name === "evidence-scope"
          ? { ...parameter, value: "deployment-success" }
          : { ...parameter })
    }
  );
  await rejectsCode(() => surface.admitDeploymentAttempt({
    ...validInput,
    deploymentReceiptBytes: wrongScope.bytes
  }), "release_surface_deployment_parameters_invalid");

  const wrongRuntime = deploymentAttemptReceipt(
    entry,
    prepared,
    authorizationReceipt,
    releaseInput,
    "hostile-deployment-runtime",
    { runtime: { executionClass: "fixture" } }
  );
  await rejectsCode(() => surface.admitDeploymentAttempt({
    ...validInput,
    deploymentReceiptBytes: wrongRuntime.bytes
  }), "release_surface_deployment_receipt_invalid");

  const wrongInventory = deploymentAttemptReceipt(
    entry,
    prepared,
    authorizationReceipt,
    releaseInput,
    "hostile-deployment-inventory",
    {
      outputHashes: valid.receipt.outputHashes.map((binding) =>
        binding.name === "submitted-web-asset-inventory"
          ? { ...binding, sha256: sha256(Buffer.from("wrong-inventory", "utf8")) }
          : { ...binding })
    }
  );
  await rejectsCode(() => surface.admitDeploymentAttempt({
    ...validInput,
    deploymentReceiptBytes: wrongInventory.bytes
  }), "release_surface_deployment_output_invalid");

  const beforeAuthorizationAdmission = deploymentAttemptReceipt(
    entry,
    prepared,
    authorizationReceipt,
    releaseInput,
    "hostile-deployment-before-authorization-admission",
    {
      startedAtUtc: "2026-08-09T00:31:30Z",
      completedAtUtc: "2026-08-09T00:31:45Z"
    }
  );
  await rejectsCode(() => surface.admitDeploymentAttempt({
    ...validInput,
    deploymentReceiptBytes: beforeAuthorizationAdmission.bytes
  }), "release_surface_deployment_receipt_invalid");

  const unsafe = deploymentAttemptReceipt(
    entry,
    prepared,
    authorizationReceipt,
    releaseInput,
    "hostile-deployment-secret",
    {
      tools: [{
        name: "tinyrustlm.vnext.deployment-executor-test",
        version: protectedValue,
        binarySha256: sha256(Buffer.from("deployment-executor-test", "utf8"))
      }]
    }
  );
  await rejectsCode(() => surface.admitDeploymentAttempt({
    ...validInput,
    deploymentReceiptBytes: unsafe.bytes,
    knownSecrets: [protectedValue]
  }), "release_surface_deployment_unsafe");

  const receiptStore = createVnextReceiptStore(roots.receipts);
  const activeReceiptIds = receiptStore.rebuild().activeReceiptIds;
  assert.equal(activeReceiptIds.includes(valid.receipt.receiptId), false);
  assert.equal(activeReceiptIds.includes(unsafe.receipt.receiptId), false);
  const unsafeRedactions = activeReceiptIds.map((receiptId) =>
    receiptStore.read(receiptId).receipt).filter((receipt) =>
    receipt.receiptType === "redaction-scan" &&
      receipt.attemptId === `release-deployment-redaction-${
        unsafe.receipt.receiptId.slice("sha256:".length)}`);
  assert.equal(unsafeRedactions.length, 1);
  assert.equal(unsafeRedactions[0].status, "fail");
});

test("resumes authorization after the redaction receipt committed alone", {
  timeout: 360_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("complete-capacity");
  const authority = seedEphemeralAuthorityCase(roots, entry);
  const releaseInput = seedReleaseInputs(roots, entry);
  const surface = await createVnextCampaignReleaseSurface(roots.runner,
    runnerOptions(roots));
  const prepared = await surface.prepareRelease(prepareInput(
    entry,
    "redaction-only-authorization-preparation",
    releaseInput,
    {
      expectedTerminalRegistryReceiptId: authority.root.receipt.receiptId,
      trustedRootRegistryReceiptId: authority.root.receipt.receiptId
    }
  ));
  const release = createVnextSubjectStore(roots.subjects).read(
    prepared.releaseManifestId
  );
  const authorizationReceipt = makeSignatureReceipt({
    authorityRegistry: authority.root,
    expiresAtUtc: "2026-08-09T01:00:00Z",
    issuedAtUtc: "2026-08-09T00:31:00Z",
    label: "resume-redaction-only-authorization",
    receiptSourceRevision: sourceRevision,
    releaseId: prepared.releaseManifestId,
    scope: "release-authorization",
    signingKey: authority.releaseKey,
    subject: release
  });
  const authorizationScan = scanVnextPublicDocumentBytes(
    authorizationReceipt.bytes,
    { knownSecrets: [] }
  );
  const redactionReceipt = createVnextRedactionScanReceipt({
    attemptId: `release-authorization-redaction-${
      authorizationReceipt.receipt.receiptId.slice("sha256:".length)}`,
    campaignId: entry.expectedCampaignId,
    completedAtUtc: "2026-08-09T00:32:00Z",
    scan: authorizationScan,
    sourceRevision,
    startedAtUtc: "2026-08-09T00:32:00Z"
  });
  const receiptStore = createVnextReceiptStore(roots.receipts);
  receiptStore.put(redactionReceipt.bytes);
  assert.equal(receiptStore.rebuild().activeReceiptIds.includes(
    authorizationReceipt.receipt.receiptId
  ), false);

  const restarted = await createVnextCampaignReleaseSurface(roots.runner,
    runnerOptions(roots));
  const result = await restarted.authorizeRelease(authorizeInput(
    entry,
    authority,
    prepared,
    releaseInput,
    authorizationReceipt
  ));

  assert.equal(result.authorizationStatus, "authorized");
  assert.equal(result.authorizationRedactionReceiptId,
    redactionReceipt.receipt.receiptId);
  assert.equal(result.authorizationRedactionPersistence.disposition,
    "existing-byte-identical");
  assert.equal(result.authorizationPersistence.disposition, "created");
  receiptStore.rebuild();
  assert.deepEqual(receiptStore.read(result.authorizationReceiptId).bytes,
    authorizationReceipt.bytes);
});

test("rejects caller authorization truth, wrong bindings, expiry, and snapshot drift", {
  timeout: 360_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("complete-capacity");
  const authority = seedEphemeralAuthorityCase(roots, entry);
  const releaseInput = seedReleaseInputs(roots, entry);
  const surface = await createVnextCampaignReleaseSurface(roots.runner,
    runnerOptions(roots));
  const prepared = await surface.prepareRelease(prepareInput(
    entry,
    "hostile-authorization-preparation",
    releaseInput,
    {
      expectedTerminalRegistryReceiptId: authority.root.receipt.receiptId,
      trustedRootRegistryReceiptId: authority.root.receipt.receiptId
    }
  ));
  const release = createVnextSubjectStore(roots.subjects).read(
    prepared.releaseManifestId
  );
  function signed(label, overrides = {}) {
    return makeSignatureReceipt({
      authorityRegistry: authority.root,
      expiresAtUtc: "2026-08-09T01:00:00Z",
      issuedAtUtc: "2026-08-09T00:31:00Z",
      label,
      receiptSourceRevision: sourceRevision,
      releaseId: prepared.releaseManifestId,
      scope: "release-authorization",
      signingKey: authority.releaseKey,
      subject: release,
      ...overrides
    });
  }
  const validReceipt = signed("hostile-valid-reference");
  const validInput = authorizeInput(
    entry,
    authority,
    prepared,
    releaseInput,
    validReceipt
  );
  await rejectsCode(() => surface.authorizeRelease({
    ...validInput,
    decision: "authorize"
  }), "release_surface_authorize_input_invalid");

  const wrongScope = signed("hostile-wrong-scope", { scope: "key-revocation" });
  await rejectsCode(() => surface.authorizeRelease(authorizeInput(
    entry,
    authority,
    prepared,
    releaseInput,
    wrongScope
  )), "release_surface_authorization_receipt_invalid");

  const wrongRelease = signed("hostile-wrong-release", {
    releaseId: operationId("different-release-manifest")
  });
  await rejectsCode(() => surface.authorizeRelease(authorizeInput(
    entry,
    authority,
    prepared,
    releaseInput,
    wrongRelease
  )), "release_surface_authorization_receipt_invalid");

  const expired = signed("hostile-expired-authorization", {
    expiresAtUtc: "2026-08-09T00:31:30Z"
  });
  await rejectsCode(() => surface.authorizeRelease(authorizeInput(
    entry,
    authority,
    prepared,
    releaseInput,
    expired
  )), "release_surface_authorization_time_invalid");

  const unrelatedArtifactId = operationId("post-preparation-subject-drift");
  createVnextSubjectStore(roots.subjects).put(releaseArtifact({
    artifactId: unrelatedArtifactId,
    artifactClass: "specialist-model",
    byteLength: 4096,
    formatProfile: "slm2.0",
    provenanceReceiptId: releaseInput.provenanceReceiptId,
    qualificationReceiptId: null
  }).bytes);
  await rejectsCode(() => surface.authorizeRelease(validInput),
    "release_surface_subject_snapshot_member_unexpected");
  assert.equal(createVnextReceiptStore(roots.receipts).rebuild().activeReceiptIds
    .includes(validReceipt.receipt.receiptId), false);
});

test("rejects an authorization key that was not active at signature issue", {
  timeout: 360_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("complete-capacity");
  const authority = seedEphemeralAuthorityCase(roots, entry, {
    releaseKeyStatus: "retired"
  });
  const releaseInput = seedReleaseInputs(roots, entry);
  const surface = await createVnextCampaignReleaseSurface(roots.runner,
    runnerOptions(roots));
  const prepared = await surface.prepareRelease(prepareInput(
    entry,
    "retired-authorizer-preparation",
    releaseInput,
    {
      expectedTerminalRegistryReceiptId: authority.root.receipt.receiptId,
      trustedRootRegistryReceiptId: authority.root.receipt.receiptId
    }
  ));
  const release = createVnextSubjectStore(roots.subjects).read(
    prepared.releaseManifestId
  );
  const authorizationReceipt = makeSignatureReceipt({
    authorityRegistry: authority.root,
    expiresAtUtc: "2026-08-09T01:00:00Z",
    issuedAtUtc: "2026-08-09T00:31:00Z",
    label: "retired-release-authorizer",
    receiptSourceRevision: sourceRevision,
    releaseId: prepared.releaseManifestId,
    scope: "release-authorization",
    signingKey: authority.releaseKey,
    subject: release
  });
  await rejectsCode(() => surface.authorizeRelease(authorizeInput(
    entry,
    authority,
    prepared,
    releaseInput,
    authorizationReceipt
  )), "signature_key_not_authorized_at_issue");
  assert.equal(createVnextReceiptStore(roots.receipts).rebuild().activeReceiptIds
    .includes(authorizationReceipt.receipt.receiptId), false);
});

test("persists only bounded redaction evidence for unsafe authorization bytes", {
  timeout: 360_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("complete-capacity");
  const authority = seedEphemeralAuthorityCase(roots, entry);
  const releaseInput = seedReleaseInputs(roots, entry);
  const protectedValue = authority.releaseKey.record.signerId;
  const surface = await createVnextCampaignReleaseSurface(roots.runner,
    runnerOptions(roots));
  const prepared = await surface.prepareRelease(prepareInput(
    entry,
    "unsafe-authorization-preparation",
    releaseInput,
    {
      expectedTerminalRegistryReceiptId: authority.root.receipt.receiptId,
      knownSecrets: [protectedValue],
      trustedRootRegistryReceiptId: authority.root.receipt.receiptId
    }
  ));
  const release = createVnextSubjectStore(roots.subjects).read(
    prepared.releaseManifestId
  );
  const authorizationReceipt = makeSignatureReceipt({
    authorityRegistry: authority.root,
    expiresAtUtc: "2026-08-09T01:00:00Z",
    issuedAtUtc: "2026-08-09T00:31:00Z",
    label: "unsafe-release-authorization",
    receiptSourceRevision: sourceRevision,
    releaseId: prepared.releaseManifestId,
    scope: "release-authorization",
    signingKey: authority.releaseKey,
    subject: release
  });
  const receiptStore = createVnextReceiptStore(roots.receipts);
  const before = receiptStore.rebuild().activeReceiptIds;
  await rejectsCode(() => surface.authorizeRelease(authorizeInput(
    entry,
    authority,
    prepared,
    releaseInput,
    authorizationReceipt,
    { knownSecrets: [protectedValue] }
  )), "release_surface_authorization_unsafe");
  const after = receiptStore.rebuild().activeReceiptIds;
  assert.equal(after.length, before.length + 1);
  assert.equal(after.includes(authorizationReceipt.receipt.receiptId), false);
  const addedId = after.find((receiptId) => !before.includes(receiptId));
  const redaction = receiptStore.read(addedId);
  assert.equal(redaction.receipt.receiptType, "redaction-scan");
  assert.equal(redaction.receipt.status, "fail");
  assert.equal(redaction.receipt.blockerCode,
    "public-evidence-secret-scan-failed");
  assert.doesNotMatch(redaction.bytes.toString("utf8"),
    new RegExp(protectedValue, "u"));
});

test("refuses release preparation when the fresh campaign projection is incomplete", {
  timeout: 240_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("complete-capacity");
  seedCase(roots, entry);
  const releaseInput = seedReleaseInputs(roots, entry);
  const surface = await createVnextCampaignReleaseSurface(roots.runner,
    runnerOptions(roots));
  await rejectsCode(() => surface.prepareRelease(prepareInput(
    entry,
    "expired-campaign-release-preparation",
    releaseInput,
    { verificationTimeUtc: "2027-08-09T00:30:00Z" }
  )), "release_surface_campaign_incomplete");

  const subjectStore = createVnextSubjectStore(roots.subjects);
  assert.equal(subjectStore.rebuild().activeSubjectIds.some((subjectId) =>
    subjectStore.read(subjectId).schema === "tinyrustlm.vnext.release_manifest.v3"), false);
});

test("rejects incomplete artifact coverage and omitted current approved claims", {
  timeout: 360_000
}, async (t) => {
  const artifactRoots = makeRoots(t);
  const entry = acceptedCase("complete-capacity");
  seedCase(artifactRoots, entry);
  const artifactRelease = seedReleaseInputs(artifactRoots, entry);
  const artifactSurface = await createVnextCampaignReleaseSurface(artifactRoots.runner,
    runnerOptions(artifactRoots));
  await rejectsCode(() => artifactSurface.prepareRelease(prepareInput(
    entry,
    "missing-qualified-artifact",
    artifactRelease,
    { artifactManifestIds: artifactRelease.artifactManifestIds.slice(1) }
  )), "release_surface_artifact_coverage_invalid");

  const unrelatedArtifactId = operationId("unrelated-release-artifact");
  createVnextSubjectStore(artifactRoots.subjects).put(releaseArtifact({
    artifactId: unrelatedArtifactId,
    artifactClass: "specialist-model",
    byteLength: 4096,
    formatProfile: "slm2.0",
    provenanceReceiptId: artifactRelease.provenanceReceiptId,
    qualificationReceiptId: null
  }).bytes);
  await rejectsCode(() => artifactSurface.prepareRelease(prepareInput(
    entry,
    "unrelated-release-artifact",
    artifactRelease,
    {
      artifactManifestIds: [
        ...artifactRelease.artifactManifestIds,
        unrelatedArtifactId
      ].sort()
    }
  )), "release_surface_artifact_coverage_invalid");

  const claimRoots = makeRoots(t);
  seedCase(claimRoots, entry);
  const claimRelease = seedReleaseInputs(claimRoots, entry, { claimCount: 2 });
  const claimSurface = await createVnextCampaignReleaseSurface(claimRoots.runner,
    runnerOptions(claimRoots));
  await rejectsCode(() => claimSurface.prepareRelease(prepareInput(
    entry,
    "omitted-current-approved-claim",
    claimRelease,
    { claimIds: claimRelease.claimIds.slice(0, 1) }
  )), "release_surface_claim_selection_invalid");
});

test("rejects expired claims and superseded package evidence", {
  timeout: 360_000
}, async (t) => {
  const claimRoots = makeRoots(t);
  const entry = acceptedCase("complete-capacity");
  seedCase(claimRoots, entry);
  const claimRelease = seedReleaseInputs(claimRoots, entry, {
    claimExpiresAtUtc: "2026-08-08T12:00:00Z"
  });
  const claimSurface = await createVnextCampaignReleaseSurface(claimRoots.runner,
    runnerOptions(claimRoots));
  await rejectsCode(() => claimSurface.prepareRelease(prepareInput(
    entry,
    "expired-approved-claim",
    claimRelease
  )), "release_surface_claim_not_current");

  const packageRoots = makeRoots(t);
  seedCase(packageRoots, entry);
  const packageRelease = seedReleaseInputs(packageRoots, entry, {
    supersedePackage: true
  });
  const packageSurface = await createVnextCampaignReleaseSurface(packageRoots.runner,
    runnerOptions(packageRoots));
  await rejectsCode(() => packageSurface.prepareRelease(prepareInput(
    entry,
    "superseded-package-evidence",
    packageRelease
  )), "release_surface_phase_evidence_not_current");
});

test("persists only public-safe failure evidence for an unsafe changelog", {
  timeout: 240_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("complete-capacity");
  seedCase(roots, entry);
  const secret = "release-secret-material-93c17f2a";
  const releaseInput = seedReleaseInputs(roots, entry, {
    changelogBytes: Buffer.from(`# TinyRustLM 1.0.0\n\n- ${secret}\n`, "utf8")
  });
  const surface = await createVnextCampaignReleaseSurface(roots.runner,
    runnerOptions(roots));
  await rejectsCode(() => surface.prepareRelease(prepareInput(
    entry,
    "unsafe-release-changelog",
    releaseInput,
    { knownSecrets: [secret] }
  )), "release_surface_public_input_unsafe");

  const subjectStore = createVnextSubjectStore(roots.subjects);
  assert.equal(subjectStore.rebuild().activeSubjectIds.some((subjectId) =>
    subjectStore.read(subjectId).schema === "tinyrustlm.vnext.release_manifest.v3"), false);
  const receiptStore = createVnextReceiptStore(roots.receipts);
  const redactionReceipts = receiptStore.rebuild().activeReceiptIds
    .map((receiptId) => receiptStore.read(receiptId).receipt)
    .filter((receipt) => receipt.receiptType === "redaction-scan");
  assert.equal(redactionReceipts.some((receipt) => receipt.status === "fail" &&
    receipt.blockerCode === "public-evidence-secret-scan-failed"), true);
  for (const receipt of redactionReceipts) {
    assert.doesNotMatch(JSON.stringify(receipt), new RegExp(secret, "u"));
  }
});
