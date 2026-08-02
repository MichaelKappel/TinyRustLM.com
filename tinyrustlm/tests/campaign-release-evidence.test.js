"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { recordCampaignReleaseEvidence } = require("../tools/campaign-release-evidence.js");

const campaignId = "release-evidence-test-20260715";

function writeJson(root, name, value) {
  const target = path.join(root, name);
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
  return target;
}

function fixtures(root, physicalArm64 = false) {
  const packageZeroFields = [
    "missing_package_count", "unexpected_package_count", "missing_symbol_package_count",
    "unexpected_symbol_package_count", "package_identity_mismatch_count",
    "symbol_package_identity_mismatch_count", "missing_metadata_count",
    "metadata_policy_violation_count", "missing_search_term_count", "missing_package_file_count",
    "package_documentation_mismatch_count", "missing_dependency_count",
    "unexpected_dependency_count", "unexpected_native_entry_count",
    "unexpected_package_content_entry_count", "missing_public_api_entry_count",
    "unexpected_public_api_entry_count", "missing_documentation_count", "source_file_count",
    "debug_symbol_count", "generated_output_count", "absolute_path_match_count",
    "symbol_package_unexpected_entry_count", "symbol_package_missing_pdb_count",
    "symbol_package_source_file_count", "symbol_package_generated_output_count",
    "symbol_package_absolute_path_match_count"
  ];
  const packageAudit = {
    schema: "tinyrustlm.nuget.package_audit.v0",
    generated_utc: "2026-07-15T07:00:00.000Z",
    status: "pass",
    package_version: "0.1.8",
    package_count: 4,
    symbol_package_count: 4,
    packages: [{}, {}, {}, {}],
    symbol_packages: [{}, {}, {}, {}]
  };
  for (const field of packageZeroFields) packageAudit[field] = 0;
  const playwright = {
    config: { projects: ["desktop", "narrow-desktop", "mobile", "reduced-motion"]
      .map((name) => ({ name })) },
    stats: {
      startTime: "2026-07-15T07:01:00.000Z",
      duration: 12_345,
      expected: 34,
      skipped: 3,
      unexpected: 0,
      flaky: 0
    }
  };
  const native = {
    schema: "tinyrustlm.seed_host_release_verification.v1",
    generated_utc: "2026-07-15T07:02:00.000Z",
    status: "pass",
    package_id: "UAIX.Browser.p2pRuntime.SeedHost.Tool",
    version: "0.1.10",
    execution: [
      { rid: "win-x64", execution_environment: "native-windows-process", executed: true,
        emulated: false, physical_hardware: true, doctor_passed: true, native_abi_version: 2,
        empty_fleet_lifecycle_passed: true },
      { rid: "linux-x64", execution_environment: "wsl2-linux-process", executed: true,
        emulated: false, physical_hardware: true, doctor_passed: true, native_abi_version: 2,
        empty_fleet_lifecycle_passed: true },
      { rid: "linux-arm64", execution_environment: physicalArm64 ? "native-arm64" : "qemu",
        executed: true, emulated: !physicalArm64, physical_hardware: physicalArm64,
        doctor_passed: true, native_abi_version: 2, empty_fleet_lifecycle_passed: true }
    ],
    executed_rid_count: 3,
    physical_linux_arm64_executed: physicalArm64
  };
  const publicRoot = {
    schema: "tinyrustlm.public_root_verification.v0",
    generated_utc: "2026-07-15T07:03:00.000Z",
    status: "pass",
    smoke_modes: ["public-local-only"],
    smoke_statuses: { "public-local-only": "pass" }
  };
  const publicDocs = {
    schema: "tinyrustlm.docs.public_site_audit.v0",
    generated_utc: "2026-07-15T07:04:00.000Z",
    status: "pass",
    secret_material_included: false,
    site_roots: [{ path: "redacted" }],
    missing_site_root_count: 0,
    missing_file_count: 0,
    failed_check_count: 0,
    stale_match_count: 0
  };
  return {
    nativeRidReportPath: writeJson(root, "native.json", native),
    packageAuditPath: writeJson(root, "package.json", packageAudit),
    playwrightReportPath: writeJson(root, "playwright.json", playwright),
    publicDocsReportPath: writeJson(root, "docs.json", publicDocs),
    publicRootReportPath: writeJson(root, "root.json", publicRoot)
  };
}

test("records passing local gates while blocking an emulated-only ARM64 final gate", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-release-evidence-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const result = recordCampaignReleaseEvidence({
    ...fixtures(root, false),
    campaignId,
    evidenceRoot: path.join(root, "evidence"),
    sourceRevision: "a".repeat(40)
  });
  assert.equal(result.packageReceipt.status, "pass");
  assert.equal(result.browserReceipt.status, "pass");
  assert.equal(result.browserReceipt.publicSafeParameters.campaignDogfoodRoundCount, 0);
  assert.equal(result.nativeReceipt.status, "blocked");
  assert.equal(result.nativeReceipt.blockerCode,
    "physical_linux_arm64_hardware_evidence_absent");
  assert.equal(result.nativeReceipt.publicSafeParameters.executedRidCount, 3);
  assert.equal(result.publicSiteReceipt.status, "pass");
  assert.equal(result.publicSiteReceipt.publicSafeParameters.publicHttpsReadback, false);
  assert.equal(result.publicReadbackReceipt.status, "blocked");
  assert.equal(result.publicReadbackReceipt.publicSafeParameters.announcementCount, 0);

  const repeated = recordCampaignReleaseEvidence({
    ...fixtures(root, false),
    campaignId,
    evidenceRoot: path.join(root, "evidence"),
    sourceRevision: "a".repeat(40)
  });
  assert.equal(repeated.packageReceipt.receiptId, result.packageReceipt.receiptId);
  assert.equal(repeated.nativeReceipt.receiptId, result.nativeReceipt.receiptId);
});

test("rejects a Playwright report with flaky tests", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-release-flaky-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const input = fixtures(root, true);
  const report = JSON.parse(fs.readFileSync(input.playwrightReportPath, "utf8"));
  report.stats.flaky = 1;
  fs.writeFileSync(input.playwrightReportPath, `${JSON.stringify(report)}\n`);
  assert.throws(() => recordCampaignReleaseEvidence({
    ...input,
    campaignId,
    evidenceRoot: path.join(root, "evidence"),
    sourceRevision: "b".repeat(40)
  }), /unexpected or flaky/);
});

test("rejects caller-asserted HTTPS truth and local catalog inputs", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-release-obsolete-readback-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.throws(() => recordCampaignReleaseEvidence({
    ...fixtures(root, false),
    campaignId,
    evidenceRoot: path.join(root, "evidence"),
    publicHttpsReadback: true,
    sourceRevision: "c".repeat(40)
  }), /publicHttpsReadback is obsolete/i);
});
