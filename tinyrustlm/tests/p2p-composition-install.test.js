"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const admissionApi = require("../app/browser-model-admission.js");
const catalogApi = require("../app/minimodel-catalog-v1.js");
const installApi = require("../app/p2p-composition-install.js");

const sourcePath = path.resolve(__dirname, "../app/p2p-composition-install.js");
const STORE_MANIFEST_SCHEMA = "tinyrustlm.model-composition-store.manifest/2";
const ROLE_ORDER = ["model", "tokenizer", "template", "sampling", "prompt", "composition"];
const TEST_NOW = new Date(Math.floor(Date.now() / 1000) * 1000);
const utc = (offsetMilliseconds) =>
  new Date(TEST_NOW.getTime() + offsetMilliseconds).toISOString().replace(".000Z", "Z");
const PEER_KEY_PAIR = crypto.generateKeyPairSync("ed25519");
const PEER_PUBLIC_KEY = PEER_KEY_PAIR.publicKey
  .export({ type: "spki", format: "der" })
  .subarray(-32)
  .toString("base64url");

/** Returns the lowercase SHA-256 of exact fixture bytes. */
function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** Returns one deterministic unprefixed identity for metadata fixtures. */
function id(label) {
  return sha256(Buffer.from(label, "utf8"));
}

/** Produces synthetic non-model bytes for one member role. */
function memberBytes(role, byteLength) {
  const value = new Uint8Array(byteLength);
  const ordinal = ROLE_ORDER.indexOf(role) + 1;
  for (let index = 0; index < value.byteLength; index += 1) {
    value[index] = (ordinal * 29 + index * 17) & 0xff;
  }
  return value;
}

/** Builds one canonical admission, store manifest, and normalized peer-first entry. */
async function fixture(label = "fixture", options = {}) {
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
    memberBytes(role, lengths[role])
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
  const qualificationReceiptIdA = `sha256:${id(`qualification-receipt-id-A-${label}`)}`;
  const admission = admissionApi.normalizeAdmission({
    schema: admissionApi.schema,
    modelId: "Qwen/Qwen3-0.6B",
    operationId: id(`qualification-operation-${label}`),
    artifacts,
    composition: {
      graphIdentitySha256: id(`graph-${label}`),
      memberTableSha256: id(`member-table-${label}`),
      resolvedMemberBytes
    },
    qualification: {
      receiptId: qualificationReceiptIdA,
      sourceEvidenceSha256: id(`source-${label}`),
      structuralEvidenceSha256: id(`structural-${label}`),
      numericalEvidenceSha256: id(`numerical-${label}`),
      qualityEvidenceSha256: id(`quality-${label}`),
      evalCasesSha256: id(`eval-cases-${label}`),
      qualityClaim: "general-assistant-qualified",
      qualityScope: "general-assistant"
    },
    runtime: {
      workerProtocol: admissionApi.workerProtocol,
      wasmByteCount: 8,
      wasmSha256: id(`wasm-${label}`),
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
  const admissionSha256 = sha256(admissionBytes);
  const qualificationReceipt = Object.freeze({
    schema: "tinyrustlm.qualification-receipt/1",
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
    issuedAtUtc: utc(-2 * 60_000)
  });
  const qualificationReceiptText = `${JSON.stringify(qualificationReceipt)}\n`;
  const qualificationReceiptBytesSha256B = sha256(
    Buffer.from(qualificationReceiptText, "utf8")
  );
  const admissionRecord = Object.freeze({
    admission,
    admissionText,
    admissionSha256: `sha256:${admissionSha256}`,
    qualificationReceipt,
    qualificationReceiptText,
    qualificationReceiptSha256: `sha256:${qualificationReceiptBytesSha256B}`
  });
  const peerIds = [`peer/${label}/lane-a`, `peer/${label}/lane-z`];
  const compositionId = `sha256:${admission.composition.graphIdentitySha256}`;
  const catalogEntry = {
    entry_id: `qwen/${label}`,
    display_name: "Synthetic qualified fixture",
    description: "Synthetic metadata-only six-member test fixture.",
    source: {
      repository: "Qwen/Qwen3-0.6B",
      revision: "a".repeat(40),
      source_lock_sha256: `sha256:${id(`source-lock-${label}`)}`
    },
    license: {
      route: `/licenses/${label}.txt`,
      review_status: "reviewed"
    },
    composition: {
      composition_id: compositionId,
      member_count: 6,
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
      sha256: `sha256:${admissionSha256}`
    },
    profiles: {
      conversion: "tinyrustlm.converter.v1",
      quantization: "tinyrustlm.mixed-q8.v1",
      runtime: "tinyrustlm.browser.v1"
    },
    qualification: {
      status: "qualified",
      receipt_id: options.catalogQualificationReceiptId || qualificationReceiptIdA,
      receipt_route: `/catalog/qualification-receipts/${label}.json`,
      receipt_bytes: Buffer.byteLength(qualificationReceiptText, "utf8"),
      receipt_sha256: options.catalogQualificationReceiptSha256 ||
        `sha256:${qualificationReceiptBytesSha256B}`,
      numerical_status: "passed",
      browser_status: "passed",
      quality_status: "qualified"
    },
    peer_announcement_ids: peerIds
  };
  const catalog = {
    schema: catalogApi.CATALOG_SCHEMA,
    catalog_id: "minimodel.org/test-only",
    revision: 1,
    generated_at_utc: utc(-60_000),
    valid_until_utc: utc(60 * 60_000),
    project_server_serves_model_bytes: false,
    project_server_proxies_model_bytes: false,
    project_server_runs_inference: false,
    qualification_policy: "exact-current-evidence-required",
    qualification_receipt_schema: catalogApi.QUALIFICATION_RECEIPT_SCHEMA,
    browser_admission_schema: catalogApi.BROWSER_ADMISSION_SCHEMA,
    peer_verification_keys: [{
      key_id: `sha256:${id("peer-verification-key")}`,
      algorithm: "Ed25519",
      public_key_base64url: PEER_PUBLIC_KEY,
      not_before_utc: utc(-60 * 60_000),
      not_after_utc: utc(2 * 60 * 60_000)
    }],
    revoked_qualification_receipt_ids: [],
    supersessions: [],
    entries: [catalogEntry]
  };
  const announcements = [
    {
      announcement_id: peerIds[1],
      composition_id: compositionId,
      piece_set_sha256: `sha256:${id(`piece-set-z-${label}`)}`,
      peer_base_url: "https://9.9.9.9/",
      protocol_profile: installApi.protocolProfile,
      consent_status: "explicit",
      consent_receipt_sha256: `sha256:${id(`consent-z-${label}`)}`,
      outside_proof_status: "current-passed",
      outside_proof_receipt_sha256: `sha256:${id(`outside-z-${label}`)}`,
      issued_at_utc: utc(-60_000),
      expires_utc: options.peerAnnouncementExpiresUtc || utc(30 * 60_000),
      verification_key_id: `sha256:${id("peer-verification-key")}`,
      signature: Buffer.alloc(64).toString("base64url")
    },
    {
      announcement_id: peerIds[0],
      composition_id: compositionId,
      piece_set_sha256: `sha256:${id(`piece-set-a-${label}`)}`,
      peer_base_url: "https://1.1.1.1/",
      protocol_profile: installApi.protocolProfile,
      consent_status: "explicit",
      consent_receipt_sha256: `sha256:${id(`consent-a-${label}`)}`,
      outside_proof_status: "current-passed",
      outside_proof_receipt_sha256: `sha256:${id(`outside-a-${label}`)}`,
      issued_at_utc: utc(-60_000),
      expires_utc: options.peerAnnouncementExpiresUtc || utc(30 * 60_000),
      verification_key_id: `sha256:${id("peer-verification-key")}`,
      signature: Buffer.alloc(64).toString("base64url")
    }
  ];
  for (const announcement of announcements) {
    announcement.signature = crypto.sign(
      null,
      Buffer.from(catalogApi.peerAnnouncementSigningBytes(announcement)),
      PEER_KEY_PAIR.privateKey
    ).toString("base64url");
  }
  const peerFeed = {
    schema: catalogApi.PEER_SCHEMA,
    feed_id: "minimodel.org/test-only-peers",
    revision: 1,
    generated_at_utc: utc(-60_000),
    valid_until_utc: options.peerFeedValidUntilUtc || utc(60 * 60_000),
    project_server_serves_model_bytes: false,
    project_server_proxies_model_bytes: false,
    announcements
  };
  const [projectedEntry] = await catalogApi.buildVerifiedCatalogView(catalog, peerFeed, {
    now: TEST_NOW,
    crypto: crypto.webcrypto
  });
  const entry = Object.freeze({
    ...projectedEntry,
    peers: Object.freeze(projectedEntry.peers.map((peer) => Object.freeze({
      ...peer,
      feedValidUntilUtc: peerFeed.valid_until_utc
    })))
  });
  const catalogText = `${JSON.stringify(catalog)}\n`;
  const catalogBytes = Buffer.from(catalogText, "utf8");
  const catalogSha256 = sha256(catalogBytes);
  const admissionAuthority = Object.freeze({
    admissionText,
    qualificationReceiptText,
    catalogText,
    catalogAuthority: Object.freeze({
      id: catalog.catalog_id,
      revision: catalog.revision,
      generatedAtUtc: catalog.generated_at_utc,
      validUntilUtc: catalog.valid_until_utc,
      sha256: `sha256:${catalogSha256}`
    }),
    p2pPieceSetSha256: entry.peers[0].pieceSetSha256
  });
  const manifest = {
    schema: STORE_MANIFEST_SCHEMA,
    admissionAuthority: {
      admission: {
        byteLength: admissionBytes.byteLength,
        sha256: admissionSha256
      },
      qualificationReceipt: {
        byteLength: Buffer.byteLength(qualificationReceiptText, "utf8"),
        sha256: qualificationReceiptBytesSha256B
      },
      catalog: {
        byteLength: catalogBytes.byteLength,
        sha256: catalogSha256
      },
      p2pPieceSetSha256: entry.peers[0].pieceSetSha256
    },
    members: admission.artifacts.map((artifact) => ({
      fileName: artifact.fileName,
      byteLength: artifact.byteCount,
      sha256: artifact.sha256
    }))
  };
  return {
    admission,
    admissionRecord,
    admissionText,
    byRole,
    entry,
    manifest,
    admissionAuthority,
    qualificationReceiptIdA,
    qualificationReceiptBytesSha256B
  };
}

/** Creates one strict reader-backed response with configurable metadata drift. */
function memberResponse(url, fixtureValue, options = {}) {
  const fileName = new URL(url).pathname.split("/").at(-1);
  const artifact = fixtureValue.admission.artifacts.find(
    (candidate) => candidate.fileName === fileName
  );
  assert.ok(artifact, `known member URL ${url}`);
  const bytes = fixtureValue.byRole[artifact.role];
  const networkChunkBytes = options.networkChunkBytes === undefined
    ? Math.max(1, Math.ceil(bytes.byteLength / 3))
    : options.networkChunkBytes;
  assert.ok(Number.isSafeInteger(networkChunkBytes) && networkChunkBytes > 0);
  let chunkOffset = 0;
  let locked = false;
  let cancelled = false;
  const headers = new Map([
    ["content-length", String(artifact.byteCount)],
    ["content-type", "application/octet-stream"],
    ["x-tinyrustlm-composition-id", fixtureValue.entry.composition.compositionId],
    ["x-tinyrustlm-piece-set-id", fixtureValue.entry.peers[0].pieceSetSha256],
    ["x-tinyrustlm-member-name", artifact.fileName],
    ["x-tinyrustlm-member-id", `sha256:${artifact.sha256}`]
  ]);
  for (const [name, value] of Object.entries(options.headers || {})) {
    if (value === null) headers.delete(name.toLowerCase());
    else headers.set(name.toLowerCase(), String(value));
  }
  return {
    status: options.status === undefined ? 200 : options.status,
    redirected: options.redirected === undefined ? false : options.redirected,
    url: options.url || url,
    headers: {
      get(name) {
        return headers.get(name.toLowerCase()) ?? null;
      }
    },
    body: {
      getReader() {
        assert.equal(locked, false, "response body reader is acquired once");
        locked = true;
        return {
          async read() {
            if (cancelled || chunkOffset === bytes.byteLength) {
              return { done: true, value: undefined };
            }
            const value = bytes.subarray(
              chunkOffset,
              Math.min(bytes.byteLength, chunkOffset + networkChunkBytes)
            );
            chunkOffset += value.byteLength;
            if (options.onNetworkChunk) {
              options.onNetworkChunk(artifact.fileName, value.byteLength);
            }
            return { done: false, value };
          },
          async cancel(reason) {
            cancelled = true;
            if (options.cancel) return options.cancel(reason);
            return undefined;
          },
          releaseLock() {
            locked = false;
          }
        };
      }
    }
  };
}

class ConsumingStore {
  /** Creates one deterministic in-memory store observer. */
  constructor(options = {}) {
    this.options = options;
    this.calls = [];
    this.completedMembers = [];
    this.chunkCount = 0;
    this.chunks = [];
  }

  /** Consumes the exact async sources as the real store contract does. */
  async install(value) {
    this.calls.push(value);
    for (const member of value.manifest.members) {
      const hash = crypto.createHash("sha256");
      let byteLength = 0;
      for await (const chunk of value.sources[member.fileName]) {
        assert.ok(chunk instanceof Uint8Array);
        assert.ok(chunk.byteLength > 0);
        assert.ok(chunk.byteLength <= installApi.coalescedChunkBytes);
        hash.update(chunk);
        byteLength += chunk.byteLength;
        this.chunkCount += 1;
        this.chunks.push(Object.freeze({
          fileName: member.fileName,
          byteLength: chunk.byteLength
        }));
      }
      assert.equal(byteLength, member.byteLength, member.fileName);
      assert.equal(hash.digest("hex"), member.sha256, member.fileName);
      this.completedMembers.push(member.fileName);
      if (this.options.failAfterFirstMember && this.completedMembers.length === 1) {
        throw new Error("injected terminal store failure");
      }
    }
    if (this.options.onCommitted) await this.options.onCommitted();
    return this.options.result || Object.freeze({ status: "activated-test-fixture" });
  }
}

/** Builds one fetch observer for all exact synthetic member responses. */
function successfulFetch(fixtureValue, calls, responseOptions) {
  return async (url, options) => {
    calls.push({ url, options });
    const overrides = typeof responseOptions === "function"
      ? responseOptions(url, calls.length)
      : responseOptions;
    return memberResponse(url, fixtureValue, overrides);
  };
}

/** Runs one assertion while failing if the selected text reaches TextEncoder. */
async function assertTextNeverEncoded(targetText, operation) {
  const NativeTextEncoder = globalThis.TextEncoder;
  let targetEncodeCalls = 0;
  globalThis.TextEncoder = class GuardedTextEncoder {
    constructor() {
      this.encoder = new NativeTextEncoder();
    }

    encode(value) {
      if (value === targetText) {
        targetEncodeCalls += 1;
        throw new Error("guarded text reached TextEncoder");
      }
      return this.encoder.encode(value);
    }
  };
  try {
    await operation();
  } finally {
    globalThis.TextEncoder = NativeTextEncoder;
  }
  assert.equal(targetEncodeCalls, 0);
}

/** Runs one assertion while forbidding all JSON serialization and UTF-8 allocation. */
async function assertNoSerializationOrEncoding(operation) {
  const nativeStringify = JSON.stringify;
  const NativeTextEncoder = globalThis.TextEncoder;
  let stringifyCalls = 0;
  let encoderConstructions = 0;
  let encodeCalls = 0;
  JSON.stringify = function guardedStringify() {
    stringifyCalls += 1;
    throw new Error("guarded value reached JSON.stringify");
  };
  globalThis.TextEncoder = class GuardedTextEncoder {
    constructor() {
      encoderConstructions += 1;
    }

    encode() {
      encodeCalls += 1;
      throw new Error("guarded value reached TextEncoder");
    }
  };
  try {
    await operation();
  } finally {
    JSON.stringify = nativeStringify;
    globalThis.TextEncoder = NativeTextEncoder;
  }
  assert.equal(stringifyCalls, 0);
  assert.equal(encoderConstructions, 0);
  assert.equal(encodeCalls, 0);
}

test("streams six fixed URLs from exactly the first normalized peer", async () => {
  const value = await fixture("success");
  const calls = [];
  const progress = [];
  const store = new ConsumingStore();
  const activated = await installApi.installP2pComposition({
    entry: value.entry,
    admissionRecord: value.admissionRecord,
    manifest: value.manifest,
    admissionAuthority: value.admissionAuthority,
    store,
    fetch: successfulFetch(value, calls),
    onProgress(update) {
      assert.equal(Object.isFrozen(update), true);
      progress.push(update);
    }
  });

  assert.deepEqual(activated, { status: "activated-test-fixture" });
  assert.deepEqual(store.completedMembers, installApi.memberNames);
  assert.ok(store.chunkCount > installApi.memberNames.length);
  assert.equal(store.calls.length, 1);
  assert.deepEqual(store.calls[0].admissionAuthority, value.admissionAuthority);
  assert.deepEqual(store.calls[0].manifest, value.manifest);
  assert.equal(calls.length, 6);
  assert.equal(progress.length, store.chunkCount);
  assert.equal(progress.at(-1).completedBytes, value.manifest.members.reduce(
    (total, member) => total + member.byteLength,
    0
  ));
  assert.equal(progress.at(-1).totalBytes, progress.at(-1).completedBytes);
  assert.equal(progress.at(-1).memberName, "composition.acg2");
  const signals = new Set(calls.map((call) => call.options.signal));
  assert.equal(signals.size, 1, "all fetches share one cancellation signal");
  calls.forEach((call, index) => {
    assert.equal(
      call.url,
      `https://1.1.1.1${installApi.routePrefix}/compositions/` +
        `${value.entry.composition.compositionId}/members/${installApi.memberNames[index]}`
    );
    assert.deepEqual(
      {
        method: call.options.method,
        mode: call.options.mode,
        credentials: call.options.credentials,
        cache: call.options.cache,
        redirect: call.options.redirect,
        referrerPolicy: call.options.referrerPolicy
      },
      {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer"
      }
    );
    assert.equal(call.url.includes("operator/path"), false);
    assert.equal(call.url.includes("ignored=yes"), false);
    assert.equal(call.url.includes("9.9.9.9"), false);
  });
});

test("prechecks receipt and catalog UTF-16 lengths before their encoders", () => {
  const source = fs.readFileSync(sourcePath, "utf8").replace(/\r\n/gu, "\n");
  const admissionRecordStart = source.indexOf("  function normalizeAdmissionRecord(");
  const buildPlanStart = source.indexOf("  async function buildPlan(");
  const authorityStart = source.indexOf("  async function normalizeStoreAdmissionAuthority(");
  const authorityEnd = source.indexOf("\n  /**", authorityStart + 5);
  assert.ok(admissionRecordStart >= 0);
  assert.ok(buildPlanStart >= 0);
  assert.ok(authorityStart > buildPlanStart);
  assert.ok(authorityEnd > authorityStart);

  const admissionRecordSource = source.slice(admissionRecordStart, buildPlanStart);
  const receiptTextLimit = admissionRecordSource.indexOf(
    "value.qualificationReceiptText.length > MAXIMUM_QUALIFICATION_RECEIPT_BYTES"
  );
  const receiptNormalize = admissionRecordSource.indexOf(
    "normalizeQualificationReceipt(value.qualificationReceipt, admission)"
  );
  const receiptStringify = admissionRecordSource.indexOf("JSON.stringify(receipt)");
  assert.ok(receiptTextLimit >= 0);
  assert.ok(receiptTextLimit < receiptNormalize);
  assert.ok(receiptNormalize < receiptStringify);

  const buildPlanSource = source.slice(buildPlanStart, authorityStart);
  const buildReceiptGuard = buildPlanSource.indexOf(
    "precheckTextEncoding(\n      admissionRecord.qualificationReceiptText"
  );
  const buildReceiptEncode = buildPlanSource.indexOf(
    "textEncoder().encode(admissionRecord.qualificationReceiptText)"
  );
  assert.ok(buildReceiptGuard >= 0);
  assert.ok(buildReceiptGuard < buildReceiptEncode);
  assert.match(
    buildPlanSource.slice(buildReceiptGuard, buildReceiptEncode),
    /receiptDescriptor,\n\s+MAXIMUM_QUALIFICATION_RECEIPT_BYTES/u
  );

  const authoritySource = source.slice(authorityStart, authorityEnd);
  const receiptGuard = authoritySource.indexOf(
    "precheckTextEncoding(\n      value.qualificationReceiptText"
  );
  const catalogGuard = authoritySource.indexOf(
    "precheckTextEncoding(\n      value.catalogText"
  );
  const receiptEncode = authoritySource.indexOf(
    "textEncoder().encode(value.qualificationReceiptText)"
  );
  const catalogEncode = authoritySource.indexOf("textEncoder().encode(value.catalogText)");
  assert.ok(receiptGuard >= 0);
  assert.ok(receiptGuard < catalogGuard);
  assert.ok(catalogGuard < receiptEncode);
  assert.ok(receiptEncode < catalogEncode);
  assert.match(
    authoritySource.slice(receiptGuard, catalogGuard),
    /MAXIMUM_QUALIFICATION_RECEIPT_BYTES/u
  );
  assert.match(
    authoritySource.slice(catalogGuard, receiptEncode),
    /MAXIMUM_AUTHORITY_BYTES/u
  );
});

test("rejects receipt text longer than its descriptor before receipt encoding", async () => {
  const value = await fixture("receipt-utf16-precheck");
  const receiptDescriptor = value.manifest.admissionAuthority.qualificationReceipt;
  const manifest = {
    ...value.manifest,
    admissionAuthority: {
      ...value.manifest.admissionAuthority,
      qualificationReceipt: {
        ...receiptDescriptor,
        byteLength: receiptDescriptor.byteLength - 1
      }
    }
  };
  const qualificationReceiptText = value.admissionRecord.qualificationReceiptText;
  let fetchCalls = 0;
  let storeCalls = 0;
  assert.ok(qualificationReceiptText.length > manifest.admissionAuthority
    .qualificationReceipt.byteLength);

  await assertTextNeverEncoded(qualificationReceiptText, async () => {
    await assert.rejects(
      installApi.installP2pComposition({
        entry: value.entry,
        admissionRecord: value.admissionRecord,
        manifest,
        admissionAuthority: value.admissionAuthority,
        store: {
          async install() {
            storeCalls += 1;
          }
        },
        fetch: async () => {
          fetchCalls += 1;
          throw new Error("fetch must not run");
        }
      }),
      (error) => {
        assert.ok(error instanceof installApi.P2pCompositionInstallError);
        assert.equal(error.code, "p2p-composition-install-qualification-binding");
        return true;
      }
    );
  });
  assert.equal(storeCalls, 0);
  assert.equal(fetchCalls, 0);
});

test("rejects every oversized standalone receipt string before serialization", async (t) => {
  const value = await fixture("receipt-object-precheck");
  const receipt = value.admissionRecord.qualificationReceipt;
  const cases = [
    ["schema", `${receipt.schema}x`],
    ["receiptId", `${receipt.receiptId}x`],
    ["modelId", "m".repeat(161)],
    ["operationId", `${receipt.operationId}x`],
    ["compositionId", `${receipt.compositionId}x`],
    ["sourceEvidenceSha256", `${receipt.sourceEvidenceSha256}x`],
    ["structuralEvidenceSha256", `${receipt.structuralEvidenceSha256}x`],
    ["numericalEvidenceSha256", `${receipt.numericalEvidenceSha256}x`],
    ["qualityEvidenceSha256", `${receipt.qualityEvidenceSha256}x`],
    ["evalCasesSha256", `${receipt.evalCasesSha256}x`],
    ["qualityClaim", "q".repeat(65)],
    ["qualityScope", "s".repeat(257)],
    ["numericalStatus", `${receipt.numericalStatus}x`],
    ["browserStatus", `${receipt.browserStatus}x`],
    ["qualityStatus", `${receipt.qualityStatus}x`],
    ["issuedAtUtc", "x".repeat(128 * 1024 + 1)]
  ];

  for (const [field, hostileValue] of cases) {
    await t.test(field, async () => {
      const qualificationReceipt = Object.freeze({
        ...receipt,
        [field]: hostileValue
      });
      const admissionRecord = Object.freeze({
        ...value.admissionRecord,
        qualificationReceipt
      });
      let fetchCalls = 0;
      let storeCalls = 0;

      await assertNoSerializationOrEncoding(async () => {
        await assert.rejects(
          installApi.installP2pComposition({
            entry: value.entry,
            admissionRecord,
            manifest: value.manifest,
            admissionAuthority: value.admissionAuthority,
            store: {
              async install() {
                storeCalls += 1;
              }
            },
            fetch: async () => {
              fetchCalls += 1;
              throw new Error("fetch must not run");
            }
          }),
          (error) => {
            assert.ok(error instanceof installApi.P2pCompositionInstallError);
            assert.equal(error.code, "p2p-composition-install-qualification-record");
            return true;
          }
        );
      });
      assert.equal(storeCalls, 0);
      assert.equal(fetchCalls, 0);
    });
  }
});

test("rejects oversized catalog UTF-16 text before catalog encoding", async () => {
  const value = await fixture("catalog-utf16-precheck");
  const catalogText = "x".repeat(1024 * 1024 + 1);
  let fetchCalls = 0;
  let storeCalls = 0;
  assert.ok(catalogText.length > value.manifest.admissionAuthority.catalog.byteLength);

  await assertTextNeverEncoded(catalogText, async () => {
    await assert.rejects(
      installApi.installP2pComposition({
        entry: value.entry,
        admissionRecord: value.admissionRecord,
        manifest: value.manifest,
        admissionAuthority: Object.freeze({
          ...value.admissionAuthority,
          catalogText
        }),
        store: {
          async install() {
            storeCalls += 1;
          }
        },
        fetch: async () => {
          fetchCalls += 1;
          throw new Error("fetch must not run");
        }
      }),
      (error) => {
        assert.ok(error instanceof installApi.P2pCompositionInstallError);
        assert.equal(error.code, "p2p-composition-install-admission-authority");
        return true;
      }
    );
  });
  assert.equal(storeCalls, 0);
  assert.equal(fetchCalls, 0);
});

test("requires the exact peer-feed validity field before store or network use", async () => {
  const value = await fixture("missing-feed-validity");
  const firstPeer = { ...value.entry.peers[0] };
  delete firstPeer.feedValidUntilUtc;
  const entry = Object.freeze({
    ...value.entry,
    peers: Object.freeze([
      Object.freeze(firstPeer),
      ...value.entry.peers.slice(1)
    ])
  });
  let storeCalls = 0;
  let fetchCalls = 0;

  await assert.rejects(
    installApi.installP2pComposition({
      entry,
      admissionRecord: value.admissionRecord,
      manifest: value.manifest,
      admissionAuthority: value.admissionAuthority,
      store: {
        async install() {
          storeCalls += 1;
        }
      },
      fetch: async () => {
        fetchCalls += 1;
        throw new Error("fetch must not run");
      }
    }),
    (error) => {
      assert.ok(error instanceof installApi.P2pCompositionInstallError);
      assert.equal(error.code, "p2p-composition-install-peer");
      return true;
    }
  );
  assert.equal(storeCalls, 0);
  assert.equal(fetchCalls, 0);
});

test("rejects peer-feed expiry during admission handoff before member transfer", async () => {
  const value = await fixture("feed-expires-during-handoff", {
    peerFeedValidUntilUtc: utc(10 * 60_000),
    peerAnnouncementExpiresUtc: utc(10 * 60_000)
  });
  const nativeNow = Date.now;
  let now = TEST_NOW.getTime();
  let fetchCalls = 0;
  Date.now = () => now;

  try {
    await assert.rejects(
      installApi.installP2pComposition({
        entry: value.entry,
        admissionRecord: value.admissionRecord,
        manifest: value.manifest,
        admissionAuthority: value.admissionAuthority,
        store: {
          async install(options) {
            now = Date.parse(value.entry.peers[0].feedValidUntilUtc);
            for await (const _chunk of options.sources["model.slm2"]) {
              assert.fail("expired feed must emit no member bytes");
            }
            assert.fail("expired feed must reject the member source");
          }
        },
        fetch: async () => {
          fetchCalls += 1;
          throw new Error("fetch must not run");
        }
      }),
      (error) => {
        assert.ok(error instanceof installApi.P2pCompositionInstallError);
        assert.equal(error.code, "p2p-composition-install-peer-feed-expired");
        assert.equal(error.memberName, "model.slm2");
        return true;
      }
    );
  } finally {
    Date.now = nativeNow;
  }
  assert.equal(fetchCalls, 0);
});

test("coalesces one-byte network chunks before store writes and progress", async () => {
  const value = await fixture("one-byte-network-chunks");
  const calls = [];
  const progress = [];
  const store = new ConsumingStore();
  let networkChunkCount = 0;
  const totalBytes = value.manifest.members.reduce(
    (total, member) => total + member.byteLength,
    0
  );
  const expectedStoreChunks = value.manifest.members.reduce(
    (total, member) => total +
      Math.ceil(member.byteLength / installApi.coalescedChunkBytes),
    0
  );

  await installApi.installP2pComposition({
    entry: value.entry,
    admissionRecord: value.admissionRecord,
    manifest: value.manifest,
    admissionAuthority: value.admissionAuthority,
    store,
    fetch: successfulFetch(value, calls, {
      networkChunkBytes: 1,
      onNetworkChunk(_fileName, byteLength) {
        assert.equal(byteLength, 1);
        networkChunkCount += 1;
      }
    }),
    onProgress(update) {
      progress.push(update);
    }
  });

  assert.equal(networkChunkCount, totalBytes);
  assert.equal(store.chunkCount, expectedStoreChunks);
  assert.equal(progress.length, expectedStoreChunks);
  assert.ok(store.chunkCount * 1000 < networkChunkCount);
  for (const member of value.manifest.members) {
    const chunks = store.chunks.filter((chunk) => chunk.fileName === member.fileName);
    assert.equal(
      chunks.length,
      Math.ceil(member.byteLength / installApi.coalescedChunkBytes),
      member.fileName
    );
    chunks.slice(0, -1).forEach((chunk) => {
      assert.equal(chunk.byteLength, installApi.coalescedChunkBytes, member.fileName);
    });
    const tailBytes = member.byteLength % installApi.coalescedChunkBytes ||
      installApi.coalescedChunkBytes;
    assert.equal(chunks.at(-1).byteLength, tailBytes, member.fileName);
  }
  assert.equal(progress.at(-1).completedBytes, totalBytes);
  assert.equal(progress.at(-1).memberCompletedBytes, value.manifest.members.at(-1).byteLength);
});

test("binds qualification receipt identity A separately from receipt bytes digest B", async () => {
  const value = await fixture("qualification-a-b");
  const calls = [];
  const store = new ConsumingStore();

  assert.equal(value.entry.qualification.receiptId, value.qualificationReceiptIdA);
  assert.equal(
    value.admission.qualification.receiptId,
    value.qualificationReceiptIdA
  );
  assert.equal(
    value.entry.qualification.receiptSha256,
    `sha256:${value.qualificationReceiptBytesSha256B}`
  );
  assert.notEqual(
    value.qualificationReceiptIdA,
    value.entry.qualification.receiptSha256
  );

  await installApi.installP2pComposition({
    entry: value.entry,
    admissionRecord: value.admissionRecord,
    manifest: value.manifest,
    admissionAuthority: value.admissionAuthority,
    store,
    fetch: successfulFetch(value, calls)
  });

  assert.equal(calls.length, installApi.memberNames.length);
  assert.equal(store.calls.length, 1);
});

test("rejects qualification receipt identity or bytes-digest drift before fetch", async (t) => {
  const cases = [
    {
      name: "catalog receipt identity",
      label: "catalog-receipt-identity",
      options: {
        catalogQualificationReceiptId: `sha256:${id("qualification-receipt-id-wrong")}`
      }
    },
    {
      name: "catalog receipt bytes digest",
      label: "catalog-receipt-bytes-digest",
      options: (label) => ({
        catalogQualificationReceiptSha256:
          `sha256:${id(`qualification-receipt-id-A-${label}`)}`
      })
    }
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const label = `qualification-drift-${testCase.label}`;
      const options = typeof testCase.options === "function"
        ? testCase.options(label)
        : testCase.options;
      const value = await fixture(label, options);
      const store = new ConsumingStore();
      let fetchCalls = 0;
      await assert.rejects(
        installApi.installP2pComposition({
          entry: value.entry,
          admissionRecord: value.admissionRecord,
          manifest: value.manifest,
          admissionAuthority: value.admissionAuthority,
          store,
          fetch: async () => {
            fetchCalls += 1;
            throw new Error("fetch must not run");
          }
        }),
        (error) => {
          assert.ok(error instanceof installApi.P2pCompositionInstallError);
          assert.equal(error.code, "p2p-composition-install-qualification-binding");
          return true;
        }
      );
      assert.equal(fetchCalls, 0);
      assert.equal(store.calls.length, 0);
    });
  }
});

test("response status and identity metadata failures are typed and never try another peer", async (t) => {
  const cases = [
    {
      name: "status",
      options: { status: 206 },
      code: "p2p-composition-install-response-status"
    },
    {
      name: "content type",
      options: { headers: { "content-type": "application/json" } },
      code: "p2p-composition-install-response-metadata"
    },
    {
      name: "content length",
      options: { headers: { "content-length": "38" } },
      code: "p2p-composition-install-response-metadata"
    },
    {
      name: "composition identity",
      options: {
        headers: { "x-tinyrustlm-composition-id": `sha256:${"0".repeat(64)}` }
      },
      code: "p2p-composition-install-response-metadata"
    },
    {
      name: "piece set identity",
      options: {
        headers: { "x-tinyrustlm-piece-set-id": `sha256:${"2".repeat(64)}` }
      },
      code: "p2p-composition-install-response-metadata"
    },
    {
      name: "member identity",
      options: { headers: { "x-tinyrustlm-member-id": `sha256:${"1".repeat(64)}` } },
      code: "p2p-composition-install-response-metadata"
    }
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const value = await fixture(`response-${testCase.name.replaceAll(" ", "-")}`);
      const calls = [];
      const promise = installApi.installP2pComposition({
        entry: value.entry,
        admissionRecord: value.admissionRecord,
        manifest: value.manifest,
        admissionAuthority: value.admissionAuthority,
        store: new ConsumingStore(),
        fetch: successfulFetch(value, calls, (_url, callCount) =>
          callCount === 1 ? testCase.options : undefined)
      });
      await assert.rejects(promise, (error) => {
        assert.ok(error instanceof installApi.P2pCompositionInstallError);
        assert.equal(error.code, testCase.code);
        assert.equal(error.memberName, "model.slm2");
        return true;
      });
      assert.equal(calls.length, 1);
      assert.match(calls[0].url, /^https:\/\/1\.1\.1\.1\//u);
    });
  }
});

test("catalog, admission, and store identity drift fails before any fetch", async () => {
  const value = await fixture("binding-drift");
  value.manifest.members[2].sha256 = "0".repeat(64);
  let fetchCalls = 0;
  await assert.rejects(
    installApi.installP2pComposition({
      entry: value.entry,
      admissionRecord: value.admissionRecord,
      manifest: value.manifest,
      admissionAuthority: value.admissionAuthority,
      store: new ConsumingStore(),
      fetch: async () => {
        fetchCalls += 1;
        throw new Error("fetch must not run");
      }
    }),
    (error) => {
      assert.ok(error instanceof installApi.P2pCompositionInstallError);
      assert.equal(error.code, "p2p-composition-install-member-binding");
      assert.equal(error.memberName, "template.template2");
      return true;
    }
  );
  assert.equal(fetchCalls, 0);
});

test("metadata hashing stops on cancellation or deadline before store access", async (t) => {
  for (const digestOrdinal of [1, 2, 3, 4]) {
    for (const termination of ["cancel", "deadline"]) {
      for (const lateOutcome of ["resolve", "reject"]) {
        await t.test(`${digestOrdinal}/${termination}/${lateOutcome}`, async (t) => {
          const value = await fixture(`hash-${digestOrdinal}-${termination}-${lateOutcome}`);
          const parent = new AbortController();
          const store = new ConsumingStore();
          const fetchCalls = [];
          const entered = Promise.withResolvers();
          const held = Promise.withResolvers();
          const digest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
          const schedule = globalThis.setTimeout;
          let digestCalls = 0;
          let heldInput;
          let expire;
          let observationTimer;
          t.mock.method(globalThis.crypto.subtle, "digest", (algorithm, bytes) => {
            digestCalls += 1;
            if (digestCalls !== digestOrdinal) return digest(algorithm, bytes);
            heldInput = { algorithm, bytes };
            entered.resolve();
            return held.promise;
          });
          t.mock.method(globalThis, "setTimeout", (callback, delay, ...args) => {
            if (delay === 7777) expire = callback;
            return schedule(callback, delay, ...args);
          });
          const pending = installApi.installP2pComposition({
            entry: value.entry,
            admissionRecord: value.admissionRecord,
            manifest: value.manifest,
            admissionAuthority: value.admissionAuthority,
            store,
            fetch: successfulFetch(value, fetchCalls),
            signal: parent.signal,
            timeoutMilliseconds: 7777
          }).then(
            (result) => ({ kind: "resolved", result }),
            (error) => ({ kind: "rejected", error })
          );
          try {
            await entered.promise;
            assert.equal(typeof expire, "function");
            if (termination === "cancel") parent.abort();
            else expire();
            const observed = await Promise.race([
              pending,
              new Promise((resolve) => {
                observationTimer = schedule(() => resolve({ kind: "pending" }), 150);
              })
            ]);
            assert.equal(observed.kind, "rejected", "hash wait must end before digest settles");
            assert.equal(observed.error.code, termination === "cancel"
              ? "p2p-composition-install-aborted" : "p2p-composition-install-timeout");
            if (lateOutcome === "reject") held.reject(new Error("late digest failure"));
            else held.resolve(await digest(heldInput.algorithm, heldInput.bytes));
            await new Promise(setImmediate);
            assert.equal(digestCalls, digestOrdinal, "cancelled preparation starts no later hash");
            assert.equal(store.calls.length, 0);
            assert.equal(fetchCalls.length, 0);
            assert.equal(await pending, observed, "late completion preserves the terminal result");
          } finally {
            clearTimeout(observationTimer);
            held.reject(new Error("test cleanup"));
            await pending;
          }
        });
      }
    }
  }
});

test("a metadata digest failure stays a hash failure before store access", async (t) => {
  const value = await fixture("hash-failure");
  const store = new ConsumingStore();
  const fetchCalls = [];
  t.mock.method(globalThis.crypto.subtle, "digest", () => Promise.reject(new Error("hash failed")));
  await assert.rejects(installApi.installP2pComposition({
    entry: value.entry,
    admissionRecord: value.admissionRecord,
    manifest: value.manifest,
    admissionAuthority: value.admissionAuthority,
    store,
    fetch: successfulFetch(value, fetchCalls)
  }), { code: "p2p-composition-install-sha256" });
  assert.equal(store.calls.length, 0);
  assert.equal(fetchCalls.length, 0);
});

test("synchronous cancellation observes the digest's rejected promise", async (t) => {
  const value = await fixture("hash-synchronous-cancellation");
  const parent = new AbortController();
  const store = new ConsumingStore();
  const fetchCalls = [];
  t.mock.method(globalThis.crypto.subtle, "digest", () => {
    parent.abort();
    return Promise.reject(new Error("digest rejected after synchronous cancellation"));
  });
  await assert.rejects(installApi.installP2pComposition({
    entry: value.entry,
    admissionRecord: value.admissionRecord,
    manifest: value.manifest,
    admissionAuthority: value.admissionAuthority,
    store,
    fetch: successfulFetch(value, fetchCalls),
    signal: parent.signal
  }), { code: "p2p-composition-install-aborted" });
  await new Promise(setImmediate);
  assert.equal(store.calls.length, 0);
  assert.equal(fetchCalls.length, 0);
});

test("caller cancellation aborts the active fetch and remains terminal", async () => {
  const value = await fixture("cancel");
  const parent = new AbortController();
  const calls = [];
  let resolveFetchStarted;
  const fetchStarted = new Promise((resolve) => {
    resolveFetchStarted = resolve;
  });
  const fetch = (url, options) => {
    calls.push({ url, options });
    resolveFetchStarted();
    return new Promise((_resolve, rejectPromise) => {
      options.signal.addEventListener("abort", () => {
        rejectPromise(options.signal.reason || new Error("aborted"));
      }, { once: true });
    });
  };
  const promise = installApi.installP2pComposition({
    entry: value.entry,
    admissionRecord: value.admissionRecord,
    manifest: value.manifest,
    admissionAuthority: value.admissionAuthority,
    store: new ConsumingStore(),
    fetch,
    signal: parent.signal
  });
  await fetchStarted;
  assert.equal(calls.length, 1);
  parent.abort();
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof installApi.P2pCompositionInstallError);
    assert.equal(error.code, "p2p-composition-install-aborted");
    return true;
  });
  assert.equal(calls[0].options.signal.aborted, true);
  assert.equal(calls.length, 1, "cancellation does not advance or retry");
});

test("bounds a never-settling response reader cancellation", async () => {
  const value = await fixture("bounded-reader-cancel");
  const calls = [];
  let cancelCalls = 0;
  let cleanupCeilingCalls = 0;
  const nativeSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (callback, delay, ...args) => {
    if (delay === installApi.readerCancelTimeoutMilliseconds) {
      cleanupCeilingCalls += 1;
      return nativeSetTimeout(callback, 0, ...args);
    }
    return nativeSetTimeout(callback, delay, ...args);
  };

  try {
    await assert.rejects(
      installApi.installP2pComposition({
        entry: value.entry,
        admissionRecord: value.admissionRecord,
        manifest: value.manifest,
        admissionAuthority: value.admissionAuthority,
        store: new ConsumingStore(),
        fetch: successfulFetch(value, calls, (_url, callCount) =>
          callCount === 1
            ? {
                cancel() {
                  cancelCalls += 1;
                  return new Promise(() => {});
                }
              }
            : undefined),
        onProgress() {
          throw new Error("injected progress failure");
        }
      }),
      (error) => {
        assert.ok(error instanceof installApi.P2pCompositionInstallError);
        assert.equal(error.code, "p2p-composition-install-progress");
        return true;
      }
    );
  } finally {
    globalThis.setTimeout = nativeSetTimeout;
  }

  assert.equal(calls.length, 1);
  assert.equal(cancelCalls, 1);
  assert.equal(cleanupCeilingCalls, 1);
});

test("abort after the store commit returns the committed result without retry", async () => {
  const value = await fixture("post-commit-cancel");
  const parent = new AbortController();
  const calls = [];
  const committed = Object.freeze({ status: "committed-test-fixture" });
  const store = new ConsumingStore({
    result: committed,
    onCommitted() {
      parent.abort();
    }
  });

  const result = await installApi.installP2pComposition({
    entry: value.entry,
    admissionRecord: value.admissionRecord,
    manifest: value.manifest,
    admissionAuthority: value.admissionAuthority,
    store,
    fetch: successfulFetch(value, calls),
    signal: parent.signal
  });

  assert.equal(result, committed);
  assert.equal(parent.signal.aborted, true);
  assert.equal(calls.length, 6);
  assert.equal(new Set(calls.map((call) => call.options.signal)).size, 1);
  assert.equal(calls.every((call) => call.options.signal.aborted), true);
});

test("the bounded install timeout aborts the active fetch without retry", async () => {
  const value = await fixture("timeout");
  const calls = [];
  let resolveFetchStarted;
  const fetchStarted = new Promise((resolve) => {
    resolveFetchStarted = resolve;
  });
  const fetch = (url, options) => {
    calls.push({ url, options });
    resolveFetchStarted();
    return new Promise((_resolve, rejectPromise) => {
      options.signal.addEventListener("abort", () => {
        rejectPromise(options.signal.reason || new Error("timed out"));
      }, { once: true });
    });
  };
  const promise = installApi.installP2pComposition({
    entry: value.entry,
    admissionRecord: value.admissionRecord,
    manifest: value.manifest,
    admissionAuthority: value.admissionAuthority,
    store: new ConsumingStore(),
    fetch,
    timeoutMilliseconds: 100
  });
  await fetchStarted;
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof installApi.P2pCompositionInstallError);
    assert.equal(error.code, "p2p-composition-install-timeout");
    return true;
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.signal.aborted, true);
});

test("a store failure aborts the shared route and does not fall back", async () => {
  const value = await fixture("store-failure");
  const calls = [];
  const store = new ConsumingStore({ failAfterFirstMember: true });
  await assert.rejects(
    installApi.installP2pComposition({
      entry: value.entry,
      admissionRecord: value.admissionRecord,
      manifest: value.manifest,
      admissionAuthority: value.admissionAuthority,
      store,
      fetch: successfulFetch(value, calls)
    }),
    (error) => {
      assert.ok(error instanceof installApi.P2pCompositionInstallError);
      assert.equal(error.code, "p2p-composition-install-store");
      return true;
    }
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.signal.aborted, true);
  assert.match(calls[0].url, /^https:\/\/1\.1\.1\.1\//u);
});

test("publishes only the standalone UMD browser global", () => {
  const source = fs.readFileSync(sourcePath, "utf8");
  const context = {
    TinyRustLMBrowserModelAdmission: admissionApi,
    TinyRustLMMiniModelCatalogV1: catalogApi
  };
  vm.runInNewContext(source, context, { filename: sourcePath });
  assert.ok(context.TinyRustLMP2PCompositionInstall);
  assert.equal(
    typeof context.TinyRustLMP2PCompositionInstall.installP2pComposition,
    "function"
  );
  assert.equal(context.TinyRustLMP2PCompositionInstall.protocolProfile, installApi.protocolProfile);
  assert.ok(Object.isFrozen(context.TinyRustLMP2PCompositionInstall));
});
