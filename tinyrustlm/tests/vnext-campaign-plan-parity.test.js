"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const {
  buildCampaignPlanVectorFiles,
  draftPath,
  planPath
} = require("../tools/vnext-campaign-plan-vector-generator.js");
const {
  validateCampaignPlanBytes
} = require("../tools/vnext-campaign-projection.js");

test("freezes deterministic Node campaign-plan bytes for independent implementations", () => {
  const expected = buildCampaignPlanVectorFiles();
  assert.deepEqual(fs.readFileSync(draftPath), expected.draftBytes);
  assert.deepEqual(fs.readFileSync(planPath), expected.planBytes);
  const validated = validateCampaignPlanBytes(expected.planBytes);
  assert.equal(validated.plan.planId, expected.planId);
  assert.equal(validated.planSha256, expected.planSha256);
});

test("the frozen final wire is canonical and rejects transport decoration", () => {
  const bytes = fs.readFileSync(planPath);
  assert.doesNotThrow(() => validateCampaignPlanBytes(bytes));
  assert.throws(
    () => validateCampaignPlanBytes(Buffer.concat([bytes, Buffer.from("\n")])),
    (error) => error?.code === "campaign_plan_identity_mismatch"
  );
});
