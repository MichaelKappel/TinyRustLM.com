"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const admissionApi = require("../app/browser-model-admission.js");
const catalogApi = require("../app/minimodel-catalog-v1.js");
const companionInstallApi = require("../app/companion-composition-install.js");
const p2pInstallApi = require("../app/p2p-composition-install.js");
const storeApi = require("../app/model-composition-store.js");

const COMPANION_PROJECTION_SCHEMA =
  "tinyrustlm.companion.loopback.operation-projection.v2";
const MEMBER_NAMES = [...storeApi.memberNames];
const ROLE_ORDER = admissionApi.artifactSpecs.map((spec) => spec.role);
const COMPANION_ROLE_ORDER = [
  "composition", "model", "tokenizer", "template", "sampling", "prompt"
];
const TEST_NOW = new Date(Math.floor(Date.now() / 1000) * 1000);
const utc = (offsetMilliseconds) =>
  new Date(TEST_NOW.getTime() + offsetMilliseconds).toISOString().replace(".000Z", "Z");
const PEER_KEY_PAIR = crypto.generateKeyPairSync("ed25519");
const PEER_PUBLIC_KEY = PEER_KEY_PAIR.publicKey
  .export({ type: "spki", format: "der" })
  .subarray(-32)
  .toString("base64url");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function contentId(label) {
  return `sha256:${sha256(Buffer.from(label, "utf8"))}`;
}

function syntheticBytes(role, byteLength) {
  const value = new Uint8Array(byteLength);
  const ordinal = ROLE_ORDER.indexOf(role) + 1;
  for (let index = 0; index < value.byteLength; index += 1) {
    value[index] = (ordinal * 37 + index * 19) & 0xff;
  }
  return value;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

async function fixture(label) {
  const lengths = {
    model: 37,
    tokenizer: 43,
    template: 31,
    sampling: 65800,
    prompt: 512,
    composition: 896
  };
  const byRole = Object.fromEntries(ROLE_ORDER.map((role) => [
    role,
    syntheticBytes(role, lengths[role])
  ]));
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
  const admission = admissionApi.normalizeAdmission({
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
      receiptId: contentId(`receipt-${label}`),
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
  });
  const admissionText = admissionApi.serializeAdmission(admission);
  const admissionBytes = Buffer.from(admissionText, "utf8");
  const qualificationReceipt = Object.freeze({
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
  });
  const qualificationReceiptText = `${JSON.stringify(qualificationReceipt)}\n`;
  const qualificationReceiptBytes = Buffer.from(qualificationReceiptText, "utf8");
  const compositionId = `sha256:${admission.composition.graphIdentitySha256}`;
  const announcementId = `peer/${label}/lane-a`;
  const verificationKeyId = contentId(`peer-key-${label}`);
  const pieceSetSha256 = contentId(`piece-set-${label}`);
  const catalog = {
    schema: catalogApi.CATALOG_SCHEMA,
    catalog_id: `minimodel.org/cache-custody-${label}`,
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
      key_id: verificationKeyId,
      algorithm: "Ed25519",
      public_key_base64url: PEER_PUBLIC_KEY,
      not_before_utc: utc(-60 * 60 * 1000),
      not_after_utc: utc(2 * 60 * 60 * 1000)
    }],
    revoked_qualification_receipt_ids: [],
    supersessions: [],
    entries: [{
      entry_id: `qwen/${label}`,
      display_name: "Synthetic qualified Qwen fixture",
      description: "Small metadata-only cache-custody integration fixture.",
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
        composition_id: compositionId,
        member_count: MEMBER_NAMES.length,
        members: admission.artifacts.map((artifact, index) => ({
          name: artifact.fileName,
          bytes: artifact.byteCount,
          sha256: `sha256:${artifact.sha256}`,
          schema: `tinyrustlm.synthetic.member.${index + 1}.v1`
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
      peer_announcement_ids: [announcementId]
    }]
  };
  const catalogText = `${JSON.stringify(catalog)}\n`;
  const catalogBytes = Buffer.from(catalogText, "utf8");
  const catalogAuthority = Object.freeze({
    id: catalog.catalog_id,
    revision: catalog.revision,
    generatedAtUtc: catalog.generated_at_utc,
    validUntilUtc: catalog.valid_until_utc,
    sha256: `sha256:${sha256(catalogBytes)}`
  });
  const announcement = {
    announcement_id: announcementId,
    composition_id: compositionId,
    piece_set_sha256: pieceSetSha256,
    peer_base_url: "https://1.1.1.1/",
    protocol_profile: p2pInstallApi.protocolProfile,
    consent_status: "explicit",
    consent_receipt_sha256: contentId(`consent-${label}`),
    outside_proof_status: "current-passed",
    outside_proof_receipt_sha256: contentId(`outside-proof-${label}`),
    issued_at_utc: utc(-60 * 1000),
    expires_utc: utc(30 * 60 * 1000),
    verification_key_id: verificationKeyId,
    signature: Buffer.alloc(64).toString("base64url")
  };
  announcement.signature = crypto.sign(
    null,
    Buffer.from(catalogApi.peerAnnouncementSigningBytes(announcement)),
    PEER_KEY_PAIR.privateKey
  ).toString("base64url");
  const peerFeed = {
    schema: catalogApi.PEER_SCHEMA,
    feed_id: `minimodel.org/cache-custody-peers-${label}`,
    revision: 3,
    generated_at_utc: utc(-60 * 1000),
    valid_until_utc: utc(60 * 60 * 1000),
    project_server_serves_model_bytes: false,
    project_server_proxies_model_bytes: false,
    announcements: [announcement]
  };
  const [entry] = await catalogApi.buildVerifiedCatalogView(catalog, peerFeed, {
    now: TEST_NOW,
    crypto: crypto.webcrypto
  });
  assert.equal(entry.availability, "peer");
  assert.equal(entry.peers[0].pieceSetSha256, pieceSetSha256);

  const admissionRecord = Object.freeze({
    admission,
    admissionText,
    admissionSha256: `sha256:${sha256(admissionBytes)}`,
    qualificationReceipt,
    qualificationReceiptText,
    qualificationReceiptSha256: `sha256:${sha256(qualificationReceiptBytes)}`
  });
  const members = Object.fromEntries(admission.artifacts.map((artifact) => [
    artifact.fileName,
    byRole[artifact.role]
  ]));
  const authorityFor = (p2pPieceSetSha256) => deepFreeze({
    admissionText,
    qualificationReceiptText,
    catalogText,
    catalogAuthority: structuredClone(catalogAuthority),
    p2pPieceSetSha256
  });
  const manifestFor = (p2pPieceSetSha256) => deepFreeze({
    schema: storeApi.manifestSchema,
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
    members: admission.artifacts.map((artifact) => ({
      fileName: artifact.fileName,
      byteLength: artifact.byteCount,
      sha256: artifact.sha256
    }))
  });
  const projectedArtifacts = Object.fromEntries(COMPANION_ROLE_ORDER.map((role) => {
    const artifact = admission.artifacts.find((candidate) => candidate.role === role);
    return [role, {
      kind: artifact.format,
      artifactId: `sha256:${artifact.sha256}`,
      sha256: artifact.sha256,
      byteCount: artifact.byteCount
    }];
  }));
  const totalMemberBytes = admission.artifacts.reduce(
    (total, artifact) => total + artifact.byteCount,
    0
  );
  return {
    admission,
    admissionRecord,
    qualificationReceipt,
    qualificationReceiptText,
    catalog,
    catalogText,
    catalogAuthority,
    pieceSetSha256,
    entry,
    members,
    authorityFor,
    manifestFor,
    projection: deepFreeze({
      schema: COMPANION_PROJECTION_SCHEMA,
      operationId: sha256(Buffer.from(`acquisition-${label}`, "utf8")),
      sequence: 1,
      state: "available",
      route: "source",
      phaseCompletedBytes: totalMemberBytes,
      phaseTotalBytes: totalMemberBytes,
      artifacts: projectedArtifacts,
      errorCode: null
    })
  };
}

function sourceSet(members) {
  return Object.fromEntries(MEMBER_NAMES.map((fileName) => [
    fileName,
    {
      async *[Symbol.asyncIterator]() {
        yield members[fileName];
      }
    }
  ]));
}

function pathKey(parts) {
  return parts.join("/");
}

function parentKeys(parts) {
  const values = [""];
  for (let index = 1; index <= parts.length; index += 1) {
    values.push(pathKey(parts.slice(0, index)));
  }
  return values;
}

class MemoryAdapter {
  constructor() {
    this.directories = new Set([""]);
    this.files = new Map();
    this.randomCounter = 0;
    this.lockTail = Promise.resolve();
  }

  async withExclusiveLock(callback) {
    const prior = this.lockTail;
    let release;
    this.lockTail = new Promise((resolve) => {
      release = resolve;
    });
    await prior;
    try {
      return await callback();
    } finally {
      release();
    }
  }

  // Match the production composition lease using Node's shared/exclusive lock manager.
  withCompositionLock(identity, mode, callback, signal) {
    this.compositionLockPrefix ||= crypto.randomUUID();
    return require("node:worker_threads").locks.request(`${this.compositionLockPrefix}:${identity}`,
      { mode, ...(signal ? { signal } : {}) }, callback);
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
      .update(`cache-custody-staging-${this.randomCounter}`)
      .digest().subarray(0, length));
  }

  async ensureDirectory(parts) {
    for (const directory of parentKeys(parts)) this.directories.add(directory);
  }

  async listEntries(parts, limit) {
    const parent = pathKey(parts);
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
    return [...children]
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, limit)
      .map(([name, kind]) => ({ name, kind }));
  }

  async removeEntry(parts, options = {}) {
    const target = pathKey(parts);
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
  }

  async openReadable(parts) {
    const chunks = this.files.get(pathKey(parts));
    if (!chunks) return null;
    return {
      byteLength: chunks.reduce((total, chunk) => total + chunk.byteLength, 0),
      stream: {
        async *[Symbol.asyncIterator]() {
          for (const chunk of chunks) yield chunk;
        }
      }
    };
  }

  async openWritable(parts) {
    const fileName = pathKey(parts);
    const chunks = [];
    let terminal = false;
    return {
      write: async (value) => {
        assert.equal(terminal, false);
        assert.ok(value instanceof Uint8Array);
        chunks.push(Uint8Array.from(value));
      },
      close: async () => {
        assert.equal(terminal, false);
        terminal = true;
        for (const directory of parentKeys(parts.slice(0, -1))) {
          this.directories.add(directory);
        }
        this.files.set(fileName, chunks);
      },
      abort: async () => {
        terminal = true;
      }
    };
  }

  async atomicWrite(parts, value) {
    for (const directory of parentKeys(parts.slice(0, -1))) {
      this.directories.add(directory);
    }
    this.files.set(pathKey(parts), [Uint8Array.from(value)]);
  }

  mutate(parts, offset = 0) {
    const chunks = this.files.get(pathKey(parts));
    assert.ok(chunks, `expected stored file ${pathKey(parts)}`);
    let remaining = offset;
    for (const chunk of chunks) {
      if (remaining < chunk.byteLength) {
        chunk[remaining] ^= 0xff;
        return;
      }
      remaining -= chunk.byteLength;
    }
    assert.fail("mutation offset exceeded stored file length");
  }
}

function createStore(adapter) {
  return storeApi.createModelCompositionStore({
    adapter,
    chunkBytes: 4096,
    maximumCompositionBytes: 1024 * 1024,
    maximumStagingEntries: 8,
    cleanupLimit: 8
  });
}

function currentDisposition(opened) {
  return catalogApi.qualificationDisposition(
    opened.admissionAuthority.catalogDocument,
    opened.admissionAuthority.admission,
    { now: TEST_NOW }
  );
}

function activationStore(store, expectedAuthority, observation) {
  return Object.freeze({
    async install(value) {
      assert.deepEqual(value.admissionAuthority, expectedAuthority);
      return store.install({
        ...value,
        async activate(candidate) {
          observation.count += 1;
          const disposition = currentDisposition(candidate);
          assert.equal(disposition.status, "current");
          assert.equal(
            disposition.receiptId,
            candidate.admissionAuthority.qualificationReceipt.receiptId
          );
          return true;
        },
        async authorizeCommit(candidate) {
          assert.equal(currentDisposition(candidate).status, "current");
          return true;
        }
      });
    }
  });
}

async function collect(iterable) {
  const chunks = [];
  for await (const chunk of iterable) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function assertCustody(opened, value, authority, manifest) {
  assert.ok(opened);
  assert.deepEqual(opened.manifest, manifest);
  assert.equal(opened.admissionAuthority.admissionText, authority.admissionText);
  assert.deepEqual(opened.admissionAuthority.admission, value.admission);
  assert.equal(
    opened.admissionAuthority.qualificationReceiptText,
    authority.qualificationReceiptText
  );
  assert.deepEqual(
    opened.admissionAuthority.qualificationReceipt,
    value.qualificationReceipt
  );
  assert.equal(opened.admissionAuthority.catalogText, authority.catalogText);
  assert.deepEqual(opened.admissionAuthority.catalogDocument, value.catalog);
  assert.deepEqual(opened.admissionAuthority.catalogAuthority, authority.catalogAuthority);
  assert.equal(
    opened.admissionAuthority.p2pPieceSetSha256,
    authority.p2pPieceSetSha256
  );
  assert.equal(Object.isFrozen(opened), true);
  assert.equal(Object.isFrozen(opened.manifest), true);
  assert.equal(Object.isFrozen(opened.admissionAuthority), true);
  assert.equal(Object.isFrozen(opened.admissionAuthority.admission), true);
  assert.equal(Object.isFrozen(opened.admissionAuthority.qualificationReceipt), true);
  assert.equal(Object.isFrozen(opened.admissionAuthority.catalogDocument), true);
  assert.equal(Object.isFrozen(opened.admissionAuthority.catalogAuthority), true);
  const disposition = currentDisposition(opened);
  assert.equal(disposition.status, "current");
  assert.equal(disposition.reason, "current");
  for (const fileName of MEMBER_NAMES) {
    assert.deepEqual(await collect(opened.streamMember(fileName)), Buffer.from(value.members[fileName]));
  }
}

function memberResponse(url, value) {
  const fileName = new URL(url).pathname.split("/").at(-1);
  const artifact = value.admission.artifacts.find(
    (candidate) => candidate.fileName === fileName
  );
  assert.ok(artifact, `known P2P member URL ${url}`);
  let read = false;
  const headers = new Map([
    ["content-length", String(artifact.byteCount)],
    ["content-type", "application/octet-stream"],
    ["x-tinyrustlm-composition-id", value.entry.composition.compositionId],
    ["x-tinyrustlm-piece-set-id", value.pieceSetSha256],
    ["x-tinyrustlm-member-name", fileName],
    ["x-tinyrustlm-member-id", `sha256:${artifact.sha256}`]
  ]);
  return {
    status: 200,
    redirected: false,
    url,
    headers: {
      get(name) {
        return headers.get(name.toLowerCase()) ?? null;
      }
    },
    body: {
      getReader() {
        return {
          async read() {
            if (read) return { done: true, value: undefined };
            read = true;
            return { done: false, value: value.members[fileName] };
          },
          async cancel() {},
          releaseLock() {}
        };
      }
    }
  };
}

class SyntheticCompanionClient {
  constructor(value) {
    this.value = value;
  }

  async getArtifactChunk(operationId, role, chunkIndex) {
    assert.equal(operationId, this.value.projection.operationId);
    assert.equal(chunkIndex, 0);
    const artifact = this.value.projection.artifacts[role];
    const bytes = this.value.members[artifactRoleFileName(role)];
    return Object.freeze({
      bytes,
      metadata: Object.freeze({
        operationId,
        artifactRole: role,
        artifactId: artifact.artifactId,
        artifactSha256: artifact.sha256,
        artifactBytes: artifact.byteCount,
        chunkIndex: 0,
        chunkCount: 1,
        chunkOffset: 0,
        chunkBytes: bytes.byteLength
      }),
      contentSha256: sha256(bytes)
    });
  }
}

function artifactRoleFileName(role) {
  const spec = admissionApi.artifactSpecs.find((candidate) => candidate.role === role);
  assert.ok(spec);
  return spec.fileName;
}

function storeError(code) {
  return (error) => {
    assert.ok(error instanceof storeApi.ModelCompositionStoreError);
    assert.equal(error.code, code);
    return true;
  };
}

async function installDirect(value, pieceSetSha256, observation) {
  const adapter = new MemoryAdapter();
  const store = createStore(adapter);
  const authority = value.authorityFor(pieceSetSha256);
  const manifest = value.manifestFor(pieceSetSha256);
  const installed = await store.install({
    manifest,
    admissionAuthority: authority,
    sources: sourceSet(value.members),
    async activate(candidate) {
      observation.count += 1;
      assert.equal(currentDisposition(candidate).status, "current");
      return true;
    },
    async authorizeCommit(candidate) {
      assert.equal(currentDisposition(candidate).status, "current");
      return true;
    }
  });
  return { adapter, authority, installed, manifest };
}

test("P2P custody shape persists exact authority and reopens from a fresh store", async () => {
  const value = await fixture("direct-p2p");
  const activation = { count: 0 };
  const result = await installDirect(value, value.pieceSetSha256, activation);
  assert.equal(activation.count, 1);
  await assertCustody(result.installed, value, result.authority, result.manifest);

  const reopened = await createStore(result.adapter).openActive();
  await assertCustody(reopened, value, result.authority, result.manifest);
});

test("companion custody shape persists exact authority with an explicit null piece set", async () => {
  const value = await fixture("direct-companion");
  const activation = { count: 0 };
  const result = await installDirect(value, null, activation);
  assert.equal(activation.count, 1);
  await assertCustody(result.installed, value, result.authority, result.manifest);

  const reopened = await createStore(result.adapter).openActive();
  await assertCustody(reopened, value, result.authority, result.manifest);
});

test("real P2P installer carries frozen custody through the real store and restart", async () => {
  const value = await fixture("installer-p2p");
  const authority = value.authorityFor(value.pieceSetSha256);
  const manifest = value.manifestFor(value.pieceSetSha256);
  const adapter = new MemoryAdapter();
  const activation = { count: 0 };
  const fetchCalls = [];
  const installed = await p2pInstallApi.installP2pComposition({
    entry: value.entry,
    admissionRecord: value.admissionRecord,
    manifest,
    admissionAuthority: authority,
    store: activationStore(createStore(adapter), authority, activation),
    async fetch(url, options) {
      fetchCalls.push({ url, options });
      return memberResponse(url, value);
    }
  });

  assert.equal(activation.count, 1);
  assert.equal(fetchCalls.length, MEMBER_NAMES.length);
  await assertCustody(installed, value, authority, manifest);
  await assertCustody(await createStore(adapter).openActive(), value, authority, manifest);
});

test("real companion installer carries frozen custody through the real store and restart", async () => {
  const value = await fixture("installer-companion");
  const authority = value.authorityFor(null);
  const manifest = value.manifestFor(null);
  const adapter = new MemoryAdapter();
  const activation = { count: 0 };
  const installed = await companionInstallApi.installCompanionComposition({
    client: new SyntheticCompanionClient(value),
    store: activationStore(createStore(adapter), authority, activation),
    projection: value.projection,
    admission: value.admission,
    manifest,
    admissionAuthority: authority
  });

  assert.equal(activation.count, 1);
  await assertCustody(installed, value, authority, manifest);
  await assertCustody(await createStore(adapter).openActive(), value, authority, manifest);
});

test("tampered receipt, catalog authority, or piece-set custody never reaches activation", async (t) => {
  const cases = [
    {
      name: "qualification receipt bytes",
      expectedCode: "model-composition-store-qualification-receipt",
      mutate(value, authority) {
        return {
          ...authority,
          qualificationReceiptText: authority.qualificationReceiptText.replace(
            value.qualificationReceipt.receiptId,
            contentId("tampered-receipt")
          )
        };
      }
    },
    {
      name: "catalog authority revision",
      expectedCode: "model-composition-store-catalog-authority",
      mutate(_value, authority) {
        return {
          ...authority,
          catalogAuthority: {
            ...authority.catalogAuthority,
            revision: authority.catalogAuthority.revision + 1
          }
        };
      }
    },
    {
      name: "P2P piece-set identity",
      expectedCode: "model-composition-store-admission-authority",
      mutate(_value, authority) {
        return { ...authority, p2pPieceSetSha256: contentId("wrong-piece-set") };
      }
    }
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const fixtureLabel = testCase.name.toLowerCase().replace(/[^a-z0-9]+/gu, "-");
      const value = await fixture(`tamper-${fixtureLabel}`);
      const pieceSetSha256 = value.pieceSetSha256;
      const manifest = value.manifestFor(pieceSetSha256);
      const authority = value.authorityFor(pieceSetSha256);
      const activation = { count: 0 };
      await assert.rejects(
        createStore(new MemoryAdapter()).install({
          manifest,
          admissionAuthority: testCase.mutate(value, authority),
          sources: sourceSet(value.members),
          async activate() {
            activation.count += 1;
            return true;
          },
          async authorizeCommit() {
            return true;
          }
        }),
        storeError(testCase.expectedCode)
      );
      assert.equal(activation.count, 0);
    });
  }
});

test("restart rejects stored qualification tampering before modeled worker activation", async () => {
  const value = await fixture("restart-tamper");
  const firstActivation = { count: 0 };
  const result = await installDirect(value, value.pieceSetSha256, firstActivation);
  assert.equal(firstActivation.count, 1);
  result.adapter.mutate([
    "installed",
    result.installed.manifestSha256,
    "qualification-receipt.json"
  ], 16);

  const workerActivation = { count: 0 };
  await assert.rejects(
    (async () => {
      const reopened = await createStore(result.adapter).openActive();
      workerActivation.count += 1;
      assert.equal(currentDisposition(reopened).status, "current");
    })(),
    storeError("model-composition-store-stored-qualification-receipt")
  );
  assert.equal(workerActivation.count, 0);
});
