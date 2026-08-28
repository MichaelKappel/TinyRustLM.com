(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.TinyRustLMBrowserModelAdmission = api;
  }
}(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  const SCHEMA = "tinyrustlm.browser-composition-admission/1";
  const WORKER_PROTOCOL = "tinyrustlm.model-runtime-worker/1";
  const MAXIMUM_TEXT_BYTES = 64 * 1024;
  const MAXIMUM_WASM_BYTES = 16 * 1024 * 1024;
  const TOP_FIELDS = Object.freeze([
    "schema",
    "modelId",
    "operationId",
    "artifacts",
    "composition",
    "qualification",
    "runtime"
  ]);
  const ARTIFACT_FIELDS = Object.freeze([
    "role",
    "format",
    "fileName",
    "byteCount",
    "sha256",
    "formatProfileSha256"
  ]);
  const COMPOSITION_FIELDS = Object.freeze([
    "graphIdentitySha256",
    "memberTableSha256",
    "resolvedMemberBytes"
  ]);
  const QUALIFICATION_FIELDS = Object.freeze([
    "receiptId",
    "sourceEvidenceSha256",
    "structuralEvidenceSha256",
    "numericalEvidenceSha256",
    "qualityEvidenceSha256",
    "evalCasesSha256",
    "qualityClaim",
    "qualityScope"
  ]);
  const RUNTIME_FIELDS = Object.freeze([
    "workerProtocol",
    "wasmByteCount",
    "wasmSha256",
    "policy",
    "defaultSampling"
  ]);
  const POLICY_FIELDS = Object.freeze([
    "maximumModelBytes",
    "maximumSequenceTokens",
    "maximumKvBytes",
    "maximumScratchBytes",
    "maximumResolvedMemberBytes",
    "maximumResidentDependencyBytes",
    "maximumRequestBytes",
    "maximumLinearMemoryBytes"
  ]);
  const SAMPLING_FIELDS = Object.freeze([
    "temperatureMillionths",
    "topK",
    "topPMillionths",
    "repetitionPenaltyMillionths",
    "repetitionWindow",
    "maximumNewTokens"
  ]);
  const QUALITY_CLAIMS = new Set([
    "general-assistant-qualified",
    "task-specific-qualified"
  ]);
  const ARTIFACT_SPECS = Object.freeze([
    Object.freeze({
      role: "model",
      format: "slm2",
      fileName: "model.slm2",
      profileSha256: "5ac819cb31a17a64bec0d5492962a4baf0bd2778f6213b87c85c0a04f3a738d8",
      minimum: 1,
      maximum: 0x80000000
    }),
    Object.freeze({
      role: "tokenizer",
      format: "tokenizer2",
      fileName: "tokenizer.tokenizer2",
      profileSha256: "628427bf6e7f8d34ed14b331a5c636606aee9d5ef45a36a3cadc13338669b8de",
      minimum: 1,
      maximum: 64 * 1024 * 1024
    }),
    Object.freeze({
      role: "template",
      format: "template2",
      fileName: "template.template2",
      profileSha256: "14ff1df8dd6760119ac36e719ab396fff8e71d0719c2e1c83118f58693ea7bfa",
      minimum: 1,
      maximum: 1024 * 1024
    }),
    Object.freeze({
      role: "sampling",
      format: "sampling2",
      fileName: "sampling.sampling2",
      profileSha256: "ec65e8f1a54c1e4ca95ebda88bde091dad11337250e541bbda60e8cac311428d",
      exact: 65800
    }),
    Object.freeze({
      role: "prompt",
      format: "prompt2",
      fileName: "prompt.prompt2",
      profileSha256: "f9eb4cbecfb52f5e2857216c999754da94021a5427a86732d33fe15efc0d062c",
      exact: 512
    }),
    Object.freeze({
      role: "composition",
      format: "acg2",
      fileName: "composition.acg2",
      profileSha256: "944ed9b5b0ee2605ebb9ac13f2e5388c181bc857fdbfc082e62e9ae7b07c79be",
      exact: 896
    })
  ]);

  function invariant(condition, message) {
    if (!condition) {
      throw new TypeError(message);
    }
  }

  function isPlainObject(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function exactObject(value, fields, label) {
    invariant(isPlainObject(value), `${label} must be a plain object`);
    invariant(Object.getOwnPropertySymbols(value).length === 0,
      `${label} contains symbol fields`);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Object.keys(descriptors);
    const missing = fields.find((field) => !Object.hasOwn(descriptors, field));
    const unknown = keys.find((field) => !fields.includes(field));
    invariant(!missing, `${label} is missing ${missing}`);
    invariant(!unknown, `${label} contains unknown field ${unknown}`);
    invariant(keys.length === fields.length, `${label} field set is invalid`);
    for (const field of fields) {
      const descriptor = descriptors[field];
      invariant(Object.hasOwn(descriptor, "value") && !descriptor.get && !descriptor.set,
        `${label}.${field} must be a data property`);
    }
    return value;
  }

  function text(value, label, minimum, maximum, pattern) {
    invariant(typeof value === "string" && value.length >= minimum &&
      value.length <= maximum && !/[\u0000-\u001f\u007f]/u.test(value),
    `${label} is invalid`);
    if (pattern) {
      invariant(pattern.test(value), `${label} is invalid`);
    }
    return value;
  }

  function sha256(value, label, allowZero) {
    const normalized = text(value, label, 64, 64, /^[0-9a-f]{64}$/u);
    invariant(allowZero || !/^0{64}$/u.test(normalized), `${label} is invalid`);
    return normalized;
  }

  function receiptId(value, label) {
    const normalized = text(value, label, 71, 71, /^sha256:[0-9a-f]{64}$/u);
    invariant(!/^sha256:0{64}$/u.test(normalized), `${label} is invalid`);
    return normalized;
  }

  function integer(value, label, minimum, maximum) {
    invariant(Number.isSafeInteger(value) && value >= minimum && value <= maximum,
      `${label} is invalid`);
    return value;
  }

  function normalizeArtifact(value, index) {
    const label = `artifacts[${index}]`;
    const spec = ARTIFACT_SPECS[index];
    exactObject(value, ARTIFACT_FIELDS, label);
    invariant(value.role === spec.role, `${label}.role is invalid`);
    invariant(value.format === spec.format, `${label}.format is invalid`);
    invariant(value.fileName === spec.fileName, `${label}.fileName is invalid`);
    invariant(value.formatProfileSha256 === spec.profileSha256,
      `${label}.formatProfileSha256 is invalid`);
    return Object.freeze({
      role: spec.role,
      format: spec.format,
      fileName: spec.fileName,
      byteCount: integer(
        value.byteCount,
        `${label}.byteCount`,
        spec.exact || spec.minimum,
        spec.exact || spec.maximum
      ),
      sha256: sha256(value.sha256, `${label}.sha256`, false),
      formatProfileSha256: spec.profileSha256
    });
  }

  function normalizeArtifacts(value) {
    invariant(Array.isArray(value) && value.length === ARTIFACT_SPECS.length,
      "artifacts must contain the exact six-member composition");
    return Object.freeze(value.map(normalizeArtifact));
  }

  function normalizeComposition(value, artifacts) {
    exactObject(value, COMPOSITION_FIELDS, "composition");
    const resolvedMemberBytes = artifacts.slice(0, 5)
      .reduce((total, artifact) => total + artifact.byteCount, 0);
    invariant(Number.isSafeInteger(resolvedMemberBytes) &&
      value.resolvedMemberBytes === resolvedMemberBytes,
    "composition.resolvedMemberBytes does not equal the exact member set");
    return Object.freeze({
      graphIdentitySha256: sha256(
        value.graphIdentitySha256,
        "composition.graphIdentitySha256",
        false
      ),
      memberTableSha256: sha256(
        value.memberTableSha256,
        "composition.memberTableSha256",
        false
      ),
      resolvedMemberBytes
    });
  }

  function normalizeQualification(value) {
    exactObject(value, QUALIFICATION_FIELDS, "qualification");
    const qualityClaim = text(value.qualityClaim, "qualification.qualityClaim", 3, 64);
    invariant(QUALITY_CLAIMS.has(qualityClaim), "qualification.qualityClaim is unsupported");
    const qualityScope = text(
      value.qualityScope,
      "qualification.qualityScope",
      3,
      160,
      /^[a-z0-9][a-z0-9._/-]*$/u
    );
    invariant(
      qualityClaim !== "general-assistant-qualified" || qualityScope === "general-assistant",
      "qualification.qualityScope does not match its claim"
    );
    return Object.freeze({
      receiptId: receiptId(value.receiptId, "qualification.receiptId"),
      sourceEvidenceSha256: sha256(
        value.sourceEvidenceSha256,
        "qualification.sourceEvidenceSha256",
        false
      ),
      structuralEvidenceSha256: sha256(
        value.structuralEvidenceSha256,
        "qualification.structuralEvidenceSha256",
        false
      ),
      numericalEvidenceSha256: sha256(
        value.numericalEvidenceSha256,
        "qualification.numericalEvidenceSha256",
        false
      ),
      qualityEvidenceSha256: sha256(
        value.qualityEvidenceSha256,
        "qualification.qualityEvidenceSha256",
        false
      ),
      evalCasesSha256: sha256(
        value.evalCasesSha256,
        "qualification.evalCasesSha256",
        false
      ),
      qualityClaim,
      qualityScope
    });
  }

  function normalizePolicy(value, artifacts, composition) {
    exactObject(value, POLICY_FIELDS, "runtime.policy");
    const policy = {};
    for (const field of POLICY_FIELDS) {
      policy[field] = integer(value[field], `runtime.policy.${field}`, 1, 0xffffffff);
    }
    invariant(policy.maximumModelBytes >= artifacts[0].byteCount &&
      policy.maximumModelBytes <= 0x80000000,
    "runtime.policy.maximumModelBytes is incompatible with the model");
    invariant(policy.maximumSequenceTokens <= 40960,
      "runtime.policy.maximumSequenceTokens exceeds the runtime ceiling");
    invariant(policy.maximumKvBytes <= 0x80000000,
      "runtime.policy.maximumKvBytes exceeds the runtime ceiling");
    invariant(policy.maximumScratchBytes <= 0x40000000,
      "runtime.policy.maximumScratchBytes exceeds the runtime ceiling");
    invariant(policy.maximumResolvedMemberBytes >= composition.resolvedMemberBytes &&
      policy.maximumResolvedMemberBytes <= 0x88000000,
    "runtime.policy.maximumResolvedMemberBytes is incompatible with the composition");
    const dependencies = artifacts.slice(1, 5)
      .reduce((total, artifact) => total + artifact.byteCount, 0);
    invariant(policy.maximumResidentDependencyBytes >= dependencies &&
      policy.maximumResidentDependencyBytes <= 0x08000000,
    "runtime.policy.maximumResidentDependencyBytes is incompatible with the composition");
    invariant(policy.maximumRequestBytes >= 1054848 &&
      policy.maximumRequestBytes <= 0x01000000,
    "runtime.policy.maximumRequestBytes is incompatible with Prompt2");
    invariant(policy.maximumLinearMemoryBytes <= 0xc0000000 &&
      policy.maximumLinearMemoryBytes % 65536 === 0,
    "runtime.policy.maximumLinearMemoryBytes is invalid");
    return Object.freeze(policy);
  }

  function normalizeSampling(value, policy) {
    exactObject(value, SAMPLING_FIELDS, "runtime.defaultSampling");
    const sampling = Object.freeze({
      temperatureMillionths: integer(
        value.temperatureMillionths,
        "runtime.defaultSampling.temperatureMillionths",
        0,
        4000000
      ),
      topK: integer(value.topK, "runtime.defaultSampling.topK", 1, 1024),
      topPMillionths: integer(
        value.topPMillionths,
        "runtime.defaultSampling.topPMillionths",
        1,
        1000000
      ),
      repetitionPenaltyMillionths: integer(
        value.repetitionPenaltyMillionths,
        "runtime.defaultSampling.repetitionPenaltyMillionths",
        1000000,
        2000000
      ),
      repetitionWindow: integer(
        value.repetitionWindow,
        "runtime.defaultSampling.repetitionWindow",
        0,
        64
      ),
      maximumNewTokens: integer(
        value.maximumNewTokens,
        "runtime.defaultSampling.maximumNewTokens",
        1,
        Math.min(4096, policy.maximumSequenceTokens)
      )
    });
    invariant(sampling.temperatureMillionths !== 0 ||
      (sampling.topK === 1 && sampling.topPMillionths === 1000000),
    "runtime.defaultSampling greedy configuration is invalid");
    return sampling;
  }

  function normalizeRuntime(value, artifacts, composition) {
    exactObject(value, RUNTIME_FIELDS, "runtime");
    invariant(value.workerProtocol === WORKER_PROTOCOL, "runtime.workerProtocol is unsupported");
    const policy = normalizePolicy(value.policy, artifacts, composition);
    return Object.freeze({
      workerProtocol: WORKER_PROTOCOL,
      wasmByteCount: integer(value.wasmByteCount, "runtime.wasmByteCount", 8, MAXIMUM_WASM_BYTES),
      wasmSha256: sha256(value.wasmSha256, "runtime.wasmSha256", false),
      policy,
      defaultSampling: normalizeSampling(value.defaultSampling, policy)
    });
  }

  function normalizeAdmission(value) {
    exactObject(value, TOP_FIELDS, "browser composition admission");
    invariant(value.schema === SCHEMA,
      `browser composition admission schema must be ${SCHEMA}`);
    const modelId = text(
      value.modelId,
      "modelId",
      3,
      180,
      /^[A-Za-z0-9][A-Za-z0-9._/-]*$/u
    );
    const operationId = sha256(value.operationId, "operationId", false);
    const artifacts = normalizeArtifacts(value.artifacts);
    const composition = normalizeComposition(value.composition, artifacts);
    return Object.freeze({
      schema: SCHEMA,
      modelId,
      operationId,
      artifacts,
      composition,
      qualification: normalizeQualification(value.qualification),
      runtime: normalizeRuntime(value.runtime, artifacts, composition)
    });
  }

  function serializeAdmission(value) {
    const serialized = `${JSON.stringify(normalizeAdmission(value))}\n`;
    invariant(new TextEncoder().encode(serialized).byteLength <= MAXIMUM_TEXT_BYTES,
      "browser composition admission exceeds its byte limit");
    return serialized;
  }

  function parseAdmissionText(value) {
    invariant(typeof value === "string" && value.length > 0,
      "browser composition admission text is invalid");
    invariant(new TextEncoder().encode(value).byteLength <= MAXIMUM_TEXT_BYTES,
      "browser composition admission exceeds its byte limit");
    let parsed;
    try {
      parsed = JSON.parse(value);
    } catch (_) {
      throw new TypeError("browser composition admission is not valid JSON");
    }
    const normalized = normalizeAdmission(parsed);
    invariant(value === serializeAdmission(normalized),
      "browser composition admission bytes are not canonical");
    return normalized;
  }

  return Object.freeze({
    schema: SCHEMA,
    workerProtocol: WORKER_PROTOCOL,
    maximumTextBytes: MAXIMUM_TEXT_BYTES,
    maximumWasmBytes: MAXIMUM_WASM_BYTES,
    artifactSpecs: ARTIFACT_SPECS,
    policyFields: POLICY_FIELDS,
    samplingFields: SAMPLING_FIELDS,
    normalizeAdmission,
    parseAdmissionText,
    serializeAdmission
  });
}));
