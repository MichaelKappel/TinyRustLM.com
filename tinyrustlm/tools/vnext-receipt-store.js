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

const receiptBatchProfile = dataObjectValues(
  storeProfile.batch,
  receiptBatchFields,
  receiptBatchFields,
  "receipt_store_profile_invalid",
  "store-profile"
);

if (storeProfile.durablePublication?.profileId !== durablePublicationProfile.profileId ||
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
  const layout = ensureLayout(fileOps, root);
  let active = new Map();

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

  function rebuild() {
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
        let activation;
        try {
          activation = fileOps.activateBytes(filePath, receiptMaximumBytes);
          validated = validateVnextReceiptBytes(activation.bytes);
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
        if (candidates.has(validated.receipt.receiptId)) {
          const result = quarantineCandidate(
            filePath,
            "duplicate_receipt",
            validated.receipt.receiptId
          );
          if (result !== null) quarantines.push(result);
          continue;
        }
        candidates.set(validated.receipt.receiptId, {
          receiptId: validated.receipt.receiptId,
          durability: activation.durability,
          parentReceiptIds: collectParentReceiptIds(validated.receipt),
          relativePath: receiptRelativePath(validated.receipt.receiptId)
        });
        if (candidates.size > storeProfile.limits.maximumActiveReceipts) {
          failEvidence("receipt_store_active_limit", "store-scan");
        }
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
    active = new Map(graph.activeReceiptIds.map((receiptId) => {
      const candidate = candidates.get(receiptId);
      return [receiptId, Object.freeze({
        parentReceiptIds: candidate.parentReceiptIds,
        durability: candidate.durability,
        relativePath: candidate.relativePath
      })];
    }));
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

  const startup = rebuild();

  function readActiveFile(receiptId) {
    const metadata = active.get(receiptId);
    if (!metadata) failEvidence("receipt_not_active", "receipt-read");
    const filePath = path.join(root, ...metadata.relativePath.split("/"));
    fileOps.assertNoLinkComponents(path.dirname(filePath), true);
    let activated;
    let validated;
    try {
      activated = fileOps.activateBytes(filePath, receiptMaximumBytes);
      validated = validateVnextReceiptBytes(activated.bytes);
    } catch (error) {
      throw asEvidenceError(error, "receipt_active_read_failed", "receipt-read");
    }
    if (validated.receipt.receiptId !== receiptId) {
      failEvidence("receipt_active_identity_changed", "receipt-read");
    }
    return Object.freeze({
      bytes: validated.bytes,
      durability: activated.durability,
      receipt: validated.receipt
    });
  }

  function validateActiveClosure(receiptId) {
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
    return visit(receiptId);
  }

  function read(receiptIdInput) {
    const { receiptId } = normalizeReceiptId(receiptIdInput);
    return validateActiveClosure(receiptId);
  }

  function putMany(input) {
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
        relativePath: receiptRelativePath(receiptId)
      }));
    }

    const entries = [...pending.values()].sort((left, right) =>
      left.receiptId < right.receiptId ? -1 : left.receiptId > right.receiptId ? 1 : 0);
    const newReceiptCount = entries.reduce((count, entry) =>
      count + (active.has(entry.receiptId) ? 0 : 1), 0);
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

    function validateExternalParents() {
      for (const parent of [...externalParents].sort()) {
        try {
          validateActiveClosure(parent);
        } catch (error) {
          throw new VnextEvidenceError(
            "receipt_active_parent_invalid",
            "receipt-persist",
            error?.code
          );
        }
      }
    }

    validateExternalParents();
    const publications = fileOps.publishMany(entries.map((entry) => ({
      bytes: entry.bytes,
      maximumBytes: receiptMaximumBytes,
      target: path.join(root, ...entry.relativePath.split("/"))
    })));
    const publicationByPath = new Map();
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
      validateExternalParents();
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

    for (const receiptId of activationOrder) {
      const entry = pending.get(receiptId);
      const publication = publicationByPath.get(entry.relativePath);
      active.set(receiptId, Object.freeze({
        durability: publication.durability,
        parentReceiptIds: entry.parentReceiptIds,
        relativePath: entry.relativePath
      }));
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

  function put(input) {
    return putMany([input])[0];
  }

  return Object.freeze({
    profileId: storeProfile.profileId,
    put,
    putMany,
    read,
    rebuild,
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
