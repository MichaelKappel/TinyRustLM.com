"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const siteRoot = path.resolve(__dirname, "..");
const artifactRoots = [path.join(siteRoot, "artifacts"), path.resolve(siteRoot, "../artifacts")];
const prefix = "tinyrustlm-operation-";
const markerSuffix = ".owner.v2";

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
  // Keep ownership outside the disposable tree, including its final rmdir.
  const markerPath = rootPath + markerSuffix;
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

/** Verify the external marker even when only terminal marker retirement remains. */
function verifyOwnershipMarker(owned) {
  invariant(owned && typeof owned === "object", "Operation ownership record is required");
  requireCanonicalArtifactPath(owned.rootPath);
  invariant(samePath(path.dirname(owned.rootPath), owned.temporaryParent) &&
    path.basename(owned.rootPath).startsWith(prefix), "Operation parent or name changed");
  invariant(samePath(owned.markerPath, owned.rootPath + markerSuffix),
    "Operation marker path changed");
  const markerStat = fs.lstatSync(owned.markerPath, { bigint: true });
  invariant(markerStat.isFile() && !markerStat.isSymbolicLink() && markerStat.nlink === 1n &&
    markerStat.dev === owned.markerStat.dev && markerStat.ino === owned.markerStat.ino &&
    markerStat.size === BigInt(owned.markerBytes.length), "Operation marker identity changed");
  invariant(crypto.timingSafeEqual(fs.readFileSync(owned.markerPath), owned.markerBytes),
    "Operation marker content changed");
}

/** Inspect the original root; absence permits cleanup finalization, never new work. */
function inspectOwnedRoot(owned) {
  const stat = fs.lstatSync(owned.rootPath, { bigint: true, throwIfNoEntry: false });
  if (stat) invariant(stat.isDirectory() && !stat.isSymbolicLink() &&
    stat.dev === owned.rootStat.dev && stat.ino === owned.rootStat.ino,
  "Operation directory identity changed");
  return stat;
}

/** Bind live work to the original directory and external marker identities. */
function verifyOwnedTemporaryDirectory(owned) {
  verifyOwnershipMarker(owned);
  invariant(inspectOwnedRoot(owned), "Operation directory is missing");
}

/** Inventory all entries before mutation, including contained Cargo hard-link groups. */
function inventoryCleanup(owned) {
  const pending = [{ directory: owned.rootPath, depth: 0 }];
  const entries = [];
  const directories = new Map([[owned.rootPath, owned.rootStat]]);
  const hardLinks = new Map();
  let count = 0;
  while (pending.length) {
    const { directory, depth } = pending.pop();
    invariant(depth <= 32, "Operation cleanup depth exceeds its bound");
    if (directory === owned.rootPath) verifyOwnedTemporaryDirectory(owned);
    else verifyCleanupEntry(owned, { path: directory, stat: directories.get(directory) }, directories);
    for (const name of fs.readdirSync(directory)) {
      invariant(++count <= 8192, "Operation cleanup inventory exceeds its bound");
      const entry = path.join(directory, name);
      const stat = fs.lstatSync(entry, { bigint: true });
      invariant(!stat.isSymbolicLink() && (stat.isDirectory() || stat.isFile()),
        "Operation cleanup found a linked or special entry");
      entries.push({ path: entry, stat });
      if (stat.isFile()) {
        const identity = `${stat.dev}:${stat.ino}`;
        const group = hardLinks.get(identity) || { count: 0n, links: stat.nlink };
        invariant(group.links === stat.nlink, "Operation hard-link identity changed");
        group.count += 1n;
        hardLinks.set(identity, group);
      }
      if (stat.isDirectory()) {
        directories.set(entry, stat);
        pending.push({ directory: entry, depth: depth + 1 });
      }
    }
  }
  // Cargo aliases are safe only when every name belongs to this exact owned tree.
  for (const group of hardLinks.values()) {
    invariant(group.count === group.links, "Operation cleanup found an external hard link");
  }
  return { entries, directories, hardLinks };
}

/** Reject a replaced entry or ancestor immediately before its nonrecursive removal. */
function verifyCleanupEntry(owned, entry, directories) {
  verifyOwnedTemporaryDirectory(owned);
  for (let current = path.dirname(entry.path); current !== owned.rootPath;
    current = path.dirname(current)) {
    const expected = directories.get(current);
    const observed = fs.lstatSync(current, { bigint: true });
    invariant(expected && observed.isDirectory() && !observed.isSymbolicLink() &&
      observed.dev === expected.dev && observed.ino === expected.ino,
    "Operation cleanup ancestor identity changed");
  }
  const stat = fs.lstatSync(entry.path, { bigint: true });
  invariant(!stat.isSymbolicLink() && stat.dev === entry.stat.dev &&
    stat.ino === entry.stat.ino && stat.isDirectory() === entry.stat.isDirectory() &&
    (stat.isDirectory() || (stat.isFile() && stat.size === entry.stat.size &&
      stat.mtimeNs === entry.stat.mtimeNs)), "Operation cleanup entry identity changed");
  return stat;
}

/** Remove bounded, quiescent owned output; retain authority through every partial failure. */
function removeOwnedTemporaryDirectory(owned) {
  verifyOwnershipMarker(owned);
  if (inspectOwnedRoot(owned)) {
    const { entries, directories, hardLinks } = inventoryCleanup(owned);
    // Files first, then child directories before parents. New entries stop rmdir.
    for (const entry of entries.filter(value => value.stat.isFile())) {
      const stat = verifyCleanupEntry(owned, entry, directories);
      const group = hardLinks.get(`${stat.dev}:${stat.ino}`);
      invariant(stat.nlink === group.count, "Operation hard-link identity changed");
      fs.unlinkSync(entry.path);
      group.count -= 1n;
    }
    for (const entry of entries.filter(value => value.stat.isDirectory()).reverse()) {
      verifyCleanupEntry(owned, entry, directories);
      fs.rmdirSync(entry.path);
    }
    verifyOwnedTemporaryDirectory(owned);
    fs.rmdirSync(owned.rootPath);
  }
  verifyOwnershipMarker(owned);
  invariant(!inspectOwnedRoot(owned), "Operation cleanup could not be verified");
  fs.unlinkSync(owned.markerPath);
  invariant(!fs.lstatSync(owned.markerPath, { throwIfNoEntry: false }),
    "Operation marker cleanup could not be verified");
}

module.exports = Object.freeze({ createOwnedTemporaryDirectory, removeOwnedTemporaryDirectory,
  requireCanonicalArtifactPath, requireCanonicalSiteRoot, verifyOwnedTemporaryDirectory });
