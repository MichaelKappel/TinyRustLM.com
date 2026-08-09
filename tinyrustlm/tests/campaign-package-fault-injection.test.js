"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { CampaignEvidenceStore } = require("../tools/campaign-evidence-store.js");
const {
  attemptReceiptType,
  attemptSatisfiesFault,
  packageFaultIds,
  runPackageFaults
} = require("../tools/campaign-fault-injection.js");

const campaignId = "package-fault-test-20260715";
const sourceRevision = "c".repeat(40);
const workspaceRoot = path.resolve(__dirname, "../..");
const packageSource = path.join(workspaceRoot, "artifacts", "packages");
const modelFixturePath = path.join(workspaceRoot, "tinyrustlm", "models",
  "tiny-test-model.slm");
const compositionFixturePath = path.join(workspaceRoot, "tinyrustlm", "models",
  "tiny-test-model.base.acg1");

function findDotnet() {
  const command = process.platform === "win32" ? "where.exe" : "which";
  const result = childProcess.spawnSync(command, ["dotnet"], {
    encoding: "utf8",
    windowsHide: true
  });
  if (result.status !== 0) return null;
  const first = result.stdout.split(/\r?\n/u).map((line) => line.trim()).find(Boolean);
  return first && fs.existsSync(first) ? path.resolve(first) : null;
}

const dotnetPath = findDotnet();
const packageFiles = fs.existsSync(packageSource)
  ? fs.readdirSync(packageSource).filter((name) => name.endsWith(".nupkg"))
  : [];
const packageInputsAvailable = Boolean(dotnetPath &&
  ["TinyRustLM.Abstractions", "TinyRustLM.Core", "TinyRustLM.Memory", "TinyRustLM.P2P"]
    .every((packageId) => packageFiles.some((name) => name.startsWith(`${packageId}.`))) &&
  fs.existsSync(modelFixturePath) && fs.existsSync(compositionFixturePath));

function setup(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-package-fault-test-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return {
    root,
    options: {
      campaignId,
      compositionFixturePath,
      dotnetPath,
      evidenceRoot: path.join(root, "evidence"),
      modelFixturePath,
      packageSource,
      reportOutputPath: path.join(root, "reports", "fault-report.json"),
      sourceRevision,
      workParent: path.join(root, "work")
    }
  };
}

test("declares exactly the package restore drift executor", () => {
  assert.deepEqual(packageFaultIds, ["package-restore-drift"]);
});

test("detects package drift and recovers through an isolated locked consumer", {
  skip: !packageInputsAvailable,
  timeout: 120_000
}, (context) => {
  const { options } = setup(context);
  const result = runPackageFaults(options);
  assert.equal(result.attempts.length, 1);
  const attempt = result.attempts[0];
  assert.equal(attempt.receiptType, attemptReceiptType);
  assert.equal(attempt.status, "pass");
  assert.equal(attempt.evidenceClass, "package");
  assert.equal(attempt.publicSafeParameters.faultId, "package-restore-drift");
  assert.equal(attempt.toolNames.includes("tinyrustlm-package-fault-scenarios"), true);
  assert.equal(attempt.hardwareEvidence.isolatedNuGetCache, true);
  assert.equal(attempt.hardwareEvidence.lockedModeRestore, true);
  assert.equal(attempt.hardwareEvidence.packageContentHashDriftObserved, true);
  assert.equal(attempt.hardwareEvidence.consumerExecutionPassed, true);
  assert.equal(attempt.hardwareEvidence.compositionIdentityVerified, true);
  assert.equal(attempt.hardwareEvidence.ownedWorkRootDeleted, true);
  assert.equal(attempt.hardwareEvidence.packageHashesVerified, true);
  assert.equal(attempt.hardwareEvidence.dotnetExecutableHashVerified, true);

  const receipts = new CampaignEvidenceStore(options.evidenceRoot).listReceipts();
  const receiptById = new Map(receipts.map((receipt) => [receipt.receiptId, receipt]));
  const fault = result.plan.faultsById.get("package-restore-drift");
  const domain = receiptById.get(attempt.publicSafeParameters.domainReceiptId);
  assert.ok(domain);
  assert.equal(domain.receiptType, "tinyrustlm.package-verification-v1");
  assert.equal(domain.status, "blocked");
  assert.equal(domain.blockerCode, null);
  assert.equal(attemptSatisfiesFault(attempt, fault, result.plan,
    receiptById, result.planReceipt), true);
  assert.equal(result.report.satisfiedFaultCount, 1);
  assert.equal(result.report.incompleteFaultCount, 23);
  assert.deepEqual(fs.readdirSync(options.workParent), []);
});

test("rejects a missing package source before creating campaign evidence", (context) => {
  const { root, options } = setup(context);
  assert.throws(() => runPackageFaults({
    ...options,
    packageSource: path.join(root, "missing-packages")
  }), /package source/i);
  assert.equal(fs.existsSync(options.evidenceRoot), false);
});
