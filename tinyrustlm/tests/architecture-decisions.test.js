"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const adrDirectory = path.resolve(__dirname, "../../docs/architecture/adr");
const requiredSections = [
  "Status",
  "Decision Date",
  "Scope",
  "Decision",
  "Alternatives",
  "Authoritative Evidence",
  "Threat Analysis",
  "Performance Evidence",
  "Compatibility Impact",
  "Clean Deletion Impact",
  "Unknowns",
  "Acceptance Tests",
  "Rollback"
];
const records = [
  ["ADR-001-vnext-metadata-grammar.md", [
    "deterministic CBOR subset", "duplicate", "indefinite"
  ]],
  ["ADR-002-hash-and-merkle-profile.md", [
    "SHA-256", "4 MiB", "domain"
  ]],
  ["ADR-003-alignment-and-tensor-layout.md", [
    "64-byte", "256-byte", "little-endian"
  ]],
  ["ADR-004-companion-transport.md", [
    "HTTP/1.1", "127.0.0.1", "Origin"
  ]],
  ["ADR-005-browser-persistence.md", [
    "File", "OPFS", "Cache Storage"
  ]],
  ["ADR-006-quantization-profiles.md", [
    "F32", "Q8", "KV-cache"
  ]],
  ["ADR-007-webgpu-support-profile.md", [
    "optional acceleration", "static WGSL", "correctness owner"
  ]],
  ["ADR-008-specialist-composition.md", [
    "general champion", "low-rank adapter", "fall back to the champion"
  ]],
  ["ADR-009-service-worker-release-model.md", [
    "last-known-good", "two-phase", "never stores model bytes"
  ]],
  ["ADR-010-evidence-signing.md", [
    "RFC 8785", "Ed25519", "Revocation"
  ]],
  ["ADR-011-campaign-evidence-browser-boundary.md", [
    "zero-import", "staged", "offline-bundle verdict"
  ]],
  ["ADR-012-durable-publication-bootstrap.md", [
    "forward-only content-addressed durability receipt",
    "same-directory target temporary",
    "non-recursive bootstrap rule"
  ]],
  ["ADR-013-slm2-format-profile.md", [
    "SLM2 2.0",
    "detached Ed25519",
    "Dense F32"
  ]],
  ["ADR-014-tokenizer2-format-profile.md", [
    "Tokenizer2 2.0",
    "Unicode 9.0.0",
    "does not accept tokenizer JSON"
  ]]
];

function read(name) {
  return fs.readFileSync(path.join(adrDirectory, name), "utf8");
}

test("contains the complete accepted ADR-001 through ADR-014 inventory", () => {
  const actual = fs.readdirSync(adrDirectory)
    .filter((name) => /^ADR-\d{3}-.+\.md$/u.test(name))
    .sort();
  const expected = records.map(([name]) => name).sort();
  assert.deepEqual(actual, expected);

  const index = read("README.md");
  for (const [name] of records) {
    assert.match(index, new RegExp(`\\(${name.replaceAll(".", "\\.")}\\)`, "u"));
  }
  assert.match(index, /SLM2 is incompatible with SLM1/u);
  assert.match(index, /not include an SLM1 fallback, migration parser, dual writer, or alias/iu);
});

for (const [name, invariants] of records) {
  test(`${name} is complete, accepted, and decision-specific`, () => {
    const text = read(name);
    const normalizedText = text.replace(/\s+/gu, " ");
    assert.match(text, /^# ADR-\d{3}: .+$/mu);
    assert.doesNotMatch(text, /\b(?:TODO|TBD|FIXME)\b/u);
    assert.ok(text.split(/\r?\n/u).length >= 100,
      `${name} is too small to carry the required decision analysis`);

    const actualSections = [...text.matchAll(/^## (.+)$/gmu)].map((match) => match[1]);
    assert.deepEqual(actualSections, requiredSections,
      `${name} has missing, extra, or misordered required sections`);

    assert.match(text, /## Status\s+\n+Accepted/iu);
    assert.match(text, /## Decision Date\s+\n+2026-\d{2}-\d{2}/u);
    assert.match(text, /\*\*Observed local fact\*\*/u);
    assert.match(text, /\*\*Engineering decision\*\*/u);
    assert.match(text, /\*\*Local verification required\*\*/u);
    const performanceStart = text.indexOf("## Performance Evidence");
    const compatibilityStart = text.indexOf("## Compatibility Impact");
    const performance = text.slice(performanceStart, compatibilityStart);
    assert.match(performance, /\b(?:no|not|pending|requires?|promotion|unpromoted)\b/iu,
      `${name} must bound performance claims with evidence or a promotion gate`);

    for (const invariant of invariants) {
      assert.ok(normalizedText.toLowerCase().includes(invariant.toLowerCase()),
        `${name} is missing cross-contract invariant: ${invariant}`);
    }
  });
}

test("keeps identity, acceleration, persistence, composition, and signing roles separate", () => {
  const hash = read("ADR-002-hash-and-merkle-profile.md");
  const webgpu = read("ADR-007-webgpu-support-profile.md");
  const composition = read("ADR-008-specialist-composition.md");
  const release = read("ADR-009-service-worker-release-model.md");
  const signing = read("ADR-010-evidence-signing.md");
  const normalizedRelease = release.replace(/\s+/gu, " ");
  const normalizedSigning = signing.replace(/\s+/gu, " ");

  assert.match(hash, /SHA-256 is the sole mandatory ecosystem identity hash/iu);
  assert.match(webgpu, /WebGPU is an optional acceleration backend/u);
  assert.match(composition, /Deduplication is a storage implementation detail, not model identity/u);
  assert.match(normalizedRelease, /Model bytes.*never.*web release graph/iu);
  assert.match(normalizedSigning, /valid signature|signature.*never elevates|never elevates/iu);
  assert.match(normalizedSigning, /Keys are never reused across roles/iu);
});
