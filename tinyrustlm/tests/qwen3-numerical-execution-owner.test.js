"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const owner = require("../tools/qwen3-numerical-execution-owner.js");
const { createOwnedTemporaryDirectory, removeOwnedTemporaryDirectory } =
  require("../tools/canonical-operation-scratch.js");
const repositoryRoot = path.resolve(__dirname, "../..");

const ZERO_SHA = "0".repeat(64);
const TRACE_PROFILE_ID = "tinyrustlm.scalar-full-stage-f32le/1";
const MODEL_BYTE_LENGTH = 598308416;
const MODEL_SHA256 =
  "a0e351cdba8a4567d703e0f77c73c77ed08f783bb5420a19dfeef733c97cb2e7";
const SOURCE_LOCK_BYTE_LENGTH = 1901;
const SOURCE_LOCK_SHA256 =
  "50a8c29e36398a9a088e4d9a224dad186809d34b1e050299d3ce3de7a01b7d0e";
const COMPOSITION_RESULT_BYTE_LENGTH = 18441;
const COMPOSITION_RESULT_SHA256 =
  "0c3e84ad9ce6e22d9a164357c9a900d31825d0639f4f11077dab305f9cf3ef0e";

function tokenDigest(tokenIds) {
  const bytes = Buffer.alloc(tokenIds.length * 4);
  tokenIds.forEach((token, index) => bytes.writeUInt32LE(token, index * 4));
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function artifact(role, relativePath) {
  if (role === "source-lock") {
    return { role, relativePath, byteLength: SOURCE_LOCK_BYTE_LENGTH,
      sha256: SOURCE_LOCK_SHA256 };
  }
  if (role === "composition-result") {
    return { role, relativePath, byteLength: COMPOSITION_RESULT_BYTE_LENGTH,
      sha256: COMPOSITION_RESULT_SHA256 };
  }
  return { role, relativePath, byteLength: 1, sha256: ZERO_SHA };
}

function publicArtifact(relativePath) {
  return { path: relativePath, byteLength: 1, sha256: ZERO_SHA };
}

function metricThreshold(maximumAbsoluteError, maximumRelativeError,
  maximumNormalizedRmse, minimumCosineSimilarity, maximumSignDisagreementRate,
  maximumUlp) {
  return { maximumAbsoluteError, maximumRelativeError, maximumNormalizedRmse,
    minimumCosineSimilarity, maximumSignDisagreementRate, maximumUlp };
}

function registeredComparison() {
  return {
    chunkElements: 65536,
    relativeFloor: 0.000001,
    signFloor: 0.00001,
    topK: 20,
    arrows: [
      {
        id: "source-to-reconstructed",
        reference: "source",
        candidate: "reconstructed",
        requireGreedyTokenIdentity: false,
        minimumTopKOverlap: 0.8,
        thresholds: {
          default: metricThreshold(1, 2, 0.08, 0.99, 0.05, 2147483647),
          stages: {
            "attention-normalized": metricThreshold(0.1, 1, 0.05, 0.998, 0.03,
              2147483647),
            "feed-forward-activated": metricThreshold(2, 3, 0.1, 0.98, 0.08,
              2147483647),
            "feed-forward-normalized": metricThreshold(0.1, 1, 0.05, 0.998, 0.03,
              2147483647),
            "final-normalized": metricThreshold(0.1, 1, 0.05, 0.998, 0.03,
              2147483647),
            logits: metricThreshold(1.5, 3, 0.08, 0.98, 0.1, 2147483647),
            "token-embedding": metricThreshold(0.02, 1, 0.03, 0.999, 0.03,
              2147483647)
          }
        }
      },
      {
        id: "reconstructed-to-scalar",
        reference: "reconstructed",
        candidate: "scalar",
        requireGreedyTokenIdentity: true,
        minimumTopKOverlap: 1,
        thresholds: {
          default: metricThreshold(0.02, 0.05, 0.002, 0.99999, 0.001, 1048576),
          stages: {
            "feed-forward-activated": metricThreshold(0.1, 0.1, 0.005, 0.999, 0.005,
              4194304),
            logits: metricThreshold(0.2, 0.1, 0.005, 0.999, 0.005, 4194304),
            "post-attention-residual": metricThreshold(0.05, 0.08, 0.003, 0.9999,
              0.002, 2097152),
            "post-feed-forward-residual": metricThreshold(0.05, 0.08, 0.003, 0.9999,
              0.002, 2097152),
            "token-embedding": metricThreshold(0, 0, 0, 1, 0, 0)
          }
        }
      }
    ]
  };
}

/** Synthetic current contract values exercise validation without registering or launching a model. */
function ownerContract() {
  const operationId = "qwen3-numerical-c1899de-1111111-20260913-v4";
  return {
    schema: owner.OWNER_CONTRACT_SCHEMA,
    operationId,
    traceProfileId: TRACE_PROFILE_ID,
    implementationArtifacts: [
      artifact("execution-owner", "tinyrustlm/tools/qwen3-numerical-execution-owner.js"),
      artifact("canonical-scratch", "tinyrustlm/tools/canonical-operation-scratch.js"),
      artifact("source-authority", "tinyrustlm/tools/verify-single-source-authority.js"),
      artifact("retired-storage-policy", "contracts/storage/retired-storage-roots-2026-09-12.json"),
      artifact("differential-profile",
        "contracts/vnext/qwen3-numerical-differential-profile.v2.json"),
      artifact("environment-authority",
        "tinyrustlm/tools/qwen3_numerical_environment_lock.py"),
      artifact("environment-lock",
        "contracts/vnext/qwen3-numerical-oracle-environment-lock.v2.json"),
      artifact("source-owner", "tinyrustlm/tools/qwen3-numerical-source-owner.py"),
      artifact("reconstructed-owner", "tinyrustlm/tools/qwen3-slm2-reconstructed-owner.py"),
      artifact("scalar-source", "rust/crates/tinyrustlm-numerical-probe/src/main.rs"),
      artifact("scalar-profile", "contracts/vnext/scalar-numerical-probe-profile.v1.json"),
      artifact("verifier", "tinyrustlm/tools/qwen3-numerical-trace-verifier.js"),
      artifact("source-lock", "contracts/vnext/qwen3-0.6b-base-source-lock.v2.json"),
      artifact("composition-result",
        "contracts/vnext/qwen3-real-composition-execution-result.v12.json")
    ],
    executables: {
      git: { basename: "git.exe", byteLength: 1, sha256: ZERO_SHA },
      python: { basename: "python.exe", byteLength: 1, sha256: ZERO_SHA },
      node: { basename: "node.exe", byteLength: 1, sha256: ZERO_SHA },
      scalar: { basename: "tinyrustlm-numerical-probe.exe", byteLength: 1,
        sha256: ZERO_SHA },
      termination: { basename: "taskkill.exe", byteLength: 1, sha256: ZERO_SHA }
    },
    cases: [
      { id: "low-vocabulary-boundary", tokenIds: [0],
        tokenIdsLeU32Sha256: tokenDigest([0]) },
      { id: "repeated-kv-position", tokenIds: [17, 17],
        tokenIdsLeU32Sha256: tokenDigest([17, 17]) },
      { id: "high-vocabulary-mixed-cache", tokenIds: [151935, 151645, 220, 151935],
        tokenIdsLeU32Sha256: tokenDigest([151935, 151645, 220, 151935]) }
    ],
    requests: {
      source: {
        schema: "tinyrustlm.qwen3_numerical_source_request.v2",
        sourceLock: { relativePath: "contracts/vnext/qwen3-0.6b-base-source-lock.v2.json",
          byteLength: SOURCE_LOCK_BYTE_LENGTH, sha256: SOURCE_LOCK_SHA256 },
        framework: {
          accelerateVersion: "1.14.0",
          attentionImplementation: "eager",
          deterministicAlgorithms: true,
          device: "cpu",
          dtype: "float32",
          environmentAuthority: {
            relativePath: "tinyrustlm/tools/qwen3_numerical_environment_lock.py",
            byteLength: 1,
            sha256: ZERO_SHA
          },
          environmentLock: {
            relativePath: "contracts/vnext/qwen3-numerical-oracle-environment-lock.v2.json",
            byteLength: 1,
            sha256: ZERO_SHA
          },
          interopThreads: 1,
          intraopThreads: 1,
          localFilesOnly: true,
          networkAllowed: false,
          numpyVersion: "2.2.5",
          psutilVersion: "7.2.2",
          pythonVersion: "3.12.10",
          safetensorsVersion: "0.5.3",
          tokenizersVersion: "0.21.1",
          torchVersion: "2.7.0",
          transformersVersion: "4.51.0"
        },
        policy: {
          maximumCases: 3,
          maximumResultBytes: 1048576,
          maximumSourceFileBytes: 1600000000,
          maximumTokensPerCase: 4,
          maximumTraceBytes: 14748160
        }
      },
      reconstructed: {
        schema: "tinyrustlm.qwen3_slm2_reconstructed_request.v1",
        compositionResultSha256: COMPOSITION_RESULT_SHA256,
        model: { fileName: "model.slm2", byteLength: MODEL_BYTE_LENGTH,
          sha256: MODEL_SHA256 },
        implementation: {
          blasThreads: 1,
          environmentAuthority: {
            relativePath: "tinyrustlm/tools/qwen3_numerical_environment_lock.py",
            byteLength: 1,
            sha256: ZERO_SHA
          },
          environmentLock: {
            relativePath: "contracts/vnext/qwen3-numerical-oracle-environment-lock.v2.json",
            byteLength: 1,
            sha256: ZERO_SHA
          },
          matrixChunkRows: 256,
          networkAllowed: false,
          numpyVersion: "2.2.5",
          pythonVersion: "3.12.10"
        },
        modelSpec: {
          contextLength: 40960,
          embeddingSize: 1024,
          feedForwardSize: 3072,
          headCount: 16,
          headDimension: 128,
          kvHeadCount: 8,
          kvWidth: 1024,
          layerCount: 28,
          logicalTensorCount: 310,
          normalizationEpsilon: 0.000001,
          qkNormalization: true,
          qkvBias: false,
          queryWidth: 2048,
          ropeTheta: 1000000,
          tiedEmbeddings: true,
          vocabularySize: 151936
        },
        policy: {
          maximumCases: 3,
          maximumModelBytes: MODEL_BYTE_LENGTH,
          maximumResultBytes: 1048576,
          maximumTokensPerCase: 4,
          maximumTraceBytes: 14748160
        }
      },
      scalar: {
        schema: "tinyrustlm.scalar-numerical-probe-request.v1",
        compositionResultSha256: COMPOSITION_RESULT_SHA256,
        model: { fileName: "model.slm2", byteLength: MODEL_BYTE_LENGTH,
          sha256: MODEL_SHA256 },
        policy: {
          maximumCases: 3,
          maximumKvBytes: 917504,
          maximumModelBytes: MODEL_BYTE_LENGTH,
          maximumScratchBytes: 673296,
          maximumSequenceTokens: 4,
          maximumTokensPerCase: 4,
          maximumTraceBytes: 14748160
        }
      },
      verification: {
        schema: "tinyrustlm.qwen3_numerical_trace_verification_request.v1",
        differentialProfile: {
          relativePath: "contracts/vnext/qwen3-numerical-differential-profile.v2.json",
          byteLength: 1,
          sha256: ZERO_SHA
        },
        comparison: registeredComparison(),
        policy: {
          maximumCases: 3,
          maximumManifestBytes: 4194304,
          maximumReceiptBytes: 4194304,
          maximumTokensPerCase: 4,
          maximumTraceBytes: 14748160
        },
      }
    },
    processPolicy: {
      maximumDurationMilliseconds: {
        source: 14400000,
        reconstructed: 14400000,
        scalar: 14400000,
        verifier: 3600000
      },
      maximumStdoutBytes: 1048576,
      maximumStderrBytes: 1048576,
      launchLimitPerStage: 1,
      retryAllowed: false,
      overwriteAllowed: false,
      repairAllowed: false,
      continueAfterFailedStage: false
    },
    privateNames: {
      ownerRequestFileBasename: `${operationId}-owner-request.json`,
      ownerEvidenceRootBasename: `${operationId}-owner-evidence`,
      sourceScratchRootBasename: `${operationId}-source-scratch`,
      sourceOutputRootBasename: `${operationId}-source`,
      reconstructedOutputRootBasename: `${operationId}-reconstructed`,
      scalarOutputRootBasename: `${operationId}-scalar`
    },
    evidenceFiles: {
      binding: "binding.json",
      start: "start.json",
      sourceRequest: "source.request.json",
      sourceStdout: "source.stdout.bin",
      sourceStderr: "source.stderr.bin",
      sourceTerminal: "source.process-terminal.json",
      reconstructedRequest: "reconstructed.request.json",
      reconstructedStdout: "reconstructed.stdout.bin",
      reconstructedStderr: "reconstructed.stderr.bin",
      reconstructedTerminal: "reconstructed.process-terminal.json",
      scalarRequest: "scalar.request.json",
      scalarStdout: "scalar.stdout.bin",
      scalarStderr: "scalar.stderr.bin",
      scalarTerminal: "scalar.process-terminal.json",
      verificationRequest: "verification.request.json",
      verifierStdout: "verifier.stdout.bin",
      verifierStderr: "verifier.stderr.bin",
      verifierTerminal: "verifier.process-terminal.json",
      ownerTerminal: "owner-terminal.json"
    },
    terminalPolicy: {
      successStatus: "terminal-pass",
      rejectionStatus: "terminal-rejected",
      failureStatus: "terminal-failure",
      ambiguousStatus: "terminal-ambiguous",
      secondInvocationAllowed: false,
      partialOutputCleanupAllowed: false,
      evidenceOverwriteAllowed: false,
      thresholdChangeAfterLaunchAllowed: false
    }
  };
}

/** In-memory registration fixture; zero hashes and invented gate counts are never material authority. */
function registration() {
  const contract = ownerContract();
  return {
    schema: owner.REGISTRATION_SCHEMA,
    profileId: "tinyrustlm.qwen3-numerical-differential-execution/4",
    status: "registered-before-private-request-roots-and-real-traces",
    registeredAtUtc: "2026-09-13T12:00:00Z",
    registrationParentCommit: "1".repeat(40),
    registrationParentTree: "2".repeat(40),
    authority: {
      automaticRetry: false,
      bestOfN: false,
      closedStructuralV12BytesMayBeModified: false,
      closedStructuralV12BytesMayBeReadForThisDiagnostic: true,
      compatibilityReader: false,
      fallbackRuntime: false,
      legacySupport: false,
      memoryEndpointsAuthorized: false,
      migrationWriter: false,
      productLifecycle: "prelaunch-single-unversioned-product",
      publicRegistrationContainsPrivatePaths: false,
      responseRepair: false,
      sourceFrameworkSemanticAuthority: true,
      technicalVersionIsProductGeneration: false,
      thresholdSearchAfterOutput: false
    },
    sourceAnchor: {
      branch: "codex/model-acquisition-v2",
      parentCommit: "1".repeat(40),
      parentTree: "2".repeat(40),
      allowedRegistrationCommitPaths: [
        "contracts/vnext/qwen3-numerical-differential-execution-preregistration.v4.json"
      ],
      cleanAtRegistration: true,
      trackingFetchHeadAndRemoteExactAtRegistration: true
    },
    reportLineage: {
      architecture: publicArtifact(
        "docs/architecture/2026-08-26-qwen3-numerical-successor-owner-clean-cut.md"),
      correctedSynthesis: publicArtifact(
        "docs/report-intake/2026-08-26/post-v10-native-browser-release/tinyrustlm-post-v10-native-browser-release-intake-synthesis-2026-08-26.md"),
      durableModelLoadMemory: publicArtifact(
        "wiki/runtime-mirust/reports/tinyrustlm-qwen3-model-load-correction-memory-2026-08-26.md"),
      durableNumericalMemory: publicArtifact(
        "wiki/runtime-mirust/reports/tinyrustlm-qwen3-numerical-differential-memory-2026-08-26.md"),
      manifest: publicArtifact(
        "docs/report-intake/2026-08-26/post-v10-native-browser-release/MANIFEST.md"),
      tddDelta: publicArtifact(
        "docs/report-intake/2026-08-26/post-v10-native-browser-release/tinyrustlm-post-v10-native-browser-release-intake-tdd-delta-2026-08-26.md")
    },
    implementationCheckpoint: {
      cleanRelease: {
        aggregateByteLength: 3995,
        aggregateSha256: ZERO_SHA,
        failed: 0,
        passed: 23,
        runId: ZERO_SHA,
        skipped: 0,
        total: 23,
        verifierReproduced: true
      },
      focusedGate: { failed: 0, passed: 21, skipped: 0, total: 21 },
      implementationCommit: "3".repeat(40),
      implementationTree: "4".repeat(40),
      memoryCheckpointCommit: "1".repeat(40),
      memoryCheckpointTree: "2".repeat(40),
      scalarBuild: {
        cargoVersion: "cargo 1.96.0 (30a34c682 2026-05-25)",
        crate: "tinyrustlm-numerical-probe",
        executable: { ...contract.executables.scalar },
        host: "x86_64-pc-windows-msvc",
        locked: true,
        offline: true,
        profile: "release",
        rustcVersion: "rustc 1.96.0 (ac68faa20 2026-05-25)",
        sourceCommit: "5".repeat(40),
        sourceTree: "6".repeat(40)
      },
      standardGate: {
        skipped: 0,
        failed: 0,
        passed: 1568,
        total: 1568
      },
      thresholdBasis: {
        chosenBeforeRealTraceOutput: true,
        futureOutputUsedToChooseOrLoosen: false,
        reconstructedToScalar:
          "same-converted-byte-runtime-contract-with-exact-embedding-and-tighter-aggregate-margins",
        sourceToReconstructed:
          "quantization-noninferiority-diagnostic-with-bounded-coordinate-and-tighter-directional-margins",
        thresholdFailureIsTerminal: true,
        thresholdsAreEngineeringAcceptanceMarginsNotObservedResults: true
      }
    },
    candidate: {
      compositionClaim: "structural-pass-only",
      compositionResult: {
        path: "contracts/vnext/qwen3-real-composition-execution-result.v12.json",
        byteLength: COMPOSITION_RESULT_BYTE_LENGTH,
        sha256: COMPOSITION_RESULT_SHA256
      },
      licenseSpdx: "Apache-2.0",
      modelId: "Qwen/Qwen3-0.6B",
      modelSlm2: { byteLength: MODEL_BYTE_LENGTH, sha256: MODEL_SHA256 },
      numericalClaim: "unproven",
      qualityClaim: "terminally-rejected-for-product-use",
      purpose: "runtime-diagnostic-only",
      revision: "c1899de289a04d12100db370d81485cdf75e47ca",
      sourceClosureRehashedBeforeRegistration: true,
      sourceLock: {
        path: "contracts/vnext/qwen3-0.6b-base-source-lock.v2.json",
        byteLength: SOURCE_LOCK_BYTE_LENGTH,
        sha256: SOURCE_LOCK_SHA256
      }
    },
    ownerContract: contract,
    outputBoundary: {
      allSixRegisteredFutureNamesObservedAbsent: true,
      evidenceParentObservedExistingDirectNonReparse: true,
      ownerEvidenceRootCreated: false,
      ownerRequestCreated: false,
      privatePathPublished: false,
      realProcessLaunched: false,
      realTraceBytesCreated: false,
      reconstructedOutputRootCreated: false,
      scalarOutputRootCreated: false,
      sourceOutputRootCreated: false,
      sourceScratchRootCreated: false
    },
    claimBoundary: {
      browserChatVerified: false,
      browserWasmVerified: false,
      campaignCreditAuthorized: false,
      compositionStructuralPassBound: true,
      modelQualityVerified: false,
      optimizedNativeVerified: false,
      p2pAvailabilityVerified: false,
      reconstructedToScalarVerified: false,
      registrationCommitMustBeRemoteExactBeforeMaterialization: true,
      siteDeploymentVerified: false,
      sourceToReconstructedVerified: false
    },
    campaignCounters: {
      authorizedLiveMemoryRounds: "0/25",
      currentOutsideNetworkLaneProofs: "0/40",
      deletionBackedBrowserRounds: "0/50",
      liveCatalogAnnouncements: "0/20",
      qualifiedModels: "0/20"
    }
  };
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

/** Own and verify cleanup of bounded data fixtures under canonical artifacts. */
function temporaryRoot(t) {
  const owned = createOwnedTemporaryDirectory({ temporaryParent:
    path.join(repositoryRoot, "artifacts/tests/numerical-execution-owner") });
  t.after(() => {
    removeOwnedTemporaryDirectory(owned);
    assert.equal(fs.existsSync(owned.rootPath), false);
  });
  return owned.rootPath;
}

test("canonical JSON is recursively sorted, UTF-8, and LF terminated", () => {
  const bytes = owner.canonicalJsonBytes({ z: 1, a: { y: 2, b: 3 } });
  assert.equal(bytes.toString("utf8"), [
    "{",
    '  "a": {',
    '    "b": 3,',
    '    "y": 2',
    "  },",
    '  "z": 1',
    "}",
    ""
  ].join("\n"));
});

test("accepts the one clean owner contract and registration shape", () => {
  assert.equal(owner.validateOwnerContract(ownerContract()).schema,
    owner.OWNER_CONTRACT_SCHEMA);
  assert.equal(owner.validateRegistration(registration()).schema,
    owner.REGISTRATION_SCHEMA);
});

test("rejects authority, claim, output, and campaign-counter drift", () => {
  const mutations = [
    ["authority", (value) => { value.authority.legacySupport = true; }],
    ["claim", (value) => { value.claimBoundary.browserWasmVerified = true; }],
    ["output", (value) => { value.outputBoundary.realProcessLaunched = true; }],
    ["counter", (value) => { value.campaignCounters.qualifiedModels = "20/20"; }]
  ];
  for (const [name, mutate] of mutations) {
    const value = registration();
    mutate(value);
    assert.throws(() => owner.validateRegistration(value),
      /numerical-execution-registration/u, name);
  }
});

test("rejects candidate identity and cross-member binding drift", () => {
  const mutations = [
    ["model", (value) => { value.candidate.modelId = "Other/model"; }],
    ["revision", (value) => { value.candidate.revision = "f".repeat(40); }],
    ["model bytes", (value) => { value.candidate.modelSlm2.sha256 = "f".repeat(64); }],
    ["composition", (value) => {
      value.candidate.compositionResult.sha256 = "f".repeat(64);
    }],
    ["source lock", (value) => { value.candidate.sourceLock.sha256 = "f".repeat(64); }]
  ];
  for (const [name, mutate] of mutations) {
    const value = registration();
    mutate(value);
    assert.throws(() => owner.validateRegistration(value),
      /numerical-execution-registration/u, name);
  }
});

test("rejects report-lineage and implementation-checkpoint drift", () => {
  const mutations = [
    ["lineage missing", (value) => { delete value.reportLineage.manifest; }],
    ["lineage path", (value) => {
      value.reportLineage.architecture.path = "docs/architecture/other.md";
    }],
    ["implementation commit", (value) => {
      value.implementationCheckpoint.implementationCommit = "not-a-commit";
    }],
    ["memory parent", (value) => {
      value.implementationCheckpoint.memoryCheckpointCommit = "f".repeat(40);
    }],
    ["gate failure", (value) => { value.implementationCheckpoint.cleanRelease.failed = 1; }],
    ["verifier", (value) => {
      value.implementationCheckpoint.cleanRelease.verifierReproduced = false;
    }],
    ["scalar", (value) => {
      value.implementationCheckpoint.scalarBuild.executable.sha256 = "f".repeat(64);
    }],
    ["threshold", (value) => {
      value.implementationCheckpoint.thresholdBasis.futureOutputUsedToChooseOrLoosen = true;
    }]
  ];
  for (const [name, mutate] of mutations) {
    const value = registration();
    mutate(value);
    assert.throws(() => owner.validateRegistration(value),
      /numerical-execution-registration/u, name);
  }
});

test("rejects noncanonical time and any registration path closure drift", () => {
  const invalidTimes = [
    "2026-08-26T12:00:00.000Z",
    "2026-08-26T12:00:00+00:00",
    "2026-02-30T12:00:00Z",
    "not-a-time"
  ];
  for (const registeredAtUtc of invalidTimes) {
    const value = registration();
    value.registeredAtUtc = registeredAtUtc;
    assert.throws(() => owner.validateRegistration(value),
      /numerical-execution-registration/u, registeredAtUtc);
  }

  const formerPath = registration();
  formerPath.sourceAnchor.allowedRegistrationCommitPaths[0] =
    "contracts/vnext/qwen3-numerical-differential-execution-preregistration.v1.json";
  assert.throws(() => owner.validateRegistration(formerPath),
    /numerical-execution-registration/u);

  const missingPath = registration();
  missingPath.sourceAnchor.allowedRegistrationCommitPaths.pop();
  assert.throws(() => owner.validateRegistration(missingPath),
    /numerical-execution-registration/u);
});

test("rejects nested request, case, process, and evidence-layout drift", () => {
  const mutations = [
    ["source policy", (value) => {
      value.ownerContract.requests.source.policy.maximumCases = 32;
    }],
    ["model spec", (value) => {
      value.ownerContract.requests.reconstructed.modelSpec.layerCount = 27;
    }],
    ["comparison", (value) => {
      value.ownerContract.requests.verification.comparison.topK = 1024;
    }],
    ["duration", (value) => {
      value.ownerContract.processPolicy.maximumDurationMilliseconds.source = 1;
    }],
    ["case", (value) => {
      value.ownerContract.cases[0].tokenIds = [4];
      value.ownerContract.cases[0].tokenIdsLeU32Sha256 = tokenDigest([4]);
    }],
    ["evidence", (value) => {
      value.ownerContract.evidenceFiles.binding = "other-binding.json";
    }]
  ];
  for (const [name, mutate] of mutations) {
    const value = registration();
    mutate(value);
    assert.throws(() => owner.validateRegistration(value),
      /numerical-execution/u, name);
  }
});

test("rejects operation, trace, implementation-role, and executable drift", () => {
  const mutations = [
    ["operation", (value) => {
      const operationId = "different-valid-operation";
      value.ownerContract.operationId = operationId;
      value.ownerContract.privateNames = {
        ownerRequestFileBasename: `${operationId}-owner-request.json`,
        ownerEvidenceRootBasename: `${operationId}-owner-evidence`,
        sourceScratchRootBasename: `${operationId}-source-scratch`,
        sourceOutputRootBasename: `${operationId}-source`,
        reconstructedOutputRootBasename: `${operationId}-reconstructed`,
        scalarOutputRootBasename: `${operationId}-scalar`
      };
    }],
    ["trace profile", (value) => {
      value.ownerContract.traceProfileId = "other.valid-profile/1";
    }],
    ["implementation path", (value) => {
      value.ownerContract.implementationArtifacts.find(
        (artifactValue) => artifactValue.role === "source-owner").relativePath =
          "tinyrustlm/tools/other-source.py";
    }],
    ["executable", (value) => {
      value.ownerContract.executables.scalar.basename = "other.exe";
      value.implementationCheckpoint.scalarBuild.executable.basename = "other.exe";
    }]
  ];
  for (const [name, mutate] of mutations) {
    const value = registration();
    mutate(value);
    assert.throws(() => owner.validateRegistration(value),
      /numerical-execution/u, name);
  }
});

test("rejects closed owner, registration, request, and source-template semantics", () => {
  assert.equal(owner.REGISTRATION_RELATIVE_PATH,
    "contracts/vnext/qwen3-numerical-differential-execution-preregistration.v4.json");
  assert.equal(owner.REQUEST_SCHEMA, "tinyrustlm.qwen3_numerical_execution_request.v4");

  const formerOwner = ownerContract();
  formerOwner.schema = "tinyrustlm.qwen3_numerical_execution_owner_contract.v1";
  assert.throws(() => owner.validateOwnerContract(formerOwner),
    /numerical-execution-owner-contract/u);

  const formerRegistration = registration();
  formerRegistration.schema =
    "tinyrustlm.qwen3_numerical_differential_execution_preregistration.v1";
  assert.throws(() => owner.validateRegistration(formerRegistration),
    /numerical-execution-registration-identity/u);

  const formerProfile = registration();
  formerProfile.profileId = "tinyrustlm.qwen3-numerical-differential-execution/1";
  assert.throws(() => owner.validateRegistration(formerProfile),
    /numerical-execution-registration-identity/u);

  const formerSource = ownerContract();
  formerSource.requests.source.schema = "tinyrustlm.qwen3_numerical_source_request.v1";
  assert.throws(() => owner.validateOwnerContract(formerSource),
    /numerical-execution-source-template/u);
});

test("requires the exact corrected source-framework closure", () => {
  const missingAccelerate = ownerContract();
  delete missingAccelerate.requests.source.framework.accelerateVersion;
  assert.throws(() => owner.validateOwnerContract(missingAccelerate),
    /numerical-execution-source-framework/u);

  const wrongPsutil = ownerContract();
  wrongPsutil.requests.source.framework.psutilVersion = "7.2.1";
  assert.throws(() => owner.validateOwnerContract(wrongPsutil),
    /numerical-execution-source-framework/u);

  const networkEnabled = ownerContract();
  networkEnabled.requests.source.framework.networkAllowed = true;
  assert.throws(() => owner.validateOwnerContract(networkEnabled),
    /numerical-execution-source-framework/u);
});

test("current contracts reject every closed schema and superseded lock path", async (t) => {
  const root = temporaryRoot(t);
  for (const version of [1, 2, 3]) {
    const contract = ownerContract();
    contract.schema = `tinyrustlm.qwen3_numerical_execution_owner_contract.v${version}`;
    assert.throws(() => owner.validateOwnerContract(contract), /owner-contract/u);
    const value = registration();
    value.schema = `tinyrustlm.qwen3_numerical_differential_execution_preregistration.v${version}`;
    assert.throws(() => owner.validateRegistration(value), /registration-identity/u);
    const requestPath = path.join(root, `closed-request-${version}.json`);
    fs.writeFileSync(requestPath, owner.canonicalJsonBytes({
      schema: `tinyrustlm.qwen3_numerical_execution_request.v${version}`,
      operationId: "closed-operation", registration: null, registrationSource: null,
      repositoryRoot, gitPath: null, evidenceParent: root, sourceDirectory: null,
      compositionRoot: null, executables: null
    }), { flag: "wx" });
    const before = fs.readdirSync(root);
    await assert.rejects(owner.execute(requestPath), /request-identity/u);
    assert.deepEqual(fs.readdirSync(root), before);
  }
  for (const role of ["source-lock", "environment-lock", "differential-profile"]) {
    const contract = ownerContract();
    const item = contract.implementationArtifacts.find((record) => record.role === role);
    item.relativePath = item.relativePath.replace(".v2.json", ".v1.json");
    assert.throws(() => owner.validateOwnerContract(contract), /implementation-artifact-path/u, role);
  }
  for (const role of ["canonical-scratch", "source-authority", "retired-storage-policy"]) {
    const contract = ownerContract();
    contract.implementationArtifacts = contract.implementationArtifacts.filter(
      (record) => record.role !== role);
    assert.throws(() => owner.validateOwnerContract(contract), /implementation-artifacts/u, role);
  }
});

test("registration binds operation date and source parent and preserves the product rejection", () => {
  const changedDate = registration();
  changedDate.registeredAtUtc = "2026-09-14T12:00:00Z";
  assert.throws(() => owner.validateRegistration(changedDate), /operation-binding/u);
  const changedParent = registration();
  changedParent.registrationParentCommit = "7".repeat(40);
  changedParent.sourceAnchor.parentCommit = changedParent.registrationParentCommit;
  changedParent.implementationCheckpoint.memoryCheckpointCommit = changedParent.registrationParentCommit;
  assert.throws(() => owner.validateRegistration(changedParent), /operation-binding/u);
  for (const [key, value] of [["qualityClaim", "unproven"], ["qualityClaim", "passed"],
    ["purpose", "product-default"], ["purpose", null]]) {
    const changed = registration();
    changed.candidate[key] = value;
    assert.throws(() => owner.validateRegistration(changed), /registration-candidate/u, key);
  }
  const skippedGate = registration();
  skippedGate.implementationCheckpoint.standardGate.skipped = 1;
  skippedGate.implementationCheckpoint.standardGate.total += 1;
  assert.throws(() => owner.validateRegistration(skippedGate), /standard-gate/u);
  const oldSkipAllowance = registration();
  oldSkipAllowance.implementationCheckpoint.standardGate.declaredInfrastructureOnlySkips = 2;
  assert.throws(() => owner.validateRegistration(oldSkipAllowance), /standard-gate/u);
});

test("rejects token digest drift, retries, duplicate private names, and unknown fields", () => {
  const digestDrift = ownerContract();
  digestDrift.cases[0].tokenIdsLeU32Sha256 = "f".repeat(64);
  assert.throws(() => owner.validateOwnerContract(digestDrift),
    /numerical-execution-case-digest/u);

  const retry = ownerContract();
  retry.processPolicy.retryAllowed = true;
  assert.throws(() => owner.validateOwnerContract(retry),
    /numerical-execution-process-policy/u);

  const duplicate = ownerContract();
  duplicate.privateNames.scalarOutputRootBasename =
    duplicate.privateNames.sourceOutputRootBasename;
  assert.throws(() => owner.validateOwnerContract(duplicate),
    /numerical-execution-private-name-duplicate/u);

  const unknown = ownerContract();
  unknown.compatibility = true;
  assert.throws(() => owner.validateOwnerContract(unknown),
    /numerical-execution-owner-contract/u);
});

test("rejects missing implementation roles and permissive terminal policy", () => {
  const missingRole = ownerContract();
  missingRole.implementationArtifacts.pop();
  assert.throws(() => owner.validateOwnerContract(missingRole),
    /numerical-execution-implementation-artifacts/u);

  const cleanup = ownerContract();
  cleanup.terminalPolicy.partialOutputCleanupAllowed = true;
  assert.throws(() => owner.validateOwnerContract(cleanup),
    /numerical-execution-terminal-policy/u);
});

test("derives all child requests from one registration without prompt or answer fields", () => {
  const contract = ownerContract();
  const state = {
    registration: { ownerContract: contract },
    registrationIdentity: { byteLength: 123, sha256: "a".repeat(64) },
    sourceDirectory: "E:\\source",
    compositionRoot: "E:\\composition",
    evidenceParent: "E:\\evidence"
  };
  const paths = {
    sourceScratchRoot: "E:\\evidence\\source-scratch",
    sourceOutputRoot: "E:\\evidence\\source",
    reconstructedOutputRoot: "E:\\evidence\\reconstructed",
    scalarOutputRoot: "E:\\evidence\\scalar"
  };
  const requests = owner.childRequests(state, paths);
  assert.deepEqual(requests.source.cases, [
    { id: "low-vocabulary-boundary", tokenIds: [0] },
    { id: "repeated-kv-position", tokenIds: [17, 17] },
    { id: "high-vocabulary-mixed-cache", tokenIds: [151935, 151645, 220, 151935] }
  ]);
  assert.equal(requests.source.registrationSha256, "a".repeat(64));
  assert.equal(requests.reconstructed.compositionRoot, "E:\\composition");
  assert.equal(requests.scalar.outputRoot, "E:\\evidence\\scalar");
  assert.equal(requests.verification.bundles.source.rootBasename, "source");
  const serialized = JSON.stringify(requests);
  assert.equal(/prompt|expected.?answer/iu.test(serialized), false);
});

test("captured process records a clean pass and does not overwrite streams", async (t) => {
  const root = temporaryRoot(t);
  const argumentsList = ["-e", 'process.stdout.write("pass\\n");'];
  const stdoutPath = path.join(root, "stdout.bin");
  const stderrPath = path.join(root, "stderr.bin");
  const outcome = await owner.runCapturedProcess(process.execPath, argumentsList, {
    stage: "source",
    workingDirectory: root,
    scratchRoot: root,
    stdoutPath,
    stderrPath,
    maximumStdoutBytes: 64,
    maximumStderrBytes: 64,
    maximumDurationMilliseconds: 5000,
    terminationPath: process.platform === "win32"
      ? path.join(process.env.SystemRoot, "System32", "taskkill.exe") : process.execPath
  });
  assert.equal(owner.processPassed(outcome), true);
  assert.equal(fs.readFileSync(stdoutPath, "utf8"), "pass\n");
  assert.equal(outcome.stdout.byteLength, 5);
  assert.equal(outcome.stderr.byteLength, 0);
  await assert.rejects(owner.runCapturedProcess(process.execPath, argumentsList, {
    stage: "source",
    workingDirectory: root,
    scratchRoot: root,
    stdoutPath,
    stderrPath: path.join(root, "stderr-2.bin"),
    maximumStdoutBytes: 64,
    maximumStderrBytes: 64,
    maximumDurationMilliseconds: 5000,
    terminationPath: process.execPath
  }), /EEXIST/u);
});

test("stderr, overflow, and timeout cannot be classified as process pass", async (t) => {
  const root = temporaryRoot(t);
  const taskkill = process.platform === "win32"
    ? path.join(process.env.SystemRoot, "System32", "taskkill.exe") : process.execPath;
  const cases = [
    { name: "stderr", source: 'process.stderr.write("warning\\n");\n', stdout: 64,
      timeout: 5000, field: "stderr" },
    { name: "overflow", source: 'process.stdout.write("x".repeat(1024));\n', stdout: 8,
      timeout: 5000, field: "killedForOverflow" },
    { name: "timeout", source: "setInterval(() => {}, 1000);\n", stdout: 64,
      timeout: 50, field: "timedOut" }
  ];
  for (const item of cases) {
    const outcome = await owner.runCapturedProcess(process.execPath, ["-e", item.source], {
      stage: "source",
      workingDirectory: root,
      scratchRoot: root,
      stdoutPath: path.join(root, `${item.name}.stdout.bin`),
      stderrPath: path.join(root, `${item.name}.stderr.bin`),
      maximumStdoutBytes: item.stdout,
      maximumStderrBytes: 64,
      maximumDurationMilliseconds: item.timeout,
      terminationPath: taskkill
    });
    assert.equal(owner.processPassed(outcome), false, item.name);
    if (item.field === "stderr") assert.ok(outcome.stderr.byteLength > 0);
    else assert.equal(outcome[item.field], true, item.name);
  }
});

test("operation locations require canonical source, artifacts, and disjoint D model roots", (t) => {
  const evidenceParent = temporaryRoot(t);
  const valid = { repositoryRoot, evidenceParent,
    sourceDirectory: "D:\\LLMs\\TinyRustLM\\source",
    compositionRoot: "D:\\LLMs\\TinyRustLM\\composition" };
  assert.doesNotThrow(() => owner.validateOperationLocations(valid));
  for (const [key, value] of [
    ["repositoryRoot", path.dirname(repositoryRoot)],
    ["evidenceParent", repositoryRoot],
    ["evidenceParent", path.join(repositoryRoot, "artifacts")],
    ["sourceDirectory", "E:\\TinyRustLM-vnext-private\\source"],
    ["compositionRoot", "X:\\LLMS\\composition"],
    ["sourceDirectory", "D:\\LLMs\\TinyRustLM-other\\source"],
    ["sourceDirectory", "D:\\LLMs\\TinyRustLM"],
    ["sourceDirectory", "D:\\LLMs\\TinyRustLM\\..\\source"],
    ["sourceDirectory", valid.compositionRoot],
    ["sourceDirectory", `${valid.compositionRoot}\\child`],
    ["compositionRoot", `${valid.sourceDirectory}\\child`],
    ["compositionRoot", null]
  ]) assert.throws(() => owner.validateOperationLocations({ ...valid, [key]: value }),
    /numerical-execution-|canonical project artifacts/u, `${key}: ${value}`);
});

test("child environment keeps only OS support and canonical scratch with fixed runtime settings", (t) => {
  const root = temporaryRoot(t);
  const parent = { SystemRoot: process.env.SystemRoot, PATH: "untrusted-path",
    NODE_OPTIONS: "--invalid-numerical-fixture-option", NODE_PATH: "untrusted-node-path",
    PYTHONHOME: "untrusted-python-home", PYTHONPATH: "untrusted-python-path",
    HF_TOKEN: "synthetic-token", TEMP: "untrusted-temp", OMP_NUM_THREADS: "42",
    NODE_V8_COVERAGE: "untrusted-coverage" };
  const before = { ...parent };
  const environment = owner.createChildEnvironment(root, parent);
  assert.deepEqual(parent, before);
  assert.equal(Object.isFrozen(environment), true);
  for (const key of ["NODE_OPTIONS", "NODE_PATH", "PYTHONHOME", "PYTHONPATH", "HF_TOKEN"]) {
    assert.equal(Object.hasOwn(environment, key), false, key);
  }
  for (const key of ["HOME", "USERPROFILE", "TEMP", "TMP", "TMPDIR", "HF_HOME",
    "HF_HUB_CACHE", "HF_DATASETS_CACHE", "TORCH_HOME", "APPDATA", "LOCALAPPDATA",
    "XDG_CACHE_HOME", "XDG_CONFIG_HOME", "TORCHINDUCTOR_CACHE_DIR", "NUMBA_CACHE_DIR",
    "TRITON_CACHE_DIR"]) {
    assert.equal(environment[key], root, key);
  }
  assert.equal(environment.OMP_NUM_THREADS, "1");
  assert.equal(environment.HF_HUB_OFFLINE, "1");
  assert.equal(environment.HF_HUB_DISABLE_IMPLICIT_TOKEN, "1");
  assert.equal(environment.TOKENIZERS_PARALLELISM, "false");
  assert.equal(environment.NODE_V8_COVERAGE, "");
  assert.throws(() => owner.createChildEnvironment(repositoryRoot, parent), /canonical/u);
  assert.throws(() => owner.createChildEnvironment(path.join(root, "absent"), parent),
    /numerical-execution-child-scratch/u);
  if (process.platform === "win32") {
    assert.equal(environment.PATH, path.join(process.env.SystemRoot, "System32"));
    assert.equal(owner.createChildEnvironment(root, { systemroot: process.env.SystemRoot })
      .SystemRoot, process.env.SystemRoot);
    assert.throws(() => owner.createChildEnvironment(root, {}), /system-root/u);
    assert.throws(() => owner.createChildEnvironment(root,
      { SystemRoot: process.env.SystemRoot, SYSTEMROOT: process.env.SystemRoot }), /ambiguous/u);
  }
});

test("invalid child locations reject before creating either capture or launching", async (t) => {
  const root = temporaryRoot(t);
  const options = { stage: "fixture", workingDirectory: repositoryRoot, scratchRoot: root,
    stdoutPath: path.join(root, "stdout.bin"), stderrPath: path.join(root, "stderr.bin"),
    maximumStdoutBytes: 64, maximumStderrBytes: 64, maximumDurationMilliseconds: 5000 };
  assert.doesNotThrow(() => owner.validateProcessLocations(options));
  for (const [key, value] of [
    ["workingDirectory", path.dirname(repositoryRoot)],
    ["scratchRoot", repositoryRoot],
    ["stdoutPath", path.join(repositoryRoot, "forbidden-output.bin")],
    ["stderrPath", path.join(repositoryRoot, "forbidden-error.bin")],
    ["stdoutPath", "relative-output.bin"]
  ]) {
    await assert.rejects(owner.runCapturedProcess(process.execPath,
      ["-e", 'throw new Error("must not launch");'], { ...options, [key]: value }),
    /canonical|numerical-execution-child-stream/u, key);
    assert.equal(fs.existsSync(options.stdoutPath), false);
    assert.equal(fs.existsSync(options.stderrPath), false);
  }
});

test("execute rejects a misplaced request before inspecting registration or creating outputs", async (t) => {
  const root = temporaryRoot(t);
  const requestPath = path.join(root, "request.json");
  fs.writeFileSync(requestPath, owner.canonicalJsonBytes({ schema: owner.REQUEST_SCHEMA,
    operationId: "qwen3-numerical-c1899de-1111111-20260913-v4", registration: null,
    registrationSource: null, repositoryRoot: path.dirname(repositoryRoot), gitPath: null,
    evidenceParent: root, sourceDirectory: "D:\\LLMs\\TinyRustLM\\source",
    compositionRoot: "D:\\LLMs\\TinyRustLM\\composition", executables: null }), { flag: "wx" });
  const before = fs.readdirSync(root);
  await assert.rejects(owner.execute(requestPath), /numerical-execution-repository-root/u);
  assert.deepEqual(fs.readdirSync(root), before);
});

test("real Node and isolated pinned Python children exclude injected parent settings", async (t) => {
  const root = temporaryRoot(t);
  const injected = { NODE_OPTIONS: "--invalid-numerical-fixture-option",
    NODE_PATH: "untrusted-node-path", PYTHONHOME: "untrusted-python-home",
    PYTHONPATH: "untrusted-python-path", NUMERICAL_PARENT_SENTINEL: "synthetic-only" };
  const previous = Object.fromEntries(Object.keys(injected).map((key) => [key, process.env[key]]));
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  Object.assign(process.env, injected);
  const pythonPath = path.join(repositoryRoot,
    "artifacts/external/qwen3-numerical-oracle/environment/Scripts/python.exe");
  assert.equal(fs.existsSync(pythonPath), true, "The canonical pinned interpreter is required");
  const probes = [
    { name: "node", executable: process.execPath, args: ["-e", `
      const assert = require("node:assert/strict");
      for (const key of ${JSON.stringify(Object.keys(injected))})
        assert.equal(process.env[key], undefined);
      assert.equal(process.env.NODE_V8_COVERAGE, "");
      assert.equal(process.env.TEMP, process.cwd());
      process.stdout.write("isolated\\n");`] },
    { name: "python", executable: pythonPath,
      args: [...owner.ISOLATED_PYTHON_ARGUMENTS, "-c", [
        "import os, sys",
        "assert sys.version_info[:3] == (3, 12, 10)",
        "assert sys.flags.isolated == sys.flags.ignore_environment == sys.flags.no_user_site == 1",
        "assert sys.flags.dont_write_bytecode == sys.flags.utf8_mode == 1",
        "assert sys.flags.safe_path and os.getcwd() not in sys.path",
        `assert not any(key in os.environ for key in ${JSON.stringify(Object.keys(injected))})`,
        "assert os.environ['TEMP'] == os.getcwd()",
        "assert os.environ.get('NODE_V8_COVERAGE', '') == ''",
        "print('isolated')"
      ].join("\n")] }
  ];
  for (const probe of probes) {
    const stdoutPath = path.join(root, `${probe.name}.stdout.bin`);
    const outcome = await owner.runCapturedProcess(probe.executable, probe.args, {
      stage: probe.name, workingDirectory: root, scratchRoot: root, stdoutPath,
      stderrPath: path.join(root, `${probe.name}.stderr.bin`), maximumStdoutBytes: 64,
      maximumStderrBytes: 1024, maximumDurationMilliseconds: 10000,
      terminationPath: path.join(process.env.SystemRoot, "System32", "taskkill.exe")
    });
    assert.equal(owner.processPassed(outcome), true, probe.name);
    assert.equal(fs.readFileSync(stdoutPath, "utf8").trim(), "isolated");
  }
});

test("process terminal binds one launch and immutable failure rules", () => {
  const executable = { byteLength: 10, sha256: "b".repeat(64) };
  const outcome = {
    processStarted: true,
    exitCode: 0,
    signal: null,
    timedOut: false,
    killedForOverflow: false,
    spawnCode: null,
    stdout: { byteLength: 1, sha256: ZERO_SHA, overflow: false },
    stderr: { byteLength: 0, sha256: ZERO_SHA, overflow: false }
  };
  const terminal = owner.createProcessTerminal("operation", "source", executable,
    executable, ["request.json"], outcome);
  assert.equal(terminal.launchOrdinal, 1);
  assert.equal(terminal.launchCountLimit, 1);
  assert.equal(terminal.executableUnchanged, true);
  assert.equal(terminal.retryAllowed, false);
  assert.equal(terminal.overwriteAllowed, false);
  assert.equal(terminal.repairAllowed, false);
});


/** Exercise both real Python serializers against the JavaScript wire format without a model. */
test("Python numerical metadata serializers agree with JavaScript on the registered epsilon", () => {
  const { spawnSync } = require("node:child_process");
  const python = process.env.TINYRUSTLM_QWEN3_NUMERICAL_ORACLE_PYTHON;
  assert.ok(python && fs.existsSync(python), "set the existing numerical oracle Python for interop coverage");
  const program = [
    "import importlib.util,json,pathlib,sys",
    "p=pathlib.Path(sys.argv[1]);spec=importlib.util.spec_from_file_location('numerical_owner_under_test',p)",
    "module=importlib.util.module_from_spec(spec);sys.modules[spec.name]=module;spec.loader.exec_module(module)",
    "value=json.load(sys.stdin);sys.stdout.buffer.write(module.canonical_json_bytes(value))"
  ].join("\n");
  const metadata = { schema: "test-only", modelSpec: { normalizationEpsilon: 0.000001,
    contextLength: 40960 }, text: 'literal 1e-06, "normalizationEpsilon": 1e-06',
    empty: {}, list: [0, true, null, "backslash\\and newline\n", { value: 0.000001 }] };
  const expected = owner.canonicalJsonBytes(metadata);
  for (const filename of ["qwen3-numerical-source-owner.py", "qwen3-slm2-reconstructed-owner.py"]) {
    const result = spawnSync(python, ["-I", "-B", "-c", program,
      path.join(repositoryRoot, "tinyrustlm/tools", filename)], {
      input: expected, windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024
    });
    assert.equal(result.status, 0, result.stderr?.toString());
    assert.deepEqual(JSON.parse(result.stdout), metadata, filename + " must preserve values");
    assert.deepEqual(result.stdout, expected, filename + " must preserve canonical wire bytes");
    for (const invalid of [{ value: 0.00001 }, { value: 1.0 }, { value: 9007199254740992 },
      { value: "non-ascii \u00e9" }]) {
      const input = invalid.value === 1 ? '{"value":NaN}' : JSON.stringify(invalid);
      const rejected = spawnSync(python, ["-I", "-B", "-c", program,
        path.join(repositoryRoot, "tinyrustlm/tools", filename)], {
        input, windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024
      });
      assert.notEqual(rejected.status, 0, filename + " must reject unregistered numeric/string shapes");
      assert.equal(rejected.stdout.length, 0);
    }
  }
});
