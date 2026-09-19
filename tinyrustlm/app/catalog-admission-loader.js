// Publishes the frozen catalog-admission loader through CommonJS or the browser global.
(function (root, factory) {
  "use strict";
  const catalogApi = typeof module === "object" && module.exports
    ? require("./minimodel-catalog-v1.js")
    : root.TinyRustLMMiniModelCatalogV1;
  const api = factory(catalogApi, root);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.TinyRustLMCatalogAdmissionLoader = api;
  }
}(typeof globalThis === "object" ? globalThis : this,
// Builds the dependency-injected loader without assuming a specific host runtime.
function (catalogApi, root) {
  "use strict";

  const ADMISSION_SCHEMA = "tinyrustlm.browser-composition-admission/1";
  const QUALIFICATION_RECEIPT_SCHEMA = "tinyrustlm.qualification-receipt/1";
  const MAXIMUM_ADMISSION_BYTES = 64 * 1024;
  const MAXIMUM_QUALIFICATION_RECEIPT_BYTES = 128 * 1024;
  const MAXIMUM_RESPONSE_CHUNKS = 1024;
  const DEFAULT_TIMEOUT_MILLISECONDS = 30_000;
  const MAXIMUM_TIMEOUT_MILLISECONDS = 120_000;
  const MEMBER_NAMES = Object.freeze([
    "model.slm2",
    "tokenizer.tokenizer2",
    "template.template2",
    "sampling.sampling2",
    "prompt.prompt2",
    "composition.acg2"
  ]);
  const MEMBER_ROLES = Object.freeze([
    "model",
    "tokenizer",
    "template",
    "sampling",
    "prompt",
    "composition"
  ]);
  const MEMBER_FORMATS = Object.freeze([
    "slm2",
    "tokenizer2",
    "template2",
    "sampling2",
    "prompt2",
    "acg2"
  ]);
  const MEMBER_PROFILE_SHA256 = Object.freeze([
    "5ac819cb31a17a64bec0d5492962a4baf0bd2778f6213b87c85c0a04f3a738d8",
    "628427bf6e7f8d34ed14b331a5c636606aee9d5ef45a36a3cadc13338669b8de",
    "14ff1df8dd6760119ac36e719ab396fff8e71d0719c2e1c83118f58693ea7bfa",
    "ec65e8f1a54c1e4ca95ebda88bde091dad11337250e541bbda60e8cac311428d",
    "f9eb4cbecfb52f5e2857216c999754da94021a5427a86732d33fe15efc0d062c",
    "944ed9b5b0ee2605ebb9ac13f2e5388c181bc857fdbfc082e62e9ae7b07c79be"
  ]);
  const ACG2_MEMBER_COUNT = 5;
  const ACG2_MEMBER_RECORD_BYTES = 128;
  const ACG2_GRAPH_DOMAIN = "tinyrustlm.acg2.champion-graph.v1\0";
  const VIEW_FIELDS = Object.freeze([
    "entryId",
    "displayName",
    "description",
    "source",
    "license",
    "composition",
    "browserAdmission",
    "profiles",
    "qualification",
    "catalogAuthority",
    "availability",
    "availabilityLabel",
    "peerCount",
    "peers"
  ]);
  const SOURCE_FIELDS = Object.freeze([
    "repository",
    "revision",
    "sourceLockSha256"
  ]);
  const COMPOSITION_FIELDS = Object.freeze([
    "compositionId",
    "memberCount",
    "members"
  ]);
  const MEMBER_FIELDS = Object.freeze(["name", "bytes", "sha256", "schema"]);
  const DESCRIPTOR_FIELDS = Object.freeze(["schema", "route", "bytes", "sha256"]);
  const QUALIFICATION_FIELDS = Object.freeze([
    "status",
    "receiptId",
    "receiptRoute",
    "receiptBytes",
    "receiptSha256",
    "numericalStatus",
    "browserStatus",
    "qualityStatus"
  ]);
  const ADMISSION_FIELDS = Object.freeze([
    "schema",
    "modelId",
    "operationId",
    "artifacts",
    "composition",
    "qualification",
    "runtime"
  ]);
  const ARTIFACT_FIELDS = Object.freeze([
    "role",
    "format",
    "fileName",
    "byteCount",
    "sha256",
    "formatProfileSha256"
  ]);
  const ADMISSION_COMPOSITION_FIELDS = Object.freeze([
    "graphIdentitySha256",
    "memberTableSha256",
    "resolvedMemberBytes"
  ]);
  const ADMISSION_QUALIFICATION_FIELDS = Object.freeze([
    "receiptId",
    "sourceEvidenceSha256",
    "structuralEvidenceSha256",
    "numericalEvidenceSha256",
    "qualityEvidenceSha256",
    "evalCasesSha256",
    "qualityClaim",
    "qualityScope"
  ]);
  const CATALOG_AUTHORITY_FIELDS = Object.freeze([
    "catalogId", "revision", "generatedAtUtc", "validUntilUtc"
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
  const REQUIRED_OPTION_FIELDS = Object.freeze([
    "catalogView",
    "catalogBaseUrl",
    "fetch",
    "admissionParser"
  ]);
  const OPTIONAL_OPTION_FIELDS = Object.freeze([
    "crypto", "hash", "signal", "timeoutMilliseconds"
  ]);

  class CatalogAdmissionLoaderError extends Error {
    // Creates a stable typed rejection carrying the machine-readable verdict code.
    constructor(code, message) {
      super(message || code);
      this.name = "CatalogAdmissionLoaderError";
      this.code = code;
    }
  }

  // Terminates validation with a typed fail-closed catalog-admission verdict.
  function reject(code, message) {
    throw new CatalogAdmissionLoaderError(code, message);
  }

  // Accepts only ordinary data objects, including null-prototype dictionaries.
  function isPlainObject(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  // Validates a getter-free data object against explicit allowed and required fields.
  function requireDataObject(value, allowedFields, requiredFields, code) {
    if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length !== 0) {
      reject(code);
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Object.keys(descriptors);
    if (keys.some(
      // Detects undeclared own fields before any values are consumed.
      (key) => !allowedFields.includes(key)
    ) || requiredFields.some(
      // Detects required fields missing from the object's own descriptors.
      (key) => !Object.hasOwn(descriptors, key)
    )) {
      reject(code);
    }
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (!Object.hasOwn(descriptor, "value") || descriptor.get || descriptor.set) {
        reject(code);
      }
    }
    return value;
  }

  // Requires a getter-free object whose own string fields exactly match the contract.
  function requireExactObject(value, fields, code) {
    const source = requireDataObject(value, fields, fields, code);
    if (Object.keys(source).length !== fields.length) {
      reject(code);
    }
    return source;
  }

  // Requires a fixed-length dense array with data descriptors at every index.
  function requireDenseArray(value, length, code) {
    if (!Array.isArray(value) || value.length !== length ||
        Object.getOwnPropertySymbols(value).length !== 0) {
      reject(code);
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const names = Object.getOwnPropertyNames(descriptors);
    if (names.length !== length + 1 || !Object.hasOwn(descriptors, "length")) {
      reject(code);
    }
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !Object.hasOwn(descriptor, "value") ||
          descriptor.get || descriptor.set) {
        reject(code);
      }
    }
    return value;
  }

  // Validates bounded nonempty text without surrounding space or control characters.
  function requireText(value, maximum, code) {
    if (typeof value !== "string" || value.length < 1 || value.length > maximum ||
        value !== value.trim() || /[\u0000-\u001f\u007f]/u.test(value)) {
      reject(code);
    }
    return value;
  }

  // Validates the canonical sha256-prefixed lowercase digest representation.
  function requirePrefixedSha256(value, code) {
    if (typeof value !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(value)) {
      reject(code);
    }
    return value;
  }

  // Validates the canonical unprefixed lowercase SHA-256 hex representation.
  function requireRawSha256(value, code) {
    if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) {
      reject(code);
    }
    return value;
  }

  // Requires the second-precision UTC form used by public qualification receipts.
  function requireUtc(value, code) {
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

  // Accepts a bounded origin-relative route with no empty or traversal segments.
  function requireRoute(value, code) {
    const route = requireText(value, 256, code);
    const segments = route.split("/");
    if (!/^\/[A-Za-z0-9._/-]+$/u.test(route) || route.includes("//") ||
        segments.includes(".") || segments.includes("..")) {
      reject(code);
    }
    return route;
  }

  // Validates dependencies and freezes a minimal internal loader configuration.
  function normalizeOptions(value) {
    const allowed = [...REQUIRED_OPTION_FIELDS, ...OPTIONAL_OPTION_FIELDS];
    const source = requireDataObject(
      value,
      allowed,
      REQUIRED_OPTION_FIELDS,
      "catalog-admission-loader-options"
    );
    const hasCrypto = Object.hasOwn(source, "crypto");
    const hasHash = Object.hasOwn(source, "hash");
    if (hasCrypto === hasHash || typeof source.fetch !== "function" ||
        (hasHash && typeof source.hash !== "function")) {
      reject("catalog-admission-loader-options");
    }
    let digestFunction = null;
    if (hasCrypto) {
      try {
        if (!source.crypto || !source.crypto.subtle ||
            typeof source.crypto.subtle.digest !== "function") {
          reject("catalog-admission-loader-options");
        }
        digestFunction = source.crypto.subtle.digest.bind(source.crypto.subtle);
      } catch (error) {
        if (error instanceof CatalogAdmissionLoaderError) {
          throw error;
        }
        reject("catalog-admission-loader-options");
      }
    }
    let parserSchema;
    let parseAdmissionText;
    try {
      parserSchema = source.admissionParser && source.admissionParser.schema;
      parseAdmissionText = source.admissionParser &&
        source.admissionParser.parseAdmissionText;
    } catch (_error) {
      reject("catalog-admission-parser");
    }
    if (parserSchema !== ADMISSION_SCHEMA || typeof parseAdmissionText !== "function") {
      reject("catalog-admission-parser");
    }
    if (!catalogApi || typeof catalogApi.parseCanonicalJsonText !== "function") {
      reject("catalog-qualification-parser");
    }
    const signal = source.signal === undefined || source.signal === null ? null : source.signal;
    const timeoutMilliseconds = source.timeoutMilliseconds === undefined
      ? DEFAULT_TIMEOUT_MILLISECONDS : source.timeoutMilliseconds;
    if ((signal !== null && (typeof signal !== "object" ||
        typeof signal.aborted !== "boolean" ||
        typeof signal.addEventListener !== "function" ||
        typeof signal.removeEventListener !== "function")) ||
        !Number.isSafeInteger(timeoutMilliseconds) || timeoutMilliseconds < 1 ||
        timeoutMilliseconds > MAXIMUM_TIMEOUT_MILLISECONDS) {
      reject("catalog-admission-loader-options");
    }
    return Object.freeze({
      catalogView: source.catalogView,
      catalogBaseUrl: source.catalogBaseUrl,
      fetchFunction: source.fetch,
      hashFunction: hasHash ? source.hash : null,
      digestFunction,
      signal,
      timeoutMilliseconds,
      parseAdmissionText: parseAdmissionText.bind(source.admissionParser)
    });
  }

  // Owns one deadline and cancellation reason across both documents and their hashes.
  function createLifetime(options) {
    if (!root || typeof root.AbortController !== "function" ||
        typeof root.setTimeout !== "function" || typeof root.clearTimeout !== "function") {
      reject("catalog-admission-loader-options");
    }
    const controller = new root.AbortController();
    let failure = null;
    let rejectStopped;
    const stopped = new Promise((_resolve, rejectPromise) => { rejectStopped = rejectPromise; });
    // Pre-aborted callers can stop before any awaited operation attaches a race.
    stopped.catch(() => {});
    // Preserve the first terminal reason even if a deadline and caller abort race.
    function stop(code) {
      if (failure) return;
      failure = new CatalogAdmissionLoaderError(code);
      controller.abort(failure);
      rejectStopped(failure);
    }
    const onAbort = () => stop("catalog-admission-aborted");
    if (options.signal) {
      options.signal.addEventListener("abort", onAbort, { once: true });
      if (options.signal.aborted) onAbort();
    }
    const timer = root.setTimeout(() => stop("catalog-admission-timeout"),
      options.timeoutMilliseconds);
    return Object.freeze({
      signal: controller.signal,
      // Check before invoking a dependency, and stop waiting even if it ignores abort.
      async wait(action) {
        if (failure) throw failure;
        const result = await Promise.race([Promise.resolve().then(() => {
          if (failure) throw failure;
          return action();
        }), stopped]);
        if (failure) throw failure;
        return result;
      },
      // Release owned resources on success and every validation/cancellation failure.
      dispose(error) {
        root.clearTimeout(timer);
        if (options.signal) options.signal.removeEventListener("abort", onAbort);
        if (error && !controller.signal.aborted) controller.abort(error);
      }
    });
  }

  // Reduces an admitted catalog view to the exact identities needed for binding.
  function normalizeCatalogView(value) {
    const view = requireExactObject(value, VIEW_FIELDS, "catalog-admission-view");
    const source = requireExactObject(
      view.source,
      SOURCE_FIELDS,
      "catalog-admission-view-source"
    );
    if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/u.test(
      requireText(source.repository, 160, "catalog-admission-view-source")
    )) {
      reject("catalog-admission-view-source");
    }

    const composition = requireExactObject(
      view.composition,
      COMPOSITION_FIELDS,
      "catalog-admission-view-composition"
    );
    requirePrefixedSha256(
      composition.compositionId,
      "catalog-admission-view-composition"
    );
    if (composition.memberCount !== MEMBER_NAMES.length) {
      reject("catalog-admission-view-members");
    }
    requireDenseArray(
      composition.members,
      MEMBER_NAMES.length,
      "catalog-admission-view-members"
    );
    const members = new Map();
    for (const memberValue of composition.members) {
      const member = requireExactObject(
        memberValue,
        MEMBER_FIELDS,
        "catalog-admission-view-members"
      );
      if (!MEMBER_NAMES.includes(member.name) || members.has(member.name) ||
          !Number.isSafeInteger(member.bytes) || member.bytes < 1 ||
          typeof member.schema !== "string" || member.schema.length < 1) {
        reject("catalog-admission-view-members");
      }
      requirePrefixedSha256(member.sha256, "catalog-admission-view-members");
      members.set(member.name, Object.freeze({
        name: member.name,
        bytes: member.bytes,
        sha256: member.sha256
      }));
    }
    if (MEMBER_NAMES.some(
      // Detects any required composition member omitted from the catalog view.
      (name) => !members.has(name)
    )) {
      reject("catalog-admission-view-members");
    }

    const descriptor = requireExactObject(
      view.browserAdmission,
      DESCRIPTOR_FIELDS,
      "catalog-admission-descriptor"
    );
    if (descriptor.schema !== ADMISSION_SCHEMA ||
        !Number.isSafeInteger(descriptor.bytes) || descriptor.bytes < 1 ||
        descriptor.bytes > MAXIMUM_ADMISSION_BYTES) {
      reject("catalog-admission-descriptor");
    }
    requireRoute(descriptor.route, "catalog-admission-route");
    requirePrefixedSha256(descriptor.sha256, "catalog-admission-descriptor");

    const qualification = requireExactObject(
      view.qualification,
      QUALIFICATION_FIELDS,
      "catalog-admission-view-qualification"
    );
    if (qualification.status !== "qualified" ||
        qualification.numericalStatus !== "passed" ||
        qualification.browserStatus !== "passed" ||
        qualification.qualityStatus !== "qualified") {
      reject("catalog-admission-view-qualification");
    }
    requirePrefixedSha256(
      qualification.receiptSha256,
      "catalog-admission-view-qualification"
    );
    const qualificationReceiptId = requirePrefixedSha256(
      qualification.receiptId,
      "catalog-admission-view-qualification"
    );
    const qualificationReceiptRoute = requireRoute(
      qualification.receiptRoute,
      "catalog-admission-view-qualification"
    );
    if (!Number.isSafeInteger(qualification.receiptBytes) ||
        qualification.receiptBytes < 2 ||
        qualification.receiptBytes > MAXIMUM_QUALIFICATION_RECEIPT_BYTES) {
      reject("catalog-admission-view-qualification");
    }
    const authority = requireExactObject(
      view.catalogAuthority,
      CATALOG_AUTHORITY_FIELDS,
      "catalog-admission-view-authority"
    );
    requireText(authority.catalogId, 128, "catalog-admission-view-authority");
    if (!Number.isSafeInteger(authority.revision) || authority.revision < 1) {
      reject("catalog-admission-view-authority");
    }
    const generated = Date.parse(authority.generatedAtUtc);
    const validUntil = Date.parse(authority.validUntilUtc);
    if (!Number.isFinite(generated) || !Number.isFinite(validUntil) ||
        validUntil <= generated) {
      reject("catalog-admission-view-authority");
    }
    return Object.freeze({
      modelId: source.repository,
      compositionId: composition.compositionId,
      members: Object.freeze(MEMBER_NAMES.map(
        // Copies members into the contract's canonical semantic order.
        (name) => members.get(name)
      )),
      descriptor: Object.freeze({
        schema: descriptor.schema,
        route: descriptor.route,
        bytes: descriptor.bytes,
        sha256: descriptor.sha256
      }),
      qualificationReceiptId,
      qualificationReceiptRoute,
      qualificationReceiptBytes: qualification.receiptBytes,
      qualificationReceiptSha256: qualification.receiptSha256,
      catalogAuthority: Object.freeze({
        catalogId: authority.catalogId,
        revision: authority.revision,
        generatedAtUtc: authority.generatedAtUtc,
        validUntilUtc: authority.validUntilUtc
      })
    });
  }

  // Resolves an admission route while enforcing same-origin HTTP(S) retrieval.
  function resolveAdmissionUrl(catalogBaseUrl, route) {
    if (typeof catalogBaseUrl !== "string" || catalogBaseUrl.length < 1 ||
        catalogBaseUrl !== catalogBaseUrl.trim()) {
      reject("catalog-admission-base-url");
    }
    let base;
    let resolved;
    try {
      base = new URL(catalogBaseUrl);
      resolved = new URL(requireRoute(route, "catalog-admission-route"), base);
    } catch (error) {
      if (error instanceof CatalogAdmissionLoaderError) {
        throw error;
      }
      reject("catalog-admission-base-url");
    }
    if (!["http:", "https:"].includes(base.protocol) ||
        base.username || base.password || base.hash ||
        resolved.origin !== base.origin || resolved.username || resolved.password ||
        resolved.hash || resolved.search) {
      reject("catalog-admission-origin");
    }
    return resolved.toString();
  }

  // Requires Content-Length to be canonical, bounded, and equal to the descriptor.
  function declaredLength(response, expectedBytes, maximumBytes, codePrefix) {
    let header;
    try {
      if (!response || !response.headers ||
          typeof response.headers.get !== "function") {
        reject(`${codePrefix}-declared-length`);
      }
      header = response.headers.get("content-length");
    } catch (error) {
      if (error instanceof CatalogAdmissionLoaderError) {
        throw error;
      }
        reject(`${codePrefix}-declared-length`);
    }
    if (typeof header !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(header)) {
      reject(`${codePrefix}-declared-length`);
    }
    const value = Number(header);
    if (!Number.isSafeInteger(value) || value < 1 ||
        value > maximumBytes || value !== expectedBytes) {
      reject(`${codePrefix}-declared-length`);
    }
    return value;
  }

  // Best-effort cancels a rejected response stream without masking its verdict.
  function cancelReader(reader) {
    try {
      const pending = reader.cancel();
      if (pending && typeof pending.catch === "function") {
        pending.catch(
          // Consumes asynchronous cancellation failures after the primary rejection.
          () => {}
        );
      }
    } catch (_error) {
      // The response is already rejected; cancellation is best-effort.
    }
  }

  // Streams exactly the declared bytes into one bounded buffer and rejects drift.
  async function readActualBytes(response, expectedBytes, codePrefix, lifetime) {
    let body;
    try {
      body = response.body;
    } catch (_error) {
      reject(`${codePrefix}-actual-length`);
    }
    if (body && typeof body.getReader === "function") {
      let reader;
      try {
        reader = body.getReader();
      } catch (_error) {
        reject(`${codePrefix}-actual-length`);
      }
      if (!reader || typeof reader.read !== "function") {
        reject(`${codePrefix}-actual-length`);
      }
      const output = new Uint8Array(expectedBytes);
      let offset = 0;
      let chunks = 0;
      try {
        while (true) {
          const item = await lifetime.wait(() => reader.read());
          if (!isPlainObject(item) || typeof item.done !== "boolean") {
            reject(`${codePrefix}-actual-length`);
          }
          if (item.done) {
            break;
          }
          chunks += 1;
          if (chunks > MAXIMUM_RESPONSE_CHUNKS || !ArrayBuffer.isView(item.value)) {
            reject(`${codePrefix}-actual-length`);
          }
          const chunk = new Uint8Array(
            item.value.buffer,
            item.value.byteOffset,
            item.value.byteLength
          );
          if (chunk.byteLength > expectedBytes - offset) {
            reject(`${codePrefix}-actual-length`);
          }
          output.set(chunk, offset);
          offset += chunk.byteLength;
        }
      } catch (error) {
        cancelReader(reader);
        if (error instanceof CatalogAdmissionLoaderError) {
          throw error;
        }
        reject(`${codePrefix}-actual-length`);
      } finally {
        try {
          if (typeof reader.releaseLock === "function") reader.releaseLock();
        } catch (_error) {
          // Release must not replace the original stream or cancellation verdict.
        }
      }
      if (offset !== expectedBytes) {
        reject(`${codePrefix}-actual-length`);
      }
      return output;
    }
    // A nonstreaming body cannot enforce the allocation bound before buffering.
    reject(`${codePrefix}-stream-required`);
  }

  // Fetches one exact catalog document under a no-redirect, no-credential policy.
  async function fetchExactBytes(
    fetchFunction,
    url,
    expectedBytes,
    maximumBytes,
    codePrefix,
    lifetime
  ) {
    let response;
    try {
      response = await lifetime.wait(() => fetchFunction(url, {
        method: "GET",
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal: lifetime.signal
      }));
    } catch (error) {
      if (error instanceof CatalogAdmissionLoaderError) throw error;
      reject(`${codePrefix}-fetch`);
    }
    try {
      if (!response || response.ok !== true || response.redirected === true) {
        reject(`${codePrefix}-fetch`);
      }
    } catch (error) {
      if (error instanceof CatalogAdmissionLoaderError) {
        throw error;
      }
      reject(`${codePrefix}-fetch`);
    }
    declaredLength(response, expectedBytes, maximumBytes, codePrefix);
    return readActualBytes(response, expectedBytes, codePrefix, lifetime);
  }

  // Encodes digest bytes as canonical lowercase hexadecimal text.
  function bytesToHex(value) {
    let output = "";
    for (const byte of value) {
      output += byte.toString(16).padStart(2, "0");
    }
    return output;
  }

  // Hashes bytes through the supplied test hook or bound Web Crypto implementation.
  async function hashBytes(options, bytes, code) {
    if (options.hashFunction) {
      let value;
      try {
        value = await options.lifetime.wait(() => options.hashFunction(bytes.slice()));
      } catch (error) {
        if (error instanceof CatalogAdmissionLoaderError) throw error;
        reject(code);
      }
      return requireRawSha256(value, code);
    }
    let digest;
    try {
      digest = await options.lifetime.wait(() => options.digestFunction("SHA-256", bytes));
    } catch (error) {
      if (error instanceof CatalogAdmissionLoaderError) throw error;
      reject(code);
    }
    if (!(digest instanceof ArrayBuffer) || digest.byteLength !== 32) {
      reject(code);
    }
    return bytesToHex(new Uint8Array(digest));
  }

  // Decodes one validated raw SHA-256 string into exactly 32 bytes.
  function hexToBytes(value, code) {
    const normalized = requireRawSha256(value, code);
    const output = new Uint8Array(32);
    for (let index = 0; index < output.length; index += 1) {
      output[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
    }
    return output;
  }

  // Writes a nonnegative safe integer as little-endian unsigned 64-bit framing.
  function writeSafeUint64(view, offset, value, code) {
    if (!Number.isSafeInteger(value) || value < 0) {
      reject(code);
    }
    const radix = 0x100000000;
    view.setUint32(offset, value % radix, true);
    view.setUint32(offset + 4, Math.floor(value / radix), true);
  }

  // Reconstructs the five resolved-member ACG2 records in canonical role order.
  function acg2MemberTable(artifacts) {
    const bytes = new Uint8Array(ACG2_MEMBER_COUNT * ACG2_MEMBER_RECORD_BYTES);
    const view = new DataView(bytes.buffer);
    for (let index = 0; index < ACG2_MEMBER_COUNT; index += 1) {
      const artifact = artifacts[index];
      const offset = index * ACG2_MEMBER_RECORD_BYTES;
      view.setUint16(offset, 1, true);
      view.setUint16(offset + 2, index + 1, true);
      view.setUint16(offset + 4, index + 1, true);
      view.setUint32(offset + 8, index, true);
      writeSafeUint64(
        view,
        offset + 16,
        artifact.byteCount,
        "catalog-admission-composition"
      );
      bytes.set(
        hexToBytes(artifact.sha256, "catalog-admission-composition"),
        offset + 24
      );
      bytes.set(
        hexToBytes(artifact.formatProfileSha256, "catalog-admission-composition"),
        offset + 56
      );
    }
    return bytes;
  }

  // Frames the canonical ACG2 graph-hash input around a verified member table.
  function acg2GraphInput(memberTable, resolvedMemberBytes) {
    let domain;
    try {
      domain = new TextEncoder().encode(ACG2_GRAPH_DOMAIN);
    } catch (_error) {
      reject("catalog-admission-composition");
    }
    const framing = new Uint8Array(17);
    const view = new DataView(framing.buffer);
    view.setUint16(0, 2, true);
    view.setUint16(2, 0, true);
    view.setUint8(4, 1);
    view.setUint32(5, ACG2_MEMBER_COUNT, true);
    writeSafeUint64(
      view,
      9,
      resolvedMemberBytes,
      "catalog-admission-composition"
    );
    const result = new Uint8Array(domain.byteLength + framing.byteLength + memberTable.byteLength);
    result.set(domain, 0);
    result.set(framing, domain.byteLength);
    result.set(memberTable, domain.byteLength + framing.byteLength);
    return result;
  }

  // Invokes the strict synchronous parser and normalizes parser failures to one code.
  function parseCanonicalAdmission(parseAdmissionText, text) {
    let admission;
    try {
      admission = parseAdmissionText(text);
    } catch (_error) {
      reject("catalog-admission-canonical");
    }
    if (admission && typeof admission.then === "function") {
      reject("catalog-admission-canonical");
    }
    return admission;
  }

  // Parses one receipt with the catalog contract's duplicate-key-safe canonical parser.
  function parseCanonicalQualificationReceipt(text) {
    try {
      return catalogApi.parseCanonicalJsonText(text, MAXIMUM_QUALIFICATION_RECEIPT_BYTES);
    } catch (_error) {
      reject("catalog-qualification-canonical");
    }
  }

  // Independently binds admission members, graph identity, and receipt ID to catalog facts.
  async function bindAdmission(catalog, admissionValue, options) {
    const admission = requireExactObject(
      admissionValue,
      ADMISSION_FIELDS,
      "catalog-admission-canonical"
    );
    if (admission.schema !== ADMISSION_SCHEMA ||
        admission.modelId !== catalog.modelId) {
      reject("catalog-admission-model");
    }
    requireRawSha256(admission.operationId, "catalog-admission-canonical");
    if (!Array.isArray(admission.artifacts) ||
        admission.artifacts.length !== MEMBER_NAMES.length) {
      reject("catalog-admission-members");
    }
    requireDenseArray(
      admission.artifacts,
      MEMBER_NAMES.length,
      "catalog-admission-members"
    );

    let resolvedMemberBytes = 0;
    for (let index = 0; index < MEMBER_NAMES.length; index += 1) {
      const artifact = requireExactObject(
        admission.artifacts[index],
        ARTIFACT_FIELDS,
        "catalog-admission-members"
      );
      const name = MEMBER_NAMES[index];
      const member = catalog.members[index];
      if (artifact.role !== MEMBER_ROLES[index] ||
          artifact.format !== MEMBER_FORMATS[index] ||
          artifact.fileName !== name ||
          !Number.isSafeInteger(artifact.byteCount) ||
          artifact.byteCount !== member.bytes ||
          `sha256:${requireRawSha256(artifact.sha256, "catalog-admission-members")}` !==
            member.sha256 ||
          artifact.formatProfileSha256 !== MEMBER_PROFILE_SHA256[index]) {
        reject("catalog-admission-members");
      }
      if (index < MEMBER_NAMES.length - 1) {
        resolvedMemberBytes += member.bytes;
      }
    }
    if (!Number.isSafeInteger(resolvedMemberBytes)) {
      reject("catalog-admission-members");
    }

    const composition = requireExactObject(
      admission.composition,
      ADMISSION_COMPOSITION_FIELDS,
      "catalog-admission-composition"
    );
    const graphIdentitySha256 = requireRawSha256(
      composition.graphIdentitySha256,
      "catalog-admission-composition"
    );
    const memberTableSha256 = requireRawSha256(
      composition.memberTableSha256,
      "catalog-admission-composition"
    );
    if (!Number.isSafeInteger(composition.resolvedMemberBytes) ||
        composition.resolvedMemberBytes !== resolvedMemberBytes) {
      reject("catalog-admission-composition");
    }
    const memberTable = acg2MemberTable(admission.artifacts);
    if (await hashBytes(
      options,
      memberTable,
      "catalog-admission-composition"
    ) !== memberTableSha256 || await hashBytes(
      options,
      acg2GraphInput(memberTable, resolvedMemberBytes),
      "catalog-admission-composition"
    ) !== graphIdentitySha256 ||
        `sha256:${graphIdentitySha256}` !== catalog.compositionId) {
      reject("catalog-admission-composition");
    }

    const qualification = requireExactObject(
      admission.qualification,
      ADMISSION_QUALIFICATION_FIELDS,
      "catalog-admission-qualification"
    );
    if (requirePrefixedSha256(
      qualification.receiptId,
      "catalog-admission-qualification"
    ) !== catalog.qualificationReceiptId ||
        !["general-assistant-qualified", "task-specific-qualified"].includes(
          qualification.qualityClaim
        ) || typeof qualification.qualityScope !== "string" ||
        qualification.qualityScope.length < 1) {
      reject("catalog-admission-qualification");
    }
    return admission;
  }

  // Recomputes the complete receipt-to-admission binding instead of trusting labels.
  function bindQualificationReceipt(catalog, admission, receiptValue) {
    const receipt = requireExactObject(
      receiptValue,
      QUALIFICATION_RECEIPT_FIELDS,
      "catalog-qualification-canonical"
    );
    if (receipt.schema !== QUALIFICATION_RECEIPT_SCHEMA ||
        requirePrefixedSha256(receipt.receiptId, "catalog-qualification-receipt") !==
          catalog.qualificationReceiptId ||
        receipt.receiptId !== admission.qualification.receiptId ||
        receipt.modelId !== admission.modelId ||
        requireRawSha256(receipt.operationId, "catalog-qualification-receipt") !==
          admission.operationId ||
        requirePrefixedSha256(receipt.compositionId, "catalog-qualification-receipt") !==
          catalog.compositionId ||
        receipt.sourceEvidenceSha256 !== admission.qualification.sourceEvidenceSha256 ||
        receipt.structuralEvidenceSha256 !==
          admission.qualification.structuralEvidenceSha256 ||
        receipt.numericalEvidenceSha256 !== admission.qualification.numericalEvidenceSha256 ||
        receipt.qualityEvidenceSha256 !== admission.qualification.qualityEvidenceSha256 ||
        receipt.evalCasesSha256 !== admission.qualification.evalCasesSha256 ||
        receipt.qualityClaim !== admission.qualification.qualityClaim ||
        receipt.qualityScope !== admission.qualification.qualityScope ||
        receipt.numericalStatus !== "passed" ||
        receipt.browserStatus !== "passed" ||
        receipt.qualityStatus !== "qualified") {
      reject("catalog-qualification-binding");
    }
    for (const field of [
      "sourceEvidenceSha256",
      "structuralEvidenceSha256",
      "numericalEvidenceSha256",
      "qualityEvidenceSha256",
      "evalCasesSha256"
    ]) {
      requireRawSha256(receipt[field], "catalog-qualification-receipt");
    }
    requireText(receipt.modelId, 160, "catalog-qualification-receipt");
    requireText(receipt.qualityClaim, 64, "catalog-qualification-receipt");
    requireText(receipt.qualityScope, 256, "catalog-qualification-receipt");
    const issuedAtUtc = requireUtc(receipt.issuedAtUtc, "catalog-qualification-receipt");
    if (Date.parse(issuedAtUtc) > Date.parse(catalog.catalogAuthority.generatedAtUtc)) {
      reject("catalog-qualification-binding");
    }
    return receipt;
  }

  // Recursively snapshots plain data while rejecting cycles, accessors, and exotic values.
  function frozenCopy(value, active = new Set()) {
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
      return value;
    }
    if (active.has(value)) {
      reject("catalog-admission-snapshot");
    }
    active.add(value);
    if (Array.isArray(value)) {
      requireDenseArray(value, value.length, "catalog-admission-snapshot");
      const descriptors = Object.getOwnPropertyDescriptors(value);
      const result = Object.freeze(Array.from(
        { length: value.length },
        // Copies each descriptor value without invoking inherited array behavior.
        (_unused, index) => frozenCopy(descriptors[String(index)].value, active)
      ));
      active.delete(value);
      return result;
    }
    if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length !== 0) {
      reject("catalog-admission-snapshot");
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const result = {};
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (!Object.hasOwn(descriptor, "value") || descriptor.get || descriptor.set) {
        reject("catalog-admission-snapshot");
      }
      Object.defineProperty(result, key, {
        value: frozenCopy(descriptor.value, active),
        enumerable: true,
        configurable: false,
        writable: false
      });
    }
    active.delete(value);
    return Object.freeze(result);
  }

  // Loads, authenticates, parses, binds, and freezes one catalog admission document.
  async function load(optionsValue) {
    const options = normalizeOptions(optionsValue);
    const catalog = normalizeCatalogView(options.catalogView);
    const lifetime = createLifetime(options);
    let failure = null;
    try {
      return await loadDocuments({ ...options, lifetime }, catalog);
    } catch (error) {
      failure = error;
      throw error;
    } finally {
      lifetime.dispose(failure);
    }
  }

  // Bind both streamed documents under the same operation lifetime and byte limits.
  async function loadDocuments(options, catalog) {
    const receiptUrl = resolveAdmissionUrl(
      options.catalogBaseUrl,
      catalog.qualificationReceiptRoute
    );
    const receiptBytes = await fetchExactBytes(
      options.fetchFunction,
      receiptUrl,
      catalog.qualificationReceiptBytes,
      MAXIMUM_QUALIFICATION_RECEIPT_BYTES,
      "catalog-qualification",
      options.lifetime
    );
    const receiptDigest = await hashBytes(
      options,
      receiptBytes,
      "catalog-qualification-sha256"
    );
    if (`sha256:${receiptDigest}` !== catalog.qualificationReceiptSha256) {
      reject("catalog-qualification-sha256");
    }
    let receiptText;
    try {
      receiptText = new TextDecoder("utf-8", { fatal: true }).decode(receiptBytes);
    } catch (_error) {
      reject("catalog-qualification-utf8");
    }
    const receipt = frozenCopy(parseCanonicalQualificationReceipt(receiptText));

    const url = resolveAdmissionUrl(options.catalogBaseUrl, catalog.descriptor.route);
    const bytes = await fetchExactBytes(
      options.fetchFunction,
      url,
      catalog.descriptor.bytes,
      MAXIMUM_ADMISSION_BYTES,
      "catalog-admission",
      options.lifetime
    );
    const digest = await hashBytes(options, bytes, "catalog-admission-sha256");
    if (`sha256:${digest}` !== catalog.descriptor.sha256) {
      reject("catalog-admission-sha256");
    }
    let admissionText;
    try {
      admissionText = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (_error) {
      reject("catalog-admission-utf8");
    }
    const admission = frozenCopy(parseCanonicalAdmission(
      options.parseAdmissionText,
      admissionText
    ));
    await bindAdmission(catalog, admission, options);
    bindQualificationReceipt(catalog, admission, receipt);
    return Object.freeze({
      admission,
      admissionText,
      admissionSha256: catalog.descriptor.sha256,
      qualificationReceipt: receipt,
      qualificationReceiptText: receiptText,
      qualificationReceiptSha256: catalog.qualificationReceiptSha256
    });
  }

  return Object.freeze({
    admissionSchema: ADMISSION_SCHEMA,
    qualificationReceiptSchema: QUALIFICATION_RECEIPT_SCHEMA,
    maximumAdmissionBytes: MAXIMUM_ADMISSION_BYTES,
    maximumQualificationReceiptBytes: MAXIMUM_QUALIFICATION_RECEIPT_BYTES,
    memberNames: MEMBER_NAMES,
    CatalogAdmissionLoaderError,
    resolveAdmissionUrl,
    load
  });
}));
