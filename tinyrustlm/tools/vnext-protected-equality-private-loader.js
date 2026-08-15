"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");
const {
  createVnextProtectedEqualityCustody,
  protectedEqualityCustodyProfile,
  protectedEqualityCustodyProfileSha256
} = require("./vnext-protected-equality-custody.js");
const { asEvidenceError, failEvidence } = require("./vnext-evidence-error.js");
const { canonicalizeVnextJcsBytes } = require("./vnext-jcs.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "protected-equality-private-loader-profile.v1.json");
const profileBytes = fs.readFileSync(profilePath);
const parsedProfile = parseStrictJson(profileBytes);
const protectedEqualityPrivateLoaderProfileSha256 = sha256(profileBytes);
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

function sameStrings(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
    left.every((entry, index) => entry === right[index]);
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

const profileFields = Object.freeze([
  "schema", "profileId", "status", "versionPolicy", "canonicalJsonProfile",
  "custodyProfileId", "custodyProfileSha256", "trustDescriptorSchema",
  "trustDescriptorVisibility", "trustDescriptorFields", "privateBundleTransport",
  "sourceClosureMembers", "sourceClosurePolicy", "zeroization", "limits",
  "nonClaims"
]);
const transportFields = Object.freeze([
  "descriptor", "descriptorType", "fileTypeCheck", "launcherOwnership",
  "loaderOwnership", "readPolicy", "pathInput", "argumentInput",
  "environmentInput", "standardInput", "networkInput", "runtimeClockInput"
]);
const zeroizationFields = Object.freeze([
  "ownedBuffers", "timing", "primitive", "callerBuffers", "compiledCustodyMemory"
]);
const limitFields = Object.freeze([
  "maximumTrustDescriptorBytes", "maximumPrivateBundleBytes", "readBufferBytes",
  "maximumReadOperations", "maximumSourceMemberBytes"
]);
const expectedTrustDescriptorFields = Object.freeze([
  "authorityPublicKeyBase64", "expectedAuthorityKeyId", "expectedCustodyId",
  "expectedGeneration", "expectedRevisionId", "schema", "verificationTimeUtc"
]);
const expectedSourceClosureMembers = Object.freeze([
  "contracts/vnext/protected-equality-custody-profile.v1.json",
  "contracts/vnext/protected-equality-private-loader-profile.v1.json",
  "contracts/vnext/receipt-signature-profile.v1.json",
  "tinyrustlm/tools/strict-json.js",
  "tinyrustlm/tools/vnext-evidence-error.js",
  "tinyrustlm/tools/vnext-jcs.js",
  "tinyrustlm/tools/vnext-protected-equality-custody.js",
  "tinyrustlm/tools/vnext-protected-equality-private-loader.js",
  "tinyrustlm/tools/vnext-signature-payload.js"
]);
const expectedOwnedBuffers = Object.freeze([
  "bundle-chunks", "bundle-concatenation", "read-scratch", "trust-descriptor-copy"
]);
const expectedNonClaims = Object.freeze([
  "The loader does not issue or sign protected equality bundles.",
  "The loader does not acquire trusted time, discover authorities, or evaluate revocation.",
  "A local inherited-pipe test is not evidence of an authorized production launcher or issuer.",
  "Best-effort buffer zeroization is not a guarantee against process-memory disclosure or runtime copies.",
  "Loading custody does not authorize publication or advance any campaign counter."
]);

function validateInstalledProfile() {
  const step = "protected-equality-private-loader-profile";
  const profile = exactDataObject(parsedProfile, profileFields,
    "equality_loader_profile_invalid", step);
  const transport = exactDataObject(profile.privateBundleTransport, transportFields,
    "equality_loader_profile_invalid", step);
  const zeroization = exactDataObject(profile.zeroization, zeroizationFields,
    "equality_loader_profile_invalid", step);
  const limits = exactDataObject(profile.limits, limitFields,
    "equality_loader_profile_invalid", step);
  const nonClaims = exactDataArray(profile.nonClaims,
    "equality_loader_profile_invalid", step);
  if (profile.schema !==
        "tinyrustlm.vnext.protected_equality_private_loader_profile.v1" ||
      profile.profileId !==
        "tinyrustlm.vnext.protected-equality-private-loader.v1" ||
      profile.status !== "frozen" ||
      profile.versionPolicy !== "single-current-profile-no-compatibility-reader" ||
      profile.canonicalJsonProfile !==
        "rfc8785-jcs+tinyrustlm.strict-json.v1" ||
      profile.custodyProfileId !== protectedEqualityCustodyProfile.profileId ||
      profile.custodyProfileSha256 !== protectedEqualityCustodyProfileSha256 ||
      profile.trustDescriptorSchema !==
        "tinyrustlm.vnext.protected_equality_trust_descriptor.v1" ||
      profile.trustDescriptorVisibility !==
        "public-control-input-without-private-secret-values" ||
      !sameStrings(profile.trustDescriptorFields, expectedTrustDescriptorFields) ||
      !sameStrings(profile.sourceClosureMembers, expectedSourceClosureMembers) ||
      profile.sourceClosurePolicy !==
        "canonical-array-of-relative-path-byte-count-and-sha256-records" ||
      transport.descriptor !== 3 ||
      transport.descriptorType !== "inherited-non-file-pipe" ||
      transport.fileTypeCheck !==
        "fstat-s-ififo-and-reject-files-directories-links-devices-and-sockets" ||
      transport.launcherOwnership !==
        "authorized-launcher-preopens-write-end-writes-one-canonical-bundle-and-closes" ||
      transport.loaderOwnership !== "loader-closes-read-end-on-every-attempt" ||
      transport.readPolicy !== "single-use-bounded-read-until-eof-no-retry" ||
      transport.pathInput !== "forbidden" ||
      transport.argumentInput !== "forbidden-for-private-bundle" ||
      transport.environmentInput !== "forbidden" ||
      transport.standardInput !== "forbidden" ||
      transport.networkInput !== "forbidden" ||
      transport.runtimeClockInput !==
        "forbidden-trusted-time-is-in-canonical-public-control-input" ||
      !sameStrings(zeroization.ownedBuffers, expectedOwnedBuffers) ||
      zeroization.timing !== "finally-after-success-or-failure" ||
      zeroization.primitive !== "node-buffer-fill-zero-best-effort" ||
      zeroization.callerBuffers !== "never-mutated" ||
      zeroization.compiledCustodyMemory !==
        "retained-only-behind-module-issued-opaque-handle" ||
      limits.maximumTrustDescriptorBytes !== 4_096 ||
      limits.maximumPrivateBundleBytes !==
        protectedEqualityCustodyProfile.limits.maximumBundleBytes ||
      limits.readBufferBytes !== 16_384 ||
      limits.maximumReadOperations !== 33 ||
      limits.maximumSourceMemberBytes !== 1_048_576 ||
      !sameStrings(nonClaims, expectedNonClaims)) {
    failEvidence("equality_loader_profile_invalid", step);
  }
}

validateInstalledProfile();

const protectedEqualityPrivateLoaderProfile = deepFreeze({ ...parsedProfile });

function computeSourceClosureSha256() {
  const step = "protected-equality-private-loader-profile";
  const members = protectedEqualityPrivateLoaderProfile.sourceClosureMembers.map(
    (relativePath) => {
      let bytes;
      try {
        bytes = fs.readFileSync(path.join(repositoryRoot, ...relativePath.split("/")));
      } catch (error) {
        throw asEvidenceError(error, "equality_loader_source_invalid", step);
      }
      if (!Buffer.isBuffer(bytes) || bytes.length === 0 ||
          bytes.length > protectedEqualityPrivateLoaderProfile.limits
            .maximumSourceMemberBytes) {
        failEvidence("equality_loader_source_invalid", step);
      }
      return Object.freeze({
        byteCount: bytes.length,
        path: relativePath,
        sha256: sha256(bytes)
      });
    });
  return sha256(canonicalizeVnextJcsBytes(members));
}

const protectedEqualityPrivateLoaderSourceClosureSha256 =
  computeSourceClosureSha256();
const trustParserLimits = Object.freeze({
  maximumBytes: protectedEqualityPrivateLoaderProfile.limits
    .maximumTrustDescriptorBytes,
  maximumDepth: 2,
  maximumTotalEntries: 16,
  maximumObjectMembers: expectedTrustDescriptorFields.length,
  maximumArrayItems: 1,
  maximumStringCodeUnits: 512,
  maximumTotalStringCodeUnits: 1_024,
  maximumNumberCharacters: 16
});
const trustJcsLimits = Object.freeze({
  maximumDepth: 2,
  maximumTotalEntries: 16,
  maximumObjectMembers: expectedTrustDescriptorFields.length,
  maximumArrayItems: 1,
  maximumStringCodeUnits: 512,
  maximumTotalStringCodeUnits: 1_024,
  numberProfile: "vnext-safe-integer"
});

function parseTrustDescriptor(trustDescriptorBytes) {
  const step = "protected-equality-private-loader";
  if (trustDescriptorBytes.length === 0 ||
      trustDescriptorBytes.length > protectedEqualityPrivateLoaderProfile.limits
        .maximumTrustDescriptorBytes) {
    failEvidence("equality_loader_trust_byte_limit", step);
  }
  let parsed;
  try {
    parsed = parseStrictJson(trustDescriptorBytes, trustParserLimits);
  } catch (error) {
    failEvidence("equality_loader_trust_invalid", step, error?.code);
  }
  const descriptor = exactDataObject(parsed, expectedTrustDescriptorFields,
    "equality_loader_trust_invalid", step);
  let canonicalBytes;
  try {
    canonicalBytes = canonicalizeVnextJcsBytes(descriptor, trustJcsLimits);
  } catch (error) {
    failEvidence("equality_loader_trust_invalid", step, error?.code);
  }
  try {
    if (!canonicalBytes.equals(trustDescriptorBytes)) {
      failEvidence("equality_loader_trust_wire_invalid", step);
    }
  } finally {
    canonicalBytes.fill(0);
  }
  if (descriptor.schema !==
      protectedEqualityPrivateLoaderProfile.trustDescriptorSchema) {
    failEvidence("equality_loader_trust_invalid", step);
  }
  const trust = {};
  for (const field of protectedEqualityCustodyProfile.trustInputFields) {
    trust[field] = descriptor[field];
  }
  return Object.freeze(trust);
}

function isPipeStats(stats) {
  const modeType = stats.mode & fs.constants.S_IFMT;
  return modeType === fs.constants.S_IFIFO &&
    !stats.isFile() && !stats.isDirectory() && !stats.isSymbolicLink() &&
    !stats.isBlockDevice() && !stats.isCharacterDevice() && !stats.isSocket();
}

function readPrivateBundle(descriptor) {
  const step = "protected-equality-private-loader";
  const limits = protectedEqualityPrivateLoaderProfile.limits;
  const scratch = Buffer.alloc(limits.readBufferBytes);
  const chunks = [];
  let totalBytes = 0;
  let readOperations = 0;
  let result = null;
  try {
    while (true) {
      if (readOperations >= limits.maximumReadOperations) {
        failEvidence("equality_loader_read_operation_limit", step);
      }
      const remainingWithSentinel = limits.maximumPrivateBundleBytes + 1 - totalBytes;
      const requestedBytes = Math.min(scratch.length, remainingWithSentinel);
      let bytesRead;
      try {
        bytesRead = fs.readSync(descriptor, scratch, 0, requestedBytes, null);
      } catch (error) {
        throw asEvidenceError(error, "equality_loader_read_failed", step);
      }
      readOperations += 1;
      if (bytesRead === 0) break;
      totalBytes += bytesRead;
      if (totalBytes > limits.maximumPrivateBundleBytes) {
        failEvidence("equality_loader_bundle_byte_limit", step);
      }
      chunks.push(Buffer.from(scratch.subarray(0, bytesRead)));
      scratch.fill(0);
    }
    if (totalBytes === 0) {
      failEvidence("equality_loader_bundle_byte_limit", step);
    }
    result = Buffer.concat(chunks, totalBytes);
    return result;
  } finally {
    scratch.fill(0);
    for (const chunk of chunks) chunk.fill(0);
  }
}

function loadVnextProtectedEqualityCustodyFromInheritedPipe(
  rawTrustDescriptorBytes
) {
  const step = "protected-equality-private-loader";
  const descriptor = protectedEqualityPrivateLoaderProfile.privateBundleTransport
    .descriptor;
  let bundleBytes = null;
  let custody = null;
  let primaryError = null;
  let closeError = null;
  let trustDescriptorBytes = null;
  try {
    trustDescriptorBytes = normalizeBytes(rawTrustDescriptorBytes,
      "equality_loader_trust_bytes_required", step);
    let stats;
    try {
      stats = fs.fstatSync(descriptor);
    } catch (error) {
      throw asEvidenceError(error, "equality_loader_pipe_unavailable", step);
    }
    if (!isPipeStats(stats)) {
      failEvidence("equality_loader_transport_invalid", step);
    }
    const trust = parseTrustDescriptor(trustDescriptorBytes);
    bundleBytes = readPrivateBundle(descriptor);
    custody = createVnextProtectedEqualityCustody(bundleBytes, trust);
  } catch (error) {
    primaryError = asEvidenceError(error, "equality_loader_failed", step);
  } finally {
    try {
      fs.closeSync(descriptor);
    } catch (error) {
      closeError = asEvidenceError(error, "equality_loader_close_failed", step);
    }
    if (bundleBytes !== null) bundleBytes.fill(0);
    if (trustDescriptorBytes !== null) trustDescriptorBytes.fill(0);
  }
  if (primaryError !== null) throw primaryError;
  if (closeError !== null) throw closeError;
  return custody;
}

module.exports = Object.freeze({
  loadVnextProtectedEqualityCustodyFromInheritedPipe,
  protectedEqualityPrivateLoaderProfile,
  protectedEqualityPrivateLoaderProfileSha256,
  protectedEqualityPrivateLoaderSourceClosureSha256
});
