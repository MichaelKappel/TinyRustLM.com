"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const announcement = require("../app/minimodel-announcement.js");

const SHA_A = `sha256:${"a".repeat(64)}`;
const SHA_B = `sha256:${"b".repeat(64)}`;
const SHA_C = `sha256:${"c".repeat(64)}`;
const SHA_D = `sha256:${"d".repeat(64)}`;
const NOW = new Date("2026-07-13T00:10:00Z");

function validAnnouncement() {
  return {
    announcement_kind: "minimodel.peer_source_announcement",
    announcement_version: 1,
    announcement_status: "peer-source-externally-verified-metadata-only",
    model_id: "tinyrustlm/qwen2.5-1.5b-q4",
    artifact_kind: "slm",
    artifact_byte_count: 969648576,
    artifact_sha256: SHA_A,
    peer_offer_route: "qwen.peer-offer",
    peer_offer_sha256: SHA_B,
    peer_offer_merkle_root_sha256: SHA_C,
    peer_offer_chunk_count: 925,
    catalog_entry_sha256: SHA_D,
    project_server_serves_model_bytes: false,
    project_server_runs_model_bytes: false,
    project_server_proxies_model_bytes: false,
    peer_source: {
      source_kind: "known-direct-http-peer-v0",
      transport: "direct-http-piece-server-v0",
      peer_base_url: "http://peer.example:8123/qwen",
      consent_status: "publisher-declared-consenting-peer",
      project_server_serves_model_bytes: false,
      project_server_runs_model_bytes: false
    },
    external_reachability: {
      proof_kind: announcement.PROOF_KIND,
      proof_version: 1,
      complete_transfer_verified: true,
      transfer_scope: announcement.TRANSFER_SCOPE,
      receipt_id: "receipt-seed-a",
      receipt_sha256: SHA_A,
      observer_id: "outside-observer",
      observer_key_id: "outside-observer-key",
      observer_public_key_sha256: SHA_B,
      fleet_id: "primary-seed-fleet",
      lane_id: "seed-a",
      model_id: "tinyrustlm/qwen2.5-1.5b-q4",
      public_base_url: "http://peer.example:8123/qwen/",
      artifact_sha256: SHA_A,
      piece_set_sha256: SHA_C,
      checked_utc: "2026-07-13T00:00:00Z",
      expires_utc: "2026-07-13T00:30:00Z",
      downloaded_piece_count: 925,
      downloaded_artifact_byte_count: 969648576,
      downloaded_artifact_sha256: SHA_A,
      checked_route_count: 928,
      probe_implementation_version: "observer-v1",
      network_scope: announcement.NETWORK_SCOPE,
      signature_payload_sha256: SHA_D,
      externally_reachable: true,
      announcement_eligible: true,
      project_server_serves_model_bytes: false,
      project_server_runs_model_bytes: false,
      project_server_proxies_model_bytes: false
    }
  };
}

test("TinyRustLM routes catalog peers through the external-proof verifier", () => {
  const appSource = fs.readFileSync(path.join(__dirname, "..", "app", "app.js"), "utf8");

  assert.match(appSource, /TinyRustLMMiniModelAnnouncement/);
  assert.match(appSource, /verifier\.validate\(raw, \{ normalizePeerUrl: normalizedPeerBaseUrl \}\)/);
  assert.match(appSource, /peerSources: \[\],\s+peerProofs: \[\],\s+unprovenPeerClaimCount:/);
  assert.doesNotMatch(appSource, /announcement_version\) !== 0/);
  assert.doesNotMatch(appSource, /peer-source-available-metadata-only/);
});

test("accepts one current Rust proof-gated direct peer announcement", () => {
  const result = announcement.validate(validAnnouncement(), { now: NOW });

  assert.equal(result.modelId, "tinyrustlm/qwen2.5-1.5b-q4");
  assert.equal(result.peerSource.peerBaseUrl, "http://peer.example:8123/qwen/");
  assert.equal(result.laneId, "seed-a");
  assert.equal(result.expiresUtc, "2026-07-13T00:30:00Z");
  assert.equal(Object.prototype.hasOwnProperty.call(result, "raw"), false);
});

test("rejects sampled or metadata-only availability", () => {
  const value = validAnnouncement();
  value.announcement_version = 0;
  value.announcement_status = "peer-source-available-metadata-only";
  delete value.external_reachability;

  assert.throws(() => announcement.validate(value, { now: NOW }), /must be 1 with external proof/);
});

test("rejects sampled proof and incomplete transfer evidence", () => {
  const sampled = validAnnouncement();
  sampled.external_reachability.proof_version = 0;
  sampled.external_reachability.complete_transfer_verified = false;
  delete sampled.external_reachability.transfer_scope;
  delete sampled.external_reachability.downloaded_piece_count;
  delete sampled.external_reachability.downloaded_artifact_byte_count;
  delete sampled.external_reachability.downloaded_artifact_sha256;
  sampled.external_reachability.checked_route_count = 4;

  assert.throws(
    () => announcement.validate(sampled, { now: NOW }),
    /proof_version must be 1/
  );

  const incomplete = validAnnouncement();
  incomplete.external_reachability.downloaded_piece_count = 924;
  assert.throws(
    () => announcement.validate(incomplete, { now: NOW }),
    /downloaded_piece_count must be 925/
  );
});

test("rejects stale and overlong external receipts", () => {
  const stale = validAnnouncement();
  stale.external_reachability.expires_utc = "2026-07-13T00:09:59Z";
  const overlong = validAnnouncement();
  overlong.external_reachability.expires_utc = "2026-07-13T01:00:01Z";

  assert.throws(() => announcement.validate(stale, { now: NOW }), /stale, expired/);
  assert.throws(() => announcement.validate(overlong, { now: NOW }), /one-hour validity/);
});

test("rejects identity drift between proof and announcement", () => {
  const urlDrift = validAnnouncement();
  urlDrift.external_reachability.public_base_url = "http://other.example:8123/qwen/";
  const hashDrift = validAnnouncement();
  hashDrift.external_reachability.artifact_sha256 = SHA_B;

  assert.throws(() => announcement.validate(urlDrift, { now: NOW }), /public_base_url does not match/);
  assert.throws(() => announcement.validate(hashDrift, { now: NOW }), /artifact_sha256 does not match/);
});

test("rejects downloaded artifact and checked-route drift", () => {
  const byteDrift = validAnnouncement();
  byteDrift.external_reachability.downloaded_artifact_byte_count -= 1;
  const hashDrift = validAnnouncement();
  hashDrift.external_reachability.downloaded_artifact_sha256 = SHA_B;
  const routeDrift = validAnnouncement();
  routeDrift.external_reachability.checked_route_count -= 1;

  assert.throws(() => announcement.validate(byteDrift, { now: NOW }), /downloaded_artifact_byte_count must be/);
  assert.throws(() => announcement.validate(hashDrift, { now: NOW }), /downloaded_artifact_sha256 does not match/);
  assert.throws(() => announcement.validate(routeDrift, { now: NOW }), /checked_route_count must be 928/);
});

test("rejects project-hosted bytes and incomplete metadata-only flags", () => {
  const projectHost = validAnnouncement();
  projectHost.peer_source.peer_base_url = "http://minimodel.org/models/qwen/";
  projectHost.external_reachability.public_base_url = "http://minimodel.org/models/qwen/";
  const missingFlag = validAnnouncement();
  delete missingFlag.external_reachability.project_server_proxies_model_bytes;

  assert.throws(() => announcement.validate(projectHost, { now: NOW }), /cannot serve peer model bytes/);
  assert.throws(() => announcement.validate(missingFlag, { now: NOW }), /must be false/);
});
