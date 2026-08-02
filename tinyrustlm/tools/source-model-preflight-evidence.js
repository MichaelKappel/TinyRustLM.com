"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { CampaignEvidenceStore, canonicalJson } = require("./campaign-evidence-store.js");

const assessmentSchemaV1 = "tinyrustlm.source_model_preflight_assessment.v1";
const assessmentSchema = "tinyrustlm.source_model_preflight_assessment.v2";
const receiptType = "tinyrustlm.model-source-review-v1";
const toolVersion = "8";
const maximumJsonBytes = 256 * 1024;
const maximumEvidenceBytes = 2 * 1024 * 1024;
const maximumSourceBytes = 8 * 1024 * 1024 * 1024;
const maximumWeightIndexBytes = 64 * 1024 * 1024;
const maximumWeightArtifactCount = 224;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const revisionPattern = /^[a-f0-9]{40,64}$/u;
const modelIdPattern = /^[A-Za-z0-9._-]{1,96}\/[A-Za-z0-9._-]{1,160}$/u;
const codePattern = /^[a-z0-9][a-z0-9._-]{2,159}$/u;
const fileNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u;
const conversationContractBlocker = "candidate_source_conversation_contract_rejected";
const missingConversationContractRejectionCodes = Object.freeze([
  "publisher-chat-template-absent",
  "publisher-multi-turn-serialization-absent",
  "source-screen-conversation-contract-incomplete"
]);
const missingConversationContractEvidenceKinds = Object.freeze([
  "model-card",
  "repository-tree",
  "tokenizer-config"
]);
const conflictingConversationContractRejectionCodes = Object.freeze([
  "publisher-chat-template-card-serialization-conflict",
  "publisher-chat-template-generation-prefix-absent",
  "publisher-generation-stop-token-conflict",
  "source-screen-conversation-contract-incomplete"
]);
const conflictingConversationContractEvidenceKinds = Object.freeze([
  "config",
  "generation-config",
  "model-card",
  "repository-tree",
  "special-tokens-map",
  "tokenizer-config"
]);
const loaderContractBlocker = "candidate_source_loader_contract_rejected";
const loaderContractRejectionCodes = Object.freeze([
  "custom-publisher-code-required",
  "native-transformers-architecture-absent",
  "source-screen-loader-contract-incompatible"
]);
const loaderContractEvidenceKinds = Object.freeze([
  "config",
  "configuration",
  "modeling",
  "repository-tree",
  "transformers-auto-config-registry"
]);
const policyContractBlocker = "candidate_source_policy_contract_rejected";
const policyContractRejectionCodes = Object.freeze([
  "custom-license-product-policy-conflict",
  "gated-acquisition-authorization-absent",
  "p2p-redistribution-contract-incompatible"
]);
const policyContractRepositoryEvidenceKinds = Object.freeze([
  "repository-metadata",
  "repository-tree"
]);
const policyContractLicenseEvidenceKinds = Object.freeze([
  "license",
  "terms-of-use"
]);
const policyContractUsePolicyEvidenceKinds = Object.freeze([
  "prohibited-use-policy",
  "use-policy"
]);
const provenanceContractBlocker = "candidate_source_provenance_contract_rejected";
const provenanceContractMissingArtifacts = Object.freeze([
  "model.safetensors",
  "training-corpus-manifest.json",
  "training-recipe.json"
]);
const provenanceContractProfiles = Object.freeze([
  Object.freeze({
    discriminator: "source-lineage-quantized-intermediate-only",
    rejectionCodes: Object.freeze([
      "publisher-training-corpus-identity-absent",
      "publisher-training-recipe-identity-absent",
      "source-lineage-quantized-intermediate-only",
      "source-screen-provenance-contract-incomplete"
    ]),
    evidenceKinds: Object.freeze([
      "config",
      "model-card",
      "repository-metadata",
      "repository-tree",
      "tokenizer-config"
    ])
  }),
  Object.freeze({
    discriminator: "publisher-base-model-reference-conflicting",
    rejectionCodes: Object.freeze([
      "publisher-base-model-reference-conflicting",
      "publisher-base-model-revision-absent",
      "publisher-dataset-revision-absent",
      "publisher-training-recipe-identity-absent",
      "source-screen-provenance-contract-incomplete"
    ]),
    evidenceKinds: Object.freeze([
      "config",
      "dataset-metadata",
      "model-card",
      "parent-metadata",
      "repository-metadata",
      "repository-tree",
      "tokenizer-config"
    ])
  })
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256File(filePath, maximumBytes = maximumEvidenceBytes) {
  const stat = fs.lstatSync(filePath);
  invariant(stat.isFile() && !stat.isSymbolicLink(),
    `${path.basename(filePath)} is not a regular file`);
  invariant(stat.size > 0 && stat.size <= maximumBytes,
    `${path.basename(filePath)} has an invalid size`);
  const digest = crypto.createHash("sha256");
  const descriptor = fs.openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let offset = 0;
    while (offset < stat.size) {
      const read = fs.readSync(
        descriptor,
        buffer,
        0,
        Math.min(buffer.length, stat.size - offset),
        offset
      );
      invariant(read > 0, `${path.basename(filePath)} ended while hashing`);
      digest.update(buffer.subarray(0, read));
      offset += read;
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return Object.freeze({ byteCount: stat.size, sha256: digest.digest("hex") });
}

function readJson(filePath, label) {
  const artifact = sha256File(filePath, maximumJsonBytes);
  let value;
  try {
    value = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
  invariant(isPlainObject(value), `${label} must be an object`);
  return Object.freeze({ artifact, value });
}

function requireExactKeys(value, expected, label) {
  invariant(isPlainObject(value), `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  invariant(canonicalJson(actual) === canonicalJson(wanted), `${label} fields are invalid`);
}

function requireCode(value, label) {
  const normalized = String(value || "");
  invariant(codePattern.test(normalized), `${label} is invalid`);
  return normalized;
}

function requireSha256(value, label) {
  const normalized = String(value || "").toLowerCase();
  invariant(sha256Pattern.test(normalized), `${label} is not SHA-256`);
  return normalized;
}

function requireHttpsUrl(value, label) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    throw new Error(`${label} is not a URL`);
  }
  invariant(url.protocol === "https:" && !url.username && !url.password,
    `${label} must be credential-free HTTPS`);
  return url.toString();
}

function requireSortedUniqueStrings(value, label, validator, maximum = 64) {
  invariant(Array.isArray(value) && value.length <= maximum,
    `${label} must be a bounded array`);
  const normalized = value.map((entry) => validator(entry, label));
  invariant(new Set(normalized).size === normalized.length, `${label} contains duplicates`);
  invariant(canonicalJson(normalized) === canonicalJson([...normalized].sort()),
    `${label} must be sorted`);
  return Object.freeze(normalized);
}

function requireMissingArtifactName(value, label) {
  const normalized = String(value || "");
  invariant(fileNamePattern.test(normalized) && path.basename(normalized) === normalized,
    `${label} contains an unsafe file name`);
  return normalized;
}

function safeEvidencePath(rootPath, fileName) {
  const root = path.resolve(rootPath);
  const target = path.resolve(root, fileName);
  invariant(path.dirname(target) === root, "preflight evidence escaped its root");
  return target;
}

function inspectSourceWeightArtifacts(sourceRoot, acquisitionStatus, declarations) {
  invariant(new Set(["complete", "not-acquired"]).has(acquisitionStatus),
    "source acquisition status is invalid");
  invariant(Array.isArray(declarations) && declarations.length <= maximumWeightArtifactCount,
    "source weight artifact list is invalid");

  if (acquisitionStatus === "not-acquired") {
    invariant(declarations.length === 0,
      "not-acquired source cannot declare weight artifacts");
    invariant(sourceRoot === undefined || sourceRoot === null || sourceRoot === "",
      "not-acquired source cannot provide sourceArtifactRoot");
    return Object.freeze({
      acquisitionStatus,
      identityKind: "none",
      modelSha256: null,
      artifactSetSha256: null,
      byteCount: 0,
      artifacts: Object.freeze([])
    });
  }

  invariant(typeof sourceRoot === "string" && sourceRoot.length > 0,
    "complete source acquisition requires sourceArtifactRoot");
  invariant(declarations.length > 0,
    "complete source acquisition requires weight artifacts");
  const resolvedRoot = path.resolve(sourceRoot);
  const rootStat = fs.lstatSync(resolvedRoot);
  invariant(rootStat.isDirectory() && !rootStat.isSymbolicLink(),
    "sourceArtifactRoot must be a regular directory");

  const normalized = declarations.map((declaration) => {
    requireExactKeys(declaration, ["fileName", "byteCount", "sha256"],
      "source weight artifact");
    const fileName = requireMissingArtifactName(
      declaration.fileName, "source weight artifact name");
    invariant(Number.isSafeInteger(declaration.byteCount) && declaration.byteCount > 0 &&
      declaration.byteCount <= maximumSourceBytes,
    "source weight artifact byte count is invalid");
    const declaredSha256 = requireSha256(declaration.sha256, "source weight artifact hash");
    const target = path.resolve(resolvedRoot, fileName);
    invariant(path.dirname(target) === resolvedRoot,
      "source weight artifact escaped its root");
    const artifact = sha256File(target, maximumSourceBytes);
    invariant(artifact.byteCount === declaration.byteCount,
      `source weight byte count changed: ${fileName}`);
    invariant(artifact.sha256 === declaredSha256,
      `source weight hash changed: ${fileName}`);
    return Object.freeze({ fileName, ...artifact });
  });
  invariant(new Set(normalized.map((entry) => entry.fileName)).size === normalized.length,
    "source weight artifact names contain duplicates");

  const names = normalized.map((entry) => entry.fileName);
  const direct = names.includes("model.safetensors");
  const indexed = names.includes("model.safetensors.index.json");
  invariant(direct !== indexed,
    "source weights must be direct or indexed safetensors");
  let expectedNames;
  let identityKind;
  if (direct) {
    expectedNames = ["model.safetensors"];
    identityKind = "direct-safetensors-sha256";
  } else {
    const indexArtifact = normalized.find(
      (entry) => entry.fileName === "model.safetensors.index.json");
    invariant(indexArtifact.byteCount <= maximumWeightIndexBytes,
      "source weight index is too large");
    let index;
    try {
      index = JSON.parse(fs.readFileSync(
        path.join(resolvedRoot, "model.safetensors.index.json"), "utf8"));
    } catch {
      throw new Error("source weight index is not valid JSON");
    }
    invariant(isPlainObject(index) && isPlainObject(index.weight_map) &&
      Object.keys(index.weight_map).length > 0,
    "source weight index has no tensor mappings");
    const shardNames = [...new Set(Object.entries(index.weight_map).map(
      ([tensorName, shardName]) => {
        invariant(typeof tensorName === "string" && tensorName.length > 0 &&
          tensorName.length <= 512,
        "source weight index has an invalid tensor name");
        invariant(typeof shardName === "string" && fileNamePattern.test(shardName) &&
          path.basename(shardName) === shardName && shardName.endsWith(".safetensors") &&
          shardName !== "model.safetensors",
        "source weight index has an invalid shard name");
        return shardName;
      }))].sort();
    invariant(shardNames.length > 0,
      "indexed source weights require safetensors shards");
    expectedNames = ["model.safetensors.index.json", ...shardNames];
    identityKind = "indexed-safetensors-set-v1";
  }
  invariant(canonicalJson(names) === canonicalJson(expectedNames),
    indexed
      ? "source weight declarations do not match the index"
      : "source weight artifacts are not in canonical order");

  const identityEntries = normalized.map((entry) => ({
    name: entry.fileName,
    bytes: entry.byteCount,
    sha256: entry.sha256
  }));
  const artifactSetSha256 = sha256(canonicalJson(identityEntries));
  return Object.freeze({
    acquisitionStatus,
    identityKind,
    modelSha256: direct ? normalized[0].sha256 : artifactSetSha256,
    artifactSetSha256,
    byteCount: normalized.reduce((total, entry) => total + entry.byteCount, 0),
    artifacts: Object.freeze(normalized)
  });
}

function inspectEvidenceArtifact(rootPath, declaration) {
  requireExactKeys(declaration, [
    "kind", "fileName", "byteCount", "sha256", "publicUrl", "observedAtUtc"
  ], "preflight evidence artifact");
  const kind = requireCode(declaration.kind, "preflight evidence kind");
  const fileName = requireMissingArtifactName(
    declaration.fileName, "preflight evidence file name");
  invariant(Number.isSafeInteger(declaration.byteCount) && declaration.byteCount > 0 &&
    declaration.byteCount <= maximumEvidenceBytes, "preflight evidence byte count is invalid");
  const declaredSha256 = requireSha256(declaration.sha256, "preflight evidence hash");
  const publicUrl = requireHttpsUrl(declaration.publicUrl, "preflight evidence URL");
  invariant(typeof declaration.observedAtUtc === "string" &&
    Number.isFinite(Date.parse(declaration.observedAtUtc)) && declaration.observedAtUtc.endsWith("Z"),
  "preflight evidence observation time is invalid");
  const artifact = sha256File(safeEvidencePath(rootPath, fileName));
  invariant(artifact.byteCount === declaration.byteCount,
    `preflight evidence byte count changed: ${kind}`);
  invariant(artifact.sha256 === declaredSha256,
    `preflight evidence hash changed: ${kind}`);
  return Object.freeze({
    kind,
    fileName,
    byteCount: artifact.byteCount,
    sha256: artifact.sha256,
    publicUrl,
    observedAtUtc: declaration.observedAtUtc
  });
}

// Validates one complete publisher-conversation failure profile without
// treating a present but contradictory template as a missing template.
function validateConversationContractRejection(
  rejectionCodes,
  missingRequiredArtifacts,
  evidenceArtifacts
) {
  const codeSet = new Set(rejectionCodes);
  const matchesMissingProfile = missingConversationContractRejectionCodes.every(
    (code) => codeSet.has(code));
  const matchesConflictingProfile = conflictingConversationContractRejectionCodes.every(
    (code) => codeSet.has(code));
  invariant(matchesMissingProfile !== matchesConflictingProfile,
    "conversation-contract rejection does not match a supported failure profile");
  const evidenceKinds = new Set(evidenceArtifacts.map((entry) => entry.kind));

  if (matchesMissingProfile) {
    invariant(missingRequiredArtifacts.includes("chat_template.jinja"),
      "conversation-contract rejection must name chat_template.jinja");
    for (const kind of missingConversationContractEvidenceKinds) {
      invariant(evidenceKinds.has(kind),
        `conversation-contract rejection is missing ${kind} evidence`);
    }
    return;
  }

  invariant(!missingRequiredArtifacts.includes("chat_template.jinja"),
    "conflicting conversation-contract rejection cannot name chat_template.jinja");
  invariant(!codeSet.has("publisher-chat-template-absent"),
    "conflicting conversation-contract rejection cannot claim the template is absent");
  for (const kind of conflictingConversationContractEvidenceKinds) {
    invariant(evidenceKinds.has(kind),
      `conflicting conversation-contract rejection is missing ${kind} evidence`);
  }
}

function validateProvenanceContractRejection(
  rejectionCodes,
  missingRequiredArtifacts,
  evidenceArtifacts
) {
  const codeSet = new Set(rejectionCodes);
  const matchingProfiles = provenanceContractProfiles.filter(
    (profile) => codeSet.has(profile.discriminator));
  invariant(matchingProfiles.length === 1,
    "provenance-contract rejection does not match exactly one supported failure profile");
  const profile = matchingProfiles[0];

  for (const code of profile.rejectionCodes) {
    invariant(codeSet.has(code),
      `provenance-contract rejection is missing ${code}`);
  }
  for (const artifact of provenanceContractMissingArtifacts) {
    invariant(missingRequiredArtifacts.includes(artifact),
      `provenance-contract rejection must name ${artifact}`);
  }
  const evidenceKinds = new Set(evidenceArtifacts.map((entry) => entry.kind));
  for (const kind of profile.evidenceKinds) {
    invariant(evidenceKinds.has(kind),
      `provenance-contract rejection is missing ${kind} evidence`);
  }
}

function validateAssessment(value, artifactRoot, sourceArtifactRoot) {
  invariant(new Set([assessmentSchemaV1, assessmentSchema]).has(value.schema),
    "source model preflight assessment schema is unsupported");
  const isV2 = value.schema === assessmentSchema;
  const expectedFields = [
    "schema", "sourceModelId", "sourceRevision", "decision", "decisionAuthority",
    "architectureFamily", "runtimeAdmission", "accessDisposition", "licenseId",
    "licenseDisposition", "distributionDisposition", "blockerCode", "rejectionCodes",
    "missingRequiredArtifacts", "evidenceArtifacts", "officialReferences"
  ];
  if (isV2) expectedFields.push("sourceAcquisitionStatus", "sourceWeightArtifacts");
  requireExactKeys(value, expectedFields, "source model preflight assessment");
  invariant(modelIdPattern.test(String(value.sourceModelId || "")),
    "source model preflight model ID is invalid");
  invariant(revisionPattern.test(String(value.sourceRevision || "")),
    "source model preflight revision is not immutable");
  invariant(value.decision === "rejected",
    "source model preflight records only terminal source-contract rejections");
  invariant(value.decisionAuthority ===
    (isV2 ? "engineering-source-preflight-v2" : "engineering-source-preflight-v1"),
    "source model preflight authority is invalid");
  const architectureFamily = requireCode(value.architectureFamily, "architecture family");
  const runtimeAdmission = requireCode(value.runtimeAdmission, "runtime admission");
  const accessDisposition = requireCode(value.accessDisposition, "access disposition");
  const licenseId = requireCode(value.licenseId, "license ID");
  const licenseDisposition = requireCode(value.licenseDisposition, "license disposition");
  const distributionDisposition = requireCode(
    value.distributionDisposition, "distribution disposition");
  const blockerCode = requireCode(value.blockerCode, "source preflight blocker");
  const rejectionCodes = requireSortedUniqueStrings(
    value.rejectionCodes, "source preflight rejection codes", requireCode);
  invariant(rejectionCodes.length > 0,
    "source model preflight rejection must contain a reason");
  const missingRequiredArtifacts = requireSortedUniqueStrings(
    value.missingRequiredArtifacts,
    "missing source artifacts",
    requireMissingArtifactName
  );
  if (!isV2) {
    invariant(missingRequiredArtifacts.includes("model.safetensors"),
      "v1 assessments cannot attest complete source acquisition");
  }
  const sourceWeights = isV2
    ? inspectSourceWeightArtifacts(
      sourceArtifactRoot,
      String(value.sourceAcquisitionStatus || ""),
      value.sourceWeightArtifacts)
    : inspectSourceWeightArtifacts(undefined, "not-acquired", []);
  if (sourceWeights.acquisitionStatus === "complete") {
    const acquiredNames = new Set(sourceWeights.artifacts.map((entry) => entry.fileName));
    invariant(!missingRequiredArtifacts.some((name) => acquiredNames.has(name)),
      "acquired source weight cannot also be missing");
  } else {
    invariant(missingRequiredArtifacts.includes("model.safetensors"),
      "not-acquired source must name model.safetensors as missing");
  }

  invariant(Array.isArray(value.evidenceArtifacts) && value.evidenceArtifacts.length >= 2 &&
    value.evidenceArtifacts.length <= 16, "preflight evidence artifact list is invalid");
  const evidenceArtifacts = value.evidenceArtifacts.map((entry) =>
    inspectEvidenceArtifact(artifactRoot, entry));
  invariant(new Set(evidenceArtifacts.map((entry) => entry.kind)).size === evidenceArtifacts.length,
    "preflight evidence kinds contain duplicates");
  invariant(new Set(evidenceArtifacts.map((entry) => entry.fileName)).size === evidenceArtifacts.length,
    "preflight evidence file names contain duplicates");
  invariant(canonicalJson(evidenceArtifacts.map((entry) => entry.kind)) ===
    canonicalJson(evidenceArtifacts.map((entry) => entry.kind).sort()),
  "preflight evidence artifacts must be sorted by kind");

  if (blockerCode === policyContractBlocker) {
    invariant(missingRequiredArtifacts.includes("model.safetensors"),
      "policy-contract rejection must name model.safetensors");
    for (const code of policyContractRejectionCodes) {
      invariant(rejectionCodes.includes(code),
        `policy-contract rejection is missing ${code}`);
    }
    const evidenceKinds = new Set(evidenceArtifacts.map((entry) => entry.kind));
    invariant(evidenceKinds.has("model-card"),
      "policy-contract rejection is missing model-card evidence");
    invariant(policyContractRepositoryEvidenceKinds.some((kind) => evidenceKinds.has(kind)),
      "policy-contract rejection is missing repository metadata evidence");
    invariant(policyContractLicenseEvidenceKinds.some((kind) => evidenceKinds.has(kind)),
      "policy-contract rejection is missing license or terms evidence");
    invariant(policyContractUsePolicyEvidenceKinds.some((kind) => evidenceKinds.has(kind)),
      "policy-contract rejection is missing use-policy evidence");
  }

  if (blockerCode === provenanceContractBlocker) {
    invariant(sourceWeights.acquisitionStatus === "not-acquired",
      "provenance-contract rejection must occur before source acquisition");
    validateProvenanceContractRejection(
      rejectionCodes,
      missingRequiredArtifacts,
      evidenceArtifacts
    );
  }

  if (blockerCode === conversationContractBlocker) {
    validateConversationContractRejection(
      rejectionCodes,
      missingRequiredArtifacts,
      evidenceArtifacts
    );
  }

  if (blockerCode === loaderContractBlocker) {
    invariant(missingRequiredArtifacts.includes("model.safetensors"),
      "loader-contract rejection must name model.safetensors");
    for (const code of loaderContractRejectionCodes) {
      invariant(rejectionCodes.includes(code),
        `loader-contract rejection is missing ${code}`);
    }
    const evidenceKinds = new Set(evidenceArtifacts.map((entry) => entry.kind));
    for (const kind of loaderContractEvidenceKinds) {
      invariant(evidenceKinds.has(kind),
        `loader-contract rejection is missing ${kind} evidence`);
    }
  }

  invariant(Array.isArray(value.officialReferences) && value.officialReferences.length > 0 &&
    value.officialReferences.length <= 16, "official references are invalid");
  const officialReferences = value.officialReferences.map((entry) =>
    requireHttpsUrl(entry, "official reference"));
  invariant(new Set(officialReferences).size === officialReferences.length,
    "official references contain duplicates");

  return Object.freeze({
    schema: value.schema,
    sourceModelId: value.sourceModelId,
    sourceRevision: value.sourceRevision,
    decision: value.decision,
    decisionAuthority: value.decisionAuthority,
    architectureFamily,
    runtimeAdmission,
    accessDisposition,
    licenseId,
    licenseDisposition,
    distributionDisposition,
    blockerCode,
    rejectionCodes,
    missingRequiredArtifacts,
    sourceWeights,
    evidenceArtifacts: Object.freeze(evidenceArtifacts),
    officialReferences: Object.freeze(officialReferences)
  });
}

function runtimeIdentifier() {
  const osName = process.platform === "win32"
    ? "win"
    : process.platform === "darwin" ? "osx" : process.platform;
  return `${osName}-${process.arch}`;
}

function recordSourceModelPreflight(options) {
  invariant(isPlainObject(options), "source model preflight options are invalid");
  const startedAtUtc = options.startedAtUtc || new Date().toISOString();
  const completedAtUtc = options.completedAtUtc || new Date().toISOString();
  invariant(Number.isFinite(Date.parse(startedAtUtc)) &&
    Number.isFinite(Date.parse(completedAtUtc)) &&
    Date.parse(completedAtUtc) >= Date.parse(startedAtUtc),
  "source model preflight timing is invalid");
  const assessment = readJson(path.resolve(options.assessmentPath),
    "source model preflight assessment");
  const inspected = validateAssessment(
    assessment.value,
    path.resolve(options.artifactRoot),
    options.sourceArtifactRoot
  );
  const artifactSetSha256 = sha256(canonicalJson(inspected.evidenceArtifacts.map((entry) => ({
    kind: entry.kind,
    byteCount: entry.byteCount,
    sha256: entry.sha256,
    publicUrl: entry.publicUrl,
    observedAtUtc: entry.observedAtUtc
  }))));

  const store = new CampaignEvidenceStore(path.resolve(options.evidenceRoot));
  const rebuilt = store.rebuild();
  invariant(rebuilt.quarantined.length === 0 &&
    fs.readdirSync(store.quarantinePath, { withFileTypes: true }).every((entry) => !entry.isFile()),
  "source model preflight evidence store contains quarantined files");
  const toolHash = sha256File(__filename, maximumJsonBytes).sha256;
  const matching = store.listReceipts((receipt) => receipt.receiptType === receiptType &&
    receipt.campaignId === options.campaignId &&
    receipt.outputHashes.assessment === assessment.artifact.sha256 &&
    receipt.inputHashes.evidenceSet === artifactSetSha256 &&
    (inspected.sourceWeights.modelSha256 === null
      ? receipt.inputHashes.sourceModel === undefined
      : receipt.inputHashes.sourceModel === inspected.sourceWeights.modelSha256) &&
    (inspected.sourceWeights.artifactSetSha256 === null
      ? receipt.inputHashes.sourceWeightSet === undefined
      : receipt.inputHashes.sourceWeightSet === inspected.sourceWeights.artifactSetSha256) &&
    receipt.toolVersions[0] === toolVersion && receipt.toolBinaryHashes[0] === toolHash);
  if (matching.length > 0) {
    invariant(matching.length === 1, "source model preflight receipt is duplicated");
    return Object.freeze({ inspection: inspected, receipt: matching[0] });
  }

  const prior = store.listReceipts((receipt) => receipt.receiptType === receiptType &&
    receipt.campaignId === options.campaignId &&
    receipt.publicSafeParameters.modelId === inspected.sourceModelId);
  const attempt = prior.reduce((maximum, receipt) => Math.max(maximum, receipt.attempt), 0) + 1;
  const previous = [...prior].sort((left, right) => left.attempt - right.attempt).at(-1) || null;
  const evidenceHashes = Object.fromEntries(inspected.evidenceArtifacts.map((entry) =>
    [entry.kind, entry.sha256]));
  const sourceWeightHashes = Object.fromEntries(inspected.sourceWeights.artifacts.map(
    (entry, index) => [`sourceWeight.${String(index).padStart(3, "0")}`, entry.sha256]));
  const sourceIdentityHashes = inspected.sourceWeights.modelSha256 === null
    ? {}
    : {
      sourceModel: inspected.sourceWeights.modelSha256,
      sourceWeightSet: inspected.sourceWeights.artifactSetSha256,
      ...sourceWeightHashes
    };
  const receipt = store.putReceipt({
    receiptType,
    campaignId: options.campaignId,
    phase: "model-source-review",
    attempt,
    status: "rejected",
    createdAtUtc: startedAtUtc,
    completedAtUtc,
    inputReceiptIds: [],
    inputHashes: {
      ...evidenceHashes,
      evidenceSet: artifactSetSha256,
      ...sourceIdentityHashes
    },
    outputHashes: { assessment: assessment.artifact.sha256 },
    sourceRevision: inspected.sourceRevision,
    toolNames: ["tinyrustlm-source-model-preflight-evidence"],
    toolVersions: [toolVersion],
    toolBinaryHashes: [toolHash],
    runtimeIdentifier: runtimeIdentifier(),
    operatingSystem: process.platform,
    architecture: process.arch,
    hardwareEvidence: {
      executionBoundary: inspected.sourceWeights.acquisitionStatus === "complete"
        ? "public-metadata-and-private-source-identity-review"
        : "public-source-metadata-review",
      physicalHardwareAttested: false
    },
    configurationHash: sha256(canonicalJson({
      assessmentSchema: inspected.schema,
      artifactSetSha256,
      sourceWeightSetSha256: inspected.sourceWeights.artifactSetSha256,
      toolVersion
    })),
    publicSafeParameters: {
      modelId: inspected.sourceModelId,
      sourceModelId: inspected.sourceModelId,
      decision: inspected.decision,
      decisionAuthority: inspected.decisionAuthority,
      architectureFamily: inspected.architectureFamily,
      runtimeAdmission: inspected.runtimeAdmission,
      accessDisposition: inspected.accessDisposition,
      licenseId: inspected.licenseId,
      licenseDisposition: inspected.licenseDisposition,
      distributionDisposition: inspected.distributionDisposition,
      sourceAcquisitionStatus: inspected.sourceWeights.acquisitionStatus,
      sourceAcquisitionComplete: inspected.sourceWeights.acquisitionStatus === "complete",
      sourceModelIdentityKind: inspected.sourceWeights.identityKind,
      sourceWeightArtifactCount: inspected.sourceWeights.artifacts.length,
      sourceWeightByteCount: inspected.sourceWeights.byteCount,
      evidenceArtifactCount: inspected.evidenceArtifacts.length,
      missingRequiredArtifactCount: inspected.missingRequiredArtifacts.length,
      rejectionCodeCount: inspected.rejectionCodes.length
    },
    boundedDiagnostics: {
      rejectionCodes: inspected.rejectionCodes,
      missingRequiredArtifacts: inspected.missingRequiredArtifacts,
      evidenceByteCount: inspected.evidenceArtifacts.reduce(
        (total, entry) => total + entry.byteCount, 0),
      sourceWeightArtifactCount: inspected.sourceWeights.artifacts.length,
      sourceWeightByteCount: inspected.sourceWeights.byteCount
    },
    blockerCode: inspected.blockerCode,
    externalEvidenceReferences: inspected.officialReferences,
    redactionVersion: "tinyrustlm.public-receipt-redaction.v1",
    evidenceClass: "local",
    supersedesReceiptIds: previous ? [previous.receiptId] : [],
    attestationReference: null
  }).receipt;
  return Object.freeze({ inspection: inspected, receipt });
}

if (require.main === module) {
  const [evidenceRoot, campaignId, assessmentPath, artifactRoot, sourceArtifactRoot] =
    process.argv.slice(2);
  invariant(Boolean(evidenceRoot && campaignId && assessmentPath && artifactRoot),
    "usage: node source-model-preflight-evidence.js <evidence-root> <campaign-id> <assessment> <artifact-root> [source-artifact-root]");
  const result = recordSourceModelPreflight({
    evidenceRoot,
    campaignId,
    assessmentPath,
    artifactRoot,
    sourceArtifactRoot
  });
  process.stdout.write(`${JSON.stringify({
    receiptId: result.receipt.receiptId,
    status: result.receipt.status,
    modelId: result.receipt.publicSafeParameters.modelId,
    rejectionCodes: result.receipt.boundedDiagnostics.rejectionCodes
  })}\n`);
}

module.exports = Object.freeze({
  assessmentSchema,
  assessmentSchemaV1,
  receiptType,
  recordSourceModelPreflight,
  validateAssessment
});
