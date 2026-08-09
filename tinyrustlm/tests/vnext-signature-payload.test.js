"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");
const {
  deriveVnextSignatureMaterial,
  signatureProfile,
  signatureProfileSha256,
  verifyVnextSignaturePrimitive
} = require("../tools/vnext-signature-payload.js");

const profilePath = path.resolve(__dirname,
  "../../contracts/vnext/receipt-signature-profile.v1.json");

function envelope() {
  return {
    algorithm: "ed25519",
    role: "outside-network-observer",
    signatureDomain: "tinyrustlm.signature.outside-network-observer.v1",
    signerId: "observer-external-001",
    keyId: "observer-key-001",
    authorityRegistryReceiptId: `sha256:${"1".repeat(64)}`,
    signedSubjectId: `sha256:${"2".repeat(64)}`,
    signedSchema: "tinyrustlm.vnext.outside_proof.v2",
    campaignId: "campaign-vnext-001",
    releaseId: null,
    scope: "outside-proof",
    signedPayloadSha256: "0".repeat(64),
    nonceHash: "3".repeat(64),
    issuedAtUtc: "2026-08-09T00:00:00.123456789Z",
    expiresAtUtc: "2026-08-09T01:00:00.123456789Z",
    signature: Buffer.alloc(64).toString("base64")
  };
}

function throwsCode(callback, code) {
  assert.throws(callback, (error) => error?.code === code, `expected ${code}`);
}

test("loads the exact frozen signature profile without private key material", () => {
  const bytes = fs.readFileSync(profilePath);
  const parsed = parseStrictJson(bytes);
  assert.equal(signatureProfile.schema,
    "tinyrustlm.vnext.receipt_signature_profile.v1");
  assert.equal(signatureProfile.profileId,
    "tinyrustlm.vnext.ed25519-authority.v1");
  assert.equal(signatureProfile.signatureAlgorithm, "ed25519");
  assert.equal(signatureProfile.publicKeyEncoding,
    "canonical-base64-raw-ed25519-32");
  assert.equal(signatureProfile.signatureEncoding,
    "canonical-base64-ed25519-64");
  assert.equal(signatureProfileSha256,
    crypto.createHash("sha256").update(bytes).digest("hex"));
  assert.deepEqual(signatureProfile, parsed);
  assert.equal(/privateKey|private-key|pkcs8|secretKey/iu.test(bytes.toString("utf8")), false);
});

test("derives exact domain-separated canonical signing bytes", () => {
  const material = deriveVnextSignatureMaterial(envelope());
  const expectedPayload = "{\"algorithm\":\"ed25519\",\"authorityRegistryReceiptId\":\"sha256:" +
    "1".repeat(64) + "\",\"campaignId\":\"campaign-vnext-001\",\"expiresAtUtc\":" +
    "\"2026-08-09T01:00:00.123456789Z\",\"issuedAtUtc\":" +
    "\"2026-08-09T00:00:00.123456789Z\",\"keyId\":\"observer-key-001\"," +
    "\"nonceHash\":\"" + "3".repeat(64) + "\",\"releaseId\":null," +
    "\"role\":\"outside-network-observer\",\"scope\":\"outside-proof\"," +
    "\"signatureDomain\":\"tinyrustlm.signature.outside-network-observer.v1\"," +
    "\"signedSchema\":\"tinyrustlm.vnext.outside_proof.v2\"," +
    "\"signedSubjectId\":\"sha256:" + "2".repeat(64) + "\"," +
    "\"signerId\":\"observer-external-001\"}";
  assert.equal(material.payloadBytes.toString("utf8"), expectedPayload);
  assert.deepEqual(material.signingBytes.subarray(0,
    Buffer.byteLength(envelope().signatureDomain) + 1),
  Buffer.concat([Buffer.from(envelope().signatureDomain, "utf8"), Buffer.from([0])]));
  assert.equal(material.signingBytes.subarray(
    Buffer.byteLength(envelope().signatureDomain) + 1).toString("utf8"), expectedPayload);
  assert.equal(material.signedPayloadSha256,
    crypto.createHash("sha256").update(material.signingBytes).digest("hex"));
});

test("binds every payload field while excluding only hash and signature", () => {
  const baseline = envelope();
  const original = deriveVnextSignatureMaterial(baseline);
  for (const name of signatureProfile.signedPayloadFields) {
    const changed = { ...baseline };
    if (name === "expiresAtUtc") changed[name] = "2026-08-09T02:00:00.123456789Z";
    else if (name === "releaseId") changed[name] = `sha256:${"4".repeat(64)}`;
    else if (name === "algorithm") continue;
    else if (name === "signatureDomain") {
      changed.role = "local-recorder";
      changed.scope = "receipt-recording";
      changed[name] = "tinyrustlm.signature.local-recorder.v1";
      changed.expiresAtUtc = null;
    } else if (name === "role" || name === "scope") {
      changed.role = "local-recorder";
      changed.scope = "receipt-recording";
      changed.signatureDomain = "tinyrustlm.signature.local-recorder.v1";
      changed.expiresAtUtc = null;
    } else if (name.endsWith("Id") && !name.endsWith("Hash")) {
      changed[name] = name === "campaignId" || name === "keyId" || name === "signerId"
        ? `${baseline[name]}-changed`
        : `sha256:${"4".repeat(64)}`;
    } else if (name === "nonceHash") changed[name] = "4".repeat(64);
    else if (name === "issuedAtUtc") {
      changed[name] = "2026-08-09T00:00:01.123456789Z";
    } else if (name === "signedSchema") changed[name] = "tinyrustlm.vnext.receipt.v1";
    const derived = deriveVnextSignatureMaterial(changed);
    assert.notEqual(derived.signedPayloadSha256, original.signedPayloadSha256, name);
  }
  const excluded = { ...baseline,
    signedPayloadSha256: "f".repeat(64),
    signature: Buffer.alloc(64, 9).toString("base64") };
  assert.equal(deriveVnextSignatureMaterial(excluded).signedPayloadSha256,
    original.signedPayloadSha256);
});

test("verifies raw Ed25519 keys and rejects payload, hash, key, and signature drift", () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const rawPublicKey = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const unsigned = envelope();
  const material = deriveVnextSignatureMaterial(unsigned);
  const signed = {
    ...unsigned,
    signedPayloadSha256: material.signedPayloadSha256,
    signature: crypto.sign(null, material.signingBytes, privateKey).toString("base64")
  };
  const result = verifyVnextSignaturePrimitive(signed, rawPublicKey.toString("base64"));
  assert.equal(result.signatureVerified, true);
  assert.equal(result.signedPayloadSha256, material.signedPayloadSha256);

  throwsCode(() => verifyVnextSignaturePrimitive({ ...signed, nonceHash: "5".repeat(64) },
    rawPublicKey.toString("base64")), "signature_payload_hash_mismatch");
  throwsCode(() => verifyVnextSignaturePrimitive({ ...signed, signedPayloadSha256: "5".repeat(64) },
    rawPublicKey.toString("base64")), "signature_payload_hash_mismatch");
  throwsCode(() => verifyVnextSignaturePrimitive({ ...signed,
    signature: Buffer.alloc(64, 8).toString("base64") }, rawPublicKey.toString("base64")),
  "signature_invalid");
  const other = crypto.generateKeyPairSync("ed25519").publicKey
    .export({ format: "der", type: "spki" }).subarray(-32).toString("base64");
  throwsCode(() => verifyVnextSignaturePrimitive(signed, other), "signature_invalid");
});

test("rejects role, scope, lifetime, canonical base64, and field confusion", () => {
  throwsCode(() => deriveVnextSignatureMaterial({ ...envelope(),
    signatureDomain: "tinyrustlm.signature.local-recorder.v1" }),
  "signature_role_domain_invalid");
  throwsCode(() => deriveVnextSignatureMaterial({ ...envelope(), scope: "receipt-recording" }),
    "signature_scope_invalid");
  throwsCode(() => deriveVnextSignatureMaterial({ ...envelope(), expiresAtUtc: null }),
    "signature_expiry_invalid");
  throwsCode(() => deriveVnextSignatureMaterial({ ...envelope(),
    expiresAtUtc: "2026-08-10T00:00:01.123456789Z" }),
  "signature_lifetime_invalid");
  throwsCode(() => deriveVnextSignatureMaterial({ ...envelope(), signature: "A".repeat(88) }),
    "signature_base64_invalid");
  throwsCode(() => deriveVnextSignatureMaterial({ ...envelope(), legacy: true }),
    "signature_envelope_fields_invalid");
});
