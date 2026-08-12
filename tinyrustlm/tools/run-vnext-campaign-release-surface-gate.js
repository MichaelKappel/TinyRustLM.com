"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "..");
const releaseSurfaceTestFile = path.join(
  repositoryRoot,
  "tests",
  "vnext-campaign-release-surface.test.js"
);
const shardTimeoutMilliseconds = 21_600_000;

const releaseSurfaceShards = Object.freeze([
  Object.freeze([
    "freezes one no-compatibility campaign release surface profile",
    "attests an honest zero projection without claiming release completion",
    "attests exact complete capacity while remaining prepublication",
    "rejects stored projection, caller verdict, counter drift, and accessors"
  ]),
  Object.freeze([
    "rejects malformed web publication graphs before campaign replay",
    "rejects a valid-looking web inventory that drifts from build evidence",
    "rejects campaign, environment, and authority pin mismatches",
    "rejects failed and interrupted operation histories instead of resuming them"
  ]),
  Object.freeze([
    "records only a public-safe redaction failure when an attestation contains a known secret",
    "prepares one complete public-safe release without authorizing publication",
    "authorizes only the exact prepared manifest through current Ed25519 authority",
    "admits only an exact deployment-attempt receipt without claiming deployment"
  ]),
  Object.freeze([
    "verifies exact fixture-labeled HTTPS bytes through one immutable readback receipt",
    "publishes deterministic site descendants only after complete generated-byte readback",
    "rejects caller deployment truth and deployment-attempt binding drift"
  ]),
  Object.freeze([
    "resumes authorization after the redaction receipt committed alone",
    "rejects caller authorization truth, wrong bindings, expiry, and snapshot drift",
    "rejects an authorization key that was not active at signature issue",
    "persists only bounded redaction evidence for unsafe authorization bytes"
  ]),
  Object.freeze([
    "refuses release preparation when the fresh campaign projection is incomplete",
    "rejects incomplete artifact coverage and omitted current approved claims",
    "rejects expired claims and superseded package evidence",
    "persists only public-safe failure evidence for an unsafe changelog"
  ])
]);

function extractTopLevelTestNames(source) {
  if (typeof source !== "string") throw new TypeError("test source must be a string");
  return Array.from(source.matchAll(/^test\("([^"\r\n]+)"/gmu), (match) => match[1]);
}

function validateShardPartition(source, shards = releaseSurfaceShards) {
  if (!Array.isArray(shards) || shards.length === 0) {
    throw new Error("release gate shard partition must be a nonempty array");
  }
  const actual = extractTopLevelTestNames(source);
  const expected = [];
  const seen = new Set();
  for (const shard of shards) {
    if (!Array.isArray(shard) || shard.length === 0) {
      throw new Error("release gate shards must be nonempty arrays");
    }
    for (const name of shard) {
      if (typeof name !== "string" || name.length === 0) {
        throw new Error("release gate names must be nonempty strings");
      }
      if (seen.has(name)) throw new Error(`duplicate release gate test name: ${name}`);
      seen.add(name);
      expected.push(name);
    }
  }
  if (new Set(actual).size !== actual.length) {
    throw new Error("release surface test file contains duplicate top-level test names");
  }
  const actualSorted = [...actual].sort();
  const expectedSorted = [...expected].sort();
  if (actualSorted.length !== expectedSorted.length ||
      actualSorted.some((name, index) => name !== expectedSorted[index])) {
    const missing = actualSorted.filter((name) => !seen.has(name));
    const absent = expectedSorted.filter((name) => !actualSorted.includes(name));
    throw new Error(
      `release gate partition drift: unassigned=${JSON.stringify(missing)} ` +
      `absent=${JSON.stringify(absent)}`
    );
  }
  return Object.freeze({
    shardCount: shards.length,
    testCount: actual.length
  });
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function shardPattern(names) {
  return `^(?:${names.map(escapeRegex).join("|")})$`;
}

function terminateProcessTree(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32") {
    childProcess.spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      shell: false,
      stdio: "ignore",
      windowsHide: true
    });
    return;
  }
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

function runShard(names, index, activeChildren) {
  return new Promise((resolve) => {
    const child = childProcess.spawn(process.execPath, [
      "--test",
      `--test-name-pattern=${shardPattern(names)}`,
      path.relative(repositoryRoot, releaseSurfaceTestFile)
    ], {
      cwd: repositoryRoot,
      detached: process.platform !== "win32",
      env: process.env,
      shell: false,
      stdio: "inherit",
      windowsHide: true
    });
    activeChildren.add(child);
    process.stdout.write(
      `release-surface shard ${index + 1}/${releaseSurfaceShards.length} ` +
      `started (${names.length} tests)\n`
    );
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      terminateProcessTree(child);
    }, shardTimeoutMilliseconds);
    timeout.unref();
    child.once("error", () => {
      clearTimeout(timeout);
      activeChildren.delete(child);
      resolve({ index, status: "spawn-failed" });
    });
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      activeChildren.delete(child);
      resolve({
        code,
        index,
        signal,
        status: timedOut ? "timed-out" : code === 0 ? "passed" : "failed"
      });
    });
  });
}

async function runGate() {
  const source = fs.readFileSync(releaseSurfaceTestFile, "utf8");
  const coverage = validateShardPartition(source);
  if (process.argv.slice(2).includes("--validate-only")) {
    process.stdout.write(
      `release-surface gate partition valid: ${coverage.testCount} tests in ` +
      `${coverage.shardCount} exhaustive shards\n`
    );
    return;
  }
  if (process.argv.length !== 2) throw new Error("unknown release gate argument");

  const activeChildren = new Set();
  const stopChildren = () => {
    for (const child of activeChildren) terminateProcessTree(child);
  };
  process.once("SIGINT", stopChildren);
  process.once("SIGTERM", stopChildren);
  try {
    const results = await Promise.all(releaseSurfaceShards.map(
      (names, index) => runShard(names, index, activeChildren)
    ));
    const failures = results.filter((result) => result.status !== "passed");
    if (failures.length > 0) {
      throw new Error(`release-surface gate failed: ${JSON.stringify(failures)}`);
    }
    process.stdout.write(
      `release-surface gate passed: ${coverage.testCount}/${coverage.testCount} ` +
      `tests in ${coverage.shardCount} exhaustive shards\n`
    );
  } finally {
    process.removeListener("SIGINT", stopChildren);
    process.removeListener("SIGTERM", stopChildren);
    stopChildren();
  }
}

if (require.main === module) {
  runGate().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  extractTopLevelTestNames,
  releaseSurfaceShards,
  shardPattern,
  validateShardPartition
});
