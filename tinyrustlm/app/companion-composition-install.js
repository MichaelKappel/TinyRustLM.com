// Publishes the installer through CommonJS or the browser global without changing its API.
(function (root, factory) {
  "use strict";
  const admissionApi = typeof module === "object" && module.exports
    ? require("./browser-model-admission.js")
    : root.TinyRustLMBrowserModelAdmission;
  const api = factory(root, admissionApi);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.TinyRustLMCompanionCompositionInstall = api;
  }
}(typeof globalThis === "object" ? globalThis : this,
// Builds the installer against explicit host primitives and the admission authority.
function (root, admissionApi) {
  "use strict";

  const PROJECTION_SCHEMA = "tinyrustlm.companion.loopback.operation-projection.v2";
  const ADMISSION_SCHEMA = "tinyrustlm.browser-composition-admission/1";
  const STORE_MANIFEST_SCHEMA = "tinyrustlm.model-composition-store.manifest/2";
  const MAXIMUM_CHUNK_BYTES = 4 * 1024 * 1024;
  const MAXIMUM_ARTIFACT_BYTES = 64 * 1024 * 1024 * 1024;
  const MAXIMUM_TOTAL_CHUNKS = 6 * 16384;
  const MAXIMUM_AUTHORITY_BYTES = 1024 * 1024;
  const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
  const PROJECTION_FIELDS = Object.freeze([
    "schema",
    "operationId",
    "sequence",
    "state",
    "route",
    "phaseCompletedBytes",
    "phaseTotalBytes",
    "artifacts",
    "errorCode"
  ]);
  const COMPANION_ROLES = Object.freeze([
    "composition", "model", "tokenizer", "template", "sampling", "prompt"
  ]);
  const ARTIFACT_FIELDS = Object.freeze([
    "kind", "artifactId", "sha256", "byteCount"
  ]);
  const CHUNK_FIELDS = Object.freeze(["bytes", "metadata", "contentSha256"]);
  const CHUNK_METADATA_FIELDS = Object.freeze([
    "operationId",
    "artifactRole",
    "artifactId",
    "artifactSha256",
    "artifactBytes",
    "chunkIndex",
    "chunkCount",
    "chunkOffset",
    "chunkBytes"
  ]);
  const MANIFEST_FIELDS = Object.freeze(["schema", "admissionAuthority", "members"]);
  const MANIFEST_AUTHORITY_FIELDS = Object.freeze([
    "admission", "qualificationReceipt", "catalog", "p2pPieceSetSha256"
  ]);
  const MANIFEST_DESCRIPTOR_FIELDS = Object.freeze(["byteLength", "sha256"]);
  const MANIFEST_MEMBER_FIELDS = Object.freeze(["fileName", "byteLength", "sha256"]);
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
  const ACTIVATED_FIELDS = Object.freeze([
    "manifestSha256",
    "admissionAuthoritySha256",
    "activationId",
    "manifest",
    "admissionAuthority",
    "streamMember",
    "withRead"
  ]);
  const OPENED_AUTHORITY_FIELDS = Object.freeze([
    "admission",
    "admissionText",
    "admissionSha256",
    "qualificationReceipt",
    "qualificationReceiptText",
    "qualificationReceiptSha256",
    "catalogDocument",
    "catalogText",
    "catalogAuthority",
    "p2pPieceSetSha256"
  ]);
  const ROLE_SPECS = Object.freeze([
    Object.freeze({ role: "model", kind: "slm2", fileName: "model.slm2" }),
    Object.freeze({
      role: "tokenizer", kind: "tokenizer2", fileName: "tokenizer.tokenizer2"
    }),
    Object.freeze({
      role: "template", kind: "template2", fileName: "template.template2"
    }),
    Object.freeze({
      role: "sampling", kind: "sampling2", fileName: "sampling.sampling2"
    }),
    Object.freeze({ role: "prompt", kind: "prompt2", fileName: "prompt.prompt2" }),
    Object.freeze({
      role: "composition", kind: "acg2", fileName: "composition.acg2"
    })
  ]);

  class CompanionCompositionInstallError extends Error {
    // Preserves a stable typed code plus bounded role, chunk, and causal context.
    constructor(code, details) {
      super(code);
      this.name = "CompanionCompositionInstallError";
      this.code = code;
      if (details && details.role) this.role = details.role;
      if (details && Number.isInteger(details.chunkIndex)) {
        this.chunkIndex = details.chunkIndex;
      }
      if (details && details.cause !== undefined) this.cause = details.cause;
    }
  }

  // Raises a typed fail-closed rejection at the point an invariant is violated.
  function reject(code, details) {
    throw new CompanionCompositionInstallError(code, details);
  }

  // Retains installer errors and wraps foreign failures with a stable boundary code.
  function typed(error, code, details) {
    if (error instanceof CompanionCompositionInstallError) return error;
    return new CompanionCompositionInstallError(code, { ...details, cause: error });
  }

  // Accepts only records with the ordinary or null object prototype.
  function isPlainObject(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  // Enforces an exact own-data-property schema without invoking accessors.
  function exactObject(value, fields, code, details) {
    if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length !== 0) {
      reject(code, details);
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Object.keys(descriptors);
    if (keys.length !== fields.length ||
        // Detects any required field omitted from the descriptor set.
        fields.some((field) => !Object.hasOwn(descriptors, field)) ||
        // Rejects additional string-keyed fields outside the closed schema.
        keys.some((field) => !fields.includes(field))) {
      reject(code, details);
    }
    for (const field of fields) {
      const descriptor = descriptors[field];
      if (!Object.hasOwn(descriptor, "value") || descriptor.get || descriptor.set) {
        reject(code, details);
      }
    }
    return value;
  }

  // Validates a bounded nonnegative interoperable integer.
  function uint(value, maximum, code, details) {
    if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
      reject(code, details);
    }
    return value;
  }

  // Validates a lowercase, nonzero SHA-256 hexadecimal identity.
  function sha256(value, code, details) {
    if (typeof value !== "string" || !SHA256_PATTERN.test(value) || /^0{64}$/u.test(value)) {
      reject(code, details);
    }
    return value;
  }

  // Normalizes an optional AbortSignal-compatible object without accepting lookalikes.
  function normalizeSignal(value) {
    if (value === undefined || value === null) return null;
    if (typeof value !== "object" || typeof value.aborted !== "boolean" ||
        typeof value.addEventListener !== "function" ||
        typeof value.removeEventListener !== "function") {
      reject("companion-composition-install-signal");
    }
    return value;
  }

  // Converts an observed abort into the installer's stable cancellation verdict.
  function checkCancelled(signal, details) {
    if (signal && signal.aborted) {
      reject("companion-composition-install-aborted", details);
    }
  }

  // Races asynchronous work against cancellation and always detaches its listener.
  function waitWithCancellation(promise, signal, details) {
    if (!signal) return Promise.resolve(promise);
    checkCancelled(signal, details);
    // Owns the temporary abort listener until the wrapped operation settles.
    return new Promise((resolve, rejectPromise) => {
      // Rejects immediately when the caller aborts the in-flight operation.
      const onAbort = () => rejectPromise(new CompanionCompositionInstallError(
        "companion-composition-install-aborted",
        details
      ));
      signal.addEventListener("abort", onAbort, { once: true });
      Promise.resolve(promise).then(
        // Resolves the original value after cancellation cleanup.
        (value) => {
          signal.removeEventListener("abort", onAbort);
          resolve(value);
        },
        // Propagates the original failure after cancellation cleanup.
        (error) => {
          signal.removeEventListener("abort", onAbort);
          rejectPromise(error);
        }
      );
    });
  }

  // Validates and freezes the companion's available-operation projection.
  function normalizeProjection(value) {
    exactObject(value, PROJECTION_FIELDS, "companion-composition-install-projection");
    if (value.schema !== PROJECTION_SCHEMA || value.route !== "source" ||
        value.errorCode !== null) {
      reject("companion-composition-install-projection");
    }
    if (value.state !== "available") {
      reject("companion-composition-install-projection-state");
    }
    const operationId = sha256(
      value.operationId,
      "companion-composition-install-projection"
    );
    const sequence = uint(
      value.sequence,
      1000000,
      "companion-composition-install-projection"
    );
    const phaseCompletedBytes = uint(
      value.phaseCompletedBytes,
      Number.MAX_SAFE_INTEGER,
      "companion-composition-install-projection"
    );
    const phaseTotalBytes = value.phaseTotalBytes === null
      ? null
      : uint(
        value.phaseTotalBytes,
        Number.MAX_SAFE_INTEGER,
        "companion-composition-install-projection"
      );
    if (phaseTotalBytes !== null &&
        (phaseTotalBytes === 0 || phaseCompletedBytes > phaseTotalBytes)) {
      reject("companion-composition-install-projection");
    }
    exactObject(
      value.artifacts,
      COMPANION_ROLES,
      "companion-composition-install-projection-roles"
    );
    const artifacts = {};
    let totalChunks = 0;
    for (const role of COMPANION_ROLES) {
      const details = { role };
      const artifact = exactObject(
        value.artifacts[role],
        ARTIFACT_FIELDS,
        "companion-composition-install-projection-artifact",
        details
      );
      // Resolves the one authoritative role specification for this artifact.
      const spec = ROLE_SPECS.find((candidate) => candidate.role === role);
      const digest = sha256(
        artifact.sha256,
        "companion-composition-install-projection-artifact",
        details
      );
      const byteCount = uint(
        artifact.byteCount,
        MAXIMUM_ARTIFACT_BYTES,
        "companion-composition-install-projection-artifact",
        details
      );
      if (artifact.kind !== spec.kind || artifact.artifactId !== `sha256:${digest}` ||
          byteCount === 0) {
        reject("companion-composition-install-projection-artifact", details);
      }
      totalChunks += Math.ceil(byteCount / MAXIMUM_CHUNK_BYTES);
      if (!Number.isSafeInteger(totalChunks) || totalChunks > MAXIMUM_TOTAL_CHUNKS) {
        reject("companion-composition-install-projection-artifact", details);
      }
      artifacts[role] = Object.freeze({
        kind: spec.kind,
        artifactId: artifact.artifactId,
        sha256: digest,
        byteCount
      });
    }
    return Object.freeze({
      schema: PROJECTION_SCHEMA,
      operationId,
      sequence,
      state: "available",
      route: "source",
      phaseCompletedBytes,
      phaseTotalBytes,
      artifacts: Object.freeze(artifacts),
      errorCode: null
    });
  }

  // Creates the host UTF-8 encoder required for canonical receipt bytes.
  function textEncoder() {
    if (!root || typeof root.TextEncoder !== "function") {
      reject("companion-composition-install-text-codec");
    }
    return new root.TextEncoder();
  }

  // Encodes digest bytes as deterministic lowercase hexadecimal text.
  function bytesToHex(bytes) {
    let result = "";
    for (const byte of bytes) result += byte.toString(16).padStart(2, "0");
    return result;
  }

  // Computes SHA-256 through the host Web Crypto implementation and checks its width.
  async function sha256Hex(bytes) {
    if (!(bytes instanceof Uint8Array)) {
      reject("companion-composition-install-sha256");
    }
    const cryptoValue = root && root.crypto;
    if (!cryptoValue || !cryptoValue.subtle ||
        typeof cryptoValue.subtle.digest !== "function") {
      reject("companion-composition-install-sha256");
    }
    let digest;
    try {
      digest = await cryptoValue.subtle.digest("SHA-256", bytes);
    } catch (error) {
      throw typed(error, "companion-composition-install-sha256");
    }
    const digestBytes = new Uint8Array(digest);
    if (digestBytes.byteLength !== 32) {
      reject("companion-composition-install-sha256");
    }
    return bytesToHex(digestBytes);
  }

  // Serializes a JSON value as the newline-terminated bytes used for identity binding.
  function canonicalBytes(value) {
    return textEncoder().encode(`${JSON.stringify(value)}\n`);
  }

  // Delegates admission parsing to the pinned authority and normalizes its failures.
  function normalizeAdmission(value) {
    if (!admissionApi || typeof admissionApi.normalizeAdmission !== "function" ||
        typeof admissionApi.serializeAdmission !== "function" ||
        admissionApi.schema !== ADMISSION_SCHEMA) {
      reject("companion-composition-install-admission-authority");
    }
    try {
      return admissionApi.normalizeAdmission(value);
    } catch (error) {
      throw typed(error, "companion-composition-install-admission");
    }
  }

  // Requires every projected artifact to exactly match its admitted semantic member.
  function bindAdmission(projection, admission) {
    // Qualification and fresh acquisition operations are distinct identities.
    for (let index = 0; index < ROLE_SPECS.length; index += 1) {
      const spec = ROLE_SPECS[index];
      const admitted = admission.artifacts[index];
      const projected = projection.artifacts[spec.role];
      if (!admitted || admitted.role !== spec.role || admitted.format !== spec.kind ||
          admitted.fileName !== spec.fileName ||
          projected.artifactId !== `sha256:${admitted.sha256}` ||
          projected.sha256 !== admitted.sha256 ||
          projected.byteCount !== admitted.byteCount) {
        reject("companion-composition-install-artifact-drift", { role: spec.role });
      }
    }
  }

  // Copies the store manifest while binding every descriptor to the admitted composition.
  function normalizeManifest(value, admission, admissionBytes, admissionSha256) {
    exactObject(value, MANIFEST_FIELDS, "companion-composition-install-manifest");
    if (value.schema !== STORE_MANIFEST_SCHEMA || !Array.isArray(value.members) ||
        value.members.length !== ROLE_SPECS.length) {
      reject("companion-composition-install-manifest");
    }
    const authority = exactObject(
      value.admissionAuthority,
      MANIFEST_AUTHORITY_FIELDS,
      "companion-composition-install-manifest"
    );
    const descriptor = (source, maximumBytes) => {
      exactObject(
        source,
        MANIFEST_DESCRIPTOR_FIELDS,
        "companion-composition-install-manifest"
      );
      const byteLength = uint(
        source.byteLength,
        maximumBytes,
        "companion-composition-install-manifest"
      );
      if (byteLength === 0) reject("companion-composition-install-manifest");
      return Object.freeze({
        byteLength,
        sha256: sha256(source.sha256, "companion-composition-install-manifest")
      });
    };
    const admissionDescriptor = descriptor(
      authority.admission,
      admissionApi.maximumTextBytes
    );
    if (admissionDescriptor.byteLength !== admissionBytes.byteLength ||
        admissionDescriptor.sha256 !== admissionSha256 ||
        authority.p2pPieceSetSha256 !== null) {
      reject("companion-composition-install-manifest");
    }
    const members = value.members.map((member, index) => {
      const spec = ROLE_SPECS[index];
      const admitted = admission.artifacts[index];
      const details = { role: spec.role };
      exactObject(
        member,
        MANIFEST_MEMBER_FIELDS,
        "companion-composition-install-manifest",
        details
      );
      const byteLength = uint(
        member.byteLength,
        MAXIMUM_ARTIFACT_BYTES,
        "companion-composition-install-manifest",
        details
      );
      const digest = sha256(
        member.sha256,
        "companion-composition-install-manifest",
        details
      );
      if (!admitted || member.fileName !== spec.fileName || byteLength === 0 ||
          admitted.fileName !== spec.fileName || admitted.byteCount !== byteLength ||
          admitted.sha256 !== digest) {
        reject("companion-composition-install-manifest", details);
      }
      return Object.freeze({ fileName: spec.fileName, byteLength, sha256: digest });
    });
    return Object.freeze({
      schema: STORE_MANIFEST_SCHEMA,
      admissionAuthority: Object.freeze({
        admission: admissionDescriptor,
        qualificationReceipt: descriptor(
          authority.qualificationReceipt,
          MAXIMUM_AUTHORITY_BYTES
        ),
        catalog: descriptor(authority.catalog, MAXIMUM_AUTHORITY_BYTES),
        p2pPieceSetSha256: null
      }),
      members: Object.freeze(members)
    });
  }

  // Copies and binds the raw authority records that the store must persist with the bytes.
  async function normalizeAdmissionAuthority(value, manifest, admissionText) {
    exactObject(
      value,
      ADMISSION_AUTHORITY_INPUT_FIELDS,
      "companion-composition-install-admission-authority"
    );
    if (value.admissionText !== admissionText ||
        typeof value.qualificationReceiptText !== "string" ||
        typeof value.catalogText !== "string" ||
        value.p2pPieceSetSha256 !== null) {
      reject("companion-composition-install-admission-authority");
    }
    const receiptDescriptor = manifest.admissionAuthority.qualificationReceipt;
    const catalogDescriptor = manifest.admissionAuthority.catalog;
    if (value.qualificationReceiptText.length < 1 ||
        value.qualificationReceiptText.length > MAXIMUM_AUTHORITY_BYTES ||
        value.qualificationReceiptText.length > receiptDescriptor.byteLength ||
        value.catalogText.length < 1 ||
        value.catalogText.length > MAXIMUM_AUTHORITY_BYTES ||
        value.catalogText.length > catalogDescriptor.byteLength) {
      reject("companion-composition-install-admission-authority");
    }
    const receiptBytes = textEncoder().encode(value.qualificationReceiptText);
    const catalogBytes = textEncoder().encode(value.catalogText);
    if (receiptBytes.byteLength !== receiptDescriptor.byteLength ||
        catalogBytes.byteLength !== catalogDescriptor.byteLength ||
        await sha256Hex(receiptBytes) !== receiptDescriptor.sha256 ||
        await sha256Hex(catalogBytes) !== catalogDescriptor.sha256) {
      reject("companion-composition-install-admission-authority");
    }
    const catalogAuthority = exactObject(
      value.catalogAuthority,
      CATALOG_AUTHORITY_FIELDS,
      "companion-composition-install-admission-authority"
    );
    if (typeof catalogAuthority.id !== "string" || catalogAuthority.id.length < 1 ||
        catalogAuthority.id.length > 128 || !Number.isSafeInteger(catalogAuthority.revision) ||
        catalogAuthority.revision < 1 ||
        typeof catalogAuthority.generatedAtUtc !== "string" ||
        !Number.isFinite(Date.parse(catalogAuthority.generatedAtUtc)) ||
        typeof catalogAuthority.validUntilUtc !== "string" ||
        !Number.isFinite(Date.parse(catalogAuthority.validUntilUtc)) ||
        catalogAuthority.sha256 !== `sha256:${catalogDescriptor.sha256}`) {
      reject("companion-composition-install-admission-authority");
    }
    return Object.freeze({
      admissionText,
      qualificationReceiptText: value.qualificationReceiptText,
      catalogText: value.catalogText,
      catalogAuthority: Object.freeze({
        id: catalogAuthority.id,
        revision: catalogAuthority.revision,
        generatedAtUtc: catalogAuthority.generatedAtUtc,
        validUntilUtc: catalogAuthority.validUntilUtc,
        sha256: catalogAuthority.sha256
      }),
      p2pPieceSetSha256: null
    });
  }

  // Derives the immutable store manifest and all identities before fetching member bytes.
  async function buildInstallPlan(projection, admission, manifestValue, admissionAuthority) {
    let admissionText;
    try {
      admissionText = admissionApi.serializeAdmission(admission);
    } catch (error) {
      throw typed(error, "companion-composition-install-admission");
    }
    const admissionBytes = textEncoder().encode(admissionText);
    if (admissionBytes.byteLength < 1 ||
        admissionBytes.byteLength > admissionApi.maximumTextBytes) {
      reject("companion-composition-install-admission");
    }
    const admissionSha256 = await sha256Hex(admissionBytes);
    const manifest = normalizeManifest(
      manifestValue,
      admission,
      admissionBytes,
      admissionSha256
    );
    const normalizedAdmissionAuthority = await normalizeAdmissionAuthority(
      admissionAuthority,
      manifest,
      admissionText
    );
    return Object.freeze({
      projection,
      admission,
      admissionText,
      admissionAuthority: normalizedAdmissionAuthority,
      manifest,
      manifestSha256: await sha256Hex(canonicalBytes(manifest)),
      admissionAuthoritySha256: await sha256Hex(
        canonicalBytes(manifest.admissionAuthority)
      ),
      admissionSha256,
      // Totals admitted member lengths for bounded aggregate progress reporting.
      totalBytes: manifest.members.reduce((total, member) => total + member.byteLength, 0)
    });
  }

  // Requests one identity-bound chunk and maps transport failures into installer errors.
  async function requestChunk(client, plan, spec, chunkIndex, signal) {
    const artifact = plan.projection.artifacts[spec.role];
    const details = { role: spec.role, chunkIndex };
    const expectedArtifact = Object.freeze({
      artifactId: artifact.artifactId,
      sha256: artifact.sha256,
      byteCount: artifact.byteCount
    });
    let request;
    try {
      request = client.getArtifactChunk(
      plan.projection.operationId,
      spec.role,
      chunkIndex,
      expectedArtifact,
      signal || undefined
    );
    } catch (error) {
      throw typed(error, "companion-composition-install-chunk-request", details);
    }
    try {
      return await waitWithCancellation(request, signal, details);
    } catch (error) {
      throw typed(error, "companion-composition-install-chunk-request", details);
    }
  }

  // Verifies one chunk's closed metadata, continuity, length, and content digest.
  async function validateChunk(value, plan, spec, chunkIndex) {
    const details = { role: spec.role, chunkIndex };
    const response = exactObject(
      value,
      CHUNK_FIELDS,
      "companion-composition-install-chunk-shape",
      details
    );
    if (!(response.bytes instanceof Uint8Array) || response.bytes.byteLength === 0 ||
        response.bytes.byteLength > MAXIMUM_CHUNK_BYTES) {
      reject("companion-composition-install-chunk-shape", details);
    }
    const metadata = exactObject(
      response.metadata,
      CHUNK_METADATA_FIELDS,
      "companion-composition-install-chunk-shape",
      details
    );
    const artifact = plan.projection.artifacts[spec.role];
    const expectedChunkCount = Math.ceil(artifact.byteCount / MAXIMUM_CHUNK_BYTES);
    const expectedOffset = chunkIndex * MAXIMUM_CHUNK_BYTES;
    const expectedBytes = Math.min(
      MAXIMUM_CHUNK_BYTES,
      artifact.byteCount - expectedOffset
    );
    if (metadata.operationId !== plan.projection.operationId ||
        metadata.artifactRole !== spec.role ||
        metadata.artifactId !== artifact.artifactId ||
        metadata.artifactSha256 !== artifact.sha256 ||
        metadata.artifactBytes !== artifact.byteCount) {
      reject("companion-composition-install-chunk-drift", details);
    }
    if (metadata.chunkIndex !== chunkIndex ||
        metadata.chunkCount !== expectedChunkCount ||
        metadata.chunkOffset !== expectedOffset ||
        metadata.chunkBytes !== expectedBytes ||
        response.bytes.byteLength !== expectedBytes ||
        expectedOffset + expectedBytes > artifact.byteCount ||
        (chunkIndex + 1 === expectedChunkCount &&
          expectedOffset + expectedBytes !== artifact.byteCount)) {
      reject("companion-composition-install-chunk-continuity", details);
    }
    const contentSha256 = sha256(
      response.contentSha256,
      "companion-composition-install-chunk-content",
      details
    );
    if (await sha256Hex(response.bytes) !== contentSha256) {
      reject("companion-composition-install-chunk-content", details);
    }
    return response.bytes;
  }

  // Reports immutable progress while preserving cancellation and callback failures.
  async function reportProgress(callback, value, signal, details) {
    if (!callback) return;
    try {
      await waitWithCancellation(callback(Object.freeze(value)), signal, details);
    } catch (error) {
      throw typed(error, "companion-composition-install-progress");
    }
  }

  // Exposes ordered, one-shot member streams that fail closed after any partial transfer.
  function createSources(client, plan, signal, onProgress) {
    const sources = {};
    let expectedSourceIndex = 0;
    let activeRole = null;
    let transferFailed = false;
    let completedBytes = 0;

    for (let sourceIndex = 0; sourceIndex < ROLE_SPECS.length; sourceIndex += 1) {
      const spec = ROLE_SPECS[sourceIndex];
      let opened = false;

      // Streams exactly one artifact in contiguous verified chunks and records completion.
      async function* chunks() {
        const sourceDetails = { role: spec.role };
        if (transferFailed || activeRole !== null || expectedSourceIndex !== sourceIndex) {
          reject("companion-composition-install-source-order", sourceDetails);
        }
        activeRole = spec.role;
        let complete = false;
        let artifactCompletedBytes = 0;
        const artifact = plan.projection.artifacts[spec.role];
        const chunkCount = Math.ceil(artifact.byteCount / MAXIMUM_CHUNK_BYTES);
        try {
          for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
            const details = { role: spec.role, chunkIndex };
            checkCancelled(signal, details);
            const response = await requestChunk(
              client,
              plan,
              spec,
              chunkIndex,
              signal
            );
            checkCancelled(signal, details);
            const chunk = await validateChunk(response, plan, spec, chunkIndex);
            checkCancelled(signal, details);
            yield chunk;
            artifactCompletedBytes += chunk.byteLength;
            completedBytes += chunk.byteLength;
            await reportProgress(onProgress, {
              operationId: plan.projection.operationId,
              role: spec.role,
              fileName: spec.fileName,
              chunkIndex,
              chunkCount,
              artifactCompletedBytes,
              artifactTotalBytes: artifact.byteCount,
              completedBytes,
              totalBytes: plan.totalBytes
            }, signal, details);
          }
          if (artifactCompletedBytes !== artifact.byteCount) {
            reject("companion-composition-install-chunk-truncated", sourceDetails);
          }
          complete = true;
        } finally {
          activeRole = null;
          if (complete) {
            expectedSourceIndex += 1;
          } else {
            transferFailed = true;
          }
        }
      }

      sources[spec.fileName] = Object.freeze({
        // Opens this member once and enforces the global role-consumption order.
        [Symbol.asyncIterator]() {
          if (opened) {
            reject("companion-composition-install-source-reused", { role: spec.role });
          }
          opened = true;
          return chunks();
        }
      });
    }
    return Object.freeze(sources);
  }

  // Finds an installer error through a bounded, cycle-safe foreign cause chain.
  function findBridgeError(value) {
    const seen = new Set();
    let error = value;
    for (let depth = 0; depth < 8 && error && typeof error === "object"; depth += 1) {
      if (error instanceof CompanionCompositionInstallError) return error;
      if (seen.has(error)) return null;
      seen.add(error);
      error = error.cause;
    }
    return null;
  }

  // Confirms the store returned a deeply frozen manifest at the required depth.
  function frozenManifest(value) {
    return isPlainObject(value) && Object.isFrozen(value) &&
      isPlainObject(value.admissionAuthority) &&
      Object.isFrozen(value.admissionAuthority) &&
      isPlainObject(value.admissionAuthority.admission) &&
      Object.isFrozen(value.admissionAuthority.admission) &&
      isPlainObject(value.admissionAuthority.qualificationReceipt) &&
      Object.isFrozen(value.admissionAuthority.qualificationReceipt) &&
      isPlainObject(value.admissionAuthority.catalog) &&
      Object.isFrozen(value.admissionAuthority.catalog) &&
      Array.isArray(value.members) && Object.isFrozen(value.members) &&
      // Requires each member record to be an immutable plain data object.
      value.members.every((member) => isPlainObject(member) && Object.isFrozen(member));
  }

  // Revalidates the store's activation receipt against the precomputed install plan.
  function validateActivated(value, plan) {
    try {
      const activated = exactObject(
        value,
        ACTIVATED_FIELDS,
        "companion-composition-install-activation"
      );
      const authority = exactObject(
        activated.admissionAuthority,
        OPENED_AUTHORITY_FIELDS,
        "companion-composition-install-activation"
      );
      if (!Object.isFrozen(activated) ||
          activated.manifestSha256 !== plan.manifestSha256 ||
          activated.admissionAuthoritySha256 !== plan.admissionAuthoritySha256 ||
          !Object.isFrozen(authority) ||
          authority.admissionSha256 !== `sha256:${plan.admissionSha256}` ||
          authority.admissionText !== plan.admissionText ||
          authority.qualificationReceiptText !==
            plan.admissionAuthority.qualificationReceiptText ||
          authority.qualificationReceiptSha256 !==
            `sha256:${plan.manifest.admissionAuthority.qualificationReceipt.sha256}` ||
          authority.catalogText !== plan.admissionAuthority.catalogText ||
          !bytesEqual(
            canonicalBytes(authority.catalogAuthority),
            canonicalBytes(plan.admissionAuthority.catalogAuthority)
          ) ||
          authority.p2pPieceSetSha256 !== null ||
          typeof activated.streamMember !== "function" ||
          typeof activated.withRead !== "function") {
        reject("companion-composition-install-activation");
      }
      sha256(
        activated.activationId,
        "companion-composition-install-activation"
      );
      sha256(
        activated.admissionAuthoritySha256,
        "companion-composition-install-activation"
      );
      if (!frozenManifest(activated.manifest) ||
          !bytesEqual(canonicalBytes(activated.manifest), canonicalBytes(plan.manifest))) {
        reject("companion-composition-install-activation");
      }
      return activated;
    } catch (error) {
      throw typed(error, "companion-composition-install-activation");
    }
  }

  // Compares canonical byte sequences without text or encoding coercion.
  function bytesEqual(left, right) {
    if (left.byteLength !== right.byteLength) return false;
    for (let index = 0; index < left.byteLength; index += 1) {
      if (left[index] !== right[index]) return false;
    }
    return true;
  }

  // Validates the closed installer options object and its required capabilities.
  function normalizeOptions(value) {
    if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length !== 0) {
      reject("companion-composition-install-options");
    }
    const allowed = [
      "client", "store", "projection", "admission", "manifest",
      "admissionAuthority", "signal", "onProgress"
    ];
    const required = [
      "client", "store", "projection", "admission", "manifest", "admissionAuthority"
    ];
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Object.keys(descriptors);
    // Detects required capabilities omitted by the caller.
    if (required.some((field) => !Object.hasOwn(descriptors, field)) ||
        // Rejects option names outside the closed public contract.
        keys.some((field) => !allowed.includes(field)) ||
        // Rejects accessors so validation cannot execute caller-controlled getters.
        keys.some((field) => !Object.hasOwn(descriptors[field], "value") ||
          descriptors[field].get || descriptors[field].set) ||
        !value.client || typeof value.client.getArtifactChunk !== "function" ||
        !value.store || typeof value.store.install !== "function" ||
        (value.onProgress !== undefined && typeof value.onProgress !== "function")) {
      reject("companion-composition-install-options");
    }
    return value;
  }

  // Runs one fail-closed companion transfer through validation, storage, and activation.
  async function installCompanionComposition(value) {
    const options = normalizeOptions(value);
    const signal = normalizeSignal(options.signal);
    checkCancelled(signal);
    const projection = normalizeProjection(options.projection);
    const admission = normalizeAdmission(options.admission);
    bindAdmission(projection, admission);
    const plan = await buildInstallPlan(
      projection,
      admission,
      options.manifest,
      options.admissionAuthority
    );
    checkCancelled(signal);
    const sources = createSources(
      options.client,
      plan,
      signal,
      options.onProgress
    );
    let activated;
    try {
      activated = await options.store.install({
        manifest: plan.manifest,
        admissionAuthority: plan.admissionAuthority,
        sources,
        signal: signal || undefined
      });
    } catch (error) {
      const bridgeError = findBridgeError(error);
      if (bridgeError) throw bridgeError;
      if (signal && signal.aborted) {
        reject("companion-composition-install-aborted");
      }
      throw typed(error, "companion-composition-install-store");
    }
    return validateActivated(activated, plan);
  }

  return Object.freeze({
    CompanionCompositionInstallError,
    installCompanionComposition
  });
}));
