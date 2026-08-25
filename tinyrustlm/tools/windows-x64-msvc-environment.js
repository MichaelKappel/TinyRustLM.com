"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const profileId = "tinyrustlm.windows-x64-msvc-environment/1";
const profileByteLength = 6510;
const profileSha256 =
  "76de6c5985c000dadedefa457286111af80ebd2deb6e6e3d8de246f6a0eed607";
const requestSchema = "tinyrustlm.windows_x64_msvc_environment_request.v1";
const publicBasisSchema =
  "tinyrustlm.windows_x64_msvc_environment_public_basis.v1";
const publicLockSchema = "tinyrustlm.windows_x64_msvc_environment_public_lock.v1";
const privateBindingSchema =
  "tinyrustlm.windows_x64_msvc_environment_private_binding.v1";
const terminalSchema = "tinyrustlm.windows_x64_msvc_environment_terminal.v1";
const summarySchema = "tinyrustlm.windows_x64_msvc_environment_summary.v1";
const targetTriple = "x86_64-pc-windows-msvc";
const requiredComponent = "Microsoft.VisualStudio.Component.VC.Tools.x86.x64";
const maximumRequestBytes = 262144;
const maximumVswhereOutputBytes = 4194304;
const maximumPublicLockBytes = 16777216;
const maximumPrivateBindingBytes = 4194304;
const maximumTerminalBytes = 1048576;
const maximumInstances = 64;
const maximumInventoryMembers = 4096;
const maximumInventoryAggregateBytes = 4294967296;
const maximumSingleMemberBytes = 1073741824;
const maximumPathBytes = 4096;
const maximumEnvironmentEntries = 64;
const maximumEnvironmentValueBytes = 32768;
const hashBufferBytes = 1048576;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const safeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,159}$/u;
const productLinePattern = /^[0-9]{2,4}$/u;
const versionPattern = /^[0-9]+(?:\.[0-9]+){2,3}$/u;
const utcPattern = /^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$/u;
const environmentNamePattern = /^[A-Za-z_][A-Za-z0-9_]{0,95}$/u;
const safeErrorCodePattern = /^msvc-environment-[a-z0-9-]{1,96}$/u;
const outputNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const localDriveRootPattern = /^[A-Z]:\\$/u;
const vswhereArguments = Object.freeze([
  "-all",
  "-products",
  "*",
  "-requires",
  requiredComponent,
  "-format",
  "json",
  "-utf8"
]);
const msvcRequiredTools = Object.freeze([
  "cl.exe",
  "dumpbin.exe",
  "lib.exe",
  "link.exe",
  "ml64.exe"
]);
const sdkRequiredTools = Object.freeze(["mt.exe", "rc.exe"]);
const msvcRequiredLibraries = Object.freeze([
  "libcmt.lib",
  "libvcruntime.lib",
  "oldnames.lib",
  "vcruntime.lib"
]);
const ucrtRequiredLibraries = Object.freeze(["libucrt.lib", "ucrt.lib"]);
const umRequiredLibraries = Object.freeze([
  "advapi32.lib",
  "bcrypt.lib",
  "kernel32.lib",
  "ntdll.lib",
  "userenv.lib",
  "ws2_32.lib"
]);
const uniqueResolution = Object.freeze([
  Object.freeze({ name: "cl.exe", role: "msvc-hostx64-x64-bin" }),
  Object.freeze({ name: "lib.exe", role: "msvc-hostx64-x64-bin" }),
  Object.freeze({ name: "link.exe", role: "msvc-hostx64-x64-bin" }),
  Object.freeze({ name: "ml64.exe", role: "msvc-hostx64-x64-bin" }),
  Object.freeze({ name: "mt.exe", role: "windows-sdk-x64-bin" }),
  Object.freeze({ name: "rc.exe", role: "windows-sdk-x64-bin" })
]);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function safeErrorCode(error) {
  return typeof error?.code === "string" && safeErrorCodePattern.test(error.code)
    ? error.code
    : "msvc-environment-unexpected";
}

function invariant(condition, code) {
  if (!condition) fail(code);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

function requireExactKeys(value, expected, code) {
  invariant(isPlainObject(value), code);
  invariant(JSON.stringify(Object.keys(value)) === JSON.stringify(expected), code);
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function requireSafeInteger(value, minimum, maximum, code) {
  invariant(Number.isSafeInteger(value) && value >= minimum && value <= maximum, code);
  return value;
}

function requireSha256(value, code) {
  invariant(typeof value === "string" && sha256Pattern.test(value), code);
  return value;
}

function requireCanonicalAbsolutePath(value, code) {
  invariant(typeof value === "string" && value.length > 0 &&
    Buffer.byteLength(value, "utf8") <= maximumPathBytes && !value.includes("\u0000") &&
    path.isAbsolute(value), code);
  const resolved = path.resolve(value);
  invariant(resolved === value && localDriveRootPattern.test(path.parse(resolved).root), code);
  return resolved;
}

function canonicalPathKey(value) {
  return path.resolve(value).toLowerCase();
}

function inspectPathComponents(targetPath, code) {
  const resolved = requireCanonicalAbsolutePath(targetPath, code);
  const parsed = path.parse(resolved);
  let current = parsed.root;
  const relative = resolved.slice(parsed.root.length);
  const components = relative.split(path.sep).filter((entry) => entry.length > 0);
  const paths = [current];
  for (const component of components) {
    current = path.join(current, component);
    paths.push(current);
  }
  for (const componentPath of paths) {
    let stat;
    try {
      stat = fs.lstatSync(componentPath);
    } catch {
      fail(code);
    }
    invariant(!stat.isSymbolicLink(), code);
  }
  let real;
  try {
    real = fs.realpathSync.native(resolved);
  } catch {
    fail(code);
  }
  invariant(canonicalPathKey(real) === canonicalPathKey(resolved), code);
  return resolved;
}

function inspectDirectDirectory(directoryPath, code) {
  const resolved = inspectPathComponents(directoryPath, code);
  let stat;
  try {
    stat = fs.lstatSync(resolved);
  } catch {
    fail(code);
  }
  invariant(stat.isDirectory() && !stat.isSymbolicLink(), code);
  return resolved;
}

function inspectRegularFile(filePath, maximumBytes, allowEmpty, code) {
  const resolved = inspectPathComponents(filePath, code);
  let stat;
  try {
    stat = fs.lstatSync(resolved);
  } catch {
    fail(code);
  }
  invariant(stat.isFile() && !stat.isSymbolicLink() &&
    (allowEmpty || stat.size > 0) && stat.size <= maximumBytes, code);
  return Object.freeze({ path: resolved, byteLength: stat.size });
}

function privateFileIdentity(filePath, code) {
  let stat;
  try {
    stat = fs.statSync(filePath, { bigint: true });
  } catch {
    fail(code);
  }
  return Object.freeze({
    volumeId: stat.dev.toString(10),
    fileId: stat.ino.toString(10)
  });
}

function sha256File(filePath, maximumBytes = maximumSingleMemberBytes, allowEmpty = false) {
  const file = inspectRegularFile(filePath, maximumBytes, allowEmpty,
    "msvc-environment-file-invalid");
  const descriptor = fs.openSync(file.path, "r");
  const digest = crypto.createHash("sha256");
  const buffer = Buffer.allocUnsafe(hashBufferBytes);
  let total = 0;
  let before;
  try {
    before = fs.fstatSync(descriptor, { bigint: true });
    invariant(before.isFile() && before.size === BigInt(file.byteLength),
      "msvc-environment-file-mutated");
    while (true) {
      const count = fs.readSync(descriptor, buffer, 0, buffer.length, total);
      if (count === 0) break;
      total += count;
      invariant(total <= maximumBytes, "msvc-environment-file-too-large");
      digest.update(buffer.subarray(0, count));
    }
    const after = fs.fstatSync(descriptor, { bigint: true });
    invariant(after.dev === before.dev && after.ino === before.ino &&
      after.size === before.size && after.mtimeNs === before.mtimeNs &&
      after.ctimeNs === before.ctimeNs, "msvc-environment-file-mutated");
  } finally {
    fs.closeSync(descriptor);
  }
  invariant(total === file.byteLength, "msvc-environment-file-mutated");
  const pathIdentity = fs.statSync(file.path, { bigint: true });
  invariant(pathIdentity.dev === before.dev && pathIdentity.ino === before.ino &&
    pathIdentity.size === before.size && pathIdentity.mtimeNs === before.mtimeNs &&
    pathIdentity.ctimeNs === before.ctimeNs,
  "msvc-environment-file-mutated");
  return Object.freeze({ byteLength: total, sha256: digest.digest("hex") });
}

function readBoundedBytes(filePath, maximumBytes, allowEmpty, code) {
  const file = inspectRegularFile(filePath, maximumBytes, allowEmpty, code);
  const descriptor = fs.openSync(file.path, "r");
  let before;
  const bytes = Buffer.alloc(file.byteLength);
  try {
    before = fs.fstatSync(descriptor, { bigint: true });
    invariant(before.isFile() && before.size === BigInt(file.byteLength), code);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(descriptor, bytes, offset, bytes.length - offset, offset);
      invariant(count > 0, code);
      offset += count;
    }
    const after = fs.fstatSync(descriptor, { bigint: true });
    invariant(after.dev === before.dev && after.ino === before.ino &&
      after.size === before.size && after.mtimeNs === before.mtimeNs &&
      after.ctimeNs === before.ctimeNs, code);
  } finally {
    fs.closeSync(descriptor);
  }
  const pathIdentity = fs.statSync(file.path, { bigint: true });
  invariant(pathIdentity.dev === before.dev && pathIdentity.ino === before.ino &&
    pathIdentity.size === before.size && pathIdentity.mtimeNs === before.mtimeNs &&
    pathIdentity.ctimeNs === before.ctimeNs, code);
  return Object.freeze({
    bytes,
    artifact: Object.freeze({ byteLength: bytes.length, sha256: sha256(bytes) })
  });
}

function readCanonicalJson(filePath, maximumBytes, code) {
  const bounded = readBoundedBytes(filePath, maximumBytes, false, code);
  const { bytes, artifact } = bounded;
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail(code);
  }
  invariant(bytes.equals(Buffer.from(canonicalJson(value), "utf8")), code);
  return Object.freeze({ value, artifact });
}

function parseVersion(value, componentCount, code) {
  invariant(typeof value === "string" && versionPattern.test(value), code);
  const parts = value.split(".");
  invariant(parts.length === componentCount, code);
  const numbers = parts.map((part) => {
    invariant(part === "0" || !part.startsWith("0"), code);
    const number = Number(part);
    return requireSafeInteger(number, 0, 999999999, code);
  });
  return Object.freeze(numbers);
}

function compareVersion(left, right) {
  invariant(left.length === right.length, "msvc-environment-version-arity");
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1;
  }
  return 0;
}

function withinVersionRange(value, minimum, maximumExclusive) {
  return compareVersion(value, minimum) >= 0 && compareVersion(value, maximumExclusive) < 0;
}

function isWithinRoot(root, candidate) {
  const relative = path.relative(canonicalPathKey(root), canonicalPathKey(candidate));
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." &&
    !path.isAbsolute(relative));
}

function inspectPeX64(filePath, code) {
  const artifactBefore = sha256File(filePath, 268435456, false);
  const descriptor = fs.openSync(filePath, "r");
  try {
    const dos = Buffer.alloc(64);
    invariant(fs.readSync(descriptor, dos, 0, dos.length, 0) === dos.length &&
      dos.readUInt16LE(0) === 0x5a4d, code);
    const peOffset = dos.readUInt32LE(0x3c);
    invariant(peOffset >= 64 && peOffset <= artifactBefore.byteLength - 6, code);
    const header = Buffer.alloc(6);
    invariant(fs.readSync(descriptor, header, 0, header.length, peOffset) === header.length &&
      header.readUInt32LE(0) === 0x00004550 && header.readUInt16LE(4) === 0x8664, code);
  } finally {
    fs.closeSync(descriptor);
  }
  const artifactAfter = sha256File(filePath, 268435456, false);
  invariant(artifactAfter.byteLength === artifactBefore.byteLength &&
    artifactAfter.sha256 === artifactBefore.sha256, "msvc-environment-file-mutated");
  return Object.freeze({ ...artifactAfter, peMachine: "x86_64" });
}

function inspectArchive(filePath, code) {
  const artifactBefore = sha256File(filePath, maximumSingleMemberBytes, false);
  const descriptor = fs.openSync(filePath, "r");
  try {
    const magic = Buffer.alloc(8);
    invariant(fs.readSync(descriptor, magic, 0, magic.length, 0) === magic.length &&
      magic.equals(Buffer.from("!<arch>\n", "ascii")), code);
  } finally {
    fs.closeSync(descriptor);
  }
  const artifactAfter = sha256File(filePath, maximumSingleMemberBytes, false);
  invariant(artifactAfter.byteLength === artifactBefore.byteLength &&
    artifactAfter.sha256 === artifactBefore.sha256, "msvc-environment-file-mutated");
  return artifactAfter;
}

function requireArtifact(value, code) {
  requireExactKeys(value, ["path", "byteLength", "sha256"], code);
  requireCanonicalAbsolutePath(value.path, code);
  requireSafeInteger(value.byteLength, 1, maximumSingleMemberBytes, code);
  requireSha256(value.sha256, code);
}

function validateRequestShape(request) {
  requireExactKeys(request, ["schema", "operationId", "materializedAtUtc", "profile",
    "discovery", "selection", "outputs", "prohibitedWriteRoots"],
  "msvc-environment-request-fields");
  invariant(request.schema === requestSchema, "msvc-environment-request-schema");
  invariant(typeof request.operationId === "string" && safeIdPattern.test(request.operationId),
    "msvc-environment-operation-id");
  invariant(typeof request.materializedAtUtc === "string" &&
    utcPattern.test(request.materializedAtUtc), "msvc-environment-materialized-at");

  requireExactKeys(request.profile, ["path", "byteLength", "sha256", "profileId"],
    "msvc-environment-profile-fields");
  requireCanonicalAbsolutePath(request.profile.path, "msvc-environment-profile-path");
  invariant(request.profile.byteLength === profileByteLength &&
    request.profile.sha256 === profileSha256 && request.profile.profileId === profileId,
  "msvc-environment-profile-identity");

  requireExactKeys(request.discovery, ["vswhere", "windowsKitsRoot", "systemRoot"],
    "msvc-environment-discovery-fields");
  requireArtifact(request.discovery.vswhere, "msvc-environment-vswhere-fields");
  requireCanonicalAbsolutePath(request.discovery.windowsKitsRoot,
    "msvc-environment-kits-root");
  requireCanonicalAbsolutePath(request.discovery.systemRoot, "msvc-environment-system-root");

  requireExactKeys(request.selection, ["visualStudioProductLineVersion",
    "minimumInstallationVersion", "maximumInstallationVersionExclusive",
    "minimumWindowsSdkVersion", "maximumWindowsSdkVersionExclusive"],
  "msvc-environment-selection-fields");
  invariant(productLinePattern.test(request.selection.visualStudioProductLineVersion),
    "msvc-environment-product-line");
  const minimumInstallation = parseVersion(request.selection.minimumInstallationVersion, 4,
    "msvc-environment-installation-version");
  const maximumInstallation = parseVersion(
    request.selection.maximumInstallationVersionExclusive, 4,
    "msvc-environment-installation-version");
  const minimumSdk = parseVersion(request.selection.minimumWindowsSdkVersion, 4,
    "msvc-environment-sdk-version");
  const maximumSdk = parseVersion(request.selection.maximumWindowsSdkVersionExclusive, 4,
    "msvc-environment-sdk-version");
  invariant(compareVersion(minimumInstallation, maximumInstallation) < 0 &&
    compareVersion(minimumSdk, maximumSdk) < 0, "msvc-environment-version-range");

  requireExactKeys(request.outputs, ["privateBindingPath", "publicLockPath", "terminalPath"],
    "msvc-environment-output-fields");
  const outputPaths = Object.values(request.outputs).map((value) =>
    requireCanonicalAbsolutePath(value, "msvc-environment-output-path"));
  invariant(outputPaths.every((value) => outputNamePattern.test(path.basename(value))),
    "msvc-environment-output-name");
  invariant(new Set(outputPaths.map(canonicalPathKey)).size === outputPaths.length,
    "msvc-environment-output-distinct");
  invariant(new Set(outputPaths.map((value) => canonicalPathKey(path.dirname(value)))).size === 1,
    "msvc-environment-output-siblings");

  invariant(Array.isArray(request.prohibitedWriteRoots) &&
    request.prohibitedWriteRoots.length > 0 && request.prohibitedWriteRoots.length <= 16,
  "msvc-environment-prohibited-roots");
  let previousRoot = null;
  let includesDriveD = false;
  for (const root of request.prohibitedWriteRoots) {
    requireCanonicalAbsolutePath(root, "msvc-environment-prohibited-root");
    const key = canonicalPathKey(root);
    invariant(previousRoot === null || previousRoot < key,
      "msvc-environment-prohibited-root-order");
    previousRoot = key;
    if (key === canonicalPathKey("D:\\")) includesDriveD = true;
    for (const outputPath of outputPaths) {
      invariant(!isWithinRoot(root, outputPath), "msvc-environment-prohibited-write");
    }
  }
  invariant(includesDriveD, "msvc-environment-drive-d-prohibition");
  return Object.freeze({ minimumInstallation, maximumInstallation, minimumSdk, maximumSdk });
}

function validateProfile(profileDocument) {
  invariant(profileDocument.artifact.byteLength === profileByteLength &&
    profileDocument.artifact.sha256 === profileSha256,
  "msvc-environment-profile-identity");
  const profile = profileDocument.value;
  invariant(profile.schema === "tinyrustlm.windows_x64_msvc_environment_profile.v1" &&
    profile.profileId === profileId && profile.status === "current-prelaunch-only" &&
    profile.platform === "win32" && profile.architecture === "x64" &&
    profile.targetTriple === targetTriple, "msvc-environment-profile-contract");
}

function prepareRequest(requestPath, options = {}) {
  const outputsMustBeAbsent = options.outputsMustBeAbsent !== false;
  const resolvedRequestPath = requireCanonicalAbsolutePath(requestPath,
    "msvc-environment-request-path");
  const requestDocument = readCanonicalJson(
    resolvedRequestPath,
    maximumRequestBytes,
    "msvc-environment-request-json"
  );
  const ranges = validateRequestShape(requestDocument.value);
  const request = requestDocument.value;
  const profileDocument = readCanonicalJson(request.profile.path, profileByteLength,
    "msvc-environment-profile-json");
  validateProfile(profileDocument);
  const profileArtifact = sha256File(request.profile.path, profileByteLength, false);
  invariant(profileArtifact.byteLength === profileByteLength &&
    profileArtifact.sha256 === profileSha256, "msvc-environment-profile-identity");
  const vswhereArtifact = sha256File(request.discovery.vswhere.path,
    request.discovery.vswhere.byteLength, false);
  invariant(vswhereArtifact.byteLength === request.discovery.vswhere.byteLength &&
    vswhereArtifact.sha256 === request.discovery.vswhere.sha256,
  "msvc-environment-vswhere-identity");
  invariant(path.basename(request.discovery.vswhere.path).toLowerCase() === "vswhere.exe",
    "msvc-environment-vswhere-name");
  inspectDirectDirectory(request.discovery.windowsKitsRoot, "msvc-environment-kits-root");
  const systemRoot = inspectDirectDirectory(request.discovery.systemRoot,
    "msvc-environment-system-root");
  inspectDirectDirectory(path.join(systemRoot, "System32"),
    "msvc-environment-system32-root");
  const outputParent = inspectDirectDirectory(path.dirname(request.outputs.publicLockPath),
    "msvc-environment-output-parent");
  invariant(Object.values(request.outputs).every((value) =>
    canonicalPathKey(path.dirname(value)) === canonicalPathKey(outputParent)),
  "msvc-environment-output-siblings");
  if (outputsMustBeAbsent) {
    for (const outputPath of Object.values(request.outputs)) {
      invariant(!fs.existsSync(outputPath), "msvc-environment-output-exists");
    }
  }
  return Object.freeze({ requestPath: resolvedRequestPath, request, requestDocument,
    profileDocument, ranges, vswhereArtifact, outputParent });
}

function runVswhere(prepared) {
  const result = childProcess.spawnSync(
    prepared.request.discovery.vswhere.path,
    vswhereArguments,
    {
      cwd: prepared.request.discovery.systemRoot,
      env: { SystemRoot: prepared.request.discovery.systemRoot },
      encoding: null,
      windowsHide: true,
      shell: false,
      maxBuffer: maximumVswhereOutputBytes
    }
  );
  invariant(!result.error && result.status === 0 && result.signal === null,
    "msvc-environment-vswhere-process");
  const stdout = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.alloc(0);
  const stderr = Buffer.isBuffer(result.stderr) ? result.stderr : Buffer.alloc(0);
  invariant(stdout.length > 0 && stdout.length <= maximumVswhereOutputBytes,
    "msvc-environment-vswhere-output");
  invariant(stderr.length === 0, "msvc-environment-vswhere-stderr");
  return stdout;
}

function parseVswhereOutput(bytes) {
  invariant(Buffer.isBuffer(bytes) && bytes.length > 0 &&
    bytes.length <= maximumVswhereOutputBytes, "msvc-environment-vswhere-output");
  let text = bytes.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    fail("msvc-environment-vswhere-json");
  }
  invariant(Array.isArray(value) && value.length <= maximumInstances,
    "msvc-environment-vswhere-instances");
  return value;
}

function normalizeInstance(value) {
  invariant(isPlainObject(value) && typeof value.instanceId === "string" &&
    value.instanceId.length > 0 && value.instanceId.length <= 256 &&
    typeof value.installationPath === "string" &&
    typeof value.installationVersion === "string" &&
    typeof value.productId === "string" && typeof value.channelId === "string" &&
    typeof value.isComplete === "boolean" && typeof value.isLaunchable === "boolean" &&
    typeof value.isPrerelease === "boolean" && typeof value.isRebootRequired === "boolean" &&
    isPlainObject(value.catalog) &&
    typeof value.catalog.productLineVersion === "string",
  "msvc-environment-instance-shape");
  return Object.freeze({
    instanceId: value.instanceId,
    installationPath: requireCanonicalAbsolutePath(value.installationPath,
      "msvc-environment-instance-path"),
    installationVersion: value.installationVersion,
    installationVersionParts: parseVersion(value.installationVersion, 4,
      "msvc-environment-installation-version"),
    productId: value.productId,
    channelId: value.channelId,
    productLineVersion: value.catalog.productLineVersion,
    isComplete: value.isComplete,
    isLaunchable: value.isLaunchable,
    isPrerelease: value.isPrerelease,
    isRebootRequired: value.isRebootRequired
  });
}

function selectInstance(rawInstances, prepared) {
  const normalized = rawInstances.map(normalizeInstance);
  const selection = prepared.request.selection;
  const eligible = normalized.filter((instance) =>
    instance.isComplete && instance.isLaunchable && !instance.isPrerelease &&
    !instance.isRebootRequired &&
    instance.productLineVersion === selection.visualStudioProductLineVersion &&
    withinVersionRange(instance.installationVersionParts,
      prepared.ranges.minimumInstallation, prepared.ranges.maximumInstallation));
  invariant(eligible.length > 0, "msvc-environment-instance-none");
  eligible.sort((left, right) => {
    const byVersion = compareVersion(right.installationVersionParts,
      left.installationVersionParts);
    return byVersion !== 0 ? byVersion : compareUtf8(left.instanceId, right.instanceId);
  });
  invariant(eligible.length === 1 || compareVersion(eligible[0].installationVersionParts,
    eligible[1].installationVersionParts) !== 0,
  "msvc-environment-instance-ambiguous");
  const selected = eligible[0];
  inspectDirectDirectory(selected.installationPath, "msvc-environment-instance-path");
  return Object.freeze({ candidateCount: normalized.length, eligibleCount: eligible.length,
    selected });
}

function readToolsetVersion(instancePath) {
  const versionPath = path.join(instancePath, "VC", "Auxiliary", "Build",
    "Microsoft.VCToolsVersion.default.txt");
  const bounded = readBoundedBytes(versionPath, 4096, false,
    "msvc-environment-toolset-version-file");
  const { bytes, artifact } = bounded;
  invariant(bytes.length === artifact.byteLength && !bytes.includes(0),
    "msvc-environment-toolset-version-file");
  const text = bytes.toString("ascii");
  invariant(Buffer.from(text, "ascii").equals(bytes),
    "msvc-environment-toolset-version-file");
  const lines = text.split(/\r?\n/u).filter((line) => line.length > 0);
  invariant(lines.length === 1 && lines[0] === text.trim(),
    "msvc-environment-toolset-version-file");
  parseVersion(lines[0], 3, "msvc-environment-toolset-version");
  return Object.freeze({ version: lines[0], path: versionPath, artifact });
}

function completeSdkVersion(kitsRoot, version) {
  const includeRoot = path.join(kitsRoot, "Include", version);
  const includeRoles = ["shared", "ucrt", "um"];
  const requiredPaths = [
    ...includeRoles.map((role) => path.join(includeRoot, role)),
    path.join(kitsRoot, "bin", version, "x64"),
    path.join(kitsRoot, "Lib", version, "ucrt", "x64"),
    path.join(kitsRoot, "Lib", version, "um", "x64")
  ];
  for (const requiredPath of requiredPaths) {
    try {
      fs.lstatSync(requiredPath);
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      fail("msvc-environment-sdk-inspection");
    }
  }
  const includeRoots = Object.freeze(includeRoles.map((role) => Object.freeze({
    role,
    path: inspectDirectDirectory(path.join(includeRoot, role),
      "msvc-environment-sdk-includes"),
    ...privateFileIdentity(path.join(includeRoot, role), "msvc-environment-sdk-includes")
  })));
  const paths = Object.freeze({
    sdkBin: inspectDirectDirectory(path.join(kitsRoot, "bin", version, "x64"),
      "msvc-environment-sdk-bin"),
    sdkUcrtLib: inspectDirectDirectory(path.join(kitsRoot, "Lib", version, "ucrt", "x64"),
      "msvc-environment-sdk-ucrt-lib"),
    sdkUmLib: inspectDirectDirectory(path.join(kitsRoot, "Lib", version, "um", "x64"),
      "msvc-environment-sdk-um-lib")
  });
  return Object.freeze({ version, paths, includeRoles: Object.freeze(includeRoles),
    includeRoots });
}

function selectSdkVersion(prepared) {
  const kitsRoot = prepared.request.discovery.windowsKitsRoot;
  const roots = ["Include", "Lib", "bin"].map((name) =>
    inspectDirectDirectory(path.join(kitsRoot, name), "msvc-environment-sdk-root"));
  const sets = roots.map((root) => {
    const versions = new Set();
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!versionPattern.test(entry.name)) continue;
      invariant(entry.isDirectory() && !entry.isSymbolicLink(),
        "msvc-environment-sdk-version-entry");
      versions.add(entry.name);
    }
    return versions;
  });
  const common = [...sets[0]].filter((version) => sets.slice(1).every((set) => set.has(version)))
    .map((version) => Object.freeze({
      version,
      parts: parseVersion(version, 4, "msvc-environment-sdk-version")
    }))
    .filter((entry) => withinVersionRange(entry.parts, prepared.ranges.minimumSdk,
      prepared.ranges.maximumSdk))
    .sort((left, right) => compareVersion(right.parts, left.parts));
  for (const candidate of common) {
    const complete = completeSdkVersion(kitsRoot, candidate.version);
    if (complete !== null) return complete;
  }
  fail("msvc-environment-sdk-none");
}

function inventoryClosureSha256(role, members) {
  const hash = crypto.createHash("sha256");
  hash.update("tinyrustlm.windows-x64-msvc-inventory.v1\u0000", "utf8");
  hash.update(role, "utf8");
  hash.update(Buffer.from([0]));
  for (const member of members) {
    hash.update(member.name, "utf8");
    hash.update(Buffer.from([0]));
    hash.update(String(member.byteLength), "ascii");
    hash.update(Buffer.from([0]));
    hash.update(member.sha256, "ascii");
    hash.update(Buffer.from([0x0a]));
  }
  return hash.digest("hex");
}

function inventoryDirectory(role, rootPath, options) {
  const root = inspectDirectDirectory(rootPath, "msvc-environment-inventory-root");
  const entries = fs.readdirSync(root, { withFileTypes: true })
    .sort((left, right) => compareUtf8(left.name, right.name));
  const selected = [];
  const names = new Set();
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    const stat = fs.lstatSync(entryPath);
    invariant(!entry.isSymbolicLink() && !stat.isSymbolicLink(),
      "msvc-environment-inventory-link");
    if (!stat.isFile()) continue;
    if (options.extension !== null &&
        path.extname(entry.name).toLowerCase() !== options.extension) continue;
    const key = entry.name.toLowerCase();
    invariant(!names.has(key), "msvc-environment-inventory-name-collision");
    names.add(key);
    const artifact = options.archive ? inspectArchive(entryPath,
      "msvc-environment-library-archive") : sha256File(entryPath,
      maximumSingleMemberBytes, false);
    selected.push(Object.freeze({ name: entry.name, byteLength: artifact.byteLength,
      sha256: artifact.sha256 }));
  }
  invariant(selected.length > 0 && selected.length <= maximumInventoryMembers,
    "msvc-environment-inventory-count");
  const aggregateBytes = selected.reduce((total, member) => total + member.byteLength, 0);
  invariant(Number.isSafeInteger(aggregateBytes) &&
    aggregateBytes <= maximumInventoryAggregateBytes,
  "msvc-environment-inventory-bytes");
  for (const required of options.required) {
    invariant(names.has(required.toLowerCase()), "msvc-environment-required-member");
  }
  return Object.freeze({
    public: Object.freeze({
      role,
      memberKind: options.archive ? "coff-archive" : "regular-file",
      memberCount: selected.length,
      aggregateBytes,
      closureSha256: inventoryClosureSha256(role, selected),
      requiredMembers: options.required,
      members: Object.freeze(selected)
    }),
    private: Object.freeze({
      role,
      path: root,
      ...privateFileIdentity(root, "msvc-environment-inventory-root")
    }),
    lookup: Object.freeze(new Map(selected.map((member) =>
      [member.name.toLowerCase(), member])))
  });
}

function artifactForInventoryMember(inventory, name, peRequired) {
  const member = inventory.lookup.get(name.toLowerCase());
  invariant(member !== undefined, "msvc-environment-required-tool");
  const toolPath = path.join(inventory.private.path, member.name);
  const artifact = peRequired ? inspectPeX64(toolPath, "msvc-environment-tool-pe") :
    sha256File(toolPath, maximumSingleMemberBytes, false);
  invariant(artifact.byteLength === member.byteLength && artifact.sha256 === member.sha256,
    "msvc-environment-tool-inventory-drift");
  return Object.freeze({
    public: Object.freeze({ id: `${inventory.public.role}/${member.name.toLowerCase()}`,
      rootRole: inventory.public.role, name: member.name, byteLength: artifact.byteLength,
      sha256: artifact.sha256, peMachine: peRequired ? "x86_64" : null }),
    private: Object.freeze({ id: `${inventory.public.role}/${member.name.toLowerCase()}`,
      path: toolPath, ...privateFileIdentity(toolPath, "msvc-environment-tool-file") })
  });
}

function trailingSeparator(value) {
  return value.endsWith(path.sep) ? value : `${value}${path.sep}`;
}

function orderedEnvironment(entries) {
  const names = new Set();
  const result = Object.entries(entries).map(([name, value]) => {
    invariant(environmentNamePattern.test(name) && typeof value === "string" &&
      !value.includes("\u0000") && Buffer.byteLength(value, "utf8") <=
      maximumEnvironmentValueBytes, "msvc-environment-entry");
    const key = name.toUpperCase();
    invariant(!names.has(key), "msvc-environment-entry-duplicate");
    names.add(key);
    return Object.freeze({ name, value });
  }).sort((left, right) => compareUtf8(left.name.toUpperCase(), right.name.toUpperCase()));
  invariant(result.length > 0 && result.length <= maximumEnvironmentEntries,
    "msvc-environment-entry-count");
  return Object.freeze(result);
}

function renderEnvironment(layout) {
  const pathEntries = [layout.msvcBin.private.path, layout.sdkBin.private.path,
    path.join(layout.systemRoot, "System32")];
  const libraryEntries = [layout.msvcLib.private.path, layout.ucrtLib.private.path,
    layout.umLib.private.path];
  const linkerPath = path.join(layout.msvcBin.private.path,
    layout.msvcBin.lookup.get("link.exe").name);
  const environment = orderedEnvironment({
    CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER: linkerPath,
    LIB: libraryEntries.join(";"),
    LIBPATH: libraryEntries.join(";"),
    PATH: pathEntries.join(";"),
    Platform: "x64",
    UCRTVersion: layout.sdkVersion,
    UniversalCRTSdkDir: trailingSeparator(layout.kitsRoot),
    VCINSTALLDIR: trailingSeparator(path.join(layout.instancePath, "VC")),
    VCToolsInstallDir: trailingSeparator(layout.toolRoot),
    VCToolsVersion: layout.toolsetVersion,
    VSCMD_ARG_HOST_ARCH: "x64",
    VSCMD_ARG_TGT_ARCH: "x64",
    WindowsSdkDir: trailingSeparator(layout.kitsRoot),
    WindowsSDKLibVersion: `${layout.sdkVersion}\\`,
    WindowsSDKVersion: `${layout.sdkVersion}\\`
  });
  const pathLookups = [layout.msvcBin, layout.sdkBin,
    Object.freeze({ public: { role: "system32" }, private: { path: pathEntries[2] },
      lookup: new Map() })];
  const resolution = uniqueResolution.map((expected) => {
    const candidates = [];
    for (const root of pathLookups) {
      const member = root.lookup.get(expected.name.toLowerCase());
      if (member !== undefined) candidates.push(Object.freeze({ role: root.public.role,
        name: member.name, byteLength: member.byteLength, sha256: member.sha256 }));
      if (root.public.role === "system32" && fs.existsSync(path.join(root.private.path,
        expected.name))) {
        const artifact = sha256File(path.join(root.private.path, expected.name),
          maximumSingleMemberBytes, false);
        candidates.push(Object.freeze({ role: "system32", name: expected.name,
          byteLength: artifact.byteLength, sha256: artifact.sha256 }));
      }
    }
    invariant(candidates.length === 1 && candidates[0].role === expected.role,
      "msvc-environment-command-resolution");
    return Object.freeze({ command: expected.name, candidateCount: candidates.length,
      selectedRole: expected.role, selectedSha256: candidates[0].sha256 });
  });
  const publicEnvironment = environment.map((entry) => {
    const publicNames = new Set(["Platform", "UCRTVersion", "VCToolsVersion",
      "VSCMD_ARG_HOST_ARCH", "VSCMD_ARG_TGT_ARCH", "WindowsSDKLibVersion",
      "WindowsSDKVersion"]);
    if (publicNames.has(entry.name)) return Object.freeze({ name: entry.name,
      valueKind: "public", value: entry.value });
    return Object.freeze({ name: entry.name, valueKind: "private-sha256",
      valueSha256: sha256(Buffer.from(
        `tinyrustlm.windows-x64-msvc-environment-value.v1\u0000${entry.name}\u0000${entry.value}`,
        "utf8")), segmentCount: ["LIB", "LIBPATH", "PATH"].includes(entry.name) ?
        entry.value.split(";").length : 1 });
  });
  return Object.freeze({ environment, publicEnvironment: Object.freeze(publicEnvironment),
    resolution: Object.freeze(resolution), linkerPath });
}

function publicArtifact(artifact) {
  return Object.freeze({ byteLength: artifact.byteLength, sha256: artifact.sha256 });
}

function privatePathIdentity(role, value, code) {
  return Object.freeze({ role, path: value, ...privateFileIdentity(value, code) });
}

function privateValueSha256(label, value) {
  return sha256(Buffer.from(
    `tinyrustlm.windows-x64-msvc-private-value.v1\u0000${label}\u0000${value}`,
    "utf8"
  ));
}

function claimBoundary() {
  return Object.freeze({
    environmentObservedAndBound: true,
    rustBuildAssessed: false,
    converterAssessed: false,
    structuralCompositionAssessed: false,
    sourceFrameworkParityAssessed: false,
    nativeRuntimeAssessed: false,
    browserWasmAssessed: false,
    modelQualityAssessed: false,
    p2pAssessed: false,
    publicationAssessed: false,
    memoryEndpointsAuthorized: false,
    campaignCreditAuthorized: false
  });
}

function buildLayout(prepared, observedVswhereBytes = null) {
  invariant(process.platform === "win32" && process.arch === "x64",
    "msvc-environment-platform");
  const vswhereBytes = observedVswhereBytes === null
    ? runVswhere(prepared)
    : observedVswhereBytes;
  invariant(Buffer.isBuffer(vswhereBytes), "msvc-environment-vswhere-output");
  const vswhereOutputArtifact = Object.freeze({
    byteLength: vswhereBytes.length,
    sha256: sha256(vswhereBytes)
  });
  const instanceSelection = selectInstance(parseVswhereOutput(vswhereBytes), prepared);
  const selected = instanceSelection.selected;
  const toolset = readToolsetVersion(selected.installationPath);
  const toolRoot = inspectDirectDirectory(path.join(selected.installationPath, "VC", "Tools",
    "MSVC", toolset.version), "msvc-environment-tool-root");
  const msvcBin = inventoryDirectory("msvc-hostx64-x64-bin",
    path.join(toolRoot, "bin", "Hostx64", "x64"), {
      extension: null,
      archive: false,
      required: msvcRequiredTools
    });
  const msvcLib = inventoryDirectory("msvc-x64-lib", path.join(toolRoot, "lib", "x64"), {
    extension: ".lib",
    archive: true,
    required: msvcRequiredLibraries
  });
  const sdk = selectSdkVersion(prepared);
  const sdkBin = inventoryDirectory("windows-sdk-x64-bin", sdk.paths.sdkBin, {
    extension: null,
    archive: false,
    required: sdkRequiredTools
  });
  const ucrtLib = inventoryDirectory("windows-sdk-ucrt-x64-lib", sdk.paths.sdkUcrtLib, {
    extension: ".lib",
    archive: true,
    required: ucrtRequiredLibraries
  });
  const umLib = inventoryDirectory("windows-sdk-um-x64-lib", sdk.paths.sdkUmLib, {
    extension: ".lib",
    archive: true,
    required: umRequiredLibraries
  });
  const requiredTools = Object.freeze([
    ...msvcRequiredTools.map((name) => artifactForInventoryMember(msvcBin, name, true)),
    ...sdkRequiredTools.map((name) => artifactForInventoryMember(sdkBin, name, true))
  ]);
  const layout = {
    instanceSelection,
    selected,
    toolset,
    toolRoot,
    sdk,
    sdkVersion: sdk.version,
    systemRoot: prepared.request.discovery.systemRoot,
    kitsRoot: prepared.request.discovery.windowsKitsRoot,
    instancePath: selected.installationPath,
    toolsetVersion: toolset.version,
    msvcBin,
    msvcLib,
    sdkBin,
    ucrtLib,
    umLib,
    requiredTools,
    vswhereBytes,
    vswhereOutputArtifact
  };
  layout.renderedEnvironment = renderEnvironment(layout);
  return Object.freeze(layout);
}

function buildPublicBasis(prepared, layout) {
  const selected = layout.selected;
  return Object.freeze({
    schema: publicBasisSchema,
    operationId: prepared.request.operationId,
    materializedAtUtc: prepared.request.materializedAtUtc,
    target: Object.freeze({
      platform: "win32",
      architecture: "x64",
      targetTriple
    }),
    profile: Object.freeze({
      profileId,
      byteLength: profileByteLength,
      sha256: profileSha256
    }),
    request: publicArtifact(prepared.requestDocument.artifact),
    selectionPolicy: Object.freeze({ ...prepared.request.selection }),
    discovery: Object.freeze({
      method: "exact-vswhere-process",
      requiredComponent,
      arguments: vswhereArguments,
      executable: publicArtifact(prepared.vswhereArtifact),
      stdout: publicArtifact(layout.vswhereOutputArtifact),
      candidateCount: layout.instanceSelection.candidateCount,
      eligibleCount: layout.instanceSelection.eligibleCount
    }),
    selectedVisualStudio: Object.freeze({
      instanceIdSha256: privateValueSha256("visual-studio-instance-id",
        selected.instanceId),
      productId: selected.productId,
      channelId: selected.channelId,
      productLineVersion: selected.productLineVersion,
      installationVersion: selected.installationVersion,
      state: "complete-launchable-nonprerelease-no-reboot"
    }),
    toolset: Object.freeze({
      version: layout.toolset.version,
      defaultVersionFile: publicArtifact(layout.toolset.artifact)
    }),
    windowsSdk: Object.freeze({
      version: layout.sdk.version,
      completeVersionIntersection: true,
      includeRoles: layout.sdk.includeRoles
    }),
    inventories: Object.freeze([
      layout.msvcBin.public,
      layout.msvcLib.public,
      layout.sdkBin.public,
      layout.ucrtLib.public,
      layout.umLib.public
    ]),
    requiredTools: Object.freeze(layout.requiredTools.map((entry) => entry.public)),
    environment: Object.freeze({
      entryCount: layout.renderedEnvironment.environment.length,
      entries: layout.renderedEnvironment.publicEnvironment,
      commandResolution: layout.renderedEnvironment.resolution,
      explicitCargoTargetLinker: true,
      inheritedDeveloperEnvironment: false
    }),
    claimBoundary: claimBoundary()
  });
}

function buildPrivateBinding(prepared, layout, publicBasisArtifact) {
  const inventoryRoots = [layout.msvcBin, layout.msvcLib, layout.sdkBin,
    layout.ucrtLib, layout.umLib].map((entry) => entry.private);
  return Object.freeze({
    schema: privateBindingSchema,
    operationId: prepared.request.operationId,
    materializedAtUtc: prepared.request.materializedAtUtc,
    profile: Object.freeze({
      path: prepared.request.profile.path,
      profileId,
      byteLength: profileByteLength,
      sha256: profileSha256,
      ...privateFileIdentity(prepared.request.profile.path,
        "msvc-environment-profile-identity")
    }),
    request: Object.freeze({
      path: prepared.requestPath,
      ...publicArtifact(prepared.requestDocument.artifact),
      ...privateFileIdentity(prepared.requestPath, "msvc-environment-request-binding")
    }),
    publicBasis: Object.freeze({
      schema: publicBasisSchema,
      ...publicBasisArtifact
    }),
    discovery: Object.freeze({
      vswhere: Object.freeze({
        path: prepared.request.discovery.vswhere.path,
        ...publicArtifact(prepared.vswhereArtifact),
        ...privateFileIdentity(prepared.request.discovery.vswhere.path,
          "msvc-environment-vswhere-identity")
      }),
      vswhereStdout: publicArtifact(layout.vswhereOutputArtifact),
      windowsKitsRoot: privatePathIdentity("windows-kits-root", layout.kitsRoot,
        "msvc-environment-kits-root"),
      systemRoot: privatePathIdentity("system-root", layout.systemRoot,
        "msvc-environment-system-root")
    }),
    selectedVisualStudio: Object.freeze({
      instanceId: layout.selected.instanceId,
      installationPath: layout.selected.installationPath,
      installationVersion: layout.selected.installationVersion,
      productId: layout.selected.productId,
      channelId: layout.selected.channelId,
      productLineVersion: layout.selected.productLineVersion,
      ...privateFileIdentity(layout.selected.installationPath,
        "msvc-environment-instance-path")
    }),
    toolset: Object.freeze({
      version: layout.toolset.version,
      defaultVersionFile: Object.freeze({
        path: layout.toolset.path,
        ...publicArtifact(layout.toolset.artifact),
        ...privateFileIdentity(layout.toolset.path,
          "msvc-environment-toolset-version-file")
      }),
      root: privatePathIdentity("msvc-toolset-root", layout.toolRoot,
        "msvc-environment-tool-root")
    }),
    windowsSdk: Object.freeze({
      version: layout.sdk.version,
      includeRoots: layout.sdk.includeRoots
    }),
    inventoryRoots: Object.freeze(inventoryRoots),
    requiredTools: Object.freeze(layout.requiredTools.map((entry) => Object.freeze({
      ...entry.private,
      byteLength: entry.public.byteLength,
      sha256: entry.public.sha256,
      peMachine: entry.public.peMachine
    }))),
    environment: Object.freeze({
      entries: layout.renderedEnvironment.environment,
      linkerPath: layout.renderedEnvironment.linkerPath
    }),
    retryAllowed: false,
    resumeAllowed: false,
    outputRepairAllowed: false
  });
}

function renderDocuments(prepared, observedVswhereBytes = null) {
  const layout = buildLayout(prepared, observedVswhereBytes);
  const publicBasis = buildPublicBasis(prepared, layout);
  const publicBasisBytes = Buffer.from(canonicalJson(publicBasis), "utf8");
  const publicBasisArtifact = Object.freeze({
    byteLength: publicBasisBytes.length,
    sha256: sha256(publicBasisBytes)
  });
  const privateBinding = buildPrivateBinding(prepared, layout, publicBasisArtifact);
  const privateBindingBytes = Buffer.from(canonicalJson(privateBinding), "utf8");
  invariant(privateBindingBytes.length <= maximumPrivateBindingBytes,
    "msvc-environment-private-binding-size");
  const privateBindingArtifact = Object.freeze({
    byteLength: privateBindingBytes.length,
    sha256: sha256(privateBindingBytes)
  });
  const publicLock = Object.freeze({
    schema: publicLockSchema,
    operationId: prepared.request.operationId,
    materializedAtUtc: prepared.request.materializedAtUtc,
    status: "locked",
    profile: Object.freeze({ profileId, byteLength: profileByteLength,
      sha256: profileSha256 }),
    request: publicArtifact(prepared.requestDocument.artifact),
    publicBasis: Object.freeze({ schema: publicBasisSchema, ...publicBasisArtifact }),
    privateBinding: Object.freeze({ schema: privateBindingSchema,
      ...privateBindingArtifact }),
    basis: publicBasis
  });
  const publicLockBytes = Buffer.from(canonicalJson(publicLock), "utf8");
  invariant(publicLockBytes.length <= maximumPublicLockBytes,
    "msvc-environment-public-lock-size");
  const publicLockArtifact = Object.freeze({
    byteLength: publicLockBytes.length,
    sha256: sha256(publicLockBytes)
  });
  const terminal = Object.freeze({
    schema: terminalSchema,
    operationId: prepared.request.operationId,
    materializedAtUtc: prepared.request.materializedAtUtc,
    status: "pass",
    code: "msvc-environment-materialized",
    profile: Object.freeze({ profileId, byteLength: profileByteLength,
      sha256: profileSha256 }),
    request: publicArtifact(prepared.requestDocument.artifact),
    publicBasis: Object.freeze({ schema: publicBasisSchema, ...publicBasisArtifact }),
    privateBinding: Object.freeze({ schema: privateBindingSchema,
      ...privateBindingArtifact }),
    publicLock: Object.freeze({ schema: publicLockSchema, ...publicLockArtifact }),
    selected: Object.freeze({
      visualStudioProductLineVersion: layout.selected.productLineVersion,
      visualStudioInstallationVersion: layout.selected.installationVersion,
      msvcToolsetVersion: layout.toolset.version,
      windowsSdkVersion: layout.sdk.version
    }),
    outputOrder: Object.freeze(["private-binding", "public-lock", "terminal"]),
    createOnly: true,
    retryAllowed: false,
    resumeAllowed: false,
    outputRepairAllowed: false,
    claimBoundary: claimBoundary()
  });
  const terminalBytes = Buffer.from(canonicalJson(terminal), "utf8");
  invariant(terminalBytes.length <= maximumTerminalBytes,
    "msvc-environment-terminal-size");
  const terminalArtifact = Object.freeze({
    byteLength: terminalBytes.length,
    sha256: sha256(terminalBytes)
  });
  return Object.freeze({
    layout,
    publicBasis,
    publicBasisBytes,
    publicBasisArtifact,
    privateBinding,
    privateBindingBytes,
    privateBindingArtifact,
    publicLock,
    publicLockBytes,
    publicLockArtifact,
    terminal,
    terminalBytes,
    terminalArtifact
  });
}

function stagingPathFor(finalPath, operationId) {
  const suffix = sha256(Buffer.from(
    `tinyrustlm.windows-x64-msvc-stage.v1\u0000${operationId}\u0000${path.basename(finalPath)}`,
    "utf8"
  )).slice(0, 32);
  return path.join(path.dirname(finalPath),
    `.${path.basename(finalPath)}.${suffix}.partial`);
}

function requireStagingAbsent(request) {
  for (const outputPath of Object.values(request.outputs)) {
    invariant(!fs.existsSync(stagingPathFor(outputPath, request.operationId)),
      "msvc-environment-staging-exists");
  }
}

function writeNewDurable(filePath, bytes, maximumBytes, operationId) {
  invariant(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= maximumBytes,
    "msvc-environment-output-size");
  invariant(!fs.existsSync(filePath), "msvc-environment-output-exists");
  const parent = inspectDirectDirectory(path.dirname(filePath),
    "msvc-environment-output-parent");
  const stagingPath = stagingPathFor(filePath, operationId);
  invariant(canonicalPathKey(path.dirname(stagingPath)) === canonicalPathKey(parent) &&
    !fs.existsSync(stagingPath), "msvc-environment-staging-exists");
  const descriptor = fs.openSync(stagingPath, "wx");
  try {
    let offset = 0;
    while (offset < bytes.length) {
      const written = fs.writeSync(descriptor, bytes, offset, bytes.length - offset, offset);
      invariant(written > 0, "msvc-environment-output-short-write");
      offset += written;
    }
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  fs.linkSync(stagingPath, filePath);
  const stagingIdentity = fs.statSync(stagingPath, { bigint: true });
  const finalIdentity = fs.statSync(filePath, { bigint: true });
  invariant(stagingIdentity.dev === finalIdentity.dev &&
    stagingIdentity.ino === finalIdentity.ino && stagingIdentity.size === finalIdentity.size,
  "msvc-environment-output-promotion");
  const readback = fs.readFileSync(filePath);
  invariant(readback.equals(bytes), "msvc-environment-output-readback");
  fs.unlinkSync(stagingPath);
  invariant(!fs.existsSync(stagingPath), "msvc-environment-staging-removal");
  return Object.freeze({ byteLength: bytes.length, sha256: sha256(bytes) });
}

function requireExactOutput(filePath, expectedBytes, maximumBytes, code) {
  const bounded = readBoundedBytes(filePath, maximumBytes, false, code);
  const { artifact, bytes } = bounded;
  invariant(artifact.byteLength === expectedBytes.length &&
    artifact.sha256 === sha256(expectedBytes), code);
  invariant(bytes.equals(expectedBytes), code);
  return artifact;
}

function publicSummary(documents, code) {
  return Object.freeze({
    schema: summarySchema,
    operationId: documents.terminal.operationId,
    status: "pass",
    code,
    targetTriple,
    selected: documents.terminal.selected,
    privateBinding: documents.privateBindingArtifact,
    publicLock: documents.publicLockArtifact,
    terminal: documents.terminalArtifact,
    rustBuildAssessed: false,
    modelQualified: false,
    memoryEndpointsAuthorized: false,
    campaignCreditAuthorized: false
  });
}

function materialize(requestPath) {
  const prepared = prepareRequest(path.resolve(requestPath), { outputsMustBeAbsent: true });
  requireStagingAbsent(prepared.request);
  const documents = renderDocuments(prepared);
  const privateArtifact = writeNewDurable(prepared.request.outputs.privateBindingPath,
    documents.privateBindingBytes, maximumPrivateBindingBytes,
    prepared.request.operationId);
  invariant(privateArtifact.byteLength === documents.privateBindingArtifact.byteLength &&
    privateArtifact.sha256 === documents.privateBindingArtifact.sha256,
  "msvc-environment-private-binding-write");
  const lockArtifact = writeNewDurable(prepared.request.outputs.publicLockPath,
    documents.publicLockBytes, maximumPublicLockBytes, prepared.request.operationId);
  invariant(lockArtifact.byteLength === documents.publicLockArtifact.byteLength &&
    lockArtifact.sha256 === documents.publicLockArtifact.sha256,
  "msvc-environment-public-lock-write");
  const terminalArtifact = writeNewDurable(prepared.request.outputs.terminalPath,
    documents.terminalBytes, maximumTerminalBytes, prepared.request.operationId);
  invariant(terminalArtifact.byteLength === documents.terminalArtifact.byteLength &&
    terminalArtifact.sha256 === documents.terminalArtifact.sha256,
  "msvc-environment-terminal-write");
  return publicSummary(documents, "msvc-environment-materialized");
}

function validateMaterialization(requestPath) {
  const prepared = prepareRequest(path.resolve(requestPath), { outputsMustBeAbsent: false });
  requireStagingAbsent(prepared.request);
  const documents = renderDocuments(prepared);
  requireExactOutput(prepared.request.outputs.privateBindingPath,
    documents.privateBindingBytes, maximumPrivateBindingBytes,
    "msvc-environment-private-binding-drift");
  requireExactOutput(prepared.request.outputs.publicLockPath,
    documents.publicLockBytes, maximumPublicLockBytes,
    "msvc-environment-public-lock-drift");
  requireExactOutput(prepared.request.outputs.terminalPath,
    documents.terminalBytes, maximumTerminalBytes,
    "msvc-environment-terminal-drift");
  return publicSummary(documents, "msvc-environment-validation-pass");
}

function main(argv) {
  invariant(Array.isArray(argv) && argv.length === 2, "msvc-environment-arguments");
  const [command, requestPath] = argv;
  const result = command === "materialize"
    ? materialize(path.resolve(requestPath))
    : command === "validate"
      ? validateMaterialization(path.resolve(requestPath))
      : fail("msvc-environment-command");
  process.stdout.write(canonicalJson(result));
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(canonicalJson({
      schema: "tinyrustlm.windows_x64_msvc_environment_error.v1",
      status: "error",
      code: safeErrorCode(error)
    }));
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  buildLayout,
  canonicalJson,
  materialize,
  parseVersion,
  parseVswhereOutput,
  prepareRequest,
  profileByteLength,
  profileId,
  profileSha256,
  publicBasisSchema,
  publicLockSchema,
  renderDocuments,
  requestSchema,
  safeErrorCode,
  selectInstance,
  summarySchema,
  terminalSchema,
  validateMaterialization,
  validateRequestShape,
  writeNewDurable
});
