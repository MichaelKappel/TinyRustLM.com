#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const scratch = require("./canonical-operation-scratch.js");

const catalogApi = require("../app/minimodel-catalog-v1.js");
const {
  materializeReleaseState,
  parseReleaseLedger
} = require("./site-release-contract.js");
const { verifyShells } = require("./static-shell-parity.js");
const {
  validateWebDeploymentManifest
} = require("./web-deployment-manifest.js");
const { parseStrictJson } = require("./strict-json.js");

const SCHEMA = "tinyrustlm.interview_demo_preflight.v1";
const MODES = Object.freeze({
  UI: "ui",
  LIVE_MODEL: "live-model"
});
const FAILURE_CODES = Object.freeze({
  ARGUMENTS_INVALID: "demo_arguments_invalid",
  PREFLIGHT_FAILED: "demo_preflight_failed",
  SOURCE_AUTHORITY: "demo_source_authority_failed",
  STATIC_SHELL: "demo_static_shell_failed",
  DEPLOYMENT_CLOSURE: "demo_deployment_closure_failed",
  BROWSER_MODULES: "demo_browser_modules_missing",
  COMPANION_MODULES: "demo_companion_modules_missing",
  STALE_BRIDGE: "demo_stale_bridge_path_present",
  CATALOG_UNAVAILABLE: "demo_catalog_unavailable",
  CATALOG_EMPTY: "demo_qualified_catalog_empty",
  CATALOG_TIMEOUT: "demo_catalog_timeout",
  EXTERNAL_PEER: "demo_external_peer_unavailable",
  COMPANION_HOST: "demo_companion_host_unavailable"
});
const DEFAULT_TIMEOUTS = Object.freeze({
  checkMilliseconds: 30000,
  catalogMilliseconds: 6000
});
const MAXIMUM_TIMEOUT_MILLISECONDS = 30000;
const MAXIMUM_STALE_SCAN_BYTES = 1024 * 1024;
const MAXIMUM_COMPANION_SCAN_ENTRIES = 512;
const MAXIMUM_COMPANION_SCAN_DEPTH = 5;
const PASS_CODE = "ok";
const INTERNAL_TIMEOUT_CODE = "demo_internal_timeout";
const STALE_BRIDGE_FILE = "companion-bridge.js";
const STALE_BRIDGE_REMOTE_PATH = `app/${STALE_BRIDGE_FILE}`;
const DEPLOYMENT_MANIFEST_FILE = "deploy/web-deployment-manifest.v2.json";
const defaultSiteRoot = path.resolve(__dirname, "..");
const defaultRepositoryRoot = path.resolve(defaultSiteRoot, "..");

const REQUIRED_BROWSER_FILES = Object.freeze([
  "app/browser-model-admission.js",
  "app/browser-runtime-loader.js",
  "app/catalog-admission-loader.js",
  "app/incremental-sha256.js",
  "app/minimodel-catalog-v1.js",
  "app/model-composition-store.js",
  "app/model-runtime-client.js",
  "app/model-runtime-worker.js",
  "browser-runtime/tinyrustlm-browser-runtime.wasm",
  "browser-runtime/tinyrustlm-browser-runtime.wasm.manifest.json"
]);
const REQUIRED_COMPANION_FILES = Object.freeze([
  "app/companion-capability.js",
  "app/companion-composition-install.js"
]);
const STALE_BRIDGE_SCAN_FILES = Object.freeze([
  "app/index.html",
  "companion/index.html",
  "index.html",
  "package.json",
  "updates/index.html"
]);
const STALE_MANIFEST_JSON_LIMITS = Object.freeze({
  maximumBytes: MAXIMUM_STALE_SCAN_BYTES,
  maximumDepth: 16,
  maximumTotalEntries: 2048,
  maximumObjectMembers: 128,
  maximumArrayItems: 128,
  maximumStringCodeUnits: MAXIMUM_STALE_SCAN_BYTES,
  maximumTotalStringCodeUnits: MAXIMUM_STALE_SCAN_BYTES,
  maximumNumberCharacters: 64
});

class PreflightError extends Error {
  constructor(code) {
    super(code);
    this.name = "PreflightError";
    this.code = code;
  }
}

// Accept a nonempty ordinary file without following a terminal link.
function safeRegularFile(filePath, fileSystem = fs) {
  try {
    const stat = fileSystem.lstatSync(filePath);
    return stat.isFile() && !stat.isSymbolicLink() && stat.size > 0;
  } catch (_error) {
    return false;
  }
}

// Require each named current module to exist beneath the selected root.
function allRegularFiles(root, relativePaths, fileSystem = fs) {
  return relativePaths.every((relativePath) =>
    safeRegularFile(path.join(root, ...relativePath.split("/")), fileSystem));
}

// Reads one plain stable file without permitting unbounded or replacement input.
function readBoundedBytes(filePath, fileSystem = fs) {
  const stat = fileSystem.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink() ||
      stat.size < 1 || stat.size > MAXIMUM_STALE_SCAN_BYTES) {
    throw new PreflightError(FAILURE_CODES.STALE_BRIDGE);
  }
  const bytes = Buffer.from(fileSystem.readFileSync(filePath));
  const after = fileSystem.lstatSync(filePath);
  if (!after.isFile() || after.isSymbolicLink() ||
      bytes.byteLength !== stat.size || after.size !== stat.size ||
      after.mtimeMs !== stat.mtimeMs) {
    throw new PreflightError(FAILURE_CODES.STALE_BRIDGE);
  }
  return bytes;
}

// Decodes a bounded shell or package file with fatal UTF-8 semantics.
function readBoundedText(filePath, fileSystem = fs) {
  return new TextDecoder("utf-8", { fatal: true }).decode(
    readBoundedBytes(filePath, fileSystem)
  );
}

// Returns true only when no filesystem entry exists at the obsolete bridge path.
function isPhysicallyAbsent(filePath, fileSystem = fs) {
  try {
    fileSystem.lstatSync(filePath);
    return false;
  } catch (error) {
    return error && error.code === "ENOENT";
  }
}

// Identifies parser-produced object records without accepting arrays or host objects.
function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

// Counts every bridge-name occurrence and the sole exact retirement occurrence.
function inspectBridgeReferences(value, location = [], state = { total: 0, canonical: 0 }) {
  if (typeof value === "string") {
    if (value.toLowerCase().includes(STALE_BRIDGE_FILE)) {
      state.total += 1;
      if (location.length === 3 && location[0] === "retire" &&
          Number.isSafeInteger(location[1]) && location[2] === "remote" &&
          value === STALE_BRIDGE_REMOTE_PATH) {
        state.canonical += 1;
      }
    }
    return state;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectBridgeReferences(
      item,
      [...location, index],
      state
    ));
    return state;
  }
  if (!isPlainObject(value)) return state;
  for (const [key, item] of Object.entries(value)) {
    if (key.toLowerCase().includes(STALE_BRIDGE_FILE)) state.total += 1;
    inspectBridgeReferences(item, [...location, key], state);
  }
  return state;
}

// Accepts exactly one one-key retirement record and no other bridge reference.
function hasExactBridgeRetirement(manifest) {
  if (!isPlainObject(manifest) || !Array.isArray(manifest.publish) ||
      !Array.isArray(manifest.retire)) {
    return false;
  }
  if (!manifest.publish.every(isPlainObject) || !manifest.retire.every(isPlainObject)) {
    return false;
  }
  const canonicalEntries = manifest.retire.filter((entry) =>
    Object.keys(entry).length === 1 &&
    Object.hasOwn(entry, "remote") &&
    entry.remote === STALE_BRIDGE_REMOTE_PATH
  );
  const references = inspectBridgeReferences(manifest);
  return canonicalEntries.length === 1 &&
    references.canonical === 1 && references.total === 1;
}

// Verifies physical absence, active-surface absence, and one retirement declaration.
function hasNoStaleBridgePath(siteRoot, fileSystem = fs) {
  if (!isPhysicallyAbsent(
    path.join(siteRoot, "app", STALE_BRIDGE_FILE),
    fileSystem
  )) return false;
  try {
    const activeSurfacesAreClean = STALE_BRIDGE_SCAN_FILES.every((relativePath) => {
      const filePath = path.join(siteRoot, ...relativePath.split("/"));
      return !readBoundedText(filePath, fileSystem)
        .toLowerCase()
        .includes(STALE_BRIDGE_FILE);
    });
    if (!activeSurfacesAreClean) return false;
    const manifestPath = path.join(
      siteRoot,
      ...DEPLOYMENT_MANIFEST_FILE.split("/")
    );
    const manifest = parseStrictJson(
      readBoundedBytes(manifestPath, fileSystem),
      STALE_MANIFEST_JSON_LIMITS
    );
    return hasExactBridgeRetirement(manifest);
  } catch (_error) {
    return false;
  }
}

// Accept only the catalog's public direct-peer address profile.
function isPublicDirectPeerUrl(value) {
  try {
    if (catalogApi.directPeerUrlAuthority.normalizeBaseUrl(value) !== value) return false;
    const host = new URL(value).hostname.toLowerCase();
    return host !== "127.0.0.1" && host !== "[::1]";
  } catch (_error) {
    return false;
  }
}

// Count current signed announcements without claiming live reachability.
function evaluateLiveCatalog(result, now) {
  const unavailable = Object.freeze({
    catalogAvailable: false,
    peerFeedAvailable: false,
    qualifiedEntryCount: 0,
    announcedExternalPeerCount: 0
  });
  if (!result || result.catalog?.status !== catalogApi.SOURCE_STATUSES.VALID ||
      !result.catalog.document) {
    return unavailable;
  }

  let catalog;
  try {
    catalog = catalogApi.validateCatalog(result.catalog.document, { now });
  } catch (_error) {
    return unavailable;
  }
  const qualifiedEntryCount = catalog.entries.length;
  if (result.peerFeed?.status !== catalogApi.SOURCE_STATUSES.VALID ||
      !result.peerFeed.document) {
    return Object.freeze({
      catalogAvailable: true,
      peerFeedAvailable: false,
      qualifiedEntryCount,
      announcedExternalPeerCount: 0
    });
  }

  try {
    catalogApi.validatePeerFeedDocument(result.peerFeed.document, { now });
    if (!Array.isArray(result.views)) throw new TypeError("catalog views unavailable");
    const catalogCompositions = new Map(catalog.entries.map((entry) => [
      entry.entry_id,
      entry.composition.composition_id
    ]));
    const announcementIds = new Set();
    for (const view of result.views) {
      const expectedCompositionId = view && catalogCompositions.get(view.entryId);
      if (!expectedCompositionId ||
          view.composition?.compositionId !== expectedCompositionId ||
          !Array.isArray(view.peers)) {
        continue;
      }
      for (const peer of view.peers) {
        if (peer && peer.signatureVerified === true &&
            peer.compositionId === expectedCompositionId &&
            peer.consentStatus === "explicit" &&
            peer.outsideProofStatus === "current-passed" &&
            Date.parse(peer.issuedAtUtc) <= now.getTime() &&
            Date.parse(peer.expiresUtc) > now.getTime() &&
            peer.feedId === result.peerFeed.document.feed_id &&
            peer.feedRevision === result.peerFeed.document.revision &&
            isPublicDirectPeerUrl(peer.peerBaseUrl)) {
          announcementIds.add(peer.announcementId);
        }
      }
    }
    return Object.freeze({
      catalogAvailable: true,
      peerFeedAvailable: true,
      qualifiedEntryCount,
      announcedExternalPeerCount: announcementIds.size
    });
  } catch (_error) {
    return Object.freeze({
      catalogAvailable: true,
      peerFeedAvailable: false,
      qualifiedEntryCount,
      announcedExternalPeerCount: 0
    });
  }
}

// Require the complete nonempty companion output set in one directory.
function completeCompanionOutput(directory, entries, fileSystem = fs) {
  const files = new Map(entries
    .filter((entry) => entry.isFile() && !entry.isSymbolicLink())
    .map((entry) => [entry.name.toLowerCase(), entry.name]));
  const required = [
    "tinyrustlm.companionhost.deps.json",
    "tinyrustlm.companionhost.dll",
    "tinyrustlm.companionhost.runtimeconfig.json",
    "tinyrustlm.companion.dll"
  ];
  return required.every((name) => {
    const actualName = files.get(name);
    return actualName && safeRegularFile(path.join(directory, actualName), fileSystem);
  });
}

// Inspect bounded canonical build output; existence is not execution evidence.
function hasCompanionHostOutput(repositoryRoot, fileSystem = fs) {
  const outputRoot = path.join(
    repositoryRoot,
    "dotnet",
    "tools",
    "TinyRustLM.CompanionHost",
    "bin"
  );
  let rootStat;
  try {
    rootStat = fileSystem.lstatSync(outputRoot);
  } catch (_error) {
    return false;
  }
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return false;

  const queue = [{ directory: outputRoot, depth: 0 }];
  let inspected = 0;
  while (queue.length > 0) {
    const { directory, depth } = queue.shift();
    let entries;
    try {
      entries = fileSystem.readdirSync(directory, { withFileTypes: true });
    } catch (_error) {
      return false;
    }
    inspected += entries.length;
    if (inspected > MAXIMUM_COMPANION_SCAN_ENTRIES) return false;
    if (completeCompanionOutput(directory, entries, fileSystem)) return true;
    if (depth >= MAXIMUM_COMPANION_SCAN_DEPTH) continue;
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        queue.push({
          directory: path.join(directory, entry.name),
          depth: depth + 1
        });
      }
    }
  }
  return false;
}

// Choose a deterministic-valid date for disposable closure metadata, not a publication.
function pendingPublicationInstant(ledgerResult, now) {
  const releaseDate = Date.parse(`${ledgerResult.pendingRelease.releaseDate}T23:59:59.999Z`);
  const prior = ledgerResult.ledger.publications.reduce((maximum, publication) =>
    Math.max(maximum, Date.parse(publication.publishedAt)), 0);
  return new Date(Math.max(now.getTime(), releaseDate, prior + 1)).toISOString();
}

// Admit one actual source root before a default check may execute or write output.
function requireCanonicalContext(context) {
  const siteRoot = scratch.requireCanonicalSiteRoot(context.siteRoot);
  const repositoryRoot = path.resolve(siteRoot, "..");
  if (path.relative(repositoryRoot, context.repositoryRoot) !== "") {
    throw new PreflightError(FAILURE_CODES.SOURCE_AUTHORITY);
  }
  return { siteRoot, repositoryRoot };
}

// Validate canonical publication bytes using only owned, disposable release metadata.
function verifyDeploymentClosure(context) {
  const { siteRoot, repositoryRoot } = requireCanonicalContext(context);
  const owned = scratch.createOwnedTemporaryDirectory({
    siteRoot,
    temporaryParent: path.join(repositoryRoot, "artifacts", "verification", "interview-preflight")
  });
  const outputRoot = owned.rootPath;
  try {
    const ledgerPath = path.join(
      siteRoot,
      "release",
      "site-release-ledger.v1.json"
    );
    const ledgerResult = parseReleaseLedger(fs.readFileSync(ledgerPath));
    const materializeOptions = {
      ledgerPath,
      outputRoot
    };
    if (ledgerResult.pendingRelease) {
      materializeOptions.sourceRevision = "0".repeat(40);
      materializeOptions.publishedAt = pendingPublicationInstant(
        ledgerResult,
        context.now
      );
    }
    materializeReleaseState(materializeOptions);
    validateWebDeploymentManifest({
      siteRoot,
      generatedRoot: outputRoot
    });
    return true;
  } finally {
    scratch.removeOwnedTemporaryDirectory(owned);
  }
}

// Run the canonical verifier with bounded output, deadline and cancellation.
function runCanonicalSourceVerifier(context) {
  const { siteRoot, repositoryRoot } = requireCanonicalContext(context);
  const verifierPath = path.join(
    siteRoot,
    "tools",
    "verify-single-source-authority.js"
  );
  return new Promise((resolve, reject) => {
    childProcess.execFile(
      process.execPath,
      [verifierPath],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        maxBuffer: 64 * 1024,
        signal: context.signal,
        timeout: context.timeoutMilliseconds,
        windowsHide: true
      },
      (error) => error ? reject(new PreflightError(
        FAILURE_CODES.SOURCE_AUTHORITY
      )) : resolve(true)
    );
  });
}

// Bind real checks separately from explicit test dependency injection.
function createDefaultDependencies() {
  return Object.freeze({
    verifyCanonicalSource: runCanonicalSourceVerifier,
    verifyStaticShell: (context) => {
      verifyShells(context.siteRoot);
      return true;
    },
    verifyDeploymentClosure,
    verifyBrowserModules: (context) =>
      allRegularFiles(context.siteRoot, REQUIRED_BROWSER_FILES),
    verifyCompanionModules: (context) =>
      allRegularFiles(context.siteRoot, REQUIRED_COMPANION_FILES),
    verifyNoStaleBridge: (context) =>
      hasNoStaleBridgePath(context.siteRoot),
    loadCurrentCatalog: (context) => catalogApi.loadCurrentCatalog({
      fetch: context.catalogFetch,
      now: context.now,
      signal: context.signal,
      timeoutMilliseconds: Math.min(
        context.timeoutMilliseconds,
        catalogApi.MAXIMUM_TIMEOUT_MILLISECONDS
      )
    }),
    verifyCompanionHost: (context) =>
      hasCompanionHostOutput(context.repositoryRoot)
  });
}

// Reject unsupported modes before any checks run.
function normalizeMode(mode) {
  if (!Object.values(MODES).includes(mode)) {
    throw new PreflightError(FAILURE_CODES.ARGUMENTS_INVALID);
  }
  return mode;
}

// Require a positive bounded integer deadline, defaulting only omission.
function normalizeTimeout(value, fallback) {
  const timeout = value === undefined ? fallback : value;
  if (!Number.isSafeInteger(timeout) || timeout < 1 ||
      timeout > MAXIMUM_TIMEOUT_MILLISECONDS) {
    throw new PreflightError(FAILURE_CODES.ARGUMENTS_INVALID);
  }
  return timeout;
}

// Leave time for catalog cancellation before the outer check expires.
function catalogRequestTimeout(timeoutMilliseconds) {
  const guardMilliseconds = Math.min(
    250,
    Math.max(1, Math.floor(timeoutMilliseconds / 4))
  );
  return Math.max(1, timeoutMilliseconds - guardMilliseconds);
}

// Validate supplied functions for the known injectable check boundaries.
function normalizeDependencies(injected = {}) {
  if (!injected || typeof injected !== "object" || Array.isArray(injected)) {
    throw new PreflightError(FAILURE_CODES.ARGUMENTS_INVALID);
  }
  const dependencies = { ...createDefaultDependencies() };
  for (const name of Object.keys(dependencies)) {
    if (Object.hasOwn(injected, name)) {
      if (typeof injected[name] !== "function") {
        throw new PreflightError(FAILURE_CODES.ARGUMENTS_INVALID);
      }
      dependencies[name] = injected[name];
    }
  }
  return Object.freeze(dependencies);
}

// Create one immutable successful check result.
function passCheck(id) {
  return Object.freeze({ id, status: "pass", code: PASS_CODE });
}

// Record a stable public-safe code without underlying path or credential details.
function failCheck(id, code) {
  return Object.freeze({ id, status: "fail", code });
}

// Bound observation and signal cancellation; late completion cannot admit a check.
async function boundedCall(operation, timeoutMilliseconds) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new PreflightError(INTERNAL_TIMEOUT_CODE));
    }, timeoutMilliseconds);
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      timeout
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// Admit only true and map errors/timeouts to the check's stable failure code.
async function runBooleanCheck(definition, baseContext, timeoutMilliseconds) {
  try {
    const passed = await boundedCall(
      (signal) => definition.operation(Object.freeze({
        ...baseContext,
        signal,
        timeoutMilliseconds
      })),
      timeoutMilliseconds
    );
    return passed === true
      ? passCheck(definition.id)
      : failCheck(definition.id, definition.failureCode);
  } catch (_error) {
    return failCheck(definition.id, definition.failureCode);
  }
}

// Derive readiness from actual failed checks; skipped prerequisites are never passes.
function buildReport(mode, checks, liveFacts) {
  const failureCodes = [...new Set(checks
    .filter((check) => check.status === "fail")
    .map((check) => check.code))];
  const report = {
    schema: SCHEMA,
    mode,
    status: failureCodes.length === 0 ? "ready" : "blocked",
    ready: failureCodes.length === 0,
    checks: Object.freeze(checks),
    failureCodes: Object.freeze(failureCodes)
  };
  if (liveFacts) report.live = Object.freeze(liveFacts);
  return Object.freeze(report);
}

// Admit source first, then check the requested UI or live-model prerequisites.
async function runPreflight(options = {}) {
  const mode = normalizeMode(options.mode);
  const dependencies = normalizeDependencies(options.dependencies);
  const checkMilliseconds = normalizeTimeout(
    options.timeouts?.checkMilliseconds,
    DEFAULT_TIMEOUTS.checkMilliseconds
  );
  const catalogMilliseconds = normalizeTimeout(
    options.timeouts?.catalogMilliseconds,
    DEFAULT_TIMEOUTS.catalogMilliseconds
  );
  const now = options.now === undefined ? new Date() : new Date(options.now);
  if (!Number.isFinite(now.getTime())) {
    throw new PreflightError(FAILURE_CODES.ARGUMENTS_INVALID);
  }
  const baseContext = Object.freeze({
    siteRoot: path.resolve(options.siteRoot || defaultSiteRoot),
    repositoryRoot: path.resolve(
      options.repositoryRoot || defaultRepositoryRoot
    ),
    now,
    catalogFetch: options.catalogFetch
  });
  const uiDefinitions = [
    ["source-authority", FAILURE_CODES.SOURCE_AUTHORITY, "verifyCanonicalSource"],
    ["static-shell", FAILURE_CODES.STATIC_SHELL, "verifyStaticShell"],
    ["deployment-closure", FAILURE_CODES.DEPLOYMENT_CLOSURE, "verifyDeploymentClosure"],
    ["browser-modules", FAILURE_CODES.BROWSER_MODULES, "verifyBrowserModules"],
    ["companion-modules", FAILURE_CODES.COMPANION_MODULES, "verifyCompanionModules"],
    ["stale-bridge", FAILURE_CODES.STALE_BRIDGE, "verifyNoStaleBridge"]
  ].map(([id, failureCode, dependency]) => Object.freeze({
    id,
    failureCode,
    operation: dependencies[dependency]
  }));
  // Admission is a prerequisite, not a concurrent diagnostic. Do not start local
  // writes, catalog requests or host discovery while authority is pending/failed.
  const sourceCheck = await runBooleanCheck(uiDefinitions[0], baseContext, checkMilliseconds);
  if (sourceCheck.status !== "pass") {
    const skippedIds = uiDefinitions.slice(1).map((definition) => definition.id);
    if (mode === MODES.LIVE_MODEL) skippedIds.push(
      "qualified-catalog", "external-direct-peer-reachability", "companion-host-output"
    );
    return buildReport(mode, [sourceCheck, ...skippedIds.map((id) => Object.freeze({
      id, status: "skipped", code: FAILURE_CODES.SOURCE_AUTHORITY
    }))], null);
  }
  const uiChecksPromise = Promise.all(uiDefinitions.slice(1).map((definition) =>
    runBooleanCheck(definition, baseContext, checkMilliseconds)))
    .then((checks) => [sourceCheck, ...checks]);
  if (mode === MODES.UI) {
    return buildReport(mode, await uiChecksPromise, null);
  }

  const unavailableCatalog = Object.freeze({
    catalogAvailable: false,
    peerFeedAvailable: false,
    qualifiedEntryCount: 0,
    announcedExternalPeerCount: 0
  });
  const catalogOutcomePromise = (async () => {
    try {
      const result = await boundedCall(
        (signal) => dependencies.loadCurrentCatalog(Object.freeze({
          ...baseContext,
          signal,
          timeoutMilliseconds: catalogRequestTimeout(catalogMilliseconds)
        })),
        catalogMilliseconds
      );
      return Object.freeze({
        state: evaluateLiveCatalog(result, now),
        timedOut: false
      });
    } catch (error) {
      return Object.freeze({
        state: unavailableCatalog,
        timedOut: error instanceof PreflightError &&
          error.code === INTERNAL_TIMEOUT_CODE
      });
    }
  })();
  const hostCheckPromise = runBooleanCheck(Object.freeze({
    id: "companion-host-output",
    failureCode: FAILURE_CODES.COMPANION_HOST,
    operation: dependencies.verifyCompanionHost
  }), baseContext, checkMilliseconds);
  const [checks, catalogOutcome, hostCheck] = await Promise.all([
    uiChecksPromise,
    catalogOutcomePromise,
    hostCheckPromise
  ]);
  const catalogState = catalogOutcome.state;

  checks.push(catalogState.catalogAvailable &&
      catalogState.qualifiedEntryCount > 0
    ? passCheck("qualified-catalog")
    : failCheck(
        "qualified-catalog",
        catalogOutcome.timedOut
          ? FAILURE_CODES.CATALOG_TIMEOUT
          : (catalogState.catalogAvailable
              ? FAILURE_CODES.CATALOG_EMPTY
              : FAILURE_CODES.CATALOG_UNAVAILABLE)
      ));
  // A current announcement is metadata, not a content-bound live probe.
  checks.push(failCheck(
    "external-direct-peer-reachability",
    FAILURE_CODES.EXTERNAL_PEER
  ));

  checks.push(hostCheck);
  return buildReport(mode, checks, {
    qualifiedCatalogEntryCount: catalogState.qualifiedEntryCount,
    announcedExternalPeerCount: catalogState.announcedExternalPeerCount,
    provenReachableExternalPeerCount: 0,
    companionHostOutputAvailable: hostCheck.status === "pass"
  });
}

// Accept exactly one explicit CLI mode.
function parseArguments(argv) {
  if (!Array.isArray(argv) || argv.length !== 1) {
    throw new PreflightError(FAILURE_CODES.ARGUMENTS_INVALID);
  }
  if (argv[0] === "--ui") return MODES.UI;
  if (argv[0] === "--live-model") return MODES.LIVE_MODEL;
  throw new PreflightError(FAILURE_CODES.ARGUMENTS_INVALID);
}

// Describe observed readiness without publishing private diagnostics.
function renderHumanSummary(report) {
  const passed = report.checks.filter((check) => check.status === "pass").length;
  const label = report.mode === MODES.LIVE_MODEL ? "live model" : "UI";
  const lines = [
    `TinyRustLM interview ${label} preflight: ${report.status.toUpperCase()} ` +
      `(${passed}/${report.checks.length} checks passed).`
  ];
  if (report.live) {
    lines.push(
      `Qualified catalog entries: ${report.live.qualifiedCatalogEntryCount}; ` +
      `announced external direct peers: ` +
      `${report.live.announcedExternalPeerCount}; ` +
      `proven reachable external direct peers: ` +
      `${report.live.provenReachableExternalPeerCount}; ` +
      `companion host output: ` +
      `${report.live.companionHostOutputAvailable ? "available" : "unavailable"}.`
    );
  }
  if (report.failureCodes.length > 0) {
    lines.push(`Blockers: ${report.failureCodes.join(", ")}.`);
  }
  return lines.join("\n");
}

// Build a blocked report when arguments or startup fail.
function failureReport(code) {
  return Object.freeze({
    schema: SCHEMA,
    mode: null,
    status: "blocked",
    ready: false,
    checks: Object.freeze([
      failCheck("arguments", code)
    ]),
    failureCodes: Object.freeze([code])
  });
}

// Write structured results to stdout and a public-safe summary to stderr.
async function runCli(options = {}) {
  const stdout = options.stdout || process.stdout;
  const stderr = options.stderr || process.stderr;
  let report;
  try {
    const mode = parseArguments(options.argv || process.argv.slice(2));
    report = await runPreflight({
      mode,
      dependencies: options.dependencies,
      timeouts: options.timeouts,
      now: options.now,
      siteRoot: options.siteRoot,
      repositoryRoot: options.repositoryRoot,
      catalogFetch: options.catalogFetch
    });
  } catch (error) {
    const code = error instanceof PreflightError &&
      error.code === FAILURE_CODES.ARGUMENTS_INVALID
      ? FAILURE_CODES.ARGUMENTS_INVALID
      : FAILURE_CODES.PREFLIGHT_FAILED;
    report = failureReport(code);
  }
  stdout.write(`${JSON.stringify(report)}\n`);
  stderr.write(`${renderHumanSummary(report)}\n`);
  return report.ready ? 0 : 1;
}

if (require.main === module) {
  runCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}

module.exports = Object.freeze({
  DEFAULT_TIMEOUTS,
  FAILURE_CODES,
  MODES,
  REQUIRED_BROWSER_FILES,
  REQUIRED_COMPANION_FILES,
  SCHEMA,
  PreflightError,
  evaluateLiveCatalog,
  hasCompanionHostOutput,
  hasNoStaleBridgePath,
  isPublicDirectPeerUrl,
  parseArguments,
  renderHumanSummary,
  runCli,
  runPreflight
});
