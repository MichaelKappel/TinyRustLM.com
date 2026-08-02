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
  assert.doesNotMatch(source, /priorVerifiedArtifacts|prior-receipt-current/);
  assert.match(
    source,
    /Test-RemoteArtifact[\s\S]*?\[switch\]\$AuthenticatedOnly[\s\S]*?\$AuthenticatedOnly -or/
  );
  assert.match(source, /Stage-VerifiedArtifact[\s\S]*?-AuthenticatedOnly/);
  assert.match(source, /deploy-\{0\}-stage\.slm/);
  assert.match(source, /backup-\{0\}\.slm/);
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
  assert.match(source, /"models-directory"/);
  assert.match(
    source,
    /"models-directory" \{ "app\/models\/policy-\$nonce\/marker\.json" \}/
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
  const publicationLoop = source.indexOf(
    "foreach ($entry in @($deploymentManifest.publish))",
    predeploymentProbe
  );
  assert.ok(predeploymentProbe >= 0 && publicationLoop > predeploymentProbe);
  assert.match(source, /function Test-RemoteFileAbsent/);
  assert.match(source, /function Assert-RemoteProtocolPath/);
  assert.match(source, /function Get-RemoteFilePathParts/);
  assert.match(source, /function Test-RetryableFtpsReadFailure/);
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
  assert.match(
    source,
    /Test-FtpFileUnavailable -Exception \$_\.Exception\) -and\s+\(Test-RemoteFileAbsent/
  );
  assert.match(source, /\[IO\.FileMode\]::CreateNew/);
  assert.match(source, /\[IO\.File\]::Move\(\$temporary, \$target\)/);
  assert.doesNotMatch(source, /\[IO\.File\]::Replace/);
  assert.match(source, /tinyrustlm-web-deployment-\{0\}\.json/);
  assert.match(source, /tinyrustlm-web-secret-scan-\{0\}\.json/);
  assert.match(source, /immutable_attempt_report = \$true/);
  assert.match(source, /fresh_artifact_readback_required = \$true/);
  assert.match(source, /tinyrustlm\.atomic_ftps_deployment\.v7/);
  assert.match(source, /tinyrustlm-site-release-ledger-finalized-\{0\}\.json/);
  assert.match(source, /finalize `[\s\S]*?\$finalizedLedgerCandidatePath/);
  assert.match(source, /finalized_release_ledger_candidate_sha256/);
  assert.match(source, /finalized_release_ledger_candidate_requires_source_review_and_commit/);
  assert.match(source, /function Set-ArtifactOperationState/);
  assert.match(source, /failure_identity = \$failureIdentity/);
  assert.match(source, /failure_step = \$failureStep/);
  assert.match(source, /active_artifact = if \(\$script:activeArtifactRemote\)/);
  assert.match(source, /primary_failure_step = \$script:artifactPrimaryFailureStep/);
  assert.match(source, /rollback_status = \$script:artifactRollbackStatus/);
  assert.match(source, /function Resolve-NewDeploymentReportPath/);
  assert.match(source, /Deployment report directory cannot traverse a reparse point/);
  assert.match(source, /source_tree_clean = \$sourceTreeClean/);
  assert.match(source, /expected_file_count = \$expectedFileCount/);
  assert.match(source, /retired_artifact_absence_verified = \$retirementVerified/);
  assert.match(source, /retired_model_directory_absence_verified/);
  assert.match(source, /published_release_model_bytes_present = \$false/);
  assert.doesNotMatch(source, /project_server_model_bytes_present/);
  assert.match(source, /publication_transaction_scope = "per-artifact"/);
  assert.match(source, /per_artifact_atomic_promotion = \$true/);
  assert.match(source, /whole_site_atomic_promotion = \$false/);
  assert.match(source, /readback_verified = \$true/);
  assert.match(source, /GetFileName\(\$ReportPath\)/);
  const deploymentTry = source.indexOf(
    "try {",
    source.indexOf("$operationPhase = \"preflight-git\"")
  );
  const gitStatusCapture = source.indexOf("$repositoryStatus = @(", deploymentTry);
  const gitPreflight = source.indexOf(
    "& git -C $RepositoryRoot status --porcelain=v1 --untracked-files=all 2>$null",
    gitStatusCapture
  );
  const secretScanPreflight = source.indexOf(
    "$operationPhase = \"preflight-secret-scan\"",
    gitPreflight
  );
  const modelDirectoryPreflight = source.indexOf(
    "$operationPhase = \"legacy-model-directory-preflight\"",
    secretScanPreflight
  );
  const artifactPublication = source.indexOf(
    "$operationPhase = \"artifact-publication\"",
    modelDirectoryPreflight
  );
  const releaseLedgerFinalization = source.indexOf(
    "$operationPhase = \"release-ledger-finalization\"",
    artifactPublication
  );
  const deploymentFinally = source.indexOf("finally {", secretScanPreflight);
  const immutableReportWrite = source.indexOf(
    "$reportReceipt = Write-AtomicJson",
    deploymentFinally
  );
  assert.ok(
    deploymentTry >= 0 &&
      gitStatusCapture > deploymentTry &&
      gitPreflight > gitStatusCapture &&
      secretScanPreflight > gitPreflight &&
      modelDirectoryPreflight > secretScanPreflight &&
      artifactPublication > modelDirectoryPreflight &&
      releaseLedgerFinalization > artifactPublication &&
      deploymentFinally > secretScanPreflight &&
      immutableReportWrite > deploymentFinally
  );
  assert.match(source, /function Get-DeploymentCredentialProfile/);
  assert.match(source, /DtdProcessing = \[Xml\.DtdProcessing\]::Prohibit/);
});
