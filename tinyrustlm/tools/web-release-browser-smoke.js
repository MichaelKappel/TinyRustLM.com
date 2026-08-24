#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { chromium } = require("@playwright/test");
const playwrightVersion = require("@playwright/test/package.json").version;
const {
  atomicCreateExclusive,
  createOwnedDirectory
} = require("./immutable-publication-files.js");
const {
  validateWebDeploymentManifest
} = require("./web-deployment-manifest.js");

const reportSchema = "tinyrustlm.web_release_browser_smoke.v4";
const canonicalPublicOrigin = "https://tinyrustlm.com";
const viewports = Object.freeze([
  Object.freeze({ name: "desktop", width: 1440, height: 1000 }),
  Object.freeze({ name: "narrow-desktop", width: 900, height: 900 }),
  Object.freeze({ name: "mobile", width: 390, height: 844 })
]);
const routes = Object.freeze([
  Object.freeze({ kind: "application", name: "root", path: "/" }),
  Object.freeze({ kind: "application", name: "app", path: "/app/" }),
  Object.freeze({ kind: "companion-install", name: "companion", path: "/companion/" }),
  Object.freeze({ kind: "release-history", name: "updates", path: "/updates/" })
]);
const maximumErrorEvents = 32;
const maximumNetworkEvents = 1024;

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
    ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
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
    requests.set(pathname, Object.freeze({ expectedSearch, pathname }));
  }
  requests.set("/", Object.freeze({ expectedSearch: "", pathname: "/" }));
  requests.set("/app/", Object.freeze({ expectedSearch: "", pathname: "/app/" }));
  requests.set("/companion/", Object.freeze({ expectedSearch: "", pathname: "/companion/" }));
  requests.set("/updates/", Object.freeze({ expectedSearch: "", pathname: "/updates/" }));
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
  const knownPath = allowedRequests.has(url.pathname);
  const modelByteLike =
    url.pathname.toLowerCase().includes("/models/") ||
    url.pathname.toLowerCase().endsWith(".slm");
  return Object.freeze({
    urlClass: url.origin === expectedOrigin ? "expected-origin" : "unexpected-origin",
    originSha256: originIdentity.messageSha256,
    originByteCount: originIdentity.messageByteCount,
    pathnameClass: modelByteLike
      ? "model-byte-like"
      : knownPath
        ? "declared-release-path"
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
  const releaseRequest = allowedRequests.get(url.pathname);
  let reason = null;
  if (url.origin !== expectedOrigin) reason = "unexpected-origin";
  else if (method !== "GET") reason = "unexpected-method";
  else if (url.username || url.password || url.hash) reason = "credential-or-fragment";
  else if (!releaseRequest) reason = "undeclared-path";
  else if (url.search !== releaseRequest.expectedSearch) reason = "unexpected-query";
  return Object.freeze({
    allowed: reason === null,
    reason,
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
    const url = new URL(request.url());
    pushBounded(requests, Object.freeze({
      method: request.method(),
      origin: url.origin,
      pathname: url.pathname,
      target: boundedUrlIdentity(request.url(), baseUrl.origin, allowedRequests)
    }), maximumNetworkEvents);
  });
  page.on("requestfailed", (request) => {
    failedRequestCount += 1;
    const failureIdentity = boundedMessageIdentity(
      request.failure()?.errorText || "unknown"
    );
    pushBounded(failedRequests, Object.freeze({
      method: boundedMethodIdentity(request.method()),
      target: boundedUrlIdentity(request.url(), baseUrl.origin, allowedRequests),
      failureMessageSha256: failureIdentity.messageSha256,
      failureMessageByteCount: failureIdentity.messageByteCount
    }), maximumErrorEvents);
  });
  page.on("response", (response) => {
    responseCount += 1;
    const url = new URL(response.url());
    pushBounded(responses, Object.freeze({
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
        () => document.getElementById("wasmState")?.textContent?.trim() === "loaded",
        null,
        { timeout: 30_000 }
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
      const companionPackageLink = document.querySelector(
        'a.package-action[href="https://www.nuget.org/packages/UAIX.Browser.p2pRuntime.SeedHost.Tool/0.3.0"]'
      );
      const companionInstallCommandPresent = Array.from(
        document.querySelectorAll(".command-block code")
      ).some((node) => (
        node.textContent || ""
      ).includes(
        "dotnet tool install UAIX.Browser.p2pRuntime.SeedHost.Tool --version 0.3.0"
      ));
      return {
        appShellPresent: Boolean(appShell),
        browserModelAdmissionPresent: Boolean(window.TinyRustLMBrowserModelAdmission),
        memoryEnrollmentPresent: Boolean(window.TinyRustLMMemoryEndpointsEnrollment),
        runtimeVariant: document.documentElement.dataset.runtimeVariant || "",
        wasmState: document.getElementById("wasmState")?.textContent?.trim() || "",
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
        companionPackageLinkPresent: Boolean(companionPackageLink),
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

    const expectedOrigin = baseUrl.origin;
    const unexpectedOriginValues = Array.from(new Set(
      requests.map((request) => request.origin).filter((origin) => origin !== expectedOrigin)
    )).sort();
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
      blockedRequests: Object.freeze(blockedRequests),
      consoleErrorCount,
      consoleErrors: Object.freeze(consoleErrors),
      pageErrorCount,
      pageErrors: Object.freeze(pageErrors),
      failedRequestCount,
      failedRequests: Object.freeze(failedRequests),
      requestCount,
      responseCount,
      unexpectedOrigins: Object.freeze(unexpectedOrigins),
      modelByteRequestTargets: Object.freeze(
        modelByteRequests.slice(0, maximumErrorEvents).map((request) => request.target)
      ),
      unexpectedHttpResponses: Object.freeze(
        unexpectedHttpResponses.slice(0, maximumErrorEvents).map((response) =>
          Object.freeze({ status: response.status, target: response.target })
        )
      ),
      wasmState: boundedStateIdentity(state.wasmState, ["loaded"]),
      runtimeVariant: boundedStateIdentity(state.runtimeVariant, ["scalar", "simd128"]),
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
    observationInvariant(failedRequestCount === 0, "request_failed", diagnostic);
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
        state.browserModelAdmissionPresent && state.memoryEnrollmentPresent,
        "required_browser_module_missing",
        diagnostic
      );
      observationInvariant(state.wasmState === "loaded", "wasm_not_loaded", diagnostic);
      observationInvariant(
        state.runtimeVariant === "simd128" || state.runtimeVariant === "scalar",
        "runtime_variant_invalid",
        diagnostic
      );
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
        route.kind === "companion-install" && state.companionPackageLinkPresent,
        "companion_package_link_missing",
        diagnostic
      );
      observationInvariant(
        state.companionInstallCommandPresent,
        "companion_install_command_missing",
        diagnostic
      );
    }

    const screenshotName = `${route.name}-${viewport.name}.png`;
    const screenshotPath = path.join(outputDirectory, screenshotName);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    const screenshotBytes = fs.readFileSync(screenshotPath);
    return Object.freeze({
      route: route.name,
      surfaceKind: route.kind,
      pathname: target.pathname,
      viewport: Object.freeze({ width: viewport.width, height: viewport.height }),
      runtimeVariant: route.kind === "application" ? state.runtimeVariant : null,
      wasmState: route.kind === "application" ? state.wasmState : null,
      modelLoadState: route.kind === "application" ? state.modelLoadState : null,
      releaseState: state.releaseState,
      releaseVersion: state.releaseVersion,
      releaseDate: state.releaseDate,
      releasePublishedAt: state.releasePublishedAt,
      releaseSurfaceContentOverflowPixels: state.releaseSurfaceContentOverflowPixels,
      releaseSurfaceViewportOverflowPixels: diagnostic.releaseSurfaceViewportOverflowPixels,
      releaseEntryCount: route.kind === "release-history" ? state.releaseEntryCount : null,
      companionPackageLinkPresent: route.kind === "companion-install"
        ? state.companionPackageLinkPresent
        : null,
      companionInstallCommandPresent: route.kind === "companion-install"
        ? state.companionInstallCommandPresent
        : null,
      requestCount,
      responseCount,
      blockedRequestCount,
      unexpectedOriginCount: unexpectedOriginValues.length,
      failedRequestCount,
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
  } finally {
    await context.close();
  }
}

async function runWebReleaseBrowserSmoke(options) {
  invariant(options && typeof options === "object",
    "Browser smoke options are required");
  const baseUrl = requireBaseUrl(options.baseUrl);
  const loopback = baseUrl.protocol === "http:";
  const sourceRevision = requireSourceRevision(options.sourceRevision, loopback);
  const outputValue = String(options.outputDirectory || "");
  invariant(path.isAbsolute(outputValue), "Browser smoke output directory must be absolute");
  const outputDirectory = path.resolve(outputValue);
  const repositoryRoot = path.resolve(__dirname, "..", "..");
  const relativeOutput = path.relative(repositoryRoot, outputDirectory);
  invariant(
    relativeOutput.startsWith("..") || path.isAbsolute(relativeOutput),
    "Browser smoke output directory must remain outside the source worktree"
  );
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
    historyEntryCount: releaseValidation.releaseHistory.releases.length
  });
  createOwnedDirectory(outputDirectory);
  const startedAtUtc = new Date().toISOString();
  let browser = null;
  let browserVersion = null;
  let browserClosed = null;
  const observations = [];
  let operation = "browser-launch";
  let operationError = null;
  try {
    browser = await chromium.launch({ headless: true });
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
    networkPolicy: "exact-release-closure-deny-before-send",
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
  reportSchema,
  requireBaseUrl,
  requireSourceRevision,
  runWebReleaseBrowserSmoke
});
