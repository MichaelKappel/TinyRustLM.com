"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts/vnext/slm2-fuzz-profile.v1.json");
const manifestPath = path.join(
  repositoryRoot,
  "rust/crates/tinyrustlm-slm2/fuzz/corpus/raw_slm2/manifest.v1.json"
);
const generatorPath = path.join(repositoryRoot, "tinyrustlm/tools/generate-slm2-fuzz-corpus.js");
const fuzzRoot = path.join(repositoryRoot, "rust/crates/tinyrustlm-slm2/fuzz");
const implementationDocumentPath = path.join(
  repositoryRoot,
  "docs/architecture/vnext-slm2-format-implementation.md"
);
const contractReadmePath = path.join(repositoryRoot, "contracts/vnext/README.md");

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

test("SLM2 fuzz profile, generated corpus, and source boundary are exact", () => {
  const output = childProcess.execFileSync(process.execPath, [generatorPath, "--check"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true
  });
  assert.deepEqual(JSON.parse(output), { status: "pass", entries: 26 });

  const profileBytes = fs.readFileSync(profilePath);
  const profile = JSON.parse(profileBytes);
  assert.equal(sha256(profileBytes), "ee114d831d180afdb15c2f8ea00e76212083fd764c605f2cf193f0770708a641");
  assert.equal(profile.profileId, "tinyrustlm.vnext.slm2-fuzz.v1");
  assert.equal(profile.status, "development-unpromoted");
  assert.equal(profile.input.maximumBytes, 1_048_576);
  assert.equal(profile.validationPolicy.maximumTensors, 4_096);
  assert.ok(profile.prohibited.includes("activation-of-fuzzed-artifacts"));
  assert.ok(profile.prohibited.includes("fuzz-result-as-production-qualification"));

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.entries.length, 26);
  assert.equal(manifest.entries.filter((entry) => entry.verdict === "admit").length, 1);
  assert.equal(manifest.entries.filter((entry) => entry.verdict === "reject").length, 25);
  assert.deepEqual(manifest.entries.map((entry) => entry.id),
    [...manifest.entries].map((entry) => entry.id).sort());
  for (const entry of manifest.entries) {
    const seedPath = path.join(path.dirname(manifestPath), entry.file);
    const bytes = fs.readFileSync(seedPath);
    assert.equal(bytes.length, entry.bytes, entry.id);
    assert.equal(sha256(bytes), entry.sha256, entry.id);
    assert.equal(entry.verdict === "admit", entry.errorCode === null, entry.id);
    assert.equal(entry.verdict === "admit", entry.tensorCount !== null, entry.id);
  }

  for (const relative of [
    "src/lib.rs",
    "src/bin/replay_slm2_corpus.rs",
    "fuzz_targets/raw_slm2.rs"
  ]) {
    const source = fs.readFileSync(path.join(fuzzRoot, relative), "utf8");
    assert.doesNotMatch(source, /unsafe\s*\{/u, relative);
  }
  const target = fs.readFileSync(path.join(fuzzRoot, "fuzz_targets/raw_slm2.rs"), "utf8");
  assert.match(target, /bytes\.len\(\) <= MAXIMUM_INPUT_BYTES/u);
  assert.match(target, /exercise_bytes\(bytes\)/u);

  const implementationDocument = fs.readFileSync(implementationDocumentPath, "utf8");
  assert.match(implementationDocument,
    /f272caf64cacb7a4705fee0c958f15ee0cac3985d8728458a80f812913d66554/u);
  assert.match(implementationDocument,
    /ee114d831d180afdb15c2f8ea00e76212083fd764c605f2cf193f0770708a641/u);
  assert.match(implementationDocument,
    /971da88da5eb7a0724acb78202acc00ffd5de0a9f76e0d123e11ed4062dc65f9/u);
  assert.match(implementationDocument, /26 entries, one\s+admitted, and 25 rejected/u);
  assert.match(implementationDocument, /inactive and unpromoted/u);
  assert.match(implementationDocument, /No claim is\s+made that a sustained AddressSanitizer interval has run/u);
  assert.match(implementationDocument, /Campaign\s+counters remain 0\/20 qualified models/u);

  const contractReadme = fs.readFileSync(contractReadmePath, "utf8");
  assert.match(contractReadme, /## SLM2 Model Format Checkpoint/u);
  assert.match(contractReadme, /not a long-running sanitizer result/u);
});
