#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("@playwright/test");
const admission = require("../app/browser-model-admission.js");
const { requireModelOutputRoot, readBoundedFile } = require("./huggingface-candidate-storage.js");
const {
  createOwnedTemporaryDirectory, removeOwnedTemporaryDirectory, requireCanonicalArtifactPath
} = require("./canonical-operation-scratch.js");

const viewports = Object.freeze([
  { name: "desktop", width: 1365, height: 768, mobile: false },
  { name: "mobile", width: 390, height: 844, mobile: true }
]);
const comparisonPolicy = "stable-ui-fields-with-rect-tolerance-and-screenshot-evidence-v1";
const profileParent = path.resolve(__dirname, "../../artifacts/tests/ui-lock-profiles");

/** Reject malformed options before allocating a profile or writing evidence. */
function parseOptions(args) {
  const [appUrl, output, baseline = "-", visualMode = "empty", compositionDir, ...extra] = args;
  if (!appUrl || !output || extra.length || !["empty", "active", "long"].includes(visualMode)) {
    throw new Error("Usage: capture-ui-lock.js <url> <output-directory> [baseline|-] [empty|active|long] [composition-directory]");
  }
  const url = new URL(appUrl);
  if (url.username || url.password ||
      !(url.protocol === "https:" || (url.protocol === "http:" &&
        ["127.0.0.1", "[::1]", "localhost"].includes(url.hostname)))) {
    throw new Error("Visual capture requires HTTPS or loopback HTTP without credentials");
  }
  if ((visualMode === "empty") === Boolean(compositionDir)) {
    throw new Error("Only active/long captures require an explicit current composition directory");
  }
  const outputDir = requireCanonicalArtifactPath(path.resolve(output));
  const baselinePath = baseline === "-" ? "" : path.resolve(baseline);
  if (baselinePath && path.dirname(baselinePath) === outputDir) {
    throw new Error("Capture output must not overwrite its baseline directory");
  }
  return { appUrl: url.href, outputDir, baselinePath, visualMode,
    compositionDir: compositionDir ? requireModelOutputRoot(compositionDir) : "" };
}

/** Admit seven ordinary inputs only; browser admission still verifies identities and qualification. */
function compositionFiles(directory) {
  const root = requireModelOutputRoot(directory);
  const entries = fs.readdirSync(root);
  if (entries.length > 128) throw new Error("Composition directory inventory exceeds its bound");
  const admissions = entries.filter((name) => name.endsWith(".browser-composition-admission.json"));
  if (admissions.length !== 1) throw new Error("Exactly one current composition admission is required");
  const admissionPath = path.join(root, admissions[0]);
  const parsed = admission.parseAdmissionText(readBoundedFile(admissionPath, admission.maximumTextBytes).toString("utf8"));
  const files = admission.artifactSpecs.map((spec) => path.join(root, spec.fileName));
  for (const [index, file] of files.entries()) {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 ||
        stat.size !== parsed.artifacts[index].byteCount) {
      throw new Error(`Composition member is not an ordinary file of the admitted size: ${path.basename(file)}`);
    }
  }
  return [...files, admissionPath];
}

/** Close the owned browser before deletion; retain its profile if closure cannot be proved. */
async function withBrowserProfile(viewport, action, launch = chromium.launchPersistentContext.bind(chromium)) {
  const owned = createOwnedTemporaryDirectory({ temporaryParent: profileParent });
  let context;
  let result;
  let failure;
  let closed = false;
  try {
    context = await launch(owned.rootPath, {
      channel: process.env.TINYRUSTLM_PLAYWRIGHT_CHANNEL || undefined,
      headless: true, timeout: 30000,
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1, isMobile: viewport.mobile, hasTouch: viewport.mobile,
      colorScheme: "dark", locale: "en-US", timezoneId: "UTC",
      acceptDownloads: false
    });
    context.setDefaultTimeout(30000);
    context.setDefaultNavigationTimeout(30000);
    result = await action(context);
  } catch (error) {
    failure = error;
  } finally {
    try {
      if (context) await context.close();
      closed = true;
    } catch (error) {
      failure = new AggregateError([failure, error].filter(Boolean),
        `Browser close failed; owned profile retained: ${owned.rootPath}`);
    }
    if (closed) {
      try { removeOwnedTemporaryDirectory(owned); }
      catch (error) {
        failure = new AggregateError([failure, error].filter(Boolean),
          `Owned profile cleanup failed: ${owned.rootPath}`);
      }
    }
  }
  if (failure) throw failure;
  return result;
}

/** Accept a ready qualified default or current deferred startup, with fonts ready for capture. */
async function waitForVisualReady(page) {
  await page.waitForFunction(() => {
    const text = (id) => document.getElementById(id)?.textContent;
    const waiting = text("runtimeStatus") === "Choose a qualified composition" &&
      text("modelState") === "choose a model" && text("wasmState") === "waiting";
    const ready = text("runtimeStatus") === "Ready" && text("modelState")?.startsWith("loaded") &&
      text("wasmState") === "verified";
    return document.readyState === "complete" && document.fonts.status === "loaded" &&
      document.querySelector(".left-sidebar") && document.querySelector(".main-workspace") &&
      document.querySelector(".advanced-options-panel") &&
      document.querySelectorAll(".starter-action").length >= 4 &&
      (waiting || ready) &&
      text("errorState") === "none";
  }, undefined, { timeout: 60000 });
}

/** Import all current members through Advanced; no forged admission or worker substitution. */
async function loadComposition(page, files) {
  const edit = page.locator("#modelEditButton");
  if (await edit.getAttribute("aria-expanded") !== "true") await edit.click();
  await page.locator("#simpleOpenAdvancedDiscoveryButton").click();
  await page.locator("#localModelFile").setInputFiles(files);
  await page.locator("#importLocalModelButton").click();
  await page.waitForFunction(() => {
    const text = (id) => document.getElementById(id)?.textContent;
    const error = text("errorState");
    if (error && error !== "none") throw new Error("Composition import failed: " + error);
    return text("runtimeStatus") === "Ready" && text("modelState")?.startsWith("loaded") &&
      text("wasmState") === "verified";
  }, undefined, { timeout: 90000 });
}

/** Bound every turn and reject idle failure or no-progress instead of looping forever. */
async function prepareConversationVisualMode(page, visualMode) {
  const turns = visualMode === "long" ? 7 : visualMode === "active" ? 1 : 0;
  for (let turn = 0; turn < turns; turn += 1) {
    await page.locator("#prompt").fill(turn === 0 ? "privacy?" : "continue");
    await page.locator("#chatForm").evaluate((form) => form.requestSubmit());
    await page.waitForFunction((expected) => {
      const error = document.getElementById("errorState")?.textContent;
      if (error && error !== "none") throw new Error("Visual generation failed: " + error);
      if (document.querySelector(".message-assistant.error")) throw new Error("Assistant turn failed");
      return document.querySelector(".app-shell")?.dataset.generationState === "idle" &&
        document.querySelectorAll("#conversation .message").length === expected &&
        document.querySelectorAll(".message-assistant[data-status='completed']").length === expected / 2;
    }, (turn + 1) * 2, { timeout: 30000 });
  }
  if (turns) await page.evaluate(() => {
    window.scrollTo(0, 0);
    const timeline = document.getElementById("conversation");
    timeline.style.scrollBehavior = "auto";
    timeline.scrollTop = timeline.scrollHeight;
  });
}

/** Capture a fresh-profile viewport and preserve exact PNG bytes plus stable field evidence. */
async function captureViewport(context, options, viewport, files) {
  const page = context.pages()[0] || await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const response = await page.goto(options.appUrl, { waitUntil: "load" });
  if (!response || response.status() !== 200) throw new Error("Visual app did not return HTTP 200");
  await waitForVisualReady(page);
  if (options.visualMode !== "empty") await loadComposition(page, files);
  await prepareConversationVisualMode(page, options.visualMode);
  const state = await page.evaluate(visualStateExpression(viewport, options.visualMode));
  assertVisualModeState(state, viewport, options.visualMode);
  if (pageErrors.length) throw new Error(`Visual page errors: ${pageErrors.join("; ")}`);
  const modePart = options.visualMode === "empty" ? "" : `-${options.visualMode}`;
  const outputPath = path.join(options.outputDir, `tinyrustlm-ui-lock${modePart}-${viewport.name}.png`);
  const bytes = await page.screenshot({ type: "png", fullPage: false });
  fs.writeFileSync(outputPath, bytes, { flag: "wx" });
  return {
    viewport: viewport.name, width: viewport.width, height: viewport.height,
    screenshot: outputPath, screenshot_sha256: sha256(bytes), screenshot_bytes: bytes.length,
    ui_signature_sha256: sha256(JSON.stringify(state.signatureFields)), state, page_errors: pageErrors,
    browser_version: context.browser().version(), device_scale_factor: 1,
    color_scheme: "dark", locale: "en-US", timezone: "UTC", font_status: "loaded"
  };
}

/** Hash exact binary output or UTF-8 signature text. */
function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** Require the chosen mode, completed turns and unobstructed composer geometry. */
function assertVisualModeState(state, viewport, visualMode) {
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
  if (fields.completedAssistantCount !== expectedMessages / 2) {
    throw new Error(`${viewport.name} conversation contains an incomplete or failed assistant turn`);
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

/** Read presentation and completed-conversation state without mutating the app. */
function visualStateExpression(viewport, visualMode) {
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
      completedAssistantCount: document.querySelectorAll(".message-assistant[data-status='completed']:not(.error)").length,
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

/** Compare the existing field/geometry policy; this is not a pixel-equality claim. */
function compareSignatureFields(viewport, expected, actual, failures) {
  const prefix = `${viewport} UI signature`;
  const exactFields = [
    "viewport",
    "conversationMode",
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
  for (const key of ["leftSidebar", "mainWorkspace", "advancedOptionsPanel", "modelToolbar", "composerPanel", "conversationPanel"]) {
    const expectedRect = expectedRects[key];
    const actualRect = actualRects[key];
    if (!expectedRect || !actualRect) {
      failures.push(`${prefix} ${key} rect missing`);
      continue;
    }
    for (const dimension of ["x", "y", "width", "height"]) {
      if (!Number.isFinite(expectedRect[dimension]) || !Number.isFinite(actualRect[dimension]) ||
          Math.abs(expectedRect[dimension] - actualRect[dimension]) > rectTolerance) {
        failures.push(
          `${prefix} ${key}.${dimension} changed beyond ${rectTolerance}px: expected ${expectedRect[dimension]}, actual ${actualRect[dimension]}`
        );
      }
    }
  }
}


/** Require both full viewport records; missing evidence or a different mode cannot pass. */
function compareBaseline(report, baseline) {
  const failures = [];
  if (report.conversation_mode !== baseline.conversation_mode) failures.push("Baseline conversation mode differs");
  if (baseline.comparison_policy !== comparisonPolicy || report.comparison_policy !== comparisonPolicy) {
    failures.push("Baseline comparison policy differs");
  }
  for (const source of [report, baseline]) {
    if (!Array.isArray(source.captures) || source.captures.length !== viewports.length ||
        viewports.some((v) => source.captures.filter((c) => c.viewport === v.name).length !== 1)) {
      failures.push("Report and baseline must each contain exactly desktop and mobile");
      return failures;
    }
  }
  for (const capture of report.captures) {
    const expected = baseline.captures.find((item) => item.viewport === capture.viewport);
    if (capture.width !== expected.width || capture.height !== expected.height) {
      failures.push(`${capture.viewport} viewport dimensions differ`);
    }
    for (const record of [capture, expected]) {
      if (!record.state?.requiredShellPresent || !record.state.signatureFields ||
          !/^[a-f0-9]{64}$/.test(record.screenshot_sha256) ||
          !Number.isSafeInteger(record.screenshot_bytes) || record.screenshot_bytes < 4096) {
        failures.push(`${capture.viewport} complete shell/signature/screenshot evidence is required`);
      }
    }
    if (expected.state?.signatureFields && capture.state?.signatureFields) {
      compareSignatureFields(capture.viewport, expected.state.signatureFields, capture.state.signatureFields, failures);
    }
  }
  return failures;
}

/** Run an explicit capture, preserving failed comparisons and never overwriting earlier evidence. */
async function runCapture(options) {
  const files = options.visualMode === "empty" ? [] : compositionFiles(options.compositionDir);
  const baseline = options.baselinePath
    ? JSON.parse(readBoundedFile(options.baselinePath, 1024 * 1024).toString("utf8")) : null;
  requireCanonicalArtifactPath(options.outputDir);
  const modePart = options.visualMode === "empty" ? "" : `-${options.visualMode}`;
  const reportPath = path.join(options.outputDir, `tinyrustlm-ui-lock${modePart}-report.json`);
  const outputs = [reportPath, ...viewports.map((v) =>
    path.join(options.outputDir, `tinyrustlm-ui-lock${modePart}-${v.name}.png`))];
  if (outputs.some((file) => fs.lstatSync(file, { throwIfNoEntry: false }))) {
    throw new Error("Visual evidence already exists; choose a new output directory");
  }
  fs.mkdirSync(options.outputDir, { recursive: true });
  const captures = [];
  for (const viewport of viewports) {
    captures.push(await withBrowserProfile(viewport,
      (context) => captureViewport(context, options, viewport, files)));
  }
  const report = {
    schema: "tinyrustlm.ui_visual_lock.v0", app_url: options.appUrl,
    conversation_mode: options.visualMode, generated_utc: new Date().toISOString(),
    comparison_policy: comparisonPolicy, captures
  };
  if (baseline) {
    report.baseline = options.baselinePath;
    report.baseline_failures = compareBaseline(report, baseline);
  }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  if (report.baseline_failures?.length) throw new Error(report.baseline_failures.join("; "));
  return { status: baseline ? "baseline-fields-match" : "captured-without-baseline", report: reportPath };
}

if (require.main === module) {
  runCapture(parseOptions(process.argv.slice(2))).then(
    (result) => console.log(JSON.stringify(result, null, 2)),
    (error) => { console.error(error); process.exitCode = 1; }
  );
}

module.exports = Object.freeze({
  parseOptions, compositionFiles, withBrowserProfile, waitForVisualReady, loadComposition,
  prepareConversationVisualMode, captureViewport, assertVisualModeState, compareBaseline, runCapture
});
