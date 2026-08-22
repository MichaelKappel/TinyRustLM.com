"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "../../..");
const COMMIT_PATTERN = /^[a-f0-9]{40}$/u;
const MAXIMUM_GIT_OBJECT_BYTES = 64 * 1024 * 1024;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function requireRelativePath(relativePath, label) {
  invariant(typeof relativePath === "string" && relativePath.length > 0,
    `${label} must be a nonempty string`);
  invariant(relativePath === relativePath.replaceAll("\\", "/"),
    `${label} must use forward slashes`);
  invariant(!path.posix.isAbsolute(relativePath) &&
    !/^[a-z]:/iu.test(relativePath) &&
    path.posix.normalize(relativePath) === relativePath &&
    relativePath.split("/").every((part) => part !== "" && part !== ".."),
  `${label} is unsafe`);
}

function gitText(argumentsList) {
  return childProcess.execFileSync("git", argumentsList, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    windowsHide: true
  }).trim();
}

function gitBytes(commit, relativePath) {
  requireRelativePath(relativePath, "registered Git path");
  return childProcess.execFileSync("git", ["show", `${commit}:${relativePath}`], {
    cwd: repositoryRoot,
    encoding: "buffer",
    maxBuffer: MAXIMUM_GIT_OBJECT_BYTES,
    windowsHide: true
  });
}

function findRegistrationCommit(profilePath, profileBytes, parentCommit) {
  const candidates = gitText([
    "log", "--all", "--diff-filter=A", "--format=%H", "--", profilePath
  ]).split(/\r?\n/u).filter(Boolean);
  const matches = [];
  for (const commit of candidates) {
    if (!COMMIT_PATTERN.test(commit)) continue;
    const ancestry = gitText(["rev-list", "--parents", "-n", "1", commit])
      .split(/\s+/u);
    if (ancestry.length !== 2 || ancestry[1] !== parentCommit) continue;
    if (gitBytes(commit, profilePath).equals(profileBytes)) matches.push(commit);
  }
  invariant(matches.length === 1,
    `registered profile must have exactly one matching single-parent addition commit: ${profilePath}`);
  return matches[0];
}

function createRegisteredGitTree({ profilePath, requiredPaths, linkNodeModules = false }) {
  requireRelativePath(profilePath, "profile path");
  invariant(Array.isArray(requiredPaths) && requiredPaths.length > 0 &&
    requiredPaths.length <= 256,
    "registered Git paths are required");
  const uniquePaths = [...new Set([profilePath, ...requiredPaths])];
  for (const [index, relativePath] of uniquePaths.entries()) {
    requireRelativePath(relativePath, `registered Git path ${index}`);
  }

  const workingProfilePath = path.join(repositoryRoot, ...profilePath.split("/"));
  const workingProfileStat = fs.lstatSync(workingProfilePath);
  invariant(workingProfileStat.isFile() && !workingProfileStat.isSymbolicLink(),
    "registered profile must be a direct regular file");
  const profileBytes = fs.readFileSync(workingProfilePath);
  invariant(profileBytes.length > 0 && profileBytes.length <= 1024 * 1024,
    "registered profile has an invalid size");
  const profile = JSON.parse(profileBytes.toString("utf8"));
  invariant(COMMIT_PATTERN.test(profile.registrationParentCommit),
    "registered profile parent commit is invalid");
  const registrationCommit = findRegistrationCommit(
    profilePath, profileBytes, profile.registrationParentCommit
  );

  const ownedRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-registered-tree-"));
  const treeRoot = path.join(ownedRoot, "repository");
  fs.mkdirSync(treeRoot);
  try {
    for (const relativePath of uniquePaths) {
      const destination = path.join(treeRoot, ...relativePath.split("/"));
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, gitBytes(registrationCommit, relativePath), {
        flag: "wx"
      });
    }
    if (linkNodeModules) {
      const source = path.join(repositoryRoot, "tinyrustlm", "node_modules");
      const destination = path.join(treeRoot, "tinyrustlm", "node_modules");
      invariant(fs.statSync(source).isDirectory(), "locked Node dependencies are absent");
      fs.symlinkSync(source, destination, process.platform === "win32" ? "junction" : "dir");
    }
  } catch (error) {
    fs.rmSync(ownedRoot, { recursive: true, force: true });
    throw error;
  }

  let disposed = false;
  return Object.freeze({
    profile,
    registrationCommit,
    registrationParentCommit: profile.registrationParentCommit,
    repositoryRoot: treeRoot,
    readFile(relativePath) {
      requireRelativePath(relativePath, "registered tree read path");
      return fs.readFileSync(path.join(treeRoot, ...relativePath.split("/")));
    },
    requireModule(relativePath) {
      requireRelativePath(relativePath, "registered tree module path");
      return require(path.join(treeRoot, ...relativePath.split("/")));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const nodeModules = path.join(treeRoot, "tinyrustlm", "node_modules");
      if (fs.existsSync(nodeModules)) fs.unlinkSync(nodeModules);
      fs.rmSync(ownedRoot, { recursive: true, force: true });
    }
  });
}

module.exports = Object.freeze({ createRegisteredGitTree });
