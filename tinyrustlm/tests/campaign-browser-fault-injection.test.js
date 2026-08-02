"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { chromium } = require("playwright");
const { CampaignEvidenceStore } = require("../tools/campaign-evidence-store.js");
const {
  attemptReceiptType,
  attemptSatisfiesFault,
  browserFaultIds,
  runBrowserFaults
} = require("../tools/campaign-fault-injection.js");

const expectedBrowserFaultIds = Object.freeze([
  "browser-crash",
  "cancellation",
  "generation-timeout",
  "locked-browser-profile",
  "profile-deletion-failure",
  "wasm-allocation-failure"
]);

function setup(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-browser-fault-test-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return {
    root,
    options: {
      campaignId: "browser-fault-test-20260715",
      chromiumPath: chromium.executablePath(),
      evidenceRoot: path.join(root, "evidence"),
      planPath: path.resolve(__dirname, "../campaign-fault-plan.v1.json"),
      profileParent: path.join(root, "profiles"),
      reportOutputPath: path.join(root, "reports", "fault-report.json"),
      sourceRevision: "b".repeat(40)
    }
  };
}

test("declares exactly the six browser fault executors", () => {
  assert.deepEqual([...browserFaultIds].sort(), [...expectedBrowserFaultIds].sort());
});

test("executes six real Chromium faults with owned-profile cleanup and domain evidence", {
  skip: !fs.existsSync(chromium.executablePath())
}, (context) => {
  const { options } = setup(context);
  const result = runBrowserFaults(options);
  assert.equal(result.attempts.length, 6);
  assert.deepEqual(result.attempts.map((receipt) =>
    receipt.publicSafeParameters.faultId).sort(), [...expectedBrowserFaultIds].sort());
  for (const receipt of result.attempts) {
    const faultId = receipt.publicSafeParameters.faultId;
    assert.equal(receipt.receiptType, attemptReceiptType, faultId);
    assert.equal(receipt.status, "pass", faultId);
    assert.equal(receipt.evidenceClass, "browser", faultId);
    for (const tool of [
      "tinyrustlm-browser-fault-scenarios",
      "tinyrustlm-owned-browser-profile",
      "tinyrustlm-browser-fault-dependency-lock",
      "playwright"
    ]) {
      assert.equal(receipt.toolNames.includes(tool), true, `${faultId}: ${tool}`);
    }
    assert.equal(receipt.hardwareEvidence.actualChromiumProcess, true, faultId);
    assert.equal(receipt.hardwareEvidence.ownedPersistentProfile, true, faultId);
    assert.equal(receipt.hardwareEvidence.profileDeletionProven, true, faultId);
  }

  const receipts = new CampaignEvidenceStore(options.evidenceRoot).listReceipts();
  const receiptById = new Map(receipts.map((receipt) => [receipt.receiptId, receipt]));
  for (const attempt of result.attempts) {
    const fault = result.plan.faultsById.get(attempt.publicSafeParameters.faultId);
    const domain = receiptById.get(attempt.publicSafeParameters.domainReceiptId);
    assert.ok(domain);
    assert.equal(domain.receiptType, fault.expectedDomainReceiptType);
    assert.equal(domain.status, fault.expectedStatus);
    assert.equal(domain.evidenceClass, "browser");
    assert.equal(domain.blockerCode, null);
    assert.equal(attemptSatisfiesFault(attempt, fault, result.plan,
      receiptById, result.planReceipt), true);
  }

  assert.equal(result.report.executedFaultCount, 6);
  assert.equal(result.report.satisfiedFaultCount, 6);
  assert.equal(result.report.incompleteFaultCount, 18);
  assert.deepEqual(fs.readdirSync(options.profileParent), []);
});

test("browser runner rejects a missing executable before writing evidence", (context) => {
  const { root, options } = setup(context);
  assert.throws(() => runBrowserFaults({
    ...options,
    chromiumPath: path.join(root, "missing-chromium.exe")
  }), /chromium executable/i);
  assert.equal(fs.existsSync(options.evidenceRoot), false);
});
