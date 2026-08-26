"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "qwen3-composition-verification-owner-profile.v1.json");
const profileBytes = fs.readFileSync(profilePath);
const profile = JSON.parse(profileBytes.toString("utf8"));

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

test("freezes the sole composition verification owner profile", () => {
  assert.equal(profileBytes.length, 4388);
  assert.equal(sha256(profileBytes),
    "5f7a9a25350041069f1ba6cf417f4ed0f75c6d1d96ddbbdabae3b11718247cf8");
  assert.equal(profileBytes.toString("utf8"), `${JSON.stringify(profile, null, 2)}\n`);
  assert.equal(profile.schema,
    "tinyrustlm.qwen3-composition-verification-owner-profile.v1");
  assert.equal(profile.profileId,
    "tinyrustlm.qwen3-composition-verification-owner/1");
  assert.equal(profile.status, "sole-maintained-owner");
});

test("binds the exact maintained owner and incompatible schema family", () => {
  const ownerPath = path.join(repositoryRoot, ...profile.owner.path.split("/"));
  const ownerBytes = fs.readFileSync(ownerPath);
  assert.equal(ownerBytes.length, profile.owner.byteLength);
  assert.equal(sha256(ownerBytes), profile.owner.sha256);
  assert.deepEqual(profile.schemas, {
    request: "tinyrustlm.qwen3-composition-verification-request.v1",
    binding: "tinyrustlm.qwen3-composition-verification-binding.v1",
    start: "tinyrustlm.qwen3-composition-verification-start.v1",
    processTerminal:
      "tinyrustlm.qwen3-composition-verification-process-terminal.v1",
    finalVerification: "tinyrustlm.qwen3-composition-execution-verification.v6"
  });
  assert.deepEqual(profile.commands, ["preflight", "execute", "verify"]);
  assert.equal(fs.existsSync(path.join(repositoryRoot, "tinyrustlm", "tools",
    "qwen3-composition-execution-controller.js")), false);
});

test("owns every process stream terminal and final decision inside one evidence root", () => {
  assert.deepEqual(profile.evidence, [
    "operation.binding.json",
    "operation.start.json",
    "converter.stdout.bin",
    "converter.stderr.bin",
    "converter.process-terminal.json",
    "managed-inspection.intent.json",
    "managed-inspection.stdout.bin",
    "managed-inspection.stderr.bin",
    "managed-inspection.process-terminal.json",
    "execution.verification.json"
  ]);
  assert.equal(new Set(profile.evidence).size, profile.evidence.length);
  assert.equal(profile.invariants.oneConverterLaunch, true);
  assert.equal(profile.invariants.oneManagedInspectionLaunch, true);
  assert.equal(profile.invariants.nativeWindowsChildPaths, true);
  assert.equal(profile.invariants.managedIntentConstructedByOwner, true);
  assert.equal(profile.invariants.rawStreamsOpenedCreateOnlyBeforeChildLaunch, true);
  assert.equal(profile.invariants.processTerminalsCreateOnly, true);
  assert.equal(profile.invariants.finalVerificationCreateOnly, true);
  assert.equal(profile.invariants.readOnlyVerificationRehashesEveryEvidenceEdge, true);
});

test("separates composition and outer-operation terminal rules", () => {
  assert.equal(profile.invariants.compositionTerminalRule,
    "existing-output-root-is-never-resumed");
  assert.equal(profile.invariants.operationTerminalRule,
    "existing-evidence-or-output-root-is-terminal-and-never-resumed");
  assert.equal(profile.limits.exactOutputFileCount, 10);
  assert.equal(profile.limits.maximumChildStdoutBytes, 1048576);
  assert.equal(profile.limits.maximumChildStderrBytes, 65536);
  assert.equal(profile.limits.maximumOutputAggregateBytes, 17179869184);
});

test("contains no alternate execution behavior or preemptive claim", () => {
  for (const field of ["automaticRetry", "manualRetryUnderSameRegistration",
    "overwrite", "cleanup", "repair", "fallback", "bestOfN",
    "compatibilityReader", "migrationWriter", "alias"]) {
    assert.equal(profile.invariants[field], false, field);
  }
  assert.ok(Object.values(profile.claimBoundary).every((value) => value === false));
  assert.equal(profile.authority.memoryEndpointsAuthorized, false);
  assert.equal(profile.authority.writeDriveDAllowed, false);
  assert.equal(profile.authority.productV1Exists, false);
  assert.equal(profile.authority.productV2Exists, false);
  const text = profileBytes.toString("utf8");
  assert.doesNotMatch(text, /[CDE]:[\\/]/u);
  assert.doesNotMatch(text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu);
});
