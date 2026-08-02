"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  canonicalPrettyBytes,
  expectedBytes,
  expectedSha256,
  experimentId,
  parentSourceRevision,
  relativePath,
  schema,
  validateManifest,
  validateManifestFile
} = require("../tools/vector-portable-affine-u8-json-domain-v2-preregistration.js");

const repositoryRoot = path.resolve(__dirname, "../..");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function manifest() {
  return clone(validateManifestFile().manifest);
}

test("validates the frozen v2 preregistration and complete input closure", () => {
  const result = validateManifestFile();
  assert.equal(result.manifest.schema, schema);
  assert.equal(result.manifest.experimentId, experimentId);
  assert.equal(result.manifest.registrationBoundary.parentSourceRevision,
    parentSourceRevision);
  assert.equal(result.bytes, expectedBytes);
  assert.equal(result.sha256, expectedSha256);
  assert.equal(result.manifest.subject.criticalInputs.length, 22);
  assert.equal(result.manifest.fullExecution.maximumBenchmarkProcessCount, 77);
  assert.equal(result.manifest.fullExecution.maximumMemoryMonitorProcessCount, 60);
  assert.equal(result.manifest.attemptPolicy.maximumAttemptCount, 1);
  assert.equal(result.manifest.attemptPolicy.maximumRetryCount, 0);
});

test("is canonical and registered before every outcome artifact", () => {
  const result = validateManifestFile();
  const bytes = fs.readFileSync(path.join(repositoryRoot, relativePath));
  assert.equal(bytes.length, expectedBytes);
  assert.deepEqual(bytes, canonicalPrettyBytes(result.manifest));
  for (const [key, value] of Object.entries(result.manifest.plannedArtifacts)) {
    if (!(key.endsWith("Path") || key === "attemptDirectory")) continue;
    if (result.registrationCommit === null) {
      assert.equal(fs.existsSync(path.join(repositoryRoot, value)), false);
    }
  }
});

test("rejects outcome observation, retries, best-of-N, and repair", () => {
  for (const mutate of [
    (value) => {
      value.registrationBoundary.outcomeModesInvokedBeforeRegistration = true;
    },
    (value) => {
      value.registrationBoundary.qualityMetricsObservedBeforeRegistration = true;
    },
    (value) => {
      value.attemptPolicy.maximumAttemptCount = 2;
    },
    (value) => {
      value.attemptPolicy.infrastructureFailureMayBeRetried = true;
    },
    (value) => {
      value.fullExecution.bestOfNAllowed = true;
    },
    (value) => {
      value.fullExecution.outputRepairAllowed = true;
    }
  ]) {
    const value = manifest();
    mutate(value);
    assert.throws(() => validateManifest(value));
  }
});

test("rejects process, number-domain, and output-schema drift", () => {
  for (const mutate of [
    (value) => {
      value.fullExecution.maximumBenchmarkProcessCount = 76;
    },
    (value) => {
      value.fullExecution.phaseOrder[7].benchmarkProcessCount = 59;
    },
    (value) => {
      value.outputContract.qualitySchema =
        "tinyrustlm.portable_affine_u8_quality_process.v1";
    },
    (value) => {
      value.outputContract.qualityNumberDomains.signedUnitInterval = [];
    },
    (value) => {
      value.outputContract.qualityNumberDomains.finite.push("utilityDelta");
    }
  ]) {
    const value = manifest();
    mutate(value);
    assert.throws(() => validateManifest(value));
  }
});

test("rejects authority inflation and evidence disclosure", () => {
  for (const mutate of [
    (value) => {
      value.authority.beforeIndependentVerifiedPass.qualityClaim = true;
    },
    (value) => {
      value.authority.beforeIndependentVerifiedPass
        .campaignCounterMayBeIncremented = true;
    },
    (value) => {
      value.authority.potentialAfterCompleteIndependentVerifiedPass
        .productIntegrationMayBeClaimed = true;
    },
    (value) => {
      value.evidencePolicy.rawStderrAllowed = true;
    },
    (value) => {
      value.evidencePolicy.privateAbsolutePathsAllowed = true;
    }
  ]) {
    const value = manifest();
    mutate(value);
    assert.throws(() => validateManifest(value));
  }
});

test("rejects unknown fields and registration lineage drift", () => {
  for (const mutate of [
    (value) => {
      value.unknown = true;
    },
    (value) => {
      value.registrationBoundary.fixCommit = parentSourceRevision;
    },
    (value) => {
      value.registrationBoundary.outcomeRunnerExistsBeforeRegistration = true;
    },
    (value) => {
      value.plannedArtifacts.runnerExistsAtRegistration = true;
    },
    (value) => {
      value.subject.algorithmChanged = true;
    },
    (value) => {
      value.subject.criticalInputs[18].sha256 = "0".repeat(64);
    },
    (value) => {
      value.lineage.terminalExperiment.retryAllowed = true;
    },
    (value) => {
      value.lineage.failureToRegression.exactFirstHistoricalPanicSiteProven = true;
    }
  ]) {
    const value = manifest();
    mutate(value);
    assert.throws(() => validateManifest(value));
  }
});
