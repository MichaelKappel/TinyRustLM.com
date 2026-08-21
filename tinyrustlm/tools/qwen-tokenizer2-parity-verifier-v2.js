"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { isDeepStrictEqual } = require("node:util");

const { parseStrictJson } = require("./strict-json.js");
const {
  buildCorpus,
  canonicalBytes: canonicalCorpusBytes,
  categoryCounts
} = require("./qwen-tokenizer2-parity-corpus.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const executionProfilePath = path.join(
  repositoryRoot,
  "contracts/vnext/qwen-tokenizer2-parity-preregistration.v1.json"
);
const verificationProfilePath = path.join(
  repositoryRoot,
  "contracts/vnext/qwen-tokenizer2-parity-verification-preregistration.v2.json"
);
const EXECUTION_PROFILE_SCHEMA =
  "tinyrustlm.vnext.qwen-tokenizer2-parity-preregistration.v1";
const VERIFICATION_PROFILE_SCHEMA =
  "tinyrustlm.vnext.qwen-tokenizer2-parity-verification-preregistration.v2";
const RESULT_SCHEMA = "tinyrustlm.qwen_tokenizer2_parity_result.v1";
const RECEIPT_SCHEMA =
  "tinyrustlm.qwen_tokenizer2_parity_verification_receipt.v2";
const EXECUTION_PROFILE_ID = "tinyrustlm.qwen-tokenizer2-source-parity/1";
const VERIFICATION_PROFILE_ID =
  "tinyrustlm.qwen-tokenizer2-source-parity-verification/2";
const EXECUTION_REGISTRATION_PARENT_COMMIT =
  "8210bda0614ef0b9237327d36d05e08f34c799df";
const VERIFICATION_REGISTRATION_PARENT_COMMIT =
  "bd21df3e080085ea9ceedfb065ef51f0d1b09ac5";
const REGISTERED_AT_UTC = "2026-08-21T15:44:28Z";
const MAXIMUM_PROFILE_BYTES = 1024 * 1024;
const MAXIMUM_RESULT_BYTES = 64 * 1024 * 1024;
const MAXIMUM_RECEIPT_BYTES = 1024 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const FORBIDDEN_PUBLIC_TEXT =
  /(?:[a-z]:\\|\/home\/|\/mnt\/[a-z]\/|bearer\s|token=|secret=|invite)/iu;

/** Throws one stable validation failure. */
function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

/** Returns true only for ordinary JSON objects. */
function isPlainObject(value) {
  return value !== null && typeof value === "object" &&
    !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

/** Requires exactly the declared object keys. */
function exactKeys(value, keys, label) {
  invariant(isPlainObject(value), `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  invariant(
    actual.length === expected.length &&
      actual.every((key, index) => key === expected[index]),
    `${label} fields are invalid`
  );
}

/** Requires JSON structural equality while preserving array order. */
function exactValue(value, expected, label) {
  invariant(isDeepStrictEqual(value, expected), `${label} is invalid`);
}

/** Computes lowercase SHA-256 for exact bytes. */
function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/** Returns canonical two-space JSON bytes with one final line feed. */
function canonicalJsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

/** Requires one lowercase nonzero SHA-256 identity. */
function requireDigest(value, label) {
  invariant(
    typeof value === "string" && SHA256_PATTERN.test(value) && !/^0{64}$/u.test(value),
    `${label} must be a nonzero lowercase SHA-256`
  );
  return value;
}

/** Requires a repository-relative portable path without traversal. */
function requireRelativePath(value, label) {
  invariant(
    typeof value === "string" && value.length > 0 && value.length <= 256 &&
      !value.includes("\\") && !path.posix.isAbsolute(value) &&
      value.split("/").every((part) => part.length > 0 && part !== "." && part !== ".."),
    `${label} is not a canonical relative path`
  );
  return value;
}

/** Reads one bounded non-symlink regular file. */
function readRegularFile(filePath, maximumBytes, label) {
  const stat = fs.lstatSync(filePath);
  invariant(
    stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 && stat.size <= maximumBytes,
    `${label} must be a bounded nonempty regular file`
  );
  return fs.readFileSync(filePath);
}

/** Reads bounded strict JSON and retains the source bytes. */
function readStrictJson(filePath, maximumBytes, label) {
  const bytes = readRegularFile(filePath, maximumBytes, label);
  const value = parseStrictJson(bytes, {
    maximumBytes,
    maximumDepth: 64,
    maximumTotalEntries: 8 * 1024 * 1024,
    maximumObjectMembers: 4096,
    maximumArrayItems: 65536,
    maximumStringCodeUnits: maximumBytes,
    maximumTotalStringCodeUnits: maximumBytes,
    maximumNumberCharacters: 32
  });
  return Object.freeze({ bytes, value });
}

/** Requires one repository path to match its registered exact bytes. */
function validateRepositoryFile(relativePath, byteLength, digest, label) {
  requireRelativePath(relativePath, `${label} path`);
  invariant(Number.isSafeInteger(byteLength) && byteLength > 0, `${label} length is invalid`);
  requireDigest(digest, `${label} SHA-256`);
  const filePath = path.join(repositoryRoot, ...relativePath.split("/"));
  const bytes = readRegularFile(filePath, Math.max(byteLength, 1), label);
  invariant(bytes.length === byteLength, `${label} byte length changed`);
  invariant(sha256(bytes) === digest, `${label} SHA-256 changed`);
  return bytes;
}

/** Requires one repository file to match a registered digest within a bound. */
function validateRepositoryDigest(relativePath, maximumBytes, digest, label) {
  requireRelativePath(relativePath, `${label} path`);
  requireDigest(digest, `${label} SHA-256`);
  const filePath = path.join(repositoryRoot, ...relativePath.split("/"));
  const bytes = readRegularFile(filePath, maximumBytes, label);
  invariant(sha256(bytes) === digest, `${label} SHA-256 changed`);
  return bytes;
}

/** Computes the preregistered candidate source-closure digest. */
function sourceClosureSha256(entries) {
  const parts = [];
  for (const entry of entries) {
    parts.push(Buffer.from(
      `${entry.path}\0${entry.byteLength}\0${entry.sha256}\n`,
      "utf8"
    ));
  }
  return sha256(Buffer.concat(parts));
}

/** Validates the no-output execution preregistration and all repository bindings. */
function validateExecutionProfile(value) {
  exactKeys(value, [
    "schema", "profileId", "status", "registeredAtUtc",
    "registrationParentCommit", "source", "artifact", "corpus", "oracle",
    "candidate", "execution", "acceptance", "claimBoundary"
  ], "execution profile");
  invariant(value.schema === EXECUTION_PROFILE_SCHEMA, "execution profile schema is invalid");
  invariant(value.profileId === EXECUTION_PROFILE_ID, "execution profile ID is invalid");
  invariant(value.status === "registered-before-comparative-output",
    "execution profile status is invalid");
  invariant(value.registeredAtUtc === "2026-08-21T07:00:00Z",
    "execution profile registration time is invalid");
  invariant(value.registrationParentCommit === EXECUTION_REGISTRATION_PARENT_COMMIT,
    "execution profile parent commit is invalid");

  exactKeys(value.source, [
    "modelId", "revision", "sourceLockPath", "sourceLockSha256",
    "tokenizerPath", "tokenizerSha256"
  ], "execution source");
  exactValue(value.source, {
    modelId: "Qwen/Qwen3-0.6B",
    revision: "c1899de289a04d12100db370d81485cdf75e47ca",
    sourceLockPath: "contracts/vnext/qwen3-0.6b-tokenizer2-source-lock.v1.json",
    sourceLockSha256:
      "1641e8d4ab1fe9e4b6b3d24918c394fcf8d6e60d204be1f4c821f0f6570b1c70",
    tokenizerPath: "tokenizer.json",
    tokenizerSha256:
      "aeb13307a71acd8fe81861d94ad54ab689df773318809eed3cbe794b4492dae4"
  }, "execution source");

  exactKeys(value.artifact, ["formatProfileId", "byteLength", "sha256"],
    "execution artifact");
  exactValue(value.artifact, {
    formatProfileId: "org.minimodel.tokenizer2/2.0",
    byteLength: 7038773,
    sha256: "cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b"
  }, "execution artifact");

  exactKeys(value.corpus, [
    "path", "schema", "corpusId", "generatorPath", "generatorSha256",
    "byteLength", "sha256", "caseCount", "categoryCounts"
  ], "execution corpus");
  invariant(value.corpus.path === "contracts/vnext/qwen-tokenizer2-parity-cases.v1.json" &&
    value.corpus.schema === "tinyrustlm.qwen_tokenizer2_parity_cases.v1" &&
    value.corpus.corpusId === "qwen3-0.6b-tokenizer2-parity-2048-v1" &&
    value.corpus.generatorPath === "tinyrustlm/tools/qwen-tokenizer2-parity-corpus.js" &&
    value.corpus.byteLength === 464043 && value.corpus.caseCount === 2048,
  "execution corpus identity is invalid");
  requireDigest(value.corpus.generatorSha256, "execution corpus generator SHA-256");
  requireDigest(value.corpus.sha256, "execution corpus SHA-256");
  exactValue(
    Object.fromEntries(Object.entries(value.corpus.categoryCounts).sort()),
    Object.fromEntries(Object.entries(categoryCounts).sort()),
    "execution category counts"
  );

  exactKeys(value.oracle, [
    "implementation", "version", "sourceRevision", "scriptPath", "scriptSha256",
    "pythonVersion", "pythonExecutableSha256", "wheelFile", "wheelSha256",
    "environmentLockSha256", "networkAllowed", "childProcessAllowed"
  ], "execution oracle");
  invariant(value.oracle.implementation === "huggingface-tokenizers" &&
    value.oracle.version === "0.22.2" &&
    value.oracle.sourceRevision === "f383101a26663708484cac0727792aad74f78234" &&
    value.oracle.scriptPath === "tinyrustlm/tools/qwen-tokenizer2-source-oracle.py" &&
    value.oracle.pythonVersion === "3.12.10" &&
    value.oracle.wheelFile === "tokenizers-0.22.2-cp39-abi3-win_amd64.whl" &&
    value.oracle.networkAllowed === false && value.oracle.childProcessAllowed === false,
  "execution oracle identity is invalid");
  for (const key of [
    "scriptSha256", "pythonExecutableSha256", "wheelSha256", "environmentLockSha256"
  ]) requireDigest(value.oracle[key], `execution oracle ${key}`);

  exactKeys(value.candidate, [
    "implementation", "version", "runnerPath", "runnerSha256",
    "sourceClosureSha256", "sourceClosure"
  ], "execution candidate");
  invariant(value.candidate.implementation === "tinyrustlm-tokenizer2" &&
    value.candidate.version === "0.1.8" &&
    value.candidate.runnerPath ===
      "rust/crates/tinyrustlm-tokenizer2/examples/qwen_tokenizer2_parity.rs",
  "execution candidate identity is invalid");
  requireDigest(value.candidate.runnerSha256, "execution candidate runner SHA-256");
  requireDigest(value.candidate.sourceClosureSha256,
    "execution candidate source closure SHA-256");
  invariant(Array.isArray(value.candidate.sourceClosure) &&
    value.candidate.sourceClosure.length === 7,
  "execution candidate source closure is invalid");
  let priorPath = null;
  for (const [index, entry] of value.candidate.sourceClosure.entries()) {
    exactKeys(entry, ["path", "byteLength", "sha256"],
      `execution candidate source closure ${index}`);
    requireRelativePath(entry.path, `execution candidate source closure ${index} path`);
    invariant(priorPath === null || priorPath < entry.path,
      "execution candidate source closure is not strictly ordered");
    priorPath = entry.path;
    validateRepositoryFile(entry.path, entry.byteLength, entry.sha256,
      `execution candidate source closure ${index}`);
  }
  invariant(sourceClosureSha256(value.candidate.sourceClosure) ===
    value.candidate.sourceClosureSha256,
  "execution candidate source closure digest changed");
  invariant(value.candidate.sourceClosure.some((entry) =>
    entry.path === value.candidate.runnerPath &&
      entry.sha256 === value.candidate.runnerSha256),
  "execution candidate runner is outside its source closure");

  exactKeys(value.execution, [
    "addSpecialTokens", "decodeModes", "requiredOracleRuns", "requiredCandidateRuns",
    "maximumInputBytes", "maximumOutputTokens", "maximumDecodedBytes", "comparison",
    "bestOfN", "repair", "outputLocation"
  ], "execution policy");
  exactValue(value.execution, {
    addSpecialTokens: false,
    decodeModes: ["include-all", "skip-special"],
    requiredOracleRuns: 2,
    requiredCandidateRuns: 2,
    maximumInputBytes: 32768,
    maximumOutputTokens: 65536,
    maximumDecodedBytes: 131072,
    comparison: "exact-token-ids-and-exact-decoded-unicode",
    bestOfN: false,
    repair: false,
    outputLocation: "private-external-create-only"
  }, "execution policy");

  exactKeys(value.acceptance, [
    "corpusCommittedBeforeObservation", "sourceLockRevalidated",
    "sourceRehashedAfterObservation", "exactCaseOrderRequired", "exactTokenIdsRequired",
    "exactIncludeAllDecodeRequired", "exactSkipSpecialDecodeRequired",
    "repeatedOracleBytesRequired", "repeatedCandidateBytesRequired", "everyCaseRequired",
    "mismatchIsFatal", "rawOutputsPreserved", "networkRequestMaximum",
    "childProcessMaximum"
  ], "execution acceptance");
  for (const [key, accepted] of Object.entries(value.acceptance)) {
    if (key.endsWith("Required") || [
      "corpusCommittedBeforeObservation", "sourceLockRevalidated",
      "sourceRehashedAfterObservation", "mismatchIsFatal", "rawOutputsPreserved"
    ].includes(key)) invariant(accepted === true, `execution acceptance ${key} changed`);
  }
  invariant(value.acceptance.networkRequestMaximum === 0 &&
    value.acceptance.childProcessMaximum === 0,
  "execution isolation budget changed");

  exactKeys(value.claimBoundary, [
    "tokenizerSourceParityMayBeClaimedAfterPass", "browserWasmMayBeClaimed",
    "modelRuntimeMayBeClaimed", "modelQualityMayBeClaimed", "releaseMayBeClaimed",
    "campaignCreditMayBeClaimed", "requiredNextGate"
  ], "execution claim boundary");
  invariant(value.claimBoundary.tokenizerSourceParityMayBeClaimedAfterPass === true &&
    value.claimBoundary.browserWasmMayBeClaimed === false &&
    value.claimBoundary.modelRuntimeMayBeClaimed === false &&
    value.claimBoundary.modelQualityMayBeClaimed === false &&
    value.claimBoundary.releaseMayBeClaimed === false &&
    value.claimBoundary.campaignCreditMayBeClaimed === false &&
    value.claimBoundary.requiredNextGate ===
      "full-artifact-real-chromium-wasm-parity-and-resource-evidence",
  "execution claim boundary changed");

  validateRepositoryFile(value.source.sourceLockPath, 1108,
    value.source.sourceLockSha256, "execution source lock");
  validateRepositoryDigest(value.corpus.generatorPath, MAXIMUM_PROFILE_BYTES,
    value.corpus.generatorSha256, "execution corpus generator");
  const corpusBytes = validateRepositoryFile(value.corpus.path, value.corpus.byteLength,
    value.corpus.sha256, "execution corpus");
  invariant(corpusBytes.equals(canonicalCorpusBytes(buildCorpus())),
    "execution corpus does not match its deterministic generator");
  validateRepositoryDigest(value.oracle.scriptPath, MAXIMUM_PROFILE_BYTES,
    value.oracle.scriptSha256, "execution oracle script");
  return value;
}

/** Reads and validates the canonical execution preregistration file. */
function validateExecutionProfileFile(filePath = executionProfilePath) {
  const parsed = readStrictJson(filePath, MAXIMUM_PROFILE_BYTES, "execution profile");
  const profile = validateExecutionProfile(parsed.value);
  invariant(parsed.bytes.equals(canonicalJsonBytes(profile)),
    "execution profile bytes are not canonical");
  return Object.freeze({ profile, bytes: parsed.bytes, sha256: sha256(parsed.bytes) });
}

/** Validates the independent verification preregistration. */
function validateVerificationProfile(value, executionIdentity) {
  exactKeys(value, [
    "schema", "profileId", "status", "registeredAtUtc", "registrationParentCommit",
    "executionPreregistration", "predecessorFailure", "runSet", "verifier",
    "execution", "receipt", "claimBoundary"
  ], "verification profile");
  invariant(value.schema === VERIFICATION_PROFILE_SCHEMA,
    "verification profile schema is invalid");
  invariant(value.profileId === VERIFICATION_PROFILE_ID,
    "verification profile ID is invalid");
  invariant(value.status ===
      "registered-after-v1-terminal-verifier-defect-before-v2-output" &&
    value.registeredAtUtc === REGISTERED_AT_UTC &&
    value.registrationParentCommit === VERIFICATION_REGISTRATION_PARENT_COMMIT,
  "verification profile registration identity is invalid");

  exactKeys(value.executionPreregistration,
    ["path", "schema", "profileId", "byteLength", "sha256"],
    "verification execution preregistration");
  exactValue(value.executionPreregistration, {
    path: "contracts/vnext/qwen-tokenizer2-parity-preregistration.v1.json",
    schema: EXECUTION_PROFILE_SCHEMA,
    profileId: EXECUTION_PROFILE_ID,
    byteLength: executionIdentity.bytes.length,
    sha256: executionIdentity.sha256
  }, "verification execution preregistration");

  exactKeys(value.predecessorFailure, [
    "attemptId", "status", "boundedFailureCode", "executionProfileSha256",
    "verificationProfileSha256", "verifierSha256", "receiptCreated",
    "rawOutputsPreserved", "excludedFromV2Comparison", "outputIdentities"
  ], "verification predecessor failure");
  exactValue(value.predecessorFailure, {
    attemptId: "qwen3-tokenizer2-parity-20260821-v1",
    status: "terminal-verifier-defect-no-parity-decision",
    boundedFailureCode: "verifier-json-object-member-order-defect",
    executionProfileSha256:
      "bccc1631c519774ca46d77100ba59dae0d3eb4dcc681cd227f192bf558319466",
    verificationProfileSha256:
      "cc1472a7531095323dc1fe2fc2bb878bedfff4cc2cc5b5651f129c4800b0ed05",
    verifierSha256:
      "67791ba375cc8be2b84f1985eea42a810e4dca4edcc91fb0a9bd9e91ec979173",
    receiptCreated: false,
    rawOutputsPreserved: true,
    excludedFromV2Comparison: true,
    outputIdentities: [
      {
        role: "source-oracle",
        ordinal: 1,
        byteLength: 1827322,
        sha256: "6f0aaf3b021296554ebf2bd60882323931566e06f2f43400e46101a92228de52"
      },
      {
        role: "source-oracle",
        ordinal: 2,
        byteLength: 1827322,
        sha256: "6f0aaf3b021296554ebf2bd60882323931566e06f2f43400e46101a92228de52"
      },
      {
        role: "candidate",
        ordinal: 1,
        byteLength: 1697228,
        sha256: "ac571be6710b9064ee420e680deaf21a6a2d2e0d1099512c19767160f4aac290"
      },
      {
        role: "candidate",
        ordinal: 2,
        byteLength: 1697228,
        sha256: "ac571be6710b9064ee420e680deaf21a6a2d2e0d1099512c19767160f4aac290"
      }
    ]
  }, "verification predecessor failure");

  exactKeys(value.runSet, [
    "attemptId", "outputDirectoryName", "oracleRunFiles", "candidateRunFiles",
    "receiptFile", "generatedAfterRegistrationRequired", "priorRunReuseAllowed",
    "outputPathsCreateOnly", "requiredVerifierRuns", "candidateExecutable"
  ], "verification run set");
  exactValue(value.runSet, {
    attemptId: "qwen3-tokenizer2-parity-v2-20260821-v1",
    outputDirectoryName: "qwen3-tokenizer2-parity-v2-20260821-v1",
    oracleRunFiles: ["oracle-run-1.json", "oracle-run-2.json"],
    candidateRunFiles: ["candidate-run-1.json", "candidate-run-2.json"],
    receiptFile: "parity-verification-receipt.v2.json",
    generatedAfterRegistrationRequired: true,
    priorRunReuseAllowed: false,
    outputPathsCreateOnly: true,
    requiredVerifierRuns: 1,
    candidateExecutable: {
      byteLength: 576512,
      sha256: "1ee0339cecd32cf5651c295b3ead0ff9c612be42fa80bf42e43686804ac480fe"
    }
  }, "verification run set");

  exactKeys(value.verifier, [
    "implementation", "version", "scriptPath", "scriptSha256", "resultSchema",
    "receiptSchema", "comparisonSemantics"
  ], "verification verifier");
  invariant(value.verifier.implementation === "tinyrustlm-qwen-tokenizer2-parity-verifier" &&
    value.verifier.version === "2" &&
    value.verifier.scriptPath ===
      "tinyrustlm/tools/qwen-tokenizer2-parity-verifier-v2.js" &&
    value.verifier.resultSchema === RESULT_SCHEMA &&
    value.verifier.receiptSchema === RECEIPT_SCHEMA,
  "verification verifier identity is invalid");
  exactValue(value.verifier.comparisonSemantics, {
    jsonObjectMemberOrder: "ignored-as-nonsemantic",
    jsonArrayOrder: "preserved-as-semantic",
    primitiveTypes: "deep-strict"
  }, "verification comparison semantics");
  validateRepositoryDigest(value.verifier.scriptPath, MAXIMUM_PROFILE_BYTES,
    value.verifier.scriptSha256, "verification verifier");

  exactKeys(value.execution, [
    "requiredOracleRuns", "requiredCandidateRuns", "maximumResultBytes",
    "comparison", "sourceRehashAfterObservation", "artifactRehashAfterObservation",
    "rawRunByteEqualityRequired", "createOnlyReceipt", "mismatchIsFatal",
    "rawOutputsPreserved", "inputBasenameBindingRequired"
  ], "verification execution");
  exactValue(value.execution, {
    requiredOracleRuns: 2,
    requiredCandidateRuns: 2,
    maximumResultBytes: MAXIMUM_RESULT_BYTES,
    comparison: "exact-token-ids-and-exact-decoded-unicode",
    sourceRehashAfterObservation: true,
    artifactRehashAfterObservation: true,
    rawRunByteEqualityRequired: true,
    createOnlyReceipt: true,
    mismatchIsFatal: true,
    rawOutputsPreserved: true,
    inputBasenameBindingRequired: true
  }, "verification execution");

  exactKeys(value.receipt, [
    "maximumMismatchRecords", "includePromptText", "includeDecodedText",
    "includeTokenIds", "includePrivateAbsolutePaths"
  ], "verification receipt");
  exactValue(value.receipt, {
    maximumMismatchRecords: 128,
    includePromptText: false,
    includeDecodedText: false,
    includeTokenIds: false,
    includePrivateAbsolutePaths: false
  }, "verification receipt");

  exactKeys(value.claimBoundary, [
    "tokenizerSourceParityMayBeClaimedAfterPass", "browserWasmMayBeClaimed",
    "modelRuntimeMayBeClaimed", "modelQualityMayBeClaimed", "releaseMayBeClaimed",
    "campaignCreditMayBeClaimed", "requiredNextGate"
  ], "verification claim boundary");
  exactValue(value.claimBoundary, executionIdentity.profile.claimBoundary,
    "verification claim boundary");
  invariant(!FORBIDDEN_PUBLIC_TEXT.test(JSON.stringify(value)),
    "verification profile contains private or credential-like text");
  return value;
}

/** Reads and validates both canonical preregistration files. */
function validatePreregistrationFiles(
  verificationPath = verificationProfilePath,
  executionPath = executionProfilePath
) {
  const execution = validateExecutionProfileFile(executionPath);
  const parsed = readStrictJson(verificationPath, MAXIMUM_PROFILE_BYTES,
    "verification profile");
  const profile = validateVerificationProfile(parsed.value, execution);
  invariant(parsed.bytes.equals(canonicalJsonBytes(profile)),
    "verification profile bytes are not canonical");
  return Object.freeze({
    execution,
    verification: Object.freeze({
      profile,
      bytes: parsed.bytes,
      sha256: sha256(parsed.bytes)
    })
  });
}

/** Validates one result document against the frozen corpus and profile. */
function validateResultDocument(value, expectedKind, execution, corpus) {
  invariant(["source-oracle", "candidate"].includes(expectedKind),
    "result kind is invalid");
  exactKeys(value, [
    "schema", "implementation", "preregistration", "source", "artifact", "corpus",
    "summary", "results"
  ], `${expectedKind} result`);
  invariant(value.schema === RESULT_SCHEMA, `${expectedKind} result schema is invalid`);
  exactKeys(value.implementation, [
    "kind", "name", "version", "executableSha256", "sourceIdentitySha256"
  ], `${expectedKind} implementation`);
  requireDigest(value.implementation.executableSha256,
    `${expectedKind} executable SHA-256`);
  requireDigest(value.implementation.sourceIdentitySha256,
    `${expectedKind} source identity SHA-256`);
  if (expectedKind === "source-oracle") {
    exactValue(value.implementation, {
      kind: "source-oracle",
      name: execution.profile.oracle.implementation,
      version: execution.profile.oracle.version,
      executableSha256: execution.profile.oracle.pythonExecutableSha256,
      sourceIdentitySha256: execution.profile.oracle.wheelSha256
    }, "source-oracle implementation");
  } else {
    invariant(value.implementation.kind === "candidate" &&
      value.implementation.name === execution.profile.candidate.implementation &&
      value.implementation.version === execution.profile.candidate.version &&
      value.implementation.sourceIdentitySha256 ===
        execution.profile.candidate.sourceClosureSha256,
    "candidate implementation identity is invalid");
  }

  exactKeys(value.preregistration, ["profileId", "profileSha256"],
    `${expectedKind} preregistration`);
  exactValue(value.preregistration, {
    profileId: execution.profile.profileId,
    profileSha256: execution.sha256
  }, `${expectedKind} preregistration`);
  exactValue(value.source, {
    modelId: execution.profile.source.modelId,
    revision: execution.profile.source.revision,
    tokenizerSha256: execution.profile.source.tokenizerSha256
  }, `${expectedKind} source`);
  exactValue(value.artifact, execution.profile.artifact, `${expectedKind} artifact`);
  exactValue(value.corpus, {
    corpusId: execution.profile.corpus.corpusId,
    sha256: execution.profile.corpus.sha256,
    caseCount: execution.profile.corpus.caseCount
  }, `${expectedKind} corpus`);
  exactKeys(value.summary,
    ["caseCount", "totalTokenCount", "maximumTokenCount"],
    `${expectedKind} summary`);
  invariant(Array.isArray(value.results) && value.results.length === corpus.cases.length,
    `${expectedKind} result count is invalid`);

  let totalTokenCount = 0;
  let maximumTokenCount = 0;
  for (let index = 0; index < corpus.cases.length; index += 1) {
    const result = value.results[index];
    exactKeys(result,
      ["caseId", "tokenIds", "decodeIncludeAll", "decodeSkipSpecial"],
      `${expectedKind} case ${index}`);
    invariant(result.caseId === corpus.cases[index].caseId,
      `${expectedKind} case order is invalid`);
    invariant(Array.isArray(result.tokenIds) &&
      result.tokenIds.length <= execution.profile.execution.maximumOutputTokens,
    `${expectedKind} case ${index} token count is invalid`);
    invariant(result.tokenIds.every((token) =>
      Number.isSafeInteger(token) && token >= 0 && token <= 0xffff_ffff),
    `${expectedKind} case ${index} contains an invalid token ID`);
    invariant(typeof result.decodeIncludeAll === "string" &&
      Buffer.byteLength(result.decodeIncludeAll, "utf8") <=
        execution.profile.execution.maximumDecodedBytes,
    `${expectedKind} case ${index} include-all decode is invalid`);
    invariant(typeof result.decodeSkipSpecial === "string" &&
      Buffer.byteLength(result.decodeSkipSpecial, "utf8") <=
        execution.profile.execution.maximumDecodedBytes,
    `${expectedKind} case ${index} skip-special decode is invalid`);
    totalTokenCount += result.tokenIds.length;
    invariant(Number.isSafeInteger(totalTokenCount),
      `${expectedKind} total token count overflowed`);
    maximumTokenCount = Math.max(maximumTokenCount, result.tokenIds.length);
  }
  exactValue(value.summary, {
    caseCount: corpus.cases.length,
    totalTokenCount,
    maximumTokenCount
  }, `${expectedKind} summary`);
  return value;
}

/** Returns bounded semantic mismatch metadata without copying private outputs. */
function compareResultSets(oracleResults, candidateResults, maximumRecords = 128) {
  invariant(Array.isArray(oracleResults) && Array.isArray(candidateResults),
    "comparison inputs must be arrays");
  const mismatches = [];
  const count = Math.max(oracleResults.length, candidateResults.length);
  let mismatchCount = 0;
  for (let index = 0; index < count; index += 1) {
    const oracle = oracleResults[index];
    const candidate = candidateResults[index];
    const fields = [];
    if (!oracle || !candidate || oracle.caseId !== candidate.caseId) {
      fields.push("case-order");
    } else {
      if (JSON.stringify(oracle.tokenIds) !== JSON.stringify(candidate.tokenIds)) {
        fields.push("tokenIds");
      }
      if (oracle.decodeIncludeAll !== candidate.decodeIncludeAll) {
        fields.push("decodeIncludeAll");
      }
      if (oracle.decodeSkipSpecial !== candidate.decodeSkipSpecial) {
        fields.push("decodeSkipSpecial");
      }
    }
    if (fields.length > 0) {
      mismatchCount += 1;
      if (mismatches.length < maximumRecords) {
        mismatches.push(Object.freeze({
          caseId: oracle?.caseId ?? candidate?.caseId ?? `missing-${index}`,
          fields
        }));
      }
    }
  }
  return Object.freeze({ mismatchCount, mismatches });
}

/** Requires an absolute external path outside the repository. */
function requireExternalPath(filePath, label) {
  invariant(path.isAbsolute(filePath), `${label} must be absolute`);
  const resolved = path.resolve(filePath);
  const rootWithSeparator = `${repositoryRoot}${path.sep}`.toLowerCase();
  invariant(resolved.toLowerCase() !== repositoryRoot.toLowerCase() &&
    !resolved.toLowerCase().startsWith(rootWithSeparator),
    `${label} must remain outside source control`);
  return resolved;
}

/** Resolves an existing external path and rejects parent-symlink indirection. */
function requireExistingExternalPath(filePath, label) {
  const resolved = requireExternalPath(filePath, label);
  const real = fs.realpathSync.native(resolved);
  requireExternalPath(real, label);
  return real;
}

/** Binds all v2 outputs to one new, named, external create-only run set. */
function validateRunSetPaths(options, verificationProfile) {
  const runSet = verificationProfile.runSet;
  const inputs = [
    [options.oracleRun1, runSet.oracleRunFiles[0], "oracle run 1"],
    [options.oracleRun2, runSet.oracleRunFiles[1], "oracle run 2"],
    [options.candidateRun1, runSet.candidateRunFiles[0], "candidate run 1"],
    [options.candidateRun2, runSet.candidateRunFiles[1], "candidate run 2"]
  ];
  let runDirectory = null;
  for (const [filePath, expectedName, label] of inputs) {
    const resolved = requireExistingExternalPath(filePath, `${label} path`);
    invariant(path.basename(resolved) === expectedName, `${label} name is invalid`);
    const parent = path.dirname(resolved);
    if (runDirectory === null) runDirectory = parent;
    invariant(parent.toLowerCase() === runDirectory.toLowerCase(),
      "v2 run inputs must share one directory");
  }
  invariant(path.basename(runDirectory) === runSet.outputDirectoryName,
    "v2 run directory identity is invalid");

  const receipt = requireExternalPath(options.receiptPath, "receipt path");
  const receiptParent = fs.realpathSync.native(path.dirname(receipt));
  requireExternalPath(receiptParent, "receipt parent");
  invariant(receiptParent.toLowerCase() === runDirectory.toLowerCase() &&
    path.basename(receipt) === runSet.receiptFile,
  "v2 receipt path is outside the registered run set");
  invariant(!fs.existsSync(receipt), "v2 receipt path already exists");
}

/** Rehashes the exact locked upstream tokenizer source after observation. */
function revalidateSource(sourceDirectory, execution) {
  const directory = requireExistingExternalPath(sourceDirectory, "source directory");
  const stat = fs.lstatSync(directory);
  invariant(stat.isDirectory() && !stat.isSymbolicLink(),
    "source directory must be a non-symlink directory");
  const lockPath = path.join(repositoryRoot,
    ...execution.profile.source.sourceLockPath.split("/"));
  const lock = readStrictJson(lockPath, MAXIMUM_PROFILE_BYTES, "source lock").value;
  exactKeys(lock,
    ["schema", "modelId", "revision", "sourceKind", "architectureProfileId", "files"],
    "source lock");
  invariant(lock.schema === "tinyrustlm.qwen_tokenizer2_source_lock.v1" &&
    lock.modelId === execution.profile.source.modelId &&
    lock.revision === execution.profile.source.revision,
  "source lock identity is invalid");
  exactKeys(lock.files,
    ["config", "merges", "tokenizer", "tokenizerConfig", "vocab"],
    "source lock files");
  const expectedNames = [];
  const inventory = [];
  for (const key of Object.keys(lock.files).sort()) {
    const entry = lock.files[key];
    exactKeys(entry, ["path", "byteLength", "sha256"], `source lock ${key}`);
    requireRelativePath(entry.path, `source lock ${key} path`);
    invariant(!entry.path.includes("/"), `source lock ${key} must be a direct child`);
    expectedNames.push(entry.path);
    const bytes = readRegularFile(path.join(directory, entry.path), entry.byteLength,
      `source file ${key}`);
    invariant(bytes.length === entry.byteLength && sha256(bytes) === entry.sha256,
      `source file ${key} changed`);
    inventory.push(Object.freeze({
      path: entry.path,
      byteLength: entry.byteLength,
      sha256: entry.sha256
    }));
  }
  const actualNames = fs.readdirSync(directory, { withFileTypes: true })
    .map((entry) => entry.name).sort();
  invariant(JSON.stringify(actualNames) === JSON.stringify(expectedNames.sort()),
    "source directory inventory changed");
  return Object.freeze({
    fileCount: inventory.length,
    inventorySha256: sha256(canonicalJsonBytes(inventory))
  });
}

/** Rehashes the exact Tokenizer2 artifact after observation. */
function revalidateArtifact(artifactPath, execution) {
  const resolved = requireExistingExternalPath(artifactPath, "artifact path");
  const bytes = readRegularFile(resolved, execution.profile.artifact.byteLength,
    "Tokenizer2 artifact");
  invariant(bytes.length === execution.profile.artifact.byteLength &&
    sha256(bytes) === execution.profile.artifact.sha256,
  "Tokenizer2 artifact changed");
}

/** Rehashes the single registered candidate executable after observation. */
function revalidateCandidateExecutable(executablePath, verificationProfile) {
  const expected = verificationProfile.runSet.candidateExecutable;
  const resolved = requireExistingExternalPath(executablePath,
    "candidate executable path");
  const bytes = readRegularFile(resolved, expected.byteLength,
    "candidate executable");
  invariant(bytes.length === expected.byteLength && sha256(bytes) === expected.sha256,
    "candidate executable changed");
  return expected;
}

/** Writes exact bytes once, flushes them, and refuses replacement. */
function writeCreateOnly(filePath, bytes) {
  const resolved = requireExternalPath(filePath, "receipt path");
  invariant(bytes.length > 0 && bytes.length <= MAXIMUM_RECEIPT_BYTES,
    "receipt bytes are outside their limit");
  const parent = fs.realpathSync(path.dirname(resolved));
  requireExternalPath(parent, "receipt parent");
  invariant(!fs.existsSync(resolved), "receipt path already exists");
  const descriptor = fs.openSync(path.join(parent, path.basename(resolved)), "wx");
  try {
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

/** Executes the immutable four-run comparison and writes its pass/rejection receipt. */
function verifyParity(options) {
  const profiles = validatePreregistrationFiles(
    options.verificationProfilePath ?? verificationProfilePath,
    options.executionProfilePath ?? executionProfilePath
  );
  const corpusPath = path.join(repositoryRoot,
    ...profiles.execution.profile.corpus.path.split("/"));
  const corpus = readStrictJson(corpusPath, MAXIMUM_RESULT_BYTES, "parity corpus").value;
  validateRunSetPaths(options, profiles.verification.profile);
  const runInputs = [
    ["source-oracle", options.oracleRun1],
    ["source-oracle", options.oracleRun2],
    ["candidate", options.candidateRun1],
    ["candidate", options.candidateRun2]
  ];
  const runs = runInputs.map(([kind, runPath]) => {
    const resolved = requireExistingExternalPath(runPath, `${kind} result path`);
    const parsed = readStrictJson(resolved, MAXIMUM_RESULT_BYTES, `${kind} result`);
    return Object.freeze({
      kind,
      bytes: parsed.bytes,
      sha256: sha256(parsed.bytes),
      value: validateResultDocument(parsed.value, kind, profiles.execution, corpus)
    });
  });

  const oracleRepeatEqual = runs[0].bytes.equals(runs[1].bytes);
  const candidateRepeatEqual = runs[2].bytes.equals(runs[3].bytes);
  const comparison = compareResultSets(runs[0].value.results, runs[2].value.results,
    profiles.verification.profile.receipt.maximumMismatchRecords);
  const summaryEqual = isDeepStrictEqual(
    runs[0].value.summary,
    runs[2].value.summary
  );
  const implementationIdentityStable =
    isDeepStrictEqual(runs[0].value.implementation, runs[1].value.implementation) &&
    isDeepStrictEqual(runs[2].value.implementation, runs[3].value.implementation);
  const expectedExecutable =
    profiles.verification.profile.runSet.candidateExecutable.sha256;
  invariant(runs[2].value.implementation.executableSha256 === expectedExecutable &&
    runs[3].value.implementation.executableSha256 === expectedExecutable,
  "candidate result executable identity is invalid");

  const source = revalidateSource(options.sourceDirectory, profiles.execution);
  revalidateArtifact(options.artifactPath, profiles.execution);
  const candidateExecutable = revalidateCandidateExecutable(
    options.candidateExecutablePath,
    profiles.verification.profile
  );
  const passed = oracleRepeatEqual && candidateRepeatEqual && summaryEqual &&
    implementationIdentityStable && comparison.mismatchCount === 0;
  const receipt = {
    schema: RECEIPT_SCHEMA,
    profileId: profiles.verification.profile.profileId,
    status: passed ? "exact-source-parity-verified" : "exact-source-parity-rejected",
    attempt: {
      attemptId: profiles.verification.profile.runSet.attemptId,
      predecessorAttemptId:
        profiles.verification.profile.predecessorFailure.attemptId,
      predecessorExcluded: true
    },
    registration: {
      parentCommit: VERIFICATION_REGISTRATION_PARENT_COMMIT,
      executionProfileSha256: profiles.execution.sha256,
      verificationProfileSha256: profiles.verification.sha256,
      verifierSha256: profiles.verification.profile.verifier.scriptSha256
    },
    source: {
      modelId: profiles.execution.profile.source.modelId,
      revision: profiles.execution.profile.source.revision,
      sourceLockSha256: profiles.execution.profile.source.sourceLockSha256,
      tokenizerSha256: profiles.execution.profile.source.tokenizerSha256,
      fileCount: source.fileCount,
      inventorySha256: source.inventorySha256,
      rehashedAfterObservation: true
    },
    artifact: {
      formatProfileId: profiles.execution.profile.artifact.formatProfileId,
      byteLength: profiles.execution.profile.artifact.byteLength,
      sha256: profiles.execution.profile.artifact.sha256,
      rehashedAfterObservation: true
    },
    candidateExecutable: {
      byteLength: candidateExecutable.byteLength,
      sha256: candidateExecutable.sha256,
      rehashedAfterObservation: true
    },
    corpus: {
      corpusId: profiles.execution.profile.corpus.corpusId,
      caseCount: profiles.execution.profile.corpus.caseCount,
      sha256: profiles.execution.profile.corpus.sha256
    },
    runs: runs.map((run, index) => ({
      role: run.kind,
      ordinal: index % 2 + 1,
      byteLength: run.bytes.length,
      sha256: run.sha256,
      executableSha256: run.value.implementation.executableSha256,
      sourceIdentitySha256: run.value.implementation.sourceIdentitySha256
    })),
    comparison: {
      mode: profiles.verification.profile.execution.comparison,
      caseCount: profiles.execution.profile.corpus.caseCount,
      totalTokenCount: runs[0].value.summary.totalTokenCount,
      maximumTokenCount: runs[0].value.summary.maximumTokenCount,
      oracleRepeatBytesEqual: oracleRepeatEqual,
      candidateRepeatBytesEqual: candidateRepeatEqual,
      implementationIdentityStable,
      summaryEqual,
      mismatchCount: comparison.mismatchCount,
      mismatchRecordsTruncated:
        comparison.mismatchCount > comparison.mismatches.length,
      mismatches: comparison.mismatches
    },
    claimBoundary: {
      tokenizerSourceParityVerified: passed,
      browserWasmVerified: false,
      modelRuntimeVerified: false,
      modelQualityVerified: false,
      releaseAuthorized: false,
      campaignCreditAuthorized: false,
      requiredNextGate:
        profiles.verification.profile.claimBoundary.requiredNextGate
    }
  };
  const receiptBytes = canonicalJsonBytes(receipt);
  writeCreateOnly(options.receiptPath, receiptBytes);
  return Object.freeze({ receipt, bytes: receiptBytes, sha256: sha256(receiptBytes) });
}

/** Runs the no-output preregistration check or the immutable result comparison. */
function main(argumentsList) {
  if (argumentsList.length === 1 && argumentsList[0] === "--check-preregistration") {
    const profiles = validatePreregistrationFiles();
    process.stdout.write(`${JSON.stringify({
      status: "preregistration-valid-before-comparative-output",
      executionProfileSha256: profiles.execution.sha256,
      verificationProfileSha256: profiles.verification.sha256,
      verifierSha256: profiles.verification.profile.verifier.scriptSha256,
      caseCount: profiles.execution.profile.corpus.caseCount
    }, null, 2)}\n`);
    return;
  }
  invariant(argumentsList.length === 9,
    "usage: qwen-tokenizer2-parity-verifier-v2.js --check-preregistration | " +
    "<source-dir> <artifact> <oracle-1> <oracle-2> <candidate-1> <candidate-2> " +
    "<candidate-executable> <receipt> <verification-profile>");
  const result = verifyParity({
    sourceDirectory: argumentsList[0],
    artifactPath: argumentsList[1],
    oracleRun1: argumentsList[2],
    oracleRun2: argumentsList[3],
    candidateRun1: argumentsList[4],
    candidateRun2: argumentsList[5],
    candidateExecutablePath: argumentsList[6],
    receiptPath: argumentsList[7],
    verificationProfilePath: path.resolve(argumentsList[8])
  });
  process.stdout.write(`${JSON.stringify({
    schema: result.receipt.schema,
    status: result.receipt.status,
    caseCount: result.receipt.comparison.caseCount,
    mismatchCount: result.receipt.comparison.mismatchCount,
    receiptBytes: result.bytes.length,
    receiptSha256: result.sha256
  }, null, 2)}\n`);
  if (result.receipt.status !== "exact-source-parity-verified") process.exitCode = 1;
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Qwen Tokenizer2 parity verification failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  EXECUTION_PROFILE_SCHEMA,
  RECEIPT_SCHEMA,
  RESULT_SCHEMA,
  VERIFICATION_PROFILE_SCHEMA,
  canonicalJsonBytes,
  compareResultSets,
  executionProfilePath,
  repositoryRoot,
  sha256,
  sourceClosureSha256,
  validateExecutionProfile,
  validateExecutionProfileFile,
  validatePreregistrationFiles,
  validateResultDocument,
  validateRunSetPaths,
  validateVerificationProfile,
  verificationProfilePath,
  verifyParity,
  writeCreateOnly
});
