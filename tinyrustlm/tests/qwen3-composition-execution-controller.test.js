"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  bindingSchema,
  canonicalJson,
  inspectPeMachine,
  requestSchema,
  runCapturedProcess,
  sha256File,
  startSchema,
  terminalSchema,
  validateRequestShape,
  writeNewDurable
} = require("../tools/qwen3-composition-execution-controller.js");

function fixtureRequest() {
  return {
    schema: requestSchema,
    executionId: "qwen3-composition-test-v1",
    registration: {
      repositoryRoot: "/repo",
      profilePath: "/repo/profile.json",
      profileByteLength: 1,
      profileSha256: "a".repeat(64),
      profileId: "tinyrustlm.qwen3-real-composition-execution/2",
      commit: "b".repeat(40),
      tree: "c".repeat(40),
      branch: "codex/model-acquisition-v2",
      controllerPath: "/repo/controller.js",
      controllerByteLength: 1,
      controllerSha256: "d".repeat(64)
    },
    build: {
      sourceCommit: "b".repeat(40),
      sourceTree: "c".repeat(40),
      stdoutPath: "/private/build.stdout.bin",
      stdoutByteLength: 0,
      stdoutSha256: "e".repeat(64),
      stderrPath: "/private/build.stderr.bin",
      stderrByteLength: 1,
      stderrSha256: "f".repeat(64),
      executablePath: "/private/tinyrustlm-convert.exe",
      executableByteLength: 1,
      executableSha256: "1".repeat(64),
      peMachine: "0x8664",
      command: [
        "cargo", "build", "--locked", "--release", "-p", "tinyrustlm-convert",
        "--target", "x86_64-pc-windows-msvc"
      ],
      environment: {
        CARGO_INCREMENTAL: "0",
        CARGO_NET_OFFLINE: "true",
        CARGO_TARGET_DIR: "/private/build"
      },
      toolchain: { rustcRelease: "1.96.0" }
    },
    inputs: {
      modelSourceLockPath: "/repo/model-lock.json",
      modelSourceLockSha256: "2".repeat(64),
      modelSourceDirectory: "/private/model",
      tokenizerSourceLockPath: "/repo/tokenizer-lock.json",
      tokenizerSourceLockSha256: "3".repeat(64),
      tokenizerSourceDirectory: "/private/tokenizer",
      compositionProfilePath: "/repo/composition-profile.json",
      compositionProfileSha256: "4".repeat(64)
    },
    invocation: {
      evidenceRoot: "/private/evidence",
      outputRoot: "/private/output",
      workingDirectory: "/repo",
      arguments: ["qwen3-composition"],
      maximumDurationMilliseconds: 1000,
      maximumStdoutBytes: 65536,
      maximumStderrBytes: 4096
    }
  };
}

test("exports one exact execution schema family", () => {
  assert.equal(requestSchema, "tinyrustlm.qwen3-composition-execution-request.v1");
  assert.equal(bindingSchema, "tinyrustlm.qwen3-composition-execution-binding.v1");
  assert.equal(startSchema, "tinyrustlm.qwen3-composition-execution-start.v1");
  assert.equal(terminalSchema, "tinyrustlm.qwen3-composition-execution-terminal.v1");
});

test("accepts only the ordered, closed private request shape", () => {
  const request = fixtureRequest();
  assert.doesNotThrow(() => validateRequestShape(request));

  const reordered = { executionId: request.executionId, schema: request.schema,
    registration: request.registration, build: request.build, inputs: request.inputs,
    invocation: request.invocation };
  assert.throws(() => validateRequestShape(reordered), /execution-request-fields/u);

  const extended = structuredClone(request);
  extended.retry = true;
  assert.throws(() => validateRequestShape(extended), /execution-request-fields/u);
});

test("writes create-only durable evidence and refuses overwrite", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-composition-evidence-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const target = path.join(root, "execution.binding.json");
  const bytes = Buffer.from(canonicalJson({ schema: bindingSchema, status: "bound" }), "utf8");

  writeNewDurable(target, bytes, 4096);

  assert.deepEqual(fs.readFileSync(target), bytes);
  assert.throws(() => writeNewDurable(target, bytes, 4096), /EEXIST/u);
});

test("stream hashes empty and nonempty evidence without loading it as text", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-composition-hash-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const empty = path.join(root, "empty.bin");
  const data = path.join(root, "data.bin");
  fs.writeFileSync(empty, Buffer.alloc(0));
  fs.writeFileSync(data, Buffer.from([0, 1, 2, 3, 255]));

  assert.deepEqual(sha256File(empty, 1, true), {
    byteLength: 0,
    sha256: crypto.createHash("sha256").update(Buffer.alloc(0)).digest("hex")
  });
  assert.deepEqual(sha256File(data), {
    byteLength: 5,
    sha256: crypto.createHash("sha256").update(Buffer.from([0, 1, 2, 3, 255])).digest("hex")
  });
});

test("captures a child process into separate bounded raw streams", async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-composition-process-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const script = path.join(root, "fixture.js");
  const stdoutPath = path.join(root, "stdout.bin");
  const stderrPath = path.join(root, "stderr.bin");
  fs.writeFileSync(script, "process.stdout.write(Buffer.from([0, 65, 10]));\n");

  const result = await runCapturedProcess(process.execPath, [script], {
    workingDirectory: root,
    stdoutPath,
    stderrPath,
    maximumDurationMilliseconds: 30000,
    maximumStdoutBytes: 16,
    maximumStderrBytes: 16
  });

  assert.equal(result.processStarted, true);
  assert.equal(result.exitCode, 0);
  assert.equal(result.signal, null);
  assert.equal(result.timedOut, false);
  assert.equal(result.killedForOverflow, false);
  assert.deepEqual(fs.readFileSync(stdoutPath), Buffer.from([0, 65, 10]));
  assert.deepEqual(fs.readFileSync(stderrPath), Buffer.alloc(0));
});

test("terminates an owned child when its bounded evidence stream overflows", async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-composition-overflow-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const script = path.join(root, "fixture.js");
  const stdoutPath = path.join(root, "stdout.bin");
  const stderrPath = path.join(root, "stderr.bin");
  fs.writeFileSync(script, "process.stdout.write('x'.repeat(4096)); setTimeout(() => {}, 30000);\n");

  const result = await runCapturedProcess(process.execPath, [script], {
    workingDirectory: root,
    stdoutPath,
    stderrPath,
    maximumDurationMilliseconds: 30000,
    maximumStdoutBytes: 32,
    maximumStderrBytes: 32
  });

  assert.equal(result.processStarted, true);
  assert.equal(result.killedForOverflow, true);
  assert.equal(result.stdout.overflow, true);
  assert.equal(fs.lstatSync(stdoutPath).size, 33);
});

test("recognizes the current 64-bit Windows executable machine", {
  skip: process.platform !== "win32" || process.arch !== "x64"
}, () => {
  assert.equal(inspectPeMachine(process.execPath), "0x8664");
});
