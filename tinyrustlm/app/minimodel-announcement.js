(function attachMiniModelAnnouncement(globalObject) {
  "use strict";

  const PROOF_KIND = "minimodel.external_reachability_proof";
  const NETWORK_SCOPE = "outside-host-and-local-network";
  const TRANSFER_SCOPE = "complete-artifact-piece-set";
  const MAX_VALIDITY_MS = 60 * 60 * 1000;
  const CLOCK_SKEW_MS = 5 * 60 * 1000;
  const BLOCKED_HOSTS = new Set([
    "tinyrustlm.com",
    "minimodel.org",
    "uaix.org",
    "memoryendpoints.com",
    "huggingface.co"
  ]);

  function requireObject(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${label} must be an object`);
    }
    return value;
  }

  function requireString(value, label) {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`${label} must be a non-empty string`);
    }
    return value.trim();
  }

  function requireExact(value, expected, label) {
    if (value !== expected) {
      throw new Error(`${label} must be ${String(expected)}`);
    }
  }

  function requireSha256(value, label) {
    const normalized = requireString(value, label).toLowerCase();
    if (!/^sha256:[a-f0-9]{64}$/.test(normalized)) {
      throw new Error(`${label} must be a prefixed SHA-256 value`);
    }
    return normalized;
  }

  function requireRouteSafeId(value, label) {
    const normalized = requireString(value, label);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(normalized)) {
      throw new Error(`${label} must be route-safe ASCII`);
    }
    return normalized;
  }

  function requireModelId(value, label) {
    const normalized = requireString(value, label);
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,179}$/.test(normalized)) {
      throw new Error(`${label} is invalid`);
    }
    return normalized;
  }

  function requireUtcSecond(value, label) {
    const normalized = requireString(value, label);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(normalized)) {
      throw new Error(`${label} must use UTC second precision`);
    }
    const milliseconds = Date.parse(normalized);
    if (!Number.isFinite(milliseconds)) {
      throw new Error(`${label} is invalid`);
    }
    return { text: normalized, milliseconds };
  }

  function defaultNormalizePeerUrl(value) {
    const raw = requireString(value, "peer URL");
    let url;
    try {
      url = new URL(raw);
    } catch (_error) {
      throw new Error("peer URL must be an absolute HTTP URL");
    }
    if (url.protocol !== "http:") {
      throw new Error("peer URL must use direct HTTP");
    }
    if (url.username || url.password || url.search || url.hash) {
      throw new Error("peer URL must not contain credentials, query, or fragment");
    }
    const host = url.hostname.toLowerCase().replace(/\.+$/, "");
    const plainHost = host.startsWith("www.") ? host.slice(4) : host;
    if (!host || BLOCKED_HOSTS.has(plainHost)
        || Array.from(BLOCKED_HOSTS).some((blocked) => plainHost.endsWith(`.${blocked}`))) {
      throw new Error("project and model-hosting domains cannot serve peer model bytes");
    }
    if (!/^[a-z0-9.-]+$/i.test(host) || url.pathname.includes("\\") || url.pathname.includes("..")) {
      throw new Error("peer URL contains an unsafe host or path");
    }
    url.hostname = host;
    if (!url.pathname.endsWith("/")) {
      url.pathname += "/";
    }
    return url.toString();
  }

  function requireMetadataOnly(value, label) {
    requireExact(value.project_server_serves_model_bytes, false, `${label}.project_server_serves_model_bytes`);
    requireExact(value.project_server_runs_model_bytes, false, `${label}.project_server_runs_model_bytes`);
    requireExact(value.project_server_proxies_model_bytes, false, `${label}.project_server_proxies_model_bytes`);
  }

  function validate(rawValue, options = {}) {
    const raw = requireObject(rawValue, "peer announcement");
    requireExact(raw.announcement_kind, "minimodel.peer_source_announcement", "announcement_kind");
    if (raw.announcement_version !== 1) {
      throw new Error("announcement_version must be 1 with external proof");
    }
    requireExact(
      raw.announcement_status,
      "peer-source-externally-verified-metadata-only",
      "announcement_status"
    );
    requireExact(raw.artifact_kind, "slm", "artifact_kind");
    requireMetadataOnly(raw, "peer announcement");

    const modelId = requireModelId(raw.model_id, "model_id");
    const artifactSha256 = requireSha256(raw.artifact_sha256, "artifact_sha256");
    requireSha256(raw.peer_offer_sha256, "peer_offer_sha256");
    requireSha256(raw.peer_offer_merkle_root_sha256, "peer_offer_merkle_root_sha256");
    requireSha256(raw.catalog_entry_sha256, "catalog_entry_sha256");
    if (!Number.isSafeInteger(raw.artifact_byte_count) || raw.artifact_byte_count < 1) {
      throw new Error("artifact_byte_count must be a positive integer");
    }
    if (!Number.isSafeInteger(raw.peer_offer_chunk_count) || raw.peer_offer_chunk_count < 1) {
      throw new Error("peer_offer_chunk_count must be a positive integer");
    }
    const peerSource = requireObject(raw.peer_source, "peer_source");
    requireExact(peerSource.source_kind, "known-direct-http-peer-v0", "peer_source.source_kind");
    requireExact(peerSource.transport, "direct-http-piece-server-v0", "peer_source.transport");
    requireExact(
      peerSource.consent_status,
      "publisher-declared-consenting-peer",
      "peer_source.consent_status"
    );
    requireExact(peerSource.project_server_serves_model_bytes, false, "peer_source.project_server_serves_model_bytes");
    requireExact(peerSource.project_server_runs_model_bytes, false, "peer_source.project_server_runs_model_bytes");
    const normalizePeerUrl = options.normalizePeerUrl || defaultNormalizePeerUrl;
    const peerBaseUrl = normalizePeerUrl(peerSource.peer_base_url);

    const proof = requireObject(raw.external_reachability, "external_reachability");
    requireExact(proof.proof_kind, PROOF_KIND, "external_reachability.proof_kind");
    requireExact(proof.proof_version, 1, "external_reachability.proof_version");
    requireExact(
      proof.complete_transfer_verified,
      true,
      "external_reachability.complete_transfer_verified"
    );
    requireExact(proof.transfer_scope, TRANSFER_SCOPE, "external_reachability.transfer_scope");
    requireExact(proof.externally_reachable, true, "external_reachability.externally_reachable");
    requireExact(proof.announcement_eligible, true, "external_reachability.announcement_eligible");
    requireMetadataOnly(proof, "external_reachability");
    const receiptId = requireRouteSafeId(proof.receipt_id, "external_reachability.receipt_id");
    const receiptSha256 = requireSha256(proof.receipt_sha256, "external_reachability.receipt_sha256");
    requireRouteSafeId(proof.observer_id, "external_reachability.observer_id");
    requireRouteSafeId(proof.observer_key_id, "external_reachability.observer_key_id");
    requireSha256(proof.observer_public_key_sha256, "external_reachability.observer_public_key_sha256");
    requireRouteSafeId(proof.fleet_id, "external_reachability.fleet_id");
    const laneId = requireRouteSafeId(proof.lane_id, "external_reachability.lane_id");
    if (requireModelId(proof.model_id, "external_reachability.model_id") !== modelId) {
      throw new Error("external proof model_id does not match announcement");
    }
    if (normalizePeerUrl(proof.public_base_url) !== peerBaseUrl) {
      throw new Error("external proof public_base_url does not match peer_source");
    }
    if (requireSha256(proof.artifact_sha256, "external_reachability.artifact_sha256") !== artifactSha256) {
      throw new Error("external proof artifact_sha256 does not match announcement");
    }
    const pieceSetSha256 = requireSha256(proof.piece_set_sha256, "external_reachability.piece_set_sha256");
    const signaturePayloadSha256 = requireSha256(
      proof.signature_payload_sha256,
      "external_reachability.signature_payload_sha256"
    );
    requireExact(proof.network_scope, NETWORK_SCOPE, "external_reachability.network_scope");
    if (!Number.isSafeInteger(proof.downloaded_piece_count) || proof.downloaded_piece_count < 1) {
      throw new Error("external_reachability.downloaded_piece_count must be a positive integer");
    }
    requireExact(
      proof.downloaded_piece_count,
      raw.peer_offer_chunk_count,
      "external_reachability.downloaded_piece_count"
    );
    requireExact(
      proof.downloaded_artifact_byte_count,
      raw.artifact_byte_count,
      "external_reachability.downloaded_artifact_byte_count"
    );
    if (
      requireSha256(
        proof.downloaded_artifact_sha256,
        "external_reachability.downloaded_artifact_sha256"
      ) !== artifactSha256
    ) {
      throw new Error("external proof downloaded_artifact_sha256 does not match announcement");
    }
    const expectedCheckedRouteCount = 3 + proof.downloaded_piece_count;
    if (!Number.isSafeInteger(expectedCheckedRouteCount)) {
      throw new Error("external_reachability checked route count overflowed");
    }
    requireExact(
      proof.checked_route_count,
      expectedCheckedRouteCount,
      "external_reachability.checked_route_count"
    );
    requireRouteSafeId(
      proof.probe_implementation_version,
      "external_reachability.probe_implementation_version"
    );
    const checked = requireUtcSecond(proof.checked_utc, "external_reachability.checked_utc");
    const expires = requireUtcSecond(proof.expires_utc, "external_reachability.expires_utc");
    const suppliedNow = options.now instanceof Date ? options.now.getTime() : Number(options.now);
    const now = Number.isFinite(suppliedNow) ? suppliedNow : Date.now();
    if (checked.milliseconds > now + CLOCK_SKEW_MS
        || expires.milliseconds <= now
        || expires.milliseconds <= checked.milliseconds
        || expires.milliseconds - checked.milliseconds > MAX_VALIDITY_MS) {
      throw new Error("external proof is stale, expired, or outside the one-hour validity boundary");
    }

    return Object.freeze({
      modelId,
      artifactSha256,
      peerSource: Object.freeze({
        sourceKind: "known-direct-http-peer-v0",
        transport: "direct-http-piece-server-v0",
        peerBaseUrl,
        consentStatus: "publisher-declared-consenting-peer"
      }),
      laneId,
      receiptId,
      receiptSha256,
      pieceSetSha256,
      signaturePayloadSha256,
      downloadedPieceCount: proof.downloaded_piece_count,
      downloadedArtifactByteCount: proof.downloaded_artifact_byte_count,
      checkedUtc: checked.text,
      expiresUtc: expires.text
    });
  }

  const api = Object.freeze({
    CLOCK_SKEW_MS,
    MAX_VALIDITY_MS,
    NETWORK_SCOPE,
    PROOF_KIND,
    TRANSFER_SCOPE,
    validate
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  globalObject.TinyRustLMMiniModelAnnouncement = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
