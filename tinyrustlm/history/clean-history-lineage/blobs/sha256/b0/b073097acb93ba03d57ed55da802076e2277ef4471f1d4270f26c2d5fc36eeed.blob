"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");

const ledgerSchema = "tinyrustlm.vector_experiment_source_claim_ledger.v1";
const maximumLedgerBytes = 512 * 1024;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const gitRevisionPattern = /^[a-f0-9]{40}$/u;
const paperRevisionPattern = /^arXiv:[0-9]{4}\.[0-9]{5}v[1-9][0-9]*$/u;
const standardRevisionPattern = /^NIST\.FIPS\.180-4:2015-08$/u;
const identifierPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const internalCitationPattern = /(?:\uE200cite\uE202|turn[0-9]+(?:search|view|academia|news|reddit)[0-9]+|wordlim)/iu;
const privatePathPattern = /(?:[a-z]:\\(?:users|source)\\|\/home\/|\/mnt\/[a-z]\/|\\\\[^\\]+\\)/iu;

const ledgerStatuses = new Set([
  "source-review-only",
  "experiment-preregistered",
  "experiment-active",
  "experiment-rejected",
  "experiment-promoted"
]);
const storageLanes = new Set(["static-weights", "kv-cache", "embedding-index"]);
const productStatuses = new Set(["existing-format-unchanged", "not-integrated"]);
const experimentStatuses = new Set(["out-of-scope", "review-only", "preregistered", "active", "rejected", "promoted"]);
const sourceKinds = new Set(["paper", "repository-archive", "package-source", "standard"]);
const hashEvidenceKinds = new Set(["local-streamed-sha256", "publisher-registry-sha256"]);
const claimClasses = new Set(["author-claim", "external-reproduction", "engineering-inference", "local-observation"]);
const claimDispositions = new Set([
  "hypothesis-only",
  "reference-comparator-only",
  "accepted-design-boundary",
  "accepted-local-fact",
  "rejected"
]);
const reproductionStatuses = new Set(["not-reproduced", "local-metadata-observed", "locally-reproduced"]);

const topLevelKeys = Object.freeze([
  "schema",
  "ledgerId",
  "generatedAtUtc",
  "status",
  "productAuthority",
  "trainingAuthority",
  "experimentBoundaries",
  "sources",
  "claims",
  "requiredNextGate"
]);
const boundaryKeys = Object.freeze(["storageLane", "productStatus", "experimentStatus", "claimScope"]);
const sourceKeys = Object.freeze([
  "sourceId",
  "sourceKind",
  "displayName",
  "repositoryUrl",
  "repositoryRevision",
  "publicationVersion",
  "artifactUrl",
  "artifactSha256",
  "artifactBytes",
  "artifactHashEvidence",
  "licenseIdentity",
  "licenseUrl",
  "licenseArtifactSha256",
  "retrievedAtUtc",
  "reviewPurpose",
  "implementationInputApproved",
  "testVectorCopyApproved"
]);
const claimKeys = Object.freeze([
  "claimId",
  "sourceId",
  "claimClass",
  "storageLane",
  "statement",
  "disposition",
  "reproductionStatus",
  "citationUrl"
]);

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, expected, label) {
  invariant(isPlainObject(value), `${label} must be a plain JSON object`);
  const actual = Object.keys(value).sort();
  const wanted = Array.from(expected).sort();
  invariant(JSON.stringify(actual) === JSON.stringify(wanted),
    `${label} fields are invalid; expected=${wanted.join(",")}; actual=${actual.join(",")}`);
}

function requiredString(value, label, maximumLength = 2048) {
  invariant(typeof value === "string", `${label} must be a string`);
  invariant(value.length > 0 && value.length <= maximumLength, `${label} length is invalid`);
  invariant(value.trim() === value, `${label} must not have surrounding whitespace`);
  invariant(!internalCitationPattern.test(value), `${label} contains an internal research citation marker`);
  invariant(!privatePathPattern.test(value), `${label} contains a private or machine-local path`);
  return value;
}

function requiredIdentifier(value, label) {
  const normalized = requiredString(value, label, 128);
  invariant(identifierPattern.test(normalized), `${label} must be a lowercase hyphenated identifier`);
  return normalized;
}

function requiredEnum(value, allowed, label) {
  const normalized = requiredString(value, label, 128);
  invariant(allowed.has(normalized), `${label} is unsupported: ${normalized}`);
  return normalized;
}

function requiredSha256(value, label) {
  const normalized = requiredString(value, label, 64);
  invariant(sha256Pattern.test(normalized), `${label} must be 64 lowercase hexadecimal characters`);
  return normalized;
}

function optionalSha256(value, label) {
  return value === null ? null : requiredSha256(value, label);
}

function requiredUtc(value, label) {
  const normalized = requiredString(value, label, 64);
  invariant(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(normalized),
    `${label} must be a canonical ISO-8601 UTC timestamp`);
  invariant(Number.isFinite(Date.parse(normalized)), `${label} is not a valid timestamp`);
  return normalized;
}

function requiredHttpsUrl(value, label) {
  const normalized = requiredString(value, label, 4096);
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`${label} must be an absolute URL`);
  }
  invariant(parsed.protocol === "https:", `${label} must use HTTPS`);
  invariant(parsed.username === "" && parsed.password === "", `${label} must not contain credentials`);
  invariant(!/(?:token|secret|key|credential|code)=/iu.test(parsed.search),
    `${label} must not contain a credential-like query parameter`);
  return parsed.href;
}

function validateBoundary(value, index) {
  const label = `experimentBoundaries[${index}]`;
  exactKeys(value, boundaryKeys, label);
  const storageLane = requiredEnum(value.storageLane, storageLanes, `${label}.storageLane`);
  return Object.freeze({
    storageLane,
    productStatus: requiredEnum(value.productStatus, productStatuses, `${label}.productStatus`),
    experimentStatus: requiredEnum(value.experimentStatus, experimentStatuses, `${label}.experimentStatus`),
    claimScope: requiredString(value.claimScope, `${label}.claimScope`, 512)
  });
}

function validateSource(value, index) {
  const label = `sources[${index}]`;
  exactKeys(value, sourceKeys, label);
  const sourceKind = requiredEnum(value.sourceKind, sourceKinds, `${label}.sourceKind`);
  const repositoryRevision = requiredString(value.repositoryRevision, `${label}.repositoryRevision`, 64);
  if (sourceKind === "paper") {
    invariant(paperRevisionPattern.test(repositoryRevision),
      `${label}.repositoryRevision must pin an exact arXiv version`);
  } else if (sourceKind === "standard") {
    invariant(standardRevisionPattern.test(repositoryRevision),
      `${label}.repositoryRevision must pin the exact approved standard edition`);
  } else {
    invariant(gitRevisionPattern.test(repositoryRevision),
      `${label}.repositoryRevision must pin a complete Git commit`);
  }
  const publicationVersion = requiredString(value.publicationVersion, `${label}.publicationVersion`, 128);
  invariant(/^(?:arXiv|git-tag|crates\.io|pypi|nist-fips):/u.test(publicationVersion),
    `${label}.publicationVersion must use a registry-qualified identity`);
  invariant(!/^Turbo(?:Vec|Quant)\s/iu.test(publicationVersion),
    `${label}.publicationVersion must not use a shorthand project version`);
  invariant(Number.isSafeInteger(value.artifactBytes) && value.artifactBytes > 0,
    `${label}.artifactBytes must be a positive safe integer`);
  invariant(typeof value.implementationInputApproved === "boolean",
    `${label}.implementationInputApproved must be boolean`);
  invariant(typeof value.testVectorCopyApproved === "boolean",
    `${label}.testVectorCopyApproved must be boolean`);
  invariant(!value.testVectorCopyApproved || value.implementationInputApproved,
    `${label} cannot approve copied test vectors without implementation-input approval`);
  return Object.freeze({
    sourceId: requiredIdentifier(value.sourceId, `${label}.sourceId`),
    sourceKind,
    displayName: requiredString(value.displayName, `${label}.displayName`, 256),
    repositoryUrl: requiredHttpsUrl(value.repositoryUrl, `${label}.repositoryUrl`),
    repositoryRevision,
    publicationVersion,
    artifactUrl: requiredHttpsUrl(value.artifactUrl, `${label}.artifactUrl`),
    artifactSha256: requiredSha256(value.artifactSha256, `${label}.artifactSha256`),
    artifactBytes: value.artifactBytes,
    artifactHashEvidence: requiredEnum(value.artifactHashEvidence, hashEvidenceKinds,
      `${label}.artifactHashEvidence`),
    licenseIdentity: requiredString(value.licenseIdentity, `${label}.licenseIdentity`, 128),
    licenseUrl: requiredHttpsUrl(value.licenseUrl, `${label}.licenseUrl`),
    licenseArtifactSha256: optionalSha256(value.licenseArtifactSha256,
      `${label}.licenseArtifactSha256`),
    retrievedAtUtc: requiredUtc(value.retrievedAtUtc, `${label}.retrievedAtUtc`),
    reviewPurpose: requiredString(value.reviewPurpose, `${label}.reviewPurpose`, 512),
    implementationInputApproved: value.implementationInputApproved,
    testVectorCopyApproved: value.testVectorCopyApproved
  });
}

function validateClaim(value, index, sourceIds) {
  const label = `claims[${index}]`;
  exactKeys(value, claimKeys, label);
  const sourceId = requiredIdentifier(value.sourceId, `${label}.sourceId`);
  invariant(sourceIds.has(sourceId), `${label}.sourceId does not identify a ledger source`);
  const claimClass = requiredEnum(value.claimClass, claimClasses, `${label}.claimClass`);
  const reproductionStatus = requiredEnum(value.reproductionStatus, reproductionStatuses,
    `${label}.reproductionStatus`);
  if (claimClass === "local-observation") {
    invariant(reproductionStatus !== "not-reproduced",
      `${label} local observations require local evidence`);
  }
  return Object.freeze({
    claimId: requiredIdentifier(value.claimId, `${label}.claimId`),
    sourceId,
    claimClass,
    storageLane: requiredEnum(value.storageLane, storageLanes, `${label}.storageLane`),
    statement: requiredString(value.statement, `${label}.statement`, 2048),
    disposition: requiredEnum(value.disposition, claimDispositions, `${label}.disposition`),
    reproductionStatus,
    citationUrl: requiredHttpsUrl(value.citationUrl, `${label}.citationUrl`)
  });
}

function validateUniqueSorted(values, key, label) {
  const identifiers = values.map((value) => value[key]);
  invariant(new Set(identifiers).size === identifiers.length, `${label} identifiers must be unique`);
  const sorted = Array.from(identifiers).sort();
  invariant(JSON.stringify(identifiers) === JSON.stringify(sorted), `${label} must be sorted by ${key}`);
}

/** Validates and normalizes a vector experiment source-and-claim ledger. */
function validateLedger(value) {
  exactKeys(value, topLevelKeys, "ledger");
  invariant(value.schema === ledgerSchema, `ledger.schema must equal ${ledgerSchema}`);
  invariant(typeof value.productAuthority === "boolean" && value.productAuthority === false,
    "ledger.productAuthority must remain false before the adoption gate");
  invariant(typeof value.trainingAuthority === "boolean" && value.trainingAuthority === false,
    "ledger.trainingAuthority must remain false");
  invariant(Array.isArray(value.experimentBoundaries), "ledger.experimentBoundaries must be an array");
  invariant(Array.isArray(value.sources) && value.sources.length > 0, "ledger.sources must be nonempty");
  invariant(Array.isArray(value.claims), "ledger.claims must be an array");

  const experimentBoundaries = value.experimentBoundaries.map(validateBoundary);
  validateUniqueSorted(experimentBoundaries, "storageLane", "experimentBoundaries");
  invariant(experimentBoundaries.length === storageLanes.size,
    "ledger must declare exactly one boundary for each storage lane");
  for (const lane of storageLanes) {
    invariant(experimentBoundaries.some((entry) => entry.storageLane === lane),
      `ledger is missing the ${lane} storage boundary`);
  }

  const sources = value.sources.map(validateSource);
  validateUniqueSorted(sources, "sourceId", "sources");
  const sourceIds = new Set(sources.map((source) => source.sourceId));
  const claims = value.claims.map((claim, index) => validateClaim(claim, index, sourceIds));
  validateUniqueSorted(claims, "claimId", "claims");

  return Object.freeze({
    schema: ledgerSchema,
    ledgerId: requiredIdentifier(value.ledgerId, "ledger.ledgerId"),
    generatedAtUtc: requiredUtc(value.generatedAtUtc, "ledger.generatedAtUtc"),
    status: requiredEnum(value.status, ledgerStatuses, "ledger.status"),
    productAuthority: false,
    trainingAuthority: false,
    experimentBoundaries: Object.freeze(experimentBoundaries),
    sources: Object.freeze(sources),
    claims: Object.freeze(claims),
    requiredNextGate: requiredString(value.requiredNextGate, "ledger.requiredNextGate", 1024)
  });
}

/** Returns deterministic, human-readable bytes for an already validated ledger. */
function canonicalLedgerBytes(value) {
  return Buffer.from(`${JSON.stringify(validateLedger(value), null, 2)}\n`, "utf8");
}

/** Reads a bounded regular ledger file and proves its checked-in bytes are canonical. */
function validateLedgerFile(filePath) {
  const metadata = fs.lstatSync(filePath);
  invariant(metadata.isFile() && !metadata.isSymbolicLink(), "ledger path must be a regular non-symlink file");
  invariant(metadata.size > 0 && metadata.size <= maximumLedgerBytes, "ledger file size is invalid");
  const bytes = fs.readFileSync(filePath);
  invariant(!(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf), "ledger must not contain a UTF-8 BOM");
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`ledger JSON is invalid: ${error.message}`);
  }
  const normalized = validateLedger(parsed);
  const canonical = canonicalLedgerBytes(normalized);
  invariant(bytes.equals(canonical), "ledger bytes are not in canonical field and identifier order");
  return Object.freeze({
    ledger: normalized,
    bytes: canonical.length,
    sha256: crypto.createHash("sha256").update(canonical).digest("hex")
  });
}

function main(argv) {
  invariant(argv.length === 1, "usage: node vector-experiment-ledger.js <ledger.json>");
  const result = validateLedgerFile(argv[0]);
  process.stdout.write(`${JSON.stringify({
    schema: result.ledger.schema,
    ledgerId: result.ledger.ledgerId,
    status: result.ledger.status,
    sourceCount: result.ledger.sources.length,
    claimCount: result.ledger.claims.length,
    productAuthority: result.ledger.productAuthority,
    trainingAuthority: result.ledger.trainingAuthority,
    bytes: result.bytes,
    sha256: result.sha256
  }, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Vector experiment ledger validation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  canonicalLedgerBytes,
  ledgerSchema,
  validateLedger,
  validateLedgerFile
});
