"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..", "..");
const maximumFixtureBytes = 64 * 1024;
const allowedSlmFixtures = new Set([
  "tinyrustlm/models/tiny-test-model.slm",
  "tinyrustlm/models/tiny-test-model-tied.slm",
  "tinyrustlm/models/tiny-test-model-q8.slm",
  "tinyrustlm/models/tiny-test-model-q5.slm",
  "tinyrustlm/models/tiny-test-model-q4.slm",
  "tinyrustlm/models/tiny-test-model-bpe.slm"
]);

function git(args) {
  return childProcess.execFileSync("git", args, {
    cwd: repositoryRoot,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true
  });
}

function indexEntries() {
  return git(["ls-files", "--stage", "-z"])
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((record) => {
      const tab = record.indexOf("\t");
      assert.ok(tab > 0, `malformed Git index entry: ${record}`);
      const [mode, objectId, stage] = record.slice(0, tab).split(" ");
      return {
        mode,
        objectId,
        stage,
        path: record.slice(tab + 1).replaceAll("\\", "/")
      };
    });
}

function isForbiddenModelPayload(filePath) {
  const lower = filePath.toLowerCase();
  const baseName = path.posix.basename(lower);
  return (
    /\.(?:safetensors|gguf|onnx|pt|pth|ckpt)$/.test(lower) ||
    /(^|\/)tensors\/.*\.f32$/.test(lower) ||
    /\.peer-pieces\/.*\.bin$/.test(lower) ||
    /^(?:pytorch_model.*|model.*)\.bin$/.test(baseName)
  );
}

test("Git index contains no model payloads beyond explicit tiny slm fixtures", () => {
  const entries = indexEntries();
  const observedFixtures = new Set();
  const violations = [];

  for (const entry of entries) {
    assert.equal(entry.stage, "0", `unmerged Git index entry: ${entry.path}`);
    const lower = entry.path.toLowerCase();
    if (lower.endsWith(".slm")) {
      if (!allowedSlmFixtures.has(entry.path)) {
        violations.push(entry.path);
        continue;
      }
      const size = Number.parseInt(git(["cat-file", "-s", entry.objectId]).toString("utf8"), 10);
      assert.ok(Number.isSafeInteger(size), `invalid fixture size for ${entry.path}`);
      assert.ok(
        size <= maximumFixtureBytes,
        `${entry.path} is ${size} bytes; fixture limit is ${maximumFixtureBytes}`
      );
      observedFixtures.add(entry.path);
      continue;
    }
    if (isForbiddenModelPayload(entry.path)) {
      violations.push(entry.path);
    }
  }

  assert.deepEqual(violations, [], `tracked model payloads:\n${violations.join("\n")}`);
  assert.deepEqual(
    [...observedFixtures].sort(),
    [...allowedSlmFixtures].sort(),
    "the explicit deterministic fixture set changed"
  );
});
