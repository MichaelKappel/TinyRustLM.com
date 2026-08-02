"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  CampaignEvidenceStore,
  canonicalJson,
  validateAcyclicGraph
} = require("../tools/campaign-evidence-store.js");

function receiptInput(overrides = {}) {
  return {
    receiptType: "dogfood-round",
    campaignId: "evidence-store-test-20260715",
    phase: "BrowserTesting",
    attempt: 1,
    status: "pass",
    createdAtUtc: "2026-07-15T00:00:00.000Z",
    completedAtUtc: "2026-07-15T00:01:00.000Z",
    inputReceiptIds: [],
    inputHashes: { configuration: "a".repeat(64) },
    outputHashes: { conversation: "b".repeat(64) },
    sourceRevision: "c".repeat(40),
    toolNames: ["playwright"],
    toolVersions: ["1.61.1"],
    toolBinaryHashes: ["d".repeat(64)],
    runtimeIdentifier: "win-x64",
    operatingSystem: "windows",
    architecture: "x64",
    hardwareEvidence: { execution: "fixture" },
    configurationHash: "e".repeat(64),
    publicSafeParameters: { modelId: "test/model", round: 1 },
    boundedDiagnostics: { code: "ok" },
    blockerCode: null,
    externalEvidenceReferences: [],
    redactionVersion: "tinyrustlm.receipt-redaction.v1",
    evidenceClass: "fixture",
    supersedesReceiptIds: [],
    attestationReference: null,
    ...overrides
  };
}

test("canonical JSON is order independent and rejects non-JSON ambiguity", () => {
  assert.equal(
    canonicalJson({ z: [3, { b: true, a: null }], a: "value" }),
    canonicalJson({ a: "value", z: [3, { a: null, b: true }] })
  );
  assert.throws(() => canonicalJson({ value: undefined }), /undefined/i);
  assert.throws(() => canonicalJson({ value: Number.NaN }), /finite/i);
  assert.throws(() => canonicalJson(new Date()), /plain JSON object/i);
});

test("writes immutable content-addressed receipts and reopens their exact bytes", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-evidence-store-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new CampaignEvidenceStore(root);

  const first = store.putReceipt(receiptInput());
  assert.match(first.receipt.receiptId, /^sha256:[a-f0-9]{64}$/);
  assert.equal(first.receipt.receiptContentHash, first.receipt.receiptId.slice(7));
  assert.equal(path.basename(first.path), `${first.receipt.receiptContentHash}.json`);
  assert.equal(path.basename(path.dirname(first.path)), first.receipt.receiptContentHash.slice(0, 2));
  assert.deepEqual(store.readReceipt(first.receipt.receiptId), first.receipt);

  const duplicate = store.putReceipt(receiptInput());
  assert.equal(duplicate.receipt.receiptId, first.receipt.receiptId);
  assert.equal(duplicate.reused, true);
  assert.equal(store.rebuild().receipts.length, 1);
});

test("redacts synthetic secrets, authorization values, credential URLs, and private paths", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-evidence-redaction-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const synthetic = "synthetic-secret-value-9CePq2vLm8Hk";
  const store = new CampaignEvidenceStore(root, { knownSecrets: [synthetic] });
  const result = store.putReceipt(receiptInput({
    boundedDiagnostics: {
      authorization: `Bearer ${synthetic}`,
      sourcePath: "C:\\Users\\Example\\private\\model.slm",
      wslPath: "/mnt/e/Source/private/model.slm",
      networkPath: "\\\\fileserver\\models\\private-model.slm",
      callback: `https://user:${synthetic}@example.test/callback?token=${synthetic}`,
      safeCode: "blocked_contract_missing"
    }
  }));
  const bytes = fs.readFileSync(result.path, "utf8");
  assert.equal(bytes.includes(synthetic), false);
  assert.equal(bytes.includes("C:\\Users\\Example"), false);
  assert.equal(bytes.includes("/mnt/e/Source"), false);
  assert.equal(bytes.includes("fileserver"), false);
  assert.match(bytes, /\[REDACTED\]/);
  assert.match(bytes, /<private-path>/);
});

test("preserves long public model IDs without mistaking them for credentials", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-evidence-model-id-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const modelId = "IsmaelMousa/SmolLM2-360M-Instruct-EngSaf-858K";
  const store = new CampaignEvidenceStore(root);
  const persisted = store.putReceipt(receiptInput({
    publicSafeParameters: { modelId, round: 1 }
  }));
  assert.equal(persisted.receipt.publicSafeParameters.modelId, modelId);

  const secretStore = new CampaignEvidenceStore(path.join(root, "secret"), {
    knownSecrets: ["privateAgentCredential"]
  });
  assert.throws(() => secretStore.putReceipt(receiptInput({
    publicSafeParameters: { modelId: "publisher/privateAgentCredential", round: 1 }
  })), /modelId contains a known secret/u);
});

test("allows different tools to share a version or identical reviewed binary", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-evidence-tools-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new CampaignEvidenceStore(root);
  const sharedHash = "d".repeat(64);
  const persisted = store.putReceipt(receiptInput({
    toolNames: ["campaign-runner", "receipt-validator"],
    toolVersions: ["1.0.0", "1.0.0"],
    toolBinaryHashes: [sharedHash, sharedHash]
  }));
  assert.deepEqual(persisted.receipt.toolVersions, ["1.0.0", "1.0.0"]);
  assert.deepEqual(persisted.receipt.toolBinaryHashes, [sharedHash, sharedHash]);
});

test("rejects unknown receipt fields and a missing parent before persistence", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-evidence-reject-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new CampaignEvidenceStore(root);
  assert.throws(() => store.putReceipt({ ...receiptInput(), mutableComplete: true }), /unknown receipt field/i);
  assert.throws(() => store.putReceipt(receiptInput({
    inputReceiptIds: [`sha256:${"f".repeat(64)}`]
  })), /parent receipt is missing/i);
  assert.equal(store.rebuild().receipts.length, 0);
});

test("quarantines tampered receipts and incomplete temporary files on startup", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-evidence-quarantine-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new CampaignEvidenceStore(root);
  const persisted = store.putReceipt(receiptInput());
  fs.writeFileSync(persisted.path, `${JSON.stringify({ ...persisted.receipt, status: "fail" })}\n`);
  const temporaryDirectory = path.join(root, "receipts", "sha256", "ff");
  fs.mkdirSync(temporaryDirectory, { recursive: true });
  fs.writeFileSync(path.join(temporaryDirectory, "interrupted.tmp"), "{truncated");

  const rebuilt = new CampaignEvidenceStore(root).rebuild();
  assert.equal(rebuilt.receipts.length, 0);
  assert.equal(rebuilt.quarantined.length, 2);
  assert.equal(fs.existsSync(persisted.path), false);
  assert.equal(fs.readdirSync(path.join(root, "quarantine")).length, 2);
});

test("detects a parent cycle independently of receipt ordering", () => {
  const nodes = new Map([
    ["sha256:a", { receiptId: "sha256:a", inputReceiptIds: ["sha256:b"] }],
    ["sha256:b", { receiptId: "sha256:b", inputReceiptIds: ["sha256:c"] }],
    ["sha256:c", { receiptId: "sha256:c", inputReceiptIds: ["sha256:a"] }]
  ]);
  assert.throws(() => validateAcyclicGraph(nodes), /cycle/i);
});
