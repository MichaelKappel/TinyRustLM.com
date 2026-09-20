"use strict";

const fs = require("node:fs");
const crypto = require("node:crypto");
const { parseStrictJson } = require("../tinyrustlm/tools/strict-json.js");

const maximumBytes = 4 * 1024 * 1024;
const packageIds = ["TinyRustLM.Abstractions", "TinyRustLM.Core", "TinyRustLM.P2P"];
const schemas = Object.freeze({
  "feed-current": "tinyrustlm.nuget.feed_current.v0",
  "feed-hashes": "tinyrustlm.nuget.feed_hashes.v0",
  "feed-smoke": "tinyrustlm.nuget.feed_smoke.v0",
  "publish-plan": "tinyrustlm.nuget.publish_plan.v0",
  readiness: "tinyrustlm.nuget.release_readiness.v0",
  ui: "tinyrustlm.ui_verification.v2",
  "public-root": "tinyrustlm.public_root_verification.v1"
});

/** Report errors name the violated contract, never echo report contents. */
function requireValue(condition, field) {
  if (!condition) throw new Error(`Release report rejected: ${field}`);
}

/** Require a named nonempty string without coercion. */
function text(value, field) { requireValue(typeof value === "string" && value.trim().length > 0, field); }
/** Compare a named evidence value without type coercion. */
function equal(value, expected, field) { requireValue(value === expected, field); }
/** Require a lowercase SHA-256 identity for the named evidence field. */
function digest(value, field) { requireValue(typeof value === "string" && /^[a-f0-9]{64}$/.test(value), field); }
/** Keep boolean claims distinct from truthy strings or numbers. */
function boolean(value, field) { requireValue(typeof value === "boolean", field); }
/** Require a positive, exactly representable byte count. */
function positive(value, field) { requireValue(Number.isSafeInteger(value) && value > 0, field); }

/** Require the complete current package set, with no duplicate or extra member. */
function exactSet(actual, expected, field) {
  requireValue(Array.isArray(actual) && actual.length === expected.length &&
    new Set(actual).size === actual.length && expected.every(value => actual.includes(value)), field);
}

/** Check a package array and its declared count before inspecting individual rows. */
function packages(report, field, countField) {
  const rows = report[field];
  requireValue(Array.isArray(rows) && rows.every(row => row && typeof row === "object"), field);
  exactSet(rows.map(row => row.package_id), packageIds, field);
  equal(report[countField], rows.length, countField);
  return rows;
}

/** Reject absent, linked, nonregular and oversized files before bounded reading. */
function readReportBytes(file) {
  text(file, "report path");
  requireValue(!fs.lstatSync(file).isSymbolicLink(), "linked report");
  const fd = fs.openSync(file, "r");
  try {
    const stat = fs.fstatSync(fd);
    requireValue(stat.isFile() && stat.size > 0 && stat.size <= maximumBytes, "report size/type");
    const buffer = Buffer.alloc(maximumBytes + 1);
    let length = 0;
    while (length < buffer.length) {
      const count = fs.readSync(fd, buffer, length, buffer.length - length, null);
      if (count === 0) break;
      length += count;
    }
    equal(length, stat.size, "report changed while reading");
    return buffer.subarray(0, length);
  } finally { fs.closeSync(fd); }
}

/** PowerShell 5 emits a UTF-8 BOM; strip that encoding marker only, then parse strictly. */
function parseReport(bytes) {
  const body = bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])) ? bytes.subarray(3) : bytes;
  return parseStrictJson(body, { maximumBytes, maximumTotalStringCodeUnits: maximumBytes });
}

/** Validate passing current-format evidence; this does not rerun its underlying experiment. */
function validateReport(kind, report) {
  requireValue(Object.hasOwn(schemas, kind), "report kind");
  requireValue(report !== null && typeof report === "object" && !Array.isArray(report), "report object");
  equal(report.schema, schemas[kind], "schema");
  requireValue(typeof report.generated_utc === "string" && /Z$/.test(report.generated_utc) &&
    Number.isFinite(Date.parse(report.generated_utc)), "generated_utc");
  if (kind !== "ui" && kind !== "public-root") text(report.package_version, "package_version");
  if (kind !== "ui" && kind !== "public-root" && kind !== "feed-current") {
    equal(report.secret_material_included, false, "secret_material_included");
  }
  const accepted = kind === "readiness" ? ["ready_to_publish", "published_current"] :
    kind === "publish-plan" ? ["dry_run", "ready_to_push", "pushed"] : ["pass"];
  requireValue(accepted.includes(report.status), "status");

  if (kind === "feed-current") {
    exactSet(report.package_ids, packageIds, "package_ids");
    text(report.source, "source");
    requireValue(["folder", "nuget-v3"].includes(report.source_kind), "source_kind");
    boolean(report.allow_newer, "allow_newer");
    for (const row of packages(report, "packages", "package_count")) {
      equal(row.declared_version, report.package_version, "declared_version");
      equal(row.declared_version_present, true, "declared_version_present");
      boolean(row.declared_version_is_latest_reported, "declared_version_is_latest_reported");
      requireValue(Array.isArray(row.listed_versions) && row.listed_versions.every(v => typeof v === "string") &&
        row.listed_versions.includes(report.package_version), "listed_versions");
      equal(row.version_count, row.listed_versions.length, "version_count");
      requireValue(row.listed_versions.includes(row.latest_reported_version), "latest_reported_version");
      equal(row.declared_version_is_latest_reported, row.latest_reported_version === report.package_version, "latest consistency");
      requireValue(report.allow_newer || row.declared_version_is_latest_reported, "newer version disallowed");
    }
    equal(report.missing_declared_version_count, 0, "missing_declared_version_count");
    equal(report.not_latest_count, 0, "not_latest_count");
  } else if (kind === "publish-plan") {
    boolean(report.dry_run, "dry_run");
    equal(report.dry_run, report.status === "dry_run", "dry_run status");
    boolean(report.skip_verification, "skip_verification");
    text(report.package_source, "package_source");
    text(report.nuget_source, "nuget_source");
    for (const name of ["package_audit", "package_hash_manifest"]) {
      equal(report[`${name}_match`], true, `${name}_match`);
      equal(report[`${name}_status`], "pass", `${name}_status`);
      digest(report[name === "package_audit" ? "package_audit_report_sha256" : `${name}_sha256`], name);
    }
    equal(report.symbol_publish_mode, "explicit_snupkg_push_after_primary_package", "symbol_publish_mode");
    for (const [field, count, extension, names] of [
      ["packages", "package_count", "nupkg", "expected_package_names"],
      ["symbol_packages", "symbol_package_count", "snupkg", "expected_symbol_package_names"]
    ]) {
      const rows = packages(report, field, count);
      for (const row of rows) {
        equal(row.name, `${row.package_id}.${report.package_version}.${extension}`, "package name");
        text(row.path, "package path"); digest(row.sha256, "package sha256"); positive(row.byte_count, "package byte_count");
      }
      exactSet(report[names], rows.map(row => row.name), names);
    }
  } else if (kind === "feed-hashes") {
    text(report.source, "source");
    requireValue(["folder", "nuget-v3"].includes(report.source_kind), "source_kind");
    equal(report.publish_plan_schema, schemas["publish-plan"], "publish_plan_schema");
    for (const field of ["publish_plan_report_sha256", "package_audit_report_sha256", "package_hash_manifest_sha256"]) digest(report[field], field);
    equal(report.package_hash_manifest_match, true, "package_hash_manifest_match");
    const rows = packages(report, "packages", "package_count");
    for (const row of rows) {
      validateHashRow(row);
      equal(row.package_integrity_match, true, "package_integrity_match");
      boolean(row.repository_signature_accepted, "repository_signature_accepted");
      const payload = row.payload_verification;
      requireValue(payload && payload.match === true, "payload_verification");
      equal(payload.repository_signature_accepted, row.repository_signature_accepted, "signature agreement");
      if (row.repository_signature_accepted) {
        equal(report.source_kind, "nuget-v3", "repository signature source");
        equal(payload.mode, "zip_payload_allow_repository_signature", "payload mode");
        for (const field of ["missing", "unexpected", "changed"]) {
          equal(payload[`${field}_entry_count`], 0, `payload ${field} count`);
          exactSet(payload[`${field}_entries`], [], `payload ${field} entries`);
        }
        exactSet(payload.allowed_extra_entries, [".signature.p7s"], "allowed signature entry");
        exactSet(payload.extra_allowed_entries, [".signature.p7s"], "observed signature entry");
      } else {
        equal(payload.mode, "exact_package_bytes", "payload mode");
        requireValue(row.sha256_match && row.byte_count_match, "exact package bytes");
      }
    }
    equal(report.hash_mismatch_count, rows.filter(row => !row.sha256_match).length, "hash_mismatch_count");
    equal(report.byte_count_mismatch_count, rows.filter(row => !row.byte_count_match).length, "byte_count_mismatch_count");
    equal(report.repository_signature_accepted_count, rows.filter(row => row.repository_signature_accepted).length, "repository_signature_accepted_count");
    equal(report.symbol_package_expected_count, packageIds.length, "symbol_package_expected_count");
    if (report.source_kind === "folder") {
      equal(report.symbol_package_verification_mode, "folder", "symbol mode");
      for (const row of packages(report, "symbol_packages", "symbol_package_count")) {
        validateHashRow(row);
        requireValue(row.sha256_match && row.byte_count_match, "exact symbol bytes");
      }
    } else {
      equal(report.symbol_package_verification_mode, "nuget_v3_package_feed_does_not_expose_snupkg_symbols", "symbol mode");
      exactSet(report.symbol_packages, [], "remote symbols"); equal(report.symbol_package_count, 0, "remote symbol count");
    }
    for (const field of ["missing_package_count", "package_integrity_mismatch_count", "missing_symbol_package_count",
      "symbol_hash_mismatch_count", "symbol_byte_count_mismatch_count"]) equal(report[field], 0, field);
  } else if (kind === "feed-smoke") {
    text(report.nuget_source, "nuget_source");
    equal(report.local_piece_assembly_verified, true, "local_piece_assembly_verified");
    digest(report.consumer_output_sha256, "consumer_output_sha256");
    exactSet(report.canonical_vectors, ["contracts/vnext/slm2-q8-weight-vectors.v1.json",
      "contracts/vnext/acg2-format-vectors.v1.json"], "canonical_vectors");
  } else if (kind === "readiness") {
    exactSet(report.expected_package_ids, packageIds, "expected_package_ids");
    equal(report.package_graph_match, true, "package_graph_match");
    exactSet(report.blockers, [], "blockers");
    equal(report.package_hash_manifest_match, true, "package_hash_manifest_match");
    digest(report.package_hash_manifest_sha256, "package_hash_manifest_sha256");
    equal(report.publish_plan_status, "dry_run", "publish_plan_status");
    for (const field of ["publish_plan_package_count", "publish_plan_symbol_package_count",
      "local_feed_hash_package_count", "local_feed_hash_symbol_package_count"]) equal(report[field], packageIds.length, field);
    equal(report.local_feed_hash_status, "pass", "local_feed_hash_status");
    equal(report.local_feed_hash_symbol_verification_mode, "folder", "local symbol mode");
    for (const field of ["local_feed_hash_mismatch_count", "local_feed_hash_symbol_mismatch_count",
      "local_feed_hash_symbol_byte_count_mismatch_count"]) equal(report[field], 0, field);
    boolean(report.api_key_present, "api_key_present");
    boolean(report.trusted_publishing_requested, "trusted_publishing_requested");
    boolean(report.trusted_publishing_supported, "trusted_publishing_supported");
    requireValue(["api_key", "trusted_publishing"].includes(report.auth_mode), "auth_mode");
    equal(report.trusted_publishing_requested, report.auth_mode === "trusted_publishing", "auth agreement");
    const current = report.status === "published_current";
    equal(report.remote_feed_state, current ? "current" : "missing", "remote_feed_state");
    requireValue(current || (report.auth_mode === "api_key" ? report.api_key_present : report.trusted_publishing_supported), "publication authentication");
    requireValue(Array.isArray(report.steps), "steps");
    exactSet(report.steps.map(step => step.name), ["publish_plan_dry_run", "local_feed_current", "local_feed_hashes",
      "remote_feed_current", "remote_feed_hashes"], "step names");
    for (const step of report.steps) {
      const skipped = !current && step.name === "remote_feed_hashes";
      const missing = !current && step.name === "remote_feed_current";
      equal(step.status, skipped ? "skipped" : missing ? "fail" : "pass", "step status");
      equal(step.report_written, !skipped, "step report_written");
      equal(step.report_status, skipped ? "" : missing ? "fail" : step.name === "publish_plan_dry_run" ? "dry_run" : "pass", "step report_status");
    }
  } else if (kind === "ui") {
    for (const field of ["run_id", "repository_root", "app_root"]) text(report[field], field);
    requireValue(report.gates && typeof report.gates === "object", "gates");
    for (const flag of ["browser_smoke_requested", "deep_acquisition_requested", "visual_lock_requested"]) boolean(report[flag], flag);
    exactSet(Object.keys(report.gates), ["source_authority", "static_contract", "javascript_syntax",
      "interview_demo_no_browser", "acquisition_playwright", "browser_contracts", "chromium_release",
      "acquisition_browser_bridge", "acquisition_companion", "acquisition_converter", "visual_lock", "temporary_cleanup"], "UI gate set");
    for (const gate of ["source_authority", "static_contract", "javascript_syntax", "interview_demo_no_browser", "temporary_cleanup"]) equal(report.gates[gate], "pass", gate);
    equal(report.evidence?.cleanup, "removed", "UI temporary cleanup");
    for (const [flag, gates] of [
      ["browser_smoke_requested", ["acquisition_playwright", "browser_contracts", "chromium_release"]],
      ["deep_acquisition_requested", ["acquisition_browser_bridge", "acquisition_companion", "acquisition_converter"]],
      ["visual_lock_requested", ["visual_lock"]]
    ]) for (const gate of gates) equal(report.gates[gate], report[flag] ? "pass" : "skipped", gate);
    requireValue(Object.values(report.gates).every(value => ["pass", "skipped"].includes(value)), "unfinished UI gate");
    requireValue(!report.deep_acquisition_requested || report.browser_smoke_requested, "deep browser requirement");
  } else {
    for (const field of ["run_id", "repository_root", "app_root", "ui_verification_report"]) text(report[field], field);
    digest(report.ui_verification_sha256, "ui_verification_sha256");
  }
  return report;
}

/** Independently recompute the exact-byte claims from recorded identities. */
function validateHashRow(row) {
  equal(row.present, true, "package present");
  for (const prefix of ["expected", "actual"]) {
    digest(row[`${prefix}_sha256`], `${prefix}_sha256`);
    positive(row[`${prefix}_byte_count`], `${prefix}_byte_count`);
  }
  equal(row.sha256_match, row.expected_sha256 === row.actual_sha256, "sha256_match");
  equal(row.byte_count_match, row.expected_byte_count === row.actual_byte_count, "byte_count_match");
}

/** Validate the named file; public-root evidence must bind the actual passing browser report. */
function verifyReportFile(kind, file) {
  requireValue(Object.hasOwn(schemas, kind), "report kind");
  const report = validateReport(kind, parseReport(readReportBytes(file)));
  if (kind === "public-root") {
    const bytes = readReportBytes(report.ui_verification_report);
    equal(crypto.createHash("sha256").update(bytes).digest("hex"), report.ui_verification_sha256, "UI report byte binding");
    const ui = validateReport("ui", parseReport(bytes));
    equal(ui.app_root, report.app_root, "UI app identity");
    equal(ui.repository_root, report.repository_root, "UI repository identity");
    equal(ui.browser_smoke_requested, true, "public root browser evidence");
  }
  return report;
}

if (require.main === module) {
  try {
    requireValue(process.argv.length === 4, "usage: node eng/verify-release-report.js KIND REPORT");
    verifyReportFile(process.argv[2], process.argv[3]);
    process.stdout.write("Release report validated.\n");
  } catch {
    // JSON parser/system errors can contain private report data or paths; do not print them.
    process.stderr.write("Release report validation failed; check the required file and its evidence contract.\n");
    process.exitCode = 1;
  }
}

module.exports = { validateReport, verifyReportFile, maximumBytes };
