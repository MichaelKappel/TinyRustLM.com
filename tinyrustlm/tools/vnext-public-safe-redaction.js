"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { TextDecoder } = require("node:util");

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
  inspectVnextProtectedEqualityCustody,
  protectedEqualityCustodyProfile,
  protectedEqualityCustodyProfileSha256,
  scanVnextProtectedEqualityBytes,
  scanVnextProtectedEqualityText
} = require("./vnext-protected-equality-custody.js");
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
  "knownSecretPolicy", "protectedEqualityCustodyProfileId",
  "protectedEqualityCustodyProfileSha256", "networkAccess", "sourceMutation",
  "redactionMarkersAllowed",
  "publicSafeClasses", "privateClasses", "forbiddenFieldNames",
  "forbiddenValueClasses", "detectorRuleIds",
  "entropyExemptFieldTypes", "publicJsonControl", "publicText",
  "verificationTargetKinds",
  "resultSchema", "resultFields", "limits"
]);
const publicTextFields = Object.freeze([
  "schema", "class", "identityDomain", "encoding", "minimumBytes"
]);
const publicJsonControlFields = Object.freeze([
  "class", "identityDomain", "schemas", "wirePolicy"
]);
const limitFields = Object.freeze([
  "maximumInputBytes", "maximumFindingClasses", "maximumResultBytes",
  "entropyMinimumTokenLength",
  "entropyMaximumTokenLength", "entropyThresholdMilliBits"
]);

function validateInstalledProfile() {
  exactKeys(parsedProfile, profileFields, "redaction_profile_invalid", "redaction-profile");
  exactKeys(parsedProfile.limits, limitFields,
    "redaction_profile_invalid", "redaction-profile");
  exactKeys(parsedProfile.publicText, publicTextFields,
    "redaction_profile_invalid", "redaction-profile");
  exactKeys(parsedProfile.publicJsonControl, publicJsonControlFields,
    "redaction_profile_invalid", "redaction-profile");
  const registrySha256 = sha256(registryBytes);
  const publicClasses = registry.contracts.filter((entry) => entry.visibility === "public-safe")
    .map((entry) => entry.class).sort();
  const privateClasses = registry.contracts.filter((entry) => entry.visibility === "private")
    .map((entry) => entry.class).sort();
  const profileLimits = Object.values(parsedProfile.limits);
  const maximumPublicBytes = Math.max(4_194_304, ...registry.contracts
    .filter((entry) => entry.visibility === "public-safe")
    .map((entry) => entry.maximumBytes));
  if (parsedProfile.schema !== "tinyrustlm.vnext.public_safe_redaction_profile.v1" ||
      parsedProfile.profileId !== "tinyrustlm.vnext.public-safe-redaction.v1" ||
      parsedProfile.status !== "frozen" ||
      parsedProfile.contractRegistrySha256 !== registrySha256 ||
      parsedProfile.defaultVisibility !== registry.redaction.defaultVisibility ||
      parsedProfile.inputPolicy !==
        "bounded-final-canonical-document-canonical-public-json-control-or-lf-utf8-public-text-bytes-only" ||
      parsedProfile.outputPolicy !== "unchanged-canonical-bytes-on-pass-no-output-on-fail" ||
      parsedProfile.knownSecretPolicy !==
        "one-protected-signed-custody-revision-required-no-caller-secret-list" ||
      parsedProfile.protectedEqualityCustodyProfileId !==
        protectedEqualityCustodyProfile.profileId ||
      parsedProfile.protectedEqualityCustodyProfileSha256 !==
        protectedEqualityCustodyProfileSha256 ||
      parsedProfile.networkAccess !== "forbidden" ||
      parsedProfile.sourceMutation !== "forbidden" ||
      parsedProfile.redactionMarkersAllowed !== false ||
      !sameStrings(parsedProfile.publicSafeClasses, publicClasses) ||
      !sameStrings(parsedProfile.privateClasses, privateClasses) ||
      !sameStrings(parsedProfile.forbiddenFieldNames,
        [...registry.redaction.forbiddenFieldNames]) ||
      !sameStrings(parsedProfile.forbiddenValueClasses,
        [...registry.redaction.forbiddenValueClasses]) ||
      !sameStrings(parsedProfile.detectorRuleIds, detectorRuleIds) ||
      !sortedUniqueStrings(parsedProfile.entropyExemptFieldTypes) ||
      parsedProfile.publicText.schema !== "tinyrustlm.vnext.public_text.v1" ||
      parsedProfile.publicText.class !== "public-text" ||
      parsedProfile.publicText.identityDomain !== "tinyrustlm.public_text.content.v1" ||
      parsedProfile.publicText.encoding !==
        "utf8-no-bom-lf-only-no-controls-terminal-lf" ||
      parsedProfile.publicText.minimumBytes !== 2 ||
      parsedProfile.publicJsonControl.class !== "public-json-control" ||
      parsedProfile.publicJsonControl.identityDomain !==
        "tinyrustlm.public_json_control.content.v1" ||
      !sameStrings(parsedProfile.publicJsonControl.schemas, [
        "tinyrustlm.vnext.site_publication_plan_material.v1",
        "tinyrustlm.vnext.site_release_history.v1",
        "tinyrustlm.vnext.site_release_pointer.v1"
      ]) ||
      parsedProfile.publicJsonControl.wirePolicy !==
        "strict-rfc8785-jcs-no-bom-no-trailing-bytes" ||
      !sameStrings(parsedProfile.verificationTargetKinds,
        ["document", "public-json-control", "public-text"]) ||
      !sortedUniqueStrings(parsedProfile.resultFields) ||
      parsedProfile.resultSchema !== "tinyrustlm.vnext.public_safe_scan_result.v1" ||
      parsedProfile.limits.maximumInputBytes !== maximumPublicBytes ||
      !profileLimits.every((value) => Number.isSafeInteger(value) && value > 0) ||
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
const publicJsonControlParserLimits = Object.freeze({
  maximumBytes: parsedProfile.limits.maximumInputBytes,
  maximumDepth: 32,
  maximumTotalEntries: 131072,
  maximumObjectMembers: 256,
  maximumArrayItems: 4096,
  maximumStringCodeUnits: 65536,
  maximumTotalStringCodeUnits: 2_097_152,
  maximumNumberCharacters: 128
});
const publicJsonControlJcsLimits = Object.freeze({
  maximumDepth: 32,
  maximumTotalEntries: 131072,
  maximumObjectMembers: 256,
  maximumArrayItems: 4096,
  maximumStringCodeUnits: 65536,
  maximumTotalStringCodeUnits: 2_097_152,
  numberProfile: "vnext-safe-integer"
});
const fatalUtf8Decoder = new TextDecoder("utf-8", {
  fatal: true,
  ignoreBOM: true
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

function normalizeOptions(options) {
  exactKeys(options, ["equalityCustody"],
    "redaction_options_invalid", "public-safe-options");
  return Object.freeze({
    equalityCustody: options.equalityCustody,
    equalityCustodyBinding:
      inspectVnextProtectedEqualityCustody(options.equalityCustody)
  });
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

function scanString(value, fieldType, findings, equalityCustody) {
  if (equalityCustody !== null) {
    const equalityScan = scanVnextProtectedEqualityText(value, equalityCustody);
    for (const finding of equalityScan.findingClasses) addFinding(findings, finding);
  }
  for (const rule of detectorRules) {
    if (rule.pattern.test(value)) addFinding(findings, rule.id);
  }
  if (hasUnapprovedEntropy(value, fieldType)) {
    addFinding(findings, "high-entropy-unapproved");
  }
}

function scanStructuredValue(value, contract, findings, equalityCustody) {
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
            scanString(entry, nested.name, findings, equalityCustody);
          }
        }
      } else if (typeof child === "string") {
        scanString(child, primitiveType(descriptor), findings, equalityCustody);
      }
    }
  }
}

function equalityResultFields(secretScan) {
  return {
    equalityCustodyAuthorityKeyId: secretScan.binding.authorityKeyId,
    equalityCustodyAuthorityPublicKeySha256:
      secretScan.binding.authorityPublicKeySha256,
    equalityCustodyBindingSha256: secretScan.bindingSha256,
    equalityCustodyGeneration: secretScan.binding.generation,
    equalityCustodyId: secretScan.binding.custodyId,
    equalityCustodyRevisionId: secretScan.binding.revisionId,
    knownSecretCount: secretScan.binding.knownSecretCount
  };
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

  const secretScan = scanVnextProtectedEqualityBytes(bytes,
    normalizedOptions.equalityCustody);
  const findings = new Set(secretScan.findingClasses);
  scanStructuredValue(identity.value, contract, findings,
    normalizedOptions.equalityCustodyBinding.knownSecretCount === 0 ? null :
      normalizedOptions.equalityCustody);
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
    ...equalityResultFields(secretScan),
    scanStatus: findingClasses.length === 0 ? "pass" : "fail",
    findingCount: findingClasses.length,
    findingClasses
  };
  const canonical = canonicalResult(result);
  return immutableScan(result, canonical.bytes, canonical.sha256,
    result.scanStatus === "pass" ? bytes : null);
}

function publicJsonControlFieldType(name, value) {
  if (typeof value !== "string") return "bounded-text";
  if (/(?:Sha256|Hash)$/u.test(name) && /^[a-f0-9]{64}$/u.test(value)) {
    return "sha256";
  }
  if ((/(?:Id|Ids)$/u.test(name) || name === "releaseId") &&
      /^sha256:[a-f0-9]{64}$/u.test(value)) {
    return "content-id";
  }
  if (name === "sourceRevision" &&
      /^(?:git-sha1:[a-f0-9]{40}|sha256:[a-f0-9]{64})$/u.test(value)) {
    return "source-revision";
  }
  return "bounded-text";
}

function scanPublicJsonControlValue(root, findings, equalityCustody) {
  const pending = [{ name: "", value: root }];
  while (pending.length !== 0) {
    const current = pending.pop();
    if (Array.isArray(current.value)) {
      for (let index = current.value.length - 1; index >= 0; index -= 1) {
        pending.push({ name: current.name, value: current.value[index] });
      }
      continue;
    }
    if (isPlainObject(current.value)) {
      for (const [name, value] of Object.entries(current.value)) {
        if (forbiddenFieldNames.has(name)) addFinding(findings, "forbidden-field-name");
        pending.push({ name, value });
      }
      continue;
    }
    if (typeof current.value === "string") {
      scanString(current.value,
        publicJsonControlFieldType(current.name, current.value),
        findings,
        equalityCustody);
    }
  }
}

function scanVnextPublicJsonControlBytes(input, options) {
  const bytes = normalizeBytes(input);
  if (bytes.length === 0 || bytes.length > parsedProfile.limits.maximumInputBytes) {
    failEvidence("redaction_input_byte_limit", "public-safe-read");
  }
  const normalizedOptions = normalizeOptions(options);
  let value;
  try {
    value = parseStrictJson(bytes, publicJsonControlParserLimits);
  } catch (error) {
    throw new VnextEvidenceError("redaction_public_json_invalid",
      "public-safe-json", error?.code);
  }
  if (!isPlainObject(value) || typeof value.schema !== "string" ||
      !parsedProfile.publicJsonControl.schemas.includes(value.schema)) {
    failEvidence("redaction_public_json_schema_invalid", "public-safe-json");
  }
  let canonicalBytes;
  try {
    canonicalBytes = canonicalizeVnextJcsBytes(value, publicJsonControlJcsLimits);
  } catch (error) {
    throw new VnextEvidenceError("redaction_public_json_invalid",
      "public-safe-json", error?.code);
  }
  if (!canonicalBytes.equals(bytes)) {
    failEvidence("redaction_public_json_wire_invalid", "public-safe-json");
  }
  const secretScan = scanVnextProtectedEqualityBytes(bytes,
    normalizedOptions.equalityCustody);
  const findings = new Set(secretScan.findingClasses);
  scanPublicJsonControlValue(value, findings,
    normalizedOptions.equalityCustodyBinding.knownSecretCount === 0 ? null :
      normalizedOptions.equalityCustody);
  const findingClasses = Object.freeze([...findings].sort());
  const identity = crypto.createHash("sha256")
    .update(Buffer.from(parsedProfile.publicJsonControl.identityDomain, "utf8"))
    .update(Buffer.from([0]))
    .update(bytes)
    .digest("hex");
  const result = {
    schema: parsedProfile.resultSchema,
    profileId: parsedProfile.profileId,
    profileSha256: publicSafeRedactionProfileSha256,
    sourceSchema: value.schema,
    sourceClass: parsedProfile.publicJsonControl.class,
    sourceSubjectId: `sha256:${identity}`,
    sourceCanonicalContentSha256: identity,
    sourceSha256: sha256(bytes),
    sourceByteLength: bytes.length,
    ...equalityResultFields(secretScan),
    scanStatus: findingClasses.length === 0 ? "pass" : "fail",
    findingCount: findingClasses.length,
    findingClasses
  };
  const canonical = canonicalResult(result);
  return immutableScan(result, canonical.bytes, canonical.sha256,
    result.scanStatus === "pass" ? bytes : null);
}

function publicTextIdentity(bytes) {
  return crypto.createHash("sha256")
    .update(Buffer.from(parsedProfile.publicText.identityDomain, "utf8"))
    .update(Buffer.from([0]))
    .update(bytes)
    .digest("hex");
}

function decodeCanonicalPublicText(bytes) {
  if (bytes.length < parsedProfile.publicText.minimumBytes ||
      bytes.length > parsedProfile.limits.maximumInputBytes ||
      (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) ||
      bytes[bytes.length - 1] !== 0x0a) {
    failEvidence("redaction_public_text_wire_invalid", "public-safe-text");
  }
  for (const byte of bytes) {
    if (byte === 0x0d || byte === 0x7f ||
        (byte < 0x20 && byte !== 0x09 && byte !== 0x0a)) {
      failEvidence("redaction_public_text_wire_invalid", "public-safe-text");
    }
  }
  let text;
  try {
    text = fatalUtf8Decoder.decode(bytes);
  } catch {
    failEvidence("redaction_public_text_wire_invalid", "public-safe-text");
  }
  if (!Buffer.from(text, "utf8").equals(bytes)) {
    failEvidence("redaction_public_text_wire_invalid", "public-safe-text");
  }
  return text;
}

function scanVnextPublicTextBytes(input, options) {
  const bytes = normalizeBytes(input);
  const normalizedOptions = normalizeOptions(options);
  const text = decodeCanonicalPublicText(bytes);
  const secretScan = scanVnextProtectedEqualityBytes(bytes,
    normalizedOptions.equalityCustody);
  const findings = new Set(secretScan.findingClasses);
  scanString(text, "bounded-text", findings, null);
  const findingClasses = Object.freeze([...findings].sort());
  const identity = publicTextIdentity(bytes);
  const result = {
    schema: parsedProfile.resultSchema,
    profileId: parsedProfile.profileId,
    profileSha256: publicSafeRedactionProfileSha256,
    sourceSchema: parsedProfile.publicText.schema,
    sourceClass: parsedProfile.publicText.class,
    sourceSubjectId: `sha256:${identity}`,
    sourceCanonicalContentSha256: identity,
    sourceSha256: sha256(bytes),
    sourceByteLength: bytes.length,
    ...equalityResultFields(secretScan),
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
    equalityCustodyBindingSha256: scan.result.equalityCustodyBindingSha256,
    knownSecretCount: scan.result.knownSecretCount,
    knownSecretPolicy: parsedProfile.knownSecretPolicy,
    profileSha256: publicSafeRedactionProfileSha256,
    protectedEqualityCustodyProfileSha256,
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
      {
        name: "protected-equality-custody-binding",
        sha256: scan.result.equalityCustodyBindingSha256
      },
      {
        name: "protected-equality-custody-profile",
        sha256: protectedEqualityCustodyProfileSha256
      },
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
  "equalityCustody", "receiptBytes", "targetBytes", "targetKind"
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
  if (!parsedProfile.verificationTargetKinds.includes(input.targetKind)) {
    failEvidence("redaction_verifier_target_kind_invalid", "redaction-verify");
  }
  const scanner = input.targetKind === "document"
    ? scanVnextPublicDocumentBytes
    : input.targetKind === "public-json-control"
      ? scanVnextPublicJsonControlBytes
      : scanVnextPublicTextBytes;
  const scan = scanner(input.targetBytes, {
    equalityCustody: input.equalityCustody
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
  scanVnextPublicDocumentBytes,
  scanVnextPublicJsonControlBytes,
  scanVnextPublicTextBytes,
  verifyVnextRedactionScanReceipt
});
