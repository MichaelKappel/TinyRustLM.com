(function (root, factory) {
  "use strict";
  const admissionApi = typeof module === "object" && module.exports
    ? require("./browser-model-admission.js")
    : root.TinyRustLMBrowserModelAdmission;
  const catalogApi = typeof module === "object" && module.exports
    ? require("./minimodel-catalog-v1.js")
    : root.TinyRustLMMiniModelCatalogV1;
  const api = factory(root, admissionApi, catalogApi);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.TinyRustLMModelCompositionStore = api;
  }
}(typeof globalThis === "object" ? globalThis : this,
function (root, admissionApi, catalogApi) {
  "use strict";

  const MANIFEST_SCHEMA = "tinyrustlm.model-composition-store.manifest/2";
  const POINTER_SCHEMA = "tinyrustlm.model-composition-store.active-pointer/2";
  const STAGING_SCHEMA = "tinyrustlm.model-composition-store.staging/2";
  const OPFS_ROOT_NAME = "tinyrustlm-model-compositions-v2";
  const LOCK_NAME = "tinyrustlm-model-compositions-v2-writer";
  const INSTALLED_DIRECTORY = "installed";
  const STAGING_DIRECTORY = "staging";
  const ACTIVE_POINTER_FILE = "active.json";
  const INSTALLED_MANIFEST_FILE = "manifest.json";
  const INSTALLED_ADMISSION_FILE = "admission.json";
  const INSTALLED_QUALIFICATION_RECEIPT_FILE = "qualification-receipt.json";
  const INSTALLED_CATALOG_FILE = "catalog.json";
  const ADMISSION_SCHEMA = "tinyrustlm.browser-composition-admission/1";
  const QUALIFICATION_RECEIPT_SCHEMA = "tinyrustlm.qualification-receipt/1";
  const CATALOG_SCHEMA = "minimodel.slm2_catalog.v1";
  const MAXIMUM_CHUNK_BYTES = 4 * 1024 * 1024;
  const DEFAULT_CHUNK_BYTES = MAXIMUM_CHUNK_BYTES;
  const MAXIMUM_METADATA_BYTES = 64 * 1024;
  const MAXIMUM_QUALIFICATION_RECEIPT_BYTES = 128 * 1024;
  const MAXIMUM_CATALOG_BYTES = 1024 * 1024;
  const MAXIMUM_CUSTODY_BYTES = MAXIMUM_CATALOG_BYTES;
  const DEFAULT_MAXIMUM_COMPOSITION_BYTES = 0x88000000;
  const DEFAULT_MAXIMUM_STAGING_ENTRIES = 16;
  const DEFAULT_CLEANUP_LIMIT = 16;
  const MAXIMUM_ENTRY_LIMIT = 64;
  // Up to 64 staged candidates, 64 retired entries and one active entry, plus a sentinel.
  const INSTALLED_SCAN_LIMIT = MAXIMUM_ENTRY_LIMIT * 2 + 2;
  const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
  const MEMBER_NAMES = Object.freeze([
    "model.slm2",
    "tokenizer.tokenizer2",
    "template.template2",
    "sampling.sampling2",
    "prompt.prompt2",
    "composition.acg2"
  ]);
  const INSTALLED_FILES = Object.freeze([
    ...MEMBER_NAMES, INSTALLED_ADMISSION_FILE, INSTALLED_QUALIFICATION_RECEIPT_FILE,
    INSTALLED_CATALOG_FILE, INSTALLED_MANIFEST_FILE
  ]);
  const CONTENT_ID_PATTERN = /^sha256:[0-9a-f]{64}$/u;
  const DESCRIPTOR_FIELDS = Object.freeze(["byteLength", "sha256"]);
  const ADMISSION_AUTHORITY_FIELDS = Object.freeze([
    "admission",
    "qualificationReceipt",
    "catalog",
    "p2pPieceSetSha256"
  ]);
  const ADMISSION_AUTHORITY_INPUT_FIELDS = Object.freeze([
    "admissionText",
    "qualificationReceiptText",
    "catalogText",
    "catalogAuthority",
    "p2pPieceSetSha256"
  ]);
  const CATALOG_AUTHORITY_FIELDS = Object.freeze([
    "id", "revision", "generatedAtUtc", "validUntilUtc", "sha256"
  ]);
  const QUALIFICATION_RECEIPT_FIELDS = Object.freeze([
    "schema",
    "receiptId",
    "modelId",
    "operationId",
    "compositionId",
    "sourceEvidenceSha256",
    "structuralEvidenceSha256",
    "numericalEvidenceSha256",
    "qualityEvidenceSha256",
    "evalCasesSha256",
    "qualityClaim",
    "qualityScope",
    "numericalStatus",
    "browserStatus",
    "qualityStatus",
    "issuedAtUtc"
  ]);
  const MEMBER_FIELDS = Object.freeze(["fileName", "byteLength", "sha256"]);
  const MANIFEST_FIELDS = Object.freeze(["schema", "admissionAuthority", "members"]);
  const POINTER_FIELDS = Object.freeze([
    "schema", "stagingId", "manifestSha256", "admissionAuthoritySha256"
  ]);
  const STAGING_FIELDS = Object.freeze(["schema", "stagingId", "manifestSha256"]);
  const RECOVERABLE_ACTIVE_CODES = new Set([
    "model-composition-store-activation-indeterminate",
    "model-composition-store-active-pointer",
    "model-composition-store-installed-manifest",
    "model-composition-store-manifest",
    "model-composition-store-member-name",
    "model-composition-store-composition-size",
    "model-composition-store-stored-admission",
    "model-composition-store-stored-qualification-receipt",
    "model-composition-store-stored-catalog",
    "model-composition-store-stored-length",
    "model-composition-store-stored-sha256"
  ]);
  const RECOVERABLE_CONTENT_CODES = new Set([
    "model-composition-store-activation-indeterminate",
    "model-composition-store-installed-manifest",
    "model-composition-store-manifest",
    "model-composition-store-member-name",
    "model-composition-store-composition-size",
    "model-composition-store-stored-admission",
    "model-composition-store-stored-qualification-receipt",
    "model-composition-store-stored-catalog",
    "model-composition-store-stored-length",
    "model-composition-store-stored-sha256"
  ]);
  const REQUIRED_ADAPTER_METHODS = Object.freeze([
    "withExclusiveLock",
    "withCompositionLock",
    "createSha256",
    "randomBytes",
    "ensureDirectory",
    "listEntries",
    "removeEntry",
    "openReadable",
    "openWritable",
    "atomicWrite"
  ]);

  class ModelCompositionStoreError extends Error {
    constructor(code, details) {
      super(code);
      this.name = "ModelCompositionStoreError";
      this.code = code;
      if (details && details.memberName) this.memberName = details.memberName;
      if (details && details.stagingId) this.stagingId = details.stagingId;
      if (details && details.activationId) this.activationId = details.activationId;
      if (details && details.commitDisposition) {
        this.commitDisposition = details.commitDisposition;
      }
      if (details && details.cause !== undefined) this.cause = details.cause;
    }
  }

  function reject(code, details) {
    throw new ModelCompositionStoreError(code, details);
  }

  function typed(error, code, details) {
    if (error instanceof ModelCompositionStoreError) return error;
    return new ModelCompositionStoreError(code, { ...details, cause: error });
  }

  function isPlainObject(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function exactObject(value, fields, code) {
    if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length !== 0) reject(code);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Object.keys(descriptors);
    if (keys.length !== fields.length ||
        fields.some((field) => !Object.hasOwn(descriptors, field)) ||
        keys.some((field) => !fields.includes(field))) {
      reject(code);
    }
    for (const field of fields) {
      const descriptor = descriptors[field];
      if (!Object.hasOwn(descriptor, "value") || descriptor.get || descriptor.set) reject(code);
    }
    return value;
  }

  function safeInteger(value, minimum, maximum, code) {
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) reject(code);
    return value;
  }

  function sha256(value, code) {
    if (typeof value !== "string" || !SHA256_PATTERN.test(value) || /^0{64}$/u.test(value)) {
      reject(code);
    }
    return value;
  }

  function contentId(value, code) {
    if (typeof value !== "string" || !CONTENT_ID_PATTERN.test(value) ||
        /^sha256:0{64}$/u.test(value)) {
      reject(code);
    }
    return value;
  }

  function utcSecond(value, code) {
    if (typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(value)) {
      reject(code);
    }
    const milliseconds = Date.parse(value);
    if (!Number.isFinite(milliseconds) ||
        new Date(milliseconds).toISOString().replace(".000Z", "Z") !== value) {
      reject(code);
    }
    return value;
  }

  function normalizeDescriptor(value, maximumBytes) {
    exactObject(value, DESCRIPTOR_FIELDS, "model-composition-store-manifest");
    return Object.freeze({
      byteLength: safeInteger(
        value.byteLength,
        1,
        maximumBytes,
        "model-composition-store-manifest"
      ),
      sha256: sha256(value.sha256, "model-composition-store-manifest")
    });
  }

  function normalizeAdmissionAuthorityDescriptor(value) {
    exactObject(
      value,
      ADMISSION_AUTHORITY_FIELDS,
      "model-composition-store-manifest"
    );
    return Object.freeze({
      admission: normalizeDescriptor(value.admission, MAXIMUM_METADATA_BYTES),
      qualificationReceipt: normalizeDescriptor(
        value.qualificationReceipt,
        MAXIMUM_QUALIFICATION_RECEIPT_BYTES
      ),
      catalog: normalizeDescriptor(value.catalog, MAXIMUM_CATALOG_BYTES),
      p2pPieceSetSha256: value.p2pPieceSetSha256 === null
        ? null
        : contentId(value.p2pPieceSetSha256, "model-composition-store-manifest")
    });
  }

  function normalizeManifest(value, maximumCompositionBytes) {
    exactObject(value, MANIFEST_FIELDS, "model-composition-store-manifest");
    if (value.schema !== MANIFEST_SCHEMA ||
        !Array.isArray(value.members) || value.members.length !== MEMBER_NAMES.length) {
      reject("model-composition-store-manifest");
    }
    let totalBytes = 0;
    const members = value.members.map((member, index) => {
      exactObject(member, MEMBER_FIELDS, "model-composition-store-manifest");
      if (member.fileName !== MEMBER_NAMES[index]) {
        reject("model-composition-store-member-name", { memberName: member.fileName });
      }
      const byteLength = safeInteger(
        member.byteLength,
        1,
        maximumCompositionBytes,
        "model-composition-store-manifest"
      );
      totalBytes += byteLength;
      if (!Number.isSafeInteger(totalBytes) || totalBytes > maximumCompositionBytes) {
        reject("model-composition-store-composition-size");
      }
      return Object.freeze({
        fileName: MEMBER_NAMES[index],
        byteLength,
        sha256: sha256(member.sha256, "model-composition-store-manifest")
      });
    });
    return Object.freeze({
      schema: MANIFEST_SCHEMA,
      admissionAuthority: normalizeAdmissionAuthorityDescriptor(
        value.admissionAuthority
      ),
      members: Object.freeze(members)
    });
  }

  function normalizePointer(value) {
    exactObject(value, POINTER_FIELDS, "model-composition-store-active-pointer");
    if (value.schema !== POINTER_SCHEMA) reject("model-composition-store-active-pointer");
    return Object.freeze({
      schema: POINTER_SCHEMA,
      stagingId: sha256(value.stagingId, "model-composition-store-active-pointer"),
      manifestSha256: sha256(
        value.manifestSha256,
        "model-composition-store-active-pointer"
      ),
      admissionAuthoritySha256: sha256(
        value.admissionAuthoritySha256,
        "model-composition-store-active-pointer"
      )
    });
  }

  function normalizeStaging(value) {
    exactObject(value, STAGING_FIELDS, "model-composition-store-staging");
    if (value.schema !== STAGING_SCHEMA) reject("model-composition-store-staging");
    return Object.freeze({
      schema: STAGING_SCHEMA,
      stagingId: sha256(value.stagingId, "model-composition-store-staging"),
      manifestSha256: sha256(value.manifestSha256, "model-composition-store-staging")
    });
  }

  function encoder() {
    if (!root || typeof root.TextEncoder !== "function") {
      reject("model-composition-store-text-codec");
    }
    return new root.TextEncoder();
  }

  function decoder() {
    if (!root || typeof root.TextDecoder !== "function") {
      reject("model-composition-store-text-codec");
    }
    return new root.TextDecoder("utf-8", { fatal: true });
  }

  function canonicalBytes(value) {
    const bytes = encoder().encode(`${JSON.stringify(value)}\n`);
    if (bytes.byteLength < 1 || bytes.byteLength > MAXIMUM_METADATA_BYTES) {
      reject("model-composition-store-metadata-size");
    }
    return bytes;
  }

  function bytesEqual(left, right) {
    if (left.byteLength !== right.byteLength) return false;
    for (let index = 0; index < left.byteLength; index += 1) {
      if (left[index] !== right[index]) return false;
    }
    return true;
  }

  function bytesToHex(bytes) {
    let value = "";
    for (const byte of bytes) value += byte.toString(16).padStart(2, "0");
    return value;
  }

  function digestHex(value, code) {
    if (typeof value === "string") {
      if (!SHA256_PATTERN.test(value)) reject(code);
      return value;
    }
    let bytes;
    if (value instanceof ArrayBuffer) {
      bytes = new Uint8Array(value);
    } else if (value instanceof Uint8Array) {
      bytes = value;
    } else {
      reject(code);
    }
    if (bytes.byteLength !== 32) reject(code);
    return bytesToHex(bytes);
  }

  function createHasher(adapter) {
    let hasher;
    try {
      hasher = adapter.createSha256();
    } catch (error) {
      throw typed(error, "model-composition-store-sha256");
    }
    if (!hasher || typeof hasher.update !== "function" || typeof hasher.digest !== "function") {
      reject("model-composition-store-sha256");
    }
    return hasher;
  }

  async function updateHasher(hasher, bytes) {
    try {
      await hasher.update(bytes);
    } catch (error) {
      throw typed(error, "model-composition-store-sha256");
    }
  }

  async function finishHasher(hasher) {
    try {
      return digestHex(await hasher.digest(), "model-composition-store-sha256");
    } catch (error) {
      throw typed(error, "model-composition-store-sha256");
    }
  }

  // Hash bounded metadata without retaining a read operation after caller cancellation.
  async function hashBytes(adapter, bytes, signal) {
    checkCancelled(signal);
    const hasher = createHasher(adapter);
    await nextWithCancellation(updateHasher(hasher, bytes), signal);
    checkCancelled(signal);
    return nextWithCancellation(finishHasher(hasher), signal);
  }

  function normalizeSignal(value) {
    if (value === undefined || value === null) return null;
    if (typeof value !== "object" || typeof value.aborted !== "boolean" ||
        typeof value.addEventListener !== "function" ||
        typeof value.removeEventListener !== "function") {
      reject("model-composition-store-signal");
    }
    return value;
  }

  function checkCancelled(signal, stagingId) {
    if (signal && signal.aborted) {
      reject("model-composition-store-aborted", { stagingId });
    }
  }

  // Observe late settlements even when the operation synchronously aborts before returning its promise.
  function nextWithCancellation(promise, signal, stagingId) {
    const pending = Promise.resolve(promise);
    if (!signal) return pending;
    if (signal.aborted) {
      pending.catch(() => {});
      checkCancelled(signal, stagingId);
    }
    return new Promise((resolve, rejectPromise) => {
      const onAbort = () => {
        signal.removeEventListener("abort", onAbort);
        rejectPromise(new ModelCompositionStoreError(
          "model-composition-store-aborted",
          { stagingId }
        ));
      };
      signal.addEventListener("abort", onAbort, { once: true });
      pending.then(
        (value) => {
          signal.removeEventListener("abort", onAbort);
          resolve(value);
        },
        (error) => {
          signal.removeEventListener("abort", onAbort);
          rejectPromise(error);
        }
      );
    });
  }

  function sourceIterator(source, code) {
    let stream = source;
    if (stream && typeof stream.stream === "function") {
      try {
        stream = stream.stream();
      } catch (error) {
        throw typed(error, code);
      }
    }
    if (stream && typeof stream[Symbol.asyncIterator] === "function") {
      return { iterator: stream[Symbol.asyncIterator](), reader: null };
    }
    if (stream && typeof stream.getReader === "function") {
      let reader;
      try {
        reader = stream.getReader();
      } catch (error) {
        throw typed(error, code);
      }
      return {
        reader,
        iterator: {
          next() {
            return reader.read();
          },
          return() {
            return reader.cancel();
          }
        }
      };
    }
    reject(code);
  }

  // Bound each chunk and keep cancellation live while an interrupted source closes.
  async function* boundedChunks(source, chunkBytes, signal, stagingId, code) {
    const state = sourceIterator(source, code);
    let complete = false;
    try {
      while (true) {
        checkCancelled(signal, stagingId);
        let step;
        try {
          step = await nextWithCancellation(state.iterator.next(), signal, stagingId);
        } catch (error) {
          throw typed(error, code, { stagingId });
        }
        if (!step || typeof step !== "object") reject(code, { stagingId });
        if (step.done) {
          complete = true;
          return;
        }
        const value = step.value;
        if (!(value instanceof Uint8Array) || value.byteLength === 0) {
          reject(code, { stagingId });
        }
        for (let offset = 0; offset < value.byteLength; offset += chunkBytes) {
          checkCancelled(signal, stagingId);
          yield value.subarray(offset, Math.min(value.byteLength, offset + chunkBytes));
        }
      }
    } finally {
      if (!complete && state.iterator && typeof state.iterator.return === "function") {
        try {
          const returned = state.iterator.return();
          if (signal && signal.aborted) {
            Promise.resolve(returned).catch(() => {});
          } else {
            await nextWithCancellation(returned, signal, stagingId);
          }
        } catch (_) {
          // The primary typed failure remains authoritative.
        }
      }
      if (state.reader && typeof state.reader.releaseLock === "function") {
        try {
          state.reader.releaseLock();
        } catch (_) {
          // The reader is already released or cancelled.
        }
      }
    }
  }

  async function hashStream(options) {
    const hasher = createHasher(options.adapter);
    let byteLength = 0;
    for await (const chunk of boundedChunks(
      options.source,
      options.chunkBytes,
      options.signal,
      options.stagingId,
      options.readCode
    )) {
      if (byteLength + chunk.byteLength > options.expected.byteLength) {
        reject(options.lengthCode, {
          memberName: options.expected.fileName,
          stagingId: options.stagingId
        });
      }
      await updateHasher(hasher, chunk);
      if (options.onChunk) await options.onChunk(chunk);
      byteLength += chunk.byteLength;
    }
    if (byteLength !== options.expected.byteLength) {
      reject(options.lengthCode, {
        memberName: options.expected.fileName,
        stagingId: options.stagingId
      });
    }
    if (await finishHasher(hasher) !== options.expected.sha256) {
      reject(options.hashCode, {
        memberName: options.expected.fileName,
        stagingId: options.stagingId
      });
    }
  }

  function validateWriter(writer, stagingId, memberName) {
    if (!writer || typeof writer.write !== "function" ||
        typeof writer.close !== "function" || typeof writer.abort !== "function") {
      reject("model-composition-store-adapter", { stagingId, memberName });
    }
    return writer;
  }

  async function openWriter(adapter, path, stagingId, memberName) {
    try {
      return validateWriter(await adapter.openWritable(path), stagingId, memberName);
    } catch (error) {
      throw typed(error, "model-composition-store-write", { stagingId, memberName });
    }
  }

  async function runWriterOperation(operation, context, memberName) {
    let pending = null;
    try {
      checkCancelled(context.signal, context.stagingId);
      pending = Promise.resolve(operation());
      await nextWithCancellation(
        pending,
        context.signal,
        context.stagingId
      );
      checkCancelled(context.signal, context.stagingId);
    } catch (error) {
      if (pending) pending.catch(() => {});
      throw typed(error, "model-composition-store-write", {
        stagingId: context.stagingId,
        memberName
      });
    }
  }

  async function bestEffortAbortWriter(writer, signal, stagingId) {
    let aborting = null;
    try {
      aborting = Promise.resolve(writer.abort());
      await nextWithCancellation(aborting, signal, stagingId);
    } catch (_) {
      if (aborting) aborting.catch(() => {});
      // Candidate directory cleanup handles an uncommitted writer failure.
    }
  }

  async function writeMember(context, member, source) {
    const path = [INSTALLED_DIRECTORY, context.manifestSha256, member.fileName];
    const writer = await openWriter(
      context.adapter,
      path,
      context.stagingId,
      member.fileName
    );
    try {
      await hashStream({
        adapter: context.adapter,
        source,
        chunkBytes: context.chunkBytes,
        signal: context.signal,
        stagingId: context.stagingId,
        expected: member,
        readCode: "model-composition-store-source-read",
        lengthCode: "model-composition-store-source-length",
        hashCode: "model-composition-store-source-sha256",
        onChunk: (chunk) => runWriterOperation(
          () => writer.write(chunk),
          context,
          member.fileName
        )
      });
      await runWriterOperation(
        () => writer.close(),
        context,
        member.fileName
      );
    } catch (error) {
      await bestEffortAbortWriter(writer, context.signal, context.stagingId);
      throw error;
    }
  }

  // Read acquisition has no durable mutation; a cancelled caller may safely stop waiting.
  async function openReadable(adapter, path, code, details, signal) {
    checkCancelled(signal, details && details.stagingId);
    try {
      const readable = await nextWithCancellation(adapter.openReadable(path), signal,
        details && details.stagingId);
      if (readable === null) return null;
      if (!readable || !Number.isSafeInteger(readable.byteLength) ||
          readable.byteLength < 0 || readable.stream === undefined) {
        reject("model-composition-store-adapter", details);
      }
      return readable;
    } catch (error) {
      throw typed(error, code, details);
    }
  }

  async function verifyMember(context, member) {
    const details = { stagingId: context.stagingId, memberName: member.fileName };
    const readable = await openReadable(
      context.adapter,
      [INSTALLED_DIRECTORY, context.manifestSha256, member.fileName],
      "model-composition-store-read",
      details,
      context.signal
    );
    if (!readable || readable.byteLength !== member.byteLength) {
      reject("model-composition-store-stored-length", details);
    }
    await hashStream({
      adapter: context.adapter,
      source: readable.stream,
      chunkBytes: context.chunkBytes,
      signal: context.signal,
      stagingId: context.stagingId,
      expected: member,
      readCode: "model-composition-store-read",
      lengthCode: "model-composition-store-stored-length",
      hashCode: "model-composition-store-stored-sha256"
    });
  }

  // Keep one caller signal through file acquisition, bounded streaming and iterator disposal.
  async function readSmallFile(adapter, path, maximumBytes, code, signal) {
    const readable = await openReadable(adapter, path, code, undefined, signal);
    if (readable === null) return null;
    if (readable.byteLength < 1 || readable.byteLength > maximumBytes) reject(code);
    const bytes = new Uint8Array(readable.byteLength);
    let offset = 0;
    for await (const chunk of boundedChunks(
      readable.stream,
      Math.min(DEFAULT_CHUNK_BYTES, maximumBytes),
      signal,
      null,
      code
    )) {
      if (offset + chunk.byteLength > bytes.byteLength) reject(code);
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    if (offset !== bytes.byteLength) reject(code);
    return bytes;
  }

  function parseCanonical(bytes, normalizer, code) {
    let parsed;
    try {
      parsed = JSON.parse(decoder().decode(bytes));
    } catch (error) {
      throw typed(error, code);
    }
    let normalized;
    try {
      normalized = normalizer(parsed);
    } catch (error) {
      throw typed(error, code);
    }
    if (!bytesEqual(bytes, canonicalBytes(normalized))) reject(code);
    return normalized;
  }

  async function atomicWrite(adapter, path, bytes, code, details) {
    try {
      await adapter.atomicWrite(path, bytes);
    } catch (error) {
      throw typed(error, code, details);
    }
  }

  async function ensureDirectory(adapter, path) {
    try {
      await adapter.ensureDirectory(path);
    } catch (error) {
      throw typed(error, "model-composition-store-storage", { cause: error });
    }
  }

  async function removeEntry(adapter, path, recursive) {
    try {
      await adapter.removeEntry(path, { recursive, missingOk: true });
    } catch (error) {
      throw typed(error, "model-composition-store-cleanup", { cause: error });
    }
  }

  async function bestEffortRemove(adapter, path, recursive) {
    try {
      await adapter.removeEntry(path, { recursive, missingOk: true });
    } catch (_) {
      // A later bounded cleanup pass owns post-commit or error-path residue.
    }
  }

  // Enumeration is read-only; mutation callers still wait for each actual write/removal to settle.
  async function listEntries(adapter, path, limit, signal) {
    checkCancelled(signal);
    let entries;
    try {
      entries = await nextWithCancellation(adapter.listEntries(path, limit), signal);
    } catch (error) {
      throw typed(error, "model-composition-store-cleanup", { cause: error });
    }
    if (!Array.isArray(entries) || entries.length > limit) {
      reject("model-composition-store-adapter");
    }
    const names = new Set();
    for (const entry of entries) {
      if (!entry || typeof entry.name !== "string" ||
          (entry.kind !== "file" && entry.kind !== "directory") ||
          names.has(entry.name)) {
        reject("model-composition-store-adapter");
      }
      validatePath([entry.name]);
      names.add(entry.name);
    }
    return entries;
  }

  async function withExclusiveLock(adapter, callback, signal) {
    checkCancelled(signal);
    try {
      return await adapter.withExclusiveLock(callback, signal || undefined);
    } catch (error) {
      if (error instanceof ModelCompositionStoreError) throw error;
      if (signal && signal.aborted) {
        reject("model-composition-store-aborted");
      }
      throw typed(error, "model-composition-store-lock");
    }
  }

  function normalizeSources(value) {
    exactObject(value, MEMBER_NAMES, "model-composition-store-sources");
    return value;
  }

  function normalizeStoreOptions(value) {
    const source = value && REQUIRED_ADAPTER_METHODS.every(
      (name) => typeof value[name] === "function"
    ) ? { adapter: value } : value;
    if (!isPlainObject(source) || !source.adapter) reject("model-composition-store-options");
    const allowed = new Set([
      "adapter",
      "chunkBytes",
      "maximumCompositionBytes",
      "maximumStagingEntries",
      "cleanupLimit"
    ]);
    if (Object.keys(source).some((key) => !allowed.has(key))) {
      reject("model-composition-store-options");
    }
    for (const name of REQUIRED_ADAPTER_METHODS) {
      if (typeof source.adapter[name] !== "function") reject("model-composition-store-adapter");
    }
    return Object.freeze({
      adapter: source.adapter,
      chunkBytes: safeInteger(
        source.chunkBytes === undefined ? DEFAULT_CHUNK_BYTES : source.chunkBytes,
        1,
        MAXIMUM_CHUNK_BYTES,
        "model-composition-store-options"
      ),
      maximumCompositionBytes: safeInteger(
        source.maximumCompositionBytes === undefined
          ? DEFAULT_MAXIMUM_COMPOSITION_BYTES
          : source.maximumCompositionBytes,
        1,
        Number.MAX_SAFE_INTEGER,
        "model-composition-store-options"
      ),
      maximumStagingEntries: safeInteger(
        source.maximumStagingEntries === undefined
          ? DEFAULT_MAXIMUM_STAGING_ENTRIES
          : source.maximumStagingEntries,
        1,
        MAXIMUM_ENTRY_LIMIT,
        "model-composition-store-options"
      ),
      cleanupLimit: safeInteger(
        source.cleanupLimit === undefined ? DEFAULT_CLEANUP_LIMIT : source.cleanupLimit,
        1,
        MAXIMUM_ENTRY_LIMIT,
        "model-composition-store-options"
      )
    });
  }

  function normalizeCall(value, requiredFields, allowedFields, code) {
    const source = value === undefined ? {} : value;
    if (!isPlainObject(source) || Object.getOwnPropertySymbols(source).length !== 0) reject(code);
    const keys = Object.keys(source);
    if (requiredFields.some((field) => !Object.hasOwn(source, field)) ||
        keys.some((field) => !allowedFields.includes(field))) {
      reject(code);
    }
    return source;
  }

  // Omit signal only for authoritative reconciliation after a pointer write has begun.
  async function readPointer(adapter, signal) {
    const bytes = await readSmallFile(
      adapter,
      [ACTIVE_POINTER_FILE],
      MAXIMUM_METADATA_BYTES,
      "model-composition-store-active-pointer",
      signal
    );
    return bytes === null
      ? null
      : parseCanonical(bytes, normalizePointer, "model-composition-store-active-pointer");
  }

  function samePointer(left, right) {
    return Boolean(left) && POINTER_FIELDS.every((field) => left[field] === right[field]);
  }

  async function observePointerCommit(adapter, expected) {
    try {
      return samePointer(await readPointer(adapter), expected);
    } catch (_) {
      return null;
    }
  }

  function activationIndeterminate(pointer, cause) {
    return new ModelCompositionStoreError(
      "model-composition-store-activation-indeterminate",
      {
        stagingId: pointer.stagingId,
        activationId: pointer.stagingId,
        commitDisposition: "indeterminate",
        cause
      }
    );
  }

  function withCommitDisposition(error, disposition, activationId) {
    const result = typed(
      error,
      "model-composition-store-install",
      { stagingId: activationId }
    );
    if (!result.stagingId) result.stagingId = activationId;
    if (!result.activationId) result.activationId = activationId;
    if (!result.commitDisposition) result.commitDisposition = disposition;
    return result;
  }

  // Read canonical staging authority with the operation's precommit cancellation lifetime.
  async function readStaging(adapter, name, signal) {
    const bytes = await readSmallFile(
      adapter,
      [STAGING_DIRECTORY, name],
      MAXIMUM_METADATA_BYTES,
      "model-composition-store-staging",
      signal
    );
    return bytes === null
      ? null
      : parseCanonical(bytes, normalizeStaging, "model-composition-store-staging");
  }

  // Cancellation is not corruption or an indeterminate commit; postcommit callers omit the signal.
  async function requireResolvedPointer(adapter, pointer, signal) {
    if (pointer === null) return;
    let marker;
    try {
      marker = await readStaging(adapter, `${pointer.stagingId}.json`, signal);
    } catch (error) {
      checkCancelled(signal, pointer.stagingId);
      throw activationIndeterminate(pointer, error);
    }
    if (marker !== null) {
      throw activationIndeterminate(pointer);
    }
  }

  // Bind and parse stored metadata only while its calling read/validation operation remains live.
  async function readInstalledManifest(options, manifestSha256, signal) {
    const bytes = await readSmallFile(
      options.adapter,
      [INSTALLED_DIRECTORY, manifestSha256, INSTALLED_MANIFEST_FILE],
      MAXIMUM_METADATA_BYTES,
      "model-composition-store-installed-manifest",
      signal
    );
    if (bytes === null) return null;
    if (await hashBytes(options.adapter, bytes, signal) !== manifestSha256) {
      reject("model-composition-store-installed-manifest");
    }
    return parseCanonical(
      bytes,
      (value) => normalizeManifest(value, options.maximumCompositionBytes),
      "model-composition-store-installed-manifest"
    );
  }

  function admissionByteLimit() {
    if (!admissionApi || admissionApi.schema !== ADMISSION_SCHEMA ||
        typeof admissionApi.parseAdmissionText !== "function" ||
        !Number.isSafeInteger(admissionApi.maximumTextBytes) ||
        admissionApi.maximumTextBytes < 1 ||
        admissionApi.maximumTextBytes > MAXIMUM_METADATA_BYTES) {
      reject("model-composition-store-admission-authority");
    }
    return admissionApi.maximumTextBytes;
  }

  function catalogByteLimit() {
    if (!catalogApi || catalogApi.CATALOG_SCHEMA !== CATALOG_SCHEMA ||
        catalogApi.BROWSER_ADMISSION_SCHEMA !== ADMISSION_SCHEMA ||
        catalogApi.QUALIFICATION_RECEIPT_SCHEMA !== QUALIFICATION_RECEIPT_SCHEMA ||
        typeof catalogApi.parseCanonicalJsonText !== "function" ||
        typeof catalogApi.validateCatalog !== "function" ||
        !Number.isSafeInteger(catalogApi.MAXIMUM_METADATA_BYTES) ||
        catalogApi.MAXIMUM_METADATA_BYTES < 1 ||
        catalogApi.MAXIMUM_METADATA_BYTES > MAXIMUM_CATALOG_BYTES ||
        catalogApi.MAXIMUM_QUALIFICATION_RECEIPT_BYTES !==
          MAXIMUM_QUALIFICATION_RECEIPT_BYTES) {
      reject("model-composition-store-catalog-authority");
    }
    return catalogApi.MAXIMUM_METADATA_BYTES;
  }

  function bindAdmissionToManifest(admission, manifest, code) {
    if (!admission || !Array.isArray(admission.artifacts) ||
        admission.artifacts.length !== MEMBER_NAMES.length) {
      reject(code);
    }
    for (let index = 0; index < MEMBER_NAMES.length; index += 1) {
      const artifact = admission.artifacts[index];
      const member = manifest.members[index];
      if (!artifact || artifact.fileName !== member.fileName ||
          artifact.byteCount !== member.byteLength ||
          artifact.sha256 !== member.sha256) {
        reject(code, { memberName: member.fileName });
      }
    }
  }

  function parseAdmissionText(value, manifest, code) {
    let admission;
    try {
      admission = admissionApi.parseAdmissionText(value);
    } catch (error) {
      throw typed(error, code);
    }
    bindAdmissionToManifest(admission, manifest, code);
    return admission;
  }

  async function prepareTextBytes(adapter, value, descriptor, maximumBytes, code) {
    if (typeof value !== "string" || value.length === 0 ||
        value.length > maximumBytes || value.length > descriptor.byteLength) {
      reject(code);
    }
    const bytes = encoder().encode(value);
    if (bytes.byteLength < 1 || bytes.byteLength > maximumBytes ||
        bytes.byteLength !== descriptor.byteLength) {
      reject(code);
    }
    if (await hashBytes(adapter, bytes) !== descriptor.sha256) {
      reject(code);
    }
    return Uint8Array.from(bytes);
  }

  async function prepareAdmission(adapter, value, manifest) {
    const code = "model-composition-store-admission";
    const bytes = await prepareTextBytes(
      adapter,
      value,
      manifest.admissionAuthority.admission,
      admissionByteLimit(),
      code
    );
    const admission = parseAdmissionText(value, manifest, code);
    return Object.freeze({ text: value, bytes, admission });
  }

  function normalizeQualificationReceipt(value, admission, code) {
    exactObject(value, QUALIFICATION_RECEIPT_FIELDS, code);
    const qualification = admission.qualification;
    if (value.schema !== QUALIFICATION_RECEIPT_SCHEMA ||
        value.receiptId !== qualification.receiptId ||
        value.modelId !== admission.modelId ||
        value.operationId !== admission.operationId ||
        value.compositionId !== `sha256:${admission.composition.graphIdentitySha256}` ||
        value.sourceEvidenceSha256 !== qualification.sourceEvidenceSha256 ||
        value.structuralEvidenceSha256 !== qualification.structuralEvidenceSha256 ||
        value.numericalEvidenceSha256 !== qualification.numericalEvidenceSha256 ||
        value.qualityEvidenceSha256 !== qualification.qualityEvidenceSha256 ||
        value.evalCasesSha256 !== qualification.evalCasesSha256 ||
        value.qualityClaim !== qualification.qualityClaim ||
        value.qualityScope !== qualification.qualityScope ||
        value.numericalStatus !== "passed" || value.browserStatus !== "passed" ||
        value.qualityStatus !== "qualified") {
      reject(code);
    }
    contentId(value.receiptId, code);
    sha256(value.operationId, code);
    contentId(value.compositionId, code);
    for (const field of [
      "sourceEvidenceSha256",
      "structuralEvidenceSha256",
      "numericalEvidenceSha256",
      "qualityEvidenceSha256",
      "evalCasesSha256"
    ]) {
      sha256(value[field], code);
    }
    const issuedAtUtc = utcSecond(value.issuedAtUtc, code);
    return Object.freeze({
      schema: QUALIFICATION_RECEIPT_SCHEMA,
      receiptId: value.receiptId,
      modelId: value.modelId,
      operationId: value.operationId,
      compositionId: value.compositionId,
      sourceEvidenceSha256: value.sourceEvidenceSha256,
      structuralEvidenceSha256: value.structuralEvidenceSha256,
      numericalEvidenceSha256: value.numericalEvidenceSha256,
      qualityEvidenceSha256: value.qualityEvidenceSha256,
      evalCasesSha256: value.evalCasesSha256,
      qualityClaim: value.qualityClaim,
      qualityScope: value.qualityScope,
      numericalStatus: "passed",
      browserStatus: "passed",
      qualityStatus: "qualified",
      issuedAtUtc
    });
  }

  function parseQualificationReceiptText(value, admission, code) {
    let parsed;
    try {
      parsed = catalogApi.parseCanonicalJsonText(
        value,
        MAXIMUM_QUALIFICATION_RECEIPT_BYTES
      );
    } catch (error) {
      throw typed(error, code);
    }
    const receipt = normalizeQualificationReceipt(parsed, admission, code);
    if (value !== `${JSON.stringify(receipt)}\n`) reject(code);
    return receipt;
  }

  async function prepareQualificationReceipt(adapter, value, manifest, admission) {
    const code = "model-composition-store-qualification-receipt";
    catalogByteLimit();
    const bytes = await prepareTextBytes(
      adapter,
      value,
      manifest.admissionAuthority.qualificationReceipt,
      MAXIMUM_QUALIFICATION_RECEIPT_BYTES,
      code
    );
    const receipt = parseQualificationReceiptText(value, admission, code);
    return Object.freeze({ text: value, bytes, receipt });
  }

  function parseCatalogText(value, code, requireCurrent) {
    let parsed;
    let catalog;
    try {
      parsed = catalogApi.parseCanonicalJsonText(value, catalogByteLimit());
      const generatedAtUtc = utcSecond(parsed && parsed.generated_at_utc, code);
      catalog = catalogApi.validateCatalog(
        parsed,
        requireCurrent ? {} : { now: new Date(generatedAtUtc) }
      );
    } catch (error) {
      throw typed(error, code);
    }
    return catalog;
  }

  function derivedCatalogAuthority(catalog, catalogSha256) {
    return Object.freeze({
      id: catalog.catalog_id,
      revision: catalog.revision,
      generatedAtUtc: catalog.generated_at_utc,
      validUntilUtc: catalog.valid_until_utc,
      sha256: `sha256:${catalogSha256}`
    });
  }

  function requireCatalogAuthority(value, expected, code) {
    exactObject(value, CATALOG_AUTHORITY_FIELDS, code);
    if (typeof value.id !== "string" || value.id !== expected.id ||
        !Number.isSafeInteger(value.revision) || value.revision !== expected.revision ||
        utcSecond(value.generatedAtUtc, code) !== expected.generatedAtUtc ||
        utcSecond(value.validUntilUtc, code) !== expected.validUntilUtc ||
        contentId(value.sha256, code) !== expected.sha256) {
      reject(code);
    }
  }

  function bindCatalogToAdmission(catalog, manifest, admission, receipt, code) {
    const descriptor = manifest.admissionAuthority;
    const compositionId = `sha256:${admission.composition.graphIdentitySha256}`;
    const entries = catalog.entries.filter(
      (candidate) => candidate.composition.composition_id === compositionId
    );
    if (entries.length !== 1) reject(code);
    const entry = entries[0];
    if (entry.source.repository !== admission.modelId ||
        entry.browser_admission.bytes !== descriptor.admission.byteLength ||
        entry.browser_admission.sha256 !== `sha256:${descriptor.admission.sha256}` ||
        entry.qualification.receipt_id !== receipt.receiptId ||
        entry.qualification.receipt_bytes !== descriptor.qualificationReceipt.byteLength ||
        entry.qualification.receipt_sha256 !==
          `sha256:${descriptor.qualificationReceipt.sha256}` ||
        entry.qualification.status !== "qualified" ||
        entry.qualification.numerical_status !== "passed" ||
        entry.qualification.browser_status !== "passed" ||
        entry.qualification.quality_status !== "qualified" ||
        Date.parse(receipt.issuedAtUtc) > Date.parse(catalog.generated_at_utc) ||
        entry.composition.member_count !== MEMBER_NAMES.length ||
        entry.composition.members.length !== MEMBER_NAMES.length) {
      reject(code);
    }
    for (let index = 0; index < MEMBER_NAMES.length; index += 1) {
      const catalogMember = entry.composition.members[index];
      const member = manifest.members[index];
      if (catalogMember.name !== member.fileName ||
          catalogMember.bytes !== member.byteLength ||
          catalogMember.sha256 !== `sha256:${member.sha256}`) {
        reject(code, { memberName: member.fileName });
      }
    }
  }

  async function prepareCatalog(adapter, value, authority, manifest, admission, receipt) {
    const code = "model-composition-store-catalog";
    const descriptor = manifest.admissionAuthority.catalog;
    const bytes = await prepareTextBytes(
      adapter,
      value,
      descriptor,
      catalogByteLimit(),
      code
    );
    const catalog = parseCatalogText(value, code, true);
    const catalogAuthority = derivedCatalogAuthority(catalog, descriptor.sha256);
    requireCatalogAuthority(authority, catalogAuthority,
      "model-composition-store-catalog-authority");
    bindCatalogToAdmission(catalog, manifest, admission, receipt, code);
    return Object.freeze({
      text: value,
      bytes,
      catalog,
      catalogAuthority
    });
  }

  function openedAdmissionAuthority(manifest, admission, receipt, catalog) {
    return Object.freeze({
      admission: admission.admission,
      admissionText: admission.text,
      admissionSha256: `sha256:${manifest.admissionAuthority.admission.sha256}`,
      qualificationReceipt: receipt.receipt,
      qualificationReceiptText: receipt.text,
      qualificationReceiptSha256:
        `sha256:${manifest.admissionAuthority.qualificationReceipt.sha256}`,
      catalogDocument: catalog.catalog,
      catalogText: catalog.text,
      catalogAuthority: catalog.catalogAuthority,
      p2pPieceSetSha256: manifest.admissionAuthority.p2pPieceSetSha256
    });
  }

  async function prepareAdmissionAuthority(adapter, value, manifest) {
    const code = "model-composition-store-admission-authority";
    exactObject(value, ADMISSION_AUTHORITY_INPUT_FIELDS, code);
    const pieceSet = value.p2pPieceSetSha256 === null
      ? null
      : contentId(value.p2pPieceSetSha256, code);
    if (pieceSet !== manifest.admissionAuthority.p2pPieceSetSha256) reject(code);
    const admission = await prepareAdmission(adapter, value.admissionText, manifest);
    const receipt = await prepareQualificationReceipt(
      adapter,
      value.qualificationReceiptText,
      manifest,
      admission.admission
    );
    const catalog = await prepareCatalog(
      adapter,
      value.catalogText,
      value.catalogAuthority,
      manifest,
      admission.admission,
      receipt.receipt
    );
    return Object.freeze({
      admission,
      receipt,
      catalog,
      opened: openedAdmissionAuthority(manifest, admission, receipt, catalog)
    });
  }

  // Validate admission bytes under the same cancellable lifetime as the installed manifest.
  async function readInstalledAdmission(options, manifestSha256, manifest, signal) {
    const code = "model-composition-store-stored-admission";
    const bytes = await readSmallFile(
      options.adapter,
      [INSTALLED_DIRECTORY, manifestSha256, INSTALLED_ADMISSION_FILE],
      admissionByteLimit(),
      code,
      signal
    );
    const descriptor = manifest.admissionAuthority.admission;
    if (bytes === null || bytes.byteLength !== descriptor.byteLength ||
        await hashBytes(options.adapter, bytes, signal) !== descriptor.sha256) {
      reject(code);
    }
    let text;
    try {
      text = decoder().decode(bytes);
    } catch (error) {
      throw typed(error, code);
    }
    const admission = parseAdmissionText(text, manifest, code);
    return Object.freeze({ text, bytes, admission });
  }

  // Preserve cancellation while reading and hashing the exact qualification receipt.
  async function readInstalledQualificationReceipt(
    options,
    manifestSha256,
    manifest,
    admission,
    signal
  ) {
    const code = "model-composition-store-stored-qualification-receipt";
    const descriptor = manifest.admissionAuthority.qualificationReceipt;
    const bytes = await readSmallFile(
      options.adapter,
      [INSTALLED_DIRECTORY, manifestSha256, INSTALLED_QUALIFICATION_RECEIPT_FILE],
      MAXIMUM_QUALIFICATION_RECEIPT_BYTES,
      code,
      signal
    );
    if (bytes === null || bytes.byteLength !== descriptor.byteLength ||
        await hashBytes(options.adapter, bytes, signal) !== descriptor.sha256) {
      reject(code);
    }
    let text;
    try {
      text = decoder().decode(bytes);
    } catch (error) {
      throw typed(error, code);
    }
    const receipt = parseQualificationReceiptText(text, admission, code);
    return Object.freeze({ text, bytes, receipt });
  }

  // Catalog custody shares the caller lifetime and retains exact descriptor validation.
  async function readInstalledCatalog(
    options,
    manifestSha256,
    manifest,
    admission,
    receipt,
    signal
  ) {
    const code = "model-composition-store-stored-catalog";
    const descriptor = manifest.admissionAuthority.catalog;
    const bytes = await readSmallFile(
      options.adapter,
      [INSTALLED_DIRECTORY, manifestSha256, INSTALLED_CATALOG_FILE],
      catalogByteLimit(),
      code,
      signal
    );
    if (bytes === null || bytes.byteLength !== descriptor.byteLength ||
        await hashBytes(options.adapter, bytes, signal) !== descriptor.sha256) {
      reject(code);
    }
    let text;
    try {
      text = decoder().decode(bytes);
    } catch (error) {
      throw typed(error, code);
    }
    const catalog = parseCatalogText(text, code, false);
    bindCatalogToAdmission(catalog, manifest, admission, receipt, code);
    return Object.freeze({
      text,
      bytes,
      catalog,
      catalogAuthority: derivedCatalogAuthority(catalog, descriptor.sha256)
    });
  }

  // All three authority documents belong to one cancellable read, with no partial acceptance.
  async function readInstalledAdmissionAuthority(options, manifestSha256, manifest, signal) {
    const admission = await readInstalledAdmission(options, manifestSha256, manifest, signal);
    const receipt = await readInstalledQualificationReceipt(
      options,
      manifestSha256,
      manifest,
      admission.admission,
      signal
    );
    const catalog = await readInstalledCatalog(
      options,
      manifestSha256,
      manifest,
      admission.admission,
      receipt.receipt,
      signal
    );
    return openedAdmissionAuthority(manifest, admission, receipt, catalog);
  }

  async function verifyInstalled(options, pointer, manifest, signal) {
    const authoritySha256 = await hashBytes(
      options.adapter,
      canonicalBytes(manifest.admissionAuthority),
      signal
    );
    if (pointer.admissionAuthoritySha256 !== authoritySha256) {
      reject("model-composition-store-active-pointer");
    }
    const context = {
      adapter: options.adapter,
      chunkBytes: options.chunkBytes,
      signal,
      stagingId: pointer.stagingId,
      manifestSha256: pointer.manifestSha256
    };
    for (const member of manifest.members) {
      checkCancelled(signal, pointer.stagingId);
      await verifyMember(context, member);
    }
  }

  // Composition locks never acquire the writer lock; retirement takes writer then composition.
  async function withCompositionLock(adapter, identity, mode, callback, signal) {
    checkCancelled(signal);
    try {
      return await adapter.withCompositionLock(identity, mode, callback, signal || undefined);
    } catch (error) {
      if (error instanceof ModelCompositionStoreError) throw error;
      checkCancelled(signal);
      throw typed(error, "model-composition-store-lock");
    }
  }

  // Hold a shared lock across an iterator's yields without buffering its model bytes.
  async function acquireCompositionRead(options, pointer, signal) {
    let acquired;
    let rejected;
    let release;
    const ready = new Promise((resolve, rejectPromise) => { acquired = resolve; rejected = rejectPromise; });
    const held = new Promise(resolve => { release = resolve; });
    const pending = withCompositionLock(options.adapter, pointer.manifestSha256, "shared", async () => {
      acquired();
      await held;
    }, signal);
    pending.catch(rejected);
    await ready;
    return async () => { release(); await pending; };
  }

  // Link callback-scope cancellation and a member-specific signal without changing either input.
  function linkedReadSignal(scopeSignal, memberSignal) {
    const controller = new AbortController();
    const signals = [...new Set([scopeSignal, memberSignal].filter(Boolean))];
    const abort = () => controller.abort();
    for (const signal of signals) {
      if (signal.aborted) abort();
      else signal.addEventListener("abort", abort, { once: true });
    }
    return { signal: controller.signal,
      dispose() { for (const signal of signals) signal.removeEventListener("abort", abort); } };
  }

  function openedComposition(options, pointer, manifest, admissionAuthority) {
    // Read one exact member while the caller holds this composition's shared lease.
    async function* readMember(fileName, callOptions, scope) {
      if (!MEMBER_NAMES.includes(fileName)) {
        reject("model-composition-store-member-name", { memberName: fileName });
      }
      const source = normalizeCall(
        callOptions,
        [],
        ["signal"],
        "model-composition-store-stream-options"
      );
      if (scope && !scope.active) reject("model-composition-store-read-scope-closed");
      const linked = linkedReadSignal(scope && scope.signal, normalizeSignal(source.signal));
      const signal = linked.signal;
      try {
        checkCancelled(signal, pointer.stagingId);
        const member = manifest.members[MEMBER_NAMES.indexOf(fileName)];
        const details = { stagingId: pointer.stagingId, memberName: fileName };
        const readable = await openReadable(
          options.adapter,
          [INSTALLED_DIRECTORY, pointer.manifestSha256, fileName],
          "model-composition-store-read",
          details,
          signal
        );
        if (!readable || readable.byteLength !== member.byteLength) {
          reject("model-composition-store-stored-length", details);
        }
        const hasher = createHasher(options.adapter);
        let byteLength = 0;
        for await (const chunk of boundedChunks(
          readable.stream,
          options.chunkBytes,
          signal,
          pointer.stagingId,
          "model-composition-store-read"
        )) {
          if (byteLength + chunk.byteLength > member.byteLength) {
            reject("model-composition-store-stored-length", details);
          }
          await updateHasher(hasher, chunk);
          byteLength += chunk.byteLength;
          yield chunk;
        }
        if (byteLength !== member.byteLength) {
          reject("model-composition-store-stored-length", details);
        }
        if (await finishHasher(hasher) !== member.sha256) {
          reject("model-composition-store-stored-sha256", details);
        }
      } finally { linked.dispose(); }
    }

    // Standalone reads pin one member until completion or iterator disposal.
    async function* streamMember(fileName, callOptions) {
      const call = normalizeCall(callOptions, [], ["signal"], "model-composition-store-stream-options");
      const signal = normalizeSignal(call.signal);
      const release = await acquireCompositionRead(options, pointer, signal);
      try { yield* readMember(fileName, call, null); }
      finally { await release(); }
    }

    // Pin all six files for one load; close escaped streams before releasing the shared lease.
    async function withRead(callback, callOptions) {
      if (typeof callback !== "function") reject("model-composition-store-read-options");
      const call = normalizeCall(callOptions, [], ["signal"], "model-composition-store-read-options");
      const signal = normalizeSignal(call.signal);
      return withCompositionLock(options.adapter, pointer.manifestSha256, "shared", async () => {
        const controller = new AbortController();
        const scopeSignal = linkedReadSignal(signal, controller.signal);
        const scope = { active: true, signal: scopeSignal.signal };
        const iterators = new Set();
        // Observe pending reads even when a callback exits before awaiting them.
        const scopedStream = (fileName, memberOptions) => {
          if (!scope.active) reject("model-composition-store-read-scope-closed");
          const iterator = readMember(fileName, memberOptions, scope);
          iterators.add(iterator);
          return {
            next(value) { const pending = iterator.next(value); pending.catch(() => {}); return pending; },
            return(value) { return iterator.return(value); },
            throw(error) { return iterator.throw(error); },
            [Symbol.asyncIterator]() { return this; }
          };
        };
        try {
          return await nextWithCancellation(Promise.resolve().then(() => callback(
            Object.freeze({ manifestSha256: pointer.manifestSha256, streamMember: scopedStream })
          )), scope.signal, pointer.stagingId);
        } finally {
          scope.active = false;
          controller.abort();
          await Promise.allSettled([...iterators].map(iterator => iterator.return()));
          scopeSignal.dispose();
        }
      }, signal);
    }
    return Object.freeze({
      manifestSha256: pointer.manifestSha256,
      admissionAuthoritySha256: pointer.admissionAuthoritySha256,
      activationId: pointer.stagingId,
      manifest,
      admissionAuthority,
      streamMember,
      withRead
    });
  }

  // Require a canonical marker bound to its filename before using its cleanup authority.
  async function ownedStaging(adapter, entry, signal) {
    const code = "model-composition-store-cleanup-ownership";
    if (entry.kind !== "file" || !/^[0-9a-f]{64}\.json$/u.test(entry.name)) reject(code);
    let staging;
    try {
      staging = await readStaging(adapter, entry.name, signal);
    } catch (error) {
      checkCancelled(signal);
      throw new ModelCompositionStoreError(code, { cause: error });
    }
    if (!staging || entry.name !== `${staging.stagingId}.json`) reject(code);
    return staging;
  }

  // Admit a complete bounded parent inventory; a file must never masquerade as a composition directory.
  async function installedEntry(options, manifestSha256, signal) {
    const entries = await listEntries(options.adapter, [INSTALLED_DIRECTORY], INSTALLED_SCAN_LIMIT, signal);
    if (entries.length === INSTALLED_SCAN_LIMIT) reject("model-composition-store-cleanup-ownership");
    const entry = entries.find(value => value.name === manifestSha256);
    if (entry && entry.kind !== "directory") reject("model-composition-store-cleanup-ownership");
    return entry;
  }

  // A marker, pointer or this installation proves ownership; orphans need a hash-bound manifest.
  async function ownedInstalledEntries(options, manifestSha256, identityKnown, signal) {
    const code = "model-composition-store-cleanup-ownership";
    if (!SHA256_PATTERN.test(manifestSha256)) reject(code);
    await installedEntry(options, manifestSha256, signal);
    if (!identityKnown) {
      let manifest;
      try {
        manifest = await readInstalledManifest(options, manifestSha256, signal);
      } catch (error) {
        checkCancelled(signal);
        throw new ModelCompositionStoreError(code, { cause: error });
      }
      if (!manifest) reject(code);
    }
    const entries = await listEntries(options.adapter,
      [INSTALLED_DIRECTORY, manifestSha256], INSTALLED_FILES.length + 1, signal);
    if (entries.length > INSTALLED_FILES.length || entries.some(entry =>
      entry.kind !== "file" || !INSTALLED_FILES.includes(entry.name))) reject(code);
    return entries;
  }

  // Delete only admitted direct files, manifest last; never recursively consume a late extra entry.
  async function removeInstalled(options, manifestSha256, identityKnown, signal) {
    return withCompositionLock(options.adapter, manifestSha256, "exclusive", async () => {
      const entries = await ownedInstalledEntries(options, manifestSha256, identityKnown, signal);
      const names = new Set(entries.map(entry => entry.name));
      for (const name of INSTALLED_FILES) {
        checkCancelled(signal);
        if (names.has(name)) {
          await removeEntry(options.adapter, [INSTALLED_DIRECTORY, manifestSha256, name], false);
        }
      }
      checkCancelled(signal);
      await removeEntry(options.adapter, [INSTALLED_DIRECTORY, manifestSha256], false);
    }, signal);
  }

  // Preserve the primary outcome and let a later bounded pass retry owned residue.
  async function bestEffortRemoveInstalled(options, manifestSha256) {
    try {
      await removeInstalled(options, manifestSha256, true);
      return true;
    } catch (_) {
      return false;
    }
  }

  // Bound the complete parent inventory before creating a candidate in an unowned existing path.
  async function requireVacantInstalledPath(options, manifestSha256, signal) {
    if (await installedEntry(options, manifestSha256, signal)) {
      reject("model-composition-store-cleanup-ownership");
    }
  }

  // Retire only identified compositions and canonical markers within the caller's bounded budget.
  async function cleanupInternal(options, limit, signal) {
    const pointer = await readPointer(options.adapter, signal);
    await requireResolvedPointer(options.adapter, pointer, signal);
    const stagingEntries = await listEntries(
      options.adapter,
      [STAGING_DIRECTORY],
      options.maximumStagingEntries + 1,
      signal
    );
    let removedStaging = 0;
    let removedInstalled = 0;
    for (const entry of stagingEntries.slice(0, limit)) {
      checkCancelled(signal);
      const staging = await ownedStaging(options.adapter, entry, signal);
      if (!pointer || staging.manifestSha256 !== pointer.manifestSha256) {
        await removeInstalled(options, staging.manifestSha256, true, signal);
        removedInstalled += 1;
      }
      await removeEntry(options.adapter, [STAGING_DIRECTORY, entry.name], false);
      removedStaging += 1;
    }

    const remainingEntries = await listEntries(
      options.adapter,
      [STAGING_DIRECTORY],
      options.maximumStagingEntries + 1,
      signal
    );
    const protectedManifests = new Set(pointer ? [pointer.manifestSha256] : []);
    for (const entry of remainingEntries) {
      const staging = await ownedStaging(options.adapter, entry, signal);
      protectedManifests.add(staging.manifestSha256);
    }

    const remainingBudget = Math.max(0, limit - removedInstalled);
    const installedEntries = await listEntries(
      options.adapter,
      [INSTALLED_DIRECTORY],
      remainingBudget + protectedManifests.size + 1,
      signal
    );
    for (const entry of installedEntries) {
      if (removedInstalled >= limit) break;
      if (entry.kind === "directory" && protectedManifests.has(entry.name)) continue;
      checkCancelled(signal);
      if (entry.kind !== "directory") reject("model-composition-store-cleanup-ownership");
      await removeInstalled(options, entry.name, false, signal);
      removedInstalled += 1;
    }
    return Object.freeze({
      removedStaging,
      removedInstalled,
      remainingStaging: remainingEntries.length,
      truncated: stagingEntries.length > limit ||
        installedEntries.length > remainingBudget + protectedManifests.size
    });
  }

  // Allocation reads may be cancelled before any staging marker is persisted.
  async function allocateStagingId(options, signal) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      let bytes;
      try {
        checkCancelled(signal);
        bytes = await nextWithCancellation(options.adapter.randomBytes(32), signal);
      } catch (error) {
        throw typed(error, "model-composition-store-random");
      }
      if (!(bytes instanceof Uint8Array) || bytes.byteLength !== 32) {
        reject("model-composition-store-random");
      }
      const stagingId = bytesToHex(bytes);
      const existing = await openReadable(
        options.adapter,
        [STAGING_DIRECTORY, `${stagingId}.json`],
        "model-composition-store-storage",
        undefined,
        signal
      );
      if (existing === null) return stagingId;
    }
    reject("model-composition-store-staging-collision");
  }

  function createModelCompositionStore(value) {
    const options = normalizeStoreOptions(value);

    async function initialize() {
      await ensureDirectory(options.adapter, []);
      await ensureDirectory(options.adapter, [INSTALLED_DIRECTORY]);
      await ensureDirectory(options.adapter, [STAGING_DIRECTORY]);
    }

    async function openPointerInternal(pointer, signal) {
      checkCancelled(signal, pointer.stagingId);
      const manifest = await readInstalledManifest(options, pointer.manifestSha256, signal);
      if (manifest === null) reject("model-composition-store-installed-manifest");
      const admissionAuthority = await readInstalledAdmissionAuthority(
        options,
        pointer.manifestSha256,
        manifest,
        signal
      );
      await verifyInstalled(options, pointer, manifest, signal);
      return openedComposition(options, pointer, manifest, admissionAuthority);
    }

    async function openActiveInternal(signal) {
      await initialize();
      const pointer = await readPointer(options.adapter, signal);
      if (pointer === null) return null;
      await requireResolvedPointer(options.adapter, pointer, signal);
      return openPointerInternal(pointer, signal);
    }

    async function requireActivation(activate, candidate, previousComposition, signal) {
      checkCancelled(signal, candidate.activationId);
      let accepted;
      try {
        accepted = await nextWithCancellation(
          Promise.resolve().then(() => activate(candidate, Object.freeze({
            previousComposition,
            signal: signal || null
          }))),
          signal,
          candidate.activationId
        );
      } catch (error) {
        checkCancelled(signal, candidate.activationId);
        throw new ModelCompositionStoreError(
          "model-composition-store-activation-rejected",
          { stagingId: candidate.activationId, cause: error }
        );
      }
      checkCancelled(signal, candidate.activationId);
      if (accepted !== true) {
        reject("model-composition-store-activation-rejected", {
          stagingId: candidate.activationId
        });
      }
    }

    async function requireCommitAuthorization(
      authorizeCommit,
      candidate,
      previousComposition,
      signal
    ) {
      checkCancelled(signal, candidate.activationId);
      let accepted;
      try {
        accepted = await nextWithCancellation(
          Promise.resolve().then(() => authorizeCommit(candidate, Object.freeze({
            previousComposition,
            signal: signal || null
          }))),
          signal,
          candidate.activationId
        );
      } catch (error) {
        checkCancelled(signal, candidate.activationId);
        throw new ModelCompositionStoreError(
          "model-composition-store-commit-authorization-rejected",
          { stagingId: candidate.activationId, cause: error }
        );
      }
      checkCancelled(signal, candidate.activationId);
      if (accepted !== true) {
        reject("model-composition-store-commit-authorization-rejected", {
          stagingId: candidate.activationId
        });
      }
    }

    async function install(value) {
      const call = normalizeCall(
        value,
        ["manifest", "admissionAuthority", "sources", "activate", "authorizeCommit"],
        [
          "manifest",
          "admissionAuthority",
          "sources",
          "activate",
          "authorizeCommit",
          "signal"
        ],
        "model-composition-store-install-options"
      );
      if (typeof call.activate !== "function" || typeof call.authorizeCommit !== "function") {
        reject("model-composition-store-install-options");
      }
      const signal = normalizeSignal(call.signal);
      const manifest = normalizeManifest(call.manifest, options.maximumCompositionBytes);
      const sources = normalizeSources(call.sources);
      checkCancelled(signal);
      // Input preparation is bounded and read-only; never enter storage after its caller cancels.
      const suppliedAuthority = await nextWithCancellation(prepareAdmissionAuthority(
        options.adapter,
        call.admissionAuthority,
        manifest
      ), signal);
      let committedResult = null;
      const installLocked = async () => {
        await initialize();
        checkCancelled(signal);
        await cleanupInternal(options, options.cleanupLimit, signal);
        const stagingCount = (await listEntries(
          options.adapter,
          [STAGING_DIRECTORY],
          options.maximumStagingEntries + 1,
          signal
        )).length;
        if (stagingCount >= options.maximumStagingEntries) {
          reject("model-composition-store-staging-limit");
        }

        const manifestBytes = canonicalBytes(manifest);
        const manifestSha256 = await hashBytes(options.adapter, manifestBytes, signal);
        const admissionAuthoritySha256 = await hashBytes(
          options.adapter,
          canonicalBytes(manifest.admissionAuthority),
          signal
        );
        const previousPointer = await readPointer(options.adapter, signal);
        if (previousPointer && previousPointer.manifestSha256 === manifestSha256) {
          const current = await openActiveInternal(signal);
          if (!current ||
              current.admissionAuthoritySha256 !== admissionAuthoritySha256 ||
              current.admissionAuthority.admissionText !==
                suppliedAuthority.opened.admissionText ||
              current.admissionAuthority.qualificationReceiptText !==
                suppliedAuthority.opened.qualificationReceiptText ||
              current.admissionAuthority.catalogText !==
                suppliedAuthority.opened.catalogText ||
              current.admissionAuthority.p2pPieceSetSha256 !==
                suppliedAuthority.opened.p2pPieceSetSha256) {
            reject("model-composition-store-active-pointer");
          }
          await requireActivation(call.activate, current, current, signal);
          committedResult = current;
          return current;
        }

        const existingManifest = await readInstalledManifest(options, manifestSha256, signal);
        if (existingManifest === null) await requireVacantInstalledPath(options, manifestSha256, signal);
        let reuseInstalled = false;
        if (existingManifest !== null) {
          if (!bytesEqual(canonicalBytes(existingManifest), manifestBytes)) {
            reject("model-composition-store-immutable-conflict");
          }
          const existingPointer = Object.freeze({
            schema: POINTER_SCHEMA,
            stagingId: await allocateStagingId(options, signal),
            manifestSha256,
            admissionAuthoritySha256
          });
          try {
            const existingAuthority = await readInstalledAdmissionAuthority(
              options,
              manifestSha256,
              existingManifest,
              signal
            );
            if (existingAuthority.admissionText !== suppliedAuthority.opened.admissionText ||
                existingAuthority.qualificationReceiptText !==
                  suppliedAuthority.opened.qualificationReceiptText ||
                existingAuthority.catalogText !== suppliedAuthority.opened.catalogText ||
                existingAuthority.p2pPieceSetSha256 !==
                  suppliedAuthority.opened.p2pPieceSetSha256) {
              reject("model-composition-store-immutable-conflict");
            }
            await verifyInstalled(options, existingPointer, existingManifest, signal);
          } catch (error) {
            throw typed(error, "model-composition-store-immutable-conflict");
          }
          reuseInstalled = true;
        }

        const stagingId = await allocateStagingId(options, signal);
        const staging = Object.freeze({
          schema: STAGING_SCHEMA,
          stagingId,
          manifestSha256
        });
        const pointer = Object.freeze({
          schema: POINTER_SCHEMA,
          stagingId,
          manifestSha256,
          admissionAuthoritySha256
        });
        const stagingPath = [STAGING_DIRECTORY, `${stagingId}.json`];
        let ownsCandidate = false;
        let pointerCommitted = false;
        let pointerWriteAttempted = false;
        let candidate = null;
        const finishCommitted = async () => {
          pointerCommitted = true;
          await bestEffortRemove(options.adapter, stagingPath, false);
          // Restart treats a surviving marker as unresolved; preserve both candidates until absence is observed.
          await requireResolvedPointer(options.adapter, pointer);
          if (previousPointer && previousPointer.manifestSha256 !== manifestSha256) {
            await bestEffortRemoveInstalled(options, previousPointer.manifestSha256);
          }
          committedResult = candidate || openedComposition(
            options, pointer, manifest, suppliedAuthority.opened
          );
          return committedResult;
        };
        try {
          await atomicWrite(
            options.adapter,
            stagingPath,
            canonicalBytes(staging),
            "model-composition-store-staging",
            { stagingId }
          );
          if (!reuseInstalled) {
            await withCompositionLock(options.adapter, manifestSha256, "exclusive", async () => {
              checkCancelled(signal, stagingId);
              await requireVacantInstalledPath(options, manifestSha256, signal);
              await ensureDirectory(
                options.adapter,
                [INSTALLED_DIRECTORY, manifestSha256]
              );
              ownsCandidate = true;
              await atomicWrite(
                options.adapter,
                [INSTALLED_DIRECTORY, manifestSha256, INSTALLED_MANIFEST_FILE],
                manifestBytes,
                "model-composition-store-write",
                { stagingId }
              );
              await atomicWrite(
                options.adapter,
                [INSTALLED_DIRECTORY, manifestSha256, INSTALLED_ADMISSION_FILE],
                suppliedAuthority.admission.bytes,
                "model-composition-store-write",
                { stagingId }
              );
              await atomicWrite(
                options.adapter,
                [
                  INSTALLED_DIRECTORY,
                  manifestSha256,
                  INSTALLED_QUALIFICATION_RECEIPT_FILE
                ],
                suppliedAuthority.receipt.bytes,
                "model-composition-store-write",
                { stagingId }
              );
              await atomicWrite(
                options.adapter,
                [INSTALLED_DIRECTORY, manifestSha256, INSTALLED_CATALOG_FILE],
                suppliedAuthority.catalog.bytes,
                "model-composition-store-write",
                { stagingId }
              );
              const context = {
                adapter: options.adapter,
                chunkBytes: options.chunkBytes,
                signal,
                stagingId,
                manifestSha256
              };
              for (const member of manifest.members) {
                checkCancelled(signal, stagingId);
                await writeMember(context, member, sources[member.fileName]);
              }
            }, signal);
          }

          const storedManifest = await readInstalledManifest(options, manifestSha256, signal);
          if (!storedManifest || !bytesEqual(canonicalBytes(storedManifest), manifestBytes)) {
            reject("model-composition-store-installed-manifest", { stagingId });
          }
          const storedAuthority = await readInstalledAdmissionAuthority(
            options,
            manifestSha256,
            storedManifest,
            signal
          );
          if (storedAuthority.admissionText !== suppliedAuthority.opened.admissionText) {
            reject("model-composition-store-stored-admission", { stagingId });
          }
          if (storedAuthority.qualificationReceiptText !==
              suppliedAuthority.opened.qualificationReceiptText) {
            reject("model-composition-store-stored-qualification-receipt", { stagingId });
          }
          if (storedAuthority.catalogText !== suppliedAuthority.opened.catalogText) {
            reject("model-composition-store-stored-catalog", { stagingId });
          }
          candidate = await openPointerInternal(pointer, signal);
          const previousComposition = previousPointer === null
            ? null
            : await openPointerInternal(previousPointer, signal);
          await requireActivation(
            call.activate,
            candidate,
            previousComposition,
            signal
          );
          checkCancelled(signal, stagingId);
          await ownedInstalledEntries(options, manifestSha256, true, signal);
          if (previousPointer) {
            await ownedInstalledEntries(options, previousPointer.manifestSha256, true, signal);
          }
          await requireCommitAuthorization(
            call.authorizeCommit,
            candidate,
            previousComposition,
            signal
          );
          checkCancelled(signal, stagingId);
          pointerWriteAttempted = true;
          await atomicWrite(
            options.adapter,
            [ACTIVE_POINTER_FILE],
            canonicalBytes(pointer),
            "model-composition-store-activation",
            { stagingId }
          );
          return finishCommitted();
        } catch (error) {
          let preserveCandidate = false;
          let terminalError = error;
          if (!pointerCommitted && pointerWriteAttempted) {
            // active.json is the linearization point; exact readback wins over a late fault.
            const committed = await observePointerCommit(options.adapter, pointer);
            if (committed === true) return finishCommitted();
            preserveCandidate = committed === null;
            if (preserveCandidate) {
              terminalError = activationIndeterminate(pointer, terminalError);
            }
            if (committed === false && signal && signal.aborted) {
              terminalError = new ModelCompositionStoreError(
                "model-composition-store-aborted",
                { stagingId }
              );
            }
          }
          if (!pointerCommitted && !preserveCandidate) {
            const removed = !ownsCandidate ||
              await bestEffortRemoveInstalled(options, manifestSha256);
            // A failed retirement keeps its marker so restart still has exact ownership evidence.
            if (removed) await bestEffortRemove(options.adapter, stagingPath, false);
          }
          throw withCommitDisposition(
            terminalError,
            preserveCandidate ? "indeterminate" : "not-committed",
            stagingId
          );
        }
      };
      try {
        return await withExclusiveLock(options.adapter, installLocked, signal);
      } catch (error) {
        // A lock adapter may reject after its callback has already durably committed.
        if (committedResult !== null) return committedResult;
        throw error;
      }
    }

    async function openActive(value) {
      const call = normalizeCall(
        value,
        [],
        ["signal"],
        "model-composition-store-open-options"
      );
      const signal = normalizeSignal(call.signal);
      return withExclusiveLock(
        options.adapter,
        () => openActiveInternal(signal),
        signal
      );
    }

    async function cleanup(value) {
      const call = normalizeCall(
        value,
        [],
        ["limit", "signal"],
        "model-composition-store-cleanup-options"
      );
      const signal = normalizeSignal(call.signal);
      const limit = safeInteger(
        call.limit === undefined ? options.cleanupLimit : call.limit,
        1,
        options.cleanupLimit,
        "model-composition-store-cleanup-options"
      );
      return withExclusiveLock(options.adapter, async () => {
        await initialize();
        return cleanupInternal(options, limit, signal);
      }, signal);
    }

    async function discardInvalidActive(value) {
      const call = normalizeCall(
        value,
        [],
        ["signal"],
        "model-composition-store-recovery-options"
      );
      const signal = normalizeSignal(call.signal);
      return withExclusiveLock(options.adapter, async () => {
        await initialize();
        checkCancelled(signal);
        let pointer = null;
        let failure = null;
        try {
          pointer = await readPointer(options.adapter, signal);
          if (pointer === null) return false;
          await requireResolvedPointer(options.adapter, pointer, signal);
          await openPointerInternal(pointer, signal);
          return false;
        } catch (error) {
          if (!(error instanceof ModelCompositionStoreError) ||
              !RECOVERABLE_ACTIVE_CODES.has(error.code)) {
            throw error;
          }
          failure = error;
        }

        checkCancelled(signal, pointer && pointer.stagingId);
        if (pointer && RECOVERABLE_CONTENT_CODES.has(failure.code)) {
          checkCancelled(signal, pointer.stagingId);
          await removeInstalled(options, pointer.manifestSha256, true, signal);
        }
        // Keep the invalid pointer's ownership identity until content removal succeeds.
        await removeEntry(options.adapter, [ACTIVE_POINTER_FILE], false);
        if (pointer && RECOVERABLE_CONTENT_CODES.has(failure.code)) {
          checkCancelled(signal, pointer.stagingId);
          await removeEntry(
            options.adapter,
            [STAGING_DIRECTORY, `${pointer.stagingId}.json`],
            false
          );
        }
        return true;
      }, signal);
    }

    return Object.freeze({ install, openActive, cleanup, discardInvalidActive });
  }

  function validatePath(path) {
    if (!Array.isArray(path) || path.some((part) =>
      typeof part !== "string" || part.length < 1 || part.length > 160 ||
      part === "." || part === ".." || /[\\/\u0000-\u001f\u007f]/u.test(part))) {
      reject("model-composition-store-opfs-path");
    }
    return path;
  }

  function isNotFound(error) {
    return Boolean(error && error.name === "NotFoundError");
  }

  function normalizeOpfsOptions(value) {
    if (!isPlainObject(value) || typeof value.createSha256 !== "function") {
      reject("model-composition-store-opfs-options");
    }
    const allowed = new Set(["createSha256", "storageManager", "lockManager", "crypto"]);
    if (Object.keys(value).some((key) => !allowed.has(key))) {
      reject("model-composition-store-opfs-options");
    }
    const navigatorValue = root && root.navigator;
    const storageManager = value.storageManager || (navigatorValue && navigatorValue.storage);
    const lockManager = value.lockManager || (navigatorValue && navigatorValue.locks);
    const cryptoValue = value.crypto || (root && root.crypto);
    if (!storageManager || typeof storageManager.getDirectory !== "function" ||
        !lockManager || typeof lockManager.request !== "function" ||
        !cryptoValue || typeof cryptoValue.getRandomValues !== "function") {
      reject("model-composition-store-opfs-unavailable");
    }
    return { createSha256: value.createSha256, storageManager, lockManager, cryptoValue };
  }

  function createOpfsAdapter(value) {
    const options = normalizeOpfsOptions(value);
    let rootPromise = null;

    async function storeRoot() {
      if (rootPromise === null) {
        rootPromise = Promise.resolve(options.storageManager.getDirectory()).then((opfsRoot) => {
          if (!opfsRoot || typeof opfsRoot.getDirectoryHandle !== "function") {
            reject("model-composition-store-opfs-unavailable");
          }
          return opfsRoot.getDirectoryHandle(OPFS_ROOT_NAME, { create: true });
        });
      }
      return rootPromise;
    }

    async function directory(path, create) {
      validatePath(path);
      let handle = await storeRoot();
      for (const part of path) {
        handle = await handle.getDirectoryHandle(part, { create });
      }
      return handle;
    }

    async function parentAndName(path, createParent) {
      validatePath(path);
      if (path.length < 1) reject("model-composition-store-opfs-path");
      return {
        parent: await directory(path.slice(0, -1), createParent),
        name: path[path.length - 1]
      };
    }

    async function ensureDirectory(path) {
      await directory(validatePath(path), true);
    }

    async function listEntries(path, limit) {
      safeInteger(limit, 1, 2 * MAXIMUM_ENTRY_LIMIT + 2,
        "model-composition-store-opfs-limit");
      let handle;
      try {
        handle = await directory(validatePath(path), false);
      } catch (error) {
        if (isNotFound(error)) return [];
        throw error;
      }
      const entries = [];
      for await (const [name, child] of handle.entries()) {
        entries.push({ name, kind: child.kind });
        if (entries.length >= limit) break;
      }
      return entries;
    }

    async function removeEntry(path, removeOptions) {
      const source = removeOptions || {};
      let target;
      try {
        target = await parentAndName(validatePath(path), false);
        await target.parent.removeEntry(target.name, { recursive: Boolean(source.recursive) });
      } catch (error) {
        if (source.missingOk && isNotFound(error)) return;
        throw error;
      }
    }

    async function openReadable(path) {
      let target;
      try {
        target = await parentAndName(validatePath(path), false);
        const fileHandle = await target.parent.getFileHandle(target.name);
        const file = await fileHandle.getFile();
        return { byteLength: file.size, stream: file.stream() };
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    }

    async function openWritable(path) {
      const target = await parentAndName(validatePath(path), false);
      const fileHandle = await target.parent.getFileHandle(target.name, { create: true });
      const writable = await fileHandle.createWritable({
        keepExistingData: false,
        mode: "exclusive"
      });
      return Object.freeze({
        write(bytes) {
          return writable.write(bytes);
        },
        close() {
          return writable.close();
        },
        abort() {
          return writable.abort();
        }
      });
    }

    async function atomicWrite(path, bytes) {
      if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1 ||
          bytes.byteLength > MAXIMUM_CUSTODY_BYTES) {
        reject("model-composition-store-metadata-size");
      }
      const writer = await openWritable(validatePath(path));
      try {
        await writer.write(bytes);
        await writer.close();
      } catch (error) {
        try {
          await writer.abort();
        } catch (_) {
          // The failed atomic replacement remains uncommitted.
        }
        throw error;
      }
    }

    function randomBytes(length) {
      safeInteger(length, 1, 64, "model-composition-store-random");
      return options.cryptoValue.getRandomValues(new Uint8Array(length));
    }

    function withExclusiveLock(callback, signal) {
      if (typeof callback !== "function") reject("model-composition-store-adapter");
      const lockOptions = { mode: "exclusive" };
      const normalizedSignal = normalizeSignal(signal);
      if (normalizedSignal) lockOptions.signal = normalizedSignal;
      return options.lockManager.request(LOCK_NAME, lockOptions, callback);
    }

    // Shared readers pin immutable composition bytes; exclusive retirement waits for their release.
    function withCompositionLock(identity, mode, callback, signal) {
      if (typeof identity !== "string" || !SHA256_PATTERN.test(identity) ||
          !["shared", "exclusive"].includes(mode) || typeof callback !== "function") {
        reject("model-composition-store-adapter");
      }
      const lockOptions = { mode };
      const normalizedSignal = normalizeSignal(signal);
      if (normalizedSignal) lockOptions.signal = normalizedSignal;
      return options.lockManager.request(`${LOCK_NAME}:${identity}`, lockOptions, callback);
    }

    return Object.freeze({
      withExclusiveLock,
      withCompositionLock,
      createSha256: options.createSha256,
      randomBytes,
      ensureDirectory,
      listEntries,
      removeEntry,
      openReadable,
      openWritable,
      atomicWrite
    });
  }

  return Object.freeze({
    manifestSchema: MANIFEST_SCHEMA,
    qualificationReceiptSchema: QUALIFICATION_RECEIPT_SCHEMA,
    catalogSchema: CATALOG_SCHEMA,
    memberNames: MEMBER_NAMES,
    maximumChunkBytes: MAXIMUM_CHUNK_BYTES,
    defaultChunkBytes: DEFAULT_CHUNK_BYTES,
    maximumQualificationReceiptBytes: MAXIMUM_QUALIFICATION_RECEIPT_BYTES,
    maximumCatalogBytes: MAXIMUM_CATALOG_BYTES,
    ModelCompositionStoreError,
    createModelCompositionStore,
    createOpfsAdapter
  });
}));
