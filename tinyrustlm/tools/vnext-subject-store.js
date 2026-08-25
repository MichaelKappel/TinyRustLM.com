"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");
const {
  identityContractForSchema,
  validateVnextIdentityDocumentBytes
} = require("./vnext-content-identity.js");
const {
  VnextEvidenceError,
  asEvidenceError,
  failEvidence
} = require("./vnext-evidence-error.js");
const {
  createVnextCreateOnlyFiles,
  immutableRecord
} = require("./vnext-create-only-files.js");
const {
  durablePublicationProfile,
  durablePublicationProfileSha256
} = require("./vnext-durable-publication.js");

const profilePath = path.resolve(__dirname,
  "../../contracts/vnext/subject-store-profile.v1.json");
const profileBytes = fs.readFileSync(profilePath);
const subjectStoreProfile = parseStrictJson(profileBytes);
const subjectStoreProfileSha256 = crypto.createHash("sha256")
  .update(profileBytes).digest("hex");
const contractRegistryPath = path.resolve(__dirname,
  "../../contracts/vnext/contract-family.v1.json");
const campaignProjectionProfilePath = path.resolve(__dirname,
  "../../contracts/vnext/campaign-projection-profile.v1.json");
const subjectIdPattern = /^sha256:([a-f0-9]{64})$/u;
const digestFilePattern = /^([a-f0-9]{64})\.json$/u;
const prefixPattern = /^[a-f0-9]{2}$/u;
const temporaryPattern = /^\.([a-f0-9]{64})\.[0-9]{1,20}\.[a-f0-9]{4,64}\.tmp$/u;
const storeOptionNames = Object.freeze([]);
const processGenerationByRoot = new Map();
const expectedAcceptedSchemas = Object.freeze([
  "tinyrustlm.vnext.artifact_manifest.v1",
  "tinyrustlm.vnext.claim.v2",
  "tinyrustlm.vnext.outside_proof.v2",
  "tinyrustlm.vnext.p2p_manifest.v1",
  "tinyrustlm.vnext.release_manifest.v3"
]);
const expectedRejectedSchemas = Object.freeze([
  "tinyrustlm.vnext.context.v1",
  "tinyrustlm.vnext.receipt.v1"
]);
const profileFields = Object.freeze([
  "schema", "profileId", "status", "versionPolicy", "contractRegistrySha256",
  "campaignProjectionProfileId", "campaignProjectionProfileSha256",
  "canonicalJsonProfile", "hashAlgorithm", "identityBasis", "visibility",
  "networkAccess", "sourceMutation", "acceptedSubjects", "rejectedSubjects",
  "layout", "durablePublication", "activeStateAccess", "batch", "concurrency",
  "rebuild", "limits", "resultContract"
]);
const activeStateAccessFields = Object.freeze([
  "startup", "crossInstanceSync", "membershipSnapshot", "documentSnapshot",
  "cachedDocumentRead", "physicalRead", "restartValidation"
]);

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactObject(value, fields, code, step) {
  if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length !== 0) {
    failEvidence(code, step);
  }
  const names = Object.getOwnPropertyNames(value).sort();
  const expected = [...fields].sort();
  if (names.length !== expected.length ||
      names.some((name, index) => name !== expected[index])) {
    failEvidence(code, step);
  }
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence(`${code}_accessor`, step);
    }
  }
  return value;
}

function exactArray(value, maximum, code, step) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
      value.length > maximum || Object.getOwnPropertySymbols(value).length !== 0 ||
      Object.getOwnPropertyNames(value).length !== value.length + 1) {
    failEvidence(code, step);
  }
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence(`${code}_accessor`, step);
    }
  }
  return value;
}

function sameStrings(left, right) {
  return left.length === right.length &&
    left.every((entry, index) => entry === right[index]);
}

function validateInstalledProfile() {
  const step = "subject-store-profile";
  exactObject(subjectStoreProfile, profileFields, "subject_store_profile_invalid", step);
  const accepted = exactArray(subjectStoreProfile.acceptedSubjects, 5,
    "subject_store_profile_invalid", step);
  const rejected = exactArray(subjectStoreProfile.rejectedSubjects, 2,
    "subject_store_profile_invalid", step);
  for (const entry of accepted) {
    exactObject(entry, ["schema", "maximumBytes"],
      "subject_store_profile_invalid", step);
  }
  for (const entry of rejected) {
    exactObject(entry, ["schema", "reason"], "subject_store_profile_invalid", step);
  }
  exactObject(subjectStoreProfile.layout,
    ["subjectPattern", "temporaryPattern", "quarantineRoot", "pathLinkPolicy",
      "replacementPolicy", "mutablePointerPolicy"],
    "subject_store_profile_invalid", step);
  exactObject(subjectStoreProfile.durablePublication,
    ["profileId", "profileSha256", "targetActivation", "directoryFlush", "restart",
      "targetWithoutReceipt", "receiptWithoutTarget", "callerSuppliedSuccess"],
    "subject_store_profile_invalid", step);
  exactObject(subjectStoreProfile.activeStateAccess, activeStateAccessFields,
    "subject_store_profile_invalid", step);
  exactObject(subjectStoreProfile.batch,
    ["minimumEntries", "maximumEntries", "inputOrdering", "duplicateSubjectIds",
      "preflight", "publication", "activation", "partialResult"],
    "subject_store_profile_invalid", step);
  exactObject(subjectStoreProfile.concurrency,
    ["createWriters", "freshTemporaryPolicy", "minimumIncompleteTemporaryAgeMs",
      "publishedHardLinkTemporaryPolicy", "rebuildInterferencePolicy"],
    "subject_store_profile_invalid", step);
  exactObject(subjectStoreProfile.rebuild,
    ["unknownEntryPolicy", "incompleteTemporaryPolicy", "invalidSubjectPolicy",
      "unacceptedSchemaPolicy", "identityPathMismatchPolicy",
      "preserveUnrelatedValidSubjects"], "subject_store_profile_invalid", step);
  exactObject(subjectStoreProfile.limits,
    ["maximumActiveSubjects", "maximumTotalSubjectBytes",
      "maximumQuarantineEntries", "maximumDirectoryEntries", "maximumScanEntries",
      "maximumQuarantineReasonCodeLength", "streamBufferBytes"],
    "subject_store_profile_invalid", step);
  exactObject(subjectStoreProfile.resultContract,
    ["absolutePathsReturned", "rawHostErrorsReturned", "rawInvalidBytesReturned",
      "durabilityReceiptResultReturned", "boundedErrorCodesOnly"],
    "subject_store_profile_invalid", step);

  const acceptedSchemas = accepted.map((entry) => entry.schema);
  const rejectedSchemas = rejected.map((entry) => entry.schema);
  const limitValues = Object.values(subjectStoreProfile.limits);
  const registrySha256 = sha256(fs.readFileSync(contractRegistryPath));
  const projectionProfileSha256 = sha256(fs.readFileSync(campaignProjectionProfilePath));
  if (subjectStoreProfile.schema !== "tinyrustlm.vnext.subject_store_profile.v1" ||
      subjectStoreProfile.profileId !== "tinyrustlm.vnext.subject-store.v1" ||
      subjectStoreProfile.status !== "frozen" ||
      subjectStoreProfile.versionPolicy !==
        "single-current-profile-no-compatibility-reader" ||
      subjectStoreProfile.contractRegistrySha256 !== registrySha256 ||
      subjectStoreProfile.campaignProjectionProfileId !==
        "tinyrustlm.vnext.campaign-projection.v1" ||
      subjectStoreProfile.campaignProjectionProfileSha256 !== projectionProfileSha256 ||
      subjectStoreProfile.canonicalJsonProfile !==
        "rfc8785-jcs+tinyrustlm.strict-json.v1" ||
      subjectStoreProfile.hashAlgorithm !== "sha256" ||
      subjectStoreProfile.identityBasis !==
        "validated-subject-id-and-exact-canonical-wire-bytes" ||
      subjectStoreProfile.visibility !== "public-safe-only" ||
      subjectStoreProfile.networkAccess !== "forbidden" ||
      subjectStoreProfile.sourceMutation !== "forbidden" ||
      !sameStrings(acceptedSchemas, expectedAcceptedSchemas) ||
      !sameStrings(rejectedSchemas, expectedRejectedSchemas) ||
      rejected[0].reason !== "private-subject-forbidden" ||
      rejected[1].reason !== "receipt-store-owned" ||
      subjectStoreProfile.layout.subjectPattern !==
        "subjects/sha256/{subject-id-digest-prefix-2}/{subject-id-digest}.json" ||
      subjectStoreProfile.layout.temporaryPattern !==
        ".{subject-id-digest}.{pid}.{nonce}.tmp" ||
      subjectStoreProfile.layout.quarantineRoot !== "quarantine" ||
      subjectStoreProfile.layout.pathLinkPolicy !==
        "reject-symbolic-link-or-reparse-point" ||
      subjectStoreProfile.layout.mutablePointerPolicy !== "forbidden" ||
      subjectStoreProfile.layout.replacementPolicy !== "never" ||
      subjectStoreProfile.durablePublication.profileId !==
        durablePublicationProfile.profileId ||
      subjectStoreProfile.durablePublication.profileSha256 !==
        durablePublicationProfileSha256 ||
      subjectStoreProfile.durablePublication.targetActivation !==
        "matching-content-addressed-durability-receipt-required" ||
      subjectStoreProfile.durablePublication.directoryFlush !==
        "verified-rust-helper-required" ||
      subjectStoreProfile.durablePublication.callerSuppliedSuccess !== "forbidden" ||
      subjectStoreProfile.activeStateAccess.startup !==
        "one-full-validated-rebuild-per-store-open" ||
      subjectStoreProfile.activeStateAccess.crossInstanceSync !==
        "same-process-same-root-generation-only-registry-rebuilds-before-access" ||
      subjectStoreProfile.activeStateAccess.membershipSnapshot !==
        "immutable-active-ids-and-total-bytes-no-filesystem-scan" ||
      subjectStoreProfile.activeStateAccess.documentSnapshot !==
        "immutable-validated-documents-with-defensive-byte-copies-no-filesystem-scan" ||
      subjectStoreProfile.activeStateAccess.cachedDocumentRead !==
        "active-membership-required-validated-owned-copy-no-filesystem-read" ||
      subjectStoreProfile.activeStateAccess.physicalRead !==
        "target-and-durability-receipt-read-twice-exact-bytes-hash-and-subject-validation" ||
      subjectStoreProfile.activeStateAccess.restartValidation !==
        "fresh-store-open-full-rebuild-with-verified-directory-flush-readback" ||
      subjectStoreProfile.batch.minimumEntries !== 1 ||
      subjectStoreProfile.batch.maximumEntries !==
        durablePublicationProfile.batch.maximumEntries ||
      subjectStoreProfile.batch.inputOrdering !==
        "subject-id-utf8-bytewise-ascending" ||
      subjectStoreProfile.batch.duplicateSubjectIds !== "forbidden" ||
      subjectStoreProfile.batch.preflight !== "complete-before-publication" ||
      subjectStoreProfile.batch.publication !== "one-durable-publish-many-call" ||
      subjectStoreProfile.batch.activation !==
        "all-published-before-any-in-memory-activation" ||
      subjectStoreProfile.batch.partialResult !== "forbidden" ||
      subjectStoreProfile.concurrency.createWriters !==
        "multi-process-idempotent-hard-link" ||
      subjectStoreProfile.concurrency.freshTemporaryPolicy !==
        "leave-pending-without-mutation" ||
      subjectStoreProfile.concurrency.minimumIncompleteTemporaryAgeMs !== 300000 ||
      subjectStoreProfile.concurrency.publishedHardLinkTemporaryPolicy !==
        "quarantine-same-inode-link" ||
      subjectStoreProfile.concurrency.rebuildInterferencePolicy !==
        "fail-closed-and-retry" ||
      subjectStoreProfile.rebuild.unknownEntryPolicy !== "quarantine" ||
      subjectStoreProfile.rebuild.incompleteTemporaryPolicy !==
        "quarantine-after-minimum-age" ||
      subjectStoreProfile.rebuild.invalidSubjectPolicy !== "quarantine" ||
      subjectStoreProfile.rebuild.unacceptedSchemaPolicy !== "quarantine" ||
      subjectStoreProfile.rebuild.identityPathMismatchPolicy !== "quarantine" ||
      subjectStoreProfile.rebuild.preserveUnrelatedValidSubjects !== true ||
      subjectStoreProfile.limits.maximumActiveSubjects !== 2048 ||
      subjectStoreProfile.limits.maximumTotalSubjectBytes !== 67108864 ||
      subjectStoreProfile.limits.maximumQuarantineEntries !== 65536 ||
      subjectStoreProfile.limits.maximumDirectoryEntries !== 66000 ||
      subjectStoreProfile.limits.maximumScanEntries !== 262144 ||
      subjectStoreProfile.limits.maximumQuarantineReasonCodeLength !== 80 ||
      subjectStoreProfile.limits.streamBufferBytes !== 65536 ||
      subjectStoreProfile.resultContract.absolutePathsReturned !== false ||
      subjectStoreProfile.resultContract.rawHostErrorsReturned !== false ||
      subjectStoreProfile.resultContract.rawInvalidBytesReturned !== false ||
      subjectStoreProfile.resultContract.durabilityReceiptResultReturned !== true ||
      subjectStoreProfile.resultContract.boundedErrorCodesOnly !== true ||
      !limitValues.every((entry) => Number.isSafeInteger(entry) && entry > 0)) {
    failEvidence("subject_store_profile_invalid", step);
  }
  for (const entry of accepted) {
    const descriptor = identityContractForSchema(entry.schema);
    if (!Number.isSafeInteger(entry.maximumBytes) || entry.maximumBytes <= 0 ||
        entry.maximumBytes !== descriptor.maximumBytes) {
      failEvidence("subject_store_profile_invalid", step);
    }
  }
}

validateInstalledProfile();

const frozenSubjectStoreProfile = immutableRecord({ ...subjectStoreProfile });
const acceptedMaximumBytes = new Map(subjectStoreProfile.acceptedSubjects
  .map((entry) => [entry.schema, entry.maximumBytes]));
const maximumSingleSubjectBytes = Math.max(...acceptedMaximumBytes.values());

function exactOptions(options) {
  if (!isPlainObject(options) || Object.getOwnPropertySymbols(options).length !== 0) {
    failEvidence("subject_store_options_invalid", "subject-store-open");
  }
  const names = Object.getOwnPropertyNames(options);
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(options, name);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence("subject_store_option_accessor", "subject-store-open");
    }
    if (!storeOptionNames.includes(name)) {
      failEvidence("subject_store_option_unknown", "subject-store-open");
    }
  }
  return Object.freeze(Object.fromEntries(names.map((name) =>
    [name, Object.getOwnPropertyDescriptor(options, name).value])));
}

function normalizeSubjectId(subjectId) {
  if (typeof subjectId !== "string") {
    failEvidence("subject_id_invalid", "subject-store-path");
  }
  const match = subjectIdPattern.exec(subjectId);
  if (!match) failEvidence("subject_id_invalid", "subject-store-path");
  return Object.freeze({ subjectId, digest: match[1] });
}

function subjectRelativePath(subjectId) {
  const { digest } = normalizeSubjectId(subjectId);
  return `subjects/sha256/${digest.slice(0, 2)}/${digest}.json`;
}

function validateAcceptedSubjectBytes(input) {
  const subject = validateVnextIdentityDocumentBytes(input);
  const maximumBytes = acceptedMaximumBytes.get(subject.schema);
  if (maximumBytes === undefined) {
    failEvidence("subject_schema_not_allowed", "subject-store-read");
  }
  if (subject.bytes.length > maximumBytes) {
    failEvidence("subject_byte_limit", "subject-store-read");
  }
  return subject;
}

function createVnextSubjectStore(rootInput, options = {}) {
  exactOptions(options);
  const fileOps = createVnextCreateOnlyFiles({
    codePrefix: "subject",
    root: rootInput,
    steps: {
      open: "subject-store-open",
      path: "subject-store-path",
      persist: "subject-store-persist",
      quarantine: "subject-store-quarantine",
      read: "subject-store-read",
      scan: "subject-store-scan"
    },
    storeProfileId: subjectStoreProfile.profileId,
    storeProfileSha256: subjectStoreProfileSha256,
    streamBufferBytes: subjectStoreProfile.limits.streamBufferBytes
  });
  const root = fileOps.normalizeRoot(rootInput);
  for (const registeredRoot of processGenerationByRoot.keys()) {
    if (!fs.existsSync(registeredRoot)) processGenerationByRoot.delete(registeredRoot);
  }
  if (!processGenerationByRoot.has(root)) processGenerationByRoot.set(root, 0);

  function ensureLayout() {
    fileOps.ensureRoot(root);
    const subjects = fileOps.safeChild(root, ["subjects"]);
    const shaRoot = fileOps.safeChild(root, ["subjects", "sha256"]);
    const quarantine = fileOps.safeChild(root, ["quarantine"]);
    fileOps.ensureDirectory(subjects);
    fileOps.ensureDirectory(shaRoot);
    fileOps.ensureDirectory(quarantine);
    return Object.freeze({ subjects, shaRoot, quarantine });
  }

  let layout = ensureLayout();
  let active = new Map();
  let activeTotalBytes = 0;
  let activeSnapshot = null;
  let activeDocumentSnapshot = null;
  let observedProcessGeneration = processGenerationByRoot.get(root);
  let putManyDepth = 0;
  const operationCounter = {
    fullRebuilds: 0,
    fullRebuildsInsidePutMany: 0,
    publishedEntries: 0,
    putCalls: 0,
    putManyCalls: 0,
    snapshotReads: 0,
    snapshotRevision: 0
  };

  function refreshSnapshot() {
    operationCounter.snapshotRevision += 1;
    const activeSubjectIds = [...active.keys()].sort();
    activeSnapshot = immutableRecord({
      activeSubjectIds,
      activeTotalBytes,
      snapshotRevision: operationCounter.snapshotRevision
    });
    activeDocumentSnapshot = Object.freeze({
      activeSubjectIds: activeSnapshot.activeSubjectIds,
      activeTotalBytes,
      documents: Object.freeze(activeSubjectIds.map((subjectId) =>
        active.get(subjectId).validated)),
      snapshotRevision: operationCounter.snapshotRevision
    });
  }

  function currentProcessGeneration() {
    const generation = processGenerationByRoot.get(root);
    if (!Number.isSafeInteger(generation) || generation < 0) {
      failEvidence("subject_store_process_generation_invalid", "subject-store-open");
    }
    return generation;
  }

  function advanceProcessGeneration(expectedGeneration) {
    if (currentProcessGeneration() !== expectedGeneration ||
        expectedGeneration >= Number.MAX_SAFE_INTEGER) {
      failEvidence("subject_store_rebuild_interference", "subject-store-scan");
    }
    observedProcessGeneration = expectedGeneration + 1;
    processGenerationByRoot.set(root, observedProcessGeneration);
  }

  function snapshot() {
    synchronizeProcessState();
    operationCounter.snapshotReads += 1;
    return activeSnapshot;
  }

  function documentSnapshot() {
    synchronizeProcessState();
    operationCounter.snapshotReads += 1;
    return activeDocumentSnapshot;
  }

  function operationCounts() {
    return immutableRecord({
      fullRebuilds: operationCounter.fullRebuilds,
      fullRebuildsInsidePutMany: operationCounter.fullRebuildsInsidePutMany,
      publishedEntries: operationCounter.publishedEntries,
      putCalls: operationCounter.putCalls,
      putManyCalls: operationCounter.putManyCalls,
      snapshotFilesystemScans: 0,
      snapshotReads: operationCounter.snapshotReads,
      snapshotRevision: operationCounter.snapshotRevision
    });
  }

  function rebuildInternal(notifyOtherInstances) {
    const startingProcessGeneration = currentProcessGeneration();
    operationCounter.fullRebuilds += 1;
    if (putManyDepth !== 0) operationCounter.fullRebuildsInsidePutMany += 1;
    layout = ensureLayout();
    const durabilityIndex = fileOps.rebuildDurabilityIndex();
    let rebuiltTotalBytes = 0;
    let scannedEntryCount = 0;
    const scan = (directory, maximum) => {
      const entries = fileOps.boundedDirectoryEntries(directory, maximum);
      scannedEntryCount += entries.length;
      if (!Number.isSafeInteger(scannedEntryCount) ||
          scannedEntryCount > subjectStoreProfile.limits.maximumScanEntries) {
        failEvidence("subject_store_total_scan_limit", "subject-store-scan");
      }
      return entries;
    };
    const existingQuarantineEntries = scan(
      layout.quarantine,
      subjectStoreProfile.limits.maximumQuarantineEntries
    ).length;
    let quarantineCount = existingQuarantineEntries;
    const newQuarantines = [];
    const quarantine = (source, reasonCode, subjectId = null) => {
      if (quarantineCount >= subjectStoreProfile.limits.maximumQuarantineEntries) {
        failEvidence("subject_store_quarantine_limit", "subject-store-quarantine");
      }
      const result = fileOps.quarantineEntry(
        root,
        layout.quarantine,
        source,
        reasonCode,
        "subjectId",
        subjectId
      );
      if (result !== null) {
        quarantineCount += 1;
        newQuarantines.push(result);
      }
    };
    const scanUnknown = (directory, allowed) => {
      for (const entry of scan(directory,
        subjectStoreProfile.limits.maximumDirectoryEntries)) {
        if (!allowed.has(entry.name)) quarantine(path.join(directory, entry.name),
          "unknown_entry");
      }
    };
    scanUnknown(root, new Set(["durability", "quarantine", "subjects"]));
    scanUnknown(layout.subjects, new Set(["sha256"]));

    const candidates = new Map();
    const preparedCandidates = [];
    const preparedSubjectIds = new Set();
    let pendingTemporaryCount = 0;
    const prefixes = scan(layout.shaRoot,
      subjectStoreProfile.limits.maximumDirectoryEntries);
    for (const prefixEntry of prefixes) {
      const prefixPath = path.join(layout.shaRoot, prefixEntry.name);
      if (!prefixPattern.test(prefixEntry.name) || !prefixEntry.isDirectory() ||
          prefixEntry.isSymbolicLink()) {
        quarantine(prefixPath, "unknown_entry");
        continue;
      }
      for (const entry of scan(prefixPath,
        subjectStoreProfile.limits.maximumDirectoryEntries)) {
        const filePath = path.join(prefixPath, entry.name);
        const temporaryMatch = temporaryPattern.exec(entry.name);
        if (temporaryMatch) {
          const target = path.join(prefixPath, `${temporaryMatch[1]}.json`);
          const state = fileOps.inspectIncompleteTemporary(
            filePath,
            target,
            subjectStoreProfile.concurrency.minimumIncompleteTemporaryAgeMs
          );
          if (state === "missing") continue;
          if (state === "pending") {
            pendingTemporaryCount += 1;
          } else {
            quarantine(filePath, state === "invalid" ? "unknown_entry" :
              "incomplete_temporary");
          }
          continue;
        }
        const digestMatch = digestFilePattern.exec(entry.name);
        if (!digestMatch || !entry.isFile() || entry.isSymbolicLink()) {
          quarantine(filePath, "unknown_entry");
          continue;
        }
        let activationTicket;
        let subject;
        try {
          activationTicket = fileOps.prepareActivation(
            filePath,
            maximumSingleSubjectBytes
          );
          subject = validateAcceptedSubjectBytes(activationTicket.bytes);
        } catch (error) {
          const reasonCode = error?.code === "subject_durability_receipt_missing"
            ? "durability_receipt_missing"
            : error?.code === "subject_target_readback_mismatch"
              ? "durability_target_mismatch"
              : error?.code === "subject_schema_not_allowed"
                ? "schema_not_allowed"
                : "invalid_subject";
          quarantine(filePath, reasonCode);
          continue;
        }
        const { digest } = normalizeSubjectId(subject.subjectId);
        if (digest !== digestMatch[1] || digest.slice(0, 2) !== prefixEntry.name) {
          quarantine(filePath, "path_identity_mismatch", subject.subjectId);
          continue;
        }
        if (preparedSubjectIds.has(subject.subjectId)) {
          quarantine(filePath, "duplicate_subject", subject.subjectId);
          continue;
        }
        const byteLength = subject.bytes.length;
        preparedSubjectIds.add(subject.subjectId);
        preparedCandidates.push(Object.freeze({
          activationTicket,
          byteLength,
          canonicalContentSha256: subject.canonicalContentSha256,
          relativePath: subjectRelativePath(subject.subjectId),
          schema: subject.schema,
          subjectId: subject.subjectId,
          validated: subject
        }));
        rebuiltTotalBytes += byteLength;
        if (preparedCandidates.length > subjectStoreProfile.limits.maximumActiveSubjects) {
          failEvidence("subject_store_active_limit", "subject-store-scan");
        }
        if (!Number.isSafeInteger(rebuiltTotalBytes) ||
            rebuiltTotalBytes > subjectStoreProfile.limits.maximumTotalSubjectBytes) {
          failEvidence("subject_store_total_byte_limit", "subject-store-scan");
        }
      }
    }
    for (let offset = 0; offset < preparedCandidates.length;
      offset += subjectStoreProfile.batch.maximumEntries) {
      const batch = preparedCandidates.slice(
        offset,
        offset + subjectStoreProfile.batch.maximumEntries
      );
      const activations = fileOps.activatePreparedMany(
        batch.map((candidate) => candidate.activationTicket)
      );
      if (activations.length !== batch.length) {
        failEvidence("subject_store_rebuild_interference", "subject-store-scan");
      }
      for (let index = 0; index < batch.length; index += 1) {
        const prepared = batch[index];
        const activation = activations[index];
        const subject = validateAcceptedSubjectBytes(activation.bytes);
        if (subject.subjectId !== prepared.subjectId ||
            !subject.bytes.equals(prepared.validated.bytes)) {
          failEvidence("subject_store_rebuild_interference", "subject-store-scan");
        }
        candidates.set(subject.subjectId, Object.freeze({
          byteLength: prepared.byteLength,
          canonicalContentSha256: prepared.canonicalContentSha256,
          durability: activation.durability,
          relativePath: prepared.relativePath,
          schema: prepared.schema,
          validated: subject
        }));
      }
    }
    if (currentProcessGeneration() !== startingProcessGeneration) {
      failEvidence("subject_store_rebuild_interference", "subject-store-scan");
    }
    active = candidates;
    activeTotalBytes = rebuiltTotalBytes;
    if (notifyOtherInstances) {
      advanceProcessGeneration(startingProcessGeneration);
    } else {
      observedProcessGeneration = startingProcessGeneration;
    }
    refreshSnapshot();
    return immutableRecord({
      activeSubjectIds: [...active.keys()].sort(),
      activeTotalBytes,
      durabilityIndex,
      directoryMetadata: fileOps.syncDirectory(layout.shaRoot),
      existingQuarantineEntries,
      newQuarantines,
      pendingTemporaryCount,
      scannedEntryCount
    });
  }

  function rebuild() {
    return rebuildInternal(true);
  }

  function synchronizeProcessState() {
    if (currentProcessGeneration() === observedProcessGeneration) return;
    rebuildInternal(false);
  }

  const startup = rebuild();

  function verifyActiveBytes(filePath, metadata) {
    fileOps.assertNoLinkComponents(path.dirname(filePath), true);
    const expected = metadata.validated.bytes;
    const durabilityPath = path.join(
      root,
      ...metadata.durability.durabilityReceiptRelativePath.split("/")
    );
    fileOps.assertNoLinkComponents(path.dirname(durabilityPath), true);
    const firstTarget = fileOps.boundedReadFile(filePath, maximumSingleSubjectBytes);
    const firstDurability = fileOps.boundedReadFile(
      durabilityPath,
      durablePublicationProfile.limits.maximumReceiptBytes
    );
    const secondTarget = fileOps.boundedReadFile(filePath, maximumSingleSubjectBytes);
    const secondDurability = fileOps.boundedReadFile(
      durabilityPath,
      durablePublicationProfile.limits.maximumReceiptBytes
    );
    if (!firstTarget.equals(expected) || !secondTarget.equals(expected) ||
        !firstDurability.equals(secondDurability) ||
        sha256(firstDurability) !== metadata.durability.durabilityReceiptSha256) {
      failEvidence("subject_active_readback_mismatch", "subject-store-read");
    }
    return secondTarget;
  }

  function read(subjectIdInput) {
    synchronizeProcessState();
    const { subjectId } = normalizeSubjectId(subjectIdInput);
    const metadata = active.get(subjectId);
    if (!metadata) failEvidence("subject_not_active", "subject-store-read");
    const filePath = path.join(root, ...metadata.relativePath.split("/"));
    fileOps.assertNoLinkComponents(path.dirname(filePath), true);
    let activation;
    let subject;
    try {
      activation = verifyActiveBytes(filePath, metadata);
      subject = validateAcceptedSubjectBytes(activation);
    } catch (error) {
      throw new VnextEvidenceError(
        "subject_active_read_failed",
        "subject-store-read",
        error?.code
      );
    }
    if (subject.subjectId !== subjectId || subject.schema !== metadata.schema ||
        subject.canonicalContentSha256 !== metadata.canonicalContentSha256 ||
        subject.bytes.length !== metadata.byteLength) {
      failEvidence("subject_active_identity_changed", "subject-store-read");
    }
    return Object.freeze({
      ...subject,
      durability: metadata.durability
    });
  }

  function readDocument(subjectIdInput) {
    synchronizeProcessState();
    const { subjectId } = normalizeSubjectId(subjectIdInput);
    const metadata = active.get(subjectId);
    if (!metadata) failEvidence("subject_not_active", "subject-store-read");
    return metadata.validated;
  }

  function persistMany(input) {
    const values = exactArray(input, subjectStoreProfile.batch.maximumEntries,
      "subject_batch_invalid", "subject-store-persist");
    if (values.length < subjectStoreProfile.batch.minimumEntries) {
      failEvidence("subject_batch_invalid", "subject-store-persist");
    }
    const pending = new Map();
    for (const value of values) {
      const subject = validateAcceptedSubjectBytes(value);
      if (pending.has(subject.subjectId)) {
        failEvidence("subject_batch_duplicate_id", "subject-store-persist");
      }
      pending.set(subject.subjectId, subject);
    }
    const subjects = [...pending.values()].sort((left, right) =>
      left.subjectId < right.subjectId ? -1 : left.subjectId > right.subjectId ? 1 : 0);
    const newSubjects = subjects.filter((subject) => !active.has(subject.subjectId));
    const existingSubjects = subjects.filter((subject) => active.has(subject.subjectId));
    if (active.size + newSubjects.length > subjectStoreProfile.limits.maximumActiveSubjects) {
      failEvidence("subject_store_active_limit", "subject-store-persist");
    }
    const addedBytes = newSubjects.reduce((total, subject) => total + subject.bytes.length, 0);
    if (!Number.isSafeInteger(addedBytes) || activeTotalBytes + addedBytes >
        subjectStoreProfile.limits.maximumTotalSubjectBytes) {
      failEvidence("subject_store_total_byte_limit", "subject-store-persist");
    }

    function validateExistingSubjects() {
      for (const subject of existingSubjects) {
        const metadata = active.get(subject.subjectId);
        if (!metadata.validated.bytes.equals(subject.bytes)) {
          failEvidence("subject_target_conflict", "subject-store-persist");
        }
        const filePath = path.join(root, ...metadata.relativePath.split("/"));
        try {
          verifyActiveBytes(filePath, metadata);
        } catch (error) {
          throw new VnextEvidenceError(
            "subject_active_read_failed",
            "subject-store-persist",
            error?.code
          );
        }
      }
    }

    const publicationByPath = new Map();
    for (const subject of existingSubjects) {
      const metadata = active.get(subject.subjectId);
      publicationByPath.set(metadata.relativePath, Object.freeze({
        disposition: "existing-byte-identical",
        durability: metadata.durability
      }));
    }
    validateExistingSubjects();
    const publications = newSubjects.length === 0 ? [] : fileOps.publishMany(
      newSubjects.map((subject) => ({
        bytes: subject.bytes,
        maximumBytes: acceptedMaximumBytes.get(subject.schema),
        target: path.join(root, ...subjectRelativePath(subject.subjectId).split("/"))
      }))
    );
    for (const publication of publications) {
      const relativePath = publication?.durability?.targetRelativePath;
      if (typeof relativePath !== "string" || publicationByPath.has(relativePath)) {
        failEvidence("subject_batch_publication_invalid", "subject-store-persist");
      }
      publicationByPath.set(relativePath, publication);
    }
    if (publicationByPath.size !== subjects.length || subjects.some((subject) =>
      !publicationByPath.has(subjectRelativePath(subject.subjectId)))) {
      failEvidence("subject_batch_publication_invalid", "subject-store-persist");
    }
    validateExistingSubjects();

    if (currentProcessGeneration() !== observedProcessGeneration) {
      try {
        rebuildInternal(true);
      } catch (error) {
        throw new VnextEvidenceError(
          "subject_store_rebuild_interference",
          "subject-store-persist",
          error?.code
        );
      }
      failEvidence("subject_store_rebuild_interference", "subject-store-persist");
    }
    activeTotalBytes += addedBytes;
    for (const subject of subjects) {
      const relativePath = subjectRelativePath(subject.subjectId);
      const publication = publicationByPath.get(relativePath);
      active.set(subject.subjectId, Object.freeze({
        byteLength: subject.bytes.length,
        canonicalContentSha256: subject.canonicalContentSha256,
        durability: publication.durability,
        relativePath,
        schema: subject.schema,
        validated: subject
      }));
    }
    operationCounter.publishedEntries += newSubjects.length;
    if (newSubjects.length > 0) {
      advanceProcessGeneration(observedProcessGeneration);
      refreshSnapshot();
    }
    return immutableRecord(subjects.map((subject) => {
      const relativePath = subjectRelativePath(subject.subjectId);
      const publication = publicationByPath.get(relativePath);
      return {
        subjectId: subject.subjectId,
        canonicalContentSha256: subject.canonicalContentSha256,
        disposition: publication.disposition,
        durability: publication.durability,
        relativePath,
        schema: subject.schema
      };
    }));
  }

  function putMany(input) {
    operationCounter.putManyCalls += 1;
    putManyDepth += 1;
    try {
      synchronizeProcessState();
      return persistMany(input);
    } finally {
      putManyDepth -= 1;
    }
  }

  function put(input) {
    operationCounter.putCalls += 1;
    return putMany([input])[0];
  }

  return Object.freeze({
    documentSnapshot,
    operationCounts,
    profileId: subjectStoreProfile.profileId,
    put,
    putMany,
    read,
    readDocument,
    rebuild,
    snapshot,
    startup
  });
}

module.exports = Object.freeze({
  createVnextSubjectStore,
  subjectRelativePath,
  subjectStoreProfile: frozenSubjectStoreProfile,
  subjectStoreProfileSha256,
  validateAcceptedSubjectBytes
});
