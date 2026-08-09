"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");
const { canonicalizeVnextJcsBytes } = require("../tools/vnext-jcs.js");
const {
  deriveVnextSignatureMaterial,
  signatureProfileSha256,
  verifyVnextSignaturePrimitive
} = require("../tools/vnext-signature-payload.js");
const {
  renderVectorCorpus,
  vectorPath
} = require("../tools/vnext-signature-rust-vectors.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const generatorPath = path.join(
  repositoryRoot,
  "tinyrustlm/tools/vnext-signature-rust-vectors.js"
);
const primitiveDocumentPath = path.join(
  repositoryRoot,
  "docs/architecture/vnext-rust-signature-primitive-parity.md"
);

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function decode(value) {
  const bytes = Buffer.from(value, "base64");
  assert.equal(bytes.toString("base64"), value);
  return bytes;
}

test("freezes deterministic public-only Rust Ed25519 vectors", () => {
  const bytes = fs.readFileSync(vectorPath);
  const source = fs.readFileSync(generatorPath, "utf8");
  const corpus = parseStrictJson(bytes);
  assert.equal(bytes.length, 27_988);
  assert.equal(sha256(bytes),
    "22c0c0976209afdfc934939903d455a44d63312260881d0fe983cccadd20e413");
  assert.deepEqual(bytes, renderVectorCorpus());
  assert.equal(corpus.schema,
    "tinyrustlm.vnext.receipt_signature_rust_vectors.v1");
  assert.equal(corpus.profileId, "tinyrustlm.vnext.ed25519-authority.v1");
  assert.equal(corpus.profileSha256, signatureProfileSha256);
  assert.equal(corpus.acceptedCases.length, 1);
  assert.equal(corpus.rejectionCases.length, 17);
  assert.equal(new Set(corpus.rejectionCases.map((entry) => entry.name)).size, 17);
  assert.doesNotMatch(bytes.toString("utf8"),
    /privateKey|private-key|pkcs8|secretKey/iu);
  assert.doesNotMatch(source,
    /node:(?:http|https|net|tls|dns)|\bfetch\s*\(/u);
  assert.doesNotMatch(source,
    /\b(?:legacy|migration|fallback|deprecated|alias|shim)\b/iu);
});

test("replays every accepted and rejected primitive vector through Node", () => {
  const corpus = parseStrictJson(fs.readFileSync(vectorPath));
  for (const entry of corpus.acceptedCases) {
    const envelope = parseStrictJson(decode(entry.envelopeBytesBase64));
    const material = deriveVnextSignatureMaterial(envelope);
    const result = verifyVnextSignaturePrimitive(envelope, entry.publicKeyBase64);
    assert.deepEqual(material.payloadBytes, decode(entry.payloadBytesBase64), entry.name);
    assert.equal(sha256(material.payloadBytes), entry.payloadSha256, entry.name);
    assert.deepEqual(material.signingBytes, decode(entry.signingBytesBase64), entry.name);
    assert.equal(sha256(material.signingBytes), entry.signingBytesSha256, entry.name);
    const resultBytes = canonicalizeVnextJcsBytes(result);
    assert.deepEqual(resultBytes, decode(entry.resultBytesBase64), entry.name);
    assert.equal(sha256(resultBytes), entry.resultSha256, entry.name);
  }
  for (const entry of corpus.rejectionCases) {
    const envelope = parseStrictJson(decode(entry.envelopeBytesBase64));
    assert.throws(() => verifyVnextSignaturePrimitive(envelope, entry.publicKeyBase64),
      (error) => error?.code === entry.expectedErrorCode, entry.name);
  }
});

test("keeps primitive parity documented without inflating later authority", () => {
  const document = fs.readFileSync(primitiveDocumentPath, "utf8");
  const contractReadme = fs.readFileSync(
    path.join(repositoryRoot, "contracts/vnext/README.md"),
    "utf8"
  );
  const inventory = fs.readFileSync(
    path.join(repositoryRoot, "docs/architecture/vnext-contract-inventory.md"),
    "utf8"
  );
  const authority = fs.readFileSync(
    path.join(repositoryRoot, "docs/architecture/vnext-signature-authority.md"),
    "utf8"
  );
  assert.match(document, /primitive parity only/u);
  assert.match(document, /not authority-graph parity/u);
  assert.match(document, /27,988 bytes/u);
  assert.match(document,
    /22c0c0976209afdfc934939903d455a44d63312260881d0fe983cccadd20e413/u);
  assert.match(document, /0\/20 qualified model hashes/u);
  for (const text of [contractReadme, inventory, authority]) {
    assert.match(text, /vnext-rust-signature-primitive-parity\.md/u);
  }
  assert.match(inventory, /complete authority graph now has an independent strict Rust implementation/u);
  assert.match(inventory,
    /Rust truthful projection and strict\s+projection-result validation now independently/u);
  assert.match(authority,
    /Rust graph, offline-bundle,\s+projection, and browser-transport parity do not narrow those non-claims/u);
});
