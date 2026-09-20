"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { validateReport, verifyReportFile, maximumBytes } = require("../../eng/verify-release-report.js");
const { createOwnedTemporaryDirectory, removeOwnedTemporaryDirectory } = require("../tools/canonical-operation-scratch.js");

const root = path.resolve(__dirname, "../..");
const ids = ["TinyRustLM.Abstractions", "TinyRustLM.Core", "TinyRustLM.P2P"];
const hash = "a".repeat(64);
const base = { generated_utc: "2026-09-20T17:00:00.0000000Z", status: "pass",
  package_version: "0.1.8", secret_material_included: false };

/** Supply independent, small report examples; integration tests exercise real producers. */
function fixtures() {
  const ui = { ...base, schema: "tinyrustlm.ui_verification.v2", run_id: "run-1", repository_root: root,
    app_root: path.join(root, "tinyrustlm"), browser_smoke_requested: true, deep_acquisition_requested: false,
    visual_lock_requested: false, evidence: { cleanup: "removed" }, gates: {
      source_authority: "pass", static_contract: "pass", javascript_syntax: "pass",
      interview_demo_no_browser: "pass", acquisition_playwright: "pass", temporary_cleanup: "pass",
      browser_contracts: "pass", chromium_release: "pass", acquisition_browser_bridge: "skipped",
      acquisition_companion: "skipped", acquisition_converter: "skipped", visual_lock: "skipped" } };
  const hashRows = ids.map(package_id => ({ package_id, present: true, expected_sha256: hash, actual_sha256: hash,
    sha256_match: true, expected_byte_count: 42, actual_byte_count: 42, byte_count_match: true,
    package_integrity_match: true, repository_signature_accepted: false,
    payload_verification: { mode: "exact_package_bytes", match: true, repository_signature_accepted: false } }));
  const packaged = extension => ids.map(package_id => ({ package_id, name: `${package_id}.0.1.8.${extension}`,
    path: `feed/${package_id}.0.1.8.${extension}`, sha256: hash, byte_count: 42 }));
  return {
    ui,
    "public-root": { ...base, schema: "tinyrustlm.public_root_verification.v1", run_id: "run-2",
      repository_root: root, app_root: ui.app_root, ui_verification_report: "child.json", ui_verification_sha256: hash },
    "feed-smoke": { ...base, schema: "tinyrustlm.nuget.feed_smoke.v0", nuget_source: "feed",
      local_piece_assembly_verified: true, consumer_output_sha256: hash,
      canonical_vectors: ["contracts/vnext/slm2-q8-weight-vectors.v1.json", "contracts/vnext/acg2-format-vectors.v1.json"] },
    "feed-current": { ...base, schema: "tinyrustlm.nuget.feed_current.v0", source: "feed", source_kind: "folder",
      package_ids: ids, package_count: 3, allow_newer: false, missing_declared_version_count: 0, not_latest_count: 0,
      packages: ids.map(package_id => ({ package_id, declared_version: "0.1.8", declared_version_present: true,
        declared_version_is_latest_reported: true, listed_versions: ["0.1.8"], version_count: 1, latest_reported_version: "0.1.8" })) },
    "publish-plan": { ...base, schema: "tinyrustlm.nuget.publish_plan.v0", status: "dry_run", dry_run: true,
      skip_verification: true, package_source: "feed", nuget_source: "feed", package_audit_status: "pass",
      package_audit_match: true, package_audit_report_sha256: hash, package_hash_manifest_match: true,
      package_hash_manifest_status: "pass", package_hash_manifest_sha256: hash,
      symbol_publish_mode: "explicit_snupkg_push_after_primary_package", package_count: 3, symbol_package_count: 3,
      packages: packaged("nupkg"), symbol_packages: packaged("snupkg"),
      expected_package_names: packaged("nupkg").map(row => row.name), expected_symbol_package_names: packaged("snupkg").map(row => row.name) },
    "feed-hashes": { ...base, schema: "tinyrustlm.nuget.feed_hashes.v0", source: "feed", source_kind: "folder",
      publish_plan_schema: "tinyrustlm.nuget.publish_plan.v0", publish_plan_report_sha256: hash,
      package_audit_report_sha256: hash, package_hash_manifest_sha256: hash, package_hash_manifest_match: true,
      package_count: 3, missing_package_count: 0, hash_mismatch_count: 0, byte_count_mismatch_count: 0,
      package_integrity_mismatch_count: 0, repository_signature_accepted_count: 0, packages: hashRows,
      symbol_package_expected_count: 3, symbol_package_count: 3, symbol_package_verification_mode: "folder",
      missing_symbol_package_count: 0, symbol_hash_mismatch_count: 0, symbol_byte_count_mismatch_count: 0,
      symbol_packages: structuredClone(hashRows) },
    readiness: { ...base, schema: "tinyrustlm.nuget.release_readiness.v0", status: "ready_to_publish",
      expected_package_ids: ids, package_graph_match: true, blockers: [], package_hash_manifest_match: true,
      package_hash_manifest_sha256: hash, publish_plan_status: "dry_run", publish_plan_package_count: 3,
      publish_plan_symbol_package_count: 3, local_feed_hash_package_count: 3, local_feed_hash_symbol_package_count: 3,
      local_feed_hash_status: "pass", local_feed_hash_symbol_verification_mode: "folder", local_feed_hash_mismatch_count: 0,
      local_feed_hash_symbol_mismatch_count: 0, local_feed_hash_symbol_byte_count_mismatch_count: 0,
      api_key_present: true, auth_mode: "api_key", trusted_publishing_requested: false, trusted_publishing_supported: false,
      remote_feed_state: "missing", steps: [
        ["publish_plan_dry_run", "pass", true, "dry_run"], ["local_feed_current", "pass", true, "pass"],
        ["local_feed_hashes", "pass", true, "pass"], ["remote_feed_current", "fail", true, "fail"],
        ["remote_feed_hashes", "skipped", false, ""]
      ].map(([name, status, report_written, report_status]) => ({ name, status, report_written, report_status })) }
  };
}

for (const [kind, report] of Object.entries(fixtures())) {
  test(`${kind} admits complete evidence and rejects contradictory envelopes`, () => {
    assert.equal(validateReport(kind, report), report);
    for (const change of [{ schema: "obsolete" }, { generated_utc: "invalid" }, { status: "fail" }]) {
      assert.throws(() => validateReport(kind, { ...report, ...change }));
    }
    assert.throws(() => validateReport(kind, null));
  });
}

test("passing labels cannot conceal missing packages, false hashes or unfinished work", async t => {
  const cases = [
    ["feed-current", r => { r.packages.pop(); }],
    ["feed-current", r => { r.packages[0].package_id = ids[1]; }],
    ["feed-current", r => { r.packages[0].declared_version_present = "true"; }],
    ["feed-current", r => { r.packages[0].listed_versions = ["0.2.0"]; }],
    ["feed-current", r => { r.packages[0].version_count = 10; }],
    ["feed-current", r => { r.not_latest_count = 1; }],
    ["publish-plan", r => { r.symbol_packages = []; }],
    ["publish-plan", r => { r.packages[0].name = "unrelated.nupkg"; }],
    ["publish-plan", r => { r.packages[0].byte_count = 0; }],
    ["publish-plan", r => { r.package_audit_match = false; }],
    ["publish-plan", r => { r.package_hash_manifest_status = "missing"; }],
    ["publish-plan", r => { r.dry_run = false; }],
    ["feed-hashes", r => { r.packages[0].actual_sha256 = "b".repeat(64); }],
    ["feed-hashes", r => { r.packages[0].actual_byte_count = 43; }],
    ["feed-hashes", r => { r.package_integrity_mismatch_count = 1; }],
    ["feed-hashes", r => { r.packages[0].payload_verification.match = false; }],
    ["feed-hashes", r => { r.symbol_packages[0].present = false; }],
    ["feed-smoke", r => { r.local_piece_assembly_verified = false; }],
    ["feed-smoke", r => { r.consumer_output_sha256 = ""; }],
    ["feed-smoke", r => { r.secret_material_included = true; }],
    ["readiness", r => { r.api_key_present = false; }],
    ["readiness", r => { r.blockers.push("unverified"); }],
    ["readiness", r => { r.steps[0].report_written = false; }],
    ["readiness", r => { r.remote_feed_state = "unknown"; }],
    ["ui", r => { r.gates.chromium_release = "skipped"; }],
    ["ui", r => { r.gates.static_contract = "not_run"; }],
    ["ui", r => { r.gates.additional_gate = "fail"; }],
    ["ui", r => { r.browser_smoke_requested = "true"; }],
    ["public-root", r => { delete r.ui_verification_sha256; }]
  ];
  for (const [index, [kind, change]] of cases.entries()) await t.test(`${kind} mutation ${index}`, () => {
    const report = fixtures()[kind]; change(report); assert.throws(() => validateReport(kind, report));
  });
});

test("allow-newer and trusted-publishing choices retain explicit requirements", () => {
  const reports = fixtures(); const feed = reports["feed-current"];
  for (const row of feed.packages) Object.assign(row, { latest_reported_version: "0.2.0",
    declared_version_is_latest_reported: false, listed_versions: ["0.1.8", "0.2.0"], version_count: 2 });
  assert.throws(() => validateReport("feed-current", feed));
  feed.allow_newer = true; validateReport("feed-current", feed);
  const r = reports.readiness;
  Object.assign(r, { auth_mode: "trusted_publishing", trusted_publishing_requested: true, api_key_present: false });
  assert.throws(() => validateReport("readiness", r));
  r.trusted_publishing_supported = true; validateReport("readiness", r);
  const ui = reports.ui;
  ui.browser_smoke_requested = false;
  ui.gates.chromium_release = ui.gates.browser_contracts = ui.gates.acquisition_playwright = "skipped";
  validateReport("ui", ui);
  ui.deep_acquisition_requested = true;
  for (const key of ["acquisition_browser_bridge", "acquisition_companion", "acquisition_converter"]) ui.gates[key] = "pass";
  assert.throws(() => validateReport("ui", ui));
});

test("signed NuGet payloads require precise signature-only differences", () => {
  const r = fixtures()["feed-hashes"];
  Object.assign(r, { source_kind: "nuget-v3", symbol_packages: [], symbol_package_count: 0,
    symbol_package_verification_mode: "nuget_v3_package_feed_does_not_expose_snupkg_symbols" });
  validateReport("feed-hashes", r);
  const row = r.packages[0];
  Object.assign(row, { actual_sha256: "b".repeat(64), actual_byte_count: 60, sha256_match: false,
    byte_count_match: false, repository_signature_accepted: true });
  Object.assign(r, { hash_mismatch_count: 1, byte_count_mismatch_count: 1, repository_signature_accepted_count: 1 });
  row.payload_verification = { mode: "zip_payload_allow_repository_signature", match: true, repository_signature_accepted: true,
    missing_entry_count: 0, unexpected_entry_count: 0, changed_entry_count: 0, missing_entries: [], unexpected_entries: [],
    changed_entries: [], allowed_extra_entries: [".signature.p7s"], extra_allowed_entries: [".signature.p7s"] };
  validateReport("feed-hashes", r);
  row.payload_verification.changed_entries.push("lib/changed.dll");
  assert.throws(() => validateReport("feed-hashes", r));
});

test("file boundary rejects absent, oversized, duplicate-key and invalid-encoding reports", () => {
  const owned = createOwnedTemporaryDirectory({ temporaryParent: path.join(root, "artifacts/tests/release-reports") });
  const file = path.join(owned.rootPath, "report.json");
  try {
    assert.throws(() => verifyReportFile("feed-smoke", file));
    assert.throws(() => verifyReportFile("feed-smoke", owned.rootPath));
    assert.throws(() => verifyReportFile("unknown", file));
    for (const bytes of [Buffer.alloc(0), Buffer.alloc(maximumBytes + 1), Buffer.from([0xff]),
      Buffer.from('{"status":"fail","status":"pass"}'), Buffer.from('{"private":"never-print-this"')]) {
      fs.writeFileSync(file, bytes);
      assert.throws(() => verifyReportFile("feed-smoke", file));
    }
    const report = fixtures()["feed-smoke"];
    fs.writeFileSync(file, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(JSON.stringify(report))]));
    verifyReportFile("feed-smoke", file);
    const good = spawnSync(process.execPath, ["eng/verify-release-report.js", "feed-smoke", file],
      { cwd: root, encoding: "utf8", timeout: 10000, windowsHide: true });
    assert.equal(good.status, 0, good.stderr);
    fs.writeFileSync(file, '{"private":"never-print-this"');
    const bad = spawnSync(process.execPath, ["eng/verify-release-report.js", "feed-smoke", file],
      { cwd: root, encoding: "utf8", timeout: 10000, windowsHide: true });
    assert.equal(bad.status, 1); assert.doesNotMatch(bad.stderr, /never-print-this/);
    const usage = spawnSync(process.execPath, ["eng/verify-release-report.js"],
      { cwd: root, encoding: "utf8", timeout: 10000, windowsHide: true });
    assert.equal(usage.status, 1);
  } finally { removeOwnedTemporaryDirectory(owned); }
});

test("public-root report binds the exact successful browser report and application", () => {
  const owned = createOwnedTemporaryDirectory({ temporaryParent: path.join(root, "artifacts/tests/release-reports") });
  try {
    const { ui, "public-root": report } = fixtures();
    const file = path.join(owned.rootPath, "root.json");
    report.ui_verification_report = path.join(owned.rootPath, "ui.json");
    const write = () => {
      const bytes = Buffer.from(JSON.stringify(ui)); fs.writeFileSync(report.ui_verification_report, bytes);
      report.ui_verification_sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
      fs.writeFileSync(file, JSON.stringify(report));
    };
    write(); verifyReportFile("public-root", file);
    fs.appendFileSync(report.ui_verification_report, " ");
    assert.throws(() => verifyReportFile("public-root", file));
    ui.app_root = "different"; write(); assert.throws(() => verifyReportFile("public-root", file));
    ui.app_root = report.app_root; ui.browser_smoke_requested = false;
    ui.gates.chromium_release = ui.gates.browser_contracts = "skipped";
    write(); assert.throws(() => verifyReportFile("public-root", file));
    fs.unlinkSync(report.ui_verification_report); assert.throws(() => verifyReportFile("public-root", file));
  } finally { removeOwnedTemporaryDirectory(owned); }
});

test("actual PowerShell report writer produces an admitted smoke envelope", {
  skip: process.platform !== "win32" ? "PowerShell 5 writer encoding is exercised on Windows." : false
}, () => {
  const owned = createOwnedTemporaryDirectory({ temporaryParent: path.join(root, "artifacts/tests/release-reports") });
  try {
    // Execute the actual writer functions, not the expensive gates or a copied script.
    const program = `
$ErrorActionPreference = 'Stop'
$payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
function Import-Writer($File, $Names) {
  $tokens = $null; $errors = $null
  $ast = [System.Management.Automation.Language.Parser]::ParseFile($File, [ref]$tokens, [ref]$errors)
  if ($errors.Count) { throw 'writer parse failed' }
  foreach ($name in $Names) {
    $definition = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name }, $true)
    if ($null -eq $definition) { throw 'writer missing' }
    Set-Item -Path "Function:script:$name" -Value ([scriptblock]::Create($definition.Body.Extent.Text.TrimStart('{').TrimEnd('}')))
  }
}
$RepoRoot = $payload.root; $Root = Join-Path $RepoRoot 'tinyrustlm'
$NuGetSource = 'fixture-feed'; $PackageVersion = '0.1.8'
Import-Writer (Join-Path $RepoRoot 'eng/verify-feed.ps1') @('Get-Sha256Text', 'Write-FeedSmokeReport')
Write-FeedSmokeReport -OutputPath (Join-Path $payload.output 'smoke.json') -Status 'pass' -ErrorMessage '' -ConsumerOutput 'consumer-smoke-slm2-assembled'
`;
    const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", program], {
      cwd: root, input: JSON.stringify({ root, output: owned.rootPath, ui: fixtures().ui }),
      encoding: "utf8", timeout: 10000, windowsHide: true
    });
    assert.equal(result.status, 0, result.stderr);
    verifyReportFile("feed-smoke", path.join(owned.rootPath, "smoke.json"));
  } finally { removeOwnedTemporaryDirectory(owned); }
});

test("every workflow report command executes and fails on missing required evidence", () => {
  const owned = createOwnedTemporaryDirectory({ temporaryParent: path.join(root, "artifacts/tests/release-reports") });
  try {
    let count = 0;
    for (const name of ["ci", "release-nuget", "nuget-feed-monitor"]) {
      const source = fs.readFileSync(path.join(root, `.github/workflows/${name}.yml`), "utf8");
      assert.doesNotMatch(source, /MachineReadableWhenPresent/);
      for (const match of source.matchAll(/run: (node eng\/verify-release-report.js ([a-z-]+) "\$env:([A-Z_]+)")/g)) {
        count++;
        const env = { ...process.env, [match[3]]: path.join(owned.rootPath, "missing.json"), NODE_V8_COVERAGE: "" };
        const result = process.platform === "win32"
          ? spawnSync("powershell.exe", ["-NoProfile", "-Command", match[1] + "; exit $LASTEXITCODE"],
            { cwd: root, env, encoding: "utf8", timeout: 10000, windowsHide: true })
          : spawnSync(process.execPath, ["eng/verify-release-report.js", match[2], env[match[3]]],
            { cwd: root, env, encoding: "utf8", timeout: 10000 });
        assert.equal(result.status, 1, result.stderr);
        assert.match(result.stderr, /Release report validation failed/);
      }
    }
    assert.equal(count, 10);
  } finally { removeOwnedTemporaryDirectory(owned); }
});
