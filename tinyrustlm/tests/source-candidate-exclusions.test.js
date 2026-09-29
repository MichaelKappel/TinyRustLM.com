"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { sourceCandidateRejection } = require("../tools/source-candidate-exclusions.js");
const acquire = require("../tools/huggingface-candidate-acquire.js");
const supported = require("../tools/huggingface-supported-candidates.js");
const root = path.resolve(__dirname, "../..");
const policy = require("../../contracts/vnext/source-candidate-exclusions.v1.json");
const rejected = policy.entries.find((entry) => entry.modelId === "Qwen/Qwen2.5-1.5B-Instruct");

test("current exclusions preserve all exact prior decisions and their evidence identities", () => {
  assert.equal(policy.entries.length, 47);
  assert.equal(policy.entries.filter((entry) => entry.kind === "preflight").length, 9);
  for (const entry of policy.entries) {
    assert.match(entry.evidence.path, /^(tinyrustlm\/training\/[^/]+\/assessment-control-v\d+|contracts\/vnext\/qwen3-0\.6b-base-source-lock\.v2)\.json$/);
    const bytes = fs.readFileSync(path.join(root, entry.evidence.path));
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), entry.evidence.sha256);
    const value = JSON.parse(bytes);
    if (entry.kind === "owner-quality-rejection") {
      assert.equal(value.modelId, "Qwen/Qwen3-0.6B");
      assert.equal(value.revision, entry.revision);
      assert.equal(value.files.model.sha256, entry.weightSha256);
    } else {
      assert.equal(value.decision, "rejected");
      assert.equal(value.sourceModelId, entry.modelId);
      assert.equal(value.sourceRevision, entry.revision);
      assert.equal(value.sourceModelArtifactSha256 ?? null, entry.weightSha256);
    }
    assert.equal(sourceCandidateRejection(entry.modelId, entry.revision),
      entry.kind === "preflight" ? "prior_source_preflight_rejected" : "prior_source_quality_rejected");
    if (entry.weightSha256) assert.equal(sourceCandidateRejection("Another/Repository", "a".repeat(40),
      [{ filename: "renamed.safetensors", sha256: entry.weightSha256 }]), "prior_weight_quality_rejected");
  }
});

test("exclusions are exact negative evidence, not a family ban or positive admission", () => {
  assert.equal(sourceCandidateRejection(rejected.modelId.toUpperCase(), rejected.revision.toUpperCase()), "prior_source_quality_rejected");
  assert.equal(sourceCandidateRejection(rejected.modelId, "a".repeat(40), [{ sha256: "c".repeat(64) }]), "");
  assert.equal(sourceCandidateRejection("Another/Model", "a".repeat(40), []), "");
  assert.equal(sourceCandidateRejection("Another/Model", "a".repeat(40),
    [{ sha256: "a".repeat(64) }, { sha256: rejected.weightSha256.toUpperCase() }]), "prior_weight_quality_rejected");
  assert.equal(sourceCandidateRejection("Another/Model", "a".repeat(40), [null, {}]), "");
  for (const args of [[null, "a", []], ["Example/Model", null, []], ["Example/Model", "a", null]]) {
    assert.throws(() => sourceCandidateRejection(...args), /exclusion input is invalid/);
  }
});

for (const [inventoryName, start] of [["smollm2-current-candidate-inventory-20260927.json", 0],
  ["qwen3-expanded-candidate-inventory-20260927.json", 0],
  ["qwen3-expanded-candidate-inventory-20260927.json", 1],
  ["qwen3-expanded-candidate-inventory-20260927.json", 2],
  ["qwen3-next-candidate-inventory-20260928.json", 0],
  ["qwen3-next-candidate-inventory-20260928.json", 1],
  ["qwen3-next-candidate-inventory-20260928.json", 2],
  ["qwen3-reaper-untied-inventory-20260929.json", 1],
  ["qwen3-reaper-untied-inventory-20260929.json", 0]]) {
test(`source rejection blocks ${inventoryName} selection ${start} without fetching or writing`, async () => {
  const inventory = JSON.parse(fs.readFileSync(path.join(root,
    "artifacts/ecosystem-cleanup-20260912", inventoryName)));
  const output = path.join(root, "artifacts", "tests", `source-exclusion-${crypto.randomUUID()}`);
  let fetched = false;
  // Preserve the immutable historical inventory and exercise its exact row's exclusion
  // before current v4 fields or acquisition I/O, without pretending it is a v4 inventory.
  await assert.rejects(acquire.acquireCandidate(inventory.candidates[start], output, {
    fetchImpl: async () => { fetched = true; throw new Error("Unexpected fetch"); }
  }), /prior_source_quality_rejected/);
  assert.equal(fetched, false);
  assert.equal(fs.existsSync(output), false);
});
}

/** Return a source-shaped response; unexpected follow-up requests fail the regression. */
function metadataFetch(modelId, revision, weightSha256, calls) {
  return async (url) => {
    calls.push(url);
    if (calls.length === 1) return Response.json([{
      id: modelId, sha: revision, pipeline_tag: "text-generation", tags: ["safetensors", "text-generation", "license:apache-2.0"],
      config: { model_type: "qwen2", architectures: ["Qwen2ForCausalLM"] },
    }]);
    assert.equal(calls.length, 2, "Excluded weights must not trigger config/license or model download");
    return Response.json({ id: modelId, sha: revision,
      pipeline_tag: "text-generation", cardData: { license: "apache-2.0" }, siblings: [
        { rfilename: "config.json", size: 100, blobId: "c".repeat(40) },
        { rfilename: "tokenizer.json", size: 100, blobId: "d".repeat(40) },
        { rfilename: "tokenizer_config.json", size: 100, blobId: "e".repeat(40) },
        { rfilename: "LICENSE", size: 100, blobId: "f".repeat(40) },
        { rfilename: "model.safetensors", lfs: { size: 3_000_000_000, sha256: weightSha256 } },
      ] });
  };
}

test("discovery excludes recorded revision before model-specific requests", async () => {
  const calls = [];
  const report = await supported.discoverCandidates({ profileId: "qwen2.5-1.5b-bpe", candidateLimit: 1,
    fetchImpl: metadataFetch(rejected.modelId, rejected.revision, rejected.weightSha256, calls) });
  assert.equal(calls.length, 1);
  assert.equal(report.candidates.length, 0);
  assert.deepEqual(report.rejections, [{ modelId: rejected.modelId, code: "prior_source_quality_rejected" }]);
});
test("discovery refuses a renamed repository with the rejected weight digest", async () => {
  const calls = [];
  const modelId = "Mirror/Qwen2.5-1.5B-Instruct";
  const report = await supported.discoverCandidates({ profileId: "qwen2.5-1.5b-bpe", candidateLimit: 1,
    fetchImpl: metadataFetch(modelId, "a".repeat(40), rejected.weightSha256, calls) });
  assert.equal(calls.length, 2);
  assert.equal(report.candidates.length, 0);
  assert.deepEqual(report.rejections, [{ modelId, code: "prior_weight_quality_rejected" }]);
});

/** Build a valid inventory row so acquisition reaches its own weight exclusion gate. */
function mirrorCandidate() {
  const sha256 = "a".repeat(64);
  return { modelId: "Mirror/Qwen2.5-1.5B-Instruct", revision: "a".repeat(40), sourceTemplate: "qwen2.5-1.5b-bpe",
    licenseId: "apache-2.0", licenseEvidenceKind: "revision-metadata-plus-apache-authority-text",
    licenseSourceUrl: "https://www.apache.org/licenses/LICENSE-2.0.txt", licenseSha256: sha256,
    configSha256: sha256, weightIdentity: sha256, sourceWeightByteCount: 100,
    tokenizer: { filename: "tokenizer.json", byteCount: 100, sha256 },
    tokenizerConfig: { filename: "tokenizer_config.json", byteCount: 100, sha256 },
    chatTemplateKind: "revision-chatml-template-v1", chatTemplateSha256: sha256,
    weightFiles: [{ filename: "model.safetensors", byteCount: 100, sha256: rejected.weightSha256 }] };
}

test("acquisition independently rejects stale or fabricated inventories before any write or fetch", async () => {
  const output = path.join(root, "artifacts", "tests", `exclusion-must-not-create-${crypto.randomUUID()}`);
  let fetched = false;
  const fetchImpl = async () => { fetched = true; throw new Error("Unexpected network request"); };
  await assert.rejects(acquire.acquireCandidate({ modelId: rejected.modelId, revision: rejected.revision }, output, { fetchImpl }),
    /prior_source_quality_rejected/);
  const preflight = policy.entries.find((entry) => entry.kind === "preflight");
  await assert.rejects(acquire.acquireCandidate({ modelId: preflight.modelId, revision: preflight.revision }, output, { fetchImpl }),
    /prior_source_preflight_rejected/);
  await assert.rejects(acquire.acquireCandidate(mirrorCandidate(), output, { fetchImpl }), /prior_weight_quality_rejected/);
  assert.equal(fetched, false);
  assert.equal(fs.existsSync(output), false);
});
