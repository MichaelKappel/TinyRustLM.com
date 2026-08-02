"use strict";

const lifecycleSchema = "tinyrustlm.campaign_lifecycle.v1";

const lifecycleStates = Object.freeze([
  "Discovered",
  "Acquired",
  "Reviewed",
  "Screened",
  "TrainingPrepared",
  "TrainingRunning",
  "Trained",
  "Converted",
  "StructurallyValidated",
  "NativeEvaluated",
  "ConversationScreened",
  "ConversationProven",
  "TaskSpecificProven",
  "Qualified",
  "BrowserTesting",
  "BrowserProven",
  "MemoryContinuityTesting",
  "MemoryContinuityProven",
  "P2PPrepared",
  "P2PServing",
  "P2PExternallyProven",
  "CatalogAnnounced",
  "Packaged",
  "Published",
  "DeploymentVerified",
  "Complete",
  "Blocked",
  "Rejected"
]);

const activeStates = Object.freeze(lifecycleStates.filter((state) =>
  state !== "Blocked" && state !== "Rejected"));
const activeStateSet = new Set(activeStates);
const lifecycleStateSet = new Set(lifecycleStates);

const activeTransitions = Object.freeze({
  Discovered: Object.freeze(["Acquired"]),
  Acquired: Object.freeze(["Reviewed"]),
  Reviewed: Object.freeze(["Screened"]),
  Screened: Object.freeze(["TrainingPrepared", "Converted"]),
  TrainingPrepared: Object.freeze(["TrainingRunning"]),
  TrainingRunning: Object.freeze(["Trained"]),
  Trained: Object.freeze(["Converted"]),
  Converted: Object.freeze(["StructurallyValidated"]),
  StructurallyValidated: Object.freeze(["NativeEvaluated"]),
  NativeEvaluated: Object.freeze(["ConversationScreened"]),
  ConversationScreened: Object.freeze(["ConversationProven", "TaskSpecificProven"]),
  ConversationProven: Object.freeze(["TaskSpecificProven", "Qualified"]),
  TaskSpecificProven: Object.freeze(["Qualified"]),
  Qualified: Object.freeze(["BrowserTesting", "P2PPrepared", "Packaged"]),
  BrowserTesting: Object.freeze(["BrowserProven"]),
  BrowserProven: Object.freeze(["MemoryContinuityTesting", "P2PPrepared", "Packaged"]),
  MemoryContinuityTesting: Object.freeze(["MemoryContinuityProven"]),
  MemoryContinuityProven: Object.freeze(["P2PPrepared", "Packaged"]),
  P2PPrepared: Object.freeze(["P2PServing"]),
  P2PServing: Object.freeze(["P2PExternallyProven"]),
  P2PExternallyProven: Object.freeze(["CatalogAnnounced"]),
  CatalogAnnounced: Object.freeze(["Packaged", "Published"]),
  Packaged: Object.freeze(["Published"]),
  Published: Object.freeze(["DeploymentVerified"]),
  DeploymentVerified: Object.freeze(["Complete"]),
  Complete: Object.freeze([])
});

const milestoneByReceiptType = Object.freeze({
  "tinyrustlm.model-discovery-v1": "Discovered",
  "tinyrustlm.model-acquisition-v1": "Acquired",
  "tinyrustlm.model-source-review-v1": "Reviewed",
  "tinyrustlm.model-source-screen-v1": "Screened",
  "tinyrustlm.model-source-task-screen-v1": "Screened",
  "tinyrustlm.model-source-task-screen-v2": "Screened",
  "tinyrustlm.model-source-task-screen-v3": "Screened",
  "tinyrustlm.model-source-task-screen-v4": "Screened",
  "tinyrustlm.model-training-preparation-v1": "TrainingPrepared",
  "tinyrustlm.model-training-start-v1": "TrainingRunning",
  "tinyrustlm.model-training-v1": "Trained",
  "tinyrustlm.model-training-pilot": "Trained",
  "tinyrustlm.model-conversion": "Converted",
  "tinyrustlm.model-structural-validation-v1": "StructurallyValidated",
  "tinyrustlm.model-evaluation": "NativeEvaluated",
  "tinyrustlm.model-conversation-screen-v1": "ConversationScreened",
  "tinyrustlm.model-conversation-proof-v1": "ConversationProven",
  "tinyrustlm.model-task-specific-proof-v1": "TaskSpecificProven",
  "tinyrustlm.model-qualification": "Qualified"
});

const candidateIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,255}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertLifecycleState(state, label) {
  invariant(lifecycleStateSet.has(state), `${label} is not a campaign lifecycle state`);
}

function validateActiveGraph() {
  const visiting = new Set();
  const visited = new Set();
  function visit(state) {
    invariant(!visiting.has(state), `campaign lifecycle contains a cycle at ${state}`);
    if (visited.has(state)) return;
    visiting.add(state);
    for (const target of activeTransitions[state]) {
      invariant(activeStateSet.has(target), `campaign lifecycle target is invalid: ${target}`);
      visit(target);
    }
    visiting.delete(state);
    visited.add(state);
  }
  for (const state of activeStates) {
    invariant(Object.hasOwn(activeTransitions, state),
      `campaign lifecycle transition list is missing: ${state}`);
    visit(state);
  }
}

function canTransition(fromState, toState, options = {}) {
  assertLifecycleState(fromState, "fromState");
  assertLifecycleState(toState, "toState");
  if (fromState === "Rejected") return false;
  if (fromState === toState) return true;
  if (fromState === "Complete") return toState === "Blocked";
  if (toState === "Blocked" || toState === "Rejected") return true;
  if (fromState === "Blocked") {
    const resumeFromState = options.resumeFromState;
    if (!activeStateSet.has(resumeFromState)) return false;
    return toState === resumeFromState || activeTransitions[resumeFromState].includes(toState);
  }
  return activeTransitions[fromState].includes(toState);
}

function validateLifecycleTransition(transition) {
  invariant(transition && typeof transition === "object" && !Array.isArray(transition),
    "campaign lifecycle transition is invalid");
  const { fromState, toState, resumeFromState = null } = transition;
  assertLifecycleState(fromState, "fromState");
  assertLifecycleState(toState, "toState");
  if (fromState === "Blocked") {
    invariant(activeStateSet.has(resumeFromState),
      "a blocked transition requires its last verified active state");
  } else {
    invariant(resumeFromState === null,
      "resumeFromState is valid only when resuming a blocked branch");
  }
  invariant(canTransition(fromState, toState, { resumeFromState }),
    `campaign lifecycle transition is not allowed: ${fromState} -> ${toState}`);
  return Object.freeze({
    schema: lifecycleSchema,
    fromState,
    toState,
    resumeFromState
  });
}

function normalizedCandidateId(value) {
  const candidate = typeof value === "string" ? value : "";
  return candidateIdPattern.test(candidate) ? candidate : null;
}

function receiptCandidateIds(receipt) {
  const parameters = receipt.publicSafeParameters || {};
  const result = new Set();
  const direct = normalizedCandidateId(parameters.modelId);
  if (direct) result.add(direct);
  if (Array.isArray(parameters.modelIds)) {
    for (const value of parameters.modelIds) {
      const modelId = normalizedCandidateId(value);
      if (modelId) result.add(modelId);
    }
  }
  return Array.from(result);
}

function compareReceipts(left, right) {
  return left.completedAtUtc.localeCompare(right.completedAtUtc) ||
    left.receiptId.localeCompare(right.receiptId);
}

function stateRank(state) {
  const index = activeStates.indexOf(state);
  invariant(index >= 0, `active campaign lifecycle state is invalid: ${state}`);
  return index;
}

function milestoneForReceipt(receipt) {
  const milestone = milestoneByReceiptType[receipt.receiptType] || null;
  if (!milestone) return null;
  if (receipt.receiptType === "tinyrustlm.model-qualification" && receipt.status !== "pass") {
    return null;
  }
  if (!["pass", "rejected"].includes(receipt.status)) return null;
  return milestone;
}

function deriveCandidateLifecycles(receipts) {
  invariant(Array.isArray(receipts), "campaign receipts must be an array");
  const candidates = new Map();
  for (const receipt of receipts) {
    invariant(receipt && typeof receipt === "object" && !Array.isArray(receipt),
      "campaign receipt is invalid");
    const candidateReceipt = Object.hasOwn(milestoneByReceiptType, receipt.receiptType) ||
      receipt.receiptType === "tinyrustlm.model-qualification-error";
    if (!candidateReceipt) continue;
    for (const modelId of receiptCandidateIds(receipt)) {
      const candidate = candidates.get(modelId) || { modelId, receipts: [] };
      candidate.receipts.push(receipt);
      candidates.set(modelId, candidate);
    }
  }

  const result = [];
  for (const candidate of candidates.values()) {
    candidate.receipts.sort(compareReceipts);
    const milestones = candidate.receipts
      .map((receipt) => ({ receipt, state: milestoneForReceipt(receipt) }))
      .filter((entry) => entry.state);
    const highest = milestones.sort((left, right) =>
      stateRank(left.state) - stateRank(right.state) ||
      compareReceipts(left.receipt, right.receipt)).at(-1) || null;
    const latestReceipt = candidate.receipts.at(-1);
    const latestTerminal = [...candidate.receipts].reverse().find((receipt) =>
      ["blocked", "fail", "rejected"].includes(receipt.status)) || null;
    const latestSuccess = [...candidate.receipts].reverse().find((receipt) =>
      receipt.status === "pass") || null;
    const terminalIsCurrent = latestTerminal &&
      (!latestSuccess || compareReceipts(latestTerminal, latestSuccess) >= 0);
    const currentTerminal = terminalIsCurrent ? latestTerminal : null;
    let state = highest?.state || null;
    if (currentTerminal) {
      state = currentTerminal.status === "rejected" ? "Rejected" : "Blocked";
    }
    const artifactSha256 = [...candidate.receipts].reverse()
      .map((receipt) => receipt.outputHashes?.model || receipt.inputHashes?.sourceModel || null)
      .find((value) => sha256Pattern.test(String(value || ""))) || null;
    const blockerCodes = currentTerminal?.blockerCode
      ? Object.freeze([currentTerminal.blockerCode])
      : Object.freeze([]);
    result.push(Object.freeze({
      modelId: candidate.modelId,
      state,
      lastVerifiedState: highest?.state || null,
      terminal: state === "Rejected",
      retryRequiresOperatorDecision: state === "Blocked",
      artifactSha256,
      blockerCodes,
      currentTerminalReceiptId: currentTerminal?.receiptId || null,
      currentTerminalCompletedAtUtc: currentTerminal?.completedAtUtc || null,
      lastReceiptId: latestReceipt.receiptId,
      lastCompletedAtUtc: latestReceipt.completedAtUtc
    }));
  }
  return Object.freeze(result.sort((left, right) => left.modelId.localeCompare(right.modelId)));
}

validateActiveGraph();

module.exports = Object.freeze({
  activeLifecycleTransitions: activeTransitions,
  activeLifecycleStates: activeStates,
  canTransition,
  deriveCandidateLifecycles,
  lifecycleSchema,
  lifecycleStates,
  validateLifecycleTransition
});
