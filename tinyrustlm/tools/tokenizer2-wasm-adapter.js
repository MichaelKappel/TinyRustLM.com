"use strict";

(function installTokenizer2(root, factory) {
  const api = factory();
  if (typeof module === "object" && module && module.exports) {
    module.exports = api;
  } else {
    Object.defineProperty(root, "TinyRustLMTokenizer2", {
      value: api,
      configurable: false,
      enumerable: true,
      writable: false
    });
  }
}(typeof globalThis === "object" ? globalThis : this, function createApi() {
  const profileId = "tinyrustlm.tokenizer2-wasm/1";
  const abiVersion = 1;
  const limits = Object.freeze({
    maximumTransferBytes: 16_777_216,
    maximumArtifactBytes: 16_777_216,
    maximumInputBytes: 32_768,
    maximumOutputTokens: 65_536,
    maximumDecodedBytes: 131_072,
    maximumModuleBytes: 4_194_304,
    maximumLiveAllocations: 2,
    maximumLiveAllocationBytes: 16_842_752
  });
  const decodeModes = Object.freeze({ includeAll: 0, skipSpecial: 1 });
  const statusCodes = Object.freeze({
    ok: 0,
    boundaryError: 1,
    tokenizerError: 2,
    internalError: 3
  });
  const names = Object.freeze({
    abiVersion: "trlm_tokenizer2_wasm_abi_version",
    maximumTransferBytes: "trlm_tokenizer2_wasm_max_transfer_bytes",
    allocate: "trlm_tokenizer2_wasm_allocate",
    release: "trlm_tokenizer2_wasm_release",
    load: "trlm_tokenizer2_wasm_load",
    encode: "trlm_tokenizer2_wasm_encode",
    decodeCurrent: "trlm_tokenizer2_wasm_decode_current",
    tokenCount: "trlm_tokenizer2_wasm_token_count",
    baseTokenCount: "trlm_tokenizer2_wasm_base_token_count",
    artifactLength: "trlm_tokenizer2_wasm_artifact_len",
    artifactSha256Pointer: "trlm_tokenizer2_wasm_artifact_sha256_ptr",
    tokenIdsPointer: "trlm_tokenizer2_wasm_token_ids_ptr",
    tokenIdsCount: "trlm_tokenizer2_wasm_token_ids_count",
    decodedPointer: "trlm_tokenizer2_wasm_decoded_ptr",
    decodedLength: "trlm_tokenizer2_wasm_decoded_len",
    errorPointer: "trlm_tokenizer2_wasm_error_ptr",
    errorLength: "trlm_tokenizer2_wasm_error_len",
    reset: "trlm_tokenizer2_wasm_reset",
    clear: "trlm_tokenizer2_wasm_clear"
  });
  const requiredFunctionExports = Object.freeze(Object.values(names).slice().sort());
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
  const typedArrayByteLength = Object.getOwnPropertyDescriptor(
    typedArrayPrototype, "byteLength"
  ).get;
  const typedArrayLength = Object.getOwnPropertyDescriptor(
    typedArrayPrototype, "length"
  ).get;
  const typedArrayBuffer = Object.getOwnPropertyDescriptor(
    typedArrayPrototype, "buffer"
  ).get;
  const arrayBufferByteLength = Object.getOwnPropertyDescriptor(
    ArrayBuffer.prototype, "byteLength"
  ).get;
  const typedArraySet = Uint8Array.prototype.set;

  class Tokenizer2BoundaryError extends Error {
    constructor(code) {
      super(code);
      this.name = "Tokenizer2BoundaryError";
      this.code = code;
    }
  }

  class Tokenizer2RuntimeError extends Error {
    constructor(code) {
      super(code);
      this.name = "Tokenizer2RuntimeError";
      this.code = code;
    }
  }

  function copyBytes(value, maximum, typeCode, limitCode, allowEmpty = false) {
    let byteLength;
    let elementLength;
    let buffer;
    try {
      byteLength = typedArrayByteLength.call(value);
      elementLength = typedArrayLength.call(value);
      buffer = typedArrayBuffer.call(value);
      arrayBufferByteLength.call(buffer);
    } catch (_error) {
      throw new Tokenizer2BoundaryError(typeCode);
    }
    if (byteLength !== elementLength || (!allowEmpty && byteLength === 0)) {
      throw new Tokenizer2BoundaryError(typeCode);
    }
    if (byteLength > maximum) throw new Tokenizer2BoundaryError(limitCode);
    const copy = new Uint8Array(byteLength);
    typedArraySet.call(copy, value);
    return copy;
  }

  function exactModuleSurface(module) {
    const imports = WebAssembly.Module.imports(module);
    if (imports.length !== 0) {
      throw new Tokenizer2BoundaryError("tokenizer2_wasm_import_surface_invalid");
    }
    const exports = WebAssembly.Module.exports(module);
    const functions = exports
      .filter((entry) => entry.kind === "function")
      .map((entry) => entry.name)
      .sort();
    if (JSON.stringify(functions) !== JSON.stringify(requiredFunctionExports)) {
      throw new Tokenizer2BoundaryError("tokenizer2_wasm_export_surface_invalid");
    }
    const nonFunctions = exports
      .filter((entry) => entry.kind !== "function")
      .map((entry) => `${entry.kind}:${entry.name}`)
      .sort();
    const expected = ["global:__data_end", "global:__heap_base", "memory:memory"];
    if (JSON.stringify(nonFunctions) !== JSON.stringify(expected)) {
      throw new Tokenizer2BoundaryError("tokenizer2_wasm_export_surface_invalid");
    }
  }

  function hex(bytes) {
    let output = "";
    for (const byte of bytes) output += byte.toString(16).padStart(2, "0");
    return output;
  }

  class Tokenizer2Wasm {
    #exports;

    constructor(instance) {
      if (!(instance instanceof WebAssembly.Instance) ||
          !(instance.exports.memory instanceof WebAssembly.Memory)) {
        throw new Tokenizer2BoundaryError("tokenizer2_wasm_instance_invalid");
      }
      this.#exports = instance.exports;
      if ((this.#exports[names.abiVersion]() >>> 0) !== abiVersion ||
          (this.#exports[names.maximumTransferBytes]() >>> 0) !==
            limits.maximumTransferBytes) {
        throw new Tokenizer2BoundaryError("tokenizer2_wasm_profile_mismatch");
      }
      Object.freeze(this);
    }

    load(artifactBytes) {
      const artifact = copyBytes(
        artifactBytes,
        limits.maximumArtifactBytes,
        "tokenizer2_wasm_artifact_type_invalid",
        "tokenizer2_wasm_artifact_limit"
      );
      this.#withInput(artifact, (pointer, length) => {
        this.#requireStatus(this.#exports[names.load](pointer, length) >>> 0);
      });
      const pointer = this.#exports[names.artifactSha256Pointer]() >>> 0;
      if (pointer === 0) {
        throw new Tokenizer2BoundaryError("tokenizer2_wasm_identity_missing");
      }
      return Object.freeze({
        byteLength: this.#exports[names.artifactLength]() >>> 0,
        sha256: hex(new Uint8Array(this.#exports.memory.buffer, pointer, 32)),
        tokenCount: this.#exports[names.tokenCount]() >>> 0,
        baseTokenCount: this.#exports[names.baseTokenCount]() >>> 0
      });
    }

    encode(text) {
      if (typeof text !== "string") {
        throw new Tokenizer2BoundaryError("tokenizer2_wasm_text_type_invalid");
      }
      const input = textEncoder.encode(text);
      if (input.byteLength > limits.maximumInputBytes) {
        throw new Tokenizer2BoundaryError("tokenizer2_wasm_input_limit");
      }
      if (input.byteLength === 0) {
        this.#requireStatus(this.#exports[names.encode](0, 0) >>> 0);
      } else {
        this.#withInput(input, (pointer, length) => {
          this.#requireStatus(this.#exports[names.encode](pointer, length) >>> 0);
        });
      }
      const count = this.#exports[names.tokenIdsCount]() >>> 0;
      if (count > limits.maximumOutputTokens) {
        throw new Tokenizer2BoundaryError("tokenizer2_wasm_output_limit");
      }
      if (count === 0) return new Uint32Array();
      const pointer = this.#exports[names.tokenIdsPointer]() >>> 0;
      if (pointer === 0 || pointer % 4 !== 0) {
        throw new Tokenizer2BoundaryError("tokenizer2_wasm_token_output_invalid");
      }
      return new Uint32Array(
        new Uint32Array(this.#exports.memory.buffer, pointer, count)
      );
    }

    decodeCurrent(mode) {
      if (mode !== "include-all" && mode !== "skip-special") {
        throw new Tokenizer2BoundaryError("tokenizer2_wasm_decode_mode_invalid");
      }
      this.#requireStatus(this.#exports[names.decodeCurrent](
        mode === "include-all" ? decodeModes.includeAll : decodeModes.skipSpecial
      ) >>> 0);
      const length = this.#exports[names.decodedLength]() >>> 0;
      if (length > limits.maximumDecodedBytes) {
        throw new Tokenizer2BoundaryError("tokenizer2_wasm_decode_limit");
      }
      if (length === 0) return "";
      const pointer = this.#exports[names.decodedPointer]() >>> 0;
      if (pointer === 0) {
        throw new Tokenizer2BoundaryError("tokenizer2_wasm_decode_output_invalid");
      }
      try {
        return textDecoder.decode(
          new Uint8Array(this.#exports.memory.buffer, pointer, length)
        );
      } catch (_error) {
        throw new Tokenizer2BoundaryError("tokenizer2_wasm_decode_output_invalid");
      }
    }

    reset() {
      this.#requireBoundaryStatus(this.#exports[names.reset]() >>> 0,
        "tokenizer2_wasm_reset_failed");
    }

    clear() {
      this.#requireBoundaryStatus(this.#exports[names.clear]() >>> 0,
        "tokenizer2_wasm_clear_failed");
    }

    memoryBytes() {
      return this.#exports.memory.buffer.byteLength;
    }

    #withInput(bytes, operation) {
      const pointer = this.#exports[names.allocate](bytes.byteLength) >>> 0;
      if (pointer === 0) {
        throw new Tokenizer2BoundaryError(this.#readError(
          "tokenizer2_wasm_allocation_failed"
        ));
      }
      let output;
      let failure;
      try {
        new Uint8Array(this.#exports.memory.buffer, pointer, bytes.byteLength).set(bytes);
        output = operation(pointer, bytes.byteLength);
      } catch (error) {
        failure = error;
      }
      const release = this.#exports[names.release](pointer, bytes.byteLength) >>> 0;
      if (failure) throw failure;
      if (release !== statusCodes.ok) {
        throw new Tokenizer2BoundaryError("tokenizer2_wasm_release_failed");
      }
      return output;
    }

    #requireBoundaryStatus(status, fallback) {
      if (status !== statusCodes.ok) {
        throw new Tokenizer2BoundaryError(this.#readError(fallback));
      }
    }

    #requireStatus(status) {
      if (status === statusCodes.ok) return;
      const code = this.#readError(
        status === statusCodes.internalError
          ? "tokenizer2_wasm_internal_error"
          : "tokenizer2_wasm_boundary_error"
      );
      if (status === statusCodes.tokenizerError) throw new Tokenizer2RuntimeError(code);
      throw new Tokenizer2BoundaryError(code);
    }

    #readError(fallback) {
      const length = this.#exports[names.errorLength]() >>> 0;
      if (length === 0 || length > 96) return fallback;
      const pointer = this.#exports[names.errorPointer]() >>> 0;
      if (pointer === 0) return fallback;
      try {
        const code = textDecoder.decode(
          new Uint8Array(this.#exports.memory.buffer, pointer, length)
        );
        return /^[a-z][a-z0-9_-]{2,95}$/u.test(code) ? code : fallback;
      } catch (_error) {
        return fallback;
      }
    }
  }

  async function instantiateTokenizer2(moduleBytes) {
    const bytes = copyBytes(
      moduleBytes,
      limits.maximumModuleBytes,
      "tokenizer2_wasm_module_type_invalid",
      "tokenizer2_wasm_module_limit"
    );
    let module;
    try {
      module = await WebAssembly.compile(bytes);
    } catch (_error) {
      throw new Tokenizer2BoundaryError("tokenizer2_wasm_compile_failed");
    }
    exactModuleSurface(module);
    let instance;
    try {
      instance = await WebAssembly.instantiate(module, {});
    } catch (_error) {
      throw new Tokenizer2BoundaryError("tokenizer2_wasm_instantiate_failed");
    }
    return new Tokenizer2Wasm(instance);
  }

  return Object.freeze({
    profileId,
    abiVersion,
    limits,
    decodeModes,
    requiredFunctionExports,
    Tokenizer2BoundaryError,
    Tokenizer2RuntimeError,
    Tokenizer2Wasm,
    instantiateTokenizer2
  });
}));
