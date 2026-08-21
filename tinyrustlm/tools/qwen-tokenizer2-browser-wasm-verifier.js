"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { isDeepStrictEqual } = require("node:util");

const { atomicCreate } = require("./durable-files.js");
const {
  RESULT_SCHEMA,
  canonicalBytes,
  validatePreregistrationFile
} = require("./qwen-tokenizer2-browser-wasm-runner.js");
const { parseStrictJson } = require("./strict-json.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const verificationProfilePath = path.join(
  repositoryRoot,
  "contracts/vnext/qwen-tokenizer2-browser-wasm-verification-preregistration.v1.json"
);
const EXECUTION_PROFILE_SCHEMA =
  "tinyrustlm.vnext.qwen-tokenizer2-browser-wasm-preregistration.v1";
const VERIFICATION_PROFILE_SCHEMA =
  "tinyrustlm.vnext.qwen-tokenizer2-browser-wasm-verification-preregistration.v1";
const VERIFICATION_PROFILE_ID =
  "tinyrustlm.qwen-tokenizer2-browser-wasm-verification/1";
const VERIFICATION_RESULT_SCHEMA =
  "tinyrustlm.qwen_tokenizer2_browser_wasm_verification_result.v1";
const MAXIMUM_PROFILE_BYTES = 1024 * 1024;
const MAXIMUM_RESULT_BYTES = 64 * 1024 * 1024;
const MAXIMUM_RECEIPT_BYTES = 1024 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;
const SAFE_CODE_PATTERN = /^[a-z][a-z0-9-]{2,95}$/u;
const FORBIDDEN_PUBLIC_TEXT =
  /(?:[a-z]:\\|\/home\/|\/mnt\/[a-z]\/|bearer\s|token=|secret=|invite)/iu;

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
  invariant(isDeepStrictEqual(actual, expected), `${label} is invalid`);
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function requireDigest(value, label) {
  invariant(typeof value === "string" && SHA256_PATTERN.test(value) &&
    !/^0{64}$/u.test(value), `${label} is invalid`);
}

function readRegular(filePath, maximumBytes, label) {
  const resolved = path.resolve(filePath);
  const stat = fs.lstatSync(resolved);
  invariant(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 &&
    stat.size <= maximumBytes, `${label} must be a bounded regular file`);
  return Object.freeze({
    path: resolved,
    bytes: fs.readFileSync(resolved),
    byteLength: stat.size,
    sha256: null
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
  return Object.freeze({
    ...file,
    sha256: sha256(file.bytes),
    value
  });
}

function validateRepositoryIdentity(entry, label) {
  exactKeys(entry, ["path", "byteLength", "sha256"], label);
  invariant(typeof entry.path === "string" && entry.path.length > 0 &&
    !entry.path.includes("\\") && !path.posix.isAbsolute(entry.path) &&
    entry.path.split("/").every((part) => part.length > 0 &&
      part !== "." && part !== ".."), `${label} path is invalid`);
  invariant(Number.isSafeInteger(entry.byteLength) && entry.byteLength > 0,
    `${label} byte length is invalid`);
  requireDigest(entry.sha256, `${label} SHA-256`);
  const file = readRegular(
    path.join(repositoryRoot, ...entry.path.split("/")), entry.byteLength, label
  );
  invariant(file.byteLength === entry.byteLength && sha256(file.bytes) === entry.sha256,
    `${label} identity changed`);
}

function validateVerificationProfile(value, execution) {
  exactKeys(value, [
    "schema", "profileId", "status", "registeredAtUtc", "registrationParentCommit",
    "executionPreregistration", "verifier", "runSet", "comparison", "result",
    "claimBoundary"
  ], "browser verification profile");
  invariant(value.schema === VERIFICATION_PROFILE_SCHEMA &&
    value.profileId === VERIFICATION_PROFILE_ID &&
    value.status === "registered-before-full-artifact-browser-output" &&
    value.registrationParentCommit ===
      "21a6b733959ad48c9c04cbcb08f47cf4e55fa99f",
  "browser verification profile identity is invalid");
  exactKeys(value.executionPreregistration,
    ["path", "schema", "profileId", "byteLength", "sha256"],
    "execution preregistration identity");
  invariant(value.executionPreregistration.path ===
    "contracts/vnext/qwen-tokenizer2-browser-wasm-preregistration.v1.json" &&
    value.executionPreregistration.schema === EXECUTION_PROFILE_SCHEMA &&
    value.executionPreregistration.profileId === execution.profile.profileId &&
    value.executionPreregistration.byteLength === execution.bytes.length &&
    value.executionPreregistration.sha256 === execution.sha256,
  "execution preregistration identity changed");
  exactKeys(value.verifier,
    ["implementation", "version", "scriptPath", "scriptByteLength", "scriptSha256"],
    "browser verifier");
  invariant(value.verifier.implementation ===
    "tinyrustlm-qwen-tokenizer2-browser-wasm-verifier" &&
    value.verifier.version === "1" &&
    value.verifier.scriptPath ===
      "tinyrustlm/tools/qwen-tokenizer2-browser-wasm-verifier.js",
  "browser verifier identity is invalid");
  validateRepositoryIdentity({
    path: value.verifier.scriptPath,
    byteLength: value.verifier.scriptByteLength,
    sha256: value.verifier.scriptSha256
  }, "browser verifier script");
  exactValue(value.runSet, {
    outputDirectoryName: execution.profile.execution.outputDirectoryName,
    browserRunFiles: execution.profile.execution.runFiles,
    resultFile: "browser-wasm-verification-result.v1.json",
    requiredVerifierRuns: 1,
    createOnlyResult: true,
    priorRunReuseAllowed: false
  }, "browser verification run set");
  exactValue(value.comparison, {
    caseOrder: "exact",
    tokenIds: "exact-u32-arrays",
    decodeIncludeAll: "exact-unicode-string",
    decodeSkipSpecial: "exact-unicode-string",
    nativeResultAuthority: "registered-v2-candidate-run-1",
    browserRunsRequired: 2,
    mismatchIsFatal: true,
    objectMemberOrder: "nonsemantic",
    arrayOrder: "semantic",
    repair: false,
    bestOfN: false
  }, "browser comparison");
  exactValue(value.result, {
    schema: VERIFICATION_RESULT_SCHEMA,
    maximumBytes: 1048576,
    includePromptText: false,
    includeDecodedText: false,
    includeTokenIds: false,
    includePrivateAbsolutePaths: false,
    failurePreservedAtSameCreateOnlyPath: true
  }, "browser verification result");
  exactValue(value.claimBoundary, {
    tokenizerSourceParityRemainsVerified: true,
    tokenizerBrowserWasmParityMayBeClaimedAfterPass: true,
    modelRuntimeMayBeClaimed: false,
    modelQualityMayBeClaimed: false,
    releaseMayBeClaimed: false,
    campaignCreditMayBeClaimed: false,
    requiredNextGate: "template2-byte-profile-and-source-parity"
  }, "browser verification claim boundary");
  return value;
}

function validateVerificationProfileFile(execution,
  filePath = verificationProfilePath) {
  const parsed = readJson(filePath, MAXIMUM_PROFILE_BYTES,
    "browser verification profile");
  const profile = validateVerificationProfile(parsed.value, execution);
  invariant(parsed.bytes.equals(canonicalBytes(profile)),
    "browser verification profile is not canonical");
  return Object.freeze({
    profile,
    bytes: parsed.bytes,
    sha256: parsed.sha256
  });
}

function validateNativeReceipt(filePath, profile) {
  const expected = profile.nativeEvidence.receipt;
  const parsed = readJson(filePath, MAXIMUM_RECEIPT_BYTES, "native parity receipt");
  invariant(path.basename(parsed.path) === expected.basename &&
    parsed.byteLength === expected.byteLength && parsed.sha256 === expected.sha256,
  "native parity receipt identity changed");
  const value = parsed.value;
  invariant(value.schema ===
    "tinyrustlm.qwen_tokenizer2_parity_verification_receipt.v2" &&
    value.profileId === "tinyrustlm.qwen-tokenizer2-source-parity-verification/2" &&
    value.status === "exact-source-parity-verified" &&
    value.comparison?.caseCount === profile.corpus.caseCount &&
    value.comparison?.mismatchCount === 0 &&
    Array.isArray(value.comparison?.mismatches) &&
    value.comparison.mismatches.length === 0 &&
    value.claimBoundary?.tokenizerSourceParityVerified === true &&
    value.claimBoundary?.browserWasmVerified === false,
  "native parity receipt authority is invalid");
  return parsed;
}

function validateResultRows(results, caseCount, tokenCount, label) {
  invariant(Array.isArray(results) && results.length === caseCount,
    `${label} result count is invalid`);
  const ids = new Set();
  for (const [index, entry] of results.entries()) {
    exactKeys(entry, [
      "caseId", "tokenIds", "decodeIncludeAll", "decodeSkipSpecial"
    ], `${label} result ${index}`);
    invariant(typeof entry.caseId === "string" && entry.caseId.length > 0 &&
      !ids.has(entry.caseId) && Array.isArray(entry.tokenIds) &&
      entry.tokenIds.every((token) => Number.isSafeInteger(token) &&
        token >= 0 && token < tokenCount) &&
      typeof entry.decodeIncludeAll === "string" &&
      typeof entry.decodeSkipSpecial === "string",
    `${label} result ${index} is invalid`);
    ids.add(entry.caseId);
  }
}

function validateNativeResult(filePath, profile) {
  const expected = profile.nativeEvidence.candidateResult;
  const parsed = readJson(filePath, MAXIMUM_RESULT_BYTES, "native candidate result");
  invariant(path.basename(parsed.path) === expected.basename &&
    parsed.byteLength === expected.byteLength && parsed.sha256 === expected.sha256,
  "native candidate result identity changed");
  const value = parsed.value;
  invariant(value.schema === "tinyrustlm.qwen_tokenizer2_parity_result.v1" &&
    value.implementation?.kind === "candidate" &&
    value.implementation?.name === "tinyrustlm-tokenizer2" &&
    value.artifact?.byteLength === profile.artifact.byteLength &&
    value.artifact?.sha256 === profile.artifact.sha256 &&
    value.corpus?.corpusId === profile.corpus.corpusId &&
    value.corpus?.sha256 === profile.corpus.sha256 &&
    value.summary?.caseCount === profile.corpus.caseCount,
  "native candidate result authority is invalid");
  validateResultRows(value.results, profile.corpus.caseCount,
    profile.artifact.tokenCount,
    "native candidate");
  return parsed;
}

function validateResourceRecord(resources, execution, label) {
  exactKeys(resources, [
    "instantiateMs", "artifactLoadMs", "corpusEncodeMs",
    "corpusDecodeIncludeAllMs", "corpusDecodeSkipSpecialMs", "totalMs",
    "wasmLinearMemoryBytes", "javascriptHeap"
  ], `${label} resources`);
  for (const key of [
    "instantiateMs", "artifactLoadMs", "corpusEncodeMs",
    "corpusDecodeIncludeAllMs", "corpusDecodeSkipSpecialMs", "totalMs"
  ]) {
    invariant(Number.isFinite(resources[key]) && resources[key] >= 0 &&
      resources[key] <= execution.browserOperationTimeoutMs,
    `${label} ${key} is invalid`);
  }
  exactKeys(resources.wasmLinearMemoryBytes,
    ["beforeLoad", "afterLoad", "afterCorpus", "highWater", "afterClear"],
    `${label} WASM memory`);
  for (const value of Object.values(resources.wasmLinearMemoryBytes)) {
    invariant(Number.isSafeInteger(value) && value > 0 &&
      value <= execution.maximumWasmLinearMemoryBytes,
    `${label} WASM memory is invalid`);
  }
}

function validateBrowserResult(filePath, expectedRun, execution, verification) {
  const parsed = readJson(filePath, MAXIMUM_RESULT_BYTES,
    `browser run ${expectedRun}`);
  const expectedName = execution.profile.execution.runFiles[expectedRun - 1];
  invariant(path.basename(parsed.path) === expectedName &&
    path.basename(path.dirname(parsed.path)) ===
      execution.profile.execution.outputDirectoryName,
  `browser run ${expectedRun} path identity is invalid`);
  const value = parsed.value;
  exactKeys(value, [
    "schema", "profileId", "status", "observedAtUtc", "sourceRevision",
    "preregistrationSha256", "runNumber", "browser", "artifact", "corpus",
    "wasm", "summary", "results", "resources", "cancellation", "isolation"
  ], `browser run ${expectedRun}`);
  invariant(value.schema === RESULT_SCHEMA &&
    value.profileId === execution.profile.profileId &&
    value.status === "raw-full-artifact-browser-observation" &&
    UTC_PATTERN.test(value.observedAtUtc) &&
    /^[a-f0-9]{40}$/u.test(value.sourceRevision) &&
    value.preregistrationSha256 === execution.sha256 &&
    value.runNumber === expectedRun,
  `browser run ${expectedRun} identity is invalid`);
  exactValue(value.artifact, {
    byteLength: execution.profile.artifact.byteLength,
    sha256: execution.profile.artifact.sha256,
    tokenCount: execution.profile.artifact.tokenCount,
    baseTokenCount: execution.profile.artifact.baseTokenCount
  }, `browser run ${expectedRun} artifact`);
  exactValue(value.corpus, {
    corpusId: execution.profile.corpus.corpusId,
    sha256: execution.profile.corpus.sha256,
    caseCount: execution.profile.corpus.caseCount
  }, `browser run ${expectedRun} corpus`);
  exactValue(value.wasm, {
    moduleSha256: execution.profile.wasm.module.sha256,
    moduleByteLength: execution.profile.wasm.module.byteLength,
    interfaceSha256: execution.profile.wasm.interface.sha256,
    adapterSha256: execution.profile.wasm.adapter.sha256
  }, `browser run ${expectedRun} WASM`);
  exactKeys(value.browser, [
    "engine", "version", "executableSha256", "processCount",
    "processClosureProven", "pageOrigin"
  ], `browser run ${expectedRun} browser`);
  invariant(value.browser.engine === "chromium" &&
    value.browser.version === execution.profile.browser.chromium.version &&
    value.browser.executableSha256 === execution.profile.browser.chromium.sha256 &&
    Number.isSafeInteger(value.browser.processCount) && value.browser.processCount > 0 &&
    value.browser.processClosureProven === true &&
    value.browser.pageOrigin === execution.profile.browser.pageOrigin,
  `browser run ${expectedRun} browser evidence is invalid`);
  exactKeys(value.summary,
    ["caseCount", "totalTokenCount", "maximumTokenCount"],
    `browser run ${expectedRun} summary`);
  invariant(value.summary.caseCount === execution.profile.corpus.caseCount,
    `browser run ${expectedRun} summary is invalid`);
  validateResultRows(value.results, execution.profile.corpus.caseCount,
    execution.profile.artifact.tokenCount,
    `browser run ${expectedRun}`);
  validateResourceRecord(value.resources, execution.profile.execution,
    `browser run ${expectedRun}`);
  exactKeys(value.isolation, [
    "networkRequestCount", "consoleErrorCount", "pageErrorCount",
    "profileDeletion", "profileRootDeleted"
  ], `browser run ${expectedRun} isolation`);
  invariant(value.isolation.networkRequestCount === 0 &&
    value.isolation.consoleErrorCount === 0 &&
    value.isolation.pageErrorCount === 0 &&
    value.isolation.profileDeletion?.deleted === true &&
    value.isolation.profileRootDeleted === true,
  `browser run ${expectedRun} isolation evidence is invalid`);
  if (expectedRun === execution.profile.execution.cancellationRun) {
    invariant(isPlainObject(value.cancellation) &&
      value.cancellation.startedRealWork === true &&
      value.cancellation.workerTerminated === true &&
      value.cancellation.completionObserved === false &&
      value.cancellation.quietPeriodMs ===
        execution.profile.execution.workerPostTerminationQuietMs,
    "worker cancellation evidence is invalid");
  } else {
    invariant(value.cancellation === null,
      `browser run ${expectedRun} has unexpected cancellation evidence`);
  }
  invariant(parsed.bytes.equals(canonicalBytes(value)),
    `browser run ${expectedRun} is not canonical`);
  invariant(parsed.byteLength <= verification.profile.result.maximumBytes * 64,
    `browser run ${expectedRun} exceeds its registered bound`);
  return parsed;
}

function compareResults(native, browserRuns, execution) {
  const nativeValue = native.value;
  const mismatches = [];
  for (const run of browserRuns) {
    if (!isDeepStrictEqual(run.value.summary, nativeValue.summary)) {
      mismatches.push(`run-${run.value.runNumber}-summary`);
    }
    for (let index = 0; index < nativeValue.results.length; index += 1) {
      if (!isDeepStrictEqual(run.value.results[index], nativeValue.results[index])) {
        mismatches.push(`run-${run.value.runNumber}-case-${index}`);
        if (mismatches.length >= 128) break;
      }
    }
  }
  const first = browserRuns[0].value;
  const second = browserRuns[1].value;
  if (!isDeepStrictEqual(first.summary, second.summary) ||
      !isDeepStrictEqual(first.results, second.results)) {
    mismatches.push("browser-run-repeat-mismatch");
  }
  const cancellation = first.cancellation;
  const recoveryIndex = nativeValue.results.findIndex((entry) =>
    entry.caseId === cancellation.recoveryCaseId);
  invariant(recoveryIndex >= 0, "worker recovery case is unknown");
  const expected = nativeValue.results[recoveryIndex];
  if (!isDeepStrictEqual(cancellation.recoveryTokenIds, expected.tokenIds) ||
      cancellation.recoveryDecodeIncludeAll !== expected.decodeIncludeAll ||
      cancellation.recoveryDecodeSkipSpecial !== expected.decodeSkipSpecial) {
    mismatches.push("worker-recovery-mismatch");
  }
  invariant(mismatches.length === 0,
    `browser comparison mismatch: ${mismatches[0]}`);
  return Object.freeze({
    mode: "exact-native-to-two-independent-browser-runs",
    caseCount: execution.profile.corpus.caseCount,
    totalTokenCount: nativeValue.summary.totalTokenCount,
    maximumTokenCount: nativeValue.summary.maximumTokenCount,
    exactCaseOrder: true,
    exactTokenIds: true,
    exactIncludeAllDecode: true,
    exactSkipSpecialDecode: true,
    browserRepeatEqual: true,
    workerRecoveryEqual: true,
    mismatchCount: 0
  });
}

function resourceSummary(browserRuns, execution) {
  const resources = browserRuns.map((run) => run.value.resources);
  const maximum = (selector) => Math.max(...resources.map(selector));
  return Object.freeze({
    maximumWasmLinearMemoryBytesObserved: maximum((entry) =>
      entry.wasmLinearMemoryBytes.highWater),
    registeredMaximumWasmLinearMemoryBytes:
      execution.profile.execution.maximumWasmLinearMemoryBytes,
    maximumInstantiateMsObserved: maximum((entry) => entry.instantiateMs),
    maximumArtifactLoadMsObserved: maximum((entry) => entry.artifactLoadMs),
    maximumCorpusEncodeMsObserved: maximum((entry) => entry.corpusEncodeMs),
    maximumCorpusDecodeIncludeAllMsObserved: maximum((entry) =>
      entry.corpusDecodeIncludeAllMs),
    maximumCorpusDecodeSkipSpecialMsObserved: maximum((entry) =>
      entry.corpusDecodeSkipSpecialMs),
    maximumTotalMsObserved: maximum((entry) => entry.totalMs),
    registeredOperationTimeoutMs:
      execution.profile.execution.browserOperationTimeoutMs,
    allBoundsSatisfied: true
  });
}

function finalizePass(execution, verification, nativeReceipt, nativeResult,
  browserRuns) {
  const comparison = compareResults(nativeResult, browserRuns, execution);
  const resources = resourceSummary(browserRuns, execution);
  const result = Object.freeze({
    schema: VERIFICATION_RESULT_SCHEMA,
    profileId: VERIFICATION_PROFILE_ID,
    status: "exact-full-artifact-browser-wasm-parity-verified",
    verifiedAtUtc: new Date().toISOString(),
    registration: {
      executionPreregistrationSha256: execution.sha256,
      verificationPreregistrationSha256: verification.sha256,
      verifierSha256: verification.profile.verifier.scriptSha256
    },
    nativeEvidence: {
      receiptByteLength: nativeReceipt.byteLength,
      receiptSha256: nativeReceipt.sha256,
      candidateResultByteLength: nativeResult.byteLength,
      candidateResultSha256: nativeResult.sha256,
      sourceParityStatus: nativeReceipt.value.status
    },
    artifact: {
      byteLength: execution.profile.artifact.byteLength,
      sha256: execution.profile.artifact.sha256,
      tokenCount: execution.profile.artifact.tokenCount,
      baseTokenCount: execution.profile.artifact.baseTokenCount,
      addedTokenCount: execution.profile.artifact.addedTokenCount
    },
    wasm: {
      moduleByteLength: execution.profile.wasm.module.byteLength,
      moduleSha256: execution.profile.wasm.module.sha256,
      interfaceSha256: execution.profile.wasm.interface.sha256,
      adapterSha256: execution.profile.wasm.adapter.sha256,
      sourceClosureSha256: execution.profile.wasm.sourceClosureSha256,
      importCount: 0
    },
    browser: {
      engine: "chromium",
      version: execution.profile.browser.chromium.version,
      executableSha256: execution.profile.browser.chromium.sha256,
      independentRunCount: browserRuns.length,
      allProcessesClosed: true,
      allProfilesDeleted: true,
      totalNetworkRequestCount: 0,
      totalConsoleErrorCount: 0,
      totalPageErrorCount: 0
    },
    runs: browserRuns.map((run) => ({
      runNumber: run.value.runNumber,
      byteLength: run.byteLength,
      sha256: run.sha256,
      sourceRevision: run.value.sourceRevision,
      caseCount: run.value.summary.caseCount,
      totalTokenCount: run.value.summary.totalTokenCount,
      maximumTokenCount: run.value.summary.maximumTokenCount,
      cancellationExercised: run.value.cancellation !== null
    })),
    comparison,
    resources,
    claimBoundary: {
      tokenizerSourceParityVerified: true,
      tokenizerBrowserWasmParityVerified: true,
      modelRuntimeVerified: false,
      modelQualityVerified: false,
      releaseAuthorized: false,
      campaignCreditAuthorized: false,
      requiredNextGate: "template2-byte-profile-and-source-parity"
    }
  });
  const bytes = canonicalBytes(result);
  invariant(bytes.length <= verification.profile.result.maximumBytes,
    "browser verification result exceeds its byte limit");
  invariant(!FORBIDDEN_PUBLIC_TEXT.test(bytes.toString("utf8")),
    "browser verification result contains forbidden public text");
  return Object.freeze({ result, bytes });
}

function boundedFailureCode(error) {
  const message = String(error?.message || "browser-wasm-verification-failed")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 96);
  return SAFE_CODE_PATTERN.test(message) ? message : "browser-wasm-verification-failed";
}

function validateOutputPath(filePath, verification) {
  const resolved = path.resolve(filePath);
  invariant(path.isAbsolute(resolved) &&
    path.basename(resolved) === verification.profile.runSet.resultFile &&
    path.basename(path.dirname(resolved)) ===
      verification.profile.runSet.outputDirectoryName &&
    !fs.existsSync(resolved), "browser verification output path is invalid");
  return resolved;
}

function verify(options) {
  const execution = validatePreregistrationFile();
  const verification = validateVerificationProfileFile(execution);
  const outputPath = validateOutputPath(options.outputPath, verification);
  try {
    const nativeReceipt = validateNativeReceipt(
      options.nativeReceiptPath, execution.profile
    );
    const nativeResult = validateNativeResult(
      options.nativeResultPath, execution.profile
    );
    const browserRuns = options.browserRunPaths.map((filePath, index) =>
      validateBrowserResult(filePath, index + 1, execution, verification));
    invariant(browserRuns[0].value.sourceRevision ===
      browserRuns[1].value.sourceRevision,
    "browser source revision changed between runs");
    const pass = finalizePass(
      execution, verification, nativeReceipt, nativeResult, browserRuns
    );
    atomicCreate(outputPath, pass.bytes);
    return pass.result;
  } catch (error) {
    const failure = Object.freeze({
      schema: VERIFICATION_RESULT_SCHEMA,
      profileId: VERIFICATION_PROFILE_ID,
      status: "terminal-browser-wasm-verification-failure",
      verifiedAtUtc: new Date().toISOString(),
      registration: {
        executionPreregistrationSha256: execution.sha256,
        verificationPreregistrationSha256: verification.sha256,
        verifierSha256: verification.profile.verifier.scriptSha256
      },
      failure: {
        code: boundedFailureCode(error),
        browserRunsPreserved: true,
        repairAttempted: false,
        retrySelected: false,
        receiptCreated: false
      },
      claimBoundary: {
        tokenizerSourceParityVerified: true,
        tokenizerBrowserWasmParityVerified: false,
        modelRuntimeVerified: false,
        modelQualityVerified: false,
        releaseAuthorized: false,
        campaignCreditAuthorized: false,
        requiredNextGate: "new-append-only-browser-verification-preregistration"
      }
    });
    const bytes = canonicalBytes(failure);
    invariant(bytes.length <= verification.profile.result.maximumBytes,
      "browser verification failure result exceeds its byte limit");
    atomicCreate(outputPath, bytes);
    throw error;
  }
}

function parseCli(argv) {
  invariant(argv.length === 6 && argv[0] === "--verify",
    "usage: --verify <native-receipt> <native-result> <browser-run-1> " +
      "<browser-run-2> <result-path>");
  return Object.freeze({
    nativeReceiptPath: argv[1],
    nativeResultPath: argv[2],
    browserRunPaths: [argv[3], argv[4]],
    outputPath: argv[5]
  });
}

function main() {
  try {
    const result = verify(parseCli(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify({
      status: result.status,
      caseCount: result.comparison.caseCount,
      mismatchCount: result.comparison.mismatchCount
    })}\n`);
  } catch (error) {
    process.stderr.write(`${boundedFailureCode(error)}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = Object.freeze({
  VERIFICATION_RESULT_SCHEMA,
  compareResults,
  finalizePass,
  resourceSummary,
  validateBrowserResult,
  validateNativeResult,
  validateVerificationProfile,
  validateVerificationProfileFile,
  verify
});
