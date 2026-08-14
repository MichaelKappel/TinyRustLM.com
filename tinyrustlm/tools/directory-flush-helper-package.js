#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");
const { canonicalizeVnextJcsBytes } = require("./vnext-jcs.js");

const directoryFlushHelperVerificationProfileId =
  "tinyrustlm.vnext.directory-flush-helper-verification.v1";
const directoryFlushHelperVerificationProfileSha256 =
  "02d03e864e24d14451dd24f4e684c918bfdd2264cdd9d534a196b6d268f4e04e";
const repositoryRoot = resolveRepositoryRoot();
const profilePath = path.join(
  repositoryRoot,
  "contracts",
  "vnext",
  "directory-flush-helper-verification-profile.v1.json"
);
const sha256Pattern = /^[a-f0-9]{64}$/u;

function fail(code) {
  const error = new Error("Directory flush helper package materialization failed");
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
    fs.existsSync(path.join(candidate, "tinyrustlm", "package.json")) &&
    fs.existsSync(path.join(candidate, "contracts", "vnext",
      "directory-flush-helper-verification-profile.v1.json")));
  if (matches.length !== 1) fail("directory_flush_package_repository_root_invalid");
  return matches[0];
}

function assertDataObject(value, expectedKeys, code) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    fail(code);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  if (keys.join(",") !== [...expectedKeys].sort().join(",") ||
      keys.some((key) => !descriptors[key].enumerable ||
        !("value" in descriptors[key]) || descriptors[key].get !== undefined ||
        descriptors[key].set !== undefined)) {
    fail(code);
  }
}

function exactStringArray(value, expected, code) {
  if (!Array.isArray(value) || value.length !== expected.length ||
      value.some((entry, index) => entry !== expected[index])) {
    fail(code);
  }
}

function loadProfile() {
  let bytes;
  let profile;
  try {
    bytes = fs.readFileSync(profilePath);
    profile = parseStrictJson(bytes);
  } catch (_error) {
    fail("directory_flush_package_profile_invalid");
  }
  if (sha256(bytes) !== directoryFlushHelperVerificationProfileSha256) {
    fail("directory_flush_package_profile_identity_mismatch");
  }
  assertDataObject(profile, [
    "acceptedPackageTrustClasses", "canonicalJsonProfile", "caseFields",
    "caseReceiptFields", "cases", "clientProfileId", "clientProfileSha256",
    "clientSourceClosureSha256", "directoryFlushProfileId",
    "directoryFlushProfileSha256", "executionClass", "hashAlgorithm",
    "helperSourceClosureMembers", "limits", "nonClaims", "package",
    "packageBuilderSourceClosureMembers", "packageManifestFields",
    "packageManifestSchema", "packageProvenanceFields",
    "packageProvenanceSchema", "pathPolicy", "profileId", "receiptFields",
    "receiptFile", "receiptPolicy", "schema", "scratchCleanup", "status",
    "supportedRuntimeIdentifiers", "verdict", "verificationSchema",
    "verificationSourceClosureMembers", "versionPolicy"
  ], "directory_flush_package_profile_invalid");
  if (profile.schema !==
        "tinyrustlm.vnext.directory_flush_helper_verification_profile.v1" ||
      profile.profileId !== directoryFlushHelperVerificationProfileId ||
      profile.status !== "frozen" ||
      profile.versionPolicy !== "single-current-profile-no-compatibility-reader" ||
      profile.canonicalJsonProfile !==
        "rfc8785-jcs+tinyrustlm.strict-json.v1" ||
      profile.hashAlgorithm !== "sha256" ||
      profile.directoryFlushProfileId !==
        "tinyrustlm.vnext.directory-flush.v1" ||
      !sha256Pattern.test(profile.directoryFlushProfileSha256) ||
      profile.clientProfileId !==
        "tinyrustlm.vnext.directory-flush-client.v1" ||
      !sha256Pattern.test(profile.clientProfileSha256) ||
      !sha256Pattern.test(profile.clientSourceClosureSha256) ||
      profile.packageManifestSchema !==
        "tinyrustlm.vnext.directory_flush_helper_manifest.v1" ||
      profile.packageProvenanceSchema !==
        "tinyrustlm.vnext.directory_flush_helper_provenance.v1") {
    fail("directory_flush_package_profile_invalid");
  }
  exactStringArray(profile.acceptedPackageTrustClasses,
    ["local-test-build", "release-package"],
    "directory_flush_package_profile_invalid");
  exactStringArray(profile.supportedRuntimeIdentifiers,
    ["linux-arm64", "linux-x64", "win-x64"],
    "directory_flush_package_profile_invalid");
  exactStringArray(profile.helperSourceClosureMembers, [
    "Cargo.lock",
    "Cargo.toml",
    "contracts/vnext/directory-flush-profile.v1.json",
    "rust/crates/tinyrustlm-durability/Cargo.toml",
    "rust/crates/tinyrustlm-durability/src/bin/tinyrustlm-directory-flush.rs",
    "rust/crates/tinyrustlm-durability/src/lib.rs"
  ], "directory_flush_package_profile_invalid");
  exactStringArray(profile.packageBuilderSourceClosureMembers, [
    "contracts/vnext/directory-flush-client-profile.v1.json",
    "contracts/vnext/directory-flush-helper-verification-profile.v1.json",
    "tinyrustlm/tools/directory-flush-helper-package.js",
    "tinyrustlm/tools/strict-json.js",
    "tinyrustlm/tools/vnext-jcs.js"
  ], "directory_flush_package_profile_invalid");
  assertDataObject(profile.package, [
    "createOnlyOutput", "exactFileSetRequired", "executableMaximumBytes",
    "manifestFile", "manifestMaximumBytes", "provenanceFile",
    "provenanceMaximumBytes", "releaseSourceWorktreeCleanRequired"
  ], "directory_flush_package_profile_invalid");
  if (profile.package.manifestFile !==
        "directory-flush-helper-manifest.v1.json" ||
      profile.package.provenanceFile !==
        "directory-flush-helper-provenance.v1.json" ||
      profile.package.executableMaximumBytes !== 67_108_864 ||
      profile.package.provenanceMaximumBytes !== 32_768 ||
      profile.package.manifestMaximumBytes !== 16_384 ||
      profile.package.exactFileSetRequired !== true ||
      profile.package.createOnlyOutput !== true ||
      profile.package.releaseSourceWorktreeCleanRequired !== true) {
    fail("directory_flush_package_profile_invalid");
  }
  exactStringArray(profile.packageManifestFields, [
    "architecture", "buildProfile", "directoryFlushProfileId",
    "directoryFlushProfileSha256", "executableByteCount", "executableFile",
    "executableSha256", "operatingSystem", "runtimeIdentifier", "schema",
    "sourceClosureSha256", "trustClass"
  ], "directory_flush_package_profile_invalid");
  exactStringArray(profile.packageProvenanceFields, [
    "architecture", "buildProfile", "cargoLockSha256", "cargoVersion",
    "directoryFlushProfileSha256", "executableSha256", "operatingSystem",
    "packageBuilderSourceClosureSha256", "runtimeIdentifier", "rustcVersion",
    "schema", "sourceClosureSha256", "sourceRevision", "sourceWorktreeClean",
    "trustClass"
  ], "directory_flush_package_profile_invalid");
  return Object.freeze(profile);
}

const profile = loadProfile();

function normalizeAbsolutePath(value, code) {
  if (typeof value !== "string" || value.length < 3 ||
      value.length > profile.limits.maximumPathCodeUnits || value.includes("\0") ||
      !path.isAbsolute(value) || path.resolve(value) !== path.normalize(value)) {
    fail(code);
  }
  const resolved = path.resolve(value);
  if (process.platform === "win32" &&
      !/^[A-Za-z]:\\$/u.test(path.parse(resolved).root)) {
    fail(code);
  }
  return resolved;
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
      fail("directory_flush_package_path_invalid");
    }
    if (stat.isSymbolicLink()) fail("directory_flush_package_path_link");
    const isLeaf = index === parts.length - 1;
    if (!isLeaf && !stat.isDirectory()) fail("directory_flush_package_path_invalid");
    if (isLeaf && leafKind === "file" && !stat.isFile()) {
      fail("directory_flush_package_path_invalid");
    }
    if (isLeaf && leafKind === "directory" && !stat.isDirectory()) {
      fail("directory_flush_package_path_invalid");
    }
  }
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
        // The typed failure or completed identity remains authoritative.
      }
    }
  }
}

function closureSha256(relativePaths, code) {
  const members = relativePaths.map((relativePath) => {
    if (typeof relativePath !== "string" || relativePath.length === 0 ||
        relativePath.includes("\\") || relativePath.startsWith("/") ||
        relativePath.split("/").some((part) => !part || part === "." ||
          part === "..")) {
      fail("directory_flush_package_profile_invalid");
    }
    const filePath = path.resolve(repositoryRoot, ...relativePath.split("/"));
    if (path.relative(repositoryRoot, filePath).startsWith("..")) {
      fail("directory_flush_package_profile_invalid");
    }
    const identity = hashRegularFile(
      filePath,
      profile.limits.maximumSourceMemberBytes,
      code
    );
    return Object.freeze({
      byteCount: identity.byteCount,
      path: relativePath,
      sha256: identity.sha256
    });
  });
  return sha256(canonicalizeVnextJcsBytes(members));
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

function sourceState() {
  const revision = commandOutput("git", ["rev-parse", "HEAD"],
    "directory_flush_package_git_failed");
  if (!/^[a-f0-9]{40}$/u.test(revision)) {
    fail("directory_flush_package_git_failed");
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
    fail("directory_flush_package_git_failed");
  }
  return Object.freeze({ revision, worktreeClean: status.stdout.length === 0 });
}

function platformIdentity() {
  const operatingSystem = process.platform === "win32" ? "windows" :
    process.platform === "linux" ? "linux" : "unsupported";
  const architecture = process.arch === "x64" ? "x86_64" :
    process.arch === "arm64" ? "aarch64" : process.arch;
  const runtimeIdentifier = operatingSystem === "windows" ? `win-${process.arch}` :
    operatingSystem === "linux" ? `linux-${process.arch}` : "unsupported";
  if (!profile.supportedRuntimeIdentifiers.includes(runtimeIdentifier)) {
    fail("directory_flush_package_platform_unsupported");
  }
  return Object.freeze({
    architecture,
    executableFile: operatingSystem === "windows"
      ? "tinyrustlm-directory-flush.exe"
      : "tinyrustlm-directory-flush",
    operatingSystem,
    runtimeIdentifier
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
      if (count <= 0) fail("directory_flush_package_write_failed");
      offset += count;
    }
    fs.fsyncSync(descriptor);
  } catch (error) {
    if (error?.code === "directory_flush_package_write_failed") throw error;
    fail("directory_flush_package_write_failed");
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch (_error) {
        // Exact readback below decides whether materialization succeeded.
      }
    }
  }
}

function fsyncFile(filePath) {
  let descriptor;
  try {
    descriptor = fs.openSync(filePath, "r+");
    fs.fsyncSync(descriptor);
  } catch (_error) {
    fail("directory_flush_package_write_failed");
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch (_error) {
        // Exact readback below decides whether materialization succeeded.
      }
    }
  }
}

function removeOwnedOutput(outputRoot, outputParent) {
  const relative = path.relative(outputParent, outputRoot);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative) ||
      relative.includes(path.sep)) {
    return;
  }
  try {
    fs.rmSync(outputRoot, { force: true, recursive: true });
  } catch (_error) {
    // Preserve the original bounded materialization failure.
  }
}

function materializeDirectoryFlushHelperPackage(options) {
  assertDataObject(options, [
    "buildProfile", "executablePath", "outputRoot", "trustClass"
  ], "directory_flush_package_options_invalid");
  if (!["debug", "release"].includes(options.buildProfile) ||
      !profile.acceptedPackageTrustClasses.includes(options.trustClass) ||
      (options.trustClass === "release-package" &&
        options.buildProfile !== "release")) {
    fail("directory_flush_package_options_invalid");
  }
  const platform = platformIdentity();
  const executablePath = normalizeAbsolutePath(
    options.executablePath,
    "directory_flush_package_executable_invalid"
  );
  if (path.basename(executablePath) !== platform.executableFile) {
    fail("directory_flush_package_executable_invalid");
  }
  if (path.basename(path.dirname(executablePath)) !== options.buildProfile) {
    fail("directory_flush_package_build_profile_mismatch");
  }
  assertNoLinkComponents(executablePath, "file");
  const executableIdentity = hashRegularFile(
    executablePath,
    profile.package.executableMaximumBytes,
    "directory_flush_package_executable_invalid"
  );
  const outputRoot = normalizeAbsolutePath(
    options.outputRoot,
    "directory_flush_package_output_invalid"
  );
  if (fs.existsSync(outputRoot)) fail("directory_flush_package_output_exists");
  const outputParent = path.dirname(outputRoot);
  assertNoLinkComponents(outputParent, "directory");
  const source = sourceState();
  if (options.trustClass === "release-package" && !source.worktreeClean) {
    fail("directory_flush_package_release_source_dirty");
  }
  const helperSourceClosureSha256 = closureSha256(
    profile.helperSourceClosureMembers,
    "directory_flush_package_source_read_failed"
  );
  const packageBuilderSourceClosureSha256 = closureSha256(
    profile.packageBuilderSourceClosureMembers,
    "directory_flush_package_source_read_failed"
  );
  const directoryFlushProfileBytes = fs.readFileSync(path.join(
    repositoryRoot,
    "contracts",
    "vnext",
    "directory-flush-profile.v1.json"
  ));
  if (sha256(directoryFlushProfileBytes) !==
      profile.directoryFlushProfileSha256) {
    fail("directory_flush_package_profile_invalid");
  }

  let ownsOutputRoot = false;
  try {
    fs.mkdirSync(outputRoot, { mode: 0o700, recursive: false });
    ownsOutputRoot = true;
    const outputExecutablePath = path.join(outputRoot, platform.executableFile);
    fs.copyFileSync(executablePath, outputExecutablePath, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(outputExecutablePath, 0o700);
    fsyncFile(outputExecutablePath);
    const outputExecutableIdentity = hashRegularFile(
      outputExecutablePath,
      profile.package.executableMaximumBytes,
      "directory_flush_package_executable_readback_failed"
    );
    const sourceExecutableReadback = hashRegularFile(
      executablePath,
      profile.package.executableMaximumBytes,
      "directory_flush_package_executable_changed"
    );
    if (outputExecutableIdentity.byteCount !== executableIdentity.byteCount ||
        outputExecutableIdentity.sha256 !== executableIdentity.sha256 ||
        sourceExecutableReadback.byteCount !== executableIdentity.byteCount ||
        sourceExecutableReadback.sha256 !== executableIdentity.sha256) {
      fail("directory_flush_package_executable_changed");
    }

    const provenance = Object.freeze({
      architecture: platform.architecture,
      buildProfile: options.buildProfile,
      cargoLockSha256: sha256(fs.readFileSync(path.join(repositoryRoot, "Cargo.lock"))),
      cargoVersion: commandOutput(
        process.env.CARGO || "cargo",
        ["--version"],
        "directory_flush_package_cargo_version_failed"
      ),
      directoryFlushProfileSha256: profile.directoryFlushProfileSha256,
      executableSha256: executableIdentity.sha256,
      operatingSystem: platform.operatingSystem,
      packageBuilderSourceClosureSha256,
      runtimeIdentifier: platform.runtimeIdentifier,
      rustcVersion: commandOutput(
        process.env.RUSTC || "rustc",
        ["--version"],
        "directory_flush_package_rustc_version_failed"
      ),
      schema: profile.packageProvenanceSchema,
      sourceClosureSha256: helperSourceClosureSha256,
      sourceRevision: source.revision,
      sourceWorktreeClean: source.worktreeClean,
      trustClass: options.trustClass
    });
    assertDataObject(provenance, profile.packageProvenanceFields,
      "directory_flush_package_provenance_invalid");
    const provenanceBytes = canonicalizeVnextJcsBytes(provenance);
    if (provenanceBytes.length <= 0 ||
        provenanceBytes.length > profile.package.provenanceMaximumBytes) {
      fail("directory_flush_package_provenance_invalid");
    }
    writeExclusive(
      path.join(outputRoot, profile.package.provenanceFile),
      provenanceBytes,
      0o600
    );

    const manifest = Object.freeze({
      architecture: platform.architecture,
      buildProfile: options.buildProfile,
      directoryFlushProfileId: profile.directoryFlushProfileId,
      directoryFlushProfileSha256: profile.directoryFlushProfileSha256,
      executableByteCount: executableIdentity.byteCount,
      executableFile: platform.executableFile,
      executableSha256: executableIdentity.sha256,
      operatingSystem: platform.operatingSystem,
      runtimeIdentifier: platform.runtimeIdentifier,
      schema: profile.packageManifestSchema,
      sourceClosureSha256: helperSourceClosureSha256,
      trustClass: options.trustClass
    });
    assertDataObject(manifest, profile.packageManifestFields,
      "directory_flush_package_manifest_invalid");
    const manifestBytes = canonicalizeVnextJcsBytes(manifest);
    if (manifestBytes.length <= 0 ||
        manifestBytes.length > profile.package.manifestMaximumBytes) {
      fail("directory_flush_package_manifest_invalid");
    }
    writeExclusive(
      path.join(outputRoot, profile.package.manifestFile),
      manifestBytes,
      0o600
    );

    const entries = fs.readdirSync(outputRoot).sort();
    const expectedEntries = [
      profile.package.manifestFile,
      profile.package.provenanceFile,
      platform.executableFile
    ].sort();
    if (entries.join(",") !== expectedEntries.join(",")) {
      fail("directory_flush_package_readback_failed");
    }
    const manifestReadback = fs.readFileSync(path.join(
      outputRoot, profile.package.manifestFile));
    const provenanceReadback = fs.readFileSync(path.join(
      outputRoot, profile.package.provenanceFile));
    const finalExecutable = hashRegularFile(
      outputExecutablePath,
      profile.package.executableMaximumBytes,
      "directory_flush_package_readback_failed"
    );
    const finalSource = sourceState();
    if (!manifestReadback.equals(manifestBytes) ||
        !provenanceReadback.equals(provenanceBytes) ||
        finalExecutable.byteCount !== executableIdentity.byteCount ||
        finalExecutable.sha256 !== executableIdentity.sha256 ||
        finalSource.revision !== source.revision ||
        finalSource.worktreeClean !== source.worktreeClean) {
      fail("directory_flush_package_readback_failed");
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
    if (ownsOutputRoot) removeOwnedOutput(outputRoot, outputParent);
    throw error;
  }
}

function main() {
  const [executablePath, outputRoot, buildProfile, trustClass, ...extra] =
    process.argv.slice(2);
  if (!executablePath || !outputRoot || !buildProfile || !trustClass ||
      extra.length !== 0) {
    fail("directory_flush_package_cli_invalid");
  }
  const result = materializeDirectoryFlushHelperPackage({
    buildProfile,
    executablePath,
    outputRoot,
    trustClass
  });
  process.stdout.write(`${JSON.stringify({
    executableSha256: result.executableSha256,
    helperSourceClosureSha256: result.helperSourceClosureSha256,
    manifestSha256: result.manifestSha256,
    packageBuilderSourceClosureSha256:
      result.packageBuilderSourceClosureSha256,
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
    process.stderr.write(
      "TinyRustLM directory flush helper package materialization failed\n"
    );
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  directoryFlushHelperVerificationProfileId,
  directoryFlushHelperVerificationProfileSha256,
  materializeDirectoryFlushHelperPackage
});
