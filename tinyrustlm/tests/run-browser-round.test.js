"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const {
  parseArguments,
  protectedRoundValues,
  publicExecution
} = require("../tools/run-browser-round.js");

test("parses only the bounded public-safe browser round command shape", () => {
  const parsed = parseArguments([
    "campaign.json",
    "26",
    "evidence",
    "profiles",
    "round-0026.json"
  ]);
  assert.equal(parsed.round, 26);
  assert.equal(parsed.campaignPath, path.resolve("campaign.json"));
  assert.throws(() => parseArguments([
    "campaign.json",
    "26",
    "evidence",
    "round-0026.json"
  ]), /usage:/i);
});

test("public execution output cannot inherit prompts, paths, or future raw fields", () => {
  const execution = {
    schema: "tinyrustlm.fresh_browser_conversation.v4",
    evidenceClass: "browser",
    status: "pass",
    failureCode: null,
    startedAtUtc: "2026-07-25T00:00:00.000Z",
    completedAtUtc: "2026-07-25T00:01:00.000Z",
    round: 26,
    modelId: "tinyrustlm/model-a",
    browserName: "chromium",
    browserVersion: "140.0",
    browserVersionSha256: "1".repeat(64),
    browserExecutableSha256: "2".repeat(64),
    playwrightVersion: "1.61.1",
    viewport: { width: 1365, height: 768 },
    profileRootMarkerHash: "3".repeat(64),
    profileMarkerHash: "4".repeat(64),
    profileDeletionReceiptSha256: "5".repeat(64),
    networkRequestCount: 8,
    composition: { activated: true },
    runtimeIdentity: {
      admissionSha256: "7".repeat(64),
      qualificationReceiptId: `sha256:${"8".repeat(64)}`
    },
    sampling: {
      maxTokens: 96,
      temperature: 0.6,
      topK: 20,
      topP: 0.95,
      seed: 42,
      repetitionPenalty: 1,
      turns: []
    },
    browserStateScan: { complete: true, matchCount: 0 },
    consoleScan: { complete: true, matchCount: 0 },
    profileScan: { complete: true },
    evidence: { rawConversationSha256: "6".repeat(64) },
    prompts: ["private prompt"],
    artifactPath: "E:\\private\\model.slm",
    rawTurns: [{ assistant: "private output" }]
  };
  const output = publicExecution(execution);
  const serialized = JSON.stringify(output);
  assert.equal(serialized.includes("private prompt"), false);
  assert.equal(serialized.includes("private\\\\model.slm"), false);
  assert.equal(serialized.includes("private output"), false);
  assert.equal(output.browserStateScan.complete, true);
  assert.equal(output.consoleScan.complete, true);
  assert.equal(output.runtimeIdentity.admissionSha256, "7".repeat(64));
  assert.equal(output.sampling.seed, 42);
});

test("protects every private prompt during browser and receipt scanning", () => {
  const canary = `tinyrustlm-profile-scan-${"a".repeat(48)}`;
  const values = protectedRoundValues({
    prompts: ["Private first prompt", "Private second prompt"]
  }, canary);
  assert.deepEqual(values, [
    canary,
    "Private first prompt",
    "Private second prompt"
  ]);
  assert.throws(() => protectedRoundValues({ prompts: ["only one"] }, canary),
    /prompts are invalid/i);
});
