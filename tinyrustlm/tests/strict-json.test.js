"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  defaultStrictJsonLimits,
  parseStrictJson,
  strictJsonProfile
} = require("../tools/strict-json.js");

const bytes = (value) => Buffer.from(value, "utf8");

test("parses bounded UTF-8 JSON without changing decoded member identity", () => {
  const value = parseStrictJson(bytes(
    '{"text":"A\\u00df\\u6771\\ud834\\udd1e","array":[true,false,null,1.25e2],"__proto__":{"safe":true}}'
  ));
  assert.equal(strictJsonProfile, "tinyrustlm.strict-json.v1");
  assert.equal(defaultStrictJsonLimits.maximumBytes, 512 * 1024);
  assert.equal(value.text, "Aß東𝄞");
  assert.deepEqual(value.array, [true, false, null, 125]);
  assert.equal(Object.hasOwn(value, "__proto__"), true);
  assert.deepEqual(value.__proto__, { safe: true });
  assert.equal(Object.getPrototypeOf(value), Object.prototype);
});

test("rejects literal and escaped-equivalent duplicate object members", () => {
  assert.throws(() => parseStrictJson(bytes('{"name":1,"name":2}')),
    /duplicate object member/i);
  assert.throws(() => parseStrictJson(bytes('{"name":1,"n\\u0061me":2}')),
    /duplicate object member/i);
  assert.throws(() => parseStrictJson(bytes('{"𝄞":1,"\\ud834\\udd1e":2}')),
    /duplicate object member/i);
});

test("rejects byte-order marks and malformed UTF-8 before parsing", () => {
  assert.throws(() => parseStrictJson(Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]),
    bytes("{}")
  ])), /byte-order mark/i);
  assert.throws(() => parseStrictJson(Buffer.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0xc3, 0x28, 0x7d])),
    /not valid UTF-8/i);
});

test("rejects lone escaped surrogates while accepting a valid pair", () => {
  assert.throws(() => parseStrictJson(bytes('{"value":"\\ud800"}')), /lone high surrogate/i);
  assert.throws(() => parseStrictJson(bytes('{"value":"\\udc00"}')), /lone low surrogate/i);
  assert.throws(() => parseStrictJson(bytes('{"value":"\\ud800\\u0041"}')),
    /lone high surrogate/i);
  assert.equal(parseStrictJson(bytes('{"value":"\\ud83d\\ude00"}')).value, "😀");
});

test("enforces byte, depth, member, item, entry, and string limits", () => {
  assert.throws(() => parseStrictJson(bytes("{}"), { maximumBytes: 1 }), /byte limit/i);
  assert.throws(() => parseStrictJson(bytes('{"a":{"b":{"c":1}}}'), { maximumDepth: 2 }),
    /nesting-depth limit/i);
  assert.throws(() => parseStrictJson(bytes('{"a":1,"b":2}'), { maximumObjectMembers: 1 }),
    /member limit/i);
  assert.throws(() => parseStrictJson(bytes("[1,2]"), { maximumArrayItems: 1 }), /item limit/i);
  assert.throws(() => parseStrictJson(bytes('{"a":[1]}'), { maximumTotalEntries: 1 }),
    /total-entry limit/i);
  assert.throws(() => parseStrictJson(bytes('{"abc":1}'), { maximumStringCodeUnits: 2 }),
    /code-unit limit/i);
  assert.throws(() => parseStrictJson(bytes('{"ab":"cd"}'), {
    maximumStringCodeUnits: 2,
    maximumTotalStringCodeUnits: 3
  }), /total string limit/i);
});

test("rejects negative zero, unsafe integers, numeric overflow, and underflow", () => {
  for (const value of ["-0", "-0.0", "-0e4"]) {
    assert.throws(() => parseStrictJson(bytes(value)), /negative zero/i);
  }
  assert.throws(() => parseStrictJson(bytes("9007199254740992")), /unsafe integer/i);
  assert.throws(() => parseStrictJson(bytes("1e400")), /finite range/i);
  assert.throws(() => parseStrictJson(bytes("1e-400")), /underflows/i);
  assert.equal(parseStrictJson(bytes("9007199254740991")), Number.MAX_SAFE_INTEGER);
  assert.equal(parseStrictJson(bytes("5e-324")), Number.MIN_VALUE);
});

test("rejects malformed grammar and all trailing non-whitespace data", () => {
  for (const value of ["01", "1.", "1e", "[1,]", '{"a":1,}', "{}{}", "true false"]) {
    assert.throws(() => parseStrictJson(bytes(value)), /strict JSON/i, value);
  }
  assert.deepEqual(parseStrictJson(bytes(" \r\n\t{} \n")), {});
});

test("rejects unknown or invalid parser limits", () => {
  assert.throws(() => parseStrictJson(bytes("{}"), { surprise: 1 }), /unknown option/i);
  assert.throws(() => parseStrictJson(bytes("{}"), { maximumDepth: 0 }), /limit maximumDepth/i);
});
