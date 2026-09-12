"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const sha256Api = require("../app/incremental-sha256.js");

const sourcePath = path.resolve(__dirname, "../app/incremental-sha256.js");
const FULL_STRESS_BYTES = 600 * 1024 * 1024;
const DEFAULT_STRESS_BYTES = 16 * 1024 * 1024;

function toHex(bytes) {
  return Buffer.from(bytes).toString("hex");
}

function expectedSha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function incrementalDigest(bytes, chunkSizes) {
  const hasher = sha256Api.createSha256();
  let offset = 0;
  let sizeIndex = 0;
  while (offset < bytes.byteLength) {
    const size = chunkSizes[sizeIndex % chunkSizes.length];
    const end = Math.min(bytes.byteLength, offset + size);
    assert.equal(hasher.update(bytes.subarray(offset, end)), hasher);
    offset = end;
    sizeIndex += 1;
  }
  if (bytes.byteLength === 0) hasher.update(new Uint8Array(0));
  return toHex(hasher.digest());
}

function randomView(length) {
  const allocation = new Uint8Array(length + 19);
  crypto.randomFillSync(allocation);
  return allocation.subarray(7, 7 + length);
}

function randomChunkSizes(seed, count) {
  let state = seed >>> 0;
  const sizes = [];
  for (let index = 0; index < count; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    sizes.push((state >>> 0) % 257 + 1);
  }
  return sizes;
}

function expectTypedError(callback, ErrorType, code) {
  assert.throws(callback, (error) => {
    assert.equal(error instanceof ErrorType, true);
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    return true;
  });
}

function configuredStressBytes() {
  const raw = process.env.TINYRUSTLM_SHA256_STRESS_BYTES;
  if (raw === undefined) return DEFAULT_STRESS_BYTES;
  const value = Number(raw);
  assert.equal(Number.isSafeInteger(value), true,
    "TINYRUSTLM_SHA256_STRESS_BYTES must be a safe integer");
  assert.ok(value >= 1 && value <= FULL_STRESS_BYTES,
    "TINYRUSTLM_SHA256_STRESS_BYTES is outside the supported profile");
  return value;
}

test("exports frozen CommonJS and TinyRustLMIncrementalSha256 browser APIs", () => {
  assert.equal(Object.isFrozen(sha256Api), true);
  assert.deepEqual(Object.keys(sha256Api), [
    "createSha256",
    "IncrementalSha256InputError",
    "IncrementalSha256StateError"
  ]);

  const source = fs.readFileSync(sourcePath, "utf8");
  assert.doesNotMatch(source, /node:crypto|crypto\.subtle|\brequire\s*\(/u);
  const context = vm.createContext({
    ArrayBuffer,
    Error,
    Math,
    Object,
    TypeError,
    Uint8Array,
    Uint32Array
  });
  vm.runInContext(source, context, { filename: sourcePath });
  const browserApi = context.TinyRustLMIncrementalSha256;
  assert.equal(typeof browserApi.createSha256, "function");
  const hasher = browserApi.createSha256();
  hasher.update(Uint8Array.from([0x61, 0x62, 0x63]));
  assert.equal(toHex(hasher.digest()),
    "ba7816bf8f01cfea414140de5dae2223" +
    "b00361a396177a9cb410ff61f20015ad");
});

test("matches standard SHA-256 vectors including empty and million-byte input", () => {
  const vectors = [
    {
      bytes: new Uint8Array(0),
      expected: "e3b0c44298fc1c149afbf4c8996fb924" +
        "27ae41e4649b934ca495991b7852b855"
    },
    {
      bytes: new Uint8Array(Buffer.from("abc", "utf8")),
      expected: "ba7816bf8f01cfea414140de5dae2223" +
        "b00361a396177a9cb410ff61f20015ad"
    },
    {
      bytes: new Uint8Array(Buffer.from(
        "abcdbcdecdefdefgefghfghighijhijk" +
        "ijkljklmklmnlmnomnopnopq",
        "utf8"
      )),
      expected: "248d6a61d20638b8e5c026930c3e6039" +
        "a33ce45964ff2167f6ecedd419db06c1"
    }
  ];

  for (const vector of vectors) {
    assert.equal(incrementalDigest(vector.bytes, [1]), vector.expected);
    assert.equal(incrementalDigest(vector.bytes, [3, 64, 5, 129]), vector.expected);
  }

  const millionA = sha256Api.createSha256();
  const thousandA = new Uint8Array(1000).fill(0x61);
  for (let index = 0; index < 1000; index += 1) millionA.update(thousandA);
  assert.equal(toHex(millionA.digest()),
    "cdc76e5c9914fb9281a1c7e284d73e67" +
    "f1809a48a497200e046d39ccc7112cd0");
});

test("matches Node crypto across block edges and every two-chunk split", () => {
  for (const length of [
    0, 1, 2, 3, 7, 31, 55, 56, 57, 63, 64, 65,
    95, 119, 120, 121, 127, 128, 129, 191, 192, 193, 257
  ]) {
    const bytes = randomView(length);
    const expected = expectedSha256(bytes);
    for (let split = 0; split <= length; split += 1) {
      const hasher = sha256Api.createSha256();
      hasher.update(bytes.subarray(0, split));
      hasher.update(bytes.subarray(split));
      assert.equal(toHex(hasher.digest()), expected, `length=${length}, split=${split}`);
    }
  }
});

test("differential-checks random vectors and irregular chunkings", () => {
  const lengths = [
    0, 1, 13, 54, 55, 56, 62, 63, 64, 65, 126, 127, 128, 129,
    255, 256, 511, 512, 1023, 1024, 4097, 16391, 65537
  ];
  for (let index = 0; index < lengths.length; index += 1) {
    const bytes = randomView(lengths[index]);
    const expected = expectedSha256(bytes);
    assert.equal(incrementalDigest(bytes, [Math.max(1, bytes.byteLength)]), expected);
    assert.equal(incrementalDigest(bytes, [1]), expected);
    assert.equal(incrementalDigest(bytes,
      [63, 1, 64, 65, 2, 127, 5, 257]), expected);
    assert.equal(incrementalDigest(bytes,
      randomChunkSizes(0x9e3779b9 ^ index, 31)), expected);
  }
});

test("copies partial input and never retains caller-owned bytes", () => {
  const input = randomView(117);
  const original = Uint8Array.from(input);
  const hasher = sha256Api.createSha256();
  hasher.update(input.subarray(0, 70));
  input.fill(0);
  hasher.update(original.subarray(70));
  assert.equal(toHex(hasher.digest()), expectedSha256(original));
});

test("rejects invalid input, argument misuse, and finalized-state reuse", () => {
  expectTypedError(
    () => sha256Api.createSha256("unexpected"),
    sha256Api.IncrementalSha256InputError,
    "incremental-sha256-create-arguments"
  );
  expectTypedError(
    () => new sha256Api.createSha256(),
    sha256Api.IncrementalSha256InputError,
    "incremental-sha256-create-arguments"
  );

  const invalidInputs = [
    undefined,
    null,
    "abc",
    [1, 2, 3],
    new ArrayBuffer(3),
    new DataView(new ArrayBuffer(3)),
    new Uint8ClampedArray(3),
    new Uint16Array(3)
  ];
  for (const value of invalidInputs) {
    expectTypedError(
      () => sha256Api.createSha256().update(value),
      sha256Api.IncrementalSha256InputError,
      "incremental-sha256-input"
    );
  }

  expectTypedError(
    () => sha256Api.createSha256().update(),
    sha256Api.IncrementalSha256InputError,
    "incremental-sha256-update-arguments"
  );
  expectTypedError(
    () => sha256Api.createSha256().update(new Uint8Array(0), new Uint8Array(0)),
    sha256Api.IncrementalSha256InputError,
    "incremental-sha256-update-arguments"
  );
  expectTypedError(
    () => sha256Api.createSha256().digest("hex"),
    sha256Api.IncrementalSha256InputError,
    "incremental-sha256-digest-arguments"
  );

  const finalized = sha256Api.createSha256();
  finalized.digest();
  expectTypedError(
    () => finalized.update(new Uint8Array(0)),
    sha256Api.IncrementalSha256StateError,
    "incremental-sha256-finalized"
  );
  expectTypedError(
    () => finalized.digest(),
    sha256Api.IncrementalSha256StateError,
    "incremental-sha256-finalized"
  );
});

test("600 MiB repeated-stream profile keeps a constant 64-byte input buffer", {
  timeout: 300000
}, () => {
  // Set TINYRUSTLM_SHA256_STRESS_BYTES=629145600 for the full 600 MiB run.
  assert.equal(FULL_STRESS_BYTES, 629145600);
  const streamBytes = configuredStressBytes();
  const repeated = new Uint8Array(256 * 1024 + 13);
  for (let index = 0; index < repeated.length; index += 1) {
    repeated[index] = (index * 131 + 17) & 0xff;
  }

  const incremental = sha256Api.createSha256();
  const reference = crypto.createHash("sha256");
  const ownKeys = Reflect.ownKeys(incremental);
  let streamed = 0;
  while (streamed < streamBytes) {
    const length = Math.min(repeated.byteLength, streamBytes - streamed);
    const chunk = repeated.subarray(0, length);
    incremental.update(chunk);
    reference.update(chunk);
    streamed += length;
    assert.equal(incremental.bufferCapacity, 64);
    assert.equal(incremental.bufferedByteLength, streamed % 64);
    assert.deepEqual(Reflect.ownKeys(incremental), ownKeys);
  }

  const digest = incremental.digest();
  assert.equal(digest instanceof Uint8Array, true);
  assert.equal(digest.byteLength, 32);
  assert.match(toHex(digest), /^[0-9a-f]{64}$/u);
  assert.equal(toHex(digest), reference.digest("hex"));
  assert.equal(incremental.bufferCapacity, 64);
  assert.equal(incremental.bufferedByteLength, 0);
});
