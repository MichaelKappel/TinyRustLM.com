(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.TinyRustLMPrompt2Request = api;
  }
}(typeof globalThis === "object" ? globalThis : this, function (root) {
  "use strict";

  const REQUEST_SCHEMA = "tinyrustlm.prompt2-request/1";
  const HEADER_BYTES = 128;
  const MESSAGE_RECORD_BYTES = 24;
  const SECTION_ALIGNMENT = 64;
  const MAXIMUM_MESSAGES = 256;
  const MAXIMUM_MESSAGE_CONTENT_BYTES = 262144;
  const MAXIMUM_TOTAL_CONTENT_BYTES = 1048576;
  const MAXIMUM_REQUEST_BYTES = 1054848;
  const MAXIMUM_NEW_TOKENS = 4096;
  const REQUEST_MAGIC = Object.freeze([0x50, 0x32, 0x52, 0x51, 0x0d, 0x0a, 0x1a, 0x0a]);
  const REQUEST_FORMAT_ID = Object.freeze([
    0x6d, 0x69, 0x6e, 0x69, 0x6d, 0x6f, 0x64, 0x65,
    0x6c, 0x2e, 0x70, 0x32, 0x72, 0x71, 0x00, 0x00
  ]);
  const REQUEST_FIELDS = Object.freeze(["messages", "sampling", "seed"]);
  const MESSAGE_FIELDS = Object.freeze(["role", "content"]);
  const SAMPLING_FIELDS = Object.freeze([
    "temperatureMillionths",
    "topK",
    "topPMillionths",
    "repetitionPenaltyMillionths",
    "repetitionWindow",
    "maximumNewTokens"
  ]);
  const ROLE_IDS = Object.freeze({ system: 1, user: 2, assistant: 3 });
  const MAXIMUM_U64 = (1n << 64n) - 1n;

  class Prompt2RequestError extends Error {
    constructor(code) {
      super(code);
      this.name = "Prompt2RequestError";
      this.code = code;
    }
  }

  function reject(code) {
    throw new Prompt2RequestError(code);
  }

  function requireExactObject(value, fields, code) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      reject(code);
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      reject(code);
    }
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      reject(code);
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Object.keys(descriptors);
    if (keys.length !== fields.length || fields.some((field) => !Object.hasOwn(descriptors, field))) {
      reject(code);
    }
    for (const field of fields) {
      const descriptor = descriptors[field];
      if (!Object.hasOwn(descriptor, "value") || descriptor.get || descriptor.set) {
        reject(code);
      }
    }
    return value;
  }

  function requireUnsigned32(value, minimum, maximum, code) {
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
      reject(code);
    }
    return value;
  }

  function requireSeed(value) {
    let seed;
    if (typeof value === "bigint") {
      seed = value;
    } else if (Number.isSafeInteger(value) && value >= 0) {
      seed = BigInt(value);
    } else if (typeof value === "string" && /^(?:0|[1-9][0-9]{0,19})$/u.test(value)) {
      seed = BigInt(value);
    } else {
      reject("prompt2-request-seed");
    }
    if (seed < 0n || seed > MAXIMUM_U64) {
      reject("prompt2-request-seed");
    }
    return seed;
  }

  function hasUnpairedSurrogate(value) {
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = value.charCodeAt(index + 1);
        if (!(next >= 0xdc00 && next <= 0xdfff)) {
          return true;
        }
        index += 1;
      } else if (code >= 0xdc00 && code <= 0xdfff) {
        return true;
      }
    }
    return false;
  }

  function textEncoder() {
    if (!root || typeof root.TextEncoder !== "function") {
      reject("prompt2-request-text-encoder");
    }
    return new root.TextEncoder();
  }

  function normalizeMessages(value) {
    if (!Array.isArray(value) || value.length < 1 || value.length > MAXIMUM_MESSAGES) {
      reject("prompt2-request-messages");
    }
    const encoder = textEncoder();
    const messages = [];
    let totalContentBytes = 0;
    for (const candidate of value) {
      const message = requireExactObject(candidate, MESSAGE_FIELDS, "prompt2-request-message");
      if (!Object.hasOwn(ROLE_IDS, message.role)) {
        reject("prompt2-request-role");
      }
      if (typeof message.content !== "string" || hasUnpairedSurrogate(message.content)) {
        reject("prompt2-request-content");
      }
      const bytes = encoder.encode(message.content);
      if (bytes.byteLength > MAXIMUM_MESSAGE_CONTENT_BYTES) {
        reject("prompt2-request-content");
      }
      totalContentBytes += bytes.byteLength;
      if (!Number.isSafeInteger(totalContentBytes) ||
          totalContentBytes > MAXIMUM_TOTAL_CONTENT_BYTES) {
        reject("prompt2-request-size");
      }
      messages.push(Object.freeze({ role: message.role, bytes }));
    }
    return Object.freeze({ messages: Object.freeze(messages), totalContentBytes });
  }

  function normalizeSampling(value) {
    const sampling = requireExactObject(value, SAMPLING_FIELDS, "prompt2-request-sampling");
    const normalized = Object.freeze({
      temperatureMillionths: requireUnsigned32(
        sampling.temperatureMillionths,
        0,
        4000000,
        "prompt2-request-temperature"
      ),
      topK: requireUnsigned32(sampling.topK, 1, 1024, "prompt2-request-top-k"),
      topPMillionths: requireUnsigned32(
        sampling.topPMillionths,
        1,
        1000000,
        "prompt2-request-top-p"
      ),
      repetitionPenaltyMillionths: requireUnsigned32(
        sampling.repetitionPenaltyMillionths,
        1000000,
        2000000,
        "prompt2-request-repetition-penalty"
      ),
      repetitionWindow: requireUnsigned32(
        sampling.repetitionWindow,
        0,
        64,
        "prompt2-request-repetition-window"
      ),
      maximumNewTokens: requireUnsigned32(
        sampling.maximumNewTokens,
        1,
        MAXIMUM_NEW_TOKENS,
        "prompt2-request-maximum-new-tokens"
      )
    });
    if (normalized.temperatureMillionths === 0 &&
        (normalized.topK !== 1 || normalized.topPMillionths !== 1000000)) {
      reject("prompt2-request-greedy-config");
    }
    return normalized;
  }

  function alignUp(value) {
    const remainder = value % SECTION_ALIGNMENT;
    return remainder === 0 ? value : value + SECTION_ALIGNMENT - remainder;
  }

  function setUint64(view, offset, value) {
    view.setBigUint64(offset, BigInt(value), true);
  }

  function encodeRequest(value) {
    const request = requireExactObject(value, REQUEST_FIELDS, "prompt2-request-fields");
    const normalizedMessages = normalizeMessages(request.messages);
    const sampling = normalizeSampling(request.sampling);
    const seed = requireSeed(request.seed);
    const tableBytes = normalizedMessages.messages.length * MESSAGE_RECORD_BYTES;
    const tableEnd = HEADER_BYTES + tableBytes;
    const contentOffset = alignUp(tableEnd);
    const fileBytes = contentOffset + normalizedMessages.totalContentBytes;
    if (!Number.isSafeInteger(fileBytes) || fileBytes > MAXIMUM_REQUEST_BYTES) {
      reject("prompt2-request-size");
    }

    const output = new Uint8Array(fileBytes);
    output.set(REQUEST_MAGIC, 0);
    output.set(REQUEST_FORMAT_ID, 8);
    const view = new DataView(output.buffer);
    view.setUint32(24, HEADER_BYTES, true);
    view.setUint16(28, 1, true);
    view.setUint16(30, 0, true);
    view.setUint32(32, 0x01020304, true);
    view.setUint32(36, 0, true);
    setUint64(view, 40, fileBytes);
    setUint64(view, 48, HEADER_BYTES);
    view.setUint32(56, normalizedMessages.messages.length, true);
    view.setUint32(60, MESSAGE_RECORD_BYTES, true);
    setUint64(view, 64, contentOffset);
    setUint64(view, 72, normalizedMessages.totalContentBytes);
    view.setUint32(80, sampling.temperatureMillionths, true);
    view.setUint32(84, sampling.topK, true);
    view.setUint32(88, sampling.topPMillionths, true);
    view.setUint32(92, sampling.repetitionPenaltyMillionths, true);
    view.setUint32(96, sampling.repetitionWindow, true);
    view.setUint32(100, sampling.maximumNewTokens, true);
    setUint64(view, 104, seed);

    let relativeOffset = 0;
    normalizedMessages.messages.forEach((message, index) => {
      const recordOffset = HEADER_BYTES + index * MESSAGE_RECORD_BYTES;
      view.setUint16(recordOffset, ROLE_IDS[message.role], true);
      view.setUint16(recordOffset + 2, 0, true);
      view.setUint32(recordOffset + 4, index, true);
      setUint64(view, recordOffset + 8, relativeOffset);
      setUint64(view, recordOffset + 16, message.bytes.byteLength);
      output.set(message.bytes, contentOffset + relativeOffset);
      relativeOffset += message.bytes.byteLength;
    });
    return output;
  }

  return Object.freeze({
    REQUEST_SCHEMA,
    HEADER_BYTES,
    MESSAGE_RECORD_BYTES,
    SECTION_ALIGNMENT,
    MAXIMUM_MESSAGES,
    MAXIMUM_MESSAGE_CONTENT_BYTES,
    MAXIMUM_TOTAL_CONTENT_BYTES,
    MAXIMUM_REQUEST_BYTES,
    MAXIMUM_NEW_TOKENS,
    ROLE_IDS,
    Prompt2RequestError,
    encodeRequest
  });
}));
