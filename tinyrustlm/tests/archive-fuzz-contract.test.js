"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { resolveRepositoryRoot } = require("./helpers/repository-root.js");
const repositoryRoot = resolveRepositoryRoot({
  requiredFiles: ["contracts/vnext/archive-fuzz-profile.v1.json"]
});
const fuzzRoot = path.join(
  repositoryRoot,
  "rust",
  "crates",
  "tinyrustlm-archive",
  "fuzz"
);
const corpusRoot = path.join(fuzzRoot, "corpus", "structured_archive");
const profilePath = path.join(
  repositoryRoot,
  "contracts",
  "vnext",
  "archive-fuzz-profile.v1.json"
);
const archiveProfilePath = path.join(
  repositoryRoot,
  "contracts",
  "vnext",
  "archive-admission-profile.v1.json"
);
const manifestPath = path.join(corpusRoot, "manifest.v1.json");
const fuzzCargoPath = path.join(fuzzRoot, "Cargo.toml");
const fuzzLockPath = path.join(fuzzRoot, "Cargo.lock");

const expectedProfileSha256 =
  "5af6f00aef3540aa6969bb122dc2a3efdde9b39049c0dfbb15cc1e0fa29ce22e";
const expectedManifestSha256 =
  "ad38ccecb671b47c5da5271e59219a091837d2f271c03624a09a3827c2076420";
const expectedLockSha256 =
  "ceae70bcca6821cf350a5cc13f21f650934c96e7209fbd67c46a75b50930af7b";

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function readBytes(filePath) {
  const metadata = fs.lstatSync(filePath);
  assert.equal(metadata.isFile(), true, filePath);
  assert.equal(metadata.isSymbolicLink(), false, filePath);
  return fs.readFileSync(filePath);
}

function readJson(filePath) {
  return JSON.parse(readBytes(filePath).toString("utf8"));
}

function decodedFormat(bytes) {
  return bytes[4] === 0x5a ? "zip" : "tar-gzip";
}

function decodedMode(bytes) {
  const modes = new Map([
    [0x56, "canonical"],
    [0x50, "path-contract"],
    [0x4e, "nested-archive"],
    [0x4d, "member-type"],
    [0x58, "truncation"],
    [0x42, "bit-flip"],
    [0x41, "trailing-data"],
    [0x52, "raw-container"]
  ]);
  return modes.get(bytes[5]);
}

test("frozen archive fuzz corpus has exact bounded identities", () => {
  const profileBytes = readBytes(profilePath);
  const archiveProfileBytes = readBytes(archiveProfilePath);
  const manifestBytes = readBytes(manifestPath);
  const lockBytes = readBytes(fuzzLockPath);
  const profile = JSON.parse(profileBytes.toString("utf8"));
  const archiveProfile = JSON.parse(archiveProfileBytes.toString("utf8"));
  const manifest = JSON.parse(manifestBytes.toString("utf8"));

  assert.equal(sha256(profileBytes), expectedProfileSha256);
  assert.equal(sha256(manifestBytes), expectedManifestSha256);
  assert.equal(sha256(lockBytes), expectedLockSha256);
  assert.equal(profile.schema, "tinyrustlm.vnext.archive_fuzz_profile.v1");
  assert.equal(profile.profileId, "tinyrustlm.vnext.archive-fuzz.v1");
  assert.equal(profile.status, "frozen");
  assert.equal(profile.inputWire.magicAscii, "TAF1");
  assert.equal(profile.inputWire.maximumBytes, 4096);
  assert.equal(profile.generatorLimits.maximumMaterializedArchiveBytes, 65536);
  assert.equal(profile.engine.cargoFuzzVersion, "0.13.2");
  assert.equal(profile.engine.libfuzzerSysVersion, "0.4.13");
  assert.equal(profile.engine.toolchain, "nightly-2026-08-01");
  assert.equal(profile.systemUnderTest.entryPoint, "scan_archive_bytes");
  assert.equal(profile.systemUnderTest.secondParser, "forbidden");
  assert.equal(profile.systemUnderTest.filesystemExtraction, "forbidden");
  assert.equal(profile.systemUnderTest.networkAccess, "forbidden");

  assert.equal(manifest.schema, "tinyrustlm.vnext.archive_fuzz_corpus.v1");
  assert.equal(manifest.corpusId, "tinyrustlm.vnext.archive-fuzz-corpus.v1");
  assert.equal(manifest.status, "frozen");
  assert.equal(manifest.fuzzProfileId, profile.profileId);
  assert.equal(manifest.fuzzProfileSha256, expectedProfileSha256);
  assert.equal(manifest.archiveProfileId, archiveProfile.profileId);
  assert.equal(manifest.archiveProfileSha256, sha256(archiveProfileBytes));
  assert.equal(manifest.entries.length, 29);

  const seedFiles = fs.readdirSync(corpusRoot)
    .filter((name) => name.endsWith(".seed"))
    .sort();
  const manifestFiles = manifest.entries.map((entry) => entry.file);
  assert.deepEqual(manifestFiles, [...manifestFiles].sort());
  assert.deepEqual(seedFiles, manifestFiles);
  assert.equal(new Set(manifest.entries.map((entry) => entry.id)).size, 29);
  assert.equal(new Set(manifestFiles).size, 29);
  assert.equal(new Set(manifest.entries.map((entry) => entry.sha256)).size, 29);

  let admitted = 0;
  let rejected = 0;
  for (const entry of manifest.entries) {
    const seed = readBytes(path.join(corpusRoot, entry.file));
    assert.equal(seed.length, entry.bytes, entry.file);
    assert.ok(seed.length > 0 && seed.length <= profile.inputWire.maximumBytes);
    assert.equal(sha256(seed), entry.sha256, entry.file);
    assert.equal(seed.subarray(0, 4).toString("ascii"), "TAF1", entry.file);
    assert.equal(decodedFormat(seed), entry.format, entry.file);
    assert.equal(decodedMode(seed), entry.mode, entry.file);
    assert.ok(entry.materializedArchiveBytes > 0);
    assert.ok(
      entry.materializedArchiveBytes <=
        profile.generatorLimits.maximumMaterializedArchiveBytes
    );
    if (entry.verdict === "admit") {
      admitted += 1;
      assert.ok(entry.callbackCount > 0, entry.file);
    } else {
      rejected += 1;
      assert.equal(entry.callbackCount, 0, entry.file);
      assert.ok(archiveProfile.errorCodes.includes(entry.verdict), entry.file);
    }
  }
  assert.equal(admitted, 2);
  assert.equal(rejected, 27);
});

test("fuzz workspace calls the sole parser and pins every moving tool", () => {
  const cargo = readBytes(fuzzCargoPath).toString("utf8");
  const library = readBytes(path.join(fuzzRoot, "src", "lib.rs")).toString("utf8");
  const target = readBytes(
    path.join(fuzzRoot, "fuzz_targets", "structured_archive.rs")
  ).toString("utf8");
  const replay = readBytes(
    path.join(fuzzRoot, "src", "bin", "replay_archive_corpus.rs")
  ).toString("utf8");

  assert.match(cargo, /arbitrary = "=1\.4\.2"/u);
  assert.match(cargo, /libfuzzer-sys = \{ version = "=0\.4\.13"/u);
  assert.match(cargo, /tinyrustlm-archive = \{ path = "\.\." \}/u);
  assert.match(cargo, /zip = \{ version = "=2\.4\.2"/u);
  assert.match(library, /use tinyrustlm_archive::\{scan_archive_bytes, ArchiveFormat\};/u);
  assert.equal((library.match(/scan_archive_bytes\(/gu) || []).length, 1);
  assert.doesNotMatch(library, /ZipArchive|tar::Archive|extract\(/u);
  assert.match(target, /fuzz_target!\(\|program: FuzzProgram\|/u);
  assert.match(replay, /deny_unknown_fields/u);
  assert.match(replay, /manifest seed list does not exactly match/u);
  assert.match(replay, /seed .* SHA-256 mismatch/u);
  assert.doesNotMatch(replay, /--bless|write_manifest|update_manifest/u);
});

test("CI replays every RID and runs one pinned bounded sanitizer target", () => {
  const workflow = readBytes(
    path.join(repositoryRoot, ".github", "workflows", "ci.yml")
  ).toString("utf8");

  assert.match(workflow, /Replay frozen hostile archive corpus/u);
  assert.match(workflow, /verify-archive-fuzz:/u);
  assert.match(workflow, /toolchain: nightly-2026-08-01/u);
  assert.match(workflow, /components: rust-src/u);
  assert.match(
    workflow,
    /cargo \+nightly-2026-08-01 install cargo-fuzz --version 0\.13\.2 --locked/u
  );
  assert.match(workflow, /--bin replay_archive_corpus/u);
  assert.match(workflow, /-runs=0/u);
  assert.match(workflow, /-max_total_time=60/u);
  assert.match(workflow, /-max_len=4096/u);
  assert.match(workflow, /\$\{RUNNER_TEMP\}\/archive-fuzz-corpus/u);
  assert.match(workflow, /Upload failure artifacts and working corpus/u);
  assert.doesNotMatch(workflow, /cargo \+nightly fuzz/u);
});
