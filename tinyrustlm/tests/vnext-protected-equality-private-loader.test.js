"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const test = require("node:test");

const { canonicalizeVnextJcsBytes } = require("../tools/vnext-jcs.js");
const {
  protectedEqualityPrivateLoaderProfile,
  protectedEqualityPrivateLoaderProfileSha256,
  protectedEqualityPrivateLoaderSourceClosureSha256
} = require("../tools/vnext-protected-equality-private-loader.js");
const {
  makeProtectedEqualityBundle
} = require("./helpers/vnext-protected-equality-fixtures.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "protected-equality-private-loader-profile.v1.json");
const loaderPath = path.join(repositoryRoot, "tinyrustlm", "tools",
  "vnext-protected-equality-private-loader.js");
const childPath = path.join(__dirname, "helpers",
  "vnext-protected-equality-private-loader-child.js");
const maximumChildOutputBytes = 65_536;

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function trustDescriptorBytes(fixture, overrides = {}) {
  return canonicalizeVnextJcsBytes({
    schema: protectedEqualityPrivateLoaderProfile.trustDescriptorSchema,
    ...fixture.trustInput,
    ...overrides
  });
}

function collectBounded(chunks, chunk, state) {
  state.byteCount += chunk.length;
  if (state.byteCount > maximumChildOutputBytes) {
    state.limitExceeded = true;
    return;
  }
  chunks.push(Buffer.from(chunk));
}

function runLoaderChild({ bundleBytes, targetBytes = Buffer.alloc(0),
  trustBytes, transport = "pipe", regularFileDescriptor = null }) {
  return new Promise((resolve, reject) => {
    const stdio = transport === "missing" ? ["ignore", "pipe", "pipe"] :
      transport === "regular-file" ?
        ["ignore", "pipe", "pipe", regularFileDescriptor] :
        ["ignore", "pipe", "pipe", "pipe"];
    const child = spawn(process.execPath, [
      "--preserve-symlinks",
      "--preserve-symlinks-main",
      childPath,
      trustBytes.toString("base64"),
      targetBytes.toString("base64")
    ], {
      cwd: repositoryRoot,
      env: {},
      shell: false,
      stdio,
      windowsHide: true
    });
    const stdout = [];
    const stderr = [];
    const stdoutState = { byteCount: 0, limitExceeded: false };
    const stderrState = { byteCount: 0, limitExceeded: false };
    child.stdout.on("data", (chunk) => collectBounded(stdout, chunk, stdoutState));
    child.stderr.on("data", (chunk) => collectBounded(stderr, chunk, stderrState));
    child.on("error", reject);
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("protected equality loader child timed out"));
    }, 15_000);
    child.on("close", (exitCode, signal) => {
      clearTimeout(timeout);
      try {
        assert.equal(signal, null);
        assert.equal(stdoutState.limitExceeded, false);
        assert.equal(stderrState.limitExceeded, false);
        const stdoutBytes = Buffer.concat(stdout, stdoutState.byteCount);
        const stderrBytes = Buffer.concat(stderr, stderrState.byteCount);
        const result = JSON.parse(stdoutBytes.toString("utf8"));
        resolve({ exitCode, result, stderrBytes, stdoutBytes });
      } catch (error) {
        reject(error);
      }
    });
    if (transport === "pipe") {
      child.stdio[3].on("error", () => {});
      child.stdio[3].end(bundleBytes);
    }
  });
}

function assertPrivateValueAbsent(bytes, value) {
  const raw = Buffer.from(value, "utf8");
  const candidates = [
    raw,
    Buffer.from(value, "utf16le"),
    Buffer.from(raw.toString("base64"), "ascii"),
    Buffer.from(raw.toString("hex"), "ascii"),
    Buffer.from(Array.from(raw,
      (byte) => `%${byte.toString(16).toUpperCase().padStart(2, "0")}`).join(""),
    "ascii")
  ];
  for (const candidate of candidates) {
    assert.equal(bytes.includes(candidate), false);
  }
}

test("freezes the inherited-pipe loader profile and exact source closure", () => {
  const profileBytes = fs.readFileSync(profilePath);
  const source = fs.readFileSync(loaderPath, "utf8");
  const sourceMembers = protectedEqualityPrivateLoaderProfile.sourceClosureMembers
    .map((relativePath) => {
      assert.match(relativePath, /^[a-z0-9][a-z0-9./-]+$/u);
      assert.equal(relativePath.includes(".."), false);
      const bytes = fs.readFileSync(path.join(repositoryRoot,
        ...relativePath.split("/")));
      assert.ok(bytes.length > 0);
      assert.ok(bytes.length <= protectedEqualityPrivateLoaderProfile.limits
        .maximumSourceMemberBytes);
      return {
        byteCount: bytes.length,
        path: relativePath,
        sha256: sha256(bytes)
      };
    });
  assert.equal(protectedEqualityPrivateLoaderProfileSha256, sha256(profileBytes));
  assert.equal(new Set(protectedEqualityPrivateLoaderProfile.sourceClosureMembers).size,
    protectedEqualityPrivateLoaderProfile.sourceClosureMembers.length);
  assert.deepEqual(protectedEqualityPrivateLoaderProfile.sourceClosureMembers,
    [...protectedEqualityPrivateLoaderProfile.sourceClosureMembers].sort());
  assert.equal(protectedEqualityPrivateLoaderSourceClosureSha256,
    sha256(canonicalizeVnextJcsBytes(sourceMembers)));
  assert.equal(protectedEqualityPrivateLoaderProfile.privateBundleTransport
    .descriptor, 3);
  assert.equal(protectedEqualityPrivateLoaderProfile.privateBundleTransport
    .descriptorType, "inherited-non-file-pipe");
  assert.equal(protectedEqualityPrivateLoaderProfile.privateBundleTransport
    .pathInput, "forbidden");
  assert.equal(protectedEqualityPrivateLoaderProfile.privateBundleTransport
    .environmentInput, "forbidden");
  assert.doesNotMatch(source,
    /node:(?:http|https|net|tls|dns)|\bfetch\s*\(|child_process|spawn|execFile/u);
  assert.doesNotMatch(source,
    /process\.(?:argv|env|stdin)|Date\.now|new Date\s*\(/u);
  assert.match(source, /fs\.fstatSync\(descriptor\)/u);
  assert.match(source, /fs\.readSync\(descriptor,/u);
  assert.match(source, /fs\.closeSync\(descriptor\)/u);
  assert.match(source, /\.fill\(0\)/u);
});

test("loads one signed private bundle, closes fd 3, and leaks no private value", async () => {
  const secret = "Synthetic-Loader-Secret-7mQ2zK9v";
  const fixture = makeProtectedEqualityBundle({ knownSecrets: [secret] });
  const execution = await runLoaderChild({
    bundleBytes: fixture.bundleBytes,
    targetBytes: Buffer.from(secret, "utf8"),
    trustBytes: trustDescriptorBytes(fixture)
  });
  assert.equal(execution.exitCode, 0);
  assert.equal(execution.stderrBytes.length, 0);
  assert.equal(execution.result.ok, true);
  assert.equal(execution.result.descriptorClosed, true);
  assert.equal(execution.result.loaderProfileSha256,
    protectedEqualityPrivateLoaderProfileSha256);
  assert.equal(execution.result.loaderSourceClosureSha256,
    protectedEqualityPrivateLoaderSourceClosureSha256);
  assert.deepEqual(execution.result.scan.findingClasses, ["known-secret-utf8"]);
  assert.equal(execution.result.binding.knownSecretCount, 1);
  assertPrivateValueAbsent(execution.stdoutBytes, secret);
  assertPrivateValueAbsent(execution.stderrBytes, secret);
});

test("rejects missing and regular-file descriptor 3 transports", async (t) => {
  const fixture = makeProtectedEqualityBundle();
  const trustBytes = trustDescriptorBytes(fixture);
  const missing = await runLoaderChild({
    bundleBytes: fixture.bundleBytes,
    trustBytes,
    transport: "missing"
  });
  assert.equal(missing.exitCode, 1);
  assert.equal(missing.result.ok, false);
  assert.equal(missing.result.code, "equality_loader_pipe_unavailable");
  assert.equal(missing.result.descriptorClosed, true);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-loader-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const filePath = path.join(root, "private-bundle.bin");
  fs.writeFileSync(filePath, fixture.bundleBytes, { flag: "wx", mode: 0o600 });
  const descriptor = fs.openSync(filePath, "r");
  try {
    const regular = await runLoaderChild({
      bundleBytes: fixture.bundleBytes,
      regularFileDescriptor: descriptor,
      trustBytes,
      transport: "regular-file"
    });
    assert.equal(regular.exitCode, 1);
    assert.equal(regular.result.ok, false);
    assert.equal(regular.result.code, "equality_loader_transport_invalid");
    assert.equal(regular.result.descriptorClosed, true);
  } finally {
    fs.closeSync(descriptor);
  }
});

test("rejects oversized, empty, malformed, and signature-invalid private bundles", async () => {
  const fixture = makeProtectedEqualityBundle();
  const trustBytes = trustDescriptorBytes(fixture);
  const cases = [
    [Buffer.alloc(protectedEqualityPrivateLoaderProfile.limits
      .maximumPrivateBundleBytes + 1, 0x61), "equality_loader_bundle_byte_limit"],
    [Buffer.alloc(0), "equality_loader_bundle_byte_limit"],
    [Buffer.from("{", "utf8"), "equality_custody_bundle_invalid"],
    [canonicalizeVnextJcsBytes({
      ...JSON.parse(fixture.bundleBytes.toString("utf8")),
      signature: Buffer.alloc(64, 0x41).toString("base64")
    }), "equality_custody_signature_invalid"]
  ];
  for (const [bundleBytes, expectedCode] of cases) {
    const execution = await runLoaderChild({ bundleBytes, trustBytes });
    assert.equal(execution.exitCode, 1, expectedCode);
    assert.equal(execution.result.ok, false, expectedCode);
    assert.equal(execution.result.code, expectedCode);
    assert.equal(execution.result.descriptorClosed, true);
    assert.equal(execution.stderrBytes.length, 0);
  }
});

test("rejects noncanonical, unknown-field, and mismatched public trust input", async () => {
  const fixture = makeProtectedEqualityBundle();
  const canonicalTrust = trustDescriptorBytes(fixture);
  const cases = [
    [Buffer.concat([canonicalTrust, Buffer.from("\n", "ascii")]),
      "equality_loader_trust_wire_invalid"],
    [canonicalizeVnextJcsBytes({
      ...JSON.parse(canonicalTrust.toString("utf8")),
      unexpected: true
    }), "equality_loader_trust_invalid"],
    [trustDescriptorBytes(fixture, {
      expectedRevisionId: "different-loader-revision"
    }), "equality_custody_pin_mismatch"],
    [trustDescriptorBytes(fixture, {
      verificationTimeUtc: "2026-10-01T00:00:00Z"
    }), "equality_custody_time_invalid"]
  ];
  for (const [trustBytes, expectedCode] of cases) {
    const execution = await runLoaderChild({
      bundleBytes: fixture.bundleBytes,
      trustBytes
    });
    assert.equal(execution.exitCode, 1, expectedCode);
    assert.equal(execution.result.code, expectedCode);
    assert.equal(execution.result.descriptorClosed, true);
    assert.equal(execution.stderrBytes.length, 0);
  }
});
