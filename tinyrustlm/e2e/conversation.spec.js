"use strict";

const { test, expect } = require("@playwright/test");
const { runtimeCompositionFixture, TEST_ONLY_MODEL_ID } = require("./helpers/browser-conversation-fixture.js");
const { loadComposition, waitForVisualReady } = require("../tools/capture-ui-lock.js");
const { parseRequest } = require("../tools/prompt2-reference.js");
const { parseTemplate2, renderPrompt } = require("../tools/template2-reference.js");
const { parseTokenizer2, encodeText } = require("../tools/tokenizer2-reference.js");
const PRIVATE_COMPOSITION_ROOT = process.env.TINYRUSTLM_BROWSER_RUNTIME_PRIVATE_COMPOSITION_ROOT || "";

/** Observe runtime transport and page faults without replacing the worker. */
function observeBrowserDiagnostics(page) {
  const state = {
    consoleMessages: [],
    pageErrors: [],
    requestFailures: [],
    workerUrls: [],
    runtimeResponses: [],
    httpErrors: []
  };
  const pendingResponses = [];
  const isRuntimeUrl = (value) => {
    const pathname = new URL(value).pathname;
    return pathname.includes("model-runtime") || pathname.includes("browser-runtime");
  };
  page.on("console", (message) => {
    state.consoleMessages.push({ type: message.type(), text: message.text() });
  });
  page.on("pageerror", (error) => {
    state.pageErrors.push({ name: error.name, message: error.message });
  });
  page.on("requestfailed", (request) => {
    state.requestFailures.push({
      url: request.url(),
      method: request.method(),
      failure: request.failure()
    });
  });
  page.on("worker", (worker) => state.workerUrls.push(worker.url()));
  page.on("response", (response) => {
    const runtime = isRuntimeUrl(response.url());
    const failed = response.status() >= 400;
    if (!runtime && !failed) return;
    pendingResponses.push(response.allHeaders().then((headers) => {
      const record = {
        url: response.url(),
        status: response.status(),
        headers
      };
      if (runtime) state.runtimeResponses.push(record);
      if (failed) state.httpErrors.push(record);
    }));
  });
  return Object.freeze({
    async snapshot() {
      await Promise.all(pendingResponses);
      return JSON.parse(JSON.stringify(state));
    }
  });
}

/** Import a six-member synthetic composition through the real Advanced workflow. */
async function loadLocalRuntimeFixture(page, browserDiagnostics, fixture) {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.__tinyRustLmWorkerErrors = [];
    window.__tinyRustLmWorkerProtocol = [];
    window.__tinyRustLmWorkerConstructors = [];
    window.Worker = class extends NativeWorker {
      constructor(...args) {
        const requestedUrl = String(args[0]);
        const resolvedUrl = new URL(requestedUrl, document.baseURI).href;
        super(...args);
        window.__tinyRustLmWorkerConstructors.push({ requestedUrl, resolvedUrl });
        const nativePostMessage = this.postMessage.bind(this);
        this.postMessage = (message, transfer) => {
          const record = {
            direction: "command",
            kind: message && message.kind,
            generationId: message && message.generationId
          };
          if (message && message.kind === "artifact-chunk" &&
              message.payload.artifactKind === "prompt-request") {
            record.promptOffset = message.payload.offset;
            record.promptBytes = Array.from(new Uint8Array(message.payload.bytes));
          }
          window.__tinyRustLmWorkerProtocol.push(record);
          const result = transfer === undefined
            ? nativePostMessage(message)
            : nativePostMessage(message, transfer);
          // Stop through the normal UI after the real begin command, before a step can race it.
          if (message && message.kind === "begin-generation" &&
              window.__tinyRustLmStopNextGeneration === true) {
            window.__tinyRustLmStopNextGeneration = false;
            const stop = document.getElementById("generateButton");
            if (!stop || stop.disabled || stop.dataset.action !== "stop") {
              throw new Error("Generation did not expose its normal Stop action");
            }
            stop.click();
          }
          return result;
        };
        this.addEventListener("message", (event) => {
          const output = event.data && event.data.payload && event.data.payload.output;
          window.__tinyRustLmWorkerProtocol.push({
            direction: "event",
            kind: event.data && event.data.kind,
            generationId: event.data && event.data.generationId,
            code: event.data && event.data.payload && event.data.payload.code,
            terminalKind: output && output.status.kind,
            outputText: output && output.text,
            outputTokenCount: output && output.tokenIds.length
          });
        });
        this.addEventListener("error", (event) => {
          window.__tinyRustLmWorkerErrors.push({
            message: event.message,
            fileName: event.filename,
            lineNumber: event.lineno,
            columnNumber: event.colno
          });
        });
      }
    };
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#wasmState")).toHaveText("waiting");
  await expect(page.locator("#runtimeStatus")).not.toHaveText("Loading default model", {
    timeout: 30000
  });
  try {
    await loadComposition(page, fixture.files);
  } catch (_error) {
    const diagnostics = await page.evaluate(() => ({
      selectedFiles: Array.from(
        document.getElementById("localModelFile").files || []
      ).map((file) => ({
        name: file.name,
        size: file.size
      })),
      runtimeStatus: document.getElementById("runtimeStatus").textContent,
      localModelState: document.getElementById("localModelState").textContent,
      modelState: document.getElementById("modelState").textContent,
      errorState: document.getElementById("errorState").textContent,
      workerErrors: window.__tinyRustLmWorkerErrors,
      workerProtocol: window.__tinyRustLmWorkerProtocol,
      workerConstructors: window.__tinyRustLmWorkerConstructors
    }));
    const browser = browserDiagnostics ? await browserDiagnostics.snapshot() : null;
    throw new Error(`Local fixture did not load: ${JSON.stringify({ ...diagnostics, browser })}`);
  }
  await expect(page.locator("#modelState")).toHaveText(/^worker active \(/);
  await expect(page.locator("#wasmState")).toHaveText("verified");
  await expect(page.locator("#localModelState")).toContainText(TEST_ONLY_MODEL_ID);
  await waitForVisualReady(page);
  await page.locator("#diagnosticsRailToggle").click();
  if (await page.locator("#modelEditButton").getAttribute("aria-expanded") === "true") {
    await page.locator("#modelEditButton").click();
  }
  await expect(page.locator("#generateButton")).toBeEnabled();
  await expect(page.locator("#privacyBadge")).toHaveAttribute("data-offline-ready", "true");
  await expect(page.locator("#privacyBadge")).toHaveAttribute(
    "title",
    /You can disconnect from the internet and keep chatting in this open tab/
  );
}

/** Submit through the actual keyboard conversation entry point. */
async function submitPrompt(page, prompt) {
  await page.locator("#prompt").fill(prompt);
  await page.locator("#prompt").press("Enter");
}

/** Require terminal state and exactly the expected transcript rows. */
async function waitForIdleTurn(page, expectedMessages) {
  await expect(page.locator(".app-shell")).toHaveAttribute("data-generation-state", "idle", {
    timeout: 90000
  });
  await expect(page.locator("#conversation .message")).toHaveCount(expectedMessages, {
    timeout: 90000
  });
}

/** Admit the unchanged test catalog while restricting unrelated external requests. */
async function routeRuntimeFixture(context, fixture, origin) {
  await context.route("**/*", async route => {
    const body = fixture.routes[route.request().url()];
    if (body) await route.fulfill({ status: 200, contentType: "application/json", body });
    else if (new URL(route.request().url()).origin === origin) await route.continue();
    else await route.fulfill({ status: 503, contentType: "text/plain", body: "Fixture catalog unavailable" });
  });
}

/** Parse the exact bounded Prompt2 transfers observed before their buffers were detached. */
async function observedPromptRequests(page) {
  const chunks = await page.evaluate(() => window.__tinyRustLmWorkerProtocol
    .filter(entry => entry.direction === "command" && entry.promptBytes));
  return chunks.map(entry => {
    // The maintained client transfers each small fixture request as one complete chunk.
    expect(entry.promptOffset).toBe(0);
    return { generationId: entry.generationId, messages: parseRequest(Buffer.from(entry.promptBytes)).messages };
  });
}

/** Select an exact context-sized input using the same immutable template/tokenizer, not new weights. */
function contextFillingPrompt(fixture) {
  const member = name => fixture.files.find(file => file.name === name).buffer;
  const tokenizerBytes = member("tokenizer.tokenizer2");
  const tokenizer = parseTokenizer2(tokenizerBytes, { maximumArtifactBytes: tokenizerBytes.byteLength });
  const template = parseTemplate2(member("template.template2"));
  const maximumTokens = JSON.parse(fixture.admissionText).runtime.policy.maximumSequenceTokens;
  expect(maximumTokens).toBe(128);
  for (let count = 1; count <= maximumTokens; count += 1) {
    const prompt = "A ".repeat(count).trimEnd();
    const rendered = renderPrompt(template, [{ role: "user", content: prompt }]);
    if (encodeText(tokenizer, rendered.bytes.toString("utf8")).length === maximumTokens) return prompt;
  }
  throw new Error("The unchanged fixture did not yield an exact context-sized prompt");
}

test.describe("active browser-local conversation", () => {
  let fixture;
  test.beforeAll(() => {
    test.setTimeout(120000);
    if (PRIVATE_COMPOSITION_ROOT) fixture = runtimeCompositionFixture(PRIVATE_COMPOSITION_ROOT);
  });

  test("rejects a locally selected composition missing from the verified catalog", async ({ page, context }) => {
    test.skip(!PRIVATE_COMPOSITION_ROOT, "requires canonical tokenizer/template dependencies");
    const origin = test.info().project.use.baseURL;
    const workers = [];
    page.on("worker", worker => workers.push(worker.url()));
    const empty = JSON.parse(fixture.routes["https://minimodel.org/catalog/compositions.v1.json"]);
    empty.entries = [];
    await context.route("**/*", async route => {
      const url = route.request().url();
      const body = url === "https://minimodel.org/catalog/compositions.v1.json"
        ? JSON.stringify(empty) + "\n" : fixture.routes[url];
      if (body) await route.fulfill({ status: 200, contentType: "application/json", body });
      else if (new URL(url).origin === origin) await route.continue();
      else await route.fulfill({ status: 503, body: "Unavailable in test" });
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#simpleOpenAdvancedDiscoveryButton")).toBeVisible();
    await page.locator("#simpleOpenAdvancedDiscoveryButton").click();
    await page.locator("#localModelFile").setInputFiles(fixture.files);
    await page.locator("#importLocalModelButton").click();
    await expect(page.locator("#errorState")).toHaveText("This local composition is not in the current verified model list");
    await expect(page.locator("#generateButton")).toBeDisabled();
    expect(workers).toEqual([]);
  });

  test("uses one response renderer with real WASM and keeps conversation content local", async ({ page, context }) => {
    test.skip(
      !PRIVATE_COMPOSITION_ROOT,
      "requires TINYRUSTLM_BROWSER_RUNTIME_PRIVATE_COMPOSITION_ROOT"
    );
    test.setTimeout(240_000);
    const browserDiagnostics = observeBrowserDiagnostics(page);
    const observedRequests = [];
    const sockets = [];
    page.on("websocket", socket => sockets.push(socket.url()));
    const origin = test.info().project.use.baseURL;
    await context.route("**/*", async route => {
      const body = fixture.routes[route.request().url()];
      if (body) await route.fulfill({ status: 200, contentType: "application/json", body });
      else if (new URL(route.request().url()).origin === origin) await route.continue();
      else await route.fulfill({ status: 503, contentType: "text/plain", body: "Fixture catalog unavailable" });
    });
    context.on("request", (request) => {
      observedRequests.push({
        url: request.url(),
        method: request.method(),
        postData: request.postData() || ""
      });
    });

    await loadLocalRuntimeFixture(page, browserDiagnostics, fixture);
    const browser = await browserDiagnostics.snapshot();
    const workerResponse = browser.runtimeResponses.find((entry) =>
      new URL(entry.url).pathname === "/app/model-runtime-worker.js");
    const wasmResponse = browser.runtimeResponses.find((entry) =>
      new URL(entry.url).pathname === "/browser-runtime/tinyrustlm-browser-runtime.wasm");
    expect(workerResponse).toMatchObject({
      status: 200,
      headers: {
        "content-type": "text/javascript; charset=utf-8",
        "cross-origin-resource-policy": "same-origin",
        "x-content-type-options": "nosniff"
      }
    });
    expect(wasmResponse).toMatchObject({
      status: 200,
      headers: {
        "content-type": "application/wasm",
        "cross-origin-resource-policy": "same-origin",
        "x-content-type-options": "nosniff"
      }
    });
    expect(browser.workerUrls).toEqual([workerResponse.url]);
    const expectedUnavailable = entry => {
      const url = new URL(entry.url);
      return (url.origin === origin && url.pathname === "/.well-known/site-release.json" && entry.status === 404) ||
        (url.hostname === "minimodel.org" && url.pathname.startsWith("/catalog/") && entry.status === 503);
    };
    expect(browser.httpErrors.filter(entry => !expectedUnavailable(entry))).toEqual([]);
    expect(browser.consoleMessages.filter(entry => entry.type === "error" &&
      !/Failed to load resource: the server responded with a status of (404|503)/u.test(entry.text))).toEqual([]);
    expect(browser.pageErrors).toEqual([]);
    expect(browser.requestFailures).toEqual([]);
    await expect(page.locator("#simpleExperience")).toBeVisible();
    await expect(page.locator(".starter-grid")).toBeVisible();

    const firstPrompt = "First local browser-only conversation turn";
    await submitPrompt(page, firstPrompt);
    await waitForIdleTurn(page, 2);

    await expect(page.locator(".app-shell")).toHaveAttribute("data-conversation-state", "active");
    await expect(page.locator("#simpleExperience")).toBeHidden();
    await expect(page.locator(".starter-grid")).toBeHidden();
    await expect(page.locator("#simpleDiscoveryPanel")).toBeHidden();
    await expect(page.locator("#modelEditButton")).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#conversationHeader")).toBeVisible();
    await expect(page.locator("#conversation .message-user")).toHaveCount(1);
    await expect(page.locator("#conversation .message-assistant")).toHaveCount(1);
    await expect(page.locator("#conversation #response")).toHaveCount(1);
    await expect(page.locator(".response-sentinel#response")).toHaveCount(0);
    const firstAssistant = page.locator("#conversation .message-assistant").first();
    await expect(firstAssistant).toHaveAttribute("data-status", "completed");
    await expect(firstAssistant.locator(".message-status")).toHaveText("Completed");
    await expect(firstAssistant.locator('[data-message-action="copy"]')).toHaveCount(1);
    await expect(firstAssistant.locator('[data-message-action="retry"]')).toHaveCount(1);
    await expect(firstAssistant.locator('[data-message-action="inspect"]')).toHaveCount(1);

    const secondPrompt = "Second local turn must also produce exactly one assistant message";
    await submitPrompt(page, secondPrompt);
    await waitForIdleTurn(page, 4);
    await expect(page.locator("#conversation .message-user")).toHaveCount(2);
    await expect(page.locator("#conversation .message-assistant")).toHaveCount(2);
    await expect(page.locator("#conversation .message-assistant[data-status='completed']"))
      .toHaveCount(2);
    await expect(page.locator("#conversation #response")).toHaveCount(1);

    const geometry = await page.evaluate(() => {
      const conversation = document.querySelector(".conversation-panel").getBoundingClientRect();
      const composer = document.getElementById("chatForm").getBoundingClientRect();
      return {
        conversationBottom: conversation.bottom,
        composerTop: composer.top,
        composerBottom: composer.bottom,
        viewportHeight: innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth
      };
    });
    expect(geometry.conversationBottom).toBeLessThanOrEqual(geometry.composerTop + 1);
    expect(geometry.composerBottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);

    // MiniModel may host model seeds. This local-import test forbids content uploads to every host.
    const assistantText = await page.locator("#conversation .message-assistant .message-content").allTextContents();
    const promptLeaks = observedRequests.filter(entry =>
      [firstPrompt, secondPrompt].some(value => entry.postData.includes(value) ||
        decodeURIComponent(entry.url).includes(value)));
    expect(promptLeaks, "prompts must remain browser-local, including URLs and loopback").toEqual([]);
    expect(observedRequests.filter(entry => !["GET", "HEAD"].includes(entry.method)),
      "local inference must not upload model or conversation bytes").toEqual([]);
    expect(assistantText.length).toBe(2);
    expect(sockets, "local inference must not open a remote inference socket").toEqual([]);
    expect((await browserDiagnostics.snapshot()).pageErrors).toEqual([]);
  });

  test("continues after real cancellation and retains the latest correction in Prompt2", async ({ page, context }) => {
    test.skip(!PRIVATE_COMPOSITION_ROOT, "requires canonical tokenizer/template dependencies");
    test.setTimeout(240_000);
    const diagnostics = observeBrowserDiagnostics(page);
    await routeRuntimeFixture(context, fixture, test.info().project.use.baseURL);
    await loadLocalRuntimeFixture(page, diagnostics, fixture);

    const initial = "My name is Morgan.";
    const correction = "My name is now Riley.";
    const followup = "What is my current name?";
    await submitPrompt(page, initial);
    await waitForIdleTurn(page, 2);
    const firstAssistant = page.locator("#conversation .message-assistant").first();
    await expect(firstAssistant).toHaveAttribute("data-status", "completed");
    const firstOutput = await firstAssistant.locator(".message-text").getAttribute("data-raw-text");
    expect(firstOutput).not.toBe("");

    await page.evaluate(() => { window.__tinyRustLmStopNextGeneration = true; });
    await submitPrompt(page, correction);
    await waitForIdleTurn(page, 4);
    const stopped = page.locator("#conversation .message-assistant").nth(1);
    await expect(stopped).toHaveAttribute("data-status", "stopped");
    await expect(stopped.locator(".message-text")).toHaveAttribute("data-raw-text", "");
    await expect(page.locator("#generateButton")).toHaveAttribute("data-action", "send");
    await expect(page.locator("#generateButton")).toBeEnabled();

    await submitPrompt(page, followup);
    await waitForIdleTurn(page, 6);
    await expect(page.locator("#conversation .message-assistant").nth(2))
      .toHaveAttribute("data-status", "completed");
    const requests = await observedPromptRequests(page);
    expect(requests).toHaveLength(3);
    expect(requests[2].messages).toEqual([
      { role: "user", content: initial },
      { role: "assistant", content: firstOutput },
      { role: "user", content: correction },
      { role: "assistant", content: "" },
      { role: "user", content: followup }
    ]);
    const protocol = await page.evaluate(() => window.__tinyRustLmWorkerProtocol);
    const cancelled = protocol.filter(entry => entry.generationId === requests[1].generationId);
    expect(cancelled.filter(entry => entry.direction === "command")
      .map(entry => entry.kind)).toContain("cancel-generation");
    expect(cancelled.filter(entry => entry.kind === "step-generation")).toEqual([]);
    expect(cancelled.find(entry => entry.kind === "generation-complete")).toMatchObject({
      terminalKind: "cancelled", outputText: "", outputTokenCount: 0
    });
    expect((await diagnostics.snapshot()).pageErrors).toEqual([]);
  });

  test("settles an actual empty context-limit response and permits a new chat", async ({ page, context }) => {
    test.skip(!PRIVATE_COMPOSITION_ROOT, "requires canonical tokenizer/template dependencies");
    test.setTimeout(240_000);
    const prompt = contextFillingPrompt(fixture);
    const diagnostics = observeBrowserDiagnostics(page);
    await routeRuntimeFixture(context, fixture, test.info().project.use.baseURL);
    await loadLocalRuntimeFixture(page, diagnostics, fixture);

    await submitPrompt(page, prompt);
    await waitForIdleTurn(page, 2);
    const assistant = page.locator("#conversation .message-assistant");
    await expect(assistant).toHaveAttribute("data-status", "completed");
    await expect(assistant.locator(".message-text")).toHaveAttribute("data-raw-text", "");
    await expect(assistant.locator('[data-message-action="copy"]')).toHaveCount(0);
    await expect(assistant.locator('[data-message-action="continue"]')).toHaveCount(0);
    await expect(page.locator("#runtimeStatus")).toHaveText("Context limit reached");
    await expect(page.locator("#generateButton")).toHaveAttribute("data-action", "send");
    await expect(page.locator("#generateButton")).toBeEnabled();
    const protocol = await page.evaluate(() => window.__tinyRustLmWorkerProtocol);
    expect(protocol.find(entry => entry.kind === "generation-complete")).toMatchObject({
      terminalKind: "context-limit", outputText: "", outputTokenCount: 0
    });
    expect(protocol.filter(entry => ["step-generation", "cancel-generation"].includes(entry.kind))).toEqual([]);

    // The old chat is legitimately full; a fresh chat must reset KV and generate normally.
    await page.locator("#newChatButton").click();
    await expect(page.locator("#conversation .message")).toHaveCount(0);
    await submitPrompt(page, "Hello again.");
    await waitForIdleTurn(page, 2);
    await expect(page.locator("#conversation .message-assistant")).toHaveAttribute("data-status", "completed");
    await expect(page.locator("#conversation .message-assistant .message-text"))
      .not.toHaveAttribute("data-raw-text", "");
    const requests = await observedPromptRequests(page);
    expect(requests).toHaveLength(2);
    expect(requests[0].messages).toEqual([{ role: "user", content: prompt }]);
    expect(requests[1].messages).toEqual([{ role: "user", content: "Hello again." }]);
    expect((await diagnostics.snapshot()).pageErrors).toEqual([]);
  });
});
