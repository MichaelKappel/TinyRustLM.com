"use strict";

const crypto = require("node:crypto");

const { canonicalizeVnextJcsBytes } = require("../../tools/vnext-jcs.js");
const {
  protectedEqualityCustodyProfile
} = require("../../tools/vnext-protected-equality-custody.js");

const {
  createVnextProtectedEqualityCustody
} = require("../../tools/vnext-protected-equality-custody-internal.js");

function publicKeyBase64(publicKey) {
  const der = publicKey.export({ format: "der", type: "spki" });
  return der.subarray(der.length - 32).toString("base64");
}

function makeProtectedEqualityBundle(options = {}) {
  const keyPair = options.keyPair ?? crypto.generateKeyPairSync("ed25519");
  const authorityKeyId = options.authorityKeyId ?? "equality-authority-test";
  const custodyId = options.custodyId ?? "equality-custody-test";
  const revisionId = options.revisionId ?? "equality-revision-0001";
  const generation = options.generation ?? 1;
  const previousRevisionId = options.previousRevisionId ??
    (generation === 1 ? null : "equality-revision-previous");
  const issuedAtUtc = options.issuedAtUtc ?? "2026-08-09T00:00:00Z";
  const expiresAtUtc = options.expiresAtUtc ?? "2026-09-08T00:00:00Z";
  const verificationTimeUtc = options.verificationTimeUtc ??
    "2026-08-09T12:00:00Z";
  const knownSecrets = options.knownSecrets ?? [];
  const payload = {
    schema: protectedEqualityCustodyProfile.bundleSchema,
    algorithm: protectedEqualityCustodyProfile.signatureAlgorithm,
    authorityKeyId,
    custodyId,
    expiresAtUtc,
    generation,
    issuedAtUtc,
    knownSecrets,
    previousRevisionId,
    revisionId
  };
  const payloadBytes = canonicalizeVnextJcsBytes(payload);
  const signingBytes = Buffer.concat([
    Buffer.from(protectedEqualityCustodyProfile.signatureDomain, "utf8"),
    Buffer.from([protectedEqualityCustodyProfile.domainSeparatorByte]),
    payloadBytes
  ]);
  const signature = crypto.sign(null, signingBytes, keyPair.privateKey)
    .toString("base64");
  const bundleBytes = canonicalizeVnextJcsBytes({ ...payload, signature });
  const authorityPublicKeyBase64 = publicKeyBase64(keyPair.publicKey);
  const trustInput = {
    authorityPublicKeyBase64,
    expectedAuthorityKeyId: authorityKeyId,
    expectedCustodyId: custodyId,
    expectedGeneration: generation,
    expectedRevisionId: revisionId,
    verificationTimeUtc
  };
  return Object.freeze({
    authorityPublicKeyBase64,
    bundleBytes,
    keyPair,
    payload: Object.freeze(payload),
    trustInput: Object.freeze(trustInput)
  });
}

function makeProtectedEqualityCustody(options = {}) {
  const fixture = makeProtectedEqualityBundle(options);
  return Object.freeze({
    ...fixture,
    custody: createVnextProtectedEqualityCustody(
      fixture.bundleBytes,
      fixture.trustInput
    )
  });
}

module.exports = Object.freeze({
  makeProtectedEqualityBundle,
  makeProtectedEqualityCustody
});
