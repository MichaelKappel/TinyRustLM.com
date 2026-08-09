"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");
const {
  validateVnextSchemaWithRegistry,
  validatorId: registryValidatorId
} = require("../tools/vnext-contract-validator-registry.js");
const {
  validateVnextSchemaIndependently,
  validatorId: independentValidatorId
} = require("../tools/vnext-contract-validator-independent.js");
const {
  buildCorpusText,
  corpusPath,
  corpusSchema
} = require("../tools/vnext-contract-corpus-generator.js");

const registryPath = path.resolve(__dirname, "../../contracts/vnext/contract-family.v1.json");
const registryValidatorPath = path.resolve(
  __dirname,
  "../tools/vnext-contract-validator-registry.js"
);
const independentValidatorPath = path.resolve(
  __dirname,
  "../tools/vnext-contract-validator-independent.js"
);
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

function loadCorpus() {
  return parseStrictJson(fs.readFileSync(corpusPath), {
    maximumBytes: 512 * 1024,
    maximumDepth: 8,
    maximumTotalEntries: 1024,
    maximumObjectMembers: 8,
    maximumArrayItems: 128,
    maximumStringCodeUnits: 64 * 1024,
    maximumTotalStringCodeUnits: 256 * 1024,
    maximumNumberCharacters: 16
  });
}

function validators() {
  return [validateVnextSchemaWithRegistry, validateVnextSchemaIndependently];
}

function reverseObjectKeys(value) {
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).reverse().map((key) =>
    [key, reverseObjectKeys(value[key])]));
}

function collectObjectPaths(value, current = [], result = []) {
  if (value === null || typeof value !== "object") return result;
  if (!Array.isArray(value)) result.push(current);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectObjectPaths(entry, [...current, index], result));
  } else {
    for (const [key, entry] of Object.entries(value)) {
      collectObjectPaths(entry, [...current, key], result);
    }
  }
  return result;
}

function resolvePath(value, parts) {
  return parts.reduce((current, part) => current[part], value);
}

test("keeps the exact language-neutral corpus reproducible and content bound", () => {
  const bytes = fs.readFileSync(corpusPath);
  const corpus = loadCorpus();
  assert.deepEqual(Object.keys(corpus), [
    "schema", "registrySha256", "generatorSourceSha256", "encoding",
    "caseCount", "cases"
  ]);
  assert.equal(corpus.schema, corpusSchema);
  assert.equal(corpus.encoding, "base64-raw-json");
  assert.equal(corpus.caseCount, corpus.cases.length);
  assert.equal(corpus.cases.length, 69);
  assert.equal(bytes.toString("utf8"), buildCorpusText());
  assert.equal(corpus.registrySha256, sha256(fs.readFileSync(registryPath)));

  const ids = new Set();
  for (const item of corpus.cases) {
    assert.deepEqual(Object.keys(item), [
      "id", "contractClass", "expected", "payloadBytes", "payloadSha256",
      "payloadBase64"
    ]);
    assert.match(item.id, /^[a-z][a-z0-9-]+$/u);
    assert.equal(ids.has(item.id), false, `duplicate case ${item.id}`);
    ids.add(item.id);
    assert.ok(["accept", "reject"].includes(item.expected));
    const payload = Buffer.from(item.payloadBase64, "base64");
    assert.equal(payload.toString("base64"), item.payloadBase64);
    assert.equal(payload.length, item.payloadBytes);
    assert.equal(sha256(payload), item.payloadSha256);
  }
});

test("keeps independent schema logic isolated from the registry interpreter", () => {
  assert.notEqual(registryValidatorId, independentValidatorId);
  const registrySource = fs.readFileSync(registryValidatorPath, "utf8");
  const independentSource = fs.readFileSync(independentValidatorPath, "utf8");
  assert.doesNotMatch(registrySource, /vnext-contract-validator-independent/u);
  assert.doesNotMatch(independentSource, /vnext-contract-validator-registry/u);
  assert.doesNotMatch(independentSource, /contract-family\.v1\.json/u);
  assert.doesNotMatch(independentSource, /\brequire\(["']node:fs["']\)/u);
  assert.match(registrySource, /contract-family\.v1\.json/u);
  assert.match(independentSource, /tinyrustlm\.vnext\.artifact_manifest\.v1/u);
  assert.match(independentSource, /tinyrustlm\.vnext\.claim\.v1/u);
});

test("makes both validators agree with every expected corpus verdict", () => {
  const corpus = loadCorpus();
  const registry = parseStrictJson(fs.readFileSync(registryPath));
  const contractsByClass = new Map(
    registry.contracts.map((contract) => [contract.class, contract])
  );
  const acceptedClasses = new Set();
  const rejectedClasses = new Set();
  let accepted = 0;
  let rejected = 0;

  for (const item of corpus.cases) {
    const payload = Buffer.from(item.payloadBase64, "base64");
    const outcomes = [];
    for (const validate of [
      validateVnextSchemaWithRegistry,
      validateVnextSchemaIndependently
    ]) {
      try {
        outcomes.push({ accepted: true, result: validate(payload) });
      } catch (error) {
        outcomes.push({ accepted: false, error });
      }
    }
    const expected = item.expected === "accept";
    assert.equal(outcomes[0].accepted, expected,
      `${item.id} registry validator disagreed with expected verdict`);
    assert.equal(outcomes[1].accepted, expected,
      `${item.id} independent validator disagreed with expected verdict`);
    assert.equal(outcomes[0].accepted, outcomes[1].accepted,
      `${item.id} validators disagreed`);

    if (expected) {
      accepted += 1;
      acceptedClasses.add(item.contractClass);
      for (const outcome of outcomes) {
        assert.equal(outcome.result.validationLevel, "schema-and-local-invariants");
        assert.equal(outcome.result.contractClass, item.contractClass);
      }
      const contract = contractsByClass.get(item.contractClass);
      const checked = outcomes[0].result.checkedInvariants;
      const deferred = outcomes[0].result.deferredInvariants;
      const notApplicable = outcomes[0].result.notApplicableInvariants;
      assert.equal(checked.some((id) => deferred.includes(id)), false);
      assert.equal(checked.some((id) => notApplicable.includes(id)), false);
      assert.equal(deferred.some((id) => notApplicable.includes(id)), false);
      assert.deepEqual([...new Set([...checked, ...deferred, ...notApplicable])].sort(),
        [...contract.invariants].sort());
    } else {
      rejected += 1;
      rejectedClasses.add(item.contractClass);
      for (const outcome of outcomes) {
        assert.match(outcome.error.code, /^[a-z][a-z0-9_]*$/u);
        assert.ok(outcome.error.message.length <= 256);
      }
    }
  }

  assert.equal(accepted, 14);
  assert.equal(rejected, 55);
  assert.deepEqual([...acceptedClasses].sort(), [...contractsByClass.keys()].sort());
  assert.deepEqual([...rejectedClasses].sort(), [
    "artifact", "claim", "companion", "context", "p2p", "parser", "proof",
    "receipt", "release", "worker"
  ]);
});

test("accepts key-order permutations and rejects every missing root field", () => {
  const accepted = loadCorpus().cases.filter((item) => item.expected === "accept");
  let deletedFieldRuns = 0;
  for (const item of accepted) {
    const original = JSON.parse(Buffer.from(item.payloadBase64, "base64").toString("utf8"));
    const permuted = Buffer.from(JSON.stringify(reverseObjectKeys(original)), "utf8");
    for (const validate of validators()) assert.doesNotThrow(() => validate(permuted), item.id);

    for (const field of Object.keys(original)) {
      const candidate = JSON.parse(JSON.stringify(original));
      delete candidate[field];
      const bytes = Buffer.from(JSON.stringify(candidate), "utf8");
      for (const validate of validators()) {
        assert.throws(() => validate(bytes), (error) =>
          typeof error.code === "string", `${item.id} accepted missing ${field}`);
        deletedFieldRuns += 1;
      }
    }
  }
  assert.ok(deletedFieldRuns >= 400);
});

test("rejects unknown fields at every reachable object depth", () => {
  const accepted = loadCorpus().cases.filter((item) => item.expected === "accept");
  let injectionRuns = 0;
  for (const item of accepted) {
    const original = JSON.parse(Buffer.from(item.payloadBase64, "base64").toString("utf8"));
    for (const objectPath of collectObjectPaths(original)) {
      const candidate = JSON.parse(JSON.stringify(original));
      resolvePath(candidate, objectPath).unexpectedField = true;
      const bytes = Buffer.from(JSON.stringify(candidate), "utf8");
      for (const validate of validators()) {
        assert.throws(() => validate(bytes), (error) =>
          error.code === "field_unknown", `${item.id} accepted an unknown nested field`);
        injectionRuns += 1;
      }
    }
  }
  assert.ok(injectionRuns >= 100);
});

test("reports cryptographic and cross-receipt proof obligations as deferred", () => {
  const proofCase = loadCorpus().cases.find((item) => item.id === "valid-proof");
  const result = validateVnextSchemaWithRegistry(Buffer.from(proofCase.payloadBase64, "base64"));
  assert.ok(result.deferredInvariants.includes("proof-id-domain-hash"));
  assert.ok(result.deferredInvariants.includes("complete-transfer-matches-p2p-artifact"));
  assert.ok(result.deferredInvariants.includes("observer-signature-parent-required"));
  assert.equal(result.checkedInvariants.includes("complete-transfer-matches-p2p-artifact"), false);
});

test("reports absent receipt security subtypes as not applicable instead of deferred", () => {
  const receiptCase = loadCorpus().cases.find((item) => item.id === "valid-receipt");
  const result = validateVnextSchemaWithRegistry(Buffer.from(receiptCase.payloadBase64, "base64"));
  const subtypeInvariants = [
    "redaction-scan-binds-target-hash-without-cycle",
    "signed-schema-known-exact",
    "signature-role-domain-match",
    "signature-key-registry-role-scope-time-valid",
    "authority-registry-window-valid",
    "authority-registry-chain-valid",
    "revocation-time-valid",
    "revocation-chain-role-valid",
    "offline-bundle-schema-set-complete",
    "offline-bundle-closure-complete"
  ];

  for (const invariantId of subtypeInvariants) {
    assert.ok(result.notApplicableInvariants.includes(invariantId), invariantId);
    assert.equal(result.deferredInvariants.includes(invariantId), false, invariantId);
  }
});
