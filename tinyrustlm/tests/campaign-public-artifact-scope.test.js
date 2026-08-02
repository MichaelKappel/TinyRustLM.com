"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  buildCampaignPublicArtifactManifest,
  buildCampaignPublicArtifactScope,
  scopeKind,
  staticArtifacts
} = require("../tools/campaign-public-artifact-scope.js");

function writeFixture(root, relativePath, text = "public fixture\n") {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
}

test("builds one deterministic complete campaign release scope", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-campaign-scope-"));
  const evidenceRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "tinyrustlm-campaign-evidence-scope-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  context.after(() => fs.rmSync(evidenceRoot, { recursive: true, force: true }));
  for (const artifact of staticArtifacts) writeFixture(root, artifact.relativePath);
  writeFixture(root, "artifacts/packages/package.nupkg");
  writeFixture(root, "artifacts/packages/nested/not-included.txt");
  writeFixture(root, "artifacts/releases/release.zip");
  writeFixture(evidenceRoot, "campaign-status.json");
  writeFixture(evidenceRoot, "dashboard-snapshots/sha256/aa/snapshot.json");
  writeFixture(evidenceRoot, "final-attestation.json");
  writeFixture(evidenceRoot, "final-attestation-snapshots/sha256/aa/snapshot.json");
  writeFixture(evidenceRoot, "history/dashboard-renamed.json",
    JSON.stringify({ schema: "tinyrustlm.dogfood_campaign_dashboard.v9" }));
  writeFixture(evidenceRoot, "history/final-renamed.json",
    JSON.stringify({ schema: "tinyrustlm.campaign_final_attestation.v1" }));
  writeFixture(evidenceRoot, "history/scan-renamed.json",
    JSON.stringify({ schema: "tinyrustlm.public_artifact_secret_scan.v2" }));
  writeFixture(evidenceRoot, "receipts/sha256/00/secret-v1.json",
    JSON.stringify({ receiptType: "tinyrustlm.secret-scan-v1" }));
  writeFixture(evidenceRoot, "receipts/sha256/aa/secret.json",
    JSON.stringify({ receiptType: "tinyrustlm.secret-scan-v2" }));
  writeFixture(evidenceRoot, "receipts/sha256/cc/authorization.json",
    JSON.stringify({ receiptType: "tinyrustlm.release-attestation-verification-v1" }));
  writeFixture(evidenceRoot, "receipts/sha256/dd/attestation.json",
    JSON.stringify({ receiptType: "tinyrustlm.final-release-attestation-v1" }));
  writeFixture(evidenceRoot, "receipts/sha256/bb/qualification.json",
    JSON.stringify({ receiptType: "tinyrustlm.model-qualification" }));
  writeFixture(root,
    "docs/report-intake/2026-07-15/liquid-edge-research/independent-report.md");
  writeFixture(root,
    "docs/report-intake/2026-07-15/deeper-small-model-research/independent-report.md");

  const first = buildCampaignPublicArtifactScope({ workspaceRoot: root, evidenceRoot });
  const second = buildCampaignPublicArtifactScope({ workspaceRoot: root, evidenceRoot });
  assert.deepEqual(first, second);
  assert.equal(scopeKind, "campaign-public-release");
  assert.equal(new Set(first.map((artifact) => artifact.label)).size, first.length);
  assert.equal(first.some((artifact) => artifact.label === "campaign/campaign-status.json"), false);
  assert.equal(first.some((artifact) => artifact.label.includes("dashboard-snapshots")), false);
  assert.equal(first.some((artifact) => artifact.label === "campaign/final-attestation.json"), false);
  assert.equal(first.some((artifact) => artifact.label.includes("final-attestation-snapshots")), false);
  assert.equal(first.some((artifact) => artifact.label.endsWith("dashboard-renamed.json")), false);
  assert.equal(first.some((artifact) => artifact.label.endsWith("final-renamed.json")), false);
  assert.equal(first.some((artifact) => artifact.label.endsWith("scan-renamed.json")), false);
  assert.equal(first.some((artifact) => artifact.label.endsWith("secret-v1.json")), false);
  assert.equal(first.some((artifact) => artifact.label.endsWith("secret.json")), false);
  assert.equal(first.some((artifact) => artifact.label.endsWith("authorization.json")), false);
  assert.equal(first.some((artifact) => artifact.label.endsWith("attestation.json")), false);
  assert.ok(first.some((artifact) => artifact.label.endsWith("qualification.json")));
  assert.ok(first.some((artifact) => artifact.label === "packages/package.nupkg"));
  assert.equal(first.some((artifact) => artifact.label.includes("not-included")), false);
  assert.ok(first.some((artifact) => artifact.label.startsWith("research/item-")));
  assert.ok(first.some((artifact) =>
    artifact.label.startsWith("research/deeper-small-model/item-")));
  for (const label of [
    "control-plane/source-model-preflight-evidence.js",
    "reports/tinyrustlm-lfm2-350m-source-screen-memory-2026-07-26.md",
    "reports/tinyrustlm-apertus-v1.1-1.5b-instruct-source-screen-memory-2026-07-16.md",
    "reports/tinyrustlm-croissantllmchat-v0.1-source-screen-memory-2026-07-18.md",
    "reports/tinyrustlm-lfm2.5-1.2b-thinking-source-screen-memory-2026-07-18.md",
    "reports/tinyrustlm-eurollm-1.7b-instruct-source-preflight-memory-2026-07-18.md",
    "reports/tinyrustlm-zainbhat-qwen3-0.6b-finetome-lora-merged-source-preflight-memory-2026-07-18.md",
    "reports/tinyrustlm-hiep-2-qwen3-0.6b-math-cpt-sft-source-preflight-memory-2026-07-18.md",
    "reports/tinyrustlm-huihui-ai-qwen2.5-1.5b-instruct-abliterated-sft-source-preflight-memory-2026-07-18.md",
    "reports/tinyrustlm-amd-olmo-1b-sft-source-preflight-memory-2026-07-16.md",
    "reports/tinyrustlm-gemma-3-270m-it-source-preflight-memory-2026-07-16.md",
    "reports/tinyrustlm-llama-3.2-1b-instruct-source-preflight-memory-2026-07-16.md",
    "reports/tinyrustlm-minicpm4-0.5b-source-preflight-memory-2026-07-16.md",
    "reports/tinyrustlm-openelm-1.1b-instruct-source-preflight-memory-2026-07-16.md",
    "reports/tinyrustlm-falcon-e-1b-instruct-source-screen-memory-2026-07-16.md",
    "reports/tinyrustlm-granite-4.0-h-1b-source-screen-memory-2026-07-16.md",
    "reports/tinyrustlm-h2o-danube3-500m-chat-source-screen-memory-2026-07-16.md",
    "reports/tinyrustlm-smollm-1.7b-instruct-source-screen-memory-2026-07-16.md",
    "reports/tinyrustlm-qwen2.5-0.5b-instruct-source-screen-memory-2026-07-26.md",
    "experiments/task-specialists/planning-constraint-ledger-qwen25-05b-case-manifest.v1.json",
    "experiments/task-specialists/planning-constraint-ledger-qwen25-05b-source-screen-preregistration.v1.json",
    "experiments/task-specialists/planning-constraint-ledger-qwen25-05b-source-screen-observation.v1.json",
    "experiments/task-specialists/planning-constraint-ledger-qwen25-15b-case-manifest.v1.json",
    "experiments/task-specialists/planning-constraint-ledger-qwen25-15b-source-screen-preregistration.v2.json",
    "experiments/task-specialists/planning-constraint-ledger-qwen25-15b-source-screen-observation.v2.json",
    "experiments/task-specialists/planning-constraint-ledger-lfm2-350m-case-manifest.v1.json",
    "experiments/task-specialists/planning-constraint-ledger-lfm2-350m-source-screen-preregistration.v2.json",
    "experiments/task-specialists/planning-constraint-ledger-lfm2-350m-source-screen-observation.v2.json",
    "experiments/task-specialists/planning-constraint-ledger-qwen3-17b-case-manifest.v1.json",
    "experiments/task-specialists/planning-constraint-ledger-qwen3-17b-source-screen-preregistration.v3.json",
    "experiments/task-specialists/planning-constraint-ledger-qwen3-17b-source-screen-observation.v3.json",
    "experiments/task-specialists/planning-constraint-ledger-qwen3-06b-case-manifest.v2.json",
    "experiments/task-specialists/planning-constraint-ledger-qwen3-06b-source-screen-preregistration.v4.json",
    "experiments/task-specialists/planning-constraint-ledger-qwen3-06b-source-screen-observation.v4.json",
    "experiments/task-specialists/planning-constraint-ledger-exclusion-set.v1.json",
    "control-plane/task-specialist-case-generator.js",
    "control-plane/task-specialist-case-generator-v2.js",
    "control-plane/task-specialist-source-screen-v1.js",
    "control-plane/task-specialist-source-screen-v2.js",
    "control-plane/task-specialist-source-screen-v3.js",
    "control-plane/task-specialist-source-screen-v4.js",
    "training/apertus-v1.1-1.5b-instruct-source-screen-v1/assessment-control-v1.json",
    "training/lfm2-350m-source-screen-v1/assessment-control-v1.json",
    "training/croissantllmchat-v0.1-source-screen-v1/assessment-control-v1.json",
    "training/lfm2.5-1.2b-thinking-source-screen-v1/assessment-control-v1.json",
    "training/eurollm-1.7b-instruct-source-preflight-v2/assessment-control-v2.json",
    "training/zainbhat-qwen3-0.6b-finetome-lora-merged-source-preflight-v2/assessment-control-v2.json",
    "training/hiep-2-qwen3-0.6b-math-cpt-sft-source-preflight-v2/assessment-control-v2.json",
    "training/huihui-ai-qwen2.5-1.5b-instruct-abliterated-sft-source-preflight-v2/assessment-control-v2.json",
    "training/amd-olmo-1b-sft-source-preflight-v1/assessment-control-v1.json",
    "training/gemma-3-270m-it-source-preflight-v1/assessment-control-v1.json",
    "training/llama-3.2-1b-instruct-source-preflight-v1/assessment-control-v1.json",
    "training/minicpm4-0.5b-source-preflight-v1/assessment-control-v1.json",
    "training/openelm-1.1b-instruct-source-preflight-v1/assessment-control-v1.json",
    "training/falcon-e-1b-instruct-source-screen-v1/assessment-control-v1.json",
    "training/granite-4.0-h-1b-source-screen-v1/assessment-control-v1.json",
    "training/h2o-danube3-500m-chat-source-screen-v1/assessment-control-v1.json",
    "training/smollm-1.7b-instruct-source-screen-v1/assessment-control-v1.json",
    "training/qwen2.5-0.5b-instruct-source-screen-v1/assessment-control-v1.json"
  ]) {
    assert.ok(first.some((artifact) => artifact.label === label), `missing ${label}`);
  }
  assert.equal(first.every((artifact) => path.isAbsolute(artifact.path)), true);

  const manifest = buildCampaignPublicArtifactManifest({ workspaceRoot: root, evidenceRoot });
  assert.equal(manifest.artifactCount, first.length);
  assert.match(manifest.scopeManifestSha256, /^[a-f0-9]{64}$/);
  writeFixture(evidenceRoot, "campaign-status.json", "changed but excluded\n");
  writeFixture(evidenceRoot, "dashboard-snapshots/sha256/aa/snapshot.json",
    "changed but excluded\n");
  writeFixture(evidenceRoot, "final-attestation.json", "changed but excluded\n");
  writeFixture(evidenceRoot, "final-attestation-snapshots/sha256/aa/snapshot.json",
    "changed but excluded\n");
  writeFixture(evidenceRoot, "history/dashboard-renamed.json",
    JSON.stringify({ schema: "tinyrustlm.dogfood_campaign_dashboard.v10", changed: true }));
  writeFixture(evidenceRoot, "history/final-renamed.json",
    JSON.stringify({ schema: "tinyrustlm.campaign_final_attestation.v1", changed: true }));
  writeFixture(evidenceRoot, "history/scan-renamed.json",
    JSON.stringify({ schema: "tinyrustlm.public_artifact_secret_scan.v2", changed: true }));
  writeFixture(evidenceRoot, "receipts/sha256/00/secret-v1.json",
    JSON.stringify({ receiptType: "tinyrustlm.secret-scan-v1", changed: true }));
  writeFixture(evidenceRoot, "receipts/sha256/aa/secret.json",
    JSON.stringify({ receiptType: "tinyrustlm.secret-scan-v2", changed: true }));
  writeFixture(evidenceRoot, "receipts/sha256/cc/authorization.json",
    JSON.stringify({
      receiptType: "tinyrustlm.release-attestation-verification-v1",
      changed: true
    }));
  writeFixture(evidenceRoot, "receipts/sha256/dd/attestation.json",
    JSON.stringify({ receiptType: "tinyrustlm.final-release-attestation-v1", changed: true }));
  assert.equal(buildCampaignPublicArtifactManifest({ workspaceRoot: root, evidenceRoot })
    .scopeManifestSha256, manifest.scopeManifestSha256);
  writeFixture(evidenceRoot, "receipts/sha256/bb/qualification.json",
    JSON.stringify({ receiptType: "tinyrustlm.model-qualification", changed: true }));
  assert.notEqual(buildCampaignPublicArtifactManifest({ workspaceRoot: root, evidenceRoot })
    .scopeManifestSha256, manifest.scopeManifestSha256);
});

test("sources release outputs from an independently rooted asset tree", (context) => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-workspace-scope-"));
  const releaseAssetsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-assets-scope-"));
  const evidenceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-evidence-scope-"));
  context.after(() => fs.rmSync(workspaceRoot, { recursive: true, force: true }));
  context.after(() => fs.rmSync(releaseAssetsRoot, { recursive: true, force: true }));
  context.after(() => fs.rmSync(evidenceRoot, { recursive: true, force: true }));
  for (const artifact of staticArtifacts) {
    const root = artifact.relativePath.startsWith("artifacts/")
      ? releaseAssetsRoot
      : workspaceRoot;
    writeFixture(root, artifact.relativePath);
  }
  writeFixture(releaseAssetsRoot, "artifacts/packages/package.nupkg");
  writeFixture(releaseAssetsRoot, "artifacts/releases/release.zip");
  writeFixture(releaseAssetsRoot,
    "docs/report-intake/2026-07-15/liquid-edge-research/report.md");
  writeFixture(releaseAssetsRoot,
    "docs/report-intake/2026-07-15/deeper-small-model-research/report.md");
  writeFixture(evidenceRoot, "receipts/qualification.json",
    JSON.stringify({ receiptType: "tinyrustlm.model-qualification" }));

  const scope = buildCampaignPublicArtifactScope({
    workspaceRoot,
    releaseAssetsRoot,
    evidenceRoot
  });
  assert.ok(scope.some((artifact) => artifact.label === "packages/package.nupkg" &&
    artifact.path.startsWith(releaseAssetsRoot)));
  assert.ok(scope.some((artifact) => artifact.label === "releases/release.zip" &&
    artifact.path.startsWith(releaseAssetsRoot)));
  assert.ok(scope.some((artifact) =>
    artifact.label.startsWith("research/deeper-small-model/") &&
    artifact.path.startsWith(releaseAssetsRoot)));
  const generatedArtifact = staticArtifacts.find((artifact) =>
    artifact.relativePath.startsWith("artifacts/"));
  const sourceArtifact = staticArtifacts.find((artifact) =>
    !artifact.relativePath.startsWith("artifacts/"));
  assert.ok(scope.some((artifact) =>
    artifact.label === generatedArtifact.label && artifact.path.startsWith(releaseAssetsRoot)));
  assert.ok(scope.some((artifact) =>
    artifact.label === sourceArtifact.label && artifact.path.startsWith(workspaceRoot)));
});

test("rejects a missing external evidence root", (context) => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-owned-workspace-"));
  context.after(() => fs.rmSync(workspaceRoot, { recursive: true, force: true }));
  assert.throws(() => buildCampaignPublicArtifactScope({
    workspaceRoot,
    evidenceRoot: path.join(os.tmpdir(), "outside-evidence")
  }), /campaign evidence root is missing or unsafe/);
});
