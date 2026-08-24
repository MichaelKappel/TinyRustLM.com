"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const registrationPath = path.join(
  repositoryRoot,
  "contracts/vnext/slm2-q8-weight-profile-preregistration.v1.json"
);
const architecturePath = path.join(
  repositoryRoot,
  "docs/architecture/2026-08-24-slm2-q8-weight-profile-preregistration.md"
);
const registrationBytes = fs.readFileSync(registrationPath);
const registration = JSON.parse(registrationBytes.toString("utf8"));

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function readRepositoryFile(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, ...relativePath.split("/")));
}

test("freezes exact output-free Q8 registration and parent authority", () => {
  assert.equal(registrationBytes.length, 15093);
  assert.equal(sha256(registrationBytes),
    "5a93bd61dfe7c2e0f7e9ffff6daa96820ec898f027383bc0df004e2643752968");
  assert.equal(registration.schema,
    "tinyrustlm.slm2-q8-weight-profile-preregistration.v1");
  assert.equal(registration.status,
    "registered-before-profile-vector-or-model-output");
  assert.equal(registration.registrationParentCommit,
    "0c25253ca3a9572d1f1bc152a091cd71cd4c992b");
  assert.equal(registration.registrationParentTree,
    "408b956dbf8d38cb6a8540366be591490ac011f9");

  const cleanCut = registration.authority.productionCleanCutRegistration;
  const cleanCutBytes = readRepositoryFile(cleanCut.path);
  assert.equal(cleanCutBytes.length, cleanCut.byteLength, cleanCut.path);
  assert.equal(sha256(cleanCutBytes), cleanCut.sha256, cleanCut.path);

  assert.deepEqual(registration.authority.currentUnpromotedF32Profile, {
    path: "contracts/vnext/slm2-format-profile.v1.json",
    byteLength: 19_303,
    sha256: "387c0ff4dd251da88192427b209efe941ddf9d0ff0a639352f0e5d3724b48625"
  });

  const architectureBytes = fs.readFileSync(architecturePath);
  assert.equal(architectureBytes.length, 5795);
  assert.equal(sha256(architectureBytes),
    "128f778ba66134d89794ff13f82ad787fc592af6f017c48ca465f669a3eafcb8");
});

test("keeps one prelaunch product and forbids compatibility debt", () => {
  assert.equal(registration.authority.productLifecycle,
    "prelaunch-single-product");
  assert.equal(registration.authority.productGenerationCount, 1);
  assert.equal(registration.authority.secondProductGenerationExists, false);
  assert.equal(registration.authority.technicalIdentifiersAreProductGenerations,
    false);
  assert.equal(registration.authority.modelContainer, "SLM2-only");

  for (const name of [
    "slm1Reader",
    "slm1Writer",
    "legacyQuantizationAlias",
    "genericQ8Alias",
    "dualProductionModelFormat",
    "runtimeRepacking",
    "profileNegotiation",
    "unknownProfileFallback",
    "implicitEncodingFromByteLength",
    "permissiveTail",
    "deferredExecutableCleanup",
    "testWeakening",
    "fixtureAsModelQuality",
    "namedTurboQuantOrTurboVecClaim",
    "oneBitModelClaim"
  ]) {
    assert.equal(registration.cleanSlateRules[name], false, name);
  }
});

test("quantization record covers exactly 128 bytes without overlap", () => {
  const quantRecord = registration.quantRecord;
  assert.equal(quantRecord.bytes, 128);
  const coverage = new Uint8Array(quantRecord.bytes);
  for (const field of quantRecord.fields) {
    assert.equal(Number.isInteger(field.offset), true, field.name);
    assert.equal(Number.isInteger(field.bytes), true, field.name);
    assert.ok(field.offset >= 0 && field.bytes > 0, field.name);
    assert.ok(field.offset + field.bytes <= quantRecord.bytes, field.name);
    for (let offset = field.offset; offset < field.offset + field.bytes; offset += 1) {
      assert.equal(coverage[offset], 0, `${field.name} overlaps byte ${offset}`);
      coverage[offset] = 1;
    }
  }
  assert.equal(coverage.every((value) => value === 1), true);
  assert.deepEqual(quantRecord.fields.map((field) => field.offset),
    [...quantRecord.fields].map((field) => field.offset).sort((a, b) => a - b));
  assert.equal(registration.containerChange.quantTable.count, 1);
  assert.equal(registration.containerChange.quantTable.recordBytes, 128);
  assert.deepEqual(registration.containerChange.sectionOrder, [
    "manifest",
    "string-table",
    "quantization-table",
    "tensor-table",
    "payloads"
  ]);
});

test("binds exact signed-row arithmetic and descriptor semantics", () => {
  const identities = registration.profileIdentities;
  assert.equal(identities.productionWeightProfile,
    "tinyrustlm.weight-q8-row-symmetric-f32-scale/1");
  assert.equal(identities.quantizerProfile,
    "tinyrustlm.quantize-q8-row-symmetric-f32/1");
  assert.equal(identities.kvProfile, "tinyrustlm.kv-f32/1");

  const enums = registration.encodingEnums;
  assert.equal(enums.elementType.q8RowSymmetric, 2);
  assert.equal(enums.scaleType.littleEndianF32, 1);
  assert.equal(enums.zeroPointType.none, 0);
  assert.equal(enums.packingOrder.outerRowsScaleThenSignedCodes, 1);
  assert.equal(enums.accumulatorType.binary32OrderedNoFma, 1);
  assert.equal(enums.tailRule.completeRank2RowsNoTailNoPadding, 1);
  assert.equal(
    enums.roundingMode.nearestHalfAwayFromZeroAfterBinary32Division, 1);

  const descriptor = registration.q8TensorRecord;
  assert.equal(descriptor.rank, 2);
  assert.equal(descriptor.elementType, 2);
  assert.equal(descriptor.quantProfileIndex, 0);
  assert.equal(descriptor.blockElements, "shape[1]");
  assert.equal(descriptor.blockBytes, "checked-add(shape[1],4)");
  assert.equal(descriptor.codeMinus128Allowed, false);
  assert.deepEqual(registration.rowPayload.code.clampInclusive, [-127, 127]);
  assert.equal(registration.rowPayload.interRowPaddingBytes, 0);
  assert.equal(registration.rowPayload.tensorTailBytes, 0);
  assert.equal(registration.scalarKernel.fusedMultiplyAdd, false);
  assert.equal(registration.scalarKernel.accumulator, "binary32");
});

test("partitions the closed tensor registry by exact semantic role", () => {
  const q8 = registration.tensorRolePolicy.q8Requirements;
  const f32 = registration.tensorRolePolicy.f32Requirements;
  assert.equal(q8.rank, 2);
  assert.equal(q8.roles.length, 9);
  assert.equal(f32.roles.length, 8);
  assert.equal(new Set(q8.roles).size, q8.roles.length);
  assert.equal(new Set(f32.roles).size, f32.roles.length);
  for (const role of q8.roles) {
    assert.equal(f32.roles.includes(role), false, role);
    assert.match(role, /(?:embedding|projection)\.weight$/u);
  }
  for (const role of f32.roles) {
    assert.equal(q8.roles.includes(role), false, role);
    assert.match(role, /(?:normalization\.weight|projection\.bias)$/u);
  }
  assert.equal(registration.tensorRolePolicy.selectionRule,
    "exact-semantic-role-not-name-pattern-or-byte-length");
});

test("requires a source-isolated independent oracle and exhaustive rejection", () => {
  const oracle = registration.independentOracleRules;
  assert.equal(oracle.language, "Node.js-builtins-only");
  assert.equal(oracle.mayInvokeRust, false);
  assert.equal(oracle.mayInvokeSubprocess, false);
  assert.equal(oracle.mayUseNetwork, false);
  assert.equal(oracle.mayReadGeneratedRustOutput, false);
  assert.deepEqual(oracle.roles, [
    "f32-to-q8-row-quantizer",
    "container-writer",
    "container-parser",
    "scalar-matvec-oracle",
    "hostile-mutation-generator"
  ]);
  assert.equal(registration.requiredVectors.everyProperArtifactPrefixRejects,
    true);
  assert.ok(registration.hostileCases.length >= 16);
});

test("registration creates no implementation output or inflated claim", () => {
  for (const [name, value] of Object.entries(
    registration.registrationOutputBoundary
  )) {
    assert.equal(value, false, name);
  }
  for (const [name, value] of Object.entries(registration.claimBoundary)) {
    assert.equal(value, false, name);
  }
  assert.deepEqual(registration.campaignCounters, {
    qualifiedModels: "0/20",
    deletionBackedBrowserRounds: "0/50",
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    liveCatalogAnnouncements: "0/20"
  });
  assert.equal(registration.authority.memoryEndpointsAuthorized, false);
  assert.equal(registration.authority.writeDriveDAllowed, false);
});

test("registration remains bounded, ASCII, and free of secret material", () => {
  assert.ok(registrationBytes.length <= 32768);
  assert.equal(registrationBytes.every((byte) => byte <= 0x7f), true);
  const text = registrationBytes.toString("utf8");
  assert.doesNotMatch(text,
    /authorization:\s*bearer\s+|[?&](?:token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu);
  assert.doesNotMatch(text, /[CD]:[\\/]/u);
});
