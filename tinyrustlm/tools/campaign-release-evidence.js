"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { CampaignEvidenceStore, canonicalJson } = require("./campaign-evidence-store.js");
const {
  persistPublicReleaseReadbackEvidence,
  publicReadbackReceiptType
} = require("./campaign-public-readback-evidence.js");

const maximumReportBytes = 8 * 1024 * 1024;
const receiptTypes = Object.freeze({
  browser: "tinyrustlm.browser-acceptance-verification-v1",
  native: "tinyrustlm.native-rid-verification-v1",
  package: "tinyrustlm.package-verification-v1",
  publicReadback: publicReadbackReceiptType,
  publicSite: "tinyrustlm.packaged-public-site-verification-v1"
});
const requiredNativeRids = Object.freeze(["win-x64", "linux-x64", "linux-arm64"]);

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readJsonReport(filePath, label) {
  const resolved = path.resolve(String(filePath || ""));
  const stat = fs.statSync(resolved, { throwIfNoEntry: false });
  invariant(stat?.isFile() && stat.size > 0 && stat.size <= maximumReportBytes,
    `${label} is missing or outside its size limit`);
  const bytes = fs.readFileSync(resolved);
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, ""));
  } catch (_error) {
    throw new Error(`${label} is not valid JSON`);
  }
  invariant(isPlainObject(value), `${label} must be a JSON object`);
  return Object.freeze({ bytes, hash: sha256(bytes), value });
}

function requireUtc(value, label) {
  const text = String(value || "");
  invariant(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(text) &&
    Number.isFinite(Date.parse(text)), `${label} must be UTC`);
  return text;
}

function requireNonnegativeInteger(value, label) {
  invariant(Number.isSafeInteger(value) && value >= 0, `${label} must be a nonnegative integer`);
  return value;
}

function validatePackageAudit(value) {
  invariant(value.schema === "tinyrustlm.nuget.package_audit.v0" && value.status === "pass",
    "NuGet package audit did not pass the supported schema");
  invariant(value.package_count === 4 && value.symbol_package_count === 4,
    "NuGet package audit must contain four packages and four symbol packages");
  const zeroFields = [
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
  for (const field of zeroFields) {
    invariant(value[field] === 0, `NuGet package audit ${field} is not zero`);
  }
  invariant(Array.isArray(value.packages) && value.packages.length === 4 &&
    Array.isArray(value.symbol_packages) && value.symbol_packages.length === 4,
  "NuGet package audit package arrays are incomplete");
  return Object.freeze({
    generatedAtUtc: requireUtc(value.generated_utc, "NuGet package audit time"),
    packageCount: value.package_count,
    packageVersion: String(value.package_version || ""),
    symbolPackageCount: value.symbol_package_count
  });
}

function validatePlaywrightReport(value) {
  invariant(isPlainObject(value.config) && isPlainObject(value.stats),
    "Playwright report is missing config or stats");
  const stats = value.stats;
  const expected = requireNonnegativeInteger(stats.expected, "Playwright expected count");
  const skipped = requireNonnegativeInteger(stats.skipped, "Playwright skipped count");
  invariant(expected > 0 && stats.unexpected === 0 && stats.flaky === 0,
    "Playwright acceptance report contains unexpected or flaky tests");
  invariant(Number.isFinite(stats.duration) && stats.duration > 0,
    "Playwright duration is invalid");
  invariant(Array.isArray(value.config.projects), "Playwright projects are missing");
  const projects = value.config.projects.map((project) => String(project?.name || ""));
  for (const required of ["desktop", "narrow-desktop", "mobile", "reduced-motion"]) {
    invariant(projects.includes(required), `Playwright project ${required} is missing`);
  }
  const startedAtUtc = requireUtc(stats.startTime, "Playwright start time");
  const completedAtUtc = new Date(Date.parse(startedAtUtc) + stats.duration).toISOString();
  return Object.freeze({
    completedAtUtc,
    durationMs: stats.duration,
    expected,
    projects: Object.freeze(projects.sort()),
    skipped,
    startedAtUtc
  });
}

function validateNativeReport(value) {
  invariant(value.schema === "tinyrustlm.seed_host_release_verification.v1" &&
    value.status === "pass", "native RID verification report did not pass the supported schema");
  invariant(Array.isArray(value.execution) && value.execution.length === requiredNativeRids.length,
    "native RID execution matrix is incomplete");
  const rows = new Map(value.execution.map((row) => [String(row?.rid || ""), row]));
  for (const rid of requiredNativeRids) {
    const row = rows.get(rid);
    invariant(isPlainObject(row) && row.executed === true && row.doctor_passed === true &&
      row.native_abi_version === 2 && row.empty_fleet_lifecycle_passed === true,
    `native RID ${rid} did not complete the required execution checks`);
  }
  const arm64 = rows.get("linux-arm64");
  invariant(arm64.emulated === !arm64.physical_hardware,
    "Linux ARM64 execution report has inconsistent physical/emulated evidence");
  invariant(value.executed_rid_count === requiredNativeRids.length,
    "native RID executed count is incomplete");
  invariant(value.physical_linux_arm64_executed === arm64.physical_hardware,
    "Linux ARM64 physical-hardware summary drifted");
  return Object.freeze({
    executedRidCount: value.executed_rid_count,
    generatedAtUtc: requireUtc(value.generated_utc, "native RID report time"),
    packageId: String(value.package_id || ""),
    physicalLinuxArm64Executed: value.physical_linux_arm64_executed,
    rows: Object.freeze(requiredNativeRids.map((rid) => Object.freeze({
      emulated: rows.get(rid).emulated,
      executed: rows.get(rid).executed,
      executionEnvironment: String(rows.get(rid).execution_environment || ""),
      physicalHardware: rows.get(rid).physical_hardware,
      rid
    }))),
    version: String(value.version || "")
  });
}

function validatePublicSiteReports(rootValue, docsValue) {
  invariant(rootValue.schema === "tinyrustlm.public_root_verification.v0" &&
    rootValue.status === "pass", "packaged public-root verification did not pass");
  invariant(Array.isArray(rootValue.smoke_modes) && rootValue.smoke_modes.length > 0,
    "packaged public-root smoke matrix is empty");
  for (const mode of rootValue.smoke_modes) {
    invariant(rootValue.smoke_statuses?.[mode] === "pass",
      `packaged public-root smoke mode ${mode} did not pass`);
  }
  invariant(docsValue.schema === "tinyrustlm.docs.public_site_audit.v0" &&
    docsValue.status === "pass", "public documentation-site audit did not pass");
  invariant(docsValue.secret_material_included === false && docsValue.missing_site_root_count === 0 &&
    docsValue.missing_file_count === 0 && docsValue.failed_check_count === 0 &&
    docsValue.stale_match_count === 0, "public documentation-site audit has findings");
  const rootUtc = requireUtc(rootValue.generated_utc, "public-root report time");
  const docsUtc = requireUtc(docsValue.generated_utc, "public-doc report time");
  return Object.freeze({
    completedAtUtc: new Date(Math.max(Date.parse(rootUtc), Date.parse(docsUtc))).toISOString(),
    publicDocSiteCount: Array.isArray(docsValue.site_roots) ? docsValue.site_roots.length : 0,
    smokeModeCount: rootValue.smoke_modes.length
  });
}

function runtimeIdentifier() {
  const osName = process.platform === "win32" ? "win" :
    process.platform === "darwin" ? "osx" : process.platform;
  return `${osName}-${process.arch}`;
}

function currentReceiptIds(receipts) {
  const superseded = new Set(receipts.flatMap((receipt) => receipt.supersedesReceiptIds));
  return receipts.filter((receipt) => !superseded.has(receipt.receiptId));
}

function putGateReceipt(store, input) {
  const prior = store.listReceipts((receipt) => receipt.receiptType === input.receiptType &&
    receipt.campaignId === input.campaignId);
  const existing = prior.find((receipt) => receipt.configurationHash === input.configurationHash &&
    canonicalJson(receipt.inputHashes) === canonicalJson(input.inputHashes) &&
    canonicalJson(receipt.outputHashes) === canonicalJson(input.outputHashes));
  if (existing) {
    return existing;
  }
  const current = currentReceiptIds(prior);
  invariant(current.length <= 1, `${input.receiptType} has several current receipts`);
  const attempt = prior.reduce((maximum, receipt) => Math.max(maximum, receipt.attempt), 0) + 1;
  return store.putReceipt({
    ...input,
    attempt,
    supersedesReceiptIds: current.map((receipt) => receipt.receiptId)
  }).receipt;
}

function recordCampaignReleaseEvidence(options) {
  invariant(isPlainObject(options), "campaign release evidence options are invalid");
  for (const obsolete of [
    "publicAnnouncementFeedPath", "publicCatalogPath", "publicHttpsReadback", "observedAtUtc"
  ]) {
    invariant(!Object.hasOwn(options, obsolete),
      `${obsolete} is obsolete; public readback must come from current deployment announcement receipts`);
  }
  const campaignId = String(options.campaignId || "");
  const sourceRevision = String(options.sourceRevision || "");
  invariant(/^[A-Za-z0-9][A-Za-z0-9._-]{2,159}$/.test(campaignId),
    "campaign ID is invalid");
  invariant(sourceRevision.length >= 7 && sourceRevision.length <= 256,
    "source revision is invalid");

  const packageAudit = readJsonReport(options.packageAuditPath, "NuGet package audit");
  const playwright = readJsonReport(options.playwrightReportPath, "Playwright report");
  const native = readJsonReport(options.nativeRidReportPath, "native RID report");
  const publicRoot = readJsonReport(options.publicRootReportPath, "public-root report");
  const publicDocs = readJsonReport(options.publicDocsReportPath, "public-doc report");
  const packageInspection = validatePackageAudit(packageAudit.value);
  const browserInspection = validatePlaywrightReport(playwright.value);
  const nativeInspection = validateNativeReport(native.value);
  const siteInspection = validatePublicSiteReports(publicRoot.value, publicDocs.value);
  const toolHash = sha256(fs.readFileSync(__filename));
  const store = new CampaignEvidenceStore(options.evidenceRoot);
  const rebuilt = store.rebuild();
  invariant(rebuilt.quarantined.length === 0 &&
    fs.readdirSync(store.quarantinePath, { withFileTypes: true }).every((entry) => !entry.isFile()),
  "campaign release evidence store contains quarantined files");
  const base = Object.freeze({
    campaignId,
    sourceRevision,
    toolNames: ["tinyrustlm-campaign-release-evidence"],
    toolVersions: ["1"],
    toolBinaryHashes: [toolHash],
    runtimeIdentifier: runtimeIdentifier(),
    operatingSystem: process.platform,
    architecture: process.arch,
    redactionVersion: "tinyrustlm.public-receipt-redaction.v1",
    attestationReference: null
  });

  const packageReceipt = putGateReceipt(store, {
    ...base,
    receiptType: receiptTypes.package,
    phase: "package-verification",
    status: "pass",
    createdAtUtc: packageInspection.generatedAtUtc,
    completedAtUtc: packageInspection.generatedAtUtc,
    inputReceiptIds: [],
    inputHashes: { packageAudit: packageAudit.hash },
    outputHashes: { packageAudit: packageAudit.hash },
    hardwareEvidence: { packageConsumerExecution: true },
    configurationHash: sha256(canonicalJson({ expectedPackages: 4, expectedSymbols: 4 })),
    publicSafeParameters: {
      packageCount: packageInspection.packageCount,
      packageVersion: packageInspection.packageVersion,
      symbolPackageCount: packageInspection.symbolPackageCount,
      packageAuditPassed: true
    },
    boundedDiagnostics: { reportSchema: packageAudit.value.schema },
    blockerCode: null,
    externalEvidenceReferences: [],
    evidenceClass: "package",
    supersedesReceiptIds: []
  });

  const browserReceipt = putGateReceipt(store, {
    ...base,
    receiptType: receiptTypes.browser,
    phase: "browser-acceptance-verification",
    status: "pass",
    createdAtUtc: browserInspection.startedAtUtc,
    completedAtUtc: browserInspection.completedAtUtc,
    inputReceiptIds: [],
    inputHashes: { playwrightReport: playwright.hash },
    outputHashes: { playwrightReport: playwright.hash },
    hardwareEvidence: { browserProcessExecution: true },
    configurationHash: sha256(canonicalJson({ projects: browserInspection.projects })),
    publicSafeParameters: {
      acceptanceTestCount: browserInspection.expected,
      campaignDogfoodRoundCount: 0,
      flakyTestCount: 0,
      projects: browserInspection.projects,
      skippedTestCount: browserInspection.skipped,
      unexpectedTestCount: 0
    },
    boundedDiagnostics: { durationMs: browserInspection.durationMs },
    blockerCode: null,
    externalEvidenceReferences: [],
    evidenceClass: "browser",
    supersedesReceiptIds: []
  });

  const nativeGatePassed = nativeInspection.physicalLinuxArm64Executed;
  const nativeReceipt = putGateReceipt(store, {
    ...base,
    receiptType: receiptTypes.native,
    phase: "native-rid-verification",
    status: nativeGatePassed ? "pass" : "blocked",
    createdAtUtc: nativeInspection.generatedAtUtc,
    completedAtUtc: nativeInspection.generatedAtUtc,
    inputReceiptIds: [],
    inputHashes: { nativeRidReport: native.hash },
    outputHashes: { nativeRidReport: native.hash },
    hardwareEvidence: {
      execution: nativeInspection.rows,
      physicalLinuxArm64Executed: nativeInspection.physicalLinuxArm64Executed
    },
    configurationHash: sha256(canonicalJson({ requiredNativeRids, requirePhysicalLinuxArm64: true })),
    publicSafeParameters: {
      executedRidCount: nativeInspection.executedRidCount,
      packageId: nativeInspection.packageId,
      physicalLinuxArm64Executed: nativeInspection.physicalLinuxArm64Executed,
      requiredNativeRidCount: requiredNativeRids.length,
      requiredNativeRids,
      version: nativeInspection.version
    },
    boundedDiagnostics: { execution: nativeInspection.rows },
    blockerCode: nativeGatePassed ? null : "physical_linux_arm64_hardware_evidence_absent",
    externalEvidenceReferences: [],
    evidenceClass: "target-platform",
    supersedesReceiptIds: []
  });

  const publicSiteReceipt = putGateReceipt(store, {
    ...base,
    receiptType: receiptTypes.publicSite,
    phase: "packaged-public-site-verification",
    status: "pass",
    createdAtUtc: siteInspection.completedAtUtc,
    completedAtUtc: siteInspection.completedAtUtc,
    inputReceiptIds: [],
    inputHashes: { publicDocsReport: publicDocs.hash, publicRootReport: publicRoot.hash },
    outputHashes: { publicDocsReport: publicDocs.hash, publicRootReport: publicRoot.hash },
    hardwareEvidence: { localPackagedSiteBrowserExecution: true, publicHttpsReadback: false },
    configurationHash: sha256(canonicalJson({ publicRootSchema: publicRoot.value.schema,
      publicDocsSchema: publicDocs.value.schema })),
    publicSafeParameters: {
      packagedPublicSiteVerified: true,
      publicDocSiteCount: siteInspection.publicDocSiteCount,
      publicHttpsReadback: false,
      smokeModeCount: siteInspection.smokeModeCount
    },
    boundedDiagnostics: { verificationScope: "packaged-static-site-and-loopback-host-mapping" },
    blockerCode: null,
    externalEvidenceReferences: [],
    evidenceClass: "local",
    supersedesReceiptIds: []
  });

  const publicReadbackReceipt = persistPublicReleaseReadbackEvidence({
    campaignId,
    evidenceRoot: options.evidenceRoot,
    sourceRevision
  });

  return Object.freeze({
    browserReceipt,
    nativeReceipt,
    packageReceipt,
    publicReadbackReceipt,
    publicSiteReceipt
  });
}

module.exports = Object.freeze({
  receiptTypes,
  recordCampaignReleaseEvidence,
  requiredNativeRids,
  validateNativeReport,
  validatePackageAudit,
  validatePlaywrightReport,
  validatePublicSiteReports
});
