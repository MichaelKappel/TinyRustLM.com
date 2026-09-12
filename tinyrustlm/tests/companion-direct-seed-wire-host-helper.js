"use strict";
const fs = require("node:fs");
const path = require("node:path");
const repositoryRoot = path.resolve(__dirname, "../..");
const dotnetRoot = path.join(repositoryRoot, "dotnet");
const companionTestRoot = path.join(dotnetRoot, "tests", "TinyRustLM.Companion.Tests");

/** Locate only canonical compiled tests and fixture tools. */
function findCompiledPrerequisites() {
  const executableSuffix = process.platform === "win32" ? ".exe" : "";
  for (const configuration of ["Debug", "Release"]) {
    const testBin = path.join(
      companionTestRoot,
      "bin",
      configuration,
      "net8.0"
    );
    const conversionFixtureBin = path.join(
      dotnetRoot,
      "tools",
      "TinyRustLM.ConversionFixtureTool",
      "bin",
      configuration,
      "net8.0"
    );
    const seedFixtureBin = path.join(
      dotnetRoot,
      "tools",
      "TinyRustLM.P2PSeedFixtureTool",
      "bin",
      configuration,
      "net8.0"
    );
    const values = {
      configuration,
      testBin,
      conversionFixtureBin,
      seedFixtureBin,
      hostAssembly: path.join(dotnetRoot, "tools/TinyRustLM.DirectSeedWireFixtureTool/bin", configuration, "net8.0", "TinyRustLM.DirectSeedWireFixtureTool.dll"),
      testAssembly: path.join(testBin, "TinyRustLM.Companion.Tests.dll"),
      companionAssembly: path.join(testBin, "TinyRustLM.Companion.dll"),
      conversionAssembly: path.join(testBin, "TinyRustLM.Conversion.dll"),
      conversionFixtureExecutable: path.join(
        conversionFixtureBin,
        `TinyRustLM.ConversionFixtureTool${executableSuffix}`
      ),
      seedFixtureExecutable: path.join(
        seedFixtureBin,
        `TinyRustLM.P2PSeedFixtureTool${executableSuffix}`
      )
    };
    if (Object.values(values).filter((value) => typeof value === "string")
      .every((value) => value === configuration || fs.existsSync(value))) {
      return Object.freeze(values);
    }
  }
  return null;
}

/** Reject builds older than the source exercised by this boundary. */
function outputIsCurrent(prerequisites) {
  const sourceFiles = [
    "src/TinyRustLM.Companion/CompanionDirectCompositionSeedService.cs",
    "src/TinyRustLM.Companion/CompanionLoopbackServer.cs",
    "src/TinyRustLM.Companion/CompanionLoopbackWire.cs",
    "src/TinyRustLM.Companion/CompanionOperationJournal.cs",
    "src/TinyRustLM.Companion/CompanionSourceDescriptor.cs",
    "src/TinyRustLM.Companion/CompanionProductionOperationRuntime.cs",
    "src/TinyRustLM.Companion/CompanionProductionSourceAcquisition.cs",
    "tests/TinyRustLM.Companion.Tests/CompanionArtifactTransferTests.cs",
    "tests/TinyRustLM.Companion.Tests/CompanionDirectCompositionSeedServiceTests.cs",
    "tests/TinyRustLM.Companion.Tests/CompanionOperationTestEvidence.cs"
  ].map((relative) => path.join(dotnetRoot, relative));
  const testAssemblyTime = fs.statSync(prerequisites.testAssembly).mtimeMs;
  const newestSourceTime = Math.max(...sourceFiles.map((file) => fs.statSync(file).mtimeMs));
  const conversionSourceTime = fs.statSync(path.join(
    dotnetRoot,
    "tools/TinyRustLM.ConversionFixtureTool/Program.cs"
  )).mtimeMs;
  const seedSourceTime = fs.statSync(path.join(
    dotnetRoot,
    "tools/TinyRustLM.P2PSeedFixtureTool/Program.cs"
  )).mtimeMs;
  return testAssemblyTime >= newestSourceTime &&
    fs.statSync(prerequisites.hostAssembly).mtimeMs >= fs.statSync(path.join(
      dotnetRoot, "tools/TinyRustLM.DirectSeedWireFixtureTool/Program.cs")).mtimeMs &&
    fs.statSync(prerequisites.conversionFixtureExecutable).mtimeMs >= conversionSourceTime &&
    fs.statSync(prerequisites.seedFixtureExecutable).mtimeMs >= seedSourceTime;
}

module.exports = Object.freeze({findCompiledPrerequisites, outputIsCurrent});
