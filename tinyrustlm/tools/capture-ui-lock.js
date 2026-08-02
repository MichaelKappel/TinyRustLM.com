#!/usr/bin/env node
"use strict";

const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const appUrl = process.argv[2] || "https://TinyRustLM.com/";
const outputDir = process.argv[3] || path.resolve(__dirname, "..", "artifacts", "reports", "ui-lock");
const debugPort = Number.parseInt(process.argv[4] || "9771", 10);
const baselinePath = process.argv[5] && process.argv[5] !== "-" ? process.argv[5] : "";
const visualMode = process.argv[6] || "empty";
if (!["empty", "active", "long"].includes(visualMode)) {
  throw new Error(`Unsupported TinyRustLM visual lock mode: ${visualMode}`);
}
const localVisualFixturePath = path.resolve(__dirname, "..", "models", "tiny-test-model-q8.slm");

const browserCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
];

const viewports = [
  { name: "desktop", width: 1365, height: 768, mobile: false },
  { name: "mobile", width: 390, height: 844, mobile: true }
];

function findBrowser() {
  for (const candidate of browserCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error("Chrome or Edge executable was not found");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => {
      let data = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        data += chunk;
      });
      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`HTTP ${response.statusCode} while fetching ${url}: ${data}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    }).on("error", reject);
  });
}

async function waitForTarget(port) {
  const deadline = Date.now() + 20000;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const targets = await getJson(`http://127.0.0.1:${port}/json/list`);
      const target = targets.find((entry) => entry.type === "page" && entry.webSocketDebuggerUrl);
      if (target) {
        return target;
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw lastError || new Error("Timed out waiting for browser target");
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) {
        for (const listener of this.listeners.get(message.method) || []) {
          Promise.resolve(listener(message.params || {})).catch(() => {});
        }
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(JSON.stringify(message.error)));
      } else {
        pending.resolve(message.result || {});
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) || [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }
}

function connectWebSocket(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.addEventListener("open", () => resolve(new CdpClient(socket)));
    socket.addEventListener("error", () => reject(new Error("WebSocket connection failed")));
  });
}

async function captureViewport(client, viewport) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.mobile
  });
  await client.send("Page.navigate", { url: "about:blank" });
  await sleep(50);
  await client.send("Storage.clearDataForOrigin", {
    origin: new URL(appUrl).origin,
    storageTypes: "local_storage,indexeddb,cache_storage,service_workers"
  });
  await client.send("Page.navigate", { url: appUrl });
  await waitForVisualReady(client);
  if (visualMode !== "empty") {
    await loadLocalVisualFixture(client);
  }
  await prepareConversationVisualMode(client);
  const state = await evaluate(client, visualStateExpression(viewport));
  assertVisualModeState(state, viewport);
  const screenshot = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false
  });
  const modePart = visualMode === "empty" ? "" : `-${visualMode}`;
  const fileName = `tinyrustlm-ui-lock${modePart}-${viewport.name}.png`;
  const outputPath = path.join(outputDir, fileName);
  fs.writeFileSync(outputPath, Buffer.from(screenshot.data, "base64"));
  const pngSha256 = sha256File(outputPath);
  const uiSignature = sha256Text(JSON.stringify(state.signatureFields));
  return {
    viewport: viewport.name,
    width: viewport.width,
    height: viewport.height,
    screenshot: outputPath,
    screenshot_sha256: pngSha256,
    screenshot_bytes: fs.statSync(outputPath).size,
    ui_signature_sha256: uiSignature,
    state
  };
}

function assertVisualModeState(state, viewport) {
  if (!state || state.requiredShellPresent !== true || !state.signatureFields) {
    throw new Error(`${viewport.name} visual lock is missing the required shell`);
  }
  const fields = state.signatureFields;
  const expectedMessages = visualMode === "long" ? 14 : visualMode === "active" ? 2 : 0;
  const expectedConversationState = visualMode === "empty" ? "empty" : "active";
  if (fields.conversationState !== expectedConversationState) {
    throw new Error(`${viewport.name} expected ${expectedConversationState} conversation state, received ${fields.conversationState}`);
  }
  if (fields.messageCount !== expectedMessages) {
    throw new Error(`${viewport.name} expected ${expectedMessages} conversation messages, received ${fields.messageCount}`);
  }
  if (fields.responseCount !== 1) {
    throw new Error(`${viewport.name} expected exactly one authoritative response renderer, received ${fields.responseCount}`);
  }
  if (fields.generationState !== "idle") {
    throw new Error(`${viewport.name} generation did not return to idle`);
  }
  if (visualMode === "empty") {
    return;
  }
  if (!fields.simpleExperienceHidden || !fields.modelPopoverHidden) {
    throw new Error(`${viewport.name} active conversation retained an introductory or model-setup surface`);
  }
  const conversation = fields.shellRects && fields.shellRects.conversationPanel;
  const composer = fields.shellRects && fields.shellRects.composerPanel;
  if (!conversation || !composer) {
    throw new Error(`${viewport.name} active conversation geometry is missing`);
  }
  if (conversation.y + conversation.height > composer.y + 1) {
    throw new Error(`${viewport.name} conversation overlaps the composer`);
  }
  if (composer.y + composer.height > viewport.height + 1) {
    throw new Error(`${viewport.name} composer extends beyond the viewport`);
  }
}

async function prepareConversationVisualMode(client) {
  if (visualMode === "empty") {
    return;
  }
  const targetMessageCount = visualMode === "long" ? 14 : 2;
  await evaluate(client, `(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const shell = document.querySelector(".app-shell");
    const form = document.getElementById("chatForm");
    const prompt = document.getElementById("prompt");
    const messageCount = () => document.querySelectorAll("#conversation .message").length;
    for (let turn = Math.floor(messageCount() / 2); messageCount() < ${targetMessageCount}; turn += 1) {
      prompt.value = turn === 0
        ? "privacy?"
        : "continue";
      prompt.dispatchEvent(new Event("input", { bubbles: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      for (let attempt = 0; attempt < 750; attempt += 1) {
        if (shell.dataset.generationState === "idle" && messageCount() >= (turn + 1) * 2) {
          break;
        }
        await sleep(40);
      }
      if (shell.dataset.generationState !== "idle") {
        throw new Error("visual lock generation did not reach a terminal state");
      }
    }
    const timeline = document.getElementById("conversation");
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    timeline.style.scrollBehavior = "auto";
    timeline.scrollTop = timeline.scrollHeight;
    await sleep(250);
  })()`);
}

// Loads the runtime fixture through the same local file picker used by a user.
async function loadLocalVisualFixture(client) {
  if (!fs.existsSync(localVisualFixturePath)) {
    throw new Error(`visual-lock local fixture is missing: ${localVisualFixturePath}`);
  }
  await client.send("DOM.enable");
  const document = await client.send("DOM.getDocument", { depth: -1, pierce: true });
  const input = await client.send("DOM.querySelector", {
    nodeId: document.root.nodeId,
    selector: "#localModelFile"
  });
  if (!input.nodeId) {
    throw new Error("visual-lock local model input was not found");
  }
  await client.send("DOM.setFileInputFiles", {
    files: [localVisualFixturePath],
    nodeId: input.nodeId
  });
  await evaluate(client, `(() => {
    document.getElementById("modelEditButton").click();
    document.getElementById("simpleLocalSourceButton").click();
    const input = document.getElementById("localModelFile");
    input.dispatchEvent(new Event("change", { bubbles: true }));
    document.getElementById("simpleImportLocalModelButton").click();
  })()`);
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    const state = await evaluate(client, `(() => ({
      runtimeStatus: document.getElementById("runtimeStatus").textContent,
      modelState: document.getElementById("modelState").textContent,
      errorState: document.getElementById("errorState").textContent
    }))()`);
    if (state.runtimeStatus === "Ready" && state.modelState.startsWith("loaded") && state.errorState === "none") {
      return;
    }
    await sleep(100);
  }
  throw new Error("visual-lock local fixture did not reach the loaded state");
}

async function waitForVisualReady(client) {
  const deadline = Date.now() + 60000;
  let lastState = null;
  while (Date.now() < deadline) {
    const state = await evaluate(client, `(() => ({
      href: location.href,
      readyState: document.readyState,
      hasLeftSidebar: Boolean(document.querySelector(".left-sidebar")),
      hasMainWorkspace: Boolean(document.querySelector(".main-workspace")),
      hasAdvancedOptionsPanel: Boolean(document.querySelector(".advanced-options-panel")),
      hasStarterActions: document.querySelectorAll(".starter-action").length >= 4,
      runtimeStatus: document.getElementById("runtimeStatus") ? document.getElementById("runtimeStatus").textContent : "",
      modelState: document.getElementById("modelState") ? document.getElementById("modelState").textContent : "",
      errorState: document.getElementById("errorState") ? document.getElementById("errorState").textContent : ""
    }))()`);
    lastState = state;
    if (
      state.readyState === "complete"
      && state.hasLeftSidebar
      && state.hasMainWorkspace
      && state.hasAdvancedOptionsPanel
      && state.hasStarterActions
      && (
        (state.runtimeStatus === "Ready" && state.modelState.startsWith("loaded"))
        || (state.runtimeStatus === "Runtime ready" && state.modelState.startsWith("choose a local or P2P"))
      )
      && state.errorState === "none"
    ) {
      await sleep(300);
      return;
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for the TinyRustLM visual shell: ${JSON.stringify(lastState)}`);
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(`Evaluation failed: ${JSON.stringify(result.exceptionDetails)}`);
  }
  return result.result ? result.result.value : null;
}

function visualStateExpression(viewport) {
  return `(() => {
    const textList = (selector) => Array.from(document.querySelectorAll(selector))
      .map((node) => node.textContent.replace(/\\s+/g, " ").trim())
      .filter(Boolean);
    const rect = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height)
      };
    };
    const style = (selector, property) => {
      const node = document.querySelector(selector);
      return node ? getComputedStyle(node).getPropertyValue(property).trim() : "";
    };
    const signatureFields = {
      viewport: ${JSON.stringify(viewport.name)},
      conversationMode: ${JSON.stringify(visualMode)},
      title: document.title,
      bodyBackground: style("body", "background-color"),
      bodyColor: style("body", "color"),
      sidebarBackground: style(".left-sidebar", "background-color"),
      primaryButtonBackground: style("#newChatButton", "background-color"),
      h1: document.querySelector("h1") ? document.querySelector("h1").textContent.trim() : "",
      privacyBadge: document.querySelector(".privacy-badge") ? document.querySelector(".privacy-badge").textContent.replace(/\\s+/g, " ").trim() : "",
      starterLabels: textList(".starter-action"),
      setupLabels: textList(".setup-option"),
      presetLabels: textList(".preset-button"),
      panelHeadings: textList(".panel-title, h2:not(#conversationTitle), h3, summary").slice(0, 24),
      shellRects: {
        leftSidebar: rect(".left-sidebar"),
        mainWorkspace: rect(".main-workspace"),
        advancedOptionsPanel: rect(".advanced-options-panel"),
        modelToolbar: rect(".model-toolbar"),
        composerPanel: rect(".composer-panel"),
        conversationPanel: rect(".conversation-panel")
      },
      conversationState: document.querySelector(".app-shell") ? document.querySelector(".app-shell").dataset.conversationState : "missing",
      generationState: document.querySelector(".app-shell") ? document.querySelector(".app-shell").dataset.generationState : "missing",
      messageCount: document.querySelectorAll("#conversation .message").length,
      responseCount: document.querySelectorAll("#response").length,
      simpleExperienceHidden: !document.getElementById("simpleExperience")
        || document.getElementById("simpleExperience").hidden
        || style("#simpleExperience", "display") === "none",
      modelPopoverHidden: !document.getElementById("simpleDiscoveryPanel")
        || document.getElementById("simpleDiscoveryPanel").hidden
        || style("#simpleDiscoveryPanel", "display") === "none",
      timelineOverflowY: style("#conversation", "overflow-y")
    };
    return {
      href: location.href,
      title: document.title,
      innerWidth,
      innerHeight,
      bodyTextStart: document.body ? document.body.innerText.slice(0, 600) : "",
      requiredShellPresent: Boolean(
        document.querySelector(".left-sidebar")
        && document.querySelector(".main-workspace")
        && document.querySelector(".advanced-options-panel")
        && document.querySelector(".model-toolbar")
        && document.querySelector(".composer-panel")
      ),
      signatureFields
    };
  })()`;
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function sha256Text(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function compareBaseline(report, baseline) {
  const failures = [];
  for (const capture of report.captures) {
    const expected = baseline.captures.find((item) => item.viewport === capture.viewport);
    if (!expected) {
      failures.push(`baseline missing ${capture.viewport}`);
      continue;
    }
    if (capture.width !== expected.width || capture.height !== expected.height) {
      failures.push(
        `${capture.viewport} viewport changed: expected ${expected.width}x${expected.height}, actual ${capture.width}x${capture.height}`
      );
    }
    if (!capture.state || capture.state.requiredShellPresent !== true) {
      failures.push(`${capture.viewport} required shell regions were not present`);
    }
    if (!capture.screenshot_sha256 || capture.screenshot_bytes < 4096) {
      failures.push(`${capture.viewport} screenshot was missing or too small`);
    }
    const expectedFields = expected.state && expected.state.signatureFields ? expected.state.signatureFields : null;
    const captureFields = capture.state && capture.state.signatureFields ? capture.state.signatureFields : null;
    if (!expectedFields || !captureFields) {
      if (expected.ui_signature_sha256 !== capture.ui_signature_sha256) {
        failures.push(
          `${capture.viewport} UI signature changed: expected ${expected.ui_signature_sha256}, actual ${capture.ui_signature_sha256}`
        );
      }
      continue;
    }
    compareSignatureFields(capture.viewport, expectedFields, captureFields, failures);
  }
  return failures;
}

function compareSignatureFields(viewport, expected, actual, failures) {
  const prefix = `${viewport} UI signature`;
  const exactFields = [
    "viewport",
    "title",
    "bodyBackground",
    "bodyColor",
    "sidebarBackground",
    "primaryButtonBackground",
    "h1",
    "privacyBadge"
  ];
  for (const key of exactFields) {
    if (expected[key] !== actual[key]) {
      failures.push(`${prefix} ${key} changed: expected ${JSON.stringify(expected[key])}, actual ${JSON.stringify(actual[key])}`);
    }
  }
  for (const key of ["starterLabels", "setupLabels", "presetLabels", "panelHeadings"]) {
    if (JSON.stringify(expected[key] || []) !== JSON.stringify(actual[key] || [])) {
      failures.push(`${prefix} ${key} changed`);
    }
  }
  const rectTolerance = viewport === "mobile" ? 24 : 8;
  const expectedRects = expected.shellRects || {};
  const actualRects = actual.shellRects || {};
  for (const key of Object.keys(expectedRects)) {
    const expectedRect = expectedRects[key];
    const actualRect = actualRects[key];
    if (!expectedRect || !actualRect) {
      failures.push(`${prefix} ${key} rect missing`);
      continue;
    }
    for (const dimension of ["x", "y", "width", "height"]) {
      if (Math.abs(Number(expectedRect[dimension]) - Number(actualRect[dimension])) > rectTolerance) {
        failures.push(
          `${prefix} ${key}.${dimension} changed beyond ${rectTolerance}px: expected ${expectedRect[dimension]}, actual ${actualRect[dimension]}`
        );
      }
    }
  }
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = findBrowser();
  const profile = path.join(os.tmpdir(), `tinyrustlm-ui-lock-${process.pid}`);
  fs.rmSync(profile, { recursive: true, force: true });
  fs.mkdirSync(profile, { recursive: true });
  const browserArgs = [
    "--headless=new",
    "--disable-gpu",
    "--disable-application-cache",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-extensions",
    "--disable-sync",
    "--disk-cache-size=1",
    "--media-cache-size=1",
    "--no-default-browser-check",
    "--no-first-run",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`
  ];
  const targetUrl = new URL(appUrl);
  if (targetUrl.hostname.toLowerCase() === "tinyrustlm.com" && targetUrl.protocol === "http:") {
    browserArgs.push("--host-resolver-rules=MAP tinyrustlm.com 127.0.0.1");
    browserArgs.push(`--unsafely-treat-insecure-origin-as-secure=${targetUrl.origin}`);
  }
  browserArgs.push("about:blank");
  const browserProcess = childProcess.spawn(browser, browserArgs, {
    stdio: "ignore",
    windowsHide: true
  });

  try {
    const target = await waitForTarget(debugPort);
    const client = await connectWebSocket(target.webSocketDebuggerUrl);
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    const captures = [];
    for (const viewport of viewports) {
      captures.push(await captureViewport(client, viewport));
    }
    const report = {
      schema: "tinyrustlm.ui_visual_lock.v0",
      app_url: appUrl,
      conversation_mode: visualMode,
      generated_utc: new Date().toISOString(),
      comparison_policy: "stable-ui-fields-with-rect-tolerance-and-screenshot-evidence-v1",
      captures
    };
    let baseline_failures = [];
    if (baselinePath) {
      const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
      baseline_failures = compareBaseline(report, baseline);
      report.baseline = baselinePath;
      report.baseline_failures = baseline_failures;
    }
    const reportName = visualMode === "empty"
      ? "tinyrustlm-ui-lock-report.json"
      : `tinyrustlm-ui-lock-${visualMode}-report.json`;
    const reportPath = path.join(outputDir, reportName);
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    await client.send("Browser.close").catch(() => {});
    if (baseline_failures.length > 0) {
      throw new Error(baseline_failures.join("; "));
    }
    console.log(JSON.stringify({
      ok: true,
      report: reportPath,
      comparison_policy: report.comparison_policy,
      captures: captures.map((capture) => ({
        viewport: capture.viewport,
        width: capture.width,
        height: capture.height,
        screenshot_sha256: capture.screenshot_sha256,
        screenshot_bytes: capture.screenshot_bytes,
        ui_signature_sha256: capture.ui_signature_sha256
      }))
    }, null, 2));
  } finally {
    browserProcess.kill();
    await sleep(500);
    try {
      fs.rmSync(profile, { recursive: true, force: true });
    } catch (_error) {
      // Chrome can keep a transient lock briefly after Browser.close; screenshots
      // and the report are already written, so cleanup failure is non-fatal.
    }
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
