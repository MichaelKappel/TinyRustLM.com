"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const acquisition = require("./huggingface-candidate-acquire.js");
const {
  CampaignEvidenceStore,
  canonicalJson,
  finalizedReceipt
} = require("./campaign-evidence-store.js");

const inventorySchema = "tinyrustlm.huggingface_supported_candidate_inventory.v2";
const receiptSchema = "tinyrustlm.model_qualification_receipt.v2";
const conversionReceiptSchema = "tinyrustlm.model_conversion_receipt.v1";
const evalReceiptSchema = "tinyrustlm.model_eval_receipt.v1";
const errorSchema = "tinyrustlm.model_qualification_error.v1";
const sourceRejectionSchema = "tinyrustlm.model_source_rejection.v1";
const sourceRejectionReceiptType = "tinyrustlm.model-source-review-v1";
const maximumJsonBytes = 16 * 1024 * 1024;
const maximumProcessOutputBytes = 512 * 1024;
const defaultRequiredCaseCount = 14;
const sourceRejectionCodes = new Set([
  "missing-required-tensor",
  "source-tensor-contract-incompatible",
  "tensor-shape-mismatch",
  "tied-output-metadata-mismatch",
  "tied-output-payload-mismatch",
  "unsupported-source-dtype",
  "unsupported-source-tensor"
]);

class CandidateSourceRejection extends Error {
  constructor(reviewPath, decision) {
    super(`candidate source rejected: ${decision.rejectionCode}`);
    this.name = "CandidateSourceRejection";
    this.reviewPath = reviewPath;
    this.decision = decision;
  }
}

// Raises a deterministic error when qualification evidence violates its contract.
function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

// Returns true only for ordinary JSON objects.
function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

// Hashes in-memory evidence with SHA-256.
function sha256Bytes(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

// Streams one artifact into SHA-256 without loading model bytes into memory.
async function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("error", reject);
    stream.once("end", resolve);
  });
  return hash.digest("hex");
}

// Describes one immutable artifact without loading large model bytes into memory.
async function artifactEvidence(filePath) {
  const stat = fs.statSync(filePath, { throwIfNoEntry: false });
  invariant(stat?.isFile(), `qualification artifact is missing: ${filePath}`);
  return Object.freeze({
    path: path.resolve(filePath),
    byteCount: stat.size,
    sha256: await sha256File(filePath)
  });
}

// Revalidates one retained artifact before any phase receipt is trusted.
async function validateArtifactEvidence(artifact, label) {
  invariant(isPlainObject(artifact) && typeof artifact.path === "string" &&
    Number.isSafeInteger(artifact.byteCount) && artifact.byteCount >= 0 &&
    /^[a-f0-9]{64}$/u.test(String(artifact.sha256 || "")),
  `${label} evidence is invalid`);
  const stat = fs.statSync(artifact.path, { throwIfNoEntry: false });
  invariant(stat?.isFile(), `${label} artifact is missing`);
  invariant(stat.size === artifact.byteCount, `${label} artifact size changed`);
  invariant(await sha256File(artifact.path) === artifact.sha256,
    `${label} artifact changed`);
  return artifact;
}

// Reproduces the Rust provenance checksum used by candidate-review text fields.
function provenanceTextChecksum(bytes) {
  const mask = (1n << 64n) - 1n;
  let accumulator = 0x4d595df4d0f33173n;
  for (let index = 0; index < bytes.length; index += 1) {
    accumulator ^= (BigInt(bytes[index]) + (BigInt(index) << 2n)) & mask;
    accumulator = ((accumulator << 9n) | (accumulator >> 55n)) & mask;
    accumulator = (accumulator * 0x100000001b3n) & mask;
  }
  return `0x${accumulator.toString(16).padStart(16, "0")}`;
}

// Flushes a file before it becomes durable qualification evidence.
function syncFile(filePath) {
  const descriptor = fs.openSync(filePath, "r+");
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

// Attempts to flush the containing directory after an atomic rename.
function syncDirectory(directoryPath) {
  let descriptor;
  try {
    descriptor = fs.openSync(directoryPath, "r");
    fs.fsyncSync(descriptor);
  } catch (error) {
    if (process.platform !== "win32") throw error;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

// Writes one JSON artifact through a synced same-directory temporary file.
function atomicWriteJson(filePath, value) {
  const directoryPath = path.dirname(filePath);
  fs.mkdirSync(directoryPath, { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      flag: "wx",
      mode: 0o600
    });
    syncFile(temporaryPath);
    fs.renameSync(temporaryPath, filePath);
    syncDirectory(directoryPath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

// Writes bounded process output atomically for later diagnosis.
function atomicWriteText(filePath, value) {
  const directoryPath = path.dirname(filePath);
  fs.mkdirSync(directoryPath, { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, String(value), { flag: "wx", mode: 0o600 });
    syncFile(temporaryPath);
    fs.renameSync(temporaryPath, filePath);
    syncDirectory(directoryPath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

// Reads one bounded JSON document from disk.
function readBoundedJson(filePath) {
  const stat = fs.statSync(filePath, { throwIfNoEntry: false });
  if (!stat) return null;
  invariant(stat.isFile() && stat.size > 0 && stat.size <= maximumJsonBytes,
    `${filePath} is outside its JSON size limit`);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

// Reads line-based Rust evidence and rejects duplicate keys.
function readLineEvidence(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const fields = new Map();
  for (const line of text.split(/\r?\n/u)) {
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator);
    invariant(!fields.has(key), `duplicate evidence field: ${key}`);
    fields.set(key, line.slice(separator + 1));
  }
  return fields;
}

// Validates a strict Rust source rejection sidecar against the requested immutable candidate.
function parseCandidateSourceRejection(filePath, settings, candidate, sourceDirectory) {
  const fields = readLineEvidence(filePath);
  const expectedKeys = new Set([
    "tinyrustlm_safetensors_candidate_rejection_version",
    "review_status",
    "rejection_scope",
    "rejection_code",
    "source_model_id",
    "source_model_sha",
    "source_config_checksum",
    "source_tokenizer_checksum",
    "target_model_shape",
    "output_quantization"
  ]);
  invariant(fields.size === expectedKeys.size &&
    [...fields.keys()].every((key) => expectedKeys.has(key)),
  "candidate source rejection fields are invalid");
  invariant(fields.get("tinyrustlm_safetensors_candidate_rejection_version") === "1",
    "candidate source rejection version is invalid");
  invariant(fields.get("review_status") === "rejected" &&
    fields.get("rejection_scope") === "source-tensor-contract",
  "candidate source rejection decision is invalid");
  const rejectionCode = String(fields.get("rejection_code") || "");
  invariant(sourceRejectionCodes.has(rejectionCode),
    "candidate source rejection code is invalid");
  invariant(fields.get("source_model_id") === candidate.modelId &&
    fields.get("source_model_sha") === candidate.revision &&
    fields.get("target_model_shape") === candidate.sourceTemplate &&
    fields.get("output_quantization") === settings.quantization,
  "candidate source rejection identity changed");
  const configPath = path.join(sourceDirectory, "config.json");
  const tokenizerPath = path.join(sourceDirectory, candidate.tokenizer.filename);
  invariant(fields.get("source_config_checksum") ===
    provenanceTextChecksum(fs.readFileSync(configPath)) &&
    fields.get("source_tokenizer_checksum") ===
    provenanceTextChecksum(fs.readFileSync(tokenizerPath)),
  "candidate source rejection artifact checksums changed");
  return Object.freeze({
    rejectionCode,
    rejectionScope: "source-tensor-contract"
  });
}

// Parses one non-negative integer evidence field.
function evidenceInteger(fields, key) {
  const value = Number(fields.get(key));
  invariant(Number.isSafeInteger(value) && value >= 0, `eval evidence has invalid ${key}`);
  return value;
}

function evidenceText(fields, key, maximum = 16 * 1024) {
  const value = fields.get(key);
  invariant(typeof value === "string" && value.length > 0 &&
    value.length <= maximum && !value.includes("\0"),
  `eval evidence has invalid ${key}`);
  return value;
}

function evidenceFloat(fields, key, minimum, maximum) {
  const text = evidenceText(fields, key, 64);
  const value = Number(text);
  invariant(Number.isFinite(value) && value >= minimum && value <= maximum,
    `eval evidence has invalid ${key}`);
  return value;
}

// Extracts the strict assistant-quality decision from a native eval sidecar.
function parseEvalDecision(evalPath, requiredCaseCount) {
  const fields = readLineEvidence(evalPath);
  invariant(fields.get("tinyrustlm_eval_manifest_version") === "1",
    "eval evidence version is invalid");
  invariant(fields.get("gate") === "assistant-quality", "eval evidence gate is invalid");
  invariant(fields.get("quality_gate_policy") === "honest-assistant-quality-v1",
    "eval evidence policy is invalid");
  const expectedCaseCount = evidenceInteger(fields, "expected_case_count");
  const caseCount = evidenceInteger(fields, "case_count");
  const casesPassed = evidenceInteger(fields, "cases_passed");
  const casesFailed = evidenceInteger(fields, "cases_failed");
  invariant(expectedCaseCount === requiredCaseCount && caseCount === requiredCaseCount,
    `eval evidence must contain exactly ${requiredCaseCount} cases`);
  invariant(casesPassed + casesFailed === caseCount, "eval case totals are inconsistent");
  const promptFormat = evidenceText(fields, "prompt_format", 96);
  const systemPrompt = evidenceText(fields, "system_prompt");
  const evaluator = evidenceText(fields, "evaluator", 96);
  const evaluationSamplingProfile = evidenceText(fields, "sampling_profile", 96);
  const modelSamplingProfile = evidenceText(fields, "model_sampling_profile", 96);
  const samplingTemperature = evidenceFloat(
    fields,
    "model_sampling_temperature_ceiling",
    0,
    5
  );
  const samplingTopK = evidenceInteger(fields, "model_sampling_top_k_ceiling");
  invariant(samplingTopK >= 1 && samplingTopK <= 1024,
    "eval evidence has invalid model_sampling_top_k_ceiling");
  const samplingTopP = evidenceFloat(
    fields,
    "model_sampling_top_p_ceiling",
    0.01,
    1
  );
  const samplingRepetitionPenalty = evidenceFloat(
    fields,
    "model_sampling_repetition_penalty",
    1,
    128
  );
  invariant(evaluator === "tinyrustlm-native-eval-runner",
    "eval evidence evaluator is unsupported");
  invariant(evaluationSamplingProfile === "task-adaptive-v1",
    "eval evidence sampling profile is unsupported");
  const qualified = fields.get("eval_status") === "pass" &&
    fields.get("task_eval_status") === "pass" &&
    fields.get("no_cheat_status") === "pass" &&
    casesPassed === requiredCaseCount && casesFailed === 0;
  return Object.freeze({
    qualified,
    expectedCaseCount,
    casesPassed,
    casesFailed,
    evalStatus: String(fields.get("eval_status") || "missing"),
    noCheatStatus: String(fields.get("no_cheat_status") || "missing"),
    qualityScope: String(fields.get("quality_scope") || "missing"),
    promptFormat,
    systemPromptSha256: sha256Bytes(systemPrompt),
    evaluator,
    evaluationSamplingProfile,
    modelSamplingProfile,
    samplingTemperature,
    samplingTopK,
    samplingTopP,
    samplingRepetitionPenalty
  });
}

// Keeps child-process output bounded while preserving its most recent bytes.
function appendBounded(current, chunk) {
  const combined = Buffer.concat([current, Buffer.from(chunk)]);
  return combined.length <= maximumProcessOutputBytes
    ? combined
    : combined.subarray(combined.length - maximumProcessOutputBytes);
}

// Executes one reviewed binary directly without a shell or inherited credentials.
function runProcess(executable, args, options = {}) {
  return new Promise((resolve, reject) => {
    const timeoutMs = Number(options.timeoutMs);
    invariant(Number.isSafeInteger(timeoutMs) && timeoutMs >= 1000, "process timeout is invalid");
    const child = spawn(executable, args, {
      cwd: options.cwd,
      windowsHide: true,
      shell: false,
      env: options.env || process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout = appendBounded(stdout, chunk);
      if (typeof options.onOutput === "function") options.onOutput("stdout", chunk.toString("utf8"));
    });
    child.stderr.on("data", (chunk) => {
      stderr = appendBounded(stderr, chunk);
      if (typeof options.onOutput === "function") options.onOutput("stderr", chunk.toString("utf8"));
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      resolve(Object.freeze({
        code: Number.isInteger(code) ? code : -1,
        signal: signal || null,
        timedOut,
        stdout: stdout.toString("utf8"),
        stderr: stderr.toString("utf8")
      }));
    });
  });
}

// Creates a path-safe candidate output directory from immutable identity fields.
function candidateOutputDirectory(outputRoot, candidate) {
  const root = path.resolve(String(outputRoot || ""));
  invariant(String(outputRoot || "").trim().length > 0, "output root is required");
  const slug = `${candidate.modelId.replace("/", "--")}--${candidate.revision}`;
  invariant(/^[A-Za-z0-9._-]+--[A-Za-z0-9._-]+--[a-f0-9]{40,64}$/u.test(slug),
    "candidate output identity is invalid");
  const target = path.resolve(root, slug);
  invariant(target.startsWith(`${root}${path.sep}`), "candidate output escaped its root");
  return target;
}

// Removes only a known direct child work directory owned by one candidate.
function removeOwnedWorkDirectory(candidateDirectory, workDirectory, expectedName) {
  const owner = path.resolve(candidateDirectory);
  const target = path.resolve(workDirectory);
  invariant(path.dirname(target) === owner && path.basename(target) === expectedName,
    "refusing to remove an unowned work directory");
  fs.rmSync(target, { recursive: true, force: true });
}

// Returns one source weight path while failing closed on unsupported sharded intake.
function sourceWeightPath(sourceDirectory, candidate) {
  invariant(Array.isArray(candidate.weightFiles) && candidate.weightFiles.length === 1,
    "qualification currently requires exactly one safetensors weight file");
  const filename = String(candidate.weightFiles[0].filename || "");
  invariant(/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u.test(filename),
    "candidate weight filename is invalid");
  return path.join(sourceDirectory, filename);
}

// Runs a Rust command, persists bounded diagnostics, and enforces its exit status.
async function runCheckedCommand(run, executable, args, settings) {
  const started = Date.now();
  const result = await run(executable, args, settings);
  const log = [
    `executable=${path.basename(executable)}`,
    `argument_count=${args.length}`,
    `elapsed_ms=${Date.now() - started}`,
    `exit_code=${result.code}`,
    `signal=${result.signal || "none"}`,
    `timed_out=${result.timedOut === true}`,
    "--- stdout ---",
    result.stdout || "",
    "--- stderr ---",
    result.stderr || ""
  ].join("\n");
  atomicWriteText(settings.logPath, `${log}\n`);
  invariant(!result.timedOut, `${settings.label} timed out`);
  const acceptedExitCodes = settings.acceptedExitCodes || [0];
  invariant(Array.isArray(acceptedExitCodes) && acceptedExitCodes.length > 0 &&
    acceptedExitCodes.every((code) => Number.isInteger(code)),
  `${settings.label} accepted exit codes are invalid`);
  invariant(acceptedExitCodes.includes(result.code),
    `${settings.label} failed with exit code ${result.code}`);
  return result;
}

// Validates one existing converted artifact through the authoritative Rust commands.
async function validateConvertedArtifact(run, settings, modelPath, manifestPath) {
  await runCheckedCommand(run, settings.slmPackPath, ["validate", modelPath], {
    cwd: settings.workspaceRoot,
    timeoutMs: settings.reviewTimeoutMs,
    logPath: `${settings.logPrefix}.validate-model.log`,
    label: "model validation",
    onOutput: settings.onOutput
  });
  await runCheckedCommand(run, settings.slmPackPath,
    ["validate-manifest", modelPath, manifestPath], {
      cwd: settings.workspaceRoot,
      timeoutMs: settings.reviewTimeoutMs,
      logPath: `${settings.logPrefix}.validate-manifest.log`,
      label: "manifest validation",
      onOutput: settings.onOutput
    });
}

// Creates or reuses a Rust candidate review bound to local source evidence.
async function ensureCandidateReview(run, settings, candidate, sourceDirectory, outputDirectory) {
  const reviewPath = path.join(outputDirectory, "candidate.review");
  const rejectionPath = path.join(outputDirectory, "candidate.rejection");
  const reviewExists = fs.statSync(reviewPath, { throwIfNoEntry: false })?.isFile() === true;
  const rejectionExists = fs.statSync(rejectionPath, { throwIfNoEntry: false })?.isFile() === true;
  invariant(!(reviewExists && rejectionExists),
    "candidate source review has conflicting pass and rejection evidence");
  if (reviewExists) return reviewPath;
  if (rejectionExists) {
    throw new CandidateSourceRejection(
      rejectionPath,
      parseCandidateSourceRejection(rejectionPath, settings, candidate, sourceDirectory)
    );
  }
  const temporaryPath = path.join(outputDirectory, "candidate.review.staging");
  fs.rmSync(temporaryPath, { force: true });
  const configPath = path.join(sourceDirectory, "config.json");
  const tokenizerPath = path.join(sourceDirectory, candidate.tokenizer.filename);
  const licensePath = path.join(sourceDirectory, "LICENSE");
  const weightPath = sourceWeightPath(sourceDirectory, candidate);
  for (const requiredPath of [configPath, tokenizerPath, licensePath, weightPath]) {
    invariant(fs.statSync(requiredPath, { throwIfNoEntry: false })?.isFile(),
      `verified source file is missing: ${path.basename(requiredPath)}`);
  }
  const args = [
    "review-safetensors-candidate",
    weightPath,
    candidate.sourceTemplate,
    settings.quantization,
    candidate.modelId,
    candidate.revision,
    provenanceTextChecksum(fs.readFileSync(configPath)),
    provenanceTextChecksum(fs.readFileSync(tokenizerPath)),
    licensePath,
    temporaryPath,
    settings.referencePromptPath,
    "-",
    settings.evalCasesPath,
    configPath,
    tokenizerPath
  ];
  const result = await runCheckedCommand(run, settings.slmPackPath, args, {
    cwd: settings.workspaceRoot,
    timeoutMs: settings.reviewTimeoutMs,
    logPath: path.join(outputDirectory, "review.log"),
    label: "candidate review",
    acceptedExitCodes: [0, 1],
    onOutput: settings.onOutput
  });
  invariant(fs.statSync(temporaryPath, { throwIfNoEntry: false })?.isFile(),
    "candidate review did not produce evidence");
  if (result.code === 1) {
    const decision = parseCandidateSourceRejection(
      temporaryPath, settings, candidate, sourceDirectory);
    fs.renameSync(temporaryPath, rejectionPath);
    syncDirectory(outputDirectory);
    throw new CandidateSourceRejection(rejectionPath, decision);
  }
  const fields = readLineEvidence(temporaryPath);
  invariant(fields.get("tinyrustlm_safetensors_candidate_review_version") === "1",
    "candidate review evidence version is invalid");
  fs.renameSync(temporaryPath, reviewPath);
  syncDirectory(outputDirectory);
  return reviewPath;
}

// Reconciles and promotes a completed staged conversion after an interrupted rename.
async function reconcileStagedConversion(run, settings, outputDirectory, modelPath, manifestPath) {
  const stagingDirectory = path.join(outputDirectory, ".conversion-staging");
  const stagedModelPath = path.join(stagingDirectory, "model.slm");
  const stagedManifestPath = `${stagedModelPath}.manifest`;
  const finalModelExists = fs.statSync(modelPath, { throwIfNoEntry: false })?.isFile() === true;
  const finalManifestExists = fs.statSync(manifestPath, { throwIfNoEntry: false })?.isFile() === true;
  if (finalModelExists && finalManifestExists) {
    await validateConvertedArtifact(run, settings, modelPath, manifestPath);
    return Object.freeze({ modelPath, manifestPath, stagingDirectory });
  }
  if (finalModelExists && !finalManifestExists &&
      fs.statSync(stagedManifestPath, { throwIfNoEntry: false })?.isFile()) {
    fs.renameSync(stagedManifestPath, manifestPath);
  } else if (!finalModelExists && finalManifestExists &&
      fs.statSync(stagedModelPath, { throwIfNoEntry: false })?.isFile()) {
    fs.renameSync(stagedModelPath, modelPath);
  }
  const reconciledModel = fs.statSync(modelPath, { throwIfNoEntry: false })?.isFile() === true;
  const reconciledManifest = fs.statSync(manifestPath, { throwIfNoEntry: false })?.isFile() === true;
  invariant(reconciledModel === reconciledManifest,
    "converted artifact is incomplete and cannot be reconciled");
  if (reconciledModel) await validateConvertedArtifact(run, settings, modelPath, manifestPath);
  return Object.freeze({ modelPath, manifestPath, stagingDirectory });
}

// Converts one reviewed source through Rust and validates it before promotion.
async function ensureConvertedArtifact(run, settings, candidate, sourceDirectory, outputDirectory, reviewPath) {
  const modelPath = path.join(outputDirectory, `model-${settings.quantization}.slm`);
  const manifestPath = `${modelPath}.manifest`;
  const reconciled = await reconcileStagedConversion(
    run, settings, outputDirectory, modelPath, manifestPath);
  if (fs.statSync(modelPath, { throwIfNoEntry: false })?.isFile()) return reconciled;

  const stagingDirectory = reconciled.stagingDirectory;
  if (fs.statSync(stagingDirectory, { throwIfNoEntry: false })) {
    invariant(settings.cleanupWork, "incomplete conversion staging requires --cleanup-work");
    removeOwnedWorkDirectory(outputDirectory, stagingDirectory, ".conversion-staging");
  }
  fs.mkdirSync(stagingDirectory, { recursive: true });
  const stagedModelPath = path.join(stagingDirectory, "model.slm");
  const stagedManifestPath = `${stagedModelPath}.manifest`;
  const rawSourceDirectory = path.join(stagingDirectory, "raw-source");
  const weightPath = sourceWeightPath(sourceDirectory, candidate);
  await runCheckedCommand(run, settings.slmPackPath, [
    "convert-safetensors-trained",
    weightPath,
    candidate.sourceTemplate,
    rawSourceDirectory,
    stagedModelPath,
    settings.quantization,
    reviewPath
  ], {
    cwd: settings.workspaceRoot,
    timeoutMs: settings.convertTimeoutMs,
    logPath: path.join(outputDirectory, "conversion.log"),
    label: "model conversion",
    onOutput: settings.onOutput
  });
  invariant(fs.statSync(stagedModelPath, { throwIfNoEntry: false })?.isFile(),
    "conversion did not produce a model");
  invariant(fs.statSync(stagedManifestPath, { throwIfNoEntry: false })?.isFile(),
    "conversion did not produce a manifest");
  await validateConvertedArtifact(run, settings, stagedModelPath, stagedManifestPath);
  fs.renameSync(stagedModelPath, modelPath);
  fs.renameSync(stagedManifestPath, manifestPath);
  syncDirectory(outputDirectory);
  await validateConvertedArtifact(run, settings, modelPath, manifestPath);
  return Object.freeze({ modelPath, manifestPath, stagingDirectory });
}

// Builds the immutable identity of source review and model conversion work.
async function conversionConfiguration(candidate, settings, sourceReceiptPath) {
  const identity = Object.freeze({
    schema: conversionReceiptSchema,
    candidate,
    quantization: settings.quantization,
    sourceReceiptSha256: await sha256File(sourceReceiptPath),
    evalCasesSha256: await sha256File(settings.evalCasesPath),
    referencePromptSha256: await sha256File(settings.referencePromptPath),
    slmPackSha256: await sha256File(settings.slmPackPath)
  });
  return Object.freeze({
    identity,
    identitySha256: sha256Bytes(canonicalJson(identity))
  });
}

// Resumes or creates one content-bound conversion phase in a versioned directory.
async function ensureConversionPhase(run, settings, candidate, sourceDirectory,
  outputDirectory, configuration) {
  const conversionDirectory = path.join(
    outputDirectory, "conversions", configuration.identitySha256);
  fs.mkdirSync(conversionDirectory, { recursive: true });
  const receiptPath = path.join(conversionDirectory, "conversion-receipt.json");
  const retained = readBoundedJson(receiptPath);
  if (retained) {
    invariant(retained.schema === conversionReceiptSchema,
      "conversion receipt schema changed");
    invariant(retained.identitySha256 === configuration.identitySha256,
      "conversion receipt identity changed");
    invariant(isPlainObject(retained.artifacts), "conversion receipt artifacts are invalid");
    for (const key of ["review", "model", "manifest"]) {
      await validateArtifactEvidence(retained.artifacts[key], `conversion receipt ${key}`);
    }
    return Object.freeze({
      receipt: Object.freeze(retained),
      reviewPath: retained.artifacts.review.path,
      modelPath: retained.artifacts.model.path,
      manifestPath: retained.artifacts.manifest.path,
      stagingDirectory: path.join(conversionDirectory, ".conversion-staging")
    });
  }

  const reviewPath = await ensureCandidateReview(
    run, settings, candidate, sourceDirectory, conversionDirectory);
  const converted = await ensureConvertedArtifact(
    run,
    { ...settings, logPrefix: path.join(conversionDirectory, "conversion") },
    candidate,
    sourceDirectory,
    conversionDirectory,
    reviewPath
  );
  const artifacts = Object.freeze({
    review: await artifactEvidence(reviewPath),
    model: await artifactEvidence(converted.modelPath),
    manifest: await artifactEvidence(converted.manifestPath)
  });
  const receipt = Object.freeze({
    schema: conversionReceiptSchema,
    status: "validated",
    completedUtc: new Date().toISOString(),
    identitySha256: configuration.identitySha256,
    identity: configuration.identity,
    artifacts
  });
  atomicWriteJson(receiptPath, receipt);
  if (settings.cleanupWork && fs.statSync(converted.stagingDirectory, { throwIfNoEntry: false })) {
    removeOwnedWorkDirectory(
      conversionDirectory, converted.stagingDirectory, ".conversion-staging");
  }
  return Object.freeze({
    receipt,
    reviewPath,
    modelPath: converted.modelPath,
    manifestPath: converted.manifestPath,
    stagingDirectory: converted.stagingDirectory
  });
}

// Executes the complete native eval and accepts its expected nonzero rejection code.
async function ensureEvalEvidence(run, settings, outputDirectory, modelPath, manifestPath) {
  const evalPath = path.join(outputDirectory, "assistant-quality.eval");
  if (fs.statSync(evalPath, { throwIfNoEntry: false })?.isFile()) {
    return Object.freeze({ evalPath, decision: parseEvalDecision(evalPath, settings.requiredCaseCount) });
  }
  const stagingPath = path.join(outputDirectory, "assistant-quality.eval.staging");
  fs.rmSync(stagingPath, { force: true });
  const started = Date.now();
  const result = await run(settings.evalPath, [
    modelPath,
    manifestPath,
    settings.evalCasesPath,
    stagingPath
  ], {
    cwd: settings.workspaceRoot,
    timeoutMs: settings.evalTimeoutMs,
    onOutput: settings.onOutput
  });
  atomicWriteText(path.join(outputDirectory, "eval.log"), [
    `executable=${path.basename(settings.evalPath)}`,
    "argument_count=4",
    `elapsed_ms=${Date.now() - started}`,
    `exit_code=${result.code}`,
    `signal=${result.signal || "none"}`,
    `timed_out=${result.timedOut === true}`,
    "--- stdout ---",
    result.stdout || "",
    "--- stderr ---",
    result.stderr || ""
  ].join("\n"));
  invariant(!result.timedOut, "assistant-quality eval timed out");
  invariant(result.code === 0 || result.code === 1,
    `assistant-quality eval failed with infrastructure exit code ${result.code}`);
  invariant(fs.statSync(stagingPath, { throwIfNoEntry: false })?.isFile(),
    "assistant-quality eval did not produce evidence");
  const decision = parseEvalDecision(stagingPath, settings.requiredCaseCount);
  invariant((result.code === 0) === decision.qualified,
    "eval process result disagrees with its sidecar");
  fs.renameSync(stagingPath, evalPath);
  syncDirectory(outputDirectory);
  return Object.freeze({ evalPath, decision });
}

// Builds the immutable identity of one eval against one exact converted artifact.
async function evalConfiguration(settings, conversion) {
  const identity = Object.freeze({
    schema: evalReceiptSchema,
    conversionIdentitySha256: conversion.receipt.identitySha256,
    modelSha256: conversion.receipt.artifacts.model.sha256,
    manifestSha256: conversion.receipt.artifacts.manifest.sha256,
    requiredCaseCount: settings.requiredCaseCount,
    evalCasesSha256: await sha256File(settings.evalCasesPath),
    evalBinarySha256: await sha256File(settings.evalPath)
  });
  return Object.freeze({
    identity,
    identitySha256: sha256Bytes(canonicalJson(identity))
  });
}

// Resumes or creates one evaluator-bound phase without rerunning conversion.
async function ensureEvalPhase(run, settings, outputDirectory, conversion, configuration) {
  const evalDirectory = path.join(outputDirectory, "evaluations", configuration.identitySha256);
  fs.mkdirSync(evalDirectory, { recursive: true });
  const receiptPath = path.join(evalDirectory, "eval-receipt.json");
  const retained = readBoundedJson(receiptPath);
  if (retained) {
    invariant(retained.schema === evalReceiptSchema, "eval receipt schema changed");
    invariant(retained.identitySha256 === configuration.identitySha256,
      "eval receipt identity changed");
    await validateArtifactEvidence(retained.artifact, "eval receipt");
    const decision = parseEvalDecision(retained.artifact.path, settings.requiredCaseCount);
    invariant(decision.qualified === (retained.status === "qualified"),
      "eval receipt decision changed");
    return Object.freeze({ receipt: Object.freeze(retained), evalPath: retained.artifact.path,
      decision });
  }

  const evaluated = await ensureEvalEvidence(
    run,
    settings,
    evalDirectory,
    conversion.modelPath,
    conversion.manifestPath
  );
  const artifact = await artifactEvidence(evaluated.evalPath);
  const receipt = Object.freeze({
    schema: evalReceiptSchema,
    status: evaluated.decision.qualified ? "qualified" : "rejected",
    completedUtc: new Date().toISOString(),
    identitySha256: configuration.identitySha256,
    identity: configuration.identity,
    decision: evaluated.decision,
    artifact
  });
  atomicWriteJson(receiptPath, receipt);
  return Object.freeze({ receipt, evalPath: evaluated.evalPath, decision: evaluated.decision });
}

// Binds the final decision to independently resumable conversion and eval phases.
function qualificationConfiguration(conversionConfigurationValue, evalConfigurationValue) {
  const identity = Object.freeze({
    schema: receiptSchema,
    conversionIdentitySha256: conversionConfigurationValue.identitySha256,
    evalIdentitySha256: evalConfigurationValue.identitySha256
  });
  return Object.freeze({
    identity,
    configurationSha256: sha256Bytes(canonicalJson(identity))
  });
}

function currentRuntimeIdentifier() {
  const osName = process.platform === "win32"
    ? "win"
    : process.platform === "darwin" ? "osx" : process.platform;
  return `${osName}-${process.arch}`;
}

function openQualificationEvidenceStore(settings) {
  const evidenceRoot = settings.evidenceRoot
    ? path.resolve(settings.evidenceRoot)
    : path.join(settings.outputRoot, "evidence");
  const store = new CampaignEvidenceStore(evidenceRoot, {
    knownSecrets: Array.isArray(settings.knownSecrets) ? settings.knownSecrets : []
  });
  const rebuilt = store.rebuild();
  const retainedQuarantine = fs.readdirSync(store.quarantinePath, { withFileTypes: true })
    .some((entry) => entry.isFile());
  invariant(rebuilt.quarantined.length === 0 && !retainedQuarantine,
    "qualification evidence store contains quarantined files");
  return store;
}

function qualificationCampaignId(settings) {
  return String(settings.campaignId || "tinyrustlm-model-qualification");
}

function matchingPhaseReceipts(store, receiptType, campaignId, modelId, configurationHash) {
  return store.listReceipts((receipt) => receipt.receiptType === receiptType &&
    receipt.campaignId === campaignId &&
    receipt.configurationHash === configurationHash &&
    receipt.publicSafeParameters.modelId === modelId);
}

// Creates a phase receipt once, or proves the existing content-addressed receipt is identical.
function putQualificationPhaseReceipt(store, input) {
  invariant(/^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,255}$/.test(
    String(input.publicSafeParameters.modelId || "")),
  "qualification phase requires a concrete public model identity");
  const matching = matchingPhaseReceipts(
    store,
    input.receiptType,
    input.campaignId,
    input.publicSafeParameters.modelId,
    input.configurationHash
  );
  invariant(matching.length <= 1, "qualification phase has duplicate receipt identities");
  if (matching.length === 1) {
    const existing = matching[0];
    const expected = finalizedReceipt({
      ...input,
      attempt: existing.attempt,
      supersedesReceiptIds: existing.supersedesReceiptIds
    }, store.options);
    invariant(expected.receiptId === existing.receiptId,
      "qualification phase receipt content changed without a configuration change");
    return existing;
  }
  const previous = store.listReceipts((receipt) => receipt.receiptType === input.receiptType &&
    receipt.campaignId === input.campaignId &&
    receipt.publicSafeParameters.modelId === input.publicSafeParameters.modelId);
  const attempt = previous
    .reduce((maximum, receipt) => Math.max(maximum, receipt.attempt), 0) + 1;
  return store.putReceipt({ ...input, attempt }).receipt;
}

function baseQualificationReceiptInput(settings, candidate, evidenceClass) {
  return Object.freeze({
    campaignId: qualificationCampaignId(settings),
    sourceRevision: candidate.revision,
    runtimeIdentifier: currentRuntimeIdentifier(),
    operatingSystem: process.platform,
    architecture: process.arch,
    hardwareEvidence: {
      executionBoundary: evidenceClass === "fixture" ? "injected-test-runner" : "local-native-process",
      physicalHardwareAttested: false
    },
    redactionVersion: "tinyrustlm.public-receipt-redaction.v1",
    evidenceClass,
    externalEvidenceReferences: [],
    attestationReference: null
  });
}

// Materializes the public-safe conversion -> eval -> qualification receipt graph.
function persistQualificationEvidenceGraph(store, settings, candidate, conversion, evaluated,
  configuration, finalReceipt, evidenceClass, previousQualificationReceipt) {
  const base = baseQualificationReceiptInput(settings, candidate, evidenceClass);
  const conversionIdentity = conversion.receipt.identity;
  const conversionReceipt = putQualificationPhaseReceipt(store, {
    ...base,
    receiptType: "tinyrustlm.model-conversion",
    phase: "model-conversion",
    status: "pass",
    createdAtUtc: conversion.receipt.completedUtc,
    completedAtUtc: conversion.receipt.completedUtc,
    inputReceiptIds: [],
    inputHashes: {
      chatTemplate: candidate.chatTemplateSha256,
      configuration: conversion.receipt.identitySha256,
      evalCases: conversionIdentity.evalCasesSha256,
      referencePrompt: conversionIdentity.referencePromptSha256,
      slmPack: conversionIdentity.slmPackSha256,
      sourceReceipt: conversionIdentity.sourceReceiptSha256
    },
    outputHashes: {
      manifest: conversion.receipt.artifacts.manifest.sha256,
      model: conversion.receipt.artifacts.model.sha256,
      review: conversion.receipt.artifacts.review.sha256
    },
    toolNames: ["tinyrustlm-slm-pack"],
    toolVersions: ["content-hash-bound"],
    toolBinaryHashes: [conversionIdentity.slmPackSha256],
    configurationHash: conversion.receipt.identitySha256,
    publicSafeParameters: {
      modelId: candidate.modelId,
      quantization: settings.quantization,
      sourceTemplate: candidate.sourceTemplate,
      chatTemplateKind: candidate.chatTemplateKind,
      modelByteCount: conversion.receipt.artifacts.model.byteCount,
      manifestByteCount: conversion.receipt.artifacts.manifest.byteCount
    },
    boundedDiagnostics: { validationStatus: conversion.receipt.status },
    blockerCode: null,
    supersedesReceiptIds: []
  });

  const evalIdentity = evaluated.receipt.identity;
  const evalStatus = evaluated.decision.qualified ? "pass" : "rejected";
  const evalReceipt = putQualificationPhaseReceipt(store, {
    ...base,
    receiptType: "tinyrustlm.model-evaluation",
    phase: "model-evaluation",
    status: evalStatus,
    createdAtUtc: evaluated.receipt.completedUtc,
    completedAtUtc: evaluated.receipt.completedUtc,
    inputReceiptIds: [conversionReceipt.receiptId],
    inputHashes: {
      configuration: evaluated.receipt.identitySha256,
      evalBinary: evalIdentity.evalBinarySha256,
      evalCases: evalIdentity.evalCasesSha256,
      manifest: evalIdentity.manifestSha256,
      model: evalIdentity.modelSha256
    },
    outputHashes: { evaluation: evaluated.receipt.artifact.sha256 },
    toolNames: ["tinyrustlm-eval"],
    toolVersions: ["content-hash-bound"],
    toolBinaryHashes: [evalIdentity.evalBinarySha256],
    configurationHash: evaluated.receipt.identitySha256,
    publicSafeParameters: {
      modelId: candidate.modelId,
      expectedCaseCount: evaluated.decision.expectedCaseCount,
      casesPassed: evaluated.decision.casesPassed,
      casesFailed: evaluated.decision.casesFailed,
      noCheatStatus: evaluated.decision.noCheatStatus,
      qualityScope: evaluated.decision.qualityScope,
      promptFormat: evaluated.decision.promptFormat,
      systemPromptSha256: evaluated.decision.systemPromptSha256,
      evaluator: evaluated.decision.evaluator,
      evaluationSamplingProfile: evaluated.decision.evaluationSamplingProfile,
      modelSamplingProfile: evaluated.decision.modelSamplingProfile,
      samplingTemperature: evaluated.decision.samplingTemperature,
      samplingTopK: evaluated.decision.samplingTopK,
      samplingTopP: evaluated.decision.samplingTopP,
      samplingRepetitionPenalty: evaluated.decision.samplingRepetitionPenalty
    },
    boundedDiagnostics: {
      evalStatus: evaluated.decision.evalStatus,
      noCheatStatus: evaluated.decision.noCheatStatus
    },
    blockerCode: evaluated.decision.qualified ? null : "model_quality_rejected",
    supersedesReceiptIds: []
  });

  let supersededQualificationId = null;
  const priorId = previousQualificationReceipt?.evidenceReceiptIds?.qualification;
  if (priorId && previousQualificationReceipt.configurationSha256 !== configuration.configurationSha256) {
    invariant(store.readReceipt(priorId), "previous qualification evidence receipt is missing");
    supersededQualificationId = priorId;
  }
  const qualificationStatus = evaluated.decision.qualified ? "pass" : "rejected";
  const qualificationReceipt = putQualificationPhaseReceipt(store, {
    ...base,
    receiptType: "tinyrustlm.model-qualification",
    phase: "model-qualification",
    status: qualificationStatus,
    createdAtUtc: finalReceipt.completedUtc,
    completedAtUtc: finalReceipt.completedUtc,
    inputReceiptIds: [conversionReceipt.receiptId, evalReceipt.receiptId],
    inputHashes: {
      chatTemplate: candidate.chatTemplateSha256,
      configuration: configuration.configurationSha256,
      conversion: conversion.receipt.identitySha256,
      evalCases: finalReceipt.toolchain.evalCasesSha256,
      evaluation: evaluated.receipt.identitySha256,
      sourceReceipt: finalReceipt.sourceReceiptSha256
    },
    outputHashes: {
      evaluation: finalReceipt.artifacts.eval.sha256,
      manifest: finalReceipt.artifacts.manifest.sha256,
      model: finalReceipt.artifacts.model.sha256,
      review: finalReceipt.artifacts.review.sha256
    },
    toolNames: ["tinyrustlm-slm-pack", "tinyrustlm-eval"],
    toolVersions: ["content-hash-bound", "content-hash-bound"],
    toolBinaryHashes: [
      finalReceipt.toolchain.slmPackSha256,
      finalReceipt.toolchain.evalBinarySha256
    ],
    configurationHash: configuration.configurationSha256,
    publicSafeParameters: {
      modelId: candidate.modelId,
      quantization: settings.quantization,
      qualityClaim: evaluated.decision.qualified ? "conversation-proven" : "rejected",
      casesPassed: evaluated.decision.casesPassed,
      expectedCaseCount: evaluated.decision.expectedCaseCount,
      chatTemplateKind: candidate.chatTemplateKind,
      promptFormat: evaluated.decision.promptFormat,
      systemPromptSha256: evaluated.decision.systemPromptSha256,
      evaluator: evaluated.decision.evaluator,
      evaluationSamplingProfile: evaluated.decision.evaluationSamplingProfile,
      modelSamplingProfile: evaluated.decision.modelSamplingProfile,
      samplingTemperature: evaluated.decision.samplingTemperature,
      samplingTopK: evaluated.decision.samplingTopK,
      samplingTopP: evaluated.decision.samplingTopP,
      samplingRepetitionPenalty: evaluated.decision.samplingRepetitionPenalty
    },
    boundedDiagnostics: {
      decision: qualificationStatus,
      noCheatStatus: evaluated.decision.noCheatStatus
    },
    blockerCode: evaluated.decision.qualified ? null : "model_quality_rejected",
    supersedesReceiptIds: supersededQualificationId ? [supersededQualificationId] : []
  });
  return Object.freeze({
    conversion: conversionReceipt.receiptId,
    evaluation: evalReceipt.receiptId,
    qualification: qualificationReceipt.receiptId
  });
}

// Moves an obsolete current receipt into content-addressed history before replacement.
async function archiveStaleQualificationReceipt(receiptPath) {
  const stat = fs.statSync(receiptPath, { throwIfNoEntry: false });
  if (!stat) return null;
  invariant(stat.isFile(), "qualification receipt path is not a file");
  const sha256 = await sha256File(receiptPath);
  const historyDirectory = path.join(path.dirname(receiptPath), "receipt-history");
  fs.mkdirSync(historyDirectory, { recursive: true });
  const historyPath = path.join(historyDirectory, `qualification-receipt.${sha256}.json`);
  const retained = fs.statSync(historyPath, { throwIfNoEntry: false });
  if (retained) {
    invariant(retained.isFile() && await sha256File(historyPath) === sha256,
      "qualification receipt history collision");
    fs.rmSync(receiptPath);
  } else {
    fs.renameSync(receiptPath, historyPath);
  }
  syncDirectory(historyDirectory);
  syncDirectory(path.dirname(receiptPath));
  return historyPath;
}

// Revalidates every retained final artifact before trusting a completed receipt.
async function resumeQualificationReceipt(receiptPath, configurationSha256) {
  const receipt = readBoundedJson(receiptPath);
  if (!receipt) return null;
  if (receipt.schema !== receiptSchema) return null;
  if (receipt.configurationSha256 !== configurationSha256) return null;
  invariant(receipt.status === "qualified" || receipt.status === "rejected",
    "qualification receipt status is invalid");
  invariant(isPlainObject(receipt.artifacts), "qualification receipt artifacts are invalid");
  for (const key of ["model", "manifest", "eval", "review"]) {
    await validateArtifactEvidence(
      receipt.artifacts[key], `qualification receipt ${key}`);
  }
  const decision = parseEvalDecision(receipt.artifacts.eval.path, receipt.eval.expectedCaseCount);
  invariant(decision.qualified === (receipt.status === "qualified"),
    "qualification receipt decision changed");
  return Object.freeze(receipt);
}

// Qualifies one immutable source candidate end to end through authoritative Rust gates.
async function qualifyCandidate(candidate, settings, dependencies = {}) {
  const acquireCandidate = dependencies.acquireCandidate || acquisition.acquireCandidate;
  const run = dependencies.runProcess || runProcess;
  const evidenceClass = dependencies.acquireCandidate || dependencies.runProcess ? "fixture" : "local";
  const evidenceStore = openQualificationEvidenceStore(settings);
  const outputDirectory = candidateOutputDirectory(settings.outputRoot, candidate);
  fs.mkdirSync(outputDirectory, { recursive: true });
  const sourceDirectory = acquisition.candidateDirectory(settings.sourceRoot, candidate);
  const sourceReceiptPath = path.join(sourceDirectory, "source-acquisition.json");
  const receiptPath = path.join(outputDirectory, "qualification-receipt.json");

  await acquireCandidate(candidate, settings.sourceRoot, settings.acquisitionOptions);
  invariant(fs.statSync(sourceReceiptPath, { throwIfNoEntry: false })?.isFile(),
    "source acquisition did not produce a receipt");
  const conversionConfig = await conversionConfiguration(
    candidate, settings, sourceReceiptPath);
  const converted = await ensureConversionPhase(
    run,
    settings,
    candidate,
    sourceDirectory,
    outputDirectory,
    conversionConfig
  );
  const evalConfig = await evalConfiguration(settings, converted);
  const evaluated = await ensureEvalPhase(
    run, settings, outputDirectory, converted, evalConfig);
  const configuration = qualificationConfiguration(conversionConfig, evalConfig);
  const previousQualificationReceipt = readBoundedJson(receiptPath);
  const resumed = await resumeQualificationReceipt(receiptPath, configuration.configurationSha256);
  if (resumed) {
    const evidenceReceiptIds = persistQualificationEvidenceGraph(
      evidenceStore,
      settings,
      candidate,
      converted,
      evaluated,
      configuration,
      resumed,
      evidenceClass,
      previousQualificationReceipt
    );
    invariant(resumed.evidenceReceiptIds,
      "resumed qualification receipt lacks the current evidence graph");
    invariant(resumed.evidenceClass === evidenceClass,
      "qualification evidence class changed");
    invariant(canonicalJson(resumed.evidenceReceiptIds) === canonicalJson(evidenceReceiptIds),
      "qualification evidence receipt identities changed");
    return resumed;
  }

  const artifacts = Object.freeze({
    model: converted.receipt.artifacts.model,
    manifest: converted.receipt.artifacts.manifest,
    eval: evaluated.receipt.artifact,
    review: converted.receipt.artifacts.review
  });
  const receiptWithoutEvidenceGraph = Object.freeze({
    schema: receiptSchema,
    status: evaluated.decision.qualified ? "qualified" : "rejected",
    completedUtc: evaluated.receipt.completedUtc,
    configurationSha256: configuration.configurationSha256,
    modelId: candidate.modelId,
    revision: candidate.revision,
    sourceTemplate: candidate.sourceTemplate,
    chatTemplateKind: candidate.chatTemplateKind,
    chatTemplateSha256: candidate.chatTemplateSha256,
    quantization: settings.quantization,
    eval: evaluated.decision,
    artifacts,
    sourceReceiptSha256: conversionConfig.identity.sourceReceiptSha256,
    phases: Object.freeze({
      conversionIdentitySha256: conversionConfig.identitySha256,
      evalIdentitySha256: evalConfig.identitySha256
    }),
    toolchain: Object.freeze({
      slmPackSha256: conversionConfig.identity.slmPackSha256,
      evalBinarySha256: evalConfig.identity.evalBinarySha256,
      evalCasesSha256: evalConfig.identity.evalCasesSha256
    })
  });
  const evidenceReceiptIds = persistQualificationEvidenceGraph(
    evidenceStore,
    settings,
    candidate,
    converted,
    evaluated,
    configuration,
    receiptWithoutEvidenceGraph,
    evidenceClass,
    previousQualificationReceipt
  );
  const receipt = Object.freeze({
    ...receiptWithoutEvidenceGraph,
    evidenceClass,
    evidenceReceiptIds
  });
  await archiveStaleQualificationReceipt(receiptPath);
  atomicWriteJson(receiptPath, receipt);
  return receipt;
}

// Persists an expected source tensor incompatibility as a terminal reviewed decision.
async function persistSourceReviewRejectionEvidence(settings, candidate, rejection, evidenceClass) {
  const store = openQualificationEvidenceStore(settings);
  const sourceDirectory = acquisition.candidateDirectory(settings.sourceRoot, candidate);
  const sourceReceiptPath = path.join(sourceDirectory, "source-acquisition.json");
  const sourceReceipt = readBoundedJson(sourceReceiptPath);
  invariant(sourceReceipt?.schema === "tinyrustlm.huggingface_source_acquisition.v2" &&
    sourceReceipt.status === "verified" && sourceReceipt.modelId === candidate.modelId &&
    sourceReceipt.revision === candidate.revision && Array.isArray(sourceReceipt.files),
  "source rejection requires a verified matching acquisition receipt");
  const weightFilename = path.basename(sourceWeightPath(sourceDirectory, candidate));
  const weightEvidence = sourceReceipt.files.find((entry) => entry.filename === weightFilename);
  invariant(isPlainObject(weightEvidence) &&
    weightEvidence.sha256 === candidate.weightFiles[0].sha256,
  "source rejection weight identity changed");
  const sourceReceiptSha256 = await sha256File(sourceReceiptPath);
  const reviewArtifact = await artifactEvidence(rejection.reviewPath);
  const slmPackSha256 = await sha256File(settings.slmPackPath);
  const identity = Object.freeze({
    schema: sourceRejectionSchema,
    candidate: sha256Bytes(canonicalJson(candidate)),
    rejectionCode: rejection.decision.rejectionCode,
    reviewSha256: reviewArtifact.sha256,
    slmPackSha256,
    sourceReceiptSha256,
    sourceWeightSha256: weightEvidence.sha256
  });
  const configurationHash = sha256Bytes(canonicalJson(identity));
  const matching = matchingPhaseReceipts(
    store,
    sourceRejectionReceiptType,
    qualificationCampaignId(settings),
    candidate.modelId,
    configurationHash
  );
  invariant(matching.length <= 1, "source rejection has duplicate receipt identities");
  if (matching.length === 1) {
    const existing = matching[0];
    invariant(existing.status === "rejected" &&
      existing.outputHashes.review === reviewArtifact.sha256 &&
      existing.publicSafeParameters.rejectionCode === rejection.decision.rejectionCode,
    "source rejection receipt content changed");
    return existing;
  }
  const priorErrors = store.listReceipts((receipt) =>
    receipt.receiptType === "tinyrustlm.model-qualification-error" &&
    receipt.campaignId === qualificationCampaignId(settings) &&
    receipt.publicSafeParameters.modelId === candidate.modelId);
  const completedAtUtc = new Date().toISOString();
  return putQualificationPhaseReceipt(store, {
    ...baseQualificationReceiptInput(settings, candidate, evidenceClass),
    receiptType: sourceRejectionReceiptType,
    phase: "model-source-review",
    status: "rejected",
    createdAtUtc: completedAtUtc,
    completedAtUtc,
    inputReceiptIds: [],
    inputHashes: {
      candidate: identity.candidate,
      configuration: configurationHash,
      sourceReceipt: sourceReceiptSha256,
      sourceModel: weightEvidence.sha256
    },
    outputHashes: { review: reviewArtifact.sha256 },
    toolNames: ["tinyrustlm-slm-pack"],
    toolVersions: ["content-hash-bound"],
    toolBinaryHashes: [slmPackSha256],
    configurationHash,
    publicSafeParameters: {
      modelId: candidate.modelId,
      sourceTemplate: candidate.sourceTemplate,
      rejectionCode: rejection.decision.rejectionCode,
      rejectionScope: rejection.decision.rejectionScope,
      sourceWeightByteCount: weightEvidence.byteCount
    },
    boundedDiagnostics: {
      reviewStatus: "rejected",
      rejectionCode: rejection.decision.rejectionCode
    },
    blockerCode: "candidate_source_tensor_contract_rejected",
    supersedesReceiptIds: priorErrors.map((receipt) => receipt.receiptId)
  });
}

// Reduces arbitrary failures to bounded public-safe local error evidence.
function boundedErrorMessage(error) {
  return String(error && error.message || error || "unknown error")
    .replace(/[\r\n\t]+/gu, " ")
    .slice(0, 1000);
}

function qualificationErrorClassification(message) {
  const normalized = String(message).toLowerCase();
  if (/acquir|download|source acquisition|source receipt/u.test(normalized)) {
    return Object.freeze({
      phase: "model-source-acquisition",
      blockerCode: "candidate_source_acquisition_failed"
    });
  }
  if (/candidate review/u.test(normalized)) {
    return Object.freeze({
      phase: "model-source-review",
      blockerCode: "candidate_source_review_failed"
    });
  }
  if (/eval/u.test(normalized)) {
    return Object.freeze({
      phase: "model-evaluation",
      blockerCode: "candidate_evaluation_infrastructure_failed"
    });
  }
  if (/convert|manifest|validation|artifact/u.test(normalized)) {
    return Object.freeze({
      phase: "model-conversion",
      blockerCode: "candidate_conversion_failed"
    });
  }
  return Object.freeze({
    phase: "model-qualification",
    blockerCode: "candidate_qualification_infrastructure_failed"
  });
}

async function persistQualificationErrorEvidence(settings, candidate, errorEvidence, evidenceClass) {
  const store = openQualificationEvidenceStore(settings);
  const classification = qualificationErrorClassification(errorEvidence.message);
  const runnerSha256 = await sha256File(__filename);
  const identity = Object.freeze({
    schema: errorSchema,
    campaignId: qualificationCampaignId(settings),
    modelId: candidate.modelId,
    revision: candidate.revision,
    phase: classification.phase,
    blockerCode: classification.blockerCode,
    runnerSha256
  });
  const configurationHash = sha256Bytes(canonicalJson(identity));
  const receiptType = "tinyrustlm.model-qualification-error";
  const matching = matchingPhaseReceipts(
    store,
    receiptType,
    qualificationCampaignId(settings),
    candidate.modelId,
    configurationHash
  );
  invariant(matching.length <= 1, "qualification error has duplicate receipt identities");
  if (matching.length === 1) return matching[0];

  const previous = store.listReceipts((receipt) => receipt.receiptType === receiptType &&
    receipt.campaignId === qualificationCampaignId(settings) &&
    receipt.publicSafeParameters.modelId === candidate.modelId);
  const attempt = previous.reduce((maximum, receipt) => Math.max(maximum, receipt.attempt), 0) + 1;
  return store.putReceipt({
    ...baseQualificationReceiptInput(settings, candidate, evidenceClass),
    receiptType,
    phase: classification.phase,
    attempt,
    status: "fail",
    createdAtUtc: errorEvidence.observedUtc,
    completedAtUtc: errorEvidence.observedUtc,
    inputReceiptIds: [],
    inputHashes: {
      candidate: sha256Bytes(canonicalJson(candidate)),
      configuration: configurationHash,
      runner: runnerSha256
    },
    outputHashes: {},
    toolNames: ["model-qualification-runner"],
    toolVersions: ["content-hash-bound"],
    toolBinaryHashes: [runnerSha256],
    configurationHash,
    publicSafeParameters: {
      modelId: candidate.modelId,
      errorStage: classification.phase,
      errorCode: classification.blockerCode
    },
    boundedDiagnostics: {
      errorStage: classification.phase,
      errorCode: classification.blockerCode
    },
    blockerCode: classification.blockerCode,
    supersedesReceiptIds: []
  }).receipt;
}

// Selects explicit candidate indices without allowing duplicates or range drift.
function selectCandidates(inventory, indices) {
  invariant(isPlainObject(inventory) && inventory.schema === inventorySchema,
    "candidate inventory schema is invalid");
  invariant(Array.isArray(inventory.candidates), "candidate inventory list is invalid");
  invariant(Array.isArray(indices) && indices.length > 0 && indices.length <= 100,
    "candidate indices are invalid");
  const unique = new Set(indices);
  invariant(unique.size === indices.length, "candidate indices contain duplicates");
  return indices.map((index) => {
    invariant(Number.isSafeInteger(index) && index >= 0 && index < inventory.candidates.length,
      `candidate index is outside the inventory: ${index}`);
    return inventory.candidates[index];
  });
}

// Runs a bounded candidate batch while preserving independent failure evidence.
async function runQualificationBatch(options, dependencies = {}) {
  const inventory = readBoundedJson(options.inventoryPath);
  invariant(inventory, "candidate inventory is missing");
  const candidates = selectCandidates(inventory, options.indices);
  const receipts = [];
  for (const candidate of candidates) {
    const outputDirectory = candidateOutputDirectory(options.outputRoot, candidate);
    try {
      process.stdout.write(`Qualifying ${candidate.modelId}@${candidate.revision}\n`);
      const receipt = await qualifyCandidate(candidate, options, dependencies);
      receipts.push(receipt);
      process.stdout.write(`${receipt.status.toUpperCase()} ${candidate.modelId}: ` +
        `${receipt.eval.casesPassed}/${receipt.eval.expectedCaseCount}\n`);
    } catch (error) {
      fs.mkdirSync(outputDirectory, { recursive: true });
      if (error instanceof CandidateSourceRejection) {
        const evidenceClass = dependencies.acquireCandidate || dependencies.runProcess
          ? "fixture"
          : "local";
        const rejectionReceipt = await persistSourceReviewRejectionEvidence(
          options, candidate, error, evidenceClass);
        const evidence = Object.freeze({
          schema: sourceRejectionSchema,
          status: "rejected",
          completedUtc: rejectionReceipt.completedAtUtc,
          modelId: candidate.modelId,
          revision: candidate.revision,
          sourceTemplate: candidate.sourceTemplate,
          rejectionCode: error.decision.rejectionCode,
          reviewSha256: rejectionReceipt.outputHashes.review,
          evidenceReceiptId: rejectionReceipt.receiptId
        });
        atomicWriteJson(path.join(outputDirectory, "source-review-rejection.json"), evidence);
        receipts.push(evidence);
        process.stdout.write(`REJECTED ${candidate.modelId}: ${evidence.rejectionCode}\n`);
        continue;
      }
      const errorPath = path.join(outputDirectory, "qualification-error.json");
      const message = boundedErrorMessage(error);
      const retained = readBoundedJson(errorPath);
      const observedUtc = retained?.schema === errorSchema &&
        retained.modelId === candidate.modelId && retained.revision === candidate.revision &&
        retained.message === message && Number.isFinite(Date.parse(retained.observedUtc))
        ? retained.observedUtc
        : new Date().toISOString();
      const localEvidence = Object.freeze({
        schema: errorSchema,
        status: "error",
        observedUtc,
        modelId: candidate.modelId,
        revision: candidate.revision,
        message
      });
      const evidenceClass = dependencies.acquireCandidate || dependencies.runProcess
        ? "fixture"
        : "local";
      const errorReceipt = await persistQualificationErrorEvidence(
        options, candidate, localEvidence, evidenceClass);
      const evidence = Object.freeze({
        ...localEvidence,
        evidenceReceiptId: errorReceipt.receiptId
      });
      atomicWriteJson(path.join(outputDirectory, "qualification-error.json"), evidence);
      receipts.push(evidence);
      process.stderr.write(`ERROR ${candidate.modelId}: ${evidence.message}\n`);
      if (!options.continueOnError) throw error;
    }
  }
  return Object.freeze(receipts);
}

// Parses strict CLI flags for one resumable qualification batch.
function parseArguments(argv, workspaceRoot = path.resolve(__dirname, "../..")) {
  const values = new Map();
  const switches = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (["--cleanup-work", "--continue-on-error"].includes(argument)) {
      switches.add(argument);
      continue;
    }
    invariant(argument.startsWith("--") && index + 1 < argv.length,
      `invalid qualification argument: ${argument}`);
    invariant(!values.has(argument), `duplicate qualification argument: ${argument}`);
    values.set(argument, argv[index + 1]);
    index += 1;
  }
  for (const required of ["--inventory", "--source-root", "--output-root", "--indices"]) {
    invariant(values.has(required), `missing required argument: ${required}`);
  }
  const indices = values.get("--indices").split(",").map((value) => Number(value.trim()));
  const requiredCaseCount = Number(values.get("--required-cases") || defaultRequiredCaseCount);
  invariant(Number.isSafeInteger(requiredCaseCount) && requiredCaseCount > 0 && requiredCaseCount <= 100,
    "required case count is invalid");
  const options = {
    workspaceRoot: path.resolve(workspaceRoot),
    campaignId: values.get("--campaign-id") || "tinyrustlm-model-qualification",
    inventoryPath: path.resolve(values.get("--inventory")),
    sourceRoot: path.resolve(values.get("--source-root")),
    outputRoot: path.resolve(values.get("--output-root")),
    evidenceRoot: values.has("--evidence-root")
      ? path.resolve(values.get("--evidence-root"))
      : null,
    indices,
    quantization: values.get("--quantization") || "q8_0",
    requiredCaseCount,
    evalCasesPath: path.resolve(values.get("--eval-cases") ||
      path.join(workspaceRoot,
        "tinyrustlm/tests/fixtures/assistant-quality-cognitive-liberty-conversation-eval-cases.txt")),
    referencePromptPath: path.resolve(values.get("--reference-prompt") ||
      path.join(workspaceRoot,
        "tinyrustlm/tests/fixtures/assistant-quality-cognitive-liberty-reference-prompt.txt")),
    slmPackPath: path.resolve(values.get("--slm-pack") ||
      path.join(workspaceRoot, "target/release/tinyrustlm-slm-pack.exe")),
    evalPath: path.resolve(values.get("--eval") ||
      path.join(workspaceRoot, "target/release/tinyrustlm-eval.exe")),
    reviewTimeoutMs: Number(values.get("--review-timeout-ms") || 10 * 60 * 1000),
    convertTimeoutMs: Number(values.get("--convert-timeout-ms") || 2 * 60 * 60 * 1000),
    evalTimeoutMs: Number(values.get("--eval-timeout-ms") || 60 * 60 * 1000),
    cleanupWork: switches.has("--cleanup-work"),
    continueOnError: switches.has("--continue-on-error"),
    acquisitionOptions: Object.freeze({}),
    onOutput(stream, text) {
      if (stream === "stderr" || /progress|verified|converted|PASS|FAIL/iu.test(text)) {
        process.stdout.write(text);
      }
    }
  };
  invariant(/^[A-Za-z0-9][A-Za-z0-9._-]{2,159}$/.test(options.campaignId),
    "qualification campaign ID is invalid");
  invariant(options.quantization === "q8_0", "qualification currently requires q8_0");
  for (const [label, timeout] of [
    ["review", options.reviewTimeoutMs],
    ["conversion", options.convertTimeoutMs],
    ["eval", options.evalTimeoutMs]
  ]) {
    invariant(Number.isSafeInteger(timeout) && timeout >= 1000, `${label} timeout is invalid`);
  }
  for (const [label, filePath] of [
    ["inventory", options.inventoryPath],
    ["eval cases", options.evalCasesPath],
    ["reference prompt", options.referencePromptPath],
    ["slm pack", options.slmPackPath],
    ["eval binary", options.evalPath]
  ]) {
    invariant(fs.statSync(filePath, { throwIfNoEntry: false })?.isFile(), `${label} file is missing`);
  }
  return Object.freeze(options);
}

// Runs the command-line qualification entry point.
async function main(argv) {
  const options = parseArguments(argv);
  const receipts = await runQualificationBatch(options);
  if (receipts.some((receipt) => receipt.status === "error")) process.exitCode = 2;
  else if (receipts.some((receipt) => receipt.status === "rejected")) process.exitCode = 1;
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`Model qualification failed: ${boundedErrorMessage(error)}\n`);
    process.exitCode = 2;
  });
}

module.exports = Object.freeze({
  candidateOutputDirectory,
  canonicalJson,
  parseArguments,
  parseEvalDecision,
  provenanceTextChecksum,
  putQualificationPhaseReceipt,
  qualifyCandidate,
  receiptSchema,
  runQualificationBatch,
  selectCandidates
});
