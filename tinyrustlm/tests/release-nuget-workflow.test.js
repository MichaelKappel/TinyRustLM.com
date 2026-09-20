"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const workflow = fs.readFileSync(path.join(root, ".github/workflows/release-nuget.yml"), "utf8");

/** Select a top-level job by its YAML indentation without interpreting run-script contents. */
function job(name) {
  const match = workflow.match(new RegExp(`^  ${name}:\\r?\\n([\\s\\S]*?)(?=^  [a-z][a-z0-9-]*:|$(?![\\s\\S]))`, "m"));
  assert.ok(match, `Missing release job: ${name}`);
  return match[1];
}

test("publication waits for exact-package consumers on every supported native platform", () => {
  const pack = job("pack");
  const consumers = job("verify-package-consumers");
  const release = job("release");
  assert.match(pack, /^    needs: build-native$/m);
  assert.match(consumers, /^    needs: pack$/m);
  assert.match(release, /^    needs: \[pack, verify-package-consumers\]$/m);
  assert.match(consumers, /^    runs-on: \$\{\{ matrix\.os \}\}$/m);
  assert.deepEqual([...consumers.matchAll(/- os: ([^\r\n]+)\r?\n\s+rid: ([^\r\n]+)/g)]
    .map(match => [match[1], match[2]]), [
    ["windows-latest", "win-x64"], ["ubuntu-latest", "linux-x64"], ["ubuntu-24.04-arm", "linux-arm64"]
  ]);
  assert.doesNotMatch(consumers + release, /continue-on-error:|^    if:/m);
  assert.match(consumers, /EXPECTED_RID: \$\{\{ matrix\.rid \}\}/);
  assert.match(consumers, /process\.arch/);
  assert.match(consumers, /throw new Error\('Package consumer host does not match expected RID'\)/);
});

test("consumers and publisher download the single pack output without rebuilding it", () => {
  const pack = job("pack");
  const consumers = job("verify-package-consumers");
  const release = job("release");
  assert.match(pack, /name: tinyrustlm-nuget-packages[\s\S]*artifacts\/packages\/tinyrustlm-nuget-package-audit\.json/);
  for (const consumer of [consumers, release]) {
    assert.match(consumer, /uses: actions\/download-artifact@v4\r?\n\s+with:\r?\n\s+name: tinyrustlm-nuget-packages\r?\n\s+path: artifacts\/packages/);
    assert.doesNotMatch(consumer, /run:.*(?:eng\/(?:pack|verify-package)\.|dotnet pack)/);
  }
  assert.match(consumers, /eng\/verify-consumer\.ps1 -PackageSource artifacts\/packages/);
  assert.match(consumers, /eng\/verify-consumer\.sh artifacts\/packages/);
  assert.match(consumers, /uses: actions\/setup-node@v4/);
  assert.match(consumers, /uses: actions\/setup-dotnet@v4/);
  assert.match(release, /Build report validators[\s\S]*dotnet build dotnet\/tests\/TinyRustLM\.Package\.Tests\/TinyRustLM\.Package\.Tests\.csproj/);
});

test("only the post-consumer job can request publication credentials", () => {
  const release = job("release");
  for (const name of ["build-native", "pack", "verify-package-consumers"]) {
    assert.doesNotMatch(job(name), /secrets\.|id-token: write|environment: nuget-release|NuGet\/login|publish-nuget/);
  }
  assert.match(release, /^    environment: nuget-release$/m);
  assert.match(release, /id-token: write/);
  assert.match(release, /Audit NuGet release readiness[\s\S]*Authenticate to NuGet/);
});

test("the workflow host guard executes and rejects every mismatched architecture", () => {
  const match = job("verify-package-consumers").match(/node -e "([^\"]+)"/);
  assert.ok(match, "Missing executable host admission command");
  const script = match[1].replace(/\r?\n\s*/g, " ");
  const host = `${process.platform === "win32" ? "win" : process.platform}-${process.arch}`;
  for (const rid of new Set([host, "win-x64", "linux-x64", "linux-arm64", "unknown"])) {
    const result = spawnSync(process.execPath, ["-e", script], {
      encoding: "utf8", windowsHide: true, timeout: 10000,
      env: { ...process.env, NODE_V8_COVERAGE: "", EXPECTED_RID: rid }
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, rid === host ? 0 : 1, rid);
    if (rid !== host) assert.match(result.stderr, /Package consumer host does not match expected RID/);
  }
});

test("checked-in NuGet Bash entry points can execute on a fresh Unix checkout", () => {
  const scripts = ["build-native", "get-package-version", "pack", "verify-consumer",
    "verify-package", "write-package-audit", "publish-nuget", "audit-nuget-release-readiness",
    "verify-feed", "verify-feed-current", "verify-feed-package-hashes"].map(name => `eng/${name}.sh`);
  const entries = execFileSync("git", ["ls-files", "--stage", "--", ...scripts], {
    cwd: root, encoding: "utf8", windowsHide: true, timeout: 30000
  }).trim().split(/\r?\n/);
  assert.equal(entries.length, scripts.length);
  for (const entry of entries) assert.match(entry, /^100755 [a-f0-9]{40} 0\teng\//);
  for (const script of scripts) {
    const source = fs.readFileSync(path.join(root, script), "utf8");
    assert.ok(source.startsWith("#!/usr/bin/env bash\n"), script);
    assert.equal(source.includes("\r"), false, script);
  }
});
