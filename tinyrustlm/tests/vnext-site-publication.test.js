"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  finalizeVnextIdentityDocument
} = require("../tools/vnext-content-identity.js");
const { canonicalizeVnextJcsBytes } = require("../tools/vnext-jcs.js");
const {
  domainSeparatedDigest,
  finalizeVnextReceipt
} = require("../tools/vnext-receipt-identity.js");
const {
  createVnextSitePublicationPlanMaterial,
  materializeVnextSitePublication,
  sitePublicationProfile,
  sitePublicationProfileSha256,
  validateVnextSitePublicationHistoryBytes
} = require("../tools/vnext-site-publication.js");
const {
  authorityKey,
  campaignId,
  hash,
  makeAuthorityRegistry,
  makeSignatureReceipt
} = require("./helpers/vnext-authority-fixtures.js");

const sourceRevision = `git-sha1:${"a".repeat(40)}`;
const redaction = Object.freeze({
  profile: "tinyrustlm.vnext.public_safe.v1",
  decision: "public-safe"
});
const publicOrigin = "https://tinyrustlm.example.com/";

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function contentId(label) {
  return `sha256:${hash(label)}`;
}

function runtime(executionClass = "local") {
  return {
    runtimeIdentifier: "node-vnext-site-publication-test",
    operatingSystem: "windows",
    architecture: "x86_64",
    executionClass
  };
}

function tool() {
  return [{
    name: "tinyrustlm.vnext.site-publication-test",
    version: "1.0.0",
    binarySha256: hash("site-publication-test-tool")
  }];
}

function receiptDraft(input) {
  return {
    schema: "tinyrustlm.vnext.receipt.v1",
    receiptType: input.receiptType,
    campaignId,
    attemptId: input.attemptId,
    phase: input.phase ?? input.receiptType,
    status: "pass",
    startedAtUtc: input.startedAtUtc,
    completedAtUtc: input.completedAtUtc ?? input.startedAtUtc,
    sourceRevision,
    inputReceiptIds: [...(input.inputReceiptIds ?? [])].sort(),
    inputHashes: [...(input.inputHashes ?? [])].sort((left, right) =>
      left.name.localeCompare(right.name)),
    outputHashes: [...(input.outputHashes ?? [])].sort((left, right) =>
      left.name.localeCompare(right.name)),
    tools: tool(),
    configurationSha256: input.configurationSha256 ?? hash(input.attemptId),
    runtime: runtime(input.executionClass),
    publicParameters: [...(input.publicParameters ?? [])].sort((left, right) =>
      left.name.localeCompare(right.name)),
    error: null,
    blockerCode: null,
    externalEvidenceReferences: input.externalEvidenceReferences ?? [],
    redaction,
    attestationReference: input.attestationReference ?? null,
    signatureEnvelope: null,
    authorityRegistry: null,
    keyRevocation: null,
    offlineBundle: null,
    supersedesReceiptIds: []
  };
}

function makeApprovedClaim(index, options = {}) {
  return finalizeVnextIdentityDocument({
    schema: "tinyrustlm.vnext.claim.v2",
    subjectId: contentId(`model-${index}`),
    siteId: "tinyrustlm.com",
    route: `/models/${index}`,
    component: `model-${index}`,
    wordingClass: "quality",
    claimType: "conversation-proven",
    evidenceTier: "local-executed",
    status: "approved-for-publication",
    scope: `The bound qualification scope for model ${index}.`,
    publicWording: `Model ${index} completed the bound qualification evidence.`,
    evidenceReceiptIds: [contentId(`qualification-${index}`)],
    sourceRevision,
    releaseId: null,
    effectiveAtUtc: "2026-08-08T00:00:00Z",
    expiresAtUtc: options.expiresAtUtc ?? "2026-09-01T00:00:00Z",
    reviewAtUtc: options.reviewAtUtc ?? "2026-09-01T00:00:00Z",
    ownerId: "release-owner",
    blockerCodes: [],
    lastVerifiedAtUtc: "2026-08-09T00:00:00Z",
    supersedesClaimIds: [],
    redaction
  });
}

function releaseFixture(options = {}) {
  const generatorBytes = Buffer.from(
    "export const sitePublicationProfile = 'tinyrustlm.vnext.site-publication.v1';\n",
    "utf8"
  );
  const securityHeaderProfileSha256 = hash("web-security-header-profile");
  const rootBytes = Buffer.from("<!doctype html><title>TinyRustLM</title>", "utf8");
  const claims = [
    makeApprovedClaim(1, options.claimOptions),
    makeApprovedClaim(2, options.claimOptions)
  ].sort((left, right) => left.subjectId.localeCompare(right.subjectId));
  const webAssets = [{
    path: "/",
    role: "bootstrap",
    byteLength: rootBytes.length,
    sha256: sha256(rootBytes),
    contentType: "text/html",
    cachePolicy: "no-store",
    securityHeaderProfileSha256
  }];
  const generatedPublicationFiles = [
    {
      path: "/.well-known/site-release-history.json",
      role: "release-history",
      contentType: "application/json",
      cachePolicy: "no-store",
      securityHeaderProfileSha256
    },
    {
      path: "/.well-known/site-release.json",
      role: "current-release-pointer",
      contentType: "application/json",
      cachePolicy: "no-store",
      securityHeaderProfileSha256
    }
  ];
  const release = finalizeVnextIdentityDocument({
    schema: "tinyrustlm.vnext.release_manifest.v3",
    productId: "tinyrustlm",
    version: options.version ?? "1.0.0",
    releaseDate: options.releaseDate ?? "2026-08-09",
    sourceRevision,
    campaignPlanSha256: hash("campaign-plan"),
    campaignProjectionSha256: hash("campaign-projection"),
    campaignAttestationReceiptId: contentId("campaign-attestation"),
    artifactManifestIds: [contentId("model-1"), contentId("model-2")].sort(),
    packageReceiptIds: [contentId("package")],
    claimIds: claims.map((claim) => claim.subjectId),
    sbomArtifactId: contentId("sbom"),
    provenanceReceiptId: contentId("provenance"),
    changelogSha256: hash(`changelog-${options.version ?? "1.0.0"}`),
    publicOrigin,
    webBuildReceiptId: contentId("web-build"),
    webDeploymentManifestSha256: hash("web-deployment-manifest"),
    webSecurityHeaderProfileSha256: securityHeaderProfileSha256,
    webPublicationGeneratorSha256: sha256(generatorBytes),
    webAssets,
    generatedPublicationFiles,
    retiredPublicPaths: [],
    webTotalBytes: rootBytes.length,
    offlineCapability: "network-only",
    serviceWorkerPath: null,
    remainingRiskCodes: [],
    createdAtUtc: `${options.releaseDate ?? "2026-08-09"}T00:00:00Z`,
    redaction
  });
  const webAssetInventorySha256 = domainSeparatedDigest(
    sitePublicationProfile.materialization.webAssetInventoryIdentityDomain,
    webAssets
  );
  const readback = finalizeVnextReceipt(receiptDraft({
    receiptType: "public-readback",
    attemptId: `static-readback-${options.version ?? "1-0-0"}`.replaceAll(".", "-"),
    startedAtUtc: options.readbackAtUtc ?? "2026-08-09T01:00:00Z",
    executionClass: "deployment",
    inputReceiptIds: [contentId(`deployment-${options.version ?? "1.0.0"}`)],
    inputHashes: [
      {
        name: "release-manifest-canonical-content",
        sha256: release.canonicalContentSha256
      },
      { name: "web-asset-inventory", sha256: webAssetInventorySha256 },
      { name: "web-publication-generator", sha256: sha256(generatorBytes) },
      { name: "web-security-header-profile", sha256: securityHeaderProfileSha256 }
    ],
    outputHashes: [
      {
        name: "public-https-readback-observation-inventory",
        sha256: hash(`observations-${options.version ?? "1.0.0"}`)
      },
      { name: "verified-web-asset-inventory", sha256: webAssetInventorySha256 }
    ],
    publicParameters: [
      { name: "asset-count", value: String(webAssets.length), unit: "assets" },
      {
        name: "evidence-scope",
        value: sitePublicationProfile.plan.staticReadbackEvidenceScope,
        unit: null
      },
      { name: "public-origin", value: publicOrigin, unit: null },
      { name: "subject_id", value: release.subjectId, unit: null },
      { name: "total-bytes", value: String(rootBytes.length), unit: "bytes" }
    ],
    attestationReference: release.value.campaignAttestationReceiptId,
    externalEvidenceReferences: [{ kind: "https", value: publicOrigin }]
  }));
  return { claims, generatorBytes, readback, release };
}

function planInput(fixture, previousHistoryBytes = null, overrides = {}) {
  return {
    approvedClaimBytes: fixture.claims.map((claim) => claim.bytes),
    previousHistoryBytes,
    publicReadbackReceiptBytes: fixture.readback.bytes,
    releaseManifestBytes: fixture.release.bytes,
    webPublicationGeneratorBytes: fixture.generatorBytes,
    ...overrides
  };
}

function makePlanReceipt(fixture, plan, options = {}) {
  const material = plan.planMaterial;
  const inputHashes = [
    { name: "approved-claim-set", sha256: material.approvedClaimSetSha256 },
    {
      name: "release-manifest-canonical-content",
      sha256: material.releaseManifestSha256
    },
    { name: "site-publication-profile", sha256: sitePublicationProfileSha256 },
    {
      name: "web-publication-generator",
      sha256: material.webPublicationGeneratorSha256
    },
    {
      name: "web-security-header-profile",
      sha256: material.webSecurityHeaderProfileSha256
    }
  ];
  if (material.previousHistorySha256 !== null) {
    inputHashes.push({
      name: sitePublicationProfile.plan.optionalInputHashName,
      sha256: material.previousHistorySha256
    });
  }
  const attemptId = options.attemptId ??
    `site-publication-plan-${fixture.release.subjectId.slice(7, 23)}`;
  const draft = receiptDraft({
    receiptType: "site-synchronization",
    phase: "site-synchronization",
    attemptId,
    startedAtUtc: options.planAtUtc ?? "2026-08-09T01:01:00Z",
    inputReceiptIds: [fixture.readback.receipt.receiptId],
    inputHashes,
    outputHashes: [{
      name: sitePublicationProfile.plan.outputHashName,
      sha256: plan.planMaterialSha256
    }],
    configurationSha256: domainSeparatedDigest(
      sitePublicationProfile.plan.configurationIdentityDomain,
      {
        profileSha256: sitePublicationProfileSha256,
        webPublicationGeneratorSha256: material.webPublicationGeneratorSha256
      }
    ),
    publicParameters: [
      {
        name: "evidence-scope",
        value: sitePublicationProfile.plan.evidenceScope,
        unit: null
      },
      { name: "operation_id", value: attemptId, unit: null },
      { name: "public-origin", value: material.publicOrigin, unit: null },
      { name: "site-id", value: material.siteId, unit: null },
      { name: "subject_id", value: material.releaseId, unit: null }
    ],
    attestationReference: fixture.release.value.campaignAttestationReceiptId
  });
  if (options.mutate) options.mutate(draft);
  return finalizeVnextReceipt(draft);
}

function makePublicationFixture(options = {}) {
  const fixture = releaseFixture(options);
  const previousHistoryBytes = options.previousHistoryBytes ?? null;
  const plan = createVnextSitePublicationPlanMaterial(
    planInput(fixture, previousHistoryBytes)
  );
  const planReceipt = makePlanReceipt(fixture, plan, options);
  const publisherKey = authorityKey({
    keyId: "site-publisher-key",
    signerId: "site-publisher",
    role: "site-publisher"
  });
  const authority = makeAuthorityRegistry({
    label: `site-publication-${options.version ?? "1-0-0"}`.replaceAll(".", "-"),
    keys: [publisherKey]
  });
  const signature = makeSignatureReceipt({
    label: `site-publication-${options.version ?? "1-0-0"}`.replaceAll(".", "-"),
    authorityRegistry: authority,
    subject: planReceipt,
    signingKey: publisherKey,
    role: "site-publisher",
    scope: "site-publication",
    releaseId: fixture.release.subjectId,
    issuedAtUtc: options.authorizedAtUtc ?? "2026-08-09T01:02:00Z",
    expiresAtUtc: options.signatureExpiresAtUtc ?? "2026-08-10T01:02:00Z"
  });
  return {
    authority,
    fixture,
    input: {
      ...planInput(fixture, previousHistoryBytes),
      sitePublicationPlanReceiptBytes: planReceipt.bytes,
      sitePublisherSignatureReceiptBytes: signature.bytes
    },
    plan,
    planReceipt,
    publisherKey,
    signature
  };
}

function throwsCode(action, code) {
  assert.throws(action, (error) => error?.code === code);
}

test("site-publication profile freezes one clean-slate descendant contract", () => {
  assert.equal(sitePublicationProfile.status, "frozen");
  assert.equal(sitePublicationProfile.versionPolicy,
    "single-current-profile-no-compatibility-reader");
  assert.equal(sitePublicationProfile.networkAccess,
    "forbidden-pure-materialization-only");
  assert.equal(sitePublicationProfile.materialization.persistencePolicy,
    "forbidden-until-generated-file-production-readback");
  assert.match(sitePublicationProfileSha256, /^[a-f0-9]{64}$/u);
  const source = fs.readFileSync(path.resolve(__dirname,
    "../tools/vnext-site-publication.js"), "utf8");
  assert.doesNotMatch(source,
    /require\([^\n]*(?:site-release-contract|site-release-ledger)|uaix\.site_release_ledger/iu);
  for (const relativePath of [
    "../../contracts/vnext/README.md",
    "../../docs/architecture/vnext-site-publication.md"
  ]) {
    const documentation = fs.readFileSync(path.resolve(__dirname, relativePath),
      "utf8");
    assert.match(documentation, new RegExp(sitePublicationProfileSha256, "u"));
  }
  assert.equal(sitePublicationProfile.planMaterialFields.includes("schema"), true);
});

test("plan material is canonical, deterministic, defensive, and not publication", () => {
  const fixture = releaseFixture();
  const first = createVnextSitePublicationPlanMaterial(planInput(fixture));
  const second = createVnextSitePublicationPlanMaterial(planInput(fixture));
  assert.deepEqual(first, second);
  assert.ok(first.planMaterialBytes.equals(second.planMaterialBytes));
  assert.ok(canonicalizeVnextJcsBytes(first.planMaterial)
    .equals(first.planMaterialBytes));
  assert.equal(first.publicationStatus, "not-published");
  assert.equal(first.planMaterial.previousHistorySha256, null);
  const mutated = first.planMaterialBytes;
  mutated.fill(0);
  assert.ok(first.planMaterialBytes.equals(second.planMaterialBytes));
});

test("materialization creates exact pointer, history, and direct claim descendants", () => {
  const prepared = makePublicationFixture();
  const first = materializeVnextSitePublication(prepared.input);
  const second = materializeVnextSitePublication(prepared.input);
  assert.deepEqual(first, second);
  assert.equal(first.publicationStatus,
    "not-published-awaiting-generated-file-readback");
  assert.equal(first.generatedAssets.length, 2);
  assert.equal(first.history.entries.length, 1);
  assert.equal(first.pointer.releaseId, prepared.fixture.release.subjectId);
  assert.equal(first.pointer.sitePublisherSignatureReceiptId,
    prepared.signature.receipt.receiptId);
  assert.equal(first.publishedClaims.length, 2);
  for (const [index, published] of first.publishedClaims.entries()) {
    const approved = prepared.fixture.claims[index];
    assert.equal(published.claim.status, "published");
    assert.equal(published.claim.releaseId, prepared.fixture.release.subjectId);
    assert.deepEqual(published.claim.supersedesClaimIds, [approved.subjectId]);
    assert.ok(published.claim.evidenceReceiptIds.includes(
      prepared.fixture.readback.receipt.receiptId));
    assert.ok(published.claim.evidenceReceiptIds.includes(
      prepared.signature.receipt.receiptId));
  }
  const pointerCopy = first.pointerBytes;
  const historyCopy = first.historyBytes;
  const claimCopy = first.publishedClaims[0].claimBytes;
  pointerCopy.fill(0);
  historyCopy.fill(0);
  claimCopy.fill(0);
  assert.ok(first.pointerBytes.equals(second.pointerBytes));
  assert.ok(first.historyBytes.equals(second.historyBytes));
  assert.ok(first.publishedClaims[0].claimBytes.equals(
    second.publishedClaims[0].claimBytes));
});

test("current vNext history appends strictly increasing releases", () => {
  const firstPrepared = makePublicationFixture();
  const first = materializeVnextSitePublication(firstPrepared.input);
  const secondPrepared = makePublicationFixture({
    version: "1.1.0",
    releaseDate: "2026-08-10",
    readbackAtUtc: "2026-08-10T01:00:00Z",
    planAtUtc: "2026-08-10T01:01:00Z",
    authorizedAtUtc: "2026-08-10T01:02:00Z",
    signatureExpiresAtUtc: "2026-08-11T01:02:00Z",
    previousHistoryBytes: first.historyBytes
  });
  const second = materializeVnextSitePublication(secondPrepared.input);
  assert.equal(second.history.entries.length, 2);
  assert.deepEqual(second.history.entries[0], first.history.entries[0]);
  assert.equal(second.history.entries[1].version, "1.1.0");
  assert.equal(second.planMaterial.previousHistorySha256,
    sha256(first.historyBytes));
  assert.ok(validateVnextSitePublicationHistoryBytes(second.historyBytes).bytes
    .equals(second.historyBytes));
});

test("old ledger and noncanonical history are rejected without a compatibility reader", () => {
  const oldLedger = canonicalizeVnextJcsBytes({
    schema: "uaix.site_release_ledger.v1",
    releases: []
  });
  throwsCode(() => validateVnextSitePublicationHistoryBytes(oldLedger),
    "site_publication_history_invalid");
  const prepared = makePublicationFixture();
  const result = materializeVnextSitePublication(prepared.input);
  const pretty = Buffer.from(JSON.stringify(result.history, null, 2), "utf8");
  throwsCode(() => validateVnextSitePublicationHistoryBytes(pretty),
    "site_publication_history_invalid");
});

test("selection, readback, plan, signature, and time drift fail closed", () => {
  const fixture = releaseFixture();
  throwsCode(() => createVnextSitePublicationPlanMaterial(planInput(fixture, null, {
    approvedClaimBytes: [...fixture.claims].reverse().map((claim) => claim.bytes)
  })), "site_publication_claim_selection_invalid");

  const wrongReadbackDraft = receiptDraft({
    receiptType: "public-readback",
    attemptId: "wrong-static-readback",
    startedAtUtc: "2026-08-09T01:00:00Z",
    executionClass: "deployment",
    inputReceiptIds: [contentId("deployment")],
    inputHashes: [],
    outputHashes: [],
    publicParameters: [
      { name: "asset-count", value: "1", unit: "assets" },
      {
        name: "evidence-scope",
        value: sitePublicationProfile.plan.staticReadbackEvidenceScope,
        unit: null
      },
      { name: "public-origin", value: publicOrigin, unit: null },
      { name: "subject_id", value: fixture.release.subjectId, unit: null },
      { name: "total-bytes", value: String(fixture.release.value.webTotalBytes),
        unit: "bytes" }
    ]
  });
  const wrongReadback = finalizeVnextReceipt(wrongReadbackDraft);
  throwsCode(() => createVnextSitePublicationPlanMaterial(planInput(fixture, null, {
    publicReadbackReceiptBytes: wrongReadback.bytes
  })), "site_publication_static_readback_binding_invalid");

  const prepared = makePublicationFixture();
  const wrongPlan = makePlanReceipt(prepared.fixture, prepared.plan, {
    mutate(draft) {
      draft.outputHashes[0].sha256 = hash("wrong-plan-material");
    }
  });
  throwsCode(() => materializeVnextSitePublication({
    ...prepared.input,
    sitePublicationPlanReceiptBytes: wrongPlan.bytes
  }), "site_publication_plan_receipt_binding_invalid");

  const wrongSignature = makeSignatureReceipt({
    label: "wrong-site-publication-release",
    authorityRegistry: prepared.authority,
    subject: prepared.planReceipt,
    signingKey: prepared.publisherKey,
    role: "site-publisher",
    scope: "site-publication",
    releaseId: contentId("wrong-release"),
    issuedAtUtc: "2026-08-09T01:02:00Z",
    expiresAtUtc: "2026-08-10T01:02:00Z"
  });
  throwsCode(() => materializeVnextSitePublication({
    ...prepared.input,
    sitePublisherSignatureReceiptBytes: wrongSignature.bytes
  }), "site_publication_signature_invalid");

  const expired = makePublicationFixture({
    claimOptions: {
      expiresAtUtc: "2026-08-09T01:02:00Z",
      reviewAtUtc: "2026-09-01T00:00:00Z"
    }
  });
  throwsCode(() => materializeVnextSitePublication(expired.input),
    "site_publication_claim_not_current");
});

test("hidden fields, accessors, and oversized history fail before materialization", () => {
  const fixture = releaseFixture();
  const hidden = planInput(fixture);
  Object.defineProperty(hidden, "hidden", { value: true, enumerable: false });
  throwsCode(() => createVnextSitePublicationPlanMaterial(hidden),
    "site_publication_input_invalid");

  const accessor = planInput(fixture);
  Object.defineProperty(accessor, "webPublicationGeneratorBytes", {
    enumerable: true,
    get() {
      throw new Error("must not execute");
    }
  });
  throwsCode(() => createVnextSitePublicationPlanMaterial(accessor),
    "site_publication_input_invalid");

  const oversized = Buffer.alloc(sitePublicationProfile.limits.maximumHistoryBytes + 1,
    0x20);
  throwsCode(() => validateVnextSitePublicationHistoryBytes(oversized),
    "site_publication_history_bytes_invalid");
});
