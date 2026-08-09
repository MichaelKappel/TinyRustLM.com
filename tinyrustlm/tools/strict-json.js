"use strict";

const { TextDecoder } = require("node:util");

const strictJsonProfile = "tinyrustlm.strict-json.v1";
const defaultStrictJsonLimits = Object.freeze({
  maximumBytes: 512 * 1024,
  maximumDepth: 64,
  maximumTotalEntries: 32768,
  maximumObjectMembers: 4096,
  maximumArrayItems: 8192,
  maximumStringCodeUnits: 256 * 1024,
  maximumTotalStringCodeUnits: 512 * 1024,
  maximumNumberCharacters: 128
});

const limitNames = Object.freeze(Object.keys(defaultStrictJsonLimits));
const byteOrderMarks = Object.freeze([
  Buffer.from([0xef, 0xbb, 0xbf]),
  Buffer.from([0xff, 0xfe, 0x00, 0x00]),
  Buffer.from([0x00, 0x00, 0xfe, 0xff]),
  Buffer.from([0xff, 0xfe]),
  Buffer.from([0xfe, 0xff])
]);
const simpleEscapes = Object.freeze({
  "\"": "\"",
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t"
});

function fail(message, offset = null) {
  const suffix = Number.isSafeInteger(offset) ? ` at character ${offset}` : "";
  throw new Error(`strict JSON ${message}${suffix}`);
}

function normalizeLimits(options) {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    fail("options must be an object");
  }
  for (const key of Object.keys(options)) {
    if (!limitNames.includes(key)) fail(`has unknown option ${key}`);
  }
  const limits = {};
  for (const name of limitNames) {
    const value = options[name] ?? defaultStrictJsonLimits[name];
    if (!Number.isSafeInteger(value) || value <= 0) fail(`limit ${name} is invalid`);
    limits[name] = value;
  }
  return Object.freeze(limits);
}

function asBytes(input) {
  if (!Buffer.isBuffer(input) && !(input instanceof Uint8Array)) {
    fail("input must be bytes");
  }
  return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
}

function startsWith(bytes, prefix) {
  return bytes.length >= prefix.length && prefix.every((value, index) => bytes[index] === value);
}

function decodeUtf8(input, limits) {
  const bytes = asBytes(input);
  if (bytes.length === 0 || bytes.length > limits.maximumBytes) {
    fail("input is empty or outside its byte limit");
  }
  if (byteOrderMarks.some((prefix) => startsWith(bytes, prefix))) {
    fail("must not contain a byte-order mark");
  }
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch (_error) {
    fail("input is not valid UTF-8");
  }
}

class Parser {
  constructor(text, limits) {
    this.text = text;
    this.limits = limits;
    this.index = 0;
    this.totalEntries = 0;
    this.totalStringCodeUnits = 0;
  }

  parse() {
    this.skipWhitespace();
    const value = this.parseValue(0);
    this.skipWhitespace();
    if (this.index !== this.text.length) fail("contains trailing data", this.index);
    return value;
  }

  skipWhitespace() {
    while (this.index < this.text.length) {
      const code = this.text.charCodeAt(this.index);
      if (code !== 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) break;
      this.index += 1;
    }
  }

  parseValue(depth) {
    if (this.index >= this.text.length) fail("ends before a value", this.index);
    const character = this.text[this.index];
    if (character === "{") return this.parseObject(depth + 1);
    if (character === "[") return this.parseArray(depth + 1);
    if (character === "\"") return this.parseString();
    if (character === "t") return this.parseLiteral("true", true);
    if (character === "f") return this.parseLiteral("false", false);
    if (character === "n") return this.parseLiteral("null", null);
    if (character === "-" || (character >= "0" && character <= "9")) {
      return this.parseNumber();
    }
    fail("contains an invalid value", this.index);
  }

  requireDepth(depth) {
    if (depth > this.limits.maximumDepth) fail("exceeds its nesting-depth limit", this.index);
  }

  recordEntry() {
    this.totalEntries += 1;
    if (this.totalEntries > this.limits.maximumTotalEntries) {
      fail("exceeds its total-entry limit", this.index);
    }
  }

  parseObject(depth) {
    this.requireDepth(depth);
    this.index += 1;
    this.skipWhitespace();
    const result = {};
    const names = new Set();
    let memberCount = 0;
    if (this.text[this.index] === "}") {
      this.index += 1;
      return result;
    }
    while (this.index < this.text.length) {
      if (this.text[this.index] !== "\"") fail("object member name must be a string", this.index);
      const name = this.parseString();
      if (names.has(name)) fail("contains a duplicate object member", this.index);
      names.add(name);
      memberCount += 1;
      if (memberCount > this.limits.maximumObjectMembers) {
        fail("object exceeds its member limit", this.index);
      }
      this.recordEntry();
      this.skipWhitespace();
      if (this.text[this.index] !== ":") fail("object member is missing a colon", this.index);
      this.index += 1;
      this.skipWhitespace();
      const value = this.parseValue(depth);
      Object.defineProperty(result, name, {
        value,
        enumerable: true,
        configurable: true,
        writable: true
      });
      this.skipWhitespace();
      const delimiter = this.text[this.index];
      if (delimiter === "}") {
        this.index += 1;
        return result;
      }
      if (delimiter !== ",") fail("object member has an invalid delimiter", this.index);
      this.index += 1;
      this.skipWhitespace();
    }
    fail("object is not closed", this.index);
  }

  parseArray(depth) {
    this.requireDepth(depth);
    this.index += 1;
    this.skipWhitespace();
    const result = [];
    if (this.text[this.index] === "]") {
      this.index += 1;
      return result;
    }
    while (this.index < this.text.length) {
      if (result.length >= this.limits.maximumArrayItems) {
        fail("array exceeds its item limit", this.index);
      }
      this.recordEntry();
      result.push(this.parseValue(depth));
      this.skipWhitespace();
      const delimiter = this.text[this.index];
      if (delimiter === "]") {
        this.index += 1;
        return result;
      }
      if (delimiter !== ",") fail("array item has an invalid delimiter", this.index);
      this.index += 1;
      this.skipWhitespace();
    }
    fail("array is not closed", this.index);
  }

  parseString() {
    this.index += 1;
    let result = "";
    let codeUnits = 0;
    while (this.index < this.text.length) {
      const code = this.text.charCodeAt(this.index);
      if (code === 0x22) {
        this.index += 1;
        this.totalStringCodeUnits += codeUnits;
        if (this.totalStringCodeUnits > this.limits.maximumTotalStringCodeUnits) {
          fail("exceeds its total string limit", this.index);
        }
        return result;
      }
      if (code === 0x5c) {
        this.index += 1;
        const escaped = this.parseEscape();
        result += escaped;
        codeUnits += escaped.length;
      } else {
        if (code <= 0x1f) fail("string contains an unescaped control", this.index);
        if (code >= 0xd800 && code <= 0xdbff) {
          const low = this.text.charCodeAt(this.index + 1);
          if (!(low >= 0xdc00 && low <= 0xdfff)) {
            fail("string contains a lone high surrogate", this.index);
          }
          result += this.text[this.index] + this.text[this.index + 1];
          codeUnits += 2;
          this.index += 2;
        } else {
          if (code >= 0xdc00 && code <= 0xdfff) {
            fail("string contains a lone low surrogate", this.index);
          }
          result += this.text[this.index];
          codeUnits += 1;
          this.index += 1;
        }
      }
      if (codeUnits > this.limits.maximumStringCodeUnits) {
        fail("string exceeds its code-unit limit", this.index);
      }
    }
    fail("string is not closed", this.index);
  }

  parseEscape() {
    if (this.index >= this.text.length) fail("string ends in an escape", this.index);
    const character = this.text[this.index];
    this.index += 1;
    if (Object.hasOwn(simpleEscapes, character)) return simpleEscapes[character];
    if (character !== "u") fail("string contains an invalid escape", this.index - 1);
    const high = this.parseHexCodeUnit();
    if (high >= 0xdc00 && high <= 0xdfff) {
      fail("string contains a lone low surrogate", this.index - 4);
    }
    if (high < 0xd800 || high > 0xdbff) return String.fromCharCode(high);
    if (this.text[this.index] !== "\\" || this.text[this.index + 1] !== "u") {
      fail("string contains a lone high surrogate", this.index - 4);
    }
    this.index += 2;
    const low = this.parseHexCodeUnit();
    if (low < 0xdc00 || low > 0xdfff) {
      fail("string contains a lone high surrogate", this.index - 10);
    }
    return String.fromCharCode(high, low);
  }

  parseHexCodeUnit() {
    const start = this.index;
    const end = start + 4;
    if (end > this.text.length) fail("Unicode escape is incomplete", start);
    const token = this.text.slice(start, end);
    if (!/^[0-9A-Fa-f]{4}$/u.test(token)) fail("Unicode escape is invalid", start);
    this.index = end;
    return Number.parseInt(token, 16);
  }

  parseLiteral(token, value) {
    if (this.text.slice(this.index, this.index + token.length) !== token) {
      fail("contains an invalid literal", this.index);
    }
    this.index += token.length;
    return value;
  }

  parseNumber() {
    const start = this.index;
    if (this.text[this.index] === "-") this.index += 1;
    if (this.text[this.index] === "0") {
      this.index += 1;
      if (this.isDigit(this.text[this.index])) fail("number contains a leading zero", this.index);
    } else {
      if (!this.isNonzeroDigit(this.text[this.index])) fail("number has an invalid integer", this.index);
      while (this.isDigit(this.text[this.index])) this.index += 1;
    }
    if (this.text[this.index] === ".") {
      this.index += 1;
      if (!this.isDigit(this.text[this.index])) fail("number has an empty fraction", this.index);
      while (this.isDigit(this.text[this.index])) this.index += 1;
    }
    if (this.text[this.index] === "e" || this.text[this.index] === "E") {
      this.index += 1;
      if (this.text[this.index] === "+" || this.text[this.index] === "-") this.index += 1;
      if (!this.isDigit(this.text[this.index])) fail("number has an empty exponent", this.index);
      while (this.isDigit(this.text[this.index])) this.index += 1;
    }
    const token = this.text.slice(start, this.index);
    if (token.length > this.limits.maximumNumberCharacters) {
      fail("number exceeds its character limit", start);
    }
    const value = Number(token);
    if (!Number.isFinite(value)) fail("number is outside the finite range", start);
    if (Object.is(value, -0)) fail("must not contain negative zero", start);
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
      fail("must not contain an unsafe integer", start);
    }
    const significand = token.split(/[eE]/u, 1)[0];
    if (value === 0 && /[1-9]/u.test(significand)) {
      fail("number underflows the finite range", start);
    }
    return value;
  }

  isDigit(character) {
    return character >= "0" && character <= "9";
  }

  isNonzeroDigit(character) {
    return character >= "1" && character <= "9";
  }
}

function parseStrictJson(input, options = {}) {
  const limits = normalizeLimits(options);
  return new Parser(decodeUtf8(input, limits), limits).parse();
}

module.exports = Object.freeze({
  defaultStrictJsonLimits,
  parseStrictJson,
  strictJsonProfile
});
