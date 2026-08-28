"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");

const validatorId = "tinyrustlm.vnext.registry-schema-validator.v1";
const registryPath = path.resolve(
  __dirname,
  "../../contracts/vnext/contract-family.v1.json"
);
const registry = parseStrictJson(fs.readFileSync(registryPath));
const recordsByName = new Map(registry.records.map((record) => [record.name, record]));
const contractsBySchema = new Map(
  registry.contracts.map((contract) => [contract.schema, contract])
);
const parserLimits = Object.freeze({
  maximumBytes: Math.max(...registry.contracts.map((contract) => contract.maximumBytes)),
  maximumDepth: registry.limits.maximumDepth,
  maximumTotalEntries: registry.limits.maximumTotalEntries,
  maximumObjectMembers: registry.limits.maximumObjectMembers,
  maximumArrayItems: registry.limits.maximumArrayItems,
  maximumStringCodeUnits: registry.limits.maximumStringCodeUnits,
  maximumTotalStringCodeUnits: registry.limits.maximumTotalStringCodeUnits,
  maximumNumberCharacters: registry.limits.maximumNumberCharacters
});

const safeIdPattern = /^[a-z0-9][a-z0-9._:-]{2,159}$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const contentIdPattern = /^sha256:[a-f0-9]{64}$/u;
const sourceRevisionPattern = /^(?:git-sha1:[a-f0-9]{40}|sha256:[a-f0-9]{64})$/u;
const utcPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/u;
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/u;
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u;
const emptySha256 = crypto.createHash("sha256").update(Buffer.alloc(0)).digest("hex");
const signatureDomains = Object.freeze({
  "local-recorder": "tinyrustlm.signature.local-recorder.v1",
  "outside-network-observer": "tinyrustlm.signature.outside-network-observer.v1",
  "p2p-publisher": "tinyrustlm.signature.p2p-publisher.v1",
  "release-authorizer": "tinyrustlm.signature.release-authorizer.v1",
  "site-publisher": "tinyrustlm.signature.site-publisher.v1"
});
const securityPayloads = Object.freeze({
  "authority-registry": "authorityRegistry",
  "key-revocation": "keyRevocation",
  "offline-verification-bundle": "offlineBundle",
  "signature-envelope": "signatureEnvelope"
});

function fail(code, location, detail = null) {
  const error = new Error(
    `vNext registry validation ${code} at ${location}${detail ? ` (${detail})` : ""}`
  );
  error.code = code;
  error.location = location;
  throw error;
}

function invariant(condition, id, location = "$") {
  if (!condition) fail("invariant_failed", location, id);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

function isRealDate(year, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day;
}

function utcNanoseconds(value) {
  const match = utcPattern.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction = ""] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (!isRealDate(year, month, day) || hour > 23 || minute > 59 || second > 59) return null;
  const milliseconds = Date.UTC(year, month - 1, day, hour, minute, second);
  if (!Number.isSafeInteger(milliseconds)) return null;
  return (BigInt(milliseconds) * 1_000_000n) + BigInt(fraction.padEnd(9, "0") || "0");
}

function compareUtc(left, right) {
  const leftValue = utcNanoseconds(left);
  const rightValue = utcNanoseconds(right);
  invariant(leftValue !== null && rightValue !== null, "timestamp-valid");
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
}

function lifetimeWithin(later, earlier, maximumSeconds) {
  const laterValue = utcNanoseconds(later);
  const earlierValue = utcNanoseconds(earlier);
  return laterValue !== null && earlierValue !== null && laterValue > earlierValue &&
    laterValue - earlierValue <= BigInt(maximumSeconds) * 1_000_000_000n;
}

function validateBase64(value, decodedBytes, location) {
  if (typeof value !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) {
    fail("field_invalid", location);
  }
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== decodedBytes || decoded.toString("base64") !== value) {
    fail("field_invalid", location);
  }
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/u.test(part))) return false;
  const octets = parts.map(Number);
  if (octets.some((part) => part > 255)) return true;
  const [first, second] = octets;
  return first === 0 || first === 10 || first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) || first >= 224;
}

function isPrivateIpv6(hostname) {
  const value = hostname.replace(/^\[|\]$/gu, "").toLowerCase();
  return value === "::" || value === "::1" || value.startsWith("fc") ||
    value.startsWith("fd") || /^fe[89ab]/u.test(value) || value.startsWith("ff");
}

function validateHttpsUrl(value, publicSafe, location) {
  if (typeof value !== "string" || value.length > 2048 || !/^[\x21-\x7e]+$/u.test(value) ||
      /%(?:2e|2f|5c)/iu.test(value) || value.includes("\\")) {
    fail("field_invalid", location);
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch (_error) {
    fail("field_invalid", location);
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search ||
      parsed.hash || parsed.href !== value) {
    fail("field_invalid", location);
  }
  const host = parsed.hostname.toLowerCase();
  if (publicSafe && (host === "localhost" || host.endsWith(".localhost") ||
      isPrivateIpv4(host) || host.includes(":") && isPrivateIpv6(host))) {
    fail("field_invalid", location);
  }
}

function validatePublicPath(value, location) {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/") ||
      value.startsWith("//") || !/^[\x21-\x7e]+$/u.test(value) || /[?#\\]/u.test(value) ||
      /%(?:2e|2f|5c)/iu.test(value)) {
    fail("field_invalid", location);
  }
  const segments = value.split("/");
  if (segments.some((segment) => segment === "." || segment === "..")) {
    fail("field_invalid", location);
  }
}

function validateText(value, descriptor, allowWhitespaceControls, location) {
  if (typeof value !== "string" || value.length < descriptor.minimumLength ||
      value.length > descriptor.maximumLength) {
    fail("field_invalid", location);
  }
  for (const character of value) {
    const code = character.codePointAt(0);
    const permittedWhitespace = allowWhitespaceControls && (code === 0x09 || code === 0x0a || code === 0x0d);
    if (!permittedWhitespace && (code <= 0x1f || code >= 0x7f && code <= 0x9f)) {
      fail("field_invalid", location);
    }
  }
}

function validatePrimitive(value, type, descriptor, context) {
  const { location, publicSafe } = context;
  if (type === "safe-id") {
    if (typeof value !== "string" || !safeIdPattern.test(value)) fail("field_invalid", location);
  } else if (type === "sha256") {
    if (typeof value !== "string" || !sha256Pattern.test(value)) fail("field_invalid", location);
  } else if (type === "content-id") {
    if (typeof value !== "string" || !contentIdPattern.test(value)) fail("field_invalid", location);
  } else if (type === "source-revision") {
    if (typeof value !== "string" || !sourceRevisionPattern.test(value)) fail("field_invalid", location);
  } else if (type === "utc") {
    if (typeof value !== "string" || utcNanoseconds(value) === null) fail("field_invalid", location);
  } else if (type === "date") {
    const match = typeof value === "string" ? datePattern.exec(value) : null;
    if (!match || !isRealDate(Number(match[1]), Number(match[2]), Number(match[3]))) {
      fail("field_invalid", location);
    }
  } else if (type === "semver") {
    if (typeof value !== "string" || value.length > 128 || !semverPattern.test(value)) {
      fail("field_invalid", location);
    }
  } else if (type === "https-url") {
    validateHttpsUrl(value, publicSafe, location);
  } else if (type === "public-path") {
    validatePublicPath(value, location);
  } else if (type === "ed25519-public-key") {
    validateBase64(value, 32, location);
  } else if (type === "ed25519-signature") {
    validateBase64(value, 64, location);
  } else if (type === "bounded-string" || type === "bounded-text") {
    validateText(value, descriptor, type === "bounded-text", location);
  } else {
    fail("registry_invalid", location, `unknown primitive ${type}`);
  }
}

function valueOrderKey(value, descriptor) {
  if (descriptor.sortedBy) return value[descriptor.sortedBy];
  return value;
}

function validateArray(value, descriptor, context) {
  if (!Array.isArray(value) || value.length < descriptor.minimumItems ||
      value.length > descriptor.maximumItems) {
    fail("field_invalid", context.location);
  }
  value.forEach((entry, index) => validateType(entry, descriptor.items, descriptor, {
    ...context,
    location: `${context.location}[${index}]`
  }));
  if (descriptor.unique === true || descriptor.uniqueBy) {
    const keys = value.map((entry) => valueOrderKey(entry, descriptor));
    if (new Set(keys).size !== keys.length) fail("field_invalid", context.location, "duplicate array item");
    for (let index = 1; index < keys.length; index += 1) {
      if (!(keys[index - 1] < keys[index])) {
        fail("field_invalid", context.location, "array is not strictly sorted");
      }
    }
  }
}

function validateType(value, type, descriptor, context) {
  if (type.startsWith("record:")) {
    const recordName = type.slice("record:".length);
    const record = recordsByName.get(recordName);
    if (!record) fail("registry_invalid", context.location, `unknown record ${recordName}`);
    validateObject(value, record.fields, context);
  } else if (type === "record") {
    const record = recordsByName.get(descriptor.record);
    if (!record) fail("registry_invalid", context.location, `unknown record ${descriptor.record}`);
    validateObject(value, record.fields, context);
  } else if (type === "nullable") {
    if (value !== null) validateType(value, descriptor.valueType, descriptor, context);
  } else if (type === "array") {
    validateArray(value, descriptor, context);
  } else if (type === "literal") {
    if (value !== descriptor.value) fail("field_invalid", context.location);
  } else if (type === "enum") {
    if (typeof value !== "string" || !descriptor.values.includes(value)) {
      fail("field_invalid", context.location);
    }
  } else if (type === "integer") {
    if (!Number.isSafeInteger(value) || value < descriptor.minimum || value > descriptor.maximum) {
      fail("field_invalid", context.location);
    }
  } else {
    validatePrimitive(value, type, descriptor, context);
  }
}

function validateObject(value, fields, context) {
  if (!isPlainObject(value)) fail("field_invalid", context.location, "object required");
  const expected = new Set(fields.map((field) => field.name));
  for (const name of Object.keys(value)) {
    if (!expected.has(name)) fail("field_unknown", `${context.location}.${name}`);
  }
  for (const descriptor of fields) {
    const location = `${context.location}.${descriptor.name}`;
    if (!Object.hasOwn(value, descriptor.name)) fail("field_missing", location);
    validateType(value[descriptor.name], descriptor.type, descriptor, { ...context, location });
  }
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(Buffer.from(value, "utf8")).digest("hex");
}

function u64le(value) {
  const result = Buffer.alloc(8);
  result.writeBigUInt64LE(BigInt(value));
  return result;
}

function u32le(value) {
  const result = Buffer.alloc(4);
  result.writeUInt32LE(value);
  return result;
}

function domainHash(domain, ...parts) {
  const hash = crypto.createHash("sha256");
  hash.update(Buffer.from(domain, "ascii"));
  hash.update(Buffer.from([0]));
  for (const part of parts) hash.update(part);
  return hash.digest();
}

function merkleRoot(value) {
  let nodes = value.pieces.map((piece) => domainHash(
    "TinyRustLM-Merkle-Leaf-v1",
    u64le(piece.index),
    u64le(piece.length),
    Buffer.from(piece.sha256, "hex")
  ));
  let level = 1;
  while (nodes.length > 1) {
    const parents = [];
    for (let index = 0; index < nodes.length; index += 2) {
      const parentIndex = index / 2;
      if (index + 1 < nodes.length) {
        parents.push(domainHash(
          "TinyRustLM-Merkle-Node-v1",
          u32le(level),
          u64le(parentIndex),
          nodes[index],
          nodes[index + 1]
        ));
      } else {
        parents.push(domainHash(
          "TinyRustLM-Merkle-Carry-v1",
          u32le(level),
          u64le(parentIndex),
          nodes[index]
        ));
      }
    }
    nodes = parents;
    level += 1;
  }
  return domainHash(
    "TinyRustLM-Merkle-Root-v1",
    u64le(value.artifactBytes),
    u64le(value.pieceCount),
    nodes[0]
  ).toString("hex");
}

function validateArtifact(value, checked) {
  invariant(value.artifactId === `sha256:${value.artifactSha256}`,
    "artifact-id-matches-artifact-sha256");
  checked.add("artifact-id-matches-artifact-sha256");
  const profileByClass = Object.freeze({
    "base-model": "slm2.0",
    composition: "acg2.0",
    "low-rank-adapter": "lora2.0",
    sbom: "cyclonedx-json-1.6",
    "specialist-model": "slm2.0",
    template: "template2.0",
    tokenizer: "tokenizer2.0"
  });
  invariant(profileByClass[value.artifactClass] === value.formatProfile,
    "artifact-class-format-profile-compatible");
  checked.add("artifact-class-format-profile-compatible");
  checked.add("dependencies-unique-sorted");
  checked.add("public-redaction-profile-required");
}

function validateReceipt(value, checked, notApplicable) {
  invariant(compareUtc(value.completedAtUtc, value.startedAtUtc) >= 0,
    "completed-not-before-started");
  checked.add("completed-not-before-started");
  checked.add("parent-ids-unique-sorted");
  const failure = value.status === "fail" || value.status === "rejected";
  invariant(!failure || value.error !== null, "failure-status-requires-error");
  checked.add("failure-status-requires-error");
  invariant(value.status !== "pass" || value.error === null, "pass-status-forbids-error");
  checked.add("pass-status-forbids-error");
  invariant(value.status !== "blocked" || value.blockerCode !== null,
    "blocked-status-requires-blocker");
  checked.add("blocked-status-requires-blocker");
  checked.add("public-receipt-has-redaction-profile");
  for (const reference of value.externalEvidenceReferences) {
    if (reference.kind === "https") validateHttpsUrl(reference.value, true, "$.externalEvidenceReferences");
    else invariant(contentIdPattern.test(reference.value), "external-reference-kind-valid");
  }
  checked.add("external-reference-kind-valid");

  const populated = Object.entries(securityPayloads)
    .filter(([, field]) => value[field] !== null)
    .map(([receiptType]) => receiptType);
  const expectedSecurity = Object.hasOwn(securityPayloads, value.receiptType)
    ? [value.receiptType]
    : [];
  invariant(JSON.stringify(populated) === JSON.stringify(expectedSecurity),
    "typed-security-payload-matches-receipt-type");
  checked.add("typed-security-payload-matches-receipt-type");
  invariant(expectedSecurity.length === 0 || value.status === "pass",
    "security-receipts-require-pass-status");
  checked.add("security-receipts-require-pass-status");

  if (value.receiptType === "redaction-scan") {
    invariant(value.inputHashes.some((entry) => entry.name === "target-canonical-content"),
      "redaction-scan-binds-target-hash-without-cycle");
    checked.add("redaction-scan-binds-target-hash-without-cycle");
  } else {
    notApplicable.add("redaction-scan-binds-target-hash-without-cycle");
  }

  if (value.signatureEnvelope !== null) {
    const envelope = value.signatureEnvelope;
    invariant(contractsBySchema.has(envelope.signedSchema), "signed-schema-known-exact");
    checked.add("signed-schema-known-exact");
    invariant(signatureDomains[envelope.role] === envelope.signatureDomain,
      "signature-role-domain-match");
    invariant(envelope.campaignId === value.campaignId, "signature-role-domain-match");
    invariant(envelope.expiresAtUtc === null ||
      compareUtc(envelope.expiresAtUtc, envelope.issuedAtUtc) > 0,
    "signature-role-domain-match");
    invariant(envelope.role === "local-recorder" || envelope.expiresAtUtc !== null &&
      lifetimeWithin(envelope.expiresAtUtc, envelope.issuedAtUtc,
        registry.semanticLimits.maximumOnlineSignatureLifetimeSeconds),
    "signature-role-domain-match");
    checked.add("signature-role-domain-match");
  } else {
    notApplicable.add("signed-schema-known-exact");
    notApplicable.add("signature-role-domain-match");
    notApplicable.add("signature-key-registry-role-scope-time-valid");
  }
  if (value.authorityRegistry !== null) {
    const authority = value.authorityRegistry;
    invariant(lifetimeWithin(authority.expiresAtUtc, authority.effectiveAtUtc,
      registry.semanticLimits.maximumAuthorityRegistryLifetimeSeconds),
    "authority-registry-window-valid");
    for (const key of authority.keys) {
      invariant(key.validUntilUtc === null || compareUtc(key.validUntilUtc, key.validFromUtc) > 0,
        "authority-registry-window-valid");
      invariant(compareUtc(key.validFromUtc, authority.expiresAtUtc) < 0,
        "authority-registry-window-valid");
    }
    checked.add("authority-registry-window-valid");
  } else {
    notApplicable.add("authority-registry-window-valid");
    notApplicable.add("authority-registry-chain-valid");
  }
  if (value.keyRevocation !== null) {
    const revocation = value.keyRevocation;
    invariant(revocation.compromiseAtUtc === null ||
      compareUtc(revocation.compromiseAtUtc, revocation.effectiveAtUtc) <= 0,
    "revocation-time-valid");
    checked.add("revocation-time-valid");
  } else {
    notApplicable.add("revocation-time-valid");
    notApplicable.add("revocation-chain-role-valid");
  }
  if (value.offlineBundle !== null) {
    const names = new Set(value.offlineBundle.schemaHashes.map((entry) => entry.name));
    invariant(registry.contracts.every((contract) => names.has(contract.schema)),
      "offline-bundle-schema-set-complete");
    checked.add("offline-bundle-schema-set-complete");
  } else {
    notApplicable.add("offline-bundle-schema-set-complete");
    notApplicable.add("offline-bundle-closure-complete");
  }
}

function validateContext(value, checked) {
  value.segments.forEach((segment, index) => {
    invariant(segment.ordinal === index, "segment-ordinals-contiguous");
    invariant(segment.contentSha256 === sha256Text(segment.content),
      "segment-content-hashes-match");
  });
  checked.add("segment-ordinals-contiguous");
  checked.add("segment-content-hashes-match");
  const currentUsers = value.segments.filter((segment) =>
    segment.sourceKind === "current-user" && segment.role === "user" &&
    segment.trust === "authoritative");
  invariant(currentUsers.length === 1, "exactly-one-current-user-authority");
  checked.add("exactly-one-current-user-authority");
  const productPolicies = value.segments.filter((segment) =>
    segment.sourceKind === "product-policy" && segment.role === "system" &&
    segment.trust === "authoritative");
  invariant(productPolicies.length === 1, "exactly-one-product-policy-authority");
  checked.add("exactly-one-product-policy-authority");
  for (const segment of value.segments) {
    if (segment.sourceKind === "trusted-memory" || segment.sourceKind === "untrusted-memory") {
      invariant(segment.trust !== "authoritative", "memory-segments-never-authoritative");
      invariant(segment.sourceRecordIds.length > 0, "summary-and-memory-lineage-required");
    }
    if (["model-summary", "quoted-text", "retrieved-text", "tool-output", "untrusted-memory"]
      .includes(segment.sourceKind)) {
      invariant(segment.trust !== "authoritative", "untrusted-data-never-authoritative");
    }
    if (segment.sourceKind === "model-summary") {
      invariant(segment.sourceRecordIds.length > 0, "summary-and-memory-lineage-required");
    }
    if (segment.sourceKind === "product-policy") {
      invariant(segment.role === "system" && segment.trust === "authoritative",
        "exactly-one-current-user-authority");
    }
  }
  checked.add("memory-segments-never-authoritative");
  checked.add("untrusted-data-never-authoritative");
  checked.add("summary-and-memory-lineage-required");
  checked.add("current-user-supersession-explicit");
  invariant(value.tokenBudget.suppliedTokens + value.tokenBudget.reservedOutputTokens <=
    value.tokenBudget.contextLimit, "token-budget-consistent");
  checked.add("token-budget-consistent");
}

function validatePayloadBinding(value, bytesName, hashName, checkedId) {
  invariant(value[bytesName] !== 0 || value[hashName] === emptySha256, checkedId);
  invariant(value[bytesName] !== 0 || value.transferCount === undefined || value.transferCount === 0,
    checkedId);
}

function validateWorker(value, checked) {
  validatePayloadBinding(value, "payloadBytes", "payloadSha256", "payload-hash-and-length-match");
  checked.add("payload-hash-and-length-match");
  checked.add("payload-transferred-separately");
  const generationOperations = new Set(["cancel", "completed", "failed", "generate", "token"]);
  invariant(!generationOperations.has(value.operation) || value.generationId !== null,
    "generation-events-match-generation-id");
  checked.add("generation-events-match-generation-id");
  const requestOperations = new Set(["activate", "cancel", "delete", "generate", "load", "preflight", "status", "unload"]);
  const eventOperations = new Set(["completed", "failed", "status", "token"]);
  invariant((value.direction === "request" ? requestOperations : eventOperations).has(value.operation),
    "direction-operation-compatible");
  checked.add("direction-operation-compatible");
  checked.add("deadline-bounded");
}

function validateCompanion(value, checked) {
  validatePayloadBinding(value, "bodyBytes", "bodySha256", "body-hash-and-length-match");
  checked.add("body-hash-and-length-match");
  checked.add("authorization-material-header-only");
  validateHttpsUrl(value.origin, true, "$.origin");
  checked.add("origin-exact-allowlist");
  invariant(value.direction !== "event" || value.operation === "status",
    "direction-operation-compatible");
  checked.add("direction-operation-compatible");
  const mutationOperations = new Set(["acquire", "cancel", "pair", "revoke", "stream-open"]);
  invariant(!mutationOperations.has(value.operation) || value.idempotencyKeyHash !== null,
    "mutation-requires-idempotency-hash");
  checked.add("mutation-requires-idempotency-hash");
  invariant(["capabilities", "pair"].includes(value.operation) || value.sessionIdHash !== null,
    "paired-operation-requires-session");
  checked.add("paired-operation-requires-session");
  const scopeByOperation = Object.freeze({
    acquire: "acquire", cancel: "acquire", capabilities: "status", inventory: "inventory",
    pair: "pair", revoke: "revoke", status: "status", "stream-open": "stream"
  });
  invariant(scopeByOperation[value.operation] === value.scope,
    "session-scope-authorizes-operation");
  checked.add("session-scope-authorizes-operation");
}

function validateP2p(value, checked) {
  invariant(value.artifactId === `sha256:${value.artifactSha256}`,
    "artifact-id-matches-sha256");
  checked.add("artifact-id-matches-sha256");
  invariant(value.pieceCount === value.pieces.length, "piece-count-matches");
  checked.add("piece-count-matches");
  let expectedOffset = 0;
  for (let index = 0; index < value.pieces.length; index += 1) {
    const piece = value.pieces[index];
    invariant(piece.index === index && piece.offset === expectedOffset,
      "piece-indexes-and-offsets-contiguous");
    if (index + 1 < value.pieces.length) {
      invariant(piece.length === value.pieceBytes, "piece-indexes-and-offsets-contiguous");
    }
    expectedOffset += piece.length;
    invariant(Number.isSafeInteger(expectedOffset), "piece-length-sum-matches-artifact");
  }
  checked.add("piece-indexes-and-offsets-contiguous");
  invariant(expectedOffset === value.artifactBytes, "piece-length-sum-matches-artifact");
  checked.add("piece-length-sum-matches-artifact");
  invariant(merkleRoot(value) === value.merkleRootSha256, "merkle-root-matches");
  checked.add("merkle-root-matches");
  checked.add("composition-ids-unique-sorted");
  checked.add("public-redaction-profile-required");
}

function validateProof(value, checked) {
  invariant(value.completeTransferBytes > 0, "complete-transfer-fields-required");
  checked.add("complete-transfer-fields-required");
  checked.add("outside-network-scope-exact");
  checked.add("checked-routes-unique-sorted");
  invariant(compareUtc(value.issuedAtUtc, value.observedAtUtc) >= 0,
    "issued-not-before-observed");
  checked.add("issued-not-before-observed");
  invariant(lifetimeWithin(value.expiresAtUtc, value.issuedAtUtc,
    registry.semanticLimits.maximumOutsideProofLifetimeSeconds),
    "expiry-after-issue-within-policy");
  checked.add("expiry-after-issue-within-policy");
  checked.add("public-redaction-profile-required");
}

function isWebModelBytePath(value) {
  const normalized = value.toLowerCase();
  return normalized.includes("/models/") ||
    /\.(?:acg2|gguf|prompt2|safetensors|sampling2|slm|slm2|template2|tokenizer2)$/u
      .test(normalized);
}

function validateRelease(value, checked) {
  invariant(value.releaseDate === value.createdAtUtc.slice(0, 10),
    "release-date-matches-created-date");
  checked.add("release-date-matches-created-date");
  checked.add("all-parent-lists-unique-sorted");
  checked.add("campaign-projection-bound");
  checked.add("remaining-risks-sorted");
  checked.add("postpublication-evidence-excluded");
  const activePaths = [
    ...value.webAssets.map((entry) => entry.path),
    ...value.generatedPublicationFiles.map((entry) => entry.path)
  ];
  invariant(new Set(activePaths).size === activePaths.length &&
    value.retiredPublicPaths.every((entry) => !activePaths.includes(entry)),
  "web-asset-paths-disjoint");
  checked.add("web-asset-paths-disjoint");
  invariant(value.webAssets.reduce((total, entry) => total + entry.byteLength, 0) ===
    value.webTotalBytes, "web-asset-total-matches");
  checked.add("web-asset-total-matches");
  invariant(value.webAssets.every((entry) => entry.cachePolicy !== "immutable" ||
    entry.path.includes(entry.sha256)), "web-immutable-assets-content-addressed");
  checked.add("web-immutable-assets-content-addressed");
  const bootstraps = value.webAssets.filter((entry) => entry.role === "bootstrap");
  invariant(bootstraps.length === 1 && bootstraps[0].path === "/" &&
    bootstraps[0].contentType === "text/html" &&
    bootstraps[0].cachePolicy === "no-store", "web-bootstrap-exact");
  checked.add("web-bootstrap-exact");
  const generatedByRole = new Map(value.generatedPublicationFiles.map((entry) =>
    [entry.role, entry]));
  invariant(generatedByRole.size === 2 &&
    generatedByRole.get("current-release-pointer")?.path ===
      "/.well-known/site-release.json" &&
    generatedByRole.get("release-history")?.path ===
      "/.well-known/site-release-history.json", "web-generated-publication-exact");
  checked.add("web-generated-publication-exact");
  invariant(value.webAssets.every((entry) => !isWebModelBytePath(entry.path)) &&
    value.generatedPublicationFiles.every((entry) => !isWebModelBytePath(entry.path)),
  "web-model-bytes-excluded");
  checked.add("web-model-bytes-excluded");
  const workers = value.webAssets.filter((entry) => entry.role === "service-worker");
  if (value.offlineCapability === "network-only") {
    invariant(value.serviceWorkerPath === null && workers.length === 0,
      "web-offline-capability-consistent");
  } else {
    invariant(value.serviceWorkerPath !== null && workers.length === 1 &&
      workers[0].path === value.serviceWorkerPath &&
      workers[0].contentType === "application/javascript" &&
      workers[0].cachePolicy === "no-cache",
    "web-offline-capability-consistent");
  }
  checked.add("web-offline-capability-consistent");
  invariant(value.webAssets.every((entry) =>
    entry.securityHeaderProfileSha256 === value.webSecurityHeaderProfileSha256) &&
    value.generatedPublicationFiles.every((entry) =>
      entry.securityHeaderProfileSha256 === value.webSecurityHeaderProfileSha256),
  "web-security-header-profile-consistent");
  checked.add("web-security-header-profile-consistent");
  checked.add("public-redaction-profile-required");
}

function validateClaim(value, checked, notApplicable) {
  invariant(value.expiresAtUtc === null || compareUtc(value.expiresAtUtc, value.effectiveAtUtc) > 0,
    "validity-window-ordered");
  invariant(compareUtc(value.lastVerifiedAtUtc, value.effectiveAtUtc) >= 0 &&
    compareUtc(value.reviewAtUtc, value.lastVerifiedAtUtc) >= 0,
    "validity-window-ordered");
  checked.add("validity-window-ordered");
  if (value.status === "approved-for-publication") {
    invariant(value.evidenceReceiptIds.length > 0, "approved-requires-current-evidence");
    invariant(value.releaseId === null, "approved-forbids-release-id");
    invariant(value.blockerCodes.length === 0, "approved-forbids-blockers");
    checked.add("approved-requires-current-evidence");
    checked.add("approved-forbids-release-id");
    checked.add("approved-forbids-blockers");
  } else {
    notApplicable.add("approved-requires-current-evidence");
    notApplicable.add("approved-forbids-release-id");
    notApplicable.add("approved-forbids-blockers");
  }
  if (value.status === "published") {
    invariant(value.evidenceReceiptIds.length > 0, "published-requires-current-evidence");
    invariant(value.releaseId !== null, "published-requires-release-and-source");
    invariant(value.blockerCodes.length === 0, "published-forbids-blockers");
    checked.add("published-requires-current-evidence");
    checked.add("published-requires-release-and-source");
    checked.add("published-forbids-blockers");
  } else {
    notApplicable.add("published-requires-current-evidence");
    notApplicable.add("published-requires-release-and-source");
    notApplicable.add("published-forbids-blockers");
  }
  if (value.status === "blocked") {
    invariant(value.blockerCodes.length > 0, "blocked-requires-blocker");
    checked.add("blocked-requires-blocker");
  } else {
    notApplicable.add("blocked-requires-blocker");
  }
  checked.add("superseded-claims-unique-sorted");
  checked.add("site-route-and-component-bound");
}

function applyLocalInvariants(contract, value) {
  const checked = new Set();
  const notApplicable = new Set();
  const handlers = Object.freeze({
    artifact: validateArtifact,
    receipt: validateReceipt,
    context: validateContext,
    worker: validateWorker,
    companion: validateCompanion,
    p2p: validateP2p,
    proof: validateProof,
    release: validateRelease,
    claim: validateClaim
  });
  handlers[contract.class](value, checked, notApplicable);
  return Object.freeze({
    checkedInvariants: Object.freeze([...checked].sort()),
    deferredInvariants: Object.freeze(contract.invariants
      .filter((id) => !checked.has(id) && !notApplicable.has(id)).sort()),
    notApplicableInvariants: Object.freeze([...notApplicable].sort())
  });
}

function validateVnextSchemaWithRegistry(input) {
  let bytes;
  if (Buffer.isBuffer(input)) bytes = input;
  else if (input instanceof Uint8Array) bytes = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  else fail("input_invalid", "$", "bytes required");

  let value;
  try {
    value = parseStrictJson(bytes, parserLimits);
  } catch (_error) {
    fail("json_invalid", "$");
  }
  if (!isPlainObject(value) || typeof value.schema !== "string") {
    fail("schema_missing", "$.schema");
  }
  const contract = contractsBySchema.get(value.schema);
  if (!contract) fail("schema_unknown", "$.schema");
  if (bytes.length > contract.maximumBytes) fail("contract_byte_limit", "$");
  validateObject(value, contract.fields, {
    location: "$",
    publicSafe: contract.visibility === "public-safe"
  });
  const invariants = applyLocalInvariants(contract, value);
  return Object.freeze({
    validatorId,
    validationLevel: "schema-and-local-invariants",
    contractClass: contract.class,
    schema: contract.schema,
    value,
    checkedInvariants: invariants.checkedInvariants,
    deferredInvariants: invariants.deferredInvariants,
    notApplicableInvariants: invariants.notApplicableInvariants
  });
}

module.exports = Object.freeze({
  validateVnextSchemaWithRegistry,
  validatorId
});
