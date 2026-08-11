"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");
const {
  canonicalizeJcsBytes,
  canonicalizeVnextJcsBytes,
  jcsProfile,
  vnextJcsProfile
} = require("../tools/vnext-jcs.js");
const {
  finalizeVnextReceipt,
  receiptIdentityDomain,
  validateVnextReceiptBytes
} = require("../tools/vnext-receipt-identity.js");
const {
  buildVectorText,
  vectorPath,
  vectorSchema
} = require("../tools/vnext-receipt-vector-generator.js");
const {
  durablePublicationProfile,
  durablePublicationProfileSha256
} = require("../tools/vnext-durable-publication.js");

const registryPath = path.resolve(__dirname, "../../contracts/vnext/contract-family.v1.json");
const profilePath = path.resolve(__dirname, "../../contracts/vnext/receipt-store-profile.v1.json");

const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

function loadVectors() {
  return parseStrictJson(fs.readFileSync(vectorPath), {
    maximumBytes: 64 * 1024,
    maximumDepth: 8,
    maximumTotalEntries: 256,
    maximumObjectMembers: 16,
    maximumArrayItems: 16,
    maximumStringCodeUnits: 16 * 1024,
    maximumTotalStringCodeUnits: 32 * 1024,
    maximumNumberCharacters: 16
  });
}

function decode(record) {
  assert.deepEqual(Object.keys(record), ["bytes", "sha256", "base64"]);
  const bytes = Buffer.from(record.base64, "base64");
  assert.equal(bytes.toString("base64"), record.base64);
  assert.equal(bytes.length, record.bytes);
  assert.equal(sha256(bytes), record.sha256);
  return bytes;
}

test("keeps the receipt identity vector corpus deterministic and source bound", () => {
  const bytes = fs.readFileSync(vectorPath);
  const vectors = loadVectors();

  assert.equal(bytes.toString("utf8"), buildVectorText());
  assert.deepEqual(Object.keys(vectors), [
    "schema",
    "registrySha256",
    "receiptStoreProfileSha256",
    "generatorSourceSha256",
    "encoding",
    "jcsProfile",
    "vnextJcsProfile",
    "receiptIdentityDomain",
    "jcsCaseCount",
    "jcsCases",
    "receiptCase"
  ]);
  assert.equal(vectors.schema, vectorSchema);
  assert.equal(vectors.encoding, "base64-raw-utf8");
  assert.equal(vectors.registrySha256, sha256(fs.readFileSync(registryPath)));
  assert.equal(vectors.receiptStoreProfileSha256, sha256(fs.readFileSync(profilePath)));
  assert.equal(vectors.jcsCaseCount, vectors.jcsCases.length);
  assert.equal(vectors.jcsCases.length, 4);
  assert.equal(vectors.jcsProfile, jcsProfile);
  assert.equal(vectors.vnextJcsProfile, vnextJcsProfile);
  assert.equal(vectors.receiptIdentityDomain, receiptIdentityDomain);
});

test("replays every language-neutral canonicalization vector", () => {
  const vectors = loadVectors();
  const expectedCanonicalHashes = new Map([
    ["rfc8785-section-3-2-2", "2d5e01a318d0f0879ab568c4be289c8b1f64ef8921a53c6277d5e069978baacb"],
    ["rfc8785-section-3-2-3-utf16-order", "5e321556d22018a9656991a9e94f77ec175fa193e52a2429d312f8419ec8b08c"],
    ["unicode-preserved-without-normalization", "7f04a9b0f36600f4b530afbb2601cb43068497f57b6ac5e07b2c173534c523ab"],
    ["vnext-safe-integer-boundaries", "6c2ebfc38ada26e6c5cac0887ce0571e3fe2bdd108725e1364e1dc23b6cfd0e0"]
  ]);

  for (const item of vectors.jcsCases) {
    assert.deepEqual(Object.keys(item), ["id", "profile", "input", "canonical"]);
    const input = decode(item.input);
    const expected = decode(item.canonical);
    const value = item.profile === jcsProfile
      ? JSON.parse(input.toString("utf8"))
      : parseStrictJson(input);
    const actual = item.profile === jcsProfile
      ? canonicalizeJcsBytes(value)
      : canonicalizeVnextJcsBytes(value);
    assert.deepEqual(actual, expected, item.id);
    assert.equal(item.canonical.sha256, expectedCanonicalHashes.get(item.id), item.id);
  }
});

test("freezes one independently recomputable receipt identity", () => {
  const item = loadVectors().receiptCase;
  assert.deepEqual(Object.keys(item), [
    "id",
    "draft",
    "identityContent",
    "receiptId",
    "canonicalContentSha256",
    "canonicalReceipt"
  ]);
  assert.equal(item.id, "valid-acquisition-receipt");
  assert.equal(item.receiptId,
    "sha256:35b9ccef74c63afd095263185597585394fa836a18c3e3adbb4a446423a959ab");
  assert.equal(item.canonicalContentSha256,
    "35b9ccef74c63afd095263185597585394fa836a18c3e3adbb4a446423a959ab");

  const draftBytes = decode(item.draft);
  const contentBytes = decode(item.identityContent);
  const finalBytes = decode(item.canonicalReceipt);
  const independentDigest = crypto.createHash("sha256")
    .update(Buffer.from(receiptIdentityDomain, "utf8"))
    .update(Buffer.from([0]))
    .update(contentBytes)
    .digest("hex");
  assert.equal(independentDigest, item.canonicalContentSha256);

  const finalized = finalizeVnextReceipt(parseStrictJson(draftBytes));
  assert.equal(finalized.receipt.receiptId, item.receiptId);
  assert.deepEqual(finalized.bytes, finalBytes);
  assert.equal(validateVnextReceiptBytes(finalBytes).receipt.receiptId, item.receiptId);
});

test("freezes one incompatible create-only receipt-store profile", () => {
  const profileBytes = fs.readFileSync(profilePath);
  const profile = parseStrictJson(profileBytes);
  const registrySha256 = sha256(fs.readFileSync(registryPath));

  assert.deepEqual(Object.keys(profile), [
    "profileId",
    "status",
    "compatibility",
    "contractRegistrySha256",
    "receiptSchema",
    "canonicalizationProfile",
    "canonicalizationBase",
    "numberProfile",
    "strictJsonProfile",
    "identity",
    "wire",
    "layout",
    "durablePublication",
    "concurrency",
    "rebuild",
    "limits",
    "resultContract"
  ]);
  assert.equal(profile.profileId, "tinyrustlm.vnext.receipt-store.v1");
  assert.equal(profile.status, "frozen");
  assert.equal(profile.compatibility, "incompatible-no-dated-receipt-reader");
  assert.equal(profile.contractRegistrySha256, registrySha256);
  assert.equal(profile.canonicalizationProfile, vnextJcsProfile);
  assert.equal(profile.canonicalizationBase, jcsProfile);
  assert.equal(profile.numberProfile, "safe-integers-only-negative-zero-rejected");
  assert.equal(profile.identity.domain, receiptIdentityDomain);
  assert.deepEqual(profile.identity.excludedRootFields,
    ["canonicalContentSha256", "receiptId"]);
  assert.equal(profile.wire.canonicalJcsRequired, true);
  assert.equal(profile.wire.maximumReceiptBytes, 262144);
  assert.equal(profile.layout.replacementPolicy, "never");
  assert.equal(profile.durablePublication.profileId, durablePublicationProfile.profileId);
  assert.equal(profile.durablePublication.profileSha256, durablePublicationProfileSha256);
  assert.equal(profile.durablePublication.targetActivation,
    "matching-content-addressed-durability-receipt-required");
  assert.equal(profile.durablePublication.callerSuppliedSuccess, "forbidden");
  assert.equal(profile.concurrency.freshTemporaryPolicy, "leave-pending-without-mutation");
  assert.equal(profile.concurrency.minimumIncompleteTemporaryAgeMs, 300000);
  assert.equal(profile.rebuild.preserveUnrelatedValidReceipts, true);
  assert.equal(profile.limits.maximumGraphEdges, 1048576);
  assert.equal(profile.limits.maximumScanEntries, 262144);
  assert.equal(profile.resultContract.absolutePathsReturned, false);
  assert.equal(profile.resultContract.rawHostErrorsReturned, false);
  assert.equal(profile.resultContract.rawInvalidBytesReturned, false);
  assert.equal(profile.resultContract.durabilityReceiptResultReturned, true);
  assert.doesNotMatch(profileBytes.toString("utf8"),
    /legacy|fallback|migration|alias|dual-reader|dual-writer/iu);
});
