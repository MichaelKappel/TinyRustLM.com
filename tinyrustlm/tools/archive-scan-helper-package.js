#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");
const { canonicalizeVnextJcsBytes } = require("./vnext-jcs.js");

const repositoryRoot = resolveRepositoryRoot();
const clientProfilePath = path.join(
  repositoryRoot,
  "contracts",
  "vnext",
  "archive-scan-client-profile.v1.json"
);
const clientProfileSha256 =
  "08bb532cd88273f5633a8693040c2108fd7fef0935f9705f34b98cb1ab405441";
const maximumSourceMemberBytes = 16 * 1024 * 1024;

function fail(code) {
  const error = new Error("Archive scan helper package materialization failed");
  error.code = code;
  throw error;
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function resolveRepositoryRoot() {
  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(__dirname, "../..")
  ];
  const matches = candidates.filter((candidate, index) =>
    candidates.indexOf(candidate) === index &&
    fs.existsSync(path.join(candidate, "Cargo.lock")) &&
    fs.existsSync(path.join(candidate, "tinyrustlm", "package.json")));
  if (matches.length !== 1) fail("archive_scan_package_repository_root_invalid");
  return matches[0];
}

function loadProfile() {
  let bytes;
  let profile;
  try {
    bytes = fs.readFileSync(clientProfilePath);
    profile = parseStrictJson(bytes);
  } catch (_error) {
    fail("archive_scan_package_profile_invalid");
  }
  if (sha256(bytes) !== clientProfileSha256 ||
      profile.profileId !== "tinyrustlm.vnext.archive-scan-client.v1" ||
      profile.packageManifestSchema !==
        "tinyrustlm.vnext.archive_scan_helper_manifest.v1" ||
      profile.packageProvenanceSchema !==
        "tinyrustlm.vnext.archive_scan_helper_provenance.v1" ||
      !Array.isArray(profile.helperSourceClosureMembers) ||
      profile.helperSourceClosureMembers.length !== 11 ||
      !Array.isArray(profile.packageBuilderSourceClosureMembers) ||
      profile.packageBuilderSourceClosureMembers.length !== 5) {
    fail("archive_scan_package_profile_invalid");
  }
  return Object.freeze(profile);
}

const profile = loadProfile();

function assertDataObject(value, expectedKeys, code) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    fail(code);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  if (keys.join(",") !== [...expectedKeys].sort().join(",") ||
      keys.some((key) => !("value" in descriptors[key]) ||
        descriptors[key].get !== undefined || descriptors[key].set !== undefined)) {
    fail(code);
  }
}

function assertNoLinkComponents(target, leafKind) {
  const resolved = path.resolve(target);
  const parsed = path.parse(resolved);
  const parts = resolved.slice(parsed.root.length).split(path.sep).filter(Boolean);
  let current = parsed.root;
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (_error) {
      fail("archive_scan_package_path_invalid");
    }
    if (stat.isSymbolicLink()) fail("archive_scan_package_path_link");
    const isLeaf = index === parts.length - 1;
    if (!isLeaf && !stat.isDirectory()) fail("archive_scan_package_path_invalid");
    if (isLeaf && leafKind === "file" && !stat.isFile()) {
      fail("archive_scan_package_path_invalid");
    }
    if (isLeaf && leafKind === "directory" && !stat.isDirectory()) {
      fail("archive_scan_package_path_invalid");
    }
  }
}

function normalizeAbsolutePath(value, code) {
  if (typeof value !== "string" || value.length < 3 || value.length > 4_096 ||
      value.includes("\0") || !path.isAbsolute(value) ||
      path.resolve(value) !== path.normalize(value)) {
    fail(code);
  }
  const resolved = path.resolve(value);
  if (process.platform === "win32" &&
      !/^[A-Za-z]:\\$/u.test(path.parse(resolved).root)) {
    fail(code);
  }
  return resolved;
}

function hashRegularFile(filePath, maximumBytes, code) {
  let descriptor;
  try {
    const linkStat = fs.lstatSync(filePath);
    if (!linkStat.isFile() || linkStat.isSymbolicLink() || linkStat.size <= 0 ||
        linkStat.size > maximumBytes) {
      fail(code);
    }
    descriptor = fs.openSync(filePath,
      Number(fs.constants.O_RDONLY) | Number(fs.constants.O_NOFOLLOW || 0));
    const before = fs.fstatSync(descriptor);
    if (!before.isFile() || before.size !== linkStat.size ||
        (linkStat.dev && before.dev && linkStat.dev !== before.dev) ||
        (linkStat.ino && before.ino && linkStat.ino !== before.ino)) {
      fail(code);
    }
    const hash = crypto.createHash("sha256");
    const buffer = Buffer.allocUnsafe(65_536);
    let byteCount = 0;
    while (byteCount < before.size) {
      const count = fs.readSync(descriptor, buffer, 0,
        Math.min(buffer.length, before.size - byteCount), byteCount);
      if (count <= 0) fail(code);
      hash.update(buffer.subarray(0, count));
      byteCount += count;
    }
    const after = fs.fstatSync(descriptor);
    if (after.size !== before.size || after.mtimeMs !== before.mtimeMs ||
        after.ctimeMs !== before.ctimeMs) {
      fail(code);
    }
    return Object.freeze({ byteCount, sha256: hash.digest("hex") });
  } catch (error) {
    if (error?.code === code) throw error;
    fail(code);
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch (_error) {
        // A bounded identity or typed failure is already authoritative.
      }
    }
  }
}

function closureSha256(relativePaths) {
  const members = relativePaths.map((relativePath) => {
    if (typeof relativePath !== "string" || relativePath.length === 0 ||
        relativePath.includes("\\") || relativePath.startsWith("/") ||
        relativePath.split("/").some((part) => !part || part === "." || part === "..")) {
      fail("archive_scan_package_profile_invalid");
    }
    const filePath = path.resolve(repositoryRoot, ...relativePath.split("/"));
    if (path.relative(repositoryRoot, filePath).startsWith("..")) {
      fail("archive_scan_package_profile_invalid");
    }
    const identity = hashRegularFile(
      filePath,
      maximumSourceMemberBytes,
      "archive_scan_package_source_read_failed"
    );
    return Object.freeze({
      byteCount: identity.byteCount,
      path: relativePath,
      sha256: identity.sha256
    });
  });
  return sha256(canonicalizeVnextJcsBytes(members));
}

function commandOutput(file, argumentsList, code) {
  const result = childProcess.spawnSync(file, argumentsList, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: commandEnvironment(),
    maxBuffer: 128 * 1024,
    shell: false,
    windowsHide: true
  });
  if (result.error !== undefined || result.status !== 0 || result.signal !== null ||
      result.stderr.length !== 0) {
    fail(code);
  }
  const output = result.stdout.trim();
  if (output.length === 0 || output.length > 256 || output.includes("\0") ||
      output.includes("\r") || output.includes("\n")) {
    fail(code);
  }
  return output;
}

function commandEnvironment() {
  const environment = {};
  for (const name of [
    "CARGO_HOME", "HOME", "PATH", "PATHEXT", "RUSTUP_HOME", "SystemRoot",
    "USERPROFILE"
  ]) {
    if (typeof process.env[name] === "string" && process.env[name].length > 0) {
      environment[name] = process.env[name];
    }
  }
  return environment;
}

function sourceState() {
  const revision = commandOutput("git", ["rev-parse", "HEAD"],
    "archive_scan_package_git_failed");
  if (!/^[a-f0-9]{40}$/u.test(revision)) {
    fail("archive_scan_package_git_failed");
  }
  const status = childProcess.spawnSync("git", [
    "status", "--porcelain=v1", "--untracked-files=all"
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: commandEnvironment(),
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
    windowsHide: true
  });
  if (status.error !== undefined || status.status !== 0 || status.signal !== null ||
      status.stderr.length !== 0) {
    fail("archive_scan_package_git_failed");
  }
  return Object.freeze({
    revision,
    worktreeClean: status.stdout.length === 0
  });
}

function platformIdentity() {
  const operatingSystem = process.platform === "win32" ? "windows" :
    process.platform === "darwin" ? "macos" : process.platform;
  const architecture = process.arch === "x64" ? "x86_64" :
    process.arch === "arm64" ? "aarch64" : process.arch;
  const operatingSystemName = process.platform === "win32" ? "win" :
    process.platform === "darwin" ? "osx" : process.platform;
  return Object.freeze({
    architecture,
    executableFile: process.platform === "win32"
      ? "tinyrustlm-archive-scan.exe"
      : "tinyrustlm-archive-scan",
    operatingSystem,
    runtimeIdentifier: `${operatingSystemName}-${process.arch}`
  });
}

function writeExclusive(filePath, bytes, mode) {
  let descriptor;
  try {
    descriptor = fs.openSync(filePath, "wx", mode);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.writeSync(
        descriptor,
        bytes,
        offset,
        bytes.length - offset,
        offset
      );
      if (count <= 0) fail("archive_scan_package_write_failed");
      offset += count;
    }
    fs.fsyncSync(descriptor);
  } catch (_error) {
    fail("archive_scan_package_write_failed");
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch (_error) {
        // The materialization attempt will fail or exact readback will reject it.
      }
    }
  }
}

function materializeArchiveScanHelperPackage(options) {
  assertDataObject(options, [
    "buildProfile", "executablePath", "outputRoot", "trustClass"
  ], "archive_scan_package_options_invalid");
  if (!["debug", "release"].includes(options.buildProfile) ||
      !profile.package.acceptedTrustClasses.includes(options.trustClass) ||
      (options.trustClass === "release-package" && options.buildProfile !== "release")) {
    fail("archive_scan_package_options_invalid");
  }
  const platform = platformIdentity();
  const executablePath = normalizeAbsolutePath(
    options.executablePath,
    "archive_scan_package_executable_invalid"
  );
  if (path.basename(executablePath) !== platform.executableFile) {
    fail("archive_scan_package_executable_invalid");
  }
  if (path.basename(path.dirname(executablePath)) !== options.buildProfile) {
    fail("archive_scan_package_build_profile_mismatch");
  }
  assertNoLinkComponents(executablePath, "file");
  const executableIdentity = hashRegularFile(
    executablePath,
    profile.package.executableMaximumBytes,
    "archive_scan_package_executable_invalid"
  );
  const outputRoot = normalizeAbsolutePath(
    options.outputRoot,
    "archive_scan_package_output_invalid"
  );
  if (fs.existsSync(outputRoot)) fail("archive_scan_package_output_exists");
  const outputParent = path.dirname(outputRoot);
  assertNoLinkComponents(outputParent, "directory");
  const source = sourceState();
  if (options.trustClass === "release-package" && !source.worktreeClean) {
    fail("archive_scan_package_release_source_dirty");
  }
  const helperSourceClosureSha256 = closureSha256(
    profile.helperSourceClosureMembers
  );
  const packageBuilderSourceClosureSha256 = closureSha256(
    profile.packageBuilderSourceClosureMembers
  );
  let ownsOutputRoot = false;
  try {
    fs.mkdirSync(outputRoot, { mode: 0o700, recursive: false });
    ownsOutputRoot = true;
    const outputExecutablePath = path.join(outputRoot, platform.executableFile);
    fs.copyFileSync(executablePath, outputExecutablePath, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(outputExecutablePath, 0o700);
    const outputExecutableIdentity = hashRegularFile(
      outputExecutablePath,
      profile.package.executableMaximumBytes,
      "archive_scan_package_executable_readback_failed"
    );
    const sourceExecutableReadback = hashRegularFile(
      executablePath,
      profile.package.executableMaximumBytes,
      "archive_scan_package_executable_changed"
    );
    if (outputExecutableIdentity.byteCount !== executableIdentity.byteCount ||
        outputExecutableIdentity.sha256 !== executableIdentity.sha256 ||
        sourceExecutableReadback.byteCount !== executableIdentity.byteCount ||
        sourceExecutableReadback.sha256 !== executableIdentity.sha256) {
      fail("archive_scan_package_executable_changed");
    }
    const admissionProfileBytes = fs.readFileSync(path.join(
      repositoryRoot, "contracts", "vnext", "archive-admission-profile.v1.json"));
    const processProfileBytes = fs.readFileSync(path.join(
      repositoryRoot, "contracts", "vnext", "archive-scan-process-profile.v1.json"));
    if (sha256(admissionProfileBytes) !== profile.admissionProfileSha256 ||
        sha256(processProfileBytes) !== profile.processProfileSha256) {
      fail("archive_scan_package_profile_invalid");
    }
    const provenance = Object.freeze({
      architecture: platform.architecture,
      buildProfile: options.buildProfile,
      cargoLockSha256: sha256(fs.readFileSync(path.join(repositoryRoot, "Cargo.lock"))),
      cargoVersion: commandOutput(
        process.env.CARGO || "cargo",
        ["--version"],
        "archive_scan_package_cargo_version_failed"
      ),
      executableSha256: executableIdentity.sha256,
      operatingSystem: platform.operatingSystem,
      packageBuilderSourceClosureSha256,
      processProfileSha256: profile.processProfileSha256,
      runtimeIdentifier: platform.runtimeIdentifier,
      rustcVersion: commandOutput(
        process.env.RUSTC || "rustc",
        ["--version"],
        "archive_scan_package_rustc_version_failed"
      ),
      schema: profile.packageProvenanceSchema,
      sourceClosureSha256: helperSourceClosureSha256,
      sourceRevision: source.revision,
      sourceWorktreeClean: source.worktreeClean,
      trustClass: options.trustClass
    });
    const provenanceBytes = canonicalizeVnextJcsBytes(provenance);
    writeExclusive(
      path.join(outputRoot, profile.package.provenanceFile),
      provenanceBytes,
      0o600
    );
    const manifest = Object.freeze({
      admissionProfileId: profile.admissionProfileId,
      admissionProfileSha256: profile.admissionProfileSha256,
      architecture: platform.architecture,
      buildProfile: options.buildProfile,
      executableByteCount: executableIdentity.byteCount,
      executableFile: platform.executableFile,
      executableSha256: executableIdentity.sha256,
      operatingSystem: platform.operatingSystem,
      processProfileId: profile.processProfileId,
      processProfileSha256: profile.processProfileSha256,
      provenanceByteCount: provenanceBytes.length,
      provenanceFile: profile.package.provenanceFile,
      provenanceSha256: sha256(provenanceBytes),
      runtimeIdentifier: platform.runtimeIdentifier,
      schema: profile.packageManifestSchema,
      sourceClosureSha256: helperSourceClosureSha256,
      trustClass: options.trustClass
    });
    const manifestBytes = canonicalizeVnextJcsBytes(manifest);
    writeExclusive(
      path.join(outputRoot, profile.package.manifestFile),
      manifestBytes,
      0o600
    );
    const entries = fs.readdirSync(outputRoot).sort();
    if (entries.join(",") !== [
      profile.package.manifestFile,
      profile.package.provenanceFile,
      platform.executableFile
    ].sort().join(",")) {
      fail("archive_scan_package_readback_failed");
    }
    const manifestReadback = fs.readFileSync(path.join(
      outputRoot, profile.package.manifestFile));
    const provenanceReadback = fs.readFileSync(path.join(
      outputRoot, profile.package.provenanceFile));
    if (!manifestReadback.equals(manifestBytes) ||
        !provenanceReadback.equals(provenanceBytes)) {
      fail("archive_scan_package_readback_failed");
    }
    return Object.freeze({
      executableSha256: executableIdentity.sha256,
      helperSourceClosureSha256,
      manifestSha256: sha256(manifestBytes),
      outputRoot,
      packageBuilderSourceClosureSha256,
      provenanceSha256: sha256(provenanceBytes),
      runtimeIdentifier: platform.runtimeIdentifier,
      sourceRevision: source.revision,
      sourceWorktreeClean: source.worktreeClean,
      trustClass: options.trustClass
    });
  } catch (error) {
    if (ownsOutputRoot) {
      try {
        const relative = path.relative(outputParent, outputRoot);
        if (relative && !relative.startsWith("..") && !path.isAbsolute(relative) &&
            !relative.includes(path.sep)) {
          fs.rmSync(outputRoot, { force: true, recursive: true });
        }
      } catch (_cleanupError) {
        // The original typed materialization failure remains authoritative.
      }
    }
    throw error;
  }
}

function main() {
  const [executablePath, outputRoot, buildProfile, trustClass, ...extra] =
    process.argv.slice(2);
  if (!executablePath || !outputRoot || !buildProfile || !trustClass || extra.length) {
    fail("archive_scan_package_cli_invalid");
  }
  const result = materializeArchiveScanHelperPackage({
    buildProfile,
    executablePath,
    outputRoot,
    trustClass
  });
  process.stdout.write(`${JSON.stringify({
    executableSha256: result.executableSha256,
    helperSourceClosureSha256: result.helperSourceClosureSha256,
    manifestSha256: result.manifestSha256,
    packageBuilderSourceClosureSha256: result.packageBuilderSourceClosureSha256,
    provenanceSha256: result.provenanceSha256,
    runtimeIdentifier: result.runtimeIdentifier,
    sourceRevision: result.sourceRevision,
    sourceWorktreeClean: result.sourceWorktreeClean,
    trustClass: result.trustClass
  })}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (_error) {
    process.stderr.write("TinyRustLM archive scan helper package materialization failed\n");
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  clientProfileSha256,
  materializeArchiveScanHelperPackage
});
