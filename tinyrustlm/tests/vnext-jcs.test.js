"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  canonicalizeJcs,
  canonicalizeJcsBytes,
  canonicalizeVnextJcs,
  defaultLimits,
  jcsProfile,
  vnextJcsProfile
} = require("../tools/vnext-jcs.js");

function throwsCode(callback, code) {
  assert.throws(callback, (error) => error?.code === code, `expected ${code}`);
}

test("matches the RFC 8785 primitive and recursive ordering example", () => {
  const value = {
    numbers: [333333333.33333329, 1E30, 4.50, 2e-3, 0.000000000000000000000000001],
    string: "\u20ac$\u000f\nA'B\"\\\\\"/",
    literals: [null, true, false]
  };
  const expected =
    "{\"literals\":[null,true,false],\"numbers\":[333333333.3333333,1e+30,4.5,0.002,1e-27]," +
    "\"string\":\"\u20ac$\\u000f\\nA'B\\\"\\\\\\\\\\\"/\"}";

  assert.equal(jcsProfile, "RFC8785-JCS");
  assert.equal(canonicalizeJcs(value), expected);
  assert.deepEqual(canonicalizeJcsBytes(value), Buffer.from(expected, "utf8"));
});

test("sorts raw property names by unsigned UTF-16 code units", () => {
  const value = {
    "\u20ac": "Euro Sign",
    "\r": "Carriage Return",
    "\ufb33": "Hebrew Letter Dalet With Dagesh",
    "1": "One",
    "\ud83d\ude00": "Emoji: Grinning Face",
    "\u0080": "Control",
    "\u00f6": "Latin Small Letter O With Diaeresis"
  };
  const expected =
    "{\"\\r\":\"Carriage Return\",\"1\":\"One\",\"\u0080\":\"Control\"," +
    "\"\u00f6\":\"Latin Small Letter O With Diaeresis\",\"\u20ac\":\"Euro Sign\"," +
    "\"\ud83d\ude00\":\"Emoji: Grinning Face\",\"\ufb33\":\"Hebrew Letter Dalet With Dagesh\"}";

  assert.equal(canonicalizeJcs(value), expected);
});

test("preserves Unicode strings exactly without normalization", () => {
  const composed = "\u00e9";
  const decomposed = "e\u0301";
  const canonical = canonicalizeJcs({ composed, decomposed });

  assert.equal(canonical, `{"composed":"${composed}","decomposed":"${decomposed}"}`);
  assert.notEqual(Buffer.from(composed, "utf8").toString("hex"),
    Buffer.from(decomposed, "utf8").toString("hex"));
  assert.equal(Buffer.from(canonical, "utf8").includes(Buffer.from(decomposed, "utf8")), true);
});

test("uses the vNext safe-integer number profile without weakening generic JCS", () => {
  assert.equal(vnextJcsProfile, "tinyrustlm.vnext.jcs-safe-integer.v1");
  assert.equal(canonicalizeJcs(-0), "0");
  assert.equal(canonicalizeJcs(1.25), "1.25");
  assert.equal(canonicalizeVnextJcs(Number.MAX_SAFE_INTEGER), "9007199254740991");
  throwsCode(() => canonicalizeVnextJcs(-0), "jcs_negative_zero");
  throwsCode(() => canonicalizeVnextJcs(1.25), "jcs_number_not_safe_integer");
  throwsCode(() => canonicalizeVnextJcs(Number.MAX_SAFE_INTEGER + 1),
    "jcs_number_not_safe_integer");
  throwsCode(() => canonicalizeJcs(Number.NaN), "jcs_number_nonfinite");
  throwsCode(() => canonicalizeJcs(Number.POSITIVE_INFINITY), "jcs_number_nonfinite");
});

test("matches every RFC 8785 Appendix B finite number vector", () => {
  const vectors = [
    ["0000000000000000", "0"],
    ["8000000000000000", "0"],
    ["0000000000000001", "5e-324"],
    ["8000000000000001", "-5e-324"],
    ["7fefffffffffffff", "1.7976931348623157e+308"],
    ["ffefffffffffffff", "-1.7976931348623157e+308"],
    ["4340000000000000", "9007199254740992"],
    ["c340000000000000", "-9007199254740992"],
    ["4430000000000000", "295147905179352830000"],
    ["44b52d02c7e14af5", "9.999999999999997e+22"],
    ["44b52d02c7e14af6", "1e+23"],
    ["44b52d02c7e14af7", "1.0000000000000001e+23"],
    ["444b1ae4d6e2ef4e", "999999999999999700000"],
    ["444b1ae4d6e2ef4f", "999999999999999900000"],
    ["444b1ae4d6e2ef50", "1e+21"],
    ["3eb0c6f7a0b5ed8c", "9.999999999999997e-7"],
    ["3eb0c6f7a0b5ed8d", "0.000001"],
    ["41b3de4355555553", "333333333.3333332"],
    ["41b3de4355555554", "333333333.33333325"],
    ["41b3de4355555555", "333333333.3333333"],
    ["41b3de4355555556", "333333333.3333334"],
    ["41b3de4355555557", "333333333.33333343"],
    ["becbf647612f3696", "-0.0000033333333333333333"],
    ["43143ff3c1cb0959", "1424953923781206.2"]
  ];
  for (const [hex, expected] of vectors) {
    const bytes = Buffer.alloc(8);
    bytes.writeBigUInt64BE(BigInt(`0x${hex}`));
    assert.equal(canonicalizeJcs(bytes.readDoubleBE()), expected, hex);
  }

  for (const hex of ["7fffffffffffffff", "7ff0000000000000"]) {
    const bytes = Buffer.alloc(8);
    bytes.writeBigUInt64BE(BigInt(`0x${hex}`));
    throwsCode(() => canonicalizeJcs(bytes.readDoubleBE()), "jcs_number_nonfinite");
  }
});

test("rejects invalid Unicode, cycles, and non-data object shapes", () => {
  throwsCode(() => canonicalizeJcs("\ud800"), "jcs_lone_surrogate");
  throwsCode(() => canonicalizeJcs({ "\udc00": true }), "jcs_lone_surrogate");

  const cycle = {};
  cycle.self = cycle;
  throwsCode(() => canonicalizeJcs(cycle), "jcs_cycle");

  const hole = [1, , 3];
  throwsCode(() => canonicalizeJcs(hole), "jcs_array_property");

  const accessor = {};
  Object.defineProperty(accessor, "value", { enumerable: true, get: () => 1 });
  throwsCode(() => canonicalizeJcs(accessor), "jcs_accessor_property");

  const hidden = { visible: true };
  Object.defineProperty(hidden, "hidden", { value: true });
  throwsCode(() => canonicalizeJcs(hidden), "jcs_hidden_property");

  const symbol = { visible: true };
  symbol[Symbol("hidden")] = true;
  throwsCode(() => canonicalizeJcs(symbol), "jcs_symbol_property");

  const extendedArray = [1];
  extendedArray.named = 2;
  throwsCode(() => canonicalizeJcs(extendedArray), "jcs_array_property");

  const customPrototypeArray = [1];
  Object.setPrototypeOf(customPrototypeArray, {
    map() {
      throw new Error("must never execute");
    }
  });
  throwsCode(() => canonicalizeJcs(customPrototypeArray), "jcs_array_prototype");

  class CustomRecord {
    constructor() {
      this.value = 1;
    }
  }
  throwsCode(() => canonicalizeJcs(new CustomRecord()), "jcs_type_invalid");
  for (const invalid of [undefined, 1n, Symbol("value"), () => true]) {
    throwsCode(() => canonicalizeJcs(invalid), "jcs_type_invalid");
  }
});

test("enforces every canonicalization resource limit", () => {
  assert.deepEqual(Object.keys(defaultLimits), [
    "maximumDepth",
    "maximumTotalEntries",
    "maximumObjectMembers",
    "maximumArrayItems",
    "maximumStringCodeUnits",
    "maximumTotalStringCodeUnits"
  ]);
  throwsCode(() => canonicalizeJcs({ nested: true }, { maximumDepth: 1 }),
    "jcs_depth_limit");
  throwsCode(() => canonicalizeJcs([1], { maximumTotalEntries: 1 }), "jcs_entry_limit");
  throwsCode(() => canonicalizeJcs({ a: 1, b: 2 }, { maximumObjectMembers: 1 }),
    "jcs_object_limit");
  throwsCode(() => canonicalizeJcs([1, 2], { maximumArrayItems: 1 }), "jcs_array_limit");
  throwsCode(() => canonicalizeJcs({ abc: 1 }, { maximumStringCodeUnits: 2 }),
    "jcs_string_limit");
  throwsCode(() => canonicalizeJcs({ ab: "cd" }, { maximumTotalStringCodeUnits: 3 }),
    "jcs_total_string_limit");
});

test("rejects ambiguous or unknown canonicalizer options", () => {
  throwsCode(() => canonicalizeJcs({}, null), "jcs_options_invalid");
  throwsCode(() => canonicalizeJcs({}, { maximumDepth: 0 }), "jcs_limit_invalid");
  throwsCode(() => canonicalizeJcs({}, { unexpected: 1 }), "jcs_option_unknown");
  throwsCode(() => canonicalizeJcs({}, { numberProfile: "coerce" }),
    "jcs_number_profile_invalid");
  const accessorOptions = {};
  Object.defineProperty(accessorOptions, "maximumDepth", {
    enumerable: true,
    get() {
      throw new Error("must never execute");
    }
  });
  throwsCode(() => canonicalizeJcs({}, accessorOptions), "jcs_accessor_property");
  throwsCode(() => canonicalizeVnextJcs({}, { numberProfile: "rfc8785-double" }),
    "jcs_number_profile_override");
});
