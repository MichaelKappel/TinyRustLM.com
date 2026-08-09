"use strict";

const {
  validateVnextIdentityDocumentBytes
} = require("./vnext-content-identity.js");
const {
  validateVnextReceiptBytes
} = require("./vnext-receipt-identity.js");
const {
  signatureProfile,
  utcNanoseconds,
  verifyVnextSignaturePrimitive
} = require("./vnext-signature-payload.js");
const {
  failEvidence
} = require("./vnext-evidence-error.js");

const expectedInputFields = Object.freeze([
  "campaignId",
  "environment",
  "expectedTerminalRegistryReceiptId",
  "receiptBytes",
  "subjectBytes",
  "trustedRootRegistryReceiptId",
  "verificationTimeUtc"
].sort());
const safeIdPattern = /^[a-z0-9][a-z0-9._:-]{2,159}$/u;
const contentIdPattern = /^sha256:[a-f0-9]{64}$/u;
const environments = new Set(["development", "production", "staging"]);
const statusTransitions = Object.freeze({
  active: new Set(["active", "retired", "revoked"]),
  retired: new Set(["retired", "revoked"]),
  revoked: new Set(["revoked"])
});

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactDataObject(value, expected, code) {
  if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length !== 0) {
    failEvidence(code, "authority-input");
  }
  const names = Object.getOwnPropertyNames(value);
  const actual = [...names].sort();
  if (actual.length !== expected.length ||
      actual.some((name, index) => name !== expected[index])) {
    failEvidence(code, "authority-input");
  }
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence(code, "authority-input");
    }
  }
}

function exactDataArray(value, maximum, code) {
  if (!Array.isArray(value) || value.length > maximum ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    failEvidence(code, "authority-input");
  }
  const names = Object.getOwnPropertyNames(value);
  if (names.length !== value.length + 1 || names[names.length - 1] !== "length") {
    failEvidence(code, "authority-input");
  }
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence(code, "authority-input");
    }
  }
}

function normalizedBytes(value, code) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof Uint8Array) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }
  failEvidence(code, "authority-input");
}

function boundedByteArray(value, maximumCount, maximumBytes, code) {
  exactDataArray(value, maximumCount, code);
  const result = [];
  let totalBytes = 0;
  for (const item of value) {
    const bytes = normalizedBytes(item, code);
    totalBytes += bytes.length;
    if (!Number.isSafeInteger(totalBytes) || totalBytes > maximumBytes) {
      failEvidence(code, "authority-input");
    }
    result.push(bytes);
  }
  return result;
}

function requiredTime(value, code, step = "authority-time") {
  const parsed = utcNanoseconds(value);
  if (parsed === null) failEvidence(code, step);
  return parsed;
}

function keyMap(registry) {
  return new Map(registry.receipt.authorityRegistry.keys.map((key) => [key.keyId, key]));
}

function receiptId(entry) {
  return entry.receipt.receiptId;
}

function registryTimes(entry) {
  const authority = entry.receipt.authorityRegistry;
  return {
    effective: requiredTime(authority.effectiveAtUtc, "authority_registry_time_invalid"),
    expires: requiredTime(authority.expiresAtUtc, "authority_registry_time_invalid")
  };
}

function parseInputs(input) {
  exactDataObject(input, expectedInputFields, "authority_input_fields_invalid");
  if (typeof input.campaignId !== "string" || !safeIdPattern.test(input.campaignId) ||
      !environments.has(input.environment) ||
      !contentIdPattern.test(input.trustedRootRegistryReceiptId) ||
      !contentIdPattern.test(input.expectedTerminalRegistryReceiptId)) {
    failEvidence("authority_input_value_invalid", "authority-input");
  }
  const verificationTime = requiredTime(input.verificationTimeUtc,
    "authority_verification_time_invalid", "authority-input");
  const receiptBytes = boundedByteArray(input.receiptBytes,
    signatureProfile.limits.maximumReceipts,
    signatureProfile.limits.maximumTotalReceiptBytes,
    "authority_receipt_input_invalid");
  const subjectBytes = boundedByteArray(input.subjectBytes,
    signatureProfile.limits.maximumSubjectDocuments,
    signatureProfile.limits.maximumTotalSubjectBytes,
    "authority_subject_input_invalid");
  return {
    ...input,
    receiptBytes,
    subjectBytes,
    verificationTime
  };
}

function parseDocuments(input) {
  const receipts = [];
  const receiptsById = new Map();
  for (const bytes of input.receiptBytes) {
    const entry = validateVnextReceiptBytes(bytes);
    const id = receiptId(entry);
    if (receiptsById.has(id)) failEvidence("authority_receipt_duplicate", "authority-graph");
    if (entry.receipt.campaignId !== input.campaignId) {
      failEvidence("authority_campaign_mismatch", "authority-graph");
    }
    receiptsById.set(id, entry);
    receipts.push(entry);
  }

  const subjectsById = new Map();
  for (const bytes of input.subjectBytes) {
    const subject = validateVnextIdentityDocumentBytes(bytes);
    if (subject.contractClass === "receipt") {
      failEvidence("authority_subject_receipt_wrong_collection", "authority-graph");
    }
    if (subjectsById.has(subject.subjectId) || receiptsById.has(subject.subjectId)) {
      failEvidence("authority_subject_duplicate", "authority-graph");
    }
    if (Object.hasOwn(subject.value, "campaignId") &&
        subject.value.campaignId !== input.campaignId) {
      failEvidence("authority_campaign_mismatch", "authority-graph");
    }
    subjectsById.set(subject.subjectId, subject);
  }
  return { receipts, receiptsById, subjectsById };
}

function authorityRegistries(documents, input) {
  const registries = documents.receipts.filter((entry) =>
    entry.receipt.receiptType === "authority-registry");
  if (registries.length === 0 ||
      registries.length > signatureProfile.limits.maximumAuthorityRegistries) {
    failEvidence("authority_registry_count_invalid", "authority-chain");
  }
  const byId = new Map(registries.map((entry) => [receiptId(entry), entry]));
  const root = byId.get(input.trustedRootRegistryReceiptId);
  const terminal = byId.get(input.expectedTerminalRegistryReceiptId);
  if (!root) failEvidence("trusted_root_registry_missing", "authority-chain");
  if (!terminal) failEvidence("terminal_registry_missing", "authority-chain");

  for (const entry of registries) {
    const authority = entry.receipt.authorityRegistry;
    if (authority.environment !== input.environment) {
      failEvidence("authority_registry_environment_mismatch", "authority-chain");
    }
    if (authority.allowedClockSkewSeconds >
        signatureProfile.timePolicy.maximumClockSkewSeconds) {
      failEvidence("authority_registry_clock_skew_invalid", "authority-chain");
    }
  }
  if (root.receipt.authorityRegistry.previousRegistryReceiptId !== null) {
    failEvidence("trusted_root_registry_not_root", "authority-chain");
  }

  const children = new Map();
  for (const entry of registries) {
    const previous = entry.receipt.authorityRegistry.previousRegistryReceiptId;
    if (previous === null) continue;
    const values = children.get(previous) ?? [];
    values.push(receiptId(entry));
    children.set(previous, values);
  }
  if ([...children.values()].some((values) => values.length > 1)) {
    failEvidence("authority_registry_fork", "authority-chain");
  }

  const reversed = [];
  const visited = new Set();
  let cursor = terminal;
  while (cursor) {
    const id = receiptId(cursor);
    if (visited.has(id)) failEvidence("authority_registry_cycle", "authority-chain");
    if (reversed.length >= signatureProfile.limits.maximumRegistryDepth) {
      failEvidence("authority_registry_depth_exceeded", "authority-chain");
    }
    visited.add(id);
    reversed.push(cursor);
    const previous = cursor.receipt.authorityRegistry.previousRegistryReceiptId;
    if (previous === null) break;
    cursor = byId.get(previous);
    if (!cursor) failEvidence("authority_registry_predecessor_missing", "authority-chain");
  }
  const chain = reversed.reverse();
  if (receiptId(chain[0]) !== receiptId(root)) {
    failEvidence("trusted_root_registry_chain_mismatch", "authority-chain");
  }
  if (chain.length !== registries.length) {
    failEvidence("authority_registry_unlinked", "authority-chain");
  }

  for (let index = 0; index < chain.length; index += 1) {
    const current = chain[index];
    const currentTimes = registryTimes(current);
    if (currentTimes.expires <= currentTimes.effective) {
      failEvidence("authority_registry_time_invalid", "authority-chain");
    }
    if (index === 0) continue;
    const previous = chain[index - 1];
    const previousTimes = registryTimes(previous);
    if (current.receipt.authorityRegistry.previousRegistryReceiptId !== receiptId(previous) ||
        currentTimes.effective <= previousTimes.effective) {
      failEvidence("authority_registry_rollback", "authority-chain");
    }
    if (currentTimes.effective > previousTimes.expires) {
      failEvidence("authority_registry_gap", "authority-chain");
    }
  }
  return { byId, chain, root, terminal };
}

function signaturesBySubjectAndScope(signatureReceipts) {
  const result = new Map();
  for (const entry of signatureReceipts) {
    const envelope = entry.receipt.signatureEnvelope;
    const key = `${envelope.signedSubjectId}\0${envelope.scope}`;
    const values = result.get(key) ?? [];
    values.push(entry);
    result.set(key, values);
  }
  return result;
}

function requireOneSignature(index, subjectId, scope, missingCode, duplicateCode) {
  const values = index.get(`${subjectId}\0${scope}`) ?? [];
  if (values.length === 0) failEvidence(missingCode, "authority-governance");
  if (values.length !== 1) failEvidence(duplicateCode, "authority-governance");
  return values[0];
}

function validateKeyContinuity(previous, successor) {
  const before = keyMap(previous);
  const after = keyMap(successor);
  for (const [keyId, oldKey] of before) {
    const newKey = after.get(keyId);
    if (!newKey) failEvidence("registry_key_removed", "authority-chain");
    if (newKey.signerId !== oldKey.signerId || newKey.role !== oldKey.role ||
        newKey.publicKey !== oldKey.publicKey ||
        newKey.validFromUtc !== oldKey.validFromUtc) {
      failEvidence("registry_key_material_changed", "authority-chain");
    }
    if (oldKey.validUntilUtc !== null && newKey.validUntilUtc !== oldKey.validUntilUtc) {
      failEvidence("registry_key_validity_changed", "authority-chain");
    }
    if (oldKey.validUntilUtc === null && newKey.validUntilUtc !== null &&
        requiredTime(newKey.validUntilUtc, "registry_key_validity_changed") <
        registryTimes(successor).effective) {
      failEvidence("registry_key_validity_changed", "authority-chain");
    }
    if (!statusTransitions[oldKey.status].has(newKey.status)) {
      failEvidence("registry_key_status_rollback", "authority-chain");
    }
  }
  for (const [keyId, key] of after) {
    if (!before.has(keyId) && key.status !== "active") {
      failEvidence("registry_new_key_not_active", "authority-chain");
    }
  }
}

function transitionKey(predecessorId, successorId, keyId) {
  return `${predecessorId}\0${successorId}\0${keyId}`;
}

function validateRevocations(documents, registries, signatureIndex) {
  const revocationReceipts = documents.receipts.filter((entry) =>
    entry.receipt.receiptType === "key-revocation");
  if (revocationReceipts.length > signatureProfile.limits.maximumRevocations) {
    failEvidence("authority_revocation_count_invalid", "authority-revocation");
  }
  const byTransitionKey = new Map();
  const historyByKey = new Map();
  for (const entry of revocationReceipts) {
    const revocation = entry.receipt.keyRevocation;
    const predecessor = registries.byId.get(revocation.predecessorRegistryReceiptId);
    const successor = registries.byId.get(revocation.authorityRegistryReceiptId);
    if (!predecessor || !successor ||
        successor.receipt.authorityRegistry.previousRegistryReceiptId !== receiptId(predecessor)) {
      failEvidence("revocation_registry_chain_invalid", "authority-revocation");
    }
    if (revocation.effectiveAtUtc !== successor.receipt.authorityRegistry.effectiveAtUtc) {
      failEvidence("revocation_effective_time_mismatch", "authority-revocation");
    }
    const oldKey = keyMap(predecessor).get(revocation.keyId);
    const newKey = keyMap(successor).get(revocation.keyId);
    if (!oldKey || !newKey || oldKey.role !== revocation.role ||
        newKey.status !== "revoked" || oldKey.status === "revoked") {
      failEvidence("revocation_key_transition_invalid", "authority-revocation");
    }
    if (revocation.replacementKeyId !== null) {
      const replacement = keyMap(successor).get(revocation.replacementKeyId);
      if (!replacement || replacement.status !== "active" || replacement.role !== revocation.role) {
        failEvidence("revocation_replacement_invalid", "authority-revocation");
      }
    }
    const key = transitionKey(receiptId(predecessor), receiptId(successor), revocation.keyId);
    if (byTransitionKey.has(key)) {
      failEvidence("registry_revocation_receipt_duplicate", "authority-revocation");
    }
    byTransitionKey.set(key, entry);
    const history = historyByKey.get(revocation.keyId) ?? [];
    history.push({ entry, revocation });
    historyByKey.set(revocation.keyId, history);

    const signature = requireOneSignature(signatureIndex, receiptId(entry), "key-revocation",
      "revocation_signature_missing", "revocation_signature_duplicate");
    if (signature.receipt.signatureEnvelope.authorityRegistryReceiptId !== receiptId(predecessor)) {
      failEvidence("revocation_signature_registry_mismatch", "authority-revocation");
    }
  }

  for (let index = 1; index < registries.chain.length; index += 1) {
    const predecessor = registries.chain[index - 1];
    const successor = registries.chain[index];
    validateKeyContinuity(predecessor, successor);
    const before = keyMap(predecessor);
    const after = keyMap(successor);
    for (const [keyId, oldKey] of before) {
      const newKey = after.get(keyId);
      const key = transitionKey(receiptId(predecessor), receiptId(successor), keyId);
      const revocation = byTransitionKey.get(key);
      if (oldKey.status !== "revoked" && newKey.status === "revoked" && !revocation) {
        failEvidence("registry_revocation_receipt_missing", "authority-revocation");
      }
      if (!(oldKey.status !== "revoked" && newKey.status === "revoked") && revocation) {
        failEvidence("registry_revocation_receipt_unexpected", "authority-revocation");
      }
    }
  }
  if (byTransitionKey.size !== revocationReceipts.length) {
    failEvidence("registry_revocation_receipt_unlinked", "authority-revocation");
  }
  return { historyByKey, revocationReceipts };
}

function registryAtIssue(chain, issuedAt) {
  let selected = null;
  for (const entry of chain) {
    const times = registryTimes(entry);
    if (times.effective <= issuedAt && issuedAt < times.expires) selected = entry;
  }
  return selected;
}

function signedSubject(documents, envelope) {
  if (envelope.signedSchema === "tinyrustlm.vnext.receipt.v1") {
    const entry = documents.receiptsById.get(envelope.signedSubjectId);
    if (!entry) failEvidence("signature_subject_missing", "authority-signature");
    return {
      schema: entry.receipt.schema,
      subjectId: receiptId(entry),
      canonicalContentSha256: entry.receipt.canonicalContentSha256,
      value: entry.receipt,
      receipt: entry
    };
  }
  const entry = documents.subjectsById.get(envelope.signedSubjectId);
  if (!entry) failEvidence("signature_subject_missing", "authority-signature");
  return {
    schema: entry.schema,
    subjectId: entry.subjectId,
    canonicalContentSha256: entry.canonicalContentSha256,
    value: entry.value,
    receipt: null
  };
}

function validateReceiptBindings(signatureReceipt, subject, registryId, issuedAt) {
  const receipt = signatureReceipt.receipt;
  if (!receipt.inputReceiptIds.includes(registryId)) {
    failEvidence("signature_registry_input_missing", "authority-signature");
  }
  if (subject.receipt) {
    if (!receipt.inputReceiptIds.includes(subject.subjectId)) {
      failEvidence("signature_subject_receipt_input_missing", "authority-signature");
    }
  } else if (!receipt.inputHashes.some((entry) =>
    entry.name === signatureProfile.receiptBindings.nonReceiptSubjectInputHashName &&
    entry.sha256 === subject.canonicalContentSha256)) {
    failEvidence("signature_subject_hash_binding_missing", "authority-signature");
  }
  const started = requiredTime(receipt.startedAtUtc, "signature_receipt_time_invalid");
  const completed = requiredTime(receipt.completedAtUtc, "signature_receipt_time_invalid");
  if (issuedAt < started || issuedAt > completed) {
    failEvidence("signature_issue_outside_receipt_time", "authority-signature");
  }
}

function validateScopeSemantics(envelope, subject, authorityRegistry) {
  if (subject.schema !== envelope.signedSchema) {
    failEvidence("signature_subject_schema_mismatch", "authority-signature");
  }
  if (envelope.scope === "authority-registry") {
    if (!subject.receipt || subject.value.receiptType !== "authority-registry" ||
        subject.value.authorityRegistry.previousRegistryReceiptId !==
          envelope.authorityRegistryReceiptId) {
      failEvidence("registry_successor_signature_subject_invalid", "authority-governance");
    }
  } else if (envelope.scope === "key-revocation") {
    if (!subject.receipt || subject.value.receiptType !== "key-revocation" ||
        subject.value.keyRevocation.predecessorRegistryReceiptId !==
          envelope.authorityRegistryReceiptId) {
      failEvidence("revocation_signature_subject_invalid", "authority-governance");
    }
  } else if (envelope.scope === "outside-proof") {
    const proof = subject.value;
    if (subject.schema !== "tinyrustlm.vnext.outside_proof.v2" ||
        proof.observerId !== envelope.signerId ||
        proof.observerRegistryId !== envelope.authorityRegistryReceiptId ||
        proof.campaignId !== envelope.campaignId ||
        proof.nonceHash !== envelope.nonceHash ||
        proof.issuedAtUtc !== envelope.issuedAtUtc ||
        proof.expiresAtUtc !== envelope.expiresAtUtc) {
      failEvidence("outside_proof_signature_binding_invalid", "authority-signature");
    }
  }
  if (authorityRegistry.receipt.receiptId !== envelope.authorityRegistryReceiptId) {
    failEvidence("signature_authority_registry_mismatch", "authority-signature");
  }
}

function issueInsideWindow(issuedAt, registry, key) {
  const times = registryTimes(registry);
  const keyStart = requiredTime(key.validFromUtc, "authority_key_time_invalid");
  const keyEnd = key.validUntilUtc === null
    ? null
    : requiredTime(key.validUntilUtc, "authority_key_time_invalid");
  return times.effective <= issuedAt && issuedAt < times.expires &&
    keyStart <= issuedAt && (keyEnd === null || issuedAt < keyEnd);
}

function terminalRegistryCurrent(registries, verificationTime) {
  const terminal = registries.terminal;
  const times = registryTimes(terminal);
  const skew = BigInt(terminal.receipt.authorityRegistry.allowedClockSkewSeconds) *
    1_000_000_000n;
  return times.effective - skew <= verificationTime && verificationTime < times.expires + skew;
}

function revocationImpact(revocations, keyId, issuedAt) {
  let authorityAtIssue = true;
  const reasons = [];
  for (const item of revocations.historyByKey.get(keyId) ?? []) {
    const compromise = item.revocation.compromiseAtUtc === null
      ? null
      : requiredTime(item.revocation.compromiseAtUtc, "revocation_compromise_time_invalid");
    if (compromise === null) {
      reasons.push("key-compromise-time-unknown");
    } else if (compromise <= issuedAt) {
      authorityAtIssue = false;
      reasons.push("key-compromised-at-issue");
    } else {
      reasons.push("key-compromised-after-issue");
    }
  }
  return { authorityAtIssue, reasons };
}

function verifySignatures(documents, input, registries, revocations, signatureReceipts) {
  const terminalKeys = keyMap(registries.terminal);
  const nonceBindings = new Map();
  const results = [];
  const registryIsCurrent = terminalRegistryCurrent(registries, input.verificationTime);

  for (const entry of signatureReceipts) {
    const envelope = entry.receipt.signatureEnvelope;
    if (envelope.campaignId !== input.campaignId) {
      failEvidence("authority_campaign_mismatch", "authority-signature");
    }
    const registry = registries.byId.get(envelope.authorityRegistryReceiptId);
    if (!registry) {
      failEvidence("signature_authority_registry_untrusted", "authority-signature");
    }
    const subject = signedSubject(documents, envelope);
    const issuedAt = requiredTime(envelope.issuedAtUtc, "signature_time_invalid");
    const expiresAt = envelope.expiresAtUtc === null
      ? null
      : requiredTime(envelope.expiresAtUtc, "signature_time_invalid");
    validateReceiptBindings(entry, subject, receiptId(registry), issuedAt);
    validateScopeSemantics(envelope, subject, registry);

    const key = keyMap(registry).get(envelope.keyId);
    if (!key) failEvidence("signature_key_missing", "authority-signature");
    if (key.signerId !== envelope.signerId) {
      failEvidence("signature_key_signer_mismatch", "authority-signature");
    }
    if (key.role !== envelope.role) {
      failEvidence("signature_key_role_mismatch", "authority-signature");
    }
    if (!issueInsideWindow(issuedAt, registry, key) || key.status !== "active") {
      failEvidence("signature_key_not_authorized_at_issue", "authority-signature");
    }

    const governance = envelope.scope === "authority-registry" ||
      envelope.scope === "key-revocation";
    const currentAtIssue = registryAtIssue(registries.chain, issuedAt);
    if (!governance && (!currentAtIssue || receiptId(currentAtIssue) !== receiptId(registry))) {
      failEvidence("signature_registry_not_current_at_issue", "authority-signature");
    }
    if (governance) {
      const subjectEffective = subject.value.receiptType === "authority-registry"
        ? subject.value.authorityRegistry.effectiveAtUtc
        : subject.value.keyRevocation.effectiveAtUtc;
      if (issuedAt > requiredTime(subjectEffective, "governance_signature_time_invalid")) {
        failEvidence("governance_signature_after_effective_time", "authority-governance");
      }
    }

    verifyVnextSignaturePrimitive(envelope, key.publicKey);
    const nonceKey = signatureProfile.replayPolicy.bindingFields
      .map((name) => envelope[name]).join("\0");
    const prior = nonceBindings.get(nonceKey);
    if (prior && prior !== receiptId(entry)) {
      failEvidence("signature_nonce_replay", "authority-signature");
    }
    nonceBindings.set(nonceKey, receiptId(entry));

    const impact = revocationImpact(revocations, envelope.keyId, issuedAt);
    const staleReasons = [...impact.reasons];
    const terminalKey = terminalKeys.get(envelope.keyId);
    if (!registryIsCurrent) staleReasons.push("terminal-registry-not-current");
    if (expiresAt !== null && input.verificationTime >= expiresAt) {
      staleReasons.push("signature-expired");
    }
    if (!terminalKey) {
      staleReasons.push("key-not-in-terminal-registry");
    } else {
      if (terminalKey.status === "retired") staleReasons.push("key-retired");
      if (terminalKey.status === "revoked") staleReasons.push("key-revoked");
      const keyStart = requiredTime(terminalKey.validFromUtc, "authority_key_time_invalid");
      const keyEnd = terminalKey.validUntilUtc === null
        ? null
        : requiredTime(terminalKey.validUntilUtc, "authority_key_time_invalid");
      if (input.verificationTime < keyStart ||
          keyEnd !== null && input.verificationTime >= keyEnd) {
        staleReasons.push("key-not-current");
      }
    }
    const uniqueReasons = [...new Set(staleReasons)].sort();
    const temporalCurrent = registryIsCurrent &&
      (expiresAt === null || input.verificationTime < expiresAt);
    const authorityAtIssue = impact.authorityAtIssue;
    const currentEvidenceEligible = authorityAtIssue && temporalCurrent &&
      uniqueReasons.length === 0;
    if (governance && !authorityAtIssue) {
      failEvidence("governance_authority_invalid", "authority-governance");
    }
    results.push({
      signatureReceiptId: receiptId(entry),
      signedSubjectId: envelope.signedSubjectId,
      signedSchema: envelope.signedSchema,
      role: envelope.role,
      scope: envelope.scope,
      signerId: envelope.signerId,
      keyId: envelope.keyId,
      authorityRegistryReceiptId: envelope.authorityRegistryReceiptId,
      signatureVerified: true,
      authorityAtIssue,
      temporalCurrent,
      currentEvidenceEligible,
      staleReasons: uniqueReasons
    });
  }
  results.sort((left, right) =>
    left.signatureReceiptId.localeCompare(right.signatureReceiptId));
  return { results, registryIsCurrent };
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value)) deepFreeze(entry);
    if (!Object.isFrozen(value)) Object.freeze(value);
  }
  return value;
}

function verifyVnextAuthorityGraph(rawInput) {
  const input = parseInputs(rawInput);
  const documents = parseDocuments(input);
  const registries = authorityRegistries(documents, input);
  const signatureReceipts = documents.receipts.filter((entry) =>
    entry.receipt.receiptType === "signature-envelope");
  if (signatureReceipts.length > signatureProfile.limits.maximumSignatureEnvelopes) {
    failEvidence("authority_signature_count_invalid", "authority-graph");
  }
  const signatureIndex = signaturesBySubjectAndScope(signatureReceipts);
  for (let index = 1; index < registries.chain.length; index += 1) {
    const predecessor = registries.chain[index - 1];
    const successor = registries.chain[index];
    const signature = requireOneSignature(signatureIndex, receiptId(successor),
      signatureProfile.governance.successorScope,
      "registry_successor_signature_missing", "registry_successor_signature_duplicate");
    if (signature.receipt.signatureEnvelope.authorityRegistryReceiptId !==
        receiptId(predecessor)) {
      failEvidence("registry_successor_signature_registry_mismatch", "authority-governance");
    }
  }
  const revocations = validateRevocations(documents, registries, signatureIndex);
  const verified = verifySignatures(documents, input, registries, revocations,
    signatureReceipts);
  return deepFreeze({
    authorityGraphVerified: true,
    campaignId: input.campaignId,
    environment: input.environment,
    verificationTimeUtc: input.verificationTimeUtc,
    trustedRootRegistryReceiptId: receiptId(registries.root),
    terminalRegistryReceiptId: receiptId(registries.terminal),
    registryDepth: registries.chain.length,
    terminalRegistryCurrent: verified.registryIsCurrent,
    signatureCount: verified.results.length,
    currentEvidenceEligibleCount: verified.results.filter((entry) =>
      entry.currentEvidenceEligible).length,
    signatures: verified.results
  });
}

module.exports = Object.freeze({
  verifyVnextAuthorityGraph
});
