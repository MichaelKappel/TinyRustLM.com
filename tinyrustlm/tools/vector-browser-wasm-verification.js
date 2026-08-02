"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const { canonicalJson } = require("./campaign-evidence-store.js");
const { atomicCreate } = require("./durable-files.js");
const {
  authority,
  canonicalPrettyBytes,
  expectedExperimentId,
  hashInput,
  hashInputAtRevision,
  observationPath,
  openPromotionGaps,
  sha256,
  toolIdentity,
  validateAttemptFile,
  validateObservationFile
} = require("./vector-browser-wasm-observation.js");

const receiptSchema = "tinyrustlm.exact_flat_browser_wasm_verification_receipt.v1";
const repositoryRoot = path.resolve(__dirname, "../..");
const receiptRelativePath =
  "tinyrustlm/experiments/vector-quantization/exact-flat-browser-wasm-verification-v1.json";
const receiptPath = path.join(repositoryRoot, receiptRelativePath);
const attemptRelativeDirectory =
  "tinyrustlm/experiments/vector-quantization/browser-wasm-attempts/sha256";
const attemptDirectory = path.join(repositoryRoot, attemptRelativeDirectory);
const observationRelativePath = path.relative(repositoryRoot, observationPath).replaceAll("\\", "/");
const maximumReceiptBytes = 1024 * 1024;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const sourceRevisionPattern = /^[a-f0-9]{40}$/u;
const utcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;
const receiptIdPattern = /^exact-flat-browser-wasm-verification-[a-f0-9]{16}$/u;
const relativePathPattern = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u;
const forbiddenTextPattern =
  /(?:[a-z]:[\\/]|\/home\/|\/mnt\/[a-z]\/|bearer\s|token=|secret=|password=|turn\d+(?:search|view)\d+)/iu;

const verificationInputPaths = Object.freeze([
  "tinyrustlm/experiments/vector-quantization/exact-flat-browser-wasm-observation-v1.json",
  "tinyrustlm/experiments/vector-quantization/exact-flat-browser-wasm-preregistration.v2.json",
  "tinyrustlm/experiments/vector-quantization/exact-flat-retrieval-verification-v1.json",
  "tinyrustlm/tests/vector-browser-wasm-observation.test.js",
  "tinyrustlm/tests/vector-browser-wasm-verification.test.js",
  "tinyrustlm/tools/vector-browser-wasm-observation.js",
  "tinyrustlm/tools/vector-browser-wasm-verification.js"
]);

/** Throws a stable validation error when `condition` is false. */
function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

/** Returns whether `value` is a non-array JSON object. */
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Requires exactly the declared object keys. */
function exactKeys(value, keys, label) {
  invariant(isPlainObject(value), `${label} must be an object`);
  invariant(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()),
    `${label} fields are invalid`);
}

/** Requires exact ordered JSON equality. */
function exactValue(value, expected, label) {
  invariant(JSON.stringify(value) === JSON.stringify(expected), `${label} is invalid`);
}

/** Returns the current full source revision without persisting a local path. */
function sourceRevision() {
  const result = childProcess.spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
    shell: false
  });
  invariant(result.status === 0 && !result.error, "source revision probe failed");
  const revision = String(result.stdout || "").trim();
  invariant(sourceRevisionPattern.test(revision), "source revision is invalid");
  return revision;
}

/** Requires every evidence and verifier input to match the current commit. */
function assertPathsCommitted(paths) {
  const tracked = childProcess.spawnSync("git", ["ls-files", "--error-unmatch", "--", ...paths], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
    shell: false
  });
  invariant(tracked.status === 0 && !tracked.error, "verification inputs are not all tracked");
  for (const argumentsList of [
    ["diff", "--quiet", "--", ...paths],
    ["diff", "--cached", "--quiet", "--", ...paths]
  ]) {
    const result = childProcess.spawnSync("git", argumentsList, {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true,
      shell: false
    });
    invariant(result.status === 0 && !result.error,
      "verification inputs differ from the current commit");
  }
}

/** Enumerates bounded canonical attempts and selects the sole pass for an observation. */
function findPassingAttempt(observation) {
  const candidates = [];
  const prefixDirectories = fs.readdirSync(attemptDirectory, { withFileTypes: true });
  invariant(prefixDirectories.length <= 256, "attempt prefix directory count is excessive");
  for (const prefix of prefixDirectories) {
    invariant(prefix.isDirectory() && !prefix.isSymbolicLink() && /^[a-f0-9]{2}$/u.test(prefix.name),
      "attempt prefix directory is invalid");
    const prefixPath = path.join(attemptDirectory, prefix.name);
    const entries = fs.readdirSync(prefixPath, { withFileTypes: true });
    invariant(entries.length <= 1000, "attempt file count is excessive");
    for (const entry of entries) {
      invariant(entry.isFile() && !entry.isSymbolicLink() &&
        /^[a-f0-9]{64}\.json$/u.test(entry.name), "attempt file is invalid");
      const filePath = path.join(prefixPath, entry.name);
      const validated = validateAttemptFile(filePath);
      if (validated.attempt.status === "pass" &&
        validated.attempt.observationId === observation.observationId &&
        validated.attempt.observationContentHash === observation.observationContentHash) {
        candidates.push(Object.freeze({
          path: path.relative(repositoryRoot, filePath).replaceAll("\\", "/"),
          attemptId: validated.attempt.attemptId,
          attemptContentHash: validated.attempt.attemptContentHash,
          fileSha256: validated.sha256
        }));
      }
    }
  }
  invariant(candidates.length === 1, "expected exactly one passing attempt for observation");
  return candidates[0];
}

/** Opens the exact content-addressed attempt named by a verification receipt. */
function validateBoundAttempt(binding, observation) {
  exactKeys(binding, ["path", "attemptId", "attemptContentHash", "fileSha256"], "attempt");
  invariant(relativePathPattern.test(binding.path) &&
    binding.path.startsWith(`${attemptRelativeDirectory}/`), "attempt path is invalid");
  const filePath = path.resolve(repositoryRoot, binding.path);
  const relative = path.relative(attemptDirectory, filePath);
  invariant(relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative),
    "attempt path escaped its content-addressed root");
  const validated = validateAttemptFile(filePath);
  invariant(binding.attemptId === validated.attempt.attemptId &&
    binding.attemptContentHash === validated.attempt.attemptContentHash &&
    binding.fileSha256 === validated.sha256 &&
    validated.attempt.status === "pass" &&
    validated.attempt.observationId === observation.observationId &&
    validated.attempt.observationContentHash === observation.observationContentHash,
  "attempt binding is invalid");
  return binding;
}

/** Derives only narrow, objectively checkable facts from the browser observation. */
function evidenceSummary(observation) {
  const expectedRustTestCountPerRun = observation.modules.reduce(
    (sum, module) => sum + module.expectedTestCount, 0
  );
  const moduleExecutions = observation.runs.flatMap((run) => run.moduleResults);
  return Object.freeze({
    moduleCount: observation.modules.length,
    expectedRustTestCountPerRun,
    independentBrowserRuns: observation.runs.length,
    wasmModuleExecutions: moduleExecutions.length,
    allEntryPointsReturnedZero: moduleExecutions.every((entry) => entry.returnCode === 0),
    allBrowserProcessesClosed: observation.runs.every((run) => run.browserProcessClosed),
    allProfilesDeleted: observation.runs.every((run) =>
      run.profileDeletion.deleted && run.profileRootDeleted),
    observedPageNetworkRequests: observation.runs.reduce(
      (sum, run) => sum + run.networkRequestCount, 0),
    observedConsoleErrors: observation.runs.reduce(
      (sum, run) => sum + run.consoleErrorCount, 0),
    observedPageErrors: observation.runs.reduce((sum, run) => sum + run.pageErrorCount, 0),
    uniqueProfileRoots: new Set(
      observation.runs.map((run) => run.profileDeletion.rootMarkerHash)
    ).size,
    uniqueProfiles: new Set(
      observation.runs.map((run) => run.profileDeletion.profileMarkerHash)
    ).size
  });
}

/** Finalizes one receipt with a canonical content hash and stable identifier. */
function finalizeReceipt(body) {
  invariant(!Object.hasOwn(body, "receiptId") && !Object.hasOwn(body, "receiptContentHash"),
    "receipt body already contains identity fields");
  const receiptContentHash = sha256(Buffer.from(canonicalJson(body), "utf8"));
  return Object.freeze({
    ...body,
    receiptId: `exact-flat-browser-wasm-verification-${receiptContentHash.slice(0, 16)}`,
    receiptContentHash
  });
}

/** Recomputes the canonical identity of one finalized receipt. */
function receiptIdentity(value) {
  const body = { ...value };
  delete body.receiptId;
  delete body.receiptContentHash;
  const hash = sha256(Buffer.from(canonicalJson(body), "utf8"));
  return Object.freeze({
    id: `exact-flat-browser-wasm-verification-${hash.slice(0, 16)}`,
    hash
  });
}

/** Builds a child verification receipt from the immutable observation and attempt. */
function buildReceipt(options = {}) {
  const observed = validateObservationFile();
  const observation = observed.observation;
  const attempt = findPassingAttempt(observation);
  return finalizeReceipt({
    schema: receiptSchema,
    experimentId: expectedExperimentId,
    status: "browser-wasm-observation-verified-with-open-promotion-gaps",
    generatedAtUtc: options.generatedAtUtc || new Date().toISOString(),
    observedSourceRevision: observation.sourceRevision,
    verificationSourceRevision: options.verificationSourceRevision || sourceRevision(),
    verificationMode: "content-and-policy-revalidation-of-immutable-observation",
    verificationTool: toolIdentity("node"),
    verificationInputs: verificationInputPaths.map(hashInput),
    preregistration: observation.preregistration,
    parentReceipt: observation.parentReceipt,
    observation: {
      path: observationRelativePath,
      observationId: observation.observationId,
      observationContentHash: observation.observationContentHash,
      fileSha256: observed.sha256
    },
    attempt,
    evidenceSummary: evidenceSummary(observation),
    authority,
    openPromotionGaps,
    requiredNextGate: observation.requiredNextGate
  });
}

/** Validates exact bindings, scope, identities, and all retained promotion gaps. */
function validateReceipt(value, options = {}) {
  exactKeys(value, [
    "schema", "receiptId", "receiptContentHash", "experimentId", "status",
    "generatedAtUtc", "observedSourceRevision", "verificationSourceRevision",
    "verificationMode", "verificationTool", "verificationInputs", "preregistration",
    "parentReceipt", "observation", "attempt", "evidenceSummary", "authority",
    "openPromotionGaps", "requiredNextGate"
  ], "receipt");
  invariant(value.schema === receiptSchema && value.experimentId === expectedExperimentId,
    "receipt schema or experiment is invalid");
  invariant(value.status === "browser-wasm-observation-verified-with-open-promotion-gaps" &&
    value.verificationMode === "content-and-policy-revalidation-of-immutable-observation",
  "receipt status or mode is invalid");
  invariant(utcPattern.test(value.generatedAtUtc) && Number.isFinite(Date.parse(value.generatedAtUtc)),
    "generatedAtUtc is invalid");
  invariant(sourceRevisionPattern.test(value.observedSourceRevision) &&
    sourceRevisionPattern.test(value.verificationSourceRevision),
  "receipt source revisions are invalid");
  const identity = receiptIdentity(value);
  invariant(receiptIdPattern.test(value.receiptId) && value.receiptId === identity.id &&
    value.receiptContentHash === identity.hash, "receipt content identity is invalid");
  exactKeys(value.verificationTool, ["version", "sha256"], "verificationTool");
  invariant(/^[A-Za-z0-9][A-Za-z0-9 ._()+:/-]{0,255}$/u.test(
    value.verificationTool.version) && sha256Pattern.test(value.verificationTool.sha256),
  "verification tool identity is invalid");

  invariant(Array.isArray(value.verificationInputs) &&
    value.verificationInputs.length === verificationInputPaths.length,
  "verification inputs are incomplete");
  const inputRevision = options.inputRevision || null;
  invariant(inputRevision === null || inputRevision === value.verificationSourceRevision,
    "historical verification revision does not match the receipt");
  for (let index = 0; index < verificationInputPaths.length; index += 1) {
    exactKeys(value.verificationInputs[index], ["path", "bytes", "sha256"],
      `verificationInputs[${index}]`);
    const expectedInput = inputRevision === null
      ? hashInput(verificationInputPaths[index])
      : hashInputAtRevision(verificationInputPaths[index], inputRevision);
    exactValue(value.verificationInputs[index], expectedInput, `verificationInputs[${index}]`);
  }

  const observed = validateObservationFile();
  const observation = observed.observation;
  invariant(value.observedSourceRevision === observation.sourceRevision,
    "observed source revision binding is invalid");
  exactValue(value.preregistration, observation.preregistration, "preregistration");
  exactValue(value.parentReceipt, observation.parentReceipt, "parentReceipt");
  exactKeys(value.observation, [
    "path", "observationId", "observationContentHash", "fileSha256"
  ], "observation");
  exactValue(value.observation, {
    path: observationRelativePath,
    observationId: observation.observationId,
    observationContentHash: observation.observationContentHash,
    fileSha256: observed.sha256
  }, "observation");
  validateBoundAttempt(value.attempt, observation);
  exactKeys(value.evidenceSummary, [
    "moduleCount", "expectedRustTestCountPerRun", "independentBrowserRuns",
    "wasmModuleExecutions", "allEntryPointsReturnedZero", "allBrowserProcessesClosed",
    "allProfilesDeleted", "observedPageNetworkRequests", "observedConsoleErrors",
    "observedPageErrors", "uniqueProfileRoots", "uniqueProfiles"
  ], "evidenceSummary");
  exactValue(value.evidenceSummary, evidenceSummary(observation), "evidenceSummary");
  invariant(value.evidenceSummary.moduleCount === 3 &&
    value.evidenceSummary.expectedRustTestCountPerRun === 49 &&
    value.evidenceSummary.independentBrowserRuns === 2 &&
    value.evidenceSummary.wasmModuleExecutions === 6 &&
    value.evidenceSummary.allEntryPointsReturnedZero === true &&
    value.evidenceSummary.allBrowserProcessesClosed === true &&
    value.evidenceSummary.allProfilesDeleted === true &&
    value.evidenceSummary.observedPageNetworkRequests === 0 &&
    value.evidenceSummary.observedConsoleErrors === 0 &&
    value.evidenceSummary.observedPageErrors === 0 &&
    value.evidenceSummary.uniqueProfileRoots === 2 &&
    value.evidenceSummary.uniqueProfiles === 2,
  "browser evidence does not satisfy preregistered acceptance");
  exactValue(value.authority, authority, "authority");
  exactValue(value.openPromotionGaps, openPromotionGaps, "openPromotionGaps");
  invariant(value.requiredNextGate === observation.requiredNextGate,
    "requiredNextGate changed from the observation");
  invariant(!forbiddenTextPattern.test(JSON.stringify(value)),
    "receipt contains private, credential-like, or internal citation text");
  return value;
}

/** Reads and validates one bounded canonical verification receipt. */
function validateReceiptFile(filePath = receiptPath) {
  const stat = fs.lstatSync(filePath);
  invariant(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 &&
    stat.size <= maximumReceiptBytes, "receipt must be a bounded regular file");
  const bytes = fs.readFileSync(filePath);
  const parsed = JSON.parse(bytes.toString("utf8"));
  const receipt = validateReceipt(parsed, { inputRevision: parsed.verificationSourceRevision });
  invariant(bytes.equals(canonicalPrettyBytes(receipt)), "receipt bytes are not canonical");
  return Object.freeze({ receipt, bytes: bytes.length, sha256: sha256(bytes) });
}

/** Generates the receipt only when every bound input is committed and unchanged. */
function generateReceipt() {
  const observed = validateObservationFile();
  const attempt = findPassingAttempt(observed.observation);
  assertPathsCommitted([...verificationInputPaths, attempt.path]);
  return buildReceipt();
}

/** Runs the one-shot receipt CLI and prints only bounded public-safe identities. */
function main(argumentsList) {
  invariant(argumentsList.length === 1 && argumentsList[0] === "--write",
    "usage: node vector-browser-wasm-verification.js --write");
  const receipt = generateReceipt();
  atomicCreate(receiptPath, canonicalPrettyBytes(receipt));
  const validated = validateReceiptFile();
  process.stdout.write(`${JSON.stringify({
    schema: validated.receipt.schema,
    receiptId: validated.receipt.receiptId,
    status: validated.receipt.status,
    observedSourceRevision: validated.receipt.observedSourceRevision,
    verificationSourceRevision: validated.receipt.verificationSourceRevision,
    moduleCount: validated.receipt.evidenceSummary.moduleCount,
    expectedRustTestCountPerRun:
      validated.receipt.evidenceSummary.expectedRustTestCountPerRun,
    independentBrowserRuns: validated.receipt.evidenceSummary.independentBrowserRuns,
    productAuthority: validated.receipt.authority.productIntegrationAuthorized,
    bytes: validated.bytes,
    sha256: validated.sha256
  }, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Vector browser-WASM verification failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  buildReceipt,
  evidenceSummary,
  finalizeReceipt,
  findPassingAttempt,
  receiptIdentity,
  receiptPath,
  receiptSchema,
  validateReceipt,
  validateReceiptFile,
  verificationInputPaths
});
