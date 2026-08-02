(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.TinyRustLMBrowserModelAdmission = api;
  }
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  const schema = "tinyrustlm.browser_model_admission.v1";
  const maximumTextBytes = 64 * 1024;
  const topFields = Object.freeze([
    "schema",
    "modelId",
    "artifact",
    "qualification",
    "runtime",
    "composition"
  ]);
  const artifactFields = Object.freeze(["fileName", "byteCount", "sha256"]);
  const qualificationFields = Object.freeze([
    "receiptId",
    "manifestSha256",
    "sourceEvidenceSha256",
    "qualityEvidenceSha256",
    "evalCasesSha256",
    "slmPackSha256",
    "evalBinarySha256",
    "chatTemplateKind",
    "chatTemplateSha256",
    "evaluator",
    "evaluationSamplingProfile",
    "qualityClaim"
  ]);
  const runtimeFields = Object.freeze([
    "promptFormat",
    "systemPrompt",
    "systemPromptSha256",
    "contextLength",
    "modelSamplingProfile",
    "temperature",
    "topK",
    "topP",
    "repetitionPenalty"
  ]);
  const compositionFields = Object.freeze([
    "url",
    "byteCount",
    "sha256",
    "baseModelId",
    "compositionId",
    "activeGraphSha256",
    "routePolicyId",
    "kvFormatId",
    "positionPolicySha256",
    "memberCount"
  ]);
  const promptFormats = new Set([
    "alpaca-instruct-v1",
    "chatml-v1",
    "qwen3-chatml-no-think-v1",
    "llama2-chat-v1"
  ]);
  const samplingProfiles = new Map([
    ["runtime-greedy-v1", Object.freeze({
      temperature: 0,
      topK: 1,
      topP: 1,
      repetitionPenalty: 1
    })],
    ["qwen2.5-generation-config-v1", Object.freeze({
      temperature: 0.7,
      topK: 20,
      topP: 0.8,
      repetitionPenalty: 1.1
    })],
    ["qwen3-generation-config-v1", Object.freeze({
      temperature: 0.6,
      topK: 20,
      topP: 0.95,
      repetitionPenalty: 1
    })],
    ["smollm2-reviewed-runtime-v1", Object.freeze({
      temperature: 0.7,
      topK: 40,
      topP: 0.9,
      repetitionPenalty: 4.25
    })]
  ]);

  function invariant(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function exactObject(value, label, fields) {
    invariant(isPlainObject(value), `${label} must be a plain object`);
    const actual = Object.keys(value);
    const allowed = new Set(fields);
    const unknown = actual.filter((field) => !allowed.has(field));
    const missing = fields.filter((field) => !Object.hasOwn(value, field));
    invariant(unknown.length === 0, `${label} contains unknown field ${unknown[0]}`);
    invariant(missing.length === 0, `${label} is missing ${missing[0]}`);
  }

  function text(value, label, minimum, maximum) {
    invariant(typeof value === "string" && value.length >= minimum &&
      value.length <= maximum && !value.includes("\0"),
    `${label} is invalid`);
    return value;
  }

  function sha256(value, label) {
    const normalized = text(value, label, 64, 64).toLowerCase();
    invariant(/^[a-f0-9]{64}$/.test(normalized), `${label} is invalid`);
    return normalized;
  }

  function typedId(value, label, prefix) {
    const normalized = text(value, label, prefix.length + 64, prefix.length + 64);
    invariant(normalized.startsWith(prefix) &&
      /^[a-f0-9]{64}$/.test(normalized.slice(prefix.length)) &&
      !/^0{64}$/.test(normalized.slice(prefix.length)),
    `${label} is invalid`);
    return normalized;
  }

  function integer(value, label, minimum, maximum) {
    const normalized = Number(value);
    invariant(Number.isSafeInteger(normalized) && normalized >= minimum &&
      normalized <= maximum, `${label} is invalid`);
    return normalized;
  }

  function decimal(value, label, minimum, maximum) {
    const normalized = Number(value);
    invariant(Number.isFinite(normalized) && normalized >= minimum &&
      normalized <= maximum, `${label} is invalid`);
    return normalized;
  }

  function normalizeUrl(value, applicationOrigin) {
    const parsed = new URL(text(value, "composition.url", 8, 2048));
    invariant((parsed.protocol === "https:" ||
      (parsed.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname))) &&
      parsed.username === "" && parsed.password === "" &&
      parsed.search === "" && parsed.hash === "",
    "composition.url is invalid");
    if (applicationOrigin) {
      invariant(parsed.origin === applicationOrigin,
        "composition.url is outside the application origin");
    }
    invariant(parsed.pathname.endsWith(".slm.acg1"),
      "composition.url does not name a composition graph");
    return parsed.href;
  }

  function normalizeAdmission(value, options) {
    exactObject(value, "browser model admission", topFields);
    invariant(value.schema === schema, `browser model admission schema must be ${schema}`);
    const settings = options || {};
    const modelId = text(value.modelId, "modelId", 3, 160);
    invariant(/^[A-Za-z0-9._/-]+$/.test(modelId), "modelId is invalid");

    exactObject(value.artifact, "artifact", artifactFields);
    const fileName = text(value.artifact.fileName, "artifact.fileName", 5, 255);
    invariant(/^[A-Za-z0-9._-]+\.slm$/.test(fileName),
      "artifact.fileName is invalid");
    const artifact = Object.freeze({
      fileName,
      byteCount: integer(
        value.artifact.byteCount,
        "artifact.byteCount",
        1024 * 1024,
        8 * 1024 * 1024 * 1024
      ),
      sha256: sha256(value.artifact.sha256, "artifact.sha256")
    });

    exactObject(value.qualification, "qualification", qualificationFields);
    const qualification = Object.freeze({
      receiptId: typedId(value.qualification.receiptId, "qualification.receiptId", "sha256:"),
      manifestSha256: sha256(
        value.qualification.manifestSha256,
        "qualification.manifestSha256"
      ),
      sourceEvidenceSha256: sha256(
        value.qualification.sourceEvidenceSha256,
        "qualification.sourceEvidenceSha256"
      ),
      qualityEvidenceSha256: sha256(
        value.qualification.qualityEvidenceSha256,
        "qualification.qualityEvidenceSha256"
      ),
      evalCasesSha256: sha256(
        value.qualification.evalCasesSha256,
        "qualification.evalCasesSha256"
      ),
      slmPackSha256: sha256(
        value.qualification.slmPackSha256,
        "qualification.slmPackSha256"
      ),
      evalBinarySha256: sha256(
        value.qualification.evalBinarySha256,
        "qualification.evalBinarySha256"
      ),
      chatTemplateKind: text(
        value.qualification.chatTemplateKind,
        "qualification.chatTemplateKind",
        3,
        96
      ),
      chatTemplateSha256: sha256(
        value.qualification.chatTemplateSha256,
        "qualification.chatTemplateSha256"
      ),
      evaluator: text(value.qualification.evaluator, "qualification.evaluator", 3, 96),
      evaluationSamplingProfile: text(
        value.qualification.evaluationSamplingProfile,
        "qualification.evaluationSamplingProfile",
        3,
        96
      ),
      qualityClaim: text(
        value.qualification.qualityClaim,
        "qualification.qualityClaim",
        3,
        64
      )
    });
    invariant(
      qualification.chatTemplateKind === "revision-chatml-template-v1" &&
        qualification.evaluator === "tinyrustlm-native-eval-runner" &&
        qualification.evaluationSamplingProfile === "task-adaptive-v1" &&
        qualification.qualityClaim === "conversation-proven",
      "qualification policy is unsupported"
    );

    exactObject(value.runtime, "runtime", runtimeFields);
    const promptFormat = text(value.runtime.promptFormat, "runtime.promptFormat", 3, 96);
    invariant(promptFormats.has(promptFormat), "runtime.promptFormat is unsupported");
    const systemPrompt = text(value.runtime.systemPrompt, "runtime.systemPrompt", 1, 16 * 1024);
    invariant(!systemPrompt.includes("\r") && !systemPrompt.includes("\n"),
      "runtime.systemPrompt must be one line");
    const modelSamplingProfile = text(
      value.runtime.modelSamplingProfile,
      "runtime.modelSamplingProfile",
      3,
      96
    );
    const expectedSampling = samplingProfiles.get(modelSamplingProfile);
    invariant(expectedSampling, "runtime.modelSamplingProfile is unsupported");
    const runtime = Object.freeze({
      promptFormat,
      systemPrompt,
      systemPromptSha256: sha256(
        value.runtime.systemPromptSha256,
        "runtime.systemPromptSha256"
      ),
      contextLength: integer(
        value.runtime.contextLength,
        "runtime.contextLength",
        128,
        1_048_576
      ),
      modelSamplingProfile,
      temperature: decimal(value.runtime.temperature, "runtime.temperature", 0, 5),
      topK: integer(value.runtime.topK, "runtime.topK", 1, 100),
      topP: decimal(value.runtime.topP, "runtime.topP", 0.01, 1),
      repetitionPenalty: decimal(
        value.runtime.repetitionPenalty,
        "runtime.repetitionPenalty",
        1,
        128
      )
    });
    invariant(
      runtime.temperature === expectedSampling.temperature &&
        runtime.topK === expectedSampling.topK &&
        runtime.topP === expectedSampling.topP &&
        runtime.repetitionPenalty === expectedSampling.repetitionPenalty,
      "runtime sampling values do not match the declared profile"
    );

    exactObject(value.composition, "composition", compositionFields);
    const composition = Object.freeze({
      url: normalizeUrl(value.composition.url, settings.applicationOrigin),
      byteCount: integer(
        value.composition.byteCount,
        "composition.byteCount",
        512,
        16 * 1024 * 1024
      ),
      sha256: sha256(value.composition.sha256, "composition.sha256"),
      baseModelId: typedId(
        value.composition.baseModelId,
        "composition.baseModelId",
        "model-sha256-"
      ),
      compositionId: typedId(
        value.composition.compositionId,
        "composition.compositionId",
        "composition-sha256-"
      ),
      activeGraphSha256: sha256(
        value.composition.activeGraphSha256,
        "composition.activeGraphSha256"
      ),
      routePolicyId: typedId(
        value.composition.routePolicyId,
        "composition.routePolicyId",
        "route-sha256-"
      ),
      kvFormatId: typedId(
        value.composition.kvFormatId,
        "composition.kvFormatId",
        "kv-format-sha256-"
      ),
      positionPolicySha256: sha256(
        value.composition.positionPolicySha256,
        "composition.positionPolicySha256"
      ),
      memberCount: integer(value.composition.memberCount, "composition.memberCount", 0, 64)
    });
    invariant(composition.byteCount % 64 === 0,
      "composition.byteCount must be 64-byte aligned");

    return Object.freeze({
      schema,
      modelId,
      artifact,
      qualification,
      runtime,
      composition
    });
  }

  function admissionForModel(model, artifactFileName) {
    invariant(isPlainObject(model), "campaign model is invalid");
    return normalizeAdmission({
      schema,
      modelId: model.modelId,
      artifact: {
        fileName: artifactFileName,
        byteCount: model.artifactByteCount,
        sha256: model.artifactSha256
      },
      qualification: {
        receiptId: model.qualificationReceiptId,
        manifestSha256: model.manifestSha256,
        sourceEvidenceSha256: model.sourceEvidenceSha256,
        qualityEvidenceSha256: model.qualityEvidenceSha256,
        evalCasesSha256: model.evalCasesSha256,
        slmPackSha256: model.slmPackSha256,
        evalBinarySha256: model.evalBinarySha256,
        chatTemplateKind: model.chatTemplateKind,
        chatTemplateSha256: model.chatTemplateSha256,
        evaluator: model.evaluator,
        evaluationSamplingProfile: model.evaluationSamplingProfile,
        qualityClaim: model.qualityClaim
      },
      runtime: {
        promptFormat: model.promptFormat,
        systemPrompt: model.systemPrompt,
        systemPromptSha256: model.systemPromptSha256,
        contextLength: model.contextLength,
        modelSamplingProfile: model.modelSamplingProfile,
        temperature: model.samplingTemperature,
        topK: model.samplingTopK,
        topP: model.samplingTopP,
        repetitionPenalty: model.samplingRepetitionPenalty
      },
      composition: {
        url: model.compositionGraphUrl,
        byteCount: model.compositionGraphByteCount,
        sha256: model.compositionGraphSha256,
        baseModelId: model.compositionBaseModelId,
        compositionId: model.compositionId,
        activeGraphSha256: model.compositionActiveGraphSha256,
        routePolicyId: model.compositionRoutePolicyId,
        kvFormatId: model.compositionKvFormatId,
        positionPolicySha256: model.compositionPositionPolicySha256,
        memberCount: model.compositionMemberCount
      }
    });
  }

  function serializeAdmission(value, options) {
    const normalized = normalizeAdmission(value, options);
    const serialized = `${JSON.stringify(normalized)}\n`;
    invariant(new TextEncoder().encode(serialized).length <= maximumTextBytes,
      "browser model admission exceeds its byte limit");
    return serialized;
  }

  function parseAdmissionText(value, options) {
    invariant(typeof value === "string" && value.length > 0,
      "browser model admission text is invalid");
    invariant(new TextEncoder().encode(value).length <= maximumTextBytes,
      "browser model admission exceeds its byte limit");
    let parsed;
    try {
      parsed = JSON.parse(value);
    } catch (_error) {
      throw new Error("browser model admission is not valid JSON");
    }
    const normalized = normalizeAdmission(parsed, options);
    invariant(value === serializeAdmission(normalized, options),
      "browser model admission bytes are not canonical");
    return normalized;
  }

  return Object.freeze({
    admissionForModel,
    maximumTextBytes,
    normalizeAdmission,
    parseAdmissionText,
    schema,
    serializeAdmission
  });
});
