"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { chromium } = require("@playwright/test");
const { parseStrictJson } = require("../tools/strict-json.js");
const { resolveCargoTargetRoot } = require("./helpers/cargo-target-root.js");
const {
  Acg2Error,
  CANONICAL_MEMBERS,
  FILE_BYTES,
  MEMBER_PROFILES,
  PROFILE_ID,
  PROFILE_SHA256,
  parseGraph,
  renderVectors,
  writeGraph
} = require("../tools/acg2-reference.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts/vnext/acg2-format-profile.v1.json");
const registrationPath = path.join(
  repositoryRoot,
  "contracts/vnext/acg2-champion-format-preregistration.v2.json"
);
const vectorPath = path.join(repositoryRoot, "contracts/vnext/acg2-format-vectors.v1.json");
const oraclePath = path.join(repositoryRoot, "tinyrustlm/tools/acg2-reference.js");
const crateManifestPath = path.join(
  repositoryRoot,
  "rust/crates/tinyrustlm-composition2/Cargo.toml"
);
const crateWasmSourcePath = path.join(
  repositoryRoot,
  "rust/crates/tinyrustlm-composition2/src/wasm.rs"
);
const targetRoot = path.join(
  resolveCargoTargetRoot(repositoryRoot, process.env.CARGO_TARGET_DIR),
  "acg2-composition2"
);
const wasmPath = path.join(
  targetRoot,
  "wasm32-unknown-unknown",
  "release",
  "tinyrustlm_composition2.wasm"
);
const requiredWasmFunctionExports = [
  "trlm_acg2_conformance_abi_version",
  "trlm_acg2_conformance_clear",
  "trlm_acg2_conformance_error_len",
  "trlm_acg2_conformance_error_ptr",
  "trlm_acg2_conformance_generate",
  "trlm_acg2_conformance_input_capacity",
  "trlm_acg2_conformance_input_ptr",
  "trlm_acg2_conformance_output_len",
  "trlm_acg2_conformance_output_ptr",
  "trlm_acg2_conformance_parse",
  "trlm_acg2_conformance_profile"
];

const profileBytes = fs.readFileSync(profilePath);
const registration = parseStrictJson(fs.readFileSync(registrationPath));
const vectorBytes = fs.readFileSync(vectorPath);
const vectors = parseStrictJson(vectorBytes);
let compiledWasm;

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function expectedError(callback) {
  assert.throws(callback, (error) => error instanceof Acg2Error && error.code.length > 0);
  try {
    callback();
  } catch (error) {
    return error.code;
  }
  assert.fail("expected ACG2 error");
}

function registeredFieldShape(field) {
  return {
    name: field.name.replace(/[A-Z]/gu, (letter) => `_${letter.toLowerCase()}`)
      .replace(/([a-z])([0-9])$/u, "$1_$2"),
    offset: field.offset,
    bytes: field.bytes,
    type: ["raw", "sha256"].includes(field.type)
      ? "bytes"
      : field.type === "zero" ? "zero-bytes" : field.type
  };
}

function preregisteredFieldShape(field) {
  return { name: field.name, offset: field.offset, bytes: field.bytes, type: field.type };
}

function cargoExecutable() {
  if (process.env.CARGO) return process.env.CARGO;
  const candidate = process.platform === "win32" && process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, ".cargo/bin/cargo.exe")
    : "cargo";
  return fs.existsSync(candidate) ? candidate : "cargo";
}

function buildWasm() {
  if (compiledWasm) return compiledWasm;
  const result = childProcess.spawnSync(cargoExecutable(), [
    "build",
    "--manifest-path",
    crateManifestPath,
    "--release",
    "--target",
    "wasm32-unknown-unknown",
    "--target-dir",
    targetRoot,
    "--features",
    "wasm-conformance",
    "--locked",
    "--offline"
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
    windowsHide: true
  });
  assert.equal(result.error, undefined, `WASM build spawn failed: ${result.error?.code}`);
  assert.equal(result.status, 0, `WASM build failed:\n${result.stdout}\n${result.stderr}`);
  compiledWasm = fs.readFileSync(wasmPath);
  assert.ok(compiledWasm.length > 0 && compiledWasm.length <= 2_097_152);
  return compiledWasm;
}

function exportedBytes(instance, pointerName, lengthName) {
  const length = instance.exports[lengthName]() >>> 0;
  if (length === 0) return Buffer.alloc(0);
  const pointer = instance.exports[pointerName]() >>> 0;
  assert.notEqual(pointer, 0);
  return Buffer.from(new Uint8Array(instance.exports.memory.buffer, pointer, length));
}

function wasmOutput(instance) {
  return exportedBytes(
    instance,
    "trlm_acg2_conformance_output_ptr",
    "trlm_acg2_conformance_output_len"
  );
}

function wasmErrorCode(instance) {
  return exportedBytes(
    instance,
    "trlm_acg2_conformance_error_ptr",
    "trlm_acg2_conformance_error_len"
  ).toString("ascii");
}

function loadWasmInput(instance, bytes) {
  assert.ok(bytes.length <= instance.exports.trlm_acg2_conformance_input_capacity());
  const pointer = instance.exports.trlm_acg2_conformance_input_ptr() >>> 0;
  assert.notEqual(pointer, 0);
  const input = new Uint8Array(
    instance.exports.memory.buffer,
    pointer,
    instance.exports.trlm_acg2_conformance_input_capacity()
  );
  input.fill(0);
  input.set(bytes);
}

function assertIdentityOutput(bytes, vector) {
  assert.equal(bytes.length, 104);
  assert.equal(bytes.subarray(0, 32).toString("hex"), vector.artifactSha256);
  assert.equal(bytes.subarray(32, 64).toString("hex"), vector.graphIdentitySha256);
  assert.equal(bytes.subarray(64, 96).toString("hex"), vector.memberTableSha256);
  assert.equal(Number(bytes.readBigUInt64LE(96)), vector.resolvedMemberBytes);
}

test("checked-in vectors exactly match the independent generator", () => {
  assert.ok(vectorBytes.equals(renderVectors()));
  assert.equal(vectors.profile.profileId, PROFILE_ID);
  assert.equal(vectors.profile.sha256, PROFILE_SHA256);
  assert.equal(vectors.profile.byteLength, profileBytes.length);
  assert.equal(sha256(profileBytes), PROFILE_SHA256);
  assert.equal(vectors.independentOracle.sha256, sha256(fs.readFileSync(oraclePath)));
});

test("implemented profile is the exact corrected registered graph", () => {
  const profile = parseStrictJson(profileBytes);
  assert.equal(profile.schema, "tinyrustlm.vnext.acg2-format-profile.v1");
  assert.equal(profile.status, "implemented-unpromoted");
  assert.equal(profile.productLifecycle, "prelaunch-single-product");
  assert.equal(profile.technicalIdentityIsProductGeneration, false);
  assert.equal(profile.profileId, registration.authority.formatId);
  assert.deepEqual(
    profile.artifactFormat.headerFields.map(registeredFieldShape),
    registration.binaryContract.header.fields.map(preregisteredFieldShape)
  );
  assert.deepEqual(
    profile.artifactFormat.memberRecordFields.map(registeredFieldShape),
    registration.binaryContract.memberRecord.fields.map(preregisteredFieldShape)
  );
  assert.deepEqual(profile.memberProfiles, registration.memberProfiles.map((member) => ({
    ordinal: member.ordinal,
    role: member.role,
    roleCode: member.roleCode,
    format: member.format,
    formatCode: member.formatCode,
    formatId: member.formatId,
    profileSha256: member.profileSha256,
    maximumArtifactBytes: member.maximumArtifactBytes
  })));
  assert.equal(profile.limits.maximumGraphBytes, registration.limits.maximumGraphBytes);
  assert.equal(profile.limits.maximumResolvedMemberBytes,
    registration.limits.maximumResolvedMemberBytes);
  assert.equal(profile.limits.streamHashBufferBytes,
    registration.limits.streamHashBufferBytes);
});

test("canonical writer parser and all three identities are exact", () => {
  const artifact = writeGraph(CANONICAL_MEMBERS);
  assert.equal(artifact.length, FILE_BYTES);
  assert.equal(artifact.toString("hex"), vectors.canonical.artifactHex);
  const parsed = parseGraph(artifact);
  assert.equal(parsed.artifactSha256, vectors.canonical.artifactSha256);
  assert.equal(parsed.memberTableSha256, vectors.canonical.memberTableSha256);
  assert.equal(parsed.graphIdentitySha256, vectors.canonical.graphIdentitySha256);
  assert.equal(parsed.resolvedMemberBytes, 7_115_192);
  assert.deepEqual(parsed.members, vectors.canonical.members);
});

test("every proper prefix and every surplus artifact rejects", () => {
  const artifact = Buffer.from(vectors.canonical.artifactHex, "hex");
  for (let length = 0; length < artifact.length; length += 1) {
    assert.equal(expectedError(() => parseGraph(artifact.subarray(0, length))), "acg2-header");
  }
  assert.equal(vectors.canonical.properPrefixCount, FILE_BYTES);
  assert.equal(
    expectedError(() => parseGraph(Buffer.concat([artifact, Buffer.from([0])]))),
    "acg2-artifact-limit"
  );
});

test("every registered hostile artifact has its exact stable verdict", () => {
  assert.equal(vectors.canonical.mutations.length, 32);
  for (const mutation of vectors.canonical.mutations) {
    const bytes = Buffer.from(mutation.artifactHex, "hex");
    assert.equal(expectedError(() => parseGraph(bytes)), mutation.expectedError, mutation.id);
  }
});

test("every role rejects profile, length, ordinal, role, and format confusion", () => {
  MEMBER_PROFILES.forEach((expected, index) => {
    const wrongProfile = CANONICAL_MEMBERS.map((member) => ({ ...member }));
    wrongProfile[index].formatProfileSha256 = `${index + 1}`.padStart(64, "0");
    assert.equal(expectedError(() => writeGraph(wrongProfile)), "acg2-member-profile");

    const zeroLength = CANONICAL_MEMBERS.map((member) => ({ ...member }));
    zeroLength[index].artifactBytes = 0;
    assert.equal(expectedError(() => writeGraph(zeroLength)), "acg2-member-length");

    const overLimit = CANONICAL_MEMBERS.map((member) => ({ ...member }));
    overLimit[index].artifactBytes = expected.maximumArtifactBytes + 1;
    assert.equal(expectedError(() => writeGraph(overLimit)), "acg2-member-length");

    const wrongOrdinal = CANONICAL_MEMBERS.map((member) => ({ ...member }));
    wrongOrdinal[index].ordinal = (index + 1) % MEMBER_PROFILES.length;
    assert.equal(expectedError(() => writeGraph(wrongOrdinal)), "acg2-member-order");

    const wrongRole = CANONICAL_MEMBERS.map((member) => ({ ...member }));
    wrongRole[index].role = MEMBER_PROFILES[(index + 1) % MEMBER_PROFILES.length].role;
    assert.equal(expectedError(() => writeGraph(wrongRole)), "acg2-member-order");

    const wrongFormat = CANONICAL_MEMBERS.map((member) => ({ ...member }));
    wrongFormat[index].format = MEMBER_PROFILES[(index + 1) % MEMBER_PROFILES.length].format;
    assert.equal(expectedError(() => writeGraph(wrongFormat)), "acg2-member-order");
  });
});

test("a distinct valid model identity produces a distinct valid graph", () => {
  const canonical = parseGraph(Buffer.from(vectors.canonical.artifactHex, "hex"));
  const alternate = parseGraph(Buffer.from(vectors.alternateValidModel.artifactHex, "hex"));
  assert.notEqual(alternate.members[0].artifactSha256, canonical.members[0].artifactSha256);
  assert.notEqual(alternate.members[0].artifactBytes, canonical.members[0].artifactBytes);
  assert.notEqual(alternate.graphIdentitySha256, canonical.graphIdentitySha256);
  assert.notEqual(alternate.artifactSha256, canonical.artifactSha256);
  assert.deepEqual(alternate.members.slice(1), canonical.members.slice(1));
});

test("oracle is builtins-only and isolated from Rust subprocess and network output", () => {
  const source = fs.readFileSync(oraclePath, "utf8");
  const imports = Array.from(source.matchAll(/require\("([^"]+)"\)/gu), (match) => match[1]);
  assert.deepEqual([...new Set(imports)].sort(), ["node:crypto", "node:fs", "node:path"]);
  assert.doesNotMatch(source, /child_process|spawn|execFile|WebSocket|fetch\s*\(|https?:\/\//u);
  assert.doesNotMatch(source, /rust\/crates|target\/|generatedRust|readGenerated/u);
  assert.equal(vectors.independentOracle.invokesRust, false);
  assert.equal(vectors.independentOracle.invokesSubprocess, false);
  assert.equal(vectors.independentOracle.usesNetwork, false);
  assert.equal(vectors.independentOracle.readsGeneratedRustOutput, false);
});

test("format evidence keeps every product and campaign claim false", () => {
  assert.deepEqual(vectors.claimBoundary, {
    realModelConverted: false,
    modelQualityVerified: false,
    browserChatVerified: false,
    p2pAvailabilityVerified: false,
    packagePublished: false,
    siteDeployed: false,
    memoryEndpointsOperationPerformed: false,
    campaignCounters: {
      qualifiedModels: "0/20",
      cleanBrowserRounds: "0/50",
      liveMemoryRounds: "0/25",
      externallyProvenLanes: "0/40",
      liveCatalogAnnouncements: "0/20"
    }
  });
});

test("builds one bounded import-free ACG2 WASM module without unsafe execution", () => {
  const source = fs.readFileSync(crateWasmSourcePath, "utf8");
  assert.equal((source.match(/#\[no_mangle\]/gu) ?? []).length, 11);
  assert.equal((source.match(/#\[allow\(unsafe_code\)\]/gu) ?? []).length, 11);
  assert.doesNotMatch(source, /\bunsafe\s*(?:\{|fn\b|impl\b|trait\b)/u);

  const bytes = buildWasm();
  const module = new WebAssembly.Module(bytes);
  assert.deepEqual(WebAssembly.Module.imports(module), []);
  assert.deepEqual(
    WebAssembly.Module.exports(module)
      .filter((entry) => entry.kind === "function")
      .map((entry) => entry.name)
      .sort(),
    [...requiredWasmFunctionExports].sort()
  );
  assert.ok(WebAssembly.Module.exports(module)
    .some((entry) => entry.kind === "memory" && entry.name === "memory"));
});

test("Node WebAssembly exactly replays canonical and hostile vectors", async () => {
  const { instance } = await WebAssembly.instantiate(buildWasm());
  assert.equal(instance.exports.trlm_acg2_conformance_abi_version(), 1);
  assert.equal(instance.exports.trlm_acg2_conformance_input_capacity(), 897);
  assert.equal(instance.exports.trlm_acg2_conformance_profile(), 0);
  assert.equal(wasmOutput(instance).toString("ascii"), vectors.profile.sha256);

  assert.equal(instance.exports.trlm_acg2_conformance_generate(), 0);
  assert.equal(wasmOutput(instance).toString("hex"), vectors.canonical.artifactHex);
  const canonical = Buffer.from(vectors.canonical.artifactHex, "hex");
  loadWasmInput(instance, canonical);
  assert.equal(instance.exports.trlm_acg2_conformance_parse(canonical.length), 0);
  assertIdentityOutput(wasmOutput(instance), vectors.canonical);

  for (const mutation of vectors.canonical.mutations) {
    const bytes = Buffer.from(mutation.artifactHex, "hex");
    loadWasmInput(instance, bytes);
    assert.equal(instance.exports.trlm_acg2_conformance_parse(bytes.length), 2, mutation.id);
    assert.equal(wasmErrorCode(instance), mutation.expectedError, mutation.id);
  }
  assert.equal(instance.exports.trlm_acg2_conformance_clear(), 0);
});

test("fresh Chromium exactly replays ACG2 vectors with zero network", async () => {
  const browser = await chromium.launch({ headless: true });
  const requests = [];
  try {
    const page = await browser.newPage();
    page.on("request", (request) => requests.push(request.url()));
    const result = await page.evaluate(async ({ base64, contract }) => {
      const binary = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
      const { instance } = await WebAssembly.instantiate(binary);
      const readBytes = (pointerName, lengthName) => {
        const length = instance.exports[lengthName]() >>> 0;
        if (length === 0) return new Uint8Array();
        const pointer = instance.exports[pointerName]() >>> 0;
        return new Uint8Array(instance.exports.memory.buffer, pointer, length).slice();
      };
      const hex = (bytes) => Array.from(
        bytes,
        (byte) => byte.toString(16).padStart(2, "0")
      ).join("");
      const ascii = (bytes) => new TextDecoder("ascii").decode(bytes);
      const load = (hexBytes) => {
        const bytes = Uint8Array.from(hexBytes.match(/../gu), (pair) => parseInt(pair, 16));
        const pointer = instance.exports.trlm_acg2_conformance_input_ptr() >>> 0;
        const input = new Uint8Array(
          instance.exports.memory.buffer,
          pointer,
          instance.exports.trlm_acg2_conformance_input_capacity()
        );
        input.fill(0);
        input.set(bytes);
        return bytes.length;
      };
      if (instance.exports.trlm_acg2_conformance_generate() !== 0) {
        throw new Error("generate failed");
      }
      const generated = hex(readBytes(
        "trlm_acg2_conformance_output_ptr",
        "trlm_acg2_conformance_output_len"
      ));
      if (generated !== contract.canonical.artifactHex) throw new Error("generated drift");
      const canonicalLength = load(contract.canonical.artifactHex);
      if (instance.exports.trlm_acg2_conformance_parse(canonicalLength) !== 0) {
        throw new Error("canonical parse failed");
      }
      let hostileCount = 0;
      for (const mutation of contract.canonical.mutations) {
        const length = load(mutation.artifactHex);
        if (instance.exports.trlm_acg2_conformance_parse(length) !== 2) {
          throw new Error(`hostile admitted: ${mutation.id}`);
        }
        const code = ascii(readBytes(
          "trlm_acg2_conformance_error_ptr",
          "trlm_acg2_conformance_error_len"
        ));
        if (code !== mutation.expectedError) {
          throw new Error(`verdict drift: ${mutation.id}`);
        }
        hostileCount += 1;
      }
      return {
        abiVersion: instance.exports.trlm_acg2_conformance_abi_version(),
        generatedBytes: generated.length / 2,
        hostileCount
      };
    }, { base64: buildWasm().toString("base64"), contract: vectors });
    assert.deepEqual(result, { abiVersion: 1, generatedBytes: 896, hostileCount: 32 });
    assert.deepEqual(requests, []);
  } finally {
    await browser.close();
  }
});
