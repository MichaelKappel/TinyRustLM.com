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
