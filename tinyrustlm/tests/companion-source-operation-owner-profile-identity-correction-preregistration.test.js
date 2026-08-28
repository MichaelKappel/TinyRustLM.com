"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts/vnext",
  "companion-source-operation-owner-profile-identity-correction-preregistration.v1.json");
const profileBytes = fs.readFileSync(profilePath);
const profile = parseStrictJson(profileBytes, { maximumBytes: 64 * 1024 });

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function gitBytesAt(commit, filePath) {
  return childProcess.execFileSync("git", ["show", `${commit}:${filePath}`], {
    cwd: repositoryRoot,
    encoding: "buffer",
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true
  });
}

function parentPathExists(commit, filePath) {
  return childProcess.spawnSync("git", ["cat-file", "-e", `${commit}:${filePath}`], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true
  }).status === 0;
}

test("preregisters a clean replacement for the mistaken profile identity", () => {
  assert.equal(profile.schema,
    "tinyrustlm.companion-source-operation-owner-profile-identity-correction-preregistration.v1");
  assert.equal(profile.registrationParentCommit,
    "ac8b7a5ae728598b8d2bcb65d52969373f54cb28");
  assert.equal(profile.registrationParentTree,
    "0ae1538a08fc61d47c4eb5b683aff49db9f4a105");
  assert.equal(profile.status, "output-free-clean-replacement-preregistered");
  assert.equal(profile.supersededRegistration.terminalDisposition,
    "superseded-before-implementation-evidence");
  assert.equal(profile.supersededRegistration.runtimeReaderRetained, false);
  assert.equal(profile.supersededRegistration.translationAllowed, false);
});

test("binds the sole current composition profile and rejects the prior digest", () => {
  const authority = profile.correctedAuthority;
  assert.equal(authority.compositionProfileId,
    "tinyrustlm.qwen3-complete-composition-conversion/4");
  assert.equal(authority.compositionProfileSha256,
    "19e43c7ae532e7bc1822cbdcf179ee9bf1ed111298d3c6e5b13d37d990ee47e8");
  assert.equal(authority.supersededProfileSha256Rejected,
    "c30dcc162cb563f91bc3571fa165f910670f819c5134eed3ecf16a1d38ba85c0");
  assert.equal(authority.acceptedProfileCount, 1);
  assert.equal(authority.dualAcceptanceAllowed, false);
  assert.equal(authority.fallbackAllowed, false);
});

test("reconstructs the correction authority from the registered parent", () => {
  for (const entry of profile.registeredSourceClosure) {
    const bytes = gitBytesAt(profile.registrationParentCommit, entry.path);
    assert.equal(bytes.length, entry.byteLength, entry.path);
    assert.equal(sha256(bytes), entry.sha256, entry.path);
  }
  const original = profile.supersededRegistration;
  const originalBytes = gitBytesAt(profile.registrationParentCommit, original.path);
  assert.equal(originalBytes.length, original.byteLength);
  assert.equal(sha256(originalBytes), original.sha256);
});

test("proves the correction outputs were absent and produced no execution evidence", () => {
  for (const filePath of profile.newPathsAbsentAtRegistrationParent) {
    assert.equal(parentPathExists(profile.registrationParentCommit, filePath), false, filePath);
  }
  assert.ok(Object.values(profile.registrationOutputBoundary)
    .every(value => value === false));
  assert.deepEqual(profile.campaignCounters, {
    qualifiedModels: "0/20",
    deletionBackedBrowserRounds: "0/50",
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    liveCatalogAnnouncements: "0/20"
  });
});

test("contains no secret or private drive reference", () => {
  const text = profileBytes.toString("utf8");
  assert.doesNotMatch(text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu);
  assert.doesNotMatch(text, /[CD]:[\\/]/u);
});
