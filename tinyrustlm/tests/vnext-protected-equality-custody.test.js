"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { canonicalizeVnextJcsBytes } = require("../tools/vnext-jcs.js");
const {
  inspectVnextProtectedEqualityCustody,
  protectedEqualityCustodyProfile,
  protectedEqualityCustodyProfileSha256,
  scanVnextProtectedEqualityBytes
} = require("../tools/vnext-protected-equality-custody.js");
const {
  createVnextProtectedEqualityCustody
} = require("../tools/vnext-protected-equality-custody-internal.js");
const {
  makeProtectedEqualityCustody
} = require("./helpers/vnext-protected-equality-fixtures.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "protected-equality-custody-profile.v1.json");
const registryPath = path.join(repositoryRoot, "contracts", "vnext",
  "contract-family.v1.json");

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function throwsCode(callback, code) {
  assert.throws(callback, (error) => error?.code === code, `expected ${code}`);
}

test("freezes one private signed equality-custody contract", () => {
  const bytes = fs.readFileSync(profilePath);
  const source = fs.readFileSync(path.join(repositoryRoot, "tinyrustlm", "tools",
    "vnext-protected-equality-custody.js"), "utf8");
  assert.equal(protectedEqualityCustodyProfileSha256, sha256(bytes));
  assert.equal(protectedEqualityCustodyProfile.contractRegistrySha256,
    sha256(fs.readFileSync(registryPath)));
  assert.equal(protectedEqualityCustodyProfile.bundleVisibility,
    "private-memory-only-never-persisted-committed-logged-or-returned");
  assert.equal(protectedEqualityCustodyProfile.secretPolicy,
    "validated-private-memory-only-no-export-no-secret-hash-no-public-commitment");
  assert.equal(protectedEqualityCustodyProfile.handlePolicy,
    "module-issued-opaque-handle-only-no-structural-substitution");
  assert.deepEqual(Object.keys(require(
    "../tools/vnext-protected-equality-custody.js")).sort(), [
    "inspectVnextProtectedEqualityCustody",
    "protectedEqualityCustodyProfile",
    "protectedEqualityCustodyProfileSha256",
    "scanVnextProtectedEqualityBytes",
    "scanVnextProtectedEqualityText"
  ]);
  assert.doesNotMatch(source,
    /node:(?:http|https|net|tls|dns)|\bfetch\s*\(|child_process|spawn|execFile/u);
  assert.doesNotMatch(source, /console\.|process\.env|Date\.now|new Date\s*\(/u);
});

test("opens one pinned signed revision and exposes only non-secret binding data", () => {
  const secret = "Synthetic-Custody-Secret-8Vn2qLm5";
  const fixture = makeProtectedEqualityCustody({ knownSecrets: [secret] });
  const binding = inspectVnextProtectedEqualityCustody(fixture.custody);
  assert.deepEqual(binding, {
    schema: protectedEqualityCustodyProfile.publicBindingSchema,
    profileId: protectedEqualityCustodyProfile.profileId,
    profileSha256: protectedEqualityCustodyProfileSha256,
    custodyId: fixture.payload.custodyId,
    revisionId: fixture.payload.revisionId,
    generation: 1,
    authorityKeyId: fixture.payload.authorityKeyId,
    authorityPublicKeySha256: sha256(Buffer.from(
      fixture.authorityPublicKeyBase64, "base64")),
    knownSecretCount: 1,
    bindingSha256: binding.bindingSha256
  });
  assert.match(binding.bindingSha256, /^[a-f0-9]{64}$/u);
  assert.equal(JSON.stringify(fixture.custody).includes(secret), false);
  assert.equal(JSON.stringify(binding).includes(secret), false);
  assert.equal(Object.isFrozen(fixture.custody), true);
  assert.equal(Object.isFrozen(binding), true);
});

test("detects every frozen representation without returning private material", () => {
  const secret = "Synthetic-Custody-Secret-8Vn2qLm5";
  const fixture = makeProtectedEqualityCustody({ knownSecrets: [secret] });
  const raw = Buffer.from(secret, "utf8");
  const utf16be = Buffer.from(secret, "utf16le");
  utf16be.swap16();
  const percent = Array.from(raw,
    (byte) => `%${byte.toString(16).toUpperCase().padStart(2, "0")}`).join("");
  const cases = [
    [raw, "known-secret-utf8"],
    [Buffer.from(secret, "utf16le"), "known-secret-utf16le"],
    [utf16be, "known-secret-utf16be"],
    [Buffer.from(raw.toString("base64"), "ascii"), "known-secret-base64"],
    [Buffer.from(raw.toString("hex").toUpperCase(), "ascii"),
      "known-secret-hexadecimal"],
    [Buffer.from(percent.toLowerCase(), "ascii"), "known-secret-percent-encoded"]
  ];
  for (const [bytes, expected] of cases) {
    const scan = scanVnextProtectedEqualityBytes(bytes, fixture.custody);
    assert.equal(scan.findingCount, 1, expected);
    assert.deepEqual(scan.findingClasses, [expected], expected);
    assert.equal(JSON.stringify(scan).includes(secret), false, expected);
    assert.equal(JSON.stringify(scan).includes(bytes.toString("utf8")), false,
      expected);
  }
});

test("rejects signature, authority, identity, generation, time, and wire drift", () => {
  const fixture = makeProtectedEqualityCustody({
    knownSecrets: ["Synthetic-Custody-Secret-8Vn2qLm5"]
  });
  const parsed = JSON.parse(fixture.bundleBytes.toString("utf8"));
  const changedSecret = canonicalizeVnextJcsBytes({
    ...parsed,
    knownSecrets: ["Synthetic-Custody-Secret-Changed-4Qp9"]
  });
  throwsCode(() => createVnextProtectedEqualityCustody(
    changedSecret, fixture.trustInput), "equality_custody_signature_invalid");
  for (const [field, value] of [
    ["expectedAuthorityKeyId", "different-authority-key"],
    ["expectedCustodyId", "different-custody-id"],
    ["expectedRevisionId", "different-revision-id"],
    ["expectedGeneration", 2]
  ]) {
    throwsCode(() => createVnextProtectedEqualityCustody(fixture.bundleBytes, {
      ...fixture.trustInput,
      [field]: value
    }), "equality_custody_pin_mismatch");
  }
  throwsCode(() => createVnextProtectedEqualityCustody(fixture.bundleBytes, {
    ...fixture.trustInput,
    verificationTimeUtc: "2026-10-01T00:00:00Z"
  }), "equality_custody_time_invalid");
  throwsCode(() => createVnextProtectedEqualityCustody(Buffer.from(
    `${fixture.bundleBytes.toString("utf8")}\n`, "utf8"), fixture.trustInput),
  "equality_custody_bundle_wire_invalid");
});

test("rejects structural handles, accessors, shared bytes, and secret-list abuse", () => {
  const fixture = makeProtectedEqualityCustody();
  throwsCode(() => scanVnextProtectedEqualityBytes(Buffer.from("public", "utf8"), {
    ...fixture.custody
  }), "equality_custody_handle_invalid");
  if (typeof SharedArrayBuffer === "function") {
    throwsCode(() => scanVnextProtectedEqualityBytes(
      new Uint8Array(new SharedArrayBuffer(16)), fixture.custody),
    "equality_custody_scan_bytes_required");
  }
  let invoked = false;
  const hostileTrust = { ...fixture.trustInput };
  Object.defineProperty(hostileTrust, "expectedRevisionId", {
    enumerable: true,
    get() {
      invoked = true;
      return fixture.payload.revisionId;
    }
  });
  throwsCode(() => createVnextProtectedEqualityCustody(
    fixture.bundleBytes, hostileTrust), "equality_custody_trust_input_invalid");
  assert.equal(invoked, false);

  throwsCode(() => makeProtectedEqualityCustody({
    knownSecrets: ["short"]
  }), "equality_custody_secret_invalid");
  throwsCode(() => makeProtectedEqualityCustody({
    knownSecrets: ["duplicate-secret-value", "duplicate-secret-value"]
  }), "equality_custody_secret_invalid");
});
