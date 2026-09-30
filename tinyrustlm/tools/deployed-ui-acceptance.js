"use strict";

// This is a capture tool, not a qualification generator. Its registered UI contract
// deliberately preserves production defaults rather than injecting the separate
// native/browser qualification contract's system message, greedy seed or limits.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const childProcess = require("node:child_process");
const catalogApi = require("../app/minimodel-catalog-v1.js");
const admissionApi = require("../app/browser-model-admission.js");
const admissionLoader = require("../app/catalog-admission-loader.js");
const releaseApi = require("../app/site-release.js");
const { parseRequest } = require("./prompt2-reference.js");
const files = require("./immutable-publication-files.js");
const scratch = require("./canonical-operation-scratch.js");
const storage = require("./huggingface-candidate-storage.js");

const ROOT = path.resolve(__dirname, "../..");
const ORIGIN = "https://tinyrustlm.com";
const SCHEMA = "tinyrustlm.deployed-ui-acceptance-plan/1";
const CASE_PATH = "artifacts/ecosystem-cleanup-20260912/default-release-acceptance-cases-20260929.json";
const CASE_SHA256 = "49a5127667c50192e28bb755251c526118cc3caff87447eb733c3f21c2f1b6fa";
const HASH = /^[a-f0-9]{64}$/;
const REQUIRED_ASSETS = ["/", "/offline-worker.js", "/app/app.js", "/app/model-runtime-worker.js",
  "/app/model-runtime-client.js", "/app/prompt2-request.js", "/app/browser-model-admission.js",
  "/app/catalog-admission-loader.js", "/app/minimodel-catalog-v1.js", "/app/model-composition-store.js",
  "/browser-runtime/tinyrustlm-browser-runtime.wasm", "/browser-runtime/tinyrustlm-browser-runtime.wasm.manifest.json"];
const SAMPLING_FIELDS = admissionApi.samplingFields;

/** Reject with a stable code, never raw filesystem errors or arbitrary response text. */
function requireValue(value, code) { if (!value) throw new Error(code); }
/** Hash exact bytes, including raw assistant text and request wire bytes. */
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
/** Bound numbers before allocating, scheduling, or interpreting evidence. */
function integer(value, min, max, code) {
  requireValue(Number.isSafeInteger(value) && value >= min && value <= max, code);
}
/** Disallow undeclared controls that could silently change the experiment. */
function exact(value, fields, code) {
  requireValue(value && Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value).sort().join(",") === [...fields].sort().join(","), code);
}
/** Validate a content identity; filenames alone are not release authority. */
function identity(value, maximum) {
  exact(value, ["bytes", "sha256"], "ui-identity");
  integer(value.bytes, 1, maximum, "ui-identity-size");
  requireValue(HASH.test(value.sha256), "ui-identity-hash");
}
/** Only exact, canonical HTTPS release routes may be fetched by preflight. */
function releaseRoute(value) {
  requireValue(typeof value === "string" && value.startsWith("/") && !value.startsWith("//") &&
    !/[\\?#\x00-\x20]/u.test(value), "ui-asset-route");
  const url = new URL(value, ORIGIN);
  requireValue(url.origin === ORIGIN && url.pathname === value, "ui-asset-route");
  return url.href;
}

/** Validate the prospectively frozen UI plan without accessing a model or network. */
function validatePlan(plan) {
  exact(plan, ["schema", "registeredAtUtc", "toolSha256", "casesSha256", "release", "seed", "browser",
    "ui", "functional", "limits", "profileParent", "outputDirectory"], "ui-plan-fields");
  requireValue(plan.schema === SCHEMA && HASH.test(plan.toolSha256) && plan.casesSha256 === CASE_SHA256 &&
    new Date(plan.registeredAtUtc).toISOString() === plan.registeredAtUtc, "ui-plan-identity");
  exact(plan.release, ["sourceRevision", "marker", "assets", "additionalGetRoutes"], "ui-release-fields");
  requireValue(/^[a-f0-9]{40}$/.test(plan.release.sourceRevision), "ui-release-revision");
  identity(plan.release.marker, 16384);
  requireValue(Array.isArray(plan.release.assets) && plan.release.assets.length >= REQUIRED_ASSETS.length &&
    plan.release.assets.length <= 100, "ui-asset-closure");
  const routes = new Set();
  for (const asset of plan.release.assets) {
    exact(asset, ["route", "bytes", "sha256"], "ui-asset-fields");
    releaseRoute(asset.route); identity({ bytes: asset.bytes, sha256: asset.sha256 }, 16 * 1024 * 1024);
    requireValue(!routes.has(asset.route), "ui-asset-duplicate"); routes.add(asset.route);
  }
  requireValue(REQUIRED_ASSETS.every(route => routes.has(route)), "ui-asset-closure");
  requireValue(Array.isArray(plan.release.additionalGetRoutes) && plan.release.additionalGetRoutes.length <= 16,
    "ui-additional-routes");
  plan.release.additionalGetRoutes.forEach(releaseRoute);
  exact(plan.seed, ["entryId", "compositionId", "admissionSha256", "receiptSha256", "catalogSha256", "peerFeedSha256"],
    "ui-seed-fields");
  requireValue(typeof plan.seed.entryId === "string" && plan.seed.entryId.length <= 128 &&
    /^sha256:[a-f0-9]{64}$/.test(plan.seed.compositionId), "ui-seed-identity");
  for (const key of ["admissionSha256", "receiptSha256", "catalogSha256", "peerFeedSha256"])
    requireValue(HASH.test(plan.seed[key]), "ui-seed-identity");
  exact(plan.browser, ["path", "bytes", "sha256"], "ui-browser");
  requireValue(typeof plan.browser.path === "string" && path.isAbsolute(plan.browser.path), "ui-browser-path");
  identity({ bytes: plan.browser.bytes, sha256: plan.browser.sha256 }, 512 * 1024 * 1024);
  exact(plan.ui, ["contract", "systemMessages", "creativity", "length", "sampling", "seedPolicy", "templateSha256"],
    "ui-default-fields");
  requireValue(plan.ui.contract === "production-simple-defaults-distinct-from-qualification" &&
    Array.isArray(plan.ui.systemMessages) && plan.ui.systemMessages.length === 0 &&
    plan.ui.creativity === "balanced" && plan.ui.length === "normal" &&
    plan.ui.seedPolicy === "production-random-u32" && HASH.test(plan.ui.templateSha256), "ui-defaults");
  exact(plan.ui.sampling, SAMPLING_FIELDS, "ui-sampling-fields");
  for (const field of SAMPLING_FIELDS) integer(plan.ui.sampling[field], 0, 0xffffffff, "ui-sampling");
  requireValue(plan.ui.sampling.temperatureMillionths === 650000 && plan.ui.sampling.topK === 40 &&
    plan.ui.sampling.topPMillionths === 900000 && plan.ui.sampling.maximumNewTokens >= 1 &&
    plan.ui.sampling.maximumNewTokens <= 80, "ui-simple-sampling");
  exact(plan.functional, ["cancelPrompt", "cancelAfterTokens", "afterStopPrompt", "afterResetPrompt", "restartPrompt",
    "offlinePrompt", "interruption"], "ui-functional-fields");
  for (const key of ["cancelPrompt", "afterStopPrompt", "afterResetPrompt", "restartPrompt", "offlinePrompt"])
    requireValue(typeof plan.functional[key] === "string" && plan.functional[key].trim().length > 0 &&
      Buffer.byteLength(plan.functional[key]) <= 4096, "ui-functional-prompt");
  integer(plan.functional.cancelAfterTokens, 1, 16, "ui-cancel-trigger");
  requireValue(plan.functional.interruption === "close-after-first-model-response-body-progress", "ui-interruption");
  exact(plan.limits, ["installationMilliseconds", "maximumFirstTokenMilliseconds", "minimumSustainedDecodeTokensPerSecond",
    "maximumStopLatencyMilliseconds", "maximumTurnMilliseconds"], "ui-limit-fields");
  integer(plan.limits.installationMilliseconds, 1000, 3600000, "ui-install-limit");
  requireValue(plan.limits.maximumFirstTokenMilliseconds === 30000 &&
    plan.limits.minimumSustainedDecodeTokensPerSecond === 1 && plan.limits.maximumStopLatencyMilliseconds === 2000 &&
    plan.limits.maximumTurnMilliseconds === 180000, "ui-frozen-performance-limits");
  requireValue(typeof plan.profileParent === "string" && typeof plan.outputDirectory === "string", "ui-paths");
  return plan;
}

/** Require the exact public case bytes; UI settings are a separate, explicit contract. */
function acceptanceCases(bytes) {
  requireValue(sha256(bytes) === CASE_SHA256, "ui-cases-identity");
  const document = JSON.parse(bytes.toString("utf8"));
  requireValue(document.cases.length === 8 && document.cases.reduce((n, c) => n + c.turns.length, 0) === 9,
    "ui-cases-count");
  return document.cases;
}

/** Bound a GET stream and reject redirects before consuming release metadata or static assets. */
async function boundedGet(url, maximum, fetchImplementation = fetch) {
  const response = await fetchImplementation(url, { redirect: "error", cache: "no-store", credentials: "omit",
    signal: AbortSignal.timeout(30000) });
  requireValue(response.status === 200 && !response.redirected && response.body, "ui-http-response");
  const chunks = []; let bytes = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break;
      bytes += next.value.byteLength; requireValue(bytes <= maximum, "ui-http-size");
      chunks.push(Buffer.from(next.value));
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  return Buffer.concat(chunks);
}
/** Compare raw bytes with an immutable registered identity. */
function verifyBytes(bytes, expected, code) {
  requireValue(bytes.length === expected.bytes && sha256(bytes) === expected.sha256, code);
}

/** Verify the public marker, all registered assets and existing real qualification readers. */
async function preflight(plan, fetchImplementation = fetch) {
  const markerBytes = await boundedGet(`${ORIGIN}/.well-known/site-release.json`, 16384, fetchImplementation);
  verifyBytes(markerBytes, plan.release.marker, "ui-release-marker-hash");
  const marker = releaseApi.validateReleaseRecord(JSON.parse(markerBytes.toString("utf8")));
  requireValue(marker.sourceRevision === plan.release.sourceRevision, "ui-release-marker-revision");
  let html;
  for (const asset of plan.release.assets) {
    const bytes = await boundedGet(releaseRoute(asset.route), asset.bytes, fetchImplementation);
    verifyBytes(bytes, asset, "ui-deployed-asset"); if (asset.route === "/") html = bytes.toString("utf8");
  }
  // Every static executable/style dependency actually declared by this shell must be pinned too.
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const url = new URL(match[1], `${ORIGIN}/`);
    if (/\.(?:js|css|wasm)$/i.test(url.pathname)) requireValue(url.origin === ORIGIN &&
      plan.release.assets.some(asset => asset.route === url.pathname), "ui-shell-dependency-unpinned");
  }
  const catalog = await catalogApi.loadCurrentCatalog({ fetch: fetchImplementation, crypto: crypto.webcrypto });
  requireValue(catalog.authority && catalog.authority.peerFeed &&
    catalog.authority.catalog.sha256.replace(/^sha256:/, "") === plan.seed.catalogSha256 &&
    catalog.authority.peerFeed.sha256.replace(/^sha256:/, "") === plan.seed.peerFeedSha256, "ui-catalog-identity");
  const view = catalog.views.find(item => item.entryId === plan.seed.entryId);
  requireValue(view && view.composition.compositionId === plan.seed.compositionId &&
    view.availability === "peer" && view.peers[0]?.peerBaseUrl === "https://minimodel.org/", "ui-qualified-seed");
  const loaded = await admissionLoader.load({ catalogView: view, catalogBaseUrl: catalogApi.CATALOG_URL,
    fetch: fetchImplementation, crypto: crypto.webcrypto, admissionParser: admissionApi });
  requireValue(loaded.admissionSha256 === `sha256:${plan.seed.admissionSha256}` &&
    loaded.qualificationReceiptSha256 === `sha256:${plan.seed.receiptSha256}`, "ui-qualification-identity");
  const admission = loaded.admission;
  const defaults = admission.runtime.defaultSampling;
  requireValue(plan.ui.templateSha256 === admission.artifacts[2].sha256 &&
    plan.ui.sampling.maximumNewTokens === Math.min(80, defaults.maximumNewTokens, admission.runtime.policy.maximumSequenceTokens) &&
    plan.ui.sampling.repetitionPenaltyMillionths === defaults.repetitionPenaltyMillionths &&
    plan.ui.sampling.repetitionWindow === defaults.repetitionWindow, "ui-admission-defaults");
  const wasm = plan.release.assets.find(asset => asset.route.endsWith("/tinyrustlm-browser-runtime.wasm"));
  requireValue(wasm.sha256 === admission.runtime.wasmSha256 && wasm.bytes === admission.runtime.wasmByteCount,
    "ui-qualified-wasm");
  const memberUrls = catalogApi.MEMBER_NAMES.map(name => catalogApi.directPeerUrlAuthority.buildCompositionMemberUrl(
    "https://minimodel.org/", plan.seed.compositionId, name));
  const allowedGetUrls = [...new Set([`${ORIGIN}/.well-known/site-release.json`, catalogApi.CATALOG_URL, catalogApi.PEER_FEED_URL,
    ...plan.release.assets.flatMap(asset => [releaseRoute(asset.route), `${releaseRoute(asset.route)}?v=sha256-${asset.sha256}`]),
    ...plan.release.additionalGetRoutes.map(releaseRoute), ...memberUrls,
    ...[view.browserAdmission.route, view.qualification.receiptRoute, view.license.route]
      .map(route => new URL(route, catalogApi.CATALOG_URL).href)])];
  return { marker, authority: catalog.authority, admission, memberUrls, allowedGetUrls,
    validUntilUtc: catalog.authority.catalog.validUntilUtc };
}

/** Passive browser transport observer: forwards every command, event and error unchanged. */
function installObserver() {
  const log = { events: [], errors: [], loading: [], overflow: false, stopAfterTokens: null, tokenCount: 0, loadingComplete: false };
  window.__tinyUiCapture = log;
  const record = value => { if (log.events.length >= 20000) log.overflow = true; else log.events.push(value); };
  const observeLoading = () => {
    const capture = () => {
      if (log.loadingComplete) return;
      const fields = {};
      for (const id of ["simpleModelPickerStatus", "runtimeStatus", "modelState", "companionImportProgress", "companionImportProgressBar"]) {
        const element = document.getElementById(id);
        fields[id] = element ? { text: String(element.textContent || "").slice(0, 500),
          visible: Boolean(element.getClientRects?.().length), value: element.getAttribute?.("value") ?? null,
          maximum: element.getAttribute?.("max") ?? null } : null;
      }
      const key = JSON.stringify(fields);
      if (log.loading.at(-1)?.key === key) return;
      if (log.loading.length === 1024) log.overflow = true;
      else log.loading.push({ time: performance.now(), key, fields });
    };
    capture(); new MutationObserver(capture).observe(document.body, { subtree: true, childList: true,
      characterData: true, attributes: true, attributeFilter: ["hidden", "value", "max", "class"] });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", observeLoading, { once: true });
  else observeLoading();
  const NativeWorker = window.Worker;
  window.Worker = class extends NativeWorker {
    constructor(...args) {
      super(...args);
      if (new URL(String(args[0]), document.baseURI).href !== `${location.origin}/app/model-runtime-worker.js`) return;
      const post = this.postMessage.bind(this);
      this.postMessage = (message, transfer) => {
        const item = { direction: "command", kind: message?.kind, generationId: message?.generationId,
          operationId: message?.operationId, compositionId: message?.compositionId, time: performance.now() };
        if (message?.kind === "artifact-chunk" && message.payload?.artifactKind === "prompt-request") {
          const bytes = new Uint8Array(message.payload.bytes);
          if (bytes.length > 1054848) log.overflow = true;
          else { item.offset = message.payload.offset; item.bytes = Array.from(bytes); }
        }
        if (message?.kind === "begin-generation") log.tokenCount = 0;
        if (item.bytes || ["begin-generation", "cancel-generation"].includes(item.kind)) record(item);
        return transfer === undefined ? post(message) : post(message, transfer);
      };
      this.addEventListener("message", event => {
        const message = event.data;
        if (!["composition-active", "generation-begun", "generation-step", "generation-complete", "command-rejected"].includes(message?.kind)) return;
        record({ direction: "event", kind: message.kind, generationId: message.generationId,
          operationId: message.operationId, compositionId: message.compositionId, time: performance.now(), payload: message.payload });
        if (message.kind === "composition-active") log.loadingComplete = true;
        if (message.kind === "generation-step" && message.payload?.step?.emittedTokenId !== null &&
            Number.isInteger(message.payload?.step?.emittedTokenId)) {
          log.tokenCount += 1;
          if (log.stopAfterTokens !== null && log.tokenCount === log.stopAfterTokens) {
            log.stopAfterTokens = null;
            const stop = document.getElementById("generateButton");
            record({ direction: "ui", kind: "stop-click", time: performance.now() });
            if (!stop || stop.disabled || stop.dataset.action !== "stop") log.errors.push("ui-stop-not-available");
            else stop.click();
          }
        }
      });
      this.addEventListener("error", () => log.errors.push("ui-production-worker-error"));
    }
  };
}

/** Require actual runtime admission identity instead of treating an enabled button as model proof. */
function verifyActivation(events, admission) {
  const active = events.filter(e => e.kind === "composition-active").at(-1)?.payload?.state;
  const composition = active?.activeComposition;
  requireValue(active?.state === "active-idle" && active.operationId === admission.operationId &&
    composition?.graphIdentitySha256 === admission.composition.graphIdentitySha256 &&
    composition.memberTableSha256 === admission.composition.memberTableSha256 &&
    composition.artifactSha256 === admission.artifacts[5].sha256 &&
    composition.artifactBytes === admission.artifacts[5].byteCount, "ui-activation-identity");
  return active;
}

/** Parse exactly one generation, including its actual request, raw output and ordered token observations. */
function analyzeTurn(events, expectedMessages, plan, cancelled = false) {
  const begins = events.filter(e => e.direction === "command" && e.kind === "begin-generation");
  const terminals = events.filter(e => e.kind === "generation-complete");
  requireValue(begins.length === 1 && terminals.length === 1 && !events.some(e => e.kind === "command-rejected"),
    "ui-single-generation");
  const begin = begins[0], terminal = terminals[0];
  requireValue(begin.generationId === terminal.generationId && begin.compositionId === plan.seed.compositionId.replace(/^sha256:/, ""),
    "ui-generation-identity");
  const chunks = events.filter(e => e.bytes); let offset = 0;
  const wire = Buffer.concat(chunks.map(chunk => {
    requireValue(chunk.generationId === begin.generationId && chunk.offset === offset &&
      Array.isArray(chunk.bytes) && chunk.bytes.every(b => Number.isInteger(b) && b >= 0 && b <= 255), "ui-request-chunks");
    offset += chunk.bytes.length; requireValue(offset <= 1054848, "ui-request-size"); return Buffer.from(chunk.bytes);
  }));
  const request = parseRequest(wire);
  requireValue(JSON.stringify(request.messages) === JSON.stringify(expectedMessages), "ui-observed-history");
  requireValue(SAMPLING_FIELDS.every(field => request.config[field] === plan.ui.sampling[field]), "ui-observed-sampling");
  requireValue(request.seed >= 0n && request.seed < 4294967295n, "ui-observed-seed");
  const output = terminal.payload.output;
  requireValue(output?.composition?.graphIdentitySha256 === begin.compositionId && output.operationId === begin.operationId &&
    typeof output.text === "string" && Array.isArray(output.tokenIds) && output.tokenIds.length <= plan.ui.sampling.maximumNewTokens &&
    output.tokenIds.every(id => Number.isInteger(id) && id >= 0) &&
    (cancelled ? output.status.kind === "cancelled" : ["stop-token", "maximum-new-tokens", "context-limit"].includes(output.status.kind)),
    "ui-terminal-output");
  const steps = events.filter(e => e.kind === "generation-step" && Number.isInteger(e.payload?.step?.emittedTokenId));
  requireValue(steps.every((step, i) => step.generationId === begin.generationId &&
    step.payload.step.emittedTokenId === output.tokenIds[i]) && output.tokenIds.length >= steps.length &&
    output.tokenIds.length <= steps.length + 1, "ui-output-token-prefix");
  const tokenTimes = steps.map(step => step.time);
  if (output.tokenIds.length === steps.length + 1) tokenTimes.push(terminal.time);
  const firstTokenMilliseconds = tokenTimes.length ? tokenTimes[0] - begin.time : null;
  const decodeTokensPerSecond = tokenTimes.length >= 2 ? (tokenTimes.length - 1) * 1000 / (tokenTimes.at(-1) - tokenTimes[0]) : null;
  const clicks = events.filter(e => e.kind === "stop-click");
  const cancelCommands = events.filter(e => e.kind === "cancel-generation");
  if (cancelled) requireValue(clicks.length === 1 && cancelCommands.length === 1 &&
    steps.length >= plan.functional.cancelAfterTokens, "ui-visible-stop");
  else requireValue(clicks.length === 0 && cancelCommands.length === 0, "ui-unexpected-stop");
  const stopLatencyMilliseconds = cancelled ? terminal.time - clicks[0].time : null;
  const elapsedMilliseconds = terminal.time - begin.time;
  requireValue(firstTokenMilliseconds !== null && firstTokenMilliseconds >= 0 &&
    firstTokenMilliseconds <= plan.limits.maximumFirstTokenMilliseconds &&
    (decodeTokensPerSecond === null || Number.isFinite(decodeTokensPerSecond) &&
      decodeTokensPerSecond >= plan.limits.minimumSustainedDecodeTokensPerSecond) &&
    elapsedMilliseconds >= 0 && elapsedMilliseconds <= plan.limits.maximumTurnMilliseconds &&
    (stopLatencyMilliseconds === null || stopLatencyMilliseconds >= 0 &&
      stopLatencyMilliseconds <= plan.limits.maximumStopLatencyMilliseconds), "ui-performance-gate");
  return { requestSha256: sha256(wire), requestBytes: wire.length, messages: request.messages, sampling: request.config,
    seed: request.seed.toString(), output, timing: { firstTokenMilliseconds, decodeTokensPerSecond,
      elapsedMilliseconds, stopLatencyMilliseconds, observation: "worker-event-arrival; final token may arrive with terminal output" },
    semanticAssessment: "ungraded" };
}

/** Reject hidden re-downloads; a cache hit still appears as a request and is explicitly identified. */
function assertNoMemberDownload(network, memberUrls) {
  requireValue(!network.some(item => memberUrls.includes(item.url)), "ui-restoration-model-request");
}

/** Assert a closed normal-flow network boundary without blocking or modifying real requests. */
function assertNetworkPrivacy(network, allowedGetUrls) {
  const allowed = new Set(allowedGetUrls);
  requireValue(network.every(item => ["GET", "HEAD"].includes(item.method) && allowed.has(item.url)), "ui-unexpected-network");
}

/** Profile allocation is exclusive and model-bearing data never enters the source/artifact tree. */
function createProfile(parent, id) {
  storage.requireModelOutputRoot(parent);
  requireValue(parent.toLowerCase() !== "d:\\llms\\tinyrustlm", "ui-profile-parent");
  const root = storage.requireModelOutputRoot(path.join(parent, `${id}-${crypto.randomUUID()}`));
  files.createOwnedDirectory(root);
  const owner = { root, stat: fs.lstatSync(root, { bigint: true }), marker: root + ".owner",
    nonce: crypto.randomBytes(32).toString("hex") };
  try {
    fs.writeFileSync(owner.marker, owner.nonce, { flag: "wx", mode: 0o600 });
    owner.markerStat = fs.lstatSync(owner.marker, { bigint: true });
    for (const name of ["profile", "temporary", "downloads", "cache", "crashes"])
      files.createOwnedDirectory(path.join(root, name));
    return owner;
  } catch (error) {
    // Never reconstruct ownership after a failure. Retain the exact partial tree
    // when exclusive marker publication itself did not complete.
    if (owner.markerStat) {
      try { retireProfile(owner); }
      catch (_) { error.retainedProfile = root; }
    } else error.retainedProfile = root;
    throw error;
  }
}

/** Remove only the original closed-browser profile after bounded exact inventory; never retry on failure. */
function retireProfile(owner) {
  storage.requireModelOutputRoot(owner.root);
  files.assertSafeRegularFile(owner.marker);
  const marker = fs.lstatSync(owner.marker, { bigint: true });
  const root = fs.lstatSync(owner.root, { bigint: true });
  requireValue(root.dev === owner.stat.dev && root.ino === owner.stat.ino &&
    marker.dev === owner.markerStat.dev && marker.ino === owner.markerStat.ino && marker.nlink === 1n &&
    fs.readFileSync(owner.marker, "utf8") === owner.nonce, "ui-profile-owner");
  const entries = [];
  const visit = (directory, depth) => {
    requireValue(depth <= 64, "ui-profile-depth");
    for (const name of fs.readdirSync(directory)) {
      requireValue(entries.length < 100000, "ui-profile-count");
      const target = path.join(directory, name), stat = fs.lstatSync(target, { bigint: true });
      requireValue(!stat.isSymbolicLink() && (stat.isDirectory() || stat.isFile() && stat.nlink === 1n), "ui-profile-entry");
      entries.push({ target, stat }); if (stat.isDirectory()) visit(target, depth + 1);
    }
  };
  visit(owner.root, 0);
  for (const item of entries.reverse()) {
    files.assertSafeDirectoryAncestry(path.dirname(item.target));
    const now = fs.lstatSync(item.target, { bigint: true });
    requireValue(now.dev === item.stat.dev && now.ino === item.stat.ino && !now.isSymbolicLink(), "ui-profile-replaced");
    if (now.isDirectory()) fs.rmdirSync(item.target); else fs.unlinkSync(item.target);
  }
  // Inventory is not ownership authority after another actor could replace paths.
  storage.requireModelOutputRoot(owner.root);
  const finalRoot = fs.lstatSync(owner.root, { bigint: true });
  const finalMarker = fs.lstatSync(owner.marker, { bigint: true });
  requireValue(finalRoot.ino === owner.stat.ino && finalRoot.dev === owner.stat.dev && !finalRoot.isSymbolicLink() &&
    finalMarker.ino === owner.markerStat.ino && finalMarker.dev === owner.markerStat.dev && !finalMarker.isSymbolicLink() &&
    finalMarker.nlink === 1n && fs.readFileSync(owner.marker, "utf8") === owner.nonce, "ui-profile-final-owner");
  fs.rmdirSync(owner.root);
  const unlinkMarker = fs.lstatSync(owner.marker, { bigint: true });
  requireValue(unlinkMarker.ino === owner.markerStat.ino && unlinkMarker.dev === owner.markerStat.dev &&
    !unlinkMarker.isSymbolicLink() && fs.readFileSync(owner.marker, "utf8") === owner.nonce, "ui-profile-final-marker");
  fs.unlinkSync(owner.marker);
}

/** Launch the real installed browser with every writable browser-data location inside the model store. */
async function launchSession(plan, owner, viewport, offline, chromium) {
  const context = await chromium.launchPersistentContext(path.join(owner.root, "profile"), {
    executablePath: plan.browser.path, headless: true, viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.mobile, hasTouch: viewport.mobile, serviceWorkers: "allow", acceptDownloads: false,
    downloadsPath: path.join(owner.root, "downloads"),
    env: { ...process.env, TEMP: path.join(owner.root, "temporary"), TMP: path.join(owner.root, "temporary") },
    args: [`--disk-cache-dir=${path.join(owner.root, "cache")}`, `--crash-dumps-dir=${path.join(owner.root, "crashes")}`]
  });
  try {
    await context.setOffline(offline); await context.addInitScript(installObserver);
    const page = context.pages()[0] || await context.newPage();
    page.setDefaultTimeout(plan.limits.maximumTurnMilliseconds);
    const network = [], errors = [], expectedOfflineErrors = [], pendingAssetChecks = [], observedAssets = new Set();
    context.on("request", request => { if (network.length < 20000 && request.url().length <= 4096)
      network.push({ url: request.url(), method: request.method(), type: request.resourceType() });
      else errors.push("ui-network-overflow"); });
    page.on("websocket", socket => { if (network.length < 20000 && socket.url().length <= 4096)
      network.push({ url: socket.url(), method: "WEBSOCKET", type: "websocket" }); else errors.push("ui-network-overflow"); });
    page.on("pageerror", () => errors.push("ui-page-error"));
    page.on("console", message => {
      if (message.type() !== "error") return;
      const location = message.location().url;
      if (offline && [catalogApi.CATALOG_URL, catalogApi.PEER_FEED_URL, `${ORIGIN}/.well-known/site-release.json`].includes(location) &&
          /^Failed to load resource: net::ERR_INTERNET_DISCONNECTED$/.test(message.text())) expectedOfflineErrors.push(location);
      else errors.push("ui-console-error");
    });
    context.on("response", response => {
      const url = new URL(response.url());
      if (url.origin !== ORIGIN) return;
      const asset = plan.release.assets.find(item => item.route === url.pathname);
      if (!asset) return;
      pendingAssetChecks.push((async () => {
        requireValue(response.status() === 200, "ui-browser-asset-status");
        const length = await response.headerValue("content-length");
        requireValue(length === null || /^\d+$/.test(length) && Number(length) <= asset.bytes, "ui-browser-asset-size");
        const bytes = await response.body(); verifyBytes(bytes, asset, "ui-browser-asset-hash"); observedAssets.add(asset.route);
      })().catch(error => errors.push(safeCode(error))));
    });
    return { context, page, network, errors, expectedOfflineErrors, pendingAssetChecks, observedAssets,
      offline, started: Date.now(), viewport };
  } catch (error) {
    try { await context.close(); }
    catch (_) { error.browserMayBeOpen = true; }
    throw error;
  }
}

/** Capture diagnostics without reading any model response body or modifying app state. */
async function snapshot(session) {
  return session.page.evaluate(() => ({ events: window.__tinyUiCapture?.events || [],
    errors: window.__tinyUiCapture?.errors || [], overflow: window.__tinyUiCapture?.overflow || false,
    loading: window.__tinyUiCapture?.loading || [],
    mode: document.querySelector(".app-shell")?.dataset.mode,
    generationState: document.querySelector(".app-shell")?.dataset.generationState,
    creativity: document.querySelector('input[name="simpleCreativity"]:checked')?.value,
    length: document.querySelector('input[name="simpleLength"]:checked')?.value,
    runtime: document.getElementById("runtimeStatus")?.textContent,
    error: document.getElementById("errorState")?.textContent,
    messages: Array.from(document.querySelectorAll("#conversation .message-assistant .message-text"))
      .map(node => ({ raw: node.dataset.rawText, status: node.closest(".message").dataset.status })) }));
}

/** Await automatic installation/restoration and verify defaults without clicking a model or Advanced control. */
async function ready(session, plan, evidence) {
  session.allowedGetUrls = evidence.allowedGetUrls;
  await session.page.goto(`${ORIGIN}/`, { waitUntil: "domcontentloaded", timeout: plan.limits.installationMilliseconds });
  const screenshot = stage => session.page.screenshot({ path: path.join(plan.outputDirectory,
    `${session.viewport.id}-${session.phase}-${stage}.png`), fullPage: true });
  await screenshot("initial");
  let progressScreenshot = null;
  if (["fresh-install", "recovered-install"].includes(session.phase)) {
    await session.page.waitForFunction(() => {
      const status = document.getElementById("simpleModelPickerStatus");
      const percent = status?.textContent.match(/ \/ (\d+)%$/);
      return status?.getClientRects().length && percent && Number(percent[1]) > 0 && Number(percent[1]) < 100;
    }, null, { timeout: plan.limits.installationMilliseconds });
    progressScreenshot = { before: (await snapshot(session)).loading.at(-1) };
    await screenshot("progress");
    progressScreenshot.after = (await snapshot(session)).loading.at(-1);
  }
  await session.page.waitForFunction(() => document.getElementById("wasmState")?.textContent === "verified" &&
    document.getElementById("modelState")?.textContent.startsWith("worker active (") &&
    !document.getElementById("generateButton")?.disabled, null, { timeout: plan.limits.installationMilliseconds });
  const state = await snapshot(session);
  await Promise.all(session.pendingAssetChecks);
  assertNetworkPrivacy(session.network, evidence.allowedGetUrls);
  requireValue(state.mode === "simple" && state.creativity === plan.ui.creativity && state.length === plan.ui.length &&
    !state.overflow && state.errors.length === 0 && session.errors.length === 0, "ui-default-ready");
  await screenshot("ready");
  return { activation: verifyActivation(state.events, evidence.admission), elapsedMilliseconds: Date.now() - session.started,
    browserVersion: session.context.browser().version(), status: state.runtime,
    observedAssets: [...session.observedAssets], expectedOfflineErrors: session.expectedOfflineErrors,
    loading: state.loading, progressScreenshot };
}

/** Perform one real normal-UI submit; preserve partial diagnostics on any failure, never retry inference. */
async function turn(session, plan, user, history, report, cancel = false) {
  const before = (await snapshot(session)).events.length;
  const record = { user, cancelled: cancel, status: "started", raw: null };
  report.turns.push(record);
  if (cancel) await session.page.evaluate(count => { window.__tinyUiCapture.stopAfterTokens = count; }, plan.functional.cancelAfterTokens);
  try {
    await session.page.locator("#prompt").fill(user);
    await session.page.locator("#generateButton").click();
    await session.page.waitForFunction(start => window.__tinyUiCapture?.events.slice(start)
      .some(event => ["generation-complete", "command-rejected"].includes(event.kind)), before,
    { timeout: plan.limits.maximumTurnMilliseconds });
    await session.page.waitForFunction(() => document.querySelector(".app-shell")?.dataset.generationState === "idle");
    record.raw = await snapshot(session);
    record.raw.events = record.raw.events.slice(before);
    const messages = [...history, { role: "user", content: user }];
    record.capture = analyzeTurn(record.raw.events, messages, plan, cancel);
    await Promise.all(session.pendingAssetChecks);
    assertNetworkPrivacy(session.network, session.allowedGetUrls);
    requireValue(record.raw.messages.at(-1)?.raw === record.capture.output.text &&
      record.raw.messages.at(-1)?.status === (cancel ? "stopped" : "completed") &&
      !record.raw.overflow && record.raw.errors.length === 0 && session.errors.length === 0, "ui-visible-raw-output");
    record.status = "captured-not-graded";
    return [...messages, { role: "assistant", content: record.capture.output.text }];
  } finally {
    if (record.raw === null) {
      record.raw = await snapshot(session).catch(() => null);
      if (record.raw) record.raw.events = record.raw.events.slice(before);
    }
  }
}

/** Click the ordinary New Chat control and let the next captured wire prove history reset. */
async function newChat(session) {
  await session.page.locator("#newChatButton").click();
  await session.page.waitForFunction(() => document.querySelectorAll("#conversation .message").length === 0);
}

/** Attempt browser closure once; uncertain process shutdown never grants profile deletion authority. */
async function closeSession(session) {
  session.closeAttempted = true;
  try { await session.context.close(); session.closed = true; }
  catch (error) { error.browserMayBeOpen = true; throw error; }
}

/** Close during actual model-body progress, then let a new process recover through ordinary startup. */
async function interruptInstallation(session, plan, evidence) {
  const cdp = await session.context.newCDPSession(session.page);
  const requests = new Map();
  let resolveProgress, rejectProgress;
  const progress = new Promise((resolve, reject) => { resolveProgress = resolve; rejectProgress = reject; });
  // Navigation may fail first; keep the independently armed deadline handled.
  progress.catch(() => {});
  const timer = setTimeout(() => rejectProgress(new Error("ui-interruption-no-model-progress")), plan.limits.installationMilliseconds);
  cdp.on("Network.requestWillBeSent", event => requests.set(event.requestId, event.request.url));
  cdp.on("Network.dataReceived", event => {
    if (requests.get(event.requestId) === evidence.memberUrls[0] && event.dataLength > 0)
      resolveProgress({ requestId: event.requestId, url: requests.get(event.requestId), receivedBytes: event.dataLength });
  });
  await cdp.send("Network.enable");
  try {
    await session.page.goto(`${ORIGIN}/`, { waitUntil: "domcontentloaded" });
    const observed = await progress;
    const state = await snapshot(session);
    requireValue(!state.events.some(event => event.kind === "composition-active"), "ui-interruption-too-late");
    await closeSession(session);
    return { ...observed, action: "browser-process-closed", activationObserved: false,
      expectedEffect: "in-flight-installation-interrupted", diagnostics: state };
  } finally { clearTimeout(timer); await cdp.detach().catch(() => {}); }
}

/** Run declared quality cases and distinct functional flows; this routine never grades model text. */
async function runViewport(plan, cases, evidence, viewport, report, driver) {
  let owner;
  try { owner = driver.createProfile(plan.profileParent, viewport.id); }
  catch (error) { report.profileCleanup = error.retainedProfile ? "retained-partial-allocation-no-retry" : "not-allocated";
    if (error.retainedProfile) report.profile = error.retainedProfile; throw error; }
  let session;
  report.profile = owner.root; report.turns = []; report.phases = []; report.profileCleanup = "pending";
  try {
    if (viewport.mobile) {
      session = await driver.launch(plan, owner, viewport, false);
      session.phase = "interrupted-install";
      const interrupted = await driver.interrupt(session, plan, evidence);
      assertNetworkPrivacy(session.network, evidence.allowedGetUrls);
      report.phases.push({ phase: "interrupted-install", evidence: interrupted, network: session.network });
      session = null;
    }
    session = await driver.launch(plan, owner, viewport, false);
    session.phase = viewport.mobile ? "recovered-install" : "fresh-install";
    report.phases.push({ phase: viewport.mobile ? "recovered-install" : "fresh-install",
      evidence: await driver.ready(session, plan, evidence) });
    requireValue(session.network.some(item => item.url === evidence.memberUrls[0]), "ui-install-network-unobserved");
    for (const item of cases) {
      await driver.newChat(session); let history = [];
      for (const declared of item.turns) history = await driver.turn(session, plan, declared.user, history, report);
      assertNetworkPrivacy(session.network, evidence.allowedGetUrls);
      report.turns.at(-1).caseId = item.id; report.turns.at(-1).criteria = item.criteria;
    }
    await driver.newChat(session);
    let history = await driver.turn(session, plan, plan.functional.cancelPrompt, [], report, true);
    await driver.turn(session, plan, plan.functional.afterStopPrompt, history, report);
    await driver.newChat(session);
    await driver.turn(session, plan, plan.functional.afterResetPrompt, [], report);
    assertNetworkPrivacy(session.network, evidence.allowedGetUrls);
    report.phases.at(-1).network = session.network;
    await driver.screenshot(session, `${viewport.id}-online.png`);
    await closeSession(session);
    assertNetworkPrivacy(session.network, evidence.allowedGetUrls); session = null;
    for (const offline of [false, true]) {
      requireValue(Date.now() < Date.parse(evidence.validUntilUtc), "ui-authority-expired-before-restore");
      session = await driver.launch(plan, owner, viewport, offline);
      session.phase = offline ? "offline" : "cached";
      const activation = await driver.ready(session, plan, evidence);
      assertNoMemberDownload(session.network, evidence.memberUrls);
      assertNetworkPrivacy(session.network, evidence.allowedGetUrls);
      await driver.newChat(session);
      await driver.turn(session, plan, offline ? plan.functional.offlinePrompt : plan.functional.restartPrompt, [], report);
      assertNoMemberDownload(session.network, evidence.memberUrls);
      assertNetworkPrivacy(session.network, evidence.allowedGetUrls);
      requireValue(Date.now() < Date.parse(evidence.validUntilUtc), "ui-authority-expired-during-restore");
      report.phases.push({ phase: offline ? "new-process-offline" : "new-process-cached", evidence: activation,
        modelMemberRequests: 0, authorityValidUntilUtc: evidence.validUntilUtc, network: session.network });
      await driver.screenshot(session, `${viewport.id}-${offline ? "offline" : "cached"}.png`);
      await closeSession(session);
      assertNetworkPrivacy(session.network, evidence.allowedGetUrls);
      assertNoMemberDownload(session.network, evidence.memberUrls); session = null;
    }
    report.status = "captured-not-graded";
  } catch (error) {
    if (error.browserMayBeOpen) report.profileCleanup = "retained-browser-close-failed-no-retry";
    throw error;
  } finally {
    if (session) {
      report.failureNetwork = session.network;
      report.failureDiagnostics = await driver.snapshot(session).catch(() => null);
      if (!session.closed && !session.closeAttempted) {
        try { await closeSession(session); }
        catch (error) { report.profileCleanup = "retained-browser-close-failed-no-retry"; throw error; }
      }
    }
    if (report.profileCleanup !== "retained-browser-close-failed-no-retry") {
      try { driver.retireProfile(owner); report.profileCleanup = "removed-original-owned-profile"; }
      catch (error) { report.profileCleanup = "retained-cleanup-failed-no-retry"; report.cleanupError = safeCode(error); throw error; }
    }
  }
}

/** Only bounded local codes leave a failed capture; never copy transport exception bodies. */
function safeCode(error) { return /^ui-[a-z0-9-]+$/.test(error?.message || "") ? error.message : "ui-operation-failed"; }

/** Verify local immutable inputs and a committed plan before any browser/model-bearing operation. */
function readRegisteredPlan(planPath, registrationCommit) {
  requireValue(/^[a-f0-9]{40}$/.test(registrationCommit), "ui-registration-commit");
  requireValue(files.assertSafeRegularFile(planPath).stat.size <= 65536, "ui-plan-size");
  scratch.requireCanonicalArtifactPath(path.dirname(planPath));
  const relative = path.relative(ROOT, planPath).replaceAll("\\", "/");
  const bytes = fs.readFileSync(planPath); requireValue(bytes.length <= 65536, "ui-plan-size");
  const committed = childProcess.execFileSync("git", ["show", `${registrationCommit}:${relative}`], { cwd: ROOT, maxBuffer: 65536 });
  requireValue(bytes.equals(committed), "ui-plan-unregistered");
  const plan = validatePlan(JSON.parse(bytes.toString("utf8")));
  requireValue(sha256(fs.readFileSync(__filename)) === plan.toolSha256 && Date.parse(plan.registeredAtUtc) < Date.now(),
    "ui-tool-registration");
  // The parser/admission/ownership implementation loaded by this process must be
  // the one in the prospective registration, not merely a similarly named file.
  const sourceRoots = [path.join(ROOT, "tinyrustlm/tools"), path.join(ROOT, "tinyrustlm/app")];
  for (const file of Object.keys(require.cache).filter(file => sourceRoots.some(root => file.startsWith(root + path.sep)))) {
    const registered = childProcess.execFileSync("git", ["show", `${registrationCommit}:${path.relative(ROOT, file).replaceAll("\\", "/")}`],
      { cwd: ROOT, maxBuffer: 4 * 1024 * 1024 });
    requireValue(registered.equals(fs.readFileSync(file)), "ui-registered-helper-changed");
  }
  requireValue(files.assertSafeRegularFile(plan.browser.path).stat.size === plan.browser.bytes, "ui-browser-identity");
  verifyBytes(fs.readFileSync(plan.browser.path), plan.browser, "ui-browser-identity");
  storage.requireModelOutputRoot(plan.profileParent); scratch.requireCanonicalArtifactPath(plan.outputDirectory);
  const cases = acceptanceCases(fs.readFileSync(path.join(ROOT, CASE_PATH)));
  return { plan, cases, registrationCommit, planSha256: sha256(bytes) };
}

/** Execute only a registered, qualified public release; partial failures remain immutable evidence. */
async function main(planPath, registrationCommit) {
  const input = readRegisteredPlan(path.resolve(planPath), registrationCommit), { plan, cases } = input;
  files.createOwnedDirectory(plan.outputDirectory);
  const report = { schema: "tinyrustlm.deployed-ui-acceptance-capture/1", planSha256: input.planSha256,
    registrationCommit, startedAtUtc: new Date().toISOString(), status: "started", qualificationGranted: false,
    semanticAssessment: "ungraded", physicalPhoneTested: false, modelProcessPeakMemory: "unmeasured",
    hardware: { platform: process.platform, architecture: process.arch, cpu: os.cpus()[0]?.model, totalMemoryBytes: os.totalmem() },
    uiContract: plan.ui, viewports: [] };
  let temporaryOwner;
  const environment = Object.fromEntries(["TEMP", "TMP", "TMPDIR"].map(key => [key, process.env[key]]));
  try {
    report.preflight = await preflight(plan);
    requireValue(!Object.keys(require.cache).some(file => /[\\/]playwright(?:-core)?[\\/]lib[\\/]/.test(file)), "ui-browser-preloaded");
    temporaryOwner = createProfile(plan.profileParent, "driver-temporary");
    for (const key of Object.keys(environment)) process.env[key] = path.join(temporaryOwner.root, "temporary");
    // Playwright itself creates artifacts using Node's TMP at module initialization;
    // changing only the browser subprocess environment would leave those outside D:.
    const chromium = require("@playwright/test").chromium;
    const driver = { createProfile, retireProfile, ready, turn, newChat, snapshot, interrupt: interruptInstallation,
      launch: (p, owner, viewport, offline) => launchSession(p, owner, viewport, offline, chromium),
      screenshot: (session, name) => session.page.screenshot({ path: path.join(plan.outputDirectory, name), fullPage: true }) };
    for (const viewport of [{ id: "desktop", width: 1440, height: 1000, mobile: false },
      { id: "mobile-viewport", width: 390, height: 844, mobile: true }]) {
      const capture = { viewport, status: "started" }; report.viewports.push(capture);
      await runViewport(plan, cases, report.preflight, viewport, capture, driver);
    }
    // A changed deployment cannot be reported as a single exact-release run.
    await preflight(plan); report.status = "captured-not-graded";
  } catch (error) { report.status = "failed"; report.error = safeCode(error); }
  finally {
    for (const [key, value] of Object.entries(environment)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    if (temporaryOwner) {
      report.driverTemporaryRoot = temporaryOwner.root;
      if (report.viewports.some(viewport => viewport.profileCleanup === "retained-browser-close-failed-no-retry"))
        report.driverTemporaryCleanup = "retained-browser-close-failed-no-retry";
      else {
        try { retireProfile(temporaryOwner); report.driverTemporaryCleanup = "removed-original-owned-profile"; }
        catch (error) { report.driverTemporaryCleanup = "retained-cleanup-failed-no-retry"; report.status = "failed";
          report.cleanupError = safeCode(error); }
      }
    }
    report.finishedAtUtc = new Date().toISOString();
    files.atomicCreateExclusive(path.join(plan.outputDirectory, "capture.json"), `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}

module.exports = Object.freeze({ SCHEMA, CASE_PATH, CASE_SHA256, REQUIRED_ASSETS, validatePlan, acceptanceCases, boundedGet,
  verifyBytes, preflight, installObserver, verifyActivation, analyzeTurn, assertNoMemberDownload, assertNetworkPrivacy, createProfile, retireProfile,
  launchSession, snapshot, ready, turn, newChat, closeSession, interruptInstallation, runViewport, readRegisteredPlan, safeCode, main });
if (require.main === module) {
  if (process.argv.length !== 4) { process.stderr.write("Usage: node deployed-ui-acceptance.js <registered-plan.json> <registration-commit>\n"); process.exitCode = 2; }
  else main(process.argv[2], process.argv[3]).then(report => {
    process.stdout.write(`${JSON.stringify({ status: report.status, qualificationGranted: false })}\n`);
    if (report.status !== "captured-not-graded") process.exitCode = 1;
  }).catch(error => { process.stderr.write(`${safeCode(error)}\n`); process.exitCode = 1; });
}
