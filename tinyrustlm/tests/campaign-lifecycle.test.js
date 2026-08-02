"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const {
  activeLifecycleTransitions,
  activeLifecycleStates,
  canTransition,
  deriveCandidateLifecycles,
  lifecycleStates,
  validateLifecycleTransition
} = require("../tools/campaign-lifecycle.js");

const digest = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

function receipt(type, status, completedAtUtc, options = {}) {
  return {
    receiptId: `sha256:${digest(`${type}:${status}:${completedAtUtc}:${options.modelId}`)}`,
    receiptType: type,
    phase: options.phase || type,
    status,
    completedAtUtc,
    inputHashes: options.inputHashes || {},
    outputHashes: options.outputHashes || {},
    publicSafeParameters: { modelId: options.modelId || "example/model" },
    blockerCode: options.blockerCode || null
  };
}

test("defines every required state once and keeps the active graph acyclic", () => {
  assert.equal(new Set(lifecycleStates).size, lifecycleStates.length);
  assert.deepEqual(lifecycleStates.slice(-2), ["Blocked", "Rejected"]);
  assert.deepEqual(Object.keys(activeLifecycleTransitions).sort(),
    [...activeLifecycleStates].sort());

  const visiting = new Set();
  const visited = new Set();
  function visit(state) {
    assert.equal(visiting.has(state), false, `cycle at ${state}`);
    if (visited.has(state)) return;
    visiting.add(state);
    for (const target of activeLifecycleTransitions[state]) visit(target);
    visiting.delete(state);
    visited.add(state);
  }
  for (const state of activeLifecycleStates) visit(state);
});

test("supports optional training and independent post-qualification branches", () => {
  assert.equal(canTransition("Screened", "TrainingPrepared"), true);
  assert.equal(canTransition("Screened", "Converted"), true);
  assert.equal(canTransition("Qualified", "BrowserTesting"), true);
  assert.equal(canTransition("Qualified", "P2PPrepared"), true);
  assert.equal(canTransition("Qualified", "Packaged"), true);
  assert.equal(canTransition("Screened", "Qualified"), false);
});

test("makes rejection terminal and resumes blocked work from its verified checkpoint", () => {
  assert.equal(canTransition("NativeEvaluated", "Rejected"), true);
  assert.equal(canTransition("Rejected", "Screened"), false);
  assert.throws(() => validateLifecycleTransition({
    fromState: "Rejected",
    toState: "Screened"
  }), /not allowed/);
  assert.deepEqual(validateLifecycleTransition({
    fromState: "Blocked",
    toState: "Converted",
    resumeFromState: "Screened"
  }), {
    schema: "tinyrustlm.campaign_lifecycle.v1",
    fromState: "Blocked",
    toState: "Converted",
    resumeFromState: "Screened"
  });
  assert.throws(() => validateLifecycleTransition({
    fromState: "Blocked",
    toState: "Qualified",
    resumeFromState: "Screened"
  }), /not allowed/);
});

test("projects candidate rejection separately from the highest verified phase", () => {
  const modelId = "example/rejected-model";
  const sourceHash = digest("source");
  const candidates = deriveCandidateLifecycles([
    receipt("tinyrustlm.model-source-screen-v1", "pass", "2026-07-15T01:00:00.000Z", {
      modelId,
      inputHashes: { sourceModel: sourceHash }
    }),
    receipt("tinyrustlm.model-conversion", "pass", "2026-07-15T02:00:00.000Z", {
      modelId,
      outputHashes: { model: digest("converted") }
    }),
    receipt("tinyrustlm.model-evaluation", "rejected", "2026-07-15T03:00:00.000Z", {
      modelId,
      blockerCode: "model_quality_rejected"
    })
  ]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].state, "Rejected");
  assert.equal(candidates[0].lastVerifiedState, "NativeEvaluated");
  assert.equal(candidates[0].terminal, true);
  assert.deepEqual(candidates[0].blockerCodes, ["model_quality_rejected"]);
});

test("does not treat a failed infrastructure attempt as immutable rejection", () => {
  const candidates = deriveCandidateLifecycles([
    receipt("tinyrustlm.model-qualification-error", "fail", "2026-07-15T03:00:00.000Z", {
      modelId: "example/retryable-model",
      blockerCode: "candidate_source_review_failed"
    })
  ]);
  assert.equal(candidates[0].state, "Blocked");
  assert.equal(candidates[0].terminal, false);
  assert.equal(candidates[0].retryRequiresOperatorDecision, true);
  assert.equal(candidates[0].currentTerminalReceiptId, candidates[0].lastReceiptId);
});

test("treats a typed source review decision as terminal rather than retryable", () => {
  const candidates = deriveCandidateLifecycles([
    receipt("tinyrustlm.model-qualification-error", "fail", "2026-07-15T01:00:00.000Z", {
      modelId: "example/incompatible-source",
      blockerCode: "candidate_source_review_failed"
    }),
    receipt("tinyrustlm.model-source-review-v1", "rejected", "2026-07-15T02:00:00.000Z", {
      modelId: "example/incompatible-source",
      blockerCode: "candidate_source_tensor_contract_rejected"
    })
  ]);
  assert.equal(candidates[0].state, "Rejected");
  assert.equal(candidates[0].lastVerifiedState, "Reviewed");
  assert.equal(candidates[0].terminal, true);
  assert.equal(candidates[0].retryRequiresOperatorDecision, false);
  assert.deepEqual(candidates[0].blockerCodes,
    ["candidate_source_tensor_contract_rejected"]);
});

test("projects a task-specific source rejection without granting task proof", () => {
  const modelId = "example/task-source-rejected";
  const sourceHash = digest("task-source");
  const taskRejection = receipt(
    "tinyrustlm.model-source-task-screen-v4",
    "rejected",
    "2026-07-26T16:02:18.617Z",
    {
      modelId,
      inputHashes: { sourceModel: sourceHash },
      blockerCode: "task_specific_source_quality_rejected"
    }
  );
  const candidates = deriveCandidateLifecycles([
    receipt("tinyrustlm.model-source-screen-v1", "rejected",
      "2026-07-26T15:00:00.000Z", {
        modelId,
        inputHashes: { sourceModel: sourceHash },
        blockerCode: "model_quality_rejected"
      }),
    receipt("tinyrustlm.model-source-task-screen-v1", "rejected",
      "2026-07-26T15:30:00.000Z", {
        modelId,
        inputHashes: { sourceModel: sourceHash },
        blockerCode: "task_specific_source_quality_rejected"
      }),
    receipt("tinyrustlm.model-source-task-screen-v2", "rejected",
      "2026-07-26T15:45:00.000Z", {
        modelId,
        inputHashes: { sourceModel: sourceHash },
        blockerCode: "task_specific_source_quality_rejected"
      }),
    receipt("tinyrustlm.model-source-task-screen-v3", "rejected",
      "2026-07-26T16:00:00.000Z", {
        modelId,
        inputHashes: { sourceModel: sourceHash },
        blockerCode: "task_specific_source_quality_rejected"
      }),
    taskRejection
  ]);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].state, "Rejected");
  assert.equal(candidates[0].lastVerifiedState, "Screened");
  assert.equal(candidates[0].lastReceiptId, taskRejection.receiptId);
  assert.equal(candidates[0].currentTerminalReceiptId, taskRejection.receiptId);
  assert.deepEqual(candidates[0].blockerCodes,
    ["task_specific_source_quality_rejected"]);
});

test("projects only the current candidate decision as a blocker", () => {
  const rejectedModelId = "example/recovered-then-rejected";
  const recoveredModelId = "example/recovered-and-qualified";
  const rejected = receipt("tinyrustlm.model-evaluation", "rejected",
    "2026-07-15T03:00:00.000Z", {
      modelId: rejectedModelId,
      blockerCode: "model_quality_rejected"
    });
  const qualified = receipt("tinyrustlm.model-qualification", "pass",
    "2026-07-15T03:00:00.000Z", { modelId: recoveredModelId });
  const candidates = deriveCandidateLifecycles([
    receipt("tinyrustlm.model-qualification-error", "fail", "2026-07-15T01:00:00.000Z", {
      modelId: rejectedModelId,
      blockerCode: "candidate_qualification_infrastructure_failed"
    }),
    receipt("tinyrustlm.model-conversion", "pass", "2026-07-15T02:00:00.000Z", {
      modelId: rejectedModelId,
      outputHashes: { model: digest("recovered-then-rejected") }
    }),
    rejected,
    receipt("tinyrustlm.model-qualification-error", "fail", "2026-07-15T01:00:00.000Z", {
      modelId: recoveredModelId,
      blockerCode: "candidate_source_review_failed"
    }),
    qualified
  ]);
  const byModel = new Map(candidates.map((candidate) => [candidate.modelId, candidate]));

  assert.equal(byModel.get(rejectedModelId).state, "Rejected");
  assert.deepEqual(byModel.get(rejectedModelId).blockerCodes, ["model_quality_rejected"]);
  assert.equal(byModel.get(rejectedModelId).currentTerminalReceiptId, rejected.receiptId);
  assert.equal(byModel.get(recoveredModelId).state, "Qualified");
  assert.deepEqual(byModel.get(recoveredModelId).blockerCodes, []);
  assert.equal(byModel.get(recoveredModelId).currentTerminalReceiptId, null);
});

test("does not invent a candidate from unrelated infrastructure metadata", () => {
  const candidates = deriveCandidateLifecycles([
    receipt("tinyrustlm.p2p-local-two-lane", "pass", "2026-07-15T03:00:00.000Z", {
      modelId: "example/infrastructure-only-model"
    })
  ]);
  assert.deepEqual(candidates, []);
});
