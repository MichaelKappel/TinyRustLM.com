"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const {
  createVnextDurablePublication,
  durablePublicationProfile
} = require("./vnext-durable-publication.js");
const {
  asEvidenceError,
  failEvidence
} = require("./vnext-evidence-error.js");

const configurationFields = Object.freeze([
  "codePrefix",
  "root",
  "steps",
  "storeProfileId",
  "storeProfileSha256",
  "streamBufferBytes"
]);
const stepFields = Object.freeze(["open", "path", "persist", "quarantine", "read", "scan"]);

function immutableRecord(value) {
  if (Buffer.isBuffer(value) || ArrayBuffer.isView(value)) return value;
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

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactConfiguration(input) {
  if (!isPlainObject(input) || Object.getOwnPropertySymbols(input).length !== 0) {
    failEvidence("create_only_files_configuration_invalid", "store-open");
  }
  const names = Object.getOwnPropertyNames(input);
  if (names.length !== configurationFields.length ||
      names.some((name) => !configurationFields.includes(name))) {
    failEvidence("create_only_files_configuration_unknown", "store-open");
  }
  const values = {};
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(input, name);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence("create_only_files_configuration_invalid", "store-open");
    }
    values[name] = descriptor.value;
  }
  if (!isPlainObject(values.steps) || Object.getOwnPropertySymbols(values.steps).length !== 0 ||
      Object.getOwnPropertyNames(values.steps).length !== stepFields.length) {
    failEvidence("create_only_files_configuration_invalid", "store-open");
  }
  const steps = {};
  for (const name of stepFields) {
    const descriptor = Object.getOwnPropertyDescriptor(values.steps, name);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor) ||
        typeof descriptor.value !== "string" ||
        !/^[a-z][a-z0-9-]{2,63}$/u.test(descriptor.value)) {
      failEvidence("create_only_files_configuration_invalid", "store-open");
    }
    steps[name] = descriptor.value;
  }
  if (typeof values.codePrefix !== "string" ||
      !/^[a-z][a-z0-9_]{2,39}$/u.test(values.codePrefix) ||
      typeof values.storeProfileId !== "string" ||
      !/^[a-z0-9][a-z0-9._:-]{2,159}$/u.test(values.storeProfileId) ||
      typeof values.storeProfileSha256 !== "string" ||
      !/^[a-f0-9]{64}$/u.test(values.storeProfileSha256) ||
      !Number.isSafeInteger(values.streamBufferBytes) ||
      values.streamBufferBytes < 4096 || values.streamBufferBytes > 1048576) {
    failEvidence("create_only_files_configuration_invalid", "store-open");
  }
  return Object.freeze({ ...values, steps: Object.freeze(steps) });
}

function createVnextCreateOnlyFiles(configurationInput) {
  const configuration = exactConfiguration(configurationInput);
  const {
    codePrefix,
    steps,
    storeProfileId,
    storeProfileSha256,
    streamBufferBytes
  } = configuration;
  const code = (suffix) => `${codePrefix}_${suffix}`;

  function normalizeAbsoluteRoot(value) {
    if (typeof value !== "string" || value.length < 3 || value.length > 1024 ||
        value.includes("\0") || !path.isAbsolute(value) ||
        path.resolve(value) !== path.normalize(value)) {
      failEvidence(code("store_root_invalid"), steps.open);
    }
    return path.resolve(value);
  }

  const root = normalizeAbsoluteRoot(configuration.root);
  const durable = createVnextDurablePublication(root, {
    codePrefix,
    steps: {
      open: steps.open,
      path: steps.path,
      persist: steps.persist,
      read: steps.read,
      scan: steps.scan
    },
    storeProfileId,
    storeProfileSha256
  });

  function normalizeRoot(value) {
    const normalized = normalizeAbsoluteRoot(value);
    if (normalized !== root) failEvidence(code("store_root_mismatch"), steps.open);
    return normalized;
  }

  function safeChild(baseRoot, segments) {
    if (normalizeRoot(baseRoot) !== root || !Array.isArray(segments) || segments.length === 0) {
      failEvidence(code("store_path_invalid"), steps.path);
    }
    for (const segment of segments) {
      if (typeof segment !== "string" || segment.length === 0 || segment.length > 255 ||
          segment === "." || segment === ".." || /[\\/\0]/u.test(segment)) {
        failEvidence(code("store_path_invalid"), steps.path);
      }
    }
    const candidate = path.resolve(root, ...segments);
    const relative = path.relative(root, candidate);
    if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative)) {
      failEvidence(code("store_path_escape"), steps.path);
    }
    return candidate;
  }

  function relativePathForAbsolute(target, allowRoot = false) {
    if (typeof target !== "string" || !path.isAbsolute(target) || target.includes("\0")) {
      failEvidence(code("store_path_invalid"), steps.path);
    }
    const resolved = path.resolve(target);
    if (resolved !== path.normalize(target)) failEvidence(code("store_path_invalid"), steps.path);
    const relative = path.relative(root, resolved);
    if (relative === "" && allowRoot) return ".";
    if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative)) {
      failEvidence(code("store_path_escape"), steps.path);
    }
    return relative.split(path.sep).join("/");
  }

  function assertNoLinkComponents(target, requireLeafDirectory = false) {
    const resolved = path.resolve(target);
    const parsed = path.parse(resolved);
    const parts = resolved.slice(parsed.root.length).split(path.sep).filter(Boolean);
    let current = parsed.root;
    for (let index = 0; index < parts.length; index += 1) {
      current = path.join(current, parts[index]);
      if (!fs.existsSync(current)) continue;
      let stat;
      try {
        stat = fs.lstatSync(current);
      } catch (error) {
        throw asEvidenceError(error, code("store_path_inspection_failed"), steps.path);
      }
      if (stat.isSymbolicLink()) failEvidence(code("store_path_link"), steps.path);
      const leaf = index === parts.length - 1;
      if ((!leaf || requireLeafDirectory) && !stat.isDirectory()) {
        failEvidence(code("store_path_not_directory"), steps.path);
      }
    }
  }

  function ensureRoot(value) {
    normalizeRoot(value);
    if (!fs.existsSync(root)) failEvidence(code("store_root_missing"), steps.open);
    assertNoLinkComponents(root, true);
  }

  function ensureDirectory(directory) {
    const relative = relativePathForAbsolute(directory, true);
    if (relative === ".") {
      ensureRoot(root);
      return Object.freeze([]);
    }
    return durable.ensureDirectory(relative.split("/"));
  }

  function boundedDirectoryEntries(directory, maximumEntries) {
    assertNoLinkComponents(directory, true);
    let handle;
    const entries = [];
    try {
      handle = fs.opendirSync(directory);
      while (true) {
        const entry = handle.readSync();
        if (entry === null) break;
        entries.push(entry);
        if (entries.length > maximumEntries) {
          failEvidence(code("store_directory_entry_limit"), steps.scan);
        }
      }
    } catch (error) {
      throw asEvidenceError(error, code("store_directory_scan_failed"), steps.scan);
    } finally {
      if (handle !== undefined) {
        try {
          handle.closeSync();
        } catch (_error) {
          // The bounded result or earlier failure remains authoritative.
        }
      }
    }
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    return entries;
  }

  function boundedReadFile(filePath, maximumBytes) {
    assertNoLinkComponents(path.dirname(filePath), true);
    let descriptor;
    try {
      const linkStat = fs.lstatSync(filePath);
      if (linkStat.isSymbolicLink() || !linkStat.isFile()) {
        failEvidence(code("file_not_regular"), steps.read);
      }
      descriptor = fs.openSync(
        filePath,
        Number(fs.constants.O_RDONLY) | Number(fs.constants.O_NOFOLLOW || 0)
      );
      const initial = fs.fstatSync(descriptor);
      if (!initial.isFile() || initial.size <= 0 || initial.size > maximumBytes) {
        failEvidence(code("file_byte_limit"), steps.read);
      }
      if ((linkStat.dev !== undefined && initial.dev !== undefined &&
          linkStat.dev !== initial.dev) ||
          (linkStat.ino && initial.ino && linkStat.ino !== initial.ino)) {
        failEvidence(code("file_changed"), steps.read);
      }
      const bytes = Buffer.alloc(initial.size);
      let offset = 0;
      while (offset < bytes.length) {
        const length = Math.min(streamBufferBytes, bytes.length - offset);
        const count = fs.readSync(descriptor, bytes, offset, length, offset);
        if (count <= 0) failEvidence(code("file_truncated"), steps.read);
        offset += count;
      }
      if (fs.fstatSync(descriptor).size !== initial.size) {
        failEvidence(code("file_changed"), steps.read);
      }
      return bytes;
    } catch (error) {
      throw asEvidenceError(error, code("file_read_failed"), steps.read);
    } finally {
      if (descriptor !== undefined) {
        try {
          fs.closeSync(descriptor);
        } catch (_error) {
          // The private byte copy or earlier failure remains authoritative.
        }
      }
    }
  }

  function inspectIncompleteTemporary(filePath, target, minimumAgeMs, nowMs = Date.now()) {
    let temporaryStat;
    try {
      temporaryStat = fs.lstatSync(filePath);
    } catch (error) {
      if (error?.code === "ENOENT") return "missing";
      throw asEvidenceError(error, code("temporary_inspection_failed"), steps.scan);
    }
    if (temporaryStat.isSymbolicLink() || !temporaryStat.isFile()) return "invalid";
    let publishedHardLink = false;
    try {
      const targetStat = fs.lstatSync(target);
      publishedHardLink = !targetStat.isSymbolicLink() && targetStat.isFile() &&
        temporaryStat.dev !== undefined && targetStat.dev !== undefined &&
        temporaryStat.ino && targetStat.ino &&
        temporaryStat.dev === targetStat.dev && temporaryStat.ino === targetStat.ino;
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw asEvidenceError(error, code("target_inspection_failed"), steps.scan);
      }
    }
    const ageMs = nowMs - Number(temporaryStat.mtimeMs);
    const oldEnough = Number.isFinite(ageMs) && ageMs >= 0 && ageMs >= minimumAgeMs;
    return publishedHardLink || oldEnough ? "quarantine" : "pending";
  }

  function publishMany(input) {
    if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype ||
        Object.getOwnPropertySymbols(input).length !== 0 || input.length === 0 ||
        input.length > durablePublicationProfile.batch.maximumEntries) {
      failEvidence(code("publish_batch_invalid"), steps.persist);
    }
    const names = Object.getOwnPropertyNames(input);
    if (names.length !== input.length + 1 || !names.includes("length")) {
      failEvidence(code("publish_batch_invalid"), steps.persist);
    }
    const entries = [];
    for (let index = 0; index < input.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor) ||
          !isPlainObject(descriptor.value)) {
        failEvidence(code("publish_batch_invalid"), steps.persist);
      }
      const entry = descriptor.value;
      const fields = ["bytes", "maximumBytes", "target"];
      const entryNames = Object.getOwnPropertyNames(entry);
      if (Object.getOwnPropertySymbols(entry).length !== 0 ||
          entryNames.length !== fields.length ||
          entryNames.some((name) => !fields.includes(name))) {
        failEvidence(code("publish_batch_invalid"), steps.persist);
      }
      const values = {};
      for (const name of fields) {
        const field = Object.getOwnPropertyDescriptor(entry, name);
        if (!field || !field.enumerable || !("value" in field)) {
          failEvidence(code("publish_batch_invalid"), steps.persist);
        }
        values[name] = field.value;
      }
      entries.push(Object.freeze({
        bytes: values.bytes,
        maximumBytes: values.maximumBytes,
        relativePath: relativePathForAbsolute(values.target)
      }));
    }
    return immutableRecord(durable.publishMany(entries).map((durability) => ({
      disposition: durability.targetDisposition,
      durability
    })));
  }

  function publishBytes(target, bytes, maximumBytes) {
    return publishMany([{ bytes, maximumBytes, target }])[0];
  }

  function activateBytes(target, maximumBytes) {
    return durable.activateBytes(relativePathForAbsolute(target), maximumBytes);
  }

  function syncDirectory(directory, stage = "store-sync", bindingSha256 = null) {
    const relativeDirectory = relativePathForAbsolute(directory, true);
    const binding = bindingSha256 ?? crypto.createHash("sha256")
      .update(`${storeProfileSha256}\0${stage}\0${relativeDirectory}`, "utf8")
      .digest("hex");
    return durable.flushOwnedDirectory(relativeDirectory, stage, binding);
  }

  function randomHex(byteCount = 12) {
    try {
      return crypto.randomBytes(byteCount).toString("hex");
    } catch (error) {
      throw asEvidenceError(error, code("random_failed"), steps.quarantine);
    }
  }

  function quarantineEntry(baseRoot, quarantineDirectory, source, reasonCode,
    identityFieldName = null, identity = null) {
    normalizeRoot(baseRoot);
    if (typeof reasonCode !== "string" || !/^[a-z][a-z0-9_]{2,79}$/u.test(reasonCode)) {
      failEvidence(code("quarantine_reason_invalid"), steps.quarantine);
    }
    if ((identityFieldName === null && identity !== null) ||
        (identityFieldName !== null && (typeof identityFieldName !== "string" ||
          (identity !== null && typeof identity !== "string")))) {
      failEvidence(code("quarantine_identity_invalid"), steps.quarantine);
    }
    const expectedQuarantine = safeChild(root, [path.basename(quarantineDirectory)]);
    if (path.resolve(quarantineDirectory) !== expectedQuarantine) {
      failEvidence(code("quarantine_path_invalid"), steps.quarantine);
    }
    relativePathForAbsolute(source);
    assertNoLinkComponents(path.dirname(source), true);
    let stat;
    try {
      stat = fs.lstatSync(source);
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw asEvidenceError(error, code("quarantine_source_failed"), steps.quarantine);
    }
    const quarantineId = `quarantine-${randomHex(16)}`;
    const destination = safeChild(
      root,
      [path.basename(quarantineDirectory), `${quarantineId}.${reasonCode}.q`]
    );
    assertNoLinkComponents(quarantineDirectory, true);
    if (stat.isFile() && !stat.isSymbolicLink()) {
      try {
        fs.linkSync(source, destination);
      } catch (error) {
        if (error?.code === "ENOENT") return null;
        throw asEvidenceError(error, code("quarantine_move_failed"), steps.quarantine);
      }
      try {
        fs.unlinkSync(source);
      } catch (error) {
        if (error?.code !== "ENOENT") {
          throw asEvidenceError(error, code("quarantine_move_failed"), steps.quarantine);
        }
      }
    } else {
      try {
        fs.renameSync(source, destination);
      } catch (error) {
        if (error?.code === "ENOENT") return null;
        throw asEvidenceError(error, code("quarantine_move_failed"), steps.quarantine);
      }
    }
    const binding = crypto.createHash("sha256")
      .update(`${quarantineId}\0${reasonCode}`, "utf8")
      .digest("hex");
    syncDirectory(path.dirname(source), "quarantine-source", binding);
    syncDirectory(quarantineDirectory, "quarantine-target", binding);
    const result = { quarantineId, reasonCode };
    if (identityFieldName !== null) result[identityFieldName] = identity;
    return immutableRecord(result);
  }

  return Object.freeze({
    activateBytes,
    assertNoLinkComponents,
    boundedDirectoryEntries,
    boundedReadFile,
    durabilityStartup: durable.startup,
    ensureDirectory,
    ensureRoot,
    inspectIncompleteTemporary,
    normalizeRoot,
    publishBytes,
    publishMany,
    quarantineEntry,
    rebuildDurabilityIndex: durable.rebuild,
    safeChild,
    syncDirectory
  });
}

module.exports = Object.freeze({
  createVnextCreateOnlyFiles,
  immutableRecord
});
