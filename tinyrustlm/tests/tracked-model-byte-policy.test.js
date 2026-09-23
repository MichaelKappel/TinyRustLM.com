"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..", "..");

/** Model bytes, including retired formats and their sidecars, stay outside Git. */
function isForbiddenModelPayload(filePath) {
  const lower = filePath.toLowerCase();
  const baseName = path.posix.basename(lower);
  return (
    /\.(?:slm|slm1|adp1|acg1|slm2|tokenizer2|template2|sampling2|prompt2|acg2)(?:\.manifest)?$/.test(lower) ||
    /\.(?:safetensors|gguf|onnx|pt|pth|ckpt)$/.test(lower) ||
    /(^|\/)tensors\/.*\.f32$/.test(lower) ||
    /\.peer-pieces\/.*\.bin$/.test(lower) ||
    /^(?:pytorch_model.*|model.*)\.bin$/.test(baseName) ||
    (lower.startsWith("tinyrustlm/models/") && lower !== "tinyrustlm/models/readme.md")
  );
}

test("current and retired model payloads have no fixture exception", () => {
  for (const extension of ["slm", "slm1", "adp1", "acg1", "slm2", "tokenizer2",
    "template2", "sampling2", "prompt2", "acg2", "safetensors", "gguf", "onnx", "pt", "pth", "ckpt"]) {
    for (const name of ["member." + extension, "MEMBER." + extension.toUpperCase()]) {
      assert.equal(isForbiddenModelPayload("artifacts/model/" + name), true, name);
    }
  }
  for (const file of ["models/old.slm.manifest", "models/old.adp1.manifest",
    "models/old.acg1.manifest", "models/model.bin", "models/pytorch_model-00001.bin",
    "candidate/tensors/layer.f32", "candidate.peer-pieces/piece.bin",
    "tinyrustlm/models/tiny-test-model.slm", "tinyrustlm/models/authority.json"]) {
    assert.equal(isForbiddenModelPayload(file), true, file);
  }
  for (const file of ["tinyrustlm/models/README.md", "contracts/vnext/slm2-format-vectors.v1.json",
    "tinyrustlm/browser-runtime/tinyrustlm-browser-runtime.wasm", "docs/model.md"]) {
    assert.equal(isForbiddenModelPayload(file), false, file);
  }
});

test("Git index contains no model payloads or retired fixture metadata", () => {
  const records = childProcess.execFileSync("git", ["ls-files", "--stage", "-z"], {
    cwd: repositoryRoot, maxBuffer: 64 * 1024 * 1024, windowsHide: true
  }).toString("utf8").split("\0").filter(Boolean);
  const violations = [];
  for (const record of records) {
    const tab = record.indexOf("\t");
    assert.ok(tab > 0, "malformed Git index entry");
    const [, , stage] = record.slice(0, tab).split(" ");
    const filePath = record.slice(tab + 1).replaceAll("\\", "/");
    assert.equal(stage, "0", "unmerged Git index entry: " + filePath);
    if (isForbiddenModelPayload(filePath)) violations.push(filePath);
  }
  assert.deepEqual(violations, [], "tracked model payloads: " + violations.join(", "));
});
