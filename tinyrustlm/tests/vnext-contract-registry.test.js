"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");

const registryPath = path.resolve(
  __dirname,
  "../../contracts/vnext/contract-family.v1.json"
);
const inventoryPath = path.resolve(
  __dirname,
  "../../docs/architecture/vnext-contract-inventory.md"
);
const exactKeys = (value, keys, label) => {
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), `${label} fields changed`);
};

function registry() {
  return parseStrictJson(fs.readFileSync(registryPath));
}

test("strictly parses one frozen incompatible contract registry", () => {
  const value = registry();
  exactKeys(value, [
    "schema", "familyId", "status", "compatibility", "unknownFieldPolicy",
    "canonicalJsonProfile", "identityProfile", "limits", "redaction",
    "records", "contracts"
  ], "registry");
  assert.equal(value.schema, "tinyrustlm.vnext.contract_registry.v1");
  assert.equal(value.status, "frozen");
  assert.equal(value.compatibility, "incompatible-clean-slate");
  assert.equal(value.unknownFieldPolicy, "reject-at-every-object");
  exactKeys(value.identityProfile, [
    "hashAlgorithm", "contentIdPrefix", "hexCase", "domainSeparatorByte",
    "identityExclusionsDeclaredPerContract"
  ], "identity profile");
  assert.equal(value.identityProfile.hashAlgorithm, "sha256");
  assert.equal(value.identityProfile.contentIdPrefix, "sha256:");
  assert.equal(value.identityProfile.hexCase, "lowercase");
  assert.equal(value.identityProfile.domainSeparatorByte, 0);
  assert.equal(value.identityProfile.identityExclusionsDeclaredPerContract, true);
});

test("matches the nine inventoried schema names, visibility classes, and byte limits", () => {
  const value = registry();
  const inventory = fs.readFileSync(inventoryPath, "utf8");
  assert.equal(value.contracts.length, 9);
  assert.deepEqual(value.contracts.map((contract) => contract.class), [
    "artifact", "receipt", "context", "worker", "companion",
    "p2p", "proof", "release", "claim"
  ]);
  for (const contract of value.contracts) {
    assert.ok(inventory.includes(`\`${contract.schema}\``));
    assert.ok(inventory.includes(`| ${contract.maximumBytes.toLocaleString("en-US")} |`));
    assert.ok(["private", "public-safe"].includes(contract.visibility));
    assert.ok(contract.maximumBytes > 0 && Number.isSafeInteger(contract.maximumBytes));
  }
  assert.deepEqual(value.redaction.publicSafeClasses,
    value.contracts.filter((contract) => contract.visibility === "public-safe")
      .map((contract) => contract.class));
  assert.deepEqual(value.redaction.privateClasses,
    value.contracts.filter((contract) => contract.visibility === "private")
      .map((contract) => contract.class));
});

test("closes every root and nested record with unique required fields", () => {
  const value = registry();
  const recordNames = new Set(value.records.map((record) => record.name));
  assert.equal(recordNames.size, value.records.length, "duplicate record name");
  const scalarTypes = new Set([
    "content-id", "date", "ed25519-public-key", "ed25519-signature",
    "https-url", "public-path", "safe-id", "semver",
    "sha256", "source-revision", "utc"
  ]);
  const allowedTypes = new Set([
    "array", "bounded-string", "enum", "integer", "literal", "nullable", "record",
    ...scalarTypes
  ]);
  const referenceExists = (reference, label) => {
    if (reference.startsWith("record:")) {
      assert.ok(recordNames.has(reference.slice("record:".length)),
        `${label} references an unknown record`);
      return;
    }
    assert.ok(scalarTypes.has(reference), `${label} references an unknown value type`);
  };
  const inspectFields = (fields, label) => {
    assert.ok(Array.isArray(fields) && fields.length > 0, `${label} has no fields`);
    assert.equal(new Set(fields.map((field) => field.name)).size, fields.length,
      `${label} has duplicate fields`);
    for (const field of fields) {
      assert.match(field.name, /^[a-z][A-Za-z0-9]*$/u, `${label} field name is invalid`);
      assert.equal(field.required, true, `${label}.${field.name} must be required`);
      assert.ok(allowedTypes.has(field.type), `${label}.${field.name} type is unknown`);
      const commonKeys = ["name", "type", "required"];
      if (scalarTypes.has(field.type)) {
        exactKeys(field, commonKeys, `${label}.${field.name}`);
      } else if (field.type === "literal") {
        exactKeys(field, [...commonKeys, "value"], `${label}.${field.name}`);
        assert.ok(typeof field.value === "string" || Number.isSafeInteger(field.value));
      } else if (field.type === "enum") {
        exactKeys(field, [...commonKeys, "values"], `${label}.${field.name}`);
        assert.ok(Array.isArray(field.values) && field.values.length > 0);
        assert.equal(new Set(field.values).size, field.values.length);
        assert.deepEqual(field.values, [...field.values].sort());
        for (const enumValue of field.values) {
          assert.equal(typeof enumValue, "string");
        }
      } else if (field.type === "integer") {
        exactKeys(field, [...commonKeys, "minimum", "maximum"], `${label}.${field.name}`);
        assert.ok(Number.isSafeInteger(field.minimum));
        assert.ok(Number.isSafeInteger(field.maximum));
        assert.ok(field.minimum <= field.maximum);
      } else if (field.type === "bounded-string") {
        exactKeys(field, [...commonKeys, "minimumLength", "maximumLength"],
          `${label}.${field.name}`);
        assert.ok(Number.isSafeInteger(field.minimumLength) && field.minimumLength >= 0);
        assert.ok(Number.isSafeInteger(field.maximumLength));
        assert.ok(field.minimumLength <= field.maximumLength);
      } else if (field.type === "record") {
        exactKeys(field, [...commonKeys, "record"], `${label}.${field.name}`);
        assert.ok(recordNames.has(field.record), `${label}.${field.name} record is unknown`);
      } else if (field.type === "nullable") {
        exactKeys(field, [...commonKeys, "valueType"], `${label}.${field.name}`);
        referenceExists(field.valueType, `${label}.${field.name}`);
      } else if (field.type === "array") {
        const allowedKeys = new Set([
          ...commonKeys, "items", "minimumItems", "maximumItems",
          "unique", "sorted", "uniqueBy", "sortedBy"
        ]);
        for (const key of Object.keys(field)) {
          assert.ok(allowedKeys.has(key), `${label}.${field.name}.${key} is unknown`);
        }
        for (const key of [...commonKeys, "items", "minimumItems", "maximumItems"]) {
          assert.ok(Object.hasOwn(field, key), `${label}.${field.name}.${key} is missing`);
        }
        referenceExists(field.items, `${label}.${field.name}`);
        assert.ok(Number.isSafeInteger(field.minimumItems) && field.minimumItems >= 0);
        assert.ok(Number.isSafeInteger(field.maximumItems));
        assert.ok(field.minimumItems <= field.maximumItems);
        const scalarOrder = Object.hasOwn(field, "unique") || Object.hasOwn(field, "sorted");
        const keyedOrder = Object.hasOwn(field, "uniqueBy") || Object.hasOwn(field, "sortedBy");
        assert.equal(scalarOrder && keyedOrder, false,
          `${label}.${field.name} mixes scalar and keyed ordering`);
        if (scalarOrder) {
          assert.equal(field.unique, true);
          assert.equal(field.sorted, true);
        }
        if (keyedOrder) {
          assert.equal(typeof field.uniqueBy, "string");
          assert.equal(field.sortedBy, field.uniqueBy);
          assert.match(field.items, /^record:/u);
          const itemRecord = value.records.find((record) =>
            record.name === field.items.slice("record:".length));
          assert.ok(itemRecord.fields.some((itemField) => itemField.name === field.uniqueBy),
            `${label}.${field.name} order key is not in its item record`);
        }
      }
    }
  };
  for (const record of value.records) {
    exactKeys(record, ["name", "fields"], `record ${record.name}`);
    assert.match(record.name, /^[a-z][A-Za-z0-9]*$/u);
    inspectFields(record.fields, `record ${record.name}`);
  }
  for (const contract of value.contracts) {
    exactKeys(contract, [
      "class", "schema", "maximumBytes", "visibility", "identityDomain",
      "identityDerivation", "identityField", "canonicalHashField",
      "identityExcludedFields", "invariants", "fields"
    ], `contract ${contract.class}`);
    inspectFields(contract.fields, `contract ${contract.class}`);
    assert.deepEqual(contract.fields[0], {
      name: "schema",
      type: "literal",
      required: true,
      value: contract.schema
    });
    assert.ok([
      "complete-artifact-sha256", "domain-separated-jcs", "private-correlation-only"
    ].includes(contract.identityDerivation));
    assert.equal(new Set(contract.identityExcludedFields).size,
      contract.identityExcludedFields.length);
    assert.deepEqual(contract.identityExcludedFields,
      [...contract.identityExcludedFields].sort());
    for (const excludedField of contract.identityExcludedFields) {
      assert.ok(contract.fields.some((field) => field.name === excludedField),
        `contract ${contract.class} excludes an unknown identity field`);
    }
    if (contract.identityDerivation === "private-correlation-only") {
      assert.equal(contract.identityDomain, null);
      assert.equal(contract.identityField, null);
      assert.equal(contract.canonicalHashField, null);
      assert.deepEqual(contract.identityExcludedFields, []);
    } else {
      assert.equal(typeof contract.identityDomain, "string");
      assert.ok(contract.fields.some((field) => field.name === contract.identityField));
      assert.ok(contract.fields.some((field) => field.name === contract.canonicalHashField));
      assert.ok(contract.identityExcludedFields.includes(contract.canonicalHashField));
    }
    if (contract.identityDerivation === "domain-separated-jcs") {
      assert.ok(contract.identityExcludedFields.includes(contract.identityField));
    }
    if (contract.identityDerivation === "complete-artifact-sha256") {
      assert.equal(contract.identityField, "artifactId");
      assert.equal(contract.identityExcludedFields.includes(contract.identityField), false);
    }
    assert.ok(Array.isArray(contract.invariants) && contract.invariants.length > 0,
      `contract ${contract.class} has no invariants`);
    assert.equal(new Set(contract.invariants).size, contract.invariants.length,
      `contract ${contract.class} has duplicate invariants`);
    for (const invariant of contract.invariants) {
      assert.match(invariant, /^[a-z][a-z0-9-]*$/u,
        `contract ${contract.class} has an invalid invariant identifier`);
    }
  }
});

test("binds signing, context provenance, redaction, and public claims explicitly", () => {
  const value = registry();
  const records = Object.fromEntries(value.records.map((record) => [record.name, record]));
  const contracts = Object.fromEntries(value.contracts.map((contract) => [contract.class, contract]));
  const field = (owner, name) => owner.fields.find((candidate) => candidate.name === name);

  assert.deepEqual(records.redaction.fields, [
    { name: "profile", type: "literal", required: true,
      value: "tinyrustlm.vnext.public_safe.v1" },
    { name: "decision", type: "literal", required: true, value: "public-safe" }
  ]);
  assert.equal(JSON.stringify(value).includes("scanReceiptId"), false);
  for (const contract of value.contracts.filter((candidate) =>
    candidate.visibility === "public-safe")) {
    assert.deepEqual(field(contract, "redaction"), {
      name: "redaction", type: "record", required: true, record: "redaction"
    }, `${contract.class} has no explicit redaction profile`);
  }

  for (const securityType of [
    "authority-registry", "key-revocation", "offline-verification-bundle",
    "signature-envelope"
  ]) {
    assert.ok(field(contracts.receipt, "receiptType").values.includes(securityType));
  }
  for (const securityField of [
    "authorityRegistry", "keyRevocation", "offlineBundle", "signatureEnvelope"
  ]) {
    assert.match(field(contracts.receipt, securityField).valueType, /^record:/u);
  }
  assert.equal(field(records.signatureEnvelope, "algorithm").value, "ed25519");
  assert.equal(field(records.signatureEnvelope, "signature").type, "ed25519-signature");
  assert.equal(field(records.authorityKey, "publicKey").type, "ed25519-public-key");
  assert.ok(field(records.signatureEnvelope, "role").values.includes("release-authorizer"));
  assert.ok(field(records.signatureEnvelope, "role").values.includes("outside-network-observer"));

  for (const contextField of [
    "sourceKind", "sourceRecordIds", "sourceReceiptIds",
    "supersedesSourceRecordIds", "conflictGroupId"
  ]) {
    assert.ok(field(records.contextSegment, contextField),
      `context segment is missing ${contextField}`);
  }
  assert.ok(field(records.contextSegment, "sourceKind").values.includes("tool-output"));
  assert.ok(field(records.contextSegment, "sourceKind").values.includes("untrusted-memory"));
  assert.ok(field(records.contextSegment, "sourceKind").values.includes("current-user"));

  for (const claimField of [
    "siteId", "route", "component", "wordingClass", "evidenceTier",
    "sourceRevision", "releaseId", "effectiveAtUtc", "expiresAtUtc",
    "reviewAtUtc", "ownerId"
  ]) {
    assert.ok(field(contracts.claim, claimField), `claim is missing ${claimField}`);
  }
  assert.deepEqual(field(contracts.claim, "status").values, [
    "blocked", "draft", "externally-verified", "locally-verified", "published",
    "retracted", "stale"
  ]);
});

test("freezes finite parser limits and a private-by-default redaction policy", () => {
  const value = registry();
  exactKeys(value.limits, [
    "maximumDepth", "maximumTotalEntries", "maximumObjectMembers",
    "maximumArrayItems", "maximumStringCodeUnits", "maximumTotalStringCodeUnits",
    "maximumNumberCharacters", "maximumSafeInteger"
  ], "limits");
  for (const limit of Object.values(value.limits)) {
    assert.ok(Number.isSafeInteger(limit) && limit > 0);
  }
  exactKeys(value.redaction, [
    "profile", "defaultVisibility", "publicSafeClasses", "privateClasses",
    "requiredPublicScanReceipt", "forbiddenFieldNames", "forbiddenValueClasses",
    "publicUrlPolicy", "errorPolicy", "screenshotPolicy"
  ], "redaction policy");
  assert.equal(value.redaction.defaultVisibility, "private");
  assert.equal(value.redaction.requiredPublicScanReceipt, true);
  assert.equal(value.redaction.publicUrlPolicy, "https-no-userinfo-query-fragment");
  assert.equal(new Set(value.redaction.forbiddenFieldNames).size,
    value.redaction.forbiddenFieldNames.length);
  assert.equal(new Set(value.redaction.forbiddenValueClasses).size,
    value.redaction.forbiddenValueClasses.length);
  for (const forbidden of [
    "authorizationHeader", "enrollmentSecret", "modelBytes", "privateKey",
    "rawHostedMemory", "rawOutput", "rawPrompt", "workspaceKey"
  ]) {
    assert.ok(value.redaction.forbiddenFieldNames.includes(forbidden));
  }
});

test("contains no extension, fallback, migration, or dated-schema acceptance field", () => {
  const value = registry();
  const text = fs.readFileSync(registryPath, "utf8");
  assert.doesNotMatch(text, /(?:extensions|fallback|legacy|migration|previousSchema|supportedVersions)/iu);
  const declaredSchemas = [value.schema, ...value.contracts.map((contract) => contract.schema)];
  for (const schema of declaredSchemas) {
    assert.match(schema, /^tinyrustlm\.vnext\.[a-z0-9_.-]+\.v1$/u);
    assert.doesNotMatch(schema, /^tinyrustlm\.vnext\.20\d{2}[._-]/u);
  }
});
