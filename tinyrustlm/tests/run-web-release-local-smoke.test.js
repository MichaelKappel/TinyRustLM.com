"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  invokeLocalWebReleaseSmokeCli,
  runOwnedLocalWebReleaseSmoke
} = require("../tools/run-web-release-local-smoke.js");

const { temporaryDirectory } = require("./site-release-test-fixture.js");

const passingResult = Object.freeze({
  status: "pass",
  observationCount: 12,
  reportSha256: "a".repeat(64),
  unboundedFieldThatMustNotEscape: "discarded"
});

/** Keep synthetic output in owned artifacts; read the actual canonical site. */
function makeFixture(context) {
  const root = temporaryDirectory(context, "tinyrustlm-owned-local-smoke-test-");
  const siteRoot = path.resolve(__dirname, "..");
  const sourceRoot = path.dirname(siteRoot);
  const temporaryParent = path.join(root, "scratch");
  fs.mkdirSync(temporaryParent);
  return Object.freeze({ root, siteRoot, sourceRoot, temporaryParent });
}

test("zero-argument runner invokes the real smoke boundary once and removes its output", async (context) => {
  const fixture = makeFixture(context);
  let invocationCount = 0;
  let ownedRoot = null;

  const result = await runOwnedLocalWebReleaseSmoke({
    siteRoot: fixture.siteRoot,
    temporaryParent: fixture.temporaryParent
  }, {
    async invokeLocalWebReleaseSmokeCli(options) {
      invocationCount += 1;
      assert.equal(options.siteRoot, fs.realpathSync.native(fixture.siteRoot));
      assert.equal(fs.existsSync(options.outputDirectory), false);
      ownedRoot = path.dirname(options.outputDirectory);
      assert.equal(path.dirname(ownedRoot), fs.realpathSync.native(fixture.temporaryParent));
      assert.equal(path.relative(fixture.sourceRoot, ownedRoot).startsWith(".."), false);
      assert.equal(options.scratchDirectory, path.join(ownedRoot, "scratch"));
      assert.equal(fs.statSync(options.scratchDirectory).isDirectory(), true);
      fs.mkdirSync(options.outputDirectory);
      fs.writeFileSync(path.join(options.outputDirectory, "browser-smoke-report.json"), "{}\n");
      return passingResult;
    }
  });

  assert.equal(invocationCount, 1);
  assert.deepEqual(result, {
    status: "pass",
    observationCount: 12,
    reportSha256: "a".repeat(64),
    temporaryOutputCleanup: "verified"
  });
  assert.equal(fs.existsSync(ownedRoot), false);
});

test("runner rejects source directories outside canonical artifacts before smoke", async (context) => {
  const fixture = makeFixture(context);
  const unsafeTemporaryParent = fixture.siteRoot;
  const before = fs.readdirSync(unsafeTemporaryParent);
  let invocationCount = 0;

  await assert.rejects(
    runOwnedLocalWebReleaseSmoke({
      siteRoot: fixture.siteRoot,
      temporaryParent: unsafeTemporaryParent
    }, {
      async invokeLocalWebReleaseSmokeCli() {
        invocationCount += 1;
        return passingResult;
      }
    }),
    (error) => {
      assert.equal(error.code, "LOCAL_WEB_RELEASE_SMOKE_SETUP_FAILED");
      assert.equal(error.temporaryOutputCleanup, "not-created");
      return true;
    }
  );
  assert.equal(invocationCount, 0);
  assert.deepEqual(
    fs.readdirSync(unsafeTemporaryParent),
    before
  );
});

test("runner cleans owned output when the Chromium smoke fails", async (context) => {
  const fixture = makeFixture(context);
  let invocationCount = 0;
  let ownedRoot = null;

  await assert.rejects(
    runOwnedLocalWebReleaseSmoke({
      siteRoot: fixture.siteRoot,
      temporaryParent: fixture.temporaryParent
    }, {
      async invokeLocalWebReleaseSmokeCli(options) {
        invocationCount += 1;
        ownedRoot = path.dirname(options.outputDirectory);
        fs.mkdirSync(options.outputDirectory);
        throw new Error("synthetic Chromium failure");
      }
    }),
    (error) => {
      assert.equal(error.code, "LOCAL_WEB_RELEASE_SMOKE_FAILED");
      assert.equal(error.temporaryOutputCleanup, "verified");
      return true;
    }
  );
  assert.equal(invocationCount, 1);
  assert.equal(fs.existsSync(ownedRoot), false);
});

test("runner fails closed and preserves a root whose ownership marker changed", async (context) => {
  const fixture = makeFixture(context);
  let invocationCount = 0;
  let ownedRoot = null;

  await assert.rejects(
    runOwnedLocalWebReleaseSmoke({
      siteRoot: fixture.siteRoot,
      temporaryParent: fixture.temporaryParent
    }, {
      async invokeLocalWebReleaseSmokeCli(options) {
        invocationCount += 1;
        ownedRoot = path.dirname(options.outputDirectory);
        const markerPath = ownedRoot + ".owner.v2";
        assert.ok(fs.existsSync(markerPath));
        fs.writeFileSync(markerPath, "changed\n");
        return passingResult;
      }
    }),
    (error) => {
      assert.equal(error.code, "LOCAL_WEB_RELEASE_SMOKE_CLEANUP_FAILED");
      assert.equal(error.temporaryOutputCleanup, "failed");
      return true;
    }
  );
  assert.equal(invocationCount, 1);
  assert.equal(fs.existsSync(ownedRoot), true);
});

test("CLI invocation binds all child temp variables and launches the explicit smoke once", async (context) => {
  const fixture = makeFixture(context);
  const outputDirectory = path.join(fixture.temporaryParent, "evidence");
  const scratchDirectory = path.join(fixture.temporaryParent, "scratch");
  fs.mkdirSync(scratchDirectory);
  let invocationCount = 0;

  const result = await invokeLocalWebReleaseSmokeCli({
    outputDirectory,
    scratchDirectory,
    signal: context.signal,
    siteRoot: fixture.siteRoot
  }, {
    execFile(executable, args, options, callback) {
      invocationCount += 1;
      assert.equal(executable, process.execPath);
      assert.equal(path.basename(args[0]), "web-release-local-smoke.js");
      assert.deepEqual(args.slice(1), [outputDirectory, fixture.siteRoot]);
      assert.equal(options.cwd, fixture.siteRoot);
      assert.equal(options.env.TEMP, scratchDirectory);
      assert.equal(options.env.TMP, scratchDirectory);
      assert.equal(options.env.TMPDIR, scratchDirectory);
      assert.equal(options.env.NODE_TEST_CONTEXT, undefined);
      assert.equal(options.signal, context.signal);
      callback(null, `${JSON.stringify(passingResult)}\n`, "");
    }
  });

  assert.equal(invocationCount, 1);
  assert.deepEqual(result, {
    status: "pass",
    observationCount: 12,
    reportSha256: "a".repeat(64)
  });
});

test("package command uses the runner while the explicit evidence CLI remains available", () => {
  const packageJson = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, "..", "package.json"), "utf8"
  ));
  assert.equal(
    packageJson.scripts["smoke:web-release-local"],
    "node tools/run-web-release-local-smoke.js"
  );

  const explicitCli = fs.readFileSync(
    path.resolve(__dirname, "..", "tools", "web-release-local-smoke.js"),
    "utf8"
  );
  assert.match(explicitCli,
    /Usage: web-release-local-smoke\.js <new-output-directory> \[site-root\]/);
});

test("runner rejects incomplete success results and still removes operation output", async (context) => {
  const fixture = makeFixture(context);
  for (const result of [null, { ...passingResult, status: "fail" },
    { ...passingResult, observationCount: 0 }, { ...passingResult, observationCount: 13 },
    { ...passingResult, reportSha256: "not-a-digest" }]) {
    await assert.rejects(runOwnedLocalWebReleaseSmoke(fixture, {
      async invokeLocalWebReleaseSmokeCli() { return result; }
    }), (error) => error.code === "LOCAL_WEB_RELEASE_SMOKE_FAILED" &&
      error.temporaryOutputCleanup === "verified");
    assert.deepEqual(fs.readdirSync(fixture.temporaryParent), []);
  }
});

test("CLI invocation rejects process failure, stderr, and malformed result envelopes", async (context) => {
  const fixture = makeFixture(context);
  const options = { siteRoot: fixture.siteRoot, scratchDirectory: fixture.temporaryParent,
    outputDirectory: path.join(fixture.temporaryParent, "evidence") };
  for (const [error, stdout, stderr] of [
    [new Error("synthetic child failure"), "", ""],
    [null, JSON.stringify(passingResult), "unexpected"],
    [null, "", ""], [null, "{}\n{}", ""], [null, "not-json", ""]
  ]) {
    await assert.rejects(invokeLocalWebReleaseSmokeCli(options, {
      execFile(_executable, _args, _options, callback) { callback(error, stdout, stderr); }
    }));
  }
});

test("an already-cancelled CLI invocation cannot start browser work", async (context) => {
  const fixture = makeFixture(context);
  const controller = new AbortController();
  controller.abort();
  const outputDirectory = path.join(fixture.temporaryParent, "never-started");
  await assert.rejects(invokeLocalWebReleaseSmokeCli({
    outputDirectory, siteRoot: fixture.siteRoot,
    scratchDirectory: fixture.temporaryParent, signal: controller.signal
  }), (error) => error.code === "ABORT_ERR");
  assert.equal(fs.existsSync(outputDirectory), false);
});
