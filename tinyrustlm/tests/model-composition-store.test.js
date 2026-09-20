"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { locks } = require("node:worker_threads");

const admissionApi = require("../app/browser-model-admission.js");
const catalogApi = require("../app/minimodel-catalog-v1.js");
const storeApi = require("../app/model-composition-store.js");

const sourcePath = path.resolve(__dirname, "../app/model-composition-store.js");
const MANIFEST_SCHEMA = "tinyrustlm.model-composition-store.manifest/2";
const POINTER_SCHEMA = "tinyrustlm.model-composition-store.active-pointer/2";
const STAGING_SCHEMA = "tinyrustlm.model-composition-store.staging/2";
const TEST_NOW = new Date(Math.floor(Date.now() / 1000) * 1000);
const utc = (offsetMilliseconds) =>
  new Date(TEST_NOW.getTime() + offsetMilliseconds).toISOString().replace(".000Z", "Z");
const MEMBER_NAMES = [
  "model.slm2",
  "tokenizer.tokenizer2",
  "template.template2",
  "sampling.sampling2",
  "prompt.prompt2",
  "composition.acg2"
];

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function contentId(value) {
  return `sha256:${sha256(Buffer.from(value, "utf8"))}`;
}

function bytes(label, length) {
  const value = new Uint8Array(length);
  const seed = Buffer.from(label, "utf8");
  for (let index = 0; index < value.length; index += 1) {
    value[index] = (seed[index % seed.length] + index * 17) & 0xff;
  }
  return value;
}

function fixture(label, modelByteLength = 31) {
  const lengths = [modelByteLength, 23, 19, 65800, 512, 896];
  const members = Object.fromEntries(MEMBER_NAMES.map((fileName, index) => [
    fileName,
    bytes(`${label}-${fileName}`, lengths[index])
  ]));
  const artifacts = admissionApi.artifactSpecs.map((spec) => ({
    role: spec.role,
    format: spec.format,
    fileName: spec.fileName,
    byteCount: members[spec.fileName].byteLength,
    sha256: sha256(members[spec.fileName]),
    formatProfileSha256: spec.profileSha256
  }));
  const resolvedMemberBytes = artifacts.slice(0, 5)
    .reduce((total, artifact) => total + artifact.byteCount, 0);
  const residentDependencyBytes = artifacts.slice(1, 5)
    .reduce((total, artifact) => total + artifact.byteCount, 0);
  const admission = {
    schema: admissionApi.schema,
    modelId: "Qwen/Qwen3-0.6B",
    operationId: sha256(Buffer.from(`qualification-${label}`, "utf8")),
    artifacts,
    composition: {
      graphIdentitySha256: sha256(Buffer.from(`graph-${label}`, "utf8")),
      memberTableSha256: sha256(Buffer.from(`member-table-${label}`, "utf8")),
      resolvedMemberBytes
    },
    qualification: {
      receiptId: `sha256:${sha256(Buffer.from(`receipt-${label}`, "utf8"))}`,
      sourceEvidenceSha256: sha256(Buffer.from(`source-${label}`, "utf8")),
      structuralEvidenceSha256: sha256(Buffer.from(`structural-${label}`, "utf8")),
      numericalEvidenceSha256: sha256(Buffer.from(`numerical-${label}`, "utf8")),
      qualityEvidenceSha256: sha256(Buffer.from(`quality-${label}`, "utf8")),
      evalCasesSha256: sha256(Buffer.from(`eval-${label}`, "utf8")),
      qualityClaim: "general-assistant-qualified",
      qualityScope: "general-assistant"
    },
    runtime: {
      workerProtocol: admissionApi.workerProtocol,
      wasmByteCount: 8,
      wasmSha256: sha256(Buffer.from(`wasm-${label}`, "utf8")),
      policy: {
        maximumModelBytes: modelByteLength,
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
  const admissionText = admissionApi.serializeAdmission(admission);
  const admissionBytes = Buffer.from(admissionText, "utf8");
  const qualificationReceipt = {
    schema: catalogApi.QUALIFICATION_RECEIPT_SCHEMA,
    receiptId: admission.qualification.receiptId,
    modelId: admission.modelId,
    operationId: admission.operationId,
    compositionId: `sha256:${admission.composition.graphIdentitySha256}`,
    sourceEvidenceSha256: admission.qualification.sourceEvidenceSha256,
    structuralEvidenceSha256: admission.qualification.structuralEvidenceSha256,
    numericalEvidenceSha256: admission.qualification.numericalEvidenceSha256,
    qualityEvidenceSha256: admission.qualification.qualityEvidenceSha256,
    evalCasesSha256: admission.qualification.evalCasesSha256,
    qualityClaim: admission.qualification.qualityClaim,
    qualityScope: admission.qualification.qualityScope,
    numericalStatus: "passed",
    browserStatus: "passed",
    qualityStatus: "qualified",
    issuedAtUtc: utc(-2 * 60 * 1000)
  };
  const qualificationReceiptText = `${JSON.stringify(qualificationReceipt)}\n`;
  const qualificationReceiptBytes = Buffer.from(qualificationReceiptText, "utf8");
  const catalog = {
    schema: catalogApi.CATALOG_SCHEMA,
    catalog_id: "minimodel.org/prelaunch",
    revision: 7,
    generated_at_utc: utc(-60 * 1000),
    valid_until_utc: utc(60 * 60 * 1000),
    project_server_serves_model_bytes: false,
    project_server_proxies_model_bytes: false,
    project_server_runs_inference: false,
    qualification_policy: "exact-current-evidence-required",
    qualification_receipt_schema: catalogApi.QUALIFICATION_RECEIPT_SCHEMA,
    browser_admission_schema: catalogApi.BROWSER_ADMISSION_SCHEMA,
    peer_verification_keys: [{
      key_id: contentId(`catalog-key-${label}`),
      algorithm: "Ed25519",
      public_key_base64url: Buffer.alloc(32, 7).toString("base64url"),
      not_before_utc: utc(-60 * 60 * 1000),
      not_after_utc: utc(2 * 60 * 60 * 1000)
    }],
    revoked_qualification_receipt_ids: [],
    supersessions: [],
    entries: [{
      entry_id: `qwen/${label}`,
      display_name: "Qwen3 0.6B",
      description: "One exact qualified six-member SLM2 composition.",
      source: {
        repository: admission.modelId,
        revision: sha256(Buffer.from(`revision-${label}`, "utf8")).slice(0, 40),
        source_lock_sha256: contentId(`source-lock-${label}`)
      },
      license: {
        route: `/licenses/${label}.txt`,
        review_status: "reviewed"
      },
      composition: {
        composition_id: `sha256:${admission.composition.graphIdentitySha256}`,
        member_count: MEMBER_NAMES.length,
        members: MEMBER_NAMES.map((fileName, index) => ({
          name: fileName,
          bytes: members[fileName].byteLength,
          sha256: `sha256:${sha256(members[fileName])}`,
          schema: `tinyrustlm.member.${index + 1}.v1`
        }))
      },
      browser_admission: {
        route: `/catalog/browser-admissions/${label}.json`,
        bytes: admissionBytes.byteLength,
        sha256: `sha256:${sha256(admissionBytes)}`
      },
      profiles: {
        conversion: "tinyrustlm.converter.v1",
        quantization: "tinyrustlm.mixed-q8.v1",
        runtime: "tinyrustlm.browser.v1"
      },
      qualification: {
        status: "qualified",
        receipt_id: qualificationReceipt.receiptId,
        receipt_route: `/catalog/qualification-receipts/${label}.json`,
        receipt_bytes: qualificationReceiptBytes.byteLength,
        receipt_sha256: `sha256:${sha256(qualificationReceiptBytes)}`,
        numerical_status: "passed",
        browser_status: "passed",
        quality_status: "qualified"
      },
      peer_announcement_ids: [`peer/${label}`]
    }]
  };
  const catalogText = `${JSON.stringify(catalog)}\n`;
  const catalogBytes = Buffer.from(catalogText, "utf8");
  const p2pPieceSetSha256 = contentId(`piece-set-${label}`);
  const catalogAuthority = {
    id: catalog.catalog_id,
    revision: catalog.revision,
    generatedAtUtc: catalog.generated_at_utc,
    validUntilUtc: catalog.valid_until_utc,
    sha256: `sha256:${sha256(catalogBytes)}`
  };
  return {
    admission,
    admissionText,
    qualificationReceipt,
    qualificationReceiptText,
    catalog,
    catalogText,
    catalogAuthority,
    p2pPieceSetSha256,
    admissionAuthority: {
      admissionText,
      qualificationReceiptText,
      catalogText,
      catalogAuthority,
      p2pPieceSetSha256
    },
    members,
    manifest: {
      schema: MANIFEST_SCHEMA,
      admissionAuthority: {
        admission: {
          byteLength: admissionBytes.byteLength,
          sha256: sha256(admissionBytes)
        },
        qualificationReceipt: {
          byteLength: qualificationReceiptBytes.byteLength,
          sha256: sha256(qualificationReceiptBytes)
        },
        catalog: {
          byteLength: catalogBytes.byteLength,
          sha256: sha256(catalogBytes)
        },
        p2pPieceSetSha256
      },
      members: MEMBER_NAMES.map((fileName) => ({
        fileName,
        byteLength: members[fileName].byteLength,
        sha256: sha256(members[fileName])
      }))
    }
  };
}

function sourceSet(memberBytes, observations = null) {
  return Object.fromEntries(MEMBER_NAMES.map((fileName) => [
    fileName,
    {
      async *[Symbol.asyncIterator]() {
        if (observations) observations.set(fileName, (observations.get(fileName) || 0) + 1);
        yield memberBytes[fileName];
      }
    }
  ]));
}

function canonical(value) {
  return new TextEncoder().encode(`${JSON.stringify(value)}\n`);
}

function key(pathParts) {
  return pathParts.join("/");
}

function parentKeys(pathParts) {
  const values = [""];
  for (let index = 1; index <= pathParts.length; index += 1) {
    values.push(key(pathParts.slice(0, index)));
  }
  return values;
}

class MemoryAdapter {
  constructor(options = {}) {
    this.directories = new Set([""]);
    this.files = new Map();
    this.operations = [];
    this.maximumWriteBytes = 0;
    this.writeCount = new Map();
    this.randomCounter = 0;
    this.readChunkBytes = options.readChunkBytes || Number.MAX_SAFE_INTEGER;
    this.onWrite = options.onWrite || null;
    this.onClose = options.onClose || null;
    this.onAbort = options.onAbort || null;
    this.onBeforeActiveWrite = options.onBeforeActiveWrite || null;
    this.onAfterActiveWrite = options.onAfterActiveWrite || null;
    this.onAfterLockCallback = options.onAfterLockCallback || null;
    this.failNextActiveWrite = false;
    this.failNextLock = false;
    this.lockTail = Promise.resolve();
  }

  async withExclusiveLock(callback) {
    if (this.failNextLock) {
      this.failNextLock = false;
      throw new Error("injected lock failure");
    }
    const prior = this.lockTail;
    let release;
    this.lockTail = new Promise((resolve) => {
      release = resolve;
    });
    await prior;
    this.operations.push({ type: "lock" });
    try {
      const result = await callback();
      if (this.onAfterLockCallback) await this.onAfterLockCallback();
      return result;
    } finally {
      release();
    }
  }

  createSha256() {
    const hash = crypto.createHash("sha256");
    let complete = false;
    return {
      update(value) {
        assert.equal(complete, false);
        hash.update(value);
      },
      digest() {
        assert.equal(complete, false);
        complete = true;
        return hash.digest("hex");
      }
    };
  }

  randomBytes(length) {
    this.randomCounter += 1;
    return new Uint8Array(crypto.createHash("sha256")
      .update(`staging-${this.randomCounter}`)
      .digest().subarray(0, length));
  }

  async ensureDirectory(pathParts) {
    for (const directory of parentKeys(pathParts)) this.directories.add(directory);
    this.operations.push({ type: "ensure-directory", path: key(pathParts) });
  }

  // Exercise real shared/exclusive scheduling without coupling it to the store's writer lock.
  withCompositionLock(identity, mode, callback, signal) {
    this.compositionLockPrefix ||= crypto.randomUUID();
    return locks.request(`${this.compositionLockPrefix}:${identity}`, { mode, ...(signal ? { signal } : {}) }, callback);
  }

  async listEntries(pathParts, limit) {
    const parent = key(pathParts);
    if (!this.directories.has(parent)) return [];
    const prefix = parent ? `${parent}/` : "";
    const children = new Map();
    for (const directory of this.directories) {
      if (!directory.startsWith(prefix) || directory === parent) continue;
      const rest = directory.slice(prefix.length);
      if (rest && !rest.includes("/")) children.set(rest, "directory");
    }
    for (const file of this.files.keys()) {
      if (!file.startsWith(prefix)) continue;
      const rest = file.slice(prefix.length);
      if (rest && !rest.includes("/")) children.set(rest, "file");
    }
    const entries = [...children]
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, limit)
      .map(([name, kind]) => ({ name, kind }));
    this.operations.push({ type: "list", path: parent, limit, count: entries.length });
    return entries;
  }

  async removeEntry(pathParts, options = {}) {
    const target = key(pathParts);
    const prefix = `${target}/`;
    const exists = this.files.has(target) || this.directories.has(target) ||
      [...this.files.keys()].some((name) => name.startsWith(prefix)) ||
      [...this.directories].some((name) => name.startsWith(prefix));
    if (!exists) {
      if (options.missingOk) return;
      throw Object.assign(new Error("missing"), { name: "NotFoundError" });
    }
    if (!options.recursive && this.directories.has(target) &&
        ([...this.files.keys()].some((name) => name.startsWith(prefix)) ||
         [...this.directories].some((name) => name.startsWith(prefix)))) {
      throw new Error("directory is not empty");
    }
    this.files.delete(target);
    for (const name of [...this.files.keys()]) {
      if (name.startsWith(prefix)) this.files.delete(name);
    }
    for (const name of [...this.directories]) {
      if (name === target || name.startsWith(prefix)) this.directories.delete(name);
    }
    this.operations.push({ type: "remove", path: target, recursive: Boolean(options.recursive) });
  }

  async openReadable(pathParts) {
    const fileKey = key(pathParts);
    const chunks = this.files.get(fileKey);
    this.operations.push({ type: "open-readable", path: fileKey, found: Boolean(chunks) });
    if (!chunks) return null;
    const byteLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
    const readChunkBytes = this.readChunkBytes;
    return {
      byteLength,
      stream: {
        async *[Symbol.asyncIterator]() {
          for (const stored of chunks) {
            for (let offset = 0; offset < stored.byteLength; offset += readChunkBytes) {
              yield stored.subarray(offset, Math.min(stored.byteLength, offset + readChunkBytes));
            }
          }
        }
      }
    };
  }

  async openWritable(pathParts) {
    const fileKey = key(pathParts);
    const chunks = [];
    let terminal = false;
    this.operations.push({ type: "open-writable", path: fileKey });
    return {
      write: async (value) => {
        assert.equal(terminal, false);
        assert.ok(value instanceof Uint8Array);
        this.maximumWriteBytes = Math.max(this.maximumWriteBytes, value.byteLength);
        this.writeCount.set(fileKey, (this.writeCount.get(fileKey) || 0) + 1);
        this.operations.push({ type: "write", path: fileKey, byteLength: value.byteLength });
        chunks.push(Uint8Array.from(value));
        if (this.onWrite) await this.onWrite({ path: fileKey, byteLength: value.byteLength });
      },
      close: async () => {
        assert.equal(terminal, false);
        if (this.onClose) await this.onClose({ path: fileKey });
        terminal = true;
        for (const directory of parentKeys(pathParts.slice(0, -1))) {
          this.directories.add(directory);
        }
        this.files.set(fileKey, chunks);
        this.operations.push({ type: "close", path: fileKey });
      },
      abort: async () => {
        if (!terminal) terminal = true;
        this.operations.push({ type: "abort", path: fileKey });
        if (this.onAbort) await this.onAbort({ path: fileKey });
      }
    };
  }

  async atomicWrite(pathParts, value) {
    const fileKey = key(pathParts);
    this.operations.push({ type: "atomic-write", path: fileKey, byteLength: value.byteLength });
    if (fileKey === "active.json" && this.failNextActiveWrite) {
      this.failNextActiveWrite = false;
      throw new Error("injected active pointer failure");
    }
    if (fileKey === "active.json" && this.onBeforeActiveWrite) {
      await this.onBeforeActiveWrite();
    }
    for (const directory of parentKeys(pathParts.slice(0, -1))) {
      this.directories.add(directory);
    }
    this.files.set(fileKey, [Uint8Array.from(value)]);
    if (fileKey === "active.json" && this.onAfterActiveWrite) {
      await this.onAfterActiveWrite();
    }
  }

  seedFile(pathParts, value) {
    for (const directory of parentKeys(pathParts.slice(0, -1))) {
      this.directories.add(directory);
    }
    this.files.set(key(pathParts), [Uint8Array.from(value)]);
  }

  readFile(pathParts) {
    const chunks = this.files.get(key(pathParts));
    if (!chunks) return null;
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  }

  mutate(pathParts, offset = 0) {
    const chunks = this.files.get(key(pathParts));
    assert.ok(chunks);
    let remaining = offset;
    for (const chunk of chunks) {
      if (remaining < chunk.byteLength) {
        chunk[remaining] ^= 0xff;
        return;
      }
      remaining -= chunk.byteLength;
    }
    assert.fail("mutation offset exceeded file length");
  }

  hasPath(pathParts) {
    const target = key(pathParts);
    return this.files.has(target) || this.directories.has(target);
  }

  entriesUnder(pathParts) {
    const target = key(pathParts);
    const prefix = target ? `${target}/` : "";
    return [...this.files.keys()]
      .filter((name) => name.startsWith(prefix) && !name.slice(prefix.length).includes("/"))
      .map((name) => name.slice(prefix.length))
      .sort();
  }
}

function createRawStore(adapter, options = {}) {
  return storeApi.createModelCompositionStore({
    adapter,
    chunkBytes: options.chunkBytes || 4096,
    maximumCompositionBytes: options.maximumCompositionBytes || 1024 * 1024,
    maximumStagingEntries: options.maximumStagingEntries || 8,
    cleanupLimit: options.cleanupLimit || 8
  });
}

function createStore(adapter, options = {}) {
  const store = createRawStore(adapter, options);
  return Object.freeze({
    ...store,
    install(value) {
      const withActivation = Object.hasOwn(value, "activate")
        ? value
        : { ...value, activate: async () => true };
      const call = Object.hasOwn(withActivation, "authorizeCommit")
        ? withActivation
        : { ...withActivation, authorizeCommit: async () => true };
      return store.install(call);
    }
  });
}

function errorCode(code) {
  return (error) => {
    assert.ok(error instanceof storeApi.ModelCompositionStoreError);
    assert.equal(error.code, code);
    return true;
  };
}

async function collect(iterable) {
  const chunks = [];
  for await (const chunk of iterable) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function settleWithin(promise, milliseconds = 500) {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((_, rejectPromise) => {
        timeout = setTimeout(() => {
          rejectPromise(new Error(`operation did not settle within ${milliseconds}ms`));
        }, milliseconds);
      })
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

test("exports the exact six-member worker-safe OPFS boundary", () => {
  assert.equal(storeApi.manifestSchema, MANIFEST_SCHEMA);
  assert.equal(storeApi.qualificationReceiptSchema, catalogApi.QUALIFICATION_RECEIPT_SCHEMA);
  assert.equal(storeApi.catalogSchema, catalogApi.CATALOG_SCHEMA);
  assert.deepEqual(storeApi.memberNames, MEMBER_NAMES);
  assert.equal(storeApi.maximumChunkBytes, 4 * 1024 * 1024);
  assert.equal(storeApi.maximumQualificationReceiptBytes, 128 * 1024);
  assert.equal(storeApi.maximumCatalogBytes, 1024 * 1024);

  const source = fs.readFileSync(sourcePath, "utf8");
  assert.match(source, /getDirectory\(\)/u);
  assert.match(source, /createWritable\(/u);
  assert.doesNotMatch(
    source,
    /(?:local|session)Storage|CacheStorage|\bcaches[.]|indexedDB|fetch\s*\(|XMLHttpRequest|WebSocket|EventSource/u
  );
  assert.doesNotMatch(source, /node:/u);
  assert.doesNotMatch(source, /[.]arrayBuffer\s*\(/u);
  assert.match(
    source,
    /value[.]length > maximumBytes \|\| value[.]length > descriptor[.]byteLength/u,
    "authority strings must be length-bounded before UTF-8 allocation"
  );

  const sandbox = {
    TinyRustLMBrowserModelAdmission: admissionApi,
    TinyRustLMMiniModelCatalogV1: catalogApi
  };
  vm.runInNewContext(source, sandbox, { filename: "model-composition-store.js" });
  assert.equal(typeof sandbox.TinyRustLMModelCompositionStore.createModelCompositionStore,
    "function");
});

test("streams bounded chunks, reverifies storage, then atomically activates", async () => {
  const adapter = new MemoryAdapter({ readChunkBytes: 64 });
  const store = createStore(adapter, { chunkBytes: 7 });
  const value = fixture("bounded");
  const sourceReads = new Map();
  let activatedCandidate = null;
  let activationContext = null;

  const installed = await store.install({
    manifest: value.manifest,
    admissionAuthority: value.admissionAuthority,
    sources: sourceSet(value.members, sourceReads),
    async activate(candidate, context) {
      adapter.operations.push({ type: "activation-callback" });
      assert.equal(adapter.hasPath(["active.json"]), false);
      assert.deepEqual(
        await collect(candidate.streamMember("model.slm2")),
        Buffer.from(value.members["model.slm2"])
      );
      activatedCandidate = candidate;
      activationContext = context;
      return true;
    }
  });

  assert.strictEqual(installed, activatedCandidate);
  assert.equal(activationContext.previousComposition, null);
  assert.equal(activationContext.signal, null);
  assert.match(installed.manifestSha256, /^[0-9a-f]{64}$/u);
  assert.equal(
    installed.admissionAuthoritySha256,
    sha256(canonical(value.manifest.admissionAuthority))
  );
  assert.equal(installed.admissionAuthority.admissionText, value.admissionText);
  assert.equal(
    installed.admissionAuthority.admissionSha256,
    `sha256:${value.manifest.admissionAuthority.admission.sha256}`
  );
  assert.equal(
    installed.admissionAuthority.qualificationReceiptText,
    value.qualificationReceiptText
  );
  assert.equal(
    installed.admissionAuthority.qualificationReceiptSha256,
    `sha256:${value.manifest.admissionAuthority.qualificationReceipt.sha256}`
  );
  assert.equal(installed.admissionAuthority.catalogText, value.catalogText);
  assert.deepEqual(installed.admissionAuthority.catalogAuthority, value.catalogAuthority);
  assert.equal(installed.admissionAuthority.p2pPieceSetSha256, value.p2pPieceSetSha256);
  assert.ok(Object.isFrozen(installed.admissionAuthority));
  assert.ok(Object.isFrozen(installed.admissionAuthority.admission));
  assert.ok(Object.isFrozen(installed.admissionAuthority.qualificationReceipt));
  assert.ok(Object.isFrozen(installed.admissionAuthority.catalogDocument));
  assert.ok(Object.isFrozen(installed.admissionAuthority.catalogAuthority));
  assert.match(installed.activationId, /^[0-9a-f]{64}$/u);
  assert.equal(adapter.maximumWriteBytes, 7);
  assert.deepEqual([...sourceReads.values()], [1, 1, 1, 1, 1, 1]);

  const directory = ["installed", installed.manifestSha256];
  assert.deepEqual(
    adapter.entriesUnder(directory),
    [
      ...MEMBER_NAMES,
      "admission.json",
      "catalog.json",
      "manifest.json",
      "qualification-receipt.json"
    ].sort()
  );
  assert.equal(adapter.readFile([...directory, "admission.json"]).toString("utf8"),
    value.admissionText);
  assert.equal(
    adapter.readFile([...directory, "qualification-receipt.json"]).toString("utf8"),
    value.qualificationReceiptText
  );
  assert.equal(adapter.readFile([...directory, "catalog.json"]).toString("utf8"),
    value.catalogText);
  const pointer = JSON.parse(adapter.readFile(["active.json"]).toString("utf8"));
  assert.deepEqual(pointer, {
    schema: POINTER_SCHEMA,
    stagingId: installed.activationId,
    manifestSha256: installed.manifestSha256,
    admissionAuthoritySha256: installed.admissionAuthoritySha256
  });

  const activationIndex = adapter.operations.findIndex(
    (operation) => operation.type === "atomic-write" && operation.path === "active.json"
  );
  const callbackIndex = adapter.operations.findIndex(
    (operation) => operation.type === "activation-callback"
  );
  assert.ok(activationIndex > 0);
  assert.ok(callbackIndex > 0 && callbackIndex < activationIndex);
  for (const fileName of ["admission.json", "qualification-receipt.json", "catalog.json"]) {
    const authorityVerifyIndex = adapter.operations.findLastIndex(
      (operation) => operation.type === "open-readable" &&
        operation.path === `installed/${installed.manifestSha256}/${fileName}` &&
        operation.found
    );
    assert.ok(authorityVerifyIndex >= 0 && authorityVerifyIndex < activationIndex, fileName);
  }
  for (const fileName of MEMBER_NAMES) {
    const verifies = adapter.operations
      .map((operation, index) => ({ operation, index }))
      .filter(({ operation }) => operation.type === "open-readable" &&
        operation.path === `installed/${installed.manifestSha256}/${fileName}` &&
        operation.found);
    assert.ok(verifies.length >= 1, fileName);
    assert.ok(verifies.at(-1).index < activationIndex, fileName);
  }
  assert.equal(adapter.entriesUnder(["staging"]).length, 0);

  for (const fileName of MEMBER_NAMES) {
    const chunks = [];
    for await (const chunk of installed.streamMember(fileName)) {
      assert.ok(chunk.byteLength <= 7);
      chunks.push(Buffer.from(chunk));
    }
    assert.deepEqual(Buffer.concat(chunks), Buffer.from(value.members[fileName]));
  }
});

test("activation rejection preserves the prior pointer and prior bytes", async () => {
  const adapter = new MemoryAdapter({ readChunkBytes: 11 });
  const store = createStore(adapter, { chunkBytes: 13 });
  const prior = fixture("activation-rejection-prior");
  const installedPrior = await store.install({
    manifest: prior.manifest,
    admissionAuthority: prior.admissionAuthority,
    sources: sourceSet(prior.members)
  });
  const pointerBefore = adapter.readFile(["active.json"]);
  const candidate = fixture("activation-rejection-candidate");
  const candidateSha256 = sha256(canonical(candidate.manifest));

  await assert.rejects(
    store.install({
      manifest: candidate.manifest,
      admissionAuthority: candidate.admissionAuthority,
      sources: sourceSet(candidate.members),
      async activate(storedCandidate, context) {
        assert.equal(storedCandidate.manifestSha256, candidateSha256);
        assert.equal(context.previousComposition.manifestSha256,
          installedPrior.manifestSha256);
        assert.deepEqual(
          await collect(storedCandidate.streamMember("template.template2")),
          Buffer.from(candidate.members["template.template2"])
        );
        assert.deepEqual(adapter.readFile(["active.json"]), pointerBefore);
        return false;
      }
    }),
    errorCode("model-composition-store-activation-rejected")
  );

  assert.deepEqual(adapter.readFile(["active.json"]), pointerBefore);
  assert.equal(adapter.hasPath(["installed", installedPrior.manifestSha256]), true);
  assert.equal(adapter.hasPath(["installed", candidateSha256]), false);
  assert.equal(adapter.entriesUnder(["staging"]).length, 0);
  assert.equal((await store.openActive()).manifestSha256, installedPrior.manifestSha256);
});

test("cancellation after callback success cannot commit the candidate", async () => {
  const adapter = new MemoryAdapter();
  const store = createStore(adapter);
  const prior = fixture("activation-cancel-prior");
  const installedPrior = await store.install({
    manifest: prior.manifest,
    admissionAuthority: prior.admissionAuthority,
    sources: sourceSet(prior.members)
  });
  const pointerBefore = adapter.readFile(["active.json"]);
  const candidate = fixture("activation-cancel-candidate");
  const candidateSha256 = sha256(canonical(candidate.manifest));
  const controller = new AbortController();

  await assert.rejects(
    store.install({
      manifest: candidate.manifest,
      admissionAuthority: candidate.admissionAuthority,
      sources: sourceSet(candidate.members),
      signal: controller.signal,
      async activate() {
        controller.abort();
        return true;
      }
    }),
    errorCode("model-composition-store-aborted")
  );

  assert.deepEqual(adapter.readFile(["active.json"]), pointerBefore);
  assert.equal(adapter.hasPath(["installed", installedPrior.manifestSha256]), true);
  assert.equal(adapter.hasPath(["installed", candidateSha256]), false);
  assert.equal(adapter.entriesUnder(["staging"]).length, 0);
});

test("cancellation releases the store lock when activation never settles", { timeout: 1000 }, async () => {
  const adapter = new MemoryAdapter();
  const store = createStore(adapter);
  const prior = fixture("stalled-activation-prior");
  const installedPrior = await store.install({
    manifest: prior.manifest,
    admissionAuthority: prior.admissionAuthority,
    sources: sourceSet(prior.members)
  });
  const pointerBefore = adapter.readFile(["active.json"]);
  const candidate = fixture("stalled-activation-candidate");
  const controller = new AbortController();
  let activationEntered;
  const entered = new Promise((resolve) => {
    activationEntered = resolve;
  });

  const installing = store.install({
    manifest: candidate.manifest,
    admissionAuthority: candidate.admissionAuthority,
    sources: sourceSet(candidate.members),
    signal: controller.signal,
    activate() {
      activationEntered();
      return new Promise(() => {});
    }
  });
  await settleWithin(entered);
  controller.abort();

  await assert.rejects(
    settleWithin(installing),
    errorCode("model-composition-store-aborted")
  );
  assert.deepEqual(adapter.readFile(["active.json"]), pointerBefore);
  assert.equal(
    (await settleWithin(store.openActive())).manifestSha256,
    installedPrior.manifestSha256
  );
  assert.equal(adapter.entriesUnder(["staging"]).length, 0);
});

test("successful activation commits before removing the prior composition", async () => {
  const adapter = new MemoryAdapter();
  const store = createStore(adapter);
  const prior = fixture("activation-order-prior");
  const installedPrior = await store.install({
    manifest: prior.manifest,
    admissionAuthority: prior.admissionAuthority,
    sources: sourceSet(prior.members)
  });
  const candidate = fixture("activation-order-candidate");
  const operationStart = adapter.operations.length;

  const installedCandidate = await store.install({
    manifest: candidate.manifest,
    admissionAuthority: candidate.admissionAuthority,
    sources: sourceSet(candidate.members),
    async activate(storedCandidate, context) {
      adapter.operations.push({ type: "activation-callback" });
      assert.equal(context.previousComposition.manifestSha256,
        installedPrior.manifestSha256);
      assert.equal(adapter.hasPath(["installed", installedPrior.manifestSha256]), true);
      assert.deepEqual(
        await collect(storedCandidate.streamMember("composition.acg2")),
        Buffer.from(candidate.members["composition.acg2"])
      );
      return true;
    }
  });

  const operations = adapter.operations.slice(operationStart);
  const callbackIndex = operations.findIndex((operation) =>
    operation.type === "activation-callback");
  const pointerIndex = operations.findIndex((operation) =>
    operation.type === "atomic-write" && operation.path === "active.json");
  const priorRemovalIndex = operations.findIndex((operation) =>
    operation.type === "remove" &&
    operation.path === `installed/${installedPrior.manifestSha256}`);
  assert.ok(callbackIndex >= 0 && callbackIndex < pointerIndex);
  assert.ok(pointerIndex >= 0 && pointerIndex < priorRemovalIndex);
  assert.equal(adapter.hasPath(["installed", installedPrior.manifestSha256]), false);
  assert.equal(adapter.hasPath(["installed", installedCandidate.manifestSha256]), true);
});

test("requires canonical admission content exactly bound to all six manifest members", async () => {
  const value = fixture("admission-contract");
  const sources = sourceSet(value.members);

  await assert.rejects(
    createRawStore(new MemoryAdapter()).install({
      manifest: value.manifest,
      admissionAuthority: value.admissionAuthority,
      sources
    }),
    errorCode("model-composition-store-install-options")
  );

  await assert.rejects(
    createStore(new MemoryAdapter()).install({ manifest: value.manifest, sources }),
    errorCode("model-composition-store-install-options")
  );

  const noncanonicalText = ` ${value.admissionText}`;
  const noncanonicalManifest = structuredClone(value.manifest);
  const noncanonicalBytes = Buffer.from(noncanonicalText, "utf8");
  noncanonicalManifest.admissionAuthority.admission = {
    byteLength: noncanonicalBytes.byteLength,
    sha256: sha256(noncanonicalBytes)
  };
  const noncanonicalAdapter = new MemoryAdapter();
  await assert.rejects(
    createStore(noncanonicalAdapter).install({
      manifest: noncanonicalManifest,
      admissionAuthority: {
        ...value.admissionAuthority,
        admissionText: noncanonicalText
      },
      sources
    }),
    errorCode("model-composition-store-admission")
  );
  assert.equal(noncanonicalAdapter.hasPath(["active.json"]), false);

  const driftedAdmission = structuredClone(value.admission);
  driftedAdmission.artifacts[0].sha256 = sha256(Buffer.from("drifted-model", "utf8"));
  const driftedText = admissionApi.serializeAdmission(driftedAdmission);
  const driftedBytes = Buffer.from(driftedText, "utf8");
  const driftedManifest = structuredClone(value.manifest);
  driftedManifest.admissionAuthority.admission = {
    byteLength: driftedBytes.byteLength,
    sha256: sha256(driftedBytes)
  };
  const driftedAdapter = new MemoryAdapter();
  await assert.rejects(
    createStore(driftedAdapter).install({
      manifest: driftedManifest,
      admissionAuthority: {
        ...value.admissionAuthority,
        admissionText: driftedText
      },
      sources
    }),
    (error) => {
      assert.ok(error instanceof storeApi.ModelCompositionStoreError);
      assert.equal(error.code, "model-composition-store-admission");
      assert.equal(error.memberName, "model.slm2");
      return true;
    }
  );
  assert.equal(driftedAdapter.hasPath(["active.json"]), false);
});

test("rejects incomplete, self-asserted, or drifted admission authority before writing", async () => {
  const value = fixture("hostile-authority");
  const sources = sourceSet(value.members);

  for (const missingField of [
    "qualificationReceiptText",
    "catalogText",
    "catalogAuthority",
    "p2pPieceSetSha256"
  ]) {
    const adapter = new MemoryAdapter();
    const incomplete = { ...value.admissionAuthority };
    delete incomplete[missingField];
    await assert.rejects(
      createStore(adapter).install({
        manifest: value.manifest,
        admissionAuthority: incomplete,
        sources
      }),
      errorCode("model-composition-store-admission-authority")
    );
    assert.equal(adapter.hasPath(["active.json"]), false, missingField);
  }

  const pieceSetAdapter = new MemoryAdapter();
  await assert.rejects(
    createStore(pieceSetAdapter).install({
      manifest: value.manifest,
      admissionAuthority: {
        ...value.admissionAuthority,
        p2pPieceSetSha256: contentId("substituted-piece-set")
      },
      sources
    }),
    errorCode("model-composition-store-admission-authority")
  );
  assert.equal(pieceSetAdapter.hasPath(["active.json"]), false);

  const catalogAuthorityAdapter = new MemoryAdapter();
  await assert.rejects(
    createStore(catalogAuthorityAdapter).install({
      manifest: value.manifest,
      admissionAuthority: {
        ...value.admissionAuthority,
        catalogAuthority: {
          ...value.catalogAuthority,
          revision: value.catalogAuthority.revision + 1
        }
      },
      sources
    }),
    errorCode("model-composition-store-catalog-authority")
  );
  assert.equal(catalogAuthorityAdapter.hasPath(["active.json"]), false);

  const tamperedReceipt = {
    ...value.qualificationReceipt,
    numericalStatus: "failed"
  };
  const tamperedReceiptText = `${JSON.stringify(tamperedReceipt)}\n`;
  const tamperedReceiptManifest = structuredClone(value.manifest);
  tamperedReceiptManifest.admissionAuthority.qualificationReceipt = {
    byteLength: Buffer.byteLength(tamperedReceiptText),
    sha256: sha256(Buffer.from(tamperedReceiptText, "utf8"))
  };
  const receiptAdapter = new MemoryAdapter();
  await assert.rejects(
    createStore(receiptAdapter).install({
      manifest: tamperedReceiptManifest,
      admissionAuthority: {
        ...value.admissionAuthority,
        qualificationReceiptText: tamperedReceiptText
      },
      sources
    }),
    errorCode("model-composition-store-qualification-receipt")
  );
  assert.equal(receiptAdapter.hasPath(["active.json"]), false);

  const producerAdmission = structuredClone(value.admission);
  producerAdmission.qualification.qualityEvidenceSha256 =
    sha256(Buffer.from("self-asserted-quality", "utf8"));
  const producerAdmissionText = admissionApi.serializeAdmission(producerAdmission);
  const producerReceipt = {
    ...value.qualificationReceipt,
    qualityEvidenceSha256: producerAdmission.qualification.qualityEvidenceSha256
  };
  const producerReceiptText = `${JSON.stringify(producerReceipt)}\n`;
  const producerManifest = structuredClone(value.manifest);
  producerManifest.admissionAuthority.admission = {
    byteLength: Buffer.byteLength(producerAdmissionText),
    sha256: sha256(Buffer.from(producerAdmissionText, "utf8"))
  };
  producerManifest.admissionAuthority.qualificationReceipt = {
    byteLength: Buffer.byteLength(producerReceiptText),
    sha256: sha256(Buffer.from(producerReceiptText, "utf8"))
  };
  const producerAdapter = new MemoryAdapter();
  await assert.rejects(
    createStore(producerAdapter).install({
      manifest: producerManifest,
      admissionAuthority: {
        ...value.admissionAuthority,
        admissionText: producerAdmissionText,
        qualificationReceiptText: producerReceiptText
      },
      sources
    }),
    errorCode("model-composition-store-catalog")
  );
  assert.equal(producerAdapter.hasPath(["active.json"]), false);

  const driftedCatalog = structuredClone(value.catalog);
  driftedCatalog.entries[0].composition.members[0].sha256 = contentId("other-model");
  const driftedCatalogText = `${JSON.stringify(driftedCatalog)}\n`;
  const driftedCatalogManifest = structuredClone(value.manifest);
  driftedCatalogManifest.admissionAuthority.catalog = {
    byteLength: Buffer.byteLength(driftedCatalogText),
    sha256: sha256(Buffer.from(driftedCatalogText, "utf8"))
  };
  const driftedCatalogAuthority = {
    ...value.catalogAuthority,
    sha256: `sha256:${driftedCatalogManifest.admissionAuthority.catalog.sha256}`
  };
  const catalogAdapter = new MemoryAdapter();
  await assert.rejects(
    createStore(catalogAdapter).install({
      manifest: driftedCatalogManifest,
      admissionAuthority: {
        ...value.admissionAuthority,
        catalogText: driftedCatalogText,
        catalogAuthority: driftedCatalogAuthority
      },
      sources
    }),
    (error) => {
      assert.ok(error instanceof storeApi.ModelCompositionStoreError);
      assert.equal(error.code, "model-composition-store-catalog");
      assert.equal(error.memberName, "model.slm2");
      return true;
    }
  );
  assert.equal(catalogAdapter.hasPath(["active.json"]), false);
});

test("requires an explicit null when no P2P piece-set authority exists", async () => {
  const adapter = new MemoryAdapter();
  const value = fixture("non-p2p-authority");
  const manifest = structuredClone(value.manifest);
  manifest.admissionAuthority.p2pPieceSetSha256 = null;
  const installed = await createStore(adapter).install({
    manifest,
    admissionAuthority: {
      ...value.admissionAuthority,
      p2pPieceSetSha256: null
    },
    sources: sourceSet(value.members)
  });
  assert.equal(installed.admissionAuthority.p2pPieceSetSha256, null);
  assert.equal(
    (await createStore(adapter).openActive()).admissionAuthority.p2pPieceSetSha256,
    null
  );
});

test("rejects missing, additional, aliased, and reordered members before writing", async () => {
  const value = fixture("shape");

  const missingAdapter = new MemoryAdapter();
  const missing = sourceSet(value.members);
  delete missing["prompt.prompt2"];
  await assert.rejects(
    createStore(missingAdapter).install({
      manifest: value.manifest,
      admissionAuthority: value.admissionAuthority,
      sources: missing
    }),
    errorCode("model-composition-store-sources")
  );
  assert.equal(missingAdapter.hasPath(["active.json"]), false);

  const extraAdapter = new MemoryAdapter();
  const extra = { ...sourceSet(value.members), "weights.bin": sourceSet(value.members)["model.slm2"] };
  await assert.rejects(
    createStore(extraAdapter).install({
      manifest: value.manifest,
      admissionAuthority: value.admissionAuthority,
      sources: extra
    }),
    errorCode("model-composition-store-sources")
  );

  const aliasAdapter = new MemoryAdapter();
  const aliasManifest = structuredClone(value.manifest);
  aliasManifest.members[0].fileName = "alternate.slm2";
  await assert.rejects(
    createStore(aliasAdapter).install({
      manifest: aliasManifest,
      admissionAuthority: value.admissionAuthority,
      sources: sourceSet(value.members)
    }),
    errorCode("model-composition-store-member-name")
  );

  const reorderedAdapter = new MemoryAdapter();
  const reordered = structuredClone(value.manifest);
  [reordered.members[0], reordered.members[1]] = [reordered.members[1], reordered.members[0]];
  await assert.rejects(
    createStore(reorderedAdapter).install({
      manifest: reordered,
      admissionAuthority: value.admissionAuthority,
      sources: sourceSet(value.members)
    }),
    errorCode("model-composition-store-member-name")
  );
});

test("a source identity failure preserves the prior pointer and cleans its staging", async () => {
  const adapter = new MemoryAdapter();
  const store = createStore(adapter);
  const first = fixture("first");
  const active = await store.install({
    manifest: first.manifest,
    admissionAuthority: first.admissionAuthority,
    sources: sourceSet(first.members)
  });
  const pointerBefore = adapter.readFile(["active.json"]);

  const second = fixture("second");
  const corruptSources = sourceSet({
    ...second.members,
    "template.template2": bytes("wrong-template", second.members["template.template2"].length)
  });
  await assert.rejects(
    store.install({
      manifest: second.manifest,
      admissionAuthority: second.admissionAuthority,
      sources: corruptSources
    }),
    (error) => {
      assert.ok(error instanceof storeApi.ModelCompositionStoreError);
      assert.equal(error.code, "model-composition-store-source-sha256");
      assert.equal(error.memberName, "template.template2");
      return true;
    }
  );

  assert.deepEqual(adapter.readFile(["active.json"]), pointerBefore);
  assert.equal(adapter.hasPath(["installed", active.manifestSha256]), true);
  assert.equal(adapter.entriesUnder(["staging"]).length, 0);
  const installedDirectories = (await adapter.listEntries(["installed"], 20))
    .filter((entry) => entry.kind === "directory");
  assert.deepEqual(installedDirectories.map((entry) => entry.name), [active.manifestSha256]);
});

test("cancellation after staging preserves its identity and cannot replace the active pointer", async () => {
  const controller = new AbortController();
  let cancelWrites = false;
  const adapter = new MemoryAdapter({
    onWrite({ path: filePath }) {
      if (cancelWrites && filePath.endsWith("/model.slm2")) controller.abort();
    }
  });
  const store = createStore(adapter, { chunkBytes: 5 });
  const first = fixture("cancel-base");
  await store.install({
    manifest: first.manifest,
    admissionAuthority: first.admissionAuthority,
    sources: sourceSet(first.members)
  });
  const pointerBefore = adapter.readFile(["active.json"]);

  const second = fixture("cancel-next", 80);
  cancelWrites = true;
  await assert.rejects(
    store.install({
      manifest: second.manifest,
      admissionAuthority: second.admissionAuthority,
      sources: sourceSet(second.members),
      signal: controller.signal
    }),
    (error) => {
      assert.ok(error instanceof storeApi.ModelCompositionStoreError);
      assert.equal(error.code, "model-composition-store-aborted");
      assert.match(error.stagingId, /^[0-9a-f]{64}$/u);
      return true;
    }
  );

  assert.deepEqual(adapter.readFile(["active.json"]), pointerBefore);
  assert.equal(adapter.entriesUnder(["staging"]).length, 0);
  assert.equal(adapter.operations.some((operation) => operation.type === "abort" &&
    operation.path.endsWith("/model.slm2")), true);
});

test("cancellation promptly escapes a member write that never settles", async () => {
  const controller = new AbortController();
  const never = new Promise(() => {});
  let stallWrites = false;
  let reportWriteStarted;
  const writeStarted = new Promise((resolve) => {
    reportWriteStarted = resolve;
  });
  const adapter = new MemoryAdapter({
    onWrite({ path: filePath }) {
      if (stallWrites && filePath.endsWith("/model.slm2")) {
        reportWriteStarted();
        return never;
      }
    },
    onAbort({ path: filePath }) {
      if (stallWrites && filePath.endsWith("/model.slm2")) return never;
    }
  });
  const store = createStore(adapter, { chunkBytes: 5 });
  const first = fixture("stalled-write-base");
  const active = await store.install({
    manifest: first.manifest,
    admissionAuthority: first.admissionAuthority,
    sources: sourceSet(first.members)
  });
  const pointerBefore = adapter.readFile(["active.json"]);

  const second = fixture("stalled-write-next", 80);
  stallWrites = true;
  const pending = store.install({
    manifest: second.manifest,
    admissionAuthority: second.admissionAuthority,
    sources: sourceSet(second.members),
    signal: controller.signal
  });
  await settleWithin(writeStarted);
  controller.abort();

  await assert.rejects(
    settleWithin(pending),
    (error) => {
      assert.ok(error instanceof storeApi.ModelCompositionStoreError);
      assert.equal(error.code, "model-composition-store-aborted");
      assert.match(error.stagingId, /^[0-9a-f]{64}$/u);
      return true;
    }
  );
  assert.deepEqual(adapter.readFile(["active.json"]), pointerBefore);
  assert.equal(adapter.entriesUnder(["staging"]).length, 0);
  const installedDirectories = (await adapter.listEntries(["installed"], 20))
    .filter((entry) => entry.kind === "directory");
  assert.deepEqual(installedDirectories.map((entry) => entry.name), [active.manifestSha256]);
  assert.equal(adapter.operations.some((operation) => operation.type === "abort" &&
    operation.path.endsWith("/model.slm2")), true);
});

test("cancellation promptly escapes a member close that never settles", async () => {
  const controller = new AbortController();
  const never = new Promise(() => {});
  let stallCloses = false;
  let reportCloseStarted;
  const closeStarted = new Promise((resolve) => {
    reportCloseStarted = resolve;
  });
  const adapter = new MemoryAdapter({
    onClose({ path: filePath }) {
      if (stallCloses && filePath.endsWith("/model.slm2")) {
        reportCloseStarted();
        return never;
      }
    }
  });
  const store = createStore(adapter, { chunkBytes: 5 });
  const first = fixture("stalled-close-base");
  const active = await store.install({
    manifest: first.manifest,
    admissionAuthority: first.admissionAuthority,
    sources: sourceSet(first.members)
  });
  const pointerBefore = adapter.readFile(["active.json"]);

  const second = fixture("stalled-close-next", 80);
  stallCloses = true;
  const pending = store.install({
    manifest: second.manifest,
    admissionAuthority: second.admissionAuthority,
    sources: sourceSet(second.members),
    signal: controller.signal
  });
  await settleWithin(closeStarted);
  controller.abort();

  await assert.rejects(
    settleWithin(pending),
    (error) => {
      assert.ok(error instanceof storeApi.ModelCompositionStoreError);
      assert.equal(error.code, "model-composition-store-aborted");
      assert.match(error.stagingId, /^[0-9a-f]{64}$/u);
      return true;
    }
  );
  assert.deepEqual(adapter.readFile(["active.json"]), pointerBefore);
  assert.equal(adapter.entriesUnder(["staging"]).length, 0);
  const installedDirectories = (await adapter.listEntries(["installed"], 20))
    .filter((entry) => entry.kind === "directory");
  assert.deepEqual(installedDirectories.map((entry) => entry.name), [active.manifestSha256]);
  assert.equal(adapter.operations.some((operation) => operation.type === "abort" &&
    operation.path.endsWith("/model.slm2")), true);
});

test("cancellation does not wait for a stalled source iterator", async () => {
  const adapter = new MemoryAdapter();
  const store = createStore(adapter);
  const value = fixture("stalled");
  const controller = new AbortController();
  const stalled = sourceSet(value.members);
  stalled["model.slm2"] = {
    [Symbol.asyncIterator]() {
      return {
        next() {
          return new Promise(() => {});
        },
        return() {
          return new Promise(() => {});
        }
      };
    }
  };
  setTimeout(() => controller.abort(), 10);

  await assert.rejects(
    store.install({
      manifest: value.manifest,
      admissionAuthority: value.admissionAuthority,
      sources: stalled,
      signal: controller.signal
    }),
    errorCode("model-composition-store-aborted")
  );
  assert.equal(adapter.hasPath(["active.json"]), false);
  assert.equal(adapter.entriesUnder(["staging"]).length, 0);
});

test("late cancellation escapes stalled source cleanup without replacing the prior installation", async t => {
  for (const sourceKind of ["iterator", "reader", "native-stream"]) {
    await t.test(sourceKind, async () => {
      const adapter = new MemoryAdapter();
      const store = createStore(adapter);
      const prior = fixture(`cleanup-cancel-prior-${sourceKind}`);
      const active = await store.install({ manifest: prior.manifest,
        admissionAuthority: prior.admissionAuthority, sources: sourceSet(prior.members) });
      const pointerBefore = adapter.readFile(["active.json"]);
      const candidate = fixture(`cleanup-cancel-next-${sourceKind}`);
      const controller = new AbortController();
      const cleanupStarted = Promise.withResolvers();
      const cleanup = Promise.withResolvers();
      const extraBytes = new Uint8Array(candidate.members["model.slm2"].byteLength + 1);
      let released = false;
      let activated = false;
      // Fail length validation first, then hold source cleanup independently of cancellation.
      const finishSource = () => { cleanupStarted.resolve(); return cleanup.promise; };
      const sources = sourceSet(candidate.members);
      if (sourceKind === "native-stream") {
        sources["model.slm2"] = new ReadableStream({
          start(stream) { stream.enqueue(extraBytes); }, cancel: finishSource
        });
      } else {
        const reader = { read: async () => ({ done: false, value: extraBytes }),
          cancel: finishSource, releaseLock: () => { released = true; } };
        sources["model.slm2"] = sourceKind === "reader" ? { getReader: () => reader } : {
          [Symbol.asyncIterator]: () => ({ next: reader.read, return: finishSource })
        };
      }
      const outcome = store.install({ manifest: candidate.manifest,
        admissionAuthority: candidate.admissionAuthority, sources, signal: controller.signal,
        activate: async () => { activated = true; return true; }
      }).then(value => ({ value }), error => ({ error }));
      try {
        await settleWithin(cleanupStarted.promise);
        controller.abort();
        const result = await settleWithin(outcome);
        assert.equal(result.value, undefined);
        errorCode("model-composition-store-source-length")(result.error);
        assert.equal(activated, false);
        assert.deepEqual(adapter.readFile(["active.json"]), pointerBefore);
        assert.equal(adapter.entriesUnder(["staging"]).length, 0);
        assert.deepEqual((await adapter.listEntries(["installed"], 20)).map(entry => entry.name),
          [active.manifestSha256]);
        assert.equal((await settleWithin(createStore(adapter).openActive())).manifestSha256,
          active.manifestSha256);
        if (sourceKind === "reader") assert.equal(released, true);
        // Late cleanup rejection must remain observed after the caller has already returned.
        cleanup.reject(new Error("synthetic late source cleanup failure"));
        await new Promise(resolve => setImmediate(resolve));
      } finally {
        cleanup.resolve();
        await outcome;
      }
    });
  }
});

test("abort immediately before pointer commit stays canceled across restart", async () => {
  const controller = new AbortController();
  let armed = false;
  const adapter = new MemoryAdapter({
    onBeforeActiveWrite() {
      if (!armed) return;
      controller.abort();
      throw new Error("injected pre-commit abort");
    }
  });
  const store = createStore(adapter);
  const first = fixture("pre-commit-base");
  const active = await store.install({
    manifest: first.manifest,
    admissionAuthority: first.admissionAuthority,
    sources: sourceSet(first.members)
  });
  const pointerBefore = adapter.readFile(["active.json"]);
  const second = fixture("pre-commit-next");
  const secondManifestSha256 = sha256(canonical(second.manifest));
  armed = true;

  await assert.rejects(
    store.install({
      manifest: second.manifest,
      admissionAuthority: second.admissionAuthority,
      sources: sourceSet(second.members),
      signal: controller.signal
    }),
    (error) => {
      assert.ok(error instanceof storeApi.ModelCompositionStoreError);
      assert.equal(error.code, "model-composition-store-aborted");
      assert.match(error.stagingId, /^[0-9a-f]{64}$/u);
      return true;
    }
  );

  assert.deepEqual(adapter.readFile(["active.json"]), pointerBefore);
  assert.equal(adapter.hasPath(["installed", active.manifestSha256]), true);
  assert.equal(adapter.hasPath(["installed", secondManifestSha256]), false);
  assert.equal(adapter.entriesUnder(["staging"]).length, 0);
  const reopened = await createStore(adapter).openActive();
  assert.equal(reopened.manifestSha256, active.manifestSha256);
  assert.equal(reopened.admissionAuthority.admissionText, first.admissionText);
});

test("abort and fault immediately after pointer commit returns the committed restart state", async () => {
  const controller = new AbortController();
  let armed = false;
  const adapter = new MemoryAdapter({
    onAfterActiveWrite() {
      if (!armed) return;
      controller.abort();
      throw new Error("injected post-commit abort");
    }
  });
  const store = createStore(adapter);
  const first = fixture("post-commit-base");
  const previous = await store.install({
    manifest: first.manifest,
    admissionAuthority: first.admissionAuthority,
    sources: sourceSet(first.members)
  });
  const second = fixture("post-commit-next");
  armed = true;

  const committed = await store.install({
    manifest: second.manifest,
    admissionAuthority: second.admissionAuthority,
    sources: sourceSet(second.members),
    signal: controller.signal
  });

  assert.equal(controller.signal.aborted, true);
  assert.equal(committed.admissionAuthority.admissionText, second.admissionText);
  assert.equal(adapter.entriesUnder(["staging"]).length, 0);
  assert.equal(adapter.hasPath(["installed", previous.manifestSha256]), false);
  const pointer = JSON.parse(adapter.readFile(["active.json"]).toString("utf8"));
  assert.equal(pointer.manifestSha256, committed.manifestSha256);
  assert.equal(pointer.stagingId, committed.activationId);
  const reopened = await createStore(adapter).openActive();
  assert.equal(reopened.manifestSha256, committed.manifestSha256);
  assert.equal(reopened.activationId, committed.activationId);
  assert.equal(reopened.admissionAuthority.admissionText, second.admissionText);
});

test("late lock abort cannot replace a committed result with cancellation", async () => {
  const controller = new AbortController();
  let armed = false;
  const adapter = new MemoryAdapter({
    onAfterLockCallback() {
      if (!armed) return;
      controller.abort();
      throw new Error("injected post-callback abort");
    }
  });
  const store = createStore(adapter);
  const first = fixture("late-lock-base");
  const previous = await store.install({
    manifest: first.manifest,
    admissionAuthority: first.admissionAuthority,
    sources: sourceSet(first.members)
  });
  const second = fixture("late-lock-next");
  armed = true;

  const committed = await store.install({
    manifest: second.manifest,
    admissionAuthority: second.admissionAuthority,
    sources: sourceSet(second.members),
    signal: controller.signal
  });

  armed = false;
  assert.equal(controller.signal.aborted, true);
  assert.equal(committed.admissionAuthority.admissionText, second.admissionText);
  assert.equal(adapter.entriesUnder(["staging"]).length, 0);
  assert.equal(adapter.hasPath(["installed", previous.manifestSha256]), false);
  const reopened = await createStore(adapter).openActive();
  assert.equal(reopened.manifestSha256, committed.manifestSha256);
  assert.equal(reopened.activationId, committed.activationId);
});

test("an atomic pointer failure leaves the old composition active", async () => {
  const adapter = new MemoryAdapter();
  const store = createStore(adapter);
  const first = fixture("pointer-base");
  const installed = await store.install({
    manifest: first.manifest,
    admissionAuthority: first.admissionAuthority,
    sources: sourceSet(first.members)
  });
  const pointerBefore = adapter.readFile(["active.json"]);

  const second = fixture("pointer-next");
  adapter.failNextActiveWrite = true;
  await assert.rejects(
    store.install({
      manifest: second.manifest,
      admissionAuthority: second.admissionAuthority,
      sources: sourceSet(second.members)
    }),
    errorCode("model-composition-store-activation")
  );
  assert.deepEqual(adapter.readFile(["active.json"]), pointerBefore);
  assert.equal(adapter.hasPath(["installed", installed.manifestSha256]), true);
  assert.equal(adapter.entriesUnder(["staging"]).length, 0);
});

test("adapter failures cross the public boundary as typed store errors", async () => {
  const adapter = new MemoryAdapter();
  adapter.failNextLock = true;
  await assert.rejects(
    createStore(adapter).openActive(),
    errorCode("model-composition-store-lock")
  );
});

test("explicit recovery removes a malformed pointer without trusting a target identity", async () => {
  const adapter = new MemoryAdapter();
  const store = createStore(adapter);
  const value = fixture("malformed-pointer-recovery");
  const installed = await store.install({
    manifest: value.manifest,
    admissionAuthority: value.admissionAuthority,
    sources: sourceSet(value.members)
  });
  adapter.seedFile(["active.json"], Buffer.from("{malformed", "utf8"));
  adapter.seedFile(["unrelated", "keep.bin"], bytes("unrelated", 9));

  assert.equal(typeof store.discardInvalidActive, "function");
  assert.equal(await store.discardInvalidActive(), true);
  assert.equal(adapter.hasPath(["active.json"]), false);
  assert.equal(adapter.hasPath(["installed", installed.manifestSha256]), true);
  assert.equal(adapter.hasPath(["unrelated", "keep.bin"]), true);

  const reinstalled = await store.install({
    manifest: value.manifest,
    admissionAuthority: value.admissionAuthority,
    sources: sourceSet(value.members)
  });
  assert.equal(reinstalled.manifestSha256, installed.manifestSha256);
  assert.equal((await store.openActive()).manifestSha256, installed.manifestSha256);
  assert.equal(adapter.hasPath(["unrelated", "keep.bin"]), true);
});

test("explicit recovery permits reinstall of corrupted active content at the same address", async () => {
  const adapter = new MemoryAdapter({ readChunkBytes: 5 });
  const store = createStore(adapter, { chunkBytes: 4 });
  const value = fixture("same-manifest-recovery", 48);
  const installed = await store.install({
    manifest: value.manifest,
    admissionAuthority: value.admissionAuthority,
    sources: sourceSet(value.members)
  });
  const corruptPath = ["installed", installed.manifestSha256, "model.slm2"];
  adapter.mutate(corruptPath, 11);

  await assert.rejects(
    store.install({
      manifest: value.manifest,
      admissionAuthority: value.admissionAuthority,
      sources: sourceSet(value.members)
    }),
    errorCode("model-composition-store-stored-sha256")
  );
  assert.equal(await store.discardInvalidActive(), true);
  assert.equal(adapter.hasPath(["active.json"]), false);
  assert.equal(adapter.hasPath(["installed", installed.manifestSha256]), false);

  const repaired = await store.install({
    manifest: value.manifest,
    admissionAuthority: value.admissionAuthority,
    sources: sourceSet(value.members)
  });
  assert.equal(repaired.manifestSha256, installed.manifestSha256);
  assert.deepEqual(
    await collect(repaired.streamMember("model.slm2")),
    Buffer.from(value.members["model.slm2"])
  );
});

test("explicit recovery preserves a valid active composition exactly", async () => {
  const adapter = new MemoryAdapter({ readChunkBytes: 7 });
  const store = createStore(adapter, { chunkBytes: 5 });
  const value = fixture("valid-recovery-noop");
  const installed = await store.install({
    manifest: value.manifest,
    admissionAuthority: value.admissionAuthority,
    sources: sourceSet(value.members)
  });
  const pointerBefore = adapter.readFile(["active.json"]);
  const operationIndex = adapter.operations.length;

  assert.equal(await store.discardInvalidActive(), false);
  assert.deepEqual(adapter.readFile(["active.json"]), pointerBefore);
  assert.equal(adapter.hasPath(["installed", installed.manifestSha256]), true);
  assert.equal(
    adapter.operations.slice(operationIndex).some((operation) => operation.type === "remove"),
    false
  );
  assert.equal((await store.openActive()).activationId, installed.activationId);
});

test("opening an empty or installed cache performs no directory initialization", async () => {
  const adapter = new MemoryAdapter();
  const store = createStore(adapter);
  assert.equal(await store.openActive(), null);
  assert.equal(adapter.operations.some(operation => operation.type === "ensure-directory"), false);
  const value = fixture("read-only-open");
  const active = await store.install({ manifest: value.manifest,
    admissionAuthority: value.admissionAuthority, sources: sourceSet(value.members) });
  adapter.operations.length = 0;
  assert.equal((await createStore(adapter).openActive()).manifestSha256, active.manifestSha256);
  assert.equal(adapter.operations.some(operation => operation.type === "ensure-directory"), false);
});

test("OPFS cache reads do not create a missing root", async () => {
  const requests = [];
  const adapter = storeApi.createOpfsAdapter({
    createSha256: () => assert.fail("an absent cache has no bytes to hash"),
    storageManager: { async getDirectory() { return {
      async getDirectoryHandle(name, options) {
        requests.push({ name, create: options.create });
        throw Object.assign(new Error("absent root"), { name: "NotFoundError" });
      }
    }; } },
    lockManager: { request: (_name, _options, callback) => callback() },
    crypto: { getRandomValues: value => value }
  });
  assert.equal(await createStore(adapter).openActive(), null);
  assert.deepEqual(requests, [{ name: "tinyrustlm-model-compositions-v2", create: false }]);
});

test("cancelled OPFS root acquisition releases the read lock and does not poison a later open", async t => {
  for (const stage of ["origin", "composition-root"]) await t.test(stage, async () => {
    const entered = Promise.withResolvers();
    const pending = Promise.withResolvers();
    const lockName = crypto.randomUUID();
    let requests = 0;
    let rootCalls = 0;
    const origin = { getDirectoryHandle(_name, options) {
      assert.equal(options.create, false);
      rootCalls++;
      if (stage === "composition-root" && rootCalls === 1) { entered.resolve(); return pending.promise; }
      throw Object.assign(new Error("absent"), { name: "NotFoundError" });
    } };
    const adapter = storeApi.createOpfsAdapter({
      createSha256: () => assert.fail("no installed bytes"),
      storageManager: { getDirectory() {
        requests++;
        if (stage === "origin" && requests === 1) { entered.resolve(); return pending.promise; }
        return Promise.resolve(origin);
      } },
      lockManager: { request: (_name, options, callback) => locks.request(lockName, options, callback) },
      crypto: { getRandomValues: value => value }
    });
    const store = createStore(adapter);
    const controller = new AbortController();
    const observed = assert.rejects(store.openActive({ signal: controller.signal }),
      errorCode("model-composition-store-aborted"));
    try {
      await settleWithin(entered.promise); controller.abort(); await settleWithin(observed);
      assert.equal((await locks.query()).held.some(lock => lock.name === lockName), false);
      assert.equal(await settleWithin(store.openActive()), null);
      assert.equal(requests, 2);
    } finally { pending.reject(new Error("late root failure")); await observed.catch(() => {}); }
  });
});

test("OPFS root creation is explicit and invalid origin handles fail without cached errors", async () => {
  const calls = [];
  let invalid = true;
  const child = { getDirectoryHandle(name, options) { calls.push([name, options.create]); return child; } };
  const adapter = storeApi.createOpfsAdapter({
    createSha256: () => assert.fail("directory operations do not hash"),
    storageManager: { getDirectory: async () => invalid ? {} : child },
    lockManager: { request: (_name, _options, callback) => callback() },
    crypto: { getRandomValues: value => value }
  });
  await assert.rejects(adapter.ensureDirectory(["installed"]), errorCode("model-composition-store-opfs-unavailable"));
  invalid = false;
  await adapter.ensureDirectory(["installed"]);
  assert.deepEqual(calls, [["tinyrustlm-model-compositions-v2", true], ["installed", true]]);
});

test("AbortSignal cancels while navigator.locks is still waiting", { timeout: 1000 }, async () => {
  const controller = new AbortController();
  let callbackCalled = false;
  let notifyRequest;
  const requestSeen = new Promise((resolve) => {
    notifyRequest = resolve;
  });
  const hashAdapter = new MemoryAdapter();
  const adapter = storeApi.createOpfsAdapter({
    createSha256: hashAdapter.createSha256.bind(hashAdapter),
    storageManager: {
      getDirectory() {
        assert.fail("storage must not open while the lock is waiting");
      }
    },
    lockManager: {
      request(name, options, callback) {
        assert.equal(name, "tinyrustlm-model-compositions-v2-writer");
        assert.equal(options.mode, "exclusive");
        assert.equal(options.signal, controller.signal);
        notifyRequest();
        return new Promise((_resolve, rejectPromise) => {
          options.signal.addEventListener("abort", () => {
            rejectPromise(Object.assign(new Error("lock wait aborted"), {
              name: "AbortError"
            }));
          }, { once: true });
        }).then(() => {
          callbackCalled = true;
          return callback();
        });
      }
    },
    crypto: {
      getRandomValues(value) {
        return value;
      }
    }
  });
  const pending = createStore(adapter).discardInvalidActive({ signal: controller.signal });

  await requestSeen;
  controller.abort();
  await assert.rejects(pending, errorCode("model-composition-store-aborted"));
  assert.equal(callbackCalled, false);
});

test("bounded restart cleanup removes incomplete staging but preserves active content", async () => {
  const adapter = new MemoryAdapter();
  const store = createStore(adapter, { cleanupLimit: 3 });
  const value = fixture("cleanup-active");
  const installed = await store.install({
    manifest: value.manifest,
    admissionAuthority: value.admissionAuthority,
    sources: sourceSet(value.members)
  });

  const interruptedId = sha256(Buffer.from("interrupted-stage"));
  const interruptedManifest = sha256(Buffer.from("interrupted-manifest"));
  adapter.seedFile(["staging", `${interruptedId}.json`], canonical({
    schema: STAGING_SCHEMA,
    stagingId: interruptedId,
    manifestSha256: interruptedManifest
  }));
  adapter.seedFile(["installed", interruptedManifest, "model.slm2"], bytes("partial", 9));

  const result = await createStore(adapter, { cleanupLimit: 3 }).cleanup();

  assert.equal(result.removedStaging, 1);
  assert.ok(result.removedInstalled >= 1);
  assert.equal(adapter.hasPath(["installed", interruptedManifest]), false);
  assert.equal(adapter.hasPath(["installed", installed.manifestSha256]), true);
  assert.equal(adapter.entriesUnder(["staging"]).length, 0);
  assert.ok(adapter.operations.filter((operation) => operation.type === "list")
    .every((operation) => operation.limit <= (operation.path === "installed" ? 130 :
      operation.path.startsWith("installed/") ? 11 : 9)));
});

test("cleanup refuses unexpected entries without deleting them or the active installation", async t => {
  const cases = ["staging-file", "staging-directory", "malformed-marker", "mismatched-marker",
    "installed-file", "installed-directory", "unowned-hash", "corrupt-manifest",
    "extra-file", "nested-member", "excess-entries"];
  for (const variant of cases) {
    await t.test(variant, async () => {
      const adapter = new MemoryAdapter();
      const store = createStore(adapter);
      const prior = fixture(`ownership-prior-${variant}`);
      const active = await store.install({ manifest: prior.manifest,
        admissionAuthority: prior.admissionAuthority, sources: sourceSet(prior.members) });
      const orphan = fixture(`ownership-orphan-${variant}`);
      const hash = sha256(canonical(orphan.manifest));
      const id = sha256(Buffer.from(`ownership-stage-${variant}`));
      if (variant === "staging-file") adapter.seedFile(["staging", "notes.txt"], bytes("keep", 9));
      else if (variant === "staging-directory") {
        adapter.seedFile(["staging", `${id}.json`, "notes.txt"], bytes("keep", 9));
      } else if (variant === "malformed-marker") {
        adapter.seedFile(["staging", `${id}.json`], Buffer.from("{broken"));
      } else if (variant === "mismatched-marker") {
        adapter.seedFile(["staging", `${id}.json`], canonical({ schema: STAGING_SCHEMA,
          stagingId: hash, manifestSha256: hash }));
      } else if (variant === "installed-file") adapter.seedFile(["installed", hash], bytes("keep", 9));
      else if (variant === "installed-directory") {
        adapter.seedFile(["installed", "notes", "keep.txt"], bytes("keep", 9));
      } else {
        if (variant !== "unowned-hash") adapter.seedFile(["installed", hash, "manifest.json"],
          variant === "corrupt-manifest" ? Buffer.from("{broken") : canonical(orphan.manifest));
        adapter.seedFile(["installed", hash, "model.slm2"], bytes("partial", 9));
        if (variant === "extra-file") adapter.seedFile(["installed", hash, "notes.txt"], bytes("keep", 9));
        if (variant === "nested-member") {
          adapter.seedFile(["installed", hash, "tokenizer.tokenizer2", "notes.txt"], bytes("keep", 9));
        }
        if (variant === "excess-entries") {
          for (let i = 0; i < 11; i++) adapter.seedFile(["installed", hash, `extra-${i}`], bytes("keep", 9));
        }
      }
      const snapshot = new Map([...adapter.files.keys()].map(name => [name, adapter.readFile(name.split("/"))]));
      const operationIndex = adapter.operations.length;
      await assert.rejects(store.cleanup(), errorCode("model-composition-store-cleanup-ownership"));
      for (const [name, value] of snapshot) assert.deepEqual(adapter.readFile(name.split("/")), value, name);
      assert.equal(adapter.operations.slice(operationIndex).some(op => op.type === "remove"), false);
      assert.equal((await store.openActive()).manifestSha256, active.manifestSha256);
    });
  }
});

test("corrupt-active recovery checks its whole directory before removing the pointer", async () => {
  const adapter = new MemoryAdapter();
  const store = createStore(adapter);
  const value = fixture("recovery-ownership");
  const active = await store.install({ manifest: value.manifest,
    admissionAuthority: value.admissionAuthority, sources: sourceSet(value.members) });
  adapter.mutate(["installed", active.manifestSha256, "model.slm2"]);
  const unexpected = ["installed", active.manifestSha256, "notes.txt"];
  adapter.seedFile(unexpected, bytes("keep", 9));
  const before = adapter.readFile(["active.json"]);
  await assert.rejects(store.discardInvalidActive(), errorCode("model-composition-store-cleanup-ownership"));
  assert.deepEqual(adapter.readFile(["active.json"]), before);
  assert.ok(adapter.hasPath(unexpected));
});

test("failed candidate cleanup preserves unexpected content and its ownership marker", async () => {
  const adapter = new MemoryAdapter();
  const store = createStore(adapter);
  const value = fixture("abort-ownership");
  let unexpected;
  let stage;
  await assert.rejects(store.install({ manifest: value.manifest,
    admissionAuthority: value.admissionAuthority, sources: sourceSet(value.members),
    async activate(candidate) {
      unexpected = ["installed", candidate.manifestSha256, "notes.txt"];
      stage = ["staging", `${candidate.activationId}.json`];
      adapter.seedFile(unexpected, bytes("keep", 9));
      return false;
    }
  }), errorCode("model-composition-store-activation-rejected"));
  assert.ok(adapter.hasPath(unexpected));
  assert.ok(adapter.hasPath(stage));
  assert.equal(adapter.hasPath(["active.json"]), false);
  await assert.rejects(store.cleanup(), errorCode("model-composition-store-cleanup-ownership"));
});

test("a canonical marker cannot authorize deleting a file at the installed directory path", async () => {
  const adapter = new MemoryAdapter();
  const id = sha256(Buffer.from("marker-file-id"));
  const hash = sha256(Buffer.from("marker-file-hash"));
  adapter.seedFile(["staging", `${id}.json`], canonical({ schema: STAGING_SCHEMA,
    stagingId: id, manifestSha256: hash }));
  adapter.seedFile(["installed", hash], bytes("keep", 9));
  await assert.rejects(createStore(adapter).cleanup(), errorCode("model-composition-store-cleanup-ownership"));
  assert.ok(adapter.hasPath(["installed", hash]));
  assert.ok(adapter.hasPath(["staging", `${id}.json`]));
});

test("retirement checks the prior installation before committing a replacement", async () => {
  const adapter = new MemoryAdapter();
  const store = createStore(adapter);
  const prior = fixture("prior-ownership");
  const active = await store.install({ manifest: prior.manifest,
    admissionAuthority: prior.admissionAuthority, sources: sourceSet(prior.members) });
  const pointer = adapter.readFile(["active.json"]);
  const extra = ["installed", active.manifestSha256, "notes.txt"];
  adapter.seedFile(extra, bytes("keep", 9));
  const candidate = fixture("replacement-ownership");
  await assert.rejects(store.install({ manifest: candidate.manifest,
    admissionAuthority: candidate.admissionAuthority, sources: sourceSet(candidate.members) }),
  errorCode("model-composition-store-cleanup-ownership"));
  assert.deepEqual(adapter.readFile(["active.json"]), pointer);
  assert.ok(adapter.hasPath(extra));
  assert.equal(adapter.hasPath(["installed", sha256(canonical(candidate.manifest))]), false);
});

test("a path appearing after staging is preserved instead of reused or overwritten", async () => {
  const adapter = new MemoryAdapter();
  const value = fixture("late-path-collision");
  const hash = sha256(canonical(value.manifest));
  const unexpected = ["installed", hash, "model.slm2"];
  const keep = bytes("unowned", 9);
  const write = adapter.atomicWrite.bind(adapter);
  adapter.atomicWrite = async (parts, bytes) => {
    await write(parts, bytes);
    if (parts[0] === "staging") adapter.seedFile(unexpected, keep);
  };
  await assert.rejects(createStore(adapter).install({ manifest: value.manifest,
    admissionAuthority: value.admissionAuthority, sources: sourceSet(value.members) }),
  errorCode("model-composition-store-cleanup-ownership"));
  assert.deepEqual(adapter.readFile(unexpected), Buffer.from(keep));
  assert.equal(adapter.hasPath(["active.json"]), false);
  assert.deepEqual(adapter.entriesUnder(["staging"]), []);
});

test("a complete hash-bound orphan can be retired without recursive deletion", async () => {
  const adapter = new MemoryAdapter();
  const value = fixture("owned-orphan");
  const store = createStore(adapter);
  const installed = await store.install({ manifest: value.manifest,
    admissionAuthority: value.admissionAuthority, sources: sourceSet(value.members) });
  adapter.files.delete("active.json");
  const result = await store.cleanup();
  assert.equal(result.removedInstalled, 1);
  assert.equal(adapter.hasPath(["installed", installed.manifestSha256]), false);
  assert.equal(adapter.operations.some(op => op.type === "remove" && op.recursive), false);
});

test("interrupted file deletion keeps staging authority and resumes on the next cleanup", async () => {
  const adapter = new MemoryAdapter();
  const id = sha256(Buffer.from("partial-delete-id"));
  const hash = sha256(Buffer.from("partial-delete-hash"));
  const marker = ["staging", `${id}.json`];
  adapter.seedFile(marker, canonical({ schema: STAGING_SCHEMA, stagingId: id, manifestSha256: hash }));
  adapter.seedFile(["installed", hash, "model.slm2"], bytes("partial-model", 9));
  adapter.seedFile(["installed", hash, "prompt.prompt2"], bytes("partial-prompt", 9));
  const remove = adapter.removeEntry.bind(adapter);
  let fail = true;
  adapter.removeEntry = async (parts, options) => {
    if (parts.at(-1) === "prompt.prompt2" && fail) {
      fail = false;
      throw new Error("injected storage failure");
    }
    return remove(parts, options);
  };
  await assert.rejects(createStore(adapter).cleanup(), errorCode("model-composition-store-cleanup"));
  assert.ok(adapter.hasPath(marker));
  assert.equal(adapter.hasPath(["installed", hash, "model.slm2"]), false);
  await createStore(adapter).cleanup();
  assert.equal(adapter.hasPath(marker), false);
  assert.equal(adapter.hasPath(["installed", hash]), false);
});

test("an unexpected late child cannot be consumed by the final directory removal", async () => {
  const adapter = new MemoryAdapter();
  const id = sha256(Buffer.from("late-child-id"));
  const hash = sha256(Buffer.from("late-child-hash"));
  const marker = ["staging", `${id}.json`];
  adapter.seedFile(marker, canonical({ schema: STAGING_SCHEMA, stagingId: id, manifestSha256: hash }));
  adapter.seedFile(["installed", hash, "model.slm2"], bytes("partial", 9));
  const remove = adapter.removeEntry.bind(adapter);
  const extra = ["installed", hash, "notes.txt"];
  adapter.removeEntry = async (parts, options) => {
    if (key(parts) === `installed/${hash}`) adapter.seedFile(extra, bytes("keep", 9));
    return remove(parts, options);
  };
  await assert.rejects(createStore(adapter).cleanup(), errorCode("model-composition-store-cleanup"));
  assert.ok(adapter.hasPath(extra));
  assert.ok(adapter.hasPath(marker));
});

test("recovery retains a corrupt pointer's ownership when content removal fails", async () => {
  const adapter = new MemoryAdapter();
  const store = createStore(adapter);
  const value = fixture("recovery-partial-removal");
  const installed = await store.install({ manifest: value.manifest,
    admissionAuthority: value.admissionAuthority, sources: sourceSet(value.members) });
  adapter.mutate(["installed", installed.manifestSha256, "manifest.json"]);
  const pointer = adapter.readFile(["active.json"]);
  const remove = adapter.removeEntry.bind(adapter);
  let fail = true;
  adapter.removeEntry = async (parts, options) => {
    if (parts.at(-1) === "prompt.prompt2" && fail) {
      fail = false;
      throw new Error("injected storage failure");
    }
    return remove(parts, options);
  };
  await assert.rejects(store.discardInvalidActive(), errorCode("model-composition-store-cleanup"));
  assert.deepEqual(adapter.readFile(["active.json"]), pointer);
  assert.equal(await store.discardInvalidActive(), true);
  assert.equal(adapter.hasPath(["active.json"]), false);
  assert.equal(adapter.hasPath(["installed", installed.manifestSha256]), false);
});

test("cleanup rejects unsafe or duplicate adapter entry names before deletion", async t => {
  for (const name of ["../outside", "duplicate"]) {
    await t.test(name, async () => {
      const adapter = new MemoryAdapter();
      adapter.listEntries = async () => name === "duplicate"
        ? [{ name, kind: "file" }, { name, kind: "file" }] : [{ name, kind: "file" }];
      await assert.rejects(createStore(adapter).cleanup(), errorCode(name === "duplicate"
        ? "model-composition-store-adapter" : "model-composition-store-opfs-path"));
      assert.equal(adapter.operations.some(op => op.type === "remove"), false);
    });
  }
});

test("cleanup preserves markers outside its budget and refuses a saturated ownership inventory", async () => {
  const adapter = new MemoryAdapter();
  const ids = ["1".repeat(64), "2".repeat(64)];
  const hashes = ["3".repeat(64), "4".repeat(64)];
  for (let i = 0; i < ids.length; i++) {
    adapter.seedFile(["staging", `${ids[i]}.json`], canonical({ schema: STAGING_SCHEMA,
      stagingId: ids[i], manifestSha256: hashes[i] }));
    adapter.seedFile(["installed", hashes[i], "model.slm2"], bytes("partial", 9));
  }
  const store = createStore(adapter, { cleanupLimit: 1 });
  const first = await store.cleanup();
  assert.equal(first.removedStaging, 1);
  assert.equal(first.remainingStaging, 1);
  assert.ok(adapter.hasPath(["installed", hashes[1]]));
  for (let i = 0; i < 129; i++) {
    await adapter.ensureDirectory(["installed", sha256(Buffer.from(`extra-${i}`))]);
  }
  const operationIndex = adapter.operations.length;
  await assert.rejects(store.cleanup(), errorCode("model-composition-store-cleanup-ownership"));
  assert.equal(adapter.operations.slice(operationIndex).some(op => op.type === "remove"), false);
  assert.ok(adapter.hasPath(["staging", `${ids[1]}.json`]));
});

test("replacement cannot retire an installation while its member stream is being consumed", async () => {
  const adapter = new MemoryAdapter();
  const store = createStore(adapter, { chunkBytes: 4 });
  const prior = fixture("stream-reader-prior", 48);
  const active = await store.install({ manifest: prior.manifest,
    admissionAuthority: prior.admissionAuthority, sources: sourceSet(prior.members) });
  const iterator = active.streamMember("model.slm2")[Symbol.asyncIterator]();
  const first = await iterator.next();
  assert.equal(first.done, false);
  const next = fixture("stream-reader-next");
  const committed = Promise.withResolvers();
  let finished = false;
  adapter.onAfterActiveWrite = () => committed.resolve();
  const replacing = createStore(adapter).install({ manifest: next.manifest,
    admissionAuthority: next.admissionAuthority, sources: sourceSet(next.members) })
    .then(value => { finished = true; return value; });
  try {
    await settleWithin(committed.promise);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(finished, false);
    assert.ok(adapter.hasPath(["installed", active.manifestSha256]));
    const chunks = [first.value];
    for await (const chunk of iterator) chunks.push(chunk);
    assert.deepEqual(Buffer.concat(chunks), Buffer.from(prior.members["model.slm2"]));
  } finally {
    await iterator.return();
    await settleWithin(replacing);
  }
  assert.equal(adapter.hasPath(["installed", active.manifestSha256]), false);
});

test("a scoped six-member load pins the complete installation across replacement", async () => {
  const adapter = new MemoryAdapter();
  const store = createStore(adapter);
  const prior = fixture("scope-prior");
  const active = await store.install({ manifest: prior.manifest,
    admissionAuthority: prior.admissionAuthority, sources: sourceSet(prior.members) });
  const entered = Promise.withResolvers();
  const resume = Promise.withResolvers();
  let escaped;
  const reading = active.withRead(async reader => {
    escaped = reader;
    assert.equal(reader.manifestSha256, active.manifestSha256);
    assert.deepEqual(await collect(reader.streamMember(MEMBER_NAMES[0])), Buffer.from(prior.members[MEMBER_NAMES[0]]));
    entered.resolve();
    await resume.promise;
    for (const name of MEMBER_NAMES.slice(1)) {
      assert.deepEqual(await collect(reader.streamMember(name)), Buffer.from(prior.members[name]));
    }
    return "all-six-read";
  });
  await settleWithin(entered.promise);
  const committed = Promise.withResolvers();
  adapter.onAfterActiveWrite = () => committed.resolve();
  const candidate = fixture("scope-next");
  let finished = false;
  const replacing = createStore(adapter).install({ manifest: candidate.manifest,
    admissionAuthority: candidate.admissionAuthority, sources: sourceSet(candidate.members) })
    .then(value => { finished = true; return value; });
  try {
    await settleWithin(committed.promise);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(finished, false);
    assert.ok(adapter.hasPath(["installed", active.manifestSha256]));
  } finally { resume.resolve(); }
  assert.equal(await reading, "all-six-read");
  await settleWithin(replacing);
  assert.equal(adapter.hasPath(["installed", active.manifestSha256]), false);
  assert.throws(() => escaped.streamMember("model.slm2"), errorCode("model-composition-store-read-scope-closed"));
});

test("scope exit closes partially consumed streams before releasing reader locks", async () => {
  const adapter = new MemoryAdapter();
  const value = fixture("scope-exit", 24);
  const active = await createStore(adapter, { chunkBytes: 4 }).install({ manifest: value.manifest,
    admissionAuthority: value.admissionAuthority, sources: sourceSet(value.members) });
  let stream;
  await active.withRead(async reader => {
    stream = reader.streamMember("model.slm2");
    assert.equal((await stream.next()).done, false);
  });
  assert.equal((await stream.next()).done, true);
  assert.equal((await locks.query()).held.some(lock => lock.name.startsWith(adapter.compositionLockPrefix)), false);
  await assert.rejects(active.withRead(null), errorCode("model-composition-store-read-options"));
  await assert.rejects(active.withRead(() => {}, { extra: true }), errorCode("model-composition-store-read-options"));
  await assert.rejects(active.withRead(reader => collect(reader.streamMember("other.bin"))),
    errorCode("model-composition-store-member-name"));
});

test("scope cancellation releases hung callbacks and pending reads and observes later rejection", async () => {
  const adapter = new MemoryAdapter();
  const value = fixture("scope-abort");
  const active = await createStore(adapter).install({ manifest: value.manifest,
    admissionAuthority: value.admissionAuthority, sources: sourceSet(value.members) });
  const controller = new AbortController();
  const entered = Promise.withResolvers();
  const callback = Promise.withResolvers();
  const source = Promise.withResolvers();
  const open = adapter.openReadable.bind(adapter);
  adapter.openReadable = parts => parts.at(-1) === "model.slm2" ? source.promise : open(parts);
  let pending;
  const reading = active.withRead(reader => {
    pending = reader.streamMember("model.slm2").next();
    entered.resolve();
    return callback.promise;
  }, { signal: controller.signal });
  const observed = assert.rejects(reading, errorCode("model-composition-store-aborted"));
  await entered.promise;
  controller.abort();
  await settleWithin(observed);
  await assert.rejects(pending, errorCode("model-composition-store-aborted"));
  assert.equal((await locks.query()).held.some(lock => lock.name.startsWith(adapter.compositionLockPrefix)), false);
  source.reject(new Error("late synthetic source failure"));
  callback.reject(new Error("late synthetic callback failure"));
  await new Promise(resolve => setImmediate(resolve));
});

test("reader admission waits for a writer and can be cancelled in the queue", async () => {
  const adapter = new MemoryAdapter();
  const value = fixture("queued-reader");
  const active = await createStore(adapter).install({ manifest: value.manifest,
    admissionAuthority: value.admissionAuthority, sources: sourceSet(value.members) });
  const entered = Promise.withResolvers();
  const release = Promise.withResolvers();
  const writer = adapter.withCompositionLock(active.manifestSha256, "exclusive", async () => {
    entered.resolve(); await release.promise;
  });
  await entered.promise;
  const controller = new AbortController();
  const read = active.withRead(() => assert.fail("cancelled reader callback ran"), { signal: controller.signal });
  const failed = assert.rejects(read, errorCode("model-composition-store-aborted"));
  controller.abort();
  try { await settleWithin(failed); }
  finally { release.resolve(); await writer; }
});

test("multiple shared readers release independently before exclusive retirement", async () => {
  const adapter = new MemoryAdapter();
  const value = fixture("shared-readers");
  const store = createStore(adapter);
  const active = await store.install({ manifest: value.manifest,
    admissionAuthority: value.admissionAuthority, sources: sourceSet(value.members) });
  const entered = [Promise.withResolvers(), Promise.withResolvers()];
  const release = [Promise.withResolvers(), Promise.withResolvers()];
  const readers = entered.map((ready, i) => active.withRead(async () => {
    ready.resolve(); await release[i].promise;
  }));
  await settleWithin(Promise.all(entered.map(item => item.promise)));
  const held = (await locks.query()).held.filter(lock => lock.name.endsWith(active.manifestSha256));
  assert.equal(held.length, 2);
  // Explicit recovery may retire corrupted bytes, but only after both readers relinquish them.
  adapter.mutate(["installed", active.manifestSha256, "model.slm2"]);
  let done = false;
  const recovery = store.discardInvalidActive().then(value => { done = true; return value; });
  try {
    await new Promise(resolve => setImmediate(resolve));
    release[0].resolve();
    await readers[0];
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(done, false);
    assert.ok(adapter.hasPath(["installed", active.manifestSha256]));
  } finally {
    release.forEach(item => item.resolve());
    await Promise.all(readers);
  }
  assert.equal(await settleWithin(recovery), true);
  assert.equal(adapter.hasPath(["installed", active.manifestSha256]), false);
});

test("candidate writes wait for a composition lease and cancellation leaves no partial installation", async () => {
  const adapter = new MemoryAdapter();
  const value = fixture("queued-candidate-write");
  const identity = sha256(canonical(value.manifest));
  const entered = Promise.withResolvers();
  const release = Promise.withResolvers();
  const reader = adapter.withCompositionLock(identity, "shared", async () => {
    entered.resolve(); await release.promise;
  });
  await entered.promise;
  const staged = Promise.withResolvers();
  const atomicWrite = adapter.atomicWrite.bind(adapter);
  adapter.atomicWrite = async (parts, bytes) => {
    await atomicWrite(parts, bytes);
    if (parts[0] === "staging") staged.resolve();
  };
  const controller = new AbortController();
  const install = createStore(adapter).install({ manifest: value.manifest,
    admissionAuthority: value.admissionAuthority, sources: sourceSet(value.members), signal: controller.signal });
  const observed = assert.rejects(install, errorCode("model-composition-store-aborted"));
  try {
    await settleWithin(staged.promise);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(adapter.hasPath(["installed", identity]), false);
    controller.abort();
    await settleWithin(observed);
    assert.equal(adapter.hasPath(["active.json"]), false);
    assert.deepEqual(adapter.entriesUnder(["staging"]), []);
  } finally { release.resolve(); await reader; }
});

test("cancelled recovery stops waiting for readers without deleting bytes or pointer authority", async () => {
  const adapter = new MemoryAdapter();
  const value = fixture("cancelled-reader-retirement");
  const store = createStore(adapter);
  const active = await store.install({ manifest: value.manifest,
    admissionAuthority: value.admissionAuthority, sources: sourceSet(value.members) });
  const entered = Promise.withResolvers();
  const release = Promise.withResolvers();
  const read = active.withRead(async () => { entered.resolve(); await release.promise; });
  await entered.promise;
  adapter.mutate(["installed", active.manifestSha256, "model.slm2"]);
  const pointer = adapter.readFile(["active.json"]);
  const controller = new AbortController();
  const recovery = store.discardInvalidActive({ signal: controller.signal });
  const observed = assert.rejects(recovery, errorCode("model-composition-store-aborted"));
  try {
    await new Promise(resolve => setImmediate(resolve));
    controller.abort();
    await settleWithin(observed);
    assert.deepEqual(adapter.readFile(["active.json"]), pointer);
    assert.ok(adapter.hasPath(["installed", active.manifestSha256]));
  } finally { release.resolve(); await read; }
});

test("cancelling a stalled active-pointer read releases the writer lock without changing the installation", async () => {
  const adapter = new MemoryAdapter();
  const value = fixture("metadata-cancellation");
  const store = createStore(adapter);
  const active = await store.install({ manifest: value.manifest,
    admissionAuthority: value.admissionAuthority, sources: sourceSet(value.members) });
  const pointer = adapter.readFile(["active.json"]);
  const entered = Promise.withResolvers();
  const pending = Promise.withResolvers();
  const openReadable = adapter.openReadable.bind(adapter);
  adapter.openReadable = parts => {
    if (key(parts) === "active.json") { entered.resolve(); return pending.promise; }
    return openReadable(parts);
  };
  const controller = new AbortController();
  const observed = assert.rejects(store.openActive({ signal: controller.signal }),
    errorCode("model-composition-store-aborted"));
  try {
    await settleWithin(entered.promise);
    controller.abort();
    await settleWithin(observed);
    adapter.openReadable = openReadable;
    const reopened = await settleWithin(store.openActive());
    assert.equal(reopened.manifestSha256, active.manifestSha256);
    assert.deepEqual(adapter.readFile(["active.json"]), pointer);
  } finally {
    adapter.openReadable = openReadable;
    pending.reject(new Error("late metadata failure"));
    await observed.catch(() => {});
  }
});

// Hold exactly one read boundary, then expose late rejection without blocking subsequent store calls.
function stallRead(adapter, target, phase) {
  const entered = Promise.withResolvers();
  const pending = Promise.withResolvers();
  const cleanup = Promise.withResolvers();
  const original = adapter.openReadable.bind(adapter);
  let armed = true;
  let disposed = false;
  adapter.openReadable = async parts => {
    if (!armed || key(parts) !== target) return original(parts);
    armed = false;
    if (phase === "open") { entered.resolve(); return pending.promise; }
    const readable = await original(parts);
    return { byteLength: readable ? readable.byteLength : 1,
      stream: { [Symbol.asyncIterator]: () => ({
        next() { entered.resolve(); return pending.promise; },
        return() { disposed = true; return cleanup.promise; }
      }) } };
  };
  return { entered: entered.promise, get disposed() { return disposed; },
    restore() {
      adapter.openReadable = original;
      pending.reject(new Error("late read rejection"));
      if (disposed) cleanup.reject(new Error("late reader cleanup rejection"));
      else cleanup.resolve();
    } };
}

test("restore and recovery cancellation preserve metadata and release every stalled read", async t => {
  for (const method of ["openActive", "discardInvalidActive"]) {
    for (const name of ["active.json", "staging", "manifest.json", "admission.json",
      "qualification-receipt.json", "catalog.json", "model.slm2"]) {
      for (const phase of ["open", "body"]) {
        await t.test(`${method} ${name} ${phase}`, async () => {
          const adapter = new MemoryAdapter();
          const value = fixture("read-cancel-matrix");
          const store = createStore(adapter);
          const active = await store.install({ manifest: value.manifest,
            admissionAuthority: value.admissionAuthority, sources: sourceSet(value.members) });
          const target = name === "active.json" ? name : name === "staging"
            ? `staging/${active.activationId}.json` : `installed/${active.manifestSha256}/${name}`;
          const before = new Map(adapter.files);
          const controller = new AbortController();
          const stalled = stallRead(adapter, target, phase);
          const observed = assert.rejects(store[method]({ signal: controller.signal }),
            errorCode("model-composition-store-aborted"));
          try {
            await settleWithin(stalled.entered);
            controller.abort();
            await settleWithin(observed);
            assert.equal(stalled.disposed, phase === "body");
            assert.deepEqual(adapter.files, before);
            assert.equal((await settleWithin(store.openActive())).manifestSha256, active.manifestSha256);
          } finally { stalled.restore(); await observed.catch(() => {}); }
        });
      }
    }
  }
});

test("cleanup cancellation retains authority while reading staged and orphaned metadata", async t => {
  for (const ownership of ["staged", "orphan"]) for (const phase of ["open", "body"]) {
    await t.test(`${ownership} ${phase}`, async () => {
      const adapter = new MemoryAdapter();
      const value = fixture("cleanup-metadata-cancel");
      const identity = sha256(canonical(value.manifest));
      adapter.seedFile(["installed", identity, "manifest.json"], canonical(value.manifest));
      const marker = { schema: STAGING_SCHEMA, stagingId: identity, manifestSha256: identity };
      if (ownership === "staged") adapter.seedFile(["staging", `${identity}.json`], canonical(marker));
      const target = ownership === "staged" ? `staging/${identity}.json` : `installed/${identity}/manifest.json`;
      const before = new Map(adapter.files);
      const controller = new AbortController();
      const stalled = stallRead(adapter, target, phase);
      const store = createStore(adapter);
      const observed = assert.rejects(store.cleanup({ signal: controller.signal }),
        errorCode("model-composition-store-aborted"));
      try {
        await settleWithin(stalled.entered); controller.abort();
        await settleWithin(observed);
        assert.deepEqual(adapter.files, before);
        assert.equal(await settleWithin(store.openActive()), null);
      } finally { stalled.restore(); await observed.catch(() => {}); }
    });
  }
});

test("cancelled candidate metadata validation never activates or replaces the saved installation", async t => {
  for (const name of ["manifest.json", "admission.json", "qualification-receipt.json", "catalog.json"]) {
    for (const phase of ["open", "body"]) await t.test(`${name} ${phase}`, async () => {
      const adapter = new MemoryAdapter();
      const store = createStore(adapter);
      const prior = fixture("read-cancel-prior");
      const active = await store.install({ manifest: prior.manifest,
        admissionAuthority: prior.admissionAuthority, sources: sourceSet(prior.members) });
      const value = fixture("read-cancel-candidate");
      const identity = sha256(canonical(value.manifest));
      const target = `installed/${identity}/${name}`;
      const atomicWrite = adapter.atomicWrite.bind(adapter);
      let stalled;
      const armed = Promise.withResolvers();
      // Arm only after the candidate's last metadata write, so this exercises persisted readback.
      adapter.atomicWrite = async (parts, bytes) => {
        await atomicWrite(parts, bytes);
        if (key(parts) === `installed/${identity}/catalog.json`) {
          stalled = stallRead(adapter, target, phase);
          armed.resolve();
        }
      };
      const controller = new AbortController();
      let activated = false;
      const observed = assert.rejects(store.install({ manifest: value.manifest,
        admissionAuthority: value.admissionAuthority, sources: sourceSet(value.members),
        signal: controller.signal, activate: async () => { activated = true; return true; } }),
      errorCode("model-composition-store-aborted"));
      try {
        await settleWithin(armed.promise);
        await settleWithin(stalled.entered); controller.abort();
        await settleWithin(observed);
        assert.equal(activated, false);
        assert.equal(adapter.hasPath(["installed", identity]), false);
        assert.deepEqual(adapter.entriesUnder(["staging"]), []);
        assert.equal((await settleWithin(store.openActive())).manifestSha256, active.manifestSha256);
      } finally { if (stalled) stalled.restore(); await observed.catch(() => {}); }
    });
  }
});

test("cancellation interrupts metadata hashing without changing custody or retaining abort listeners", async t => {
  for (const field of ["manifest", "admissionText", "qualificationReceiptText", "catalogText", "authority"]) {
    for (const phase of ["update", "digest"]) await t.test(`${field} ${phase}`, async () => {
      const adapter = new MemoryAdapter();
      const store = createStore(adapter);
      const value = fixture("hash-cancel");
      const active = await store.install({ manifest: value.manifest,
        admissionAuthority: value.admissionAuthority, sources: sourceSet(value.members) });
      const target = field === "manifest" ? canonical(value.manifest) : field === "authority"
        ? canonical(value.manifest.admissionAuthority) : Buffer.from(value[field]);
      const entered = Promise.withResolvers();
      const pending = Promise.withResolvers();
      const original = adapter.createSha256.bind(adapter);
      let armed = true;
      adapter.createSha256 = () => {
        const hasher = original();
        let match = false;
        return {
          update(bytes) {
            match = armed && Buffer.from(bytes).equals(Buffer.from(target));
            if (match) armed = false;
            if (match && phase === "update") { entered.resolve(); return pending.promise; }
            return hasher.update(bytes);
          },
          digest() {
            if (match && phase === "digest") { entered.resolve(); return pending.promise; }
            return hasher.digest();
          }
        };
      };
      const controller = new AbortController();
      const observed = assert.rejects(store.openActive({ signal: controller.signal }),
        errorCode("model-composition-store-aborted"));
      try {
        await settleWithin(entered.promise); controller.abort();
        await settleWithin(observed);
        assert.equal(require("node:events").getEventListeners(controller.signal, "abort").length, 0);
        assert.equal((await settleWithin(store.openActive())).manifestSha256, active.manifestSha256);
      } finally {
        adapter.createSha256 = original;
        pending.reject(new Error("late hash failure"));
        await observed.catch(() => {});
      }
    });
  }
});

test("cleanup enumeration cancellation preserves the orphan and releases both locks", async t => {
  for (const [directory, occurrence] of [["staging", 1], ["staging", 2], ["installed", 1],
    ["installed", 2], ["composition", 1]]) await t.test(`${directory} ${occurrence}`, async () => {
    const adapter = new MemoryAdapter();
    const value = fixture("list-cancel");
    const identity = sha256(canonical(value.manifest));
    adapter.seedFile(["installed", identity, "manifest.json"], canonical(value.manifest));
    const before = new Map(adapter.files);
    const original = adapter.listEntries.bind(adapter);
    const entered = Promise.withResolvers();
    const pending = Promise.withResolvers();
    let count = 0;
    const target = directory === "composition" ? `installed/${identity}` : directory;
    adapter.listEntries = (parts, limit) => {
      if (key(parts) === target && ++count === occurrence) { entered.resolve(); return pending.promise; }
      return original(parts, limit);
    };
    const controller = new AbortController();
    const store = createStore(adapter);
    const observed = assert.rejects(store.cleanup({ signal: controller.signal }),
      errorCode("model-composition-store-aborted"));
    try {
      await settleWithin(entered.promise); controller.abort(); await settleWithin(observed);
      assert.deepEqual(adapter.files, before);
      assert.equal(await settleWithin(store.openActive()), null);
      assert.equal((await locks.query()).held.some(lock => lock.name.endsWith(identity)), false);
    } finally {
      adapter.listEntries = original; pending.reject(new Error("late enumeration failure"));
      await observed.catch(() => {});
    }
  });
});

test("candidate admission inventories and staging identity allocation honor cancellation", async t => {
  for (const boundary of [1, 2, 3, 4, "random", "collision-read"]) await t.test(String(boundary), async () => {
    const adapter = new MemoryAdapter();
    const store = createStore(adapter);
    const prior = fixture("admission-read-prior");
    const active = await store.install({ manifest: prior.manifest,
      admissionAuthority: prior.admissionAuthority, sources: sourceSet(prior.members) });
    const value = fixture("admission-read-next");
    const identity = sha256(canonical(value.manifest));
    const entered = Promise.withResolvers();
    const pending = Promise.withResolvers();
    const originalList = adapter.listEntries.bind(adapter);
    const originalRandom = adapter.randomBytes.bind(adapter);
    const originalRead = adapter.openReadable.bind(adapter);
    let count = 0;
    // The parent admission inventory uses 130 entries; ordinary bounded cleanup uses its own limit.
    adapter.listEntries = (parts, limit) => {
      if (key(parts) === "installed" && limit === 130 && ++count === boundary) {
        entered.resolve(); return pending.promise;
      }
      return originalList(parts, limit);
    };
    adapter.randomBytes = length => {
      if (boundary === "random") { entered.resolve(); return pending.promise; }
      if (boundary === "collision-read") {
        const bytes = originalRandom(length);
        const target = `staging/${Buffer.from(bytes).toString("hex")}.json`;
        adapter.openReadable = parts => {
          if (key(parts) === target) { entered.resolve(); return pending.promise; }
          return originalRead(parts);
        };
        return bytes;
      }
      return originalRandom(length);
    };
    const controller = new AbortController();
    const observed = assert.rejects(store.install({ manifest: value.manifest,
      admissionAuthority: value.admissionAuthority, sources: sourceSet(value.members), signal: controller.signal }),
    errorCode("model-composition-store-aborted"));
    try {
      await settleWithin(entered.promise); controller.abort(); await settleWithin(observed);
      assert.equal(adapter.hasPath(["installed", identity]), false);
      assert.equal((await settleWithin(store.openActive())).manifestSha256, active.manifestSha256);
    } finally {
      adapter.listEntries = originalList; adapter.randomBytes = originalRandom;
      adapter.openReadable = originalRead; pending.reject(new Error("late admission read failure"));
      await observed.catch(() => {});
    }
  });
});

test("a synchronous abort inside read acquisition observes its late rejection", async () => {
  const adapter = new MemoryAdapter();
  const controller = new AbortController();
  const pending = Promise.withResolvers();
  adapter.openReadable = () => { controller.abort(); return pending.promise; };
  await assert.rejects(createStore(adapter).openActive({ signal: controller.signal }),
    errorCode("model-composition-store-aborted"));
  pending.reject(new Error("synchronous-abort late failure"));
  // The test runner fails on an unhandled rejection from an already-aborted await.
  await new Promise(resolve => setImmediate(resolve));
});

test("cancelled authority preparation never acquires storage and observes late hash failure", async () => {
  const adapter = new MemoryAdapter();
  const store = createStore(adapter);
  const value = fixture("prepare-cancel");
  const entered = Promise.withResolvers();
  const pending = Promise.withResolvers();
  const original = adapter.createSha256.bind(adapter);
  let first = true;
  adapter.createSha256 = () => {
    if (!first) return original();
    first = false;
    return { update() { entered.resolve(); return pending.promise; },
      digest() { assert.fail("cancelled metadata update reached digest"); } };
  };
  const controller = new AbortController();
  const observed = assert.rejects(store.install({ manifest: value.manifest,
    admissionAuthority: value.admissionAuthority, sources: sourceSet(value.members), signal: controller.signal }),
  errorCode("model-composition-store-aborted"));
  try {
    await settleWithin(entered.promise); controller.abort(); await settleWithin(observed);
    assert.deepEqual(adapter.operations, []);
  } finally { pending.reject(new Error("late preparation failure")); await observed.catch(() => {}); }
  await new Promise(resolve => setImmediate(resolve));
});

test("postcommit metadata readback drains despite cancellation and returns the committed candidate", async () => {
  const adapter = new MemoryAdapter();
  const store = createStore(adapter);
  const controller = new AbortController();
  const value = fixture("postcommit-metadata-cancel");
  const entered = Promise.withResolvers();
  const pending = Promise.withResolvers();
  const original = adapter.openReadable.bind(adapter);
  adapter.onAfterActiveWrite = () => {
    adapter.openReadable = parts => {
      if (parts[0] === "staging") { entered.resolve(); return pending.promise; }
      return original(parts);
    };
  };
  let done = false;
  const result = store.install({ manifest: value.manifest, admissionAuthority: value.admissionAuthority,
    sources: sourceSet(value.members), signal: controller.signal }).then(active => { done = true; return active; });
  try {
    await settleWithin(entered.promise); controller.abort();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(done, false);
    assert.equal(JSON.parse(Buffer.from(adapter.readFile(["active.json"])).toString()).manifestSha256,
      sha256(canonical(value.manifest)));
  } finally { adapter.openReadable = original; pending.resolve(null); }
  const active = await settleWithin(result);
  assert.equal((await store.openActive()).manifestSha256, active.manifestSha256);
});

test("restart reopens and reverifies every immutable member", async () => {
  const adapter = new MemoryAdapter({ readChunkBytes: 6 });
  const value = fixture("restart");
  const firstStore = createStore(adapter, { chunkBytes: 4 });
  const installed = await firstStore.install({
    manifest: value.manifest,
    admissionAuthority: value.admissionAuthority,
    sources: sourceSet(value.members)
  });

  const restarted = createStore(adapter, { chunkBytes: 4 });
  const reopened = await restarted.openActive();
  assert.equal(reopened.manifestSha256, installed.manifestSha256);
  assert.equal(reopened.admissionAuthority.admissionText, value.admissionText);
  assert.deepEqual(
    reopened.admissionAuthority.qualificationReceipt,
    value.qualificationReceipt
  );
  assert.equal(
    reopened.admissionAuthority.qualificationReceiptText,
    value.qualificationReceiptText
  );
  assert.deepEqual(reopened.admissionAuthority.catalogDocument, value.catalog);
  assert.equal(reopened.admissionAuthority.catalogText, value.catalogText);
  assert.deepEqual(reopened.admissionAuthority.catalogAuthority, value.catalogAuthority);
  assert.equal(reopened.admissionAuthority.p2pPieceSetSha256, value.p2pPieceSetSha256);
  assert.ok(Object.isFrozen(reopened));
  assert.ok(Object.isFrozen(reopened.admissionAuthority));
  assert.ok(Object.isFrozen(reopened.admissionAuthority.catalogDocument.entries));
  const disposition = catalogApi.qualificationDisposition(
    reopened.admissionAuthority.catalogDocument,
    reopened.admissionAuthority.admission,
    { now: TEST_NOW }
  );
  assert.equal(disposition.status, "current");
  assert.equal(disposition.reason, "current");
  assert.equal(disposition.compositionId, value.qualificationReceipt.compositionId);
  assert.equal(disposition.receiptId, value.qualificationReceipt.receiptId);
  assert.equal(disposition.catalogId, value.catalog.catalog_id);
  assert.equal(disposition.catalogRevision, value.catalog.revision);
  assert.equal(disposition.entry.composition.compositionId,
    value.qualificationReceipt.compositionId);
  for (const fileName of MEMBER_NAMES) {
    assert.deepEqual(
      await collect(reopened.streamMember(fileName)),
      Buffer.from(value.members[fileName])
    );
  }

  adapter.mutate(["installed", installed.manifestSha256, "sampling.sampling2"], 3);
  await assert.rejects(
    restarted.openActive(),
    (error) => {
      assert.ok(error instanceof storeApi.ModelCompositionStoreError);
      assert.equal(error.code, "model-composition-store-stored-sha256");
      assert.equal(error.memberName, "sampling.sampling2");
      return true;
    }
  );
});

test("a fresh store rejects missing or drifted installed admission content", async () => {
  const adapter = new MemoryAdapter();
  const value = fixture("stored-admission");
  const installed = await createStore(adapter).install({
    manifest: value.manifest,
    admissionAuthority: value.admissionAuthority,
    sources: sourceSet(value.members)
  });
  const admissionPath = ["installed", installed.manifestSha256, "admission.json"];

  adapter.mutate(admissionPath, 7);
  await assert.rejects(
    createStore(adapter).openActive(),
    errorCode("model-composition-store-stored-admission")
  );

  adapter.seedFile(admissionPath, Buffer.from(value.admissionText, "utf8"));
  const reopened = await createStore(adapter).openActive();
  assert.equal(reopened.admissionAuthority.admissionText, value.admissionText);

  await adapter.removeEntry(admissionPath, { missingOk: false });
  await assert.rejects(
    createStore(adapter).openActive(),
    errorCode("model-composition-store-stored-admission")
  );
  assert.equal(adapter.hasPath(["active.json"]), true);
});

test("fresh stores reject missing or tampered receipt and catalog custody", async () => {
  const receiptAdapter = new MemoryAdapter();
  const receiptValue = fixture("stored-receipt");
  const receiptInstalled = await createStore(receiptAdapter).install({
    manifest: receiptValue.manifest,
    admissionAuthority: receiptValue.admissionAuthority,
    sources: sourceSet(receiptValue.members)
  });
  const receiptPath = [
    "installed",
    receiptInstalled.manifestSha256,
    "qualification-receipt.json"
  ];
  receiptAdapter.mutate(receiptPath, 11);
  await assert.rejects(
    createStore(receiptAdapter).openActive(),
    errorCode("model-composition-store-stored-qualification-receipt")
  );
  receiptAdapter.seedFile(
    receiptPath,
    Buffer.from(receiptValue.qualificationReceiptText, "utf8")
  );
  await receiptAdapter.removeEntry(receiptPath, { missingOk: false });
  await assert.rejects(
    createStore(receiptAdapter).openActive(),
    errorCode("model-composition-store-stored-qualification-receipt")
  );

  const catalogAdapter = new MemoryAdapter();
  const catalogValue = fixture("stored-catalog");
  const catalogInstalled = await createStore(catalogAdapter).install({
    manifest: catalogValue.manifest,
    admissionAuthority: catalogValue.admissionAuthority,
    sources: sourceSet(catalogValue.members)
  });
  const catalogPath = ["installed", catalogInstalled.manifestSha256, "catalog.json"];
  catalogAdapter.mutate(catalogPath, 13);
  await assert.rejects(
    createStore(catalogAdapter).openActive(),
    errorCode("model-composition-store-stored-catalog")
  );
  catalogAdapter.seedFile(catalogPath, Buffer.from(catalogValue.catalogText, "utf8"));
  await catalogAdapter.removeEntry(catalogPath, { missingOk: false });
  await assert.rejects(
    createStore(catalogAdapter).openActive(),
    errorCode("model-composition-store-stored-catalog")
  );
});

test("restart rejects missing or tampered P2P piece-set identity in the manifest", async () => {
  for (const mutation of ["missing", "tampered"]) {
    const adapter = new MemoryAdapter();
    const value = fixture(`stored-piece-set-${mutation}`);
    const installed = await createStore(adapter).install({
      manifest: value.manifest,
      admissionAuthority: value.admissionAuthority,
      sources: sourceSet(value.members)
    });
    const manifestPath = ["installed", installed.manifestSha256, "manifest.json"];
    const storedManifest = JSON.parse(adapter.readFile(manifestPath).toString("utf8"));
    if (mutation === "missing") {
      delete storedManifest.admissionAuthority.p2pPieceSetSha256;
    } else {
      storedManifest.admissionAuthority.p2pPieceSetSha256 =
        contentId("tampered-stored-piece-set");
    }
    adapter.seedFile(manifestPath, canonical(storedManifest));
    await assert.rejects(
      createStore(adapter).openActive(),
      errorCode("model-composition-store-installed-manifest")
    );
  }
});

test("an already active content address is immutable and sources are not consumed twice", async () => {
  const adapter = new MemoryAdapter();
  const store = createStore(adapter);
  const value = fixture("idempotent");
  const first = await store.install({
    manifest: value.manifest,
    admissionAuthority: value.admissionAuthority,
    sources: sourceSet(value.members)
  });
  const writesBefore = [...adapter.writeCount.entries()]
    .filter(([fileName]) => MEMBER_NAMES.some((name) => fileName.endsWith(`/${name}`)))
    .reduce((total, [, count]) => total + count, 0);
  const forbiddenSources = Object.fromEntries(MEMBER_NAMES.map((fileName) => [
    fileName,
    {
      async *[Symbol.asyncIterator]() {
        assert.fail(`source ${fileName} was consumed twice`);
      }
    }
  ]));

  const second = await store.install({
    manifest: value.manifest,
    admissionAuthority: value.admissionAuthority,
    sources: forbiddenSources
  });
  const writesAfter = [...adapter.writeCount.entries()]
    .filter(([fileName]) => MEMBER_NAMES.some((name) => fileName.endsWith(`/${name}`)))
    .reduce((total, [, count]) => total + count, 0);
  assert.equal(second.manifestSha256, first.manifestSha256);
  assert.equal(second.activationId, first.activationId);
  assert.equal(writesAfter, writesBefore);
});

test("authorizeCommit runs after candidate activation and immediately before pointer replacement", async () => {
  const adapter = new MemoryAdapter();
  const store = createStore(adapter);
  const prior = fixture("authorize-order-prior");
  await store.install({
    manifest: prior.manifest,
    admissionAuthority: prior.admissionAuthority,
    sources: sourceSet(prior.members)
  });
  const candidate = fixture("authorize-order-candidate");
  const operationStart = adapter.operations.length;
  let activationComplete = false;
  let authorizationCalls = 0;

  const installed = await store.install({
    manifest: candidate.manifest,
    admissionAuthority: candidate.admissionAuthority,
    sources: sourceSet(candidate.members),
    async activate() {
      activationComplete = true;
      adapter.operations.push({ type: "candidate-activation-complete" });
      return true;
    },
    async authorizeCommit() {
      authorizationCalls += 1;
      assert.equal(activationComplete, true);
      adapter.operations.push({ type: "commit-authorized" });
      return true;
    }
  });

  const operations = adapter.operations.slice(operationStart);
  const activationIndex = operations.findIndex((operation) =>
    operation.type === "candidate-activation-complete");
  const authorizationIndex = operations.findIndex((operation) =>
    operation.type === "commit-authorized");
  const pointerIndex = operations.findIndex((operation) =>
    operation.type === "atomic-write" && operation.path === "active.json");
  assert.equal(authorizationCalls, 1);
  assert.ok(activationIndex >= 0 && activationIndex < authorizationIndex);
  assert.equal(authorizationIndex + 1, pointerIndex);
  assert.equal((await store.openActive()).activationId, installed.activationId);
});

test("authorizeCommit rejection removes its candidate and preserves the prior active composition", async () => {
  const adapter = new MemoryAdapter();
  const store = createStore(adapter);
  const prior = fixture("authorize-rejection-prior");
  const installedPrior = await store.install({
    manifest: prior.manifest,
    admissionAuthority: prior.admissionAuthority,
    sources: sourceSet(prior.members)
  });
  const pointerBefore = adapter.readFile(["active.json"]);
  const candidate = fixture("authorize-rejection-candidate");
  const candidateManifestSha256 = sha256(canonical(candidate.manifest));
  const authorizationError = new Error("qualification changed before commit");
  const events = [];
  const operationStart = adapter.operations.length;
  let activationId = "";

  await assert.rejects(store.install({
    manifest: candidate.manifest,
    admissionAuthority: candidate.admissionAuthority,
    sources: sourceSet(candidate.members),
    async activate(storedCandidate) {
      activationId = storedCandidate.activationId;
      events.push("activated");
      return true;
    },
    async authorizeCommit() {
      events.push("authorization-rejected");
      throw authorizationError;
    }
  }));

  assert.deepEqual(events, ["activated", "authorization-rejected"]);
  assert.match(activationId, /^[0-9a-f]{64}$/u);
  assert.equal(
    adapter.operations.slice(operationStart).some((operation) =>
      operation.type === "atomic-write" && operation.path === "active.json"),
    false
  );
  assert.deepEqual(adapter.readFile(["active.json"]), pointerBefore);
  assert.equal(adapter.hasPath(["installed", installedPrior.manifestSha256]), true);
  assert.equal(adapter.hasPath(["installed", candidateManifestSha256]), false);
  assert.equal(adapter.hasPath(["staging", `${activationId}.json`]), false);
  assert.equal((await store.openActive()).manifestSha256, installedPrior.manifestSha256);
});

function assertIndeterminateActivation(error, activationId) {
  assert.ok(error instanceof storeApi.ModelCompositionStoreError);
  assert.equal(error.code, "model-composition-store-activation-indeterminate");
  assert.equal(error.commitDisposition, "indeterminate");
  assert.equal(error.activationId, activationId);
  return true;
}

test("post-commit staging cleanup requires observed absence before retiring prior bytes", async (t) => {
  const cases = [
    { name: "rejected deletion", deletion: "reject" },
    { name: "late abort after pointer commit", deletion: "reject", lateAbort: true },
    { name: "retained marker", deletion: "retain" },
    { name: "unreadable retained marker", deletion: "retain", unreadable: true },
    { name: "late deletion error with observed absence", deletion: "delete-then-reject" }
  ];
  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const controller = new AbortController();
      let faultArmed = false;
      let removalAttempts = 0;
      let absenceReads = 0;
      let activationId = "";
      let candidateFiles = null;
      const adapter = new MemoryAdapter({
        onAfterActiveWrite() {
          if (faultArmed && testCase.lateAbort) {
            controller.abort();
            throw new Error("injected late pointer fault before staging cleanup");
          }
        }
      });
      const snapshotInstalled = (manifestSha256) => new Map([...adapter.files.keys()]
        .filter((name) => name.startsWith(`installed/${manifestSha256}/`))
        .map((name) => [name, adapter.readFile(name.split("/"))]));
      const store = createStore(adapter);
      const fixtureId = testCase.name.replaceAll(" ", "-");
      const prior = fixture(`${fixtureId}-prior`);
      const installedPrior = await store.install({
        manifest: prior.manifest,
        admissionAuthority: prior.admissionAuthority,
        sources: sourceSet(prior.members)
      });
      const priorFiles = snapshotInstalled(installedPrior.manifestSha256);
      const candidate = fixture(`${fixtureId}-candidate`);
      const candidateManifestSha256 = sha256(canonical(candidate.manifest));
      const removeEntry = adapter.removeEntry.bind(adapter);
      adapter.removeEntry = async (pathParts, options) => {
        if (!faultArmed || key(pathParts) !== `staging/${activationId}.json`) {
          return removeEntry(pathParts, options);
        }
        removalAttempts += 1;
        if (testCase.deletion === "retain") return;
        if (testCase.deletion === "delete-then-reject") {
          await removeEntry(pathParts, options);
        }
        throw new Error("injected staging marker deletion failure");
      };
      const openReadable = adapter.openReadable.bind(adapter);
      adapter.openReadable = async (pathParts) => {
        if (faultArmed && removalAttempts > 0 &&
            key(pathParts) === `staging/${activationId}.json`) {
          absenceReads += 1;
          if (testCase.unreadable) {
            throw new Error("injected staging marker absence readback failure");
          }
        }
        return openReadable(pathParts);
      };

      let installed = null;
      let installationError = null;
      faultArmed = true;
      try {
        installed = await store.install({
          manifest: candidate.manifest,
          admissionAuthority: candidate.admissionAuthority,
          sources: sourceSet(candidate.members),
          signal: controller.signal,
          async activate(storedCandidate) {
            activationId = storedCandidate.activationId;
            candidateFiles = snapshotInstalled(storedCandidate.manifestSha256);
            return true;
          }
        });
      } catch (error) {
        installationError = error;
      } finally {
        faultArmed = false;
      }

      assert.equal(removalAttempts, 1);
      assert.equal(absenceReads, 1);
      assert.equal(controller.signal.aborted, testCase.lateAbort === true);
      const pointer = JSON.parse(adapter.readFile(["active.json"]).toString("utf8"));
      assert.equal(pointer.stagingId, activationId);
      assert.equal(pointer.manifestSha256, candidateManifestSha256);
      const markerPath = ["staging", `${activationId}.json`];
      if (testCase.deletion === "delete-then-reject") {
        assert.equal(installationError, null);
        assert.equal(installed.activationId, activationId);
        assert.equal(adapter.hasPath(markerPath), false);
        assert.equal(adapter.hasPath(["installed", installedPrior.manifestSha256]), false);
        const reopened = await createStore(adapter).openActive();
        assert.equal(reopened.activationId, activationId);
        assert.equal(reopened.manifestSha256, candidateManifestSha256);
        return;
      }

      assert.equal(installed, null);
      assertIndeterminateActivation(installationError, activationId);
      assert.ok(adapter.hasPath(markerPath));
      assert.ok(candidateFiles.size > 0 && priorFiles.size > 0);
      for (const snapshot of [priorFiles, candidateFiles]) {
        for (const [name, bytes] of snapshot) {
          assert.deepEqual(adapter.readFile(name.split("/")), bytes);
        }
      }
      const restarted = createStore(adapter);
      await assert.rejects(restarted.openActive(),
        (error) => assertIndeterminateActivation(error, activationId));
      await assert.rejects(restarted.cleanup(),
        (error) => assertIndeterminateActivation(error, activationId));
      assert.equal(await restarted.discardInvalidActive(), true);
      assert.equal(adapter.hasPath(["active.json"]), false);
      assert.equal(adapter.hasPath(markerPath), false);
      assert.equal(adapter.hasPath(["installed", candidateManifestSha256]), false);
      for (const [name, bytes] of priorFiles) {
        assert.deepEqual(adapter.readFile(name.split("/")), bytes);
      }
      assert.equal(await restarted.openActive(), null);
    });
  }
});

async function createIndeterminateActivation(label) {
  let faultArmed = false;
  let failExactReadback = false;
  let postWriteFaults = 0;
  let readbackFaults = 0;
  const adapter = new MemoryAdapter({
    onAfterActiveWrite() {
      if (!faultArmed || postWriteFaults > 0) return;
      postWriteFaults += 1;
      failExactReadback = true;
      throw new Error("injected fault after active pointer replacement");
    }
  });
  const openReadable = adapter.openReadable.bind(adapter);
  adapter.openReadable = async (pathParts) => {
    if (failExactReadback && key(pathParts) === "active.json") {
      failExactReadback = false;
      readbackFaults += 1;
      adapter.operations.push({ type: "open-readable-fault", path: "active.json" });
      throw new Error("injected exact active pointer readback failure");
    }
    return openReadable(pathParts);
  };

  const store = createStore(adapter);
  const prior = fixture(`${label}-prior`);
  const installedPrior = await store.install({
    manifest: prior.manifest,
    admissionAuthority: prior.admissionAuthority,
    sources: sourceSet(prior.members)
  });
  const pointerBefore = adapter.readFile(["active.json"]);
  const candidate = fixture(`${label}-candidate`);
  const candidateManifestSha256 = sha256(canonical(candidate.manifest));
  let activationId = "";
  let installationError = null;
  faultArmed = true;
  try {
    await assert.rejects(
      store.install({
        manifest: candidate.manifest,
        admissionAuthority: candidate.admissionAuthority,
        sources: sourceSet(candidate.members),
        async activate(storedCandidate) {
          activationId = storedCandidate.activationId;
          return true;
        },
        async authorizeCommit() {
          return true;
        }
      }),
      (error) => {
        installationError = error;
        return true;
      }
    );
  } finally {
    faultArmed = false;
  }

  return {
    activationId,
    adapter,
    candidateManifestSha256,
    installedPrior,
    installationError,
    pointerBefore,
    postWriteFaults,
    readbackFaults
  };
}

test("an unobservable exact readback after pointer replacement is persistently indeterminate", async () => {
  const scenario = await createIndeterminateActivation("indeterminate-restart");

  assertIndeterminateActivation(scenario.installationError, scenario.activationId);
  assert.match(scenario.activationId, /^[0-9a-f]{64}$/u);
  assert.equal(scenario.postWriteFaults, 1);
  assert.equal(scenario.readbackFaults, 1);
  assert.notDeepEqual(scenario.adapter.readFile(["active.json"]), scenario.pointerBefore);
  const pointer = JSON.parse(
    scenario.adapter.readFile(["active.json"]).toString("utf8")
  );
  assert.equal(pointer.stagingId, scenario.activationId);
  assert.equal(pointer.manifestSha256, scenario.candidateManifestSha256);
  const markerPath = ["staging", `${scenario.activationId}.json`];
  const markerBytes = scenario.adapter.readFile(markerPath);
  assert.ok(markerBytes);
  const marker = JSON.parse(markerBytes.toString("utf8"));
  assert.equal(marker.stagingId, scenario.activationId);
  assert.equal(marker.manifestSha256, scenario.candidateManifestSha256);
  assert.equal(
    scenario.adapter.hasPath(["installed", scenario.candidateManifestSha256]),
    true
  );
  assert.equal(
    scenario.adapter.hasPath(["installed", scenario.installedPrior.manifestSha256]),
    true
  );

  await assert.rejects(
    createStore(scenario.adapter).openActive(),
    (error) => assertIndeterminateActivation(error, scenario.activationId)
  );
  assert.equal(scenario.adapter.hasPath(markerPath), true);
  assert.equal(
    scenario.adapter.hasPath(["installed", scenario.candidateManifestSha256]),
    true
  );
});

test("discardInvalidActive explicitly removes an unresolved indeterminate activation", async () => {
  const scenario = await createIndeterminateActivation("indeterminate-discard");
  assertIndeterminateActivation(scenario.installationError, scenario.activationId);
  const markerPath = ["staging", `${scenario.activationId}.json`];

  assert.equal(await createStore(scenario.adapter).discardInvalidActive(), true);

  assert.equal(scenario.adapter.hasPath(["active.json"]), false);
  assert.equal(scenario.adapter.hasPath(markerPath), false);
  assert.equal(
    scenario.adapter.hasPath(["installed", scenario.candidateManifestSha256]),
    false
  );
  assert.equal(
    scenario.adapter.hasPath(["installed", scenario.installedPrior.manifestSha256]),
    true
  );
  assert.equal(await createStore(scenario.adapter).openActive(), null);
});
