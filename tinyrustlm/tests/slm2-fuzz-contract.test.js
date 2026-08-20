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
  assert.deepEqual(JSON.parse(output), { status: "pass", entries: 27 });

  const profileBytes = fs.readFileSync(profilePath);
  const profile = JSON.parse(profileBytes);
  assert.equal(sha256(profileBytes), "995a88e52692df204455ea94725de603af38b785a6f9f708a37bf7baa3ae2ce8");
  assert.equal(profile.profileId, "tinyrustlm.vnext.slm2-fuzz.v1");
  assert.equal(profile.status, "development-unpromoted");
  assert.equal(profile.formatProfileSha256,
    "b3f90c67d396d16a3ca561cbb288c10dc542a10e00d758704d1d6a17b3c3ff0f");
  assert.equal(profile.input.maximumBytes, 1_048_576);
  assert.equal(profile.validationPolicy.maximumFileBytes, profile.input.maximumBytes);
  assert.equal(profile.validationPolicy.maximumTensors, 4_096);
  assert.equal(profile.stableReplay.manifestSchema,
    "tinyrustlm.vnext.slm2_fuzz_corpus.v1");
  assert.equal(profile.stableReplay.manifestMaximumBytes, 131_072);
  assert.equal(profile.stableReplay.maximumEntries, 256);
  assert.equal(profile.stableReplay.exactSeedSetRequired, true);
  assert.equal(profile.stableReplay.seedSymlinksAllowed, false);
  assert.equal(new Set(profile.allowedParserErrorCodes).size,
    profile.allowedParserErrorCodes.length);
  assert.deepEqual(profile.allowedParserErrorCodes,
    [...profile.allowedParserErrorCodes].sort());
  assert.ok(profile.allowedParserErrorCodes.includes("slm2-invalid-tensor-registry"));
  assert.ok(profile.target.acceptedArtifactChecks.includes(
    "tensor-registry-matches-public-required-registry"
  ));
  assert.ok(profile.seedClasses.includes("tensor-registry-mutation"));
  assert.ok(profile.prohibited.includes("activation-of-fuzzed-artifacts"));
  assert.ok(profile.prohibited.includes("fuzz-result-as-production-qualification"));

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.formatProfileSha256, profile.formatProfileSha256);
  assert.equal(manifest.sourceVectorId, "base-model-required-f32-tensor-registry");
  assert.equal(manifest.sourceVectorArtifactSha256,
    "3f28af0124e49f3ad1c177958eea5d5bd2823b63821451d44c05da6602fc402d");
  assert.equal(manifest.entries.length, 27);
  assert.equal(manifest.entries.filter((entry) => entry.verdict === "admit").length, 1);
  assert.equal(manifest.entries.filter((entry) => entry.verdict === "reject").length, 26);
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
  const registrySeed = manifest.entries.find(
    (entry) => entry.id === "21-tensor-registry-flag-mismatch"
  );
  assert.equal(registrySeed.class, "tensor-registry-mutation");
  assert.equal(registrySeed.errorCode, "slm2-invalid-tensor-registry");

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

  const harness = fs.readFileSync(path.join(fuzzRoot, "src/lib.rs"), "utf8");
  assert.match(harness, /OnceLock/u);
  assert.match(harness, /deny_unknown_fields/u);
  assert.match(harness, /allowed_parser_error_codes/u);
  assert.match(harness, /required_model_tensors/u);
  assert.match(harness, /MAXIMUM_CORPUS_MANIFEST_BYTES/u);
  assert.match(harness, /MAXIMUM_CORPUS_ENTRIES/u);
  const replay = fs.readFileSync(
    path.join(fuzzRoot, "src/bin/replay_slm2_corpus.rs"), "utf8"
  );
  assert.match(replay,
    /CORPUS_MANIFEST_SCHEMA, MAXIMUM_CORPUS_ENTRIES, MAXIMUM_CORPUS_MANIFEST_BYTES/u);
  assert.doesNotMatch(replay, /const MAXIMUM_(?:MANIFEST_BYTES|CORPUS_ENTRIES)/u);

  const implementationDocument = fs.readFileSync(implementationDocumentPath, "utf8");
  assert.match(implementationDocument,
    /b3f90c67d396d16a3ca561cbb288c10dc542a10e00d758704d1d6a17b3c3ff0f/u);
  assert.match(implementationDocument,
    /995a88e52692df204455ea94725de603af38b785a6f9f708a37bf7baa3ae2ce8/u);
  assert.match(implementationDocument,
    /1e449cb26b43f91de8e7534124e09b422ec346dbbaed5652d3b76a8f64abb76a/u);
  assert.match(implementationDocument, /27 entries, one admitted, and 26 rejected/u);
  assert.match(implementationDocument, /canonical manifest flag mutation/u);
  assert.match(implementationDocument, /closed `deny_unknown_fields` Rust records/u);
  assert.match(implementationDocument, /two fuzz-library tests and five replay-command tests/u);
  assert.match(implementationDocument, /inactive and unpromoted/u);
  assert.match(implementationDocument, /No claim is\s+made that a sustained AddressSanitizer interval has run/u);
  assert.match(implementationDocument, /Campaign\s+counters remain 0\/20 qualified models/u);

  const contractReadme = fs.readFileSync(contractReadmePath, "utf8");
  assert.match(contractReadme, /## SLM2 Model Format Checkpoint/u);
  assert.match(contractReadme, /27-seed stable corpus/u);
  assert.match(contractReadme, /not a\s+long-running sanitizer result/u);
});
