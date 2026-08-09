"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  campaignRunnerProfile,
  campaignRunnerProfileSha256,
  createVnextCampaignRunner,
  validateCampaignRunnerOperationBytes
} = require("../tools/vnext-campaign-runner.js");
const {
  collectParentReceiptIds,
  createVnextReceiptStore
} = require("../tools/vnext-receipt-store.js");
const {
  createVnextSubjectStore
} = require("../tools/vnext-subject-store.js");
const {
  createVnextCampaignArtifactStore
} = require("../tools/vnext-campaign-artifact-store.js");
const { validateVnextReceiptBytes } = require("../tools/vnext-receipt-identity.js");
const { parseStrictJson } = require("../tools/strict-json.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "campaign-runner-profile.v1.json");
const planPath = path.join(repositoryRoot, "contracts", "vnext",
  "campaign-plan-parity-fixture.v1.json");
const vectorsPath = path.join(repositoryRoot, "contracts", "vnext",
  "campaign-projection-rust-vectors.v1.json");
const wasmPath = path.join(repositoryRoot, "target", "wasm32-unknown-unknown", "release",
  "tinyrustlm_evidence_wasm.wasm");
const ownedPrefix = "tinyrustlm-vnext-campaign-runner-";
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

function expectedBytes(entry) {
  return Buffer.from(entry.resultBytesBase64, "base64");
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

function addSubjects(store, subjectIds) {
  for (const subjectId of subjectIds) {
    const bytes = subjects.get(subjectId);
    assert.ok(bytes, `missing subject ${subjectId}`);
    store.put(bytes);
  }
}

function seedCase(roots, entry) {
  const artifactStore = createVnextCampaignArtifactStore(roots.artifacts);
  artifactStore.putPlan(fs.readFileSync(planPath));
  const receiptStore = createVnextReceiptStore(roots.receipts);
  addReceipts(receiptStore, entry.receiptIds);
  const subjectStore = createVnextSubjectStore(roots.subjects);
  addSubjects(subjectStore, entry.subjectIds);
  assert.deepEqual(entry.receiptBytesBase64, []);
  assert.deepEqual(entry.subjectBytesBase64, []);
  return { artifactStore, receiptStore, subjectStore };
}

function runnerOptions(roots, overrides = {}) {
  const moduleBytes = buildWasm();
  return {
    campaignArtifactStoreRoot: roots.artifacts,
    expectedWasmModuleSha256: sha256(moduleBytes),
    receiptStoreRoot: roots.receipts,
    subjectStoreRoot: roots.subjects,
    wasmModuleBytes: moduleBytes,
    ...overrides
  };
}

function runInput(entry, label) {
  return {
    campaignPlanSha256: entry.expectedCampaignPlanSha256,
    expectedCampaignId: entry.expectedCampaignId,
    expectedEnvironment: entry.expectedEnvironment,
    expectedTerminalRegistryReceiptId: entry.expectedTerminalRegistryReceiptId,
    operationId: operationId(label),
    trustedRootRegistryReceiptId: entry.trustedRootRegistryReceiptId,
    verificationTimeUtc: entry.verificationTimeUtc
  };
}

function proxyIo(overrides) {
  return new Proxy(fs, {
    get(target, property) {
      if (Object.hasOwn(overrides, property)) return overrides[property];
      return Reflect.get(target, property, target);
    }
  });
}

function throwsCode(callback, code) {
  assert.throws(callback, (error) => error?.code === code, `expected ${code}`);
}

async function rejectsCode(callback, code) {
  await assert.rejects(callback, (error) => error?.code === code, `expected ${code}`);
}

test("freezes one no-compatibility Rust-backed campaign runner profile", () => {
  const bytes = fs.readFileSync(profilePath);
  const parsed = parseStrictJson(bytes);
  const source = fs.readFileSync(path.join(
    repositoryRoot,
    "tinyrustlm",
    "tools",
    "vnext-campaign-runner.js"
  ), "utf8");
  assert.equal(campaignRunnerProfileSha256, sha256(bytes));
  assert.equal(campaignRunnerProfileSha256,
    "77e75dd7a4f04e23421be740040ea52efe68c234f49377005d94c550b9c142e7");
  assert.equal(campaignRunnerProfile.profileId, "tinyrustlm.vnext.campaign-runner.v1");
  assert.equal(parsed.status, "frozen");
  assert.equal(parsed.selectionPolicy, "all-active-members-no-subset-selection");
  assert.equal(parsed.projectionAuthority, "sole-generated-rust-campaign-evidence-abi");
  assert.equal(parsed.operationRecord.receiptStatus, "not-a-receipt");
  assert.equal(parsed.layout.mutablePointerPolicy, "forbidden");
  assert.equal(parsed.operationLock.primitive, "append-only-generation-claims");
  assert.equal(parsed.operationLock.deletionPolicy, "never");
  assert.equal(parsed.snapshotProtocol.observations, 2);
  assert.equal(parsed.clockAccess, "caller-trusted-verification-time-only");
  assert.doesNotMatch(bytes.toString("utf8"),
    /fallback|migration|deprecated|alias|dual-reader|dual-writer/iu);
  assert.doesNotMatch(source, /projectVnextCampaign|\.resumeProjection\(|Date\.now/gu);
  assert.match(source, /instantiateCampaignEvidence\(wasmModuleBytes\)/u);
  const documentationPaths = [
    "contracts/vnext/README.md",
    "docs/architecture/adr/ADR-011-campaign-evidence-browser-boundary.md",
    "docs/architecture/vnext-campaign-evidence-wasm-boundary.md",
    "docs/architecture/vnext-contract-inventory.md",
    "docs/architecture/vnext-contract-threat-review.md",
    "tinyrustlm/README.md"
  ];
  for (const documentationPath of documentationPaths) {
    const documentation = fs.readFileSync(path.join(repositoryRoot, documentationPath), "utf8");
    assert.match(documentation, /vnext-campaign-runner\.md/u, documentationPath);
  }
  const runnerDocument = fs.readFileSync(path.join(
    repositoryRoot,
    "docs",
    "architecture",
    "vnext-campaign-runner.md"
  ), "utf8");
  assert.match(runnerDocument, /tinyrustlm\.vnext\.campaign-runner\.v1/u);
  assert.match(runnerDocument,
    /77e75dd7a4f04e23421be740040ea52efe68c234f49377005d94c550b9c142e7/u);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(repositoryRoot, "tinyrustlm", "package.json"),
      "utf8")).scripts["test:vnext-campaign-runner"],
    "node --test tests/vnext-campaign-runner.test.js"
  );
});

test("rejects hostile options, overlapping roots, and module substitution", async (t) => {
  const roots = makeRoots(t);
  const honestZero = acceptedCase("honest-zero");
  seedCase(roots, honestZero);
  let getterInvoked = false;
  const options = runnerOptions(roots);
  Object.defineProperty(options, "io", {
    enumerable: true,
    get() {
      getterInvoked = true;
      return fs;
    }
  });
  await rejectsCode(() => createVnextCampaignRunner(roots.runner, options),
    "campaign_runner_option_accessor");
  assert.equal(getterInvoked, false);

  await rejectsCode(() => createVnextCampaignRunner(roots.runner, runnerOptions(roots, {
    subjectStoreRoot: roots.receipts
  })), "campaign_runner_store_roots_overlap");
  await rejectsCode(() => createVnextCampaignRunner(roots.runner, runnerOptions(roots, {
    expectedWasmModuleSha256: "0".repeat(64)
  })), "campaign_runner_wasm_identity_mismatch");
});

test("projects honest zero from every active store member and persists immutable history", {
  timeout: 120_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("honest-zero");
  seedCase(roots, entry);
  const runner = await createVnextCampaignRunner(roots.runner, runnerOptions(roots));
  const input = runInput(entry, "honest-zero-run");
  const result = await runner.runProjection(input);

  assert.deepEqual(Buffer.from(result.projectionResultBytes), expectedBytes(entry));
  assert.match(result.startedRecordId, /^sha256:[a-f0-9]{64}$/u);
  assert.match(result.terminalRecordId, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(result.projectionResultSha256, sha256(expectedBytes(entry)));
  assert.equal(result.receiptSnapshot.memberCount, 0);
  assert.equal(result.subjectSnapshot.memberCount, 0);
  assert.equal(result.persistence.projectionDisposition, "created");

  const history = runner.inspectOperation(input.operationId);
  assert.equal(history.state, "completed");
  assert.equal(history.startedRecordId, result.startedRecordId);
  assert.equal(history.terminalRecordId, result.terminalRecordId);
  assert.equal(history.projectionResultSha256, result.projectionResultSha256);
  const rebuilt = runner.rebuildOperationHistory();
  assert.equal(rebuilt.activeRecordIds.length, 2);
  await rejectsCode(() => runner.runProjection(input),
    "campaign_runner_operation_already_terminal");
});

test("reprojects trusted time and withdraws an expired outside proof on restart", {
  timeout: 120_000
}, async (t) => {
  const roots = makeRoots(t);
  const current = acceptedCase("one-current-outside-proof");
  const expired = acceptedCase("one-expired-outside-proof");
  seedCase(roots, current);
  const first = await createVnextCampaignRunner(roots.runner, runnerOptions(roots));
  const currentResult = await first.runProjection(runInput(current, "outside-current"));
  assert.deepEqual(Buffer.from(currentResult.projectionResultBytes), expectedBytes(current));

  const restarted = await createVnextCampaignRunner(roots.runner, runnerOptions(roots));
  const expiredResult = await restarted.runProjection(runInput(expired, "outside-expired"));
  assert.deepEqual(Buffer.from(expiredResult.projectionResultBytes), expectedBytes(expired));
  const currentWire = JSON.parse(currentResult.projectionResultBytes.toString("utf8"));
  const expiredWire = JSON.parse(expiredResult.projectionResultBytes.toString("utf8"));
  assert.equal(currentWire.counts.outsideProvenLanes.current, 1);
  assert.equal(expiredWire.counts.outsideProvenLanes.current, 0);
});

test("preserves Rust no-double-counting and supersession verdicts", {
  timeout: 120_000
}, async (t) => {
  for (const name of ["duplicate-objective-signatures", "superseded-pass-current-failure"]) {
    const roots = makeRoots(t);
    const entry = acceptedCase(name);
    seedCase(roots, entry);
    const runner = await createVnextCampaignRunner(roots.runner, runnerOptions(roots));
    const result = await runner.runProjection(runInput(entry, `${name}-run`));
    assert.deepEqual(Buffer.from(result.projectionResultBytes), expectedBytes(entry), name);
  }
});

test("projects the complete 20/50/25/40/20 synthetic capacity closure exactly once", {
  timeout: 180_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("complete-capacity");
  seedCase(roots, entry);
  const runner = await createVnextCampaignRunner(roots.runner, runnerOptions(roots));
  const result = await runner.runProjection(runInput(entry, "complete-capacity-run"));
  assert.deepEqual(Buffer.from(result.projectionResultBytes), expectedBytes(entry));
  assert.equal(result.receiptSnapshot.memberCount, 271);
  assert.equal(result.subjectSnapshot.memberCount, 40);
  const projection = JSON.parse(result.projectionResultBytes.toString("utf8"));
  assert.deepEqual(projection.counts, {
    announcedModels: { current: 20, target: 20 },
    cleanBrowserRounds: { current: 50, target: 50 },
    liveMemoryRounds: { current: 25, target: 25 },
    outsideProvenLanes: { current: 40, target: 40 },
    qualifiedModels: { current: 20, target: 20 }
  });
  assert.equal(projection.complete, true);
});

test("rejects a cross-store change between its two exact observations", {
  timeout: 120_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("one-current-outside-proof");
  const seeded = seedCase(roots, entry);
  const spare = vectors.subjects.find((candidate) => !entry.subjectIds.includes(candidate.subjectId));
  assert.ok(spare);
  let armed = false;
  let injected = false;
  const descriptors = new Map();
  const io = proxyIo({
    openSync(filePath, flags, mode) {
      const descriptor = fs.openSync(filePath, flags, mode);
      descriptors.set(descriptor, path.resolve(filePath));
      return descriptor;
    },
    closeSync(descriptor) {
      descriptors.delete(descriptor);
      return fs.closeSync(descriptor);
    },
    readSync(descriptor, buffer, offset, length, position) {
      const count = fs.readSync(descriptor, buffer, offset, length, position);
      const filePath = descriptors.get(descriptor) || "";
      if (armed && !injected && count > 0 && filePath.startsWith(roots.subjects) &&
          filePath.endsWith(".json")) {
        injected = true;
        seeded.subjectStore.put(Buffer.from(spare.bytesBase64, "base64"));
      }
      return count;
    }
  });
  const runner = await createVnextCampaignRunner(roots.runner, runnerOptions(roots, { io }));
  armed = true;
  await rejectsCode(() => runner.runProjection(runInput(entry, "snapshot-race")),
    "campaign_runner_snapshot_changed");
  assert.equal(injected, true);
  assert.deepEqual(runner.rebuildOperationHistory().activeRecordIds, []);
});

test("records bounded Rust failures without repairing or retrying them", {
  timeout: 120_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("honest-zero");
  seedCase(roots, entry);
  const runner = await createVnextCampaignRunner(roots.runner, runnerOptions(roots));
  const input = runInput(entry, "wrong-campaign-pin");
  input.expectedCampaignId = `${input.expectedCampaignId}-wrong`;
  await rejectsCode(() => runner.runProjection(input), "campaign_plan_projection_mismatch");
  const history = runner.inspectOperation(input.operationId);
  assert.equal(history.state, "failed");
  assert.equal(history.errorCode, "campaign_plan_projection_mismatch");
  assert.equal(history.errorStep, "campaign-projection");
  assert.equal(history.projectionResultSha256, null);
});

test("survives process death after start publication and resumes by fresh reprojection", {
  timeout: 180_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("honest-zero");
  seedCase(roots, entry);
  const input = runInput(entry, "interrupted-operation");
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
    "-e", script, runnerModule, JSON.stringify(roots), JSON.stringify(input), wasmPath,
    sha256(buildWasm())
  ], { cwd: repositoryRoot, encoding: "utf8", timeout: 120_000, windowsHide: true });
  assert.equal(child.status, 77, `${child.stdout}\n${child.stderr}`);
  assert.deepEqual(
    fs.readdirSync(path.join(roots.runner, "locks", "claims")).sort(),
    ["0000000000000000.json"]
  );
  assert.deepEqual(fs.readdirSync(path.join(roots.runner, "locks", "releases")).sort(), []);

  const restarted = await createVnextCampaignRunner(roots.runner, runnerOptions(roots));
  assert.ok(restarted.startup.newQuarantines.some(
    (entry) => entry.reasonCode === "incomplete_temporary"
  ));
  assert.equal(restarted.inspectOperation(input.operationId).state, "interrupted");
  const result = await restarted.runProjection(input);
  assert.deepEqual(Buffer.from(result.projectionResultBytes), expectedBytes(entry));
  assert.equal(restarted.inspectOperation(input.operationId).state, "completed");
  assert.deepEqual(
    fs.readdirSync(path.join(roots.runner, "locks", "claims")).sort(),
    ["0000000000000000.json", "0000000000000001.json"]
  );
  assert.deepEqual(
    fs.readdirSync(path.join(roots.runner, "locks", "releases")).sort(),
    ["0000000000000001.json"]
  );
});

test("excludes a genuinely concurrent process operation", {
  timeout: 180_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("honest-zero");
  seedCase(roots, entry);
  const parentRunner = await createVnextCampaignRunner(roots.runner, runnerOptions(roots));
  const signal = path.join(roots.parent, "child-lock-held.signal");
  const childInput = runInput(entry, "concurrent-child");
  const script = String.raw`
    const fs = require("node:fs");
    const { createVnextCampaignRunner } = require(process.argv[1]);
    const roots = JSON.parse(process.argv[2]);
    const input = JSON.parse(process.argv[3]);
    const wasm = fs.readFileSync(process.argv[4]);
    const expected = process.argv[5];
    const signal = process.argv[6];
    let armed = false;
    let held = false;
    const io = new Proxy(fs, { get(target, property) {
      if (property === "opendirSync") return (directory, options) => {
        if (armed && !held && String(directory).startsWith(roots.artifacts)) {
          held = true;
          fs.writeFileSync(signal, "held", { flag: "wx" });
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500);
        }
        return fs.opendirSync(directory, options);
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
    })().then(() => process.exit(0)).catch((error) => {
      process.stderr.write(String(error && error.code || error));
      process.exit(3);
    });
  `;
  const runnerModule = path.join(repositoryRoot, "tinyrustlm", "tools",
    "vnext-campaign-runner.js");
  const child = childProcess.spawn(process.execPath, [
    "-e", script, runnerModule, JSON.stringify(roots), JSON.stringify(childInput), wasmPath,
    sha256(buildWasm()), signal
  ], { cwd: repositoryRoot, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const deadline = Date.now() + 30_000;
  while (!fs.existsSync(signal) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(fs.existsSync(signal), true, "child did not acquire runner lock");
  await rejectsCode(() => parentRunner.runProjection(runInput(entry, "concurrent-parent")),
    "campaign_runner_busy");
  const exitCode = await new Promise((resolve) => child.once("exit", resolve));
  assert.equal(exitCode, 0, stderr);
});

test("elects one successor when two processes recover the same dead lock generation", {
  timeout: 180_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("honest-zero");
  seedCase(roots, entry);
  const runnerModule = path.join(repositoryRoot, "tinyrustlm", "tools",
    "vnext-campaign-runner.js");
  const wasmSha256 = sha256(buildWasm());
  const staleScript = String.raw`
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
        if (armed && String(destination).includes("locks") &&
            String(destination).includes("claims") &&
            String(destination).endsWith(".json")) process.exit(81);
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
  const stale = childProcess.spawnSync(process.execPath, [
    "-e", staleScript, runnerModule, JSON.stringify(roots),
    JSON.stringify(runInput(entry, "stale-lock-owner")), wasmPath, wasmSha256
  ], { cwd: repositoryRoot, encoding: "utf8", timeout: 120_000, windowsHide: true });
  assert.equal(stale.status, 81, `${stale.stdout}\n${stale.stderr}`);

  const barrier = path.join(roots.parent, "lock-race-start.signal");
  const winner = path.join(roots.parent, "lock-race-winner.signal");
  const raceScript = String.raw`
    const fs = require("node:fs");
    const path = require("node:path");
    const { createVnextCampaignRunner } = require(process.argv[1]);
    const roots = JSON.parse(process.argv[2]);
    const input = JSON.parse(process.argv[3]);
    const wasm = fs.readFileSync(process.argv[4]);
    const expected = process.argv[5];
    const ready = process.argv[6];
    const barrier = process.argv[7];
    const winner = process.argv[8];
    const contender = process.argv[9];
    let armed = false;
    let held = false;
    const io = new Proxy(fs, { get(target, property) {
      if (property === "opendirSync") return (directory, options) => {
        if (armed && !held && path.resolve(directory).startsWith(path.resolve(roots.artifacts))) {
          held = true;
          fs.writeFileSync(winner, contender, { flag: "wx" });
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500);
        }
        return fs.opendirSync(directory, options);
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
      fs.writeFileSync(ready, "ready", { flag: "wx" });
      while (!fs.existsSync(barrier)) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
      }
      armed = true;
      await runner.runProjection(input);
    })().then(() => process.exit(0)).catch((error) => {
      if (error && error.code === "campaign_runner_busy") process.exit(9);
      process.stderr.write(String(error && error.code || error));
      process.exit(3);
    });
  `;
  const children = ["a", "b"].map((contender) => {
    const ready = path.join(roots.parent, `lock-race-${contender}.ready`);
    const child = childProcess.spawn(process.execPath, [
      "-e", raceScript, runnerModule, JSON.stringify(roots),
      JSON.stringify(runInput(entry, `lock-race-${contender}`)), wasmPath, wasmSha256,
      ready, barrier, winner, contender
    ], { cwd: repositoryRoot, stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    return { child, contender, ready, stderr: () => stderr };
  });
  const readyDeadline = Date.now() + 30_000;
  while ((!fs.existsSync(children[0].ready) || !fs.existsSync(children[1].ready)) &&
      Date.now() < readyDeadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(fs.existsSync(children[0].ready) && fs.existsSync(children[1].ready), true,
    "both lock contenders must reach the start barrier");
  fs.writeFileSync(barrier, "start", { flag: "wx" });
  const exits = await Promise.all(children.map(({ child }) =>
    new Promise((resolve) => child.once("exit", resolve))));
  assert.deepEqual(exits.slice().sort((left, right) => left - right), [0, 9],
    children.map(({ contender, stderr }) => `${contender}:${stderr()}`).join("\n"));
  assert.match(fs.readFileSync(winner, "utf8"), /^[ab]$/u);
  assert.deepEqual(
    fs.readdirSync(path.join(roots.runner, "locks", "claims")).sort(),
    ["0000000000000000.json", "0000000000000001.json"]
  );
  assert.deepEqual(
    fs.readdirSync(path.join(roots.runner, "locks", "releases")).sort(),
    ["0000000000000001.json"]
  );
});

test("turns disk-full start persistence into a bounded failure with no false terminal", {
  timeout: 120_000
}, async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("honest-zero");
  seedCase(roots, entry);
  let armed = false;
  const descriptors = new Map();
  const io = proxyIo({
    openSync(filePath, flags, mode) {
      const descriptor = fs.openSync(filePath, flags, mode);
      descriptors.set(descriptor, path.resolve(filePath));
      return descriptor;
    },
    closeSync(descriptor) {
      descriptors.delete(descriptor);
      return fs.closeSync(descriptor);
    },
    writeSync(descriptor, buffer, offset, length, position) {
      const filePath = descriptors.get(descriptor) || "";
      if (armed && filePath.startsWith(path.join(roots.runner, "operations"))) {
        const error = new Error("simulated disk full");
        error.code = "ENOSPC";
        throw error;
      }
      return fs.writeSync(descriptor, buffer, offset, length, position);
    }
  });
  const runner = await createVnextCampaignRunner(roots.runner, runnerOptions(roots, { io }));
  armed = true;
  await rejectsCode(() => runner.runProjection(runInput(entry, "disk-full")),
    "campaign_runner_operation_temporary_write_failed");
  assert.deepEqual(runner.rebuildOperationHistory().activeRecordIds, []);
});

test("validates operation records as exact canonical identity-bound wires", async (t) => {
  const roots = makeRoots(t);
  const entry = acceptedCase("honest-zero");
  seedCase(roots, entry);
  const runner = await createVnextCampaignRunner(roots.runner, runnerOptions(roots));
  const result = await runner.runProjection(runInput(entry, "record-validation"));
  const start = runner.readOperationRecord(result.startedRecordId);
  assert.equal(validateCampaignRunnerOperationBytes(start.bytes).record.recordId,
    result.startedRecordId);
  const drifted = Buffer.from(`${start.bytes.toString("utf8")}\n`, "utf8");
  throwsCode(() => validateCampaignRunnerOperationBytes(drifted),
    "campaign_runner_operation_noncanonical");
});
