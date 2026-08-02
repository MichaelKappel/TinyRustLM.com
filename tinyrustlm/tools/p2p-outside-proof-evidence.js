"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

const { CampaignEvidenceStore, canonicalJson } = require("./campaign-evidence-store.js");

const completeReceiptType = "tinyrustlm.p2p-outside-proof-v1";
const sampledReceiptType = "tinyrustlm.p2p-outside-reachability-v0";
const externalReceiptKind = "minimodel.external_reachability_receipt";
const externalNetworkScope = "outside-host-and-local-network";
const completeTransferScope = "complete-artifact-piece-set";
const maximumJsonBytes = 4 * 1024 * 1024;
const maximumVerifierBytes = 128 * 1024 * 1024;
const maximumVerifierOutputBytes = 256 * 1024;
const verifierPassLine = "MiniModel external probe receipt inspection: PASS";

const receiptFields = new Set([
  "receipt_kind",
  "receipt_version",
  "receipt_id",
  "observer_id",
  "observer_key_id",
  "fleet_id",
  "lane_id",
  "model_id",
  "public_base_url",
  "artifact_sha256",
  "piece_set_sha256",
  "checked_utc",
  "expires_utc",
  "probe_implementation_version",
  "network_scope",
  "transfer_scope",
  "downloaded_piece_count",
  "downloaded_artifact_byte_count",
  "downloaded_artifact_sha256",
  "checked_routes",
  "signature"
]);
const routeFields = new Set(["route", "http_status", "body_byte_count", "body_sha256"]);
const signatureFields = new Set(["kind", "payload_sha256", "value"]);

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

function exactFields(value, allowed, required, label) {
  invariant(isPlainObject(value), `${label} must be an object`);
  for (const key of Object.keys(value)) {
    invariant(allowed.has(key), `${label} has unknown field ${key}`);
  }
  for (const key of required) {
    invariant(Object.hasOwn(value, key), `${label} is missing ${key}`);
  }
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function requireSha256(value, label) {
  const normalized = String(value || "").toLowerCase().replace(/^sha256:/, "");
  invariant(/^[a-f0-9]{64}$/.test(normalized), `${label} must be SHA-256`);
  return normalized;
}

function requireUtc(value, label) {
  const text = String(value || "");
  invariant(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(text) &&
    Number.isFinite(Date.parse(text)), `${label} must be ISO-8601 UTC`);
  return text;
}

function requireSafeId(value, label, modelId = false) {
  const text = String(value || "");
  const pattern = modelId
    ? /^[A-Za-z0-9][A-Za-z0-9._/+:-]{0,255}$/
    : /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
  invariant(pattern.test(text), `${label} is invalid`);
  return text;
}

function requireInteger(value, label, minimum, maximum = Number.MAX_SAFE_INTEGER) {
  invariant(Number.isSafeInteger(value) && value >= minimum && value <= maximum,
    `${label} is invalid`);
  return value;
}

function isReservedIpv4(hostname) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0);
}

function isReservedIpv6(hostname) {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (normalized === "::" || normalized === "::1" || normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") || normalized.startsWith("fea") ||
      normalized.startsWith("feb") || normalized.startsWith("fc") ||
      normalized.startsWith("fd") || normalized.startsWith("ff") ||
      normalized.startsWith("2001:db8:")) {
    return true;
  }
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isReservedIpv4(mapped[1]) : false;
}

function requirePublicBaseUrl(value) {
  const parsed = new URL(String(value || ""));
  invariant((parsed.protocol === "http:" || parsed.protocol === "https:") &&
    parsed.username === "" && parsed.password === "" && parsed.search === "" &&
    parsed.hash === "" && parsed.pathname.endsWith("/"),
  "external proof public_base_url must be credential-free HTTP(S) base URL");
  const hostname = parsed.hostname.toLowerCase();
  const ipKind = net.isIP(hostname.replace(/^\[|\]$/g, ""));
  if (ipKind === 4) {
    invariant(!isReservedIpv4(hostname),
      "external proof public_base_url must not use a local or reserved IPv4 address");
  } else if (ipKind === 6) {
    invariant(!isReservedIpv6(hostname),
      "external proof public_base_url must not use a local or reserved IPv6 address");
  } else {
    invariant(hostname.length <= 253 && hostname.includes(".") &&
      !/(?:^|\.)(?:localhost|local|internal|invalid|test|example)$/.test(hostname) &&
      !hostname.endsWith(".home.arpa"),
    "external proof public_base_url must use a public DNS name");
  }
  return parsed.href;
}

function readBoundedRegularFile(filePath, label, maximumBytes) {
  const resolved = path.resolve(String(filePath || ""));
  const stat = fs.lstatSync(resolved, { throwIfNoEntry: false });
  invariant(stat?.isFile() && !stat.isSymbolicLink() && stat.size > 0 && stat.size <= maximumBytes,
    `${label} must be a bounded regular non-symlink file`);
  return Object.freeze({ path: resolved, bytes: fs.readFileSync(resolved) });
}

function parseExternalReceipt(bytes, nowUtc = new Date().toISOString()) {
  const value = JSON.parse(bytes.toString("utf8"));
  const required = Array.from(receiptFields).filter((field) => ![
    "transfer_scope",
    "downloaded_piece_count",
    "downloaded_artifact_byte_count",
    "downloaded_artifact_sha256"
  ].includes(field));
  exactFields(value, receiptFields, required, "external proof receipt");
  invariant(value.receipt_kind === externalReceiptKind,
    "external proof receipt kind is unsupported");
  const version = requireInteger(value.receipt_version, "receipt_version", 0, 1);
  const receiptId = requireSafeId(value.receipt_id, "receipt_id");
  const observerId = requireSafeId(value.observer_id, "observer_id");
  const observerKeyId = requireSafeId(value.observer_key_id, "observer_key_id");
  const fleetId = requireSafeId(value.fleet_id, "fleet_id");
  const laneId = requireSafeId(value.lane_id, "lane_id");
  const modelId = requireSafeId(value.model_id, "model_id", true);
  const publicBaseUrl = requirePublicBaseUrl(value.public_base_url);
  const artifactSha256 = requireSha256(value.artifact_sha256, "artifact_sha256");
  const pieceSetSha256 = requireSha256(value.piece_set_sha256, "piece_set_sha256");
  const checkedAtUtc = requireUtc(value.checked_utc, "checked_utc");
  const expiresAtUtc = requireUtc(value.expires_utc, "expires_utc");
  const now = Date.parse(requireUtc(nowUtc, "inspection time"));
  invariant(Date.parse(expiresAtUtc) > now, "external proof receipt is expired");
  invariant(Date.parse(expiresAtUtc) > Date.parse(checkedAtUtc) &&
    Date.parse(expiresAtUtc) - Date.parse(checkedAtUtc) <= 60 * 60 * 1000,
  "external proof receipt validity window is invalid");
  invariant(value.network_scope === externalNetworkScope,
    "external proof receipt is not outside the host and local network");
  invariant(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value.probe_implementation_version),
    "external proof implementation version is invalid");

  exactFields(value.signature, signatureFields, signatureFields, "external proof signature");
  invariant(value.signature.kind === "ed25519", "external proof signature must be Ed25519");
  const signaturePayloadSha256 = requireSha256(
    value.signature.payload_sha256, "signature.payload_sha256");
  invariant(/^ed25519-base64:[A-Za-z0-9+/]+={0,2}$/.test(String(value.signature.value || "")),
    "external proof signature value is invalid");

  invariant(Array.isArray(value.checked_routes), "external proof checked_routes must be an array");
  const routes = value.checked_routes.map((route, index) => {
    exactFields(route, routeFields, routeFields, `external proof route ${index}`);
    invariant(typeof route.route === "string" && route.route.length >= 1 &&
      route.route.length <= 255 && !/[\\/?#\u0000-\u001f]/.test(route.route),
    `external proof route ${index} name is unsafe`);
    invariant(route.http_status === 200, `external proof route ${index} did not return 200`);
    return Object.freeze({
      route: route.route,
      bodyByteCount: requireInteger(route.body_byte_count, `route ${index} byte count`, 1),
      bodySha256: requireSha256(route.body_sha256, `route ${index} body_sha256`)
    });
  });
  invariant(routes[0]?.route === "minimodel.peer_status.v0.json" &&
    routes[1]?.route === "minimodel.peer_companion_state.v0.json" &&
    routes[2]?.route === "minimodel.peer_piece_set.v0",
  "external proof metadata routes are not in canonical order");
  invariant(new Set(routes.map((route) => route.route)).size === routes.length,
    "external proof checked_routes contain duplicates");

  let completeTransferVerified = false;
  let downloadedPieceCount = null;
  let downloadedArtifactByteCount = null;
  let downloadedArtifactSha256 = null;
  if (version === 0) {
    invariant(routes.length === 4, "sampled external proof must contain exactly four routes");
    for (const field of [
      "transfer_scope",
      "downloaded_piece_count",
      "downloaded_artifact_byte_count",
      "downloaded_artifact_sha256"
    ]) {
      invariant(!Object.hasOwn(value, field), `sampled external proof must not contain ${field}`);
    }
  } else {
    invariant(value.transfer_scope === completeTransferScope,
      "complete external proof transfer_scope is invalid");
    downloadedPieceCount = requireInteger(
      value.downloaded_piece_count, "downloaded_piece_count", 1, 1_000_000);
    downloadedArtifactByteCount = requireInteger(
      value.downloaded_artifact_byte_count, "downloaded_artifact_byte_count", 1);
    downloadedArtifactSha256 = requireSha256(
      value.downloaded_artifact_sha256, "downloaded_artifact_sha256");
    invariant(downloadedArtifactSha256 === artifactSha256,
      "complete external proof artifact hash changed");
    invariant(routes.length === 3 + downloadedPieceCount,
      "complete external proof must include every downloaded piece route");
    completeTransferVerified = true;
  }

  return Object.freeze({
    value,
    version,
    receiptId,
    observerId,
    observerKeyId,
    fleetId,
    laneId,
    modelId,
    publicBaseUrl,
    artifactSha256,
    pieceSetSha256,
    checkedAtUtc,
    expiresAtUtc,
    signaturePayloadSha256,
    completeTransferVerified,
    downloadedPieceCount,
    downloadedArtifactByteCount,
    downloadedArtifactSha256,
    checkedRouteCount: routes.length,
    probeImplementationVersion: value.probe_implementation_version
  });
}

function parseVerifierOutput(stdout, parsed) {
  const lines = String(stdout || "").trim().split(/\r?\n/);
  invariant(lines.shift() === verifierPassLine, "MiniModel external proof verifier did not pass");
  const fields = new Map();
  for (const line of lines) {
    const separator = line.indexOf(": ");
    invariant(separator > 0, "MiniModel external proof verifier output is malformed");
    const key = line.slice(0, separator);
    invariant(!fields.has(key), `MiniModel verifier output repeats ${key}`);
    fields.set(key, line.slice(separator + 2));
  }
  const expected = {
    receipt_version: String(parsed.version),
    receipt_id: parsed.receiptId,
    observer_id: parsed.observerId,
    fleet_id: parsed.fleetId,
    lane_id: parsed.laneId,
    model_id: parsed.modelId,
    public_base_url: parsed.publicBaseUrl,
    checked_utc: parsed.checkedAtUtc,
    expires_utc: parsed.expiresAtUtc,
    complete_transfer_verified: String(parsed.completeTransferVerified),
    externally_reachable: "true",
    announcement_eligible: "true"
  };
  if (parsed.completeTransferVerified) {
    expected.downloaded_piece_count = String(parsed.downloadedPieceCount);
    expected.downloaded_artifact_byte_count = String(parsed.downloadedArtifactByteCount);
    expected.downloaded_artifact_sha256 = `sha256:${parsed.downloadedArtifactSha256}`;
  }
  invariant(fields.size === Object.keys(expected).length,
    "MiniModel verifier output contains unexpected or missing fields");
  for (const [key, value] of Object.entries(expected)) {
    invariant(fields.get(key) === value, `MiniModel verifier output disagrees on ${key}`);
  }
  return Object.freeze({ stdout: String(stdout), fields: Object.freeze(Object.fromEntries(fields)) });
}

function inspectWithRust(options, parsed, files) {
  if (typeof options.fixtureVerifier === "function") {
    invariant(options.evidenceClass === "fixture",
      "an injected verifier may only create fixture evidence");
    return Object.freeze({
      ...parseVerifierOutput(options.fixtureVerifier(parsed), parsed),
      minimodelSha256: requireSha256(options.fixtureMiniModelSha256, "fixture MiniModel hash"),
      minimodelPath: null
    });
  }
  invariant(options.evidenceClass === undefined || options.evidenceClass === "outside-network",
    "real external proof evidence class is invalid");
  const minimodel = readBoundedRegularFile(
    options.minimodelExecutable, "MiniModel verifier", maximumVerifierBytes);
  const minimodelSha256 = sha256(minimodel.bytes);
  invariant(minimodelSha256 === requireSha256(
    options.expectedMiniModelSha256, "expected MiniModel verifier hash"),
  "MiniModel verifier binary hash is not the authorized hash");
  const result = childProcess.spawnSync(minimodel.path, [
    "inspect-external-probe-receipt",
    files.receipt.path,
    files.trust.path,
    files.config.path
  ], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 60_000,
    maxBuffer: maximumVerifierOutputBytes
  });
  invariant(!result.error && result.signal === null && result.status === 0,
    `MiniModel external proof verification failed: ${String(result.stderr || "").trim() || "no diagnostic"}`);
  invariant(String(result.stderr || "").trim() === "",
    "MiniModel external proof verifier wrote unexpected stderr");
  return Object.freeze({
    ...parseVerifierOutput(result.stdout, parsed),
    minimodelSha256,
    minimodelPath: minimodel.path
  });
}

function validateQualification(receipt, parsed) {
  invariant(receipt?.receiptType === "tinyrustlm.model-qualification" &&
    receipt.phase === "model-qualification" && receipt.status === "pass" &&
    receipt.evidenceClass === "local",
  "external proof requires passing local-native model qualification");
  invariant(receipt.publicSafeParameters?.modelId === parsed.modelId &&
    receipt.publicSafeParameters?.qualityClaim === "conversation-proven",
  "external proof qualification model identity or claim changed");
  invariant(receipt.outputHashes?.model === parsed.artifactSha256,
    "external proof artifact does not match model qualification");
  return receipt;
}

function currentRuntimeIdentifier() {
  const osName = process.platform === "win32"
    ? "win"
    : process.platform === "darwin" ? "osx" : process.platform;
  return `${osName}-${process.arch}`;
}

function persistOutsideProofEvidence(options) {
  invariant(isPlainObject(options), "external proof evidence options are invalid");
  const files = Object.freeze({
    receipt: readBoundedRegularFile(options.receiptPath, "external proof receipt", maximumJsonBytes),
    trust: readBoundedRegularFile(options.trustPath, "external proof trust", maximumJsonBytes),
    config: readBoundedRegularFile(options.fleetConfigPath, "seed fleet config", maximumJsonBytes)
  });
  const inspectedAtUtc = requireUtc(options.inspectedAtUtc || new Date().toISOString(),
    "inspection time");
  const parsed = parseExternalReceipt(files.receipt.bytes, inspectedAtUtc);
  const store = new CampaignEvidenceStore(options.evidenceRoot);
  const rebuilt = store.rebuild();
  invariant(rebuilt.quarantined.length === 0 &&
    fs.readdirSync(store.quarantinePath, { withFileTypes: true }).every((entry) => !entry.isFile()),
  "external proof evidence store contains quarantined files");
  const qualification = validateQualification(
    store.readReceipt(options.qualificationReceiptId), parsed);
  const inspection = inspectWithRust(options, parsed, files);
  const evidenceClass = options.evidenceClass === "fixture" ? "fixture" : "outside-network";
  const receiptType = parsed.completeTransferVerified ? completeReceiptType : sampledReceiptType;
  const hashes = Object.freeze({
    receipt: sha256(files.receipt.bytes),
    trust: sha256(files.trust.bytes),
    fleetConfig: sha256(files.config.bytes),
    verifierOutput: sha256(Buffer.from(inspection.stdout, "utf8")),
    adapter: sha256(fs.readFileSync(__filename))
  });
  const configurationHash = sha256(canonicalJson({
    receiptType,
    qualificationReceiptId: qualification.receiptId,
    externalReceiptSha256: hashes.receipt,
    trustSha256: hashes.trust,
    fleetConfigSha256: hashes.fleetConfig,
    minimodelSha256: inspection.minimodelSha256
  }));
  const matching = store.listReceipts((receipt) => receipt.receiptType === receiptType &&
    receipt.campaignId === options.campaignId && receipt.configurationHash === configurationHash);
  if (matching.length > 0) {
    return matching[0];
  }
  const laneHistory = store.listReceipts((receipt) =>
    new Set([completeReceiptType, sampledReceiptType]).has(receipt.receiptType) &&
    receipt.campaignId === options.campaignId &&
    receipt.publicSafeParameters?.modelId === parsed.modelId &&
    receipt.publicSafeParameters?.laneId === parsed.laneId &&
    receipt.evidenceClass === evidenceClass);
  const superseded = new Set(laneHistory.flatMap((receipt) => receipt.supersedesReceiptIds));
  const currentLaneReceipts = laneHistory.filter((receipt) => !superseded.has(receipt.receiptId));
  const completedAtUtc = Date.parse(inspectedAtUtc) >= Date.parse(parsed.checkedAtUtc)
    ? inspectedAtUtc
    : parsed.checkedAtUtc;
  return store.putReceipt({
    receiptType,
    campaignId: options.campaignId,
    phase: parsed.completeTransferVerified
      ? "p2p-outside-complete-transfer-proof"
      : "p2p-outside-reachability-sample",
    attempt: laneHistory.reduce((maximum, receipt) => Math.max(maximum, receipt.attempt), 0) + 1,
    status: "pass",
    createdAtUtc: parsed.checkedAtUtc,
    completedAtUtc,
    inputReceiptIds: [qualification.receiptId],
    inputHashes: {
      fleetConfiguration: hashes.fleetConfig,
      model: parsed.artifactSha256,
      observerTrust: hashes.trust,
      signedExternalReceipt: hashes.receipt
    },
    outputHashes: {
      artifact: parsed.artifactSha256,
      pieceSet: parsed.pieceSetSha256,
      rustInspection: hashes.verifierOutput,
      signaturePayload: parsed.signaturePayloadSha256
    },
    sourceRevision: qualification.sourceRevision,
    toolNames: ["minimodel", "tinyrustlm-p2p-outside-proof-evidence"],
    toolVersions: [parsed.probeImplementationVersion, receiptType],
    toolBinaryHashes: [inspection.minimodelSha256, hashes.adapter],
    runtimeIdentifier: currentRuntimeIdentifier(),
    operatingSystem: process.platform,
    architecture: process.arch,
    hardwareEvidence: {
      independentOutsideNetworkObserver: true,
      observerSignatureVerifiedByRust: true,
      completeArtifactTransfer: parsed.completeTransferVerified
    },
    configurationHash,
    publicSafeParameters: {
      modelId: parsed.modelId,
      artifactSha256: parsed.artifactSha256,
      pieceSetSha256: parsed.pieceSetSha256,
      fleetId: parsed.fleetId,
      laneId: parsed.laneId,
      publicBaseUrl: parsed.publicBaseUrl,
      observerId: parsed.observerId,
      observerKeyId: parsed.observerKeyId,
      externalReceiptId: parsed.receiptId,
      externalReceiptVersion: parsed.version,
      checkedAtUtc: parsed.checkedAtUtc,
      expiresAtUtc: parsed.expiresAtUtc,
      checkedRouteCount: parsed.checkedRouteCount,
      downloadedPieceCount: parsed.downloadedPieceCount,
      downloadedArtifactByteCount: parsed.downloadedArtifactByteCount,
      publicReachabilityProven: true,
      observerSignatureVerified: true,
      completeTransferVerified: parsed.completeTransferVerified,
      announcementEligible: true,
      projectServerServesModelBytes: false,
      projectServerRunsModelBytes: false,
      projectServerProxiesModelBytes: false
    },
    boundedDiagnostics: {
      verifierStatus: "PASS",
      networkScope: externalNetworkScope,
      transferScope: parsed.completeTransferVerified ? completeTransferScope : "sampled-first-piece"
    },
    blockerCode: null,
    externalEvidenceReferences: [
      `observer:${parsed.observerId}`,
      `observer-key:${parsed.observerKeyId}`
    ],
    redactionVersion: "tinyrustlm.public-receipt-redaction.v1",
    evidenceClass,
    supersedesReceiptIds: currentLaneReceipts.map((receipt) => receipt.receiptId).sort(),
    attestationReference: `sha256:${hashes.receipt}`
  }).receipt;
}

module.exports = Object.freeze({
  completeReceiptType,
  parseExternalReceipt,
  persistOutsideProofEvidence,
  sampledReceiptType
});
