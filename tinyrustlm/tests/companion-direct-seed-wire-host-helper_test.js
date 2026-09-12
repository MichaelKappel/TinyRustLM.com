"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");
const test = require("node:test");
const { findCompiledPrerequisites, outputIsCurrent } = require("./companion-direct-seed-wire-host-helper.js");

test("native prerequisites select one complete canonical configuration", (t) => {
  let configuration = "all";
  t.mock.method(fs, "existsSync", file => configuration === "all" ||
    (configuration === "Release" && !file.includes(path.sep + "Debug" + path.sep)));
  const debug = findCompiledPrerequisites();
  assert.equal(debug.configuration, "Debug");
  assert.equal(debug.hostAssembly.includes(path.join("dotnet", "tools", "TinyRustLM.DirectSeedWireFixtureTool", "bin", "Debug")), true);
  configuration = "Release";
  assert.equal(findCompiledPrerequisites().configuration, "Release");
  configuration = "none";
  assert.equal(findCompiledPrerequisites(), null);
});

test("native freshness checks reject each stale exercised binary", (t) => {
  t.mock.method(fs, "existsSync", () => true);
  const prerequisites = findCompiledPrerequisites();
  const binaryFiles = [prerequisites.testAssembly, prerequisites.hostAssembly,
    prerequisites.conversionFixtureExecutable, prerequisites.seedFixtureExecutable];
  let stale = null;
  t.mock.method(fs, "statSync", file => ({mtimeMs: file === stale ? 5 : binaryFiles.includes(file) ? 20 : 10}));
  assert.equal(outputIsCurrent(prerequisites), true);
  for (const file of binaryFiles) {
    stale = file;
    assert.equal(outputIsCurrent(prerequisites), false, path.basename(stale));
  }
});

test("native fixture host rejects missing arguments and an unavailable test assembly", t => {
  const prerequisites = findCompiledPrerequisites();
  if (!prerequisites) { t.skip("requires canonical native fixture build"); return; }
  for (const [args, code, message] of [
    [[], 2, "arguments"],
    [[path.join(__dirname, "absent-native-test-assembly.dll"), __dirname], 1, "FileNotFoundException"],
  ]) {
    const result = childProcess.spawnSync("dotnet", [prerequisites.hostAssembly, ...args],
      {encoding:"utf8",windowsHide:true,timeout:10000});
    assert.equal(result.error, undefined);
    assert.equal(result.status, code, result.stderr + result.stdout);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr.trim(), "direct-seed-wire-host-failed:" + message);
  }
});
