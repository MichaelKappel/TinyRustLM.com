"use strict";

const { spawn } = require("node:child_process");
const path = require("node:path");

const { canonicalizeVnextJcsBytes } = require(
  "../../tools/vnext-jcs.js"
);
const {
  protectedEqualityPrivateLoaderProfile
} = require("../../tools/vnext-protected-equality-private-loader.js");
const {
  knownSecretsForFixtureProfile
} = require("./vnext-campaign-release-surface-test-custody.js");
const {
  makeProtectedEqualityBundle
} = require("./vnext-protected-equality-fixtures.js");

const repositoryRoot = path.resolve(__dirname, "../../..");
const expectedTestFile = "tinyrustlm/tests/vnext-campaign-release-surface.test.js";
const trustEnvironmentName =
  "TINYRUSTLM_TEST_EQUALITY_TRUST_DESCRIPTOR_BASE64";
const profileEnvironmentName = "TINYRUSTLM_TEST_EQUALITY_FIXTURE_PROFILE";

function fail() {
  process.stderr.write("release_surface_test_launcher_failed\n");
  process.exitCode = 1;
}

function exactArguments() {
  const values = process.argv.slice(2);
  if (values.length !== 6 || values[1] !== "--test" ||
      values[2] !== "--test-isolation=none" ||
      values[3] !== "--test-reporter=spec" ||
      !values[4].startsWith("--test-name-pattern=") ||
      values[5] !== expectedTestFile ||
      values.some((value) => typeof value !== "string" || value.length === 0 ||
        value.length > 16_384 || value.includes("\0"))) {
    throw new Error("release surface test launcher arguments are invalid");
  }
  return Object.freeze({
    fixtureProfileId: values[0],
    nodeArguments: values.slice(1)
  });
}

function publicTrustDescriptorBytes(fixture) {
  return canonicalizeVnextJcsBytes({
    schema: protectedEqualityPrivateLoaderProfile.trustDescriptorSchema,
    ...fixture.trustInput
  });
}

function launch() {
  const input = exactArguments();
  const knownSecrets = knownSecretsForFixtureProfile(input.fixtureProfileId);
  const fixture = makeProtectedEqualityBundle({ knownSecrets });
  const trustBytes = publicTrustDescriptorBytes(fixture);
  const environment = Object.assign(Object.create(null), process.env, {
    [profileEnvironmentName]: input.fixtureProfileId,
    [trustEnvironmentName]: trustBytes.toString("base64")
  });
  let bundleWriteComplete = false;
  let settled = false;
  const child = spawn(process.execPath, [
    "--preserve-symlinks",
    "--preserve-symlinks-main",
    ...input.nodeArguments
  ], {
    cwd: repositoryRoot,
    env: environment,
    shell: false,
    stdio: ["ignore", "inherit", "inherit", "pipe"],
    windowsHide: true
  });
  const zeroOwnedBytes = () => {
    fixture.bundleBytes.fill(0);
    trustBytes.fill(0);
  };
  child.stdio[3].once("error", () => {});
  child.stdio[3].end(fixture.bundleBytes, () => {
    bundleWriteComplete = true;
    fixture.bundleBytes.fill(0);
  });
  child.once("error", () => {
    if (settled) return;
    settled = true;
    zeroOwnedBytes();
    fail();
  });
  child.once("close", (code, signal) => {
    if (settled) return;
    settled = true;
    zeroOwnedBytes();
    if (!bundleWriteComplete || signal !== null || !Number.isSafeInteger(code)) {
      fail();
      return;
    }
    process.exitCode = code;
  });
}

try {
  launch();
} catch (_error) {
  fail();
}
