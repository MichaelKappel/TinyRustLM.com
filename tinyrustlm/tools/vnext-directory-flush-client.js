"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");
const { canonicalizeVnextJcsBytes } = require("./vnext-jcs.js");
const {
  asEvidenceError,
  failEvidence
} = require("./vnext-evidence-error.js");

const profilePath = path.resolve(__dirname,
  "../../contracts/vnext/directory-flush-client-profile.v1.json");
const profileBytes = fs.readFileSync(profilePath);
const directoryFlushClientProfile = parseStrictJson(profileBytes);
const directoryFlushClientProfileSha256 = sha256(profileBytes);
const expectedClientSourceClosureMembers = Object.freeze([
  "contracts/vnext/directory-flush-client-profile.v1.json",
  "tinyrustlm/tools/strict-json.js",
  "tinyrustlm/tools/vnext-directory-flush-client.js",
  "tinyrustlm/tools/vnext-evidence-error.js",
  "tinyrustlm/tools/vnext-jcs.js"
]);
const packageManifestFieldNames = Object.freeze([
  "architecture", "buildProfile", "directoryFlushProfileId",
  "directoryFlushProfileSha256", "executableByteCount", "executableFile",
  "executableSha256", "operatingSystem", "runtimeIdentifier", "schema",
  "sourceClosureSha256", "trustClass"
]);
const batchObservationFieldNames = Object.freeze(["observations", "schema", "status"]);
const observationMemberFieldNames = Object.freeze([
  "architecture", "directoryIdentitySha256", "method", "operatingSystem",
  "operationId", "profileId", "profileSha256", "requestSha256", "schema",
  "status"
]);
const failureFieldNames = Object.freeze(["errorCode", "schema", "status"]);
const requestFieldNames = Object.freeze([
  "operationId", "ownedRoot", "relativeDirectory"
]);
const clientResultFieldNames = Object.freeze([
  "architecture", "clientProfileId", "clientProfileSha256",
  "clientSourceClosureSha256", "directoryFlushProfileId",
  "directoryFlushProfileSha256", "directoryIdentitySha256",
  "executableByteCount", "executableSha256",
  "helperBuildProfile", "helperManifestSha256", "helperSourceClosureSha256",
  "helperTrustClass", "method", "nodeRuntimeVersion", "observationSha256",
  "operatingSystem", "operationId", "requestSha256", "runtimeIdentifier",
  "schema", "status"
]);
const expectedDirectoryFlushProfileSha256 =
  "bb9c76715d0b35d63a9da27006ff8f88840486cf287cec24279a1020a0443ddb";
const hexSha256Pattern = /^[a-f0-9]{64}$/u;
const operationIdPattern = /^[a-z0-9][a-z0-9._:-]{2,159}$/u;
const safeErrorCodePattern = /^[a-z][a-z0-9_]{2,79}$/u;

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function dataObjectValues(value, fieldNames, code, step) {
  if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length !== 0) {
    failEvidence(code, step);
  }
  const names = Object.getOwnPropertyNames(value);
  if (names.length !== fieldNames.length ||
      names.some((name) => !fieldNames.includes(name)) ||
      fieldNames.some((name) => !names.includes(name))) {
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
  const expectedNames = [
    ...Array.from({ length: value.length }, (_entry, index) => String(index)),
    "length"
  ];
  if (names.length !== expectedNames.length ||
      names.some((name) => !expectedNames.includes(name))) {
    failEvidence(code, step);
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (!lengthDescriptor || !("value" in lengthDescriptor) ||
      lengthDescriptor.value !== value.length) {
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
  if (Array.isArray(value)) {
    for (const entry of value) freezeRecord(entry);
    return Object.freeze(value);
  }
  if (isPlainObject(value)) {
    for (const entry of Object.values(value)) freezeRecord(entry);
    return Object.freeze(value);
  }
  return value;
}

function exactStringArray(value, expected) {
  return Array.isArray(value) && value.length === expected.length &&
    value.every((entry, index) => entry === expected[index]);
}

function computeClientSourceClosureSha256() {
  const repositoryRoot = path.resolve(__dirname, "../..");
  const members = expectedClientSourceClosureMembers.map((relativePath) => {
    const memberPath = path.join(repositoryRoot, ...relativePath.split("/"));
    let stat;
    let bytes;
    try {
      stat = fs.lstatSync(memberPath);
      if (stat.isSymbolicLink() || !stat.isFile() || stat.size <= 0 ||
          stat.size > 1_048_576) {
        failEvidence("directory_flush_client_source_invalid",
          "directory-flush-client-profile");
      }
      bytes = fs.readFileSync(memberPath);
    } catch (error) {
      throw asEvidenceError(error, "directory_flush_client_source_invalid",
        "directory-flush-client-profile");
    }
    if (bytes.length !== stat.size) {
      failEvidence("directory_flush_client_source_invalid",
        "directory-flush-client-profile");
    }
    return Object.freeze({
      byteCount: bytes.length,
      path: relativePath,
      sha256: sha256(bytes)
    });
  });
  return sha256(canonicalizeVnextJcsBytes(members));
}

function assertProfile() {
  const profileFields = [
    "schema", "profileId", "status", "versionPolicy", "canonicalJsonProfile",
    "hashAlgorithm", "directoryFlushProfileId", "directoryFlushProfileSha256",
    "requestSchema", "requestMemberSchema", "observationSchema",
    "observationMemberSchema", "failureSchema", "clientResultSchema",
    "packageManifestSchema", "clientSourceClosureMembers", "package",
    "packageManifestFields", "batch", "process", "result", "clientResultFields",
    "nonClaims"
  ];
  dataObjectValues(directoryFlushClientProfile, profileFields,
    "directory_flush_client_profile_invalid", "directory-flush-client-profile");
  if (directoryFlushClientProfile.schema !==
        "tinyrustlm.vnext.directory_flush_client_profile.v1" ||
      directoryFlushClientProfile.profileId !==
        "tinyrustlm.vnext.directory-flush-client.v1" ||
      directoryFlushClientProfile.status !== "frozen" ||
      directoryFlushClientProfile.versionPolicy !==
        "single-current-profile-no-compatibility-reader" ||
      directoryFlushClientProfile.canonicalJsonProfile !==
        "rfc8785-jcs+tinyrustlm.strict-json.v1" ||
      directoryFlushClientProfile.hashAlgorithm !== "sha256" ||
      directoryFlushClientProfile.directoryFlushProfileId !==
        "tinyrustlm.vnext.directory-flush.v1" ||
      directoryFlushClientProfile.directoryFlushProfileSha256 !==
        expectedDirectoryFlushProfileSha256 ||
      directoryFlushClientProfile.requestSchema !==
        "tinyrustlm.vnext.directory_flush_batch_request.v1" ||
      directoryFlushClientProfile.requestMemberSchema !==
        "tinyrustlm.vnext.directory_flush_request_member.v1" ||
      directoryFlushClientProfile.observationSchema !==
        "tinyrustlm.vnext.directory_flush_batch_observation.v1" ||
      directoryFlushClientProfile.observationMemberSchema !==
        "tinyrustlm.vnext.directory_flush_observation_member.v1" ||
      directoryFlushClientProfile.failureSchema !==
        "tinyrustlm.vnext.directory_flush_failure.v1" ||
      directoryFlushClientProfile.clientResultSchema !==
        "tinyrustlm.vnext.directory_flush_client_result.v1" ||
      directoryFlushClientProfile.packageManifestSchema !==
        "tinyrustlm.vnext.directory_flush_helper_manifest.v1") {
    failEvidence("directory_flush_client_profile_invalid",
      "directory-flush-client-profile");
  }
  const packageProfile = dataObjectValues(directoryFlushClientProfile.package, [
    "configuration", "environmentVariable", "manifestFile", "manifestMaximumBytes",
    "executableMaximumBytes", "pathLinkPolicy", "stablePathTopologyOwnershipRequired",
    "manifestCanonicalJcsRequired", "manifestHashBeforeInvocation",
    "manifestHashAfterInvocation", "executableHashBeforeInvocation",
    "executableHashAfterInvocation", "acceptedTrustClasses", "releaseClaimTrustClass"
  ], "directory_flush_client_profile_invalid", "directory-flush-client-profile");
  const processProfile = dataObjectValues(directoryFlushClientProfile.process, [
    "shell", "windowsHide", "networkBehaviorContract", "osNetworkIsolation",
    "parentEnvironment", "workingDirectory", "stdio", "arguments", "stdin",
    "stdout", "stderr", "successExitStatus", "failureExitStatus",
    "timeoutKillSignal", "timeoutMilliseconds", "maximumRequestBytes",
    "maximumStdoutBytes", "maximumStderrBytes"
  ], "directory_flush_client_profile_invalid", "directory-flush-client-profile");
  const batchProfile = dataObjectValues(directoryFlushClientProfile.batch, [
    "minimumEntries", "maximumEntries", "canonicalMaximumTotalStringCodeUnits",
    "ordering", "duplicateOperationIds", "processInvocations", "memberResult",
    "partialHelperSuccess"
  ], "directory_flush_client_profile_invalid", "directory-flush-client-profile");
  const resultProfile = dataObjectValues(directoryFlushClientProfile.result, [
    "rawPathOutput", "rawProcessOutput", "rawHostErrorOutput",
    "requestSha256Required", "observationSha256Required",
    "executableIdentityRequired", "manifestIdentityRequired", "clientProfileIdentityRequired",
    "clientSourceClosureIdentityRequired", "nodeRuntimeVersionRequired",
    "exactOperationIdRequired", "exactPlatformRequired", "exactProfileRequired",
    "helperFailure", "status"
  ], "directory_flush_client_profile_invalid", "directory-flush-client-profile");
  if (packageProfile.configuration !==
        "explicit-absolute-root-from-one-environment-variable" ||
      packageProfile.environmentVariable !==
        "TINYRUSTLM_DIRECTORY_FLUSH_PACKAGE_ROOT" ||
      packageProfile.manifestFile !== "directory-flush-helper-manifest.v1.json" ||
      packageProfile.manifestMaximumBytes !== 16_384 ||
      packageProfile.executableMaximumBytes !== 67_108_864 ||
      packageProfile.stablePathTopologyOwnershipRequired !== true ||
      packageProfile.manifestCanonicalJcsRequired !== true ||
      packageProfile.manifestHashBeforeInvocation !== true ||
      packageProfile.manifestHashAfterInvocation !== true ||
      packageProfile.executableHashBeforeInvocation !== true ||
      packageProfile.executableHashAfterInvocation !== true ||
      packageProfile.pathLinkPolicy !==
        "reject-symbolic-link-or-reparse-point-where-host-api-exposes-it" ||
      !exactStringArray(packageProfile.acceptedTrustClasses,
        ["local-test-build", "release-package"]) ||
      packageProfile.releaseClaimTrustClass !==
        "release-package-with-separate-current-release-provenance" ||
      processProfile.shell !== false || processProfile.windowsHide !== true ||
      processProfile.networkBehaviorContract !==
        "helper-must-not-open-network-connections" ||
      processProfile.osNetworkIsolation !== "not-provided-by-node-client" ||
      processProfile.parentEnvironment !== "empty-no-inherited-variables" ||
      processProfile.workingDirectory !== "verified-package-root" ||
      processProfile.stdio !== "private-bounded-pipes" ||
      !exactStringArray(processProfile.arguments, []) ||
      processProfile.stdin !== "one-canonical-sorted-batch-request-json-document" ||
      processProfile.stdout !==
        "one-canonical-batch-success-or-public-safe-failure-json-document" ||
      processProfile.stderr !== "must-be-empty" ||
      processProfile.successExitStatus !== 0 ||
      processProfile.failureExitStatus !== 2 ||
      processProfile.timeoutKillSignal !== "SIGKILL" ||
      processProfile.timeoutMilliseconds !== 10_000 ||
      processProfile.maximumRequestBytes !== 4_194_304 ||
      processProfile.maximumStdoutBytes !== 4_194_304 ||
      processProfile.maximumStderrBytes !== 4_096 ||
      batchProfile.minimumEntries !== 1 || batchProfile.maximumEntries !== 1_024 ||
      batchProfile.canonicalMaximumTotalStringCodeUnits !== 4_194_304 ||
      batchProfile.ordering !== "operation-id-bytewise-ascending" ||
      batchProfile.duplicateOperationIds !== "forbidden" ||
      batchProfile.processInvocations !== "exactly-one-per-flush-many-call" ||
      batchProfile.memberResult !== "one-current-client-result-per-operation" ||
      batchProfile.partialHelperSuccess !== "entire-client-call-fails-closed" ||
      !exactStringArray(directoryFlushClientProfile.packageManifestFields,
        packageManifestFieldNames) ||
      !exactStringArray(directoryFlushClientProfile.clientSourceClosureMembers,
        expectedClientSourceClosureMembers) ||
      resultProfile.rawPathOutput !== "forbidden" ||
      resultProfile.rawProcessOutput !== "forbidden" ||
      resultProfile.rawHostErrorOutput !== "forbidden" ||
      resultProfile.requestSha256Required !== true ||
      resultProfile.observationSha256Required !== true ||
      resultProfile.executableIdentityRequired !== true ||
      resultProfile.manifestIdentityRequired !== true ||
      resultProfile.clientProfileIdentityRequired !== true ||
      resultProfile.clientSourceClosureIdentityRequired !== true ||
      resultProfile.nodeRuntimeVersionRequired !== true ||
      resultProfile.exactOperationIdRequired !== true ||
      resultProfile.exactPlatformRequired !== true ||
      resultProfile.exactProfileRequired !== true ||
      resultProfile.helperFailure !==
        "strict-canonical-public-safe-cause-code-only" ||
      resultProfile.status !== "performed-only" ||
      !exactStringArray(directoryFlushClientProfile.clientResultFields,
        clientResultFieldNames) ||
      !Array.isArray(directoryFlushClientProfile.nonClaims) ||
      directoryFlushClientProfile.nonClaims.length !== 9 ||
      directoryFlushClientProfile.nonClaims.some((claim) =>
        typeof claim !== "string" || claim.length < 20 || claim.length > 240)) {
    failEvidence("directory_flush_client_profile_invalid",
      "directory-flush-client-profile");
  }
}

assertProfile();
const directoryFlushClientSourceClosureSha256 = computeClientSourceClosureSha256();

function normalizeAbsoluteRoot(rootInput) {
  if (typeof rootInput !== "string" || rootInput.length < 3 || rootInput.length > 4096 ||
      rootInput.includes("\0")) {
    failEvidence("directory_flush_package_root_invalid", "directory-flush-package");
  }
  const resolved = path.resolve(rootInput);
  if (!path.isAbsolute(rootInput) || resolved !== path.normalize(rootInput)) {
    failEvidence("directory_flush_package_root_not_absolute", "directory-flush-package");
  }
  if (process.platform === "win32" &&
      !/^[A-Za-z]:\\$/u.test(path.parse(resolved).root)) {
    failEvidence("directory_flush_package_root_not_local", "directory-flush-package");
  }
  return resolved;
}

function assertNoLinkComponents(target, requireLeafDirectory) {
  const resolved = path.resolve(target);
  const parsed = path.parse(resolved);
  const parts = resolved.slice(parsed.root.length).split(path.sep).filter(Boolean);
  let current = parsed.root;
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      throw asEvidenceError(error, "directory_flush_package_path_invalid",
        "directory-flush-package");
    }
    if (stat.isSymbolicLink()) {
      failEvidence("directory_flush_package_path_link", "directory-flush-package");
    }
    const leaf = index === parts.length - 1;
    if ((!leaf || requireLeafDirectory) && !stat.isDirectory()) {
      failEvidence("directory_flush_package_path_invalid", "directory-flush-package");
    }
  }
}

function readBoundedRegularFile(filePath, maximumBytes, code) {
  let descriptor;
  try {
    const linkStat = fs.lstatSync(filePath);
    if (linkStat.isSymbolicLink() || !linkStat.isFile() || linkStat.size <= 0 ||
        linkStat.size > maximumBytes) {
      failEvidence(code, "directory-flush-package");
    }
    const noFollow = Number(fs.constants.O_NOFOLLOW || 0);
    descriptor = fs.openSync(filePath, Number(fs.constants.O_RDONLY) | noFollow);
    const initial = fs.fstatSync(descriptor);
    if (!initial.isFile() || initial.size !== linkStat.size) {
      failEvidence(code, "directory-flush-package");
    }
    if (linkStat.dev !== undefined && initial.dev !== undefined &&
        linkStat.dev !== initial.dev) {
      failEvidence(code, "directory-flush-package");
    }
    if (linkStat.ino && initial.ino && linkStat.ino !== initial.ino) {
      failEvidence(code, "directory-flush-package");
    }
    const bytes = Buffer.alloc(initial.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(descriptor, bytes, offset,
        Math.min(65_536, bytes.length - offset), offset);
      if (count <= 0) failEvidence(code, "directory-flush-package");
      offset += count;
    }
    const final = fs.fstatSync(descriptor);
    if (final.size !== initial.size) failEvidence(code, "directory-flush-package");
    return bytes;
  } catch (error) {
    throw asEvidenceError(error, code, "directory-flush-package");
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch (_error) {
        // A complete private byte copy or bounded failure is already authoritative.
      }
    }
  }
}

function expectedPlatform() {
  const operatingSystem = process.platform === "win32" ? "windows" :
    process.platform === "darwin" ? "macos" : process.platform;
  const architecture = process.arch === "x64" ? "x86_64" :
    process.arch === "arm64" ? "aarch64" : process.arch;
  const osName = process.platform === "win32" ? "win" :
    process.platform === "darwin" ? "osx" : process.platform;
  return Object.freeze({
    architecture,
    operatingSystem,
    runtimeIdentifier: `${osName}-${process.arch}`
  });
}

function validateManifest(bytes, packageRoot) {
  let parsed;
  try {
    parsed = parseStrictJson(bytes);
  } catch (error) {
    throw asEvidenceError(error, "directory_flush_manifest_invalid",
      "directory-flush-package");
  }
  const manifest = dataObjectValues(parsed, packageManifestFieldNames,
    "directory_flush_manifest_invalid", "directory-flush-package");
  if (!canonicalizeVnextJcsBytes(manifest).equals(bytes)) {
    failEvidence("directory_flush_manifest_noncanonical", "directory-flush-package");
  }
  const platform = expectedPlatform();
  const expectedExecutable = process.platform === "win32"
    ? "tinyrustlm-directory-flush.exe"
    : "tinyrustlm-directory-flush";
  if (manifest.schema !== directoryFlushClientProfile.packageManifestSchema ||
      manifest.directoryFlushProfileId !==
        directoryFlushClientProfile.directoryFlushProfileId ||
      manifest.directoryFlushProfileSha256 !==
        directoryFlushClientProfile.directoryFlushProfileSha256 ||
      manifest.executableFile !== expectedExecutable ||
      !Number.isSafeInteger(manifest.executableByteCount) ||
      manifest.executableByteCount <= 0 ||
      manifest.executableByteCount >
        directoryFlushClientProfile.package.executableMaximumBytes ||
      !hexSha256Pattern.test(manifest.executableSha256) ||
      !hexSha256Pattern.test(manifest.sourceClosureSha256) ||
      !directoryFlushClientProfile.package.acceptedTrustClasses.includes(
        manifest.trustClass) ||
      !["debug", "release"].includes(manifest.buildProfile) ||
      (manifest.trustClass === "release-package" &&
        manifest.buildProfile !== "release") ||
      manifest.architecture !== platform.architecture ||
      manifest.operatingSystem !== platform.operatingSystem ||
      manifest.runtimeIdentifier !== platform.runtimeIdentifier) {
    failEvidence("directory_flush_manifest_invalid", "directory-flush-package");
  }
  const executablePath = path.resolve(packageRoot, manifest.executableFile);
  if (path.dirname(executablePath) !== packageRoot) {
    failEvidence("directory_flush_manifest_invalid", "directory-flush-package");
  }
  return Object.freeze({ executablePath, manifest: freezeRecord({ ...manifest }) });
}

function loadPackage(packageRoot) {
  assertNoLinkComponents(packageRoot, true);
  const manifestPath = path.join(packageRoot,
    directoryFlushClientProfile.package.manifestFile);
  assertNoLinkComponents(manifestPath, false);
  const manifestBytes = readBoundedRegularFile(
    manifestPath,
    directoryFlushClientProfile.package.manifestMaximumBytes,
    "directory_flush_manifest_read_failed"
  );
  const validated = validateManifest(manifestBytes, packageRoot);
  assertNoLinkComponents(validated.executablePath, false);
  return Object.freeze({
    executablePath: validated.executablePath,
    manifest: validated.manifest,
    manifestBytes,
    manifestSha256: sha256(manifestBytes)
  });
}

function verifyExecutable(packageState, mismatchCode) {
  const bytes = readBoundedRegularFile(
    packageState.executablePath,
    directoryFlushClientProfile.package.executableMaximumBytes,
    "directory_flush_executable_read_failed"
  );
  const actualSha256 = sha256(bytes);
  if (bytes.length !== packageState.manifest.executableByteCount ||
      actualSha256 !== packageState.manifest.executableSha256) {
    failEvidence(mismatchCode, "directory-flush-package");
  }
  return Object.freeze({ byteCount: bytes.length, sha256: actualSha256 });
}

function requestMember(input) {
  const values = dataObjectValues(input, requestFieldNames,
    "directory_flush_request_invalid", "directory-flush-request");
  if (typeof values.operationId !== "string" ||
      !operationIdPattern.test(values.operationId) ||
      typeof values.ownedRoot !== "string" || values.ownedRoot.length < 3 ||
      values.ownedRoot.length > 16_384 || values.ownedRoot.includes("\0") ||
      typeof values.relativeDirectory !== "string" ||
      values.relativeDirectory.length === 0 ||
      values.relativeDirectory.length > 16_384 ||
      values.relativeDirectory.includes("\0")) {
    failEvidence("directory_flush_request_invalid", "directory-flush-request");
  }
  const member = freezeRecord({
    operationId: values.operationId,
    ownedRoot: values.ownedRoot,
    relativeDirectory: values.relativeDirectory,
    schema: directoryFlushClientProfile.requestMemberSchema
  });
  const bytes = canonicalizeVnextJcsBytes(member);
  return freezeRecord({
    bytes,
    member,
    requestSha256: sha256(bytes),
    values
  });
}

function requestBatchBytes(input) {
  const values = dataArrayValues(input,
    directoryFlushClientProfile.batch.minimumEntries,
    directoryFlushClientProfile.batch.maximumEntries,
    "directory_flush_batch_invalid", "directory-flush-request");
  const members = values.map(requestMember);
  members.sort((left, right) => Buffer.compare(
    Buffer.from(left.values.operationId, "utf8"),
    Buffer.from(right.values.operationId, "utf8")
  ));
  for (let index = 1; index < members.length; index += 1) {
    if (members[index - 1].values.operationId === members[index].values.operationId) {
      failEvidence("directory_flush_batch_invalid", "directory-flush-request");
    }
  }
  let minimumWireBytes = 32;
  for (const entry of members) {
    minimumWireBytes += 64 + Buffer.byteLength(entry.values.operationId, "utf8") +
      Buffer.byteLength(entry.values.ownedRoot, "utf8") +
      Buffer.byteLength(entry.values.relativeDirectory, "utf8") +
      Buffer.byteLength(directoryFlushClientProfile.requestMemberSchema, "utf8");
    if (minimumWireBytes > directoryFlushClientProfile.process.maximumRequestBytes) {
      failEvidence("directory_flush_request_byte_limit", "directory-flush-request");
    }
  }
  const bytes = canonicalizeVnextJcsBytes({
    requests: members.map((entry) => entry.member),
    schema: directoryFlushClientProfile.requestSchema
  }, {
    maximumArrayItems: directoryFlushClientProfile.batch.maximumEntries,
    maximumTotalStringCodeUnits:
      directoryFlushClientProfile.batch.canonicalMaximumTotalStringCodeUnits
  });
  if (bytes.length > directoryFlushClientProfile.process.maximumRequestBytes) {
    failEvidence("directory_flush_request_byte_limit", "directory-flush-request");
  }
  return Object.freeze({ bytes, members: Object.freeze(members) });
}

function validateObservationBatch(bytes, expectedMembers, packageState) {
  let parsed;
  try {
    parsed = parseStrictJson(bytes);
  } catch (error) {
    throw asEvidenceError(error, "directory_flush_observation_invalid",
      "directory-flush-observation");
  }
  const batch = dataObjectValues(parsed, batchObservationFieldNames,
    "directory_flush_observation_invalid", "directory-flush-observation");
  if (!canonicalizeVnextJcsBytes(batch, {
    maximumArrayItems: directoryFlushClientProfile.batch.maximumEntries,
    maximumTotalStringCodeUnits:
      directoryFlushClientProfile.batch.canonicalMaximumTotalStringCodeUnits
  }).equals(bytes) ||
      batch.schema !== directoryFlushClientProfile.observationSchema ||
      batch.status !== "performed") {
    failEvidence("directory_flush_observation_invalid", "directory-flush-observation");
  }
  const rawObservations = dataArrayValues(batch.observations,
    expectedMembers.length, expectedMembers.length,
    "directory_flush_observation_invalid", "directory-flush-observation");
  const observations = rawObservations.map((rawObservation, index) => {
    const observation = dataObjectValues(rawObservation, observationMemberFieldNames,
      "directory_flush_observation_invalid", "directory-flush-observation");
    const expected = expectedMembers[index];
    if (observation.schema !== directoryFlushClientProfile.observationMemberSchema ||
        observation.status !== "performed" ||
        observation.operationId !== expected.values.operationId ||
        observation.requestSha256 !== expected.requestSha256 ||
        observation.profileId !== directoryFlushClientProfile.directoryFlushProfileId ||
        observation.profileSha256 !==
          directoryFlushClientProfile.directoryFlushProfileSha256 ||
        observation.architecture !== packageState.manifest.architecture ||
        observation.operatingSystem !== packageState.manifest.operatingSystem ||
        !hexSha256Pattern.test(observation.directoryIdentitySha256) ||
        !["win32-backup-semantics-flush-file-buffers", "posix-directory-fsync"]
          .includes(observation.method) ||
        (process.platform === "win32" && observation.method !==
          "win32-backup-semantics-flush-file-buffers") ||
        (process.platform !== "win32" && observation.method !==
          "posix-directory-fsync")) {
      failEvidence("directory_flush_observation_invalid", "directory-flush-observation");
    }
    return freezeRecord(observation);
  });
  return Object.freeze(observations);
}

function validateFailure(bytes) {
  let parsed;
  try {
    parsed = parseStrictJson(bytes);
  } catch (error) {
    throw asEvidenceError(error, "directory_flush_failure_invalid",
      "directory-flush-process");
  }
  const failure = dataObjectValues(parsed, failureFieldNames,
    "directory_flush_failure_invalid", "directory-flush-process");
  if (!canonicalizeVnextJcsBytes(failure).equals(bytes) ||
      failure.schema !== directoryFlushClientProfile.failureSchema ||
      failure.status !== "failed" ||
      typeof failure.errorCode !== "string" ||
      !safeErrorCodePattern.test(failure.errorCode)) {
    failEvidence("directory_flush_failure_invalid", "directory-flush-process");
  }
  return failure;
}

function createVnextDirectoryFlushClient(packageRootInput) {
  const packageRoot = normalizeAbsoluteRoot(packageRootInput);
  const initialPackage = loadPackage(packageRoot);

  function flushMany(inputs) {
    const request = requestBatchBytes(inputs);
    const currentPackage = loadPackage(packageRoot);
    if (!currentPackage.manifestBytes.equals(initialPackage.manifestBytes) ||
        currentPackage.manifestSha256 !== initialPackage.manifestSha256 ||
        currentPackage.executablePath !== initialPackage.executablePath) {
      failEvidence("directory_flush_package_changed", "directory-flush-package");
    }
    const before = verifyExecutable(currentPackage,
      "directory_flush_executable_identity_mismatch");
    const child = childProcess.spawnSync(currentPackage.executablePath, [], {
      cwd: packageRoot,
      encoding: null,
      env: {},
      input: request.bytes,
      killSignal: directoryFlushClientProfile.process.timeoutKillSignal,
      maxBuffer: directoryFlushClientProfile.process.maximumStdoutBytes,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: directoryFlushClientProfile.process.timeoutMilliseconds,
      windowsHide: true
    });
    if (child.error !== undefined) {
      const errorCode = child.error?.code === "ETIMEDOUT"
        ? "directory_flush_process_timeout"
        : child.error?.code === "ENOBUFS"
          ? "directory_flush_process_output_invalid"
          : "directory_flush_process_spawn_failed";
      failEvidence(errorCode, "directory-flush-process");
    }
    if (!Buffer.isBuffer(child.stdout) || !Buffer.isBuffer(child.stderr) ||
        child.stdout.length === 0 ||
        child.stdout.length > directoryFlushClientProfile.process.maximumStdoutBytes ||
        child.stderr.length > directoryFlushClientProfile.process.maximumStderrBytes) {
      failEvidence("directory_flush_process_output_invalid", "directory-flush-process");
    }
    if (child.stderr.length !== 0) {
      failEvidence("directory_flush_process_stderr", "directory-flush-process");
    }
    if (child.signal !== null) {
      failEvidence("directory_flush_process_failed", "directory-flush-process");
    }
    if (child.status === directoryFlushClientProfile.process.failureExitStatus) {
      const failure = validateFailure(child.stdout);
      failEvidence("directory_flush_helper_failed", "directory-flush-process",
        failure.errorCode);
    }
    if (child.status !== directoryFlushClientProfile.process.successExitStatus) {
      failEvidence("directory_flush_process_failed", "directory-flush-process");
    }
    const observations = validateObservationBatch(
      child.stdout,
      request.members,
      currentPackage
    );
    const finalPackage = loadPackage(packageRoot);
    if (!finalPackage.manifestBytes.equals(currentPackage.manifestBytes) ||
        finalPackage.manifestSha256 !== currentPackage.manifestSha256 ||
        finalPackage.executablePath !== currentPackage.executablePath) {
      failEvidence("directory_flush_package_changed_during_execution",
        "directory-flush-package");
    }
    const after = verifyExecutable(finalPackage, "directory_flush_executable_changed");
    if (before.byteCount !== after.byteCount || before.sha256 !== after.sha256) {
      failEvidence("directory_flush_executable_changed", "directory-flush-process");
    }
    const results = observations.map((observation) => freezeRecord({
      architecture: observation.architecture,
      clientProfileId: directoryFlushClientProfile.profileId,
      clientProfileSha256: directoryFlushClientProfileSha256,
      clientSourceClosureSha256: directoryFlushClientSourceClosureSha256,
      directoryFlushProfileId: observation.profileId,
      directoryFlushProfileSha256: observation.profileSha256,
      directoryIdentitySha256: observation.directoryIdentitySha256,
      executableByteCount: after.byteCount,
      executableSha256: after.sha256,
      helperBuildProfile: currentPackage.manifest.buildProfile,
      helperManifestSha256: currentPackage.manifestSha256,
      helperSourceClosureSha256: currentPackage.manifest.sourceClosureSha256,
      helperTrustClass: currentPackage.manifest.trustClass,
      method: observation.method,
      nodeRuntimeVersion: process.version,
      observationSha256: sha256(canonicalizeVnextJcsBytes(observation)),
      operatingSystem: observation.operatingSystem,
      operationId: observation.operationId,
      requestSha256: observation.requestSha256,
      runtimeIdentifier: currentPackage.manifest.runtimeIdentifier,
      schema: directoryFlushClientProfile.clientResultSchema,
      status: "performed"
    }));
    return Object.freeze(results);
  }

  function flush(input) {
    return flushMany([input])[0];
  }

  return Object.freeze({ flush, flushMany });
}

function createConfiguredVnextDirectoryFlushClient() {
  const variable = directoryFlushClientProfile.package.environmentVariable;
  const descriptor = Object.getOwnPropertyDescriptor(process.env, variable);
  if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "string" ||
      descriptor.value.length === 0) {
    failEvidence("directory_flush_package_not_configured", "directory-flush-package");
  }
  return createVnextDirectoryFlushClient(descriptor.value);
}

module.exports = Object.freeze({
  createConfiguredVnextDirectoryFlushClient,
  createVnextDirectoryFlushClient,
  directoryFlushClientProfile: freezeRecord(directoryFlushClientProfile),
  directoryFlushClientProfileSha256,
  directoryFlushClientSourceClosureSha256
});
