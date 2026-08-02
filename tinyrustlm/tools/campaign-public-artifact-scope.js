"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { canonicalJson } = require("./campaign-evidence-store.js");
const { scanPublicArtifacts } = require("./public-evidence-secret-scan.js");

const scopeKind = "campaign-public-release";
const maximumScopeFiles = 4096;
const maximumDerivedJsonBytes = 16 * 1024 * 1024;
const scopeDerivedReceiptTypes = new Set([
  "tinyrustlm.final-release-attestation-v1",
  "tinyrustlm.release-attestation-verification-v1",
  "tinyrustlm.secret-scan-v1",
  "tinyrustlm.secret-scan-v2"
]);
const scopeDerivedSchemas = new Set([
  "tinyrustlm.campaign_final_attestation.v1",
  "tinyrustlm.public_artifact_secret_scan.v2"
]);

const staticArtifacts = Object.freeze([
  ["reports/qwen3-0.6b-topk-pilot-v1-assessment.md",
    "artifacts/reports/qwen3-0.6b-topk-pilot-v1-assessment.md"],
  ["reports/tinyrustlm-lfm2-350m-source-screen-memory-2026-07-26.md",
    "wiki/runtime-mirust/reports/tinyrustlm-lfm2-350m-source-screen-memory-2026-07-26.md"],
  ["reports/tinyrustlm-lfm2.5-1.2b-instruct-source-screen-memory-2026-07-15.md",
    "wiki/runtime-mirust/reports/tinyrustlm-lfm2.5-1.2b-instruct-source-screen-memory-2026-07-15.md"],
  ["reports/tinyrustlm-lfm2.5-1.2b-thinking-source-screen-memory-2026-07-18.md",
    "wiki/runtime-mirust/reports/tinyrustlm-lfm2.5-1.2b-thinking-source-screen-memory-2026-07-18.md"],
  ["reports/tinyrustlm-lfm2.5-350m-source-screen-memory-2026-07-15.md",
    "wiki/runtime-mirust/reports/tinyrustlm-lfm2.5-350m-source-screen-memory-2026-07-15.md"],
  ["reports/tinyrustlm-liquid-edge-research-intake-synthesis-2026-07-15.md",
    "wiki/runtime-mirust/reports/tinyrustlm-liquid-edge-research-intake-synthesis-2026-07-15.md"],
  ["reports/tinyrustlm-deeper-small-model-research-intake-synthesis-2026-07-15.md",
    "wiki/runtime-mirust/reports/tinyrustlm-deeper-small-model-research-intake-synthesis-2026-07-15.md"],
  ["reports/tinyrustlm-campaign-fault-injection-v1.json",
    "artifacts/reports/tinyrustlm-campaign-fault-injection-v1.json"],
  ["reports/tinyrustlm-nuget-package-audit.json",
    "artifacts/reports/tinyrustlm-nuget-package-audit.json"],
  ["reports/tinyrustlm-olmo-2-0425-1b-instruct-source-screen-memory-2026-07-15.md",
    "wiki/runtime-mirust/reports/tinyrustlm-olmo-2-0425-1b-instruct-source-screen-memory-2026-07-15.md"],
  ["reports/tinyrustlm-public-doc-sites-audit.json",
    "artifacts/reports/tinyrustlm-public-doc-sites-audit.json"],
  ["reports/tinyrustlm-public-root-verification.json",
    "artifacts/reports/tinyrustlm-public-root-verification.json"],
  ["reports/tinyrustlm-gemma-3-270m-it-source-preflight-memory-2026-07-16.md",
    "wiki/runtime-mirust/reports/tinyrustlm-gemma-3-270m-it-source-preflight-memory-2026-07-16.md"],
  ["reports/tinyrustlm-llama-3.2-1b-instruct-source-preflight-memory-2026-07-16.md",
    "wiki/runtime-mirust/reports/tinyrustlm-llama-3.2-1b-instruct-source-preflight-memory-2026-07-16.md"],
  ["reports/tinyrustlm-minicpm4-0.5b-source-preflight-memory-2026-07-16.md",
    "wiki/runtime-mirust/reports/tinyrustlm-minicpm4-0.5b-source-preflight-memory-2026-07-16.md"],
  ["reports/tinyrustlm-amd-olmo-1b-sft-source-preflight-memory-2026-07-16.md",
    "wiki/runtime-mirust/reports/tinyrustlm-amd-olmo-1b-sft-source-preflight-memory-2026-07-16.md"],
  ["reports/tinyrustlm-openelm-1.1b-instruct-source-preflight-memory-2026-07-16.md",
    "wiki/runtime-mirust/reports/tinyrustlm-openelm-1.1b-instruct-source-preflight-memory-2026-07-16.md"],
  ["reports/tinyrustlm-granite-3.1-1b-a400m-instruct-source-screen-memory-2026-07-16.md",
    "wiki/runtime-mirust/reports/tinyrustlm-granite-3.1-1b-a400m-instruct-source-screen-memory-2026-07-16.md"],
  ["reports/tinyrustlm-granite-3.3-2b-instruct-source-screen-memory-2026-07-16.md",
    "wiki/runtime-mirust/reports/tinyrustlm-granite-3.3-2b-instruct-source-screen-memory-2026-07-16.md"],
  ["reports/tinyrustlm-granite-4.0-h-1b-source-screen-memory-2026-07-16.md",
    "wiki/runtime-mirust/reports/tinyrustlm-granite-4.0-h-1b-source-screen-memory-2026-07-16.md"],
  ["reports/tinyrustlm-falcon3-1b-instruct-source-screen-memory-2026-07-16.md",
    "wiki/runtime-mirust/reports/tinyrustlm-falcon3-1b-instruct-source-screen-memory-2026-07-16.md"],
  ["reports/tinyrustlm-falcon-e-1b-instruct-source-screen-memory-2026-07-16.md",
    "wiki/runtime-mirust/reports/tinyrustlm-falcon-e-1b-instruct-source-screen-memory-2026-07-16.md"],
  ["reports/tinyrustlm-falcon-h1-1.5b-instruct-source-screen-memory-2026-07-16.md",
    "wiki/runtime-mirust/reports/tinyrustlm-falcon-h1-1.5b-instruct-source-screen-memory-2026-07-16.md"],
  ["reports/tinyrustlm-stablelm-2-zephyr-1.6b-source-screen-memory-2026-07-16.md",
    "wiki/runtime-mirust/reports/tinyrustlm-stablelm-2-zephyr-1.6b-source-screen-memory-2026-07-16.md"],
  ["reports/tinyrustlm-bitnet-b1.58-2b4t-source-screen-memory-2026-07-16.md",
    "wiki/runtime-mirust/reports/tinyrustlm-bitnet-b1.58-2b4t-source-screen-memory-2026-07-16.md"],
  ["reports/tinyrustlm-h2o-danube2-1.8b-chat-source-screen-memory-2026-07-16.md",
    "wiki/runtime-mirust/reports/tinyrustlm-h2o-danube2-1.8b-chat-source-screen-memory-2026-07-16.md"],
  ["reports/tinyrustlm-h2o-danube3-500m-chat-source-screen-memory-2026-07-16.md",
    "wiki/runtime-mirust/reports/tinyrustlm-h2o-danube3-500m-chat-source-screen-memory-2026-07-16.md"],
  ["reports/tinyrustlm-zamba2-1.2b-instruct-v2-source-screen-memory-2026-07-16.md",
    "wiki/runtime-mirust/reports/tinyrustlm-zamba2-1.2b-instruct-v2-source-screen-memory-2026-07-16.md"],
  ["reports/tinyrustlm-tinyllama-1.1b-chat-v1-source-screen-memory-2026-07-16.md",
    "wiki/runtime-mirust/reports/tinyrustlm-tinyllama-1.1b-chat-v1-source-screen-memory-2026-07-16.md"],
  ["reports/tinyrustlm-deepseek-r1-distill-qwen-1.5b-source-screen-memory-2026-07-16.md",
    "wiki/runtime-mirust/reports/tinyrustlm-deepseek-r1-distill-qwen-1.5b-source-screen-memory-2026-07-16.md"],
  ["reports/tinyrustlm-qwen2.5-0.5b-instruct-source-screen-memory-2026-07-26.md",
    "wiki/runtime-mirust/reports/tinyrustlm-qwen2.5-0.5b-instruct-source-screen-memory-2026-07-26.md"],
  ["reports/tinyrustlm-qwen2.5-1.5b-instruct-source-screen-memory-2026-07-16.md",
    "wiki/runtime-mirust/reports/tinyrustlm-qwen2.5-1.5b-instruct-source-screen-memory-2026-07-16.md"],
  ["reports/tinyrustlm-qwen3-1.7b-source-screen-memory-2026-07-16.md",
    "wiki/runtime-mirust/reports/tinyrustlm-qwen3-1.7b-source-screen-memory-2026-07-16.md"],
  ["reports/tinyrustlm-qwen3.5-0.8b-source-screen-memory-2026-07-15.md",
    "wiki/runtime-mirust/reports/tinyrustlm-qwen3.5-0.8b-source-screen-memory-2026-07-15.md"],
  ["reports/tinyrustlm-qwen3.5-2b-source-screen-memory-2026-07-16.md",
    "wiki/runtime-mirust/reports/tinyrustlm-qwen3.5-2b-source-screen-memory-2026-07-16.md"],
  ["reports/tinyrustlm-smollm-1.7b-instruct-source-screen-memory-2026-07-16.md",
    "wiki/runtime-mirust/reports/tinyrustlm-smollm-1.7b-instruct-source-screen-memory-2026-07-16.md"],
  ["reports/tinyrustlm-apertus-v1.1-1.5b-instruct-source-screen-memory-2026-07-16.md",
    "wiki/runtime-mirust/reports/tinyrustlm-apertus-v1.1-1.5b-instruct-source-screen-memory-2026-07-16.md"],
  ["reports/tinyrustlm-croissantllmchat-v0.1-source-screen-memory-2026-07-18.md",
    "wiki/runtime-mirust/reports/tinyrustlm-croissantllmchat-v0.1-source-screen-memory-2026-07-18.md"],
  ["reports/tinyrustlm-eurollm-1.7b-instruct-source-preflight-memory-2026-07-18.md",
    "wiki/runtime-mirust/reports/tinyrustlm-eurollm-1.7b-instruct-source-preflight-memory-2026-07-18.md"],
  ["reports/tinyrustlm-zainbhat-qwen3-0.6b-finetome-lora-merged-source-preflight-memory-2026-07-18.md",
    "wiki/runtime-mirust/reports/tinyrustlm-zainbhat-qwen3-0.6b-finetome-lora-merged-source-preflight-memory-2026-07-18.md"],
  ["reports/tinyrustlm-hiep-2-qwen3-0.6b-math-cpt-sft-source-preflight-memory-2026-07-18.md",
    "wiki/runtime-mirust/reports/tinyrustlm-hiep-2-qwen3-0.6b-math-cpt-sft-source-preflight-memory-2026-07-18.md"],
  ["reports/tinyrustlm-huihui-ai-qwen2.5-1.5b-instruct-abliterated-sft-source-preflight-memory-2026-07-18.md",
    "wiki/runtime-mirust/reports/tinyrustlm-huihui-ai-qwen2.5-1.5b-instruct-abliterated-sft-source-preflight-memory-2026-07-18.md"],
  ["reports/tinyrustlm-seed-host-release-verification-0.1.10.json",
    "artifacts/reports/tinyrustlm-seed-host-release-verification-0.1.10.json"],
  ["experiments/task-specialists/planning-constraint-ledger-qwen25-05b-case-manifest.v1.json",
    "tinyrustlm/experiments/task-specialists/planning-constraint-ledger-qwen25-05b-case-manifest.v1.json"],
  ["experiments/task-specialists/planning-constraint-ledger-qwen25-05b-source-screen-preregistration.v1.json",
    "tinyrustlm/experiments/task-specialists/planning-constraint-ledger-qwen25-05b-source-screen-preregistration.v1.json"],
  ["experiments/task-specialists/planning-constraint-ledger-qwen25-05b-source-screen-observation.v1.json",
    "tinyrustlm/experiments/task-specialists/planning-constraint-ledger-qwen25-05b-source-screen-observation.v1.json"],
  ["experiments/task-specialists/planning-constraint-ledger-qwen25-15b-case-manifest.v1.json",
    "tinyrustlm/experiments/task-specialists/planning-constraint-ledger-qwen25-15b-case-manifest.v1.json"],
  ["experiments/task-specialists/planning-constraint-ledger-qwen25-15b-source-screen-preregistration.v2.json",
    "tinyrustlm/experiments/task-specialists/planning-constraint-ledger-qwen25-15b-source-screen-preregistration.v2.json"],
  ["experiments/task-specialists/planning-constraint-ledger-qwen25-15b-source-screen-observation.v2.json",
    "tinyrustlm/experiments/task-specialists/planning-constraint-ledger-qwen25-15b-source-screen-observation.v2.json"],
  ["experiments/task-specialists/planning-constraint-ledger-lfm2-350m-case-manifest.v1.json",
    "tinyrustlm/experiments/task-specialists/planning-constraint-ledger-lfm2-350m-case-manifest.v1.json"],
  ["experiments/task-specialists/planning-constraint-ledger-lfm2-350m-source-screen-preregistration.v2.json",
    "tinyrustlm/experiments/task-specialists/planning-constraint-ledger-lfm2-350m-source-screen-preregistration.v2.json"],
  ["experiments/task-specialists/planning-constraint-ledger-lfm2-350m-source-screen-observation.v2.json",
    "tinyrustlm/experiments/task-specialists/planning-constraint-ledger-lfm2-350m-source-screen-observation.v2.json"],
  ["experiments/task-specialists/planning-constraint-ledger-qwen3-17b-case-manifest.v1.json",
    "tinyrustlm/experiments/task-specialists/planning-constraint-ledger-qwen3-17b-case-manifest.v1.json"],
  ["experiments/task-specialists/planning-constraint-ledger-qwen3-17b-source-screen-preregistration.v3.json",
    "tinyrustlm/experiments/task-specialists/planning-constraint-ledger-qwen3-17b-source-screen-preregistration.v3.json"],
  ["experiments/task-specialists/planning-constraint-ledger-qwen3-17b-source-screen-observation.v3.json",
    "tinyrustlm/experiments/task-specialists/planning-constraint-ledger-qwen3-17b-source-screen-observation.v3.json"],
  ["experiments/task-specialists/planning-constraint-ledger-qwen3-06b-case-manifest.v2.json",
    "tinyrustlm/experiments/task-specialists/planning-constraint-ledger-qwen3-06b-case-manifest.v2.json"],
  ["experiments/task-specialists/planning-constraint-ledger-qwen3-06b-source-screen-preregistration.v4.json",
    "tinyrustlm/experiments/task-specialists/planning-constraint-ledger-qwen3-06b-source-screen-preregistration.v4.json"],
  ["experiments/task-specialists/planning-constraint-ledger-qwen3-06b-source-screen-observation.v4.json",
    "tinyrustlm/experiments/task-specialists/planning-constraint-ledger-qwen3-06b-source-screen-observation.v4.json"],
  ["experiments/task-specialists/planning-constraint-ledger-exclusion-set.v1.json",
    "tinyrustlm/experiments/task-specialists/planning-constraint-ledger-exclusion-set.v1.json"],
  ["experiments/task-specialists/code-diagnostic-ledger-exclusion-set.v1.json",
    "tinyrustlm/experiments/task-specialists/code-diagnostic-ledger-exclusion-set.v1.json"],
  ["training/lfm2.5-1.2b-instruct-source-screen-v1/assessment-control-v1.json",
    "tinyrustlm/training/lfm2.5-1.2b-instruct-source-screen-v1/assessment-control-v1.json"],
  ["training/lfm2-350m-source-screen-v1/assessment-control-v1.json",
    "tinyrustlm/training/lfm2-350m-source-screen-v1/assessment-control-v1.json"],
  ["training/lfm2.5-1.2b-thinking-source-screen-v1/assessment-control-v1.json",
    "tinyrustlm/training/lfm2.5-1.2b-thinking-source-screen-v1/assessment-control-v1.json"],
  ["training/lfm2.5-350m-source-screen-v1/assessment-control-v1.json",
    "tinyrustlm/training/lfm2.5-350m-source-screen-v1/assessment-control-v1.json"],
  ["training/gemma-3-270m-it-source-preflight-v1/assessment-control-v1.json",
    "tinyrustlm/training/gemma-3-270m-it-source-preflight-v1/assessment-control-v1.json"],
  ["training/llama-3.2-1b-instruct-source-preflight-v1/assessment-control-v1.json",
    "tinyrustlm/training/llama-3.2-1b-instruct-source-preflight-v1/assessment-control-v1.json"],
  ["training/minicpm4-0.5b-source-preflight-v1/assessment-control-v1.json",
    "tinyrustlm/training/minicpm4-0.5b-source-preflight-v1/assessment-control-v1.json"],
  ["training/amd-olmo-1b-sft-source-preflight-v1/assessment-control-v1.json",
    "tinyrustlm/training/amd-olmo-1b-sft-source-preflight-v1/assessment-control-v1.json"],
  ["training/openelm-1.1b-instruct-source-preflight-v1/assessment-control-v1.json",
    "tinyrustlm/training/openelm-1.1b-instruct-source-preflight-v1/assessment-control-v1.json"],
  ["training/granite-3.1-1b-a400m-instruct-source-screen-v1/assessment-control-v1.json",
    "tinyrustlm/training/granite-3.1-1b-a400m-instruct-source-screen-v1/assessment-control-v1.json"],
  ["training/granite-3.3-2b-instruct-source-screen-v1/assessment-control-v1.json",
    "tinyrustlm/training/granite-3.3-2b-instruct-source-screen-v1/assessment-control-v1.json"],
  ["training/granite-4.0-1b-source-screen-v1/assessment-control-v1.json",
    "tinyrustlm/training/granite-4.0-1b-source-screen-v1/assessment-control-v1.json"],
  ["training/granite-4.0-h-1b-source-screen-v1/assessment-control-v1.json",
    "tinyrustlm/training/granite-4.0-h-1b-source-screen-v1/assessment-control-v1.json"],
  ["training/falcon3-1b-instruct-source-screen-v1/assessment-control-v1.json",
    "tinyrustlm/training/falcon3-1b-instruct-source-screen-v1/assessment-control-v1.json"],
  ["training/falcon-e-1b-instruct-source-screen-v1/assessment-control-v1.json",
    "tinyrustlm/training/falcon-e-1b-instruct-source-screen-v1/assessment-control-v1.json"],
  ["training/falcon-h1-1.5b-instruct-source-screen-v1/assessment-control-v1.json",
    "tinyrustlm/training/falcon-h1-1.5b-instruct-source-screen-v1/assessment-control-v1.json"],
  ["training/stablelm-2-zephyr-1.6b-source-screen-v1/assessment-control-v1.json",
    "tinyrustlm/training/stablelm-2-zephyr-1.6b-source-screen-v1/assessment-control-v1.json"],
  ["training/bitnet-b1.58-2b4t-source-screen-v1/assessment-control-v1.json",
    "tinyrustlm/training/bitnet-b1.58-2b4t-source-screen-v1/assessment-control-v1.json"],
  ["training/h2o-danube2-1.8b-chat-source-screen-v1/assessment-control-v1.json",
    "tinyrustlm/training/h2o-danube2-1.8b-chat-source-screen-v1/assessment-control-v1.json"],
  ["training/h2o-danube3-500m-chat-source-screen-v1/assessment-control-v1.json",
    "tinyrustlm/training/h2o-danube3-500m-chat-source-screen-v1/assessment-control-v1.json"],
  ["training/zamba2-1.2b-instruct-v2-source-screen-v1/assessment-control-v1.json",
    "tinyrustlm/training/zamba2-1.2b-instruct-v2-source-screen-v1/assessment-control-v1.json"],
  ["training/tinyllama-1.1b-chat-v1-source-screen-v1/assessment-control-v1.json",
    "tinyrustlm/training/tinyllama-1.1b-chat-v1-source-screen-v1/assessment-control-v1.json"],
  ["training/deepseek-r1-distill-qwen-1.5b-source-screen-v1/assessment-control-v1.json",
    "tinyrustlm/training/deepseek-r1-distill-qwen-1.5b-source-screen-v1/assessment-control-v1.json"],
  ["training/qwen2.5-0.5b-instruct-source-screen-v1/assessment-control-v1.json",
    "tinyrustlm/training/qwen2.5-0.5b-instruct-source-screen-v1/assessment-control-v1.json"],
  ["training/qwen2.5-1.5b-instruct-source-screen-v1/assessment-control-v1.json",
    "tinyrustlm/training/qwen2.5-1.5b-instruct-source-screen-v1/assessment-control-v1.json"],
  ["training/olmo-2-0425-1b-instruct-source-screen-v1/assessment-control-v1.json",
    "tinyrustlm/training/olmo-2-0425-1b-instruct-source-screen-v1/assessment-control-v1.json"],
  ["training/qwen3-1.7b-source-screen-v1/assessment-control-v1.json",
    "tinyrustlm/training/qwen3-1.7b-source-screen-v1/assessment-control-v1.json"],
  ["training/qwen3.5-0.8b-source-screen-v1/assessment-control-v1.json",
    "tinyrustlm/training/qwen3.5-0.8b-source-screen-v1/assessment-control-v1.json"],
  ["training/qwen3.5-2b-source-screen-v1/assessment-control-v1.json",
    "tinyrustlm/training/qwen3.5-2b-source-screen-v1/assessment-control-v1.json"],
  ["training/smollm2-1.7b-instruct-source-screen-v1/assessment-control-v1.json",
    "tinyrustlm/training/smollm2-1.7b-instruct-source-screen-v1/assessment-control-v1.json"],
  ["training/smollm-1.7b-instruct-source-screen-v1/assessment-control-v1.json",
    "tinyrustlm/training/smollm-1.7b-instruct-source-screen-v1/assessment-control-v1.json"],
  ["training/apertus-v1.1-1.5b-instruct-source-screen-v1/assessment-control-v1.json",
    "tinyrustlm/training/apertus-v1.1-1.5b-instruct-source-screen-v1/assessment-control-v1.json"],
  ["training/croissantllmchat-v0.1-source-screen-v1/assessment-control-v1.json",
    "tinyrustlm/training/croissantllmchat-v0.1-source-screen-v1/assessment-control-v1.json"],
  ["training/eurollm-1.7b-instruct-source-preflight-v2/assessment-control-v2.json",
    "tinyrustlm/training/eurollm-1.7b-instruct-source-preflight-v2/assessment-control-v2.json"],
  ["training/zainbhat-qwen3-0.6b-finetome-lora-merged-source-preflight-v2/assessment-control-v2.json",
    "tinyrustlm/training/zainbhat-qwen3-0.6b-finetome-lora-merged-source-preflight-v2/assessment-control-v2.json"],
  ["training/hiep-2-qwen3-0.6b-math-cpt-sft-source-preflight-v2/assessment-control-v2.json",
    "tinyrustlm/training/hiep-2-qwen3-0.6b-math-cpt-sft-source-preflight-v2/assessment-control-v2.json"],
  ["training/huihui-ai-qwen2.5-1.5b-instruct-abliterated-sft-source-preflight-v2/assessment-control-v2.json",
    "tinyrustlm/training/huihui-ai-qwen2.5-1.5b-instruct-abliterated-sft-source-preflight-v2/assessment-control-v2.json"],
  ["web/.htaccess", "tinyrustlm/.htaccess"],
  ["web/app/active-conversation.js", "tinyrustlm/app/active-conversation.js"],
  ["web/app/app.css", "tinyrustlm/app/app.css"],
  ["web/app/app.js", "tinyrustlm/app/app.js"],
  ["web/app/browser-model-admission.js", "tinyrustlm/app/browser-model-admission.js"],
  ["web/app/calculator-tool.js", "tinyrustlm/app/calculator-tool.js"],
  ["web/app/companion-bridge.js", "tinyrustlm/app/companion-bridge.js"],
  ["web/app/index.html", "tinyrustlm/app/index.html"],
  ["web/app/site-release.js", "tinyrustlm/app/site-release.js"],
  ["web/app/memory-endpoints-distributed-sync-v1.js",
    "tinyrustlm/app/memory-endpoints-distributed-sync-v1.js"],
  ["web/app/memory-endpoints-enrollment.js",
    "tinyrustlm/app/memory-endpoints-enrollment.js"],
  ["web/app/memory-endpoints-sync.js", "tinyrustlm/app/memory-endpoints-sync.js"],
  ["web/app/minimodel-announcement.js", "tinyrustlm/app/minimodel-announcement.js"],
  ["web/deploy/memory-endpoints-relay-worker.js",
    "tinyrustlm/deploy/memory-endpoints-relay-worker.js"],
  ["web/deploy/web-deployment-manifest.v2.json",
    "tinyrustlm/deploy/web-deployment-manifest.v2.json"],
  ["web/index.html", "tinyrustlm/index.html"],
  ["web/release/site-release-ledger.v1.json",
    "tinyrustlm/release/site-release-ledger.v1.json"],
  ["web/runtime/tinyrustlm-simd.wasm", "tinyrustlm/runtime/tinyrustlm-simd.wasm"],
  ["web/runtime/tinyrustlm.wasm", "tinyrustlm/runtime/tinyrustlm.wasm"],
  ["web/updates/index.html", "tinyrustlm/updates/index.html"],
  ["web/updates/updates.css", "tinyrustlm/updates/updates.css"],
  ["control-plane/campaign-evidence-dashboard.js",
    "tinyrustlm/tools/campaign-evidence-dashboard.js"],
  ["control-plane/campaign-final-attestation.js",
    "tinyrustlm/tools/campaign-final-attestation.js"],
  ["control-plane/campaign-release-authorization-evidence.js",
    "tinyrustlm/tools/campaign-release-authorization-evidence.js"],
  ["control-plane/campaign-remaining-risks.v1.json",
    "tinyrustlm/campaign-remaining-risks.v1.json"],
  ["control-plane/campaign-browser-fault-scenarios.js",
    "tinyrustlm/tools/campaign-browser-fault-scenarios.js"],
  ["control-plane/campaign-package-fault-scenarios.js",
    "tinyrustlm/tools/campaign-package-fault-scenarios.js"],
  ["control-plane/campaign-fault-injection.js",
    "tinyrustlm/tools/campaign-fault-injection.js"],
  ["control-plane/campaign-host-restart-fault-scenarios.js",
    "tinyrustlm/tools/campaign-host-restart-fault-scenarios.js"],
  ["control-plane/campaign-fault-plan.v1.json",
    "tinyrustlm/campaign-fault-plan.v1.json"],
  ["control-plane/campaign-evidence-store.js",
    "tinyrustlm/tools/campaign-evidence-store.js"],
  ["control-plane/campaign-lifecycle.js", "tinyrustlm/tools/campaign-lifecycle.js"],
  ["control-plane/owned-browser-profile.js", "tinyrustlm/tools/owned-browser-profile.js"],
  ["control-plane/package-lock.json", "tinyrustlm/package-lock.json"],
  ["control-plane/package.json", "tinyrustlm/package.json"],
  ["control-plane/campaign-public-evidence.js",
    "tinyrustlm/tools/campaign-public-evidence.js"],
  ["control-plane/campaign-public-artifact-scope.js",
    "tinyrustlm/tools/campaign-public-artifact-scope.js"],
  ["control-plane/campaign-public-readback-evidence.js",
    "tinyrustlm/tools/campaign-public-readback-evidence.js"],
  ["control-plane/campaign-release-evidence.js",
    "tinyrustlm/tools/campaign-release-evidence.js"],
  ["control-plane/catalog-announcement-evidence.js",
    "tinyrustlm/tools/catalog-announcement-evidence.js"],
  ["control-plane/p2p-outside-proof-evidence.js",
    "tinyrustlm/tools/p2p-outside-proof-evidence.js"],
  ["control-plane/durable-files.js", "tinyrustlm/tools/durable-files.js"],
  ["control-plane/model-qualification-runner.js",
    "tinyrustlm/tools/model-qualification-runner.js"],
  ["control-plane/reference-raw-quality.py",
    "tinyrustlm/tools/reference-raw-quality.py"],
  ["control-plane/build-source-logit-golden.py",
    "tinyrustlm/tools/build-source-logit-golden.py"],
  ["control-plane/source-model-screen-evidence.js",
    "tinyrustlm/tools/source-model-screen-evidence.js"],
  ["control-plane/source-model-preflight-evidence.js",
    "tinyrustlm/tools/source-model-preflight-evidence.js"],
  ["control-plane/task-specialist-case-generator.js",
    "tinyrustlm/tools/task-specialist-case-generator.js"],
  ["control-plane/task-specialist-case-generator-v2.js",
    "tinyrustlm/tools/task-specialist-case-generator-v2.js"],
  ["control-plane/task-specialist-source-screen-v1.js",
    "tinyrustlm/tools/task-specialist-source-screen.js"],
  ["control-plane/task-specialist-source-screen-v2.js",
    "tinyrustlm/tools/task-specialist-source-screen-v2.js"],
  ["control-plane/task-specialist-source-screen-v3.js",
    "tinyrustlm/tools/task-specialist-source-screen-v3.js"],
  ["control-plane/task-specialist-source-screen-v4.js",
    "tinyrustlm/tools/task-specialist-source-screen-v4.js"],
  ["control-plane/code-diagnostic-case-generator-v1.js",
    "tinyrustlm/tools/code-diagnostic-case-generator-v1.js"],
  ["control-plane/code-diagnostic-source-screen-v1.js",
    "tinyrustlm/tools/code-diagnostic-source-screen-v1.js"],
  ["control-plane/public-evidence-secret-scan.js",
    "tinyrustlm/tools/public-evidence-secret-scan.js"],
  ["control-plane/static-shell-parity.js",
    "tinyrustlm/tools/static-shell-parity.js"],
  ["control-plane/static-server.js",
    "tinyrustlm/tools/static-server.js"],
  ["control-plane/site-release-contract.js",
    "tinyrustlm/tools/site-release-contract.js"],
  ["control-plane/site-release-page.js",
    "tinyrustlm/tools/site-release-page.js"],
  ["control-plane/immutable-publication-files.js",
    "tinyrustlm/tools/immutable-publication-files.js"],
  ["control-plane/web-deployment-manifest.js",
    "tinyrustlm/tools/web-deployment-manifest.js"],
  ["control-plane/web-release-secret-scan.js",
    "tinyrustlm/tools/web-release-secret-scan.js"],
  ["control-plane/web-release-browser-smoke.js",
    "tinyrustlm/tools/web-release-browser-smoke.js"],
  ["control-plane/web-release-local-smoke.js",
    "tinyrustlm/tools/web-release-local-smoke.js"],
  ["control-plane/deploy-tinyrustlm-web.ps1",
    "tinyrustlm/tools/deploy-tinyrustlm-web.ps1"],
  ["control-plane/dogfood-campaign-control-plane.md",
    "docs/architecture/dogfood-campaign-control-plane.md"],
  ["control-plane/dogfood-campaign-final-attestation.md",
    "docs/architecture/dogfood-campaign-final-attestation.md"],
  ["docs/site-release-record-v1.md",
    "tinyrustlm/docs/site-release-record-v1.md"]
].map(([label, relativePath]) => Object.freeze({ label, relativePath })));

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function containedPath(rootPath, candidatePath) {
  const root = path.resolve(rootPath);
  const candidate = path.resolve(candidatePath);
  const relative = path.relative(root, candidate);
  invariant(relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative),
    "campaign public artifact path escapes its owned root");
  return candidate;
}

function requireRegularFile(rootPath, relativePath) {
  const filePath = containedPath(rootPath, path.join(rootPath, relativePath));
  const stat = fs.lstatSync(filePath, { throwIfNoEntry: false });
  invariant(stat?.isFile() && !stat.isSymbolicLink(),
    `campaign public artifact is missing or unsafe: ${relativePath}`);
  return filePath;
}

function walkRegularFiles(rootPath, include = () => true) {
  const root = path.resolve(rootPath);
  const rootStat = fs.lstatSync(root, { throwIfNoEntry: false });
  invariant(rootStat?.isDirectory() && !rootStat.isSymbolicLink(),
    "campaign public artifact directory is missing or unsafe");
  const files = [];
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = containedPath(root, path.join(current, entry.name));
      invariant(!entry.isSymbolicLink(), "campaign public artifact scope contains a symbolic link");
      if (entry.isDirectory()) pending.push(target);
      else if (entry.isFile()) {
        if (include(target)) files.push(target);
      } else invariant(false, "campaign public artifact scope contains an unsupported file type");
    }
  }
  return files.sort();
}

function isScopeDerivedArtifact(filePath) {
  const stat = fs.statSync(filePath);
  if (stat.size <= 0 || stat.size > maximumDerivedJsonBytes ||
      path.extname(filePath) !== ".json") {
    return false;
  }
  try {
    const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return scopeDerivedReceiptTypes.has(value?.receiptType) ||
      scopeDerivedSchemas.has(value?.schema) ||
      /^tinyrustlm\.dogfood_campaign_dashboard\.v\d+$/u.test(String(value?.schema || ""));
  } catch {
    return false;
  }
}

function evidenceArtifactIncluded(evidenceRoot, filePath) {
  const relative = path.relative(evidenceRoot, filePath).split(path.sep).join("/");
  if (relative === "campaign-status.json" ||
      relative.startsWith("dashboard-snapshots/") ||
      relative === "final-attestation.json" ||
      relative.startsWith("final-attestation-snapshots/")) {
    return false;
  }
  return !isScopeDerivedArtifact(filePath);
}

function requirePlainDirectory(directoryPath, label) {
  const resolved = path.resolve(String(directoryPath || ""));
  const stat = fs.lstatSync(resolved, { throwIfNoEntry: false });
  invariant(stat?.isDirectory() && !stat.isSymbolicLink(),
    `${label} is missing or unsafe`);
  return fs.realpathSync.native(resolved);
}

function addArtifact(artifacts, labels, label, filePath) {
  invariant(/^[A-Za-z0-9][A-Za-z0-9._/+:-]{0,255}$/.test(label),
    `campaign public artifact label is invalid: ${label}`);
  invariant(!labels.has(label), `campaign public artifact label is duplicated: ${label}`);
  labels.add(label);
  artifacts.push(Object.freeze({ label, path: filePath }));
}

function addTree(artifacts, labels, rootPath, labelPrefix, include) {
  for (const filePath of walkRegularFiles(rootPath, include)) {
    const relative = path.relative(rootPath, filePath).split(path.sep).join("/");
    addArtifact(artifacts, labels, `${labelPrefix}/${relative}`, filePath);
  }
}

function addDirectFiles(artifacts, labels, rootPath, labelPrefix) {
  const root = path.resolve(rootPath);
  const stat = fs.lstatSync(root, { throwIfNoEntry: false });
  invariant(stat?.isDirectory() && !stat.isSymbolicLink(),
    `campaign public artifact directory is missing: ${labelPrefix}`);
  for (const entry of fs.readdirSync(root, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name))) {
    if (!entry.isFile()) continue;
    addArtifact(artifacts, labels, `${labelPrefix}/${entry.name}`,
      requireRegularFile(root, entry.name));
  }
}

function researchLabel(filePath, index) {
  const name = path.basename(filePath);
  if (name === "2026-07-15-six-disconnected-liquid-and-edge-model-research-prompts.md") {
    return `research/${name}`;
  }
  if (name === "MANIFEST.md") return "research/liquid-edge-manifest-2026-07-15.md";
  if (name === "tinyrustlm-liquid-edge-research-intake-tdd-delta-2026-07-15.md") {
    return "research/liquid-edge-tdd-delta-2026-07-15.md";
  }
  const extension = path.extname(name).toLowerCase() || ".txt";
  return `research/item-${String(index + 1).padStart(2, "0")}-${sha256(name).slice(0, 12)}${extension}`;
}

function deeperResearchLabel(filePath, index) {
  const name = path.basename(filePath);
  const prefix = "research/deeper-small-model";
  if (name === "2026-07-15-six-disconnected-deeper-small-model-research-prompts.md") {
    return `${prefix}/${name}`;
  }
  if (name === "MANIFEST.md") return `${prefix}/manifest-2026-07-15.md`;
  if (name === "tinyrustlm-deeper-small-model-research-intake-synthesis-2026-07-15.md") {
    return `${prefix}/synthesis-2026-07-15.md`;
  }
  if (name === "tinyrustlm-deeper-small-model-research-intake-tdd-delta-2026-07-15.md") {
    return `${prefix}/tdd-delta-2026-07-15.md`;
  }
  const extension = path.extname(name).toLowerCase() || ".txt";
  return `${prefix}/item-${String(index + 1).padStart(2, "0")}-${sha256(name).slice(0, 12)}${extension}`;
}

function buildCampaignPublicArtifactScope(options) {
  invariant(options && typeof options === "object" && !Array.isArray(options),
    "campaign public artifact scope options are invalid");
  const workspaceRoot = requirePlainDirectory(
    options.workspaceRoot || path.resolve(__dirname, "../.."), "campaign workspace root");
  const evidenceRoot = requirePlainDirectory(options.evidenceRoot, "campaign evidence root");
  const releaseAssetsRoot = requirePlainDirectory(
    options.releaseAssetsRoot || workspaceRoot, "campaign release-assets root");
  const artifacts = [];
  const labels = new Set();

  addTree(artifacts, labels, evidenceRoot, "campaign",
    (filePath) => evidenceArtifactIncluded(evidenceRoot, filePath));
  addDirectFiles(artifacts, labels,
    path.join(releaseAssetsRoot, "artifacts", "packages"), "packages");
  addDirectFiles(artifacts, labels,
    path.join(releaseAssetsRoot, "artifacts", "releases"), "releases");
  for (const artifact of staticArtifacts) {
    const artifactRoot = artifact.relativePath.startsWith("artifacts/")
      ? releaseAssetsRoot
      : workspaceRoot;
    addArtifact(artifacts, labels, artifact.label,
      requireRegularFile(artifactRoot, artifact.relativePath));
  }

  const researchRoot = path.join(releaseAssetsRoot, "docs", "report-intake", "2026-07-15",
    "liquid-edge-research");
  for (const [index, filePath] of walkRegularFiles(researchRoot).entries()) {
    addArtifact(artifacts, labels, researchLabel(filePath, index), filePath);
  }
  const deeperResearchRoot = path.join(releaseAssetsRoot, "docs", "report-intake", "2026-07-15",
    "deeper-small-model-research");
  for (const [index, filePath] of walkRegularFiles(deeperResearchRoot).entries()) {
    addArtifact(artifacts, labels, deeperResearchLabel(filePath, index), filePath);
  }

  invariant(artifacts.length > 0 && artifacts.length <= maximumScopeFiles,
    "campaign public artifact scope count is invalid");
  return Object.freeze(artifacts.sort((left, right) => left.label.localeCompare(right.label)));
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  const handle = fs.openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    for (;;) {
      const count = fs.readSync(handle, buffer, 0, buffer.length, null);
      if (count === 0) break;
      hash.update(buffer.subarray(0, count));
    }
  } finally {
    fs.closeSync(handle);
  }
  return hash.digest("hex");
}

function buildCampaignPublicArtifactManifest(options) {
  const artifacts = buildCampaignPublicArtifactScope(options);
  const entries = artifacts.map((artifact) => {
    const stat = fs.statSync(artifact.path);
    return Object.freeze({
      byteCount: stat.size,
      label: artifact.label,
      sha256: sha256File(artifact.path)
    });
  });
  return Object.freeze({
    artifactCount: entries.length,
    entries: Object.freeze(entries),
    scopeKind,
    scopeManifestSha256: sha256(canonicalJson(entries))
  });
}

async function scanCampaignPublicArtifacts(options) {
  const artifacts = buildCampaignPublicArtifactScope(options);
  return scanPublicArtifacts({
    artifacts,
    campaignId: options.campaignId,
    completedAtUtc: options.completedAtUtc,
    evidenceRoot: options.evidenceRoot,
    knownSecrets: options.knownSecrets || [],
    reportOutputPath: options.reportOutputPath,
    scopeComplete: true,
    scopeKind,
    sourceRevision: options.sourceRevision,
    startedAtUtc: options.startedAtUtc
  });
}

function parseArguments(argv, workspaceRoot = path.resolve(__dirname, "../..")) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    invariant([
      "--campaign-id", "--evidence-root", "--release-assets-root", "--report-output",
      "--source-revision", "--workspace-root"
    ].includes(name), `unknown campaign scope argument: ${name}`);
    invariant(value !== undefined && !values.has(name),
      `campaign scope argument is missing or duplicated: ${name}`);
    values.set(name, value);
  }
  for (const name of ["--campaign-id", "--evidence-root", "--report-output", "--source-revision"]) {
    invariant(values.has(name), `missing campaign scope argument: ${name}`);
  }
  return Object.freeze({
    campaignId: values.get("--campaign-id"),
    evidenceRoot: path.resolve(values.get("--evidence-root")),
    releaseAssetsRoot: path.resolve(
      values.get("--release-assets-root") || values.get("--workspace-root") || workspaceRoot),
    reportOutputPath: path.resolve(values.get("--report-output")),
    sourceRevision: values.get("--source-revision"),
    workspaceRoot: path.resolve(values.get("--workspace-root") || workspaceRoot)
  });
}

async function main(argv) {
  const result = await scanCampaignPublicArtifacts(parseArguments(argv));
  process.stdout.write(`Secret scan ${result.report.status}: ` +
    `${result.report.scannedArtifactCount} artifacts, ` +
    `${result.report.secretFindingCount} findings, receipt ${result.receipt.receiptId}\n`);
  if (result.report.status !== "pass") process.exitCode = 1;
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`Campaign public artifact scan failed: ${error.message}\n`);
    process.exitCode = 2;
  });
}

module.exports = Object.freeze({
  buildCampaignPublicArtifactManifest,
  buildCampaignPublicArtifactScope,
  evidenceArtifactIncluded,
  scanCampaignPublicArtifacts,
  scopeKind,
  staticArtifacts
});
