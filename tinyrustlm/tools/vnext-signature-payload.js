"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");
const { canonicalizeVnextJcsBytes } = require("./vnext-jcs.js");
const { failEvidence } = require("./vnext-evidence-error.js");

const profilePath = path.resolve(__dirname,
  "../../contracts/vnext/receipt-signature-profile.v1.json");
const profileBytes = fs.readFileSync(profilePath);
const mutableProfile = parseStrictJson(profileBytes);
const signatureProfileSha256 = crypto.createHash("sha256").update(profileBytes).digest("hex");
const signatureProfile = deepFreeze(mutableProfile);
const expectedEnvelopeFields = Object.freeze([
  ...signatureProfile.signedPayloadFields,
  ...signatureProfile.envelopeExcludedFields
].sort());
const roleBindings = new Map(signatureProfile.roleBindings.map((binding) =>
  [binding.role, binding]));
const supportedSchemas = new Set(signatureProfile.identityBearingSubjects.map((entry) =>
  entry.schema));
const safeIdPattern = /^[a-z0-9][a-z0-9._:-]{2,159}$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const contentIdPattern = /^sha256:[a-f0-9]{64}$/u;
const utcPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/u;
const ed25519SpkiPrefix = Buffer.from("302a300506032b6570032100", "hex");

function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value)) deepFreeze(entry);
    if (!Object.isFrozen(value)) Object.freeze(value);
  }
  return value;
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactDataFields(value, expected, code) {
  if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length !== 0) {
    failEvidence(code, "signature-payload");
  }
  const names = Object.getOwnPropertyNames(value);
  const actual = [...names].sort();
  if (actual.length !== expected.length ||
      actual.some((name, index) => name !== expected[index])) {
    failEvidence(code, "signature-payload");
  }
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence(code, "signature-payload");
    }
  }
}

function isRealDate(year, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function utcNanoseconds(value) {
  const match = typeof value === "string" ? utcPattern.exec(value) : null;
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText,
    fraction = ""] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (!isRealDate(year, month, day) || hour > 23 || minute > 59 || second > 59) return null;
  const milliseconds = Date.UTC(year, month - 1, day, hour, minute, second);
  if (!Number.isSafeInteger(milliseconds)) return null;
  return BigInt(milliseconds) * 1_000_000n +
    BigInt(fraction.padEnd(9, "0") || "0");
}

function decodeCanonicalBase64(value, expectedBytes, code) {
  if (typeof value !== "string" ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) {
    failEvidence(code, "signature-payload");
  }
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== expectedBytes || decoded.toString("base64") !== value) {
    failEvidence(code, "signature-payload");
  }
  return decoded;
}

function validateEnvelope(envelope) {
  exactDataFields(envelope, expectedEnvelopeFields, "signature_envelope_fields_invalid");
  if (envelope.algorithm !== signatureProfile.signatureAlgorithm) {
    failEvidence("signature_algorithm_invalid", "signature-payload");
  }
  const role = roleBindings.get(envelope.role);
  if (!role || envelope.signatureDomain !== role.signatureDomain) {
    failEvidence("signature_role_domain_invalid", "signature-payload");
  }
  if (!role.scopes.includes(envelope.scope)) {
    failEvidence("signature_scope_invalid", "signature-payload");
  }
  for (const value of [envelope.signerId, envelope.keyId, envelope.campaignId]) {
    if (typeof value !== "string" || !safeIdPattern.test(value)) {
      failEvidence("signature_identifier_invalid", "signature-payload");
    }
  }
  if (!contentIdPattern.test(envelope.authorityRegistryReceiptId) ||
      !contentIdPattern.test(envelope.signedSubjectId) ||
      envelope.releaseId !== null && !contentIdPattern.test(envelope.releaseId)) {
    failEvidence("signature_content_id_invalid", "signature-payload");
  }
  if (!supportedSchemas.has(envelope.signedSchema)) {
    failEvidence("signature_schema_not_supported", "signature-payload");
  }
  if (!sha256Pattern.test(envelope.signedPayloadSha256) ||
      !sha256Pattern.test(envelope.nonceHash)) {
    failEvidence("signature_hash_invalid", "signature-payload");
  }
  const issuedAt = utcNanoseconds(envelope.issuedAtUtc);
  const expiresAt = envelope.expiresAtUtc === null
    ? null
    : utcNanoseconds(envelope.expiresAtUtc);
  if (issuedAt === null || envelope.expiresAtUtc !== null && expiresAt === null) {
    failEvidence("signature_time_invalid", "signature-payload");
  }
  if (expiresAt === null) {
    if (envelope.role !== "local-recorder") {
      failEvidence("signature_expiry_invalid", "signature-payload");
    }
  } else {
    const outsideProof = envelope.role === "outside-network-observer" &&
      envelope.scope === "outside-proof";
    const maximumSeconds = outsideProof
      ? signatureProfile.timePolicy.maximumOutsideProofLifetimeSeconds
      : signatureProfile.timePolicy.maximumOnlineSignatureLifetimeSeconds;
    if (expiresAt <= issuedAt ||
        expiresAt - issuedAt > BigInt(maximumSeconds) * 1_000_000_000n) {
      failEvidence("signature_lifetime_invalid", "signature-payload");
    }
  }
  decodeCanonicalBase64(envelope.signature, 64, "signature_base64_invalid");
  return Object.freeze({ issuedAt, expiresAt, role });
}

function immutableMaterial(payload, payloadBytes, signingBytes, signedPayloadSha256) {
  const canonicalPayload = Buffer.from(payloadBytes);
  const canonicalSigning = Buffer.from(signingBytes);
  const result = {
    payload: deepFreeze(payload),
    signedPayloadSha256
  };
  Object.defineProperties(result, {
    payloadBytes: {
      enumerable: true,
      get() {
        return Buffer.from(canonicalPayload);
      }
    },
    signingBytes: {
      enumerable: true,
      get() {
        return Buffer.from(canonicalSigning);
      }
    }
  });
  return Object.freeze(result);
}

function deriveVnextSignatureMaterial(envelope) {
  validateEnvelope(envelope);
  const payload = {};
  for (const name of signatureProfile.signedPayloadFields) payload[name] = envelope[name];
  const payloadBytes = canonicalizeVnextJcsBytes(payload);
  const signingBytes = Buffer.concat([
    Buffer.from(envelope.signatureDomain, "utf8"),
    Buffer.from([signatureProfile.domainSeparatorByte]),
    payloadBytes
  ]);
  const signedPayloadSha256 = crypto.createHash("sha256")
    .update(signingBytes).digest("hex");
  return immutableMaterial(payload, payloadBytes, signingBytes, signedPayloadSha256);
}

function rawEd25519PublicKey(publicKeyBase64) {
  const raw = decodeCanonicalBase64(publicKeyBase64, 32,
    "signature_public_key_base64_invalid");
  let key;
  try {
    key = crypto.createPublicKey({
      key: Buffer.concat([ed25519SpkiPrefix, raw]),
      format: "der",
      type: "spki"
    });
  } catch (_error) {
    failEvidence("signature_public_key_invalid", "signature-verify");
  }
  if (key.asymmetricKeyType !== "ed25519") {
    failEvidence("signature_public_key_invalid", "signature-verify");
  }
  return key;
}

function verifyVnextSignaturePrimitive(envelope, publicKeyBase64) {
  const material = deriveVnextSignatureMaterial(envelope);
  if (envelope.signedPayloadSha256 !== material.signedPayloadSha256) {
    failEvidence("signature_payload_hash_mismatch", "signature-verify");
  }
  const signature = decodeCanonicalBase64(envelope.signature, 64,
    "signature_base64_invalid");
  const publicKey = rawEd25519PublicKey(publicKeyBase64);
  let verified = false;
  try {
    verified = crypto.verify(null, material.signingBytes, publicKey, signature);
  } catch (_error) {
    failEvidence("signature_verification_failed", "signature-verify");
  }
  if (!verified) failEvidence("signature_invalid", "signature-verify");
  return Object.freeze({
    signatureVerified: true,
    algorithm: signatureProfile.signatureAlgorithm,
    role: envelope.role,
    scope: envelope.scope,
    signedSubjectId: envelope.signedSubjectId,
    signedSchema: envelope.signedSchema,
    signedPayloadSha256: material.signedPayloadSha256,
    keyId: envelope.keyId,
    signerId: envelope.signerId,
    authorityRegistryReceiptId: envelope.authorityRegistryReceiptId
  });
}

module.exports = Object.freeze({
  deriveVnextSignatureMaterial,
  signatureProfile,
  signatureProfileSha256,
  utcNanoseconds,
  verifyVnextSignaturePrimitive
});
