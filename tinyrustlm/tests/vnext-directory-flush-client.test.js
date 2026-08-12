"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");
const { canonicalizeVnextJcsBytes } = require("../tools/vnext-jcs.js");
const {
  createConfiguredVnextDirectoryFlushClient,
  createVnextDirectoryFlushClient,
  directoryFlushClientProfile,
  directoryFlushClientProfileSha256,
  directoryFlushClientSourceClosureSha256
} = require("../tools/vnext-directory-flush-client.js");
const {
  ensureVnextDirectoryFlushTestPackage,
  packageEnvironmentVariable
} = require("./helpers/vnext-directory-flush-test-package.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "directory-flush-client-profile.v1.json");
const ownedPrefix = "tinyrustlm-vnext-directory-flush-client-";

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function makeRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), ownedPrefix));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function throwsCode(callback, code) {
  let observed;
  assert.throws(callback, (error) => {
    observed = error;
    return error?.code === code;
  }, `expected ${code}`);
  return observed;
}

function clonePackage(t) {
  const source = ensureVnextDirectoryFlushTestPackage();
  const root = makeRoot(t);
  const fixture = path.join(root, "package");
  fs.cpSync(source, fixture, { recursive: true });
  return Object.freeze({ fixture, root });
}

function manifestPath(packageRoot) {
  return path.join(packageRoot, "directory-flush-helper-manifest.v1.json");
}

function readManifest(packageRoot) {
  return parseStrictJson(fs.readFileSync(manifestPath(packageRoot)));
}

function writeManifest(packageRoot, manifest) {
  fs.writeFileSync(manifestPath(packageRoot), canonicalizeVnextJcsBytes(manifest));
}

function request(root, operationId = "directory-flush-client-operation-900",
  relativeDirectory = ".") {
  return Object.freeze({ operationId, ownedRoot: root, relativeDirectory });
}

test("freezes one strict Node-to-Rust directory flush client profile", () => {
  const bytes = fs.readFileSync(profilePath);
  const profile = parseStrictJson(bytes);
  assert.equal(bytes.length, 5_845);
  assert.equal(directoryFlushClientProfileSha256, sha256(bytes));
  assert.equal(directoryFlushClientProfileSha256,
    "0d5fe88e8abb371a99db58f1ce3fabce180dc00f77287b6f44ea40d268d709a1");
  assert.equal(directoryFlushClientProfile.profileId,
    "tinyrustlm.vnext.directory-flush-client.v1");
  assert.equal(profile.directoryFlushProfileSha256,
    "bb9c76715d0b35d63a9da27006ff8f88840486cf287cec24279a1020a0443ddb");
  assert.equal(profile.batch.maximumEntries, 1_024);
  assert.equal(profile.batch.processInvocations, "exactly-one-per-flush-many-call");
  assert.equal(profile.package.configuration,
    "explicit-absolute-root-from-one-environment-variable");
  assert.equal(profile.process.shell, false);
  assert.equal(profile.process.networkBehaviorContract,
    "helper-must-not-open-network-connections");
  assert.equal(profile.process.osNetworkIsolation, "not-provided-by-node-client");
  assert.equal(profile.process.parentEnvironment, "empty-no-inherited-variables");
  assert.equal(profile.process.workingDirectory, "verified-package-root");
  assert.equal(profile.process.timeoutKillSignal, "SIGKILL");
  assert.equal(profile.result.rawPathOutput, "forbidden");
  assert.equal(profile.result.rawProcessOutput, "forbidden");
  assert.equal(profile.result.helperFailure,
    "strict-canonical-public-safe-cause-code-only");
  assert.equal(directoryFlushClientSourceClosureSha256,
    "b265141e0749422bcdadefab7777c97d154f442ac18397f69664dd1af24447f3");
});

test("reconstructs the declared client source closure exactly", () => {
  const members = directoryFlushClientProfile.clientSourceClosureMembers.map(
    (relativePath) => {
      const bytes = fs.readFileSync(path.join(
        repositoryRoot,
        ...relativePath.split("/")
      ));
      return {
        byteCount: bytes.length,
        path: relativePath,
        sha256: sha256(bytes)
      };
    }
  );
  assert.equal(
    sha256(canonicalizeVnextJcsBytes(members)),
    directoryFlushClientSourceClosureSha256
  );
});

test("executes the exact packaged Rust helper and returns bounded path-redacted evidence", (t) => {
  const packageRoot = ensureVnextDirectoryFlushTestPackage();
  const root = makeRoot(t);
  fs.mkdirSync(path.join(root, "receipts"));
  const client = createVnextDirectoryFlushClient(packageRoot);
  const result = client.flush({
    operationId: "directory-flush-client-operation-001",
    ownedRoot: root,
    relativeDirectory: "receipts"
  });

  assert.equal(result.schema, "tinyrustlm.vnext.directory_flush_client_result.v1");
  assert.equal(result.status, "performed");
  assert.equal(result.operationId, "directory-flush-client-operation-001");
  assert.equal(result.directoryFlushProfileId, "tinyrustlm.vnext.directory-flush.v1");
  assert.equal(result.directoryFlushProfileSha256,
    "bb9c76715d0b35d63a9da27006ff8f88840486cf287cec24279a1020a0443ddb");
  assert.equal(result.helperTrustClass, "local-test-build");
  assert.equal(result.clientProfileId,
    "tinyrustlm.vnext.directory-flush-client.v1");
  assert.equal(result.clientProfileSha256, directoryFlushClientProfileSha256);
  assert.equal(result.clientSourceClosureSha256,
    directoryFlushClientSourceClosureSha256);
  assert.equal(result.nodeRuntimeVersion, process.version);
  assert.match(result.requestSha256, /^[a-f0-9]{64}$/u);
  assert.match(result.observationSha256, /^[a-f0-9]{64}$/u);
  assert.match(result.directoryIdentitySha256, /^[a-f0-9]{64}$/u);
  assert.match(result.executableSha256, /^[a-f0-9]{64}$/u);
  assert.deepEqual(Object.keys(result), directoryFlushClientProfile.clientResultFields);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(JSON.stringify(result).includes(root), false);
  assert.equal(JSON.stringify(result).includes(packageRoot), false);
});

test("executes one verified helper process for a deterministic directory batch", (t) => {
  const packageRoot = ensureVnextDirectoryFlushTestPackage();
  const root = makeRoot(t);
  for (const directory of ["first", "second", "third"]) {
    fs.mkdirSync(path.join(root, directory));
  }
  const client = createVnextDirectoryFlushClient(packageRoot);
  const originalSpawnSync = childProcess.spawnSync;
  let spawnCount = 0;
  t.mock.method(childProcess, "spawnSync", (...argumentsList) => {
    spawnCount += 1;
    return originalSpawnSync(...argumentsList);
  });

  const results = client.flushMany([
    request(root, "directory-flush-client-batch-003", "third"),
    request(root, "directory-flush-client-batch-001", "first"),
    request(root, "directory-flush-client-batch-002", "second")
  ]);

  assert.equal(spawnCount, 1);
  assert.deepEqual(results.map((entry) => entry.operationId), [
    "directory-flush-client-batch-001",
    "directory-flush-client-batch-002",
    "directory-flush-client-batch-003"
  ]);
  assert.equal(new Set(results.map((entry) => entry.requestSha256)).size, 3);
  assert.equal(new Set(results.map((entry) => entry.observationSha256)).size, 3);
  for (const result of results) {
    assert.deepEqual(Object.keys(result), directoryFlushClientProfile.clientResultFields);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(JSON.stringify(result).includes(root), false);
    assert.equal(JSON.stringify(result).includes(packageRoot), false);
  }
  assert.equal(Object.isFrozen(results), true);
});

test("rejects empty duplicate and accessor-bearing directory batches", (t) => {
  const root = makeRoot(t);
  const client = createVnextDirectoryFlushClient(
    ensureVnextDirectoryFlushTestPackage()
  );
  throwsCode(() => client.flushMany([]), "directory_flush_batch_invalid");
  throwsCode(() => client.flushMany([
    request(root, "directory-flush-client-batch-004"),
    request(root, "directory-flush-client-batch-004")
  ]), "directory_flush_batch_invalid");
  const hostile = [];
  Object.defineProperty(hostile, "0", {
    enumerable: true,
    get() {
      throw new Error("must not execute");
    }
  });
  throwsCode(() => client.flushMany(hostile), "directory_flush_batch_invalid");
  throwsCode(() => client.flushMany(Array.from({ length: 1_025 }, (_entry, index) =>
    request(root, `directory-flush-client-count-${String(index).padStart(4, "0")}`))),
  "directory_flush_batch_invalid");
  throwsCode(() => client.flushMany(Array.from({ length: 1_024 }, (_entry, index) =>
    request(root, `directory-flush-client-size-${String(index).padStart(4, "0")}`,
      "a".repeat(5_000)))), "directory_flush_request_byte_limit");
});

test("supports the explicit owned-root scope through configured package discovery", (t) => {
  const packageRoot = ensureVnextDirectoryFlushTestPackage();
  assert.equal(process.env[packageEnvironmentVariable], packageRoot);
  const root = makeRoot(t);
  const result = createConfiguredVnextDirectoryFlushClient().flush({
    operationId: "directory-flush-client-operation-002",
    ownedRoot: root,
    relativeDirectory: "."
  });
  assert.equal(result.status, "performed");
});

test("rejects relative package roots and hostile request objects", (t) => {
  throwsCode(() => createVnextDirectoryFlushClient("relative-package"),
    "directory_flush_package_root_not_absolute");

  if (process.platform === "win32") {
    throwsCode(() => createVnextDirectoryFlushClient("\\\\example.invalid\\share\\package"),
      "directory_flush_package_root_not_local");
  }

  const options = {};
  Object.defineProperty(options, "operationId", {
    enumerable: true,
    get() {
      throw new Error("must not execute");
    }
  });
  const client = createVnextDirectoryFlushClient(ensureVnextDirectoryFlushTestPackage());
  throwsCode(() => client.flush(options), "directory_flush_request_invalid");

  const root = makeRoot(t);
  throwsCode(() => client.flush({ ...request(root), unknown: true }),
    "directory_flush_request_invalid");
  throwsCode(() => client.flush({
    operationId: "directory-flush-client-operation-004",
    ownedRoot: root,
    relativeDirectory: "a".repeat(16_385)
  }), "directory_flush_request_invalid");
});

test("requires explicit configured package discovery", (t) => {
  ensureVnextDirectoryFlushTestPackage();
  const prior = process.env[packageEnvironmentVariable];
  t.after(() => {
    process.env[packageEnvironmentVariable] = prior;
  });
  delete process.env[packageEnvironmentVariable];
  throwsCode(() => createConfiguredVnextDirectoryFlushClient(),
    "directory_flush_package_not_configured");
});

test("rejects executable drift before invoking the helper", (t) => {
  const { fixture, root } = clonePackage(t);
  const manifest = readManifest(fixture);
  fs.appendFileSync(path.join(fixture, manifest.executableFile), Buffer.from([0]));
  const client = createVnextDirectoryFlushClient(fixture);
  throwsCode(() => client.flush({
    operationId: "directory-flush-client-operation-003",
    ownedRoot: root,
    relativeDirectory: "."
  }), "directory_flush_executable_identity_mismatch");
});

test("runs the real helper with no inherited environment and fixed process options", (t) => {
  const packageRoot = ensureVnextDirectoryFlushTestPackage();
  const root = makeRoot(t);
  const client = createVnextDirectoryFlushClient(packageRoot);
  const originalSpawnSync = childProcess.spawnSync;
  let observed;
  t.mock.method(childProcess, "spawnSync", (file, argumentsList, options) => {
    observed = { file, argumentsList, options };
    return originalSpawnSync(file, argumentsList, options);
  });

  const result = client.flush(request(root, "directory-flush-client-operation-005"));
  assert.equal(result.status, "performed");
  assert.equal(observed.file, path.join(packageRoot,
    process.platform === "win32" ? "tinyrustlm-directory-flush.exe" :
      "tinyrustlm-directory-flush"));
  assert.deepEqual(observed.argumentsList, []);
  assert.deepEqual(Object.keys(observed.options.env), []);
  assert.equal(observed.options.cwd, packageRoot);
  assert.equal(observed.options.shell, false);
  assert.equal(observed.options.killSignal, "SIGKILL");
  assert.deepEqual(observed.options.stdio, ["pipe", "pipe", "pipe"]);
});

test("validates and propagates one public-safe real-helper failure", (t) => {
  const packageRoot = ensureVnextDirectoryFlushTestPackage();
  const root = makeRoot(t);
  const client = createVnextDirectoryFlushClient(packageRoot);
  const error = throwsCode(() => client.flush({
    operationId: "directory-flush-client-operation-006",
    ownedRoot: root,
    relativeDirectory: "missing"
  }), "directory_flush_helper_failed");
  assert.equal(error.causeCode, "directory_path_missing");
  assert.equal(error.message.includes(root), false);
});

test("rejects ambiguous, noncanonical, drifted, and oversized manifests", async (t) => {
  await t.test("unknown field", (subtest) => {
    const { fixture } = clonePackage(subtest);
    writeManifest(fixture, { ...readManifest(fixture), unknown: true });
    throwsCode(() => createVnextDirectoryFlushClient(fixture),
      "directory_flush_manifest_invalid");
  });

  await t.test("duplicate field", (subtest) => {
    const { fixture } = clonePackage(subtest);
    const canonical = fs.readFileSync(manifestPath(fixture), "utf8");
    fs.writeFileSync(manifestPath(fixture),
      `{"architecture":"duplicate",${canonical.slice(1)}`);
    throwsCode(() => createVnextDirectoryFlushClient(fixture),
      "directory_flush_manifest_invalid");
  });

  await t.test("noncanonical bytes", (subtest) => {
    const { fixture } = clonePackage(subtest);
    fs.writeFileSync(manifestPath(fixture),
      `${JSON.stringify(readManifest(fixture), null, 2)}\n`);
    throwsCode(() => createVnextDirectoryFlushClient(fixture),
      "directory_flush_manifest_noncanonical");
  });

  await t.test("helper profile drift", (subtest) => {
    const { fixture } = clonePackage(subtest);
    writeManifest(fixture, {
      ...readManifest(fixture),
      directoryFlushProfileSha256: "0".repeat(64)
    });
    throwsCode(() => createVnextDirectoryFlushClient(fixture),
      "directory_flush_manifest_invalid");
  });

  await t.test("platform drift", (subtest) => {
    const { fixture } = clonePackage(subtest);
    writeManifest(fixture, { ...readManifest(fixture), architecture: "wrong" });
    throwsCode(() => createVnextDirectoryFlushClient(fixture),
      "directory_flush_manifest_invalid");
  });

  await t.test("release trust on debug bytes", (subtest) => {
    const { fixture } = clonePackage(subtest);
    writeManifest(fixture, { ...readManifest(fixture), trustClass: "release-package" });
    throwsCode(() => createVnextDirectoryFlushClient(fixture),
      "directory_flush_manifest_invalid");
  });

  await t.test("manifest byte limit", (subtest) => {
    const { fixture } = clonePackage(subtest);
    fs.writeFileSync(manifestPath(fixture), Buffer.alloc(
      directoryFlushClientProfile.package.manifestMaximumBytes + 1, 0x20));
    throwsCode(() => createVnextDirectoryFlushClient(fixture),
      "directory_flush_manifest_read_failed");
  });
});

test("rejects package-root links before reading package bytes", (t) => {
  const source = ensureVnextDirectoryFlushTestPackage();
  const root = makeRoot(t);
  const link = path.join(root, "package-link");
  try {
    fs.symlinkSync(source, link, process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) {
      t.skip(`host cannot create a test directory link: ${error.code}`);
      return;
    }
    throw error;
  }
  throwsCode(() => createVnextDirectoryFlushClient(link),
    "directory_flush_package_path_link");
});

test("detects manifest replacement after client construction", (t) => {
  const { fixture, root } = clonePackage(t);
  const client = createVnextDirectoryFlushClient(fixture);
  writeManifest(fixture, {
    ...readManifest(fixture),
    sourceClosureSha256: "1".repeat(64)
  });
  throwsCode(() => client.flush(request(root,
    "directory-flush-client-operation-007")), "directory_flush_package_changed");
});

test("maps timeout, output overflow, and spawn failures without leaking causes", async (t) => {
  const cases = [
    ["ETIMEDOUT", "directory_flush_process_timeout"],
    ["ENOBUFS", "directory_flush_process_output_invalid"],
    ["EACCES", "directory_flush_process_spawn_failed"]
  ];
  for (const [cause, expected] of cases) {
    await t.test(cause, (subtest) => {
      const packageRoot = ensureVnextDirectoryFlushTestPackage();
      const root = makeRoot(subtest);
      const client = createVnextDirectoryFlushClient(packageRoot);
      subtest.mock.method(childProcess, "spawnSync", () => ({
        error: Object.assign(new Error(`private ${root}`), { code: cause }),
        signal: null,
        status: null,
        stderr: null,
        stdout: null
      }));
      const error = throwsCode(() => client.flush(request(root)), expected);
      assert.equal(error.message.includes(root), false);
      assert.equal(error.causeCode, null);
    });
  }
});

test("rejects stderr, abnormal exits, and malformed helper documents", async (t) => {
  const cases = [
    ["stderr", {
      error: undefined, signal: null, status: 0,
      stderr: Buffer.from("private output"), stdout: Buffer.from("{}")
    }, "directory_flush_process_stderr"],
    ["signal", {
      error: undefined, signal: "SIGKILL", status: null,
      stderr: Buffer.alloc(0), stdout: Buffer.from("{}")
    }, "directory_flush_process_failed"],
    ["unexpected status", {
      error: undefined, signal: null, status: 3,
      stderr: Buffer.alloc(0), stdout: Buffer.from("{}")
    }, "directory_flush_process_failed"],
    ["malformed failure", {
      error: undefined, signal: null, status: 2,
      stderr: Buffer.alloc(0), stdout: Buffer.from("{}")
    }, "directory_flush_failure_invalid"],
    ["malformed success", {
      error: undefined, signal: null, status: 0,
      stderr: Buffer.alloc(0), stdout: Buffer.from("{}")
    }, "directory_flush_observation_invalid"]
  ];
  for (const [name, child, expected] of cases) {
    await t.test(name, (subtest) => {
      const packageRoot = ensureVnextDirectoryFlushTestPackage();
      const root = makeRoot(subtest);
      const client = createVnextDirectoryFlushClient(packageRoot);
      subtest.mock.method(childProcess, "spawnSync", () => child);
      throwsCode(() => client.flush(request(root)), expected);
    });
  }
});

test("rejects a substituted canonical success observation", (t) => {
  const packageRoot = ensureVnextDirectoryFlushTestPackage();
  const root = makeRoot(t);
  const client = createVnextDirectoryFlushClient(packageRoot);
  const originalSpawnSync = childProcess.spawnSync;
  t.mock.method(childProcess, "spawnSync", (file, argumentsList, options) => {
    const child = originalSpawnSync(file, argumentsList, options);
    const observation = parseStrictJson(child.stdout);
    return { ...child, stdout: canonicalizeVnextJcsBytes({
      ...observation,
      observations: [{
        ...observation.observations[0],
        operationId: "substituted-operation"
      }]
    }) };
  });
  throwsCode(() => client.flush(request(root,
    "directory-flush-client-operation-008")), "directory_flush_observation_invalid");
});

test("detects executable replacement after helper execution", (t) => {
  const { fixture, root } = clonePackage(t);
  const manifest = readManifest(fixture);
  const executable = path.join(fixture, manifest.executableFile);
  const client = createVnextDirectoryFlushClient(fixture);
  const originalSpawnSync = childProcess.spawnSync;
  t.mock.method(childProcess, "spawnSync", (file, argumentsList, options) => {
    const child = originalSpawnSync(file, argumentsList, options);
    fs.appendFileSync(executable, Buffer.from([0]));
    return child;
  });
  throwsCode(() => client.flush(request(root,
    "directory-flush-client-operation-009")), "directory_flush_executable_changed");
});

test("detects manifest replacement after helper execution", (t) => {
  const { fixture, root } = clonePackage(t);
  const client = createVnextDirectoryFlushClient(fixture);
  const originalSpawnSync = childProcess.spawnSync;
  t.mock.method(childProcess, "spawnSync", (file, argumentsList, options) => {
    const child = originalSpawnSync(file, argumentsList, options);
    writeManifest(fixture, {
      ...readManifest(fixture),
      sourceClosureSha256: "2".repeat(64)
    });
    return child;
  });
  throwsCode(() => client.flush(request(root,
    "directory-flush-client-operation-010")),
  "directory_flush_package_changed_during_execution");
});
