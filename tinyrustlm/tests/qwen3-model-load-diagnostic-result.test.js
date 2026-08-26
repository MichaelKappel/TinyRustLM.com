"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const historicalResultRelativePath =
  "contracts/vnext/qwen3-model-load-diagnostic-result.v1.json";
const resultRelativePath = "contracts/vnext/qwen3-model-load-diagnostic-result.v2.json";
const resultPath = path.join(repositoryRoot, resultRelativePath);
const resultBytes = fs.readFileSync(resultPath);
const result = JSON.parse(resultBytes.toString("utf8"));
const profile = JSON.parse(fs.readFileSync(path.join(repositoryRoot,
  "contracts/vnext/qwen3-numerical-differential-profile.v1.json"), "utf8"));

function sorted(value) {
  if (Array.isArray(value)) {
    return value.map(sorted);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
  }
  return value;
}

function identity(relativePath) {
  const bytes = fs.readFileSync(path.join(repositoryRoot, relativePath));
  return {
    byteLength: bytes.length,
    path: relativePath,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex")
  };
}

test("model-load diagnostic result is canonical and content-bound", () => {
  assert.equal(resultBytes.toString("utf8"), `${JSON.stringify(sorted(result), null, 2)}\n`);
  assert.equal(result.schema, "tinyrustlm.qwen3_model_load_diagnostic_result.v1");
  assert.equal(result.status, "pass");
  for (const value of Object.values(result.inputs)) {
    assert.deepEqual(value, identity(value.path));
  }
  assert.deepEqual(profile.diagnostics.modelLoad, {
    ...identity(resultRelativePath),
    claim: "pinned-local-model-load-and-one-ipv6-loopback-capability-bind-only"
  });
});

test("the earlier diagnostic remains separate immutable evidence", () => {
  const historicalBytes = fs.readFileSync(path.join(repositoryRoot,
    historicalResultRelativePath));
  const historical = JSON.parse(historicalBytes.toString("utf8"));
  assert.equal(historicalBytes.length, 2919);
  assert.equal(crypto.createHash("sha256").update(historicalBytes).digest("hex"),
    "0bb72f882befe2b2fe521c749872eb628729a6ab21559cb1e5d5fb64bbc7b2d4");
  assert.equal(historical.diagnosticId,
    "qwen3-model-load-c1899de-env2-20260826-v1");
  assert.equal(historical.status, "pass");
  assert.notEqual(historical.inputs.publisherSourceOwner.sha256,
    result.inputs.publisherSourceOwner.sha256);
});

test("result freezes the exact successful nonmaterial observation", () => {
  assert.equal(result.execution.invocationCount, 1);
  assert.equal(result.execution.processExitCode, 0);
  assert.equal(result.execution.registeredOneShotAuthorityConsumed, false);
  assert.equal(result.execution.networkAllowed, false);
  assert.equal(result.execution.remoteCodeAllowed, false);
  assert.equal(result.execution.retry, false);
  assert.equal(result.execution.traceOutputCreated, false);
  assert.equal(result.observed.capabilityProbeCount, 1);
  assert.equal(result.observed.environmentProfileId,
    "tinyrustlm.qwen3-numerical-oracle-python-win-x64/2");
  assert.equal(result.observed.runtimeClosureSha256,
    "fd6b647255c2d4c1294100946fce3c71abfd306ba5b173534ca5fe3b9c2933d4");
  assert.equal(result.observed.sourceFileCount, 9);
  assert.equal(result.observed.sourceByteLength, 1519207688);
  assert.deepEqual(result.observed.packageVersions, {
    accelerate: "1.14.0",
    numpy: "2.2.5",
    psutil: "7.2.2",
    safetensors: "0.5.3",
    tokenizers: "0.21.1",
    torch: "2.7.0",
    transformers: "4.51.0"
  });
});

test("result cannot be mistaken for numerical, browser, quality, or campaign proof", () => {
  assert.equal(result.authority.sourceTraceCreated, false);
  assert.equal(result.authority.numericalParity, false);
  assert.equal(result.authority.closedOperationMutable, false);
  assert.equal(result.authority.closedOperationRetried, false);
  assert.equal(result.authority.memoryEndpointsAuthorized, false);
  assert.deepEqual(result.authority.campaignCounters, {
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    deletionBackedBrowserRounds: "0/50",
    liveCatalogAnnouncements: "0/20",
    qualifiedModels: "0/20"
  });
  assert.equal(profile.claimBoundary.publisherSourceModelLoadPassed, true);
  assert.equal(profile.claimBoundary.publisherSourceTraceExecuted, false);
  assert.equal(profile.claimBoundary.sourceToReconstructedPassed, false);
  assert.equal(profile.claimBoundary.browserWasmPassed, false);
  assert.equal(profile.claimBoundary.behavioralQualityPassed, false);
});

test("public result excludes private roots and raw failure material", () => {
  const text = resultBytes.toString("utf8");
  assert.doesNotMatch(text, /[A-Z]:\\/u);
  assert.doesNotMatch(text, /TinyRustLM-vnext-private/u);
  assert.doesNotMatch(text, /stderr|stdout|exceptionMessage|traceback/u);
});
