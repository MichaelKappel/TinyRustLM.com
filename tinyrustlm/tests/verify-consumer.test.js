"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { verifyConsumer, resolveSource, nativeAssetRelativePath } = require("../../eng/verify-consumer.js");
const { createOwnedTemporaryDirectory, removeOwnedTemporaryDirectory } =
  require("../tools/canonical-operation-scratch.js");

const root = path.resolve(__dirname, "../..");
const parent = path.join(root, "artifacts/tests/nuget-consumer");

/** Keep fixture feeds distinct from the consumer's own cleanup authority. */
function withFeed(action) {
  const owned = createOwnedTemporaryDirectory({ temporaryParent: path.join(root, "artifacts/tests/nuget-consumer-fixtures") });
  try { return action(owned.rootPath); }
  finally { removeOwnedTemporaryDirectory(owned); }
}

/** Read only direct source names, so an accidental source copy or generated source output is visible. */
function sourceNames() {
  return fs.readdirSync(path.join(root, "eng/consumer-smoke")).sort();
}

test("canonical consumer keeps exact package-only references and no project-reference escape", () => {
  const source = fs.readFileSync(path.join(root, "eng/consumer-smoke/TinyRustLM.ConsumerSmoke.csproj"), "utf8");
  assert.equal((source.match(/Version="\[\$\(TinyRustLmConsumerPackageVersion\)\]"/g) || []).length, 5);
  assert.doesNotMatch(source, /ProjectReference/);
  assert.match(source, /TinyRustLmConsumerMemoryEndpoints/);
  assert.match(source, /TinyRustLmConsumerConversion/);
});

test("native asset selection covers exactly the advertised host and architecture pairs", () => {
  for (const [platform, architecture, rid, file] of [
    ["win32", "x64", "win-x64", "tinyrustlm_native.dll"],
    ["linux", "x64", "linux-x64", "libtinyrustlm_native.so"],
    ["linux", "arm64", "linux-arm64", "libtinyrustlm_native.so"]
  ]) {
    assert.equal(nativeAssetRelativePath(platform, architecture), path.join("runtimes", rid, "native", file));
  }
  for (const [platform, architecture] of [["win32", "arm64"], ["win32", "ia32"],
    ["linux", "arm"], ["darwin", "x64"], ["darwin", "arm64"], ["win", "x64"]]) {
    assert.throws(() => nativeAssetRelativePath(platform, architecture), /Unsupported package consumer/);
  }
});

test("package verification binds every child to its own native output despite a parent override", () => withFeed((feed) => {
  const prior = process.env.TINYRUSTLM_NATIVE_PATH;
  const poisoned = path.join(feed, "outside-consumer-native-library");
  process.env.TINYRUSTLM_NATIVE_PATH = poisoned;
  let calls = 0;
  try {
    verifyConsumer(feed, "0.1.8", (_args, options) => {
      calls++;
      const ownedRoot = path.dirname(options.env.NUGET_PACKAGES);
      const rid = `${process.platform === "win32" ? "win" : process.platform}-${process.arch}`;
      const fileName = process.platform === "win32" ? "tinyrustlm_native.dll" : "libtinyrustlm_native.so";
      assert.equal(options.env.TINYRUSTLM_NATIVE_PATH,
        path.join(ownedRoot, "bin/Release/net8.0/runtimes", rid, "native", fileName));
    });
    assert.equal(calls, 3);
    assert.equal(process.env.TINYRUSTLM_NATIVE_PATH, poisoned);
  } finally {
    if (prior === undefined) delete process.env.TINYRUSTLM_NATIVE_PATH;
    else process.env.TINYRUSTLM_NATIVE_PATH = prior;
  }
}));

test("relative feeds stay absolute and consumer stages use canonical source with isolated output", () => withFeed((feed) => {
  const originalEnvironment = { ...process.env };
  const before = sourceNames();
  const calls = [];
  let ownedRoot;
  const result = verifyConsumer(path.relative(process.cwd(), feed), "0.1.8", (args, options) => {
    calls.push(args);
    ownedRoot = path.dirname(options.env.NUGET_PACKAGES);
    assert.equal(path.dirname(ownedRoot), parent);
    assert.equal(options.cwd, root);
    assert.equal(options.env.DOTNET_GENERATE_ASPNET_CERTIFICATE, "false");
    for (const key of ["NUGET_PACKAGES", "NUGET_HTTP_CACHE_PATH", "NUGET_PLUGINS_CACHE_PATH", "DOTNET_CLI_HOME", "TEMP", "TMP", "TMPDIR"]) {
      assert.equal(path.dirname(options.env[key]), ownedRoot, key);
    }
    if (calls.length < 3) {
      assert.equal(args[1], path.join(root, "eng/consumer-smoke/TinyRustLM.ConsumerSmoke.csproj"));
      assert.ok(args.includes("-p:TinyRustLmConsumerPackageVersion=0.1.8"));
      assert.ok(args.includes("-p:UseArtifactsOutput=false"));
      for (const key of ["BaseIntermediateOutputPath", "MSBuildProjectExtensionsPath", "BaseOutputPath"]) {
        const value = args.find((arg) => arg.startsWith(`-p:${key}=`)).split("=")[1];
        assert.equal(path.dirname(path.resolve(value)), ownedRoot);
      }
    }
    assert.equal(fs.existsSync(path.join(ownedRoot, "Program.cs")), false);
  });
  assert.deepEqual(result.packageIds, ["TinyRustLM.Abstractions", "TinyRustLM.Core", "TinyRustLM.P2P"]);
  assert.equal(calls[0][3], fs.realpathSync(feed));
  assert.equal(calls[1][0], "build");
  assert.deepEqual(calls[2].slice(-2), ["absent", "absent"]);
  assert.equal(fs.existsSync(ownedRoot), false);
  assert.deepEqual(sourceNames(), before);
  assert.deepEqual({ ...process.env }, originalEnvironment);
}));

for (const flags of [[true, false], [false, true], [true, true]]) {
  test(`optional package selection remains independent: ${flags.join(",")}`, () => withFeed((feed) => {
    for (const [index, id] of ["TinyRustLM.MemoryEndpoints", "TinyRustLM.Conversion"].entries()) {
      if (flags[index]) fs.writeFileSync(path.join(feed, `${id}.0.1.8.nupkg`), "selection fixture, not a package");
    }
    const calls = [];
    const result = verifyConsumer(feed, "0.1.8", (args) => calls.push(args));
    assert.deepEqual([result.optionalMemoryEndpoints, result.privateConversion], flags);
    assert.deepEqual(calls[2].slice(-2), flags.map((flag) => flag ? "required" : "absent"));
  }));
}

for (const failingStage of [1, 2, 3]) {
  test(`stage ${failingStage} failure stops execution and retires owned output`, () => withFeed((feed) => {
    let calls = 0, ownedRoot;
    assert.throws(() => verifyConsumer(feed, "0.1.8", (_args, options) => {
      ownedRoot = path.dirname(options.env.NUGET_PACKAGES);
      fs.writeFileSync(path.join(ownedRoot, `stage-${++calls}.txt`), "partial output");
      if (calls === failingStage) throw new Error("controlled stage failure");
    }), /controlled stage failure/);
    assert.equal(calls, failingStage);
    assert.equal(fs.existsSync(ownedRoot), false);
    assert.equal(fs.existsSync(feed), true);
  }));
}

test("HTTP feeds do not infer optional packages from local files", () => {
  const calls = [];
  const result = verifyConsumer("https://example.invalid/v3/index.json", "0.1.8-beta.2+build.4", (args) => calls.push(args));
  assert.deepEqual([result.optionalMemoryEndpoints, result.privateConversion], [false, false]);
  assert.equal(calls[0][3], "https://example.invalid/v3/index.json");
  assert.equal(resolveSource("http://127.0.0.1:1234/index.json").local, false);
});

test("invalid sources and versions fail before starting dotnet", () => withFeed((feed) => {
  for (const version of [undefined, "", "*", "[0.1.8,)", "0.1.8;Other=1", "0.1"]) {
    assert.throws(() => verifyConsumer(feed, version, () => assert.fail("must not run")), /exact package version/);
  }
  assert.throws(() => resolveSource(""), /source is required/);
  assert.throws(() => resolveSource(path.join(feed, "missing")), /does not exist/);
  assert.throws(() => resolveSource("nonexistent-relative-consumer-feed"), /does not exist/);
  assert.throws(() => resolveSource("ftp://example.invalid/packages"), /Unsupported/);
  fs.writeFileSync(path.join(feed, "file"), "not a folder");
  assert.throws(() => resolveSource(path.join(feed, "file")), /must be a directory/);
}));

test("CLI rejects incomplete arguments without allocating output", () => {
  const before = fs.readdirSync(parent);
  const result = spawnSync(process.execPath, [path.join(root, "eng/verify-consumer.js")], {
    encoding: "utf8", windowsHide: true, timeout: 10000,
    env: { ...process.env, NODE_V8_COVERAGE: "" },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Expected package source and exact version/);
  assert.deepEqual(fs.readdirSync(parent), before);
});

test("real CLI launch failure propagates and cleans up when dotnet is unavailable", () => withFeed((feed) => {
  const before = fs.readdirSync(parent);
  const environment = { ...process.env, NODE_V8_COVERAGE: "" };
  for (const key of Object.keys(environment)) if (key.toUpperCase() === "PATH") delete environment[key];
  environment.PATH = "";
  const result = spawnSync(process.execPath, [path.join(root, "eng/verify-consumer.js"), feed, "0.1.8"], {
    encoding: "utf8", windowsHide: true, timeout: 10000, env: environment,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Consumer dotnet stage failed/);
  assert.deepEqual(fs.readdirSync(parent), before);
}));
