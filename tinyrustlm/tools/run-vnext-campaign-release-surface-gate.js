"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { TextDecoder } = require("node:util");

const { parseStrictJson } = require("./strict-json.js");
const { canonicalizeVnextJcsBytes } = require("./vnext-jcs.js");
const {
  fixtureProfileForTestNames
} = require("../tests/helpers/vnext-campaign-release-surface-test-custody.js");

const repositoryRoot = resolveRepositoryRoot();
const gateProfilePath = path.join(
  repositoryRoot,
  "contracts",
  "vnext",
  "campaign-release-surface-gate-profile.v1.json"
);
const gateProfileId = "tinyrustlm.vnext.campaign-release-surface-gate.v1";
const gateProfileSha256 =
  "aaf94b86be0bba757d4dc8743f810f8801b4389a3c388dda4cf23090c43011a1";
const sha256Pattern = /^[a-f0-9]{64}$/u;
const gitObjectPattern = /^[a-f0-9]{40}$/u;
const attemptIdPattern = /^attempt-[1-9][0-9]{12,15}-[a-f0-9]{32}$/u;
const signalPattern = /^[A-Z][A-Z0-9]{1,31}$/u;
const utcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

function fail(code) {
  const error = new Error("Campaign release-surface gate failed");
  error.code = code;
  throw error;
}

function resolveRepositoryRoot() {
  const configured = Object.getOwnPropertyDescriptor(
    process.env,
    "TINYRUSTLM_REPOSITORY_ROOT"
  );
  const candidates = configured && "value" in configured && configured.value
    ? [configured.value]
    : [
      process.cwd(),
      path.resolve(process.cwd(), ".."),
      path.resolve(__dirname, "../..")
    ];
  const roots = [];
  const identities = new Set();
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !path.isAbsolute(candidate) ||
        candidate.includes("\0")) {
      continue;
    }
    const normalized = path.normalize(candidate);
    const identity = process.platform === "win32"
      ? normalized.toLowerCase()
      : normalized;
    if (identities.has(identity)) continue;
    identities.add(identity);
    try {
      if (fs.lstatSync(path.join(normalized, "tinyrustlm", "package.json")).isFile() &&
          fs.lstatSync(path.join(
            normalized,
            "contracts",
            "vnext",
            "campaign-release-surface-gate-profile.v1.json"
          )).isFile()) {
        roots.push(normalized);
      }
    } catch (_error) {
      // Exactly one complete repository candidate is authoritative.
    }
  }
  if (roots.length !== 1) fail("release_gate_repository_root_invalid");
  return roots[0];
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function assertDataObject(value, expectedKeys, code) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    fail(code);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  const expected = [...expectedKeys].sort();
  if (keys.length !== expected.length ||
      keys.some((key, index) => key !== expected[index]) ||
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

function readRegularFile(filePath, maximumBytes, allowEmpty, code) {
  let descriptor;
  try {
    const before = fs.lstatSync(filePath);
    if (!before.isFile() || before.isSymbolicLink() || before.size > maximumBytes ||
        (!allowEmpty && before.size === 0)) {
      fail(code);
    }
    descriptor = fs.openSync(
      filePath,
      Number(fs.constants.O_RDONLY) | Number(fs.constants.O_NOFOLLOW || 0)
    );
    const bytes = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(descriptor, bytes, offset, bytes.length - offset, offset);
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
        // The bounded read or typed failure remains authoritative.
      }
    }
  }
}

function hashRegularFile(filePath, maximumBytes, code) {
  let descriptor;
  try {
    const before = fs.lstatSync(filePath);
    if (!before.isFile() || before.isSymbolicLink() || before.size <= 0 ||
        before.size > maximumBytes) {
      fail(code);
    }
    descriptor = fs.openSync(
      filePath,
      Number(fs.constants.O_RDONLY) | Number(fs.constants.O_NOFOLLOW || 0)
    );
    const hash = crypto.createHash("sha256");
    const chunk = Buffer.allocUnsafe(1024 * 1024);
    let offset = 0;
    while (offset < before.size) {
      const count = fs.readSync(
        descriptor,
        chunk,
        0,
        Math.min(chunk.length, before.size - offset),
        offset
      );
      if (count <= 0) fail(code);
      hash.update(chunk.subarray(0, count));
      offset += count;
    }
    const after = fs.fstatSync(descriptor);
    if (after.size !== before.size || after.mtimeMs !== before.mtimeMs ||
        after.ctimeMs !== before.ctimeMs) {
      fail(code);
    }
    return Object.freeze({ byteCount: before.size, sha256: hash.digest("hex") });
  } catch (error) {
    if (error?.code === code) throw error;
    fail(code);
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch (_error) {
        // The bounded hash or typed failure remains authoritative.
      }
    }
  }
}

function sourcePath(relativePath, code = "release_gate_profile_invalid") {
  if (typeof relativePath !== "string" || relativePath.length === 0 ||
      relativePath.length > 1024 || relativePath.includes("\\") ||
      relativePath.startsWith("/") || relativePath.split("/").some((part) =>
        !part || part === "." || part === "..")) {
    fail(code);
  }
  const resolved = path.resolve(repositoryRoot, ...relativePath.split("/"));
  const relative = path.relative(repositoryRoot, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail(code);
  return resolved;
}

function loadGateProfile() {
  const bytes = readRegularFile(
    gateProfilePath,
    512 * 1024,
    false,
    "release_gate_profile_invalid"
  );
  if (sha256(bytes) !== gateProfileSha256) {
    fail("release_gate_profile_identity_mismatch");
  }
  let value;
  try {
    value = parseStrictJson(bytes);
  } catch (_error) {
    fail("release_gate_profile_invalid");
  }
  assertDataObject(value, [
    "canonicalJsonProfile", "childEnvironmentAllowlist", "custodyFixturePolicy",
    "durabilityPolicy", "executionClass", "failureCodes", "files",
    "fixedChildEnvironment", "hashAlgorithm", "implementationFiles", "limits",
    "maximumConcurrentShards", "nonClaims", "profileId", "reporter",
    "runnerFile", "schema", "schemas", "shardTimeoutMilliseconds", "shards",
    "sourcePolicy", "status", "summaryFields", "testFile", "testIsolation",
    "testLauncherFile", "toolIdentityCommands", "verdicts", "versionPolicy"
  ], "release_gate_profile_invalid");
  if (value.schema !==
        "tinyrustlm.vnext.campaign_release_surface_gate_profile.v1" ||
      value.profileId !== gateProfileId || value.status !== "frozen" ||
      value.versionPolicy !== "single-current-profile-no-compatibility-reader" ||
      value.canonicalJsonProfile !==
        "rfc8785-jcs+tinyrustlm.strict-json.v1" ||
      value.hashAlgorithm !== "sha256" ||
      value.executionClass !== "clean-source-local-node-independent-shards" ||
      value.sourcePolicy !== "clean-exact-head-and-tree" ||
      value.custodyFixturePolicy !==
        "real-inherited-pipe-per-shard-with-secret-sensitive-tests-isolated" ||
      value.reporter !== "spec" || value.testIsolation !== "none" ||
      value.maximumConcurrentShards !== 1 ||
      value.shardTimeoutMilliseconds !== 21_600_000 ||
      value.runnerFile !==
        "tinyrustlm/tools/run-vnext-campaign-release-surface-gate.js" ||
      value.testFile !== "tinyrustlm/tests/vnext-campaign-release-surface.test.js" ||
      value.testLauncherFile !==
        "tinyrustlm/tests/helpers/vnext-campaign-release-surface-launcher.js" ||
      value.durabilityPolicy !==
        "create-only-file-fsync-with-separate-directory-durability-gate") {
    fail("release_gate_profile_invalid");
  }
  exactStringArray(value.implementationFiles, [
    "contracts/vnext/campaign-release-surface-gate-profile.v1.json",
    "tinyrustlm/tests/helpers/vnext-campaign-release-surface-launcher.js",
    "tinyrustlm/tests/helpers/vnext-campaign-release-surface-test-custody.js",
    "tinyrustlm/tests/helpers/vnext-protected-equality-fixtures.js",
    "tinyrustlm/tools/run-vnext-campaign-release-surface-gate.js",
    "tinyrustlm/tools/run-vnext-unit-test-gate.js",
    "tinyrustlm/tools/strict-json.js",
    "tinyrustlm/tools/vnext-jcs.js"
  ], "release_gate_profile_invalid");
  assertDataObject(value.files, [
    "aggregateReceipt", "runIdentity", "shardIdentity", "shardReceipt",
    "stderr", "stdout"
  ], "release_gate_profile_invalid");
  assertDataObject(value.schemas, [
    "aggregateReceipt", "runIdentity", "shardIdentity", "shardReceipt"
  ], "release_gate_profile_invalid");
  if (value.files.aggregateReceipt !== "aggregate-receipt.v1.json" ||
      value.files.runIdentity !== "run-identity.v1.json" ||
      value.files.shardIdentity !== "shard-identity.v1.json" ||
      value.files.shardReceipt !== "shard-receipt.v1.json" ||
      value.files.stderr !== "stderr.log" || value.files.stdout !== "stdout.log" ||
      value.schemas.aggregateReceipt !==
        "tinyrustlm.vnext.campaign_release_surface_gate_aggregate.v1" ||
      value.schemas.runIdentity !==
        "tinyrustlm.vnext.campaign_release_surface_gate_run_identity.v1" ||
      value.schemas.shardIdentity !==
        "tinyrustlm.vnext.campaign_release_surface_gate_shard_identity.v1" ||
      value.schemas.shardReceipt !==
        "tinyrustlm.vnext.campaign_release_surface_gate_shard_receipt.v1") {
    fail("release_gate_profile_invalid");
  }
  exactStringArray(value.summaryFields,
    ["cancelled", "fail", "pass", "skipped", "tests", "todo"],
    "release_gate_profile_invalid");
  if (!Array.isArray(value.childEnvironmentAllowlist) ||
      value.childEnvironmentAllowlist.length === 0 ||
      value.childEnvironmentAllowlist.some((entry, index) =>
        typeof entry !== "string" || !/^[A-Z][A-Z0-9_()]{1,63}$/u.test(entry) ||
        value.childEnvironmentAllowlist.indexOf(entry) !== index)) {
    fail("release_gate_profile_invalid");
  }
  assertDataObject(value.fixedChildEnvironment,
    ["CARGO_NET_OFFLINE", "FORCE_COLOR", "NODE_DISABLE_COLORS", "NO_COLOR",
      "RUST_BACKTRACE", "TZ"],
    "release_gate_profile_invalid");
  if (value.fixedChildEnvironment.CARGO_NET_OFFLINE !== "true" ||
      value.fixedChildEnvironment.FORCE_COLOR !== "0" ||
      value.fixedChildEnvironment.NODE_DISABLE_COLORS !== "1" ||
      value.fixedChildEnvironment.NO_COLOR !== "1" ||
      value.fixedChildEnvironment.RUST_BACKTRACE !== "0" ||
      value.fixedChildEnvironment.TZ !== "UTC") {
    fail("release_gate_profile_invalid");
  }
  assertDataObject(value.limits, [
    "maximumAggregateBytes", "maximumAttemptDirectoriesPerShard",
    "maximumEvidenceRootCharacters", "maximumExecutableBytes",
    "maximumIdentityBytes", "maximumLogBytesPerStream", "maximumReceiptBytes",
    "maximumSourceMemberBytes", "maximumTerminalDurationMilliseconds",
    "maximumToolIdentityBytes"
  ], "release_gate_profile_invalid");
  const expectedLimits = Object.freeze({
    maximumAggregateBytes: 131_072,
    maximumAttemptDirectoriesPerShard: 1_024,
    maximumEvidenceRootCharacters: 4_096,
    maximumExecutableBytes: 134_217_728,
    maximumIdentityBytes: 131_072,
    maximumLogBytesPerStream: 16_777_216,
    maximumReceiptBytes: 131_072,
    maximumSourceMemberBytes: 67_108_864,
    maximumTerminalDurationMilliseconds: 21_605_000,
    maximumToolIdentityBytes: 65_536
  });
  for (const [key, expected] of Object.entries(expectedLimits)) {
    if (value.limits[key] !== expected) fail("release_gate_profile_invalid");
  }
  exactStringArray(value.failureCodes, [
    "child_exit_nonzero", "child_log_write_failed", "child_output_invalid", "child_output_limit",
    "child_signal", "child_spawn_failed", "child_stderr_nonempty",
    "child_timeout"
  ], "release_gate_profile_invalid");
  exactStringArray(value.verdicts, ["fail", "pass"],
    "release_gate_profile_invalid");
  if (!Array.isArray(value.toolIdentityCommands) ||
      value.toolIdentityCommands.length !== 3) {
    fail("release_gate_profile_invalid");
  }
  const expectedTools = [
    ["cargo", "cargo", ["--version", "--verbose"]],
    ["git", "git", ["--version"]],
    ["rustc", "rustc", ["--version", "--verbose"]]
  ];
  value.toolIdentityCommands.forEach((entry, index) => {
    assertDataObject(entry, ["arguments", "command", "id"],
      "release_gate_profile_invalid");
    const expected = expectedTools[index];
    if (entry.id !== expected[0] || entry.command !== expected[1]) {
      fail("release_gate_profile_invalid");
    }
    exactStringArray(entry.arguments, expected[2], "release_gate_profile_invalid");
  });
  if (!Array.isArray(value.shards) || value.shards.length !== 8 ||
      value.shards.some((shard) => !Array.isArray(shard) || shard.length === 0 ||
        shard.some((name) => typeof name !== "string" || name.length === 0 ||
          name.length > 512))) {
    fail("release_gate_profile_invalid");
  }
  const names = value.shards.flat();
  if (names.length !== 23 || new Set(names).size !== names.length ||
      !Array.isArray(value.nonClaims) || value.nonClaims.length !== 5 ||
      value.nonClaims.some((entry) => typeof entry !== "string" ||
        entry.length === 0 || entry.length > 512)) {
    fail("release_gate_profile_invalid");
  }
  for (const relativePath of [...value.implementationFiles, value.testFile]) {
    readRegularFile(
      sourcePath(relativePath),
      value.limits.maximumSourceMemberBytes,
      false,
      "release_gate_source_invalid"
    );
  }
  return Object.freeze(value);
}

const gateProfile = loadGateProfile();
const releaseSurfaceShards = Object.freeze(gateProfile.shards.map((shard) =>
  Object.freeze([...shard])));
const maximumConcurrentShards = gateProfile.maximumConcurrentShards;
const releaseSurfaceTestFile = sourcePath(gateProfile.testFile);

function extractTopLevelTestNames(source) {
  if (typeof source !== "string") throw new TypeError("test source must be a string");
  return Array.from(source.matchAll(/^test\("([^"\r\n]+)"/gmu), (match) => match[1]);
}

function validateShardPartition(source, shards = releaseSurfaceShards) {
  if (!Array.isArray(shards) || shards.length === 0) {
    throw new Error("release gate shard partition must be a nonempty array");
  }
  const actual = extractTopLevelTestNames(source);
  const expected = [];
  const seen = new Set();
  for (const shard of shards) {
    if (!Array.isArray(shard) || shard.length === 0) {
      throw new Error("release gate shards must be nonempty arrays");
    }
    for (const name of shard) {
      if (typeof name !== "string" || name.length === 0) {
        throw new Error("release gate names must be nonempty strings");
      }
      if (seen.has(name)) throw new Error(`duplicate release gate test name: ${name}`);
      seen.add(name);
      expected.push(name);
    }
  }
  if (new Set(actual).size !== actual.length) {
    throw new Error("release surface test file contains duplicate top-level test names");
  }
  const actualSorted = [...actual].sort();
  const expectedSorted = [...expected].sort();
  if (actualSorted.length !== expectedSorted.length ||
      actualSorted.some((name, index) => name !== expectedSorted[index])) {
    const unassigned = actualSorted.filter((name) => !seen.has(name));
    const absent = expectedSorted.filter((name) => !actual.includes(name));
    throw new Error(
      `release gate partition drift: unassigned=${JSON.stringify(unassigned)} ` +
      `absent=${JSON.stringify(absent)}`
    );
  }
  return Object.freeze({ shardCount: shards.length, testCount: actual.length });
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function shardPattern(names) {
  return `^(?:${names.map(escapeRegex).join("|")})$`;
}

async function runShardPool(shards, maximumConcurrency, worker) {
  if (!Array.isArray(shards) || shards.length === 0 ||
      !Number.isSafeInteger(maximumConcurrency) || maximumConcurrency < 1 ||
      maximumConcurrency > shards.length || typeof worker !== "function") {
    throw new TypeError("invalid release-surface shard pool configuration");
  }
  const results = new Array(shards.length);
  let nextIndex = 0;
  async function consume() {
    while (nextIndex < shards.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(shards[index], index);
    }
  }
  await Promise.all(Array.from(
    { length: Math.min(maximumConcurrency, shards.length) },
    consume
  ));
  return results;
}

function pathIdentity(value) {
  return process.platform === "win32" ? value.toLowerCase() : value;
}

function isDirectChild(parent, child) {
  const relative = path.relative(pathIdentity(parent), pathIdentity(child));
  return Boolean(relative) && !relative.startsWith("..") &&
    !path.isAbsolute(relative) && !relative.includes(path.sep);
}

function assertExistingDirectoryWithoutLinks(value, code) {
  let stat;
  let real;
  try {
    stat = fs.lstatSync(value);
    real = fs.realpathSync.native(value);
  } catch (_error) {
    fail(code);
  }
  if (!stat.isDirectory() || stat.isSymbolicLink() ||
      pathIdentity(path.normalize(real)) !== pathIdentity(path.normalize(value))) {
    fail(code);
  }
}

function normalizeEvidenceRoot(value) {
  if (typeof value !== "string" || value.length === 0 ||
      value.length > gateProfile.limits.maximumEvidenceRootCharacters ||
      value.includes("\0") || !path.isAbsolute(value)) {
    fail("release_gate_evidence_root_invalid");
  }
  const normalized = path.normalize(value);
  if (normalized !== path.resolve(value)) fail("release_gate_evidence_root_invalid");
  assertExistingDirectoryWithoutLinks(normalized, "release_gate_evidence_root_invalid");
  return normalized;
}

function ensureDirectDirectory(parent, name, code) {
  if (typeof name !== "string" || !/^[a-z0-9][a-z0-9._-]{0,191}$/u.test(name)) {
    fail(code);
  }
  const target = path.join(parent, name);
  if (!isDirectChild(parent, target)) fail(code);
  try {
    fs.mkdirSync(target, { mode: 0o700, recursive: false });
  } catch (error) {
    if (error?.code !== "EEXIST") fail(code);
  }
  assertExistingDirectoryWithoutLinks(target, code);
  return target;
}

function writeExclusive(filePath, bytes, code) {
  let descriptor;
  try {
    descriptor = fs.openSync(filePath, "wx", 0o600);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.writeSync(descriptor, bytes, offset, bytes.length - offset, offset);
      if (count <= 0) fail(code);
      offset += count;
    }
    fs.fsyncSync(descriptor);
  } catch (error) {
    if (error?.code === code) throw error;
    fail(code);
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch (_error) {
        // The create-only write or typed failure remains authoritative.
      }
    }
  }
}

function commitAtomicCreateOnly(directory, fileName, bytes, maximumBytes, label) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > maximumBytes ||
      !/^[a-z0-9][a-z0-9.-]{0,127}$/u.test(fileName)) {
    fail(`${label}_invalid`);
  }
  const destination = path.join(directory, fileName);
  if (!isDirectChild(directory, destination)) fail(`${label}_path_invalid`);
  if (fs.existsSync(destination)) {
    const existing = readRegularFile(destination, maximumBytes, false, `${label}_invalid`);
    if (!existing.equals(bytes)) fail(`${label}_conflict`);
    return destination;
  }
  const pendingName = `.pending-${label}-${crypto.randomBytes(16).toString("hex")}`;
  const pending = path.join(directory, pendingName);
  if (!isDirectChild(directory, pending)) fail(`${label}_path_invalid`);
  writeExclusive(pending, bytes, `${label}_write_failed`);
  try {
    fs.linkSync(pending, destination);
  } catch (error) {
    if (error?.code !== "EEXIST") fail(`${label}_commit_failed`);
  } finally {
    try {
      fs.unlinkSync(pending);
    } catch (error) {
      if (error?.code !== "ENOENT") fail(`${label}_cleanup_failed`);
    }
  }
  const committed = readRegularFile(destination, maximumBytes, false, `${label}_invalid`);
  if (!committed.equals(bytes)) fail(`${label}_conflict`);
  return destination;
}

function environmentValue(environment, requestedName) {
  const actualName = Object.keys(environment).find((name) =>
    process.platform === "win32"
      ? name.toUpperCase() === requestedName.toUpperCase()
      : name === requestedName);
  if (!actualName) return null;
  const value = environment[actualName];
  if (typeof value !== "string" || value.length === 0 || value.length > 32_768 ||
      value.includes("\0")) {
    fail("release_gate_environment_invalid");
  }
  return value;
}

function buildChildEnvironment(environment = process.env) {
  if (!environment || typeof environment !== "object" || Array.isArray(environment)) {
    fail("release_gate_environment_invalid");
  }
  const child = Object.create(null);
  const bindings = [];
  for (const name of gateProfile.childEnvironmentAllowlist) {
    const value = environmentValue(environment, name);
    if (value === null) {
      bindings.push(Object.freeze({ name, present: false, sha256: null }));
    } else {
      child[name] = value;
      bindings.push(Object.freeze({
        name,
        present: true,
        sha256: sha256(Buffer.from(value, "utf8"))
      }));
    }
  }
  for (const [name, value] of Object.entries(gateProfile.fixedChildEnvironment)) {
    child[name] = value;
    bindings.push(Object.freeze({
      name,
      present: true,
      sha256: sha256(Buffer.from(value, "utf8"))
    }));
  }
  bindings.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  return Object.freeze({
    bindings: Object.freeze(bindings),
    environment: Object.freeze(child)
  });
}

function runBoundedCommand(command, argumentsList, environment, code, allowEmpty = false) {
  const result = childProcess.spawnSync(command, argumentsList, {
    cwd: repositoryRoot,
    encoding: null,
    env: environment,
    maxBuffer: gateProfile.limits.maximumToolIdentityBytes,
    shell: false,
    windowsHide: true
  });
  if (result.error || result.signal !== null || result.status !== 0 ||
      !Buffer.isBuffer(result.stdout) || !Buffer.isBuffer(result.stderr) ||
      result.stderr.length !== 0 || (!allowEmpty && result.stdout.length === 0) ||
      result.stdout.length > gateProfile.limits.maximumToolIdentityBytes) {
    fail(code);
  }
  return result.stdout;
}

function gitText(argumentsList, environment, allowEmpty = false) {
  const bytes = runBoundedCommand(
    "git",
    ["-C", repositoryRoot, ...argumentsList],
    environment,
    "release_gate_source_identity_invalid",
    allowEmpty
  );
  const value = bytes.toString("utf8").trim();
  if (value.includes("\0")) fail("release_gate_source_identity_invalid");
  return value;
}

function implementationClosure() {
  const members = gateProfile.implementationFiles.map((relativePath) => {
    const identity = hashRegularFile(
      sourcePath(relativePath),
      gateProfile.limits.maximumSourceMemberBytes,
      "release_gate_source_invalid"
    );
    return Object.freeze({ path: relativePath, ...identity });
  });
  return Object.freeze({
    members: Object.freeze(members),
    sha256: sha256(canonicalizeVnextJcsBytes(members))
  });
}

function toolIdentities(environment) {
  const identities = gateProfile.toolIdentityCommands.map((entry) => {
    const bytes = runBoundedCommand(
      entry.command,
      entry.arguments,
      environment,
      "release_gate_tool_identity_invalid"
    );
    return Object.freeze({
      byteCount: bytes.length,
      id: entry.id,
      sha256: sha256(bytes)
    });
  });
  return Object.freeze(identities);
}

function buildRunContext(environment = process.env) {
  const child = buildChildEnvironment(environment);
  const sourceRevision = gitText(["rev-parse", "HEAD"], child.environment);
  const sourceTree = gitText(["rev-parse", "HEAD^{tree}"], child.environment);
  const status = gitText(
    ["status", "--porcelain=v1", "--untracked-files=all"],
    child.environment,
    true
  );
  if (!gitObjectPattern.test(sourceRevision) || !gitObjectPattern.test(sourceTree) ||
      status !== "") {
    fail("release_gate_source_not_clean");
  }
  const source = readRegularFile(
    releaseSurfaceTestFile,
    gateProfile.limits.maximumSourceMemberBytes,
    false,
    "release_gate_source_invalid"
  );
  const coverage = validateShardPartition(source.toString("utf8"));
  const closure = implementationClosure();
  const runnerIdentity = closure.members.find((entry) =>
    entry.path === gateProfile.runnerFile);
  if (!runnerIdentity) fail("release_gate_source_invalid");
  const nodeExecutablePath = fs.realpathSync.native(process.execPath);
  const nodeExecutable = hashRegularFile(
    nodeExecutablePath,
    gateProfile.limits.maximumExecutableBytes,
    "release_gate_node_identity_invalid"
  );
  const tools = toolIdentities(child.environment);
  const identity = Object.freeze({
    architecture: process.arch,
    environmentBindings: child.bindings,
    implementationClosureSha256: closure.sha256,
    nodeExecutableByteCount: nodeExecutable.byteCount,
    nodeExecutableSha256: nodeExecutable.sha256,
    nodeVersion: process.version,
    partitionSha256: sha256(canonicalizeVnextJcsBytes(releaseSurfaceShards)),
    platform: process.platform,
    profileId: gateProfile.profileId,
    profileSha256: gateProfileSha256,
    reporter: gateProfile.reporter,
    runnerFileSha256: runnerIdentity.sha256,
    schema: gateProfile.schemas.runIdentity,
    sourceRevision,
    sourceTree,
    testFileSha256: sha256(source),
    toolIdentities: tools
  });
  const runId = sha256(canonicalizeVnextJcsBytes(identity));
  return Object.freeze({
    childEnvironment: child.environment,
    coverage,
    environmentSha256: sha256(canonicalizeVnextJcsBytes(child.bindings)),
    identity,
    runId,
    toolIdentitiesSha256: sha256(canonicalizeVnextJcsBytes(tools))
  });
}

function assertCurrentRunContext(expected) {
  const current = buildRunContext();
  if (current.runId !== expected.runId) fail("release_gate_context_drift");
}

function runIdentityRecord(context) {
  return Object.freeze({
    identity: context.identity,
    runId: context.runId,
    schema: gateProfile.schemas.runIdentity
  });
}

function prepareRunRoot(evidenceRoot, context) {
  const runRoot = ensureDirectDirectory(
    evidenceRoot,
    `run-${context.runId}`,
    "release_gate_run_root_invalid"
  );
  const identityBytes = canonicalizeVnextJcsBytes(runIdentityRecord(context));
  commitAtomicCreateOnly(
    runRoot,
    gateProfile.files.runIdentity,
    identityBytes,
    gateProfile.limits.maximumIdentityBytes,
    "release-gate-run-identity"
  );
  const shardsRoot = ensureDirectDirectory(
    runRoot,
    "shards",
    "release_gate_run_root_invalid"
  );
  return Object.freeze({ runRoot, shardsRoot });
}

function openRunRoot(evidenceRoot, context) {
  const runRoot = path.join(evidenceRoot, `run-${context.runId}`);
  if (!isDirectChild(evidenceRoot, runRoot)) fail("release_gate_run_root_invalid");
  assertExistingDirectoryWithoutLinks(runRoot, "release_gate_run_root_invalid");
  const shardsRoot = path.join(runRoot, "shards");
  if (!isDirectChild(runRoot, shardsRoot)) fail("release_gate_run_root_invalid");
  assertExistingDirectoryWithoutLinks(shardsRoot, "release_gate_run_root_invalid");
  verifyRunIdentity(runRoot, context);
  return Object.freeze({ runRoot, shardsRoot });
}

function verifyRunIdentity(runRoot, context) {
  const expected = canonicalizeVnextJcsBytes(runIdentityRecord(context));
  const actual = readRegularFile(
    path.join(runRoot, gateProfile.files.runIdentity),
    gateProfile.limits.maximumIdentityBytes,
    false,
    "release_gate_run_identity_invalid"
  );
  if (!actual.equals(expected)) fail("release_gate_run_identity_invalid");
}

function shardIdentity(context, names, index) {
  const identity = Object.freeze({
    runId: context.runId,
    schema: gateProfile.schemas.shardIdentity,
    shardIndex: index,
    testNames: Object.freeze([...names])
  });
  return Object.freeze({
    identity,
    shardId: sha256(canonicalizeVnextJcsBytes(identity))
  });
}

function shardDirectoryName(index, shardId) {
  return `shard-${String(index + 1).padStart(2, "0")}-${shardId}`;
}

function prepareShardRoot(paths, context, names, index) {
  const shard = shardIdentity(context, names, index);
  const shardRoot = ensureDirectDirectory(
    paths.shardsRoot,
    shardDirectoryName(index, shard.shardId),
    "release_gate_shard_root_invalid"
  );
  const record = Object.freeze({
    identity: shard.identity,
    shardId: shard.shardId,
    schema: gateProfile.schemas.shardIdentity
  });
  commitAtomicCreateOnly(
    shardRoot,
    gateProfile.files.shardIdentity,
    canonicalizeVnextJcsBytes(record),
    gateProfile.limits.maximumIdentityBytes,
    "release-gate-shard-identity"
  );
  return Object.freeze({ ...shard, shardRoot });
}

function openShardRoot(paths, context, names, index) {
  const shard = shardIdentity(context, names, index);
  const shardRoot = path.join(paths.shardsRoot, shardDirectoryName(index, shard.shardId));
  if (!isDirectChild(paths.shardsRoot, shardRoot)) {
    fail("release_gate_shard_root_invalid");
  }
  assertExistingDirectoryWithoutLinks(shardRoot, "release_gate_shard_root_invalid");
  const expected = canonicalizeVnextJcsBytes(Object.freeze({
    identity: shard.identity,
    shardId: shard.shardId,
    schema: gateProfile.schemas.shardIdentity
  }));
  const actual = readRegularFile(
    path.join(shardRoot, gateProfile.files.shardIdentity),
    gateProfile.limits.maximumIdentityBytes,
    false,
    "release_gate_shard_identity_invalid"
  );
  if (!actual.equals(expected)) fail("release_gate_shard_identity_invalid");
  return Object.freeze({ ...shard, shardRoot });
}

function decodeUtf8(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch (_error) {
    return null;
  }
}

function parseSpecOutput(stdout, expectedNames) {
  const text = decodeUtf8(stdout);
  const emptySummary = Object.freeze(Object.fromEntries(
    gateProfile.summaryFields.map((field) => [field, null])
  ));
  if (text === null) {
    return Object.freeze({
      observedTestNames: Object.freeze([]),
      summary: emptySummary,
      valid: false
    });
  }
  const lines = text.split(/\r?\n/u);
  const observedTestNames = [];
  const summary = Object.fromEntries(
    gateProfile.summaryFields.map((field) => [field, null])
  );
  let valid = true;
  for (const line of lines) {
    if (line.startsWith("✔ ")) {
      const match = /^✔ (.+) \((?:0|[1-9][0-9]*)(?:\.[0-9]+)?ms\)$/u.exec(line);
      if (!match) {
        valid = false;
      } else {
        observedTestNames.push(match[1]);
      }
      continue;
    }
    if (line.startsWith("✖ ") || line.startsWith("﹣ ")) {
      valid = false;
      continue;
    }
    const summaryMatch = /^ℹ ([a-z_]+) ([0-9]+)$/u.exec(line);
    if (summaryMatch && gateProfile.summaryFields.includes(summaryMatch[1])) {
      const field = summaryMatch[1];
      const value = Number(summaryMatch[2]);
      if (summary[field] !== null || !Number.isSafeInteger(value)) {
        valid = false;
      } else {
        summary[field] = value;
      }
    }
  }
  if (gateProfile.summaryFields.some((field) => summary[field] === null) ||
      observedTestNames.length !== expectedNames.length ||
      observedTestNames.some((name, index) => name !== expectedNames[index]) ||
      summary.tests !== expectedNames.length || summary.pass !== expectedNames.length ||
      summary.fail !== 0 || summary.cancelled !== 0 || summary.skipped !== 0 ||
      summary.todo !== 0) {
    valid = false;
  }
  return Object.freeze({
    observedTestNames: Object.freeze(observedTestNames),
    summary: Object.freeze(summary),
    valid
  });
}

function deriveShardObservation(stdout, stderr, terminal, expectedNames) {
  if (!Buffer.isBuffer(stdout) || !Buffer.isBuffer(stderr) ||
      !terminal || typeof terminal !== "object" || Array.isArray(terminal) ||
      typeof terminal.logWriteFailed !== "boolean" ||
      typeof terminal.outputLimitExceeded !== "boolean" ||
      typeof terminal.spawnFailed !== "boolean" ||
      typeof terminal.timedOut !== "boolean") {
    throw new TypeError("invalid shard observation input");
  }
  const parsed = parseSpecOutput(stdout, expectedNames);
  let failureCode = null;
  if (terminal.outputLimitExceeded) {
    failureCode = "child_output_limit";
  } else if (terminal.logWriteFailed) {
    failureCode = "child_log_write_failed";
  } else if (terminal.timedOut) {
    failureCode = "child_timeout";
  } else if (terminal.spawnFailed) {
    failureCode = "child_spawn_failed";
  } else if (terminal.signal !== null) {
    failureCode = "child_signal";
  } else if (terminal.exitCode !== 0) {
    failureCode = "child_exit_nonzero";
  } else if (stderr.length !== 0) {
    failureCode = "child_stderr_nonempty";
  } else if (!parsed.valid) {
    failureCode = "child_output_invalid";
  }
  return Object.freeze({
    failureCode,
    observedTestNames: parsed.observedTestNames,
    summary: parsed.summary,
    verdict: failureCode === null ? "pass" : "fail"
  });
}

function childArguments(names) {
  return Object.freeze([
    gateProfile.testLauncherFile,
    fixtureProfileForTestNames(names),
    "--test",
    `--test-isolation=${gateProfile.testIsolation}`,
    `--test-reporter=${gateProfile.reporter}`,
    `--test-name-pattern=${shardPattern(names)}`,
    gateProfile.testFile
  ]);
}

function receiptIdentityFields(context) {
  return Object.freeze({
    architecture: context.identity.architecture,
    environmentSha256: context.environmentSha256,
    implementationClosureSha256: context.identity.implementationClosureSha256,
    nodeExecutableSha256: context.identity.nodeExecutableSha256,
    nodeVersion: context.identity.nodeVersion,
    partitionSha256: context.identity.partitionSha256,
    platform: context.identity.platform,
    profileId: gateProfile.profileId,
    profileSha256: gateProfileSha256,
    reporter: gateProfile.reporter,
    runId: context.runId,
    runnerFileSha256: context.identity.runnerFileSha256,
    sourceRevision: context.identity.sourceRevision,
    sourceTree: context.identity.sourceTree,
    testFileSha256: context.identity.testFileSha256,
    toolIdentitiesSha256: context.toolIdentitiesSha256
  });
}

function sameData(left, right) {
  return canonicalizeVnextJcsBytes(left).equals(canonicalizeVnextJcsBytes(right));
}

function validateSummary(value) {
  assertDataObject(value, gateProfile.summaryFields, "release_gate_receipt_invalid");
  for (const field of gateProfile.summaryFields) {
    if (!(value[field] === null || (Number.isSafeInteger(value[field]) &&
      value[field] >= 0))) {
      fail("release_gate_receipt_invalid");
    }
  }
}

function verifyShardReceipt(attemptRoot, context, shard) {
  assertExistingDirectoryWithoutLinks(attemptRoot, "release_gate_attempt_invalid");
  const attemptId = path.basename(attemptRoot);
  if (!attemptIdPattern.test(attemptId)) fail("release_gate_attempt_invalid");
  const receiptPath = path.join(attemptRoot, gateProfile.files.shardReceipt);
  const receiptBytes = readRegularFile(
    receiptPath,
    gateProfile.limits.maximumReceiptBytes,
    false,
    "release_gate_receipt_invalid"
  );
  let receipt;
  try {
    receipt = parseStrictJson(receiptBytes);
  } catch (_error) {
    fail("release_gate_receipt_invalid");
  }
  if (!canonicalizeVnextJcsBytes(receipt).equals(receiptBytes)) {
    fail("release_gate_receipt_noncanonical");
  }
  assertDataObject(receipt, [
    "architecture", "attemptId", "childArgumentsSha256", "durationMilliseconds",
    "environmentSha256", "exitCode", "failureCode", "finishedUtc",
    "implementationClosureSha256", "nodeExecutableSha256", "nodeVersion",
    "logWriteFailed", "observedTestNames", "outputLimitExceeded", "partitionSha256", "platform",
    "profileId", "profileSha256", "reporter", "runId", "runnerFileSha256",
    "schema", "shardId", "shardIndex", "signal", "sourceRevision", "sourceTree",
    "spawnFailed", "startedUtc", "stderrByteCount", "stderrFile", "stderrSha256",
    "stdoutByteCount", "stdoutFile", "stdoutSha256", "summary", "testFileSha256",
    "testNames", "timedOut", "toolIdentitiesSha256", "verdict"
  ], "release_gate_receipt_invalid");
  const identity = receiptIdentityFields(context);
  for (const [key, expected] of Object.entries(identity)) {
    if (receipt[key] !== expected) fail("release_gate_receipt_identity_mismatch");
  }
  if (receipt.schema !== gateProfile.schemas.shardReceipt ||
      receipt.attemptId !== attemptId || receipt.shardId !== shard.shardId ||
      receipt.shardIndex !== shard.identity.shardIndex ||
      receipt.childArgumentsSha256 !==
        sha256(canonicalizeVnextJcsBytes(childArguments(shard.identity.testNames))) ||
      !Array.isArray(receipt.testNames) ||
      !Array.isArray(receipt.observedTestNames) ||
      !sameData(receipt.testNames, shard.identity.testNames) ||
      receipt.observedTestNames.some((entry) => typeof entry !== "string") ||
      typeof receipt.logWriteFailed !== "boolean" ||
      typeof receipt.outputLimitExceeded !== "boolean" ||
      typeof receipt.spawnFailed !== "boolean" || typeof receipt.timedOut !== "boolean" ||
      !(receipt.exitCode === null || (Number.isSafeInteger(receipt.exitCode) &&
        receipt.exitCode >= 0 && receipt.exitCode <= 255)) ||
      !(receipt.signal === null || (typeof receipt.signal === "string" &&
        signalPattern.test(receipt.signal))) ||
      !gateProfile.verdicts.includes(receipt.verdict) ||
      !(receipt.failureCode === null ||
        gateProfile.failureCodes.includes(receipt.failureCode)) ||
      !utcPattern.test(receipt.startedUtc) || !utcPattern.test(receipt.finishedUtc) ||
      !Number.isSafeInteger(receipt.durationMilliseconds) ||
      receipt.durationMilliseconds < 0 ||
      receipt.durationMilliseconds >
        gateProfile.limits.maximumTerminalDurationMilliseconds ||
      receipt.stdoutFile !== gateProfile.files.stdout ||
      receipt.stderrFile !== gateProfile.files.stderr ||
      !Number.isSafeInteger(receipt.stdoutByteCount) || receipt.stdoutByteCount < 0 ||
      receipt.stdoutByteCount > gateProfile.limits.maximumLogBytesPerStream ||
      !Number.isSafeInteger(receipt.stderrByteCount) || receipt.stderrByteCount < 0 ||
      receipt.stderrByteCount > gateProfile.limits.maximumLogBytesPerStream ||
      !sha256Pattern.test(receipt.stdoutSha256) ||
      !sha256Pattern.test(receipt.stderrSha256)) {
    fail("release_gate_receipt_invalid");
  }
  const started = Date.parse(receipt.startedUtc);
  const finished = Date.parse(receipt.finishedUtc);
  if (!Number.isFinite(started) || !Number.isFinite(finished) || finished < started ||
      finished - started > gateProfile.limits.maximumTerminalDurationMilliseconds) {
    fail("release_gate_receipt_invalid");
  }
  validateSummary(receipt.summary);
  const stdout = readRegularFile(
    path.join(attemptRoot, receipt.stdoutFile),
    gateProfile.limits.maximumLogBytesPerStream,
    true,
    "release_gate_log_invalid"
  );
  const stderr = readRegularFile(
    path.join(attemptRoot, receipt.stderrFile),
    gateProfile.limits.maximumLogBytesPerStream,
    true,
    "release_gate_log_invalid"
  );
  if (stdout.length !== receipt.stdoutByteCount || sha256(stdout) !== receipt.stdoutSha256 ||
      stderr.length !== receipt.stderrByteCount || sha256(stderr) !== receipt.stderrSha256) {
    fail("release_gate_log_invalid");
  }
  const observation = deriveShardObservation(stdout, stderr, Object.freeze({
    exitCode: receipt.exitCode,
    logWriteFailed: receipt.logWriteFailed,
    outputLimitExceeded: receipt.outputLimitExceeded,
    signal: receipt.signal,
    spawnFailed: receipt.spawnFailed,
    timedOut: receipt.timedOut
  }), shard.identity.testNames);
  if (receipt.failureCode !== observation.failureCode ||
      receipt.verdict !== observation.verdict ||
      !sameData(receipt.summary, observation.summary) ||
      !sameData(receipt.observedTestNames, observation.observedTestNames)) {
    fail("release_gate_receipt_verdict_mismatch");
  }
  const entries = fs.readdirSync(attemptRoot).sort();
  const allowed = new Set([
    gateProfile.files.shardReceipt,
    gateProfile.files.stderr,
    gateProfile.files.stdout
  ]);
  if (entries.some((name) => !allowed.has(name) &&
      !/^\.pending-release-gate-shard-receipt-[a-f0-9]{32}$/u.test(name))) {
    fail("release_gate_attempt_invalid");
  }
  return Object.freeze({
    attemptId,
    finishedUtc: receipt.finishedUtc,
    receiptByteCount: receiptBytes.length,
    receiptSha256: sha256(receiptBytes),
    startedUtc: receipt.startedUtc,
    verdict: receipt.verdict
  });
}

function validateIncompleteAttempt(attemptRoot) {
  const entries = fs.readdirSync(attemptRoot).sort();
  const allowed = new Set([gateProfile.files.stderr, gateProfile.files.stdout]);
  if (entries.some((name) => !allowed.has(name) &&
      !/^\.pending-release-gate-shard-receipt-[a-f0-9]{32}$/u.test(name))) {
    fail("release_gate_attempt_invalid");
  }
  for (const name of entries.filter((entry) => allowed.has(entry))) {
    readRegularFile(
      path.join(attemptRoot, name),
      gateProfile.limits.maximumLogBytesPerStream,
      true,
      "release_gate_log_invalid"
    );
  }
}

function scanShardReceipts(shard, context) {
  const entries = fs.readdirSync(shard.shardRoot).sort();
  const attempts = entries.filter((name) => attemptIdPattern.test(name));
  if (attempts.length > gateProfile.limits.maximumAttemptDirectoriesPerShard ||
      entries.some((name) => name !== gateProfile.files.shardIdentity &&
        !attemptIdPattern.test(name) &&
        !/^\.pending-release-gate-shard-identity-[a-f0-9]{32}$/u.test(name))) {
    fail("release_gate_shard_root_invalid");
  }
  const passes = [];
  const failures = [];
  let incompleteCount = 0;
  for (const attemptId of attempts) {
    const attemptRoot = path.join(shard.shardRoot, attemptId);
    assertExistingDirectoryWithoutLinks(attemptRoot, "release_gate_attempt_invalid");
    const receiptPath = path.join(attemptRoot, gateProfile.files.shardReceipt);
    if (!fs.existsSync(receiptPath)) {
      validateIncompleteAttempt(attemptRoot);
      incompleteCount += 1;
      continue;
    }
    const verified = verifyShardReceipt(attemptRoot, context, shard);
    (verified.verdict === "pass" ? passes : failures).push(verified);
  }
  passes.sort((left, right) => left.startedUtc.localeCompare(right.startedUtc) ||
    left.attemptId.localeCompare(right.attemptId));
  failures.sort((left, right) => left.startedUtc.localeCompare(right.startedUtc) ||
    left.attemptId.localeCompare(right.attemptId));
  return Object.freeze({
    failures: Object.freeze(failures),
    incompleteCount,
    passes: Object.freeze(passes)
  });
}

function terminateProcessTree(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32") {
    childProcess.spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      shell: false,
      stdio: "ignore",
      windowsHide: true
    });
    return;
  }
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

function createLogSink(filePath, outputStream, terminate) {
  const descriptor = fs.openSync(filePath, "wx", 0o600);
  let byteCount = 0;
  let logWriteFailed = false;
  let outputLimitExceeded = false;
  let closed = false;
  return Object.freeze({
    append(chunk) {
      if (closed) return;
      const bytes = Buffer.from(chunk);
      const remaining = Math.max(
        0,
        gateProfile.limits.maximumLogBytesPerStream - byteCount
      );
      const accepted = bytes.subarray(0, remaining);
      if (accepted.length > 0) {
        try {
          let offset = 0;
          while (offset < accepted.length) {
            const count = fs.writeSync(
              descriptor,
              accepted,
              offset,
              accepted.length - offset,
              null
            );
            if (count <= 0) throw new Error("short log write");
            offset += count;
          }
          byteCount += accepted.length;
          outputStream.write(accepted);
        } catch (_error) {
          logWriteFailed = true;
          terminate();
        }
      }
      if (accepted.length !== bytes.length && !outputLimitExceeded) {
        outputLimitExceeded = true;
        terminate();
      }
    },
    close() {
      if (!closed) {
        fs.fsyncSync(descriptor);
        fs.closeSync(descriptor);
        closed = true;
      }
    },
    get byteCount() {
      return byteCount;
    },
    get logWriteFailed() {
      return logWriteFailed;
    },
    get outputLimitExceeded() {
      return outputLimitExceeded;
    }
  });
}

async function executeShard(shard, context, activeChildren) {
  const startedMilliseconds = Date.now();
  const startedUtc = new Date(startedMilliseconds).toISOString();
  const attemptId =
    `attempt-${startedMilliseconds}-${crypto.randomBytes(16).toString("hex")}`;
  const attemptRoot = ensureDirectDirectory(
    shard.shardRoot,
    attemptId,
    "release_gate_attempt_invalid"
  );
  const stdoutPath = path.join(attemptRoot, gateProfile.files.stdout);
  const stderrPath = path.join(attemptRoot, gateProfile.files.stderr);
  const argumentsList = childArguments(shard.identity.testNames);
  let child;
  let timedOut = false;
  let spawnFailed = false;
  let timeout;
  let stdoutSink;
  let stderrSink;
  const startedMonotonic = process.hrtime.bigint();
  const terminal = await new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      resolve(value);
    };
    const terminate = () => terminateProcessTree(child);
    try {
      stdoutSink = createLogSink(stdoutPath, process.stdout, terminate);
      stderrSink = createLogSink(stderrPath, process.stderr, terminate);
      child = childProcess.spawn(process.execPath, argumentsList, {
        cwd: repositoryRoot,
        detached: process.platform !== "win32",
        env: context.childEnvironment,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true
      });
      activeChildren.add(child);
      child.stdout.on("data", (chunk) => stdoutSink.append(chunk));
      child.stderr.on("data", (chunk) => stderrSink.append(chunk));
      timeout = setTimeout(() => {
        timedOut = true;
        terminateProcessTree(child);
      }, gateProfile.shardTimeoutMilliseconds);
      child.once("error", () => {
        spawnFailed = true;
      });
      child.once("close", (code, signal) => {
        activeChildren.delete(child);
        finish(Object.freeze({
          exitCode: Number.isSafeInteger(code) ? code : null,
          signal: typeof signal === "string" ? signal : null
        }));
      });
    } catch (_error) {
      spawnFailed = true;
      finish(Object.freeze({ exitCode: null, signal: null }));
    }
  });
  stdoutSink?.close();
  stderrSink?.close();
  const durationMilliseconds = Number(
    (process.hrtime.bigint() - startedMonotonic) / 1_000_000n
  );
  const finishedUtc = new Date(Math.max(Date.now(), startedMilliseconds)).toISOString();
  assertCurrentRunContext(context);
  const stdout = readRegularFile(
    stdoutPath,
    gateProfile.limits.maximumLogBytesPerStream,
    true,
    "release_gate_log_invalid"
  );
  const stderr = readRegularFile(
    stderrPath,
    gateProfile.limits.maximumLogBytesPerStream,
    true,
    "release_gate_log_invalid"
  );
  const terminalRecord = Object.freeze({
    exitCode: terminal.exitCode,
    logWriteFailed: Boolean(stdoutSink?.logWriteFailed || stderrSink?.logWriteFailed),
    outputLimitExceeded: Boolean(
      stdoutSink?.outputLimitExceeded || stderrSink?.outputLimitExceeded
    ),
    signal: terminal.signal,
    spawnFailed,
    timedOut
  });
  const observation = deriveShardObservation(
    stdout,
    stderr,
    terminalRecord,
    shard.identity.testNames
  );
  const receipt = Object.freeze({
    ...receiptIdentityFields(context),
    attemptId,
    childArgumentsSha256: sha256(canonicalizeVnextJcsBytes(argumentsList)),
    durationMilliseconds,
    exitCode: terminalRecord.exitCode,
    failureCode: observation.failureCode,
    finishedUtc,
    logWriteFailed: terminalRecord.logWriteFailed,
    observedTestNames: observation.observedTestNames,
    outputLimitExceeded: terminalRecord.outputLimitExceeded,
    schema: gateProfile.schemas.shardReceipt,
    shardId: shard.shardId,
    shardIndex: shard.identity.shardIndex,
    signal: terminalRecord.signal,
    spawnFailed: terminalRecord.spawnFailed,
    startedUtc,
    stderrByteCount: stderr.length,
    stderrFile: gateProfile.files.stderr,
    stderrSha256: sha256(stderr),
    stdoutByteCount: stdout.length,
    stdoutFile: gateProfile.files.stdout,
    stdoutSha256: sha256(stdout),
    summary: observation.summary,
    testNames: shard.identity.testNames,
    timedOut: terminalRecord.timedOut,
    verdict: observation.verdict
  });
  const receiptBytes = canonicalizeVnextJcsBytes(receipt);
  commitAtomicCreateOnly(
    attemptRoot,
    gateProfile.files.shardReceipt,
    receiptBytes,
    gateProfile.limits.maximumReceiptBytes,
    "release-gate-shard-receipt"
  );
  return verifyShardReceipt(attemptRoot, context, shard);
}

function aggregateRecord(context, selected) {
  const identity = receiptIdentityFields(context);
  return Object.freeze({
    architecture: identity.architecture,
    environmentSha256: identity.environmentSha256,
    implementationClosureSha256: identity.implementationClosureSha256,
    nodeExecutableSha256: identity.nodeExecutableSha256,
    nodeVersion: identity.nodeVersion,
    partitionSha256: identity.partitionSha256,
    platform: identity.platform,
    profileId: identity.profileId,
    profileSha256: identity.profileSha256,
    reporter: identity.reporter,
    runId: identity.runId,
    runnerFileSha256: identity.runnerFileSha256,
    schema: gateProfile.schemas.aggregateReceipt,
    shards: Object.freeze(selected.map((entry, index) => Object.freeze({
      attemptId: entry.attemptId,
      receiptByteCount: entry.receiptByteCount,
      receiptSha256: entry.receiptSha256,
      shardId: entry.shardId,
      shardIndex: index,
      testCount: releaseSurfaceShards[index].length
    }))),
    sourceRevision: identity.sourceRevision,
    sourceTree: identity.sourceTree,
    testCount: context.coverage.testCount,
    testFileSha256: identity.testFileSha256,
    toolIdentitiesSha256: identity.toolIdentitiesSha256,
    verdict: "pass"
  });
}

function verifyAggregate(paths, context) {
  verifyRunIdentity(paths.runRoot, context);
  const aggregatePath = path.join(paths.runRoot, gateProfile.files.aggregateReceipt);
  const bytes = readRegularFile(
    aggregatePath,
    gateProfile.limits.maximumAggregateBytes,
    false,
    "release_gate_aggregate_invalid"
  );
  let aggregate;
  try {
    aggregate = parseStrictJson(bytes);
  } catch (_error) {
    fail("release_gate_aggregate_invalid");
  }
  if (!canonicalizeVnextJcsBytes(aggregate).equals(bytes)) {
    fail("release_gate_aggregate_noncanonical");
  }
  assertDataObject(aggregate, [
    "architecture", "environmentSha256", "implementationClosureSha256", "nodeExecutableSha256",
    "nodeVersion", "partitionSha256", "platform", "profileId", "profileSha256",
    "reporter", "runId", "runnerFileSha256", "schema", "shards", "sourceRevision",
    "sourceTree", "testCount", "testFileSha256", "toolIdentitiesSha256", "verdict"
  ], "release_gate_aggregate_invalid");
  const identity = receiptIdentityFields(context);
  for (const key of [
    "architecture", "environmentSha256", "implementationClosureSha256", "nodeExecutableSha256",
    "nodeVersion", "partitionSha256", "platform", "profileId", "profileSha256",
    "reporter", "runId", "runnerFileSha256", "sourceRevision", "sourceTree",
    "testFileSha256", "toolIdentitiesSha256"
  ]) {
    if (aggregate[key] !== identity[key]) fail("release_gate_aggregate_identity_mismatch");
  }
  if (aggregate.schema !== gateProfile.schemas.aggregateReceipt ||
      aggregate.verdict !== "pass" || aggregate.testCount !== context.coverage.testCount ||
      !Array.isArray(aggregate.shards) ||
      aggregate.shards.length !== releaseSurfaceShards.length) {
    fail("release_gate_aggregate_invalid");
  }
  let total = 0;
  for (const [index, reference] of aggregate.shards.entries()) {
    assertDataObject(reference, [
      "attemptId", "receiptByteCount", "receiptSha256", "shardId", "shardIndex",
      "testCount"
    ], "release_gate_aggregate_invalid");
    const shard = openShardRoot(
      paths,
      context,
      releaseSurfaceShards[index],
      index
    );
    if (reference.shardIndex !== index || reference.shardId !== shard.shardId ||
        reference.testCount !== releaseSurfaceShards[index].length ||
        !attemptIdPattern.test(reference.attemptId) ||
        !Number.isSafeInteger(reference.receiptByteCount) ||
        reference.receiptByteCount <= 0 ||
        reference.receiptByteCount > gateProfile.limits.maximumReceiptBytes ||
        !sha256Pattern.test(reference.receiptSha256)) {
      fail("release_gate_aggregate_invalid");
    }
    const verified = verifyShardReceipt(
      path.join(shard.shardRoot, reference.attemptId),
      context,
      shard
    );
    if (verified.verdict !== "pass" ||
        verified.receiptByteCount !== reference.receiptByteCount ||
        verified.receiptSha256 !== reference.receiptSha256) {
      fail("release_gate_aggregate_receipt_invalid");
    }
    total += reference.testCount;
  }
  if (total !== context.coverage.testCount) fail("release_gate_aggregate_invalid");
  return Object.freeze({
    aggregateByteCount: bytes.length,
    aggregateSha256: sha256(bytes),
    runId: context.runId,
    testCount: aggregate.testCount,
    verdict: aggregate.verdict
  });
}

function aggregateExists(paths) {
  return fs.existsSync(path.join(paths.runRoot, gateProfile.files.aggregateReceipt));
}

function validateRunRootEntries(paths) {
  const entries = fs.readdirSync(paths.runRoot).sort();
  const allowed = new Set([
    gateProfile.files.aggregateReceipt,
    gateProfile.files.runIdentity,
    "shards"
  ]);
  if (entries.some((name) => !allowed.has(name) &&
      !/^\.pending-release-gate-(?:aggregate|run-identity)-[a-f0-9]{32}$/u.test(name))) {
    fail("release_gate_run_root_invalid");
  }
}

function verifyGateEvidence(evidenceRootValue) {
  const evidenceRoot = normalizeEvidenceRoot(evidenceRootValue);
  const context = buildRunContext();
  const paths = openRunRoot(evidenceRoot, context);
  validateRunRootEntries(paths);
  if (!aggregateExists(paths)) fail("release_gate_aggregate_missing");
  return verifyAggregate(paths, context);
}

async function runGate(evidenceRootValue) {
  const evidenceRoot = normalizeEvidenceRoot(evidenceRootValue);
  const context = buildRunContext();
  const paths = prepareRunRoot(evidenceRoot, context);
  validateRunRootEntries(paths);
  if (aggregateExists(paths)) {
    const existing = verifyAggregate(paths, context);
    process.stdout.write(
      `release-surface gate reused verified aggregate ${existing.aggregateSha256}\n`
    );
    return existing;
  }
  process.stdout.write(
    `release-surface gate run ${context.runId} scheduling ` +
    `${context.coverage.shardCount} shards with maximum concurrency ` +
    `${maximumConcurrentShards}\n`
  );
  const activeChildren = new Set();
  const stopChildren = () => {
    for (const child of activeChildren) terminateProcessTree(child);
  };
  process.once("SIGINT", stopChildren);
  process.once("SIGTERM", stopChildren);
  try {
    const selected = [];
    for (const [index, names] of releaseSurfaceShards.entries()) {
      const shard = prepareShardRoot(paths, context, names, index);
      const retained = scanShardReceipts(shard, context);
      let verified = retained.passes[0];
      if (verified) {
        process.stdout.write(
          `release-surface shard ${index + 1}/${releaseSurfaceShards.length} ` +
          `reused verified attempt ${verified.attemptId}\n`
        );
      } else {
        process.stdout.write(
          `release-surface shard ${index + 1}/${releaseSurfaceShards.length} ` +
          `started (${names.length} tests; retained failures ${retained.failures.length}; ` +
          `incomplete ${retained.incompleteCount})\n`
        );
        verified = await executeShard(shard, context, activeChildren);
      }
      if (verified.verdict !== "pass") {
        fail("release_gate_shard_failed");
      }
      selected.push(Object.freeze({ ...verified, shardId: shard.shardId }));
    }
    assertCurrentRunContext(context);
    const aggregateBytes = canonicalizeVnextJcsBytes(aggregateRecord(context, selected));
    commitAtomicCreateOnly(
      paths.runRoot,
      gateProfile.files.aggregateReceipt,
      aggregateBytes,
      gateProfile.limits.maximumAggregateBytes,
      "release-gate-aggregate"
    );
    const result = verifyAggregate(paths, context);
    process.stdout.write(
      `release-surface gate passed: ${result.testCount}/${result.testCount} tests; ` +
      `aggregate ${result.aggregateSha256}\n`
    );
    return result;
  } finally {
    process.removeListener("SIGINT", stopChildren);
    process.removeListener("SIGTERM", stopChildren);
    stopChildren();
  }
}

function printResult(result) {
  process.stdout.write(`${JSON.stringify({
    aggregateByteCount: result.aggregateByteCount,
    aggregateSha256: result.aggregateSha256,
    runId: result.runId,
    testCount: result.testCount,
    verdict: result.verdict
  })}\n`);
}

async function main() {
  const [operation, evidenceRoot, ...extra] = process.argv.slice(2);
  if (operation === "validate" && evidenceRoot === undefined && extra.length === 0) {
    const source = readRegularFile(
      releaseSurfaceTestFile,
      gateProfile.limits.maximumSourceMemberBytes,
      false,
      "release_gate_source_invalid"
    );
    const coverage = validateShardPartition(source.toString("utf8"));
    process.stdout.write(
      `release-surface gate partition valid: ${coverage.testCount} tests in ` +
      `${coverage.shardCount} exhaustive shards; profile ${gateProfileSha256}\n`
    );
    return;
  }
  if (operation === "run" && evidenceRoot && extra.length === 0) {
    printResult(await runGate(evidenceRoot));
    return;
  }
  if (operation === "verify" && evidenceRoot && extra.length === 0) {
    printResult(verifyGateEvidence(evidenceRoot));
    return;
  }
  fail("release_gate_cli_invalid");
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error?.code || "release_gate_failed"}\n`);
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  buildChildEnvironment,
  buildRunContext,
  childArguments,
  deriveShardObservation,
  extractTopLevelTestNames,
  gateProfileId,
  gateProfileSha256,
  maximumConcurrentShards,
  releaseSurfaceShards,
  runGate,
  runShardPool,
  shardPattern,
  validateShardPartition,
  verifyGateEvidence
});
