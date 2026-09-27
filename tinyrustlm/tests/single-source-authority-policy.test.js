"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  allSourceReviewBundleName,
  authorityResultForStdout,
  canonicalArtifactsRoot,
  canonicalEcosystemAuthorityMarkers,
  canonicalEcosystemExemptStorageDirectoryNames,
  canonicalEcosystemExemptStorageRoots,
  canonicalEcosystemLegacyArchiveName,
  canonicalEcosystemPlainDirectoryNames,
  canonicalEcosystemPlainFileNames,
  canonicalEcosystemRepositoryNames,
  canonicalEcosystemRoot,
  canonicalEcosystemWorkspacePath,
  canonicalEcosystemWorkspacePolicyBytes,
  canonicalEcosystemWorkspacePolicySha256,
  canonicalEcosystemWorkspaceTemplatePath,
  canonicalEcosystemSourceRootPolicyBlock,
  canonicalEcosystemTabooPaths,
  canonicalSingleTinyRustLmSourcePolicyBytes,
  canonicalSingleTinyRustLmSourcePolicySha256,
  canonicalRoot,
  classifyRegisteredBinaryNugetArchive,
  classifyRegisteredBinaryReleaseArchive,
  cliVerificationOptions,
  discoverCanonicalEcosystemRootEntries,
  discoverEcosystemAuthorityFiles,
  discoverEcosystemSourceRoots,
  discoverLocalSourceRoots,
  discoverMarkedSourceRoots,
  discoverSourceArchives,
  evidenceContainerProfilesForVerification,
  effectiveScanScopes,
  ecosystemAuthorityMaximumDepth,
  ecosystemAuthorityScanScopes,
  ecosystemRepositories,
  evidenceContainerDirectChildIdentity,
  evidenceContainerHardLimits,
  evidenceOnlyRoots,
  externalBinaryReleaseEvidenceRoot,
  extractEcosystemSourceRootPolicyBlock,
  extractSingleTinyRustLmSourcePolicyBlock,
  governedExternalSourceScopes,
  hasArchiveContainerMagic,
  isCanonicalPathSegment,
  isLooseSourceAuthorityEntry,
  isSourceArchiveName,
  localWorkspaceRoot,
  readBoundedText,
  registeredBinaryReleaseArchiveProfiles,
  registeredBinaryReleaseEvidenceRoot,
  registeredEvidenceContainerProfiles,
  registeredEvidenceArtifactsRoot,
  registeredEvidenceRoot,
  registeredNonSourceStorageReparseProfiles,
  registeredReleaseEvidenceContainerRoot,
  requiredBranch,
  requiredOrigin,
  sourceArchiveScanScopes,
  sourceArchiveSuffixes,
  sourceScanScopes,
  supersededSourceArchives,
  supersededEcosystemSourceRoots,
  supersededLooseSourceFiles,
  supersededSourceRoots,
  tinyRustLmGitEntrypointRelativePaths,
  verifyDiscovery,
  verifyCanonicalEcosystemRootEntryDiscovery,
  verifyCanonicalEcosystemWorkspacePolicy,
  verifyEcosystemAuthorityFileDiscovery,
  verifyEcosystemDiscovery,
  verifyEcosystemSourceRootPolicyParity,
  verifyForbiddenPathAbsence,
  verifyGitIdentity,
  verifyBoundedEvidenceContainer,
  verifySingleSourceAuthority,
  verifySourceArchiveDiscovery
} = require("../tools/verify-single-source-authority.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const boundedAuthorityScopePolicy =
  "The enforceable discovery boundary is the seven canonical repositories; " +
  "the recursively registered E:\\Source\\Rust, E:\\Source\\Worktrees, " +
  "E:\\Source\\.codex-tmp, E:\\Source\\.codex-temp, " +
  "E:\\Source\\.tinyrustlm-evidence, and E:\\Source\\External scopes; " +
  "every ecosystem-shaped direct E:\\Source child; a direct-root plus " +
  "one-child marker probe for every other neutral direct E:\\Source child; " +
  "and D:\\tw, D:\\Archive\\Source, and D:\\TinyRustLM-vnext-20260812 at " +
  "their declared bounded depths. A passing gate proves only those boundaries; " +
  "it is not a whole-volume inventory of E: or D: and does not recursively " +
  "inspect unrelated sibling repositories. Register and completely scan any " +
  "newly known or suspected source-bearing location, or physically retire it, " +
  "before claiming sole-source authority.";

function directText(relativePath) {
  const filePath = path.join(repositoryRoot, ...relativePath.split("/"));
  const stat = fs.lstatSync(filePath);
  assert.equal(stat.isFile(), true, relativePath);
  assert.equal(stat.isSymbolicLink(), false, relativePath);
  assert.equal(fs.realpathSync.native(filePath), path.resolve(filePath), relativePath);
  return fs.readFileSync(filePath, "utf8");
}

function directAbsoluteText(filePath) {
  const stat = fs.lstatSync(filePath);
  assert.equal(stat.isFile(), true, filePath);
  assert.equal(stat.isSymbolicLink(), false, filePath);
  assert.equal(fs.realpathSync.native(filePath), path.resolve(filePath), filePath);
  return fs.readFileSync(filePath, "utf8");
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

function literalPathExists(filePath) {
  try {
    fs.lstatSync(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return false;
    throw error;
  }
}

// Returns one synthetic external policy without publishing fixture paths.
function syntheticEvidenceContainerProfile(root, overrides = {}) {
  return Object.freeze({
    allowedDirectChildIdentities: Object.freeze([
      evidenceContainerDirectChildIdentity("records")
    ]),
    maximumDepth: 2,
    maximumDirectories: 4,
    maximumFileBytes: 4096,
    maximumFiles: 16,
    maximumTotalBytes: 16384,
    root,
    ...overrides
  });
}

// Creates and removes one operation-owned bounded non-product fixture.
function withSyntheticEvidenceContainer(callback) {
  const temporaryParent = fs.mkdtempSync(path.join(os.tmpdir(),
    "tinyrustlm-authority-evidence-"));
  const root = path.join(temporaryParent, "evidence");
  const records = path.join(root, "records");
  fs.mkdirSync(records, { recursive: true });
  fs.writeFileSync(path.join(records, "record.json"), "{}\n");
  fs.writeFileSync(path.join(records, "note.txt"), "ordinary evidence note\n");
  fs.writeFileSync(path.join(records, "bounded.dat"),
    Buffer.from([0x00, 0xff, 0x01, 0x80]));
  fs.writeFileSync(path.join(records, "guide.md"), [
    "# Evidence guide",
    "",
    "This is ordinary explanatory prose long enough to establish that the",
    "fenced sample below is documentation rather than a copied source file.",
    "The validator must keep bounded technical documentation eligible while",
    "still rejecting standalone source material hidden under a data suffix.",
    "",
    "```js",
    "const example = true;",
    "module.exports = example;",
    "```",
    ""
  ].join("\n"));
  try {
    return callback(root, syntheticEvidenceContainerProfile(root));
  } finally {
    const relative = path.relative(path.resolve(os.tmpdir()),
      path.resolve(temporaryParent));
    assert.notEqual(relative, "");
    assert.equal(relative.startsWith(`..${path.sep}`), false);
    assert.equal(path.isAbsolute(relative), false);
    fs.rmSync(temporaryParent, { force: true, recursive: true });
  }
}

function canonicalEcosystemDiscovery() {
  return Object.freeze({
    nonCanonicalEntries: Object.freeze([]),
    roots: Object.freeze(ecosystemRepositories.map((profile) =>
      path.resolve(profile.root)).sort((left, right) =>
      left.localeCompare(right))),
    unscannedSubtrees: Object.freeze([]),
    unreadable: Object.freeze([])
  });
}

// Builds a complete passing authority-file discovery with narrow overrides.
function canonicalAuthorityFileDiscovery(overrides = {}) {
  return {
    depthExceeded: [],
    exemptNonSourceStorageRoots: [...canonicalEcosystemExemptStorageRoots],
    looseSourceFiles: [],
    markerFiles: [...canonicalEcosystemAuthorityMarkers],
    nonCanonicalEntries: [],
    nonRegular: [],
    partialGitRoots: [],
    permittedBinaryReleaseArchives: [],
    permittedLeafSymlinks: [],
    permittedReparses: [],
    reparses: [],
    reparseTargetDrift: [],
    reviewBundles: [],
    sourceArchives: [],
    unreadable: [],
    ...overrides
  };
}

// Builds a passing direct-child inventory for an exact synthetic Rust root.
function canonicalRootEntryDiscovery(root = canonicalEcosystemRoot,
  overrides = {}) {
  return {
    exemptNonSourceStorageRoots:
      canonicalEcosystemExemptStorageDirectoryNames.map((name) =>
        path.join(root, name)),
    legacyArchiveRoots: [path.join(root, canonicalEcosystemLegacyArchiveName)],
    missingRepositoryRoots: [],
    nonCanonicalEntries: [],
    nonEmptyLegacyArchiveRoots: [],
    nonPlainEntries: [],
    permittedNonRepositoryEntries: [
      ...canonicalEcosystemPlainFileNames,
      ...canonicalEcosystemPlainDirectoryNames
    ].map((name) => path.join(root, name)),
    repositoryRoots: canonicalEcosystemRepositoryNames.map((name) =>
      path.join(root, name)),
    root,
    unexpectedEntries: [],
    unreadable: [],
    ...overrides
  };
}

// Models a direct directory tree while recording every directory enumeration.
function fakeAuthorityFileSystem(root, tree, options = {}) {
  const normalizedRoot = path.resolve(root);
  const normalizedTree = new Map();
  const nodeKinds = new Map([[normalizedRoot, "directory"]]);
  for (const [directory, entries] of tree) {
    const normalizedDirectory = path.resolve(directory);
    normalizedTree.set(normalizedDirectory, entries);
    nodeKinds.set(normalizedDirectory, "directory");
    for (const entry of entries) {
      nodeKinds.set(path.resolve(normalizedDirectory, entry.name), entry.kind);
    }
  }
  const unreadableDirectories = new Set(
    (options.unreadableDirectories || []).map((candidate) =>
      path.resolve(candidate)));
  const reparseTargets = new Map((options.reparseTargets || []).map(
    ([candidate, target]) => [path.resolve(candidate), path.resolve(target)]));
  const storedLinkTargets = new Map((options.storedLinkTargets || []).map(
    ([candidate, target]) => [path.resolve(candidate), target]));
  const readDirectories = [];

  // Creates a path-bearing missing-file error matching Node's filesystem API.
  function missing(candidate) {
    const error = new Error("missing fake authority path");
    error.code = "ENOENT";
    error.path = candidate;
    return error;
  }

  // Returns the minimum stat contract consumed by authority discovery.
  function statFor(kind) {
    return {
      isDirectory: () => kind === "directory" || kind === "directory-reparse",
      isFile: () => kind === "file",
      isSymbolicLink: () => kind === "reparse" || kind === "directory-reparse"
    };
  }

  // Keeps every ordinary fake path direct and non-aliased.
  const realpathSync = function realpathSync(candidate) {
    return realpathSync.native(candidate);
  };
  realpathSync.native = (candidate) => {
    const normalized = path.resolve(candidate);
    if (!nodeKinds.has(normalized)) throw missing(normalized);
    if (reparseTargets.has(normalized)) return reparseTargets.get(normalized);
    return normalized;
  };

  return {
    fileSystem: {
      // Resolves fixture node kinds without touching the host filesystem.
      lstatSync(candidate) {
        const normalized = path.resolve(candidate);
        const kind = nodeKinds.get(normalized);
        if (!kind) throw missing(normalized);
        return statFor(kind);
      },
      // Enumerates fixture directories and injects configured access failures.
      readdirSync(candidate) {
        const normalized = path.resolve(candidate);
        readDirectories.push(normalized);
        if (unreadableDirectories.has(normalized)) {
          const error = new Error("fake authority directory denied");
          error.code = "EACCES";
          error.path = normalized;
          throw error;
        }
        const entries = normalizedTree.get(normalized) || [];
        return entries.map((entry) => ({
          isDirectory: () => entry.kind === "directory" ||
            entry.kind === "directory-reparse",
          isFile: () => entry.kind === "file",
          isSymbolicLink: () => entry.kind === "reparse" ||
            entry.kind === "directory-reparse",
          name: entry.name
        }));
      },
      // Returns the exact stored target for a fake symbolic-link leaf.
      readlinkSync(candidate) {
        const normalized = path.resolve(candidate);
        if (!storedLinkTargets.has(normalized)) throw missing(normalized);
        return storedLinkTargets.get(normalized);
      },
      realpathSync
    },
    readDirectories
  };
}

test("declares the required path as the sole TinyRustLM.com source checkout", () => {
  const workspace = directText("workspace.uai");

  assert.equal(occurrences(workspace, "authoritative_worktree:"), 1);
  assert.equal(occurrences(workspace, `  root: ${canonicalRoot}`), 1);
  assert.equal(occurrences(workspace, "  branch: codex/model-acquisition-v2"), 1);
  assert.equal(occurrences(workspace, "  remote: origin"), 1);
  assert.equal(occurrences(workspace, "protected_non_authoritative_tree:"), 0);
  assert.equal(occurrences(workspace,
    "source_authority_receipt: .uai/source-authority-relocation-2026-08-30.uai"), 1);
  assert.equal(occurrences(workspace,
    "  - .uai/source-authority-relocation-2026-08-30.uai"), 1);
  assert.match(workspace,
    /This exact non-reparse root is the sole local source, build, test, release, and deployment checkout\./u);
  assert.match(workspace,
    /Fail closed if any recovered, dated, hidden, backup, Worktrees, evidence, or quarantine directory contains another TinyRustLM\.com source tree\./u);
});

test("root workspace routing is one tracked current-only byte identity", () => {
  const template = directAbsoluteText(canonicalEcosystemWorkspaceTemplatePath);
  const active = directAbsoluteText(canonicalEcosystemWorkspacePath);
  assert.equal(active, template);
  assert.equal(Buffer.byteLength(template, "utf8"),
    canonicalEcosystemWorkspacePolicyBytes);
  assert.equal(crypto.createHash("sha256").update(template, "utf8").digest("hex"),
    canonicalEcosystemWorkspacePolicySha256);
  assert.deepEqual(verifyCanonicalEcosystemWorkspacePolicy(), {
    byteLength: canonicalEcosystemWorkspacePolicyBytes,
    path: canonicalEcosystemWorkspacePath,
    sha256: canonicalEcosystemWorkspacePolicySha256,
    templatePath: canonicalEcosystemWorkspaceTemplatePath
  });
  for (const forbidden of [
    "Use only TinyRustLM recovery clone",
    "usable_worktrees:",
    "exact_resume:",
    ".tinyrustlm-model-acquisition-recovered-",
    "Worktrees\\source-checkin-recovery-",
    "MemoryEndpoints remains unauthorized"
  ]) {
    assert.equal(template.includes(forbidden), false, forbidden);
  }
  for (const mutation of [
    `${template}obsolete\n`,
    template.replace("E:\\Source\\Rust\\TinyRustLM.com", "E:\\Source\\other"),
    template.replace("zero independently qualified", "three independently qualified")
  ]) {
    assert.throws(
      () => verifyCanonicalEcosystemWorkspacePolicy({
        readText: (candidate) => candidate === canonicalEcosystemWorkspaceTemplatePath
          ? template
          : mutation
      }),
      (error) => error?.code === "source_authority_workspace_policy_invalid"
    );
  }
});

test("rejects recreation of every storage root retired in the September consolidation", () => {
  const retired = require("../../contracts/storage/retired-storage-roots-2026-09-12.json");
  assert.equal(retired.length, 51);
  for (const root of retired) {
    assert.equal(supersededSourceRoots.includes(root), true, root);
    assert.throws(() => verifyForbiddenPathAbsence(
      supersededSourceRoots, "source_authority_superseded_root_present", {
        fileSystem: {
          // A virtual recreated directory exercises rejection without making a copy.
          lstatSync(candidate) {
            if (candidate === root) return {};
            const error = new Error("absent");
            error.code = "ENOENT";
            throw error;
          }
        }
      }), (error) => error.code === "source_authority_superseded_root_present" &&
        error.detail === root);
  }
});

test("uses a path-free bounded evidence-container policy", () => {
  assert.deepEqual(evidenceContainerHardLimits, {
    maximumContainers: 16,
    maximumDepth: 8,
    maximumDirectChildren: 64,
    maximumDirectories: 256,
    maximumFileBytes: 4 * 1024 * 1024,
    maximumFiles: 1024,
    maximumTotalBytes: 32 * 1024 * 1024
  });
  assert.equal(registeredEvidenceContainerProfiles.length, 0);
  assert.equal(registeredReleaseEvidenceContainerRoot,
    "E:\\Source\\External\\TinyRustLM-release-evidence");
  assert.equal(supersededSourceRoots.includes(registeredReleaseEvidenceContainerRoot), true);
  assert.deepEqual(evidenceContainerProfilesForVerification(),
    registeredEvidenceContainerProfiles);
  assert.equal(registeredEvidenceContainerProfiles.some((profile) =>
    profile.root.toLowerCase().startsWith("d:\\")), false);
  const directName = "records";
  assert.equal(evidenceContainerDirectChildIdentity(directName),
    `sha256:${crypto.createHash("sha256")
      .update(directName, "utf8").digest("hex")}`);

  withSyntheticEvidenceContainer((root, profile) => {
    assert.deepEqual(evidenceContainerProfilesForVerification({
      evidenceContainerProfiles: [profile]
    }), [profile]);
    assert.deepEqual(verifyBoundedEvidenceContainer(profile), {
      verdict: "pass"
    });
    const invalidProfiles = [
      { ...profile, inventedExactInventory: true },
      { ...profile, root: "relative-evidence" },
      { ...profile, allowedDirectChildIdentities: ["records"] },
      { ...profile, allowedDirectChildIdentities: [
        profile.allowedDirectChildIdentities[0],
        profile.allowedDirectChildIdentities[0]
      ] },
      { ...profile, maximumDepth: evidenceContainerHardLimits.maximumDepth + 1 },
      { ...profile, maximumDirectories:
        evidenceContainerHardLimits.maximumDirectories + 1 },
      { ...profile, maximumFileBytes:
        evidenceContainerHardLimits.maximumFileBytes + 1,
        maximumTotalBytes: evidenceContainerHardLimits.maximumTotalBytes },
      { ...profile, maximumFiles: evidenceContainerHardLimits.maximumFiles + 1 },
      { ...profile, maximumTotalBytes:
        evidenceContainerHardLimits.maximumTotalBytes + 1 }
    ];
    for (const invalid of invalidProfiles) {
      assert.throws(() => verifyBoundedEvidenceContainer(invalid), (error) => {
        assert.equal(error.code,
          "source_authority_evidence_container_profile_invalid");
        assert.equal(error.message.includes(root), false);
        return true;
      });
    }
  });

  const projected = authorityResultForStdout({
    canonicalLayoutAvailable: true,
    coverageClass: "registered-governed-roots-only",
    localScanPerformed: true,
    undisclosedFilesystemIdentity: "not-projected",
    verdict: "pass",
    wholeVolumeInventoryPerformed: false
  });
  assert.deepEqual(projected, {
    canonicalLayoutAvailable: true,
    coverageClass: "registered-governed-roots-only",
    localScanPerformed: true,
    verdict: "pass",
    wholeVolumeInventoryPerformed: false
  });
  assert.equal(Object.hasOwn(projected, "undisclosedFilesystemIdentity"), false);
});

test("bounded evidence-container verification rejects hostile mutations", () => {
  const scenarios = [
    {
      code: "source_authority_evidence_container_bounds_exceeded",
      detail: "depth",
      label: "depth bound",
      prepare(root) {
        const deep = path.join(root, "records", "one", "two");
        fs.mkdirSync(deep, { recursive: true });
        fs.writeFileSync(path.join(deep, "value.txt"), "bounded");
      }
    },
    {
      code: "source_authority_evidence_container_bounds_exceeded",
      detail: "directory_count",
      label: "directory-count bound",
      prepare(root, profile) {
        fs.mkdirSync(path.join(root, "records", "extra"));
        return { profile: syntheticEvidenceContainerProfile(root, {
          maximumDirectories: 1
        }) };
      }
    },
    {
      code: "source_authority_evidence_container_bounds_exceeded",
      detail: "file_count",
      label: "file-count bound",
      prepare(root) {
        return { profile: syntheticEvidenceContainerProfile(root, {
          maximumFiles: 3
        }) };
      }
    },
    {
      code: "source_authority_evidence_container_bounds_exceeded",
      detail: "bytes",
      label: "byte bound",
      prepare(root) {
        fs.writeFileSync(path.join(root, "records", "note.txt"),
          Buffer.alloc(5000, 0x61));
      }
    },
    {
      code: "source_authority_evidence_container_direct_child_invalid",
      detail: "unexpected",
      label: "unexpected direct child",
      prepare(root) {
        fs.writeFileSync(path.join(root, "unexpected.txt"), "unexpected");
      }
    },
    {
      code: "source_authority_evidence_container_direct_child_invalid",
      detail: "missing",
      label: "missing direct child",
      prepare(root) {
        fs.rmSync(path.join(root, "records"), { recursive: true });
      }
    },
    {
      code: "source_authority_evidence_container_forbidden_content",
      detail: "archive",
      label: "archive suffix",
      prepare(root) {
        fs.renameSync(path.join(root, "records", "note.txt"),
          path.join(root, "records", "bundle.zip"));
      }
    },
    {
      code: "source_authority_evidence_container_forbidden_content",
      detail: "archive",
      label: "renamed archive magic",
      prepare(root) {
        fs.writeFileSync(path.join(root, "records", "note.txt"),
          Buffer.from([0x50, 0x4b, 0x03, 0x04]));
      }
    },
    {
      code: "source_authority_evidence_container_forbidden_content",
      detail: "source_authority",
      label: "source authority marker",
      prepare(root) {
        fs.renameSync(path.join(root, "records", "note.txt"),
          path.join(root, "records", "workspace.uai"));
      }
    },
    {
      code: "source_authority_evidence_container_forbidden_content",
      detail: "source_authority",
      label: "Git marker",
      prepare(root) {
        fs.mkdirSync(path.join(root, "records", ".git"));
      }
    },
    {
      code: "source_authority_evidence_container_forbidden_content",
      detail: "source_authority",
      label: "config path marker",
      prepare(root) {
        fs.renameSync(path.join(root, "records", "note.txt"),
          path.join(root, "records", "runtime.config"));
      }
    },
    {
      code: "source_authority_evidence_container_forbidden_content",
      detail: "executable",
      label: "executable suffix",
      prepare(root) {
        fs.renameSync(path.join(root, "records", "note.txt"),
          path.join(root, "records", "payload.dll"));
      }
    },
    {
      code: "source_authority_evidence_container_forbidden_content",
      detail: "executable",
      label: "executable magic",
      prepare(root) {
        fs.writeFileSync(path.join(root, "records", "note.txt"),
          Buffer.from("MZ"));
      }
    },
    {
      code: "source_authority_evidence_container_forbidden_content",
      detail: "git",
      label: "renamed Git config",
      prepare(root) {
        fs.writeFileSync(path.join(root, "records", "note.txt"),
          "[core]\nrepositoryformatversion = 0\n");
      }
    },
    {
      code: "source_authority_evidence_container_forbidden_content",
      detail: "authority",
      label: "renamed authority file",
      prepare(root) {
        fs.writeFileSync(path.join(root, "records", "note.txt"), [
          "profile: example.workspace.current.v1",
          "authoritative_worktree:",
          "  root: canonical-placeholder",
          ""
        ].join("\n"));
      }
    },
    {
      code: "source_authority_evidence_container_forbidden_content",
      detail: "config",
      label: "renamed package config",
      prepare(root) {
        fs.writeFileSync(path.join(root, "records", "note.txt"),
          JSON.stringify({
            dependencies: { example: "1.0.0" },
            name: "example",
            scripts: { test: "node --test" }
          }));
      }
    },
    {
      code: "source_authority_evidence_container_forbidden_content",
      detail: "source",
      label: "renamed source file",
      prepare(root) {
        fs.writeFileSync(path.join(root, "records", "note.txt"), [
          "use std::path::Path;",
          "pub struct Example {",
          "value: usize;",
          "}",
          "impl Example {",
          "pub fn value(&self) -> usize {",
          "let current = self.value;",
          "current",
          "}",
          "}",
          "const LIMIT: usize = 4;",
          "pub fn build() -> Example { Example { value: LIMIT } }"
        ].join("\n"));
      }
    },
    {
      code: "source_authority_evidence_container_scan_incomplete",
      detail: "unreadable_file",
      label: "unreadable file",
      prepare(root) {
        const target = path.resolve(root, "records", "note.txt");
        const fileSystem = Object.create(fs);
        fileSystem.readFileSync = (candidate, ...arguments_) => {
          if (path.resolve(candidate) === target) {
            const error = new Error("synthetic denied read");
            error.code = "EACCES";
            throw error;
          }
          return fs.readFileSync(candidate, ...arguments_);
        };
        return { options: { fileSystem } };
      }
    },
    {
      code: "source_authority_evidence_container_scan_incomplete",
      detail: "unstable_file",
      label: "unstable file",
      prepare(root) {
        const target = path.resolve(root, "records", "note.txt");
        const fileSystem = Object.create(fs);
        let targetRead = false;
        fileSystem.readFileSync = (candidate, ...arguments_) => {
          const content = fs.readFileSync(candidate, ...arguments_);
          if (path.resolve(candidate) === target) targetRead = true;
          return content;
        };
        fileSystem.lstatSync = (candidate) => {
          const stat = fs.lstatSync(candidate);
          if (!targetRead || path.resolve(candidate) !== target) return stat;
          return {
            ...stat,
            isDirectory: () => stat.isDirectory(),
            isFile: () => stat.isFile(),
            isSymbolicLink: () => stat.isSymbolicLink(),
            mtimeMs: stat.mtimeMs + 1
          };
        };
        return { options: { fileSystem } };
      }
    },
    {
      code: "source_authority_evidence_container_scan_incomplete",
      detail: "reparse",
      label: "reparse file",
      prepare(root) {
        const target = path.resolve(root, "records", "note.txt");
        const fileSystem = Object.create(fs);
        fileSystem.lstatSync = (candidate) => {
          const stat = fs.lstatSync(candidate);
          if (path.resolve(candidate) !== target) return stat;
          return {
            ...stat,
            isDirectory: () => false,
            isFile: () => true,
            isSymbolicLink: () => true
          };
        };
        return { options: { fileSystem } };
      }
    },
    {
      code: "source_authority_evidence_container_scan_incomplete",
      detail: "unstable_directory",
      label: "unstable directory",
      prepare(root) {
        const target = path.resolve(root, "records");
        const fileSystem = Object.create(fs);
        let targetRead = false;
        fileSystem.readdirSync = (candidate, ...arguments_) => {
          const entries = fs.readdirSync(candidate, ...arguments_);
          if (path.resolve(candidate) === target) targetRead = true;
          return entries;
        };
        fileSystem.lstatSync = (candidate) => {
          const stat = fs.lstatSync(candidate);
          if (!targetRead || path.resolve(candidate) !== target) return stat;
          return {
            ...stat,
            isDirectory: () => stat.isDirectory(),
            isFile: () => stat.isFile(),
            isSymbolicLink: () => stat.isSymbolicLink(),
            mtimeMs: stat.mtimeMs + 1
          };
        };
        return { options: { fileSystem } };
      }
    }
  ];

  for (const scenario of scenarios) {
    withSyntheticEvidenceContainer((root, initialProfile) => {
      const prepared = scenario.prepare(root, initialProfile) || {};
      const profile = prepared.profile || initialProfile;
      assert.throws(() => verifyBoundedEvidenceContainer(
        profile, prepared.options || {}), (error) => {
        assert.equal(error.code, scenario.code, scenario.label);
        assert.equal(error.detail, scenario.detail, scenario.label);
        assert.equal(error.message.includes(root), false, scenario.label);
        return true;
      }, scenario.label);
    });
  }
});

test("keeps every live current.v1 route on canonical source authority", () => {
  const routeFiles = fs.readdirSync(path.join(repositoryRoot, ".uai"), {
    withFileTypes: true
  }).filter((entry) => entry.isFile() && entry.name.endsWith(".uai"))
    .map((entry) => `.uai/${entry.name}`);
  routeFiles.push("workspace.uai");

  const liveRouteFiles = routeFiles.filter((relativePath) =>
    /^profile: [^\r\n]+\.current\.v1\r?$/mu.test(directText(relativePath)));
  assert.ok(liveRouteFiles.includes(".uai/receiver-brief.uai"));

  for (const relativePath of liveRouteFiles) {
    const text = directText(relativePath);
    assert.doesNotMatch(text,
      /\bauthoritative\s+recovery\s+(?:root|worktree)\b/iu,
      relativePath);
    assert.doesNotMatch(text,
      /E:\\Source\\\.tinyrustlm-model-acquisition(?:-recovered-[0-9]+)?/iu,
      relativePath);
  }

  assert.match(directText(".uai/receiver-brief.uai"),
    /Work only in E:\\Source\\Rust\\TinyRustLM\.com on codex\/model-acquisition-v2;/u);
});

test("rejects every second local source-marked TinyRustLM.com directory", () => {
  if (process.platform !== "win32" || !literalPathExists(localWorkspaceRoot)) {
    return;
  }

  const result = verifySingleSourceAuthority({ repositoryRoot });
  assert.equal(result.localScanPerformed, true);
  assert.equal(result.canonicalLayoutAvailable, true);
  assert.deepEqual(result.discoveredRoots, [path.resolve(canonicalRoot)]);
  assert.deepEqual(result.discoveredEcosystemRoots,
    canonicalEcosystemDiscovery().roots);
  // Superseded packaged builds were physically removed during storage consolidation.
  assert.deepEqual(result.permittedBinaryReleaseEvidenceArchives, []);
  assert.deepEqual(authorityResultForStdout(result), {
    canonicalLayoutAvailable: true,
    coverageClass: "registered-governed-roots-only",
    localScanPerformed: true,
    verdict: "pass",
    wholeVolumeInventoryPerformed: false
  });
  assert.equal(result.verdict, "pass");
});

test("binds exactly seven ecosystem repositories directly under E:\\Source\\Rust", () => {
  assert.equal(ecosystemRepositories.length, 7);
  assert.equal(new Set(ecosystemRepositories.map((profile) => profile.id)).size, 7);
  assert.equal(new Set(ecosystemRepositories.map((profile) => profile.root)).size, 7);
  for (const profile of ecosystemRepositories) {
    assert.equal(path.dirname(profile.root), canonicalEcosystemRoot);
    const gitDirectory = fs.lstatSync(path.join(profile.root, ".git"));
    assert.equal(gitDirectory.isDirectory(), true, profile.id);
    assert.equal(gitDirectory.isSymbolicLink(), false, profile.id);
    assert.equal(fs.realpathSync.native(path.join(profile.root, ".git")),
      path.resolve(profile.root, ".git"), profile.id);
    assert.match(profile.origin,
      /^https:\/\/github\.com\/MichaelKappel\/[A-Za-z0-9.-]+\.git$/u);
    assert.match(profile.workspaceProfile, /^profile: [a-z0-9.-]+$/u);
    assert.ok(["main", "master", "codex/model-acquisition-v2"].includes(
      profile.branch));
  }
});

test("Rust-root direct-child discovery accepts only the exact inventory", () => {
  const root = path.resolve(repositoryRoot, "fake-exact-rust-root");
  const archiveRoot = path.join(root, canonicalEcosystemLegacyArchiveName);
  const secretsRoot = path.join(root, ".local-secrets");
  const screenshotsRoot = path.join(root, "_screenshots");
  const secretsNestedRoot = path.join(secretsRoot, "nested");
  const screenshotsNestedRoot = path.join(screenshotsRoot, "nested");
  const directEntries = [
    ...canonicalEcosystemRepositoryNames.map((name) => ({
      kind: "directory",
      name
    })),
    ...canonicalEcosystemPlainFileNames.map((name) => ({ kind: "file", name })),
    ...canonicalEcosystemPlainDirectoryNames.map((name) => ({
      kind: "directory",
      name
    })),
    { kind: "directory", name: canonicalEcosystemLegacyArchiveName }
  ];
  const directoryTrees = [
    ...canonicalEcosystemRepositoryNames.map((name) => [path.join(root, name), []]),
    [path.join(root, ".vscode"), []],
    [archiveRoot, []],
    [secretsRoot, [
      { kind: "file", name: "notes.txt" },
      { kind: "directory", name: path.basename(secretsNestedRoot) }
    ]],
    [secretsNestedRoot, []],
    [screenshotsRoot, [{
      kind: "file",
      name: "capture.png"
    }, {
      kind: "directory",
      name: path.basename(screenshotsNestedRoot)
    }]],
    [screenshotsNestedRoot, []]
  ];
  const { fileSystem, readDirectories } = fakeAuthorityFileSystem(root, [
    [root, directEntries],
    ...directoryTrees
  ]);

  const discovery = discoverCanonicalEcosystemRootEntries({ fileSystem, root });
  assert.deepEqual(discovery.repositoryRoots,
    canonicalEcosystemRepositoryNames.map((name) => path.join(root, name)).sort(
      (left, right) => left.localeCompare(right)));
  assert.deepEqual(discovery.permittedNonRepositoryEntries, [
    ...canonicalEcosystemPlainFileNames,
    ...canonicalEcosystemPlainDirectoryNames
  ].map((name) => path.join(root, name)).sort((left, right) =>
    left.localeCompare(right)));
  assert.deepEqual(discovery.exemptNonSourceStorageRoots,
    [secretsRoot, screenshotsRoot].sort((left, right) =>
      left.localeCompare(right)));
  assert.deepEqual(discovery.legacyArchiveRoots, [archiveRoot]);
  assert.deepEqual(discovery.missingRepositoryRoots, []);
  assert.deepEqual(discovery.nonCanonicalEntries, []);
  assert.deepEqual(discovery.nonEmptyLegacyArchiveRoots, []);
  assert.deepEqual(discovery.nonPlainEntries, []);
  assert.deepEqual(discovery.unexpectedEntries, []);
  assert.deepEqual(discovery.unreadable, []);
  assert.deepEqual(readDirectories, [root, archiveRoot]);
  assert.doesNotThrow(() => verifyCanonicalEcosystemRootEntryDiscovery(
    discovery, { root }));

  const authorityDiscovery = discoverEcosystemAuthorityFiles({
    maximumDepth: 4,
    root
  }, {
    exemptNonSourceStorageRoots: [secretsRoot, screenshotsRoot],
    fileSystem
  });
  assert.deepEqual(authorityDiscovery.exemptNonSourceStorageRoots,
    [secretsRoot, screenshotsRoot].sort((left, right) =>
      left.localeCompare(right)));
  assert.deepEqual(authorityDiscovery.markerFiles, [path.join(root,
    "workspace.uai")]);
  assert.deepEqual(authorityDiscovery.sourceArchives, []);
  assert.equal(readDirectories.includes(secretsRoot), true);
  assert.equal(readDirectories.includes(screenshotsRoot), true);
  assert.equal(readDirectories.includes(secretsNestedRoot), true);
  assert.equal(readDirectories.includes(screenshotsNestedRoot), true);
});

test("Visual Studio metadata remains governed without hiding loose source", () => {
  const root = canonicalEcosystemRoot;
  const metadataRoot = path.join(root, ".vs");
  const nestedRoot = path.join(metadataRoot, "Rust.slnx", "v18");
  const entries = [
    ...canonicalEcosystemRepositoryNames.map((name) => ({ kind: "directory", name })),
    { kind: "directory", name: ".vs" }
  ];
  const tree = [
    [root, entries],
    ...canonicalEcosystemRepositoryNames.map((name) => [path.join(root, name), []]),
    [metadataRoot, [
      { kind: "file", name: "ProjectSettings.json" },
      { kind: "file", name: "slnx.sqlite" },
      { kind: "directory", name: "Rust.slnx" }
    ]],
    [path.dirname(nestedRoot), [{ kind: "directory", name: "v18" }]],
    [nestedRoot, [{ kind: "file", name: "DocumentLayout.json" }]]
  ];
  const { fileSystem, readDirectories } = fakeAuthorityFileSystem(root, tree);
  const direct = discoverCanonicalEcosystemRootEntries({ fileSystem, root });
  assert.doesNotThrow(() => verifyCanonicalEcosystemRootEntryDiscovery(direct, { root }));
  assert.equal(direct.exemptNonSourceStorageRoots.includes(metadataRoot), false);
  const clean = discoverEcosystemAuthorityFiles({ maximumDepth: 8, root }, { fileSystem });
  assert.equal(readDirectories.includes(nestedRoot), true);
  assert.deepEqual(clean.looseSourceFiles, []);
  assert.deepEqual(clean.unreadable, []);
  assert.deepEqual(clean.reparses, []);

  for (const name of ["lib.rs", "build.ps1", "Cargo.toml", "package.json"]) {
    const child = path.join(nestedRoot, name);
    assert.equal(isLooseSourceAuthorityEntry(child, root), true, name);
    const hostileTree = tree.map(([directory, children]) => [directory,
      directory === nestedRoot ? [...children, { kind: "file", name }] : children]);
    const hostileFs = fakeAuthorityFileSystem(root, hostileTree).fileSystem;
    const found = discoverEcosystemAuthorityFiles({ maximumDepth: 8, root }, { fileSystem: hostileFs });
    assert.equal(found.looseSourceFiles.includes(child), true, name);
    assert.throws(() => verifyEcosystemAuthorityFileDiscovery(found),
      (error) => error.code === "source_authority_loose_source_present", name);
  }

  const deniedFs = fakeAuthorityFileSystem(root, tree,
    { unreadableDirectories: [nestedRoot] }).fileSystem;
  const denied = discoverEcosystemAuthorityFiles({ maximumDepth: 8, root }, { fileSystem: deniedFs });
  assert.equal(denied.unreadable.includes(nestedRoot), true);
  assert.throws(() => verifyEcosystemAuthorityFileDiscovery(denied),
    (error) => error.code === "source_authority_scan_incomplete");
});

test("Rust-root direct-child discovery rejects every ungoverned shape", () => {
  const cases = [
    {
      errorCode: "source_authority_ecosystem_direct_child_invalid",
      label: "linked Visual Studio metadata",
      replace: { kind: "reparse", name: ".vs" }
    },
    {
      entry: { kind: "directory", name: "ordinary-source-copy" },
      errorCode: "source_authority_ecosystem_direct_child_unexpected",
      label: "neutral source directory"
    },
    {
      entry: { kind: "directory", name: "_deploy" },
      errorCode: "source_authority_ecosystem_direct_child_unexpected",
      label: "deploy directory"
    },
    {
      entry: { kind: "file", name: "backup.zip" },
      errorCode: "source_authority_ecosystem_direct_child_unexpected",
      label: "unexpected archive"
    },
    {
      entry: { kind: "file", name: "notes.txt" },
      errorCode: "source_authority_ecosystem_direct_child_unexpected",
      label: "unexpected file"
    },
    {
      errorCode: "source_authority_ecosystem_direct_child_invalid",
      label: "reparse child",
      replace: { kind: "reparse", name: ".vscode" }
    },
    {
      archiveEntries: [{ kind: "file", name: "retired-source.zip" }],
      errorCode: "source_authority_ecosystem_legacy_archive_nonempty",
      label: "nonempty legacy archive"
    },
    {
      errorCode: "source_authority_ecosystem_repository_missing",
      label: "missing repository",
      removeName: "MiniModel.org"
    }
  ];

  for (const fixture of cases) {
    const root = path.resolve(repositoryRoot,
      `fake-direct-child-${fixture.label.replaceAll(" ", "-")}`);
    const archiveRoot = path.join(root, canonicalEcosystemLegacyArchiveName);
    let entries = [
      ...canonicalEcosystemRepositoryNames.map((name) => ({
        kind: "directory",
        name
      })),
      ...canonicalEcosystemPlainFileNames.map((name) => ({
        kind: "file",
        name
      })),
      ...canonicalEcosystemPlainDirectoryNames.map((name) => ({
        kind: "directory",
        name
      })),
      { kind: "directory", name: canonicalEcosystemLegacyArchiveName }
    ];
    if (fixture.removeName) {
      entries = entries.filter((entry) => entry.name !== fixture.removeName);
    }
    if (fixture.replace) {
      entries = entries.map((entry) => entry.name === fixture.replace.name
        ? fixture.replace
        : entry);
    }
    if (fixture.entry) entries.push(fixture.entry);
    const { fileSystem, readDirectories } = fakeAuthorityFileSystem(root, [
      [root, entries],
      [archiveRoot, fixture.archiveEntries || []]
    ]);
    const discovery = discoverCanonicalEcosystemRootEntries({ fileSystem, root });
    const expectedPath = fixture.entry
      ? path.join(root, fixture.entry.name)
      : fixture.replace
        ? path.join(root, fixture.replace.name)
        : fixture.removeName
          ? path.join(root, fixture.removeName)
          : archiveRoot;
    assert.throws(() => verifyCanonicalEcosystemRootEntryDiscovery(
      discovery, { root }), (error) => error.code === fixture.errorCode &&
      error.detail.includes(expectedPath), fixture.label);
    if (fixture.entry?.kind === "directory") {
      assert.equal(readDirectories.includes(expectedPath), false, fixture.label);
    }
  }
});

test("derives the exact 15-file ecosystem authority marker inventory", () => {
  assert.equal(ecosystemAuthorityMaximumDepth, 32);
  assert.equal(evidenceOnlyRoots.length, 1);
  assert.equal(registeredEvidenceRoot, evidenceOnlyRoots[0].root);
  assert.equal(canonicalArtifactsRoot,
    path.join(canonicalRoot, "artifacts"));
  assert.equal(registeredEvidenceArtifactsRoot,
    path.join(registeredEvidenceRoot, "artifacts"));
  assert.deepEqual(ecosystemAuthorityScanScopes.map((scope) => scope.root), [
    canonicalEcosystemRoot,
    path.join(localWorkspaceRoot, "Worktrees"),
    path.join(localWorkspaceRoot, ".codex-tmp"),
    path.join(localWorkspaceRoot, ".codex-temp"),
    path.join(localWorkspaceRoot, ".tinyrustlm-evidence"),
    path.join(localWorkspaceRoot, "External"),
    ...governedExternalSourceScopes.map((scope) => scope.root),
    externalBinaryReleaseEvidenceRoot
  ]);
  assert.deepEqual(ecosystemAuthorityScanScopes.map((scope) =>
    scope.maximumDepth), [
    ecosystemAuthorityMaximumDepth,
    ecosystemAuthorityMaximumDepth,
    ecosystemAuthorityMaximumDepth,
    ecosystemAuthorityMaximumDepth,
    ecosystemAuthorityMaximumDepth,
    ecosystemAuthorityMaximumDepth,
    3,
    3,
    ecosystemAuthorityMaximumDepth,
    5,
    ecosystemAuthorityMaximumDepth
  ]);
  for (const root of ["Worktrees", ".codex-tmp", ".codex-temp",
    ".tinyrustlm-evidence", "External"]
    .map((name) => path.join(localWorkspaceRoot, name))) {
    const scope = ecosystemAuthorityScanScopes.find((candidate) =>
      candidate.root === root);
    assert.equal(scope.optional, true, root);
    assert.equal(scope.ecosystemOnly, true, root);
  }
  assert.equal(ecosystemAuthorityScanScopes.slice(1).every((scope) =>
    scope.ecosystemOnly === true), true);
  assert.equal(ecosystemAuthorityScanScopes.slice(1).every((scope) =>
    scope.optional === true), true);
  assert.equal(canonicalEcosystemAuthorityMarkers.length, 15);
  assert.equal(new Set(canonicalEcosystemAuthorityMarkers.map((candidate) =>
    candidate.toLowerCase())).size, 15);
  assert.equal(canonicalEcosystemAuthorityMarkers.includes(
    path.join(canonicalEcosystemRoot, "workspace.uai")), true);
  assert.equal(canonicalEcosystemAuthorityMarkers.includes(
    path.join(canonicalEcosystemRoot, ".uai", "taboo.uai")), false);
  for (const profile of ecosystemRepositories) {
    assert.equal(canonicalEcosystemAuthorityMarkers.includes(
      path.join(profile.root, "workspace.uai")), true, profile.id);
    assert.equal(canonicalEcosystemAuthorityMarkers.includes(
      path.join(profile.root, ".uai", "taboo.uai")), true, profile.id);
  }
});

test("strict governed scans reject a partial TinyRustLM Git source fixture", () => {
  // This filesystem is virtual; do not inherit exemptions from a canonical TEMP path.
  const governedRoot = path.resolve(path.parse(canonicalRoot).root,
    "authority-partial-git-governed-root");
  const partialRoot = path.join(governedRoot, "operation", "source");
  const unrelatedRoot = path.join(governedRoot, "unrelated-repository");
  const cacheRoot = path.join(governedRoot, "cache");
  const stagingRoot = path.join(governedRoot, "staging");
  const evidenceRoot = path.join(governedRoot, "evidence");
  const partialTinyRoot = path.join(partialRoot, "tinyrustlm");
  const partialToolsRoot = path.join(partialTinyRoot, "tools");
  const unrelatedSourceRoot = path.join(unrelatedRoot, "src");
  const cacheTinyRoot = path.join(cacheRoot, "tinyrustlm");
  const cacheToolsRoot = path.join(cacheTinyRoot, "tools");
  const stagingTinyRoot = path.join(stagingRoot, "tinyrustlm");
  const stagingAppRoot = path.join(stagingTinyRoot, "app");

  // The source fixture intentionally has Git plus copied entrypoints only.
  const { fileSystem } = fakeAuthorityFileSystem(governedRoot, [
    [governedRoot, [
      { kind: "directory", name: "operation" },
      { kind: "directory", name: "unrelated-repository" },
      { kind: "directory", name: "cache" },
      { kind: "directory", name: "staging" },
      { kind: "directory", name: "evidence" }
    ]],
    [path.join(governedRoot, "operation"), [
      { kind: "directory", name: "source" }
    ]],
    [partialRoot, [
      { kind: "directory", name: ".git" },
      { kind: "directory", name: "tinyrustlm" }
    ]],
    [path.join(partialRoot, ".git"), []],
    [partialTinyRoot, [{ kind: "directory", name: "tools" }]],
    [partialToolsRoot, [
      { kind: "file", name: "build-custody-owner.js" },
      { kind: "file", name: "windows-x64-msvc-environment.js" }
    ]],
    [unrelatedRoot, [
      { kind: "directory", name: ".git" },
      { kind: "directory", name: "src" },
      { kind: "file", name: "workspace.uai" },
      { kind: "file", name: "backup.zip" }
    ]],
    [path.join(unrelatedRoot, ".git"), []],
    [unrelatedSourceRoot, [{ kind: "file", name: "app.js" }]],
    [cacheRoot, [{ kind: "directory", name: "tinyrustlm" }]],
    [cacheTinyRoot, [{ kind: "directory", name: "tools" }]],
    [cacheToolsRoot, [
      { kind: "file", name: "build-custody-owner.js" }
    ]],
    [stagingRoot, [{ kind: "directory", name: "tinyrustlm" }]],
    [stagingTinyRoot, [{ kind: "directory", name: "app" }]],
    [stagingAppRoot, [{ kind: "file", name: "app.js" }]],
    [evidenceRoot, [
      { kind: "file", name: "bounded-record.json" },
      { kind: "reparse", name: "ordinary-library-link" }
    ]]
  ]);

  const discovery = discoverEcosystemAuthorityFiles({
    ecosystemOnly: true,
    maximumDepth: ecosystemAuthorityMaximumDepth,
    root: governedRoot
  }, { fileSystem });
  assert.deepEqual(discovery.partialGitRoots, [partialRoot]);
  assert.equal(discovery.looseSourceFiles.includes(
    path.join(stagingAppRoot, "app.js")), true);
  assert.equal(discovery.looseSourceFiles.includes(
    path.join(cacheToolsRoot, "build-custody-owner.js")), true);
  assert.deepEqual(discovery.markerFiles, []);
  assert.deepEqual(discovery.sourceArchives, []);
  assert.deepEqual(discovery.reparses, []);
  assert.deepEqual(discovery.unreadable, []);
  assert.equal(tinyRustLmGitEntrypointRelativePaths.includes(
    "tinyrustlm/tools/build-custody-owner.js"), true);
  assert.equal(tinyRustLmGitEntrypointRelativePaths.includes(
    "tinyrustlm/tools/windows-x64-msvc-environment.js"), true);
  assert.throws(() => verifyEcosystemAuthorityFileDiscovery({
    ...discovery,
    markerFiles: [...canonicalEcosystemAuthorityMarkers]
  }), (error) => error.code === "source_authority_loose_source_present" &&
    error.detail.includes(path.join(stagingAppRoot, "app.js")));
  assert.throws(() => verifyEcosystemAuthorityFileDiscovery({
    ...discovery,
    looseSourceFiles: [],
    markerFiles: [...canonicalEcosystemAuthorityMarkers]
  }), (error) => error.code === "source_authority_partial_git_source_present" &&
    error.detail === undefined && !error.message.includes(partialRoot));
});

test("authority-file discovery scans ignored deploy staging without Git", () => {
  const scanRoot = path.resolve(repositoryRoot, "fake-authority-file-root");
  const repoRoot = path.join(scanRoot, "Site.example");
  const deployRoot = path.join(repoRoot, "deploy");
  const stagingRoot = path.join(deployRoot, "staging");
  const versionRoot = path.join(stagingRoot, "1.8.2");
  const uaiRoot = path.join(versionRoot, ".uai");
  const docsRoot = path.join(versionRoot, "docs");
  const runtimePortalRoot = path.join(docsRoot, "runtime-portal");
  const runtimeDocsRoot = path.join(runtimePortalRoot, "runtime-docs");
  const reportsRoot = path.join(docsRoot, "reports");
  const tabooPath = path.join(uaiRoot, "TaBoO.uAi");
  const workspacePath = path.join(runtimeDocsRoot, "WORKSPACE.UAI");
  const reviewBundlePath = path.join(reportsRoot, allSourceReviewBundleName);
  const { fileSystem, readDirectories } = fakeAuthorityFileSystem(scanRoot, [
    [scanRoot, [
      { kind: "file", name: ".gitignore" },
      { kind: "directory", name: path.basename(repoRoot) }
    ]],
    [repoRoot, [{ kind: "directory", name: "deploy" }]],
    [deployRoot, [{ kind: "directory", name: "staging" }]],
    [stagingRoot, [{ kind: "directory", name: "1.8.2" }]],
    [versionRoot, [
      { kind: "directory", name: ".uai" },
      { kind: "directory", name: "docs" }
    ]],
    [uaiRoot, [{ kind: "file", name: path.basename(tabooPath) }]],
    [docsRoot, [
      { kind: "directory", name: "reports" },
      { kind: "directory", name: "runtime-portal" }
    ]],
    [runtimePortalRoot, [{ kind: "directory", name: "runtime-docs" }]],
    [runtimeDocsRoot, [{ kind: "file", name: path.basename(workspacePath) }]],
    [reportsRoot, [{ kind: "file", name: allSourceReviewBundleName }]]
  ]);

  const discovery = discoverEcosystemAuthorityFiles({
    maximumDepth: 8,
    root: scanRoot
  }, { fileSystem });
  assert.deepEqual(discovery.markerFiles, [tabooPath, workspacePath].sort(
    (left, right) => left.localeCompare(right)));
  assert.deepEqual(discovery.reviewBundles, [reviewBundlePath]);
  assert.deepEqual(discovery.unreadable, []);
  assert.deepEqual(discovery.reparses, []);
  assert.deepEqual(discovery.depthExceeded, []);
  assert.equal(readDirectories.includes(stagingRoot), true);
  assert.equal(readDirectories.includes(runtimeDocsRoot), true);
});

test("authority-file discovery recursively rejects markers and archives in exempt storage", () => {
  const sourceRoot = path.resolve(repositoryRoot,
    "fake-exempt-archive-source-root");
  const exemptRoot = path.join(sourceRoot, ".local-secrets");
  const nestedExemptRoot = path.join(exemptRoot, "private");
  const evidenceRoot = path.resolve(repositoryRoot,
    "fake-exempt-archive-evidence-root");
  const evidenceArtifacts = path.join(evidenceRoot, "artifacts");
  const exemptArchive = path.join(exemptRoot,
    "tinyrustlm-private-source.zip");
  const evidenceArchive = path.join(evidenceArtifacts,
    "minimodel-evidence-source.tar.gz");
  const neutralArchive = path.join(nestedExemptRoot, "personal-backup.zip");
  const hiddenMarker = path.join(nestedExemptRoot, "workspace.uai");
  const { fileSystem, readDirectories } = fakeAuthorityFileSystem(sourceRoot, [
    [sourceRoot, [{ kind: "directory", name: ".local-secrets" }]],
    [exemptRoot, [
      { kind: "file", name: path.basename(exemptArchive) },
      { kind: "directory", name: path.basename(nestedExemptRoot) }
    ]],
    [nestedExemptRoot, [
      { kind: "file", name: path.basename(neutralArchive) },
      { kind: "file", name: path.basename(hiddenMarker) }
    ]],
    [evidenceRoot, [{ kind: "directory", name: "artifacts" }]],
    [evidenceArtifacts, [{
      kind: "file",
      name: path.basename(evidenceArchive)
    }]]
  ]);

  const discovery = discoverEcosystemAuthorityFiles([
    { maximumDepth: 4, root: sourceRoot },
    { maximumDepth: 4, root: evidenceRoot }
  ], {
    exemptNonSourceStorageRoots: [exemptRoot],
    fileSystem
  });
  assert.deepEqual(discovery.sourceArchives,
    [evidenceArchive, exemptArchive, neutralArchive].sort((left, right) =>
      left.localeCompare(right)));
  assert.deepEqual(discovery.markerFiles, [hiddenMarker]);
  assert.equal(readDirectories.filter((candidate) =>
    candidate === exemptRoot).length, 1);
  assert.equal(readDirectories.includes(nestedExemptRoot), true);
  assert.throws(() => verifyEcosystemAuthorityFileDiscovery({
    ...discovery,
    markerFiles: [...canonicalEcosystemAuthorityMarkers]
  }), (error) => error.code === "source_authority_source_archive_present" &&
    error.detail === discovery.sourceArchives.join(" | "));
  assert.throws(() => verifyEcosystemAuthorityFileDiscovery({
    ...discovery,
    markerFiles: [...canonicalEcosystemAuthorityMarkers, hiddenMarker],
    sourceArchives: []
  }), (error) =>
    error.code === "source_authority_ecosystem_marker_inventory_invalid" &&
    error.detail.includes(`unexpected:${hiddenMarker}`));
});

test("authority-file discovery maps artifact junctions and scans evidence directly", () => {
  const sourceRoot = path.resolve(repositoryRoot, "fake-mapped-source-root");
  const sourceArtifacts = path.join(sourceRoot, "artifacts");
  const junctionPath = path.join(sourceArtifacts, "lane");
  const evidenceRoot = path.resolve(repositoryRoot, "fake-mapped-evidence-root");
  const evidenceArtifacts = path.join(evidenceRoot, "artifacts");
  const evidenceLane = path.join(evidenceArtifacts, "lane");
  const { fileSystem, readDirectories } = fakeAuthorityFileSystem(sourceRoot, [
    [sourceRoot, [{ kind: "directory", name: "artifacts" }]],
    [sourceArtifacts, [{ kind: "reparse", name: "lane" }]],
    [evidenceRoot, [{ kind: "directory", name: "artifacts" }]],
    [evidenceArtifacts, [{ kind: "directory", name: "lane" }]],
    [evidenceLane, []]
  ], { reparseTargets: [[junctionPath, evidenceLane]] });

  const discovery = discoverEcosystemAuthorityFiles([
    { maximumDepth: 4, root: sourceRoot },
    { maximumDepth: 4, root: evidenceRoot }
  ], {
    artifactReparsePolicy: {
      canonicalArtifactsRoot: sourceArtifacts,
      registeredEvidenceArtifactsRoot: evidenceArtifacts,
      registeredEvidenceRoot: evidenceRoot
    },
    fileSystem
  });
  assert.deepEqual(discovery.permittedReparses, [junctionPath]);
  assert.deepEqual(discovery.reparses, []);
  assert.deepEqual(discovery.reparseTargetDrift, []);
  assert.equal(readDirectories.includes(junctionPath), false);
  assert.equal(readDirectories.includes(evidenceLane), true);
  assert.doesNotThrow(() => verifyEcosystemAuthorityFileDiscovery({
    ...discovery,
    markerFiles: [...canonicalEcosystemAuthorityMarkers]
  }));
});

test("authority-file discovery rejects artifact junction target drift", () => {
  const sourceRoot = path.resolve(repositoryRoot, "fake-drift-source-root");
  const sourceArtifacts = path.join(sourceRoot, "artifacts");
  const junctionPath = path.join(sourceArtifacts, "lane");
  const evidenceRoot = path.resolve(repositoryRoot, "fake-drift-evidence-root");
  const evidenceArtifacts = path.join(evidenceRoot, "artifacts");
  const expectedLane = path.join(evidenceArtifacts, "lane");
  const driftLane = path.join(evidenceArtifacts, "wrong-lane");
  const { fileSystem, readDirectories } = fakeAuthorityFileSystem(sourceRoot, [
    [sourceRoot, [{ kind: "directory", name: "artifacts" }]],
    [sourceArtifacts, [{ kind: "reparse", name: "lane" }]],
    [evidenceRoot, [{ kind: "directory", name: "artifacts" }]],
    [evidenceArtifacts, [
      { kind: "directory", name: "lane" },
      { kind: "directory", name: "wrong-lane" }
    ]],
    [expectedLane, []],
    [driftLane, []]
  ], { reparseTargets: [[junctionPath, driftLane]] });

  const discovery = discoverEcosystemAuthorityFiles([
    { maximumDepth: 4, root: sourceRoot },
    { maximumDepth: 4, root: evidenceRoot }
  ], {
    artifactReparsePolicy: {
      canonicalArtifactsRoot: sourceArtifacts,
      registeredEvidenceArtifactsRoot: evidenceArtifacts,
      registeredEvidenceRoot: evidenceRoot
    },
    fileSystem
  });
  assert.deepEqual(discovery.permittedReparses, []);
  assert.deepEqual(discovery.reparseTargetDrift, [junctionPath]);
  assert.equal(readDirectories.includes(junctionPath), false);
  assert.throws(() => verifyEcosystemAuthorityFileDiscovery({
    ...discovery,
    markerFiles: [...canonicalEcosystemAuthorityMarkers]
  }), (error) => error.code === "source_authority_scan_incomplete" &&
    error.detail === `reparse_target_drift:${junctionPath}`);
});

test("authority-file discovery admits only registered non-source storage targets", () => {
  const storageParent = "E:\\Source\\External\\TinyRustLM-storage-fixture";
  const storageRoot = path.join(storageParent, "model-data");
  const expectedTarget = path.join(os.homedir(), "External",
    "TinyRustLM-storage-fixture", "model-data");
  const driftTarget = path.join(os.homedir(), "External",
    "TinyRustLM-storage-fixture", "wrong-data");
  const profile = [{ root: storageRoot, target: expectedTarget }];

  for (const [label, actualTarget, expectedField] of [
    ["exact", expectedTarget, "permittedReparses"],
    ["drift", driftTarget, "reparseTargetDrift"]
  ]) {
    const { fileSystem, readDirectories } = fakeAuthorityFileSystem(storageParent, [
      [storageParent, [{ kind: "directory-reparse", name: "model-data" }]],
      [expectedTarget, []],
      [driftTarget, []]
    ], { reparseTargets: [[storageRoot, actualTarget]] });
    const discovery = discoverEcosystemAuthorityFiles({
      ecosystemOnly: true,
      maximumDepth: 2,
      root: storageParent
    }, {
      fileSystem,
      nonSourceStorageReparseProfiles: profile
    });
    assert.deepEqual(discovery[expectedField], [storageRoot], label);
    assert.equal(readDirectories.includes(storageRoot), false, label);
  }
  assert.equal(registeredNonSourceStorageReparseProfiles.length, 4);
  assert.equal(new Set(registeredNonSourceStorageReparseProfiles.map(
    (candidate) => candidate.root.toLowerCase())).size, 4);
});

test("authority-file discovery rejects directory reparses inside evidence", () => {
  const sourceRoot = path.resolve(repositoryRoot,
    "fake-evidence-reparse-source-root");
  const sourceArtifacts = path.join(sourceRoot, "artifacts");
  const evidenceRoot = path.resolve(repositoryRoot,
    "fake-evidence-reparse-root");
  const evidenceArtifacts = path.join(evidenceRoot, "artifacts");
  const evidenceReparse = path.join(evidenceArtifacts, "linked");
  const outsideTarget = path.resolve(repositoryRoot,
    "fake-evidence-reparse-outside");
  const { fileSystem, readDirectories } = fakeAuthorityFileSystem(sourceRoot, [
    [sourceRoot, [{ kind: "directory", name: "artifacts" }]],
    [sourceArtifacts, []],
    [evidenceRoot, [{ kind: "directory", name: "artifacts" }]],
    [evidenceArtifacts, [{ kind: "directory-reparse", name: "linked" }]]
  ], { reparseTargets: [[evidenceReparse, outsideTarget]] });

  const discovery = discoverEcosystemAuthorityFiles([
    { maximumDepth: 4, root: sourceRoot },
    { maximumDepth: 4, root: evidenceRoot }
  ], {
    artifactReparsePolicy: {
      canonicalArtifactsRoot: sourceArtifacts,
      registeredEvidenceArtifactsRoot: evidenceArtifacts,
      registeredEvidenceRoot: evidenceRoot
    },
    fileSystem
  });
  assert.deepEqual(discovery.permittedLeafSymlinks, []);
  assert.deepEqual(discovery.permittedReparses, []);
  assert.deepEqual(discovery.reparses, [evidenceReparse]);
  assert.equal(readDirectories.includes(evidenceReparse), false);
  assert.throws(() => verifyEcosystemAuthorityFileDiscovery({
    ...discovery,
    markerFiles: [...canonicalEcosystemAuthorityMarkers]
  }), (error) => error.code === "source_authority_scan_incomplete" &&
    error.detail === `reparse:${evidenceReparse}`);
});

test("authority-file discovery permits direct evidence library leaf links", () => {
  const sourceRoot = path.resolve(repositoryRoot,
    "fake-evidence-leaf-source-root");
  const sourceArtifacts = path.join(sourceRoot, "artifacts");
  const evidenceRoot = path.resolve(repositoryRoot,
    "fake-evidence-leaf-root");
  const evidenceArtifacts = path.join(evidenceRoot, "artifacts");
  const verificationRoot = path.join(evidenceArtifacts, "verification");
  const sysroot = path.join(verificationRoot, "arm64-sysroot");
  const libRoot = path.join(sysroot, "lib");
  const usrRoot = path.join(sysroot, "usr");
  const usrLibRoot = path.join(usrRoot, "lib");
  const architectureRoot = path.join(usrLibRoot, "aarch64-linux-gnu");
  const standardLink = path.join(libRoot, "libstdc++.so.6");
  const standardTarget = path.join(libRoot, "libstdc++.so.6.0.33");
  const zlibLink = path.join(architectureRoot, "libz.so.1");
  const zlibTarget = path.join(architectureRoot, "libz.so.1.3");
  const { fileSystem, readDirectories } = fakeAuthorityFileSystem(sourceRoot, [
    [sourceRoot, [{ kind: "directory", name: "artifacts" }]],
    [sourceArtifacts, []],
    [evidenceRoot, [{ kind: "directory", name: "artifacts" }]],
    [evidenceArtifacts, [{ kind: "directory", name: "verification" }]],
    [verificationRoot, [{ kind: "directory", name: "arm64-sysroot" }]],
    [sysroot, [
      { kind: "directory", name: "lib" },
      { kind: "directory", name: "usr" }
    ]],
    [libRoot, [
      { kind: "reparse", name: path.basename(standardLink) },
      { kind: "file", name: path.basename(standardTarget) }
    ]],
    [usrRoot, [{ kind: "directory", name: "lib" }]],
    [usrLibRoot, [{ kind: "directory", name: "aarch64-linux-gnu" }]],
    [architectureRoot, [
      { kind: "reparse", name: path.basename(zlibLink) },
      { kind: "file", name: path.basename(zlibTarget) }
    ]]
  ], {
    reparseTargets: [
      [standardLink, standardTarget],
      [zlibLink, zlibTarget]
    ],
    storedLinkTargets: [
      [standardLink, path.basename(standardTarget)],
      [zlibLink, path.basename(zlibTarget)]
    ]
  });

  const discovery = discoverEcosystemAuthorityFiles([
    { maximumDepth: 10, root: sourceRoot },
    { maximumDepth: 10, root: evidenceRoot }
  ], {
    artifactReparsePolicy: {
      canonicalArtifactsRoot: sourceArtifacts,
      registeredEvidenceArtifactsRoot: evidenceArtifacts,
      registeredEvidenceRoot: evidenceRoot
    },
    fileSystem
  });
  assert.deepEqual(discovery.permittedLeafSymlinks,
    [standardLink, zlibLink].sort((left, right) => left.localeCompare(right)));
  assert.deepEqual(discovery.reparses, []);
  assert.deepEqual(discovery.reparseTargetDrift, []);
  assert.deepEqual(discovery.unreadable, []);
  assert.equal(readDirectories.includes(standardLink), false);
  assert.equal(readDirectories.includes(zlibLink), false);
  assert.doesNotThrow(() => verifyEcosystemAuthorityFileDiscovery({
    ...discovery,
    markerFiles: [...canonicalEcosystemAuthorityMarkers]
  }));
});

test("authority-file discovery rejects hostile evidence leaf links", () => {
  const cases = [
    { label: "absolute-win32", storedTarget: "E:\\outside\\payload.so" },
    { label: "absolute-posix", storedTarget: "/outside/payload.so" },
    { label: "multi-segment", storedTarget: "nested\\payload.so" },
    { label: "dot-segment", storedTarget: ".." },
    { expected: "unreadable", includeTarget: false, label: "dangling" },
    { chain: true, label: "chained" },
    { expected: "reparse_target_drift", label: "out-of-root", outside: true },
    { label: "marker-link", linkName: "workspace.uai" },
    { label: "marker-target", targetName: "taboo.uai" },
    { label: "review-bundle", targetName: allSourceReviewBundleName },
    { label: "archive", targetName: "evidence.zip" },
    { label: "git-config", targetName: ".gitconfig" },
    { label: "config", targetName: "config.json" },
    { label: "entrypoint", targetName: "run.ps1" },
    { label: "source-path", parentName: "src" }
  ];

  for (const fixture of cases) {
    const sourceRoot = path.resolve(repositoryRoot,
      `fake-hostile-leaf-${fixture.label}-source`);
    const sourceArtifacts = path.join(sourceRoot, "artifacts");
    const evidenceRoot = path.resolve(repositoryRoot,
      `fake-hostile-leaf-${fixture.label}-evidence`);
    const evidenceArtifacts = path.join(evidenceRoot, "artifacts");
    const verificationRoot = path.join(evidenceArtifacts, "verification");
    const leafRoot = path.join(verificationRoot,
      fixture.parentName || "libraries");
    const linkName = fixture.linkName || "payload.so.1";
    const targetName = fixture.targetName || "payload.so.1.2";
    const storedTarget = fixture.storedTarget || targetName;
    const linkPath = path.join(leafRoot, linkName);
    const targetPath = path.join(leafRoot, targetName);
    const finalTarget = path.join(leafRoot, "payload.so.1.2.3");
    const outsideTarget = path.resolve(repositoryRoot,
      `fake-hostile-leaf-${fixture.label}-outside`);
    const leafEntries = [{ kind: "reparse", name: linkName }];
    if (fixture.includeTarget !== false) {
      leafEntries.push({
        kind: fixture.chain ? "reparse" : "file",
        name: targetName
      });
    }
    if (fixture.chain) {
      leafEntries.push({ kind: "file", name: path.basename(finalTarget) });
    }
    const reparseTargets = fixture.outside
      ? [[linkPath, outsideTarget], [targetPath, outsideTarget]]
      : [[linkPath, fixture.chain ? finalTarget : targetPath]];
    if (fixture.chain) reparseTargets.push([targetPath, finalTarget]);
    const storedLinkTargets = [[linkPath, storedTarget]];
    if (fixture.chain) {
      storedLinkTargets.push([targetPath, path.basename(finalTarget)]);
    }
    const { fileSystem, readDirectories } = fakeAuthorityFileSystem(sourceRoot, [
      [sourceRoot, [{ kind: "directory", name: "artifacts" }]],
      [sourceArtifacts, []],
      [evidenceRoot, [{ kind: "directory", name: "artifacts" }]],
      [evidenceArtifacts, [{ kind: "directory", name: "verification" }]],
      [verificationRoot, [{
        kind: "directory",
        name: fixture.parentName || "libraries"
      }]],
      [leafRoot, leafEntries]
    ], { reparseTargets, storedLinkTargets });

    const discovery = discoverEcosystemAuthorityFiles([
      { maximumDepth: 6, root: sourceRoot },
      { maximumDepth: 6, root: evidenceRoot }
    ], {
      artifactReparsePolicy: {
        canonicalArtifactsRoot: sourceArtifacts,
        registeredEvidenceArtifactsRoot: evidenceArtifacts,
        registeredEvidenceRoot: evidenceRoot
      },
      fileSystem
    });
    assert.equal(discovery.permittedLeafSymlinks.includes(linkPath), false,
      fixture.label);
    assert.equal(readDirectories.includes(linkPath), false, fixture.label);
    const expectedCategory = fixture.expected || "reparse";
    const expectedPath = expectedCategory === "unreadable"
      ? path.resolve(leafRoot, storedTarget)
      : linkPath;
    assert.throws(() => verifyEcosystemAuthorityFileDiscovery({
      ...discovery,
      markerFiles: [...canonicalEcosystemAuthorityMarkers]
    }), (error) => error.code === "source_authority_scan_incomplete" &&
      error.detail === `${expectedCategory}:${expectedPath}`, fixture.label);
  }
});

test("authority-file discovery finds protected files inside evidence storage", () => {
  const sourceRoot = path.resolve(repositoryRoot,
    "fake-evidence-protected-source-root");
  const sourceArtifacts = path.join(sourceRoot, "artifacts");
  const evidenceRoot = path.resolve(repositoryRoot,
    "fake-evidence-protected-root");
  const evidenceArtifacts = path.join(evidenceRoot, "artifacts");
  const nestedRoot = path.join(evidenceArtifacts, "nested");
  const markerPath = path.join(nestedRoot, "workspace.uai");
  const reviewBundlePath = path.join(nestedRoot, allSourceReviewBundleName);
  const { fileSystem } = fakeAuthorityFileSystem(sourceRoot, [
    [sourceRoot, [{ kind: "directory", name: "artifacts" }]],
    [sourceArtifacts, []],
    [evidenceRoot, [{ kind: "directory", name: "artifacts" }]],
    [evidenceArtifacts, [{ kind: "directory", name: "nested" }]],
    [nestedRoot, [
      { kind: "file", name: path.basename(markerPath) },
      { kind: "file", name: path.basename(reviewBundlePath) }
    ]]
  ]);

  const discovery = discoverEcosystemAuthorityFiles([
    { maximumDepth: 4, root: sourceRoot },
    { maximumDepth: 4, root: evidenceRoot }
  ], {
    artifactReparsePolicy: {
      canonicalArtifactsRoot: sourceArtifacts,
      registeredEvidenceArtifactsRoot: evidenceArtifacts,
      registeredEvidenceRoot: evidenceRoot
    },
    fileSystem
  });
  assert.deepEqual(discovery.markerFiles, [markerPath]);
  assert.deepEqual(discovery.reviewBundles, [reviewBundlePath]);
  assert.throws(() => verifyEcosystemAuthorityFileDiscovery({
    ...discovery,
    markerFiles: [...canonicalEcosystemAuthorityMarkers, markerPath],
    reviewBundles: []
  }), (error) =>
    error.code === "source_authority_ecosystem_marker_inventory_invalid");
  assert.throws(() => verifyEcosystemAuthorityFileDiscovery({
    ...discovery,
    markerFiles: [...canonicalEcosystemAuthorityMarkers]
  }), (error) => error.code === "source_authority_superseded_file_present");
});

test("authority-file verification requires the exact marker set", () => {
  assert.doesNotThrow(() => verifyEcosystemAuthorityFileDiscovery(
    canonicalAuthorityFileDiscovery()));

  for (const extra of [
    path.join(canonicalEcosystemRoot, "nested", "workspace.uai"),
    path.join(canonicalEcosystemRoot, "deploy", "staging", "taboo.uai")
  ]) {
    assert.throws(() => verifyEcosystemAuthorityFileDiscovery(
      canonicalAuthorityFileDiscovery({
        markerFiles: [...canonicalEcosystemAuthorityMarkers, extra]
      })), (error) =>
      error.code === "source_authority_ecosystem_marker_inventory_invalid" &&
      error.detail.includes(`unexpected:${extra}`), extra);
  }

  const missing = canonicalEcosystemAuthorityMarkers[0];
  assert.throws(() => verifyEcosystemAuthorityFileDiscovery(
    canonicalAuthorityFileDiscovery({
      markerFiles: canonicalEcosystemAuthorityMarkers.slice(1)
    })), (error) =>
    error.code === "source_authority_ecosystem_marker_inventory_invalid" &&
    error.detail.includes(`missing:${missing}`));
  assert.throws(() => verifyEcosystemAuthorityFileDiscovery(
    canonicalAuthorityFileDiscovery({ nonRegular: [missing] })), (error) =>
    error.code === "source_authority_ecosystem_marker_inventory_invalid" &&
    error.detail.includes(`non_regular:${missing}`));
});

test("authority-file verification rejects every exact review bundle copy", () => {
  for (const bundlePath of [
    path.join(canonicalEcosystemRoot, "TinyRustLM.MiRust.com", "docs", "reports",
      allSourceReviewBundleName),
    path.join(canonicalEcosystemRoot, "TinyRustLM.MiRust.com", "deploy", "staging",
      "1.8.2", "docs", "reports", allSourceReviewBundleName)
  ]) {
    assert.throws(() => verifyEcosystemAuthorityFileDiscovery(
      canonicalAuthorityFileDiscovery({ reviewBundles: [bundlePath] })),
    (error) => error.code === "source_authority_superseded_file_present" &&
      error.detail === bundlePath, bundlePath);
  }
});

test("authority-file discovery fails closed without following reparses", () => {
  const scanRoot = path.resolve(repositoryRoot, "fake-authority-reparse-root");
  const reparsePath = path.join(scanRoot, "linked-source");
  const { fileSystem, readDirectories } = fakeAuthorityFileSystem(scanRoot, [
    [scanRoot, [{ kind: "reparse", name: path.basename(reparsePath) }]]
  ]);

  const discovery = discoverEcosystemAuthorityFiles({
    maximumDepth: 4,
    root: scanRoot
  }, { fileSystem });
  assert.deepEqual(discovery.reparses, [reparsePath]);
  assert.deepEqual(readDirectories, [scanRoot]);
  assert.throws(() => verifyEcosystemAuthorityFileDiscovery(discovery),
    (error) => error.code === "source_authority_scan_incomplete" &&
      error.detail === `reparse:${reparsePath}`);
});

test("authority-file discovery fails closed on unreadable directories", () => {
  const scanRoot = path.resolve(repositoryRoot, "fake-authority-unreadable-root");
  const unreadablePath = path.join(scanRoot, "denied");
  const { fileSystem } = fakeAuthorityFileSystem(scanRoot, [
    [scanRoot, [{ kind: "directory", name: path.basename(unreadablePath) }]],
    [unreadablePath, []]
  ], { unreadableDirectories: [unreadablePath] });

  const discovery = discoverEcosystemAuthorityFiles({
    maximumDepth: 4,
    root: scanRoot
  }, { fileSystem });
  assert.deepEqual(discovery.unreadable, [unreadablePath]);
  assert.throws(() => verifyEcosystemAuthorityFileDiscovery(discovery),
    (error) => error.code === "source_authority_scan_incomplete" &&
      error.detail === `unreadable:${unreadablePath}`);
});

test("authority-file depth bounds block instead of truncating discovery", () => {
  const scanRoot = path.resolve(repositoryRoot, "fake-authority-depth-root");
  const firstLevel = path.join(scanRoot, "first");
  const blockedLevel = path.join(firstLevel, "second");
  const hiddenMarker = path.join(blockedLevel, "workspace.uai");
  const { fileSystem, readDirectories } = fakeAuthorityFileSystem(scanRoot, [
    [scanRoot, [{ kind: "directory", name: "first" }]],
    [firstLevel, [{ kind: "directory", name: "second" }]],
    [blockedLevel, [{ kind: "file", name: path.basename(hiddenMarker) }]]
  ]);

  const discovery = discoverEcosystemAuthorityFiles({
    maximumDepth: 1,
    root: scanRoot
  }, { fileSystem });
  assert.deepEqual(discovery.depthExceeded, [blockedLevel]);
  assert.deepEqual(discovery.markerFiles, []);
  assert.equal(readDirectories.includes(blockedLevel), false);
  assert.throws(() => verifyEcosystemAuthorityFileDiscovery(discovery),
    (error) => error.code === "source_authority_scan_incomplete" &&
      error.detail === `depth:${blockedLevel}`);
});

test("authority-file discovery rejects malformed scopes and verdicts", () => {
  assert.throws(() => discoverEcosystemAuthorityFiles({
    maximumDepth: -1,
    root: canonicalEcosystemRoot
  }), (error) => error.code === "source_authority_scan_scope_invalid");
  assert.throws(() => verifyEcosystemAuthorityFileDiscovery({
    ...canonicalAuthorityFileDiscovery(),
    markerFiles: null
  }), (error) => error.code === "source_authority_discovery_invalid");
});

test("canonical segment validation rejects Windows aliases and ADS spellings", () => {
  for (const candidate of [
    "",
    ".",
    "..",
    "name.",
    "name ",
    "name:stream",
    "nested/name",
    "nested\\name",
    "CON",
    "con.txt",
    "bad\0name",
    "\ud800",
    "e\u0301"
  ]) {
    assert.equal(isCanonicalPathSegment(candidate), false,
      JSON.stringify(candidate));
  }
  for (const candidate of [
    ".local-secrets",
    "_screenshots",
    "COM10",
    "model.tar.gz",
    "\u00e9"
  ]) {
    assert.equal(isCanonicalPathSegment(candidate), true, candidate);
  }

  const scanRoot = path.resolve(repositoryRoot, "fake-noncanonical-root");
  const aliasedPath = `${scanRoot}${path.sep}workspace.uai.`;
  const duplicatePath = path.join(scanRoot, "SAFE");
  const { fileSystem } = fakeAuthorityFileSystem(scanRoot, [[scanRoot, [
    { kind: "file", name: "workspace.uai." },
    { kind: "directory", name: "safe" },
    { kind: "directory", name: "SAFE" }
  ]]]);
  const discovery = discoverEcosystemAuthorityFiles({
    maximumDepth: 2,
    root: scanRoot
  }, { fileSystem });
  assert.deepEqual(discovery.nonCanonicalEntries,
    [aliasedPath, duplicatePath].sort((left, right) =>
      left.localeCompare(right)));
  assert.throws(() => verifyEcosystemAuthorityFileDiscovery(discovery), (error) =>
    error.code === "source_authority_scan_incomplete" &&
    error.detail.includes(`noncanonical:${aliasedPath}`) &&
    error.detail.includes(`noncanonical:${duplicatePath}`));
});

test("probes neutral E:\\Source children and deeply scans governed locations", () => {
  assert.equal(sourceScanScopes.some((scope) =>
    scope.root === path.join(localWorkspaceRoot, "External") &&
    scope.maximumDepth >= 5), true);
  assert.equal(sourceScanScopes.some((scope) =>
    scope.root === path.join(localWorkspaceRoot, ".tinyrustlm-evidence")), true);
  assert.equal(sourceScanScopes.some((scope) =>
    scope.root === path.join(localWorkspaceRoot, ".codex-temp")), true);
  assert.equal(sourceScanScopes.find((scope) =>
    scope.root === path.join(localWorkspaceRoot, ".codex-temp"))
    .entryNamePattern, undefined);

  const neutralName = "ordinary-project-location";
  const ecosystemName = "retired-tinyrustlm-copy";
  const expandedScopes = effectiveScanScopes(sourceScanScopes, {
    localWorkspaceAvailable: true,
    platform: "win32",
    workspaceEntries: [neutralName, ecosystemName].map((name) => ({
      isDirectory: () => true,
      isSymbolicLink: () => false,
      name
    }))
  });
  assert.equal(expandedScopes.some((scope) =>
    scope.root === path.join(localWorkspaceRoot, neutralName) &&
    scope.maximumDepth === 0 && scope.directChildProbeBoundary === true), true);
  assert.equal(expandedScopes.some((scope) =>
    scope.root === path.join(localWorkspaceRoot, ecosystemName) &&
    scope.maximumDepth === ecosystemAuthorityMaximumDepth &&
    scope.directChildProbeBoundary === false), true);
  const governedCoverage = new Map([
    ["D:\\tw", 3],
    ["D:\\Archive\\Source", 3],
    ["D:\\TinyRustLM-vnext-20260812", 32],
    ["E:\\Source\\External\\TinyRustLM-release-evidence", 5]
  ]);
  assert.deepEqual(new Map(governedExternalSourceScopes.map((scope) =>
    [scope.root, scope.maximumDepth])), governedCoverage);
  assert.equal(sourceArchiveScanScopes, sourceScanScopes);
  for (const [root, maximumDepth] of [...governedCoverage].slice(0, 3)) {
    assert.equal(sourceScanScopes.some((scope) =>
      scope.root === root && scope.maximumDepth === maximumDepth), true, root);
  }
  assert.equal(sourceScanScopes.some((scope) =>
    scope.root === path.join(localWorkspaceRoot, "External") &&
    scope.maximumDepth >= governedCoverage.get(
      "E:\\Source\\External\\TinyRustLM-release-evidence")), true);
  for (const root of ["D:\\tw\\26236864", "D:\\tw\\3116220"]) {
    assert.equal(supersededSourceRoots.includes(root), true, root);
  }
  for (const root of [
    "D:\\Archive\\Source\\GGUF.MiRust.com",
    "D:\\TinyRustLM-vnext-20260812\\active-git-metadata",
    "D:\\TinyRustLM-vnext-20260812\\git-metadata-backups",
    "D:\\TinyRustLM-vnext-20260812\\minimodel-source\\8439e224146c790ce6a9da36a32c4c49890cac52",
    "D:\\TinyRustLM-vnext-20260812\\workspace-memory-backups"
  ]) {
    assert.equal(supersededEcosystemSourceRoots.includes(root), true, root);
  }
  for (const filePath of [
    "D:\\tw\\26236864\\.git",
    "D:\\tw\\3116220\\.git",
    "D:\\TinyRustLM-vnext-20260812\\git-metadata-backups\\archive-properties-v1\\index.before-doc-handoff",
    "D:\\TinyRustLM-vnext-20260812\\git-metadata-backups\\archive-properties-v1\\index.second-space-move",
    "D:\\TinyRustLM-vnext-20260812\\git-metadata-backups\\archive-properties-v1\\index.uncompressed-moved"
  ]) {
    assert.equal(supersededLooseSourceFiles.includes(filePath), true, filePath);
  }
  assert.deepEqual(supersededSourceArchives, [
    "D:\\Archive\\Source\\GGUF.MiRust.com-20260625.zip",
    "E:\\Source\\External\\TinyRustLM-release-evidence\\source-clean-root-20260802\\tinyrustlm-clean-source-a9db946.tar.gz"
  ]);
  assert.equal(supersededSourceRoots.includes(
    "E:\\Source\\External\\TinyRustLM-history-audit-20260802"), true);
  assert.equal(supersededSourceRoots.includes(
    "E:\\Source\\External\\TinyRustLM-source-history-externalized"), true);
  assert.equal(supersededSourceRoots.includes(
    "E:\\Source\\Worktrees\\rust-site-release-20260809\\TinyRustLM.com"), true);
  assert.equal(supersededSourceRoots.includes(
    "D:\\TinyRustLM-vnext-20260812\\temporary-relocation\\active-tinyrustlm-tree"),
  true);
  assert.equal(supersededEcosystemSourceRoots.includes(
    "E:\\Source\\.codex-tmp\\stale-site-roots-after-metadata-loss-20260829-v1"),
  true);
  assert.equal(supersededEcosystemSourceRoots.includes(
    "E:\\Source\\Rust\\_archive\\project-layout-cleanup-20260701-065400"),
  true);
  assert.equal(supersededLooseSourceFiles.includes(
    "D:\\TinyRustLM-vnext-20260812\\temporary-relocation\\extra-tinyrustlm_app_app.js"),
  true);
  assert.equal(evidenceOnlyRoots.some((profile) => profile.root ===
    "E:\\Source\\.tinyrustlm-evidence\\source-root-relocation-staging-20260830-v1" &&
    profile.allowedEntries.length === 4), true);

  if (process.platform === "win32" && literalPathExists(localWorkspaceRoot)) {
    const localDiscovery = discoverLocalSourceRoots();
    const ecosystemDiscovery = discoverEcosystemSourceRoots();
    const localBlockers = localDiscovery.roots.filter((root) =>
      root !== path.resolve(canonicalRoot));
    const canonicalEcosystemRoots = new Set(
      canonicalEcosystemDiscovery().roots.map((root) => root.toLowerCase()));
    const ecosystemBlockers = ecosystemDiscovery.roots.filter((root) =>
      !canonicalEcosystemRoots.has(root.toLowerCase()));
    const localIncomplete = [
      ...localDiscovery.nonCanonicalEntries,
      ...localDiscovery.unscannedSubtrees,
      ...localDiscovery.unreadable
    ];
    const ecosystemIncomplete = [
      ...ecosystemDiscovery.nonCanonicalEntries,
      ...ecosystemDiscovery.unscannedSubtrees,
      ...ecosystemDiscovery.unreadable
    ];
    if (localIncomplete.length !== 0) {
      assert.throws(() => verifyDiscovery(localDiscovery),
        (error) => error.code === "source_authority_scan_incomplete");
    } else if (localBlockers.length === 0) {
      verifyDiscovery(localDiscovery);
    } else {
      assert.throws(() => verifyDiscovery(localDiscovery),
        (error) => error.code === "source_authority_duplicate_root_present");
    }
    if (ecosystemIncomplete.length !== 0) {
      assert.throws(() => verifyEcosystemDiscovery(ecosystemDiscovery),
        (error) => error.code === "source_authority_scan_incomplete");
    } else if (ecosystemBlockers.length === 0) {
      verifyEcosystemDiscovery(ecosystemDiscovery);
    } else {
      assert.throws(() => verifyEcosystemDiscovery(ecosystemDiscovery),
        (error) =>
          error.code === "source_authority_ecosystem_duplicate_root_present");
    }
  }
});

test("direct-child probes detect a nested root without entering unrelated storage", () => {
  const scanRoot = path.resolve(repositoryRoot, "fake-workspace-probe-root");
  const directChild = path.join(scanRoot, "ordinary-project-location");
  const unreadableNested = path.join(directChild, ".private-test-storage");
  const directoryStat = Object.freeze({
    isDirectory: () => true,
    isFile: () => false,
    isSymbolicLink: () => false
  });
  const readDirectories = [];
  const fileSystem = {
    lstatSync(candidate) {
      if (candidate === scanRoot || candidate === directChild) {
        return directoryStat;
      }
      const error = new Error("unreadable fake path");
      error.code = "EACCES";
      error.path = candidate;
      throw error;
    },
    readdirSync(candidate) {
      readDirectories.push(candidate);
      if (candidate === scanRoot) {
        return [{
          isDirectory: () => true,
          isFile: () => false,
          isSymbolicLink: () => false,
          name: path.basename(directChild)
        }, {
          isDirectory: () => false,
          isFile: () => true,
          isSymbolicLink: () => false,
          name: " . unrelated-test-fixture"
        }];
      }
      const error = new Error("unreadable nested fake path");
      error.code = "EACCES";
      error.path = unreadableNested;
      throw error;
    }
  };
  const scopes = [{
    directChildProbeBoundary: true,
    maximumDepth: 0,
    root: scanRoot
  }];
  const sourceDiscovery = discoverMarkedSourceRoots(
    (candidate) => candidate === directChild,
    scopes,
    { fileSystem }
  );
  assert.deepEqual(sourceDiscovery.roots, [directChild]);
  assert.deepEqual(sourceDiscovery.nonCanonicalEntries, []);
  assert.deepEqual(sourceDiscovery.unscannedSubtrees, []);
  assert.deepEqual(sourceDiscovery.unreadable, []);
  assert.deepEqual(readDirectories, [scanRoot]);

  readDirectories.length = 0;
  const archiveDiscovery = discoverSourceArchives(scopes, { fileSystem });
  assert.deepEqual(archiveDiscovery.archives, []);
  assert.deepEqual(archiveDiscovery.nonCanonicalEntries, []);
  assert.deepEqual(archiveDiscovery.unscannedSubtrees, []);
  assert.deepEqual(archiveDiscovery.unreadable, []);
  assert.deepEqual(readDirectories, [scanRoot]);
});

test("source-root discovery never silently prunes dependency directories", () => {
  const scanRoot = path.resolve(repositoryRoot, "fake-neutral-scan-root");
  const prunedRoot = path.join(scanRoot, "node_modules");
  const packageRoot = path.join(prunedRoot, "neutral-package");
  const hiddenRoot = path.join(packageRoot, "source-copy");
  const directoryStat = Object.freeze({
    isDirectory: () => true,
    isSymbolicLink: () => false
  });
  const readDirectories = [];
  const fileSystem = {
    lstatSync(candidate) {
      if ([scanRoot, prunedRoot, packageRoot, hiddenRoot].includes(candidate)) {
        return directoryStat;
      }
      const error = new Error("missing fake path");
      error.code = "ENOENT";
      throw error;
    },
    readdirSync(candidate) {
      readDirectories.push(candidate);
      if (candidate === hiddenRoot) return [];
      const child = new Map([
        [scanRoot, prunedRoot],
        [prunedRoot, packageRoot],
        [packageRoot, hiddenRoot]
      ]).get(candidate);
      assert.ok(child, candidate);
      return [{
        isDirectory: () => true,
        isSymbolicLink: () => false,
        name: path.basename(child)
      }];
    }
  };

  const discovery = discoverMarkedSourceRoots(
    (candidate) => candidate === hiddenRoot,
    [{ root: scanRoot, maximumDepth: 3 }],
    { fileSystem });
  assert.deepEqual(discovery.roots, [hiddenRoot]);
  assert.deepEqual(discovery.nonCanonicalEntries, []);
  assert.deepEqual(discovery.unscannedSubtrees, []);
  assert.deepEqual(discovery.unreadable, []);
  assert.deepEqual(readDirectories,
    [scanRoot, prunedRoot, packageRoot, hiddenRoot]);
});

test("bounded source and archive scans reject every unscanned subtree", () => {
  const scanRoot = path.resolve(repositoryRoot, "fake-bounded-scan-root");
  const blockedRoot = path.join(scanRoot, "blocked");
  const { fileSystem } = fakeAuthorityFileSystem(scanRoot, [
    [scanRoot, [{ kind: "directory", name: "blocked" }]],
    [blockedRoot, []]
  ]);

  const sourceDiscovery = discoverMarkedSourceRoots(() => false,
    [{ root: scanRoot, maximumDepth: 0 }], { fileSystem });
  assert.deepEqual(sourceDiscovery.unscannedSubtrees, [blockedRoot]);
  assert.throws(() => verifyDiscovery(sourceDiscovery), (error) =>
    error.code === "source_authority_scan_incomplete" &&
    error.detail === `depth:${blockedRoot}`);

  const archiveDiscovery = discoverSourceArchives(
    [{ root: scanRoot, maximumDepth: 0 }], { fileSystem });
  assert.deepEqual(archiveDiscovery.unscannedSubtrees, [blockedRoot]);
  assert.throws(() => verifySourceArchiveDiscovery(archiveDiscovery), (error) =>
    error.code === "source_authority_scan_incomplete" &&
    error.detail === `depth:${blockedRoot}`);
});

test("detects ecosystem source archives without claiming unrelated archives", () => {
  const scanRoot = path.join(path.parse(repositoryRoot).root,
    "fake-unrelated-archive-root");
  const nestedRoot = path.join(scanRoot, "nested");
  const sourceZip = path.join(scanRoot, "GGUF.MiRust.com-20260625.ZIP");
  const sourceTar = path.join(nestedRoot,
    "tinyrustlm-clean-source-a9db946.TAR.GZ");
  const neutralZip = path.join(scanRoot, "Cogniverses-20260420.zip");
  const directoryStat = Object.freeze({
    isDirectory: () => true,
    isFile: () => false,
    isSymbolicLink: () => false
  });
  const fileStat = Object.freeze({
    isDirectory: () => false,
    isFile: () => true,
    isSymbolicLink: () => false
  });
  const openedFiles = [];
  const fileSystem = {
    lstatSync(candidate) {
      if (candidate === scanRoot || candidate === nestedRoot) {
        return directoryStat;
      }
      if ([sourceZip, sourceTar, neutralZip].includes(candidate)) {
        return fileStat;
      }
      const error = new Error("missing fake path");
      error.code = "ENOENT";
      error.path = candidate;
      throw error;
    },
    readFileSync(candidate) {
      openedFiles.push(candidate);
      throw new Error("archive content must not be opened");
    },
    readdirSync(candidate) {
      if (candidate === scanRoot) {
        return [
          {
            isDirectory: () => false,
            isFile: () => true,
            isSymbolicLink: () => false,
            name: path.basename(sourceZip)
          },
          {
            isDirectory: () => false,
            isFile: () => true,
            isSymbolicLink: () => false,
            name: path.basename(neutralZip)
          },
          {
            isDirectory: () => true,
            isFile: () => false,
            isSymbolicLink: () => false,
            name: path.basename(nestedRoot)
          }
        ];
      }
      assert.equal(candidate, nestedRoot);
      return [{
        isDirectory: () => false,
        isFile: () => true,
        isSymbolicLink: () => false,
        name: path.basename(sourceTar)
      }];
    }
  };

  assert.equal(isSourceArchiveName(path.basename(sourceZip)), true);
  assert.equal(isSourceArchiveName(path.basename(sourceTar)), true);
  assert.equal(isSourceArchiveName(path.basename(neutralZip)), true);
  assert.equal(isSourceArchiveName("TinyRustLM-source.txt"), false);
  assert.equal(isSourceArchiveName("nested/TinyRustLM-source.zip"), false);
  for (const suffix of sourceArchiveSuffixes) {
    assert.equal(isSourceArchiveName(`neutral${suffix.toUpperCase()}`), true,
      suffix);
  }

  const discovery = discoverSourceArchives(
    [{ root: scanRoot, maximumDepth: 2 }], { fileSystem });
  assert.deepEqual(discovery.archives, [sourceZip, sourceTar].sort(
    (left, right) => left.localeCompare(right)));
  assert.deepEqual(discovery.nonCanonicalEntries, []);
  assert.deepEqual(discovery.permittedBinaryReleaseArchives, []);
  assert.deepEqual(discovery.unscannedSubtrees, []);
  assert.deepEqual(discovery.unreadable, []);
  assert.deepEqual(openedFiles, []);
  assert.throws(() => verifySourceArchiveDiscovery(discovery),
    (error) => error.code === "source_authority_source_archive_present");
  verifySourceArchiveDiscovery({
    archives: [],
    nonCanonicalEntries: [],
    permittedBinaryReleaseArchives: [],
    unscannedSubtrees: [],
    unreadable: []
  });
});

test("admits only exact registered binary release evidence identities", () => {
  const profile = registeredBinaryReleaseArchiveProfiles[0];
  const extension = profile.rid === "win-x64" ? ".zip" : ".tar.gz";
  const stem = `UAIX.Browser.p2pRuntime.SeedHost.Tool.${profile.version}-${profile.rid}`;
  const archivePath = path.join(registeredBinaryReleaseEvidenceRoot, "fixture",
    `${stem}${extension}`);
  const nativeDigest = "1".repeat(64);
  const receipt = {
    generated_utc: "2026-07-14T04:35:35.3257270+00:00",
    mini_model_source: { dirty: true, revision: "2".repeat(40) },
    model_bytes_included: false,
    native_abi_version: 2,
    native_files: { minimodel: `sha256:${nativeDigest}` },
    package_id: "UAIX.Browser.p2pRuntime.SeedHost.Tool",
    project_server_proxies_model_bytes: false,
    project_server_runs_model_bytes: false,
    project_server_serves_model_bytes: false,
    rid: profile.rid,
    schema: "uaix.seed_host.release.v0",
    self_contained: true,
    tiny_rust_lm_source: { dirty: true, revision: "3".repeat(40) },
    version: profile.version
  };
  const files = [{
    checksums: [{ algorithm: "SHA256", checksumValue: nativeDigest }],
    fileName: `./runtimes/${profile.rid}/native/minimodel`
  }];
  while (files.length < profile.spdxFileCount) {
    files.push({
      checksums: [{ algorithm: "SHA256", checksumValue: "4".repeat(64) }],
      fileName: `./payload/library-${String(files.length).padStart(4, "0")}.dll`
    });
  }
  const spdx = {
    dataLicense: "CC0-1.0",
    files,
    name: `UAIX.Browser.p2pRuntime.SeedHost.Tool ${profile.version}`,
    packages: [],
    relationships: [],
    spdxVersion: "SPDX-2.2"
  };
  const classify = (archiveIdentity, releaseValue = receipt, spdxValue = spdx,
    hashSwap = false) => classifyRegisteredBinaryReleaseArchive(archivePath, {
    hashBytes(bytes) {
      const isSpdx = bytes.includes(Buffer.from('"spdxVersion"'));
      if (hashSwap) return isSpdx ? profile.releaseSha256 : profile.spdxSha256;
      return isSpdx ? profile.spdxSha256 : profile.releaseSha256;
    },
    inspectArchive() {
      return archiveIdentity;
    },
    readSidecar(candidate) {
      return Buffer.from(JSON.stringify(candidate.endsWith(".spdx.json")
        ? spdxValue : releaseValue));
    }
  });

  assert.equal(classify({
    byteLength: profile.archiveBytes,
    sha256: profile.archiveSha256
  }), true);
  assert.equal(classify({
    byteLength: profile.archiveBytes,
    sha256: profile.releaseSha256
  }), false, "digest substitution");
  assert.equal(classify({
    byteLength: profile.archiveBytes,
    sha256: "a".repeat(64)
  }), false, "hostile renamed archive");
  assert.equal(classify({
    byteLength: profile.archiveBytes,
    sha256: profile.archiveSha256
  }, { ...receipt, rid: "win-x64" }), false, "receipt mismatch");
  assert.equal(classify({
    byteLength: profile.archiveBytes,
    sha256: profile.archiveSha256
  }, receipt, {
    ...spdx,
    files: [{ ...files[0], fileName: "./src/main.rs" }, ...files.slice(1)]
  }), false, "source-bearing manifest");
  assert.equal(classify({
    byteLength: profile.archiveBytes,
    sha256: profile.archiveSha256
  }, receipt, spdx, true), false, "sidecar digest substitution");
});

test("detects NuGet suffixes and bounded renamed-container magic", () => {
  assert.equal(isSourceArchiveName("package.nupkg"), true);
  assert.equal(isSourceArchiveName("symbols.SNUPKG"), true);
  assert.equal(hasArchiveContainerMagic("fixture", {
    readPrefix: () => Buffer.from([0x50, 0x4b, 0x03, 0x04])
  }), true);
  assert.equal(hasArchiveContainerMagic("fixture", {
    readPrefix: () => Buffer.concat([Buffer.alloc(257), Buffer.from("ustar")])
  }), true);
  assert.equal(hasArchiveContainerMagic("fixture", {
    readPrefix: () => Buffer.from([0x4d, 0x5a, 0x90, 0x00])
  }), false);

  const scanRoot = path.join(registeredEvidenceRoot, "fake-magic-root");
  const binaryArchive = path.join(scanRoot, "seed-host.zip");
  const renamedArchive = path.join(scanRoot, "source-review-bundle.dat");
  const { fileSystem } = fakeAuthorityFileSystem(scanRoot, [[scanRoot, [
    { kind: "file", name: path.basename(binaryArchive) },
    { kind: "file", name: path.basename(renamedArchive) }
  ]]]);
  const discovery = discoverSourceArchives([
    { maximumDepth: 1, root: scanRoot }
  ], {
    classifyBinaryReleaseArchive: (candidate) => candidate === binaryArchive,
    fileSystem,
    hasArchiveContainerMagic: (candidate) => candidate === renamedArchive
  });
  assert.deepEqual(discovery.archives, [renamedArchive]);
  assert.deepEqual(discovery.permittedBinaryReleaseArchives, [binaryArchive]);

  const packagePath = path.join(registeredEvidenceArtifactsRoot,
    "browser-packages", "UAIX.Browser.Core.Abstractions.0.1.2.nupkg");
  if (literalPathExists(packagePath)) {
    assert.equal(classifyRegisteredBinaryNugetArchive(packagePath), true);
    const hostile = Buffer.from(fs.readFileSync(packagePath));
    let offset = hostile.indexOf(Buffer.from(".dll"));
    let replacements = 0;
    while (offset >= 0) {
      Buffer.from(".cpp").copy(hostile, offset);
      replacements += 1;
      offset = hostile.indexOf(Buffer.from(".dll"), offset + 4);
    }
    assert.ok(replacements >= 2);
    assert.equal(classifyRegisteredBinaryNugetArchive(packagePath, {
      readNugetArchive: () => hostile,
      verifyNugetDigest: () => true
    }), false, "source member hidden in a renamed binary package");
  }
});

test("fails closed when a governed source or archive path is unreadable", () => {
  const governedRoot = path.resolve(repositoryRoot, "fake-unreadable-root");
  const permissionDenied = new Error("fake governed-path permission failure");
  permissionDenied.code = "EACCES";
  permissionDenied.path = governedRoot;
  const fileSystem = {
    lstatSync() {
      throw permissionDenied;
    }
  };

  const sourceDiscovery = discoverMarkedSourceRoots(() => false,
    [{ root: governedRoot, maximumDepth: 1 }], { fileSystem });
  assert.deepEqual(sourceDiscovery.roots, []);
  assert.deepEqual(sourceDiscovery.unreadable, [governedRoot]);
  assert.throws(() => verifyDiscovery(sourceDiscovery),
    (error) => error.code === "source_authority_scan_incomplete");

  const archiveDiscovery = discoverSourceArchives(
    [{ root: governedRoot, maximumDepth: 1 }], { fileSystem });
  assert.deepEqual(archiveDiscovery.archives, []);
  assert.deepEqual(archiveDiscovery.unreadable, [governedRoot]);
  assert.throws(() => verifySourceArchiveDiscovery(archiveDiscovery),
    (error) => error.code === "source_authority_scan_incomplete");

  assert.throws(() => verifyForbiddenPathAbsence(
    [path.join(governedRoot, "forbidden-source")],
    "source_authority_superseded_root_present", { fileSystem }),
  (error) => error.code === "source_authority_scan_incomplete");

  const presentFileSystem = {
    lstatSync() {
      return {
        isDirectory: () => false,
        isFile: () => true,
        isSymbolicLink: () => false
      };
    }
  };
  assert.throws(() => verifyForbiddenPathAbsence(
    [path.join(governedRoot, "forbidden-source")],
    "source_authority_superseded_root_present",
    { fileSystem: presentFileSystem }),
  (error) => error.code === "source_authority_superseded_root_present");
});

test("fails closed for duplicate, unreadable, and marker-failure discoveries", () => {
  const neutralDuplicate = path.join(localWorkspaceRoot,
    "ordinary-project-location", "source-copy");
  assert.throws(() => verifyDiscovery({
    nonCanonicalEntries: [],
    roots: [canonicalRoot, neutralDuplicate],
    unscannedSubtrees: [],
    unreadable: []
  }), (error) => error.code === "source_authority_duplicate_root_present");
  assert.throws(() => verifyDiscovery({
    nonCanonicalEntries: [],
    roots: [canonicalRoot],
    unscannedSubtrees: [],
    unreadable: ["E:\\Source\\unreadable-authority-location"]
  }), (error) => error.code === "source_authority_scan_incomplete");

  assert.throws(() => verifyEcosystemDiscovery({
    nonCanonicalEntries: [],
    roots: [...canonicalEcosystemDiscovery().roots, neutralDuplicate],
    unscannedSubtrees: [],
    unreadable: []
  }), (error) =>
    error.code === "source_authority_ecosystem_duplicate_root_present");

  assert.throws(() => readBoundedText(
    path.join(repositoryRoot, "workspace.uai"), 1),
  (error) => error.code === "source_authority_marker_invalid");

  const permissionFailure = discoverMarkedSourceRoots(() => {
    const error = new Error("fake marker permission failure");
    error.code = "EACCES";
    throw error;
  }, [{ root: repositoryRoot, maximumDepth: 0 }]);
  assert.deepEqual(permissionFailure.roots, []);
  assert.deepEqual(permissionFailure.unreadable, [repositoryRoot]);
  assert.throws(() => verifyDiscovery(permissionFailure),
    (error) => error.code === "source_authority_scan_incomplete");
});

test("canonical layout is fail-closed by default and opt-out is not a pass", () => {
  assert.deepEqual(cliVerificationOptions([]), {
    requireCanonicalLayout: true,
    requireClean: false,
    requireRemoteExact: false
  });
  assert.deepEqual(cliVerificationOptions([
    "--require-clean", "--require-remote-exact"
  ]), {
    requireCanonicalLayout: true,
    requireClean: true,
    requireRemoteExact: true
  });
  for (const options of [
    {},
    { requireCanonicalLayout: true }
  ]) {
    assert.throws(() => verifySingleSourceAuthority({
      ...options,
      platform: "not-win32",
      repositoryRoot
    }), (error) =>
      error.code === "source_authority_canonical_layout_unavailable");
  }

  const localResult = verifySingleSourceAuthority({
    platform: "not-win32",
    repositoryRoot,
    requireCanonicalLayout: false
  });
  assert.equal(localResult.canonicalLayoutAvailable, false);
  assert.equal(localResult.coverageClass, "registered-governed-roots-only");
  assert.equal(localResult.localScanPerformed, false);
  assert.equal(localResult.wholeVolumeInventoryPerformed, false);
  assert.equal(localResult.verdict, "not-performed");
});

test("rejects injected discoveries outside the canonical root", () => {
  if (process.platform !== "win32" || !literalPathExists(localWorkspaceRoot)) {
    return;
  }
  const neutralDuplicate = path.join(localWorkspaceRoot,
    "ordinary-project-location", "source-copy");
  let ecosystemDiscoveryCalls = 0;
  assert.throws(() => verifySingleSourceAuthority({
    discoverCanonicalEcosystemRootEntries() {
      return canonicalRootEntryDiscovery();
    },
    discoverEcosystemSourceRoots() {
      ecosystemDiscoveryCalls += 1;
      return canonicalEcosystemDiscovery();
    },
    discoverLocalSourceRoots() {
      return {
        nonCanonicalEntries: [],
        roots: [canonicalRoot, neutralDuplicate],
        unscannedSubtrees: [],
        unreadable: []
      };
    },
    repositoryRoot
  }), (error) => error.code === "source_authority_duplicate_root_present");
  assert.equal(ecosystemDiscoveryCalls, 1);
});

function fakeGitOutput(calls, overrides = {}) {
  const head = "a".repeat(40);
  const expectedUpstream = `refs/remotes/origin/${requiredBranch}`;
  const expectedRemoteReference = `refs/heads/${requiredBranch}`;
  return function readGit(_root, arguments_) {
    calls.push(arguments_);
    const key = arguments_.join(" ");
    if (Object.hasOwn(overrides, key)) return overrides[key];
    if (key === "rev-parse --show-toplevel") return canonicalRoot;
    if (key === "rev-parse --absolute-git-dir") {
      return path.join(canonicalRoot, ".git");
    }
    if (key === "branch --show-current") return requiredBranch;
    if (key === "remote get-url --all origin" ||
        key === "remote get-url --push --all origin") {
      return requiredOrigin;
    }
    if (key === "status --porcelain=v1 --untracked-files=all") return "";
    if (key === "ls-remote --exit-code --refs origin " +
        expectedRemoteReference) {
      return `${head}\t${expectedRemoteReference}`;
    }
    if (key === "rev-parse --symbolic-full-name @{upstream}") {
      return expectedUpstream;
    }
    if (arguments_[0] === "rev-parse") return head;
    throw new Error(`Unexpected Git arguments: ${key}`);
  };
}

// Supplies exact local Git identities for every canonical ecosystem repository.
function fakeEcosystemGitOutput(calls) {
  const profiles = new Map(ecosystemRepositories.map((profile) =>
    [path.resolve(profile.root).toLowerCase(), profile]));
  return function readGit(root, arguments_) {
    const profile = profiles.get(path.resolve(root).toLowerCase());
    const key = arguments_.join(" ");
    calls.push({ key, root });
    if (!profile) throw new Error(`Unexpected ecosystem root: ${root}`);
    if (key === "rev-parse --show-toplevel") return profile.root;
    if (key === "rev-parse --absolute-git-dir") {
      return path.join(profile.root, ".git");
    }
    if (key === "branch --show-current") return profile.branch;
    if (key === "remote get-url --all origin" ||
        key === "remote get-url --push --all origin") {
      return profile.origin;
    }
    throw new Error(`Unexpected ecosystem Git arguments: ${key}`);
  };
}

test("single-source verification uses injected authority discovery once", () => {
  if (process.platform !== "win32" || !literalPathExists(localWorkspaceRoot)) {
    return;
  }
  const gitCalls = [];
  const unreadablePath = path.join(canonicalEcosystemRoot,
    "fake-injected-unreadable");
  let discoveryCalls = 0;
  assert.throws(() => verifySingleSourceAuthority({
    discoverCanonicalEcosystemRootEntries() {
      return canonicalRootEntryDiscovery();
    },
    discoverEcosystemAuthorityFiles() {
      discoveryCalls += 1;
      return canonicalAuthorityFileDiscovery({ unreadable: [unreadablePath] });
    },
    gitOutput: fakeEcosystemGitOutput(gitCalls),
    repositoryRoot
  }), (error) => error.code === "source_authority_scan_incomplete" &&
    error.detail === `unreadable:${unreadablePath}`);
  assert.equal(discoveryCalls, 1);
  assert.equal(gitCalls.length, ecosystemRepositories.length * 5);

  assert.throws(() => verifySingleSourceAuthority({
    discoverCanonicalEcosystemRootEntries() {
      return canonicalRootEntryDiscovery();
    },
    discoverEcosystemAuthorityFiles: true,
    gitOutput: fakeEcosystemGitOutput([]),
    repositoryRoot
  }), (error) => error.code === "source_authority_discovery_invalid");
});

test("ordinary Git identity is exact but does not require clean or network", () => {
  const calls = [];
  verifyGitIdentity(canonicalRoot, { gitOutput: fakeGitOutput(calls) });

  assert.equal(calls.some((arguments_) => arguments_[0] === "ls-remote"), false);
  assert.equal(calls.some((arguments_) => arguments_[0] === "status"), false);
  assert.equal(calls.some((arguments_) =>
    arguments_.join(" ") === "rev-parse --show-toplevel"), true);
  assert.equal(calls.some((arguments_) =>
    arguments_.join(" ") === "rev-parse --absolute-git-dir"), true);
  assert.equal(calls.some((arguments_) =>
    arguments_.join(" ") === "remote get-url --all origin"), true);
  assert.equal(calls.some((arguments_) =>
    arguments_.join(" ") === "remote get-url --push --all origin"), true);
});

test("rejects noncanonical Git binding and every alternate origin URL", () => {
  assert.throws(() => verifyGitIdentity(canonicalRoot, {
    gitOutput: fakeGitOutput([], {
      "rev-parse --show-toplevel": path.join(canonicalRoot, "tinyrustlm")
    })
  }), (error) => error.code === "source_authority_git_repository_invalid");

  for (const command of [
    "remote get-url --all origin",
    "remote get-url --push --all origin"
  ]) {
    assert.throws(() => verifyGitIdentity(canonicalRoot, {
      gitOutput: fakeGitOutput([], {
        [command]: `${requiredOrigin}\nhttps://example.invalid/alternate.git`
      })
    }), (error) => error.code === "source_authority_origin_invalid", command);
  }
});

test("remote-exact verification queries and binds the direct remote branch", () => {
  const calls = [];
  const expectedRemoteReference = `refs/heads/${requiredBranch}`;

  verifyGitIdentity(canonicalRoot, {
    gitOutput: fakeGitOutput(calls),
    requireClean: true,
    requireRemoteExact: true
  });

  assert.equal(calls.some((arguments_) =>
    arguments_[0] === "ls-remote" &&
    arguments_.includes(expectedRemoteReference)), true);
  assert.equal(calls.some((arguments_) =>
    arguments_[0] === "rev-parse" &&
    arguments_.includes("--symbolic-full-name")), true);
  assert.equal(calls.some((arguments_) => arguments_[0] === "status"), true);
});

test("forbids duplicate source authority and wholesale stale-tree merges", () => {
  const taboo = directText(".uai/taboo.uai");

  assert.equal(occurrences(taboo, "single_tinyrustlm_source_prohibitions:"), 1);
  assert.match(taboo,
    /Do not create, adopt, maintain, edit, build, test, release, deploy, or describe more than one authoritative TinyRustLM\.com source checkout\./u);
  assert.match(taboo,
    /The sole local TinyRustLM\.com source root is E:\\Source\\Rust\\TinyRustLM\.com/u);
  assert.match(taboo,
    /resolve the canonical root from its current workspace\.uai and verify the canonical path, branch, origin URL, local HEAD, tracking ref, FETCH_HEAD, direct remote ref, and worktree status/u);
  assert.match(taboo,
    /Fail closed before editing, building, testing, committing, releasing, or deploying when canonical authority cannot be proved or any second writable TinyRustLM\.com checkout is discovered/u);
  assert.match(taboo,
    /automated gates must reject pointers to duplicate, retired, quarantined, protected, or otherwise non-authoritative source/u);
  assert.match(taboo,
    /Source-producing recovery, build, test, packaging, demo, and deployment tooling must resolve one of the seven canonical repository roots/u);
  assert.match(taboo,
    /Owned temporary roots may contain only bounded non-source outputs, must carry an operation-specific ownership marker, and must be physically removed when their operation closes/u);
  assert.match(taboo,
    /Do not create temporary ecosystem source clones or worktrees outside the seven canonical roots/u);
  assert.match(taboo,
    /Isolated verification may synthesize only minimal non-product fixtures/u);
  assert.match(taboo,
    /move only valid current clean-slate work into the canonical tree/u);
  assert.match(taboo,
    /Do not pull both trees forward, merge stale branches wholesale, preserve a second checkout as history/u);
  assert.match(taboo,
    /Historical source belongs only in Git history/u);
  assert.equal(occurrences(taboo, "ecosystem_source_root_prohibitions:"), 1);
  assert.equal(occurrences(taboo, boundedAuthorityScopePolicy), 1);
  assert.match(taboo,
    /every TinyRustLM-ecosystem archive candidate except bounded content-inspected, checksum-bound immutable binary-release evidence/u);
  assert.match(taboo, /Never infer binary evidence from a filename or extension/u);
  assert.doesNotMatch(taboo, /anywhere else on E: or D:/u);
  assert.match(taboo,
    /run E:\\Source\\Rust\\TinyRustLM\.com\\tinyrustlm\\tools\\verify-single-source-authority\.js/u);
  assert.deepEqual(canonicalEcosystemTabooPaths,
    ecosystemRepositories.map((profile) =>
      path.join(profile.root, ".uai", "taboo.uai")));
  for (const profile of ecosystemRepositories) {
    const ecosystemTaboo = directAbsoluteText(
      path.join(profile.root, ".uai", "taboo.uai"));
    assert.equal(occurrences(ecosystemTaboo,
      "ecosystem_source_root_prohibitions:"), 1, profile.id);
    assert.equal(extractEcosystemSourceRootPolicyBlock(ecosystemTaboo),
      canonicalEcosystemSourceRootPolicyBlock, profile.id);
    const singleSourceBlock = extractSingleTinyRustLmSourcePolicyBlock(
      ecosystemTaboo);
    assert.equal(Buffer.byteLength(singleSourceBlock, "utf8"),
      canonicalSingleTinyRustLmSourcePolicyBytes, profile.id);
    assert.equal(crypto.createHash("sha256").update(singleSourceBlock).digest("hex"),
      canonicalSingleTinyRustLmSourcePolicySha256, profile.id);
  }
  assert.doesNotThrow(() => verifyEcosystemSourceRootPolicyParity());
  assert.match(directText("tinyrustlm/tools/deploy-tinyrustlm-web.ps1"),
    /verify-single-source-authority\.js/u);
  assert.match(directText("tinyrustlm/tools/deploy-tinyrustlm-web.ps1"),
    /"--require-clean",\s*"--require-remote-exact"/u);
});

test("ecosystem policy parity rejects one stale or overclaiming repository", () => {
  const sources = new Map(canonicalEcosystemTabooPaths.map((policyPath) =>
    [policyPath, directAbsoluteText(policyPath)]));
  const stalePath = canonicalEcosystemTabooPaths[0];
  const stalePolicy = sources.get(stalePath);
  assert.equal(occurrences(stalePolicy, boundedAuthorityScopePolicy), 1);
  sources.set(stalePath, stalePolicy.replace(
    boundedAuthorityScopePolicy,
    "The enforceable discovery boundary is every file on E: and D:. " +
    "A passing gate proves both entire volumes."));

  assert.throws(() => verifyEcosystemSourceRootPolicyParity({
    readText(candidate) {
      return sources.get(candidate);
    }
  }), (error) => error.code === "source_authority_ecosystem_policy_invalid" &&
    error.detail === `${stalePath}:block_mismatch`);
});

test("ecosystem policy parity rejects a stale single-source release rule", () => {
  const sources = new Map(canonicalEcosystemTabooPaths.map((policyPath) =>
    [policyPath, directAbsoluteText(policyPath)]));
  const stalePath = canonicalEcosystemTabooPaths[0];
  const releaseRule = "Any committed change to a declared public artifact " +
    "invalidates deployed-current status";
  const stalePolicy = sources.get(stalePath);
  assert.equal(occurrences(stalePolicy, releaseRule), 2);
  const singleBlock = extractSingleTinyRustLmSourcePolicyBlock(stalePolicy);
  sources.set(stalePath, stalePolicy.replace(singleBlock,
    singleBlock.replace(releaseRule,
      "A committed public artifact may retain deployed-current status")));

  assert.throws(() => verifyEcosystemSourceRootPolicyParity({
    readText(candidate) {
      return sources.get(candidate);
    }
  }), (error) => error.code === "source_authority_ecosystem_policy_invalid" &&
    error.detail ===
      `${stalePath}:single_tinyrustlm_source_block_mismatch`);
});

test("reconciles the sole-source receipt with the physical retired inventory", () => {
  const receipt = directText(
    ".uai/source-authority-relocation-2026-08-30.uai");

  assert.match(receipt,
    /profile: tinyrustlm\.source_authority_relocation\.v1/u);
  assert.match(receipt,
    /root: E:\\Source\\Rust\\TinyRustLM\.com/u);
  assert.match(receipt, /unique_commits: 0/u);
  assert.match(receipt, /unique_source_work_moved_from_duplicates: 0/u);
  assert.match(receipt, /legacy_or_compatibility_code_retained: false/u);
  assert.match(receipt,
    /canonical_root_moved_to_required_location: true/u);
  assert.match(receipt,
    /private_evidence_separated_from_source_authority: true/u);
  assert.match(receipt,
    /physical_active_tinyrustlm_source_duplicates_remaining: 0/u);
  assert.match(receipt,
    /physical_ecosystem_source_copy_roots_remaining: 0/u);
  assert.match(receipt, /elevated_deletion_required: \[\]/u);
  assert.match(receipt, /source_registry_status: sole/u);
  assert.match(receipt, /physical_retirement:/u);
  assert.match(receipt, /removed_target_count: 10/u);
  assert.match(receipt, /all_allowlisted_paths_absent: true/u);
  assert.match(receipt, /post_execution_source_authority_verdict: pass/u);
  assert.match(receipt, /one_time_script_retained: false/u);
  assert.doesNotMatch(receipt, /canonical-established-local-purge-blocked/u);

  const activeDuplicates = supersededSourceRoots.filter(literalPathExists);
  const ecosystemDuplicates = supersededEcosystemSourceRoots
    .filter(literalPathExists);
  const looseSourceFiles = supersededLooseSourceFiles.filter(literalPathExists);
  const sourceArchives = supersededSourceArchives.filter(literalPathExists);
  assert.deepEqual(activeDuplicates, []);
  assert.deepEqual(ecosystemDuplicates, []);
  assert.deepEqual(looseSourceFiles, []);
  assert.deepEqual(sourceArchives, []);
  assert.equal(Number(receipt.match(
    /physical_active_tinyrustlm_source_duplicates_remaining: ([0-9]+)/u)[1]),
  activeDuplicates.length);
  assert.equal(Number(receipt.match(
    /physical_ecosystem_source_copy_roots_remaining: ([0-9]+)/u)[1]),
  ecosystemDuplicates.length);

  for (const formerBlocker of [
    "E:\\Source\\.codex-tmp\\stale-site-roots-after-metadata-loss-20260829-v1",
    "E:\\Source\\Rust\\_archive\\project-layout-cleanup-20260701-065400"
  ]) {
    assert.equal(literalPathExists(formerBlocker), false, formerBlocker);
    assert.equal(receipt.includes(formerBlocker), false, formerBlocker);
  }
  assert.match(receipt,
    /Historical executable source belongs only in Git history\./u);
});
