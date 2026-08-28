"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");
const { resolveCargoTargetRoot } = require("./helpers/cargo-target-root.js");

const workerPath = path.join(__dirname, "..", "app", "model-runtime-worker.js");
const profile = parseStrictJson(fs.readFileSync(path.join(
  __dirname,
  "..",
  "..",
  "contracts",
  "vnext",
  "browser-runtime-wasm-clean-cut-preregistration.v1.json"
)));
const repositoryRoot = path.resolve(__dirname, "../..");
const wasmManifestPath = path.join(
  repositoryRoot,
  "rust",
  "crates",
  "tinyrustlm-browser-runtime-wasm",
  "Cargo.toml"
);
const wasmTargetRoot = path.join(
  resolveCargoTargetRoot(repositoryRoot, process.env.CARGO_TARGET_DIR),
  "model-runtime-worker"
);
const realWasmPath = path.join(
  wasmTargetRoot,
  "wasm32-unknown-unknown",
  "release",
  "tinyrustlm_browser_runtime_wasm.wasm"
);
let realWasmBytes;

function id(label) {
  return crypto.createHash("sha256").update(label, "utf8").digest("hex");
}

function bytesFromHex(value) {
  return Uint8Array.from(Buffer.from(value, "hex"));
}

function moduleApi() {
  delete require.cache[require.resolve(workerPath)];
  return require(workerPath);
}

function cargoExecutable() {
  if (process.env.CARGO) return process.env.CARGO;
  const candidate = process.platform === "win32" && process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, ".cargo", "bin", "cargo.exe")
    : "cargo";
  return fs.existsSync(candidate) ? candidate : "cargo";
}

function buildRealWasm() {
  if (realWasmBytes) return realWasmBytes;
  const result = childProcess.spawnSync(cargoExecutable(), [
    "build",
    "--manifest-path",
    wasmManifestPath,
    "--release",
    "--target",
    "wasm32-unknown-unknown",
    "--target-dir",
    wasmTargetRoot,
    "--locked",
    "--offline"
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
    windowsHide: true
  });
  assert.equal(result.error, undefined, `WASM build spawn failed: ${result.error?.code}`);
  assert.equal(result.status, 0, `WASM build failed:\n${result.stdout}\n${result.stderr}`);
  realWasmBytes = fs.readFileSync(realWasmPath);
  assert.ok(realWasmBytes.length > 0 && realWasmBytes.length <= 16 * 1024 * 1024);
  return realWasmBytes;
}

class FakeAbi {
  constructor() {
    this.memoryBytes = new ArrayBuffer(8 * 1024 * 1024);
    this.resultPointer = 6 * 1024 * 1024;
    this.errorPointer = 7 * 1024 * 1024;
    this.resultLength = 0;
    this.errorLength = 0;
    this.pending = null;
    this.committed = new Map();
    this.cancelCount = 0;
    this.released = false;
    this.operationId = "";
    this.transcriptRevisionLow = 0;
    this.transcriptRevisionHigh = 0;
    this.activeCompositionId = null;
    this.state = "empty";
    this.stepQueue = [];
    this.output = null;
    this.nextFailure = null;
    this.exports = this.createExports();
  }

  createExports() {
    return {
      memory: { buffer: this.memoryBytes },
      __data_end: 0,
      __heap_base: 1024,
      tinyrustlm_browser_runtime_abi_version: () => 1,
      tinyrustlm_browser_runtime_transfer_begin: (kind, length) =>
        this.transferBegin(kind, length),
      tinyrustlm_browser_runtime_transfer_commit: (kind, pointer, length) =>
        this.transferCommit(kind, pointer, length),
      tinyrustlm_browser_runtime_transfer_cancel: () => this.transferCancel(),
      tinyrustlm_browser_runtime_create: (...args) => this.create(...args),
      tinyrustlm_browser_runtime_activate: () => this.activate(),
      tinyrustlm_browser_runtime_advance_operation: () => this.advanceOperation(),
      tinyrustlm_browser_runtime_set_transcript: (low, high) =>
        this.setTranscript(low, high),
      tinyrustlm_browser_runtime_begin_request: () => this.beginRequest(),
      tinyrustlm_browser_runtime_step: (cancelled) => this.step(cancelled),
      tinyrustlm_browser_runtime_finish: () => this.finish(),
      tinyrustlm_browser_runtime_release: () => this.release(),
      tinyrustlm_browser_runtime_result_ptr: () => this.resultPointer,
      tinyrustlm_browser_runtime_result_len: () => this.resultLength,
      tinyrustlm_browser_runtime_error_ptr: () => this.errorPointer,
      tinyrustlm_browser_runtime_error_len: () => this.errorLength
    };
  }

  failNext(name, status, code) {
    this.nextFailure = { name, status, code };
  }

  maybeFail(name) {
    if (!this.nextFailure || this.nextFailure.name !== name) return null;
    const failure = this.nextFailure;
    this.nextFailure = null;
    this.writeError(failure.code);
    return failure.status;
  }

  writeBytes(pointer, bytes) {
    new Uint8Array(this.memoryBytes, pointer, bytes.length).set(bytes);
  }

  writeError(code) {
    const bytes = Buffer.from(code, "ascii");
    this.writeBytes(this.errorPointer, bytes);
    this.errorLength = bytes.length;
    this.resultLength = 0;
  }

  writeResult(value) {
    const bytes = Buffer.from(JSON.stringify(value), "utf8");
    this.writeBytes(this.resultPointer, bytes);
    this.resultLength = bytes.length;
    this.errorLength = 0;
  }

  transferBegin(kind, length) {
    const failure = this.maybeFail("transfer-begin");
    if (failure !== null) return 0;
    assert.equal(this.pending, null);
    const pointer = 4096;
    this.pending = { kind, length, pointer };
    this.errorLength = 0;
    return pointer;
  }

  transferCommit(kind, pointer, length) {
    const failure = this.maybeFail("transfer-commit");
    if (failure !== null) {
      this.pending = null;
      return failure;
    }
    assert.deepEqual(this.pending, { kind, pointer, length });
    const bytes = Buffer.from(new Uint8Array(this.memoryBytes, pointer, length));
    this.committed.set(kind, bytes);
    this.pending = null;
    this.errorLength = 0;
    return 0;
  }

  transferCancel() {
    this.pending = null;
    this.cancelCount += 1;
    this.errorLength = 0;
    return 0;
  }

  stateReport() {
    const activeComposition = this.activeCompositionId === null ? null : {
      artifactBytes: 896,
      artifactSha256: id("composition-artifact"),
      graphIdentitySha256: this.activeCompositionId,
      memberTableSha256: id("composition-members")
    };
    return {
      schema: "tinyrustlm.browser_runtime_wasm.state/1",
      state: this.state,
      operationId: this.operationId,
      transcriptRevisionLow: this.transcriptRevisionLow,
      transcriptRevisionHigh: this.transcriptRevisionHigh,
      activeComposition,
      committedKvBytes: this.state === "empty" ? 0 : 4096,
      memoryPlan: activeComposition === null ? null : {
        modelBytes: 4,
        kvBytes: 4096,
        scratchBytes: 2048
      },
      observedLinearMemoryBytes: this.memoryBytes.byteLength,
      maximumLinearMemoryBytes: this.memoryBytes.byteLength
    };
  }

  takeOperation(kind) {
    const bytes = this.committed.get(kind);
    assert.equal(bytes?.length, 32);
    this.committed.delete(kind);
    return bytes.toString("hex");
  }

  create() {
    const failure = this.maybeFail("create");
    if (failure !== null) return failure;
    this.operationId = this.takeOperation(1);
    this.state = "empty";
    this.writeResult(this.stateReport());
    return 0;
  }

  activate() {
    const failure = this.maybeFail("activate");
    if (failure !== null) return failure;
    assert.equal(this.takeOperation(1), this.operationId);
    for (const kind of [3, 4, 5, 6, 7, 8]) {
      assert.ok(this.committed.has(kind), `missing activation kind ${kind}`);
      this.committed.delete(kind);
    }
    assert.match(this.activeCompositionId ?? "", /^[0-9a-f]{64}$/u);
    this.state = "active-idle";
    this.writeResult(this.stateReport());
    return 0;
  }

  advanceOperation() {
    const failure = this.maybeFail("advance-operation");
    if (failure !== null) return failure;
    assert.equal(this.takeOperation(1), this.operationId);
    this.operationId = this.takeOperation(2);
    this.writeResult(this.stateReport());
    return 0;
  }

  setTranscript(low, high) {
    const failure = this.maybeFail("set-transcript");
    if (failure !== null) return failure;
    assert.equal(this.takeOperation(1), this.operationId);
    this.transcriptRevisionLow = low;
    this.transcriptRevisionHigh = high;
    this.writeResult(this.stateReport());
    return 0;
  }

  beginRequest() {
    const failure = this.maybeFail("begin-request");
    if (failure !== null) return failure;
    assert.equal(this.takeOperation(1), this.operationId);
    assert.ok(this.committed.has(9));
    this.committed.delete(9);
    this.state = "generating";
    this.writeResult(this.stateReport());
    return 0;
  }

  step(cancelled) {
    const failure = this.maybeFail("step");
    if (failure !== null) return failure;
    assert.equal(this.takeOperation(1), this.operationId);
    let step;
    if (cancelled === 1) {
      step = {
        schema: "tinyrustlm.browser_runtime_wasm.step/1",
        selectedTokenId: null,
        emittedTokenId: null,
        status: { kind: "cancelled", stopTokenId: null },
        committedKvBytes: 4096
      };
    } else {
      step = this.stepQueue.shift();
      assert.ok(step);
    }
    this.state = step.status.kind === "active"
      ? "generating"
      : "terminal-output-ready";
    this.writeResult(step);
    return 0;
  }

  finish() {
    const failure = this.maybeFail("finish");
    if (failure !== null) return failure;
    assert.equal(this.takeOperation(1), this.operationId);
    assert.ok(this.output);
    this.state = "active-idle";
    this.writeResult(this.output);
    return 0;
  }

  release() {
    const failure = this.maybeFail("release");
    if (failure !== null) return failure;
    this.released = true;
    this.pending = null;
    this.committed.clear();
    this.resultLength = 0;
    this.errorLength = 0;
    return 0;
  }
}

class CommandBuilder {
  constructor() {
    this.workerId = id("worker-1");
    this.operationId = id("operation-1");
    this.compositionId = id("composition-1");
    this.conversationId = id("conversation-1");
    this.turnId = id("turn-1");
    this.generationId = id("generation-1");
    this.sequence = 0;
  }

  make(kind, payload = {}, overrides = {}) {
    const sequence = Object.hasOwn(overrides, "sequence")
      ? overrides.sequence
      : this.sequence++;
    return {
      schema: "tinyrustlm.model-runtime-worker/1",
      workerId: this.workerId,
      operationId: this.operationId,
      compositionId: this.compositionId,
      conversationId: this.conversationId,
      turnId: this.turnId,
      generationId: this.generationId,
      messageId: id(`message-${sequence}-${kind}`),
      sequence,
      kind,
      payload,
      ...overrides
    };
  }
}

function initializePayload() {
  const wasm = Uint8Array.from([0, 97, 115, 109, 1, 0, 0, 0]).buffer;
  return {
    wasmBytes: wasm,
    wasmSha256: crypto.createHash("sha256").update(new Uint8Array(wasm)).digest("hex"),
    maximumModelBytes: 1024 * 1024,
    maximumSequenceTokens: 128,
    maximumKvBytes: 1024 * 1024,
    maximumScratchBytes: 1024 * 1024,
    maximumResolvedMemberBytes: 2 * 1024 * 1024,
    maximumResidentDependencyBytes: 1024 * 1024,
    maximumRequestBytes: 1024 * 1024,
    maximumLinearMemoryBytes: 8 * 1024 * 1024,
    transcriptRevisionLow: 0,
    transcriptRevisionHigh: 0
  };
}

function controllerWithFake(api, fake) {
  return new api.ModelRuntimeWorker({
    loadWasm: async (bytes, expectedSha256) => {
      assert.equal(bytes instanceof ArrayBuffer, true);
      const actual = crypto.createHash("sha256")
        .update(new Uint8Array(bytes))
        .digest("hex");
      assert.equal(actual, expectedSha256);
      return { exports: fake.exports };
    }
  });
}

async function initialize(api, fake, builder) {
  const controller = controllerWithFake(api, fake);
  const result = await controller.process(builder.make("initialize", initializePayload()));
  assert.equal(result.terminate, false);
  assert.equal(result.event.kind, "runtime-ready");
  return controller;
}

async function transferArtifact(controller, builder, kind, bytes) {
  let result = await controller.process(builder.make("artifact-begin", {
    artifactKind: kind,
    byteLength: bytes.byteLength
  }));
  assert.equal(result.event.kind, "artifact-transfer-begun");
  result = await controller.process(builder.make("artifact-chunk", {
    artifactKind: kind,
    offset: 0,
    bytes
  }));
  assert.equal(result.event.kind, "artifact-chunk-accepted");
  result = await controller.process(builder.make("artifact-commit", {
    artifactKind: kind
  }));
  assert.equal(result.event.kind, "artifact-transfer-committed");
}

async function stageActivation(controller, builder, fake) {
  await transferArtifact(controller, builder, "model", Uint8Array.from([1, 2, 3, 4]).buffer);
  await transferArtifact(controller, builder, "tokenizer", Uint8Array.from([5, 6]).buffer);
  await transferArtifact(controller, builder, "template", Uint8Array.from([7, 8]).buffer);
  await transferArtifact(controller, builder, "sampling", new ArrayBuffer(65800));
  await transferArtifact(controller, builder, "prompt", new ArrayBuffer(512));
  await transferArtifact(controller, builder, "composition", new ArrayBuffer(896));
  fake.activeCompositionId = builder.compositionId;
  const result = await controller.process(builder.make("activate"));
  assert.equal(result.event.kind, "composition-active");
  return result;
}

test("worker source closes the exact registered command, event, and artifact sets", () => {
  const api = moduleApi();
  const source = fs.readFileSync(workerPath, "utf8");
  assert.deepEqual(Object.keys(api.COMMAND_PAYLOAD_FIELDS),
    profile.workerProtocol.commands.map((entry) => entry.kind));
  for (const command of profile.workerProtocol.commands) {
    assert.deepEqual(api.COMMAND_PAYLOAD_FIELDS[command.kind], command.payloadFields);
  }
  assert.deepEqual(Object.keys(api.EVENT_PAYLOAD_FIELDS),
    profile.workerProtocol.events.map((entry) => entry.kind));
  for (const event of profile.workerProtocol.events) {
    assert.deepEqual(api.EVENT_PAYLOAD_FIELDS[event.kind], event.payloadFields);
  }
  assert.deepEqual(Object.keys(api.ARTIFACT_KINDS),
    profile.workerProtocol.artifactKinds.map((entry) => entry.name));
  for (const artifact of profile.workerProtocol.artifactKinds) {
    assert.equal(api.ARTIFACT_KINDS[artifact.name].code, artifact.transferCode);
  }
  assert.doesNotMatch(source, /\beval\s*\(|\bFunction\s*\(|\bimportScripts\s*\(/u);
  assert.doesNotMatch(source,
    /\bfetch\s*\(|new\s+(?:XMLHttpRequest|WebSocket|EventSource|WebTransport|RTCPeerConnection)\b/u);
});

test("initialize emits a deterministic independently sequenced runtime event", async () => {
  const api = moduleApi();
  const fake = new FakeAbi();
  const builder = new CommandBuilder();
  const command = builder.make("initialize", initializePayload());
  const controller = controllerWithFake(api, fake);
  const result = await controller.process(command);

  assert.equal(result.terminate, false);
  assert.deepEqual(Object.keys(result.event), profile.workerProtocol.commandFields);
  assert.equal(result.event.sequence, 0);
  assert.equal(result.event.kind, "runtime-ready");
  assert.equal(result.event.operationId, builder.operationId);
  assert.equal(result.event.compositionId, builder.compositionId);
  assert.equal(result.event.payload.commandMessageId, command.messageId);
  assert.equal(result.event.payload.state.operationId, builder.operationId);
  assert.match(result.event.messageId, /^[0-9a-f]{64}$/u);
  assert.notEqual(result.event.messageId, command.messageId);
  assert.equal(result.event.messageId, await api.deriveEventMessageId({
    workerId: builder.workerId,
    commandMessageId: command.messageId,
    sequence: 0,
    kind: "runtime-ready"
  }));
});

test("production loader verifies and owns the real import-free WASM module", async () => {
  const api = moduleApi();
  const builder = new CommandBuilder();
  const bytes = Uint8Array.from(buildRealWasm());
  const payload = initializePayload();
  payload.wasmBytes = bytes.buffer;
  payload.wasmSha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  payload.transcriptRevisionLow = 0x89abcdef;
  payload.transcriptRevisionHigh = 0xfedcba98;
  const controller = new api.ModelRuntimeWorker();

  const ready = await controller.process(builder.make("initialize", payload));
  assert.equal(ready.event.kind, "runtime-ready");
  assert.equal(ready.event.payload.state.transcriptRevisionLow, 0x89abcdef);
  assert.equal(ready.event.payload.state.transcriptRevisionHigh, 0xfedcba98);
  assert.equal(Object.hasOwn(ready.event.payload.state, "transcriptRevision"), false);
  assert.equal(bytes.every((value) => value === 0), true);

  const released = await controller.process(builder.make("release"));
  assert.equal(released.event.kind, "runtime-released");
  assert.equal(released.terminate, true);
});

test("streamed chunks are contiguous, bounded, copied once, and wiped", async () => {
  const api = moduleApi();
  const fake = new FakeAbi();
  const builder = new CommandBuilder();
  const controller = await initialize(api, fake, builder);
  const original = Uint8Array.from([11, 22, 33, 44]);
  const buffer = original.buffer;

  await controller.process(builder.make("artifact-begin", {
    artifactKind: "model",
    byteLength: buffer.byteLength
  }));
  const accepted = await controller.process(builder.make("artifact-chunk", {
    artifactKind: "model",
    offset: 0,
    bytes: buffer
  }));
  assert.equal(accepted.event.kind, "artifact-chunk-accepted");
  assert.deepEqual([...new Uint8Array(buffer)], [0, 0, 0, 0]);
  await controller.process(builder.make("artifact-commit", {
    artifactKind: "model"
  }));
  assert.deepEqual([...fake.committed.get(3)], [11, 22, 33, 44]);
});

test("a noncontiguous chunk cancels the raw transfer and emits one bounded rejection", async () => {
  const api = moduleApi();
  const fake = new FakeAbi();
  const builder = new CommandBuilder();
  const controller = await initialize(api, fake, builder);
  await controller.process(builder.make("artifact-begin", {
    artifactKind: "model",
    byteLength: 8
  }));
  const result = await controller.process(builder.make("artifact-chunk", {
    artifactKind: "model",
    offset: 4,
    bytes: new ArrayBuffer(4)
  }));
  assert.equal(result.event.kind, "command-rejected");
  assert.deepEqual(result.event.payload, {
    commandMessageId: id("message-2-artifact-chunk"),
    status: 1,
    code: "model-runtime-worker-chunk-offset",
    workerTerminated: false
  });
  assert.equal(fake.cancelCount, 1);
});

test("a chunk without a live transfer rejects without cancelling nonexistent raw state", async () => {
  const api = moduleApi();
  const fake = new FakeAbi();
  const builder = new CommandBuilder();
  const controller = await initialize(api, fake, builder);
  const result = await controller.process(builder.make("artifact-chunk", {
    artifactKind: "model",
    offset: 0,
    bytes: new ArrayBuffer(4)
  }));
  assert.equal(result.event.kind, "command-rejected");
  assert.equal(result.event.payload.code, "model-runtime-worker-chunk-transfer");
  assert.equal(fake.cancelCount, 0);
});

test("unknown fields, duplicate messages, gaps, and stale identities terminate closed", async () => {
  const api = moduleApi();

  for (const mutation of [
    (command) => { command.extra = true; },
    (command) => { command[Symbol("extra")] = true; },
    (command) => { command.sequence = 2; },
    (command) => { command.workerId = id("stale-worker"); },
    (command) => { command.operationId = id("stale-operation"); },
    (command) => { command.compositionId = id("stale-composition"); }
  ]) {
    const fake = new FakeAbi();
    const builder = new CommandBuilder();
    const controller = await initialize(api, fake, builder);
    const command = builder.make("release");
    mutation(command);
    await assert.rejects(controller.process(command), (error) => {
      assert.equal(error instanceof api.WorkerProtocolError, true);
      assert.equal(error.terminate, true);
      return true;
    });
  }

  const fake = new FakeAbi();
  const builder = new CommandBuilder();
  const controller = await initialize(api, fake, builder);
  const duplicate = builder.make("release");
  duplicate.messageId = id("message-0-initialize");
  await assert.rejects(controller.process(duplicate), /duplicate-message/u);
});

test("any initialization rejection terminates the half-created worker", async () => {
  const api = moduleApi();
  const fake = new FakeAbi();
  const builder = new CommandBuilder();
  const controller = controllerWithFake(api, fake);
  fake.failNext("create", 1, "browser-runtime-policy");
  const result = await controller.process(builder.make("initialize", initializePayload()));
  assert.equal(result.event.kind, "command-rejected");
  assert.deepEqual(result.event.payload, {
    commandMessageId: id("message-0-initialize"),
    status: 1,
    code: "browser-runtime-policy",
    workerTerminated: true
  });
  assert.equal(result.terminate, true);
  await assert.rejects(
    controller.process(builder.make("initialize", initializePayload())),
    /released/u
  );
});

test("activation preserves operation authority and validates composition identity", async () => {
  const api = moduleApi();
  const fake = new FakeAbi();
  const builder = new CommandBuilder();
  const controller = await initialize(api, fake, builder);
  const result = await stageActivation(controller, builder, fake);
  assert.equal(result.event.operationId, builder.operationId);
  assert.equal(result.event.compositionId, builder.compositionId);
  assert.equal(result.event.payload.state.activeComposition.graphIdentitySha256,
    builder.compositionId);

  const nextOperation = id("operation-2");
  const nextComposition = id("composition-2");
  const advanced = await controller.process(builder.make("advance-operation", {
    nextOperationId: nextOperation,
    nextCompositionId: nextComposition
  }));
  assert.equal(advanced.event.kind, "operation-advanced");
  assert.equal(advanced.event.operationId, nextOperation);
  assert.equal(advanced.event.compositionId, builder.compositionId);
  assert.equal(advanced.event.payload.pendingCompositionId, nextComposition);
  builder.operationId = nextOperation;
  builder.compositionId = nextComposition;

  const blocked = await controller.process(builder.make("begin-generation"));
  assert.equal(blocked.event.kind, "command-rejected");
  assert.equal(blocked.event.payload.code, "model-runtime-worker-activation-required");
});

test("active and terminal steps produce one ordered completion with raw repeated text", async () => {
  const api = moduleApi();
  const fake = new FakeAbi();
  const builder = new CommandBuilder();
  const controller = await initialize(api, fake, builder);
  await stageActivation(controller, builder, fake);
  await transferArtifact(controller, builder, "prompt-request", new ArrayBuffer(32));
  const begun = await controller.process(builder.make("begin-generation"));
  assert.equal(begun.event.kind, "generation-begun");

  fake.stepQueue.push({
    schema: "tinyrustlm.browser_runtime_wasm.step/1",
    selectedTokenId: 17,
    emittedTokenId: 17,
    status: { kind: "active", stopTokenId: null },
    committedKvBytes: 8192
  }, {
    schema: "tinyrustlm.browser_runtime_wasm.step/1",
    selectedTokenId: 2,
    emittedTokenId: null,
    status: { kind: "stop-token", stopTokenId: 2 },
    committedKvBytes: 12288
  });
  fake.output = {
    schema: "tinyrustlm.browser_runtime_wasm.output/1",
    text: "echo echo",
    tokenIds: [17, 17],
    status: { kind: "stop-token", stopTokenId: 2 },
    composition: {
      artifactBytes: 896,
      artifactSha256: id("composition-artifact"),
      graphIdentitySha256: builder.compositionId,
      memberTableSha256: id("composition-members")
    },
    operationId: builder.operationId,
    committedKvBytes: 12288
  };

  const active = await controller.process(builder.make("step-generation"));
  assert.equal(active.event.kind, "generation-step");
  assert.equal(active.event.payload.step.status.kind, "active");
  const complete = await controller.process(builder.make("step-generation"));
  assert.equal(complete.event.kind, "generation-complete");
  assert.equal(complete.event.payload.output.text, "echo echo");
  assert.deepEqual(complete.event.payload.output.tokenIds, [17, 17]);

  await assert.rejects(
    controller.process(builder.make("step-generation")),
    /stale-generation/u
  );
});

test("cancellation is a real terminal step and finishes exactly once", async () => {
  const api = moduleApi();
  const fake = new FakeAbi();
  const builder = new CommandBuilder();
  const controller = await initialize(api, fake, builder);
  await stageActivation(controller, builder, fake);
  await transferArtifact(controller, builder, "prompt-request", new ArrayBuffer(16));
  await controller.process(builder.make("begin-generation"));
  fake.output = {
    schema: "tinyrustlm.browser_runtime_wasm.output/1",
    text: "partial",
    tokenIds: [9],
    status: { kind: "cancelled", stopTokenId: null },
    composition: {
      artifactBytes: 896,
      artifactSha256: id("composition-artifact"),
      graphIdentitySha256: builder.compositionId,
      memberTableSha256: id("composition-members")
    },
    operationId: builder.operationId,
    committedKvBytes: 4096
  };
  const result = await controller.process(builder.make("cancel-generation"));
  assert.equal(result.event.kind, "generation-complete");
  assert.equal(result.event.payload.output.status.kind, "cancelled");
  assert.equal(result.event.payload.output.text, "partial");
});

test("internal ABI failure emits one terminal rejection and invalidates the worker", async () => {
  const api = moduleApi();
  const fake = new FakeAbi();
  const builder = new CommandBuilder();
  const controller = await initialize(api, fake, builder);
  fake.failNext("release", 3, "browser-runtime-allocation");
  const result = await controller.process(builder.make("release"));
  assert.equal(result.event.kind, "command-rejected");
  assert.deepEqual(result.event.payload, {
    commandMessageId: id("message-1-release"),
    status: 3,
    code: "browser-runtime-allocation",
    workerTerminated: true
  });
  assert.equal(result.terminate, true);
});

test("release is terminal and network globals lock before worker attachment", async () => {
  const api = moduleApi();
  const fake = new FakeAbi();
  const builder = new CommandBuilder();
  const controller = await initialize(api, fake, builder);
  const released = await controller.process(builder.make("release"));
  assert.equal(released.event.kind, "runtime-released");
  assert.equal(released.terminate, true);
  assert.equal(fake.released, true);
  await assert.rejects(controller.process(builder.make("release")), /released/u);

  const scope = {};
  for (const name of profile.workerProtocol.networkGlobalsDisabledBeforeMessageAcceptance) {
    Object.defineProperty(scope, name, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: () => "network"
    });
  }
  api.lockDownNetwork(scope);
  for (const name of profile.workerProtocol.networkGlobalsDisabledBeforeMessageAcceptance) {
    const descriptor = Object.getOwnPropertyDescriptor(scope, name);
    assert.equal(descriptor.value, undefined);
    assert.equal(descriptor.configurable, false);
    assert.equal(descriptor.writable, false);
  }
});
