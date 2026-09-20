"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createOwnedTemporaryDirectory, removeOwnedTemporaryDirectory } =
  require("../tinyrustlm/tools/canonical-operation-scratch.js");

const repositoryRoot = path.resolve(__dirname, "..");
const project = path.join(__dirname, "consumer-smoke/TinyRustLM.ConsumerSmoke.csproj");
const packageIds = ["TinyRustLM.Abstractions", "TinyRustLM.Core", "TinyRustLM.P2P"];

/** Run one bounded dotnet stage; a failed stage cannot reach the next stage. */
function invokeDotnet(args, options) {
  const result = spawnSync("dotnet", args, {
    ...options, encoding: "utf8", windowsHide: true, timeout: 600_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error || result.status !== 0) throw new Error("Consumer dotnet stage failed.");
}

/** Bind a local feed before changing directory; leave explicit HTTP(S) feeds to NuGet. */
function resolveSource(source) {
  if (typeof source !== "string" || !source.trim()) throw new Error("Package source is required.");
  const candidate = path.resolve(source);
  if (fs.existsSync(candidate)) {
    if (!fs.statSync(candidate).isDirectory()) throw new Error("Package source must be a directory.");
    return { value: fs.realpathSync(candidate), local: true };
  }
  if (path.isAbsolute(source)) throw new Error("Package source directory does not exist.");
  let url;
  try { url = new URL(source); } catch { throw new Error("Package source directory does not exist."); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Unsupported package source.");
  return { value: source, local: false };
}

/** Map Node platform/architecture identifiers to an advertised native package asset. */
function nativeAssetRelativePath(platform = process.platform, architecture = process.arch) {
  const rid = `${platform === "win32" ? "win" : platform}-${architecture}`;
  if (!["win32", "linux"].includes(platform) || !["win-x64", "linux-x64", "linux-arm64"].includes(rid)) {
    throw new Error("Unsupported package consumer platform or architecture.");
  }
  return path.join("runtimes", rid, "native",
    platform === "win32" ? "tinyrustlm_native.dll" : "libtinyrustlm_native.so");
}

/** Compile canonical source against exact package bytes with mutable output owned locally.
 * The optional runner is a test seam; the CLI always invokes the real dotnet process.
 */
function verifyConsumer(source, version, runner = invokeDotnet) {
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?(?:\+[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(version)) {
    throw new Error("An exact package version is required.");
  }
  const feed = resolveSource(source);
  const nativeAsset = nativeAssetRelativePath();
  const optional = (id) => feed.local && fs.existsSync(path.join(feed.value, `${id}.${version}.nupkg`));
  const memory = optional("TinyRustLM.MemoryEndpoints");
  const conversion = optional("TinyRustLM.Conversion");
  const owned = createOwnedTemporaryDirectory({
    temporaryParent: path.join(repositoryRoot, "artifacts/tests/nuget-consumer"),
  });
  try {
    const directory = (name) => {
      const value = path.join(owned.rootPath, name);
      fs.mkdirSync(value);
      return value;
    };
    const work = directory("work");
    const temp = directory("temp");
    const environment = {
      ...process.env,
      NUGET_PACKAGES: directory("packages"),
      NUGET_HTTP_CACHE_PATH: directory("http-cache"),
      NUGET_PLUGINS_CACHE_PATH: directory("plugins-cache"),
      DOTNET_CLI_HOME: directory("dotnet-home"),
      DOTNET_CLI_TELEMETRY_OPTOUT: "1",
      DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1",
      DOTNET_GENERATE_ASPNET_CERTIFICATE: "false",
      MSBUILDDISABLENODEREUSE: "1",
      // A developer override or global loader path must not substitute for a missing package asset.
      TINYRUSTLM_NATIVE_PATH: path.join(owned.rootPath, "bin/Release/net8.0", nativeAsset),
      TEMP: temp, TMP: temp, TMPDIR: temp,
    };
    const properties = [
      "-p:UseArtifactsOutput=false",
      `-p:TinyRustLmConsumerPackageVersion=${version}`,
      `-p:TinyRustLmConsumerMemoryEndpoints=${memory}`,
      `-p:TinyRustLmConsumerConversion=${conversion}`,
      `-p:BaseIntermediateOutputPath=${path.join(owned.rootPath, "obj")}${path.sep}`,
      `-p:MSBuildProjectExtensionsPath=${path.join(owned.rootPath, "obj")}${path.sep}`,
      `-p:BaseOutputPath=${path.join(owned.rootPath, "bin")}${path.sep}`,
    ];
    const options = { cwd: repositoryRoot, env: environment };
    runner(["restore", project, "--source", feed.value, "--disable-parallel", ...properties], options);
    runner(["build", project, "--no-restore", "--configuration", "Release", "--disable-build-servers", ...properties], options);
    runner([
      path.join(owned.rootPath, "bin/Release/net8.0/TinyRustLM.ConsumerSmoke.dll"),
      path.join(repositoryRoot, "contracts/vnext/slm2-q8-weight-vectors.v1.json"),
      path.join(repositoryRoot, "contracts/vnext/acg2-format-vectors.v1.json"),
      work, memory ? "required" : "absent", conversion ? "required" : "absent",
    ], options);
    return { packageIds: [...packageIds], optionalMemoryEndpoints: memory, privateConversion: conversion };
  } finally {
    removeOwnedTemporaryDirectory(owned);
  }
}

if (require.main === module) {
  try {
    if (process.argv.length !== 4) throw new Error("Expected package source and exact version.");
    verifyConsumer(process.argv[2], process.argv[3]);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({ verifyConsumer, resolveSource, nativeAssetRelativePath });
