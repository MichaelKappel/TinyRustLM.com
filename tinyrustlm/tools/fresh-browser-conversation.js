"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const campaign = require("./dogfood-campaign.js");
const { canonicalJson } = require("./campaign-evidence-store.js");
const browserModelAdmission = require("../app/browser-model-admission.js");
const {
  assertOwnedProfileFresh,
  createOwnedBrowserProfile,
  createOwnedProfileRoot,
  deleteOwnedBrowserProfile,
  removeOwnedProfileRoot
} = require("./owned-browser-profile.js");

const executionSchema = "tinyrustlm.fresh_browser_conversation.v4";
const projectHosts = new Set([
  "tinyrustlm.com",
  "www.tinyrustlm.com",
  "minimodel.org",
  "www.minimodel.org",
  "uaix.org",
  "www.uaix.org"
]);
const maximumScanFiles = 20_000;
const maximumScanBytes = 512 * 1024 * 1024;
const maximumScannedFileBytes = 64 * 1024 * 1024;
const maximumBrowserStateItems = 10_000;
const maximumBrowserStateBytes = 32 * 1024 * 1024;
const maximumBrowserStateItemBytes = 1024 * 1024;
const maximumKnownSecrets = 128;
const maximumKnownSecretBytes = 4096;

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function validatedApplicationUrl(value) {
  const parsed = new URL(String(value || ""));
  invariant(parsed.protocol === "https:" ||
    (parsed.protocol === "http:" && isLoopbackHost(parsed.hostname)),
  "browser application URL must use HTTPS except for loopback tests");
  invariant(parsed.username === "" && parsed.password === "" && parsed.hash === "",
    "browser application URL must not contain credentials or a fragment");
  invariant(parsed.search === "", "browser application URL must not contain a query");
  return parsed;
}

function isLoopbackHost(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "::1" || host === "127.0.0.1" ||
    /^127(?:\.\d{1,3}){3}$/.test(host);
}

function safeNetworkRecord(request) {
  let parsed;
  try {
    parsed = new URL(request.url());
  } catch (_error) {
    return null;
  }
  return {
    url: parsed.href,
    origin: parsed.origin,
    protocol: parsed.protocol,
    hostname: parsed.hostname.toLowerCase(),
    pathname: parsed.pathname,
    method: String(request.method() || "").toUpperCase(),
    resourceType: String(request.resourceType() || ""),
    postData: request.postData() || ""
  };
}

function containsPrompt(record, prompts) {
  const candidates = [record.url, record.postData];
  for (const prompt of prompts) {
    const text = String(prompt);
    if (candidates.some((candidate) => candidate.includes(text) ||
      candidate.includes(encodeURIComponent(text)))) {
      return true;
    }
  }
  return false;
}

function analyzeNetworkRequests(records, options) {
  invariant(Array.isArray(records) && isPlainObject(options),
    "browser network analysis input is invalid");
  const applicationOrigin = validatedApplicationUrl(options.applicationUrl).origin;
  const prompts = Array.isArray(options.prompts) ? options.prompts.map(String) : [];
  const explicitlyAllowedOrigins = new Set([applicationOrigin]);
  for (const value of options.allowedOrigins || []) {
    const parsed = new URL(String(value));
    invariant(parsed.username === "" && parsed.password === "" && parsed.search === "" &&
      parsed.hash === "", "allowed browser origin is credential-bearing");
    explicitlyAllowedOrigins.add(parsed.origin);
  }
  let publicPromptLeakCount = 0;
  let publicModelByteRequestCount = 0;
  let unexpectedLocalAppRequestCount = 0;
  let unexpectedThirdPartyRequestCount = 0;
  for (const record of records) {
    if (!record || !["http:", "https:"].includes(record.protocol)) {
      continue;
    }
    const onProjectHost = projectHosts.has(record.hostname);
    if (onProjectHost && containsPrompt(record, prompts)) {
      publicPromptLeakCount += 1;
    }
    if (onProjectHost && /\.slm$/i.test(record.pathname)) {
      publicModelByteRequestCount += 1;
    }
    if (!explicitlyAllowedOrigins.has(record.origin)) {
      if (isLoopbackHost(record.hostname)) {
        unexpectedLocalAppRequestCount += 1;
      } else {
        unexpectedThirdPartyRequestCount += 1;
      }
    }
  }
  return Object.freeze({
    publicPromptLeakCount,
    publicModelByteRequestCount,
    unexpectedLocalAppRequestCount,
    unexpectedThirdPartyRequestCount
  });
}

function secretRepresentations(value) {
  const text = String(value || "");
  if (!text) {
    return [];
  }
  const utf8 = Buffer.from(text, "utf8");
  return [
    utf8,
    Buffer.from(text, "utf16le"),
    Buffer.from(utf8.toString("base64"), "ascii")
  ];
}

function normalizedKnownSecrets(values) {
  invariant(Array.isArray(values) && values.length <= maximumKnownSecrets,
    "known browser secrets are invalid");
  const secrets = values.map((value) => String(value || "")).filter(Boolean);
  invariant(secrets.every((secret) =>
    Buffer.byteLength(secret, "utf8") <= maximumKnownSecretBytes),
  "known browser secret is outside its size limit");
  return Object.freeze([...new Set(secrets)]);
}

function secretTextNeedles(values) {
  return normalizedKnownSecrets(values).flatMap((secret) => [
    secret,
    encodeURIComponent(secret),
    Buffer.from(secret, "utf8").toString("base64")
  ]);
}

function createSecretTextAudit(knownSecrets) {
  const needles = secretTextNeedles(knownSecrets);
  let eventCount = 0;
  let matchCount = 0;
  return Object.freeze({
    observe(value) {
      eventCount += 1;
      const text = String(value || "");
      if (needles.some((needle) => needle && text.includes(needle))) {
        matchCount += 1;
      }
    },
    snapshot() {
      return Object.freeze({ complete: true, matchCount, eventCount });
    }
  });
}

function emptyBrowserStateScan() {
  return {
    complete: false,
    matchCount: 0,
    itemCount: 0,
    bytesScanned: 0,
    localStorageItemCount: 0,
    sessionStorageItemCount: 0,
    cookieCount: 0,
    indexedDbDatabaseCount: 0,
    cacheCount: 0,
    serviceWorkerCount: 0,
    opfsFileCount: 0
  };
}

async function scanBrowserState(page, context, applicationUrl, knownSecrets) {
  const secrets = normalizedKnownSecrets(knownSecrets);
  const cookieAudit = createSecretTextAudit(secrets);
  let cookies = [];
  try {
    cookies = await context.cookies(applicationUrl.href);
    for (const cookie of cookies) {
      cookieAudit.observe(`${cookie.name}=${cookie.value};${cookie.domain};${cookie.path}`);
    }
  } catch (_error) {
    return Object.freeze(emptyBrowserStateScan());
  }
  const result = await page.evaluate(async (input) => {
    const state = {
      complete: true,
      matchCount: 0,
      itemCount: 0,
      bytesScanned: 0,
      localStorageItemCount: 0,
      sessionStorageItemCount: 0,
      indexedDbDatabaseCount: 0,
      cacheCount: 0,
      serviceWorkerCount: 0,
      opfsFileCount: 0
    };
    const utf8 = new TextEncoder();
    const needles = [...new Set(input.secrets.flatMap((secret) => {
      const bytes = utf8.encode(secret);
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return [secret, encodeURIComponent(secret), btoa(binary)];
    }))];

    function inspectText(value) {
      if (state.itemCount >= input.maximumItems ||
          state.bytesScanned >= input.maximumBytes) {
        state.complete = false;
        return false;
      }
      const text = String(value ?? "");
      const byteCount = utf8.encode(text).byteLength;
      state.itemCount += 1;
      if (byteCount > input.maximumItemBytes ||
          state.bytesScanned + byteCount > input.maximumBytes) {
        state.complete = false;
      }
      state.bytesScanned += Math.min(byteCount, input.maximumItemBytes);
      if (needles.some((needle) => needle && text.includes(needle))) {
        state.matchCount += 1;
      }
      return state.complete;
    }

    function inspectBytes(value) {
      const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
      if (bytes.byteLength > input.maximumItemBytes) {
        state.complete = false;
      }
      const bounded = bytes.subarray(0, input.maximumItemBytes);
      inspectText(new TextDecoder("utf-8", { fatal: false }).decode(bounded));
      inspectText(new TextDecoder("utf-16le", { fatal: false }).decode(bounded));
    }

    function inspectValue(value) {
      if (value instanceof ArrayBuffer) {
        inspectBytes(value);
        return;
      }
      if (ArrayBuffer.isView(value)) {
        inspectBytes(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
        return;
      }
      if (value instanceof Blob) {
        state.complete = false;
        return;
      }
      try {
        inspectText(typeof value === "string" ? value : JSON.stringify(value));
      } catch (_error) {
        state.complete = false;
      }
    }

    async function inspectObjectStore(database, storeName) {
      await new Promise((resolve) => {
        let transaction;
        try {
          transaction = database.transaction(storeName, "readonly");
          const request = transaction.objectStore(storeName).openCursor();
          request.onerror = () => {
            state.complete = false;
            resolve();
          };
          request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor || state.itemCount >= input.maximumItems) {
              if (cursor) state.complete = false;
              resolve();
              return;
            }
            inspectValue(cursor.key);
            inspectValue(cursor.value);
            cursor.continue();
          };
          transaction.onabort = () => {
            state.complete = false;
            resolve();
          };
        } catch (_error) {
          state.complete = false;
          resolve();
        }
      });
    }

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      inspectText(key);
      inspectText(localStorage.getItem(key));
      state.localStorageItemCount += 1;
    }
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      inspectText(key);
      inspectText(sessionStorage.getItem(key));
      state.sessionStorageItemCount += 1;
    }
    inspectText(location.href);
    inspectText(document.referrer);

    if (typeof indexedDB.databases !== "function") {
      state.complete = false;
    } else {
      try {
        const databases = await indexedDB.databases();
        state.indexedDbDatabaseCount = databases.length;
        for (const descriptor of databases) {
          if (!descriptor.name || state.itemCount >= input.maximumItems) {
            state.complete = false;
            continue;
          }
          inspectText(descriptor.name);
          const database = await new Promise((resolve, reject) => {
            const request = indexedDB.open(descriptor.name);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
          });
          try {
            for (const storeName of database.objectStoreNames) {
              inspectText(storeName);
              await inspectObjectStore(database, storeName);
            }
          } finally {
            database.close();
          }
        }
      } catch (_error) {
        state.complete = false;
      }
    }

    if (!globalThis.caches) {
      state.complete = false;
    } else {
      try {
        const cacheNames = await caches.keys();
        state.cacheCount = cacheNames.length;
        for (const cacheName of cacheNames) {
          inspectText(cacheName);
          const cache = await caches.open(cacheName);
          const requests = await cache.keys();
          for (const request of requests) {
            inspectText(`${request.method} ${request.url}`);
            for (const [name, value] of request.headers) {
              inspectText(`${name}:${value}`);
            }
            const response = await cache.match(request);
            if (!response) {
              state.complete = false;
              continue;
            }
            for (const [name, value] of response.headers) {
              inspectText(`${name}:${value}`);
            }
            const declaredLength = Number(response.headers.get("content-length"));
            if (Number.isFinite(declaredLength) &&
                declaredLength > input.maximumItemBytes) {
              state.complete = false;
              continue;
            }
            const bytes = new Uint8Array(await response.clone().arrayBuffer());
            inspectBytes(bytes);
          }
        }
      } catch (_error) {
        state.complete = false;
      }
    }

    if (!navigator.serviceWorker) {
      state.complete = false;
    } else {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        state.serviceWorkerCount = registrations.length;
        for (const registration of registrations) {
          inspectText(registration.scope);
          for (const worker of [
            registration.installing,
            registration.waiting,
            registration.active
          ]) {
            if (worker) inspectText(worker.scriptURL);
          }
        }
      } catch (_error) {
        state.complete = false;
      }
    }

    if (!navigator.storage?.getDirectory) {
      state.complete = false;
    } else {
      try {
        const root = await navigator.storage.getDirectory();
        const pending = [root];
        while (pending.length > 0) {
          const directory = pending.pop();
          for await (const [name, handle] of directory.entries()) {
            inspectText(name);
            if (handle.kind === "directory") {
              pending.push(handle);
              continue;
            }
            state.opfsFileCount += 1;
            const file = await handle.getFile();
            if (file.size > input.maximumItemBytes) {
              state.complete = false;
              continue;
            }
            inspectBytes(new Uint8Array(await file.arrayBuffer()));
          }
        }
      } catch (_error) {
        state.complete = false;
      }
    }
    return state;
  }, {
    secrets,
    maximumItems: maximumBrowserStateItems,
    maximumBytes: maximumBrowserStateBytes,
    maximumItemBytes: maximumBrowserStateItemBytes
  });
  const cookieScan = cookieAudit.snapshot();
  return Object.freeze({
    ...result,
    complete: result.complete && cookieScan.complete,
    matchCount: result.matchCount + cookieScan.matchCount,
    itemCount: result.itemCount + cookieScan.eventCount,
    cookieCount: cookies.length
  });
}

function scanProfileForSecrets(profilePath, knownSecrets) {
  const representations = normalizedKnownSecrets(knownSecrets).flatMap(secretRepresentations);
  if (representations.length === 0) {
    return Object.freeze({ complete: true, matchCount: 0, filesScanned: 0, bytesScanned: 0 });
  }
  const rootPath = fs.realpathSync.native(path.resolve(profilePath));
  const pending = [rootPath];
  let filesScanned = 0;
  let bytesScanned = 0;
  let matchCount = 0;
  let complete = true;
  while (pending.length > 0) {
    const current = pending.pop();
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (!stat || stat.isSymbolicLink()) {
      complete = false;
      continue;
    }
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        pending.push(path.join(current, entry));
      }
      continue;
    }
    if (!stat.isFile()) {
      continue;
    }
    if (filesScanned >= maximumScanFiles || stat.size > maximumScannedFileBytes ||
      bytesScanned + stat.size > maximumScanBytes) {
      complete = false;
      continue;
    }
    const bytes = fs.readFileSync(current);
    filesScanned += 1;
    bytesScanned += bytes.length;
    if (representations.some((needle) => bytes.indexOf(needle) >= 0)) {
      matchCount += 1;
    }
  }
  return Object.freeze({ complete, matchCount, filesScanned, bytesScanned });
}

function boundedViewport(value) {
  const viewport = value || { width: 1365, height: 768 };
  invariant(isPlainObject(viewport) && Number.isSafeInteger(viewport.width) &&
    viewport.width >= 320 && viewport.width <= 3840 && Number.isSafeInteger(viewport.height) &&
    viewport.height >= 480 && viewport.height <= 2160, "browser viewport is invalid");
  return Object.freeze({ width: viewport.width, height: viewport.height });
}

function timeoutValue(value, fallback, maximum) {
  const number = value === undefined ? fallback : Number(value);
  invariant(Number.isSafeInteger(number) && number >= 1_000 && number <= maximum,
    "browser timeout is invalid");
  return number;
}

function profileDeletionHash(deletion) {
  return sha256(canonicalJson(deletion));
}

function failureCodeForPhase(phase) {
  const codes = {
    launch: "browser_launch_failed",
    navigate: "application_navigation_failed",
    runtime: "wasm_runtime_not_ready",
    model: "browser_model_load_failed",
    conversation: "browser_generation_failed",
    inspect: "browser_evidence_inspection_failed"
  };
  return codes[phase] || "browser_round_failed";
}

function emptyCompositionObservation() {
  return {
    activated: false,
    bundleSha256: "0".repeat(64),
    compositionId: "none",
    activeGraphSha256: "0".repeat(64),
    routePolicyId: "none",
    kvFormatId: "none",
    memberCount: 0,
    activationCount: 0,
    graphRequestCount: 0
  };
}

function activeCompositionObservation(diagnostics, model) {
  invariant(isPlainObject(diagnostics), "browser composition diagnostics are invalid");
  invariant(diagnostics.model_loaded === true && diagnostics.composition_active === true,
    "browser did not activate an immutable composition graph");
  invariant(diagnostics.active_composition_bundle_sha256 ===
    `sha256:${model.compositionGraphSha256}`,
  "browser active composition bundle changed");
  invariant(diagnostics.active_composition_id === model.compositionId,
    "browser active composition identity changed");
  invariant(diagnostics.active_composition_graph_sha256 ===
    `sha256:${model.compositionActiveGraphSha256}`,
  "browser active composition graph identity changed");
  invariant(diagnostics.active_route_policy_id === model.compositionRoutePolicyId,
    "browser active composition route policy changed");
  invariant(diagnostics.active_kv_format_id === model.compositionKvFormatId,
    "browser active composition KV format changed");
  invariant(diagnostics.active_composition_member_count === model.compositionMemberCount,
    "browser active composition member count changed");
  invariant(Number.isSafeInteger(diagnostics.composition_activation_count) &&
    diagnostics.composition_activation_count >= 1,
  "browser composition activation count is invalid");
  return {
    activated: true,
    bundleSha256: model.compositionGraphSha256,
    compositionId: model.compositionId,
    activeGraphSha256: model.compositionActiveGraphSha256,
    routePolicyId: model.compositionRoutePolicyId,
    kvFormatId: model.compositionKvFormatId,
    memberCount: model.compositionMemberCount,
    activationCount: diagnostics.composition_activation_count,
    graphRequestCount: 0
  };
}

function sameDecimal(left, right) {
  return Number.isFinite(left) && Number.isFinite(right) &&
    Math.abs(left - right) <= 0.0005;
}

function samplingObservation(diagnostics, round, model) {
  invariant(isPlainObject(diagnostics) && diagnostics.model_loaded === true,
    "browser sampling diagnostics are invalid");
  invariant(
    sameDecimal(diagnostics.sampling_temperature, round.sampling.temperature) &&
      diagnostics.sampling_top_k === round.sampling.topK &&
      sameDecimal(diagnostics.sampling_top_p, round.sampling.topP) &&
      diagnostics.sampling_seed === round.sampling.seed &&
      sameDecimal(
        diagnostics.sampling_repetition_penalty,
        model.samplingRepetitionPenalty
      ),
    "browser runtime sampling identity changed"
  );
  invariant(Number.isSafeInteger(diagnostics.generated_token_count) &&
    diagnostics.generated_token_count >= 0 &&
    diagnostics.generated_token_count <= round.sampling.maxTokens,
  "browser generated token count exceeded the sealed maximum");
  return Object.freeze({
    maxTokens: round.sampling.maxTokens,
    temperature: round.sampling.temperature,
    topK: round.sampling.topK,
    topP: round.sampling.topP,
    seed: round.sampling.seed,
    repetitionPenalty: model.samplingRepetitionPenalty,
    generatedTokenCount: diagnostics.generated_token_count
  });
}

async function setSamplingControls(page, sampling) {
  invariant(isPlainObject(sampling), "browser sampling configuration is invalid");
  const values = {
    maxTokens: sampling.maxTokens,
    temperature: sampling.temperature,
    topK: sampling.topK,
    topP: sampling.topP,
    seed: sampling.seed
  };
  await page.evaluate((input) => {
    for (const [id, value] of Object.entries(input)) {
      const control = document.getElementById(id);
      if (!(control instanceof HTMLInputElement)) {
        throw new Error(`sampling control ${id} is unavailable`);
      }
      control.value = String(value);
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
      if (control.value !== String(value)) {
        throw new Error(`sampling control ${id} rejected its sealed value`);
      }
    }
  }, values);
}

async function runtimeIdentityObservation(page, model, admissionSha256) {
  const observed = await page.evaluate(() => {
    const data = document.documentElement.dataset;
    return {
      admissionSha256: data.activeBrowserAdmissionSha256 || "",
      artifactSha256: data.activeArtifactSha256 || "",
      manifestSha256: data.activeManifestSha256 || "",
      qualityEvidenceSha256: data.activeQualityEvidenceSha256 || "",
      qualificationReceiptId: data.activeQualificationReceiptId || "",
      promptFormat: data.activePromptFormat || "",
      systemPromptSha256: data.activeSystemPromptSha256 || "",
      modelSamplingProfile: data.activeModelSamplingProfile || ""
    };
  });
  invariant(
    observed.admissionSha256 === admissionSha256 &&
      observed.artifactSha256 === model.artifactSha256 &&
      observed.manifestSha256 === model.manifestSha256 &&
      observed.qualityEvidenceSha256 === model.qualityEvidenceSha256 &&
      observed.qualificationReceiptId === model.qualificationReceiptId &&
      observed.promptFormat === model.promptFormat &&
      observed.systemPromptSha256 === model.systemPromptSha256 &&
      observed.modelSamplingProfile === model.modelSamplingProfile,
    "browser runtime admission identity changed"
  );
  return Object.freeze(observed);
}

async function runFreshBrowserConversation(options) {
  invariant(isPlainObject(options), "fresh browser round options are invalid");
  invariant(isPlainObject(options.round) && isPlainObject(options.model),
    "fresh browser round model or schedule is missing");
  const round = options.round;
  const model = options.model;
  invariant(Number.isSafeInteger(round.round) && round.round >= 1,
    "fresh browser round number is invalid");
  invariant(round.modelId === model.modelId, "fresh browser round model identity changed");
  invariant(Array.isArray(round.prompts) && round.prompts.length >= 2 && round.prompts.length <= 6,
    "fresh browser round requires two to six turns");
  invariant(round.memoryContinuity !== true,
    "live MemoryEndpoints executor is required for a hosted-memory continuity round");
  const applicationUrl = validatedApplicationUrl(options.applicationUrl);
  const viewport = boundedViewport(options.viewport);
  const modelLoadTimeoutMs = timeoutValue(options.modelLoadTimeoutMs, 30 * 60 * 1000,
    60 * 60 * 1000);
  const generationTimeoutMs = timeoutValue(options.generationTimeoutMs, 10 * 60 * 1000,
    30 * 60 * 1000);
  const knownSecrets = normalizedKnownSecrets(options.knownSecrets || []);
  const modelEvidence = await campaign.verifyModelEvidence(model);
  const startedAtUtc = new Date().toISOString();
  const root = createOwnedProfileRoot({
    parentDirectory: options.profileParent,
    campaignId: options.campaignId
  });
  const profile = createOwnedBrowserProfile(root, { round: round.round, role: "primary" });
  const freshProfileBefore = assertOwnedProfileFresh(root, profile);
  const requestRecords = [];
  const turns = [];
  let context = null;
  let page = null;
  let browserVersion = "";
  let browserExecutableSha256 = "0".repeat(64);
  let playwrightVersion = "unknown";
  let phase = "launch";
  let failureCode = null;
  let userMessageCount = 0;
  let assistantMessageCount = 0;
  let authoritativeResponseCount = 0;
  let composition = emptyCompositionObservation();
  let runtimeIdentity = null;
  const samplingTurns = [];
  let profileScan = { complete: false, matchCount: 0, filesScanned: 0, bytesScanned: 0 };
  let browserStateScan = emptyBrowserStateScan();
  const consoleAudit = createSecretTextAudit(knownSecrets);
  let consoleScan = { complete: false, matchCount: 0, eventCount: 0 };
  let deletion = null;
  try {
    const { chromium } = require("@playwright/test");
    playwrightVersion = require("@playwright/test/package.json").version;
    browserExecutableSha256 = await campaign.sha256File(chromium.executablePath());
    context = await chromium.launchPersistentContext(profile.profilePath, {
      headless: options.headless !== false,
      viewport,
      locale: "en-US",
      colorScheme: "dark",
      reducedMotion: options.reducedMotion === true ? "reduce" : "no-preference",
      acceptDownloads: false,
      permissions: [],
      serviceWorkers: "allow",
      args: [
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-default-apps",
        "--disable-extensions",
        "--disable-sync",
        "--no-default-browser-check",
        "--no-first-run"
      ]
    });
    browserVersion = context.browser()?.version() || "unknown";
    context.on("request", (request) => {
      const record = safeNetworkRecord(request);
      if (record) {
        requestRecords.push(record);
      }
    });
    const observedPages = new WeakSet();
    const observePage = (candidatePage) => {
      if (observedPages.has(candidatePage)) return;
      observedPages.add(candidatePage);
      candidatePage.on("console", (message) => consoleAudit.observe(message.text()));
      candidatePage.on("pageerror", (error) => consoleAudit.observe(error.message));
    };
    context.on("page", observePage);
    const pages = context.pages();
    page = pages[0] || await context.newPage();
    observePage(page);
    phase = "navigate";
    await page.goto(applicationUrl.href, { waitUntil: "domcontentloaded", timeout: 60_000 });
    phase = "runtime";
    await page.locator("#wasmState").waitFor({ state: "attached", timeout: 30_000 });
    await page.waitForFunction(() => document.getElementById("wasmState")?.textContent === "loaded", null, {
      timeout: 60_000
    });
    phase = "model";
    const admission = browserModelAdmission.admissionForModel(
      model,
      path.basename(model.artifactPath)
    );
    const admissionText = browserModelAdmission.serializeAdmission(admission, {
      applicationOrigin: applicationUrl.origin
    });
    const admissionSha256 = sha256(admissionText);
    const admissionFileName =
      `${path.basename(model.artifactPath)}.browser-model-admission.json`;
    await page.locator("#modelEditButton").click();
    await page.locator("#simpleOpenAdvancedDiscoveryButton").click();
    await page.locator("#localModelFile").setInputFiles([
      model.artifactPath,
      {
        name: admissionFileName,
        mimeType: "application/json",
        buffer: Buffer.from(admissionText, "utf8")
      }
    ]);
    const selectedFile = await page.locator("#localModelFile").evaluate((input) => {
      const files = Array.from(input.files || []);
      const modelFile = files.find((file) => /\.slm$/i.test(file.name));
      const admissionFile = files.find((file) =>
        /\.browser-model-admission\.json$/i.test(file.name));
      return {
        count: files.length,
        modelSize: modelFile ? modelFile.size : 0,
        admissionSize: admissionFile ? admissionFile.size : 0
      };
    });
    invariant(selectedFile.count === 2 &&
      selectedFile.modelSize === model.artifactByteCount &&
      selectedFile.admissionSize === Buffer.byteLength(admissionText, "utf8"),
      "browser file picker model identity changed");
    await page.locator("#importLocalModelButton").click();
    await page.waitForFunction(() => document.getElementById("runtimeStatus")?.textContent === "Ready", null, {
      timeout: modelLoadTimeoutMs
    });
    await page.waitForFunction(() => /loaded/i.test(
      document.getElementById("localModelState")?.textContent || ""
    ), null, { timeout: modelLoadTimeoutMs });
    await page.waitForFunction((expected) =>
      document.documentElement.dataset.activeBrowserAdmissionSha256 === expected,
    admissionSha256, { timeout: modelLoadTimeoutMs });
    invariant(await page.locator("#generateButton").isEnabled(),
      "browser generate control stayed disabled after model load");
    const diagnosticsText = await page.locator("#diagnostics").textContent();
    composition = activeCompositionObservation(JSON.parse(diagnosticsText || ""), model);
    runtimeIdentity = await runtimeIdentityObservation(page, model, admissionSha256);
    await setSamplingControls(page, round.sampling);
    phase = "conversation";
    for (let index = 0; index < round.prompts.length; index += 1) {
      const prompt = round.prompts[index];
      await page.locator("#prompt").fill(prompt);
      await page.locator("#prompt").press("Enter");
      const expectedMessages = (index + 1) * 2;
      await page.waitForFunction((count) => {
        const shell = document.querySelector(".app-shell");
        const messages = document.querySelectorAll("#conversation .message");
        return shell?.dataset.generationState === "idle" && messages.length === count;
      }, expectedMessages, { timeout: generationTimeoutMs });
      const assistant = page.locator("#conversation .message-assistant").nth(index);
      invariant(await assistant.getAttribute("data-status") === "completed",
        "browser assistant turn did not complete");
      const assistantText = await assistant.locator(".message-text").innerText();
      invariant(assistantText.trim().length > 0, "browser assistant turn was empty");
      const turnDiagnosticsText = await page.locator("#diagnostics").textContent();
      samplingTurns.push(samplingObservation(
        JSON.parse(turnDiagnosticsText || ""),
        round,
        model
      ));
      turns.push({ prompt, assistant: assistantText });
      userMessageCount = await page.locator("#conversation .message-user").count();
      assistantMessageCount = await page.locator("#conversation .message-assistant").count();
      authoritativeResponseCount = await page.locator("#conversation #response").count();
      invariant(userMessageCount === index + 1 && assistantMessageCount === index + 1 &&
        authoritativeResponseCount === 1, "browser response renderer count drifted");
      if (index === 0) {
        invariant(await page.locator("#simpleExperience").isHidden() &&
          await page.locator(".starter-grid").isHidden(),
        "browser introductory content remained after chat began");
      }
    }
    phase = "inspect";
    const layout = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      composerBottom: document.getElementById("chatForm")?.getBoundingClientRect().bottom || 0,
      viewportHeight: document.documentElement.clientHeight
    }));
    invariant(layout.documentWidth <= layout.viewportWidth + 1 &&
      layout.composerBottom <= layout.viewportHeight + 1,
    "browser conversation layout overflowed its viewport");
  } catch (_error) {
    failureCode = failureCodeForPhase(phase);
  } finally {
    if (context && page) {
      try {
        browserStateScan = await scanBrowserState(
          page,
          context,
          applicationUrl,
          knownSecrets
        );
      } catch (_error) {
        browserStateScan = emptyBrowserStateScan();
      }
    }
    if (!browserStateScan.complete) {
      failureCode = failureCode || "browser_secret_scan_incomplete";
    } else if (browserStateScan.matchCount > 0) {
      failureCode = failureCode || "browser_secret_exposure_detected";
    }
    if (context) {
      try {
        await context.close();
      } catch (_error) {
        failureCode = failureCode || "browser_process_close_failed";
      }
    }
    consoleScan = consoleAudit.snapshot();
    if (!consoleScan.complete) {
      failureCode = failureCode || "browser_secret_scan_incomplete";
    } else if (consoleScan.matchCount > 0) {
      failureCode = failureCode || "browser_secret_exposure_detected";
    }
    profileScan = scanProfileForSecrets(profile.profilePath, knownSecrets);
    if (!profileScan.complete || profileScan.matchCount > 0) {
      failureCode = failureCode || (profileScan.matchCount > 0
        ? "browser_secret_exposure_detected"
        : "browser_secret_scan_incomplete");
    }
    deletion = deleteOwnedBrowserProfile(root, profile);
    removeOwnedProfileRoot(root);
  }
  const network = analyzeNetworkRequests(requestRecords, {
    applicationUrl: applicationUrl.href,
    prompts: round.prompts,
    allowedOrigins: options.allowedOrigins || []
  });
  const graphRequestCount = requestRecords.filter((record) =>
    record.method === "GET" && record.url === model.compositionGraphUrl).length;
  composition = Object.freeze({ ...composition, graphRequestCount });
  if (composition.activated && graphRequestCount !== 1) {
    failureCode = failureCode || "browser_composition_graph_request_failed";
  }
  if (Object.values(network).some((count) => count !== 0)) {
    failureCode = failureCode || "browser_network_boundary_failed";
  }
  const rawConversationSha256 = sha256(canonicalJson({
    modelArtifactSha256: modelEvidence.artifactSha256,
    qualificationReceiptId: model.qualificationReceiptId,
    runtimeIdentity,
    sampling: round.sampling,
    turns
  }));
  const evidence = Object.freeze({
    freshProfileBefore,
    firstProfileDeleted: deletion.deleted,
    finalProfileDeleted: deletion.deleted,
    secondProfileFresh: false,
    modelHashVerified: modelEvidence.artifactSha256 === model.artifactSha256,
    manifestVerified: /^[a-f0-9]{64}$/.test(modelEvidence.manifestSha256),
    qualityEvidenceVerified: /^[a-f0-9]{64}$/.test(modelEvidence.qualityEvidenceSha256),
    userMessageCount,
    assistantMessageCount,
    authoritativeResponseCount,
    rawConversationSha256,
    publicPromptLeakCount: network.publicPromptLeakCount,
    publicModelByteRequestCount: network.publicModelByteRequestCount,
    unexpectedLocalAppRequestCount: network.unexpectedLocalAppRequestCount,
    unexpectedThirdPartyRequestCount: network.unexpectedThirdPartyRequestCount,
    secretsPersisted: !profileScan.complete || profileScan.matchCount > 0 ||
      !browserStateScan.complete || browserStateScan.matchCount > 0 ||
      !consoleScan.complete || consoleScan.matchCount > 0,
    memoryContinuityRequired: false,
    memoryShortTermRestored: false,
    memoryLongTermRestored: false,
    memoryAnswerRestored: false,
    oneTimeUrlReplayRejected: false,
    companyClosed: false,
    companyDeleted: false,
    publicAnnouncementVerified: false
  });
  return Object.freeze({
    schema: executionSchema,
    evidenceClass: "browser",
    status: failureCode ? "fail" : "pass",
    failureCode,
    startedAtUtc,
    completedAtUtc: new Date().toISOString(),
    round: round.round,
    modelId: model.modelId,
    browserName: "chromium",
    browserVersion,
    browserVersionSha256: sha256(browserVersion),
    browserExecutableSha256,
    playwrightVersion,
    viewport,
    profileRootMarkerHash: root.rootMarkerHash,
    profileMarkerHash: profile.profileMarkerHash,
    profileDeletionReceiptSha256: profileDeletionHash(deletion),
    networkRequestCount: requestRecords.length,
    composition,
    runtimeIdentity: runtimeIdentity || Object.freeze({
      admissionSha256: "0".repeat(64),
      artifactSha256: "0".repeat(64),
      manifestSha256: "0".repeat(64),
      qualityEvidenceSha256: "0".repeat(64),
      qualificationReceiptId: "none",
      promptFormat: "none",
      systemPromptSha256: "0".repeat(64),
      modelSamplingProfile: "none"
    }),
    sampling: Object.freeze({
      maxTokens: round.sampling.maxTokens,
      temperature: round.sampling.temperature,
      topK: round.sampling.topK,
      topP: round.sampling.topP,
      seed: round.sampling.seed,
      repetitionPenalty: model.samplingRepetitionPenalty,
      turns: Object.freeze(samplingTurns.slice())
    }),
    browserStateScan: Object.freeze({ ...browserStateScan }),
    consoleScan: Object.freeze({ ...consoleScan }),
    profileScan: Object.freeze({
      complete: profileScan.complete,
      matchCount: profileScan.matchCount,
      filesScanned: profileScan.filesScanned,
      bytesScanned: profileScan.bytesScanned
    }),
    evidence
  });
}

module.exports = Object.freeze({
  analyzeNetworkRequests,
  activeCompositionObservation,
  createSecretTextAudit,
  executionSchema,
  isLoopbackHost,
  runFreshBrowserConversation,
  runtimeIdentityObservation,
  samplingObservation,
  scanBrowserState,
  scanProfileForSecrets,
  setSamplingControls
});
