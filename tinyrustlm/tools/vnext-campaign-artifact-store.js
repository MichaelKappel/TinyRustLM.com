"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");
const {
  campaignProjectionProfile,
  campaignProjectionProfileSha256,
  inspectCampaignProjectionResultPlanSha256,
  projectVnextCampaign,
  validateCampaignPlanBytes,
  validateCampaignProjectionResultBytes
} = require("./vnext-campaign-projection.js");
const {
  createVnextCreateOnlyFiles,
  immutableRecord
} = require("./vnext-create-only-files.js");
const {
  VnextEvidenceError,
  failEvidence
} = require("./vnext-evidence-error.js");
const {
  durablePublicationProfile,
  durablePublicationProfileSha256
} = require("./vnext-durable-publication.js");

const profilePath = path.resolve(
  __dirname,
  "../../contracts/vnext/campaign-artifact-store-profile.v1.json"
);
const profileBytes = fs.readFileSync(profilePath);
const parsedProfile = parseStrictJson(profileBytes);
const digestPattern = /^[a-f0-9]{64}$/u;
const digestFilePattern = /^([a-f0-9]{64})\.json$/u;
const prefixPattern = /^[a-f0-9]{2}$/u;
const temporaryPattern = /^\.([a-f0-9]{64})\.[0-9]{1,20}\.[a-f0-9]{4,64}\.tmp$/u;
const optionNames = Object.freeze([]);
const artifactKinds = Object.freeze(["plan", "projection-result"]);
const profileFields = Object.freeze([
  "schema", "profileId", "status", "versionPolicy", "campaignProjectionProfileId",
  "campaignProjectionProfileSha256", "canonicalJsonProfile", "hashAlgorithm",
  "identityBasis", "networkAccess", "sourceMutation", "acceptedArtifacts",
  "projectionResultFields", "countFields", "countValueFields", "currentOperationFields",
  "phaseStateCountFields", "countedEvidenceFields", "layout", "durablePublication",
  "concurrency", "resume", "rebuild", "limits", "resultContract"
]);
const acceptedArtifactFields = Object.freeze([
  "kind", "schema", "maximumBytes", "layoutRoot"
]);
const layoutFields = Object.freeze([
  "planPattern", "projectionPattern", "temporaryPattern", "quarantineRoot",
  "pathLinkPolicy", "replacementPolicy", "mutablePointerPolicy"
]);
const durablePublicationFields = Object.freeze([
  "profileId", "profileSha256", "targetActivation", "directoryFlush", "restart",
  "targetWithoutReceipt", "receiptWithoutTarget", "callerSuppliedSuccess"
]);
const concurrencyFields = Object.freeze([
  "createWriters", "freshTemporaryPolicy", "minimumIncompleteTemporaryAgeMs",
  "publishedHardLinkTemporaryPolicy", "rebuildInterferencePolicy"
]);
const resumeFields = Object.freeze([
  "selectionPolicy", "storedProjectionAuthority", "planPolicy", "resultPolicy"
]);
const rebuildFields = Object.freeze([
  "unknownEntryPolicy", "incompleteTemporaryPolicy", "invalidArtifactPolicy",
  "missingPlanPolicy", "preserveUnrelatedValidArtifacts"
]);
const limitFields = Object.freeze([
  "maximumActivePlans", "maximumActiveProjections", "maximumQuarantineEntries",
  "maximumDirectoryEntries", "maximumScanEntries",
  "maximumQuarantineReasonCodeLength", "streamBufferBytes"
]);
const resultContractFields = Object.freeze([
  "absolutePathsReturned", "rawHostErrorsReturned", "rawInvalidBytesReturned",
  "durabilityReceiptResultReturned", "boundedErrorCodesOnly"
]);
const projectionResultFields = Object.freeze([
  "authorityStatus", "authorityTerminalRegistryReceiptId", "blockerCodes",
  "campaignId", "campaignPlanId", "campaignPlanSha256", "complete",
  "conflictingLaneIds", "conflictingObjectiveSignatureSubjectIds",
  "conflictingOperationIdentities", "countedEvidence", "counts",
  "currentOperation", "environment", "objectiveReceiptCount",
  "objectiveSignatureCount", "phaseReceiptCount", "phaseStateCounts",
  "profileId", "profileSha256", "resumableState", "schema",
  "unplannedCurrentReceiptIds", "unsignedCurrentReceiptIds", "verificationTimeUtc"
]);
const countFields = Object.freeze([
  "announcedModels", "cleanBrowserRounds", "liveMemoryRounds",
  "outsideProvenLanes", "qualifiedModels"
]);
const countValueFields = Object.freeze(["current", "target"]);
const currentOperationFields = Object.freeze(["operationId", "phase", "state"]);
const phaseStateCountFields = Object.freeze([
  "conflict", "current-nonpass", "current-pass", "stale", "superseded"
]);
const countedEvidenceFields = Object.freeze([
  "announcedModelReceiptIds", "browserRoundReceiptIds", "memoryRoundReceiptIds",
  "outsideProofSubjectIds", "qualificationReceiptIds", "signatureReceiptIds"
]);

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactDataObject(value, fields, code, step) {
  if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length !== 0) {
    failEvidence(code, step);
  }
  const actual = Object.getOwnPropertyNames(value).sort();
  const expected = [...fields].sort();
  if (actual.length !== expected.length ||
      actual.some((name, index) => name !== expected[index])) {
    failEvidence(code, step);
  }
  const result = {};
  for (const name of actual) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence(code, step);
    }
    result[name] = descriptor.value;
  }
  return result;
}

function exactDataArray(value, maximum, code, step) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
      value.length > maximum || Object.getOwnPropertySymbols(value).length !== 0 ||
      Object.getOwnPropertyNames(value).length !== value.length + 1) {
    failEvidence(code, step);
  }
  const result = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence(code, step);
    }
    result.push(descriptor.value);
  }
  return result;
}

function sameStrings(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length &&
    actual.every((entry, index) => entry === expected[index]);
}

function validateInstalledProfile() {
  exactDataObject(parsedProfile, profileFields,
    "campaign_artifact_store_profile_invalid", "campaign-artifact-store-profile");
  const artifacts = exactDataArray(parsedProfile.acceptedArtifacts, 2,
    "campaign_artifact_store_profile_invalid", "campaign-artifact-store-profile");
  for (const artifact of artifacts) {
    exactDataObject(artifact, acceptedArtifactFields,
      "campaign_artifact_store_profile_invalid", "campaign-artifact-store-profile");
  }
  exactDataObject(parsedProfile.layout, layoutFields,
    "campaign_artifact_store_profile_invalid", "campaign-artifact-store-profile");
  exactDataObject(parsedProfile.durablePublication, durablePublicationFields,
    "campaign_artifact_store_profile_invalid", "campaign-artifact-store-profile");
  exactDataObject(parsedProfile.concurrency, concurrencyFields,
    "campaign_artifact_store_profile_invalid", "campaign-artifact-store-profile");
  exactDataObject(parsedProfile.resume, resumeFields,
    "campaign_artifact_store_profile_invalid", "campaign-artifact-store-profile");
  exactDataObject(parsedProfile.rebuild, rebuildFields,
    "campaign_artifact_store_profile_invalid", "campaign-artifact-store-profile");
  exactDataObject(parsedProfile.limits, limitFields,
    "campaign_artifact_store_profile_invalid", "campaign-artifact-store-profile");
  exactDataObject(parsedProfile.resultContract, resultContractFields,
    "campaign_artifact_store_profile_invalid", "campaign-artifact-store-profile");
  const limitValues = Object.values(parsedProfile.limits);
  if (parsedProfile.schema !==
        "tinyrustlm.vnext.campaign_artifact_store_profile.v1" ||
      parsedProfile.profileId !== "tinyrustlm.vnext.campaign-artifact-store.v1" ||
      parsedProfile.status !== "frozen" ||
      parsedProfile.versionPolicy !== "single-current-profile-no-compatibility-reader" ||
      parsedProfile.campaignProjectionProfileId !== campaignProjectionProfile.profileId ||
      parsedProfile.campaignProjectionProfileSha256 !== campaignProjectionProfileSha256 ||
      parsedProfile.canonicalJsonProfile !==
        "rfc8785-jcs+tinyrustlm.strict-json.v1" ||
      parsedProfile.hashAlgorithm !== "sha256" ||
      parsedProfile.identityBasis !== "exact-canonical-wire-bytes" ||
      parsedProfile.networkAccess !== "forbidden" ||
      parsedProfile.sourceMutation !== "forbidden" ||
      artifacts[0].kind !== "plan" ||
      artifacts[0].schema !== campaignProjectionProfile.planSchema ||
      artifacts[0].maximumBytes !== campaignProjectionProfile.limits.maximumPlanBytes ||
      artifacts[0].layoutRoot !== "plans/sha256" ||
      artifacts[1].kind !== "projection-result" ||
      artifacts[1].schema !== campaignProjectionProfile.resultSchema ||
      artifacts[1].maximumBytes !==
        campaignProjectionProfile.limits.maximumProjectionResultBytes ||
      artifacts[1].layoutRoot !== "projections/sha256" ||
      !sameStrings(parsedProfile.projectionResultFields, projectionResultFields) ||
      !sameStrings(parsedProfile.countFields, countFields) ||
      !sameStrings(parsedProfile.countValueFields, countValueFields) ||
      !sameStrings(parsedProfile.currentOperationFields, currentOperationFields) ||
      !sameStrings(parsedProfile.phaseStateCountFields, phaseStateCountFields) ||
      !sameStrings(parsedProfile.countedEvidenceFields, countedEvidenceFields) ||
      parsedProfile.layout.planPattern !==
        "plans/sha256/{digest-prefix-2}/{digest}.json" ||
      parsedProfile.layout.projectionPattern !==
        "projections/sha256/{digest-prefix-2}/{digest}.json" ||
      parsedProfile.layout.temporaryPattern !== ".{digest}.{pid}.{nonce}.tmp" ||
      parsedProfile.layout.quarantineRoot !== "quarantine" ||
      parsedProfile.layout.pathLinkPolicy !== "reject-symbolic-link-or-reparse-point" ||
      parsedProfile.layout.replacementPolicy !== "never" ||
      parsedProfile.layout.mutablePointerPolicy !== "forbidden" ||
      parsedProfile.durablePublication.profileId !== durablePublicationProfile.profileId ||
      parsedProfile.durablePublication.profileSha256 !== durablePublicationProfileSha256 ||
      parsedProfile.durablePublication.targetActivation !==
        "matching-content-addressed-durability-receipt-required" ||
      parsedProfile.durablePublication.directoryFlush !== "verified-rust-helper-required" ||
      parsedProfile.durablePublication.callerSuppliedSuccess !== "forbidden" ||
      parsedProfile.concurrency.createWriters !==
        "multi-process-idempotent-hard-link" ||
      parsedProfile.concurrency.freshTemporaryPolicy !==
        "leave-pending-without-mutation" ||
      parsedProfile.concurrency.minimumIncompleteTemporaryAgeMs !== 300000 ||
      parsedProfile.concurrency.publishedHardLinkTemporaryPolicy !==
        "quarantine-same-inode-link" ||
      parsedProfile.concurrency.rebuildInterferencePolicy !== "fail-closed-and-retry" ||
      parsedProfile.resume.selectionPolicy !==
        "caller-supplied-inputs-reprojected-no-mutable-pointer" ||
      parsedProfile.resume.storedProjectionAuthority !==
        "immutable-history-not-current-truth" ||
      parsedProfile.resume.planPolicy !== "exact-active-plan-required" ||
      parsedProfile.resume.resultPolicy !==
        "recompute-validate-then-create-or-reuse-exact-bytes" ||
      parsedProfile.rebuild.unknownEntryPolicy !== "quarantine" ||
      parsedProfile.rebuild.incompleteTemporaryPolicy !==
        "quarantine-after-minimum-age" ||
      parsedProfile.rebuild.invalidArtifactPolicy !== "quarantine" ||
      parsedProfile.rebuild.missingPlanPolicy !==
        "quarantine-dependent-projection" ||
      parsedProfile.rebuild.preserveUnrelatedValidArtifacts !== true ||
      parsedProfile.limits.maximumActivePlans !== 64 ||
      parsedProfile.limits.maximumActiveProjections !== 65536 ||
      parsedProfile.limits.maximumQuarantineEntries !== 65536 ||
      parsedProfile.limits.maximumDirectoryEntries !== 66000 ||
      parsedProfile.limits.maximumScanEntries !== 262144 ||
      parsedProfile.limits.maximumQuarantineReasonCodeLength !== 80 ||
      parsedProfile.limits.streamBufferBytes !== 65536 ||
      parsedProfile.resultContract.absolutePathsReturned !== false ||
      parsedProfile.resultContract.rawHostErrorsReturned !== false ||
      parsedProfile.resultContract.rawInvalidBytesReturned !== false ||
      parsedProfile.resultContract.durabilityReceiptResultReturned !== true ||
      parsedProfile.resultContract.boundedErrorCodesOnly !== true ||
      !limitValues.every((entry) => Number.isSafeInteger(entry) && entry > 0)) {
    failEvidence("campaign_artifact_store_profile_invalid",
      "campaign-artifact-store-profile");
  }
}

validateInstalledProfile();

const campaignArtifactStoreProfile = immutableRecord({ ...parsedProfile });
const campaignArtifactStoreProfileSha256 = sha256(profileBytes);
const maximumBytesByKind = new Map(parsedProfile.acceptedArtifacts.map((entry) =>
  [entry.kind, entry.maximumBytes]));

function exactOptions(options) {
  if (!isPlainObject(options)) {
    failEvidence("campaign_artifact_store_options_invalid", "campaign-artifact-store-open");
  }
  const names = Object.getOwnPropertyNames(options);
  if (Object.getOwnPropertySymbols(options).length !== 0) {
    failEvidence("campaign_artifact_store_option_unknown", "campaign-artifact-store-open");
  }
  const result = {};
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(options, name);
    if (!descriptor || !descriptor.enumerable) {
      failEvidence("campaign_artifact_store_option_unknown", "campaign-artifact-store-open");
    }
    if (!("value" in descriptor)) {
      failEvidence("campaign_artifact_store_option_accessor", "campaign-artifact-store-open");
    }
    if (!optionNames.includes(name)) {
      failEvidence("campaign_artifact_store_option_unknown", "campaign-artifact-store-open");
    }
    result[name] = descriptor.value;
  }
  return Object.freeze(result);
}

function normalizeKind(kind) {
  if (typeof kind !== "string" || !artifactKinds.includes(kind)) {
    failEvidence("campaign_artifact_kind_invalid", "campaign-artifact-path");
  }
  return kind;
}

function normalizeDigest(digest) {
  if (typeof digest !== "string" || !digestPattern.test(digest)) {
    failEvidence("campaign_artifact_sha256_invalid", "campaign-artifact-path");
  }
  return digest;
}

function campaignArtifactRelativePath(kindInput, digestInput) {
  const kind = normalizeKind(kindInput);
  const digest = normalizeDigest(digestInput);
  const root = kind === "plan" ? "plans" : "projections";
  return `${root}/sha256/${digest.slice(0, 2)}/${digest}.json`;
}

function ensureLayout(fileOps, root) {
  fileOps.ensureRoot(root);
  const plans = fileOps.safeChild(root, ["plans"]);
  const planShaRoot = fileOps.safeChild(root, ["plans", "sha256"]);
  const projections = fileOps.safeChild(root, ["projections"]);
  const projectionShaRoot = fileOps.safeChild(root, ["projections", "sha256"]);
  const quarantine = fileOps.safeChild(root, ["quarantine"]);
  fileOps.ensureDirectory(plans);
  fileOps.ensureDirectory(planShaRoot);
  fileOps.ensureDirectory(projections);
  fileOps.ensureDirectory(projectionShaRoot);
  fileOps.ensureDirectory(quarantine);
  return Object.freeze({ plans, planShaRoot, projections, projectionShaRoot, quarantine });
}

function createVnextCampaignArtifactStore(rootInput, options = {}) {
  exactOptions(options);
  const fileOps = createVnextCreateOnlyFiles({
    codePrefix: "campaign_artifact",
    root: rootInput,
    steps: {
      open: "campaign-artifact-store-open",
      path: "campaign-artifact-path",
      persist: "campaign-artifact-persist",
      quarantine: "campaign-artifact-quarantine",
      read: "campaign-artifact-read",
      scan: "campaign-artifact-scan"
    },
    storeProfileId: parsedProfile.profileId,
    storeProfileSha256: campaignArtifactStoreProfileSha256,
    streamBufferBytes: parsedProfile.limits.streamBufferBytes
  });
  const root = fileOps.normalizeRoot(rootInput);
  const layout = ensureLayout(fileOps, root);
  let activePlans = new Map();
  let activeProjections = new Map();

  function artifactPath(kind, digest) {
    return path.join(root, ...campaignArtifactRelativePath(kind, digest).split("/"));
  }

  function readPlanFromMetadata(digest, metadata) {
    const filePath = path.join(root, ...metadata.relativePath.split("/"));
    fileOps.assertNoLinkComponents(path.dirname(filePath), true);
    let activation;
    let validated;
    try {
      activation = fileOps.activateBytes(filePath, maximumBytesByKind.get("plan"));
      validated = validateCampaignPlanBytes(activation.bytes);
    } catch (error) {
      throw new VnextEvidenceError(
        "campaign_artifact_active_read_failed",
        "campaign-artifact-read",
        error?.code
      );
    }
    if (validated.planSha256 !== digest) {
      failEvidence("campaign_artifact_active_identity_changed", "campaign-artifact-read");
    }
    return Object.freeze({ ...validated, durability: activation.durability });
  }

  function readPlan(digestInput) {
    const digest = normalizeDigest(digestInput);
    const metadata = activePlans.get(digest);
    if (!metadata) failEvidence("campaign_artifact_not_active", "campaign-artifact-read");
    return readPlanFromMetadata(digest, metadata);
  }

  function readProjection(digestInput) {
    const digest = normalizeDigest(digestInput);
    const metadata = activeProjections.get(digest);
    if (!metadata) failEvidence("campaign_artifact_not_active", "campaign-artifact-read");
    const plan = readPlan(metadata.campaignPlanSha256);
    const filePath = path.join(root, ...metadata.relativePath.split("/"));
    fileOps.assertNoLinkComponents(path.dirname(filePath), true);
    let activation;
    let validated;
    try {
      activation = fileOps.activateBytes(
        filePath,
        maximumBytesByKind.get("projection-result")
      );
      validated = validateCampaignProjectionResultBytes(
        activation.bytes,
        plan.bytes
      );
    } catch (error) {
      throw new VnextEvidenceError(
        "campaign_artifact_active_read_failed",
        "campaign-artifact-read",
        error?.code
      );
    }
    if (validated.resultSha256 !== digest) {
      failEvidence("campaign_artifact_active_identity_changed", "campaign-artifact-read");
    }
    return Object.freeze({ ...validated, durability: activation.durability });
  }

  function rebuild() {
    ensureLayout(fileOps, root);
    const durabilityIndex = fileOps.rebuildDurabilityIndex();
    let totalScanEntries = 0;
    const scanEntries = (directory, maximumEntries) => {
      const entries = fileOps.boundedDirectoryEntries(directory, maximumEntries);
      totalScanEntries += entries.length;
      if (!Number.isSafeInteger(totalScanEntries) ||
          totalScanEntries > parsedProfile.limits.maximumScanEntries) {
        failEvidence("campaign_artifact_store_total_scan_limit", "campaign-artifact-scan");
      }
      return entries;
    };
    const existingQuarantineEntries = scanEntries(
      layout.quarantine,
      parsedProfile.limits.maximumQuarantineEntries
    ).length;
    const newQuarantines = [];
    let quarantineEntryCount = existingQuarantineEntries;
    const quarantineCandidate = (source, reasonCode, digest = null) => {
      if (quarantineEntryCount >= parsedProfile.limits.maximumQuarantineEntries) {
        failEvidence("campaign_artifact_store_quarantine_limit",
          "campaign-artifact-quarantine");
      }
      const result = fileOps.quarantineEntry(
        root,
        layout.quarantine,
        source,
        reasonCode,
        "artifactSha256",
        digest
      );
      if (result !== null) quarantineEntryCount += 1;
      return result;
    };
    const scanUnknownContainer = (directory, allowedNames) => {
      for (const entry of scanEntries(
        directory,
        parsedProfile.limits.maximumDirectoryEntries
      )) {
        if (!allowedNames.has(entry.name)) {
          const result = quarantineCandidate(
            path.join(directory, entry.name),
            "unknown_entry"
          );
          if (result !== null) newQuarantines.push(result);
        }
      }
    };
    scanUnknownContainer(root, new Set(["durability", "plans", "projections", "quarantine"]));
    scanUnknownContainer(layout.plans, new Set(["sha256"]));
    scanUnknownContainer(layout.projections, new Set(["sha256"]));

    let pendingTemporaryCount = 0;
    const scanDigestRoot = (kind, shaRoot, candidate) => {
      const result = new Map();
      for (const prefixEntry of scanEntries(
        shaRoot,
        parsedProfile.limits.maximumDirectoryEntries
      )) {
        const prefixPath = path.join(shaRoot, prefixEntry.name);
        if (!prefixPattern.test(prefixEntry.name) || !prefixEntry.isDirectory() ||
            prefixEntry.isSymbolicLink()) {
          const quarantine = quarantineCandidate(prefixPath, "unknown_entry");
          if (quarantine !== null) newQuarantines.push(quarantine);
          continue;
        }
        for (const entry of scanEntries(
          prefixPath,
          parsedProfile.limits.maximumDirectoryEntries
        )) {
          const filePath = path.join(prefixPath, entry.name);
          const temporaryMatch = temporaryPattern.exec(entry.name);
          if (temporaryMatch) {
            const target = path.join(prefixPath, `${temporaryMatch[1]}.json`);
            const state = fileOps.inspectIncompleteTemporary(
              filePath,
              target,
              parsedProfile.concurrency.minimumIncompleteTemporaryAgeMs
            );
            if (state === "missing") continue;
            if (state === "invalid") {
              const quarantine = quarantineCandidate(filePath, "unknown_entry");
              if (quarantine !== null) newQuarantines.push(quarantine);
            } else if (state === "quarantine") {
              const quarantine = quarantineCandidate(filePath, "incomplete_temporary");
              if (quarantine !== null) newQuarantines.push(quarantine);
            } else {
              pendingTemporaryCount += 1;
            }
            continue;
          }
          const digestMatch = digestFilePattern.exec(entry.name);
          if (!digestMatch || !entry.isFile() || entry.isSymbolicLink()) {
            const quarantine = quarantineCandidate(filePath, "unknown_entry");
            if (quarantine !== null) newQuarantines.push(quarantine);
            continue;
          }
          let activation;
          let metadata;
          try {
            activation = fileOps.activateBytes(filePath, maximumBytesByKind.get(kind));
            metadata = candidate(activation.bytes);
          } catch (error) {
            const reasonCode = error?.code === "campaign_artifact_durability_receipt_missing"
              ? "durability_receipt_missing"
              : error?.code === "campaign_artifact_target_readback_mismatch"
                ? "durability_target_mismatch"
                : error?.code === "campaign_artifact_parent_plan_missing"
                  ? "missing_plan"
                  : kind === "plan" ? "invalid_plan" : "invalid_projection";
            const quarantine = quarantineCandidate(filePath, reasonCode, digestMatch[1]);
            if (quarantine !== null) newQuarantines.push(quarantine);
            continue;
          }
          const digest = metadata.artifactSha256;
          if (digest !== digestMatch[1] || digest.slice(0, 2) !== prefixEntry.name) {
            const quarantine = quarantineCandidate(filePath, "path_identity_mismatch", digest);
            if (quarantine !== null) newQuarantines.push(quarantine);
            continue;
          }
          result.set(digest, Object.freeze({
            ...metadata,
            durability: activation.durability,
            relativePath: campaignArtifactRelativePath(kind, digest)
          }));
          const maximumActive = kind === "plan"
            ? parsedProfile.limits.maximumActivePlans
            : parsedProfile.limits.maximumActiveProjections;
          if (result.size > maximumActive) {
            failEvidence("campaign_artifact_store_active_limit", "campaign-artifact-scan");
          }
        }
      }
      return result;
    };

    const planCandidates = scanDigestRoot("plan", layout.planShaRoot, (bytes) => {
      const plan = validateCampaignPlanBytes(bytes);
      return {
        artifactSha256: plan.planSha256,
        campaignId: plan.plan.campaignId,
        planId: plan.plan.planId
      };
    });
    activePlans = planCandidates;
    const projectionCandidates = scanDigestRoot(
      "projection-result",
      layout.projectionShaRoot,
      (bytes) => {
        const campaignPlanSha256 = inspectCampaignProjectionResultPlanSha256(bytes);
        const planMetadata = planCandidates.get(campaignPlanSha256);
        if (!planMetadata) {
          failEvidence("campaign_artifact_parent_plan_missing", "campaign-artifact-scan");
        }
        const plan = readPlanFromMetadata(campaignPlanSha256, planMetadata);
        const projection = validateCampaignProjectionResultBytes(bytes, plan.bytes);
        return {
          artifactSha256: projection.resultSha256,
          campaignPlanSha256,
          verificationTimeUtc: projection.result.verificationTimeUtc
        };
      }
    );
    activeProjections = projectionCandidates;
    return immutableRecord({
      activePlanSha256s: [...activePlans.keys()].sort(),
      activeProjectionSha256s: [...activeProjections.keys()].sort(),
      durabilityIndex,
      directoryMetadata: {
        plans: fileOps.syncDirectory(layout.planShaRoot),
        projections: fileOps.syncDirectory(layout.projectionShaRoot)
      },
      existingQuarantineEntries,
      newQuarantines,
      pendingTemporaryCount,
      scannedEntryCount: totalScanEntries
    });
  }

  const startup = rebuild();

  function putPlan(input) {
    const plan = validateCampaignPlanBytes(input);
    const digest = plan.planSha256;
    if (!activePlans.has(digest) &&
        activePlans.size >= parsedProfile.limits.maximumActivePlans) {
      failEvidence("campaign_artifact_store_active_limit", "campaign-artifact-persist");
    }
    const relativePath = campaignArtifactRelativePath("plan", digest);
    const persistence = fileOps.publishBytes(
      artifactPath("plan", digest),
      plan.bytes,
      maximumBytesByKind.get("plan")
    );
    activePlans.set(digest, Object.freeze({
      artifactSha256: digest,
      campaignId: plan.plan.campaignId,
      durability: persistence.durability,
      planId: plan.plan.planId,
      relativePath
    }));
    return immutableRecord({
      artifactSha256: digest,
      disposition: persistence.disposition,
      durability: persistence.durability,
      kind: "plan",
      relativePath
    });
  }

  function putProjection(input) {
    const campaignPlanSha256 = inspectCampaignProjectionResultPlanSha256(input);
    if (!activePlans.has(campaignPlanSha256)) {
      failEvidence("campaign_artifact_parent_plan_missing", "campaign-artifact-persist");
    }
    let plan;
    try {
      plan = readPlan(campaignPlanSha256);
    } catch (error) {
      throw new VnextEvidenceError(
        "campaign_artifact_parent_plan_invalid",
        "campaign-artifact-persist",
        error?.code
      );
    }
    const projection = validateCampaignProjectionResultBytes(input, plan.bytes);
    const digest = projection.resultSha256;
    if (!activeProjections.has(digest) &&
        activeProjections.size >= parsedProfile.limits.maximumActiveProjections) {
      failEvidence("campaign_artifact_store_active_limit", "campaign-artifact-persist");
    }
    const target = artifactPath("projection-result", digest);
    const relativePath = campaignArtifactRelativePath("projection-result", digest);
    const persistence = fileOps.publishBytes(
      target,
      projection.resultBytes,
      maximumBytesByKind.get("projection-result")
    );
    try {
      readPlan(campaignPlanSha256);
    } catch (error) {
      try {
        rebuild();
      } catch (rebuildError) {
        throw new VnextEvidenceError(
          "campaign_artifact_parent_reconciliation_failed",
          "campaign-artifact-persist",
          rebuildError?.code
        );
      }
      throw new VnextEvidenceError(
        "campaign_artifact_parent_plan_invalid",
        "campaign-artifact-persist",
        error?.code
      );
    }
    activeProjections.set(digest, Object.freeze({
      artifactSha256: digest,
      campaignPlanSha256,
      durability: persistence.durability,
      relativePath,
      verificationTimeUtc: projection.result.verificationTimeUtc
    }));
    return immutableRecord({
      artifactSha256: digest,
      disposition: persistence.disposition,
      durability: persistence.durability,
      kind: "projection-result",
      relativePath
    });
  }

  function resumeProjection(input) {
    const projection = projectVnextCampaign(input);
    const persistence = putProjection(projection.resultBytes);
    return Object.freeze({ persistence, projection });
  }

  return Object.freeze({
    profileId: parsedProfile.profileId,
    putPlan,
    putProjection,
    readPlan,
    readProjection,
    rebuild,
    resumeProjection,
    startup
  });
}

module.exports = Object.freeze({
  campaignArtifactRelativePath,
  campaignArtifactStoreProfile,
  campaignArtifactStoreProfileSha256,
  createVnextCampaignArtifactStore
});
