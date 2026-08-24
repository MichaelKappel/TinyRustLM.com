(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.TinyRustLMCompanionCapability = factory();
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PROTOCOL_ID = "tinyrustlm.companion.loopback-capability/2";
  const PRODUCTION_ORIGIN = "https://tinyrustlm.com";
  const INSTALLATION_SCHEMA = "tinyrustlm.companion.installation.v1";
  const EMPTY_SHA256 =
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  const KEY_BYTES = 32;
  const MAXIMUM_TRANSCRIPT_FIELDS = 32;
  const MAXIMUM_TRANSCRIPT_FIELD_BYTES = 65536;
  const MAXIMUM_TRANSCRIPT_BYTES = 131072;
  const MAXIMUM_INSTALLATION_RECORD_BYTES = 4096;
  const DOMAINS = Object.freeze({
    pairingServerProof: "TinyRustLM companion pairing server proof 1",
    pairingBrowserProof: "TinyRustLM companion pairing browser proof 1",
    pairingCompletionProof: "TinyRustLM companion pairing completion proof 1",
    sessionSalt: "TinyRustLM companion session capability salt 1",
    sessionKey: "TinyRustLM companion session capability key 1",
    requestProof: "TinyRustLM companion request proof 1",
    responseProof: "TinyRustLM companion response proof 1",
    rotationSalt: "TinyRustLM companion rotated session salt 1",
    rotationKey: "TinyRustLM companion rotated session key 1",
    rotationNewKeyProof: "TinyRustLM companion rotation new key proof 1",
    rotationCompletionProof: "TinyRustLM companion rotation completion proof 1",
    artifactMetadata: "TinyRustLM companion artifact response metadata 1"
  });
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder("utf-8", { fatal: true });

  class CompanionCapabilityError extends Error {
    constructor(code) {
      super(code);
      this.name = "CompanionCapabilityError";
      this.code = code;
    }
  }

  function encodeTranscript(fields) {
    if (!Array.isArray(fields) || fields.length < 1 ||
        fields.length > MAXIMUM_TRANSCRIPT_FIELDS) {
      throw new CompanionCapabilityError("transcript-field-count");
    }
    const encoded = [];
    let total = 0;
    for (const field of fields) {
      if (typeof field !== "string") {
        throw new CompanionCapabilityError("transcript-field-null");
      }
      if (hasUnpairedSurrogate(field)) {
        throw new CompanionCapabilityError("transcript-field-utf8");
      }
      const bytes = textEncoder.encode(field);
      if (bytes.byteLength > MAXIMUM_TRANSCRIPT_FIELD_BYTES) {
        throw new CompanionCapabilityError("transcript-field-size");
      }
      total += 4 + bytes.byteLength;
      if (total > MAXIMUM_TRANSCRIPT_BYTES) {
        throw new CompanionCapabilityError("transcript-size");
      }
      encoded.push(bytes);
    }
    const result = new Uint8Array(total);
    const view = new DataView(result.buffer);
    let offset = 0;
    for (const bytes of encoded) {
      view.setUint32(offset, bytes.byteLength, false);
      offset += 4;
      result.set(bytes, offset);
      offset += bytes.byteLength;
    }
    return result;
  }

  async function sha256Hex(bytes) {
    return bytesToHex(await sha256Bytes(bytes));
  }

  function encodeBase64Url(bytes) {
    const value = requireBytes(bytes, "base64url-bytes");
    if (value.byteLength === 0) {
      throw new CompanionCapabilityError("base64url-empty");
    }
    let binary = "";
    for (let index = 0; index < value.byteLength; index += 1) {
      binary += String.fromCharCode(value[index]);
    }
    return btoa(binary).replace(/=+$/u, "").replace(/\+/gu, "-").replace(/\//gu, "_");
  }

  function decodeBase64Url32(value, code) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/u.test(value)) {
      throw new CompanionCapabilityError(code);
    }
    try {
      const binary = atob(value.replace(/-/gu, "+").replace(/_/gu, "/") + "=");
      const result = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        result[index] = binary.charCodeAt(index);
      }
      if (result.byteLength !== KEY_BYTES || encodeBase64Url(result) !== value) {
        result.fill(0);
        throw new CompanionCapabilityError(code);
      }
      return result;
    } catch (error) {
      if (error instanceof CompanionCapabilityError) {
        throw error;
      }
      throw new CompanionCapabilityError(code);
    }
  }

  function bytesToHex(bytes) {
    const value = requireBytes(bytes, "hex-bytes");
    let result = "";
    for (const byte of value) {
      result += byte.toString(16).padStart(2, "0");
    }
    return result;
  }

  function hexToBytes(value, code) {
    if (typeof value !== "string" || value.length % 2 !== 0 ||
        !/^[0-9a-f]+$/u.test(value)) {
      throw new CompanionCapabilityError(code);
    }
    const result = new Uint8Array(value.length / 2);
    for (let index = 0; index < result.length; index += 1) {
      result[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
    }
    return result;
  }

  async function computePairingServerProof(pairingSecret, context) {
    return proof(pairingSecret, pairingFields(DOMAINS.pairingServerProof, context));
  }

  async function deriveSessionKey(pairingSecret, context) {
    const secret = requireKey(pairingSecret, "pairing-secret");
    validatePairingContext(context);
    const saltTranscript = encodeTranscript(
      pairingFields(DOMAINS.sessionSalt, context, false)
    );
    const salt = await sha256Bytes(saltTranscript);
    const info = encodeTranscript(pairingFields(DOMAINS.sessionKey, context));
    try {
      return await hkdfSha256(secret, salt, info);
    } finally {
      salt.fill(0);
      saltTranscript.fill(0);
      info.fill(0);
    }
  }

  async function computePairingBrowserProof(sessionKey, context) {
    return proof(sessionKey, pairingFields(DOMAINS.pairingBrowserProof, context));
  }

  async function computePairingCompletionProof(
    sessionKey,
    context,
    completeRequestSha256
  ) {
    requireSha256(completeRequestSha256, "pairing-complete-request-sha256");
    return proof(sessionKey, [
      ...pairingFields(DOMAINS.pairingCompletionProof, context),
      completeRequestSha256
    ]);
  }

  async function computeRequestProof(sessionKey, context) {
    validateRequestContext(context);
    return proof(sessionKey, requestFields(context));
  }

  async function computeResponseProof(sessionKey, context) {
    validateResponseContext(context);
    return proof(sessionKey, responseFields(context));
  }

  async function deriveRotatedSessionKey(currentSessionKey, context) {
    const current = requireKey(currentSessionKey, "rotation-current-key");
    validateRotationContext(context);
    const saltTranscript = encodeTranscript(rotationFields(DOMAINS.rotationSalt, context));
    const salt = await sha256Bytes(saltTranscript);
    const info = encodeTranscript(rotationFields(DOMAINS.rotationKey, context));
    try {
      return await hkdfSha256(current, salt, info);
    } finally {
      salt.fill(0);
      saltTranscript.fill(0);
      info.fill(0);
    }
  }

  async function computeRotationNewKeyProof(newSessionKey, context) {
    return proof(newSessionKey, rotationFields(DOMAINS.rotationNewKeyProof, context));
  }

  async function computeRotationCompletionProof(
    newSessionKey,
    context,
    commitRequestSha256
  ) {
    requireSha256(commitRequestSha256, "rotation-commit-request-sha256");
    validateRotationContext(context);
    return proof(newSessionKey, [
      DOMAINS.rotationCompletionProof,
      PROTOCOL_ID,
      context.installationId,
      context.processInstanceId,
      context.sessionId,
      context.rotationId,
      decimal(context.nextEpoch, "rotation-next-epoch"),
      context.host,
      context.origin,
      commitRequestSha256
    ]);
  }

  async function computeArtifactMetadataSha256(metadata) {
    validateArtifactMetadata(metadata);
    return sha256Hex(encodeTranscript([
      DOMAINS.artifactMetadata,
      metadata.operationId,
      metadata.artifactRole,
      metadata.artifactId,
      metadata.artifactSha256,
      decimal(metadata.artifactBytes, "artifact-bytes"),
      decimal(metadata.chunkIndex, "artifact-chunk-index"),
      decimal(metadata.chunkCount, "artifact-chunk-count"),
      decimal(metadata.chunkOffset, "artifact-chunk-offset"),
      decimal(metadata.chunkBytes, "artifact-chunk-bytes")
    ]));
  }

  async function verifyPairingServerProof(pairingSecret, context, value) {
    return verifyProof(
      pairingSecret,
      pairingFields(DOMAINS.pairingServerProof, context),
      value
    );
  }

  async function verifyPairingBrowserProof(sessionKey, context, value) {
    return verifyProof(
      sessionKey,
      pairingFields(DOMAINS.pairingBrowserProof, context),
      value
    );
  }

  async function verifyPairingCompletionProof(
    sessionKey,
    context,
    completeRequestSha256,
    value
  ) {
    requireSha256(completeRequestSha256, "pairing-complete-request-sha256");
    return verifyProof(sessionKey, [
      ...pairingFields(DOMAINS.pairingCompletionProof, context),
      completeRequestSha256
    ], value);
  }

  async function verifyRequestProof(sessionKey, context, value) {
    validateRequestContext(context);
    return verifyProof(sessionKey, requestFields(context), value);
  }

  async function verifyResponseProof(sessionKey, context, value) {
    validateResponseContext(context);
    return verifyProof(sessionKey, responseFields(context), value);
  }

  async function verifyRotationNewKeyProof(newSessionKey, context, value) {
    return verifyProof(
      newSessionKey,
      rotationFields(DOMAINS.rotationNewKeyProof, context),
      value
    );
  }

  async function verifyRotationCompletionProof(
    newSessionKey,
    context,
    commitRequestSha256,
    value
  ) {
    requireSha256(commitRequestSha256, "rotation-commit-request-sha256");
    validateRotationContext(context);
    return verifyProof(newSessionKey, [
      DOMAINS.rotationCompletionProof,
      PROTOCOL_ID,
      context.installationId,
      context.processInstanceId,
      context.sessionId,
      context.rotationId,
      decimal(context.nextEpoch, "rotation-next-epoch"),
      context.host,
      context.origin,
      commitRequestSha256
    ], value);
  }

  function encodeInstallationRecordFile(record) {
    requireExactKeys(record, ["schema", "installationId"], "installation-record-wire");
    if (record.schema !== INSTALLATION_SCHEMA) {
      throw new CompanionCapabilityError("installation-record-schema");
    }
    requireHexIdentifier(record.installationId, 16, "installation-record-id");
    const bytes = textEncoder.encode(
      `{"schema":"${INSTALLATION_SCHEMA}","installationId":"${record.installationId}"}\n`
    );
    if (bytes.byteLength > MAXIMUM_INSTALLATION_RECORD_BYTES) {
      throw new CompanionCapabilityError("installation-record-size");
    }
    return bytes;
  }

  function decodeInstallationRecordFile(bytes) {
    const value = requireBytes(bytes, "installation-record-wire");
    if (value.byteLength < 2 || value.byteLength > MAXIMUM_INSTALLATION_RECORD_BYTES ||
        value[value.byteLength - 1] !== 0x0a) {
      throw new CompanionCapabilityError("installation-record-wire");
    }
    let record;
    try {
      record = JSON.parse(textDecoder.decode(value));
    } catch (_error) {
      throw new CompanionCapabilityError("installation-record-wire");
    }
    requireExactKeys(record, ["schema", "installationId"], "installation-record-wire");
    const canonical = encodeInstallationRecordFile(record);
    if (!constantTimeEqual(value, canonical)) {
      throw new CompanionCapabilityError("installation-record-canonical");
    }
    return Object.freeze({ schema: record.schema, installationId: record.installationId });
  }

  function requestFields(context) {
    return [
      DOMAINS.requestProof,
      PROTOCOL_ID,
      context.installationId,
      context.processInstanceId,
      context.sessionId,
      decimal(context.keyEpoch, "session-key-epoch"),
      decimal(context.sequence, "session-sequence"),
      context.method,
      context.host,
      context.origin,
      context.path,
      context.contentType,
      decimal(context.contentLength, "request-content-length"),
      context.contentSha256
    ];
  }

  function responseFields(context) {
    return [
      DOMAINS.responseProof,
      PROTOCOL_ID,
      context.installationId,
      context.processInstanceId,
      context.sessionId,
      decimal(context.keyEpoch, "session-key-epoch"),
      decimal(context.sequence, "session-sequence"),
      context.requestMethod,
      context.requestPath,
      decimal(context.status, "response-status"),
      context.contentType,
      decimal(context.contentLength, "response-content-length"),
      context.responseMetadataSha256,
      context.contentSha256
    ];
  }

  function pairingFields(domain, context, includeExpiry = true) {
    validatePairingContext(context);
    const fields = [
      domain,
      PROTOCOL_ID,
      context.installationId,
      context.processInstanceId,
      context.claimId,
      context.browserNonce,
      context.serverNonce,
      context.sessionId,
      decimal(context.keyEpoch, "pairing-key-epoch"),
      context.host,
      context.origin
    ];
    if (includeExpiry) {
      fields.push(
        context.sessionExpiresAtUtc,
        decimal(context.idleTimeoutSeconds, "pairing-idle-timeout")
      );
    }
    return fields;
  }

  function rotationFields(domain, context) {
    validateRotationContext(context);
    return [
      domain,
      PROTOCOL_ID,
      context.installationId,
      context.processInstanceId,
      context.sessionId,
      context.rotationId,
      context.browserNonce,
      context.serverNonce,
      decimal(context.currentEpoch, "rotation-current-epoch"),
      decimal(context.nextEpoch, "rotation-next-epoch"),
      context.host,
      context.origin
    ];
  }

  function validatePairingContext(context) {
    requireExactKeys(context, [
      "installationId",
      "processInstanceId",
      "claimId",
      "browserNonce",
      "serverNonce",
      "sessionId",
      "keyEpoch",
      "host",
      "origin",
      "sessionExpiresAtUtc",
      "idleTimeoutSeconds"
    ], "pairing-context");
    requireHexIdentifier(context.installationId, 16, "pairing-installation-id");
    requireHexIdentifier(context.processInstanceId, 16, "pairing-process-id");
    requireHexIdentifier(context.claimId, 16, "pairing-claim-id");
    requireNonce(context.browserNonce, "pairing-browser-nonce");
    requireNonce(context.serverNonce, "pairing-server-nonce");
    requireHexIdentifier(context.sessionId, 16, "pairing-session-id");
    requireEpoch(context.keyEpoch, "pairing-key-epoch");
    requireHostAndOrigin(context.host, context.origin);
    requireTimestamp(context.sessionExpiresAtUtc, "pairing-session-expiry");
    if (context.idleTimeoutSeconds !== 900) {
      throw new CompanionCapabilityError("pairing-idle-timeout");
    }
  }

  function validateRequestContext(context) {
    requireExactKeys(context, [
      "installationId",
      "processInstanceId",
      "sessionId",
      "keyEpoch",
      "sequence",
      "method",
      "host",
      "origin",
      "path",
      "contentType",
      "contentLength",
      "contentSha256"
    ], "request-proof-context");
    requireSessionIdentity(context);
    requirePath(context.path, "request-proof-context");
    if ((context.method !== "GET" && context.method !== "POST") ||
        (context.contentType !== "" && context.contentType !== "application/json") ||
        !Number.isSafeInteger(context.contentLength) || context.contentLength < 0 ||
        context.contentLength > 65536) {
      throw new CompanionCapabilityError("request-proof-context");
    }
    requireHostAndOrigin(context.host, context.origin);
    requireSha256(context.contentSha256, "request-content-sha256");
    if ((context.method === "GET" &&
         (context.contentLength !== 0 || context.contentType !== "" ||
          context.contentSha256 !== EMPTY_SHA256)) ||
        (context.method === "POST" && context.contentType !== "application/json")) {
      throw new CompanionCapabilityError("request-proof-body");
    }
  }

  function validateResponseContext(context) {
    requireExactKeys(context, [
      "installationId",
      "processInstanceId",
      "sessionId",
      "keyEpoch",
      "sequence",
      "requestMethod",
      "requestPath",
      "status",
      "contentType",
      "contentLength",
      "responseMetadataSha256",
      "contentSha256"
    ], "response-proof-context");
    requireSessionIdentity(context);
    requirePath(context.requestPath, "response-proof-context");
    if ((context.requestMethod !== "GET" && context.requestMethod !== "POST") ||
        !Number.isSafeInteger(context.status) || context.status < 100 ||
        context.status > 599 ||
        (context.contentType !== "application/json" &&
         context.contentType !== "application/octet-stream") ||
        !Number.isSafeInteger(context.contentLength) || context.contentLength < 0 ||
        context.contentLength > 4194304) {
      throw new CompanionCapabilityError("response-proof-context");
    }
    requireSha256(context.responseMetadataSha256, "response-metadata-sha256");
    requireSha256(context.contentSha256, "response-content-sha256");
  }

  function validateRotationContext(context) {
    requireExactKeys(context, [
      "installationId",
      "processInstanceId",
      "sessionId",
      "rotationId",
      "browserNonce",
      "serverNonce",
      "currentEpoch",
      "nextEpoch",
      "host",
      "origin"
    ], "rotation-context");
    requireHexIdentifier(context.installationId, 16, "rotation-installation-id");
    requireHexIdentifier(context.processInstanceId, 16, "rotation-process-id");
    requireHexIdentifier(context.sessionId, 16, "rotation-session-id");
    requireHexIdentifier(context.rotationId, 16, "rotation-id");
    requireNonce(context.browserNonce, "rotation-browser-nonce");
    requireNonce(context.serverNonce, "rotation-server-nonce");
    requireEpoch(context.currentEpoch, "rotation-current-epoch");
    requireEpoch(context.nextEpoch, "rotation-next-epoch");
    if (context.nextEpoch !== context.currentEpoch + 1) {
      throw new CompanionCapabilityError("rotation-epoch-order");
    }
    requireHostAndOrigin(context.host, context.origin);
  }

  function validateArtifactMetadata(metadata) {
    requireExactKeys(metadata, [
      "operationId",
      "artifactRole",
      "artifactId",
      "artifactSha256",
      "artifactBytes",
      "chunkIndex",
      "chunkCount",
      "chunkOffset",
      "chunkBytes"
    ], "artifact-metadata");
    requireSha256(metadata.operationId, "artifact-operation-id");
    if (!["composition", "model", "tokenizer", "template", "sampling", "prompt"]
      .includes(metadata.artifactRole)) {
      throw new CompanionCapabilityError("artifact-role");
    }
    if (typeof metadata.artifactId !== "string" ||
        !/^[a-z0-9][a-z0-9._:-]{7,255}$/u.test(metadata.artifactId)) {
      throw new CompanionCapabilityError("artifact-id");
    }
    requireSha256(metadata.artifactSha256, "artifact-sha256");
    for (const field of [
      "artifactBytes", "chunkIndex", "chunkCount", "chunkOffset", "chunkBytes"
    ]) {
      if (!Number.isSafeInteger(metadata[field]) || metadata[field] < 0) {
        throw new CompanionCapabilityError("artifact-metadata");
      }
    }
    if (metadata.artifactBytes === 0 || metadata.artifactBytes > 68719476736 ||
        metadata.chunkCount === 0 || metadata.chunkCount > 16384 ||
        metadata.chunkIndex >= metadata.chunkCount ||
        metadata.chunkOffset !== metadata.chunkIndex * 4194304 ||
        metadata.chunkBytes === 0 || metadata.chunkBytes > 4194304 ||
        metadata.chunkOffset + metadata.chunkBytes > metadata.artifactBytes ||
        (metadata.chunkIndex + 1 < metadata.chunkCount &&
         metadata.chunkBytes !== 4194304) ||
        (metadata.chunkIndex + 1 === metadata.chunkCount &&
         metadata.chunkOffset + metadata.chunkBytes !== metadata.artifactBytes) ||
        metadata.chunkCount !== Math.ceil(metadata.artifactBytes / 4194304)) {
      throw new CompanionCapabilityError("artifact-metadata");
    }
  }

  function requireSessionIdentity(context) {
    requireHexIdentifier(context.installationId, 16, "session-installation-id");
    requireHexIdentifier(context.processInstanceId, 16, "session-process-id");
    requireHexIdentifier(context.sessionId, 16, "session-id");
    requireEpoch(context.keyEpoch, "session-key-epoch");
    if (!Number.isSafeInteger(context.sequence) ||
        context.sequence < 1 || context.sequence > 1000000) {
      throw new CompanionCapabilityError("session-sequence");
    }
  }

  function requireHexIdentifier(value, byteCount, code) {
    if (!Number.isSafeInteger(byteCount) || byteCount < 1 || byteCount > 64 ||
        typeof value !== "string" || value.length !== byteCount * 2 ||
        !/^[0-9a-f]+$/u.test(value)) {
      throw new CompanionCapabilityError(code);
    }
  }

  function requireSha256(value, code) {
    requireHexIdentifier(value, 32, code);
  }

  function requireNonce(value, code) {
    const decoded = decodeBase64Url32(value, code);
    decoded.fill(0);
  }

  function requireTimestamp(value, code) {
    if (typeof value !== "string" ||
        !/^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]Z$/u.test(value) ||
        Number(value.slice(0, 4)) < 1) {
      throw new CompanionCapabilityError(code);
    }
    const date = new Date(value);
    if (!Number.isFinite(date.valueOf()) || date.toISOString() !== value.replace("Z", ".000Z")) {
      throw new CompanionCapabilityError(code);
    }
  }

  function requireHostAndOrigin(host, origin) {
    const match = typeof host === "string"
      ? /^127[.]0[.]0[.]1:([1-9][0-9]{3,4})$/u.exec(host)
      : null;
    const port = match ? Number(match[1]) : 0;
    if (!match || !Number.isInteger(port) || port < 1024 || port > 65535) {
      throw new CompanionCapabilityError("host-invalid");
    }
    if (origin !== PRODUCTION_ORIGIN) {
      throw new CompanionCapabilityError("origin-invalid");
    }
  }

  function requirePath(value, code) {
    if (typeof value !== "string" || value.length > 1024 ||
        !/^(?:\/[A-Za-z0-9._~-]+)+$/u.test(value)) {
      throw new CompanionCapabilityError(code);
    }
  }

  function requireEpoch(value, code) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 64) {
      throw new CompanionCapabilityError(code);
    }
  }

  function requireKey(value, code) {
    const bytes = requireBytes(value, code);
    if (bytes.byteLength !== KEY_BYTES) {
      throw new CompanionCapabilityError(code);
    }
    return bytes;
  }

  function requireBytes(value, code) {
    if (!(value instanceof Uint8Array)) {
      throw new CompanionCapabilityError(code);
    }
    return value;
  }

  function requireExactKeys(value, keys, code) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new CompanionCapabilityError(code);
    }
    const actual = Object.keys(value);
    if (actual.length !== keys.length || keys.some((key) => !actual.includes(key))) {
      throw new CompanionCapabilityError(code);
    }
  }

  function decimal(value, code) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new CompanionCapabilityError(code);
    }
    return String(value);
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

  function cryptoApi() {
    const value = typeof globalThis === "object" ? globalThis.crypto : null;
    if (!value || !value.subtle) {
      throw new CompanionCapabilityError("webcrypto-unavailable");
    }
    return value;
  }

  async function sha256Bytes(bytes) {
    const value = requireBytes(bytes, "sha256-bytes");
    return new Uint8Array(await cryptoApi().subtle.digest("SHA-256", value));
  }

  async function hmacSha256(keyBytes, messageBytes) {
    const key = requireKey(keyBytes, "hmac-key");
    const message = requireBytes(messageBytes, "hmac-message");
    const imported = await cryptoApi().subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    return new Uint8Array(await cryptoApi().subtle.sign("HMAC", imported, message));
  }

  async function hkdfSha256(inputKeyMaterial, salt, info) {
    const ikm = requireKey(inputKeyMaterial, "hkdf-input-key");
    const saltBytes = requireKey(salt, "hkdf-input");
    const infoBytes = requireBytes(info, "hkdf-input");
    if (infoBytes.byteLength < 1 || infoBytes.byteLength > MAXIMUM_TRANSCRIPT_BYTES) {
      throw new CompanionCapabilityError("hkdf-input");
    }
    const prk = await hmacSha256(saltBytes, ikm);
    const expandInput = new Uint8Array(infoBytes.byteLength + 1);
    expandInput.set(infoBytes);
    expandInput[expandInput.byteLength - 1] = 1;
    try {
      return await hmacSha256(prk, expandInput);
    } finally {
      prk.fill(0);
      expandInput.fill(0);
    }
  }

  async function proof(key, fields) {
    const transcript = encodeTranscript(fields);
    const digest = await hmacSha256(key, transcript);
    try {
      return encodeBase64Url(digest);
    } finally {
      transcript.fill(0);
      digest.fill(0);
    }
  }

  async function verifyProof(key, fields, value) {
    let actual;
    try {
      actual = decodeBase64Url32(value, "proof-encoding");
    } catch (_error) {
      return false;
    }
    const transcript = encodeTranscript(fields);
    const expected = await hmacSha256(key, transcript);
    try {
      return constantTimeEqual(expected, actual);
    } finally {
      transcript.fill(0);
      expected.fill(0);
      actual.fill(0);
    }
  }

  function constantTimeEqual(left, right) {
    if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array)) {
      return false;
    }
    let difference = left.byteLength ^ right.byteLength;
    const maximum = Math.max(left.byteLength, right.byteLength);
    for (let index = 0; index < maximum; index += 1) {
      difference |= (left[index % (left.byteLength || 1)] || 0) ^
        (right[index % (right.byteLength || 1)] || 0);
    }
    return difference === 0;
  }

  return Object.freeze({
    PROTOCOL_ID,
    PRODUCTION_ORIGIN,
    INSTALLATION_SCHEMA,
    EMPTY_SHA256,
    DOMAINS,
    CompanionCapabilityError,
    encodeTranscript,
    sha256Hex,
    encodeBase64Url,
    decodeBase64Url32,
    bytesToHex,
    hexToBytes,
    computePairingServerProof,
    deriveSessionKey,
    computePairingBrowserProof,
    computePairingCompletionProof,
    computeRequestProof,
    computeResponseProof,
    deriveRotatedSessionKey,
    computeRotationNewKeyProof,
    computeRotationCompletionProof,
    computeArtifactMetadataSha256,
    verifyPairingServerProof,
    verifyPairingBrowserProof,
    verifyPairingCompletionProof,
    verifyRequestProof,
    verifyResponseProof,
    verifyRotationNewKeyProof,
    verifyRotationCompletionProof,
    encodeInstallationRecordFile,
    decodeInstallationRecordFile
  });
}));
