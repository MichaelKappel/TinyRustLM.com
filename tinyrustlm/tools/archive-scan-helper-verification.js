#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const {
  archiveScanClientProfileId,
  archiveScanClientProfileSha256,
  archiveScanClientSourceClosureSha256,
  createArchiveScanClient
} = require("./archive-scan-client.js");
const { parseStrictJson } = require("./strict-json.js");
const { canonicalizeVnextJcsBytes } = require("./vnext-jcs.js");

const archiveScanHelperVerificationProfileId =
  "tinyrustlm.vnext.archive-scan-helper-verification.v1";
const archiveScanHelperVerificationProfileSha256 =
  "825c2b76c7a1a2bc53cd79db778018b1efcb963d3e95bd16f21a7f029f4edd42";
const verificationSchema =
  "tinyrustlm.vnext.archive_scan_helper_verification.v1";
const sha256Pattern = /^[a-f0-9]{64}$/u;
const safeCodePattern = /^[a-z][a-z0-9-]{2,79}$/u;
const safePathPattern = /^[A-Za-z0-9._/-]{1,1024}$/u;
const repositoryRoot = resolveRepositoryRoot();
const profilePath = path.join(
  repositoryRoot,
  "contracts",
  "vnext",
  "archive-scan-helper-verification-profile.v1.json"
);

function fail(code) {
  const error = new Error("Archive scan helper verification failed");
  error.code = code;
  throw error;
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function resolveRepositoryRoot() {
  const configured = Object.getOwnPropertyDescriptor(
    process.env,
    "TINYRUSTLM_REPOSITORY_ROOT"
  );
  const candidates = configured && "value" in configured && configured.value
    ? [configured.value]
    : [process.cwd(), path.resolve(process.cwd(), ".."), path.resolve(__dirname, "../..")];
  const matches = [];
  const identities = new Set();
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !path.isAbsolute(candidate) ||
        candidate.includes("\0")) {
      continue;
    }
    const normalized = path.normalize(candidate);
    const identity = process.platform === "win32"
      ? normalized.toLowerCase()
      : normalized;
    if (identities.has(identity)) continue;
    identities.add(identity);
    try {
      if (fs.lstatSync(path.join(normalized, "tinyrustlm", "package.json")).isFile() &&
          fs.lstatSync(path.join(normalized, "contracts", "vnext",
            "archive-scan-helper-verification-profile.v1.json")).isFile()) {
        matches.push(normalized);
      }
    } catch (_error) {
      // Only one complete source root is authoritative.
    }
  }
  if (matches.length !== 1) fail("archive_scan_verification_repository_root_invalid");
  return matches[0];
}

function assertDataObject(value, expectedKeys, code) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    fail(code);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  if (keys.join(",") !== [...expectedKeys].sort().join(",") ||
      keys.some((key) => !("value" in descriptors[key]) ||
        descriptors[key].get !== undefined || descriptors[key].set !== undefined)) {
    fail(code);
  }
}

function exactStringArray(value, expected, code) {
  if (!Array.isArray(value) || value.length !== expected.length ||
      value.some((entry, index) => entry !== expected[index])) {
    fail(code);
  }
}

function decodeCanonicalBase64(value, maximumBytes, expectedBytes, expectedSha256) {
  if (typeof value !== "string" || value.length === 0 || value.length > 16_384 ||
      !Number.isSafeInteger(expectedBytes) || expectedBytes < 0 ||
      expectedBytes > maximumBytes || !sha256Pattern.test(expectedSha256)) {
    fail("archive_scan_verification_profile_invalid");
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value || bytes.length !== expectedBytes ||
      sha256(bytes) !== expectedSha256) {
    fail("archive_scan_verification_profile_invalid");
  }
  return bytes;
}

function loadProfile() {
  let bytes;
  let profile;
  try {
    bytes = fs.readFileSync(profilePath);
    profile = parseStrictJson(bytes);
  } catch (_error) {
    fail("archive_scan_verification_profile_invalid");
  }
  if (sha256(bytes) !== archiveScanHelperVerificationProfileSha256) {
    fail("archive_scan_verification_profile_identity_mismatch");
  }
  assertDataObject(profile, [
    "acceptedPackageTrustClasses", "canonicalJsonProfile", "caseReceiptFields",
    "cases", "executionClass", "hashAlgorithm", "limits", "nonClaims",
    "pathPolicy", "profileId", "receiptFields", "receiptFile", "receiptPolicy",
    "schema", "scratchCleanup", "status", "vectorCaseFields",
    "vectorExpectedFields", "vectorMemberFields", "verdict", "verificationSchema",
    "verificationSourceClosureMembers", "versionPolicy"
  ], "archive_scan_verification_profile_invalid");
  const receiptFields = [
    "architecture", "buildProfile", "cases", "clientProfileId",
    "clientProfileSha256", "clientSourceClosureSha256", "executionClass",
    "executableByteCount", "executableSha256", "helperManifestSha256",
    "helperPackageBuilderSourceClosureSha256", "helperProvenanceSha256",
    "helperSourceClosureSha256", "helperSourceRevision",
    "helperSourceWorktreeClean", "nodeVersion", "operatingSystem", "profileId",
    "profileSha256", "runtimeIdentifier", "schema", "scratchCleanup",
    "trustClass", "verdict", "verificationSourceClosureSha256"
  ];
  const caseReceiptFields = [
    "archiveByteCount", "archiveSha256", "caseId", "contentManifestSha256",
    "format", "memberCount", "totalContentBytes"
  ];
  const vectorCaseFields = [
    "archiveBase64", "archiveByteCount", "archiveSha256", "caseId", "expected",
    "fileName", "format"
  ];
  const vectorExpectedFields = [
    "contentManifestSha256", "memberCount", "members", "totalContentBytes"
  ];
  const vectorMemberFields = [
    "contentBase64", "contentByteCount", "contentSha256", "path"
  ];
  if (profile.schema !==
        "tinyrustlm.vnext.archive_scan_helper_verification_profile.v1" ||
      profile.profileId !== archiveScanHelperVerificationProfileId ||
      profile.status !== "frozen" ||
      profile.versionPolicy !== "single-current-profile-no-compatibility-reader" ||
      profile.canonicalJsonProfile !==
        "rfc8785-jcs+tinyrustlm.strict-json.v1" ||
      profile.hashAlgorithm !== "sha256" ||
      profile.verificationSchema !== verificationSchema ||
      profile.receiptFile !== "archive-scan-helper-verification.v1.json" ||
      profile.executionClass !== "native-package-fixed-vector-replay" ||
      profile.scratchCleanup !== "completed-before-receipt" ||
      profile.verdict !== "pass") {
    fail("archive_scan_verification_profile_invalid");
  }
  exactStringArray(profile.acceptedPackageTrustClasses,
    ["local-test-build", "release-package"],
    "archive_scan_verification_profile_invalid");
  exactStringArray(profile.verificationSourceClosureMembers, [
    "contracts/vnext/archive-scan-helper-verification-profile.v1.json",
    "tinyrustlm/tools/archive-scan-helper-verification.js",
    "tinyrustlm/tools/strict-json.js",
    "tinyrustlm/tools/vnext-jcs.js"
  ], "archive_scan_verification_profile_invalid");
  exactStringArray(profile.receiptFields, receiptFields,
    "archive_scan_verification_profile_invalid");
  exactStringArray(profile.caseReceiptFields, caseReceiptFields,
    "archive_scan_verification_profile_invalid");
  exactStringArray(profile.vectorCaseFields, vectorCaseFields,
    "archive_scan_verification_profile_invalid");
  exactStringArray(profile.vectorExpectedFields, vectorExpectedFields,
    "archive_scan_verification_profile_invalid");
  exactStringArray(profile.vectorMemberFields, vectorMemberFields,
    "archive_scan_verification_profile_invalid");
  assertDataObject(profile.limits, [
    "maximumReceiptBytes", "maximumSourceMemberBytes", "maximumVectorArchiveBytes",
    "maximumVectorCases", "maximumVectorContentBytes", "maximumVectorMembersPerCase"
  ], "archive_scan_verification_profile_invalid");
  if (profile.limits.maximumReceiptBytes !== 32_768 ||
      profile.limits.maximumSourceMemberBytes !== 16_777_216 ||
      profile.limits.maximumVectorArchiveBytes !== 4_096 ||
      profile.limits.maximumVectorCases !== 2 ||
      profile.limits.maximumVectorContentBytes !== 4_096 ||
      profile.limits.maximumVectorMembersPerCase !== 4 ||
      !Array.isArray(profile.cases) ||
      profile.cases.length !== profile.limits.maximumVectorCases) {
    fail("archive_scan_verification_profile_invalid");
  }
  assertDataObject(profile.pathPolicy, [
    "configuration", "linksAndReparsePoints", "outputRoot", "packageRoot",
    "scratchRoot", "scratchWorktree"
  ], "archive_scan_verification_profile_invalid");
  assertDataObject(profile.receiptPolicy, [
    "canonicalJcsRequired", "fileFsyncRequired", "pathDisclosureForbidden",
    "rawProcessOutputForbidden", "readbackRequired", "timestampOmitted"
  ], "archive_scan_verification_profile_invalid");
  if (profile.pathPolicy.configuration !==
        "explicit-absolute-package-output-and-scratch-roots" ||
      profile.pathPolicy.linksAndReparsePoints !==
        "reject-where-host-api-exposes-them" ||
      profile.pathPolicy.outputRoot !==
        "create-only-after-all-replays-and-scratch-cleanup" ||
      profile.pathPolicy.packageRoot !==
        "read-only-through-frozen-archive-scan-client" ||
      profile.pathPolicy.scratchRoot !== "caller-owned-existing-directory" ||
      profile.pathPolicy.scratchWorktree !==
        "one-tool-owned-unique-child-removed-before-receipt" ||
      profile.receiptPolicy.canonicalJcsRequired !== true ||
      profile.receiptPolicy.fileFsyncRequired !== true ||
      profile.receiptPolicy.pathDisclosureForbidden !== true ||
      profile.receiptPolicy.rawProcessOutputForbidden !== true ||
      profile.receiptPolicy.readbackRequired !== true ||
      profile.receiptPolicy.timestampOmitted !==
        "deterministic-replay-record-does-not-claim-observation-time" ||
      !Array.isArray(profile.nonClaims) || profile.nonClaims.length !== 5 ||
      profile.nonClaims.some((entry) => typeof entry !== "string" ||
        entry.length < 20 || entry.length > 256 || /[\u0000-\u001f\u007f]/u.test(entry))) {
    fail("archive_scan_verification_profile_invalid");
  }
  const cases = profile.cases.map((entry) => {
    assertDataObject(entry, vectorCaseFields,
      "archive_scan_verification_profile_invalid");
    assertDataObject(entry.expected, vectorExpectedFields,
      "archive_scan_verification_profile_invalid");
    if (!safeCodePattern.test(entry.caseId) ||
        !["zip", "tar-gzip"].includes(entry.format) ||
        typeof entry.fileName !== "string" ||
        path.basename(entry.fileName) !== entry.fileName ||
        !entry.fileName.endsWith(entry.format === "zip" ? ".zip" : ".tar.gz") ||
        !Number.isSafeInteger(entry.expected.memberCount) ||
        !Number.isSafeInteger(entry.expected.totalContentBytes) ||
        !sha256Pattern.test(entry.expected.contentManifestSha256) ||
        !Array.isArray(entry.expected.members) ||
        entry.expected.members.length !== entry.expected.memberCount ||
        entry.expected.members.length === 0 ||
        entry.expected.members.length > profile.limits.maximumVectorMembersPerCase) {
      fail("archive_scan_verification_profile_invalid");
    }
    const archiveBytes = decodeCanonicalBase64(
      entry.archiveBase64,
      profile.limits.maximumVectorArchiveBytes,
      entry.archiveByteCount,
      entry.archiveSha256
    );
    let totalContentBytes = 0;
    const members = entry.expected.members.map((member) => {
      assertDataObject(member, vectorMemberFields,
        "archive_scan_verification_profile_invalid");
      if (typeof member.path !== "string" || !safePathPattern.test(member.path) ||
          member.path.includes("\\") || member.path.startsWith("/") ||
          member.path.split("/").some((part) => !part || part === "." || part === "..")) {
        fail("archive_scan_verification_profile_invalid");
      }
      const contentBytes = decodeCanonicalBase64(
        member.contentBase64,
        profile.limits.maximumVectorContentBytes,
        member.contentByteCount,
        member.contentSha256
      );
      totalContentBytes += contentBytes.length;
      return Object.freeze({
        contentBytes,
        contentByteCount: member.contentByteCount,
        contentSha256: member.contentSha256,
        path: member.path
      });
    });
    if (totalContentBytes !== entry.expected.totalContentBytes) {
      fail("archive_scan_verification_profile_invalid");
    }
    return Object.freeze({
      archiveByteCount: entry.archiveByteCount,
      archiveBytes,
      archiveSha256: entry.archiveSha256,
      caseId: entry.caseId,
      contentManifestSha256: entry.expected.contentManifestSha256,
      fileName: entry.fileName,
      format: entry.format,
      memberCount: entry.expected.memberCount,
      members: Object.freeze(members),
      totalContentBytes: entry.expected.totalContentBytes
    });
  });
  const caseIds = cases.map((entry) => entry.caseId);
  if (caseIds.join(",") !== [...caseIds].sort().join(",") ||
      new Set(caseIds).size !== caseIds.length ||
      new Set(cases.map((entry) => entry.format)).size !== 2) {
    fail("archive_scan_verification_profile_invalid");
  }
  return Object.freeze({ ...profile, cases: Object.freeze(cases) });
}

const profile = loadProfile();

function normalizeAbsolutePath(value, code) {
  if (typeof value !== "string" || value.length < 3 || value.length > 4_096 ||
      value.includes("\0") || !path.isAbsolute(value) ||
      path.resolve(value) !== path.normalize(value)) {
    fail(code);
  }
  const resolved = path.resolve(value);
  if (process.platform === "win32" &&
      !/^[A-Za-z]:\\$/u.test(path.parse(resolved).root)) {
    fail(code);
  }
  return resolved;
}

function assertNoLinkComponents(target, leafKind) {
  const parsed = path.parse(target);
  const parts = target.slice(parsed.root.length).split(path.sep).filter(Boolean);
  let current = parsed.root;
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (_error) {
      fail("archive_scan_verification_path_invalid");
    }
    if (stat.isSymbolicLink()) fail("archive_scan_verification_path_link");
    const leaf = index === parts.length - 1;
    if ((!leaf || leafKind === "directory") && !stat.isDirectory()) {
      fail("archive_scan_verification_path_invalid");
    }
    if (leaf && leafKind === "file" && !stat.isFile()) {
      fail("archive_scan_verification_path_invalid");
    }
  }
}

function pathIdentity(value) {
  return process.platform === "win32" ? value.toLowerCase() : value;
}

function pathsOverlap(left, right) {
  const leftIdentity = pathIdentity(left);
  const rightIdentity = pathIdentity(right);
  if (leftIdentity === rightIdentity) return true;
  const leftRelative = path.relative(leftIdentity, rightIdentity);
  const rightRelative = path.relative(rightIdentity, leftIdentity);
  return (leftRelative && !leftRelative.startsWith("..") &&
      !path.isAbsolute(leftRelative)) ||
    (rightRelative && !rightRelative.startsWith("..") &&
      !path.isAbsolute(rightRelative));
}

function hashRegularFile(filePath, maximumBytes, code) {
  let descriptor;
  try {
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0 ||
        stat.size > maximumBytes) {
      fail(code);
    }
    descriptor = fs.openSync(filePath,
      Number(fs.constants.O_RDONLY) | Number(fs.constants.O_NOFOLLOW || 0));
    const hash = crypto.createHash("sha256");
    const buffer = Buffer.allocUnsafe(65_536);
    let byteCount = 0;
    while (byteCount < stat.size) {
      const count = fs.readSync(descriptor, buffer, 0,
        Math.min(buffer.length, stat.size - byteCount), byteCount);
      if (count <= 0) fail(code);
      hash.update(buffer.subarray(0, count));
      byteCount += count;
    }
    const after = fs.fstatSync(descriptor);
    if (after.size !== stat.size || after.mtimeMs !== stat.mtimeMs ||
        after.ctimeMs !== stat.ctimeMs) {
      fail(code);
    }
    return Object.freeze({ byteCount, sha256: hash.digest("hex") });
  } catch (error) {
    if (error?.code === code) throw error;
    fail(code);
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch (_error) {
        // The bounded file identity or failure is already authoritative.
      }
    }
  }
}

function verificationSourceClosureSha256() {
  const members = profile.verificationSourceClosureMembers.map((relativePath) => {
    const filePath = path.resolve(repositoryRoot, ...relativePath.split("/"));
    if (path.relative(repositoryRoot, filePath).startsWith("..")) {
      fail("archive_scan_verification_source_invalid");
    }
    const identity = hashRegularFile(
      filePath,
      profile.limits.maximumSourceMemberBytes,
      "archive_scan_verification_source_invalid"
    );
    return Object.freeze({
      byteCount: identity.byteCount,
      path: relativePath,
      sha256: identity.sha256
    });
  });
  return sha256(canonicalizeVnextJcsBytes(members));
}

function writeExclusive(filePath, bytes) {
  let descriptor;
  try {
    descriptor = fs.openSync(filePath, "wx", 0o600);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.writeSync(descriptor, bytes, offset, bytes.length - offset, offset);
      if (count <= 0) fail("archive_scan_verification_write_failed");
      offset += count;
    }
    fs.fsyncSync(descriptor);
  } catch (error) {
    if (error?.code === "archive_scan_verification_write_failed") throw error;
    fail("archive_scan_verification_write_failed");
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch (_error) {
        // The exact write or typed failure is already authoritative.
      }
    }
  }
}

function compareObservedMembers(observed, expected) {
  if (observed.length !== expected.length) {
    fail("archive_scan_verification_result_mismatch");
  }
  for (let index = 0; index < expected.length; index += 1) {
    const actual = observed[index];
    const wanted = expected[index];
    if (actual.path !== wanted.path || actual.content.length !== wanted.contentByteCount ||
        sha256(actual.content) !== wanted.contentSha256 ||
        !actual.content.equals(wanted.contentBytes)) {
      fail("archive_scan_verification_result_mismatch");
    }
  }
}

async function replayCase(client, scratchWorktree, vector) {
  const archivePath = path.join(scratchWorktree, vector.fileName);
  writeExclusive(archivePath, vector.archiveBytes);
  const observed = [];
  let current = null;
  const result = await client.scan({
    archivePath,
    format: vector.format,
    onContent(chunk) {
      if (current === null) fail("archive_scan_verification_result_mismatch");
      current.chunks.push(Buffer.from(chunk));
    },
    onMemberEnd() {
      if (current === null) fail("archive_scan_verification_result_mismatch");
      observed.push(Object.freeze({
        content: Buffer.concat(current.chunks),
        path: current.path
      }));
      current = null;
    },
    onMemberStart(member) {
      if (current !== null || !member || typeof member.path !== "string") {
        fail("archive_scan_verification_result_mismatch");
      }
      current = { chunks: [], path: member.path };
    }
  });
  if (current !== null || result.archiveSha256 !== vector.archiveSha256 ||
      result.contentManifestSha256 !== vector.contentManifestSha256 ||
      result.memberCount !== vector.memberCount ||
      result.totalContentBytes !== vector.totalContentBytes ||
      result.executableSha256 !== client.packageIdentity.executableSha256 ||
      result.executableByteCount !== client.packageIdentity.executableByteCount) {
    fail("archive_scan_verification_result_mismatch");
  }
  compareObservedMembers(observed, vector.members);
  return Object.freeze({
    archiveByteCount: vector.archiveByteCount,
    archiveSha256: vector.archiveSha256,
    caseId: vector.caseId,
    contentManifestSha256: vector.contentManifestSha256,
    format: vector.format,
    memberCount: vector.memberCount,
    totalContentBytes: vector.totalContentBytes
  });
}

async function verifyArchiveScanHelperPackage(options) {
  assertDataObject(options, ["outputRoot", "packageRoot", "scratchRoot"],
    "archive_scan_verification_options_invalid");
  const packageRoot = normalizeAbsolutePath(
    options.packageRoot,
    "archive_scan_verification_options_invalid"
  );
  const outputRoot = normalizeAbsolutePath(
    options.outputRoot,
    "archive_scan_verification_options_invalid"
  );
  const scratchRoot = normalizeAbsolutePath(
    options.scratchRoot,
    "archive_scan_verification_options_invalid"
  );
  if (fs.existsSync(outputRoot)) fail("archive_scan_verification_output_exists");
  assertNoLinkComponents(packageRoot, "directory");
  assertNoLinkComponents(path.dirname(outputRoot), "directory");
  assertNoLinkComponents(scratchRoot, "directory");
  if (pathsOverlap(packageRoot, outputRoot) || pathsOverlap(packageRoot, scratchRoot) ||
      pathsOverlap(outputRoot, scratchRoot)) {
    fail("archive_scan_verification_path_overlap");
  }

  const client = createArchiveScanClient(packageRoot);
  if (!profile.acceptedPackageTrustClasses.includes(client.packageIdentity.trustClass)) {
    fail("archive_scan_verification_package_invalid");
  }
  const sourceClosureSha256 = verificationSourceClosureSha256();
  let scratchWorktree;
  let caseReceipts;
  try {
    try {
      scratchWorktree = fs.mkdtempSync(path.join(
        scratchRoot,
        "tinyrustlm-archive-scan-verification-"
      ));
    } catch (_error) {
      fail("archive_scan_verification_scratch_create_failed");
    }
    assertNoLinkComponents(scratchWorktree, "directory");
    caseReceipts = [];
    for (const vector of profile.cases) {
      caseReceipts.push(await replayCase(client, scratchWorktree, vector));
    }
  } finally {
    if (scratchWorktree !== undefined) {
      try {
        const relative = path.relative(scratchRoot, scratchWorktree);
        if (!relative || relative.startsWith("..") || path.isAbsolute(relative) ||
            relative.includes(path.sep)) {
          fail("archive_scan_verification_scratch_cleanup_failed");
        }
        fs.rmSync(scratchWorktree, { force: true, recursive: true });
        if (fs.existsSync(scratchWorktree)) {
          fail("archive_scan_verification_scratch_cleanup_failed");
        }
      } catch (error) {
        if (error?.code === "archive_scan_verification_scratch_cleanup_failed") {
          throw error;
        }
        fail("archive_scan_verification_scratch_cleanup_failed");
      }
    }
  }

  const identity = client.packageIdentity;
  const receipt = Object.freeze({
    architecture: identity.architecture,
    buildProfile: identity.buildProfile,
    cases: Object.freeze(caseReceipts),
    clientProfileId: archiveScanClientProfileId,
    clientProfileSha256: archiveScanClientProfileSha256,
    clientSourceClosureSha256: archiveScanClientSourceClosureSha256,
    executionClass: profile.executionClass,
    executableByteCount: identity.executableByteCount,
    executableSha256: identity.executableSha256,
    helperManifestSha256: identity.helperManifestSha256,
    helperPackageBuilderSourceClosureSha256:
      identity.helperPackageBuilderSourceClosureSha256,
    helperProvenanceSha256: identity.helperProvenanceSha256,
    helperSourceClosureSha256: identity.helperSourceClosureSha256,
    helperSourceRevision: identity.helperSourceRevision,
    helperSourceWorktreeClean: identity.helperSourceWorktreeClean,
    nodeVersion: process.version,
    operatingSystem: identity.operatingSystem,
    profileId: archiveScanHelperVerificationProfileId,
    profileSha256: archiveScanHelperVerificationProfileSha256,
    runtimeIdentifier: identity.runtimeIdentifier,
    schema: profile.verificationSchema,
    scratchCleanup: profile.scratchCleanup,
    trustClass: identity.trustClass,
    verdict: profile.verdict,
    verificationSourceClosureSha256: sourceClosureSha256
  });
  if (!/^v\d+\.\d+\.\d+$/u.test(receipt.nodeVersion) ||
      Object.keys(receipt).join(",") !== profile.receiptFields.join(",") ||
      receipt.cases.some((entry) =>
        Object.keys(entry).join(",") !== profile.caseReceiptFields.join(","))) {
    fail("archive_scan_verification_receipt_invalid");
  }
  const receiptBytes = canonicalizeVnextJcsBytes(receipt);
  if (receiptBytes.length <= 0 ||
      receiptBytes.length > profile.limits.maximumReceiptBytes) {
    fail("archive_scan_verification_receipt_invalid");
  }

  let ownsOutputRoot = false;
  try {
    try {
      fs.mkdirSync(outputRoot, { mode: 0o700, recursive: false });
    } catch (_error) {
      fail("archive_scan_verification_output_create_failed");
    }
    ownsOutputRoot = true;
    const receiptPath = path.join(outputRoot, profile.receiptFile);
    writeExclusive(receiptPath, receiptBytes);
    let entries;
    let receiptReadback;
    try {
      entries = fs.readdirSync(outputRoot);
      receiptReadback = fs.readFileSync(receiptPath);
    } catch (_error) {
      fail("archive_scan_verification_readback_failed");
    }
    if (entries.length !== 1 || entries[0] !== profile.receiptFile ||
        !receiptReadback.equals(receiptBytes)) {
      fail("archive_scan_verification_readback_failed");
    }
    return Object.freeze({
      outputRoot,
      receiptByteCount: receiptBytes.length,
      receiptSha256: sha256(receiptBytes),
      runtimeIdentifier: identity.runtimeIdentifier
    });
  } catch (error) {
    if (ownsOutputRoot) {
      try {
        const relative = path.relative(path.dirname(outputRoot), outputRoot);
        if (relative && !relative.startsWith("..") && !path.isAbsolute(relative) &&
            !relative.includes(path.sep)) {
          fs.rmSync(outputRoot, { force: true, recursive: true });
        }
      } catch (_cleanupError) {
        // The original bounded verification failure remains authoritative.
      }
    }
    throw error;
  }
}

async function main() {
  const [packageRoot, outputRoot, scratchRoot, ...extra] = process.argv.slice(2);
  if (!packageRoot || !outputRoot || !scratchRoot || extra.length !== 0) {
    fail("archive_scan_verification_cli_invalid");
  }
  const result = await verifyArchiveScanHelperPackage({
    outputRoot,
    packageRoot,
    scratchRoot
  });
  process.stdout.write(`${JSON.stringify({
    receiptByteCount: result.receiptByteCount,
    receiptSha256: result.receiptSha256,
    runtimeIdentifier: result.runtimeIdentifier
  })}\n`);
}

if (require.main === module) {
  main().catch(() => {
    process.stderr.write("TinyRustLM archive scan helper verification failed\n");
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  archiveScanHelperVerificationProfileId,
  archiveScanHelperVerificationProfileSha256,
  verifyArchiveScanHelperPackage
});
