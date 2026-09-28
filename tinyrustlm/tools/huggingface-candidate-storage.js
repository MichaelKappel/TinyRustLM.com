"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { requireCanonicalArtifactPath } = require("./canonical-operation-scratch.js");

const modelRoot = "D:\\LLMs\\TinyRustLM";

/** Reject a path or ownership mismatch before following or modifying it. */
function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

/** Accept a single portable filename, without Windows aliases or device names. */
function requireFilename(value) {
  invariant(typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(value) &&
    !value.endsWith(".") && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value),
  "source filename is invalid");
  return value;
}

/** Require the canonical Windows model store and ordinary existing directory ancestry. */
function requireModelOutputRoot(value) {
  invariant(process.platform === "win32" && typeof value === "string" && /^[dD]:[\\/]/.test(value),
    "model output must be an absolute path under D:\\LLMs\\TinyRustLM");
  invariant(!value.slice(3).split(/[\\/]/).some((part) => part === "." || part === ".." ||
    /[<>:"|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part)), "model output path has noncanonical segments");
  const target = path.resolve(value);
  const relative = path.relative(modelRoot, target);
  invariant(relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative),
    "model output must remain under D:\\LLMs\\TinyRustLM");
  for (let current = target; ; current = path.dirname(current)) {
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (stat) {
      invariant(stat.isDirectory() && !stat.isSymbolicLink(), "model output ancestry is not ordinary");
      invariant(fs.realpathSync.native(current).toLowerCase() === current.toLowerCase(),
        "model output ancestry resolves elsewhere");
    }
    if (path.dirname(current) === current) break;
  }
  return target;
}

/** Require an absent or ordinary, singly linked file; never follow a dangling link. */
function ordinaryFile(filePath) {
  const stat = fs.lstatSync(filePath, { throwIfNoEntry: false, bigint: true });
  invariant(!stat || (stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1n),
    "candidate file is linked or not ordinary");
  return stat;
}

/** Compare the identity and mutation metadata of one ordinary file across a bounded read. */
function sameFile(left, right) {
  return left && right && right.isFile() && right.nlink === 1n && left.dev === right.dev &&
    left.ino === right.ino && left.size === right.size && left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs;
}

/** Read at most the admitted size through an identity-checked handle, before allocating any payload. */
function readBoundedFile(filePath, maximumBytes, guard = ordinaryFile) {
  invariant(Number.isSafeInteger(maximumBytes) && maximumBytes > 0 && maximumBytes <= 32 * 1024 * 1024,
    "local read limit is invalid");
  const before = guard(filePath);
  invariant(before && before.size > 0n && before.size <= BigInt(maximumBytes),
    `${path.basename(filePath)} is outside its size limit`);
  const descriptor = fs.openSync(filePath, "r");
  try {
    invariant(sameFile(before, fs.fstatSync(descriptor, { bigint: true })), "file changed before bounded read");
    const bytes = Buffer.alloc(Number(before.size));
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(descriptor, bytes, offset, bytes.length - offset, offset);
      invariant(count > 0, "file ended during bounded read");
      offset += count;
    }
    invariant(sameFile(before, fs.fstatSync(descriptor, { bigint: true })) && sameFile(before, guard(filePath)),
      "file changed during bounded read");
    return bytes;
  } finally {
    fs.closeSync(descriptor);
  }
}

/** Capture an existing directory and recheck its identity before every guarded file operation. */
function directoryGuard(directory, requireDirectory) {
  const root = requireDirectory(directory);
  const identity = fs.lstatSync(root, { bigint: true });
  return (filePath) => {
    requireDirectory(root);
    const current = fs.lstatSync(root, { bigint: true });
    invariant(current.dev === identity.dev && current.ino === identity.ino, "candidate directory identity changed");
    if (filePath === undefined) return;
    invariant(path.dirname(filePath) === root, "candidate file escaped its directory");
    requireFilename(path.basename(filePath));
    return ordinaryFile(filePath);
  };
}

/** Hold one exclusive acquisition owner; an abandoned lock requires explicit inspection. */
async function withCandidateDirectory(directory, operation) {
  requireModelOutputRoot(directory);
  fs.mkdirSync(directory, { recursive: true });
  const guard = directoryGuard(directory, requireModelOutputRoot);
  const lock = path.join(directory, "source-acquisition.lock");
  guard(lock);
  const descriptor = fs.openSync(lock, "wx", 0o600);
  const identity = fs.fstatSync(descriptor, { bigint: true });
  /** Confirm that the lock still belongs to this exact open handle. */
  function verifyLock() {
    const current = guard(lock);
    invariant(current && current.dev === identity.dev && current.ino === identity.ino,
      "candidate acquisition lock identity changed");
  }
  try {
    fs.writeFileSync(descriptor, `${process.pid}\n`);
    return await operation((filePath) => { verifyLock(); return guard(filePath); });
  } finally {
    fs.closeSync(descriptor);
    verifyLock();
    fs.unlinkSync(lock);
  }
}

/** Validate an inventory destination without writing or requesting metadata; publication rechecks it. */
function requireCandidateInventoryPath(outputPath) {
  invariant(typeof outputPath === "string" && path.isAbsolute(outputPath) &&
    path.extname(outputPath) === ".json", "inventory output must be an absolute canonical artifact JSON path");
  const target = path.resolve(outputPath);
  requireCanonicalArtifactPath(path.dirname(target));
  requireFilename(path.basename(target));
  ordinaryFile(target);
  return target;
}

/** Publish metadata only inside a canonical artifact subdirectory, using a synced temporary file. */
function writeCandidateInventory(outputPath, report) {
  const target = requireCandidateInventoryPath(outputPath);
  const parent = path.dirname(target);
  const bytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`, "utf8");
  invariant(bytes.length <= 16 * 1024 * 1024, "candidate inventory is oversized");
  fs.mkdirSync(parent, { recursive: true });
  const guard = directoryGuard(parent, requireCanonicalArtifactPath);
  guard(target);
  const temporary = path.join(parent, `inventory-${crypto.randomUUID()}.tmp`);
  let descriptor;
  let created = false;
  try {
    guard(temporary);
    descriptor = fs.openSync(temporary, "wx", 0o600);
    created = true;
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    guard(temporary);
    guard(target);
    fs.renameSync(temporary, target);
    created = false;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (created) { guard(temporary); fs.unlinkSync(temporary); }
  }
  return target;
}

module.exports = Object.freeze({ requireFilename, requireModelOutputRoot, readBoundedFile,
  withCandidateDirectory, requireCandidateInventoryPath, writeCandidateInventory });
