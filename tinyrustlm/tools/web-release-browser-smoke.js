#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { requireCanonicalArtifactPath } = require("./canonical-operation-scratch.js");
const catalogApi = require("../app/minimodel-catalog-v1.js");

const { chromium } = require("@playwright/test");
const playwrightVersion = require("@playwright/test/package.json").version;
const {
  atomicCreateExclusive,
  createOwnedDirectory
} = require("./immutable-publication-files.js");
const {
  validateWebDeploymentManifest
} = require("./web-deployment-manifest.js");

const reportSchema = "tinyrustlm.web_release_browser_smoke.v8";
const canonicalPublicOrigin = "https://tinyrustlm.com";
const viewports = Object.freeze([
  Object.freeze({ name: "desktop", width: 1440, height: 1000 }),
  Object.freeze({ name: "narrow-desktop", width: 900, height: 900 }),
  Object.freeze({ name: "mobile", width: 390, height: 844 })
]);
const routes = Object.freeze([
  Object.freeze({ kind: "application", name: "root", path: "/" }),
  Object.freeze({ kind: "application", name: "app", path: "/app/" }),
  Object.freeze({ kind: "companion-release", name: "companion", path: "/companion/" }),
  Object.freeze({ kind: "release-history", name: "updates", path: "/updates/" })
]);
const maximumErrorEvents = 32;
const maximumNetworkEvents = 1024;
const runtimeManifestPath = "/browser-runtime/tinyrustlm-browser-runtime.wasm.manifest.json";
const runtimeWasmPath = "/browser-runtime/tinyrustlm-browser-runtime.wasm";

/** Bind the browser loader's result to independently hashed publication inputs. */
function verifyRuntimeArtifactProbe(probe, expected) {
  invariant(probe && typeof probe.manifestText === "string" &&
    Buffer.byteLength(probe.manifestText, "utf8") <= 16 * 1024 &&
    probe.byteCount === expected.wasm.byteCount && probe.wasmSha256 === expected.wasm.sha256 &&
    sha256(Buffer.from(probe.manifestText, "utf8")) === expected.manifest.sha256,
  "Browser smoke runtime probe does not match the publication inputs");
  return Object.freeze({ status: "verified", byteCount: expected.wasm.byteCount,
    wasmSha256: expected.wasm.sha256, manifestSha256: expected.manifest.sha256 });
}

/** Attribute only completed, hash-verified probe bodies; preserve every raw failure. */
function classifyCompletedProbeAborts(probe, requests, responses, failures) {
  if (probe === null) return Object.freeze([]);
  invariant(probe?.status === "verified", "Runtime probe byte verification is required");
  const owned = requests.filter(request => request.phase === "runtime-probe");
  invariant(owned.length === 2 && new Set(owned.map(request => request.requestId)).size === 2 &&
    [runtimeManifestPath, runtimeWasmPath].every(pathname => owned.some(request =>
      request.pathname === pathname && request.method === "GET" &&
      Number.isSafeInteger(request.requestId) && request.requestId > 0 &&
      request.target?.urlClass === "expected-origin" &&
      request.target.pathnameClass === "declared-release-path")),
  "Runtime probe request closure is invalid");
  for (const request of owned) {
    const matching = responses.filter(response => response.requestId === request.requestId);
    invariant(matching.length === 1 && matching[0].status === 200 &&
      matching[0].pathname === request.pathname &&
      matching[0].target?.urlClass === "expected-origin" &&
      matching[0].target.pathnameClass === "declared-release-path",
    "Runtime probe response closure is invalid");
  }
  const abort = boundedMessageIdentity("net::ERR_ABORTED");
  const completed = failures.filter(failure => owned.some(request =>
    request.requestId === failure.requestId && failure.method?.value === "GET" &&
    failure.target?.urlClass === "expected-origin" &&
    failure.target.pathnameClass === "declared-release-path" &&
    failure.target.pathname === request.pathname) &&
      failure.failureMessageSha256 === abort.messageSha256 &&
      failure.failureMessageByteCount === abort.messageByteCount);
  invariant(new Set(completed.map(failure => failure.requestId)).size === completed.length,
    "Runtime probe failure events are duplicated");
  return Object.freeze(completed.map(failure => failure.requestId));
}

/** Await both terminal-event promises; requestfailed remains a separate ledger verdict. */
async function settleProbeRequests(completions, timeoutMilliseconds = 30_000) {
  invariant(completions.length === 2 && completions.every(value => typeof value?.then === "function") &&
    Number.isSafeInteger(timeoutMilliseconds) &&
    timeoutMilliseconds > 0 && timeoutMilliseconds <= 30_000,
  "Runtime probe completion options are invalid");
  let timer;
  try {
    await Promise.race([
      Promise.all(completions),
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Runtime probe completion timed out")),
          timeoutMilliseconds);
      })
    ]);
  } finally { clearTimeout(timer); }
}

/** Build fresh, current-schema empty fixtures; no request is sent to MiniModel. */
function declaredCatalogMetadata(now = Date.now()) {
  invariant(Number.isSafeInteger(now) && now >= 0 && now < 8e15,
    "Browser smoke metadata time is invalid");
  const freshness = {
    revision: 1,
    generated_at_utc: new Date(now - 60_000).toISOString().replace(/\.\d{3}Z$/, "Z"),
    valid_until_utc: new Date(now + 60 * 60_000).toISOString().replace(/\.\d{3}Z$/, "Z")
  };
  return Object.freeze([
    Object.freeze({
      url: "https://minimodel.org/catalog/compositions.v1.json",
      body: `${JSON.stringify({
        schema: catalogApi.CATALOG_SCHEMA,
        catalog_id: "tinyrustlm.release-smoke.empty",
        ...freshness,
        project_server_serves_model_bytes: false,
        project_server_proxies_model_bytes: false,
        project_server_runs_inference: false,
        qualification_policy: "exact-current-evidence-required",
        qualification_receipt_schema: catalogApi.QUALIFICATION_RECEIPT_SCHEMA,
        browser_admission_schema: "tinyrustlm.browser-composition-admission/1",
        peer_verification_keys: [],
        revoked_qualification_receipt_ids: [],
        supersessions: [],
        entries: []
      })}\n`
    }),
    Object.freeze({
      url: "https://minimodel.org/catalog/peer-announcements.v1.json",
      body: `${JSON.stringify({
        schema: catalogApi.PEER_SCHEMA,
        feed_id: "tinyrustlm.release-smoke.empty",
        ...freshness,
        project_server_serves_model_bytes: false,
        project_server_proxies_model_bytes: false,
        announcements: []
      })}\n`
    })
  ]);
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function observationInvariant(condition, code, diagnostic) {
  if (condition) return;
  const error = new Error("Browser release observation failed");
  error.code = code;
  error.publicSafeDiagnostic = diagnostic;
  throw error;
}

function boundedErrorCode(error) {
  const code = String(error?.code || "");
  return /^[A-Za-z][A-Za-z0-9_]{1,63}$/.test(code) ? code : "browser_api_failure";
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function requireSourceRevision(value, loopback) {
  const sourceRevision = String(value || "");
  if (sourceRevision === "uncommitted" && loopback) return null;
  invariant(/^[0-9a-f]{40}$/.test(sourceRevision), "Browser smoke source revision is invalid");
  return sourceRevision;
}

function requireBaseUrl(value) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    throw new Error("Browser smoke base URL is invalid");
  }
  const loopback =
    url.protocol === "http:" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  const canonicalPublic =
    url.protocol === "https:" &&
    url.origin === canonicalPublicOrigin &&
    (url.pathname === "/" || url.pathname === "");
  invariant(
    (canonicalPublic || loopback) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash,
    "Browser smoke base URL is outside the allowed release boundary"
  );
  url.pathname = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
  return url;
}

function atomicWriteJson(filePath, value) {
  return atomicCreateExclusive(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function boundedMessageIdentity(value) {
  const text = String(value || "");
  return Object.freeze({
    messageSha256: sha256(text),
    messageByteCount: Buffer.byteLength(text)
  });
}

// Preserves declared UI states while reducing unexpected text to a hash and byte count.
function boundedStateIdentity(value, allowedValues) {
  const text = String(value || "");
  const identity = boundedMessageIdentity(text);
  return Object.freeze({
    stateClass: allowedValues.includes(text) ? "declared" : "unexpected",
    value: allowedValues.includes(text) ? text : null,
    valueSha256: identity.messageSha256,
    valueByteCount: identity.messageByteCount
  });
}

// Keeps the one permitted release method legible and hashes every unexpected value.
function boundedMethodIdentity(value) {
  const text = String(value || "");
  const identity = boundedMessageIdentity(text);
  return Object.freeze({
    methodClass: text === "GET" ? "declared" : "unexpected",
    value: text === "GET" ? text : null,
    valueSha256: identity.messageSha256,
    valueByteCount: identity.messageByteCount
  });
}

function buildAllowedReleaseRequests(validation) {
  const requests = new Map();
  for (const file of validation.files) {
    if (file.remote === ".htaccess") continue;
    const pathname = `/${file.remote}`;
    const expectedSearch = /\.(?:css|js)$/i.test(file.remote)
      ? `?v=sha256-${file.sha256}`
      : "";
    requests.set(pathname, Object.freeze({
      kind: "release-file",
      expectedSearch,
      pathname
    }));
  }
  for (const pathname of ["/", "/app/", "/companion/", "/updates/"]) {
    requests.set(pathname, Object.freeze({
      kind: "release-file",
      expectedSearch: "",
      pathname
    }));
  }
  for (const metadata of declaredCatalogMetadata()) {
    const url = new URL(metadata.url);
    requests.set(url.href, Object.freeze({
      kind: "catalog-metadata",
      expectedSearch: "",
      pathname: url.pathname,
      body: metadata.body
    }));
  }
  return requests;
}

function boundedUrlIdentity(value, expectedOrigin, allowedRequests) {
  const rawValue = String(value || "");
  let url;
  try {
    url = new URL(rawValue);
  } catch {
    const identity = boundedMessageIdentity(rawValue);
    return Object.freeze({
      urlClass: "invalid",
      urlSha256: identity.messageSha256,
      urlByteCount: identity.messageByteCount
    });
  }
  const originIdentity = boundedMessageIdentity(url.origin);
  const pathnameIdentity = boundedMessageIdentity(url.pathname);
  const searchIdentity = boundedMessageIdentity(url.search);
  const absoluteRequest = allowedRequests.get(url.href);
  const sameOriginRequest = url.origin === expectedOrigin
    ? allowedRequests.get(url.pathname)
    : null;
  const declaredRequest = absoluteRequest || sameOriginRequest;
  const declaredMetadata = declaredRequest?.kind === "catalog-metadata";
  const knownPath = Boolean(declaredRequest);
  const modelByteLike =
    url.pathname.toLowerCase().includes("/models/") ||
    url.pathname.toLowerCase().endsWith(".slm");
  return Object.freeze({
    urlClass: declaredMetadata
      ? "declared-metadata-origin"
      : url.origin === expectedOrigin
        ? "expected-origin"
        : "unexpected-origin",
    originSha256: originIdentity.messageSha256,
    originByteCount: originIdentity.messageByteCount,
    pathnameClass: modelByteLike
      ? "model-byte-like"
      : knownPath
        ? declaredMetadata
          ? "declared-metadata-path"
          : "declared-release-path"
        : "undeclared-path",
    pathname: knownPath ? url.pathname : null,
    pathnameSha256: pathnameIdentity.messageSha256,
    pathnameByteCount: pathnameIdentity.messageByteCount,
    searchPresent: Boolean(url.search),
    searchSha256: searchIdentity.messageSha256,
    searchByteCount: searchIdentity.messageByteCount
  });
}

function classifyReleaseRequest(value, method, expectedOrigin, allowedRequests) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    return Object.freeze({
      allowed: false,
      reason: "invalid-url",
      identity: boundedUrlIdentity(value, expectedOrigin, allowedRequests)
    });
  }
  const absoluteRequest = allowedRequests.get(url.href);
  const sameOriginRequest = url.origin === expectedOrigin
    ? allowedRequests.get(url.pathname)
    : null;
  const releaseRequest = absoluteRequest || sameOriginRequest;
  let reason = null;
  if (!releaseRequest && url.origin !== expectedOrigin) reason = "unexpected-origin";
  else if (method !== "GET") reason = "unexpected-method";
  else if (url.username || url.password || url.hash) reason = "credential-or-fragment";
  else if (!releaseRequest) reason = "undeclared-path";
  else if (url.search !== releaseRequest.expectedSearch) reason = "unexpected-query";
  return Object.freeze({
    allowed: reason === null,
    reason,
    request: reason === null ? releaseRequest : null,
    identity: boundedUrlIdentity(url.href, expectedOrigin, allowedRequests)
  });
}

function boundedConsoleIdentity(message, expectedOrigin, allowedRequests) {
  const identity = boundedMessageIdentity(message.text());
  return Object.freeze({
    ...identity,
    location: boundedUrlIdentity(
      message.location()?.url || "",
      expectedOrigin,
      allowedRequests
    )
  });
}

function pushBounded(values, value, maximum) {
  if (values.length < maximum) values.push(value);
}

/** Observe the deferred empty UI before independently probing the downloadable runtime. */
async function runPageObservation(
  browser,
  baseUrl,
  route,
  viewport,
  outputDirectory,
  allowedRequests,
  expectedRelease
) {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const blockedRequests = [];
  const requests = [];
  const responses = [];
  const requestIds = new WeakMap();
  const probeCompletions = new Map();
  let runtimeProbeActive = false;
  let consoleErrorCount = 0;
  let pageErrorCount = 0;
  let failedRequestCount = 0;
  let blockedRequestCount = 0;
  let requestCount = 0;
  let responseCount = 0;
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    reducedMotion: "reduce",
    serviceWorkers: "block"
  });
  await context.route("**/*", async (routeOperation) => {
    const request = routeOperation.request();
    const classification = classifyReleaseRequest(
      request.url(),
      request.method(),
      baseUrl.origin,
      allowedRequests
    );
    if (classification.allowed) {
      if (classification.request.kind === "catalog-metadata") {
        await routeOperation.fulfill({
          status: 200,
          contentType: "application/json; charset=utf-8",
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store"
          },
          body: classification.request.body
        });
        return;
      }
      await routeOperation.continue();
      return;
    }
    blockedRequestCount += 1;
    pushBounded(blockedRequests, Object.freeze({
      method: boundedMethodIdentity(request.method()),
      reason: classification.reason,
      target: classification.identity
    }), maximumErrorEvents);
    await routeOperation.abort("blockedbyclient");
  });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrorCount += 1;
      pushBounded(
        consoleErrors,
        boundedConsoleIdentity(message, baseUrl.origin, allowedRequests),
        maximumErrorEvents
      );
    }
  });
  page.on("pageerror", (error) => {
    pageErrorCount += 1;
    pushBounded(pageErrors, boundedMessageIdentity(error.message), maximumErrorEvents);
  });
  page.on("request", (request) => {
    requestCount += 1;
    requestIds.set(request, requestCount);
    if (runtimeProbeActive && probeCompletions.size < maximumNetworkEvents) {
      const completion = Promise.withResolvers();
      probeCompletions.set(request, completion);
    }
    const url = new URL(request.url());
    pushBounded(requests, Object.freeze({
      requestId: requestCount,
      phase: runtimeProbeActive ? "runtime-probe" : "application",
      method: request.method(),
      origin: url.origin,
      pathname: url.pathname,
      target: boundedUrlIdentity(request.url(), baseUrl.origin, allowedRequests)
    }), maximumNetworkEvents);
  });
  page.on("requestfinished", request => { probeCompletions.get(request)?.resolve(); });
  page.on("requestfailed", (request) => {
    failedRequestCount += 1;
    const failureIdentity = boundedMessageIdentity(
      request.failure()?.errorText || "unknown"
    );
    pushBounded(failedRequests, Object.freeze({
      requestId: requestIds.get(request),
      method: boundedMethodIdentity(request.method()),
      target: boundedUrlIdentity(request.url(), baseUrl.origin, allowedRequests),
      failureMessageSha256: failureIdentity.messageSha256,
      failureMessageByteCount: failureIdentity.messageByteCount
    }), maximumErrorEvents);
    probeCompletions.get(request)?.resolve();
  });
  page.on("response", (response) => {
    responseCount += 1;
    const url = new URL(response.url());
    pushBounded(responses, Object.freeze({
      requestId: requestIds.get(response.request()),
      origin: url.origin,
      pathname: url.pathname,
      target: boundedUrlIdentity(response.url(), baseUrl.origin, allowedRequests),
      status: response.status()
    }), maximumNetworkEvents);
  });

  try {
    const target = new URL(route.path.replace(/^\/+/, ""), baseUrl);
    await page.goto(target.href, { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (route.kind === "application") {
      await page.locator("#wasmState").waitFor({ state: "attached", timeout: 10_000 });
      await page.waitForFunction(
        () => {
          const list = document.getElementById("simpleModelList");
          return list?.getAttribute("aria-busy") === "false" &&
            list.textContent.trim() === "No models are listed yet.";
        },
        null,
        { timeout: 30_000 }
      );
      await page.locator('#simpleModelList[aria-busy="false"]').waitFor({
        state: "attached",
        timeout: 30_000
      });
      observationInvariant(
        (await page.locator("#simpleModelList").textContent()).trim() === "No models are listed yet.",
        "catalog_empty_state_mismatch",
        { expectedCatalogState: "verified-empty" }
      );
    }
    await page.waitForFunction(
      () => Array.from(document.querySelectorAll("[data-site-release]")).some((node) => {
        const rect = node.getBoundingClientRect();
        return node.dataset.releaseState === "verified" && rect.width > 0 && rect.height > 0;
      }),
      null,
      { timeout: 30_000 }
    );
    await page.waitForTimeout(250);

    const state = await page.evaluate(() => {
      const composer = document.querySelector(".composer-panel");
      const appShell = document.querySelector("main.app-shell");
      const buttonNames = Array.from(document.querySelectorAll("button")).map((button) =>
        (
          button.getAttribute("aria-label") ||
          button.textContent ||
          button.getAttribute("title") ||
          ""
        ).trim()
      );
      const visibleText = document.body?.innerText || "";
      const releaseSurface = Array.from(document.querySelectorAll("[data-site-release]"))
        .find((node) => {
          const rect = node.getBoundingClientRect();
          return node.dataset.releaseState === "verified" && rect.width > 0 && rect.height > 0;
        });
      const releaseRect = releaseSurface?.getBoundingClientRect();
      const releaseVersion = releaseSurface?.querySelector("[data-release-version]");
      const releaseDate = releaseSurface?.querySelector("[data-release-date]");
      const releasePublishedAt = releaseSurface?.querySelector("[data-release-published-at]");
      const companionPackageStatus = document.querySelector("#companionPackageStatus");
      const companionDeploymentStatus = document.querySelector("#companionDeploymentStatus");
      const companionPackageLinkPresent = Array.from(
        document.querySelectorAll("a[href]")
      ).some((anchor) => {
        try {
          const target = new URL(anchor.href);
          const hostname = target.hostname.toLowerCase();
          return (hostname === "nuget.org" || hostname.endsWith(".nuget.org")) &&
            target.pathname.toLowerCase().startsWith("/packages/uaix.browser");
        } catch {
          return false;
        }
      });
      const companionInstallCommandPresent =
        /dotnet\s+(?:add\s+package|tool\s+install)/iu.test(
          document.documentElement.textContent || ""
        );
      return {
        appShellPresent: Boolean(appShell),
        browserModelAdmissionPresent: Boolean(window.TinyRustLMBrowserModelAdmission),
        browserRuntimeLoaderPresent: Boolean(window.TinyRustLMBrowserRuntimeLoader),
        operationLifetimePresent: Boolean(window.TinyRustLMOperationLifetime),
        prompt2RequestPresent: Boolean(window.TinyRustLMPrompt2Request),
        modelRuntimeClientPresent: Boolean(window.TinyRustLMModelRuntimeClient),
        memoryEnrollmentPresent: Boolean(window.TinyRustLMMemoryEndpointsEnrollment),
        runtimeVariant: document.documentElement.dataset.runtimeVariant || "",
        wasmState: document.getElementById("wasmState")?.textContent?.trim() || "",
        generateDisabled: document.getElementById("generateButton")?.disabled === true,
        modelLoadState: document.getElementById("modelLoadPill")?.textContent?.trim() || "",
        releaseSurfacePresent: Boolean(releaseSurface),
        releaseState: releaseSurface?.dataset.releaseState || "",
        releaseVersion: releaseVersion?.textContent?.trim() || "",
        releaseDate: releaseDate?.textContent?.trim() || "",
        releasePublishedAt: releasePublishedAt?.dateTime || "",
        releaseSurfaceRect: releaseRect
          ? {
              left: releaseRect.left,
              right: releaseRect.right,
              top: releaseRect.top,
              bottom: releaseRect.bottom,
              width: releaseRect.width,
              height: releaseRect.height
            }
          : null,
        releaseSurfaceContentOverflowPixels: releaseSurface
          ? Math.max(
              0,
              releaseSurface.scrollWidth - releaseSurface.clientWidth,
              releaseSurface.scrollHeight - releaseSurface.clientHeight
            )
          : null,
        releaseEntryCount: document.querySelectorAll(".release-entry").length,
        companionPackagePending:
          companionPackageStatus?.textContent?.trim() === "Public package pending",
        companionDeploymentBlocked:
          companionDeploymentStatus?.textContent?.trim() === "Deployment blocked",
        companionPackageLinkPresent,
        companionInstallCommandPresent,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        visibleTextByteCount: new TextEncoder().encode(visibleText).length,
        unnamedButtonCount: buttonNames.filter((name) => !name).length,
        composerRect: composer
          ? {
              left: composer.getBoundingClientRect().left,
              right: composer.getBoundingClientRect().right,
              top: composer.getBoundingClientRect().top,
              bottom: composer.getBoundingClientRect().bottom,
              width: composer.getBoundingClientRect().width,
              height: composer.getBoundingClientRect().height
            }
          : null
      };
    });

    const startupRuntimeRequestCount = requests.filter(request =>
      request.pathname === runtimeManifestPath || request.pathname === runtimeWasmPath).length;
    let runtimeArtifactProbe = null;
    if (route.kind === "application") {
      observationInvariant(startupRuntimeRequestCount === 0, "unexpected_startup_runtime_request",
        { startupRuntimeRequestCount });
      // This calls the loader directly, without marking the app ready or creating a worker.
      runtimeProbeActive = true;
      const probe = await page.evaluate(async ({ manifestUrl, wasmUrl }) => {
        const api = window.TinyRustLMBrowserRuntimeLoader;
        const asset = await api.load({ manifestUrl, wasmUrl,
          fetchFunction: window.fetch.bind(window), timeoutMilliseconds: 30_000 });
        try {
          const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", asset.wasmBytes));
          return { manifestText: api.serializeManifest(asset.manifest),
            byteCount: asset.wasmBytes.byteLength,
            wasmSha256: Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("") };
        } finally { new Uint8Array(asset.wasmBytes).fill(0); }
      }, { manifestUrl: runtimeManifestPath, wasmUrl: runtimeWasmPath });
      runtimeArtifactProbe = verifyRuntimeArtifactProbe(probe, expectedRelease.runtimeArtifacts);
      await settleProbeRequests(Array.from(probeCompletions.values(), entry => entry.promise));
      runtimeProbeActive = false;
    }
    const screenshotName = `${route.name}-${viewport.name}.png`;
    const screenshotPath = path.join(outputDirectory, screenshotName);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    const screenshotBytes = fs.readFileSync(screenshotPath);
    const completedProbeAbortRequestIds = classifyCompletedProbeAborts(
      runtimeArtifactProbe, requests, responses, failedRequests);
    const unexpectedFailedRequestCount = failedRequestCount - completedProbeAbortRequestIds.length;
    const expectedOrigin = baseUrl.origin;
    const unexpectedOriginValues = Array.from(new Set(
      requests
        .filter((request) => request.target.urlClass === "unexpected-origin")
        .map((request) => request.origin)
    )).sort();
    const declaredMetadataRequestCount = requests.filter(
      (request) => request.target.urlClass === "declared-metadata-origin"
    ).length;
    const declaredMetadataResponseCount = responses.filter(
      (response) => response.target.urlClass === "declared-metadata-origin"
    ).length;
    const unexpectedOrigins = unexpectedOriginValues.map((origin) => {
      const identity = boundedMessageIdentity(origin);
      return Object.freeze({
        originSha256: identity.messageSha256,
        originByteCount: identity.messageByteCount
      });
    });
    const modelByteRequests = requests.filter(
      (request) => request.pathname.toLowerCase().includes("/models/") ||
        request.pathname.toLowerCase().endsWith(".slm")
    );
    const unexpectedHttpResponses = responses.filter(
      (response) => response.status >= 400
    );
    const diagnostic = Object.freeze({
      route: route.name,
      surfaceKind: route.kind,
      viewport: viewport.name,
      blockedRequestCount,
      blockedRequests: Object.freeze(blockedRequests.slice()),
      consoleErrorCount,
      consoleErrors: Object.freeze(consoleErrors.slice()),
      pageErrorCount,
      pageErrors: Object.freeze(pageErrors.slice()),
      failedRequestCount,
      failedRequests: Object.freeze(failedRequests.slice()),
      completedProbeAbortRequestIds,
      unexpectedFailedRequestCount,
      requestCount,
      responseCount,
      declaredMetadataRequestCount,
      declaredMetadataResponseCount,
      unexpectedOrigins: Object.freeze(unexpectedOrigins),
      modelByteRequestTargets: Object.freeze(
        modelByteRequests.slice(0, maximumErrorEvents).map((request) => request.target)
      ),
      unexpectedHttpResponses: Object.freeze(
        unexpectedHttpResponses.slice(0, maximumErrorEvents).map((response) =>
          Object.freeze({ status: response.status, target: response.target })
        )
      ),
      wasmState: boundedStateIdentity(state.wasmState, ["waiting"]),
      runtimeVariant: boundedStateIdentity(state.runtimeVariant, [""]),
      startupRuntimeRequestCount,
      runtimeArtifactProbe,
      generateDisabled: state.generateDisabled,
      modelLoadState: boundedStateIdentity(
        state.modelLoadState,
        ["No model imported"]
      ),
      releaseState: boundedStateIdentity(state.releaseState, ["verified"]),
      releaseVersion: boundedStateIdentity(state.releaseVersion, [expectedRelease.version]),
      releaseDate: boundedStateIdentity(state.releaseDate, [expectedRelease.releaseDate]),
      releasePublishedAt: boundedStateIdentity(
        state.releasePublishedAt,
        [expectedRelease.publishedAt]
      ),
      releaseSurfaceContentOverflowPixels: state.releaseSurfaceContentOverflowPixels,
      companionPackageLinkPresent: state.companionPackageLinkPresent,
      companionInstallCommandPresent: state.companionInstallCommandPresent,
      companionPackagePending: state.companionPackagePending,
      companionDeploymentBlocked: state.companionDeploymentBlocked,
      releaseSurfaceViewportOverflowPixels: state.releaseSurfaceRect
        ? Math.max(
            0,
            -state.releaseSurfaceRect.left,
            state.releaseSurfaceRect.right - state.viewportWidth,
            -state.releaseSurfaceRect.top,
            state.releaseSurfaceRect.bottom - state.viewportHeight
          )
        : null,
      unnamedButtonCount: state.unnamedButtonCount,
      horizontalOverflowPixels: Math.max(0, state.documentWidth - state.viewportWidth),
      composerVerticalOverflowPixels: state.composerRect
        ? Math.max(
            0,
            -state.composerRect.top,
            state.composerRect.bottom - state.viewportHeight
          )
        : null
    });

    observationInvariant(
      requestCount <= maximumNetworkEvents && responseCount <= maximumNetworkEvents,
      "network_event_limit_exceeded",
      diagnostic
    );
    observationInvariant(
      blockedRequestCount === 0,
      "blocked_network_request",
      diagnostic
    );
    observationInvariant(consoleErrorCount === 0, "console_error", diagnostic);
    observationInvariant(pageErrorCount === 0, "page_error", diagnostic);
    observationInvariant(unexpectedFailedRequestCount === 0, "request_failed", diagnostic);
    observationInvariant(
      declaredMetadataRequestCount === (route.kind === "application" ? 2 : 0),
      "catalog_metadata_request_mismatch",
      diagnostic
    );
    observationInvariant(
      declaredMetadataResponseCount === declaredMetadataRequestCount,
      "catalog_metadata_response_mismatch",
      diagnostic
    );
    observationInvariant(
      unexpectedOriginValues.length === 0,
      "unexpected_origin",
      diagnostic
    );
    observationInvariant(modelByteRequests.length === 0, "model_byte_request", diagnostic);
    observationInvariant(
      unexpectedHttpResponses.length === 0,
      "unexpected_http_error",
      diagnostic
    );
    observationInvariant(
      state.documentWidth <= state.viewportWidth + 1,
      "horizontal_page_overflow",
      diagnostic
    );
    observationInvariant(
      state.visibleTextByteCount >= 256,
      "insufficient_visible_text",
      diagnostic
    );
    observationInvariant(state.unnamedButtonCount === 0, "unnamed_button", diagnostic);
    observationInvariant(state.releaseSurfacePresent, "release_surface_missing", diagnostic);
    observationInvariant(state.releaseState === "verified", "release_record_unverified", diagnostic);
    observationInvariant(
      state.releaseVersion === expectedRelease.version,
      "release_version_mismatch",
      diagnostic
    );
    observationInvariant(
      state.releaseDate === expectedRelease.releaseDate,
      "release_date_mismatch",
      diagnostic
    );
    observationInvariant(
      state.releasePublishedAt === expectedRelease.publishedAt,
      "release_publication_mismatch",
      diagnostic
    );
    observationInvariant(
      state.releaseSurfaceContentOverflowPixels === 0,
      "release_surface_content_clipped",
      diagnostic
    );
    observationInvariant(
      state.releaseSurfaceRect &&
        state.releaseSurfaceRect.left >= -1 &&
        state.releaseSurfaceRect.right <= state.viewportWidth + 1 &&
        state.releaseSurfaceRect.top >= -1 &&
        state.releaseSurfaceRect.bottom <= state.viewportHeight + 1,
      "release_surface_outside_viewport",
      diagnostic
    );
    if (route.kind === "application") {
      observationInvariant(state.appShellPresent, "app_shell_missing", diagnostic);
      observationInvariant(
        state.browserModelAdmissionPresent &&
          state.browserRuntimeLoaderPresent &&
          state.operationLifetimePresent &&
          state.prompt2RequestPresent &&
          state.modelRuntimeClientPresent &&
          state.memoryEnrollmentPresent,
        "required_browser_module_missing",
        diagnostic
      );
      observationInvariant(state.wasmState === "waiting", "runtime_not_deferred", diagnostic);
      observationInvariant(
        state.runtimeVariant === "",
        "runtime_variant_invalid",
        diagnostic
      );
      observationInvariant(state.generateDisabled, "generation_without_model", diagnostic);
      observationInvariant(
        state.modelLoadState === "No model imported",
        "unsupported_model_claim",
        diagnostic
      );
      observationInvariant(
        state.composerRect &&
          state.composerRect.width > 0 &&
          state.composerRect.height > 0 &&
          state.composerRect.left >= -1 &&
          state.composerRect.right <= state.viewportWidth + 1 &&
          state.composerRect.top >= -1 &&
          state.composerRect.bottom <= state.viewportHeight + 1,
        "composer_outside_viewport",
        diagnostic
      );
    } else if (route.kind === "release-history") {
      observationInvariant(
        state.releaseEntryCount === expectedRelease.historyEntryCount,
        "release_history_count_mismatch",
        diagnostic
      );
    } else {
      observationInvariant(
        route.kind === "companion-release" && state.companionPackagePending,
        "companion_package_pending_status_missing",
        diagnostic
      );
      observationInvariant(
        state.companionDeploymentBlocked,
        "companion_deployment_blocked_status_missing",
        diagnostic
      );
      observationInvariant(
        !state.companionPackageLinkPresent,
        "companion_unpublished_package_link_present",
        diagnostic
      );
      observationInvariant(
        !state.companionInstallCommandPresent,
        "companion_unpublished_install_command_present",
        diagnostic
      );
    }

    return Object.freeze({
      route: route.name,
      surfaceKind: route.kind,
      pathname: target.pathname,
      viewport: Object.freeze({ width: viewport.width, height: viewport.height }),
      runtimeVariant: route.kind === "application" ? state.runtimeVariant : null,
      wasmState: route.kind === "application" ? state.wasmState : null,
      startupRuntimeRequestCount,
      runtimeArtifactProbe,
      generateDisabled: route.kind === "application" ? state.generateDisabled : null,
      modelLoadState: route.kind === "application" ? state.modelLoadState : null,
      releaseState: state.releaseState,
      releaseVersion: state.releaseVersion,
      releaseDate: state.releaseDate,
      releasePublishedAt: state.releasePublishedAt,
      releaseSurfaceContentOverflowPixels: state.releaseSurfaceContentOverflowPixels,
      releaseSurfaceViewportOverflowPixels: diagnostic.releaseSurfaceViewportOverflowPixels,
      releaseEntryCount: route.kind === "release-history" ? state.releaseEntryCount : null,
      companionPackagePending: route.kind === "companion-release"
        ? state.companionPackagePending
        : null,
      companionDeploymentBlocked: route.kind === "companion-release"
        ? state.companionDeploymentBlocked
        : null,
      companionPackageLinkPresent: route.kind === "companion-release"
        ? state.companionPackageLinkPresent
        : null,
      companionInstallCommandPresent: route.kind === "companion-release"
        ? state.companionInstallCommandPresent
        : null,
      requestCount,
      responseCount,
      declaredMetadataRequestCount,
      declaredMetadataResponseCount,
      blockedRequestCount,
      unexpectedOriginCount: unexpectedOriginValues.length,
      failedRequestCount,
      failedRequests: diagnostic.failedRequests,
      completedProbeAbortRequestIds,
      unexpectedFailedRequestCount,
      consoleErrorCount,
      pageErrorCount,
      unnamedButtonCount: state.unnamedButtonCount,
      horizontalOverflowPixels: Math.max(0, state.documentWidth - state.viewportWidth),
      composerVerticalOverflowPixels: state.composerRect
        ? Math.max(0, -state.composerRect.top, state.composerRect.bottom - state.viewportHeight)
        : null,
      screenshot: Object.freeze({
        fileName: screenshotName,
        byteCount: screenshotBytes.length,
        sha256: sha256(screenshotBytes)
      })
    });
  } catch (error) {
    // A failed byte probe has no success diagnostic, but must retain observed failures.
    if (!error.publicSafeDiagnostic) {
      error.publicSafeDiagnostic = Object.freeze({
        route: route.name, surfaceKind: route.kind, viewport: viewport.name,
        requestCount, responseCount, failedRequestCount,
        failedRequests: Object.freeze(failedRequests.slice()),
        consoleErrorCount, consoleErrors: Object.freeze(consoleErrors.slice()),
        pageErrorCount, pageErrors: Object.freeze(pageErrors.slice())
      });
    }
    throw error;
  } finally {
    await context.close();
  }
}

/** Run with inherited canonical scratch so Playwright cannot scatter profiles. */
async function runWebReleaseBrowserSmoke(options) {
  invariant(options && typeof options === "object",
    "Browser smoke options are required");
  const baseUrl = requireBaseUrl(options.baseUrl);
  const loopback = baseUrl.protocol === "http:";
  const sourceRevision = requireSourceRevision(options.sourceRevision, loopback);
  const outputValue = String(options.outputDirectory || "");
  invariant(path.isAbsolute(outputValue), "Browser smoke output directory must be absolute");
  const outputDirectory = path.resolve(outputValue);
  requireCanonicalArtifactPath(outputDirectory);
  const releaseValidation = validateWebDeploymentManifest({
    siteRoot: options.siteRoot,
    manifestPath: options.manifestPath,
    generatedRoot: options.generatedRoot
  });
  const allowedRequests = buildAllowedReleaseRequests(releaseValidation);
  const expectedRelease = Object.freeze({
    version: releaseValidation.currentRelease.version,
    releaseDate: releaseValidation.currentRelease.releaseDate,
    publishedAt: releaseValidation.currentRelease.publishedAt,
    historyEntryCount: releaseValidation.releaseHistory.releases.length,
    runtimeArtifacts: Object.freeze({
      wasm: releaseValidation.files.find(file => file.remote === runtimeWasmPath.slice(1)),
      manifest: releaseValidation.files.find(file => file.remote === runtimeManifestPath.slice(1))
    })
  });
  invariant(!fs.existsSync(outputDirectory), "Owned publication directory already exists");
  // The CLI runner sets these before Playwright loads or creates any profile.
  requireCanonicalArtifactPath(os.tmpdir());
  for (const name of ["TEMP", "TMP", "TMPDIR"]) {
    requireCanonicalArtifactPath(process.env[name]);
  }
  createOwnedDirectory(outputDirectory);
  const startedAtUtc = new Date().toISOString();
  let browser = null;
  let browserVersion = null;
  let browserClosed = null;
  const observations = [];
  let operation = "browser-launch";
  let operationError = null;
  try {
    browser = await chromium.launch({
      headless: true,
      channel: process.env.TINYRUSTLM_PLAYWRIGHT_CHANNEL || undefined
    });
    browserVersion = browser.version();
    browserClosed = false;
    for (const route of routes) {
      for (const viewport of viewports) {
        operation = `observe-${route.name}-${viewport.name}`;
        observations.push(
          await runPageObservation(
            browser,
            baseUrl,
            route,
            viewport,
            outputDirectory,
            allowedRequests,
            expectedRelease
          )
        );
      }
    }
    operation = "browser-close";
  } catch (error) {
    operationError = error;
  }
  if (browser) {
    try {
      await browser.close();
      browserClosed = true;
    } catch (error) {
      browserClosed = false;
      if (!operationError) operationError = error;
    }
  }
  const status =
    !operationError &&
    browserClosed === true &&
    observations.length === routes.length * viewports.length
      ? "pass"
      : "fail";
  const report = Object.freeze({
    schema: reportSchema,
    status,
    startedAtUtc,
    completedAtUtc: new Date().toISOString(),
    evidenceClass: sourceRevision ? "committed-release-smoke" : "local-uncommitted-smoke",
    sourceRevision,
    publicOrigin: baseUrl.origin,
    browserName: "chromium",
    browserVersion,
    playwrightVersion,
    browserClosed,
    failureType: operationError?.constructor?.name || null,
    failureDetailCode: operationError ? boundedErrorCode(operationError) : null,
    failureDiagnostic: operationError?.publicSafeDiagnostic || null,
    failureCode: status === "fail"
      ? `browser_smoke_${operation.replaceAll("-", "_")}_failed`
      : null,
    lastOperation: status === "pass" ? "complete" : operation,
    serviceWorkersBlocked: true,
    networkPolicy: "exact-release-and-catalog-metadata-closure-deny-before-send",
    catalogMode: "intercepted-current-empty-fixture",
    allowedRequestTargetCount: allowedRequests.size,
    reducedMotion: "reduce",
    routeCount: routes.length,
    viewportCount: viewports.length,
    observationCount: observations.length,
    observations: Object.freeze(observations)
  });
  const reportPath = atomicWriteJson(path.join(outputDirectory, "browser-smoke-report.json"), report);
  if (operationError) {
    const error = new Error("Browser smoke observation failed");
    error.code = "BROWSER_SMOKE_FAILED";
    throw error;
  }
  invariant(status === "pass", "Browser smoke did not retain complete observations");
  return Object.freeze({ report, reportPath, reportSha256: sha256(fs.readFileSync(reportPath)) });
}

async function main() {
  const [baseUrl, outputDirectory, sourceRevision, generatedRoot, ...extra] =
    process.argv.slice(2);
  invariant(
    baseUrl && outputDirectory && sourceRevision && generatedRoot && !extra.length,
    "Usage: web-release-browser-smoke.js <base-url> <output-directory> " +
      "<source-revision> <generated-release-root>"
  );
  const result = await runWebReleaseBrowserSmoke({
    baseUrl,
    outputDirectory,
    sourceRevision,
    generatedRoot
  });
  process.stdout.write(`${JSON.stringify({
    schema: reportSchema,
    status: result.report.status,
    observationCount: result.report.observationCount,
    reportSha256: result.reportSha256
  })}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write("TinyRustLM web release browser smoke failed\n");
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  boundedMethodIdentity,
  boundedStateIdentity,
  boundedUrlIdentity,
  buildAllowedReleaseRequests,
  canonicalPublicOrigin,
  classifyReleaseRequest,
  declaredCatalogMetadata,
  reportSchema,
  requireBaseUrl,
  requireSourceRevision,
  runWebReleaseBrowserSmoke,
  verifyRuntimeArtifactProbe,
  classifyCompletedProbeAborts,
  settleProbeRequests
});
