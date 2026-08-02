"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  defaultPath,
  expectedAuthority,
  expectedManifestSha256,
  expectedParents,
  registrationCommit,
  schema,
  validateManifest,
  validateManifestFile
} = require("../tools/vector-baseline-evidence-preregistration.js");
const {
  readGitBlob
} = require("../tools/vector-historical-git-input.js");

const repositoryRoot = path.resolve(__dirname, "../..");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalManifest() {
  return clone(validateManifestFile(defaultPath).manifest);
}

test("validates the canonical sealed-corpus and deletion preregistration", () => {
  const priorLocator = process.env.TINYRUSTLM_FASHION_MNIST_ROOT;
  process.env.TINYRUSTLM_FASHION_MNIST_ROOT =
    "Z:\\intentionally-missing-external-checkout";
  try {
    const result = validateManifestFile(defaultPath);
    assert.equal(result.manifest.schema, schema);
    assert.equal(result.manifest.status,
      "preregistered-before-corpus-materialization-or-deletion-results");
    assert.deepEqual(result.manifest.parents, expectedParents);
    assert.equal(result.manifest.exactFlatSourceClosure.length, 3);
    assert.deepEqual(result.manifest.authority, expectedAuthority);
    assert.equal(result.sha256, expectedManifestSha256);
    assert.equal(result.manifest.corpus.naturalLanes.length, 2);
    assert.equal(result.manifest.corpus.syntheticLanes.length, 3);
    assert.equal(result.manifest.durableDeletion.crashScenarios.length, 4);
    const source = result.manifest.exactFlatSourceClosure[1];
    const registeredBytes = readGitBlob(
      repositoryRoot,
      registrationCommit,
      source.path
    );
    assert.equal(
      crypto.createHash("sha256").update(registeredBytes).digest("hex"),
      source.sha256
    );
  } finally {
    if (priorLocator === undefined) {
      delete process.env.TINYRUSTLM_FASHION_MNIST_ROOT;
    } else {
      process.env.TINYRUSTLM_FASHION_MNIST_ROOT = priorLocator;
    }
  }
});

test("rejects parent and exact-flat source closure drift", () => {
  const parent = canonicalManifest();
  parent.parents[0].sha256 = "0".repeat(64);
  assert.throws(() => validateManifest(parent), /parents is invalid/u);

  const source = canonicalManifest();
  source.exactFlatSourceClosure[2].path =
    "rust/experiments/tinyrustlm-vector-oracle/src/alternate.rs";
  assert.throws(() => validateManifest(source),
    /exactFlatSourceClosure contract is invalid/u);
});

test("rejects external dataset identity, license, and byte drift", () => {
  const repository = canonicalManifest();
  repository.externalDataset.sourceRepository =
    "https://example.invalid/fashion-mnist.git";
  assert.throws(() => validateManifest(repository),
    /externalDataset source repository is invalid/u);

  const license = canonicalManifest();
  license.externalDataset.licenseExpression = "UNKNOWN";
  assert.throws(() => validateManifest(license), /externalDataset license is invalid/u);

  const bytes = canonicalManifest();
  bytes.externalDataset.files[0].compressedSha256 = "0".repeat(64);
  assert.throws(() => validateManifest(bytes), /externalDataset contract is invalid/u);
});

test("rejects sample, lane, metric, and threshold drift", () => {
  const selection = canonicalManifest();
  selection.corpus.selection.queriesPerClass = 10;
  assert.throws(() => validateManifest(selection), /corpus query sampling is invalid/u);

  const lane = canonicalManifest();
  lane.corpus.syntheticLanes[0].metric = "cosine";
  assert.throws(() => validateManifest(lane), /corpus contract is invalid/u);

  const threshold = canonicalManifest();
  threshold.thresholds.naturalLanes.minimumMacroLabelPrecisionAt10 = 0.49;
  assert.throws(() => validateManifest(threshold),
    /thresholds\.naturalLanes is invalid/u);
});

test("rejects crash ordering, deletion weakening, and authority inflation", () => {
  const crash = canonicalManifest();
  crash.durableDeletion.crashScenarios.reverse();
  assert.throws(() => validateManifest(crash), /durableDeletion crash ordering is invalid/u);

  const deletion = canonicalManifest();
  deletion.durableDeletion.finalTargetIdentifierMatchesAllowed = 1;
  assert.throws(() => validateManifest(deletion),
    /durableDeletion acceptance is invalid/u);

  const authority = canonicalManifest();
  authority.authority.representativeSemanticMemoryQualityMayBeClaimed = true;
  assert.throws(() => validateManifest(authority), /authority is invalid/u);
});

test("rejects repository, network, result-selection, and evidence-policy weakening", () => {
  const externalBytes = canonicalManifest();
  externalBytes.externalDataset.externalBytesMayEnterRepository = true;
  assert.throws(() => validateManifest(externalBytes),
    /externalDataset\.externalBytesMayEnterRepository must remain false/u);

  const productImport = canonicalManifest();
  productImport.build.productImportAllowed = true;
  assert.throws(() => validateManifest(productImport),
    /build\.productImportAllowed must remain false/u);

  const network = canonicalManifest();
  network.execution.networkPolicy = "allow";
  assert.throws(() => validateManifest(network), /execution network policy is invalid/u);

  const bestOf = canonicalManifest();
  bestOf.execution.bestOfNAllowed = true;
  assert.throws(() => validateManifest(bestOf),
    /execution result selection or repair must remain forbidden/u);

  const evidence = canonicalManifest();
  evidence.evidencePolicy.privateAbsolutePathsAllowed = true;
  assert.throws(() => validateManifest(evidence),
    /evidencePolicy\.privateAbsolutePathsAllowed must remain false/u);
});

test("rejects private paths, unknown fields, and noncanonical file bytes", () => {
  const privatePath = canonicalManifest();
  privatePath.requiredNextGate = "Read C:\\Users\\Private\\secret.txt";
  assert.throws(() => validateManifest(privatePath),
    /manifest contains a private path/u);

  const unknownTopLevel = canonicalManifest();
  unknownTopLevel.easyMode = true;
  assert.throws(() => validateManifest(unknownTopLevel), /manifest fields are invalid/u);

  const unknownNested = canonicalManifest();
  unknownNested.externalDataset.easyMode = true;
  assert.throws(() => validateManifest(unknownNested),
    /externalDataset fields are invalid/u);

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-baseline-prereg-"));
  const filePath = path.join(directory, "manifest.json");
  try {
    fs.writeFileSync(filePath, `${JSON.stringify(canonicalManifest(), null, 2)}\n\n`, "utf8");
    assert.throws(() => validateManifestFile(filePath),
      /manifest bytes are not canonical pretty JSON/u);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
