"use strict";

const crypto = require("node:crypto");

const { parseStrictJson } = require("./strict-json.js");

const validatorId = "tinyrustlm.vnext.independent-schema-validator.v1";
const limits = Object.freeze({
  maximumBytes: 2_097_152,
  maximumDepth: 32,
  maximumTotalEntries: 32_768,
  maximumObjectMembers: 128,
  maximumArrayItems: 16_384,
  maximumStringCodeUnits: 65_536,
  maximumTotalStringCodeUnits: 1_048_576,
  maximumNumberCharacters: 64
});
const schemas = Object.freeze({
  artifact: "tinyrustlm.vnext.artifact_manifest.v1",
  receipt: "tinyrustlm.vnext.receipt.v1",
  context: "tinyrustlm.vnext.context.v1",
  worker: "tinyrustlm.vnext.worker_message.v1",
  companion: "tinyrustlm.vnext.companion_message.v1",
  p2p: "tinyrustlm.vnext.p2p_manifest.v1",
  proof: "tinyrustlm.vnext.outside_proof.v1",
  release: "tinyrustlm.vnext.release_manifest.v1",
  claim: "tinyrustlm.vnext.claim.v1"
});
const contractBytes = Object.freeze({
  [schemas.artifact]: 524_288,
  [schemas.receipt]: 262_144,
  [schemas.context]: 1_048_576,
  [schemas.worker]: 65_536,
  [schemas.companion]: 65_536,
  [schemas.p2p]: 2_097_152,
  [schemas.proof]: 262_144,
  [schemas.release]: 524_288,
  [schemas.claim]: 262_144
});
const emptyHash = crypto.createHash("sha256").update(Buffer.alloc(0)).digest("hex");
const safePattern = /^[a-z0-9][a-z0-9._:-]{2,159}$/u;
const hashPattern = /^[a-f0-9]{64}$/u;
const contentPattern = /^sha256:[a-f0-9]{64}$/u;
const revisionPattern = /^(?:git-sha1:[a-f0-9]{40}|sha256:[a-f0-9]{64})$/u;
const timestampPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/u;
const calendarPattern = /^(\d{4})-(\d{2})-(\d{2})$/u;
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u;

function reject(code, location = "$") {
  const error = new Error(`vNext independent validation ${code} at ${location}`);
  error.code = code;
  error.location = location;
  throw error;
}

function requireThat(condition, location = "$") {
  if (!condition) reject("contract_invalid", location);
}

function plain(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

function closed(value, fields, location) {
  if (!plain(value)) reject("field_invalid", location);
  const actual = Object.keys(value);
  const expected = new Set(fields);
  for (const name of actual) {
    if (!expected.has(name)) reject("field_unknown", `${location}.${name}`);
  }
  for (const name of fields) {
    if (!Object.hasOwn(value, name)) reject("field_missing", `${location}.${name}`);
  }
}

function oneOf(value, choices, location) {
  if (typeof value !== "string" || !choices.includes(value)) reject("field_invalid", location);
}

function safe(value, location) {
  if (typeof value !== "string" || !safePattern.test(value)) reject("field_invalid", location);
}

function digest(value, location) {
  if (typeof value !== "string" || !hashPattern.test(value)) reject("field_invalid", location);
}

function contentId(value, location) {
  if (typeof value !== "string" || !contentPattern.test(value)) reject("field_invalid", location);
}

function nullable(value, validator, location) {
  if (value !== null) validator(value, location);
}

function whole(value, minimum, maximum, location) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    reject("field_invalid", location);
  }
}

function text(value, minimum, maximum, multiline, location) {
  if (typeof value !== "string" || value.length < minimum || value.length > maximum) {
    reject("field_invalid", location);
  }
  for (const character of value) {
    const code = character.codePointAt(0);
    const allowed = multiline && (code === 9 || code === 10 || code === 13);
    if (!allowed && (code <= 31 || code >= 127 && code <= 159)) reject("field_invalid", location);
  }
}

function realDate(year, month, day) {
  const value = new Date(Date.UTC(year, month - 1, day));
  return month >= 1 && month <= 12 && day >= 1 &&
    value.getUTCFullYear() === year && value.getUTCMonth() === month - 1 &&
    value.getUTCDate() === day;
}

function instant(value, location) {
  const match = typeof value === "string" ? timestampPattern.exec(value) : null;
  if (!match) reject("field_invalid", location);
  const parts = match.slice(1, 7).map(Number);
  const [year, month, day, hour, minute, second] = parts;
  if (!realDate(year, month, day) || hour > 23 || minute > 59 || second > 59) {
    reject("field_invalid", location);
  }
  const milliseconds = Date.UTC(year, month - 1, day, hour, minute, second);
  return BigInt(milliseconds) * 1_000_000n + BigInt((match[7] || "").padEnd(9, "0") || "0");
}

function date(value, location) {
  const match = typeof value === "string" ? calendarPattern.exec(value) : null;
  if (!match || !realDate(Number(match[1]), Number(match[2]), Number(match[3]))) {
    reject("field_invalid", location);
  }
}

function sortedList(value, minimum, maximum, validator, location, key = null) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    reject("field_invalid", location);
  }
  value.forEach((entry, index) => validator(entry, `${location}[${index}]`));
  const keys = value.map((entry) => key === null ? entry : entry[key]);
  if (new Set(keys).size !== keys.length) reject("field_invalid", location);
  for (let index = 1; index < keys.length; index += 1) {
    if (!(keys[index - 1] < keys[index])) reject("field_invalid", location);
  }
}

function orderedList(value, minimum, maximum, validator, location) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    reject("field_invalid", location);
  }
  value.forEach((entry, index) => validator(entry, `${location}[${index}]`));
}

function canonicalBase64(value, bytes, location) {
  if (typeof value !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) {
    reject("field_invalid", location);
  }
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== bytes || decoded.toString("base64") !== value) {
    reject("field_invalid", location);
  }
}

function privateIpv4(host) {
  const raw = host.split(".");
  if (raw.length !== 4 || raw.some((entry) => !/^\d{1,3}$/u.test(entry))) return false;
  const [a, b, c, d] = raw.map(Number);
  if ([a, b, c, d].some((entry) => entry > 255)) return true;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    a === 100 && b >= 64 && b <= 127 || a === 169 && b === 254 ||
    a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168;
}

function publicUrl(value, location) {
  if (typeof value !== "string" || value.length > 2048 || !/^[\x21-\x7e]+$/u.test(value) ||
      /%(?:2e|2f|5c)/iu.test(value) || value.includes("\\")) reject("field_invalid", location);
  let parsed;
  try {
    parsed = new URL(value);
  } catch (_error) {
    reject("field_invalid", location);
  }
  const host = parsed.hostname.replace(/^\[|\]$/gu, "").toLowerCase();
  const privateV6 = host === "::" || host === "::1" || host.startsWith("fc") ||
    host.startsWith("fd") || /^fe[89ab]/u.test(host) || host.startsWith("ff");
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search ||
      parsed.hash || parsed.href !== value || host === "localhost" || host.endsWith(".localhost") ||
      privateIpv4(host) || host.includes(":") && privateV6) reject("field_invalid", location);
}

function route(value, location) {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/") ||
      value.startsWith("//") || !/^[\x21-\x7e]+$/u.test(value) || /[?#\\]/u.test(value) ||
      /%(?:2e|2f|5c)/iu.test(value) || value.split("/").some((part) => part === "." || part === "..")) {
    reject("field_invalid", location);
  }
}

function hashBinding(value, location) {
  closed(value, ["name", "sha256"], location);
  safe(value.name, `${location}.name`);
  digest(value.sha256, `${location}.sha256`);
}

function tool(value, location) {
  closed(value, ["name", "version", "binarySha256"], location);
  safe(value.name, `${location}.name`);
  text(value.version, 1, 64, false, `${location}.version`);
  digest(value.binarySha256, `${location}.binarySha256`);
}

function runtime(value, location) {
  closed(value, ["runtimeIdentifier", "operatingSystem", "architecture", "executionClass"], location);
  safe(value.runtimeIdentifier, `${location}.runtimeIdentifier`);
  oneOf(value.operatingSystem, ["browser", "linux", "macos", "windows"], `${location}.operatingSystem`);
  oneOf(value.architecture, ["aarch64", "wasm32", "x86_64"], `${location}.architecture`);
  oneOf(value.executionClass, ["browser", "deployment", "emulated", "fixture", "live-service", "local", "outside-network", "package", "physical-hardware"], `${location}.executionClass`);
}

function publicParameter(value, location) {
  closed(value, ["name", "value", "unit"], location);
  safe(value.name, `${location}.name`);
  text(value.value, 1, 512, false, `${location}.value`);
  nullable(value.unit, safe, `${location}.unit`);
}

function boundedError(value, location) {
  closed(value, ["code", "failureStep", "retryStatus", "rollbackStatus"], location);
  safe(value.code, `${location}.code`);
  safe(value.failureStep, `${location}.failureStep`);
  oneOf(value.retryStatus, ["none", "retryable", "terminal"], `${location}.retryStatus`);
  oneOf(value.rollbackStatus, ["completed", "failed", "not-required", "pending"], `${location}.rollbackStatus`);
}

function externalReference(value, location) {
  closed(value, ["kind", "value"], location);
  oneOf(value.kind, ["https", "receipt"], `${location}.kind`);
  text(value.value, 1, 2048, false, `${location}.value`);
  if (value.kind === "https") publicUrl(value.value, `${location}.value`);
  else contentId(value.value, `${location}.value`);
}

function redaction(value, location) {
  closed(value, ["profile", "decision"], location);
  requireThat(value.profile === "tinyrustlm.vnext.public_safe.v1", `${location}.profile`);
  requireThat(value.decision === "public-safe", `${location}.decision`);
}

const roles = ["local-recorder", "outside-network-observer", "p2p-publisher", "release-authorizer", "site-publisher"];
const roleDomains = Object.freeze({
  "local-recorder": "tinyrustlm.signature.local-recorder.v1",
  "outside-network-observer": "tinyrustlm.signature.outside-network-observer.v1",
  "p2p-publisher": "tinyrustlm.signature.p2p-publisher.v1",
  "release-authorizer": "tinyrustlm.signature.release-authorizer.v1",
  "site-publisher": "tinyrustlm.signature.site-publisher.v1"
});

function signatureEnvelope(value, location) {
  closed(value, ["algorithm", "role", "signatureDomain", "signerId", "keyId", "authorityRegistryReceiptId", "signedSubjectId", "signedSchema", "campaignId", "releaseId", "scope", "signedPayloadSha256", "nonceHash", "issuedAtUtc", "expiresAtUtc", "signature"], location);
  requireThat(value.algorithm === "ed25519", `${location}.algorithm`);
  oneOf(value.role, roles, `${location}.role`);
  requireThat(value.signatureDomain === roleDomains[value.role], `${location}.signatureDomain`);
  safe(value.signerId, `${location}.signerId`);
  safe(value.keyId, `${location}.keyId`);
  contentId(value.authorityRegistryReceiptId, `${location}.authorityRegistryReceiptId`);
  contentId(value.signedSubjectId, `${location}.signedSubjectId`);
  oneOf(value.signedSchema, Object.values(schemas), `${location}.signedSchema`);
  safe(value.campaignId, `${location}.campaignId`);
  nullable(value.releaseId, contentId, `${location}.releaseId`);
  safe(value.scope, `${location}.scope`);
  digest(value.signedPayloadSha256, `${location}.signedPayloadSha256`);
  digest(value.nonceHash, `${location}.nonceHash`);
  const issued = instant(value.issuedAtUtc, `${location}.issuedAtUtc`);
  if (value.expiresAtUtc === null) requireThat(value.role === "local-recorder", `${location}.expiresAtUtc`);
  else {
    const expires = instant(value.expiresAtUtc, `${location}.expiresAtUtc`);
    requireThat(expires > issued && expires - issued <= 604_800_000_000_000n,
      `${location}.expiresAtUtc`);
  }
  canonicalBase64(value.signature, 64, `${location}.signature`);
}

function authorityKey(value, location) {
  closed(value, ["keyId", "signerId", "role", "publicKey", "status", "validFromUtc", "validUntilUtc"], location);
  safe(value.keyId, `${location}.keyId`);
  safe(value.signerId, `${location}.signerId`);
  oneOf(value.role, roles, `${location}.role`);
  canonicalBase64(value.publicKey, 32, `${location}.publicKey`);
  oneOf(value.status, ["active", "retired", "revoked"], `${location}.status`);
  const from = instant(value.validFromUtc, `${location}.validFromUtc`);
  if (value.validUntilUtc !== null) {
    requireThat(instant(value.validUntilUtc, `${location}.validUntilUtc`) > from,
      `${location}.validUntilUtc`);
  }
}

function authorityRegistry(value, location) {
  closed(value, ["environment", "previousRegistryReceiptId", "effectiveAtUtc", "expiresAtUtc", "allowedClockSkewSeconds", "keys"], location);
  oneOf(value.environment, ["development", "production", "staging"], `${location}.environment`);
  nullable(value.previousRegistryReceiptId, contentId, `${location}.previousRegistryReceiptId`);
  const effective = instant(value.effectiveAtUtc, `${location}.effectiveAtUtc`);
  const expires = instant(value.expiresAtUtc, `${location}.expiresAtUtc`);
  requireThat(expires > effective && expires - effective <= 31_536_000_000_000_000n,
    `${location}.expiresAtUtc`);
  whole(value.allowedClockSkewSeconds, 0, 3600, `${location}.allowedClockSkewSeconds`);
  sortedList(value.keys, 1, 64, authorityKey, `${location}.keys`, "keyId");
  for (const key of value.keys) {
    requireThat(instant(key.validFromUtc, `${location}.keys.validFromUtc`) < expires,
      `${location}.keys.validFromUtc`);
  }
}

function keyRevocation(value, location) {
  closed(value, ["authorityRegistryReceiptId", "keyId", "role", "effectiveAtUtc", "compromiseAtUtc", "reasonCode", "scope", "predecessorRegistryReceiptId", "replacementKeyId"], location);
  contentId(value.authorityRegistryReceiptId, `${location}.authorityRegistryReceiptId`);
  safe(value.keyId, `${location}.keyId`);
  oneOf(value.role, roles, `${location}.role`);
  const effective = instant(value.effectiveAtUtc, `${location}.effectiveAtUtc`);
  if (value.compromiseAtUtc !== null) {
    requireThat(instant(value.compromiseAtUtc, `${location}.compromiseAtUtc`) <= effective,
      `${location}.compromiseAtUtc`);
  }
  safe(value.reasonCode, `${location}.reasonCode`);
  safe(value.scope, `${location}.scope`);
  contentId(value.predecessorRegistryReceiptId, `${location}.predecessorRegistryReceiptId`);
  nullable(value.replacementKeyId, safe, `${location}.replacementKeyId`);
}

function offlineBundle(value, location) {
  closed(value, ["bundleManifestSha256", "receiptIds", "signatureEnvelopeReceiptIds", "authorityRegistryReceiptIds", "revocationReceiptIds", "schemaHashes", "createdAtUtc"], location);
  digest(value.bundleManifestSha256, `${location}.bundleManifestSha256`);
  sortedList(value.receiptIds, 1, 2048, contentId, `${location}.receiptIds`);
  sortedList(value.signatureEnvelopeReceiptIds, 1, 256, contentId, `${location}.signatureEnvelopeReceiptIds`);
  sortedList(value.authorityRegistryReceiptIds, 1, 64, contentId, `${location}.authorityRegistryReceiptIds`);
  sortedList(value.revocationReceiptIds, 0, 256, contentId, `${location}.revocationReceiptIds`);
  sortedList(value.schemaHashes, 9, 32, hashBinding, `${location}.schemaHashes`, "name");
  const names = new Set(value.schemaHashes.map((entry) => entry.name));
  requireThat(Object.values(schemas).every((schema) => names.has(schema)), `${location}.schemaHashes`);
  instant(value.createdAtUtc, `${location}.createdAtUtc`);
}

function contextSegment(value, location) {
  closed(value, ["ordinal", "role", "sourceKind", "trust", "content", "contentSha256", "sourceRecordIds", "sourceReceiptIds", "supersedesSourceRecordIds", "conflictGroupId"], location);
  whole(value.ordinal, 0, 127, `${location}.ordinal`);
  oneOf(value.role, ["assistant", "data", "system", "user"], `${location}.role`);
  oneOf(value.sourceKind, ["current-user", "model-summary", "prior-assistant", "product-policy", "quoted-text", "required-generation-prefix", "retrieved-text", "tool-output", "trusted-memory", "untrusted-memory"], `${location}.sourceKind`);
  oneOf(value.trust, ["authoritative", "trusted", "untrusted"], `${location}.trust`);
  text(value.content, 1, 65_536, true, `${location}.content`);
  digest(value.contentSha256, `${location}.contentSha256`);
  requireThat(value.contentSha256 === crypto.createHash("sha256").update(Buffer.from(value.content, "utf8")).digest("hex"), `${location}.contentSha256`);
  sortedList(value.sourceRecordIds, 0, 32, contentId, `${location}.sourceRecordIds`);
  sortedList(value.sourceReceiptIds, 0, 32, contentId, `${location}.sourceReceiptIds`);
  sortedList(value.supersedesSourceRecordIds, 0, 32, contentId, `${location}.supersedesSourceRecordIds`);
  nullable(value.conflictGroupId, safe, `${location}.conflictGroupId`);
}

function tokenBudget(value, location) {
  closed(value, ["contextLimit", "reservedOutputTokens", "suppliedTokens", "truncatedTokens"], location);
  whole(value.contextLimit, 1, 1_048_576, `${location}.contextLimit`);
  whole(value.reservedOutputTokens, 1, 1_048_576, `${location}.reservedOutputTokens`);
  whole(value.suppliedTokens, 1, 1_048_576, `${location}.suppliedTokens`);
  whole(value.truncatedTokens, 0, 1_048_576, `${location}.truncatedTokens`);
  requireThat(value.suppliedTokens + value.reservedOutputTokens <= value.contextLimit, location);
}

function piece(value, location) {
  closed(value, ["index", "offset", "length", "sha256"], location);
  whole(value.index, 0, 16_383, `${location}.index`);
  whole(value.offset, 0, 68_719_476_735, `${location}.offset`);
  whole(value.length, 1, 4_194_304, `${location}.length`);
  digest(value.sha256, `${location}.sha256`);
}

function checkedRoute(value, location) {
  closed(value, ["method", "path", "status", "byteLength", "responseSha256"], location);
  oneOf(value.method, ["GET", "HEAD"], `${location}.method`);
  text(value.path, 1, 512, false, `${location}.path`);
  route(value.path, `${location}.path`);
  whole(value.status, 200, 299, `${location}.status`);
  whole(value.byteLength, 0, 68_719_476_736, `${location}.byteLength`);
  digest(value.responseSha256, `${location}.responseSha256`);
}

function u64(value) {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(BigInt(value));
  return bytes;
}

function u32(value) {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value);
  return bytes;
}

function framedHash(label, parts) {
  const hash = crypto.createHash("sha256");
  hash.update(Buffer.from(label, "ascii"));
  hash.update(Buffer.from([0]));
  for (const part of parts) hash.update(part);
  return hash.digest();
}

function independentMerkle(value) {
  let levelNodes = value.pieces.map((entry) => framedHash("TinyRustLM-Merkle-Leaf-v1", [
    u64(entry.index), u64(entry.length), Buffer.from(entry.sha256, "hex")
  ]));
  let level = 0;
  while (levelNodes.length > 1) {
    const next = [];
    for (let offset = 0; offset < levelNodes.length; offset += 2) {
      const parent = offset / 2;
      next.push(offset + 1 < levelNodes.length
        ? framedHash("TinyRustLM-Merkle-Node-v1", [u32(level), u64(parent), levelNodes[offset], levelNodes[offset + 1]])
        : framedHash("TinyRustLM-Merkle-Carry-v1", [u32(level), u64(parent), levelNodes[offset]]));
    }
    levelNodes = next;
    level += 1;
  }
  return framedHash("TinyRustLM-Merkle-Root-v1", [
    u64(value.artifactBytes), u64(value.pieceCount), levelNodes[0]
  ]).toString("hex");
}

function validateArtifact(value) {
  closed(value, ["schema", "artifactId", "canonicalContentSha256", "artifactClass", "formatProfile", "byteLength", "artifactSha256", "metadataSha256", "dependencyArtifactIds", "pieceManifestId", "provenanceReceiptId", "qualificationReceiptId", "licenseExpression", "createdAtUtc", "redaction"], "$");
  requireThat(value.schema === schemas.artifact, "$.schema");
  contentId(value.artifactId, "$.artifactId");
  digest(value.canonicalContentSha256, "$.canonicalContentSha256");
  oneOf(value.artifactClass, ["base-model", "composition", "low-rank-adapter", "sbom", "specialist-model", "template", "tokenizer"], "$.artifactClass");
  oneOf(value.formatProfile, ["acg2.0", "cyclonedx-json-1.6", "lora2.0", "slm2.0", "template2.0", "tokenizer2.0"], "$.formatProfile");
  const profiles = { "base-model": "slm2.0", composition: "acg2.0", "low-rank-adapter": "lora2.0", sbom: "cyclonedx-json-1.6", "specialist-model": "slm2.0", template: "template2.0", tokenizer: "tokenizer2.0" };
  requireThat(profiles[value.artifactClass] === value.formatProfile, "$.formatProfile");
  whole(value.byteLength, 1, 68_719_476_736, "$.byteLength");
  digest(value.artifactSha256, "$.artifactSha256");
  requireThat(value.artifactId === `sha256:${value.artifactSha256}`, "$.artifactId");
  digest(value.metadataSha256, "$.metadataSha256");
  sortedList(value.dependencyArtifactIds, 0, 64, contentId, "$.dependencyArtifactIds");
  nullable(value.pieceManifestId, contentId, "$.pieceManifestId");
  contentId(value.provenanceReceiptId, "$.provenanceReceiptId");
  nullable(value.qualificationReceiptId, contentId, "$.qualificationReceiptId");
  text(value.licenseExpression, 1, 256, false, "$.licenseExpression");
  instant(value.createdAtUtc, "$.createdAtUtc");
  redaction(value.redaction, "$.redaction");
}

const receiptTypes = ["acquisition", "authority-registry", "browser-round", "catalog-announcement", "conversation-evaluation", "conversion", "deployment", "discovery", "final-attestation", "key-revocation", "lane-serve", "memory-continuity", "native-evaluation", "offline-verification-bundle", "outside-proof", "p2p-preparation", "package", "public-readback", "qualification", "redaction-scan", "review", "screening", "signature-envelope", "site-synchronization", "structure", "training", "training-preparation"];

function validateReceipt(value) {
  closed(value, ["schema", "receiptId", "canonicalContentSha256", "receiptType", "campaignId", "attemptId", "phase", "status", "startedAtUtc", "completedAtUtc", "sourceRevision", "inputReceiptIds", "inputHashes", "outputHashes", "tools", "configurationSha256", "runtime", "publicParameters", "error", "blockerCode", "externalEvidenceReferences", "redaction", "attestationReference", "signatureEnvelope", "authorityRegistry", "keyRevocation", "offlineBundle", "supersedesReceiptIds"], "$");
  requireThat(value.schema === schemas.receipt, "$.schema");
  contentId(value.receiptId, "$.receiptId");
  digest(value.canonicalContentSha256, "$.canonicalContentSha256");
  oneOf(value.receiptType, receiptTypes, "$.receiptType");
  safe(value.campaignId, "$.campaignId"); safe(value.attemptId, "$.attemptId"); safe(value.phase, "$.phase");
  oneOf(value.status, ["blocked", "fail", "pass", "rejected", "stale", "superseded"], "$.status");
  const started = instant(value.startedAtUtc, "$.startedAtUtc");
  requireThat(instant(value.completedAtUtc, "$.completedAtUtc") >= started, "$.completedAtUtc");
  if (!revisionPattern.test(value.sourceRevision)) reject("field_invalid", "$.sourceRevision");
  sortedList(value.inputReceiptIds, 0, 256, contentId, "$.inputReceiptIds");
  sortedList(value.inputHashes, 0, 256, hashBinding, "$.inputHashes", "name");
  sortedList(value.outputHashes, 0, 256, hashBinding, "$.outputHashes", "name");
  sortedList(value.tools, 1, 32, tool, "$.tools", "name");
  digest(value.configurationSha256, "$.configurationSha256");
  runtime(value.runtime, "$.runtime");
  sortedList(value.publicParameters, 0, 128, publicParameter, "$.publicParameters", "name");
  nullable(value.error, boundedError, "$.error");
  requireThat(!["fail", "rejected"].includes(value.status) || value.error !== null, "$.error");
  requireThat(value.status !== "pass" || value.error === null, "$.error");
  nullable(value.blockerCode, safe, "$.blockerCode");
  requireThat(value.status !== "blocked" || value.blockerCode !== null, "$.blockerCode");
  sortedList(value.externalEvidenceReferences, 0, 64, externalReference, "$.externalEvidenceReferences", "value");
  redaction(value.redaction, "$.redaction");
  nullable(value.attestationReference, contentId, "$.attestationReference");
  nullable(value.signatureEnvelope, signatureEnvelope, "$.signatureEnvelope");
  nullable(value.authorityRegistry, authorityRegistry, "$.authorityRegistry");
  nullable(value.keyRevocation, keyRevocation, "$.keyRevocation");
  nullable(value.offlineBundle, offlineBundle, "$.offlineBundle");
  sortedList(value.supersedesReceiptIds, 0, 64, contentId, "$.supersedesReceiptIds");
  const security = { "signature-envelope": "signatureEnvelope", "authority-registry": "authorityRegistry", "key-revocation": "keyRevocation", "offline-verification-bundle": "offlineBundle" };
  for (const [type, field] of Object.entries(security)) {
    requireThat((value.receiptType === type) === (value[field] !== null), `$.${field}`);
  }
  if (Object.hasOwn(security, value.receiptType)) requireThat(value.status === "pass", "$.status");
  if (value.signatureEnvelope !== null) requireThat(value.signatureEnvelope.campaignId === value.campaignId, "$.signatureEnvelope.campaignId");
  if (value.receiptType === "redaction-scan") requireThat(value.inputHashes.some((entry) => entry.name === "target-canonical-content"), "$.inputHashes");
}

function validateContext(value) {
  closed(value, ["schema", "contextId", "canonicalContentSha256", "modelArtifactId", "compositionArtifactId", "tokenizerArtifactId", "templateArtifactId", "policyArtifactId", "compilerProfile", "compilerSha256", "kvProfile", "conversationIdHash", "turnId", "memorySnapshotReceiptId", "startupPackageId", "segments", "tokenBudget", "privacyClass", "persistence", "createdAtUtc"], "$");
  requireThat(value.schema === schemas.context, "$.schema");
  contentId(value.contextId, "$.contextId"); digest(value.canonicalContentSha256, "$.canonicalContentSha256");
  contentId(value.modelArtifactId, "$.modelArtifactId"); nullable(value.compositionArtifactId, contentId, "$.compositionArtifactId");
  contentId(value.tokenizerArtifactId, "$.tokenizerArtifactId"); contentId(value.templateArtifactId, "$.templateArtifactId"); contentId(value.policyArtifactId, "$.policyArtifactId");
  safe(value.compilerProfile, "$.compilerProfile"); digest(value.compilerSha256, "$.compilerSha256"); safe(value.kvProfile, "$.kvProfile");
  digest(value.conversationIdHash, "$.conversationIdHash"); safe(value.turnId, "$.turnId");
  nullable(value.memorySnapshotReceiptId, contentId, "$.memorySnapshotReceiptId"); nullable(value.startupPackageId, contentId, "$.startupPackageId");
  orderedList(value.segments, 1, 128, contextSegment, "$.segments");
  value.segments.forEach((segment, index) => requireThat(segment.ordinal === index, `$.segments[${index}].ordinal`));
  requireThat(value.segments.filter((segment) => segment.sourceKind === "current-user" && segment.role === "user" && segment.trust === "authoritative").length === 1, "$.segments");
  requireThat(value.segments.filter((segment) => segment.sourceKind === "product-policy" && segment.role === "system" && segment.trust === "authoritative").length === 1, "$.segments");
  for (const segment of value.segments) {
    if (["model-summary", "quoted-text", "retrieved-text", "tool-output", "untrusted-memory"].includes(segment.sourceKind)) requireThat(segment.trust !== "authoritative", "$.segments.trust");
    if (["model-summary", "trusted-memory", "untrusted-memory"].includes(segment.sourceKind)) requireThat(segment.sourceRecordIds.length > 0, "$.segments.sourceRecordIds");
    if (["trusted-memory", "untrusted-memory"].includes(segment.sourceKind)) requireThat(segment.trust !== "authoritative", "$.segments.trust");
  }
  tokenBudget(value.tokenBudget, "$.tokenBudget");
  requireThat(value.privacyClass === "private-volatile", "$.privacyClass"); requireThat(value.persistence === "memory-only", "$.persistence");
  instant(value.createdAtUtc, "$.createdAtUtc");
}

function validateWorker(value) {
  closed(value, ["schema", "protocol", "messageId", "sessionIdHash", "generationId", "direction", "operation", "deadlineMilliseconds", "subjectId", "payloadBytes", "payloadSha256", "transferCount", "sentAtUtc", "privacyClass"], "$");
  requireThat(value.schema === schemas.worker, "$.schema"); requireThat(value.protocol === "tinyrustlm-worker-vnext-1", "$.protocol");
  safe(value.messageId, "$.messageId"); digest(value.sessionIdHash, "$.sessionIdHash"); nullable(value.generationId, safe, "$.generationId");
  oneOf(value.direction, ["event", "request"], "$.direction"); oneOf(value.operation, ["activate", "cancel", "completed", "delete", "failed", "generate", "load", "preflight", "status", "token", "unload"], "$.operation");
  const request = ["activate", "cancel", "delete", "generate", "load", "preflight", "status", "unload"];
  const event = ["completed", "failed", "status", "token"];
  requireThat((value.direction === "request" ? request : event).includes(value.operation), "$.operation");
  if (["cancel", "completed", "failed", "generate", "token"].includes(value.operation)) requireThat(value.generationId !== null, "$.generationId");
  whole(value.deadlineMilliseconds, 1, 600_000, "$.deadlineMilliseconds"); nullable(value.subjectId, contentId, "$.subjectId");
  whole(value.payloadBytes, 0, 1_073_741_824, "$.payloadBytes"); digest(value.payloadSha256, "$.payloadSha256"); whole(value.transferCount, 0, 16, "$.transferCount");
  if (value.payloadBytes === 0) requireThat(value.payloadSha256 === emptyHash && value.transferCount === 0, "$.payloadSha256");
  instant(value.sentAtUtc, "$.sentAtUtc"); requireThat(value.privacyClass === "private-session", "$.privacyClass");
}

function validateCompanion(value) {
  closed(value, ["schema", "protocol", "messageId", "direction", "operation", "sessionIdHash", "origin", "scope", "idempotencyKeyHash", "subjectId", "bodyBytes", "bodySha256", "createdAtUtc", "privacyClass"], "$");
  requireThat(value.schema === schemas.companion, "$.schema"); requireThat(value.protocol === "tinyrustlm-companion-vnext-1", "$.protocol"); safe(value.messageId, "$.messageId");
  oneOf(value.direction, ["event", "request", "response"], "$.direction"); oneOf(value.operation, ["acquire", "cancel", "capabilities", "inventory", "pair", "revoke", "status", "stream-open"], "$.operation");
  requireThat(value.direction !== "event" || value.operation === "status", "$.operation");
  nullable(value.sessionIdHash, digest, "$.sessionIdHash"); publicUrl(value.origin, "$.origin");
  const scopes = { acquire: "acquire", cancel: "acquire", capabilities: "status", inventory: "inventory", pair: "pair", revoke: "revoke", status: "status", "stream-open": "stream" };
  oneOf(value.scope, ["acquire", "inventory", "pair", "revoke", "status", "stream"], "$.scope"); requireThat(value.scope === scopes[value.operation], "$.scope");
  nullable(value.idempotencyKeyHash, digest, "$.idempotencyKeyHash"); if (["acquire", "cancel", "pair", "revoke", "stream-open"].includes(value.operation)) requireThat(value.idempotencyKeyHash !== null, "$.idempotencyKeyHash");
  if (!["capabilities", "pair"].includes(value.operation)) requireThat(value.sessionIdHash !== null, "$.sessionIdHash");
  nullable(value.subjectId, contentId, "$.subjectId"); whole(value.bodyBytes, 0, 65_536, "$.bodyBytes"); digest(value.bodySha256, "$.bodySha256"); if (value.bodyBytes === 0) requireThat(value.bodySha256 === emptyHash, "$.bodySha256");
  instant(value.createdAtUtc, "$.createdAtUtc"); requireThat(value.privacyClass === "private-session", "$.privacyClass");
}

function validateP2p(value) {
  closed(value, ["schema", "manifestId", "canonicalContentSha256", "artifactManifestId", "artifactId", "artifactSha256", "artifactBytes", "pieceBytes", "pieceCount", "pieces", "merkleProfile", "merkleRootSha256", "compositionArtifactIds", "qualificationReceiptId", "provenanceReceiptId", "licenseExpression", "createdAtUtc", "redaction"], "$");
  requireThat(value.schema === schemas.p2p, "$.schema"); contentId(value.manifestId, "$.manifestId"); digest(value.canonicalContentSha256, "$.canonicalContentSha256"); contentId(value.artifactManifestId, "$.artifactManifestId"); contentId(value.artifactId, "$.artifactId"); digest(value.artifactSha256, "$.artifactSha256"); requireThat(value.artifactId === `sha256:${value.artifactSha256}`, "$.artifactId");
  whole(value.artifactBytes, 1, 68_719_476_736, "$.artifactBytes"); requireThat(value.pieceBytes === 4_194_304, "$.pieceBytes"); whole(value.pieceCount, 1, 16_384, "$.pieceCount"); orderedList(value.pieces, 1, 16_384, piece, "$.pieces"); requireThat(value.pieceCount === value.pieces.length, "$.pieceCount");
  let offset = 0; value.pieces.forEach((entry, index) => { requireThat(entry.index === index && entry.offset === offset, `$.pieces[${index}]`); if (index + 1 < value.pieces.length) requireThat(entry.length === value.pieceBytes, `$.pieces[${index}].length`); offset += entry.length; }); requireThat(offset === value.artifactBytes, "$.artifactBytes");
  requireThat(value.merkleProfile === "tinyrustlm.merkle.sha256-4mib.v1", "$.merkleProfile"); digest(value.merkleRootSha256, "$.merkleRootSha256"); requireThat(independentMerkle(value) === value.merkleRootSha256, "$.merkleRootSha256");
  sortedList(value.compositionArtifactIds, 0, 64, contentId, "$.compositionArtifactIds"); contentId(value.qualificationReceiptId, "$.qualificationReceiptId"); contentId(value.provenanceReceiptId, "$.provenanceReceiptId"); text(value.licenseExpression, 1, 256, false, "$.licenseExpression"); instant(value.createdAtUtc, "$.createdAtUtc"); redaction(value.redaction, "$.redaction");
}

function validateProof(value) {
  closed(value, ["schema", "proofId", "canonicalContentSha256", "campaignId", "modelArtifactId", "p2pManifestId", "laneId", "processInstanceId", "endpoint", "observerId", "observerRegistryId", "nonceHash", "implementationSha256", "checkedRoutes", "completeTransferSha256", "completeTransferBytes", "networkScope", "observedAtUtc", "issuedAtUtc", "expiresAtUtc", "signatureEnvelopeId", "redaction"], "$");
  requireThat(value.schema === schemas.proof, "$.schema"); contentId(value.proofId, "$.proofId"); digest(value.canonicalContentSha256, "$.canonicalContentSha256"); safe(value.campaignId, "$.campaignId"); contentId(value.modelArtifactId, "$.modelArtifactId"); contentId(value.p2pManifestId, "$.p2pManifestId"); safe(value.laneId, "$.laneId"); safe(value.processInstanceId, "$.processInstanceId"); publicUrl(value.endpoint, "$.endpoint"); safe(value.observerId, "$.observerId"); contentId(value.observerRegistryId, "$.observerRegistryId"); digest(value.nonceHash, "$.nonceHash"); digest(value.implementationSha256, "$.implementationSha256");
  sortedList(value.checkedRoutes, 3, 512, checkedRoute, "$.checkedRoutes", "path"); digest(value.completeTransferSha256, "$.completeTransferSha256"); whole(value.completeTransferBytes, 1, 68_719_476_736, "$.completeTransferBytes"); requireThat(value.networkScope === "outside-host-and-local-network", "$.networkScope");
  const observed = instant(value.observedAtUtc, "$.observedAtUtc"); const issued = instant(value.issuedAtUtc, "$.issuedAtUtc"); const expires = instant(value.expiresAtUtc, "$.expiresAtUtc"); requireThat(issued >= observed && expires > issued && expires - issued <= 86_400_000_000_000n, "$.expiresAtUtc"); contentId(value.signatureEnvelopeId, "$.signatureEnvelopeId"); redaction(value.redaction, "$.redaction");
}

function validateRelease(value) {
  closed(value, ["schema", "releaseId", "canonicalContentSha256", "productId", "version", "releaseDate", "sourceRevision", "campaignAttestationReceiptId", "artifactManifestIds", "packageReceiptIds", "sitePublicationReceiptIds", "claimIds", "sbomArtifactId", "provenanceReceiptId", "authorizationReceiptId", "changelogSha256", "createdAtUtc", "redaction"], "$");
  requireThat(value.schema === schemas.release, "$.schema"); contentId(value.releaseId, "$.releaseId"); digest(value.canonicalContentSha256, "$.canonicalContentSha256"); safe(value.productId, "$.productId"); if (typeof value.version !== "string" || value.version.length > 128 || !versionPattern.test(value.version)) reject("field_invalid", "$.version"); date(value.releaseDate, "$.releaseDate"); if (!revisionPattern.test(value.sourceRevision)) reject("field_invalid", "$.sourceRevision"); contentId(value.campaignAttestationReceiptId, "$.campaignAttestationReceiptId"); sortedList(value.artifactManifestIds, 1, 64, contentId, "$.artifactManifestIds"); sortedList(value.packageReceiptIds, 1, 64, contentId, "$.packageReceiptIds"); sortedList(value.sitePublicationReceiptIds, 1, 32, contentId, "$.sitePublicationReceiptIds"); sortedList(value.claimIds, 1, 128, contentId, "$.claimIds"); contentId(value.sbomArtifactId, "$.sbomArtifactId"); contentId(value.provenanceReceiptId, "$.provenanceReceiptId"); contentId(value.authorizationReceiptId, "$.authorizationReceiptId"); digest(value.changelogSha256, "$.changelogSha256"); instant(value.createdAtUtc, "$.createdAtUtc"); requireThat(value.releaseDate === value.createdAtUtc.slice(0, 10), "$.releaseDate"); redaction(value.redaction, "$.redaction");
}

function validateClaim(value) {
  closed(value, ["schema", "claimId", "canonicalContentSha256", "subjectId", "siteId", "route", "component", "wordingClass", "claimType", "evidenceTier", "status", "scope", "publicWording", "evidenceReceiptIds", "sourceRevision", "releaseId", "effectiveAtUtc", "expiresAtUtc", "reviewAtUtc", "ownerId", "blockerCodes", "lastVerifiedAtUtc", "supersedesClaimIds", "redaction"], "$");
  requireThat(value.schema === schemas.claim, "$.schema"); contentId(value.claimId, "$.claimId"); digest(value.canonicalContentSha256, "$.canonicalContentSha256"); contentId(value.subjectId, "$.subjectId"); safe(value.siteId, "$.siteId"); route(value.route, "$.route"); safe(value.component, "$.component"); oneOf(value.wordingClass, ["availability", "capability", "publication", "quality", "status"], "$.wordingClass"); oneOf(value.claimType, ["browser-local", "conversation-proven", "conversation-screened", "full-assistant-quality", "outside-p2p-available", "package-published", "runtime-smoke-only", "site-published", "structural-validation-only", "task-specific-proven"], "$.claimType"); oneOf(value.evidenceTier, ["design-only", "external-live", "fixture-only", "local-executed", "physical-executed", "production-readback", "structural-only"], "$.evidenceTier"); oneOf(value.status, ["blocked", "draft", "externally-verified", "locally-verified", "published", "retracted", "stale"], "$.status"); text(value.scope, 1, 512, false, "$.scope"); text(value.publicWording, 1, 1024, false, "$.publicWording"); sortedList(value.evidenceReceiptIds, 0, 256, contentId, "$.evidenceReceiptIds"); if (!revisionPattern.test(value.sourceRevision)) reject("field_invalid", "$.sourceRevision"); nullable(value.releaseId, contentId, "$.releaseId"); const effective = instant(value.effectiveAtUtc, "$.effectiveAtUtc"); if (value.expiresAtUtc !== null) requireThat(instant(value.expiresAtUtc, "$.expiresAtUtc") > effective, "$.expiresAtUtc"); const verified = instant(value.lastVerifiedAtUtc, "$.lastVerifiedAtUtc"); const review = instant(value.reviewAtUtc, "$.reviewAtUtc"); requireThat(verified >= effective && review >= verified, "$.reviewAtUtc"); safe(value.ownerId, "$.ownerId"); sortedList(value.blockerCodes, 0, 64, safe, "$.blockerCodes"); sortedList(value.supersedesClaimIds, 0, 64, contentId, "$.supersedesClaimIds"); redaction(value.redaction, "$.redaction"); if (value.status === "published") requireThat(value.evidenceReceiptIds.length > 0 && value.releaseId !== null && value.blockerCodes.length === 0, "$.status"); if (value.status === "blocked") requireThat(value.blockerCodes.length > 0, "$.blockerCodes");
}

const validators = Object.freeze({
  [schemas.artifact]: { contractClass: "artifact", validate: validateArtifact },
  [schemas.receipt]: { contractClass: "receipt", validate: validateReceipt },
  [schemas.context]: { contractClass: "context", validate: validateContext },
  [schemas.worker]: { contractClass: "worker", validate: validateWorker },
  [schemas.companion]: { contractClass: "companion", validate: validateCompanion },
  [schemas.p2p]: { contractClass: "p2p", validate: validateP2p },
  [schemas.proof]: { contractClass: "proof", validate: validateProof },
  [schemas.release]: { contractClass: "release", validate: validateRelease },
  [schemas.claim]: { contractClass: "claim", validate: validateClaim }
});

function validateVnextSchemaIndependently(input) {
  let bytes;
  if (Buffer.isBuffer(input)) bytes = input;
  else if (input instanceof Uint8Array) bytes = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  else reject("input_invalid");
  let value;
  try {
    value = parseStrictJson(bytes, limits);
  } catch (_error) {
    reject("json_invalid");
  }
  if (!plain(value) || typeof value.schema !== "string") reject("schema_missing", "$.schema");
  const selected = validators[value.schema];
  if (!selected) reject("schema_unknown", "$.schema");
  if (bytes.length > contractBytes[value.schema]) reject("contract_byte_limit");
  selected.validate(value);
  return Object.freeze({
    validatorId,
    validationLevel: "schema-and-local-invariants",
    contractClass: selected.contractClass,
    schema: value.schema,
    value
  });
}

module.exports = Object.freeze({
  validateVnextSchemaIndependently,
  validatorId
});
