// Publishes one frozen SHA-256 API through CommonJS or the browser global.
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.TinyRustLMIncrementalSha256 = api;
  }
}(typeof globalThis === "object" ? globalThis : this,
// Constructs the dependency-free API without reading host-specific globals.
function () {
  "use strict";

  const BLOCK_BYTES = 64;
  const DIGEST_BYTES = 32;
  const INITIAL_STATE = Object.freeze([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);
  const ROUND_CONSTANTS = Object.freeze([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);

  class IncrementalSha256InputError extends TypeError {
    // Creates a stable typed input error whose code is also its message.
    constructor(code) {
      super(code);
      this.name = "IncrementalSha256InputError";
      this.code = code;
    }
  }

  class IncrementalSha256StateError extends Error {
    // Creates a stable lifecycle error for operations attempted after finalization.
    constructor(code) {
      super(code);
      this.name = "IncrementalSha256StateError";
      this.code = code;
    }
  }

  // Rotates one unsigned 32-bit word right by the requested bit count.
  function rotateRight(value, count) {
    return ((value >>> count) | (value << (32 - count))) >>> 0;
  }

  // Writes the low 32 bits of value into target at offset in network byte order.
  function writeUint32BigEndian(target, offset, value) {
    target[offset] = value >>> 24;
    target[offset + 1] = value >>> 16;
    target[offset + 2] = value >>> 8;
    target[offset + 3] = value;
  }

  // Accepts Uint8Array values across realms while excluding other typed views.
  function isUint8Array(value) {
    if (value instanceof Uint8Array) return true;
    return typeof ArrayBuffer === "function" &&
      typeof ArrayBuffer.isView === "function" &&
      ArrayBuffer.isView(value) &&
      Object.prototype.toString.call(value) === "[object Uint8Array]";
  }

  // Creates a single-use streaming SHA-256 state with a fixed 64-byte buffer.
  function createSha256() {
    if (new.target !== undefined || arguments.length !== 0) {
      throw new IncrementalSha256InputError(
        "incremental-sha256-create-arguments"
      );
    }

    const state = Uint32Array.from(INITIAL_STATE);
    const block = new Uint8Array(BLOCK_BYTES);
    const schedule = new Uint32Array(64);
    let bufferedBytes = 0;
    let byteLengthLow = 0;
    let byteLengthHigh = 0;
    let finalized = false;

    // Compresses one complete 64-byte block into the mutable eight-word state.
    function compress(source, offset) {
      for (let index = 0; index < 16; index += 1) {
        const sourceOffset = offset + index * 4;
        schedule[index] = (
          (source[sourceOffset] << 24) |
          (source[sourceOffset + 1] << 16) |
          (source[sourceOffset + 2] << 8) |
          source[sourceOffset + 3]
        ) >>> 0;
      }
      for (let index = 16; index < 64; index += 1) {
        const word15 = schedule[index - 15];
        const word2 = schedule[index - 2];
        const sigma0 = (
          rotateRight(word15, 7) ^
          rotateRight(word15, 18) ^
          (word15 >>> 3)
        ) >>> 0;
        const sigma1 = (
          rotateRight(word2, 17) ^
          rotateRight(word2, 19) ^
          (word2 >>> 10)
        ) >>> 0;
        schedule[index] = (
          schedule[index - 16] + sigma0 +
          schedule[index - 7] + sigma1
        ) >>> 0;
      }

      let a = state[0];
      let b = state[1];
      let c = state[2];
      let d = state[3];
      let e = state[4];
      let f = state[5];
      let g = state[6];
      let h = state[7];

      for (let index = 0; index < 64; index += 1) {
        const sum1 = (
          rotateRight(e, 6) ^
          rotateRight(e, 11) ^
          rotateRight(e, 25)
        ) >>> 0;
        const choice = ((e & f) ^ (~e & g)) >>> 0;
        const temporary1 = (
          h + sum1 + choice + ROUND_CONSTANTS[index] + schedule[index]
        ) >>> 0;
        const sum0 = (
          rotateRight(a, 2) ^
          rotateRight(a, 13) ^
          rotateRight(a, 22)
        ) >>> 0;
        const majority = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
        const temporary2 = (sum0 + majority) >>> 0;

        h = g;
        g = f;
        f = e;
        e = (d + temporary1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temporary1 + temporary2) >>> 0;
      }

      state[0] = (state[0] + a) >>> 0;
      state[1] = (state[1] + b) >>> 0;
      state[2] = (state[2] + c) >>> 0;
      state[3] = (state[3] + d) >>> 0;
      state[4] = (state[4] + e) >>> 0;
      state[5] = (state[5] + f) >>> 0;
      state[6] = (state[6] + g) >>> 0;
      state[7] = (state[7] + h) >>> 0;
    }

    // Adds a safe-integer byte count to the split unsigned 64-bit message length.
    function addByteLength(length) {
      const lowAddition = length >>> 0;
      const highAddition = Math.floor(length / 0x100000000);
      const lowSum = byteLengthLow + lowAddition;
      byteLengthLow = lowSum >>> 0;
      byteLengthHigh = (
        byteLengthHigh + highAddition + (lowSum >= 0x100000000 ? 1 : 0)
      ) >>> 0;
    }

    // Consumes exactly one byte view, retaining only an incomplete trailing block.
    function update(bytes) {
      if (finalized) {
        throw new IncrementalSha256StateError("incremental-sha256-finalized");
      }
      if (arguments.length !== 1) {
        throw new IncrementalSha256InputError(
          "incremental-sha256-update-arguments"
        );
      }
      if (!isUint8Array(bytes)) {
        throw new IncrementalSha256InputError("incremental-sha256-input");
      }

      const length = bytes.byteLength;
      addByteLength(length);
      let offset = 0;

      if (bufferedBytes !== 0) {
        const copiedBytes = Math.min(BLOCK_BYTES - bufferedBytes, length);
        for (let index = 0; index < copiedBytes; index += 1) {
          block[bufferedBytes + index] = bytes[index];
        }
        bufferedBytes += copiedBytes;
        offset = copiedBytes;
        if (bufferedBytes !== BLOCK_BYTES) return hasher;
        compress(block, 0);
        bufferedBytes = 0;
      }

      while (offset + BLOCK_BYTES <= length) {
        compress(bytes, offset);
        offset += BLOCK_BYTES;
      }

      bufferedBytes = length - offset;
      for (let index = 0; index < bufferedBytes; index += 1) {
        block[index] = bytes[offset + index];
      }
      return hasher;
    }

    // Finalizes once, returns the 32-byte digest, and clears mutable hash state.
    function digest() {
      if (arguments.length !== 0) {
        throw new IncrementalSha256InputError(
          "incremental-sha256-digest-arguments"
        );
      }
      if (finalized) {
        throw new IncrementalSha256StateError("incremental-sha256-finalized");
      }
      finalized = true;

      block[bufferedBytes] = 0x80;
      bufferedBytes += 1;
      if (bufferedBytes > 56) {
        block.fill(0, bufferedBytes, BLOCK_BYTES);
        compress(block, 0);
        bufferedBytes = 0;
      }
      block.fill(0, bufferedBytes, 56);

      const bitLengthHigh = (
        (byteLengthHigh << 3) | (byteLengthLow >>> 29)
      ) >>> 0;
      const bitLengthLow = (byteLengthLow << 3) >>> 0;
      writeUint32BigEndian(block, 56, bitLengthHigh);
      writeUint32BigEndian(block, 60, bitLengthLow);
      compress(block, 0);

      const output = new Uint8Array(DIGEST_BYTES);
      for (let index = 0; index < state.length; index += 1) {
        writeUint32BigEndian(output, index * 4, state[index]);
      }

      bufferedBytes = 0;
      byteLengthLow = 0;
      byteLengthHigh = 0;
      block.fill(0);
      schedule.fill(0);
      state.fill(0);
      return output;
    }

    const hasher = {};
    Object.defineProperties(hasher, {
      update: { enumerable: true, value: update },
      digest: { enumerable: true, value: digest },
      bufferCapacity: {
        enumerable: false,
        // Exposes the fixed internal block capacity for bounded-memory checks.
        get() { return block.byteLength; }
      },
      bufferedByteLength: {
        enumerable: false,
        // Reports only the currently retained incomplete-block byte count.
        get() { return bufferedBytes; }
      }
    });
    return Object.freeze(hasher);
  }

  return Object.freeze({
    createSha256,
    IncrementalSha256InputError,
    IncrementalSha256StateError
  });
}));
