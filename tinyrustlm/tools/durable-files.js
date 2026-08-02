"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function asBuffer(payload) {
  invariant(Buffer.isBuffer(payload) || typeof payload === "string",
    "durable file payload must be a buffer or string");
  return Buffer.isBuffer(payload) ? payload : Buffer.from(payload, "utf8");
}

function syncDirectory(directoryPath) {
  let descriptor;
  try {
    descriptor = fs.openSync(directoryPath, "r");
    fs.fsyncSync(descriptor);
  } catch (error) {
    if (process.platform !== "win32") throw error;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function writeSyncedTemporaryFile(targetPath, payload) {
  const temporaryPath = `${targetPath}.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`;
  let descriptor;
  try {
    descriptor = fs.openSync(temporaryPath, "wx", 0o600);
    fs.writeFileSync(descriptor, payload);
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

function verifyBytes(filePath, expected) {
  invariant(fs.readFileSync(filePath).equals(expected),
    "durable file readback differs from the committed payload");
}

function atomicCreate(filePath, payload) {
  const targetPath = path.resolve(filePath);
  const directoryPath = path.dirname(targetPath);
  const bytes = asBuffer(payload);
  fs.mkdirSync(directoryPath, { recursive: true });
  const temporaryPath = writeSyncedTemporaryFile(targetPath, bytes);
  try {
    try {
      // Publishing a hard link gives create-if-absent semantics on NTFS and
      // ordinary Linux release filesystems without exposing partial bytes.
      fs.linkSync(temporaryPath, targetPath);
    } catch (error) {
      if (!fs.existsSync(targetPath)) throw error;
      verifyBytes(targetPath, bytes);
    }
    fs.rmSync(temporaryPath, { force: true });
    syncDirectory(directoryPath);
    verifyBytes(targetPath, bytes);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
  return targetPath;
}

function atomicReplace(filePath, payload) {
  const targetPath = path.resolve(filePath);
  const directoryPath = path.dirname(targetPath);
  const bytes = asBuffer(payload);
  fs.mkdirSync(directoryPath, { recursive: true });
  const temporaryPath = writeSyncedTemporaryFile(targetPath, bytes);
  try {
    fs.renameSync(temporaryPath, targetPath);
    syncDirectory(directoryPath);
    verifyBytes(targetPath, bytes);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
  return targetPath;
}

module.exports = Object.freeze({
  atomicCreate,
  atomicReplace,
  syncDirectory
});
