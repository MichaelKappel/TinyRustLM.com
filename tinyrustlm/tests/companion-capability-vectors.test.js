"use strict";

const assert = require("node:assert/strict");
const { createHash, createHmac } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const capability = require("../tools/companion-capability-webcrypto.js");

const vectors = JSON.parse(fs.readFileSync(
  path.join(
    __dirname,
    "..",
    "..",
    "contracts",
    "vnext",
    "companion-loopback-capability-vectors.v1.json"
  ),
  "utf8"
));
const textEncoder = new TextEncoder();

function oracleTranscript(fields) {
  const parts = [];
  for (const field of fields) {
    const bytes = Buffer.from(field, "utf8");
    const length = Buffer.alloc(4);
    length.writeUInt32BE(bytes.length);
    parts.push(length, bytes);
  }
  return Buffer.concat(parts);
}

function oracleSha256(bytes) {
  return createHash("sha256").update(bytes).digest();
}

function oracleSha256Hex(bytes) {
  return oracleSha256(bytes).toString("hex");
}

function oracleProof(key, fields) {
  return createHmac("sha256", key)
    .update(oracleTranscript(fields))
    .digest("base64url");
}

function oracleHkdf(inputKeyMaterial, salt, info) {
  const prk = createHmac("sha256", salt).update(inputKeyMaterial).digest();
  return createHmac("sha256", prk)
    .update(Buffer.concat([info, Buffer.from([1])]))
    .digest();
}

function pairingFields(domain, includeExpiry = true) {
  const context = vectors.pairingContext;
  const fields = [
    domain,
    vectors.profileId,
    context.installationId,
    context.processInstanceId,
    context.claimId,
    context.browserNonce,
    context.serverNonce,
    context.sessionId,
    String(context.keyEpoch),
    context.host,
    context.origin
  ];
  if (includeExpiry) {
    fields.push(context.sessionExpiresAtUtc, String(context.idleTimeoutSeconds));
  }
  return fields;
}

function requestContext() {
  const context = vectors.pairingContext;
  const request = vectors.request;
  return {
    installationId: context.installationId,
    processInstanceId: context.processInstanceId,
    sessionId: context.sessionId,
    keyEpoch: context.keyEpoch,
    sequence: request.sequence,
    method: request.method,
    host: context.host,
    origin: context.origin,
    path: request.path,
    contentType: request.contentType,
    contentLength: request.contentLength,
    contentSha256: request.contentSha256
  };
}

function responseContext() {
  const context = vectors.pairingContext;
  const response = vectors.response;
  return {
    installationId: context.installationId,
    processInstanceId: context.processInstanceId,
    sessionId: context.sessionId,
    keyEpoch: context.keyEpoch,
    sequence: vectors.request.sequence,
    requestMethod: vectors.request.method,
    requestPath: vectors.request.path,
    status: response.status,
    contentType: response.contentType,
    contentLength: response.contentLength,
    responseMetadataSha256: response.responseMetadataSha256,
    contentSha256: response.contentSha256
  };
}

function artifactMetadata() {
  const artifact = vectors.artifact;
  return {
    operationId: artifact.operationId,
    artifactRole: artifact.role,
    artifactId: artifact.artifactId,
    artifactSha256: artifact.artifactSha256,
    artifactBytes: artifact.artifactBytes,
    chunkIndex: artifact.chunkIndex,
    chunkCount: artifact.chunkCount,
    chunkOffset: artifact.chunkOffset,
    chunkBytes: artifact.chunkBytes
  };
}

function artifactResponseContext() {
  const context = vectors.pairingContext;
  const artifact = vectors.artifact;
  return {
    installationId: context.installationId,
    processInstanceId: context.processInstanceId,
    sessionId: context.sessionId,
    keyEpoch: context.keyEpoch,
    sequence: artifact.responseSequence,
    requestMethod: "GET",
    requestPath: artifact.responsePath,
    status: 200,
    contentType: "application/octet-stream",
    contentLength: artifact.chunkBytes,
    responseMetadataSha256: artifact.metadataSha256,
    contentSha256: artifact.chunkContentSha256
  };
}

function rotationContext() {
  const pairing = vectors.pairingContext;
  const rotation = vectors.rotationContext;
  return {
    installationId: pairing.installationId,
    processInstanceId: pairing.processInstanceId,
    sessionId: pairing.sessionId,
    rotationId: rotation.rotationId,
    browserNonce: rotation.browserNonce,
    serverNonce: rotation.serverNonce,
    currentEpoch: rotation.currentEpoch,
    nextEpoch: rotation.nextEpoch,
    host: pairing.host,
    origin: pairing.origin
  };
}

function rotationFields(domain) {
  const context = rotationContext();
  return [
    domain,
    vectors.profileId,
    context.installationId,
    context.processInstanceId,
    context.sessionId,
    context.rotationId,
    context.browserNonce,
    context.serverNonce,
    String(context.currentEpoch),
    String(context.nextEpoch),
    context.host,
    context.origin
  ];
}

test("vector corpus is bound to only the corrected capability profile", () => {
  assert.equal(
    vectors.schema,
    "tinyrustlm.companion.loopback-capability-vectors.v1"
  );
  assert.equal(vectors.profileId, capability.PROTOCOL_ID);
  assert.equal(vectors.testMaterialIsSecret, false);
  assert.equal(vectors.pairingContext.origin, capability.PRODUCTION_ORIGIN);
});

test("independent Node crypto oracle recomputes every frozen vector", () => {
  const domains = capability.DOMAINS;
  const secret = Buffer.from(vectors.pairingSecretHex, "hex");
  const transcript = oracleTranscript(vectors.transcript.fields);
  assert.equal(transcript.toString("hex"), vectors.transcript.hex);
  assert.equal(oracleSha256Hex(transcript), vectors.transcript.sha256);

  assert.equal(
    oracleProof(secret, pairingFields(domains.pairingServerProof)),
    vectors.pairingExpected.serverProof
  );
  const sessionSalt = oracleSha256(
    oracleTranscript(pairingFields(domains.sessionSalt, false))
  );
  assert.equal(sessionSalt.toString("hex"), vectors.pairingExpected.sessionSaltHex);
  const sessionKey = oracleHkdf(
    secret,
    sessionSalt,
    oracleTranscript(pairingFields(domains.sessionKey))
  );
  assert.equal(sessionKey.toString("hex"), vectors.pairingExpected.sessionKeyHex);
  assert.equal(
    oracleProof(sessionKey, pairingFields(domains.pairingBrowserProof)),
    vectors.pairingExpected.browserProof
  );
  assert.equal(
    oracleProof(sessionKey, [
      ...pairingFields(domains.pairingCompletionProof),
      vectors.pairingExpected.completeRequestSha256
    ]),
    vectors.pairingExpected.completionProof
  );

  const request = requestContext();
  assert.equal(oracleProof(sessionKey, [
    domains.requestProof,
    vectors.profileId,
    request.installationId,
    request.processInstanceId,
    request.sessionId,
    String(request.keyEpoch),
    String(request.sequence),
    request.method,
    request.host,
    request.origin,
    request.path,
    request.contentType,
    String(request.contentLength),
    request.contentSha256
  ]), vectors.request.proof);

  const responseBytes = Buffer.from(vectors.response.bodyUtf8, "utf8");
  assert.equal(responseBytes.length, vectors.response.contentLength);
  assert.equal(oracleSha256Hex(responseBytes), vectors.response.contentSha256);
  const response = responseContext();
  assert.equal(oracleProof(sessionKey, [
    domains.responseProof,
    vectors.profileId,
    response.installationId,
    response.processInstanceId,
    response.sessionId,
    String(response.keyEpoch),
    String(response.sequence),
    response.requestMethod,
    response.requestPath,
    String(response.status),
    response.contentType,
    String(response.contentLength),
    response.responseMetadataSha256,
    response.contentSha256
  ]), vectors.response.proof);

  const artifact = artifactMetadata();
  const metadataSha256 = oracleSha256Hex(oracleTranscript([
    domains.artifactMetadata,
    artifact.operationId,
    artifact.artifactRole,
    artifact.artifactId,
    artifact.artifactSha256,
    String(artifact.artifactBytes),
    String(artifact.chunkIndex),
    String(artifact.chunkCount),
    String(artifact.chunkOffset),
    String(artifact.chunkBytes)
  ]));
  assert.equal(metadataSha256, vectors.artifact.metadataSha256);
  assert.equal(
    oracleSha256Hex(Buffer.from(vectors.artifact.chunkContentHex, "hex")),
    vectors.artifact.chunkContentSha256
  );
  const artifactResponse = artifactResponseContext();
  assert.equal(oracleProof(sessionKey, [
    domains.responseProof,
    vectors.profileId,
    artifactResponse.installationId,
    artifactResponse.processInstanceId,
    artifactResponse.sessionId,
    String(artifactResponse.keyEpoch),
    String(artifactResponse.sequence),
    artifactResponse.requestMethod,
    artifactResponse.requestPath,
    String(artifactResponse.status),
    artifactResponse.contentType,
    String(artifactResponse.contentLength),
    artifactResponse.responseMetadataSha256,
    artifactResponse.contentSha256
  ]), vectors.artifact.responseProof);

  const rotationSalt = oracleSha256(
    oracleTranscript(rotationFields(domains.rotationSalt))
  );
  assert.equal(rotationSalt.toString("hex"), vectors.rotationExpected.rotationSaltHex);
  const rotatedKey = oracleHkdf(
    sessionKey,
    rotationSalt,
    oracleTranscript(rotationFields(domains.rotationKey))
  );
  assert.equal(
    rotatedKey.toString("hex"),
    vectors.rotationExpected.rotatedSessionKeyHex
  );
  assert.equal(
    oracleProof(rotatedKey, rotationFields(domains.rotationNewKeyProof)),
    vectors.rotationExpected.newKeyProof
  );
  const rotation = rotationContext();
  assert.equal(oracleProof(rotatedKey, [
    domains.rotationCompletionProof,
    vectors.profileId,
    rotation.installationId,
    rotation.processInstanceId,
    rotation.sessionId,
    rotation.rotationId,
    String(rotation.nextEpoch),
    rotation.host,
    rotation.origin,
    vectors.rotationExpected.commitRequestSha256
  ]), vectors.rotationExpected.completionProof);

  const installationBytes = Buffer.from(
    vectors.installationRecord.canonicalFileHex,
    "hex"
  );
  assert.equal(
    oracleSha256Hex(installationBytes),
    vectors.installationRecord.sha256
  );
});

test("browser WebCrypto implementation matches pairing and request vectors", async () => {
  const secret = capability.hexToBytes(vectors.pairingSecretHex, "test-secret");
  const context = vectors.pairingContext;
  const sessionKey = await capability.deriveSessionKey(secret, context);

  assert.equal(
    capability.bytesToHex(capability.encodeTranscript(vectors.transcript.fields)),
    vectors.transcript.hex
  );
  assert.equal(
    await capability.sha256Hex(capability.encodeTranscript(vectors.transcript.fields)),
    vectors.transcript.sha256
  );
  assert.equal(
    await capability.computePairingServerProof(secret, context),
    vectors.pairingExpected.serverProof
  );
  assert.equal(
    capability.bytesToHex(sessionKey),
    vectors.pairingExpected.sessionKeyHex
  );
  assert.equal(
    await capability.computePairingBrowserProof(sessionKey, context),
    vectors.pairingExpected.browserProof
  );
  assert.equal(
    await capability.computePairingCompletionProof(
      sessionKey,
      context,
      vectors.pairingExpected.completeRequestSha256
    ),
    vectors.pairingExpected.completionProof
  );
  assert.equal(
    await capability.computeRequestProof(sessionKey, requestContext()),
    vectors.request.proof
  );
  assert.equal(
    await capability.computeResponseProof(sessionKey, responseContext()),
    vectors.response.proof
  );
});

test("browser WebCrypto implementation matches artifact and rotation vectors", async () => {
  const secret = capability.hexToBytes(vectors.pairingSecretHex, "test-secret");
  const sessionKey = await capability.deriveSessionKey(secret, vectors.pairingContext);
  assert.equal(
    await capability.computeArtifactMetadataSha256(artifactMetadata()),
    vectors.artifact.metadataSha256
  );
  assert.equal(
    await capability.computeResponseProof(sessionKey, artifactResponseContext()),
    vectors.artifact.responseProof
  );

  const rotation = rotationContext();
  const rotatedKey = await capability.deriveRotatedSessionKey(sessionKey, rotation);
  assert.equal(
    capability.bytesToHex(rotatedKey),
    vectors.rotationExpected.rotatedSessionKeyHex
  );
  assert.equal(
    await capability.computeRotationNewKeyProof(rotatedKey, rotation),
    vectors.rotationExpected.newKeyProof
  );
  assert.equal(
    await capability.computeRotationCompletionProof(
      rotatedKey,
      rotation,
      vectors.rotationExpected.commitRequestSha256
    ),
    vectors.rotationExpected.completionProof
  );
});

test("operation-specific verification rejects proof and metadata substitution", async () => {
  const secret = capability.hexToBytes(vectors.pairingSecretHex, "test-secret");
  const sessionKey = await capability.deriveSessionKey(secret, vectors.pairingContext);
  assert.equal(await capability.verifyPairingServerProof(
    secret,
    vectors.pairingContext,
    vectors.pairingExpected.serverProof
  ), true);
  assert.equal(await capability.verifyRequestProof(
    sessionKey,
    requestContext(),
    vectors.request.proof
  ), true);
  assert.equal(await capability.verifyRequestProof(
    sessionKey,
    { ...requestContext(), sequence: vectors.request.sequence + 1 },
    vectors.request.proof
  ), false);
  assert.equal(await capability.verifyRequestProof(
    sessionKey,
    requestContext(),
    `${vectors.request.proof.slice(0, -1)}A`
  ), false);

  const substitutedMetadata = {
    ...artifactMetadata(),
    artifactRole: "template"
  };
  const substitutedHash = await capability.computeArtifactMetadataSha256(
    substitutedMetadata
  );
  assert.notEqual(substitutedHash, vectors.artifact.metadataSha256);
  assert.equal(await capability.verifyResponseProof(
    sessionKey,
    {
      ...artifactResponseContext(),
      responseMetadataSha256: substitutedHash
    },
    vectors.artifact.responseProof
  ), false);
});

test("installation record has one exact canonical file representation", async () => {
  const record = {
    schema: capability.INSTALLATION_SCHEMA,
    installationId: vectors.pairingContext.installationId
  };
  const encoded = capability.encodeInstallationRecordFile(record);
  assert.equal(capability.bytesToHex(encoded), vectors.installationRecord.canonicalFileHex);
  assert.equal(await capability.sha256Hex(encoded), vectors.installationRecord.sha256);
  assert.deepEqual(capability.decodeInstallationRecordFile(encoded), record);

  const canonicalText = Buffer.from(encoded).toString("utf8");
  for (const invalid of [
    canonicalText.trimEnd(),
    ` ${canonicalText}`,
    canonicalText.replace(",\"installationId\"", ", \"installationId\""),
    canonicalText.replace(
      "\"installationId\"",
      `\"unknown\":true,\"installationId\"`
    ),
    canonicalText.replace(
      "\"installationId\":",
      `\"installationId\":\"${record.installationId}\",\"installationId\":`
    ),
    canonicalText.replace(
      "\"schema\":\"tinyrustlm",
      "\"schema\":\"tin\\u0079rustlm"
    )
  ]) {
    assert.throws(
      () => capability.decodeInstallationRecordFile(new Uint8Array(Buffer.from(invalid))),
      (error) => error && /^installation-record-/u.test(error.code)
    );
  }
});

test("codec rejects malformed UTF-16, identifiers, paths, and body contracts", async () => {
  assert.throws(
    () => capability.encodeTranscript(["\ud800"]),
    (error) => error && error.code === "transcript-field-utf8"
  );
  assert.throws(
    () => capability.encodeTranscript(new Array(33).fill("x")),
    (error) => error && error.code === "transcript-field-count"
  );
  assert.throws(
    () => capability.decodeBase64Url32(`${"A".repeat(42)}=`, "nonce-invalid"),
    (error) => error && error.code === "nonce-invalid"
  );

  const sessionKey = capability.hexToBytes(
    vectors.pairingExpected.sessionKeyHex,
    "test-key"
  );
  await assert.rejects(
    capability.computeRequestProof(sessionKey, {
      ...requestContext(),
      path: "/tinyrustlm-companion/1/session?probe=true"
    }),
    (error) => error && error.code === "request-proof-context"
  );
  await assert.rejects(
    capability.computeRequestProof(sessionKey, {
      ...requestContext(),
      contentType: "application/json",
      contentSha256: "a".repeat(64)
    }),
    (error) => error && error.code === "request-proof-body"
  );
  await assert.rejects(
    capability.computePairingServerProof(
      capability.hexToBytes(vectors.pairingSecretHex, "test-secret"),
      {
        ...vectors.pairingContext,
        sessionExpiresAtUtc: "2026-02-30T07:00:00Z"
      }
    ),
    (error) => error && error.code === "pairing-session-expiry"
  );
  await assert.rejects(
    capability.computePairingServerProof(
      capability.hexToBytes(vectors.pairingSecretHex, "test-secret"),
      {
        ...vectors.pairingContext,
        sessionExpiresAtUtc: "0000-01-01T00:00:00Z"
      }
    ),
    (error) => error && error.code === "pairing-session-expiry"
  );
});

test("primitive browser module performs no discovery, fetch, storage, or cross-tab work", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "tools", "companion-capability-webcrypto.js"),
    "utf8"
  );
  assert.doesNotMatch(source, /\bfetch\s*\(/u);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|caches[.]|BroadcastChannel/u);
  assert.equal(Object.hasOwn(capability, "CompanionCapabilityClient"), false);
});
