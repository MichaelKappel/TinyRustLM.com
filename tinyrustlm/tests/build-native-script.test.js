"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const powerShellScript = path.join(repositoryRoot, "eng", "build-native.ps1");
const shellScript = path.join(repositoryRoot, "eng", "build-native.sh");

test("native build scripts copy from the Cargo target they invoke", () => {
  const powerShell = fs.readFileSync(powerShellScript, "utf8");
  const shell = fs.readFileSync(shellScript, "utf8");

  assert.match(powerShell, /\$TargetDir = Resolve-CargoTargetDirectory/u);
  assert.match(powerShell,
    /\$NativeSource = Join-Path \(Join-Path \$TargetDir \$ProfileDir\) \$NativeName/u);
  assert.doesNotMatch(powerShell,
    /\$TargetDir\s*=\s*Join-Path\s+\$RepoRoot\s+"target"/u);
  assert.match(shell,
    /TARGET_DIR="\$\{CARGO_TARGET_DIR:-\$REPO_ROOT\/target\}"/u);
  assert.match(shell,
    /NATIVE_SOURCE="\$TARGET_DIR\/\$PROFILE_DIR\/\$NATIVE_NAME"/u);
  assert.doesNotMatch(shell,
    /cp\s+"target\/\$PROFILE_DIR\/\$NATIVE_NAME"/u);
});

if (process.platform === "win32") {
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
