"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");
const {
  finalizeVnextIdentityDocument
} = require("../tools/vnext-content-identity.js");
const {
  validateVnextReceiptBytes
} = require("../tools/vnext-receipt-identity.js");
const {
  createVnextRedactionScanReceipt,
  publicSafeRedactionProfile,
  publicSafeRedactionProfileSha256,
  scanKnownSecretRepresentations,
  scanVnextPublicDocumentBytes,
  scanVnextPublicTextBytes,
  verifyVnextRedactionScanReceipt
} = require("../tools/vnext-public-safe-redaction.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const corpusPath = path.join(repositoryRoot, "contracts", "vnext",
  "contract-corpus.v1.json");
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "public-safe-redaction-profile.v1.json");
const registryPath = path.join(repositoryRoot, "contracts", "vnext",
  "contract-family.v1.json");

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function corpusDocument(name) {
  const corpus = parseStrictJson(fs.readFileSync(corpusPath));
  const item = corpus.cases.find((entry) => entry.id === `valid-${name}`);
  return parseStrictJson(Buffer.from(item.payloadBase64, "base64"));
}

function draftFor(name) {
  const value = corpusDocument(name);
  delete value.canonicalContentSha256;
  if (name !== "artifact") delete value[`${name === "p2p" ? "manifest" : name}Id`];
  return value;
}

function finalizedFor(name, mutate = null) {
  const draft = draftFor(name);
  if (mutate !== null) mutate(draft);
  return finalizeVnextIdentityDocument(draft);
}

function scanClaim(text, knownSecrets = []) {
  const claim = finalizedFor("claim", (draft) => {
    draft.publicWording = text;
  });
  return scanVnextPublicDocumentBytes(claim.bytes, { knownSecrets });
}

function throwsCode(callback, code) {
  assert.throws(callback, (error) => error?.code === code, `expected ${code}`);
}

test("freezes a private-by-default byte-only public-safety profile", () => {
  const rawProfile = fs.readFileSync(profilePath);
  const registryBytes = fs.readFileSync(registryPath);
  const source = fs.readFileSync(path.join(repositoryRoot, "tinyrustlm", "tools",
    "vnext-public-safe-redaction.js"), "utf8");

  assert.equal(rawProfile.length, 3473);
  assert.equal(sha256(rawProfile),
    "83fcdd3590692304807e1ca62f82ad5873111cf0cce6b239bd51249d5c29d2b0");
  assert.equal(publicSafeRedactionProfileSha256, sha256(rawProfile));
  assert.equal(publicSafeRedactionProfile.contractRegistrySha256,
    sha256(registryBytes));
  assert.equal(publicSafeRedactionProfile.defaultVisibility, "private");
  assert.equal(publicSafeRedactionProfile.inputPolicy,
    "bounded-final-canonical-document-or-lf-utf8-public-text-bytes-only");
  assert.equal(publicSafeRedactionProfile.outputPolicy,
    "unchanged-canonical-bytes-on-pass-no-output-on-fail");
  assert.equal(publicSafeRedactionProfile.redactionMarkersAllowed, false);
  assert.deepEqual(publicSafeRedactionProfile.publicSafeClasses,
    ["artifact", "claim", "p2p", "proof", "receipt", "release"]);
  assert.deepEqual(publicSafeRedactionProfile.privateClasses,
    ["companion", "context", "worker"]);
  assert.deepEqual(publicSafeRedactionProfile.publicText, {
    schema: "tinyrustlm.vnext.public_text.v1",
    class: "public-text",
    identityDomain: "tinyrustlm.public_text.content.v1",
    encoding: "utf8-no-bom-lf-only-no-controls-terminal-lf",
    minimumBytes: 2
  });
  assert.deepEqual(publicSafeRedactionProfile.verificationTargetKinds,
    ["document", "public-text"]);
  assert.deepEqual(publicSafeRedactionProfile.knownSecretRepresentations, [
    "base64", "base64url", "hexadecimal", "percent-encoded", "utf16be",
    "utf16le", "utf8"
  ]);
  assert.equal(new Set(publicSafeRedactionProfile.detectorRuleIds).size,
    publicSafeRedactionProfile.detectorRuleIds.length);
  assert.doesNotMatch(source, /JSON\.parse|node:(?:http|https|net|tls|dns)|\bfetch\s*\(/u);
  assert.doesNotMatch(source, /\b(?:legacy|migration|fallback|deprecated|alias)\b/iu);
});

test("scans canonical LF UTF-8 public text without rewriting bytes", () => {
  const bytes = Buffer.from("# Release 2.0.0\n\n- Exact campaign evidence.\n", "utf8");
  const first = scanVnextPublicTextBytes(bytes);
  const second = scanVnextPublicTextBytes(bytes);

  assert.equal(first.publicSafe, true);
  assert.equal(first.result.sourceSchema, "tinyrustlm.vnext.public_text.v1");
  assert.equal(first.result.sourceClass, "public-text");
  assert.match(first.result.sourceSubjectId, /^sha256:[a-f0-9]{64}$/u);
  assert.deepEqual(first.outputBytes, bytes);
  assert.notEqual(first.outputBytes, first.outputBytes);
  assert.deepEqual(first.resultBytes, second.resultBytes);

  for (const invalid of [
    Buffer.from("", "utf8"),
    Buffer.from("missing terminal newline", "utf8"),
    Buffer.from("windows\r\n", "utf8"),
    Buffer.from([0xef, 0xbb, 0xbf, 0x23, 0x0a]),
    Buffer.from([0xc3, 0x28, 0x0a]),
    Buffer.from([0x41, 0x00, 0x0a])
  ]) {
    throwsCode(() => scanVnextPublicTextBytes(invalid),
      "redaction_public_text_wire_invalid");
  }
});

test("blocks secrets and generic credential patterns in public text", () => {
  const secret = "Synthetic-Live-Credential-9CePq2vLm8Hk";
  const cases = [
    [Buffer.from(`# Update\n\n${secret}\n`, "utf8"), [secret],
      "known-secret-utf8"],
    [Buffer.from("# Update\n\nAuthorization: Bearer abcdefghijklmnopqrstuvwxyz012345\n",
      "utf8"), [], "authorization-header"],
    [Buffer.from("# Update\n\nC:\\Users\\PrivateUser\\release.log\n", "utf8"), [],
      "private-absolute-path"]
  ];
  for (const [bytes, knownSecrets, finding] of cases) {
    const scan = scanVnextPublicTextBytes(bytes, { knownSecrets });
    assert.equal(scan.publicSafe, false, finding);
    assert.ok(scan.result.findingClasses.includes(finding), finding);
    assert.equal(scan.outputBytes, null, finding);
    assert.equal(scan.resultBytes.includes(Buffer.from(secret, "utf8")), false, finding);
  }
});

test("accepts each finalized public contract without changing canonical bytes", () => {
  for (const name of ["artifact", "receipt", "p2p", "proof", "release", "claim"]) {
    const document = finalizedFor(name);
    const before = Buffer.from(document.bytes);
    const scan = scanVnextPublicDocumentBytes(document.bytes);

    assert.equal(scan.publicSafe, true, name);
    assert.equal(scan.result.scanStatus, "pass", name);
    assert.equal(scan.result.sourceClass, name, name);
    assert.equal(scan.result.sourceSchema, document.schema, name);
    assert.equal(scan.result.sourceSubjectId, document.subjectId, name);
    assert.equal(scan.result.findingCount, 0, name);
    assert.deepEqual(scan.result.findingClasses, [], name);
    assert.deepEqual(scan.outputBytes, before, name);
    assert.notEqual(scan.outputBytes, scan.outputBytes, "output getter must copy");
    assert.equal(sha256(scan.resultBytes), scan.resultSha256, name);
    assert.equal(Object.isFrozen(scan), true, name);
    assert.equal(Object.isFrozen(scan.result), true, name);
  }
});

test("rejects private schemas, noncanonical wire, unknown fields, and object input", () => {
  const context = finalizedFor("context");
  throwsCode(() => scanVnextPublicDocumentBytes(context.bytes),
    "redaction_private_schema");

  const claim = finalizedFor("claim");
  throwsCode(() => scanVnextPublicDocumentBytes(
    Buffer.from(JSON.stringify(claim.value, null, 2), "utf8")
  ), "redaction_identity_invalid");

  const unknown = { ...claim.value, extra: "smuggled" };
  throwsCode(() => scanVnextPublicDocumentBytes(
    Buffer.from(JSON.stringify(unknown), "utf8")
  ), "redaction_schema_invalid");

  let trapInvoked = false;
  const hostile = new Proxy({}, {
    get() {
      trapInvoked = true;
      throw new Error("must not execute");
    },
    getPrototypeOf() {
      trapInvoked = true;
      throw new Error("must not execute");
    }
  });
  throwsCode(() => scanVnextPublicDocumentBytes(hostile),
    "redaction_bytes_required");
  assert.equal(trapInvoked, false);

  let shadowGetterCalled = false;
  const shadowedBytes = new Uint8Array(claim.bytes);
  for (const name of ["buffer", "byteLength", "byteOffset", "length",
    "BYTES_PER_ELEMENT"]) {
    Object.defineProperty(shadowedBytes, name, {
      configurable: true,
      get() {
        shadowGetterCalled = true;
        throw new Error("must not execute");
      }
    });
  }
  const shadowedScan = scanVnextPublicDocumentBytes(shadowedBytes);
  assert.equal(shadowedScan.publicSafe, true);
  assert.equal(shadowGetterCalled, false);
});

test("detects every frozen representation of a known secret without returning it", () => {
  const secret = "Synthetic-Live-Credential-9CePq2vLm8Hk";
  const raw = Buffer.from(secret, "utf8");
  const percentEncoded = Array.from(raw,
    (byte) => `%${byte.toString(16).toUpperCase().padStart(2, "0")}`).join("");
  const utf16be = Buffer.from(secret, "utf16le");
  utf16be.swap16();
  const lowerHex = raw.toString("hex");
  let mixedIndex = 0;
  const mixedHex = lowerHex.replace(/[a-f]/gu, (value) => {
    mixedIndex += 1;
    return mixedIndex % 2 === 0 ? value.toUpperCase() : value;
  });
  mixedIndex = 0;
  const mixedPercent = percentEncoded.replace(/[A-F]/gu, (value) => {
    mixedIndex += 1;
    return mixedIndex % 2 === 0 ? value.toLowerCase() : value;
  });
  const standardBase64 = raw.toString("base64");
  const urlSecret = `Synthetic-${String.fromCodePoint(0xbe)}-Credential`;
  const urlRaw = Buffer.from(urlSecret, "utf8");
  const unpaddedBase64Url = urlRaw.toString("base64url");
  const payloads = [
    ["utf8", "utf8", raw],
    ["utf16le", "utf16le", Buffer.from(secret, "utf16le")],
    ["utf16be", "utf16be", utf16be],
    ["base64-padded", "base64", Buffer.from(standardBase64, "ascii")],
    ["base64-unpadded", "base64",
      Buffer.from(standardBase64.replace(/=+$/u, ""), "ascii")],
    ["base64url-unpadded", "base64url", Buffer.from(unpaddedBase64Url, "ascii"),
      urlSecret],
    ["base64url-padded", "base64url", Buffer.from(unpaddedBase64Url +
      "=".repeat((4 - (unpaddedBase64Url.length % 4)) % 4), "ascii"), urlSecret],
    ["hex-lower", "hexadecimal", Buffer.from(lowerHex, "ascii")],
    ["hex-upper", "hexadecimal", Buffer.from(lowerHex.toUpperCase(), "ascii")],
    ["hex-mixed", "hexadecimal", Buffer.from(mixedHex, "ascii")],
    ["percent-upper", "percent-encoded", Buffer.from(percentEncoded, "ascii")],
    ["percent-lower", "percent-encoded",
      Buffer.from(percentEncoded.toLowerCase(), "ascii")],
    ["percent-mixed", "percent-encoded", Buffer.from(mixedPercent, "ascii")]
  ];

  for (const [caseId, representation, payload, activeSecret = secret] of payloads) {
    const result = scanKnownSecretRepresentations(payload, [activeSecret]);
    assert.equal(result.findingCount, 1, caseId);
    assert.deepEqual(result.findingClasses,
      [`known-secret-${representation}`], caseId);
    assert.equal(JSON.stringify(result).includes(activeSecret), false, caseId);
    assert.equal(JSON.stringify(result).includes(payload.toString("utf8")), false,
      caseId);
  }
});

test("rejects known, encoded, patterned, path, and high-entropy material", () => {
  const secret = "Synthetic-Live-Credential-9CePq2vLm8Hk";
  const escapedSecret = "Synthetic-\"Escaped\\Credential-4Vn8qL2p";
  const cases = [
    ["known-secret-utf8", `Published value ${secret}`, [secret]],
    ["known-secret-utf8", `Published value ${escapedSecret}`, [escapedSecret]],
    ["known-secret-base64",
      `Published value ${Buffer.from(secret, "utf8").toString("base64")}`, [secret]],
    ["authorization-header", "Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345", []],
    ["aws-access-key", "Assigned key AKIA1234567890ABCDEF", []],
    ["cookie-credential", "Cookie: session=abcdefghijklmnopqrstuvwxyz012345", []],
    ["credential-assignment", "client_secret=abcdefghijklmnopqrstuvwxyz012345", []],
    ["private-key-material",
      "-----BEGIN PRIVATE KEY----- abcdefghijklmnopqrstuvwxyz -----END PRIVATE KEY-----", []],
    ["credential-bearing-url", "https://user:abcdefghijklmnop@example.test/release", []],
    ["exception-detail",
      "Error: internal machine detail that must stay in the private diagnostic record", []],
    ["github-token", `Credential ghp_${"a".repeat(24)}`, []],
    ["invitation-secret-url",
      "https://memory.example.test/invite/abcdefghijklmnopqrstuvwxyz012345", []],
    ["jwt-credential",
      "eyJabcdefghijk.abcdefghijklmnop.zyxwvutsrqponmlk", []],
    ["openai-api-key", `Credential sk-proj-${"A".repeat(24)}`, []],
    ["private-absolute-path", "Source C:\\Users\\PrivateUser\\model.slm", []],
    ["raw-conversation-content", "raw prompt: confidential customer question", []],
    ["raw-hosted-memory", "hosted memory: confidential durable record", []],
    ["stable-hardware-identifier", "machine_uuid=ABCDEF0123456789", []],
    ["high-entropy-unapproved",
      "Opaque value mF9qT7vL2xK8nP4sR6wY3cH5bD1eG0aJ", []]
  ];

  const observedDetectorRules = new Set();
  for (const [expected, wording, knownSecrets] of cases) {
    const scan = scanClaim(wording, knownSecrets);
    assert.equal(scan.publicSafe, false, expected);
    assert.equal(scan.result.scanStatus, "fail", expected);
    assert.ok(scan.result.findingClasses.includes(expected), expected);
    assert.equal(scan.outputBytes, null, expected);
    const serialized = scan.resultBytes.toString("utf8");
    assert.equal(serialized.includes(secret), false, expected);
    assert.equal(serialized.includes(wording), false, expected);
    if (publicSafeRedactionProfile.detectorRuleIds.includes(expected)) {
      observedDetectorRules.add(expected);
    }
  }
  assert.deepEqual([...observedDetectorRules].sort(),
    publicSafeRedactionProfile.detectorRuleIds);
});

test("does not mistake schema-authorized hashes, public keys, or signatures for secrets", () => {
  for (const name of ["receipt", "proof", "release"]) {
    const scan = scanVnextPublicDocumentBytes(finalizedFor(name).bytes);
    assert.equal(scan.publicSafe, true, name);
    assert.deepEqual(scan.result.findingClasses, [], name);
  }
});

test("is bounded, deterministic, mutation-free, and explicit about secret-list limits", () => {
  const claim = finalizedFor("claim");
  const input = claim.bytes;
  const before = Buffer.from(input);
  const first = scanVnextPublicDocumentBytes(input);
  const second = scanVnextPublicDocumentBytes(input);
  assert.deepEqual(input, before);
  assert.deepEqual(first.resultBytes, second.resultBytes);
  assert.equal(first.resultSha256, second.resultSha256);

  const oversized = Buffer.alloc(publicSafeRedactionProfile.limits.maximumInputBytes + 1);
  throwsCode(() => scanVnextPublicDocumentBytes(oversized),
    "redaction_input_byte_limit");
  if (typeof SharedArrayBuffer === "function") {
    const sharedBytes = new Uint8Array(new SharedArrayBuffer(input.length));
    sharedBytes.set(input);
    throwsCode(() => scanVnextPublicDocumentBytes(sharedBytes),
      "redaction_bytes_required");
  }
  throwsCode(() => scanVnextPublicDocumentBytes(input, {
    knownSecrets: Array.from({ length: publicSafeRedactionProfile.limits.maximumKnownSecrets + 1 },
      (_, index) => `private-value-${index.toString().padStart(8, "0")}`)
  }), "redaction_known_secret_limit");
  throwsCode(() => scanVnextPublicDocumentBytes(input, {
    knownSecrets: ["short"]
  }), "redaction_known_secret_invalid");
  throwsCode(() => scanVnextPublicDocumentBytes(input, {
    knownSecrets: [`valid-length-${String.fromCharCode(0xd800)}`]
  }), "redaction_known_secret_invalid");

  let getterCalled = false;
  const hostileOptions = {};
  Object.defineProperty(hostileOptions, "knownSecrets", {
    enumerable: true,
    get() {
      getterCalled = true;
      return [];
    }
  });
  throwsCode(() => scanVnextPublicDocumentBytes(input, hostileOptions),
    "redaction_options_invalid");
  assert.equal(getterCalled, false);
});

test("builds canonical pass and fail receipts without secret values or identity cycles", () => {
  const passTarget = finalizedFor("claim", (draft) => {
    draft.publicWording = "A current, evidence-bound public claim.";
  });
  const passScan = scanVnextPublicDocumentBytes(passTarget.bytes);
  const pass = createVnextRedactionScanReceipt({
    attemptId: "redaction-pass-001",
    campaignId: "campaign-vnext-redaction",
    completedAtUtc: "2026-08-09T06:01:00Z",
    scan: passScan,
    sourceRevision: `git-sha1:${"a".repeat(40)}`,
    startedAtUtc: "2026-08-09T06:00:00Z"
  });
  const validatedPass = validateVnextReceiptBytes(pass.bytes);
  assert.equal(validatedPass.receipt.status, "pass");
  assert.equal(validatedPass.receipt.receiptType, "redaction-scan");
  assert.ok(validatedPass.receipt.inputHashes.some((entry) =>
    entry.name === "target-canonical-content" &&
    entry.sha256 === passScan.result.sourceCanonicalContentSha256));
  assert.ok(validatedPass.receipt.outputHashes.some((entry) =>
    entry.name === "redaction-scan-result" && entry.sha256 === passScan.resultSha256));
  assert.equal(validatedPass.receipt.inputReceiptIds.includes(
    validatedPass.receipt.receiptId), false);
  const verifiedPass = verifyVnextRedactionScanReceipt({
    knownSecrets: [],
    receiptBytes: pass.bytes,
    targetBytes: passTarget.bytes,
    targetKind: "document"
  });
  assert.equal(verifiedPass.redactionReceiptVerified, true);
  assert.equal(verifiedPass.publicSafe, true);

  const secret = "Synthetic-Live-Credential-9CePq2vLm8Hk";
  const failTarget = finalizedFor("claim", (draft) => {
    draft.publicWording = `Published value ${secret}`;
  });
  const failScan = scanVnextPublicDocumentBytes(failTarget.bytes, {
    knownSecrets: [secret]
  });
  const fail = createVnextRedactionScanReceipt({
    attemptId: "redaction-fail-001",
    campaignId: "campaign-vnext-redaction",
    completedAtUtc: "2026-08-09T06:03:00Z",
    scan: failScan,
    sourceRevision: `git-sha1:${"a".repeat(40)}`,
    startedAtUtc: "2026-08-09T06:02:00Z"
  });
  const validatedFail = validateVnextReceiptBytes(fail.bytes);
  assert.equal(validatedFail.receipt.status, "fail");
  assert.equal(validatedFail.receipt.error.code, "secret-material-detected");
  assert.equal(validatedFail.receipt.blockerCode,
    "public-evidence-secret-scan-failed");
  assert.equal(Buffer.concat([failScan.resultBytes, fail.bytes]).includes(
    Buffer.from(secret, "utf8")), false);
  const verifiedFail = verifyVnextRedactionScanReceipt({
    knownSecrets: [secret],
    receiptBytes: fail.bytes,
    targetBytes: failTarget.bytes,
    targetKind: "document"
  });
  assert.equal(verifiedFail.redactionReceiptVerified, true);
  assert.equal(verifiedFail.publicSafe, false);
  throwsCode(() => verifyVnextRedactionScanReceipt({
    knownSecrets: [],
    receiptBytes: fail.bytes,
    targetBytes: failTarget.bytes,
    targetKind: "document"
  }), "redaction_receipt_binding_mismatch");
  const changedTarget = finalizedFor("claim", (draft) => {
    draft.publicWording = "A different public claim.";
  });
  throwsCode(() => verifyVnextRedactionScanReceipt({
    knownSecrets: [],
    receiptBytes: pass.bytes,
    targetBytes: changedTarget.bytes,
    targetKind: "document"
  }), "redaction_receipt_binding_mismatch");

  const textTarget = Buffer.from("# Release\n\n- Public-safe change.\n", "utf8");
  const textScan = scanVnextPublicTextBytes(textTarget);
  const textReceipt = createVnextRedactionScanReceipt({
    attemptId: "redaction-text-001",
    campaignId: "campaign-vnext-redaction",
    completedAtUtc: "2026-08-09T06:05:00Z",
    scan: textScan,
    sourceRevision: `git-sha1:${"a".repeat(40)}`,
    startedAtUtc: "2026-08-09T06:04:00Z"
  });
  const verifiedText = verifyVnextRedactionScanReceipt({
    knownSecrets: [],
    receiptBytes: textReceipt.bytes,
    targetBytes: textTarget,
    targetKind: "public-text"
  });
  assert.equal(verifiedText.publicSafe, true);
  throwsCode(() => verifyVnextRedactionScanReceipt({
    knownSecrets: [],
    receiptBytes: textReceipt.bytes,
    targetBytes: textTarget,
    targetKind: "unknown"
  }), "redaction_verifier_target_kind_invalid");
});
