"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const deployment = require("../tools/web-deployment-manifest.js");
const { createOwnedTemporaryDirectory, removeOwnedTemporaryDirectory } =
  require("../tools/canonical-operation-scratch.js");
const { materializeSourceReleaseState } = require("./site-release-test-fixture.js");

const siteRoot = path.resolve(__dirname, "..");
const repositoryRoot = path.dirname(siteRoot);
const ledgerPath = path.join(siteRoot, "release/site-release-ledger.v1.json");
const toolPath = path.join(siteRoot, "tools/web-deployment-manifest.js");
const deploymentScriptPath = path.join(siteRoot, "tools/deploy-tinyrustlm-web.ps1");

/** Own bounded metadata output; no source checkout or executable fixture is created. */
function temporaryRoot(context) {
  const owned = createOwnedTemporaryDirectory({
    temporaryParent: path.join(repositoryRoot, "artifacts/tests/web-deployment-custody")
  });
  context.after(() => {
    removeOwnedTemporaryDirectory(owned);
    assert.equal(fs.existsSync(owned.rootPath), false);
  });
  return owned.rootPath;
}

/** Invoke the canonical read-only binder with bounded captured output. */
function invokeTool(args) {
  return childProcess.spawnSync(process.execPath, [toolPath, ...args, "--json"], {
    cwd: repositoryRoot, encoding: "utf8", windowsHide: true,
    timeout: 30000, maxBuffer: 1024 * 1024
  });
}

test("CLI binds and re-verifies canonical publication inputs without copied payloads", (context) => {
  const { outputRoot } = materializeSourceReleaseState(context, "tinyrustlm-input-cli-");
  const manifestPath = path.join(siteRoot, "deploy/web-deployment-manifest.v2.json");
  const before = fs.readdirSync(outputRoot).sort();
  const bound = invokeTool(["bind-input", siteRoot, manifestPath, outputRoot]);
  assert.equal(bound.status, 0, bound.stderr);
  const input = JSON.parse(bound.stdout);
  assert.equal(input.schema, "tinyrustlm.web_deployment_input.v1");
  assert.equal(input.status, "pass");
  // Current publication: 30 canonical source files and two generated release records.
  assert.equal(input.fileCount, 32);
  assert.equal(input.files.length, input.fileCount);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.deepEqual(input.files.map(({ source, local, remote }) => ({ source, local, remote })),
    manifest.publish.map(({ source, local, remote }) => ({ source, local, remote })));
  for (const addedModule of ["app/operation-lifetime.js", "app/memory-endpoints-http.js"]) {
    assert.ok(input.files.some(({ remote }) => remote === addedModule), addedModule);
  }
  assert.match(input.inputId, /^[0-9a-f]{64}$/u);
  assert.equal(input.files.some((entry) => "filePath" in entry), false);
  const verified = invokeTool(["verify-input", siteRoot, manifestPath, outputRoot, input.inputId]);
  assert.equal(verified.status, 0, verified.stderr);
  assert.deepEqual(JSON.parse(verified.stdout), input);
  const wrong = invokeTool(["verify-input", siteRoot, manifestPath, outputRoot, "0".repeat(64)]);
  assert.equal(wrong.status, 1);
  assert.equal(wrong.stdout, "");
  assert.doesNotMatch(wrong.stderr, /[A-Z]:\\/u);
  assert.deepEqual(fs.readdirSync(outputRoot).sort(), before);
});

test("retired source-copy APIs and commands are absent and cannot create output", (context) => {
  const root = temporaryRoot(context);
  for (const name of ["materializeDeploymentSnapshot", "materializeValidatedDeploymentSnapshot",
    "verifyDeploymentSnapshot", "removeDeploymentSnapshot"]) {
    assert.equal(Object.hasOwn(deployment, name), false, name);
  }
  for (const command of ["snapshot", "verify-snapshot", "remove-snapshot"]) {
    const before = fs.readdirSync(root);
    const result = invokeTool([command, repositoryRoot, root]);
    assert.equal(result.status, 1, command);
    assert.deepEqual(fs.readdirSync(root), before);
  }
});

test("predecessor metadata retains exact historical identity and verified cleanup", (context) => {
  const root = temporaryRoot(context);
  const outputRoot = path.join(root, "tinyrustlm-web-predecessor-" +
    crypto.randomBytes(16).toString("hex"));
  const originalLedger = fs.readFileSync(ledgerPath);
  const result = deployment.materializeExpectedPublicPredecessor({
    repositoryRoot, ledgerPath, outputRoot
  });
  assert.equal(result.predecessorVersion, "0.4.1");
  assert.equal(result.pendingVersion, "0.5.0");
  assert.equal(result.files.length, 2);
  const expectedFiles = result.files.map(({ relativePath, byteCount, sha256 }) =>
    ({ relativePath, byteCount, sha256 }));
  const publicFiles = result.files.map((entry) => JSON.parse(fs.readFileSync(entry.filePath, "utf8")));
  assert.ok(publicFiles.some((value) => value.version === "0.4.1"));
  const wrong = expectedFiles.map((entry, index) =>
    index === 0 ? { ...entry, sha256: "0".repeat(64) } : entry);
  assert.throws(() => deployment.removeExpectedPublicPredecessor({
    repositoryRoot, outputRoot, expectedFiles: wrong
  }), /predecessor/i);
  for (const entry of result.files) assert.equal(fs.existsSync(entry.filePath), true);
  const unexpected = path.join(outputRoot, "unexpected.bin");
  fs.writeFileSync(unexpected, "synthetic sentinel\n", { flag: "wx" });
  assert.throws(() => deployment.removeExpectedPublicPredecessor({
    repositoryRoot, outputRoot, expectedFiles
  }), /inventory|unexpected/i);
  assert.equal(fs.readFileSync(unexpected, "utf8"), "synthetic sentinel\n");
  fs.unlinkSync(unexpected);
  const cleanup = deployment.removeExpectedPublicPredecessor({
    repositoryRoot, outputRoot, expectedFiles
  });
  assert.equal(cleanup.cleanupVerified, true);
  assert.equal(fs.existsSync(outputRoot), false);
  assert.deepEqual(fs.readFileSync(ledgerPath), originalLedger);
});

test("predecessor output rejects wrong repository, ledger and scattered roots before writing", (context) => {
  const root = temporaryRoot(context);
  const outputRoot = path.join(root, "tinyrustlm-web-predecessor-" + "a".repeat(32));
  for (const changes of [
    { repositoryRoot: root },
    { ledgerPath: path.join(root, "ledger.json") },
    { outputRoot: path.join(repositoryRoot, "tinyrustlm-web-predecessor-" + "a".repeat(32)) }
  ]) {
    assert.throws(() => deployment.materializeExpectedPublicPredecessor({
      repositoryRoot, ledgerPath, outputRoot, ...changes
    }), /canonical|artifacts/i);
    assert.equal(fs.existsSync(outputRoot), false);
  }
});

test("publisher keeps source and transport admission ahead of remote writes and marker publication", () => {
  const source = fs.readFileSync(deploymentScriptPath, "utf8");
  const phases = ["deployment-input", "release-ledger-candidate-validation", "terminal-source-custody",
    "transport-contract-admission", "public-predecessor-gate", "credential-profile",
    "host-policy-predeployment", "artifact-publication", "final-precommit-verification",
    "canonical-input-before-release-marker", "release-commit-marker"];
  let previous = -1;
  for (const phase of phases) {
    const position = source.indexOf('$operationPhase = "' + phase + '"', previous + 1);
    assert.ok(position > previous, phase);
    previous = position;
  }
  assert.doesNotMatch(source, /deploymentSnapshot|deploymentInputRoot|GetTempPath|remove-snapshot/u);
  assert.match(source, /Publish-Artifact -DeploymentInputEntry \$publicationPlan\.commit_marker -CommitMarker/u);
  assert.match(source, /finally \{ \$script:regularArtifactsVerifiedForCommit = \$false \}/u);
  const target = source.indexOf("$deploymentTargetEvidence = Assert-DeploymentTargetIdentity");
  const probes = source.indexOf("$script:predeploymentTemporaryRouteEvidence = Test-PredeploymentTemporaryRoutePolicy", target);
  const admission = source.indexOf("$script:artifactPublicationAdmitted = $true", probes);
  const publication = source.indexOf('$operationPhase = "artifact-publication"', admission);
  assert.ok(target >= 0 && probes > target && admission > probes && publication > admission);
  assert.match(source.slice(probes, admission), /authenticated_cleanup_verified -ne \$true/u);
  assert.match(source.slice(probes, admission), /deploymentLease\.handle\.CanRead/u);
  assert.equal((source.match(/\$script:artifactPublicationAdmitted = \$true/gu) || []).length, 1);
  const marker = source.indexOf("Publish-Artifact -DeploymentInputEntry $publicationPlan.commit_marker -CommitMarker");
  assert.ok(marker > publication);
  assert.doesNotMatch(source.slice(marker), /\n\s*(?:Publish-Artifact|Remove-PublicArtifact|Remove-RetiredModelDirectory|Ensure-RemoteDirectory)\b/u);
  assert.match(source, /marker_was_last_remote_mutation = \$false/u);
  assert.doesNotMatch(source, /atomic_ftps_deployment|deployment_transport_capability\.v1/u);
  assert.match(source, /local_input_cleanup_required = \$false/u);
  assert.match(source, /source_copy_created = \$false/u);
});
