"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  controlledPowerLossVerificationProfile: profile,
  controlledPowerLossVerificationProfileId,
  controlledPowerLossVerificationProfileSha256,
  validateControlledPowerLossVerificationReceipt,
  verificationSourceClosureSha256,
  verifyControlledPowerLossEvidence
} = require("../tools/controlled-power-loss-verification.js");
const {
  materializeDirectoryFlushHelperPackage
} = require("../tools/directory-flush-helper-package.js");
const {
  runDirectoryFlushHelperVerification
} = require("../tools/directory-flush-helper-verification.js");
const { parseStrictJson } = require("../tools/strict-json.js");
const { canonicalizeVnextJcsBytes } = require("../tools/vnext-jcs.js");
const {
  ensureVnextDirectoryFlushTestPackage
} = require("./helpers/vnext-directory-flush-test-package.js");
const { resolveCargoTargetRoot } = require("./helpers/cargo-target-root.js");
const { resolveRepositoryRoot } = require("./helpers/repository-root.js");

const repositoryRoot = resolveRepositoryRoot({
  requiredFiles: ["eng/build-directory-flush-helper.ps1"]
});
const signatureDomain = "tinyrustlm.controlled-power-loss.physical-witness.v1";
const verificationTimeUtc = "2026-08-20T00:00:15Z";
let sharedRoot;
let helperPackageRoot;
let helperEvidenceRoot;
let helperIdentity;

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function hashText(value) {
  return sha256(Buffer.from(value, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeRoot(context, label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), label));
  context.after(() => fs.rmSync(root, { force: true, recursive: true }));
  return root;
}

function debugExecutablePath() {
  ensureVnextDirectoryFlushTestPackage();
  return path.join(
    resolveCargoTargetRoot(repositoryRoot, process.env.CARGO_TARGET_DIR),
    "debug",
    process.platform === "win32"
      ? "tinyrustlm-directory-flush.exe"
      : "tinyrustlm-directory-flush"
  );
}

function readCanonical(filePath) {
  const bytes = fs.readFileSync(filePath);
  const value = parseStrictJson(bytes);
  assert.equal(canonicalizeVnextJcsBytes(value).equals(bytes), true);
  return { bytes, value };
}

function deriveHelperIdentity() {
  const receiptRecord = readCanonical(path.join(
    helperEvidenceRoot,
    profile.helper.verificationReceiptFile
  ));
  const manifestRecord = readCanonical(path.join(
    helperPackageRoot,
    profile.helper.manifestFile
  ));
  const provenanceRecord = readCanonical(path.join(
    helperPackageRoot,
    profile.helper.provenanceFile
  ));
  const receipt = receiptRecord.value;
  const manifest = manifestRecord.value;
  const executableBytes = fs.readFileSync(path.join(
    helperPackageRoot,
    manifest.executableFile
  ));
  return {
    architecture: receipt.architecture,
    buildProfile: receipt.buildProfile,
    clientProfileSha256: receipt.clientProfileSha256,
    clientSourceClosureSha256: receipt.clientSourceClosureSha256,
    directoryFlushProfileSha256: manifest.directoryFlushProfileSha256,
    executableByteCount: executableBytes.length,
    executableSha256: sha256(executableBytes),
    helperManifestSha256: sha256(manifestRecord.bytes),
    helperPackageBuilderSourceClosureSha256:
      receipt.helperPackageBuilderSourceClosureSha256,
    helperProvenanceSha256: sha256(provenanceRecord.bytes),
    helperSourceClosureSha256: receipt.helperSourceClosureSha256,
    helperSourceRevision: receipt.helperSourceRevision,
    helperSourceWorktreeClean: receipt.helperSourceWorktreeClean,
    method: receipt.cases[0].method,
    operatingSystem: receipt.operatingSystem,
    runtimeIdentifier: receipt.runtimeIdentifier,
    trustClass: receipt.trustClass,
    verificationProfileSha256: receipt.profileSha256,
    verificationReceiptSha256: sha256(receiptRecord.bytes),
    verificationSourceClosureSha256: receipt.verificationSourceClosureSha256
  };
}

test.before(() => {
  sharedRoot = fs.mkdtempSync(path.join(os.tmpdir(),
    "tinyrustlm-controlled-power-loss-shared-"));
  helperPackageRoot = path.join(sharedRoot, "package");
  materializeDirectoryFlushHelperPackage({
    buildProfile: "debug",
    executablePath: debugExecutablePath(),
    outputRoot: helperPackageRoot,
    trustClass: "local-test-build"
  });
  const scratchRoot = path.join(sharedRoot, "scratch");
  fs.mkdirSync(scratchRoot);
  helperEvidenceRoot = path.join(sharedRoot, "helper-evidence");
  runDirectoryFlushHelperVerification({
    outputRoot: helperEvidenceRoot,
    packageRoot: helperPackageRoot,
    scratchRoot
  });
  helperIdentity = deriveHelperIdentity();
});

test.after(() => {
  if (sharedRoot) fs.rmSync(sharedRoot, { force: true, recursive: true });
});

function makeWitness() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const rawPublicKey = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  return {
    privateKey,
    trusted: {
      compromisedAtUtc: null,
      keyId: "physical-witness-key-001",
      publicKey: rawPublicKey.toString("base64"),
      revokedAtUtc: null,
      role: "physical-durability-observer",
      status: "active",
      validFromUtc: "2026-08-19T00:00:00Z",
      validUntilUtc: "2027-08-19T00:00:00Z",
      witnessId: "physical-witness-001"
    }
  };
}

function signDocument(body, signedAtUtc, witness, privateKey = witness.privateKey) {
  const payloadBytes = canonicalizeVnextJcsBytes(body);
  const signingBytes = Buffer.concat([
    Buffer.from(signatureDomain, "utf8"),
    Buffer.from([0]),
    payloadBytes
  ]);
  return {
    ...body,
    witness: {
      keyId: witness.trusted.keyId,
      signature: crypto.sign(null, signingBytes, privateKey).toString("base64"),
      signatureDomain,
      signedAtUtc,
      signedPayloadSha256: sha256(payloadBytes),
      witnessId: witness.trusted.witnessId
    }
  };
}

function platformFilesystem() {
  return helperIdentity.operatingSystem === "windows" ? "ntfs" : "ext4";
}

function expectedState() {
  return {
    activationMarker: { byteCount: 96, sha256: hashText("activation-marker") },
    armedMarker: { byteCount: 64, sha256: hashText("armed-marker") },
    targetPayload: { byteCount: 4096, sha256: hashText("target-payload") }
  };
}

function buildDocuments({
  mutatePreregistration = null,
  mutatePreInterruption = null,
  mutatePostRestart = null,
  postSigningKey = null,
  witness = makeWitness()
} = {}) {
  const common = {
    filesystem: platformFilesystem(),
    helper: clone(helperIdentity),
    machineIdentitySha256: hashText("machine-identity"),
    preBootIdentitySha256: hashText("pre-boot-identity"),
    storageCacheClass: "volatile-without-power-loss-protection",
    targetId: "durability-target-001",
    testId: "controlled-power-loss-test-001",
    volumeIdentitySha256: hashText("volume-identity")
  };
  const preregistrationBody = {
    schema: profile.schemas.preregistration,
    ...common,
    expectedState: expectedState(),
    maximumObservationDelaySeconds: 60,
    plannedInterruptionClass: "managed-pdu-power-cut",
    registeredAtUtc: "2026-08-20T00:00:00Z",
    witnessChallengeSha256: hashText("witness-challenge")
  };
  if (mutatePreregistration) mutatePreregistration(preregistrationBody);
  const preregistration = signDocument(
    preregistrationBody, "2026-08-20T00:00:01Z", witness);
  const preregistrationBytes = canonicalizeVnextJcsBytes(preregistration);
  const preInterruptionBody = {
    schema: profile.schemas.preInterruption,
    ...common,
    armedMarkerPresent: true,
    gracefulDisarmMarkerPresent: false,
    gracefulShutdownRequested: false,
    interruptionAuthorized: true,
    observedState: clone(preregistration.expectedState),
    plannedInterruptionClass: preregistration.plannedInterruptionClass,
    preregistrationSha256: sha256(preregistrationBytes),
    recordedAtUtc: "2026-08-20T00:00:02Z"
  };
  if (mutatePreInterruption) mutatePreInterruption(preInterruptionBody);
  const preInterruption = signDocument(
    preInterruptionBody, "2026-08-20T00:00:03Z", witness);
  const preInterruptionBytes = canonicalizeVnextJcsBytes(preInterruption);
  const postRestartBody = {
    schema: profile.schemas.postRestart,
    ...common,
    armedMarkerPresent: true,
    bootIdentityChanged: true,
    gracefulDisarmMarkerPresent: false,
    gracefulShutdownObserved: false,
    interruptionObserved: preregistration.plannedInterruptionClass,
    observedAtUtc: "2026-08-20T00:00:13Z",
    observedState: clone(preregistration.expectedState),
    postBootIdentitySha256: hashText("post-boot-identity"),
    preInterruptionRecordSha256: sha256(preInterruptionBytes),
    preregistrationSha256: sha256(preregistrationBytes)
  };
  if (mutatePostRestart) mutatePostRestart(postRestartBody);
  const postRestart = signDocument(
    postRestartBody,
    "2026-08-20T00:00:14Z",
    witness,
    postSigningKey ?? witness.privateKey
  );
  return { postRestart, preInterruption, preregistration, witness };
}

function writeDocuments(root, documents) {
  fs.mkdirSync(root);
  for (const [name, fileName] of Object.entries(profile.evidenceFiles)) {
    fs.writeFileSync(path.join(root, fileName),
      canonicalizeVnextJcsBytes(documents[name]));
  }
}

function fixture(context, options = {}) {
  const root = makeRoot(context, "tinyrustlm-controlled-power-loss-");
  const evidenceRoot = path.join(root, "evidence");
  const documents = buildDocuments(options);
  writeDocuments(evidenceRoot, documents);
  return {
    documents,
    evidenceRoot,
    options: {
      evidenceRoot,
      helperEvidenceRoot,
      helperPackageRoot,
      trustedWitness: documents.witness.trusted,
      verificationTimeUtc
    }
  };
}

function throwsCode(callback, code) {
  assert.throws(callback, (error) => error?.code === code, `expected ${code}`);
}

function refinalizeReceipt(receipt) {
  const body = clone(receipt);
  delete body.receiptId;
  delete body.canonicalContentSha256;
  const digest = crypto.createHash("sha256")
    .update(Buffer.from(profile.receiptIdentityDomain, "utf8"))
    .update(Buffer.from([0]))
    .update(canonicalizeVnextJcsBytes(body))
    .digest("hex");
  return canonicalizeVnextJcsBytes({
    ...body,
    receiptId: `sha256:${digest}`,
    canonicalContentSha256: digest
  });
}

test("freezes one controlled physical power-loss verification contract", () => {
  assert.equal(controlledPowerLossVerificationProfileId,
    "tinyrustlm.vnext.controlled-power-loss-verification.v1");
  assert.match(controlledPowerLossVerificationProfileSha256, /^[a-f0-9]{64}$/u);
  assert.match(verificationSourceClosureSha256, /^[a-f0-9]{64}$/u);
  assert.equal(profile.status, "frozen");
  assert.equal(profile.signatureAlgorithm, "ed25519");
  assert.equal(profile.witnessRole, "physical-durability-observer");
  assert.deepEqual(profile.helper.acceptedTrustClasses,
    ["local-test-build", "release-package"]);
  assert.equal(profile.nonClaims.some((entry) =>
    /never initiates a shutdown, restart, power cut, signature/u.test(entry)), true);
});

test("verifies three signed records while retaining fixture-only authority", (context) => {
  const current = fixture(context);
  const result = verifyControlledPowerLossEvidence(current.options);
  assert.equal(result.receipt.verdict, "fixture-only");
  assert.equal(result.receipt.evidenceTier, "fixture-only");
  assert.equal(result.receipt.signedWitnessDocumentsVerified, true);
  assert.equal(result.receipt.witnessCurrentlyTrusted, true);
  assert.equal(result.receipt.observationDelaySeconds, 10);
  assert.equal(result.receipt.helper.trustClass, "local-test-build");
  assert.equal(result.receipt.broadDurabilityClaimAuthorized, false);
  assert.equal(result.receipt.releaseAuthorized, false);
  assert.equal(result.receipt.campaignProgressAuthorized, false);
  assert.equal(result.receipt.interruptionClass, "managed-pdu-power-cut");
  assert.equal(result.receipt.verificationTimeUtc, verificationTimeUtc);
  assert.deepEqual(validateControlledPowerLossVerificationReceipt(result.bytes).receipt,
    result.receipt);
  assert.notEqual(result.bytes, result.bytes);
  const publicText = result.bytes.toString("utf8");
  assert.equal(publicText.includes(current.evidenceRoot), false);
  assert.equal(publicText.includes(helperPackageRoot), false);
  assert.equal(publicText.includes(current.documents.witness.trusted.publicKey), false);
});

test("rejects witness tampering, key substitution, and untrusted caller material", (context) => {
  const tampered = fixture(context);
  const postPath = path.join(tampered.evidenceRoot, profile.evidenceFiles.postRestart);
  const post = clone(tampered.documents.postRestart);
  post.witness.signature = `${post.witness.signature[0] === "A" ? "B" : "A"}${
    post.witness.signature.slice(1)}`;
  fs.writeFileSync(postPath, canonicalizeVnextJcsBytes(post));
  throwsCode(() => verifyControlledPowerLossEvidence(tampered.options),
    "controlled_power_loss_witness_signature_invalid");

  const replacement = crypto.generateKeyPairSync("ed25519");
  const substituted = fixture(context, { postSigningKey: replacement.privateKey });
  throwsCode(() => verifyControlledPowerLossEvidence(substituted.options),
    "controlled_power_loss_witness_signature_invalid");

  const accessor = fixture(context);
  const trusted = clone(accessor.options.trustedWitness);
  Object.defineProperty(trusted, "publicKey", {
    enumerable: true,
    get() { throw new Error("must not execute"); }
  });
  throwsCode(() => verifyControlledPowerLossEvidence({
    ...accessor.options,
    trustedWitness: trusted
  }), "controlled_power_loss_trusted_witness_invalid");
});

test("rejects unchanged boots, machine drift, marker lies, and readback drift", (context) => {
  const unchanged = fixture(context, {
    mutatePostRestart(value) {
      value.postBootIdentitySha256 = value.preBootIdentitySha256;
    }
  });
  throwsCode(() => verifyControlledPowerLossEvidence(unchanged.options),
    "controlled_power_loss_boot_identity_unchanged");

  const machine = fixture(context, {
    mutatePostRestart(value) {
      value.machineIdentitySha256 = hashText("different-machine");
    }
  });
  throwsCode(() => verifyControlledPowerLossEvidence(machine.options),
    "controlled_power_loss_binding_invalid");

  const marker = fixture(context, {
    mutatePostRestart(value) {
      value.gracefulDisarmMarkerPresent = true;
    }
  });
  throwsCode(() => verifyControlledPowerLossEvidence(marker.options),
    "controlled_power_loss_marker_state_invalid");

  const payload = fixture(context, {
    mutatePostRestart(value) {
      value.observedState.targetPayload.sha256 = hashText("changed-payload");
    }
  });
  throwsCode(() => verifyControlledPowerLossEvidence(payload.options),
    "controlled_power_loss_state_mismatch");
});

test("rejects stale preregistration, impossible chronology, and excessive delay", (context) => {
  const stale = fixture(context);
  const prePath = path.join(stale.evidenceRoot, profile.evidenceFiles.preInterruption);
  const pre = clone(stale.documents.preInterruption);
  pre.preregistrationSha256 = "0".repeat(64);
  const resigned = signDocument(
    Object.fromEntries(Object.entries(pre).filter(([name]) => name !== "witness")),
    pre.witness.signedAtUtc,
    stale.documents.witness
  );
  fs.writeFileSync(prePath, canonicalizeVnextJcsBytes(resigned));
  throwsCode(() => verifyControlledPowerLossEvidence(stale.options),
    "controlled_power_loss_binding_invalid");

  const chronology = fixture(context, {
    mutatePreInterruption(value) {
      value.recordedAtUtc = "2026-08-19T23:59:59Z";
    }
  });
  throwsCode(() => verifyControlledPowerLossEvidence(chronology.options),
    "controlled_power_loss_timeline_invalid");

  const delay = fixture(context, {
    mutatePreregistration(value) {
      value.maximumObservationDelaySeconds = 5;
    }
  });
  throwsCode(() => verifyControlledPowerLossEvidence(delay.options),
    "controlled_power_loss_observation_delay_invalid");
});

test("rejects helper identity substitution and unsupported platform claims", (context) => {
  const helper = fixture(context, {
    mutatePostRestart(value) {
      value.helper.executableSha256 = "f".repeat(64);
    }
  });
  throwsCode(() => verifyControlledPowerLossEvidence(helper.options),
    "controlled_power_loss_helper_binding_invalid");

  const filesystem = fixture(context, {
    mutatePreregistration(value) {
      value.filesystem = value.filesystem === "ntfs" ? "ext4" : "ntfs";
    }
  });
  throwsCode(() => verifyControlledPowerLossEvidence(filesystem.options),
    "controlled_power_loss_platform_invalid");
});

test("rejects noncanonical, additional, linked, relative, and overlapping evidence roots",
  (context) => {
    const noncanonical = fixture(context);
    const preregistrationPath = path.join(noncanonical.evidenceRoot,
      profile.evidenceFiles.preregistration);
    fs.writeFileSync(preregistrationPath,
      `${JSON.stringify(noncanonical.documents.preregistration, null, 2)}\n`);
    throwsCode(() => verifyControlledPowerLossEvidence(noncanonical.options),
      "controlled_power_loss_preregistration_invalid");

    const additional = fixture(context);
    fs.writeFileSync(path.join(additional.evidenceRoot, "unexpected.json"), "{}\n");
    throwsCode(() => verifyControlledPowerLossEvidence(additional.options),
      "controlled_power_loss_evidence_file_set_invalid");

    const linked = fixture(context);
    const linkRoot = path.join(path.dirname(linked.evidenceRoot), "evidence-link");
    fs.symlinkSync(linked.evidenceRoot, linkRoot,
      process.platform === "win32" ? "junction" : "dir");
    throwsCode(() => verifyControlledPowerLossEvidence({
      ...linked.options,
      evidenceRoot: linkRoot
    }), "controlled_power_loss_evidence_path_invalid");

    const relative = fixture(context);
    throwsCode(() => verifyControlledPowerLossEvidence({
      ...relative.options,
      evidenceRoot: "relative-evidence"
    }), "controlled_power_loss_options_invalid");

    const overlap = fixture(context);
    throwsCode(() => verifyControlledPowerLossEvidence({
      ...overlap.options,
      helperEvidenceRoot: overlap.evidenceRoot
    }), "controlled_power_loss_roots_overlap");
  });

test("rejects refreshed identities that inflate fixture or authorization claims", (context) => {
  const current = fixture(context);
  const result = verifyControlledPowerLossEvidence(current.options);
  const promoted = clone(result.receipt);
  promoted.verdict = "pass";
  promoted.evidenceTier = "physical-executed";
  throwsCode(() => validateControlledPowerLossVerificationReceipt(
    refinalizeReceipt(promoted)), "controlled_power_loss_verification_receipt_invalid");

  const authorized = clone(result.receipt);
  authorized.releaseAuthorized = true;
  throwsCode(() => validateControlledPowerLossVerificationReceipt(
    refinalizeReceipt(authorized)), "controlled_power_loss_verification_receipt_invalid");

  const broad = clone(result.receipt);
  broad.broadDurabilityClaimAuthorized = true;
  throwsCode(() => validateControlledPowerLossVerificationReceipt(
    refinalizeReceipt(broad)), "controlled_power_loss_verification_receipt_invalid");
});
