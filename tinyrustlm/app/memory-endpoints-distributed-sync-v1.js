(function (root, factory) {
  "use strict";

  const api = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.TinyRustLMDistributedSyncV1 = api;
  }
}(typeof globalThis === "object" ? globalThis : this, function (root) {
  "use strict";

  const CAPABILITIES_SCHEMA = "memoryendpoints.distributed_sync_capabilities.v1";
  const PROTOCOL = "memoryendpoints-distributed-sync-v1";
  const CAPABILITY_ROUTE = "/api/matm/sync/capabilities";
  const ROUTE_PREFIX = "/api/matm/sync/";
  const MAX_RESPONSE_BYTES = 256 * 1024;
  const MAX_SUMMARY_CHARS = 4000;
  const MAX_PULL_PAGE_SIZE = 200;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder("utf-8", { fatal: true });

  const CAPABILITY_ENVELOPE_KEYS = new Set(["ok", "data"]);
  const CAPABILITY_KEYS = new Set([
    "schemaVersion", "status", "protocol", "capabilityRoute", "routes",
    "mutationContract", "checkpointContract", "deviceContract", "retention",
    "publicSafeOnly", "rawCredentialExposed", "rawPayloadExposed", "valuesRedacted"
  ]);
  const ROUTE_KEYS = new Set([
    "registerDevice", "rotateDevice", "revokeDevice", "submitMutation",
    "lookupReceipt", "changes", "heads", "retention"
  ]);
  const MUTATION_CONTRACT_KEYS = new Set([
    "operations", "hardForgetSupported", "hardForgetBehavior", "idempotency",
    "revisionFields", "conflictSemantics", "tombstoneSemantics"
  ]);
  const CHECKPOINT_CONTRACT_KEYS = new Set([
    "changesQuery", "monotonicServerSequence", "indexedThroughWatermark",
    "paginationFields"
  ]);
  const DEVICE_CONTRACT_KEYS = new Set([
    "authorityEpoch", "registerRotateRevoke", "revokedDeviceMutationBehavior",
    "secretMaterialStored"
  ]);
  const RETENTION_CAPABILITY_KEYS = new Set([
    "tombstoneRetentionDays", "hardForgetSupported", "rawPrivatePayloadStored",
    "valuesRedacted"
  ]);
  const MUTATION_KEYS = new Set([
    "workspaceId", "actorAgentId", "deviceId", "deviceEpoch", "logicalMemoryId",
    "operation", "parentRevisionId", "title", "summary", "sourceRef", "scope",
    "scopeId", "memoryType", "bodyHash"
  ]);
  const RECEIPT_KEYS = new Set([
    "receiptId", "workspaceId", "idempotencyKeyHash", "bodyHash",
    "logicalMemoryId", "syncRevisionId", "serverSequence", "status", "conflict",
    "conflictCode", "currentHeadRevisionId", "httpStatus", "createdAt",
    "idempotencyKeyExposed", "valuesRedacted", "rawCredentialExposed",
    "rawPayloadExposed"
  ]);
  const REVISION_KEYS = new Set([
    "syncRevisionId", "workspaceId", "logicalMemoryId", "parentRevisionId",
    "memoryEventId", "actorAgentId", "deviceId", "deviceEpoch", "operation",
    "status", "conflict", "conflictCode", "serverSequence", "bodyHash", "source",
    "title", "summary", "scope", "scopeId", "memoryType", "tombstone", "createdAt",
    "valuesRedacted", "rawPayloadExposed"
  ]);
  const HEAD_KEYS = new Set([
    "logicalMemoryId", "workspaceId", "headRevisionId", "serverSequence",
    "indexedThroughSequence", "status", "updatedAt", "valuesRedacted",
    "rawPayloadExposed"
  ]);
  const OPERATOR_SUMMARY_KEYS = new Set([
    "schemaVersion", "action", "status", "serverSequence", "conflict",
    "conflictCode", "persisted", "valuesRedacted", "rawCredentialExposed",
    "rawPayloadExposed"
  ]);
  const CONFIRMATION_KEYS = new Set([
    "schemaVersion", "persisted", "receiptVisible", "revisionVisibleInChanges",
    "headVisible", "changesCount", "headsCount", "receiptId", "revisionId",
    "logicalMemoryId", "indexedThroughSequence", "valuesRedacted",
    "rawCredentialExposed", "rawPayloadExposed"
  ]);
  const DECISION_REQUIRED_KEYS = new Set([
    "ok", "persisted", "receipt", "revision", "head", "serverSequence",
    "indexedThroughSequence", "conflict", "status", "operatorSummary",
    "receiptQueryUrl", "changesQueryUrl", "headsQueryUrl", "capabilityRoute",
    "confirmation", "valuesRedacted", "rawCredentialExposed", "rawPayloadExposed"
  ]);
  const DECISION_KEYS = new Set([
    ...DECISION_REQUIRED_KEYS, "idempotentReplay", "idempotencyKeyExposed"
  ]);
  const DEVICE_KEYS = new Set([
    "deviceId", "workspaceId", "agentId", "label", "status", "authorityEpoch",
    "createdAt", "updatedAt", "revokedAt", "valuesRedacted", "rawPayloadExposed"
  ]);
  const DEVICE_OPERATOR_KEYS = new Set([
    "schemaVersion", "action", "deviceId", "status", "authorityEpoch", "persisted",
    "valuesRedacted", "rawCredentialExposed", "rawPayloadExposed"
  ]);
  const DEVICE_RESPONSE_REQUIRED_KEYS = new Set([
    "ok", "persisted", "visibleToAgent", "deviceAuthorityPersisted",
    "canonicalWorkspaceId", "canonicalDeviceId", "device", "capabilityRoute",
    "operatorSummary", "valuesRedacted", "rawCredentialExposed", "rawPayloadExposed"
  ]);
  const DEVICE_RESPONSE_KEYS = new Set([
    ...DEVICE_RESPONSE_REQUIRED_KEYS, "idempotentReplay", "idempotencyKeyExposed"
  ]);
  const CHANGE_PAGE_KEYS = new Set([
    "items", "count", "hasMore", "nextAfterSequence", "indexedThroughSequence",
    "checkpoint", "valuesRedacted", "rawCredentialExposed", "rawPayloadExposed"
  ]);
  const CHECKPOINT_KEYS = new Set([
    "workspaceIdHash", "afterSequence", "nextAfterSequence", "valuesRedacted"
  ]);
  const RETENTION_POLICY_KEYS = new Set([
    "schemaVersion", "tombstoneRetentionDays", "hardForgetSupported",
    "hardForgetBehavior", "rawPrivatePayloadStored", "valuesRedacted",
    "rawCredentialExposed", "rawPayloadExposed"
  ]);

  function clone(value) {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  function requirePlainObject(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${label} must be an object`);
    }
  }

  function assertExactKeys(value, allowed, required, label) {
    requirePlainObject(value, label);
    for (const key of Object.keys(value)) {
      if (!allowed.has(key)) {
        throw new Error(`${label} contains unknown field ${key}`);
      }
    }
    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        throw new Error(`${label} is missing field ${key}`);
      }
    }
  }

  function validateIdentifier(label, value, maxChars = 160) {
    if (typeof value !== "string" || !value || value.length > maxChars ||
        !/^[A-Za-z0-9._:@-]+$/.test(value)) {
      throw new Error(`${label} is missing or malformed`);
    }
  }

  function validatePublicText(label, value, maxChars) {
    if (typeof value !== "string" || !value.trim() ||
        Array.from(value).length > maxChars ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value) ||
        looksLikeSecret(value)) {
      throw new Error(`${label} is not bounded public-safe text`);
    }
  }

  function looksLikeSecret(value) {
    const text = String(value || "");
    return /-----BEGIN [A-Z ]*PRIVATE KEY-----/i.test(text) ||
      /\b(?:bearer|basic)\s+[a-z0-9._~+/=-]{8,}/i.test(text) ||
      /(?:api[_-]?key|password|passwd|secret|token)\s*[:=]\s*\S{8,}/i.test(text);
  }

  function isSupportedConflictCode(value) {
    return [
      "parent_revision_mismatch",
      "tombstone_resurrection_blocked",
      "head_not_found"
    ].includes(value);
  }

  function validateSha256(label, value) {
    if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
      throw new Error(`${label} is not lowercase SHA-256`);
    }
  }

  function validateSha256Prefix(label, value) {
    if (typeof value !== "string" || !value.startsWith("sha256:")) {
      throw new Error(`${label} is missing its sha256 prefix`);
    }
    validateSha256(label, value.slice(7));
  }

  function validateTimestamp(label, value) {
    if (typeof value !== "string" || value.length < 16 || value.length > 64 ||
        !value.includes("T")) {
      throw new Error(`${label} is not a bounded ISO-8601 timestamp`);
    }
  }

  function validateRedaction(value, label) {
    if (value.valuesRedacted !== true || value.rawCredentialExposed !== false ||
        value.rawPayloadExposed !== false) {
      throw new Error(`${label} violates the redaction boundary`);
    }
  }

  function validateRoute(label, route) {
    if (typeof route !== "string" || !route.startsWith(ROUTE_PREFIX) ||
        route.length <= ROUTE_PREFIX.length || route.length > 192 ||
        route.includes("..") || route.includes("?") || route.includes("#") ||
        !/^[A-Za-z0-9/_.-]+$/.test(route)) {
      throw new Error(`${label} is outside the protected sync namespace`);
    }
  }

  function parseBoundedJson(input, label, maxBytes = MAX_RESPONSE_BYTES) {
    if (typeof input === "string") {
      if (!input || encoder.encode(input).length > maxBytes) {
        throw new Error(`${label} JSON is empty or exceeds its byte limit`);
      }
      return JSON.parse(input);
    }
    requirePlainObject(input, label);
    if (encoder.encode(JSON.stringify(input)).length > maxBytes) {
      throw new Error(`${label} JSON exceeds its byte limit`);
    }
    return clone(input);
  }

  function validateCapabilityData(capabilities) {
    assertExactKeys(capabilities, CAPABILITY_KEYS, CAPABILITY_KEYS, "Distributed-sync capabilities");
    assertExactKeys(capabilities.routes, ROUTE_KEYS, ROUTE_KEYS, "Distributed-sync routes");
    assertExactKeys(
      capabilities.mutationContract,
      MUTATION_CONTRACT_KEYS,
      MUTATION_CONTRACT_KEYS,
      "Distributed-sync mutation contract"
    );
    assertExactKeys(
      capabilities.checkpointContract,
      CHECKPOINT_CONTRACT_KEYS,
      CHECKPOINT_CONTRACT_KEYS,
      "Distributed-sync checkpoint contract"
    );
    assertExactKeys(
      capabilities.deviceContract,
      DEVICE_CONTRACT_KEYS,
      DEVICE_CONTRACT_KEYS,
      "Distributed-sync device contract"
    );
    assertExactKeys(
      capabilities.retention,
      RETENTION_CAPABILITY_KEYS,
      RETENTION_CAPABILITY_KEYS,
      "Distributed-sync retention"
    );
    if (capabilities.schemaVersion !== CAPABILITIES_SCHEMA ||
        capabilities.status !== "live" || capabilities.protocol !== PROTOCOL ||
        capabilities.capabilityRoute !== CAPABILITY_ROUTE ||
        capabilities.publicSafeOnly !== true || capabilities.valuesRedacted !== true ||
        capabilities.rawCredentialExposed !== false || capabilities.rawPayloadExposed !== false) {
      throw new Error("Unsupported, non-live, or unsafe distributed-sync capability document");
    }
    const expectedRoutes = {
      registerDevice: "/api/matm/sync/devices",
      rotateDevice: "/api/matm/sync/devices/rotate",
      revokeDevice: "/api/matm/sync/devices/revoke",
      submitMutation: "/api/matm/sync/mutations",
      lookupReceipt: "/api/matm/sync/receipts",
      changes: "/api/matm/sync/changes",
      heads: "/api/matm/sync/heads",
      retention: "/api/matm/sync/retention"
    };
    for (const [name, route] of Object.entries(expectedRoutes)) {
      validateRoute(`Distributed-sync route ${name}`, capabilities.routes[name]);
      if (capabilities.routes[name] !== route) {
        throw new Error(`Distributed-sync route ${name} is unsupported`);
      }
    }
    const mutation = capabilities.mutationContract;
    if (JSON.stringify(mutation.operations) !== JSON.stringify(["upsert", "delete", "hard_forget"]) ||
        JSON.stringify(mutation.revisionFields) !== JSON.stringify([
          "logicalMemoryId", "parentRevisionId", "syncRevisionId", "serverSequence",
          "bodyHash", "conflict", "conflictCode"
        ]) || mutation.hardForgetSupported !== false ||
        mutation.hardForgetBehavior !== "safe_rejected_receipt" ||
        !String(mutation.idempotency).includes("Idempotency-Key") ||
        !String(mutation.conflictSemantics).trim() || !String(mutation.tombstoneSemantics).trim()) {
      throw new Error("Distributed-sync mutation contract is incomplete or unsupported");
    }
    const checkpoint = capabilities.checkpointContract;
    if (JSON.stringify(checkpoint.changesQuery) !== JSON.stringify([
      "workspace_id", "after_sequence", "limit", "logical_memory_id"
    ]) || JSON.stringify(checkpoint.paginationFields) !== JSON.stringify([
      "items", "hasMore", "nextAfterSequence", "indexedThroughSequence", "checkpoint"
    ]) || checkpoint.monotonicServerSequence !== true || checkpoint.indexedThroughWatermark !== true) {
      throw new Error("Distributed-sync checkpoint contract is incomplete or unsupported");
    }
    const device = capabilities.deviceContract;
    if (device.authorityEpoch !== true || device.registerRotateRevoke !== true ||
        device.revokedDeviceMutationBehavior !== "safe_rejected_receipt" ||
        device.secretMaterialStored !== false) {
      throw new Error("Distributed-sync device contract is incomplete or unsafe");
    }
    const retention = capabilities.retention;
    if (!Number.isSafeInteger(retention.tombstoneRetentionDays) ||
        retention.tombstoneRetentionDays < 1 || retention.tombstoneRetentionDays > 3650 ||
        retention.hardForgetSupported !== false || retention.rawPrivatePayloadStored !== false ||
        retention.valuesRedacted !== true) {
      throw new Error("Distributed-sync retention contract is incomplete or unsafe");
    }
    return capabilities;
  }

  function parseDistributedSyncCapabilities(input) {
    const envelope = parseBoundedJson(input, "Distributed-sync capabilities", 64 * 1024);
    assertExactKeys(
      envelope,
      CAPABILITY_ENVELOPE_KEYS,
      CAPABILITY_ENVELOPE_KEYS,
      "Distributed-sync capability envelope"
    );
    if (envelope.ok !== true) {
      throw new Error("Distributed-sync capability response was not successful");
    }
    return validateCapabilityData(envelope.data);
  }

  function resolveDistributedSyncRoute(serviceBaseUrl, advertisedRoute) {
    const base = new URL(serviceBaseUrl);
    const isLoopback = base.protocol === "http:" &&
      (base.hostname === "localhost" || base.hostname === "127.0.0.1" || base.hostname === "::1");
    if (base.username || base.password || (base.protocol !== "https:" && !isLoopback)) {
      throw new Error("MemoryEndpoints base URL must use HTTPS, except loopback HTTP for tests");
    }
    validateRoute("Advertised distributed-sync route", advertisedRoute);
    return new URL(advertisedRoute, base.origin).toString();
  }

  async function probeDistributedSyncCapabilities(fetchImpl, serviceBaseUrl) {
    if (typeof fetchImpl !== "function") {
      throw new Error("Distributed-sync capability probe requires fetch");
    }
    const route = resolveDistributedSyncRoute(serviceBaseUrl, CAPABILITY_ROUTE);
    const response = await fetchImpl(route, {
      method: "GET",
      headers: {},
      cache: "no-store"
    });
    if (response.status === 404) {
      return { status: "not_advertised", reasonCode: "not_advertised", capabilities: null };
    }
    if (!response.ok) {
      throw new Error(`MemoryEndpoints distributed-sync probe failed with HTTP ${response.status}`);
    }
    try {
      requireNoStoreResponse(response);
      const capabilities = parseDistributedSyncCapabilities(
        await readBoundedFetchText(response, 64 * 1024)
      );
      return { status: "live", reasonCode: "live", capabilities };
    } catch (_error) {
      return { status: "incompatible", reasonCode: "invalid_contract", capabilities: null };
    }
  }

  function validateMutationShape(mutation) {
    const required = new Set(Array.from(MUTATION_KEYS).filter((key) =>
      key !== "parentRevisionId" && key !== "bodyHash"));
    assertExactKeys(mutation, MUTATION_KEYS, required, "Hosted revision mutation");
    for (const key of ["workspaceId", "actorAgentId", "deviceId", "logicalMemoryId", "scopeId"]) {
      validateIdentifier(`Hosted mutation ${key}`, mutation[key]);
    }
    if (mutation.parentRevisionId !== undefined && mutation.parentRevisionId !== null &&
        mutation.parentRevisionId !== "") {
      validateIdentifier("Hosted mutation parentRevisionId", mutation.parentRevisionId);
    }
    if (!Number.isSafeInteger(mutation.deviceEpoch) || mutation.deviceEpoch < 1) {
      throw new Error("Hosted mutation deviceEpoch must be positive");
    }
    if (!["upsert", "delete", "hard_forget"].includes(mutation.operation)) {
      throw new Error("Hosted mutation operation is unsupported");
    }
    validatePublicText("Hosted mutation title", mutation.title, 320);
    validatePublicText("Hosted mutation summary", mutation.summary, MAX_SUMMARY_CHARS);
    validatePublicText("Hosted mutation sourceRef", mutation.sourceRef, 1024);
    if (!["workspace", "project", "goal", "task"].includes(String(mutation.scope).toLowerCase()) ||
        !["status", "handoff", "note"].includes(String(mutation.memoryType).toLowerCase())) {
      throw new Error("Hosted mutation scope or memory type is unsupported");
    }
    if (mutation.bodyHash !== undefined && mutation.bodyHash !== "") {
      validateSha256("Hosted mutation bodyHash", mutation.bodyHash);
    }
  }

  function mutationBodyProjection(mutation) {
    return {
      logicalMemoryId: mutation.logicalMemoryId,
      operation: mutation.operation,
      parentRevisionId: mutation.parentRevisionId || "",
      source: mutation.sourceRef,
      summary: mutation.summary,
      title: mutation.title
    };
  }

  async function hostedRevisionMutationBodyHash(mutation) {
    validateMutationShape(mutation);
    return sha256Hex(JSON.stringify(mutationBodyProjection(mutation)));
  }

  async function canonicalizeHostedRevisionMutation(mutation) {
    validateMutationShape(mutation);
    const canonical = {
      workspaceId: mutation.workspaceId.trim(),
      actorAgentId: mutation.actorAgentId.trim(),
      deviceId: mutation.deviceId.trim(),
      deviceEpoch: mutation.deviceEpoch,
      logicalMemoryId: mutation.logicalMemoryId.trim(),
      operation: mutation.operation
    };
    const parentRevisionId = String(mutation.parentRevisionId || "").trim();
    if (parentRevisionId) {
      canonical.parentRevisionId = parentRevisionId;
    }
    canonical.title = mutation.title.trim();
    canonical.summary = mutation.summary;
    canonical.sourceRef = mutation.sourceRef.trim();
    canonical.scope = mutation.scope.trim().toLowerCase();
    canonical.scopeId = mutation.scopeId.trim();
    canonical.memoryType = mutation.memoryType.trim().toLowerCase();
    canonical.bodyHash = await hostedRevisionMutationBodyHash(canonical);
    await validateHostedRevisionMutation(canonical);
    return canonical;
  }

  async function validateHostedRevisionMutation(mutation) {
    validateMutationShape(mutation);
    validateSha256("Hosted mutation bodyHash", mutation.bodyHash);
    const expected = await hostedRevisionMutationBodyHash(mutation);
    if (mutation.bodyHash !== expected) {
      throw new Error("Hosted mutation bodyHash does not match its public-safe projection");
    }
    return mutation;
  }

  async function serializeHostedRevisionMutation(mutation) {
    return JSON.stringify(await canonicalizeHostedRevisionMutation(mutation));
  }

  async function hostedRevisionMutationFingerprint(mutation) {
    return sha256Hex(await serializeHostedRevisionMutation(mutation));
  }

  function validateDistributedSyncIdempotencyKey(value) {
    if (typeof value !== "string" || !/^[A-Za-z0-9._:-]{1,256}$/.test(value) ||
        looksLikeSecret(value)) {
      throw new Error("Distributed-sync idempotency key is missing, malformed, or unsafe");
    }
  }

  function validateReceipt(receipt) {
    assertExactKeys(receipt, RECEIPT_KEYS, RECEIPT_KEYS, "Hosted receipt");
    for (const key of ["receiptId", "workspaceId", "logicalMemoryId"]) {
      validateIdentifier(`Hosted receipt ${key}`, receipt[key]);
    }
    if (receipt.syncRevisionId) {
      validateIdentifier("Hosted receipt syncRevisionId", receipt.syncRevisionId);
    }
    if (receipt.currentHeadRevisionId) {
      validateIdentifier("Hosted receipt currentHeadRevisionId", receipt.currentHeadRevisionId);
    }
    validateSha256Prefix("Hosted receipt idempotencyKeyHash", receipt.idempotencyKeyHash);
    validateSha256("Hosted receipt bodyHash", receipt.bodyHash);
    validateTimestamp("Hosted receipt createdAt", receipt.createdAt);
    validateRedaction(receipt, "Hosted receipt");
    if (receipt.idempotencyKeyExposed !== false ||
        !["applied", "conflict", "rejected"].includes(receipt.status)) {
      throw new Error("Hosted receipt status or idempotency boundary is invalid");
    }
    if (receipt.status === "applied" &&
        (receipt.conflict || receipt.conflictCode || receipt.serverSequence < 1 || !receipt.syncRevisionId) ||
        receipt.status === "conflict" &&
        (!receipt.conflict || !isSupportedConflictCode(receipt.conflictCode) ||
         receipt.serverSequence < 1 || !receipt.syncRevisionId) ||
        receipt.status === "rejected" &&
        (receipt.conflict || !receipt.conflictCode || receipt.serverSequence !== 0 || receipt.syncRevisionId)) {
      throw new Error("Hosted receipt status metadata is inconsistent");
    }
    return receipt;
  }

  function validateRevision(revision) {
    assertExactKeys(revision, REVISION_KEYS, REVISION_KEYS, "Hosted revision");
    for (const key of [
      "syncRevisionId", "workspaceId", "logicalMemoryId", "actorAgentId", "scopeId"
    ]) {
      validateIdentifier(`Hosted revision ${key}`, revision[key]);
    }
    if (revision.parentRevisionId) {
      validateIdentifier("Hosted revision parentRevisionId", revision.parentRevisionId);
    }
    if (revision.memoryEventId) {
      validateIdentifier("Hosted revision memoryEventId", revision.memoryEventId);
    }
    if (revision.deviceId) {
      validateIdentifier("Hosted revision deviceId", revision.deviceId);
    }
    validateSha256("Hosted revision bodyHash", revision.bodyHash);
    validatePublicText("Hosted revision source", revision.source, 1024);
    validatePublicText("Hosted revision title", revision.title, 320);
    validatePublicText("Hosted revision summary", revision.summary, MAX_SUMMARY_CHARS);
    validateTimestamp("Hosted revision createdAt", revision.createdAt);
    if (!["upsert", "delete"].includes(revision.operation) ||
        !["applied", "conflict"].includes(revision.status) ||
        !Number.isSafeInteger(revision.serverSequence) || revision.serverSequence < 1 ||
        revision.valuesRedacted !== true || revision.rawPayloadExposed !== false ||
        revision.tombstone !== (revision.operation === "delete") ||
        revision.conflict !== (revision.status === "conflict") ||
        revision.conflict && !isSupportedConflictCode(revision.conflictCode)) {
      throw new Error("Hosted revision metadata is invalid");
    }
    return revision;
  }

  function validateHead(head) {
    assertExactKeys(head, HEAD_KEYS, HEAD_KEYS, "Hosted head");
    for (const key of ["logicalMemoryId", "workspaceId", "headRevisionId"]) {
      validateIdentifier(`Hosted head ${key}`, head[key]);
    }
    validateTimestamp("Hosted head updatedAt", head.updatedAt);
    if (!["active", "tombstoned"].includes(head.status) ||
        !Number.isSafeInteger(head.serverSequence) || head.serverSequence < 1 ||
        !Number.isSafeInteger(head.indexedThroughSequence) ||
        head.indexedThroughSequence < head.serverSequence ||
        head.valuesRedacted !== true || head.rawPayloadExposed !== false) {
      throw new Error("Hosted head metadata is invalid");
    }
    return head;
  }

  function validateOperatorSummary(summary, action) {
    assertExactKeys(summary, OPERATOR_SUMMARY_KEYS, OPERATOR_SUMMARY_KEYS, "Operator summary");
    validateRedaction(summary, "Operator summary");
    if (summary.schemaVersion !== "memoryendpoints.sync_operator_summary.v1" ||
        summary.action !== action || summary.persisted !== true) {
      throw new Error("Operator summary is incomplete");
    }
  }

  function validateConfirmation(confirmation, receipt) {
    assertExactKeys(confirmation, CONFIRMATION_KEYS, CONFIRMATION_KEYS, "Mutation confirmation");
    validateRedaction(confirmation, "Mutation confirmation");
    if (confirmation.schemaVersion !== "memoryendpoints.sync_mutation_confirmation.v1" ||
        confirmation.persisted !== true || confirmation.receiptVisible !== true ||
        confirmation.receiptId !== receipt.receiptId ||
        confirmation.revisionId !== receipt.syncRevisionId ||
        confirmation.logicalMemoryId !== receipt.logicalMemoryId) {
      throw new Error("Mutation confirmation identity is invalid");
    }
  }

  function validateProtectedQuery(value, prefix) {
    if (typeof value !== "string" || !value.startsWith(prefix) || value.includes("..") ||
        value.includes("#") || looksLikeSecret(value)) {
      throw new Error("Hosted readback URL is outside the protected sync contract");
    }
  }

  function parseRevisionDecisionResponse(input) {
    const response = parseBoundedJson(input, "Mutation decision");
    assertExactKeys(response, DECISION_KEYS, DECISION_REQUIRED_KEYS, "Mutation decision");
    validateRedaction(response, "Mutation decision");
    if (response.persisted !== true || response.capabilityRoute !== CAPABILITY_ROUTE ||
        response.idempotencyKeyExposed === true) {
      throw new Error("Mutation decision was not durably confirmed");
    }
    validateReceipt(response.receipt);
    validateOperatorSummary(response.operatorSummary, "mutation");
    validateConfirmation(response.confirmation, response.receipt);
    validateProtectedQuery(response.receiptQueryUrl, "/api/matm/sync/receipts?");
    validateProtectedQuery(response.changesQueryUrl, "/api/matm/sync/changes?");
    validateProtectedQuery(response.headsQueryUrl, "/api/matm/sync/heads?");
    if (response.status !== response.receipt.status ||
        response.serverSequence !== response.receipt.serverSequence ||
        response.receipt.receiptId !== response.confirmation.receiptId) {
      throw new Error("Mutation decision identity fields disagree");
    }
    if (response.status === "applied") {
      if (response.ok !== true || response.conflict !== false || !response.revision || !response.head) {
        throw new Error("Applied mutation decision is inconsistent");
      }
      validateRevision(response.revision);
      validateHead(response.head);
      if (response.revision.syncRevisionId !== response.receipt.syncRevisionId ||
          response.head.headRevisionId !== response.revision.syncRevisionId ||
          response.confirmation.revisionVisibleInChanges !== true ||
          response.confirmation.headVisible !== true) {
        throw new Error("Applied mutation readback identity is inconsistent");
      }
    } else if (response.status === "conflict") {
      if (response.ok !== false || response.conflict !== true || !response.revision ||
          response.revision.conflictCode !== response.receipt.conflictCode ||
          !isSupportedConflictCode(response.receipt.conflictCode)) {
        throw new Error("Conflict mutation decision is inconsistent");
      }
      validateRevision(response.revision);
      if (response.head) {
        validateHead(response.head);
      }
    } else if (response.status === "rejected") {
      if (response.ok !== false || response.conflict !== false || response.revision !== null ||
          response.serverSequence !== 0 || !response.receipt.conflictCode) {
        throw new Error("Rejected mutation decision is inconsistent");
      }
      if (response.head) {
        validateHead(response.head);
      }
    } else {
      throw new Error("Mutation decision status is unsupported");
    }
    response.idempotentReplay = response.idempotentReplay === true;
    response.idempotencyKeyExposed = false;
    return response;
  }

  function validateReceiptLookupRequest(request) {
    assertExactKeys(
      request,
      new Set(["idempotencyKey", "logicalMemoryId", "bodyHash"]),
      new Set(["idempotencyKey", "logicalMemoryId", "bodyHash"]),
      "Receipt lookup request"
    );
    validateDistributedSyncIdempotencyKey(request.idempotencyKey);
    validateIdentifier("Receipt lookup logicalMemoryId", request.logicalMemoryId);
    validateSha256("Receipt lookup bodyHash", request.bodyHash);
  }

  function parseReceiptLookupResponse(input) {
    const response = parseBoundedJson(input, "Receipt lookup");
    const keys = new Set([
      "ok", "receipt", "operatorSummary", "valuesRedacted",
      "rawCredentialExposed", "rawPayloadExposed"
    ]);
    assertExactKeys(response, keys, keys, "Receipt lookup");
    validateRedaction(response, "Receipt lookup");
    if (response.ok !== true) {
      throw new Error("Receipt lookup was not successful");
    }
    validateReceipt(response.receipt);
    validateOperatorSummary(response.operatorSummary, "receipt");
    return response;
  }

  function parseChangePage(input, requestedAfterSequence) {
    const response = parseBoundedJson(input, "Change page");
    const responseKeys = new Set([
      "ok", "changes", "valuesRedacted", "rawCredentialExposed", "rawPayloadExposed"
    ]);
    assertExactKeys(response, responseKeys, responseKeys, "Change page response");
    validateRedaction(response, "Change page response");
    if (response.ok !== true) {
      throw new Error("Change page response was not successful");
    }
    const page = response.changes;
    assertExactKeys(page, CHANGE_PAGE_KEYS, CHANGE_PAGE_KEYS, "Change page");
    assertExactKeys(page.checkpoint, CHECKPOINT_KEYS, CHECKPOINT_KEYS, "Change checkpoint");
    validateRedaction(page, "Change page");
    validateSha256Prefix("Change checkpoint workspaceIdHash", page.checkpoint.workspaceIdHash);
    if (!Number.isSafeInteger(requestedAfterSequence) || requestedAfterSequence < 0 ||
        !Array.isArray(page.items) || page.count !== page.items.length ||
        page.count > MAX_PULL_PAGE_SIZE ||
        page.checkpoint.afterSequence !== requestedAfterSequence ||
        page.checkpoint.nextAfterSequence !== page.nextAfterSequence ||
        page.checkpoint.valuesRedacted !== true) {
      throw new Error("Change page count or checkpoint is invalid");
    }
    let previous = requestedAfterSequence;
    for (const revision of page.items) {
      validateRevision(revision);
      if (revision.serverSequence <= previous) {
        throw new Error("Change page sequences are not strictly monotonic");
      }
      previous = revision.serverSequence;
    }
    if (page.nextAfterSequence !== previous ||
        page.indexedThroughSequence < page.nextAfterSequence ||
        page.hasMore === true && page.items.length === 0) {
      throw new Error("Change page continuation metadata is unsafe");
    }
    return page;
  }

  function parseReadHeadsResponse(input) {
    const response = parseBoundedJson(input, "Heads response");
    const keys = new Set([
      "ok", "items", "count", "filters", "valuesRedacted",
      "rawCredentialExposed", "rawPayloadExposed"
    ]);
    assertExactKeys(response, keys, keys, "Heads response");
    validateRedaction(response, "Heads response");
    requirePlainObject(response.filters, "Heads filters");
    const filterKeys = Object.keys(response.filters);
    if (filterKeys.length > 1 || filterKeys.some((key) => key !== "logicalMemoryId")) {
      throw new Error("Heads filters contain unknown fields");
    }
    if (response.filters.logicalMemoryId !== undefined) {
      validateIdentifier("Heads logicalMemoryId filter", response.filters.logicalMemoryId);
    }
    if (response.ok !== true || !Array.isArray(response.items) ||
        response.count !== response.items.length) {
      throw new Error("Heads response count is invalid");
    }
    let previous = "";
    for (const head of response.items) {
      validateHead(head);
      if (head.logicalMemoryId < previous) {
        throw new Error("Heads response is not deterministically sorted");
      }
      previous = head.logicalMemoryId;
    }
    return response;
  }

  function validateDeviceRequest(request, requireLabel) {
    const allowed = new Set(["workspaceId", "agentId", "deviceId", "label"]);
    const required = new Set(["workspaceId", "agentId", "deviceId"]);
    if (requireLabel) {
      required.add("label");
    }
    assertExactKeys(request, allowed, required, "Device request");
    for (const key of ["workspaceId", "agentId", "deviceId"]) {
      validateIdentifier(`Device request ${key}`, request[key]);
    }
    if (request.label !== undefined) {
      validatePublicText("Device request label", request.label, 320);
    }
  }

  function parseDeviceAuthorityResponse(input) {
    const response = parseBoundedJson(input, "Device authority");
    assertExactKeys(
      response,
      DEVICE_RESPONSE_KEYS,
      DEVICE_RESPONSE_REQUIRED_KEYS,
      "Device authority response"
    );
    assertExactKeys(response.device, DEVICE_KEYS, DEVICE_KEYS, "Hosted device");
    assertExactKeys(
      response.operatorSummary,
      DEVICE_OPERATOR_KEYS,
      DEVICE_OPERATOR_KEYS,
      "Device operator summary"
    );
    validateRedaction(response, "Device authority response");
    for (const key of ["deviceId", "workspaceId", "agentId"]) {
      validateIdentifier(`Hosted device ${key}`, response.device[key]);
    }
    validatePublicText("Hosted device label", response.device.label, 320);
    validateTimestamp("Hosted device createdAt", response.device.createdAt);
    validateTimestamp("Hosted device updatedAt", response.device.updatedAt);
    if (response.ok !== true || response.persisted !== true ||
        response.visibleToAgent !== true || response.deviceAuthorityPersisted !== true ||
        response.capabilityRoute !== CAPABILITY_ROUTE || response.idempotencyKeyExposed === true ||
        response.canonicalWorkspaceId !== response.device.workspaceId ||
        response.canonicalDeviceId !== response.device.deviceId ||
        !["active", "revoked"].includes(response.device.status) ||
        !Number.isSafeInteger(response.device.authorityEpoch) ||
        response.device.authorityEpoch < 1 || response.device.valuesRedacted !== true ||
        response.device.rawPayloadExposed !== false ||
        response.operatorSummary.schemaVersion !==
          "memoryendpoints.sync_device_operator_summary.v1" ||
        response.operatorSummary.deviceId !== response.device.deviceId ||
        response.operatorSummary.status !== response.device.status ||
        response.operatorSummary.authorityEpoch !== response.device.authorityEpoch ||
        response.operatorSummary.persisted !== true) {
      throw new Error("Device authority response is inconsistent");
    }
    validateRedaction(response.operatorSummary, "Device operator summary");
    if (response.device.status === "active" && response.device.revokedAt !== null ||
        response.device.status === "revoked" && !response.device.revokedAt) {
      throw new Error("Device revocation lifecycle is inconsistent");
    }
    if (response.device.revokedAt) {
      validateTimestamp("Hosted device revokedAt", response.device.revokedAt);
    }
    response.idempotentReplay = response.idempotentReplay === true;
    response.idempotencyKeyExposed = false;
    return response;
  }

  function parseRetentionPolicyResponse(input) {
    const response = parseBoundedJson(input, "Retention response");
    const keys = new Set([
      "ok", "policy", "capabilities", "valuesRedacted",
      "rawCredentialExposed", "rawPayloadExposed"
    ]);
    assertExactKeys(response, keys, keys, "Retention response");
    assertExactKeys(response.policy, RETENTION_POLICY_KEYS, RETENTION_POLICY_KEYS, "Retention policy");
    validateRedaction(response, "Retention response");
    validateRedaction(response.policy, "Retention policy");
    validateCapabilityData(response.capabilities);
    if (response.ok !== true ||
        response.policy.schemaVersion !== "memoryendpoints.sync_retention.v1" ||
        !Number.isSafeInteger(response.policy.tombstoneRetentionDays) ||
        response.policy.tombstoneRetentionDays < 1 ||
        response.policy.tombstoneRetentionDays > 3650 ||
        response.policy.hardForgetSupported !== false ||
        response.policy.hardForgetBehavior !== "safe_rejected_receipt" ||
        response.policy.rawPrivatePayloadStored !== false ||
        response.policy.tombstoneRetentionDays !==
          response.capabilities.retention.tombstoneRetentionDays) {
      throw new Error("Retention response is incomplete or inconsistent");
    }
    return response;
  }

  async function readBoundedFetchText(response, maxBytes = MAX_RESPONSE_BYTES) {
    const contentLength = Number(response.headers && response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new Error("MemoryEndpoints response exceeds its byte limit");
    }
    if (response.body && typeof response.body.getReader === "function") {
      const reader = response.body.getReader();
      const chunks = [];
      let total = 0;
      while (true) {
        const item = await reader.read();
        if (item.done) {
          break;
        }
        total += item.value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          throw new Error("MemoryEndpoints response exceeds its byte limit");
        }
        chunks.push(item.value);
      }
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return decoder.decode(bytes);
    }
    const text = await response.text();
    if (encoder.encode(text).length > maxBytes) {
      throw new Error("MemoryEndpoints response exceeds its byte limit");
    }
    return text;
  }

  function requireNoStoreResponse(response) {
    const cacheControl = response.headers && response.headers.get("cache-control");
    if (typeof cacheControl !== "string" || !/(?:^|,)\s*no-store\s*(?:,|$)/i.test(cacheControl)) {
      throw new Error("Distributed-sync protected responses require Cache-Control: no-store");
    }
  }

  class MemoryEndpointsDistributedSyncError extends Error {
    constructor(status, errorCode, safeNoOp) {
      super(`MemoryEndpoints distributed sync failed with HTTP ${status} (${errorCode})`);
      this.name = "MemoryEndpointsDistributedSyncError";
      this.status = status;
      this.errorCode = errorCode;
      this.safeNoOp = safeNoOp === true;
    }
  }

  function parseDistributedSyncFailure(status, text) {
    try {
      const failure = parseBoundedJson(text, "Distributed-sync failure");
      const failureKeys = new Set([
        "ok", "safeNoOp", "valuesRedacted", "rawCredentialExposed",
        "rawPayloadExposed", "error"
      ]);
      const errorKeys = new Set(["code", "title", "detail", "safeNoOp", "valuesRedacted"]);
      assertExactKeys(failure, failureKeys, failureKeys, "Distributed-sync failure");
      assertExactKeys(failure.error, errorKeys, errorKeys, "Distributed-sync failure detail");
      validateRedaction(failure, "Distributed-sync failure");
      validateIdentifier("Distributed-sync error code", failure.error.code);
      if (failure.ok !== false || failure.safeNoOp !== true ||
          failure.error.safeNoOp !== true || failure.error.valuesRedacted !== true) {
        throw new Error("Distributed-sync failure is not a safe no-op");
      }
      return new MemoryEndpointsDistributedSyncError(status, failure.error.code, true);
    } catch (_error) {
      return new MemoryEndpointsDistributedSyncError(status, "invalid_error_response", false);
    }
  }

  class MemoryEndpointsDistributedSyncClient {
    constructor(options = {}) {
      if (typeof options.fetch !== "function") {
        throw new Error("Distributed-sync client requires fetch");
      }
      this.fetch = options.fetch;
      this.serviceBaseUrl = String(options.serviceBaseUrl || "");
      resolveDistributedSyncRoute(this.serviceBaseUrl, CAPABILITY_ROUTE);
      validateIdentifier("workspaceId", options.workspaceId);
      validateIdentifier("agentId", options.agentId || "tinyrustlm-agent");
      this.workspaceId = options.workspaceId;
      this.agentId = options.agentId || "tinyrustlm-agent";
      this.headers = Object.freeze({ ...(options.headers || {}) });
      this.capabilities = null;
    }

    async connect() {
      this.capabilities = null;
      const availability = await probeDistributedSyncCapabilities(
        this.fetch,
        this.serviceBaseUrl
      );
      if (availability.status === "live") {
        this.capabilities = availability.capabilities;
      }
      return availability;
    }

    async submitMutation(mutation, idempotencyKey) {
      const capabilities = this.requireLive();
      validateDistributedSyncIdempotencyKey(idempotencyKey);
      const canonical = await canonicalizeHostedRevisionMutation(mutation);
      if (canonical.workspaceId !== this.workspaceId || canonical.actorAgentId !== this.agentId) {
        throw new Error("Hosted mutation belongs to another client identity");
      }
      const body = JSON.stringify(canonical);
      if (encoder.encode(body).length > 128 * 1024) {
        throw new Error("Hosted mutation exceeds the client byte limit");
      }
      const result = await this.request(
        "POST",
        capabilities.routes.submitMutation,
        body,
        idempotencyKey,
        [202, 409]
      );
      let decision;
      try {
        decision = parseRevisionDecisionResponse(result.text);
      } catch (_error) {
        throw parseDistributedSyncFailure(result.status, result.text);
      }
      if (decision.receipt.workspaceId !== canonical.workspaceId ||
          decision.receipt.logicalMemoryId !== canonical.logicalMemoryId ||
          decision.receipt.bodyHash !== canonical.bodyHash) {
        throw new Error("Hosted decision does not match submitted mutation identity");
      }
      return decision;
    }

    async lookupReceipt(request) {
      validateReceiptLookupRequest(request);
      const capabilities = this.requireLive();
      const route = new URL(resolveDistributedSyncRoute(
        this.serviceBaseUrl,
        capabilities.routes.lookupReceipt
      ));
      route.searchParams.set("workspace_id", this.workspaceId);
      const result = await this.requestUrl(
        "GET",
        route.toString(),
        null,
        request.idempotencyKey,
        [200, 404]
      );
      if (result.status === 404) {
        return null;
      }
      const receipt = parseReceiptLookupResponse(result.text).receipt;
      if (receipt.logicalMemoryId !== request.logicalMemoryId ||
          receipt.bodyHash !== request.bodyHash) {
        throw new Error("Looked-up receipt does not match the uncertain operation");
      }
      return receipt;
    }

    async pullChanges(afterSequence, limit, logicalMemoryId = null) {
      const capabilities = this.requireLive();
      if (!Number.isSafeInteger(afterSequence) || afterSequence < 0 ||
          !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PULL_PAGE_SIZE) {
        throw new Error("Pull checkpoint or limit is outside hosted bounds");
      }
      if (logicalMemoryId !== null) {
        validateIdentifier("logicalMemoryId", logicalMemoryId);
      }
      const route = new URL(resolveDistributedSyncRoute(
        this.serviceBaseUrl,
        capabilities.routes.changes
      ));
      route.searchParams.set("workspace_id", this.workspaceId);
      route.searchParams.set("after_sequence", String(afterSequence));
      route.searchParams.set("limit", String(limit));
      if (logicalMemoryId !== null) {
        route.searchParams.set("logical_memory_id", logicalMemoryId);
      }
      const result = await this.requestUrl("GET", route.toString(), null, null, [200]);
      return parseChangePage(result.text, afterSequence);
    }

    async readHeads(logicalMemoryId = null) {
      const capabilities = this.requireLive();
      if (logicalMemoryId !== null) {
        validateIdentifier("logicalMemoryId", logicalMemoryId);
      }
      const route = new URL(resolveDistributedSyncRoute(
        this.serviceBaseUrl,
        capabilities.routes.heads
      ));
      route.searchParams.set("workspace_id", this.workspaceId);
      if (logicalMemoryId !== null) {
        route.searchParams.set("logical_memory_id", logicalMemoryId);
      }
      const result = await this.requestUrl("GET", route.toString(), null, null, [200]);
      const response = parseReadHeadsResponse(result.text);
      if (logicalMemoryId !== null &&
          (response.filters.logicalMemoryId !== logicalMemoryId ||
           response.items.some((item) => item.logicalMemoryId !== logicalMemoryId))) {
        throw new Error("Head response does not match requested logical memory");
      }
      return response;
    }

    registerDevice(request, idempotencyKey) {
      validateDeviceRequest(request, true);
      this.validateRequestIdentity(request);
      return this.deviceRequest(
        this.requireLive().routes.registerDevice,
        request,
        idempotencyKey,
        [201],
        "active"
      );
    }

    rotateDevice(request, idempotencyKey) {
      validateDeviceRequest(request, false);
      this.validateRequestIdentity(request);
      return this.deviceRequest(
        this.requireLive().routes.rotateDevice,
        request,
        idempotencyKey,
        [200],
        "active"
      );
    }

    revokeDevice(request, idempotencyKey) {
      validateDeviceRequest(request, false);
      this.validateRequestIdentity(request);
      return this.deviceRequest(
        this.requireLive().routes.revokeDevice,
        request,
        idempotencyKey,
        [200],
        "revoked"
      );
    }

    async getRetentionPolicy() {
      const capabilities = this.requireLive();
      const route = new URL(resolveDistributedSyncRoute(
        this.serviceBaseUrl,
        capabilities.routes.retention
      ));
      route.searchParams.set("workspace_id", this.workspaceId);
      const result = await this.requestUrl("GET", route.toString(), null, null, [200]);
      const response = parseRetentionPolicyResponse(result.text);
      if (response.policy.tombstoneRetentionDays !== capabilities.retention.tombstoneRetentionDays ||
          response.policy.hardForgetSupported !== capabilities.retention.hardForgetSupported) {
        throw new Error("Retention policy is weaker than negotiated capabilities");
      }
      return response;
    }

    async synchronizePending(options) {
      requirePlainObject(options, "Distributed synchronization options");
      const coordinator = options.coordinator;
      if (!coordinator || typeof coordinator.runAsLeader !== "function") {
        throw new Error("Distributed synchronization requires a Web Locks coordinator");
      }
      for (const callback of ["loadPending", "applyChangePage", "applyDecision"]) {
        if (typeof options[callback] !== "function") {
          throw new Error(`Distributed synchronization requires ${callback}`);
        }
      }
      if (options.workspaceId !== this.workspaceId) {
        throw new Error("Distributed synchronization belongs to another workspace");
      }
      const start = options.afterServerSequence || 0;
      const pageLimit = options.pageLimit || 100;
      return coordinator.runAsLeader(this.workspaceId, async () => {
        let checkpoint = start;
        let hasMore = true;
        while (hasMore) {
          const page = await this.pullChanges(checkpoint, pageLimit);
          await options.applyChangePage(clone(page));
          checkpoint = page.nextAfterSequence;
          hasMore = page.hasMore;
        }
        const pending = await options.loadPending();
        if (!Array.isArray(pending)) {
          throw new Error("Distributed pending loader must return an array");
        }
        const outcomes = [];
        for (const item of pending) {
          requirePlainObject(item, "Distributed pending item");
          validateIdentifier("Distributed pending eventId", item.eventId);
          validateDistributedSyncIdempotencyKey(item.idempotencyKey);
          const canonical = await canonicalizeHostedRevisionMutation(item.mutation);
          let outcome = null;
          if (item.uncertain === true) {
            const receipt = await this.lookupReceipt({
              idempotencyKey: item.idempotencyKey,
              logicalMemoryId: canonical.logicalMemoryId,
              bodyHash: canonical.bodyHash
            });
            outcome = receipt ? { recovered: true, receipt } : null;
          }
          if (!outcome) {
            outcome = {
              recovered: false,
              decision: await this.submitMutation(canonical, item.idempotencyKey)
            };
          }
          await options.applyDecision(clone(item), clone(outcome));
          outcomes.push({ eventId: item.eventId, ...outcome });
        }
        return {
          checkpoint,
          outcomes,
          eventIds: outcomes.map((outcome) => outcome.eventId)
        };
      });
    }

    requireLive() {
      if (!this.capabilities) {
        throw new Error("Distributed sync requires a successful live capability probe");
      }
      return validateCapabilityData(clone(this.capabilities));
    }

    validateRequestIdentity(request) {
      if (request.workspaceId !== this.workspaceId || request.agentId !== this.agentId) {
        throw new Error("Distributed-sync request belongs to another client identity");
      }
    }

    async deviceRequest(route, request, idempotencyKey, statuses, expectedStatus) {
      validateDistributedSyncIdempotencyKey(idempotencyKey);
      const result = await this.request(
        "POST",
        route,
        JSON.stringify(request),
        idempotencyKey,
        statuses
      );
      const authority = parseDeviceAuthorityResponse(result.text);
      if (authority.device.deviceId !== request.deviceId ||
          authority.device.status !== expectedStatus) {
        throw new Error("Device authority response does not match requested authority");
      }
      return authority;
    }

    request(method, advertisedRoute, body, idempotencyKey, acceptedStatuses) {
      return this.requestUrl(
        method,
        resolveDistributedSyncRoute(this.serviceBaseUrl, advertisedRoute),
        body,
        idempotencyKey,
        acceptedStatuses
      );
    }

    async requestUrl(method, url, body, idempotencyKey, acceptedStatuses) {
      const headers = { ...this.headers };
      if (body !== null) {
        headers["Content-Type"] = "application/json";
      }
      if (idempotencyKey !== null) {
        validateDistributedSyncIdempotencyKey(idempotencyKey);
        headers["Idempotency-Key"] = idempotencyKey;
      }
      const response = await this.fetch(url, {
        method,
        headers,
        body,
        cache: "no-store"
      });
      const text = await readBoundedFetchText(response);
      requireNoStoreResponse(response);
      if (!acceptedStatuses.includes(response.status)) {
        throw parseDistributedSyncFailure(response.status, text);
      }
      if (!text) {
        throw new Error("Distributed-sync response body is required");
      }
      return { status: response.status, text };
    }
  }

  async function sha256Hex(value) {
    const provider = root && root.crypto;
    if (!provider || !provider.subtle || typeof provider.subtle.digest !== "function") {
      throw new Error("Web Crypto SHA-256 is required for distributed sync");
    }
    const bytes = typeof value === "string" ? encoder.encode(value) : value;
    const digest = new Uint8Array(await provider.subtle.digest("SHA-256", bytes));
    return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  return Object.freeze({
    CAPABILITIES_SCHEMA,
    PROTOCOL,
    CAPABILITY_ROUTE,
    MAX_PULL_PAGE_SIZE,
    MAX_SUMMARY_CHARS,
    MemoryEndpointsDistributedSyncClient,
    MemoryEndpointsDistributedSyncError,
    parseDistributedSyncCapabilities,
    resolveDistributedSyncRoute,
    probeDistributedSyncCapabilities,
    hostedRevisionMutationBodyHash,
    validateHostedRevisionMutation,
    canonicalizeHostedRevisionMutation,
    serializeHostedRevisionMutation,
    hostedRevisionMutationFingerprint,
    validateDistributedSyncIdempotencyKey,
    parseRevisionDecisionResponse,
    parseReceiptLookupResponse,
    validateReceiptLookupRequest,
    parseChangePage,
    parseReadHeadsResponse,
    parseDeviceAuthorityResponse,
    parseRetentionPolicyResponse,
    parseDistributedSyncFailure
  });
}));
