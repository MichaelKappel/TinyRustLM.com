#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const {
  createVnextDirectoryFlushClient,
  directoryFlushClientProfileSha256,
  directoryFlushClientSourceClosureSha256
} = require("./vnext-directory-flush-client.js");
const { parseStrictJson } = require("./strict-json.js");
const { canonicalizeVnextJcsBytes } = require("./vnext-jcs.js");

const directoryFlushHelperVerificationProfileId =
  "tinyrustlm.vnext.directory-flush-helper-verification.v1";
const directoryFlushHelperVerificationProfileSha256 =
  "02d03e864e24d14451dd24f4e684c918bfdd2264cdd9d534a196b6d268f4e04e";
const verificationSchema =
  "tinyrustlm.vnext.directory_flush_helper_verification.v1";
const sha256Pattern = /^[a-f0-9]{64}$/u;
const sourceRevisionPattern = /^[a-f0-9]{40}$/u;
const nodeVersionPattern = /^v\d+\.\d+\.\d+$/u;
const repositoryRoot = resolveRepositoryRoot();
const profilePath = path.join(
  repositoryRoot,
  "contracts",
  "vnext",
  "directory-flush-helper-verification-profile.v1.json"
);

function fail(code) {
  const error = new Error("Directory flush helper verification failed");
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
  if (matches.length !== 1) {
    fail("directory_flush_verification_repository_root_invalid");
  }
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

function decodeCanonicalBase64(value, expectedBytes, expectedSha256, maximumBytes) {
  if (typeof value !== "string" || value.length === 0 ||
      value.length > Math.ceil(maximumBytes / 3) * 4 + 4) {
    fail("directory_flush_verification_profile_invalid");
  }
  let bytes;
  try {
    bytes = Buffer.from(value, "base64");
  } catch (_error) {
    fail("directory_flush_verification_profile_invalid");
  }
  if (bytes.length !== expectedBytes || bytes.length > maximumBytes ||
      bytes.toString("base64") !== value || sha256(bytes) !== expectedSha256) {
    fail("directory_flush_verification_profile_invalid");
  }
  return bytes;
}

function validRelativePath(value, allowRoot) {
  if (allowRoot && value === ".") return true;
  return typeof value === "string" && value.length > 0 &&
    value.length <= 1_024 && !value.includes("\\") &&
    !value.startsWith("/") && !value.endsWith("/") &&
    value.split("/").every((part) => part && part !== "." && part !== ".." &&
      /^[A-Za-z0-9._-]+$/u.test(part));
}

function loadProfile() {
  let bytes;
  let profile;
  try {
    bytes = fs.readFileSync(profilePath);
    profile = parseStrictJson(bytes);
  } catch (_error) {
    fail("directory_flush_verification_profile_invalid");
  }
  if (sha256(bytes) !== directoryFlushHelperVerificationProfileSha256) {
    fail("directory_flush_verification_profile_identity_mismatch");
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
  ], "directory_flush_verification_profile_invalid");
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
      profile.directoryFlushProfileSha256 !==
        "bb9c76715d0b35d63a9da27006ff8f88840486cf287cec24279a1020a0443ddb" ||
      profile.clientProfileId !==
        "tinyrustlm.vnext.directory-flush-client.v1" ||
      profile.clientProfileSha256 !== directoryFlushClientProfileSha256 ||
      profile.clientSourceClosureSha256 !==
        directoryFlushClientSourceClosureSha256 ||
      profile.packageManifestSchema !==
        "tinyrustlm.vnext.directory_flush_helper_manifest.v1" ||
      profile.packageProvenanceSchema !==
        "tinyrustlm.vnext.directory_flush_helper_provenance.v1" ||
      profile.verificationSchema !== verificationSchema ||
      profile.receiptFile !== "directory-flush-helper-verification.v1.json" ||
      profile.executionClass !== "native-package-fixed-directory-replay" ||
      profile.scratchCleanup !== "completed-before-receipt" ||
      profile.verdict !== "pass") {
    fail("directory_flush_verification_profile_invalid");
  }
  exactStringArray(profile.acceptedPackageTrustClasses,
    ["local-test-build", "release-package"],
    "directory_flush_verification_profile_invalid");
  exactStringArray(profile.supportedRuntimeIdentifiers,
    ["linux-arm64", "linux-x64", "win-x64"],
    "directory_flush_verification_profile_invalid");
  exactStringArray(profile.helperSourceClosureMembers, [
    "Cargo.lock",
    "Cargo.toml",
    "contracts/vnext/directory-flush-profile.v1.json",
    "rust/crates/tinyrustlm-durability/Cargo.toml",
    "rust/crates/tinyrustlm-durability/src/bin/tinyrustlm-directory-flush.rs",
    "rust/crates/tinyrustlm-durability/src/lib.rs"
  ], "directory_flush_verification_profile_invalid");
  exactStringArray(profile.packageBuilderSourceClosureMembers, [
    "contracts/vnext/directory-flush-client-profile.v1.json",
    "contracts/vnext/directory-flush-helper-verification-profile.v1.json",
    "tinyrustlm/tools/directory-flush-helper-package.js",
    "tinyrustlm/tools/strict-json.js",
    "tinyrustlm/tools/vnext-jcs.js"
  ], "directory_flush_verification_profile_invalid");
  exactStringArray(profile.verificationSourceClosureMembers, [
    "contracts/vnext/directory-flush-helper-verification-profile.v1.json",
    "tinyrustlm/tools/directory-flush-helper-verification.js",
    "tinyrustlm/tools/strict-json.js",
    "tinyrustlm/tools/vnext-jcs.js"
  ], "directory_flush_verification_profile_invalid");
  exactStringArray(profile.packageManifestFields, [
    "architecture", "buildProfile", "directoryFlushProfileId",
    "directoryFlushProfileSha256", "executableByteCount", "executableFile",
    "executableSha256", "operatingSystem", "runtimeIdentifier", "schema",
    "sourceClosureSha256", "trustClass"
  ], "directory_flush_verification_profile_invalid");
  exactStringArray(profile.packageProvenanceFields, [
    "architecture", "buildProfile", "cargoLockSha256", "cargoVersion",
    "directoryFlushProfileSha256", "executableSha256", "operatingSystem",
    "packageBuilderSourceClosureSha256", "runtimeIdentifier", "rustcVersion",
    "schema", "sourceClosureSha256", "sourceRevision", "sourceWorktreeClean",
    "trustClass"
  ], "directory_flush_verification_profile_invalid");
  exactStringArray(profile.receiptFields, [
    "architecture", "buildProfile", "cases", "clientProfileId",
    "clientProfileSha256", "clientSourceClosureSha256", "executionClass",
    "executableByteCount", "executableSha256", "helperManifestSha256",
    "helperPackageBuilderSourceClosureSha256", "helperProvenanceSha256",
    "helperSourceClosureSha256", "helperSourceRevision",
    "helperSourceWorktreeClean", "nodeVersion", "operatingSystem", "profileId",
    "profileSha256", "runtimeIdentifier", "schema", "scratchCleanup",
    "trustClass", "verdict", "verificationSourceClosureSha256"
  ], "directory_flush_verification_profile_invalid");
  exactStringArray(profile.caseReceiptFields, [
    "caseId", "directoryIdentitySha256", "fixtureByteCount", "fixtureSha256",
    "method", "observationSha256", "operationId", "requestSha256"
  ], "directory_flush_verification_profile_invalid");
  exactStringArray(profile.caseFields, [
    "caseId", "fixtureBase64", "fixtureByteCount", "fixtureRelativePath",
    "fixtureSha256", "operationId", "relativeDirectory"
  ], "directory_flush_verification_profile_invalid");
  assertDataObject(profile.package, [
    "createOnlyOutput", "exactFileSetRequired", "executableMaximumBytes",
    "manifestFile", "manifestMaximumBytes", "provenanceFile",
    "provenanceMaximumBytes", "releaseSourceWorktreeCleanRequired"
  ], "directory_flush_verification_profile_invalid");
  assertDataObject(profile.limits, [
    "maximumCases", "maximumFixtureBytesPerCase", "maximumPathCodeUnits",
    "maximumReceiptBytes", "maximumSourceMemberBytes"
  ], "directory_flush_verification_profile_invalid");
  assertDataObject(profile.pathPolicy, [
    "configuration", "linksAndReparsePoints", "outputRoot", "packageRoot",
    "roots", "scratchRoot", "scratchWorktree"
  ], "directory_flush_verification_profile_invalid");
  assertDataObject(profile.receiptPolicy, [
    "canonicalJcsRequired", "fileFsyncRequired", "pathDisclosureForbidden",
    "rawProcessOutputForbidden", "readbackRequired", "timestampOmitted"
  ], "directory_flush_verification_profile_invalid");
  if (profile.package.manifestFile !==
        "directory-flush-helper-manifest.v1.json" ||
      profile.package.provenanceFile !==
        "directory-flush-helper-provenance.v1.json" ||
      profile.package.executableMaximumBytes !== 67_108_864 ||
      profile.package.provenanceMaximumBytes !== 32_768 ||
      profile.package.manifestMaximumBytes !== 16_384 ||
      profile.package.exactFileSetRequired !== true ||
      profile.package.createOnlyOutput !== true ||
      profile.package.releaseSourceWorktreeCleanRequired !== true ||
      profile.limits.maximumReceiptBytes !== 32_768 ||
      profile.limits.maximumSourceMemberBytes !== 16_777_216 ||
      profile.limits.maximumCases !== 2 ||
      profile.limits.maximumFixtureBytesPerCase !== 4_096 ||
      profile.limits.maximumPathCodeUnits !== 4_096 ||
      profile.pathPolicy.configuration !==
        "explicit-absolute-package-output-and-scratch-roots" ||
      profile.pathPolicy.linksAndReparsePoints !==
        "reject-where-host-api-exposes-them" ||
      profile.pathPolicy.roots !==
        "pairwise-disjoint-and-not-ancestor-related" ||
      profile.pathPolicy.outputRoot !==
        "create-only-after-all-replays-and-scratch-cleanup" ||
      profile.pathPolicy.packageRoot !==
        "read-only-through-frozen-directory-flush-client" ||
      profile.pathPolicy.scratchRoot !== "caller-owned-existing-directory" ||
      profile.pathPolicy.scratchWorktree !==
        "one-tool-owned-unique-child-removed-before-receipt" ||
      profile.receiptPolicy.canonicalJcsRequired !== true ||
      profile.receiptPolicy.fileFsyncRequired !== true ||
      profile.receiptPolicy.pathDisclosureForbidden !== true ||
      profile.receiptPolicy.rawProcessOutputForbidden !== true ||
      profile.receiptPolicy.readbackRequired !== true ||
      profile.receiptPolicy.timestampOmitted !==
        "replay-record-does-not-claim-observation-time" ||
      !Array.isArray(profile.nonClaims) || profile.nonClaims.length !== 7 ||
      profile.nonClaims.some((entry) => typeof entry !== "string" ||
        entry.length < 20 || entry.length > 240) ||
      !Array.isArray(profile.cases) ||
      profile.cases.length !== profile.limits.maximumCases) {
    fail("directory_flush_verification_profile_invalid");
  }

  let previousOperationId = "";
  const cases = profile.cases.map((entry) => {
    assertDataObject(entry, profile.caseFields,
      "directory_flush_verification_profile_invalid");
    if (!/^[a-z][a-z0-9-]{2,79}$/u.test(entry.caseId) ||
        !/^[a-z0-9][a-z0-9._:-]{2,159}$/u.test(entry.operationId) ||
        entry.operationId <= previousOperationId ||
        !validRelativePath(entry.relativeDirectory, true) ||
        !validRelativePath(entry.fixtureRelativePath, false) ||
        !Number.isSafeInteger(entry.fixtureByteCount) ||
        entry.fixtureByteCount <= 0 ||
        entry.fixtureByteCount > profile.limits.maximumFixtureBytesPerCase ||
        !sha256Pattern.test(entry.fixtureSha256)) {
      fail("directory_flush_verification_profile_invalid");
    }
    const directoryPrefix = entry.relativeDirectory === "." ? "" :
      `${entry.relativeDirectory}/`;
    if (!entry.fixtureRelativePath.startsWith(directoryPrefix) ||
        entry.fixtureRelativePath === entry.relativeDirectory) {
      fail("directory_flush_verification_profile_invalid");
    }
    previousOperationId = entry.operationId;
    return Object.freeze({
      ...entry,
      fixtureBytes: decodeCanonicalBase64(
        entry.fixtureBase64,
        entry.fixtureByteCount,
        entry.fixtureSha256,
        profile.limits.maximumFixtureBytesPerCase
      )
    });
  });
  return Object.freeze({ ...profile, cases: Object.freeze(cases) });
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

function assertNoLinkComponents(target, leafKind, code) {
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
      fail(code);
    }
    if (stat.isSymbolicLink()) fail(code);
    const isLeaf = index === parts.length - 1;
    if (!isLeaf && !stat.isDirectory()) fail(code);
    if (isLeaf && leafKind === "file" && !stat.isFile()) fail(code);
    if (isLeaf && leafKind === "directory" && !stat.isDirectory()) fail(code);
  }
}

function rootsOverlap(left, right) {
  const leftToRight = path.relative(left, right);
  const rightToLeft = path.relative(right, left);
  return left === right ||
    (leftToRight && !leftToRight.startsWith("..") &&
      !path.isAbsolute(leftToRight)) ||
    (rightToLeft && !rightToLeft.startsWith("..") &&
      !path.isAbsolute(rightToLeft));
}

function assertDisjointRoots(roots) {
  for (let left = 0; left < roots.length; left += 1) {
    for (let right = left + 1; right < roots.length; right += 1) {
      if (rootsOverlap(roots[left], roots[right])) {
        fail("directory_flush_verification_roots_overlap");
      }
    }
  }
}

function readBoundedRegularFile(filePath, maximumBytes, code) {
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
    const bytes = Buffer.allocUnsafe(before.size);
    let offset = 0;
    while (offset < before.size) {
      const count = fs.readSync(descriptor, bytes, offset,
        before.size - offset, offset);
      if (count <= 0) fail(code);
      offset += count;
    }
    const after = fs.fstatSync(descriptor);
    if (after.size !== before.size || after.mtimeMs !== before.mtimeMs ||
        after.ctimeMs !== before.ctimeMs) {
      fail(code);
    }
    return bytes;
  } catch (error) {
    if (error?.code === code) throw error;
    fail(code);
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch (_error) {
        // The typed failure or complete bounded read remains authoritative.
      }
    }
  }
}

function hashRegularFile(filePath, maximumBytes, code) {
  const bytes = readBoundedRegularFile(filePath, maximumBytes, code);
  return Object.freeze({ byteCount: bytes.length, sha256: sha256(bytes) });
}

function parseCanonicalFile(filePath, maximumBytes, expectedFields, code) {
  const bytes = readBoundedRegularFile(filePath, maximumBytes, code);
  let value;
  try {
    value = parseStrictJson(bytes);
  } catch (_error) {
    fail(code);
  }
  assertDataObject(value, expectedFields, code);
  if (!canonicalizeVnextJcsBytes(value).equals(bytes)) fail(code);
  return Object.freeze({ bytes, value: Object.freeze(value) });
}

function closureSha256(relativePaths, code) {
  const members = relativePaths.map((relativePath) => {
    const filePath = path.resolve(repositoryRoot, ...relativePath.split("/"));
    if (path.relative(repositoryRoot, filePath).startsWith("..")) fail(code);
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
    "HOME", "PATH", "PATHEXT", "SystemRoot", "USERPROFILE"
  ]) {
    if (typeof process.env[name] === "string" && process.env[name].length > 0) {
      environment[name] = process.env[name];
    }
  }
  return environment;
}

function sourceState() {
  const revisionResult = childProcess.spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: commandEnvironment(),
    maxBuffer: 128 * 1024,
    shell: false,
    windowsHide: true
  });
  const statusResult = childProcess.spawnSync("git", [
    "status", "--porcelain=v1", "--untracked-files=all"
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: commandEnvironment(),
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
    windowsHide: true
  });
  if (revisionResult.error !== undefined || revisionResult.status !== 0 ||
      revisionResult.signal !== null || revisionResult.stderr.length !== 0 ||
      statusResult.error !== undefined || statusResult.status !== 0 ||
      statusResult.signal !== null || statusResult.stderr.length !== 0) {
    fail("directory_flush_verification_git_failed");
  }
  const revision = revisionResult.stdout.trim();
  if (!sourceRevisionPattern.test(revision)) {
    fail("directory_flush_verification_git_failed");
  }
  return Object.freeze({ revision, worktreeClean: statusResult.stdout.length === 0 });
}

function platformFromRuntimeIdentifier(runtimeIdentifier) {
  const values = Object.freeze({
    "linux-arm64": Object.freeze({
      architecture: "aarch64",
      executableFile: "tinyrustlm-directory-flush",
      method: "posix-directory-fsync",
      operatingSystem: "linux"
    }),
    "linux-x64": Object.freeze({
      architecture: "x86_64",
      executableFile: "tinyrustlm-directory-flush",
      method: "posix-directory-fsync",
      operatingSystem: "linux"
    }),
    "win-x64": Object.freeze({
      architecture: "x86_64",
      executableFile: "tinyrustlm-directory-flush.exe",
      method: "win32-backup-semantics-flush-file-buffers",
      operatingSystem: "windows"
    })
  });
  const platform = values[runtimeIdentifier];
  if (!platform) fail("directory_flush_verification_package_invalid");
  return platform;
}

function currentRuntimeIdentifier() {
  const osName = process.platform === "win32" ? "win" : process.platform;
  return `${osName}-${process.arch}`;
}

function loadPackage(packageRoot) {
  assertNoLinkComponents(packageRoot, "directory",
    "directory_flush_verification_package_path_invalid");
  const manifestPath = path.join(packageRoot, profile.package.manifestFile);
  assertNoLinkComponents(manifestPath, "file",
    "directory_flush_verification_package_path_invalid");
  const manifestRecord = parseCanonicalFile(
    manifestPath,
    profile.package.manifestMaximumBytes,
    profile.packageManifestFields,
    "directory_flush_verification_manifest_invalid"
  );
  const manifest = manifestRecord.value;
  const platform = platformFromRuntimeIdentifier(manifest.runtimeIdentifier);
  if (manifest.schema !== profile.packageManifestSchema ||
      manifest.directoryFlushProfileId !== profile.directoryFlushProfileId ||
      manifest.directoryFlushProfileSha256 !==
        profile.directoryFlushProfileSha256 ||
      manifest.architecture !== platform.architecture ||
      manifest.operatingSystem !== platform.operatingSystem ||
      manifest.executableFile !== platform.executableFile ||
      !Number.isSafeInteger(manifest.executableByteCount) ||
      manifest.executableByteCount <= 0 ||
      manifest.executableByteCount > profile.package.executableMaximumBytes ||
      !sha256Pattern.test(manifest.executableSha256) ||
      !sha256Pattern.test(manifest.sourceClosureSha256) ||
      !profile.acceptedPackageTrustClasses.includes(manifest.trustClass) ||
      !["debug", "release"].includes(manifest.buildProfile) ||
      (manifest.trustClass === "release-package" &&
        manifest.buildProfile !== "release") ||
      (manifest.trustClass === "local-test-build" &&
        manifest.buildProfile !== "debug")) {
    fail("directory_flush_verification_manifest_invalid");
  }
  const provenancePath = path.join(packageRoot, profile.package.provenanceFile);
  const executablePath = path.join(packageRoot, platform.executableFile);
  assertNoLinkComponents(provenancePath, "file",
    "directory_flush_verification_package_path_invalid");
  assertNoLinkComponents(executablePath, "file",
    "directory_flush_verification_package_path_invalid");
  const entries = fs.readdirSync(packageRoot).sort();
  const expectedEntries = [
    profile.package.manifestFile,
    profile.package.provenanceFile,
    platform.executableFile
  ].sort();
  if (entries.join(",") !== expectedEntries.join(",")) {
    fail("directory_flush_verification_package_file_set_invalid");
  }
  const provenanceRecord = parseCanonicalFile(
    provenancePath,
    profile.package.provenanceMaximumBytes,
    profile.packageProvenanceFields,
    "directory_flush_verification_provenance_invalid"
  );
  const provenance = provenanceRecord.value;
  const executable = hashRegularFile(
    executablePath,
    profile.package.executableMaximumBytes,
    "directory_flush_verification_executable_invalid"
  );
  const helperSourceClosureSha256 = closureSha256(
    profile.helperSourceClosureMembers,
    "directory_flush_verification_source_read_failed"
  );
  const packageBuilderSourceClosureSha256 = closureSha256(
    profile.packageBuilderSourceClosureMembers,
    "directory_flush_verification_source_read_failed"
  );
  const currentSource = sourceState();
  const cargoLockSha256 = sha256(fs.readFileSync(path.join(
    repositoryRoot, "Cargo.lock")));
  if (provenance.schema !== profile.packageProvenanceSchema ||
      provenance.architecture !== manifest.architecture ||
      provenance.buildProfile !== manifest.buildProfile ||
      provenance.cargoLockSha256 !== cargoLockSha256 ||
      typeof provenance.cargoVersion !== "string" ||
      !/^cargo \d+\.\d+\.\d+(?: .*)?$/u.test(provenance.cargoVersion) ||
      provenance.directoryFlushProfileSha256 !==
        profile.directoryFlushProfileSha256 ||
      provenance.executableSha256 !== manifest.executableSha256 ||
      provenance.operatingSystem !== manifest.operatingSystem ||
      provenance.packageBuilderSourceClosureSha256 !==
        packageBuilderSourceClosureSha256 ||
      provenance.runtimeIdentifier !== manifest.runtimeIdentifier ||
      typeof provenance.rustcVersion !== "string" ||
      !/^rustc \d+\.\d+\.\d+(?: .*)?$/u.test(provenance.rustcVersion) ||
      provenance.sourceClosureSha256 !== helperSourceClosureSha256 ||
      provenance.sourceClosureSha256 !== manifest.sourceClosureSha256 ||
      !sourceRevisionPattern.test(provenance.sourceRevision) ||
      provenance.sourceRevision !== currentSource.revision ||
      typeof provenance.sourceWorktreeClean !== "boolean" ||
      provenance.sourceWorktreeClean !== currentSource.worktreeClean ||
      provenance.trustClass !== manifest.trustClass ||
      (manifest.trustClass === "release-package" &&
        provenance.sourceWorktreeClean !== true) ||
      executable.byteCount !== manifest.executableByteCount ||
      executable.sha256 !== manifest.executableSha256) {
    fail("directory_flush_verification_provenance_invalid");
  }
  return Object.freeze({
    architecture: manifest.architecture,
    buildProfile: manifest.buildProfile,
    clientProfileId: profile.clientProfileId,
    clientProfileSha256: profile.clientProfileSha256,
    clientSourceClosureSha256: profile.clientSourceClosureSha256,
    executableByteCount: executable.byteCount,
    executablePath,
    executableSha256: executable.sha256,
    helperManifestSha256: sha256(manifestRecord.bytes),
    helperPackageBuilderSourceClosureSha256:
      provenance.packageBuilderSourceClosureSha256,
    helperProvenanceSha256: sha256(provenanceRecord.bytes),
    helperSourceClosureSha256: provenance.sourceClosureSha256,
    helperSourceRevision: provenance.sourceRevision,
    helperSourceWorktreeClean: provenance.sourceWorktreeClean,
    method: platform.method,
    operatingSystem: manifest.operatingSystem,
    runtimeIdentifier: manifest.runtimeIdentifier,
    trustClass: manifest.trustClass
  });
}

function samePackageIdentity(left, right) {
  return canonicalizeVnextJcsBytes(left).equals(canonicalizeVnextJcsBytes(right));
}

function writeExclusive(filePath, bytes) {
  let descriptor;
  try {
    descriptor = fs.openSync(filePath, "wx", 0o600);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.writeSync(descriptor, bytes, offset,
        bytes.length - offset, offset);
      if (count <= 0) fail("directory_flush_verification_write_failed");
      offset += count;
    }
    fs.fsyncSync(descriptor);
  } catch (error) {
    if (error?.code === "directory_flush_verification_write_failed") throw error;
    fail("directory_flush_verification_write_failed");
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch (_error) {
        // Exact readback below decides whether evidence creation succeeded.
      }
    }
  }
}

function writeFixture(filePath, bytes) {
  let descriptor;
  try {
    descriptor = fs.openSync(filePath, "wx", 0o600);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.writeSync(descriptor, bytes, offset,
        bytes.length - offset, offset);
      if (count <= 0) fail("directory_flush_verification_fixture_write_failed");
      offset += count;
    }
    fs.fsyncSync(descriptor);
  } catch (error) {
    if (error?.code === "directory_flush_verification_fixture_write_failed") {
      throw error;
    }
    fail("directory_flush_verification_fixture_write_failed");
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch (_error) {
        // The replay will fail or cleanup will preserve the bounded error.
      }
    }
  }
}

function removeDirectOwnedChild(child, parent, code) {
  const relative = path.relative(parent, child);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative) ||
      relative.includes(path.sep)) {
    fail(code);
  }
  try {
    fs.rmSync(child, { force: true, recursive: true });
  } catch (_error) {
    fail(code);
  }
  if (fs.existsSync(child)) fail(code);
}

function validateReceipt(receipt, packageIdentity, verificationSourceClosureSha256) {
  assertDataObject(receipt, profile.receiptFields,
    "directory_flush_verification_receipt_invalid");
  if (receipt.schema !== profile.verificationSchema ||
      receipt.profileId !== directoryFlushHelperVerificationProfileId ||
      receipt.profileSha256 !== directoryFlushHelperVerificationProfileSha256 ||
      receipt.executionClass !== profile.executionClass ||
      receipt.scratchCleanup !== profile.scratchCleanup ||
      receipt.verdict !== profile.verdict ||
      receipt.verificationSourceClosureSha256 !==
        verificationSourceClosureSha256 ||
      !nodeVersionPattern.test(receipt.nodeVersion)) {
    fail("directory_flush_verification_receipt_invalid");
  }
  for (const [key, value] of Object.entries(packageIdentity)) {
    if (["executablePath", "method"].includes(key)) continue;
    if (receipt[key] !== value) {
      fail("directory_flush_verification_receipt_package_mismatch");
    }
  }
  if (!Array.isArray(receipt.cases) ||
      receipt.cases.length !== profile.cases.length) {
    fail("directory_flush_verification_receipt_invalid");
  }
  receipt.cases.forEach((entry, index) => {
    const expected = profile.cases[index];
    assertDataObject(entry, profile.caseReceiptFields,
      "directory_flush_verification_receipt_invalid");
    if (entry.caseId !== expected.caseId ||
        entry.operationId !== expected.operationId ||
        entry.fixtureByteCount !== expected.fixtureByteCount ||
        entry.fixtureSha256 !== expected.fixtureSha256 ||
        entry.method !== packageIdentity.method ||
        !sha256Pattern.test(entry.directoryIdentitySha256) ||
        !sha256Pattern.test(entry.observationSha256) ||
        !sha256Pattern.test(entry.requestSha256)) {
      fail("directory_flush_verification_receipt_invalid");
    }
  });
  return receipt;
}

function readAndValidateReceipt(evidenceRoot, packageIdentity,
  verificationSourceClosureSha256) {
  assertNoLinkComponents(evidenceRoot, "directory",
    "directory_flush_verification_evidence_path_invalid");
  const entries = fs.readdirSync(evidenceRoot);
  if (entries.length !== 1 || entries[0] !== profile.receiptFile) {
    fail("directory_flush_verification_evidence_file_set_invalid");
  }
  const receiptPath = path.join(evidenceRoot, profile.receiptFile);
  assertNoLinkComponents(receiptPath, "file",
    "directory_flush_verification_evidence_path_invalid");
  const record = parseCanonicalFile(
    receiptPath,
    profile.limits.maximumReceiptBytes,
    profile.receiptFields,
    "directory_flush_verification_receipt_invalid"
  );
  validateReceipt(record.value, packageIdentity, verificationSourceClosureSha256);
  return Object.freeze({
    receipt: record.value,
    receiptByteCount: record.bytes.length,
    receiptSha256: sha256(record.bytes)
  });
}

function validateOptions(options, fields, code) {
  assertDataObject(options, fields, code);
  const normalized = {};
  for (const field of fields) normalized[field] = normalizeAbsolutePath(options[field], code);
  return Object.freeze(normalized);
}

function verifyDirectoryFlushHelperEvidence(options) {
  const normalized = validateOptions(options, ["evidenceRoot", "packageRoot"],
    "directory_flush_verification_options_invalid");
  assertDisjointRoots([normalized.evidenceRoot, normalized.packageRoot]);
  const packageIdentity = loadPackage(normalized.packageRoot);
  const verificationSourceClosureSha256 = closureSha256(
    profile.verificationSourceClosureMembers,
    "directory_flush_verification_source_read_failed"
  );
  const record = readAndValidateReceipt(
    normalized.evidenceRoot,
    packageIdentity,
    verificationSourceClosureSha256
  );
  const finalPackage = loadPackage(normalized.packageRoot);
  if (!samePackageIdentity(packageIdentity, finalPackage)) {
    fail("directory_flush_verification_package_changed");
  }
  return Object.freeze({
    receiptByteCount: record.receiptByteCount,
    receiptSha256: record.receiptSha256,
    runtimeIdentifier: packageIdentity.runtimeIdentifier,
    verdict: record.receipt.verdict
  });
}

function runDirectoryFlushHelperVerification(options) {
  const normalized = validateOptions(options,
    ["outputRoot", "packageRoot", "scratchRoot"],
    "directory_flush_verification_options_invalid");
  if (fs.existsSync(normalized.outputRoot)) {
    fail("directory_flush_verification_output_exists");
  }
  assertNoLinkComponents(path.dirname(normalized.outputRoot), "directory",
    "directory_flush_verification_output_path_invalid");
  assertNoLinkComponents(normalized.packageRoot, "directory",
    "directory_flush_verification_package_path_invalid");
  assertNoLinkComponents(normalized.scratchRoot, "directory",
    "directory_flush_verification_scratch_path_invalid");
  assertDisjointRoots([
    normalized.outputRoot,
    normalized.packageRoot,
    normalized.scratchRoot
  ]);
  const packageIdentity = loadPackage(normalized.packageRoot);
  if (packageIdentity.runtimeIdentifier !== currentRuntimeIdentifier()) {
    fail("directory_flush_verification_runtime_mismatch");
  }
  const verificationSourceClosureSha256 = closureSha256(
    profile.verificationSourceClosureMembers,
    "directory_flush_verification_source_read_failed"
  );
  const scratchChild = fs.mkdtempSync(path.join(
    normalized.scratchRoot,
    "directory-flush-replay-"
  ));
  let scratchRemoved = false;
  let caseReceipts;
  try {
    const ownedRoot = path.join(scratchChild, "owned");
    fs.mkdirSync(ownedRoot, { mode: 0o700, recursive: false });
    for (const entry of profile.cases) {
      const fixturePath = path.join(
        ownedRoot,
        ...entry.fixtureRelativePath.split("/")
      );
      fs.mkdirSync(path.dirname(fixturePath), { mode: 0o700, recursive: true });
      writeFixture(fixturePath, entry.fixtureBytes);
    }
    const client = createVnextDirectoryFlushClient(normalized.packageRoot);
    const results = client.flushMany(profile.cases.map((entry) => Object.freeze({
      operationId: entry.operationId,
      ownedRoot,
      relativeDirectory: entry.relativeDirectory
    })));
    if (!Array.isArray(results) || results.length !== profile.cases.length) {
      fail("directory_flush_verification_replay_failed");
    }
    caseReceipts = Object.freeze(results.map((result, index) => {
      const expected = profile.cases[index];
      if (result.operationId !== expected.operationId ||
          result.architecture !== packageIdentity.architecture ||
          result.clientProfileId !== packageIdentity.clientProfileId ||
          result.clientProfileSha256 !== packageIdentity.clientProfileSha256 ||
          result.clientSourceClosureSha256 !==
            packageIdentity.clientSourceClosureSha256 ||
          result.directoryFlushProfileId !== profile.directoryFlushProfileId ||
          result.directoryFlushProfileSha256 !==
            profile.directoryFlushProfileSha256 ||
          result.executableByteCount !== packageIdentity.executableByteCount ||
          result.executableSha256 !== packageIdentity.executableSha256 ||
          result.helperBuildProfile !== packageIdentity.buildProfile ||
          result.helperManifestSha256 !== packageIdentity.helperManifestSha256 ||
          result.helperSourceClosureSha256 !==
            packageIdentity.helperSourceClosureSha256 ||
          result.helperTrustClass !== packageIdentity.trustClass ||
          result.method !== packageIdentity.method ||
          result.operatingSystem !== packageIdentity.operatingSystem ||
          result.runtimeIdentifier !== packageIdentity.runtimeIdentifier ||
          result.status !== "performed" ||
          !sha256Pattern.test(result.directoryIdentitySha256) ||
          !sha256Pattern.test(result.observationSha256) ||
          !sha256Pattern.test(result.requestSha256)) {
        fail("directory_flush_verification_replay_failed");
      }
      return Object.freeze({
        caseId: expected.caseId,
        directoryIdentitySha256: result.directoryIdentitySha256,
        fixtureByteCount: expected.fixtureByteCount,
        fixtureSha256: expected.fixtureSha256,
        method: result.method,
        observationSha256: result.observationSha256,
        operationId: result.operationId,
        requestSha256: result.requestSha256
      });
    }));
    const finalPackage = loadPackage(normalized.packageRoot);
    if (!samePackageIdentity(packageIdentity, finalPackage)) {
      fail("directory_flush_verification_package_changed");
    }
  } finally {
    removeDirectOwnedChild(
      scratchChild,
      normalized.scratchRoot,
      "directory_flush_verification_scratch_cleanup_failed"
    );
    scratchRemoved = true;
  }
  if (!scratchRemoved || fs.existsSync(scratchChild)) {
    fail("directory_flush_verification_scratch_cleanup_failed");
  }

  const receipt = Object.freeze({
    architecture: packageIdentity.architecture,
    buildProfile: packageIdentity.buildProfile,
    cases: caseReceipts,
    clientProfileId: packageIdentity.clientProfileId,
    clientProfileSha256: packageIdentity.clientProfileSha256,
    clientSourceClosureSha256: packageIdentity.clientSourceClosureSha256,
    executionClass: profile.executionClass,
    executableByteCount: packageIdentity.executableByteCount,
    executableSha256: packageIdentity.executableSha256,
    helperManifestSha256: packageIdentity.helperManifestSha256,
    helperPackageBuilderSourceClosureSha256:
      packageIdentity.helperPackageBuilderSourceClosureSha256,
    helperProvenanceSha256: packageIdentity.helperProvenanceSha256,
    helperSourceClosureSha256: packageIdentity.helperSourceClosureSha256,
    helperSourceRevision: packageIdentity.helperSourceRevision,
    helperSourceWorktreeClean: packageIdentity.helperSourceWorktreeClean,
    nodeVersion: process.version,
    operatingSystem: packageIdentity.operatingSystem,
    profileId: directoryFlushHelperVerificationProfileId,
    profileSha256: directoryFlushHelperVerificationProfileSha256,
    runtimeIdentifier: packageIdentity.runtimeIdentifier,
    schema: profile.verificationSchema,
    scratchCleanup: profile.scratchCleanup,
    trustClass: packageIdentity.trustClass,
    verdict: profile.verdict,
    verificationSourceClosureSha256
  });
  validateReceipt(receipt, packageIdentity, verificationSourceClosureSha256);
  const receiptBytes = canonicalizeVnextJcsBytes(receipt);
  if (receiptBytes.length <= 0 ||
      receiptBytes.length > profile.limits.maximumReceiptBytes) {
    fail("directory_flush_verification_receipt_invalid");
  }

  let ownsOutputRoot = false;
  try {
    fs.mkdirSync(normalized.outputRoot, { mode: 0o700, recursive: false });
    ownsOutputRoot = true;
    const receiptPath = path.join(normalized.outputRoot, profile.receiptFile);
    writeExclusive(receiptPath, receiptBytes);
    const readback = readAndValidateReceipt(
      normalized.outputRoot,
      packageIdentity,
      verificationSourceClosureSha256
    );
    if (!readback.receipt || readback.receiptSha256 !== sha256(receiptBytes)) {
      fail("directory_flush_verification_readback_failed");
    }
    return Object.freeze({
      outputRoot: normalized.outputRoot,
      receiptByteCount: readback.receiptByteCount,
      receiptSha256: readback.receiptSha256,
      runtimeIdentifier: packageIdentity.runtimeIdentifier,
      verdict: readback.receipt.verdict
    });
  } catch (error) {
    if (ownsOutputRoot) {
      removeDirectOwnedChild(
        normalized.outputRoot,
        path.dirname(normalized.outputRoot),
        "directory_flush_verification_output_cleanup_failed"
      );
    }
    throw error;
  }
}

function printResult(result) {
  process.stdout.write(`${JSON.stringify({
    receiptByteCount: result.receiptByteCount,
    receiptSha256: result.receiptSha256,
    runtimeIdentifier: result.runtimeIdentifier,
    verdict: result.verdict
  })}\n`);
}

function main() {
  const [command, ...argumentsList] = process.argv.slice(2);
  if (command === "run" && argumentsList.length === 3) {
    printResult(runDirectoryFlushHelperVerification({
      packageRoot: argumentsList[0],
      outputRoot: argumentsList[1],
      scratchRoot: argumentsList[2]
    }));
    return;
  }
  if (command === "verify" && argumentsList.length === 2) {
    printResult(verifyDirectoryFlushHelperEvidence({
      packageRoot: argumentsList[0],
      evidenceRoot: argumentsList[1]
    }));
    return;
  }
  fail("directory_flush_verification_cli_invalid");
}

if (require.main === module) {
  try {
    main();
  } catch (_error) {
    process.stderr.write("TinyRustLM directory flush helper verification failed\n");
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  directoryFlushHelperVerificationProfileId,
  directoryFlushHelperVerificationProfileSha256,
  runDirectoryFlushHelperVerification,
  verifyDirectoryFlushHelperEvidence
});
