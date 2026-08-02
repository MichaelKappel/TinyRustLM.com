"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const benchmarkV1 = path.join(
  repositoryRoot,
  "tinyrustlm/experiments/vector-quantization/portable-affine-u8-benchmark.rs"
);
const benchmarkV2 = path.join(
  repositoryRoot,
  "tinyrustlm/experiments/vector-quantization/portable-affine-u8-benchmark-v2.rs"
);
const frozenV1Sha256 =
  "96b9d257b2d9a29dcc6c2981cd92ed9a97460a08247796079c66902ba972b8af";

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function run(command, argumentsList, options = {}) {
  const result = childProcess.spawnSync(command, argumentsList, {
    cwd: repositoryRoot,
    env: options.env ?? process.env,
    encoding: "utf8",
    windowsHide: true,
    timeout: options.timeout ?? 120_000,
    maxBuffer: 4 * 1024 * 1024
  });
  assert.equal(result.error, undefined, `${options.label ?? command} did not spawn`);
  assert.equal(result.signal, null, `${options.label ?? command} received a signal`);
  assert.equal(result.status, 0, `${options.label ?? command} failed`);
  return result;
}

function removeOwnedTemporaryRoot(root) {
  const resolved = path.resolve(root);
  const temporaryRoot = path.resolve(os.tmpdir());
  assert.ok(
    resolved.startsWith(`${temporaryRoot}${path.sep}`) &&
      path.basename(resolved).startsWith("tinyrustlm-affine-v2-test-"),
    "temporary test root is not owned"
  );
  fs.rmSync(resolved, { recursive: true, force: true });
  assert.equal(fs.existsSync(resolved), false);
}

test("keeps the terminal v1 benchmark immutable and gives v2 a distinct identity", () => {
  const v1 = fs.readFileSync(benchmarkV1);
  const v2 = fs.readFileSync(benchmarkV2);
  assert.equal(v1.length, 122_925);
  assert.equal(sha256(v1), frozenV1Sha256);
  assert.notEqual(sha256(v2), frozenV1Sha256);
  const source = v2.toString("utf8");
  assert.match(source, /portable-affine-u8-flat-json-domain-v2-20260726/u);
  assert.match(source, /portable_affine_u8_quality_process\.v2/u);
  assert.match(source, /fn json_finite_f64\(value: f64\) -> BenchResult<String>/u);
  assert.match(source, /fn json_signed_unit_f64\(value: f64\) -> BenchResult<String>/u);
  assert.doesNotMatch(source, /JSON metrics must be finite unit-interval values/u);
});

test(
  "compiles and passes every embedded v2 regression without an outcome invocation",
  { timeout: 120_000 },
  (context) => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "tinyrustlm-affine-v2-test-")
    );
    context.after(() => removeOwnedTemporaryRoot(root));
    const targetRoot = path.join(root, "target");
    const environment = {
      ...process.env,
      CARGO_NET_OFFLINE: "true",
      CARGO_TARGET_DIR: targetRoot
    };
    run(
      "cargo",
      [
        "build",
        "--manifest-path",
        "Cargo.toml",
        "-p",
        "tinyrustlm-vector-oracle",
        "--locked",
        "--offline",
        "--quiet"
      ],
      { env: environment, label: "offline vector-oracle build" }
    );
    const dependencyRoot = path.join(targetRoot, "debug", "deps");
    const libraries = fs
      .readdirSync(dependencyRoot)
      .filter((name) => /^libtinyrustlm_vector_oracle-[0-9a-f]+\.rlib$/u.test(name));
    assert.equal(libraries.length, 1, "vector-oracle rlib count");
    const library = path.join(dependencyRoot, libraries[0]);
    const binary = path.join(
      root,
      process.platform === "win32"
        ? "portable-affine-u8-benchmark-v2-tests.exe"
        : "portable-affine-u8-benchmark-v2-tests"
    );
    run(
      "rustc",
      [
        "--edition=2021",
        "--test",
        "-D",
        "warnings",
        "--extern",
        `tinyrustlm_vector_oracle=${library}`,
        "-L",
        `dependency=${dependencyRoot}`,
        "-o",
        binary,
        benchmarkV2
      ],
      { env: environment, label: "v2 benchmark test compile" }
    );
    const result = run(binary, [], {
      env: environment,
      label: "v2 benchmark embedded tests"
    });
    assert.match(result.stdout, /test result: ok\. 9 passed;/u);
  }
);
