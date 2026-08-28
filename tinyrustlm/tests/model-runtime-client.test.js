"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const clientApi = require("../app/model-runtime-client.js");
const promptApi = require("../app/prompt2-request.js");
const workerApi = require("../app/model-runtime-worker.js");

function id(label) {
  return crypto.createHash("sha256").update(label, "utf8").digest("hex");
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
}

function policy() {
  return {
    maximumModelBytes: 1024 * 1024,
    maximumSequenceTokens: 128,
    maximumKvBytes: 1024 * 1024,
    maximumScratchBytes: 1024 * 1024,
    maximumResolvedMemberBytes: 2 * 1024 * 1024,
    maximumResidentDependencyBytes: 1024 * 1024,
    maximumRequestBytes: 1024 * 1024,
    maximumLinearMemoryBytes: 8 * 1024 * 1024
  };
}

function compositionIdentity(command) {
  return {
    artifactBytes: 896,
    artifactSha256: id("composition-artifact"),
    graphIdentitySha256: command.compositionId,
    memberTableSha256: id("composition-members")
  };
}

function runtimeState(command, state, revisionLow = 0, revisionHigh = 0) {
  const active = state !== "empty";
  return {
    schema: "tinyrustlm.browser_runtime_wasm.state/1",
    state,
    operationId: command.operationId,
    transcriptRevisionLow: revisionLow,
    transcriptRevisionHigh: revisionHigh,
    activeComposition: active ? compositionIdentity(command) : null,
    committedKvBytes: active ? 4096 : 0,
    memoryPlan: active ? { modelBytes: 4, kvBytes: 4096, scratchBytes: 2048 } : null,
    observedLinearMemoryBytes: 8 * 1024 * 1024,
    maximumLinearMemoryBytes: 8 * 1024 * 1024
  };
}

class FakeWorker {
  constructor(options = {}) {
    this.options = options;
    this.commands = [];
    this.transfers = [];
    this.eventSequence = 0;
    this.generationStep = 0;
    this.terminated = false;
    this.terminateCount = 0;
    this.onmessage = null;
    this.onerror = null;
    this.onmessageerror = null;
  }

  postMessage(command, transfer) {
    if (this.terminated) {
      throw new Error("worker terminated");
    }
    const cloned = structuredClone(command, { transfer });
    this.commands.push(cloned);
    this.transfers.push(transfer.length);
    queueMicrotask(() => {
      this.respond(cloned).catch(() => {
        if (this.onerror) this.onerror({});
      });
    });
  }

  terminate() {
    this.terminated = true;
    this.terminateCount += 1;
  }

  async respond(command) {
    if (command.kind === "artifact-chunk") {
      new Uint8Array(command.payload.bytes).fill(0);
    }
    const kind = this.eventKind(command);
    const sequence = this.eventSequence;
    this.eventSequence += 1;
    const event = {
      schema: clientApi.PROTOCOL_SCHEMA,
      workerId: command.workerId,
      operationId: command.operationId,
      compositionId: command.compositionId,
      conversationId: command.conversationId,
      turnId: command.turnId,
      generationId: command.generationId,
      messageId: await workerApi.deriveEventMessageId({
        workerId: command.workerId,
        commandMessageId: command.messageId,
        sequence,
        kind
      }),
      sequence,
      kind,
      payload: this.payload(command, kind)
    };
    if (this.options.mutateEvent) {
      this.options.mutateEvent(event, command);
    }
    if (this.onmessage) {
      this.onmessage({ data: event });
    }
  }

  eventKind(command) {
    switch (command.kind) {
      case "initialize": return "runtime-ready";
      case "artifact-begin": return "artifact-transfer-begun";
      case "artifact-chunk": return "artifact-chunk-accepted";
      case "artifact-commit": return "artifact-transfer-committed";
      case "activate": return "composition-active";
      case "advance-operation": return "operation-advanced";
      case "set-transcript": return "transcript-updated";
      case "begin-generation": return "generation-begun";
      case "cancel-generation": return "generation-complete";
      case "release": return "runtime-released";
      case "step-generation": {
        const kind = this.generationStep === 0 ? "generation-step" : "generation-complete";
        this.generationStep += 1;
        return kind;
      }
      default: throw new Error(`unexpected command ${command.kind}`);
    }
  }

  payload(command, kind) {
    const commandMessageId = command.messageId;
    switch (kind) {
      case "runtime-ready":
        return {
          commandMessageId,
          state: runtimeState(
            command,
            "empty",
            command.payload.transcriptRevisionLow,
            command.payload.transcriptRevisionHigh
          )
        };
      case "artifact-transfer-begun":
        return {
          commandMessageId,
          artifactKind: command.payload.artifactKind,
          byteLength: command.payload.byteLength
        };
      case "artifact-chunk-accepted":
        return {
          commandMessageId,
          artifactKind: command.payload.artifactKind,
          offset: command.payload.offset,
          byteLength: command.payload.bytes.byteLength,
          nextOffset: command.payload.offset + command.payload.bytes.byteLength
        };
      case "artifact-transfer-committed": {
        const begin = [...this.commands].reverse().find((entry) =>
          entry.kind === "artifact-begin" &&
          entry.payload.artifactKind === command.payload.artifactKind);
        return {
          commandMessageId,
          artifactKind: command.payload.artifactKind,
          byteLength: begin.payload.byteLength
        };
      }
      case "composition-active":
        return { commandMessageId, state: runtimeState(command, "active-idle") };
      case "operation-advanced": {
        const advancedCommand = {
          ...command,
          operationId: command.payload.nextOperationId
        };
        return {
          commandMessageId,
          state: runtimeState(advancedCommand, "active-idle"),
          pendingCompositionId: command.payload.nextCompositionId === command.compositionId
            ? null
            : command.payload.nextCompositionId
        };
      }
      case "transcript-updated":
        return {
          commandMessageId,
          state: runtimeState(
            command,
            "active-idle",
            command.payload.revisionLow,
            command.payload.revisionHigh
          )
        };
      case "generation-begun":
        return { commandMessageId, state: runtimeState(command, "generating") };
      case "generation-step":
        return {
          commandMessageId,
          step: {
            schema: "tinyrustlm.browser_runtime_wasm.step/1",
            selectedTokenId: 17,
            emittedTokenId: 17,
            status: { kind: "active", stopTokenId: null },
            committedKvBytes: 8192
          }
        };
      case "generation-complete": {
        const cancelled = command.kind === "cancel-generation";
        return {
          commandMessageId,
          output: {
            schema: "tinyrustlm.browser_runtime_wasm.output/1",
            text: cancelled ? "partial" : "echo echo",
            tokenIds: cancelled ? [17] : [17, 17],
            status: {
              kind: cancelled ? "cancelled" : "stop-token",
              stopTokenId: cancelled ? null : 2
            },
            composition: compositionIdentity(command),
            operationId: command.operationId,
            committedKvBytes: 12288
          }
        };
      }
      case "runtime-released": return { commandMessageId };
      default: throw new Error(`unexpected event ${kind}`);
    }
  }
}

function createClient(fake) {
  return new clientApi.ModelRuntimeClient({
    workerUrl: "./model-runtime-worker.js",
    workerFactory: () => fake,
    commandTimeoutMilliseconds: 5000
  });
}

async function initialize(client) {
  const wasmBytes = Uint8Array.from([0, 97, 115, 109, 1, 0, 0, 0]).buffer;
  const identity = sha256(wasmBytes);
  const state = await client.initialize({
    operationId: id("operation"),
    compositionId: id("composition"),
    wasmBytes,
    wasmSha256: identity,
    policy: policy(),
    transcriptRevision: 0x123456789abcdef0n
  });
  assert.equal(wasmBytes.byteLength, 0);
  return state;
}

function activationArtifacts() {
  const lengths = [4, 2, 2, 65800, 512, 896];
  const buffers = lengths.map((length, index) => {
    const bytes = new Uint8Array(length);
    bytes.fill(index + 1);
    return bytes.buffer;
  });
  return {
    buffers,
    artifacts: clientApi.ACTIVATION_ROLES.map((role, index) => ({
      role,
      byteLength: lengths[index],
      chunks: clientApi.oneChunk(buffers[index])
    }))
  };
}

async function activate(client) {
  const source = activationArtifacts();
  const progress = [];
  const state = await client.activate(source.artifacts, (entry) => progress.push(entry));
  assert.equal(source.buffers.every((buffer) => buffer.byteLength === 0), true);
  assert.equal(progress.length, 6);
  return state;
}

function promptRequest() {
  return promptApi.encodeRequest({
    messages: [{ role: "user", content: "Repeat one word twice." }],
    sampling: {
      temperatureMillionths: 0,
      topK: 1,
      topPMillionths: 1000000,
      repetitionPenaltyMillionths: 1000000,
      repetitionWindow: 0,
      maximumNewTokens: 8
    },
    seed: 1n
  });
}

test("top-window client initializes and activates exactly six streamed artifacts", async () => {
  const fake = new FakeWorker();
  const client = createClient(fake);
  const ready = await initialize(client);
  assert.equal(ready.state, "empty");
  assert.equal(ready.transcriptRevisionLow, 0x9abcdef0);
  assert.equal(ready.transcriptRevisionHigh, 0x12345678);
  const active = await activate(client);
  assert.equal(active.state, "active-idle");
  assert.equal(active.activeComposition.graphIdentitySha256, id("composition"));
  assert.deepEqual(fake.commands.map((command) => command.kind), [
    "initialize",
    ...clientApi.ACTIVATION_ROLES.flatMap(() => [
      "artifact-begin", "artifact-chunk", "artifact-commit"
    ]),
    "activate"
  ]);
  assert.equal(fake.transfers.filter((count) => count === 1).length, 7);
  assert.deepEqual(fake.commands.map((command) => command.sequence),
    fake.commands.map((_, index) => index));
  await client.release();
  assert.equal(fake.terminateCount, 1);
});

test("top-window client preserves repeated raw output and completes one generation once", async () => {
  const fake = new FakeWorker();
  const client = createClient(fake);
  await initialize(client);
  await activate(client);
  const request = promptRequest();
  const requestBuffer = request.buffer;
  const steps = [];
  const output = await client.generate({
    conversationId: id("conversation"),
    turnId: id("turn"),
    generationId: id("generation"),
    promptRequest: requestBuffer,
    signal: null,
    onStep: (step) => steps.push(step)
  });
  assert.equal(requestBuffer.byteLength, 0);
  assert.equal(output.text, "echo echo");
  assert.deepEqual(output.tokenIds, [17, 17]);
  assert.equal(steps.length, 1);
  assert.deepEqual(fake.commands.slice(-6).map((command) => command.kind), [
    "artifact-begin",
    "artifact-chunk",
    "artifact-commit",
    "begin-generation",
    "step-generation",
    "step-generation"
  ]);
  await assert.rejects(client.generate({
    conversationId: id("conversation"),
    turnId: id("turn-2"),
    generationId: id("generation"),
    promptRequest: promptRequest().buffer,
    signal: null,
    onStep: null
  }), (error) => error.code === "model-runtime-client-generation-replay");
});

test("top-window client advances operation authority before one transactional model switch", async () => {
  const fake = new FakeWorker({
    mutateEvent(event, command) {
      if (command.kind === "advance-operation") {
        event.operationId = command.payload.nextOperationId;
      }
    }
  });
  const client = createClient(fake);
  await initialize(client);
  await activate(client);
  const nextOperationId = id("next-operation");
  const nextCompositionId = id("next-composition");
  const advanced = await client.advanceOperation({
    operationId: nextOperationId,
    compositionId: nextCompositionId
  });
  assert.equal(advanced.pendingCompositionId, nextCompositionId);
  assert.equal(advanced.state.activeComposition.graphIdentitySha256, id("composition"));
  assert.equal(client.status, "ready");
  assert.equal(client.operationId, nextOperationId);
  assert.equal(client.compositionId, nextCompositionId);
  const switched = await activate(client);
  assert.equal(switched.activeComposition.graphIdentitySha256, nextCompositionId);
  assert.equal(client.status, "active");
  assert.equal(fake.commands.filter((command) => command.kind === "advance-operation").length, 1);
});

test("an already-aborted generation performs one real cancel command and no normal step", async () => {
  const fake = new FakeWorker();
  const client = createClient(fake);
  await initialize(client);
  await activate(client);
  const controller = new AbortController();
  controller.abort();
  const output = await client.generate({
    conversationId: id("cancel-conversation"),
    turnId: id("cancel-turn"),
    generationId: id("cancel-generation"),
    promptRequest: promptRequest().buffer,
    signal: controller.signal,
    onStep: null
  });
  assert.equal(output.status.kind, "cancelled");
  assert.equal(output.text, "partial");
  assert.equal(fake.commands.filter((command) => command.kind === "cancel-generation").length, 1);
  assert.equal(fake.commands.filter((command) => command.kind === "step-generation").length, 0);
});

test("a spoofed event identity terminates the worker and rejects the pending command", async () => {
  const fake = new FakeWorker({
    mutateEvent(event) {
      event.messageId = id("spoofed-event");
    }
  });
  const client = createClient(fake);
  await assert.rejects(initialize(client), (error) =>
    error instanceof clientApi.ModelRuntimeClientError &&
    error.code === "model-runtime-client-event-message-id" &&
    error.terminal === true);
  assert.equal(fake.terminateCount, 1);
  assert.equal(client.status, "terminated");
});

test("an interrupted artifact stream discards the entire worker owner", async () => {
  const fake = new FakeWorker();
  const client = createClient(fake);
  await initialize(client);
  const short = new Uint8Array(3).buffer;
  const source = activationArtifacts();
  source.artifacts[0] = {
    role: "model",
    byteLength: 4,
    chunks: clientApi.oneChunk(short)
  };
  await assert.rejects(client.activate(source.artifacts), (error) =>
    error.code === "model-runtime-client-artifact-short-read");
  assert.equal(fake.terminateCount, 1);
  assert.equal(client.status, "terminated");
});

test("text identities are deterministic, domain-separated, and lowercase SHA-256", async () => {
  const first = await clientApi.identityFromText("conversation", "local-id");
  const replay = await clientApi.identityFromText("conversation", "local-id");
  const other = await clientApi.identityFromText("turn", "local-id");
  assert.equal(first, replay);
  assert.notEqual(first, other);
  assert.match(first, /^[0-9a-f]{64}$/u);
});
