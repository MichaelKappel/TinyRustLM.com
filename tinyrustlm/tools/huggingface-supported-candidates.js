"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { sourceCandidateRejection } = require("./source-candidate-exclusions.js");
const { createMetadataReader, MetadataReadError } = require("./huggingface-metadata.js");

const inventorySchema = "tinyrustlm.huggingface_supported_candidate_inventory.v2";
const defaultBaseUrl = "https://huggingface.co";
const defaultLicenseUrl = "https://www.apache.org/licenses/LICENSE-2.0.txt";
const maximumSearchLimit = 500;
const maximumCandidateLimit = 100;
const profiles = Object.freeze({
  "qwen3-0.6b-bpe": Object.freeze({
    defaultSearch: "Qwen3-0.6B",
    modelType: "qwen3",
    architecture: "Qwen3ForCausalLM",
    minimumWeightBytes: 1_000_000_000,
    maximumWeightBytes: 1_700_000_000,
    config: Object.freeze({
      hidden_size: 1024,
      num_hidden_layers: 28,
      num_attention_heads: 16,
      num_key_value_heads: 8,
      head_dim: 128,
      intermediate_size: 3072,
      vocab_size: 151936,
      tie_word_embeddings: true
    })
  }),
  "smollm2-360m-instruct-bpe": Object.freeze({
    defaultSearch: "SmolLM2-360M-Instruct",
    modelType: "llama",
    architecture: "LlamaForCausalLM",
    minimumWeightBytes: 650_000_000,
    maximumWeightBytes: 800_000_000,
    config: Object.freeze({
      hidden_size: 960,
      num_hidden_layers: 32,
      num_attention_heads: 15,
      num_key_value_heads: 5,
      intermediate_size: 2560,
      vocab_size: 49152,
      tie_word_embeddings: true
    })
  }),
  "qwen2.5-1.5b-bpe": Object.freeze({
    defaultSearch: "Qwen2.5-1.5B-Instruct",
    modelType: "qwen2",
    architecture: "Qwen2ForCausalLM",
    minimumWeightBytes: 2_500_000_000,
    maximumWeightBytes: 4_500_000_000,
    config: Object.freeze({
      hidden_size: 1536,
      num_hidden_layers: 28,
      num_attention_heads: 12,
      num_key_value_heads: 2,
      intermediate_size: 8960,
      vocab_size: 151936,
      tie_word_embeddings: true
    })
  })
});

// Raises a stable validation error when external metadata violates the contract.
function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

// Accepts an HTTPS origin or loopback HTTP used by deterministic tests.
function normalizeBaseUrl(value) {
  const url = new URL(String(value || defaultBaseUrl));
  const loopback = url.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
  invariant(url.protocol === "https:" || loopback, "Hugging Face base URL must use HTTPS");
  invariant(!url.username && !url.password && !url.search && !url.hash,
    "Hugging Face base URL must not contain credentials");
  return url.origin;
}

// Accepts a credential-free HTTPS or loopback Apache license authority URL.
function normalizeLicenseUrl(value) {
  const url = new URL(String(value || defaultLicenseUrl));
  const loopback = url.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
  invariant(url.protocol === "https:" || loopback, "license URL must use HTTPS");
  invariant(!url.username && !url.password && !url.hash, "license URL must not contain credentials");
  return url.toString();
}

// Returns one declared Rust source profile or fails before network access.
function requireProfile(profileId) {
  const id = String(profileId || "").trim();
  invariant(Object.hasOwn(profiles, id), `unsupported source profile: ${id || "missing"}`);
  return Object.freeze({ id, ...profiles[id] });
}

// Validates a route-safe Hugging Face owner/repository identifier.
function requireModelId(value) {
  const modelId = String(value || "").trim();
  invariant(/^[A-Za-z0-9._-]{1,96}\/[A-Za-z0-9._-]{1,160}$/.test(modelId), "model ID is invalid");
  return modelId;
}

// Validates an immutable hexadecimal repository revision.
function requireRevision(value) {
  const revision = String(value || "").trim().toLowerCase();
  invariant(/^[a-f0-9]{40,64}$/.test(revision), "immutable revision required");
  return revision;
}

// Builds the bounded primary Hugging Face search endpoint.
function buildSearchUrl(baseUrl, search, limit) {
  const boundedLimit = Number(limit);
  invariant(Number.isSafeInteger(boundedLimit) && boundedLimit >= 1 && boundedLimit <= maximumSearchLimit,
    "search limit is invalid");
  const url = new URL("/api/models", normalizeBaseUrl(baseUrl));
  url.searchParams.set("search", String(search || "").trim());
  url.searchParams.set("sort", "downloads");
  url.searchParams.set("direction", "-1");
  url.searchParams.set("limit", String(boundedLimit));
  url.searchParams.set("full", "true");
  url.searchParams.set("config", "true");
  return url.toString();
}

// Builds a revision-pinned metadata endpoint that includes LFS blob evidence.
function buildRevisionInfoUrl(baseUrl, modelId, revision) {
  const safeId = requireModelId(modelId).split("/").map(encodeURIComponent).join("/");
  return `${normalizeBaseUrl(baseUrl)}/api/models/${safeId}/revision/${requireRevision(revision)}?blobs=true`;
}

// Builds a revision-pinned route for one allowlisted evidence file.
function buildResolveUrl(baseUrl, modelId, revision, filename) {
  invariant(["config.json", "tokenizer_config.json"].includes(filename),
    "resolve filename is not allowlisted");
  const safeId = requireModelId(modelId).split("/").map(encodeURIComponent).join("/");
  return `${normalizeBaseUrl(baseUrl)}/${safeId}/resolve/${requireRevision(revision)}/${filename}`;
}

// Extracts the one explicit license tag from model search metadata.
function searchLicenseId(model) {
  const tags = Array.isArray(model && model.tags) ? model.tags : [];
  const licenses = tags.filter((tag) => typeof tag === "string" && tag.startsWith("license:"));
  return licenses.length === 1 ? licenses[0].slice("license:".length).toLowerCase() : "";
}

// Rejects package families the Rust full-weight converter does not consume.
function hasUnsupportedPackaging(modelId) {
  return /(?:^|[-_.])(gguf|awq|gptq|mlx|onnx|openvino|exl2|hqq|bnb|bitsandbytes|fp8|nvfp4|int\d+|\d+bit|quantized|w\d+a\d+)(?:$|[-_.])/i
    .test(modelId);
}

// Distinguishes text-generation conversation tuning from embeddings and base checkpoints.
function declaresConversationModel(model, profile) {
  const modelId = String(model && model.id || "");
  if (/(?:embedding|reranker|guard|reward|classifier|(?:^|[-_.])base(?:$|[-_.]))/i.test(modelId)) {
    return false;
  }
  const pipeline = String(model && model.pipeline_tag || "").toLowerCase();
  const tags = Array.isArray(model && model.tags) ? model.tags : [];
  if (pipeline !== "text-generation" && !tags.includes("text-generation")) {
    return false;
  }
  if (profile.id === "qwen3-0.6b-bpe" && /(?:^|\/)qwen3-0\.6b$/i.test(modelId)) {
    return true;
  }
  return /(instruct|chat|assistant|dialog|sft|dpo|distill|heretic|abliterated|reason|expert|tutor|merged|finetun)/i
    .test(modelId);
}

// Returns a typed preflight rejection without issuing model-specific requests.
function searchRejectionCode(model, profile) {
  const modelId = String(model && model.id || "");
  if (!/^[a-fA-F0-9]{40,64}$/.test(String(model && model.sha || ""))) {
    return "immutable_revision_required";
  }
  if (model.private === true || model.gated === true || model.disabled === true) {
    return "source_not_public";
  }
  if (hasUnsupportedPackaging(modelId)) {
    return "unsupported_packaging";
  }
  const tags = Array.isArray(model && model.tags) ? model.tags : [];
  if (!tags.includes("safetensors") || model.config?.model_type !== profile.modelType ||
      !Array.isArray(model.config?.architectures) ||
      !model.config.architectures.includes(profile.architecture)) {
    return "unsupported_architecture";
  }
  if (!declaresConversationModel(model, profile)) {
    return "not_conversation_model";
  }
  if (searchLicenseId(model) !== "apache-2.0") {
    return "license_evidence_not_supported";
  }
  return "";
}

// Verifies fetched configuration dimensions against the selected Rust profile.
function validateConfig(config, profile) {
  invariant(config && typeof config === "object" && !Array.isArray(config), "config.json is invalid");
  invariant(config.model_type === profile.modelType, "shape mismatch");
  invariant(Array.isArray(config.architectures) && config.architectures.includes(profile.architecture),
    "shape mismatch");
  for (const [field, expected] of Object.entries(profile.config)) {
    invariant(config[field] === expected, "shape mismatch");
  }
}

// Validates and fingerprints the exact revision-owned conversation template.
function validateTokenizerConfig(config) {
  invariant(config && typeof config === "object" && !Array.isArray(config),
    "tokenizer_config.json is invalid");
  const template = config.chat_template;
  invariant(typeof template === "string" && template.length >= 32 && template.length <= 256 * 1024,
    "chat template is missing or oversized");
  invariant(template.includes("<|im_start|>") && template.includes("<|im_end|>"),
    "chat template is not ChatML compatible");
  invariant(template.includes("message.role") || template.includes("message['role']") ||
    template.includes('message["role"]'), "chat template lacks a message role route");
  return Object.freeze({
    kind: "revision-chatml-template-v1",
    sha256: crypto.createHash("sha256").update(template).digest("hex")
  });
}

// Returns stable identity evidence for a non-weight repository file.
function siblingIdentity(row, label) {
  invariant(row && typeof row === "object", `${label} is missing`);
  const byteCount = Number(row.lfs?.size ?? row.size);
  invariant(Number.isSafeInteger(byteCount) && byteCount > 0, `${label} size is invalid`);
  const sha256 = String(row.lfs?.sha256 || "").toLowerCase();
  const gitBlobId = String(row.blobId || "").toLowerCase();
  invariant(/^[a-f0-9]{64}$/.test(sha256) || /^[a-f0-9]{40}$/.test(gitBlobId),
    `${label} content identity is missing`);
  return Object.freeze({
    filename: row.rfilename,
    byteCount,
    sha256: /^[a-f0-9]{64}$/.test(sha256) ? sha256 : null,
    gitBlobId: !/^[a-f0-9]{64}$/.test(sha256) && /^[a-f0-9]{40}$/.test(gitBlobId)
      ? gitBlobId
      : null
  });
}

// Extracts complete LFS-backed full weights and tokenizer identity evidence.
function validateSiblings(info, profile) {
  invariant(info && typeof info === "object" && Array.isArray(info.siblings),
    "revision metadata is invalid");
  const siblings = new Map(info.siblings.map((row) => [row.rfilename, row]));
  invariant(siblings.has("config.json"), "config.json is missing");
  invariant(siblings.has("tokenizer.json"), "tokenizer.json is missing");
  invariant(siblings.has("tokenizer_config.json"), "tokenizer_config.json is missing");
  const weights = info.siblings
    .filter((row) => /^model(?:-\d{5}-of-\d{5})?\.safetensors$/.test(String(row.rfilename || "")))
    .map((row) => {
      const byteCount = Number(row.lfs?.size ?? row.size);
      const sha256 = String(row.lfs?.sha256 || "").toLowerCase();
      invariant(Number.isSafeInteger(byteCount) && byteCount > 0, "weight size is invalid");
      invariant(/^[a-f0-9]{64}$/.test(sha256), "weight LFS SHA-256 is missing");
      return Object.freeze({ filename: row.rfilename, byteCount, sha256 });
    })
    .sort((left, right) => left.filename.localeCompare(right.filename));
  invariant(weights.length >= 1, "full safetensors weights are missing");
  const totalBytes = weights.reduce((sum, row) => sum + row.byteCount, 0);
  invariant(totalBytes >= profile.minimumWeightBytes && totalBytes <= profile.maximumWeightBytes,
    "weight size is outside profile bounds");
  return Object.freeze({
    weights: Object.freeze(weights),
    totalBytes,
    tokenizer: siblingIdentity(siblings.get("tokenizer.json"), "tokenizer.json"),
    tokenizerConfig: siblingIdentity(siblings.get("tokenizer_config.json"), "tokenizer_config.json")
  });
}

// Computes an order-stable full-weight identity so mirrors occupy one slot.
function weightIdentity(weights) {
  const canonical = weights.map((row) => `${row.filename}:${row.byteCount}:${row.sha256}`).join("\n");
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

// Fetches and validates the canonical Apache 2.0 license evidence once per run.
async function apacheLicenseEvidence(settings) {
  if (!settings.licenseEvidencePromise) {
    settings.licenseEvidencePromise = settings.metadata.text(
      settings.licenseUrl,
      "Apache 2.0 license authority"
    ).then((text) => {
      const normalized = text.toLowerCase();
      invariant(normalized.includes("apache license") && normalized.includes("version 2.0"),
        "Apache 2.0 authority text mismatch");
      return Object.freeze({
        licenseId: "apache-2.0",
        licenseUrl: settings.licenseUrl,
        licenseSha256: crypto.createHash("sha256").update(text).digest("hex")
      });
    });
  }
  return settings.licenseEvidencePromise;
}

// Converts one search row into a pinned candidate or a typed rejection.
async function inspectCandidate(model, settings) {
  const preflightCode = searchRejectionCode(model, settings.profile);
  if (preflightCode) return { rejection: preflightCode };
  const modelId = requireModelId(model.id);
  const revision = requireRevision(model.sha);
  const priorRejection = sourceCandidateRejection(modelId, revision);
  if (priorRejection) return { rejection: priorRejection };
  try {
    const info = await settings.metadata.json(
      buildRevisionInfoUrl(settings.baseUrl, modelId, revision),
      `${modelId} revision metadata`
    );
    invariant(info.id === modelId && String(info.sha || "").toLowerCase() === revision,
      "revision metadata identity drift");
    invariant(String(info.pipeline_tag || model.pipeline_tag || "").toLowerCase() === "text-generation",
      "revision is not text generation");
    invariant(String(info.cardData && info.cardData.license || "").toLowerCase() === "apache-2.0",
      "revision license metadata mismatch");
    const files = validateSiblings(info, settings.profile);
    const weightRejection = sourceCandidateRejection(modelId, revision, files.weights);
    if (weightRejection) return { rejection: weightRejection };
    const configText = await settings.metadata.text(
      buildResolveUrl(settings.baseUrl, modelId, revision, "config.json"),
      `${modelId} config`
    );
    let config;
    try {
      config = JSON.parse(configText);
    } catch (_error) {
      throw new Error("config JSON is invalid");
    }
    validateConfig(config, settings.profile);
    const tokenizerConfigText = await settings.metadata.text(
      buildResolveUrl(settings.baseUrl, modelId, revision, "tokenizer_config.json"),
      `${modelId} tokenizer config`
    );
    let tokenizerConfig;
    try {
      tokenizerConfig = JSON.parse(tokenizerConfigText);
    } catch (_error) {
      throw new Error("tokenizer config JSON is invalid");
    }
    const chatTemplate = validateTokenizerConfig(tokenizerConfig);
    const license = await apacheLicenseEvidence(settings);
    return {
      candidate: Object.freeze({
        sourceTemplate: settings.profile.id,
        modelId,
        revision,
        downloads: Number.isSafeInteger(model.downloads) ? model.downloads : 0,
        likes: Number.isSafeInteger(model.likes) ? model.likes : 0,
        pipelineTag: "text-generation",
        licenseId: license.licenseId,
        licenseEvidenceKind: "revision-metadata-plus-apache-authority-text",
        licenseSourceUrl: license.licenseUrl,
        licenseSha256: license.licenseSha256,
        configSha256: crypto.createHash("sha256").update(configText).digest("hex"),
        tokenizer: files.tokenizer,
        tokenizerConfig: files.tokenizerConfig,
        chatTemplateKind: chatTemplate.kind,
        chatTemplateSha256: chatTemplate.sha256,
        sourceWeightByteCount: files.totalBytes,
        weightIdentity: weightIdentity(files.weights),
        weightFiles: files.weights
      })
    };
  } catch (error) {
    if (error instanceof MetadataReadError) return { rejection: error.code };
    const message = String(error && error.message || error);
    if (message === "shape mismatch") return { rejection: "shape_mismatch" };
    if (message.includes("license") || message.includes("Apache")) {
      return { rejection: "license_evidence_invalid" };
    }
    if (message.includes("weight") || message.includes("safetensors")) {
      return { rejection: "full_weights_invalid" };
    }
    if (message.includes("text generation")) return { rejection: "not_conversation_model" };
    return { rejection: "source_evidence_invalid" };
  }
}

// Discovers one profile roster; requestTimeoutMs bounds each metadata request, never model execution.
async function discoverCandidates(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  invariant(typeof fetchImpl === "function", "fetch implementation is required");
  const profile = requireProfile(options.profileId);
  const baseUrl = normalizeBaseUrl(options.baseUrl || defaultBaseUrl);
  const licenseUrl = normalizeLicenseUrl(options.licenseUrl || defaultLicenseUrl);
  const search = String(options.search || profile.defaultSearch).trim();
  invariant(search.length >= 3 && search.length <= 120, "search is invalid");
  const searchLimit = Number(options.searchLimit || 300);
  const candidateLimit = Number(options.candidateLimit || 40);
  invariant(Number.isSafeInteger(candidateLimit) && candidateLimit >= 1 && candidateLimit <= maximumCandidateLimit,
    "candidate limit is invalid");
  const metadata = createMetadataReader(fetchImpl, options.requestTimeoutMs);
  const results = await metadata.json(buildSearchUrl(baseUrl, search, searchLimit), "model search");
  invariant(Array.isArray(results), "model search response must be an array");
  invariant(results.length <= searchLimit, "model search exceeds requested result limit");
  const settings = { baseUrl, metadata, licenseUrl, licenseEvidencePromise: null, profile };
  const candidates = [];
  const rejections = [];
  const identities = new Set();
  for (const model of results) {
    if (candidates.length >= candidateLimit) break;
    const modelId = typeof model?.id === "string" ? model.id : "invalid-model-id";
    const inspected = await inspectCandidate(model, settings);
    if (inspected.rejection) {
      rejections.push(Object.freeze({ modelId, code: inspected.rejection }));
      continue;
    }
    if (identities.has(inspected.candidate.weightIdentity)) {
      rejections.push(Object.freeze({ modelId, code: "duplicate_weight_identity" }));
      continue;
    }
    identities.add(inspected.candidate.weightIdentity);
    candidates.push(inspected.candidate);
  }
  return Object.freeze({
    schema: inventorySchema,
    generatedUtc: new Date().toISOString(),
    authority: "huggingface-primary-api-revision-files-and-apache-license-authority",
    profileId: profile.id,
    search,
    searchLimit,
    requestedCandidateLimit: candidateLimit,
    candidateCount: candidates.length,
    candidates: Object.freeze(candidates),
    rejections: Object.freeze(rejections)
  });
}

// Writes one inventory through synced same-directory atomic replacement.
function writeReport(outputPath, report) {
  const target = path.resolve(String(outputPath || ""));
  invariant(path.extname(target).toLowerCase() === ".json", "output path must end in .json");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, "wx", 0o600);
    fs.writeFileSync(descriptor, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, target);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    fs.rmSync(temporary, { force: true });
  }
  return target;
}

// Runs the profile discovery CLI and reports an honest candidate shortfall.
async function main(argv) {
  const [outputPath, profileId, candidateLimitText, searchLimitText, ...searchParts] = argv;
  invariant(outputPath && profileId,
    "usage: node tools/huggingface-supported-candidates.js <output.json> <profile-id> [candidate-limit] [search-limit] [search]");
  const candidateLimit = candidateLimitText ? Number(candidateLimitText) : 40;
  const searchLimit = searchLimitText ? Number(searchLimitText) : 300;
  const search = searchParts.length ? searchParts.join(" ") : undefined;
  const report = await discoverCandidates({ candidateLimit, profileId, search, searchLimit });
  const target = writeReport(outputPath, report);
  process.stdout.write(`Candidate inventory ${profileId}: ${report.candidateCount}/${candidateLimit} -> ${target}\n`);
  if (report.candidateCount < candidateLimit) process.exitCode = 2;
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`Candidate discovery failed: ${String(error && error.message || error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  buildResolveUrl,
  buildRevisionInfoUrl,
  buildSearchUrl,
  discoverCandidates,
  inventorySchema,
  profiles,
  writeReport
});
