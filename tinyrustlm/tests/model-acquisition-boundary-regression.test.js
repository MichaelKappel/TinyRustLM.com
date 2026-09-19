"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = fs.readFileSync(path.join(__dirname, "..", "app", "app.js"), "utf8");

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `missing source marker: ${startMarker}`);
  assert.ok(end > start, `missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

function evaluateProductionSection(source, exportedNames, bindings) {
  const bindingNames = Object.keys(bindings);
  const bindingValues = bindingNames.map((name) => bindings[name]);
  return Function(
    ...bindingNames,
    `"use strict";\n${source}\nreturn { ${exportedNames.join(", ")} };`
  )(...bindingValues);
}

function catalogText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return Object.freeze({ promise, resolve, reject });
}

// Supplies the app's typed failure boundary without replacing its decision logic.
function catalogQualificationError(code, message, cause) {
  return Object.assign(new Error(message), { code, ...(cause ? { cause } : {}) });
}

// Drives repeating authority checks explicitly; no test depends on elapsed wall time.
function createIntervalHarness() {
  const callbacks = new Map();
  const scheduled = [];
  const cleared = [];
  return {
    scheduled,
    cleared,
    get activeCount() { return callbacks.size; },
    setInterval(callback, milliseconds) {
      const id = scheduled.length + 1;
      scheduled.push({ id, milliseconds });
      callbacks.set(id, callback);
      return id;
    },
    clearInterval(id) {
      cleared.push(id);
      callbacks.delete(id);
    },
    tick() {
      for (const callback of [...callbacks.values()]) callback();
    }
  };
}

function createBrowserCompositionLoaderHarness({
  commitPending = false,
  qualificationError = null
} = {}) {
  const modelKey = "qualified-fixture";
  const admission = Object.freeze({
    modelId: "fixture/model",
    composition: Object.freeze({
      graphIdentitySha256: "3".repeat(64)
    }),
    qualification: Object.freeze({
      receiptId: `sha256:${"4".repeat(64)}`
    })
  });
  const model = Object.freeze({
    browserComposition: Object.freeze({
      admission,
      admissionSha256: "5".repeat(64)
    })
  });
  const state = {
    activeComposition: null,
    activeModelKey: "",
    generation: { rawOutput: Object.freeze({ stale: true }) },
    hasContext: true,
    lastMeasuredTokens: 8,
    modelActivationAbort: null,
    modelActivationCommitPending: commitPending,
    modelLoadMs: 0,
    modelLoadSequence: 0,
    modelLoaded: false,
    modelManifest: null,
    runtimeState: null
  };
  const paths = { models: { [modelKey]: model } };
  const el = {
    errorState: "error",
    modelSelect: { value: modelKey },
    modelState: "model",
    runtimeStatus: "runtime"
  };
  const document = { documentElement: { dataset: {} } };
  const events = [];
  const statuses = [];
  const controls = [];
  const localStatuses = [];
  const latchedErrors = [];
  let clock = 100;
  const source = sourceSection(
    app,
    "  async function loadSelectedBrowserComposition",
    "  function prompt2ConversationMessages"
  );
  const { loadSelectedBrowserComposition } = evaluateProductionSection(
    source,
    ["loadSelectedBrowserComposition"],
    {
      state,
      paths,
      el,
      document,
      performance: { now: () => (clock += 4) },
      AbortController,
      catalogQualificationError,
      throwIfAcquisitionAborted: () => {},
      cancelActiveModelActivation: () => {
        throw new Error("the fixture starts without an active model load");
      },
      clearBrowserAdmissionDiagnostics: () => {},
      setInteractive: () => {},
      setText: (target, text, isError) => {
        statuses.push({ target, text, isError: Boolean(isError) });
      },
      renderProvenance: () => {},
      renderDiagnostics: () => {},
      activateBrowserComposition: async (candidate, loadId) => {
        assert.equal(candidate, model);
        assert.equal(loadId, 1);
        events.push("worker-load");
        return Object.freeze({ status: "worker-active" });
      },
      throwIfModelActivationCancelled: (loadId, signal) => {
        assert.equal(loadId, 1);
        assert.equal(signal.aborted, false);
      },
      requireCurrentBrowserComposition: (candidate) => {
        assert.equal(candidate, model);
        events.push("qualification-recheck");
        if (qualificationError) throw qualificationError;
        return admission;
      },
      browserCompositionProvenance: () => Object.freeze({ fixture: true }),
      setLocalModelStatus: (...args) => localStatuses.push(args),
      setControls: (...args) => controls.push(args),
      latchRecoverableCompositionStoreError: (error) => latchedErrors.push(error),
      errorMessage: (error) => error.message
    }
  );

  return {
    controls,
    document,
    events,
    latchedErrors,
    load: () => loadSelectedBrowserComposition(null),
    localStatuses,
    state,
    statuses
  };
}

function createTurnAdmissionHarness({ qualification, nextPaint, setTranscript, generate, onTerminate } = {}) {
  const modelKey = "qualified-turn-fixture";
  const model = Object.freeze({ fixture: "qualified-turn-model" });
  const admission = Object.freeze({
    modelId: "fixture/qualified-turn-model",
    runtime: Object.freeze({ defaultSampling: Object.freeze({}) })
  });
  const calls = {
    acceptedTurns: 0,
    beginTurn: 0,
    capture: [],
    deliveries: [],
    discard: 0,
    generate: 0,
    persistedTurns: 0,
    qualification: 0,
    setTranscript: 0,
    startGeneration: 0
  };
  const intervals = createIntervalHarness();
  const terminations = [];
  const state = {
    activeModelKey: modelKey,
    generation: {
      abortController: null,
      assistantMessageId: "",
      inFlight: false,
      sequence: 0,
      stopRequested: false
    },
    lastGenerateMs: 0,
    lastMeasuredTokens: 0,
    latestSampling: Object.freeze({ seed: 7 }),
    modelPopoverHoldUntil: 19,
    runtimeState: Object.freeze({ state: "active-idle" }),
    transcriptRevision: 0n
  };
  state.runtimeClient = {
    status: "active",
    async setTranscript(revision, conversationId) {
      calls.setTranscript += 1;
      if (setTranscript) return setTranscript(revision, conversationId);
      return Object.freeze({ state: "active-idle" });
    },
    async generate(options) {
      calls.generate += 1;
      if (generate) return generate(options);
      return Object.freeze({
        status: Object.freeze({ kind: "maximum-tokens" }),
        text: "unexpected generated output",
        tokenIds: Object.freeze([])
      });
    },
    terminate(code) {
      terminations.push(code);
      this.status = "terminated";
      if (onTerminate) onTerminate(code);
    }
  };
  const client = state.runtimeClient;
  const paths = { models: { [modelKey]: model } };
  const el = {
    appShell: null,
    errorState: "error",
    modelState: "model",
    prompt: {
      focus() {},
      value: "Explain the activation boundary"
    },
    runtimeStatus: "runtime"
  };
  const statuses = [];
  const pickerStatuses = [];
  const consoleLines = [];
  const source = sourceSection(
    app,
    "  async function submitBrowserConversation",
    "  // Verifies cached state before allowing"
  );
  const { submitBrowserConversation } = evaluateProductionSection(
    source,
    ["submitBrowserConversation"],
    {
      state,
      paths,
      el,
      setInterval: intervals.setInterval,
      clearInterval: intervals.clearInterval,
      conversationApi: { maxMessageCharacters: 4096 },
      requestGenerationStop: () => {
        throw new Error("the fixture does not begin with an in-flight generation");
      },
      activeSelectorCompositionMatchesRuntime: () => true,
      setText: (target, text, isError) => {
        statuses.push({ target, text, isError: Boolean(isError) });
      },
      setControls: () => {},
      syncSemanticControls: () => {},
      requireCurrentBrowserComposition: (candidate) => {
        assert.equal(candidate, model);
        calls.qualification += 1;
        return qualification
          ? qualification(calls.qualification, admission)
          : admission;
      },
      errorMessage: (error) => error && error.message || String(error),
      discardRejectedStoredActivation: () => {
        calls.discard += 1;
      },
      setSimpleModelPickerStatus: (...args) => pickerStatuses.push(args),
      renderSimpleModelPicker: () => {},
      toggleModelPopover: () => {},
      beginConversationTurn: () => {
        calls.beginTurn += 1;
        calls.acceptedTurns += 1;
        calls.persistedTurns += 1;
        return Object.freeze({
          id: "assistant-message-id",
          turnId: "turn-id"
        });
      },
      startGeneration: (assistantMessageId) => {
        assert.equal(assistantMessageId, "assistant-message-id");
        calls.startGeneration += 1;
        state.generation.inFlight = true;
        state.generation.sequence += 1;
        state.generation.assistantMessageId = assistantMessageId;
        state.generation.abortController = new AbortController();
        return state.generation.sequence;
      },
      nextBrowserPaint: nextPaint || (() => Promise.resolve()),
      stopBeforeInference: () => false,
      activeConversation: () => Object.freeze({ id: "conversation-id" }),
      performance: { now: () => 100 },
      modelRuntimeClientApi: {
        async identityFromText(domain) {
          const fill = domain.includes("conversation")
            ? "a"
            : (domain.includes("turn") ? "b" : "c");
          return fill.repeat(64);
        }
      },
      prompt2RequestApi: {
        encodeRequest() {
          return Object.freeze({ buffer: new ArrayBuffer(8) });
        }
      },
      prompt2ConversationMessages: () => Object.freeze([
        Object.freeze({ role: "user", content: "fixture" })
      ]),
      prompt2Sampling: () => Object.freeze({ maximumNewTokens: 1 }),
      deliverGeneratedOutput: async (messageId, output, failure, sequence) => {
        calls.deliveries.push({ messageId, output, failure, sequence });
      },
      appendConsole: (line) => consoleLines.push(line),
      captureRun: (prompt, result, failed) => {
        calls.capture.push({ prompt, result, failed });
      }
    }
  );

  return {
    admission,
    calls,
    client,
    consoleLines,
    intervals,
    pickerStatuses,
    state,
    statuses,
    terminations,
    submit: () => submitBrowserConversation({ preventDefault() {} })
  };
}

test("cancelling an in-flight P2P acquisition never stops an unrelated existing seed", async () => {
  const existingOperationId = "1".repeat(64);
  const acquisitionAbort = new AbortController();
  const seedStopCalls = [];
  const state = {
    activeAcquisitionAbort: acquisitionAbort,
    modelAcquisitionRoute: "p2p",
    companion: {
      activeOperationId: existingOperationId,
      activeOperationKind: "source",
      activeStatus: {
        operationId: existingOperationId,
        state: "installed"
      },
      browserLoadBytes: 0,
      operationRequest: null,
      pollSequence: 7,
      seedDisplayOperationId: existingOperationId,
      seedRecords: new Map([
        [existingOperationId, { operationId: existingOperationId, state: "ready" }]
      ]),
      streamAbort: null
    }
  };
  const source = sourceSection(
    app,
    "  async function cancelCompanionImportInternal()",
    "  async function cancelCompanionImport()"
  );
  const { cancelCompanionImportInternal } = evaluateProductionSection(
    source,
    ["cancelCompanionImportInternal"],
    {
      state,
      catalogText,
      companionAcquisitionIsActive: () => false,
      cancelActiveModelActivation: () => {},
      requestDirectSeedStop: async (operationId) => {
        seedStopCalls.push(operationId);
        return { confirmed: true };
      },
      setHfStatus: () => {},
      setSimpleModelPickerStatus: () => {},
      setCompanionStatus: () => {},
      companionIsPaired: () => true,
      renderSimpleModelPicker: () => {},
      settleCompanionCancellation: async () => {
        throw new Error("P2P cancellation must not enter companion-operation cancellation");
      },
      setCompanionAcquisitionTerminal: () => {},
      setText: () => {},
      el: { modelState: {} },
      friendlyError: (value) => value,
      errorMessage: (error) => error.message,
      renderCompanionState: () => {}
    }
  );

  const confirmed = await cancelCompanionImportInternal();

  assert.equal(confirmed, true);
  assert.equal(acquisitionAbort.signal.aborted, true);
  assert.deepEqual(
    seedStopCalls,
    [],
    "the P2P abort signal must not transfer ownership to an unrelated seed lifecycle"
  );
});

test("browser install failure does not relabel an Available companion conversion as rejected", async () => {
  const operationId = "2".repeat(64);
  const availableProjection = Object.freeze({
    operationId,
    state: "available"
  });
  const installError = Object.assign(
    new Error("browser activation rejected the verified composition"),
    { code: "model-composition-store-activation-rejected" }
  );
  const consoleLines = [];
  let installAttempts = 0;
  const state = {
    activeAcquisitionAbort: null,
    companion: {
      activeEntry: null,
      activeOperationId: "",
      activeOperationKind: "",
      activeStatus: null,
      browserLoadBytes: 0,
      client: {
        async createOperation() {
          return availableProjection;
        }
      },
      pollSequence: 0,
      streamAbort: null
    }
  };
  const source = sourceSection(
    app,
    "  async function startCompanionConversion(entry)",
    "  async function getHfModel(entry)"
  );
  const { startCompanionConversion } = evaluateProductionSection(
    source,
    ["startCompanionConversion"],
    {
      state,
      requireCurrentCatalogEntry: () => true,
      requireCompanionForAcquisition: () => true,
      setHfStatus: () => {},
      setSimpleModelPickerStatus: () => {},
      renderCompanionState: () => {},
      renderSimpleModelPicker: () => {},
      sourceAcquireRequest: () => Object.freeze({
        route: "source",
        sourceRevision: "3".repeat(64)
      }),
      companionCapabilityApi: {
        async computeOperationId() {
          return operationId;
        }
      },
      companionSha256: (value) => value,
      runCompanionOperationRequest: async (_companion, request) => request(),
      catalogText,
      window: {
        setTimeout() {
          throw new Error("an Available create response must not be polled");
        }
      },
      latchRecoverableCompositionStoreError: () => {},
      errorMessage: (error) => error.message,
      friendlyError: (value) => value,
      setText: () => {},
      el: { errorState: {} },
      appendConsole: (message) => consoleLines.push(message),
      setCompanionStatus: () => {},
      loadCatalogAdmission: async () => ({ admission: Object.freeze({}) }),
      ensureBrowserRuntimeAsset: async () => {},
      throwIfAcquisitionAborted: signal => {
        if (signal.aborted) throw Object.assign(new Error("cancelled"), { name: "AbortError" });
      },
      assertAdmissionRuntime: () => {},
      requireCurrentCatalogAdmission: () => true,
      modelStoreManifest: () => Object.freeze({ fixture: "manifest" }),
      modelStoreAdmissionAuthority: () => Object.freeze({ fixture: "authority" }),
      workerActivationStoreAdapter: (store) => store,
      compositionStoreForInstall: async () => Object.freeze({}),
      companionCompositionInstallApi: {
        async installCompanionComposition({ projection }) {
          installAttempts += 1;
          assert.equal(projection, availableProjection);
          throw installError;
        }
      },
      setCompanionAcquisitionTerminal: () => {
        throw new Error("a failed browser install must not become installed");
      },
      requestLocalDirectSeed: async () => {
        throw new Error("a failed browser install must not start local sharing");
      },
      toggleModelPopover: () => {}
    }
  );

  const completed = await startCompanionConversion({
    displayName: "Boundary fixture",
    modelId: "boundary-fixture"
  });

  assert.equal(completed, false);
  assert.equal(installAttempts, 1);
  assert.deepEqual(
    {
      operationId: catalogText(state.companion.activeStatus?.operationId),
      state: catalogText(state.companion.activeStatus?.state),
      loggedAsRejected: consoleLines.some((line) =>
        line.startsWith("companion conversion rejected:")
      )
    },
    {
      operationId,
      state: "available",
      loggedAsRejected: false
    },
    "browser persistence is downstream of the terminal companion conversion result"
  );
});

test("pending browser-store commit never publishes final Ready state", async () => {
  const harness = createBrowserCompositionLoaderHarness({ commitPending: true });

  const loaded = await harness.load();

  assert.equal(loaded, true);
  assert.deepEqual(harness.events, ["worker-load", "qualification-recheck"]);
  assert.equal(harness.state.modelLoaded, false);
  assert.equal(
    harness.statuses.some(({ text }) => text === "Ready"),
    false,
    "worker activation is not final readiness while store.install is pending"
  );
  assert.equal(
    harness.statuses.some(({ target, text }) =>
      target === "runtime" && text === "Finalizing browser cache"
    ),
    true
  );
  assert.deepEqual(harness.controls[harness.controls.length - 1], [false, false]);
  assert.equal(harness.controls.some(([canGenerate]) => canGenerate), false);
  assert.deepEqual(harness.localStatuses, []);
});

test("worker load is rejected when the post-load qualification recheck fails", async () => {
  const qualificationError = Object.assign(
    new Error("The selected composition is no longer qualified"),
    { code: "model-catalog-entry-expired" }
  );
  const harness = createBrowserCompositionLoaderHarness({ qualificationError });

  const loaded = await harness.load();

  assert.equal(loaded, false);
  assert.deepEqual(harness.events, ["worker-load", "qualification-recheck"]);
  assert.deepEqual(harness.latchedErrors, [qualificationError]);
  assert.equal(harness.state.modelLoaded, false);
  assert.equal(harness.state.activeComposition, null);
  assert.equal(harness.document.documentElement.dataset.activeModel, "");
  assert.equal(
    harness.statuses.some(({ target, text, isError }) =>
      target === "runtime" && text === "Composition rejected" && isError
    ),
    true
  );
  assert.equal(harness.statuses.some(({ text }) => text === "Ready"), false);
  assert.equal(harness.controls.some(([canGenerate]) => canGenerate), false);
  assert.deepEqual(harness.localStatuses, []);
});

test("failed prior-composition restoration terminates and clears candidate activation", async () => {
  const localModelKey = "local-browser-composition";
  const priorComposition = Object.freeze({ manifestSha256: "6".repeat(64) });
  const restoreError = new Error("prior composition failed worker verification");
  const failedToken = Object.freeze({ activation: "failed-candidate" });
  const restorationToken = Object.freeze({ activation: "prior-restoration" });
  const activationAbort = new AbortController();
  const terminationReasons = [];
  const candidateClient = {
    status: "active",
    terminate(reason) {
      terminationReasons.push(reason);
      this.status = "terminated";
    }
  };
  const state = {
    activeComposition: null,
    activeModelKey: "",
    hasContext: false,
    localModel: null,
    modelActivationAbort: activationAbort,
    modelActivationCommitPending: failedToken,
    modelLoadSequence: 12,
    modelLoaded: false,
    modelManifest: null,
    runtimeClient: null,
    runtimeState: null
  };
  const paths = { models: { [localModelKey]: Object.freeze({ fixture: true }) } };
  const document = {
    documentElement: { dataset: { activeModel: localModelKey } }
  };
  const activationCalls = [];
  const consoleLines = [];
  const renderedModels = [];
  const controlCalls = [];
  let diagnosticsCleared = 0;
  const source = sourceSection(
    app,
    "  function discardRejectedStoredActivation",
    "  function workerActivationStoreAdapter"
  );
  const { restoreStoredCompositionAfterFailure } = evaluateProductionSection(
    source,
    ["restoreStoredCompositionAfterFailure"],
    {
      state,
      paths,
      localModelKey,
      document,
      clearBrowserAdmissionDiagnostics: () => {
        diagnosticsCleared += 1;
      },
      renderModelOptions: (...args) => renderedModels.push(args),
      setControls: (...args) => controlCalls.push(args),
      ownsStoredCompositionActivation: (token) =>
        Boolean(token) && state.modelActivationCommitPending === token,
      clearStoredCompositionActivation: (token) => {
        if (state.modelActivationCommitPending !== token) return false;
        state.modelActivationCommitPending = false;
        return true;
      },
      createStoredCompositionActivationToken: (composition) => {
        assert.strictEqual(composition, priorComposition);
        return restorationToken;
      },
      activateStoredComposition: async (
        composition,
        readyText,
        signal,
        deferCommit,
        suppliedToken
      ) => {
        activationCalls.push([
          composition,
          readyText,
          signal,
          deferCommit,
          suppliedToken
        ]);
        assert.strictEqual(suppliedToken, restorationToken);
        state.modelActivationCommitPending = suppliedToken;
        state.runtimeClient = candidateClient;
        state.runtimeState = Object.freeze({ candidate: true });
        state.modelLoaded = true;
        state.activeComposition = Object.freeze({ candidate: true });
        state.activeModelKey = localModelKey;
        state.modelManifest = Object.freeze({ candidate: true });
        state.hasContext = true;
        state.localModel = Object.freeze({ candidate: true });
        throw restoreError;
      },
      appendConsole: (line) => consoleLines.push(line),
      errorMessage: (error) => error.message
    }
  );

  const restored = await restoreStoredCompositionAfterFailure(
    priorComposition,
    failedToken
  );

  assert.deepEqual(activationCalls, [[
    priorComposition,
    "Your saved model is verified and ready.",
    null,
    false,
    restorationToken
  ]]);
  assert.equal(restored, false);
  assert.deepEqual(consoleLines, [
    `prior composition restore failed: ${restoreError.message}`
  ]);
  assert.deepEqual(terminationReasons, [
    "model-runtime-client-uncommitted-composition"
  ]);
  assert.equal(activationAbort.signal.aborted, true);
  assert.equal(state.modelLoadSequence, 13);
  assert.equal(state.runtimeClient, null);
  assert.equal(state.runtimeState, null);
  assert.equal(state.modelLoaded, false);
  assert.equal(state.modelActivationCommitPending, false);
  assert.equal(state.activeComposition, null);
  assert.equal(state.activeModelKey, "");
  assert.equal(state.modelManifest, null);
  assert.equal(state.hasContext, false);
  assert.equal(state.localModel, null);
  assert.equal(paths.models[localModelKey], undefined);
  assert.equal(document.documentElement.dataset.activeModel, "");
  assert.equal(diagnosticsCleared, 1);
  assert.deepEqual(renderedModels, [[paths.models, false]]);
  assert.deepEqual(controlCalls, [[false, false]]);
});

test("pre-turn qualification rejection issues no turn, generation, or runtime calls", async () => {
  const qualificationError = Object.assign(
    new Error("The selected model qualification has expired"),
    { code: "model-catalog-entry-expired" }
  );
  const calls = {
    beginTurn: 0,
    discard: 0,
    generate: 0,
    preventDefault: 0,
    qualification: 0,
    renderPicker: 0,
    setTranscript: 0,
    startGeneration: 0,
    stop: 0,
    togglePopover: 0
  };
  const modelKey = "qualified-fixture";
  const model = Object.freeze({ fixture: true });
  const state = {
    activeModelKey: modelKey,
    generation: { inFlight: false },
    modelPopoverHoldUntil: 77,
    runtimeClient: {
      async setTranscript() {
        calls.setTranscript += 1;
      },
      async generate() {
        calls.generate += 1;
      }
    }
  };
  const paths = { models: { [modelKey]: model } };
  const el = {
    appShell: null,
    errorState: "error",
    modelState: "model",
    prompt: { value: "Explain the cache boundary", focus() {} },
    runtimeStatus: "runtime"
  };
  const statuses = [];
  const pickerStatuses = [];
  const source = sourceSection(
    app,
    "  async function submitBrowserConversation",
    "  // Verifies cached state before allowing"
  );
  const { submitBrowserConversation } = evaluateProductionSection(
    source,
    ["submitBrowserConversation"],
    {
      state,
      paths,
      el,
      conversationApi: { maxMessageCharacters: 4096 },
      requestGenerationStop: () => {
        calls.stop += 1;
      },
      activeSelectorCompositionMatchesRuntime: () => true,
      setText: (target, text, isError) => {
        statuses.push({ target, text, isError: Boolean(isError) });
      },
      setControls: () => {},
      syncSemanticControls: () => {},
      requireCurrentBrowserComposition: (candidate) => {
        assert.equal(candidate, model);
        calls.qualification += 1;
        throw qualificationError;
      },
      errorMessage: (error) => error.message,
      discardRejectedStoredActivation: () => {
        calls.discard += 1;
      },
      setSimpleModelPickerStatus: (...args) => pickerStatuses.push(args),
      renderSimpleModelPicker: () => {
        calls.renderPicker += 1;
      },
      toggleModelPopover: () => {
        calls.togglePopover += 1;
      },
      beginConversationTurn: () => {
        calls.beginTurn += 1;
        return { id: "unexpected-assistant" };
      },
      startGeneration: () => {
        calls.startGeneration += 1;
        return 1;
      }
    }
  );

  await submitBrowserConversation({
    preventDefault() {
      calls.preventDefault += 1;
    }
  });

  assert.equal(calls.preventDefault, 1);
  assert.equal(calls.qualification, 1);
  assert.equal(calls.discard, 1);
  assert.equal(calls.renderPicker, 1);
  assert.equal(calls.stop, 0);
  assert.equal(calls.togglePopover, 0);
  assert.equal(calls.beginTurn, 0);
  assert.equal(calls.startGeneration, 0);
  assert.equal(calls.setTranscript, 0);
  assert.equal(calls.generate, 0);
  assert.equal(state.modelPopoverHoldUntil, 77);
  assert.equal(
    statuses.some(({ target, text, isError }) =>
      target === "runtime" && text === "Model qualification expired" && isError
    ),
    true
  );
  assert.deepEqual(pickerStatuses, [[
    `${qualificationError.message} Refresh models before chatting.`,
    true
  ]]);
});

for (const boundary of ["runtime", "worker"]) {
test("stale " + boundary + " activation cannot clear or terminate its successor's pending token", async () => {
  const loadA = deferred();
  const loadB = deferred();
  const controllerA = new AbortController();
  const controllerB = new AbortController();
  const staleFailure = new Error("activation A unwound after activation B started");
  const localModelKey = "local-browser-composition";
  const storedA = Object.freeze({
    activationId: "a".repeat(64),
    admissionAuthority: Object.freeze({ admissionSha256: "1".repeat(64) }),
    admissionAuthoritySha256: "2".repeat(64),
    manifestSha256: "3".repeat(64)
  });
  const storedB = Object.freeze({
    activationId: "b".repeat(64),
    admissionAuthority: Object.freeze({ admissionSha256: "4".repeat(64) }),
    admissionAuthoritySha256: "5".repeat(64),
    manifestSha256: "6".repeat(64)
  });
  const state = {
    activeComposition: Object.freeze({ successor: true }),
    activeModelKey: localModelKey,
    hasContext: false,
    localModel: null,
    modelActivationAbort: null,
    modelActivationCommitPending: false,
    modelLoadSequence: 40,
    modelLoaded: false,
    modelManifest: Object.freeze({ successor: true }),
    runtimeClient: null,
    runtimeState: Object.freeze({ successor: true })
  };
  const paths = { models: { [localModelKey]: Object.freeze({ successor: true }) } };
  const document = {
    documentElement: { dataset: { activeModel: localModelKey } }
  };
  const terminationReasons = [];
  const successorClient = {
    status: "active",
    terminate(reason) {
      terminationReasons.push(reason);
      this.status = "terminated";
    }
  };
  const source = sourceSection(
    app,
    "  function acquisitionAbortError",
    "  async function restoreStoredCompositionAfterFailure"
  );
  const {
    activateStoredComposition,
    discardRejectedStoredActivation
  } = evaluateProductionSection(
    source,
    ["activateStoredComposition", "discardRejectedStoredActivation"],
    {
      state,
      paths,
      localModelKey,
      document,
      requireCurrentStoredComposition: (storedComposition) => Object.freeze({
        modelId: storedComposition === storedA ? "fixture/a" : "fixture/b"
      }),
      ensureBrowserRuntimeAsset: signal => boundary === "runtime" && signal === controllerA.signal
        ? loadA.promise : Promise.resolve(),
      registerStoredComposition: (storedComposition) => Object.freeze({
        browserComposition: Object.freeze({
          admission: Object.freeze({
            modelId: storedComposition === storedA ? "fixture/a" : "fixture/b"
          }),
          storedComposition
        })
      }),
      setLocalModelStatus: () => {},
      loadSelectedModelWithConsent: (signal) => {
        if (signal === controllerA.signal) {
          assert.equal(boundary, "worker", "a stale runtime completion must not reach model loading");
          return loadA.promise;
        }
        if (signal === controllerB.signal) return loadB.promise;
        throw new Error("unexpected activation signal");
      },
      catalogQualificationError: (code, message) =>
        Object.assign(new Error(message), { code }),
      activeSelectorCompositionMatchesRuntime: () => true,
      setText: () => {},
      el: { errorState: {}, modelState: {}, runtimeStatus: {} },
      renderProvenance: () => {},
      setControls: () => {},
      reconcileSimpleModelSelection: () => {},
      renderSimpleModelPicker: () => {},
      setSimpleModelPickerStatus: () => {},
      clearBrowserAdmissionDiagnostics: () => {},
      renderModelOptions: () => {}
    }
  );

  const activationA = activateStoredComposition(
    storedA,
    "activation A ready",
    controllerA.signal,
    true
  );
  await Promise.resolve();
  const tokenA = state.modelActivationCommitPending;

  const activationB = activateStoredComposition(
    storedB,
    "activation B ready",
    controllerB.signal,
    true
  );
  await Promise.resolve();
  const tokenB = state.modelActivationCommitPending;
  state.modelActivationAbort = controllerB;
  state.runtimeClient = successorClient;

  if (boundary === "worker") loadA.reject(staleFailure);
  else loadA.resolve();
  await assert.rejects(activationA, error => boundary === "worker" ? error === staleFailure :
    error.code === "model-cache-activation-owner-mismatch");
  discardRejectedStoredActivation(tokenA);

  loadB.resolve({ loaded: true });
  const successorOutcome = await activationB.then(
    (value) => ({ value }),
    (error) => ({ error })
  );

  assert.ok(tokenA && typeof tokenA === "object" && !Array.isArray(tokenA));
  assert.ok(tokenB && typeof tokenB === "object" && !Array.isArray(tokenB));
  assert.notStrictEqual(tokenA, tokenB);
  assert.strictEqual(state.modelActivationCommitPending, tokenB);
  assert.deepEqual(successorOutcome, { value: true });
  assert.equal(controllerB.signal.aborted, false);
  assert.strictEqual(state.runtimeClient, successorClient);
  assert.equal(successorClient.status, "active");
  assert.deepEqual(terminationReasons, []);
});
}

test("indeterminate store commit never restores prior worker or publishes Ready", async () => {
  const admissionAuthority = Object.freeze({ fixture: "authority" });
  const prior = Object.freeze({
    activationId: "7".repeat(64),
    manifestSha256: "8".repeat(64)
  });
  const candidate = Object.freeze({
    activationId: "9".repeat(64),
    manifestSha256: "a".repeat(64)
  });
  const activationToken = Object.freeze({
    activationId: candidate.activationId,
    manifestSha256: candidate.manifestSha256
  });
  const indeterminate = Object.assign(
    new Error("active pointer outcome could not be observed"),
    {
      code: "model-composition-store-activation-indeterminate",
      commitDisposition: "indeterminate",
      stagingId: candidate.activationId
    }
  );
  const state = { modelActivationCommitPending: false };
  const events = [];
  const source = sourceSection(
    app,
    "  function workerActivationStoreAdapter",
    "  // Marks a card active only"
  );
  const { workerActivationStoreAdapter } = evaluateProductionSection(
    source,
    ["workerActivationStoreAdapter"],
    {
      state,
      createStoredCompositionActivationToken: (received) => {
        assert.strictEqual(received, candidate);
        return activationToken;
      },
      ownsStoredCompositionActivation: (token) =>
        Boolean(token) && state.modelActivationCommitPending === token,
      activateStoredComposition: async (
        received,
        _readyText,
        _signal,
        deferCommit,
        suppliedToken
      ) => {
        assert.strictEqual(received, candidate);
        assert.equal(deferCommit, true);
        assert.strictEqual(suppliedToken, activationToken);
        state.modelActivationCommitPending = activationToken;
        events.push("candidate-worker-activated");
        return true;
      },
      authorizeStoredCompositionCommit: (received, receivedToken) => {
        assert.strictEqual(received, candidate);
        assert.strictEqual(receivedToken, activationToken);
        assert.strictEqual(state.modelActivationCommitPending, activationToken);
        events.push("candidate-commit-authorized");
        return true;
      },
      restoreStoredCompositionAfterFailure: async () => {
        events.push("prior-worker-restored");
      },
      discardRejectedStoredActivation: (receivedToken) => {
        assert.strictEqual(receivedToken, activationToken);
        state.modelActivationCommitPending = false;
        events.push("candidate-worker-discarded");
      },
      completeStoredCompositionActivation: () => {
        events.push("Ready");
      },
      catalogQualificationError: (code, message) =>
        Object.assign(new Error(message), { code })
    }
  );
  const store = {
    async install(options) {
      await options.activate(candidate, {
        previousComposition: prior,
        signal: null
      });
      await options.authorizeCommit(candidate);
      throw indeterminate;
    }
  };

  await assert.rejects(
    workerActivationStoreAdapter(
      store,
      "candidate ready",
      null,
      admissionAuthority
    ).install({ admissionAuthority }),
    (error) => error === indeterminate
  );

  assert.deepEqual(events, [
    "candidate-worker-activated",
    "candidate-commit-authorized",
    "candidate-worker-discarded"
  ]);
  assert.equal(state.modelActivationCommitPending, false);
});

test("qualification expiry during nextBrowserPaint accepts and persists no turn", async () => {
  const paintStarted = deferred();
  const paintReleased = deferred();
  const qualificationError = Object.assign(
    new Error("The selected model qualification expired during paint"),
    { code: "model-catalog-entry-expired" }
  );
  let expired = false;
  const harness = createTurnAdmissionHarness({
    qualification(_call, admission) {
      if (expired) throw qualificationError;
      return admission;
    },
    nextPaint() {
      paintStarted.resolve();
      return paintReleased.promise;
    }
  });

  const submission = harness.submit();
  await paintStarted.promise;
  expired = true;
  paintReleased.resolve();
  await submission;

  assert.equal(harness.calls.acceptedTurns, 0);
  assert.equal(harness.calls.persistedTurns, 0);
  assert.equal(harness.calls.beginTurn, 0);
  assert.equal(harness.calls.startGeneration, 0);
  assert.equal(harness.calls.setTranscript, 0);
  assert.equal(harness.calls.generate, 0);
});

test("qualification expiry during deferred setTranscript never generates and stays truthful", async () => {
  const transcriptStarted = deferred();
  const transcriptReleased = deferred();
  const qualificationError = Object.assign(
    new Error("The selected model qualification expired before generation"),
    { code: "model-catalog-entry-expired" }
  );
  let expired = false;
  const harness = createTurnAdmissionHarness({
    qualification(_call, admission) {
      if (expired) throw qualificationError;
      return admission;
    },
    async setTranscript() {
      transcriptStarted.resolve();
      await transcriptReleased.promise;
      return Object.freeze({ state: "active-idle" });
    }
  });

  const submission = harness.submit();
  await transcriptStarted.promise;
  expired = true;
  transcriptReleased.resolve();
  await submission;

  assert.equal(harness.calls.setTranscript, 1);
  assert.equal(harness.calls.generate, 0);
  assert.equal(harness.calls.discard, 1);
  assert.equal(harness.calls.deliveries.length, 1);
  assert.deepEqual(harness.calls.deliveries[0], {
    messageId: "assistant-message-id",
    output: null,
    failure: qualificationError,
    sequence: 1
  });
  assert.deepEqual(harness.calls.capture, [{
    prompt: "Explain the activation boundary",
    result: qualificationError.message,
    failed: true
  }]);
  assert.equal(
    harness.consoleLines.some((line) => line.includes("worker_generate(status=failed")),
    true
  );
});

// Models only the worker boundary; production code owns selection, reuse, and policy dispatch.
function createWorkerActivationHarness() {
  const policy = Object.freeze({
    maximumModelBytes: 1024,
    maximumSequenceTokens: 4096,
    maximumKvBytes: 64 * 1024 * 1024,
    maximumScratchBytes: 32 * 1024 * 1024,
    maximumResolvedMemberBytes: 128 * 1024 * 1024,
    maximumResidentDependencyBytes: 1024 * 1024,
    maximumRequestBytes: 1024 * 1024,
    maximumLinearMemoryBytes: 256 * 1024 * 1024
  });
  const admission = {
    modelId: "fixture/worker-switch",
    operationId: "3".repeat(64),
    composition: {
      graphIdentitySha256: "4".repeat(64),
      memberTableSha256: "5".repeat(64)
    },
    artifacts: Array.from({ length: 6 }, () => ({ sha256: "6".repeat(64), byteCount: 896 })),
    runtime: { policy: { ...policy } }
  };
  const model = { browserComposition: { admission } };
  const events = [];
  const initialized = [];
  const oldClient = {
    status: "active",
    operationId: "1".repeat(64),
    compositionId: "2".repeat(64),
    policy,
    terminate(code) {
      events.push(["terminate-old", code]);
      this.status = "terminated";
    },
    async advanceOperation() {
      assert.fail("an admission switch must not retain the old worker policy");
    }
  };
  const previousState = Object.freeze({
    state: "active-idle",
    operationId: oldClient.operationId,
    activeComposition: Object.freeze({
      graphIdentitySha256: oldClient.compositionId,
      memberTableSha256: admission.composition.memberTableSha256,
      artifactSha256: admission.artifacts[5].sha256,
      artifactBytes: admission.artifacts[5].byteCount
    })
  });
  const state = {
    runtimeClient: oldClient,
    runtimeState: previousState,
    modelActivationAbort: null,
    modelLoadSequence: 1,
    generation: { inFlight: false },
    turnAdmissionPending: false,
    transcriptRevision: 7n
  };
  const nextClient = {
    status: "created",
    async initialize(options) {
      events.push(["initialize-new"]);
      initialized.push(options);
      this.status = "ready";
      return { state: "empty" };
    },
    async activate() {
      events.push(["activate-new"]);
      this.status = "active";
      return {
        state: "active-idle",
        operationId: admission.operationId,
        activeComposition: {
          graphIdentitySha256: admission.composition.graphIdentitySha256,
          memberTableSha256: admission.composition.memberTableSha256,
          artifactSha256: admission.artifacts[5].sha256,
          artifactBytes: admission.artifacts[5].byteCount
        }
      };
    },
    terminate(code) {
      events.push(["terminate-new", code]);
      this.status = "terminated";
    }
  };
  const validation = sourceSection(app,
    "  function requireActivatedComposition(", "  function throwIfModelActivationCancelled(");
  const activation = sourceSection(app,
    "  async function activateBrowserComposition(", "  function browserCompositionProvenance(");
  const { activateBrowserComposition } = evaluateProductionSection(
    validation + activation,
    ["activateBrowserComposition"],
    {
      state,
      catalogQualificationError,
      throwIfModelActivationCancelled: () => {},
      assertAdmissionRuntime: (value) => assert.strictEqual(value, admission),
      requireCurrentBrowserComposition: (value) => {
        assert.strictEqual(value, model);
        return admission;
      },
      ensureBrowserRuntimeAsset: async () => ({
        wasmBytes: new ArrayBuffer(8),
        manifest: { sha256: "7".repeat(64) }
      }),
      modelRuntimeClientApi: {
        createBrowserClient() {
          events.push(["create-new"]);
          assert.equal(oldClient.status, "terminated", "stop A before creating B");
          return nextClient;
        }
      },
      paths: { runtimeWorker: "model-runtime-worker.js" },
      browserCompositionArtifacts: () => [],
      el: {},
      setText: () => {}
    }
  );
  return { admission, events, initialized, oldClient, nextClient, previousState, state,
    activate: () => activateBrowserComposition(model, 1) };
}

test("acquisition security: changed identity or policy initializes a fresh worker with the candidate policy", async (t) => {
  for (const change of ["identity", "larger-policy", "stricter-policy"]) {
    await t.test(change, async () => {
      const harness = createWorkerActivationHarness();
      if (change !== "identity") {
        harness.admission.operationId = harness.oldClient.operationId;
        harness.admission.composition.graphIdentitySha256 = harness.oldClient.compositionId;
        harness.admission.runtime.policy.maximumModelBytes = change === "larger-policy" ? 2048 : 512;
      }
      const result = await harness.activate();
      assert.deepEqual(harness.events.map(([kind]) => kind), [
        "terminate-old", "create-new", "initialize-new", "activate-new"
      ]);
      assert.equal(harness.initialized.length, 1);
      assert.deepEqual(harness.initialized[0].policy, harness.admission.runtime.policy);
      assert.equal(harness.initialized[0].operationId, harness.admission.operationId);
      assert.equal(harness.initialized[0].compositionId,
        harness.admission.composition.graphIdentitySha256);
      assert.strictEqual(harness.state.runtimeClient, harness.nextClient);
      assert.equal(result.state, "active-idle");
    });
  }
});

test("acquisition security: identical identity and exact policy can reuse the active worker", async () => {
  const harness = createWorkerActivationHarness();
  harness.admission.operationId = harness.oldClient.operationId;
  harness.admission.composition.graphIdentitySha256 = harness.oldClient.compositionId;
  // Equal policy values need not share object identity or property insertion order.
  harness.admission.runtime.policy = Object.fromEntries(Object.entries(harness.oldClient.policy).reverse());
  assert.strictEqual(await harness.activate(), harness.previousState);
  assert.strictEqual(harness.state.runtimeClient, harness.oldClient);
  assert.deepEqual(harness.events, []);
  assert.deepEqual(harness.initialized, []);
});

test("acquisition security: chooser and both activation entry points reject a busy turn", async (t) => {
  for (const busyState of ["generation", "turn-admission"]) {
    await t.test(busyState, async () => {
      const worker = createWorkerActivationHarness();
      worker.state.generation.inFlight = busyState === "generation";
      worker.state.turnAdmissionPending = busyState === "turn-admission";
      const pickerStatuses = [];
      const chooser = sourceSection(app,
        "  async function requestSimpleModelAcquisition(",
        "  // Begins cancellation only from an explicit visible Cancel command.");
      const { requestSimpleModelAcquisition } = evaluateProductionSection(
        chooser,
        ["requestSimpleModelAcquisition"],
        {
          state: worker.state,
          setSimpleModelPickerStatus: (...args) => pickerStatuses.push(args),
          simpleModelAcquisitionIsActive: () => assert.fail("busy turns must not dispatch acquisition")
        }
      );
      assert.equal(await requestSimpleModelAcquisition({ fixture: "another-model" }), false);
      assert.deepEqual(pickerStatuses, [["Stop the current answer before choosing another model.", false]]);
      await assert.rejects(worker.activate(), { code: "model-activation-generation-active" });
      assert.strictEqual(worker.state.runtimeClient, worker.oldClient);
      assert.deepEqual(worker.events, []);
      const loader = createBrowserCompositionLoaderHarness();
      loader.state.generation.inFlight = worker.state.generation.inFlight;
      loader.state.turnAdmissionPending = worker.state.turnAdmissionPending;
      await assert.rejects(loader.load(), { code: "model-activation-generation-active" });
      assert.equal(loader.state.modelLoadSequence, 0);
      assert.equal(loader.state.modelActivationAbort, null);
      assert.deepEqual(loader.events, []);
      assert.deepEqual(loader.controls, []);
    });
  }
});

test("acquisition security: per-step and completed-output checks reject expired or superseded authority", async (t) => {
  for (const checkpoint of ["step", "completed-output"]) {
    for (const invalidation of ["expiry", "replacement", "sequence"]) {
      await t.test(`${checkpoint}/${invalidation}`, async () => {
        let expired = false;
        const qualificationError = catalogQualificationError(
          "model-catalog-not-current", "The generation qualification expired");
        const replacement = { status: "active", terminate: () => assert.fail("replacement was terminated") };
        const replacementState = Object.freeze({ state: "replacement-active" });
        const staleOutput = { status: { kind: "maximum-tokens" }, text: "must not escape", tokenIds: [42] };
        const harness = createTurnAdmissionHarness({
          qualification(_call, admission) {
            if (expired) throw qualificationError;
            return admission;
          },
          async generate({ onStep }) {
            if (invalidation === "expiry") expired = true;
            if (invalidation === "replacement") {
              harness.state.runtimeClient = replacement;
              harness.state.runtimeState = replacementState;
            }
            if (invalidation === "sequence") harness.state.generation.sequence += 1;
            if (checkpoint === "step") onStep({ emittedTokenId: 42 });
            return staleOutput;
          }
        });
        await harness.submit();
        assert.equal(harness.calls.generate, 1);
        assert.equal(harness.calls.deliveries.length, 1);
        assert.equal(harness.calls.deliveries[0].output, null);
        assert.equal(harness.calls.deliveries[0].failure.code,
          invalidation === "expiry" ? qualificationError.code : "model-generation-superseded");
        assert.equal(harness.calls.capture[0].failed, true);
        assert.notEqual(harness.calls.capture[0].result, staleOutput.text);
        assert.equal(harness.state.lastMeasuredTokens, 0);
        if (invalidation === "replacement" || invalidation === "sequence") {
          assert.deepEqual(harness.terminations, ["model-generation-superseded"]);
          assert.equal(harness.client.status, "terminated");
        }
        if (invalidation === "replacement") {
          assert.strictEqual(harness.state.runtimeClient, replacement);
          assert.strictEqual(harness.state.runtimeState, replacementState);
          assert.equal(replacement.status, "active");
          assert.equal(harness.calls.discard, 0);
        }
        assert.deepEqual(harness.intervals.scheduled, [{ id: 1, milliseconds: 1000 }]);
        assert.deepEqual(harness.intervals.cleared, [1]);
        assert.equal(harness.intervals.activeCount, 0);
      });
    }
  }
});

test("acquisition security: timer stops a stalled captured worker without discarding its replacement", { timeout: 5000 }, async (t) => {
  for (const stage of ["transcript", "generation"]) {
    for (const invalidation of ["expiry", "replacement"]) {
      await t.test(`${stage}/${invalidation}`, async () => {
        const entered = deferred();
        const pending = deferred();
        let expired = false;
        const qualificationError = catalogQualificationError(
          "model-catalog-not-current", "The stalled generation qualification expired");
        const workerError = Object.assign(new Error("captured worker terminated"), {
          code: "model-runtime-client-terminated", terminal: true
        });
        const replacement = { status: "active", terminate: () => assert.fail("replacement was terminated") };
        const replacementState = Object.freeze({ state: "replacement-active" });
        const hold = () => { entered.resolve(); return pending.promise; };
        const harness = createTurnAdmissionHarness({
          qualification(_call, admission) {
            if (expired) throw qualificationError;
            return admission;
          },
          setTranscript: stage === "transcript" ? hold : undefined,
          generate: stage === "generation" ? hold : undefined,
          onTerminate: () => pending.reject(workerError)
        });
        const submission = harness.submit();
        try {
          await entered.promise;
          assert.deepEqual(harness.intervals.scheduled, [{ id: 1, milliseconds: 1000 }]);
          harness.intervals.tick();
          assert.deepEqual(harness.terminations, [], "current authority must not stop a stalled worker");
          if (invalidation === "expiry") expired = true;
          else {
            harness.state.runtimeClient = replacement;
            harness.state.runtimeState = replacementState;
          }
          harness.intervals.tick();
          assert.deepEqual(harness.terminations, ["model-generation-authority-expired"]);
          assert.equal(harness.client.status, "terminated");
          await submission;
          const failure = harness.calls.deliveries[0].failure;
          assert.equal(failure.code,
            invalidation === "expiry" ? qualificationError.code : "model-generation-superseded");
          if (invalidation === "expiry") assert.strictEqual(failure, qualificationError);
          else {
            assert.strictEqual(harness.state.runtimeClient, replacement);
            assert.strictEqual(harness.state.runtimeState, replacementState);
            assert.equal(harness.calls.discard, 0);
          }
          assert.equal(harness.calls.generate, stage === "generation" ? 1 : 0);
          assert.equal(harness.calls.deliveries[0].output, null);
          assert.equal(harness.calls.capture[0].failed, true);
          assert.deepEqual(harness.intervals.cleared, [1]);
          assert.equal(harness.intervals.activeCount, 0);
          harness.intervals.tick();
          assert.equal(harness.terminations.length, 1, "settlement must remove the authority timer");
        } finally {
          pending.reject(workerError);
          await submission;
        }
      });
    }
  }
});

test("acquisition security: authority timer is cleared on ordinary success and worker failure", async (t) => {
  for (const outcome of ["success", "worker-failure"]) {
    await t.test(outcome, async () => {
      const workerError = Object.assign(new Error("worker failed"), {
        code: "model-runtime-client-worker-error", terminal: true
      });
      const output = { status: { kind: "maximum-tokens" }, text: "test-only output", tokenIds: [42] };
      const harness = createTurnAdmissionHarness({
        async generate({ onStep }) {
          harness.intervals.tick();
          onStep({ emittedTokenId: 42 });
          if (outcome === "worker-failure") throw workerError;
          return output;
        }
      });
      await harness.submit();
      assert.deepEqual(harness.intervals.scheduled, [{ id: 1, milliseconds: 1000 }]);
      assert.deepEqual(harness.intervals.cleared, [1]);
      assert.equal(harness.intervals.activeCount, 0);
      assert.equal(harness.calls.deliveries[0].failure, outcome === "success" ? null : workerError);
      assert.equal(harness.calls.deliveries[0].output, outcome === "success" ? output : null);
      assert.equal(harness.calls.capture[0].failed, outcome !== "success");
      assert.equal(harness.state.lastMeasuredTokens, 1);
      harness.intervals.tick();
      assert.deepEqual(harness.terminations, []);
    });
  }
});

test("acquisition security: pending acquisition or activation rejects a new turn before runtime work", async (t) => {
  for (const field of ["modelAcquisitionCommand", "modelActivationAbort", "modelActivationCommitPending"]) {
    await t.test(field, async () => {
      const harness = createTurnAdmissionHarness();
      const pending = field === "modelAcquisitionCommand"
        ? deferred().promise
        : field === "modelActivationAbort" ? new AbortController() : { fixture: "commit-pending" };
      harness.state[field] = pending;
      const runtimeState = harness.state.runtimeState;
      await harness.submit();
      assert.strictEqual(harness.state[field], pending);
      assert.strictEqual(harness.state.runtimeClient, harness.client);
      assert.strictEqual(harness.state.runtimeState, runtimeState);
      assert.equal(harness.calls.acceptedTurns, 0);
      assert.equal(harness.calls.persistedTurns, 0);
      assert.equal(harness.calls.beginTurn, 0);
      assert.equal(harness.calls.startGeneration, 0);
      assert.equal(harness.calls.qualification, 0);
      assert.equal(harness.calls.setTranscript, 0);
      assert.equal(harness.calls.generate, 0);
      assert.equal(harness.calls.discard, 0);
      assert.deepEqual(harness.calls.deliveries, []);
      assert.deepEqual(harness.calls.capture, []);
      assert.deepEqual(harness.terminations, []);
      assert.deepEqual(harness.intervals.scheduled, []);
      assert.equal(harness.state.generation.inFlight, false);
      assert.ok(harness.statuses.some(({ target, text }) =>
        target === "runtime" && text === "Model preparation in progress"));
    });
  }
});
