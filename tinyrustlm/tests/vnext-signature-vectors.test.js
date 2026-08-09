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

const vectorsPath = path.resolve(__dirname,
  "../../contracts/vnext/receipt-signature-vectors.v1.json");

function throwsCode(callback, code) {
  assert.throws(callback, (error) => error?.code === code, `expected ${code}`);
}

test("public-only Ed25519 vectors bind exact payload, signing bytes, and profile", () => {
  const bytes = fs.readFileSync(vectorsPath);
  const vectors = parseStrictJson(bytes);
  assert.equal(vectors.schema, "tinyrustlm.vnext.receipt_signature_vectors.v1");
  assert.equal(vectors.profileId, signatureProfile.profileId);
  assert.equal(vectors.profileSha256, signatureProfileSha256);
  assert.equal(vectors.cases.length, 1);
  assert.equal(/privateKey|private-key|pkcs8|secretKey/iu.test(bytes.toString("utf8")), false);

  const vector = vectors.cases[0];
  const material = deriveVnextSignatureMaterial(vector.envelope);
  assert.equal(vector.expected, "accept");
  assert.equal(material.payloadBytes.length, vector.payloadBytes);
  assert.equal(crypto.createHash("sha256").update(material.payloadBytes).digest("hex"),
    vector.payloadSha256);
  assert.deepEqual(material.signingBytes.subarray(0,
    Buffer.from(vector.domainPrefixBase64, "base64").length),
  Buffer.from(vector.domainPrefixBase64, "base64"));
  assert.equal(material.signingBytes.length, vector.signingBytes);
  assert.equal(material.signedPayloadSha256, vector.signingBytesSha256);
  assert.equal(verifyVnextSignaturePrimitive(vector.envelope,
    vector.publicKeyBase64).signatureVerified, true);
});

test("public vector rejects bit flips in subject, key, and signature", () => {
  const vector = parseStrictJson(fs.readFileSync(vectorsPath)).cases[0];
  throwsCode(() => verifyVnextSignaturePrimitive({
    ...vector.envelope,
    signedSubjectId: `sha256:${"4".repeat(64)}`
  }, vector.publicKeyBase64), "signature_payload_hash_mismatch");

  const key = Buffer.from(vector.publicKeyBase64, "base64");
  key[0] ^= 1;
  throwsCode(() => verifyVnextSignaturePrimitive(vector.envelope,
    key.toString("base64")), "signature_invalid");

  const signature = Buffer.from(vector.envelope.signature, "base64");
  signature[0] ^= 1;
  throwsCode(() => verifyVnextSignaturePrimitive({
    ...vector.envelope,
    signature: signature.toString("base64")
  }, vector.publicKeyBase64), "signature_invalid");
});
