"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const {
  NumericalTraceVerificationError,
  canonicalJsonBytes,
  expectedStages,
  verify
} = require("../tools/qwen3-numerical-trace-verifier.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "qwen3-numerical-differential-profile.v1.json");
const profileBytes = fs.readFileSync(profilePath);
const profile = JSON.parse(profileBytes.toString("utf8"));
const oraclePython = process.env.TINYRUSTLM_QWEN3_NUMERICAL_ORACLE_PYTHON || "";
const registrationSha256 = "9".repeat(64);
const requestIdentity = Object.freeze({ byteLength: 1234, sha256: "8".repeat(64) });
const stageElements = Object.freeze({
  "token-embedding": 1024,
  "attention-normalized": 1024,
  "query-after-rope": 2048,
  "key-after-rope": 1024,
  value: 1024,
  attention: 2048,
  "post-attention-residual": 1024,
  "feed-forward-normalized": 1024,
  "feed-forward-activated": 3072,
  "post-feed-forward-residual": 1024,
  "final-normalized": 1024,
  logits: 151936
});

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function f32Hex(value) {
  const bytes = Buffer.alloc(4);
  bytes.writeFloatLE(value);
  return bytes.readUInt32LE(0).toString(16).padStart(8, "0");
}

function identity(relativePath) {
  const bytes = fs.readFileSync(path.join(repositoryRoot, relativePath));
  return { path: relativePath, byteLength: bytes.length, sha256: sha256(bytes) };
}

function modelSpec() {
  return {
    vocabularySize: 151936,
    contextLength: 40960,
    embeddingSize: 1024,
    feedForwardSize: 3072,
    layerCount: 28,
    headCount: 16,
    kvHeadCount: 8,
    headDimension: 128,
    ropeTheta: 1000000,
    normalizationEpsilon: 0.000001,
    tiedEmbeddings: true,
    qkvBias: false,
    qkNormalization: true
  };
}

function environmentBinding() {
  const authority = profile.implementations.environmentAuthority;
  const lock = profile.environment.lock;
  return {
    authority: {
      relativePath: authority.path,
      byteLength: authority.byteLength,
      sha256: authority.sha256
    },
    lock: {
      relativePath: lock.path,
      byteLength: lock.byteLength,
      sha256: lock.sha256,
      profileId: lock.profileId,
      runtimeClosureSha256: lock.runtimeClosureSha256
    }
  };
}

function stageValue(stageIndex, elementIndex, stage) {
  if (stage === "logits") {
    if (elementIndex === 7) return 100;
    return Math.fround(-Math.abs((elementIndex % 101) - 50) / 32);
  }
  return Math.fround(((elementIndex % 37) - 18) / 16 + (stageIndex % 11) / 1024);
}

function makeTrace(mutation = null) {
  const stages = [];
  const buffers = [];
  let offset = 0;
  expectedStages().forEach((entry, stageIndex) => {
    const elementCount = stageElements[entry.stage];
    const bytes = Buffer.allocUnsafe(elementCount * 4);
    for (let element = 0; element < elementCount; element += 1) {
      let value = stageValue(stageIndex, element, entry.stage);
      if (mutation && mutation.stage === entry.stage && mutation.layer === entry.layer
          && mutation.element === element) {
        value = Math.fround(value + mutation.delta);
      }
      bytes.writeFloatLE(value, element * 4);
    }
    stages.push({
      stage: entry.stage,
      layer: entry.layer,
      offsetBytes: offset,
      elementCount,
      byteLength: bytes.length,
      f32leSha256: sha256(bytes)
    });
    buffers.push(bytes);
    offset += bytes.length;
  });
  const bytes = Buffer.concat(buffers);
  return { bytes, stages };
}

function stepFromTrace(trace) {
  return {
    step: 0,
    positionBefore: 0,
    positionAfter: 1,
    committedKvBytes: 229376,
    greedyTokenId: 7,
    traceFile: "case-000-step-000.f32le",
    traceByteLength: trace.bytes.length,
    traceSha256: sha256(trace.bytes),
    stages: trace.stages
  };
}

function caseFromTrace(trace) {
  return {
    id: "fixture-case",
    tokenCount: 1,
    tokenIdsLeU32Sha256: sha256(Buffer.from([1, 0, 0, 0])),
    steps: [stepFromTrace(trace)]
  };
}

function genericManifest(kind, trace) {
  const source = kind === "source"
    ? {
      modelId: "Qwen/Qwen3-0.6B",
      revision: "c1899de289a04d12100db370d81485cdf75e47ca",
      sourceLock: {
        byteLength: profile.candidate.sourceLock.byteLength,
        sha256: profile.candidate.sourceLock.sha256
      },
      model: { fileName: "model.safetensors", byteLength: 1503300328, sha256: "2".repeat(64) }
    }
    : {
      compositionResultSha256: profile.candidate.compositionResult.sha256,
      model: {
        fileName: "model.slm2",
        byteLength: profile.candidate.modelSlm2.byteLength,
        sha256: profile.candidate.modelSlm2.sha256
      }
    };
  const implementation = kind === "source"
    ? {
      kind: "publisher-source-framework",
      profileId: "tinyrustlm.qwen3-publisher-source-trace/2",
      pythonVersion: "3.12.10",
      packages: {
        accelerate: "1.14.0",
        numpy: "2.2.5",
        psutil: "7.2.2",
        safetensors: "0.5.3",
        tokenizers: "0.21.1",
        torch: "2.7.0",
        transformers: "4.51.0"
      },
      device: "cpu",
      dtype: "float32",
      attentionImplementation: "eager",
      threads: 1,
      environment: environmentBinding()
    }
    : {
      kind: "slm2-reconstructed-weight-diagnostic",
      profileId: "tinyrustlm.qwen3-slm2-reconstructed-trace/1",
      pythonVersion: "3.12.10",
      packages: { numpy: "2.2.5" },
      matrixChunkRows: 64,
      wholeModelF32Shadow: false,
      environment: environmentBinding()
    };
  return {
    schema: "tinyrustlm.numerical_trace_bundle.v1",
    operationId: "fixture-numerical-operation",
    status: "completed",
    claim: kind === "source"
      ? "private-publisher-source-traces-created-not-numerical-parity"
      : "private-reconstructed-slm2-traces-created-not-numerical-parity",
    implementation,
    request: requestIdentity,
    differentialProfileSha256: sha256(profileBytes),
    registrationSha256,
    traceProfileId: "tinyrustlm.scalar-full-stage-f32le/1",
    source,
    modelSpec: modelSpec(),
    caseCount: 1,
    traceFileCount: 1,
    traceByteLength: trace.bytes.length,
    cases: [caseFromTrace(trace)],
    durability: {
      traceFilesSynced: true,
      resultFileSynced: true,
      directorySyncClaimed: false
    },
    requiredNextGate: "independent-source-reconstructed-scalar-trace-verification"
  };
}

function scalarManifest(trace) {
  return {
    schema: "tinyrustlm.scalar-numerical-probe-result.v1",
    operationId: "fixture-numerical-operation",
    status: "completed",
    claim: "private-scalar-traces-created-not-numerical-parity",
    request: requestIdentity,
    compositionResultSha256: profile.candidate.compositionResult.sha256,
    traceProfileId: "tinyrustlm.scalar-full-stage-f32le/1",
    model: {
      fileName: "model.slm2",
      byteLength: profile.candidate.modelSlm2.byteLength,
      sha256: profile.candidate.modelSlm2.sha256
    },
    modelSpec: {
      vocabularySize: 151936,
      contextLength: 40960,
      embeddingSize: 1024,
      feedForwardSize: 3072,
      layerCount: 28,
      headCount: 16,
      kvHeadCount: 8,
      headDimension: 128,
      ropeThetaF32Bits: f32Hex(1000000),
      normalizationEpsilonF32Bits: f32Hex(0.000001),
      tiedEmbeddings: true,
      qkvBias: false,
      qkNormalization: true
    },
    policy: {
      maximumModelBytes: 700000000,
      maximumSequenceTokens: 8,
      maximumKvBytes: 100000000,
      maximumScratchBytes: 100000000,
      maximumTraceBytes: 100000000,
      maximumCases: 4,
      maximumTokensPerCase: 4
    },
    memoryPlan: {
      modelBytes: profile.candidate.modelSlm2.byteLength,
      reservedKvBytes: 1835008,
      scratchBytes: 1000000
    },
    caseCount: 1,
    traceFileCount: 1,
    traceByteLength: trace.bytes.length,
    cases: [caseFromTrace(trace)],
    durability: {
      traceFilesSynced: true,
      resultFileSynced: true,
      directorySyncClaimed: false
    },
    requiredNextGate: "independent-source-and-scalar-trace-verification"
  };
}

function writeBundle(parent, kind, mutation = null, manifestMutation = null) {
  const root = path.join(parent, kind);
  fs.mkdirSync(root);
  const trace = makeTrace(mutation);
  fs.writeFileSync(path.join(root, "case-000-step-000.f32le"), trace.bytes,
    { flag: "wx" });
  const manifest = kind === "scalar" ? scalarManifest(trace) : genericManifest(kind, trace);
  if (manifestMutation) manifestMutation(manifest);
  const bytes = canonicalJsonBytes(manifest, kind !== "scalar");
  fs.writeFileSync(path.join(root, "probe.json"), bytes, { flag: "wx" });
  return {
    root,
    manifest: { fileName: "probe.json", byteLength: bytes.length, sha256: sha256(bytes) }
  };
}

function exactThreshold() {
  return {
    maximumAbsoluteError: 0,
    maximumRelativeError: 0,
    maximumNormalizedRmse: 0,
    minimumCosineSimilarity: 1,
    maximumSignDisagreementRate: 0,
    maximumUlp: 0
  };
}

function writeRequest(parent, bundles, mutate = null) {
  const arrow = (id, reference, candidate) => ({
    id,
    reference,
    candidate,
    requireGreedyTokenIdentity: true,
    minimumTopKOverlap: 1,
    thresholds: { default: exactThreshold(), stages: {} }
  });
  const request = {
    schema: "tinyrustlm.qwen3_numerical_trace_verification_request.v1",
    operationId: "fixture-numerical-operation",
    differentialProfile: {
      relativePath: "contracts/vnext/qwen3-numerical-differential-profile.v1.json",
      byteLength: profileBytes.length,
      sha256: sha256(profileBytes)
    },
    registrationSha256,
    traceProfileId: "tinyrustlm.scalar-full-stage-f32le/1",
    bundles,
    comparison: {
      chunkElements: 64,
      relativeFloor: 1e-7,
      signFloor: 1e-8,
      topK: 8,
      arrows: [
        arrow("source-to-reconstructed", "source", "reconstructed"),
        arrow("reconstructed-to-scalar", "reconstructed", "scalar")
      ]
    },
    policy: {
      maximumManifestBytes: 32 * 1024 * 1024,
      maximumTraceBytes: 64 * 1024 * 1024,
      maximumReceiptBytes: 1024 * 1024,
      maximumCases: 4,
      maximumTokensPerCase: 4
    }
  };
  if (mutate) mutate(request);
  const requestPath = path.join(parent, "verify-request.json");
  fs.writeFileSync(requestPath, canonicalJsonBytes(request, true), { flag: "wx" });
  return requestPath;
}

function fixture(mutations = {}) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-qwen3-numerical-"));
  const bundles = {
    source: writeBundle(parent, "source", mutations.source, mutations.sourceManifest),
    reconstructed: writeBundle(parent, "reconstructed", mutations.reconstructed,
      mutations.reconstructedManifest),
    scalar: writeBundle(parent, "scalar", mutations.scalar, mutations.scalarManifest)
  };
  const requestPath = writeRequest(parent, bundles, mutations.request);
  return {
    parent,
    bundles,
    requestPath,
    close() {
      assert.equal(path.dirname(parent), os.tmpdir());
      fs.rmSync(parent, { recursive: true, force: false });
    }
  };
}

function treeIdentity(root) {
  const output = [];
  function walk(current) {
    for (const name of fs.readdirSync(current).sort()) {
      const item = path.join(current, name);
      const stat = fs.lstatSync(item);
      if (stat.isDirectory()) walk(item);
      else {
        const bytes = fs.readFileSync(item);
        output.push([path.relative(root, item), bytes.length, sha256(bytes)]);
      }
    }
  }
  walk(root);
  return output;
}

test("freezes report-derived clean-slate numerical authority boundaries", () => {
  assert.equal(profileBytes.toString("utf8"), `${JSON.stringify(profile, null, 2)}\n`);
  assert.equal(profile.schema, "tinyrustlm.qwen3_numerical_differential_profile.v1");
  assert.equal(profile.profileId, "tinyrustlm.qwen3-source-reconstructed-scalar-differential/1");
  assert.equal(profile.authority.shippingRuntime, false);
  assert.equal(profile.authority.fallbackRuntime, false);
  assert.equal(profile.authority.bestOfN, false);
  assert.equal(profile.execution.currentRealExecutionStatus, "not-registered-not-run");
  assert.equal(profile.candidate.numericalClaim, "unproven");
  assert.equal(profile.trace.selectedModelStageCountPerToken, 255);
  assert.equal(expectedStages().length, 255);
  assert.deepEqual(profile.proofArrows.map((value) => value.id), [
    "source-to-reconstructed", "reconstructed-to-scalar"
  ]);
});

test("binds every implementation and durable report-memory deep link by content", () => {
  for (const record of Object.values(profile.reportLineage)) {
    if (record && typeof record === "object" && record.path) {
      assert.deepEqual(record, identity(record.path));
    }
  }
  for (const record of Object.values(profile.implementations)) {
    if (record.path) {
      const actual = identity(record.path);
      assert.equal(record.byteLength, actual.byteLength, record.path);
      assert.equal(record.sha256, actual.sha256, record.path);
    }
  }
  const lock = identity(profile.candidate.sourceLock.path);
  assert.equal(profile.candidate.sourceLock.byteLength, lock.byteLength);
  assert.equal(profile.candidate.sourceLock.sha256, lock.sha256);
  const environmentDocument = JSON.parse(fs.readFileSync(
    path.join(repositoryRoot, profile.environment.lock.path), "utf8"));
  assert.equal(fs.readFileSync(path.join(repositoryRoot, profile.environment.lock.path), "utf8"),
    canonicalJsonBytes(environmentDocument, true).toString("utf8"));
  assert.deepEqual(profile.environment.lock, {
    ...identity(profile.environment.lock.path),
    profileId: "tinyrustlm.qwen3-numerical-oracle-python-win-x64/2",
    runtimeClosureSha256: environmentDocument.runtimeEnvironment.closure.closureSha256
  });
  assert.equal(environmentDocument.wheelhouse.wheelCount, 31);
  assert.equal(environmentDocument.bootstrapEnvironment.distributions.length, 4);
  assert.equal(environmentDocument.runtimeEnvironment.distributions.length, 28);
});

test("both private owners expose bounded dependency-free self-tests", () => {
  for (const relative of [
    "tinyrustlm/tools/qwen3-numerical-source-owner.py",
    "tinyrustlm/tools/qwen3-slm2-reconstructed-owner.py",
    "tinyrustlm/tools/qwen3_numerical_environment_lock.py"
  ]) {
    const result = spawnSync("py", ["-3.12", path.join(repositoryRoot, relative), "--self-test"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true
    });
    assert.equal(result.status, 0, `${relative}: ${result.stderr}`);
    assert.match(result.stdout, /"status": "pass"/u);
  }
});

test("pinned Python executes synthetic Qwen3 hooks and reconstructed kernels", {
  skip: oraclePython.length === 0
}, () => {
  for (const [relative, operation] of [
    ["tinyrustlm/tools/qwen3-numerical-source-owner.py", "--framework-self-test"],
    ["tinyrustlm/tools/qwen3-slm2-reconstructed-owner.py", "--numpy-self-test"]
  ]) {
    const result = spawnSync(oraclePython, [
      "-I", "-B", path.join(repositoryRoot, relative), operation
    ], {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" }
    });
    assert.equal(result.status, 0, `${relative}: ${result.stderr}`);
    assert.match(result.stdout, /"status": "pass"/u);
  }
});

test("read-only verifier passes identical complete traces without touching evidence", () => {
  const value = fixture();
  try {
    const before = treeIdentity(value.parent);
    const receipt = verify([value.requestPath]);
    const after = treeIdentity(value.parent);
    assert.equal(receipt.status, "pass");
    assert.equal(receipt.claim,
      "registered-source-reconstructed-scalar-traces-within-bounds");
    assert.equal(receipt.comparison.arrowResults.length, 2);
    assert.equal(receipt.comparison.firstDivergence, null);
    assert.equal(receipt.writesPerformed, false);
    assert.deepEqual(after, before);
  } finally {
    value.close();
  }
});

test("localizes the first source-to-reconstructed divergence by layer head element and chunk", () => {
  const value = fixture({
    reconstructed: {
      stage: "key-after-rope",
      layer: 0,
      element: 129,
      delta: 0.25
    }
  });
  try {
    const receipt = verify([value.requestPath]);
    assert.equal(receipt.status, "fail");
    assert.equal(receipt.comparison.arrowResults.length, 1);
    assert.deepEqual({
      arrow: receipt.comparison.firstDivergence.arrow,
      caseId: receipt.comparison.firstDivergence.caseId,
      step: receipt.comparison.firstDivergence.step,
      stage: receipt.comparison.firstDivergence.stage,
      layer: receipt.comparison.firstDivergence.layer,
      head: receipt.comparison.firstDivergence.head,
      elementIndex: receipt.comparison.firstDivergence.elementIndex,
      chunkIndex: receipt.comparison.firstDivergence.chunkIndex
    }, {
      arrow: "source-to-reconstructed",
      caseId: "fixture-case",
      step: 0,
      stage: "key-after-rope",
      layer: 0,
      head: 1,
      elementIndex: 129,
      chunkIndex: 2
    });
  } finally {
    value.close();
  }
});

test("localizes reconstructed-to-scalar only after the first arrow passes", () => {
  const value = fixture({
    scalar: {
      stage: "feed-forward-activated",
      layer: 2,
      element: 130,
      delta: -0.5
    }
  });
  try {
    const receipt = verify([value.requestPath]);
    assert.equal(receipt.status, "fail");
    assert.equal(receipt.comparison.arrowResults.length, 2);
    assert.equal(receipt.comparison.arrowResults[0].status, "pass");
    assert.equal(receipt.comparison.firstDivergence.arrow, "reconstructed-to-scalar");
    assert.equal(receipt.comparison.firstDivergence.stage, "feed-forward-activated");
    assert.equal(receipt.comparison.firstDivergence.layer, 2);
    assert.equal(receipt.comparison.firstDivergence.elementIndex, 130);
  } finally {
    value.close();
  }
});

test("rejects a syntactically valid cross-arm environment drift", () => {
  const value = fixture({
    reconstructedManifest(manifest) {
      manifest.implementation.environment.lock.runtimeClosureSha256 = "f".repeat(64);
    }
  });
  try {
    assert.throws(() => verify([value.requestPath]), (error) =>
      error instanceof NumericalTraceVerificationError
      && error.code === "numerical-verifier-environment-binding");
  } finally {
    value.close();
  }
});

test("rejects trace drift and an unknown request member instead of repairing either", () => {
  const drift = fixture();
  try {
    const tracePath = path.join(drift.bundles.scalar.root, "case-000-step-000.f32le");
    const descriptor = fs.openSync(tracePath, "r+");
    try {
      const one = Buffer.alloc(1);
      fs.readSync(descriptor, one, 0, 1, 0);
      one[0] ^= 1;
      fs.writeSync(descriptor, one, 0, 1, 0);
    } finally {
      fs.closeSync(descriptor);
    }
    assert.throws(() => verify([drift.requestPath]), (error) =>
      error instanceof NumericalTraceVerificationError
      && error.code === "numerical-verifier-trace-identity");
  } finally {
    drift.close();
  }

  const unknown = fixture({ request(request) { request.legacyTolerance = true; } });
  try {
    assert.throws(() => verify([unknown.requestPath]), (error) =>
      error instanceof NumericalTraceVerificationError
      && error.code === "numerical-verifier-request");
  } finally {
    unknown.close();
  }
});

test("verifier source contains no evidence-writing or permissive selection path", () => {
  const source = fs.readFileSync(path.join(repositoryRoot,
    "tinyrustlm/tools/qwen3-numerical-trace-verifier.js"), "utf8");
  assert.doesNotMatch(source, /fs\.(?:write|append|mkdir|rm|rename|copy|createWriteStream)/u);
  assert.doesNotMatch(source, /best[_-]of[_-]n/iu);
  assert.doesNotMatch(source, /response[_-]repair/iu);
  assert.match(source, /firstDivergence/u);
  assert.match(source, /writesPerformed: false/u);
});
