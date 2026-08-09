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

const profilePath = path.resolve(__dirname, "../../contracts/vnext/receipt-store-profile.v1.json");
const storeProfile = parseStrictJson(fs.readFileSync(profilePath));
const receiptIdPattern = /^sha256:([a-f0-9]{64})$/u;
const digestFilePattern = /^([a-f0-9]{64})\.json$/u;
const prefixPattern = /^[a-f0-9]{2}$/u;
const temporaryPattern = /^\.([a-f0-9]{64})\.[0-9]{1,20}\.[a-f0-9]{4,64}\.tmp$/u;
const quarantineReasonPattern = /^[a-z][a-z0-9_]{2,79}$/u;
const knownWindowsDirectorySyncErrors = new Set(["EACCES", "EINVAL", "ENOTSUP", "EPERM"]);
const storeOptionNames = Object.freeze(["io", "platform", "randomBytes"]);

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
    if (!storeOptionNames.includes(name)) failEvidence("receipt_store_option_unknown", "store-open");
    const descriptor = Object.getOwnPropertyDescriptor(options, name);
    if (!descriptor || !descriptor.enumerable) {
      failEvidence("receipt_store_option_unknown", "store-open");
    }
    if (!("value" in descriptor)) {
      failEvidence("receipt_store_option_accessor", "store-open");
    }
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

function normalizeRoot(root) {
  if (typeof root !== "string" || root.length < 3 || root.length > 1024 || root.includes("\0")) {
    failEvidence("receipt_store_root_invalid", "store-open");
  }
  const resolved = path.resolve(root);
  if (!path.isAbsolute(root) || resolved !== path.normalize(root)) {
    failEvidence("receipt_store_root_not_absolute", "store-open");
  }
  return resolved;
}

function safeChild(root, segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    failEvidence("receipt_store_path_invalid", "store-path");
  }
  for (const segment of segments) {
    if (typeof segment !== "string" || segment.length === 0 || segment.length > 255 ||
        segment === "." || segment === ".." || /[\\/\0]/u.test(segment)) {
      failEvidence("receipt_store_path_invalid", "store-path");
    }
  }
  const candidate = path.resolve(root, ...segments);
  const relative = path.relative(root, candidate);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)) {
    failEvidence("receipt_store_path_escape", "store-path");
  }
  return candidate;
}

function assertNoLinkComponents(io, target, requireLeafDirectory = false) {
  const resolved = path.resolve(target);
  const parsed = path.parse(resolved);
  const parts = resolved.slice(parsed.root.length).split(path.sep).filter(Boolean);
  let current = parsed.root;
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    if (!io.existsSync(current)) continue;
    let stat;
    try {
      stat = io.lstatSync(current);
    } catch (error) {
      throw asEvidenceError(error, "receipt_store_path_inspection_failed", "store-path");
    }
    if (stat.isSymbolicLink()) failEvidence("receipt_store_path_link", "store-path");
    const leaf = index === parts.length - 1;
    if ((!leaf || requireLeafDirectory) && !stat.isDirectory()) {
      failEvidence("receipt_store_path_not_directory", "store-path");
    }
  }
}

function ensureDirectory(io, directory) {
  assertNoLinkComponents(io, path.dirname(directory), true);
  try {
    io.mkdirSync(directory, { recursive: false, mode: 0o700 });
  } catch (error) {
    if (error?.code !== "EEXIST") {
      throw asEvidenceError(error, "receipt_store_directory_create_failed", "store-open");
    }
  }
  assertNoLinkComponents(io, directory, true);
}

function ensureLayout(io, root) {
  if (!io.existsSync(root)) {
    assertNoLinkComponents(io, path.dirname(root), true);
    try {
      io.mkdirSync(root, { recursive: false, mode: 0o700 });
    } catch (error) {
      throw asEvidenceError(error, "receipt_store_root_create_failed", "store-open");
    }
  }
  assertNoLinkComponents(io, root, true);
  const receipts = safeChild(root, ["receipts"]);
  const shaRoot = safeChild(root, ["receipts", "sha256"]);
  const quarantine = safeChild(root, ["quarantine"]);
  ensureDirectory(io, receipts);
  ensureDirectory(io, shaRoot);
  ensureDirectory(io, quarantine);
  return Object.freeze({ receipts, shaRoot, quarantine });
}

function boundedDirectoryEntries(io, directory, maximumEntries) {
  let handle;
  const entries = [];
  try {
    handle = io.opendirSync(directory);
    while (true) {
      const entry = handle.readSync();
      if (entry === null) break;
      entries.push(entry);
      if (entries.length > maximumEntries) {
        failEvidence("receipt_store_directory_entry_limit", "store-scan");
      }
    }
  } catch (error) {
    throw asEvidenceError(error, "receipt_store_directory_scan_failed", "store-scan");
  } finally {
    if (handle !== undefined) {
      try {
        handle.closeSync();
      } catch (_error) {
        // A scan failure has already prevented acceptance; no raw host detail escapes.
      }
    }
  }
  entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
  return entries;
}

function boundedReadFile(io, filePath, maximumBytes) {
  let descriptor;
  try {
    const linkStat = io.lstatSync(filePath);
    if (linkStat.isSymbolicLink() || !linkStat.isFile()) {
      failEvidence("receipt_file_not_regular", "receipt-read");
    }
    const noFollow = Number(io.constants?.O_NOFOLLOW || 0);
    descriptor = io.openSync(filePath, Number(io.constants.O_RDONLY) | noFollow);
    const initial = io.fstatSync(descriptor);
    if (!initial.isFile()) failEvidence("receipt_file_not_regular", "receipt-read");
    if (initial.size <= 0 || initial.size > maximumBytes) {
      failEvidence("receipt_file_byte_limit", "receipt-read");
    }
    if (linkStat.dev !== undefined && initial.dev !== undefined && linkStat.dev !== initial.dev) {
      failEvidence("receipt_file_changed", "receipt-read");
    }
    if (linkStat.ino && initial.ino && linkStat.ino !== initial.ino) {
      failEvidence("receipt_file_changed", "receipt-read");
    }
    const bytes = Buffer.alloc(initial.size);
    let offset = 0;
    while (offset < bytes.length) {
      const length = Math.min(storeProfile.limits.streamBufferBytes, bytes.length - offset);
      const count = io.readSync(descriptor, bytes, offset, length, offset);
      if (count <= 0) failEvidence("receipt_file_truncated", "receipt-read");
      offset += count;
    }
    const final = io.fstatSync(descriptor);
    if (final.size !== initial.size) failEvidence("receipt_file_changed", "receipt-read");
    return bytes;
  } catch (error) {
    throw asEvidenceError(error, "receipt_file_read_failed", "receipt-read");
  } finally {
    if (descriptor !== undefined) {
      try {
        io.closeSync(descriptor);
      } catch (_error) {
        // The operation is already failed or has a complete private byte copy.
      }
    }
  }
}

function syncDirectory(io, platform, directory) {
  let descriptor;
  try {
    descriptor = io.openSync(directory, "r");
    io.fsyncSync(descriptor);
    return "performed";
  } catch (error) {
    if (platform === "win32" && knownWindowsDirectorySyncErrors.has(error?.code)) {
      return "unavailable-win32-node";
    }
    throw asEvidenceError(error, "receipt_directory_sync_failed", "receipt-persist");
  } finally {
    if (descriptor !== undefined) {
      try {
        io.closeSync(descriptor);
      } catch (_error) {
        // Directory synchronization has already produced a bounded outcome.
      }
    }
  }
}

function randomHex(randomBytes, byteCount = 12) {
  let value;
  try {
    value = randomBytes(byteCount);
  } catch (error) {
    throw asEvidenceError(error, "receipt_random_failed", "receipt-persist");
  }
  if (!Buffer.isBuffer(value) || value.length !== byteCount) {
    failEvidence("receipt_random_invalid", "receipt-persist");
  }
  return value.toString("hex");
}

function writeSyncedTemporary(io, target, bytes, randomBytes) {
  const digest = path.basename(target, ".json");
  const temporary = path.join(
    path.dirname(target),
    `.${digest}.${process.pid}.${randomHex(randomBytes)}.tmp`
  );
  let descriptor;
  try {
    descriptor = io.openSync(temporary, "wx", 0o600);
    let offset = 0;
    while (offset < bytes.length) {
      const length = Math.min(storeProfile.limits.streamBufferBytes, bytes.length - offset);
      const count = io.writeSync(descriptor, bytes, offset, length, offset);
      if (!Number.isSafeInteger(count) || count <= 0 || count > length) {
        failEvidence("receipt_temporary_short_write", "receipt-persist");
      }
      offset += count;
    }
    io.fsyncSync(descriptor);
    io.closeSync(descriptor);
    descriptor = undefined;
    return temporary;
  } catch (error) {
    if (descriptor !== undefined) {
      try {
        io.closeSync(descriptor);
      } catch (_closeError) {
        // The write failure remains authoritative.
      }
    }
    try {
      io.unlinkSync(temporary);
    } catch (_cleanupError) {
      // Startup recovery will quarantine a surviving same-directory temporary.
    }
    throw asEvidenceError(error, "receipt_temporary_write_failed", "receipt-persist");
  }
}

function immutableRecord(value) {
  if (Array.isArray(value)) {
    for (const entry of value) immutableRecord(entry);
    return Object.freeze(value);
  }
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value)) immutableRecord(entry);
    return Object.freeze(value);
  }
  return value;
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
  const normalizedOptions = exactOptions(options);
  const io = Object.hasOwn(normalizedOptions, "io") ? normalizedOptions.io : fs;
  const platform = Object.hasOwn(normalizedOptions, "platform")
    ? normalizedOptions.platform
    : process.platform;
  const randomBytes = Object.hasOwn(normalizedOptions, "randomBytes")
    ? normalizedOptions.randomBytes
    : crypto.randomBytes;
  if (io === null || (typeof io !== "object" && typeof io !== "function")) {
    failEvidence("receipt_store_io_invalid", "store-open");
  }
  if (typeof platform !== "string" || platform.length === 0 ||
      typeof randomBytes !== "function") {
    failEvidence("receipt_store_options_invalid", "store-open");
  }
  const root = normalizeRoot(rootInput);
  const layout = ensureLayout(io, root);
  let active = new Map();

  function quarantineEntry(source, reasonCode, receiptId = null) {
    if (!quarantineReasonPattern.test(reasonCode)) {
      failEvidence("receipt_quarantine_reason_invalid", "store-quarantine");
    }
    assertNoLinkComponents(io, path.dirname(source), true);
    let stat;
    try {
      stat = io.lstatSync(source);
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw asEvidenceError(error, "receipt_quarantine_source_failed", "store-quarantine");
    }
    const quarantineId = `quarantine-${randomHex(randomBytes, 16)}`;
    const destination = safeChild(root, ["quarantine", `${quarantineId}.${reasonCode}.q`]);
    assertNoLinkComponents(io, layout.quarantine, true);
    if (stat.isFile() && !stat.isSymbolicLink()) {
      try {
        io.linkSync(source, destination);
      } catch (error) {
        if (error?.code === "ENOENT") return null;
        throw asEvidenceError(error, "receipt_quarantine_move_failed", "store-quarantine");
      }
      try {
        io.unlinkSync(source);
      } catch (error) {
        if (error?.code !== "ENOENT") {
          try {
            io.unlinkSync(destination);
          } catch (_rollbackError) {
            // A surviving destination remains safely inside quarantine.
          }
          throw asEvidenceError(error, "receipt_quarantine_move_failed", "store-quarantine");
        }
      }
    } else {
      try {
        if (io.existsSync(destination)) {
          failEvidence("receipt_quarantine_collision", "store-quarantine");
        }
        io.renameSync(source, destination);
      } catch (error) {
        if (error?.code === "ENOENT") return null;
        throw asEvidenceError(error, "receipt_quarantine_move_failed", "store-quarantine");
      }
    }
    syncDirectory(io, platform, path.dirname(source));
    syncDirectory(io, platform, layout.quarantine);
    return immutableRecord({ quarantineId, reasonCode, receiptId });
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
    ensureLayout(io, root);
    let totalScanEntries = 0;
    const scanEntries = (directory, maximumEntries) => {
      const entries = boundedDirectoryEntries(io, directory, maximumEntries);
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
      new Set(["quarantine", "receipts"]),
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
          let temporaryStat;
          try {
            temporaryStat = io.lstatSync(filePath);
          } catch (error) {
            if (error?.code === "ENOENT") continue;
            throw asEvidenceError(error, "receipt_temporary_inspection_failed", "store-scan");
          }
          if (temporaryStat.isSymbolicLink() || !temporaryStat.isFile()) {
            const result = quarantineCandidate(filePath, "unknown_entry");
            if (result !== null) quarantines.push(result);
            continue;
          }
          const target = path.join(prefixPath, `${temporaryMatch[1]}.json`);
          let publishedHardLink = false;
          try {
            const targetStat = io.lstatSync(target);
            publishedHardLink = !targetStat.isSymbolicLink() && targetStat.isFile() &&
              temporaryStat.dev !== undefined && targetStat.dev !== undefined &&
              temporaryStat.ino && targetStat.ino &&
              temporaryStat.dev === targetStat.dev && temporaryStat.ino === targetStat.ino;
          } catch (error) {
            if (error?.code !== "ENOENT") {
              throw asEvidenceError(error, "receipt_target_inspection_failed", "store-scan");
            }
          }
          const ageMs = Date.now() - Number(temporaryStat.mtimeMs);
          const oldEnough = Number.isFinite(ageMs) && ageMs >= 0 &&
            ageMs >= storeProfile.concurrency.minimumIncompleteTemporaryAgeMs;
          if (publishedHardLink || oldEnough) {
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
        try {
          validated = validateVnextReceiptBytes(boundedReadFile(io, filePath, receiptMaximumBytes));
        } catch (_error) {
          const result = quarantineCandidate(filePath, "invalid_receipt");
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
        relativePath: candidate.relativePath
      })];
    }));
    return immutableRecord({
      activeReceiptIds: [...active.keys()].sort(),
      newQuarantines: quarantines,
      existingQuarantineEntries,
      pendingTemporaryCount,
      scannedEntryCount: totalScanEntries,
      directoryMetadata: syncDirectory(io, platform, layout.shaRoot)
    });
  }

  const startup = rebuild();

  function readActiveFile(receiptId) {
    const metadata = active.get(receiptId);
    if (!metadata) failEvidence("receipt_not_active", "receipt-read");
    const filePath = path.join(root, ...metadata.relativePath.split("/"));
    assertNoLinkComponents(io, path.dirname(filePath), true);
    let validated;
    try {
      validated = validateVnextReceiptBytes(boundedReadFile(io, filePath, receiptMaximumBytes));
    } catch (error) {
      throw asEvidenceError(error, "receipt_active_read_failed", "receipt-read");
    }
    if (validated.receipt.receiptId !== receiptId) {
      failEvidence("receipt_active_identity_changed", "receipt-read");
    }
    return validated;
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

  function put(input) {
    const validated = validateVnextReceiptBytes(input);
    const receiptId = validated.receipt.receiptId;
    const parents = collectParentReceiptIds(validated.receipt);
    if (parents.includes(receiptId)) failEvidence("receipt_self_parent", "receipt-persist");
    for (const parent of parents) {
      if (!active.has(parent)) failEvidence("receipt_parent_missing", "receipt-persist");
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
    const relativePath = receiptRelativePath(receiptId);
    const target = path.join(root, ...relativePath.split("/"));
    const prefix = path.dirname(target);
    if (!io.existsSync(prefix)) ensureDirectory(io, prefix);
    assertNoLinkComponents(io, prefix, true);
    const bytes = validated.bytes;
    const temporary = writeSyncedTemporary(io, target, bytes, randomBytes);
    let disposition = "created";
    try {
      assertNoLinkComponents(io, prefix, true);
      try {
        io.linkSync(temporary, target);
      } catch (error) {
        if (error?.code !== "EEXIST") {
          throw asEvidenceError(error, "receipt_publish_failed", "receipt-persist");
        }
        const existing = boundedReadFile(io, target, receiptMaximumBytes);
        if (!existing.equals(bytes)) failEvidence("receipt_target_conflict", "receipt-persist");
        disposition = "existing-byte-identical";
      }
    } finally {
      try {
        io.unlinkSync(temporary);
      } catch (_error) {
        // Startup recovery will quarantine a surviving temporary.
      }
    }
    assertNoLinkComponents(io, prefix, true);
    const directoryMetadata = syncDirectory(io, platform, prefix);
    const readback = boundedReadFile(io, target, receiptMaximumBytes);
    if (!readback.equals(bytes)) failEvidence("receipt_readback_mismatch", "receipt-persist");
    try {
      for (const parent of parents) validateActiveClosure(parent);
    } catch (error) {
      if (disposition === "created") {
        try {
          assertNoLinkComponents(io, prefix, true);
          io.unlinkSync(target);
          syncDirectory(io, platform, prefix);
        } catch (cleanupError) {
          if (cleanupError?.code !== "ENOENT") {
            throw new VnextEvidenceError(
              "receipt_parent_cleanup_failed",
              "receipt-persist",
              asEvidenceError(
                cleanupError,
                "receipt_parent_cleanup_failed",
                "receipt-persist"
              ).causeCode
            );
          }
        }
      }
      throw new VnextEvidenceError(
        "receipt_active_parent_invalid",
        "receipt-persist",
        error?.code
      );
    }
    active.set(receiptId, Object.freeze({ parentReceiptIds: parents, relativePath }));
    return immutableRecord({
      receiptId,
      relativePath,
      disposition,
      durability: {
        fileData: "fsync-complete",
        directoryMetadata,
        readback: "verified"
      }
    });
  }

  return Object.freeze({
    profileId: storeProfile.profileId,
    put,
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
  storeProfile
});
