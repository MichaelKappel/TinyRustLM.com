"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const admissionAuthority = require("../../app/browser-model-admission.js");
const acg2Reference = require("../../tools/acg2-reference.js");
const tokenizer2Reference = require("../../tools/tokenizer2-reference.js");
const slm2Reference = require("../../tools/slm2-q8-reference.js");
const catalogApi = require("../../app/minimodel-catalog-v1.js");
const { requireModelOutputRoot, readBoundedFile } = require("../../tools/huggingface-candidate-storage.js");
const scratch = require("../../tools/canonical-operation-scratch.js");
const repositoryRoot = path.resolve(__dirname, "../../..");
const TEST_ONLY_SCOPE = "test-only/never-live/e2e/browser-conversation";
const TEST_ONLY_MODEL_ID = "test-only/browser-conversation";
const PRIVATE_EXECUTION_ID = "qwen3-composition-c1899de-908e73f-20260826-v12";
const PRIVATE_RESULT_PATH = path.join(repositoryRoot, "contracts/vnext/qwen3-real-composition-execution-result.v12.json");
const RUNTIME_MEMBER_NAMES = admissionAuthority.artifactSpecs.map(spec => spec.fileName);

/** Compile the canonical writer example into owned output; return only in-memory synthetic bytes. */
function buildModel(rows) {
  if (!Array.isArray(rows) || rows.length !== 2 || rows[0] !== 0 ||
      !Number.isInteger(rows[1]) || rows[1] < 1 || rows[1] >= 151_643) {
    throw new Error("Synthetic output rows are invalid");
  }
  const owned = scratch.createOwnedTemporaryDirectory({
    temporaryParent: path.join(repositoryRoot, "artifacts/tests/browser-conversation-fixture")
  });
  let interrupted = false;
  /** Execute a finite child without shell interpolation or unbounded diagnostic output. */
  function run(executable, args, maximumBytes) {
    const result = spawnSync(executable, args, { cwd: repositoryRoot, env: { ...process.env,
      NODE_V8_COVERAGE: "", TEMP: owned.rootPath, TMP: owned.rootPath, TMPDIR: owned.rootPath },
      windowsHide: true, shell: false, timeout: 120_000, maxBuffer: maximumBytes });
    interrupted = Boolean(result.error || result.signal);
    if (interrupted || result.status !== 0) throw new Error("Synthetic fixture child failed");
    return result.stdout;
  }
  try {
    const target = path.join(owned.rootPath, "target");
    run(process.env.CARGO || "cargo", ["build", "--manifest-path",
      path.join(repositoryRoot, "rust/crates/tinyrustlm-slm2/Cargo.toml"),
      "--example", "browser_conversation_fixture", "--target-dir", target, "--locked", "--offline"], 1024 * 1024);
    return run(path.join(target, "debug/examples/browser_conversation_fixture" +
      (process.platform === "win32" ? ".exe" : "")), rows.map(String), 4 * 1024 * 1024);
  } finally {
    if (!interrupted) scratch.removeOwnedTemporaryDirectory(owned);
  }
}

/** Hash exact bytes for composition binding. */
function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/** Supply exact test-only discovery metadata through normal admission validation, never a bypass. */
function discoveryDocuments(admissionText, files) {
  const admission = admissionAuthority.parseAdmissionText(admissionText);
  const now = new Date(Math.floor(Date.now() / 1000) * 1000);
  const utc = delta => new Date(now.getTime() + delta).toISOString().replace(".000Z", "Z");
  const qualification = { schema: catalogApi.QUALIFICATION_RECEIPT_SCHEMA,
    receiptId: admission.qualification.receiptId, modelId: admission.modelId, operationId: admission.operationId,
    compositionId: `sha256:${admission.composition.graphIdentitySha256}`, ...admission.qualification,
    numericalStatus: "passed", browserStatus: "passed", qualityStatus: "qualified", issuedAtUtc: utc(-120000) };
  const qualificationText = JSON.stringify(qualification) + "\n";
  const admissionRoute = "/test-only/browser-conversation/admission.json";
  const receiptRoute = "/test-only/browser-conversation/qualification.json";
  const catalog = { schema: catalogApi.CATALOG_SCHEMA, catalog_id: "test-only/browser-conversation",
    revision: 1, generated_at_utc: utc(-60000), valid_until_utc: utc(3600000),
    project_server_serves_model_bytes: false, project_server_proxies_model_bytes: false,
    project_server_runs_inference: false, qualification_policy: "exact-current-evidence-required",
    qualification_receipt_schema: catalogApi.QUALIFICATION_RECEIPT_SCHEMA,
    browser_admission_schema: catalogApi.BROWSER_ADMISSION_SCHEMA,
    peer_verification_keys: [], revoked_qualification_receipt_ids: [], supersessions: [],
    entries: [{ entry_id: "test-only/browser-conversation", display_name: "Synthetic conversation fixture",
      description: "Test-only synthetic weights; never a live model or quality result.",
      source: { repository: TEST_ONLY_MODEL_ID, revision: "1".repeat(40), source_lock_sha256: `sha256:${"2".repeat(64)}` },
      license: { route: "/test-only/browser-conversation/license.txt", review_status: "reviewed" },
      composition: { composition_id: qualification.compositionId, member_count: 6,
        members: admission.artifacts.map((artifact, index) => ({ name: artifact.fileName,
          bytes: files[index].buffer.length, sha256: `sha256:${artifact.sha256}`, schema: artifact.format })) },
      browser_admission: { route: admissionRoute, bytes: Buffer.byteLength(admissionText), sha256: `sha256:${sha256(admissionText)}` },
      profiles: { conversion: "test-only.writer.v1", quantization: "test-only.mixed-q8.v1", runtime: "test-only.browser.v1" },
      qualification: { status: "qualified", receipt_id: qualification.receiptId, receipt_route: receiptRoute,
        receipt_bytes: Buffer.byteLength(qualificationText), receipt_sha256: `sha256:${sha256(qualificationText)}`,
        numerical_status: "passed", browser_status: "passed", quality_status: "qualified" },
      peer_announcement_ids: [] }]
  };
  const peers = { schema: catalogApi.PEER_SCHEMA, feed_id: "test-only/browser-conversation", revision: 1,
    generated_at_utc: catalog.generated_at_utc, valid_until_utc: catalog.valid_until_utc,
    project_server_serves_model_bytes: false, project_server_proxies_model_bytes: false, announcements: [] };
  catalogApi.validateCatalog(catalog, { now });
  catalogApi.validatePeerFeed(peers, catalog, { now });
  return Object.freeze({
    "https://minimodel.org/catalog/compositions.v1.json": JSON.stringify(catalog) + "\n",
    "https://minimodel.org/catalog/peer-announcements.v1.json": JSON.stringify(peers) + "\n",
    [`https://minimodel.org${admissionRoute}`]: admissionText,
    [`https://minimodel.org${receiptRoute}`]: qualificationText
  });
}

/** Retrieve only the bounded runtime error code. */
function runtimeErrorCode(instance) {
  const length = instance.exports.tinyrustlm_browser_runtime_error_len() >>> 0;
  if (length === 0) return "";
  const pointer = instance.exports.tinyrustlm_browser_runtime_error_ptr() >>> 0;
  return Buffer.from(new Uint8Array(
    instance.exports.memory.buffer,
    pointer,
    length
  )).toString("ascii");
}

/** Transfer one exact member through the maintained WASM ABI. */
function transferRuntimeBytes(instance, kind, bytes) {
  const pointer = instance.exports.tinyrustlm_browser_runtime_transfer_begin(
    kind,
    bytes.byteLength
  ) >>> 0;
  if (pointer === 0) {
    throw new Error(`Test composition transfer ${kind} rejected: ${runtimeErrorCode(instance)}`);
  }
  new Uint8Array(instance.exports.memory.buffer, pointer, bytes.byteLength).set(bytes);
  const status = instance.exports.tinyrustlm_browser_runtime_transfer_commit(
    kind,
    pointer,
    bytes.byteLength
  ) >>> 0;
  if (status !== 0) {
    throw new Error(`Test composition commit ${kind} rejected: ${runtimeErrorCode(instance)}`);
  }
}

/** Independently activate all six members in the current WASM before using the fixture. */
function validateRuntimeComposition(operationId, policy, memberBytes) {
  const wasmBytes = fs.readFileSync(path.join(
    __dirname,
    "../..",
    "browser-runtime",
    "tinyrustlm-browser-runtime.wasm"
  ));
  const instance = new WebAssembly.Instance(new WebAssembly.Module(wasmBytes));
  const operationBytes = Buffer.from(operationId, "hex");
  transferRuntimeBytes(instance, 1, operationBytes);
  const created = instance.exports.tinyrustlm_browser_runtime_create(
    policy.maximumModelBytes,
    policy.maximumSequenceTokens,
    policy.maximumKvBytes,
    policy.maximumScratchBytes,
    policy.maximumResolvedMemberBytes,
    policy.maximumResidentDependencyBytes,
    policy.maximumRequestBytes,
    policy.maximumLinearMemoryBytes,
    0,
    0
  ) >>> 0;
  if (created !== 0) {
    throw new Error(`Test composition runtime create rejected: ${runtimeErrorCode(instance)}`);
  }
  memberBytes.forEach((bytes, index) => transferRuntimeBytes(instance, index + 3, bytes));
  transferRuntimeBytes(instance, 1, operationBytes);
  const activated = instance.exports.tinyrustlm_browser_runtime_activate() >>> 0;
  if (activated !== 0) {
    throw new Error(`Test composition activation rejected: ${runtimeErrorCode(instance)}`);
  }
  instance.exports.tinyrustlm_browser_runtime_release();
}

/** Select two non-control rows that decode to visible complete UTF-8. */
function tokenizerVerifiedOutputRows(tokenizerBytes) {
  const tokenizer = tokenizer2Reference.parseTokenizer2(tokenizerBytes, {
    maximumArtifactBytes: tokenizerBytes.byteLength
  });
  const primaryId = 0;
  const secondaryIds = tokenizer2Reference.encodeText(tokenizer, "A");
  if (secondaryIds.length !== 1 || secondaryIds[0] === primaryId) {
    throw new Error("Test tokenizer does not expose distinct bounded output rows");
  }
  const outputIds = [primaryId, secondaryIds[0]];
  for (const tokenId of outputIds) {
    const record = tokenizer.records[tokenId];
    const decoded = tokenizer2Reference.decodeTokens(tokenizer, [tokenId], "include-all");
    if (!record || (record.flags & 2) !== 0 || decoded.byteLength === 0) {
      throw new Error("Test tokenizer output row is not visible UTF-8");
    }
  }
  return Object.freeze(outputIds);
}

/** Assemble test-only weights with exact current tokenizer/template dependencies in memory. */
function runtimeCompositionFixture(dependencyRoot) {
  const root = requireModelOutputRoot(dependencyRoot);
  const publicResult = JSON.parse(fs.readFileSync(PRIVATE_RESULT_PATH, "utf8"));
  if (publicResult.executionId !== PRIVATE_EXECUTION_ID) {
    throw new Error("Private runtime composition execution identity drifted");
  }
  const inventory = new Map(publicResult.composition.inventory.map((entry) => [
    entry.file,
    entry
  ]));
  const dependencyNames = RUNTIME_MEMBER_NAMES.slice(1, 5);
  const dependencyBytes = dependencyNames.map((fileName) => {
    const identity = inventory.get(fileName);
    if (!identity) throw new Error(`Missing public dependency identity: ${fileName}`);
    const bytes = readBoundedFile(path.join(requireModelOutputRoot(root), fileName), identity.byteLength);
    if (bytes.byteLength !== identity.byteLength || sha256(bytes) !== identity.sha256) {
      throw new Error(`Private runtime dependency identity mismatch: ${fileName}`);
    }
    return bytes;
  });
  const outputRows = tokenizerVerifiedOutputRows(dependencyBytes[0]);

  const modelBytes = buildModel(outputRows);
  const parsedModel = slm2Reference.parseArtifact(modelBytes);
  if (parsedModel.spec.vocabularySize !== 151_936 || parsedModel.spec.contextLength !== 40_960) {
    throw new Error("Synthetic model dimensions drifted");
  }
  const memberBytes = [modelBytes, ...dependencyBytes];
  const graphMembers = acg2Reference.MEMBER_PROFILES.map((profile, index) => ({
    ordinal: profile.ordinal,
    role: profile.role,
    format: profile.format,
    artifactBytes: memberBytes[index].byteLength,
    artifactSha256: sha256(memberBytes[index]),
    formatProfileSha256: profile.profileSha256
  }));
  const compositionBytes = acg2Reference.writeGraph(graphMembers);
  const graph = acg2Reference.parseGraph(compositionBytes);
  const allMembers = [...memberBytes, compositionBytes];
  const artifacts = admissionAuthority.artifactSpecs.map((spec, index) => ({
    role: spec.role,
    format: spec.format,
    fileName: spec.fileName,
    byteCount: allMembers[index].byteLength,
    sha256: sha256(allMembers[index]),
    formatProfileSha256: spec.profileSha256
  }));
  const runtimeManifest = JSON.parse(fs.readFileSync(path.join(
    __dirname,
    "../..",
    "browser-runtime",
    "tinyrustlm-browser-runtime.wasm.manifest.json"
  ), "utf8"));
  const identity = (label) => sha256(Buffer.from(`test-only:${label}`, "utf8"));
  const resolvedMemberBytes = artifacts.slice(0, 5)
    .reduce((total, artifact) => total + artifact.byteCount, 0);
  const residentDependencyBytes = artifacts.slice(1, 5)
    .reduce((total, artifact) => total + artifact.byteCount, 0);
  const operationId = identity("browser-conversation-operation");
  const runtimePolicy = {
    maximumModelBytes: artifacts[0].byteCount,
    maximumSequenceTokens: 128,
    maximumKvBytes: 8 * 1024 * 1024,
    maximumScratchBytes: 8 * 1024 * 1024,
    maximumResolvedMemberBytes: resolvedMemberBytes,
    maximumResidentDependencyBytes: residentDependencyBytes,
    maximumRequestBytes: 1_054_848,
    maximumLinearMemoryBytes: runtimeManifest.maximumMemoryBytes
  };
  const admissionText = admissionAuthority.serializeAdmission({
    schema: admissionAuthority.schema,
    modelId: TEST_ONLY_MODEL_ID,
    operationId,
    artifacts,
    composition: {
      graphIdentitySha256: graph.graphIdentitySha256,
      memberTableSha256: graph.memberTableSha256,
      resolvedMemberBytes
    },
    qualification: {
      receiptId: `sha256:${identity("browser-conversation-receipt")}`,
      sourceEvidenceSha256: identity("browser-conversation-source"),
      structuralEvidenceSha256: identity("browser-conversation-structure"),
      numericalEvidenceSha256: identity("browser-conversation-numerical"),
      qualityEvidenceSha256: identity("browser-conversation-quality"),
      evalCasesSha256: identity("browser-conversation-evals"),
      qualityClaim: "task-specific-qualified",
      qualityScope: TEST_ONLY_SCOPE
    },
    runtime: {
      workerProtocol: runtimeManifest.workerProtocol,
      wasmByteCount: runtimeManifest.byteCount,
      wasmSha256: runtimeManifest.sha256,
      policy: runtimePolicy,
      defaultSampling: {
        temperatureMillionths: 0,
        topK: 1,
        topPMillionths: 1_000_000,
        repetitionPenaltyMillionths: 1_000_000,
        repetitionWindow: 0,
        maximumNewTokens: 8
      }
    }
  });
  validateRuntimeComposition(operationId, runtimePolicy, allMembers);
  const files = artifacts.map((artifact, index) => ({
    name: artifact.fileName,
    mimeType: "application/octet-stream",
    buffer: allMembers[index]
  }));
  files.push({
    name: "test-only.browser-composition-admission.json",
    mimeType: "application/json",
    buffer: Buffer.from(admissionText, "utf8")
  });
  return Object.freeze({ admissionText, files: Object.freeze(files), routes: discoveryDocuments(admissionText, files) });
}

module.exports = Object.freeze({ buildModel, runtimeCompositionFixture, TEST_ONLY_MODEL_ID });
