"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  archiveAdmissionProfileSha256,
  archiveScanProcessProfileSha256,
  createArchiveScanClient,
  createArchiveWireParser
} = require("../tools/archive-scan-client.js");
const { ensureArchiveScanTestExecutable } = require(
  "./helpers/archive-scan-test-executable.js"
);
const { createStoredZip, createTarGzip } = require("./helpers/archive-test-fixtures.js");

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function manifestSha256(members) {
  const sorted = [...members].sort((left, right) =>
    Buffer.from(left.path, "ascii").compare(Buffer.from(right.path, "ascii")));
  const hasher = crypto.createHash("sha256");
  hasher.update(Buffer.from("tinyrustlm.archive-content-manifest.v1\0", "ascii"));
  const count = Buffer.alloc(8);
  count.writeBigUInt64BE(BigInt(sorted.length));
  hasher.update(count);
  for (const member of sorted) {
    const pathHasher = crypto.createHash("sha256");
    pathHasher.update(Buffer.from("tinyrustlm.archive-member-path.v1\0", "ascii"));
    pathHasher.update(Buffer.from(member.path, "ascii"));
    hasher.update(pathHasher.digest());
    hasher.update(Buffer.from(sha256(member.content), "hex"));
    const size = Buffer.alloc(8);
    size.writeBigUInt64BE(BigInt(member.content.length));
    hasher.update(size);
  }
  return hasher.digest("hex");
}

function wireBytes(format, members) {
  const records = [Buffer.from("5452415356310000", "hex")];
  let total = 0;
  for (const member of members) {
    const name = Buffer.from(member.path, "ascii");
    const header = Buffer.alloc(75);
    header[0] = 1;
    header.writeUInt16BE(name.length, 1);
    header.writeBigUInt64BE(BigInt(member.content.length), 3);
    header.write(sha256(member.content), 11, 64, "ascii");
    records.push(header, name, member.content);
    total += member.content.length;
  }
  const terminal = Buffer.alloc(270);
  terminal[0] = 2;
  terminal.writeUInt32BE(members.length, 1);
  terminal.writeBigUInt64BE(BigInt(total), 5);
  terminal[13] = format === "zip" ? 1 : 2;
  terminal.write("a".repeat(64), 14, 64, "ascii");
  terminal.write(manifestSha256(members), 78, 64, "ascii");
  terminal.write(archiveAdmissionProfileSha256, 142, 64, "ascii");
  terminal.write(archiveScanProcessProfileSha256, 206, 64, "ascii");
  records.push(terminal);
  return Buffer.concat(records);
}

function temporaryRoot(context, label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), label));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test("parses arbitrarily split framed output and independently verifies member evidence", () => {
  const members = [
    { content: Buffer.from("first"), path: "docs/first.txt" },
    { content: Buffer.from("second"), path: "runtimes/win-x64/native/runtime.dll" }
  ];
  const observed = [];
  let current;
  const parser = createArchiveWireParser({
    format: "zip",
    onMemberStart(member) {
      current = { chunks: [], member };
    },
    onContent(chunk) {
      current.chunks.push(Buffer.from(chunk));
    },
    onMemberEnd(member) {
      assert.equal(member, current.member);
      observed.push({ content: Buffer.concat(current.chunks), path: member.path });
      current = null;
    }
  });
  const wire = wireBytes("zip", members);
  for (const byte of wire) parser.write(Buffer.from([byte]));
  const result = parser.finish();
  assert.deepEqual(observed, members);
  assert.equal(result.memberCount, 2);
  assert.equal(result.totalContentBytes, 11);
  assert.equal(result.contentManifestSha256, manifestSha256(members));
  assert.equal(Object.isFrozen(result), true);
});

test("rejects corrupted content, terminal identity drift, trailing bytes, and zero members", () => {
  const members = [{ content: Buffer.from("content"), path: "file.txt" }];

  const corrupt = wireBytes("zip", members);
  corrupt[8 + 75 + Buffer.byteLength(members[0].path)] ^= 0xff;
  const corruptParser = createArchiveWireParser({ format: "zip" });
  assert.throws(() => corruptParser.write(corrupt), (error) =>
    error.code === "archive_scan_wire_content_mismatch");

  const identityDrift = wireBytes("zip", members);
  identityDrift.fill(0x30, identityDrift.length - 128, identityDrift.length - 64);
  const identityParser = createArchiveWireParser({ format: "zip" });
  assert.throws(() => identityParser.write(identityDrift), (error) =>
    error.code === "archive_scan_wire_identity_mismatch");

  const trailingParser = createArchiveWireParser({ format: "zip" });
  trailingParser.write(wireBytes("zip", members));
  assert.throws(() => trailingParser.write(Buffer.from([0])), (error) =>
    error.code === "archive_scan_wire_invalid");

  const emptyParser = createArchiveWireParser({ format: "zip" });
  assert.throws(() => emptyParser.write(wireBytes("zip", [])), (error) =>
    error.code === "archive_scan_wire_invalid");

  const reservedParser = createArchiveWireParser({ format: "zip" });
  assert.throws(() => reservedParser.write(wireBytes("zip", [
    { content: Buffer.from("reserved"), path: "docs/CON.txt" }
  ])), (error) => error.code === "archive_scan_wire_invalid");
});

test("streams real Rust ZIP and tar-gzip output through the same strict boundary", async (context) => {
  const root = temporaryRoot(context, "tinyrustlm-archive-client-");
  const executablePath = ensureArchiveScanTestExecutable();
  const client = createArchiveScanClient(executablePath);
  const cases = [
    ["zip", "release.zip", createStoredZip],
    ["tar-gzip", "release.tar.gz", createTarGzip]
  ];
  for (const [format, fileName, createArchive] of cases) {
    const members = [
      { content: Buffer.from("public metadata"), name: "docs/release.txt" },
      { content: Buffer.from("native bytes"), name: "runtimes/win-x64/native/runtime.dll" }
    ];
    const archiveBytes = createArchive(members);
    const archivePath = path.join(root, fileName);
    fs.writeFileSync(archivePath, archiveBytes);
    const decoded = [];
    let current;
    const result = await client.scan({
      archivePath,
      format,
      onMemberStart(member) {
        current = { chunks: [], path: member.path };
      },
      onContent(chunk) {
        current.chunks.push(Buffer.from(chunk));
      },
      onMemberEnd() {
        decoded.push({ content: Buffer.concat(current.chunks), path: current.path });
        current = null;
      }
    });
    assert.deepEqual(decoded, members.map((member) => ({
      content: member.content,
      path: member.name
    })));
    assert.equal(result.archiveSha256, sha256(archiveBytes));
    assert.equal(result.memberCount, members.length);
    assert.equal(result.totalContentBytes,
      members.reduce((total, member) => total + member.content.length, 0));
    assert.equal(result.admissionProfileSha256, archiveAdmissionProfileSha256);
    assert.equal(result.processProfileSha256, archiveScanProcessProfileSha256);
    assert.match(result.executableSha256, /^[a-f0-9]{64}$/u);
  }
});

test("real helper rejects a late hostile member without invoking content callbacks", async (context) => {
  const root = temporaryRoot(context, "tinyrustlm-archive-hostile-");
  const archivePath = path.join(root, "hostile.zip");
  fs.writeFileSync(archivePath, createStoredZip([
    { content: Buffer.from("must remain hidden"), name: "docs/accepted.txt" },
    { content: Buffer.from("hostile"), name: "docs\\escape.txt" }
  ]));
  let callbacks = 0;
  await assert.rejects(createArchiveScanClient(ensureArchiveScanTestExecutable()).scan({
    archivePath,
    format: "zip",
    onContent() {
      callbacks += 1;
    },
    onMemberEnd() {
      callbacks += 1;
    },
    onMemberStart() {
      callbacks += 1;
    }
  }), (error) => error.code === "archive_scan_helper_failed" &&
    error.causeCode === "archive_member_path_nonportable");
  assert.equal(callbacks, 0);
});
