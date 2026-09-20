"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const { buildModel, runtimeCompositionFixture, TEST_ONLY_MODEL_ID } = require("../e2e/helpers/browser-conversation-fixture.js");
const admission = require("../app/browser-model-admission.js");
const slm2 = require("../tools/slm2-q8-reference.js");
const dependencies = process.env.TINYRUSTLM_BROWSER_RUNTIME_PRIVATE_COMPOSITION_ROOT;

test("rejects invalid synthetic output rows and noncanonical dependency paths before building", () => {
  for (const rows of [null, [], [0], [0, 0], [1, 32], [0, 151643], [0, 1.5], [0, "32"], [0, 32, 33]]) {
    assert.throws(() => buildModel(rows), /Synthetic output rows are invalid/);
  }
  for (const root of [null, "", "relative", "C:\\outside", "D:\\LLMs\\TinyRustLM\\..\\outside"]) {
    assert.throws(() => runtimeCompositionFixture(root), /model output/);
  }
});

test("production writer, independent SLM2 reader and real WASM agree on the test-only composition", {
  skip: !dependencies && "requires canonical tokenizer/template dependency directory"
}, () => {
  const fixture = runtimeCompositionFixture(dependencies);
  const parsed = admission.parseAdmissionText(fixture.admissionText);
  assert.equal(parsed.modelId, TEST_ONLY_MODEL_ID);
  assert.match(parsed.qualification.qualityScope, /^test-only\/never-live\//);
  assert.equal(fixture.files.length, 7);
  for (const [index, item] of parsed.artifacts.entries()) {
    const file = fixture.files[index];
    assert.equal(file.name, item.fileName);
    assert.equal(file.buffer.length, item.byteCount);
    assert.equal(crypto.createHash("sha256").update(file.buffer).digest("hex"), item.sha256);
  }
  const model = slm2.parseArtifact(fixture.files[0].buffer);
  assert.equal(model.spec.vocabularySize, 151936);
  assert.equal(model.spec.layerCount, 1);
  assert.ok(model.header.fileSize < 4 * 1024 * 1024);
  assert.equal(parsed.runtime.defaultSampling.maximumNewTokens, 8);
});
