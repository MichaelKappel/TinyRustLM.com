"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const ownerSource = fs.readFileSync(path.join(repositoryRoot,
  "tinyrustlm/tools/qwen3-numerical-source-owner.py"), "utf8");
const verifierSource = fs.readFileSync(path.join(repositoryRoot,
  "tinyrustlm/tools/qwen3-numerical-trace-verifier.js"), "utf8");
const authoritySource = fs.readFileSync(path.join(repositoryRoot,
  "tinyrustlm/tools/qwen3_numerical_environment_lock.py"), "utf8");
const lock = JSON.parse(fs.readFileSync(path.join(repositoryRoot,
  "contracts/vnext/qwen3-numerical-oracle-environment-lock.v2.json"), "utf8"));
const profile = JSON.parse(fs.readFileSync(path.join(repositoryRoot,
  "contracts/vnext/qwen3-numerical-differential-profile.v2.json"), "utf8"));
const decisionPath = path.join(repositoryRoot,
  "docs/architecture/2026-08-26-qwen3-model-load-environment-closure-correction.md");

function distributionMap(values) {
  return new Map(values.map((value) => [value.name, value.version]));
}

test("source owner pins the complete Transformers torch load closure", () => {
  assert.match(ownerSource, /"accelerate": "1\.14\.0"/u);
  assert.match(ownerSource, /"psutil": "7\.2\.2"/u);
  assert.match(ownerSource,
    /names = \("accelerate", "psutil", "torch", "transformers", "safetensors", "tokenizers", "numpy"\)/u);
  assert.match(ownerSource, /environment = verify_current_environment\(\)/u);
  assert.match(ownerSource, /"runtimeClosureSha256": environment\["lock"\]\["runtimeClosureSha256"\]/u);
});

test("future source requests bind every observed model-load distribution", () => {
  assert.match(ownerSource,
    /REQUEST_SCHEMA = "tinyrustlm\.qwen3_numerical_source_request\.v2"/u);
  assert.match(ownerSource,
    /IMPLEMENTATION_ID = "tinyrustlm\.qwen3-publisher-source-trace\/2"/u);
  assert.match(ownerSource, /"accelerateVersion"/u);
  assert.match(ownerSource, /"psutilVersion"/u);
  assert.match(ownerSource,
    /"accelerate": request\["framework"\]\["accelerateVersion"\]/u);
  assert.match(ownerSource,
    /"psutil": request\["framework"\]\["psutilVersion"\]/u);
  assert.doesNotMatch(ownerSource,
    /versions != \{\s*"torch": request\["framework"\]\["torchVersion"\]/u);
  assert.match(verifierSource,
    /\["accelerate", "psutil", "torch", "transformers", "safetensors", "tokenizers", "numpy"\]/u);
  assert.match(verifierSource,
    /profileId === "tinyrustlm\.qwen3-publisher-source-trace\/2"/u);
  assert.doesNotMatch(verifierSource,
    /profileId === "tinyrustlm\.qwen3-publisher-source-trace\/1"/u);
});

test("environment authority admits exactly the corrected runtime distributions", () => {
  assert.match(authoritySource,
    /PROFILE_ID = "tinyrustlm\.qwen3-numerical-oracle-python-win-x64\/2"/u);
  assert.match(authoritySource, /"accelerate": "1\.14\.0"/u);
  assert.match(authoritySource, /"psutil": "7\.2\.2"/u);

  const runtime = distributionMap(lock.runtimeEnvironment.distributions);
  assert.equal(lock.profileId,
    "tinyrustlm.qwen3-numerical-oracle-python-win-x64/2");
  assert.equal(runtime.get("accelerate"), "1.14.0");
  assert.equal(runtime.get("psutil"), "7.2.2");
  assert.equal(runtime.size, 28);

  const wheels = distributionMap(lock.wheelhouse.wheels);
  assert.equal(wheels.get("accelerate"), "1.14.0");
  assert.equal(wheels.get("psutil"), "7.2.2");
  assert.equal(wheels.size, 31);
});

test("numerical profile binds the corrected environment without compatibility", () => {
  assert.equal(profile.implementations.environmentAuthority.profileId,
    "tinyrustlm.qwen3-numerical-oracle-python-win-x64/2");
  assert.equal(profile.environment.lock.profileId,
    "tinyrustlm.qwen3-numerical-oracle-python-win-x64/2");
  assert.equal(profile.environment.sourceFramework.accelerateVersion, "1.14.0");
  assert.equal(profile.environment.sourceFramework.psutilVersion, "7.2.2");
  assert.equal(profile.implementations.publisherSourceOwner.profileId,
    "tinyrustlm.qwen3-publisher-source-trace/2");
  assert.equal(profile.requests.source.schema,
    "tinyrustlm.qwen3_numerical_source_request.v2");
  assert.equal(profile.environment.offlineClosure.wheelCount, 31);
  assert.equal(profile.environment.offlineClosure.runtimeDistributionCount, 28);
  assert.equal(profile.authority.fallbackRuntime, false);
});

test("architecture decision preserves v1 as evidence rather than executable support", () => {
  const decision = fs.readFileSync(decisionPath, "utf8");
  assert.match(decision, /v1 closure remains\s+immutable historical evidence/u);
  assert.match(decision, /no runtime\s+compatibility branch/u);
  assert.match(decision, /real model-load diagnostic passed/u);
  assert.match(decision,
    /815dc5e38a431c9ccb578dacc2452ae54e193e41747b4507752d99b4a86c036a/u);
  assert.match(decision,
    /Campaign counters remain exactly `0\/20`, `0\/50`, `0\/25`, `0\/40`, and `0\/20`/u);
});
