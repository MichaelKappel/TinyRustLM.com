"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const admissionApi = require("../app/browser-model-admission.js");
const installApi = require("../app/companion-composition-install.js");

const sourcePath = path.resolve(__dirname, "../app/companion-composition-install.js");
const CHUNK_BYTES = 4 * 1024 * 1024;
const PROJECTION_SCHEMA = "tinyrustlm.companion.loopback.operation-projection.v2";
const STORE_MANIFEST_SCHEMA = "tinyrustlm.model-composition-store.manifest/2";
const ROLE_ORDER = ["model", "tokenizer", "template", "sampling", "prompt", "composition"];
const COMPANION_ROLE_ORDER = [
  "composition", "model", "tokenizer", "template", "sampling", "prompt"
];

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function id(label) {
  return sha256(Buffer.from(label, "utf8"));
}

function memberBytes(role, byteLength) {
  const value = new Uint8Array(byteLength);
  const ordinal = ROLE_ORDER.indexOf(role) + 1;
  for (let index = 0; index < value.byteLength; index += 1) {
    value[index] = (ordinal * 31 + index * 13) & 0xff;
  }
  return value;
}

function fixture(options = {}) {
  const lengths = {
    model: options.modelByteLength || 37,
    tokenizer: 43,
    template: 31,
    sampling: 65800,
    prompt: 512,
    composition: 896
  };
  const byRole = Object.fromEntries(ROLE_ORDER.map((role) => [
    role,
    memberBytes(role, lengths[role])
  ]));
  const qualificationOperationId = id(
    `qualification-operation-${options.label || "fixture"}`
  );
  const acquisitionOperationId = id(
    `acquisition-operation-${options.label || "fixture"}`
  );
  const artifacts = admissionApi.artifactSpecs.map((spec) => ({
    role: spec.role,
    format: spec.format,
    fileName: spec.fileName,
    byteCount: byRole[spec.role].byteLength,
    sha256: sha256(byRole[spec.role]),
    formatProfileSha256: spec.profileSha256
  }));
  const resolvedMemberBytes = artifacts.slice(0, 5)
    .reduce((total, artifact) => total + artifact.byteCount, 0);
  const residentDependencyBytes = artifacts.slice(1, 5)
    .reduce((total, artifact) => total + artifact.byteCount, 0);
  const admission = {
    schema: admissionApi.schema,
    modelId: "Qwen/Qwen3-0.6B",
    operationId: qualificationOperationId,
    artifacts,
    composition: {
      graphIdentitySha256: id("graph"),
      memberTableSha256: id("member-table"),
      resolvedMemberBytes
    },
    qualification: {
      receiptId: `sha256:${id("qualification")}`,
      sourceEvidenceSha256: id("source"),
      structuralEvidenceSha256: id("structural"),
      numericalEvidenceSha256: id("numerical"),
      qualityEvidenceSha256: id("quality"),
      evalCasesSha256: id("eval-cases"),
      qualityClaim: "general-assistant-qualified",
      qualityScope: "general-assistant"
    },
    runtime: {
      workerProtocol: admissionApi.workerProtocol,
      wasmByteCount: 8,
      wasmSha256: id("wasm"),
      policy: {
        maximumModelBytes: byRole.model.byteLength,
        maximumSequenceTokens: 4096,
        maximumKvBytes: 64 * 1024 * 1024,
        maximumScratchBytes: 32 * 1024 * 1024,
        maximumResolvedMemberBytes: resolvedMemberBytes,
        maximumResidentDependencyBytes: residentDependencyBytes,
        maximumRequestBytes: 1_054_848,
        maximumLinearMemoryBytes: 128 * 1024 * 1024
      },
      defaultSampling: {
        temperatureMillionths: 600_000,
        topK: 20,
        topPMillionths: 950_000,
        repetitionPenaltyMillionths: 1_000_000,
        repetitionWindow: 64,
        maximumNewTokens: 512
      }
    }
  };
  const projectedArtifacts = Object.fromEntries(COMPANION_ROLE_ORDER.map((role) => {
    const artifact = artifacts.find((candidate) => candidate.role === role);
    return [role, {
      kind: artifact.format,
      artifactId: `sha256:${artifact.sha256}`,
      sha256: artifact.sha256,
      byteCount: artifact.byteCount
    }];
  }));
  const totalBytes = artifacts.reduce((total, artifact) => total + artifact.byteCount, 0);
  const admissionText = admissionApi.serializeAdmission(admission);
  const admissionBytes = Buffer.from(admissionText, "utf8");
  const qualificationReceiptText = `${JSON.stringify({
    schema: "tinyrustlm.qualification-receipt/1",
    receiptId: admission.qualification.receiptId
  })}\n`;
  const catalogText = `${JSON.stringify({
    schema: "minimodel.catalog.compositions/1",
    catalog_id: "minimodel.org/companion-fixture",
    revision: 1
  })}\n`;
  const qualificationReceiptBytes = Buffer.from(qualificationReceiptText, "utf8");
  const catalogBytes = Buffer.from(catalogText, "utf8");
  const catalogSha256 = sha256(catalogBytes);
  const catalogAuthority = Object.freeze({
    id: "minimodel.org/companion-fixture",
    revision: 1,
    generatedAtUtc: "2026-08-31T00:00:00Z",
    validUntilUtc: "2026-09-01T00:00:00Z",
    sha256: `sha256:${catalogSha256}`
  });
  const admissionAuthority = Object.freeze({
    admissionText,
    qualificationReceiptText,
    catalogText,
    catalogAuthority,
    p2pPieceSetSha256: null
  });
  const manifest = Object.freeze({
    schema: STORE_MANIFEST_SCHEMA,
    admissionAuthority: Object.freeze({
      admission: Object.freeze({
        byteLength: admissionBytes.byteLength,
        sha256: sha256(admissionBytes)
      }),
      qualificationReceipt: Object.freeze({
        byteLength: qualificationReceiptBytes.byteLength,
        sha256: sha256(qualificationReceiptBytes)
      }),
      catalog: Object.freeze({
        byteLength: catalogBytes.byteLength,
        sha256: catalogSha256
      }),
      p2pPieceSetSha256: null
    }),
    members: Object.freeze(artifacts.map((artifact) => Object.freeze({
      fileName: artifact.fileName,
      byteLength: artifact.byteCount,
      sha256: artifact.sha256
    })))
  });
  return {
    admission,
    admissionAuthority,
    manifest,
    acquisitionOperationId,
    qualificationOperationId,
    byRole,
    projection: {
      schema: PROJECTION_SCHEMA,
      operationId: acquisitionOperationId,
      sequence: 7,
      state: "available",
      route: "source",
      phaseCompletedBytes: totalBytes,
      phaseTotalBytes: totalBytes,
      artifacts: projectedArtifacts,
      errorCode: null
    }
  };
}

function cloneChunk(value) {
  return {
    bytes: value.bytes,
    metadata: { ...value.metadata },
    contentSha256: value.contentSha256
  };
}

class FakeCapabilityClient {
  constructor(value, options = {}) {
    this.value = value;
    this.options = options;
    this.calls = [];
    this.inFlight = 0;
    this.maximumInFlight = 0;
  }

  async getArtifactChunk(operationId, role, chunkIndex, expectedArtifact, signal) {
    this.inFlight += 1;
    this.maximumInFlight = Math.max(this.maximumInFlight, this.inFlight);
    this.calls.push({ operationId, role, chunkIndex, expectedArtifact, signal });
    try {
      if (this.options.stallRole === role) {
        return await new Promise((resolve, reject) => {
          signal.addEventListener("abort", () => {
            reject(new DOMException("cancelled", "AbortError"));
          }, { once: true });
        });
      }
      if (this.options.failRole === role) {
        throw new Error("injected missing chunk");
      }
      const artifact = this.value.projection.artifacts[role];
      const source = this.value.byRole[role];
      const offset = chunkIndex * CHUNK_BYTES;
      if (offset >= source.byteLength) throw new Error("chunk does not exist");
      const bytes = source.subarray(offset, Math.min(source.byteLength, offset + CHUNK_BYTES));
      let response = {
        bytes,
        metadata: {
          operationId,
          artifactRole: role,
          artifactId: artifact.artifactId,
          artifactSha256: artifact.sha256,
          artifactBytes: artifact.byteCount,
          chunkIndex,
          chunkCount: Math.ceil(artifact.byteCount / CHUNK_BYTES),
          chunkOffset: offset,
          chunkBytes: bytes.byteLength
        },
        contentSha256: sha256(bytes)
      };
      if (this.options.mutate) response = this.options.mutate(cloneChunk(response), this.calls.length);
      return Object.freeze({
        bytes: response.bytes,
        metadata: Object.freeze(response.metadata),
        contentSha256: response.contentSha256
      });
    } finally {
      this.inFlight -= 1;
    }
  }
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

class ConsumingStore {
  constructor(options = {}) {
    this.options = options;
    this.calls = [];
    this.maximumChunkBytes = 0;
    this.completedMembers = [];
    this.activated = null;
  }

  async consumeMember(member, source) {
    const hash = crypto.createHash("sha256");
    let byteLength = 0;
    for await (const chunk of source) {
      assert.ok(chunk instanceof Uint8Array);
      this.maximumChunkBytes = Math.max(this.maximumChunkBytes, chunk.byteLength);
      byteLength += chunk.byteLength;
      hash.update(chunk);
    }
    assert.equal(byteLength, member.byteLength, member.fileName);
    assert.equal(hash.digest("hex"), member.sha256, member.fileName);
    this.completedMembers.push(member.fileName);
  }

  async install(value) {
    this.calls.push(value);
    if (this.options.fail) throw new Error("injected store failure");
    const parsedAdmission = admissionApi.parseAdmissionText(
      value.admissionAuthority.admissionText
    );
    assert.equal(
      value.admissionAuthority.admissionText,
      admissionApi.serializeAdmission(parsedAdmission)
    );
    try {
      if (this.options.consumeOutOfOrder) {
        const member = value.manifest.members[1];
        await this.consumeMember(member, value.sources[member.fileName]);
      } else {
        for (const member of value.manifest.members) {
          await this.consumeMember(member, value.sources[member.fileName]);
          if (this.options.reuseFirstSource && member === value.manifest.members[0]) {
            await this.consumeMember(member, value.sources[member.fileName]);
          }
        }
      }
    } catch (error) {
      if (!this.options.doNotWrapSourceError) {
        throw Object.assign(new Error("store source failed"), { cause: error });
      }
      throw error;
    }
    if (this.options.invalidActivation) return Object.freeze({ invalid: true });
    const manifest = deepFreeze(structuredClone(value.manifest));
    const admissionAuthority = deepFreeze({
      admission: parsedAdmission,
      admissionText: value.admissionAuthority.admissionText,
      admissionSha256: `sha256:${manifest.admissionAuthority.admission.sha256}`,
      qualificationReceipt: { fixture: "receipt" },
      qualificationReceiptText: value.admissionAuthority.qualificationReceiptText,
      qualificationReceiptSha256:
        `sha256:${manifest.admissionAuthority.qualificationReceipt.sha256}`,
      catalogDocument: { fixture: "catalog" },
      catalogText: value.admissionAuthority.catalogText,
      catalogAuthority: structuredClone(value.admissionAuthority.catalogAuthority),
      p2pPieceSetSha256: null
    });
    this.activated = Object.freeze({
      manifestSha256: sha256(Buffer.from(`${JSON.stringify(manifest)}\n`, "utf8")),
      admissionAuthoritySha256: sha256(Buffer.from(
        `${JSON.stringify(manifest.admissionAuthority)}\n`,
        "utf8"
      )),
      activationId: id("activation"),
      manifest,
      admissionAuthority,
      streamMember() {
        throw new Error("fixture stream is not opened by this bridge test");
      },
      withRead() {
        throw new Error("fixture read scope is not opened by this bridge test");
      }
    });
    return this.activated;
  }
}

function code(expected, extra) {
  return (error) => {
    assert.ok(error instanceof installApi.CompanionCompositionInstallError);
    assert.equal(error.code, expected);
    if (extra) extra(error);
    return true;
  };
}

async function install(value, client, store, options = {}) {
  return installApi.installCompanionComposition({
    client,
    store,
    projection: value.projection,
    admission: value.admission,
    manifest: value.manifest,
    admissionAuthority: value.admissionAuthority,
    signal: options.signal,
    onProgress: options.onProgress
  });
}

test("is a browser-safe injected bridge with no whole-artifact reader or transport", () => {
  assert.equal(typeof installApi.installCompanionComposition, "function");
  const source = fs.readFileSync(sourcePath, "utf8");
  assert.match(source, /getArtifactChunk\(/u);
  assert.match(source, /store[.]install\(/u);
  assert.doesNotMatch(
    source,
    /[.]arrayBuffer\s*\(|FileReader|Blob\s*\(|fetch\s*\(|XMLHttpRequest|WebSocket|EventSource/u
  );
  assert.match(
    source,
    /qualificationReceiptText[.]length > receiptDescriptor[.]byteLength/u,
    "receipt authority must be bounded before UTF-8 allocation"
  );
  assert.match(
    source,
    /catalogText[.]length > catalogDescriptor[.]byteLength/u,
    "catalog authority must be bounded before UTF-8 allocation"
  );
  assert.doesNotMatch(source, /(?:local|session)Storage|CacheStorage|\bcaches[.]/u);
  assert.doesNotMatch(source, /\bBuffer\b|node:/u);

  const sandbox = {
    TinyRustLMBrowserModelAdmission: {
      schema: admissionApi.schema,
      normalizeAdmission() {},
      serializeAdmission() {}
    }
  };
  vm.runInNewContext(source, sandbox, { filename: "companion-composition-install.js" });
  assert.equal(typeof sandbox.TinyRustLMCompanionCompositionInstall
    .installCompanionComposition, "function");
});

test("accepts distinct acquisition and qualification identities while streaming exactly", async () => {
  const value = fixture({ label: "success", modelByteLength: CHUNK_BYTES + 17 });
  const client = new FakeCapabilityClient(value);
  const store = new ConsumingStore();
  const progress = [];

  const activated = await install(value, client, store, {
    onProgress(event) {
      progress.push(event);
    }
  });

  assert.equal(activated, store.activated);
  assert.notEqual(value.acquisitionOperationId, value.qualificationOperationId);
  assert.equal(value.projection.operationId, value.acquisitionOperationId);
  assert.equal(value.admission.operationId, value.qualificationOperationId);
  assert.equal(Object.isFrozen(activated), true);
  assert.equal(store.calls.length, 1);
  assert.deepEqual(Object.keys(store.calls[0].sources),
    admissionApi.artifactSpecs.map((spec) => spec.fileName));
  assert.equal(store.maximumChunkBytes, CHUNK_BYTES);
  assert.deepEqual(store.completedMembers,
    admissionApi.artifactSpecs.map((spec) => spec.fileName));
  assert.equal(client.maximumInFlight, 1);
  assert.deepEqual(client.calls.map(({ role, chunkIndex }) => [role, chunkIndex]), [
    ["model", 0],
    ["model", 1],
    ["tokenizer", 0],
    ["template", 0],
    ["sampling", 0],
    ["prompt", 0],
    ["composition", 0]
  ]);
  for (const call of client.calls) {
    assert.equal(call.operationId, value.acquisitionOperationId);
    const projected = value.projection.artifacts[call.role];
    assert.deepEqual(call.expectedArtifact, {
      artifactId: projected.artifactId,
      sha256: projected.sha256,
      byteCount: projected.byteCount
    });
  }

  const admissionBytes = Buffer.from(admissionApi.serializeAdmission(value.admission), "utf8");
  assert.equal(
    store.calls[0].admissionAuthority.admissionText,
    admissionApi.serializeAdmission(value.admission)
  );
  assert.equal(
    activated.admissionAuthority.admissionText,
    store.calls[0].admissionAuthority.admissionText
  );
  const manifest = store.calls[0].manifest;
  assert.equal(manifest.schema, STORE_MANIFEST_SCHEMA);
  assert.deepEqual(manifest.admissionAuthority.admission, {
    byteLength: admissionBytes.byteLength,
    sha256: sha256(admissionBytes)
  });
  assert.deepEqual(store.calls[0].admissionAuthority, value.admissionAuthority);
  assert.deepEqual(manifest.members.map((member) => member.fileName),
    admissionApi.artifactSpecs.map((spec) => spec.fileName));

  assert.equal(progress.length, client.calls.length);
  assert.equal(progress.every(Object.isFrozen), true);
  assert.equal(progress.every((event) => !Object.hasOwn(event, "bytes")), true);
  assert.equal(progress.at(-1).completedBytes, progress.at(-1).totalBytes);
  for (let index = 1; index < progress.length; index += 1) {
    assert.ok(progress[index].completedBytes > progress[index - 1].completedBytes);
  }
});

test("requires an available projection with the exact role set", async () => {
  const cases = [
    {
      expected: "companion-composition-install-projection-state",
      mutate(projection) {
      projection.state = "verifying-composition";
      projection.artifacts = null;
    },
    },
    {
      expected: "companion-composition-install-projection-roles",
      mutate(projection) {
        delete projection.artifacts.prompt;
      }
    },
    {
      expected: "companion-composition-install-projection-roles",
      mutate(projection) {
        projection.artifacts.adapter = projection.artifacts.model;
      }
    },
    {
      expected: "companion-composition-install-projection-roles",
      mutate(projection) {
        Object.defineProperty(projection.artifacts, "model", {
          get() {
            return projection.artifacts.tokenizer;
          },
          enumerable: true
        });
      }
    }
  ];
  for (const [index, entry] of cases.entries()) {
    const value = fixture({ label: `role-${index}` });
    entry.mutate(value.projection);
    const client = new FakeCapabilityClient(value);
    const store = new ConsumingStore();
    await assert.rejects(
      install(value, client, store),
      code(entry.expected)
    );
    assert.equal(client.calls.length, 0);
    assert.equal(store.calls.length, 0);
  }
});

test("fails before transfer when any catalog member binding drifts", async () => {
  const mutations = [
    {
      expected: "companion-composition-install-artifact-drift",
      mutate(value) {
        const digest = id("other-model");
        value.projection.artifacts.model.sha256 = digest;
        value.projection.artifacts.model.artifactId = `sha256:${digest}`;
      }
    },
    {
      expected: "companion-composition-install-artifact-drift",
      mutate(value) {
        value.projection.artifacts.tokenizer.byteCount += 1;
      }
    }
  ];
  for (const entry of mutations) {
    const value = fixture({ label: entry.expected });
    entry.mutate(value);
    const client = new FakeCapabilityClient(value);
    const store = new ConsumingStore();
    await assert.rejects(install(value, client, store), code(entry.expected));
    assert.equal(client.calls.length, 0);
    assert.equal(store.calls.length, 0);
  }

  const invalidAdmission = fixture({ label: "invalid-admission" });
  invalidAdmission.admission.schema = "tinyrustlm.browser-composition-admission/0";
  const invalidClient = new FakeCapabilityClient(invalidAdmission);
  const invalidStore = new ConsumingStore();
  await assert.rejects(
    install(invalidAdmission, invalidClient, invalidStore),
    code("companion-composition-install-admission")
  );
  assert.equal(invalidClient.calls.length, 0);
  assert.equal(invalidStore.calls.length, 0);
});

test("rejects out-of-order, duplicate, discontinuous, and truncated chunk metadata", async () => {
  const cases = [
    {
      name: "out-of-order index",
      expected: "companion-composition-install-chunk-continuity",
      mutate(response) {
        response.metadata.chunkIndex = 1;
        return response;
      }
    },
    {
      name: "duplicate prior index",
      expected: "companion-composition-install-chunk-continuity",
      modelByteLength: CHUNK_BYTES + 3,
      mutate(response, callCount) {
        if (callCount === 2) response.metadata.chunkIndex = 0;
        return response;
      }
    },
    {
      name: "wrong count",
      expected: "companion-composition-install-chunk-continuity",
      mutate(response) {
        response.metadata.chunkCount += 1;
        return response;
      }
    },
    {
      name: "offset gap",
      expected: "companion-composition-install-chunk-continuity",
      mutate(response) {
        response.metadata.chunkOffset += 1;
        return response;
      }
    },
    {
      name: "truncated body",
      expected: "companion-composition-install-chunk-continuity",
      mutate(response) {
        response.bytes = response.bytes.subarray(0, response.bytes.byteLength - 1);
        response.contentSha256 = sha256(response.bytes);
        return response;
      }
    },
    {
      name: "artifact substitution",
      expected: "companion-composition-install-chunk-drift",
      mutate(response) {
        response.metadata.artifactId = `sha256:${id("substitute")}`;
        return response;
      }
    },
    {
      name: "content substitution",
      expected: "companion-composition-install-chunk-content",
      mutate(response) {
        response.contentSha256 = id("wrong-content");
        return response;
      }
    }
  ];

  for (const entry of cases) {
    const value = fixture({
      label: entry.name,
      modelByteLength: entry.modelByteLength || 37
    });
    const client = new FakeCapabilityClient(value, { mutate: entry.mutate });
    const store = new ConsumingStore();
    await assert.rejects(
      install(value, client, store),
      code(entry.expected, (error) => assert.equal(error.role, "model")),
      entry.name
    );
    assert.ok(client.calls.length <= 2, entry.name);
    assert.equal(store.activated, null, entry.name);
  }
});

test("a missing chunk fails once without retry or fallback", async () => {
  const value = fixture({ label: "missing" });
  const client = new FakeCapabilityClient(value, { failRole: "model" });
  const store = new ConsumingStore();
  await assert.rejects(
    install(value, client, store),
    code("companion-composition-install-chunk-request")
  );
  assert.equal(client.calls.length, 1);
  assert.equal(store.activated, null);
});

test("cancellation interrupts every preparation and member hash before late settlement", async (t) => {
  for (const ordinal of Array.from({ length: 11 }, (_, index) => index + 1)) {
    for (const lateOutcome of ["resolve", "reject"]) {
      await t.test(`${ordinal}/${lateOutcome}`, async (t) => {
        const value = fixture({ label: `hash-${ordinal}-${lateOutcome}` });
        const client = new FakeCapabilityClient(value);
        const store = new ConsumingStore();
        const controller = new AbortController();
        const entered = Promise.withResolvers();
        const held = Promise.withResolvers();
        const digest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
        let calls = 0;
        let heldInput;
        let observationTimer;
        const progress = [];
        t.mock.method(globalThis.crypto.subtle, "digest", (algorithm, bytes) => {
          calls += 1;
          if (calls !== ordinal) return digest(algorithm, bytes);
          heldInput = { algorithm, bytes };
          entered.resolve();
          return held.promise;
        });
        const pending = install(value, client, store, {
          signal: controller.signal,
          onProgress: (event) => progress.push(event)
        }).then((result) => ({ kind: "resolved", result }),
          (error) => ({ kind: "rejected", error }));
        try {
          await entered.promise;
          controller.abort();
          const observed = await Promise.race([pending, new Promise((resolve) => {
            observationTimer = setTimeout(() => resolve({ kind: "pending" }), 150);
          })]);
          assert.equal(observed.kind, "rejected", "cancellation must not wait for the hash");
          assert.equal(observed.error.code, "companion-composition-install-aborted");
          if (ordinal > 5) {
            assert.equal(observed.error.role, ROLE_ORDER[ordinal - 6]);
            assert.equal(observed.error.chunkIndex, 0);
          }
          if (lateOutcome === "reject") held.reject(new Error("late digest failure"));
          else held.resolve(await digest(heldInput.algorithm, heldInput.bytes));
          await new Promise(setImmediate);
          assert.equal(await pending, observed);
          assert.equal(calls, ordinal);
          assert.equal(store.calls.length, ordinal <= 5 ? 0 : 1);
          assert.equal(client.calls.length, Math.max(0, ordinal - 5));
          assert.equal(store.completedMembers.length, Math.max(0, ordinal - 6));
          assert.equal(progress.length, Math.max(0, ordinal - 6));
          assert.equal(store.activated, null);
        } finally {
          clearTimeout(observationTimer);
          held.reject(new Error("test cleanup"));
          await pending;
        }
      });
    }
  }
});

test("hash failure without cancellation retains its typed error and chunk context", async (t) => {
  for (const ordinal of [1, 6]) {
    await t.test(String(ordinal), async (t) => {
      const value = fixture({ label: `hash-failure-${ordinal}` });
      const client = new FakeCapabilityClient(value);
      const store = new ConsumingStore();
      const digest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
      let calls = 0;
      t.mock.method(globalThis.crypto.subtle, "digest", (algorithm, bytes) => {
        calls += 1;
        return calls === ordinal ? Promise.reject(new Error("hash failed")) : digest(algorithm, bytes);
      });
      await assert.rejects(install(value, client, store), code("companion-composition-install-sha256", error => {
        if (ordinal === 6) {
          assert.equal(error.role, "model");
          assert.equal(error.chunkIndex, 0);
        }
      }));
      assert.equal(calls, ordinal);
      assert.equal(client.calls.length, ordinal === 1 ? 0 : 1);
      assert.equal(store.activated, null);
    });
  }
});

test("synchronous cancellation observes rejected hash, client and progress promises", async (t) => {
  for (const boundary of ["hash", "client", "progress"]) {
    await t.test(boundary, async (t) => {
      const value = fixture({ label: `sync-cancel-${boundary}` });
      const client = new FakeCapabilityClient(value);
      const store = new ConsumingStore();
      const controller = new AbortController();
      // Simulates a capability cancelling synchronously before returning a failed promise.
      const cancelAndReject = () => {
        controller.abort();
        return Promise.reject(new Error(`late ${boundary} failure`));
      };
      if (boundary === "hash") t.mock.method(globalThis.crypto.subtle, "digest", cancelAndReject);
      if (boundary === "client") t.mock.method(client, "getArtifactChunk", cancelAndReject);
      await assert.rejects(install(value, client, store, {
        signal: controller.signal,
        onProgress: boundary === "progress" ? cancelAndReject : undefined
      }), code("companion-composition-install-aborted"));
      await new Promise(setImmediate);
      assert.equal(store.activated, null);
    });
  }
});

test("cancellation after the store commit returns the verified committed composition", async () => {
  const value = fixture({ label: "cancel-after-commit" });
  const client = new FakeCapabilityClient(value);
  const store = new ConsumingStore();
  const controller = new AbortController();
  const committingStore = {
    async install(options) {
      const result = await store.install(options);
      controller.abort();
      return result;
    }
  };
  assert.equal(await install(value, client, committingStore, { signal: controller.signal }), store.activated);
  assert.equal(client.calls.length, 6);
});

test("AbortSignal cancels a stalled chunk source without issuing another request", async () => {
  const value = fixture({ label: "cancel" });
  const client = new FakeCapabilityClient(value, { stallRole: "model" });
  const store = new ConsumingStore();
  const controller = new AbortController();
  const promise = install(value, client, store, { signal: controller.signal });
  while (client.calls.length === 0) await new Promise((resolve) => setImmediate(resolve));
  controller.abort();

  await assert.rejects(promise, code("companion-composition-install-aborted"));
  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0].signal, controller.signal);
  assert.equal(client.calls[0].signal.aborted, true);
  assert.equal(store.activated, null);
});

test("sources are one-shot and enforce canonical nonconcurrent role order", async () => {
  const reused = fixture({ label: "reuse" });
  const reusedClient = new FakeCapabilityClient(reused);
  await assert.rejects(
    install(reused, reusedClient, new ConsumingStore({ reuseFirstSource: true })),
    code("companion-composition-install-source-reused")
  );
  assert.equal(reusedClient.calls.length, 1);

  const reordered = fixture({ label: "source-order" });
  const reorderedClient = new FakeCapabilityClient(reordered);
  await assert.rejects(
    install(
      reordered,
      reorderedClient,
      new ConsumingStore({ consumeOutOfOrder: true })
    ),
    code("companion-composition-install-source-order")
  );
  assert.equal(reorderedClient.calls.length, 0);
});

test("the companion boundary rejects an opened composition without a callable read scope", async () => {
  for (const withRead of [undefined, null]) {
    const value = fixture({ label: `missing-read-scope-${withRead}` });
    const store = new ConsumingStore();
    const consume = store.install.bind(store);
    store.install = async input => {
      const result = { ...await consume(input), withRead };
      if (withRead === undefined) delete result.withRead;
      return result;
    };
    await assert.rejects(install(value, new FakeCapabilityClient(value), store),
      code("companion-composition-install-activation"));
  }
});

test("progress and store failures fail closed without an activation result", async () => {
  const progressValue = fixture({ label: "progress-failure" });
  const progressClient = new FakeCapabilityClient(progressValue);
  await assert.rejects(
    install(progressValue, progressClient, new ConsumingStore(), {
      onProgress() {
        throw new Error("injected progress failure");
      }
    }),
    code("companion-composition-install-progress")
  );
  assert.equal(progressClient.calls.length, 1);

  const storeValue = fixture({ label: "store-failure" });
  const storeClient = new FakeCapabilityClient(storeValue);
  await assert.rejects(
    install(storeValue, storeClient, new ConsumingStore({ fail: true })),
    code("companion-composition-install-store")
  );
  assert.equal(storeClient.calls.length, 0);

  const activationValue = fixture({ label: "activation-failure" });
  await assert.rejects(
    install(
      activationValue,
      new FakeCapabilityClient(activationValue),
      new ConsumingStore({ invalidActivation: true })
    ),
    code("companion-composition-install-activation")
  );
});
