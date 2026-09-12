"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const capability = require("../app/companion-capability.js");
const {
  findCompiledPrerequisites,
  outputIsCurrent
} = require("./companion-direct-seed-wire-host-helper.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const { temporaryDirectory } = require("./site-release-test-fixture.js");
const hostMetadataSchema = "tinyrustlm.test.companion-direct-seed-wire-host.v1";

/** Require evidence paths to remain inside the operation-owned fixture state. */
function isDirectChildOf(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative.length > 0 && relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

/** Keep failure diagnostics bounded and remove operation-local filesystem paths. */
function boundedText(chunks, replacementRoots) {
  const text = Buffer.concat(chunks).toString("utf8");
  return replacementRoots.reduce(
    (value, root) => value.replaceAll(root, "<owned-path>"),
    text
  ).slice(-8_192);
}

/** Read one bounded host metadata record and fail on early exit or timeout. */
function waitForHostLine(child, stderr, timeoutMs) {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    let buffered = "";
    const timer = setTimeout(() => finish(new Error("direct-seed-wire-host-timeout")), timeoutMs);
    const onData = (chunk) => {
      bytes += chunk.byteLength;
      if (bytes > 16_384) {
        finish(new Error("direct-seed-wire-host-output-limit"));
        return;
      }
      buffered += chunk.toString("utf8");
      const newline = buffered.indexOf("\n");
      if (newline >= 0) finish(null, buffered.slice(0, newline).trimEnd());
    };
    const onExit = (code, signal) => finish(new Error(
      `direct-seed-wire-host-early-exit:${code}:${signal || "none"}:${stderr()}`
    ));
    const onError = (error) => finish(error);
    /** Detach listeners once the metadata read has settled. */
    function finish(error, value) {
      clearTimeout(timer);
      child.stdout.off("data", onData);
      child.off("exit", onExit);
      child.off("error", onError);
      if (error) reject(error);
      else resolve(value);
    }
    child.stdout.on("data", onData);
    child.once("exit", onExit);
    child.once("error", onError);
  });
}

/** Observe process termination within the caller's shutdown deadline. */
function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("direct-seed-wire-process-exit-timeout"));
    }, timeoutMs);
    const onExit = (code, signal) => {
      cleanup();
      resolve({ code, signal });
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    /** Remove the exit deadline and listeners after a terminal observation. */
    function cleanup() {
      clearTimeout(timer);
      child.off("exit", onExit);
      child.off("error", onError);
    }
    child.once("exit", onExit);
    child.once("error", onError);
  });
}

/** Test whether a recorded fixture process still exists. */
function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error && error.code === "EPERM";
  }
}

/** Require the exact recorded fixture process to terminate before cleanup. */
async function waitForProcessExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!processExists(pid)) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(processExists(pid), false, `owned fixture process ${pid} remained alive`);
}

/** Accept only a live new fixture PID recorded beneath the owned state root. */
async function waitForNewProcessEvidence(file, previousPid) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      const text = (await fsp.readFile(file, "utf8")).trim();
      if (/^[1-9][0-9]{0,9}$/u.test(text)) {
        const pid = Number(text);
        if (Number.isSafeInteger(pid) && pid !== previousPid && processExists(pid)) {
          return pid;
        }
      }
    } catch (error) {
      if (!error || error.code !== "ENOENT") throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("direct-seed-wire-process-evidence-timeout");
}

/** Shut down the owned host and its recorded fixture children after test failure. */
async function forceStopOwnedProcess(child, fixturePids) {
  if (child && child.pid && processExists(child.pid)) {
    try {
      child.stdin.write("shutdown\n");
      child.stdin.end();
      await waitForExit(child, 5_000);
    } catch (_error) {
      if (process.platform === "win32") {
        childProcess.spawnSync(
          "taskkill",
          ["/PID", String(child.pid), "/T", "/F"],
          { shell: false, stdio: "ignore", windowsHide: true }
        );
      } else {
        try { child.kill("SIGKILL"); } catch (_error2) {}
      }
    }
  }
  for (const pid of fixturePids) {
    if (!processExists(pid)) continue;
    try { process.kill(pid, "SIGKILL"); } catch (_error) {}
    await waitForProcessExit(pid, 5_000);
  }
}

/** Require the production wire projection to bind the requested active operation. */
function assertReadyProjection(projection, operationId) {
  assert.equal(projection.operationId, operationId);
  assert.equal(projection.sequence, 1);
  assert.equal(projection.state, "ready");
  assert.match(projection.compositionId, /^sha256:[0-9a-f]{64}$/u);
  assert.equal(projection.protocol, capability.DIRECT_COMPOSITION_SEED_PROTOCOL);
  assert.match(projection.boundOrigin, /^http:\/\/127[.]0[.]0[.]1:[1-9][0-9]{3,4}$/u);
  assert.equal(projection.allowedBrowserOrigin, capability.PRODUCTION_ORIGIN);
  assert.equal(projection.terminalCode, null);
}

/** Require terminal stop to preserve identity and withdraw the serving endpoint. */
function assertStoppedProjection(projection, ready) {
  assert.equal(projection.operationId, ready.operationId);
  assert.equal(projection.compositionId, ready.compositionId);
  assert.equal(projection.sequence, 2);
  assert.equal(projection.state, "stopped");
  assert.equal(projection.protocol, null);
  assert.equal(projection.boundOrigin, null);
  assert.equal(projection.allowedBrowserOrigin, null);
  assert.equal(projection.terminalCode, "direct-composition-seed-launch-stopped");
}

test("production JS client drives the real C# multi-seed loopback wire", {
  timeout: 180_000
}, async (t) => {
  if (typeof fetch !== "function" || typeof Headers !== "function") {
    t.skip("requires a Node runtime with the Fetch and Web Crypto APIs");
    return;
  }
  const dotnet = childProcess.spawnSync("dotnet", ["--version"], {
    shell: false,
    encoding: "utf8",
    windowsHide: true
  });
  if (dotnet.error || dotnet.status !== 0) {
    t.skip("requires an installed dotnet SDK");
    return;
  }
  const prerequisites = findCompiledPrerequisites();
  if (!prerequisites) {
    t.skip(
      "requires a Debug or Release TinyRustLM.Companion.Tests build including its three fixture tools"
    );
    return;
  }
  if (!outputIsCurrent(prerequisites)) {
    t.skip(
      `requires a current ${prerequisites.configuration} TinyRustLM.Companion.Tests and fixture-tool build`
    );
    return;
  }

  const ownedRoot = temporaryDirectory(t, "tinyrustlm-direct-seed-wire-");
  const childTemp = path.join(ownedRoot, "temp");
  const dotnetHome = path.join(ownedRoot, "dotnet-home");
  await Promise.all([
    fsp.mkdir(childTemp),
    fsp.mkdir(dotnetHome)
  ]);
  const environment = {
    ...process.env,
    TEMP: childTemp,
    TMP: childTemp,
    DOTNET_CLI_HOME: dotnetHome,
    DOTNET_CLI_TELEMETRY_OPTOUT: "1",
    DOTNET_GENERATE_ASPNET_CERTIFICATE: "false",
    DOTNET_CLI_USE_MSBUILD_SERVER: "0",
    DOTNET_NOLOGO: "1",
    MSBUILDDISABLENODEREUSE: "1"
  };

  const fixturePids = new Set();
  let host = null;
  let client = null;
  try {
    const helperDll = prerequisites.hostAssembly;
    const fixtureRoot = path.join(ownedRoot, "fixture-state");
    await fsp.mkdir(fixtureRoot);
    let hostStderr = "";
    host = childProcess.spawn("dotnet", [
      helperDll,
      prerequisites.testAssembly,
      fixtureRoot
    ], {
      cwd: repositoryRoot,
      env: environment,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    host.stderr.on("data", (chunk) => {
      if (Buffer.byteLength(hostStderr) < 16_384) hostStderr += chunk.toString("utf8");
    });
    const metadataLine = await waitForHostLine(
      host,
      () => boundedText([Buffer.from(hostStderr)], [ownedRoot, repositoryRoot]),
      45_000
    );
    const metadata = JSON.parse(metadataLine);
    assert.deepEqual(Object.keys(metadata), [
      "schema",
      "localOnly",
      "fixtureKind",
      "host",
      "pairingCode",
      "operationIds",
      "processEvidencePath"
    ]);
    assert.equal(metadata.schema, hostMetadataSchema);
    assert.equal(metadata.localOnly, true);
    assert.equal(metadata.fixtureKind, "synthetic-immutable-composition");
    assert.match(metadata.host, /^127[.]0[.]0[.]1:[1-9][0-9]{3,4}$/u);
    assert.match(metadata.pairingCode, /^TRLC1:[1-9][0-9]{3,4}:[A-Za-z0-9_-]{43}$/u);
    assert.equal(Array.isArray(metadata.operationIds), true);
    assert.equal(metadata.operationIds.length, 5);
    assert.equal(new Set(metadata.operationIds).size, 5);
    for (const operationId of metadata.operationIds) {
      assert.match(operationId, /^[0-9a-f]{64}$/u);
    }
    const processEvidencePath = path.resolve(metadata.processEvidencePath);
    assert.equal(isDirectChildOf(fixtureRoot, processEvidencePath), true);

    const expectedOrigin = `http://${metadata.host}`;
    const browserFetch = (url, options = {}) => {
      const target = new URL(url);
      assert.equal(target.origin, expectedOrigin);
      assert.equal(target.hostname, "127.0.0.1");
      const headers = new Headers(options.headers || {});
      headers.set("Origin", capability.PRODUCTION_ORIGIN);
      return fetch(url, { ...options, headers });
    };
    client = new capability.CompanionCapabilityClient({
      fetch: browserFetch,
      timeoutMilliseconds: 15_000
    });
    const session = await client.pair(metadata.pairingCode);
    assert.deepEqual(session, client.session);
    assert.match(session.installationId, /^[0-9a-f]{32}$/u);
    assert.match(session.processInstanceId, /^[0-9a-f]{32}$/u);
    assert.match(session.sessionId, /^[0-9a-f]{32}$/u);
    assert.equal(session.keyEpoch, 1);
    assert.equal(session.nextSequence, 1);
    assert.equal(client.isPaired, true);

    const ready = [];
    let previousPid = 0;
    for (const operationId of metadata.operationIds.slice(0, 4)) {
      const projection = await client.startDirectCompositionSeed(operationId);
      assertReadyProjection(projection, operationId);
      const pid = await waitForNewProcessEvidence(processEvidencePath, previousPid);
      fixturePids.add(pid);
      previousPid = pid;
      ready.push(projection);
    }
    assert.equal(fixturePids.size, 4);
    assert.notEqual(
      ready[0].compositionId,
      ready[1].compositionId,
      "the canonical fixture data variant must produce a second content identity"
    );
    assert.deepEqual(
      await client.readDirectCompositionSeed(metadata.operationIds[0]),
      ready[0]
    );
    assert.deepEqual(
      await client.readDirectCompositionSeed(metadata.operationIds[1]),
      ready[1]
    );

    const duplicate = await client.startDirectCompositionSeed(metadata.operationIds[0]);
    assert.deepEqual(duplicate, ready[0]);
    assert.equal(
      Number((await fsp.readFile(processEvidencePath, "utf8")).trim()),
      previousPid,
      "duplicate start must not launch another child"
    );
    await assert.rejects(
      client.startDirectCompositionSeed(metadata.operationIds[4]),
      (error) => error instanceof capability.CompanionCapabilityError &&
        error.code === "direct-composition-seed-resource-limit" &&
        error.status === 409
    );
    assert.equal(client.isPaired, true);
    assert.deepEqual(
      await client.readDirectCompositionSeed(metadata.operationIds[1]),
      ready[1]
    );

    const firstStopped = await client.stopDirectCompositionSeed(metadata.operationIds[0]);
    assertStoppedProjection(firstStopped, ready[0]);
    await waitForProcessExit([...fixturePids][0], 5_000);
    assert.deepEqual(
      await client.readDirectCompositionSeed(metadata.operationIds[1]),
      ready[1],
      "stopping one lifecycle must not affect another"
    );
    assert.deepEqual(
      await client.stopDirectCompositionSeed(metadata.operationIds[0]),
      firstStopped,
      "terminal stop must be idempotent"
    );

    for (let index = 1; index < ready.length; index += 1) {
      const stopped = await client.stopDirectCompositionSeed(metadata.operationIds[index]);
      assertStoppedProjection(stopped, ready[index]);
      await waitForProcessExit([...fixturePids][index], 5_000);
    }
    await client.revoke();
    assert.equal(client.isPaired, false);

    const hostPid = host.pid;
    host.stdin.write("shutdown\n");
    host.stdin.end();
    const hostExit = await waitForExit(host, 15_000);
    assert.deepEqual(hostExit, { code: 0, signal: null });
    await waitForProcessExit(hostPid, 5_000);
    for (const pid of fixturePids) await waitForProcessExit(pid, 5_000);
    host = null;
    client = null;
  } finally {
    if (client) client.close();
    await forceStopOwnedProcess(host, fixturePids);
    // The shared ownership-checked after hook removes all fixture state after process shutdown.
  }
});
