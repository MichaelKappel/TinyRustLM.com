"use strict";

const crypto = require("node:crypto");
const { createOwnedBrowserProfile, removeOwnedBrowserProfile } = require("./owned-browser-profile.js");
const { chromium, expect, test } = require("@playwright/test");

const admissionApi = require("../app/browser-model-admission.js");
const catalogApi = require("../app/minimodel-catalog-v1.js");

const OPFS_ROOT_NAME = "tinyrustlm-model-compositions-v2";
const LOCK_NAME = "tinyrustlm-model-compositions-v2-writer";
const MANIFEST_SCHEMA = "tinyrustlm.model-composition-store.manifest/2";
const POINTER_SCHEMA = "tinyrustlm.model-composition-store.active-pointer/2";
const TEST_ONLY_CLASSIFICATION = "test-only-never-live";
const TEST_ONLY_SCOPE = "test-only/never-live/e2e/composition-cache";
const FIXTURE_NOW = new Date(Math.floor(Date.now() / 1000) * 1000);
const MEMBER_NAMES = admissionApi.artifactSpecs.map((spec) => spec.fileName);
const RUNTIME_SCRIPTS = [
  "browser-model-admission.js",
  "minimodel-catalog-v1.js",
  "incremental-sha256.js",
  "model-composition-store.js"
];

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function contentId(value) {
  return `sha256:${sha256(Buffer.from(value, "utf8"))}`;
}

function fixtureUtc(offsetMilliseconds) {
  return new Date(FIXTURE_NOW.getTime() + offsetMilliseconds)
    .toISOString()
    .replace(".000Z", "Z");
}

function syntheticBytes(label, byteLength) {
  const value = Buffer.allocUnsafe(byteLength);
  const seed = Buffer.from(`test-only:${label}`, "utf8");
  for (let index = 0; index < value.length; index += 1) {
    value[index] = (seed[index % seed.length] + index * 29 + (index >>> 3)) & 0xff;
  }
  return value;
}

function createSyntheticFixture(label, modelByteLength) {
  const lengths = [modelByteLength, 211, 157, 65800, 512, 896];
  const memberBuffers = Object.fromEntries(MEMBER_NAMES.map((fileName, index) => [
    fileName,
    syntheticBytes(`${label}:${fileName}`, lengths[index])
  ]));
  const artifacts = admissionApi.artifactSpecs.map((spec) => ({
    role: spec.role,
    format: spec.format,
    fileName: spec.fileName,
    byteCount: memberBuffers[spec.fileName].byteLength,
    sha256: sha256(memberBuffers[spec.fileName]),
    formatProfileSha256: spec.profileSha256
  }));
  const resolvedMemberBytes = artifacts.slice(0, 5)
    .reduce((total, artifact) => total + artifact.byteCount, 0);
  const residentDependencyBytes = artifacts.slice(1, 5)
    .reduce((total, artifact) => total + artifact.byteCount, 0);
  const admission = {
    schema: admissionApi.schema,
    modelId: `test-only/composition-cache-${label}`,
    operationId: sha256(Buffer.from(`test-only-operation:${label}`, "utf8")),
    artifacts,
    composition: {
      graphIdentitySha256: sha256(Buffer.from(`test-only-graph:${label}`, "utf8")),
      memberTableSha256: sha256(Buffer.from(`test-only-members:${label}`, "utf8")),
      resolvedMemberBytes
    },
    qualification: {
      receiptId: `sha256:${sha256(Buffer.from(`test-only-receipt:${label}`, "utf8"))}`,
      sourceEvidenceSha256: sha256(Buffer.from(`test-only-source:${label}`, "utf8")),
      structuralEvidenceSha256: sha256(Buffer.from(`test-only-structure:${label}`, "utf8")),
      numericalEvidenceSha256: sha256(Buffer.from(`test-only-numerical:${label}`, "utf8")),
      qualityEvidenceSha256: sha256(Buffer.from(`test-only-quality:${label}`, "utf8")),
      evalCasesSha256: sha256(Buffer.from(`test-only-evals:${label}`, "utf8")),
      qualityClaim: "task-specific-qualified",
      qualityScope: TEST_ONLY_SCOPE
    },
    runtime: {
      workerProtocol: admissionApi.workerProtocol,
      wasmByteCount: 8,
      wasmSha256: sha256(Buffer.from(`test-only-wasm:${label}`, "utf8")),
      policy: {
        maximumModelBytes: modelByteLength,
        maximumSequenceTokens: 128,
        maximumKvBytes: 1024 * 1024,
        maximumScratchBytes: 1024 * 1024,
        maximumResolvedMemberBytes: resolvedMemberBytes,
        maximumResidentDependencyBytes: residentDependencyBytes,
        maximumRequestBytes: 1_054_848,
        maximumLinearMemoryBytes: 64 * 1024 * 1024
      },
      defaultSampling: {
        temperatureMillionths: 600_000,
        topK: 20,
        topPMillionths: 950_000,
        repetitionPenaltyMillionths: 1_000_000,
        repetitionWindow: 32,
        maximumNewTokens: 64
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
    issuedAtUtc: fixtureUtc(-2 * 60 * 1000)
  };
  const qualificationReceiptText = `${JSON.stringify(qualificationReceipt)}\n`;
  const qualificationReceiptBytes = Buffer.from(qualificationReceiptText, "utf8");
  const catalog = {
    schema: catalogApi.CATALOG_SCHEMA,
    catalog_id: "test-only/composition-cache",
    revision: Number.parseInt(
      sha256(Buffer.from(`test-only-catalog-revision:${label}`, "utf8")).slice(0, 8),
      16
    ) + 1,
    generated_at_utc: fixtureUtc(-60 * 1000),
    valid_until_utc: fixtureUtc(60 * 60 * 1000),
    project_server_serves_model_bytes: false,
    project_server_proxies_model_bytes: false,
    project_server_runs_inference: false,
    qualification_policy: "exact-current-evidence-required",
    qualification_receipt_schema: catalogApi.QUALIFICATION_RECEIPT_SCHEMA,
    browser_admission_schema: catalogApi.BROWSER_ADMISSION_SCHEMA,
    peer_verification_keys: [],
    revoked_qualification_receipt_ids: [],
    supersessions: [],
    entries: [{
      entry_id: `test-only/composition-cache-${label}`,
      display_name: `Synthetic composition cache ${label}`,
      description: "Synthetic browser-cache fixture; never eligible as a live model.",
      source: {
        repository: admission.modelId,
        revision: sha256(Buffer.from(`test-only-revision:${label}`, "utf8")).slice(0, 40),
        source_lock_sha256: contentId(`test-only-source-lock:${label}`)
      },
      license: {
        route: `/test-only/licenses/composition-cache-${label}.txt`,
        review_status: "reviewed"
      },
      composition: {
        composition_id: `sha256:${admission.composition.graphIdentitySha256}`,
        member_count: MEMBER_NAMES.length,
        members: MEMBER_NAMES.map((fileName, index) => ({
          name: fileName,
          bytes: memberBuffers[fileName].byteLength,
          sha256: `sha256:${sha256(memberBuffers[fileName])}`,
          schema: `test-only.tinyrustlm.member.${index + 1}.v1`
        }))
      },
      browser_admission: {
        route: `/test-only/catalog/browser-admissions/composition-cache-${label}.json`,
        bytes: admissionBytes.byteLength,
        sha256: `sha256:${sha256(admissionBytes)}`
      },
      profiles: {
        conversion: "test-only.tinyrustlm.converter.v1",
        quantization: "test-only.tinyrustlm.mixed-q8.v1",
        runtime: "test-only.tinyrustlm.browser.v1"
      },
      qualification: {
        status: "qualified",
        receipt_id: qualificationReceipt.receiptId,
        receipt_route: `/test-only/catalog/qualification-receipts/composition-cache-${label}.json`,
        receipt_bytes: qualificationReceiptBytes.byteLength,
        receipt_sha256: `sha256:${sha256(qualificationReceiptBytes)}`,
        numerical_status: "passed",
        browser_status: "passed",
        quality_status: "qualified"
      },
      peer_announcement_ids: []
    }]
  };
  const catalogText = `${JSON.stringify(catalog)}\n`;
  const catalogBytes = Buffer.from(catalogText, "utf8");
  catalogApi.validateCatalog(catalog, { now: FIXTURE_NOW });
  catalogApi.parseCanonicalJsonText(catalogText);
  const catalogAuthority = {
    id: catalog.catalog_id,
    revision: catalog.revision,
    generatedAtUtc: catalog.generated_at_utc,
    validUntilUtc: catalog.valid_until_utc,
    sha256: `sha256:${sha256(catalogBytes)}`
  };
  const admissionAuthority = {
    admissionText,
    qualificationReceiptText,
    catalogText,
    catalogAuthority,
    p2pPieceSetSha256: null
  };
  const manifest = {
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
      p2pPieceSetSha256: null
    },
    members: MEMBER_NAMES.map((fileName) => ({
      fileName,
      byteLength: memberBuffers[fileName].byteLength,
      sha256: sha256(memberBuffers[fileName])
    }))
  };

  return {
    classification: TEST_ONLY_CLASSIFICATION,
    testOnly: true,
    eligibleAsLiveModel: false,
    manifest,
    manifestSha256: sha256(Buffer.from(`${JSON.stringify(manifest)}\n`, "utf8")),
    admissionText,
    admissionBase64: admissionBytes.toString("base64"),
    qualificationReceipt,
    qualificationReceiptText,
    qualificationReceiptBase64: qualificationReceiptBytes.toString("base64"),
    catalog,
    catalogText,
    catalogBase64: catalogBytes.toString("base64"),
    catalogAuthority,
    admissionAuthority,
    members: Object.fromEntries(MEMBER_NAMES.map((fileName) => [
      fileName,
      memberBuffers[fileName].toString("base64")
    ]))
  };
}


async function launchProfile(profileRoot) {
  return chromium.launchPersistentContext(profileRoot, {
    channel: process.env.TINYRUSTLM_PLAYWRIGHT_CHANNEL || undefined,
    headless: true,
    viewport: { width: 1365, height: 768 },
    colorScheme: "dark",
    locale: "en-US"
  });
}

// Use an explicit page for cross-tab storage tests, otherwise reuse the profile's first page.
async function openRuntimePage(context, baseURL, suppliedPage) {
  const page = suppliedPage || context.pages()[0] || await context.newPage();
  await page.goto(new URL("/app/browser-model-admission.js", baseURL).href, {
    waitUntil: "domcontentloaded"
  });
  for (const scriptName of RUNTIME_SCRIPTS) {
    await page.addScriptTag({
      url: new URL(`/app/${scriptName}`, baseURL).href
    });
  }
  return page;
}

test("late source cancellation releases the real OPFS writer lock and preserves the saved model", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The OPFS contract runs in desktop Chromium");
  const fixtures = { prior: createSyntheticFixture("cleanup-prior", 127),
    candidate: createSyntheticFixture("cleanup-candidate", 149) };
  const profileRoot = createOwnedBrowserProfile("late-source-cleanup");
  let context = null;
  try {
    context = await launchProfile(profileRoot);
    const page = await openRuntimePage(context, String(testInfo.project.use.baseURL));
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    const result = await page.evaluate(async ({ fixtures, rootName, lockName }) => {
      const api = globalThis.TinyRustLMModelCompositionStore;
      const adapter = api.createOpfsAdapter({ createSha256: globalThis.TinyRustLMIncrementalSha256.createSha256 });
      const createStore = () => api.createModelCompositionStore({ adapter });
      // All six members are synthetic; only storage and cancellation are under test.
      const sources = value => Object.fromEntries(api.memberNames.map(fileName => [fileName, {
        async *[Symbol.asyncIterator]() {
          yield Uint8Array.from(atob(value.members[fileName]), character => character.charCodeAt(0));
        }
      }]));
      const bounded = async promise => {
        let timer;
        try {
          return await Promise.race([promise, new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error("store did not settle after cancellation")), 2000);
          })]);
        } finally { clearTimeout(timer); }
      };
      const store = createStore();
      const active = await store.install({ manifest: fixtures.prior.manifest,
        admissionAuthority: fixtures.prior.admissionAuthority, sources: sources(fixtures.prior),
        activate: async () => true, authorizeCommit: async () => true });
      const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(rootName);
      const readPointer = async () => (await (await root.getFileHandle("active.json")).getFile()).text();
      const before = await readPointer();
      const cleanupStarted = Promise.withResolvers();
      const cleanup = Promise.withResolvers();
      const controller = new AbortController();
      const candidateSources = sources(fixtures.candidate);
      let activated = false;
      candidateSources["model.slm2"] = new ReadableStream({
        start(stream) {
          stream.enqueue(new Uint8Array(fixtures.candidate.manifest.members[0].byteLength + 1));
        },
        cancel() { cleanupStarted.resolve(); return cleanup.promise; }
      });
      const outcome = store.install({ manifest: fixtures.candidate.manifest,
        admissionAuthority: fixtures.candidate.admissionAuthority, sources: candidateSources,
        signal: controller.signal, activate: async () => { activated = true; return true; },
        authorizeCommit: async () => true
      }).then(() => "unexpected-success", error => error.code);
      try {
        await bounded(cleanupStarted.promise);
        controller.abort();
        const code = await bounded(outcome);
        const held = (await navigator.locks.query()).held.filter(lock => lock.name === lockName);
        const reopened = await bounded(createStore().openActive());
        const installed = [];
        const staging = [];
        for await (const name of (await root.getDirectoryHandle("installed")).keys()) installed.push(name);
        for await (const name of (await root.getDirectoryHandle("staging")).keys()) staging.push(name);
        cleanup.reject(new Error("synthetic late cleanup rejection"));
        await new Promise(resolve => setTimeout(resolve, 0));
        return { code, activated, held: held.length, before, after: await readPointer(),
          reopened: reopened.manifestSha256, prior: active.manifestSha256, installed, staging };
      } finally { cleanup.resolve(); await outcome; }
    }, { fixtures, rootName: OPFS_ROOT_NAME, lockName: LOCK_NAME });
    expect(result.code).toBe("model-composition-store-source-length");
    expect(result.activated).toBe(false);
    expect(result.held).toBe(0);
    expect(result.after).toBe(result.before);
    expect(result.reopened).toBe(fixtures.prior.manifestSha256);
    expect(result.installed).toEqual([result.prior]);
    expect(result.staging).toEqual([]);
    expect(pageErrors).toEqual([]);
  } finally {
    if (context !== null) await context.close();
    removeOwnedBrowserProfile(profileRoot);
  }
});

test("OPFS cleanup preserves unexpected files and refuses unsafe recovery", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The OPFS ownership contract runs in desktop Chromium");
  const fixtures = { prior: createSyntheticFixture("ownership-prior", 127),
    candidate: createSyntheticFixture("ownership-candidate", 149) };
  const profileRoot = createOwnedBrowserProfile("cache-ownership");
  let context = null;
  try {
    context = await launchProfile(profileRoot);
    const page = await openRuntimePage(context, String(testInfo.project.use.baseURL));
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    const result = await page.evaluate(async ({ fixtures, rootName, lockName }) => {
      const api = globalThis.TinyRustLMModelCompositionStore;
      const adapter = api.createOpfsAdapter({ createSha256: globalThis.TinyRustLMIncrementalSha256.createSha256 });
      const store = api.createModelCompositionStore({ adapter });
      // These bytes exercise storage only; the fixtures are ineligible as live models.
      const install = value => store.install({ manifest: value.manifest,
        admissionAuthority: value.admissionAuthority, activate: async () => true,
        authorizeCommit: async () => true,
        sources: Object.fromEntries(api.memberNames.map(name => [name, {
          async *[Symbol.asyncIterator]() {
            yield Uint8Array.from(atob(value.members[name]), character => character.charCodeAt(0));
          }
        }])) });
      // Fixture writes use explicit handles and are removed only by their known exact names.
      const write = async (directory, name, value) => {
        const writer = await (await directory.getFileHandle(name, { create: true })).createWritable();
        await writer.write(value);
        await writer.close();
      };
      const read = async (directory, name) => (await (await directory.getFileHandle(name)).getFile()).text();
      const code = promise => promise.then(() => "unexpected-success", error => error.code);
      const active = await install(fixtures.prior);
      const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(rootName);
      const staging = await root.getDirectoryHandle("staging");
      const installed = await root.getDirectoryHandle("installed");
      const before = await read(root, "active.json");
      await write(staging, "notes.txt", "preserve staging evidence");
      const stagingCode = await code(store.cleanup());
      const stagingText = await read(staging, "notes.txt");
      await staging.removeEntry("notes.txt");

      const orphan = await installed.getDirectoryHandle(fixtures.candidate.manifestSha256, { create: true });
      await write(orphan, "manifest.json", `${JSON.stringify(fixtures.candidate.manifest)}\n`);
      await write(orphan, "notes.txt", "preserve orphan evidence");
      const orphanCode = await code(store.cleanup());
      const orphanText = await read(orphan, "notes.txt");
      await orphan.removeEntry("notes.txt");
      const cleaned = await store.cleanup();

      const current = await installed.getDirectoryHandle(active.manifestSha256);
      const nested = await current.getDirectoryHandle("notes", { create: true });
      await write(nested, "keep.txt", "preserve recovery evidence");
      await write(current, "model.slm2", "corrupted test member");
      const recoveryCode = await code(store.discardInvalidActive());
      const recoveryText = await read(nested, "keep.txt");
      const afterRefusal = await read(root, "active.json");
      await nested.removeEntry("keep.txt");
      await current.removeEntry("notes");
      const discarded = await store.discardInvalidActive();
      await install(fixtures.prior);
      const replacement = await install(fixtures.candidate);
      const names = [];
      for await (const name of installed.keys()) names.push(name);
      const held = (await navigator.locks.query()).held.filter(lock => lock.name === lockName);
      return { stagingCode, stagingText, orphanCode, orphanText, cleaned,
        recoveryCode, recoveryText, before, afterRefusal, discarded, names,
        held: held.length, replacement: replacement.manifestSha256,
        reopened: (await store.openActive()).manifestSha256 };
    }, { fixtures, rootName: OPFS_ROOT_NAME, lockName: LOCK_NAME });
    for (const code of [result.stagingCode, result.orphanCode, result.recoveryCode]) {
      expect(code).toBe("model-composition-store-cleanup-ownership");
    }
    expect(result.stagingText).toBe("preserve staging evidence");
    expect(result.orphanText).toBe("preserve orphan evidence");
    expect(result.recoveryText).toBe("preserve recovery evidence");
    expect(result.afterRefusal).toBe(result.before);
    expect(result.cleaned.removedInstalled).toBe(1);
    expect(result.discarded).toBe(true);
    expect(result.names).toEqual([fixtures.candidate.manifestSha256]);
    expect(result.replacement).toBe(fixtures.candidate.manifestSha256);
    expect(result.reopened).toBe(result.replacement);
    expect(result.held).toBe(0);
    expect(pageErrors).toEqual([]);
  } finally {
    if (context !== null) await context.close();
    removeOwnedBrowserProfile(profileRoot);
  }
});

test("cross-tab OPFS retirement waits for all six-member readers and releases on tab closure", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The read-lease contract runs in desktop Chromium");
  const fixtures = { prior: createSyntheticFixture("lease-prior", 127),
    candidate: createSyntheticFixture("lease-candidate", 149) };
  const profileRoot = createOwnedBrowserProfile("cache-reader-lease");
  let context = null;
  try {
    context = await launchProfile(profileRoot);
    const baseURL = String(testInfo.project.use.baseURL);
    const readerPage = await openRuntimePage(context, baseURL);
    const writerPage = await openRuntimePage(context, baseURL, await context.newPage());
    const errors = [];
    for (const page of [readerPage, writerPage]) page.on("pageerror", error => errors.push(error.message));
    // Both tabs use their own store/adapter against the same real origin and OPFS directory.
    const setup = async ({ fixtures, rootName }) => {
      const api = globalThis.TinyRustLMModelCompositionStore;
      const adapter = api.createOpfsAdapter({ createSha256: globalThis.TinyRustLMIncrementalSha256.createSha256 });
      const store = api.createModelCompositionStore({ adapter, chunkBytes: 8 });
      window.leaseTest = { store, fixtures, done: false,
        install: value => store.install({ manifest: value.manifest,
          admissionAuthority: value.admissionAuthority, activate: async () => true,
          authorizeCommit: async () => true,
          sources: Object.fromEntries(api.memberNames.map(name => [name, {
            async *[Symbol.asyncIterator]() {
              yield Uint8Array.from(atob(value.members[name]), character => character.charCodeAt(0));
            }
          }])) }),
        async snapshot() {
          const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(rootName);
          const pointer = JSON.parse(await (await (await root.getFileHandle("active.json")).getFile()).text());
          const installed = [];
          for await (const name of (await root.getDirectoryHandle("installed")).keys()) installed.push(name);
          return { pointer: pointer.manifestSha256, installed, locks: await navigator.locks.query() };
        }
      };
    };
    for (const page of [readerPage, writerPage]) await page.evaluate(setup, { fixtures, rootName: OPFS_ROOT_NAME });
    await readerPage.evaluate(async () => { await leaseTest.install(leaseTest.fixtures.prior); });
    await readerPage.evaluate(async () => {
      const active = await leaseTest.store.openActive();
      const entered = Promise.withResolvers();
      const resume = Promise.withResolvers();
      leaseTest.resume = resume.resolve;
      leaseTest.reading = active.withRead(async reader => {
        const hashes = {};
        for (const name of globalThis.TinyRustLMModelCompositionStore.memberNames) {
          const hash = globalThis.TinyRustLMIncrementalSha256.createSha256();
          for await (const chunk of reader.streamMember(name)) hash.update(chunk);
          hashes[name] = Array.from(hash.digest(), byte => byte.toString(16).padStart(2, "0")).join("");
          if (name === "model.slm2") { entered.resolve(); await resume.promise; }
        }
        return hashes;
      });
      await entered.promise;
    });
    await writerPage.evaluate(() => {
      leaseTest.replacing = leaseTest.install(leaseTest.fixtures.candidate).then(() => { leaseTest.done = true; });
    });
    await expect.poll(() => writerPage.evaluate(async () => (await leaseTest.snapshot()).pointer))
      .toBe(fixtures.candidate.manifestSha256);
    const blocked = await writerPage.evaluate(async () => ({ ...(await leaseTest.snapshot()), done: leaseTest.done }));
    expect(blocked.done).toBe(false);
    expect(blocked.installed.sort()).toEqual([fixtures.prior.manifestSha256, fixtures.candidate.manifestSha256].sort());
    expect(blocked.locks.held.some(lock => lock.mode === "shared" && lock.name.endsWith(fixtures.prior.manifestSha256))).toBe(true);
    expect(blocked.locks.pending.some(lock => lock.mode === "exclusive" && lock.name.endsWith(fixtures.prior.manifestSha256))).toBe(true);
    const hashes = await readerPage.evaluate(async () => { leaseTest.resume(); return leaseTest.reading; });
    for (const member of fixtures.prior.manifest.members) expect(hashes[member.fileName]).toBe(member.sha256);
    await writerPage.evaluate(() => leaseTest.replacing);
    expect((await writerPage.evaluate(() => leaseTest.snapshot())).installed).toEqual([fixtures.candidate.manifestSha256]);

    // A suspended tab pins no permanent backup: destroying its context releases the browser-owned lease.
    await readerPage.evaluate(async () => {
      const active = await leaseTest.store.openActive();
      const entered = Promise.withResolvers();
      leaseTest.reading = active.withRead(() => { entered.resolve(); return new Promise(() => {}); });
      await entered.promise;
    });
    await writerPage.evaluate(() => {
      leaseTest.done = false;
      leaseTest.replacing = leaseTest.install(leaseTest.fixtures.prior).then(() => { leaseTest.done = true; });
    });
    await expect.poll(() => writerPage.evaluate(async () => (await leaseTest.snapshot()).pointer))
      .toBe(fixtures.prior.manifestSha256);
    expect(await writerPage.evaluate(() => leaseTest.done)).toBe(false);
    await readerPage.close();
    await writerPage.evaluate(() => leaseTest.replacing);
    const final = await writerPage.evaluate(() => leaseTest.snapshot());
    expect(final.installed).toEqual([fixtures.prior.manifestSha256]);
    expect(final.locks.held.filter(lock => lock.name.startsWith(LOCK_NAME))).toEqual([]);
    expect(final.locks.pending.filter(lock => lock.name.startsWith(LOCK_NAME))).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    if (context !== null) await context.close();
    removeOwnedBrowserProfile(profileRoot);
  }
});

test("persistent OPFS cache keeps only the admitted six-member composition", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The persistent-cache contract runs in desktop Chromium");
  test.slow();

  const baseURL = String(testInfo.project.use.baseURL);
  const fixtures = {
    active: createSyntheticFixture("active", 127),
    cancelled: createSyntheticFixture("cancelled", 149),
    tampered: createSyntheticFixture("tampered", 173)
  };
  const profileRoot = createOwnedBrowserProfile("composition-cache");
  let context = null;

  try {
    context = await launchProfile(profileRoot);
    const installPage = await openRuntimePage(context, baseURL);
    const installed = await installPage.evaluate(async ({ fixture, lockName, opfsRootName }) => {
      const admission = globalThis.TinyRustLMBrowserModelAdmission;
      const catalog = globalThis.TinyRustLMMiniModelCatalogV1;
      const incrementalSha = globalThis.TinyRustLMIncrementalSha256;
      const storeApi = globalThis.TinyRustLMModelCompositionStore;

      function decodeBase64(value) {
        const binary = atob(value);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
          bytes[index] = binary.charCodeAt(index);
        }
        return bytes;
      }

      function encodeBase64(bytes) {
        let binary = "";
        for (let offset = 0; offset < bytes.byteLength; offset += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
        }
        return btoa(binary);
      }

      function hydrate(value) {
        return {
          ...value,
          members: Object.fromEntries(storeApi.memberNames.map((fileName) => [
            fileName,
            decodeBase64(value.members[fileName])
          ]))
        };
      }

      function createSources(members, reads, chunks) {
        const widths = [1, 97, 61, 109, 73];
        return Object.fromEntries(storeApi.memberNames.map((fileName, memberIndex) => [
          fileName,
          {
            async *[Symbol.asyncIterator]() {
              reads[fileName] += 1;
              const bytes = members[fileName];
              let offset = 0;
              let widthIndex = memberIndex;
              while (offset < bytes.byteLength) {
                const next = Math.min(bytes.byteLength, offset + widths[widthIndex % widths.length]);
                chunks[fileName] += 1;
                yield bytes.subarray(offset, next);
                offset = next;
                widthIndex += 1;
              }
            }
          }
        ]));
      }

      async function storeRoot() {
        const root = await navigator.storage.getDirectory();
        return root.getDirectoryHandle(opfsRootName, { create: false });
      }

      async function directory(parts) {
        let handle = await storeRoot();
        for (const part of parts) {
          handle = await handle.getDirectoryHandle(part, { create: false });
        }
        return handle;
      }

      async function readFile(parts) {
        const parent = await directory(parts.slice(0, -1));
        const handle = await parent.getFileHandle(parts.at(-1), { create: false });
        return new Uint8Array(await (await handle.getFile()).arrayBuffer());
      }

      async function list(parts) {
        const entries = [];
        for await (const [name, handle] of (await directory(parts)).entries()) {
          entries.push({ name, kind: handle.kind });
        }
        return entries.sort((left, right) => left.name.localeCompare(right.name));
      }

      async function listOpfsRoot() {
        const entries = [];
        const root = await navigator.storage.getDirectory();
        for await (const [name, handle] of root.entries()) {
          entries.push({ name, kind: handle.kind });
        }
        return entries.sort((left, right) => left.name.localeCompare(right.name));
      }

      const lockObservations = { requests: 0, held: 0, maxHeld: 0, writerHeld: 0, maxWriterHeld: 0, names: [], modes: [] };
      const shaObservations = { instances: 0, updates: 0, digests: 0, maxUpdateBytes: 0 };
      const nativeLocks = navigator.locks;
      const lockManager = {
        request(name, options, callback) {
          lockObservations.requests += 1;
          lockObservations.names.push(name);
          lockObservations.modes.push(options.mode);
          return nativeLocks.request(name, options, async (lock) => {
            lockObservations.held += 1;
            lockObservations.maxHeld = Math.max(lockObservations.maxHeld, lockObservations.held);
            if (name === "tinyrustlm-model-compositions-v2-writer") {
              lockObservations.writerHeld += 1;
              lockObservations.maxWriterHeld = Math.max(lockObservations.maxWriterHeld, lockObservations.writerHeld);
            }
            try {
              return await callback(lock);
            } finally {
              lockObservations.held -= 1;
              if (name === "tinyrustlm-model-compositions-v2-writer") lockObservations.writerHeld -= 1;
            }
          });
        }
      };
      const createSha256 = () => {
        const hasher = incrementalSha.createSha256();
        shaObservations.instances += 1;
        return {
          update(bytes) {
            shaObservations.updates += 1;
            shaObservations.maxUpdateBytes = Math.max(
              shaObservations.maxUpdateBytes,
              bytes.byteLength
            );
            return hasher.update(bytes);
          },
          digest() {
            shaObservations.digests += 1;
            return hasher.digest();
          }
        };
      };
      const adapter = storeApi.createOpfsAdapter({ createSha256, lockManager });
      const store = storeApi.createModelCompositionStore({
        adapter,
        chunkBytes: 113,
        maximumCompositionBytes: 1024 * 1024
      });
      const hydrated = hydrate(fixture);
      const sourceReads = Object.fromEntries(storeApi.memberNames.map((name) => [name, 0]));
      const sourceChunks = Object.fromEntries(storeApi.memberNames.map((name) => [name, 0]));
      let activationCalls = 0;
      const activationEvents = [];
      const acceptTestActivation = async (candidate) => {
        activationCalls += 1;
        activationEvents.push("activate");
        return candidate.manifestSha256 === fixture.manifestSha256;
      };
      // Authorizes only this activated synthetic candidate under its current catalog custody.
      const authorizeTestCommit = async (candidate, context) => {
        activationEvents.push("authorizeCommit");
        const disposition = catalog.qualificationDisposition(
          candidate.admissionAuthority.catalogDocument,
          candidate.admissionAuthority.admission,
          { now: new Date() }
        );
        return activationCalls === 1 && context.previousComposition === null &&
          context.signal === null &&
          candidate.manifestSha256 === fixture.manifestSha256 &&
          candidate.admissionAuthority.admissionText === fixture.admissionText &&
          candidate.admissionAuthority.catalogText === fixture.catalogText &&
          disposition.status === "current";
      };
      const active = await store.install({
        manifest: hydrated.manifest,
        admissionAuthority: hydrated.admissionAuthority,
        sources: createSources(hydrated.members, sourceReads, sourceChunks),
        activate: acceptTestActivation,
        authorizeCommit: authorizeTestCommit
      });
      const pointerBefore = await readFile(["active.json"]);
      const parsedPointer = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(pointerBefore)
      );
      const admissionBytes = await readFile([
        "installed",
        active.manifestSha256,
        "admission.json"
      ]);
      const qualificationReceiptBytes = await readFile([
        "installed",
        active.manifestSha256,
        "qualification-receipt.json"
      ]);
      const catalogBytes = await readFile([
        "installed",
        active.manifestSha256,
        "catalog.json"
      ]);

      const duplicateReads = Object.fromEntries(storeApi.memberNames.map((name) => [name, 0]));
      const duplicateChunks = Object.fromEntries(storeApi.memberNames.map((name) => [name, 0]));
      const duplicateSources = createSources(hydrated.members, duplicateReads, duplicateChunks);
      const [duplicateA, duplicateB] = await Promise.all([
        store.install({
          manifest: hydrated.manifest,
          admissionAuthority: hydrated.admissionAuthority,
          sources: duplicateSources,
          activate: acceptTestActivation,
          authorizeCommit: authorizeTestCommit
        }),
        store.install({
          manifest: hydrated.manifest,
          admissionAuthority: hydrated.admissionAuthority,
          sources: duplicateSources,
          activate: acceptTestActivation,
          authorizeCommit: authorizeTestCommit
        })
      ]);
      const pointerAfter = await readFile(["active.json"]);
      const parsedAdmission = admission.parseAdmissionText(
        active.admissionAuthority.admissionText
      );
      const disposition = catalog.qualificationDisposition(
        active.admissionAuthority.catalogDocument,
        active.admissionAuthority.admission,
        { now: new Date() }
      );

      return {
        capabilities: {
          secureContext: isSecureContext,
          opfs: typeof navigator.storage.getDirectory === "function",
          webLocks: typeof navigator.locks.request === "function",
          incrementalSha: typeof incrementalSha.createSha256 === "function",
          catalogAuthority: typeof catalog.qualificationDisposition === "function",
          compositionStore: typeof storeApi.createOpfsAdapter === "function",
          manifestSchema: active.manifest.schema
        },
        classification: fixture.classification,
        testOnly: fixture.testOnly,
        eligibleAsLiveModel: fixture.eligibleAsLiveModel,
        active: {
          manifestSha256: active.manifestSha256,
          admissionAuthoritySha256: active.admissionAuthoritySha256,
          activationId: active.activationId,
          admissionText: active.admissionAuthority.admissionText,
          p2pPieceSetSha256: active.admissionAuthority.p2pPieceSetSha256
        },
        admissionAuthority: {
          admission: active.admissionAuthority.admission,
          admissionSha256: active.admissionAuthority.admissionSha256,
          qualificationReceipt: active.admissionAuthority.qualificationReceipt,
          qualificationReceiptText: active.admissionAuthority.qualificationReceiptText,
          qualificationReceiptSha256:
            active.admissionAuthority.qualificationReceiptSha256,
          catalogDocument: active.admissionAuthority.catalogDocument,
          catalogText: active.admissionAuthority.catalogText,
          catalogAuthority: active.admissionAuthority.catalogAuthority,
          p2pPieceSetSha256: active.admissionAuthority.p2pPieceSetSha256
        },
        duplicateA: {
          manifestSha256: duplicateA.manifestSha256,
          activationId: duplicateA.activationId
        },
        duplicateB: {
          manifestSha256: duplicateB.manifestSha256,
          activationId: duplicateB.activationId
        },
        parsedAdmission: {
          modelId: parsedAdmission.modelId,
          qualityClaim: parsedAdmission.qualification.qualityClaim,
          qualityScope: parsedAdmission.qualification.qualityScope,
          artifactNames: parsedAdmission.artifacts.map((artifact) => artifact.fileName)
        },
        sourceReads,
        sourceChunks,
        duplicateReads,
        parsedPointer,
        pointerBefore: encodeBase64(pointerBefore),
        pointerAfter: encodeBase64(pointerAfter),
        admissionBase64: encodeBase64(admissionBytes),
        qualificationReceiptBase64: encodeBase64(qualificationReceiptBytes),
        catalogBase64: encodeBase64(catalogBytes),
        catalogDisposition: {
          status: disposition.status,
          reason: disposition.reason,
          compositionId: disposition.compositionId,
          receiptId: disposition.receiptId,
          catalogId: disposition.catalogId,
          catalogRevision: disposition.catalogRevision
        },
        opfsEntries: await listOpfsRoot(),
        stagingEntries: await list(["staging"]),
        installedEntries: await list(["installed"]),
        installedContentEntries: await list(["installed", active.manifestSha256]),
        lockObservations,
        shaObservations,
        activationCalls,
        activationEvents,
        expectedLockName: lockName
      };
    }, {
      fixture: fixtures.active,
      lockName: LOCK_NAME,
      opfsRootName: OPFS_ROOT_NAME
    });

    expect(installed.capabilities).toEqual({
      secureContext: true,
      opfs: true,
      webLocks: true,
      incrementalSha: true,
      catalogAuthority: true,
      compositionStore: true,
      manifestSchema: MANIFEST_SCHEMA
    });
    expect(installed).toMatchObject({
      classification: TEST_ONLY_CLASSIFICATION,
      testOnly: true,
      eligibleAsLiveModel: false
    });
    expect(installed.active).toMatchObject({
      manifestSha256: fixtures.active.manifestSha256,
      admissionText: fixtures.active.admissionText,
      p2pPieceSetSha256: null
    });
    expect(installed.active.admissionAuthoritySha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(installed.admissionAuthority).toEqual({
      admission: admissionApi.parseAdmissionText(fixtures.active.admissionText),
      admissionSha256:
        `sha256:${fixtures.active.manifest.admissionAuthority.admission.sha256}`,
      qualificationReceipt: fixtures.active.qualificationReceipt,
      qualificationReceiptText: fixtures.active.qualificationReceiptText,
      qualificationReceiptSha256:
        `sha256:${fixtures.active.manifest.admissionAuthority.qualificationReceipt.sha256}`,
      catalogDocument: fixtures.active.catalog,
      catalogText: fixtures.active.catalogText,
      catalogAuthority: fixtures.active.catalogAuthority,
      p2pPieceSetSha256: null
    });
    expect(installed.parsedAdmission).toEqual({
      modelId: "test-only/composition-cache-active",
      qualityClaim: "task-specific-qualified",
      qualityScope: TEST_ONLY_SCOPE,
      artifactNames: MEMBER_NAMES
    });
    expect(installed.admissionBase64).toBe(fixtures.active.admissionBase64);
    expect(installed.qualificationReceiptBase64)
      .toBe(fixtures.active.qualificationReceiptBase64);
    expect(installed.catalogBase64).toBe(fixtures.active.catalogBase64);
    expect(installed.catalogDisposition).toEqual({
      status: "current",
      reason: "current",
      compositionId: fixtures.active.qualificationReceipt.compositionId,
      receiptId: fixtures.active.qualificationReceipt.receiptId,
      catalogId: fixtures.active.catalog.catalog_id,
      catalogRevision: fixtures.active.catalog.revision
    });
    expect(installed.parsedPointer).toEqual({
      schema: POINTER_SCHEMA,
      stagingId: installed.active.activationId,
      manifestSha256: installed.active.manifestSha256,
      admissionAuthoritySha256: installed.active.admissionAuthoritySha256
    });
    expect(installed.pointerAfter).toBe(installed.pointerBefore);
    expect(installed.duplicateA).toEqual({
      manifestSha256: installed.active.manifestSha256,
      activationId: installed.active.activationId
    });
    expect(installed.duplicateB).toEqual(installed.duplicateA);
    expect(installed.sourceReads).toEqual(Object.fromEntries(MEMBER_NAMES.map((name) => [name, 1])));
    expect(Object.values(installed.sourceChunks).every((count) => count > 1)).toBe(true);
    expect(Object.values(installed.duplicateReads).every((count) => count === 0)).toBe(true);
    expect(installed.stagingEntries).toEqual([]);
    expect(installed.opfsEntries).toEqual([{
      name: OPFS_ROOT_NAME,
      kind: "directory"
    }]);
    expect(installed.installedEntries).toEqual([{
      name: installed.active.manifestSha256,
      kind: "directory"
    }]);
    expect(installed.installedContentEntries).toEqual([
      "admission.json",
      "catalog.json",
      "composition.acg2",
      "manifest.json",
      "model.slm2",
      "prompt.prompt2",
      "qualification-receipt.json",
      "sampling.sampling2",
      "template.template2",
      "tokenizer.tokenizer2"
    ].map((name) => ({ name, kind: "file" })));
    expect(installed.lockObservations.requests).toBeGreaterThanOrEqual(3);
    expect(installed.lockObservations.maxWriterHeld).toBe(1);
    expect(installed.lockObservations.maxHeld).toBe(2);
    expect(installed.lockObservations.held).toBe(0);
    expect(installed.lockObservations.names.every(name => name === LOCK_NAME ||
      (name.startsWith(`${LOCK_NAME}:`) && /^[0-9a-f]{64}$/u.test(name.slice(LOCK_NAME.length + 1))))).toBe(true);
    expect(installed.lockObservations.modes.every((mode, index) =>
      installed.lockObservations.names[index] === LOCK_NAME ? mode === "exclusive" :
        ["shared", "exclusive"].includes(mode))).toBe(true);
    expect(installed.shaObservations.instances).toBeGreaterThan(MEMBER_NAMES.length);
    expect(installed.shaObservations.updates).toBeGreaterThan(installed.shaObservations.instances);
    expect(installed.shaObservations.digests).toBe(installed.shaObservations.instances);
    expect(installed.activationCalls).toBe(3);
    expect(installed.activationEvents).toEqual([
      "activate", "authorizeCommit", "activate", "activate"
    ]);

    await context.close();
    context = null;

    context = await launchProfile(profileRoot);
    const reopenPage = await openRuntimePage(context, baseURL);
    const reopened = await reopenPage.evaluate(async ({ fixtures: values, opfsRootName }) => {
      const admissionApi = globalThis.TinyRustLMBrowserModelAdmission;
      const catalogApi = globalThis.TinyRustLMMiniModelCatalogV1;
      const incrementalSha = globalThis.TinyRustLMIncrementalSha256;
      const storeApi = globalThis.TinyRustLMModelCompositionStore;

      function decodeBase64(value) {
        const binary = atob(value);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
          bytes[index] = binary.charCodeAt(index);
        }
        return bytes;
      }

      function encodeBase64(bytes) {
        let binary = "";
        for (let offset = 0; offset < bytes.byteLength; offset += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
        }
        return btoa(binary);
      }

      function hydrate(value) {
        return {
          ...value,
          members: Object.fromEntries(storeApi.memberNames.map((fileName) => [
            fileName,
            decodeBase64(value.members[fileName])
          ]))
        };
      }

      function createSources(members) {
        const widths = [31, 2, 701, 43, 4099];
        return Object.fromEntries(storeApi.memberNames.map((fileName, memberIndex) => [
          fileName,
          {
            async *[Symbol.asyncIterator]() {
              const bytes = members[fileName];
              let offset = 0;
              let widthIndex = memberIndex;
              while (offset < bytes.byteLength) {
                const next = Math.min(bytes.byteLength, offset + widths[widthIndex % widths.length]);
                yield bytes.subarray(offset, next);
                offset = next;
                widthIndex += 1;
              }
            }
          }
        ]));
      }

      async function storeRoot() {
        const root = await navigator.storage.getDirectory();
        return root.getDirectoryHandle(opfsRootName, { create: false });
      }

      async function directory(parts) {
        let handle = await storeRoot();
        for (const part of parts) {
          handle = await handle.getDirectoryHandle(part, { create: false });
        }
        return handle;
      }

      async function readFile(parts) {
        const parent = await directory(parts.slice(0, -1));
        const handle = await parent.getFileHandle(parts.at(-1), { create: false });
        return new Uint8Array(await (await handle.getFile()).arrayBuffer());
      }

      async function writeFile(parts, bytes) {
        const parent = await directory(parts.slice(0, -1));
        const handle = await parent.getFileHandle(parts.at(-1), { create: false });
        const writable = await handle.createWritable({ keepExistingData: false });
        try {
          await writable.write(bytes);
          await writable.close();
        } catch (error) {
          try {
            await writable.abort();
          } catch (_) {
            // Preserve the original synthetic fault if cleanup also fails.
          }
          throw error;
        }
      }

      async function list(parts) {
        const entries = [];
        for await (const [name, handle] of (await directory(parts)).entries()) {
          entries.push({ name, kind: handle.kind });
        }
        return entries.sort((left, right) => left.name.localeCompare(right.name));
      }

      function errorDetails(error) {
        return {
          name: error && error.name || null,
          code: error && error.code || null,
          memberName: error && error.memberName || null,
          stagingId: error && error.stagingId || null
        };
      }

      async function verifyMemberStream(composition, fileName, expected) {
        let byteLength = 0;
        let chunks = 0;
        let maximumChunkBytes = 0;
        for await (const chunk of composition.streamMember(fileName)) {
          if (!(chunk instanceof Uint8Array)) {
            throw new TypeError(`stream ${fileName} yielded a non-Uint8Array`);
          }
          for (let index = 0; index < chunk.byteLength; index += 1) {
            if (chunk[index] !== expected[byteLength + index]) {
              throw new Error(`stream ${fileName} differs at byte ${byteLength + index}`);
            }
          }
          byteLength += chunk.byteLength;
          chunks += 1;
          maximumChunkBytes = Math.max(maximumChunkBytes, chunk.byteLength);
        }
        if (byteLength !== expected.byteLength) {
          throw new Error(`stream ${fileName} has ${byteLength} bytes, expected ${expected.byteLength}`);
        }
        return { byteLength, chunks, maximumChunkBytes };
      }

      const lockObservations = { requests: 0, held: 0, maxHeld: 0, writerHeld: 0, maxWriterHeld: 0, names: [], modes: [] };
      const shaObservations = { instances: 0, updates: 0, digests: 0 };
      const nativeLocks = navigator.locks;
      const lockManager = {
        request(name, options, callback) {
          lockObservations.requests += 1;
          lockObservations.names.push(name);
          lockObservations.modes.push(options.mode);
          return nativeLocks.request(name, options, async (lock) => {
            lockObservations.held += 1;
            lockObservations.maxHeld = Math.max(lockObservations.maxHeld, lockObservations.held);
            if (name === "tinyrustlm-model-compositions-v2-writer") {
              lockObservations.writerHeld += 1;
              lockObservations.maxWriterHeld = Math.max(lockObservations.maxWriterHeld, lockObservations.writerHeld);
            }
            try {
              return await callback(lock);
            } finally {
              lockObservations.held -= 1;
              if (name === "tinyrustlm-model-compositions-v2-writer") lockObservations.writerHeld -= 1;
            }
          });
        }
      };
      const createSha256 = () => {
        const hasher = incrementalSha.createSha256();
        shaObservations.instances += 1;
        return {
          update(bytes) {
            shaObservations.updates += 1;
            return hasher.update(bytes);
          },
          digest() {
            shaObservations.digests += 1;
            return hasher.digest();
          }
        };
      };
      const adapter = storeApi.createOpfsAdapter({ createSha256, lockManager });
      const store = storeApi.createModelCompositionStore({
        adapter,
        chunkBytes: 113,
        maximumCompositionBytes: 1024 * 1024
      });
      const activeFixture = hydrate(values.active);
      const cancelledFixture = hydrate(values.cancelled);
      const tamperedFixture = hydrate(values.tampered);
      const unexpectedInstallEvents = [];
      const rejectUnexpectedActivation = async () => {
        unexpectedInstallEvents.push("activate");
        return false;
      };
      const rejectUnexpectedCommit = async () => {
        unexpectedInstallEvents.push("authorizeCommit");
        return false;
      };

      const active = await store.openActive();
      if (active === null) throw new Error("the persisted active composition is missing");
      const parsedAdmission = admissionApi.parseAdmissionText(
        active.admissionAuthority.admissionText
      );
      const disposition = catalogApi.qualificationDisposition(
        active.admissionAuthority.catalogDocument,
        active.admissionAuthority.admission,
        { now: new Date() }
      );
      const admissionBytes = await readFile([
        "installed",
        active.manifestSha256,
        "admission.json"
      ]);
      const qualificationReceiptPath = [
        "installed",
        active.manifestSha256,
        "qualification-receipt.json"
      ];
      const catalogPath = ["installed", active.manifestSha256, "catalog.json"];
      const qualificationReceiptBytes = await readFile(qualificationReceiptPath);
      const catalogBytes = await readFile(catalogPath);
      const memberStreams = {};
      for (const fileName of storeApi.memberNames) {
        memberStreams[fileName] = await verifyMemberStream(
          active,
          fileName,
          activeFixture.members[fileName]
        );
      }
      const pointerBeforeFailures = await readFile(["active.json"]);

      const controller = new AbortController();
      const cancelledSources = createSources(cancelledFixture.members);
      cancelledSources["model.slm2"] = {
        async *[Symbol.asyncIterator]() {
          const bytes = cancelledFixture.members["model.slm2"];
          yield bytes.subarray(0, 19);
          controller.abort("test-only cancellation after staging starts");
          yield bytes.subarray(19);
        }
      };
      let cancellationError = null;
      try {
        await store.install({
          manifest: cancelledFixture.manifest,
          admissionAuthority: cancelledFixture.admissionAuthority,
          sources: cancelledSources,
          signal: controller.signal,
          activate: rejectUnexpectedActivation,
          authorizeCommit: rejectUnexpectedCommit
        });
      } catch (error) {
        cancellationError = errorDetails(error);
      }
      if (cancellationError === null) {
        throw new Error("the cancelled test-only staging install unexpectedly succeeded");
      }
      const pointerAfterCancellation = await readFile(["active.json"]);
      const activeAfterCancellation = await store.openActive();
      const stagingAfterCancellation = await list(["staging"]);
      const installedAfterCancellation = await list(["installed"]);

      const tamperedMembers = { ...tamperedFixture.members };
      tamperedMembers["template.template2"] = Uint8Array.from(
        tamperedFixture.members["template.template2"]
      );
      tamperedMembers["template.template2"][37] ^= 0xff;
      let tamperError = null;
      try {
        await store.install({
          manifest: tamperedFixture.manifest,
          admissionAuthority: tamperedFixture.admissionAuthority,
          sources: createSources(tamperedMembers),
          activate: rejectUnexpectedActivation,
          authorizeCommit: rejectUnexpectedCommit
        });
      } catch (error) {
        tamperError = errorDetails(error);
      }
      if (tamperError === null) {
        throw new Error("the tampered test-only staging install unexpectedly succeeded");
      }
      const pointerAfterTamper = await readFile(["active.json"]);
      const activeAfterTamper = await store.openActive();

      const tamperedReceiptBytes = Uint8Array.from(qualificationReceiptBytes);
      tamperedReceiptBytes[11] ^= 0x01;
      await writeFile(qualificationReceiptPath, tamperedReceiptBytes);
      let receiptCustodyError = null;
      try {
        await store.openActive();
      } catch (error) {
        receiptCustodyError = errorDetails(error);
      }
      if (receiptCustodyError === null) {
        throw new Error("the tampered stored qualification receipt unexpectedly reopened");
      }
      const pointerAfterReceiptTamper = await readFile(["active.json"]);
      await writeFile(qualificationReceiptPath, qualificationReceiptBytes);
      const activeAfterReceiptRestore = await store.openActive();

      const tamperedCatalogBytes = Uint8Array.from(catalogBytes);
      tamperedCatalogBytes[13] ^= 0x01;
      await writeFile(catalogPath, tamperedCatalogBytes);
      let catalogCustodyError = null;
      try {
        await store.openActive();
      } catch (error) {
        catalogCustodyError = errorDetails(error);
      }
      if (catalogCustodyError === null) {
        throw new Error("the tampered stored catalog unexpectedly reopened");
      }
      const pointerAfterCatalogTamper = await readFile(["active.json"]);
      await writeFile(catalogPath, catalogBytes);
      const activeAfterCatalogRestore = await store.openActive();
      const pointerAfterAuthorityRestore = await readFile(["active.json"]);
      const finalAdmissionBytes = await readFile([
        "installed",
        activeAfterCatalogRestore.manifestSha256,
        "admission.json"
      ]);
      const finalQualificationReceiptBytes = await readFile(qualificationReceiptPath);
      const finalCatalogBytes = await readFile(catalogPath);

      function persistedIdentity(composition) {
        return {
          manifestSha256: composition.manifestSha256,
          admissionAuthoritySha256: composition.admissionAuthoritySha256,
          activationId: composition.activationId
        };
      }

      return {
        active: {
          manifestSha256: active.manifestSha256,
          admissionAuthoritySha256: active.admissionAuthoritySha256,
          activationId: active.activationId,
          admissionText: active.admissionAuthority.admissionText,
          p2pPieceSetSha256: active.admissionAuthority.p2pPieceSetSha256
        },
        admissionAuthority: {
          admission: active.admissionAuthority.admission,
          admissionSha256: active.admissionAuthority.admissionSha256,
          qualificationReceipt: active.admissionAuthority.qualificationReceipt,
          qualificationReceiptText: active.admissionAuthority.qualificationReceiptText,
          qualificationReceiptSha256:
            active.admissionAuthority.qualificationReceiptSha256,
          catalogDocument: active.admissionAuthority.catalogDocument,
          catalogText: active.admissionAuthority.catalogText,
          catalogAuthority: active.admissionAuthority.catalogAuthority,
          p2pPieceSetSha256: active.admissionAuthority.p2pPieceSetSha256
        },
        parsedAdmission: {
          modelId: parsedAdmission.modelId,
          qualityScope: parsedAdmission.qualification.qualityScope,
          artifactNames: parsedAdmission.artifacts.map((artifact) => artifact.fileName)
        },
        admissionBase64: encodeBase64(admissionBytes),
        qualificationReceiptBase64: encodeBase64(qualificationReceiptBytes),
        catalogBase64: encodeBase64(catalogBytes),
        finalAdmissionBase64: encodeBase64(finalAdmissionBytes),
        finalQualificationReceiptBase64: encodeBase64(finalQualificationReceiptBytes),
        finalCatalogBase64: encodeBase64(finalCatalogBytes),
        catalogDisposition: {
          status: disposition.status,
          reason: disposition.reason,
          compositionId: disposition.compositionId,
          receiptId: disposition.receiptId,
          catalogId: disposition.catalogId,
          catalogRevision: disposition.catalogRevision
        },
        memberStreams,
        cancellationError,
        unexpectedInstallEvents,
        tamperError,
        receiptCustodyError,
        catalogCustodyError,
        activeAfterCancellation: persistedIdentity(activeAfterCancellation),
        activeAfterTamper: persistedIdentity(activeAfterTamper),
        activeAfterReceiptRestore: persistedIdentity(activeAfterReceiptRestore),
        activeAfterCatalogRestore: persistedIdentity(activeAfterCatalogRestore),
        pointerBeforeFailures: encodeBase64(pointerBeforeFailures),
        pointerAfterCancellation: encodeBase64(pointerAfterCancellation),
        pointerAfterTamper: encodeBase64(pointerAfterTamper),
        pointerAfterReceiptTamper: encodeBase64(pointerAfterReceiptTamper),
        pointerAfterCatalogTamper: encodeBase64(pointerAfterCatalogTamper),
        pointerAfterAuthorityRestore: encodeBase64(pointerAfterAuthorityRestore),
        stagingAfterCancellation,
        installedAfterCancellation,
        stagingAfterTamper: await list(["staging"]),
        installedAfterTamper: await list(["installed"]),
        finalStagingEntries: await list(["staging"]),
        finalInstalledEntries: await list(["installed"]),
        lockObservations,
        shaObservations
      };
    }, {
      fixtures,
      opfsRootName: OPFS_ROOT_NAME
    });

    expect(reopened.active).toEqual(installed.active);
    expect(reopened.admissionAuthority).toEqual(installed.admissionAuthority);
    expect(reopened.active.admissionText).toBe(fixtures.active.admissionText);
    expect(reopened.active.p2pPieceSetSha256).toBeNull();
    expect(reopened.parsedAdmission).toEqual({
      modelId: "test-only/composition-cache-active",
      qualityScope: TEST_ONLY_SCOPE,
      artifactNames: MEMBER_NAMES
    });
    expect(reopened.admissionBase64).toBe(fixtures.active.admissionBase64);
    expect(reopened.qualificationReceiptBase64)
      .toBe(fixtures.active.qualificationReceiptBase64);
    expect(reopened.catalogBase64).toBe(fixtures.active.catalogBase64);
    expect(reopened.finalAdmissionBase64).toBe(fixtures.active.admissionBase64);
    expect(reopened.finalQualificationReceiptBase64)
      .toBe(fixtures.active.qualificationReceiptBase64);
    expect(reopened.finalCatalogBase64).toBe(fixtures.active.catalogBase64);
    expect(reopened.catalogDisposition).toEqual({
      status: "current",
      reason: "current",
      compositionId: fixtures.active.qualificationReceipt.compositionId,
      receiptId: fixtures.active.qualificationReceipt.receiptId,
      catalogId: fixtures.active.catalog.catalog_id,
      catalogRevision: fixtures.active.catalog.revision
    });
    for (const [index, fileName] of MEMBER_NAMES.entries()) {
      expect(reopened.memberStreams[fileName].byteLength)
        .toBe(fixtures.active.manifest.members[index].byteLength);
      expect(reopened.memberStreams[fileName].chunks).toBeGreaterThan(1);
      expect(reopened.memberStreams[fileName].maximumChunkBytes).toBeLessThanOrEqual(113);
    }

    expect(reopened.cancellationError).toMatchObject({
      name: "ModelCompositionStoreError",
      code: "model-composition-store-aborted",
      memberName: null
    });
    expect(reopened.cancellationError.stagingId).toMatch(/^[0-9a-f]{64}$/u);
    expect(reopened.unexpectedInstallEvents).toEqual([]);
    expect(reopened.pointerAfterCancellation).toBe(reopened.pointerBeforeFailures);
    expect(reopened.stagingAfterCancellation).toEqual([]);
    expect(reopened.installedAfterCancellation).toEqual([{
      name: fixtures.active.manifestSha256,
      kind: "directory"
    }]);
    const persistedIdentity = {
      manifestSha256: installed.active.manifestSha256,
      admissionAuthoritySha256: installed.active.admissionAuthoritySha256,
      activationId: installed.active.activationId
    };
    expect(reopened.activeAfterCancellation).toEqual(persistedIdentity);

    expect(reopened.tamperError).toMatchObject({
      name: "ModelCompositionStoreError",
      code: "model-composition-store-source-sha256",
      memberName: "template.template2"
    });
    expect(reopened.tamperError.stagingId).toMatch(/^[0-9a-f]{64}$/u);
    expect(reopened.pointerAfterTamper).toBe(reopened.pointerBeforeFailures);
    expect(reopened.stagingAfterTamper).toEqual([]);
    expect(reopened.installedAfterTamper).toEqual([{
      name: fixtures.active.manifestSha256,
      kind: "directory"
    }]);
    expect(reopened.activeAfterTamper).toEqual(reopened.activeAfterCancellation);

    expect(reopened.receiptCustodyError).toEqual({
      name: "ModelCompositionStoreError",
      code: "model-composition-store-stored-qualification-receipt",
      memberName: null,
      stagingId: null
    });
    expect(reopened.pointerAfterReceiptTamper).toBe(reopened.pointerBeforeFailures);
    expect(reopened.activeAfterReceiptRestore).toEqual(persistedIdentity);

    expect(reopened.catalogCustodyError).toEqual({
      name: "ModelCompositionStoreError",
      code: "model-composition-store-stored-catalog",
      memberName: null,
      stagingId: null
    });
    expect(reopened.pointerAfterCatalogTamper).toBe(reopened.pointerBeforeFailures);
    expect(reopened.pointerAfterAuthorityRestore).toBe(reopened.pointerBeforeFailures);
    expect(reopened.activeAfterCatalogRestore).toEqual(persistedIdentity);
    expect(reopened.finalStagingEntries).toEqual([]);
    expect(reopened.finalInstalledEntries).toEqual([{
      name: fixtures.active.manifestSha256,
      kind: "directory"
    }]);

    expect(reopened.lockObservations.requests).toBeGreaterThanOrEqual(9);
    expect(reopened.lockObservations.maxWriterHeld).toBe(1);
    expect(reopened.lockObservations.maxHeld).toBe(2);
    expect(reopened.lockObservations.held).toBe(0);
    expect(reopened.lockObservations.names.every(name => name === LOCK_NAME ||
      (name.startsWith(`${LOCK_NAME}:`) && /^[0-9a-f]{64}$/u.test(name.slice(LOCK_NAME.length + 1))))).toBe(true);
    expect(reopened.lockObservations.modes.every((mode, index) =>
      reopened.lockObservations.names[index] === LOCK_NAME ? mode === "exclusive" :
        ["shared", "exclusive"].includes(mode))).toBe(true);
    expect(reopened.shaObservations.instances).toBeGreaterThan(MEMBER_NAMES.length * 3);
    expect(reopened.shaObservations.updates).toBeGreaterThan(reopened.shaObservations.instances);
    expect(reopened.shaObservations.digests).toBeLessThanOrEqual(reopened.shaObservations.instances);
  } finally {
    if (context !== null) await context.close();
    removeOwnedBrowserProfile(profileRoot);
  }
});
