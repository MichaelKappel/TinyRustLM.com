"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { CampaignEvidenceStore } = require("../tools/campaign-evidence-store.js");
const {
  recordSourceModelPreflight
} = require("../tools/source-model-preflight-evidence.js");

const digest = (value) => crypto.createHash("sha256").update(value).digest("hex");

function writeFixture(root, overrides = {}) {
  const artifactRoot = path.join(root, "private-source-review");
  fs.mkdirSync(artifactRoot, { recursive: true });
  const evidence = {
    "model-card.md": Buffer.from("license: custom\ngated: true\n"),
    "repository-tree.json": Buffer.from('{"files":{"model.safetensors":{"size":10}}}\n'),
    "terms.md.txt": Buffer.from("Custom distribution terms\n"),
    "tokenizer-config.json": Buffer.from('{"chat_template":null}\n'),
    "use-policy.md.txt": Buffer.from("Custom use restrictions\n")
  };
  for (const [name, bytes] of Object.entries(evidence)) {
    fs.writeFileSync(path.join(artifactRoot, name), bytes);
  }
  const observedAtUtc = "2026-07-16T17:00:00.000Z";
  const declarations = [
    ["model-card", "model-card.md", "https://example.test/model/card"],
    ["repository-tree", "repository-tree.json", "https://example.test/model/tree/revision"],
    ["terms-of-use", "terms.md.txt", "https://example.test/terms"],
    ["tokenizer-config", "tokenizer-config.json", "https://example.test/model/tokenizer-config"],
    ["use-policy", "use-policy.md.txt", "https://example.test/use-policy"]
  ].map(([kind, fileName, publicUrl]) => ({
    kind,
    fileName,
    byteCount: evidence[fileName].length,
    sha256: digest(evidence[fileName]),
    publicUrl,
    observedAtUtc
  }));
  const assessment = {
    schema: "tinyrustlm.source_model_preflight_assessment.v1",
    sourceModelId: "publisher/gated-model",
    sourceRevision: "a".repeat(40),
    decision: "rejected",
    decisionAuthority: "engineering-source-preflight-v1",
    architectureFamily: "public-card-declared-dense",
    runtimeAdmission: "not-assessed-preflight-rejected",
    accessDisposition: "gated-user-authorization-required",
    licenseId: "custom",
    licenseDisposition: "custom-license-product-policy-conflict",
    distributionDisposition: "p2p-redistribution-contract-incompatible",
    blockerCode: "candidate_source_policy_contract_rejected",
    rejectionCodes: [
      "custom-license-product-policy-conflict",
      "gated-acquisition-authorization-absent",
      "p2p-redistribution-contract-incompatible"
    ],
    missingRequiredArtifacts: [
      "config.json",
      "model.safetensors",
      "tokenizer.json"
    ],
    evidenceArtifacts: declarations,
    officialReferences: [
      "https://example.test/model/tree/revision",
      "https://example.test/terms",
      "https://example.test/use-policy"
    ],
    ...overrides
  };
  const assessmentPath = path.join(root, "assessment.json");
  fs.writeFileSync(assessmentPath, `${JSON.stringify(assessment, null, 2)}\n`);
  return { artifactRoot, assessmentPath };
}

function options(root, fixture) {
  return {
    campaignId: "source-preflight-test-20260716",
    evidenceRoot: path.join(root, "evidence"),
    startedAtUtc: "2026-07-16T17:01:00.000Z",
    completedAtUtc: "2026-07-16T17:02:00.000Z",
    ...fixture
  };
}

function bindAcquiredSource(root, fixture, overrides = {}) {
  const sourceArtifactRoot = path.join(root, "private-source");
  fs.mkdirSync(sourceArtifactRoot, { recursive: true });
  const modelBytes = Buffer.from("small deterministic safetensors fixture\n");
  fs.writeFileSync(path.join(sourceArtifactRoot, "model.safetensors"), modelBytes);

  const assessment = JSON.parse(fs.readFileSync(fixture.assessmentPath, "utf8"));
  assessment.schema = "tinyrustlm.source_model_preflight_assessment.v2";
  assessment.decisionAuthority = "engineering-source-preflight-v2";
  assessment.sourceAcquisitionStatus = "complete";
  assessment.sourceWeightArtifacts = [{
    fileName: "model.safetensors",
    byteCount: modelBytes.length,
    sha256: digest(modelBytes)
  }];
  Object.assign(assessment, overrides);
  fs.writeFileSync(fixture.assessmentPath, `${JSON.stringify(assessment, null, 2)}\n`);
  return { ...fixture, sourceArtifactRoot, modelBytes };
}

function writeProvenanceFixture(root, overrides = {}) {
  const fixture = writeFixture(root);
  const assessment = JSON.parse(fs.readFileSync(fixture.assessmentPath, "utf8"));
  const additions = {
    "config.json": Buffer.from('{"architectures":["Qwen3ForCausalLM"],"model_type":"qwen3"}\n'),
    "repository-metadata.json": Buffer.from(
      '{"cardData":{"license":"apache-2.0"},"gated":false,"private":false}\n')
  };
  for (const [name, bytes] of Object.entries(additions)) {
    fs.writeFileSync(path.join(fixture.artifactRoot, name), bytes);
  }
  const declarationsByKind = new Map(
    assessment.evidenceArtifacts.map((entry) => [entry.kind, entry]));
  declarationsByKind.set("config", {
    kind: "config",
    fileName: "config.json",
    byteCount: additions["config.json"].length,
    sha256: digest(additions["config.json"]),
    publicUrl: "https://example.test/model/config",
    observedAtUtc: "2026-07-18T18:00:00.000Z"
  });
  declarationsByKind.set("repository-metadata", {
    kind: "repository-metadata",
    fileName: "repository-metadata.json",
    byteCount: additions["repository-metadata.json"].length,
    sha256: digest(additions["repository-metadata.json"]),
    publicUrl: "https://example.test/model/revision-metadata",
    observedAtUtc: "2026-07-18T18:00:00.000Z"
  });
  assessment.schema = "tinyrustlm.source_model_preflight_assessment.v2";
  assessment.sourceModelId = "publisher/sparse-provenance-model";
  assessment.decisionAuthority = "engineering-source-preflight-v2";
  assessment.architectureFamily = "qwen3-dense-gqa-tied";
  assessment.runtimeAdmission = "not-assessed-preflight-rejected";
  assessment.accessDisposition = "public-ungated-metadata-only-no-source-acquisition";
  assessment.licenseId = "apache-2.0";
  assessment.licenseDisposition = "apache-2.0-card-declaration-review-required";
  assessment.distributionDisposition = "not-assessed-preflight-rejected";
  assessment.blockerCode = "candidate_source_provenance_contract_rejected";
  assessment.rejectionCodes = [
    "publisher-training-corpus-identity-absent",
    "publisher-training-recipe-identity-absent",
    "source-lineage-quantized-intermediate-only",
    "source-screen-provenance-contract-incomplete"
  ];
  assessment.missingRequiredArtifacts = [
    "model.safetensors",
    "training-corpus-manifest.json",
    "training-recipe.json"
  ];
  assessment.evidenceArtifacts = [...declarationsByKind.values()]
    .sort((left, right) => left.kind.localeCompare(right.kind));
  assessment.officialReferences = [
    "https://example.test/model/card",
    "https://example.test/model/revision-metadata",
    "https://example.test/model/tree/revision"
  ];
  assessment.sourceAcquisitionStatus = "not-acquired";
  assessment.sourceWeightArtifacts = [];
  Object.assign(assessment, overrides);
  fs.writeFileSync(fixture.assessmentPath, `${JSON.stringify(assessment, null, 2)}\n`);
  return fixture;
}

function writeUnpinnedLineageProvenanceFixture(root, overrides = {}) {
  const fixture = writeProvenanceFixture(root);
  const assessment = JSON.parse(fs.readFileSync(fixture.assessmentPath, "utf8"));
  const additions = {
    "dataset-metadata.json": Buffer.from(
      '{"id":"publisher/training-data","sha":"d'.concat("d".repeat(39), '"}\n')),
    "model-card.md": Buffer.from([
      "base_model: publisher/parent-1.5b",
      "datasets: publisher/training-data",
      "Parent: [publisher/parent-1.5b](https://example.test/publisher/parent-0.5b)",
      "Recipe: https://example.test/notebooks/main/generic-7b.ipynb",
      ""
    ].join("\n")),
    "parent-metadata.json": Buffer.from(
      '{"id":"publisher/parent-1.5b","sha":"e'.concat("e".repeat(39), '"}\n'))
  };
  for (const [name, bytes] of Object.entries(additions)) {
    fs.writeFileSync(path.join(fixture.artifactRoot, name), bytes);
  }
  const declarationsByKind = new Map(
    assessment.evidenceArtifacts.map((entry) => [entry.kind, entry]));
  declarationsByKind.set("dataset-metadata", {
    kind: "dataset-metadata",
    fileName: "dataset-metadata.json",
    byteCount: additions["dataset-metadata.json"].length,
    sha256: digest(additions["dataset-metadata.json"]),
    publicUrl: "https://example.test/datasets/training-data/revision/current",
    observedAtUtc: "2026-07-18T19:00:00.000Z"
  });
  declarationsByKind.set("model-card", {
    kind: "model-card",
    fileName: "model-card.md",
    byteCount: additions["model-card.md"].length,
    sha256: digest(additions["model-card.md"]),
    publicUrl: "https://example.test/model/card",
    observedAtUtc: "2026-07-18T19:00:00.000Z"
  });
  declarationsByKind.set("parent-metadata", {
    kind: "parent-metadata",
    fileName: "parent-metadata.json",
    byteCount: additions["parent-metadata.json"].length,
    sha256: digest(additions["parent-metadata.json"]),
    publicUrl: "https://example.test/models/parent-1.5b/revision/current",
    observedAtUtc: "2026-07-18T19:00:00.000Z"
  });
  assessment.sourceModelId = "publisher/unpinned-lineage-model";
  assessment.rejectionCodes = [
    "publisher-base-model-reference-conflicting",
    "publisher-base-model-revision-absent",
    "publisher-dataset-revision-absent",
    "publisher-training-recipe-identity-absent",
    "source-screen-provenance-contract-incomplete"
  ];
  assessment.evidenceArtifacts = [...declarationsByKind.values()]
    .sort((left, right) => left.kind.localeCompare(right.kind));
  assessment.officialReferences = [
    "https://example.test/datasets/training-data/revision/current",
    "https://example.test/model/card",
    "https://example.test/model/revision-metadata",
    "https://example.test/model/tree/revision",
    "https://example.test/models/parent-1.5b/revision/current"
  ];
  Object.assign(assessment, overrides);
  fs.writeFileSync(fixture.assessmentPath, `${JSON.stringify(assessment, null, 2)}\n`);
  return fixture;
}

test("records an idempotent terminal source preflight rejection without source bytes", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-preflight-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root);
  const first = recordSourceModelPreflight(options(root, fixture));
  const second = recordSourceModelPreflight(options(root, fixture));

  assert.equal(first.receipt.status, "rejected");
  assert.equal(first.receipt.receiptType, "tinyrustlm.model-source-review-v1");
  assert.equal(first.receipt.blockerCode, "candidate_source_policy_contract_rejected");
  assert.equal(first.receipt.publicSafeParameters.modelId, "publisher/gated-model");
  assert.equal(first.receipt.publicSafeParameters.sourceAcquisitionComplete, false);
  assert.equal(first.receipt.publicSafeParameters.missingRequiredArtifactCount, 3);
  assert.equal(first.receipt.inputHashes.sourceModel, undefined);
  assert.equal(first.receipt.receiptId, second.receipt.receiptId);
  assert.deepEqual(first.receipt.boundedDiagnostics.rejectionCodes, [
    "custom-license-product-policy-conflict",
    "gated-acquisition-authorization-absent",
    "p2p-redistribution-contract-incompatible"
  ]);

  const store = new CampaignEvidenceStore(options(root, fixture).evidenceRoot);
  const rebuilt = store.rebuild();
  assert.equal(rebuilt.receipts.length, 1);
  assert.equal(rebuilt.quarantined.length, 0);
  const serialized = JSON.stringify(first.receipt);
  assert.equal(serialized.includes(root), false);
  assert.equal(serialized.includes("Custom distribution terms"), false);
});

test("rejects a policy-contract claim without every terminal reason", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-preflight-policy-code-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root, {
    rejectionCodes: [
      "custom-license-product-policy-conflict",
      "p2p-redistribution-contract-incompatible"
    ]
  });

  assert.throws(() => recordSourceModelPreflight(options(root, fixture)),
    /policy-contract rejection is missing gated-acquisition-authorization-absent/u);
});

test("rejects a policy-contract claim without bound use-policy evidence", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-preflight-policy-evidence-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root);
  const assessment = JSON.parse(fs.readFileSync(fixture.assessmentPath, "utf8"));
  assessment.evidenceArtifacts = assessment.evidenceArtifacts.filter(
    (entry) => entry.kind !== "use-policy");
  fs.writeFileSync(fixture.assessmentPath, `${JSON.stringify(assessment, null, 2)}\n`);

  assert.throws(() => recordSourceModelPreflight(options(root, fixture)),
    /policy-contract rejection is missing use-policy evidence/u);
});

test("records a pre-acquisition provenance-contract rejection", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-preflight-provenance-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeProvenanceFixture(root);

  const result = recordSourceModelPreflight(options(root, fixture));

  assert.equal(result.receipt.status, "rejected");
  assert.equal(result.receipt.blockerCode,
    "candidate_source_provenance_contract_rejected");
  assert.equal(result.receipt.publicSafeParameters.sourceAcquisitionComplete, false);
  assert.equal(result.receipt.publicSafeParameters.modelId,
    "publisher/sparse-provenance-model");
  assert.equal(result.receipt.inputHashes.sourceModel, undefined);
  assert.deepEqual(result.receipt.boundedDiagnostics.rejectionCodes, [
    "publisher-training-corpus-identity-absent",
    "publisher-training-recipe-identity-absent",
    "source-lineage-quantized-intermediate-only",
    "source-screen-provenance-contract-incomplete"
  ]);
});

test("rejects a provenance-contract claim without every terminal reason", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),
    "tinyrustlm-source-preflight-provenance-code-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeProvenanceFixture(root, {
    rejectionCodes: [
      "publisher-training-corpus-identity-absent",
      "source-lineage-quantized-intermediate-only",
      "source-screen-provenance-contract-incomplete"
    ]
  });

  assert.throws(() => recordSourceModelPreflight(options(root, fixture)),
    /provenance-contract rejection is missing publisher-training-recipe-identity-absent/u);
});

test("rejects a provenance-contract claim without direct repository metadata", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),
    "tinyrustlm-source-preflight-provenance-evidence-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeProvenanceFixture(root);
  const assessment = JSON.parse(fs.readFileSync(fixture.assessmentPath, "utf8"));
  assessment.evidenceArtifacts = assessment.evidenceArtifacts.filter(
    (entry) => entry.kind !== "repository-metadata");
  fs.writeFileSync(fixture.assessmentPath, `${JSON.stringify(assessment, null, 2)}\n`);

  assert.throws(() => recordSourceModelPreflight(options(root, fixture)),
    /provenance-contract rejection is missing repository-metadata evidence/u);
});

test("records an unpinned and conflicting lineage provenance rejection", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),
    "tinyrustlm-source-preflight-unpinned-lineage-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeUnpinnedLineageProvenanceFixture(root);

  const result = recordSourceModelPreflight(options(root, fixture));

  assert.equal(result.receipt.status, "rejected");
  assert.equal(result.receipt.blockerCode,
    "candidate_source_provenance_contract_rejected");
  assert.equal(result.receipt.publicSafeParameters.sourceAcquisitionComplete, false);
  assert.equal(result.receipt.publicSafeParameters.modelId,
    "publisher/unpinned-lineage-model");
  assert.equal(result.receipt.inputHashes.sourceModel, undefined);
  assert.deepEqual(result.receipt.boundedDiagnostics.rejectionCodes, [
    "publisher-base-model-reference-conflicting",
    "publisher-base-model-revision-absent",
    "publisher-dataset-revision-absent",
    "publisher-training-recipe-identity-absent",
    "source-screen-provenance-contract-incomplete"
  ]);
});

test("rejects unpinned lineage without direct parent metadata", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),
    "tinyrustlm-source-preflight-unpinned-parent-evidence-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeUnpinnedLineageProvenanceFixture(root);
  const assessment = JSON.parse(fs.readFileSync(fixture.assessmentPath, "utf8"));
  assessment.evidenceArtifacts = assessment.evidenceArtifacts.filter(
    (entry) => entry.kind !== "parent-metadata");
  fs.writeFileSync(fixture.assessmentPath, `${JSON.stringify(assessment, null, 2)}\n`);

  assert.throws(() => recordSourceModelPreflight(options(root, fixture)),
    /provenance-contract rejection is missing parent-metadata evidence/u);
});

test("rejects changed evidence before writing a receipt", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-preflight-drift-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root);
  fs.appendFileSync(path.join(fixture.artifactRoot, "terms.md.txt"), "changed\n");

  assert.throws(() => recordSourceModelPreflight(options(root, fixture)),
    /byte count changed: terms-of-use/u);
  assert.equal(fs.existsSync(path.join(root, "evidence", "receipts")), false);
});

test("requires sorted, explicit terminal rejection reasons", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-preflight-order-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root, {
    rejectionCodes: [
      "p2p-redistribution-contract-incompatible",
      "custom-license-product-policy-conflict"
    ]
  });

  assert.throws(() => recordSourceModelPreflight(options(root, fixture)),
    /source preflight rejection codes must be sorted/u);
});

test("records a missing publisher conversation contract only with bound template evidence", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-preflight-chat-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root, {
    accessDisposition: "public-ungated-metadata-only-no-source-acquisition",
    licenseId: "apache-2.0",
    licenseDisposition: "apache-2.0-card-declaration-review-required",
    distributionDisposition: "not-assessed-preflight-rejected",
    blockerCode: "candidate_source_conversation_contract_rejected",
    rejectionCodes: [
      "publisher-chat-template-absent",
      "publisher-multi-turn-serialization-absent",
      "source-screen-conversation-contract-incomplete"
    ],
    missingRequiredArtifacts: [
      "chat_template.jinja",
      "model.safetensors"
    ]
  });

  const result = recordSourceModelPreflight(options(root, fixture));

  assert.equal(result.receipt.status, "rejected");
  assert.equal(result.receipt.blockerCode,
    "candidate_source_conversation_contract_rejected");
  assert.deepEqual(result.receipt.boundedDiagnostics.rejectionCodes, [
    "publisher-chat-template-absent",
    "publisher-multi-turn-serialization-absent",
    "source-screen-conversation-contract-incomplete"
  ]);
});

test("rejects a conversation-contract claim that does not bind the missing template", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-preflight-chat-gap-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root, {
    blockerCode: "candidate_source_conversation_contract_rejected",
    rejectionCodes: [
      "publisher-chat-template-absent",
      "publisher-multi-turn-serialization-absent",
      "source-screen-conversation-contract-incomplete"
    ],
    missingRequiredArtifacts: ["model.safetensors"]
  });

  assert.throws(() => recordSourceModelPreflight(options(root, fixture)),
    /conversation-contract rejection must name chat_template\.jinja/u);
});

test("records a present but internally conflicting publisher conversation contract", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-preflight-chat-conflict-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let fixture = writeFixture(root, {
    accessDisposition: "public-ungated-source-acquired-private-review-only",
    licenseId: "apache-2.0",
    licenseDisposition: "apache-2.0-card-declaration-no-bundled-license-review-required",
    distributionDisposition: "not-assessed-preflight-rejected",
    blockerCode: "candidate_source_conversation_contract_rejected",
    rejectionCodes: [
      "publisher-chat-template-card-serialization-conflict",
      "publisher-chat-template-generation-prefix-absent",
      "publisher-generation-stop-token-conflict",
      "source-screen-conversation-contract-incomplete"
    ],
    missingRequiredArtifacts: []
  });
  const assessment = JSON.parse(fs.readFileSync(fixture.assessmentPath, "utf8"));
  const observedAtUtc = "2026-07-17T22:00:00.000Z";
  const tokenizerBytes = Buffer.from(JSON.stringify({
    chat_template: "{% for message in messages %}{{ message.role }}{{ message.content }}{% endfor %}"
  }));
  fs.writeFileSync(path.join(fixture.artifactRoot, "tokenizer-config.json"), tokenizerBytes);
  const tokenizerDeclaration = assessment.evidenceArtifacts.find(
    (entry) => entry.kind === "tokenizer-config");
  tokenizerDeclaration.byteCount = tokenizerBytes.length;
  tokenizerDeclaration.sha256 = digest(tokenizerBytes);
  const contractEvidence = [
    ["config", "config.json", '{"eos_token_id":4}\n'],
    ["generation-config", "generation-config.json", '{"eos_token_id":2}\n'],
    ["special-tokens-map", "special-tokens-map.json", '{"eos_token":"<|im_end|>"}\n']
  ];
  for (const [kind, fileName, content] of contractEvidence) {
    const bytes = Buffer.from(content);
    fs.writeFileSync(path.join(fixture.artifactRoot, fileName), bytes);
    assessment.evidenceArtifacts.push({
      kind,
      fileName,
      byteCount: bytes.length,
      sha256: digest(bytes),
      publicUrl: `https://example.test/${fileName}`,
      observedAtUtc
    });
  }
  assessment.evidenceArtifacts.sort((left, right) => left.kind.localeCompare(right.kind));
  fs.writeFileSync(fixture.assessmentPath, `${JSON.stringify(assessment, null, 2)}\n`);
  fixture = bindAcquiredSource(root, fixture);

  const result = recordSourceModelPreflight(options(root, fixture));

  assert.equal(result.receipt.status, "rejected");
  assert.equal(result.receipt.blockerCode,
    "candidate_source_conversation_contract_rejected");
  assert.equal(result.receipt.publicSafeParameters.sourceAcquisitionComplete, true);
  assert.equal(result.receipt.publicSafeParameters.sourceWeightArtifactCount, 1);
  assert.equal(result.receipt.publicSafeParameters.sourceWeightByteCount,
    fixture.modelBytes.length);
  assert.equal(result.receipt.inputHashes.sourceModel, digest(fixture.modelBytes));
  assert.equal(result.receipt.inputHashes["sourceWeight.000"], digest(fixture.modelBytes));
  assert.equal(JSON.stringify(result.receipt).includes(fixture.sourceArtifactRoot), false);
  assert.deepEqual(result.receipt.boundedDiagnostics.rejectionCodes, [
    "publisher-chat-template-card-serialization-conflict",
    "publisher-chat-template-generation-prefix-absent",
    "publisher-generation-stop-token-conflict",
    "source-screen-conversation-contract-incomplete"
  ]);
});

test("binds an indexed safetensors source to its complete canonical shard set", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-preflight-shards-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let fixture = writeFixture(root, {
    accessDisposition: "public-ungated-source-acquired-private-review-only",
    licenseId: "apache-2.0",
    licenseDisposition: "apache-2.0-card-declaration-review-required",
    distributionDisposition: "not-assessed-preflight-rejected",
    blockerCode: "candidate_source_conversation_contract_rejected",
    rejectionCodes: [
      "publisher-chat-template-absent",
      "publisher-multi-turn-serialization-absent",
      "source-screen-conversation-contract-incomplete"
    ],
    missingRequiredArtifacts: ["chat_template.jinja"]
  });
  fixture = bindAcquiredSource(root, fixture);
  fs.rmSync(path.join(fixture.sourceArtifactRoot, "model.safetensors"));
  const files = {
    "model.safetensors.index.json": Buffer.from(JSON.stringify({
      weight_map: {
        "layer.0.weight": "model-00001-of-00002.safetensors",
        "layer.1.weight": "model-00002-of-00002.safetensors"
      }
    })),
    "model-00001-of-00002.safetensors": Buffer.from("shard one\n"),
    "model-00002-of-00002.safetensors": Buffer.from("shard two\n")
  };
  for (const [fileName, bytes] of Object.entries(files)) {
    fs.writeFileSync(path.join(fixture.sourceArtifactRoot, fileName), bytes);
  }
  const assessment = JSON.parse(fs.readFileSync(fixture.assessmentPath, "utf8"));
  assessment.sourceWeightArtifacts = [
    "model.safetensors.index.json",
    "model-00001-of-00002.safetensors",
    "model-00002-of-00002.safetensors"
  ].map((fileName) => ({
    fileName,
    byteCount: files[fileName].length,
    sha256: digest(files[fileName])
  }));
  fs.writeFileSync(fixture.assessmentPath, `${JSON.stringify(assessment, null, 2)}\n`);

  const result = recordSourceModelPreflight(options(root, fixture));

  assert.equal(result.receipt.publicSafeParameters.sourceModelIdentityKind,
    "indexed-safetensors-set-v1");
  assert.equal(result.receipt.publicSafeParameters.sourceWeightArtifactCount, 3);
  assert.equal(result.receipt.inputHashes["sourceWeight.002"],
    digest(files["model-00002-of-00002.safetensors"]));
  assert.match(result.receipt.inputHashes.sourceModel, /^[a-f0-9]{64}$/u);
});

test("rejects an indexed declaration that is not named by the weight map", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-preflight-shard-map-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let fixture = writeFixture(root, {
    blockerCode: "candidate_source_conversation_contract_rejected",
    rejectionCodes: [
      "publisher-chat-template-absent",
      "publisher-multi-turn-serialization-absent",
      "source-screen-conversation-contract-incomplete"
    ],
    missingRequiredArtifacts: ["chat_template.jinja"]
  });
  fixture = bindAcquiredSource(root, fixture);
  fs.rmSync(path.join(fixture.sourceArtifactRoot, "model.safetensors"));
  const files = {
    "model.safetensors.index.json": Buffer.from(JSON.stringify({
      weight_map: { "layer.0.weight": "model-00001-of-00002.safetensors" }
    })),
    "model-00001-of-00002.safetensors": Buffer.from("shard one\n"),
    "model-00002-of-00002.safetensors": Buffer.from("unmapped shard\n")
  };
  for (const [fileName, bytes] of Object.entries(files)) {
    fs.writeFileSync(path.join(fixture.sourceArtifactRoot, fileName), bytes);
  }
  const assessment = JSON.parse(fs.readFileSync(fixture.assessmentPath, "utf8"));
  assessment.sourceWeightArtifacts = [
    "model.safetensors.index.json",
    "model-00001-of-00002.safetensors",
    "model-00002-of-00002.safetensors"
  ].map((fileName) => ({
    fileName,
    byteCount: files[fileName].length,
    sha256: digest(files[fileName])
  }));
  fs.writeFileSync(fixture.assessmentPath, `${JSON.stringify(assessment, null, 2)}\n`);

  assert.throws(() => recordSourceModelPreflight(options(root, fixture)),
    /source weight declarations do not match the index/u);
});

test("rejects acquired source-byte drift before writing a receipt", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-preflight-weight-drift-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let fixture = writeFixture(root, {
    accessDisposition: "public-ungated-source-acquired-private-review-only",
    licenseId: "apache-2.0",
    licenseDisposition: "apache-2.0-card-declaration-review-required",
    distributionDisposition: "not-assessed-preflight-rejected",
    blockerCode: "candidate_source_conversation_contract_rejected",
    rejectionCodes: [
      "publisher-chat-template-absent",
      "publisher-multi-turn-serialization-absent",
      "source-screen-conversation-contract-incomplete"
    ],
    missingRequiredArtifacts: ["chat_template.jinja"]
  });
  fixture = bindAcquiredSource(root, fixture);
  fs.appendFileSync(path.join(fixture.sourceArtifactRoot, "model.safetensors"), "changed\n");

  assert.throws(() => recordSourceModelPreflight(options(root, fixture)),
    /source weight byte count changed: model\.safetensors/u);
  assert.equal(fs.existsSync(path.join(root, "evidence", "receipts")), false);
});

test("rejects a complete source acquisition without its private source root", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-preflight-weight-root-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = bindAcquiredSource(root, writeFixture(root));
  const input = options(root, fixture);
  delete input.sourceArtifactRoot;

  assert.throws(() => recordSourceModelPreflight(input),
    /complete source acquisition requires sourceArtifactRoot/u);
});

test("rejects weight declarations when source acquisition is not complete", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-preflight-weight-state-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = bindAcquiredSource(root, writeFixture(root), {
    sourceAcquisitionStatus: "not-acquired"
  });

  assert.throws(() => recordSourceModelPreflight(options(root, fixture)),
    /not-acquired source cannot declare weight artifacts/u);
});

test("v1 assessments cannot infer source acquisition from an empty missing list", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-preflight-v1-inference-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root, {
    accessDisposition: "public-ungated-source-acquired-private-review-only",
    licenseId: "apache-2.0",
    licenseDisposition: "apache-2.0-card-declaration-review-required",
    distributionDisposition: "not-assessed-preflight-rejected",
    blockerCode: "candidate_source_conversation_contract_rejected",
    rejectionCodes: [
      "publisher-chat-template-card-serialization-conflict",
      "publisher-chat-template-generation-prefix-absent",
      "publisher-generation-stop-token-conflict",
      "source-screen-conversation-contract-incomplete"
    ],
    missingRequiredArtifacts: []
  });

  assert.throws(() => recordSourceModelPreflight(options(root, fixture)),
    /v1 assessments cannot attest complete source acquisition/u);
});

test("rejects a conflicting conversation contract without every terminal reason", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-preflight-chat-code-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root, {
    blockerCode: "candidate_source_conversation_contract_rejected",
    rejectionCodes: [
      "publisher-chat-template-card-serialization-conflict",
      "publisher-chat-template-generation-prefix-absent",
      "source-screen-conversation-contract-incomplete"
    ],
    missingRequiredArtifacts: ["model.safetensors"]
  });

  assert.throws(() => recordSourceModelPreflight(options(root, fixture)),
    /conversation-contract rejection does not match a supported failure profile/u);
});

test("rejects a conflicting conversation contract without generation metadata", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-preflight-chat-evidence-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root, {
    blockerCode: "candidate_source_conversation_contract_rejected",
    rejectionCodes: [
      "publisher-chat-template-card-serialization-conflict",
      "publisher-chat-template-generation-prefix-absent",
      "publisher-generation-stop-token-conflict",
      "source-screen-conversation-contract-incomplete"
    ],
    missingRequiredArtifacts: ["model.safetensors"]
  });

  assert.throws(() => recordSourceModelPreflight(options(root, fixture)),
    /conflicting conversation-contract rejection is missing config evidence/u);
});

test("records a custom-loader rejection only with bound publisher and registry evidence", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-preflight-loader-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root, {
    accessDisposition: "public-ungated-metadata-only-no-source-acquisition",
    licenseId: "custom",
    licenseDisposition: "custom-license-review-not-completed-preflight-rejected",
    distributionDisposition: "not-assessed-preflight-rejected",
    blockerCode: "candidate_source_loader_contract_rejected",
    rejectionCodes: [
      "custom-publisher-code-required",
      "native-transformers-architecture-absent",
      "source-screen-loader-contract-incompatible"
    ],
    missingRequiredArtifacts: [
      "model.safetensors",
      "tokenizer.json"
    ]
  });
  const assessment = JSON.parse(fs.readFileSync(fixture.assessmentPath, "utf8"));
  const observedAtUtc = "2026-07-16T17:00:00.000Z";
  const loaderEvidence = [
    ["config", "config.json", "{}\n"],
    ["configuration", "configuration.py", "class Config: pass\n"],
    ["modeling", "modeling.py", "class Model: pass\n"],
    ["transformers-auto-config-registry", "configuration-auto.py", "CONFIG_MAPPING = {}\n"]
  ];
  for (const [kind, fileName, content] of loaderEvidence) {
    const bytes = Buffer.from(content);
    fs.writeFileSync(path.join(fixture.artifactRoot, fileName), bytes);
    assessment.evidenceArtifacts.push({
      kind,
      fileName,
      byteCount: bytes.length,
      sha256: digest(bytes),
      publicUrl: `https://example.test/${fileName}`,
      observedAtUtc
    });
  }
  assessment.evidenceArtifacts.sort((left, right) => left.kind.localeCompare(right.kind));
  fs.writeFileSync(fixture.assessmentPath, `${JSON.stringify(assessment, null, 2)}\n`);

  const result = recordSourceModelPreflight(options(root, fixture));

  assert.equal(result.receipt.status, "rejected");
  assert.equal(result.receipt.blockerCode, "candidate_source_loader_contract_rejected");
});

test("rejects a custom-loader claim without bound loader evidence", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-preflight-loader-gap-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = writeFixture(root, {
    blockerCode: "candidate_source_loader_contract_rejected",
    rejectionCodes: [
      "custom-publisher-code-required",
      "native-transformers-architecture-absent",
      "source-screen-loader-contract-incompatible"
    ],
    missingRequiredArtifacts: ["model.safetensors"]
  });

  assert.throws(() => recordSourceModelPreflight(options(root, fixture)),
    /loader-contract rejection is missing config evidence/u);
});
