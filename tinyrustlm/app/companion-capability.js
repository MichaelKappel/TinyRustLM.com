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
  const MAXIMUM_PAIRING_BEGIN_REQUEST_BYTES = 2048;
  const MAXIMUM_PAIRING_BEGIN_RESPONSE_BYTES = 4096;
  const MAXIMUM_PAIRING_COMPLETE_REQUEST_BYTES = 4096;
  const MAXIMUM_PAIRING_COMPLETE_RESPONSE_BYTES = 4096;
  const MAXIMUM_SESSION_STATUS_BYTES = 4096;
  const MAXIMUM_ROTATION_MESSAGE_BYTES = 4096;
  const MAXIMUM_REVOCATION_MESSAGE_BYTES = 1024;
  const MAXIMUM_OPERATION_REQUEST_BYTES = 65536;
  const MAXIMUM_OPERATION_PROJECTION_BYTES = 65536;
  const MAXIMUM_ERROR_RESPONSE_BYTES = 256;
  const MAXIMUM_ARTIFACT_CHUNK_BYTES = 4 * 1024 * 1024;
  const MAXIMUM_ARTIFACT_BYTES = 64 * 1024 * 1024 * 1024;
  const MAXIMUM_COMPOSITION_BYTES = 68 * 1024 * 1024 * 1024;
  const MAXIMUM_SOURCE_BYTES = 16 * 1024 * 1024 * 1024;
  const MAXIMUM_PEER_CANDIDATES = 2;
  const MAXIMUM_RESPONSE_BYTES = MAXIMUM_ARTIFACT_CHUNK_BYTES;
  const DEFAULT_TIMEOUT_MILLISECONDS = 10000;
  const CHUNK_TIMEOUT_MILLISECONDS = 60000;
  const PAIRING_CODE_PATTERN =
    /^TRLC1:([1-9][0-9]{3,4}):([A-Za-z0-9_-]{43})$/u;
  const ROUTES = Object.freeze({
    pairingBegin: "/tinyrustlm-companion/1/pairings/begin",
    pairingComplete: "/tinyrustlm-companion/1/pairings/complete",
    session: "/tinyrustlm-companion/1/session",
    rotationBegin: "/tinyrustlm-companion/1/session/rotation/begin",
    rotationCommit: "/tinyrustlm-companion/1/session/rotation/commit",
    revoke: "/tinyrustlm-companion/1/session/revoke",
    operations: "/tinyrustlm-companion/1/operations"
  });
  const SCHEMAS = Object.freeze({
    pairingBeginRequest:
      "tinyrustlm.companion.loopback.pairing-begin-request.v1",
    pairingBeginResponse:
      "tinyrustlm.companion.loopback.pairing-begin-response.v1",
    pairingCompleteRequest:
      "tinyrustlm.companion.loopback.pairing-complete-request.v1",
    pairingCompleteResponse:
      "tinyrustlm.companion.loopback.pairing-complete-response.v1",
    sessionStatus: "tinyrustlm.companion.loopback.session-status.v1",
    rotationBegin: "tinyrustlm.companion.loopback.rotation-begin.v1",
    rotationChallenge: "tinyrustlm.companion.loopback.rotation-challenge.v1",
    rotationCommit: "tinyrustlm.companion.loopback.rotation-commit.v1",
    rotationCommitted: "tinyrustlm.companion.loopback.rotation-committed.v1",
    revokeRequest: "tinyrustlm.companion.loopback.revoke-request.v1",
    revokedResponse: "tinyrustlm.companion.loopback.revoked.v1",
    error: "tinyrustlm.companion.loopback.error.v1",
    acquire: "tinyrustlm.companion.acquire.v1",
    operationProjection:
      "tinyrustlm.companion.loopback.operation-projection.v1",
    cancelRequest: "tinyrustlm.companion.loopback.cancel-request.v1"
  });
  const ARTIFACT_ROLES = Object.freeze([
    "composition",
    "model",
    "tokenizer",
    "template",
    "sampling",
    "prompt"
  ]);
  const OPERATION_STATES = Object.freeze([
    "queued",
    "checking-peers",
    "fetching-peer",
    "verifying-peer",
    "acquiring-source",
    "converting",
    "verifying-composition",
    "available",
    "cancelled",
    "rejected"
  ]);
  const OPERATION_BRANCHES = Object.freeze(["undecided", "peer", "source", "none"]);
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
    constructor(code, status = 0) {
      super(code);
      this.name = "CompanionCapabilityError";
      this.code = code;
      this.status = status;
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

  function requireAllowedKeys(value, keys, code) {
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        Object.keys(value).some((key) => !keys.includes(key))) {
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

  function canonicalJsonBytes(value, maximumBytes, code) {
    let text;
    try {
      text = JSON.stringify(value);
    } catch (_error) {
      throw new CompanionCapabilityError(code);
    }
    if (typeof text !== "string" || hasUnpairedSurrogate(text)) {
      throw new CompanionCapabilityError(code);
    }
    const bytes = textEncoder.encode(text);
    if (bytes.byteLength < 2 || bytes.byteLength > maximumBytes) {
      throw new CompanionCapabilityError(code);
    }
    return bytes;
  }

  function decodeCanonicalJson(bytes, maximumBytes, decode, encode, code) {
    const wire = requireBytes(bytes, code);
    if (wire.byteLength < 2 || wire.byteLength > maximumBytes ||
        startsWithBytes(wire, [0xef, 0xbb, 0xbf])) {
      throw new CompanionCapabilityError(code);
    }
    let parsed;
    try {
      parsed = JSON.parse(textDecoder.decode(wire));
    } catch (_error) {
      throw new CompanionCapabilityError(code);
    }
    const value = decode(parsed);
    if (!constantTimeEqual(wire, encode(value))) {
      throw new CompanionCapabilityError(`${code}-canonical`);
    }
    return value;
  }

  function startsWithBytes(value, prefix) {
    return value.byteLength >= prefix.length &&
      prefix.every((byte, index) => value[index] === byte);
  }

  function requireString(value, code, maximumCodeUnits = 4096) {
    if (typeof value !== "string" || value.length > maximumCodeUnits ||
        hasUnpairedSurrogate(value)) {
      throw new CompanionCapabilityError(code);
    }
    return value;
  }

  function requireBoolean(value, code) {
    if (typeof value !== "boolean") {
      throw new CompanionCapabilityError(code);
    }
    return value;
  }

  function requireUInt(value, code, maximum = Number.MAX_SAFE_INTEGER) {
    if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
      throw new CompanionCapabilityError(code);
    }
    return value;
  }

  function requireNullableUInt(value, code, maximum = Number.MAX_SAFE_INTEGER) {
    return value === null ? null : requireUInt(value, code, maximum);
  }

  function requireNullableString(value, code, maximumCodeUnits = 4096) {
    return value === null ? null : requireString(value, code, maximumCodeUnits);
  }

  function randomBytes(byteCount) {
    if (!Number.isSafeInteger(byteCount) || byteCount < 1 || byteCount > 65536) {
      throw new CompanionCapabilityError("random-byte-count");
    }
    const bytes = new Uint8Array(byteCount);
    cryptoApi().getRandomValues(bytes);
    return bytes;
  }

  function randomHex(byteCount) {
    const bytes = randomBytes(byteCount);
    try {
      return bytesToHex(bytes);
    } finally {
      bytes.fill(0);
    }
  }

  function randomNonce() {
    const bytes = randomBytes(KEY_BYTES);
    try {
      return encodeBase64Url(bytes);
    } finally {
      bytes.fill(0);
    }
  }

  function parsePairingCode(value) {
    if (typeof value !== "string") {
      throw new CompanionCapabilityError("pairing-code-invalid");
    }
    const match = PAIRING_CODE_PATTERN.exec(value);
    const port = match ? Number(match[1]) : 0;
    if (!match || !Number.isSafeInteger(port) || port < 1024 || port > 65535) {
      throw new CompanionCapabilityError("pairing-code-invalid");
    }
    const secret = decodeBase64Url32(match[2], "pairing-code-invalid");
    return Object.freeze({
      port,
      host: `127.0.0.1:${port}`,
      endpoint: `http://127.0.0.1:${port}`,
      secret
    });
  }

  function encodePairingBeginRequest(value) {
    requireExactKeys(value, ["schema", "claimId", "browserNonce"],
      "pairing-begin-request");
    if (value.schema !== SCHEMAS.pairingBeginRequest) {
      throw new CompanionCapabilityError("pairing-begin-schema");
    }
    requireHexIdentifier(value.claimId, 16, "pairing-claim-id");
    requireNonce(value.browserNonce, "pairing-browser-nonce");
    return canonicalJsonBytes({
      schema: value.schema,
      claimId: value.claimId,
      browserNonce: value.browserNonce
    }, MAXIMUM_PAIRING_BEGIN_REQUEST_BYTES, "pairing-begin-request-wire");
  }

  function decodePairingBeginResponse(bytes) {
    return decodeCanonicalJson(
      bytes,
      MAXIMUM_PAIRING_BEGIN_RESPONSE_BYTES,
      validatePairingBeginResponse,
      encodePairingBeginResponse,
      "pairing-begin-response-wire"
    );
  }

  function validatePairingBeginResponse(value) {
    requireExactKeys(value, [
      "schema", "protocolId", "installationId", "processInstanceId",
      "claimId", "browserNonce", "serverNonce", "sessionId", "keyEpoch",
      "sessionExpiresAtUtc", "idleTimeoutSeconds", "pairingProof"
    ], "pairing-begin-response");
    if (value.schema !== SCHEMAS.pairingBeginResponse ||
        value.protocolId !== PROTOCOL_ID) {
      throw new CompanionCapabilityError("pairing-begin-response-schema");
    }
    requireHexIdentifier(value.installationId, 16, "pairing-installation-id");
    requireHexIdentifier(value.processInstanceId, 16, "pairing-process-id");
    requireHexIdentifier(value.claimId, 16, "pairing-claim-id");
    requireNonce(value.browserNonce, "pairing-browser-nonce");
    requireNonce(value.serverNonce, "pairing-server-nonce");
    requireHexIdentifier(value.sessionId, 16, "pairing-session-id");
    requireEpoch(value.keyEpoch, "pairing-key-epoch");
    requireTimestamp(value.sessionExpiresAtUtc, "pairing-session-expiry");
    if (value.idleTimeoutSeconds !== 900) {
      throw new CompanionCapabilityError("pairing-idle-timeout");
    }
    requireNonce(value.pairingProof, "pairing-proof");
    return value;
  }

  function encodePairingBeginResponse(value) {
    validatePairingBeginResponse(value);
    return canonicalJsonBytes({
      schema: value.schema,
      protocolId: value.protocolId,
      installationId: value.installationId,
      processInstanceId: value.processInstanceId,
      claimId: value.claimId,
      browserNonce: value.browserNonce,
      serverNonce: value.serverNonce,
      sessionId: value.sessionId,
      keyEpoch: value.keyEpoch,
      sessionExpiresAtUtc: value.sessionExpiresAtUtc,
      idleTimeoutSeconds: value.idleTimeoutSeconds,
      pairingProof: value.pairingProof
    }, MAXIMUM_PAIRING_BEGIN_RESPONSE_BYTES, "pairing-begin-response-wire");
  }

  function encodePairingCompleteRequest(value) {
    requireExactKeys(value, [
      "schema", "claimId", "browserNonce", "serverNonce", "sessionId",
      "browserProof"
    ], "pairing-complete-request");
    if (value.schema !== SCHEMAS.pairingCompleteRequest) {
      throw new CompanionCapabilityError("pairing-complete-schema");
    }
    requireHexIdentifier(value.claimId, 16, "pairing-claim-id");
    requireNonce(value.browserNonce, "pairing-browser-nonce");
    requireNonce(value.serverNonce, "pairing-server-nonce");
    requireHexIdentifier(value.sessionId, 16, "pairing-session-id");
    requireNonce(value.browserProof, "pairing-browser-proof");
    return canonicalJsonBytes({
      schema: value.schema,
      claimId: value.claimId,
      browserNonce: value.browserNonce,
      serverNonce: value.serverNonce,
      sessionId: value.sessionId,
      browserProof: value.browserProof
    }, MAXIMUM_PAIRING_COMPLETE_REQUEST_BYTES, "pairing-complete-request-wire");
  }

  function decodePairingCompleteResponse(bytes) {
    return decodeCanonicalJson(
      bytes,
      MAXIMUM_PAIRING_COMPLETE_RESPONSE_BYTES,
      validatePairingCompleteResponse,
      encodePairingCompleteResponse,
      "pairing-complete-response-wire"
    );
  }

  function validatePairingCompleteResponse(value) {
    requireExactKeys(value, [
      "schema", "protocolId", "installationId", "processInstanceId",
      "sessionId", "keyEpoch", "sessionExpiresAtUtc", "idleTimeoutSeconds",
      "completionProof"
    ], "pairing-complete-response");
    if (value.schema !== SCHEMAS.pairingCompleteResponse ||
        value.protocolId !== PROTOCOL_ID) {
      throw new CompanionCapabilityError("pairing-complete-response-schema");
    }
    requireHexIdentifier(value.installationId, 16, "pairing-installation-id");
    requireHexIdentifier(value.processInstanceId, 16, "pairing-process-id");
    requireHexIdentifier(value.sessionId, 16, "pairing-session-id");
    requireEpoch(value.keyEpoch, "pairing-key-epoch");
    requireTimestamp(value.sessionExpiresAtUtc, "pairing-session-expiry");
    if (value.idleTimeoutSeconds !== 900) {
      throw new CompanionCapabilityError("pairing-idle-timeout");
    }
    requireNonce(value.completionProof, "pairing-completion-proof");
    return value;
  }

  function encodePairingCompleteResponse(value) {
    validatePairingCompleteResponse(value);
    return canonicalJsonBytes({
      schema: value.schema,
      protocolId: value.protocolId,
      installationId: value.installationId,
      processInstanceId: value.processInstanceId,
      sessionId: value.sessionId,
      keyEpoch: value.keyEpoch,
      sessionExpiresAtUtc: value.sessionExpiresAtUtc,
      idleTimeoutSeconds: value.idleTimeoutSeconds,
      completionProof: value.completionProof
    }, MAXIMUM_PAIRING_COMPLETE_RESPONSE_BYTES, "pairing-complete-response-wire");
  }

  function decodeSessionStatus(bytes) {
    return decodeCanonicalJson(
      bytes,
      MAXIMUM_SESSION_STATUS_BYTES,
      validateSessionStatus,
      encodeSessionStatus,
      "session-status-wire"
    );
  }

  function validateSessionStatus(value) {
    requireExactKeys(value, [
      "schema", "protocolId", "installationId", "processInstanceId",
      "sessionId", "keyEpoch", "acceptedSequence", "nextSequence",
      "sessionExpiresAtUtc", "keyExpiresAtUtc", "idleTimeoutSeconds"
    ], "session-status");
    if (value.schema !== SCHEMAS.sessionStatus || value.protocolId !== PROTOCOL_ID) {
      throw new CompanionCapabilityError("session-status-schema");
    }
    requireHexIdentifier(value.installationId, 16, "session-installation-id");
    requireHexIdentifier(value.processInstanceId, 16, "session-process-id");
    requireHexIdentifier(value.sessionId, 16, "session-id");
    requireEpoch(value.keyEpoch, "session-key-epoch");
    requireUInt(value.acceptedSequence, "session-accepted-sequence", 1000000);
    requireNullableUInt(value.nextSequence, "session-next-sequence", 1000000);
    requireTimestamp(value.sessionExpiresAtUtc, "session-expiry");
    requireTimestamp(value.keyExpiresAtUtc, "session-key-expiry");
    if (value.idleTimeoutSeconds !== 900) {
      throw new CompanionCapabilityError("session-idle-timeout");
    }
    if (value.nextSequence !== null &&
        value.nextSequence !== value.acceptedSequence + 1) {
      throw new CompanionCapabilityError("session-next-sequence");
    }
    return value;
  }

  function encodeSessionStatus(value) {
    validateSessionStatus(value);
    return canonicalJsonBytes({
      schema: value.schema,
      protocolId: value.protocolId,
      installationId: value.installationId,
      processInstanceId: value.processInstanceId,
      sessionId: value.sessionId,
      keyEpoch: value.keyEpoch,
      acceptedSequence: value.acceptedSequence,
      nextSequence: value.nextSequence,
      sessionExpiresAtUtc: value.sessionExpiresAtUtc,
      keyExpiresAtUtc: value.keyExpiresAtUtc,
      idleTimeoutSeconds: value.idleTimeoutSeconds
    }, MAXIMUM_SESSION_STATUS_BYTES, "session-status-wire");
  }

  function encodeRotationBegin(value) {
    requireExactKeys(value, ["schema", "rotationId", "browserNonce"],
      "rotation-begin");
    if (value.schema !== SCHEMAS.rotationBegin) {
      throw new CompanionCapabilityError("rotation-begin-schema");
    }
    requireHexIdentifier(value.rotationId, 16, "rotation-id");
    requireNonce(value.browserNonce, "rotation-browser-nonce");
    return canonicalJsonBytes({
      schema: value.schema,
      rotationId: value.rotationId,
      browserNonce: value.browserNonce
    }, MAXIMUM_ROTATION_MESSAGE_BYTES, "rotation-begin-wire");
  }

  function decodeRotationChallenge(bytes) {
    return decodeCanonicalJson(
      bytes,
      MAXIMUM_ROTATION_MESSAGE_BYTES,
      validateRotationChallenge,
      encodeRotationChallenge,
      "rotation-challenge-wire"
    );
  }

  function validateRotationChallenge(value) {
    requireExactKeys(value, [
      "schema", "rotationId", "browserNonce", "serverNonce", "currentEpoch",
      "nextEpoch", "pendingExpiresAtUtc"
    ], "rotation-challenge");
    if (value.schema !== SCHEMAS.rotationChallenge) {
      throw new CompanionCapabilityError("rotation-challenge-schema");
    }
    requireHexIdentifier(value.rotationId, 16, "rotation-id");
    requireNonce(value.browserNonce, "rotation-browser-nonce");
    requireNonce(value.serverNonce, "rotation-server-nonce");
    requireEpoch(value.currentEpoch, "rotation-current-epoch");
    requireEpoch(value.nextEpoch, "rotation-next-epoch");
    if (value.nextEpoch !== value.currentEpoch + 1) {
      throw new CompanionCapabilityError("rotation-epoch-order");
    }
    requireTimestamp(value.pendingExpiresAtUtc, "rotation-pending-expiry");
    return value;
  }

  function encodeRotationChallenge(value) {
    validateRotationChallenge(value);
    return canonicalJsonBytes({
      schema: value.schema,
      rotationId: value.rotationId,
      browserNonce: value.browserNonce,
      serverNonce: value.serverNonce,
      currentEpoch: value.currentEpoch,
      nextEpoch: value.nextEpoch,
      pendingExpiresAtUtc: value.pendingExpiresAtUtc
    }, MAXIMUM_ROTATION_MESSAGE_BYTES, "rotation-challenge-wire");
  }

  function encodeRotationCommit(value) {
    requireExactKeys(value, [
      "schema", "rotationId", "browserNonce", "serverNonce", "currentEpoch",
      "nextEpoch", "newKeyProof"
    ], "rotation-commit");
    if (value.schema !== SCHEMAS.rotationCommit) {
      throw new CompanionCapabilityError("rotation-commit-schema");
    }
    requireHexIdentifier(value.rotationId, 16, "rotation-id");
    requireNonce(value.browserNonce, "rotation-browser-nonce");
    requireNonce(value.serverNonce, "rotation-server-nonce");
    requireEpoch(value.currentEpoch, "rotation-current-epoch");
    requireEpoch(value.nextEpoch, "rotation-next-epoch");
    if (value.nextEpoch !== value.currentEpoch + 1) {
      throw new CompanionCapabilityError("rotation-epoch-order");
    }
    requireNonce(value.newKeyProof, "rotation-new-key-proof");
    return canonicalJsonBytes({
      schema: value.schema,
      rotationId: value.rotationId,
      browserNonce: value.browserNonce,
      serverNonce: value.serverNonce,
      currentEpoch: value.currentEpoch,
      nextEpoch: value.nextEpoch,
      newKeyProof: value.newKeyProof
    }, MAXIMUM_ROTATION_MESSAGE_BYTES, "rotation-commit-wire");
  }

  function decodeRotationCommitted(bytes) {
    return decodeCanonicalJson(
      bytes,
      MAXIMUM_ROTATION_MESSAGE_BYTES,
      validateRotationCommitted,
      encodeRotationCommitted,
      "rotation-committed-wire"
    );
  }

  function validateRotationCommitted(value) {
    requireExactKeys(value, [
      "schema", "rotationId", "keyEpoch", "keyExpiresAtUtc", "completionProof"
    ], "rotation-committed");
    if (value.schema !== SCHEMAS.rotationCommitted) {
      throw new CompanionCapabilityError("rotation-committed-schema");
    }
    requireHexIdentifier(value.rotationId, 16, "rotation-id");
    requireEpoch(value.keyEpoch, "rotation-key-epoch");
    requireTimestamp(value.keyExpiresAtUtc, "rotation-key-expiry");
    requireNonce(value.completionProof, "rotation-completion-proof");
    return value;
  }

  function encodeRotationCommitted(value) {
    validateRotationCommitted(value);
    return canonicalJsonBytes({
      schema: value.schema,
      rotationId: value.rotationId,
      keyEpoch: value.keyEpoch,
      keyExpiresAtUtc: value.keyExpiresAtUtc,
      completionProof: value.completionProof
    }, MAXIMUM_ROTATION_MESSAGE_BYTES, "rotation-committed-wire");
  }

  function encodeRevokeRequest(value) {
    requireExactKeys(value, ["schema", "revocationId"], "revoke-request");
    if (value.schema !== SCHEMAS.revokeRequest) {
      throw new CompanionCapabilityError("revoke-schema");
    }
    requireHexIdentifier(value.revocationId, 16, "revocation-id");
    return canonicalJsonBytes({
      schema: value.schema,
      revocationId: value.revocationId
    }, MAXIMUM_REVOCATION_MESSAGE_BYTES, "revoke-request-wire");
  }

  function decodeRevokedResponse(bytes) {
    return decodeCanonicalJson(
      bytes,
      MAXIMUM_REVOCATION_MESSAGE_BYTES,
      validateRevokedResponse,
      encodeRevokedResponse,
      "revoked-response-wire"
    );
  }

  function validateRevokedResponse(value) {
    requireExactKeys(value, ["schema", "revocationId", "revoked"],
      "revoked-response");
    if (value.schema !== SCHEMAS.revokedResponse || value.revoked !== true) {
      throw new CompanionCapabilityError("revoked-response-schema");
    }
    requireHexIdentifier(value.revocationId, 16, "revocation-id");
    return value;
  }

  function encodeRevokedResponse(value) {
    validateRevokedResponse(value);
    return canonicalJsonBytes({
      schema: value.schema,
      revocationId: value.revocationId,
      revoked: value.revoked
    }, MAXIMUM_REVOCATION_MESSAGE_BYTES, "revoked-response-wire");
  }

  function decodeErrorResponse(bytes) {
    return decodeCanonicalJson(
      bytes,
      MAXIMUM_ERROR_RESPONSE_BYTES,
      validateErrorResponse,
      encodeErrorResponse,
      "error-response-wire"
    );
  }

  function validateErrorResponse(value) {
    requireExactKeys(value, ["schema", "code"], "error-response");
    if (value.schema !== SCHEMAS.error ||
        !/^[a-z][a-z0-9-]{2,63}$/u.test(requireString(value.code,
          "error-response-code", 64))) {
      throw new CompanionCapabilityError("error-response-schema");
    }
    return value;
  }

  function encodeErrorResponse(value) {
    validateErrorResponse(value);
    return canonicalJsonBytes({ schema: value.schema, code: value.code },
      MAXIMUM_ERROR_RESPONSE_BYTES, "error-response-wire");
  }

  function normalizeAcquireRequest(value) {
    requireExactKeys(value, [
      "schema", "modelId", "sourceRepository", "sourceRevision",
      "modelSourceLockSha256", "tokenizerSourceLockSha256",
      "compositionProfileSha256", "sourceAcquisitionApproved",
      "maximumSourceBytes", "peerCandidates"
    ], "acquire-request");
    if (value.schema !== SCHEMAS.acquire) {
      throw new CompanionCapabilityError("acquire-schema");
    }
    if (!/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/u.test(
      requireString(value.modelId, "acquire-model-id", 128))) {
      throw new CompanionCapabilityError("acquire-model-id");
    }
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,94}[A-Za-z0-9])?\/[A-Za-z0-9](?:[A-Za-z0-9._-]{0,94}[A-Za-z0-9])?$/u.test(
      requireString(value.sourceRepository, "acquire-source-repository", 191))) {
      throw new CompanionCapabilityError("acquire-source-repository");
    }
    requireHexIdentifier(value.sourceRevision, 20, "acquire-source-revision");
    requireSha256(value.modelSourceLockSha256, "acquire-model-source-lock");
    requireSha256(value.tokenizerSourceLockSha256, "acquire-tokenizer-source-lock");
    requireSha256(value.compositionProfileSha256, "acquire-composition-profile");
    requireBoolean(value.sourceAcquisitionApproved, "acquire-source-approved");
    if (requireUInt(value.maximumSourceBytes, "acquire-source-size-limit",
      MAXIMUM_SOURCE_BYTES) === 0) {
      throw new CompanionCapabilityError("acquire-source-size-limit");
    }
    if (!Array.isArray(value.peerCandidates) ||
        value.peerCandidates.length > MAXIMUM_PEER_CANDIDATES) {
      throw new CompanionCapabilityError("acquire-peer-candidates");
    }
    const identities = new Set();
    const peerCandidates = value.peerCandidates.map((candidate) => {
      requireExactKeys(candidate, ["manifestUri", "manifestId"],
        "acquire-peer-candidate");
      const manifestUri = normalizePeerManifestUri(candidate.manifestUri);
      requireContentId(candidate.manifestId, "acquire-peer-manifest-id");
      const identity = `${candidate.manifestId}\n${manifestUri}`;
      if (identities.has(identity)) {
        throw new CompanionCapabilityError("acquire-peer-duplicate");
      }
      identities.add(identity);
      return Object.freeze({ manifestUri, manifestId: candidate.manifestId });
    });
    if (peerCandidates.length === 0 && value.sourceAcquisitionApproved !== true) {
      throw new CompanionCapabilityError("acquire-no-authorized-branch");
    }
    return Object.freeze({
      schema: value.schema,
      modelId: value.modelId,
      sourceRepository: value.sourceRepository,
      sourceRevision: value.sourceRevision,
      modelSourceLockSha256: value.modelSourceLockSha256,
      tokenizerSourceLockSha256: value.tokenizerSourceLockSha256,
      compositionProfileSha256: value.compositionProfileSha256,
      sourceAcquisitionApproved: value.sourceAcquisitionApproved,
      maximumSourceBytes: value.maximumSourceBytes,
      peerCandidates: Object.freeze(peerCandidates)
    });
  }

  function normalizePeerManifestUri(value) {
    const text = requireString(value, "acquire-peer-uri", 2048);
    let url;
    try {
      url = new URL(text);
    } catch (_error) {
      throw new CompanionCapabilityError("acquire-peer-uri");
    }
    if (url.protocol !== "https:" || url.username || url.password || url.search ||
        url.hash || url.pathname === "/" || url.pathname.endsWith("/") ||
        isIpLiteral(url.hostname)) {
      throw new CompanionCapabilityError("acquire-peer-uri");
    }
    const normalized = `${url.origin}${url.pathname}`;
    if (normalized.length > 2048) {
      throw new CompanionCapabilityError("acquire-peer-uri");
    }
    return normalized;
  }

  function isIpLiteral(hostname) {
    return /^\[[0-9A-Fa-f:.]+\]$/u.test(hostname) ||
      /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/u.test(hostname);
  }

  function requireContentId(value, code) {
    if (!/^[a-z0-9][a-z0-9._:-]{7,255}$/u.test(
      requireString(value, code, 256))) {
      throw new CompanionCapabilityError(code);
    }
  }

  function encodeAcquireRequest(value) {
    const request = normalizeAcquireRequest(value);
    return canonicalJsonBytes({
      schema: request.schema,
      modelId: request.modelId,
      sourceRepository: request.sourceRepository,
      sourceRevision: request.sourceRevision,
      modelSourceLockSha256: request.modelSourceLockSha256,
      tokenizerSourceLockSha256: request.tokenizerSourceLockSha256,
      compositionProfileSha256: request.compositionProfileSha256,
      sourceAcquisitionApproved: request.sourceAcquisitionApproved,
      maximumSourceBytes: request.maximumSourceBytes,
      peerCandidates: request.peerCandidates.map((candidate) => ({
        manifestUri: candidate.manifestUri,
        manifestId: candidate.manifestId
      }))
    }, MAXIMUM_OPERATION_REQUEST_BYTES, "acquire-request-wire");
  }

  async function computeOperationId(value) {
    return sha256Hex(encodeAcquireRequest(value));
  }

  function encodeCancelRequest(value) {
    requireExactKeys(value, ["schema", "cancellationId"], "cancel-request");
    if (value.schema !== SCHEMAS.cancelRequest) {
      throw new CompanionCapabilityError("cancel-request-schema");
    }
    requireHexIdentifier(value.cancellationId, 16, "cancellation-id");
    return canonicalJsonBytes({
      schema: value.schema,
      cancellationId: value.cancellationId
    }, MAXIMUM_REVOCATION_MESSAGE_BYTES, "cancel-request-wire");
  }

  function decodeOperationProjection(bytes) {
    return decodeCanonicalJson(
      bytes,
      MAXIMUM_OPERATION_PROJECTION_BYTES,
      validateOperationProjection,
      encodeOperationProjection,
      "operation-projection-wire"
    );
  }

  function validateOperationProjection(value) {
    requireExactKeys(value, [
      "schema", "operationId", "sequence", "state", "branch",
      "completedBytes", "totalBytes", "artifacts", "errorCode"
    ], "operation-projection");
    if (value.schema !== SCHEMAS.operationProjection) {
      throw new CompanionCapabilityError("operation-projection-schema");
    }
    requireSha256(value.operationId, "operation-id");
    requireUInt(value.sequence, "operation-sequence");
    if (!OPERATION_STATES.includes(value.state)) {
      throw new CompanionCapabilityError("operation-state");
    }
    if (!OPERATION_BRANCHES.includes(value.branch)) {
      throw new CompanionCapabilityError("operation-branch");
    }
    requireUInt(value.completedBytes, "operation-completed-bytes",
      MAXIMUM_SOURCE_BYTES * 5);
    requireNullableUInt(value.totalBytes, "operation-total-bytes",
      MAXIMUM_SOURCE_BYTES * 5);
    if (value.totalBytes !== null &&
        (value.totalBytes === 0 || value.completedBytes > value.totalBytes)) {
      throw new CompanionCapabilityError("operation-progress");
    }
    const artifacts = value.artifacts === null
      ? null
      : validateArtifactSet(value.artifacts);
    const errorCode = requireNullableString(value.errorCode,
      "operation-error-code", 64);
    if (errorCode !== null && !/^[a-z][a-z0-9-]{2,63}$/u.test(errorCode)) {
      throw new CompanionCapabilityError("operation-error-code");
    }
    if (value.state === "available") {
      if (artifacts === null || !["peer", "source"].includes(value.branch) ||
          errorCode !== null) {
        throw new CompanionCapabilityError("operation-available-fields");
      }
    } else if (artifacts !== null) {
      throw new CompanionCapabilityError("operation-artifacts-premature");
    }
    if ((value.state === "rejected") !== (errorCode !== null)) {
      throw new CompanionCapabilityError("operation-error-fields");
    }
    return Object.freeze({
      schema: value.schema,
      operationId: value.operationId,
      sequence: value.sequence,
      state: value.state,
      branch: value.branch,
      completedBytes: value.completedBytes,
      totalBytes: value.totalBytes,
      artifacts,
      errorCode
    });
  }

  function validateArtifactSet(value) {
    requireExactKeys(value, ARTIFACT_ROLES, "operation-artifacts");
    const result = {};
    const kinds = {
      composition: "acg2",
      model: "slm2",
      tokenizer: "tokenizer2",
      template: "template2",
      sampling: "sampling2",
      prompt: "prompt2"
    };
    let compositionBytes = 0;
    for (const role of ARTIFACT_ROLES) {
      const artifact = value[role];
      requireExactKeys(artifact, ["kind", "artifactId", "sha256", "byteCount"],
        `operation-artifact-${role}`);
      if (artifact.kind !== kinds[role]) {
        throw new CompanionCapabilityError(`operation-artifact-${role}`);
      }
      requireContentId(artifact.artifactId, `operation-artifact-${role}`);
      requireSha256(artifact.sha256, `operation-artifact-${role}`);
      if (requireUInt(artifact.byteCount, `operation-artifact-${role}`,
        MAXIMUM_ARTIFACT_BYTES) === 0) {
        throw new CompanionCapabilityError(`operation-artifact-${role}`);
      }
      compositionBytes += artifact.byteCount;
      if (compositionBytes > MAXIMUM_COMPOSITION_BYTES) {
        throw new CompanionCapabilityError("operation-artifact-total");
      }
      result[role] = Object.freeze({
        kind: artifact.kind,
        artifactId: artifact.artifactId,
        sha256: artifact.sha256,
        byteCount: artifact.byteCount
      });
    }
    return Object.freeze(result);
  }

  function encodeOperationProjection(value) {
    const projection = validateOperationProjection(value);
    const artifacts = projection.artifacts === null
      ? null
      : Object.fromEntries(ARTIFACT_ROLES.map((role) => [role, {
        kind: projection.artifacts[role].kind,
        artifactId: projection.artifacts[role].artifactId,
        sha256: projection.artifacts[role].sha256,
        byteCount: projection.artifacts[role].byteCount
      }]));
    return canonicalJsonBytes({
      schema: projection.schema,
      operationId: projection.operationId,
      sequence: projection.sequence,
      state: projection.state,
      branch: projection.branch,
      completedBytes: projection.completedBytes,
      totalBytes: projection.totalBytes,
      artifacts,
      errorCode: projection.errorCode
    }, MAXIMUM_OPERATION_PROJECTION_BYTES, "operation-projection-wire");
  }

  class CompanionCapabilityClient {
    constructor(options = {}) {
      requireAllowedKeys(options, ["fetch", "timeoutMilliseconds"],
        "client-options");
      const fetchImplementation = options.fetch ||
        (typeof globalThis === "object" ? globalThis.fetch : null);
      if (typeof fetchImplementation !== "function") {
        throw new CompanionCapabilityError("fetch-unavailable");
      }
      const timeout = options.timeoutMilliseconds ?? DEFAULT_TIMEOUT_MILLISECONDS;
      if (!Number.isSafeInteger(timeout) || timeout < 1000 || timeout > 60000) {
        throw new CompanionCapabilityError("client-timeout");
      }
      this._fetch = fetchImplementation;
      this._timeoutMilliseconds = timeout;
      this._endpoint = "";
      this._host = "";
      this._installationId = "";
      this._processInstanceId = "";
      this._sessionId = "";
      this._keyEpoch = 0;
      this._nextSequence = 0;
      this._sessionKey = null;
      this._pairingRecovery = null;
      this._rotationRecovery = null;
      this._inFlight = false;
    }

    get isPaired() {
      return this._sessionKey instanceof Uint8Array;
    }

    get session() {
      return this.isPaired
        ? Object.freeze({
          installationId: this._installationId,
          processInstanceId: this._processInstanceId,
          sessionId: this._sessionId,
          keyEpoch: this._keyEpoch,
          nextSequence: this._nextSequence
        })
        : null;
    }

    get recoveryState() {
      if (this._pairingRecovery) {
        return "pairing";
      }
      if (this._rotationRecovery) {
        return "rotation";
      }
      return null;
    }

    async pair(pairingCode) {
      if (this.isPaired || this._pairingRecovery || this._rotationRecovery ||
          this._inFlight) {
        throw new CompanionCapabilityError("client-state");
      }
      const pairing = parsePairingCode(pairingCode);
      this._inFlight = true;
      let sessionKey = null;
      try {
        const claimId = randomHex(16);
        const browserNonce = randomNonce();
        const beginRequest = {
          schema: SCHEMAS.pairingBeginRequest,
          claimId,
          browserNonce
        };
        const beginBytes = encodePairingBeginRequest(beginRequest);
        const beginResponse = await this._pairingRequest(
          pairing.endpoint,
          ROUTES.pairingBegin,
          beginBytes,
          MAXIMUM_PAIRING_BEGIN_RESPONSE_BYTES
        );
        const begin = decodePairingBeginResponse(beginResponse.bytes);
        if (begin.claimId !== claimId || begin.browserNonce !== browserNonce) {
          throw new CompanionCapabilityError("pairing-begin-identity");
        }
        const context = {
          installationId: begin.installationId,
          processInstanceId: begin.processInstanceId,
          claimId: begin.claimId,
          browserNonce: begin.browserNonce,
          serverNonce: begin.serverNonce,
          sessionId: begin.sessionId,
          keyEpoch: begin.keyEpoch,
          host: pairing.host,
          origin: PRODUCTION_ORIGIN,
          sessionExpiresAtUtc: begin.sessionExpiresAtUtc,
          idleTimeoutSeconds: begin.idleTimeoutSeconds
        };
        if (!await verifyPairingServerProof(
          pairing.secret,
          context,
          begin.pairingProof
        )) {
          throw new CompanionCapabilityError("pairing-proof-invalid");
        }
        sessionKey = await deriveSessionKey(pairing.secret, context);
        const completeRequest = {
          schema: SCHEMAS.pairingCompleteRequest,
          claimId: begin.claimId,
          browserNonce: begin.browserNonce,
          serverNonce: begin.serverNonce,
          sessionId: begin.sessionId,
          browserProof: await computePairingBrowserProof(sessionKey, context)
        };
        const completeBytes = encodePairingCompleteRequest(completeRequest);
        this._pairingRecovery = {
          endpoint: pairing.endpoint,
          host: pairing.host,
          context,
          completeBytes,
          sessionKey
        };
        sessionKey = null;
        try {
          return await this._completePendingPairing();
        } catch (error) {
          if (this._pairingRecovery) {
            throw new CompanionCapabilityError("pairing-outcome-unknown");
          }
          throw error;
        }
      } finally {
        pairing.secret.fill(0);
        if (sessionKey) {
          sessionKey.fill(0);
        }
        this._inFlight = false;
      }
    }

    async recoverPairing() {
      if (!this._pairingRecovery || this.isPaired || this._inFlight) {
        throw new CompanionCapabilityError("client-state");
      }
      this._inFlight = true;
      try {
        return await this._completePendingPairing();
      } catch (error) {
        if (this._pairingRecovery) {
          throw new CompanionCapabilityError("pairing-outcome-unknown");
        }
        throw error;
      } finally {
        this._inFlight = false;
      }
    }

    async status() {
      const result = await this._authenticatedJson(
        "GET",
        ROUTES.session,
        null,
        MAXIMUM_SESSION_STATUS_BYTES,
        decodeSessionStatus
      );
      const status = result.value;
      if (status.installationId !== this._installationId ||
          status.processInstanceId !== this._processInstanceId ||
          status.sessionId !== this._sessionId ||
          status.keyEpoch !== this._keyEpoch ||
          status.acceptedSequence !== result.sequence ||
          status.nextSequence !== result.sequence + 1) {
        this.close();
        throw new CompanionCapabilityError("session-status-identity");
      }
      return status;
    }

    async rotate() {
      this._requireSession();
      const rotationId = randomHex(16);
      const browserNonce = randomNonce();
      const begin = encodeRotationBegin({
        schema: SCHEMAS.rotationBegin,
        rotationId,
        browserNonce
      });
      const challengeResult = await this._authenticatedJson(
        "POST",
        ROUTES.rotationBegin,
        begin,
        MAXIMUM_ROTATION_MESSAGE_BYTES,
        decodeRotationChallenge
      );
      const challenge = challengeResult.value;
      if (challenge.rotationId !== rotationId ||
          challenge.browserNonce !== browserNonce ||
          challenge.currentEpoch !== this._keyEpoch ||
          challenge.nextEpoch !== this._keyEpoch + 1) {
        this.close();
        throw new CompanionCapabilityError("rotation-challenge-identity");
      }
      const context = {
        installationId: this._installationId,
        processInstanceId: this._processInstanceId,
        sessionId: this._sessionId,
        rotationId: challenge.rotationId,
        browserNonce: challenge.browserNonce,
        serverNonce: challenge.serverNonce,
        currentEpoch: challenge.currentEpoch,
        nextEpoch: challenge.nextEpoch,
        host: this._host,
        origin: PRODUCTION_ORIGIN
      };
      const oldKey = this._sessionKey;
      const newKey = await deriveRotatedSessionKey(oldKey, context);
      const commitBytes = encodeRotationCommit({
        schema: SCHEMAS.rotationCommit,
        rotationId: challenge.rotationId,
        browserNonce: challenge.browserNonce,
        serverNonce: challenge.serverNonce,
        currentEpoch: challenge.currentEpoch,
        nextEpoch: challenge.nextEpoch,
        newKeyProof: await computeRotationNewKeyProof(newKey, context)
      });
      this._rotationRecovery = {
        context,
        commitBytes,
        commitSequence: this._nextSequence,
        newKey
      };
      return this._completePendingRotation();
    }

    async recoverRotation() {
      if (!this._rotationRecovery || !this.isPaired || this._inFlight) {
        throw new CompanionCapabilityError("client-state");
      }
      return this._completePendingRotation();
    }

    async revoke() {
      const revocationId = randomHex(16);
      try {
        const result = await this._authenticatedJson(
          "POST",
          ROUTES.revoke,
          encodeRevokeRequest({ schema: SCHEMAS.revokeRequest, revocationId }),
          MAXIMUM_REVOCATION_MESSAGE_BYTES,
          decodeRevokedResponse
        );
        if (result.value.revocationId !== revocationId ||
            result.value.revoked !== true) {
          throw new CompanionCapabilityError("revoked-response-identity");
        }
        return true;
      } finally {
        this.close();
      }
    }

    async createOperation(request) {
      const normalized = normalizeAcquireRequest(request);
      const expectedOperationId = await computeOperationId(normalized);
      const result = await this._authenticatedJson(
        "POST",
        ROUTES.operations,
        encodeAcquireRequest(normalized),
        MAXIMUM_OPERATION_PROJECTION_BYTES,
        decodeOperationProjection
      );
      if (result.value.operationId !== expectedOperationId) {
        throw new CompanionCapabilityError("operation-identity");
      }
      return result.value;
    }

    async getOperation(operationId) {
      requireSha256(operationId, "operation-id");
      const result = await this._authenticatedJson(
        "GET",
        `${ROUTES.operations}/${operationId}`,
        null,
        MAXIMUM_OPERATION_PROJECTION_BYTES,
        decodeOperationProjection
      );
      if (result.value.operationId !== operationId) {
        throw new CompanionCapabilityError("operation-identity");
      }
      return result.value;
    }

    async cancelOperation(operationId, cancellationId = randomHex(16)) {
      requireSha256(operationId, "operation-id");
      const body = encodeCancelRequest({
        schema: SCHEMAS.cancelRequest,
        cancellationId
      });
      const result = await this._authenticatedJson(
        "POST",
        `${ROUTES.operations}/${operationId}/cancel`,
        body,
        MAXIMUM_OPERATION_PROJECTION_BYTES,
        decodeOperationProjection
      );
      if (result.value.operationId !== operationId) {
        throw new CompanionCapabilityError("operation-identity");
      }
      return result.value;
    }

    async getArtifactChunk(operationId, artifactRole, chunkIndex, expectedArtifact) {
      requireSha256(operationId, "artifact-operation-id");
      if (!ARTIFACT_ROLES.includes(artifactRole)) {
        throw new CompanionCapabilityError("artifact-role");
      }
      requireUInt(chunkIndex, "artifact-chunk-index", 16383);
      const path = `${ROUTES.operations}/${operationId}/artifacts/${artifactRole}/chunks/${chunkIndex}`;
      const result = await this._authenticated(
        "GET",
        path,
        null,
        MAXIMUM_ARTIFACT_CHUNK_BYTES,
        "application/octet-stream",
        (response) => artifactMetadataFromHeaders(
          response,
          operationId,
          artifactRole,
          chunkIndex
        )
      );
      const metadata = result.metadata;
      const metadataSha256 = await computeArtifactMetadataSha256(metadata);
      if (metadataSha256 !== result.responseMetadataSha256) {
        throw new CompanionCapabilityError("artifact-metadata-identity");
      }
      if (expectedArtifact !== undefined && expectedArtifact !== null) {
        requireExactKeys(expectedArtifact, ["artifactId", "sha256", "byteCount"],
          "artifact-expected");
        if (metadata.artifactId !== expectedArtifact.artifactId ||
            metadata.artifactSha256 !== expectedArtifact.sha256 ||
            metadata.artifactBytes !== expectedArtifact.byteCount) {
          throw new CompanionCapabilityError("artifact-identity-drift");
        }
      }
      return Object.freeze({
        bytes: result.bytes,
        metadata: Object.freeze(metadata),
        contentSha256: result.contentSha256
      });
    }

    close() {
      this._clearPairingRecovery();
      this._clearRotationRecovery();
      if (this._sessionKey) {
        this._sessionKey.fill(0);
      }
      this._endpoint = "";
      this._host = "";
      this._installationId = "";
      this._processInstanceId = "";
      this._sessionId = "";
      this._keyEpoch = 0;
      this._nextSequence = 0;
      this._sessionKey = null;
      this._inFlight = false;
    }

    async _completePendingPairing() {
      const pending = this._pairingRecovery;
      if (!pending) {
        throw new CompanionCapabilityError("client-state");
      }
      let completeResponse;
      try {
        completeResponse = await this._pairingRequest(
          pending.endpoint,
          ROUTES.pairingComplete,
          pending.completeBytes,
          MAXIMUM_PAIRING_COMPLETE_RESPONSE_BYTES
        );
      } catch (error) {
        if (error instanceof CompanionCapabilityError && error.status > 0 &&
            ["pairing-code-expired", "pairing-claim-conflict", "pairing-consumed"]
              .includes(error.code)) {
          this._clearPairingRecovery();
        }
        throw error;
      }
      let complete;
      try {
        complete = decodePairingCompleteResponse(completeResponse.bytes);
        if (complete.installationId !== pending.context.installationId ||
            complete.processInstanceId !== pending.context.processInstanceId ||
            complete.sessionId !== pending.context.sessionId ||
            complete.keyEpoch !== pending.context.keyEpoch ||
            complete.sessionExpiresAtUtc !== pending.context.sessionExpiresAtUtc ||
            complete.idleTimeoutSeconds !== pending.context.idleTimeoutSeconds ||
            !await verifyPairingCompletionProof(
              pending.sessionKey,
              pending.context,
              await sha256Hex(pending.completeBytes),
              complete.completionProof
            )) {
          throw new CompanionCapabilityError("pairing-completion-invalid");
        }
      } catch (error) {
        this._clearPairingRecovery();
        throw error;
      }
      this._endpoint = pending.endpoint;
      this._host = pending.host;
      this._installationId = complete.installationId;
      this._processInstanceId = complete.processInstanceId;
      this._sessionId = complete.sessionId;
      this._keyEpoch = complete.keyEpoch;
      this._nextSequence = 1;
      this._sessionKey = pending.sessionKey;
      this._pairingRecovery = null;
      return this.session;
    }

    async _completePendingRotation() {
      const pending = this._rotationRecovery;
      if (!pending || this._nextSequence !== pending.commitSequence) {
        this.close();
        throw new CompanionCapabilityError("rotation-recovery-state");
      }
      let committedResult;
      try {
        committedResult = await this._authenticatedJson(
          "POST",
          ROUTES.rotationCommit,
          pending.commitBytes,
          MAXIMUM_ROTATION_MESSAGE_BYTES,
          decodeRotationCommitted,
          {
            responseKey: pending.newKey,
            allowRotationRecovery: true,
            preserveOnAmbiguous: true
          }
        );
      } catch (error) {
        if (this._nextSequence !== pending.commitSequence) {
          if (error instanceof CompanionCapabilityError && error.status >= 400) {
            this._clearRotationRecovery();
            throw error;
          }
          this.close();
          throw error;
        }
        throw new CompanionCapabilityError("rotation-outcome-unknown");
      }
      const committed = committedResult.value;
      if (committed.rotationId !== pending.context.rotationId ||
          committed.keyEpoch !== pending.context.nextEpoch ||
          !await verifyRotationCompletionProof(
            pending.newKey,
            pending.context,
            await sha256Hex(pending.commitBytes),
            committed.completionProof
          )) {
        this.close();
        throw new CompanionCapabilityError("rotation-completion-invalid");
      }
      const oldKey = this._sessionKey;
      const newKey = pending.newKey;
      this._rotationRecovery = null;
      this._sessionKey = newKey;
      this._keyEpoch = pending.context.nextEpoch;
      this._nextSequence = 1;
      oldKey.fill(0);
      return this.session;
    }

    _clearPairingRecovery() {
      if (this._pairingRecovery?.sessionKey) {
        this._pairingRecovery.sessionKey.fill(0);
      }
      this._pairingRecovery = null;
    }

    _clearRotationRecovery() {
      if (this._rotationRecovery?.newKey) {
        this._rotationRecovery.newKey.fill(0);
      }
      this._rotationRecovery = null;
    }

    async _pairingRequest(endpoint, path, body, maximumResponseBytes) {
      let response;
      try {
        response = await fetchBounded(
          this._fetch,
          `${endpoint}${path}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            mode: "cors",
            credentials: "omit",
            cache: "no-store",
            redirect: "error",
            referrerPolicy: "no-referrer",
            keepalive: false
          },
          this._timeoutMilliseconds
        );
      } catch (error) {
        throw normalizeFetchError(error);
      }
      const contentType = exactHeader(response.headers, "content-type");
      const maximum = response.status === 200
        ? maximumResponseBytes
        : MAXIMUM_ERROR_RESPONSE_BYTES;
      const bytes = await readBoundedResponse(response, maximum);
      if (response.status !== 200) {
        if (contentType !== "application/json") {
          throw new CompanionCapabilityError("pairing-response-media-type",
            response.status);
        }
        const error = decodeErrorResponse(bytes);
        throw new CompanionCapabilityError(error.code, response.status);
      }
      if (contentType !== "application/json") {
        throw new CompanionCapabilityError("pairing-response-media-type",
          response.status);
      }
      return Object.freeze({ response, bytes });
    }

    async _authenticatedJson(
      method,
      path,
      body,
      maximumResponseBytes,
      decode,
      options = {}
    ) {
      const result = await this._authenticated(
        method,
        path,
        body,
        maximumResponseBytes,
        "application/json",
        null,
        options
      );
      return Object.freeze({
        value: decode(result.bytes),
        sequence: result.sequence
      });
    }

    async _authenticated(
      method,
      path,
      body,
      maximumResponseBytes,
      successContentType,
      metadataReader,
      options = {}
    ) {
      requireAllowedKeys(options, [
        "responseKey", "allowRotationRecovery", "preserveOnAmbiguous"
      ], "authenticated-options");
      const responseKey = options.responseKey || this._sessionKey;
      this._requireSession(options.allowRotationRecovery === true);
      if (this._inFlight) {
        throw new CompanionCapabilityError("session-request-in-flight");
      }
      if (method !== "GET" && method !== "POST") {
        throw new CompanionCapabilityError("request-method");
      }
      const requestBody = method === "GET"
        ? new Uint8Array()
        : requireBytes(body, "request-body");
      const contentType = method === "POST" ? "application/json" : "";
      const sequence = this._nextSequence;
      const key = this._sessionKey;
      const requestContext = {
        installationId: this._installationId,
        processInstanceId: this._processInstanceId,
        sessionId: this._sessionId,
        keyEpoch: this._keyEpoch,
        sequence,
        method,
        host: this._host,
        origin: PRODUCTION_ORIGIN,
        path,
        contentType,
        contentLength: requestBody.byteLength,
        contentSha256: await sha256Hex(requestBody)
      };
      const headers = {
        "X-TinyRustLM-Session": this._sessionId,
        "X-TinyRustLM-Epoch": String(this._keyEpoch),
        "X-TinyRustLM-Sequence": String(sequence),
        "X-TinyRustLM-Content-SHA256": requestContext.contentSha256,
        "X-TinyRustLM-Request-Proof": await computeRequestProof(key, requestContext)
      };
      if (method === "POST") {
        headers["Content-Type"] = "application/json";
      }
      this._inFlight = true;
      let response;
      try {
        response = await fetchBounded(
          this._fetch,
          `${this._endpoint}${path}`,
          {
            method,
            headers,
            body: method === "POST" ? requestBody : undefined,
            mode: "cors",
            credentials: "omit",
            cache: "no-store",
            redirect: "error",
            referrerPolicy: "no-referrer",
            keepalive: false
          },
          successContentType === "application/octet-stream"
            ? CHUNK_TIMEOUT_MILLISECONDS
            : this._timeoutMilliseconds
        );
        const maximum = response.status >= 200 && response.status < 300
          ? maximumResponseBytes
          : MAXIMUM_ERROR_RESPONSE_BYTES;
        const bytes = await readBoundedResponse(response, maximum);
        const responseContentType = exactHeader(response.headers, "content-type");
        const contentSha256 = await sha256Hex(bytes);
        if (exactHeader(response.headers, "x-tinyrustlm-session") !== this._sessionId ||
            parseCanonicalHeaderUInt(response.headers, "x-tinyrustlm-epoch", 64) !==
              this._keyEpoch ||
            parseCanonicalHeaderUInt(response.headers, "x-tinyrustlm-sequence", 1000000) !==
              sequence ||
            exactHeader(response.headers, "x-tinyrustlm-content-sha256") !==
              contentSha256) {
          throw new CompanionCapabilityError("response-identity");
        }
        const metadata = metadataReader ? metadataReader(response) : null;
        const responseMetadataSha256 = exactHeader(
          response.headers,
          "x-tinyrustlm-response-metadata-sha256"
        );
        if (!metadataReader && responseMetadataSha256 !== EMPTY_SHA256) {
          throw new CompanionCapabilityError("response-metadata");
        }
        requireSha256(responseMetadataSha256, "response-metadata");
        const responseContext = {
          installationId: this._installationId,
          processInstanceId: this._processInstanceId,
          sessionId: this._sessionId,
          keyEpoch: this._keyEpoch,
          sequence,
          requestMethod: method,
          requestPath: path,
          status: response.status,
          contentType: responseContentType,
          contentLength: bytes.byteLength,
          responseMetadataSha256,
          contentSha256
        };
        if (!await verifyResponseProof(
          responseKey,
          responseContext,
          exactHeader(response.headers, "x-tinyrustlm-response-proof")
        )) {
          throw new CompanionCapabilityError("response-proof-invalid");
        }
        this._nextSequence = sequence + 1;
        if (response.status < 200 || response.status >= 300) {
          if (responseContentType !== "application/json") {
            throw new CompanionCapabilityError("response-media-type", response.status);
          }
          const error = decodeErrorResponse(bytes);
          throw new CompanionCapabilityError(error.code, response.status);
        }
        if (responseContentType !== successContentType) {
          throw new CompanionCapabilityError("response-media-type", response.status);
        }
        return Object.freeze({
          bytes,
          metadata,
          sequence,
          contentSha256,
          responseMetadataSha256
        });
      } catch (error) {
        if (!options.preserveOnAmbiguous &&
            !(error instanceof CompanionCapabilityError &&
            error.status > 0 && response &&
            this._nextSequence === sequence + 1)) {
          this.close();
        }
        throw normalizeFetchError(error);
      } finally {
        this._inFlight = false;
      }
    }

    _requireSession(allowRotationRecovery = false) {
      if (!this.isPaired || !this._endpoint || !this._host ||
          !this._installationId || !this._processInstanceId || !this._sessionId ||
          this._keyEpoch < 1 || this._nextSequence < 1 ||
          (this._rotationRecovery && !allowRotationRecovery)) {
        throw new CompanionCapabilityError("capability-invalid");
      }
    }
  }

  function artifactMetadataFromHeaders(
    response,
    operationId,
    artifactRole,
    chunkIndex
  ) {
    const metadata = {
      operationId,
      artifactRole: exactHeader(response.headers, "x-tinyrustlm-artifact-role"),
      artifactId: exactHeader(response.headers, "x-tinyrustlm-artifact-id"),
      artifactSha256: exactHeader(response.headers, "x-tinyrustlm-artifact-sha256"),
      artifactBytes: parseCanonicalHeaderUInt(
        response.headers,
        "x-tinyrustlm-artifact-bytes",
        MAXIMUM_ARTIFACT_BYTES
      ),
      chunkIndex: parseCanonicalHeaderUInt(
        response.headers,
        "x-tinyrustlm-chunk-index",
        16383
      ),
      chunkCount: parseCanonicalHeaderUInt(
        response.headers,
        "x-tinyrustlm-chunk-count",
        16384
      ),
      chunkOffset: parseCanonicalHeaderUInt(
        response.headers,
        "x-tinyrustlm-chunk-offset",
        MAXIMUM_ARTIFACT_BYTES
      ),
      chunkBytes: parseCanonicalHeaderUInt(
        response.headers,
        "x-tinyrustlm-chunk-bytes",
        MAXIMUM_ARTIFACT_CHUNK_BYTES
      )
    };
    if (metadata.artifactRole !== artifactRole || metadata.chunkIndex !== chunkIndex) {
      throw new CompanionCapabilityError("artifact-metadata-identity");
    }
    validateArtifactMetadata(metadata);
    return metadata;
  }

  function exactHeader(headers, name) {
    if (!headers || typeof headers.get !== "function") {
      throw new CompanionCapabilityError("response-headers");
    }
    const value = headers.get(name);
    if (typeof value !== "string" || value.length === 0 || value.includes(",") ||
        value.includes("\r") || value.includes("\n")) {
      throw new CompanionCapabilityError("response-header");
    }
    return value;
  }

  function parseCanonicalHeaderUInt(headers, name, maximum) {
    const value = exactHeader(headers, name);
    if (!/^(?:0|[1-9][0-9]*)$/u.test(value)) {
      throw new CompanionCapabilityError("response-header-integer");
    }
    const parsed = Number(value);
    return requireUInt(parsed, "response-header-integer", maximum);
  }

  async function readBoundedResponse(response, maximumBytes) {
    if (!response || !Number.isSafeInteger(response.status) ||
        response.status < 100 || response.status > 599 ||
        !Number.isSafeInteger(maximumBytes) || maximumBytes < 1 ||
        maximumBytes > MAXIMUM_RESPONSE_BYTES) {
      throw new CompanionCapabilityError("response-invalid");
    }
    const declared = parseCanonicalHeaderUInt(
      response.headers,
      "content-length",
      maximumBytes
    );
    if (declared < 1 ||
        exactOptionalHeader(response.headers, "content-encoding") !== null) {
      throw new CompanionCapabilityError("response-framing");
    }
    let buffer;
    try {
      buffer = await response.arrayBuffer();
    } catch (_error) {
      throw new CompanionCapabilityError("response-body");
    }
    const bytes = new Uint8Array(buffer);
    if (bytes.byteLength !== declared || bytes.byteLength > maximumBytes) {
      throw new CompanionCapabilityError("response-framing");
    }
    return bytes;
  }

  function exactOptionalHeader(headers, name) {
    if (!headers || typeof headers.get !== "function") {
      throw new CompanionCapabilityError("response-headers");
    }
    const value = headers.get(name);
    if (value === null) {
      return null;
    }
    if (typeof value !== "string" || value.length === 0 || value.includes(",") ||
        value.includes("\r") || value.includes("\n")) {
      throw new CompanionCapabilityError("response-header");
    }
    return value;
  }

  async function fetchBounded(fetchImplementation, url, options, timeoutMilliseconds) {
    if (typeof AbortController !== "function") {
      throw new CompanionCapabilityError("abort-controller-unavailable");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);
    try {
      return await fetchImplementation(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  function normalizeFetchError(error) {
    if (error instanceof CompanionCapabilityError) {
      return error;
    }
    if (error && error.name === "AbortError") {
      return new CompanionCapabilityError("companion-timeout");
    }
    return new CompanionCapabilityError("companion-unavailable");
  }

  return Object.freeze({
    PROTOCOL_ID,
    PRODUCTION_ORIGIN,
    INSTALLATION_SCHEMA,
    EMPTY_SHA256,
    ROUTES,
    SCHEMAS,
    ARTIFACT_ROLES,
    OPERATION_STATES,
    DOMAINS,
    CompanionCapabilityError,
    CompanionCapabilityClient,
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
    decodeInstallationRecordFile,
    parsePairingCode,
    encodePairingBeginRequest,
    decodePairingBeginResponse,
    encodePairingBeginResponse,
    encodePairingCompleteRequest,
    decodePairingCompleteResponse,
    encodePairingCompleteResponse,
    decodeSessionStatus,
    encodeSessionStatus,
    encodeRotationBegin,
    decodeRotationChallenge,
    encodeRotationChallenge,
    encodeRotationCommit,
    decodeRotationCommitted,
    encodeRotationCommitted,
    encodeRevokeRequest,
    decodeRevokedResponse,
    encodeRevokedResponse,
    decodeErrorResponse,
    encodeErrorResponse,
    normalizeAcquireRequest,
    encodeAcquireRequest,
    computeOperationId,
    encodeCancelRequest,
    decodeOperationProjection,
    encodeOperationProjection
  });
}));
