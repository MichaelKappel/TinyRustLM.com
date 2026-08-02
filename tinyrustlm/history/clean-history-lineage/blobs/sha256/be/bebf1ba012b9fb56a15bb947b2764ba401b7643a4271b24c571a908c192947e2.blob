"use strict";

const crypto = require("node:crypto");

const schema =
  "tinyrustlm.portable_affine_u8_memory_monitor_script.v2";
const samplingIntervalMilliseconds = 5;
const expectedScriptBytes = 2957;
const expectedScriptSha256 =
  "fc8872931c1ac0d7cef0bce8dc8b285e03d1c48ecd6eedcbd300c32a9331c691";
const markerNames = Object.freeze({
  request: "performance-monitor-request.marker",
  ready: "performance-monitor-ready.marker",
  postPrepare: "performance-post-prepare.marker",
  postPrepareAck: "performance-post-prepare-ack.marker"
});

const memoryMonitorScriptV2 = `${[
  "param(",
  "  [Parameter(Mandatory=$true)][int]$TargetProcessId,",
  "  [Parameter(Mandatory=$true)][string]$ProcessRoot,",
  "  [Parameter(Mandatory=$true)][string]$OutputPath",
  ")",
  "$ErrorActionPreference = 'Stop'",
  `$request = Join-Path $ProcessRoot '${markerNames.request}'`,
  `$ready = Join-Path $ProcessRoot '${markerNames.ready}'`,
  `$postPrepare = Join-Path $ProcessRoot '${markerNames.postPrepare}'`,
  `$postPrepareAck = Join-Path $ProcessRoot '${markerNames.postPrepareAck}'`,
  "function Write-NewMarker([string]$Path) {",
  "  $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)",
  "  try {",
  "    $bytes = [System.Text.Encoding]::UTF8.GetBytes(\"ready`n\")",
  "    $stream.Write($bytes, 0, $bytes.Length)",
  "    $stream.Flush($true)",
  "  } finally {",
  "    $stream.Dispose()",
  "  }",
  "}",
  "$deadline = [DateTime]::UtcNow.AddSeconds(10)",
  "while (-not (Test-Path -LiteralPath $request -PathType Leaf)) {",
  "  if ([DateTime]::UtcNow -ge $deadline) { throw 'memory-monitor-request-timeout' }",
  `  Start-Sleep -Milliseconds ${samplingIntervalMilliseconds}`,
  "}",
  "$process = Get-Process -Id $TargetProcessId -ErrorAction Stop",
  "$process.Refresh()",
  "if ($process.HasExited) { throw 'memory-monitor-target-exited-before-ready' }",
  "$workingSet = [int64]$process.WorkingSet64",
  "$reportedPeak = [int64]$process.PeakWorkingSet64",
  "$peak = $workingSet",
  "$osPeak = $reportedPeak",
  "$postPrepareWorkingSet = [int64]0",
  "$sampleCount = 1",
  "$postPrepareObserved = $false",
  "Write-NewMarker $ready",
  "while ($true) {",
  "  try {",
  "    $process.Refresh()",
  "    if ($process.HasExited) { break }",
  "    $workingSet = [int64]$process.WorkingSet64",
  "    $reportedPeak = [int64]$process.PeakWorkingSet64",
  "  } catch {",
  "    if (-not (Get-Process -Id $TargetProcessId -ErrorAction SilentlyContinue)) { break }",
  "    throw",
  "  }",
  "  $sampleCount += 1",
  "  if ($workingSet -gt $peak) { $peak = $workingSet }",
  "  if ($reportedPeak -gt $osPeak) { $osPeak = $reportedPeak }",
  "  if (-not $postPrepareObserved -and (Test-Path -LiteralPath $postPrepare -PathType Leaf)) {",
  "    $postPrepareWorkingSet = $workingSet",
  "    $postPrepareObserved = $true",
  "    Write-NewMarker $postPrepareAck",
  "  }",
  `  Start-Sleep -Milliseconds ${samplingIntervalMilliseconds}`,
  "}",
  "if (-not $postPrepareObserved) { throw 'memory-post-prepare-not-observed' }",
  "if ($sampleCount -lt 2) { throw 'memory-monitor-too-few-samples' }",
  "$result = [ordered]@{",
  `  samplingIntervalMilliseconds = ${samplingIntervalMilliseconds}`,
  "  peakWorkingSetBytes = $peak",
  "  osReportedPeakWorkingSetBytes = $osPeak",
  "  postPrepareWorkingSetBytes = $postPrepareWorkingSet",
  "  sampleCount = $sampleCount",
  "  monitorExitCode = 0",
  "}",
  "$json = ($result | ConvertTo-Json -Compress) + \"`n\"",
  "$output = [System.IO.File]::Open($OutputPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)",
  "try {",
  "  $bytes = [System.Text.UTF8Encoding]::new($false).GetBytes($json)",
  "  $output.Write($bytes, 0, $bytes.Length)",
  "  $output.Flush($true)",
  "} finally {",
  "  $output.Dispose()",
  "}"
].join("\r\n")}\r\n`;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function statementOffsets(script) {
  return Object.freeze({
    processLookup: script.indexOf(
      "$process = Get-Process -Id $TargetProcessId -ErrorAction Stop"
    ),
    baselineSample: script.indexOf("$sampleCount = 1"),
    ready: script.indexOf("Write-NewMarker $ready"),
    loopSample: script.indexOf("$sampleCount += 1"),
    postPrepareAck: script.indexOf("Write-NewMarker $postPrepareAck"),
    minimumGuard: script.indexOf(
      "if ($sampleCount -lt 2) { throw 'memory-monitor-too-few-samples' }"
    )
  });
}

function minimumSamplesIfPostPrepareIsFirstLoopSample(script) {
  const offsets = statementOffsets(script);
  invariant(
    [
      offsets.processLookup,
      offsets.ready,
      offsets.loopSample,
      offsets.postPrepareAck,
      offsets.minimumGuard
    ].every((offset) => offset >= 0),
    "monitor script lacks a required statement"
  );
  const baselineSamples =
    offsets.baselineSample >= 0 &&
      offsets.baselineSample < offsets.ready
      ? 1
      : 0;
  return baselineSamples + 1;
}

function validateMemoryMonitorScriptV2(script = memoryMonitorScriptV2) {
  invariant(typeof script === "string" && script.length > 0,
    "monitor script is empty");
  const offsets = statementOffsets(script);
  invariant(
    offsets.processLookup <
      offsets.baselineSample &&
      offsets.baselineSample <
      offsets.ready &&
      offsets.ready <
      offsets.loopSample &&
      offsets.loopSample <
      offsets.postPrepareAck &&
      offsets.postPrepareAck <
      offsets.minimumGuard,
    "monitor sampling and handshake order is invalid"
  );
  invariant(
    minimumSamplesIfPostPrepareIsFirstLoopSample(script) >= 2,
    "fast target can violate the minimum sample count"
  );
  for (const marker of Object.values(markerNames)) {
    invariant(script.includes(marker), `monitor marker is absent: ${marker}`);
  }
  invariant(
    script.endsWith("\r\n") && !script.includes("\uFEFF"),
    "monitor script encoding contract is invalid"
  );
  const bytes = Buffer.from(script, "utf8");
  invariant(
    bytes.length === expectedScriptBytes &&
      sha256(bytes) === expectedScriptSha256,
    "monitor script byte identity drifted"
  );
  return Object.freeze({
    schema,
    bytes: bytes.length,
    sha256: sha256(bytes),
    samplingIntervalMilliseconds,
    markerNames,
    baselineSampleBeforeReady: true,
    minimumSamplesIfPostPrepareIsFirstLoopSample:
      minimumSamplesIfPostPrepareIsFirstLoopSample(script)
  });
}

const memoryMonitorContract = validateMemoryMonitorScriptV2();

module.exports = Object.freeze({
  expectedScriptBytes,
  expectedScriptSha256,
  markerNames,
  memoryMonitorContract,
  memoryMonitorScriptV2,
  minimumSamplesIfPostPrepareIsFirstLoopSample,
  samplingIntervalMilliseconds,
  schema,
  statementOffsets,
  validateMemoryMonitorScriptV2
});
