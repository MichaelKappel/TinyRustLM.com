"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");
const { canonicalizeVnextJcsBytes } = require("./vnext-jcs.js");
const { finalizeVnextReceipt } = require("./vnext-receipt-identity.js");
const {
  finalizeVnextOfflineBundleManifest,
  offlineBundleProfile,
  offlineBundleProfileSha256,
  verifyVnextOfflineBundle
} = require("./vnext-offline-bundle.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const seedPath = path.join(
  repositoryRoot,
  "contracts/vnext/authority-graph-public-seed.v1.json"
);
const vectorPath = path.join(
  repositoryRoot,
  "contracts/vnext/offline-bundle-rust-vectors.v1.json"
);
const createdAtUtc = "2026-08-09T00:05:00Z";
const sourceRevision = `git-sha1:${"a".repeat(40)}`;
const redaction = Object.freeze({
  decision: "public-safe",
  profile: "tinyrustlm.vnext.public_safe.v1"
});

function invariant(condition, message) {
  if (!condition) {
    const error = new Error(message);
    error.code = "offline_bundle_rust_vector_generation_failed";
    throw error;
  }
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function hashText(value) {
  return sha256(Buffer.from(value, "utf8"));
}

function decodeCanonical(value) {
  invariant(typeof value === "string", "vector bytes must be base64 strings");
  const bytes = Buffer.from(value, "base64");
  invariant(bytes.toString("base64") === value, "vector bytes must use canonical base64");
  return bytes;
}

function seedInput(entry) {
  return {
    campaignId: entry.campaignId,
    environment: entry.environment,
    verificationTimeUtc: entry.verificationTimeUtc,
    trustedRootRegistryReceiptId: entry.trustedRootRegistryReceiptId,
    expectedTerminalRegistryReceiptId: entry.expectedTerminalRegistryReceiptId,
    receiptBytes: entry.receiptBytesBase64.map(decodeCanonical),
    subjectBytes: entry.subjectBytesBase64.map(decodeCanonical)
  };
}

function copyBytes(values) {
  return values.map((bytes) => Buffer.from(bytes));
}

function copyInput(input, overrides = {}) {
  return {
    bundleManifestBytes: Buffer.from(input.bundleManifestBytes),
    expectedBundleManifestSha256: input.expectedBundleManifestSha256,
    expectedCampaignId: input.expectedCampaignId,
    expectedEnvironment: input.expectedEnvironment,
    expectedTerminalRegistryReceiptId: input.expectedTerminalRegistryReceiptId,
    receiptBytes: copyBytes(input.receiptBytes),
    subjectBytes: copyBytes(input.subjectBytes),
    trustedRootRegistryReceiptId: input.trustedRootRegistryReceiptId,
    verificationReceiptBytes: Buffer.from(input.verificationReceiptBytes),
    verificationTimeUtc: input.verificationTimeUtc,
    ...overrides
  };
}

function encodeInput(input) {
  return {
    bundleManifestBytesBase64: input.bundleManifestBytes.toString("base64"),
    expectedBundleManifestSha256: input.expectedBundleManifestSha256,
    expectedCampaignId: input.expectedCampaignId,
    expectedEnvironment: input.expectedEnvironment,
    expectedTerminalRegistryReceiptId: input.expectedTerminalRegistryReceiptId,
    receiptBytesBase64: input.receiptBytes.map((bytes) => bytes.toString("base64")),
    subjectBytesBase64: input.subjectBytes.map((bytes) => bytes.toString("base64")),
    trustedRootRegistryReceiptId: input.trustedRootRegistryReceiptId,
    verificationReceiptBytesBase64: input.verificationReceiptBytes.toString("base64"),
    verificationTimeUtc: input.verificationTimeUtc
  };
}

function parseReceipt(bytes) {
  return parseStrictJson(bytes);
}

function nonGovernanceSignatureId(receiptBytes) {
  const receipt = receiptBytes.map(parseReceipt).find((value) =>
    value.receiptType === "signature-envelope" &&
    value.signatureEnvelope.scope !== "authority-registry" &&
    value.signatureEnvelope.scope !== "key-revocation");
  invariant(receipt !== undefined, "seed has no non-governance signature");
  return receipt.receiptId;
}

function governanceSignatureId(receiptBytes) {
  const receipt = receiptBytes.map(parseReceipt).find((value) =>
    value.receiptType === "signature-envelope" &&
    value.signatureEnvelope.scope === "authority-registry");
  invariant(receipt !== undefined, "seed has no governance signature");
  return receipt.receiptId;
}

function baseReceiptDraft({
  campaignId,
  receiptType,
  attemptId,
  startedAtUtc = createdAtUtc,
  inputReceiptIds = [],
  inputHashes = []
}) {
  return {
    schema: "tinyrustlm.vnext.receipt.v1",
    receiptType,
    campaignId,
    attemptId,
    phase: receiptType,
    status: "pass",
    startedAtUtc,
    completedAtUtc: startedAtUtc,
    sourceRevision,
    inputReceiptIds: [...inputReceiptIds].sort(),
    inputHashes: [...inputHashes].sort((left, right) =>
      left.name.localeCompare(right.name)),
    outputHashes: [],
    tools: [{
      name: "vnext-offline-rust-vector-generator",
      version: "1.0.0",
      binarySha256: hashText("vnext-offline-rust-vector-generator")
    }],
    configurationSha256: hashText(`configuration:${attemptId}`),
    runtime: {
      runtimeIdentifier: "node-vnext-offline-vector",
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

function makeVerificationReceipt(manifest, campaignId, overrides = {}) {
  const attemptId = overrides.attemptId ??
    `offline-vector-${manifest.manifestSha256.slice(0, 12)}`;
  const inputReceiptIds = overrides.inputReceiptIds ?? manifest.allReceiptIds;
  const inputHashes = overrides.inputHashes ?? [{
    name: "offline-bundle-manifest",
    sha256: manifest.manifestSha256
  }];
  const draft = baseReceiptDraft({
    campaignId,
    receiptType: "offline-verification-bundle",
    attemptId,
    startedAtUtc: manifest.manifest.createdAtUtc,
    inputReceiptIds,
    inputHashes
  });
  draft.offlineBundle = {
    bundleManifestSha256: manifest.manifestSha256,
    receiptIds: manifest.receiptIds,
    signatureEnvelopeReceiptIds: manifest.signatureEnvelopeReceiptIds,
    authorityRegistryReceiptIds: manifest.authorityRegistryReceiptIds,
    revocationReceiptIds: manifest.revocationReceiptIds,
    schemaHashes: manifest.schemaHashes,
    createdAtUtc: manifest.manifest.createdAtUtc,
    ...(overrides.offlineBundle ?? {})
  };
  return finalizeVnextReceipt(draft);
}

function completeBundle(seed, overrides = {}) {
  const receiptBytes = copyBytes(overrides.receiptBytes ?? seed.receiptBytes);
  const subjectBytes = copyBytes(overrides.subjectBytes ?? seed.subjectBytes);
  const targetSignatureReceiptIds = overrides.targetSignatureReceiptIds ??
    [nonGovernanceSignatureId(receiptBytes)];
  const manifest = finalizeVnextOfflineBundleManifest({
    campaignId: seed.campaignId,
    createdAtUtc: overrides.createdAtUtc ?? createdAtUtc,
    environment: seed.environment,
    expectedTerminalRegistryReceiptId: seed.expectedTerminalRegistryReceiptId,
    receiptBytes,
    subjectBytes,
    targetSignatureReceiptIds: [...targetSignatureReceiptIds].sort(),
    trustedRootRegistryReceiptId: seed.trustedRootRegistryReceiptId
  });
  const verificationReceipt = makeVerificationReceipt(manifest, seed.campaignId);
  return {
    input: {
      bundleManifestBytes: manifest.bytes,
      expectedBundleManifestSha256: manifest.manifestSha256,
      expectedCampaignId: seed.campaignId,
      expectedEnvironment: seed.environment,
      expectedTerminalRegistryReceiptId: seed.expectedTerminalRegistryReceiptId,
      receiptBytes,
      subjectBytes,
      trustedRootRegistryReceiptId: seed.trustedRootRegistryReceiptId,
      verificationReceiptBytes: verificationReceipt.bytes,
      verificationTimeUtc: overrides.verificationTimeUtc ?? seed.verificationTimeUtc
    },
    manifest,
    verificationReceipt
  };
}

function replaceManifest(bundle, mutate) {
  const manifest = structuredClone(bundle.manifest.manifest);
  mutate(manifest);
  const bytes = canonicalizeVnextJcsBytes(manifest, offlineBundleProfile.jcsLimits);
  const replacement = {
    ...bundle.manifest,
    manifest,
    manifestSha256: sha256(bytes),
    bytes
  };
  const verificationReceipt = makeVerificationReceipt(
    replacement,
    bundle.input.expectedCampaignId
  );
  return {
    input: copyInput(bundle.input, {
      bundleManifestBytes: bytes,
      expectedBundleManifestSha256: replacement.manifestSha256,
      verificationReceiptBytes: verificationReceipt.bytes
    }),
    manifest: replacement,
    verificationReceipt
  };
}

function screeningReceipt(campaignId, attemptId) {
  return finalizeVnextReceipt(baseReceiptDraft({
    campaignId,
    receiptType: "screening",
    attemptId
  }));
}

function acceptedCase(name, input) {
  const result = verifyVnextOfflineBundle(input);
  const resultBytes = canonicalizeVnextJcsBytes(result);
  return {
    name,
    ...encodeInput(input),
    resultBytesBase64: resultBytes.toString("base64"),
    resultSha256: sha256(resultBytes)
  };
}

function rejectionCase(name, input, expectedErrorCode) {
  let actual = null;
  try {
    verifyVnextOfflineBundle(input);
  } catch (error) {
    actual = error?.code ?? null;
  }
  invariant(actual === expectedErrorCode,
    `${name} rejection changed from ${expectedErrorCode} to ${actual}`);
  return {
    name,
    ...encodeInput(input),
    expectedErrorCode
  };
}

function loadSeeds() {
  const bytes = fs.readFileSync(seedPath);
  const corpus = parseStrictJson(bytes);
  invariant(corpus.schema === "tinyrustlm.vnext.authority_graph_public_seed.v1",
    "authority seed schema changed");
  invariant(Array.isArray(corpus.acceptedCases) && corpus.acceptedCases.length === 7,
    "authority accepted seed count changed");
  const cases = new Map(corpus.acceptedCases.map((entry) =>
    [entry.name, seedInput(entry)]));
  for (const name of ["root-current", "root-signature-expired", "successor-current"]) {
    invariant(cases.has(name), `authority seed ${name} is missing`);
  }
  return { bytes, cases };
}

function buildCorpus() {
  const seeds = loadSeeds();
  const root = seeds.cases.get("root-current");
  const expired = seeds.cases.get("root-signature-expired");
  const successor = seeds.cases.get("successor-current");
  const baseline = completeBundle(root);
  const createdAtVerification = completeBundle(root, {
    createdAtUtc: root.verificationTimeUtc
  });
  const extraReceipt = screeningReceipt(root.campaignId, "offline-unlinked-receipt");
  const successorExtraSubject = successor.subjectBytes.find((candidate) =>
    !root.subjectBytes.some((current) => current.equals(candidate)));
  invariant(successorExtraSubject !== undefined, "authority seed has no distinct subject");
  const receiptUnlinked = completeBundle(root, {
    receiptBytes: [...root.receiptBytes, extraReceipt.bytes]
  });
  const subjectUnlinked = completeBundle(root, {
    subjectBytes: [...root.subjectBytes, successorExtraSubject]
  });
  const expiredBundle = completeBundle(expired);
  const successorGovernance = governanceSignatureId(successor.receiptBytes);
  const governanceTarget = completeBundle(successor, {
    targetSignatureReceiptIds: [successorGovernance]
  });
  const staleTerminal = completeBundle(successor, {
    targetSignatureReceiptIds: [successorGovernance],
    verificationTimeUtc: "2028-08-01T00:00:00Z"
  });

  const hashMismatch = copyInput(baseline.input, {
    expectedBundleManifestSha256: "f".repeat(64)
  });
  const campaignMismatch = copyInput(baseline.input, {
    expectedCampaignId: "campaign-vnext-002"
  });
  const environmentMismatch = copyInput(baseline.input, {
    expectedEnvironment: "staging"
  });
  const trustMismatch = copyInput(baseline.input, {
    trustedRootRegistryReceiptId: `sha256:${"f".repeat(64)}`
  });
  const terminalMismatch = copyInput(baseline.input, {
    expectedTerminalRegistryReceiptId: `sha256:${"e".repeat(64)}`
  });
  const future = replaceManifest(baseline, (manifest) => {
    manifest.createdAtUtc = "2026-08-09T00:31:00Z";
  });
  const memberHash = replaceManifest(baseline, (manifest) => {
    manifest.receipts[0].sha256 = "d".repeat(64);
  });
  const memberMetadata = replaceManifest(baseline, (manifest) => {
    manifest.receipts[0].byteLength += 1;
    manifest.totals.totalReceiptBytes += 1;
  });
  const profileBinding = replaceManifest(baseline, (manifest) => {
    manifest.profileBindings[0].sha256 = "c".repeat(64);
  });
  const schemaBinding = replaceManifest(baseline, (manifest) => {
    manifest.schemaHashes[0].sha256 = "b".repeat(64);
  });
  const targetMissing = replaceManifest(baseline, (manifest) => {
    manifest.targetSignatureReceiptIds = [`sha256:${"a".repeat(64)}`];
  });
  const prettyManifest = Buffer.from(
    JSON.stringify(baseline.manifest.manifest, null, 2),
    "utf8"
  );
  const truncatedManifest = baseline.input.bundleManifestBytes.subarray(
    0,
    baseline.input.bundleManifestBytes.length - 1
  );
  const wrongManifestReceipt = makeVerificationReceipt(
    baseline.manifest,
    root.campaignId,
    {
      attemptId: "offline-wrong-manifest-binding",
      inputHashes: [{
        name: "offline-bundle-manifest",
        sha256: "9".repeat(64)
      }]
    }
  );
  const wrongCategoriesReceipt = makeVerificationReceipt(
    baseline.manifest,
    root.campaignId,
    {
      attemptId: "offline-wrong-categories",
      offlineBundle: {
        receiptIds: [root.trustedRootRegistryReceiptId]
      }
    }
  );
  const wrongParentsReceipt = makeVerificationReceipt(
    baseline.manifest,
    root.campaignId,
    {
      attemptId: "offline-wrong-parents",
      inputReceiptIds: [nonGovernanceSignatureId(root.receiptBytes)]
    }
  );

  const acceptedCases = [
    acceptedCase("creation-at-verification-time", createdAtVerification.input),
    acceptedCase("root-current", baseline.input),
    acceptedCase("transport-order-reversed", copyInput(baseline.input, {
      receiptBytes: [...baseline.input.receiptBytes].reverse(),
      subjectBytes: [...baseline.input.subjectBytes].reverse()
    }))
  ].sort((left, right) => left.name.localeCompare(right.name));

  const rejectionCases = [
    rejectionCase("bundle-manifest-hash-mismatch", hashMismatch,
      "offline_bundle_manifest_hash_mismatch"),
    rejectionCase("campaign-pin-mismatch", campaignMismatch,
      "offline_bundle_campaign_mismatch"),
    rejectionCase("environment-pin-mismatch", environmentMismatch,
      "offline_bundle_environment_mismatch"),
    rejectionCase("manifest-created-in-future", future.input,
      "offline_bundle_created_in_future"),
    rejectionCase("manifest-interrupted", copyInput(baseline.input, {
      bundleManifestBytes: truncatedManifest,
      expectedBundleManifestSha256: sha256(truncatedManifest)
    }), "offline_bundle_manifest_invalid"),
    rejectionCase("manifest-member-hash-mismatch", memberHash.input,
      "offline_bundle_member_hash_mismatch"),
    rejectionCase("manifest-member-metadata-mismatch", memberMetadata.input,
      "offline_bundle_member_metadata_mismatch"),
    rejectionCase("manifest-noncanonical", copyInput(baseline.input, {
      bundleManifestBytes: prettyManifest,
      expectedBundleManifestSha256: sha256(prettyManifest)
    }), "offline_bundle_manifest_noncanonical"),
    rejectionCase("profile-binding-mismatch", profileBinding.input,
      "offline_bundle_profile_binding_mismatch"),
    rejectionCase("receipt-duplicate", copyInput(baseline.input, {
      receiptBytes: [...baseline.input.receiptBytes, baseline.input.receiptBytes[0]]
    }), "offline_bundle_receipt_duplicate"),
    rejectionCase("receipt-extra", copyInput(baseline.input, {
      receiptBytes: [...baseline.input.receiptBytes, extraReceipt.bytes]
    }), "offline_bundle_receipt_extra"),
    rejectionCase("receipt-interrupted", copyInput(baseline.input, {
      receiptBytes: [baseline.input.receiptBytes[0].subarray(
        0,
        baseline.input.receiptBytes[0].length - 1
      ), ...baseline.input.receiptBytes.slice(1)]
    }), "offline_bundle_receipt_invalid"),
    rejectionCase("receipt-manifest-binding-mismatch", copyInput(baseline.input, {
      verificationReceiptBytes: wrongManifestReceipt.bytes
    }), "offline_bundle_receipt_manifest_binding_mismatch"),
    rejectionCase("receipt-categories-mismatch", copyInput(baseline.input, {
      verificationReceiptBytes: wrongCategoriesReceipt.bytes
    }), "offline_bundle_receipt_categories_mismatch"),
    rejectionCase("receipt-missing", copyInput(baseline.input, {
      receiptBytes: [baseline.input.receiptBytes[0]]
    }), "offline_bundle_receipt_missing"),
    rejectionCase("receipt-parents-mismatch", copyInput(baseline.input, {
      verificationReceiptBytes: wrongParentsReceipt.bytes
    }), "offline_bundle_receipt_parents_mismatch"),
    rejectionCase("receipt-recursive", copyInput(baseline.input, {
      receiptBytes: [...baseline.input.receiptBytes,
        baseline.verificationReceipt.bytes]
    }), "offline_bundle_recursive_receipt"),
    rejectionCase("receipt-unlinked", receiptUnlinked.input,
      "offline_bundle_receipt_unlinked"),
    rejectionCase("schema-binding-mismatch", schemaBinding.input,
      "offline_bundle_schema_binding_mismatch"),
    rejectionCase("subject-duplicate", copyInput(baseline.input, {
      subjectBytes: [...baseline.input.subjectBytes, baseline.input.subjectBytes[0]]
    }), "offline_bundle_subject_duplicate"),
    rejectionCase("subject-extra", copyInput(baseline.input, {
      subjectBytes: [...baseline.input.subjectBytes, successorExtraSubject]
    }), "offline_bundle_subject_extra"),
    rejectionCase("subject-interrupted", copyInput(baseline.input, {
      subjectBytes: [baseline.input.subjectBytes[0].subarray(
        0,
        baseline.input.subjectBytes[0].length - 1
      )]
    }), "offline_bundle_subject_invalid"),
    rejectionCase("subject-missing", copyInput(baseline.input, {
      subjectBytes: []
    }), "offline_bundle_subject_missing"),
    rejectionCase("subject-unlinked", subjectUnlinked.input,
      "offline_bundle_subject_unlinked"),
    rejectionCase("target-signature-governance", governanceTarget.input,
      "offline_bundle_target_signature_invalid"),
    rejectionCase("target-signature-missing", targetMissing.input,
      "offline_bundle_target_signature_missing"),
    rejectionCase("target-signature-stale", expiredBundle.input,
      "offline_bundle_target_stale"),
    rejectionCase("terminal-pin-mismatch", terminalMismatch,
      "offline_bundle_terminal_pin_mismatch"),
    rejectionCase("terminal-registry-stale", staleTerminal.input,
      "offline_bundle_terminal_registry_stale"),
    rejectionCase("trust-pin-mismatch", trustMismatch,
      "offline_bundle_trust_pin_mismatch"),
    rejectionCase("verification-receipt-interrupted", copyInput(baseline.input, {
      verificationReceiptBytes: baseline.input.verificationReceiptBytes.subarray(
        0,
        baseline.input.verificationReceiptBytes.length - 1
      )
    }), "offline_bundle_verification_receipt_invalid")
  ].sort((left, right) => left.name.localeCompare(right.name));

  invariant(acceptedCases.length === 3, "accepted vector count changed");
  invariant(rejectionCases.length === 31, "rejection vector count changed");
  return {
    schema: "tinyrustlm.vnext.offline_bundle_rust_vectors.v1",
    profileId: offlineBundleProfile.profileId,
    profileSha256: offlineBundleProfileSha256,
    authorityPublicSeedSha256: sha256(seeds.bytes),
    acceptedCases,
    rejectionCases
  };
}

function renderVectorCorpus() {
  return Buffer.from(`${JSON.stringify(buildCorpus(), null, 2)}\n`, "utf8");
}

function writeVectorCorpus() {
  const bytes = renderVectorCorpus();
  fs.writeFileSync(vectorPath, bytes);
  return Object.freeze({ bytes: Buffer.from(bytes), vectorPath });
}

function main(argumentsList) {
  invariant(argumentsList.length === 1 && argumentsList[0] === "--write",
    "usage: node vnext-offline-bundle-rust-vectors.js --write");
  writeVectorCorpus();
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Offline-bundle Rust vector generation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  renderVectorCorpus,
  seedPath,
  vectorPath,
  writeVectorCorpus
});
