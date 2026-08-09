"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");
const {
  canonicalizeJcsBytes,
  canonicalizeVnextJcsBytes,
  jcsProfile,
  vnextJcsProfile
} = require("./vnext-jcs.js");
const {
  finalizeVnextReceipt,
  receiptIdentityDomain,
  receiptIdentityExcludedFields,
  receiptJcsLimits
} = require("./vnext-receipt-identity.js");

const vectorSchema = "tinyrustlm.vnext.receipt_identity_vectors.v1";
const registryPath = path.resolve(__dirname, "../../contracts/vnext/contract-family.v1.json");
const profilePath = path.resolve(__dirname, "../../contracts/vnext/receipt-store-profile.v1.json");
const corpusPath = path.resolve(__dirname, "../../contracts/vnext/contract-corpus.v1.json");
const vectorPath = path.resolve(__dirname, "../../contracts/vnext/receipt-identity-vectors.v1.json");

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function encoded(bytes) {
  return {
    bytes: bytes.length,
    sha256: sha256(bytes),
    base64: bytes.toString("base64")
  };
}

function normalizedSourceHash() {
  const source = fs.readFileSync(__filename, "utf8").replace(/\r\n/gu, "\n");
  return sha256(Buffer.from(source, "utf8"));
}

function buildJcsCase(id, profile, inputText, value) {
  const input = Buffer.from(inputText, "utf8");
  const canonical = profile === jcsProfile
    ? canonicalizeJcsBytes(value)
    : canonicalizeVnextJcsBytes(value);
  return {
    id,
    profile,
    input: encoded(input),
    canonical: encoded(canonical)
  };
}

function validReceiptDraft() {
  const corpus = parseStrictJson(fs.readFileSync(corpusPath));
  const item = corpus.cases.find((entry) => entry.id === "valid-receipt");
  if (!item) throw new Error("valid receipt corpus case is missing");
  const receipt = parseStrictJson(Buffer.from(item.payloadBase64, "base64"));
  for (const name of receiptIdentityExcludedFields) delete receipt[name];
  return receipt;
}

function contentWithoutIdentity(receipt) {
  return Object.fromEntries(Object.entries(receipt).filter(([name]) =>
    !receiptIdentityExcludedFields.includes(name)));
}

function buildReceiptCase() {
  const draft = validReceiptDraft();
  const draftBytes = canonicalizeVnextJcsBytes(draft, receiptJcsLimits);
  const finalized = finalizeVnextReceipt(draft);
  const contentBytes = canonicalizeVnextJcsBytes(
    contentWithoutIdentity(finalized.receipt),
    receiptJcsLimits
  );
  return {
    id: "valid-acquisition-receipt",
    draft: encoded(draftBytes),
    identityContent: encoded(contentBytes),
    receiptId: finalized.receipt.receiptId,
    canonicalContentSha256: finalized.receipt.canonicalContentSha256,
    canonicalReceipt: encoded(finalized.bytes)
  };
}

function buildVectors() {
  const jcsCases = [
    buildJcsCase(
      "rfc8785-section-3-2-2",
      jcsProfile,
      "{\"numbers\":[333333333.33333329,1E30,4.50,2e-3,0.000000000000000000000000001]," +
        "\"string\":\"\\u20ac$\\u000F\\u000aA'\\u0042\\u0022\\u005c\\\\\\\"\\/\"," +
        "\"literals\":[null,true,false]}",
      {
        numbers: [333333333.33333329, 1E30, 4.50, 2e-3, 0.000000000000000000000000001],
        string: "\u20ac$\u000f\nA'B\"\\\\\"/",
        literals: [null, true, false]
      }
    ),
    buildJcsCase(
      "rfc8785-section-3-2-3-utf16-order",
      jcsProfile,
      "{\"\\u20ac\":\"Euro Sign\",\"\\r\":\"Carriage Return\"," +
        "\"\\ufb33\":\"Hebrew Letter Dalet With Dagesh\",\"1\":\"One\"," +
        "\"\\ud83d\\ude00\":\"Emoji: Grinning Face\",\"\\u0080\":\"Control\"," +
        "\"\\u00f6\":\"Latin Small Letter O With Diaeresis\"}",
      {
        "\u20ac": "Euro Sign",
        "\r": "Carriage Return",
        "\ufb33": "Hebrew Letter Dalet With Dagesh",
        "1": "One",
        "\ud83d\ude00": "Emoji: Grinning Face",
        "\u0080": "Control",
        "\u00f6": "Latin Small Letter O With Diaeresis"
      }
    ),
    buildJcsCase(
      "unicode-preserved-without-normalization",
      jcsProfile,
      "{\"decomposed\":\"e\\u0301\",\"composed\":\"\\u00e9\"}",
      { decomposed: "e\u0301", composed: "\u00e9" }
    ),
    buildJcsCase(
      "vnext-safe-integer-boundaries",
      vnextJcsProfile,
      "{\"maximum\":9007199254740991,\"minimum\":-9007199254740991,\"zero\":0}",
      { maximum: Number.MAX_SAFE_INTEGER, minimum: Number.MIN_SAFE_INTEGER, zero: 0 }
    )
  ];
  return {
    schema: vectorSchema,
    registrySha256: sha256(fs.readFileSync(registryPath)),
    receiptStoreProfileSha256: sha256(fs.readFileSync(profilePath)),
    generatorSourceSha256: normalizedSourceHash(),
    encoding: "base64-raw-utf8",
    jcsProfile,
    vnextJcsProfile,
    receiptIdentityDomain,
    jcsCaseCount: jcsCases.length,
    jcsCases,
    receiptCase: buildReceiptCase()
  };
}

function buildVectorText() {
  return `${JSON.stringify(buildVectors(), null, 2)}\n`;
}

if (require.main === module) {
  fs.writeFileSync(vectorPath, buildVectorText(), { encoding: "utf8", flag: "w" });
}

module.exports = Object.freeze({
  buildVectorText,
  buildVectors,
  vectorPath,
  vectorSchema
});
