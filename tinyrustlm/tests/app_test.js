"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const source = fs.readFileSync(path.join(__dirname, "../app/app.js"), "utf8");
const peerAuthority = require("../app/minimodel-catalog-v1.js").directPeerUrlAuthority;
const conversationApi = require("../app/active-conversation.js");
const start = source.indexOf("  function chooseBootstrapModelRoute(");
const end = source.indexOf("\n  // Resolves selection", start);
assert.ok(start >= 0 && end > start);
const choose = Function("simpleModelRouteKinds",
  `${source.slice(start, end)}; return chooseBootstrapModelRoute;`)(
  { QUALIFIED_P2P: "qualified-p2p" }
);

// Builds projection inputs only; these are not real qualified model artifacts.
function route(bytes, kind = "qualified-p2p", host = "https://minimodel.org/") {
  return { kind, entry: {
    composition: { members: [{ bytes }] }, peers: [{ peerBaseUrl: host }],
  } };
}

test("bootstrap chooses the smallest server-seeded composition without mutating routes", () => {
  const large = route(600 * 1024 * 1024);
  const small = route(100 * 1024 * 1024);
  const routes = [large, small];
  assert.equal(choose(routes), small);
  assert.deepEqual(routes, [large, small]);
});

test("bootstrap never starts conversion, arbitrary peers, or oversized downloads", () => {
  for (const candidate of [
    route(1, "supported-local-conversion"), route(1, "installed"),
    route(1, "unsupported-source"), route(1, "qualified-p2p", "https://8.8.8.8/"),
    route(768 * 1024 * 1024 + 1), route(0), route(-1), route(NaN),
    route(Number.MAX_SAFE_INTEGER + 1), route("1"),
    { kind: "qualified-p2p", entry: {} },
    { kind: "qualified-p2p", entry: { composition: {} } },
  ]) assert.equal(choose([candidate]), null);
  assert.equal(choose([]), null);
  const boundary = route(768 * 1024 * 1024);
  assert.equal(choose([boundary]), boundary);
});

// Extract a named application function without copying any source to another file.
function functionText(name) {
  const pattern = new RegExp(`^  (?:async )?function ${name}\\(`, "m");
  const start = source.search(pattern);
  assert.ok(start >= 0, name);
  const end = source.indexOf("\n  }", start) + 4;
  assert.ok(end > start, name);
  return source.slice(start, end);
}

// Exercise the live app projection with real persisted conversation normalization.
function conversationHarness(priorStatus = "stopped", priorText = "") {
  const now = "2026-09-23T02:00:00Z";
  let chat = conversationApi.createConversation({ id: "chat", now });
  const turn = (id, text, status, reply) => {
    chat = conversationApi.appendTurn(chat,
      conversationApi.createMessage({ id: `${id}-u`, turnId: id, role: "user", text, createdAt: now }),
      conversationApi.createMessage({ id: `${id}-a`, turnId: id, role: "assistant", text: reply, status, createdAt: now }), now);
  };
  turn("correction", "My current name is Morgan.", priorStatus, priorText);
  turn("current", "What is my current name?", "generating", "");
  const projection = Function("activeConversation", "conversationApi",
    `${functionText("prompt2ConversationMessages")}; return prompt2ConversationMessages;`)(() => chat, conversationApi);
  const state = { generation: { sequence: 7, inFlight: true, assistantMessageId: "current-a",
    stopRequested: true, abortController: {} }, runtimeState: {}, modelLoaded: true };
  const events = [];
  const values = { state, conversationApi, paths: { models: { fixture: {} } },
    el: { runtimeStatus: "runtime", errorState: "error" },
    updateAssistantMessage: (id, patch) => { chat = conversationApi.updateMessage(chat, id, patch, now); },
    setText: (...args) => events.push(args),
    setGenerationUi: (status) => { state.generation.inFlight = status !== "idle"; },
    setControls: () => events.push("controls"), renderDiagnostics: () => events.push("diagnostics"),
    runPendingGenerationAction: () => events.push("pending-action") };
  const deliver = Function(...Object.keys(values),
    `${functionText("deliverGeneratedOutput")}; return deliverGeneratedOutput;`)(...Object.values(values));
  return { projection, deliver, state, events, chat: () => chat };
}

test("live Prompt2 history retains corrections and raw stopped output with alternating roles", () => {
  for (const [status, text, content] of [["stopped", "", ""], ["stopped", "Partial answer", "Partial answer"],
    ["failed", "runtime-failure-code", ""], ["rejected", "prompt2-budget", ""],
    ["completed", "Hello Morgan", "Hello Morgan"]]) {
    const h = conversationHarness(status, text);
    assert.deepEqual(h.projection("current-a"), [
      { role: "user", content: "My current name is Morgan." },
      { role: "assistant", content },
      { role: "user", content: "What is my current name?" }
    ], status);
    assert.equal(h.chat().messages[1].text, text, "stored failure/partial evidence stays unchanged");
  }
});

test("empty successful terminal output reaches idle and round-trips without an invented answer", async () => {
  for (const kind of ["context-limit", "stop-token", "maximum-new-tokens", "cancelled"]) {
    const h = conversationHarness("completed", "Hello Morgan");
    await h.deliver("current-a", { status: { kind }, text: "", tokenIds: [], committedKvBytes: 64 }, null, 7);
    assert.equal(h.state.generation.inFlight, false, kind);
    assert.equal(h.state.generation.assistantMessageId, "");
    assert.equal(h.state.generation.abortController, null);
    assert.equal(h.state.generation.stopRequested, false);
    const saved = conversationApi.parseConversationStore(conversationApi.serializeConversationStore([h.chat()]));
    assert.equal(saved.rejectedCount, 0);
    assert.equal(saved.conversations[0].messages[3].text, "");
    assert.equal(saved.conversations[0].messages[3].status, kind === "cancelled" ? "stopped" : "completed");
    assert.ok(h.events.includes("pending-action"));
  }
});

test("terminal failures and stale deliveries preserve generation ownership", async () => {
  const h = conversationHarness();
  await h.deliver("current-a", null, { code: "obsolete-result" }, 6);
  assert.equal(h.state.generation.inFlight, true);
  assert.equal(h.events.length, 0);
  await h.deliver("current-a", null, { code: "prompt2-budget", status: 1 }, 7);
  assert.equal(h.state.generation.inFlight, false);
  assert.equal(h.chat().messages[3].status, "rejected");
  assert.equal(h.chat().messages[3].text, "prompt2-budget");
  const failed = conversationHarness();
  await failed.deliver("current-a", null, new Error("failure"), 7);
  assert.equal(failed.chat().messages[3].status, "failed");
  assert.equal(failed.chat().messages[3].errorCode, "model-runtime-client-generation-failed");
});

// Build only the signed-list orchestration boundary; no network or model bytes.
function listingHarness(options = {}) {
  const state = { peerBaseUrl: "", modelCatalogV1Loading: false, modelCatalogV1Entries: [], ...options.state };
  const messages = [];
  let refreshes = 0;
  const available = Function(`${functionText("canStartP2pImport")}; return canStartP2pImport;`)();
  const values = {
    state,
    el: { simplePeerBaseUrlInput: { value: options.url ?? "https://minimodel.org/" } },
    normalizedPeerBaseUrl: (value) => value ? peerAuthority.normalizeBaseUrl(value) : "",
    setPeerBaseUrl: (value) => { state.peerBaseUrl = value; },
    loadSimpleModelCatalog: async () => { refreshes += 1; if (options.refresh) await options.refresh(state); },
    acceptedCatalogIsCurrent: () => options.catalogCurrent !== false,
    acceptedPeerFeedIsCurrent: () => options.feedCurrent !== false,
    canStartP2pImport: available,
    updatePeerUrlStatus: (...args) => messages.push(args),
  };
  const check = Function(...Object.keys(values), `${functionText("checkCurrentPeerListing")}; return checkCurrentPeerListing;`)(...Object.values(values));
  return { state, messages, check, refreshes: () => refreshes };
}

test("Advanced peer listing counts only matching unexpired signed composition routes", async () => {
  const future = new Date(Date.now() + 60000).toISOString();
  const past = new Date(Date.now() - 60000).toISOString();
  const peer = { peerBaseUrl: "https://minimodel.org/", feedValidUntilUtc: future, expiresUtc: future };
  const entry = (peers) => ({ availability: "peer", browserAdmission: {}, composition: {}, peers });
  const h = listingHarness({ state: { modelCatalogV1Entries: [
    entry([peer]), entry([{ ...peer, peerBaseUrl: "https://8.8.8.8/" }, peer]),
    entry([{ ...peer, expiresUtc: past }]), entry([{ ...peer, feedValidUntilUtc: past }]),
    entry([{ ...peer, peerBaseUrl: "https://8.8.8.8/" }]),
  ] } });
  assert.equal(await h.check(), 2);
  assert.equal(h.refreshes(), 1);
  assert.match(h.messages[0][0], /^2 current model listings/);
  assert.match(h.messages[0][0], /reachability is verified during acquisition/);
  const empty = listingHarness();
  assert.equal(await empty.check(), 0);
  const one = listingHarness({ state: { modelCatalogV1Entries: [entry([peer])] } });
  assert.equal(await one.check(), 1);
  assert.match(one.messages[0][0], /^1 current model listing for/);
});

test("Advanced peer listing refuses missing, unverified, or superseded selection", async () => {
  for (const options of [{ url: "" }, { url: "https://foreign.example/" },
    { state: { modelCatalogV1Loading: true } }]) {
    const h = listingHarness(options);
    await assert.rejects(h.check());
    assert.equal(h.refreshes(), 0);
    assert.equal(h.messages.length, 0);
  }
  for (const options of [{ catalogCurrent: false }, { feedCurrent: false }]) {
    const h = listingHarness(options);
    await assert.rejects(h.check(), /current signed model and peer list/);
    assert.equal(h.messages.length, 0);
  }
  const changed = listingHarness({ refresh: (state) => { state.peerBaseUrl = "https://8.8.8.8/"; } });
  assert.equal(await changed.check(), null);
  assert.equal(changed.messages.length, 0);
  const rejected = listingHarness({ refresh: () => { throw new Error("refresh failed"); } });
  await assert.rejects(rejected.check(), /refresh failed/);
});

test("retired v0 metadata imports have no executable readers or HTML controls", () => {
  for (const retired of ["peer_contact_book.v0", "import_receipt_ledger.v0", "peer_companion_inventory.v0",
    "peerContactCardFromRaw", "validatePeerStatusBody", "checkLivePeerStatus", "requireImportLedgerObject",
    "catalogEntriesFromBody", "direct-http-piece-server-v0", "TinyRustLMMiniModelAnnouncement",
    "startP2pImportOrRequestPeer"]) {
    assert.equal(source.includes(retired), false, retired);
  }
  for (const htmlPath of ["../index.html", "../app/index.html"]) {
    const html = fs.readFileSync(path.join(__dirname, htmlPath), "utf8");
    assert.doesNotMatch(html, /peerContactCardFile|peerContactBookFile|importReceiptLedgerFile|peerStatusCheckFile|peerCompanionInventoryFile|models\.v0|minimodel-announcement\.js|localCatalogFile/);
    assert.match(html, /id="simplePeerBaseUrlInput"/);
    assert.match(html, />Check Listing<\/button>/);
  }
});

test("external source discovery never chooses between multiple current compositions", () => {
  const state = { modelCatalogV1Entries: [] };
  const resolve = Function("state", "normalizeModelIdentity", [
    functionText("catalogV1EntryMatchesHfModel"), functionText("hfP2pMatches"),
    functionText("hfQualifiedCatalogMatch"), "return hfQualifiedCatalogMatch;",
  ].join("\n"))(state, (value) => typeof value === "string" ? value.toLowerCase() : "");
  const first = { entryId: "composition-one", source: { repository: "Qwen/Qwen3-0.6B" } };
  assert.equal(resolve("Qwen/Qwen3-0.6B"), null);
  state.modelCatalogV1Entries = [first];
  assert.equal(resolve("Qwen/Qwen3-0.6B"), first);
  assert.equal(resolve("another/source"), null);
  state.modelCatalogV1Entries.push({ ...first, entryId: "composition-two" });
  assert.equal(resolve("Qwen/Qwen3-0.6B"), null);
  state.modelCatalogV1Entries = [{ modelId: "Qwen/Qwen3-0.6B" }];
  assert.equal(resolve("Qwen/Qwen3-0.6B"), null);
});

// Build bounded public metadata with the real catalog validator; there are no qualified model bytes.
function authorityRecord(revision, ageMilliseconds = 60000, lifetimeMilliseconds = 3600000) {
  const api = require("../app/minimodel-catalog-v1.js");
  const catalog = JSON.parse(require("../tools/web-release-browser-smoke.js").declaredCatalogMetadata()[0].body);
  const generated = Math.floor((Date.now() - ageMilliseconds) / 1000) * 1000;
  catalog.revision = revision;
  catalog.generated_at_utc = new Date(generated).toISOString().replace(".000Z", "Z");
  catalog.valid_until_utc = new Date(generated + lifetimeMilliseconds).toISOString().replace(".000Z", "Z");
  const catalogText = `${JSON.stringify(catalog)}\n`;
  return { catalogDocument: api.validateCatalog(catalog, { now: new Date(generated) }), catalogText,
    catalogAuthority: { id: catalog.catalog_id, revision, generatedAtUtc: catalog.generated_at_utc,
      validUntilUtc: catalog.valid_until_utc,
      sha256: `sha256:${require("node:crypto").createHash("sha256").update(catalogText).digest("hex")}` } };
}

// Exercise production refresh/storage orchestration with real timing and catalog validation.
function authorityRefreshHarness(options = {}) {
  const api = require("../app/minimodel-catalog-v1.js");
  const previous = options.previous || null;
  const next = options.next || authorityRecord(3, 1000);
  const state = { modelCatalogV1Document: previous?.catalogDocument || null,
    modelCatalogV1Text: previous?.catalogText || "", modelCatalogV1Authority: previous
      ? { catalog: previous.catalogAuthority, peerFeed: null } : null,
    modelCatalogV1Entries: [], modelCatalogV1PeerDocument: null, localModel: options.localModel || null,
    modelLoaded: Boolean(options.localModel), companion: {}, generation: { inFlight: false } };
  const events = [];
  const store = {
    async readCatalogAuthority() { events.push("read"); if (options.readError) throw options.readError; return options.durable || null; },
    async acceptCatalogAuthority(value) {
      events.push("write");
      assert.notEqual(state.modelCatalogV1Document, next.catalogDocument, "RAM acceptance waits for durable commit");
      if (options.writeError) throw options.writeError;
      assert.equal(value.catalogText, next.catalogText);
      return next;
    }
  };
  const bindings = { state, el: {}, document: { activeElement: null }, AbortController,
    operationLifetimeApi: require("../app/operation-lifetime.js"),
    ensureModelCompositionStore: () => store,
    miniModelCatalogV1Api: { ...api, async loadCurrentCatalog(value) {
      events.push("fetch");
      if (options.inspectPrevious) options.inspectPrevious(value.previousAuthority);
      if (options.fetchError) throw options.fetchError;
      return { catalog: { status: api.SOURCE_STATUSES.VALID, document: next.catalogDocument, text: next.catalogText },
        peerFeed: { status: api.SOURCE_STATUSES.INVALID, error: { type: "fetch" } }, views: [],
        authority: { catalog: next.catalogAuthority, peerFeed: null } };
    } },
    clearSimpleModelPeerExpiryTimer() {}, clearSimpleModelConversionRecovery() {}, renderSimpleModelPicker() {},
    setSimpleModelPickerStatus: text => events.push(text), scheduleSimpleModelPeerExpiry() {},
    reconcileSimpleModelSelection() {}, clearPendingCompanionAcquisition() {},
    discardRejectedStoredActivation() { events.push("discard"); state.localModel = null; state.modelLoaded = false; },
    simpleModelRouteViews: () => [], simpleModelRouteKinds: {}, restorePendingCompanionAcquisition: () => null,
    verifiedInstalledSimpleModelEntry: () => null, companionIsPaired: () => false,
    friendlyError: value => value, errorMessage: error => error.message,
    maybePresentInitialModelChooser() {}, renderAcceptedHfResults() {}, scheduleSimpleModelPickerFocus() {},
    scheduleSimpleCompanionPairingFocus() {} };
  const names = ["catalogQualificationError", "acquisitionAbortError", "acceptedCatalogIsCurrent",
    "acceptedPeerFeedIsCurrent", "removeExpiredPeerRoutes", "retainAcceptedCatalogAfterRefreshFailure",
    "clearExpiredCatalogAuthority", "catalogAuthorityStorage", "restoreDurableCatalogAuthority", "loadSimpleModelCatalog"];
  const functions = Function(...Object.keys(bindings),
    `${names.map(functionText).join("\n")}\nreturn { ${names.join(",")} };`)(...Object.values(bindings));
  return { state, events, ...functions };
}

test("catalog refresh uses the newer durable floor before network and persists before RAM acceptance", async () => {
  const durable = authorityRecord(2, 30000);
  const h = authorityRefreshHarness({ previous: authorityRecord(1), durable,
    inspectPrevious: value => assert.equal(value.catalog.revision, 2) });
  assert.equal(await h.loadSimpleModelCatalog(), true);
  assert.equal(h.state.modelCatalogV1Authority.catalog.revision, 3);
  assert.deepEqual(h.events.filter(value => ["read", "fetch", "write"].includes(value)), ["read", "fetch", "write"]);
});

test("an expired newer durable catalog remains the rollback floor over an unexpired installation", async () => {
  const h = authorityRefreshHarness({ previous: authorityRecord(1),
    durable: authorityRecord(2, 30000, 10000), fetchError: new Error("offline"),
    inspectPrevious: value => assert.equal(value.catalog.revision, 2) });
  assert.equal(await h.loadSimpleModelCatalog(), false);
  assert.equal(h.state.modelCatalogV1Authority.catalog.revision, 2);
  assert.equal(h.acceptedCatalogIsCurrent(), false);
  assert.deepEqual(h.state.modelCatalogV1Entries, []);
});

test("durable authority equivocation and storage failures cannot keep the old loaded model active", async () => {
  const previous = authorityRecord(2, 30000);
  const equivocation = authorityRecord(2, 20000);
  for (const failure of [{ durable: equivocation }, { readError: new Error("OPFS denied") },
    { writeError: new Error("storage full") }]) {
    const h = authorityRefreshHarness({ previous, localModel: {}, ...failure });
    assert.equal(await h.loadSimpleModelCatalog(), false);
    assert.equal(h.state.modelLoaded, false);
    assert.deepEqual(h.state.modelCatalogV1Entries, []);
    assert.ok(h.events.includes("discard"));
  }
});

test("boot cannot activate older saved authority after durable storage fails or auto-download without OPFS", async () => {
  for (const cached of [true, false]) {
    const h = authorityRefreshHarness({ previous: cached ? authorityRecord(1) : null,
      ...(cached ? { writeError: new Error("authority storage unavailable") }
        : { readError: new Error("OPFS unavailable") }) });
    let activations = 0;
    let downloads = 0;
    const saved = cached ? { admissionAuthority: { admissionText: "verified fixture admission",
      qualificationReceiptText: "verified fixture receipt", catalogText: h.state.modelCatalogV1Text,
      catalogDocument: h.state.modelCatalogV1Document, catalogAuthority: h.state.modelCatalogV1Authority.catalog } } : null;
    const admissionBindings = { state: h.state,
      browserModelAdmissionApi: { parseAdmissionText: () => ({ composition: { graphIdentitySha256: "a".repeat(64) } }) },
      assertAdmissionRuntime() {}, catalogText: value => typeof value === "string" ? value.trim() : "" };
    const admit = Function(...Object.keys(admissionBindings), [functionText("catalogQualificationError"),
      functionText("currentCatalogEntryForAdmission"), functionText("requireCurrentStoredComposition"),
      "return requireCurrentStoredComposition;"].join("\n"))(...Object.values(admissionBindings));
    const bindings = { state: h.state, el: { appShell: { dataset: { mode: "simple" } } }, paths: { models: {} },
      localModelKey: "local", setInteractive() {}, setText() {}, renderModelOptions() {}, setControls() {}, renderDiagnostics() {},
      setSimpleModelPickerStatus() {}, friendlyError: value => value, errorMessage: error => error.message,
      openStartupComposition: async () => { if (!cached) throw new Error("OPFS unavailable"); return saved; },
      restoreStoredCatalogAuthority() {},
      loadSimpleModelCatalog: h.loadSimpleModelCatalog,
      async activateStoredComposition() {
        activations += 1;
        assert.equal(h.state.modelCatalogV1Entries.length, 0);
        assert.throws(() => admit(saved), error => error.code === "model-catalog-delisted");
        admit(saved);
      },
      discardRejectedStoredActivation() {}, appendConsole() {}, scheduleCompositionCleanup() {},
      simpleModelRouteViews: () => h.state.modelCatalogV1Entries,
      chooseBootstrapModelRoute: routes => routes[0] || null,
      simpleModelAcquisitionIsActive: () => false, selectSimpleModelEntry() {}, toggleModelPopover() {},
      async requestSimpleModelAcquisition() { downloads += 1; }, maybePresentInitialModelChooser() {} };
    const boot = Function(...Object.keys(bindings), `${functionText("boot")}\nreturn boot;`)(...Object.values(bindings));
    await boot();
    assert.equal(activations, cached ? 1 : 0);
    assert.equal(downloads, 0);
    assert.equal(h.state.modelLoaded, false);
  }
});

// Bind only orchestration: the saved bytes must pass the unchanged admission function before activation.
function savedRefreshHarness(options = {}) {
  const state = options.state || { generation: { inFlight: false }, modelLoaded: Boolean(options.loaded) };
  const saved = { identity: "existing-installed-composition" };
  const events = [];
  const bindings = { state, AbortController,
    simpleModelAcquisitionIsActive: () => Boolean(options.busy || state.activeAcquisitionAbort || state.modelAcquisitionCommand),
    async loadSimpleModelCatalog() { events.push("refresh"); return options.refreshWork
      ? options.refreshWork() : options.current !== false; },
    async openStartupComposition(signal) {
      events.push("open-existing");
      if (options.waitForAbort) return new Promise((_resolve, reject) => signal.addEventListener("abort",
        () => reject(Object.assign(new Error("cancelled"), { name: "AbortError" })), { once: true }));
      return options.empty ? null : saved;
    },
    throwIfAcquisitionAborted(signal) { if (signal.aborted) throw new Error("cancelled"); },
    requireCurrentStoredComposition(value) {
      assert.strictEqual(value, saved); events.push("admit");
      if (options.revoked) throw new Error("revoked");
    },
    async activateStoredComposition(value, text, signal) {
      assert.strictEqual(value, saved); assert.equal(signal.aborted, false);
      assert.match(text, /saved model/); events.push("activate"); state.modelLoaded = true;
    },
    renderSimpleModelPicker() {}, setSimpleModelPickerStatus: text => events.push(text), errorMessage: error => error.message };
  const functions = Function(...Object.keys(bindings), [functionText("refreshModelsAndRestoreSavedComposition"),
    functionText("requestSimpleModelAcquisitionCancellation"),
    "return { refresh: refreshModelsAndRestoreSavedComposition, cancel: requestSimpleModelAcquisitionCancellation };"
  ].join("\n"))(...Object.values(bindings));
  return { state, events, ...functions };
}

test("explicit Refresh reopens the same saved model after metadata renewal without downloading", async () => {
  const authority = authorityRefreshHarness({ previous: authorityRecord(1, 48 * 3600000) });
  const h = savedRefreshHarness({ state: authority.state, refreshWork: authority.loadSimpleModelCatalog });
  assert.equal(await h.refresh(), true);
  assert.deepEqual(h.events, ["refresh", "open-existing", "admit", "activate"]);
  assert.equal(h.state.initialModelRestored, true);
  assert.equal(h.state.modelAcquisitionCommand, null);
  assert.equal(h.state.activeAcquisitionAbort, null);
  assert.equal(h.state.modelCatalogV1Authority.catalog.revision, 3);
});

test("explicit Refresh never activates a revoked, missing, busy or unauthorised saved model", async () => {
  for (const options of [{ revoked: true }, { empty: true }, { busy: true }, { current: false }]) {
    const h = savedRefreshHarness(options);
    assert.equal(await h.refresh(), false);
    assert.equal(h.events.includes("activate"), false);
  }
  const loaded = savedRefreshHarness({ loaded: true });
  assert.equal(await loaded.refresh(), true);
  assert.deepEqual(loaded.events, ["refresh"]);
});

test("Cancel during explicit saved-model reopening releases ownership without companion or download work", async () => {
  const h = savedRefreshHarness({ waitForAbort: true });
  const result = h.refresh();
  await Promise.resolve();
  assert.equal(h.events.includes("open-existing"), true);
  assert.equal(await h.cancel(), false);
  assert.equal(await result, false);
  assert.equal(h.events.includes("activate"), false);
  assert.ok(h.events.includes("Saved model loading cancelled."));
  assert.equal(h.state.modelAcquisitionCommand, null);
  assert.equal(h.state.activeAcquisitionAbort, null);
});
