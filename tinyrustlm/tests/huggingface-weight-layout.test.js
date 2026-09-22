"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { maximumWeightIndexBytes, validateWeightLayout, validateWeightIndex } =
  require("../tools/huggingface-weight-layout.js");

// Build only filename identities; these tests never create source/model files.
function shards(count = 2) {
  return Array.from({ length: count }, (_, index) => ({
    filename: `model-${String(index + 1).padStart(5, "0")}-of-${String(count).padStart(5, "0")}.safetensors`
  }));
}

// Serialize a test index with one mapping for every admitted shard.
function indexBytes(weightFiles = shards(), extra = {}) {
  return Buffer.from(JSON.stringify({ metadata: { total_size: 1 },
    weight_map: Object.fromEntries(weightFiles.map((file, index) => [`tensor.${index}`, file.filename])),
    ...extra }));
}

test("weight layouts admit a direct file and complete unordered shard groups at the bounds", () => {
  assert.equal(validateWeightLayout([{ filename: "model.safetensors" }]), "single");
  for (const count of [1, 2, 64]) {
    assert.equal(validateWeightLayout(shards(count).reverse()), "sharded");
  }
  assert.equal(validateWeightLayout([Object.assign(Object.create(null), shards(1)[0])]), "sharded");
});

test("weight layouts reject malformed, mixed, duplicate and incomplete groups", () => {
  const invalid = [null, {}, [], shards(65), [null], ["model.safetensors"], [[]],
    [{ filename: 7 }], [new Date()], new Array(1),
    [{ filename: "model.safetensors" }, ...shards(1)],
    [{ filename: "model.safetensors" }, { filename: "model.safetensors" }],
    [shards()[0]], [shards()[0], shards()[0]],
    [{ filename: "model-00000-of-00001.safetensors" }],
    [{ filename: "model-00002-of-00001.safetensors" }],
    [{ filename: "model-00001-of-00002.safetensors" }, { filename: "model-00002-of-00003.safetensors" }],
    [{ filename: "model-1-of-1.safetensors" }], [{ filename: "../model.safetensors" }],
    [{ filename: "https://example.test/model.safetensors" }]];
  for (const input of invalid) assert.throws(() => validateWeightLayout(input), /weight/, String(input));
});

test("weight indexes bind every shard and ignore metadata tensor-byte counts", () => {
  const files = shards();
  const result = validateWeightIndex(indexBytes(files, { metadata: { total_size: 7 } }), files);
  assert.deepEqual(result, { tensorCount: 2, shardCount: 2 });
  assert.equal(Object.isFrozen(result), true);
});

test("weight indexes support Unicode tensor names, repeated shard use and byte views", () => {
  const files = shards();
  const weight_map = { ["x".repeat(512)]: files[0].filename, "层.权重": files[1].filename,
    extra: files[1].filename };
  Object.defineProperty(weight_map, "__proto__", { value: files[0].filename, enumerable: true });
  const bytes = indexBytes(files, { weight_map });
  const surrounding = Buffer.concat([Buffer.from("prefix"), bytes, Buffer.from("suffix")]);
  const view = new Uint8Array(surrounding.buffer, surrounding.byteOffset + 6, bytes.length);
  assert.deepEqual(validateWeightIndex(view, files), { tensorCount: 4, shardCount: 2 });
});

test("weight indexes reject unsafe or incomplete reference sets and invalid mapping shapes", () => {
  const files = shards();
  for (const value of [null, [], {}, { weight_map: [] }, { weight_map: null },
    { weight_map: {} }, { weight_map: { "": files[0].filename } },
    { weight_map: { ["t".repeat(513)]: files[0].filename } },
    { weight_map: { only: files[0].filename } }]) {
    assert.throws(() => validateWeightIndex(Buffer.from(JSON.stringify(value)), files), /weight index/);
  }
  for (const reference of [null, 42, {}, "../model-00001-of-00002.safetensors",
    "https://example.test/model-00001-of-00002.safetensors", "model.safetensors",
    "model-00003-of-00003.safetensors", "subdir/model-00001-of-00002.safetensors"] ) {
    assert.throws(() => validateWeightIndex(indexBytes(files, { weight_map: { tensor: reference } }), files),
      /weight index references an unadmitted shard/);
  }
  assert.throws(() => validateWeightIndex(indexBytes(), [{ filename: "model.safetensors" }]),
    /weight index requires sharded weights/);
});

test("weight indexes enforce byte, nesting, mapping count, encoding and duplicate-key bounds", () => {
  const files = shards(1);
  const valid = indexBytes(files);
  const exactlyBounded = Buffer.concat([valid, Buffer.alloc(maximumWeightIndexBytes - valid.length, 32)]);
  assert.deepEqual(validateWeightIndex(exactlyBounded, files), { tensorCount: 1, shardCount: 1 });
  const excessiveMappings = Object.fromEntries(Array.from({ length: 8193 }, (_, i) => [`t${i}`, files[0].filename]));
  for (const invalid of [null, "{}", Buffer.alloc(0), Buffer.from([0xff]),
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), valid]),
    Buffer.concat([exactlyBounded, Buffer.from(" ")]),
    Buffer.from('{"weight_map":{},"weight_map":{}}'),
    Buffer.from('{"weight_map":{"same":"a","same":"b"}}'),
    Buffer.from('{"weight_map":{},"extra":1e999}'),
    Buffer.from('{"weight_map":{},"extra":"\\ud800"}'),
    Buffer.from('{"weight_map":{},"extra":[[[[[[[[[]]]]]]]]]}'),
    Buffer.concat([valid, Buffer.from(" trailing")]),
    indexBytes(files, { weight_map: excessiveMappings })]) {
    assert.throws(() => validateWeightIndex(invalid, files), /weight index is invalid/);
  }
});
