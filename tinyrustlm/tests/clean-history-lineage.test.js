"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  canonicalWitnessBytes,
  createLineageReader,
  defaultSecretScanAdjudicationPath,
  productionLineageReader,
  productionSecretScanAdjudicationSha256,
  productionWitnessSha256,
  validateSecretScanAdjudication,
  sha256
} = require("../tools/clean-history-lineage.js");

function git(repositoryRoot, argumentsList) {
  return childProcess.execFileSync("git", [
    "-c", "core.autocrlf=false",
    ...argumentsList
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true
  }).trim();
}

function commitFile(repositoryRoot, relativePath, contents, message) {
  const absolutePath = path.join(repositoryRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
  git(repositoryRoot, ["add", "--", relativePath]);
  git(repositoryRoot, [
    "-c", "user.name=TinyRustLM Tests",
    "-c", "user.email=tinyrustlm-tests@example.invalid",
    "commit", "-m", message
  ]);
  return git(repositoryRoot, ["rev-parse", "HEAD"]);
}

function fixture(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-lineage-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, ["init", "-b", "main"]);
  const cleanRoot = commitFile(root, "README.md", "clean root\n", "clean root");
  const head = commitFile(root, "current.txt", "current\n", "current");

  git(root, ["checkout", "--quiet", "--orphan", "historical"]);
  git(root, ["rm", "-rf", "."]);
  const historicalParent = commitFile(
    root,
    "evidence/input.txt",
    "historical input\n",
    "historical parent"
  );
  const addition = commitFile(
    root,
    "evidence/preregistration.json",
    "{}\n",
    "historical registration"
  );
  const historicalTip = commitFile(
    root,
    "evidence/implementation.js",
    "module.exports = true;\n",
    "historical implementation"
  );
  const hiddenBlob = git(root, [
    "show", `${historicalParent}:evidence/input.txt`
  ]);
  git(root, ["checkout", "--quiet", "main"]);
  const cleanRootTree = git(root, ["rev-parse", `${cleanRoot}^{tree}`]);

  const lineageRoot = path.join(root, "lineage");
  const blobBytes = Buffer.from(`${hiddenBlob}\n`, "utf8");
  const blobSha256 = sha256(blobBytes);
  const blobRelativePath = `blobs/sha256/${blobSha256.slice(0, 2)}/${blobSha256}.blob`;
  const blobPath = path.join(lineageRoot, ...blobRelativePath.split("/"));
  fs.mkdirSync(path.dirname(blobPath), { recursive: true });
  fs.writeFileSync(blobPath, blobBytes, { flag: "wx" });

  const witness = {
    schema: "tinyrustlm.clean_history_lineage_witness.v1",
    witnessId: "tinyrustlm-retained-evidence-clean-history-20260802",
    observedAtUtc: "2026-08-02T16:45:00.000Z",
    bridge: {
      historicalTipRevision: historicalTip,
      historicalTipTree: cleanRootTree,
      cleanRootRevision: cleanRoot,
      cleanRootTree,
      sourceArchiveSha256: "2".repeat(64),
      sourceSecretScanAdjudicationSha256: "3".repeat(64)
    },
    limits: {
      maximumBlobBytes: 1024,
      maximumBlobCount: 4,
      maximumSourceFileBytes: 4096,
      maximumWitnessBytes: 64 * 1024
    },
    revisionParents: [
      { revision: addition, parent: historicalParent },
      { revision: historicalTip, parent: addition }
    ],
    ancestry: [
      { ancestor: historicalParent, descendant: addition },
      { ancestor: historicalParent, descendant: historicalTip },
      { ancestor: addition, descendant: historicalTip }
    ],
    pathAdditions: [
      { path: "evidence/preregistration.json", revision: addition }
    ],
    pathStates: [
      {
        revision: addition,
        path: "evidence/planned-output.json",
        present: false
      }
    ],
    lastChanges: [
      {
        atRevision: historicalTip,
        paths: ["evidence/implementation.js"],
        revision: historicalTip
      }
    ],
    blobs: [
      {
        revision: historicalParent,
        path: "evidence/input.txt",
        bytes: blobBytes.length,
        sha256: blobSha256,
        storageKind: "witness-blob",
        storagePath: blobRelativePath
      }
    ]
  };
  witness.revisionParents.sort((left, right) =>
    left.revision < right.revision ? -1 : 1);
  witness.ancestry.sort((left, right) => {
    const leftKey = `${left.ancestor}\u0000${left.descendant}`;
    const rightKey = `${right.ancestor}\u0000${right.descendant}`;
    return leftKey < rightKey ? -1 : 1;
  });
  witness.pathAdditions.sort((left, right) => left.path < right.path ? -1 : 1);
  witness.pathStates.sort((left, right) => {
    const leftKey = `${left.revision}\u0000${left.path}`;
    const rightKey = `${right.revision}\u0000${right.path}`;
    return leftKey < rightKey ? -1 : 1;
  });
  witness.lastChanges.sort((left, right) => {
    const leftKey = `${left.atRevision}\u0000${left.paths.join("\u0000")}`;
    const rightKey = `${right.atRevision}\u0000${right.paths.join("\u0000")}`;
    return leftKey < rightKey ? -1 : 1;
  });
  witness.blobs.sort((left, right) => {
    const leftKey = `${left.revision}\u0000${left.path}`;
    const rightKey = `${right.revision}\u0000${right.path}`;
    return leftKey < rightKey ? -1 : 1;
  });
  const witnessPath = path.join(lineageRoot, "witness.v1.json");
  const witnessBytes = canonicalWitnessBytes(witness);
  fs.writeFileSync(witnessPath, witnessBytes, { flag: "wx" });

  return {
    addition,
    blobBytes,
    cleanRoot,
    head,
    historicalParent,
    historicalTip,
    lineageRoot,
    repositoryRoot: root,
    witness,
    witnessPath,
    witnessSha256: sha256(witnessBytes)
  };
}

test("uses bounded witness evidence for pre-clean-history facts", (context) => {
  const value = fixture(context);
  const reader = createLineageReader({
    repositoryRoot: value.repositoryRoot,
    witnessPath: value.witnessPath,
    expectedWitnessSha256: value.witnessSha256
  });

  assert.equal(reader.headRevision(), value.head);
  assert.equal(reader.hasRevision(value.historicalParent), true);
  assert.equal(reader.hasRevision(value.cleanRoot), true);
  assert.equal(reader.parentRevision(value.addition), value.historicalParent);
  assert.equal(
    reader.pathAdditionCommit("evidence/preregistration.json"),
    value.addition
  );
  assert.equal(
    reader.pathExistsAtRevision(value.addition, "evidence/planned-output.json"),
    false
  );
  assert.equal(
    reader.lastChangeCommit(
      ["evidence/implementation.js"],
      value.historicalTip
    ),
    value.historicalTip
  );
  assert.equal(reader.isAncestor(value.historicalParent, value.historicalTip), true);
  assert.equal(reader.isAncestor(value.historicalParent, value.head), true);
  assert.deepEqual(
    reader.readBlob(value.historicalParent, "evidence/input.txt"),
    value.blobBytes
  );
});

test("returns detached witness bytes and native clean-history bytes", (context) => {
  const value = fixture(context);
  const reader = createLineageReader({
    repositoryRoot: value.repositoryRoot,
    witnessPath: value.witnessPath,
    expectedWitnessSha256: value.witnessSha256
  });

  const first = reader.readBlob(value.historicalParent, "evidence/input.txt");
  first[0] ^= 0xff;
  assert.deepEqual(
    reader.readBlob(value.historicalParent, "evidence/input.txt"),
    value.blobBytes
  );
  assert.equal(
    reader.readBlob(value.cleanRoot, "README.md").toString("utf8"),
    "clean root\n"
  );
});

test("never falls back to reachable legacy Git objects", (context) => {
  const value = fixture(context);
  const reader = createLineageReader({
    repositoryRoot: value.repositoryRoot,
    witnessPath: value.witnessPath,
    expectedWitnessSha256: value.witnessSha256
  });

  assert.throws(
    () => reader.readBlob(value.historicalTip, "evidence/implementation.js"),
    /historical blob is not witnessed/u
  );
  assert.equal(reader.hasRevision("0".repeat(40)), false);
  assert.throws(
    () => reader.isAncestor("0".repeat(40), "0".repeat(40)),
    /historical revision is not witnessed/u
  );
  assert.throws(
    () => reader.pathExistsAtRevision(
      value.addition,
      "evidence/preregistration.json"
    ),
    /historical path state is not witnessed/u
  );
});

test("fails closed on witness hash, structure, path, and blob drift", (context) => {
  const value = fixture(context);
  assert.throws(
    () => createLineageReader({
      repositoryRoot: value.repositoryRoot,
      witnessPath: value.witnessPath,
      expectedWitnessSha256: "0".repeat(64)
    }),
    /witness hash is invalid/u
  );

  const changed = structuredClone(value.witness);
  changed.unexpected = true;
  fs.writeFileSync(value.witnessPath, canonicalWitnessBytes(changed));
  assert.throws(
    () => createLineageReader({
      repositoryRoot: value.repositoryRoot,
      witnessPath: value.witnessPath,
      expectedWitnessSha256: sha256(canonicalWitnessBytes(changed))
    }),
    /witness fields are invalid/u
  );

  delete changed.unexpected;
  changed.blobs[0].path = "../private";
  fs.writeFileSync(value.witnessPath, canonicalWitnessBytes(changed));
  assert.throws(
    () => createLineageReader({
      repositoryRoot: value.repositoryRoot,
      witnessPath: value.witnessPath,
      expectedWitnessSha256: sha256(canonicalWitnessBytes(changed))
    }),
    /historical path is unsafe/u
  );
});

test("rejects model artifacts and altered blob bytes", (context) => {
  const value = fixture(context);
  const model = structuredClone(value.witness);
  model.blobs[0].path = "models/forbidden.slm";
  fs.writeFileSync(value.witnessPath, canonicalWitnessBytes(model));
  assert.throws(
    () => createLineageReader({
      repositoryRoot: value.repositoryRoot,
      witnessPath: value.witnessPath,
      expectedWitnessSha256: sha256(canonicalWitnessBytes(model))
    }),
    /historical path is forbidden/u
  );

  fs.writeFileSync(value.witnessPath, canonicalWitnessBytes(value.witness));
  const storagePath = path.join(
    value.lineageRoot,
    ...value.witness.blobs[0].storagePath.split("/")
  );
  fs.appendFileSync(storagePath, "drift");
  assert.throws(
    () => createLineageReader({
      repositoryRoot: value.repositoryRoot,
      witnessPath: value.witnessPath,
      expectedWitnessSha256: value.witnessSha256
    }),
    /historical blob bytes are invalid/u
  );
});

test("rejects unreferenced files in witness blob storage", (context) => {
  const value = fixture(context);
  const storageDirectory = path.dirname(path.join(
    value.lineageRoot,
    ...value.witness.blobs[0].storagePath.split("/")
  ));
  fs.writeFileSync(path.join(storageDirectory, `${"f".repeat(64)}.blob`), "extra");

  assert.throws(
    () => createLineageReader({
      repositoryRoot: value.repositoryRoot,
      witnessPath: value.witnessPath,
      expectedWitnessSha256: value.witnessSha256
    }),
    /historical blob storage closure is invalid/u
  );
});

test("binds the exact bounded secret-scan adjudication", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-adjudication-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const result = validateSecretScanAdjudication(
    defaultSecretScanAdjudicationPath,
    productionSecretScanAdjudicationSha256,
    productionWitnessSha256
  );
  assert.equal(
    result.value.status,
    "accepted-for-source-control"
  );
  assert.equal(result.value.authority.publicWebPublication, false);
  assert.equal(result.value.scan.knownSecretEqualityScanPerformed, false);

  const changed = structuredClone(result.value);
  changed.authority.publicWebPublication = true;
  const changedPath = path.join(root, "changed-adjudication.json");
  const changedBytes = canonicalWitnessBytes(changed);
  fs.writeFileSync(changedPath, changedBytes);
  assert.throws(
    () => validateSecretScanAdjudication(
      changedPath,
      sha256(changedBytes),
      productionWitnessSha256
    ),
    /secret-scan authority is invalid/u
  );
});

test("validates the production source-history witness", () => {
  const reader = productionLineageReader();
  const head = reader.headRevision();
  const registration = "c90dfe8b62f79067df3e1972dcf62c0524ba26ba";
  const historicalParent = "9e16e8dc84d4abdbc1d45760fa512e3acb3a678b";
  const turboVecRegistration = "54768399222e6956d77f58c154b109d041a43937";
  const turboVecImplementation = "ffc489248c4555437ad4ad73be02caf2bec66a16";

  assert.equal(
    reader.secretScanAdjudicationId,
    "tinyrustlm-clean-history-secret-scan-20260802"
  );
  assert.equal(reader.parentRevision(registration), historicalParent);
  assert.equal(reader.isAncestor(historicalParent, head), true);
  assert.equal(
    reader.pathAdditionCommit(
      "tinyrustlm/experiments/vector-quantization/" +
        "portable-affine-u8-quality-diagnostic-preregistration.v1.json"
    ),
    registration
  );
  assert.equal(
    reader.readBlob(historicalParent, "Cargo.toml").length,
    1090
  );
  assert.equal(
    reader.pathAdditionCommit(
      "tinyrustlm/experiments/vector-quantization/" +
        "turbovec-reference-comparison-preregistration.v1.json"
    ),
    turboVecRegistration
  );
  assert.equal(
    reader.lastChangeCommit([
      "tinyrustlm/experiments/vector-quantization/" +
        "turbovec-reference-comparison/Cargo.lock",
      "tinyrustlm/experiments/vector-quantization/" +
        "turbovec-reference-comparison/Cargo.toml",
      "tinyrustlm/experiments/vector-quantization/" +
        "turbovec-reference-comparison/src/main.rs",
      "tinyrustlm/tests/vector-turbovec-reference-observation.test.js",
      "tinyrustlm/tests/vector-turbovec-reference-verification.test.js",
      "tinyrustlm/tools/vector-turbovec-reference-observation.js",
      "tinyrustlm/tools/vector-turbovec-reference-verification.js"
    ], reader.historicalTipRevision),
    turboVecImplementation
  );
  assert.equal(
    reader.isAncestor(turboVecRegistration, turboVecImplementation),
    true
  );
});
