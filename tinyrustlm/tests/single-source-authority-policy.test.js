"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const canonicalRoot =
  "E:\\Source\\.tinyrustlm-model-acquisition-recovered-20260819";
const staleRecoveryRoot =
  "E:\\Source\\Worktrees\\source-checkin-recovery-20260819\\TinyRustLM.com";
const protectedSnapshot = "E:\\Source\\Rust\\TinyRustLM.com";

function directText(relativePath) {
  const filePath = path.join(repositoryRoot, ...relativePath.split("/"));
  const stat = fs.lstatSync(filePath);
  assert.equal(stat.isFile(), true, relativePath);
  assert.equal(stat.isSymbolicLink(), false, relativePath);
  assert.equal(fs.realpathSync.native(filePath), path.resolve(filePath), relativePath);
  return fs.readFileSync(filePath, "utf8");
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

test("declares exactly one authoritative TinyRustLM.com source checkout", () => {
  const workspace = directText("workspace.uai");

  assert.equal(occurrences(workspace, "authoritative_worktree:"), 1);
  assert.equal(occurrences(workspace, `  root: ${canonicalRoot}`), 1);
  assert.equal(occurrences(workspace, "  branch: codex/model-acquisition-v2"), 1);
  assert.equal(occurrences(workspace, "  remote: origin"), 1);
  assert.equal(occurrences(workspace,
    `  protected_non_authoritative_tree: ${protectedSnapshot}`), 1);
  assert.equal(occurrences(workspace, staleRecoveryRoot), 0);
  assert.equal(occurrences(workspace,
    "source_authority_receipt: .uai/source-authority-consolidation-2026-08-29.uai"), 1);
  assert.equal(occurrences(workspace,
    "  - .uai/source-authority-consolidation-2026-08-29.uai"), 1);
  assert.match(workspace,
    /Never edit, reset, clean, repair, commit, push, or use the protected tree as current authority\./u);
});

test("forbids duplicate source authority and wholesale stale-tree merges", () => {
  const taboo = directText(".uai/taboo.uai");

  assert.equal(occurrences(taboo, "single_tinyrustlm_source_prohibitions:"), 1);
  assert.match(taboo,
    /Do not create, adopt, maintain, edit, build, test, release, deploy, or describe more than one authoritative TinyRustLM\.com source checkout\./u);
  assert.match(taboo,
    /resolve the canonical root from its current workspace\.uai and verify the canonical path, branch, origin URL, local HEAD, tracking ref, FETCH_HEAD, direct remote ref, and worktree status/u);
  assert.match(taboo,
    /Fail closed before editing, building, testing, committing, releasing, or deploying when canonical authority cannot be proved or any second writable TinyRustLM\.com checkout is discovered/u);
  assert.match(taboo,
    /automated gates must reject pointers to duplicate, retired, quarantined, protected, or otherwise non-authoritative source/u);
  assert.match(taboo,
    /move only valid current clean-slate work into the canonical tree/u);
  assert.match(taboo,
    /Do not pull both trees forward, merge stale branches wholesale, preserve a second checkout as history/u);
  assert.match(taboo,
    /Historical source belongs only in Git history/u);
});

test("records a semantic consolidation and retirement instead of a source union", () => {
  const receipt = directText(
    ".uai/source-authority-consolidation-2026-08-29.uai");

  assert.match(receipt,
    /profile: tinyrustlm\.source_authority_consolidation\.v1/u);
  assert.match(receipt,
    /relation: strict ancestor of the canonical head/u);
  assert.match(receipt, /unique_commits: 0/u);
  assert.match(receipt, /unique_commits_moved: 0/u);
  assert.match(receipt, /uncommitted_changes_moved: 0/u);
  assert.match(receipt, /legacy_or_compatibility_code_retained: false/u);
  assert.match(receipt,
    /A clean-slate merge is semantic, not a union\./u);
  assert.match(receipt, /source_registry_status: retired/u);
  assert.match(receipt, /former_root_absent: true/u);
  assert.match(receipt, /quarantine_authority: none/u);
  assert.match(receipt, /physical_purge: pending/u);
  assert.match(receipt,
    /Historical executable source belongs only in Git history\./u);
});
