"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { CampaignEvidenceStore } = require("./campaign-evidence-store.js");

const auditSchema = "tinyrustlm.local_two_lane_p2p_audit.v1";
const receiptType = "tinyrustlm.p2p-local-two-lane";
const maximumAuditBytes = 256 * 1024;
const requiredBlockers = Object.freeze([
  "outside_network_observer_absent",
  "public_endpoint_configuration_absent",
  "catalog_publication_authority_absent"
]);

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

function requireInteger(value, label, minimum, maximum) {
  invariant(Number.isSafeInteger(value) && value >= minimum && value <= maximum,
    `${label} is invalid`);
  return value;
}

function requireSha256(value, label) {
  const hash = String(value || "").toLowerCase();
  invariant(/^[a-f0-9]{64}$/.test(hash), `${label} must be SHA-256`);
  return hash;
}

function requireUtc(value, label) {
  const text = String(value || "");
  invariant(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(text) &&
    Number.isFinite(Date.parse(text)), `${label} must be UTC`);
  return text;
}

function requireLoopbackUrl(value, label) {
  const parsed = new URL(String(value || ""));
  invariant(parsed.protocol === "http:" && parsed.username === "" && parsed.password === "" &&
    parsed.hostname === "127.0.0.1" && parsed.search === "" && parsed.hash === "",
  `${label} must be credential-free IPv4 loopback HTTP`);
  return parsed.href;
}

function readBoundedAudit(filePath) {
  const resolved = path.resolve(String(filePath || ""));
  const stat = fs.statSync(resolved, { throwIfNoEntry: false });
  invariant(stat?.isFile() && stat.size > 0 && stat.size <= maximumAuditBytes,
    "local P2P audit file is missing or outside its size limit");
  return Object.freeze({
    path: resolved,
    bytes: fs.readFileSync(resolved),
    value: JSON.parse(fs.readFileSync(resolved, "utf8"))
  });
}

function validateLocalFleetAudit(value) {
  invariant(isPlainObject(value), "local P2P audit must be an object");
  invariant(value.schema === auditSchema, "local P2P audit schema is unsupported");
  invariant(value.status === "pass-local-only" && value.evidence_class === "local",
    "local P2P audit is not a passing local-only observation");
  invariant(value.public_reachability_proven === false && value.announcement_eligible === false,
    "local P2P audit must never claim public reachability");
  const observedUtc = requireUtc(value.observed_utc, "observed_utc");
  const modelCount = requireInteger(value.model_count, "model_count", 1, 20);
  invariant(requireInteger(value.lane_count, "lane_count", 2, 2) === 2,
    "local P2P audit requires exactly two lanes");
  invariant(requireInteger(value.distinct_started_process_count,
    "distinct_started_process_count", 2, 2) === 2,
  "local P2P audit requires two independently started processes");
  invariant(requireInteger(value.listener_process_count, "listener_process_count", 2, 2) === 2,
    "local P2P audit requires two listener-owning processes");
  invariant(requireInteger(value.graceful_stop_count, "graceful_stop_count", 2, 2) === 2,
    "local P2P audit requires two graceful stops");

  invariant(Array.isArray(value.listeners) && value.listeners.length === 2,
    "local P2P audit listeners are invalid");
  const listenerPorts = new Set();
  const listenerProcesses = new Set();
  for (const listener of value.listeners) {
    invariant(isPlainObject(listener) && listener.LocalAddress === "127.0.0.1",
      "local P2P listener is not IPv4 loopback");
    listenerPorts.add(requireInteger(listener.LocalPort, "listener port", 1024, 65535));
    listenerProcesses.add(requireInteger(listener.OwningProcess, "listener process", 1, 2 ** 31 - 1));
  }
  invariant(listenerPorts.size === 2 && listenerProcesses.size === 2,
    "local P2P listeners do not have independent ports and process owners");

  const probe = value.probe;
  invariant(isPlainObject(probe) && probe.enabled_endpoint_count === 2 &&
    probe.reachable_endpoint_count === 2 && probe.all_enabled_endpoints_reachable === true,
  "local P2P probe did not reach both enabled endpoints");
  invariant(probe.externally_reachable === false && probe.announcement_eligible === false,
    "local P2P probe crossed the external-proof boundary");
  invariant(Array.isArray(probe.endpoints) && probe.endpoints.length === 2,
    "local P2P probe endpoints are invalid");
  const laneIds = new Set();
  const modelIds = new Set();
  for (const endpoint of probe.endpoints) {
    invariant(isPlainObject(endpoint) && endpoint.locally_reachable === true &&
      endpoint.externally_reachable === false && endpoint.announcement_eligible === false,
    "local P2P endpoint state is invalid");
    laneIds.add(String(endpoint.lane_id || ""));
    modelIds.add(String(endpoint.model_id || ""));
    requireLoopbackUrl(endpoint.public_base_url, "public_base_url");
    requireLoopbackUrl(endpoint.local_status_url, "local_status_url");
  }
  invariant(laneIds.size === 2 && modelIds.size === modelCount,
    "local P2P probe lane or model identity count drifted");

  invariant(isPlainObject(value.hashes), "local P2P audit hashes are missing");
  const hashes = {};
  for (const name of [
    "fleet_config", "tool", "minimodel", "serve_stdout", "probe_stdout", "listener_evidence"
  ]) {
    hashes[name] = requireSha256(value.hashes[name], `hashes.${name}`);
  }
  invariant(Array.isArray(value.blockers), "local P2P blockers are missing");
  for (const blocker of requiredBlockers) {
    invariant(value.blockers.includes(blocker), `local P2P audit is missing blocker ${blocker}`);
  }
  return Object.freeze({
    observedUtc,
    modelCount,
    laneIds: Object.freeze(Array.from(laneIds).sort()),
    modelIds: Object.freeze(Array.from(modelIds).sort()),
    ports: Object.freeze(Array.from(listenerPorts).sort((left, right) => left - right)),
    hashes: Object.freeze(hashes),
    blockers: Object.freeze(value.blockers.slice())
  });
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function nextAttempt(store, campaignId, configurationHash, auditHash) {
  const matching = store.listReceipts((receipt) => receipt.receiptType === receiptType &&
    receipt.campaignId === campaignId);
  const existing = matching.find((receipt) =>
    receipt.configurationHash === configurationHash && receipt.outputHashes.audit === auditHash);
  return Object.freeze({
    existing,
    attempt: matching.reduce((maximum, receipt) => Math.max(maximum, receipt.attempt), 0) + 1
  });
}

function writeLocalFleetEvidence(options) {
  invariant(isPlainObject(options), "local P2P receipt options are invalid");
  const audit = readBoundedAudit(options.auditPath);
  const validated = validateLocalFleetAudit(audit.value);
  const campaignId = String(options.campaignId || "");
  const sourceRevision = String(options.sourceRevision || "");
  const store = new CampaignEvidenceStore(options.evidenceRoot);
  const rebuilt = store.rebuild();
  invariant(rebuilt.quarantined.length === 0 &&
    fs.readdirSync(store.quarantinePath, { withFileTypes: true }).every((entry) => !entry.isFile()),
  "local P2P evidence store contains quarantined files");
  const auditHash = sha256(audit.bytes);
  const attempt = nextAttempt(store, campaignId, validated.hashes.fleet_config, auditHash);
  if (attempt.existing) {
    return attempt.existing;
  }
  return store.putReceipt({
    receiptType,
    campaignId,
    phase: "p2p-local-health",
    attempt: attempt.attempt,
    status: "pass",
    createdAtUtc: validated.observedUtc,
    completedAtUtc: validated.observedUtc,
    inputReceiptIds: [],
    inputHashes: {
      fleetConfiguration: validated.hashes.fleet_config,
      minimodel: validated.hashes.minimodel,
      seedHost: validated.hashes.tool
    },
    outputHashes: {
      audit: auditHash,
      listeners: validated.hashes.listener_evidence,
      localProbe: validated.hashes.probe_stdout,
      serveLifecycle: validated.hashes.serve_stdout
    },
    sourceRevision,
    toolNames: ["tinyrustlm-companion", "minimodel"],
    toolVersions: ["content-hash-bound", "content-hash-bound"],
    toolBinaryHashes: [validated.hashes.tool, validated.hashes.minimodel],
    runtimeIdentifier: "win-x64",
    operatingSystem: "windows",
    architecture: "x64",
    hardwareEvidence: {
      realProcessExecution: true,
      outsideNetworkObserver: false
    },
    configurationHash: validated.hashes.fleet_config,
    publicSafeParameters: {
      modelCount: validated.modelCount,
      laneCount: 2,
      independentProcessCount: 2,
      localReachableEndpointCount: 2,
      externallyProvenLaneCount: 0,
      announcementEligibleModelCount: 0,
      laneIds: validated.laneIds,
      modelIds: validated.modelIds,
      loopbackPorts: validated.ports
    },
    boundedDiagnostics: {
      status: "pass-local-only",
      externalBlockers: validated.blockers
    },
    blockerCode: null,
    externalEvidenceReferences: [],
    redactionVersion: "tinyrustlm.public-receipt-redaction.v1",
    evidenceClass: "local",
    supersedesReceiptIds: [],
    attestationReference: null
  }).receipt;
}

module.exports = Object.freeze({
  auditSchema,
  validateLocalFleetAudit,
  writeLocalFleetEvidence
});
