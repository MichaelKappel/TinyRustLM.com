"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { chromium } = require("@playwright/test");
const { atomicCreate } = require("./durable-files.js");
const {
  assertOwnedProfileFresh,
  createOwnedBrowserProfile,
  createOwnedProfileRoot,
  deleteOwnedBrowserProfile,
  removeOwnedProfileRoot
} = require("./owned-browser-profile.js");
const { parseStrictJson } = require("./strict-json.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const preregistrationPath = path.join(
  repositoryRoot,
  "contracts/vnext/qwen-tokenizer2-browser-wasm-preregistration.v1.json"
);
const adapterPath = path.join(
  repositoryRoot, "tinyrustlm/tools/tokenizer2-wasm-adapter.js"
);
const RESULT_SCHEMA = "tinyrustlm.qwen_tokenizer2_browser_wasm_result.v1";
const FAILURE_SCHEMA = "tinyrustlm.qwen_tokenizer2_browser_wasm_failure.v1";
const PROFILE_SCHEMA =
  "tinyrustlm.vnext.qwen-tokenizer2-browser-wasm-preregistration.v1";
const PROFILE_ID = "tinyrustlm.qwen-tokenizer2-browser-wasm/1";
const MAXIMUM_PROFILE_BYTES = 1024 * 1024;
const MAXIMUM_CORPUS_BYTES = 2 * 1024 * 1024;
const MAXIMUM_NATIVE_BYTES = 64 * 1024 * 1024;
const MAXIMUM_RESULT_BYTES = 64 * 1024 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SOURCE_REVISION_PATTERN = /^[a-f0-9]{40}$/u;
const SAFE_CODE_PATTERN = /^[a-z][a-z0-9-]{2,95}$/u;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value, keys, label) {
  invariant(isPlainObject(value), `${label} must be an object`);
  invariant(
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()),
    `${label} fields are invalid`
  );
}

function exactValue(actual, expected, label) {
  invariant(JSON.stringify(actual) === JSON.stringify(expected), `${label} is invalid`);
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function sha256File(filePath) {
  const descriptor = fs.openSync(filePath, "r");
  const hash = crypto.createHash("sha256");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    for (;;) {
      const count = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      hash.update(buffer.subarray(0, count));
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest("hex");
}

function canonicalBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readRegular(filePath, maximumBytes, label) {
  const resolved = path.resolve(filePath);
  const stat = fs.lstatSync(resolved);
  invariant(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 &&
    stat.size <= maximumBytes, `${label} must be a bounded regular file`);
  return Object.freeze({
    path: resolved,
    bytes: fs.readFileSync(resolved),
    byteLength: stat.size
  });
}

function readJson(filePath, maximumBytes, label) {
  const file = readRegular(filePath, maximumBytes, label);
  const value = parseStrictJson(file.bytes, {
    maximumBytes,
    maximumDepth: 64,
    maximumTotalEntries: 8 * 1024 * 1024,
    maximumObjectMembers: 4096,
    maximumArrayItems: 131072,
    maximumStringCodeUnits: maximumBytes,
    maximumTotalStringCodeUnits: maximumBytes,
    maximumNumberCharacters: 32
  });
  return Object.freeze({ ...file, value });
}

function requireDigest(value, label) {
  invariant(typeof value === "string" && SHA256_PATTERN.test(value) &&
    !/^0{64}$/u.test(value), `${label} is invalid`);
}

function requireRelativePath(value, label) {
  invariant(typeof value === "string" && value.length > 0 && value.length <= 256 &&
    !value.includes("\\") && !path.posix.isAbsolute(value) &&
    value.split("/").every((part) => part.length > 0 && part !== "." && part !== ".."),
  `${label} is invalid`);
}

function validateRepositoryIdentity(entry, label) {
  exactKeys(entry, ["path", "byteLength", "sha256"], label);
  requireRelativePath(entry.path, `${label} path`);
  invariant(Number.isSafeInteger(entry.byteLength) && entry.byteLength > 0,
    `${label} byte length is invalid`);
  requireDigest(entry.sha256, `${label} SHA-256`);
  const file = readRegular(
    path.join(repositoryRoot, ...entry.path.split("/")), entry.byteLength, label
  );
  invariant(file.byteLength === entry.byteLength && sha256(file.bytes) === entry.sha256,
    `${label} identity changed`);
}

function sourceClosureSha256(entries) {
  return sha256(Buffer.concat(entries.map((entry) => Buffer.from(
    `${entry.path}\0${entry.byteLength}\0${entry.sha256}\n`, "utf8"
  ))));
}

function validatePreregistration(value) {
  exactKeys(value, [
    "schema", "profileId", "status", "registeredAtUtc", "registrationParentCommit",
    "nativeEvidence", "artifact", "corpus", "wasm", "browser", "execution",
    "acceptance", "claimBoundary"
  ], "browser WASM preregistration");
  invariant(value.schema === PROFILE_SCHEMA && value.profileId === PROFILE_ID &&
    value.status === "registered-before-full-artifact-browser-output" &&
    value.registrationParentCommit ===
      "21a6b733959ad48c9c04cbcb08f47cf4e55fa99f",
  "browser WASM preregistration identity is invalid");

  exactKeys(value.nativeEvidence, [
    "verificationProfile", "receipt", "candidateResult"
  ], "native evidence");
  validateRepositoryIdentity(
    value.nativeEvidence.verificationProfile,
    "native evidence verification profile"
  );
  for (const key of ["receipt", "candidateResult"]) {
    exactKeys(value.nativeEvidence[key], ["basename", "byteLength", "sha256"],
      `native evidence ${key}`);
    invariant(typeof value.nativeEvidence[key].basename === "string" &&
      value.nativeEvidence[key].basename.length > 0 &&
      !value.nativeEvidence[key].basename.includes("/") &&
      !value.nativeEvidence[key].basename.includes("\\"),
    `native evidence ${key} basename is invalid`);
    invariant(Number.isSafeInteger(value.nativeEvidence[key].byteLength) &&
      value.nativeEvidence[key].byteLength > 0,
    `native evidence ${key} byte length is invalid`);
    requireDigest(value.nativeEvidence[key].sha256,
      `native evidence ${key} SHA-256`);
  }

  exactValue(value.artifact, {
    formatProfileId: "org.minimodel.tokenizer2/2.0",
    basename: "qwen3-0.6b.tokenizer.tok2",
    byteLength: 7038773,
    sha256: "cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b",
    tokenCount: 151669,
    baseTokenCount: 151643,
    addedTokenCount: 26
  }, "artifact");
  exactKeys(value.corpus, ["path", "byteLength", "sha256", "caseCount", "corpusId"],
    "corpus");
  invariant(value.corpus.path ===
    "contracts/vnext/qwen-tokenizer2-parity-cases.v1.json" &&
    value.corpus.byteLength === 464043 && value.corpus.caseCount === 2048 &&
    value.corpus.corpusId === "qwen3-0.6b-tokenizer2-parity-2048-v1",
  "corpus identity is invalid");
  requireDigest(value.corpus.sha256, "corpus SHA-256");

  exactKeys(value.wasm, [
    "interface", "adapter", "module", "sourceClosureSha256", "sourceClosure"
  ], "WASM");
  for (const key of ["interface", "adapter"]) {
    validateRepositoryIdentity(value.wasm[key], `WASM ${key}`);
  }
  exactKeys(value.wasm.module, ["basename", "byteLength", "sha256"], "WASM module");
  invariant(value.wasm.module.basename === "tinyrustlm_tokenizer2_wasm.wasm" &&
    Number.isSafeInteger(value.wasm.module.byteLength) &&
    value.wasm.module.byteLength > 0 && value.wasm.module.byteLength <= 4194304,
  "WASM module identity is invalid");
  requireDigest(value.wasm.module.sha256, "WASM module SHA-256");
  requireDigest(value.wasm.sourceClosureSha256, "WASM source closure SHA-256");
  invariant(Array.isArray(value.wasm.sourceClosure) && value.wasm.sourceClosure.length >= 10,
    "WASM source closure is invalid");
  let priorPath = null;
  for (const [index, entry] of value.wasm.sourceClosure.entries()) {
    validateRepositoryIdentity(entry, `WASM source closure ${index}`);
    invariant(priorPath === null || priorPath < entry.path,
      "WASM source closure is not strictly ordered");
    priorPath = entry.path;
  }
  invariant(sourceClosureSha256(value.wasm.sourceClosure) ===
    value.wasm.sourceClosureSha256, "WASM source closure digest changed");

  exactKeys(value.browser, [
    "engine", "playwright", "chromium", "headless", "pageOrigin",
    "profileLifecycle", "serviceWorkers", "ambientNetwork"
  ], "browser");
  invariant(value.browser.engine === "chromium" && value.browser.headless === true &&
    value.browser.pageOrigin === "about:blank" &&
    value.browser.profileLifecycle === "owned-persistent-create-close-delete-per-run" &&
    value.browser.serviceWorkers === "block" &&
    value.browser.ambientNetwork === "disabled-and-all-page-requests-aborted",
  "browser policy is invalid");
  for (const key of ["playwright", "chromium"]) {
    exactKeys(value.browser[key], ["version", "byteLength", "sha256"],
      `browser ${key}`);
    invariant(typeof value.browser[key].version === "string" &&
      value.browser[key].version.length > 0 && value.browser[key].version.length <= 255 &&
      Number.isSafeInteger(value.browser[key].byteLength) &&
      value.browser[key].byteLength > 0,
    `browser ${key} identity is invalid`);
    requireDigest(value.browser[key].sha256, `browser ${key} SHA-256`);
  }

  exactValue(value.execution, {
    requiredIndependentRuns: 2,
    cancellationRun: 1,
    fullCorpusCaseCount: 2048,
    decodeModes: ["include-all", "skip-special"],
    maximumInputBytes: 32768,
    maximumOutputTokens: 65536,
    maximumDecodedBytes: 131072,
    browserOperationTimeoutMs: 900000,
    workerLoadTimeoutMs: 180000,
    workerCancellationIterations: 100000,
    workerPostTerminationQuietMs: 500,
    maximumWasmLinearMemoryBytes: 536870912,
    maximumRunResultBytes: 67108864,
    outputDirectoryName: "qwen3-tokenizer2-browser-wasm-20260821-v1",
    runFiles: ["browser-run-1.json", "browser-run-2.json"],
    failureFile: "browser-runner-failure.v1.json",
    resultRepair: false,
    bestOfN: false,
    hiddenRetry: false
  }, "execution");
  exactKeys(value.acceptance, [
    "exactCaseOrderRequired", "exactTokenIdsRequired",
    "exactIncludeAllDecodeRequired", "exactSkipSpecialDecodeRequired",
    "fullArtifactIdentityRequired", "freshProfilePerRunRequired",
    "browserProcessClosureRequired", "profileDeletionRequired",
    "zeroNetworkRequestsRequired", "zeroConsoleErrorsRequired",
    "zeroPageErrorsRequired", "boundedLinearMemoryRequired",
    "workerTerminationRequired", "freshWorkerRecoveryRequired",
    "rawOutputsPreserved", "sourceRehashAfterObservation"
  ], "acceptance");
  invariant(Object.values(value.acceptance).every((entry) => entry === true),
    "acceptance requirements are invalid");
  exactValue(value.claimBoundary, {
    tokenizerBrowserWasmParityMayBeClaimedAfterPass: true,
    modelRuntimeMayBeClaimed: false,
    modelQualityMayBeClaimed: false,
    releaseMayBeClaimed: false,
    campaignCreditMayBeClaimed: false,
    requiredNextGate: "template2-byte-profile-and-source-parity"
  }, "claim boundary");

  const corpus = readRegular(
    path.join(repositoryRoot, ...value.corpus.path.split("/")),
    value.corpus.byteLength,
    "registered corpus"
  );
  invariant(corpus.byteLength === value.corpus.byteLength &&
    sha256(corpus.bytes) === value.corpus.sha256, "registered corpus changed");
  return value;
}

function validatePreregistrationFile(filePath = preregistrationPath) {
  const parsed = readJson(filePath, MAXIMUM_PROFILE_BYTES, "browser WASM preregistration");
  const profile = validatePreregistration(parsed.value);
  invariant(parsed.bytes.equals(canonicalBytes(profile)),
    "browser WASM preregistration is not canonical");
  return Object.freeze({ profile, bytes: parsed.bytes, sha256: sha256(parsed.bytes) });
}

function validateCorpus(filePath, profile) {
  const parsed = readJson(filePath, MAXIMUM_CORPUS_BYTES, "browser corpus");
  invariant(parsed.byteLength === profile.corpus.byteLength &&
    sha256(parsed.bytes) === profile.corpus.sha256,
  "browser corpus identity changed");
  const corpus = parsed.value;
  invariant(corpus.schema === "tinyrustlm.qwen_tokenizer2_parity_cases.v1" &&
    corpus.corpusId === profile.corpus.corpusId &&
    corpus.caseCount === profile.execution.fullCorpusCaseCount &&
    Array.isArray(corpus.cases) && corpus.cases.length === corpus.caseCount,
  "browser corpus structure is invalid");
  const ids = new Set();
  for (const entry of corpus.cases) {
    exactKeys(entry, ["caseId", "category", "text"], "browser corpus case");
    invariant(typeof entry.caseId === "string" && entry.caseId.length > 0 &&
      !ids.has(entry.caseId) && typeof entry.category === "string" &&
      entry.category.length > 0 && typeof entry.text === "string" &&
      Buffer.byteLength(entry.text, "utf8") <= profile.execution.maximumInputBytes,
    "browser corpus case is invalid");
    ids.add(entry.caseId);
  }
  return Object.freeze({ ...parsed, value: corpus });
}

function validateExternalInput(filePath, expected, maximumBytes, label) {
  const file = readRegular(filePath, maximumBytes, label);
  invariant(path.basename(file.path) === expected.basename &&
    file.byteLength === expected.byteLength && sha256(file.bytes) === expected.sha256,
  `${label} identity changed`);
  return file;
}

function gitRevision() {
  const result = childProcess.spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    shell: false,
    windowsHide: true
  });
  invariant(result.status === 0 && !result.error, "source revision probe failed");
  const revision = result.stdout.trim();
  invariant(SOURCE_REVISION_PATTERN.test(revision), "source revision is invalid");
  return revision;
}

function processIsRunning(processId) {
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    throw error;
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function chromiumProcessIds(context) {
  const browser = context.browser();
  invariant(browser, "Chromium browser handle is unavailable");
  const session = await browser.newBrowserCDPSession();
  try {
    const processInfo = await session.send("SystemInfo.getProcessInfo");
    const ids = [...new Set(processInfo.processInfo.map((entry) => entry.id))];
    invariant(ids.length > 0 && ids.every((entry) =>
      Number.isSafeInteger(entry) && entry > 0), "Chromium process identities are unavailable");
    return ids;
  } finally {
    await session.detach();
  }
}

async function closeContext(context, processIds) {
  if (!context) return true;
  try {
    await context.close();
  } catch (_error) {
    // A crashed process is already closed; process identity remains authoritative.
  }
  const deadline = Date.now() + 15000;
  while (processIds.some(processIsRunning)) {
    invariant(Date.now() < deadline, "Chromium process closure timed out");
    await delay(25);
  }
  return true;
}

function browserOptions(chromiumPath, timeoutMs) {
  return {
    executablePath: chromiumPath,
    timeout: timeoutMs,
    headless: true,
    viewport: { width: 960, height: 720 },
    locale: "en-US",
    acceptDownloads: false,
    permissions: [],
    serviceWorkers: "block",
    args: [
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-sync",
      "--no-default-browser-check",
      "--no-first-run"
    ]
  };
}

async function withTimeout(promise, milliseconds, code) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(code)), milliseconds);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function executeInPage(page, input, profile, cancellationRequired) {
  return withTimeout(page.evaluate(async (value) => {
    const decodeBase64 = (encoded) => Uint8Array.from(
      atob(encoded), (character) => character.charCodeAt(0)
    );
    const finiteDuration = (start) => {
      const value = performance.now() - start;
      if (!Number.isFinite(value) || value < 0) throw new Error("invalid browser duration");
      return value;
    };
    const heap = () => {
      const memory = performance.memory;
      if (!memory) return { available: false, usedBytes: 0, totalBytes: 0, limitBytes: 0 };
      return {
        available: true,
        usedBytes: memory.usedJSHeapSize,
        totalBytes: memory.totalJSHeapSize,
        limitBytes: memory.jsHeapSizeLimit
      };
    };
    const moduleBytes = decodeBase64(value.moduleBase64);
    const artifactBytes = decodeBase64(value.artifactBase64);
    const started = performance.now();
    const instantiateStarted = performance.now();
    const tokenizer = await globalThis.TinyRustLMTokenizer2.instantiateTokenizer2(moduleBytes);
    const instantiateMs = finiteDuration(instantiateStarted);
    const memoryBeforeLoad = tokenizer.memoryBytes();
    const heapBeforeLoad = heap();
    const loadStarted = performance.now();
    const identity = tokenizer.load(artifactBytes);
    const loadMs = finiteDuration(loadStarted);
    const memoryAfterLoad = tokenizer.memoryBytes();
    const heapAfterLoad = heap();
    let highWaterMemory = memoryAfterLoad;
    let encodeMs = 0;
    let decodeIncludeAllMs = 0;
    let decodeSkipSpecialMs = 0;
    let totalTokenCount = 0;
    let maximumTokenCount = 0;
    const results = [];
    for (const entry of value.cases) {
      let operationStarted = performance.now();
      const tokenIds = Array.from(tokenizer.encode(entry.text));
      encodeMs += finiteDuration(operationStarted);
      operationStarted = performance.now();
      const decodeIncludeAll = tokenizer.decodeCurrent("include-all");
      decodeIncludeAllMs += finiteDuration(operationStarted);
      operationStarted = performance.now();
      const decodeSkipSpecial = tokenizer.decodeCurrent("skip-special");
      decodeSkipSpecialMs += finiteDuration(operationStarted);
      totalTokenCount += tokenIds.length;
      maximumTokenCount = Math.max(maximumTokenCount, tokenIds.length);
      highWaterMemory = Math.max(highWaterMemory, tokenizer.memoryBytes());
      results.push({
        caseId: entry.caseId,
        tokenIds,
        decodeIncludeAll,
        decodeSkipSpecial
      });
    }
    const memoryAfterCorpus = tokenizer.memoryBytes();
    const heapAfterCorpus = heap();

    const workerSource = `${value.adapterSource}\n` +
      `let tokenizer=null;let artifactIdentity=null;\n` +
      `self.onmessage=async(event)=>{try{const m=event.data;` +
      `if(m.kind==='load'){tokenizer=await self.TinyRustLMTokenizer2.` +
      `instantiateTokenizer2(new Uint8Array(m.module));artifactIdentity=` +
      `tokenizer.load(new Uint8Array(m.artifact));self.postMessage({kind:'loaded',` +
      `identity:artifactIdentity});return;}if(m.kind==='work'){` +
      `tokenizer.encode(m.text);tokenizer.decodeCurrent('include-all');` +
      `self.postMessage({kind:'started'});for(let i=1;i<m.iterations;i+=1){` +
      `tokenizer.encode(m.text);tokenizer.decodeCurrent('include-all');}` +
      `self.postMessage({kind:'completed'});return;}if(m.kind==='recover'){` +
      `const tokenIds=Array.from(tokenizer.encode(m.text));self.postMessage({` +
      `kind:'recovered',tokenIds,includeAll:tokenizer.decodeCurrent('include-all'),` +
      `skipSpecial:tokenizer.decodeCurrent('skip-special')});}}catch(error){` +
      `self.postMessage({kind:'failed',code:error&&typeof error.code==='string'?` +
      `error.code:'tokenizer2_worker_failed'});}};`;
    const workerUrl = URL.createObjectURL(new Blob([workerSource], {
      type: "text/javascript"
    }));
    const waitMessage = (worker, expected, timeoutMs) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("worker message timed out")), timeoutMs);
      const listener = (event) => {
        if (event.data?.kind === "failed") {
          clearTimeout(timer);
          worker.removeEventListener("message", listener);
          reject(new Error(event.data.code));
        } else if (event.data?.kind === expected) {
          clearTimeout(timer);
          worker.removeEventListener("message", listener);
          resolve(event.data);
        }
      };
      worker.addEventListener("message", listener);
    });
    let cancellation = null;
    if (value.cancellationRequired) {
      const cancelledWorker = new Worker(workerUrl);
      const moduleCopy = moduleBytes.slice().buffer;
      const artifactCopy = artifactBytes.slice().buffer;
      const loadedPromise = waitMessage(
        cancelledWorker, "loaded", value.workerLoadTimeoutMs
      );
      cancelledWorker.postMessage({
        kind: "load", module: moduleCopy, artifact: artifactCopy
      }, [moduleCopy, artifactCopy]);
      const loaded = await loadedPromise;
      const completedMessages = [];
      cancelledWorker.addEventListener("message", (event) => {
        if (event.data?.kind === "completed") completedMessages.push("completed");
      });
      const startedPromise = waitMessage(
        cancelledWorker, "started", value.workerLoadTimeoutMs
      );
      cancelledWorker.postMessage({
        kind: "work",
        iterations: value.workerCancellationIterations,
        text: value.cancellationText
      });
      await startedPromise;
      cancelledWorker.terminate();
      await new Promise((resolve) => setTimeout(
        resolve, value.workerPostTerminationQuietMs
      ));
      if (completedMessages.length !== 0) throw new Error("cancelled worker completed");

      const recoveryWorker = new Worker(workerUrl);
      const recoveryModule = moduleBytes.slice().buffer;
      const recoveryArtifact = artifactBytes.slice().buffer;
      const recoveryLoadedPromise = waitMessage(
        recoveryWorker, "loaded", value.workerLoadTimeoutMs
      );
      recoveryWorker.postMessage({
        kind: "load", module: recoveryModule, artifact: recoveryArtifact
      }, [recoveryModule, recoveryArtifact]);
      const recoveryLoaded = await recoveryLoadedPromise;
      const recoveryPromise = waitMessage(
        recoveryWorker, "recovered", value.workerLoadTimeoutMs
      );
      recoveryWorker.postMessage({ kind: "recover", text: value.recoveryCase.text });
      const recovered = await recoveryPromise;
      recoveryWorker.terminate();
      cancellation = {
        workerLoadedIdentity: loaded.identity,
        startedRealWork: true,
        workerTerminated: true,
        completionObserved: false,
        quietPeriodMs: value.workerPostTerminationQuietMs,
        recoveryLoadedIdentity: recoveryLoaded.identity,
        recoveryCaseId: value.recoveryCase.caseId,
        recoveryTokenIds: recovered.tokenIds,
        recoveryDecodeIncludeAll: recovered.includeAll,
        recoveryDecodeSkipSpecial: recovered.skipSpecial
      };
    }
    URL.revokeObjectURL(workerUrl);
    tokenizer.clear();
    const memoryAfterClear = tokenizer.memoryBytes();
    return {
      identity,
      summary: {
        caseCount: results.length,
        totalTokenCount,
        maximumTokenCount
      },
      results,
      resources: {
        instantiateMs,
        artifactLoadMs: loadMs,
        corpusEncodeMs: encodeMs,
        corpusDecodeIncludeAllMs: decodeIncludeAllMs,
        corpusDecodeSkipSpecialMs: decodeSkipSpecialMs,
        totalMs: finiteDuration(started),
        wasmLinearMemoryBytes: {
          beforeLoad: memoryBeforeLoad,
          afterLoad: memoryAfterLoad,
          afterCorpus: memoryAfterCorpus,
          highWater: highWaterMemory,
          afterClear: memoryAfterClear
        },
        javascriptHeap: {
          beforeLoad: heapBeforeLoad,
          afterLoad: heapAfterLoad,
          afterCorpus: heapAfterCorpus
        }
      },
      cancellation
    };
  }, {
    moduleBase64: input.wasm.bytes.toString("base64"),
    artifactBase64: input.artifact.bytes.toString("base64"),
    adapterSource: input.adapter.bytes.toString("utf8"),
    cases: input.corpus.value.cases,
    cancellationRequired,
    cancellationText: input.cancellationCase.text,
    recoveryCase: input.recoveryCase,
    workerLoadTimeoutMs: profile.execution.workerLoadTimeoutMs,
    workerCancellationIterations: profile.execution.workerCancellationIterations,
    workerPostTerminationQuietMs: profile.execution.workerPostTerminationQuietMs
  }), profile.execution.browserOperationTimeoutMs,
  "browser Tokenizer2 operation timed out");
}

function validatePageResult(pageResult, profile, input, cancellationRequired) {
  exactKeys(pageResult, ["identity", "summary", "results", "resources", "cancellation"],
    "browser page result");
  exactValue(pageResult.identity, {
    byteLength: profile.artifact.byteLength,
    sha256: profile.artifact.sha256,
    tokenCount: profile.artifact.tokenCount,
    baseTokenCount: profile.artifact.baseTokenCount
  }, "browser artifact identity");
  invariant(
    pageResult.identity.tokenCount - pageResult.identity.baseTokenCount ===
      profile.artifact.addedTokenCount,
    "browser artifact added-token count is invalid"
  );
  exactKeys(pageResult.summary,
    ["caseCount", "totalTokenCount", "maximumTokenCount"], "browser summary");
  invariant(pageResult.summary.caseCount === profile.execution.fullCorpusCaseCount &&
    Array.isArray(pageResult.results) &&
    pageResult.results.length === profile.execution.fullCorpusCaseCount,
  "browser result count is invalid");
  for (const [index, result] of pageResult.results.entries()) {
    exactKeys(result, [
      "caseId", "tokenIds", "decodeIncludeAll", "decodeSkipSpecial"
    ], `browser result ${index}`);
    invariant(result.caseId === input.corpus.value.cases[index].caseId &&
      Array.isArray(result.tokenIds) &&
      result.tokenIds.length <= profile.execution.maximumOutputTokens &&
      result.tokenIds.every((token) => Number.isSafeInteger(token) &&
        token >= 0 && token < pageResult.identity.tokenCount) &&
      typeof result.decodeIncludeAll === "string" &&
      Buffer.byteLength(result.decodeIncludeAll, "utf8") <=
        profile.execution.maximumDecodedBytes &&
      typeof result.decodeSkipSpecial === "string" &&
      Buffer.byteLength(result.decodeSkipSpecial, "utf8") <=
        profile.execution.maximumDecodedBytes,
    `browser result ${index} is invalid`);
  }
  exactKeys(pageResult.resources, [
    "instantiateMs", "artifactLoadMs", "corpusEncodeMs",
    "corpusDecodeIncludeAllMs", "corpusDecodeSkipSpecialMs", "totalMs",
    "wasmLinearMemoryBytes", "javascriptHeap"
  ], "browser resources");
  for (const key of [
    "instantiateMs", "artifactLoadMs", "corpusEncodeMs",
    "corpusDecodeIncludeAllMs", "corpusDecodeSkipSpecialMs", "totalMs"
  ]) {
    invariant(Number.isFinite(pageResult.resources[key]) &&
      pageResult.resources[key] >= 0 &&
      pageResult.resources[key] <= profile.execution.browserOperationTimeoutMs,
    `browser resource ${key} is invalid`);
  }
  exactKeys(pageResult.resources.wasmLinearMemoryBytes,
    ["beforeLoad", "afterLoad", "afterCorpus", "highWater", "afterClear"],
    "WASM linear memory");
  for (const value of Object.values(pageResult.resources.wasmLinearMemoryBytes)) {
    invariant(Number.isSafeInteger(value) && value > 0 &&
      value <= profile.execution.maximumWasmLinearMemoryBytes,
    "WASM linear memory is invalid");
  }
  invariant(pageResult.resources.wasmLinearMemoryBytes.highWater >=
    pageResult.resources.wasmLinearMemoryBytes.beforeLoad &&
    pageResult.resources.wasmLinearMemoryBytes.highWater >=
      pageResult.resources.wasmLinearMemoryBytes.afterLoad &&
    pageResult.resources.wasmLinearMemoryBytes.highWater >=
      pageResult.resources.wasmLinearMemoryBytes.afterCorpus,
  "WASM linear-memory high-water mark is invalid");
  exactKeys(pageResult.resources.javascriptHeap,
    ["beforeLoad", "afterLoad", "afterCorpus"], "JavaScript heap resources");
  for (const [stage, sample] of Object.entries(pageResult.resources.javascriptHeap)) {
    exactKeys(sample, ["available", "usedBytes", "totalBytes", "limitBytes"],
      `JavaScript heap ${stage}`);
    invariant(typeof sample.available === "boolean" &&
      [sample.usedBytes, sample.totalBytes, sample.limitBytes].every((entry) =>
        Number.isSafeInteger(entry) && entry >= 0) &&
      (sample.available ||
        sample.usedBytes + sample.totalBytes + sample.limitBytes === 0),
    `JavaScript heap ${stage} is invalid`);
  }
  if (cancellationRequired) {
    invariant(isPlainObject(pageResult.cancellation) &&
      pageResult.cancellation.startedRealWork === true &&
      pageResult.cancellation.workerTerminated === true &&
      pageResult.cancellation.completionObserved === false &&
      pageResult.cancellation.recoveryCaseId === input.recoveryCase.caseId,
    "worker cancellation evidence is invalid");
    exactValue(pageResult.cancellation.workerLoadedIdentity, pageResult.identity,
      "cancelled-worker identity");
    exactValue(pageResult.cancellation.recoveryLoadedIdentity, pageResult.identity,
      "recovery-worker identity");
  } else {
    invariant(pageResult.cancellation === null, "unexpected cancellation evidence");
  }
  return pageResult;
}

async function executeRun(input, profile, runNumber, profileParent, chromiumPath) {
  const root = createOwnedProfileRoot({
    parentDirectory: profileParent,
    campaignId: "qwen3-tokenizer2-browser-wasm-20260821-v1"
  });
  const browserProfile = createOwnedBrowserProfile(root, {
    round: runNumber,
    role: "full-artifact-tokenizer2-wasm"
  });
  assertOwnedProfileFresh(root, browserProfile);
  let context = null;
  let processIds = [];
  let browserVersion = null;
  let pageResult = null;
  let networkRequestCount = 0;
  let consoleErrorCount = 0;
  let pageErrorCount = 0;
  let executionError = null;
  let deletion = null;
  let rootDeleted = false;
  try {
    context = await chromium.launchPersistentContext(
      browserProfile.profilePath,
      browserOptions(chromiumPath, profile.execution.browserOperationTimeoutMs)
    );
    context.setDefaultTimeout(profile.execution.browserOperationTimeoutMs);
    context.setDefaultNavigationTimeout(profile.execution.browserOperationTimeoutMs);
    processIds = await chromiumProcessIds(context);
    browserVersion = context.browser()?.version() || null;
    invariant(browserVersion === profile.browser.chromium.version,
      "Chromium version changed");
    await context.route("**/*", async (route) => {
      networkRequestCount += 1;
      await route.abort("blockedbyclient");
    });
    const page = context.pages()[0] || await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrorCount += 1;
    });
    page.on("pageerror", () => {
      pageErrorCount += 1;
    });
    await page.setContent("<!doctype html><meta charset=\"utf-8\"><title>Tokenizer2 gate</title>");
    invariant(page.url() === profile.browser.pageOrigin, "browser page origin changed");
    await page.addScriptTag({ content: input.adapter.bytes.toString("utf8") });
    pageResult = await executeInPage(
      page,
      input,
      profile,
      runNumber === profile.execution.cancellationRun
    );
    validatePageResult(
      pageResult,
      profile,
      input,
      runNumber === profile.execution.cancellationRun
    );
    invariant(networkRequestCount === 0, "browser network request budget exceeded");
    invariant(consoleErrorCount === 0, "browser console error budget exceeded");
    invariant(pageErrorCount === 0, "browser page error budget exceeded");
  } catch (error) {
    executionError = error;
  } finally {
    try {
      await closeContext(context, processIds);
    } catch (error) {
      if (!executionError) executionError = error;
    }
    try {
      deletion = deleteOwnedBrowserProfile(root, browserProfile);
      rootDeleted = removeOwnedProfileRoot(root);
    } catch (error) {
      if (!executionError) executionError = error;
    }
  }
  if (executionError) throw executionError;
  invariant(deletion?.deleted === true && rootDeleted === true,
    "browser profile deletion was not proven");
  return Object.freeze({
    schema: RESULT_SCHEMA,
    profileId: PROFILE_ID,
    status: "raw-full-artifact-browser-observation",
    observedAtUtc: new Date().toISOString(),
    sourceRevision: input.sourceRevision,
    preregistrationSha256: input.preregistration.sha256,
    runNumber,
    browser: {
      engine: "chromium",
      version: browserVersion,
      executableSha256: profile.browser.chromium.sha256,
      processCount: processIds.length,
      processClosureProven: true,
      pageOrigin: profile.browser.pageOrigin
    },
    artifact: pageResult.identity,
    corpus: {
      corpusId: profile.corpus.corpusId,
      sha256: profile.corpus.sha256,
      caseCount: profile.corpus.caseCount
    },
    wasm: {
      moduleSha256: profile.wasm.module.sha256,
      moduleByteLength: profile.wasm.module.byteLength,
      interfaceSha256: profile.wasm.interface.sha256,
      adapterSha256: profile.wasm.adapter.sha256
    },
    summary: pageResult.summary,
    results: pageResult.results,
    resources: pageResult.resources,
    cancellation: pageResult.cancellation,
    isolation: {
      networkRequestCount,
      consoleErrorCount,
      pageErrorCount,
      profileDeletion: deletion,
      profileRootDeleted: rootDeleted
    }
  });
}

function validateOutputParent(parentPath, profileParent) {
  const outputParent = path.resolve(parentPath);
  const browserProfileParent = path.resolve(profileParent);
  for (const [value, label] of [
    [outputParent, "output parent"],
    [browserProfileParent, "profile parent"]
  ]) {
    invariant(path.isAbsolute(value), `${label} must be absolute`);
    const stat = fs.lstatSync(value);
    invariant(stat.isDirectory() && !stat.isSymbolicLink(),
      `${label} must be an existing regular directory`);
    invariant(!value.toLowerCase().startsWith(repositoryRoot.toLowerCase()),
      `${label} must remain outside Git`);
  }
  invariant(outputParent !== browserProfileParent,
    "output and browser-profile parents must be distinct");
  return Object.freeze({ outputParent, browserProfileParent });
}

function boundedFailureCode(error) {
  const message = String(error?.message || "browser-tokenizer2-run-failed")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 96);
  return SAFE_CODE_PATTERN.test(message) ? message : "browser-tokenizer2-run-failed";
}

async function execute(options) {
  const preregistration = validatePreregistrationFile();
  const profile = preregistration.profile;
  const roots = validateOutputParent(options.outputParent, options.profileParent);
  const outputRoot = path.join(
    roots.outputParent, profile.execution.outputDirectoryName
  );
  invariant(!fs.existsSync(outputRoot), "registered output root already exists");
  fs.mkdirSync(outputRoot, { recursive: false });
  let completedRuns = 0;
  try {
    const artifact = validateExternalInput(
      options.artifactPath, profile.artifact, profile.artifact.byteLength, "artifact"
    );
    const corpus = validateCorpus(options.corpusPath, profile);
    const wasm = validateExternalInput(
      options.wasmPath, profile.wasm.module, profile.wasm.module.byteLength, "WASM module"
    );
    const nativeReceipt = validateExternalInput(
      options.nativeReceiptPath, profile.nativeEvidence.receipt,
      MAXIMUM_NATIVE_BYTES, "native receipt"
    );
    const nativeResult = validateExternalInput(
      options.nativeResultPath, profile.nativeEvidence.candidateResult,
      MAXIMUM_NATIVE_BYTES, "native candidate result"
    );
    const adapter = validateExternalInput(
      adapterPath, {
        basename: path.basename(profile.wasm.adapter.path),
        byteLength: profile.wasm.adapter.byteLength,
        sha256: profile.wasm.adapter.sha256
      }, MAXIMUM_PROFILE_BYTES, "browser adapter"
    );
    const chromiumFile = readRegular(
      options.chromiumPath, profile.browser.chromium.byteLength, "Chromium executable"
    );
    invariant(chromiumFile.byteLength === profile.browser.chromium.byteLength &&
      sha256(chromiumFile.bytes) === profile.browser.chromium.sha256,
    "Chromium executable identity changed");
    const playwrightManifestPath = require.resolve("@playwright/test/package.json");
    const playwrightManifest = readRegular(
      playwrightManifestPath, profile.browser.playwright.byteLength, "Playwright manifest"
    );
    invariant(playwrightManifest.byteLength === profile.browser.playwright.byteLength &&
      sha256(playwrightManifest.bytes) === profile.browser.playwright.sha256 &&
      JSON.parse(playwrightManifest.bytes).version === profile.browser.playwright.version,
    "Playwright identity changed");
    const recoveryCase = corpus.value.cases[0];
    const cancellationCase = corpus.value.cases.reduce((longest, entry) =>
      Buffer.byteLength(entry.text, "utf8") > Buffer.byteLength(longest.text, "utf8")
        ? entry : longest
    );
    const input = Object.freeze({
      preregistration,
      sourceRevision: gitRevision(),
      artifact,
      corpus,
      wasm,
      nativeReceipt,
      nativeResult,
      adapter,
      recoveryCase,
      cancellationCase
    });
    for (let runNumber = 1;
      runNumber <= profile.execution.requiredIndependentRuns;
      runNumber += 1) {
      const result = await executeRun(
        input, profile, runNumber, roots.browserProfileParent, chromiumFile.path
      );
      const bytes = canonicalBytes(result);
      invariant(bytes.length <= profile.execution.maximumRunResultBytes,
        "browser run result exceeded its byte limit");
      atomicCreate(
        path.join(outputRoot, profile.execution.runFiles[runNumber - 1]), bytes
      );
      completedRuns += 1;
    }
    const postObservationPreregistration = validatePreregistrationFile();
    invariant(postObservationPreregistration.sha256 === preregistration.sha256 &&
      sha256File(artifact.path) === profile.artifact.sha256 &&
      sha256File(wasm.path) === profile.wasm.module.sha256 &&
      sha256File(nativeReceipt.path) === profile.nativeEvidence.receipt.sha256 &&
      sha256File(nativeResult.path) === profile.nativeEvidence.candidateResult.sha256 &&
      sha256File(chromiumFile.path) === profile.browser.chromium.sha256,
    "post-observation input identity changed");
    return Object.freeze({
      status: "raw-browser-runs-preserved-awaiting-verification",
      outputDirectoryName: profile.execution.outputDirectoryName,
      completedRuns
    });
  } catch (error) {
    const failure = Object.freeze({
      schema: FAILURE_SCHEMA,
      profileId: PROFILE_ID,
      status: "terminal-browser-runner-failure",
      observedAtUtc: new Date().toISOString(),
      preregistrationSha256: preregistration.sha256,
      completedRuns,
      failure: {
        code: boundedFailureCode(error),
        retrySelected: false,
        rawRunsPreserved: true
      }
    });
    atomicCreate(path.join(outputRoot, profile.execution.failureFile), canonicalBytes(failure));
    throw error;
  }
}

function parseCli(argv) {
  invariant(argv.length === 9 && argv[0] === "--execute",
    "usage: --execute <artifact> <corpus> <wasm> <native-receipt> " +
      "<native-result> <output-parent> <profile-parent> <chromium>");
  return Object.freeze({
    artifactPath: argv[1],
    corpusPath: argv[2],
    wasmPath: argv[3],
    nativeReceiptPath: argv[4],
    nativeResultPath: argv[5],
    outputParent: argv[6],
    profileParent: argv[7],
    chromiumPath: argv[8]
  });
}

async function main() {
  try {
    const result = await execute(parseCli(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${boundedFailureCode(error)}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) void main();

module.exports = Object.freeze({
  RESULT_SCHEMA,
  canonicalBytes,
  execute,
  executeInPage,
  sha256,
  sourceClosureSha256,
  validatePageResult,
  validatePreregistration,
  validatePreregistrationFile
});
