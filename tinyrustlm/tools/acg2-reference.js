"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts/vnext/acg2-format-profile.v1.json");
const vectorPath = path.join(repositoryRoot, "contracts/vnext/acg2-format-vectors.v1.json");

const PROFILE_ID = "org.minimodel.acg2/2.0";
const PROFILE_SHA256 = "944ed9b5b0ee2605ebb9ac13f2e5388c181bc857fdbfc082e62e9ae7b07c79be";
const MAGIC = Buffer.from([0x41, 0x43, 0x47, 0x32, 0x0d, 0x0a, 0x1a, 0x0a]);
const FORMAT_ID = Buffer.from("minimodel.acg2\0\0", "ascii");
const GRAPH_DOMAIN = Buffer.from("tinyrustlm.acg2.champion-graph.v1\0", "ascii");
const FILE_BYTES = 896;
const HEADER_BYTES = 256;
const MEMBER_COUNT = 5;
const MEMBER_RECORD_BYTES = 128;
const MEMBER_TABLE_OFFSET = 256;
const MEMBER_TABLE_BYTES = 640;
const STREAM_HASH_BUFFER_BYTES = 1_048_576;
const MAXIMUM_RESOLVED_MEMBER_BYTES = 68_787_700_488;
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

const MEMBER_PROFILES = Object.freeze([
  Object.freeze({
    ordinal: 0,
    role: "model",
    roleCode: 1,
    format: "slm2",
    formatCode: 1,
    profileSha256: "5ac819cb31a17a64bec0d5492962a4baf0bd2778f6213b87c85c0a04f3a738d8",
    maximumArtifactBytes: 68_719_476_736
  }),
  Object.freeze({
    ordinal: 1,
    role: "tokenizer",
    roleCode: 2,
    format: "tokenizer2",
    formatCode: 2,
    profileSha256: "628427bf6e7f8d34ed14b331a5c636606aee9d5ef45a36a3cadc13338669b8de",
    maximumArtifactBytes: 67_108_864
  }),
  Object.freeze({
    ordinal: 2,
    role: "template",
    roleCode: 3,
    format: "template2",
    formatCode: 3,
    profileSha256: "14ff1df8dd6760119ac36e719ab396fff8e71d0719c2e1c83118f58693ea7bfa",
    maximumArtifactBytes: 1_048_576
  }),
  Object.freeze({
    ordinal: 3,
    role: "sampling",
    roleCode: 4,
    format: "sampling2",
    formatCode: 4,
    profileSha256: "ec65e8f1a54c1e4ca95ebda88bde091dad11337250e541bbda60e8cac311428d",
    maximumArtifactBytes: 65_800
  }),
  Object.freeze({
    ordinal: 4,
    role: "prompt",
    roleCode: 5,
    format: "prompt2",
    formatCode: 5,
    profileSha256: "f9eb4cbecfb52f5e2857216c999754da94021a5427a86732d33fe15efc0d062c",
    maximumArtifactBytes: 512
  })
]);

const CANONICAL_MEMBERS = Object.freeze([
  Object.freeze({
    ordinal: 0,
    role: "model",
    format: "slm2",
    artifactBytes: 8_704,
    artifactSha256: "4383b112797b99232561b67bdc752d8ea0e62e90e24f8b94fd629c563e2d1502",
    formatProfileSha256: MEMBER_PROFILES[0].profileSha256
  }),
  Object.freeze({
    ordinal: 1,
    role: "tokenizer",
    format: "tokenizer2",
    artifactBytes: 7_038_773,
    artifactSha256: "cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b",
    formatProfileSha256: MEMBER_PROFILES[1].profileSha256
  }),
  Object.freeze({
    ordinal: 2,
    role: "template",
    format: "template2",
    artifactBytes: 1_403,
    artifactSha256: "5300b0b43188a8c73ed62e7e4fbab6eff358ae0395166791852b072a8009c9c8",
    formatProfileSha256: MEMBER_PROFILES[2].profileSha256
  }),
  Object.freeze({
    ordinal: 3,
    role: "sampling",
    format: "sampling2",
    artifactBytes: 65_800,
    artifactSha256: "9e02fcfbba169330a2ee1bf40cea015dc4067925e051f6ae5f197a5f880bfe89",
    formatProfileSha256: MEMBER_PROFILES[3].profileSha256
  }),
  Object.freeze({
    ordinal: 4,
    role: "prompt",
    format: "prompt2",
    artifactBytes: 512,
    artifactSha256: "27aaed18b62930213a2395e398e68d18a90d4280e24c23d794e3e94352d7e1f3",
    formatProfileSha256: MEMBER_PROFILES[4].profileSha256
  })
]);

class Acg2Error extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function fail(code) {
  throw new Acg2Error(code);
}

function invariant(condition, code) {
  if (!condition) fail(code);
}

function sha256(...parts) {
  const hasher = crypto.createHash("sha256");
  parts.forEach((part) => hasher.update(part));
  return hasher.digest();
}

function sha256Hex(...parts) {
  return sha256(...parts).toString("hex");
}

function ensureRange(bytes, offset, length, code = "acg2-header") {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length)
      || offset < 0 || length < 0 || offset + length > bytes.length) fail(code);
}

function readU16(bytes, offset) {
  ensureRange(bytes, offset, 2);
  return bytes.readUInt16LE(offset);
}

function readU32(bytes, offset) {
  ensureRange(bytes, offset, 4);
  return bytes.readUInt32LE(offset);
}

function readU64(bytes, offset) {
  ensureRange(bytes, offset, 8);
  const value = bytes.readBigUInt64LE(offset);
  if (value > MAX_SAFE_BIGINT) fail("acg2-arithmetic");
  return Number(value);
}

function checkedAdd(left, right) {
  const result = left + right;
  invariant(Number.isSafeInteger(result) && result >= 0, "acg2-arithmetic");
  return result;
}

function exactHex(value, code) {
  invariant(typeof value === "string" && /^[0-9a-f]{64}$/u.test(value), code);
  const bytes = Buffer.from(value, "hex");
  invariant(bytes.some((byte) => byte !== 0), code);
  return bytes;
}

function allZero(bytes) {
  return bytes.every((byte) => byte === 0);
}

function memberProfileFor(index) {
  const profile = MEMBER_PROFILES[index];
  invariant(profile !== undefined, "acg2-member-order");
  return profile;
}

function normalizeMember(member, index) {
  const expected = memberProfileFor(index);
  invariant(member && typeof member === "object" && !Array.isArray(member),
    "acg2-member-record");
  invariant(member.ordinal === expected.ordinal && member.role === expected.role
    && member.format === expected.format, "acg2-member-order");
  invariant(Number.isSafeInteger(member.artifactBytes) && member.artifactBytes > 0
    && member.artifactBytes <= expected.maximumArtifactBytes, "acg2-member-length");
  const artifactSha256 = exactHex(member.artifactSha256, "acg2-member-identity");
  invariant(member.formatProfileSha256 === expected.profileSha256,
    "acg2-member-profile");
  return Object.freeze({
    ordinal: expected.ordinal,
    role: expected.role,
    roleCode: expected.roleCode,
    format: expected.format,
    formatCode: expected.formatCode,
    artifactBytes: member.artifactBytes,
    artifactSha256,
    artifactSha256Hex: artifactSha256.toString("hex"),
    formatProfileSha256: Buffer.from(expected.profileSha256, "hex"),
    formatProfileSha256Hex: expected.profileSha256
  });
}

function normalizeMembers(members) {
  invariant(Array.isArray(members) && members.length === MEMBER_COUNT, "acg2-member-order");
  let resolvedMemberBytes = 0;
  const normalized = members.map((member, index) => {
    const value = normalizeMember(member, index);
    resolvedMemberBytes = checkedAdd(resolvedMemberBytes, value.artifactBytes);
    return value;
  });
  invariant(resolvedMemberBytes <= MAXIMUM_RESOLVED_MEMBER_BYTES, "acg2-arithmetic");
  return { members: normalized, resolvedMemberBytes };
}

function graphIdentity(memberTable, resolvedMemberBytes) {
  const framing = Buffer.alloc(2 + 2 + 1 + 4 + 8);
  framing.writeUInt16LE(2, 0);
  framing.writeUInt16LE(0, 2);
  framing.writeUInt8(1, 4);
  framing.writeUInt32LE(MEMBER_COUNT, 5);
  framing.writeBigUInt64LE(BigInt(resolvedMemberBytes), 9);
  return sha256(GRAPH_DOMAIN, framing, memberTable);
}

function writeGraph(inputMembers) {
  validateProfileIdentity();
  const normalized = normalizeMembers(inputMembers);
  const artifact = Buffer.alloc(FILE_BYTES);
  artifact.set(MAGIC, 0);
  artifact.set(FORMAT_ID, 8);
  artifact.writeUInt16LE(2, 24);
  artifact.writeUInt16LE(0, 26);
  artifact.writeUInt8(1, 28);
  artifact.writeUInt8(1, 29);
  artifact.writeUInt16LE(0, 30);
  artifact.writeUInt32LE(HEADER_BYTES, 32);
  artifact.writeUInt32LE(MEMBER_COUNT, 36);
  artifact.writeUInt32LE(MEMBER_RECORD_BYTES, 40);
  artifact.writeBigUInt64LE(BigInt(FILE_BYTES), 48);
  artifact.writeBigUInt64LE(BigInt(MEMBER_TABLE_OFFSET), 56);
  artifact.writeBigUInt64LE(BigInt(MEMBER_TABLE_BYTES), 64);
  artifact.writeBigUInt64LE(BigInt(normalized.resolvedMemberBytes), 72);

  normalized.members.forEach((member, index) => {
    const offset = MEMBER_TABLE_OFFSET + index * MEMBER_RECORD_BYTES;
    artifact.writeUInt16LE(1, offset);
    artifact.writeUInt16LE(member.roleCode, offset + 2);
    artifact.writeUInt16LE(member.formatCode, offset + 4);
    artifact.writeUInt16LE(0, offset + 6);
    artifact.writeUInt32LE(member.ordinal, offset + 8);
    artifact.writeBigUInt64LE(BigInt(member.artifactBytes), offset + 16);
    artifact.set(member.artifactSha256, offset + 24);
    artifact.set(member.formatProfileSha256, offset + 56);
  });

  const memberTable = artifact.subarray(MEMBER_TABLE_OFFSET, FILE_BYTES);
  artifact.set(graphIdentity(memberTable, normalized.resolvedMemberBytes), 80);
  artifact.set(sha256(memberTable), 112);
  const parsed = parseGraph(artifact);
  invariant(parsed.resolvedMemberBytes === normalized.resolvedMemberBytes, "acg2-arithmetic");
  return artifact;
}

function parseGraph(input, maximumArtifactBytes = FILE_BYTES) {
  validateProfileIdentity();
  invariant(Number.isSafeInteger(maximumArtifactBytes) && maximumArtifactBytes > 0
    && maximumArtifactBytes <= FILE_BYTES, "acg2-policy");
  const bytes = Buffer.from(input);
  if (bytes.length > maximumArtifactBytes || bytes.length > FILE_BYTES) {
    fail("acg2-artifact-limit");
  }
  invariant(bytes.length === FILE_BYTES, "acg2-header");
  invariant(bytes.subarray(0, 8).equals(MAGIC)
    && bytes.subarray(8, 24).equals(FORMAT_ID)
    && readU16(bytes, 24) === 2
    && readU16(bytes, 26) === 0
    && bytes[28] === 1
    && bytes[29] === 1
    && readU16(bytes, 30) === 0, "acg2-header");
  invariant(allZero(bytes.subarray(44, 48)) && allZero(bytes.subarray(144, 256)),
    "acg2-reserved");
  invariant(readU32(bytes, 32) === HEADER_BYTES
    && readU32(bytes, 36) === MEMBER_COUNT
    && readU32(bytes, 40) === MEMBER_RECORD_BYTES
    && readU64(bytes, 48) === FILE_BYTES
    && readU64(bytes, 56) === MEMBER_TABLE_OFFSET
    && readU64(bytes, 64) === MEMBER_TABLE_BYTES, "acg2-layout");

  let resolvedMemberBytes = 0;
  const members = [];
  for (let index = 0; index < MEMBER_COUNT; index += 1) {
    const offset = MEMBER_TABLE_OFFSET + index * MEMBER_RECORD_BYTES;
    const expected = memberProfileFor(index);
    invariant(readU16(bytes, offset) === 1 && readU16(bytes, offset + 6) === 0,
      "acg2-member-record");
    invariant(readU16(bytes, offset + 2) === expected.roleCode
      && readU16(bytes, offset + 4) === expected.formatCode
      && readU32(bytes, offset + 8) === expected.ordinal, "acg2-member-order");
    invariant(allZero(bytes.subarray(offset + 12, offset + 16))
      && allZero(bytes.subarray(offset + 88, offset + 128)), "acg2-member-record");
    const artifactBytes = readU64(bytes, offset + 16);
    invariant(artifactBytes > 0 && artifactBytes <= expected.maximumArtifactBytes,
      "acg2-member-length");
    const artifactSha256 = bytes.subarray(offset + 24, offset + 56);
    invariant(!allZero(artifactSha256), "acg2-member-identity");
    const profileSha256 = bytes.subarray(offset + 56, offset + 88);
    invariant(profileSha256.equals(Buffer.from(expected.profileSha256, "hex")),
      "acg2-member-profile");
    resolvedMemberBytes = checkedAdd(resolvedMemberBytes, artifactBytes);
    members.push(Object.freeze({
      ordinal: expected.ordinal,
      role: expected.role,
      roleCode: expected.roleCode,
      format: expected.format,
      formatCode: expected.formatCode,
      artifactBytes,
      artifactSha256: artifactSha256.toString("hex"),
      formatProfileSha256: profileSha256.toString("hex")
    }));
  }
  invariant(resolvedMemberBytes <= MAXIMUM_RESOLVED_MEMBER_BYTES
    && readU64(bytes, 72) === resolvedMemberBytes, "acg2-arithmetic");
  const memberTable = bytes.subarray(MEMBER_TABLE_OFFSET, FILE_BYTES);
  const memberTableSha256 = sha256(memberTable);
  invariant(bytes.subarray(112, 144).equals(memberTableSha256),
    "acg2-member-table-hash");
  const derivedGraphIdentity = graphIdentity(memberTable, resolvedMemberBytes);
  invariant(bytes.subarray(80, 112).equals(derivedGraphIdentity), "acg2-graph-identity");
  return Object.freeze({
    profileId: PROFILE_ID,
    artifactBytes: bytes.length,
    artifactSha256: sha256Hex(bytes),
    graphIdentitySha256: derivedGraphIdentity.toString("hex"),
    memberTableSha256: memberTableSha256.toString("hex"),
    resolvedMemberBytes,
    members: Object.freeze(members)
  });
}

function validateProfileIdentity() {
  invariant(fs.existsSync(profilePath), "acg2-profile-drift");
  const bytes = fs.readFileSync(profilePath);
  invariant(sha256Hex(bytes) === PROFILE_SHA256, "acg2-profile-drift");
  let profile;
  try {
    profile = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("acg2-profile-drift");
  }
  invariant(profile.profileId === PROFILE_ID && profile.status === "implemented-unpromoted",
    "acg2-profile-drift");
}

function applyMutation(input, mutation) {
  const bytes = Buffer.from(input);
  const operation = mutation.operation;
  invariant(operation && Number.isSafeInteger(operation.offset) && operation.offset >= 0,
    "acg2-vector-operation");
  switch (operation.kind) {
    case "xor-byte":
      ensureRange(bytes, operation.offset, 1, "acg2-vector-operation");
      bytes[operation.offset] ^= operation.value;
      return bytes;
    case "set-u8":
      ensureRange(bytes, operation.offset, 1, "acg2-vector-operation");
      bytes.writeUInt8(operation.value, operation.offset);
      return bytes;
    case "set-u16le":
      ensureRange(bytes, operation.offset, 2, "acg2-vector-operation");
      bytes.writeUInt16LE(operation.value, operation.offset);
      return bytes;
    case "set-u32le":
      ensureRange(bytes, operation.offset, 4, "acg2-vector-operation");
      bytes.writeUInt32LE(operation.value, operation.offset);
      return bytes;
    case "set-u64le":
      ensureRange(bytes, operation.offset, 8, "acg2-vector-operation");
      bytes.writeBigUInt64LE(BigInt(operation.value), operation.offset);
      return bytes;
    case "fill":
      invariant(Number.isSafeInteger(operation.bytes) && operation.bytes > 0,
        "acg2-vector-operation");
      ensureRange(bytes, operation.offset, operation.bytes, "acg2-vector-operation");
      bytes.fill(operation.value, operation.offset, operation.offset + operation.bytes);
      return bytes;
    case "append-byte":
      invariant(operation.offset === bytes.length, "acg2-vector-operation");
      return Buffer.concat([bytes, Buffer.from([operation.value])]);
    case "swap-records": {
      invariant(Number.isInteger(operation.otherOrdinal)
        && operation.otherOrdinal >= 0 && operation.otherOrdinal < MEMBER_COUNT,
      "acg2-vector-operation");
      const first = Buffer.from(bytes.subarray(operation.offset, operation.offset + MEMBER_RECORD_BYTES));
      const otherOffset = MEMBER_TABLE_OFFSET + operation.otherOrdinal * MEMBER_RECORD_BYTES;
      const second = Buffer.from(bytes.subarray(otherOffset, otherOffset + MEMBER_RECORD_BYTES));
      bytes.set(second, operation.offset);
      bytes.set(first, otherOffset);
      return bytes;
    }
    default:
      fail("acg2-vector-operation");
  }
}

function mutation(id, operation, expectedError) {
  return Object.freeze({ id, operation: Object.freeze(operation), expectedError });
}

function expectedError(bytes) {
  try {
    parseGraph(bytes);
  } catch (error) {
    if (error instanceof Acg2Error) return error.code;
    throw error;
  }
  fail("acg2-hostile-vector-admitted");
}

function registeredMutations(canonical) {
  const first = MEMBER_TABLE_OFFSET;
  const mutations = [
    mutation("header-magic", { kind: "xor-byte", offset: 0, value: 1 }, "acg2-header"),
    mutation("header-format-id", { kind: "xor-byte", offset: 8, value: 1 }, "acg2-header"),
    mutation("header-major", { kind: "set-u16le", offset: 24, value: 3 }, "acg2-header"),
    mutation("header-minor", { kind: "set-u16le", offset: 26, value: 1 }, "acg2-header"),
    mutation("header-byte-order", { kind: "set-u8", offset: 28, value: 2 }, "acg2-header"),
    mutation("header-artifact-class", { kind: "set-u8", offset: 29, value: 2 }, "acg2-header"),
    mutation("header-flags", { kind: "set-u16le", offset: 30, value: 1 }, "acg2-header"),
    mutation("header-bytes", { kind: "set-u32le", offset: 32, value: 255 }, "acg2-layout"),
    mutation("header-member-count", { kind: "set-u32le", offset: 36, value: 4 }, "acg2-layout"),
    mutation("header-record-bytes", { kind: "set-u32le", offset: 40, value: 127 }, "acg2-layout"),
    mutation("header-reserved-zero", { kind: "set-u8", offset: 44, value: 1 }, "acg2-reserved"),
    mutation("header-file-bytes", { kind: "set-u64le", offset: 48, value: 895 }, "acg2-layout"),
    mutation("header-table-offset", { kind: "set-u64le", offset: 56, value: 255 }, "acg2-layout"),
    mutation("header-table-bytes", { kind: "set-u64le", offset: 64, value: 639 }, "acg2-layout"),
    mutation("header-resolved-bytes", {
      kind: "set-u64le", offset: 72, value: 7_115_193
    }, "acg2-arithmetic"),
    mutation("header-graph-identity", { kind: "xor-byte", offset: 80, value: 1 },
      "acg2-graph-identity"),
    mutation("header-member-table-hash", { kind: "xor-byte", offset: 112, value: 1 },
      "acg2-member-table-hash"),
    mutation("header-reserved-tail", { kind: "set-u8", offset: 144, value: 1 },
      "acg2-reserved"),
    mutation("member-record-version", { kind: "set-u16le", offset: first, value: 2 },
      "acg2-member-record"),
    mutation("member-role", { kind: "set-u16le", offset: first + 2, value: 2 },
      "acg2-member-order"),
    mutation("member-format", { kind: "set-u16le", offset: first + 4, value: 2 },
      "acg2-member-order"),
    mutation("member-flags", { kind: "set-u16le", offset: first + 6, value: 1 },
      "acg2-member-record"),
    mutation("member-ordinal", { kind: "set-u32le", offset: first + 8, value: 1 },
      "acg2-member-order"),
    mutation("member-reserved-zero", { kind: "set-u8", offset: first + 12, value: 1 },
      "acg2-member-record"),
    mutation("member-artifact-bytes-zero", { kind: "set-u64le", offset: first + 16, value: 0 },
      "acg2-member-length"),
    mutation("member-artifact-bytes-over-limit", {
      kind: "set-u64le", offset: first + 16, value: 68_719_476_737
    }, "acg2-member-length"),
    mutation("member-artifact-hash-zero", {
      kind: "fill", offset: first + 24, bytes: 32, value: 0
    }, "acg2-member-identity"),
    mutation("member-profile-hash", { kind: "xor-byte", offset: first + 56, value: 1 },
      "acg2-member-profile"),
    mutation("member-reserved-tail", { kind: "set-u8", offset: first + 88, value: 1 },
      "acg2-member-record"),
    mutation("member-record-reorder", {
      kind: "swap-records", offset: MEMBER_TABLE_OFFSET, otherOrdinal: 1
    }, "acg2-member-order"),
    mutation("member-artifact-hash-drift", { kind: "xor-byte", offset: first + 24, value: 1 },
      "acg2-member-table-hash"),
    mutation("trailing-byte", { kind: "append-byte", offset: FILE_BYTES, value: 0 },
      "acg2-artifact-limit")
  ];
  return mutations.map((entry) => {
    const artifact = applyMutation(canonical, entry);
    const observed = expectedError(artifact);
    invariant(observed === entry.expectedError, "acg2-hostile-vector-verdict-drift");
    return Object.freeze({
      id: entry.id,
      operation: entry.operation,
      expectedError: entry.expectedError,
      artifactHex: artifact.toString("hex")
    });
  });
}

function vectorDocument() {
  validateProfileIdentity();
  const sourceBytes = fs.readFileSync(__filename);
  const profileBytes = fs.readFileSync(profilePath);
  const canonical = writeGraph(CANONICAL_MEMBERS);
  const canonicalParsed = parseGraph(canonical);
  const alternateMembers = CANONICAL_MEMBERS.map((member) => ({ ...member }));
  alternateMembers[0].artifactBytes = 8_705;
  alternateMembers[0].artifactSha256 = sha256Hex(Buffer.from("alternate-valid-model", "ascii"));
  const alternate = writeGraph(alternateMembers);
  const alternateParsed = parseGraph(alternate);
  invariant(alternateParsed.graphIdentitySha256 !== canonicalParsed.graphIdentitySha256
    && alternateParsed.artifactSha256 !== canonicalParsed.artifactSha256,
  "acg2-alternate-identity-drift");
  return {
    schema: "tinyrustlm.acg2-format-vectors.v1",
    profile: {
      path: "contracts/vnext/acg2-format-profile.v1.json",
      profileId: PROFILE_ID,
      byteLength: profileBytes.length,
      sha256: sha256Hex(profileBytes)
    },
    independentOracle: {
      path: "tinyrustlm/tools/acg2-reference.js",
      byteLength: sourceBytes.length,
      sha256: sha256Hex(sourceBytes),
      invokesRust: false,
      invokesSubprocess: false,
      usesNetwork: false,
      readsGeneratedRustOutput: false
    },
    limits: {
      graphBytes: FILE_BYTES,
      memberCount: MEMBER_COUNT,
      streamHashBufferBytes: STREAM_HASH_BUFFER_BYTES,
      maximumResolvedMemberBytes: MAXIMUM_RESOLVED_MEMBER_BYTES,
      maximumInputFilesOpenConcurrently: 1,
      maximumPendingActivationGraphs: 1
    },
    canonical: {
      id: "mixed-q8-qwen3-champion-five-member-fixture",
      members: canonicalParsed.members,
      resolvedMemberBytes: canonicalParsed.resolvedMemberBytes,
      artifactHex: canonical.toString("hex"),
      artifactByteLength: canonical.length,
      artifactSha256: canonicalParsed.artifactSha256,
      memberTableSha256: canonicalParsed.memberTableSha256,
      graphIdentitySha256: canonicalParsed.graphIdentitySha256,
      properPrefixCount: FILE_BYTES,
      mutations: registeredMutations(canonical)
    },
    alternateValidModel: {
      members: alternateParsed.members,
      resolvedMemberBytes: alternateParsed.resolvedMemberBytes,
      artifactHex: alternate.toString("hex"),
      artifactByteLength: alternate.length,
      artifactSha256: alternateParsed.artifactSha256,
      memberTableSha256: alternateParsed.memberTableSha256,
      graphIdentitySha256: alternateParsed.graphIdentitySha256
    },
    claimBoundary: {
      realModelConverted: false,
      modelQualityVerified: false,
      browserChatVerified: false,
      p2pAvailabilityVerified: false,
      packagePublished: false,
      siteDeployed: false,
      memoryEndpointsOperationPerformed: false,
      campaignCounters: {
        qualifiedModels: "0/20",
        cleanBrowserRounds: "0/50",
        liveMemoryRounds: "0/25",
        externallyProvenLanes: "0/40",
        liveCatalogAnnouncements: "0/20"
      }
    }
  };
}

function renderVectors() {
  return Buffer.from(`${JSON.stringify(vectorDocument(), null, 2)}\n`, "utf8");
}

function runCli() {
  invariant(process.argv.length === 3
    && ["--check", "--write", "--write-create-only"].includes(process.argv[2]),
  "usage: node acg2-reference.js --check|--write|--write-create-only");
  const rendered = renderVectors();
  if (process.argv[2] === "--write-create-only") {
    fs.writeFileSync(vectorPath, rendered, { flag: "wx" });
    return;
  }
  if (process.argv[2] === "--write") {
    fs.writeFileSync(vectorPath, rendered, { flag: "w" });
    return;
  }
  invariant(fs.existsSync(vectorPath) && fs.readFileSync(vectorPath).equals(rendered),
    "acg2-vector-contract-stale");
}

if (require.main === module) runCli();

module.exports = {
  Acg2Error,
  CANONICAL_MEMBERS,
  FILE_BYTES,
  MEMBER_PROFILES,
  PROFILE_ID,
  PROFILE_SHA256,
  applyMutation,
  graphIdentity,
  parseGraph,
  profilePath,
  renderVectors,
  vectorDocument,
  vectorPath,
  writeGraph
};
