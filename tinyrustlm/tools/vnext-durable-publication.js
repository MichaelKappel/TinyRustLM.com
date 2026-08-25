"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");
const {
  createConfiguredVnextDirectoryFlushClient,
  directoryFlushClientProfile,
  directoryFlushClientProfileSha256,
  directoryFlushClientSourceClosureSha256
} = require("./vnext-directory-flush-client.js");
const {
  asEvidenceError,
  failEvidence
} = require("./vnext-evidence-error.js");
const { canonicalizeVnextJcsBytes } = require("./vnext-jcs.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(
  repositoryRoot,
  "contracts",
  "vnext",
  "durable-publication-profile.v1.json"
);
const profileBytes = fs.readFileSync(profilePath);
const durablePublicationProfile = parseStrictJson(profileBytes);
const digestPattern = /^[a-f0-9]{64}$/u;
const safeIdPattern = /^[a-z0-9][a-z0-9._:-]{2,159}$/u;
const codePrefixPattern = /^[a-z][a-z0-9_]{2,39}$/u;
const receiptFilePattern = /^([a-f0-9]{64})\.json$/u;
const prefixPattern = /^[a-f0-9]{2}$/u;
const temporaryPattern = /^\.[a-f0-9]{64}\.[0-9]{1,20}\.[a-f0-9]{24}\.tmp$/u;
const configurationFields = Object.freeze([
  "codePrefix",
  "steps",
  "storeProfileId",
  "storeProfileSha256"
]);
const stepFields = Object.freeze(["open", "path", "persist", "read", "scan"]);
const validationContextFields = Object.freeze([
  "ownedRoot",
  "storeProfileId",
  "storeProfileSha256"
]);

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

const durablePublicationProfileSha256 = sha256(profileBytes);

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function dataObjectValues(value, allowedNames, requiredNames, code, step) {
  if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length !== 0) {
    failEvidence(code, step);
  }
  const names = Object.getOwnPropertyNames(value);
  const allowed = new Set(allowedNames);
  if (names.some((name) => !allowed.has(name)) ||
      requiredNames.some((name) => !names.includes(name))) {
    failEvidence(code, step);
  }
  const result = {};
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence(`${code}_accessor`, step);
    }
    result[name] = descriptor.value;
  }
  return Object.freeze(result);
}

function dataArrayValues(value, minimumEntries, maximumEntries, code, step) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
      Object.getOwnPropertySymbols(value).length !== 0 ||
      !Number.isSafeInteger(value.length) || value.length < minimumEntries ||
      value.length > maximumEntries) {
    failEvidence(code, step);
  }
  const names = Object.getOwnPropertyNames(value);
  if (names.length !== value.length + 1 || !names.includes("length")) {
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
  return Object.freeze(result);
}

function freezeRecord(value) {
  if (Buffer.isBuffer(value) || ArrayBuffer.isView(value)) return value;
  if (Array.isArray(value)) {
    for (const entry of value) freezeRecord(entry);
    return Object.freeze(value);
  }
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value)) freezeRecord(entry);
    return Object.freeze(value);
  }
  return value;
}

function computeSourceClosureSha256() {
  const members = durablePublicationProfile.sourceClosureMembers.map((relativePath) => {
    let bytes;
    try {
      bytes = fs.readFileSync(path.join(repositoryRoot, ...relativePath.split("/")));
    } catch (error) {
      throw asEvidenceError(error, "durable_publication_source_invalid",
        "durable-publication-profile");
    }
    if (!Buffer.isBuffer(bytes) || bytes.length <= 0) {
      failEvidence("durable_publication_source_invalid", "durable-publication-profile");
    }
    return Object.freeze({
      byteCount: bytes.length,
      path: relativePath,
      sha256: sha256(bytes)
    });
  });
  return sha256(canonicalizeVnextJcsBytes(members));
}

const durablePublicationSourceClosureSha256 = computeSourceClosureSha256();

function assertFrozenProfile() {
  const profile = dataObjectValues(
    durablePublicationProfile,
    Object.getOwnPropertyNames(durablePublicationProfile),
    [
      "activation",
      "auxiliaryDirectoryFlush",
      "batch",
      "bootstrap",
      "directoryFlushClientProfileId",
      "directoryFlushClientProfileSha256",
      "directoryFlushClientSourceClosureSha256",
      "directoryFlushProfileId",
      "directoryFlushProfileSha256",
      "layout",
      "limits",
      "ownedRoot",
      "profileId",
      "receiptFields",
      "receiptSchema",
      "resultFields",
      "resultSchema",
      "schema",
      "sourceClosureMembers",
      "status",
      "trust",
      "versionPolicy"
    ],
    "durable_publication_profile_invalid",
    "durable-publication-profile"
  );
  if (profile.schema !== "tinyrustlm.vnext.durable_publication_profile.v1" ||
      profile.profileId !== "tinyrustlm.vnext.durable-publication.v1" ||
      profile.status !== "frozen" ||
      profile.versionPolicy !== "single-current-profile-no-compatibility-reader" ||
      profile.directoryFlushClientProfileId !== directoryFlushClientProfile.profileId ||
      profile.directoryFlushClientProfileSha256 !== directoryFlushClientProfileSha256 ||
      profile.directoryFlushClientSourceClosureSha256 !==
        directoryFlushClientSourceClosureSha256 ||
      profile.directoryFlushProfileId !== directoryFlushClientProfile.directoryFlushProfileId ||
      profile.directoryFlushProfileSha256 !==
        directoryFlushClientProfile.directoryFlushProfileSha256 ||
      profile.receiptSchema !== "tinyrustlm.vnext.durable_publication_receipt.v1" ||
      profile.resultSchema !== "tinyrustlm.vnext.durable_publication_result.v1" ||
      profile.bootstrap.receiptExcludesOwnPublicationEvidence !== true ||
      profile.bootstrap.recursiveReceipt !== "forbidden" ||
      !isPlainObject(profile.batch) ||
      profile.batch.minimumEntries !== 1 || profile.batch.maximumEntries !== 1_024 ||
      profile.batch.inputOrdering !==
        "target-relative-path-utf8-bytewise-ascending" ||
      profile.batch.duplicateTargetPaths !== "forbidden" ||
      profile.batch.directoryCreationFlush !==
        "bounded-helper-batches-before-dependent-file-publication" ||
      profile.batch.targetDirectoryFlush !==
        "one-helper-batch-after-all-target-links" ||
      profile.batch.receiptDirectoryFlush !==
        "one-helper-batch-after-all-receipt-links" ||
      profile.batch.partialResult !== "forbidden" ||
      profile.auxiliaryDirectoryFlush.existingDirectoryRequired !== true ||
      profile.auxiliaryDirectoryFlush.verifiedRustHelperRequired !== true ||
      profile.auxiliaryDirectoryFlush.callerSuppliedSuccess !== "forbidden" ||
      profile.ownedRoot.creationByStore !== "forbidden" ||
      profile.trust.callerSuppliedFlushSuccess !== "forbidden" ||
      profile.trust.callerSuppliedIoSuccess !== "forbidden" ||
      profile.trust.callerSuppliedReadbackSuccess !== "forbidden") {
    failEvidence("durable_publication_profile_invalid", "durable-publication-profile");
  }
  const expectedReceiptFields = [
    "directoryFlush",
    "fileDataStatus",
    "implementationSourceClosureSha256",
    "profileId",
    "profileSha256",
    "publicationPrimitive",
    "readbackByteCount",
    "readbackSha256",
    "schema",
    "storeProfileId",
    "storeProfileSha256",
    "targetByteCount",
    "targetRelativePath",
    "targetSha256"
  ];
  const expectedResultFields = [
    "durabilityReceiptByteCount",
    "durabilityReceiptDisposition",
    "durabilityReceiptDirectoryFlush",
    "durabilityReceiptRelativePath",
    "durabilityReceiptSha256",
    "durabilityReceiptStatus",
    "implementationSourceClosureSha256",
    "profileId",
    "profileSha256",
    "schema",
    "targetByteCount",
    "targetDirectoryFlush",
    "targetDisposition",
    "targetReadbackStatus",
    "targetRelativePath",
    "targetSha256"
  ];
  if (JSON.stringify(profile.receiptFields) !== JSON.stringify(expectedReceiptFields) ||
      JSON.stringify(profile.resultFields) !== JSON.stringify(expectedResultFields) ||
      !Number.isSafeInteger(profile.limits.maximumReceiptBytes) ||
      profile.limits.maximumReceiptBytes < 4096 ||
      !Number.isSafeInteger(profile.limits.streamBufferBytes) ||
      profile.limits.streamBufferBytes < 4096) {
    failEvidence("durable_publication_profile_invalid", "durable-publication-profile");
  }
}

assertFrozenProfile();

function normalizeDigest(value, code, step) {
  if (typeof value !== "string" || !digestPattern.test(value)) {
    failEvidence(code, step);
  }
  return value;
}

function normalizeSafeId(value, code, step) {
  if (typeof value !== "string" || !safeIdPattern.test(value)) {
    failEvidence(code, step);
  }
  return value;
}

function normalizeAbsoluteRoot(value, code, step) {
  if (typeof value !== "string" || value.length < 3 || value.length > 1024 ||
      value.includes("\0") || !path.isAbsolute(value) ||
      path.resolve(value) !== path.normalize(value)) {
    failEvidence(code, step);
  }
  return path.resolve(value);
}

function normalizeRelativePath(value, ownedRoot, code, step, allowDurability = false) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0") ||
      value.includes("\\") || Buffer.byteLength(value, "utf8") >
        durablePublicationProfile.ownedRoot.maximumRelativePathUtf8Bytes) {
    failEvidence(code, step);
  }
  const segments = value.split("/");
  if (segments.length === 0 || segments.length > 64 ||
      segments.some((segment) => segment.length === 0 || segment === "." ||
        segment === ".." || /[\0/:*?"<>|\\]/u.test(segment) ||
        Buffer.byteLength(segment, "utf8") >
          durablePublicationProfile.ownedRoot.maximumComponentUtf8Bytes) ||
      (!allowDurability && segments[0] === "durability")) {
    failEvidence(code, step);
  }
  const normalized = segments.join("/");
  if (normalized !== value) failEvidence(code, step);
  const absolute = path.resolve(ownedRoot, ...segments);
  const relative = path.relative(ownedRoot, absolute);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)) {
    failEvidence(code, step);
  }
  return Object.freeze({ absolute, relativePath: normalized, segments });
}

function directoryRelativePath(targetRelativePath) {
  const segments = targetRelativePath.split("/");
  return segments.length === 1 ? "." : segments.slice(0, -1).join("/");
}

function normalizeRelativeDirectory(value, ownedRoot, code, step) {
  if (value === ".") return Object.freeze({ absolute: ownedRoot, relativePath: "." });
  const normalized = normalizeRelativePath(value, ownedRoot, code, step, true);
  return Object.freeze({
    absolute: normalized.absolute,
    relativePath: normalized.relativePath
  });
}

function operationId(storeProfileSha256, stage, relativeDirectory, bindingSha256) {
  normalizeDigest(storeProfileSha256, "durable_publication_store_profile_invalid",
    "durable-publication-profile");
  normalizeDigest(bindingSha256, "durable_publication_binding_invalid",
    "durable-publication-profile");
  if (typeof stage !== "string" || !/^[a-z][a-z0-9-]{2,39}$/u.test(stage) ||
      typeof relativeDirectory !== "string" || relativeDirectory.length === 0) {
    failEvidence("durable_publication_operation_invalid", "durable-publication-profile");
  }
  const material = Buffer.from(
    `${durablePublicationProfileSha256}\0${storeProfileSha256}\0${stage}\0` +
    `${relativeDirectory}\0${bindingSha256}`,
    "utf8"
  );
  return `durability:${stage}:${sha256(material)}`;
}

function targetPublicationBinding(relativePath, targetSha256) {
  return sha256(Buffer.from(`${relativePath}\0${targetSha256}`, "utf8"));
}

function expectedRequestSha256(ownedRoot, relativeDirectory, expectedOperationId) {
  return sha256(canonicalizeVnextJcsBytes({
    operationId: expectedOperationId,
    ownedRoot,
    relativeDirectory,
    schema: directoryFlushClientProfile.requestMemberSchema
  }));
}

function validateDirectoryFlushResult(value, expected) {
  const fields = directoryFlushClientProfile.clientResultFields;
  const result = dataObjectValues(
    value,
    fields,
    fields,
    "durable_publication_receipt_invalid",
    "durable-publication-receipt"
  );
  const digestFields = [
    "clientProfileSha256",
    "clientSourceClosureSha256",
    "directoryFlushProfileSha256",
    "directoryIdentitySha256",
    "executableSha256",
    "helperManifestSha256",
    "helperSourceClosureSha256",
    "observationSha256",
    "requestSha256"
  ];
  if (digestFields.some((field) => typeof result[field] !== "string" ||
        !digestPattern.test(result[field])) ||
      result.schema !== directoryFlushClientProfile.clientResultSchema ||
      result.status !== "performed" ||
      result.clientProfileId !== directoryFlushClientProfile.profileId ||
      result.clientProfileSha256 !== directoryFlushClientProfileSha256 ||
      result.clientSourceClosureSha256 !== directoryFlushClientSourceClosureSha256 ||
      result.directoryFlushProfileId !==
        directoryFlushClientProfile.directoryFlushProfileId ||
      result.directoryFlushProfileSha256 !==
        directoryFlushClientProfile.directoryFlushProfileSha256 ||
      result.operationId !== expected.operationId ||
      result.requestSha256 !== expectedRequestSha256(
        expected.ownedRoot,
        expected.relativeDirectory,
        expected.operationId
      ) ||
      !Number.isSafeInteger(result.executableByteCount) ||
      result.executableByteCount <= 0 ||
      result.executableByteCount >
        directoryFlushClientProfile.package.executableMaximumBytes ||
      typeof result.nodeRuntimeVersion !== "string" ||
      result.nodeRuntimeVersion.length === 0 || result.nodeRuntimeVersion.length > 64 ||
      typeof result.architecture !== "string" || result.architecture.length === 0 ||
      typeof result.operatingSystem !== "string" ||
      result.operatingSystem.length === 0 ||
      typeof result.runtimeIdentifier !== "string" ||
      result.runtimeIdentifier.length === 0 ||
      typeof result.helperBuildProfile !== "string" ||
      result.helperBuildProfile.length === 0 ||
      !durablePublicationProfile.trust.acceptedHelperTrustClasses.includes(
        result.helperTrustClass
      ) ||
      !["win32-backup-semantics-flush-file-buffers", "posix-directory-fsync"]
        .includes(result.method)) {
    failEvidence("durable_publication_receipt_invalid",
      "durable-publication-receipt");
  }
  return freezeRecord({ ...result });
}

function normalizeValidationContext(input) {
  const context = dataObjectValues(
    input,
    validationContextFields,
    validationContextFields,
    "durable_publication_validation_context_invalid",
    "durable-publication-receipt"
  );
  return Object.freeze({
    ownedRoot: normalizeAbsoluteRoot(
      context.ownedRoot,
      "durable_publication_validation_context_invalid",
      "durable-publication-receipt"
    ),
    storeProfileId: normalizeSafeId(
      context.storeProfileId,
      "durable_publication_validation_context_invalid",
      "durable-publication-receipt"
    ),
    storeProfileSha256: normalizeDigest(
      context.storeProfileSha256,
      "durable_publication_validation_context_invalid",
      "durable-publication-receipt"
    )
  });
}

function validateDurablePublicationReceiptBytes(bytesInput, contextInput) {
  if (!Buffer.isBuffer(bytesInput) || bytesInput.length <= 0 ||
      bytesInput.length > durablePublicationProfile.limits.maximumReceiptBytes) {
    failEvidence("durable_publication_receipt_byte_limit",
      "durable-publication-receipt");
  }
  const bytes = Buffer.from(bytesInput);
  let parsed;
  try {
    parsed = parseStrictJson(bytes, {
      maximumBytes: durablePublicationProfile.limits.maximumReceiptBytes,
      maximumDepth: 16,
      maximumNumberCharacters: 32,
      maximumObjectMembers: 64,
      maximumStringCodeUnits: 32768,
      maximumTotalEntries: 256,
      maximumTotalStringCodeUnits: 131072
    });
  } catch (_error) {
    failEvidence("durable_publication_receipt_invalid",
      "durable-publication-receipt");
  }
  const receipt = dataObjectValues(
    parsed,
    durablePublicationProfile.receiptFields,
    durablePublicationProfile.receiptFields,
    "durable_publication_receipt_invalid",
    "durable-publication-receipt"
  );
  let canonical;
  try {
    canonical = canonicalizeVnextJcsBytes(receipt);
  } catch (_error) {
    failEvidence("durable_publication_receipt_invalid",
      "durable-publication-receipt");
  }
  if (!canonical.equals(bytes)) {
    failEvidence("durable_publication_receipt_noncanonical",
      "durable-publication-receipt");
  }
  const context = normalizeValidationContext(contextInput);
  const target = normalizeRelativePath(
    receipt.targetRelativePath,
    context.ownedRoot,
    "durable_publication_receipt_invalid",
    "durable-publication-receipt"
  );
  if (receipt.schema !== durablePublicationProfile.receiptSchema ||
      receipt.profileId !== durablePublicationProfile.profileId ||
      receipt.profileSha256 !== durablePublicationProfileSha256 ||
      receipt.implementationSourceClosureSha256 !==
        durablePublicationSourceClosureSha256 ||
      receipt.storeProfileId !== context.storeProfileId ||
      receipt.storeProfileSha256 !== context.storeProfileSha256) {
    if (receipt.storeProfileId !== context.storeProfileId ||
        receipt.storeProfileSha256 !== context.storeProfileSha256) {
      failEvidence("durable_publication_receipt_store_profile_mismatch",
        "durable-publication-receipt");
    }
    failEvidence("durable_publication_receipt_invalid",
      "durable-publication-receipt");
  }
  if (!Number.isSafeInteger(receipt.targetByteCount) ||
      receipt.targetByteCount <= 0 ||
      !Number.isSafeInteger(receipt.readbackByteCount) ||
      receipt.readbackByteCount !== receipt.targetByteCount ||
      !digestPattern.test(String(receipt.targetSha256 || "")) ||
      receipt.readbackSha256 !== receipt.targetSha256 ||
      receipt.fileDataStatus !== "temporary-file-fsync-complete" ||
      receipt.publicationPrimitive !== "hard-link-create-if-absent-byte-identical") {
    failEvidence("durable_publication_receipt_invalid",
      "durable-publication-receipt");
  }
  const targetDirectory = directoryRelativePath(target.relativePath);
  const expectedOperationId = operationId(
    context.storeProfileSha256,
    "target-publish",
    targetDirectory,
    targetPublicationBinding(target.relativePath, receipt.targetSha256)
  );
  const directoryFlush = validateDirectoryFlushResult(receipt.directoryFlush, {
    operationId: expectedOperationId,
    ownedRoot: context.ownedRoot,
    relativeDirectory: targetDirectory
  });
  return freezeRecord({
    bytes,
    receipt: { ...receipt, directoryFlush },
    receiptSha256: sha256(bytes)
  });
}

function normalizeConfiguration(input) {
  if (!isPlainObject(input) || Object.getOwnPropertySymbols(input).length !== 0) {
    failEvidence("durable_publication_configuration_invalid",
      "durable-publication-open");
  }
  const inputNames = Object.getOwnPropertyNames(input);
  const prefixDescriptor = Object.getOwnPropertyDescriptor(input, "codePrefix");
  const errorPrefix = prefixDescriptor && "value" in prefixDescriptor &&
    codePrefixPattern.test(String(prefixDescriptor.value || ""))
    ? prefixDescriptor.value
    : "durable_publication";
  if (inputNames.some((name) => !configurationFields.includes(name))) {
    failEvidence(`${errorPrefix}_configuration_unknown`, "durable-publication-open");
  }
  const configuration = dataObjectValues(
    input,
    configurationFields,
    configurationFields,
    "durable_publication_configuration_invalid",
    "durable-publication-open"
  );
  if (!codePrefixPattern.test(String(configuration.codePrefix || ""))) {
    failEvidence("durable_publication_configuration_invalid",
      "durable-publication-open");
  }
  const steps = dataObjectValues(
    configuration.steps,
    stepFields,
    stepFields,
    `${configuration.codePrefix}_configuration_invalid`,
    "durable-publication-open"
  );
  if (stepFields.some((name) => typeof steps[name] !== "string" ||
      !/^[a-z][a-z0-9-]{2,63}$/u.test(steps[name]))) {
    failEvidence(`${configuration.codePrefix}_configuration_invalid`,
      "durable-publication-open");
  }
  return Object.freeze({
    codePrefix: configuration.codePrefix,
    steps,
    storeProfileId: normalizeSafeId(
      configuration.storeProfileId,
      `${configuration.codePrefix}_configuration_invalid`,
      steps.open
    ),
    storeProfileSha256: normalizeDigest(
      configuration.storeProfileSha256,
      `${configuration.codePrefix}_configuration_invalid`,
      steps.open
    )
  });
}

function createVnextDurablePublication(rootInput, configurationInput) {
  let configuration;
  try {
    configuration = normalizeConfiguration(configurationInput);
  } catch (error) {
    if (error?.code === "durable_publication_configuration_invalid" ||
        error?.code === "durable_publication_configuration_invalid_accessor") {
      throw error;
    }
    if (isPlainObject(configurationInput)) {
      const descriptor = Object.getOwnPropertyDescriptor(configurationInput, "codePrefix");
      const prefix = descriptor && "value" in descriptor &&
        codePrefixPattern.test(String(descriptor.value || ""))
        ? descriptor.value
        : "durable_publication";
      if (error?.code === "durable_publication_configuration_invalid") {
        failEvidence(`${prefix}_configuration_invalid`, "durable-publication-open");
      }
    }
    throw error;
  }
  const { codePrefix, steps, storeProfileId, storeProfileSha256 } = configuration;
  const code = (suffix) => `${codePrefix}_${suffix}`;
  const root = normalizeAbsoluteRoot(rootInput, code("owned_root_invalid"), steps.open);

  function assertNoLinkComponents(target, requireLeafDirectory = false) {
    const resolved = path.resolve(target);
    const parsed = path.parse(resolved);
    const parts = resolved.slice(parsed.root.length).split(path.sep).filter(Boolean);
    let current = parsed.root;
    for (let index = 0; index < parts.length; index += 1) {
      current = path.join(current, parts[index]);
      if (!fs.existsSync(current)) continue;
      let stat;
      try {
        stat = fs.lstatSync(current);
      } catch (error) {
        throw asEvidenceError(error, code("path_inspection_failed"), steps.path);
      }
      if (stat.isSymbolicLink()) failEvidence(code("path_link"), steps.path);
      const leaf = index === parts.length - 1;
      if ((!leaf || requireLeafDirectory) && !stat.isDirectory()) {
        failEvidence(code("path_not_directory"), steps.path);
      }
    }
  }

  if (!fs.existsSync(root)) failEvidence(code("owned_root_missing"), steps.open);
  assertNoLinkComponents(root, true);
  const directoryFlushClient = createConfiguredVnextDirectoryFlushClient();

  function flushDirectoryBatch(specifications) {
    if (!Array.isArray(specifications)) {
      failEvidence(code("directory_flush_batch_invalid"), steps.persist);
    }
    if (specifications.length === 0) return Object.freeze([]);
    const requests = specifications.map((specification) => {
      if (!isPlainObject(specification) || typeof specification.relativeDirectory !== "string" ||
          typeof specification.stage !== "string" ||
          !/^[a-z][a-z0-9-]{2,39}$/u.test(specification.stage)) {
        failEvidence(code("directory_flush_batch_invalid"), steps.persist);
      }
      normalizeDigest(
        specification.bindingSha256,
        code("directory_flush_binding_invalid"),
        steps.persist
      );
      return Object.freeze({
        operationId: operationId(
          storeProfileSha256,
          specification.stage,
          specification.relativeDirectory,
          specification.bindingSha256
        ),
        ownedRoot: root,
        relativeDirectory: specification.relativeDirectory
      });
    });
    if (new Set(requests.map((request) => request.operationId)).size !== requests.length) {
      failEvidence(code("directory_flush_batch_invalid"), steps.persist);
    }
    const byOperationId = new Map();
    const maximumEntries = directoryFlushClientProfile.batch.maximumEntries;
    for (let offset = 0; offset < requests.length; offset += maximumEntries) {
      const results = directoryFlushClient.flushMany(
        requests.slice(offset, offset + maximumEntries)
      );
      for (const result of results) {
        if (byOperationId.has(result.operationId)) {
          failEvidence(code("directory_flush_batch_invalid"), steps.persist);
        }
        byOperationId.set(result.operationId, result);
      }
    }
    return Object.freeze(requests.map((request) => {
      const result = byOperationId.get(request.operationId);
      if (result === undefined) {
        failEvidence(code("directory_flush_batch_invalid"), steps.persist);
      }
      return result;
    }));
  }

  function flushDirectory(relativeDirectory, stage, bindingSha256) {
    return flushDirectoryBatch([{
      bindingSha256,
      relativeDirectory,
      stage
    }])[0];
  }

  function flushOwnedDirectory(relativeDirectoryInput, stage, bindingSha256) {
    const normalized = normalizeRelativeDirectory(
      relativeDirectoryInput,
      root,
      code("directory_invalid"),
      steps.path
    );
    if (typeof stage !== "string" || !/^[a-z][a-z0-9-]{2,39}$/u.test(stage)) {
      failEvidence(code("directory_flush_stage_invalid"), steps.persist);
    }
    normalizeDigest(bindingSha256, code("directory_flush_binding_invalid"), steps.persist);
    if (!fs.existsSync(normalized.absolute)) {
      failEvidence(code("directory_missing"), steps.persist);
    }
    assertNoLinkComponents(normalized.absolute, true);
    return flushDirectory(normalized.relativePath, stage, bindingSha256);
  }

  function prepareDirectorySegments(segmentsInput, flushSpecifications) {
    if (!Array.isArray(segmentsInput) || segmentsInput.length === 0 ||
        segmentsInput.length > 64 || Object.getPrototypeOf(segmentsInput) !==
          Array.prototype || Object.getOwnPropertySymbols(segmentsInput).length !== 0 ||
        Object.getOwnPropertyNames(segmentsInput).length !== segmentsInput.length + 1) {
      failEvidence(code("directory_invalid"), steps.path);
    }
    const segments = [];
    for (let index = 0; index < segmentsInput.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(segmentsInput, String(index));
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
        failEvidence(code("directory_invalid"), steps.path);
      }
      const segment = descriptor.value;
      if (typeof segment !== "string" || segment.length === 0 || segment === "." ||
          segment === ".." || /[\0/:*?"<>|\\]/u.test(segment) ||
          Buffer.byteLength(segment, "utf8") > 255) {
        failEvidence(code("directory_invalid"), steps.path);
      }
      segments.push(segment);
    }
    const current = [];
    for (const segment of segments) {
      current.push(segment);
      const directory = path.join(root, ...current);
      let created = false;
      if (!fs.existsSync(directory)) {
        assertNoLinkComponents(path.dirname(directory), true);
        try {
          fs.mkdirSync(directory, { mode: 0o700, recursive: false });
          created = true;
        } catch (error) {
          if (error?.code !== "EEXIST") {
            throw asEvidenceError(error, code("directory_create_failed"), steps.open);
          }
        }
      }
      assertNoLinkComponents(directory, true);
      if (created) {
        const relative = current.join("/");
        const parent = current.length === 1 ? "." : current.slice(0, -1).join("/");
        const binding = sha256(Buffer.from(
          `${storeProfileSha256}\0${relative}`,
          "utf8"
        ));
        flushSpecifications.push(Object.freeze({
          bindingSha256: binding,
          relativeDirectory: parent,
          stage: "layout-parent"
        }));
        flushSpecifications.push(Object.freeze({
          bindingSha256: binding,
          relativeDirectory: relative,
          stage: "layout-child"
        }));
      }
    }
  }

  function ensureDirectorySegments(segmentsInput) {
    const flushSpecifications = [];
    prepareDirectorySegments(segmentsInput, flushSpecifications);
    return freezeRecord(flushDirectoryBatch(flushSpecifications));
  }

  function boundedDirectoryEntries(directory, maximumEntries) {
    let handle;
    const entries = [];
    try {
      handle = fs.opendirSync(directory);
      while (true) {
        const entry = handle.readSync();
        if (entry === null) break;
        entries.push(entry);
        if (entries.length > maximumEntries) {
          failEvidence(code("directory_entry_limit"), steps.scan);
        }
      }
    } catch (error) {
      throw asEvidenceError(error, code("directory_scan_failed"), steps.scan);
    } finally {
      if (handle !== undefined) {
        try {
          handle.closeSync();
        } catch (_error) {
          // The bounded scan result or earlier failure remains authoritative.
        }
      }
    }
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    return entries;
  }

  function boundedReadFile(filePath, maximumBytes, missingCode = null) {
    let descriptor;
    try {
      const linkStat = fs.lstatSync(filePath);
      if (linkStat.isSymbolicLink() || !linkStat.isFile()) {
        failEvidence(code("file_not_regular"), steps.read);
      }
      const noFollow = Number(fs.constants.O_NOFOLLOW || 0);
      descriptor = fs.openSync(filePath, Number(fs.constants.O_RDONLY) | noFollow);
      const initial = fs.fstatSync(descriptor);
      if (!initial.isFile()) failEvidence(code("file_not_regular"), steps.read);
      if (initial.size <= 0 || initial.size > maximumBytes) {
        failEvidence(code("file_byte_limit"), steps.read);
      }
      if (linkStat.dev !== undefined && initial.dev !== undefined &&
          linkStat.dev !== initial.dev) {
        failEvidence(code("file_changed"), steps.read);
      }
      if (linkStat.ino && initial.ino && linkStat.ino !== initial.ino) {
        failEvidence(code("file_changed"), steps.read);
      }
      const bytes = Buffer.alloc(initial.size);
      let offset = 0;
      while (offset < bytes.length) {
        const length = Math.min(
          durablePublicationProfile.limits.streamBufferBytes,
          bytes.length - offset
        );
        const count = fs.readSync(descriptor, bytes, offset, length, offset);
        if (count <= 0) failEvidence(code("file_truncated"), steps.read);
        offset += count;
      }
      const final = fs.fstatSync(descriptor);
      if (final.size !== initial.size) failEvidence(code("file_changed"), steps.read);
      return bytes;
    } catch (error) {
      if (error?.code === "ENOENT" && missingCode !== null) {
        failEvidence(missingCode, steps.read);
      }
      throw asEvidenceError(error, code("file_read_failed"), steps.read);
    } finally {
      if (descriptor !== undefined) {
        try {
          fs.closeSync(descriptor);
        } catch (_error) {
          // The private byte copy or earlier failure remains authoritative.
        }
      }
    }
  }

  function writeSyncedTemporary(target, bytes, digest) {
    const targetStem = path.basename(target, path.extname(target));
    const temporaryIdentity = /^(?:[a-f0-9]{16}|[a-f0-9]{64})$/u.test(targetStem)
      ? targetStem
      : digest;
    const temporary = path.join(
      path.dirname(target),
      `.${temporaryIdentity}.${process.pid}.${crypto.randomBytes(12).toString("hex")}.tmp`
    );
    let descriptor;
    try {
      descriptor = fs.openSync(temporary, "wx", 0o600);
      let offset = 0;
      while (offset < bytes.length) {
        const length = Math.min(
          durablePublicationProfile.limits.streamBufferBytes,
          bytes.length - offset
        );
        const count = fs.writeSync(descriptor, bytes, offset, length, offset);
        if (!Number.isSafeInteger(count) || count <= 0 || count > length) {
          failEvidence(code("temporary_short_write"), steps.persist);
        }
        offset += count;
      }
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      descriptor = undefined;
      return temporary;
    } catch (error) {
      if (descriptor !== undefined) {
        try {
          fs.closeSync(descriptor);
        } catch (_closeError) {
          // The write failure remains authoritative.
        }
      }
      try {
        fs.unlinkSync(temporary);
      } catch (_cleanupError) {
        // A surviving temporary remains inactive and is visible to restart scanning.
      }
      throw asEvidenceError(error, code("temporary_write_failed"), steps.persist);
    }
  }

  function preparePublicationEntry(relativePathInput, bytesInput, maximumBytes,
    allowDurability) {
    if (!Buffer.isBuffer(bytesInput) || !Number.isSafeInteger(maximumBytes) ||
        maximumBytes <= 0 || bytesInput.length <= 0 || bytesInput.length > maximumBytes) {
      failEvidence(code("publish_input_invalid"), steps.persist);
    }
    const bytes = Buffer.from(bytesInput);
    const normalized = normalizeRelativePath(
      relativePathInput,
      root,
      code("target_path_invalid"),
      steps.path,
      allowDurability
    );
    return freezeRecord({
      absolute: normalized.absolute,
      bytes,
      digest: sha256(bytes),
      maximumBytes,
      relativePath: normalized.relativePath,
      segments: normalized.segments
    });
  }

  function publishPreparedFile(prepared) {
    assertNoLinkComponents(path.dirname(prepared.absolute), true);
    const temporary = writeSyncedTemporary(
      prepared.absolute,
      prepared.bytes,
      prepared.digest
    );
    let disposition = "created";
    try {
      assertNoLinkComponents(path.dirname(prepared.absolute), true);
      try {
        fs.linkSync(temporary, prepared.absolute);
      } catch (error) {
        if (error?.code !== "EEXIST") {
          throw asEvidenceError(error, code("publish_failed"), steps.persist);
        }
        const existing = boundedReadFile(prepared.absolute, prepared.maximumBytes);
        if (!existing.equals(prepared.bytes)) {
          failEvidence(code("target_conflict"), steps.persist);
        }
        disposition = "existing-byte-identical";
      }
    } finally {
      try {
        fs.unlinkSync(temporary);
      } catch (_error) {
        // A surviving temporary remains inactive and is visible to restart scanning.
      }
    }
    return freezeRecord({
      ...prepared,
      disposition
    });
  }

  const layoutFlushSpecifications = [];
  prepareDirectorySegments(["durability"], layoutFlushSpecifications);
  prepareDirectorySegments(["durability", "sha256"], layoutFlushSpecifications);
  const layoutFlushes = flushDirectoryBatch(layoutFlushSpecifications);
  const receiptShaRoot = path.join(root, "durability", "sha256");
  let receiptIndex = new Map();
  let pendingTemporaryCount = 0;
  const activationTickets = new WeakMap();

  function loadReceiptIndex() {
    const rebuilt = new Map();
    let receiptCount = 0;
    let scannedEntryCount = 0;
    let pending = 0;
    const prefixEntries = boundedDirectoryEntries(
      receiptShaRoot,
      durablePublicationProfile.limits.maximumDirectoryEntries
    );
    scannedEntryCount += prefixEntries.length;
    for (const prefixEntry of prefixEntries) {
      if (!prefixPattern.test(prefixEntry.name) || !prefixEntry.isDirectory() ||
          prefixEntry.isSymbolicLink()) {
        failEvidence(code("durability_receipt_entry_invalid"), steps.scan);
      }
      const prefixDirectory = path.join(receiptShaRoot, prefixEntry.name);
      assertNoLinkComponents(prefixDirectory, true);
      const entries = boundedDirectoryEntries(
        prefixDirectory,
        durablePublicationProfile.limits.maximumDirectoryEntries
      );
      scannedEntryCount += entries.length;
      if (!Number.isSafeInteger(scannedEntryCount) || scannedEntryCount >
          durablePublicationProfile.limits.maximumScanEntries) {
        failEvidence(code("durability_receipt_scan_limit"), steps.scan);
      }
      for (const entry of entries) {
        if (temporaryPattern.test(entry.name) && entry.isFile() &&
            !entry.isSymbolicLink()) {
          pending += 1;
          continue;
        }
        const match = receiptFilePattern.exec(entry.name);
        if (!match || !entry.isFile() || entry.isSymbolicLink() ||
            match[1].slice(0, 2) !== prefixEntry.name) {
          failEvidence(code("durability_receipt_entry_invalid"), steps.scan);
        }
        const filePath = path.join(prefixDirectory, entry.name);
        const bytes = boundedReadFile(
          filePath,
          durablePublicationProfile.limits.maximumReceiptBytes
        );
        if (sha256(bytes) !== match[1]) {
          failEvidence(code("durability_receipt_identity_mismatch"), steps.scan);
        }
        let validated;
        try {
          validated = validateDurablePublicationReceiptBytes(bytes, {
            ownedRoot: root,
            storeProfileId,
            storeProfileSha256
          });
        } catch (error) {
          throw asEvidenceError(
            error,
            code("durability_receipt_invalid"),
            steps.scan
          );
        }
        const member = freezeRecord({
          bytes: validated.bytes,
          receipt: validated.receipt,
          receiptRelativePath:
            `durability/sha256/${prefixEntry.name}/${entry.name}`,
          receiptSha256: validated.receiptSha256
        });
        const existing = rebuilt.get(validated.receipt.targetRelativePath) || [];
        existing.push(member);
        rebuilt.set(validated.receipt.targetRelativePath, existing);
        receiptCount += 1;
        if (receiptCount > durablePublicationProfile.limits.maximumActiveReceipts) {
          failEvidence(code("durability_receipt_limit"), steps.scan);
        }
      }
    }
    for (const entries of rebuilt.values()) {
      entries.sort((left, right) =>
        left.receiptSha256.localeCompare(right.receiptSha256, "en"));
      Object.freeze(entries);
    }
    receiptIndex = rebuilt;
    pendingTemporaryCount = pending;
    return freezeRecord({
      durabilityReceiptCount: receiptCount,
      pendingTemporaryCount: pending,
      scannedEntryCount,
      targetCount: rebuilt.size
    });
  }

  const initialIndex = loadReceiptIndex();

  function buildResult({
    receiptFile,
    receiptSha256,
    targetDirectoryFlush,
    targetDisposition,
    targetRelativePath,
    targetSha256,
    targetByteCount
  }) {
    return freezeRecord({
      durabilityReceiptByteCount: receiptFile.bytes.length,
      durabilityReceiptDisposition: receiptFile.disposition,
      durabilityReceiptDirectoryFlush: receiptFile.directoryFlush,
      durabilityReceiptRelativePath: receiptFile.relativePath,
      durabilityReceiptSha256: receiptSha256,
      durabilityReceiptStatus: "verified",
      implementationSourceClosureSha256: durablePublicationSourceClosureSha256,
      profileId: durablePublicationProfile.profileId,
      profileSha256: durablePublicationProfileSha256,
      schema: durablePublicationProfile.resultSchema,
      targetByteCount,
      targetDirectoryFlush,
      targetDisposition,
      targetReadbackStatus: "verified",
      targetRelativePath,
      targetSha256
    });
  }

  function normalizePublicationBatch(input) {
    const values = dataArrayValues(
      input,
      durablePublicationProfile.batch.minimumEntries,
      durablePublicationProfile.batch.maximumEntries,
      code("publish_batch_invalid"),
      steps.persist
    );
    const prepared = values.map((entry) => {
      const fields = ["bytes", "maximumBytes", "relativePath"];
      const normalized = dataObjectValues(
        entry,
        fields,
        fields,
        code("publish_batch_invalid"),
        steps.persist
      );
      return preparePublicationEntry(
        normalized.relativePath,
        normalized.bytes,
        normalized.maximumBytes,
        false
      );
    });
    prepared.sort((left, right) => Buffer.compare(
      Buffer.from(left.relativePath, "utf8"),
      Buffer.from(right.relativePath, "utf8")
    ));
    for (let index = 1; index < prepared.length; index += 1) {
      if (prepared[index - 1].relativePath === prepared[index].relativePath) {
        failEvidence(code("publish_batch_invalid"), steps.persist);
      }
    }
    return Object.freeze(prepared);
  }

  function publishMany(input) {
    const preparedTargets = normalizePublicationBatch(input);
    const targetLayoutFlushSpecifications = [];
    for (const target of preparedTargets) {
      const directorySegments = target.segments.slice(0, -1);
      if (directorySegments.length > 0) {
        prepareDirectorySegments(directorySegments, targetLayoutFlushSpecifications);
      }
    }
    flushDirectoryBatch(targetLayoutFlushSpecifications);

    const publishedTargets = preparedTargets.map(publishPreparedFile);
    const targetDirectoryFlushes = flushDirectoryBatch(publishedTargets.map((target) => ({
      bindingSha256: targetPublicationBinding(target.relativePath, target.digest),
      relativeDirectory: directoryRelativePath(target.relativePath),
      stage: "target-publish"
    })));
    const targets = publishedTargets.map((target, index) => freezeRecord({
      ...target,
      directoryFlush: targetDirectoryFlushes[index]
    }));
    for (const target of targets) {
      const readback = boundedReadFile(target.absolute, target.maximumBytes);
      if (!readback.equals(target.bytes)) {
        failEvidence(code("readback_mismatch"), steps.persist);
      }
    }

    const preparedReceipts = targets.map((target) => {
      const receiptValue = {
        directoryFlush: target.directoryFlush,
        fileDataStatus: "temporary-file-fsync-complete",
        implementationSourceClosureSha256: durablePublicationSourceClosureSha256,
        profileId: durablePublicationProfile.profileId,
        profileSha256: durablePublicationProfileSha256,
        publicationPrimitive: "hard-link-create-if-absent-byte-identical",
        readbackByteCount: target.bytes.length,
        readbackSha256: target.digest,
        schema: durablePublicationProfile.receiptSchema,
        storeProfileId,
        storeProfileSha256,
        targetByteCount: target.bytes.length,
        targetRelativePath: target.relativePath,
        targetSha256: target.digest
      };
      const receiptBytes = canonicalizeVnextJcsBytes(receiptValue);
      if (receiptBytes.length > durablePublicationProfile.limits.maximumReceiptBytes) {
        failEvidence(code("durability_receipt_byte_limit"), steps.persist);
      }
      const receiptSha256 = sha256(receiptBytes);
      const receiptRelativePath =
        `durability/sha256/${receiptSha256.slice(0, 2)}/${receiptSha256}.json`;
      return preparePublicationEntry(
        receiptRelativePath,
        receiptBytes,
        durablePublicationProfile.limits.maximumReceiptBytes,
        true
      );
    });
    const receiptLayoutFlushSpecifications = [];
    for (const receipt of preparedReceipts) {
      prepareDirectorySegments(
        receipt.segments.slice(0, -1),
        receiptLayoutFlushSpecifications
      );
    }
    flushDirectoryBatch(receiptLayoutFlushSpecifications);

    const publishedReceipts = preparedReceipts.map(publishPreparedFile);
    const receiptDirectoryFlushes = flushDirectoryBatch(publishedReceipts.map((receipt) => ({
      bindingSha256: receipt.digest,
      relativeDirectory: directoryRelativePath(receipt.relativePath),
      stage: "receipt-publish"
    })));
    const receiptFiles = publishedReceipts.map((receipt, index) => freezeRecord({
      ...receipt,
      directoryFlush: receiptDirectoryFlushes[index]
    }));

    const validatedReceipts = [];
    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index];
      const receiptFile = receiptFiles[index];
      const receiptReadback = boundedReadFile(
        receiptFile.absolute,
        durablePublicationProfile.limits.maximumReceiptBytes
      );
      if (!receiptReadback.equals(receiptFile.bytes)) {
        failEvidence(code("durability_receipt_readback_mismatch"), steps.persist);
      }
      const targetReadback = boundedReadFile(target.absolute, target.maximumBytes);
      if (!targetReadback.equals(target.bytes)) {
        failEvidence(code("target_readback_mismatch"), steps.persist);
      }
      validatedReceipts.push(validateDurablePublicationReceiptBytes(receiptFile.bytes, {
        ownedRoot: root,
        storeProfileId,
        storeProfileSha256
      }));
    }

    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index];
      const receiptFile = receiptFiles[index];
      const validated = validatedReceipts[index];
      const members = [...(receiptIndex.get(target.relativePath) || [])];
      if (!members.some((member) => member.receiptSha256 === receiptFile.digest)) {
        members.push(freezeRecord({
          bytes: validated.bytes,
          receipt: validated.receipt,
          receiptRelativePath: receiptFile.relativePath,
          receiptSha256: receiptFile.digest
        }));
        members.sort((left, right) =>
          left.receiptSha256.localeCompare(right.receiptSha256, "en"));
        receiptIndex.set(target.relativePath, Object.freeze(members));
      }
    }

    return Object.freeze(targets.map((target, index) => buildResult({
      receiptFile: receiptFiles[index],
      receiptSha256: receiptFiles[index].digest,
      targetDirectoryFlush: target.directoryFlush,
      targetDisposition: target.disposition,
      targetRelativePath: target.relativePath,
      targetSha256: target.digest,
      targetByteCount: target.bytes.length
    })));
  }

  function publishBytes(relativePathInput, bytesInput, maximumBytes) {
    return publishMany([{
      bytes: bytesInput,
      maximumBytes,
      relativePath: relativePathInput
    }])[0];
  }

  function prepareActivation(relativePathInput, maximumBytes) {
    if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) {
      failEvidence(code("activation_input_invalid"), steps.read);
    }
    const target = normalizeRelativePath(
      relativePathInput,
      root,
      code("target_path_invalid"),
      steps.path
    );
    const candidates = receiptIndex.get(target.relativePath);
    if (!candidates || candidates.length === 0) {
      failEvidence(code("durability_receipt_missing"), steps.read);
    }
    const selected = candidates[0];
    if (candidates.some((candidate) =>
      candidate.receipt.targetSha256 !== selected.receipt.targetSha256 ||
      candidate.receipt.targetByteCount !== selected.receipt.targetByteCount)) {
      failEvidence(code("durability_receipt_conflict"), steps.read);
    }
    if (selected.receipt.targetByteCount > maximumBytes) {
      failEvidence(code("target_byte_limit"), steps.read);
    }
    if (!fs.existsSync(target.absolute)) failEvidence(code("target_missing"), steps.read);
    const firstTargetReadback = boundedReadFile(target.absolute, maximumBytes);
    if (firstTargetReadback.length !== selected.receipt.targetByteCount ||
        sha256(firstTargetReadback) !== selected.receipt.targetSha256) {
      failEvidence(code("target_readback_mismatch"), steps.read);
    }
    const receiptPath = path.join(root, ...selected.receiptRelativePath.split("/"));
    const firstReceiptReadback = boundedReadFile(
      receiptPath,
      durablePublicationProfile.limits.maximumReceiptBytes
    );
    if (!firstReceiptReadback.equals(selected.bytes) ||
        sha256(firstReceiptReadback) !== selected.receiptSha256) {
      failEvidence(code("durability_receipt_readback_mismatch"), steps.read);
    }
    const ticket = {};
    Object.defineProperty(ticket, "bytes", {
      enumerable: true,
      get() {
        return Buffer.from(firstTargetReadback);
      }
    });
    activationTickets.set(ticket, Object.freeze({
      maximumBytes,
      receiptPath,
      selected,
      target
    }));
    return Object.freeze(ticket);
  }

  function activatePreparedMany(input) {
    const tickets = dataArrayValues(
      input,
      durablePublicationProfile.batch.minimumEntries,
      durablePublicationProfile.batch.maximumEntries,
      code("activation_input_invalid"),
      steps.read
    );
    const prepared = tickets.map((ticket) => {
      const entry = activationTickets.get(ticket);
      if (entry === undefined) {
        failEvidence(code("activation_input_invalid"), steps.read);
      }
      return entry;
    });
    const relativePaths = prepared.map((entry) => entry.target.relativePath);
    if (new Set(relativePaths).size !== relativePaths.length) {
      failEvidence(code("activation_input_invalid"), steps.read);
    }
    const flushes = flushDirectoryBatch(prepared.flatMap((entry) => [
      {
        bindingSha256: entry.selected.receiptSha256,
        relativeDirectory: directoryRelativePath(entry.target.relativePath),
        stage: "restart-target"
      },
      {
        bindingSha256: entry.selected.receiptSha256,
        relativeDirectory: directoryRelativePath(entry.selected.receiptRelativePath),
        stage: "restart-receipt"
      }
    ]));
    const results = [];
    for (let index = 0; index < prepared.length; index += 1) {
      const entry = prepared[index];
      const targetDirectoryFlush = flushes[index * 2];
      const receiptDirectoryFlush = flushes[(index * 2) + 1];
      const finalReceiptReadback = boundedReadFile(
        entry.receiptPath,
        durablePublicationProfile.limits.maximumReceiptBytes
      );
      if (!finalReceiptReadback.equals(entry.selected.bytes)) {
        failEvidence(code("durability_receipt_readback_mismatch"), steps.read);
      }
      const finalTargetReadback = boundedReadFile(
        entry.target.absolute,
        entry.maximumBytes
      );
      if (finalTargetReadback.length !== entry.selected.receipt.targetByteCount ||
          sha256(finalTargetReadback) !== entry.selected.receipt.targetSha256) {
        failEvidence(code("target_readback_mismatch"), steps.read);
      }
      const receiptFile = freezeRecord({
        bytes: entry.selected.bytes,
        digest: entry.selected.receiptSha256,
        directoryFlush: receiptDirectoryFlush,
        disposition: "existing-byte-identical",
        relativePath: entry.selected.receiptRelativePath
      });
      results.push(freezeRecord({
        bytes: finalTargetReadback,
        durability: buildResult({
          receiptFile,
          receiptSha256: entry.selected.receiptSha256,
          targetDirectoryFlush,
          targetDisposition: "restart-activated",
          targetRelativePath: entry.target.relativePath,
          targetSha256: entry.selected.receipt.targetSha256,
          targetByteCount: entry.selected.receipt.targetByteCount
        })
      }));
    }
    return Object.freeze(results);
  }

  function activateMany(input) {
    const values = dataArrayValues(
      input,
      durablePublicationProfile.batch.minimumEntries,
      durablePublicationProfile.batch.maximumEntries,
      code("activation_input_invalid"),
      steps.read
    );
    const tickets = values.map((entry) => {
      const fields = ["maximumBytes", "relativePath"];
      const normalized = dataObjectValues(
        entry,
        fields,
        fields,
        code("activation_input_invalid"),
        steps.read
      );
      return prepareActivation(normalized.relativePath, normalized.maximumBytes);
    });
    return activatePreparedMany(tickets);
  }

  function activateBytes(relativePathInput, maximumBytes) {
    return activateMany([{
      maximumBytes,
      relativePath: relativePathInput
    }])[0];
  }

  function rebuild() {
    return loadReceiptIndex();
  }

  return Object.freeze({
    activateMany,
    activateBytes,
    activatePreparedMany,
    ensureDirectory: ensureDirectorySegments,
    flushOwnedDirectory,
    profileId: durablePublicationProfile.profileId,
    profileSha256: durablePublicationProfileSha256,
    publishBytes,
    publishMany,
    prepareActivation,
    rebuild,
    startup: freezeRecord({
      ...initialIndex,
      layoutDirectoryFlushCount: layoutFlushes.length,
      pendingTemporaryCount
    })
  });
}

module.exports = Object.freeze({
  createVnextDurablePublication,
  durablePublicationProfile: freezeRecord(durablePublicationProfile),
  durablePublicationProfileSha256,
  durablePublicationSourceClosureSha256,
  validateDurablePublicationReceiptBytes
});
