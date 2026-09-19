"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const deploymentScriptPath = path.resolve(
  __dirname,
  "..",
  "tools",
  "deploy-tinyrustlm-web.ps1"
);

test("deployment orchestrator requires fresh readback and immutable attempt evidence", () => {
  const source = fs.readFileSync(deploymentScriptPath, "utf8");
  assert.match(source, /function Resolve-CanonicalDeploymentRepositoryRoot/);
  assert.match(source, /function Get-DeploymentGitTopLevel/);
  const canonicalRootResolution = source.indexOf(
    "$RepositoryRoot = Resolve-CanonicalDeploymentRepositoryRoot"
  );
  const sourceAuthorityInvocation = source.indexOf(
    "$sourceAuthorityVerifier = [IO.Path]::GetFullPath",
    canonicalRootResolution
  );
  assert.ok(
    canonicalRootResolution >= 0 && sourceAuthorityInvocation > canonicalRootResolution,
    "canonical repository custody must precede the source-authority process"
  );
  const sourceCustodyCreation = source.indexOf(
    "$script:deploymentSourceCustody = New-DeploymentSourceCustody",
    sourceAuthorityInvocation
  );
  const custodiedAuthorityInvocation = source.indexOf(
    "$sourceAuthorityOutput = @(Invoke-CustodiedNodeTool",
    sourceCustodyCreation
  );
  assert.ok(sourceCustodyCreation > sourceAuthorityInvocation);
  assert.ok(custodiedAuthorityInvocation > sourceCustodyCreation);
  assert.match(
    source.slice(sourceCustodyCreation, custodiedAuthorityInvocation + 500),
    /-ToolPath \$sourceAuthorityVerifier/
  );
  assert.match(source, /function Get-WorkspaceDeploymentTargetBinding/);
  assert.match(source, /function Assert-DeploymentCredentialTarget/);
  assert.match(source, /function Read-BoundedFtpsArtifact/);
  assert.match(source, /function Assert-DeploymentTargetIdentity/);
  assert.match(source, /tinyrustlm\.deployment_root_identity\.v1/);
  assert.match(source, /\.well-known\/tinyrustlm-deployment-target\.v1\.json/);
  const targetReaderStart = source.indexOf("function Read-BoundedFtpsArtifact");
  const targetReaderEnd = source.indexOf(
    "function Assert-DeploymentTargetIdentity",
    targetReaderStart
  );
  const targetReader = source.slice(targetReaderStart, targetReaderEnd);
  assert.match(targetReader, /WebRequestMethods\+Ftp\]::DownloadFile/);
  assert.doesNotMatch(
    targetReader,
    /Write-Remote|UploadFile|MakeDirectory|DeleteFile|Remove-Remote|Rename-Remote/
  );
  assert.doesNotMatch(source, /priorVerifiedArtifacts|prior-receipt-current/);
  assert.match(
    source,
    /Test-RemoteArtifact[\s\S]*?\[switch\]\$AuthenticatedOnly[\s\S]*?\$AuthenticatedOnly -or/
  );
  assert.match(source, /Stage-VerifiedArtifact[\s\S]*?-AuthenticatedOnly/);
  assert.match(source, /function New-ExclusiveDeploymentLease/);
  assert.match(source, /function Remove-ExclusiveDeploymentLease/);
  assert.match(source, /coordination_scope = "single-host-canonical-artifacts"/);
  assert.match(source, /remote_global_exclusion_proven = \$false/);
  assert.match(source, /\$script:deploymentLeaseReleasable/);
  assert.match(source, /blocking_residue_preserved = \$true/);
  assert.match(source, /function Resolve-PinnedDeploymentHost/);
  assert.match(source, /function Assert-PinnedDeploymentHost/);
  assert.match(source, /function Resolve-PinnedDeploymentExecutable/);
  assert.match(source, /function Assert-PinnedDeploymentExecutable/);
  assert.match(source, /EnvironmentVariables\.Clear\(\)/);
  assert.doesNotMatch(
    source.slice(
      source.indexOf("function New-SanitizedDeploymentProcessStartInfo"),
      source.indexOf("function Invoke-PinnedDeploymentProcess")
    ),
    /NODE_OPTIONS|GIT_CONFIG|HTTP_PROXY|HTTPS_PROXY/
  );
  const capabilityStart = source.indexOf("function Assert-SafeDeploymentTransportCapability");
  const capabilityEnd = source.indexOf("function New-ExclusiveDeploymentLease", capabilityStart);
  const capabilityBody = source.slice(capabilityStart, capabilityEnd);
  assert.match(capabilityBody, /remote_global_compare_and_swap_lease/);
  assert.match(capabilityBody, /release_wide_atomic_rollback/);
  assert.match(capabilityBody, /final_marker_can_be_last_remote_mutation/);
  assert.match(capabilityBody, /throw \[InvalidOperationException\]::new/);
  assert.doesNotMatch(capabilityBody, /return \$true/);
  assert.match(source, /function Assert-DeploymentSourceCustody/);
  assert.match(source, /function Invoke-CustodiedNodeTool/);
  assert.match(source, /deploy-\{0\}-stage-\{1\}-\{2\}\.slm/);
  assert.match(source, /backup-\{0\}\.slm/);
  assert.match(source, /\$leaseRouteRemainder/);
  assert.doesNotMatch(source, /\$sha256\.Substring\(0, 12\)/);
  assert.match(source, /function Test-PredeploymentTemporaryRoutePolicy/);
  assert.match(source, /function Test-PublicHostPolicy/);
  assert.match(source, /lastHttpsMissingObservation/);
  assert.match(source, /lastPublicHostPolicyProbeEvidence/);
  assert.match(source, /failed_probe_kind/);
  assert.match(source, /failed_probe_step/);
  assert.match(source, /failed_http_status/);
  assert.match(source, /failed_request_error_identity/);
  assert.match(source, /failed_operation_error_identity/);
  assert.match(source, /authenticated_cleanup_verified/);
  assert.doesNotMatch(source, /public_host_policy[\s\S]{0,500}probe\.path/);
  assert.match(source, /function Test-RetiredModelDirectoryClosure/);
  assert.match(source, /function Remove-RetiredModelDirectory/);
  assert.match(source, /"model-directory"/);
  assert.match(
    source,
    /"model-directory" \{ "app\/models\/policy-\$nonce\.json" \}/
  );
  assert.match(source, /--ssl-reqd/);
  assert.doesNotMatch(source, /--ftp-ssl-control/);
  assert.match(source, /AllowAutoRedirect = \$false/);
  assert.doesNotMatch(source, /StatusDescription/);
  assert.match(source, /temporary_cleanup_verified = \$true/);
  assert.match(source, /publication_temporary_cleanup_verified = \$temporaryCleanupVerified/);
  const predeploymentProbe = source.indexOf(
    "$script:predeploymentTemporaryRouteEvidence = " +
      "Test-PredeploymentTemporaryRoutePolicy"
  );
  const targetIdentityReadback = source.indexOf(
    "$deploymentTargetEvidence = Assert-DeploymentTargetIdentity"
  );
  const publicationLoop = source.indexOf(
    "foreach ($inputEntry in @($publicationPlan.regular))",
    predeploymentProbe
  );
  assert.ok(
    targetIdentityReadback >= 0 &&
      predeploymentProbe > targetIdentityReadback &&
      publicationLoop > predeploymentProbe
  );
  assert.match(source, /function Test-RemoteFileAbsent/);
  assert.match(source, /FTP 550 cannot prove remote-file absence/);
  assert.match(source, /positive SIZE contradicted the parent LIST inventory/);
  assert.match(source, /function Assert-RemoteProtocolPath/);
  assert.match(source, /function Get-RemoteFilePathParts/);
  assert.match(source, /function Test-RetryableFtpsReadFailure/);
  assert.match(source, /function Test-RetryableFtpsCleanupFailure/);
  assert.match(source, /System\.Net\.InternalException/);
  assert.match(source, /\$maximumAttempts = 4/);
  assert.doesNotMatch(source, /Split-Path -(?:Parent|Leaf) \$(?:RemotePath|RemoteRelativePath|StagePath)/);
  assert.doesNotMatch(source, /\[IO\.Path\]::GetDirectoryName\(\[string\]\$_\.remote\)/);
  assert.match(
    source,
    /Get-RemoteSize[\s\S]*?Test-RemoteFileAbsent -RemotePath \$RemotePath/
  );
  assert.match(source, /function ConvertFrom-FtpDirectoryEntry/);
  assert.match(
    source,
    /Get-RemoteDirectoryEntries[\s\S]*?ConvertFrom-FtpDirectoryEntry/
  );
  assert.doesNotMatch(
    source,
    /Test-FtpFileUnavailable -Exception \$_\.Exception\) -and\s+\(Test-RemoteFileAbsent/
  );
  assert.match(
    source,
    /Remove-RemoteFile[\s\S]*?\$maximumAttempts = 4[\s\S]*?Test-RemoteFileAbsent -RemotePath \$RemotePath[\s\S]*?Test-RetryableFtpsCleanupFailure/
  );
  assert.match(source, /\[IO\.FileMode\]::CreateNew/);
  assert.match(source, /\[IO\.File\]::Move\(\$temporary, \$target\)/);
  assert.doesNotMatch(source, /\[IO\.File\]::Replace/);
  assert.match(source, /tinyrustlm-web-deployment-\{0\}\.json/);
  assert.match(source, /tinyrustlm-web-secret-scan-\{0\}\.json/);
  assert.match(source, /immutable_attempt_report = \$true/);
  assert.match(source, /fresh_artifact_readback_required = \$true/);
  assert.match(source, /tinyrustlm\.atomic_ftps_deployment\.v10/);
  assert.match(source, /tinyrustlm-site-release-ledger-finalized-\{0\}\.json/);
  assert.match(source, /"finalize",[\s\S]*?\$finalizedLedgerCandidatePath/);
  assert.match(source, /finalized_release_ledger_candidate_sha256/);
  assert.match(source, /finalized_release_ledger_candidate_requires_source_review_and_commit/);
  assert.match(source, /release_commit_marker_published/);
  assert.match(source, /post_commit_maintenance/);
  assert.match(source, /tinyrustlm\.deployment_terminal_decision\.v1/);
  assert.match(source, /deployment_attempt_terminal = \$true/);
  assert.match(source, /recorded_before_local_cleanup = \$true/);
  assert.match(source, /function Set-ArtifactOperationState/);
  assert.match(source, /Per-artifact publication cannot mutate the release commit marker/);
  assert.match(source, /failure_identity = \$failureIdentity/);
  assert.match(source, /failure_step = \$failureStep/);
  assert.match(source, /active_artifact = if \(\$script:activeArtifactRemote\)/);
  assert.match(source, /primary_failure_step = \$script:artifactPrimaryFailureStep/);
  assert.match(source, /rollback_status = \$script:artifactRollbackStatus/);
  assert.match(source, /function Resolve-NewDeploymentReportPath/);
  assert.match(source, /Deployment report directory cannot traverse a reparse point/);
  assert.match(
    source,
    /Remove-PublicPredecessorOracle[\s\S]*?Invoke-CustodiedNodeTool[\s\S]*?"remove-predecessor"/
  );
  assert.match(source, /source_tree_clean = \$sourceTreeClean/);
  assert.match(source, /expected_file_count = \$expectedFileCount/);
  assert.match(source, /retired_artifact_absence_verified = \$retirementVerified/);
  assert.match(source, /retired_model_directory_absence_verified/);
  assert.match(source, /published_release_model_bytes_present = \$false/);
  assert.doesNotMatch(source, /project_server_model_bytes_present/);
  assert.match(source, /publication_transaction_scope = if \(/);
  assert.match(source, /"blocked-before-remote-mutation"/);
  assert.match(source, /per_artifact_atomic_promotion = \$false/);
  assert.match(source, /whole_site_atomic_promotion = \$false/);
  assert.match(source, /release_wide_rollback_available/);
  assert.match(source, /remote_global_lease_available/);
  assert.match(source, /remote_mutation_admitted/);
  assert.match(source, /readback_verified = \$true/);
  assert.match(source, /GetFileName\(\$ReportPath\)/);
  const deploymentTry = source.indexOf(
    "try {",
    source.indexOf("$operationPhase = \"preflight-git\"")
  );
  const sourceCustodyPreflight = source.indexOf(
    "$sourceCustodyEvidence = Assert-DeploymentSourceCustody",
    deploymentTry
  );
  const secretScanPreflight = source.indexOf(
    "$operationPhase = \"preflight-secret-scan\"",
    sourceCustodyPreflight
  );
  const releaseLedgerFinalization = source.indexOf(
    "$operationPhase = \"release-ledger-candidate-validation\"",
    secretScanPreflight
  );
  const terminalCustody = source.indexOf(
    "$operationPhase = \"terminal-source-custody\"",
    releaseLedgerFinalization
  );
  const transportBlocker = source.indexOf(
    "$operationPhase = \"transport-capability-blocker\"",
    terminalCustody
  );
  const credentials = source.indexOf(
    "$operationPhase = \"credential-profile\"",
    transportBlocker
  );
  const modelDirectoryPreflight = source.indexOf(
    "$operationPhase = \"legacy-model-directory-preflight\"",
    credentials
  );
  const artifactPublication = source.indexOf(
    "$operationPhase = \"artifact-publication\"",
    modelDirectoryPreflight
  );
  const finalMarker = source.indexOf(
    "$operationPhase = \"release-commit-marker\"",
    artifactPublication
  );
  const deploymentFinally = source.indexOf("finally {", secretScanPreflight);
  const immutableReportWrite = source.indexOf(
    "$reportReceipt = Write-AtomicJson",
    deploymentFinally
  );
  assert.ok(
    deploymentTry >= 0 &&
      sourceCustodyPreflight > deploymentTry &&
      secretScanPreflight > sourceCustodyPreflight &&
      releaseLedgerFinalization > secretScanPreflight &&
      terminalCustody > releaseLedgerFinalization &&
      transportBlocker > terminalCustody &&
      credentials > transportBlocker &&
      modelDirectoryPreflight > credentials &&
      artifactPublication > modelDirectoryPreflight &&
      finalMarker > artifactPublication &&
      deploymentFinally > secretScanPreflight &&
      immutableReportWrite > deploymentFinally
  );
  assert.match(source, /function Get-DeploymentCredentialProfile/);
  assert.match(
    source,
    /Get-DeploymentCredentialProfile[\s\S]*?-ExpectedProfileName \$TargetBinding\.profile/
  );
  assert.match(source, /DtdProcessing = \[Xml\.DtdProcessing\]::Prohibit/);
  assert.match(source, /"validate",\s+\$releaseLedgerPath/);
  assert.match(source, /materialize-finalized/);
  assert.match(source, /pendingReleaseId/);
  assert.doesNotMatch(source, /Remove-Item[^\r\n]*-Recurse/);
  const postCustodySource = source.slice(sourceCustodyCreation);
  assert.doesNotMatch(postCustodySource, /& node\s/);
});

test("deployment package command uses the owned-scratch launcher", () => {
  const { scripts } = JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"), "utf8"));
  assert.equal(scripts["pretest:deployment"], "npm run verify:source-authority");
  assert.equal(scripts["verify:source-authority"], "node tools/verify-single-source-authority.js");
  assert.equal(scripts["test:deployment"],
    "node --test tests/deploy-tinyrustlm-web.test.js tests/web-deployment-manifest.test.js tests/web-deployment-custody.test.js");
});

test("PowerShell deployment primitives use owned canonical scratch and verified memory payloads", { timeout: 180000 }, () => {
  const { spawnSync } = require("node:child_process");
  const { createOwnedTemporaryDirectory, removeOwnedTemporaryDirectory } =
    require("../tools/canonical-operation-scratch.js");
  const repositoryRoot = path.resolve(__dirname, "../..");
  const owned = createOwnedTemporaryDirectory({
    temporaryParent: path.join(repositoryRoot, "artifacts/tests/deploy-tinyrustlm-web")
  });
  try {
    const result = spawnSync(
      path.join(process.env.SystemRoot, "System32/WindowsPowerShell/v1.0/powershell.exe"),
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File",
        path.join(__dirname, "deploy-tinyrustlm-web.test.ps1"), "-OperationRoot", owned.rootPath],
      { cwd: repositoryRoot, windowsHide: true, encoding: "utf8",
        env: { ...process.env, TEMP: owned.rootPath, TMP: owned.rootPath, NODE_V8_COVERAGE: "" },
        timeout: 170000, maxBuffer: 2 * 1024 * 1024 }
    );
    assert.equal(result.error, undefined, String(result.error));
    assert.equal(result.status, 0, result.stderr + "\n" + result.stdout);
    assert.match(result.stdout, /deployment persistence and credential-profile tests passed/);
  } finally {
    removeOwnedTemporaryDirectory(owned);
    assert.equal(fs.existsSync(owned.rootPath), false);
  }
});
