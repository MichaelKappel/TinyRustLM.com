"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const test = require("node:test");
const { createOwnedTemporaryDirectory, removeOwnedTemporaryDirectory } = require("../tools/canonical-operation-scratch.js");

const root = path.resolve(__dirname, "../..");
const powershell = process.platform === "win32" ? "powershell.exe" : "pwsh";
// Windows may explicitly use an installed WSL interpreter; other hosts use Python on PATH.
const wslDistribution = process.env.TINYRUSTLM_FEED_TEST_WSL_DISTRIBUTION;
const python = process.platform === "win32" && wslDistribution
  ? { executable: "wsl.exe", args: ["-d", wslDistribution, "--exec", "python3"] }
  : { executable: process.platform === "win32" ? "python.exe" : "python3", args: [] };
const cases = [
  { name: "found", status: 200, body: '{"versions":["0.1.7","0.1.8"]}', versions: ["0.1.7", "0.1.8"] },
  { name: "single-version", status: 200, body: '{"versions":["0.1.8"]}', versions: ["0.1.8"] },
  { name: "missing", status: 404, body: "not found", versions: [] },
  ...[401, 403, 429, 500, 503].map((status) => ({ name: `http-${status}`, status, body: "private-response-canary" })),
  { name: "bad-json", status: 200, body: "private-response-canary" },
  { name: "missing-list", status: 200, body: "{}" },
  { name: "scalar-list", status: 200, body: '{"versions":"0.1.8"}' },
  { name: "empty-list", status: 200, body: '{"versions":[]}' },
  { name: "mixed-list", status: 200, body: '{"versions":["0.1.8",123]}' },
  { name: "blank-version", status: 200, body: '{"versions":[" "]}' },
  { name: "disconnect", disconnect: true },
];

/** Run existing interpreters with bounded output and lifetime, retaining no source or fixtures. */
async function run(executable, args, input = "") {
  const child = spawn(executable, args, { cwd: root, windowsHide: true,
    env: { ...process.env, NODE_V8_COVERAGE: "", PYTHONDONTWRITEBYTECODE: "1" } });
  let stdout = "", stderr = "";
  const timer = setTimeout(() => child.kill(), 45000);
  child.stdout.on("data", (chunk) => { stdout += chunk; if (stdout.length > 128 * 1024) child.kill(); });
  child.stderr.on("data", (chunk) => { stderr += chunk; if (stderr.length > 128 * 1024) child.kill(); });
  const closed = once(child, "close");
  child.stdin.end(input);
  try {
    const [code] = await closed;
    assert.equal(code, 0, stderr);
    assert.doesNotMatch(stdout + stderr, /private-response-canary/);
    return JSON.parse(stdout.trim());
  } finally { clearTimeout(timer); }
}

/** Check absence only for a genuine 404, preserving unknown feed states as failures. */
async function checkResults(t, results) {
  assert.equal(results.length, cases.length);
  for (const [index, expected] of cases.entries()) await t.test(expected.name, () => {
    const actual = results[index];
    assert.equal(actual.name, expected.name);
    if (Object.hasOwn(expected, "versions")) {
      assert.equal(actual.error, undefined);
      assert.deepEqual(actual.versions, expected.versions);
    } else {
      assert.match(actual.error, /^NuGet package version (lookup failed|index is invalid) for TinyRustLM.Core\.$/);
      assert.equal(actual.versions, undefined);
    }
  });
}

test("PowerShell feed query distinguishes missing packages from unavailable or invalid indexes", async (t) => {
  const server = http.createServer((request, response) => {
    const entry = cases.find((item) => request.url === `/${item.name}/tinyrustlm.core/index.json`);
    if (!entry) { response.writeHead(400); response.end(); return; }
    if (entry.disconnect) { request.socket.destroy(); return; }
    response.writeHead(entry.status, { "Content-Type": "application/json" });
    response.end(entry.body);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const source = path.join(root, "eng/verify-feed-current.ps1").replaceAll("'", "''");
    const names = cases.map((item) => `'${item.name}'`).join(",");
    const script = `$ErrorActionPreference='Stop'
$tokens=$null; $parseErrors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile('${source}',[ref]$tokens,[ref]$parseErrors)
if($parseErrors.Count){throw 'canonical script parse failure'}
$definition=$ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-RemotePackageVersions'},$true)
if($definition.Count -ne 1){throw 'canonical function unavailable'}
Invoke-Expression $definition[0].Extent.Text
$results=@(foreach($name in @(${names})){
  try { $versions=@(Get-RemotePackageVersions -FlatContainerBaseUrl "http://127.0.0.1:${server.address().port}/$name/" -PackageId 'TinyRustLM.Core'); @{name=$name;versions=$versions} }
  catch { @{name=$name;error=$_.Exception.Message} }
})
ConvertTo-Json -InputObject $results -Depth 4 -Compress`;
    const results = await run(powershell, ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")]);
    await checkResults(t, results);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test("Bash Python feed query makes the same decisions using real local HTTP", async (t) => {
  const script = `import json, sys, threading
from http.server import BaseHTTPRequestHandler, HTTPServer
inputs = json.load(sys.stdin)
payload = inputs['cases']
source = inputs['source']
program = source.split("<<'PY'\\n", 1)[1].split('\\nsource_kind =', 1)[0]
sys.argv = ['probe', 'unused', '0.1.8', 'unused', '0']
namespace = {}
exec(compile(program, 'canonical-verify-feed-current.sh', 'exec'), namespace)
class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_GET(self):
        entry = next(item for item in payload if self.path == '/' + item['name'] + '/tinyrustlm.core/index.json')
        if entry.get('disconnect'):
            self.close_connection = True
            return
        self.send_response(entry['status'])
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(entry['body'].encode())
server = HTTPServer(('127.0.0.1', 0), Handler)
thread = threading.Thread(target=server.serve_forever)
thread.start()
results = []
try:
    for entry in payload:
        try:
            versions = namespace['remote_versions']('http://127.0.0.1:' + str(server.server_port) + '/' + entry['name'] + '/', 'TinyRustLM.Core')
            results.append({'name': entry['name'], 'versions': versions})
        except Exception as error:
            results.append({'name': entry['name'], 'error': str(error)})
finally:
    server.shutdown()
    thread.join()
    server.server_close()
print(json.dumps(results))
`;
  const results = await run(python.executable, [...python.args, "-B", "-c", script], JSON.stringify({
    cases, source: fs.readFileSync(path.join(root, "eng/verify-feed-current.sh"), "utf8").replaceAll("\r\n", "\n"),
  }));
  await checkResults(t, results);
});

test("daily feed monitoring has no opt-in gate that silently skips the schedule", () => {
  const workflow = fs.readFileSync(path.join(root, ".github/workflows/nuget-feed-monitor.yml"), "utf8");
  assert.match(workflow, /schedule:\s*\n\s*- cron:/);
  assert.doesNotMatch(workflow, /TINYRUSTLM_NUGET_MONITOR_ENABLED/);
});

test("full PowerShell checker writes absence evidence but leaves failed lookups unknown", async (t) => {
  const owned = createOwnedTemporaryDirectory({ temporaryParent: path.join(root, "artifacts/tests/nuget-feed-current") });
  const server = http.createServer((request, response) => {
    const name = request.url.split("/")[1];
    response.setHeader("Content-Type", "application/json");
    if (request.url === `/${name}/index.json`) {
      response.end(JSON.stringify({ resources: [{ "@type": "PackageBaseAddress/3.0.0",
        "@id": `http://127.0.0.1:${server.address().port}/${name}/packages/` }] }));
      return;
    }
    const entry = cases.find((item) => item.name === name);
    response.writeHead(entry.status);
    response.end(entry.body);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    for (const name of ["single-version", "missing", "http-503", "bad-json"]) await t.test(name, async () => {
      const report = path.join(owned.rootPath, `${name}.json`);
      const script = `$ErrorActionPreference='Stop'
try { & '${path.join(root, "eng/verify-feed-current.ps1").replaceAll("'", "''")}' -NuGetSource 'http://127.0.0.1:${server.address().port}/${name}/index.json' -PackageVersion '0.1.8' -ReportOutput '${report.replaceAll("'", "''")}' *> $null; $succeeded=$true }
catch { $succeeded=$false }
ConvertTo-Json -Compress @{succeeded=$succeeded}`;
      const result = await run(powershell, ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")]);
      assert.equal(result.succeeded, name === "single-version");
      if (name === "single-version" || name === "missing") {
        const value = JSON.parse(fs.readFileSync(report, "utf8").replace(/^\uFEFF/, ""));
        assert.equal(value.status, name === "single-version" ? "pass" : "fail");
        assert.equal(value.missing_declared_version_count, name === "missing" ? 3 : 0);
      } else {
        assert.equal(fs.existsSync(report), false, "Readiness must receive an unknown query, not missing-package evidence");
      }
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    const entries = fs.readdirSync(owned.rootPath);
    const bytes = entries.reduce((sum, name) => sum + fs.statSync(path.join(owned.rootPath, name)).size, 0);
    removeOwnedTemporaryDirectory(owned);
    t.diagnostic(JSON.stringify({ ownedOutputRemoved: true, files: entries.length, logicalBytes: bytes }));
  }
});
