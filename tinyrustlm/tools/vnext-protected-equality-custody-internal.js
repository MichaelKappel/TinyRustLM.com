"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");
const { canonicalizeVnextJcsBytes } = require("./vnext-jcs.js");
const { failEvidence } = require("./vnext-evidence-error.js");
const { utcNanoseconds } = require("./vnext-signature-payload.js");

const contractRoot = path.resolve(__dirname, "../../contracts/vnext");
const profilePath = path.join(contractRoot,
  "protected-equality-custody-profile.v1.json");
const registryPath = path.join(contractRoot, "contract-family.v1.json");
const profileBytes = fs.readFileSync(profilePath);
const registryBytes = fs.readFileSync(registryPath);
const parsedProfile = parseStrictJson(profileBytes);
const protectedEqualityCustodyProfileSha256 = sha256(profileBytes);
const safeIdPattern = /^[a-z0-9][a-z0-9._:-]{2,159}$/u;
const ed25519SpkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
const issuedCustodies = new WeakSet();
const privateCustodies = new WeakMap();
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const typedArrayBufferGetter = Object.getOwnPropertyDescriptor(
  typedArrayPrototype, "buffer").get;
const typedArrayByteLengthGetter = Object.getOwnPropertyDescriptor(
  typedArrayPrototype, "byteLength").get;
const typedArrayByteOffsetGetter = Object.getOwnPropertyDescriptor(
  typedArrayPrototype, "byteOffset").get;
const typedArrayLengthGetter = Object.getOwnPropertyDescriptor(
  typedArrayPrototype, "length").get;

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value)) deepFreeze(entry);
    Object.freeze(value);
  }
  return value;
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactDataObject(value, expected, code, step) {
  if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length !== 0) {
    failEvidence(code, step);
  }
  const names = Object.getOwnPropertyNames(value);
  const actual = [...names].sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length ||
      actual.some((name, index) => name !== wanted[index])) {
    failEvidence(code, step);
  }
  const result = {};
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence(code, step);
    }
    result[name] = descriptor.value;
  }
  return result;
}

function exactDataArray(value, code, step) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
      Object.getOwnPropertySymbols(value).length !== 0 ||
      Object.getOwnPropertyNames(value).length !== value.length + 1) {
    failEvidence(code, step);
  }
  const result = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence(code, step);
    }
    result.push(descriptor.value);
  }
  return result;
}

function normalizeBytes(input, code, step) {
  if (!ArrayBuffer.isView(input)) failEvidence(code, step);
  let backingBuffer;
  let byteLength;
  let byteOffset;
  let elementLength;
  try {
    backingBuffer = typedArrayBufferGetter.call(input);
    byteLength = typedArrayByteLengthGetter.call(input);
    byteOffset = typedArrayByteOffsetGetter.call(input);
    elementLength = typedArrayLengthGetter.call(input);
  } catch {
    failEvidence(code, step);
  }
  if (byteLength !== elementLength ||
      typeof SharedArrayBuffer === "function" &&
        backingBuffer instanceof SharedArrayBuffer) {
    failEvidence(code, step);
  }
  return Buffer.from(new Uint8Array(backingBuffer, byteOffset, byteLength));
}

function decodeCanonicalBase64(value, expectedBytes, code) {
  if (typeof value !== "string" ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u
        .test(value)) {
    failEvidence(code, "protected-equality-custody");
  }
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== expectedBytes || decoded.toString("base64") !== value) {
    failEvidence(code, "protected-equality-custody");
  }
  return decoded;
}

function rawEd25519PublicKey(publicKeyBase64) {
  const raw = decodeCanonicalBase64(publicKeyBase64, 32,
    "equality_custody_public_key_invalid");
  let key;
  try {
    key = crypto.createPublicKey({
      key: Buffer.concat([ed25519SpkiPrefix, raw]),
      format: "der",
      type: "spki"
    });
  } catch {
    failEvidence("equality_custody_public_key_invalid",
      "protected-equality-custody");
  }
  if (key.asymmetricKeyType !== "ed25519") {
    failEvidence("equality_custody_public_key_invalid",
      "protected-equality-custody");
  }
  return key;
}

function sameStrings(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
    left.every((entry, index) => entry === right[index]);
}

const profileFields = Object.freeze([
  "schema", "profileId", "status", "versionPolicy", "contractRegistrySha256",
  "canonicalJsonProfile", "bundleSchema", "bundleVisibility",
  "signatureAlgorithm", "signatureDomain", "domainSeparatorByte",
  "authorityTrustPolicy", "revisionPolicy", "revisionUniquenessPolicy",
  "timePolicy", "secretPolicy", "handlePolicy", "scanPolicy", "networkAccess",
  "clockAccess", "sourceMutation", "signedFields", "signatureExcludedFields",
  "trustInputFields", "publicBindingSchema", "publicBindingFields",
  "knownSecretRepresentations", "limits"
]);
const limitFields = Object.freeze([
  "maximumBundleBytes", "maximumKnownSecrets", "minimumKnownSecretBytes",
  "maximumKnownSecretBytes", "maximumTotalKnownSecretBytes", "maximumScanBytes",
  "maximumLifetimeSeconds", "maximumGeneration", "maximumFindingClasses"
]);
const expectedSignedFields = Object.freeze([
  "algorithm", "authorityKeyId", "custodyId", "expiresAtUtc", "generation",
  "issuedAtUtc", "knownSecrets", "previousRevisionId", "revisionId", "schema"
]);
const expectedTrustFields = Object.freeze([
  "authorityPublicKeyBase64", "expectedAuthorityKeyId", "expectedCustodyId",
  "expectedGeneration", "expectedRevisionId", "verificationTimeUtc"
]);
const expectedBindingFields = Object.freeze([
  "authorityKeyId", "authorityPublicKeySha256", "custodyId", "generation",
  "knownSecretCount", "profileId", "profileSha256", "revisionId", "schema"
]);
const knownSecretRepresentations = Object.freeze([
  "base64", "base64url", "hexadecimal", "percent-encoded", "utf16be",
  "utf16le", "utf8"
]);

function validateInstalledProfile() {
  const step = "protected-equality-custody-profile";
  exactDataObject(parsedProfile, profileFields,
    "equality_custody_profile_invalid", step);
  exactDataObject(parsedProfile.limits, limitFields,
    "equality_custody_profile_invalid", step);
  if (parsedProfile.schema !==
        "tinyrustlm.vnext.protected_equality_custody_profile.v1" ||
      parsedProfile.profileId !== "tinyrustlm.vnext.protected-equality-custody.v1" ||
      parsedProfile.status !== "frozen" ||
      parsedProfile.versionPolicy !== "single-current-profile-no-compatibility-reader" ||
      parsedProfile.contractRegistrySha256 !== sha256(registryBytes) ||
      parsedProfile.canonicalJsonProfile !==
        "rfc8785-jcs+tinyrustlm.strict-json.v1" ||
      parsedProfile.bundleSchema !==
        "tinyrustlm.vnext.protected_equality_custody_bundle.v1" ||
      parsedProfile.bundleVisibility !==
        "private-memory-only-never-persisted-committed-logged-or-returned" ||
      parsedProfile.signatureAlgorithm !== "Ed25519" ||
      parsedProfile.signatureDomain !==
        "tinyrustlm.protected_equality_custody.v1" ||
      parsedProfile.domainSeparatorByte !== 0 ||
      parsedProfile.authorityTrustPolicy !==
        "exact-caller-pinned-public-key-and-key-id-at-custody-open" ||
      parsedProfile.revisionPolicy !==
        "exact-custody-revision-generation-and-predecessor-chain-pinned-before-scanning" ||
      parsedProfile.revisionUniquenessPolicy !==
        "authority-must-issue-a-new-opaque-revision-id-for-every-secret-set-change" ||
      parsedProfile.timePolicy !==
        "caller-trusted-verification-time-must-be-within-signed-validity-window" ||
      parsedProfile.secretPolicy !==
        "validated-private-memory-only-no-export-no-secret-hash-no-public-commitment" ||
      parsedProfile.handlePolicy !==
        "module-issued-opaque-handle-only-no-structural-substitution" ||
      parsedProfile.scanPolicy !==
        "all-frozen-representations-scanned-without-secret-material-in-results" ||
      parsedProfile.networkAccess !== "forbidden" ||
      parsedProfile.clockAccess !== "forbidden-caller-trusted-time-only" ||
      parsedProfile.sourceMutation !== "forbidden" ||
      !sameStrings(parsedProfile.signedFields, expectedSignedFields) ||
      !sameStrings(parsedProfile.signatureExcludedFields, ["signature"]) ||
      !sameStrings(parsedProfile.trustInputFields, expectedTrustFields) ||
      parsedProfile.publicBindingSchema !==
        "tinyrustlm.vnext.protected_equality_custody_binding.v1" ||
      !sameStrings(parsedProfile.publicBindingFields, expectedBindingFields) ||
      !sameStrings(parsedProfile.knownSecretRepresentations,
        knownSecretRepresentations) ||
      !Object.values(parsedProfile.limits)
        .every((value) => Number.isSafeInteger(value) && value > 0) ||
      parsedProfile.limits.minimumKnownSecretBytes >
        parsedProfile.limits.maximumKnownSecretBytes ||
      parsedProfile.limits.maximumTotalKnownSecretBytes >
        parsedProfile.limits.maximumBundleBytes ||
      parsedProfile.limits.maximumGeneration > 0xffffffff) {
    failEvidence("equality_custody_profile_invalid", step);
  }
}

validateInstalledProfile();

const protectedEqualityCustodyProfile = deepFreeze({ ...parsedProfile });
const bundleFields = Object.freeze([
  ...expectedSignedFields,
  ...parsedProfile.signatureExcludedFields
].sort());
const bundleParserLimits = Object.freeze({
  maximumBytes: parsedProfile.limits.maximumBundleBytes,
  maximumDepth: 4,
  maximumTotalEntries: parsedProfile.limits.maximumKnownSecrets + 32,
  maximumObjectMembers: bundleFields.length,
  maximumArrayItems: parsedProfile.limits.maximumKnownSecrets,
  maximumStringCodeUnits: parsedProfile.limits.maximumKnownSecretBytes * 2,
  maximumTotalStringCodeUnits: parsedProfile.limits.maximumTotalKnownSecretBytes * 2,
  maximumNumberCharacters: 16
});
const bundleJcsLimits = Object.freeze({
  maximumDepth: 4,
  maximumTotalEntries: parsedProfile.limits.maximumKnownSecrets + 32,
  maximumObjectMembers: bundleFields.length,
  maximumArrayItems: parsedProfile.limits.maximumKnownSecrets,
  maximumStringCodeUnits: parsedProfile.limits.maximumKnownSecretBytes * 2,
  maximumTotalStringCodeUnits: parsedProfile.limits.maximumTotalKnownSecretBytes * 2,
  numberProfile: "vnext-safe-integer"
});

function validateUnicodeString(value) {
  if (typeof value !== "string") return false;
  for (let offset = 0; offset < value.length; offset += 1) {
    const codeUnit = value.charCodeAt(offset);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(offset + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      offset += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function normalizeSecrets(value) {
  const source = exactDataArray(value, "equality_custody_secret_list_invalid",
    "protected-equality-custody");
  if (source.length > parsedProfile.limits.maximumKnownSecrets) {
    failEvidence("equality_custody_secret_limit", "protected-equality-custody");
  }
  const result = [];
  const seen = new Set();
  let totalBytes = 0;
  for (const secret of source) {
    if (!validateUnicodeString(secret) || seen.has(secret)) {
      failEvidence("equality_custody_secret_invalid", "protected-equality-custody");
    }
    const bytes = Buffer.from(secret, "utf8");
    if (bytes.length < parsedProfile.limits.minimumKnownSecretBytes ||
        bytes.length > parsedProfile.limits.maximumKnownSecretBytes) {
      failEvidence("equality_custody_secret_invalid", "protected-equality-custody");
    }
    totalBytes += bytes.length;
    if (totalBytes > parsedProfile.limits.maximumTotalKnownSecretBytes) {
      failEvidence("equality_custody_secret_limit", "protected-equality-custody");
    }
    seen.add(secret);
    result.push(Object.freeze({ secret, bytes }));
  }
  return Object.freeze(result);
}

function signingBytesFor(bundle) {
  const payload = {};
  for (const name of parsedProfile.signedFields) payload[name] = bundle[name];
  const domainBytes = Buffer.from(parsedProfile.signatureDomain, "utf8");
  const separatorBytes = Buffer.from([parsedProfile.domainSeparatorByte]);
  const payloadBytes = canonicalizeVnextJcsBytes(payload, bundleJcsLimits);
  try {
    return Buffer.concat([domainBytes, separatorBytes, payloadBytes]);
  } finally {
    domainBytes.fill(0);
    separatorBytes.fill(0);
    payloadBytes.fill(0);
  }
}

function bindingFor(bundle, knownSecretCount, authorityPublicKeySha256) {
  const value = deepFreeze({
    schema: parsedProfile.publicBindingSchema,
    profileId: parsedProfile.profileId,
    profileSha256: protectedEqualityCustodyProfileSha256,
    custodyId: bundle.custodyId,
    revisionId: bundle.revisionId,
    generation: bundle.generation,
    authorityKeyId: bundle.authorityKeyId,
    authorityPublicKeySha256,
    knownSecretCount
  });
  const bytes = canonicalizeVnextJcsBytes(value);
  return Object.freeze({
    value,
    sha256: sha256(bytes)
  });
}

function createVnextProtectedEqualityCustody(rawBundleBytes, rawTrustInput) {
  const bundleBytes = normalizeBytes(rawBundleBytes,
    "equality_custody_bundle_bytes_required", "protected-equality-custody");
  let authorityPublicKeyBytes = null;
  let canonicalBundleBytes = null;
  let signatureBytes = null;
  let verificationBytes = null;
  try {
    if (bundleBytes.length === 0 ||
        bundleBytes.length > parsedProfile.limits.maximumBundleBytes) {
      failEvidence("equality_custody_bundle_byte_limit", "protected-equality-custody");
    }
    let parsedBundle;
    try {
      parsedBundle = parseStrictJson(bundleBytes, bundleParserLimits);
    } catch (error) {
      failEvidence("equality_custody_bundle_invalid", "protected-equality-custody",
        error?.code);
    }
    const bundle = exactDataObject(parsedBundle, bundleFields,
      "equality_custody_bundle_invalid", "protected-equality-custody");
    try {
      canonicalBundleBytes = canonicalizeVnextJcsBytes(bundle, bundleJcsLimits);
    } catch (error) {
      failEvidence("equality_custody_bundle_invalid", "protected-equality-custody",
        error?.code);
    }
    if (!canonicalBundleBytes.equals(bundleBytes)) {
      failEvidence("equality_custody_bundle_wire_invalid", "protected-equality-custody");
    }
    const trust = exactDataObject(rawTrustInput, parsedProfile.trustInputFields,
      "equality_custody_trust_input_invalid", "protected-equality-custody");
    for (const value of [bundle.authorityKeyId, bundle.custodyId, bundle.revisionId,
      trust.expectedAuthorityKeyId, trust.expectedCustodyId,
      trust.expectedRevisionId]) {
      if (typeof value !== "string" || !safeIdPattern.test(value)) {
        failEvidence("equality_custody_identifier_invalid",
          "protected-equality-custody");
      }
    }
    if (bundle.schema !== parsedProfile.bundleSchema ||
        bundle.algorithm !== parsedProfile.signatureAlgorithm ||
        bundle.authorityKeyId !== trust.expectedAuthorityKeyId ||
        bundle.custodyId !== trust.expectedCustodyId ||
        bundle.revisionId !== trust.expectedRevisionId ||
        !Number.isSafeInteger(bundle.generation) || bundle.generation < 1 ||
        bundle.generation > parsedProfile.limits.maximumGeneration ||
        bundle.generation !== trust.expectedGeneration) {
      failEvidence("equality_custody_pin_mismatch", "protected-equality-custody");
    }
    if (bundle.generation === 1 ? bundle.previousRevisionId !== null :
      typeof bundle.previousRevisionId !== "string" ||
        !safeIdPattern.test(bundle.previousRevisionId) ||
        bundle.previousRevisionId === bundle.revisionId) {
      failEvidence("equality_custody_revision_chain_invalid",
        "protected-equality-custody");
    }
    const issuedAt = utcNanoseconds(bundle.issuedAtUtc);
    const expiresAt = utcNanoseconds(bundle.expiresAtUtc);
    const verificationTime = utcNanoseconds(trust.verificationTimeUtc);
    if (issuedAt === null || expiresAt === null || verificationTime === null ||
        expiresAt <= issuedAt ||
        expiresAt - issuedAt >
          BigInt(parsedProfile.limits.maximumLifetimeSeconds) * 1_000_000_000n ||
        verificationTime < issuedAt || verificationTime > expiresAt) {
      failEvidence("equality_custody_time_invalid", "protected-equality-custody");
    }
    const secrets = normalizeSecrets(bundle.knownSecrets);
    signatureBytes = decodeCanonicalBase64(bundle.signature, 64,
      "equality_custody_signature_invalid");
    authorityPublicKeyBytes = decodeCanonicalBase64(
      trust.authorityPublicKeyBase64,
      32,
      "equality_custody_public_key_invalid"
    );
    const publicKey = rawEd25519PublicKey(trust.authorityPublicKeyBase64);
    let verified = false;
    try {
      verificationBytes = signingBytesFor(bundle);
      verified = crypto.verify(null, verificationBytes, publicKey, signatureBytes);
    } catch {
      failEvidence("equality_custody_signature_invalid", "protected-equality-custody");
    }
    if (!verified) {
      failEvidence("equality_custody_signature_invalid", "protected-equality-custody");
    }
    const binding = bindingFor(bundle, secrets.length,
      sha256(authorityPublicKeyBytes));
    const compiledSecrets = Object.freeze(secrets.map((secret) =>
      Object.freeze({ representations: representations(secret) })));
    const custody = Object.freeze({
      schema: binding.value.schema,
      custodyId: binding.value.custodyId,
      revisionId: binding.value.revisionId,
      generation: binding.value.generation
    });
    privateCustodies.set(custody, Object.freeze({ binding, compiledSecrets }));
    issuedCustodies.add(custody);
    return custody;
  } finally {
    bundleBytes.fill(0);
    if (authorityPublicKeyBytes !== null) authorityPublicKeyBytes.fill(0);
    if (canonicalBundleBytes !== null) canonicalBundleBytes.fill(0);
    if (signatureBytes !== null) signatureBytes.fill(0);
    if (verificationBytes !== null) verificationBytes.fill(0);
  }
}

function privateCustodyFor(custody) {
  if (!issuedCustodies.has(custody)) {
    failEvidence("equality_custody_handle_invalid", "protected-equality-scan");
  }
  const value = privateCustodies.get(custody);
  if (!value) failEvidence("equality_custody_handle_invalid", "protected-equality-scan");
  return value;
}

function inspectVnextProtectedEqualityCustody(custody) {
  const entry = privateCustodyFor(custody);
  return deepFreeze({ ...entry.binding.value,
    bindingSha256: entry.binding.sha256 });
}

function percentEncodeEveryByte(bytes) {
  return Array.from(bytes,
    (byte) => `%${byte.toString(16).toUpperCase().padStart(2, "0")}`).join("");
}

function uniqueAsciiBuffers(values) {
  return [...new Set(values)].map((value) => Buffer.from(value, "ascii"));
}

function isAsciiHex(byte) {
  return byte >= 0x30 && byte <= 0x39 ||
    byte >= 0x41 && byte <= 0x46 || byte >= 0x61 && byte <= 0x66;
}

function lowerAsciiHex(byte) {
  return byte >= 0x41 && byte <= 0x46 ? byte + 0x20 : byte;
}

function normalizeHexCase(bytes) {
  const normalized = Buffer.from(bytes);
  for (let index = 0; index < normalized.length; index += 1) {
    normalized[index] = lowerAsciiHex(normalized[index]);
  }
  return normalized;
}

function normalizePercentHexCase(bytes) {
  const normalized = Buffer.from(bytes);
  for (let index = 0; index + 2 < normalized.length; index += 1) {
    if (normalized[index] === 0x25 && isAsciiHex(normalized[index + 1]) &&
        isAsciiHex(normalized[index + 2])) {
      normalized[index + 1] = lowerAsciiHex(normalized[index + 1]);
      normalized[index + 2] = lowerAsciiHex(normalized[index + 2]);
      index += 2;
    }
  }
  return normalized;
}

function representations(entry) {
  const utf16be = Buffer.from(entry.secret, "utf16le");
  utf16be.swap16();
  const encodedUri = encodeURIComponent(entry.secret);
  const fullyEncoded = percentEncodeEveryByte(entry.bytes);
  const standardBase64 = entry.bytes.toString("base64");
  const unpaddedBase64 = standardBase64.replace(/=+$/u, "");
  const unpaddedBase64Url = entry.bytes.toString("base64url");
  const paddedBase64Url = unpaddedBase64Url +
    "=".repeat((4 - unpaddedBase64Url.length % 4) % 4);
  return Object.freeze([
    Object.freeze({ id: "base64",
      bytes: uniqueAsciiBuffers([standardBase64, unpaddedBase64]) }),
    Object.freeze({ id: "base64url",
      bytes: uniqueAsciiBuffers([unpaddedBase64Url, paddedBase64Url]) }),
    Object.freeze({ id: "hexadecimal",
      bytes: [Buffer.from(entry.bytes.toString("hex"), "ascii")] }),
    Object.freeze({ id: "percent-encoded", bytes: uniqueAsciiBuffers([
      fullyEncoded, ...(encodedUri === entry.secret ? [] : [encodedUri])
    ]) }),
    Object.freeze({ id: "utf16be", bytes: [utf16be] }),
    Object.freeze({ id: "utf16le", bytes: [Buffer.from(entry.secret, "utf16le")] }),
    Object.freeze({ id: "utf8", bytes: [entry.bytes] })
  ]);
}

function scanVnextProtectedEqualityBytes(input, custody) {
  const bytes = normalizeBytes(input, "equality_custody_scan_bytes_required",
    "protected-equality-scan");
  if (bytes.length > parsedProfile.limits.maximumScanBytes) {
    failEvidence("equality_custody_scan_byte_limit", "protected-equality-scan");
  }
  const entry = privateCustodyFor(custody);
  const findings = new Set();
  const hexBytes = entry.compiledSecrets.length === 0 ? null : normalizeHexCase(bytes);
  const percentBytes = entry.compiledSecrets.length === 0 ? null :
    normalizePercentHexCase(bytes);
  for (const secret of entry.compiledSecrets) {
    const matched = new Set();
    for (const representation of secret.representations) {
      if (representation.id === "base64url" && matched.has("base64")) continue;
      const source = representation.id === "hexadecimal" ? hexBytes :
        representation.id === "percent-encoded" ? percentBytes : bytes;
      const candidates = representation.id === "hexadecimal" ?
        representation.bytes.map(normalizeHexCase) :
        representation.id === "percent-encoded" ?
          representation.bytes.map(normalizePercentHexCase) : representation.bytes;
      if (candidates.some((candidate) => candidate.length > 0 &&
          source.includes(candidate))) {
        matched.add(representation.id);
        findings.add(`known-secret-${representation.id}`);
      }
    }
  }
  if (findings.size > parsedProfile.limits.maximumFindingClasses) {
    failEvidence("equality_custody_finding_limit", "protected-equality-scan");
  }
  const findingClasses = Object.freeze([...findings].sort());
  return deepFreeze({
    findingCount: findingClasses.length,
    findingClasses,
    binding: { ...entry.binding.value },
    bindingSha256: entry.binding.sha256
  });
}

function scanVnextProtectedEqualityText(value, custody) {
  if (!validateUnicodeString(value)) {
    failEvidence("equality_custody_scan_text_invalid", "protected-equality-scan");
  }
  const entry = privateCustodyFor(custody);
  if (entry.compiledSecrets.length === 0) {
    return Object.freeze({ findingCount: 0, findingClasses: Object.freeze([]) });
  }
  const scan = scanVnextProtectedEqualityBytes(Buffer.from(value, "utf8"), custody);
  return Object.freeze({
    findingCount: scan.findingCount,
    findingClasses: scan.findingClasses
  });
}

module.exports = Object.freeze({
  createVnextProtectedEqualityCustody,
  inspectVnextProtectedEqualityCustody,
  protectedEqualityCustodyProfile,
  protectedEqualityCustodyProfileSha256,
  scanVnextProtectedEqualityBytes,
  scanVnextProtectedEqualityText
});
