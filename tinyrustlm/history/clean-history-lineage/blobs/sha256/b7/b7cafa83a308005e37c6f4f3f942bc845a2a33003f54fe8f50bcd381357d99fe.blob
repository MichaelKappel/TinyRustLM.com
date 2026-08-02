"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  defaultPath,
  expectedAuthority,
  expectedParents,
  expectedWorkloads,
  schema,
  validateManifest,
  validateManifestFile
} = require("../tools/vector-physical-target-preregistration.js");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalManifest() {
  return clone(validateManifestFile(defaultPath).manifest);
}

test("validates the canonical named-target preregistration before results", () => {
  const result = validateManifestFile(defaultPath);
  assert.equal(result.manifest.schema, schema);
  assert.equal(result.manifest.status, "preregistered-before-performance-results");
  assert.deepEqual(result.manifest.parents, expectedParents);
  assert.deepEqual(result.manifest.workloads, expectedWorkloads);
  assert.deepEqual(result.manifest.authority, expectedAuthority);
  assert.equal(result.manifest.target.finalReleaseHardwareGateEligible, false);
  assert.equal(result.manifest.execution.processRunsPerWorkload, 3);
  assert.equal(result.manifest.workloads.length * 3, 9);
  assert.match(result.sha256, /^[a-f0-9]{64}$/u);
});

test("rejects target, process, workload, and build drift", () => {
  const target = canonicalManifest();
  target.target.processor.name = "different processor";
  assert.throws(() => validateManifest(target), /target\.processor is invalid/u);

  const processCount = canonicalManifest();
  processCount.execution.processRunsPerWorkload = 1;
  assert.throws(() => validateManifest(processCount), /execution is invalid/u);

  const workload = canonicalManifest();
  workload.workloads[1].measuredQueries = 1;
  assert.throws(() => validateManifest(workload), /workloads is invalid/u);

  const build = canonicalManifest();
  build.build.exactFlatSourceMutationAllowed = true;
  assert.throws(() => validateManifest(build), /must remain false/u);
});

test("rejects energy, authority, parent, and evidence weakening", () => {
  const energy = canonicalManifest();
  energy.measurement.rawEnergyCounterDeltaMaySubstituteForJoules = true;
  assert.throws(() => validateManifest(energy), /raw energy deltas cannot substitute/u);

  const authority = canonicalManifest();
  authority.authority.completePhysicalTargetGateMayBeClaimed = true;
  assert.throws(() => validateManifest(authority), /authority is invalid/u);

  const parent = canonicalManifest();
  parent.parents.reverse();
  assert.throws(() => validateManifest(parent), /parents\[0\] is invalid/u);

  const evidence = canonicalManifest();
  evidence.evidencePolicy.hardwareSerialNumbersAllowed = true;
  assert.throws(() => validateManifest(evidence), /evidencePolicy is invalid/u);
});

test("rejects unknown fields and noncanonical file bytes", () => {
  const unknown = canonicalManifest();
  unknown.easyMode = true;
  assert.throws(() => validateManifest(unknown), /manifest fields are invalid/u);

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-target-prereg-"));
  const filePath = path.join(directory, "manifest.json");
  try {
    fs.writeFileSync(filePath, `${JSON.stringify(canonicalManifest(), null, 2)}\n\n`, "utf8");
    assert.throws(() => validateManifestFile(filePath), /not canonical pretty JSON/u);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
