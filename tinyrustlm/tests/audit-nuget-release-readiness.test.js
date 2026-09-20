"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const test = require("node:test");
const { verifyReportFile, validateReport } = require("../../eng/verify-release-report.js");
const { createOwnedTemporaryDirectory, removeOwnedTemporaryDirectory } =
  require("../tools/canonical-operation-scratch.js");

const root = path.resolve(__dirname, "../..");
const powershell = process.platform === "win32" ? "powershell.exe" : "pwsh";
const ids = ["TinyRustLM.Abstractions", "TinyRustLM.Core", "TinyRustLM.P2P"];
const version = "0.1.8";
const official = "https://api.nuget.org/v3/index.json";
const sources = [
  [official, true], [" NUGET.ORG ", true], [official.toUpperCase(), true],
  ["https://api.nuget.org.attacker.invalid/v3/index.json", false],
  ["https://nuget.org-attacker.invalid/v3/index.json", false],
  ["https://attacker.invalid/nuget.org/v3/index.json", false],
  ["https://api.nuget.org@attacker.invalid/v3/index.json", false],
  ["http://api.nuget.org/v3/index.json", false],
  [official + "?redirect=attacker.invalid", false], [official + "#nuget.org", false],
  ["https://api.nuget.org:444/v3/index.json", false], ["", false],
];

/** Build complete current-format observations with independently chosen package states. */
function report(states = ["current", "current", "current"]) {
  const missing = states.filter((state) => state === "missing").length;
  const stale = states.filter((state) => state === "stale").length;
  return { schema: "tinyrustlm.nuget.feed_current.v0", package_version: version,
    package_ids: ids, package_count: ids.length, allow_newer: false,
    status: missing + stale ? "fail" : "pass", missing_declared_version_count: missing,
    not_latest_count: missing + stale, packages: ids.map((id, index) => ({
      package_id: id, declared_version: version,
      declared_version_present: states[index] !== "missing",
      declared_version_is_latest_reported: states[index] === "current",
    })) };
}

const observations = [
  { name: "current", report: report(), expected: "current" },
  { name: "missing", report: report(["missing", "missing", "missing"]), expected: "missing" },
  { name: "partly-published", report: report(["current", "missing", "current"]), expected: "missing" },
  { name: "superseded", report: report(["stale", "stale", "stale"]), expected: "newer_version" },
  { name: "mixed-superseded", report: report(["missing", "stale", "current"]), expected: "newer_version" },
  ...[
    ["absent", () => null], ["wrong-schema", (r) => ({ ...r, schema: "other" })],
    ["wrong-version", (r) => ({ ...r, package_version: "0.2.0" })],
    ["allow-newer", (r) => ({ ...r, allow_newer: true })],
    ["missing-row", (r) => ({ ...r, packages: r.packages.slice(1) })],
    ["duplicate-id", (r) => ({ ...r, package_ids: [ids[0], ids[0], ids[2]] })],
    ["wrong-count", (r) => ({ ...r, package_count: 2 })],
    ["wrong-missing-count", (r) => ({ ...r, missing_declared_version_count: 1 })],
    ["wrong-latest-count", (r) => ({ ...r, not_latest_count: 1 })],
    ["invalid-status", (r) => ({ ...r, status: "invalid" })],
    ["inconsistent-status", (r) => ({ ...r, status: "fail" })],
    ["row-version", (r) => { r.packages[0].declared_version = "0.2.0"; return r; }],
    ["string-boolean", (r) => { r.packages[0].declared_version_present = "true"; return r; }],
    ["absent-but-latest", (r) => { r.packages[0].declared_version_present = false; return r; }],
  ].map(([name, change]) => ({ name, report: change(report()), expected: "unknown" })),
  { name: "failed-step-with-pass-report", report: report(), step: "fail", expected: "unknown" },
  { name: "passed-step-with-fail-report", report: report(["missing", "missing", "missing"]), step: "pass", expected: "unknown" },
  { name: "different-requested-version", report: report(), version: "0.2.0", expected: "unknown" },
  { name: "different-requested-ids", report: report(), ids: [ids[0]], expected: "unknown" },
];

/** Execute bounded interpreter checks without retaining copied source or exposing credentials. */
async function run(executable, args, input = "", environment = {}) {
  const child = spawn(executable, args, { cwd: root, windowsHide: true,
    env: { ...process.env, NODE_V8_COVERAGE: "", PYTHONDONTWRITEBYTECODE: "1", ...environment } });
  let stdout = "", stderr = "";
  const timer = setTimeout(() => child.kill(), 60000);
  child.stdout.on("data", (chunk) => { stdout += chunk; if (stdout.length > 256 * 1024) child.kill(); });
  child.stderr.on("data", (chunk) => { stderr += chunk; if (stderr.length > 256 * 1024) child.kill(); });
  const closed = once(child, "close");
  child.stdin.end(input);
  try {
    const [code] = await closed;
    assert.equal(code, 0, stderr);
    return JSON.parse(stdout.trim());
  } finally { clearTimeout(timer); }
}

/** Quote only static test paths for the PowerShell interpreter. */
function quote(value) { return "'" + value.replaceAll("'", "''") + "'"; }

/** Execute a PowerShell program in memory; canonical product source remains at its original path. */
function runPowerShell(program, environment, input = "") {
  return run(powershell, ["-NoProfile", "-NonInteractive", "-EncodedCommand",
    Buffer.from(program, "utf16le").toString("base64")], input, environment);
}

/** Check both implementations against the same independently declared behavior matrix. */
async function check(t, results) {
  for (const [index, entry] of sources.entries()) await t.test("source-" + index, () => {
    assert.equal(results.sources[index], entry[1], entry[0]);
  });
  for (const [index, entry] of observations.entries()) await t.test(entry.name, () => {
    assert.equal(results.states[index], entry.expected);
  });
}

test("PowerShell readiness admits exact feed identities and complete observations", async (t) => {
  const program = `$ErrorActionPreference='Stop'
$tokens=$null; $errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile(${quote(path.join(root, "eng/audit-nuget-release-readiness.ps1"))},[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'canonical script parse failure'}
foreach($name in @('Test-NuGetOrgSource','Get-RemoteFeedState')){
  $definition=$ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name},$true)
  if($definition.Count -ne 1){throw 'canonical function unavailable'}
  Invoke-Expression $definition[0].Extent.Text
}
$inputCases=[Console]::In.ReadToEnd() | ConvertFrom-Json
$sourceResults=@(foreach($entry in $inputCases.sources){Test-NuGetOrgSource -Source $entry[0]})
$states=@(foreach($entry in $inputCases.observations){
  $step=if($entry.step){$entry.step}elseif($entry.report){$entry.report.status}else{'fail'}
  $version=if($entry.version){$entry.version}else{'0.1.8'}
  $ids=if($entry.ids){@($entry.ids)}else{@('TinyRustLM.Abstractions','TinyRustLM.Core','TinyRustLM.P2P')}
  Get-RemoteFeedState -Report $entry.report -StepStatus $step -Version $version -PackageIds $ids
})
ConvertTo-Json -Compress -Depth 4 @{sources=$sourceResults;states=$states}`;
  await check(t, await runPowerShell(program, {}, JSON.stringify({ sources, observations })));
});

test("Bash Python readiness makes the same admission decisions", async (t) => {
  const distribution = process.env.TINYRUSTLM_FEED_TEST_WSL_DISTRIBUTION;
  const interpreter = process.platform === "win32" && distribution
    ? { exe: "wsl.exe", args: ["-d", distribution, "--exec", "python3"] }
    : { exe: process.platform === "win32" ? "python.exe" : "python3", args: [] };
  const program = `import json, sys
inputs = json.load(sys.stdin)
source = inputs["source"]
program = source.split('READINESS_STATUS=', 1)[1].split("<<'PY'\\n", 1)[1].split('\\nsteps =', 1)[0]
namespace = {}
exec(compile(program, "canonical-audit-nuget-release-readiness.sh", "exec"), namespace)
results = {"sources": [namespace["is_nuget_org_source"](entry[0]) for entry in inputs["sources"]], "states": []}
for entry in inputs["observations"]:
    report = entry["report"]
    step = entry.get("step", report.get("status", "fail") if report else "fail")
    results["states"].append(namespace["remote_feed_state"](report, step, entry.get("version", "0.1.8"), entry.get("ids", inputs["ids"])))
print(json.dumps(results))
`;
  await check(t, await run(interpreter.exe, [...interpreter.args, "-B", "-c", program], JSON.stringify({
    sources, observations, ids,
    source: fs.readFileSync(path.join(root, "eng/audit-nuget-release-readiness.sh"), "utf8").replaceAll("\r\n", "\n"),
  })));
});

test("full PowerShell readiness blocks superseded and unavailable feeds without pushing", async (t) => {
  const owned = createOwnedTemporaryDirectory({ temporaryParent: path.join(root, "artifacts/tests/nuget-readiness") });
  const feed = path.join(owned.rootPath, "feed");
  const temp = path.join(owned.rootPath, "temp");
  fs.mkdirSync(feed); fs.mkdirSync(temp);
  const packages = [], symbols = [];
  for (const id of ids) for (const extension of ["nupkg", "snupkg"]) {
    const name = `${id}.${version}.${extension}`;
    const bytes = Buffer.from("readiness fixture only; not a publishable package: " + name);
    fs.writeFileSync(path.join(feed, name), bytes);
    const item = { name, byte_count: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex") };
    (extension === "nupkg" ? packages : symbols).push(item);
  }
  const audit = path.join(owned.rootPath, "audit.json");
  fs.writeFileSync(audit, JSON.stringify({ schema: "tinyrustlm.nuget.package_audit.v1", status: "pass",
    packages, symbol_packages: symbols }));
  fs.writeFileSync(path.join(feed, "SHA256SUMS-TinyRustLM-0.1.8.txt"),
    [...packages, ...symbols].map((p) => p.sha256 + "  " + p.name).join("\n") + "\n");
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push(request.method);
    const mode = request.url.split("/")[1];
    response.setHeader("Content-Type", "application/json");
    if (request.method !== "GET") { response.writeHead(405); response.end(); return; }
    if (request.url === `/${mode}/index.json`) {
      response.end(JSON.stringify({ resources: [{ "@type": "PackageBaseAddress/3.0.0",
        "@id": `http://127.0.0.1:${server.address().port}/${mode}/packages/` }] })); return;
    }
    if (mode === "unavailable") { response.writeHead(503); response.end("{}"); return; }
    if (mode === "missing" || mode === "missing-no-key") { response.writeHead(404); response.end(); return; }
    if (request.url.endsWith("/index.json")) {
      const missing = mode === "mixed" && request.url.includes("tinyrustlm.core");
      if (missing) { response.writeHead(404); response.end(); return; }
      response.end(JSON.stringify({ versions: mode === "current" ? [version] : [version, "0.2.0"] })); return;
    }
    const name = request.url.split("/").at(-1);
    const entry = packages.find((p) => p.name.toLowerCase() === name);
    if (!entry) { response.writeHead(404); response.end(); return; }
    response.end(fs.readFileSync(path.join(feed, entry.name)));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    for (const [mode, expected, state] of [
      ["missing", "ready_to_publish", "missing"],
      ["missing-no-key", "blocked_missing_api_key", "missing"],
      ["stale", "blocked_remote_newer_version", "newer_version"],
      ["mixed", "blocked_remote_newer_version", "newer_version"],
      ["unavailable", "blocked_feed_status_unknown", "unknown"],
      ["current", "published_current", "current"],
    ]) await t.test(mode, async () => {
      const output = path.join(owned.rootPath, mode);
      fs.mkdirSync(output);
      const params = { PackageSource: feed, NuGetSource: `http://127.0.0.1:${server.address().port}/${mode}/index.json`,
        PackageVersion: version, AuditReport: audit, PublishPlanReport: path.join(output, "publish.json"),
        LocalFeedCurrentReport: path.join(output, "local-current.json"), LocalFeedHashReport: path.join(output, "local-hash.json"),
        RemoteFeedCurrentReport: path.join(output, "remote-current.json"), RemoteFeedHashReport: path.join(output, "remote-hash.json"),
        ReportOutput: path.join(output, "readiness.json"), AuthMode: "api_key",
        ApiKey: mode === "missing-no-key" ? "" : "synthetic-key-not-valid" };
      const invocation = Object.entries(params).map(([name, value]) => "-" + name + " " + quote(value)).join(" ");
      const program = `$ErrorActionPreference='Stop'
try { & ${quote(path.join(root, "eng/audit-nuget-release-readiness.ps1"))} ${invocation} -FailOnBlocked *> $null; $succeeded=$true }
catch { $succeeded=$false }
ConvertTo-Json -Compress @{succeeded=$succeeded}`;
      const result = await runPowerShell(program, { TEMP: temp, TMP: temp, TMPDIR: temp, NUGET_API_KEY: "",
        GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: root });
      const value = JSON.parse(fs.readFileSync(params.ReportOutput, "utf8").replace(/^\uFEFF/, ""));
      assert.equal(value.status, expected);
      assert.equal(value.remote_feed_state, state);
      assert.equal(result.succeeded, !expected.startsWith("blocked_"));
      assert.equal(value.package_graph_match, true);
      assert.equal(value.publish_plan_status, "dry_run");
      assert.doesNotMatch(JSON.stringify(value), /synthetic-key-not-valid/);
      if (expected.startsWith("blocked_")) assert.throws(() => verifyReportFile("readiness", params.ReportOutput));
      else verifyReportFile("readiness", params.ReportOutput);
      verifyReportFile("publish-plan", params.PublishPlanReport);
      verifyReportFile("feed-current", params.LocalFeedCurrentReport);
      verifyReportFile("feed-hashes", params.LocalFeedHashReport);
      if (mode === "current") verifyReportFile("feed-hashes", params.RemoteFeedHashReport);
    });
    assert.ok(requests.length > 0);
    assert.ok(requests.every((method) => method === "GET"), "Readiness must never submit a package");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    removeOwnedTemporaryDirectory(owned);
    assert.equal(fs.existsSync(owned.rootPath), false);
  }
});

test("full Bash readiness executes canonical scripts against a local feed", {
  skip: process.platform === "win32" && !process.env.TINYRUSTLM_FEED_TEST_WSL_DISTRIBUTION
    ? "Native Bash integration requires Unix or an explicitly selected WSL distribution." : false,
}, async (t) => {
  const distribution = process.env.TINYRUSTLM_FEED_TEST_WSL_DISTRIBUTION;
  const owned = createOwnedTemporaryDirectory({ temporaryParent: path.join(root, "artifacts/tests/nuget-readiness") });
  const interpreter = process.platform === "win32" && distribution
    ? { exe: "wsl.exe", args: ["-d", distribution, "--exec", "python3"],
        root: "/mnt/" + root[0].toLowerCase() + root.slice(2).replaceAll("\\", "/"),
        owned: "/mnt/" + owned.rootPath[0].toLowerCase() + owned.rootPath.slice(2).replaceAll("\\", "/") }
    : { exe: "python3", args: [], root, owned: owned.rootPath };
  const program = `import hashlib, json, os, subprocess, sys, threading
from http.server import BaseHTTPRequestHandler, HTTPServer
inputs = json.load(sys.stdin)
root, owned = inputs["root"], inputs["owned"]
feed, temp = os.path.join(owned, "feed"), os.path.join(owned, "temp")
os.mkdir(feed)
os.mkdir(temp)
packages, symbols = [], []
for package_id in inputs["ids"]:
    for extension, group in [("nupkg", packages), ("snupkg", symbols)]:
        name = package_id + ".0.1.8." + extension
        data = ("readiness fixture only; not a publishable package: " + name).encode()
        with open(os.path.join(feed, name), "wb") as handle: handle.write(data)
        group.append({"name": name, "byte_count": len(data), "sha256": hashlib.sha256(data).hexdigest()})
audit = os.path.join(owned, "audit.json")
with open(audit, "w") as handle:
    json.dump({"schema": "tinyrustlm.nuget.package_audit.v1", "status": "pass", "packages": packages, "symbol_packages": symbols}, handle)
with open(os.path.join(feed, "SHA256SUMS-TinyRustLM-0.1.8.txt"), "w") as handle:
    handle.write("".join(item["sha256"] + "  " + item["name"] + "\\n" for item in packages + symbols))
methods = []
class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_GET(self):
        methods.append("GET")
        mode = self.path.split("/")[1]
        if self.path == "/" + mode + "/index.json":
            status, body = 200, json.dumps({"resources": [{"@type": "PackageBaseAddress/3.0.0", "@id": "http://127.0.0.1:" + str(self.server.server_port) + "/" + mode + "/packages/"}]}).encode()
        elif mode == "unavailable":
            status, body = 503, b"{}"
        elif mode in ("missing", "missing-no-key") or (mode == "mixed" and "tinyrustlm.core" in self.path):
            status, body = 404, b""
        elif self.path.endswith("/index.json"):
            status, body = 200, json.dumps({"versions": ["0.1.8"] if mode == "current" else ["0.1.8", "0.2.0"]}).encode()
        else:
            name = self.path.rsplit("/", 1)[-1]
            item = next(item for item in packages if item["name"].lower() == name)
            with open(os.path.join(feed, item["name"]), "rb") as handle: body = handle.read()
            status = 200
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)
    def do_PUT(self):
        methods.append("PUT")
        self.send_error(405)
server = HTTPServer(("127.0.0.1", 0), Handler)
thread = threading.Thread(target=server.serve_forever)
thread.start()
results = []
try:
    for mode in ["missing", "missing-no-key", "stale", "mixed", "unavailable", "current"]:
        output = os.path.join(owned, mode)
        os.mkdir(output)
        result_path = os.path.join(output, "readiness.json")
        env = dict(os.environ, PACKAGE_VERSION="0.1.8", AUDIT_REPORT=audit, FAIL_ON_BLOCKED="1", AUTH_MODE="api_key",
            NUGET_API_KEY="" if mode == "missing-no-key" else "synthetic-key-not-valid",
            TEMP=temp, TMP=temp, TMPDIR=temp, GIT_CONFIG_COUNT="1", GIT_CONFIG_KEY_0="safe.directory", GIT_CONFIG_VALUE_0=root)
        for variable, name in [("TINYRUSTLM_PUBLISH_PLAN_REPORT", "publish"), ("TINYRUSTLM_LOCAL_FEED_CURRENT_REPORT", "local-current"),
                ("TINYRUSTLM_LOCAL_FEED_HASH_REPORT", "local-hash"), ("TINYRUSTLM_REMOTE_FEED_CURRENT_REPORT", "remote-current"),
                ("TINYRUSTLM_REMOTE_FEED_HASH_REPORT", "remote-hash")]:
            env[variable] = os.path.join(output, name + ".json")
        run = subprocess.run(["bash", os.path.join(root, "eng/audit-nuget-release-readiness.sh"), feed,
            "http://127.0.0.1:" + str(server.server_port) + "/" + mode + "/index.json", result_path],
            cwd=root, env=env, capture_output=True, text=True, timeout=30)
        with open(result_path) as handle: value = json.load(handle)
        results.append({"mode": mode, "code": run.returncode, "report": value})
finally:
    server.shutdown()
    thread.join()
    server.server_close()
print(json.dumps({"results": results, "methods": methods}))
`;
  try {
    const result = await run(interpreter.exe, [...interpreter.args, "-B", "-c", program], JSON.stringify({
      root: interpreter.root, owned: interpreter.owned, ids,
    }));
    const expected = { missing: ["ready_to_publish", "missing"], "missing-no-key": ["blocked_missing_api_key", "missing"],
      stale: ["blocked_remote_newer_version", "newer_version"], mixed: ["blocked_remote_newer_version", "newer_version"],
      unavailable: ["blocked_feed_status_unknown", "unknown"], current: ["published_current", "current"] };
    for (const row of result.results) await t.test(row.mode, () => {
      assert.deepEqual([row.report.status, row.report.remote_feed_state], expected[row.mode]);
      assert.equal(row.code, row.report.status.startsWith("blocked_") ? 1 : 0);
      assert.equal(row.report.publish_plan_status, "dry_run");
      assert.doesNotMatch(JSON.stringify(row.report), /synthetic-key-not-valid/);
      if (row.report.status.startsWith("blocked_")) assert.throws(() => validateReport("readiness", row.report));
      else validateReport("readiness", row.report);
      const output = path.join(owned.rootPath, row.mode);
      verifyReportFile("publish-plan", path.join(output, "publish.json"));
      verifyReportFile("feed-current", path.join(output, "local-current.json"));
      verifyReportFile("feed-hashes", path.join(output, "local-hash.json"));
      if (row.mode === "current") verifyReportFile("feed-hashes", path.join(output, "remote-hash.json"));
    });
    assert.equal(result.results.length, 6);
    assert.ok(result.methods.length > 0 && result.methods.every((method) => method === "GET"));
  } finally {
    removeOwnedTemporaryDirectory(owned);
    assert.equal(fs.existsSync(owned.rootPath), false);
  }
});
