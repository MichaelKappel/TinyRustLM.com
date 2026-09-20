// Publishes the P2P composition installer through CommonJS or the browser global.
(function (root, factory) {
  "use strict";
  const admissionApi = typeof module === "object" && module.exports
    ? require("./browser-model-admission.js")
    : root.TinyRustLMBrowserModelAdmission;
  const catalogApi = typeof module === "object" && module.exports
    ? require("./minimodel-catalog-v1.js")
    : root.TinyRustLMMiniModelCatalogV1;
  const api = factory(root, admissionApi, catalogApi && catalogApi.directPeerUrlAuthority);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.TinyRustLMP2PCompositionInstall = api;
  }
}(typeof globalThis === "object" ? globalThis : this,
// Builds the installer against explicit browser and admission authorities.
function (root, admissionApi, directPeerUrlAuthority) {
  "use strict";

  if (!directPeerUrlAuthority ||
      typeof directPeerUrlAuthority.normalizeBaseUrl !== "function" ||
      typeof directPeerUrlAuthority.buildCompositionMemberUrl !== "function") {
    throw new Error("MiniModel direct peer URL authority is unavailable");
  }

  const ADMISSION_SCHEMA = "tinyrustlm.browser-composition-admission/1";
  const STORE_MANIFEST_SCHEMA = "tinyrustlm.model-composition-store.manifest/2";
  const PROTOCOL_PROFILE = "tinyrustlm.direct-composition-http.v1";
  const ROUTE_PREFIX = directPeerUrlAuthority.compositionRoutePrefix;
  const MEMBER_MEDIA_TYPE = "application/octet-stream";
  const DEFAULT_TIMEOUT_MILLISECONDS = 60 * 60 * 1000;
  const MAXIMUM_TIMEOUT_MILLISECONDS = 24 * 60 * 60 * 1000;
  const READER_CANCEL_TIMEOUT_MILLISECONDS = 1000;
  const MAXIMUM_STREAM_CHUNK_BYTES = 4 * 1024 * 1024;
  const COALESCED_CHUNK_BYTES = 64 * 1024;
  const MAXIMUM_MEMBER_BYTES = 68_719_476_736;
  const MAXIMUM_COMPOSITION_BYTES = 68_787_701_384;
  const MAXIMUM_QUALIFICATION_RECEIPT_BYTES = 128 * 1024;
  const MAXIMUM_AUTHORITY_BYTES = 1024 * 1024;
  const QUALIFICATION_RECEIPT_SCHEMA = "tinyrustlm.qualification-receipt/1";
  const SHA256_CHARACTERS = 64;
  const CONTENT_ID_CHARACTERS = 71;
  const MAXIMUM_QUALIFICATION_MODEL_ID_CHARACTERS = 160;
  const MAXIMUM_QUALITY_CLAIM_CHARACTERS = 64;
  const MAXIMUM_QUALITY_SCOPE_CHARACTERS = 256;
  const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
  const CONTENT_ID_PATTERN = /^sha256:[0-9a-f]{64}$/u;
  const UTC_SECONDS_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
  const MEMBER_SPECS = Object.freeze([
    Object.freeze({ role: "model", format: "slm2", fileName: "model.slm2" }),
    Object.freeze({
      role: "tokenizer",
      format: "tokenizer2",
      fileName: "tokenizer.tokenizer2"
    }),
    Object.freeze({
      role: "template",
      format: "template2",
      fileName: "template.template2"
    }),
    Object.freeze({
      role: "sampling",
      format: "sampling2",
      fileName: "sampling.sampling2"
    }),
    Object.freeze({ role: "prompt", format: "prompt2", fileName: "prompt.prompt2" }),
    Object.freeze({
      role: "composition",
      format: "acg2",
      fileName: "composition.acg2"
    })
  ]);
  const MEMBER_NAMES = Object.freeze(MEMBER_SPECS.map(
    // Projects the canonical file-name order used by every member boundary.
    (spec) => spec.fileName
  ));
  const ENTRY_FIELDS = Object.freeze([
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
  const COMPOSITION_FIELDS = Object.freeze(["compositionId", "memberCount", "members"]);
  const CATALOG_MEMBER_FIELDS = Object.freeze(["name", "bytes", "sha256", "schema"]);
  const BROWSER_ADMISSION_FIELDS = Object.freeze(["schema", "route", "bytes", "sha256"]);
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
  const PEER_FIELDS = Object.freeze([
    "announcementId",
    "compositionId",
    "pieceSetSha256",
    "peerBaseUrl",
    "protocolProfile",
    "consentStatus",
    "consentReceiptSha256",
    "outsideProofStatus",
    "outsideProofReceiptSha256",
    "issuedAtUtc",
    "expiresUtc",
    "verificationKeyId",
    "verificationPublicKey",
    "signature",
    "signatureVerified",
    "feedId",
    "feedRevision",
    "feedGeneratedAtUtc",
    "feedValidUntilUtc"
  ]);
  const CATALOG_AUTHORITY_FIELDS = Object.freeze([
    "catalogId", "revision", "generatedAtUtc", "validUntilUtc"
  ]);
  const MANIFEST_FIELDS = Object.freeze(["schema", "admissionAuthority", "members"]);
  const MANIFEST_AUTHORITY_FIELDS = Object.freeze([
    "admission", "qualificationReceipt", "catalog", "p2pPieceSetSha256"
  ]);
  const MANIFEST_DESCRIPTOR_FIELDS = Object.freeze(["byteLength", "sha256"]);
  const MANIFEST_MEMBER_FIELDS = Object.freeze(["fileName", "byteLength", "sha256"]);
  const STORE_ADMISSION_AUTHORITY_INPUT_FIELDS = Object.freeze([
    "admissionText",
    "qualificationReceiptText",
    "catalogText",
    "catalogAuthority",
    "p2pPieceSetSha256"
  ]);
  const STORE_CATALOG_AUTHORITY_FIELDS = Object.freeze([
    "id", "revision", "generatedAtUtc", "validUntilUtc", "sha256"
  ]);
  const ADMISSION_RECORD_FIELDS = Object.freeze([
    "admission",
    "admissionText",
    "admissionSha256",
    "qualificationReceipt",
    "qualificationReceiptText",
    "qualificationReceiptSha256"
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

  class P2pCompositionInstallError extends Error {
    /** Creates one stable terminal browser P2P failure. */
    constructor(code, details) {
      super(code);
      this.name = "P2pCompositionInstallError";
      this.code = code;
      if (details && details.memberName) this.memberName = details.memberName;
      if (details && details.peerBaseUrl) this.peerBaseUrl = details.peerBaseUrl;
      if (details && details.cause !== undefined) this.cause = details.cause;
    }
  }

  /** Throws one typed validation failure. */
  function reject(code, details) {
    throw new P2pCompositionInstallError(code, details);
  }

  /** Preserves an existing route error or wraps an untyped failure. */
  function typed(error, code, details) {
    if (error instanceof P2pCompositionInstallError) return error;
    return new P2pCompositionInstallError(code, { ...details, cause: error });
  }

  /** Returns whether a value is a data-only plain object. */
  function isPlainObject(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  /** Requires exact own data fields and no symbol or accessor surface. */
  function exactObject(value, fields, code, details) {
    if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length !== 0) {
      reject(code, details);
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Object.keys(descriptors);
    if (keys.length !== fields.length ||
        fields.some(
          // Detects required fields missing from the object's own descriptors.
          (field) => !Object.hasOwn(descriptors, field)
        ) ||
        keys.some(
          // Detects undeclared own fields before any value is consumed.
          (field) => !fields.includes(field)
        )) {
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

  /** Requires one bounded positive safe integer. */
  function positiveInteger(value, maximum, code, details) {
    if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
      reject(code, details);
    }
    return value;
  }

  /** Requires one exact unprefixed lowercase SHA-256. */
  function sha256(value, code, details) {
    if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
      reject(code, details);
    }
    return value;
  }

  /** Requires one exact prefixed lowercase SHA-256 content ID. */
  function contentId(value, code, details) {
    if (typeof value !== "string" || !CONTENT_ID_PATTERN.test(value)) {
      reject(code, details);
    }
    return value;
  }

  /** Requires one bounded printable string. */
  function boundedString(value, maximum, code, details) {
    if (typeof value !== "string" || value.length < 1 || value.length > maximum ||
        value !== value.trim() || /[\u0000-\u001f\u007f]/u.test(value)) {
      reject(code, details);
    }
    return value;
  }

  /** Rejects impossible or oversized UTF-8 text before TextEncoder allocates. */
  function precheckTextEncoding(value, descriptor, maximumBytes, code) {
    if (typeof value !== "string" || value.length < 1 ||
        !descriptor || !Number.isSafeInteger(descriptor.byteLength) ||
        value.length > descriptor.byteLength ||
        descriptor.byteLength > value.length * 3 ||
        value.length > maximumBytes || descriptor.byteLength > maximumBytes) {
      reject(code);
    }
  }

  /** Accepts only an AbortSignal-compatible caller cancellation source. */
  function normalizeSignal(value) {
    if (value === undefined || value === null) return null;
    if (typeof value !== "object" || typeof value.aborted !== "boolean" ||
        typeof value.addEventListener !== "function" ||
        typeof value.removeEventListener !== "function") {
      reject("p2p-composition-install-signal");
    }
    return value;
  }

  /** Returns a browser text encoder or fails closed. */
  function textEncoder() {
    if (!root || typeof root.TextEncoder !== "function") {
      reject("p2p-composition-install-text-codec");
    }
    return new root.TextEncoder();
  }

  /** Converts one digest byte array to lowercase hexadecimal. */
  function bytesToHex(bytes) {
    let result = "";
    for (const byte of bytes) result += byte.toString(16).padStart(2, "0");
    return result;
  }

  /** Hashes bounded metadata while the shared install state remains active. */
  async function sha256Hex(bytes, state) {
    checkActive(state);
    const cryptoValue = root && root.crypto;
    if (!(bytes instanceof Uint8Array) || !cryptoValue || !cryptoValue.subtle ||
        typeof cryptoValue.subtle.digest !== "function") {
      reject("p2p-composition-install-sha256");
    }
    let digest;
    try {
      digest = await waitWithCancellation(cryptoValue.subtle.digest("SHA-256", bytes), state);
    } catch (error) {
      throw typed(error, "p2p-composition-install-sha256");
    }
    const digestBytes = new Uint8Array(digest);
    if (digestBytes.byteLength !== 32) {
      reject("p2p-composition-install-sha256");
    }
    return bytesToHex(digestBytes);
  }

  /** Normalizes one admission through the already-loaded canonical authority. */
  function normalizeAdmission(value) {
    if (!admissionApi || admissionApi.schema !== ADMISSION_SCHEMA ||
        typeof admissionApi.normalizeAdmission !== "function" ||
        typeof admissionApi.serializeAdmission !== "function") {
      reject("p2p-composition-install-admission-authority");
    }
    try {
      return admissionApi.normalizeAdmission(value);
    } catch (error) {
      throw typed(error, "p2p-composition-install-admission");
    }
  }

  /** Bounds and validates every standalone receipt string before canonical serialization. */
  function normalizeQualificationReceipt(value, admission) {
    const code = "p2p-composition-install-qualification-record";
    const receipt = exactObject(value, QUALIFICATION_RECEIPT_FIELDS, code);
    if (!Object.isFrozen(receipt)) reject(code);

    boundedString(receipt.schema, QUALIFICATION_RECEIPT_SCHEMA.length, code);
    boundedString(receipt.receiptId, CONTENT_ID_CHARACTERS, code);
    boundedString(receipt.modelId, MAXIMUM_QUALIFICATION_MODEL_ID_CHARACTERS, code);
    boundedString(receipt.operationId, SHA256_CHARACTERS, code);
    boundedString(receipt.compositionId, CONTENT_ID_CHARACTERS, code);
    for (const field of [
      "sourceEvidenceSha256",
      "structuralEvidenceSha256",
      "numericalEvidenceSha256",
      "qualityEvidenceSha256",
      "evalCasesSha256"
    ]) {
      boundedString(receipt[field], SHA256_CHARACTERS, code);
      sha256(receipt[field], code);
    }
    boundedString(receipt.qualityClaim, MAXIMUM_QUALITY_CLAIM_CHARACTERS, code);
    boundedString(receipt.qualityScope, MAXIMUM_QUALITY_SCOPE_CHARACTERS, code);
    boundedString(receipt.numericalStatus, "passed".length, code);
    boundedString(receipt.browserStatus, "passed".length, code);
    boundedString(receipt.qualityStatus, "qualified".length, code);
    if (typeof receipt.issuedAtUtc !== "string" || receipt.issuedAtUtc.length !== 20 ||
        !UTC_SECONDS_PATTERN.test(receipt.issuedAtUtc)) {
      reject(code);
    }
    const issuedAt = Date.parse(receipt.issuedAtUtc);
    if (!Number.isFinite(issuedAt) ||
        new Date(issuedAt).toISOString().replace(".000Z", "Z") !== receipt.issuedAtUtc) {
      reject(code);
    }

    contentId(receipt.receiptId, code);
    sha256(receipt.operationId, code);
    contentId(receipt.compositionId, code);
    if (receipt.schema !== QUALIFICATION_RECEIPT_SCHEMA ||
        receipt.receiptId !== admission.qualification.receiptId ||
        receipt.modelId !== admission.modelId ||
        receipt.operationId !== admission.operationId ||
        receipt.compositionId !== `sha256:${admission.composition.graphIdentitySha256}` ||
        receipt.sourceEvidenceSha256 !== admission.qualification.sourceEvidenceSha256 ||
        receipt.structuralEvidenceSha256 !== admission.qualification.structuralEvidenceSha256 ||
        receipt.numericalEvidenceSha256 !== admission.qualification.numericalEvidenceSha256 ||
        receipt.qualityEvidenceSha256 !== admission.qualification.qualityEvidenceSha256 ||
        receipt.evalCasesSha256 !== admission.qualification.evalCasesSha256 ||
        receipt.qualityClaim !== admission.qualification.qualityClaim ||
        receipt.qualityScope !== admission.qualification.qualityScope ||
        receipt.numericalStatus !== "passed" || receipt.browserStatus !== "passed" ||
        receipt.qualityStatus !== "qualified") {
      reject(code);
    }
    return receipt;
  }

  /** Requires the complete frozen result of the catalog admission and receipt loader. */
  function normalizeAdmissionRecord(value) {
    exactObject(value, ADMISSION_RECORD_FIELDS, "p2p-composition-install-admission-record");
    if (!Object.isFrozen(value) || typeof value.admissionText !== "string" ||
        typeof value.qualificationReceiptText !== "string" ||
        value.qualificationReceiptText.length < 1 ||
        value.qualificationReceiptText.length > MAXIMUM_QUALIFICATION_RECEIPT_BYTES) {
      reject("p2p-composition-install-admission-record");
    }
    const admission = normalizeAdmission(value.admission);
    const receipt = normalizeQualificationReceipt(value.qualificationReceipt, admission);
    contentId(value.admissionSha256, "p2p-composition-install-admission-record");
    contentId(
      value.qualificationReceiptSha256,
      "p2p-composition-install-qualification-record"
    );
    if (value.admissionText !== admissionApi.serializeAdmission(admission) ||
        value.qualificationReceiptText !== `${JSON.stringify(receipt)}\n`) {
      reject("p2p-composition-install-admission-record");
    }
    return Object.freeze({
      admission,
      admissionText: value.admissionText,
      admissionSha256: value.admissionSha256,
      qualificationReceipt: receipt,
      qualificationReceiptText: value.qualificationReceiptText,
      qualificationReceiptSha256: value.qualificationReceiptSha256
    });
  }

  /** Requires one catalog-projected frozen peer-first entry and its identity fields. */
  function normalizeEntry(value) {
    exactObject(value, ENTRY_FIELDS, "p2p-composition-install-entry");
    if (!Object.isFrozen(value) || value.availability !== "peer" ||
        !Array.isArray(value.peers) || !Object.isFrozen(value.peers) ||
        !Number.isSafeInteger(value.peerCount) || value.peerCount !== value.peers.length ||
        value.peerCount < 1 || value.peerCount > 512) {
      reject("p2p-composition-install-entry");
    }
    const composition = exactObject(
      value.composition,
      COMPOSITION_FIELDS,
      "p2p-composition-install-entry"
    );
    if (!Object.isFrozen(composition) || composition.memberCount !== MEMBER_SPECS.length ||
        !Array.isArray(composition.members) || !Object.isFrozen(composition.members) ||
        composition.members.length !== MEMBER_SPECS.length) {
      reject("p2p-composition-install-entry");
    }
    contentId(composition.compositionId, "p2p-composition-install-entry");
    let totalBytes = 0;
    composition.members.forEach(
      // Validates each catalog member in the contract's canonical semantic order.
      (member, index) => {
        const details = { memberName: MEMBER_NAMES[index] };
        exactObject(
          member,
          CATALOG_MEMBER_FIELDS,
          "p2p-composition-install-entry",
          details
        );
        if (!Object.isFrozen(member) || member.name !== MEMBER_NAMES[index]) {
          reject("p2p-composition-install-entry", details);
        }
        positiveInteger(
          member.bytes,
          MAXIMUM_MEMBER_BYTES,
          "p2p-composition-install-entry",
          details
        );
        contentId(member.sha256, "p2p-composition-install-entry", details);
        boundedString(member.schema, 128, "p2p-composition-install-entry", details);
        totalBytes += member.bytes;
        if (!Number.isSafeInteger(totalBytes) || totalBytes > MAXIMUM_COMPOSITION_BYTES) {
          reject("p2p-composition-install-entry", details);
        }
      }
    );

    const browserAdmission = exactObject(
      value.browserAdmission,
      BROWSER_ADMISSION_FIELDS,
      "p2p-composition-install-entry"
    );
    if (!Object.isFrozen(browserAdmission) || browserAdmission.schema !== ADMISSION_SCHEMA) {
      reject("p2p-composition-install-entry");
    }
    boundedString(browserAdmission.route, 512, "p2p-composition-install-entry");
    positiveInteger(
      browserAdmission.bytes,
      admissionApi.maximumTextBytes,
      "p2p-composition-install-entry"
    );
    contentId(browserAdmission.sha256, "p2p-composition-install-entry");

    const qualification = exactObject(
      value.qualification,
      QUALIFICATION_FIELDS,
      "p2p-composition-install-qualification"
    );
    if (!Object.isFrozen(qualification) || qualification.status !== "qualified" ||
        qualification.numericalStatus !== "passed" ||
        qualification.browserStatus !== "passed" ||
        qualification.qualityStatus !== "qualified") {
      reject("p2p-composition-install-qualification");
    }
    contentId(qualification.receiptId, "p2p-composition-install-qualification");
    boundedString(qualification.receiptRoute, 256, "p2p-composition-install-qualification");
    positiveInteger(
      qualification.receiptBytes,
      MAXIMUM_QUALIFICATION_RECEIPT_BYTES,
      "p2p-composition-install-qualification"
    );
    contentId(qualification.receiptSha256, "p2p-composition-install-qualification");

    const catalogAuthority = exactObject(
      value.catalogAuthority,
      CATALOG_AUTHORITY_FIELDS,
      "p2p-composition-install-entry"
    );
    if (!Object.isFrozen(catalogAuthority) ||
        !Number.isSafeInteger(catalogAuthority.revision) ||
        catalogAuthority.revision < 1 ||
        !Number.isFinite(Date.parse(catalogAuthority.generatedAtUtc)) ||
        !Number.isFinite(Date.parse(catalogAuthority.validUntilUtc)) ||
        Date.parse(catalogAuthority.validUntilUtc) <= Date.now()) {
      reject("p2p-composition-install-entry");
    }
    boundedString(catalogAuthority.catalogId, 128, "p2p-composition-install-entry");

    normalizePeerShape(value.peers[0], composition.compositionId, catalogAuthority);
    return value;
  }

  /** Validates peer shape, identity, protocol, and expiry; URL policy is deferred. */
  function normalizePeerShape(value, compositionId, catalogAuthority) {
    exactObject(value, PEER_FIELDS, "p2p-composition-install-peer");
    if (!Object.isFrozen(value) || value.compositionId !== compositionId ||
        value.protocolProfile !== PROTOCOL_PROFILE || value.signatureVerified !== true ||
        value.consentStatus !== "explicit" ||
        value.outsideProofStatus !== "current-passed") {
      reject("p2p-composition-install-peer");
    }
    boundedString(value.announcementId, 128, "p2p-composition-install-peer");
    contentId(value.compositionId, "p2p-composition-install-peer");
    contentId(value.pieceSetSha256, "p2p-composition-install-peer");
    contentId(value.consentReceiptSha256, "p2p-composition-install-peer");
    contentId(value.outsideProofReceiptSha256, "p2p-composition-install-peer");
    contentId(value.verificationKeyId, "p2p-composition-install-peer");
    boundedString(value.peerBaseUrl, 512, "p2p-composition-install-peer");
    boundedString(value.verificationPublicKey, 64, "p2p-composition-install-peer");
    boundedString(value.signature, 128, "p2p-composition-install-peer");
    boundedString(value.feedId, 128, "p2p-composition-install-peer");
    const catalogGeneratedAt = Date.parse(catalogAuthority.generatedAtUtc);
    const catalogValidUntil = Date.parse(catalogAuthority.validUntilUtc);
    const feedGeneratedAt = Date.parse(value.feedGeneratedAtUtc);
    const feedValidUntil = Date.parse(value.feedValidUntilUtc);
    const issuedAt = Date.parse(value.issuedAtUtc);
    const expiry = Date.parse(value.expiresUtc);
    if (!Number.isSafeInteger(value.feedRevision) || value.feedRevision < 1 ||
        !Number.isFinite(feedGeneratedAt) || !Number.isFinite(feedValidUntil) ||
        !Number.isFinite(issuedAt) || !Number.isFinite(expiry) ||
        feedGeneratedAt < catalogGeneratedAt || feedValidUntil <= feedGeneratedAt ||
        feedValidUntil > catalogValidUntil || issuedAt > feedGeneratedAt ||
        expiry > feedValidUntil) {
      reject("p2p-composition-install-peer");
    }
    if (feedValidUntil <= Date.now()) {
      reject("p2p-composition-install-peer-feed-expired");
    }
    if (expiry <= Date.now()) {
      reject("p2p-composition-install-peer-expired");
    }
    return value;
  }

  /** Rechecks every route lease at the instant member transfer consumes it. */
  function requireCurrentTransferAuthority(plan, details) {
    const now = Date.now();
    if (Date.parse(plan.entry.catalogAuthority.validUntilUtc) <= now) {
      reject("p2p-composition-install-catalog-expired", details);
    }
    if (Date.parse(plan.peer.feedValidUntilUtc) <= now) {
      reject("p2p-composition-install-peer-feed-expired", details);
    }
    if (Date.parse(plan.peer.expiresUtc) <= now) {
      reject("p2p-composition-install-peer-expired", details);
    }
  }

  /** Copies and validates the exact store manifest consumed by installation. */
  function normalizeManifest(value) {
    exactObject(value, MANIFEST_FIELDS, "p2p-composition-install-manifest");
    if (value.schema !== STORE_MANIFEST_SCHEMA || !Array.isArray(value.members) ||
        value.members.length !== MEMBER_SPECS.length) {
      reject("p2p-composition-install-manifest");
    }
    const authority = exactObject(
      value.admissionAuthority,
      MANIFEST_AUTHORITY_FIELDS,
      "p2p-composition-install-manifest"
    );
    const descriptor = (source, maximumBytes) => {
      exactObject(
        source,
        MANIFEST_DESCRIPTOR_FIELDS,
        "p2p-composition-install-manifest"
      );
      return Object.freeze({
        byteLength: positiveInteger(
          source.byteLength,
          maximumBytes,
          "p2p-composition-install-manifest"
        ),
        sha256: sha256(source.sha256, "p2p-composition-install-manifest")
      });
    };
    const normalizedAuthority = Object.freeze({
      admission: descriptor(authority.admission, admissionApi.maximumTextBytes),
      qualificationReceipt: descriptor(
        authority.qualificationReceipt,
        MAXIMUM_QUALIFICATION_RECEIPT_BYTES
      ),
      catalog: descriptor(authority.catalog, MAXIMUM_AUTHORITY_BYTES),
      p2pPieceSetSha256: contentId(
        authority.p2pPieceSetSha256,
        "p2p-composition-install-manifest"
      )
    });
    let totalBytes = 0;
    const members = value.members.map(
      // Copies and bounds each store member in canonical order.
      (member, index) => {
        const details = { memberName: MEMBER_NAMES[index] };
        exactObject(
          member,
          MANIFEST_MEMBER_FIELDS,
          "p2p-composition-install-manifest",
          details
        );
        if (member.fileName !== MEMBER_NAMES[index]) {
          reject("p2p-composition-install-manifest", details);
        }
        const normalized = Object.freeze({
          fileName: member.fileName,
          byteLength: positiveInteger(
            member.byteLength,
            MAXIMUM_MEMBER_BYTES,
            "p2p-composition-install-manifest",
            details
          ),
          sha256: sha256(
            member.sha256,
            "p2p-composition-install-manifest",
            details
          )
        });
        totalBytes += normalized.byteLength;
        if (!Number.isSafeInteger(totalBytes) || totalBytes > MAXIMUM_COMPOSITION_BYTES) {
          reject("p2p-composition-install-manifest", details);
        }
        return normalized;
      }
    );
    return Object.freeze({
      schema: STORE_MANIFEST_SCHEMA,
      admissionAuthority: normalizedAuthority,
      members: Object.freeze(members)
    });
  }

  /** Binds exact metadata identities under the shared install cancellation state. */
  async function buildPlan(entry, admissionRecord, manifest, state) {
    const admission = admissionRecord.admission;
    const admissionText = admissionRecord.admissionText;
    const admissionBytes = textEncoder().encode(admissionText);
    if (admissionBytes.byteLength !== manifest.admissionAuthority.admission.byteLength ||
        admissionBytes.byteLength !== entry.browserAdmission.bytes ||
        admissionBytes.byteLength < 1 ||
        admissionBytes.byteLength > admissionApi.maximumTextBytes) {
      reject("p2p-composition-install-admission-binding");
    }
    const admissionSha256 = await sha256Hex(admissionBytes, state);
    if (admissionSha256 !== manifest.admissionAuthority.admission.sha256 ||
        `sha256:${admissionSha256}` !== admissionRecord.admissionSha256 ||
        `sha256:${admissionSha256}` !== entry.browserAdmission.sha256 ||
        entry.composition.compositionId !==
          `sha256:${admission.composition.graphIdentitySha256}`) {
      reject("p2p-composition-install-admission-binding");
    }
    const receiptDescriptor = manifest.admissionAuthority.qualificationReceipt;
    precheckTextEncoding(
      admissionRecord.qualificationReceiptText,
      receiptDescriptor,
      MAXIMUM_QUALIFICATION_RECEIPT_BYTES,
      "p2p-composition-install-qualification-binding"
    );
    const receiptBytes = textEncoder().encode(admissionRecord.qualificationReceiptText);
    const receiptSha256 = await sha256Hex(receiptBytes, state);
    if (receiptBytes.byteLength !== receiptDescriptor.byteLength ||
        receiptSha256 !== receiptDescriptor.sha256 ||
        admission.qualification.receiptId !== entry.qualification.receiptId ||
        admissionRecord.qualificationReceipt.receiptId !== entry.qualification.receiptId ||
        `sha256:${receiptSha256}` !== admissionRecord.qualificationReceiptSha256 ||
        admissionRecord.qualificationReceiptSha256 !== entry.qualification.receiptSha256) {
      reject("p2p-composition-install-qualification-binding");
    }
    for (let index = 0; index < MEMBER_SPECS.length; index += 1) {
      const spec = MEMBER_SPECS[index];
      const details = { memberName: spec.fileName };
      const catalogMember = entry.composition.members[index];
      const admittedMember = admission.artifacts[index];
      const manifestMember = manifest.members[index];
      if (!admittedMember || admittedMember.role !== spec.role ||
          admittedMember.format !== spec.format || admittedMember.fileName !== spec.fileName ||
          catalogMember.name !== spec.fileName || manifestMember.fileName !== spec.fileName ||
          catalogMember.bytes !== admittedMember.byteCount ||
          catalogMember.bytes !== manifestMember.byteLength ||
          catalogMember.sha256 !== `sha256:${admittedMember.sha256}` ||
          catalogMember.sha256 !== `sha256:${manifestMember.sha256}`) {
        reject("p2p-composition-install-member-binding", details);
      }
    }
    const peer = entry.peers[0];
    if (manifest.admissionAuthority.p2pPieceSetSha256 !== peer.pieceSetSha256) {
      reject("p2p-composition-install-manifest");
    }
    const urls = Object.freeze(MEMBER_SPECS.map(
      // Constructs each immutable member route under the selected peer origin.
      (spec) => Object.freeze({
        fileName: spec.fileName,
        url: buildMemberUrl(peer.peerBaseUrl, entry.composition.compositionId, spec.fileName)
      })
    ));
    return Object.freeze({ entry, admission, admissionText, manifest, peer, urls });
  }

  /** Binds stored authority bytes without outliving the shared install state. */
  async function normalizeStoreAdmissionAuthority(value, plan, admissionRecord, state) {
    const code = "p2p-composition-install-admission-authority";
    exactObject(value, STORE_ADMISSION_AUTHORITY_INPUT_FIELDS, code);
    if (value.admissionText !== plan.admissionText ||
        value.qualificationReceiptText !== admissionRecord.qualificationReceiptText ||
        typeof value.catalogText !== "string" || value.catalogText.length < 1 ||
        value.p2pPieceSetSha256 !== plan.peer.pieceSetSha256) {
      reject(code);
    }
    const descriptors = plan.manifest.admissionAuthority;
    precheckTextEncoding(
      value.qualificationReceiptText,
      descriptors.qualificationReceipt,
      MAXIMUM_QUALIFICATION_RECEIPT_BYTES,
      code
    );
    precheckTextEncoding(
      value.catalogText,
      descriptors.catalog,
      MAXIMUM_AUTHORITY_BYTES,
      code
    );
    const receiptBytes = textEncoder().encode(value.qualificationReceiptText);
    const catalogBytes = textEncoder().encode(value.catalogText);
    if (receiptBytes.byteLength !== descriptors.qualificationReceipt.byteLength ||
        catalogBytes.byteLength !== descriptors.catalog.byteLength ||
        await sha256Hex(receiptBytes, state) !== descriptors.qualificationReceipt.sha256 ||
        await sha256Hex(catalogBytes, state) !== descriptors.catalog.sha256) {
      reject(code);
    }
    const catalogAuthority = exactObject(
      value.catalogAuthority,
      STORE_CATALOG_AUTHORITY_FIELDS,
      code
    );
    if (catalogAuthority.id !== plan.entry.catalogAuthority.catalogId ||
        catalogAuthority.revision !== plan.entry.catalogAuthority.revision ||
        catalogAuthority.generatedAtUtc !== plan.entry.catalogAuthority.generatedAtUtc ||
        catalogAuthority.validUntilUtc !== plan.entry.catalogAuthority.validUntilUtc ||
        catalogAuthority.sha256 !== `sha256:${descriptors.catalog.sha256}`) {
      reject(code);
    }
    return Object.freeze({
      admissionText: value.admissionText,
      qualificationReceiptText: value.qualificationReceiptText,
      catalogText: value.catalogText,
      catalogAuthority: Object.freeze({
        id: catalogAuthority.id,
        revision: catalogAuthority.revision,
        generatedAtUtc: catalogAuthority.generatedAtUtc,
        validUntilUtc: catalogAuthority.validUntilUtc,
        sha256: catalogAuthority.sha256
      }),
      p2pPieceSetSha256: value.p2pPieceSetSha256
    });
  }

  /** Applies the shared peer authority and constructs one exact member route. */
  function buildMemberUrl(peerBaseUrl, compositionId, fileName) {
    try {
      return directPeerUrlAuthority.buildCompositionMemberUrl(
        peerBaseUrl,
        compositionId,
        fileName
      );
    } catch (error) {
      throw typed(error, "p2p-composition-install-peer-url");
    }
  }

  /** Locates a typed route error through bounded store wrapping. */
  function findTypedError(value) {
    const seen = new Set();
    let error = value;
    for (let depth = 0; depth < 8 && error && typeof error === "object"; depth += 1) {
      if (error instanceof P2pCompositionInstallError) return error;
      if (seen.has(error)) return null;
      seen.add(error);
      error = error.cause;
    }
    return null;
  }

  /** Records the first terminal failure and aborts the shared fetch signal exactly once. */
  function terminal(state, error, code, details) {
    if (!state.error) {
      state.error = findTypedError(error) || typed(error, code, details);
    }
    if (!state.controller.signal.aborted) {
      state.controller.abort(state.error);
    }
    return state.error;
  }

  /** Throws the shared terminal reason whenever installation is no longer active. */
  function checkActive(state, details) {
    if (state.error) throw state.error;
    if (state.controller.signal.aborted) {
      throw terminal(
        state,
        new P2pCompositionInstallError("p2p-composition-install-aborted", details),
        "p2p-composition-install-aborted",
        details
      );
    }
  }

  /** Races one pending operation against shared cancellation and removes its listener. */
  function waitWithCancellation(value, state, details) {
    // Observe even an already-cancelled operation's later rejection.
    const pending = Promise.resolve(value);
    return new Promise(
      // Owns the abort listener for this single awaited operation.
      (resolve, rejectPromise) => {
        const signal = state.controller.signal;
        let settled = false;
        /** Releases the listener and settles once, retaining the first terminal outcome. */
        const finish = (settle, result) => {
          if (settled) return;
          settled = true;
          signal.removeEventListener("abort", onAbort);
          settle(result);
        };
        // Rejects the wrapper with the first stable terminal reason on abort.
        const onAbort = () => finish(rejectPromise, state.error || new P2pCompositionInstallError(
          "p2p-composition-install-aborted",
          details
        ));
        pending.then(
          // Resolves the wrapper and releases its abort listener.
          (result) => finish(resolve, result),
          // Propagates the operation failure after releasing its abort listener.
          (error) => finish(rejectPromise, error)
        );
        signal.addEventListener("abort", onAbort, { once: true });
        if (state.error || signal.aborted) onAbort();
      }
    );
  }

  /** Bounds best-effort reader cancellation while preserving the terminal route error. */
  async function cancelReaderWithinCeiling(reader, reason) {
    let timeout = null;
    const cancel = Promise.resolve()
      .then(
        // Converts a synchronous reader cancellation throw into a rejected promise.
        () => reader.cancel(reason)
      )
      .catch(
        // Suppresses cleanup failure so it cannot replace the terminal route error.
        () => undefined
      );
    const ceiling = new Promise(
      // Resolves after the fixed cleanup ceiling even if reader cancellation hangs.
      (resolve) => {
        timeout = root.setTimeout(resolve, READER_CANCEL_TIMEOUT_MILLISECONDS);
      }
    );
    try {
      await Promise.race([cancel, ceiling]);
    } finally {
      if (timeout !== null) root.clearTimeout(timeout);
    }
  }

  /** Verifies status, length, media type, URL, and all identity response headers. */
  function validateResponse(response, expected, plan) {
    const details = {
      memberName: expected.fileName,
      peerBaseUrl: plan.peer.peerBaseUrl
    };
    if (!response || typeof response !== "object" || response.status !== 200 ||
        response.redirected !== false || response.url !== expected.url) {
      reject("p2p-composition-install-response-status", details);
    }
    if (!response.headers || typeof response.headers.get !== "function") {
      reject("p2p-composition-install-response-metadata", details);
    }
    const memberIndex = MEMBER_NAMES.indexOf(expected.fileName);
    const member = plan.manifest.members[memberIndex];
    if (response.headers.get("content-length") !== String(member.byteLength) ||
        response.headers.get("content-type") !== MEMBER_MEDIA_TYPE ||
        response.headers.get("content-encoding") !== null ||
        response.headers.get("x-tinyrustlm-composition-id") !==
          plan.entry.composition.compositionId ||
        response.headers.get("x-tinyrustlm-piece-set-id") !==
          plan.peer.pieceSetSha256 ||
        response.headers.get("x-tinyrustlm-member-name") !== expected.fileName ||
        response.headers.get("x-tinyrustlm-member-id") !== `sha256:${member.sha256}`) {
      reject("p2p-composition-install-response-metadata", details);
    }
    if (!response.body || typeof response.body.getReader !== "function") {
      reject("p2p-composition-install-response-body", details);
    }
    return member;
  }

  /** Creates exact one-use sources that fetch sequentially from the selected first peer. */
  function createSources(fetchImplementation, plan, state, onProgress) {
    const sources = {};
    let expectedSourceIndex = 0;
    let activeMember = null;
    let completedBytes = 0;
    const totalBytes = plan.manifest.members.reduce(
      // Sums the already-bounded member lengths for progress reporting.
      (total, member) => total + member.byteLength,
      0
    );

    for (let sourceIndex = 0; sourceIndex < MEMBER_SPECS.length; sourceIndex += 1) {
      const expected = plan.urls[sourceIndex];
      let opened = false;

      /** Streams one complete response body through one bounded coalescing buffer. */
      async function* chunks() {
        const details = {
          memberName: expected.fileName,
          peerBaseUrl: plan.peer.peerBaseUrl
        };
        if (opened || activeMember !== null || expectedSourceIndex !== sourceIndex) {
          throw terminal(
            state,
            new P2pCompositionInstallError(
              "p2p-composition-install-source-order",
              details
            ),
            "p2p-composition-install-source-order",
            details
          );
        }
        opened = true;
        activeMember = expected.fileName;
        let reader = null;
        let complete = false;
        try {
          checkActive(state, details);
          requireCurrentTransferAuthority(plan, details);
          let request;
          try {
            request = fetchImplementation(expected.url, {
              method: "GET",
              mode: "cors",
              credentials: "omit",
              cache: "no-store",
              redirect: "error",
              referrerPolicy: "no-referrer",
              signal: state.controller.signal
            });
          } catch (error) {
            throw typed(error, "p2p-composition-install-fetch", details);
          }
          const response = await waitWithCancellation(request, state, details);
          checkActive(state, details);
          const member = validateResponse(response, expected, plan);
          reader = response.body.getReader();
          let receivedBytes = 0;
          let emittedBytes = 0;
          let bufferedBytes = 0;
          let buffer = new Uint8Array(COALESCED_CHUNK_BYTES);
          while (true) {
            checkActive(state, details);
            requireCurrentTransferAuthority(plan, details);
            const result = await waitWithCancellation(reader.read(), state, details);
            if (!result || typeof result !== "object" || typeof result.done !== "boolean") {
              reject("p2p-composition-install-response-body", details);
            }
            if (result.done) break;
            if (!(result.value instanceof Uint8Array) || result.value.byteLength < 1 ||
                result.value.byteLength > MAXIMUM_STREAM_CHUNK_BYTES) {
              reject("p2p-composition-install-response-body", details);
            }
            receivedBytes += result.value.byteLength;
            if (!Number.isSafeInteger(receivedBytes) || receivedBytes > member.byteLength) {
              reject("p2p-composition-install-response-overflow", details);
            }
            let sourceOffset = 0;
            while (sourceOffset < result.value.byteLength) {
              checkActive(state, details);
              const copiedBytes = Math.min(
                COALESCED_CHUNK_BYTES - bufferedBytes,
                result.value.byteLength - sourceOffset
              );
              buffer.set(
                result.value.subarray(sourceOffset, sourceOffset + copiedBytes),
                bufferedBytes
              );
              bufferedBytes += copiedBytes;
              sourceOffset += copiedBytes;
              if (bufferedBytes === COALESCED_CHUNK_BYTES) {
                requireCurrentTransferAuthority(plan, details);
                const output = buffer;
                yield output;
                checkActive(state, details);
                emittedBytes += output.byteLength;
                completedBytes += output.byteLength;
                if (onProgress) {
                  try {
                    await waitWithCancellation(onProgress(Object.freeze({
                      peerBaseUrl: plan.peer.peerBaseUrl,
                      compositionId: plan.entry.composition.compositionId,
                      memberName: expected.fileName,
                      memberCompletedBytes: emittedBytes,
                      memberTotalBytes: member.byteLength,
                      completedBytes,
                      totalBytes
                    })), state, details);
                  } catch (error) {
                    throw typed(error, "p2p-composition-install-progress", details);
                  }
                }
                buffer = new Uint8Array(COALESCED_CHUNK_BYTES);
                bufferedBytes = 0;
              }
            }
          }
          if (receivedBytes !== member.byteLength) {
            reject("p2p-composition-install-response-truncated", details);
          }
          if (bufferedBytes > 0) {
            checkActive(state, details);
            requireCurrentTransferAuthority(plan, details);
            const output = buffer.subarray(0, bufferedBytes);
            yield output;
            checkActive(state, details);
            emittedBytes += output.byteLength;
            completedBytes += output.byteLength;
            if (onProgress) {
              try {
                await waitWithCancellation(onProgress(Object.freeze({
                  peerBaseUrl: plan.peer.peerBaseUrl,
                  compositionId: plan.entry.composition.compositionId,
                  memberName: expected.fileName,
                  memberCompletedBytes: emittedBytes,
                  memberTotalBytes: member.byteLength,
                  completedBytes,
                  totalBytes
                })), state, details);
              } catch (error) {
                throw typed(error, "p2p-composition-install-progress", details);
              }
            }
          }
          if (emittedBytes !== member.byteLength) {
            reject("p2p-composition-install-response-truncated", details);
          }
          complete = true;
          expectedSourceIndex += 1;
        } catch (error) {
          throw terminal(state, error, "p2p-composition-install-fetch", details);
        } finally {
          activeMember = null;
          if (reader) {
            if (!complete) {
              await cancelReaderWithinCeiling(reader, state.error || undefined);
            }
            try {
              reader.releaseLock();
            } catch (_error) {
              // A failed stream already has a stable terminal route error.
            }
          }
          if (!complete && !state.error) {
            terminal(
              state,
              new P2pCompositionInstallError(
                "p2p-composition-install-response-body",
                details
              ),
              "p2p-composition-install-response-body",
              details
            );
          }
        }
      }

      sources[expected.fileName] = Object.freeze({
        /** Opens the member's one-use streaming source for the store. */
        [Symbol.asyncIterator]() {
          return chunks();
        }
      });
    }
    return Object.freeze(sources);
  }

  /** Requires the closed install option surface and browser dependencies. */
  function normalizeOptions(value) {
    if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length !== 0) {
      reject("p2p-composition-install-options");
    }
    const allowed = Object.freeze([
      "entry",
      "admissionRecord",
      "manifest",
      "admissionAuthority",
      "store",
      "signal",
      "fetch",
      "onProgress",
      "timeoutMilliseconds"
    ]);
    const required = Object.freeze([
      "entry", "admissionRecord", "manifest", "admissionAuthority", "store"
    ]);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Object.keys(descriptors);
    if (required.some(
      // Detects any required option omitted from the caller's own fields.
      (field) => !Object.hasOwn(descriptors, field)
    ) || keys.some(
      // Detects any option outside the installer's closed input surface.
      (field) => !allowed.includes(field)
    ) || keys.some(
      // Rejects accessor-backed options before consuming caller-controlled values.
      (field) => !Object.hasOwn(descriptors[field], "value") ||
        descriptors[field].get || descriptors[field].set
    ) ||
        !value.store || typeof value.store.install !== "function" ||
        (value.fetch !== undefined && typeof value.fetch !== "function") ||
        (value.onProgress !== undefined && typeof value.onProgress !== "function")) {
      reject("p2p-composition-install-options");
    }
    const fetchImplementation = value.fetch === undefined ? root.fetch : value.fetch;
    if (typeof fetchImplementation !== "function" ||
        !root || typeof root.AbortController !== "function" ||
        typeof root.URL !== "function" || typeof root.setTimeout !== "function" ||
        typeof root.clearTimeout !== "function") {
      reject("p2p-composition-install-browser-authority");
    }
    const timeoutMilliseconds = value.timeoutMilliseconds === undefined
      ? DEFAULT_TIMEOUT_MILLISECONDS
      : positiveInteger(
        value.timeoutMilliseconds,
        MAXIMUM_TIMEOUT_MILLISECONDS,
        "p2p-composition-install-timeout"
      );
    return Object.freeze({
      entry: value.entry,
      admissionRecord: value.admissionRecord,
      manifest: value.manifest,
      admissionAuthority: value.admissionAuthority,
      store: value.store,
      signal: normalizeSignal(value.signal),
      fetchImplementation,
      onProgress: value.onProgress,
      timeoutMilliseconds
    });
  }

  /** Installs one bound catalog entry from its first shape- and URL-validated peer. */
  async function installP2pComposition(value) {
    const options = normalizeOptions(value);
    const controller = new root.AbortController();
    const state = { controller, error: null };
    const parentSignal = options.signal;
    // Converts caller cancellation into the installer's stable terminal state.
    const onParentAbort = () => terminal(
      state,
      new P2pCompositionInstallError("p2p-composition-install-aborted"),
      "p2p-composition-install-aborted"
    );
    if (parentSignal) {
      parentSignal.addEventListener("abort", onParentAbort, { once: true });
      if (parentSignal.aborted) onParentAbort();
    }
    const timeout = root.setTimeout(
      // Converts the configured deadline into the installer's stable timeout state.
      () => terminal(
        state,
        new P2pCompositionInstallError("p2p-composition-install-timeout"),
        "p2p-composition-install-timeout"
      ),
      options.timeoutMilliseconds
    );

    try {
      checkActive(state);
      const admissionRecord = normalizeAdmissionRecord(options.admissionRecord);
      const entry = normalizeEntry(options.entry);
      const manifest = normalizeManifest(options.manifest);
      const plan = await buildPlan(entry, admissionRecord, manifest, state);
      const admissionAuthority = await normalizeStoreAdmissionAuthority(
        options.admissionAuthority,
        plan,
        admissionRecord,
        state
      );
      checkActive(state);
      const sources = createSources(
        options.fetchImplementation,
        plan,
        state,
        options.onProgress
      );
      try {
        return await options.store.install({
          manifest: plan.manifest,
          admissionAuthority,
          sources,
          signal: controller.signal
        });
      } catch (error) {
        const routeError = findTypedError(error);
        if (routeError) throw terminal(state, routeError, routeError.code);
        throw terminal(state, error, "p2p-composition-install-store");
      }
    } catch (error) {
      throw terminal(state, error, "p2p-composition-install-terminal");
    } finally {
      root.clearTimeout(timeout);
      if (parentSignal) parentSignal.removeEventListener("abort", onParentAbort);
    }
  }

  return Object.freeze({
    P2pCompositionInstallError,
    installP2pComposition,
    memberNames: MEMBER_NAMES,
    coalescedChunkBytes: COALESCED_CHUNK_BYTES,
    normalizePeerBaseUrl: directPeerUrlAuthority.normalizeBaseUrl,
    protocolProfile: PROTOCOL_PROFILE,
    readerCancelTimeoutMilliseconds: READER_CANCEL_TIMEOUT_MILLISECONDS,
    routePrefix: ROUTE_PREFIX
  });
}));
