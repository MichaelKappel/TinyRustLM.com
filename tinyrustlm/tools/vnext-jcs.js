"use strict";

const { failEvidence } = require("./vnext-evidence-error.js");

const jcsProfile = "RFC8785-JCS";
const vnextJcsProfile = "tinyrustlm.vnext.jcs-safe-integer.v1";
const defaultLimits = Object.freeze({
  maximumDepth: 32,
  maximumTotalEntries: 32768,
  maximumObjectMembers: 128,
  maximumArrayItems: 16384,
  maximumStringCodeUnits: 65536,
  maximumTotalStringCodeUnits: 1048576
});
const limitNames = Object.freeze(Object.keys(defaultLimits));

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateUnicodeScalarString(value, state) {
  if (value.length > state.limits.maximumStringCodeUnits) {
    failEvidence("jcs_string_limit", "canonicalize");
  }
  state.totalStringCodeUnits += value.length;
  if (state.totalStringCodeUnits > state.limits.maximumTotalStringCodeUnits) {
    failEvidence("jcs_total_string_limit", "canonicalize");
  }
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        failEvidence("jcs_lone_surrogate", "canonicalize");
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      failEvidence("jcs_lone_surrogate", "canonicalize");
    }
  }
}

function compareUtf16(left, right) {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function normalizeOptions(options) {
  if (!isPlainObject(options)) failEvidence("jcs_options_invalid", "canonicalize");
  const optionKeys = Object.keys(options);
  assertDataObject(options, optionKeys);
  const allowed = new Set([...limitNames, "numberProfile"]);
  for (const key of optionKeys) {
    if (!allowed.has(key)) failEvidence("jcs_option_unknown", "canonicalize");
  }
  const limits = {};
  for (const name of limitNames) {
    const value = options[name] ?? defaultLimits[name];
    if (!Number.isSafeInteger(value) || value <= 0) {
      failEvidence("jcs_limit_invalid", "canonicalize");
    }
    limits[name] = value;
  }
  const numberProfile = options.numberProfile ?? "rfc8785-double";
  if (numberProfile !== "rfc8785-double" && numberProfile !== "vnext-safe-integer") {
    failEvidence("jcs_number_profile_invalid", "canonicalize");
  }
  return Object.freeze({ limits: Object.freeze(limits), numberProfile });
}

function assertDataObject(value, keys) {
  if (Object.getOwnPropertySymbols(value).length !== 0) {
    failEvidence("jcs_symbol_property", "canonicalize");
  }
  const names = Object.getOwnPropertyNames(value);
  if (names.length !== keys.length || names.some((name) => !keys.includes(name))) {
    failEvidence("jcs_hidden_property", "canonicalize");
  }
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence("jcs_accessor_property", "canonicalize");
    }
  }
}

function assertDataArray(value) {
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    failEvidence("jcs_array_prototype", "canonicalize");
  }
  if (Object.getOwnPropertySymbols(value).length !== 0) {
    failEvidence("jcs_symbol_property", "canonicalize");
  }
  const names = Object.getOwnPropertyNames(value);
  if (names.length !== value.length + 1 || !names.includes("length")) {
    failEvidence("jcs_array_property", "canonicalize");
  }
  for (let index = 0; index < value.length; index += 1) {
    const key = String(index);
    if (!Object.hasOwn(value, key)) failEvidence("jcs_array_hole", "canonicalize");
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence("jcs_accessor_property", "canonicalize");
    }
  }
}

function serialize(value, state, depth) {
  if (depth > state.limits.maximumDepth) failEvidence("jcs_depth_limit", "canonicalize");
  state.totalEntries += 1;
  if (state.totalEntries > state.limits.maximumTotalEntries) {
    failEvidence("jcs_entry_limit", "canonicalize");
  }

  if (value === null) return "null";
  if (value === true) return "true";
  if (value === false) return "false";
  if (typeof value === "string") {
    validateUnicodeScalarString(value, state);
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) failEvidence("jcs_number_nonfinite", "canonicalize");
    if (state.numberProfile === "vnext-safe-integer") {
      if (!Number.isSafeInteger(value)) failEvidence("jcs_number_not_safe_integer", "canonicalize");
      if (Object.is(value, -0)) failEvidence("jcs_negative_zero", "canonicalize");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (state.active.has(value)) failEvidence("jcs_cycle", "canonicalize");
    if (value.length > state.limits.maximumArrayItems) {
      failEvidence("jcs_array_limit", "canonicalize");
    }
    assertDataArray(value);
    state.active.add(value);
    try {
      const entries = [];
      for (let index = 0; index < value.length; index += 1) {
        entries.push(serialize(value[index], state, depth + 1));
      }
      return `[${entries.join(",")}]`;
    } finally {
      state.active.delete(value);
    }
  }
  if (!isPlainObject(value)) failEvidence("jcs_type_invalid", "canonicalize");
  if (state.active.has(value)) failEvidence("jcs_cycle", "canonicalize");
  const keys = Object.keys(value);
  if (keys.length > state.limits.maximumObjectMembers) {
    failEvidence("jcs_object_limit", "canonicalize");
  }
  assertDataObject(value, keys);
  for (const key of keys) validateUnicodeScalarString(key, state);
  keys.sort(compareUtf16);
  state.active.add(value);
  try {
    return `{${keys.map((key) =>
      `${JSON.stringify(key)}:${serialize(value[key], state, depth + 1)}`).join(",")}}`;
  } finally {
    state.active.delete(value);
  }
}

function canonicalizeJcs(value, options = {}) {
  const normalized = normalizeOptions(options);
  return serialize(value, {
    ...normalized,
    active: new Set(),
    totalEntries: 0,
    totalStringCodeUnits: 0
  }, 1);
}

function canonicalizeJcsBytes(value, options = {}) {
  return Buffer.from(canonicalizeJcs(value, options), "utf8");
}

function canonicalizeVnextJcs(value, options = {}) {
  const normalized = normalizeOptions(options);
  if (Object.hasOwn(options, "numberProfile") &&
      normalized.numberProfile !== "vnext-safe-integer") {
    failEvidence("jcs_number_profile_override", "canonicalize");
  }
  return canonicalizeJcs(value, {
    ...normalized.limits,
    numberProfile: "vnext-safe-integer"
  });
}

function canonicalizeVnextJcsBytes(value, options = {}) {
  return Buffer.from(canonicalizeVnextJcs(value, options), "utf8");
}

module.exports = Object.freeze({
  canonicalizeJcs,
  canonicalizeJcsBytes,
  canonicalizeVnextJcs,
  canonicalizeVnextJcsBytes,
  defaultLimits,
  jcsProfile,
  vnextJcsProfile
});
