"use strict";

const path = require("node:path");

const {
  asEvidenceError,
  failEvidence
} = require("./vnext-evidence-error.js");

const knownWindowsDirectorySyncErrors = new Set(["EACCES", "EINVAL", "ENOTSUP", "EPERM"]);

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

function createVnextCreateOnlyFiles({
  codePrefix,
  io,
  platform,
  randomBytes,
  steps,
  streamBufferBytes
}) {
  const code = (suffix) => `${codePrefix}_${suffix}`;

  function normalizeRoot(root) {
    if (typeof root !== "string" || root.length < 3 || root.length > 1024 ||
        root.includes("\0")) {
      failEvidence(code("store_root_invalid"), steps.open);
    }
    const resolved = path.resolve(root);
    if (!path.isAbsolute(root) || resolved !== path.normalize(root)) {
      failEvidence(code("store_root_not_absolute"), steps.open);
    }
    return resolved;
  }

  function safeChild(root, segments) {
    if (!Array.isArray(segments) || segments.length === 0) {
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

  function assertNoLinkComponents(target, requireLeafDirectory = false) {
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
        throw asEvidenceError(error, code("store_path_inspection_failed"), steps.path);
      }
      if (stat.isSymbolicLink()) failEvidence(code("store_path_link"), steps.path);
      const leaf = index === parts.length - 1;
      if ((!leaf || requireLeafDirectory) && !stat.isDirectory()) {
        failEvidence(code("store_path_not_directory"), steps.path);
      }
    }
  }

  function ensureRoot(root) {
    if (!io.existsSync(root)) {
      assertNoLinkComponents(path.dirname(root), true);
      try {
        io.mkdirSync(root, { recursive: false, mode: 0o700 });
      } catch (error) {
        throw asEvidenceError(error, code("store_root_create_failed"), steps.open);
      }
    }
    assertNoLinkComponents(root, true);
  }

  function ensureDirectory(directory) {
    assertNoLinkComponents(path.dirname(directory), true);
    try {
      io.mkdirSync(directory, { recursive: false, mode: 0o700 });
    } catch (error) {
      if (error?.code !== "EEXIST") {
        throw asEvidenceError(error, code("store_directory_create_failed"), steps.open);
      }
    }
    assertNoLinkComponents(directory, true);
  }

  function boundedDirectoryEntries(directory, maximumEntries) {
    let handle;
    const entries = [];
    try {
      handle = io.opendirSync(directory);
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
          // The scan has already failed or owns a complete bounded entry list.
        }
      }
    }
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    return entries;
  }

  function boundedReadFile(filePath, maximumBytes) {
    let descriptor;
    try {
      const linkStat = io.lstatSync(filePath);
      if (linkStat.isSymbolicLink() || !linkStat.isFile()) {
        failEvidence(code("file_not_regular"), steps.read);
      }
      const noFollow = Number(io.constants?.O_NOFOLLOW || 0);
      descriptor = io.openSync(filePath, Number(io.constants.O_RDONLY) | noFollow);
      const initial = io.fstatSync(descriptor);
      if (!initial.isFile()) failEvidence(code("file_not_regular"), steps.read);
      if (initial.size <= 0 || initial.size > maximumBytes) {
        failEvidence(code("file_byte_limit"), steps.read);
      }
      if (linkStat.dev !== undefined && initial.dev !== undefined &&
          linkStat.dev !== initial.dev) {
        failEvidence(code("file_changed"), steps.read);
      }
      if (linkStat.ino && initial.ino && linkStat.ino !== initial.ino) {
        failEvidence(code("file_changed"), steps.read);
      }
      const bytes = Buffer.alloc(initial.size);
      let offset = 0;
      while (offset < bytes.length) {
        const length = Math.min(streamBufferBytes, bytes.length - offset);
        const count = io.readSync(descriptor, bytes, offset, length, offset);
        if (count <= 0) failEvidence(code("file_truncated"), steps.read);
        offset += count;
      }
      const final = io.fstatSync(descriptor);
      if (final.size !== initial.size) failEvidence(code("file_changed"), steps.read);
      return bytes;
    } catch (error) {
      throw asEvidenceError(error, code("file_read_failed"), steps.read);
    } finally {
      if (descriptor !== undefined) {
        try {
          io.closeSync(descriptor);
        } catch (_error) {
          // The operation is failed or owns a complete private byte copy.
        }
      }
    }
  }

  function syncDirectory(directory) {
    let descriptor;
    try {
      descriptor = io.openSync(directory, "r");
      io.fsyncSync(descriptor);
      return "performed";
    } catch (error) {
      if (platform === "win32" && knownWindowsDirectorySyncErrors.has(error?.code)) {
        return "unavailable-win32-node";
      }
      throw asEvidenceError(error, code("directory_sync_failed"), steps.persist);
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

  function randomHex(byteCount = 12) {
    let value;
    try {
      value = randomBytes(byteCount);
    } catch (error) {
      throw asEvidenceError(error, code("random_failed"), steps.persist);
    }
    if (!Buffer.isBuffer(value) || value.length !== byteCount) {
      failEvidence(code("random_invalid"), steps.persist);
    }
    return value.toString("hex");
  }

  function writeSyncedTemporary(target, bytes) {
    const digest = path.basename(target, ".json");
    const temporary = path.join(
      path.dirname(target),
      `.${digest}.${process.pid}.${randomHex()}.tmp`
    );
    let descriptor;
    try {
      descriptor = io.openSync(temporary, "wx", 0o600);
      let offset = 0;
      while (offset < bytes.length) {
        const length = Math.min(streamBufferBytes, bytes.length - offset);
        const count = io.writeSync(descriptor, bytes, offset, length, offset);
        if (!Number.isSafeInteger(count) || count <= 0 || count > length) {
          failEvidence(code("temporary_short_write"), steps.persist);
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
      throw asEvidenceError(error, code("temporary_write_failed"), steps.persist);
    }
  }

  function inspectIncompleteTemporary(filePath, target, minimumAgeMs, nowMs = Date.now()) {
    let temporaryStat;
    try {
      temporaryStat = io.lstatSync(filePath);
    } catch (error) {
      if (error?.code === "ENOENT") return "missing";
      throw asEvidenceError(error, code("temporary_inspection_failed"), steps.scan);
    }
    if (temporaryStat.isSymbolicLink() || !temporaryStat.isFile()) return "invalid";
    let publishedHardLink = false;
    try {
      const targetStat = io.lstatSync(target);
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

  function publishBytes(target, bytes, maximumBytes) {
    const prefix = path.dirname(target);
    if (!io.existsSync(prefix)) ensureDirectory(prefix);
    assertNoLinkComponents(prefix, true);
    const temporary = writeSyncedTemporary(target, bytes);
    let disposition = "created";
    try {
      assertNoLinkComponents(prefix, true);
      try {
        io.linkSync(temporary, target);
      } catch (error) {
        if (error?.code !== "EEXIST") {
          throw asEvidenceError(error, code("publish_failed"), steps.persist);
        }
        const existing = boundedReadFile(target, maximumBytes);
        if (!existing.equals(bytes)) failEvidence(code("target_conflict"), steps.persist);
        disposition = "existing-byte-identical";
      }
    } finally {
      try {
        io.unlinkSync(temporary);
      } catch (_error) {
        // Startup recovery will quarantine a surviving temporary.
      }
    }
    assertNoLinkComponents(prefix, true);
    const directoryMetadata = syncDirectory(prefix);
    const readback = boundedReadFile(target, maximumBytes);
    if (!readback.equals(bytes)) failEvidence(code("readback_mismatch"), steps.persist);
    return immutableRecord({
      disposition,
      durability: {
        fileData: "fsync-complete",
        directoryMetadata,
        readback: "verified"
      }
    });
  }

  function quarantineEntry(root, quarantineDirectory, source, reasonCode,
    identityFieldName = null, identity = null) {
    if (typeof reasonCode !== "string" || !/^[a-z][a-z0-9_]{2,79}$/u.test(reasonCode)) {
      failEvidence(code("quarantine_reason_invalid"), steps.quarantine);
    }
    if ((identityFieldName === null && identity !== null) ||
        (identityFieldName !== null &&
          (typeof identityFieldName !== "string" ||
            (identity !== null && typeof identity !== "string")))) {
      failEvidence(code("quarantine_identity_invalid"), steps.quarantine);
    }
    const expectedQuarantine = safeChild(root, [path.basename(quarantineDirectory)]);
    if (path.resolve(quarantineDirectory) !== expectedQuarantine) {
      failEvidence(code("quarantine_path_invalid"), steps.quarantine);
    }
    assertNoLinkComponents(path.dirname(source), true);
    let stat;
    try {
      stat = io.lstatSync(source);
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
        io.linkSync(source, destination);
      } catch (error) {
        if (error?.code === "ENOENT") return null;
        throw asEvidenceError(error, code("quarantine_move_failed"), steps.quarantine);
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
          throw asEvidenceError(error, code("quarantine_move_failed"), steps.quarantine);
        }
      }
    } else {
      try {
        if (io.existsSync(destination)) {
          failEvidence(code("quarantine_collision"), steps.quarantine);
        }
        io.renameSync(source, destination);
      } catch (error) {
        if (error?.code === "ENOENT") return null;
        throw asEvidenceError(error, code("quarantine_move_failed"), steps.quarantine);
      }
    }
    syncDirectory(path.dirname(source));
    syncDirectory(quarantineDirectory);
    const result = { quarantineId, reasonCode };
    if (identityFieldName !== null) result[identityFieldName] = identity;
    return immutableRecord(result);
  }

  return Object.freeze({
    assertNoLinkComponents,
    boundedDirectoryEntries,
    boundedReadFile,
    ensureDirectory,
    ensureRoot,
    inspectIncompleteTemporary,
    normalizeRoot,
    publishBytes,
    quarantineEntry,
    randomHex,
    safeChild,
    syncDirectory,
    writeSyncedTemporary
  });
}

module.exports = Object.freeze({
  createVnextCreateOnlyFiles,
  immutableRecord
});
