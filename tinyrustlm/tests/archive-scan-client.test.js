"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  archiveAdmissionProfileSha256,
  archiveScanClientProfileId,
  archiveScanClientProfileSha256,
  archiveScanClientSourceClosureSha256,
  archiveScanProcessProfileSha256,
  createArchiveScanClient,
  createArchiveWireParser
} = require("../tools/archive-scan-client.js");
const { ensureArchiveScanTestPackage } = require(
  "./helpers/archive-scan-test-package.js"
);
const { createStoredZip, createTarGzip } = require("./helpers/archive-test-fixtures.js");
const { canonicalizeVnextJcsBytes } = require("../tools/vnext-jcs.js");
const repositoryRoot = path.resolve(__dirname, "../..");

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

function packageManifestPath(packageRoot) {
  return path.join(packageRoot, "archive-scan-helper-manifest.v1.json");
}

function readPackageManifest(packageRoot) {
  return JSON.parse(fs.readFileSync(packageManifestPath(packageRoot), "utf8"));
}

function writePackageManifest(packageRoot, manifest) {
  fs.writeFileSync(packageManifestPath(packageRoot), canonicalizeVnextJcsBytes(manifest));
}

function packageProvenancePath(packageRoot) {
  return path.join(packageRoot, "archive-scan-helper-provenance.v1.json");
}

function readPackageProvenance(packageRoot) {
  return JSON.parse(fs.readFileSync(packageProvenancePath(packageRoot), "utf8"));
}

function writePackageProvenance(packageRoot, provenance) {
  const bytes = canonicalizeVnextJcsBytes(provenance);
  fs.writeFileSync(packageProvenancePath(packageRoot), bytes);
  const manifest = readPackageManifest(packageRoot);
  writePackageManifest(packageRoot, {
    ...manifest,
    provenanceByteCount: bytes.length,
    provenanceSha256: sha256(bytes)
  });
}

function clonePackage(context) {
  const root = temporaryRoot(context, "tinyrustlm-archive-package-");
  const packageRoot = path.join(root, "package");
  fs.cpSync(ensureArchiveScanTestPackage(), packageRoot, { recursive: true });
  return packageRoot;
}

test("binds the frozen client profile and complete Node source closure", () => {
  const profilePath = path.join(
    repositoryRoot,
    "contracts",
    "vnext",
    "archive-scan-client-profile.v1.json"
  );
  const profileBytes = fs.readFileSync(profilePath);
  const profile = JSON.parse(profileBytes);
  assert.equal(sha256(profileBytes), archiveScanClientProfileSha256);
  assert.equal(profile.profileId, archiveScanClientProfileId);
  const members = profile.clientSourceClosureMembers.map((relativePath) => {
    const bytes = fs.readFileSync(path.join(repositoryRoot, ...relativePath.split("/")));
    return Object.freeze({
      byteCount: bytes.length,
      path: relativePath,
      sha256: sha256(bytes)
    });
  });
  assert.equal(
    sha256(canonicalizeVnextJcsBytes(members)),
    archiveScanClientSourceClosureSha256
  );
});

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
  const packageRoot = ensureArchiveScanTestPackage();
  const client = createArchiveScanClient(packageRoot);
  assert.equal(client.packageIdentity.clientProfileId, archiveScanClientProfileId);
  assert.equal(client.packageIdentity.clientProfileSha256,
    archiveScanClientProfileSha256);
  assert.equal(client.packageIdentity.clientSourceClosureSha256,
    archiveScanClientSourceClosureSha256);
  assert.equal(client.packageIdentity.runtimeIdentifier,
    process.platform === "win32" ? `win-${process.arch}` :
      process.platform === "darwin" ? `osx-${process.arch}` :
        `${process.platform}-${process.arch}`);
  const expectedTrustClass = process.env.TINYRUSTLM_ARCHIVE_SCAN_TEST_PACKAGE_ROOT
    ? "release-package"
    : "local-test-build";
  assert.equal(client.packageIdentity.trustClass, expectedTrustClass);
  if (expectedTrustClass === "release-package") {
    assert.equal(client.packageIdentity.buildProfile, "release");
    assert.equal(client.packageIdentity.helperSourceWorktreeClean, true);
  }
  assert.match(client.packageIdentity.helperManifestSha256, /^[a-f0-9]{64}$/u);
  assert.match(client.packageIdentity.helperPackageBuilderSourceClosureSha256,
    /^[a-f0-9]{64}$/u);
  assert.match(client.packageIdentity.helperProvenanceSha256, /^[a-f0-9]{64}$/u);
  assert.match(client.packageIdentity.helperSourceClosureSha256, /^[a-f0-9]{64}$/u);
  assert.match(client.packageIdentity.helperSourceRevision, /^[a-f0-9]{40}$/u);
  assert.equal(typeof client.packageIdentity.helperSourceWorktreeClean, "boolean");
  assert.equal(JSON.stringify(client.packageIdentity).includes(packageRoot), false);
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
  await assert.rejects(createArchiveScanClient(ensureArchiveScanTestPackage()).scan({
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

test("requires one canonical platform-bound helper package with no executable fallback", () => {
  const packageRoot = ensureArchiveScanTestPackage();
  const manifest = readPackageManifest(packageRoot);
  assert.throws(
    () => createArchiveScanClient(path.join(packageRoot, manifest.executableFile)),
    (error) => error.code === "archive_scan_package_root_invalid"
  );
  assert.throws(
    () => createArchiveScanClient("relative-package"),
    (error) => error.code === "archive_scan_package_root_invalid"
  );
  if (process.platform === "win32") {
    assert.throws(
      () => createArchiveScanClient("\\\\example.invalid\\share\\package"),
      (error) => error.code === "archive_scan_package_root_not_local"
    );
  }
});

test("rejects unknown noncanonical cross-platform and executable-drift package state", async (context) => {
  await context.test("unknown manifest field", (subtest) => {
    const packageRoot = clonePackage(subtest);
    writePackageManifest(packageRoot, { ...readPackageManifest(packageRoot), unknown: true });
    assert.throws(() => createArchiveScanClient(packageRoot),
      (error) => error.code === "archive_scan_manifest_invalid");
  });

  await context.test("noncanonical manifest bytes", (subtest) => {
    const packageRoot = clonePackage(subtest);
    fs.writeFileSync(packageManifestPath(packageRoot),
      `${JSON.stringify(readPackageManifest(packageRoot), null, 2)}\n`);
    assert.throws(() => createArchiveScanClient(packageRoot),
      (error) => error.code === "archive_scan_manifest_invalid");
  });

  await context.test("cross-platform manifest", (subtest) => {
    const packageRoot = clonePackage(subtest);
    const manifest = readPackageManifest(packageRoot);
    writePackageManifest(packageRoot, {
      ...manifest,
      runtimeIdentifier: manifest.runtimeIdentifier === "win-x64"
        ? "linux-x64"
        : "win-x64"
    });
    assert.throws(() => createArchiveScanClient(packageRoot),
      (error) => error.code === "archive_scan_manifest_invalid");
  });

  await context.test("executable identity drift", (subtest) => {
    const packageRoot = clonePackage(subtest);
    const manifest = readPackageManifest(packageRoot);
    fs.appendFileSync(path.join(packageRoot, manifest.executableFile), Buffer.from([0]));
    assert.throws(() => createArchiveScanClient(packageRoot),
      (error) => error.code === "archive_scan_executable_identity_mismatch");
  });

  await context.test("provenance identity drift", (subtest) => {
    const packageRoot = clonePackage(subtest);
    fs.appendFileSync(packageProvenancePath(packageRoot), Buffer.from([0]));
    assert.throws(() => createArchiveScanClient(packageRoot),
      (error) => error.code === "archive_scan_provenance_identity_mismatch");
  });

  await context.test("provenance cross-binding drift", (subtest) => {
    const packageRoot = clonePackage(subtest);
    writePackageProvenance(packageRoot, {
      ...readPackageProvenance(packageRoot),
      sourceClosureSha256: "0".repeat(64)
    });
    assert.throws(() => createArchiveScanClient(packageRoot),
      (error) => error.code === "archive_scan_provenance_invalid");
  });
});

test("rejects package manifest drift before starting the helper", async (context) => {
  const root = temporaryRoot(context, "tinyrustlm-archive-package-drift-");
  const packageRoot = clonePackage(context);
  const client = createArchiveScanClient(packageRoot);
  writePackageProvenance(packageRoot, {
    ...readPackageProvenance(packageRoot),
    sourceRevision: "0".repeat(40)
  });
  const archivePath = path.join(root, "release.zip");
  fs.writeFileSync(archivePath, createStoredZip([
    { content: Buffer.from("public"), name: "docs/release.txt" }
  ]));
  await assert.rejects(client.scan({ archivePath, format: "zip" }),
    (error) => error.code === "archive_scan_package_changed");
});
