"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { CampaignEvidenceStore, canonicalJson } = require("./campaign-evidence-store.js");
const { completeReceiptType } = require("./p2p-outside-proof-evidence.js");

const receiptType = "tinyrustlm.catalog-announcement-v1";
const catalogKind = "minimodel.model_catalog";
const feedKind = "minimodel.peer_source_announcement_catalog";
const announcementKind = "minimodel.peer_source_announcement";
const maximumJsonBytes = 4 * 1024 * 1024;
const maximumVerifierBytes = 128 * 1024 * 1024;
const maximumVerifierOutputBytes = 256 * 1024;
const maximumFeedCount = 16;

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

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function requireSha256(value, label) {
  const hash = String(value || "").toLowerCase().replace(/^sha256:/, "");
  invariant(/^[a-f0-9]{64}$/.test(hash), `${label} must be SHA-256`);
  return hash;
}

function requireUtc(value, label) {
  const text = String(value || "");
  invariant(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(text) &&
    Number.isFinite(Date.parse(text)), `${label} must be ISO-8601 UTC`);
  return text;
}

function requireHttpsUrl(value, label, expectedOrigin = null) {
  const parsed = new URL(String(value || ""));
  invariant(parsed.protocol === "https:" && parsed.username === "" && parsed.password === "" &&
    parsed.search === "" && parsed.hash === "", `${label} must be credential-free HTTPS`);
  if (expectedOrigin) {
    invariant(parsed.origin === expectedOrigin, `${label} must remain on the catalog origin`);
  }
  return parsed;
}

function parseJson(bytes, label) {
  invariant(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= maximumJsonBytes,
    `${label} is outside its byte limit`);
  try {
    const value = JSON.parse(bytes.toString("utf8"));
    invariant(isPlainObject(value), `${label} must be a JSON object`);
    return value;
  } catch (error) {
    throw new Error(`${label} is invalid JSON: ${error.message}`);
  }
}

function validateProofParents(store, proofReceiptIds, readbackUtc, fixture) {
  invariant(Array.isArray(proofReceiptIds) && proofReceiptIds.length === 2 &&
    new Set(proofReceiptIds).size === 2, "catalog readback requires exactly two proof parents");
  const readbackTime = Date.parse(readbackUtc);
  const proofs = proofReceiptIds.map((receiptId) => store.readReceipt(receiptId));
  for (const proof of proofs) {
    invariant(proof?.receiptType === completeReceiptType && proof.status === "pass",
      "catalog readback parent is not complete-transfer proof");
    invariant(proof.evidenceClass === (fixture ? "fixture" : "outside-network"),
      "catalog readback proof evidence class is invalid");
    const parameters = proof.publicSafeParameters || {};
    invariant(parameters.externalReceiptVersion === 1 &&
      parameters.publicReachabilityProven === true &&
      parameters.observerSignatureVerified === true &&
      parameters.completeTransferVerified === true &&
      Date.parse(parameters.expiresAtUtc) > readbackTime,
    "catalog readback proof is incomplete, unverified, or expired");
    requireSha256(parameters.artifactSha256, "proof artifactSha256");
    requireSha256(parameters.pieceSetSha256, "proof pieceSetSha256");
    requireSha256(proof.inputHashes?.signedExternalReceipt,
      "proof signedExternalReceipt hash");
  }
  const first = proofs[0].publicSafeParameters;
  invariant(proofs.every((proof) =>
    proof.publicSafeParameters.modelId === first.modelId &&
    proof.publicSafeParameters.artifactSha256 === first.artifactSha256 &&
    proof.publicSafeParameters.pieceSetSha256 === first.pieceSetSha256 &&
    proof.publicSafeParameters.fleetId === first.fleetId),
  "catalog readback proofs do not identify the same fleet model bytes");
  invariant(new Set(proofs.map((proof) => proof.publicSafeParameters.laneId)).size === 2,
    "catalog readback proofs must identify two distinct lanes");
  invariant(new Set(proofs.map((proof) => proof.publicSafeParameters.publicBaseUrl)).size === 2,
    "catalog readback proofs must identify two distinct public endpoints");
  const qualificationParents = proofs.map((proof) => proof.inputReceiptIds.find((receiptId) => {
    const parent = store.readReceipt(receiptId);
    return parent?.receiptType === "tinyrustlm.model-qualification";
  }));
  invariant(qualificationParents.every(Boolean) && new Set(qualificationParents).size === 1,
    "catalog readback proofs do not share one model qualification");
  return Object.freeze(proofs.slice().sort((left, right) =>
    left.publicSafeParameters.laneId.localeCompare(right.publicSafeParameters.laneId)));
}

function validateCatalogSnapshot(value, expected) {
  invariant(value.catalog_kind === catalogKind && value.catalog_version === 0,
    "public catalog snapshot kind or version is unsupported");
  invariant(value.project_server_serves_model_bytes === false &&
    value.project_server_runs_model_bytes === false,
  "public catalog snapshot crossed the project-server byte boundary");
  invariant(Array.isArray(value.entries), "public catalog entries are missing");
  const entries = value.entries.filter((entry) => entry?.model_id === expected.modelId);
  invariant(entries.length === 1, "public catalog must contain the model exactly once");
  const entry = entries[0];
  invariant(entry.entry_kind === "minimodel.catalog_entry" &&
    entry.artifact_kind === "slm" && entry.artifact_project_server_url === null &&
    entry.project_server_serves_model_bytes === false &&
    entry.project_server_runs_model_bytes === false,
  "public catalog model crossed the metadata-only boundary");
  invariant(requireSha256(entry.artifact_sha256, "catalog artifact_sha256") ===
    expected.artifactSha256, "public catalog model artifact hash changed");
  invariant(Number.isSafeInteger(entry.artifact_byte_count) && entry.artifact_byte_count > 0,
    "public catalog model artifact byte count is invalid");
  invariant(Array.isArray(value.peer_source_announcement_routes) &&
    value.peer_source_announcement_routes.length >= 1 &&
    value.peer_source_announcement_routes.length <= maximumFeedCount,
  "public catalog does not advertise a bounded announcement feed");
  const routes = value.peer_source_announcement_routes.map((row) => {
    invariant(isPlainObject(row) && row.route_kind === feedKind &&
      typeof row.route === "string" && row.route.length >= 1 && row.route.length <= 512,
    "public catalog announcement feed route is invalid");
    return Object.freeze({ route: row.route, sha256: requireSha256(row.sha256, "feed route SHA-256") });
  });
  return Object.freeze({ entry, routes });
}

function validateAnnouncementFeed(value, proofs) {
  invariant(value.announcement_catalog_kind === feedKind &&
    value.announcement_catalog_version === 0,
  "public announcement feed kind or version is unsupported");
  invariant(value.project_server_serves_model_bytes === false &&
    value.project_server_runs_model_bytes === false &&
    value.project_server_proxies_model_bytes === false,
  "public announcement feed crossed the project-server byte boundary");
  invariant(Array.isArray(value.announcements), "public announcement feed rows are missing");
  const matches = [];
  for (const proof of proofs) {
    const parameters = proof.publicSafeParameters;
    const signedReceiptHash = proof.inputHashes.signedExternalReceipt;
    const rows = value.announcements.filter((announcement) => {
      const external = announcement?.external_reachability;
      return announcement?.announcement_kind === announcementKind &&
        announcement.announcement_version === 1 &&
        announcement.model_id === parameters.modelId &&
        requireSha256(announcement.artifact_sha256, "announcement artifact SHA-256") ===
          parameters.artifactSha256 &&
        external?.proof_kind === "minimodel.external_reachability_proof" &&
        external.proof_version === 1 && external.complete_transfer_verified === true &&
        external.receipt_id === parameters.externalReceiptId &&
        requireSha256(external.receipt_sha256, "announcement receipt SHA-256") ===
          signedReceiptHash && external.fleet_id === parameters.fleetId &&
        external.lane_id === parameters.laneId &&
        external.model_id === parameters.modelId &&
        external.public_base_url === parameters.publicBaseUrl &&
        external.expires_utc === parameters.expiresAtUtc;
    });
    invariant(rows.length === 1,
      `public announcement feed must contain exactly one row for lane ${parameters.laneId}`);
    matches.push(rows[0]);
  }
  invariant(new Set(matches.map((row) => row.peer_source?.peer_base_url)).size === 2,
    "public announcement rows do not expose two distinct peer URLs");
  return Object.freeze(matches);
}

async function fetchBoundedJson(url, options) {
  const response = await options.fetchImpl(url.href, {
    method: "GET",
    redirect: "error",
    headers: { accept: "application/json" },
    signal: options.signal
  });
  invariant(response?.ok && response.status === 200,
    `public catalog readback failed with HTTP ${response?.status || "unknown"}`);
  const declared = Number(response.headers?.get?.("content-length"));
  invariant(!Number.isFinite(declared) || (declared > 0 && declared <= maximumJsonBytes),
    "public catalog readback content length is invalid");
  const bytes = Buffer.from(await response.arrayBuffer());
  invariant(bytes.length > 0 && bytes.length <= maximumJsonBytes,
    "public catalog readback body is outside its byte limit");
  return Object.freeze({ url: url.href, bytes, value: parseJson(bytes, "public catalog readback") });
}

function parseVerifierOutput(stdout, header) {
  const lines = String(stdout || "").trim().split(/\r?\n/);
  invariant(lines.shift() === header, `Rust validator did not report ${header}`);
  const fields = new Map();
  for (const line of lines) {
    const separator = line.indexOf(": ");
    invariant(separator > 0, "Rust catalog validator output is malformed");
    const key = line.slice(0, separator);
    invariant(!fields.has(key), `Rust catalog validator repeats ${key}`);
    fields.set(key, line.slice(separator + 2));
  }
  return Object.freeze(Object.fromEntries(fields));
}

function runRustValidation(minimodelPath, args, header) {
  const result = childProcess.spawnSync(minimodelPath, args, {
    encoding: "utf8",
    windowsHide: true,
    timeout: 60_000,
    maxBuffer: maximumVerifierOutputBytes
  });
  invariant(!result.error && result.signal === null && result.status === 0,
    `Rust catalog validation failed: ${String(result.stderr || "").trim() || "no diagnostic"}`);
  invariant(String(result.stderr || "").trim() === "",
    "Rust catalog validator wrote unexpected stderr");
  return Object.freeze({
    stdout: String(result.stdout),
    fields: parseVerifierOutput(result.stdout, header)
  });
}

function validateWithRust(options, catalogBytes, feedBytes, expected) {
  if (typeof options.fixtureRustValidator === "function") {
    invariant(options.evidenceClass === "fixture",
      "an injected catalog validator may only create fixture evidence");
    const result = options.fixtureRustValidator({ catalogBytes, feedBytes, expected });
    invariant(result?.catalogPass === true && result?.feedPass === true,
      "fixture Rust catalog validation did not pass");
    return Object.freeze({
      minimodelSha256: requireSha256(options.fixtureMiniModelSha256, "fixture MiniModel hash"),
      catalogOutputSha256: requireSha256(result.catalogOutputSha256, "fixture catalog output hash"),
      feedOutputSha256: requireSha256(result.feedOutputSha256, "fixture feed output hash")
    });
  }
  invariant(options.evidenceClass === undefined || options.evidenceClass === "deployment",
    "real catalog readback evidence class is invalid");
  const minimodelPath = path.resolve(String(options.minimodelExecutable || ""));
  const stat = fs.lstatSync(minimodelPath, { throwIfNoEntry: false });
  invariant(stat?.isFile() && !stat.isSymbolicLink() && stat.size > 0 &&
    stat.size <= maximumVerifierBytes, "MiniModel catalog verifier is invalid");
  const minimodelSha256 = sha256(fs.readFileSync(minimodelPath));
  invariant(minimodelSha256 === requireSha256(
    options.expectedMiniModelSha256, "expected MiniModel verifier hash"),
  "MiniModel catalog verifier hash is not authorized");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-catalog-readback-"));
  try {
    const catalogPath = path.join(root, "models.v0.json");
    const feedPath = path.join(root, "peer-source-announcements.v0.json");
    fs.writeFileSync(catalogPath, catalogBytes, { flag: "wx", mode: 0o600 });
    fs.writeFileSync(feedPath, feedBytes, { flag: "wx", mode: 0o600 });
    const catalogResult = runRustValidation(minimodelPath,
      ["inspect-catalog-snapshot", catalogPath],
      "MiniModel catalog snapshot validation: PASS");
    const feedResult = runRustValidation(minimodelPath,
      ["inspect-peer-source-announcement-feed", feedPath],
      "MiniModel peer source announcement feed validation: PASS");
    invariant(requireSha256(catalogResult.fields["catalog.sha256"], "Rust catalog hash") ===
      sha256(catalogBytes), "Rust catalog validator hash changed");
    invariant(requireSha256(feedResult.fields["feed.sha256"], "Rust feed hash") ===
      sha256(feedBytes), "Rust feed validator hash changed");
    return Object.freeze({
      minimodelSha256,
      catalogOutputSha256: sha256(Buffer.from(catalogResult.stdout, "utf8")),
      feedOutputSha256: sha256(Buffer.from(feedResult.stdout, "utf8"))
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function currentRuntimeIdentifier() {
  const osName = process.platform === "win32"
    ? "win"
    : process.platform === "darwin" ? "osx" : process.platform;
  return `${osName}-${process.arch}`;
}

async function persistCatalogAnnouncementEvidence(options) {
  invariant(isPlainObject(options), "catalog readback evidence options are invalid");
  const readbackUtc = requireUtc(options.readbackUtc || new Date().toISOString(), "readback time");
  const fixture = options.evidenceClass === "fixture";
  const store = new CampaignEvidenceStore(options.evidenceRoot);
  const rebuilt = store.rebuild();
  invariant(rebuilt.quarantined.length === 0 &&
    fs.readdirSync(store.quarantinePath, { withFileTypes: true }).every((entry) => !entry.isFile()),
  "catalog readback evidence store contains quarantined files");
  const proofs = validateProofParents(store, options.proofReceiptIds, readbackUtc, fixture);
  const expected = Object.freeze({
    modelId: proofs[0].publicSafeParameters.modelId,
    artifactSha256: proofs[0].publicSafeParameters.artifactSha256,
    pieceSetSha256: proofs[0].publicSafeParameters.pieceSetSha256
  });
  const catalogUrl = requireHttpsUrl(options.catalogUrl, "catalog URL");
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  invariant(typeof fetchImpl === "function", "catalog readback fetch implementation is unavailable");
  if (options.fetchImpl) {
    invariant(fixture, "an injected fetch may only create fixture catalog evidence");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let catalog;
  let feed;
  try {
    catalog = await fetchBoundedJson(catalogUrl, { fetchImpl, signal: controller.signal });
    const validatedCatalog = validateCatalogSnapshot(catalog.value, expected);
    for (const route of validatedCatalog.routes) {
      const feedUrl = requireHttpsUrl(new URL(route.route, catalogUrl),
        "announcement feed URL", catalogUrl.origin);
      const candidate = await fetchBoundedJson(feedUrl, { fetchImpl, signal: controller.signal });
      if (sha256(candidate.bytes) === route.sha256) {
        feed = candidate;
        break;
      }
    }
    invariant(feed, "no catalog announcement feed matched its advertised SHA-256");
  } finally {
    clearTimeout(timeout);
  }
  validateAnnouncementFeed(feed.value, proofs);
  const rust = validateWithRust(options, catalog.bytes, feed.bytes, expected);
  const hashes = Object.freeze({
    catalog: sha256(catalog.bytes),
    feed: sha256(feed.bytes),
    adapter: sha256(fs.readFileSync(__filename))
  });
  const configurationHash = sha256(canonicalJson({
    receiptType,
    proofReceiptIds: proofs.map((proof) => proof.receiptId),
    catalogUrl: catalog.url,
    catalogSha256: hashes.catalog,
    feedUrl: feed.url,
    feedSha256: hashes.feed,
    minimodelSha256: rust.minimodelSha256
  }));
  const existing = store.listReceipts((receipt) => receipt.receiptType === receiptType &&
    receipt.campaignId === options.campaignId && receipt.configurationHash === configurationHash);
  if (existing.length > 0) {
    return existing[0];
  }
  const history = store.listReceipts((receipt) => receipt.receiptType === receiptType &&
    receipt.campaignId === options.campaignId &&
    receipt.publicSafeParameters?.modelId === expected.modelId &&
    receipt.evidenceClass === (fixture ? "fixture" : "deployment"));
  const superseded = new Set(history.flatMap((receipt) => receipt.supersedesReceiptIds));
  const current = history.filter((receipt) => !superseded.has(receipt.receiptId));
  return store.putReceipt({
    receiptType,
    campaignId: options.campaignId,
    phase: "catalog-announcement-public-readback",
    attempt: history.reduce((maximum, receipt) => Math.max(maximum, receipt.attempt), 0) + 1,
    status: "pass",
    createdAtUtc: readbackUtc,
    completedAtUtc: readbackUtc,
    inputReceiptIds: proofs.map((proof) => proof.receiptId),
    inputHashes: {
      artifact: expected.artifactSha256,
      catalog: hashes.catalog,
      feed: hashes.feed,
      pieceSet: expected.pieceSetSha256
    },
    outputHashes: {
      catalogReadback: hashes.catalog,
      feedReadback: hashes.feed,
      rustCatalogInspection: rust.catalogOutputSha256,
      rustFeedInspection: rust.feedOutputSha256
    },
    sourceRevision: proofs[0].sourceRevision,
    toolNames: ["minimodel", "tinyrustlm-catalog-announcement-evidence"],
    toolVersions: ["content-hash-bound", receiptType],
    toolBinaryHashes: [rust.minimodelSha256, hashes.adapter],
    runtimeIdentifier: currentRuntimeIdentifier(),
    operatingSystem: process.platform,
    architecture: process.arch,
    hardwareEvidence: {
      liveHttpsReadback: !fixture,
      rustCatalogValidation: true,
      twoCurrentOutsideProofParents: true
    },
    configurationHash,
    publicSafeParameters: {
      modelId: expected.modelId,
      artifactSha256: expected.artifactSha256,
      pieceSetSha256: expected.pieceSetSha256,
      fleetId: proofs[0].publicSafeParameters.fleetId,
      laneIds: proofs.map((proof) => proof.publicSafeParameters.laneId),
      publicBaseUrls: proofs.map((proof) => proof.publicSafeParameters.publicBaseUrl),
      catalogUrl: catalog.url,
      catalogSha256: hashes.catalog,
      announcementFeedUrl: feed.url,
      announcementFeedSha256: hashes.feed,
      publicHttpsReadback: !fixture,
      active: !fixture,
      matchedAnnouncementCount: 2,
      projectServerServesModelBytes: false,
      projectServerRunsModelBytes: false,
      projectServerProxiesModelBytes: false
    },
    boundedDiagnostics: {
      catalogKind,
      feedKind,
      fixture,
      readbackStatus: "PASS"
    },
    blockerCode: null,
    externalEvidenceReferences: [catalog.url, feed.url],
    redactionVersion: "tinyrustlm.public-receipt-redaction.v1",
    evidenceClass: fixture ? "fixture" : "deployment",
    supersedesReceiptIds: current.map((receipt) => receipt.receiptId).sort(),
    attestationReference: `sha256:${hashes.feed}`
  }).receipt;
}

module.exports = Object.freeze({
  persistCatalogAnnouncementEvidence,
  receiptType,
  validateAnnouncementFeed,
  validateCatalogSnapshot
});
