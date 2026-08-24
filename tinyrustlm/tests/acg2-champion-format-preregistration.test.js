"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const registrationPath = path.join(
  repositoryRoot,
  "contracts/vnext/acg2-champion-format-preregistration.v1.json"
);
const architecturePath = path.join(
  repositoryRoot,
  "docs/architecture/2026-08-24-acg2-champion-format-preregistration.md"
);
const decisionPath = path.join(
  repositoryRoot,
  "docs/architecture/adr/ADR-019-acg2-champion-format.md"
);
const registrationBytes = fs.readFileSync(registrationPath);
const registrationText = registrationBytes.toString("utf8");
const registration = parseStrictJson(registrationBytes);

function assertExactFieldCoverage(fields, expectedBytes) {
  let cursor = 0;
  for (const field of fields) {
    assert.equal(field.offset, cursor, `${field.name} does not begin at ${cursor}`);
    assert.ok(Number.isSafeInteger(field.bytes) && field.bytes > 0,
      `${field.name} has an invalid size`);
    cursor += field.bytes;
  }
  assert.equal(cursor, expectedBytes);
}

test("freezes the exact output-free ACG2 registration and parent authority", () => {
  assert.equal(registration.schema,
    "tinyrustlm.acg2-champion-format-preregistration.v1");
  assert.equal(registration.profileId,
    "tinyrustlm.acg2-champion-format-preregistration/1");
  assert.equal(registration.status, "registered-output-free");
  assert.equal(registration.registrationParentCommit,
    "21a291d360213c6214eec7c146b3b2f249339a09");
  assert.equal(registration.registrationParentTree,
    "d498e6a25cc1a3f1b8b85bd9dda58782e65bf5df");
  assert.equal(registration.authority.productLifecycle, "prelaunch-single-product");
  assert.equal(registration.authority.productGenerationCount, 1);
  assert.equal(registration.authority.technicalVersionIsProductGeneration, false);
  assert.equal(registration.authority.formatId, "org.minimodel.acg2/2.0");
  assert.equal(registration.authority.memoryEndpointsAuthorized, false);
  assert.deepEqual(Object.values(registration.authority.campaignCounters),
    ["0/20", "0/50", "0/25", "0/40", "0/20"]);
});

test("covers the complete fixed header and member record without gaps", () => {
  const binary = registration.binaryContract;
  assert.equal(binary.magicHex, "414347320d0a1a0a");
  assert.equal(binary.formatIdAsciiPaddedHex,
    "6d696e696d6f64656c2e616367320000");
  assert.equal(binary.fileBytes, 896);
  assert.equal(binary.headerBytes, 256);
  assert.equal(binary.memberRecordBytes, 128);
  assert.equal(binary.memberCount, 5);
  assert.equal(binary.memberTableOffset, 256);
  assert.equal(binary.memberTableBytes, 640);
  assert.equal(binary.trailingBytes, false);
  assertExactFieldCoverage(binary.header.fields, 256);
  assertExactFieldCoverage(binary.memberRecord.fields, 128);

  const header = Object.fromEntries(binary.header.fields.map((field) => [field.name, field]));
  assert.equal(header.member_count.value, 5);
  assert.equal(header.member_record_bytes.value, 128);
  assert.equal(header.reserved.bytes, 112);
  const record = Object.fromEntries(
    binary.memberRecord.fields.map((field) => [field.name, field])
  );
  assert.equal(record.artifact_sha256.bytes, 32);
  assert.equal(record.format_profile_sha256.bytes, 32);
  assert.equal(record.reserved.bytes, 40);
});

test("binds exactly five closed roles, formats, profiles, and limits", () => {
  assert.deepEqual(registration.closedGraph.memberOrder,
    ["model", "tokenizer", "template", "sampling", "prompt"]);
  assert.equal(registration.closedGraph.memberCount, 5);
  for (const [name, value] of Object.entries(registration.closedGraph)) {
    if (name === "memberCount" || name === "memberOrder" ||
        name === "unknownMembers" || name === "missingMembers" ||
        name === "additionalMembers") continue;
    assert.equal(value, false, `${name} must be false`);
  }
  assert.equal(registration.closedGraph.unknownMembers, "fatal");
  assert.equal(registration.closedGraph.missingMembers, "fatal");
  assert.equal(registration.closedGraph.additionalMembers, "fatal");

  const expected = [
    [0, "model", 1, "slm2", 1,
      "5ac819cb31a17a64bec0d5492962a4baf0bd2778f6213b87c85c0a04f3a738d8",
      68719476736],
    [1, "tokenizer", 2, "tokenizer2", 2,
      "628427bf6e7f8d34ed14b331a5c636606aee9d5ef45a36a3cadc13338669b8de",
      67108864],
    [2, "template", 3, "template2", 3,
      "14ff1df8dd6760119ac36e719ab396fff8e71d0719c2e1c83118f58693ea7bfa",
      1048576],
    [3, "sampling", 4, "sampling2", 4,
      "ec65e8f1a54c1e4ca95ebda88bde091dad11337250e541bbda60e8cac311428d",
      65800],
    [4, "prompt", 5, "prompt2", 5,
      "b317ae0207522399e63125c57daf91d97432f95b26bd8fb71db746934ff05c8c",
      512]
  ];
  assert.deepEqual(registration.memberProfiles.map((member) => [
    member.ordinal,
    member.role,
    member.roleCode,
    member.format,
    member.formatCode,
    member.profileSha256,
    member.maximumArtifactBytes
  ]), expected);
  assert.equal(registration.memberProfiles.reduce(
    (sum, member) => sum + member.maximumArtifactBytes, 0),
  registration.limits.maximumResolvedMemberBytes);
  assert.equal(registration.limits.maximumResolvedMemberBytes, 68787700488);
});

test("freezes identity framing and bounded streaming resolution", () => {
  assert.equal(registration.identity.algorithm, "SHA-256");
  assert.equal(registration.identity.memberTableSha256,
    "plain-sha256-over-all-640-member-record-bytes");
  assert.equal(registration.identity.graphIdentityDomainAsciiNul,
    "tinyrustlm.acg2.champion-graph.v1\\0");
  assert.deepEqual(registration.identity.graphIdentityFraming, [
    "domain-ascii-and-zero-byte",
    "major-version-u16le",
    "minor-version-u16le",
    "artifact-class-u8",
    "member-count-u32le",
    "resolved-member-bytes-u64le",
    "member-table-bytes"
  ]);
  assert.equal(registration.identity.wholeArtifact,
    "plain-sha256-over-all-896-file-bytes");
  assert.equal(registration.limits.maximumGraphBytes, 896);
  assert.equal(registration.limits.maximumMembers, 5);
  assert.equal(registration.limits.streamHashBufferBytes, 1048576);
  assert.equal(registration.limits.maximumInputFilesOpenConcurrently, 1);
  assert.equal(registration.limits.maximumPendingActivationGraphs, 1);
  assert.ok(registration.validationOrder.indexOf("stream-each-resolved-member-length-and-sha256") <
    registration.validationOrder.indexOf("parse-each-member-with-its-canonical-format-owner"));
  assert.ok(registration.validationOrder.indexOf("complete-runtime-resource-preflight") <
    registration.validationOrder.indexOf("transactional-activation"));
});

test("requires state-isolated validation and one transactional swap", () => {
  const activation = registration.activation;
  assert.equal(activation.candidateValidationMutatesActiveState, false);
  assert.equal(activation.candidateValidationAllocatesModelWeightShadow, false);
  assert.equal(activation.allMembersVerifiedBeforeSwap, true);
  assert.equal(activation.allMembersParsedBeforeSwap, true);
  assert.equal(activation.promptDependenciesCrossCheckedBeforeSwap, true);
  assert.equal(activation.resourcePlanAcceptedBeforeSwap, true);
  assert.equal(activation.successfulSwapIsAtomic, true);
  assert.equal(activation.successfulSwapClearsKvCache, true);
  assert.equal(activation.successfulSwapClearsGenerationState, true);
  assert.equal(activation.failedSwapPreservesActiveComposition, true);
  assert.equal(activation.failedSwapPreservesKvCache, true);
  assert.equal(activation.failedSwapPreservesGenerationState, true);
  assert.equal(activation.staleOperationIdentity, "fatal-without-state-change");
});

test("requires an isolated independent oracle and exhaustive hostile coverage", () => {
  assert.deepEqual(registration.independentOracle, {
    path: "tinyrustlm/tools/acg2-reference.js",
    language: "Node.js-builtins-only",
    mayInvokeRust: false,
    mayInvokeSubprocess: false,
    mayUseNetwork: false,
    mayReadGeneratedRustOutput: false,
    requiredFunctions: [
      "writer",
      "parser",
      "identity-derivation",
      "hostile-mutation-generation"
    ]
  });
  assert.ok(registration.requiredTests.includes("every-proper-prefix-rejection"));
  assert.ok(registration.requiredTests.includes("every-header-field-hostile-mutation"));
  assert.ok(registration.requiredTests.includes("every-member-field-hostile-mutation"));
  assert.ok(registration.requiredTests.includes("failed-activation-preserves-all-active-state"));
  assert.ok(registration.requiredTests.includes("native-and-wasm-conformance"));
});

test("creates no implementation output or inflated product claim", () => {
  const expected = registration.expectedImplementationOutputs;
  for (const key of ["machineProfile", "languageNeutralVectors", "rustCrate",
    "nodeOracle", "nodeTest"]) {
    assert.equal(fs.existsSync(path.join(repositoryRoot, expected[key])), false,
      `${key} must remain absent before remote-exact registration`);
  }
  assert.equal(fs.existsSync(path.join(repositoryRoot, expected.architectureDecision)), true);
  assert.ok(Object.values(registration.registrationOutputBoundary)
    .every((value) => value === false));
  assert.ok(Object.values(registration.claimBoundary).every((value) => value === false));
  for (const value of Object.values(registration.forbidden)) assert.equal(value, false);
});

test("registration and architecture records remain bounded, ASCII, and public-safe", () => {
  assert.ok(registrationBytes.length > 0 && registrationBytes.length <= 32768);
  assert.ok([...registrationBytes].every((byte) => byte <= 0x7f));
  assert.doesNotMatch(registrationText, /https?:\/\//iu);
  assert.doesNotMatch(registrationText,
    /(?:Bearer\s+[A-Za-z0-9._~+\/-]{12,}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,})/u);

  const architecture = fs.readFileSync(architecturePath);
  const decision = fs.readFileSync(decisionPath);
  assert.ok(architecture.length > 0 && architecture.length <= 32768);
  assert.ok(decision.length > 0 && decision.length <= 32768);
  assert.ok([...architecture, ...decision].every((byte) => byte <= 0x7f));
  const architectureText = architecture.toString("utf8");
  assert.match(architectureText, /exactly 896 bytes/u);
  assert.match(architectureText, /one transactional swap/u);
  assert.match(architectureText, /not product generations/u);
  assert.match(architectureText, /creates no ACG2 machine profile/u);
});
