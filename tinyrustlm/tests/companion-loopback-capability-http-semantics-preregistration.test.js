"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot,
  "contracts/vnext/companion-loopback-capability-preregistration.v3.json");
const decisionPath = path.join(repositoryRoot,
  "docs/architecture/2026-08-24-companion-loopback-http-semantics-correction-preregistration.md");
const profileBytes = fs.readFileSync(profilePath);
const decisionBytes = fs.readFileSync(decisionPath);
const profile = parseStrictJson(profileBytes, { maximumBytes: 64 * 1024 });

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function gitBytesAt(commit, filePath) {
  return childProcess.execFileSync("git", ["show", `${commit}:${filePath}`], {
    cwd: repositoryRoot,
    encoding: "buffer",
    maxBuffer: 2 * 1024 * 1024,
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

test("pins the append-only HTTP semantics correction", () => {
  assert.equal(profileBytes.length, 11836);
  assert.equal(sha256(profileBytes),
    "a4f8574a6d35f8c66f537f8e4e2c7d659a239a6267d60c26210672db72929d28");
  assert.equal(decisionBytes.length, 8126);
  assert.equal(sha256(decisionBytes),
    "f05745acac123e25bea5b07a0d21845f0a4431890e808799fc18939333a71e6d");
  assert.equal(profile.schema,
    "tinyrustlm.companion-loopback-capability-preregistration.v3");
  assert.equal(profile.profileId, "tinyrustlm.companion.loopback-capability/3");
  assert.equal(profile.registrationParentCommit,
    "667ec300f195a36fd80ce5e88a7b37ce678fe4bd");
  assert.equal(profile.registrationParentTree,
    "a64526224134050f92f009c970cc22de311ef354");
});

test("reconstructs every correction input from the parent tree", () => {
  assert.equal(profile.registeredSourceClosure.length, 6);
  for (const entry of profile.registeredSourceClosure) {
    const bytes = gitBytesAt(profile.registrationParentCommit, entry.path);
    assert.equal(bytes.length, entry.byteLength, entry.path);
    assert.equal(sha256(bytes), entry.sha256, entry.path);
  }
});

test("proves correction and listener outputs were absent at the parent", () => {
  for (const filePath of profile.implementationClosure.newPathsAbsentAtRegistrationParent) {
    assert.equal(parentPathExists(profile.registrationParentCommit, filePath), false,
      filePath);
  }
});

test("preserves the observed failure without manufacturing acceptance", () => {
  const observed = profile.preservedFailureObservation;
  assert.deepEqual({ total: observed.total, passed: observed.passed,
    failed: observed.failed, skipped: observed.skipped },
  { total: 6, passed: 5, failed: 1, skipped: 0 });
  assert.equal(observed.externalPublicSafeLogByteLength, 6582);
  assert.equal(observed.externalPublicSafeLogSha256,
    "fe861068499002c76d634ce0e436b1972ed83e57d298377d0681682a200972c7");
  assert.equal(observed.listenerAccepted, false);
  assert.equal(observed.testWeakened, false);
  assert.equal(observed.failureOverwritten, false);
});

test("corrects 204 preflight to the RFC and Kestrel wire", () => {
  assert.equal(profile.preflightWire.status, 204);
  assert.equal(profile.preflightWire.bodyBytes, 0);
  assert.equal(profile.preflightWire.contentLengthHeaderPresent, false);
  assert.equal(profile.preflightWire.contentTypeHeaderPresent, false);
  assert.equal(profile.preflightWire.responseHeaders.Connection, "close");
  assert.equal(profile.preflightWire.allowCredentialsHeaderPresent, false);
  assert.equal(profile.preflightWire.privateNetworkAccessHeaderPresent, false);
  assert.equal(profile.preflightWire.sessionProofHeaderPresent, false);
  assert.equal(profile.preflightWire.stateMutation, false);
});

test("assigns exact application and parser rejection ownership", () => {
  const ownership = profile.httpRejectionOwnership;
  assert.equal(ownership.applicationOwned.canonicalErrorBodyRequired, true);
  assert.equal(ownership.applicationOwned.validSessionErrorResponseProofRequired, true);
  assert.equal(ownership.kestrelParserOwned.occursBeforeApplicationDispatch, true);
  assert.equal(ownership.kestrelParserOwned.canonicalApplicationErrorBodyRequired, false);
  assert.equal(ownership.kestrelParserOwned.stateMutationAllowed, false);
  assert.equal(ownership.kestrelParserOwned.sessionProofHeadersRequired, false);
  assert.deepEqual(ownership.kestrelParserOwned.classes.map(entry => entry.admittedStatus),
    [400, 414, 431, 413]);
  assert.equal(ownership.kestrelParserOwned.browserMapsTo, "companion-unavailable");
});

test("exposes both identity fields required for browser artifact proof", () => {
  assert.ok(profile.corsExposedResponseHeaders.includes(
    "x-tinyrustlm-response-metadata-sha256"));
  assert.ok(profile.corsExposedResponseHeaders.includes("x-tinyrustlm-artifact-id"));
  assert.equal(new Set(profile.corsExposedResponseHeaders).size,
    profile.corsExposedResponseHeaders.length);
  assert.equal(profile.corsExposureReason.wildcardExposureAllowed, false);
  assert.equal(profile.corsExposureReason.credentialsExposureAllowed, false);
});

test("keeps clean-slate authority and all campaign claims at zero", () => {
  assert.equal(profile.authority.legacySupportAllowed, false);
  assert.equal(profile.authority.compatibilityReaderAllowed, false);
  assert.equal(profile.authority.fallbackAllowed, false);
  assert.equal(profile.authority.fakeSuccessAllowed, false);
  assert.equal(profile.authority.memoryEndpointsAuthorized, false);
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

test("contains no credential or forbidden private drive reference", () => {
  const text = Buffer.concat([profileBytes, decisionBytes]).toString("utf8");
  assert.doesNotMatch(text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu);
  assert.doesNotMatch(text, /[CD]:[\\/]/u);
});
