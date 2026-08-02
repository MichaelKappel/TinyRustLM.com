"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { TextDecoder } = require("node:util");

const { validateLedgerFile } = require("./vector-experiment-ledger.js");
const {
  validateManifestFile
} = require("./vector-retrieval-preregistration.js");
const {
  readGitBlob
} = require("./vector-historical-git-input.js");
const {
  productionLineageReader
} = require("./clean-history-lineage.js");

const receiptSchema = "tinyrustlm.exact_flat_retrieval_verification_receipt.v2";
const repositoryRoot = path.resolve(__dirname, "../..");
const receiptRelativePath =
  "tinyrustlm/experiments/vector-quantization/exact-flat-retrieval-verification-v2.json";
const receiptPath = path.join(repositoryRoot, receiptRelativePath);
const expectedReceiptBytes = 13322;
const expectedReceiptSha256 =
  "95b36d822d3c49ec342e54ad277eb4e6925a59cffdea40fdeefe15d263bcbc7c";
const expectedGenerationBaseCommit =
  "b673f519a9af53e1179c0f62c765d9ecc4a96fe4";
const receiptEvidenceCommit =
  "f3b3dbbb60f9a6b6b696487a349e0d6d25199af7";
const previousReceiptRelativePath =
  "tinyrustlm/experiments/vector-quantization/exact-flat-retrieval-verification-v1.json";
const previousReceiptPath = path.join(repositoryRoot, previousReceiptRelativePath);
const expectedPreviousReceiptSchema =
  "tinyrustlm.exact_flat_retrieval_verification_receipt.v1";
const expectedPreviousReceiptId = "exact-flat-retrieval-75f95baa316315ea";
const expectedPreviousReceiptSha256 =
  "893e96f461f701f46a3aaaeecddd67bc2b700625ccdb9f0d83ce4b0b67d8c18c";
const parentReceiptRelativePath =
  "tinyrustlm/experiments/vector-quantization/scalar-oracle-verification-v1.json";
const parentReceiptPath = path.join(repositoryRoot, parentReceiptRelativePath);
const expectedParentReceiptId = "scalar-oracle-foundation-51ab608f417c0b82";
const expectedParentReceiptSha256 =
  "8772ee70a2de21b294fc3d10c2634059c72062e33397472762462d04e7b7938b";
const maximumReceiptBytes = 1024 * 1024;
const maximumInputBytes = 16 * 1024 * 1024;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const inputCanonicalization = "utf8-lf-v1";
const forbiddenTextPattern =
  /(?:[a-z]:\\|\/home\/|\/mnt\/[a-z]\/|turn[0-9]+(?:search|view)[0-9]+|token=|secret=|bearer\s)/iu;

const inputPaths = Object.freeze([
  ".gitattributes",
  "Cargo.lock",
  "Cargo.toml",
  "rust/experiments/tinyrustlm-vector-oracle/Cargo.toml",
  "rust/experiments/tinyrustlm-vector-oracle/src/accounting.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/bitpack.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/codebook.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/error.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/flat_index.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/lib.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/metrics.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/prng.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/score.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/sha256.rs",
  "rust/experiments/tinyrustlm-vector-oracle/src/transform.rs",
  "rust/experiments/tinyrustlm-vector-oracle/tests/flat_index_test.rs",
  "rust/experiments/tinyrustlm-vector-oracle/tests/lib_test.rs",
  "tinyrustlm/experiments/vector-quantization/README.md",
  "tinyrustlm/experiments/vector-quantization/exact-flat-retrieval-preregistration.v1.json",
  "tinyrustlm/experiments/vector-quantization/source-claim-ledger.v1.json",
  "tinyrustlm/tests/vector-experiment-isolation.test.js",
  "tinyrustlm/tests/vector-experiment-ledger.test.js",
  "tinyrustlm/tests/vector-retrieval-preregistration.test.js",
  "tinyrustlm/tests/vector-retrieval-receipt.test.js",
  "tinyrustlm/tools/vector-experiment-ledger.js",
  "tinyrustlm/tools/vector-retrieval-preregistration.js",
  "tinyrustlm/tools/vector-retrieval-receipt.js"
]);

const requiredGates = Object.freeze([
  Object.freeze({
    gateId: "ledger-canonical-validation",
    executable: "node",
    arguments: Object.freeze([
      "tinyrustlm/tools/vector-experiment-ledger.js",
      "tinyrustlm/experiments/vector-quantization/source-claim-ledger.v1.json"
    ])
  }),
  Object.freeze({
    gateId: "retrieval-preregistration-validation",
    executable: "node",
    arguments: Object.freeze([
      "tinyrustlm/tools/vector-retrieval-preregistration.js",
      "tinyrustlm/experiments/vector-quantization/exact-flat-retrieval-preregistration.v1.json"
    ])
  }),
  Object.freeze({
    gateId: "research-boundary-tests",
    executable: "node",
    arguments: Object.freeze([
      "--test",
      "tinyrustlm/tests/vector-experiment-ledger.test.js",
      "tinyrustlm/tests/vector-experiment-isolation.test.js",
      "tinyrustlm/tests/vector-retrieval-preregistration.test.js"
    ])
  }),
  Object.freeze({
    gateId: "rustfmt",
    executable: "cargo",
    arguments: Object.freeze(["fmt", "--all", "--", "--check"])
  }),
  Object.freeze({
    gateId: "exact-flat-native-tests",
    executable: "cargo",
    arguments: Object.freeze(["test", "-p", "tinyrustlm-vector-oracle"])
  }),
  Object.freeze({
    gateId: "exact-flat-strict-clippy",
    executable: "cargo",
    arguments: Object.freeze([
      "clippy", "-p", "tinyrustlm-vector-oracle", "--all-targets", "--", "-D", "warnings"
    ])
  }),
  Object.freeze({
    gateId: "exact-flat-wasm32-check",
    executable: "cargo",
    arguments: Object.freeze([
      "check", "-p", "tinyrustlm-vector-oracle", "--target", "wasm32-unknown-unknown"
    ])
  }),
  Object.freeze({
    gateId: "exact-flat-rustdoc",
    executable: "cargo",
    arguments: Object.freeze(["doc", "-p", "tinyrustlm-vector-oracle", "--no-deps"])
  })
]);

const optionalProbes = Object.freeze([
  Object.freeze({
    gapId: "measured-line-coverage",
    executable: "cargo",
    arguments: Object.freeze(["llvm-cov", "--version"]),
    requiredTargetPercent: 75
  }),
  Object.freeze({
    gapId: "miri-memory-model-check",
    executable: "cargo",
    arguments: Object.freeze(["miri", "--version"]),
    requiredTargetPercent: null
  })
]);

const unexecutedGapDefinitions = Object.freeze([
  Object.freeze({
    gapId: "durable-filesystem-deletion-proof",
    statement: "No crash-recovered on-disk snapshot has proved tombstoned vector bytes absent after compaction."
  }),
  Object.freeze({
    gapId: "real-browser-wasm-execution",
    statement: "The crate compiles for wasm32 but has not executed in a real browser or browser WASM runtime."
  }),
  Object.freeze({
    gapId: "retrieval-corpus-quality-metrics",
    statement: "No sealed representative corpus has measured recall, MRR, NDCG, or product retrieval usefulness."
  }),
  Object.freeze({
    gapId: "target-hardware-performance",
    statement: "No preregistered target has measured latency, throughput, memory, or energy."
  })
]);

/** Throws a stable validation error when `condition` is false. */
function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

/** Returns whether `value` is a non-array JSON object. */
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Requires exactly the declared object keys. */
function exactKeys(value, keys, label) {
  invariant(isPlainObject(value), `${label} must be a JSON object`);
  const actual = Object.keys(value).sort();
  const expected = Array.from(keys).sort();
  invariant(JSON.stringify(actual) === JSON.stringify(expected), `${label} fields are invalid`);
}

/** Produces lowercase SHA-256 for one byte buffer. */
function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/** Canonicalizes one strict UTF-8 source input to platform-independent LF bytes. */
function canonicalInputBytes(bytes, label = "receipt input") {
  invariant(Buffer.isBuffer(bytes), `${label} bytes are invalid`);
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label} is not strict UTF-8`);
  }
  invariant(!text.includes("\u0000"), `${label} contains a NUL character`);
  return Buffer.from(text.replace(/\r\n?/gu, "\n"), "utf8");
}

/** Returns canonical pretty-printed receipt bytes. */
function canonicalReceiptBytes(receipt) {
  return Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, "utf8");
}

/** Hashes one canonical text input from the exact source commit sealed by a receipt. */
function hashHistoricalInput(relativePath, revision) {
  const sourceBytes = readGitBlob(
    repositoryRoot,
    revision,
    relativePath,
    maximumInputBytes
  );
  const bytes = canonicalInputBytes(sourceBytes, relativePath);
  return Object.freeze({
    path: relativePath,
    canonicalization: inputCanonicalization,
    bytes: bytes.length,
    sha256: sha256(bytes)
  });
}

/** Proves the dirty generation base was sealed by its one exact evidence commit. */
function validateEvidenceCommitLineage() {
  invariant(
    productionLineageReader().parentRevision(receiptEvidenceCommit) ===
      expectedGenerationBaseCommit,
    "receipt evidence commit lineage is invalid"
  );
}

/** Validates the immutable scalar parent receipt and returns its identity. */
function validateParentReceipt() {
  const metadata = fs.lstatSync(parentReceiptPath);
  invariant(metadata.isFile() && !metadata.isSymbolicLink(), "parent receipt must be a regular file");
  invariant(metadata.size > 0 && metadata.size <= maximumReceiptBytes,
    "parent receipt size is invalid");
  const bytes = fs.readFileSync(parentReceiptPath);
  invariant(sha256(bytes) === expectedParentReceiptSha256, "parent receipt bytes changed");
  const parsed = JSON.parse(bytes.toString("utf8"));
  invariant(parsed.receiptId === expectedParentReceiptId, "parent receipt identity changed");
  invariant(parsed.productAuthority === false && parsed.trainingAuthority === false,
    "parent receipt contains unsupported authority");
  return Object.freeze({
    path: parentReceiptRelativePath,
    receiptId: expectedParentReceiptId,
    sha256: expectedParentReceiptSha256
  });
}

/** Reads and validates the untouched v1 receipt that this v2 receipt supersedes. */
function validatePreviousReceiptFile() {
  const metadata = fs.lstatSync(previousReceiptPath);
  invariant(metadata.isFile() && !metadata.isSymbolicLink(),
    "previous receipt must be a regular file");
  invariant(metadata.size > 0 && metadata.size <= maximumReceiptBytes,
    "previous receipt size is invalid");
  const bytes = fs.readFileSync(previousReceiptPath);
  invariant(sha256(bytes) === expectedPreviousReceiptSha256,
    "previous receipt bytes changed");
  const parsed = JSON.parse(bytes.toString("utf8"));
  invariant(bytes.equals(canonicalReceiptBytes(parsed)),
    "previous receipt bytes are not canonical");
  invariant(parsed.schema === expectedPreviousReceiptSchema,
    "previous receipt schema changed");
  invariant(parsed.receiptId === expectedPreviousReceiptId,
    "previous receipt identity changed");
  invariant(parsed.productAuthority === false && parsed.trainingAuthority === false,
    "previous receipt contains unsupported authority");
  return Object.freeze({
    receipt: parsed,
    bytes: bytes.length,
    sha256: expectedPreviousReceiptSha256
  });
}

/** Returns the immutable v1 reference recorded by the current v2 receipt. */
function validatePreviousReceipt() {
  const previous = validatePreviousReceiptFile();
  return Object.freeze({
    path: previousReceiptRelativePath,
    schema: expectedPreviousReceiptSchema,
    receiptId: expectedPreviousReceiptId,
    sha256: previous.sha256
  });
}

/** Validates receipt schema, revision-bound inputs, authority boundaries, and open gaps. */
function validateReceipt(receipt) {
  exactKeys(receipt, [
    "schema", "receiptId", "generatedAtUtc", "status", "gitHead", "dirtyWorktree",
    "productAuthority", "trainingAuthority", "previousReceipt", "parentReceipt",
    "sourceLedger", "preregistration", "inputSetSha256", "inputs", "toolchain",
    "gates", "toolingGaps", "unexecutedGaps", "scope", "requiredNextGate"
  ], "receipt");
  invariant(receipt.schema === receiptSchema, "receipt schema is unsupported");
  invariant(receipt.status === "experiment-baseline-verified-with-open-promotion-gaps",
    "receipt status is invalid");
  invariant(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(receipt.generatedAtUtc)
    && Number.isFinite(Date.parse(receipt.generatedAtUtc)), "generatedAtUtc is invalid");
  invariant(receipt.productAuthority === false, "receipt must not grant product authority");
  invariant(receipt.trainingAuthority === false, "receipt must not grant training authority");
  invariant(receipt.dirtyWorktree === true,
    "receipt must preserve its dirty-worktree generation fact");
  invariant(receipt.gitHead === expectedGenerationBaseCommit,
    "gitHead is not the sealed generation base");
  validateEvidenceCommitLineage();

  exactKeys(receipt.previousReceipt, ["path", "schema", "receiptId", "sha256"],
    "receipt.previousReceipt");
  invariant(JSON.stringify(receipt.previousReceipt) === JSON.stringify(validatePreviousReceipt()),
    "previous receipt binding is invalid");

  exactKeys(receipt.parentReceipt, ["path", "receiptId", "sha256"], "receipt.parentReceipt");
  invariant(JSON.stringify(receipt.parentReceipt) === JSON.stringify(validateParentReceipt()),
    "parent receipt binding is invalid");

  const sourceLedger = validateLedgerFile(path.join(repositoryRoot,
    "tinyrustlm/experiments/vector-quantization/source-claim-ledger.v1.json"));
  exactKeys(receipt.sourceLedger, ["path", "ledgerId", "sha256"], "receipt.sourceLedger");
  invariant(JSON.stringify(receipt.sourceLedger) === JSON.stringify({
    path: "tinyrustlm/experiments/vector-quantization/source-claim-ledger.v1.json",
    ledgerId: sourceLedger.ledger.ledgerId,
    sha256: sourceLedger.sha256
  }), "source-ledger binding is invalid");

  const preregistration = validateManifestFile();
  exactKeys(receipt.preregistration, ["path", "experimentId", "sha256"],
    "receipt.preregistration");
  invariant(JSON.stringify(receipt.preregistration) === JSON.stringify({
    path: "tinyrustlm/experiments/vector-quantization/exact-flat-retrieval-preregistration.v1.json",
    experimentId: preregistration.manifest.experimentId,
    sha256: preregistration.sha256
  }), "preregistration binding is invalid");

  invariant(sha256Pattern.test(receipt.inputSetSha256), "inputSetSha256 is invalid");
  invariant(Array.isArray(receipt.inputs) && receipt.inputs.length === inputPaths.length,
    "receipt input cardinality is invalid");
  const historicalInputs = inputPaths.map(
    (relativePath) => hashHistoricalInput(relativePath, receiptEvidenceCommit)
  );
  for (const [index, input] of receipt.inputs.entries()) {
    exactKeys(input, ["path", "canonicalization", "bytes", "sha256"],
      `receipt.inputs[${index}]`);
    invariant(input.path === inputPaths[index], `receipt input order is invalid at ${index}`);
    invariant(input.canonicalization === inputCanonicalization,
      `receipt input canonicalization is invalid at ${index}`);
    invariant(Number.isSafeInteger(input.bytes) && input.bytes > 0,
      `receipt input bytes are invalid at ${index}`);
    invariant(sha256Pattern.test(input.sha256), `receipt input hash is invalid at ${index}`);
  }
  invariant(JSON.stringify(receipt.inputs) === JSON.stringify(historicalInputs),
    "receipt inputs do not match their historical evidence commit");
  const historicalInputSetSha256 =
    sha256(Buffer.from(JSON.stringify(historicalInputs), "utf8"));
  invariant(receipt.inputSetSha256 === historicalInputSetSha256,
    "receipt input-set identity is invalid");
  invariant(
    receipt.receiptId ===
      `exact-flat-retrieval-${historicalInputSetSha256.slice(0, 16)}`,
    "receiptId is not bound to the input set");

  exactKeys(receipt.toolchain, ["rustc", "cargo", "node"], "receipt.toolchain");
  for (const [tool, version] of Object.entries(receipt.toolchain)) {
    invariant(typeof version === "string" && version.length > 0 && version.length <= 256,
      `toolchain version is invalid: ${tool}`);
  }

  invariant(Array.isArray(receipt.gates), "receipt gates must be an array");
  invariant(JSON.stringify(receipt.gates.map((gate) => gate.gateId))
    === JSON.stringify(requiredGates.map((gate) => gate.gateId)),
  "required gates are incomplete or reordered");
  for (const [index, gate] of receipt.gates.entries()) {
    exactKeys(gate, ["gateId", "command", "status", "exitCode", "outputSha256"],
      `receipt.gates[${index}]`);
    invariant(JSON.stringify(gate.command) === JSON.stringify([
      requiredGates[index].executable,
      ...requiredGates[index].arguments
    ]), `gate command is invalid: ${gate.gateId}`);
    invariant(gate.status === "passed" && gate.exitCode === 0
      && sha256Pattern.test(gate.outputSha256), `gate is not passing: ${gate.gateId}`);
  }

  invariant(Array.isArray(receipt.toolingGaps)
    && receipt.toolingGaps.length === optionalProbes.length,
  "tooling gaps are incomplete");
  for (const [index, gap] of receipt.toolingGaps.entries()) {
    exactKeys(gap, [
      "gapId", "probeCommand", "status", "requiredTargetPercent", "measuredPercent",
      "exitCode", "outputSha256", "errorCode"
    ], `receipt.toolingGaps[${index}]`);
    const definition = optionalProbes[index];
    invariant(gap.gapId === definition.gapId, `tooling-gap order is invalid at ${index}`);
    invariant(JSON.stringify(gap.probeCommand) === JSON.stringify([
      definition.executable,
      ...definition.arguments
    ]), `tooling-gap command is invalid: ${gap.gapId}`);
    invariant(["unavailable", "available-not-run"].includes(gap.status),
      `tooling-gap status is invalid: ${gap.gapId}`);
    invariant(gap.requiredTargetPercent === definition.requiredTargetPercent,
      `tooling-gap target is invalid: ${gap.gapId}`);
    invariant(gap.measuredPercent === null, `tooling gap has an unearned measurement: ${gap.gapId}`);
    invariant(Number.isInteger(gap.exitCode), `tooling-gap exit code is invalid: ${gap.gapId}`);
    invariant(sha256Pattern.test(gap.outputSha256), `tooling-gap output hash is invalid: ${gap.gapId}`);
    invariant(gap.errorCode === null || typeof gap.errorCode === "string",
      `tooling-gap error code is invalid: ${gap.gapId}`);
  }

  invariant(Array.isArray(receipt.unexecutedGaps)
    && receipt.unexecutedGaps.length === unexecutedGapDefinitions.length,
  "unexecuted promotion gaps are incomplete");
  for (const [index, gap] of receipt.unexecutedGaps.entries()) {
    exactKeys(gap, ["gapId", "status", "requiredForProductPromotion", "statement"],
      `receipt.unexecutedGaps[${index}]`);
    const definition = unexecutedGapDefinitions[index];
    invariant(gap.gapId === definition.gapId && gap.statement === definition.statement,
      `unexecuted gap is invalid: ${gap.gapId}`);
    invariant(gap.status === "not-run" && gap.requiredForProductPromotion === true,
      `unexecuted gap was incorrectly promoted: ${gap.gapId}`);
  }

  const verifiedScope = new Set([
    "scalarFoundationVerified",
    "exactFlatF32BaselineVerified",
    "canonicalPersistenceFormatVerified",
    "deletionAndCompactionSemanticsVerified"
  ]);
  exactKeys(receipt.scope, [
    "scalarFoundationVerified", "exactFlatF32BaselineVerified",
    "canonicalPersistenceFormatVerified", "deletionAndCompactionSemanticsVerified",
    "realWasmExecutionVerified", "nativePerformanceMeasured", "browserPerformanceMeasured",
    "namedTurboQuantArmVerified", "turboVecParityVerified", "compressedRetrievalVerified",
    "productRetrievalQualityVerified", "kvCacheQualityVerified"
  ], "receipt.scope");
  for (const [key, value] of Object.entries(receipt.scope)) {
    invariant(value === verifiedScope.has(key), `scope authority is invalid: ${key}`);
  }
  invariant(typeof receipt.requiredNextGate === "string"
    && receipt.requiredNextGate.length > 0 && receipt.requiredNextGate.length <= 1024,
  "requiredNextGate is invalid");
  invariant(!forbiddenTextPattern.test(JSON.stringify(receipt)),
    "receipt contains private or credential-like text");
  return receipt;
}

/** Reads a bounded canonical receipt and revalidates every revision-bound input. */
function validateReceiptFile(filePath = receiptPath) {
  const metadata = fs.lstatSync(filePath);
  invariant(metadata.isFile() && !metadata.isSymbolicLink(), "receipt must be a regular file");
  invariant(metadata.size > 0 && metadata.size <= maximumReceiptBytes, "receipt size is invalid");
  const bytes = fs.readFileSync(filePath);
  invariant(
    filePath !== receiptPath ||
      (bytes.length === expectedReceiptBytes &&
        sha256(bytes) === expectedReceiptSha256),
    "immutable v2 receipt bytes are invalid"
  );
  if (filePath === receiptPath) {
    const committedBytes = readGitBlob(
      repositoryRoot,
      receiptEvidenceCommit,
      receiptRelativePath,
      maximumReceiptBytes
    );
    invariant(bytes.equals(committedBytes),
      "immutable v2 receipt differs from its evidence commit");
  }
  const receipt = validateReceipt(JSON.parse(bytes.toString("utf8")));
  invariant(bytes.equals(canonicalReceiptBytes(receipt)), "receipt bytes are not canonical");
  return Object.freeze({ receipt, bytes: bytes.length, sha256: sha256(bytes) });
}

/** Revalidates and reports the immutable historical receipt. */
function main(argumentsList) {
  invariant(argumentsList.length === 1 && argumentsList[0] === "--validate",
    "usage: node vector-retrieval-receipt.js --validate");
  const validated = validateReceiptFile(receiptPath);
  process.stdout.write(`${JSON.stringify({
    schema: validated.receipt.schema,
    receiptId: validated.receipt.receiptId,
    previousReceiptId: validated.receipt.previousReceipt.receiptId,
    status: validated.receipt.status,
    inputCount: validated.receipt.inputs.length,
    gateCount: validated.receipt.gates.length,
    toolingGapCount: validated.receipt.toolingGaps.length,
    unexecutedGapCount: validated.receipt.unexecutedGaps.length,
    productAuthority: validated.receipt.productAuthority,
    trainingAuthority: validated.receipt.trainingAuthority,
    bytes: validated.bytes,
    sha256: validated.sha256
  }, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Vector retrieval receipt failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  canonicalInputBytes,
  canonicalReceiptBytes,
  expectedGenerationBaseCommit,
  expectedPreviousReceiptSha256,
  expectedReceiptSha256,
  inputCanonicalization,
  inputPaths,
  previousReceiptPath,
  receiptPath,
  receiptEvidenceCommit,
  receiptSchema,
  validatePreviousReceiptFile,
  validateReceipt,
  validateReceiptFile
});
