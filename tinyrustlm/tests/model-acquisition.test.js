"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const catalogApi = require("../app/minimodel-catalog-v1.js");
const companionCapabilityApi = require("../app/companion-capability.js");

const app = fs.readFileSync(path.join(__dirname, "..", "app", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "app", "index.html"), "utf8");
const catalogV1 = fs.readFileSync(
  path.join(__dirname, "..", "app", "minimodel-catalog-v1.js"),
  "utf8"
);
const catalogAdmissionLoader = fs.readFileSync(
  path.join(__dirname, "..", "app", "catalog-admission-loader.js"),
  "utf8"
);
const p2pCompositionInstall = fs.readFileSync(
  path.join(__dirname, "..", "app", "p2p-composition-install.js"),
  "utf8"
);
const modelCompositionStore = fs.readFileSync(
  path.join(__dirname, "..", "app", "model-composition-store.js"),
  "utf8"
);
const companionCompositionInstall = fs.readFileSync(
  path.join(__dirname, "..", "app", "companion-composition-install.js"),
  "utf8"
);
const companionGuide = fs.readFileSync(
  path.join(__dirname, "..", "..", "docs", "companion", "README.md"),
  "utf8"
);
const companionPage = fs.readFileSync(
  path.join(__dirname, "..", "companion", "index.html"),
  "utf8"
);
const updatesCss = fs.readFileSync(
  path.join(__dirname, "..", "updates", "updates.css")
);
const siteReleaseScript = fs.readFileSync(
  path.join(__dirname, "..", "app", "site-release.js")
);

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

// Extracts an exact production slice and fails when either test anchor drifts.
function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `missing source marker: ${startMarker}`);
  assert.ok(end > start, `missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

// Exposes promise settlement controls for deterministic cancellation-race tests.
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

// Evaluates the production acquisition-cancellation functions with narrow dependencies.
function companionCancellationFunctions(options = {}) {
  const source = sourceSection(
    app,
    "  async function runCompanionOperationRequest",
    "  function setCompanionAcquisitionTerminal"
  );
  return Function(
    "catalogText",
    "companionCapabilityApi",
    "localDirectSeedErrorCode",
    "companionIsPaired",
    `"use strict";\n${source}\nreturn { runCompanionOperationRequest, settleCompanionCancellation };`
  )(
    (value) => typeof value === "string" ? value.trim() : "",
    companionCapabilityApi,
    (error) => error && typeof error.code === "string"
      ? error.code
      : "direct-composition-seed-client-failure",
    () => options.paired !== false
  );
}

function directSeedProjection(operationId, compositionId, state = "ready", sequence = 1) {
  const ready = state === "ready";
  return {
    schema: companionCapabilityApi.SCHEMAS.directCompositionSeedProjection,
    operationId,
    sequence,
    state,
    compositionId,
    protocol: ready ? companionCapabilityApi.DIRECT_COMPOSITION_SEED_PROTOCOL : null,
    boundOrigin: ready ? "http://127.0.0.1:18123" : null,
    allowedBrowserOrigin: ready ? companionCapabilityApi.PRODUCTION_ORIGIN : null,
    terminalCode: ready
      ? null
      : state === "stopped"
        ? "direct-composition-seed-launch-stopped"
        : "direct-composition-seed-launch-process-exit"
  };
}

// Executes the app's seed coordinator without a DOM or real timers.
function directSeedCoordinatorFunctions(state, options = {}) {
  const coordinator = sourceSection(
    app,
    "  function setCompanionSeedStatus",
    "  async function settleCompanionCancellation"
  );
  const start = sourceSection(
    app,
    "  function localDirectSeedErrorCode",
    "  async function startCompanionConversion"
  );
  const timers = [];
  const windowFacade = options.window || {
    setTimeout(callback, milliseconds) {
      timers.push({ callback, milliseconds, cleared: false });
      return timers.length;
    },
    clearTimeout(timerId) {
      if (timers[timerId - 1]) {
        timers[timerId - 1].cleared = true;
      }
    }
  };
  const functions = Function(
    "state",
    "companionCapabilityApi",
    "companionSha256",
    "renderCompanionState",
    "renderSimpleModelPicker",
    "persistDirectCompositionSeedCustody",
    "companionIsPaired",
    "window",
    "maximumDirectCompositionSeedLifecycles",
    "maximumDirectCompositionSeedPolls",
    "directCompositionSeedPollIntervalMs",
    "appendConsole",
    "catalogText",
    `"use strict";\n${coordinator}\n${start}\nreturn { createDirectSeedRecord, requestLocalDirectSeed, requestDirectSeedStop, reconcileKnownDirectSeeds, pollDirectSeedRecords, markKnownDirectSeedsForReconnect, directSeedCanStop };`
  )(
    state,
    companionCapabilityApi,
    (value, label) => {
      const digest = String(value || "").replace(/^sha256:/u, "");
      if (!/^[0-9a-f]{64}$/u.test(digest)) {
        throw new Error(`${label} SHA-256 was invalid`);
      }
      return digest;
    },
    options.render || (() => {}),
    options.render || (() => {}),
    options.persist || (() => {}),
    () => Boolean(state.companion.client && state.companion.client.isPaired),
    windowFacade,
    4,
    30,
    2000,
    options.appendConsole || (() => {}),
    (value) => typeof value === "string" ? value.trim() : ""
  );
  return { ...functions, timers };
}

function directSeedCoordinatorState(client) {
  return {
    modelAcquisitionCommand: null,
    companion: {
      client,
      pollSequence: 0,
      activeOperationId: "",
      seedRecords: new Map(),
      seedNetworkTail: Promise.resolve(),
      seedMonitorTimer: null,
      seedMonitorSequence: 0,
      seedDisplayOperationId: "",
      seedStatus: "idle",
      seedStatusCode: "none",
      seedStatusText: "",
      operationRequest: null
    }
  };
}

// Executes the shared Cancel path with explicit acquisition and seed ownership.
function acquisitionCancellationFunctions(state, options = {}) {
  const source = sourceSection(
    app,
    "  async function cancelCompanionImportInternal",
    "  function collapseSidebar"
  );
  const statuses = options.statuses || [];
  return {
    ...Function(
      "state",
      "catalogText",
      "companionAcquisitionIsActive",
      "requestDirectSeedStop",
      "cancelActiveModelActivation",
      "setHfStatus",
      "setSimpleModelPickerStatus",
      "setCompanionStatus",
      "companionIsPaired",
      "renderSimpleModelPicker",
      "settleCompanionCancellation",
      "setCompanionAcquisitionTerminal",
      "friendlyError",
      "errorMessage",
      "renderCompanionState",
      `"use strict";\n${source}\nreturn { cancelCompanionImportInternal, cancelCompanionImport };`
    )(
      state,
      (value) => typeof value === "string" ? value.trim() : "",
      (status) => ["queued", "acquiring", "converting"].includes(status && status.state),
      options.requestDirectSeedStop || (async () => ({ confirmed: true })),
      options.cancelActiveModelActivation || (() => false),
      (text, error) => statuses.push(["advanced", text, error]),
      (text, error) => statuses.push(["simple", text, error]),
      (kind, text, error) => statuses.push([kind, text, error]),
      () => options.paired !== false,
      options.render || (() => {}),
      options.settleCompanionCancellation || (async () => ({ confirmed: true })),
      (terminalState) => {
        state.companion.activeStatus = { state: terminalState, errorCode: null };
      },
      (value) => value,
      (error) => error && error.message || String(error),
      options.render || (() => {})
    ),
    statuses
  };
}

// Executes the compact acquisition-intent and explicit-Cancel commands with narrow dependencies.
function compactAcquisitionRequestFunction(state, options = {}) {
  const source = sourceSection(
    app,
    "  async function requestSimpleModelAcquisition",
    "  // Resumes the sole pending acquisition"
  );
  const statuses = options.statuses || [];
  const functions = Function(
    "state",
    "simpleModelAcquisitionIsActive",
    "cancelCompanionImport",
    "catalogText",
    "setSimpleModelPickerStatus",
    "renderSimpleModelPicker",
    "selectedSimpleModelEntry",
    "resolveCurrentSimpleModelRoute",
    "simpleModelRouteKinds",
    "clearPendingCompanionAcquisition",
    "el",
    "toggleModelPopover",
    "beginModelAcquisition",
    "companionIsPaired",
    "rememberPendingCompanionAcquisition",
    "scheduleSimpleCompanionPairingFocus",
    `"use strict";\n${source}\nreturn { requestSimpleModelAcquisition, requestSimpleModelAcquisitionCancellation };`
  )(
    state,
    () => options.active !== false,
    options.cancelCompanionImport || (async () => true),
    (value) => typeof value === "string" ? value.trim() : "",
    (text, error) => statuses.push([text, error]),
    options.render || (() => {}),
    options.selectedSimpleModelEntry || (() => null),
    options.resolveCurrentSimpleModelRoute || (() => null),
    Object.freeze({
      INSTALLED: "installed",
      QUALIFIED_P2P: "qualified-p2p",
      SUPPORTED_LOCAL_CONVERSION: "supported-local-conversion"
    }),
    () => {},
    { simpleCompanionPairing: null },
    options.toggleModelPopover || (() => {}),
    options.beginModelAcquisition || (async () => false),
    () => true,
    () => {},
    () => {}
  );
  return {
    request: functions.requestSimpleModelAcquisition,
    cancel: functions.requestSimpleModelAcquisitionCancellation,
    statuses
  };
}

// Executes post-conversion browser installation with all external boundaries injected.
function companionBrowserInstallFunction(state, options = {}) {
  const source = sourceSection(
    app,
    "  async function prepareCompanionConvertedModel",
    "  async function getHfModel"
  );
  const statuses = options.statuses || [];
  const install = Function(
    "state",
    "setHfStatus",
    "setSimpleModelPickerStatus",
    "renderSimpleModelPicker",
    "loadCatalogAdmission",
    "requireCurrentCatalogAdmission",
    "ensureBrowserRuntimeAsset",
    "throwIfAcquisitionAborted",
    "assertAdmissionRuntime",
    "modelStoreManifest",
    "modelStoreAdmissionAuthority",
    "workerActivationStoreAdapter",
    "compositionStoreForInstall",
    "companionCompositionInstallApi",
    "renderCompanionState",
    "setCompanionAcquisitionTerminal",
    "setCompanionStatus",
    "requestLocalDirectSeed",
    "toggleModelPopover",
    "latchRecoverableCompositionStoreError",
    "catalogText",
    "friendlyError",
    "errorMessage",
    "setText",
    "el",
    "appendConsole",
    `"use strict";\n${source}\nreturn prepareCompanionConvertedModel;`
  )(
    state,
    (text, error) => statuses.push(["advanced", text, error]),
    (text, error) => statuses.push(["simple", text, error]),
    options.render || (() => {}),
    options.loadCatalogAdmission || (async () => ({ admission: {} })),
    options.requireCurrentCatalogAdmission || (() => true),
    options.ensureBrowserRuntimeAsset || (async () => {}),
    signal => { if (signal.aborted) throw Object.assign(new Error("cancelled"), { name: "AbortError" }); },
    () => {},
    options.modelStoreManifest || (() => Object.freeze({ fixture: "manifest" })),
    options.modelStoreAdmissionAuthority || (() => Object.freeze({ fixture: "authority" })),
    (_store) => _store,
    options.compositionStoreForInstall || (async () => ({ install() {} })),
    {
      installCompanionComposition: options.installCompanionComposition || (async () => true)
    },
    options.render || (() => {}),
    (terminalState) => {
      state.companion.activeStatus = { state: terminalState, errorCode: null };
      state.companion.browserLoadBytes = 0;
    },
    (kind, text, error) => statuses.push([kind, text, error]),
    options.requestLocalDirectSeed || (async () => true),
    options.toggle || (() => {}),
    options.latch || (() => false),
    (value) => typeof value === "string" ? value.trim() : "",
    (value) => value,
    (error) => error && error.message || String(error),
    (element, text, error) => statuses.push([element, text, error]),
    { modelState: "model", errorState: "error" },
    (text) => statuses.push(["console", text, false])
  );
  return { install, statuses };
}

// Runs the real command, conversion, install, and Cancel coordinators with deferred I/O.
function companionAcquisitionRuntime(options = {}) {
  const state = directSeedCoordinatorState(options.client || {});
  Object.assign(state, { activeAcquisitionAbort: null, modelActivationAbort: null });
  Object.assign(state.companion, { streamAbort: null, cancelPromise: null });
  const statuses = [];
  const sections = [
    ["  function basicModelAcquisitionFailureMessage", "  function simpleModelCompositionBytes"],
    ["  function simpleModelAcquisitionIsActive", "  // Sequences post-render focus"],
    ["  async function beginModelAcquisition", "  // Dispatches exactly the selected route"],
    ["  async function requestSimpleModelAcquisitionCancellation", "  // Resumes the sole pending acquisition"],
    ["  function companionAcquisitionIsActive", "  function companionAcquisitionStageText"],
    ["  async function runCompanionOperationRequest", "  function createDirectSeedRecord"],
    ["  async function settleCompanionCancellation", "  async function refreshCompanionActiveAcquisition"],
    ["  async function startCompanionConversion", "  async function getHfModel"],
    ["  async function cancelCompanionImportInternal", "  function collapseSidebar"]
  ].map(([start, end]) => sourceSection(app, start, end)).join("\n");
  const recordStatus = (text, error) => statuses.push([text, error]);
  const dependencies = {
    state,
    catalogText: (value) => typeof value === "string" ? value.trim() : "",
    errorMessage: (error) => error && error.message || String(error),
    friendlyError: (value) => value,
    companionCapabilityApi: {
      computeOperationId: options.computeOperationId || (async () => "a".repeat(64))
    },
    companionSha256: (value) => value,
    sourceAcquireRequest: () => ({ sourceRevision: "b".repeat(40) }),
    requireCurrentCatalogEntry: () => true,
    requireCompanionForAcquisition: () => true,
    companionIsPaired: () => true,
    simpleModelRouteKinds: { QUALIFIED_P2P: "qualified-p2p" },
    directSeedHasPendingRequest: () => false,
    requestDirectSeedStop: async () => { throw new Error("Unexpected seed stop"); },
    cancelActiveModelActivation: () => false,
    setHfStatus: recordStatus,
    setSimpleModelPickerStatus: recordStatus,
    setCompanionStatus: (_kind, text, error) => recordStatus(text, error),
    setText: (_element, text, error) => recordStatus(text, error),
    renderSimpleModelPicker: () => {},
    renderCompanionState: () => {},
    latchRecoverableCompositionStoreError: () => false,
    appendConsole: () => {},
    window: { setTimeout: (callback) => queueMicrotask(callback) },
    el: { modelState: {}, errorState: {} },
    loadCatalogAdmission: async () => ({ admission: {} }),
    requireCurrentCatalogAdmission: () => true,
    ensureBrowserRuntimeAsset: async () => {},
    throwIfAcquisitionAborted: signal => {
      if (signal.aborted) throw Object.assign(new Error("cancelled"), { name: "AbortError" });
    },
    assertAdmissionRuntime: () => {},
    modelStoreManifest: () => ({}),
    modelStoreAdmissionAuthority: () => ({}),
    workerActivationStoreAdapter: (store) => store,
    compositionStoreForInstall: async () => ({}),
    companionCompositionInstallApi: {
      installCompanionComposition: options.installCompanionComposition ||
        (async () => { throw new Error("Unexpected browser install"); })
    },
    requestLocalDirectSeed: options.requestLocalDirectSeed ||
      (async () => { throw new Error("Unexpected sharing request"); }),
    toggleModelPopover: () => {}
  };
  const functions = Function(
    ...Object.keys(dependencies),
    `"use strict";\n${sections}\n` +
      "function startCompanionAcquisition(entry) { return startCompanionConversion(entry); }\n" +
      "return { beginModelAcquisition, requestSimpleModelAcquisitionCancellation, simpleModelAcquisitionIsActive };"
  )(...Object.values(dependencies));
  const entry = { displayName: "Pinned Model", composition: { compositionId: `sha256:${"c".repeat(64)}` } };
  return {
    state,
    statuses,
    start: () => functions.beginModelAcquisition(entry, "supported-local-conversion"),
    cancel: functions.requestSimpleModelAcquisitionCancellation,
    active: functions.simpleModelAcquisitionIsActive
  };
}

// Evaluates the production bounded reader so hostile-stream tests do not duplicate its logic.


function activationStoreAdapter(
  activateStoredComposition,
  restoreAfterFailure,
  discardRejectedStoredActivation = () => {},
  completeStoredCompositionActivation = () => {},
  createStoredCompositionActivationToken = () => Object.seal({ fixture: true }),
  ownsStoredCompositionActivation = () => true,
  authorizeStoredCompositionCommit = () => true
) {
  const source = sourceSection(
    app,
    "  function workerActivationStoreAdapter",
    "  function simpleModelEntryIsActive"
  );
  return Function(
    "activateStoredComposition",
    "restoreStoredCompositionAfterFailure",
    "discardRejectedStoredActivation",
    "completeStoredCompositionActivation",
    "createStoredCompositionActivationToken",
    "ownsStoredCompositionActivation",
    "authorizeStoredCompositionCommit",
    "catalogQualificationError",
    `"use strict";\n${source}\nreturn workerActivationStoreAdapter;`
  )(
    activateStoredComposition,
    restoreAfterFailure,
    discardRejectedStoredActivation,
    completeStoredCompositionActivation,
    createStoredCompositionActivationToken,
    ownsStoredCompositionActivation,
    authorizeStoredCompositionCommit,
    (code, message) => Object.assign(new Error(message), { code })
  );
}

// Evaluates the app-only route projection without coupling generic catalog parsing to the companion.
function compactChooserRouteFunctions(state) {
  const source = sourceSection(
    app,
    "  function simpleModelEntryIsActive",
    "  function selectedSimpleModelEntry"
  );
  const routeKinds = Object.freeze({
    INSTALLED: "installed",
    QUALIFIED_P2P: "qualified-p2p",
    SUPPORTED_LOCAL_CONVERSION: "supported-local-conversion",
    UNSUPPORTED_SOURCE: "unsupported-source"
  });
  return Function(
    "state",
    "companionCapabilityApi",
    "canStartP2pImport",
    "catalogText",
    "simpleModelRouteKinds",
    "simpleModelRouteRanks",
    `"use strict";\n${source}\nreturn { verifiedInstalledSimpleModelEntry, simpleModelEntries, simpleModelRouteProjection, simpleModelRouteViews, chooseDefaultSimpleModelRoute, rememberSimpleModelConversionRecovery, clearSimpleModelConversionRecovery };`
  )(
    state,
    companionCapabilityApi,
    (entry) => Boolean(
      entry && entry.availability === "peer" && entry.browserAdmission &&
      entry.composition && Array.isArray(entry.peers) && entry.peers.length
    ),
    (value) => typeof value === "string" ? value.trim() : "",
    routeKinds,
    Object.freeze({
      installed: 0,
      "qualified-p2p": 1,
      "supported-local-conversion": 2,
      "unsupported-source": 3
    })
  );
}

// Evaluates the production Advanced resolver against explicit state and boundary dependencies.


// Exposes production URL admission functions in an isolated, dependency-bounded harness.
function urlAdmissionFunctions() {
  const text = sourceSection(app, "  function normalizedPeerBaseUrl", "  function updatePeerUrlStatus");
  return Function("directPeerUrlAuthority", text + "; return { normalizedPeerBaseUrl }; ")(catalogApi.directPeerUrlAuthority);
}

// Builds a deterministic streamed response with an optional declared length for boundary tests.


const compositionMemberNames = Object.freeze([
  "model.slm2",
  "tokenizer.tokenizer2",
  "template.template2",
  "sampling.sampling2",
  "prompt.prompt2",
  "composition.acg2"
]);

test("acquisition passes caller cancellation without replacing the loader fetch signal", async () => {
  const wiring = sourceSection(app, "  async function loadCatalogAdmission",
    "  function catalogQualificationError");
  const controller = new AbortController();
  const loaderController = new AbortController();
  const entry = { browserAdmission: {} };
  let requestSignal;
  const windowValue = {
    crypto: {},
    fetch(_url, options) {
      assert.equal(this, windowValue);
      requestSignal = options.signal;
      return Promise.resolve("response");
    }
  };
  const load = Function("window", "catalogAdmissionLoaderApi", "miniModelCatalogV1Api",
    "browserModelAdmissionApi", wiring + "\nreturn loadCatalogAdmission;")(
    windowValue, {
      async load(options) {
        assert.equal(options.signal, controller.signal);
        return options.fetch("https://minimodel.org/test", { signal: loaderController.signal });
      }
    }, { CATALOG_URL: "https://minimodel.org/catalog" }, {}
  );
  assert.equal(await load(entry, controller.signal), "response");
  assert.equal(requestSignal, loaderController.signal);
});

test("the basic path uses the exact strict catalog admission loader", () => {
  const wiring = sourceSection(
    app,
    "  async function loadCatalogAdmission",
    "  function modelStoreManifest"
  );
  const resolution = sourceSection(
    catalogAdmissionLoader,
    "  function resolveAdmissionUrl",
    "  function declaredLength"
  );
  const fetchBytes = sourceSection(
    catalogAdmissionLoader,
    "  async function fetchExactBytes",
    "  async function hashBytes"
  );
  const load = sourceSection(
    catalogAdmissionLoader,
    "  async function load(optionsValue)",
    "  return Object.freeze({\n    admissionSchema:"
  );

  assert.match(app, /const catalogAdmissionLoaderApi = window\.TinyRustLMCatalogAdmissionLoader;/);
  assert.match(
    html,
    /<script src="\.\/catalog-admission-loader\.js\?v=sha256-[0-9a-f]{64}"><\/script>/
  );
  assert.match(
    wiring,
    /return catalogAdmissionLoaderApi\.load\(\{\s*catalogView: entry,\s*catalogBaseUrl: miniModelCatalogV1Api\.CATALOG_URL,\s*fetch: window\.fetch\.bind\(window\),\s*signal,\s*admissionParser: browserModelAdmissionApi,\s*crypto: window\.crypto\s*\}\);/
  );
  assert.match(catalogAdmissionLoader, /const MAXIMUM_ADMISSION_BYTES = 64 \* 1024;/);
  assert.match(catalogAdmissionLoader, /descriptor\.bytes < 1[\s\S]*?descriptor\.bytes > MAXIMUM_ADMISSION_BYTES/);
  assert.match(resolution, /resolved\.origin !== base\.origin/);
  assert.match(resolution, /resolved\.hash \|\| resolved\.search/);
  assert.match(
    fetchBytes,
    /await lifetime\.wait\(\(\) => fetchFunction\(url, \{\s*method: "GET",\s*cache: "no-store",\s*credentials: "omit",\s*redirect: "error",\s*referrerPolicy: "no-referrer",\s*signal: lifetime\.signal\s*\}\)\)/
  );
  assert.doesNotMatch(fetchBytes, /\bbody\s*:/);
  assert.match(fetchBytes, /declaredLength\(response, expectedBytes, maximumBytes, codePrefix\)/);
  assert.match(fetchBytes, /readActualBytes\(response, expectedBytes, codePrefix, lifetime\)/);
  assert.match(load, /if \(`sha256:\$\{receiptDigest\}` !== catalog\.qualificationReceiptSha256\)/);
  assert.match(load, /if \(`sha256:\$\{digest\}` !== catalog\.descriptor\.sha256\)/);
  assert.match(load, /new TextDecoder\("utf-8", \{ fatal: true \}\)\.decode\(receiptBytes\)/);
  assert.match(load, /new TextDecoder\("utf-8", \{ fatal: true \}\)\.decode\(bytes\)/);
  assert.match(load, /frozenCopy\(parseCanonicalQualificationReceipt\(receiptText\)\)/);
  assert.match(load, /frozenCopy\(parseCanonicalAdmission\(/);
  assert.match(load, /await bindAdmission\(catalog, admission, options\)/);
  assert.match(load, /bindQualificationReceipt\(catalog, admission, receipt\)/);
  assert.match(
    load,
    /return Object\.freeze\(\{\s*admission,\s*admissionText,\s*admissionSha256: catalog\.descriptor\.sha256,\s*qualificationReceipt: receipt,\s*qualificationReceiptText: receiptText,\s*qualificationReceiptSha256: catalog\.qualificationReceiptSha256\s*\}\);/
  );
});

test("direct P2P installs exactly six admitted members into the OPFS store", () => {
  const storeWiring = sourceSection(
    app,
    "  function ensureModelCompositionStore",
    "  async function loadCatalogAdmission"
  );
  const directInstall = sourceSection(
    app,
    "  async function startCompanionImport",
    "  function companionSha256"
  );
  const p2pMembers = sourceSection(
    p2pCompositionInstall,
    "  const MEMBER_SPECS = Object.freeze([",
    "  const MEMBER_NAMES ="
  );
  const storeMembers = sourceSection(
    modelCompositionStore,
    "  const MEMBER_NAMES = Object.freeze([",
    "  const CONTENT_ID_PATTERN ="
  );

  assert.deepEqual(
    [...p2pMembers.matchAll(/fileName: "([^"]+)"/g)].map((match) => match[1]),
    compositionMemberNames
  );
  assert.deepEqual(
    [...storeMembers.matchAll(/^\s+"([^"]+)",?$/gm)].map((match) => match[1]),
    compositionMemberNames
  );
  assert.match(
    storeWiring,
    /modelCompositionStoreApi\.createOpfsAdapter\(\{\s*createSha256: incrementalSha256Api\.createSha256\s*\}\)/
  );
  assert.match(
    storeWiring,
    /modelCompositionStoreApi\.createModelCompositionStore\(\{\s*adapter,\s*maximumCompositionBytes: ownedModelMaxBytes\s*\}\)/
  );
  assert.match(
    directInstall,
    /const admissionRecord = await loadCatalogAdmission\(entry, controller\.signal\);[\s\S]*?const manifest = modelStoreManifest\([\s\S]*?const admissionAuthority = modelStoreAdmissionAuthority\([\s\S]*?const store = workerActivationStoreAdapter\([\s\S]*?admissionAuthority\s*\);[\s\S]*?await p2pCompositionInstallApi\.installP2pComposition\(\{\s*entry,\s*admissionRecord,\s*manifest,\s*admissionAuthority,\s*store,\s*signal: controller\.signal,\s*fetch: window\.fetch\.bind\(window\),/
  );
  assert.match(
    p2pCompositionInstall,
    /return await options\.store\.install\(\{\s*manifest: plan\.manifest,\s*admissionAuthority,\s*sources,\s*signal: controller\.signal\s*\}\);/
  );
  assert.match(modelCompositionStore, /value\.members\.length !== MEMBER_NAMES\.length/);
  assert.match(modelCompositionStore, /member\.fileName !== MEMBER_NAMES\[index\]/);
  assert.match(modelCompositionStore, /options\.storageManager\.getDirectory\(\)/);
  assert.match(modelCompositionStore, /getDirectoryHandle\(OPFS_ROOT_NAME, \{ create \}\)/);
  assert.match(modelCompositionStore, /async function ensureDirectory\(path\) \{\s*await directory\(validatePath\(path\), true\);/);
  assert.match(modelCompositionStore, /await writeMember\(context, member, sources\[member\.fileName\]\);/);
  assert.match(
    modelCompositionStore,
    /await atomicWrite\(\s*options\.adapter,\s*\[ACTIVE_POINTER_FILE\],[\s\S]*?"model-composition-store-activation"/
  );
  assert.match(
    modelCompositionStore,
    /await requireActivation\([\s\S]*?pointerWriteAttempted = true;\s*await atomicWrite\(/
  );
  assert.doesNotMatch(directInstall, /activateStoredComposition/);
});

test("the app store adapter restores the prior model after a post-activation failure", async () => {
  const admissionAuthority = Object.freeze({ fixture: "authority" });
  const prior = Object.freeze({ manifestSha256: "prior" });
  const candidate = Object.freeze({ manifestSha256: "candidate" });
  const activationSignal = new AbortController().signal;
  const outerSignal = new AbortController().signal;
  const pointerFailure = new Error("pointer write failed");
  const events = [];
  let candidateActivations = 0;
  let priorRestorations = 0;
  const createAdapter = activationStoreAdapter(
    async (received, readyText, signal) => {
      candidateActivations += 1;
      events.push("worker-activate-candidate");
      assert.strictEqual(received, candidate);
      assert.equal(readyText, "candidate ready");
      assert.strictEqual(signal, activationSignal);
      return true;
    },
    async (received) => {
      priorRestorations += 1;
      events.push("worker-restore-prior");
      assert.strictEqual(received, prior);
    }
  );
  const store = {
    async install(options) {
      events.push("candidate-independently-opened");
      assert.equal(typeof options.activate, "function");
      assert.equal(await options.activate(candidate, {
        previousComposition: prior,
        signal: activationSignal
      }), true);
      assert.equal(await options.authorizeCommit(candidate, {
        previousComposition: prior,
        signal: activationSignal
      }), true);
      events.push("active-pointer-write");
      throw pointerFailure;
    }
  };

  await assert.rejects(
    createAdapter(store, "candidate ready", outerSignal, admissionAuthority).install({
      admissionAuthority
    }),
    (error) => error === pointerFailure
  );
  assert.deepEqual(events, [
    "candidate-independently-opened",
    "worker-activate-candidate",
    "active-pointer-write",
    "worker-restore-prior"
  ]);
  assert.equal(candidateActivations, 1);
  assert.equal(priorRestorations, 1);
});

test("same-identity activation failure discards once without a hidden activation retry", async () => {
  const admissionAuthority = Object.freeze({ fixture: "authority" });
  const candidate = Object.freeze({ manifestSha256: "same-composition" });
  const prior = Object.freeze({ manifestSha256: "same-composition" });
  const activationFailure = new Error("worker rejected active composition");
  let activationCalls = 0;
  let restorationCalls = 0;
  let discardCalls = 0;
  const createAdapter = activationStoreAdapter(
    async (received) => {
      activationCalls += 1;
      assert.strictEqual(received, candidate);
      throw activationFailure;
    },
    async () => {
      restorationCalls += 1;
    },
    () => {
      discardCalls += 1;
    }
  );
  const store = {
    async install(options) {
      return options.activate(candidate, {
        previousComposition: prior,
        signal: null
      });
    }
  };

  await assert.rejects(
    createAdapter(store, "same candidate ready", null, admissionAuthority).install({
      admissionAuthority
    }),
    (error) => error === activationFailure
  );
  assert.equal(activationCalls, 1);
  assert.equal(restorationCalls, 0);
  assert.equal(discardCalls, 1);
});

test("the app store adapter leaves successful commit ordering to the sole store transaction", async () => {
  const admissionAuthority = Object.freeze({ fixture: "authority" });
  const prior = Object.freeze({ manifestSha256: "prior" });
  const candidate = Object.freeze({ manifestSha256: "candidate" });
  const events = [];
  const createAdapter = activationStoreAdapter(
    async (received) => {
      events.push("worker-activate-candidate");
      assert.strictEqual(received, candidate);
      return true;
    },
    async () => {
      events.push("unexpected-restore");
    },
    () => {
      events.push("unexpected-discard");
    },
    (received, readyText) => {
      events.push("ui-ready-after-commit");
      assert.strictEqual(received, candidate);
      assert.equal(readyText, "candidate ready");
    }
  );
  const store = {
    async install(options) {
      events.push("candidate-independently-opened");
      assert.equal(await options.activate(candidate, {
        previousComposition: prior,
        signal: null
      }), true);
      assert.equal(await options.authorizeCommit(candidate, {
        previousComposition: prior,
        signal: null
      }), true);
      events.push("active-pointer-committed");
      events.push("prior-bytes-removed");
      return candidate;
    }
  };

  assert.strictEqual(
    await createAdapter(store, "candidate ready", null, admissionAuthority).install({
      admissionAuthority
    }),
    candidate
  );
  assert.deepEqual(events, [
    "candidate-independently-opened",
    "worker-activate-candidate",
    "active-pointer-committed",
    "prior-bytes-removed",
    "ui-ready-after-commit"
  ]);
});

test("a post-commit readiness failure discards the worker without reopening prior bytes", async () => {
  const admissionAuthority = Object.freeze({ fixture: "authority" });
  const prior = Object.freeze({ manifestSha256: "prior" });
  const candidate = Object.freeze({ manifestSha256: "candidate" });
  const finalizationFailure = new Error("committed worker identity mismatch");
  const events = [];
  const createAdapter = activationStoreAdapter(
    async () => {
      events.push("worker-activate-candidate");
      return true;
    },
    async () => {
      events.push("unexpected-restore");
    },
    () => {
      events.push("worker-discarded");
    },
    () => {
      events.push("ui-finalization-rejected");
      throw finalizationFailure;
    }
  );
  const store = {
    async install(options) {
      await options.activate(candidate, {
        previousComposition: prior,
        signal: null
      });
      await options.authorizeCommit(candidate, {
        previousComposition: prior,
        signal: null
      });
      events.push("active-pointer-committed");
      return candidate;
    }
  };

  await assert.rejects(
    createAdapter(store, "candidate ready", null, admissionAuthority).install({
      admissionAuthority
    }),
    (error) => error === finalizationFailure
  );
  assert.deepEqual(events, [
    "worker-activate-candidate",
    "active-pointer-committed",
    "ui-finalization-rejected",
    "worker-discarded"
  ]);
});

test("cached activation stays noninteractive until commit and rechecks qualification per turn", () => {
  const activationFlow = sourceSection(
    app,
    "  async function activateStoredComposition",
    "  function simpleModelEntryIsActive"
  );
  const activeMatch = sourceSection(
    app,
    "  function activeSelectorCompositionMatchesRuntime",
    "  function setControls"
  );
  const load = sourceSection(
    app,
    "  async function loadSelectedBrowserComposition",
    "  function prompt2ConversationMessages"
  );
  const submit = sourceSection(
    app,
    "  async function submitBrowserConversation",
    "  // Verifies cached state before allowing"
  );
  const controls = sourceSection(
    app,
    "  function setControls",
    "  function setGenerationUi"
  );

  const storeInstall = activationFlow.indexOf("installed = await store.install(");
  const finalReady = activationFlow.indexOf(
    "completeStoredCompositionActivation(installed, readyText, activationToken);",
    storeInstall
  );
  assert.ok(storeInstall >= 0 && finalReady > storeInstall);
  assert.match(
    activationFlow,
    /catch \(error\) \{[\s\S]*?await restoreStoredCompositionAfterFailure\([\s\S]*?previousComposition,[\s\S]*?activationToken[\s\S]*?throw error;[\s\S]*?if \(activationStarted\) \{\s*try \{\s*completeStoredCompositionActivation\(installed, readyText, activationToken\);/
  );
  assert.match(activeMatch, /state\.modelLoaded &&\s*!state\.modelActivationCommitPending &&/);
  assert.match(
    controls,
    /const modelSelectionEnabled = Boolean\(canSelectModel\) &&\s*!state\.modelActivationCommitPending;[\s\S]*?state\.controlsCanSelectModel = modelSelectionEnabled;[\s\S]*?el\.modelSelect\.disabled = state\.generation\.inFlight \|\| !modelSelectionEnabled;/
  );

  const workerActivation = load.indexOf("state.runtimeState = await activateBrowserComposition(");
  const currentnessCheck = load.indexOf("requireCurrentBrowserComposition(model);", workerActivation);
  const pendingBranch = load.indexOf("if (state.modelActivationCommitPending)", currentnessCheck);
  const readyPublish = load.indexOf('setText(el.runtimeStatus, "Ready", false);', pendingBranch);
  assert.ok(
    workerActivation >= 0 && currentnessCheck > workerActivation &&
      pendingBranch > currentnessCheck && readyPublish > pendingBranch
  );
  assert.match(
    load,
    /if \(state\.modelActivationCommitPending\) \{[\s\S]*?state\.modelLoaded = false;[\s\S]*?setControls\(false, false\);[\s\S]*?return true;/
  );

  const firstCurrentnessCheck = submit.indexOf("admission = requireCurrentBrowserComposition(model);");
  const admissionPaint = submit.indexOf("await nextBrowserPaint();", firstCurrentnessCheck);
  const secondCurrentnessCheck = submit.indexOf(
    "admission = requireCurrentBrowserComposition(model);",
    firstCurrentnessCheck + 1
  );
  const beginTurn = submit.indexOf("const assistantMessage = beginConversationTurn(promptText);");
  const generationTry = submit.indexOf("try {", beginTurn);
  const generationCurrentnessCheck = submit.indexOf(
    "admission = requireGenerationAuthority();",
    secondCurrentnessCheck + 1
  );
  assert.ok(
    firstCurrentnessCheck >= 0 && admissionPaint > firstCurrentnessCheck &&
      secondCurrentnessCheck > admissionPaint && beginTurn > secondCurrentnessCheck &&
      generationTry > beginTurn && generationCurrentnessCheck > generationTry
  );
  const generateCall = submit.indexOf("const generatedOutput = await generationClient.generate(");
  const finalCurrentnessCheck = submit.lastIndexOf(
    "admission = requireGenerationAuthority();",
    generateCall
  );
  assert.ok(generateCall > 0 && finalCurrentnessCheck > generationCurrentnessCheck &&
    finalCurrentnessCheck < generateCall);
  const outputAcceptance = submit.indexOf("output = generatedOutput;", generateCall);
  assert.ok(submit.lastIndexOf("requireGenerationAuthority();", outputAcceptance) > generateCall);
  assert.match(
    submit,
    /catch \(error\) \{\s*const text = errorMessage\(error\);\s*discardRejectedStoredActivation\(\);[\s\S]*?return;\s*\}/
  );
});

test("P2P route admission uses per-peer expiry from the actual catalog projection", () => {
  const source = sourceSection(
    app,
    "  function canStartP2pImport",
    "  function catalogV1EntryMatchesHfModel"
  );
  let now = Date.now();
  const clock = class extends Date {
    static now() { return now; }
  };
  const canStartP2pImport = Function(
    "Date",
    `"use strict";\n${source}\nreturn canStartP2pImport;`
  )(clock);
  const projectEntry = Function(
    "BROWSER_ADMISSION_SCHEMA",
    sourceSection(catalogV1, "  function copyMember", "  function buildCatalogViewFromValidated") +
      "\nreturn projectEntry;"
  )(catalogApi.BROWSER_ADMISSION_SCHEMA);
  const rawEntry = {
    entry_id: "qualified/model",
    display_name: "Qualified Model",
    description: "",
    source: {},
    license: {},
    composition: { composition_id: `sha256:${"c".repeat(64)}`, member_count: 6, members: [] },
    browser_admission: {},
    profiles: {},
    qualification: {}
  };
  const feedDeadline = now + 60_000;
  const peerDeadline = now + 30_000;
  const peer = {
    announcementId: "peer/first",
    peerBaseUrl: "https://peer.example/",
    feedValidUntilUtc: new Date(feedDeadline).toISOString(),
    expiresUtc: new Date(peerDeadline).toISOString()
  };
  const project = (peers) => projectEntry(rawEntry, peers, {});
  const entry = project([peer]);
  assert.equal(Object.hasOwn(entry, "feedValidUntilUtc"), false);
  assert.equal(entry.peers[0].feedValidUntilUtc, peer.feedValidUntilUtc);
  assert.equal(canStartP2pImport(entry), true);
  assert.equal(canStartP2pImport(project([])), false);
  assert.equal(canStartP2pImport(null), false);
  assert.equal(canStartP2pImport(project([{ ...peer, feedValidUntilUtc: "invalid" }])), false);
  assert.equal(canStartP2pImport(project([{ ...peer, expiresUtc: "invalid" }])), false);

  now = peerDeadline;
  assert.equal(canStartP2pImport(entry), false, "the selected peer expires before its feed");
  assert.equal(canStartP2pImport(project([
    peer,
    { ...peer, peerBaseUrl: "https://second.example/", expiresUtc: new Date(feedDeadline).toISOString() }
  ])), false, "an expired selected peer cannot silently switch to another peer");
  assert.equal(canStartP2pImport(project([{
    ...peer,
    expiresUtc: new Date(feedDeadline).toISOString()
  }])), true);
  now = feedDeadline;
  assert.equal(canStartP2pImport(project([{
    ...peer,
    expiresUtc: new Date(feedDeadline + 30_000).toISOString()
  }])), false, "feed expiry also closes admission");

  const loader = sourceSection(
    app,
    "  async function loadSimpleModelCatalog",
    "  async function requestSimpleModelAcquisition"
  );
  assert.match(loader, /clearSimpleModelPeerExpiryTimer\(\);/);
  assert.match(loader, /scheduleSimpleModelPeerExpiry\(state\.modelCatalogV1PeerDocument\);/);
});

test("runtime acquisition forwards cancellation and cannot publish a cancelled completion", async () => {
  const source = sourceSection(app, "  async function ensureBrowserRuntimeAsset",
    "  async function* storedCompositionChunks");
  const runtimeState = { runtimeAsset: null };
  let complete;
  let forwarded;
  let renders = 0;
  const asset = { wasmBytes: new ArrayBuffer(8), manifest: {} };
  const ensure = Function("state", "throwIfAcquisitionAborted", "browserRuntimeLoaderApi",
    "paths", "window", "document", "setText", "el", "renderDiagnostics",
    source + "; return ensureBrowserRuntimeAsset;")(
    runtimeState, signal => { if (signal?.aborted) throw new Error("cancelled"); },
    { load: options => { forwarded = options; return new Promise(resolve => { complete = resolve; }); } },
    { runtimeWasmManifest: "manifest", runtimeWasm: "wasm" }, { fetch: () => {} },
    { documentElement: { dataset: {} } }, () => {}, { wasmState: {} }, () => { renders++; });
  const controller = new AbortController();
  const pending = ensure(controller.signal);
  assert.equal(forwarded.signal, controller.signal);
  controller.abort();
  complete(asset);
  await assert.rejects(pending, /cancelled/);
  assert.equal(runtimeState.runtimeAsset, null);
  assert.equal(renders, 0);
  const success = ensure();
  complete(asset);
  assert.equal(await success, asset);
  assert.equal(runtimeState.runtimeAsset, asset);
  assert.equal(renders, 1);
  assert.equal(await ensure(), asset);
  await assert.rejects(ensure(controller.signal), /cancelled/);
});

// Run the production lifetime with a deterministic clock and the real startup helper.
function startupCacheHarness(openActive, ensureFailure) {
  const vm = require("node:vm");
  const timers = new Map();
  let lastSignal;
  let sequence = 0;
  const globals = { AbortController,
    setTimeout(callback, milliseconds) {
      assert.equal(milliseconds, 60000);
      timers.set(++sequence, callback); return sequence;
    }, clearTimeout(id) { timers.delete(id); } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../app/operation-lifetime.js"), "utf8"), globals);
  const code = sourceSection(app, "  async function openStartupComposition", "  // Verifies cached state before allowing");
  const open = Function("operationLifetimeApi", "catalogQualificationError", "ensureModelCompositionStore",
    code + "; return openStartupComposition;")(
    globals.TinyRustLMOperationLifetime,
    (code, message) => Object.assign(new Error(message), { code }),
    () => {
      if (ensureFailure) throw ensureFailure;
      return { openActive(options) { lastSignal = options.signal; return openActive(options); } };
    });
  return { open, timers, get signal() { return lastSignal; },
    expire() { for (const callback of [...timers.values()]) callback(); } };
}

test("startup cache verification cleans its timer on empty, saved and failed reads", async t => {
  for (const value of [null, { manifestSha256: "saved-identity" }, new Error("read failed")]) {
    await t.test(value === null ? "empty" : value instanceof Error ? "failure" : "saved", async () => {
      const harness = startupCacheHarness(() => {
        if (value instanceof Error) throw value;
        return value;
      });
      if (value instanceof Error) await assert.rejects(harness.open(), error => error === value);
      else assert.equal(await harness.open(), value);
      assert.equal(harness.signal.aborted, false);
      assert.equal(harness.timers.size, 0);
    });
  }
  const failure = new Error("OPFS unavailable");
  const unavailable = startupCacheHarness(() => assert.fail("unavailable store read"), failure);
  await assert.rejects(unavailable.open(), error => error === failure);
  assert.equal(unavailable.timers.size, 0);
});

test("startup cache deadline aborts the read and rejects late success or failure", async t => {
  for (const late of ["success", "failure"]) await t.test(late, async () => {
    const pending = deferred();
    let calls = 0;
    const harness = startupCacheHarness(() => { calls++; return pending.promise; });
    const result = harness.open();
    await Promise.resolve(); await Promise.resolve();
    assert.equal(calls, 1);
    harness.expire();
    await assert.rejects(result, error => error.code === "model-cache-open-timeout");
    assert.equal(harness.signal.aborted, true);
    assert.equal(harness.timers.size, 0);
    if (late === "success") pending.resolve({ manifestSha256: "late-must-not-activate" });
    else pending.reject(new Error("late storage failure"));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 1);
  });
});

test("boot restores a verified cache, bootstraps an empty cache, and preserves an uncertain cache", async t => {
  for (const outcome of ["saved", "empty", "timeout", "read-error", "activation-error"]) {
    await t.test(outcome, async () => {
      const state = {};
      const saved = { manifestSha256: "saved" };
      const failure = Object.assign(new Error("cache check failed"), {
        code: outcome === "timeout" ? "model-cache-open-timeout" : "model-composition-store-read" });
      const events = [];
      const nodes = { runtimeStatus: "runtime", modelState: "model", errorState: "error",
        appShell: { dataset: { mode: "simple" } } };
      const bindings = { state, el: nodes, paths: { models: {} }, localModelKey: "local",
        setInteractive() {}, setControls() {}, renderDiagnostics() {}, renderModelOptions() {},
        setText(node, text) { events.push([node, text]); },
        setSimpleModelPickerStatus(text) { events.push(["picker-error", text]); },
        friendlyError: text => text,
        openStartupComposition: async () => {
          if (["timeout", "read-error"].includes(outcome)) throw failure;
          return outcome === "empty" ? null : saved;
        },
        restoreStoredCatalogAuthority(value) { assert.equal(value, saved); events.push(["custody"]); },
        loadSimpleModelCatalog: async () => { events.push(["catalog"]); },
        activateStoredComposition: async value => {
          assert.equal(value, saved); events.push(["activate"]);
          if (outcome === "activation-error") throw failure;
        },
        discardRejectedStoredActivation() { events.push(["discard-worker"]); },
        appendConsole() {}, errorMessage: error => error.message,
        chooseBootstrapModelRoute: () => ({ entry: {} }), simpleModelRouteViews: () => [],
        simpleModelAcquisitionIsActive: () => false,
        selectSimpleModelEntry() {}, toggleModelPopover() {},
        requestSimpleModelAcquisition: async () => { events.push(["acquire"]); },
        maybePresentInitialModelChooser() { events.push(["chooser"]); }
      };
      const code = sourceSection(app, "  async function boot()", "  el.form.addEventListener");
      const boot = Function(...Object.keys(bindings), code + "; return boot;")(...Object.values(bindings));
      await boot();
      assert.equal(state.initialModelBootComplete, true);
      assert.equal(state.initialModelRestored, outcome === "saved");
      assert.equal(events.filter(([name]) => name === "acquire").length, outcome === "empty" ? 1 : 0);
      assert.equal(events.filter(([name]) => name === "activate").length,
        ["saved", "activation-error"].includes(outcome) ? 1 : 0);
      assert.equal(events.filter(([name]) => name === "chooser").length, outcome === "saved" ? 0 : 1);
      if (["timeout", "read-error"].includes(outcome)) assert.equal(state.compositionStoreError, failure);
      assert.equal(events.filter(([name]) => name === "picker-error").length,
        ["timeout", "read-error", "activation-error"].includes(outcome) ? 1 : 0);
    });
  }
});

test("boot reopens and verifies the persistent active composition", () => {
  const boot = sourceSection(app, "  async function boot()", "  el.form.addEventListener");
  const openActive = sourceSection(
    modelCompositionStore,
    "    async function openActive(value)",
    "    async function cleanup(value)"
  );
  const openActiveInternal = sourceSection(
    modelCompositionStore,
    "    async function openActiveInternal(signal)",
    "    async function install(value)"
  );
  const openPointerInternal = sourceSection(
    modelCompositionStore,
    "    async function openPointerInternal(pointer, signal)",
    "    async function openActiveInternal(signal)"
  );

  assert.doesNotMatch(boot, /ensureBrowserRuntimeAsset/);
  assert.match(boot, /cachedComposition = await openStartupComposition\(\);/);
  assert.match(
    boot,
    /if \(cachedComposition\) \{[\s\S]*?await activateStoredComposition\(\s*cachedComposition,\s*"Your saved model is verified and ready\."\s*\);\s*state\.initialModelRestored = true;\s*state\.initialModelBootComplete = true;\s*return;/
  );
  assert.match(
    openActive,
    /withExclusiveLock\(\s*options\.adapter,\s*\(\) => openActiveInternal\(signal\),\s*signal\s*\)/
  );
  assert.match(
    openActiveInternal,
    /const pointer = await readPointer\(options\.adapter, signal\);\s*if \(pointer === null\) return null;\s*await requireResolvedPointer\(options\.adapter, pointer, signal\);\s*return openPointerInternal\(pointer, signal\);/
  );
  assert.doesNotMatch(openActiveInternal, /initialize\(/);
  assert.match(
    openPointerInternal,
    /readInstalledManifest\([\s\S]*?readInstalledAdmissionAuthority\([\s\S]*?await verifyInstalled\(options, pointer, manifest, signal\);[\s\S]*?return openedComposition\(/
  );
});

test("local conversion installs through companion-composition-install", () => {
  const conversion = sourceSection(
    app,
    "  async function startCompanionConversion",
    "  async function prepareCompanionConvertedModel"
  );
  const browserInstall = sourceSection(
    app,
    "  async function prepareCompanionConvertedModel",
    "  async function getHfModel"
  );
  const localFileInstall = sourceSection(
    app,
    "  async function importBrowserComposition",
    "  function hfOrigin"
  );

  assert.match(app, /const companionCompositionInstallApi = window\.TinyRustLMCompanionCompositionInstall;/);
  assert.match(
    html,
    /<script src="\.\/companion-composition-install\.js\?v=sha256-[0-9a-f]{64}"><\/script>/
  );
  assert.match(
    conversion,
    /if \(conversionState === "available"\) \{\s*return await prepareCompanionConvertedModel\(entry, status, sequence\);/
  );
  assert.match(
    browserInstall,
    /const admissionRecord = await loadCatalogAdmission\(entry, controller\.signal\);[\s\S]*?requireCurrentCatalogAdmission\(entry, admissionRecord\.admission\);[\s\S]*?const manifest = modelStoreManifest\(admissionRecord\);\s*const admissionAuthority = modelStoreAdmissionAuthority\(admissionRecord\);[\s\S]*?const store = workerActivationStoreAdapter\([\s\S]*?admissionAuthority\s*\);[\s\S]*?\.installCompanionComposition\(\{\s*client: state\.companion\.client,\s*store,\s*projection: status,\s*admission: admissionRecord\.admission,\s*manifest,\s*admissionAuthority,\s*signal: controller\.signal,/
  );
  assert.match(
    companionCompositionInstall,
    /activated = await options\.store\.install\(\{\s*manifest: plan\.manifest,\s*admissionAuthority: plan\.admissionAuthority,\s*sources,\s*signal: signal \|\| undefined\s*\}\);/
  );
  assert.doesNotMatch(browserInstall, /activateStoredComposition/);
  assert.match(
    localFileInstall,
    /const admissionAuthority = modelStoreAdmissionAuthority\(admissionRecord\);\s*const store = workerActivationStoreAdapter\([\s\S]*?admissionAuthority\s*\);\s*await store\.install\(\{\s*manifest: modelStoreManifest\(admissionRecord\),\s*admissionAuthority,/
  );
  assert.doesNotMatch(localFileInstall, /activateStoredComposition/);
  assert.doesNotMatch(conversion, /client\.startConversion\(/);
});

test("supported local conversion activates before optional local-only seeding", () => {
  const seed = sourceSection(
    app,
    "  function localDirectSeedErrorCode",
    "  async function startCompanionConversion"
  );
  const install = sourceSection(
    app,
    "  async function prepareCompanionConvertedModel",
    "  async function getHfModel"
  );
  const cancel = sourceSection(
    app,
    "  async function cancelCompanionImportInternal",
    "  async function cancelCompanionImport()"
  );
  assert.match(html, /id="companionSeedStatus"[^>]*data-state="idle"[^>]*data-code="none"/);
  assert.equal((seed.match(/startDirectCompositionSeed\(/g) || []).length, 1);
  assert.match(
    seed,
    /companion\.seedRecords\.size >= maximumDirectCompositionSeedLifecycles/
  );
  assert.match(
    seed,
    /if \(record\) \{[\s\S]*?never issue another start[\s\S]*?await reconcileDirectSeedRecord\(record/
  );
  assert.match(seed, /The model remains installed; no public reachability or announcement is claimed/);
  assert.doesNotMatch(seed, /setSimpleModelPickerStatus|setHfStatus/);
  assert.ok(
      install.indexOf(".installCompanionComposition({") <
      install.indexOf('setCompanionAcquisitionTerminal("installed")') &&
      install.indexOf('setCompanionAcquisitionTerminal("installed")') <
      install.indexOf("const sharingStarted = await requestLocalDirectSeed("),
    "browser activation and installed terminal state must precede local seeding"
  );
  assert.match(
    install,
    /const sharingStarted = await requestLocalDirectSeed\([\s\S]*?if \(sequence !== state\.companion\.pollSequence \|\| controller\.signal\.aborted\) \{\s*return false;\s*\}[\s\S]*?Local sharing on this device is on\.[\s\S]*?Local sharing on this device did not start\.[\s\S]*?toggleModelPopover/
  );
  assert.match(app, /directSeedHasPendingRequest\(\) \|\|/);
  assert.match(app, /companion\.streamAbort \|\|\s*directSeedCanStop\(\)/);
  assert.match(
    cancel,
    /const seedOutcome = seedCancellationRequested\s*\? await requestDirectSeedStop\(seedOperationId\)[\s\S]*?The model is installed and ready\. Local direct sharing stopped\./
  );
  assert.match(cancel, /const remoteAcquisition = !browserInstallComplete && \(/);
  assert.doesNotMatch(install, /startDirectCompositionSeed[\s\S]*?installCompanionComposition/);
});

test("P2P Cancel never stops an unrelated displayed seed operation", async () => {
  const seedOperationId = "a".repeat(64);
  let seedStops = 0;
  let acquisitionAborts = 0;
  const state = {
    modelAcquisitionRoute: "p2p",
    modelAcquisitionCommand: Promise.resolve(false),
    activeAcquisitionAbort: { abort() { acquisitionAborts += 1; } },
    companion: {
      activeStatus: { state: "installed" },
      activeOperationId: seedOperationId,
      activeOperationKind: "source",
      browserLoadBytes: 0,
      streamAbort: null,
      operationRequest: null,
      cancelPromise: null,
      seedDisplayOperationId: seedOperationId,
      seedRecords: new Map([[seedOperationId, {
        operationId: seedOperationId,
        state: "ready"
      }]])
    }
  };
  const cancellation = acquisitionCancellationFunctions(state, {
    async requestDirectSeedStop() {
      seedStops += 1;
      return { confirmed: true };
    }
  });

  assert.equal(await cancellation.cancelCompanionImportInternal(), true);
  assert.equal(acquisitionAborts, 1);
  assert.equal(seedStops, 0);
  assert.equal(state.companion.seedRecords.get(seedOperationId).state, "ready");
});

test("explicit Cancel waits for the acquisition commit verdict before publishing a terminal state", async () => {
  const command = deferred();
  const state = {
    modelAcquisitionCommand: command.promise,
    companion: { activeStatus: null }
  };
  const flow = compactAcquisitionRequestFunction(state);
  const request = flow.cancel();
  await Promise.resolve();
  assert.deepEqual(flow.statuses, []);

  command.resolve(true);
  assert.equal(await request, true);
  assert.equal(flow.statuses.some(([text]) => /cancelled/iu.test(text)), false);
});

test("explicit Cancel preserves a committed browser model when optional sharing makes the command return false", async () => {
  const command = deferred();
  const readyText = "The model is ready. Local direct sharing was stopped.";
  const statuses = [];
  const state = {
    modelAcquisitionCommand: command.promise,
    companion: {
      activeStatus: { state: "installed" },
      browserInstallState: "installed"
    }
  };
  const flow = compactAcquisitionRequestFunction(state, {
    statuses,
    async cancelCompanionImport() {
      statuses.push([readyText, false]);
      return true;
    }
  });

  const request = flow.cancel();
  await Promise.resolve();
  command.resolve(false);

  assert.equal(await request, true);
  assert.deepEqual(statuses, [[readyText, false]]);
  assert.equal(statuses.some(([text]) => /acquisition cancelled/iu.test(text)), false);
});

test("lost poll reconciliation keeps Cancel and never creates another operation", async () => {
  const operationId = "a".repeat(64);
  const calls = [];
  const flow = companionAcquisitionRuntime({
    client: {
      async createOperation() {
        calls.push("create");
        return { operationId, state: "converting" };
      },
      async getOperation(id) {
        assert.equal(id, operationId);
        calls.push("get");
        if (calls.filter((call) => call === "get").length === 1) {
          throw Object.assign(new Error("Status reply interrupted"), { code: "companion-timeout" });
        }
        return { operationId, state: "converting" };
      },
      async cancelOperation(id) {
        assert.equal(id, operationId);
        calls.push("cancel");
        return { operationId, state: "cancelled" };
      }
    }
  });
  assert.equal(await flow.start(), false);
  assert.deepEqual(calls, ["create", "get"]);
  assert.equal(flow.state.modelAcquisitionCommand, null);
  assert.equal(flow.state.companion.activeOperationId, operationId);
  assert.equal(flow.state.companion.activeStatus.state, "reconcile-required");
  assert.equal(flow.active(), true, "Cancel remains available and acquisition stays gated");
  assert.ok(flow.statuses.some(([text]) => /Use Cancel/.test(text)));
  await flow.cancel();
  assert.deepEqual(calls, ["create", "get", "get", "cancel"]);
  assert.equal(flow.state.companion.activeStatus.state, "cancelled");
  assert.equal(flow.active(), false);
});

test("Cancel before computed operation ID settles clears queued state without any request", async () => {
  const identity = deferred();
  const calls = [];
  const flow = companionAcquisitionRuntime({
    computeOperationId: () => identity.promise,
    client: {
      async createOperation() { calls.push("create"); },
      async getOperation() { calls.push("get"); },
      async cancelOperation() { calls.push("cancel"); }
    }
  });
  const command = flow.start();
  assert.equal(flow.state.companion.activeStatus.state, "queued");
  assert.equal(flow.state.companion.activeOperationId, "");
  assert.equal(flow.active(), true);
  const cancellation = flow.cancel();
  const duplicateCancel = flow.cancel();
  identity.resolve("a".repeat(64));
  assert.equal(await command, false);
  await cancellation;
  await duplicateCancel;
  assert.deepEqual(calls, []);
  assert.equal(flow.state.companion.activeStatus.state, "cancelled");
  assert.equal(flow.state.modelAcquisitionCommand, null);
  assert.equal(flow.state.companion.cancelPromise, null);
  assert.equal(flow.active(), false);
  assert.equal(flow.statuses.some(([text]) => /could not be confirmed|may still be running/i.test(text)), false);
});

test("Cancel after browser install commit preserves Ready without starting sharing", async () => {
  const installing = deferred();
  const commit = deferred();
  const operationId = "a".repeat(64);
  const calls = [];
  const flow = companionAcquisitionRuntime({
    client: {
      async createOperation() {
        calls.push("create");
        return { operationId, state: "available" };
      },
      async getOperation() { calls.push("get"); },
      async cancelOperation() { calls.push("cancel"); }
    },
    async installCompanionComposition({ signal }) {
      calls.push("install");
      installing.resolve(signal);
      await commit.promise;
      flow.state.modelLoaded = true;
      return true;
    },
    async requestLocalDirectSeed() { calls.push("share"); }
  });
  const command = flow.start();
  const signal = await installing.promise;
  const cancellation = flow.cancel();
  assert.equal(signal.aborted, true);
  await new Promise((resolve) => setImmediate(resolve));
  const prematureCancellation = flow.statuses.some(([text]) => /acquisition cancelled/i.test(text));
  commit.resolve();
  const commandResult = await command;
  const cancelResult = await cancellation;
  assert.equal(prematureCancellation, false, "Cancel must await the browser commit verdict");
  assert.equal(commandResult, true, "a durable install result wins over late cancellation");
  assert.equal(cancelResult, true);
  assert.equal(flow.state.modelLoaded, true);
  assert.equal(flow.state.companion.browserInstallState, "installed");
  assert.equal(flow.state.companion.activeStatus.state, "installed");
  assert.equal(flow.active(), false);
  assert.deepEqual(calls, ["create", "install"]);
  assert.equal(flow.statuses.some(([text]) => /acquisition cancelled/i.test(text)), false);
  assert.ok(flow.statuses.some(([text]) => /saved in this browser and ready/.test(text)));
});

test("duplicate acquisition intent joins the same in-flight composition without cancelling", async () => {
  const command = deferred();
  const compositionId = `sha256:${"d".repeat(64)}`;
  let cancellations = 0;
  const state = {
    modelAcquisitionCommand: command.promise,
    modelAcquisitionCompositionId: compositionId,
    companion: { activeStatus: { state: "acquiring" } }
  };
  const flow = compactAcquisitionRequestFunction(state, {
    async cancelCompanionImport() {
      cancellations += 1;
      return true;
    }
  });
  const entry = { composition: { compositionId } };

  const cardIntent = flow.request(entry);
  const advancedIntent = flow.request({ composition: { compositionId } });
  await Promise.resolve();

  assert.equal(cancellations, 0);
  assert.equal(state.modelAcquisitionCommand, command.promise);
  command.resolve(true);
  assert.equal(await cardIntent, true);
  assert.equal(await advancedIntent, true);
  assert.equal(cancellations, 0);
});

test("different re-entrant acquisition intent is a truthful no-op and never cancels", async () => {
  const command = deferred();
  const activeCompositionId = `sha256:${"a".repeat(64)}`;
  let cancellations = 0;
  const state = {
    modelAcquisitionCommand: command.promise,
    modelAcquisitionCompositionId: activeCompositionId,
    companion: { activeStatus: { state: "acquiring" } }
  };
  const flow = compactAcquisitionRequestFunction(state, {
    async cancelCompanionImport() {
      cancellations += 1;
      return true;
    }
  });

  assert.equal(await flow.request({
    composition: { compositionId: `sha256:${"b".repeat(64)}` }
  }), false);
  assert.equal(cancellations, 0);
  assert.deepEqual(flow.statuses, [[
    "Another model is already being prepared. Use Cancel before choosing a different model.",
    false
  ]]);
  assert.equal(state.modelAcquisitionCommand, command.promise);
  command.resolve(false);
});

test("browser install failure preserves companion Available and records a separate terminal", async () => {
  const available = Object.freeze({
    operationId: "b".repeat(64),
    state: "available"
  });
  const state = {
    activeAcquisitionAbort: null,
    companion: {
      pollSequence: 3,
      client: {},
      activeStatus: available,
      streamAbort: null,
      browserLoadBytes: 0,
      browserInstallState: "idle",
      browserInstallErrorCode: "none"
    }
  };
  const failure = Object.assign(new Error("cached member digest mismatch"), {
    code: "model-composition-store-stored-sha256"
  });
  const flow = companionBrowserInstallFunction(state, {
    async loadCatalogAdmission() {
      throw failure;
    }
  });

  assert.equal(await flow.install({ displayName: "Pinned Model" }, available, 3), false);
  assert.equal(state.companion.activeStatus, available);
  assert.equal(state.companion.activeStatus.state, "available");
  assert.equal(state.companion.browserInstallState, "failed");
  assert.equal(
    state.companion.browserInstallErrorCode,
    "model-composition-store-stored-sha256"
  );
  assert.equal(state.activeAcquisitionAbort, null);
  assert.equal(state.companion.streamAbort, null);
  assert.ok(flow.statuses.some(([surface, text, error]) => (
    surface === "simple" && error === true &&
    text === "Browser install stopped: cached member digest mismatch"
  )));
});

test("successful conversion reports local sharing without exposing its controls in Basic", async () => {
  const available = Object.freeze({
    operationId: "c".repeat(64),
    state: "available"
  });
  for (const [sharingStarted, expected] of [
    [true, "Pinned Model is ready. Local sharing on this device is on."],
    [false, "Pinned Model is ready. Local sharing on this device did not start."]
  ]) {
    const state = {
      activeAcquisitionAbort: null,
      companion: {
        pollSequence: 4,
        client: {},
        activeStatus: available,
        streamAbort: null,
        browserLoadBytes: 0,
        browserInstallState: "idle",
        browserInstallErrorCode: "none"
      }
    };
    const flow = companionBrowserInstallFunction(state, {
      requestLocalDirectSeed: async () => sharingStarted
    });
    assert.equal(await flow.install({ displayName: "Pinned Model" }, available, 4), true);
    assert.ok(flow.statuses.some(([surface, text, error]) => (
      surface === "simple" && text === expected && error === false
    )));
  }
  const basicChooser = sourceSection(
    html,
    'id="simpleDiscoveryPanel"',
    '<section id="simpleErrorPanel"'
  );
  assert.doesNotMatch(basicChooser, /companionSeedStatus|Local P2P sharing|Stop sharing/u);
  assert.match(html, /id="companionSeedStatus"/u);
});

test("ambiguous cancelled seed start reconciles by read then stop without another start", async () => {
  const operationId = "7".repeat(64);
  const compositionId = `sha256:${"8".repeat(64)}`;
  const calls = [];
  const statuses = [];
  const started = deferred();
  let serverProjection = null;
  const client = {
    isPaired: true,
    async startDirectCompositionSeed(id) {
      calls.push(["start", id]);
      serverProjection = directSeedProjection(id, compositionId);
      return started.promise;
    },
    async readDirectCompositionSeed(id) {
      calls.push(["read", id]);
      return serverProjection;
    },
    async stopDirectCompositionSeed(id) {
      calls.push(["stop", id]);
      serverProjection = directSeedProjection(id, compositionId, "stopped", 2);
      return serverProjection;
    }
  };
  const state = directSeedCoordinatorState(client);
  state.companion.pollSequence = 1;
  state.companion.activeOperationId = operationId;
  const coordinator = directSeedCoordinatorFunctions(state, {
    render() {
      statuses.push(state.companion.seedStatus);
    }
  });
  const controller = new AbortController();
  const acquisition = coordinator.requestLocalDirectSeed(
    { composition: { compositionId } },
    { operationId },
    1,
    controller.signal
  );
  await Promise.resolve();
  await Promise.resolve();
  controller.abort();
  state.companion.pollSequence = 2;
  const cancellation = coordinator.requestDirectSeedStop(operationId);
  started.resolve(serverProjection);

  assert.equal(await acquisition, false);
  assert.equal((await cancellation).confirmed, true);
  assert.deepEqual(calls, [
    ["start", operationId],
    ["read", operationId],
    ["stop", operationId]
  ]);
  assert.equal(statuses.includes("ready"), false);
  assert.equal(state.companion.seedRecords.get(operationId).state, "stopped");
  assert.equal(state.companion.seedRecords.get(operationId).stopRequested, true);
});

test("seed coordinator retains four identities and observes terminal child failure", async () => {
  const server = new Map();
  const compositions = new Map();
  const calls = [];
  const client = {
    isPaired: true,
    async startDirectCompositionSeed(operationId) {
      calls.push(["start", operationId]);
      if (server.has(operationId)) {
        return server.get(operationId);
      }
      if (server.size >= 4) {
        throw new companionCapabilityApi.CompanionCapabilityError(
          "direct-composition-seed-resource-limit",
          409
        );
      }
      const projectionValue = directSeedProjection(
        operationId,
        compositions.get(operationId)
      );
      server.set(operationId, projectionValue);
      return projectionValue;
    },
    async readDirectCompositionSeed(operationId) {
      calls.push(["read", operationId]);
      const projectionValue = server.get(operationId);
      if (!projectionValue) {
        throw new companionCapabilityApi.CompanionCapabilityError(
          "direct-composition-seed-not-found",
          404
        );
      }
      return projectionValue;
    },
    async stopDirectCompositionSeed(operationId) {
      calls.push(["stop", operationId]);
      const current = server.get(operationId);
      const stopped = current.state === "ready"
        ? directSeedProjection(operationId, current.compositionId, "stopped", 2)
        : current;
      server.set(operationId, stopped);
      return stopped;
    }
  };
  const state = directSeedCoordinatorState(client);
  const coordinator = directSeedCoordinatorFunctions(state);
  const operationIds = ["1", "2", "3", "4"].map((value) => value.repeat(64));

  for (const [index, operationId] of operationIds.entries()) {
    const compositionId = `sha256:${String(index + 5).repeat(64)}`;
    compositions.set(operationId, compositionId);
    state.companion.pollSequence = index + 1;
    state.companion.activeOperationId = operationId;
    assert.equal(await coordinator.requestLocalDirectSeed(
      { composition: { compositionId } },
      { operationId },
      index + 1,
      new AbortController().signal
    ), true);
  }
  assert.deepEqual(Array.from(state.companion.seedRecords.keys()), operationIds);

  state.companion.pollSequence = 5;
  state.companion.activeOperationId = operationIds[0];
  assert.equal(await coordinator.requestLocalDirectSeed(
    { composition: { compositionId: compositions.get(operationIds[0]) } },
    { operationId: operationIds[0] },
    5,
    new AbortController().signal
  ), true);
  assert.equal(calls.filter(([kind]) => kind === "start").length, 4);

  const retainedIds = Array.from(state.companion.seedRecords.keys());
  const fifthOperationId = "9".repeat(64);
  state.companion.pollSequence = 6;
  state.companion.activeOperationId = fifthOperationId;
  assert.equal(await coordinator.requestLocalDirectSeed(
    { composition: { compositionId: `sha256:${"a".repeat(64)}` } },
    { operationId: fifthOperationId },
    6,
    new AbortController().signal
  ), false);
  assert.deepEqual(Array.from(state.companion.seedRecords.keys()), retainedIds);
  assert.equal(calls.filter(([kind]) => kind === "start").length, 4);
  assert.equal(state.companion.seedStatusCode, "direct-composition-seed-resource-limit");

  const failedOperationId = operationIds[1];
  server.set(failedOperationId, directSeedProjection(
    failedOperationId,
    compositions.get(failedOperationId),
    "failed",
    2
  ));
  await coordinator.reconcileKnownDirectSeeds();
  assert.equal(state.companion.seedRecords.get(failedOperationId).state, "failed");

  const stoppedOperationId = operationIds[2];
  const stopResult = await coordinator.requestDirectSeedStop(stoppedOperationId);
  assert.equal(stopResult.confirmed, true);
  assert.equal(state.companion.seedRecords.get(stoppedOperationId).state, "stopped");
  assert.equal(state.companion.seedRecords.get(operationIds[3]).state, "ready");

  const boundedRecord = state.companion.seedRecords.get(operationIds[3]);
  boundedRecord.pollCount = 30;
  state.companion.seedMonitorSequence = 77;
  await coordinator.pollDirectSeedRecords(77);
  assert.equal(boundedRecord.state, "reconcile-required");
  assert.equal(boundedRecord.code, "direct-composition-seed-observation-bound");

  server.delete(operationIds[0]);
  await coordinator.reconcileKnownDirectSeeds();
  assert.equal(state.companion.seedRecords.has(operationIds[0]), false);
  compositions.set(fifthOperationId, `sha256:${"a".repeat(64)}`);
  state.companion.pollSequence = 7;
  state.companion.activeOperationId = fifthOperationId;
  assert.equal(await coordinator.requestLocalDirectSeed(
    { composition: { compositionId: compositions.get(fifthOperationId) } },
    { operationId: fifthOperationId },
    7,
    new AbortController().signal
  ), true);
  assert.equal(state.companion.seedRecords.has(fifthOperationId), true);
});

test("direct seed reload custody is canonical and bounded to four exact identities", () => {
  const source = sourceSection(
    app,
    "  function normalizeDirectCompositionSeedCustody",
    "  function persistDirectCompositionSeedCustody"
  );
  const codec = Function(
    "directCompositionSeedCustodySchema",
    "maximumDirectCompositionSeedLifecycles",
    `"use strict";\n${source}\nreturn { encodeDirectCompositionSeedCustody, decodeDirectCompositionSeedCustody };`
  )("tinyrustlm.browser.direct-composition-seed-custody.v1", 4);
  const records = ["1", "2", "3", "4"].map((value, index) => ({
    operationId: value.repeat(64),
    compositionId: `sha256:${String(index + 5).repeat(64)}`,
    stopRequested: index === 3
  }));
  const wire = codec.encodeDirectCompositionSeedCustody({
    schema: "tinyrustlm.browser.direct-composition-seed-custody.v1",
    records
  });
  assert.deepEqual(codec.decodeDirectCompositionSeedCustody(wire), {
    schema: "tinyrustlm.browser.direct-composition-seed-custody.v1",
    records
  });
  assert.match(wire, /^\{"schema":"tinyrustlm\.browser\.direct-composition-seed-custody\.v1","records":\[/u);
  assert.throws(() => codec.decodeDirectCompositionSeedCustody(
    `{"records":[],"schema":"tinyrustlm.browser.direct-composition-seed-custody.v1"}`
  ));
  assert.throws(() => codec.encodeDirectCompositionSeedCustody({
    schema: "tinyrustlm.browser.direct-composition-seed-custody.v1",
    records: [...records, {
      operationId: "a".repeat(64),
      compositionId: `sha256:${"b".repeat(64)}`,
      stopRequested: false
    }]
  }));
  assert.throws(() => codec.encodeDirectCompositionSeedCustody({
    schema: "tinyrustlm.browser.direct-composition-seed-custody.v1",
    records: [records[0], records[0]]
  }));

  const refresh = sourceSection(
    app,
    "  async function refreshCompanionRuntime",
    "  async function detectCompanion"
  );
  const initialize = sourceSection(app, "  function initializeUiShell", "  function installUiEventHandlers");
  const pagehide = sourceSection(app, "  window.addEventListener(\"pagehide\"", "  initializeUiShell();");
  assert.match(refresh, /await reconcileKnownDirectSeeds\(\);/);
  assert.match(initialize, /restoreDirectCompositionSeedCustody\(\);/);
  assert.match(pagehide, /record\.stopRequested = true;[\s\S]*?markKnownDirectSeedsForReconnect\("direct-composition-seed-browser-reload"\);[\s\S]*?persistDirectCompositionSeedCustody\(\);/);
});

test("compact chooser projects exact installed, P2P, supported conversion, and unsupported routes", () => {
  const state = {
    modelLoaded: false,
    activeComposition: null,
    localModel: null,
    modelCatalogV1Entries: [],
    simpleModelConversionRecovery: null,
    companion: { client: {} }
  };
  const entry = (compositionId, source, availability = "local-conversion") => ({
    entryId: compositionId,
    displayName: compositionId,
    source,
    composition: { compositionId },
    browserAdmission: {},
    availability,
    peers: availability === "peer" ? [{ peerBaseUrl: "https://peer.example/" }] : []
  });
  const supportedSource = {
    repository: companionCapabilityApi.SOURCE_DESCRIPTOR.sourceRepository,
    revision: companionCapabilityApi.SOURCE_DESCRIPTOR.sourceRevision
  };
  const unsupportedSource = {
    repository: "playwright/unsupported-source",
    revision: "f".repeat(40)
  };
  const supported = entry("sha256:" + "a".repeat(64), supportedSource);
  const unsupported = entry("sha256:" + "b".repeat(64), unsupportedSource);
  const peer = entry("sha256:" + "c".repeat(64), unsupportedSource, "peer");
  const secondPeer = entry("sha256:" + "d".repeat(64), supportedSource, "peer");
  state.modelCatalogV1Entries = [supported, unsupported, peer, secondPeer];

  const projection = compactChooserRouteFunctions(state);
  assert.equal(projection.simpleModelRouteProjection(supported).kind, "supported-local-conversion");
  assert.equal(projection.simpleModelRouteProjection(unsupported).kind, "unsupported-source");
  assert.equal(projection.simpleModelRouteProjection(unsupported).actionable, false);
  assert.equal(projection.simpleModelRouteProjection(peer).kind, "qualified-p2p");

  const routes = projection.simpleModelRouteViews();
  assert.equal(
    projection.chooseDefaultSimpleModelRoute(routes, supported.composition.compositionId).entry,
    peer
  );
  assert.equal(
    projection.chooseDefaultSimpleModelRoute(routes, secondPeer.composition.compositionId).entry,
    secondPeer
  );

  state.modelLoaded = true;
  state.activeComposition = {
    graphIdentitySha256: "a".repeat(64),
    memberTableSha256: "e".repeat(64)
  };
  state.localModel = {
    browserComposition: {
      admissionSha256: "f".repeat(64),
      storedComposition: {
        admissionAuthority: { admissionSha256: "f".repeat(64) }
      },
      admission: {
        modelId: "Verified installed model",
        composition: {
          graphIdentitySha256: "a".repeat(64),
          memberTableSha256: "e".repeat(64)
        },
        artifacts: Array.from({ length: 6 }, (_, index) => ({
          fileName: `member-${index}`,
          byteCount: index + 1,
          sha256: String(index + 1).repeat(64),
          format: `format-${index}`
        }))
      }
    }
  };
  const installedRoutes = projection.simpleModelRouteViews();
  assert.equal(projection.simpleModelRouteProjection(supported).kind, "installed");
  assert.equal(installedRoutes.length, 4);
  assert.equal(installedRoutes[0].entry.displayName, "Verified installed model");
  assert.equal(installedRoutes[0].entry.availability, "installed");
  assert.equal(installedRoutes[0].entry.peers.length, 0);
  assert.equal(
    projection.chooseDefaultSimpleModelRoute(installedRoutes, secondPeer.composition.compositionId).entry,
    installedRoutes[0].entry
  );

  state.modelLoaded = false;
  state.activeComposition = null;
  state.localModel = null;
  state.modelCatalogV1Entries = [unsupported];
  assert.equal(projection.chooseDefaultSimpleModelRoute(
    projection.simpleModelRouteViews(),
    unsupported.composition.compositionId
  ), null);
});

test("compact chooser projects an already qualification-reconciled active installation", () => {
  const graphIdentitySha256 = "a".repeat(64);
  const memberTableSha256 = "b".repeat(64);
  const admissionSha256 = "c".repeat(64);
  const state = {
    modelLoaded: true,
    activeComposition: { graphIdentitySha256, memberTableSha256 },
    localModel: {
      browserComposition: {
        admissionSha256,
        storedComposition: { admissionAuthority: { admissionSha256 } },
        admission: {
          modelId: "Verified cached model",
          composition: { graphIdentitySha256, memberTableSha256 },
          artifacts: Array.from({ length: 6 }, (_, index) => ({
            fileName: `member-${index}`,
            byteCount: 100 + index,
            sha256: String(index + 1).repeat(64),
            format: `format-${index}`
          }))
        }
      }
    },
    modelCatalogV1Entries: [],
    simpleModelConversionRecovery: null,
    companion: { client: {} }
  };
  const projection = compactChooserRouteFunctions(state);
  const installed = projection.verifiedInstalledSimpleModelEntry();
  assert.equal(installed.composition.compositionId, `sha256:${graphIdentitySha256}`);
  assert.equal(installed.displayName, "Verified cached model");
  assert.equal(installed.source, null);
  assert.deepEqual(installed.peers, []);
  assert.equal(projection.simpleModelRouteViews()[0].kind, "installed");

  state.modelCatalogV1Entries = [{
    entryId: "different-current-model",
    displayName: "Different current model",
    source: null,
    composition: { compositionId: `sha256:${"d".repeat(64)}` },
    browserAdmission: null,
    availability: "unavailable",
    peers: []
  }];
  const routesAfterCatalogRemoval = projection.simpleModelRouteViews();
  assert.equal(routesAfterCatalogRemoval.length, 2);
  assert.equal(routesAfterCatalogRemoval[0].entry.composition.compositionId,
    `sha256:${graphIdentitySha256}`);
  assert.equal(routesAfterCatalogRemoval[0].kind, "installed");

  state.localModel.browserComposition.storedComposition.admissionAuthority.admissionSha256 =
    "d".repeat(64);
  assert.equal(projection.verifiedInstalledSimpleModelEntry(), null);
  assert.equal(projection.simpleModelEntries().length, 1);
});

test("typed P2P failure exposes only an exact explicit supported conversion recovery", () => {
  const source = {
    repository: companionCapabilityApi.SOURCE_DESCRIPTOR.sourceRepository,
    revision: companionCapabilityApi.SOURCE_DESCRIPTOR.sourceRevision
  };
  const entry = {
    entryId: "exact-peer-entry",
    displayName: "Exact peer model",
    source,
    composition: { compositionId: `sha256:${"a".repeat(64)}` },
    browserAdmission: {},
    availability: "peer",
    peers: [{ peerBaseUrl: "https://peer.example/" }]
  };
  const state = {
    modelLoaded: false,
    activeComposition: null,
    localModel: null,
    modelCatalogV1Entries: [entry],
    simpleModelConversionRecovery: null,
    companion: { client: {} }
  };
  const projection = compactChooserRouteFunctions(state);
  assert.equal(projection.simpleModelRouteProjection(entry).kind, "qualified-p2p");
  assert.equal(projection.rememberSimpleModelConversionRecovery(
    entry,
    { code: "p2p-composition-install-fetch" }
  ), true);
  const recovery = projection.simpleModelRouteProjection(entry);
  assert.equal(recovery.kind, "supported-local-conversion");
  assert.equal(recovery.conversionRecovery, true);

  const alias = { ...entry };
  assert.equal(projection.simpleModelRouteProjection(alias).conversionRecovery, false);
  projection.clearSimpleModelConversionRecovery();
  assert.equal(projection.rememberSimpleModelConversionRecovery(entry, new Error("untyped")), false);
  assert.equal(projection.simpleModelRouteProjection(entry).kind, "qualified-p2p");
  assert.equal(projection.rememberSimpleModelConversionRecovery(
    entry,
    { code: "p2p-composition-install-aborted" }
  ), false);
});

test("basic model cards are one-click commands without toggle or duplicate action semantics", () => {
  const render = sourceSection(
    app,
    "  function renderSimpleModelPicker",
    "  async function loadSimpleModelCatalog"
  );
  const request = sourceSection(
    app,
    "  async function requestSimpleModelAcquisition",
    "  // Begins cancellation only from an explicit visible Cancel command."
  );
  const cancelRequest = sourceSection(
    app,
    "  async function requestSimpleModelAcquisitionCancellation",
    "  // Resumes the sole pending acquisition"
  );
  const clickHandler = sourceSection(
    app,
    "    if (el.simpleModelList) {",
    "    if (el.simpleModelRefreshButton) {"
  );
  const cancelClickHandler = sourceSection(
    app,
    "    if (el.simpleModelActionButton) {",
    "    if (el.simpleCompanionPairButton) {"
  );
  const uiEventHandlers = sourceSection(
    app,
    "  function installUiEventHandlers()",
    "  function observeCopyableFields()"
  );
  const advancedCancelClickHandler = sourceSection(
    uiEventHandlers,
    "    if (el.companionCancelImportButton) {",
    "    if (el.simpleSavePeerUrlButton) {"
  );

  assert.match(
    html,
    /id="simpleModelList"[^>]*role="group"[^>]*aria-label="Qualified catalog models and models open in this browser"/
  );
  assert.match(
    render,
    /const option = document\.createElement\("button"\);\s*option\.type = "button";[\s\S]*?commandDescription\.textContent = defaultDescription \+ \(isActive/
  );
  assert.doesNotMatch(render, /option\.setAttribute\("aria-pressed"/);
  assert.match(
    clickHandler,
    /const option = event\.target\.closest\("\[data-composition-id\]"\);[\s\S]*?const entry = simpleModelEntries\(\)\.find\([\s\S]*?resolveCurrentSimpleModelRoute\(entry\)[\s\S]*?requestSimpleModelAcquisition\(entry\)\.catch\(/
  );
  assert.match(
    render,
    /el\.simpleModelActionButton\.hidden = !acquisitionActive;\s*el\.simpleModelActionButton\.disabled = !acquisitionActive;\s*el\.simpleModelActionButton\.textContent = cancellationView\.text;\s*el\.simpleModelActionButton\.setAttribute\("aria-label", cancellationView\.ariaLabel\);/
  );
  assert.match(
    html,
    /id="simpleModelActionButton"[^>]*aria-describedby="simpleModelPickerStatus"/
  );
  assert.match(render, /el\.simpleModelList\.setAttribute\(\s*"aria-busy"/);
  assert.doesNotMatch(
    render,
    /el\.simpleDiscoveryPanel\.setAttribute\(\s*"aria-busy"/
  );
  assert.doesNotMatch(render, /Get from P2P|Convert locally|Open model/);
  assert.match(
    render,
    /option\.disabled = state\.modelCatalogV1Loading \|\| acquisitionActive \|\| !route\.actionable;/
  );
  assert.doesNotMatch(request, /cancelCompanionImport\(/);
  assert.match(cancelRequest, /const cancelled = await cancelCompanionImport\(\);/);
  assert.match(cancelRequest, /browserInstallState[\s\S]*?=== "installed"/);
  assert.match(
    cancelRequest,
    /if \(committed \|\| browserActivationCommitted\) \{[\s\S]*?return true;/
  );
  assert.match(
    cancelClickHandler,
    /requestSimpleModelAcquisitionCancellation\(\)\.catch\(/
  );
  assert.doesNotMatch(cancelClickHandler, /requestSimpleModelAcquisition\(\)/);
  assert.match(
    advancedCancelClickHandler,
    /requestSimpleModelAcquisitionCancellation\(\)\.catch\(/
  );
  assert.doesNotMatch(advancedCancelClickHandler, /cancelCompanionImport\(/);
  assert.match(
    request,
    /resolveCurrentSimpleModelRoute\(requested\)[\s\S]*?route\.kind === simpleModelRouteKinds\.QUALIFIED_P2P[\s\S]*?beginModelAcquisition\(entry, route\.kind\)/
  );
  assert.match(
    request,
    /if \(!companionIsPaired\(\)\) \{\s*rememberPendingCompanionAcquisition\(entry, "simple"\);[\s\S]*?scheduleSimpleCompanionPairingFocus\(\);[\s\S]*?return false;/
  );
  assert.match(request, /return beginModelAcquisition\(entry, route\.kind\);/);
});

test("basic cancellation labels distinguish acquisition from post-install sharing", () => {
  const source = sourceSection(
    app,
    "  function simpleModelCancellationView",
    "  // Rebuilds one-click commands"
  );
  const state = {
    modelAcquisitionRoute: "p2p",
    companion: { browserInstallState: "installed" }
  };
  const cancellationView = Function(
    "state",
    `"use strict";\n${source}\nreturn simpleModelCancellationView;`
  )(state);

  assert.deepEqual(cancellationView(), {
    text: "Cancel",
    ariaLabel: "Cancel model acquisition"
  });
  state.modelAcquisitionRoute = "companion";
  state.companion.browserInstallState = "installing";
  assert.deepEqual(cancellationView(), {
    text: "Cancel",
    ariaLabel: "Cancel model acquisition"
  });
  state.companion.browserInstallState = "installed";
  assert.deepEqual(cancellationView(), {
    text: "Stop sharing",
    ariaLabel: "Stop optional local model sharing"
  });
});

test("compact dispatch revalidates routes and preserves route-owned terminal errors", () => {
  const request = sourceSection(
    app,
    "  async function requestSimpleModelAcquisition",
    "  async function pairSimpleCompanionAndContinue"
  );
  const sourceRequest = sourceSection(
    app,
    "  function sourceAcquireRequest",
    "  async function startCompanionConversion"
  );
  const p2p = sourceSection(
    app,
    "  async function startCompanionImport",
    "  function companionSha256"
  );
  const conversion = sourceSection(
    app,
    "  async function startCompanionConversion",
    "  // Verifies and installs one completed conversion"
  );
  const boundary = sourceSection(
    app,
    "  function reportSimpleModelPickerCommandError",
    "  function simpleModelCompositionBytes"
  );
  const clickHandler = sourceSection(
    app,
    "    if (el.simpleModelList) {",
    "    if (el.simpleModelRefreshButton) {"
  );

  assert.match(request, /const route = resolveCurrentSimpleModelRoute\(requested\);/);
  assert.match(request, /state\.modelCatalogV1Loading/);
  assert.match(sourceRequest, /repository !== source\.sourceRepository/);
  assert.match(sourceRequest, /revision !== source\.sourceRevision/);
  assert.doesNotMatch(sourceRequest, /repository && repository !==/);
  assert.doesNotMatch(sourceRequest, /revision && revision !==/);
  assert.match(p2p, /rememberSimpleModelConversionRecovery\(entry, error\)/);
  assert.match(p2p, /P2P download stopped\. Select \$\{displayName\} again to prepare it on this device\./);
  assert.match(p2p, /setText\(el\.modelState, "P2P install stopped", true\);[\s\S]*?return false;/);
  assert.doesNotMatch(p2p, /throw error;/);
  assert.match(
    conversion,
    /setSimpleModelPickerStatus\(\s*basicModelAcquisitionFailureMessage\(conversionState, code\),\s*true\s*\);/
  );
  assert.match(app, /function basicModelAcquisitionFailureMessage\(terminalState, errorCode\)/);
  assert.match(conversion, /setHfStatus\(`Local acquisition \$\{conversionState\} \(\$\{code\}\)`/);
  assert.match(conversion, /setCompanionStatus\("paired", `Model acquisition \$\{conversionState\}: \$\{code\}`/);
  assert.doesNotMatch(
    conversion,
    /setSimpleModelPickerStatus\([^\n]*\$\{code\}/
  );
  assert.match(
    conversion,
    /setSimpleModelPickerStatus\(basicModelAcquisitionFailureMessage\("rejected", code\), true\);/
  );
  assert.match(boundary, /classList\.contains\("error"\)[\s\S]*?return;/);
  assert.match(clickHandler, /reportSimpleModelPickerCommandError\(error\);/);
  assert.doesNotMatch(
    clickHandler,
    /setSimpleModelPickerStatus\(friendlyError\(errorMessage\(error\)\), true\)/
  );
});

test("Basic maps typed companion failures while Advanced retains exact codes", () => {
  const source = sourceSection(
    app,
    "  function basicModelAcquisitionFailureMessage",
    "  function simpleModelCompositionBytes"
  );
  const message = Function(
    "catalogText",
    `"use strict";\n${source}\nreturn basicModelAcquisitionFailureMessage;`
  )((value) => typeof value === "string" ? value.trim() : "");
  const cases = [
    ["cancelled", "cancelled", "Model preparation was cancelled"],
    ["rejected", "license-review-required", "needs a license review"],
    ["rejected", "insufficient-storage", "not enough available storage"],
    ["rejected", "unsupported-source", "cannot be prepared"],
    ["rejected", "member-digest-mismatch", "could not be verified"],
    ["reconcile-required", "create-response-lost", "reply was interrupted"],
    ["rejected", "opaque-private-code", "Open Advanced for technical details"]
  ];

  for (const [terminalState, code, expectedText] of cases) {
    const basicText = message(terminalState, code);
    assert.match(basicText, new RegExp(expectedText, "iu"));
    if (code.includes("-")) {
      assert.equal(basicText.includes(code), false);
    }
  }
});

test("Hugging Face dispatch requires a current qualified catalog entry", () => {
  const catalogLoad = sourceSection(
    app,
    "  async function loadSimpleModelCatalog",
    "  async function requestSimpleModelAcquisition"
  );
  const qualificationMatch = sourceSection(
    app,
    "  function catalogV1EntryMatchesHfModel",
    "  function hfCountText"
  );
  const resultView = sourceSection(
    app,
    "  function hfResultView",
    "  function hfPreferredSourceFormat"
  );
  const getModel = sourceSection(
    app,
    "  async function getHfModel",
    "  async function startCompanionAcquisition"
  );

  assert.match(
    catalogLoad,
    /const result = await miniModelCatalogV1Api\.loadCurrentCatalog\(\{[\s\S]*?state\.modelCatalogV1Entries = \[\.\.\.result\.views\];/
  );
  assert.match(catalogLoad, /clearExpiredCatalogAuthority\(\);/);
  assert.match(app, /function clearExpiredCatalogAuthority\(\) \{[\s\S]*?state\.modelCatalogV1Entries = \[\];/);
  assert.match(
    qualificationMatch,
    /function hfQualifiedCatalogMatch\(modelId\) \{\s*const matches = hfP2pMatches\(modelId\);\s*return matches\.length === 1 \? matches\[0\] : null;/
  );
  assert.match(
    qualificationMatch,
    /const match = hfQualifiedCatalogMatch\(modelId\);\s*return match &&\s*simpleModelRouteProjection\(match\)\.kind === simpleModelRouteKinds\.QUALIFIED_P2P/
  );
  assert.match(resultView, /const qualifiedCatalogMatch = hfQualifiedCatalogMatch\(entry\.modelId\);/);
  assert.match(
    resultView,
    /localConversionMatch: qualifiedCatalogMatch &&\s*simpleModelRouteProjection\(qualifiedCatalogMatch\)\.kind ===\s*simpleModelRouteKinds\.SUPPORTED_LOCAL_CONVERSION\s*\? qualifiedCatalogMatch\s*: null/
  );
  assert.match(
    resultView,
    /view &&\s*view\.localConversionMatch &&\s*hfSourceContract\(view\.entry && view\.entry\.modelId\)/
  );
  assert.match(
    getModel,
    /if \(view\.p2pMatch && canStartP2pImport\(view\.p2pMatch\)\) \{\s*return requestSimpleModelAcquisition\(view\.p2pMatch\);[\s\S]*?if \(!hfCanStartConversion\(view\)\)[\s\S]*?return requestSimpleModelAcquisition\(view\.localConversionMatch\);/
  );
  assert.doesNotMatch(getModel, /advancedPeerMatches|startP2pImportOrRequestPeer/);
  assert.doesNotMatch(getModel, /startCompanion(?:Import|Conversion)\(entry\)/);
});

test("cancellation racing createOperation waits for and cancels the created operation once", async () => {
  const { runCompanionOperationRequest, settleCompanionCancellation } =
    companionCancellationFunctions();
  const operationId = "a".repeat(64);
  const created = deferred();
  const cancelledIds = [];
  let createCalls = 0;
  const companion = {
    operationRequest: null,
    activeOperationId: "",
    activeStatus: { state: "queued" },
    client: {
      cancelOperation(id) {
        cancelledIds.push(id);
        return Promise.resolve({ operationId: id, state: "cancelled" });
      }
    }
  };

  const createRequest = runCompanionOperationRequest(companion, () => {
    createCalls += 1;
    return created.promise;
  });
  const pendingCreate = companion.operationRequest;
  const cancellation = settleCompanionCancellation(companion, pendingCreate, true);
  created.resolve({ operationId, state: "queued" });

  assert.equal((await createRequest).operationId, operationId);
  const outcome = await cancellation;
  assert.equal(outcome.confirmed, true);
  assert.equal(outcome.operationId, operationId);
  assert.equal(createCalls, 1);
  assert.deepEqual(cancelledIds, [operationId]);

  const conversion = sourceSection(
    app,
    "  async function startCompanionConversion",
    "  async function prepareCompanionConvertedModel"
  );
  const cancel = sourceSection(
    app,
    "  async function cancelCompanionImportInternal",
    "  async function cancelCompanionImport()"
  );
  assert.equal((conversion.match(/client\.createOperation\(/g) || []).length, 1);
  assert.match(
    conversion,
    /const expectedOperationId = await companionCapabilityApi\.computeOperationId\(request\);[\s\S]*?companion\.activeOperationId = companionSha256\([\s\S]*?createSubmitted = true;[\s\S]*?client\.createOperation\(request\)/
  );
  assert.ok(
    conversion.indexOf("companion.activeOperationId = companionSha256") <
      conversion.indexOf("client.createOperation(request)"),
    "the deterministic operation identity must be retained before POST"
  );
  assert.match(
    cancel,
    /const pendingRequest = companion\.operationRequest;[\s\S]*?companion\.pollSequence \+= 1;[\s\S]*?await settleCompanionCancellation\(\s*companion,\s*pendingRequest,/
  );
});

test("cancellation racing a poll contacts the same operation and fails closed on drift", async () => {
  const { runCompanionOperationRequest, settleCompanionCancellation } =
    companionCancellationFunctions();
  const operationId = "b".repeat(64);
  const polled = deferred();
  const cancelledIds = [];
  const companion = {
    operationRequest: null,
    activeOperationId: operationId,
    activeStatus: { operationId, state: "converting" },
    client: {
      cancelOperation(id) {
        cancelledIds.push(id);
        return Promise.resolve({ operationId: id, state: "cancelled" });
      }
    }
  };

  const pollRequest = runCompanionOperationRequest(companion, () => polled.promise);
  const cancellation = settleCompanionCancellation(
    companion,
    companion.operationRequest,
    true
  );
  polled.resolve({ operationId, state: "verifying-composition" });
  await pollRequest;
  assert.equal((await cancellation).confirmed, true);
  assert.deepEqual(cancelledIds, [operationId]);

  const conversion = sourceSection(
    app,
    "  async function startCompanionConversion",
    "  async function prepareCompanionConvertedModel"
  );
  assert.match(
    conversion,
    /const polled = await runCompanionOperationRequest\([\s\S]*?client\.getOperation\(companion\.activeOperationId\)[\s\S]*?if \(sequence !== companion\.pollSequence\) \{\s*return false;\s*\}[\s\S]*?status = polled;\s*companion\.activeStatus = status;/
  );

  const drifted = deferred();
  const driftCompanion = {
    ...companion,
    operationRequest: null,
    activeOperationId: operationId,
    activeStatus: { operationId, state: "converting" }
  };
  const driftPoll = runCompanionOperationRequest(driftCompanion, () => drifted.promise);
  const driftCancellation = settleCompanionCancellation(
    driftCompanion,
    driftCompanion.operationRequest,
    true
  );
  drifted.resolve({ operationId: "c".repeat(64), state: "converting" });
  await driftPoll;
  const driftOutcome = await driftCancellation;
  assert.equal(driftOutcome.confirmed, false);
  assert.match(driftOutcome.error.message, /identity changed/);
  assert.deepEqual(cancelledIds, [operationId]);
});

test("a failed in-flight operation request cannot falsely confirm cancellation", async () => {
  const { runCompanionOperationRequest, settleCompanionCancellation } =
    companionCancellationFunctions();
  const created = deferred();
  let cancelCalls = 0;
  const companion = {
    operationRequest: null,
    activeOperationId: "",
    activeStatus: { state: "queued" },
    client: {
      cancelOperation() {
        cancelCalls += 1;
        return Promise.resolve({ state: "cancelled" });
      }
    }
  };
  const createRequest = runCompanionOperationRequest(companion, () => created.promise);
  const requestFailure = assert.rejects(createRequest, /create response lost/);
  const cancellation = settleCompanionCancellation(
    companion,
    companion.operationRequest,
    true
  );
  created.reject(new Error("create response lost"));
  await requestFailure;
  const outcome = await cancellation;
  assert.equal(outcome.confirmed, false);
  assert.equal(cancelCalls, 0);

  const rejected = await settleCompanionCancellation({
    operationRequest: null,
    activeOperationId: "d".repeat(64),
    activeStatus: { operationId: "d".repeat(64), state: "rejected" },
    client: companion.client
  }, null, true);
  assert.equal(rejected.confirmed, false);
  assert.match(rejected.error.message, /rejected.*before cancellation/i);
  assert.equal(cancelCalls, 0);
});

test("a lost create response reconciles and cancels the deterministic operation without retry", async () => {
  const { runCompanionOperationRequest, settleCompanionCancellation } =
    companionCancellationFunctions();
  const operationId = "e".repeat(64);
  const created = deferred();
  const reconciledIds = [];
  const cancelledIds = [];
  let createCalls = 0;
  const companion = {
    operationRequest: null,
    activeOperationId: operationId,
    activeStatus: {
      operationId,
      state: "reconcile-required",
      errorCode: "create-response-lost"
    },
    client: {
      getOperation(id) {
        reconciledIds.push(id);
        return Promise.resolve({ operationId: id, state: "converting" });
      },
      cancelOperation(id) {
        cancelledIds.push(id);
        return Promise.resolve({ operationId: id, state: "cancelled" });
      }
    }
  };
  const createRequest = runCompanionOperationRequest(companion, () => {
    createCalls += 1;
    return created.promise;
  });
  const requestFailure = assert.rejects(createRequest, /create response lost/);
  const cancellation = settleCompanionCancellation(
    companion,
    companion.operationRequest,
    true
  );
  created.reject(new Error("create response lost"));

  await requestFailure;
  const outcome = await cancellation;
  assert.equal(outcome.confirmed, true);
  assert.equal(outcome.operationId, operationId);
  assert.equal(createCalls, 1);
  assert.deepEqual(reconciledIds, [operationId]);
  assert.deepEqual(cancelledIds, [operationId]);
  assert.equal(companion.activeOperationId, operationId);

  const conversion = sourceSection(
    app,
    "  async function startCompanionConversion",
    "  async function prepareCompanionConvertedModel"
  );
  assert.match(conversion, /state: "reconcile-required"/);
  assert.match(conversion, /without retrying/);
  assert.equal((conversion.match(/client\.createOperation\(request\)/g) || []).length, 1);
});



test("peer URL admission requires a canonical public HTTPS or exact loopback IP", () => {
  const {
    normalizedPeerBaseUrl
  } = urlAdmissionFunctions();
  assert.equal(
    normalizedPeerBaseUrl("https://8.8.8.8:8123/"),
    "https://8.8.8.8:8123/"
  );
  assert.equal(
    normalizedPeerBaseUrl("http://127.0.0.1:8123/"),
    "http://127.0.0.1:8123/"
  );
  assert.equal(
    normalizedPeerBaseUrl("http://[::1]:8123/"),
    "http://[::1]:8123/"
  );
  assert.throws(
    () => normalizedPeerBaseUrl("http://localhost:8123/"),
    /exact loopback IP literal/
  );
  assert.throws(
    () => normalizedPeerBaseUrl("https://peer.direct-model.net:8123/"),
    /require a public or loopback IP literal/
  );
  assert.throws(
    () => normalizedPeerBaseUrl("http://peer.direct-model.net:8123/"),
    /exact loopback IP literal/
  );
  assert.throws(
    () => normalizedPeerBaseUrl("https://user:secret@peer.direct-model.net:8123/"),
    /encoded or unsafe alias/
  );
  assert.throws(
    () => normalizedPeerBaseUrl("https://peer.direct-model.net/?token=secret"),
    /root HTTP\(S\) origin/
  );
  assert.throws(
    () => normalizedPeerBaseUrl("https://peer.direct-model.net/models/../other"),
    /root HTTP\(S\) origin/
  );
  assert.throws(
    () => normalizedPeerBaseUrl("https://tinyrustlm.com/"),
    /project and service hosts/
  );
  assert.throws(
    () => normalizedPeerBaseUrl("ws://peer.direct-model.net/"),
    /root HTTP\(S\) origin/
  );

  assert.equal(normalizedPeerBaseUrl("https://minimodel.org/"), "https://minimodel.org/");
});



test("basic catalog status distinguishes valid empty from invalid or unavailable", () => {
  const picker = sourceSection(
    app,
    "  function renderSimpleModelPicker",
    "  async function loadSimpleModelCatalog"
  );
  const loader = sourceSection(
    app,
    "  async function loadSimpleModelCatalog",
    "  async function beginModelAcquisition"
  );
  assert.match(picker, /modelCatalogV1LoadState === "unavailable"/);
  assert.match(picker, /The model list is unavailable right now/);
  assert.match(picker, /modelCatalogV1LoadState === "invalid"/);
  assert.match(picker, /model list could not be verified/);
  assert.match(picker, /modelCatalogV1LoadState === "empty"/);
  assert.match(picker, /No models are listed yet/);
  assert.match(loader, /result\.catalog\.status === validStatus/);
  assert.match(loader, /result\.catalog\.error/);
  assert.match(loader, /failureType === "fetch"/);
  assert.match(loader, /result\.views\.length \? "available" : "empty"/);
  assert.match(loader, /No models are listed yet/);
  assert.match(loader, /result\.peerFeed\.status === validStatus/);
  assert.match(loader, /modelCatalogV1PeerLoadState/);
});

test("all acquisition commands share one authoritative command gate", () => {
  const gate = sourceSection(
    app,
    "  async function beginModelAcquisition",
    "  async function pairSimpleCompanionAndContinue"
  );
  const getModel = sourceSection(
    app,
    "  async function getHfModel",
    "  async function startCompanionAcquisition"
  );

  const dispatch = sourceSection(
    app,
    "  async function startCompanionAcquisition",
    "  async function cancelCompanionImportInternal"
  );

  assert.match(
    gate,
    /if \(state\.modelAcquisitionCommand\)[\s\S]*?compositionId === state\.modelAcquisitionCompositionId[\s\S]*?state\.modelAcquisitionCompositionId = compositionId;[\s\S]*?state\.modelAcquisitionCommand = command;[\s\S]*?return await command;[\s\S]*?state\.modelAcquisitionCommand = null;[\s\S]*?state\.modelAcquisitionCompositionId = "";/
  );
  assert.match(
    gate,
    /requestedCompositionId === state\.modelAcquisitionCompositionId[\s\S]*?return state\.modelAcquisitionCommand;/
  );
  assert.match(gate, /return beginModelAcquisition\(entry, route\.kind\);/);
  assert.equal((getModel.match(/requestSimpleModelAcquisition\(/g) || []).length, 2);
  assert.doesNotMatch(getModel, /startCompanion(?:Import|Conversion)\(/);
  assert.equal((dispatch.match(/startCompanionImport\(/g) || []).length, 1);
  assert.equal((dispatch.match(/startCompanionConversion\(/g) || []).length, 1);
});

test("worker activation cancellation invalidates transfer and blocks late ready state", async () => {
  const guardSource = sourceSection(
    app,
    "  function throwIfModelActivationCancelled",
    "  function cancelActiveModelActivation"
  );
  const stateForGuard = { modelLoadSequence: 9 };
  const { throwIfModelActivationCancelled } = Function(
    "state",
    "acquisitionAbortError",
    `"use strict";\n${guardSource}\nreturn { throwIfModelActivationCancelled };`
  )(
    stateForGuard,
    (message) => Object.assign(new Error(message), { name: "AbortError" })
  );
  const aborted = new AbortController();
  aborted.abort();
  assert.throws(
    () => throwIfModelActivationCancelled(9, aborted.signal),
    (error) => error.name === "AbortError"
  );
  assert.throws(
    () => throwIfModelActivationCancelled(8, new AbortController().signal),
    (error) => error.name === "AbortError"
  );

  const cancellation = sourceSection(
    app,
    "  function cancelActiveModelActivation",
    "  async function activateBrowserComposition"
  );
  const activation = sourceSection(
    app,
    "  async function activateBrowserComposition",
    "  function browserCompositionProvenance"
  );
  const load = sourceSection(
    app,
    "  async function loadSelectedBrowserComposition",
    "  function prompt2ConversationMessages"
  );
  assert.match(
    cancellation,
    /state\.modelLoadSequence \+= 1;\s*controller\.abort\(\);[\s\S]*?client\.terminate\("model-runtime-client-activation-cancelled"\)/
  );
  assert.match(activation, /signal\.addEventListener\("abort", abortTransfer, \{ once: true \}\);/);
  assert.match(
    activation,
    /stateReport = stored\s*\? await stored\.withRead\(transfer, \{ signal: transferController\.signal \}\)\s*: await transfer\(null\);[\s\S]*?throwIfModelActivationCancelled\(loadId, signal\);\s*const verifiedState = requireActivatedComposition[\s\S]*?requireCurrentBrowserComposition\(model\);\s*return verifiedState;/
  );
  assert.match(load, /parentSignal\.addEventListener\("abort", abortActivation, \{ once: true \}\);/);
  const activationAwait = load.indexOf("state.runtimeState = await activateBrowserComposition(");
  const finalGuard = load.indexOf("throwIfModelActivationCancelled(", activationAwait);
  const readyPublish = load.indexOf("state.modelLoaded = true;", finalGuard);
  assert.ok(activationAwait >= 0 && finalGuard > activationAwait && readyPublish > finalGuard);

  const activationController = new AbortController();
  const activationResult = deferred();
  const activationStarted = deferred();
  let transferredSignal = null;
  let acceptedReports = 0;
  let terminateCalls = 0;
  const activationState = {
    modelLoadSequence: 1,
    modelActivationAbort: activationController,
    runtimeClient: null,
    runtimeState: null,
    transcriptRevision: 0n
  };
  const fakeClient = {
    status: "new",
    async initialize() {
      this.status = "ready";
      return { state: "empty" };
    },
    activate() {
      activationStarted.resolve();
      return activationResult.promise;
    },
    terminate() {
      terminateCalls += 1;
      this.status = "terminated";
    }
  };
  const { throwIfModelActivationCancelled: activationGuard } = Function(
    "state",
    "acquisitionAbortError",
    `"use strict";\n${guardSource}\nreturn { throwIfModelActivationCancelled };`
  )(
    activationState,
    (message) => Object.assign(new Error(message), { name: "AbortError" })
  );
  const { activateBrowserComposition } = Function(
    "state",
    "assertAdmissionRuntime",
    "throwIfModelActivationCancelled",
    "requireActivatedComposition",
    "ensureBrowserRuntimeAsset",
    "modelRuntimeClientApi",
    "paths",
    "browserCompositionArtifacts",
    "setText",
    "el",
    `"use strict";\n${activation}\nreturn { activateBrowserComposition };`
  )(
    activationState,
    () => {},
    activationGuard,
    (report) => {
      acceptedReports += 1;
      return report;
    },
    async () => ({ wasmBytes: new ArrayBuffer(1), manifest: { sha256: "e".repeat(64) } }),
    { createBrowserClient: () => fakeClient },
    { runtimeWorker: "worker.js" },
    (_model, signal) => {
      transferredSignal = signal;
      return [];
    },
    () => {},
    { modelState: {} }
  );
  const lateActivation = activateBrowserComposition({
    browserComposition: {
      admission: {
        operationId: "f".repeat(64),
        composition: { graphIdentitySha256: "1".repeat(64) },
        runtime: { policy: {} }
      }
    }
  }, 1);
  await activationStarted.promise;
  activationState.modelLoadSequence += 1;
  activationController.abort();
  activationResult.resolve({ state: "active-idle" });
  await assert.rejects(lateActivation, (error) => error.name === "AbortError");
  assert.equal(transferredSignal.aborted, true);
  assert.equal(acceptedReports, 0);
  assert.equal(terminateCalls, 1);
  assert.equal(activationState.runtimeClient, null);
});

test("companion install and cancellation publish bounded terminal progress", () => {
  const terminalSource = sourceSection(
    app,
    "  function setCompanionAcquisitionTerminal",
    "  async function refreshCompanionActiveAcquisition"
  );
  const stateForTerminal = {
    companion: { activeStatus: { state: "available" }, browserLoadBytes: 1234 }
  };
  let renders = 0;
  const { setCompanionAcquisitionTerminal } = Function(
    "state",
    "renderCompanionState",
    `"use strict";\n${terminalSource}\nreturn { setCompanionAcquisitionTerminal };`
  )(stateForTerminal, () => { renders += 1; });

  setCompanionAcquisitionTerminal("installed");
  assert.equal(stateForTerminal.companion.activeStatus.state, "installed");
  assert.equal(stateForTerminal.companion.browserLoadBytes, 0);
  setCompanionAcquisitionTerminal("cancelled");
  assert.equal(stateForTerminal.companion.activeStatus.state, "cancelled");
  assert.equal(stateForTerminal.companion.browserLoadBytes, 0);
  assert.equal(renders, 2);

  const stage = sourceSection(
    app,
    "  function companionAcquisitionStageText",
    "  function renderCompanionState"
  );
  const render = sourceSection(
    app,
    "  function renderCompanionState",
    "  function setCompanionStatus"
  );
  const install = sourceSection(
    app,
    "  async function prepareCompanionConvertedModel",
    "  async function getHfModel"
  );
  const cancel = sourceSection(
    app,
    "  async function cancelCompanionImportInternal",
    "  async function cancelCompanionImport()"
  );
  assert.match(stage, /installed: "Installed in this browser"/);
  assert.match(
    render,
    /catalogText\(activeStatus && activeStatus\.state\) === "available" &&\s*companion\.browserLoadBytes > 0/
  );
  assert.match(install, /setCompanionAcquisitionTerminal\("installed"\);/);
  assert.match(cancel, /setCompanionAcquisitionTerminal\("cancelled"\);/);
  assert.match(cancel, /setCompanionStatus\("paired", "Model acquisition cancelled", false\);/);
});

test("recoverable cached-store failures latch for the next explicit acquisition only", async () => {
  class StoreError extends Error {
    constructor(code) {
      super(code);
      this.name = "ModelCompositionStoreError";
      this.code = code;
    }
  }
  const latchSource = sourceSection(
    app,
    "  function latchRecoverableCompositionStoreError",
    "  function ensureModelCompositionStore"
  );
  const stateForLatch = { compositionStoreError: null };
  const { latchRecoverableCompositionStoreError } = Function(
    "modelCompositionStoreApi",
    "recoverableCompositionStoreCodes",
    "state",
    `"use strict";\n${latchSource}\nreturn { latchRecoverableCompositionStoreError };`
  )(
    { ModelCompositionStoreError: StoreError },
    new Set(["model-composition-store-stored-sha256"]),
    stateForLatch
  );
  const recoverable = new StoreError("model-composition-store-stored-sha256");
  assert.equal(
    latchRecoverableCompositionStoreError({ cause: { cause: recoverable } }),
    true
  );
  assert.equal(stateForLatch.compositionStoreError, recoverable);
  assert.equal(
    latchRecoverableCompositionStoreError(new StoreError("model-composition-store-lock")),
    false
  );
  assert.equal(stateForLatch.compositionStoreError, recoverable);

  const recoverySource = sourceSection(
    app,
    "  async function compositionStoreForInstall",
    "  async function loadCatalogAdmission"
  );
  let discardCalls = 0;
  const recoverySignal = new AbortController().signal;
  const store = {
    async discardInvalidActive(options) {
      discardCalls += 1;
      assert.equal(options.signal, recoverySignal);
      return true;
    }
  };
  const recoveryState = { compositionStoreError: recoverable };
  const { compositionStoreForInstall } = Function(
    "state",
    "ensureModelCompositionStore",
    "setSimpleModelPickerStatus",
    `"use strict";\n${recoverySource}\nreturn { compositionStoreForInstall };`
  )(recoveryState, () => store, () => {});
  assert.equal(await compositionStoreForInstall(recoverySignal), store);
  assert.equal(discardCalls, 1);
  assert.equal(recoveryState.compositionStoreError, null);
  assert.equal(await compositionStoreForInstall(recoverySignal), store);
  assert.equal(discardCalls, 1);

  const storeWiring = sourceSection(
    app,
    "  function ensureModelCompositionStore",
    "  async function loadCatalogAdmission"
  );
  const directInstall = sourceSection(
    app,
    "  async function startCompanionImport",
    "  function companionSha256"
  );
  const conversion = sourceSection(
    app,
    "  async function startCompanionConversion",
    "  async function prepareCompanionConvertedModel"
  );
  const activation = sourceSection(
    app,
    "  async function loadSelectedBrowserComposition",
    "  function prompt2ConversationMessages"
  );
  const boot = sourceSection(app, "  async function boot()", "  el.form.addEventListener");
  assert.match(
    storeWiring,
    /if \(state\.compositionStoreError\) \{\s*const discarded = await store\.discardInvalidActive\(\{ signal \}\);\s*state\.compositionStoreError = null;/
  );
  assert.match(directInstall, /catch \(error\) \{\s*latchRecoverableCompositionStoreError\(error\);/);
  assert.match(conversion, /catch \(error\) \{\s*latchRecoverableCompositionStoreError\(error\);/);
  assert.match(
    activation,
    /catch \(error\) \{\s*latchRecoverableCompositionStoreError\(error\);\s*if \(loadId !== state\.modelLoadSequence\) return false;/
  );
  assert.doesNotMatch(boot, /discardInvalidActive/);
});

test("retired text and script handoffs cannot return to the chooser", () => {
  assert.doesNotMatch(app, /\.tinyrustlm-convert\.ps1/);
  assert.doesNotMatch(app, /\.tinyrustlm-conversion\.README\.txt/);
  assert.doesNotMatch(app, /Save P2P Import Kit/);
  assert.doesNotMatch(app, /Save P2P Share Kit/);
  assert.doesNotMatch(app, /minimodel-share-kit\.ps1/);
  assert.doesNotMatch(app, /minimodel-serve-peer-pieces\.ps1/);
  assert.doesNotMatch(app, /minimodel-peer-import\.ps1/);
  assert.doesNotMatch(app, /function hfConversionScript/);
  assert.doesNotMatch(app, /function saveHfConversionRequest/);
  assert.doesNotMatch(app, /minimodel\.huggingface_conversion_request\.v0/);
  assert.doesNotMatch(app, /importConversionRequestFile/);
  assert.doesNotMatch(app, /ShareMetadata|share metadata|share-metadata/);
  assert.doesNotMatch(html, /Share Metadata|share metadata|share-metadata/);
});

test("the compact model toolbar and sidebar open one basic chooser", () => {
  assert.match(html, /id="modelEditButton"[^>]*>[\s\S]*?id="modelToolbarName">Choose model</);
  assert.match(html, /id="sidebarModelsButton"[^>]*data-open-model-popover/);
  assert.equal((html.match(/data-open-model-popover/g) || []).length, 1);
  assert.doesNotMatch(html, /Edit Model|edit-model-button/);
});

test("every literal DOM lookup has an HTML owner and retired source controls stay deleted", () => {
  const htmlIds = new Set(
    Array.from(html.matchAll(/\bid="([^"]+)"/gu), (match) => match[1])
  );
  const literalLookups = Array.from(
    app.matchAll(/document\.getElementById\("([^"]+)"\)/gu),
    (match) => match[1]
  );
  const missingOwners = Array.from(new Set(
    literalLookups.filter((id) => !htmlIds.has(id))
  )).sort();

  assert.deepEqual(missingOwners, []);
  for (const retired of [
    "simpleHfSearchInput",
    "simpleHfSearchButton",
    "simpleHfSortSelect",
    "simpleHfResults",
    "simpleCatalogResults",
    "currentModelSummary",
    "stepTokenButton"
  ]) {
    assert.equal(htmlIds.has(retired), false);
    assert.doesNotMatch(app, new RegExp(`\\b${retired}\\b`, "u"));
  }
  assert.doesNotMatch(app, /simpleSourceOption|p2pEnabled|slmcomposer\.ui\.p2pEnabled/);
  assert.doesNotMatch(html, /data-source-option|simpleHfP2pToggle/);

  const advancedHfInput = html.match(/<input\b[^>]*\bid="hfSearchInput"[^>]*>/u);
  assert.ok(advancedHfInput);
  assert.doesNotMatch(advancedHfInput[0], /\bvalue=/u);
  assert.doesNotMatch(advancedHfInput[0], /\bplaceholder=/u);
  assert.match(html, /<ol id="hfResults" class="model-results"><\/ol>/u);
  assert.doesNotMatch(app, /el\.hfSearchInput\.value\s*=/u);
});

test("the basic chooser is P2P-first and contains no advanced source forms", () => {
  const simpleStart = html.indexOf('id="simpleDiscoveryPanel"');
  const simpleEnd = html.indexOf('id="simpleErrorPanel"');
  assert.ok(simpleStart >= 0 && simpleEnd > simpleStart);
  const simple = html.slice(simpleStart, simpleEnd);
  for (const required of [
    'id="simpleModelPickerStatus"',
    'id="simpleModelList"',
    'id="simpleModelActionButton"',
    'id="simpleModelRefreshButton"',
    'id="simpleModelCloseButton"',
    'id="simpleOpenAdvancedDiscoveryButton"',
    "Your starter model downloads from MiniModel.org and runs privately in this browser. You can choose another model here.",
    "Choose a model to continue."
  ]) {
    assert.match(simple, new RegExp(required.replaceAll(".", "\\.")));
  }
  for (const hiddenFromBasic of [
    "Hugging Face",
    "models.v0",
    "Known peer URL",
    "receipt ledger",
    "Pair companion",
    "Local P2P sharing",
    "source-option-grid"
  ]) {
    assert.doesNotMatch(simple, new RegExp(hiddenFromBasic.replaceAll(".", "\\."), "i"));
  }
  assert.doesNotMatch(simple, /route is fixed|live reachability probe|hidden route retry/i);
  assert.doesNotMatch(simple, /id="simpleChooseLocalButton"|id="simpleLocalCompositionFile"/i);
  const advancedStart = html.indexOf('data-panel-key="dashboard-model-source"');
  assert.ok(advancedStart > simpleEnd);
  const advanced = html.slice(advancedStart);
  assert.match(advanced, /id="hfSearchInput"/);
  assert.match(advanced, /id="simplePeerBaseUrlInput"/);
  assert.match(advanced, /id="companionPairingControls"/);
  assert.doesNotMatch(html, /id="(?:importReceiptLedgerFile|peerContactCardFile|peerContactBookFile|peerStatusCheckFile|peerCompanionInventoryFile)"/);
});

test("fresh boot presents the nonmodal chooser only when no installed model was restored", () => {
  const presentation = sourceSection(
    app,
    "  function maybePresentInitialModelChooser",
    "  function holdModelPopoverOpen"
  );
  const boot = sourceSection(app, "  async function boot", "  el.form.addEventListener");
  const picker = sourceSection(
    app,
    "  function focusSelectedModelPickerControl",
    "  function holdModelPopoverOpen"
  );

  assert.match(
    html,
    /id="simpleDiscoveryPanel"[^>]*role="dialog"[^>]*aria-modal="false"[^>]*aria-describedby="simpleModelPickerDescription"/
  );
  assert.match(presentation, /!state\.initialModelBootComplete \|\| state\.initialModelRestored \|\| state\.modelLoaded/);
  assert.match(presentation, /!state\.modelCatalogV1Loaded \|\| state\.modelCatalogV1Loading/);
  assert.match(presentation, /toggleModelPopover\(true, opener\)/);
  assert.match(boot, /state\.initialModelRestored = true;\s*state\.initialModelBootComplete = true;\s*return;/);
  assert.match(boot, /state\.initialModelRestored = false;\s*state\.initialModelBootComplete = true;\s*maybePresentInitialModelChooser\(\);/);
  assert.match(
    picker,
    /!el\.simpleCompanionPairing\.hidden[\s\S]*?el\.simpleCompanionPairingCode\.focus\(\);\s*return;/
  );
  assert.match(picker, /const emptyStateTarget = el\.simpleModelRefreshButton \|\| el\.simpleOpenAdvancedDiscoveryButton;/);
  assert.match(picker, /selectedSimpleModelEntry\(\)/);
});

test("chooser focus, announcement, and Advanced rail semantics are explicit", () => {
  const render = sourceSection(
    app,
    "  function renderSimpleModelPicker",
    "  async function loadSimpleModelCatalog"
  );
  const rail = sourceSection(app, "  function setRailCollapsed", "  function latestDiagnosticsSnapshot");
  const p2pInstall = sourceSection(app, "  async function startCompanionImport", "  function companionSha256");
  const companionInstall = sourceSection(
    app,
    "  async function prepareCompanionConvertedModel",
    "  async function getHfModel"
  );
  const focusTrap = sourceSection(
    app,
    "  function trapSimpleModelPickerTabFocus",
    "  // User activity outside a still-hidden chooser"
  );
  const pairing = sourceSection(
    app,
    "  async function pairSimpleCompanionAndContinue",
    "  function syncSemanticControls"
  );

  assert.match(html, /id="simpleModelPickerStatus" class="model-picker-status">/);
  assert.match(html, /id="simpleModelPickerAnnouncement"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
  assert.match(html, /id="simpleModelCloseButton"[^>]*aria-label="Close model chooser"/);
  assert.match(render, /option\.dataset\.default = String\(isDefault\);/);
  assert.match(render, /scheduleSimpleModelPickerFocus/);
  assert.match(render, /moveSimpleModelActionFocusBeforeHide\(selected\)/);
  assert.doesNotMatch(focusTrap, /matchMedia|max-width/);
  assert.match(focusTrap, /controls\[controls\.length - 1\]/);
  assert.match(focusTrap, /target\.focus\(\)/);
  assert.match(pairing, /pairButtonHadFocus/);
  assert.match(pairing, /pairingFailed/);
  assert.match(pairing, /scheduleSimpleModelPickerFocus\(\{/);
  assert.match(rail, /el\.diagnosticsRail\.inert = hideOffCanvasRail/);
  assert.match(rail, /aria-hidden/);
  assert.match(p2pInstall, /\{ announce: false \}/);
  assert.match(companionInstall, /\{ announce: false \}/);
});

test("the basic chooser loads only the current strict MiniModel contract", () => {
  const picker = sourceSection(
    app,
    "  function renderSimpleModelPicker",
    "  async function loadSimpleModelCatalog"
  );
  assert.match(app, /TinyRustLMMiniModelCatalogV1/);
  assert.match(app, /loadCurrentCatalog/);
  assert.match(
    app,
    /simpleModelRouteKinds\.QUALIFIED_P2P[\s\S]*?"P2P download"[\s\S]*?"Prepare on this device"[\s\S]*?"Not available yet"/
  );
  assert.match(picker, /compositionBytes > 0 \? formatByteCount\(compositionBytes\) : ""/);
  assert.doesNotMatch(picker, /entry\.source\.repository|entry\.profiles\.quantization/);
  assert.doesNotMatch(app, /P2P ready|Local conversion fallback/);
  assert.match(app, /selectedModelCatalogV1Composition/);
  assert.match(catalogV1, /https:\/\/minimodel\.org\/catalog\/compositions\.v1\.json/);
  assert.match(catalogV1, /https:\/\/minimodel\.org\/catalog\/peer-announcements\.v1\.json/);
  assert.match(catalogV1, /exact-current-evidence-required/);
  assert.match(catalogV1, /catalog and peer feed announcement identities are not closed/);
});

test("the browser routes companion acquisition to a truthful pending release", () => {
  assert.match(html, /id="companionPackageLink"[^>]+href="\/companion\/"/);
  assert.match(html, /id="companionPackageLink"[^>]+target="_blank"[^>]+rel="noopener noreferrer"/);
  assert.match(companionPage, /sole TinyRustLM companion is being rebuilt around SLM2/);
  assert.match(companionPage, /id="companionPackageStatus"[^>]*>Public package pending/);
  assert.match(companionPage, /id="companionDeploymentStatus"[^>]*>Deployment blocked/);
  assert.doesNotMatch(companionPage, /www\.nuget\.org\/packages\//);
  assert.doesNotMatch(companionPage, /dotnet\s+(?:add\s+package|tool\s+install)/i);
  assert.match(
    companionPage,
    new RegExp(`updates\\.css\\?v=sha256-${sha256(updatesCss)}`)
  );
  assert.match(
    companionPage,
    new RegExp(`site-release\\.js\\?v=sha256-${sha256(siteReleaseScript)}`)
  );
  assert.doesNotMatch(companionPage, /\.txt|\.ps1|conversion-request|share-kit/i);
  assert.match(companionGuide, /prelaunch and unavailable for installation/);
  assert.match(companionGuide, /No package URL, archive URL, tool command, or install command/);
  assert.match(companionGuide, /old public-package lane has been deleted/);
  assert.match(companionGuide, /canonical `tinyrustlm-convert` executable/);
  assert.doesNotMatch(companionGuide, /www\.nuget\.org\/packages\//);
  assert.doesNotMatch(companionGuide, /dotnet (?:add package|tool install)/);
  assert.doesNotMatch(companionGuide, /tinyrustlm-slm-pack/);
  assert.doesNotMatch(companionGuide, /existing Qwen q4 artifact is classified/);
  assert.doesNotMatch(companionGuide, /UAIX_NUGET_FEED|reviewed folder feed/);
});
