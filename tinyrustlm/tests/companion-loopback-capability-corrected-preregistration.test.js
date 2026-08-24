"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const v1Path = path.join(repositoryRoot,
  "contracts/vnext/companion-loopback-capability-preregistration.v1.json");
const v2Path = path.join(repositoryRoot,
  "contracts/vnext/companion-loopback-capability-preregistration.v2.json");
const decisionPath = path.join(repositoryRoot,
  "docs/architecture/2026-08-24-companion-loopback-capability-corrected-preregistration.md");
const v1Bytes = fs.readFileSync(v1Path);
const v2Bytes = fs.readFileSync(v2Path);
const decisionBytes = fs.readFileSync(decisionPath);
const v1 = parseStrictJson(v1Bytes, { maximumBytes: 64 * 1024 });
const v2 = parseStrictJson(v2Bytes, { maximumBytes: 64 * 1024 });

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function gitBytesAt(commit, filePath) {
  return childProcess.execFileSync("git", ["show", `${commit}:${filePath}`], {
    cwd: repositoryRoot,
    encoding: "buffer",
    maxBuffer: 2 * 1024 * 1024,
    windowsHide: true
  });
}

function parentPathExists(commit, filePath) {
  return childProcess.spawnSync("git", ["cat-file", "-e", `${commit}:${filePath}`], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true
  }).status === 0;
}

test("pins an append-only corrected registration before implementation", () => {
  assert.equal(v1Bytes.length, 39311);
  assert.equal(sha256(v1Bytes),
    "81e3f2f3795a51c0bce86e1aca66f6a7234608a3dd044cd7a9b1cbbf90c9ba77");
  assert.equal(v2Bytes.length, 22681);
  assert.equal(sha256(v2Bytes),
    "6ad07dda97ae50d8e6c3fc1a581e6742d2e18c66484a4a9864e1b3bc7a57ae81");
  assert.equal(decisionBytes.length, 13411);
  assert.equal(sha256(decisionBytes),
    "b574af05032bd52f7b37ffc831e1661eb9625e88afcf629f7e24ffc648be28f4");
  assert.equal(v2.schema,
    "tinyrustlm.companion-loopback-capability-preregistration.v2");
  assert.equal(v2.profileId, "tinyrustlm.companion.loopback-capability/2");
  assert.equal(v2.registrationParentCommit,
    "0f08fb6b53f50013220a156ebb8006e258c5c0d1");
  assert.equal(v2.registrationParentTree,
    "9137bc158e83fc35df2da77f6edfb61eafe60cb9");
  assert.equal(v2.supersededRegistration.executableAuthority, false);
  assert.equal(v2.supersededRegistration.implementationOutputOccurred, false);
  assert.equal(v2.baseProfileAdoption.runtimeReadsEitherRegistration, false);
  assert.equal(v2.baseProfileAdoption.compatibilityReaderCreated, false);
});

test("reconstructs every correction input from its exact parent tree", () => {
  assert.equal(v2.registeredSourceClosure.length, 4);
  for (const entry of v2.registeredSourceClosure) {
    const bytes = gitBytesAt(v2.registrationParentCommit, entry.path);
    assert.equal(bytes.length, entry.byteLength, entry.path);
    assert.equal(sha256(bytes), entry.sha256, entry.path);
  }
});

test("proves every planned implementation file was still absent", () => {
  for (const filePath of v1.implementationPlan.newPaths) {
    assert.equal(parentPathExists(v2.registrationParentCommit, filePath), false,
      filePath);
  }
});

test("adopts only existing exact v1 sections and three explicit replacements", () => {
  for (const key of v2.baseProfileAdoption.adoptedTopLevelKeys) {
    assert.ok(Object.hasOwn(v1, key), key);
  }
  assert.deepEqual(v2.baseProfileAdoption.replacementPointers, [
    "/cryptography/transcriptEncoding",
    "/session/requestProofFieldsInOrder",
    "/session/responseProofFieldsInOrder"
  ]);
  assert.equal(v2.baseProfileAdoption.mode,
    "exact-content-addressed-design-input-not-runtime-profile-inheritance");
});

test("freezes canonical network and installation bytes", () => {
  assert.equal(v2.canonicalWire.jsonEncoding, "utf8-without-bom");
  assert.equal(v2.canonicalWire.jsonLeadingOrTrailingWhitespaceAllowed, false);
  assert.equal(v2.canonicalWire.jsonFinalLfAllowed, false);
  assert.equal(v2.canonicalWire.jsonUnknownMembersAllowed, false);
  assert.equal(v2.canonicalWire.jsonDuplicateMembersAllowed, false);
  assert.equal(v2.canonicalWire.jsonControlStrings, "ascii-only");
  assert.equal(v2.canonicalWire.emptyBodySha256,
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.deepEqual(v2.installationRecordWire.fieldsInOrder,
    ["schema", "installationId"]);
  assert.equal(v2.installationRecordWire.fileEncoding,
    "utf8-without-bom-final-lf");
  assert.equal(v2.installationRecordWire.secretFieldAllowed, false);
});

test("freezes unambiguous framed transcript bytes", () => {
  assert.deepEqual(v2.transcriptEncoding, {
    fieldEncoding: "utf8",
    fieldPrefix: "u32-big-endian-byte-length",
    fieldOrder: "exact-listed-order",
    maximumFieldBytes: 65536,
    maximumFieldCount: 32,
    maximumTranscriptBytes: 131072,
    emptyFieldAllowedOnlyWhenExplicitlyNamed: true,
    normalizationAllowed: false,
    delimiterBytesAllowed: false
  });
  assert.equal(v2.pairingTranscripts.coreFieldsInOrder.length, 12);
  assert.equal(v2.pairingTranscripts.serverProof.fieldsInOrder[0],
    "TinyRustLM companion pairing server proof 1");
  assert.equal(v2.pairingTranscripts.browserProof.fieldsInOrder[0],
    "TinyRustLM companion pairing browser proof 1");
  assert.equal(v2.pairingTranscripts.completionProof.fieldsInOrder.at(-1),
    "complete-request-content-sha256");
});

test("freezes RFC5869 session-key extract and expand inputs", () => {
  assert.equal(v2.sessionKeyDerivation.algorithm, "HKDF-SHA-256-RFC5869");
  assert.equal(v2.sessionKeyDerivation.inputKeyMaterial,
    "raw-32-byte-pairing-secret");
  assert.equal(v2.sessionKeyDerivation.saltTranscriptFieldsInOrder[0],
    "TinyRustLM companion session capability salt 1");
  assert.equal(v2.sessionKeyDerivation.infoTranscriptFieldsInOrder[0],
    "TinyRustLM companion session capability key 1");
  assert.equal(v2.sessionKeyDerivation.outputBytes, 32);
  assert.equal(v2.sessionKeyDerivation.expand,
    "rfc5869-single-block-hmac-sha256-prk-info-0x01");
});

test("binds response metadata into every authenticated response proof", () => {
  assert.equal(v2.sessionWire.requestProofFieldsInOrder.length, 14);
  assert.deepEqual(v2.sessionWire.responseProofFieldsInOrder, [
    "TinyRustLM companion response proof 1", "protocol-id", "installation-id",
    "process-instance-id", "session-id", "key-epoch-decimal",
    "sequence-decimal", "request-method", "request-path", "status-decimal",
    "content-type", "content-length-decimal", "response-metadata-sha256",
    "content-sha256"
  ]);
  assert.equal(v2.artifactResponseMetadata.hashHeader,
    "X-TinyRustLM-Response-Metadata-SHA256");
  assert.equal(v2.artifactResponseMetadata.browserRecomputesMetadataHash, true);
  assert.equal(v2.artifactResponseMetadata.responseProofBindsMetadataHash, true);
  assert.ok(v2.artifactResponseMetadata.requiredHeadersInOrder.includes(
    "X-TinyRustLM-Artifact-Id"));
});

test("commits a sequence only after a valid proof and before dispatch", () => {
  assert.equal(v2.requestAuthenticationStateMachine.sequenceCommitPoint,
    "atomic-after-all-preauthentication-checks-and-valid-request-proof-before-route-handler");
  assert.equal(v2.requestAuthenticationStateMachine
    .validAuthenticatedContractFailureConsumesSequence, true);
  assert.equal(v2.requestAuthenticationStateMachine.invalidProofConsumesSequence, false);
  assert.equal(v2.requestAuthenticationStateMachine.wrongSequenceConsumesSequence, false);
  assert.equal(v2.requestAuthenticationStateMachine.unknownSessionConsumesSequence, false);
  assert.equal(v2.requestAuthenticationStateMachine
    .authenticatedErrorUsesSameSequenceAndResponseProof, true);
  assert.equal(v2.requestAuthenticationStateMachine.unprovedErrorTrustedByBrowser, false);
});

test("freezes rotation derivation proof and exact old-key replay", () => {
  assert.equal(v2.rotationTranscripts.keyDerivation.inputKeyMaterial,
    "current-32-byte-session-key");
  assert.equal(v2.rotationTranscripts.keyDerivation.saltTranscriptFieldsInOrder[0],
    "TinyRustLM companion rotated session salt 1");
  assert.equal(v2.rotationTranscripts.keyDerivation.infoTranscriptFieldsInOrder[0],
    "TinyRustLM companion rotated session key 1");
  assert.equal(v2.rotationTranscripts.newKeyProofFieldsInOrder[0],
    "TinyRustLM companion rotation new key proof 1");
  assert.equal(v2.rotationTranscripts.completionProofFieldsInOrder.at(-1),
    "commit-request-content-sha256");
  assert.equal(v2.rotationTranscripts.commitResponseHeaderProofKey,
    "new-session-key");
  assert.equal(v2.rotationTranscripts
    .exactOldKeyCommitReplayConsumesSequenceAgain, false);
});

test("makes operation projection exact bounded and public-safe", () => {
  assert.deepEqual(v2.operationProjectionWire.fieldsInOrder, [
    "schema", "operationId", "sequence", "state", "branch",
    "completedBytes", "totalBytes", "artifacts", "errorCode"
  ]);
  assert.deepEqual(v2.operationProjectionWire.artifactRolesInOrder, [
    "composition", "model", "tokenizer", "template", "sampling", "prompt"
  ]);
  assert.deepEqual(v2.operationProjectionWire.artifactFieldsInOrder, [
    "role", "artifactId", "sha256", "byteCount", "chunkCount"
  ]);
  assert.equal(v2.operationProjectionWire.privatePathAllowed, false);
  assert.equal(v2.operationProjectionWire.sourceUrlAllowed, false);
  assert.equal(v2.operationProjectionWire.promptAllowed, false);
});

test("maps every v1 stable error code to exactly one status", () => {
  const mapped = [];
  for (const [status, codes] of Object.entries(v2.httpErrorMap)) {
    if (/^[0-9]{3}$/u.test(status)) mapped.push(...codes);
  }
  mapped.push(v2.httpErrorMap.hostInvalidCode);
  assert.equal(v2.httpErrorMap.hostInvalidStatus, 421);
  assert.deepEqual([...mapped].sort(), [...v1.stableErrorCodes].sort());
  assert.equal(new Set(mapped).size, mapped.length);
  assert.equal(v2.httpErrorMap.oneCodeHasExactlyOneStatus, true);
  assert.equal(v2.httpErrorMap.browserTrustsUnprovedErrorCode, false);
});

test("freezes state-free current-LNA preflight bytes", () => {
  assert.equal(v2.preflightWire.status, 204);
  assert.equal(v2.preflightWire.contentLength, 0);
  assert.equal(v2.preflightWire.responseHeaders["Access-Control-Allow-Origin"],
    "https://tinyrustlm.com");
  assert.equal(v2.preflightWire.responseHeaders["Access-Control-Max-Age"], "300");
  assert.equal(v2.preflightWire.allowCredentialsHeaderPresent, false);
  assert.equal(v2.preflightWire.privateNetworkAccessHeaderPresent, false);
  assert.equal(v2.preflightWire.sessionProofHeaderPresent, false);
  assert.equal(v2.preflightWire.stateMutation, false);
});

test("creates no output authority or campaign progress", () => {
  assert.ok(Object.values(v2.registrationOutputBoundary)
    .every((value) => value === false));
  assert.ok(Object.values(v2.claimBoundary).every((value) => value === false));
  assert.deepEqual(v2.campaignCounters, {
    qualifiedModels: "0/20",
    deletionBackedBrowserRounds: "0/50",
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    liveCatalogAnnouncements: "0/20"
  });
});

test("contains no credential or forbidden private drive reference", () => {
  const text = Buffer.concat([v2Bytes, decisionBytes]).toString("utf8");
  assert.doesNotMatch(text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu);
  assert.doesNotMatch(text, /[CD]:[\\/]/u);
});
