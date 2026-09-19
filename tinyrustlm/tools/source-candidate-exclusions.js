"use strict";

const policy = require("../../contracts/vnext/source-candidate-exclusions.v1.json");
const revisions = new Map();
const weights = new Set();
if (policy.schema !== "tinyrustlm.source_candidate_exclusions.v1" ||
    !Array.isArray(policy.entries) || policy.entries.length === 0) {
  throw new Error("source candidate exclusion policy is invalid");
}
for (const entry of policy.entries) {
  if (typeof entry.modelId !== "string" || !/^[a-f0-9]{40}$/.test(entry.revision) ||
      !["quality", "preflight", "owner-quality-rejection"].includes(entry.kind) ||
      (entry.kind === "preflight" ? entry.weightSha256 !== null : !/^[a-f0-9]{64}$/.test(entry.weightSha256))) {
    throw new Error("source candidate exclusion entry is invalid");
  }
  const key = `${entry.modelId.toLowerCase()}@${entry.revision}`;
  if (revisions.has(key)) throw new Error("source candidate exclusion is duplicated");
  revisions.set(key, entry.kind === "preflight" ? "prior_source_preflight_rejected" : "prior_source_quality_rejected");
  if (entry.weightSha256) weights.add(entry.weightSha256);
}

/** Match recorded product rejections by exact revision or known weight bytes, never by family. */
function sourceCandidateRejection(modelId, revision, weightFiles = []) {
  if (typeof modelId !== "string" || typeof revision !== "string" || !Array.isArray(weightFiles)) {
    throw new Error("source candidate exclusion input is invalid");
  }
  const rejected = revisions.get(`${modelId.toLowerCase()}@${revision.toLowerCase()}`);
  if (rejected) return rejected;
  if (weightFiles.some((file) => typeof file?.sha256 === "string" && weights.has(file.sha256.toLowerCase()))) {
    return "prior_weight_quality_rejected";
  }
  // This negative-only lookup cannot qualify a different checkpoint or admit an experiment.
  return "";
}

module.exports = Object.freeze({ sourceCandidateRejection });
