"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  campaignReleaseSurfaceProfile,
  campaignReleaseSurfaceProfileSha256,
  createVnextCampaignReleaseSurface
} = require("../tools/vnext-campaign-release-surface.js");
const {
  createVnextCampaignRunner
} = require("../tools/vnext-campaign-runner.js");
const {
  createVnextCampaignArtifactStore
} = require("../tools/vnext-campaign-artifact-store.js");
const {
  collectParentReceiptIds,
  createVnextReceiptStore
} = require("../tools/vnext-receipt-store.js");
const {
  createVnextSubjectStore
} = require("../tools/vnext-subject-store.js");
const {
  validateVnextReceiptBytes
} = require("../tools/vnext-receipt-identity.js");
const { parseStrictJson } = require("../tools/strict-json.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "campaign-release-surface-profile.v1.json");
const planPath = path.join(repositoryRoot, "contracts", "vnext",
  "campaign-plan-parity-fixture.v1.json");
const vectorsPath = path.join(repositoryRoot, "contracts", "vnext",
  "campaign-projection-rust-vectors.v1.json");
const wasmPath = path.join(repositoryRoot, "target", "wasm32-unknown-unknown", "release",
  "tinyrustlm_evidence_wasm.wasm");
const ownedPrefix = "tinyrustlm-vnext-release-surface-";
const sourceRevision = `git-sha1:${"b".repeat(40)}`;
const vectors = JSON.parse(fs.readFileSync(vectorsPath, "utf8"));
const receipts = new Map(vectors.receipts.map((entry) => [
  entry.receiptId,
  Buffer.from(entry.bytesBase64, "base64")
]));
const subjects = new Map(vectors.subjects.map((entry) => [
  entry.subjectId,
  Buffer.from(entry.bytesBase64, "base64")
]));
let wasmBytes;

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function operationId(label) {
  return `sha256:${sha256(Buffer.from(label, "utf8"))}`;
}

function buildWasm() {
  if (wasmBytes) return wasmBytes;
  const cargo = process.env.CARGO || (process.platform === "win32" && process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, ".cargo", "bin", "cargo.exe")
    : "cargo");
  const result = childProcess.spawnSync(cargo, [
    "build", "-p", "tinyrustlm-evidence-wasm", "--release",
    "--target", "wasm32-unknown-unknown", "--locked", "--offline"
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
    windowsHide: true
  });
  assert.equal(result.error, undefined, `WASM build spawn failed: ${result.error?.code}`);
  assert.equal(result.status, 0, `WASM build failed:\n${result.stdout}\n${result.stderr}`);
  wasmBytes = fs.readFileSync(wasmPath);
  return wasmBytes;
}

function makeRoots(t) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), ownedPrefix));
  const roots = Object.freeze({
    parent,
    artifacts: path.join(parent, "artifacts"),
    receipts: path.join(parent, "receipts"),
    runner: path.join(parent, "runner"),
    subjects: path.join(parent, "subjects")
  });
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  return roots;
}

function acceptedCase(name) {
  const entry = vectors.acceptedCases.find((candidate) => candidate.name === name);
  assert.ok(entry, `missing accepted case ${name}`);
  return entry;
}

function addReceipts(store, receiptIds) {
  const requested = new Set(receiptIds);
  const complete = new Set();
  function add(receiptId) {
    if (complete.has(receiptId)) return;
    const bytes = receipts.get(receiptId);
    assert.ok(bytes, `missing receipt ${receiptId}`);
    const validated = validateVnextReceiptBytes(bytes);
    for (const parent of collectParentReceiptIds(validated.receipt)) {
      assert.ok(requested.has(parent), `case omits receipt parent ${parent}`);
      add(parent);
    }
    store.put(bytes);
    complete.add(receiptId);
  }
  for (const receiptId of receiptIds) add(receiptId);
}

function seedCase(roots, entry) {
  const artifactStore = createVnextCampaignArtifactStore(roots.artifacts);
  artifactStore.putPlan(fs.readFileSync(planPath));
  const receiptStore = createVnextReceiptStore(roots.receipts);
  addReceipts(receiptStore, entry.receiptIds);
  const subjectStore = createVnextSubjectStore(roots.subjects);
  for (const subjectId of entry.subjectIds) {
    const bytes = subjects.get(subjectId);
    assert.ok(bytes, `missing subject ${subjectId}`);
    subjectStore.put(bytes);
  }
}

function runnerOptions(roots) {
  const wasm = buildWasm();
  return {
    campaignArtifactStoreRoot: roots.artifacts,
    expectedWasmModuleSha256: sha256(wasm),
    receiptStoreRoot: roots.receipts,
    subjectStoreRoot: roots.subjects,
    wasmModuleBytes: wasm
  };
}

function surfaceInput(entry, label, overrides = {}) {
  return {
    campaignPlanSha256: entry.expectedCampaignPlanSha256,
    expectedCampaignId: entry.expectedCampaignId,
    expectedEnvironment: entry.expectedEnvironment,
    expectedTerminalRegistryReceiptId: entry.expectedTerminalRegistryReceiptId,
    knownSecrets: [],
    operationId: operationId(label),
    sourceRevision,
    trustedRootRegistryReceiptId: entry.trustedRootRegistryReceiptId,
    verificationTimeUtc: entry.verificationTimeUtc,
    ...overrides
  };
}

async function rejectsCode(callback, code) {
  await assert.rejects(callback, (error) => error?.code === code, `expected ${code}`);
}

test("freezes one no-compatibility campaign release surface profile", () => {
  const bytes = fs.readFileSync(profilePath);
  const profile = parseStrictJson(bytes);
  assert.equal(campaignReleaseSurfaceProfileSha256, sha256(bytes));
  assert.equal(campaignReleaseSurfaceProfileSha256,
    "53a31b50560ee12c122dc00bc396893788380dc4ddc200ecabf194ed69264541");
  assert.equal(campaignReleaseSurfaceProfile.profileId,
    "tinyrustlm.vnext.campaign-release-surface.v1");
  assert.equal(profile.status, "frozen");
  assert.equal(profile.storedProjectionPolicy, "forbidden");
  assert.equal(profile.callerVerdictPolicy, "forbidden");
  assert.equal(profile.callerCounterPolicy, "forbidden");
  assert.equal(profile.mutablePointerPolicy, "forbidden");
  assert.equal(profile.networkAccess, "forbidden");
  assert.equal(profile.operatorStatus.doneState,
    "forbidden-before-authorized-release-and-public-readback");
  assert.doesNotMatch(bytes.toString("utf8"),
    /fallback|migration|deprecated|alias|dual-reader|dual-writer/iu);
});

test("attests an honest zero projection without claiming release completion", {
  timeout: 180_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("honest-zero");
  seedCase(roots, entry);
  const surface = await createVnextCampaignReleaseSurface(roots.runner,
    runnerOptions(roots));
  const input = surfaceInput(entry, "honest-zero-attestation");
  const result = await surface.attestCampaign(input);

  assert.equal(result.campaignComplete, false);
  assert.equal(result.releaseEligible, false);
  assert.match(result.attestationReceiptId, /^sha256:[a-f0-9]{64}$/u);
  assert.match(result.redactionReceiptId, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(result.operatorStatus.state, "campaign-incomplete");
  assert.equal(result.operatorStatus.releaseEligible, false);
  assert.deepEqual(result.operatorStatus.counts, {
    announcedModels: { current: 0, target: 20 },
    cleanBrowserRounds: { current: 0, target: 50 },
    liveMemoryRounds: { current: 0, target: 25 },
    outsideProvenLanes: { current: 0, target: 40 },
    qualifiedModels: { current: 0, target: 20 }
  });
  assert.doesNotMatch(result.operatorStatusBytes.toString("utf8"), /\bdone\b/iu);

  const store = createVnextReceiptStore(roots.receipts);
  const attestation = store.read(result.attestationReceiptId).receipt;
  const redaction = store.read(result.redactionReceiptId).receipt;
  assert.equal(attestation.receiptType, "final-attestation");
  assert.equal(attestation.status, "blocked");
  assert.equal(attestation.blockerCode, "campaign-objectives-incomplete");
  assert.deepEqual(attestation.inputReceiptIds, []);
  assert.equal(redaction.receiptType, "redaction-scan");
  assert.equal(redaction.status, "pass");
  assert.equal(redaction.inputHashes.some((binding) =>
    binding.name === "target-canonical-content" &&
      binding.sha256 === attestation.canonicalContentSha256), true);

  await rejectsCode(() => surface.attestCampaign(input),
    "release_surface_operation_not_fresh");
});

test("attests exact complete capacity while remaining prepublication", {
  timeout: 180_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("complete-capacity");
  seedCase(roots, entry);
  const surface = await createVnextCampaignReleaseSurface(roots.runner,
    runnerOptions(roots));
  const result = await surface.attestCampaign(surfaceInput(entry, "complete-attestation"));

  assert.equal(result.campaignComplete, true);
  assert.equal(result.releaseEligible, true);
  assert.equal(result.operatorStatus.state, "campaign-complete-awaiting-release-inputs");
  assert.deepEqual(result.operatorStatus.blockerCodes, []);
  assert.deepEqual(result.operatorStatus.counts, {
    announcedModels: { current: 20, target: 20 },
    cleanBrowserRounds: { current: 50, target: 50 },
    liveMemoryRounds: { current: 25, target: 25 },
    outsideProvenLanes: { current: 40, target: 40 },
    qualifiedModels: { current: 20, target: 20 }
  });
  const store = createVnextReceiptStore(roots.receipts);
  const attestation = store.read(result.attestationReceiptId).receipt;
  assert.equal(attestation.status, "pass");
  assert.equal(attestation.blockerCode, null);
  assert.equal(attestation.inputReceiptIds.length, 271);
  assert.deepEqual(attestation.supersedesReceiptIds, []);
  assert.equal(attestation.inputHashes.find((entryValue) =>
    entryValue.name === "campaign-projection-result").sha256,
  result.projectionResultSha256);
});

test("rejects stored projection, caller verdict, counter drift, and accessors", {
  timeout: 180_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("honest-zero");
  seedCase(roots, entry);
  const surface = await createVnextCampaignReleaseSurface(roots.runner,
    runnerOptions(roots));
  const base = surfaceInput(entry, "forbidden-caller-truth");
  for (const injected of [
    { projectionResultBytes: Buffer.from("{}", "utf8") },
    { complete: true },
    { counts: { qualifiedModels: { current: 20, target: 20 } } },
    { dashboard: { done: true } }
  ]) {
    await rejectsCode(() => surface.attestCampaign({ ...base, ...injected }),
      "release_surface_input_invalid");
  }
  let invoked = false;
  const hostile = { ...base };
  Object.defineProperty(hostile, "knownSecrets", {
    enumerable: true,
    get() {
      invoked = true;
      return [];
    }
  });
  await rejectsCode(() => surface.attestCampaign(hostile),
    "release_surface_input_invalid_accessor");
  assert.equal(invoked, false);
  assert.deepEqual(createVnextReceiptStore(roots.receipts).rebuild().activeReceiptIds, []);
});

test("rejects campaign, environment, and authority pin mismatches", {
  timeout: 180_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("honest-zero");
  seedCase(roots, entry);
  const surface = await createVnextCampaignReleaseSurface(roots.runner,
    runnerOptions(roots));
  const cases = [
    ["campaign", { expectedCampaignId: "campaign-vnext-wrong" },
      "campaign_plan_projection_mismatch"],
    ["environment", { expectedEnvironment: "preview" },
      "campaign_projection_input_invalid"],
    ["authority", {
      expectedTerminalRegistryReceiptId: `sha256:${"0".repeat(64)}`,
      trustedRootRegistryReceiptId: `sha256:${"0".repeat(64)}`
    }, "authority_registry_count_invalid"]
  ];
  for (const [label, overrides, expectedCode] of cases) {
    await rejectsCode(() => surface.attestCampaign(surfaceInput(
      entry,
      `mismatch-${label}`,
      overrides
    )), expectedCode);
  }
});

test("rejects failed and interrupted operation histories instead of resuming them", {
  timeout: 240_000
}, async (t) => {
  const failedRoots = makeRoots(t);
  const entry = acceptedCase("honest-zero");
  seedCase(failedRoots, entry);
  const failedInput = surfaceInput(entry, "failed-before-release", {
    expectedCampaignId: "campaign-vnext-wrong"
  });
  const failedRunner = await createVnextCampaignRunner(failedRoots.runner,
    runnerOptions(failedRoots));
  await rejectsCode(() => failedRunner.runProjection({
    campaignPlanSha256: failedInput.campaignPlanSha256,
    expectedCampaignId: failedInput.expectedCampaignId,
    expectedEnvironment: failedInput.expectedEnvironment,
    expectedTerminalRegistryReceiptId: failedInput.expectedTerminalRegistryReceiptId,
    operationId: failedInput.operationId,
    trustedRootRegistryReceiptId: failedInput.trustedRootRegistryReceiptId,
    verificationTimeUtc: failedInput.verificationTimeUtc
  }), "campaign_plan_projection_mismatch");
  const failedSurface = await createVnextCampaignReleaseSurface(failedRoots.runner,
    runnerOptions(failedRoots));
  await rejectsCode(() => failedSurface.attestCampaign(failedInput),
    "release_surface_operation_not_fresh");

  const interruptedRoots = makeRoots(t);
  seedCase(interruptedRoots, entry);
  const interruptedInput = surfaceInput(entry, "interrupted-before-release");
  const script = String.raw`
    const fs = require("node:fs");
    const { createVnextCampaignRunner } = require(process.argv[1]);
    const roots = JSON.parse(process.argv[2]);
    const input = JSON.parse(process.argv[3]);
    const wasm = fs.readFileSync(process.argv[4]);
    const expected = process.argv[5];
    let armed = false;
    const io = new Proxy(fs, { get(target, property) {
      if (property === "linkSync") return (source, destination) => {
        const value = fs.linkSync(source, destination);
        if (armed && String(destination).includes("operations") &&
            String(destination).endsWith(".json")) process.exit(77);
        return value;
      };
      return Reflect.get(target, property, target);
    }});
    (async () => {
      const runner = await createVnextCampaignRunner(roots.runner, {
        campaignArtifactStoreRoot: roots.artifacts,
        expectedWasmModuleSha256: expected,
        io,
        receiptStoreRoot: roots.receipts,
        subjectStoreRoot: roots.subjects,
        wasmModuleBytes: wasm
      });
      armed = true;
      await runner.runProjection(input);
      process.exit(2);
    })().catch(() => process.exit(3));
  `;
  const runnerModule = path.join(repositoryRoot, "tinyrustlm", "tools",
    "vnext-campaign-runner.js");
  const child = childProcess.spawnSync(process.execPath, [
    "-e", script,
    runnerModule,
    JSON.stringify(interruptedRoots),
    JSON.stringify({
      campaignPlanSha256: interruptedInput.campaignPlanSha256,
      expectedCampaignId: interruptedInput.expectedCampaignId,
      expectedEnvironment: interruptedInput.expectedEnvironment,
      expectedTerminalRegistryReceiptId:
        interruptedInput.expectedTerminalRegistryReceiptId,
      operationId: interruptedInput.operationId,
      trustedRootRegistryReceiptId: interruptedInput.trustedRootRegistryReceiptId,
      verificationTimeUtc: interruptedInput.verificationTimeUtc
    }),
    wasmPath,
    sha256(buildWasm())
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    timeout: 120_000,
    windowsHide: true
  });
  assert.equal(child.status, 77, `${child.stdout}\n${child.stderr}`);
  const interruptedSurface = await createVnextCampaignReleaseSurface(
    interruptedRoots.runner,
    runnerOptions(interruptedRoots)
  );
  await rejectsCode(() => interruptedSurface.attestCampaign(interruptedInput),
    "release_surface_operation_not_fresh");
});

test("records only a public-safe redaction failure when an attestation contains a known secret", {
  timeout: 180_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("complete-capacity");
  seedCase(roots, entry);
  const secret = entry.receiptIds[0].slice("sha256:".length, "sha256:".length + 20);
  const surface = await createVnextCampaignReleaseSurface(roots.runner,
    runnerOptions(roots));
  const result = await surface.attestCampaign(surfaceInput(entry, "secret-attestation", {
    knownSecrets: [secret]
  }));

  assert.equal(result.campaignComplete, true);
  assert.equal(result.releaseEligible, false);
  assert.equal(result.attestationReceiptId, null);
  assert.equal(result.attestationReceiptBytes, null);
  assert.equal(result.operatorStatus.state, "release-evidence-redaction-blocked");
  assert.deepEqual(result.operatorStatus.blockerCodes,
    ["public-evidence-secret-scan-failed"]);
  const store = createVnextReceiptStore(roots.receipts);
  const rebuilt = store.rebuild();
  assert.equal(rebuilt.activeReceiptIds.length, entry.receiptIds.length + 1);
  const redaction = store.read(result.redactionReceiptId).receipt;
  assert.equal(redaction.status, "fail");
  assert.equal(redaction.blockerCode, "public-evidence-secret-scan-failed");
  assert.doesNotMatch(result.redactionReceiptBytes.toString("utf8"), new RegExp(secret, "u"));
});
