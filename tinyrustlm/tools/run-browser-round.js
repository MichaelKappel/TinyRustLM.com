#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const campaign = require("./dogfood-campaign.js");
const { persistBrowserRoundEvidence } = require("./browser-round-evidence.js");
const { atomicCreate } = require("./durable-files.js");
const { runFreshBrowserConversation } = require("./fresh-browser-conversation.js");

const jobResultSchema = "tinyrustlm.browser_round_job_result.v1";
const maximumCampaignBytes = 16 * 1024 * 1024;

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readBoundedJson(filePath, label) {
  const resolved = path.resolve(String(filePath || ""));
  const stat = fs.lstatSync(resolved, { throwIfNoEntry: false });
  invariant(stat && stat.isFile() && !stat.isSymbolicLink() &&
    stat.size > 0 && stat.size <= maximumCampaignBytes,
  `${label} is missing or outside its size limit`);
  try {
    return JSON.parse(fs.readFileSync(resolved, "utf8"));
  } catch (_error) {
    throw new Error(`${label} is not valid JSON`);
  }
}

function parseArguments(argv) {
  invariant(Array.isArray(argv) && argv.length === 5,
    "usage: run-browser-round <campaign.json> <round> <evidence-root> " +
    "<profile-parent> <output.json>");
  const round = Number(argv[1]);
  invariant(Number.isSafeInteger(round) && round >= 1 && round <= 50,
    "browser round number must be 1 through 50");
  return Object.freeze({
    campaignPath: path.resolve(argv[0]),
    round,
    evidenceRoot: path.resolve(argv[2]),
    profileParent: path.resolve(argv[3]),
    outputPath: path.resolve(argv[4])
  });
}

function publicExecution(execution) {
  return Object.freeze({
    schema: execution.schema,
    evidenceClass: execution.evidenceClass,
    status: execution.status,
    failureCode: execution.failureCode,
    startedAtUtc: execution.startedAtUtc,
    completedAtUtc: execution.completedAtUtc,
    round: execution.round,
    modelId: execution.modelId,
    browserName: execution.browserName,
    browserVersion: execution.browserVersion,
    browserVersionSha256: execution.browserVersionSha256,
    browserExecutableSha256: execution.browserExecutableSha256,
    playwrightVersion: execution.playwrightVersion,
    viewport: execution.viewport,
    profileRootMarkerHash: execution.profileRootMarkerHash,
    profileMarkerHash: execution.profileMarkerHash,
    profileDeletionReceiptSha256: execution.profileDeletionReceiptSha256,
    networkRequestCount: execution.networkRequestCount,
    composition: execution.composition,
    runtimeIdentity: execution.runtimeIdentity,
    sampling: execution.sampling,
    browserStateScan: execution.browserStateScan,
    consoleScan: execution.consoleScan,
    profileScan: execution.profileScan,
    evidence: execution.evidence
  });
}

function publicResult(execution, receipt) {
  return Object.freeze({
    schema: jobResultSchema,
    receiptId: receipt.receiptId,
    receiptContentHash: receipt.receiptContentHash,
    status: receipt.status,
    blockerCode: receipt.blockerCode,
    round: execution.round,
    modelId: execution.modelId,
    execution: publicExecution(execution)
  });
}

function protectedRoundValues(round, scanCanary) {
  invariant(round && Array.isArray(round.prompts) &&
    round.prompts.length >= 2 && round.prompts.length <= 6,
  "browser round prompts are invalid");
  invariant(typeof scanCanary === "string" && scanCanary.length >= 32,
    "browser scan canary is invalid");
  return Object.freeze([scanCanary, ...round.prompts.map(String)]);
}

async function runBrowserRoundJob(options, dependencies = {}) {
  const runConversation =
    dependencies.runConversation || runFreshBrowserConversation;
  const persistEvidence =
    dependencies.persistEvidence || persistBrowserRoundEvidence;
  const rawConfiguration = readBoundedJson(options.campaignPath, "campaign manifest");
  const configuration = campaign.validateCampaignConfiguration(rawConfiguration);
  const round = configuration.rounds.find((entry) => entry.round === options.round);
  invariant(round, "browser round is absent from the campaign manifest");
  invariant(round.memoryContinuity !== true,
    "hosted-memory rounds require the live MemoryEndpoints executor");
  const model = configuration.models.find((entry) => entry.modelId === round.modelId);
  invariant(model, "browser round model is absent from the campaign manifest");

  const scanCanary = `tinyrustlm-profile-scan-${crypto.randomBytes(24).toString("hex")}`;
  const knownSecrets = protectedRoundValues(round, scanCanary);
  const execution = await runConversation({
    campaignId: configuration.campaignId,
    profileParent: options.profileParent,
    applicationUrl: configuration.applicationUrl,
    round,
    model,
    viewport: round.viewport,
    reducedMotion: round.reducedMotion,
    allowedOrigins: round.allowedOrigins,
    knownSecrets
  });
  const receipt = persistEvidence({
    evidenceRoot: options.evidenceRoot,
    campaignId: configuration.campaignId,
    applicationUrl: configuration.applicationUrl,
    round,
    model,
    execution,
    knownSecrets
  });
  const result = publicResult(execution, receipt);
  atomicCreate(options.outputPath, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = await runBrowserRoundJob(options);
  process.stdout.write(
    `TinyRustLM browser round ${result.round}: ${result.status}; receipt ${result.receiptId}\n`
  );
  if (result.status !== "pass") {
    process.exitCode = 2;
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`TinyRustLM browser round failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  jobResultSchema,
  parseArguments,
  protectedRoundValues,
  publicExecution,
  publicResult,
  runBrowserRoundJob
});
