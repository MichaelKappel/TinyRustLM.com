"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const registrationPath = path.join(repositoryRoot,
  "contracts/vnext/acg2-champion-format-preregistration.v2.json");
const architecturePath = path.join(repositoryRoot,
  "docs/architecture/2026-08-24-acg2-champion-format-preregistration-v2.md");
const registrationBytes = fs.readFileSync(registrationPath);
const registration = JSON.parse(registrationBytes.toString("utf8"));

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function readRepositoryFile(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, ...relativePath.split("/")));
}

function assertIdentity(identity) {
  const bytes = readRepositoryFile(identity.path);
  assert.equal(bytes.length, identity.byteLength, identity.path);
  assert.equal(sha256(bytes), identity.sha256, identity.path);
  return bytes;
}

function assertCompleteCoverage(fields, byteLength) {
  const coverage = new Uint8Array(byteLength);
  for (const field of fields) {
    assert.ok(Number.isInteger(field.offset) && field.offset >= 0, field.name);
    assert.ok(Number.isInteger(field.bytes) && field.bytes > 0, field.name);
    assert.ok(field.offset + field.bytes <= byteLength, field.name);
    for (let offset = field.offset; offset < field.offset + field.bytes; offset += 1) {
      assert.equal(coverage[offset], 0, `${field.name} overlaps ${offset}`);
      coverage[offset] = 1;
    }
  }
  assert.equal(coverage.every((value) => value === 1), true);
}

test("freezes the exact corrected output-free ACG2 registration", () => {
  assert.equal(registrationBytes.length, 15372);
  assert.equal(sha256(registrationBytes), "042131d0e3b445f2a84bfb09da0e95be9345ac81c2c5d9df608e68aebe992857");
  assert.equal(registration.schema,
    "tinyrustlm.acg2-champion-format-preregistration.v2");
  assert.equal(registration.profileId,
    "tinyrustlm.acg2-champion-format-preregistration/2");
  assert.equal(registration.status,
    "registered-output-free-after-prompt2-q8-rebind");
  assert.equal(registration.registrationParentCommit,
    "c4030d394c56b8eeb422900e74935703c048c703");
  assert.equal(registration.registrationParentTree,
    "89cb3c8bb272c4c43fb9a1d5349877cf83c21032");

  const architectureBytes = fs.readFileSync(architecturePath);
  assert.equal(architectureBytes.length, 9364);
  assert.equal(sha256(architectureBytes), "605a0798aa8541ba1ada047c68eb27ba6fa7649e15e94d588232508179cfc4c9");
});

test("preserves the first registration as terminal non-executable history", () => {
  const predecessor = registration.predecessorRegistration;
  assertIdentity(predecessor);
  assert.equal(predecessor.registrationCommit,
    "39feda199eea782ff32f9ffb2b93f7c1a1b21d33");
  assert.equal(predecessor.effectiveStatus,
    "terminally-superseded-before-output");
  assert.equal(predecessor.mayBeEditedOrReused, false);
  assert.equal(predecessor.remainsImmutableAuditHistory, true);
  for (const name of [
    "artifactOutputCreated",
    "vectorOutputCreated",
    "implementationOutputCreated",
    "browserOutputCreated"
  ]) {
    assert.equal(predecessor[name], false, name);
  }
});

test("binds the exact remote-verified Prompt2 mixed-Q8 replacement", () => {
  const authority = registration.prompt2RebindAuthority;
  assertIdentity(authority.registration);
  assertIdentity(authority.profile);
  assert.equal(authority.implementationCommit,
    "fb321d4ce9eec0510162a27e4527bc626a307755");
  assert.equal(authority.implementationTree,
    "e7660a01762b137b6ebb173df267ae370b2797b2");
  assert.equal(authority.remoteExactBeforeThisRegistration, true);
  assert.deepEqual(authority.artifact, {
    byteLength: 512,
    sha256: "27aaed18b62930213a2395e398e68d18a90d4280e24c23d794e3e94352d7e1f3"
  });
});

test("covers the fixed 896-byte graph without gaps or extensions", () => {
  const binary = registration.binaryContract;
  assert.equal(binary.fileBytes, 896);
  assert.equal(binary.headerBytes, 256);
  assert.equal(binary.memberRecordBytes, 128);
  assert.equal(binary.memberCount, 5);
  assert.equal(binary.memberTableOffset, 256);
  assert.equal(binary.memberTableBytes, 640);
  assert.equal(binary.trailingBytes, false);
  assertCompleteCoverage(binary.header.fields, 256);
  assertCompleteCoverage(binary.memberRecord.fields, 128);
  assert.deepEqual(registration.closedGraph.memberOrder,
    ["model", "tokenizer", "template", "sampling", "prompt"]);
  for (const name of [
    "embeddedMemberBytes",
    "externalPaths",
    "externalUrls",
    "mutableAliases",
    "optionalMembers",
    "duplicateMembers",
    "lowRankAdapters",
    "specialistOverlays",
    "routerPolicy"
  ]) {
    assert.equal(registration.closedGraph[name], false, name);
  }
});

test("binds five exact current member profiles in closed order", () => {
  const expected = [
    [0, "model", "slm2", "5ac819cb31a17a64bec0d5492962a4baf0bd2778f6213b87c85c0a04f3a738d8"],
    [1, "tokenizer", "tokenizer2", "628427bf6e7f8d34ed14b331a5c636606aee9d5ef45a36a3cadc13338669b8de"],
    [2, "template", "template2", "14ff1df8dd6760119ac36e719ab396fff8e71d0719c2e1c83118f58693ea7bfa"],
    [3, "sampling", "sampling2", "ec65e8f1a54c1e4ca95ebda88bde091dad11337250e541bbda60e8cac311428d"],
    [4, "prompt", "prompt2", "f9eb4cbecfb52f5e2857216c999754da94021a5427a86732d33fe15efc0d062c"]
  ];
  assert.equal(registration.memberProfiles.length, expected.length);
  for (const [index, role, format, profileSha256] of expected) {
    const member = registration.memberProfiles[index];
    assert.equal(member.ordinal, index);
    assert.equal(member.role, role);
    assert.equal(member.format, format);
    assert.equal(member.profileSha256, profileSha256);
    const bytes = readRepositoryFile(member.profilePath);
    assert.equal(sha256(bytes), profileSha256, role);
  }
});

test("proves Prompt2 and graph member dependency closure from current profiles", () => {
  const promptMember = registration.memberProfiles[4];
  const promptProfile = JSON.parse(
    readRepositoryFile(promptMember.profilePath).toString("utf8"));
  const closure = registration.dependencyClosure.prompt2ProfileMustBind;
  assert.equal(promptProfile.dependencyBinding.slm2.formatProfileSha256,
    closure.slm2FormatProfileSha256);
  assert.equal(promptProfile.dependencyBinding.slm2.runtimeQ8VectorSha256,
    closure.slm2RuntimeQ8VectorSha256);
  assert.equal(promptProfile.dependencyBinding.tokenizer2.profileSha256,
    closure.tokenizer2ProfileSha256);
  assert.equal(promptProfile.dependencyBinding.tokenizer2.artifactSha256,
    closure.tokenizer2ArtifactSha256);
  assert.equal(promptProfile.dependencyBinding.template2.profileSha256,
    closure.template2ProfileSha256);
  assert.equal(promptProfile.dependencyBinding.template2.artifactSha256,
    closure.template2ArtifactSha256);
  assert.equal(promptProfile.dependencyBinding.sampling2.profileSha256,
    closure.sampling2ProfileSha256);
  assert.equal(promptProfile.dependencyBinding.sampling2.artifactSha256,
    closure.sampling2ArtifactSha256);
  assert.equal(registration.memberProfiles[0].profileSha256,
    closure.slm2FormatProfileSha256);
  assert.equal(registration.memberProfiles[1].profileSha256,
    closure.tokenizer2ProfileSha256);
  assert.equal(registration.memberProfiles[2].profileSha256,
    closure.template2ProfileSha256);
  assert.equal(registration.memberProfiles[3].profileSha256,
    closure.sampling2ProfileSha256);
});

test("requires bounded resolution and fail-atomic activation", () => {
  assert.deepEqual(registration.limits, {
    maximumGraphBytes: 896,
    maximumMembers: 5,
    maximumResolvedMemberBytes: 68_787_700_488,
    streamHashBufferBytes: 1_048_576,
    checkedArithmetic: true,
    maximumInputFilesOpenConcurrently: 1,
    maximumPendingActivationGraphs: 1
  });
  for (const [name, value] of Object.entries(registration.activation)) {
    if (name === "staleOperationIdentity") {
      assert.equal(value, "fatal-without-state-change");
    } else if (name.includes("Mutates") || name.includes("Allocates")) {
      assert.equal(value, false, name);
    } else {
      assert.equal(value, true, name);
    }
  }
});

test("keeps one prelaunch product and creates no output or claim", () => {
  assert.equal(registration.authority.productLifecycle,
    "prelaunch-single-product");
  assert.equal(registration.authority.productGenerationCount, 1);
  assert.equal(registration.authority.secondProductGenerationExists, false);
  assert.equal(registration.authority.technicalRevisionIsProductGeneration, false);
  assert.equal(registration.authority.memoryEndpointsAuthorized, false);
  assert.equal(registration.authority.writeDriveDAllowed, false);
  for (const [name, value] of Object.entries(registration.forbidden)) {
    assert.equal(value, false, name);
  }
  for (const [name, value] of Object.entries(registration.registrationOutputBoundary)) {
    assert.equal(value, false, name);
  }
  for (const [name, value] of Object.entries(registration.claimBoundary)) {
    assert.equal(value, false, name);
  }
  assert.deepEqual(Object.values(registration.campaignCounters),
    ["0/20", "0/50", "0/25", "0/40", "0/20"]);
});
