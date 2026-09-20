"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const powerShellScript = path.join(repositoryRoot, "eng", "build-native.ps1");
const shellScript = path.join(repositoryRoot, "eng", "build-native.sh");

test("native build scripts copy from the explicit target-triple Cargo output", () => {
  const powerShell = fs.readFileSync(powerShellScript, "utf8");
  const shell = fs.readFileSync(shellScript, "utf8");

  assert.match(powerShell, /\$targetDirectory = Resolve-CargoTargetDirectory/u);
  assert.match(powerShell,
    /\$cargoArguments = @\("build", "-p", "tinyrustlm-native", "--target", \$targetTriple\)/u);
  assert.match(powerShell,
    /\$nativeSource = Join-Path \$targetDirectory "\$targetTriple\/\$profileDirectory\/\$nativeName"/u);
  assert.doesNotMatch(powerShell,
    /\$targetDirectory\s*=\s*Join-Path\s+\$RepoRoot\s+"target"/u);
  assert.match(shell,
    /target_dir="\$\{CARGO_TARGET_DIR:-\$repo_root\/target\}"/u);
  assert.match(shell,
    /cargo_args=\(build -p tinyrustlm-native --target "\$target_triple"\)/u);
  assert.match(shell,
    /source_path="\$target_dir\/\$target_triple\/\$profile_dir\/\$native_name"/u);
  assert.doesNotMatch(shell,
    /cp\s+"target\/\$profile_dir\/\$native_name"/u);
});

if (process.platform === "win32") {
  test("native, converter and seed builders resolve Windows paths before any build", () => {
    const builders = ["build-native.ps1", "build-converter.ps1", "build-p2p-seed.ps1"];
    const script = `$ErrorActionPreference='Stop'
$RepoRoot='${repositoryRoot.replaceAll("'", "''")}'
$results=@(foreach($builder in @(${builders.map((name) => `'${name}'`).join(",")})) {
  $tokens=$null; $parseErrors=$null
  $ast=[System.Management.Automation.Language.Parser]::ParseFile((Join-Path $RepoRoot "eng/$builder"),[ref]$tokens,[ref]$parseErrors)
  if($parseErrors.Count){throw 'builder parse failure'}
  $definition=$ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Resolve-CargoTargetDirectory'},$true)
  if($definition.Count -ne 1){throw 'builder resolver unavailable'}
  Invoke-Expression $definition[0].Extent.Text
  foreach($value in @('E:\\Source\\Rust\\TinyRustLM.com\\artifacts\\target', 'E:/Source/Rust/TinyRustLM.com/artifacts/target', '\\\\server\\share\\target', '//server/share/target', 'relative-target', 'E:\\')) {
    $env:CARGO_TARGET_DIR=$value
    try { @{builder=$builder;value=$value;path=(Resolve-CargoTargetDirectory)} }
    catch { @{builder=$builder;value=$value;error=$_.Exception.Message} }
  }
})
ConvertTo-Json -InputObject $results -Depth 4 -Compress`;
    const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand",
      Buffer.from(script, "utf16le").toString("base64")], {
      cwd: repositoryRoot, encoding: "utf8", windowsHide: true, timeout: 10000,
      env: { ...process.env, NODE_V8_COVERAGE: "" },
    });
    assert.equal(result.status, 0, result.stderr);
    const rows = JSON.parse(result.stdout.trim());
    assert.equal(rows.length, 18);
    for (const row of rows) {
      if (row.value === "relative-target") assert.match(row.error, /must be an absolute path/);
      else if (row.value === "E:\\") assert.match(row.error, /must not be a filesystem root/);
      else { assert.equal(row.error, undefined); assert.equal(row.path, path.win32.normalize(row.value)); }
    }
  });

  test("Windows native builder rejects a relative Cargo target before build", () => {
    const result = spawnSync("powershell.exe", [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      powerShellScript
    ], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        CARGO_TARGET_DIR: "relative-target"
      },
      windowsHide: true
    });
    assert.notEqual(result.status, 0);
    assert.match(
      `${result.stdout}\n${result.stderr}`,
      /CARGO_TARGET_DIR must be an absolute path/u
    );
  });
}
