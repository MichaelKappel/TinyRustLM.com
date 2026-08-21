"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { canonicalizeVnextJcsBytes } = require("./vnext-jcs.js");

const schema = "tinyrustlm.vnext.source_family_selection.v1";
const repositoryRoot = path.resolve(__dirname, "..", "..");
const trainingRoot = path.join(repositoryRoot, "tinyrustlm", "training");
const outputPath = path.join(
  trainingRoot,
  "qwen2.5-0.5b-vnext-source-family-v1",
  "source-family-selection.v1.json"
);
const selectedAssessmentPath =
  "tinyrustlm/training/qwen2.5-0.5b-instruct-source-screen-v1/assessment-control-v1.json";
const selectedSourceLockPath =
  "tinyrustlm/training/qwen2.5-0.5b-vnext-source-family-v1/source-lock.v1.json";
const expectedAssessmentCount = 37;
const maximumAssessmentBytes = 1024 * 1024;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function regularFileBytes(filePath) {
  const metadata = fs.lstatSync(filePath);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size <= 0 ||
      metadata.size > maximumAssessmentBytes) {
    fail("source_selection_assessment_invalid");
  }
  return fs.readFileSync(filePath);
}

function findAssessmentFiles(directory, files = []) {
  const metadata = fs.lstatSync(directory);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    fail("source_selection_training_root_invalid");
  }
  const entries = fs.readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name, "en"));
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) fail("source_selection_link_forbidden");
    if (entry.isDirectory()) {
      findAssessmentFiles(entryPath, files);
    } else if (entry.isFile() && /^assessment-control(?:-v\d+)?\.json$/.test(entry.name)) {
      files.push(entryPath);
    }
    if (files.length > 1000) fail("source_selection_assessment_count_invalid");
  }
  return files;
}

function requiredText(value, key) {
  const result = value[key];
  if (typeof result !== "string" || result.length === 0 || result.length > 512 ||
      /[\0\r\n]/u.test(result)) {
    fail("source_selection_assessment_invalid");
  }
  return result;
}

function optionalText(value, key) {
  if (!Object.hasOwn(value, key)) return null;
  return requiredText(value, key);
}

function assessmentEvidence(value) {
  const assessmentSchema = requiredText(value, "schema");
  if ([
    "tinyrustlm.source_model_preflight_assessment.v1",
    "tinyrustlm.source_model_preflight_assessment.v2"
  ].includes(assessmentSchema)) {
    if (Object.hasOwn(value, "sourceModelArtifactSha256") ||
        Object.hasOwn(value, "caseDispositions")) {
      fail("source_selection_assessment_invalid");
    }
    return {
      assessmentSchema,
      evidenceClass: "preflight",
      modelArtifactSha256: null,
      caseCount: null,
      passCount: null
    };
  }
  if (assessmentSchema !== "tinyrustlm.source_model_screen_assessment.v1" ||
      !Array.isArray(value.caseDispositions) || value.caseDispositions.length === 0 ||
      value.caseDispositions.some((item) => item === null || typeof item !== "object" ||
        !["pass", "fail"].includes(item.status))) {
    fail("source_selection_assessment_invalid");
  }
  const modelArtifactSha256 = requiredText(value, "sourceModelArtifactSha256");
  if (!/^[0-9a-f]{64}$/u.test(modelArtifactSha256)) {
    fail("source_selection_assessment_invalid");
  }
  return {
    assessmentSchema,
    evidenceClass: "source-screen",
    modelArtifactSha256,
    caseCount: value.caseDispositions.length,
    passCount: value.caseDispositions.filter((item) => item.status === "pass").length
  };
}

function candidateFromFile(filePath) {
  const bytes = regularFileBytes(filePath);
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("source_selection_assessment_invalid");
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("source_selection_assessment_invalid");
  }
  const evidence = assessmentEvidence(value);
  const relativePath = path.relative(repositoryRoot, filePath).replaceAll("\\", "/");
  const candidate = {
    architectureFamily: requiredText(value, "architectureFamily"),
    assessmentPath: relativePath,
    assessmentSchema: evidence.assessmentSchema,
    assessmentSha256: sha256(bytes),
    blockerCode: requiredText(value, "blockerCode"),
    caseCount: evidence.caseCount,
    decision: requiredText(value, "decision"),
    evidenceClass: evidence.evidenceClass,
    licenseId: optionalText(value, "licenseId"),
    licenseDisposition: requiredText(value, "licenseDisposition"),
    licenseIdentityStatus: Object.hasOwn(value, "licenseId")
      ? "declared-in-assessment"
      : "not-recorded-in-historical-assessment",
    modelArtifactSha256: evidence.modelArtifactSha256,
    modelArtifactIdentityStatus: evidence.modelArtifactSha256 === null
      ? "not-acquired-preflight-rejected"
      : "recorded-in-source-screen",
    modelId: requiredText(value, "sourceModelId"),
    passCount: evidence.passCount,
    provenanceStatus: evidence.evidenceClass === "preflight"
      ? requiredText(value, "accessDisposition")
      : "artifact-and-revision-bound-source-screen",
    revision: requiredText(value, "sourceRevision"),
    screenStatus: evidence.evidenceClass === "preflight"
      ? "preflight-rejected-without-generation"
      : "untouched-source-screen-rejected",
    tokenizerIdentityStatus: "not-recorded-in-historical-assessment",
    tokenizerSha256: null
  };
  if (candidate.decision !== "rejected" ||
      !/^[0-9a-f]{40}$/u.test(candidate.revision) ||
      !/^[0-9a-f]{64}$/u.test(candidate.assessmentSha256)) {
    fail("source_selection_assessment_invalid");
  }
  return candidate;
}

function selectedSourceLockEvidence() {
  const absolutePath = path.join(repositoryRoot, selectedSourceLockPath);
  const bytes = regularFileBytes(absolutePath);
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("source_selection_source_lock_invalid");
  }
  const tokenizer = value?.files?.tokenizer;
  const model = value?.files?.model;
  if (value?.schema !== "tinyrustlm.qwen2_source_lock.v1" ||
      value?.modelId !== "Qwen/Qwen2.5-0.5B-Instruct" ||
      value?.revision !== "7ae557604adf67be50417f59c2c2f167def9a775" ||
      value?.architectureProfileId !== "tinyrustlm.qwen2-dense-gqa/1" ||
      value?.licenseSpdx !== "Apache-2.0" ||
      value?.licenseDisposition !== "redistribution-and-conversion-approved" ||
      model?.sha256 !== "fdf756fa7fcbe7404d5c60e26bff1a0c8b8aa1f72ced49e7dd0210fe288fb7fe" ||
      !/^[0-9a-f]{64}$/u.test(tokenizer?.sha256 || "")) {
    fail("source_selection_source_lock_invalid");
  }
  return {
    path: selectedSourceLockPath,
    sha256: sha256(bytes),
    tokenizerSha256: tokenizer.sha256,
    licenseId: value.licenseSpdx
  };
}

function buildSelection() {
  const candidates = findAssessmentFiles(trainingRoot)
    .map(candidateFromFile)
    .sort((left, right) => {
      const model = left.modelId.localeCompare(right.modelId, "en");
      return model === 0 ? left.revision.localeCompare(right.revision, "en") : model;
    });
  if (candidates.length !== expectedAssessmentCount ||
      new Set(candidates.map((candidate) => candidate.assessmentPath)).size !== candidates.length) {
    fail("source_selection_assessment_count_invalid");
  }
  const selected = candidates.find(
    (candidate) => candidate.assessmentPath === selectedAssessmentPath
  );
  if (!selected || selected.modelId !== "Qwen/Qwen2.5-0.5B-Instruct" ||
      selected.revision !== "7ae557604adf67be50417f59c2c2f167def9a775" ||
      selected.modelArtifactSha256 !==
        "fdf756fa7fcbe7404d5c60e26bff1a0c8b8aa1f72ced49e7dd0210fe288fb7fe" ||
      selected.architectureFamily !== "qwen2-dense-full-attention-gqa-head-dim-64" ||
      selected.licenseDisposition !== "apache-2.0-source-review-complete" ||
      selected.decision !== "rejected") {
    fail("source_selection_selected_evidence_invalid");
  }
  const sourceLock = selectedSourceLockEvidence();
  selected.licenseId = sourceLock.licenseId;
  selected.licenseIdentityStatus = "reviewed-source-lock-bound";
  selected.provenanceStatus = "immutable-upstream-revision-and-complete-source-lock-bound";
  selected.sourceLockPath = sourceLock.path;
  selected.sourceLockSha256 = sourceLock.sha256;
  selected.tokenizerIdentityStatus = "exact-source-lock-bound";
  selected.tokenizerSha256 = sourceLock.tokenizerSha256;
  const candidateSetSha256 = sha256(canonicalizeVnextJcsBytes(candidates));
  return {
    artifactAdmissionStatus: "none",
    candidateAssessmentCount: candidates.length,
    candidatePreflightCount: candidates.filter(
      (candidate) => candidate.evidenceClass === "preflight"
    ).length,
    candidateSourceScreenCount: candidates.filter(
      (candidate) => candidate.evidenceClass === "source-screen"
    ).length,
    candidateAssessmentSetSha256: candidateSetSha256,
    candidates,
    decision: "qwen2-family-selected-for-structural-converter-reference-only",
    existingArtifactDecision: "rejected",
    existingArtifactPassCount: selected.passCount,
    existingArtifactCaseCount: selected.caseCount,
    ledgerCompletenessStatus:
      "historical-missing-identities-explicit-new-candidates-require-complete-identities",
    requiredNextGate:
      "qwen3-0.6b-architecture-contract-plus-new-derivative-provenance-and-untouched-screen",
    schema,
    selectedArchitectureProfile: "tinyrustlm.qwen2-dense-gqa/1",
    selectedBaseAssessmentPath: selected.assessmentPath,
    selectedBaseAssessmentSha256: selected.assessmentSha256,
    selectedBaseModelArtifactSha256: selected.modelArtifactSha256,
    selectedBaseModelId: selected.modelId,
    selectedBaseRevision: selected.revision,
    selectedBaseSourceLockPath: sourceLock.path,
    selectedBaseSourceLockSha256: sourceLock.sha256,
    selectedBaseTokenizerSha256: sourceLock.tokenizerSha256,
    selectedConversionProfile: "tinyrustlm.qwen2-safetensors-to-slm2-f32/1",
    selectedConversionProfileSha256:
      "aeafbc2baa25b5e6b8d3a11a40a2d96f23fab9c4dbb4809747664a97238c33eb",
    selectionBasis: [
      "sole-candidate-family-with-exact-current-slm2-head-geometry",
      "dense-rope-rmsnorm-silu-gqa-semantics-exactly-representable",
      "official-apache-2.0-source-review-complete",
      "complete-immutable-local-source-identity",
      "smallest-current-slm2-compatible-reference-for-full-scale-converter-proof"
    ],
    workingModelPlan: "new-fully-pinned-qwen3-0.6b-derivative",
    workingModelStatus: "not-trained-not-screened-not-admitted"
  };
}

function selectionBytes() {
  return Buffer.concat([canonicalizeVnextJcsBytes(buildSelection()), Buffer.from("\n")]);
}

function writeSelection() {
  const bytes = selectionBytes();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const staging = `${outputPath}.staging`;
  fs.writeFileSync(staging, bytes, { flag: "wx" });
  fs.renameSync(staging, outputPath);
  return bytes;
}

function verifySelection() {
  const expected = selectionBytes();
  const actual = regularFileBytes(outputPath);
  if (!actual.equals(expected)) fail("source_selection_output_drift");
  return actual;
}

function main() {
  const argument = process.argv[2];
  if (process.argv.length !== 3 || !["--write", "--verify"].includes(argument)) {
    fail("source_selection_arguments_invalid");
  }
  const bytes = argument === "--write" ? writeSelection() : verifySelection();
  process.stdout.write(`${JSON.stringify({
    schema: "tinyrustlm.vnext.source_family_selection_summary.v1",
    status: "pass",
    byteLength: bytes.length,
    sha256: sha256(bytes),
    candidateAssessmentCount: expectedAssessmentCount,
    artifactAdmissionStatus: "none"
  })}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.code || "source_selection_failed"}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  buildSelection,
  outputPath,
  selectionBytes,
  verifySelection
});
