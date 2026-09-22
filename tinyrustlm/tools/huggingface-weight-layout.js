"use strict";

const { parseStrictJson } = require("./strict-json.js");

// Match the source-screen consumer's existing JSON size limit.
const maximumWeightIndexBytes = 256 * 1024;
const maximumWeightFiles = 64;
const maximumTensorMappings = 8192;

// Reject incomplete source closures before any model payload is requested.
function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

// Accept ordinary decoded objects without treating arrays or null as records.
function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

// Require one direct file or one complete, consecutively numbered shard group.
// The input is a file-identity array; byte identities are validated by its caller.
function validateWeightLayout(weightFiles) {
  invariant(Array.isArray(weightFiles) && weightFiles.length >= 1 &&
    weightFiles.length <= maximumWeightFiles, "weight file count is invalid");
  const names = Array.from(weightFiles, (file) => {
    invariant(isObject(file) && typeof file.filename === "string", "weight filename is invalid");
    return file.filename;
  });
  invariant(new Set(names).size === names.length, "weight filenames are duplicated");
  if (names.includes("model.safetensors")) {
    invariant(names.length === 1, "weight layout mixes direct and sharded files");
    return "single";
  }
  for (const name of names) {
    const match = /^model-(\d{5})-of-(\d{5})\.safetensors$/.exec(name);
    invariant(match !== null, "weight shard filename is invalid");
    const index = Number(match[1]);
    invariant(Number(match[2]) === names.length && index >= 1 && index <= names.length,
      "weight shard group is incomplete or inconsistent");
  }
  // Unique canonical names, one total and N indices in [1,N] prove consecutiveness.
  return "sharded";
}

// Bind a bounded, duplicate-free index to exactly the already admitted shard set.
// metadata.total_size counts tensor data, so it is not compared with file lengths.
function validateWeightIndex(bytes, weightFiles) {
  invariant(validateWeightLayout(weightFiles) === "sharded", "weight index requires sharded weights");
  let index;
  try {
    index = parseStrictJson(bytes, {
      maximumBytes: maximumWeightIndexBytes,
      maximumDepth: 8,
      maximumTotalEntries: maximumTensorMappings + 1024,
      maximumObjectMembers: maximumTensorMappings,
      maximumArrayItems: 64,
      maximumStringCodeUnits: 512,
      maximumTotalStringCodeUnits: maximumWeightIndexBytes
    });
  } catch (error) {
    throw new Error(`weight index is invalid: ${error.message}`);
  }
  invariant(isObject(index) && isObject(index.weight_map), "weight index has no tensor mappings");
  const mappings = Object.entries(index.weight_map);
  invariant(mappings.length >= 1 && mappings.length <= maximumTensorMappings,
    "weight index tensor mapping count is invalid");
  const admitted = new Set(weightFiles.map((file) => file.filename));
  const referenced = new Set();
  for (const [tensorName, shardName] of mappings) {
    invariant(tensorName.length >= 1 && tensorName.length <= 512,
      "weight index tensor name is invalid");
    invariant(typeof shardName === "string" && admitted.has(shardName),
      "weight index references an unadmitted shard");
    referenced.add(shardName);
  }
  invariant(referenced.size === admitted.size, "weight index leaves an admitted shard unused");
  return Object.freeze({ tensorCount: mappings.length, shardCount: referenced.size });
}

module.exports = Object.freeze({ maximumWeightIndexBytes, validateWeightLayout, validateWeightIndex });
