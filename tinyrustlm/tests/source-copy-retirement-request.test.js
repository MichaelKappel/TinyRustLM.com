"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const receiptRelativePath =
  "tinyrustlm/release/source-copy-retirement-deploy-root-20260831-request.v1.json";
const resultRelativePath =
  "tinyrustlm/release/source-copy-retirement-deploy-root-20260831-result.v1.json";
const generatedCargoResultRelativePath =
  "tinyrustlm/release/generated-cargo-target-retirement-20260831-result.v1.json";
const sourceArchiveResultRelativePath =
  "tinyrustlm/release/source-archive-and-demo-trace-retirement-20260831-result.v1.json";
const vnextResultRelativePath =
  "tinyrustlm/release/vnext-generated-and-source-copy-retirement-20260831-result.v1.json";
const receiptPath = path.resolve(repositoryRoot, ...receiptRelativePath.split("/"));
const resultPath = path.resolve(repositoryRoot, ...resultRelativePath.split("/"));

function collectStrings(value, strings = []) {
  if (typeof value === "string") strings.push(value);
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, strings);
  } else if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, strings);
  }
  return strings;
}

function readPublicResult(relativePath) {
  const filePath = path.resolve(repositoryRoot, ...relativePath.split("/"));
  const stat = fs.lstatSync(filePath);
  assert.equal(stat.isFile(), true);
  assert.equal(stat.isSymbolicLink(), false);
  assert.equal(fs.realpathSync.native(filePath), path.resolve(filePath));
  assert.equal(
    path.relative(repositoryRoot, filePath).replaceAll("\\", "/"),
    relativePath
  );
  const bytes = fs.readFileSync(filePath);
  const text = bytes.toString("utf8");
  assert.doesNotMatch(text, /[a-z]:[\\/]/iu);
  assert.doesNotMatch(text, /(?:file|https?):\/\//iu);
  return parseStrictJson(bytes);
}

test("preregisters bounded output-free physical retirement", () => {
  const stat = fs.lstatSync(receiptPath);
  assert.equal(stat.isFile(), true);
  assert.equal(stat.isSymbolicLink(), false);
  assert.equal(fs.realpathSync.native(receiptPath), path.resolve(receiptPath));
  assert.equal(
    path.relative(repositoryRoot, receiptPath).replaceAll("\\", "/"),
    receiptRelativePath
  );

  const bytes = fs.readFileSync(receiptPath);
  const text = bytes.toString("utf8");
  const receipt = parseStrictJson(bytes);

  assert.doesNotMatch(text, /[a-z]:[\\/]/iu);
  assert.doesNotMatch(text, /(?:file|https?):\/\//iu);
  assert.deepEqual(
    collectStrings(receipt).filter((value) => /[\\/]/u.test(value)),
    [resultRelativePath]
  );

  assert.equal(receipt.schema, "tinyrustlm.source-copy-retirement-request.v1");
  assert.equal(receipt.logical_target, "ecosystem-rust-deploy-root");
  assert.deepEqual(receipt.inventory, {
    file_count: 137,
    directory_count_including_root: 63,
    byte_length: 6942693,
    tree_manifest_sha256:
      "722436c3b3e258b2d5bcb64005472c3d845665658e1ada020314447651ab533a"
  });

  assert.equal(receipt.non_git_files.file_count, 89);
  assert.equal(receipt.non_git_files.byte_length, 6249220);
  assert.equal(
    receipt.non_git_files.manifest_sha256,
    "bbb3404b32997fee09435f215bc53e06a56b5e55485821d0585026b94b04e90a"
  );
  assert.deepEqual(receipt.non_git_files.roles, [
    {
      role: "editable-source-config",
      file_count: 4,
      byte_length: 94444,
      manifest_sha256:
        "6b13271405d376fd3bc232dc06d87ad03a4f2f97d795e37d60ecc5200ba7dba4"
    },
    {
      role: "generated-site-package-output",
      file_count: 60,
      byte_length: 5659848,
      manifest_sha256:
        "1a133175eb951d94fcc7387e649f95db074167c3ff8c460211ba11ad86ae85a9"
    },
    {
      role: "receipt-checksum-evidence",
      file_count: 22,
      byte_length: 69714,
      manifest_sha256:
        "536f1b4136491c5ec78e3182994b44971ee87c2da7ef7cb8dfe4c350182a94f7"
    },
    {
      role: "binary-artifact",
      file_count: 3,
      byte_length: 425214,
      manifest_sha256:
        "000783207befe7ac4aa385cdf1a8070734d44ff69b38136a9151c7aa59e2dfb0"
    }
  ]);
  assert.equal(
    receipt.non_git_files.roles.reduce((sum, role) => sum + role.file_count, 0),
    receipt.non_git_files.file_count
  );
  assert.equal(
    receipt.non_git_files.roles.reduce((sum, role) => sum + role.byte_length, 0),
    receipt.non_git_files.byte_length
  );

  assert.deepEqual(receipt.source_zip_identities, [
    {
      byte_length: 4720,
      sha256: "421c57a153bd6a4ebce69197579219bab359bebd287913d35a34d37cd3c9e5cc"
    },
    {
      byte_length: 17156,
      sha256: "2369ace8c135e2c215e6de79b5c786750a6aebad733f9b0e319121e38d56ebfc"
    },
    {
      byte_length: 36207,
      sha256: "070610607f896a467e825f05ba3505a63cdddc5d923a82838b32b5bbb7977482"
    },
    {
      byte_length: 57768,
      sha256: "b7815a06f7e53ac77eeb8705ab95f8e1ec1510fb95a4ff2c2c3171d8f953df8a"
    }
  ]);
  assert.deepEqual(receipt.legacy_wasm_identity, {
    byte_length: 141738,
    sha256: "9416cb0169cf8a9f61d7f12bd531d43fa887a29f95cc8e6871af4c3e33bcd6c3",
    copy_count: 3
  });
  assert.deepEqual(receipt.assessment, {
    migration_required: false,
    secrets_detected: 0
  });
  assert.deepEqual(receipt.retention_policy, {
    preserved_form: "bounded-evidence-identities-only",
    source_or_artifact_bytes_permitted: false,
    raw_evidence_permitted: false,
    filename_inventory_permitted: false
  });
  assert.deepEqual(receipt.execution_policy, {
    physical_deletion_required: true,
    maximum_retries: 0,
    rename_permitted: false,
    archive_permitted: false,
    quarantine_permitted: false,
    copy_permitted: false
  });
  assert.deepEqual(receipt.result_receipt, {
    relative_repository_path: resultRelativePath,
    required: true,
    must_bind_request: true
  });
  assert.equal(receipt.status, "preregistered-awaiting-physical-deletion");
  assert.equal(receipt.terminal, false);
});

test("records bounded terminal physical-retirement proof", () => {
  const requestBytes = fs.readFileSync(receiptPath);
  const resultBytes = fs.readFileSync(resultPath);
  const resultText = resultBytes.toString("utf8");
  const result = parseStrictJson(resultBytes);
  const requestSha256 = require("node:crypto")
    .createHash("sha256")
    .update(requestBytes)
    .digest("hex");

  assert.doesNotMatch(resultText, /[a-z]:[\\/]/iu);
  assert.doesNotMatch(resultText, /(?:file|https?):\/\//iu);
  assert.deepEqual(
    collectStrings(result).filter((value) => /[\\/]/u.test(value)),
    [receiptRelativePath]
  );

  assert.equal(result.schema, "tinyrustlm.source-copy-retirement-result.v1");
  assert.equal(result.request_id, "source-copy-retirement-deploy-root-20260831");
  assert.equal(result.logical_target, "ecosystem-rust-deploy-root");
  assert.deepEqual(result.request_identity, {
    relative_repository_path: receiptRelativePath,
    sha256: requestSha256
  });
  assert.deepEqual(result.execution, {
    one_time_script_sha256:
      "60e5fa8880aff74a8ab656e45bae1e1bd14badaae5dcdfced0cc2ca507566c25",
    elevated: true,
    attempt_count: 1,
    maximum_retries: 0,
    status: "removed"
  });
  assert.deepEqual(result.removed_target_inventory, {
    file_count: 137,
    directory_count_including_root: 63,
    byte_length: 6942693,
    tree_manifest_sha256:
      "722436c3b3e258b2d5bcb64005472c3d845665658e1ada020314447651ab533a"
  });
  assert.deepEqual(result.bounded_cleanup_totals, {
    removed_target_count: 10,
    already_absent_target_count: 1,
    removed_file_count: 9974,
    removed_directory_count_including_roots: 1883,
    removed_byte_length: 948649226
  });
  assert.deepEqual(result.independent_verification, {
    allowlisted_target_count: 11,
    all_allowlisted_targets_absent: true,
    unsafe_parent_count: 0,
    shared_junction_destination_absent: true,
    canonical_repository_count: 7,
    canonical_tinyrustlm_source_root_count: 1,
    discovered_source_archive_count: 0,
    unreadable_root_count: 0,
    source_authority_verdict: "pass"
  });
  assert.deepEqual(result.retention, {
    raw_terminal_stream_committed: false,
    private_path_inventory_committed: false,
    source_or_artifact_bytes_committed: false,
    one_time_script_retained: false
  });
  assert.match(result.observed_at_utc, /^2026-08-31T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
  assert.equal(result.status, "terminal-success");
  assert.equal(result.terminal, true);
});

test("records path-free generated Cargo cleanup without claiming source deletion", () => {
  const result = readPublicResult(generatedCargoResultRelativePath);
  assert.equal(result.schema,
    "tinyrustlm.generated_cargo_target_retirement_result.v1");
  assert.equal(result.status, "deleted");
  assert.equal(result.target_logical_name, "superseded-vnext-cargo-target");
  assert.equal(result.target_was_direct_non_reparse_directory, true);
  assert.equal(result.descendant_reparse_point_count, 0);
  assert.equal(result.editable_source_marker_count, 0);
  assert.equal(result.files_deleted, 5714);
  assert.equal(result.directories_deleted, 1008);
  assert.equal(result.logical_bytes_deleted, 2708718401);
  assert.equal(result.target_absent_after_operation, true);
  assert.match(result.one_shot_script_sha256, /^[0-9a-f]{64}$/u);
  assert.equal(result.one_shot_script_retained, false);
  assert.deepEqual(result.claims, {
    editable_source_deleted: false,
    immutable_evidence_deleted: false,
    generated_build_output_retired: true,
    private_paths_committed: false,
    whole_volume_scanned: false
  });
});

test("records bounded source-archive and synthetic-trace retirement", () => {
  const result = readPublicResult(sourceArchiveResultRelativePath);
  assert.equal(result.schema,
    "tinyrustlm.source_archive_and_demo_trace_retirement_result.v1");
  assert.equal(result.status, "performed");
  assert.equal(result.removed_target_count, 6);
  assert.equal(result.files_deleted, 52);
  assert.equal(result.directories_deleted, 12);
  assert.equal(result.logical_bytes_deleted, 1032108892);
  assert.equal(result.descendant_reparse_point_count, 0);
  assert.equal(result.source_archive_count, 2);
  assert.match(result.source_history_manifest_sha256, /^[0-9a-f]{64}$/u);
  assert.equal(result.source_archive_sha256.length, 2);
  for (const digest of result.source_archive_sha256) {
    assert.match(digest, /^[0-9a-f]{64}$/u);
  }
  assert.equal(result.synthetic_demo_trace_root_count, 5);
  assert.match(result.one_shot_script_sha256, /^[0-9a-f]{64}$/u);
  assert.equal(result.one_shot_script_retained, false);
  assert.equal(result.all_exact_targets_absent_after_operation, true);
  assert.deepEqual(result.claims, {
    historical_source_archives_retired: true,
    synthetic_demo_evidence_promoted: false,
    external_peer_reachability_proven: false,
    whole_volume_scanned: false
  });
});

test("records the bounded continuation and exact retained evidence children", () => {
  const result = readPublicResult(vnextResultRelativePath);
  assert.equal(result.schema,
    "tinyrustlm.vnext_generated_and_source_copy_retirement_result.v1");
  assert.equal(result.status, "performed-after-bounded-continuation");
  assert.equal(result.target_logical_name,
    "superseded-vnext-generated-and-raw-copy-closure");
  assert.equal(result.removed_target_count, 29);
  assert.equal(result.files_deleted, 13327);
  assert.equal(result.directories_deleted, 5068);
  assert.equal(result.logical_bytes_deleted, 1264173435);
  assert.equal(result.descendant_reparse_point_count, 0);
  assert.deepEqual(result.initial_operation, {
    status: "partial-failure",
    one_shot_script_sha256:
      "4ac9eb8d020c6447af50229a4555f02e4cef069c5bf464a2c12b4565815c2738",
    typed_failure: "file-share-delete-denied-by-concurrent-read-only-audit",
    failure_hidden: false
  });
  assert.deepEqual(result.continuation_operation, {
    status: "performed",
    one_shot_script_sha256:
      "20a411b77e592af2ae3c0ce39b1b4168897cfff4bceac34ebe8ac8149de3d862",
    files_deleted: 2377,
    directories_deleted: 946,
    logical_bytes_deleted: 53305674
  });
  assert.equal(result.one_shot_scripts_retained, false);
  assert.deepEqual(result.remaining_direct_children, [
    "release-surface-evidence-2484706",
    "release-surface-evidence-2c3a0ea",
    "release-surface-evidence-9650ba4",
    "release-surface-evidence-c1c27e1",
    "release-surface-gate-evidence",
    "temporary-relocation"
  ]);
  assert.deepEqual(result.claims, {
    copied_raw_documentation_tree_retired: true,
    source_bearing_package_archives_retired: true,
    generated_build_and_test_outputs_retired: true,
    private_bounded_evidence_deleted: false,
    whole_volume_scanned: false
  });
});
