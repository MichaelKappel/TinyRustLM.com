"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");
const { resolveCargoTargetRoot } = require("./helpers/cargo-target-root.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const manifestPath = path.join(
  repositoryRoot,
  "rust/crates/tinyrustlm-browser-runtime-wasm/Cargo.toml"
);
const sourcePath = path.join(
  repositoryRoot,
  "rust/crates/tinyrustlm-browser-runtime-wasm/src/lib.rs"
);
const profilePath = path.join(
  repositoryRoot,
  "contracts/vnext/browser-runtime-wasm-clean-cut-preregistration.v1.json"
);
const targetRoot = path.join(
  resolveCargoTargetRoot(repositoryRoot, process.env.CARGO_TARGET_DIR),
  "browser-runtime-wasm-raw-abi"
);
const wasmPath = path.join(
  targetRoot,
  "wasm32-unknown-unknown",
  "release",
  "tinyrustlm_browser_runtime_wasm.wasm"
);
const profile = parseStrictJson(fs.readFileSync(profilePath));
const privateActivation = profile.privateStructuralActivation;
const expectedFunctionExports = profile.exports.map((entry) => entry.name);
const expectedSupportExports = [
  { name: "__data_end", kind: "global" },
  { name: "__heap_base", kind: "global" },
  { name: "memory", kind: "memory" }
];
let compiledWasm;

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
    manifestPath,
    "--release",
    "--target",
    "wasm32-unknown-unknown",
    "--target-dir",
    targetRoot,
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
  assert.ok(compiledWasm.length > 0 && compiledWasm.length <= 16 * 1024 * 1024);
  return compiledWasm;
}

function readUnsignedLeb128(bytes, cursor) {
  let result = 0n;
  let shift = 0n;
  for (let count = 0; count < 10; count += 1) {
    assert.ok(cursor.offset < bytes.length, "truncated unsigned LEB128");
    const byte = BigInt(bytes[cursor.offset]);
    cursor.offset += 1;
    result |= (byte & 0x7fn) << shift;
    if ((byte & 0x80n) === 0n) return result;
    shift += 7n;
  }
  assert.fail("oversized unsigned LEB128");
}

function parseSingleMemory(bytes) {
  assert.equal(bytes.subarray(0, 8).toString("hex"), "0061736d01000000");
  const cursor = { offset: 8 };
  while (cursor.offset < bytes.length) {
    const sectionId = bytes[cursor.offset];
    cursor.offset += 1;
    const sectionBytes = Number(readUnsignedLeb128(bytes, cursor));
    const sectionEnd = cursor.offset + sectionBytes;
    assert.ok(sectionEnd <= bytes.length, "section exceeds module bytes");
    if (sectionId !== 5) {
      cursor.offset = sectionEnd;
      continue;
    }
    assert.equal(readUnsignedLeb128(bytes, cursor), 1n, "exactly one memory");
    const flags = readUnsignedLeb128(bytes, cursor);
    assert.equal(flags, 1n, "bounded unshared wasm32 memory");
    const minimumPages = readUnsignedLeb128(bytes, cursor);
    const maximumPages = readUnsignedLeb128(bytes, cursor);
    assert.equal(cursor.offset, sectionEnd, "memory section has no trailing values");
    return { minimumPages, maximumPages };
  }
  assert.fail("WASM memory section is absent");
}

function exportedBytes(instance, pointerName, lengthName) {
  const length = instance.exports[lengthName]() >>> 0;
  if (length === 0) return Buffer.alloc(0);
  const pointer = instance.exports[pointerName]() >>> 0;
  assert.notEqual(pointer, 0);
  return Buffer.from(new Uint8Array(instance.exports.memory.buffer, pointer, length));
}

function resultBytes(instance) {
  return exportedBytes(
    instance,
    "tinyrustlm_browser_runtime_result_ptr",
    "tinyrustlm_browser_runtime_result_len"
  );
}

function errorCode(instance) {
  return exportedBytes(
    instance,
    "tinyrustlm_browser_runtime_error_ptr",
    "tinyrustlm_browser_runtime_error_len"
  ).toString("ascii");
}

function beginAndWrite(instance, kind, bytes) {
  const pointer = instance.exports.tinyrustlm_browser_runtime_transfer_begin(
    kind,
    bytes.length
  ) >>> 0;
  assert.notEqual(pointer, 0, `transfer kind ${kind}`);
  new Uint8Array(instance.exports.memory.buffer, pointer, bytes.length).set(bytes);
  return pointer;
}

function transfer(instance, kind, bytes) {
  const pointer = beginAndWrite(instance, kind, bytes);
  assert.equal(
    instance.exports.tinyrustlm_browser_runtime_transfer_commit(kind, pointer, bytes.length),
    0,
    `commit transfer kind ${kind}`
  );
}

function sha256File(filePath, expectedBytes) {
  const stat = fs.lstatSync(filePath);
  assert.ok(stat.isFile() && !stat.isSymbolicLink());
  assert.equal(stat.size, expectedBytes);
  const digest = crypto.createHash("sha256");
  const descriptor = fs.openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(1_048_576);
  try {
    let position = 0;
    while (position < expectedBytes) {
      const count = fs.readSync(descriptor, buffer, 0,
        Math.min(buffer.length, expectedBytes - position), position);
      assert.ok(count > 0, "private member short read");
      digest.update(buffer.subarray(0, count));
      position += count;
    }
    assert.equal(fs.fstatSync(descriptor).size, expectedBytes,
      "private member drift");
  } finally {
    fs.closeSync(descriptor);
  }
  return digest.digest("hex");
}

function transferFile(instance, kind, filePath, expectedBytes) {
  const pointer = instance.exports.tinyrustlm_browser_runtime_transfer_begin(
    kind,
    expectedBytes
  ) >>> 0;
  assert.notEqual(pointer, 0, `private transfer kind ${kind}`);
  const target = new Uint8Array(instance.exports.memory.buffer, pointer, expectedBytes);
  const descriptor = fs.openSync(filePath, "r");
  try {
    let position = 0;
    while (position < expectedBytes) {
      const count = fs.readSync(descriptor, target, position,
        Math.min(1_048_576, expectedBytes - position), position);
      assert.ok(count > 0, "private transfer short read");
      position += count;
    }
    assert.equal(fs.fstatSync(descriptor).size, expectedBytes,
      "private transfer drift");
  } finally {
    fs.closeSync(descriptor);
  }
  assert.equal(
    instance.exports.tinyrustlm_browser_runtime_transfer_commit(
      kind,
      pointer,
      expectedBytes
    ),
    0,
    `private commit kind ${kind}: ${errorCode(instance)}`
  );
}

function stageOperation(instance, marker) {
  transfer(instance, 1, Buffer.alloc(32, marker));
}

function createRuntime(instance) {
  stageOperation(instance, 7);
  assert.equal(instance.exports.tinyrustlm_browser_runtime_create(
    1_048_576,
    128,
    1_048_576,
    1_048_576,
    2_097_152,
    1_048_576,
    1_048_576,
    8_388_608,
    11,
    0
  ), 0);
}

test("builds the exact import-free ABI with an explicit 3 GiB memory ceiling", () => {
  const source = fs.readFileSync(sourcePath, "utf8");
  assert.equal((source.match(/#\[no_mangle\]/gu) ?? []).length, 16);
  assert.equal((source.match(/#\[allow\(unsafe_code\)\]/gu) ?? []).length, 16);
  assert.doesNotMatch(source, /\bunsafe\s*(?:\{|fn\b|impl\b|trait\b)/u);

  const bytes = buildWasm();
  const module = new WebAssembly.Module(bytes);
  assert.deepEqual(WebAssembly.Module.imports(module), []);
  assert.deepEqual(
    WebAssembly.Module.exports(module)
      .filter((entry) => entry.kind === "function")
      .map((entry) => entry.name)
      .sort(),
    [...expectedFunctionExports].sort()
  );
  assert.deepEqual(
    WebAssembly.Module.exports(module)
      .filter((entry) => entry.kind !== "function")
      .sort((left, right) => left.name.localeCompare(right.name)),
    expectedSupportExports
  );

  const memory = parseSingleMemory(bytes);
  assert.ok(memory.minimumPages > 0n);
  assert.ok(memory.minimumPages <= memory.maximumPages);
  assert.equal(memory.maximumPages * 65_536n, 3_221_225_472n);
});

test("raw ABI rejects pre-create artifacts, unknown kinds, and invalid lengths", async () => {
  const { instance } = await WebAssembly.instantiate(buildWasm());
  assert.equal(instance.exports.tinyrustlm_browser_runtime_abi_version(), 1);
  assert.equal(resultBytes(instance).length, 0);
  assert.equal(errorCode(instance), "");

  assert.equal(
    instance.exports.tinyrustlm_browser_runtime_transfer_begin(3, 1),
    0
  );
  assert.equal(errorCode(instance), "browser-runtime-create-required");
  assert.equal(
    instance.exports.tinyrustlm_browser_runtime_transfer_begin(10, 1),
    0
  );
  assert.equal(errorCode(instance), "browser-runtime-transfer-kind");
  assert.equal(
    instance.exports.tinyrustlm_browser_runtime_transfer_begin(1, 0),
    0
  );
  assert.equal(errorCode(instance), "browser-runtime-transfer-length");
  assert.equal(
    instance.exports.tinyrustlm_browser_runtime_transfer_begin(1, 31),
    0
  );
  assert.equal(errorCode(instance), "browser-runtime-transfer-length");
  assert.equal(instance.exports.tinyrustlm_browser_runtime_release(), 1);
  assert.equal(errorCode(instance), "browser-runtime-create-required");
});

test("raw ABI enforces every post-create transfer ceiling before allocation", async () => {
  const { instance } = await WebAssembly.instantiate(buildWasm());
  createRuntime(instance);
  for (const [kind, length] of [
    [1, 33],
    [2, 33],
    [3, 1_048_577],
    [4, 67_108_865],
    [5, 1_048_577],
    [6, 65_799],
    [6, 65_801],
    [7, 511],
    [7, 513],
    [8, 895],
    [8, 897],
    [9, 1_048_577]
  ]) {
    assert.equal(
      instance.exports.tinyrustlm_browser_runtime_transfer_begin(kind, length),
      0,
      `kind ${kind} length ${length}`
    );
    assert.equal(errorCode(instance), "browser-runtime-transfer-length");
  }
  assert.equal(instance.exports.tinyrustlm_browser_runtime_release(), 0);
});

test("raw ABI stages all closed kinds once and drops identity-mismatched pending bytes", async () => {
  const { instance } = await WebAssembly.instantiate(buildWasm());
  createRuntime(instance);
  assert.equal(JSON.parse(resultBytes(instance)).schema,
    "tinyrustlm.browser_runtime_wasm.state/1");

  const pointer = beginAndWrite(instance, 1, Buffer.alloc(32, 8));
  assert.equal(
    instance.exports.tinyrustlm_browser_runtime_transfer_commit(1, pointer, 31),
    1
  );
  assert.equal(errorCode(instance), "browser-runtime-transfer-identity");
  assert.equal(instance.exports.tinyrustlm_browser_runtime_transfer_cancel(), 1);
  assert.equal(errorCode(instance), "browser-runtime-transfer-required");

  transfer(instance, 1, Buffer.alloc(32, 7));
  transfer(instance, 2, Buffer.alloc(32, 8));
  transfer(instance, 3, Buffer.from([3]));
  transfer(instance, 4, Buffer.from([4]));
  transfer(instance, 5, Buffer.from([5]));
  transfer(instance, 6, Buffer.alloc(65_800, 6));
  transfer(instance, 7, Buffer.alloc(512, 7));
  transfer(instance, 8, Buffer.alloc(896));
  transfer(instance, 9, Buffer.from([9]));

  assert.equal(instance.exports.tinyrustlm_browser_runtime_transfer_begin(1, 32), 0);
  assert.equal(errorCode(instance), "browser-runtime-transfer-duplicate");
  assert.equal(instance.exports.tinyrustlm_browser_runtime_release(), 0);
  assert.equal(resultBytes(instance).length, 0);
  assert.equal(errorCode(instance), "");
});

test("raw ABI rejects stale operations before mutation and release is terminal", async () => {
  const { instance } = await WebAssembly.instantiate(buildWasm());
  createRuntime(instance);
  const initialResultPointer =
    instance.exports.tinyrustlm_browser_runtime_result_ptr() >>> 0;
  assert.notEqual(initialResultPointer, 0);

  stageOperation(instance, 8);
  assert.equal(resultBytes(instance).length, 0, "next mutation invalidates result bytes");
  assert.equal(instance.exports.tinyrustlm_browser_runtime_set_transcript(19, 0), 2);
  assert.equal(errorCode(instance), "acg2-stale-operation");
  assert.equal(resultBytes(instance).length, 0);

  const pending = beginAndWrite(instance, 1, Buffer.alloc(32, 7));
  assert.notEqual(pending, 0);
  assert.equal(instance.exports.tinyrustlm_browser_runtime_release(), 0);
  assert.equal(resultBytes(instance).length, 0);
  assert.equal(errorCode(instance), "");
  assert.equal(instance.exports.tinyrustlm_browser_runtime_transfer_begin(1, 32), 0);
  assert.equal(errorCode(instance), "browser-runtime-released");
  assert.equal(instance.exports.tinyrustlm_browser_runtime_release(), 1);
  assert.equal(errorCode(instance), "browser-runtime-released");
});

const privateRoot = process.env[privateActivation.optInEnvironmentVariable];
if (privateRoot) {
  test("raw ABI activates the exact hash-bound private six-member composition", async () => {
    assert.equal(path.resolve(privateRoot), privateRoot,
      "private root must be an absolute canonical path");
    const rootStat = fs.lstatSync(privateRoot);
    assert.ok(rootStat.isDirectory() && !rootStat.isSymbolicLink());

    const publicResult = parseStrictJson(fs.readFileSync(path.join(
      repositoryRoot,
      privateActivation.publicResult.path
    )));
    assert.equal(publicResult.executionId, privateActivation.executionId);
    assert.deepEqual(publicResult.composition.semanticMembers,
      privateActivation.semanticMembers);
    const inventory = new Map(publicResult.composition.inventory.map((entry) =>
      [entry.file, entry]));
    const memberFiles = privateActivation.semanticMembers.map((name) => {
      const identity = inventory.get(name);
      assert.ok(identity, `missing public identity for ${name}`);
      const filePath = path.join(privateRoot, name);
      assert.equal(sha256File(filePath, identity.byteLength), identity.sha256,
        `private identity mismatch for ${name}`);
      return { filePath, identity };
    });

    const { instance } = await WebAssembly.instantiate(buildWasm());
    const operation = Buffer.from(privateActivation.operationIdHex, "hex");
    transfer(instance, 1, operation);
    const policy = privateActivation.runtimePolicy;
    assert.equal(instance.exports.tinyrustlm_browser_runtime_create(
      policy.maximumModelBytes,
      policy.maximumSequenceTokens,
      policy.maximumKvBytes,
      policy.maximumScratchBytes,
      policy.maximumResolvedMemberBytes,
      policy.maximumResidentDependencyBytes,
      policy.maximumRequestBytes,
      policy.maximumLinearMemoryBytes,
      policy.transcriptRevisionLow,
      policy.transcriptRevisionHigh
    ), 0, errorCode(instance));
    transfer(instance, 1, operation);

    const transferKinds = new Map([
      ["model.slm2", 3],
      ["tokenizer.tokenizer2", 4],
      ["template.template2", 5],
      ["sampling.sampling2", 6],
      ["prompt.prompt2", 7],
      ["composition.acg2", 8]
    ]);
    for (const member of memberFiles) {
      transferFile(instance, transferKinds.get(member.identity.file),
        member.filePath, member.identity.byteLength);
    }
    assert.equal(instance.exports.tinyrustlm_browser_runtime_activate(), 0,
      errorCode(instance));

    const state = JSON.parse(resultBytes(instance));
    assert.equal(state.schema, "tinyrustlm.browser_runtime_wasm.state/1");
    assert.equal(state.state, privateActivation.expectedRuntimeState);
    assert.equal(state.operationId, privateActivation.operationIdHex);
    assert.deepEqual(state.memoryPlan, privateActivation.expectedMemoryPlan);
    assert.equal(state.activeComposition.artifactBytes, 896);
    assert.equal(state.activeComposition.artifactSha256,
      inventory.get("composition.acg2").sha256);
    assert.ok(state.observedLinearMemoryBytes > 0 &&
      state.observedLinearMemoryBytes <= state.maximumLinearMemoryBytes);
    assert.equal(instance.exports.tinyrustlm_browser_runtime_release(), 0);
  });
}
