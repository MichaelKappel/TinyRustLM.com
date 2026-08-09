"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");
const {
  validateVnextSchemaWithRegistry
} = require("./vnext-contract-validator-registry.js");
const {
  validateVnextIdentityDocumentBytes
} = require("./vnext-content-identity.js");
const {
  canonicalizeVnextJcsBytes
} = require("./vnext-jcs.js");
const {
  finalizeVnextReceipt,
  validateVnextReceiptBytes
} = require("./vnext-receipt-identity.js");
const {
  VnextEvidenceError,
  failEvidence
} = require("./vnext-evidence-error.js");

const contractRoot = path.resolve(__dirname, "../../contracts/vnext");
const profilePath = path.join(contractRoot, "public-safe-redaction-profile.v1.json");
const registryPath = path.join(contractRoot, "contract-family.v1.json");
const profileBytes = fs.readFileSync(profilePath);
const registryBytes = fs.readFileSync(registryPath);
const parsedProfile = parseStrictJson(profileBytes);
const registry = parseStrictJson(registryBytes);

const detectorRules = Object.freeze([
  Object.freeze({
    id: "authorization-header",
    pattern: /(?:^|[\s"'])Authorization\s*:\s*(?:Basic|Bearer)\s+[^\s"']{8,}|\bBearer\s+[A-Za-z0-9._~+/-]{16,}={0,2}/iu
  }),
  Object.freeze({
    id: "aws-access-key",
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u
  }),
  Object.freeze({
    id: "cookie-credential",
    pattern: /(?:^|[\s;"'])(?:Cookie\s*:|(?:auth|credential|session|token)[_-]?cookie\s*[:=])\s*[^\s;"']{12,}/iu
  }),
  Object.freeze({
    id: "credential-assignment",
    pattern: /\b(?:api[_-]?key|bearer[_-]?token|client[_-]?secret|credential|enrollment[_-]?secret|password|private[_-]?key|workspace[_-]?key)\s*[:=]\s*["']?[A-Za-z0-9+/_=-]{16,}/iu
  }),
  Object.freeze({
    id: "credential-bearing-url",
    pattern: /https?:\/\/[^\s/:?#"']{1,128}:[^\s/@"']{1,256}@|[?&](?:access_token|api[_-]?key|authorization|bearer|code|credential|invite|invitation|key|password|secret|token)=[^\s&#"']{8,}/iu
  }),
  Object.freeze({
    id: "exception-detail",
    pattern: /\b(?:Error|Exception)\s*:\s*[^\r\n]{16,}|\bat\s+[^\r\n(]{1,128}\([^\r\n)]{1,256}:\d+:\d+\)/u
  }),
  Object.freeze({
    id: "github-token",
    pattern: /\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{24,}\b/u
  }),
  Object.freeze({
    id: "invitation-secret-url",
    pattern: /https?:\/\/[^\s"']+\/(?:claim|enroll|invite|invitation)\/[A-Za-z0-9._~-]{16,}(?:[/?#\s"']|$)/iu
  }),
  Object.freeze({
    id: "jwt-credential",
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/u
  }),
  Object.freeze({
    id: "openai-api-key",
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/u
  }),
  Object.freeze({
    id: "private-absolute-path",
    pattern: /(?:^|[\s"'(])(?:[A-Za-z]:[\\/]|\\\\[^\\\s]+\\[^\\\s]+|\/(?:Users|home|mnt\/[A-Za-z]|private|root|tmp|var\/tmp|workspace|workspaces)\/)/u
  }),
  Object.freeze({
    id: "private-key-material",
    pattern: /-----BEGIN (?:EC |OPENSSH |RSA )?PRIVATE KEY-----/u
  }),
  Object.freeze({
    id: "raw-conversation-content",
    pattern: /(?:^|[\r\n])\s*(?:assistant output|prompt text|raw output|raw prompt)\s*:\s*\S/iu
  }),
  Object.freeze({
    id: "raw-hosted-memory",
    pattern: /(?:^|[\r\n])\s*(?:hosted memory|long[- ]term memory|memory payload|short[- ]term state)\s*:\s*\S/iu
  }),
  Object.freeze({
    id: "stable-hardware-identifier",
    pattern: /\b(?:device|hardware|machine)[_-]?(?:id|serial|uuid)\s*[:=]\s*[A-Za-z0-9._:-]{8,}|\b(?:[0-9A-F]{2}:){5}[0-9A-F]{2}\b/iu
  })
]);
const detectorRuleIds = Object.freeze([
  ...detectorRules.map((entry) => entry.id),
  "high-entropy-unapproved"
].sort());
const knownSecretRepresentations = Object.freeze([
  "base64", "base64url", "hexadecimal", "percent-encoded", "utf16be",
  "utf16le", "utf8"
]);
const issuedScans = new WeakSet();
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

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, expected, code, step) {
  if (!isPlainObject(value)) failEvidence(code, step);
  if (Object.getOwnPropertySymbols(value).length !== 0) failEvidence(code, step);
  const actual = Object.getOwnPropertyNames(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length ||
      actual.some((name, index) => name !== wanted[index])) {
    failEvidence(code, step);
  }
  for (const name of actual) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence(code, step);
    }
  }
}

function sameStrings(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

function sortedUniqueStrings(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string") &&
    value.every((entry, index) => index === 0 || value[index - 1] < entry);
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value)) deepFreeze(entry);
    Object.freeze(value);
  }
  return value;
}

const profileFields = Object.freeze([
  "schema", "profileId", "status", "versionPolicy", "contractRegistrySha256",
  "canonicalJsonProfile", "defaultVisibility", "inputPolicy", "outputPolicy",
  "knownSecretPolicy", "networkAccess", "sourceMutation", "redactionMarkersAllowed",
  "publicSafeClasses", "privateClasses", "forbiddenFieldNames",
  "forbiddenValueClasses", "knownSecretRepresentations", "detectorRuleIds",
  "entropyExemptFieldTypes", "resultSchema", "resultFields", "limits"
]);
const limitFields = Object.freeze([
  "maximumInputBytes", "maximumKnownSecrets", "minimumKnownSecretBytes",
  "maximumKnownSecretBytes", "maximumTotalKnownSecretBytes",
  "maximumFindingClasses", "maximumResultBytes", "entropyMinimumTokenLength",
  "entropyMaximumTokenLength", "entropyThresholdMilliBits"
]);

function validateInstalledProfile() {
  exactKeys(parsedProfile, profileFields, "redaction_profile_invalid", "redaction-profile");
  exactKeys(parsedProfile.limits, limitFields,
    "redaction_profile_invalid", "redaction-profile");
  const registrySha256 = sha256(registryBytes);
  const publicClasses = registry.contracts.filter((entry) => entry.visibility === "public-safe")
    .map((entry) => entry.class).sort();
  const privateClasses = registry.contracts.filter((entry) => entry.visibility === "private")
    .map((entry) => entry.class).sort();
  const profileLimits = Object.values(parsedProfile.limits);
  const maximumPublicBytes = Math.max(...registry.contracts
    .filter((entry) => entry.visibility === "public-safe")
    .map((entry) => entry.maximumBytes));
  if (parsedProfile.schema !== "tinyrustlm.vnext.public_safe_redaction_profile.v1" ||
      parsedProfile.profileId !== "tinyrustlm.vnext.public-safe-redaction.v1" ||
      parsedProfile.status !== "frozen" ||
      parsedProfile.contractRegistrySha256 !== registrySha256 ||
      parsedProfile.defaultVisibility !== registry.redaction.defaultVisibility ||
      parsedProfile.inputPolicy !== "bounded-final-canonical-utf8-bytes-only" ||
      parsedProfile.outputPolicy !== "unchanged-canonical-bytes-on-pass-no-output-on-fail" ||
      parsedProfile.knownSecretPolicy !==
        "private-equality-input-not-persisted-or-committed" ||
      parsedProfile.networkAccess !== "forbidden" ||
      parsedProfile.sourceMutation !== "forbidden" ||
      parsedProfile.redactionMarkersAllowed !== false ||
      !sameStrings(parsedProfile.publicSafeClasses, publicClasses) ||
      !sameStrings(parsedProfile.privateClasses, privateClasses) ||
      !sameStrings(parsedProfile.forbiddenFieldNames,
        [...registry.redaction.forbiddenFieldNames]) ||
      !sameStrings(parsedProfile.forbiddenValueClasses,
        [...registry.redaction.forbiddenValueClasses]) ||
      !sameStrings(parsedProfile.knownSecretRepresentations, knownSecretRepresentations) ||
      !sameStrings(parsedProfile.detectorRuleIds, detectorRuleIds) ||
      !sortedUniqueStrings(parsedProfile.entropyExemptFieldTypes) ||
      !sortedUniqueStrings(parsedProfile.resultFields) ||
      parsedProfile.resultSchema !== "tinyrustlm.vnext.public_safe_scan_result.v1" ||
      parsedProfile.limits.maximumInputBytes !== maximumPublicBytes ||
      !profileLimits.every((value) => Number.isSafeInteger(value) && value > 0) ||
      parsedProfile.limits.minimumKnownSecretBytes >
        parsedProfile.limits.maximumKnownSecretBytes ||
      parsedProfile.limits.entropyMinimumTokenLength >
        parsedProfile.limits.entropyMaximumTokenLength ||
      parsedProfile.limits.maximumResultBytes > parsedProfile.limits.maximumInputBytes) {
    failEvidence("redaction_profile_invalid", "redaction-profile");
  }
}

validateInstalledProfile();

const publicSafeRedactionProfile = deepFreeze({ ...parsedProfile });
const publicSafeRedactionProfileSha256 = sha256(profileBytes);
const recordsByName = new Map(registry.records.map((record) => [record.name, record]));
const contractsByClass = new Map(registry.contracts.map((contract) =>
  [contract.class, contract]));
const entropyExemptFieldTypes = new Set(parsedProfile.entropyExemptFieldTypes);
const forbiddenFieldNames = new Set(parsedProfile.forbiddenFieldNames);
const resultFields = Object.freeze([...parsedProfile.resultFields]);
const resultJcsLimits = Object.freeze({
  maximumDepth: 4,
  maximumTotalEntries: 256,
  maximumObjectMembers: 32,
  maximumArrayItems: parsedProfile.limits.maximumFindingClasses,
  maximumStringCodeUnits: 512,
  maximumTotalStringCodeUnits: 8192
});

function normalizeBytes(input, code = "redaction_bytes_required") {
  if (!ArrayBuffer.isView(input)) {
    failEvidence(code, "public-safe-read");
  }
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
    failEvidence(code, "public-safe-read");
  }
  if (byteLength !== elementLength ||
      (typeof SharedArrayBuffer === "function" &&
        backingBuffer instanceof SharedArrayBuffer)) {
    failEvidence(code, "public-safe-read");
  }
  return Buffer.from(new Uint8Array(backingBuffer, byteOffset, byteLength));
}

function assertDataArray(value, code) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
      Object.getOwnPropertySymbols(value).length !== 0 ||
      Object.getOwnPropertyNames(value).length !== value.length + 1) {
    failEvidence(code, "known-secret-input");
  }
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence(code, "known-secret-input");
    }
  }
}

function normalizeKnownSecrets(value) {
  if (value === undefined) return Object.freeze([]);
  assertDataArray(value, "redaction_known_secret_invalid");
  if (value.length > parsedProfile.limits.maximumKnownSecrets) {
    failEvidence("redaction_known_secret_limit", "known-secret-input");
  }
  const secrets = [];
  let totalBytes = 0;
  const seen = new Set();
  for (let index = 0; index < value.length; index += 1) {
    const secret = Object.getOwnPropertyDescriptor(value, String(index)).value;
    if (typeof secret !== "string") {
      failEvidence("redaction_known_secret_invalid", "known-secret-input");
    }
    for (let offset = 0; offset < secret.length; offset += 1) {
      const codeUnit = secret.charCodeAt(offset);
      if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
        const next = secret.charCodeAt(offset + 1);
        if (!(next >= 0xdc00 && next <= 0xdfff)) {
          failEvidence("redaction_known_secret_invalid", "known-secret-input");
        }
        offset += 1;
      } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
        failEvidence("redaction_known_secret_invalid", "known-secret-input");
      }
    }
    const bytes = Buffer.from(secret, "utf8");
    if (bytes.length < parsedProfile.limits.minimumKnownSecretBytes ||
        bytes.length > parsedProfile.limits.maximumKnownSecretBytes ||
        seen.has(secret)) {
      failEvidence("redaction_known_secret_invalid", "known-secret-input");
    }
    totalBytes += bytes.length;
    if (totalBytes > parsedProfile.limits.maximumTotalKnownSecretBytes) {
      failEvidence("redaction_known_secret_limit", "known-secret-input");
    }
    seen.add(secret);
    secrets.push(Object.freeze({ secret, bytes }));
  }
  return Object.freeze(secrets);
}

function percentEncodeEveryByte(bytes) {
  return Array.from(bytes,
    (byte) => `%${byte.toString(16).toUpperCase().padStart(2, "0")}`).join("");
}

function uniqueAsciiBuffers(values) {
  return [...new Set(values)].map((value) => Buffer.from(value, "ascii"));
}

function isAsciiHex(byte) {
  return (byte >= 0x30 && byte <= 0x39) ||
    (byte >= 0x41 && byte <= 0x46) ||
    (byte >= 0x61 && byte <= 0x66);
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

function secretRepresentations(entry) {
  const utf16be = Buffer.from(entry.secret, "utf16le");
  utf16be.swap16();
  const encodedUri = encodeURIComponent(entry.secret);
  const fullyEncoded = percentEncodeEveryByte(entry.bytes);
  const standardBase64 = entry.bytes.toString("base64");
  const unpaddedBase64 = standardBase64.replace(/=+$/u, "");
  const unpaddedBase64Url = entry.bytes.toString("base64url");
  const paddedBase64Url = unpaddedBase64Url +
    "=".repeat((4 - (unpaddedBase64Url.length % 4)) % 4);
  return Object.freeze([
    Object.freeze({
      id: "base64",
      bytes: uniqueAsciiBuffers([standardBase64, unpaddedBase64])
    }),
    Object.freeze({
      id: "base64url",
      bytes: uniqueAsciiBuffers([unpaddedBase64Url, paddedBase64Url])
    }),
    Object.freeze({
      id: "hexadecimal",
      bytes: [Buffer.from(entry.bytes.toString("hex"), "ascii")]
    }),
    Object.freeze({
      id: "percent-encoded",
      bytes: uniqueAsciiBuffers([
        fullyEncoded,
        ...(encodedUri === entry.secret ? [] : [encodedUri])
      ])
    }),
    Object.freeze({ id: "utf16be", bytes: [utf16be] }),
    Object.freeze({ id: "utf16le", bytes: [Buffer.from(entry.secret, "utf16le")] }),
    Object.freeze({ id: "utf8", bytes: [entry.bytes] })
  ]);
}

function scanKnownSecretRepresentations(input, knownSecrets = []) {
  const bytes = normalizeBytes(input);
  if (bytes.length > parsedProfile.limits.maximumInputBytes) {
    failEvidence("redaction_input_byte_limit", "public-safe-read");
  }
  const secrets = normalizeKnownSecrets(knownSecrets);
  const findings = new Set();
  const hexNormalizedBytes = secrets.length === 0 ? null : normalizeHexCase(bytes);
  const percentNormalizedBytes = secrets.length === 0 ? null :
    normalizePercentHexCase(bytes);
  for (const entry of secrets) {
    const matchedRepresentations = new Set();
    for (const representation of secretRepresentations(entry)) {
      if (representation.id === "base64url" &&
          matchedRepresentations.has("base64")) {
        continue;
      }
      const source = representation.id === "hexadecimal" ? hexNormalizedBytes :
        representation.id === "percent-encoded" ? percentNormalizedBytes : bytes;
      const candidates = representation.id === "hexadecimal" ?
        representation.bytes.map(normalizeHexCase) :
        representation.id === "percent-encoded" ?
          representation.bytes.map(normalizePercentHexCase) : representation.bytes;
      if (candidates.some((candidate) =>
        candidate.length > 0 && source.includes(candidate))) {
        matchedRepresentations.add(representation.id);
        findings.add(`known-secret-${representation.id}`);
      }
    }
  }
  const findingClasses = Object.freeze([...findings].sort());
  return Object.freeze({
    findingCount: findingClasses.length,
    findingClasses
  });
}

function normalizeOptions(options) {
  if (options === undefined) return Object.freeze({ knownSecrets: Object.freeze([]) });
  exactKeys(options, ["knownSecrets"], "redaction_options_invalid", "public-safe-options");
  return Object.freeze({ knownSecrets: normalizeKnownSecrets(options.knownSecrets) });
}

function shannonEntropy(value) {
  const counts = new Map();
  for (const character of value) counts.set(character, (counts.get(character) ?? 0) + 1);
  let entropy = 0;
  for (const count of counts.values()) {
    const probability = count / value.length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}

function hasUnapprovedEntropy(value, fieldType) {
  if (entropyExemptFieldTypes.has(fieldType)) return false;
  const minimum = parsedProfile.limits.entropyMinimumTokenLength;
  const maximum = parsedProfile.limits.entropyMaximumTokenLength;
  const pattern = new RegExp(`[A-Za-z0-9+/_=-]{${minimum},${maximum}}`, "gu");
  for (const match of value.matchAll(pattern)) {
    const token = match[0];
    const categories = [/[a-z]/u, /[A-Z]/u, /[0-9]/u, /[+/_=-]/u]
      .filter((candidate) => candidate.test(token)).length;
    if (categories >= 3 &&
        shannonEntropy(token) * 1000 >= parsedProfile.limits.entropyThresholdMilliBits) {
      return true;
    }
  }
  return false;
}

function primitiveType(descriptor) {
  if (descriptor.type === "nullable") return descriptor.valueType;
  return descriptor.type;
}

function nestedDescriptor(descriptor) {
  if (descriptor.type === "record") {
    return Object.freeze({ kind: "record", name: descriptor.record });
  }
  if (descriptor.type === "array") {
    if (descriptor.items.startsWith("record:")) {
      return Object.freeze({ kind: "array-record", name: descriptor.items.slice(7) });
    }
    return Object.freeze({ kind: "array-primitive", name: descriptor.items });
  }
  if (descriptor.type === "nullable" && descriptor.valueType.startsWith("record:")) {
    return Object.freeze({ kind: "record", name: descriptor.valueType.slice(7) });
  }
  return null;
}

function addFinding(findings, value) {
  findings.add(value);
  if (findings.size > parsedProfile.limits.maximumFindingClasses) {
    failEvidence("redaction_finding_limit", "public-safe-scan");
  }
}

function scanString(value, fieldType, findings, knownSecrets) {
  for (const entry of knownSecrets) {
    if (value.includes(entry.secret)) addFinding(findings, "known-secret-utf8");
  }
  for (const rule of detectorRules) {
    if (rule.pattern.test(value)) addFinding(findings, rule.id);
  }
  if (hasUnapprovedEntropy(value, fieldType)) {
    addFinding(findings, "high-entropy-unapproved");
  }
}

function scanStructuredValue(value, contract, findings, knownSecrets) {
  const pending = [{ value, fields: contract.fields }];
  while (pending.length > 0) {
    const current = pending.pop();
    const descriptors = new Map(current.fields.map((field) => [field.name, field]));
    for (const [name, child] of Object.entries(current.value)) {
      if (forbiddenFieldNames.has(name)) addFinding(findings, "forbidden-field-name");
      const descriptor = descriptors.get(name);
      if (!descriptor || child === null) continue;
      const nested = nestedDescriptor(descriptor);
      if (nested?.kind === "record") {
        const record = recordsByName.get(nested.name);
        if (!record) failEvidence("redaction_descriptor_invalid", "public-safe-scan");
        pending.push({ value: child, fields: record.fields });
      } else if (nested?.kind === "array-record") {
        const record = recordsByName.get(nested.name);
        if (!record) failEvidence("redaction_descriptor_invalid", "public-safe-scan");
        for (let index = child.length - 1; index >= 0; index -= 1) {
          pending.push({ value: child[index], fields: record.fields });
        }
      } else if (nested?.kind === "array-primitive") {
        for (const entry of child) {
          if (typeof entry === "string") {
            scanString(entry, nested.name, findings, knownSecrets);
          }
        }
      } else if (typeof child === "string") {
        scanString(child, primitiveType(descriptor), findings, knownSecrets);
      }
    }
  }
}

function canonicalResult(value) {
  exactKeys(value, resultFields, "redaction_result_invalid", "public-safe-result");
  const bytes = canonicalizeVnextJcsBytes(value, resultJcsLimits);
  if (bytes.length > parsedProfile.limits.maximumResultBytes) {
    failEvidence("redaction_result_byte_limit", "public-safe-result");
  }
  return Object.freeze({ bytes, sha256: sha256(bytes) });
}

function immutableScan(result, resultBytes, resultSha256, outputBytes) {
  const canonicalResultBytes = Buffer.from(resultBytes);
  const canonicalOutputBytes = outputBytes === null ? null : Buffer.from(outputBytes);
  const scan = { publicSafe: result.scanStatus === "pass", result: deepFreeze(result), resultSha256 };
  Object.defineProperties(scan, {
    resultBytes: {
      enumerable: true,
      get() {
        return Buffer.from(canonicalResultBytes);
      }
    },
    outputBytes: {
      enumerable: true,
      get() {
        return canonicalOutputBytes === null ? null : Buffer.from(canonicalOutputBytes);
      }
    }
  });
  Object.freeze(scan);
  issuedScans.add(scan);
  return scan;
}

function scanVnextPublicDocumentBytes(input, options) {
  const bytes = normalizeBytes(input);
  if (bytes.length === 0 || bytes.length > parsedProfile.limits.maximumInputBytes) {
    failEvidence("redaction_input_byte_limit", "public-safe-read");
  }
  const normalizedOptions = normalizeOptions(options);
  let schemaResult;
  try {
    schemaResult = validateVnextSchemaWithRegistry(bytes);
  } catch (error) {
    throw new VnextEvidenceError("redaction_schema_invalid", "public-safe-schema",
      error?.code);
  }
  if (parsedProfile.privateClasses.includes(schemaResult.contractClass)) {
    failEvidence("redaction_private_schema", "public-safe-schema");
  }
  if (!parsedProfile.publicSafeClasses.includes(schemaResult.contractClass)) {
    failEvidence("redaction_schema_invalid", "public-safe-schema");
  }
  let identity;
  try {
    identity = validateVnextIdentityDocumentBytes(bytes);
  } catch (error) {
    throw new VnextEvidenceError("redaction_identity_invalid", "public-safe-identity",
      error?.code);
  }
  const contract = contractsByClass.get(identity.contractClass);
  if (!contract || contract.visibility !== "public-safe") {
    failEvidence("redaction_descriptor_invalid", "public-safe-scan");
  }

  const secretScan = scanKnownSecretRepresentations(bytes,
    normalizedOptions.knownSecrets.map((entry) => entry.secret));
  const findings = new Set(secretScan.findingClasses);
  scanStructuredValue(identity.value, contract, findings,
    normalizedOptions.knownSecrets);
  const findingClasses = Object.freeze([...findings].sort());
  const result = {
    schema: parsedProfile.resultSchema,
    profileId: parsedProfile.profileId,
    profileSha256: publicSafeRedactionProfileSha256,
    sourceSchema: identity.schema,
    sourceClass: identity.contractClass,
    sourceSubjectId: identity.subjectId,
    sourceCanonicalContentSha256: identity.canonicalContentSha256,
    sourceSha256: sha256(bytes),
    sourceByteLength: bytes.length,
    knownSecretCount: normalizedOptions.knownSecrets.length,
    scanStatus: findingClasses.length === 0 ? "pass" : "fail",
    findingCount: findingClasses.length,
    findingClasses
  };
  const canonical = canonicalResult(result);
  return immutableScan(result, canonical.bytes, canonical.sha256,
    result.scanStatus === "pass" ? bytes : null);
}

function runtimeRecord() {
  const operatingSystem = process.platform === "win32" ? "windows" :
    process.platform === "darwin" ? "macos" :
      process.platform === "linux" ? "linux" : null;
  const architecture = process.arch === "x64" ? "x86_64" :
    process.arch === "arm64" ? "aarch64" : null;
  if (operatingSystem === null || architecture === null) {
    failEvidence("redaction_runtime_unsupported", "redaction-receipt");
  }
  return {
    runtimeIdentifier: `node.${process.versions.node}.${process.platform}.${process.arch}`,
    operatingSystem,
    architecture,
    executionClass: "local"
  };
}

const receiptInputFields = Object.freeze([
  "attemptId", "campaignId", "completedAtUtc", "scan", "sourceRevision",
  "startedAtUtc"
]);
const scannerSourceSha256 = sha256(fs.readFileSync(__filename));

function receiptConfigurationSha256(scan) {
  return sha256(canonicalizeVnextJcsBytes({
    knownSecretCount: scan.result.knownSecretCount,
    knownSecretPolicy: parsedProfile.knownSecretPolicy,
    profileSha256: publicSafeRedactionProfileSha256,
    scannerSourceSha256
  }, resultJcsLimits));
}

function createVnextRedactionScanReceipt(input) {
  exactKeys(input, receiptInputFields,
    "redaction_receipt_input_invalid", "redaction-receipt");
  if (!issuedScans.has(input.scan)) {
    failEvidence("redaction_scan_result_untrusted", "redaction-receipt");
  }
  const scan = input.scan;
  const passed = scan.publicSafe;
  const configurationSha256 = receiptConfigurationSha256(scan);
  const outputHashes = [{
    name: "redaction-scan-result",
    sha256: scan.resultSha256
  }];
  if (passed) {
    outputHashes.unshift({
      name: "public-output-wire",
      sha256: scan.result.sourceSha256
    });
  }
  return finalizeVnextReceipt({
    schema: "tinyrustlm.vnext.receipt.v1",
    receiptType: "redaction-scan",
    campaignId: input.campaignId,
    attemptId: input.attemptId,
    phase: "redaction-scan",
    status: passed ? "pass" : "fail",
    startedAtUtc: input.startedAtUtc,
    completedAtUtc: input.completedAtUtc,
    sourceRevision: input.sourceRevision,
    inputReceiptIds: [],
    inputHashes: [
      { name: "public-safe-redaction-profile", sha256: publicSafeRedactionProfileSha256 },
      {
        name: "target-canonical-content",
        sha256: scan.result.sourceCanonicalContentSha256
      },
      { name: "target-wire", sha256: scan.result.sourceSha256 }
    ],
    outputHashes,
    tools: [{
      name: "tinyrustlm.vnext.public_safe_redaction",
      version: "1.0.0",
      binarySha256: scannerSourceSha256
    }],
    configurationSha256,
    runtime: runtimeRecord(),
    publicParameters: [
      { name: "finding_count", value: String(scan.result.findingCount), unit: null },
      {
        name: "known_secret_count",
        value: String(scan.result.knownSecretCount),
        unit: null
      },
      { name: "scan_status", value: scan.result.scanStatus, unit: null },
      {
        name: "source_byte_length",
        value: String(scan.result.sourceByteLength),
        unit: "bytes"
      },
      { name: "source_class", value: scan.result.sourceClass, unit: null }
    ],
    error: passed ? null : {
      code: "secret-material-detected",
      failureStep: "public-safe-scan",
      retryStatus: "terminal",
      rollbackStatus: "not-required"
    },
    blockerCode: passed ? null : "public-evidence-secret-scan-failed",
    externalEvidenceReferences: [],
    redaction: {
      profile: "tinyrustlm.vnext.public_safe.v1",
      decision: "public-safe"
    },
    attestationReference: null,
    signatureEnvelope: null,
    authorityRegistry: null,
    keyRevocation: null,
    offlineBundle: null,
    supersedesReceiptIds: []
  });
}

const verifierInputFields = Object.freeze([
  "knownSecrets", "receiptBytes", "targetBytes"
]);

function verifyVnextRedactionScanReceipt(input) {
  exactKeys(input, verifierInputFields,
    "redaction_verifier_input_invalid", "redaction-verify");
  const receiptBytes = normalizeBytes(input.receiptBytes,
    "redaction_receipt_bytes_required");
  let validated;
  try {
    validated = validateVnextReceiptBytes(receiptBytes);
  } catch (error) {
    throw new VnextEvidenceError("redaction_receipt_invalid", "redaction-verify",
      error?.code);
  }
  const receipt = validated.receipt;
  if (receipt.receiptType !== "redaction-scan") {
    failEvidence("redaction_receipt_type_invalid", "redaction-verify");
  }
  const scan = scanVnextPublicDocumentBytes(input.targetBytes, {
    knownSecrets: input.knownSecrets
  });
  const expected = createVnextRedactionScanReceipt({
    attemptId: receipt.attemptId,
    campaignId: receipt.campaignId,
    completedAtUtc: receipt.completedAtUtc,
    scan,
    sourceRevision: receipt.sourceRevision,
    startedAtUtc: receipt.startedAtUtc
  });
  if (!expected.bytes.equals(receiptBytes)) {
    failEvidence("redaction_receipt_binding_mismatch", "redaction-verify");
  }
  return deepFreeze({
    redactionReceiptVerified: true,
    receiptId: receipt.receiptId,
    targetSubjectId: scan.result.sourceSubjectId,
    targetCanonicalContentSha256: scan.result.sourceCanonicalContentSha256,
    targetSha256: scan.result.sourceSha256,
    profileId: parsedProfile.profileId,
    profileSha256: publicSafeRedactionProfileSha256,
    scanStatus: scan.result.scanStatus,
    publicSafe: scan.publicSafe,
    findingCount: scan.result.findingCount,
    findingClasses: [...scan.result.findingClasses]
  });
}

module.exports = Object.freeze({
  createVnextRedactionScanReceipt,
  publicSafeRedactionProfile,
  publicSafeRedactionProfileSha256,
  scanKnownSecretRepresentations,
  scanVnextPublicDocumentBytes,
  verifyVnextRedactionScanReceipt
});
