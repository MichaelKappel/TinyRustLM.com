"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const admission = require("../app/browser-model-admission.js");

const digest = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

function artifact(spec, byteCount) {
  return {
    role: spec.role,
    format: spec.format,
    fileName: spec.fileName,
    byteCount,
    sha256: digest(`artifact-${spec.role}`),
    formatProfileSha256: spec.profileSha256
  };
}

function validAdmission() {
  const sizes = [1_048_576, 7_038_773, 1_403, 65_800, 512, 896];
  const artifacts = admission.artifactSpecs.map((spec, index) => artifact(spec, sizes[index]));
  const resolvedMemberBytes = artifacts.slice(0, 5)
    .reduce((total, value) => total + value.byteCount, 0);
  return {
    schema: admission.schema,
    modelId: "Qwen/Qwen3-0.6B",
    operationId: digest("browser-operation"),
    artifacts,
    composition: {
      graphIdentitySha256: digest("graph-identity"),
      memberTableSha256: digest("member-table"),
      resolvedMemberBytes
    },
    qualification: {
      receiptId: `sha256:${digest("qualification")}`,
      sourceEvidenceSha256: digest("source"),
      structuralEvidenceSha256: digest("structure"),
      numericalEvidenceSha256: digest("numerical"),
      qualityEvidenceSha256: digest("quality"),
      evalCasesSha256: digest("eval-cases"),
      qualityClaim: "general-assistant-qualified",
      qualityScope: "general-assistant"
    },
    runtime: {
      workerProtocol: admission.workerProtocol,
      wasmByteCount: 676_916,
      wasmSha256: digest("runtime-wasm"),
      policy: {
        maximumModelBytes: 1_048_576,
        maximumSequenceTokens: 4096,
        maximumKvBytes: 256 * 1024 * 1024,
        maximumScratchBytes: 128 * 1024 * 1024,
        maximumResolvedMemberBytes: resolvedMemberBytes,
        maximumResidentDependencyBytes: resolvedMemberBytes - artifacts[0].byteCount,
        maximumRequestBytes: 1_054_848,
        maximumLinearMemoryBytes: 1536 * 1024 * 1024
      },
      defaultSampling: {
        temperatureMillionths: 600_000,
        topK: 20,
        topPMillionths: 950_000,
        repetitionPenaltyMillionths: 1_000_000,
        repetitionWindow: 64,
        maximumNewTokens: 512
      }
    }
  };
}

test("round-trips one canonical pathless six-member browser admission", () => {
  const value = validAdmission();
  const serialized = admission.serializeAdmission(value);
  const parsed = admission.parseAdmissionText(serialized);

  assert.equal(parsed.schema, "tinyrustlm.browser-composition-admission/1");
  assert.deepEqual(parsed.artifacts.map((value) => value.role), [
    "model", "tokenizer", "template", "sampling", "prompt", "composition"
  ]);
  assert.deepEqual(parsed.artifacts.map((value) => value.fileName), [
    "model.slm2",
    "tokenizer.tokenizer2",
    "template.template2",
    "sampling.sampling2",
    "prompt.prompt2",
    "composition.acg2"
  ]);
  assert.equal(parsed.composition.graphIdentitySha256, digest("graph-identity"));
  assert.equal(parsed.runtime.workerProtocol, "tinyrustlm.model-runtime-worker/1");
  assert.ok(Buffer.byteLength(serialized, "utf8") <= admission.maximumTextBytes);
  assert.equal(serialized.endsWith("\n"), true);
});

test("rejects the former one-model and ACG1 admission shape instead of translating it", () => {
  const old = {
    schema: "tinyrustlm.browser_model_admission.v1",
    modelId: "Qwen/Qwen3-0.6B",
    artifact: {
      fileName: "qwen3.slm",
      byteCount: 1_048_576,
      sha256: digest("model")
    },
    qualification: {},
    runtime: {},
    composition: {
      url: "https://tinyrustlm.com/models/qwen3.slm.acg1"
    }
  };
  assert.throws(
    () => admission.normalizeAdmission(old),
    /missing operationId|unknown field artifact/u
  );
  assert.doesNotMatch(admission.serializeAdmission(validAdmission()), /\.slm\.acg1|"url"/u);
});

test("rejects noncanonical bytes and duplicate-key ambiguity", () => {
  const serialized = admission.serializeAdmission(validAdmission());
  assert.throws(
    () => admission.parseAdmissionText(JSON.stringify(JSON.parse(serialized), null, 2)),
    /bytes are not canonical/u
  );
  const duplicateSchema = serialized.replace(
    `"schema":"${admission.schema}"`,
    `"schema":"obsolete","schema":"${admission.schema}"`
  );
  assert.throws(
    () => admission.parseAdmissionText(duplicateSchema),
    /bytes are not canonical/u
  );
});

test("rejects unknown fields, artifact reordering, aliases, and profile drift", () => {
  const value = validAdmission();
  assert.throws(() => admission.normalizeAdmission({
    ...value,
    legacyAlias: "forbidden"
  }), /unknown field legacyAlias/u);

  const reordered = structuredClone(value);
  [reordered.artifacts[0], reordered.artifacts[1]] =
    [reordered.artifacts[1], reordered.artifacts[0]];
  assert.throws(() => admission.normalizeAdmission(reordered), /artifacts\[0\]\.role/u);

  const alias = structuredClone(value);
  alias.artifacts[0].fileName = "qwen3.slm2";
  assert.throws(() => admission.normalizeAdmission(alias), /artifacts\[0\]\.fileName/u);

  const drift = structuredClone(value);
  drift.artifacts[4].formatProfileSha256 = digest("alternate-prompt-profile");
  assert.throws(
    () => admission.normalizeAdmission(drift),
    /artifacts\[4\]\.formatProfileSha256/u
  );
});

test("rejects composition closure and runtime resource under-declaration", () => {
  const resolved = structuredClone(validAdmission());
  resolved.composition.resolvedMemberBytes -= 1;
  assert.throws(
    () => admission.normalizeAdmission(resolved),
    /resolvedMemberBytes does not equal/u
  );

  const modelLimit = structuredClone(validAdmission());
  modelLimit.runtime.policy.maximumModelBytes -= 1;
  assert.throws(
    () => admission.normalizeAdmission(modelLimit),
    /maximumModelBytes is incompatible/u
  );

  const dependencyLimit = structuredClone(validAdmission());
  dependencyLimit.runtime.policy.maximumResidentDependencyBytes -= 1;
  assert.throws(
    () => admission.normalizeAdmission(dependencyLimit),
    /maximumResidentDependencyBytes is incompatible/u
  );

  const requestLimit = structuredClone(validAdmission());
  requestLimit.runtime.policy.maximumRequestBytes = 1_048_576;
  assert.throws(
    () => admission.normalizeAdmission(requestLimit),
    /maximumRequestBytes is incompatible/u
  );
});

test("rejects Sampling2 ambiguity and quality-claim scope drift", () => {
  const greedy = structuredClone(validAdmission());
  greedy.runtime.defaultSampling.temperatureMillionths = 0;
  assert.throws(
    () => admission.normalizeAdmission(greedy),
    /greedy configuration is invalid/u
  );

  const maximum = structuredClone(validAdmission());
  maximum.runtime.defaultSampling.maximumNewTokens =
    maximum.runtime.policy.maximumSequenceTokens + 1;
  assert.throws(
    () => admission.normalizeAdmission(maximum),
    /maximumNewTokens is invalid/u
  );

  const claim = structuredClone(validAdmission());
  claim.qualification.qualityScope = "summarization";
  assert.throws(
    () => admission.normalizeAdmission(claim),
    /qualityScope does not match/u
  );
});

test("accepts a narrowly labeled task-specific qualified composition", () => {
  const value = validAdmission();
  value.qualification.qualityClaim = "task-specific-qualified";
  value.qualification.qualityScope = "code-explanation/rust";
  const normalized = admission.normalizeAdmission(value);
  assert.equal(normalized.qualification.qualityClaim, "task-specific-qualified");
  assert.equal(normalized.qualification.qualityScope, "code-explanation/rust");
});
