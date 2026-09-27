"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { TextDecoder } = require("node:util");

const repositoryRoot = path.resolve(__dirname, "../..");
const canonicalRoot = "E:\\Source\\Rust\\TinyRustLM.com";
const canonicalEcosystemRoot = "E:\\Source\\Rust";
const canonicalEcosystemWorkspacePath = path.join(
  canonicalEcosystemRoot, "workspace.uai");
const canonicalEcosystemWorkspaceTemplatePath = path.join(
  repositoryRoot, "tinyrustlm", "authority", "ecosystem-workspace.uai");
const canonicalEcosystemWorkspacePolicyBytes = 5172;
const canonicalEcosystemWorkspacePolicySha256 =
  "64ad6e1472630a3f92665a13ca2843624f11997e811c1ab55dc2800aa474b492";
const localWorkspaceRoot = "E:\\Source";
const requiredBranch = "codex/model-acquisition-v2";
const requiredOrigin = "https://github.com/MichaelKappel/TinyRustLM.com.git";
const ecosystemRepositories = Object.freeze([
  Object.freeze({
    id: "lmcomposer.com",
    root: "E:\\Source\\Rust\\LMComposer.com",
    branch: "main",
    origin: "https://github.com/MichaelKappel/LMComposer.com.git",
    workspaceProfile: "profile: lmcomposer.workspace.current.v1"
  }),
  Object.freeze({
    id: "minimodel.mirust.com",
    root: "E:\\Source\\Rust\\MiniModel.MiRust.com",
    branch: "master",
    origin: "https://github.com/MichaelKappel/MiniModel.MiRust.com.git",
    workspaceProfile: "profile: minimodel-mirust.workspace.current.v1"
  }),
  Object.freeze({
    id: "minimodel.org",
    root: "E:\\Source\\Rust\\MiniModel.org",
    branch: "master",
    origin: "https://github.com/MichaelKappel/MiniModel.org.git",
    workspaceProfile: "profile: minimodel.workspace.current.v1"
  }),
  Object.freeze({
    id: "mirust.com",
    root: "E:\\Source\\Rust\\MiRust.com",
    branch: "master",
    origin: "https://github.com/MichaelKappel/MiRust.com.git",
    workspaceProfile: "profile: mirust.workspace.current.v1"
  }),
  Object.freeze({
    id: "runtime.mirust.com",
    root: "E:\\Source\\Rust\\Runtime.MiRust.com",
    branch: "master",
    origin: "https://github.com/MichaelKappel/Runtime.MiRust.com.git",
    workspaceProfile: "profile: runtime-mirust.workspace.current.v1"
  }),
  Object.freeze({
    id: "tinyrustlm.com",
    root: canonicalRoot,
    branch: requiredBranch,
    origin: requiredOrigin,
    workspaceProfile: "profile: tinyrustlm.workspace.current.v1"
  }),
  Object.freeze({
    id: "tinyrustlm.mirust.com",
    root: "E:\\Source\\Rust\\TinyRustLM.MiRust.com",
    branch: "master",
    origin: "https://github.com/MichaelKappel/TinyRustLM.MiRust.com.git",
    workspaceProfile: "profile: tinyrustlm-mirust.workspace.current.v1"
  })
]);
const canonicalEcosystemTabooPaths = Object.freeze(
  ecosystemRepositories.map((profile) =>
    path.join(profile.root, ".uai", "taboo.uai")));
const canonicalSingleTinyRustLmSourcePolicyBytes = 2872;
const canonicalSingleTinyRustLmSourcePolicySha256 =
  "b8a94b28d6630fa51ffd0b7f059ae50b0c88b145d7a4f6b02f69052cf9c7e7ea";
const canonicalEcosystemSourceRootPolicyBlock = Object.freeze([
  "ecosystem_source_root_prohibitions:",
  "  - The only local editable source roots for this ecosystem are the seven direct repositories E:\\Source\\Rust\\LMComposer.com, E:\\Source\\Rust\\MiniModel.MiRust.com, E:\\Source\\Rust\\MiniModel.org, E:\\Source\\Rust\\MiRust.com, E:\\Source\\Rust\\Runtime.MiRust.com, E:\\Source\\Rust\\TinyRustLM.com, and E:\\Source\\Rust\\TinyRustLM.MiRust.com.",
  "  - Do not retain another ecosystem source checkout, copied source tree, Git metadata clone, archive, recovery root, worktree, quarantine, proof clone, or loose source/config copy inside any registered governed root. A second copy found there, or at any other known source-bearing location, is a blocking defect even when labeled temporary, retired, stale, protected, evidence, or backup.",
  "  - Source-producing recovery, build, test, packaging, demo, and deployment tooling must resolve one of the seven canonical repository roots before reading editable source and must fail closed before writing source, Git metadata, workspace authority, or editable configuration anywhere else. Owned temporary roots may contain only bounded non-source outputs, must carry an operation-specific ownership marker, and must be physically removed when their operation closes.",
  "  - The enforceable discovery boundary is the seven canonical repositories; the recursively registered E:\\Source\\Rust, E:\\Source\\Worktrees, E:\\Source\\.codex-tmp, E:\\Source\\.codex-temp, E:\\Source\\.tinyrustlm-evidence, and E:\\Source\\External scopes; every ecosystem-shaped direct E:\\Source child; a direct-root plus one-child marker probe for every other neutral direct E:\\Source child; and D:\\tw, D:\\Archive\\Source, and D:\\TinyRustLM-vnext-20260812 at their declared bounded depths. A passing gate proves only those boundaries; it is not a whole-volume inventory of E: or D: and does not recursively inspect unrelated sibling repositories. Register and completely scan any newly known or suspected source-bearing location, or physically retire it, before claiming sole-source authority.",
  "  - Deployment bundles and immutable private evidence may retain only bounded non-authoritative artifacts. They must not contain Git metadata, an authoritative workspace.uai plus .uai/taboo.uai pair, editable product source, or build, test, commit, release, or deployment entrypoints.",
  "  - Before any ecosystem edit, build, or test, run E:\\Source\\Rust\\TinyRustLM.com\\tinyrustlm\\tools\\verify-single-source-authority.js from the canonical TinyRustLM.com root. Require Windows, the exact direct non-reparse E:\\Source\\Rust layout, exact Git top-levels, branches, and sole fetch/push origins, every registered superseded path absent, every source-marker read successful inside a governed scan or neutral direct-child probe, every recursively registered scan complete and readable, and exactly the seven declared roots. Unsupported layout, unreadable governed metadata, damaged Git markers, or incomplete governed enumeration is failure, never an implicit pass.",
  "  - The only permitted ecosystem source-authority marker files are the root workspace.uai and root .uai/taboo.uai of the seven declared canonical repositories. The source-authority gate must recursively scan every registered E:\\Source scope, including non-repository children of E:\\Source\\Rust, directly probe neutral sibling roots without entering unrelated nested test or repository storage, and scan D:\\tw to depth 3, D:\\Archive\\Source to depth 3, D:\\TinyRustLM-vnext-20260812 to depth 32, and E:\\Source\\External\\TinyRustLM-release-evidence to depth 5; reject every other source root found at those boundaries, loose Git/source/config file in a recursively governed scope, nested or packaged workspace.uai or .uai/taboo.uai, plaintext all-source or source-review bundle, and every TinyRustLM-ecosystem archive candidate except bounded content-inspected, checksum-bound immutable binary-release evidence admitted by this exact policy beneath the registered evidence artifacts/releases or artifacts/browser-packages subtree. Never infer binary evidence from a filename or extension: require bounded archive-byte identity or checksum binding, exact release/SPDX sidecar identities where declared, source-free manifest/member semantics, and treat every unregistered, mismatched, source-bearing, unreadable, noncanonical, depth-limited, or otherwise unscanned governed candidate as blocking or source_authority_scan_incomplete.",
  "  - Before release or deployment, commit and push each coherent repository change from its canonical root, then rerun the verifier with --require-clean --require-remote-exact and require local HEAD, upstream, direct remote branch, tree status, and declared origin to agree. Do not use FETCH_HEAD as authority because it may describe an unrelated fetch.",
  "  - Every forbidden root, loose file, nested or packaged marker, plaintext all-source or source-review bundle, and unregistered or source-bearing archive remains a blocking defect until authorized physical deletion and a fresh complete scan prove absence. Renaming, moving, hiding, quarantining, ACL-protecting, repackaging, or retaining source bytes as evidence does not retire it; bounded evidence may retain identities, inventories, deletion receipts, and exact registered non-source binary/model/build artifacts outside E:\\Source\\Rust without becoming source authority.",
  "  - Do not create temporary ecosystem source clones or worktrees outside the seven canonical roots. Isolated verification may synthesize only minimal non-product fixtures; each fixture must be operation-owned, bounded, unable to release or deploy, contain no unique product work, and be physically removed when the operation closes. Any surviving source clone, source-bearing fixture, or worktree fails the next source-authority gate.",
  "  - Any committed change to a declared public artifact invalidates deployed-current status until a strictly newer release is published from one clean canonical commit, every declared readable file passes byte-for-byte HTTPS readback, every retired route is absent, and the public release records agree. Never mask drift with stale metadata, a partial upload, an overwrite under an old version, or source-only success."
].join("\n") + "\n");
const canonicalEcosystemRepositoryNames = Object.freeze(
  ecosystemRepositories.map((profile) => path.basename(profile.root)));
const canonicalEcosystemPlainFileNames = Object.freeze([
  "Source.code-workspace",
  "ftp.txt",
  "workspace.uai"
]);
const canonicalEcosystemPlainDirectoryNames = Object.freeze([
  ".local-secrets",
  ".vs",
  ".vscode",
  "_screenshots"
]);
const canonicalEcosystemExemptStorageDirectoryNames = Object.freeze([
  ".local-secrets",
  "_screenshots"
]);
const canonicalEcosystemExemptStorageRoots = Object.freeze(
  canonicalEcosystemExemptStorageDirectoryNames.map((name) =>
    path.join(canonicalEcosystemRoot, name)));
const canonicalEcosystemLegacyArchiveName = "_archive";
const ecosystemAuthorityMaximumDepth = 32;
const allSourceReviewBundleName =
  "gguf-mirust-all-source-review-bundle.txt";
const ecosystemAuthorityMarkerNames = Object.freeze([
  "taboo.uai",
  "workspace.uai"
]);
const canonicalEcosystemAuthorityMarkers = Object.freeze([
  path.join(canonicalEcosystemRoot, "workspace.uai"),
  ...ecosystemRepositories.flatMap((profile) => [
    path.join(profile.root, "workspace.uai"),
    path.join(profile.root, ".uai", "taboo.uai")
  ])
]);
const governedExternalSourceScopes = Object.freeze([
  Object.freeze({ root: "D:\\tw", maximumDepth: 3 }),
  Object.freeze({ root: "D:\\Archive\\Source", maximumDepth: 3 }),
  Object.freeze({
    root: "D:\\TinyRustLM-vnext-20260812",
    maximumDepth: ecosystemAuthorityMaximumDepth
  }),
  Object.freeze({
    root: "E:\\Source\\External\\TinyRustLM-release-evidence",
    maximumDepth: 5
  })
]);
const sourceScanScopes = Object.freeze([
  Object.freeze({
    directChildProbeBoundary: true,
    root: localWorkspaceRoot,
    maximumDepth: 0
  }),
  Object.freeze({
    root: path.join(localWorkspaceRoot, "Rust"),
    maximumDepth: ecosystemAuthorityMaximumDepth
  }),
  Object.freeze({
    root: path.join(localWorkspaceRoot, "Worktrees"),
    maximumDepth: ecosystemAuthorityMaximumDepth
  }),
  Object.freeze({
    root: path.join(localWorkspaceRoot, ".codex-tmp"),
    maximumDepth: ecosystemAuthorityMaximumDepth
  }),
  Object.freeze({
    root: path.join(localWorkspaceRoot, ".codex-temp"),
    maximumDepth: ecosystemAuthorityMaximumDepth
  }),
  Object.freeze({
    root: path.join(localWorkspaceRoot, ".tinyrustlm-evidence"),
    maximumDepth: ecosystemAuthorityMaximumDepth
  }),
  Object.freeze({
    root: path.join(localWorkspaceRoot, "External"),
    maximumDepth: ecosystemAuthorityMaximumDepth
  }),
  ...governedExternalSourceScopes.slice(0, 3)
]);
const sourceArchiveScanScopes = sourceScanScopes;
const sourceArchiveSuffixes = Object.freeze([
  ".tar.bz2",
  ".tar.gz",
  ".tar.xz",
  ".tar.zst",
  ".7z",
  ".bundle",
  ".cab",
  ".gitbundle",
  ".nupkg",
  ".rar",
  ".snupkg",
  ".tar",
  ".tbz2",
  ".tgz",
  ".txz",
  ".tzst",
  ".zip"
]);
const sourceAuthorityControlLeafNames = Object.freeze([
  ".git",
  ".gitattributes",
  ".gitconfig",
  ".gitignore",
  ".gitmodules",
  "cargo.lock",
  "cargo.toml",
  "config",
  "dockerfile",
  "makefile",
  "package-lock.json",
  "package.json",
  "pnpm-lock.yaml",
  "yarn.lock"
]);
const sourceAuthorityEntrypointSuffixes = Object.freeze([
  ".bat",
  ".c",
  ".cc",
  ".cjs",
  ".cmd",
  ".com",
  ".cpp",
  ".cs",
  ".css",
  ".exe",
  ".go",
  ".h",
  ".hpp",
  ".html",
  ".java",
  ".js",
  ".jsx",
  ".mjs",
  ".php",
  ".ps1",
  ".py",
  ".rb",
  ".rs",
  ".sh",
  ".ts",
  ".tsx",
  ".vue"
]);
const sourceAuthorityConfigSuffixes = Object.freeze([
  ".csproj",
  ".fsproj",
  ".props",
  ".sln",
  ".targets",
  ".toml",
  ".vcxproj",
  ".yaml",
  ".yml"
]);
const tinyRustLmGitEntrypointRelativePaths = Object.freeze([
  "tinyrustlm/app/app.js",
  "tinyrustlm/app/index.html",
  "tinyrustlm/package.json",
  "tinyrustlm/tools/build-custody-owner.js",
  "tinyrustlm/tools/deploy-tinyrustlm-web.ps1",
  "tinyrustlm/tools/verify-single-source-authority.js",
  "tinyrustlm/tools/windows-x64-msvc-environment.js"
]);
const tinyRustLmGitEntrypointIdentities = new Set(
  tinyRustLmGitEntrypointRelativePaths.map((candidate) =>
    candidate.toLowerCase()));
const sourceAuthorityPathSegmentNames = Object.freeze([
  ".config",
  ".git",
  ".uai",
  "_archive",
  "archive",
  "archives",
  "bin",
  "config",
  "entrypoint",
  "entrypoints",
  "git",
  "review",
  "reviews",
  "scripts",
  "source",
  "src",
  "tools"
]);
const ecosystemWorkspaceIdentityPattern =
  /^profile: (?:gguf-mirust|lmcomposer|minimodel|minimodel-mirust|mirust|runtime-mirust|tinyrustlm|tinyrustlm-mirust)\.[a-z0-9.-]+$/imu;
const ecosystemIdentityNamePattern =
  /(?:tinyrustlm|minimodel|mirust|lmcomposer|gguf)/u;
const evidenceOnlyRoots = Object.freeze([
  Object.freeze({
    allowedEntries: Object.freeze([
      "artifacts",
      "raw",
      "undefined.validate-manifest.log",
      "undefined.validate-model.log"
    ]),
    requiredDirectories: Object.freeze(["artifacts", "raw"]),
    root: "E:\\Source\\.tinyrustlm-evidence\\source-root-relocation-staging-20260830-v1"
  })
]);
// Exact private evidence roots and inventories are caller-owned external data.
// These power-of-two ceilings are only the public admission boundary.
const evidenceContainerHardLimits = Object.freeze({
  maximumContainers: 16,
  maximumDepth: 8,
  maximumDirectChildren: 64,
  maximumDirectories: 256,
  maximumFileBytes: 4 * 1024 * 1024,
  maximumFiles: 1024,
  maximumTotalBytes: 32 * 1024 * 1024
});
const registeredEvidenceRoot = evidenceOnlyRoots[0].root;
const canonicalArtifactsRoot = path.join(canonicalRoot, "artifacts");
const registeredEvidenceArtifactsRoot = path.join(
  registeredEvidenceRoot, "artifacts");
const registeredBinaryReleaseEvidenceRoot = path.join(
  registeredEvidenceArtifactsRoot, "releases");
const externalBinaryReleaseEvidenceRoot =
  "E:\\Source\\External\\TinyRustLM\\releases\\seed-host-0.2.0";
const registeredBinaryReleaseEvidenceRoots = Object.freeze([
  registeredBinaryReleaseEvidenceRoot,
  externalBinaryReleaseEvidenceRoot
]);
const registeredBinaryNugetEvidenceRoot = path.join(
  registeredEvidenceArtifactsRoot, "browser-packages");
const registeredNonSourceStorageReparseProfiles = Object.freeze([
  Object.freeze({
    root: "E:\\Source\\External\\TinyRustLM-models\\artifacts\\sha256",
    target: path.join(os.homedir(), "External", "TinyRustLM-models",
      "artifacts", "sha256")
  }),
  Object.freeze({
    root: "E:\\Source\\External\\TinyRustLM-models\\checkpoints",
    target: path.join(os.homedir(), "External", "TinyRustLM-models",
      "checkpoints")
  }),
  Object.freeze({
    root: "E:\\Source\\External\\TinyRustLM-models\\sources\\sha256",
    target: path.join(os.homedir(), "External", "TinyRustLM-models",
      "sources", "sha256")
  }),
  Object.freeze({
    root: "E:\\Source\\External\\TinyRustLM-python\\source-screen-py312-v1",
    target: path.join(os.homedir(), "External", "TinyRustLM-python",
      "source-screen-py312-v1")
  })
]);
const looseSourceExemptRoots = Object.freeze([
  // Visual Studio metadata is admitted at the root but retains loose-source checks.
  ...canonicalEcosystemPlainDirectoryNames.filter((name) => name !== ".vs")
    .map((name) => path.join(canonicalEcosystemRoot, name)),
  path.join(registeredEvidenceArtifactsRoot, "external"),
  path.join(registeredEvidenceArtifactsRoot, "releases"),
  path.join(registeredEvidenceArtifactsRoot, "seed-host-native")
]);
const registeredReleaseEvidenceContainerRoot =
  governedExternalSourceScopes[3].root;
const registeredBinaryReleasePackageId =
  "UAIX.Browser.p2pRuntime.SeedHost.Tool";
const registeredBinaryReleaseMaximumBytes = 64 * 1024 * 1024;
const registeredBinaryReleaseSidecarMaximumBytes = 1024 * 1024;
const registeredBinaryNugetMaximumBytes = 2 * 1024 * 1024;
// Pins the binary archives whose payload/SPDX inventories were reviewed together.
const registeredBinaryReleaseArchiveProfiles = Object.freeze([
  ["9235996277abd3be771c6d12378c6dea60ba550aa17117fd71cdf52144a2b0d6", 45020229, "d3b529affcdc91a1aca1b4b4c6e78ed2c0d11f769856d08423339e7bf6e6921f", "ad08d060fc6434078031d1ab81f05160393a9df60db3063a206c688cd20f980b", "0.2.0", "linux-arm64", 345, 347],
  ["ececa51780ddc39f27591bfb13bcae57032c1f8acacee21b265989770d7793a2", 46858373, "b034aafc4ecc287152653ab1346360d22047247d1ab0b3b49a916073419bfada", "4d00b91677b55a86c3da23c1da83e17d4309e1c75bb72f912fb87093d6dc64aa", "0.2.0", "linux-x64", 345, 347],
  ["a9261cc9a07d94f942db118b337553b5f10be751ca10ed14fdba3ca8756076cf", 48067036, "c33d36f70e60634136adb805ff0a6d637a558af6b26cf5c7a7eb702cba2330a7", "f3e1a2ba07e3aa6d37f1d64f8ae652afb06da239586117fc8ebba53c9051e633", "0.2.0", "win-x64", 347, 349],
  ["2087dbc90551ad526b078a0d603ec973eec16575935a0367f328159fbdc42a43", 33127328, "7d0d1b71fb307c8f8fdcb2cfc2e4b2bafeef025ae49cb0184550a416dea840be", "835afceef98b33b43987413bd5dc5b646bd9a9b14ac51d3702cc82a817498d23", "0.1.9", "linux-arm64", 208, 210],
  ["50dbbbf6c4606c40a3b43f606f676c646f25bd66fc26454df446757b5c405f62", 34670601, "202c0a73f963d96fb0888e80d71a3de1854dee4d35c3cfd16f856fafba931686", "acf5d2482c939012c770c531003ce0c638df9d7ddf0fc269fc8b1bf29b15f94d", "0.1.9", "linux-x64", 208, 210],
  ["b5adc55a84a83eb4441b00bf676ad023ffc112f376ff5341a80ac5b7f6ad776e", 35596157, "27cb361f3e200af45ba4bb31381bbca3df82537b0cfe72eb6869f9af3820b2c1", "bfb4f4f952adf57863c0f48d8cc4d3d3b909e2cdffe3a250f7f1fa4e9a87c448", "0.1.9", "win-x64", 208, 210],
  ["e844ebdc478efede8c6b3b918c41df4416e2c9952b1b4959aad4ae0f7240730b", 34650179, "44ce0650cbe9a01418891be3d937d0e7e4c50cdcdfaac3b2380738cda8fb9cb1", "71a0b1c4a08cb0baf686f79b1209afb50b014f880b52594f0cec22d80c8cebc8", "0.1.9", "linux-x64", 208, 210],
  ["100f819d5e3eda451baac1cc71335c20690eeb86b2b80ce0209d266b378200a6", 35596199, "219ac9037df783544b44661115e19c34587f647c3bb0aa35ad817037d2e78e5d", "3cd75a8ddb6c5195f80991319597a24a07d570ddd1cc5e5ca7854bfee59c37d0", "0.1.9", "win-x64", 208, 210],
  ["d67564aa7f1c20342e429365cd8470685af8d0cd9a0ef5f6fbe3e7481c650675", 33070058, "99b1ea031ea36c6bf41ad6444107e594d43a182dab754c8a5dd0efb972be2175", "9717696702b7fbf53fd64637492b1145ba9c0130e1c943d2002d3f0dccdd9415", "0.1.9", "linux-arm64", 208, 210],
  ["34bfa120d184219a6dedfada951b20f9601526d1037dbdc0fe53444abd658142", 34650070, "075ea1b94ee91eff05f144629cfda2e9a0d5ec2737a77d8a21aa42bf7e9d7fd2", "76a1c75cbbb042854c08814b2d886471e9da8ba41b40d6baf78d8812fb863bae", "0.1.9", "linux-x64", 208, 210],
  ["6ff30c81ec0cffc0723791f6dfe1b850ba4b9f7206802e5dfa283e414f57eb17", 35596184, "0e444b1ba48cd5aaf76a7bb5c6db8a161e3d0fd8dec19d8c64b9643c835b7ad5", "2fd2e8ed7521f8ee7638468753c6988157411c9f0bab5808a6efdc1604202b2c", "0.1.9", "win-x64", 208, 210],
  ["141a1a8402a6b350669f3d2cdf8db3ba3c6b6a6504562720921a6b865baf5fa6", 32682488, "fce65b677d3bcbaa22a7df9189eca71cffdf43eef509970e6a5995a203a73b84", "723201b9f170f4bfee9c407f57ebbecba7c8baedbc95790bfd62daf51ae2b89c", "0.1.9", "linux-arm64", 207, 209],
  ["bdc5ec26584b97d4903833cd8f33250023493651e2c7bb46e6bbf6c759b4437d", 34222032, "8b007858cf78e8d4e2d26805f9e283dc7a7a7800a6fb3bf5573282110046d6ab", "f651f5ca61d8a95529c293c88a93277eed9e14054c3b7918ecbe467d326f6dd2", "0.1.9", "linux-x64", 207, 209],
  ["c016c2335355adaec1f3c368979856e9aed841e698bf75c7143c821c374a7f53", 35148587, "37b13765f76025b3888fdacecc2203ad9bf132d7bc3f18cc5af1471ae98da34d", "d9899b8b795800bb58110bb87fa1cdf2fcc3a77b2b5bbc7669622c7db408c406", "0.1.9", "win-x64", 207, 209],
  ["5ae0835408eac6776c245d2b55702a1038a2b2cd10b56776e7b3460086641759", 32679696, "f7af328451bbc7a479f005b88bcba7a4c82879321d25d06b8c9e31205ade7d5c", "bebb234b611cedfff395be770a597936e8a7bccb334d8637745250a3fdfb85c3", "0.1.9", "linux-arm64", 207, 209],
  ["8564e735e636d4d32653a25164aef170d50aefb71ba621348733573ca7e3f1e1", 34223274, "3e62791aeb71f435c245b29a8bb7c3cfcc745d96aa228faffdb5f502bd90293c", "d6725a69d3b85387e5164ad1bc93842efae18127a90d6546afcc170b5eb01cf5", "0.1.9", "linux-x64", 207, 209],
  ["d38af2c135b1304c1958e5023e4180a90cf839dd1000d7bca213be104b7dc4b3", 35144329, "fd96795b45128d88ac15ff606ab98b6263e1a5d5af3cab1e16d6725108a15a2f", "dee4c52f030288d28f45b9a1c54e75e1389a656c9b67021dd95920c50ec8de98", "0.1.9", "win-x64", 207, 209],
  ["e5fcb330af6531a8d0070d646d6a0f821bb0e656c2663f9870af4567e9476248", 44096160, "5121547a9a56fb814be6fac13bfa79922489f7d644fd2ae8f5fe084b8c72f86c", "2890ee8f01b685911ebdf210e65f69077efe4f838ba453e6400792d7c2d1e156", "0.1.10", "linux-arm64", 344, 346],
  ["9650261484b1a386c19c8cc29b3da5c59e61363e6167c0e7f08eaf0e86085587", 45889479, "e4fe1b534e897b757574fb1f20fee9adc4941320d65179fd3e32e4a3ae011e5b", "8d2e44cfbf739b34c6db731d43dd9a48d7eb22fa9beeb3eaefcd7773e0692105", "0.1.10", "linux-x64", 344, 346],
  ["fda55f27d67a90563a543ff0c81fa96baf1bd759753cd6006a68fe7747f64bc8", 47250873, "de7d3ef031cdf1ae2f1f938e75c4c1b6fd74156218a376d19bd2f4d3d02bed9e", "ab65f41b581d8978ebd7af9780970570f2e1fa0a7158e2dfea92ebdad4ec2f67", "0.1.10", "win-x64", 346, 348]
].map(([archiveSha256, archiveBytes, releaseSha256, spdxSha256, version, rid,
  spdxFileCount, archiveMemberCount]) => Object.freeze({
  archiveBytes,
  archiveMemberCount,
  archiveSha256,
  releaseSha256,
  rid,
  spdxFileCount,
  spdxSha256,
  version
})));
const ecosystemAuthorityScanScopes = Object.freeze([
  Object.freeze({
    maximumDepth: ecosystemAuthorityMaximumDepth,
    root: canonicalEcosystemRoot
  }),
  Object.freeze({
    ecosystemOnly: true,
    maximumDepth: ecosystemAuthorityMaximumDepth,
    optional: true,
    root: path.join(localWorkspaceRoot, "Worktrees")
  }),
  Object.freeze({
    ecosystemOnly: true,
    maximumDepth: ecosystemAuthorityMaximumDepth,
    optional: true,
    root: path.join(localWorkspaceRoot, ".codex-tmp")
  }),
  Object.freeze({
    ecosystemOnly: true,
    maximumDepth: ecosystemAuthorityMaximumDepth,
    optional: true,
    root: path.join(localWorkspaceRoot, ".codex-temp")
  }),
  Object.freeze({
    ecosystemOnly: true,
    maximumDepth: ecosystemAuthorityMaximumDepth,
    optional: true,
    root: path.join(localWorkspaceRoot, ".tinyrustlm-evidence")
  }),
  Object.freeze({
    ecosystemOnly: true,
    maximumDepth: ecosystemAuthorityMaximumDepth,
    optional: true,
    root: path.join(localWorkspaceRoot, "External")
  }),
  ...governedExternalSourceScopes.map((scope) => Object.freeze({
    ecosystemOnly: true,
    maximumDepth: scope.maximumDepth,
    optional: true,
    root: scope.root
  })),
  Object.freeze({
    ecosystemOnly: true,
    maximumDepth: ecosystemAuthorityMaximumDepth,
    optional: true,
    root: externalBinaryReleaseEvidenceRoot
  })
]);
const artifactReparsePolicy = Object.freeze({
  canonicalArtifactsRoot,
  registeredEvidenceArtifactsRoot,
  registeredEvidenceRoot
});
const supersededSourceRoots = Object.freeze([
  ...require("../../contracts/storage/retired-storage-roots-2026-09-12.json"),
  "D:\\tw\\26236864",
  "D:\\tw\\3116220",
  "E:\\Source\\.tinyrustlm-model-acquisition",
  "E:\\Source\\.tinyrustlm-model-acquisition-recovered-20260819",
  "E:\\Source\\.codex-tmp\\retired-tinyrustlm-duplicate-20260829-63694536",
  "E:\\Source\\.tinyrustlm-evidence\\acl-owner-deletion-required-20260830-v1",
  "E:\\Source\\External\\TinyRustLM-history-audit-20260802",
  "E:\\Source\\External\\TinyRustLM-portability-clone-20260802",
  "E:\\Source\\External\\TinyRustLM-source-history-externalized",
  "E:\\Source\\External\\TinyRustLM-release-evidence\\source-clean-root-20260802\\extracted",
  "E:\\Source\\Worktrees\\TinyRustLM-baseline-evidence",
  "E:\\Source\\Worktrees\\tinyrustlm-release-surface-verify-2484706-20260820",
  "E:\\Source\\Worktrees\\rust-site-release-20260809\\TinyRustLM.com",
  "E:\\Source\\Rust\\_TinyRustLM-md-preserve-before-source-mirror",
  "E:\\Source\\Rust\\_TinyRustLM-pre-migration-backups",
  "E:\\Source\\Rust\\_TinyRustLM-public-root-before-source-migration",
  "D:\\TinyRustLM-vnext-20260812\\temporary-relocation\\active-uai-tree",
  "D:\\TinyRustLM-vnext-20260812\\temporary-relocation\\active-contracts-tree",
  "D:\\TinyRustLM-vnext-20260812\\temporary-relocation\\active-tinyrustlm-tree",
  "D:\\TinyRustLM-vnext-20260812\\temporary-relocation\\active-wiki-tree",
  "D:\\TinyRustLM-vnext-20260812\\temporary-relocation\\report-intake-relocated"
]);
const supersededEcosystemSourceRoots = Object.freeze([
  "D:\\Archive\\Source\\GGUF.MiRust.com",
  "D:\\TinyRustLM-vnext-20260812\\active-git-metadata",
  "D:\\TinyRustLM-vnext-20260812\\git-metadata-backups",
  "D:\\TinyRustLM-vnext-20260812\\minimodel-source\\8439e224146c790ce6a9da36a32c4c49890cac52",
  "D:\\TinyRustLM-vnext-20260812\\workspace-memory-backups",
  "E:\\Source\\.codex-temp\\tinyrustlm-live-readback-20260826-2025",
  "E:\\Source\\.codex-temp\\tinyrustlm-task-screen-U7hXhX",
  "E:\\Source\\.codex-temp\\tinyrustlm-task-screen-v2-XK7a4f",
  "E:\\Source\\.codex-temp\\tinyrustlm-task-screen-v3-parent-jQRx14",
  "E:\\Source\\.codex-temp\\tinyrustlm-task-v4-b4ADjz",
  "E:\\Source\\.codex-tmp\\lmcomposer-clean-clone-proof-20260829-v1",
  "E:\\Source\\.codex-tmp\\minimodel-mirust-policy-manifest-proof-20260829-v1",
  "E:\\Source\\.codex-tmp\\retired-minimodel-mirust-final-manifest-audit-20260829-v1",
  "E:\\Source\\.codex-tmp\\retired-source-checkin-recovery-20260829-v1",
  "E:\\Source\\.codex-tmp\\retired-tinyrustlm-mirust-1.8.2-clean-clone-proof-20260829-v1",
  "E:\\Source\\.codex-tmp\\site-git-metadata-quarantine-20260829-v1",
  "E:\\Source\\.codex-tmp\\stale-site-roots-after-metadata-loss-20260829-v1",
  "E:\\Source\\.codex-tmp\\tinyrustlm-0.4.0-browser-proof-20260829-v1",
  "E:\\Source\\.codex-tmp\\tinyrustlm-0.4.0-deployment-20260829-v1",
  "E:\\Source\\.codex-tmp\\tinyrustlm-live-audit-3530d1f7957f4e8e86b6ee0de0abfb5c",
  "E:\\Source\\Rust\\_archive\\project-layout-cleanup-20260701-065400",
  "E:\\Source\\Worktrees\\rust-site-release-20260809"
]);
const supersededLooseSourceFiles = Object.freeze([
  "D:\\tw\\26236864\\.git",
  "D:\\tw\\3116220\\.git",
  "D:\\TinyRustLM-vnext-20260812\\git-metadata-backups\\archive-properties-v1\\index.before-doc-handoff",
  "D:\\TinyRustLM-vnext-20260812\\git-metadata-backups\\archive-properties-v1\\index.second-space-move",
  "D:\\TinyRustLM-vnext-20260812\\git-metadata-backups\\archive-properties-v1\\index.uncompressed-moved",
  "D:\\TinyRustLM-vnext-20260812\\temporary-relocation\\extra-.uai_long-term-memory.uai",
  "D:\\TinyRustLM-vnext-20260812\\temporary-relocation\\extra-.uai_short-term-memory.uai",
  "D:\\TinyRustLM-vnext-20260812\\temporary-relocation\\extra-tinyrustlm_app_app.js",
  "D:\\TinyRustLM-vnext-20260812\\temporary-relocation\\extra-tinyrustlm_runtime_src_eval_runner.rs",
  "D:\\TinyRustLM-vnext-20260812\\temporary-relocation\\extra-tinyrustlm_tools_slm_pack_src_safetensors.rs",
  "D:\\TinyRustLM-vnext-20260812\\temporary-relocation\\extra-workspace.uai"
]);
const supersededSourceArchives = Object.freeze([
  "D:\\Archive\\Source\\GGUF.MiRust.com-20260625.zip",
  "E:\\Source\\External\\TinyRustLM-release-evidence\\source-clean-root-20260802\\tinyrustlm-clean-source-a9db946.tar.gz"
]);
const windowsReservedPathSegmentPattern =
  /^(?:aux|clock\$|com[1-9]|con|lpt[1-9]|nul|prn)(?:\..*)?$/iu;
// The September consolidation retired the external container; its root is forbidden.
const registeredEvidenceContainerProfiles = Object.freeze([]);

function fail(code, detail) {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  error.detail = detail;
  throw error;
}

function pathIdentity(value) {
  const normalized = path.normalize(path.resolve(value));
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function samePath(left, right) {
  return pathIdentity(left) === pathIdentity(right);
}

function isMissingPathError(error) {
  return error?.code === "ENOENT" || error?.code === "ENOTDIR";
}

function pathExists(candidate, fileSystem = fs) {
  try {
    fileSystem.lstatSync(candidate);
    return true;
  } catch (error) {
    if (isMissingPathError(error)) return false;
    throw error;
  }
}

// Rejects unpaired UTF-16 code units before path names reach filesystem APIs.
function hasWellFormedUtf16(value) {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

// Accepts one NFC Windows-safe segment with no alias, ADS, or device spelling.
function isCanonicalPathSegment(value) {
  if (typeof value !== "string" || value.length === 0 ||
      value !== value.normalize("NFC") || value !== value.trim() ||
      !hasWellFormedUtf16(value) || value === "." || value === ".." ||
      /[\u0000-\u001f<>:"/\\|?*]/u.test(value) || /[. ]$/u.test(value) ||
      windowsReservedPathSegmentPattern.test(value) ||
      path.win32.basename(value) !== value || path.posix.basename(value) !== value) {
    return false;
  }
  return true;
}

// Validates every absolute path component before a path becomes scan authority.
function hasCanonicalPathSegments(candidate) {
  if (typeof candidate !== "string" || candidate.length === 0) return false;
  const resolved = path.resolve(candidate);
  const root = path.parse(resolved).root;
  return resolved.slice(root.length).split(/[\\/]+/u).filter(Boolean)
    .every(isCanonicalPathSegment);
}

// Filters one directory listing while recording case and segment aliases.
function canonicalDirectoryEntries(entries, directory, nonCanonicalEntries) {
  if (!Array.isArray(entries)) {
    fail("source_authority_discovery_invalid", directory);
  }
  const seen = new Set();
  const accepted = [];
  for (const entry of entries) {
    if (!entry || typeof entry.name !== "string") {
      fail("source_authority_discovery_invalid", directory);
    }
    const identity = entry.name.normalize("NFC").toLowerCase();
    if (!isCanonicalPathSegment(entry.name) || seen.has(identity)) {
      nonCanonicalEntries.add(`${path.resolve(directory)}${path.sep}${entry.name}`);
      continue;
    }
    seen.add(identity);
    accepted.push(entry);
  }
  return accepted;
}

// Neutral sibling probes validate entry shape without governing sibling names.
function neutralProbeDirectoryEntries(entries, directory) {
  if (!Array.isArray(entries)) {
    fail("source_authority_discovery_invalid", directory);
  }
  for (const entry of entries) {
    if (!entry || typeof entry.name !== "string") {
      fail("source_authority_discovery_invalid", directory);
    }
  }
  return entries;
}

// Recognizes archive-container suffixes without granting an evidence exemption.
function isSourceArchiveName(fileName) {
  if (!isCanonicalPathSegment(fileName)) return false;
  const lowerName = fileName.toLowerCase();
  return sourceArchiveSuffixes.some((suffix) => lowerName.endsWith(suffix));
}

// Identifies names whose aliases must not evade the direct workspace boundary.
function isEcosystemAuthorityShapedName(fileName) {
  if (typeof fileName !== "string" || fileName.length === 0) return false;
  const normalized = fileName.normalize("NFC").trim().toLowerCase();
  return ecosystemIdentityNamePattern.test(normalized) ||
    ecosystemAuthorityMarkerNames.includes(normalized) ||
    normalized === allSourceReviewBundleName ||
    sourceArchiveSuffixes.some((suffix) => normalized.endsWith(suffix));
}

// Restricts archive findings to this ecosystem while still traversing all scopes.
function isEcosystemIdentityShapedPath(candidate) {
  if (typeof candidate !== "string" || candidate.length === 0) return false;
  return path.resolve(candidate).split(/[\\/]+/u).some((segment) =>
    ecosystemIdentityNamePattern.test(segment.normalize("NFC").toLowerCase()));
}

function isStrictDescendantPath(candidate, root) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative.length !== 0 && relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

// Matches only exact product/tool entrypoints relative to one enclosing Git root.
function isTinyRustLmGitEntrypoint(candidate, gitRoot) {
  if (typeof candidate !== "string" || typeof gitRoot !== "string" ||
      !isStrictDescendantPath(candidate, gitRoot)) {
    return false;
  }
  const relative = path.relative(path.resolve(gitRoot), path.resolve(candidate));
  const identity = relative.split(/[\\/]+/u).join("/").toLowerCase();
  return tinyRustLmGitEntrypointIdentities.has(identity);
}

function isCanonicalEcosystemRepositoryPath(candidate) {
  return ecosystemRepositories.some((profile) => samePath(candidate, profile.root) ||
    isStrictDescendantPath(candidate, profile.root));
}

// Classifies names only; broad governed scans never open arbitrary file bytes.
function isLooseSourceAuthorityEntry(candidate, authorityRoot) {
  if (typeof candidate !== "string" || candidate.length === 0 ||
      typeof authorityRoot !== "string" || authorityRoot.length === 0) {
    return false;
  }
  if (samePath(candidate, path.join(canonicalEcosystemRoot,
    canonicalEcosystemLegacyArchiveName))) return false;
  if (looseSourceExemptRoots.some((root) => samePath(candidate, root) ||
      isStrictDescendantPath(candidate, root))) return false;
  const lowerName = path.basename(candidate).normalize("NFC").toLowerCase();
  const relative = path.relative(path.resolve(authorityRoot),
    path.resolve(candidate));
  if (relative.length === 0 || relative === ".." ||
      relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return true;
  }
  const sourceBearingDirectoryNames = new Set([
    ".config", ".github", ".uai", ".vscode", "config", "entrypoint",
    "entrypoints", "scripts", "source", "src", "tools"
  ]);
  const parentSegments = relative.split(/[\\/]+/u).slice(0, -1)
    .map((segment) => segment.normalize("NFC").toLowerCase());
  return sourceBearingDirectoryNames.has(lowerName) ||
    parentSegments.some((segment) => sourceBearingDirectoryNames.has(segment)) ||
    sourceAuthorityControlLeafNames.includes(lowerName) ||
    lowerName === ".git" || lowerName.endsWith(".git") ||
    lowerName === "cmakelists.txt" || lowerName === "composer.json" ||
    lowerName === "go.mod" || lowerName === "go.sum" ||
    lowerName === "pyproject.toml" || lowerName === "requirements.txt" ||
    lowerName.startsWith("dockerfile.") ||
    sourceAuthorityConfigSuffixes.some((suffix) => lowerName.endsWith(suffix)) ||
    sourceAuthorityEntrypointSuffixes.some((suffix) =>
      lowerName.endsWith(suffix));
}

function sameFileObservation(left, right) {
  return ["dev", "ino", "size", "mtimeMs", "ctimeMs"].every((field) =>
    left?.[field] === right?.[field]);
}

// Reads one direct regular file only after enforcing a byte ceiling and identity.
function readBoundedRegularFile(candidate, maximumBytes, options = {}) {
  const fileSystem = options.fileSystem || fs;
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 0 ||
      typeof fileSystem?.lstatSync !== "function" ||
      typeof fileSystem?.readFileSync !== "function" ||
      typeof fileSystem?.realpathSync?.native !== "function") {
    fail("source_authority_archive_classifier_invalid", candidate);
  }
  const before = fileSystem.lstatSync(candidate);
  if (!before.isFile() || before.isSymbolicLink() || before.size > maximumBytes ||
      !samePath(fileSystem.realpathSync.native(candidate), candidate)) {
    return null;
  }
  const content = fileSystem.readFileSync(candidate);
  const after = fileSystem.lstatSync(candidate);
  if (!Buffer.isBuffer(content) || content.length !== before.size ||
      !sameFileObservation(before, after) || after.isSymbolicLink() ||
      !samePath(fileSystem.realpathSync.native(candidate), candidate)) {
    fail("source_authority_scan_incomplete", candidate);
  }
  return content;
}

// Reads only enough direct-file bytes to recognize a renamed archive container.
function readRegularFilePrefix(candidate, maximumBytes = 512, options = {}) {
  const fileSystem = options.fileSystem || fs;
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1 ||
      typeof fileSystem?.lstatSync !== "function" ||
      typeof fileSystem?.openSync !== "function" ||
      typeof fileSystem?.readSync !== "function" ||
      typeof fileSystem?.closeSync !== "function" ||
      typeof fileSystem?.realpathSync?.native !== "function") {
    fail("source_authority_archive_classifier_invalid", candidate);
  }
  const before = fileSystem.lstatSync(candidate);
  if (!before.isFile() || before.isSymbolicLink() ||
      !samePath(fileSystem.realpathSync.native(candidate), candidate)) {
    return null;
  }
  const buffer = Buffer.alloc(Math.min(maximumBytes, before.size));
  const descriptor = fileSystem.openSync(candidate, "r");
  let bytesRead;
  try {
    bytesRead = fileSystem.readSync(descriptor, buffer, 0, buffer.length, 0);
  } finally {
    fileSystem.closeSync(descriptor);
  }
  const after = fileSystem.lstatSync(candidate);
  if (!sameFileObservation(before, after) || after.isSymbolicLink() ||
      !samePath(fileSystem.realpathSync.native(candidate), candidate)) {
    fail("source_authority_scan_incomplete", candidate);
  }
  return buffer.subarray(0, bytesRead);
}

// Detects bounded ZIP/gzip/tar and common archive magic without extracting bytes.
function hasArchiveContainerMagic(candidate, options = {}) {
  const readPrefix = options.readPrefix || ((filePath) =>
    readRegularFilePrefix(filePath, 512, options));
  const content = readPrefix(candidate);
  if (!Buffer.isBuffer(content)) return false;
  const starts = (bytes) => content.length >= bytes.length &&
    bytes.every((value, index) => content[index] === value);
  return starts([0x50, 0x4b, 0x03, 0x04]) ||
    starts([0x50, 0x4b, 0x05, 0x06]) ||
    starts([0x50, 0x4b, 0x07, 0x08]) || starts([0x1f, 0x8b]) ||
    starts([0x42, 0x5a, 0x68]) ||
    starts([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]) ||
    starts([0x28, 0xb5, 0x2f, 0xfd]) ||
    starts([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]) ||
    starts([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07]) ||
    starts([0x4d, 0x53, 0x43, 0x46]) ||
    content.subarray(0, 16).toString("ascii").startsWith("# v2 git bundle") ||
    content.subarray(257, 262).toString("ascii") === "ustar";
}

const archiveSourceMemberSuffixes = Object.freeze([
  ".c", ".cc", ".cpp", ".cs", ".csproj", ".fs", ".fsproj", ".h",
  ".hpp", ".js", ".jsx", ".mjs", ".ps1", ".psm1", ".py", ".rs",
  ".sh", ".sln", ".ts", ".tsx", ".vb", ".vbproj", ".vcxproj"
]);

// Rejects an SPDX member that can carry editable source or source authority.
function isSourceBearingArchiveMemberName(fileName) {
  if (typeof fileName !== "string" || !fileName.startsWith("./") ||
      fileName.includes("\\")) return true;
  const segments = fileName.slice(2).split("/");
  if (segments.length === 0 || segments.some((segment) =>
    !isCanonicalPathSegment(segment))) return true;
  const lowerSegments = segments.map((segment) => segment.toLowerCase());
  const leaf = lowerSegments.at(-1);
  return lowerSegments.some((segment) => [".git", ".uai", "source", "src"]
    .includes(segment)) || ecosystemAuthorityMarkerNames.includes(leaf) ||
    sourceAuthorityControlLeafNames.includes(leaf) ||
    sourceArchiveSuffixes.some((suffix) => leaf.endsWith(suffix)) ||
    archiveSourceMemberSuffixes.some((suffix) => leaf.endsWith(suffix));
}

function hasExactKeys(value, expected) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).sort().join("\n") === [...expected].sort().join("\n");
}

// Validates the bounded release receipt without treating it as qualification.
function isValidBinaryReleaseReceipt(receipt, profile) {
  const expectedKeys = ["generated_utc", "mini_model_source",
    "model_bytes_included", "native_abi_version", "native_files", "package_id",
    "project_server_proxies_model_bytes", "project_server_runs_model_bytes",
    "project_server_serves_model_bytes", "rid", "schema", "self_contained",
    "tiny_rust_lm_source", "version"];
  const revision = (value) => hasExactKeys(value, ["dirty", "revision"]) &&
    typeof value.dirty === "boolean" && /^[a-f0-9]{40}$/u.test(value.revision);
  if (!hasExactKeys(receipt, expectedKeys) ||
      receipt.schema !== "uaix.seed_host.release.v0" ||
      receipt.package_id !== registeredBinaryReleasePackageId ||
      receipt.version !== profile.version || receipt.rid !== profile.rid ||
      receipt.self_contained !== true || receipt.native_abi_version !== 2 ||
      !revision(receipt.tiny_rust_lm_source) ||
      !revision(receipt.mini_model_source) ||
      receipt.model_bytes_included !== false ||
      receipt.project_server_serves_model_bytes !== false ||
      receipt.project_server_runs_model_bytes !== false ||
      receipt.project_server_proxies_model_bytes !== false ||
      typeof receipt.generated_utc !== "string" ||
      Number.isNaN(Date.parse(receipt.generated_utc)) ||
      receipt.native_files === null || typeof receipt.native_files !== "object" ||
      Array.isArray(receipt.native_files)) return false;
  const nativeEntries = Object.entries(receipt.native_files);
  return nativeEntries.length > 0 && nativeEntries.length <= 8 &&
    nativeEntries.every(([name, digest]) => isCanonicalPathSegment(name) &&
      /^sha256:[a-f0-9]{64}$/u.test(digest));
}

// Validates one exact SPDX payload inventory and its native receipt bindings.
function isValidBinaryReleaseSpdx(spdx, receipt, profile) {
  if (spdx === null || typeof spdx !== "object" || Array.isArray(spdx) ||
      spdx.spdxVersion !== "SPDX-2.2" || spdx.dataLicense !== "CC0-1.0" ||
      spdx.name !== `${registeredBinaryReleasePackageId} ${profile.version}` ||
      !Array.isArray(spdx.files) || spdx.files.length !== profile.spdxFileCount ||
      !Array.isArray(spdx.packages) || spdx.packages.length > 1024 ||
      !Array.isArray(spdx.relationships) || spdx.relationships.length > 8192) {
    return false;
  }
  const files = new Map();
  for (const file of spdx.files) {
    if (!file || isSourceBearingArchiveMemberName(file.fileName) ||
        !Array.isArray(file.checksums)) return false;
    const identity = file.fileName.normalize("NFC").toLowerCase();
    const sha256 = file.checksums.filter((checksum) =>
      checksum?.algorithm === "SHA256" &&
      /^[a-f0-9]{64}$/u.test(checksum.checksumValue));
    if (files.has(identity) || sha256.length !== 1) return false;
    files.set(identity, sha256[0].checksumValue);
  }
  return Object.entries(receipt.native_files).every(([name, digest]) =>
    files.get(`./runtimes/${profile.rid}/native/${name}`.toLowerCase()) ===
      digest.slice("sha256:".length));
}

// Reads a ZIP central directory and rejects aliases, links, and local-name drift.
function inspectZipArchiveMembers(content) {
  if (!Buffer.isBuffer(content) || content.length < 22) return null;
  let endOffset = -1;
  for (let offset = content.length - 22;
    offset >= Math.max(0, content.length - 65557); offset -= 1) {
    if (content.readUInt32LE(offset) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0 || content.readUInt16LE(endOffset + 4) !== 0 ||
      content.readUInt16LE(endOffset + 6) !== 0) return null;
  const entryCount = content.readUInt16LE(endOffset + 10);
  const centralBytes = content.readUInt32LE(endOffset + 12);
  const centralOffset = content.readUInt32LE(endOffset + 16);
  const commentBytes = content.readUInt16LE(endOffset + 20);
  if (entryCount < 1 || entryCount > 512 ||
      endOffset + 22 + commentBytes !== content.length ||
      centralOffset + centralBytes !== endOffset) return null;
  const names = [];
  const identities = new Set();
  const localOffsets = new Set();
  let totalUncompressed = 0;
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > endOffset || content.readUInt32LE(cursor) !== 0x02014b50) {
      return null;
    }
    const madeBy = content.readUInt16LE(cursor + 4) >>> 8;
    const flags = content.readUInt16LE(cursor + 8);
    const method = content.readUInt16LE(cursor + 10);
    const compressedBytes = content.readUInt32LE(cursor + 20);
    const uncompressedBytes = content.readUInt32LE(cursor + 24);
    const nameBytes = content.readUInt16LE(cursor + 28);
    const extraBytes = content.readUInt16LE(cursor + 30);
    const entryCommentBytes = content.readUInt16LE(cursor + 32);
    const disk = content.readUInt16LE(cursor + 34);
    const externalAttributes = content.readUInt32LE(cursor + 38);
    const localOffset = content.readUInt32LE(cursor + 42);
    const next = cursor + 46 + nameBytes + extraBytes + entryCommentBytes;
    if ((flags & 1) !== 0 || ![0, 8].includes(method) || disk !== 0 ||
        nameBytes < 1 || next > endOffset || localOffsets.has(localOffset) ||
        (madeBy === 3 && ((externalAttributes >>> 16) & 0xf000) === 0xa000)) {
      return null;
    }
    const encodedName = content.subarray(cursor + 46, cursor + 46 + nameBytes);
    if ([...encodedName].some((value) => value > 0x7f || value === 0)) return null;
    const name = encodedName.toString("ascii");
    const segments = name.replace(/\/$/u, "").split("/");
    const identity = name.normalize("NFC").toLowerCase();
    if (name.startsWith("/") || name.includes("\\") ||
        segments.some((segment) => !isCanonicalPathSegment(segment)) ||
        identities.has(identity) || localOffset + 30 > centralOffset ||
        content.readUInt32LE(localOffset) !== 0x04034b50) return null;
    const localFlags = content.readUInt16LE(localOffset + 6);
    const localMethod = content.readUInt16LE(localOffset + 8);
    const localNameBytes = content.readUInt16LE(localOffset + 26);
    const localExtraBytes = content.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameBytes + localExtraBytes;
    if (localFlags !== flags || localMethod !== method ||
        localNameBytes !== nameBytes || dataOffset + compressedBytes > centralOffset ||
        !content.subarray(localOffset + 30, localOffset + 30 + localNameBytes)
          .equals(encodedName)) return null;
    totalUncompressed += uncompressedBytes;
    if (!Number.isSafeInteger(totalUncompressed) ||
        totalUncompressed > 64 * 1024 * 1024) return null;
    identities.add(identity);
    localOffsets.add(localOffset);
    if (!name.endsWith("/")) names.push(name);
    cursor = next;
  }
  return cursor === endOffset ? Object.freeze(names) : null;
}

// Requires one same-directory bounded checksum manifest to bind package bytes.
function isNugetArchiveDigestRegistered(candidate, digest, options = {}) {
  const fileSystem = options.fileSystem || fs;
  const directory = path.dirname(candidate);
  const declaredName = path.basename(candidate).replace(
    /\.[0-9]{8}-[0-9]{6}(?=\.(?:s?nupkg)$)/u, "");
  let entries;
  try {
    entries = fileSystem.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    if (isMissingPathError(error)) return false;
    throw error;
  }
  const manifests = entries.filter((entry) => entry.isFile() &&
    /^SHA256SUMS-UAIX\.Browser-[A-Za-z0-9.-]+\.txt$/u.test(entry.name));
  if (manifests.length < 1 || manifests.length > 16) return false;
  return manifests.some((entry) => {
    const bytes = readBoundedRegularFile(path.join(directory, entry.name),
      64 * 1024, { fileSystem });
    if (!Buffer.isBuffer(bytes)) return false;
    return bytes.toString("utf8").replaceAll("\r\n", "\n").split("\n")
      .some((line) => line === `${digest}  ${declaredName}`);
  });
}

// Admits source-free, checksum-bound NuGet binary/symbol evidence only.
function classifyRegisteredBinaryNugetArchive(candidate, options = {}) {
  const resolved = path.resolve(candidate);
  const lowerName = path.basename(resolved).toLowerCase();
  if (!isStrictDescendantPath(resolved, registeredBinaryNugetEvidenceRoot) ||
      (!lowerName.endsWith(".nupkg") && !lowerName.endsWith(".snupkg"))) {
    return false;
  }
  const readArchive = options.readNugetArchive || ((filePath) =>
    readBoundedRegularFile(filePath, registeredBinaryNugetMaximumBytes, options));
  const content = readArchive(resolved);
  if (!Buffer.isBuffer(content)) return false;
  const digest = crypto.createHash("sha256").update(content).digest("hex");
  const verifyDigest = options.verifyNugetDigest || ((filePath, sha256) =>
    isNugetArchiveDigestRegistered(filePath, sha256, options));
  const members = inspectZipArchiveMembers(content);
  if (typeof verifyDigest !== "function" || !verifyDigest(resolved, digest) ||
      !members || members.some((name) =>
        isSourceBearingArchiveMemberName(`./${name}`))) return false;
  const nuspecCount = members.filter((name) => name.toLowerCase()
    .endsWith(".nuspec")).length;
  const hasContentTypes = members.some((name) =>
    name.toLowerCase() === "[content_types].xml");
  return nuspecCount === 1 && hasContentTypes &&
    (lowerName.endsWith(".snupkg")
      ? members.some((name) => name.toLowerCase().endsWith(".pdb"))
      : members.some((name) => /\.(?:dll|exe)$/iu.test(name)));
}

// Admits only a code-pinned binary archive plus exact bounded release/SPDX bytes.
function classifyRegisteredBinaryReleaseArchive(candidate, options = {}) {
  const resolved = path.resolve(candidate);
  if (isStrictDescendantPath(resolved, registeredBinaryNugetEvidenceRoot)) {
    return classifyRegisteredBinaryNugetArchive(resolved, options);
  }
  if (!registeredBinaryReleaseEvidenceRoots.some((root) =>
    isStrictDescendantPath(resolved, root)) ||
      !isSourceArchiveName(path.basename(resolved))) return false;
  const inspectArchive = options.inspectArchive || ((filePath) => {
    const bytes = readBoundedRegularFile(filePath,
      registeredBinaryReleaseMaximumBytes, options);
    return bytes === null ? null : Object.freeze({
      byteLength: bytes.length,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex")
    });
  });
  const hashBytes = options.hashBytes || ((bytes) =>
    crypto.createHash("sha256").update(bytes).digest("hex"));
  const readSidecar = options.readSidecar || ((filePath) =>
    readBoundedRegularFile(filePath,
      registeredBinaryReleaseSidecarMaximumBytes, options));
  const inspection = inspectArchive(resolved);
  if (typeof hashBytes !== "function" || !inspection ||
      !Number.isSafeInteger(inspection.byteLength) ||
      !/^[a-f0-9]{64}$/u.test(inspection.sha256)) return false;
  const profile = registeredBinaryReleaseArchiveProfiles.find((candidateProfile) =>
    candidateProfile.archiveSha256 === inspection.sha256 &&
    candidateProfile.archiveBytes === inspection.byteLength);
  if (!profile) return false;
  const extension = profile.rid === "win-x64" ? ".zip" : ".tar.gz";
  const stem = `${registeredBinaryReleasePackageId}.${profile.version}-${profile.rid}`;
  if (path.basename(resolved) !== `${stem}${extension}`) return false;
  let releaseBytes;
  let spdxBytes;
  try {
    releaseBytes = readSidecar(path.join(path.dirname(resolved),
      `${stem}.release.json`));
    spdxBytes = readSidecar(path.join(path.dirname(resolved),
      `${stem}.spdx.json`));
  } catch (error) {
    if (isMissingPathError(error)) return false;
    throw error;
  }
  if (!Buffer.isBuffer(releaseBytes) || !Buffer.isBuffer(spdxBytes) ||
      hashBytes(releaseBytes) !== profile.releaseSha256 ||
      hashBytes(spdxBytes) !== profile.spdxSha256) return false;
  let receipt;
  let spdx;
  try {
    const jsonText = (bytes) => bytes.subarray(0, 3).equals(
      Buffer.from([0xef, 0xbb, 0xbf])) ? bytes.subarray(3).toString("utf8") :
      bytes.toString("utf8");
    receipt = JSON.parse(jsonText(releaseBytes));
    spdx = JSON.parse(jsonText(spdxBytes));
  } catch (_error) {
    return false;
  }
  return isValidBinaryReleaseReceipt(receipt, profile) &&
    isValidBinaryReleaseSpdx(spdx, receipt, profile);
}

// Accepts only one unqualified sibling filename as a stored symlink target.
function isPlainRelativeLeafName(value) {
  return typeof value === "string" && value.length !== 0 &&
    value === value.trim() && !/\s|[\\/:\0]/u.test(value) &&
    value !== "." && value !== ".." && !value.endsWith(".") &&
    !path.win32.isAbsolute(value) && !path.posix.isAbsolute(value) &&
    path.win32.basename(value) === value && path.posix.basename(value) === value;
}

// Rejects names or containing paths that could carry source authority.
function isSourceAuthorityShapedPath(candidate, authorityRoot) {
  const relative = path.relative(path.resolve(authorityRoot),
    path.resolve(candidate));
  if (relative.length === 0 || relative === ".." ||
      relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return true;
  }
  const segments = relative.split(/[\\/]+/u).map((segment) =>
    segment.toLowerCase());
  const leaf = segments.at(-1);
  const sourceOrReviewBundle =
    /(?:source|review).*(?:archive|bundle)|(?:archive|bundle).*(?:source|review)/u
      .test(leaf);
  return segments.some((segment) =>
    sourceAuthorityPathSegmentNames.includes(segment)) ||
    ecosystemAuthorityMarkerNames.includes(leaf) ||
    leaf === allSourceReviewBundleName || sourceOrReviewBundle ||
    sourceArchiveSuffixes.some((suffix) => leaf.endsWith(suffix)) ||
    sourceAuthorityControlLeafNames.includes(leaf) || leaf.startsWith(".git") ||
    leaf === "gitconfig" || leaf.startsWith("config.") ||
    leaf.endsWith(".config") || sourceAuthorityEntrypointSuffixes.some(
      (suffix) => leaf.endsWith(suffix));
}

// Inventories only direct Rust-root children and opens only the legacy archive.
function discoverCanonicalEcosystemRootEntries(options = {}) {
  const root = path.resolve(options.root || canonicalEcosystemRoot);
  const fileSystem = options.fileSystem || fs;
  const realpathNative = fileSystem?.realpathSync?.native;
  if (!hasCanonicalPathSegments(root)) {
    fail("source_authority_scan_scope_invalid", root);
  }
  if (typeof fileSystem?.lstatSync !== "function" ||
      typeof fileSystem?.readdirSync !== "function" ||
      typeof realpathNative !== "function") {
    fail("source_authority_scan_scope_invalid");
  }

  const exemptNonSourceStorageRoots = new Set();
  const legacyArchiveRoots = new Set();
  const missingRepositoryRoots = new Set();
  const nonCanonicalEntries = new Set();
  const nonEmptyLegacyArchiveRoots = new Set();
  const nonPlainEntries = new Set();
  const permittedNonRepositoryEntries = new Set();
  const repositoryRoots = new Set();
  const unexpectedEntries = new Set();
  const unreadable = new Set();
  const seenNames = new Set();
  const repositoryNames = new Set(canonicalEcosystemRepositoryNames);
  const plainFileNames = new Set(canonicalEcosystemPlainFileNames);
  const plainDirectoryNames = new Set(canonicalEcosystemPlainDirectoryNames);
  const exemptStorageNames = new Set(
    canonicalEcosystemExemptStorageDirectoryNames);

  // Records one path-bearing filesystem failure without interpreting its cause.
  function recordUnreadable(error, fallback) {
    unreadable.add(path.resolve(error?.path || fallback));
  }

  let rootStat;
  try {
    rootStat = fileSystem.lstatSync(root);
  } catch (error) {
    recordUnreadable(error, root);
  }
  if (rootStat && (!rootStat.isDirectory() || rootStat.isSymbolicLink())) {
    nonPlainEntries.add(root);
  }
  if (rootStat?.isDirectory() && !rootStat.isSymbolicLink()) {
    try {
      if (!samePath(realpathNative(root), root)) nonPlainEntries.add(root);
    } catch (error) {
      recordUnreadable(error, root);
    }
  }

  let entries;
  if (rootStat?.isDirectory() && !rootStat.isSymbolicLink() &&
      !nonPlainEntries.has(root) && !unreadable.has(root)) {
    try {
      entries = fileSystem.readdirSync(root, { withFileTypes: true });
    } catch (error) {
      recordUnreadable(error, root);
    }
  }
  for (const entry of canonicalDirectoryEntries(entries || [], root,
    nonCanonicalEntries)) {
    seenNames.add(entry.name);
    const child = path.join(root, entry.name);
    const isRepository = repositoryNames.has(entry.name);
    const isPlainFile = plainFileNames.has(entry.name);
    const isPlainDirectory = plainDirectoryNames.has(entry.name);
    const isLegacyArchive = entry.name === canonicalEcosystemLegacyArchiveName;
    if (!isRepository && !isPlainFile && !isPlainDirectory &&
        !isLegacyArchive) {
      unexpectedEntries.add(child);
    }

    let stat;
    try {
      stat = fileSystem.lstatSync(child);
    } catch (error) {
      recordUnreadable(error, child);
      continue;
    }
    if (stat.isSymbolicLink()) {
      nonPlainEntries.add(child);
      continue;
    }
    try {
      if (!samePath(realpathNative(child), child)) {
        nonPlainEntries.add(child);
        continue;
      }
    } catch (error) {
      recordUnreadable(error, child);
      continue;
    }

    if (isRepository) {
      if (stat.isDirectory()) repositoryRoots.add(child);
      else nonPlainEntries.add(child);
      continue;
    }
    if (isPlainFile) {
      if (stat.isFile()) permittedNonRepositoryEntries.add(child);
      else nonPlainEntries.add(child);
      continue;
    }
    if (isPlainDirectory) {
      if (!stat.isDirectory()) {
        nonPlainEntries.add(child);
        continue;
      }
      permittedNonRepositoryEntries.add(child);
      if (exemptStorageNames.has(entry.name)) {
        exemptNonSourceStorageRoots.add(child);
      }
      continue;
    }
    if (!isLegacyArchive) continue;
    if (!stat.isDirectory()) {
      nonPlainEntries.add(child);
      continue;
    }
    legacyArchiveRoots.add(child);
    let archiveEntries;
    try {
      archiveEntries = fileSystem.readdirSync(child, { withFileTypes: true });
    } catch (error) {
      recordUnreadable(error, child);
      continue;
    }
    canonicalDirectoryEntries(archiveEntries, child, nonCanonicalEntries);
    if (archiveEntries.length !== 0) nonEmptyLegacyArchiveRoots.add(child);
  }

  for (const name of canonicalEcosystemRepositoryNames) {
    if (!seenNames.has(name)) missingRepositoryRoots.add(path.join(root, name));
  }
  // Freezes one deterministic path inventory for typed verification.
  const sorted = (values) => Object.freeze([...values].sort((left, right) =>
    left.localeCompare(right)));
  return Object.freeze({
    exemptNonSourceStorageRoots: sorted(exemptNonSourceStorageRoots),
    legacyArchiveRoots: sorted(legacyArchiveRoots),
    missingRepositoryRoots: sorted(missingRepositoryRoots),
    nonCanonicalEntries: sorted(nonCanonicalEntries),
    nonEmptyLegacyArchiveRoots: sorted(nonEmptyLegacyArchiveRoots),
    nonPlainEntries: sorted(nonPlainEntries),
    permittedNonRepositoryEntries: sorted(permittedNonRepositoryEntries),
    repositoryRoots: sorted(repositoryRoots),
    root,
    unexpectedEntries: sorted(unexpectedEntries),
    unreadable: sorted(unreadable)
  });
}

function verifyForbiddenPathAbsence(candidates, errorCode, options = {}) {
  if (!Array.isArray(candidates) || candidates.some((candidate) =>
    typeof candidate !== "string" || candidate.length === 0) ||
    typeof errorCode !== "string" || errorCode.length === 0) {
    fail("source_authority_forbidden_inventory_invalid");
  }
  const fileSystem = options.fileSystem || fs;
  for (const candidate of candidates) {
    let exists;
    try {
      exists = pathExists(candidate, fileSystem);
    } catch (error) {
      fail("source_authority_scan_incomplete", error?.path || candidate);
    }
    if (exists) fail(errorCode, candidate);
  }
}

function directStat(candidate, expectedKind) {
  let stat;
  try {
    stat = fs.lstatSync(candidate);
  } catch (error) {
    if (isMissingPathError(error)) return false;
    throw error;
  }
  if (stat.isSymbolicLink() ||
      !samePath(fs.realpathSync.native(candidate), candidate)) {
    return false;
  }
  return expectedKind === "directory" ? stat.isDirectory() : stat.isFile();
}

function isDirectSourceRoot(candidate) {
  return directStat(candidate, "directory") &&
    directStat(path.join(candidate, "Cargo.toml"), "file") &&
    directStat(path.join(candidate, "workspace.uai"), "file") &&
    directStat(path.join(candidate, ".uai", "taboo.uai"), "file") &&
    directStat(path.join(candidate, "tinyrustlm"), "directory") &&
    directStat(path.join(candidate, "tinyrustlm", "package.json"), "file");
}

function isSourceMarkedRoot(candidate) {
  return directStat(candidate, "directory") &&
    directStat(path.join(candidate, "Cargo.toml"), "file") &&
    directStat(path.join(candidate, "tinyrustlm"), "directory") &&
    directStat(path.join(candidate, "tinyrustlm", "package.json"), "file");
}

function readBoundedText(filePath, maximumBytes = 256 * 1024) {
  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size > maximumBytes) {
    fail("source_authority_marker_invalid", filePath);
  }
  return fs.readFileSync(filePath, "utf8");
}

// Extracts one normalized top-level policy block without changing repo sections.
function extractNormalizedTopLevelPolicyBlock(source, heading) {
  if (typeof source !== "string" || source.length === 0 ||
      source.startsWith("\ufeff") || source.includes("\0")) {
    fail("source_authority_ecosystem_policy_invalid", "invalid_text");
  }
  const normalized = source.replaceAll("\r\n", "\n");
  if (normalized.includes("\r")) {
    fail("source_authority_ecosystem_policy_invalid", "invalid_line_endings");
  }
  const lines = normalized.split("\n");
  const starts = lines.flatMap((line, index) => line === heading ? [index] : []);
  if (starts.length !== 1) {
    fail("source_authority_ecosystem_policy_invalid", "heading_count");
  }
  const start = starts[0];
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^[a-z0-9_]+:$/u.test(lines[index])) {
      end = index;
      break;
    }
  }
  while (end > start + 1 && lines[end - 1] === "") end -= 1;
  return `${lines.slice(start, end).join("\n")}\n`;
}

function extractEcosystemSourceRootPolicyBlock(source) {
  return extractNormalizedTopLevelPolicyBlock(source,
    "ecosystem_source_root_prohibitions:");
}

function extractSingleTinyRustLmSourcePolicyBlock(source) {
  return extractNormalizedTopLevelPolicyBlock(source,
    "single_tinyrustlm_source_prohibitions:");
}

// Requires every canonical repository to carry the generated policy verbatim.
function verifyEcosystemSourceRootPolicyParity(options = {}) {
  const policyPaths = options.policyPaths || canonicalEcosystemTabooPaths;
  const readText = options.readText || ((candidate) => readBoundedText(candidate));
  if (!Array.isArray(policyPaths) || policyPaths.length !==
      canonicalEcosystemTabooPaths.length || typeof readText !== "function" ||
      policyPaths.some((candidate) => typeof candidate !== "string" ||
        candidate.length === 0 || !hasCanonicalPathSegments(candidate)) ||
      new Set(policyPaths.map(pathIdentity)).size !== policyPaths.length) {
    fail("source_authority_ecosystem_policy_invalid", "policy_paths");
  }
  for (const policyPath of policyPaths) {
    let source;
    try {
      source = readText(policyPath);
    } catch (error) {
      if (error?.code === "source_authority_ecosystem_policy_invalid") throw error;
      fail("source_authority_scan_incomplete", error?.path || policyPath);
    }
    let block;
    let singleSourceBlock;
    try {
      block = extractEcosystemSourceRootPolicyBlock(source);
      singleSourceBlock = extractSingleTinyRustLmSourcePolicyBlock(source);
    } catch (error) {
      if (error?.code !== "source_authority_ecosystem_policy_invalid") throw error;
      fail(error.code, `${policyPath}:${error.detail || "invalid_block"}`);
    }
    if (block !== canonicalEcosystemSourceRootPolicyBlock) {
      fail("source_authority_ecosystem_policy_invalid",
        `${policyPath}:block_mismatch`);
    }
    const singleSourceBytes = Buffer.from(singleSourceBlock, "utf8");
    const singleSourceSha256 = crypto.createHash("sha256")
      .update(singleSourceBytes)
      .digest("hex");
    if (singleSourceBytes.length !== canonicalSingleTinyRustLmSourcePolicyBytes ||
        singleSourceSha256 !== canonicalSingleTinyRustLmSourcePolicySha256) {
      fail("source_authority_ecosystem_policy_invalid",
        `${policyPath}:single_tinyrustlm_source_block_mismatch`);
    }
  }
  return Object.freeze({
    policyBlock: canonicalEcosystemSourceRootPolicyBlock,
    policyPaths: Object.freeze([...policyPaths]),
    singleTinyRustLmSourcePolicyBytes: canonicalSingleTinyRustLmSourcePolicyBytes,
    singleTinyRustLmSourcePolicySha256: canonicalSingleTinyRustLmSourcePolicySha256
  });
}

// Requires the active root routing memory to equal one small tracked current-only policy.
function verifyCanonicalEcosystemWorkspacePolicy(options = {}) {
  const readText = options.readText || ((candidate, maximumBytes) =>
    readBoundedText(candidate, maximumBytes));
  if (typeof readText !== "function") {
    fail("source_authority_workspace_policy_invalid", "reader");
  }
  if (!options.readText &&
      (!directStat(canonicalEcosystemWorkspacePath, "file") ||
        !directStat(canonicalEcosystemWorkspaceTemplatePath, "file"))) {
    fail("source_authority_workspace_policy_invalid", "path");
  }
  let template;
  let active;
  try {
    template = readText(
      canonicalEcosystemWorkspaceTemplatePath,
      canonicalEcosystemWorkspacePolicyBytes
    );
    active = readText(
      canonicalEcosystemWorkspacePath,
      canonicalEcosystemWorkspacePolicyBytes
    );
  } catch (error) {
    if (error?.code === "source_authority_workspace_policy_invalid") throw error;
    fail("source_authority_scan_incomplete", error?.path || "workspace_policy");
  }
  const templateBytes = Buffer.from(template, "utf8");
  const digest = crypto.createHash("sha256").update(templateBytes).digest("hex");
  if (templateBytes.byteLength !== canonicalEcosystemWorkspacePolicyBytes ||
      digest !== canonicalEcosystemWorkspacePolicySha256 ||
      active !== template || template.startsWith("\ufeff") ||
      template.includes("\0") || template.includes("\r") ||
      !template.endsWith("\n")) {
    fail("source_authority_workspace_policy_invalid", "identity");
  }
  for (const forbidden of [
    "Use only TinyRustLM recovery clone",
    "usable_worktrees:",
    "exact_resume:",
    ".tinyrustlm-model-acquisition-recovered-",
    "Worktrees\\source-checkin-recovery-",
    "MemoryEndpoints remains unauthorized"
  ]) {
    if (template.includes(forbidden)) {
      fail("source_authority_workspace_policy_invalid", "obsolete_instruction");
    }
  }
  for (const required of [
    "profile: rust-site-family.workspace.current.v1",
    `workspace_root: ${canonicalEcosystemRoot}`,
    `canonical_verifier: ${canonicalRoot}\\tinyrustlm\\tools\\verify-single-source-authority.js`,
    "sole_source_rule: These seven direct physical non-reparse repositories are the only editable ecosystem source roots.",
    "live_catalog: MiniModel.org currently has zero independently qualified model entries and zero externally proven peer lanes."
  ]) {
    if (!template.includes(required)) {
      fail("source_authority_workspace_policy_invalid", "required_instruction");
    }
  }
  return Object.freeze({
    byteLength: templateBytes.byteLength,
    path: canonicalEcosystemWorkspacePath,
    sha256: digest,
    templatePath: canonicalEcosystemWorkspaceTemplatePath
  });
}

function isEcosystemSourceMarkedRoot(candidate) {
  if (!directStat(candidate, "directory")) return false;
  const workspacePath = path.join(candidate, "workspace.uai");
  const tabooPath = path.join(candidate, ".uai", "taboo.uai");
  const hasSourceMarker = directStat(path.join(candidate, "Cargo.toml"), "file") ||
    directStat(path.join(candidate, "package.json"), "file") ||
    directStat(path.join(candidate, "tinyrustlm"), "directory");
  if (directStat(workspacePath, "file") &&
      (directStat(tabooPath, "file") || hasSourceMarker)) {
    const workspace = readBoundedText(workspacePath);
    if (ecosystemRepositories.some((profile) =>
      workspace.includes(profile.workspaceProfile)) ||
      ecosystemWorkspaceIdentityPattern.test(workspace)) {
      return true;
    }
  }

  const gitConfigPath = path.join(candidate, ".git", "config");
  if (!directStat(gitConfigPath, "file")) return false;
  const gitConfig = readBoundedText(gitConfigPath, 64 * 1024);
  return ecosystemRepositories.some((profile) =>
    gitConfig.toLowerCase().includes(profile.origin.toLowerCase()));
}

function effectiveScanScopes(scopes, options = {}) {
  const fileSystem = options.fileSystem || fs;
  const platform = options.platform || process.platform;
  if (scopes !== sourceScanScopes || platform !== "win32") {
    return scopes;
  }
  const workspaceAvailable = options.localWorkspaceAvailable === undefined
    ? pathExists(localWorkspaceRoot, fileSystem)
    : options.localWorkspaceAvailable;
  if (workspaceAvailable !== true) {
    return scopes;
  }
  let entries;
  try {
    entries = options.workspaceEntries ||
      fileSystem.readdirSync(localWorkspaceRoot, { withFileTypes: true });
  } catch (error) {
    fail("source_authority_scan_incomplete", error?.path || localWorkspaceRoot);
  }
  const nonCanonicalEntries = new Set();
  const canonicalEntries = canonicalDirectoryEntries(entries, localWorkspaceRoot,
    nonCanonicalEntries);
  if (nonCanonicalEntries.size !== 0) {
    fail("source_authority_scan_incomplete", [...nonCanonicalEntries].map(
      (candidate) => `noncanonical:${candidate}`).join(" | "));
  }
  const seen = new Set(scopes.map((scope) => pathIdentity(scope.root)));
  const additional = [];
  for (const entry of canonicalEntries) {
    if (typeof entry.isDirectory !== "function" ||
        typeof entry.isSymbolicLink !== "function") {
      fail("source_authority_discovery_invalid", localWorkspaceRoot);
    }
    if (!entry.isDirectory() && !entry.isSymbolicLink()) {
      continue;
    }
    const root = path.join(localWorkspaceRoot, entry.name);
    if (seen.has(pathIdentity(root))) continue;
    seen.add(pathIdentity(root));
    const ecosystemShaped = isEcosystemAuthorityShapedName(entry.name);
    additional.push(Object.freeze({
      root,
      maximumDepth: ecosystemShaped ? ecosystemAuthorityMaximumDepth : 0,
      directChildProbeBoundary: !ecosystemShaped
    }));
  }
  return Object.freeze([...scopes, ...additional]);
}

function discoverMarkedSourceRoots(marker, scopes = sourceScanScopes, options = {}) {
  if (typeof marker !== "function") {
    fail("source_authority_marker_invalid");
  }
  const fileSystem = options.fileSystem || fs;
  const discovered = new Set();
  const nonCanonicalEntries = new Set();
  const unscannedSubtrees = new Set();
  const unreadable = new Set();

  function recordUnreadable(error, fallback) {
    const candidate = [error?.detail, error?.path].find((value) =>
      typeof value === "string" && value.length !== 0);
    unreadable.add(path.resolve(candidate || fallback));
  }

  function inspect(directory) {
    let stat;
    try {
      stat = fileSystem.lstatSync(directory);
    } catch (error) {
      recordUnreadable(error, directory);
      return false;
    }
    if (stat.isSymbolicLink()) {
      try {
        const target = fileSystem.realpathSync.native(directory);
        if (marker(target)) discovered.add(path.resolve(directory));
      } catch (error) {
        if (!isMissingPathError(error)) recordUnreadable(error, directory);
      }
      return false;
    }
    if (!stat.isDirectory()) return false;
    try {
      if (marker(directory)) discovered.add(path.resolve(directory));
    } catch (error) {
      recordUnreadable(error, directory);
    }
    return true;
  }

  const resolvedScopes = effectiveScanScopes(scopes, options);
  if (!Array.isArray(resolvedScopes) || resolvedScopes.length === 0 ||
      resolvedScopes.some((scope) =>
        !scope || typeof scope.root !== "string" ||
        !hasCanonicalPathSegments(scope.root) ||
        !Number.isSafeInteger(scope.maximumDepth) || scope.maximumDepth < 0 ||
        (scope.directChildProbeBoundary !== undefined &&
          typeof scope.directChildProbeBoundary !== "boolean") ||
        (scope.entryNamePattern !== undefined &&
          (!(scope.entryNamePattern instanceof RegExp) ||
            scope.entryNamePattern.global || scope.entryNamePattern.sticky)))) {
    fail("source_authority_scan_scope_invalid");
  }

  // Recognizes a subtree delegated to another registered scope at its boundary.
  function coveredByRegisteredScope(candidate) {
    return resolvedScopes.some((scope) => {
      const relative = path.relative(path.resolve(scope.root),
        path.resolve(candidate));
      if (relative === "" || (relative !== ".." &&
          !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))) {
        const depth = relative === "" ? 0 : relative.split(/[\\/]+/u).length;
        return depth <= scope.maximumDepth;
      }
      return false;
    });
  }

  // Scans every directory name or records the exact boundary left unscanned.
  function scan(directory, depth, maximumDepth, entryNamePattern,
    directChildProbeBoundary) {
    if (!inspect(directory)) return;

    let entries;
    try {
      entries = fileSystem.readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      recordUnreadable(error, directory);
      return;
    }
    const scannedEntries = directChildProbeBoundary
      ? neutralProbeDirectoryEntries(entries, directory)
      : canonicalDirectoryEntries(entries, directory, nonCanonicalEntries);
    for (const entry of scannedEntries) {
      if (typeof entry.isDirectory !== "function" ||
          typeof entry.isSymbolicLink !== "function") {
        fail("source_authority_discovery_invalid", directory);
      }
      if (!entry.isDirectory() && !entry.isSymbolicLink()) {
        continue;
      }
      const child = path.join(directory, entry.name);
      if (depth === 0 && entryNamePattern &&
          !entryNamePattern.test(entry.name)) {
        if (!coveredByRegisteredScope(child)) unscannedSubtrees.add(child);
        continue;
      }
      if (entry.isSymbolicLink()) {
        inspect(child);
        continue;
      }
      if (depth >= maximumDepth) {
        if (directChildProbeBoundary) {
          inspect(child);
          continue;
        }
        if (!coveredByRegisteredScope(child)) unscannedSubtrees.add(child);
        continue;
      }
      scan(child, depth + 1, maximumDepth, null, false);
    }
  }

  for (const scope of resolvedScopes) {
    let scopeExists;
    try {
      scopeExists = pathExists(scope.root, fileSystem);
    } catch (error) {
      recordUnreadable(error, scope.root);
      continue;
    }
    if (scopeExists) {
      scan(scope.root, 0, scope.maximumDepth, scope.entryNamePattern || null,
        scope.directChildProbeBoundary === true);
    }
  }
  return Object.freeze({
    nonCanonicalEntries: Object.freeze([...nonCanonicalEntries].sort(
      (left, right) => left.localeCompare(right))),
    roots: Object.freeze([...discovered].sort((left, right) =>
      left.localeCompare(right))),
    unscannedSubtrees: Object.freeze([...unscannedSubtrees].sort(
      (left, right) => left.localeCompare(right))),
    unreadable: Object.freeze([...unreadable].sort((left, right) =>
      left.localeCompare(right)))
  });
}

function discoverSourceArchives(scopes = sourceArchiveScanScopes, options = {}) {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    fail("source_authority_archive_scan_scope_invalid");
  }
  const fileSystem = options.fileSystem || fs;
  const archives = new Set();
  const permittedBinaryReleaseArchives = new Set();
  const nonCanonicalEntries = new Set();
  const unscannedSubtrees = new Set();
  const unreadable = new Set();
  const classifyBinaryRelease = options.classifyBinaryReleaseArchive ||
    ((candidate) => classifyRegisteredBinaryReleaseArchive(candidate, {
      fileSystem
    }));
  const detectArchiveMagic = options.hasArchiveContainerMagic ||
    ((candidate) => hasArchiveContainerMagic(candidate, { fileSystem }));
  if (typeof classifyBinaryRelease !== "function" ||
      typeof detectArchiveMagic !== "function") {
    fail("source_authority_archive_classifier_invalid");
  }

  function recordUnreadable(error, fallback) {
    const candidate = [error?.detail, error?.path].find((value) =>
      typeof value === "string" && value.length !== 0);
    unreadable.add(path.resolve(candidate || fallback));
  }

  const resolvedScopes = effectiveScanScopes(scopes, options);
  if (!Array.isArray(resolvedScopes) || resolvedScopes.length === 0 ||
      resolvedScopes.some((scope) =>
        !scope || typeof scope.root !== "string" ||
        !hasCanonicalPathSegments(scope.root) ||
        !Number.isSafeInteger(scope.maximumDepth) || scope.maximumDepth < 0 ||
        (scope.directChildProbeBoundary !== undefined &&
          typeof scope.directChildProbeBoundary !== "boolean"))) {
    fail("source_authority_archive_scan_scope_invalid");
  }

  // Recognizes a boundary subtree that another archive scope scans directly.
  function coveredByRegisteredScope(candidate) {
    return resolvedScopes.some((scope) => {
      const relative = path.relative(path.resolve(scope.root),
        path.resolve(candidate));
      if (relative === "" || (relative !== ".." &&
          !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))) {
        const depth = relative === "" ? 0 : relative.split(/[\\/]+/u).length;
        return depth <= scope.maximumDepth;
      }
      return false;
    });
  }

  function scan(candidate, depth, maximumDepth, isScopeRoot = false,
    directChildProbeBoundary = false) {
    let stat;
    try {
      stat = fileSystem.lstatSync(candidate);
    } catch (error) {
      if (isScopeRoot && isMissingPathError(error)) return;
      recordUnreadable(error, candidate);
      return;
    }

    if (stat.isSymbolicLink()) {
      if (isSourceArchiveName(path.basename(candidate)) &&
          isEcosystemIdentityShapedPath(candidate)) {
        archives.add(path.resolve(candidate));
      }
      return;
    }
    if (stat.isFile()) {
      if (isSourceArchiveName(path.basename(candidate)) &&
          isEcosystemIdentityShapedPath(candidate)) {
        try {
          if (classifyBinaryRelease(candidate)) {
            permittedBinaryReleaseArchives.add(path.resolve(candidate));
          } else {
            archives.add(path.resolve(candidate));
          }
        } catch (error) {
          recordUnreadable(error, candidate);
        }
      }
      return;
    }
    if (!stat.isDirectory()) return;

    let entries;
    try {
      entries = fileSystem.readdirSync(candidate, { withFileTypes: true });
    } catch (error) {
      recordUnreadable(error, candidate);
      return;
    }
    const scannedEntries = directChildProbeBoundary
      ? neutralProbeDirectoryEntries(entries, candidate)
      : canonicalDirectoryEntries(entries, candidate, nonCanonicalEntries);
    for (const entry of scannedEntries) {
      if (typeof entry.isDirectory !== "function" ||
          typeof entry.isFile !== "function" ||
          typeof entry.isSymbolicLink !== "function") {
        fail("source_authority_archive_discovery_invalid", candidate);
      }
      if (!entry.isDirectory() && !entry.isFile() &&
          !entry.isSymbolicLink()) {
        continue;
      }
      const child = path.join(candidate, entry.name);
      if (entry.isFile() && !isSourceArchiveName(entry.name) &&
          isStrictDescendantPath(child, registeredEvidenceRoot) &&
          isSourceAuthorityShapedPath(child, registeredEvidenceRoot)) {
        try {
          if (detectArchiveMagic(child)) {
            archives.add(path.resolve(child));
          }
        } catch (error) {
          recordUnreadable(error, child);
        }
      }
      if (entry.isDirectory() && depth >= maximumDepth) {
        if (directChildProbeBoundary) continue;
        if (!coveredByRegisteredScope(child)) {
          unscannedSubtrees.add(path.resolve(child));
        }
        continue;
      }
      if (entry.isDirectory() || entry.isSymbolicLink() ||
          isSourceArchiveName(entry.name)) {
        scan(child, depth + 1, maximumDepth, false, false);
      }
    }
  }

  for (const scope of resolvedScopes) {
    scan(scope.root, 0, scope.maximumDepth, true,
      scope.directChildProbeBoundary === true);
  }
  return Object.freeze({
    archives: Object.freeze([...archives].sort((left, right) =>
      left.localeCompare(right))),
    nonCanonicalEntries: Object.freeze([...nonCanonicalEntries].sort(
      (left, right) => left.localeCompare(right))),
    permittedBinaryReleaseArchives: Object.freeze(
      [...permittedBinaryReleaseArchives].sort((left, right) =>
        left.localeCompare(right))),
    unscannedSubtrees: Object.freeze([...unscannedSubtrees].sort(
      (left, right) => left.localeCompare(right))),
    unreadable: Object.freeze([...unreadable].sort((left, right) =>
      left.localeCompare(right)))
  });
}

// Inventories authority-bearing filenames without consulting Git ignore state.
function discoverEcosystemAuthorityFiles(
  scopes = ecosystemAuthorityScanScopes,
  options = {}
) {
  const scanScopes = Array.isArray(scopes) ? scopes : [scopes];
  if (scanScopes.length === 0 || scanScopes.some((scope) =>
    !scope || typeof scope.root !== "string" || scope.root.length === 0 ||
    !hasCanonicalPathSegments(scope.root) ||
    !Number.isSafeInteger(scope.maximumDepth) || scope.maximumDepth < 0 ||
    (scope.ecosystemOnly !== undefined &&
      typeof scope.ecosystemOnly !== "boolean") ||
    (scope.optional !== undefined && typeof scope.optional !== "boolean"))) {
    fail("source_authority_scan_scope_invalid");
  }
  const fileSystem = options.fileSystem || fs;
  const realpathNative = fileSystem?.realpathSync?.native;
  if (typeof fileSystem?.lstatSync !== "function" ||
      typeof fileSystem?.readlinkSync !== "function" ||
      typeof fileSystem?.readdirSync !== "function" ||
      typeof realpathNative !== "function") {
    fail("source_authority_scan_scope_invalid");
  }
  const reparsePolicy = options.artifactReparsePolicy || artifactReparsePolicy;
  if (!reparsePolicy || [
    "canonicalArtifactsRoot",
    "registeredEvidenceArtifactsRoot",
    "registeredEvidenceRoot"
  ].some((field) => typeof reparsePolicy[field] !== "string" ||
    reparsePolicy[field].length === 0 ||
    !hasCanonicalPathSegments(reparsePolicy[field]))) {
    fail("source_authority_scan_scope_invalid");
  }
  const configuredExemptStorageRoots = options.exemptNonSourceStorageRoots ||
    canonicalEcosystemExemptStorageRoots;
  if (!Array.isArray(configuredExemptStorageRoots) ||
      configuredExemptStorageRoots.some((candidate) =>
        typeof candidate !== "string" || candidate.length === 0 ||
        !hasCanonicalPathSegments(candidate)) ||
      new Set(configuredExemptStorageRoots.map(pathIdentity)).size !==
        configuredExemptStorageRoots.length) {
    fail("source_authority_scan_scope_invalid");
  }
  const configuredExemptStorageIdentities = new Set(
    configuredExemptStorageRoots.map(pathIdentity));
  const configuredStorageReparseProfiles = Object.hasOwn(options,
    "nonSourceStorageReparseProfiles")
    ? options.nonSourceStorageReparseProfiles
    : registeredNonSourceStorageReparseProfiles;
  if (!Array.isArray(configuredStorageReparseProfiles) ||
      configuredStorageReparseProfiles.some((profile) =>
        !profile || typeof profile.root !== "string" ||
        typeof profile.target !== "string" ||
        profile.root.length === 0 || profile.target.length === 0 ||
        !hasCanonicalPathSegments(profile.root) ||
        !hasCanonicalPathSegments(profile.target) ||
        samePath(profile.root, profile.target) ||
        isCanonicalEcosystemRepositoryPath(profile.root) ||
        samePath(profile.target, localWorkspaceRoot) ||
        isStrictDescendantPath(profile.target, localWorkspaceRoot)) ||
      new Set(configuredStorageReparseProfiles.map((profile) =>
        pathIdentity(profile.root))).size !== configuredStorageReparseProfiles.length) {
    fail("source_authority_scan_scope_invalid");
  }
  const storageReparseProfilesByRoot = new Map(
    configuredStorageReparseProfiles.map((profile) =>
      [pathIdentity(profile.root), profile]));
  const scopeIdentities = scanScopes.map((scope) => pathIdentity(scope.root));
  if (new Set(scopeIdentities).size !== scopeIdentities.length) {
    fail("source_authority_scan_scope_invalid");
  }

  const markerNames = new Set(ecosystemAuthorityMarkerNames);
  const exemptNonSourceStorageRoots = new Set();
  const markerFiles = new Set();
  const nonCanonicalEntries = new Set();
  const reviewBundles = new Set();
  const unreadable = new Set();
  const reparses = new Set();
  const permittedLeafSymlinks = new Set();
  const permittedReparses = new Set();
  const permittedBinaryReleaseArchives = new Set();
  const reparseTargetDrift = new Set();
  const depthExceeded = new Set();
  const nonRegular = new Set();
  const looseSourceFiles = new Set();
  const sourceArchives = new Set();
  const partialGitRoots = new Set();
  const classifyBinaryRelease = options.classifyBinaryReleaseArchive ||
    ((candidate) => classifyRegisteredBinaryReleaseArchive(candidate, {
      fileSystem
    }));
  if (typeof classifyBinaryRelease !== "function") {
    fail("source_authority_archive_classifier_invalid");
  }
  const pending = scanScopes.map((scope) => ({
    depth: 0,
    directory: path.resolve(scope.root),
    ecosystemOnly: scope.ecosystemOnly === true,
    gitRoot: null,
    isScopeRoot: true,
    maximumDepth: scope.maximumDepth,
    optional: scope.optional === true,
    scopeRoot: path.resolve(scope.root)
  }));

  // Normalizes an I/O failure into the scan's fail-closed path inventory.
  function recordUnreadable(error, fallback) {
    const candidate = [error?.detail, error?.path].find((value) =>
      typeof value === "string" && value.length !== 0);
    unreadable.add(path.resolve(candidate || fallback));
  }

  // Tests strict containment without accepting the root itself or parent aliases.
  function isStrictDescendant(candidate, root) {
    const relative = path.relative(path.resolve(root), path.resolve(candidate));
    return relative.length !== 0 && relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  }

  // Admits one direct evidence symlink to one regular sibling file.
  function classifyEvidenceLeafSymlink(candidate, stat) {
    if (!stat?.isSymbolicLink() || stat.isDirectory()) {
      reparses.add(candidate);
      return;
    }
    let storedTarget;
    try {
      storedTarget = fileSystem.readlinkSync(candidate, "utf8");
    } catch (error) {
      recordUnreadable(error, candidate);
      return;
    }
    if (!isPlainRelativeLeafName(storedTarget) ||
        isSourceAuthorityShapedPath(candidate,
          reparsePolicy.registeredEvidenceRoot)) {
      reparses.add(candidate);
      return;
    }
    const lexicalTarget = path.resolve(path.dirname(candidate), storedTarget);
    if (!samePath(path.dirname(lexicalTarget), path.dirname(candidate)) ||
        !isStrictDescendant(lexicalTarget,
          reparsePolicy.registeredEvidenceRoot)) {
      reparseTargetDrift.add(candidate);
      return;
    }
    if (isSourceAuthorityShapedPath(lexicalTarget,
      reparsePolicy.registeredEvidenceRoot)) {
      reparses.add(candidate);
      return;
    }

    let targetStat;
    try {
      targetStat = fileSystem.lstatSync(lexicalTarget);
    } catch (error) {
      recordUnreadable(error, lexicalTarget);
      return;
    }
    if (!targetStat.isFile() || targetStat.isDirectory() ||
        targetStat.isSymbolicLink()) {
      reparses.add(candidate);
      return;
    }

    let physicalLinkTarget;
    let physicalSiblingTarget;
    try {
      physicalLinkTarget = realpathNative(candidate);
      physicalSiblingTarget = realpathNative(lexicalTarget);
    } catch (error) {
      recordUnreadable(error, candidate);
      return;
    }
    if (!isStrictDescendant(physicalLinkTarget,
          reparsePolicy.registeredEvidenceRoot) ||
        !isStrictDescendant(physicalSiblingTarget,
          reparsePolicy.registeredEvidenceRoot) ||
        !samePath(physicalSiblingTarget, lexicalTarget) ||
        !samePath(physicalLinkTarget, physicalSiblingTarget)) {
      reparseTargetDrift.add(candidate);
      return;
    }
    permittedLeafSymlinks.add(candidate);
  }

  // Classifies one reparse by its exact registered target and node type.
  function classifyReparse(candidate, stat, resolvedTarget) {
    const resolvedCandidate = path.resolve(candidate);
    if (samePath(resolvedCandidate, reparsePolicy.registeredEvidenceRoot) ||
        isStrictDescendant(resolvedCandidate,
          reparsePolicy.registeredEvidenceRoot)) {
      classifyEvidenceLeafSymlink(resolvedCandidate, stat);
      return;
    }
    const storageProfile = storageReparseProfilesByRoot.get(
      pathIdentity(resolvedCandidate));
    if (storageProfile) {
      let target = resolvedTarget;
      if (target === undefined) {
        try {
          target = realpathNative(resolvedCandidate);
        } catch (error) {
          recordUnreadable(error, resolvedCandidate);
          return;
        }
      }
      let targetStat;
      let directTarget;
      try {
        targetStat = fileSystem.lstatSync(target);
        directTarget = realpathNative(target);
      } catch (error) {
        recordUnreadable(error, resolvedCandidate);
        return;
      }
      if (!stat?.isSymbolicLink() || !samePath(target, storageProfile.target) ||
          !targetStat.isDirectory() || targetStat.isSymbolicLink() ||
          !samePath(directTarget, storageProfile.target)) {
        reparseTargetDrift.add(resolvedCandidate);
        return;
      }
      permittedReparses.add(resolvedCandidate);
      return;
    }
    let target = resolvedTarget;
    if (target === undefined) {
      try {
        target = realpathNative(resolvedCandidate);
      } catch (error) {
        recordUnreadable(error, resolvedCandidate);
        return;
      }
    }
    if (!isStrictDescendant(resolvedCandidate,
      reparsePolicy.canonicalArtifactsRoot)) {
      reparses.add(resolvedCandidate);
      return;
    }
    const relative = path.relative(
      reparsePolicy.canonicalArtifactsRoot, resolvedCandidate);
    const expectedTarget = path.join(
      reparsePolicy.registeredEvidenceArtifactsRoot, relative);
    if (samePath(target, expectedTarget)) {
      permittedReparses.add(resolvedCandidate);
    } else {
      reparseTargetDrift.add(resolvedCandidate);
    }
  }

  // Confirms a scanned path resolves directly rather than through an alias.
  function hasDirectIdentity(candidate) {
    try {
      const target = realpathNative(candidate);
      if (!samePath(target, candidate)) {
        classifyReparse(candidate, undefined, target);
        return false;
      }
      return true;
    } catch (error) {
      recordUnreadable(error, candidate);
      return false;
    }
  }

  while (pending.length !== 0) {
    const {
      depth,
      directory,
      ecosystemOnly,
      gitRoot,
      isScopeRoot,
      maximumDepth,
      optional,
      scopeRoot
    } = pending.pop();
    let directoryStat;
    try {
      directoryStat = fileSystem.lstatSync(directory);
    } catch (error) {
      if (isScopeRoot && optional && isMissingPathError(error)) continue;
      recordUnreadable(error, directory);
      continue;
    }
    if (directoryStat.isSymbolicLink()) {
      classifyReparse(directory, directoryStat);
      continue;
    }
    if (!directoryStat.isDirectory()) {
      unreadable.add(path.resolve(directory));
      continue;
    }
    if (!hasDirectIdentity(directory)) continue;

    let entries;
    try {
      entries = fileSystem.readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      recordUnreadable(error, directory);
      continue;
    }
    const scannedEntries = canonicalDirectoryEntries(entries, directory,
      nonCanonicalEntries);
    for (const entry of scannedEntries) {
      if (typeof entry.isDirectory !== "function" ||
          typeof entry.isFile !== "function" ||
          typeof entry.isSymbolicLink !== "function") {
        fail("source_authority_discovery_invalid", directory);
      }
    }
    const directGitMarker = scannedEntries.find((entry) =>
      entry.name.toLowerCase() === ".git" &&
      (entry.isDirectory() || entry.isFile() || entry.isSymbolicLink()));
    const effectiveGitRoot = directGitMarker ? directory : gitRoot;

    for (const entry of scannedEntries) {
      const child = path.join(directory, entry.name);
      const lowerName = entry.name.toLowerCase();
      const sourceEntrypoint = effectiveGitRoot !== null &&
        isTinyRustLmGitEntrypoint(child, effectiveGitRoot);
      const ecosystemShaped = isEcosystemIdentityShapedPath(child);
      const isMarker = markerNames.has(lowerName) &&
        (!ecosystemOnly || ecosystemShaped);
      const isReviewBundle = lowerName === allSourceReviewBundleName;
      const isSourceArchive = isSourceArchiveName(entry.name) &&
        (!ecosystemOnly || ecosystemShaped);
      const isLooseSource = !isCanonicalEcosystemRepositoryPath(child) &&
        (!ecosystemOnly || ecosystemShaped) && !isMarker &&
        !isReviewBundle && !isSourceArchive &&
        isLooseSourceAuthorityEntry(child, scopeRoot);
      if (sourceEntrypoint && !ecosystemRepositories.some((profile) =>
        samePath(effectiveGitRoot, profile.root))) {
        partialGitRoots.add(path.resolve(effectiveGitRoot));
      }
      if (isSourceArchive) {
        if (entry.isFile()) {
          try {
            if (classifyBinaryRelease(child)) {
              permittedBinaryReleaseArchives.add(path.resolve(child));
            } else {
              sourceArchives.add(path.resolve(child));
            }
          } catch (error) {
            recordUnreadable(error, child);
          }
        } else {
          sourceArchives.add(path.resolve(child));
        }
      }
      if (isMarker) markerFiles.add(path.resolve(child));
      if (isReviewBundle) reviewBundles.add(path.resolve(child));
      if (isLooseSource) looseSourceFiles.add(path.resolve(child));

      let stat;
      if (entry.isDirectory() || entry.isSymbolicLink() ||
          isMarker || isReviewBundle || isLooseSource || sourceEntrypoint) {
        try {
          stat = fileSystem.lstatSync(child);
        } catch (error) {
          recordUnreadable(error, child);
          continue;
        }
      }
      if (entry.isSymbolicLink() || stat?.isSymbolicLink()) {
        if (storageReparseProfilesByRoot.has(pathIdentity(child)) ||
            !ecosystemOnly || sourceEntrypoint || isMarker ||
            isReviewBundle || isSourceArchive) {
          classifyReparse(child, stat);
        }
        continue;
      }
      if ((isMarker || isReviewBundle) && !stat?.isFile()) {
        nonRegular.add(path.resolve(child));
      }
      if ((isMarker || isReviewBundle) && stat?.isFile() &&
          !hasDirectIdentity(child)) {
        continue;
      }
      if (!entry.isDirectory()) continue;
      if (!stat?.isDirectory()) {
        unreadable.add(path.resolve(child));
        continue;
      }
      if (configuredExemptStorageIdentities.has(pathIdentity(child))) {
        if (!hasDirectIdentity(child)) continue;
        exemptNonSourceStorageRoots.add(path.resolve(child));
      }
      if (depth >= maximumDepth) {
        depthExceeded.add(path.resolve(child));
        continue;
      }
      pending.push({
        depth: depth + 1,
        directory: child,
        ecosystemOnly,
        gitRoot: effectiveGitRoot,
        isScopeRoot: false,
        maximumDepth,
        optional: false,
        scopeRoot
      });
    }
  }

  return Object.freeze({
    depthExceeded: Object.freeze([...depthExceeded].sort((left, right) =>
      left.localeCompare(right))),
    exemptNonSourceStorageRoots: Object.freeze(
      [...exemptNonSourceStorageRoots].sort((left, right) =>
        left.localeCompare(right))),
    markerFiles: Object.freeze([...markerFiles].sort((left, right) =>
      left.localeCompare(right))),
    looseSourceFiles: Object.freeze([...looseSourceFiles].sort((left, right) =>
      left.localeCompare(right))),
    nonCanonicalEntries: Object.freeze([...nonCanonicalEntries].sort(
      (left, right) => left.localeCompare(right))),
    nonRegular: Object.freeze([...nonRegular].sort((left, right) =>
      left.localeCompare(right))),
    permittedLeafSymlinks: Object.freeze([...permittedLeafSymlinks].sort(
      (left, right) => left.localeCompare(right))),
    permittedBinaryReleaseArchives: Object.freeze(
      [...permittedBinaryReleaseArchives].sort((left, right) =>
        left.localeCompare(right))),
    permittedReparses: Object.freeze([...permittedReparses].sort((left, right) =>
      left.localeCompare(right))),
    partialGitRoots: Object.freeze([...partialGitRoots].sort((left, right) =>
      left.localeCompare(right))),
    reparses: Object.freeze([...reparses].sort((left, right) =>
      left.localeCompare(right))),
    reparseTargetDrift: Object.freeze([...reparseTargetDrift].sort((left, right) =>
      left.localeCompare(right))),
    reviewBundles: Object.freeze([...reviewBundles].sort((left, right) =>
      left.localeCompare(right))),
    sourceArchives: Object.freeze([...sourceArchives].sort((left, right) =>
      left.localeCompare(right))),
    unreadable: Object.freeze([...unreadable].sort((left, right) =>
      left.localeCompare(right)))
  });
}

function discoverLocalSourceRoots(scopes = sourceScanScopes) {
  return discoverMarkedSourceRoots(isSourceMarkedRoot, scopes);
}

function discoverEcosystemSourceRoots(scopes = sourceScanScopes) {
  return discoverMarkedSourceRoots(isEcosystemSourceMarkedRoot, scopes);
}

function gitOutput(root, arguments_) {
  const result = childProcess.spawnSync("git", ["-C", root, ...arguments_], {
    encoding: "utf8",
    shell: false,
    windowsHide: true
  });
  if (result.error || result.signal !== null || result.status !== 0) {
    fail("source_authority_git_identity_invalid", arguments_.join(" "));
  }
  return result.stdout.trim();
}

function exactRemoteUrls(output, expectedOrigin) {
  const urls = output.split(/\r?\n/u);
  return urls.length === 1 && urls[0] === expectedOrigin;
}

function verifyGitIdentity(root, options = {}) {
  const readGit = options.gitOutput || gitOutput;
  const expectedBranch = options.requiredBranch || requiredBranch;
  const expectedOrigin = options.requiredOrigin || requiredOrigin;
  if (!directStat(root, "directory") ||
      !directStat(path.join(root, ".git"), "directory")) {
    fail("source_authority_git_repository_invalid", root);
  }
  const topLevel = readGit(root, ["rev-parse", "--show-toplevel"]);
  const gitDirectory = readGit(root, ["rev-parse", "--absolute-git-dir"]);
  if (!samePath(topLevel, root) ||
      !samePath(gitDirectory, path.join(root, ".git"))) {
    fail("source_authority_git_repository_invalid", root);
  }
  if (readGit(root, ["branch", "--show-current"]) !== expectedBranch) {
    fail("source_authority_branch_invalid");
  }
  const fetchUrls = readGit(root,
    ["remote", "get-url", "--all", "origin"]);
  const pushUrls = readGit(root,
    ["remote", "get-url", "--push", "--all", "origin"]);
  if (!exactRemoteUrls(fetchUrls, expectedOrigin) ||
      !exactRemoteUrls(pushUrls, expectedOrigin)) {
    fail("source_authority_origin_invalid");
  }
  if (options.requireRemoteExact) {
    const expectedUpstream = `refs/remotes/origin/${expectedBranch}`;
    if (readGit(root,
      ["rev-parse", "--symbolic-full-name", "@{upstream}"]) !==
        expectedUpstream) {
      fail("source_authority_upstream_invalid");
    }
    const remoteReference = `refs/heads/${expectedBranch}`;
    const remoteLine = readGit(root,
      ["ls-remote", "--exit-code", "--refs", "origin", remoteReference]);
    const remoteFields = remoteLine.split(/\s+/u);
    if (remoteFields.length !== 2 || remoteFields[1] !== remoteReference) {
      fail("source_authority_direct_remote_invalid");
    }
    const identities = [
      readGit(root, ["rev-parse", "HEAD"]),
      readGit(root, ["rev-parse", "@{upstream}"]),
      readGit(root, ["rev-parse", "FETCH_HEAD"]),
      readGit(root, ["rev-parse", expectedUpstream]),
      remoteFields[0]
    ];
    if (new Set(identities).size !== 1) {
      fail("source_authority_remote_equality_invalid");
    }
  }
  if (options.requireClean &&
      readGit(root, ["status", "--porcelain=v1", "--untracked-files=all"]) !== "") {
    fail("source_authority_worktree_dirty");
  }
}

function verifyDiscovery(discovery) {
  if (!discovery || ["nonCanonicalEntries", "roots", "unscannedSubtrees",
    "unreadable"].some((field) => !Array.isArray(discovery[field]) ||
      discovery[field].some((candidate) => typeof candidate !== "string" ||
        candidate.length === 0))) {
    fail("source_authority_discovery_invalid");
  }
  const incomplete = [
    ...discovery.nonCanonicalEntries.map((candidate) =>
      `noncanonical:${candidate}`),
    ...discovery.unscannedSubtrees.map((candidate) => `depth:${candidate}`),
    ...discovery.unreadable.map((candidate) => `unreadable:${candidate}`)
  ].sort((left, right) => left.localeCompare(right));
  if (incomplete.length !== 0) {
    fail("source_authority_scan_incomplete", incomplete.join(" | "));
  }
  if (discovery.roots.length !== 1 ||
      !samePath(discovery.roots[0], canonicalRoot)) {
    fail("source_authority_duplicate_root_present", discovery.roots.join(" | "));
  }
}

function verifyEcosystemDiscovery(discovery) {
  verifyDiscoveryShapeAndCompleteness(discovery);
  const expected = new Set(ecosystemRepositories.map((profile) =>
    pathIdentity(profile.root)));
  const actual = discovery.roots.map((root) => pathIdentity(root));
  if (actual.length !== expected.size ||
      actual.some((root) => !expected.has(root))) {
    fail("source_authority_ecosystem_duplicate_root_present",
      discovery.roots.join(" | "));
  }
}

// Validates the shared bounded-discovery contract without root cardinality.
function verifyDiscoveryShapeAndCompleteness(discovery) {
  if (!discovery || ["nonCanonicalEntries", "roots", "unscannedSubtrees",
    "unreadable"].some((field) => !Array.isArray(discovery[field]) ||
      discovery[field].some((candidate) => typeof candidate !== "string" ||
        candidate.length === 0))) {
    fail("source_authority_discovery_invalid");
  }
  const incomplete = [
    ...discovery.nonCanonicalEntries.map((candidate) =>
      `noncanonical:${candidate}`),
    ...discovery.unscannedSubtrees.map((candidate) => `depth:${candidate}`),
    ...discovery.unreadable.map((candidate) => `unreadable:${candidate}`)
  ].sort((left, right) => left.localeCompare(right));
  if (incomplete.length !== 0) {
    fail("source_authority_scan_incomplete", incomplete.join(" | "));
  }
}

// Requires one exact marker inventory and a complete direct-filesystem scan.
function verifyEcosystemAuthorityFileDiscovery(discovery) {
  const arrayFields = [
    "depthExceeded",
    "exemptNonSourceStorageRoots",
    "looseSourceFiles",
    "markerFiles",
    "nonCanonicalEntries",
    "nonRegular",
    "partialGitRoots",
    "permittedBinaryReleaseArchives",
    "permittedLeafSymlinks",
    "permittedReparses",
    "reparses",
    "reparseTargetDrift",
    "reviewBundles",
    "sourceArchives",
    "unreadable"
  ];
  if (!discovery || arrayFields.some((field) =>
    !Array.isArray(discovery[field]) || discovery[field].some((candidate) =>
      typeof candidate !== "string" || candidate.length === 0))) {
    fail("source_authority_discovery_invalid");
  }

  const incomplete = [
    ...discovery.unreadable.map((candidate) => `unreadable:${candidate}`),
    ...discovery.reparses.map((candidate) => `reparse:${candidate}`),
    ...discovery.reparseTargetDrift.map((candidate) =>
      `reparse_target_drift:${candidate}`),
    ...discovery.nonCanonicalEntries.map((candidate) =>
      `noncanonical:${candidate}`),
    ...discovery.depthExceeded.map((candidate) => `depth:${candidate}`)
  ].sort((left, right) => left.localeCompare(right));
  if (incomplete.length !== 0) {
    fail("source_authority_scan_incomplete", incomplete.join(" | "));
  }
  if (discovery.looseSourceFiles.length !== 0) {
    fail("source_authority_loose_source_present",
      discovery.looseSourceFiles.join(" | "));
  }
  if (discovery.partialGitRoots.length !== 0) {
    fail("source_authority_partial_git_source_present");
  }
  if (discovery.sourceArchives.length !== 0) {
    fail("source_authority_source_archive_present",
      discovery.sourceArchives.join(" | "));
  }
  if (discovery.reviewBundles.length !== 0) {
    fail("source_authority_superseded_file_present",
      discovery.reviewBundles.join(" | "));
  }

  const expected = new Map(canonicalEcosystemAuthorityMarkers.map((candidate) =>
    [pathIdentity(candidate), candidate]));
  const actual = new Map();
  const duplicates = [];
  for (const candidate of discovery.markerFiles) {
    const identity = pathIdentity(candidate);
    if (actual.has(identity)) duplicates.push(candidate);
    actual.set(identity, candidate);
  }
  const missing = [...expected].filter(([identity]) => !actual.has(identity))
    .map(([, candidate]) => candidate);
  const unexpected = [...actual].filter(([identity]) => !expected.has(identity))
    .map(([, candidate]) => candidate);
  const inventoryErrors = [
    ...missing.map((candidate) => `missing:${candidate}`),
    ...unexpected.map((candidate) => `unexpected:${candidate}`),
    ...duplicates.map((candidate) => `duplicate:${candidate}`),
    ...discovery.nonRegular.map((candidate) => `non_regular:${candidate}`)
  ].sort((left, right) => left.localeCompare(right));
  if (inventoryErrors.length !== 0) {
    fail("source_authority_ecosystem_marker_inventory_invalid",
      inventoryErrors.join(" | "));
  }
}

function verifySourceArchiveDiscovery(discovery) {
  if (!discovery || !Array.isArray(discovery.archives) ||
      !Array.isArray(discovery.nonCanonicalEntries) ||
      !Array.isArray(discovery.permittedBinaryReleaseArchives) ||
      !Array.isArray(discovery.unscannedSubtrees) ||
      !Array.isArray(discovery.unreadable) ||
      [discovery.archives, discovery.nonCanonicalEntries,
        discovery.permittedBinaryReleaseArchives,
        discovery.unscannedSubtrees, discovery.unreadable].some((values) =>
        values.some((candidate) => typeof candidate !== "string" ||
          candidate.length === 0))) {
    fail("source_authority_archive_discovery_invalid");
  }
  const incomplete = [
    ...discovery.nonCanonicalEntries.map((candidate) =>
      `noncanonical:${candidate}`),
    ...discovery.unscannedSubtrees.map((candidate) => `depth:${candidate}`),
    ...discovery.unreadable.map((candidate) => `unreadable:${candidate}`)
  ].sort((left, right) => left.localeCompare(right));
  if (incomplete.length !== 0) {
    fail("source_authority_scan_incomplete", incomplete.join(" | "));
  }
  if (discovery.archives.length !== 0) {
    fail("source_authority_source_archive_present",
      discovery.archives.join(" | "));
  }
}

// Enforces the exact direct-child contract for one canonical Rust source root.
function verifyCanonicalEcosystemRootEntryDiscovery(discovery, options = {}) {
  const root = path.resolve(options.root || canonicalEcosystemRoot);
  const arrayFields = [
    "exemptNonSourceStorageRoots",
    "legacyArchiveRoots",
    "missingRepositoryRoots",
    "nonCanonicalEntries",
    "nonEmptyLegacyArchiveRoots",
    "nonPlainEntries",
    "permittedNonRepositoryEntries",
    "repositoryRoots",
    "unexpectedEntries",
    "unreadable"
  ];
  if (!discovery || typeof discovery.root !== "string" ||
      !samePath(discovery.root, root) || arrayFields.some((field) =>
        !Array.isArray(discovery[field]) || discovery[field].some((candidate) =>
          typeof candidate !== "string" || candidate.length === 0) ||
        new Set(discovery[field].map(pathIdentity)).size !==
          discovery[field].length)) {
    fail("source_authority_discovery_invalid", root);
  }

  const expectedRepositoryRoots = canonicalEcosystemRepositoryNames.map(
    (name) => path.join(root, name));
  const allowedNonRepositoryEntries = new Set([
    ...canonicalEcosystemPlainFileNames,
    ...canonicalEcosystemPlainDirectoryNames
  ].map((name) => pathIdentity(path.join(root, name))));
  const expectedExemptRoots = new Set(
    canonicalEcosystemExemptStorageDirectoryNames.map((name) =>
      pathIdentity(path.join(root, name))));
  const actualRepositoryRoots = new Set(discovery.repositoryRoots.map(
    pathIdentity));
  const permittedNonRepositoryIdentities = new Set(
    discovery.permittedNonRepositoryEntries.map(pathIdentity));
  const missingRepositories = expectedRepositoryRoots.filter((candidate) =>
    !actualRepositoryRoots.has(pathIdentity(candidate)));
  const invalidBindings = [
    ...discovery.repositoryRoots.filter((candidate) =>
      !expectedRepositoryRoots.some((expected) => samePath(candidate, expected))),
    ...discovery.missingRepositoryRoots.filter((candidate) =>
      !expectedRepositoryRoots.some((expected) => samePath(candidate, expected))),
    ...discovery.permittedNonRepositoryEntries.filter((candidate) =>
      !allowedNonRepositoryEntries.has(pathIdentity(candidate))),
    ...discovery.exemptNonSourceStorageRoots.filter((candidate) =>
      !expectedExemptRoots.has(pathIdentity(candidate))),
    ...discovery.legacyArchiveRoots.filter((candidate) =>
      !samePath(candidate, path.join(root,
        canonicalEcosystemLegacyArchiveName))),
    ...discovery.nonEmptyLegacyArchiveRoots.filter((candidate) =>
      !samePath(candidate, path.join(root,
        canonicalEcosystemLegacyArchiveName)))
  ];
  const actualExemptRoots = new Set(discovery.exemptNonSourceStorageRoots.map(
    pathIdentity));
  for (const candidate of discovery.permittedNonRepositoryEntries) {
    const identity = pathIdentity(candidate);
    if (expectedExemptRoots.has(identity) && !actualExemptRoots.has(identity)) {
      invalidBindings.push(candidate);
    }
  }
  for (const candidate of discovery.exemptNonSourceStorageRoots) {
    if (!permittedNonRepositoryIdentities.has(pathIdentity(candidate))) {
      invalidBindings.push(candidate);
    }
  }
  if (invalidBindings.length !== 0) {
    fail("source_authority_discovery_invalid",
      invalidBindings.sort((left, right) => left.localeCompare(right)).join(" | "));
  }
  if (discovery.unreadable.length !== 0) {
    fail("source_authority_scan_incomplete", discovery.unreadable.map(
      (candidate) => `unreadable:${candidate}`).join(" | "));
  }
  if (discovery.nonCanonicalEntries.length !== 0) {
    fail("source_authority_scan_incomplete", discovery.nonCanonicalEntries.map(
      (candidate) => `noncanonical:${candidate}`).join(" | "));
  }
  if (discovery.nonPlainEntries.length !== 0) {
    fail("source_authority_ecosystem_direct_child_invalid",
      discovery.nonPlainEntries.map((candidate) =>
        `non_plain:${candidate}`).join(" | "));
  }
  if (discovery.nonEmptyLegacyArchiveRoots.length !== 0) {
    fail("source_authority_ecosystem_legacy_archive_nonempty",
      discovery.nonEmptyLegacyArchiveRoots.join(" | "));
  }
  if (discovery.unexpectedEntries.length !== 0) {
    fail("source_authority_ecosystem_direct_child_unexpected",
      discovery.unexpectedEntries.join(" | "));
  }
  if (discovery.missingRepositoryRoots.length !== 0 ||
      missingRepositories.length !== 0) {
    fail("source_authority_ecosystem_repository_missing", [
      ...new Set([
        ...discovery.missingRepositoryRoots,
        ...missingRepositories
      ])
    ].sort((left, right) => left.localeCompare(right)).join(" | "));
  }
}

function verifyCanonicalEcosystemRepositories(options) {
  if (!directStat(canonicalEcosystemRoot, "directory")) {
    fail("source_authority_ecosystem_root_invalid", canonicalEcosystemRoot);
  }
  for (const profile of ecosystemRepositories) {
    if (!samePath(path.dirname(profile.root), canonicalEcosystemRoot) ||
        !directStat(profile.root, "directory") ||
        !directStat(path.join(profile.root, ".git"), "directory") ||
        !directStat(path.join(profile.root, "workspace.uai"), "file") ||
        !directStat(path.join(profile.root, ".uai", "taboo.uai"), "file")) {
      fail("source_authority_ecosystem_repository_invalid", profile.root);
    }
    const workspace = readBoundedText(path.join(profile.root, "workspace.uai"));
    if (!workspace.includes(profile.workspaceProfile)) {
      fail("source_authority_ecosystem_workspace_invalid", profile.root);
    }
    verifyGitIdentity(profile.root, {
      gitOutput: options.gitOutput,
      requireClean: options.requireClean === true,
      requireRemoteExact: options.requireRemoteExact === true,
      requiredBranch: profile.branch,
      requiredOrigin: profile.origin
    });
  }
}

// Recognizes archive bytes even when a private-evidence filename is disguised.
function hasArchiveContainerBytes(content) {
  if (!Buffer.isBuffer(content)) return false;
  const starts = (bytes) => content.length >= bytes.length &&
    bytes.every((value, index) => content[index] === value);
  return starts([0x50, 0x4b, 0x03, 0x04]) ||
    starts([0x50, 0x4b, 0x05, 0x06]) ||
    starts([0x50, 0x4b, 0x07, 0x08]) || starts([0x1f, 0x8b]) ||
    starts([0x42, 0x5a, 0x68]) ||
    starts([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]) ||
    starts([0x28, 0xb5, 0x2f, 0xfd]) ||
    starts([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]) ||
    starts([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07]) ||
    starts([0x4d, 0x53, 0x43, 0x46]) ||
    content.subarray(0, 16).toString("ascii").startsWith("# v2 git bundle") ||
    content.subarray(257, 262).toString("ascii") === "ustar";
}

// Recognizes executable containers and script entrypoints by leading bytes.
function hasExecutableMagic(content) {
  if (!Buffer.isBuffer(content)) return false;
  const starts = (bytes) => content.length >= bytes.length &&
    bytes.every((value, index) => content[index] === value);
  return starts([0x4d, 0x5a]) || starts([0x7f, 0x45, 0x4c, 0x46]) ||
    starts([0x00, 0x61, 0x73, 0x6d]) || starts([0x23, 0x21]) ||
    starts([0xfe, 0xed, 0xfa, 0xce]) ||
    starts([0xfe, 0xed, 0xfa, 0xcf]) ||
    starts([0xce, 0xfa, 0xed, 0xfe]) ||
    starts([0xcf, 0xfa, 0xed, 0xfe]) ||
    starts([0xca, 0xfe, 0xba, 0xbe]) ||
    starts([0xbe, 0xba, 0xfe, 0xca]) ||
    starts([0xca, 0xfe, 0xba, 0xbf]) ||
    starts([0xbf, 0xba, 0xfe, 0xca]);
}

// Hashes a direct-child name without retaining or returning that name.
function evidenceContainerDirectChildIdentity(name) {
  if (!isCanonicalPathSegment(name) || Buffer.byteLength(name, "utf8") > 512) {
    fail("source_authority_evidence_container_profile_invalid");
  }
  const normalized = name.normalize("NFC").toLowerCase();
  return `sha256:${crypto.createHash("sha256")
    .update(normalized, "utf8").digest("hex")}`;
}

function validateBoundedEvidenceContainerProfile(profile) {
  const keys = ["allowedDirectChildIdentities", "maximumDepth",
    "maximumDirectories", "maximumFileBytes", "maximumFiles",
    "maximumTotalBytes", "root"];
  const identities = profile?.allowedDirectChildIdentities;
  const boundedInteger = (value, minimum, maximum) =>
    Number.isSafeInteger(value) && value >= minimum && value <= maximum;
  if (!hasExactKeys(profile, keys) || typeof profile.root !== "string" ||
      !path.isAbsolute(profile.root) || !hasCanonicalPathSegments(profile.root) ||
      !Array.isArray(identities) || identities.length === 0 ||
      identities.length > evidenceContainerHardLimits.maximumDirectChildren ||
      identities.some((identity) =>
        !/^sha256:[a-f0-9]{64}$/u.test(identity)) ||
      new Set(identities).size !== identities.length ||
      !boundedInteger(profile.maximumDepth, 1,
        evidenceContainerHardLimits.maximumDepth) ||
      !boundedInteger(profile.maximumDirectories, 0,
        evidenceContainerHardLimits.maximumDirectories) ||
      !boundedInteger(profile.maximumFiles, 1,
        evidenceContainerHardLimits.maximumFiles) ||
      !boundedInteger(profile.maximumFileBytes, 1,
        evidenceContainerHardLimits.maximumFileBytes) ||
      !boundedInteger(profile.maximumTotalBytes, 1,
        evidenceContainerHardLimits.maximumTotalBytes) ||
      profile.maximumFileBytes > profile.maximumTotalBytes) {
    fail("source_authority_evidence_container_profile_invalid");
  }
}

function evidenceClassificationText(text, extension) {
  if (extension !== ".md" && extension !== ".markdown") return text;
  const outside = [];
  let fenced = false;
  let balanced = true;
  for (const line of text.replaceAll("\r\n", "\n").split("\n")) {
    if (/^\s*(?:```|~~~)/u.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (!fenced) outside.push(line);
  }
  if (fenced) balanced = false;
  const prose = outside.join("\n");
  return balanced && prose.replace(/\s+/gu, " ").trim().length >= 128
    ? prose
    : text;
}

function looksLikeCopiedSource(text) {
  const lines = text.replaceAll("\r\n", "\n").split("\n")
    .map((line) => line.trim()).filter(Boolean);
  if (lines.length < 8) return false;
  const codeLineCount = lines.filter((line) =>
    /[{};]$/u.test(line) || /^(?:class|def|enum|fn|function|impl|import|let|mod|namespace|pub|struct|trait|use|using)\b/u
      .test(line)).length;
  if (codeLineCount < Math.ceil(lines.length / 2)) return false;
  const families = [
    [/^(?:pub\s+)?(?:async\s+)?fn\s+[A-Za-z_][A-Za-z0-9_]*\s*\(/mu,
      /^(?:use|mod|impl|struct|enum|trait)\s+/mu,
      /(?:^|\n)\s*(?:let|const)\s+(?:mut\s+)?[A-Za-z_]/mu],
    [/^(?:const|let|var|function|class)\s+/mu,
      /\b(?:import|export)\b|require\s*\(|module\.exports/u,
      /=>|function\s*\(|class\s+[A-Za-z_]/u],
    [/^using\s+(?:System|[A-Za-z_][A-Za-z0-9_.]+);/mu,
      /\b(?:namespace|class|record|struct|interface)\s+[A-Za-z_]/u,
      /\b(?:public|private|internal|protected)\s+/u],
    [/^(?:from\s+\S+\s+import|import\s+\S+)/mu,
      /^(?:async\s+)?def\s+[A-Za-z_][A-Za-z0-9_]*\s*\(/mu,
      /^(?:class\s+[A-Za-z_]|if\s+__name__\s*==)/mu],
    [/<html(?:\s|>)/iu, /<body(?:\s|>)/iu, /<script(?:\s|>)/iu]
  ];
  return families.some((patterns) => patterns.every((pattern) =>
    pattern.test(text)));
}

// Returns only a generic rejection class; it never returns evidence text.
function forbiddenEvidenceTextClass(content, extension) {
  if (!Buffer.isBuffer(content) || content.includes(0)) return null;
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(content);
  } catch (_error) {
    return null;
  }
  const classified = evidenceClassificationText(text, extension);
  const normalized = classified.replaceAll("\r\n", "\n");
  if (/^gitdir:\s*\S+/imu.test(normalized) ||
      (/^\[core\]\s*$/imu.test(normalized) &&
        /^\s*repositoryformatversion\s*=\s*\d+/imu.test(normalized)) ||
      (/^\[remote\s+"[^"]+"\]\s*$/imu.test(normalized) &&
        /^\s*url\s*=\s*\S+/imu.test(normalized))) return "git";
  if ((/^profile:\s*[^\r\n]+\.workspace\.(?:current\.)?v\d+\s*$/imu
    .test(normalized) && /^(?:authoritative_worktree|ecosystem_source_root_prohibitions):\s*$/imu
    .test(normalized)) ||
      (/^authoritative_worktree:\s*$/imu.test(normalized) &&
        /^\s*root:\s*\S+/imu.test(normalized))) return "authority";
  if ((/^\[package\]\s*$/imu.test(normalized) &&
        /^\s*name\s*=\s*["'][^"']+["']\s*$/imu.test(normalized) &&
        /^\[(?:dependencies|workspace)\]\s*$/imu.test(normalized)) ||
      (/^Microsoft Visual Studio Solution File/iu.test(normalized) &&
        /^Project\("\{[A-F0-9-]+\}"\)\s*=/imu.test(normalized)) ||
      (/^\s*jobs:\s*$/imu.test(normalized) &&
        /^\s*runs-on:\s*\S+/imu.test(normalized) &&
        /^\s*steps:\s*$/imu.test(normalized))) return "config";
  try {
    const document = JSON.parse(normalized);
    if (document && typeof document === "object" && !Array.isArray(document) &&
        typeof document.name === "string") {
      const packageSignals = ["scripts", "dependencies", "devDependencies",
        "workspaces", "packageManager"].filter((key) =>
        Object.hasOwn(document, key));
      if (packageSignals.length >= 2) return "config";
    }
  } catch (_error) {
    // Non-JSON evidence remains eligible for the other bounded classifiers.
  }
  return looksLikeCopiedSource(normalized) ? "source" : null;
}

function isExecutableEvidenceName(name) {
  const lower = name.toLowerCase();
  return [".dll", ".dylib", ".jar", ".so", ".wasm"].some((suffix) =>
    lower.endsWith(suffix)) || sourceAuthorityEntrypointSuffixes.some(
    (suffix) => lower.endsWith(suffix));
}

// Validates externally selected evidence without projecting its path or shape.
function verifyBoundedEvidenceContainer(profile, options = {}) {
  validateBoundedEvidenceContainerProfile(profile);
  const fileSystem = options.fileSystem || fs;
  const realpathNative = fileSystem?.realpathSync?.native;
  if (typeof fileSystem?.lstatSync !== "function" ||
      typeof fileSystem?.readdirSync !== "function" ||
      typeof fileSystem?.readFileSync !== "function" ||
      typeof realpathNative !== "function") {
    fail("source_authority_evidence_container_profile_invalid");
  }
  const scanFailure = (detail) =>
    fail("source_authority_evidence_container_scan_incomplete", detail);
  const forbidden = (detail) =>
    fail("source_authority_evidence_container_forbidden_content", detail);
  const bounded = (detail) =>
    fail("source_authority_evidence_container_bounds_exceeded", detail);
  const directChildFailure = (detail) =>
    fail("source_authority_evidence_container_direct_child_invalid", detail);
  const guarded = (operation, detail) => {
    try {
      return operation();
    } catch (error) {
      if (typeof error?.code === "string" &&
          error.code.startsWith("source_authority_evidence_container_")) {
        throw error;
      }
      return scanFailure(detail);
    }
  };
  const ordinal = (left, right) => left < right ? -1 : left > right ? 1 : 0;
  const root = path.resolve(profile.root);
  const allowedDirectChildren = new Set(profile.allowedDirectChildIdentities);
  const observedDirectChildren = new Set();
  let directoryCount = 0;
  let fileCount = 0;
  let totalBytes = 0;

  function requireDirectNode(candidate, expectedType, observedStat) {
    const stat = observedStat || guarded(() => fileSystem.lstatSync(candidate),
      "unreadable_entry");
    if (stat.isSymbolicLink()) scanFailure("reparse");
    if ((expectedType === "directory" && !stat.isDirectory()) ||
        (expectedType === "file" && !stat.isFile())) {
      scanFailure("non_regular_entry");
    }
    const physical = guarded(() => realpathNative(candidate),
      "unreadable_identity");
    if (!samePath(physical, candidate)) scanFailure("reparse");
    return stat;
  }

  function inspectFile(candidate, observedStat) {
    const before = requireDirectNode(candidate, "file", observedStat);
    if (!Number.isSafeInteger(before.size) || before.size < 0) {
      scanFailure("invalid_file_size");
    }
    fileCount += 1;
    if (fileCount > profile.maximumFiles) bounded("file_count");
    if (before.size > profile.maximumFileBytes ||
        before.size > profile.maximumTotalBytes - totalBytes) {
      bounded("bytes");
    }
    const content = guarded(() => fileSystem.readFileSync(candidate),
      "unreadable_file");
    const after = guarded(() => fileSystem.lstatSync(candidate),
      "unreadable_file");
    if (!Buffer.isBuffer(content) || content.length !== before.size ||
        !after.isFile() || after.isSymbolicLink() ||
        !sameFileObservation(before, after) ||
        !samePath(guarded(() => realpathNative(candidate),
          "unreadable_identity"), candidate)) {
      scanFailure("unstable_file");
    }
    if (hasArchiveContainerBytes(content)) forbidden("archive");
    if (hasExecutableMagic(content)) forbidden("executable");
    const textClass = forbiddenEvidenceTextClass(content,
      path.extname(candidate).toLowerCase());
    if (textClass) forbidden(textClass);
    totalBytes += content.length;
  }

  function inspectDirectory(directory, depth, observedStat) {
    const before = requireDirectNode(directory, "directory", observedStat);
    const entries = guarded(() => fileSystem.readdirSync(directory, {
      withFileTypes: true
    }), "unreadable_directory");
    if (!Array.isArray(entries)) scanFailure("unreadable_directory");
    if (entries.length > profile.maximumDirectories + profile.maximumFiles) {
      bounded("entry_count");
    }
    const names = new Set();
    const accepted = [];
    for (const entry of entries) {
      if (!entry || typeof entry.name !== "string" ||
          !isCanonicalPathSegment(entry.name) ||
          Buffer.byteLength(entry.name, "utf8") > 512) {
        scanFailure("noncanonical_entry");
      }
      const identity = entry.name.normalize("NFC").toLowerCase();
      if (names.has(identity)) scanFailure("noncanonical_entry");
      names.add(identity);
      if (depth === 0) {
        const directIdentity = evidenceContainerDirectChildIdentity(entry.name);
        if (!allowedDirectChildren.has(directIdentity)) {
          directChildFailure("unexpected");
        }
        observedDirectChildren.add(directIdentity);
      }
      accepted.push(entry);
    }
    accepted.sort((left, right) => ordinal(left.name, right.name));
    for (const entry of accepted) {
      const child = path.join(directory, entry.name);
      const childDepth = depth + 1;
      if (childDepth > profile.maximumDepth) bounded("depth");
      if (isSourceArchiveName(entry.name)) forbidden("archive");
      if (isExecutableEvidenceName(entry.name)) forbidden("executable");
      if (isSourceAuthorityShapedPath(child, root)) forbidden("source_authority");
      const childStat = guarded(() => fileSystem.lstatSync(child),
        "unreadable_entry");
      if (childStat.isSymbolicLink()) scanFailure("reparse");
      if (childStat.isDirectory()) {
        directoryCount += 1;
        if (directoryCount > profile.maximumDirectories) {
          bounded("directory_count");
        }
        inspectDirectory(child, childDepth, childStat);
      } else if (childStat.isFile()) {
        inspectFile(child, childStat);
      } else {
        scanFailure("non_regular_entry");
      }
    }
    const after = guarded(() => fileSystem.lstatSync(directory),
      "unreadable_directory");
    if (!after.isDirectory() || after.isSymbolicLink() ||
        !sameFileObservation(before, after) ||
        !samePath(guarded(() => realpathNative(directory),
          "unreadable_identity"), directory)) {
      scanFailure("unstable_directory");
    }
  }

  inspectDirectory(root, 0);
  if (observedDirectChildren.size !== allowedDirectChildren.size ||
      [...allowedDirectChildren].some((identity) =>
        !observedDirectChildren.has(identity))) {
    directChildFailure("missing");
  }
  return Object.freeze({ verdict: "pass" });
}

function verifyEvidenceOnlyRoot(profile) {
  if (!pathExists(profile.root)) return;
  if (!directStat(profile.root, "directory")) {
    fail("source_authority_evidence_root_invalid", profile.root);
  }
  let entries;
  try {
    entries = fs.readdirSync(profile.root, { withFileTypes: true });
  } catch (_error) {
    fail("source_authority_evidence_root_invalid", profile.root);
  }
  const allowed = new Set(profile.allowedEntries);
  const unexpected = entries.filter((entry) => !allowed.has(entry.name));
  if (unexpected.length !== 0) {
    fail("source_authority_evidence_contains_source",
      unexpected.map((entry) => path.join(profile.root, entry.name)).join(" | "));
  }
  for (const required of profile.requiredDirectories) {
    const entry = entries.find((candidate) => candidate.name === required);
    if (!entry || !entry.isDirectory() || entry.isSymbolicLink()) {
      fail("source_authority_evidence_root_invalid",
        path.join(profile.root, required));
    }
  }
}

function evidenceContainerProfilesForVerification(options = {}) {
  const profiles = Object.hasOwn(options, "evidenceContainerProfiles")
    ? options.evidenceContainerProfiles
    : registeredEvidenceContainerProfiles;
  if (!Array.isArray(profiles) ||
      profiles.length > evidenceContainerHardLimits.maximumContainers) {
    fail("source_authority_evidence_container_profile_invalid");
  }
  return profiles;
}

function verifySingleSourceAuthority(options = {}) {
  const root = path.resolve(options.repositoryRoot || repositoryRoot);
  if (!isDirectSourceRoot(root)) {
    fail("source_authority_repository_root_invalid", root);
  }

  const runtimePlatform = options.platform || process.platform;
  const requireCanonicalLayout = options.requireCanonicalLayout !== false;
  const localWorkspaceAvailable = runtimePlatform === "win32" &&
    (options.localWorkspaceAvailable === undefined
      ? directStat(localWorkspaceRoot, "directory")
      : options.localWorkspaceAvailable === true);
  const localScanPerformed = localWorkspaceAvailable;
  if (!localScanPerformed) {
    if (requireCanonicalLayout) {
      fail("source_authority_canonical_layout_unavailable", localWorkspaceRoot);
    }
    return Object.freeze({
      canonicalLayoutAvailable: false,
      canonicalEcosystemRoot,
      canonicalRoots: Object.freeze(ecosystemRepositories.map((profile) => profile.root)),
      canonicalRoot,
      coverageClass: "registered-governed-roots-only",
      discoveredEcosystemRoots: Object.freeze([]),
      discoveredRoots: Object.freeze([]),
      discoveredSourceArchives: Object.freeze([]),
      exemptNonSourceStorageRoots: Object.freeze([]),
      governedExternalSourceRoots: Object.freeze(
        governedExternalSourceScopes.map((scope) => scope.root)),
      localScanPerformed,
      permittedBinaryReleaseEvidenceArchives: Object.freeze([]),
      wholeVolumeInventoryPerformed: false,
      unreadableRoots: Object.freeze([]),
      verdict: "not-performed"
    });
  }

  if (!samePath(root, canonicalRoot) || !directStat(canonicalRoot, "directory")) {
    fail("source_authority_canonical_root_invalid", root);
  }
  const discoverRootEntries =
    options.discoverCanonicalEcosystemRootEntries ||
    discoverCanonicalEcosystemRootEntries;
  if (typeof discoverRootEntries !== "function") {
    fail("source_authority_discovery_invalid");
  }
  const rootEntryDiscovery = discoverRootEntries();
  verifyCanonicalEcosystemRootEntryDiscovery(rootEntryDiscovery);
  verifyCanonicalEcosystemWorkspacePolicy();
  verifyCanonicalEcosystemRepositories(options);
  const policyVerification = verifyEcosystemSourceRootPolicyParity();
  const binaryArchiveClassificationCache = new Map();
  const classifyBinaryReleaseArchive = (candidate) => {
    const identity = pathIdentity(candidate);
    if (binaryArchiveClassificationCache.has(identity)) {
      return binaryArchiveClassificationCache.get(identity);
    }
    const verdict = classifyRegisteredBinaryReleaseArchive(candidate);
    binaryArchiveClassificationCache.set(identity, verdict);
    return verdict;
  };
  const discoverAuthorityFiles = options.discoverEcosystemAuthorityFiles ||
    (() => discoverEcosystemAuthorityFiles(ecosystemAuthorityScanScopes, {
      classifyBinaryReleaseArchive
    }));
  if (typeof discoverAuthorityFiles !== "function") {
    fail("source_authority_discovery_invalid");
  }
  const authorityFileDiscovery = discoverAuthorityFiles();
  verifyEcosystemAuthorityFileDiscovery(authorityFileDiscovery);
  const directExemptIdentities = new Set(
    rootEntryDiscovery.exemptNonSourceStorageRoots.map(pathIdentity));
  const deepExemptIdentities = new Set(
    authorityFileDiscovery.exemptNonSourceStorageRoots.map(pathIdentity));
  if (directExemptIdentities.size !== deepExemptIdentities.size ||
      [...directExemptIdentities].some((identity) =>
        !deepExemptIdentities.has(identity))) {
    fail("source_authority_discovery_invalid",
      "exempt_non_source_storage_mismatch");
  }

  verifyForbiddenPathAbsence([
    ...supersededSourceRoots,
    ...supersededEcosystemSourceRoots
  ], "source_authority_superseded_root_present");
  verifyForbiddenPathAbsence(supersededLooseSourceFiles,
    "source_authority_superseded_file_present");
  verifyForbiddenPathAbsence(supersededSourceArchives,
    "source_authority_superseded_archive_present");
  for (const profile of evidenceOnlyRoots) verifyEvidenceOnlyRoot(profile);
  const evidenceContainerProfiles =
    evidenceContainerProfilesForVerification(options);
  for (const profile of evidenceContainerProfiles) {
    verifyBoundedEvidenceContainer(profile, {
      fileSystem: options.evidenceContainerFileSystem || fs
    });
  }

  const discoverLocal = options.discoverLocalSourceRoots ||
    discoverLocalSourceRoots;
  const discoverEcosystem = options.discoverEcosystemSourceRoots ||
    discoverEcosystemSourceRoots;
  const discoverArchives = options.discoverSourceArchives ||
    (() => discoverSourceArchives(sourceArchiveScanScopes, {
      classifyBinaryReleaseArchive
    }));
  if (typeof discoverLocal !== "function" ||
      typeof discoverEcosystem !== "function" ||
      typeof discoverArchives !== "function") {
    fail("source_authority_discovery_invalid");
  }
  const discovery = discoverLocal();
  const ecosystemDiscovery = discoverEcosystem();
  const archiveDiscovery = discoverArchives();
  verifyDiscovery(discovery);
  verifyEcosystemDiscovery(ecosystemDiscovery);
  verifySourceArchiveDiscovery(archiveDiscovery);
  const authorityBinaryArchives = new Set(
    authorityFileDiscovery.permittedBinaryReleaseArchives.map(pathIdentity));
  const archiveBinaryArchives = new Set(
    archiveDiscovery.permittedBinaryReleaseArchives.map(pathIdentity));
  if (authorityBinaryArchives.size !== archiveBinaryArchives.size ||
      [...authorityBinaryArchives].some((identity) =>
        !archiveBinaryArchives.has(identity))) {
    fail("source_authority_discovery_invalid",
      "binary_release_evidence_mismatch");
  }
  return Object.freeze({
    canonicalLayoutAvailable: true,
    canonicalEcosystemRoot,
    canonicalRoots: Object.freeze(ecosystemRepositories.map((profile) => profile.root)),
    canonicalRoot,
    coverageClass: "registered-governed-roots-only",
    discoveredEcosystemRoots: ecosystemDiscovery.roots,
    discoveredRoots: discovery.roots,
    discoveredSourceArchives: archiveDiscovery.archives,
    exemptNonSourceStorageRoots:
      rootEntryDiscovery.exemptNonSourceStorageRoots,
    governedExternalSourceRoots: Object.freeze(
      governedExternalSourceScopes.map((scope) => scope.root)),
    localScanPerformed,
    permittedBinaryReleaseEvidenceArchives:
      archiveDiscovery.permittedBinaryReleaseArchives,
    policyPaths: policyVerification.policyPaths,
    unreadableRoots: Object.freeze([
      ...new Set([
        ...discovery.unreadable,
        ...ecosystemDiscovery.unreadable,
        ...archiveDiscovery.unreadable
      ])
    ].sort((left, right) => left.localeCompare(right))),
    wholeVolumeInventoryPerformed: false,
    verdict: "pass"
  });
}

// Keeps CLI output useful while withholding scanned filesystem identities.
function authorityResultForStdout(result) {
  if (!result || typeof result !== "object" ||
      typeof result.canonicalLayoutAvailable !== "boolean" ||
      typeof result.coverageClass !== "string" ||
      typeof result.localScanPerformed !== "boolean" ||
      typeof result.wholeVolumeInventoryPerformed !== "boolean" ||
      !["not-performed", "pass"].includes(result.verdict)) {
    fail("source_authority_result_invalid");
  }
  return Object.freeze({
    canonicalLayoutAvailable: result.canonicalLayoutAvailable,
    coverageClass: result.coverageClass,
    localScanPerformed: result.localScanPerformed,
    verdict: result.verdict,
    wholeVolumeInventoryPerformed: result.wholeVolumeInventoryPerformed
  });
}

function cliVerificationOptions(arguments_) {
  const allowed = new Set(["--require-clean", "--require-remote-exact"]);
  if (!Array.isArray(arguments_) ||
      arguments_.some((argument) => !allowed.has(argument)) ||
      new Set(arguments_).size !== arguments_.length) {
    fail("source_authority_arguments_invalid");
  }
  return Object.freeze({
    requireCanonicalLayout: true,
    requireClean: arguments_.includes("--require-clean"),
    requireRemoteExact: arguments_.includes("--require-remote-exact")
  });
}

function main() {
  const result = verifySingleSourceAuthority(
    cliVerificationOptions(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(authorityResultForStdout(result))}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error?.code || "source_authority_failed"}\n`);
    if (error?.detail) process.stderr.write(`${error.detail}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  allSourceReviewBundleName,
  artifactReparsePolicy,
  authorityResultForStdout,
  evidenceContainerDirectChildIdentity,
  evidenceContainerHardLimits,
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
  discoverMarkedSourceRoots,
  discoverEcosystemSourceRoots,
  discoverLocalSourceRoots,
  discoverSourceArchives,
  evidenceContainerProfilesForVerification,
  effectiveScanScopes,
  ecosystemAuthorityMaximumDepth,
  ecosystemAuthorityScanScopes,
  ecosystemRepositories,
  evidenceOnlyRoots,
  externalBinaryReleaseEvidenceRoot,
  governedExternalSourceScopes,
  hasArchiveContainerMagic,
  hasCanonicalPathSegments,
  isDirectSourceRoot,
  isEcosystemSourceMarkedRoot,
  isLooseSourceAuthorityEntry,
  isTinyRustLmGitEntrypoint,
  isSourceMarkedRoot,
  isSourceArchiveName,
  isCanonicalPathSegment,
  localWorkspaceRoot,
  readBoundedText,
  registeredBinaryReleaseArchiveProfiles,
  registeredBinaryReleaseEvidenceRoot,
  registeredBinaryNugetEvidenceRoot,
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
  verifySourceArchiveDiscovery,
  extractEcosystemSourceRootPolicyBlock,
  extractSingleTinyRustLmSourcePolicyBlock
});
