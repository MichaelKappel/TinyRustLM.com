"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");

const { CampaignEvidenceStore, canonicalJson } = require("./campaign-evidence-store.js");

const contractUrl = "https://memoryendpoints.com/api/matm/connector-contract";
const contractSchema = "memoryendpoints.connector_pairing.v1";
const receiptType = "tinyrustlm.memory-endpoints-contract-audit-v1";
const maximumContractBytes = 256 * 1024;

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function requireText(value, label, pattern) {
  const text = String(value || "");
  invariant(text.length > 0 && (!pattern || pattern.test(text)), `${label} is invalid`);
  return text;
}

async function readBoundedResponse(response) {
  const declared = Number(response.headers.get("content-length"));
  invariant(!Number.isFinite(declared) || declared <= maximumContractBytes,
    "MemoryEndpoints contract exceeds its byte limit");
  const reader = response.body?.getReader();
  invariant(reader, "MemoryEndpoints contract response body is missing");
  const chunks = [];
  let byteCount = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    byteCount += value.byteLength;
    invariant(byteCount <= maximumContractBytes,
      "MemoryEndpoints contract exceeds its byte limit");
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, byteCount);
}

function validateRoute(value, expected, label) {
  invariant(value === expected, `MemoryEndpoints contract ${label} route changed`);
  return true;
}

function inspectContract(value) {
  invariant(isPlainObject(value) && value.ok === true && isPlainObject(value.data),
    "MemoryEndpoints connector contract envelope is invalid");
  const data = value.data;
  const schemaVersion = requireText(data.schemaVersion, "connector schemaVersion");
  invariant(schemaVersion === contractSchema, "MemoryEndpoints connector schema is unsupported");
  const contractRevision = requireText(data.contractRevision, "connector contractRevision",
    /^[0-9]+\.[0-9]+$/);
  invariant(data.status === "public_safe_contract", "MemoryEndpoints connector contract is not public-safe");
  invariant(data.issuer === "https://memoryendpoints.com", "MemoryEndpoints connector issuer changed");
  invariant(isPlainObject(data.serviceRoot) &&
    data.serviceRoot.exact === "https://memoryendpoints.com" &&
    data.serviceRoot.userinfoAllowed === false && data.serviceRoot.queryAllowed === false &&
    data.serviceRoot.fragmentAllowed === false,
  "MemoryEndpoints service root boundary changed");
  invariant(isPlainObject(data.security) && data.security.autoWakeAllowed === false &&
    data.security.wakeUpRequiresExplicitHumanAction === true &&
    data.security.credentialStorage === "operating_system_credential_vault",
  "MemoryEndpoints explicit connector-consent boundary changed");
  invariant(isPlainObject(data.authorizationUi) &&
    data.authorizationUi.explicitUserActivationRequired === true &&
    data.authorizationUi.automaticNavigationAllowed === false,
  "MemoryEndpoints human-approval boundary changed");
  invariant(Array.isArray(data.clients) && data.clients.length > 0,
    "MemoryEndpoints connector client list is missing");
  const localEndpointClient = data.clients.find((client) =>
    isPlainObject(client) && client.clientId === "localendpoint-connect");
  invariant(localEndpointClient &&
    Array.isArray(localEndpointClient.registeredRedirectUris) &&
    localEndpointClient.registeredRedirectUris.includes(
      "localendpoint-connect://memoryendpoints/callback"
    ), "MemoryEndpoints LocalEndpoint connector client changed");
  invariant(isPlainObject(data.endpoints) && isPlainObject(data.memoryOperations),
    "MemoryEndpoints connector routes are missing");
  validateRoute(data.endpoints.pairingRequest,
    "/api/matm/connector-pairings/requests", "pairing request");
  validateRoute(data.endpoints.authorizationCodeClaim,
    "/api/matm/connector-pairings/authorization-code-claims", "authorization claim");
  validateRoute(data.endpoints.token,
    "/api/matm/connector-pairings/token", "token exchange");
  validateRoute(data.memoryOperations.publicSafeSubmit?.route,
    "/api/matm/memory-events/submit", "public-safe submit");
  validateRoute(data.memoryOperations.search?.route,
    "/api/matm/search", "memory search");

  const singleAgentEnrollmentAdvertised = isPlainObject(data.singleAgentEnrollment);
  const browserClientAdvertised = data.clients.some((client) => isPlainObject(client) &&
    /(?:tinyrustlm|browser)/i.test(String(client.clientId || "")));
  const operations = isPlainObject(data.operations) ? data.operations : {};
  const endpoints = data.endpoints;
  const companyCreateAdvertised = Object.keys(operations).some((key) =>
    /(?:create|provision).*company|company.*(?:create|provision)/i.test(key)) ||
    Object.keys(endpoints).some((key) => /(?:create|provision).*company/i.test(key));
  const companyDeleteAdvertised = Object.keys(operations).some((key) =>
    /delete.*company|company.*delete/i.test(key)) ||
    Object.keys(endpoints).some((key) => /delete.*company/i.test(key));
  const automatedCompanyLifecycleAdvertised = companyCreateAdvertised && companyDeleteAdvertised;
  const hostedMemoryRoutesAdvertised = true;
  const explicitDesktopPairingAdvertised = true;
  const blockers = [];
  if (!browserClientAdvertised) {
    blockers.push("memory_endpoints_browser_client_not_advertised");
  }
  if (!singleAgentEnrollmentAdvertised) {
    blockers.push("memory_endpoints_single_agent_enrollment_not_advertised");
  }
  if (!automatedCompanyLifecycleAdvertised) {
    blockers.push("memory_endpoints_company_lifecycle_not_advertised");
  }
  return Object.freeze({
    schemaVersion,
    contractRevision,
    generatedAt: requireText(data.generatedAt, "connector generatedAt"),
    contractStatus: data.status,
    browserOnlyDefaultProtected: true,
    automaticLocalAppWakeAllowed: false,
    explicitDesktopPairingAdvertised,
    browserClientAdvertised,
    singleAgentEnrollmentAdvertised,
    automatedCompanyLifecycleAdvertised,
    hostedMemoryRoutesAdvertised,
    compatibleWithRequiredLiveCampaign: blockers.length === 0,
    blockers: Object.freeze(blockers)
  });
}

async function fetchConnectorContract(fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(contractUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      redirect: "manual",
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal
    });
    invariant(response.status === 200 && response.url === contractUrl,
      "MemoryEndpoints connector contract HTTPS readback failed");
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    invariant(contentType.startsWith("application/json"),
      "MemoryEndpoints connector contract content type changed");
    const bytes = await readBoundedResponse(response);
    const text = bytes.toString("utf8").replace(/^\uFEFF/, "");
    return Object.freeze({ bytes: Buffer.from(text, "utf8"), value: JSON.parse(text) });
  } finally {
    clearTimeout(timer);
  }
}

function semanticContractSha256(value) {
  const data = { ...value.data };
  delete data.generatedAt;
  return sha256(canonicalJson({ ok: value.ok, data }));
}

function runtimeIdentifier() {
  const osName = process.platform === "win32"
    ? "win"
    : process.platform === "darwin" ? "osx" : process.platform;
  return `${osName}-${process.arch}`;
}

async function auditMemoryEndpointsContract(options) {
  invariant(isPlainObject(options), "MemoryEndpoints contract audit options are invalid");
  const injectedFetch = typeof options.fetchImpl === "function";
  const fetchImpl = injectedFetch ? options.fetchImpl : globalThis.fetch;
  invariant(typeof fetchImpl === "function", "fetch is unavailable for MemoryEndpoints contract audit");
  const timeoutMs = options.timeoutMs === undefined ? 30_000 : Number(options.timeoutMs);
  invariant(Number.isSafeInteger(timeoutMs) && timeoutMs >= 1_000 && timeoutMs <= 120_000,
    "MemoryEndpoints contract audit timeout is invalid");
  const startedAtUtc = new Date().toISOString();
  const contract = await fetchConnectorContract(fetchImpl, timeoutMs);
  const inspection = inspectContract(contract.value);
  const completedAtUtc = new Date().toISOString();
  const rawContractSha256 = sha256(contract.bytes);
  const semanticSha256 = semanticContractSha256(contract.value);
  const evidenceClass = injectedFetch ? "fixture" : "live-service";
  const store = new CampaignEvidenceStore(options.evidenceRoot);
  const rebuilt = store.rebuild();
  invariant(rebuilt.quarantined.length === 0 &&
    fs.readdirSync(store.quarantinePath, { withFileTypes: true }).every((entry) => !entry.isFile()),
  "MemoryEndpoints contract evidence store contains quarantined files");
  const matching = store.listReceipts((receipt) => receipt.receiptType === receiptType &&
    receipt.campaignId === options.campaignId && receipt.outputHashes.contract === rawContractSha256 &&
    receipt.evidenceClass === evidenceClass);
  if (matching.length > 0) {
    invariant(matching.length === 1, "MemoryEndpoints contract audit receipt is duplicated");
    return Object.freeze({ inspection, receipt: matching[0] });
  }
  const prior = store.listReceipts((receipt) => receipt.receiptType === receiptType &&
    receipt.campaignId === options.campaignId && receipt.evidenceClass === evidenceClass);
  const attempt = prior.reduce((maximum, receipt) => Math.max(maximum, receipt.attempt), 0) + 1;
  const previous = prior.sort((left, right) => left.attempt - right.attempt).at(-1) || null;
  const compatible = inspection.compatibleWithRequiredLiveCampaign;
  const receipt = store.putReceipt({
    receiptType,
    campaignId: options.campaignId,
    phase: "memory-endpoints-contract-audit",
    attempt,
    status: compatible ? "pass" : "blocked",
    createdAtUtc: startedAtUtc,
    completedAtUtc,
    inputReceiptIds: [],
    inputHashes: {},
    outputHashes: {
      contract: rawContractSha256,
      semanticContract: semanticSha256
    },
    sourceRevision: `${inspection.schemaVersion}:${inspection.contractRevision}`,
    toolNames: ["tinyrustlm-memory-endpoints-contract-audit"],
    toolVersions: ["1"],
    toolBinaryHashes: [sha256(fs.readFileSync(__filename))],
    runtimeIdentifier: runtimeIdentifier(),
    operatingSystem: process.platform,
    architecture: process.arch,
    hardwareEvidence: {
      publicHttpsReadback: !injectedFetch,
      authorizationUsed: false,
      credentialsUsed: false
    },
    configurationHash: sha256(canonicalJson({
      contractUrl,
      requiredCampaign: "25-disposable-company-cross-browser-continuity-v1"
    })),
    publicSafeParameters: {
      ...inspection,
      blockers: inspection.blockers
    },
    boundedDiagnostics: {
      contractByteCount: contract.bytes.length,
      retrievalMode: injectedFetch ? "injected-fixture" : "credential-free-public-https"
    },
    blockerCode: compatible ? null : "memory_endpoints_live_contract_incompatible",
    externalEvidenceReferences: [contractUrl],
    redactionVersion: "tinyrustlm.public-receipt-redaction.v1",
    evidenceClass,
    supersedesReceiptIds: previous ? [previous.receiptId] : [],
    attestationReference: null
  }).receipt;
  return Object.freeze({ inspection, receipt });
}

module.exports = Object.freeze({
  auditMemoryEndpointsContract,
  contractSchema,
  contractUrl,
  inspectContract,
  receiptType
});
