"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  finalizeVnextOfflineBundleManifest,
  offlineBundleProfile,
  offlineBundleProfileSha256,
  verifyVnextOfflineBundle
} = require("../tools/vnext-offline-bundle.js");
const {
  canonicalizeVnextJcsBytes
} = require("../tools/vnext-jcs.js");
const {
  finalizeVnextReceipt
} = require("../tools/vnext-receipt-identity.js");
const {
  authorityKey,
  baseReceiptDraft,
  campaignId,
  hash,
  makeAuthorityRegistry,
  makeOutsideProof,
  makeRevocationReceipt,
  makeRootProofGraph,
  makeSignatureReceipt
} = require("./helpers/vnext-authority-fixtures.js");

const createdAtUtc = "2026-08-09T00:05:00Z";
const repositoryRoot = path.resolve(__dirname, "../..");

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function throwsCode(callback, code) {
  assert.throws(callback, (error) => error?.code === code, `expected ${code}`);
}

function finalizeManifestFor(fixture, overrides = {}) {
  return finalizeVnextOfflineBundleManifest({
    campaignId: fixture.campaignId,
    createdAtUtc,
    environment: fixture.environment,
    expectedTerminalRegistryReceiptId: fixture.expectedTerminalRegistryReceiptId,
    receiptBytes: fixture.receiptBytes,
    subjectBytes: fixture.subjectBytes,
    targetSignatureReceiptIds: [fixture.signature.receipt.receiptId],
    trustedRootRegistryReceiptId: fixture.trustedRootRegistryReceiptId,
    ...overrides
  });
}

function makeVerificationReceipt(bundle, overrides = {}) {
  const draft = baseReceiptDraft({
    receiptType: "offline-verification-bundle",
    attemptId: overrides.attemptId ?? "offline-bundle-alpha",
    startedAtUtc: bundle.manifest.createdAtUtc,
    completedAtUtc: bundle.manifest.createdAtUtc,
    inputReceiptIds: bundle.allReceiptIds,
    inputHashes: [{
      name: "offline-bundle-manifest",
      sha256: bundle.manifestSha256
    }]
  });
  draft.offlineBundle = {
    bundleManifestSha256: bundle.manifestSha256,
    receiptIds: bundle.receiptIds,
    signatureEnvelopeReceiptIds: bundle.signatureEnvelopeReceiptIds,
    authorityRegistryReceiptIds: bundle.authorityRegistryReceiptIds,
    revocationReceiptIds: bundle.revocationReceiptIds,
    schemaHashes: bundle.schemaHashes,
    createdAtUtc: bundle.manifest.createdAtUtc,
    ...(overrides.offlineBundle ?? {})
  };
  if (overrides.inputReceiptIds) draft.inputReceiptIds = overrides.inputReceiptIds;
  if (overrides.inputHashes) draft.inputHashes = overrides.inputHashes;
  return finalizeVnextReceipt(draft);
}

function completeBundle(fixture, manifestOverrides = {}) {
  const manifest = finalizeManifestFor(fixture, manifestOverrides);
  return {
    manifest,
    verificationReceipt: makeVerificationReceipt(manifest)
  };
}

function verificationInput(fixture, bundle, overrides = {}) {
  return {
    bundleManifestBytes: bundle.manifest.bytes,
    expectedBundleManifestSha256: bundle.manifest.manifestSha256,
    expectedCampaignId: fixture.campaignId,
    expectedEnvironment: fixture.environment,
    expectedTerminalRegistryReceiptId: fixture.expectedTerminalRegistryReceiptId,
    receiptBytes: fixture.receiptBytes,
    subjectBytes: fixture.subjectBytes,
    trustedRootRegistryReceiptId: fixture.trustedRootRegistryReceiptId,
    verificationReceiptBytes: bundle.verificationReceipt.bytes,
    verificationTimeUtc: fixture.verificationTimeUtc,
    ...overrides
  };
}

function replaceManifest(bundle, mutate) {
  const manifest = structuredClone(bundle.manifest.manifest);
  mutate(manifest);
  const bytes = canonicalizeVnextJcsBytes(manifest, offlineBundleProfile.jcsLimits);
  const replacement = {
    ...bundle.manifest,
    manifest,
    bytes,
    manifestSha256: sha256(bytes)
  };
  return {
    manifest: replacement,
    verificationReceipt: makeVerificationReceipt(replacement, {
      attemptId: `offline-mutated-${hash(bytes).slice(0, 12)}`
    })
  };
}

test("freezes an exact public-only profile and imports no network client", () => {
  const profilePath = path.join(repositoryRoot, "contracts", "vnext",
    "offline-verification-bundle-profile.v1.json");
  const verifierPath = path.join(repositoryRoot, "tinyrustlm", "tools",
    "vnext-offline-bundle.js");
  const rawProfile = fs.readFileSync(profilePath);
  const verifierSource = fs.readFileSync(verifierPath, "utf8");

  assert.equal(rawProfile.length, 3548);
  assert.equal(sha256(rawProfile),
    "f5ba2fd0750627890d0181dfbaca457fa5a6a5e8e637a8683888afa6e983331f");
  assert.equal(offlineBundleProfileSha256, sha256(rawProfile));
  assert.equal(offlineBundleProfile.authorityPolicy.networkAccess, "forbidden");
  assert.deepEqual(offlineBundleProfile.profileBindingNames, [
    "contract-registry",
    "offline-bundle-profile",
    "phase-invalidation-profile",
    "public-safe-redaction-profile",
    "receipt-signature-profile",
    "receipt-store-profile"
  ]);
  assert.equal(offlineBundleProfile.limits.maximumProfileBindings, 6);
  assert.equal(offlineBundleProfile.limits.maximumReceipts, 2048);
  assert.equal(offlineBundleProfile.limits.maximumManifestBytes, 4 * 1024 * 1024);
  assert.doesNotMatch(rawProfile.toString("utf8"),
    /private(?:Key|[_-]key)|BEGIN [A-Z ]*PRIVATE KEY/u);
  assert.doesNotMatch(verifierSource,
    /node:(?:http|https|net|tls|dns)|\bfetch\s*\(/u);
});

test("verifies one canonical closed bundle entirely from supplied member bytes", () => {
  const fixture = makeRootProofGraph();
  const bundle = completeBundle(fixture);
  const result = verifyVnextOfflineBundle(verificationInput(fixture, bundle));

  assert.equal(result.offlineBundleVerified, true);
  assert.equal(result.bundleManifestSha256, bundle.manifest.manifestSha256);
  assert.equal(result.verificationReceiptId,
    bundle.verificationReceipt.receipt.receiptId);
  assert.deepEqual(result.targetSignatureReceiptIds,
    [fixture.signature.receipt.receiptId]);
  assert.equal(result.targetCurrentEvidenceEligibleCount, 1);
  assert.equal(result.receiptCount, 2);
  assert.equal(result.subjectCount, 1);
  assert.equal(result.authority.authorityGraphVerified, true);
  assert.equal(result.authority.terminalRegistryCurrent, true);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.authority.signatures), true);

  assert.equal(bundle.manifest.manifest.schema,
    "tinyrustlm.vnext.offline_bundle_manifest.v1");
  assert.equal(bundle.manifest.manifest.profileId, offlineBundleProfile.profileId);
  assert.equal(bundle.manifest.schemaHashes.length, 9);
  assert.deepEqual(bundle.manifest.allReceiptIds,
    [...bundle.manifest.allReceiptIds].sort());
});

test("materializes identical manifest bytes from permuted transport arrays", () => {
  const fixture = makeRootProofGraph();
  const first = finalizeManifestFor(fixture);
  const second = finalizeManifestFor(fixture, {
    receiptBytes: [...fixture.receiptBytes].reverse(),
    subjectBytes: [...fixture.subjectBytes].reverse()
  });
  assert.equal(first.manifestSha256, second.manifestSha256);
  assert.deepEqual(first.bytes, second.bytes);
});

test("requires external manifest, campaign, environment, root, and terminal pins", () => {
  const fixture = makeRootProofGraph();
  const bundle = completeBundle(fixture);

  throwsCode(() => verifyVnextOfflineBundle(verificationInput(fixture, bundle, {
    expectedBundleManifestSha256: "f".repeat(64)
  })), "offline_bundle_manifest_hash_mismatch");
  throwsCode(() => verifyVnextOfflineBundle(verificationInput(fixture, bundle, {
    expectedCampaignId: "campaign-vnext-002"
  })), "offline_bundle_campaign_mismatch");
  throwsCode(() => verifyVnextOfflineBundle(verificationInput(fixture, bundle, {
    expectedEnvironment: "staging"
  })), "offline_bundle_environment_mismatch");
  throwsCode(() => verifyVnextOfflineBundle(verificationInput(fixture, bundle, {
    trustedRootRegistryReceiptId: `sha256:${"f".repeat(64)}`
  })), "offline_bundle_trust_pin_mismatch");
  throwsCode(() => verifyVnextOfflineBundle(verificationInput(fixture, bundle, {
    expectedTerminalRegistryReceiptId: `sha256:${"e".repeat(64)}`
  })), "offline_bundle_terminal_pin_mismatch");

  const missing = verificationInput(fixture, bundle);
  delete missing.trustedRootRegistryReceiptId;
  throwsCode(() => verifyVnextOfflineBundle(missing),
    "offline_bundle_input_fields_invalid");
});

test("rejects missing, extra, and duplicate receipt or subject members", () => {
  const fixture = makeRootProofGraph();
  const bundle = completeBundle(fixture);
  const extraReceipt = finalizeVnextReceipt(baseReceiptDraft({
    receiptType: "screening",
    attemptId: "extra-screening"
  }));
  const extraSubject = makeOutsideProof({
    label: "extra-subject",
    authorityRegistry: fixture.root,
    observerKey: fixture.observerKey
  });

  throwsCode(() => verifyVnextOfflineBundle(verificationInput(fixture, bundle, {
    receiptBytes: [fixture.signature.bytes]
  })), "offline_bundle_receipt_missing");
  throwsCode(() => verifyVnextOfflineBundle(verificationInput(fixture, bundle, {
    receiptBytes: [...fixture.receiptBytes, extraReceipt.bytes]
  })), "offline_bundle_receipt_extra");
  throwsCode(() => verifyVnextOfflineBundle(verificationInput(fixture, bundle, {
    receiptBytes: [...fixture.receiptBytes, fixture.root.bytes]
  })), "offline_bundle_receipt_duplicate");
  throwsCode(() => verifyVnextOfflineBundle(verificationInput(fixture, bundle, {
    subjectBytes: []
  })), "offline_bundle_subject_missing");
  throwsCode(() => verifyVnextOfflineBundle(verificationInput(fixture, bundle, {
    subjectBytes: [...fixture.subjectBytes, extraSubject.bytes]
  })), "offline_bundle_subject_extra");
  throwsCode(() => verifyVnextOfflineBundle(verificationInput(fixture, bundle, {
    subjectBytes: [...fixture.subjectBytes, fixture.proof.bytes]
  })), "offline_bundle_subject_duplicate");
});

test("rejects member hash drift, profile drift, schema drift, and noncanonical wire", () => {
  const fixture = makeRootProofGraph();
  const bundle = completeBundle(fixture);

  const memberDrift = replaceManifest(bundle, (manifest) => {
    manifest.receipts[0].sha256 = "f".repeat(64);
  });
  throwsCode(() => verifyVnextOfflineBundle(verificationInput(fixture, memberDrift)),
    "offline_bundle_member_hash_mismatch");

  const profileDrift = replaceManifest(bundle, (manifest) => {
    const phaseBinding = manifest.profileBindings.find((entry) =>
      entry.name === "phase-invalidation-profile");
    phaseBinding.sha256 = "e".repeat(64);
  });
  throwsCode(() => verifyVnextOfflineBundle(verificationInput(fixture, profileDrift)),
    "offline_bundle_profile_binding_mismatch");

  const schemaDrift = replaceManifest(bundle, (manifest) => {
    manifest.schemaHashes[0].sha256 = "d".repeat(64);
  });
  throwsCode(() => verifyVnextOfflineBundle(verificationInput(fixture, schemaDrift)),
    "offline_bundle_schema_binding_mismatch");

  const pretty = Buffer.from(JSON.stringify(bundle.manifest.manifest, null, 2), "utf8");
  throwsCode(() => verifyVnextOfflineBundle(verificationInput(fixture, bundle, {
    bundleManifestBytes: pretty,
    expectedBundleManifestSha256: sha256(pretty)
  })), "offline_bundle_manifest_noncanonical");
});

test("requires the verification receipt to echo exact manifest categories and parents", () => {
  const fixture = makeRootProofGraph();
  const bundle = completeBundle(fixture);
  const wrongCategories = makeVerificationReceipt(bundle.manifest, {
    attemptId: "offline-wrong-categories",
    offlineBundle: { receiptIds: [fixture.root.receipt.receiptId] }
  });
  throwsCode(() => verifyVnextOfflineBundle(verificationInput(fixture, bundle, {
    verificationReceiptBytes: wrongCategories.bytes
  })), "offline_bundle_receipt_categories_mismatch");

  const wrongParents = makeVerificationReceipt(bundle.manifest, {
    attemptId: "offline-wrong-parents",
    inputReceiptIds: [fixture.signature.receipt.receiptId]
  });
  throwsCode(() => verifyVnextOfflineBundle(verificationInput(fixture, bundle, {
    verificationReceiptBytes: wrongParents.bytes
  })), "offline_bundle_receipt_parents_mismatch");

  const wrongHash = makeVerificationReceipt(bundle.manifest, {
    attemptId: "offline-wrong-hash",
    inputHashes: [{ name: "offline-bundle-manifest", sha256: "c".repeat(64) }]
  });
  throwsCode(() => verifyVnextOfflineBundle(verificationInput(fixture, bundle, {
    verificationReceiptBytes: wrongHash.bytes
  })), "offline_bundle_receipt_manifest_binding_mismatch");
});

test("rejects incomplete receipt closure and valid but unrelated members", () => {
  const localKey = authorityKey({
    keyId: "local-recorder-key-001",
    signerId: "local-recorder-001",
    role: "local-recorder"
  });
  const releaseKey = authorityKey({
    keyId: "release-key-001",
    signerId: "release-authorizer-001",
    role: "release-authorizer"
  });
  const root = makeAuthorityRegistry({ label: "closure-root", keys: [localKey, releaseKey] });
  const missingParentId = `sha256:${"b".repeat(64)}`;
  const child = finalizeVnextReceipt(baseReceiptDraft({
    receiptType: "screening",
    attemptId: "closure-child",
    inputReceiptIds: [missingParentId]
  }));
  const signature = makeSignatureReceipt({
    label: "closure-child",
    authorityRegistry: root,
    subject: child,
    signingKey: localKey,
    scope: "receipt-recording"
  });
  const fixture = {
    campaignId,
    environment: "production",
    expectedTerminalRegistryReceiptId: root.receipt.receiptId,
    receiptBytes: [root.bytes, child.bytes, signature.bytes],
    subjectBytes: [],
    signature,
    trustedRootRegistryReceiptId: root.receipt.receiptId,
    verificationTimeUtc: "2026-08-09T00:30:00Z"
  };
  const bundle = completeBundle(fixture);
  throwsCode(() => verifyVnextOfflineBundle(verificationInput(fixture, bundle)),
    "offline_bundle_receipt_closure_incomplete");

  const normal = makeRootProofGraph();
  const extraReceipt = finalizeVnextReceipt(baseReceiptDraft({
    receiptType: "screening",
    attemptId: "manifested-but-unlinked"
  }));
  const withExtra = {
    ...normal,
    receiptBytes: [...normal.receiptBytes, extraReceipt.bytes]
  };
  const extraBundle = completeBundle(withExtra);
  throwsCode(() => verifyVnextOfflineBundle(verificationInput(withExtra, extraBundle)),
    "offline_bundle_receipt_unlinked");

  const unsignedExtraProof = makeOutsideProof({
    label: "unlinked-signature",
    authorityRegistry: normal.root,
    observerKey: normal.observerKey
  });
  const extraSignature = makeSignatureReceipt({
    label: "unlinked-signature",
    authorityRegistry: normal.root,
    subject: unsignedExtraProof,
    signingKey: normal.observerKey,
    scope: "outside-proof",
    nonceHash: unsignedExtraProof.value.nonceHash
  });
  const withExtraSignature = {
    ...normal,
    receiptBytes: [...normal.receiptBytes, extraSignature.bytes],
    subjectBytes: [...normal.subjectBytes, unsignedExtraProof.bytes]
  };
  const extraSignatureBundle = completeBundle(withExtraSignature);
  throwsCode(() => verifyVnextOfflineBundle(verificationInput(withExtraSignature,
    extraSignatureBundle)), "offline_bundle_receipt_unlinked");

  const extraSubject = makeOutsideProof({
    label: "manifested-subject",
    authorityRegistry: normal.root,
    observerKey: normal.observerKey
  });
  const withSubject = {
    ...normal,
    subjectBytes: [...normal.subjectBytes, extraSubject.bytes]
  };
  const subjectBundle = completeBundle(withSubject);
  throwsCode(() => verifyVnextOfflineBundle(verificationInput(withSubject, subjectBundle)),
    "offline_bundle_subject_unlinked");
});

test("rejects a stale target while retaining separate authority results", () => {
  const fixture = makeRootProofGraph({
    verificationTimeUtc: "2026-08-09T02:00:00Z"
  });
  const bundle = completeBundle(fixture);
  throwsCode(() => verifyVnextOfflineBundle(verificationInput(fixture, bundle)),
    "offline_bundle_target_stale");
});

test("accepts complete successor and unrelated-key revocation governance", () => {
  const observerKey = authorityKey({
    keyId: "observer-key-001",
    signerId: "observer-external-001",
    role: "outside-network-observer"
  });
  const retiredKey = authorityKey({
    keyId: "p2p-key-001",
    signerId: "p2p-publisher-001",
    role: "p2p-publisher"
  });
  const replacementKey = authorityKey({
    keyId: "p2p-key-002",
    signerId: "p2p-publisher-002",
    role: "p2p-publisher",
    validFromUtc: "2026-08-09T00:20:00Z"
  });
  const releaseKey = authorityKey({
    keyId: "release-key-001",
    signerId: "release-authorizer-001",
    role: "release-authorizer"
  });
  const root = makeAuthorityRegistry({
    label: "revocation-root",
    keys: [observerKey, retiredKey, releaseKey]
  });
  const proof = makeOutsideProof({
    label: "revocation-proof",
    authorityRegistry: root,
    observerKey
  });
  const signature = makeSignatureReceipt({
    label: "revocation-proof",
    authorityRegistry: root,
    subject: proof,
    signingKey: observerKey,
    scope: "outside-proof",
    nonceHash: proof.value.nonceHash
  });
  const successor = makeAuthorityRegistry({
    label: "revocation-successor",
    previous: root,
    effectiveAtUtc: "2026-08-09T00:20:00Z",
    keys: [observerKey, { ...retiredKey.record, status: "revoked" },
      replacementKey, releaseKey]
  });
  const governance = makeSignatureReceipt({
    label: "revocation-governance",
    authorityRegistry: root,
    subject: successor,
    signingKey: releaseKey,
    scope: "authority-registry",
    issuedAtUtc: "2026-08-09T00:19:58Z",
    expiresAtUtc: "2026-08-09T01:19:58Z"
  });
  const revocation = makeRevocationReceipt({
    label: "p2p-key-001",
    predecessor: root,
    successor,
    key: retiredKey,
    replacementKey,
    effectiveAtUtc: "2026-08-09T00:20:00Z"
  });
  const revocationSignature = makeSignatureReceipt({
    label: "p2p-key-001-revocation",
    authorityRegistry: root,
    subject: revocation,
    signingKey: releaseKey,
    scope: "key-revocation",
    issuedAtUtc: "2026-08-09T00:19:59Z",
    expiresAtUtc: "2026-08-09T01:19:59Z"
  });
  const fixture = {
    campaignId,
    environment: "production",
    expectedTerminalRegistryReceiptId: successor.receipt.receiptId,
    receiptBytes: [root.bytes, signature.bytes, successor.bytes, governance.bytes,
      revocation.bytes, revocationSignature.bytes],
    subjectBytes: [proof.bytes],
    signature,
    trustedRootRegistryReceiptId: root.receipt.receiptId,
    verificationTimeUtc: "2026-08-09T00:30:00Z"
  };
  const bundle = completeBundle(fixture);
  const result = verifyVnextOfflineBundle(verificationInput(fixture, bundle));

  assert.equal(result.offlineBundleVerified, true);
  assert.equal(result.authority.registryDepth, 2);
  assert.equal(bundle.manifest.revocationReceiptIds.length, 1);
  assert.equal(bundle.manifest.signatureEnvelopeReceiptIds.length, 3);
});

test("fails closed on interrupted bytes, hostile accessors, and resource excess", () => {
  const fixture = makeRootProofGraph();
  const bundle = completeBundle(fixture);
  throwsCode(() => verifyVnextOfflineBundle(verificationInput(fixture, bundle, {
    bundleManifestBytes: bundle.manifest.bytes.subarray(0,
      bundle.manifest.bytes.length - 1),
    expectedBundleManifestSha256: sha256(bundle.manifest.bytes.subarray(0,
      bundle.manifest.bytes.length - 1))
  })), "offline_bundle_manifest_invalid");
  throwsCode(() => verifyVnextOfflineBundle(verificationInput(fixture, bundle, {
    verificationReceiptBytes: bundle.verificationReceipt.bytes.subarray(0,
      bundle.verificationReceipt.bytes.length - 1)
  })), "offline_bundle_verification_receipt_invalid");
  throwsCode(() => verifyVnextOfflineBundle(verificationInput(fixture, bundle, {
    receiptBytes: [fixture.root.bytes.subarray(0, fixture.root.bytes.length - 1),
      fixture.signature.bytes]
  })), "offline_bundle_receipt_invalid");

  const hostile = verificationInput(fixture, bundle);
  Object.defineProperty(hostile, "expectedEnvironment", {
    enumerable: true,
    get() {
      return "production";
    }
  });
  throwsCode(() => verifyVnextOfflineBundle(hostile),
    "offline_bundle_input_fields_invalid");
  throwsCode(() => verifyVnextOfflineBundle(verificationInput(fixture, bundle, {
    receiptBytes: Array.from({ length: 2049 }, () => fixture.root.bytes)
  })), "offline_bundle_receipt_input_invalid");

  let shadowedGetterInvoked = false;
  const shadowedManifest = Uint8Array.from(bundle.manifest.bytes);
  Object.defineProperty(shadowedManifest, "buffer", {
    get() {
      shadowedGetterInvoked = true;
      throw new Error("must not execute");
    }
  });
  const shadowedResult = verifyVnextOfflineBundle(verificationInput(fixture, bundle, {
    bundleManifestBytes: shadowedManifest
  }));
  assert.equal(shadowedResult.offlineBundleVerified, true);
  assert.equal(shadowedGetterInvoked, false);

  if (typeof SharedArrayBuffer === "function") {
    const shared = new SharedArrayBuffer(bundle.manifest.bytes.length);
    new Uint8Array(shared).set(bundle.manifest.bytes);
    throwsCode(() => verifyVnextOfflineBundle(verificationInput(fixture, bundle, {
      bundleManifestBytes: new Uint8Array(shared)
    })), "offline_bundle_manifest_input_invalid");
  }
});
