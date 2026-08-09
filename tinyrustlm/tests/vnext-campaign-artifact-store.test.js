"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  campaignArtifactRelativePath,
  campaignArtifactStoreProfile,
  campaignArtifactStoreProfileSha256,
  createVnextCampaignArtifactStore
} = require("../tools/vnext-campaign-artifact-store.js");
const {
  projectVnextCampaign,
  validateCampaignPlanBytes
} = require("../tools/vnext-campaign-projection.js");
const { parseStrictJson } = require("../tools/strict-json.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "campaign-artifact-store-profile.v1.json");
const planFixturePath = path.join(repositoryRoot, "contracts", "vnext",
  "campaign-plan-parity-fixture.v1.json");
const ownedPrefix = "tinyrustlm-vnext-campaign-artifact-store-";

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function makeRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), ownedPrefix));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function planValue() {
  return validateCampaignPlanBytes(fs.readFileSync(planFixturePath));
}

function projectionInput(plan = planValue(), verificationTimeUtc = "2026-08-09T00:30:00Z") {
  return {
    campaignPlanBytes: plan.bytes,
    expectedCampaignPlanSha256: plan.planSha256,
    expectedCampaignId: plan.plan.campaignId,
    expectedEnvironment: plan.plan.environment,
    trustedRootRegistryReceiptId: null,
    expectedTerminalRegistryReceiptId: null,
    verificationTimeUtc,
    receiptBytes: [],
    subjectBytes: []
  };
}

function emptyProjection(plan = planValue()) {
  return projectVnextCampaign(projectionInput(plan));
}

function physicalPath(root, kind, digest) {
  return path.join(root, ...campaignArtifactRelativePath(kind, digest).split("/"));
}

function throwsCode(callback, code) {
  assert.throws(callback, (error) => error?.code === code, `expected ${code}`);
}

function proxyIo(overrides) {
  return new Proxy(fs, {
    get(target, property) {
      if (Object.hasOwn(overrides, property)) return overrides[property];
      return Reflect.get(target, property, target);
    }
  });
}

function trackedIo(hooks = {}) {
  const descriptors = new Map();
  return proxyIo({
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
      hooks.beforeWrite?.(descriptors.get(descriptor), buffer, offset, length, position);
      return fs.writeSync(descriptor, buffer, offset, length, position);
    },
    readSync(descriptor, buffer, offset, length, position) {
      const count = fs.readSync(descriptor, buffer, offset, length, position);
      hooks.afterRead?.(descriptors.get(descriptor), buffer, offset, count, position);
      return count;
    },
    fsyncSync(descriptor) {
      hooks.beforeFsync?.(descriptors.get(descriptor));
      return fs.fsyncSync(descriptor);
    },
    linkSync(source, destination) {
      hooks.beforeLink?.(source, destination);
      return fs.linkSync(source, destination);
    }
  });
}

test("freezes one incompatible create-only campaign artifact store profile", () => {
  const profileBytes = fs.readFileSync(profilePath);
  const profile = parseStrictJson(profileBytes);

  assert.equal(campaignArtifactStoreProfileSha256, sha256(profileBytes));
  assert.equal(campaignArtifactStoreProfile.profileId,
    "tinyrustlm.vnext.campaign-artifact-store.v1");
  assert.equal(profile.status, "frozen");
  assert.equal(profile.layout.mutablePointerPolicy, "forbidden");
  assert.equal(profile.atomicCreate.publishPrimitive, "hard-link-create-if-absent");
  assert.equal(profile.resume.selectionPolicy,
    "caller-supplied-inputs-reprojected-no-mutable-pointer");
  assert.deepEqual(profile.acceptedArtifacts.map((entry) => entry.kind),
    ["plan", "projection-result"]);
  assert.doesNotMatch(profileBytes.toString("utf8"),
    /legacy|fallback|migration|alias|dual-reader|dual-writer/iu);
});

test("rejects accessor-bearing store options without executing them", (t) => {
  const root = makeRoot(t);
  let getterInvoked = false;
  const options = {};
  Object.defineProperty(options, "io", {
    enumerable: true,
    get() {
      getterInvoked = true;
      return fs;
    }
  });

  throwsCode(() => createVnextCampaignArtifactStore(root, options),
    "campaign_artifact_store_option_accessor");
  assert.equal(getterInvoked, false);
});

test("creates, reads, and idempotently reuses exact plan and projection bytes", (t) => {
  const root = makeRoot(t);
  const store = createVnextCampaignArtifactStore(root);
  const plan = planValue();
  const projection = emptyProjection(plan);

  const planWrite = store.putPlan(plan.bytes);
  assert.equal(planWrite.disposition, "created");
  assert.equal(planWrite.artifactSha256, plan.planSha256);
  assert.deepEqual(store.readPlan(plan.planSha256).bytes, plan.bytes);
  assert.equal(store.putPlan(plan.bytes).disposition, "existing-byte-identical");

  const resultWrite = store.putProjection(projection.resultBytes);
  assert.equal(resultWrite.disposition, "created");
  assert.equal(resultWrite.artifactSha256, projection.resultSha256);
  assert.deepEqual(store.readProjection(projection.resultSha256).resultBytes,
    projection.resultBytes);
  assert.equal(store.putProjection(projection.resultBytes).disposition,
    "existing-byte-identical");
});

test("requires an active exact parent plan before accepting a projection", (t) => {
  const root = makeRoot(t);
  const store = createVnextCampaignArtifactStore(root);
  const projection = emptyProjection();

  throwsCode(() => store.putProjection(projection.resultBytes),
    "campaign_artifact_parent_plan_missing");
  assert.equal(fs.existsSync(physicalPath(root, "projection-result",
    projection.resultSha256)), false);
});

test("restarts by reprojecting caller-supplied evidence without a mutable pointer", (t) => {
  const root = makeRoot(t);
  const plan = planValue();
  const first = createVnextCampaignArtifactStore(root);
  first.putPlan(plan.bytes);
  const initial = first.resumeProjection(projectionInput(plan));
  assert.equal(initial.persistence.disposition, "created");

  const laterInput = projectionInput(plan, "2026-08-09T00:31:00Z");
  const restarted = createVnextCampaignArtifactStore(root);
  const later = restarted.resumeProjection(laterInput);
  assert.equal(later.persistence.disposition, "created");
  assert.notEqual(later.projection.resultSha256, initial.projection.resultSha256);
  const replay = restarted.resumeProjection(laterInput);
  assert.equal(replay.persistence.disposition, "existing-byte-identical");
  assert.deepEqual(replay.projection.resultBytes, later.projection.resultBytes);
  assert.deepEqual([...restarted.rebuild().activeProjectionSha256s].sort(),
    [initial.projection.resultSha256, later.projection.resultSha256].sort());
  assert.equal(fs.existsSync(path.join(root, "latest")), false);
  assert.equal(fs.existsSync(path.join(root, "current")), false);
});

test("withdraws tampered plans and their dependent projections on rebuild", (t) => {
  const root = makeRoot(t);
  const plan = planValue();
  const projection = emptyProjection(plan);
  const first = createVnextCampaignArtifactStore(root);
  first.putPlan(plan.bytes);
  first.putProjection(projection.resultBytes);

  const planPath = physicalPath(root, "plan", plan.planSha256);
  const tampered = Buffer.from(plan.bytes);
  tampered[tampered.length - 2] ^= 1;
  fs.writeFileSync(planPath, tampered);

  const restarted = createVnextCampaignArtifactStore(root);
  assert.deepEqual(restarted.startup.activePlanSha256s, []);
  assert.deepEqual(restarted.startup.activeProjectionSha256s, []);
  assert.deepEqual(restarted.startup.newQuarantines.map((entry) => entry.reasonCode).sort(),
    ["invalid_plan", "missing_plan"].sort());
  throwsCode(() => restarted.readPlan(plan.planSha256), "campaign_artifact_not_active");
  throwsCode(() => restarted.readProjection(projection.resultSha256),
    "campaign_artifact_not_active");
});

test("quarantines old incomplete temporaries and leaves fresh ones pending", (t) => {
  const root = makeRoot(t);
  const plan = planValue();
  const target = physicalPath(root, "plan", plan.planSha256);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = path.join(path.dirname(target),
    `.${plan.planSha256}.${process.pid}.abcd.tmp`);
  fs.writeFileSync(temporary, Buffer.from("partial"));

  const first = createVnextCampaignArtifactStore(root);
  assert.equal(first.startup.pendingTemporaryCount, 1);
  assert.equal(fs.existsSync(temporary), true);

  const old = new Date(Date.now() - 600000);
  fs.utimesSync(temporary, old, old);
  const rebuilt = first.rebuild();
  assert.equal(rebuilt.pendingTemporaryCount, 0);
  assert.deepEqual(rebuilt.newQuarantines.map((entry) => entry.reasonCode),
    ["incomplete_temporary"]);
  assert.equal(fs.existsSync(temporary), false);
});

test("turns disk-full plan writes into bounded errors and removes partial temporaries", (t) => {
  const root = makeRoot(t);
  const io = trackedIo({
    beforeWrite(filePath) {
      if (filePath?.endsWith(".tmp")) {
        const error = new Error(`private disk detail ${root}`);
        error.code = "ENOSPC";
        throw error;
      }
    }
  });
  const store = createVnextCampaignArtifactStore(root, { io });
  const plan = planValue();

  let caught;
  try {
    store.putPlan(plan.bytes);
  } catch (error) {
    caught = error;
  }
  assert.equal(caught?.code, "campaign_artifact_temporary_write_failed");
  assert.equal(caught?.causeCode, "enospc");
  assert.equal(fs.existsSync(physicalPath(root, "plan", plan.planSha256)), false);
  const prefix = path.dirname(physicalPath(root, "plan", plan.planSha256));
  assert.equal(fs.readdirSync(prefix).some((name) => name.endsWith(".tmp")), false);
});

test("recovers a published plan after directory synchronization fails", (t) => {
  const root = makeRoot(t);
  const plan = planValue();
  const target = physicalPath(root, "plan", plan.planSha256);
  const prefix = path.dirname(target);
  let injected = false;
  const io = trackedIo({
    beforeFsync(filePath) {
      if (!injected && filePath === prefix) {
        injected = true;
        const error = new Error(`private directory detail ${root}`);
        error.code = "EIO";
        throw error;
      }
    }
  });
  const store = createVnextCampaignArtifactStore(root, { io });

  throwsCode(() => store.putPlan(plan.bytes), "campaign_artifact_directory_sync_failed");
  assert.deepEqual(fs.readFileSync(target), plan.bytes);
  const restarted = createVnextCampaignArtifactStore(root);
  assert.deepEqual(restarted.startup.activePlanSha256s, [plan.planSha256]);
  assert.equal(restarted.putPlan(plan.bytes).disposition, "existing-byte-identical");
});

test("removes a newly published projection when its plan changes after preflight", (t) => {
  const root = makeRoot(t);
  const plan = planValue();
  const projection = emptyProjection(plan);
  const planPath = physicalPath(root, "plan", plan.planSha256);
  const projectionPath = physicalPath(root, "projection-result", projection.resultSha256);
  let injected = false;
  const io = trackedIo({
    beforeLink(_source, destination) {
      if (!injected && destination === projectionPath) {
        injected = true;
        const tampered = Buffer.from(plan.bytes);
        tampered[tampered.length - 2] ^= 1;
        fs.writeFileSync(planPath, tampered);
      }
    }
  });
  const store = createVnextCampaignArtifactStore(root, { io });
  store.putPlan(plan.bytes);

  throwsCode(() => store.putProjection(projection.resultBytes),
    "campaign_artifact_parent_plan_invalid");
  assert.equal(fs.existsSync(projectionPath), false);
  const rebuilt = store.rebuild();
  assert.deepEqual(rebuilt.activePlanSha256s, []);
  assert.deepEqual(rebuilt.activeProjectionSha256s, []);
});

test("fails a false readback without corrupting the published plan", (t) => {
  const root = makeRoot(t);
  const plan = planValue();
  const target = physicalPath(root, "plan", plan.planSha256);
  let injected = false;
  const io = trackedIo({
    afterRead(filePath, buffer, offset, count) {
      if (!injected && filePath === target && count > 0) {
        injected = true;
        buffer[offset] ^= 0xff;
      }
    }
  });
  const store = createVnextCampaignArtifactStore(root, { io });

  throwsCode(() => store.putPlan(plan.bytes), "campaign_artifact_readback_mismatch");
  assert.deepEqual(fs.readFileSync(target), plan.bytes);
  const restarted = createVnextCampaignArtifactStore(root);
  assert.deepEqual(restarted.readPlan(plan.planSha256).bytes, plan.bytes);
});
