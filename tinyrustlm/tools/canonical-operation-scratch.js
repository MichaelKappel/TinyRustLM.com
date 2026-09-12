"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const siteRoot = path.resolve(__dirname, "..");
const artifactRoots = [path.join(siteRoot, "artifacts"), path.resolve(siteRoot, "../artifacts")];
const prefix = "tinyrustlm-operation-";
const markerName = ".tinyrustlm-operation-owner.v1";

/** Reject an invalid boundary before any filesystem mutation. */
function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

/** Compare normalized paths with the host filesystem's path casing. */
function samePath(left, right) {
  const normalize = (value) => process.platform === "win32"
    ? path.resolve(value).toLowerCase() : path.resolve(value);
  return normalize(left) === normalize(right);
}

/** Require strict artifact containment and inspect even dangling linked ancestors. */
function requireCanonicalArtifactPath(value) {
  invariant(typeof value === "string" && path.isAbsolute(value),
    "Operation path must be an absolute child of canonical project artifacts");
  const target = path.resolve(value);
  invariant(artifactRoots.some((root) => {
    const relative = path.relative(root, target);
    return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative);
  }), "Operation path must be an absolute child of canonical project artifacts");
  for (let current = target; ; current = path.dirname(current)) {
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    invariant(!stat || (stat.isDirectory() && !stat.isSymbolicLink()),
      "Operation directory ancestry is not ordinary");
    if (path.dirname(current) === current) break;
  }
  return target;
}

/** Require the actual site; scratch options cannot create a second source authority. */
function requireCanonicalSiteRoot(value = siteRoot) {
  invariant(typeof value === "string" && path.isAbsolute(value) && samePath(value, siteRoot),
    "Local release checks require the canonical site root");
  requireCanonicalArtifactPath(path.join(siteRoot, "artifacts", "local-release"));
  return siteRoot;
}

/** Create one marked scratch root, exclusively beneath canonical artifacts. */
function createOwnedTemporaryDirectory(options = {}) {
  requireCanonicalSiteRoot(options.siteRoot);
  const temporaryParent = requireCanonicalArtifactPath(
    options.temporaryParent || path.join(siteRoot, "artifacts", "local-release")
  );
  fs.mkdirSync(temporaryParent, { recursive: true });
  requireCanonicalArtifactPath(temporaryParent);
  const rootPath = fs.mkdtempSync(path.join(temporaryParent, prefix));
  const rootStat = fs.lstatSync(rootPath, { bigint: true });
  const markerBytes = Buffer.from(`${crypto.randomBytes(32).toString("hex")}\n`, "utf8");
  const markerPath = path.join(rootPath, markerName);
  try {
    fs.writeFileSync(markerPath, markerBytes, { flag: "wx", mode: 0o600 });
  } catch (error) {
    // A failed exclusive marker write grants no authority over another file.
    if (fs.readdirSync(rootPath).length === 0) fs.rmdirSync(rootPath);
    throw error;
  }
  return Object.freeze({ rootPath, rootStat, markerPath, markerBytes,
    markerStat: fs.lstatSync(markerPath, { bigint: true }), temporaryParent });
}

/** Bind cleanup to the original directory and marker identities, with bounded reads. */
function verifyOwnedTemporaryDirectory(owned) {
  invariant(owned && typeof owned === "object", "Operation ownership record is required");
  requireCanonicalArtifactPath(owned.rootPath);
  invariant(samePath(path.dirname(owned.rootPath), owned.temporaryParent) &&
    path.basename(owned.rootPath).startsWith(prefix), "Operation parent or name changed");
  const rootStat = fs.lstatSync(owned.rootPath, { bigint: true });
  invariant(rootStat.dev === owned.rootStat.dev && rootStat.ino === owned.rootStat.ino,
    "Operation directory identity changed");
  invariant(samePath(owned.markerPath, path.join(owned.rootPath, markerName)),
    "Operation marker path changed");
  const markerStat = fs.lstatSync(owned.markerPath, { bigint: true });
  invariant(markerStat.isFile() && !markerStat.isSymbolicLink() && markerStat.nlink === 1n &&
    markerStat.dev === owned.markerStat.dev && markerStat.ino === owned.markerStat.ino &&
    markerStat.size === BigInt(owned.markerBytes.length), "Operation marker identity changed");
  invariant(crypto.timingSafeEqual(fs.readFileSync(owned.markerPath), owned.markerBytes),
    "Operation marker content changed");
}

/** Remove only an owned bounded ordinary tree; never follow fixture or browser links. */
function removeOwnedTemporaryDirectory(owned) {
  verifyOwnedTemporaryDirectory(owned);
  const pending = [{ directory: owned.rootPath, depth: 0 }];
  let count = 0;
  while (pending.length) {
    const { directory, depth } = pending.pop();
    invariant(depth <= 32, "Operation cleanup depth exceeds its bound");
    for (const name of fs.readdirSync(directory)) {
      invariant(++count <= 8192, "Operation cleanup inventory exceeds its bound");
      const entry = path.join(directory, name);
      const stat = fs.lstatSync(entry);
      invariant(!stat.isSymbolicLink() && (stat.isDirectory() ||
        (stat.isFile() && stat.nlink === 1)), "Operation cleanup found a linked or special entry");
      if (stat.isDirectory()) pending.push({ directory: entry, depth: depth + 1 });
    }
  }
  verifyOwnedTemporaryDirectory(owned);
  fs.rmSync(owned.rootPath, { recursive: true, force: false, maxRetries: 5, retryDelay: 100 });
  invariant(!fs.existsSync(owned.rootPath), "Operation cleanup could not be verified");
}

module.exports = Object.freeze({ createOwnedTemporaryDirectory, removeOwnedTemporaryDirectory,
  requireCanonicalArtifactPath, requireCanonicalSiteRoot, verifyOwnedTemporaryDirectory });
