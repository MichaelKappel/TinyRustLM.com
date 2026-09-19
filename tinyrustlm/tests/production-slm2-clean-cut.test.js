"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const registration = JSON.parse(fs.readFileSync(path.join(
  repositoryRoot,
  "contracts/vnext/production-slm2-clean-cut-preregistration.v1.json"
), "utf8"));
const browserArtifact =
  "tinyrustlm/browser-runtime/tinyrustlm-browser-runtime.wasm";
const browserManifest = `${browserArtifact}.manifest.json`;
const additionalDeletedPaths = Object.freeze([
  "tinyrustlm/tools/browser_harness",
  "tinyrustlm/tools/converted-once-p2p-smoke.js",
  "tinyrustlm/tools/model-qualification-runner.js",
  "tinyrustlm/tools/wasm-abi-smoke.js"
]);
const activeRoots = Object.freeze([
  "rust/crates",
  "tinyrustlm/app",
  "tinyrustlm/tools",
  "dotnet/src",
  "eng",
  "tools/vs"
]);
const activeRootFiles = Object.freeze([
  "Cargo.toml",
  "TinyRustLM.vcxproj",
  "TinyRustLM.vcxproj.filters",
  "tinyrustlm/package.json"
]);
const sourceFilePattern =
  /(?:Cargo\.toml|\.cjs|\.cs|\.csproj|\.filters|\.html|\.js|\.json|\.mjs|\.ps1|\.rs|\.sh|\.vcxproj)$/u;
const visualStudioProjectClosure = Object.freeze([
  "TinyRustLM.vcxproj",
  "dotnet/samples/TinyRustLM.ConsoleSample/TinyRustLM.ConsoleSample.csproj",
  "dotnet/samples/TinyRustLM.P2PShareSample/TinyRustLM.P2PShareSample.csproj",
  "dotnet/src/TinyRustLM.Abstractions/TinyRustLM.Abstractions.csproj",
  "dotnet/src/TinyRustLM.Companion/TinyRustLM.Companion.csproj",
  "dotnet/src/TinyRustLM.Conversion/TinyRustLM.Conversion.csproj",
  "dotnet/src/TinyRustLM.Core/TinyRustLM.Core.csproj",
  "dotnet/src/TinyRustLM.MemoryEndpoints/TinyRustLM.MemoryEndpoints.csproj",
  "dotnet/src/TinyRustLM.P2P/TinyRustLM.P2P.csproj",
  "dotnet/tests/TinyRustLM.Companion.Tests/TinyRustLM.Companion.Tests.csproj",
  "dotnet/tests/TinyRustLM.Core.Tests/TinyRustLM.Core.Tests.csproj",
  "dotnet/tests/TinyRustLM.Package.Tests/TinyRustLM.Package.Tests.csproj",
  "dotnet/tools/TinyRustLM.CompanionHost/TinyRustLM.CompanionHost.csproj",
  "dotnet/tools/TinyRustLM.CompositionInspector/TinyRustLM.CompositionInspector.csproj",
  "dotnet/tools/TinyRustLM.ConversionFixtureTool/TinyRustLM.ConversionFixtureTool.csproj",
  "dotnet/tools/TinyRustLM.PackageCanonicalizer/TinyRustLM.PackageCanonicalizer.csproj"
]);
const enterpriseMemory = Object.freeze({
  relativePath:
    "wiki/runtime-mirust/reports/" +
    "tinyrustlm-enterprise-intake-and-production-runtime-clean-cut-memory-2026-08-28.md",
  byteLength: 22885,
  sha256: "08ca32bf0bb8aeefc54921baf00f3ed55f3d9f977e00e9a8bc93095fe48093fd",
  owners: Object.freeze([
    "workspace.uai",
    ".uai/architecture.uai",
    ".uai/coding-standards.uai",
    ".uai/file-handoff.uai",
    ".uai/index.uai",
    ".uai/intake-outcome-ledger.uai",
    ".uai/long-term-memory.uai",
    ".uai/memory-endpoints-coordination.uai",
    ".uai/next-recursive-prompt.uai",
    ".uai/operations.uai",
    ".uai/receiver-brief.uai",
    ".uai/report-synthesis.uai",
    ".uai/short-term-memory.uai",
    ".uai/startup-packet.uai",
    ".uai/taboo.uai",
    ".uai/test-plan.uai",
    ".uai/totem.uai",
    ".uai/workspace-guidance.uai"
  ])
});

function absolute(relativePath) {
  return path.join(repositoryRoot, ...relativePath.split("/"));
}

function directFile(relativePath) {
  const filePath = absolute(relativePath);
  const stat = fs.lstatSync(filePath);
  assert.equal(stat.isFile(), true, relativePath);
  assert.equal(stat.isSymbolicLink(), false, relativePath);
  assert.equal(fs.realpathSync.native(filePath), path.resolve(filePath), relativePath);
  return fs.readFileSync(filePath);
}

function sourceFiles(relativeRoot) {
  const root = absolute(relativeRoot);
  const files = [];
  const visit = (directory) => {
    const stat = fs.lstatSync(directory);
    assert.equal(stat.isDirectory(), true, directory);
    assert.equal(stat.isSymbolicLink(), false, directory);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "target") continue;
      const entryPath = path.join(directory, entry.name);
      assert.equal(entry.isSymbolicLink(), false, entryPath);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile() && sourceFilePattern.test(entry.name)) files.push(entryPath);
    }
  };
  visit(root);
  return files;
}

test("keeps every registered obsolete executable path physically absent", () => {
  assert.equal(registration.schema,
    "tinyrustlm.production-slm2-clean-cut-preregistration.v1");
  const deleted = [
    ...registration.obsoleteExecutableClosure.deleteCompletely,
    ...additionalDeletedPaths
  ];
  assert.equal(new Set(deleted).size, deleted.length);
  for (const relativePath of deleted) {
    assert.equal(fs.existsSync(absolute(relativePath)), false, relativePath);
  }
});

test("keeps active executable source free of every superseded token", () => {
  const forbidden = registration.obsoleteExecutableClosure
    .forbiddenExecutableTokensAfterCutover;
  assert.equal(forbidden.length, 6);
  const files = [
    ...activeRoots.flatMap(sourceFiles),
    ...activeRootFiles.map(absolute)
  ];
  const offenders = [];
  for (const filePath of files) {
    const stat = fs.lstatSync(filePath);
    assert.equal(stat.isFile() && !stat.isSymbolicLink(), true, filePath);
    assert.ok(stat.size <= 4 * 1024 * 1024, filePath);
    const source = fs.readFileSync(filePath, "utf8").toLowerCase();
    for (const token of forbidden) {
      if (source.includes(token.toLowerCase())) {
        offenders.push(`${path.relative(repositoryRoot, filePath)}:${token}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test("publishes and loads only the canonical worker WASM artifact", () => {
  assert.ok(directFile(browserArtifact).length > 0);
  const manifest = JSON.parse(directFile(browserManifest).toString("utf8"));
  assert.equal(manifest.profileId, "tinyrustlm.browser-runtime-wasm/1");
  assert.equal(manifest.workerProtocol, "tinyrustlm.model-runtime-worker/1");
  assert.equal(manifest.sourceCrate, "tinyrustlm-browser-runtime-wasm");

  const deployment = JSON.parse(directFile(
    "tinyrustlm/deploy/web-deployment-manifest.v2.json"
  ).toString("utf8"));
  const published = deployment.publish.map((entry) => entry.local);
  assert.equal(published.filter((entry) =>
    entry === "browser-runtime/tinyrustlm-browser-runtime.wasm").length, 1);
  assert.equal(published.filter((entry) =>
    entry === "browser-runtime/tinyrustlm-browser-runtime.wasm.manifest.json").length, 1);
  assert.equal(published.some((entry) => entry.startsWith("runtime/")), false);

  const appSource = directFile("tinyrustlm/app/app.js").toString("utf8");
  assert.match(appSource,
    /\.\.\/browser-runtime\/tinyrustlm-browser-runtime\.wasm/u);
  assert.doesNotMatch(appSource, /\.\.\/runtime\//u);
});

test("keeps the root Rust workspace on canonical component ownership", () => {
  const manifest = directFile("Cargo.toml").toString("utf8");
  for (const component of registration.canonicalComponentOwnership
    .filter((entry) => entry.path.startsWith("rust/crates/"))) {
    assert.match(manifest,
      new RegExp(component.path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"),
      component.componentId);
  }
  assert.doesNotMatch(manifest, /tinyrustlm\/runtime/u);
  assert.doesNotMatch(manifest, /tinyrustlm-slm(?:"|\s)/u);
  assert.doesNotMatch(manifest, /slm_pack/u);
});

test("keeps the root Visual Studio solution on the exact live project closure", () => {
  const solution = directFile("TinyRustLM.sln").toString("utf8");
  const projects = Array.from(
    solution.matchAll(/^Project\("[^"]+"\) = "[^"]+", "([^"]+\.(?:csproj|vcxproj))"/gmu),
    (match) => match[1].replaceAll("\\", "/")
  ).sort();
  assert.deepEqual(projects, [...visualStudioProjectClosure].sort());
  for (const project of projects) assert.ok(directFile(project).length > 0, project);
  assert.doesNotMatch(solution, /TinyRustLM\.Memory(?:\\|\/)/u);
});

test("keeps maintained product documentation free of superseded runtime terms", () => {
  const maintained = [
    "tinyrustlm/README.md",
    ...fs.readdirSync(absolute("tinyrustlm/docs"), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => `tinyrustlm/docs/${entry.name}`)
  ];
  const forbidden = Object.freeze([
    /\bSLM1\b/iu,
    /\bACG1\b/iu,
    /\btinyrustlm-slm\b/iu,
    /\btinyrustlm-runtime-sdk\b/iu,
    /\bslm_pack\b/iu,
    /browser_harness/iu,
    /\.slm(?!2)\b/iu
  ]);
  const offenders = [];
  for (const relativePath of maintained) {
    const source = directFile(relativePath).toString("utf8");
    for (const pattern of forbidden) {
      if (pattern.test(source)) offenders.push(`${relativePath}:${pattern}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("preserves historical enterprise evidence and routes hot memory through current guidance", () => {
  const bytes = directFile(enterpriseMemory.relativePath);
  assert.equal(bytes.length, enterpriseMemory.byteLength);
  assert.equal(
    crypto.createHash("sha256").update(bytes).digest("hex"),
    enterpriseMemory.sha256
  );
  const currentRoute =
    "wiki/runtime-mirust/reports/tinyrustlm-working-product-memory-2026-09-19.md";
  assert.ok(directFile(currentRoute).toString("utf8").includes(enterpriseMemory.relativePath));
  for (const owner of enterpriseMemory.owners) {
    const source = directFile(owner).toString("utf8");
    assert.ok(source.includes(currentRoute), owner);
    assert.ok(source.includes(
      "wiki/runtime-mirust/reports/" +
      "tinyrustlm-report-intake-decision-index-2026-09-19.md"), owner);
  }

  const manifestRoutes = Array.from(
    bytes.toString("utf8").matchAll(/`(docs\/report-intake\/[^`]+\/MANIFEST\.md)`/gu),
    (match) => match[1]
  );
  assert.equal(new Set(manifestRoutes).size, 23);
  for (const manifestRoute of manifestRoutes) {
    assert.ok(directFile(manifestRoute).length > 0, manifestRoute);
  }
});
