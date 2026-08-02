"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  activeCompositionObservation,
  analyzeNetworkRequests,
  createSecretTextAudit,
  isLoopbackHost,
  runFreshBrowserConversation,
  runtimeIdentityObservation,
  samplingObservation,
  scanBrowserState,
  scanProfileForSecrets,
  setSamplingControls
} = require("../tools/fresh-browser-conversation.js");

function record(url, postData = "") {
  const parsed = new URL(url);
  return {
    url: parsed.href,
    origin: parsed.origin,
    protocol: parsed.protocol,
    hostname: parsed.hostname,
    pathname: parsed.pathname,
    method: postData ? "POST" : "GET",
    resourceType: "fetch",
    postData
  };
}

test("separates allowed app traffic from prompt, model-byte, local-app, and third-party violations", () => {
  const prompt = "private campaign prompt";
  const analyzed = analyzeNetworkRequests([
    record("https://tinyrustlm.com/app.js"),
    record("https://tinyrustlm.com/api/submit", prompt),
    record("https://minimodel.org/models/model.slm"),
    record("http://127.0.0.1:32199/status"),
    record("https://telemetry.example.test/collect")
  ], {
    applicationUrl: "https://tinyrustlm.com/",
    prompts: [prompt],
    allowedOrigins: []
  });
  assert.deepEqual(analyzed, {
    publicPromptLeakCount: 1,
    publicModelByteRequestCount: 1,
    unexpectedLocalAppRequestCount: 1,
    unexpectedThirdPartyRequestCount: 2
  });
});

test("allows only explicitly named optional service origins", () => {
  const analyzed = analyzeNetworkRequests([
    record("https://memoryendpoints.com/api/connector"),
    record("http://127.0.0.1:8187/app.js")
  ], {
    applicationUrl: "http://127.0.0.1:8187/",
    prompts: [],
    allowedOrigins: ["https://memoryendpoints.com"]
  });
  assert.deepEqual(analyzed, {
    publicPromptLeakCount: 0,
    publicModelByteRequestCount: 0,
    unexpectedLocalAppRequestCount: 0,
    unexpectedThirdPartyRequestCount: 0
  });
  assert.throws(() => analyzeNetworkRequests([], {
    applicationUrl: "https://tinyrustlm.com/",
    prompts: [],
    allowedOrigins: ["https://user:secret@memoryendpoints.com"]
  }), /credential-bearing/i);
});

test("treats composition metadata as app traffic without mistaking it for model bytes", () => {
  const analyzed = analyzeNetworkRequests([
    record("https://tinyrustlm.com/models/model-a.slm.acg1"),
    record("https://minimodel.org/catalog/default.v1.json")
  ], {
    applicationUrl: "https://tinyrustlm.com/",
    prompts: [],
    allowedOrigins: []
  });
  assert.deepEqual(analyzed, {
    publicPromptLeakCount: 0,
    publicModelByteRequestCount: 0,
    unexpectedLocalAppRequestCount: 0,
    unexpectedThirdPartyRequestCount: 1
  });
});

test("binds runtime composition diagnostics to the configured campaign graph", () => {
  const model = {
    compositionGraphSha256: "1".repeat(64),
    compositionId: `composition-sha256-${"2".repeat(64)}`,
    compositionActiveGraphSha256: "3".repeat(64),
    compositionRoutePolicyId: `route-sha256-${"4".repeat(64)}`,
    compositionKvFormatId: `kv-format-sha256-${"5".repeat(64)}`,
    compositionMemberCount: 2
  };
  const diagnostics = {
    model_loaded: true,
    composition_active: true,
    active_composition_bundle_sha256: `sha256:${model.compositionGraphSha256}`,
    active_composition_id: model.compositionId,
    active_composition_graph_sha256: `sha256:${model.compositionActiveGraphSha256}`,
    active_route_policy_id: model.compositionRoutePolicyId,
    active_kv_format_id: model.compositionKvFormatId,
    active_composition_member_count: model.compositionMemberCount,
    composition_activation_count: 1
  };
  const observed = activeCompositionObservation(diagnostics, model);
  assert.equal(observed.activated, true);
  assert.equal(observed.bundleSha256, model.compositionGraphSha256);

  assert.throws(() => activeCompositionObservation({
    ...diagnostics,
    active_route_policy_id: `route-sha256-${"6".repeat(64)}`
  }, model), /route policy changed/i);
});

test("detects UTF-8, UTF-16, and base64 secret persistence without returning paths", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-profile-scan-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const secret = "synthetic-agent-token-8Sx3pQ2m";
  fs.writeFileSync(path.join(root, "utf8.bin"), Buffer.from(`prefix:${secret}:suffix`));
  fs.writeFileSync(path.join(root, "utf16.bin"), Buffer.from(secret, "utf16le"));
  fs.writeFileSync(path.join(root, "base64.txt"), Buffer.from(secret).toString("base64"));
  const result = scanProfileForSecrets(root, [secret]);
  assert.equal(result.complete, true);
  assert.equal(result.matchCount, 3);
  assert.equal(Object.hasOwn(result, "paths"), false);
});

test("detects protected values in console text without retaining the text", () => {
  const secret = "private-console-prompt-42";
  const audit = createSecretTextAudit([secret]);
  audit.observe(`message:${secret}`);
  audit.observe(encodeURIComponent(secret));
  audit.observe(Buffer.from(secret).toString("base64"));
  audit.observe("ordinary message");
  const result = audit.snapshot();
  assert.deepEqual(result, { complete: true, matchCount: 3, eventCount: 4 });
  assert.equal(JSON.stringify(result).includes(secret), false);
});

test("binds every runtime sampling diagnostic to the sealed round", () => {
  const round = {
    sampling: {
      maxTokens: 96,
      temperature: 0.6,
      topK: 20,
      topP: 0.95,
      seed: 4242
    }
  };
  const model = { samplingRepetitionPenalty: 1 };
  const diagnostics = {
    model_loaded: true,
    sampling_temperature: 0.6,
    sampling_top_k: 20,
    sampling_top_p: 0.95,
    sampling_seed: 4242,
    sampling_repetition_penalty: 1,
    generated_token_count: 72
  };
  assert.deepEqual(samplingObservation(diagnostics, round, model), {
    ...round.sampling,
    repetitionPenalty: 1,
    generatedTokenCount: 72
  });
  assert.throws(() => samplingObservation({
    ...diagnostics,
    sampling_seed: 4243
  }, round, model), /sampling identity changed/i);
  assert.throws(() => samplingObservation({
    ...diagnostics,
    generated_token_count: 97
  }, round, model), /exceeded the sealed maximum/i);
});

test("drives all five sealed browser sampling controls", async () => {
  let observed = null;
  const page = {
    async evaluate(_callback, values) {
      observed = values;
    }
  };
  const sampling = {
    maxTokens: 96,
    temperature: 0.6,
    topK: 20,
    topP: 0.95,
    seed: 4242
  };
  await setSamplingControls(page, sampling);
  assert.deepEqual(observed, sampling);
});

test("rejects browser runtime admission identity drift", async () => {
  const model = {
    artifactSha256: "1".repeat(64),
    manifestSha256: "2".repeat(64),
    qualityEvidenceSha256: "3".repeat(64),
    qualificationReceiptId: `sha256:${"4".repeat(64)}`,
    promptFormat: "qwen3-chatml-no-think-v1",
    systemPromptSha256: "5".repeat(64),
    modelSamplingProfile: "qwen3-generation-config-v1"
  };
  const admissionSha256 = "6".repeat(64);
  const observed = {
    admissionSha256,
    artifactSha256: model.artifactSha256,
    manifestSha256: model.manifestSha256,
    qualityEvidenceSha256: model.qualityEvidenceSha256,
    qualificationReceiptId: model.qualificationReceiptId,
    promptFormat: model.promptFormat,
    systemPromptSha256: model.systemPromptSha256,
    modelSamplingProfile: model.modelSamplingProfile
  };
  const page = { async evaluate() { return observed; } };
  assert.deepEqual(
    await runtimeIdentityObservation(page, model, admissionSha256),
    observed
  );
  const driftedPage = {
    async evaluate() {
      return { ...observed, manifestSha256: "7".repeat(64) };
    }
  };
  await assert.rejects(
    () => runtimeIdentityObservation(driftedPage, model, admissionSha256),
    /runtime admission identity changed/i
  );
});

test("scans browser storage surfaces without returning protected values", {
  timeout: 30_000
}, async (context) => {
  const { chromium } = require("@playwright/test");
  const browser = await chromium.launch({ headless: true });
  context.after(() => browser.close());
  const browserContext = await browser.newContext({ serviceWorkers: "allow" });
  context.after(() => browserContext.close());
  const page = await browserContext.newPage();
  await page.route("https://privacy.test/**", (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: "<!doctype html><title>privacy scan</title>"
  }));
  await page.goto("https://privacy.test/");
  const secret = "private-storage-prompt-7Qm4";
  await page.evaluate(async (value) => {
    localStorage.setItem("local", value);
    sessionStorage.setItem("session", value);
    document.cookie = `privacy=${encodeURIComponent(value)}; path=/; SameSite=Strict`;
    await new Promise((resolve, reject) => {
      const request = indexedDB.open("privacy-scan", 1);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => request.result.createObjectStore("records");
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("records", "readwrite");
        transaction.objectStore("records").put(value, "secret");
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
      };
    });
    const cache = await caches.open("privacy-scan");
    await cache.put("/private", new Response(value, {
      headers: { "content-type": "text/plain" }
    }));
    const root = await navigator.storage.getDirectory();
    const file = await root.getFileHandle("private.txt", { create: true });
    const writer = await file.createWritable();
    await writer.write(value);
    await writer.close();
  }, secret);
  const result = await scanBrowserState(
    page,
    browserContext,
    new URL("https://privacy.test/"),
    [secret]
  );
  assert.equal(result.complete, true);
  assert.ok(result.matchCount >= 6);
  assert.equal(result.localStorageItemCount, 1);
  assert.equal(result.sessionStorageItemCount, 1);
  assert.equal(result.cookieCount, 1);
  assert.equal(result.indexedDbDatabaseCount, 1);
  assert.equal(result.cacheCount, 1);
  assert.equal(result.opfsFileCount, 1);
  assert.equal(JSON.stringify(result).includes(secret), false);
});

test("does not access a browser or local app for a blocked hosted-memory round", async () => {
  await assert.rejects(() => runFreshBrowserConversation({
    campaignId: "fresh-browser-test-20260715",
    profileParent: os.tmpdir(),
    applicationUrl: "https://tinyrustlm.com/",
    round: {
      round: 1,
      modelId: "tinyrustlm/model-a",
      memoryContinuity: true,
      prompts: ["First turn", "Second turn"]
    },
    model: { modelId: "tinyrustlm/model-a" }
  }), /live MemoryEndpoints executor is required/i);
});

test("recognizes only actual loopback host forms", () => {
  assert.equal(isLoopbackHost("localhost"), true);
  assert.equal(isLoopbackHost("127.8.9.10"), true);
  assert.equal(isLoopbackHost("[::1]"), true);
  assert.equal(isLoopbackHost("127.0.0.1.example.test"), false);
  assert.equal(isLoopbackHost("192.168.1.20"), false);
});
