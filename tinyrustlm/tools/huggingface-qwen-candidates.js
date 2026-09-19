"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { sourceCandidateRejection } = require("./source-candidate-exclusions.js");
const { createMetadataReader, MetadataReadError } = require("./huggingface-metadata.js");

const inventorySchema = "tinyrustlm.huggingface_candidate_inventory.v1";
const defaultBaseUrl = "https://huggingface.co";
const maximumSearchLimit = 500;
const maximumCandidateLimit = 100;
const maximumLicenseBytes = 256 * 1024;
const minimumWeightBytes = 2_500_000_000;
const maximumWeightBytes = 4_500_000_000;
const allowedLicenses = new Set(["apache-2.0", "mit"]);
const expectedConfig = Object.freeze({
  hidden_size: 1536,
  num_hidden_layers: 28,
  num_attention_heads: 12,
  num_key_value_heads: 2,
  intermediate_size: 8960,
  vocab_size: 151936
});

// Raises a stable validation error when an external-data invariant is false.
function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

// Accepts HTTPS service origins and loopback HTTP used by deterministic tests.
function normalizeBaseUrl(value) {
  const url = new URL(String(value || defaultBaseUrl));
  const loopback = url.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
  invariant(url.protocol === "https:" || loopback, "Hugging Face base URL must use HTTPS");
  invariant(!url.username && !url.password && !url.search && !url.hash, "base URL must not contain credentials");
  return url.origin;
}

// Validates one route-safe Hugging Face owner/repository identifier.
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

// Builds the bounded primary Hugging Face model-search endpoint.
function buildSearchUrl(baseUrl, search, limit) {
  const boundedLimit = Number(limit);
  invariant(Number.isSafeInteger(boundedLimit) && boundedLimit >= 1 && boundedLimit <= maximumSearchLimit,
    "search limit is invalid");
  const url = new URL("/api/models", normalizeBaseUrl(baseUrl));
  url.searchParams.set("search", String(search || "qwen2.5 1.5b").trim());
  url.searchParams.set("sort", "downloads");
  url.searchParams.set("direction", "-1");
  url.searchParams.set("limit", String(boundedLimit));
  url.searchParams.set("full", "true");
  url.searchParams.set("config", "true");
  return url.toString();
}

// Builds a revision-pinned model metadata endpoint with LFS blob evidence.
function buildRevisionInfoUrl(baseUrl, modelId, revision) {
  const safeId = requireModelId(modelId).split("/").map(encodeURIComponent).join("/");
  const safeRevision = requireRevision(revision);
  return `${normalizeBaseUrl(baseUrl)}/api/models/${safeId}/revision/${safeRevision}?blobs=true`;
}

// Builds a revision-pinned route for one allowlisted source evidence file.
function buildResolveUrl(baseUrl, modelId, revision, filename) {
  invariant(["config.json", "LICENSE"].includes(filename), "resolve filename is not allowlisted");
  const safeId = requireModelId(modelId).split("/").map(encodeURIComponent).join("/");
  return `${normalizeBaseUrl(baseUrl)}/${safeId}/resolve/${requireRevision(revision)}/${filename}`;
}

// Extracts one explicit, approved model license tag from search metadata.
function modelLicenseId(model) {
  const tags = Array.isArray(model.tags) ? model.tags : [];
  const license = tags.find((tag) => typeof tag === "string" && tag.startsWith("license:"));
  return license ? license.slice("license:".length).toLowerCase() : "";
}

// Returns a stable preflight rejection code before model-specific API calls.
function searchRejectionCode(model) {
  const id = String(model && model.id || "");
  if (!/^[a-fA-F0-9]{40,64}$/.test(String(model && model.sha || ""))) {
    return "immutable_revision_required";
  }
  if (model.private === true || model.gated === true || model.disabled === true) {
    return "source_not_public";
  }
  if (/(?:^|[-_.])(gguf|awq|gptq|mlx|onnx|bnb|openvino|fp8|int4|q[234568])(?:$|[-_.])/i.test(id)) {
    return "unsupported_packaging";
  }
  const tags = Array.isArray(model.tags) ? model.tags : [];
  if (!tags.includes("safetensors") || model.config?.model_type !== "qwen2" ||
      !Array.isArray(model.config?.architectures) ||
      !model.config.architectures.includes("Qwen2ForCausalLM")) {
    return "unsupported_architecture";
  }
  if (!/(instruct|chat|assistant|dolphin|heretic|abliterated|reasoning|tutor|expert)/i.test(id)) {
    return "conversation_tuning_not_declared";
  }
  if (!allowedLicenses.has(modelLicenseId(model))) {
    return "license_not_approved";
  }
  return "";
}

// Verifies that fetched config dimensions exactly match the Rust Qwen source contract.
function validateConfig(config) {
  invariant(config && typeof config === "object" && !Array.isArray(config), "config.json is invalid");
  invariant(config.model_type === "qwen2", "shape mismatch");
  invariant(Array.isArray(config.architectures) && config.architectures.includes("Qwen2ForCausalLM"),
    "shape mismatch");
  for (const [field, expected] of Object.entries(expectedConfig)) {
    invariant(config[field] === expected, "shape mismatch");
  }
}

// Validates license text against the approved metadata identifier without legal inference.
function validateLicenseText(licenseId, text) {
  const normalized = String(text || "").toLowerCase();
  if (licenseId === "apache-2.0") {
    invariant(normalized.includes("apache license") && normalized.includes("version 2.0"),
      "license text mismatch");
  } else if (licenseId === "mit") {
    invariant(normalized.includes("mit license") || normalized.includes("permission is hereby granted"),
      "license text mismatch");
  } else {
    throw new Error("license not approved");
  }
}

// Extracts complete LFS-backed safetensors files and required evidence siblings.
function validateSiblings(info) {
  invariant(info && typeof info === "object" && Array.isArray(info.siblings), "revision metadata is invalid");
  const siblings = new Map(info.siblings.map((row) => [row.rfilename, row]));
  for (const required of ["config.json", "tokenizer.json", "LICENSE"]) {
    invariant(siblings.has(required), `required source file is missing: ${required}`);
  }
  const weights = info.siblings
    .filter((row) => /^model(?:-\d{5}-of-\d{5})?\.safetensors$/.test(String(row.rfilename || "")))
    .map((row) => {
      const size = Number(row.lfs?.size ?? row.size);
      const sha256 = String(row.lfs?.sha256 || "").toLowerCase();
      invariant(Number.isSafeInteger(size) && size > 0, "weight size is invalid");
      invariant(/^[a-f0-9]{64}$/.test(sha256), "weight LFS SHA-256 is missing");
      return Object.freeze({ filename: row.rfilename, byteCount: size, sha256 });
    })
    .sort((left, right) => left.filename.localeCompare(right.filename));
  invariant(weights.length >= 1, "full safetensors weights are missing");
  const totalBytes = weights.reduce((sum, row) => sum + row.byteCount, 0);
  invariant(totalBytes >= minimumWeightBytes && totalBytes <= maximumWeightBytes, "weight size is outside Qwen2.5-1.5B bounds");
  return Object.freeze({
    weights: Object.freeze(weights),
    totalBytes,
    tokenizerByteCount: Number(siblings.get("tokenizer.json").size || 0),
    licenseByteCount: Number(siblings.get("LICENSE").size || 0)
  });
}

// Computes an order-stable identity so mirrors cannot fill multiple model slots.
function weightIdentity(weights) {
  const canonical = weights.map((row) => `${row.filename}:${row.byteCount}:${row.sha256}`).join("\n");
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

// Converts one search result into a fully pinned candidate or a typed rejection.
async function inspectCandidate(model, settings) {
  const preflightCode = searchRejectionCode(model);
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
    const files = validateSiblings(info);
    const weightRejection = sourceCandidateRejection(modelId, revision, files.weights);
    if (weightRejection) return { rejection: weightRejection };
    const configText = await settings.metadata.text(
      buildResolveUrl(settings.baseUrl, modelId, revision, "config.json"),
      `${modelId} config`,
      1024 * 1024
    );
    let config;
    try {
      config = JSON.parse(configText);
    } catch (_error) {
      throw new Error("config JSON is invalid");
    }
    validateConfig(config);
    const licenseText = await settings.metadata.text(
      buildResolveUrl(settings.baseUrl, modelId, revision, "LICENSE"),
      `${modelId} license`,
      maximumLicenseBytes
    );
    const licenseId = modelLicenseId(model);
    validateLicenseText(licenseId, licenseText);
    return {
      candidate: Object.freeze({
        modelId,
        revision,
        downloads: Number.isSafeInteger(model.downloads) ? model.downloads : 0,
        likes: Number.isSafeInteger(model.likes) ? model.likes : 0,
        licenseId,
        licenseSha256: crypto.createHash("sha256").update(licenseText).digest("hex"),
        configSha256: crypto.createHash("sha256").update(configText).digest("hex"),
        tokenizerByteCount: files.tokenizerByteCount,
        sourceWeightByteCount: files.totalBytes,
        weightIdentity: weightIdentity(files.weights),
        weightFiles: files.weights
      })
    };
  } catch (error) {
    if (error instanceof MetadataReadError) return { rejection: error.code };
    const message = String(error && error.message || error);
    if (message === "shape mismatch") return { rejection: "shape_mismatch" };
    if (message.includes("license")) return { rejection: "license_evidence_invalid" };
    if (message.includes("weight") || message.includes("safetensors")) {
      return { rejection: "full_weights_invalid" };
    }
    return { rejection: "source_evidence_invalid" };
  }
}

// Discovers a roster; requestTimeoutMs bounds each metadata request, never model execution.
async function discoverCandidates(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  invariant(typeof fetchImpl === "function", "fetch implementation is required");
  const baseUrl = normalizeBaseUrl(options.baseUrl || defaultBaseUrl);
  const search = String(options.search || "qwen2.5 1.5b").trim();
  invariant(search.length >= 3 && search.length <= 120, "search is invalid");
  const searchLimit = Number(options.searchLimit || 300);
  const candidateLimit = Number(options.candidateLimit || 40);
  invariant(Number.isSafeInteger(candidateLimit) && candidateLimit >= 1 && candidateLimit <= maximumCandidateLimit,
    "candidate limit is invalid");
  const metadata = createMetadataReader(fetchImpl, options.requestTimeoutMs);
  const results = await metadata.json(buildSearchUrl(baseUrl, search, searchLimit), "model search");
  invariant(Array.isArray(results), "model search response must be an array");
  invariant(results.length <= searchLimit, "model search exceeds requested result limit");
  const candidates = [];
  const rejections = [];
  const identities = new Set();
  for (const model of results) {
    if (candidates.length >= candidateLimit) break;
    const modelId = typeof model?.id === "string" ? model.id : "invalid-model-id";
    const inspected = await inspectCandidate(model, { baseUrl, metadata });
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
    authority: "huggingface-primary-api-and-revision-pinned-files",
    search,
    searchLimit,
    requestedCandidateLimit: candidateLimit,
    candidateCount: candidates.length,
    candidates: Object.freeze(candidates),
    rejections: Object.freeze(rejections)
  });
}

// Writes a report through same-directory atomic replacement.
function writeReport(outputPath, report) {
  const target = path.resolve(String(outputPath || ""));
  invariant(path.extname(target).toLowerCase() === ".json", "output path must end in .json");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    fs.renameSync(temporary, target);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
  return target;
}

// Runs the network discovery CLI and reports an honest shortfall via exit status.
async function main(argv) {
  const [outputPath, candidateLimitText, searchLimitText, ...searchParts] = argv;
  invariant(outputPath, "usage: node tools/huggingface-qwen-candidates.js <output.json> [candidate-limit] [search-limit] [search]");
  const candidateLimit = candidateLimitText ? Number(candidateLimitText) : 40;
  const searchLimit = searchLimitText ? Number(searchLimitText) : 300;
  const search = searchParts.length ? searchParts.join(" ") : "qwen2.5 1.5b";
  const report = await discoverCandidates({ candidateLimit, searchLimit, search });
  const target = writeReport(outputPath, report);
  process.stdout.write(`Candidate inventory: ${report.candidateCount}/${candidateLimit} -> ${target}\n`);
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
  writeReport
});
