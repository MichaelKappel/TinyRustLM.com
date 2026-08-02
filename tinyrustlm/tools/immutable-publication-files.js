"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { syncDirectory } = require("./durable-files.js");

const maximumPublicationBytes = 4 * 1024 * 1024;

function publicSafeError(message, sourceError = null) {
  const error = new Error(message);
  error.publicSafe = true;
  const code = String(sourceError?.code || "");
  if (/^[A-Z][A-Z0-9_]{1,31}$/.test(code)) error.code = code;
  return error;
}

function sanitizeFilesystemError(error, message) {
  return error?.publicSafe === true ? error : publicSafeError(message, error);
}

function invariant(condition, message) {
  if (!condition) throw publicSafeError(message);
}

function asBuffer(payload) {
  invariant(Buffer.isBuffer(payload) || typeof payload === "string",
    "immutable publication payload must be a buffer or string");
  return Buffer.isBuffer(payload) ? payload : Buffer.from(payload, "utf8");
}

function inspectSafeDirectoryAncestry(directoryPath) {
  const rawPath = String(directoryPath || "");
  invariant(path.isAbsolute(rawPath), "Immutable publication directory must be absolute");
  const targetPath = path.resolve(rawPath);
  let existingPath = targetPath;
  while (!fs.existsSync(existingPath)) {
    const parentPath = path.dirname(existingPath);
    invariant(parentPath !== existingPath,
      "Immutable publication directory has no existing ancestor");
    existingPath = parentPath;
  }
  let cursor = existingPath;
  while (true) {
    const stat = fs.lstatSync(cursor);
    invariant(stat.isDirectory() && !stat.isSymbolicLink(),
      "Immutable publication directory ancestry is unsafe");
    const parentPath = path.dirname(cursor);
    if (parentPath === cursor) break;
    cursor = parentPath;
  }
  return targetPath;
}

function assertSafeDirectoryAncestry(directoryPath) {
  try {
    return inspectSafeDirectoryAncestry(directoryPath);
  } catch (error) {
    throw sanitizeFilesystemError(
      error,
      "Immutable publication directory ancestry inspection failed"
    );
  }
}

function assertSafeRegularFile(filePath) {
  try {
    const rawPath = String(filePath || "");
    invariant(path.isAbsolute(rawPath), "Release file path must be absolute");
    const targetPath = path.resolve(rawPath);
    assertSafeDirectoryAncestry(path.dirname(targetPath));
    const stat = fs.lstatSync(targetPath);
    invariant(
      stat.isFile() && !stat.isSymbolicLink(),
      "Release file must be a regular non-link file"
    );
    return Object.freeze({ filePath: targetPath, stat });
  } catch (error) {
    throw sanitizeFilesystemError(error, "Release file inspection failed");
  }
}

function ensureSafeDirectory(directoryPath) {
  try {
    const targetPath = assertSafeDirectoryAncestry(directoryPath);
    fs.mkdirSync(targetPath, { recursive: true, mode: 0o700 });
    assertSafeDirectoryAncestry(targetPath);
    const stat = fs.lstatSync(targetPath);
    invariant(stat.isDirectory() && !stat.isSymbolicLink(),
      "Immutable publication directory is unsafe");
    return targetPath;
  } catch (error) {
    throw sanitizeFilesystemError(error, "Immutable publication directory preparation failed");
  }
}

function createOwnedDirectory(directoryPath) {
  try {
    const rawPath = String(directoryPath || "");
    invariant(path.isAbsolute(rawPath), "Owned publication directory must be absolute");
    const targetPath = path.resolve(rawPath);
    invariant(!fs.existsSync(targetPath), "Owned publication directory already exists");
    const parentPath = ensureSafeDirectory(path.dirname(targetPath));
    fs.mkdirSync(targetPath, { mode: 0o700 });
    assertSafeDirectoryAncestry(targetPath);
    syncDirectory(parentPath);
    return targetPath;
  } catch (error) {
    throw sanitizeFilesystemError(error, "Owned publication directory creation failed");
  }
}

function writeTemporaryFile(targetPath, bytes) {
  const temporaryPath =
    `${targetPath}.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`;
  let descriptor;
  try {
    descriptor = fs.openSync(temporaryPath, "wx", 0o600);
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    return temporaryPath;
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    fs.rmSync(temporaryPath, { force: true });
    throw error;
  }
}

function atomicCreateExclusive(filePath, payload) {
  try {
    const rawPath = String(filePath || "");
    invariant(path.isAbsolute(rawPath), "Immutable publication path must be absolute");
    const targetPath = path.resolve(rawPath);
    const directoryPath = path.dirname(targetPath);
    const bytes = asBuffer(payload);
    invariant(bytes.length > 0 && bytes.length <= maximumPublicationBytes,
      "Immutable publication payload exceeds its bounded size");
    invariant(!path.basename(targetPath).includes(":"),
      "Immutable publication file name is unsafe");
    ensureSafeDirectory(directoryPath);
    const temporaryPath = writeTemporaryFile(targetPath, bytes);
    try {
      // A same-directory hard link publishes complete bytes and cannot replace
      // an existing immutable receipt on NTFS or ordinary Linux filesystems.
      fs.linkSync(temporaryPath, targetPath);
      fs.rmSync(temporaryPath, { force: true });
      syncDirectory(directoryPath);
      invariant(fs.readFileSync(targetPath).equals(bytes),
        "Immutable publication readback differs from committed bytes");
    } finally {
      fs.rmSync(temporaryPath, { force: true });
    }
    return targetPath;
  } catch (error) {
    throw sanitizeFilesystemError(error, "Immutable publication failed");
  }
}

module.exports = Object.freeze({
  atomicCreateExclusive,
  assertSafeDirectoryAncestry,
  assertSafeRegularFile,
  createOwnedDirectory,
  ensureSafeDirectory,
  maximumPublicationBytes
});
