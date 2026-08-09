"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  verifyVnextAuthorityGraph
} = require("../tools/vnext-signature-authority.js");
const {
  authorityKey,
  hash,
  makeAuthorityRegistry,
  makeOutsideProof,
  makeRevocationReceipt,
  makeRootProofGraph,
  makeSignatureReceipt
} = require("./helpers/vnext-authority-fixtures.js");

function inputFrom(fixture, overrides = {}) {
  return {
    receiptBytes: fixture.receiptBytes,
    subjectBytes: fixture.subjectBytes,
    campaignId: fixture.campaignId,
    environment: fixture.environment,
    verificationTimeUtc: fixture.verificationTimeUtc,
    trustedRootRegistryReceiptId: fixture.trustedRootRegistryReceiptId,
    expectedTerminalRegistryReceiptId: fixture.expectedTerminalRegistryReceiptId,
    ...overrides
  };
}

function throwsCode(callback, code) {
  assert.throws(callback, (error) => error?.code === code, `expected ${code}`);
}

function resultForScope(result, scope) {
  return result.signatures.find((entry) => entry.scope === scope);
}

test("verifies a root-pinned current outside proof without self-asserted trust", () => {
  const fixture = makeRootProofGraph();
  const result = verifyVnextAuthorityGraph(inputFrom(fixture));
  const proof = resultForScope(result, "outside-proof");

  assert.equal(result.authorityGraphVerified, true);
  assert.equal(result.registryDepth, 1);
  assert.equal(result.terminalRegistryCurrent, true);
  assert.equal(proof.signatureVerified, true);
  assert.equal(proof.authorityAtIssue, true);
  assert.equal(proof.currentEvidenceEligible, true);
  assert.deepEqual(proof.staleReasons, []);

  throwsCode(() => verifyVnextAuthorityGraph(inputFrom(fixture, {
    trustedRootRegistryReceiptId: `sha256:${"f".repeat(64)}`
  })), "trusted_root_registry_missing");
  const missingPin = inputFrom(fixture);
  delete missingPin.trustedRootRegistryReceiptId;
  throwsCode(() => verifyVnextAuthorityGraph(missingPin), "authority_input_fields_invalid");
});

test("requires exact signed subjects, registry roles, and receipt bindings", () => {
  const fixture = makeRootProofGraph();
  throwsCode(() => verifyVnextAuthorityGraph(inputFrom(fixture, { subjectBytes: [] })),
    "signature_subject_missing");

  const wrongRole = makeRootProofGraph({ observerRole: "p2p-publisher" });
  throwsCode(() => verifyVnextAuthorityGraph(inputFrom(wrongRole)),
    "signature_key_role_mismatch");

  const badInput = { ...fixture.signature.receipt, inputHashes: [] };
  const { finalizeVnextReceipt } = require("../tools/vnext-receipt-identity.js");
  delete badInput.receiptId;
  delete badInput.canonicalContentSha256;
  const rebound = finalizeVnextReceipt(badInput);
  throwsCode(() => verifyVnextAuthorityGraph(inputFrom(fixture, {
    receiptBytes: [fixture.root.bytes, rebound.bytes]
  })), "signature_subject_hash_binding_missing");
});

test("reports expired signatures as cryptographically valid but never current", () => {
  const fixture = makeRootProofGraph({ verificationTimeUtc: "2026-08-09T02:00:00Z" });
  const result = verifyVnextAuthorityGraph(inputFrom(fixture));
  const proof = resultForScope(result, "outside-proof");

  assert.equal(proof.signatureVerified, true);
  assert.equal(proof.authorityAtIssue, true);
  assert.equal(proof.temporalCurrent, false);
  assert.equal(proof.currentEvidenceEligible, false);
  assert.deepEqual(proof.staleReasons, ["signature-expired"]);
});

test("rejects a replayed nonce binding across distinct envelope receipts", () => {
  const fixture = makeRootProofGraph();
  const replayProof = makeOutsideProof({
    label: "beta",
    authorityRegistry: fixture.root,
    observerKey: fixture.observerKey,
    nonceHash: fixture.proof.value.nonceHash
  });
  const replaySignature = makeSignatureReceipt({
    label: "beta",
    authorityRegistry: fixture.root,
    subject: replayProof,
    signingKey: fixture.observerKey,
    scope: "outside-proof",
    nonceHash: fixture.proof.value.nonceHash
  });
  throwsCode(() => verifyVnextAuthorityGraph(inputFrom(fixture, {
    receiptBytes: [...fixture.receiptBytes, replaySignature.bytes],
    subjectBytes: [...fixture.subjectBytes, replayProof.bytes]
  })), "signature_nonce_replay");
});

function successorFixture({ omitGovernance = false, substituteObserver = false,
  tamperGovernance = false } = {}) {
  const fixture = makeRootProofGraph();
  const observerRecord = substituteObserver
    ? authorityKey({ keyId: fixture.observerKey.record.keyId,
      signerId: fixture.observerKey.record.signerId,
      role: fixture.observerKey.record.role }).record
    : fixture.observerKey.record;
  const successor = makeAuthorityRegistry({
    label: "successor",
    previous: fixture.root,
    effectiveAtUtc: "2026-08-10T00:00:00Z",
    expiresAtUtc: "2027-08-01T00:00:00Z",
    keys: [observerRecord, fixture.releaseKey]
  });
  const governance = makeSignatureReceipt({
    label: "successor-governance",
    authorityRegistry: fixture.root,
    subject: successor,
    signingKey: fixture.releaseKey,
    scope: "authority-registry",
    issuedAtUtc: "2026-08-09T23:59:59Z",
    expiresAtUtc: "2026-08-10T00:59:59Z",
    tamperSignature: tamperGovernance
  });
  const receiptBytes = [fixture.root.bytes, successor.bytes];
  if (!omitGovernance) receiptBytes.push(governance.bytes);
  return {
    ...fixture,
    verificationTimeUtc: "2026-08-10T00:30:00Z",
    expectedTerminalRegistryReceiptId: successor.receipt.receiptId,
    receiptBytes,
    subjectBytes: [],
    successor,
    governance
  };
}

test("authenticates a successor registry with the predecessor governance key", () => {
  const fixture = successorFixture();
  const result = verifyVnextAuthorityGraph(inputFrom(fixture));
  const governance = resultForScope(result, "authority-registry");
  assert.equal(result.registryDepth, 2);
  assert.equal(governance.signatureVerified, true);
  assert.equal(governance.authorityAtIssue, true);
});

test("rejects missing or tampered successor governance", () => {
  const missing = successorFixture({ omitGovernance: true });
  throwsCode(() => verifyVnextAuthorityGraph(inputFrom(missing)),
    "registry_successor_signature_missing");
  const tampered = successorFixture({ tamperGovernance: true });
  throwsCode(() => verifyVnextAuthorityGraph(inputFrom(tampered)), "signature_invalid");
});

test("rejects registry forks, unlinked registries, and key substitution", () => {
  const fixture = successorFixture();
  const fork = makeAuthorityRegistry({
    label: "fork",
    previous: fixture.root,
    effectiveAtUtc: "2026-08-11T00:00:00Z",
    expiresAtUtc: "2027-08-01T00:00:00Z",
    keys: [fixture.observerKey, fixture.releaseKey]
  });
  throwsCode(() => verifyVnextAuthorityGraph(inputFrom(fixture, {
    receiptBytes: [...fixture.receiptBytes, fork.bytes]
  })), "authority_registry_fork");

  const substituted = successorFixture({ substituteObserver: true });
  throwsCode(() => verifyVnextAuthorityGraph(inputFrom(substituted)),
    "registry_key_material_changed");
});

test("rejects unlinked roots, rollback, and signing through a stale registry", () => {
  const fixture = successorFixture();
  const unrelatedKey = authorityKey({
    keyId: "unrelated-key-001",
    signerId: "unrelated-signer-001",
    role: "release-authorizer"
  });
  const unrelatedRoot = makeAuthorityRegistry({
    label: "unrelated-root",
    keys: [unrelatedKey]
  });
  throwsCode(() => verifyVnextAuthorityGraph(inputFrom(fixture, {
    receiptBytes: [...fixture.receiptBytes, unrelatedRoot.bytes]
  })), "authority_registry_unlinked");

  const rollback = makeAuthorityRegistry({
    label: "rollback",
    previous: fixture.root,
    effectiveAtUtc: "2026-08-01T00:00:00Z",
    expiresAtUtc: "2027-08-01T00:00:00Z",
    keys: [fixture.observerKey, fixture.releaseKey]
  });
  throwsCode(() => verifyVnextAuthorityGraph(inputFrom(fixture, {
    expectedTerminalRegistryReceiptId: rollback.receipt.receiptId,
    receiptBytes: [fixture.root.bytes, rollback.bytes]
  })), "authority_registry_rollback");

  const staleProof = makeOutsideProof({
    label: "stale-registry",
    authorityRegistry: fixture.root,
    observerKey: fixture.observerKey,
    observedAtUtc: "2026-08-10T00:29:59Z",
    issuedAtUtc: "2026-08-10T00:30:00Z",
    expiresAtUtc: "2026-08-10T01:30:00Z"
  });
  const staleSignature = makeSignatureReceipt({
    label: "stale-registry",
    authorityRegistry: fixture.root,
    subject: staleProof,
    signingKey: fixture.observerKey,
    scope: "outside-proof",
    issuedAtUtc: "2026-08-10T00:30:00Z",
    expiresAtUtc: "2026-08-10T01:30:00Z",
    nonceHash: staleProof.value.nonceHash
  });
  throwsCode(() => verifyVnextAuthorityGraph(inputFrom(fixture, {
    receiptBytes: [...fixture.receiptBytes, staleSignature.bytes],
    subjectBytes: [staleProof.bytes]
  })), "signature_registry_not_current_at_issue");
});

function revokedFixture({ includeRevocation = true,
  compromiseAtUtc = "2026-08-09T00:10:00Z" } = {}) {
  const fixture = makeRootProofGraph();
  const replacement = authorityKey({
    keyId: "observer-key-002",
    signerId: "observer-external-002",
    role: "outside-network-observer",
    validFromUtc: "2026-08-09T00:20:00Z"
  });
  const revokedRecord = { ...fixture.observerKey.record, status: "revoked" };
  const successor = makeAuthorityRegistry({
    label: "revoked-successor",
    previous: fixture.root,
    effectiveAtUtc: "2026-08-09T00:20:00Z",
    expiresAtUtc: "2027-08-01T00:00:00Z",
    keys: [revokedRecord, replacement, fixture.releaseKey]
  });
  const governance = makeSignatureReceipt({
    label: "revoked-successor-governance",
    authorityRegistry: fixture.root,
    subject: successor,
    signingKey: fixture.releaseKey,
    scope: "authority-registry",
    issuedAtUtc: "2026-08-09T00:19:58Z",
    expiresAtUtc: "2026-08-09T01:19:58Z"
  });
  const revocation = makeRevocationReceipt({
    label: "observer-001",
    predecessor: fixture.root,
    successor,
    key: fixture.observerKey,
    replacementKey: replacement,
    effectiveAtUtc: "2026-08-09T00:20:00Z",
    compromiseAtUtc
  });
  const revocationSignature = makeSignatureReceipt({
    label: "observer-001-revocation",
    authorityRegistry: fixture.root,
    subject: revocation,
    signingKey: fixture.releaseKey,
    scope: "key-revocation",
    issuedAtUtc: "2026-08-09T00:19:59Z",
    expiresAtUtc: "2026-08-09T01:19:59Z"
  });
  const receiptBytes = [
    ...fixture.receiptBytes,
    successor.bytes,
    governance.bytes
  ];
  if (includeRevocation) receiptBytes.push(revocation.bytes, revocationSignature.bytes);
  return {
    ...fixture,
    verificationTimeUtc: "2026-08-09T00:30:00Z",
    expectedTerminalRegistryReceiptId: successor.receipt.receiptId,
    receiptBytes,
    successor,
    replacement,
    revocation,
    revocationSignature
  };
}

test("preserves historical crypto validity while revocation makes proof stale", () => {
  const fixture = revokedFixture();
  const result = verifyVnextAuthorityGraph(inputFrom(fixture));
  const proof = resultForScope(result, "outside-proof");
  assert.equal(proof.signatureVerified, true);
  assert.equal(proof.authorityAtIssue, true);
  assert.equal(proof.currentEvidenceEligible, false);
  assert.deepEqual(proof.staleReasons, ["key-compromised-after-issue", "key-revoked"]);
});

test("marks authority invalid when compromise occurred at or before issue", () => {
  const fixture = revokedFixture({ compromiseAtUtc: "2026-08-08T00:00:00Z" });
  const result = verifyVnextAuthorityGraph(inputFrom(fixture));
  const proof = resultForScope(result, "outside-proof");
  assert.equal(proof.signatureVerified, true);
  assert.equal(proof.authorityAtIssue, false);
  assert.equal(proof.currentEvidenceEligible, false);
  assert.deepEqual(proof.staleReasons, ["key-compromised-at-issue", "key-revoked"]);
});

test("treats unknown compromise time as stale without rewriting crypto history", () => {
  const fixture = revokedFixture({ compromiseAtUtc: null });
  const result = verifyVnextAuthorityGraph(inputFrom(fixture));
  const proof = resultForScope(result, "outside-proof");
  assert.equal(proof.signatureVerified, true);
  assert.equal(proof.authorityAtIssue, true);
  assert.equal(proof.currentEvidenceEligible, false);
  assert.deepEqual(proof.staleReasons, ["key-compromise-time-unknown", "key-revoked"]);
});

test("requires one signed revocation for every revoked transition", () => {
  const fixture = revokedFixture({ includeRevocation: false });
  throwsCode(() => verifyVnextAuthorityGraph(inputFrom(fixture)),
    "registry_revocation_receipt_missing");
});

test("rejects duplicate receipt identities and hostile input accessors", () => {
  const fixture = makeRootProofGraph();
  throwsCode(() => verifyVnextAuthorityGraph(inputFrom(fixture, {
    receiptBytes: [...fixture.receiptBytes, fixture.root.bytes]
  })), "authority_receipt_duplicate");

  const hostile = inputFrom(fixture);
  Object.defineProperty(hostile, "environment", {
    enumerable: true,
    get() {
      return "production";
    }
  });
  throwsCode(() => verifyVnextAuthorityGraph(hostile), "authority_input_fields_invalid");

  throwsCode(() => verifyVnextAuthorityGraph(inputFrom(fixture, {
    receiptBytes: Array.from({
      length: 4097
    }, () => fixture.root.bytes)
  })), "authority_receipt_input_invalid");
});
