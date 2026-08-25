"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");
const {
  VnextEvidenceError,
  asEvidenceError,
  failEvidence
} = require("./vnext-evidence-error.js");
const {
  receiptMaximumBytes,
  receiptSchema,
  validateVnextReceiptBytes
} = require("./vnext-receipt-identity.js");
const {
  createVnextCreateOnlyFiles,
  immutableRecord
} = require("./vnext-create-only-files.js");
const {
  durablePublicationProfile,
  durablePublicationProfileSha256
} = require("./vnext-durable-publication.js");

const profilePath = path.resolve(__dirname, "../../contracts/vnext/receipt-store-profile.v1.json");
const profileBytes = fs.readFileSync(profilePath);
const storeProfile = parseStrictJson(profileBytes);
const storeProfileSha256 = crypto.createHash("sha256").update(profileBytes).digest("hex");
const expectedStoreProfileSha256 =
  "1721e8d26cfd93617ce570a744796c8d95d5fc1fd628ac3ee94f1a484832ade5";
const receiptIdPattern = /^sha256:([a-f0-9]{64})$/u;
const digestFilePattern = /^([a-f0-9]{64})\.json$/u;
const prefixPattern = /^[a-f0-9]{2}$/u;
const temporaryPattern = /^\.([a-f0-9]{64})\.[0-9]{1,20}\.[a-f0-9]{4,64}\.tmp$/u;
const quarantineReasonPattern = /^[a-z][a-z0-9_]{2,79}$/u;
const storeOptionNames = Object.freeze([]);
const receiptBatchFields = Object.freeze([
  "minimumEntries",
  "maximumEntries",
  "inputOrdering",
  "duplicateReceiptIds",
  "parentPolicy",
  "preflight",
  "publication",
  "activation",
  "partialResult"
]);
const receiptProfileFields = Object.freeze([
  "schema", "profileId", "status", "versionPolicy", "contractRegistrySha256",
  "receiptSchema", "canonicalizationProfile", "canonicalizationBase",
  "numberProfile", "strictJsonProfile", "identity", "wire", "layout",
  "durablePublication", "activeStateAccess", "batch", "concurrency", "rebuild",
  "limits", "resultContract"
]);
const activeStateAccessFields = Object.freeze([
  "startup", "crossInstanceSync", "membershipSnapshot", "documentSnapshot",
  "cachedDocumentRead", "physicalRead", "batchPhysicalRead", "restartValidation"
]);
const processGenerationByRoot = new Map();

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

const receiptBatchProfile = dataObjectValues(
  storeProfile.batch,
  receiptBatchFields,
  receiptBatchFields,
  "receipt_store_profile_invalid",
  "store-profile"
);
dataObjectValues(
  storeProfile,
  receiptProfileFields,
  receiptProfileFields,
  "receipt_store_profile_invalid",
  "store-profile"
);
const activeStateAccessProfile = dataObjectValues(
  storeProfile.activeStateAccess,
  activeStateAccessFields,
  activeStateAccessFields,
  "receipt_store_profile_invalid",
  "store-profile"
);

if (storeProfileSha256 !== expectedStoreProfileSha256 ||
    storeProfile.schema !== "tinyrustlm.vnext.receipt_store_profile.v1" ||
    storeProfile.profileId !== "tinyrustlm.vnext.receipt-store.v1" ||
    storeProfile.status !== "frozen" ||
    storeProfile.versionPolicy !== "single-current-profile-no-compatibility-reader" ||
    storeProfile.receiptSchema !== receiptSchema ||
    storeProfile.durablePublication?.profileId !== durablePublicationProfile.profileId ||
    storeProfile.durablePublication?.profileSha256 !== durablePublicationProfileSha256 ||
    storeProfile.durablePublication?.callerSuppliedSuccess !== "forbidden" ||
    receiptBatchProfile.minimumEntries !== 1 ||
    receiptBatchProfile.maximumEntries !== durablePublicationProfile.batch.maximumEntries ||
    receiptBatchProfile.inputOrdering !== "receipt-id-utf8-bytewise-ascending" ||
    receiptBatchProfile.duplicateReceiptIds !== "forbidden" ||
    receiptBatchProfile.parentPolicy !==
      "active-or-same-batch-directed-acyclic-graph" ||
    receiptBatchProfile.preflight !== "complete-before-publication" ||
    receiptBatchProfile.publication !== "one-durable-publish-many-call" ||
    receiptBatchProfile.activation !==
      "all-published-and-parents-revalidated-before-any-in-memory-activation" ||
    receiptBatchProfile.partialResult !== "forbidden" ||
    activeStateAccessProfile.startup !==
      "one-full-validated-rebuild-per-store-open" ||
    activeStateAccessProfile.crossInstanceSync !==
      "same-process-same-root-generation-only-registry-rebuilds-before-access" ||
    activeStateAccessProfile.membershipSnapshot !==
      "immutable-active-ids-no-filesystem-scan" ||
    activeStateAccessProfile.documentSnapshot !==
      "immutable-validated-documents-with-defensive-byte-copies-no-filesystem-scan" ||
    activeStateAccessProfile.cachedDocumentRead !==
      "active-membership-required-validated-owned-copy-no-filesystem-read" ||
    activeStateAccessProfile.physicalRead !==
      "target-and-durability-receipt-read-twice-exact-bytes-hash-and-receipt-validation" ||
    activeStateAccessProfile.batchPhysicalRead !==
      "one-shared-parent-closure-each-target-and-durability-receipt-read-twice-exact-bytes-hash-and-receipt-validation" ||
    activeStateAccessProfile.restartValidation !==
      "fresh-store-open-full-rebuild-with-verified-directory-flush-readback" ||
    Object.hasOwn(storeProfile, "atomicCreate")) {
  failEvidence("receipt_store_profile_invalid", "store-profile");
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function dataObjectValues(value, allowedNames, requiredNames, code, step) {
  if (!isPlainObject(value)) failEvidence(code, step);
  if (Object.getOwnPropertySymbols(value).length !== 0) failEvidence(code, step);
  const names = Object.getOwnPropertyNames(value);
  const allowed = new Set(allowedNames);
  if (names.some((name) => !allowed.has(name)) ||
      requiredNames.some((name) => !names.includes(name))) {
    failEvidence(code, step);
  }
  const result = {};
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence(`${code}_accessor`, step);
    }
    result[name] = descriptor.value;
  }
  return Object.freeze(result);
}

function dataArrayValues(value, code, step) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    failEvidence(code, step);
  }
  const names = Object.getOwnPropertyNames(value);
  if (names.length !== value.length + 1 || !names.includes("length")) {
    failEvidence(code, step);
  }
  const result = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence(`${code}_accessor`, step);
    }
    result.push(descriptor.value);
  }
  return result;
}

function exactOptions(options) {
  if (!isPlainObject(options)) failEvidence("receipt_store_options_invalid", "store-open");
  const names = Object.getOwnPropertyNames(options);
  if (Object.getOwnPropertySymbols(options).length !== 0) {
    failEvidence("receipt_store_option_unknown", "store-open");
  }
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(options, name);
    if (!descriptor || !descriptor.enumerable) {
      failEvidence("receipt_store_option_unknown", "store-open");
    }
    if (!("value" in descriptor)) {
      failEvidence("receipt_store_option_accessor", "store-open");
    }
    if (!storeOptionNames.includes(name)) failEvidence("receipt_store_option_unknown", "store-open");
  }
  return Object.freeze(Object.fromEntries(names.map((name) =>
    [name, Object.getOwnPropertyDescriptor(options, name).value])));
}

function normalizeReceiptId(receiptId) {
  if (typeof receiptId !== "string") failEvidence("receipt_id_invalid", "receipt-path");
  const match = receiptIdPattern.exec(receiptId);
  if (!match) failEvidence("receipt_id_invalid", "receipt-path");
  return Object.freeze({ receiptId, digest: match[1] });
}

function receiptRelativePath(receiptId) {
  const { digest } = normalizeReceiptId(receiptId);
  return `receipts/sha256/${digest.slice(0, 2)}/${digest}.json`;
}

function ensureLayout(fileOps, root) {
  fileOps.ensureRoot(root);
  const receipts = fileOps.safeChild(root, ["receipts"]);
  const shaRoot = fileOps.safeChild(root, ["receipts", "sha256"]);
  const quarantine = fileOps.safeChild(root, ["quarantine"]);
  fileOps.ensureDirectory(receipts);
  fileOps.ensureDirectory(shaRoot);
  fileOps.ensureDirectory(quarantine);
  return Object.freeze({ receipts, shaRoot, quarantine });
}

function collectParentReceiptIds(receipt) {
  if (!isPlainObject(receipt) || receipt.schema !== receiptSchema) {
    failEvidence("receipt_parent_source_invalid", "receipt-graph");
  }
  const parents = new Set();
  const add = (value) => {
    if (value === null || value === undefined) return;
    normalizeReceiptId(value);
    parents.add(value);
  };
  const addAll = (values) => {
    if (!Array.isArray(values)) failEvidence("receipt_parent_source_invalid", "receipt-graph");
    for (const value of values) add(value);
  };
  addAll(receipt.inputReceiptIds);
  addAll(receipt.supersedesReceiptIds);
  add(receipt.attestationReference);
  if (receipt.signatureEnvelope !== null) {
    add(receipt.signatureEnvelope.authorityRegistryReceiptId);
    if (receipt.signatureEnvelope.signedSchema === receiptSchema) {
      add(receipt.signatureEnvelope.signedSubjectId);
    }
  }
  if (receipt.authorityRegistry !== null) {
    add(receipt.authorityRegistry.previousRegistryReceiptId);
  }
  if (receipt.keyRevocation !== null) {
    add(receipt.keyRevocation.authorityRegistryReceiptId);
    add(receipt.keyRevocation.predecessorRegistryReceiptId);
  }
  if (receipt.offlineBundle !== null) {
    addAll(receipt.offlineBundle.receiptIds);
    addAll(receipt.offlineBundle.signatureEnvelopeReceiptIds);
    addAll(receipt.offlineBundle.authorityRegistryReceiptIds);
    addAll(receipt.offlineBundle.revocationReceiptIds);
  }
  return Object.freeze([...parents].sort());
}

function classifyReceiptGraph(records) {
  const recordValues = dataArrayValues(
    records,
    "receipt_graph_records_invalid",
    "receipt-graph"
  );
  if (recordValues.length > storeProfile.limits.maximumActiveReceipts) {
    failEvidence("receipt_graph_size_invalid", "receipt-graph");
  }
  const graph = new Map();
  let edgeCount = 0;
  for (const record of recordValues) {
    const values = dataObjectValues(
      record,
      ["receiptId", "parentReceiptIds"],
      ["receiptId", "parentReceiptIds"],
      "receipt_graph_record_invalid",
      "receipt-graph"
    );
    const { receiptId } = normalizeReceiptId(values.receiptId);
    if (graph.has(receiptId)) failEvidence("receipt_graph_duplicate_id", "receipt-graph");
    const parents = [];
    for (const parent of dataArrayValues(
      values.parentReceiptIds,
      "receipt_graph_parent_array_invalid",
      "receipt-graph"
    )) {
      parents.push(normalizeReceiptId(parent).receiptId);
    }
    if (new Set(parents).size !== parents.length) {
      failEvidence("receipt_graph_duplicate_parent", "receipt-graph");
    }
    edgeCount += parents.length;
    if (!Number.isSafeInteger(edgeCount) || edgeCount > storeProfile.limits.maximumGraphEdges) {
      failEvidence("receipt_graph_edge_limit", "receipt-graph");
    }
    graph.set(receiptId, Object.freeze([...parents].sort()));
  }

  const reasons = new Map();
  for (const [receiptId, parents] of graph) {
    if (parents.some((parent) => !graph.has(parent))) reasons.set(receiptId, "missing_parent");
  }

  const dependents = new Map([...graph.keys()].map((receiptId) => [receiptId, []]));
  for (const [receiptId, parents] of graph) {
    for (const parent of parents) {
      if (dependents.has(parent)) dependents.get(parent).push(receiptId);
    }
  }
  for (const values of dependents.values()) values.sort();

  // Iterative Kosaraju avoids making the configured graph bound a call-stack attack.
  const visited = new Set();
  const finishOrder = [];
  for (const start of [...graph.keys()].sort()) {
    if (visited.has(start)) continue;
    visited.add(start);
    const traversal = [{ receiptId: start, nextParent: 0 }];
    while (traversal.length > 0) {
      const frame = traversal[traversal.length - 1];
      const parents = graph.get(frame.receiptId);
      let descended = false;
      while (frame.nextParent < parents.length) {
        const parent = parents[frame.nextParent];
        frame.nextParent += 1;
        if (!graph.has(parent) || visited.has(parent)) continue;
        visited.add(parent);
        traversal.push({ receiptId: parent, nextParent: 0 });
        descended = true;
        break;
      }
      if (!descended && frame.nextParent >= parents.length) {
        finishOrder.push(frame.receiptId);
        traversal.pop();
      }
    }
  }

  const assigned = new Set();
  for (let index = finishOrder.length - 1; index >= 0; index -= 1) {
    const start = finishOrder[index];
    if (assigned.has(start)) continue;
    const component = [];
    const traversal = [start];
    assigned.add(start);
    while (traversal.length > 0) {
      const receiptId = traversal.pop();
      component.push(receiptId);
      for (const dependent of dependents.get(receiptId)) {
        if (assigned.has(dependent)) continue;
        assigned.add(dependent);
        traversal.push(dependent);
      }
    }
    const cyclic = component.length > 1 || graph.get(component[0]).includes(component[0]);
    if (cyclic) {
      for (const member of component) reasons.set(member, "receipt_cycle");
    }
  }

  const queue = [...reasons.keys()].sort();
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    for (const dependent of dependents.get(queue[cursor]) || []) {
      if (!reasons.has(dependent)) {
        reasons.set(dependent, "invalid_ancestor");
        queue.push(dependent);
      }
    }
  }
  const invalid = [...reasons].sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([receiptId, reasonCode]) => ({ receiptId, reasonCode }));
  const activeReceiptIds = [...graph.keys()].filter((receiptId) => !reasons.has(receiptId)).sort();
  return immutableRecord({ activeReceiptIds, invalid });
}

function createVnextReceiptStore(rootInput, options = {}) {
  exactOptions(options);
  const fileOps = createVnextCreateOnlyFiles({
    codePrefix: "receipt",
    root: rootInput,
    steps: {
      open: "store-open",
      path: "store-path",
      persist: "receipt-persist",
      quarantine: "store-quarantine",
      read: "receipt-read",
      scan: "store-scan"
    },
    storeProfileId: storeProfile.profileId,
    storeProfileSha256,
    streamBufferBytes: storeProfile.limits.streamBufferBytes
  });
  const root = fileOps.normalizeRoot(rootInput);
  for (const registeredRoot of processGenerationByRoot.keys()) {
    if (!fs.existsSync(registeredRoot)) processGenerationByRoot.delete(registeredRoot);
  }
  if (!processGenerationByRoot.has(root)) processGenerationByRoot.set(root, 0);
  const layout = ensureLayout(fileOps, root);
  let active = new Map();
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
    const activeReceiptIds = [...active.keys()].sort();
    activeSnapshot = immutableRecord({
      activeReceiptIds,
      snapshotRevision: operationCounter.snapshotRevision
    });
    activeDocumentSnapshot = Object.freeze({
      activeReceiptIds: activeSnapshot.activeReceiptIds,
      documents: Object.freeze(activeReceiptIds.map((receiptId) =>
        active.get(receiptId).validated)),
      snapshotRevision: operationCounter.snapshotRevision
    });
  }

  function currentProcessGeneration() {
    const generation = processGenerationByRoot.get(root);
    if (!Number.isSafeInteger(generation) || generation < 0) {
      failEvidence("receipt_store_process_generation_invalid", "store-open");
    }
    return generation;
  }

  function advanceProcessGeneration(expectedGeneration) {
    if (currentProcessGeneration() !== expectedGeneration ||
        expectedGeneration >= Number.MAX_SAFE_INTEGER) {
      failEvidence("receipt_store_rebuild_interference", "store-scan");
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

  function quarantineEntry(source, reasonCode, receiptId = null) {
    if (!quarantineReasonPattern.test(reasonCode)) {
      failEvidence("receipt_quarantine_reason_invalid", "store-quarantine");
    }
    return fileOps.quarantineEntry(
      root,
      layout.quarantine,
      source,
      reasonCode,
      "receiptId",
      receiptId
    );
  }

  function scanUnknownContainer(
    directory,
    allowedNames,
    quarantines,
    scanEntries,
    quarantineCandidate
  ) {
    const entries = scanEntries(directory, storeProfile.limits.maximumDirectoryEntries);
    for (const entry of entries) {
      if (!allowedNames.has(entry.name)) {
        const result = quarantineCandidate(path.join(directory, entry.name), "unknown_entry");
        if (result !== null) quarantines.push(result);
      }
    }
  }

  function rebuildInternal(notifyOtherInstances) {
    const startingProcessGeneration = currentProcessGeneration();
    operationCounter.fullRebuilds += 1;
    if (putManyDepth !== 0) operationCounter.fullRebuildsInsidePutMany += 1;
    ensureLayout(fileOps, root);
    const durabilityIndex = fileOps.rebuildDurabilityIndex();
    let totalScanEntries = 0;
    const scanEntries = (directory, maximumEntries) => {
      const entries = fileOps.boundedDirectoryEntries(directory, maximumEntries);
      totalScanEntries += entries.length;
      if (!Number.isSafeInteger(totalScanEntries) ||
          totalScanEntries > storeProfile.limits.maximumScanEntries) {
        failEvidence("receipt_store_total_scan_limit", "store-scan");
      }
      return entries;
    };
    const existingQuarantineEntries = scanEntries(
      layout.quarantine,
      storeProfile.limits.maximumQuarantineEntries
    ).length;
    const quarantines = [];
    let quarantineEntryCount = existingQuarantineEntries;
    const quarantineCandidate = (source, reasonCode, receiptId = null) => {
      if (quarantineEntryCount >= storeProfile.limits.maximumQuarantineEntries) {
        failEvidence("receipt_store_quarantine_limit", "store-quarantine");
      }
      const result = quarantineEntry(source, reasonCode, receiptId);
      if (result !== null) quarantineEntryCount += 1;
      return result;
    };
    scanUnknownContainer(
      root,
      new Set(["durability", "quarantine", "receipts"]),
      quarantines,
      scanEntries,
      quarantineCandidate
    );
    scanUnknownContainer(
      layout.receipts,
      new Set(["sha256"]),
      quarantines,
      scanEntries,
      quarantineCandidate
    );
    const candidates = new Map();
    const preparedCandidates = [];
    const preparedReceiptIds = new Set();
    let pendingTemporaryCount = 0;
    const prefixes = scanEntries(layout.shaRoot, storeProfile.limits.maximumDirectoryEntries);
    for (const prefixEntry of prefixes) {
      const prefixPath = path.join(layout.shaRoot, prefixEntry.name);
      if (!prefixPattern.test(prefixEntry.name) || !prefixEntry.isDirectory() ||
          prefixEntry.isSymbolicLink()) {
        const result = quarantineCandidate(prefixPath, "unknown_entry");
        if (result !== null) quarantines.push(result);
        continue;
      }
      const entries = scanEntries(prefixPath, storeProfile.limits.maximumDirectoryEntries);
      for (const entry of entries) {
        const filePath = path.join(prefixPath, entry.name);
        const temporaryMatch = temporaryPattern.exec(entry.name);
        if (temporaryMatch) {
          const target = path.join(prefixPath, `${temporaryMatch[1]}.json`);
          const state = fileOps.inspectIncompleteTemporary(
            filePath,
            target,
            storeProfile.concurrency.minimumIncompleteTemporaryAgeMs
          );
          if (state === "missing") continue;
          if (state === "invalid") {
            const result = quarantineCandidate(filePath, "unknown_entry");
            if (result !== null) quarantines.push(result);
            continue;
          }
          if (state === "quarantine") {
            const result = quarantineCandidate(filePath, "incomplete_temporary");
            if (result !== null) quarantines.push(result);
          } else {
            pendingTemporaryCount += 1;
          }
          continue;
        }
        const digestMatch = digestFilePattern.exec(entry.name);
        if (!digestMatch || !entry.isFile() || entry.isSymbolicLink()) {
          const result = quarantineCandidate(filePath, "unknown_entry");
          if (result !== null) quarantines.push(result);
          continue;
        }
        let validated;
        let activationTicket;
        try {
          activationTicket = fileOps.prepareActivation(filePath, receiptMaximumBytes);
          validated = validateVnextReceiptBytes(activationTicket.bytes);
        } catch (error) {
          const reasonCode = error?.code === "receipt_durability_receipt_missing"
            ? "durability_receipt_missing"
            : error?.code === "receipt_target_readback_mismatch"
              ? "durability_target_mismatch"
              : "invalid_receipt";
          const result = quarantineCandidate(filePath, reasonCode);
          if (result !== null) quarantines.push(result);
          continue;
        }
        const expectedDigest = validated.receipt.receiptId.slice("sha256:".length);
        if (expectedDigest !== digestMatch[1] || expectedDigest.slice(0, 2) !== prefixEntry.name) {
          const result = quarantineCandidate(
            filePath,
            "path_identity_mismatch",
            validated.receipt.receiptId
          );
          if (result !== null) quarantines.push(result);
          continue;
        }
        if (preparedReceiptIds.has(validated.receipt.receiptId)) {
          const result = quarantineCandidate(
            filePath,
            "duplicate_receipt",
            validated.receipt.receiptId
          );
          if (result !== null) quarantines.push(result);
          continue;
        }
        preparedReceiptIds.add(validated.receipt.receiptId);
        preparedCandidates.push(Object.freeze({
          activationTicket,
          receiptId: validated.receipt.receiptId,
          parentReceiptIds: collectParentReceiptIds(validated.receipt),
          relativePath: receiptRelativePath(validated.receipt.receiptId),
          validated
        }));
        if (preparedCandidates.length > storeProfile.limits.maximumActiveReceipts) {
          failEvidence("receipt_store_active_limit", "store-scan");
        }
      }
    }

    for (let offset = 0; offset < preparedCandidates.length;
      offset += storeProfile.batch.maximumEntries) {
      const batch = preparedCandidates.slice(
        offset,
        offset + storeProfile.batch.maximumEntries
      );
      const activations = fileOps.activatePreparedMany(
        batch.map((candidate) => candidate.activationTicket)
      );
      if (activations.length !== batch.length) {
        failEvidence("receipt_store_rebuild_interference", "store-scan");
      }
      for (let index = 0; index < batch.length; index += 1) {
        const prepared = batch[index];
        const activation = activations[index];
        const validated = validateVnextReceiptBytes(activation.bytes);
        if (validated.receipt.receiptId !== prepared.receiptId ||
            !validated.bytes.equals(prepared.validated.bytes)) {
          failEvidence("receipt_store_rebuild_interference", "store-scan");
        }
        candidates.set(prepared.receiptId, {
          receiptId: prepared.receiptId,
          durability: activation.durability,
          parentReceiptIds: prepared.parentReceiptIds,
          relativePath: prepared.relativePath,
          validated
        });
      }
    }

    const graph = classifyReceiptGraph([...candidates.values()].map((entry) => ({
      receiptId: entry.receiptId,
      parentReceiptIds: entry.parentReceiptIds
    })));
    for (const invalid of graph.invalid) {
      const candidate = candidates.get(invalid.receiptId);
      const source = path.join(root, ...candidate.relativePath.split("/"));
      const result = quarantineCandidate(source, invalid.reasonCode, invalid.receiptId);
      if (result !== null) quarantines.push(result);
      candidates.delete(invalid.receiptId);
    }
    if (currentProcessGeneration() !== startingProcessGeneration) {
      failEvidence("receipt_store_rebuild_interference", "store-scan");
    }
    active = new Map(graph.activeReceiptIds.map((receiptId) => {
      const candidate = candidates.get(receiptId);
      return [receiptId, Object.freeze({
        parentReceiptIds: candidate.parentReceiptIds,
        durability: candidate.durability,
        relativePath: candidate.relativePath,
        validated: candidate.validated
      })];
    }));
    if (notifyOtherInstances) {
      advanceProcessGeneration(startingProcessGeneration);
    } else {
      observedProcessGeneration = startingProcessGeneration;
    }
    refreshSnapshot();
    return immutableRecord({
      activeReceiptIds: [...active.keys()].sort(),
      durabilityIndex,
      newQuarantines: quarantines,
      existingQuarantineEntries,
      pendingTemporaryCount,
      scannedEntryCount: totalScanEntries,
      directoryMetadata: fileOps.syncDirectory(layout.shaRoot)
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
    const firstTarget = fileOps.boundedReadFile(filePath, receiptMaximumBytes);
    const firstDurability = fileOps.boundedReadFile(
      durabilityPath,
      durablePublicationProfile.limits.maximumReceiptBytes
    );
    const secondTarget = fileOps.boundedReadFile(filePath, receiptMaximumBytes);
    const secondDurability = fileOps.boundedReadFile(
      durabilityPath,
      durablePublicationProfile.limits.maximumReceiptBytes
    );
    if (!firstTarget.equals(expected) || !secondTarget.equals(expected) ||
        !firstDurability.equals(secondDurability) ||
        sha256(firstDurability) !== metadata.durability.durabilityReceiptSha256) {
      failEvidence("receipt_active_readback_mismatch", "receipt-read");
    }
    return secondTarget;
  }

  function readActiveFile(receiptId) {
    const metadata = active.get(receiptId);
    if (!metadata) failEvidence("receipt_not_active", "receipt-read");
    const filePath = path.join(root, ...metadata.relativePath.split("/"));
    fileOps.assertNoLinkComponents(path.dirname(filePath), true);
    let activated;
    let validated;
    try {
      activated = verifyActiveBytes(filePath, metadata);
      validated = validateVnextReceiptBytes(activated);
    } catch (error) {
      throw asEvidenceError(error, "receipt_active_read_failed", "receipt-read");
    }
    if (validated.receipt.receiptId !== receiptId) {
      failEvidence("receipt_active_identity_changed", "receipt-read");
    }
    return Object.freeze({
      bytes: validated.bytes,
      durability: metadata.durability,
      receipt: validated.receipt
    });
  }

  function validateActiveClosures(receiptIds) {
    const visited = new Map();
    const visiting = new Set();
    function visit(current) {
      if (visited.has(current)) return visited.get(current);
      if (visiting.has(current)) failEvidence("receipt_active_cycle", "receipt-read");
      const metadata = active.get(current);
      if (!metadata) failEvidence("receipt_not_active", "receipt-read");
      visiting.add(current);
      try {
        for (const parent of metadata.parentReceiptIds) {
          try {
            visit(parent);
          } catch (error) {
            throw new VnextEvidenceError(
              "receipt_active_parent_invalid",
              "receipt-read",
              error?.code
            );
          }
        }
        let validated;
        try {
          validated = readActiveFile(current);
        } catch (error) {
          throw new VnextEvidenceError(
            "receipt_active_read_failed",
            "receipt-read",
            error?.code
          );
        }
        visited.set(current, validated);
        return validated;
      } finally {
        visiting.delete(current);
      }
    }
    for (const receiptId of receiptIds) visit(receiptId);
    return visited;
  }

  function validateActiveClosure(receiptId) {
    return validateActiveClosures([receiptId]).get(receiptId);
  }

  function read(receiptIdInput) {
    synchronizeProcessState();
    const { receiptId } = normalizeReceiptId(receiptIdInput);
    return validateActiveClosure(receiptId);
  }

  function readDocument(receiptIdInput) {
    synchronizeProcessState();
    const { receiptId } = normalizeReceiptId(receiptIdInput);
    const metadata = active.get(receiptId);
    if (!metadata) failEvidence("receipt_not_active", "receipt-read");
    return metadata.validated;
  }

  function readMany(receiptIdsInput) {
    synchronizeProcessState();
    const values = dataArrayValues(
      receiptIdsInput,
      "receipt_read_batch_invalid",
      "receipt-read"
    );
    if (values.length > storeProfile.limits.maximumActiveReceipts) {
      failEvidence("receipt_read_batch_invalid", "receipt-read");
    }
    const receiptIds = values.map((value) => normalizeReceiptId(value).receiptId);
    if (new Set(receiptIds).size !== receiptIds.length) {
      failEvidence("receipt_read_batch_invalid", "receipt-read");
    }
    const validated = validateActiveClosures(receiptIds);
    return Object.freeze(receiptIds.map((receiptId) => validated.get(receiptId)));
  }

  function persistMany(input) {
    if (!Array.isArray(input) || input.length < receiptBatchProfile.minimumEntries ||
        input.length > receiptBatchProfile.maximumEntries) {
      failEvidence("receipt_batch_invalid", "receipt-persist");
    }
    const values = dataArrayValues(input, "receipt_batch_invalid", "receipt-persist");
    const pending = new Map();
    for (const value of values) {
      const validated = validateVnextReceiptBytes(value);
      const receiptId = validated.receipt.receiptId;
      if (pending.has(receiptId)) {
        failEvidence("receipt_batch_duplicate_id", "receipt-persist");
      }
      const parentReceiptIds = collectParentReceiptIds(validated.receipt);
      if (parentReceiptIds.includes(receiptId)) {
        failEvidence("receipt_self_parent", "receipt-persist");
      }
      pending.set(receiptId, Object.freeze({
        bytes: validated.bytes,
        parentReceiptIds,
        receiptId,
        relativePath: receiptRelativePath(receiptId),
        validated
      }));
    }

    const entries = [...pending.values()].sort((left, right) =>
      left.receiptId < right.receiptId ? -1 : left.receiptId > right.receiptId ? 1 : 0);
    const newReceiptCount = entries.reduce((count, entry) =>
      count + (active.has(entry.receiptId) ? 0 : 1), 0);
    const newEntries = entries.filter((entry) => !active.has(entry.receiptId));
    if (active.size + newReceiptCount > storeProfile.limits.maximumActiveReceipts) {
      failEvidence("receipt_store_active_limit", "receipt-persist");
    }

    let projectedEdgeCount = 0;
    for (const metadata of active.values()) {
      projectedEdgeCount += metadata.parentReceiptIds.length;
    }
    for (const entry of entries) {
      const existing = active.get(entry.receiptId);
      if (existing) projectedEdgeCount -= existing.parentReceiptIds.length;
      projectedEdgeCount += entry.parentReceiptIds.length;
    }
    if (!Number.isSafeInteger(projectedEdgeCount) ||
        projectedEdgeCount > storeProfile.limits.maximumGraphEdges) {
      failEvidence("receipt_store_graph_edge_limit", "receipt-persist");
    }

    const externalParents = new Set();
    const indegree = new Map(entries.map((entry) => [entry.receiptId, 0]));
    const dependents = new Map(entries.map((entry) => [entry.receiptId, []]));
    for (const entry of entries) {
      for (const parent of entry.parentReceiptIds) {
        if (pending.has(parent)) {
          indegree.set(entry.receiptId, indegree.get(entry.receiptId) + 1);
          dependents.get(parent).push(entry.receiptId);
        } else if (active.has(parent)) {
          externalParents.add(parent);
        } else {
          failEvidence("receipt_parent_missing", "receipt-persist");
        }
      }
    }
    for (const valuesForParent of dependents.values()) valuesForParent.sort();
    const ready = [...indegree.entries()]
      .filter(([_receiptId, count]) => count === 0)
      .map(([receiptId]) => receiptId)
      .sort();
    const activationOrder = [];
    while (ready.length > 0) {
      const receiptId = ready.shift();
      activationOrder.push(receiptId);
      for (const dependent of dependents.get(receiptId)) {
        const next = indegree.get(dependent) - 1;
        indegree.set(dependent, next);
        if (next === 0) {
          ready.push(dependent);
          ready.sort();
        }
      }
    }
    if (activationOrder.length !== entries.length) {
      failEvidence("receipt_batch_cycle", "receipt-persist");
    }

    const existingEntries = entries.filter((entry) => active.has(entry.receiptId));
    const activeInputs = new Set(externalParents);
    for (const entry of existingEntries) activeInputs.add(entry.receiptId);

    function validateActiveInputs() {
      let validated;
      try {
        validated = validateActiveClosures([...activeInputs].sort());
      } catch (error) {
        throw new VnextEvidenceError(
          "receipt_active_parent_invalid",
          "receipt-persist",
          error?.code
        );
      }
      for (const entry of existingEntries) {
        if (!validated.get(entry.receiptId).bytes.equals(entry.bytes)) {
          failEvidence("receipt_target_conflict", "receipt-persist");
        }
      }
    }

    const publicationByPath = new Map();
    for (const entry of existingEntries) {
      const metadata = active.get(entry.receiptId);
      publicationByPath.set(entry.relativePath, Object.freeze({
        disposition: "existing-byte-identical",
        durability: metadata.durability
      }));
    }
    validateActiveInputs();
    const publications = newEntries.length === 0 ? [] : fileOps.publishMany(
      newEntries.map((entry) => ({
        bytes: entry.bytes,
        maximumBytes: receiptMaximumBytes,
        target: path.join(root, ...entry.relativePath.split("/"))
      }))
    );
    for (const publication of publications) {
      const relativePath = publication?.durability?.targetRelativePath;
      if (typeof relativePath !== "string" || publicationByPath.has(relativePath)) {
        failEvidence("receipt_batch_publication_invalid", "receipt-persist");
      }
      publicationByPath.set(relativePath, publication);
    }
    if (publicationByPath.size !== entries.length ||
        entries.some((entry) => !publicationByPath.has(entry.relativePath))) {
      failEvidence("receipt_batch_publication_invalid", "receipt-persist");
    }

    try {
      validateActiveInputs();
    } catch (error) {
      try {
        rebuild();
      } catch (rebuildError) {
        throw new VnextEvidenceError(
          "receipt_parent_reconciliation_failed",
          "receipt-persist",
          rebuildError?.code
        );
      }
      throw new VnextEvidenceError(
        "receipt_active_parent_invalid",
        "receipt-persist",
        error?.code
      );
    }

    if (currentProcessGeneration() !== observedProcessGeneration) {
      try {
        rebuildInternal(true);
      } catch (error) {
        throw new VnextEvidenceError(
          "receipt_store_rebuild_interference",
          "receipt-persist",
          error?.code
        );
      }
      failEvidence("receipt_store_rebuild_interference", "receipt-persist");
    }
    for (const receiptId of activationOrder) {
      const entry = pending.get(receiptId);
      const publication = publicationByPath.get(entry.relativePath);
      active.set(receiptId, Object.freeze({
        durability: publication.durability,
        parentReceiptIds: entry.parentReceiptIds,
        relativePath: entry.relativePath,
        validated: entry.validated
      }));
    }
    operationCounter.publishedEntries += newEntries.length;
    if (newEntries.length > 0) {
      advanceProcessGeneration(observedProcessGeneration);
      refreshSnapshot();
    }
    return immutableRecord(entries.map((entry) => {
      const publication = publicationByPath.get(entry.relativePath);
      return {
        receiptId: entry.receiptId,
        relativePath: entry.relativePath,
        disposition: publication.disposition,
        durability: publication.durability
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
    profileId: storeProfile.profileId,
    put,
    putMany,
    read,
    readDocument,
    readMany,
    rebuild,
    snapshot,
    startup
  });
}

module.exports = Object.freeze({
  classifyReceiptGraph,
  collectParentReceiptIds,
  createVnextReceiptStore,
  receiptRelativePath,
  storeProfile,
  storeProfileSha256
});
