"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");
const { canonicalizeVnextJcsBytes } = require("./vnext-jcs.js");
const {
  deriveVnextSignatureMaterial,
  signatureProfile,
  signatureProfileSha256,
  verifyVnextSignaturePrimitive
} = require("./vnext-signature-payload.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const sourceVectorPath = path.join(
  repositoryRoot,
  "contracts/vnext/receipt-signature-vectors.v1.json"
);
const vectorPath = path.join(
  repositoryRoot,
  "contracts/vnext/receipt-signature-rust-vectors.v1.json"
);

function invariant(condition, message) {
  if (!condition) {
    const error = new Error(message);
    error.code = "signature_rust_vector_generation_failed";
    throw error;
  }
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function canonicalBytes(value) {
  return canonicalizeVnextJcsBytes(value);
}

function sourceVector() {
  const corpus = parseStrictJson(fs.readFileSync(sourceVectorPath));
  invariant(corpus.schema === "tinyrustlm.vnext.receipt_signature_vectors.v1",
    "source signature vector schema changed");
  invariant(corpus.profileId === signatureProfile.profileId,
    "source signature vector profile changed");
  invariant(corpus.profileSha256 === signatureProfileSha256,
    "source signature vector profile hash changed");
  invariant(corpus.cases.length === 1, "source signature vector count changed");
  return corpus.cases[0];
}

function acceptedCase(vector) {
  const material = deriveVnextSignatureMaterial(vector.envelope);
  const result = verifyVnextSignaturePrimitive(vector.envelope, vector.publicKeyBase64);
  const envelopeBytes = canonicalBytes(vector.envelope);
  const resultBytes = canonicalBytes(result);
  return {
    name: "outside-proof-valid",
    envelopeBytesBase64: envelopeBytes.toString("base64"),
    publicKeyBase64: vector.publicKeyBase64,
    payloadBytesBase64: material.payloadBytes.toString("base64"),
    payloadSha256: sha256(material.payloadBytes),
    signingBytesBase64: material.signingBytes.toString("base64"),
    signingBytesSha256: sha256(material.signingBytes),
    resultBytesBase64: resultBytes.toString("base64"),
    resultSha256: sha256(resultBytes)
  };
}

function expectRejection(name, envelope, publicKeyBase64) {
  let expectedErrorCode = null;
  try {
    verifyVnextSignaturePrimitive(envelope, publicKeyBase64);
  } catch (error) {
    expectedErrorCode = error?.code ?? null;
  }
  invariant(typeof expectedErrorCode === "string", `${name} did not reject`);
  return {
    name,
    envelopeBytesBase64: canonicalBytes(envelope).toString("base64"),
    publicKeyBase64,
    expectedErrorCode
  };
}

function buildRejectionCases(vector) {
  const baseline = vector.envelope;
  const changedKey = Buffer.from(vector.publicKeyBase64, "base64");
  changedKey[0] ^= 1;
  const changedSignature = Buffer.from(baseline.signature, "base64");
  changedSignature[0] ^= 1;
  const withoutScope = { ...baseline };
  delete withoutScope.scope;
  return [
    expectRejection("signed-subject-drift", {
      ...baseline,
      signedSubjectId: `sha256:${"4".repeat(64)}`
    }, vector.publicKeyBase64),
    expectRejection("public-key-bit-flip", baseline, changedKey.toString("base64")),
    expectRejection("signature-bit-flip", {
      ...baseline,
      signature: changedSignature.toString("base64")
    }, vector.publicKeyBase64),
    expectRejection("role-domain-mismatch", {
      ...baseline,
      signatureDomain: "tinyrustlm.signature.local-recorder.v1"
    }, vector.publicKeyBase64),
    expectRejection("scope-invalid", {
      ...baseline,
      scope: "receipt-recording"
    }, vector.publicKeyBase64),
    expectRejection("expiry-required", {
      ...baseline,
      expiresAtUtc: null
    }, vector.publicKeyBase64),
    expectRejection("lifetime-overlong", {
      ...baseline,
      expiresAtUtc: "2026-08-10T00:00:01.123456789Z"
    }, vector.publicKeyBase64),
    expectRejection("signature-base64-invalid", {
      ...baseline,
      signature: "A".repeat(88)
    }, vector.publicKeyBase64),
    expectRejection("unknown-envelope-field", {
      ...baseline,
      unknown: true
    }, vector.publicKeyBase64),
    expectRejection("missing-envelope-field", withoutScope, vector.publicKeyBase64),
    expectRejection("algorithm-invalid", {
      ...baseline,
      algorithm: "ed448"
    }, vector.publicKeyBase64),
    expectRejection("schema-unsupported", {
      ...baseline,
      signedSchema: "tinyrustlm.vnext.worker_message.v1"
    }, vector.publicKeyBase64),
    expectRejection("identifier-invalid", {
      ...baseline,
      signerId: "Observer Vector"
    }, vector.publicKeyBase64),
    expectRejection("content-id-invalid", {
      ...baseline,
      signedSubjectId: "sha256:invalid"
    }, vector.publicKeyBase64),
    expectRejection("hash-invalid", {
      ...baseline,
      nonceHash: "4".repeat(63)
    }, vector.publicKeyBase64),
    expectRejection("time-invalid", {
      ...baseline,
      issuedAtUtc: "2026-02-29T00:00:00Z"
    }, vector.publicKeyBase64),
    expectRejection("public-key-base64-invalid", baseline, "A".repeat(44))
  ];
}

function renderVectorCorpus() {
  const vector = sourceVector();
  const corpus = {
    schema: "tinyrustlm.vnext.receipt_signature_rust_vectors.v1",
    profileId: signatureProfile.profileId,
    profileSha256: signatureProfileSha256,
    acceptedCases: [acceptedCase(vector)],
    rejectionCases: buildRejectionCases(vector)
  };
  return Buffer.from(`${JSON.stringify(corpus, null, 2)}\n`, "utf8");
}

function writeVectorCorpus() {
  const bytes = renderVectorCorpus();
  fs.writeFileSync(vectorPath, bytes);
  return Object.freeze({ bytes: Buffer.from(bytes), vectorPath });
}

function main(argumentsList) {
  invariant(argumentsList.length === 1 && argumentsList[0] === "--write",
    "usage: node vnext-signature-rust-vectors.js --write");
  writeVectorCorpus();
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Signature Rust vector generation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  renderVectorCorpus,
  vectorPath,
  writeVectorCorpus
});
