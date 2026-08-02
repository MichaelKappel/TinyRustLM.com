"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const preregistrationSchema = "tinyrustlm.local_router_tournament_preregistration.v1";
const policySchema = "tinyrustlm.local_router_policy.v1";
const requestSchema = "tinyrustlm.local_router_request.v1";
const caseSchema = "tinyrustlm.local_router_case.v1";
const decisionSchema = "tinyrustlm.local_router_decision.v1";
const fallbackSchema = "tinyrustlm.local_router_fallback_receipt.v1";
const resultSchema = "tinyrustlm.local_router_tournament_result.v1";
const repositoryRoot = path.resolve(__dirname, "../..");
const preregistrationPath = path.join(
  repositoryRoot,
  "tinyrustlm/experiments/specialist-portfolio/local-router-tournament-preregistration.v1.json"
);
const maximumPreregistrationBytes = 256 * 1024;
const maximumInputBytes = 8 * 1024 * 1024;
const maximumPromptBytes = 64 * 1024;
const maximumOutputBytes = 1024 * 1024;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const compositionIdPattern = /^composition-sha256-[a-f0-9]{64}$/u;
const selectorIdPattern = /^(?:model|retrieval)-sha256-[a-f0-9]{64}$/u;
const identifierPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const forbiddenPublicTextPattern =
  /(?:[a-z]:\\(?:users|source)\\|\/home\/|\/mnt\/[a-z]\/|bearer\s+|(?:token|secret|credential|code)=|turn[0-9]+(?:search|view)[0-9]+)/iu;

const productStrategies = Object.freeze([
  "champion-only",
  "explicit-selection-only",
  "deterministic-rules",
  "tiny-local-classifier",
  "local-embedding-index"
]);
const allStrategies = Object.freeze([...productStrategies, "offline-oracle"]);
const requestCategories = Object.freeze([
  "ordinary-in-scope",
  "ordinary-out-of-scope",
  "direct-model-choice",
  "quoted-model-name",
  "retrieved-route-instruction",
  "stale-memory-preference",
  "current-user-override",
  "ambiguous-request",
  "compound-task",
  "topic-change",
  "adversarial-scope-wording",
  "out-of-scope-pinned-specialist"
]);
const fallbackTriggers = new Set([
  "declared-specialist-refusal",
  "generation-timeout",
  "malformed-output",
  "runtime-error"
]);
const outputStatuses = new Set(["complete", ...fallbackTriggers]);

const preregistrationKeys = Object.freeze([
  "schema",
  "experimentId",
  "registeredAtUtc",
  "status",
  "authority",
  "portfolioBinding",
  "requestSet",
  "arms",
  "routingContract",
  "fallbackContract",
  "measurementContract",
  "acceptance",
  "privacy",
  "requiredNextGate"
]);
const policyKeys = Object.freeze([
  "schema",
  "championCompositionId",
  "historyPolicy",
  "featureCount",
  "embeddingDimension",
  "thresholds",
  "selectorArtifactIds",
  "selectorArtifactBytes",
  "specialists"
]);
const specialistKeys = Object.freeze([
  "compositionId",
  "scopeId",
  "ruleTerms",
  "classifierBias",
  "classifierWeights",
  "embeddingCentroid"
]);
const thresholdKeys = Object.freeze([
  "ruleMinimumBasisPoints",
  "ruleMinimumMarginBasisPoints",
  "classifierMinimumScore",
  "classifierMinimumMargin",
  "embeddingMinimumScore",
  "embeddingMinimumMargin"
]);
const requestKeys = Object.freeze([
  "schema",
  "caseId",
  "rawPrompt",
  "currentUserText",
  "quotedText",
  "retrievedText",
  "staleMemoryText",
  "currentSelectionId",
  "rememberedSelectionId",
  "previousRouteId",
  "directFeatureInputSha256",
  "queryEmbeddingInputSha256",
  "directFeatures",
  "queryEmbedding"
]);
const caseKeys = Object.freeze([
  "schema",
  "caseId",
  "generatorVersion",
  "materializationSeedCommitmentSha256",
  "category",
  "caseOrdinal",
  "request",
  "expectedCompositionId",
  "acceptableCompositionIds",
  "wrongRouteCost",
  "critical",
  "measurements"
]);
const measurementKeys = Object.freeze([
  "routeLatencyNanoseconds",
  "switchLatencyNanoseconds",
  "peakAdditionalBytes",
  "qualityScoreBasisPoints",
  "initialRawOutputSha256",
  "initialRawOutputBytes",
  "initialOutputStatus",
  "fallbackReceipt"
]);
const fallbackBodyKeys = Object.freeze([
  "schema",
  "trigger",
  "initialCompositionId",
  "championCompositionId",
  "firstRawOutputSha256",
  "firstRawOutputBytes",
  "fallbackRawOutputSha256",
  "fallbackRawOutputBytes",
  "visibleStatus",
  "firstRawAttemptRetained",
  "specialistOutputRole",
  "hiddenBestOfN",
  "fallbackSelectionByAnswerQuality"
]);
const fallbackKeys = Object.freeze([...fallbackBodyKeys, "receiptSha256"]);

/** Throws a stable validation error when `condition` is false. */
function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

/** Returns whether `value` is a non-array JSON object. */
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Requires exactly the declared keys, rejecting silent schema growth. */
function exactKeys(value, keys, label) {
  invariant(isPlainObject(value), `${label} must be a JSON object`);
  const actual = Object.keys(value).sort();
  const expected = Array.from(keys).sort();
  invariant(JSON.stringify(actual) === JSON.stringify(expected), `${label} fields are invalid`);
}

/** Requires exact array membership and ordering. */
function exactArray(value, expected, message) {
  invariant(Array.isArray(value) && JSON.stringify(value) === JSON.stringify(expected), message);
}

/** Requires one bounded, trimmed string. */
function requiredString(value, label, maximum = 2048) {
  invariant(typeof value === "string" && value.length > 0 && value.length <= maximum,
    `${label} must be a nonempty bounded string`);
  invariant(value.trim() === value, `${label} must not have surrounding whitespace`);
  return value;
}

/** Requires one exact Boolean. */
function requiredBoolean(value, expected, message) {
  invariant(value === expected, message);
  return value;
}

/** Requires one safe integer in an inclusive range. */
function requiredInteger(value, minimum, maximum, label) {
  invariant(Number.isSafeInteger(value) && value >= minimum && value <= maximum,
    `${label} is outside its integer bounds`);
  return value;
}

/** Requires a lowercase identifier. */
function requiredIdentifier(value, label) {
  const text = requiredString(value, label, 128);
  invariant(identifierPattern.test(text), `${label} is not a lowercase identifier`);
  return text;
}

/** Requires a complete lowercase SHA-256. */
function requiredSha256(value, label) {
  const text = requiredString(value, label, 64);
  invariant(sha256Pattern.test(text) && !/^0{64}$/u.test(text), `${label} is not a SHA-256`);
  return text;
}

/** Requires one exact composition identity. */
function requiredCompositionId(value, label) {
  const text = requiredString(value, label, 96);
  invariant(compositionIdPattern.test(text), `${label} is not a composition identity`);
  return text;
}

/** Requires null or one exact composition identity. */
function optionalCompositionId(value, label) {
  return value === null ? null : requiredCompositionId(value, label);
}

/** Requires a canonical UTC timestamp. */
function requiredUtc(value, label) {
  const text = requiredString(value, label, 64);
  invariant(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(text)
    && Number.isFinite(Date.parse(text)), `${label} is not canonical UTC`);
  return text;
}

/** Returns canonical pretty-printed JSON bytes. */
function canonicalJsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

/** Returns lowercase SHA-256 for bytes. */
function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/** Validates the frozen no-authority router tournament preregistration. */
function validatePreregistration(value) {
  exactKeys(value, preregistrationKeys, "preregistration");
  invariant(value.schema === preregistrationSchema, "preregistration schema is unsupported");
  invariant(value.experimentId === "champion-specialist-router-tournament-20260726",
    "experiment identity is invalid");
  requiredUtc(value.registeredAtUtc, "registeredAtUtc");
  invariant(value.status === "preregistered-before-results", "preregistration status is invalid");

  exactKeys(value.authority, [
    "productAuthority",
    "trainingAuthority",
    "releaseAuthority",
    "modelQualityAuthority",
    "oracleProductUseAllowed"
  ], "authority");
  for (const key of Object.keys(value.authority)) {
    requiredBoolean(value.authority[key], false, `${key} must remain false`);
  }

  invariant(JSON.stringify(value.portfolioBinding) === JSON.stringify({
    identityResolution: "deferred-until-qualified-portfolio-plan",
    championRequirement: "one-exact-qualified-base-only-composition-identity",
    specialistRequirement: "one-or-more-exact-qualified-specialist-composition-identities",
    qualityReceiptRequirement:
      "every-routable-composition-must-have-an-exact-current-quality-receipt",
    routePolicyIdentity:
      "domain-separated-route-policy-identity-over-canonical-policy-bytes-and-sorted-artifact-identities",
    mutableAliasesInIdentity: false
  }), "portfolio binding is invalid");

  exactKeys(value.requestSet, [
    "visibility",
    "materializationTiming",
    "generatorVersion",
    "totalCaseCount",
    "casesPerCategory",
    "categories",
    "caseIdentityFields",
    "easySeedSelectionAllowed",
    "trainingOrTeacherAccessAllowed"
  ], "requestSet");
  invariant(value.requestSet.visibility === "sealed-private-bodies-public-hashes-only",
    "request visibility is invalid");
  invariant(value.requestSet.materializationTiming === "before-any-candidate-router-result",
    "request materialization timing is invalid");
  invariant(value.requestSet.generatorVersion === "tinyrustlm.local-router-case-generator.v1",
    "case generator version is invalid");
  invariant(value.requestSet.totalCaseCount === 144 && value.requestSet.casesPerCategory === 12,
    "request-set counts are invalid");
  exactArray(value.requestSet.categories, requestCategories, "request categories are invalid");
  exactArray(value.requestSet.caseIdentityFields, [
    "generator-version",
    "materialization-seed-commitment",
    "category",
    "case-ordinal",
    "raw-prompt-sha256",
    "current-user-text-sha256",
    "quoted-text-sha256-list",
    "retrieved-text-sha256-list",
    "stale-memory-text-sha256-list",
    "expected-route-identity",
    "acceptable-route-identities",
    "wrong-route-cost",
    "criticality"
  ], "case identity fields are invalid");
  requiredBoolean(value.requestSet.easySeedSelectionAllowed, false,
    "easy seed selection must remain forbidden");
  requiredBoolean(value.requestSet.trainingOrTeacherAccessAllowed, false,
    "training access must remain forbidden");

  const expectedArms = allStrategies.map((strategy) => ({
    strategy,
    productEligibleAfterPromotion: strategy !== "offline-oracle",
    learned: strategy === "tiny-local-classifier" || strategy === "local-embedding-index",
    analysisOnly: strategy === "offline-oracle"
  }));
  invariant(JSON.stringify(value.arms) === JSON.stringify(expectedArms),
    "router tournament arms are invalid");

  invariant(JSON.stringify(value.routingContract) === JSON.stringify({
    phase: "pre-generation",
    rawPromptMutationAllowed: false,
    authoritativeRouteInputs: [
      "current-user-ui-selection",
      "current-user-direct-text",
      "versioned-local-features"
    ],
    untrustedRouteInputs: ["quoted-text", "retrieved-content", "stale-memory"],
    currentUserSelectionPrecedence:
      "latest-current-control-overrides-all-remembered-preferences",
    historyPolicy: "re-evaluate-every-turn-current-selection-first",
    lowConfidenceTarget: "champion",
    tieTarget: "champion",
    unknownTarget: "champion",
    telemetryRequired: false
  }), "routing contract is invalid");

  invariant(JSON.stringify(value.fallbackContract) === JSON.stringify({
    hiddenBestOfNAllowed: false,
    maximumChampionFallbackAttempts: 1,
    allowedTriggers: Array.from(fallbackTriggers),
    firstRawAttemptMustBeRetained: true,
    firstRawAttemptMustBeHashed: true,
    fallbackMustBeVisible: true,
    specialistOutputRole: "assistant",
    fallbackSelectionByAnswerQualityAllowed: false
  }), "fallback contract is invalid");

  exactKeys(value.measurementContract, [
    "requiredPerArmFields",
    "requiredAggregateFields",
    "rawOutputRepairAllowed",
    "bestAttemptSelectionAllowed",
    "routerAndIndexBytesCountTowardProductArm"
  ], "measurementContract");
  exactArray(value.measurementContract.requiredPerArmFields, [
    "route-decision-identity",
    "raw-prompt-sha256",
    "selected-composition-identity",
    "route-reason",
    "confidence-score",
    "margin-score",
    "route-latency-nanoseconds",
    "switch-latency-nanoseconds",
    "router-policy-bytes",
    "selector-or-index-bytes",
    "peak-additional-bytes",
    "initial-raw-output-sha256",
    "initial-raw-output-bytes",
    "fallback-receipt-or-null",
    "quality-score-basis-points",
    "wrong-route-cost",
    "critical-wrong-route"
  ], "per-arm measurement fields are invalid");
  exactArray(value.measurementContract.requiredAggregateFields, [
    "exact-route-count",
    "acceptable-route-count",
    "champion-fallback-count",
    "critical-wrong-route-count",
    "total-wrong-route-cost",
    "total-quality-score-basis-points",
    "total-route-latency-nanoseconds",
    "total-switch-latency-nanoseconds",
    "maximum-peak-additional-bytes",
    "router-policy-bytes",
    "selector-or-index-bytes"
  ], "aggregate measurement fields are invalid");
  requiredBoolean(value.measurementContract.rawOutputRepairAllowed, false,
    "raw-output repair must remain forbidden");
  requiredBoolean(value.measurementContract.bestAttemptSelectionAllowed, false,
    "best-attempt selection must remain forbidden");
  requiredBoolean(value.measurementContract.routerAndIndexBytesCountTowardProductArm, true,
    "router and index bytes must count");

  invariant(JSON.stringify(value.acceptance) === JSON.stringify({
    criticalWrongRouteMaximum: 0,
    lowConfidenceChampionFallbackRateRequired: 1,
    quotedRetrievedAndStaleMemoryAuthorityViolationsMaximum: 0,
    deterministicReplayRequired: true,
    nativeAndWasmDecisionParityRequired: true,
    broadHelpfulnessNoninferiorityMargin: -0.02,
    pairedConfidenceLevel: 0.95,
    selectedArmObjectiveLowerBoundMustExceedChampion: 0,
    routerLatencyBudgetMustBeFrozenBeforeResults: true,
    routerMemoryBudgetMustBeFrozenBeforeResults: true,
    promotionFromRoutingAccuracyAloneAllowed: false,
    productIntegrationAllowed: false
  }), "acceptance contract is invalid");

  invariant(JSON.stringify(value.privacy) === JSON.stringify({
    executionLocation: "local-only",
    centralTelemetryAllowed: false,
    publicRawPromptsAllowed: false,
    publicRawOutputsAllowed: false,
    publicReceiptsContainHashesAndBoundedMetricsOnly: true,
    credentialsOrEnrollmentUrlsAllowed: false,
    retrievedContentAuthority: "untrusted-data-only"
  }), "privacy contract is invalid");
  requiredString(value.requiredNextGate, "requiredNextGate", 1024);
  invariant(!forbiddenPublicTextPattern.test(JSON.stringify(value)),
    "preregistration contains private or credential-like text");
  return value;
}

/** Reads and validates the canonical checked-in preregistration. */
function validatePreregistrationFile(filePath = preregistrationPath) {
  const metadata = fs.lstatSync(filePath);
  invariant(metadata.isFile() && !metadata.isSymbolicLink(),
    "preregistration must be a regular non-symlink file");
  invariant(metadata.size > 0 && metadata.size <= maximumPreregistrationBytes,
    "preregistration size is invalid");
  const bytes = fs.readFileSync(filePath);
  const value = validatePreregistration(JSON.parse(bytes.toString("utf8")));
  invariant(bytes.equals(canonicalJsonBytes(value)), "preregistration bytes are not canonical");
  return Object.freeze({ preregistration: value, bytes: bytes.length, sha256: sha256(bytes) });
}

/** Returns one normalized rule term. */
function normalizeRuleTerm(value, label) {
  const normalized = requiredString(value, label, 64)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .trim();
  invariant(/^[\p{L}\p{N}]+(?:[ -][\p{L}\p{N}]+)*$/u.test(normalized),
    `${label} contains unsupported rule characters`);
  invariant(value === normalized, `${label} is not canonically normalized`);
  return normalized;
}

/** Validates one frozen local route policy. */
function validatePolicy(value) {
  exactKeys(value, policyKeys, "policy");
  invariant(value.schema === policySchema, "policy schema is unsupported");
  const championCompositionId =
    requiredCompositionId(value.championCompositionId, "policy.championCompositionId");
  invariant(value.historyPolicy === "re-evaluate-every-turn-current-selection-first",
    "policy history is unsupported");
  const featureCount = requiredInteger(value.featureCount, 1, 256, "policy.featureCount");
  const embeddingDimension =
    requiredInteger(value.embeddingDimension, 1, 256, "policy.embeddingDimension");
  exactKeys(value.thresholds, thresholdKeys, "policy.thresholds");
  const thresholds = Object.freeze({
    ruleMinimumBasisPoints: requiredInteger(
      value.thresholds.ruleMinimumBasisPoints, 1, 10000,
      "policy.thresholds.ruleMinimumBasisPoints"
    ),
    ruleMinimumMarginBasisPoints: requiredInteger(
      value.thresholds.ruleMinimumMarginBasisPoints, 1, 10000,
      "policy.thresholds.ruleMinimumMarginBasisPoints"
    ),
    classifierMinimumScore: requiredInteger(
      value.thresholds.classifierMinimumScore, -2147483648, 2147483647,
      "policy.thresholds.classifierMinimumScore"
    ),
    classifierMinimumMargin: requiredInteger(
      value.thresholds.classifierMinimumMargin, 1, 2147483647,
      "policy.thresholds.classifierMinimumMargin"
    ),
    embeddingMinimumScore: requiredInteger(
      value.thresholds.embeddingMinimumScore, -2147483648, 2147483647,
      "policy.thresholds.embeddingMinimumScore"
    ),
    embeddingMinimumMargin: requiredInteger(
      value.thresholds.embeddingMinimumMargin, 1, 2147483647,
      "policy.thresholds.embeddingMinimumMargin"
    )
  });

  invariant(Array.isArray(value.selectorArtifactIds) && value.selectorArtifactIds.length <= 64,
    "policy.selectorArtifactIds is invalid");
  const selectorArtifactIds = value.selectorArtifactIds.map((entry, index) => {
    const id = requiredString(entry, `policy.selectorArtifactIds[${index}]`, 96);
    invariant(selectorIdPattern.test(id), `policy.selectorArtifactIds[${index}] is invalid`);
    return id;
  });
  invariant(new Set(selectorArtifactIds).size === selectorArtifactIds.length
    && JSON.stringify(selectorArtifactIds) === JSON.stringify(Array.from(selectorArtifactIds).sort()),
  "policy selector artifact identities must be sorted and unique");
  const selectorArtifactBytes = requiredInteger(
    value.selectorArtifactBytes, 0, Number.MAX_SAFE_INTEGER,
    "policy.selectorArtifactBytes"
  );
  invariant((selectorArtifactIds.length === 0) === (selectorArtifactBytes === 0),
    "policy selector artifact bytes do not match its identities");

  invariant(Array.isArray(value.specialists)
    && value.specialists.length > 0
    && value.specialists.length <= 64, "policy.specialists is invalid");
  const specialists = value.specialists.map((entry, index) => {
    const label = `policy.specialists[${index}]`;
    exactKeys(entry, specialistKeys, label);
    const compositionId = requiredCompositionId(entry.compositionId, `${label}.compositionId`);
    invariant(compositionId !== championCompositionId, `${label} cannot be the champion`);
    const scopeId = requiredIdentifier(entry.scopeId, `${label}.scopeId`);
    invariant(Array.isArray(entry.ruleTerms)
      && entry.ruleTerms.length > 0
      && entry.ruleTerms.length <= 64, `${label}.ruleTerms is invalid`);
    const ruleTerms = entry.ruleTerms.map((term, termIndex) =>
      normalizeRuleTerm(term, `${label}.ruleTerms[${termIndex}]`));
    invariant(new Set(ruleTerms).size === ruleTerms.length
      && JSON.stringify(ruleTerms) === JSON.stringify(Array.from(ruleTerms).sort()),
    `${label}.ruleTerms must be sorted and unique`);
    const classifierBias =
      requiredInteger(entry.classifierBias, -2147483648, 2147483647, `${label}.classifierBias`);
    invariant(Array.isArray(entry.classifierWeights)
      && entry.classifierWeights.length === featureCount,
    `${label}.classifierWeights length is invalid`);
    const classifierWeights = entry.classifierWeights.map((weight, weightIndex) =>
      requiredInteger(weight, -32768, 32767, `${label}.classifierWeights[${weightIndex}]`));
    invariant(Array.isArray(entry.embeddingCentroid)
      && entry.embeddingCentroid.length === embeddingDimension,
    `${label}.embeddingCentroid length is invalid`);
    const embeddingCentroid = entry.embeddingCentroid.map((coordinate, coordinateIndex) =>
      requiredInteger(coordinate, -32768, 32767,
        `${label}.embeddingCentroid[${coordinateIndex}]`));
    return Object.freeze({
      compositionId,
      scopeId,
      ruleTerms: Object.freeze(ruleTerms),
      classifierBias,
      classifierWeights: Object.freeze(classifierWeights),
      embeddingCentroid: Object.freeze(embeddingCentroid)
    });
  });
  const specialistIds = specialists.map((entry) => entry.compositionId);
  const scopeIds = specialists.map((entry) => entry.scopeId);
  invariant(new Set(specialistIds).size === specialistIds.length
    && JSON.stringify(specialistIds) === JSON.stringify(Array.from(specialistIds).sort()),
  "policy specialist identities must be sorted and unique");
  invariant(new Set(scopeIds).size === scopeIds.length, "policy specialist scopes must be unique");

  return Object.freeze({
    schema: policySchema,
    championCompositionId,
    historyPolicy: value.historyPolicy,
    featureCount,
    embeddingDimension,
    thresholds,
    selectorArtifactIds: Object.freeze(selectorArtifactIds),
    selectorArtifactBytes,
    specialists: Object.freeze(specialists)
  });
}

/** Returns the canonical policy bytes that enter route-policy identity. */
function canonicalPolicyBytes(value) {
  return canonicalJsonBytes(validatePolicy(value));
}

/** Parses one typed identity into its one-byte tag and digest bytes. */
function typedIdentityBytes(value) {
  const kinds = [
    ["model-sha256-", 1],
    ["composition-sha256-", 3],
    ["retrieval-sha256-", 7]
  ];
  const match = kinds.find(([prefix]) => value.startsWith(prefix));
  invariant(match !== undefined, "typed identity kind is unsupported");
  const hex = value.slice(match[0].length);
  invariant(sha256Pattern.test(hex) && !/^0{64}$/u.test(hex), "typed identity digest is invalid");
  return Buffer.concat([Buffer.from([match[1]]), Buffer.from(hex, "hex")]);
}

/** Derives a route-policy id from the exact frozen Rust identity inputs. */
function deriveRoutePolicyId(
  policyBytes,
  policySha256,
  championCompositionId,
  specialistCompositionIds,
  selectorArtifactIds
) {
  requiredInteger(policyBytes, 1, Number.MAX_SAFE_INTEGER, "route policy bytes");
  const policyDigest = Buffer.from(requiredSha256(policySha256, "route policy SHA-256"), "hex");
  requiredCompositionId(championCompositionId, "route policy champion identity");
  invariant(Array.isArray(specialistCompositionIds)
    && specialistCompositionIds.length > 0
    && specialistCompositionIds.length <= 1024,
  "route policy specialist identities are invalid");
  const specialists = specialistCompositionIds.map((entry, index) =>
    requiredCompositionId(entry, `route policy specialist identities[${index}]`));
  invariant(new Set(specialists).size === specialists.length
    && JSON.stringify(specialists) === JSON.stringify(Array.from(specialists).sort()),
  "route policy specialist identities must be sorted and unique");
  invariant(Array.isArray(selectorArtifactIds) && selectorArtifactIds.length <= 1024,
    "route policy selector identities are invalid");
  const selectors = selectorArtifactIds.map((entry, index) => {
    const id = requiredString(entry, `route policy selector identities[${index}]`, 96);
    invariant(selectorIdPattern.test(id), `route policy selector identities[${index}] is invalid`);
    return id;
  });
  invariant(new Set(selectors).size === selectors.length
    && JSON.stringify(selectors) === JSON.stringify(Array.from(selectors).sort()),
  "route policy selector identities must be sorted and unique");
  const domain = Buffer.from("tinyrustlm.content.route-policy.v1\0", "utf8");
  const version = Buffer.alloc(4);
  version.writeUInt32LE(1);
  const byteCount = Buffer.alloc(8);
  byteCount.writeBigUInt64LE(BigInt(policyBytes));
  const specialistCount = Buffer.alloc(4);
  specialistCount.writeUInt32LE(specialists.length);
  const selectorCount = Buffer.alloc(4);
  selectorCount.writeUInt32LE(selectors.length);
  const material = [
    domain,
    version,
    byteCount,
    policyDigest,
    typedIdentityBytes(championCompositionId),
    specialistCount,
    ...specialists.map(typedIdentityBytes),
    selectorCount,
    ...selectors.map(typedIdentityBytes)
  ];
  return `route-sha256-${sha256(Buffer.concat(material))}`;
}

/** Derives the Rust-compatible identity for one complete canonical policy. */
function routePolicyIdentity(value) {
  const policy = validatePolicy(value);
  const bytes = canonicalJsonBytes(policy);
  const policySha256 = sha256(bytes);
  const id = deriveRoutePolicyId(
    bytes.length,
    policySha256,
    policy.championCompositionId,
    policy.specialists.map((entry) => entry.compositionId),
    policy.selectorArtifactIds
  );
  return Object.freeze({
    id,
    policy,
    policyBytes: bytes.length,
    policySha256
  });
}

/** Requires a bounded list of strings embedded exactly in the raw prompt. */
function validatePromptSegments(values, rawPrompt, label) {
  invariant(Array.isArray(values) && values.length <= 16, `${label} is invalid`);
  return Object.freeze(values.map((entry, index) => {
    const text = requiredString(entry, `${label}[${index}]`, 8192);
    invariant(rawPrompt.includes(text), `${label}[${index}] is absent from the raw prompt`);
    return text;
  }));
}

/** Validates one provenance-separated local routing request. */
function validateRequest(value, policyValue) {
  const policy = validatePolicy(policyValue);
  exactKeys(value, requestKeys, "request");
  invariant(value.schema === requestSchema, "request schema is unsupported");
  const caseId = requiredIdentifier(value.caseId, "request.caseId");
  const rawPrompt = requiredString(value.rawPrompt, "request.rawPrompt", maximumPromptBytes);
  invariant(Buffer.byteLength(rawPrompt, "utf8") <= maximumPromptBytes,
    "request.rawPrompt byte length is invalid");
  invariant(!forbiddenPublicTextPattern.test(rawPrompt),
    "request.rawPrompt contains private or credential-like text");
  const currentUserText =
    requiredString(value.currentUserText, "request.currentUserText", 16384);
  invariant(rawPrompt.includes(currentUserText), "current user text is absent from the raw prompt");
  const quotedText = validatePromptSegments(value.quotedText, rawPrompt, "request.quotedText");
  const retrievedText =
    validatePromptSegments(value.retrievedText, rawPrompt, "request.retrievedText");
  const staleMemoryText =
    validatePromptSegments(value.staleMemoryText, rawPrompt, "request.staleMemoryText");
  const knownIds = new Set([
    policy.championCompositionId,
    ...policy.specialists.map((entry) => entry.compositionId)
  ]);
  const validateKnownOptional = (entry, label) => {
    const id = optionalCompositionId(entry, label);
    invariant(id === null || knownIds.has(id), `${label} is not a policy composition`);
    return id;
  };
  const currentSelectionId =
    validateKnownOptional(value.currentSelectionId, "request.currentSelectionId");
  const rememberedSelectionId =
    validateKnownOptional(value.rememberedSelectionId, "request.rememberedSelectionId");
  const previousRouteId = validateKnownOptional(value.previousRouteId, "request.previousRouteId");
  const currentUserSha256 = sha256(Buffer.from(currentUserText, "utf8"));
  invariant(
    requiredSha256(value.directFeatureInputSha256, "request.directFeatureInputSha256")
      === currentUserSha256,
    "request direct features are not bound to current direct-user text"
  );
  invariant(
    requiredSha256(value.queryEmbeddingInputSha256, "request.queryEmbeddingInputSha256")
      === currentUserSha256,
    "request query embedding is not bound to current direct-user text"
  );
  invariant(Array.isArray(value.directFeatures)
    && value.directFeatures.length === policy.featureCount,
  "request.directFeatures length is invalid");
  const directFeatures = value.directFeatures.map((feature, index) =>
    requiredInteger(feature, -32768, 32767, `request.directFeatures[${index}]`));
  invariant(Array.isArray(value.queryEmbedding)
    && value.queryEmbedding.length === policy.embeddingDimension,
  "request.queryEmbedding length is invalid");
  const queryEmbedding = value.queryEmbedding.map((coordinate, index) =>
    requiredInteger(coordinate, -32768, 32767, `request.queryEmbedding[${index}]`));
  return Object.freeze({
    schema: requestSchema,
    caseId,
    rawPrompt,
    currentUserText,
    quotedText,
    retrievedText,
    staleMemoryText,
    currentSelectionId,
    rememberedSelectionId,
    previousRouteId,
    directFeatureInputSha256: currentUserSha256,
    queryEmbeddingInputSha256: currentUserSha256,
    directFeatures: Object.freeze(directFeatures),
    queryEmbedding: Object.freeze(queryEmbedding)
  });
}

/** Normalizes only direct current-user text for deterministic rule matching. */
function normalizedDirectText(text) {
  return ` ${text.normalize("NFKC").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()} `;
}

/** Returns a decision with a content hash over every public-safe field. */
function buildDecision(body) {
  const decisionSha256 = sha256(canonicalJsonBytes(body));
  return Object.freeze({ ...body, decisionSha256 });
}

/** Returns the latest explicit trusted selection or null. */
function explicitSelection(policy, request) {
  if (request.currentSelectionId === null) return null;
  return {
    selectedCompositionId: request.currentSelectionId,
    routeReason: request.currentSelectionId === policy.championCompositionId
      ? "current-user-selected-champion"
      : "current-user-selected-specialist",
    confidenceScore: 10000,
    marginScore: 10000,
    currentSelectionApplied: true
  };
}

/** Selects the unique high-confidence top score or the champion. */
function scoreDecision(policy, scored, minimumScore, minimumMargin, reason) {
  const ordered = Array.from(scored).sort((left, right) =>
    right.score - left.score || left.compositionId.localeCompare(right.compositionId));
  const top = ordered[0];
  const secondScore = ordered.length > 1 ? ordered[1].score : 0;
  const margin = top.score - secondScore;
  if (top.score < minimumScore || margin < minimumMargin) {
    return {
      selectedCompositionId: policy.championCompositionId,
      routeReason: top.score < minimumScore ? "low-confidence-champion" : "ambiguous-tie-champion",
      confidenceScore: top.score,
      marginScore: margin,
      currentSelectionApplied: false
    };
  }
  return {
    selectedCompositionId: top.compositionId,
    routeReason: reason,
    confidenceScore: top.score,
    marginScore: margin,
    currentSelectionApplied: false
  };
}

/** Routes one request before generation using one declared product arm. */
function routeRequest(policyValue, requestValue, strategy) {
  invariant(productStrategies.includes(strategy), "offline oracle cannot route product requests");
  const identity = routePolicyIdentity(policyValue);
  const policy = identity.policy;
  const request = validateRequest(requestValue, policy);
  let route;
  if (strategy === "champion-only") {
    route = {
      selectedCompositionId: policy.championCompositionId,
      routeReason: "champion-only",
      confidenceScore: 10000,
      marginScore: 10000,
      currentSelectionApplied: false
    };
  } else {
    route = explicitSelection(policy, request);
    if (route === null && strategy === "explicit-selection-only") {
      route = {
        selectedCompositionId: policy.championCompositionId,
        routeReason: "no-current-selection-champion",
        confidenceScore: 0,
        marginScore: 0,
        currentSelectionApplied: false
      };
    } else if (route === null && strategy === "deterministic-rules") {
      const direct = normalizedDirectText(request.currentUserText);
      const scored = policy.specialists.map((specialist) => {
        const hitCount = specialist.ruleTerms
          .filter((term) => direct.includes(` ${term} `)).length;
        return {
          compositionId: specialist.compositionId,
          score: Math.floor(hitCount * 10000 / specialist.ruleTerms.length)
        };
      });
      route = scoreDecision(
        policy,
        scored,
        policy.thresholds.ruleMinimumBasisPoints,
        policy.thresholds.ruleMinimumMarginBasisPoints,
        "deterministic-rule-specialist"
      );
    } else if (route === null && strategy === "tiny-local-classifier") {
      const scored = policy.specialists.map((specialist) => {
        let score = specialist.classifierBias;
        for (let index = 0; index < policy.featureCount; index += 1) {
          score += specialist.classifierWeights[index] * request.directFeatures[index];
        }
        invariant(Number.isSafeInteger(score), "classifier score overflowed");
        return { compositionId: specialist.compositionId, score };
      });
      route = scoreDecision(
        policy,
        scored,
        policy.thresholds.classifierMinimumScore,
        policy.thresholds.classifierMinimumMargin,
        "tiny-classifier-specialist"
      );
    } else if (route === null && strategy === "local-embedding-index") {
      const scored = policy.specialists.map((specialist) => {
        let score = 0;
        for (let index = 0; index < policy.embeddingDimension; index += 1) {
          score += specialist.embeddingCentroid[index] * request.queryEmbedding[index];
        }
        invariant(Number.isSafeInteger(score), "embedding score overflowed");
        return { compositionId: specialist.compositionId, score };
      });
      route = scoreDecision(
        policy,
        scored,
        policy.thresholds.embeddingMinimumScore,
        policy.thresholds.embeddingMinimumMargin,
        "embedding-index-specialist"
      );
    }
  }
  invariant(route !== null && route !== undefined, "route strategy did not produce a decision");
  const rawPromptBytes = Buffer.byteLength(request.rawPrompt, "utf8");
  return buildDecision({
    schema: decisionSchema,
    caseId: request.caseId,
    strategy,
    phase: "pre-generation",
    routePolicyId: identity.id,
    selectedCompositionId: route.selectedCompositionId,
    routeReason: route.routeReason,
    confidenceScore: route.confidenceScore,
    marginScore: route.marginScore,
    championFallback: [
      "no-current-selection-champion",
      "low-confidence-champion",
      "ambiguous-tie-champion"
    ].includes(route.routeReason),
    currentSelectionApplied: route.currentSelectionApplied,
    rawPromptSha256: sha256(Buffer.from(request.rawPrompt, "utf8")),
    rawPromptBytes,
    untrustedSegmentCount:
      request.quotedText.length + request.retrievedText.length + request.staleMemoryText.length,
    historyPolicy: policy.historyPolicy,
    telemetryRequired: false
  });
}

/** Returns bounded bytes for a raw output without changing it. */
function rawOutputBytes(value, label) {
  invariant(typeof value === "string" || Buffer.isBuffer(value),
    `${label} must be raw string or Buffer bytes`);
  const bytes = Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(value, "utf8");
  invariant(bytes.length > 0 && bytes.length <= maximumOutputBytes, `${label} byte length is invalid`);
  return bytes;
}

/** Builds a public-safe receipt that proves one visible champion fallback retained both attempts. */
function buildFallbackReceipt(value) {
  exactKeys(value, [
    "trigger",
    "initialCompositionId",
    "championCompositionId",
    "firstRawOutput",
    "fallbackRawOutput",
    "visibleStatus"
  ], "fallback input");
  invariant(fallbackTriggers.has(value.trigger), "fallback trigger is unsupported");
  const initialCompositionId =
    requiredCompositionId(value.initialCompositionId, "fallback initialCompositionId");
  const championCompositionId =
    requiredCompositionId(value.championCompositionId, "fallback championCompositionId");
  invariant(initialCompositionId !== championCompositionId,
    "fallback initial route must be a specialist");
  const first = rawOutputBytes(value.firstRawOutput, "fallback firstRawOutput");
  const fallback = rawOutputBytes(value.fallbackRawOutput, "fallback fallbackRawOutput");
  const visibleStatus = requiredString(value.visibleStatus, "fallback visibleStatus", 256);
  const body = {
    schema: fallbackSchema,
    trigger: value.trigger,
    initialCompositionId,
    championCompositionId,
    firstRawOutputSha256: sha256(first),
    firstRawOutputBytes: first.length,
    fallbackRawOutputSha256: sha256(fallback),
    fallbackRawOutputBytes: fallback.length,
    visibleStatus,
    firstRawAttemptRetained: true,
    specialistOutputRole: "assistant",
    hiddenBestOfN: false,
    fallbackSelectionByAnswerQuality: false
  };
  return Object.freeze({ ...body, receiptSha256: sha256(canonicalJsonBytes(body)) });
}

/** Validates and rehashes one fallback receipt. */
function validateFallbackReceipt(value) {
  exactKeys(value, fallbackKeys, "fallback receipt");
  const body = {};
  for (const key of fallbackBodyKeys) body[key] = value[key];
  invariant(body.schema === fallbackSchema, "fallback receipt schema is unsupported");
  invariant(fallbackTriggers.has(body.trigger), "fallback receipt trigger is unsupported");
  requiredCompositionId(body.initialCompositionId, "fallback receipt initialCompositionId");
  requiredCompositionId(body.championCompositionId, "fallback receipt championCompositionId");
  invariant(body.initialCompositionId !== body.championCompositionId,
    "fallback receipt initial route must be a specialist");
  requiredSha256(body.firstRawOutputSha256, "fallback receipt firstRawOutputSha256");
  requiredInteger(body.firstRawOutputBytes, 1, maximumOutputBytes,
    "fallback receipt firstRawOutputBytes");
  requiredSha256(body.fallbackRawOutputSha256, "fallback receipt fallbackRawOutputSha256");
  requiredInteger(body.fallbackRawOutputBytes, 1, maximumOutputBytes,
    "fallback receipt fallbackRawOutputBytes");
  requiredString(body.visibleStatus, "fallback receipt visibleStatus", 256);
  requiredBoolean(body.firstRawAttemptRetained, true,
    "fallback receipt must retain the first attempt");
  invariant(body.specialistOutputRole === "assistant",
    "specialist output must remain an assistant message");
  requiredBoolean(body.hiddenBestOfN, false, "hidden best-of-N must remain false");
  requiredBoolean(body.fallbackSelectionByAnswerQuality, false,
    "answer-quality fallback selection must remain false");
  requiredSha256(value.receiptSha256, "fallback receipt receiptSha256");
  invariant(value.receiptSha256 === sha256(canonicalJsonBytes(body)),
    "fallback receipt content hash is invalid");
  return value;
}

/** Validates one measured arm result. */
function validateMeasurement(value, label) {
  exactKeys(value, measurementKeys, label);
  const initialOutputStatus = requiredString(
    value.initialOutputStatus, `${label}.initialOutputStatus`, 64
  );
  invariant(outputStatuses.has(initialOutputStatus), `${label}.initialOutputStatus is unsupported`);
  const fallbackReceipt = value.fallbackReceipt === null
    ? null
    : validateFallbackReceipt(value.fallbackReceipt);
  invariant((initialOutputStatus === "complete") === (fallbackReceipt === null),
    `${label} fallback presence does not match initial output status`);
  if (fallbackReceipt !== null) {
    invariant(fallbackReceipt.trigger === initialOutputStatus,
      `${label} fallback trigger does not match initial output status`);
  }
  return Object.freeze({
    routeLatencyNanoseconds: requiredInteger(
      value.routeLatencyNanoseconds, 0, 1000000000000, `${label}.routeLatencyNanoseconds`
    ),
    switchLatencyNanoseconds: requiredInteger(
      value.switchLatencyNanoseconds, 0, 1000000000000, `${label}.switchLatencyNanoseconds`
    ),
    peakAdditionalBytes: requiredInteger(
      value.peakAdditionalBytes, 0, Number.MAX_SAFE_INTEGER, `${label}.peakAdditionalBytes`
    ),
    qualityScoreBasisPoints: requiredInteger(
      value.qualityScoreBasisPoints, 0, 10000, `${label}.qualityScoreBasisPoints`
    ),
    initialRawOutputSha256:
      requiredSha256(value.initialRawOutputSha256, `${label}.initialRawOutputSha256`),
    initialRawOutputBytes: requiredInteger(
      value.initialRawOutputBytes, 1, maximumOutputBytes, `${label}.initialRawOutputBytes`
    ),
    initialOutputStatus,
    fallbackReceipt
  });
}

/** Validates one sealed tournament case and all measured product arms. */
function validateCase(value, policyValue) {
  const policy = validatePolicy(policyValue);
  exactKeys(value, caseKeys, "case");
  invariant(value.schema === caseSchema, "case schema is unsupported");
  const caseId = requiredIdentifier(value.caseId, "case.caseId");
  invariant(value.generatorVersion === "tinyrustlm.local-router-case-generator.v1",
    "case generator version is unsupported");
  const materializationSeedCommitmentSha256 = requiredSha256(
    value.materializationSeedCommitmentSha256,
    "case.materializationSeedCommitmentSha256"
  );
  invariant(requestCategories.includes(value.category), "case category is unsupported");
  const caseOrdinal = requiredInteger(value.caseOrdinal, 0, 11, "case.caseOrdinal");
  const request = validateRequest(value.request, policy);
  invariant(request.caseId === caseId, "case and request identities differ");
  const knownIds = new Set([
    policy.championCompositionId,
    ...policy.specialists.map((entry) => entry.compositionId)
  ]);
  const expectedCompositionId =
    requiredCompositionId(value.expectedCompositionId, "case.expectedCompositionId");
  invariant(knownIds.has(expectedCompositionId), "case expected route is not in the policy");
  invariant(Array.isArray(value.acceptableCompositionIds)
    && value.acceptableCompositionIds.length > 0, "case acceptable routes are invalid");
  const acceptableCompositionIds = value.acceptableCompositionIds.map((entry, index) => {
    const id = requiredCompositionId(entry, `case.acceptableCompositionIds[${index}]`);
    invariant(knownIds.has(id), `case.acceptableCompositionIds[${index}] is not in the policy`);
    return id;
  });
  invariant(new Set(acceptableCompositionIds).size === acceptableCompositionIds.length
    && JSON.stringify(acceptableCompositionIds)
      === JSON.stringify(Array.from(acceptableCompositionIds).sort()),
  "case acceptable routes must be sorted and unique");
  invariant(acceptableCompositionIds.includes(expectedCompositionId),
    "case expected route must be acceptable");
  requiredInteger(value.wrongRouteCost, 1, 1000000, "case.wrongRouteCost");
  invariant(typeof value.critical === "boolean", "case.critical must be Boolean");
  exactKeys(value.measurements, productStrategies, "case.measurements");
  const measurements = {};
  for (const strategy of productStrategies) {
    measurements[strategy] =
      validateMeasurement(value.measurements[strategy], `case.measurements.${strategy}`);
  }
  return Object.freeze({
    schema: caseSchema,
    caseId,
    generatorVersion: value.generatorVersion,
    materializationSeedCommitmentSha256,
    category: value.category,
    caseOrdinal,
    request,
    expectedCompositionId,
    acceptableCompositionIds: Object.freeze(acceptableCompositionIds),
    wrongRouteCost: value.wrongRouteCost,
    critical: value.critical,
    measurements: Object.freeze(measurements)
  });
}

/** Returns canonical case input bytes without result measurements. */
function canonicalCaseInput(caseValue) {
  return canonicalJsonBytes({
    schema: caseSchema,
    caseId: caseValue.caseId,
    generatorVersion: caseValue.generatorVersion,
    materializationSeedCommitmentSha256: caseValue.materializationSeedCommitmentSha256,
    category: caseValue.category,
    caseOrdinal: caseValue.caseOrdinal,
    request: caseValue.request,
    expectedCompositionId: caseValue.expectedCompositionId,
    acceptableCompositionIds: caseValue.acceptableCompositionIds,
    wrongRouteCost: caseValue.wrongRouteCost,
    critical: caseValue.critical
  });
}

/** Evaluates every declared arm without selecting or promoting a winner. */
function evaluateTournament(policyValue, caseValues) {
  const identity = routePolicyIdentity(policyValue);
  const policy = identity.policy;
  invariant(Array.isArray(caseValues) && caseValues.length > 0 && caseValues.length <= 4096,
    "tournament cases are invalid");
  const cases = caseValues.map((entry) => validateCase(entry, policy));
  const caseIds = cases.map((entry) => entry.caseId);
  invariant(new Set(caseIds).size === caseIds.length, "tournament case identities must be unique");
  const seedCommitments =
    new Set(cases.map((entry) => entry.materializationSeedCommitmentSha256));
  invariant(seedCommitments.size === 1,
    "tournament cases must share one materialization seed commitment");
  const categoryOrdinals = cases.map((entry) => `${entry.category}:${entry.caseOrdinal}`);
  invariant(new Set(categoryOrdinals).size === categoryOrdinals.length,
    "tournament category ordinals must be unique");
  const orderedCases = Array.from(cases).sort((left, right) =>
    left.caseId.localeCompare(right.caseId));
  invariant(JSON.stringify(caseIds) === JSON.stringify(orderedCases.map((entry) => entry.caseId)),
    "tournament cases must be sorted by case identity");
  const caseSetHash = crypto.createHash("sha256");
  for (const entry of orderedCases) caseSetHash.update(canonicalCaseInput(entry));
  const decisions = [];
  const arms = [];

  for (const strategy of allStrategies) {
    const analysisOnly = strategy === "offline-oracle";
    const metrics = {
      strategy,
      analysisOnly,
      generationMeasured: !analysisOnly,
      caseCount: cases.length,
      exactRouteCount: 0,
      acceptableRouteCount: 0,
      championFallbackCount: 0,
      fallbackAttemptCount: 0,
      criticalWrongRouteCount: 0,
      totalWrongRouteCost: 0,
      totalQualityScoreBasisPoints: 0,
      totalRouteLatencyNanoseconds: 0,
      totalSwitchLatencyNanoseconds: 0,
      maximumPeakAdditionalBytes: 0,
      routerPolicyBytes: analysisOnly || strategy === "champion-only" ? 0 : identity.policyBytes,
      selectorOrIndexBytes:
        strategy === "tiny-local-classifier" || strategy === "local-embedding-index"
          ? policy.selectorArtifactBytes
          : 0
    };
    for (const entry of cases) {
      const decision = analysisOnly
        ? buildDecision({
          schema: decisionSchema,
          caseId: entry.caseId,
          strategy,
          phase: "analysis-only",
          routePolicyId: identity.id,
          selectedCompositionId: entry.expectedCompositionId,
          routeReason: "offline-oracle-analysis-only",
          confidenceScore: 10000,
          marginScore: 10000,
          championFallback: false,
          currentSelectionApplied: false,
          rawPromptSha256: sha256(Buffer.from(entry.request.rawPrompt, "utf8")),
          rawPromptBytes: Buffer.byteLength(entry.request.rawPrompt, "utf8"),
          untrustedSegmentCount:
            entry.request.quotedText.length
              + entry.request.retrievedText.length
              + entry.request.staleMemoryText.length,
          historyPolicy: policy.historyPolicy,
          telemetryRequired: false
        })
        : routeRequest(policy, entry.request, strategy);
      const exact = decision.selectedCompositionId === entry.expectedCompositionId;
      const acceptable = entry.acceptableCompositionIds.includes(decision.selectedCompositionId);
      if (exact) metrics.exactRouteCount += 1;
      if (acceptable) metrics.acceptableRouteCount += 1;
      if (decision.championFallback) metrics.championFallbackCount += 1;
      if (!acceptable) {
        metrics.totalWrongRouteCost += entry.wrongRouteCost;
        if (entry.critical) metrics.criticalWrongRouteCount += 1;
      }
      if (!analysisOnly) {
        const measurement = entry.measurements[strategy];
        if (measurement.fallbackReceipt !== null) {
          invariant(decision.selectedCompositionId !== policy.championCompositionId,
            "champion decisions cannot have champion fallback receipts");
          invariant(measurement.fallbackReceipt.initialCompositionId
            === decision.selectedCompositionId, "fallback receipt initial route differs");
          invariant(measurement.fallbackReceipt.championCompositionId
            === policy.championCompositionId, "fallback receipt champion differs");
          invariant(measurement.fallbackReceipt.firstRawOutputSha256
            === measurement.initialRawOutputSha256, "fallback receipt raw output hash differs");
          invariant(measurement.fallbackReceipt.firstRawOutputBytes
            === measurement.initialRawOutputBytes, "fallback receipt raw output bytes differ");
          metrics.fallbackAttemptCount += 1;
        }
        metrics.totalQualityScoreBasisPoints += measurement.qualityScoreBasisPoints;
        metrics.totalRouteLatencyNanoseconds += measurement.routeLatencyNanoseconds;
        metrics.totalSwitchLatencyNanoseconds += measurement.switchLatencyNanoseconds;
        metrics.maximumPeakAdditionalBytes =
          Math.max(metrics.maximumPeakAdditionalBytes, measurement.peakAdditionalBytes);
      }
      decisions.push(Object.freeze({
        caseId: entry.caseId,
        strategy,
        decisionSha256: decision.decisionSha256,
        rawPromptSha256: decision.rawPromptSha256,
        selectedCompositionId: decision.selectedCompositionId,
        routeReason: decision.routeReason
      }));
    }
    arms.push(Object.freeze(metrics));
  }

  const categoryCounts = Object.fromEntries(requestCategories.map((category) => [
    category,
    cases.filter((entry) => entry.category === category).length
  ]));
  const completePreregisteredCaseSet = cases.length === 144
    && requestCategories.every((category) => {
      if (categoryCounts[category] !== 12) return false;
      const ordinals = cases
        .filter((entry) => entry.category === category)
        .map((entry) => entry.caseOrdinal)
        .sort((left, right) => left - right);
      return JSON.stringify(ordinals) === JSON.stringify(Array.from({ length: 12 }, (_, index) => index));
    });
  const body = {
    schema: resultSchema,
    status: "analysis-only-no-promotion-authority",
    routePolicyId: identity.id,
    routePolicySha256: identity.policySha256,
    caseSetSha256: caseSetHash.digest("hex"),
    caseCount: cases.length,
    categoryCounts,
    completePreregisteredCaseSet,
    arms,
    decisions,
    promotionAuthorized: false,
    requiredNextGate:
      "Independent review must verify the complete sealed case set, raw outputs, paired quality statistics, native and WASM parity, and frozen resource budgets before any product route can be selected."
  };
  return Object.freeze({ ...body, resultSha256: sha256(canonicalJsonBytes(body)) });
}

/** Reads one bounded regular JSON file. */
function readBoundedJson(filePath, label) {
  const metadata = fs.lstatSync(filePath);
  invariant(metadata.isFile() && !metadata.isSymbolicLink(), `${label} must be a regular file`);
  invariant(metadata.size > 0 && metadata.size <= maximumInputBytes, `${label} size is invalid`);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/** Validates the preregistration or evaluates one explicitly supplied tournament. */
function main(argumentsList) {
  if (argumentsList.length === 0) {
    const result = validatePreregistrationFile();
    process.stdout.write(`${JSON.stringify({
      schema: result.preregistration.schema,
      experimentId: result.preregistration.experimentId,
      status: result.preregistration.status,
      productAuthority: result.preregistration.authority.productAuthority,
      trainingAuthority: result.preregistration.authority.trainingAuthority,
      releaseAuthority: result.preregistration.authority.releaseAuthority,
      bytes: result.bytes,
      sha256: result.sha256
    }, null, 2)}\n`);
    return;
  }
  invariant(argumentsList.length === 3 && argumentsList[0] === "--evaluate",
    "usage: node specialist-router-tournament.js [--evaluate policy.json cases.json]");
  const policy = readBoundedJson(path.resolve(argumentsList[1]), "policy");
  const cases = readBoundedJson(path.resolve(argumentsList[2]), "cases");
  const result = evaluateTournament(policy, cases);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Specialist router tournament failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  allStrategies,
  buildFallbackReceipt,
  canonicalJsonBytes,
  canonicalPolicyBytes,
  caseSchema,
  decisionSchema,
  deriveRoutePolicyId,
  evaluateTournament,
  fallbackSchema,
  policySchema,
  preregistrationPath,
  preregistrationSchema,
  productStrategies,
  requestCategories,
  requestSchema,
  routePolicyIdentity,
  routeRequest,
  validateCase,
  validateFallbackReceipt,
  validatePolicy,
  validatePreregistration,
  validatePreregistrationFile,
  validateRequest
});
