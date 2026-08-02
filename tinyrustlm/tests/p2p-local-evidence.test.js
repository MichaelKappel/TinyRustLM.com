"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { CampaignEvidenceStore } = require("../tools/campaign-evidence-store.js");
const {
  validateLocalFleetAudit,
  writeLocalFleetEvidence
} = require("../tools/p2p-local-evidence.js");

const hash = (character) => character.repeat(64);

function auditInput(overrides = {}) {
  return {
    schema: "tinyrustlm.local_two_lane_p2p_audit.v1",
    observed_utc: "2026-07-15T06:00:21.3581039Z",
    status: "pass-local-only",
    evidence_class: "local",
    public_reachability_proven: false,
    announcement_eligible: false,
    model_count: 1,
    lane_count: 2,
    distinct_started_process_count: 2,
    listener_process_count: 2,
    listeners: [
      { LocalAddress: "127.0.0.1", LocalPort: 18571, OwningProcess: 101 },
      { LocalAddress: "127.0.0.1", LocalPort: 18572, OwningProcess: 202 }
    ],
    graceful_stop_count: 2,
    probe: {
      enabled_endpoint_count: 2,
      reachable_endpoint_count: 2,
      all_enabled_endpoints_reachable: true,
      externally_reachable: false,
      announcement_eligible: false,
      endpoints: [
        {
          lane_id: "seed-a",
          model_id: "tinyrustlm/model-a",
          public_base_url: "http://127.0.0.1:18571/models/a/",
          local_status_url: "http://127.0.0.1:18571/models/a/status.json",
          locally_reachable: true,
          externally_reachable: false,
          announcement_eligible: false
        },
        {
          lane_id: "seed-b",
          model_id: "tinyrustlm/model-a",
          public_base_url: "http://127.0.0.1:18572/models/a/",
          local_status_url: "http://127.0.0.1:18572/models/a/status.json",
          locally_reachable: true,
          externally_reachable: false,
          announcement_eligible: false
        }
      ]
    },
    hashes: {
      fleet_config: hash("a"),
      tool: hash("b"),
      minimodel: hash("c"),
      serve_stdout: hash("d"),
      probe_stdout: hash("e"),
      listener_evidence: hash("f")
    },
    blockers: [
      "outside_network_observer_absent",
      "public_endpoint_configuration_absent",
      "catalog_publication_authority_absent",
      "nineteen_additional_qualified_models_absent"
    ],
    ...overrides
  };
}

test("persists a local-only two-process receipt without public counters", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-p2p-local-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const auditPath = path.join(root, "audit.json");
  const evidenceRoot = path.join(root, "evidence");
  fs.writeFileSync(auditPath, `${JSON.stringify(auditInput())}\n`);

  const receipt = writeLocalFleetEvidence({
    auditPath,
    evidenceRoot,
    campaignId: "tinyrustlm-dogfood-quality-20260714",
    sourceRevision: hash("1")
  });

  assert.equal(receipt.evidenceClass, "local");
  assert.equal(receipt.status, "pass");
  assert.equal(receipt.publicSafeParameters.independentProcessCount, 2);
  assert.equal(receipt.publicSafeParameters.localReachableEndpointCount, 2);
  assert.equal(receipt.publicSafeParameters.externallyProvenLaneCount, 0);
  assert.equal(receipt.publicSafeParameters.announcementEligibleModelCount, 0);
  assert.equal(receipt.hardwareEvidence.outsideNetworkObserver, false);
  assert.deepEqual(new CampaignEvidenceStore(evidenceRoot).rebuild().receipts, [receipt]);

  const repeated = writeLocalFleetEvidence({
    auditPath,
    evidenceRoot,
    campaignId: "tinyrustlm-dogfood-quality-20260714",
    sourceRevision: hash("1")
  });
  assert.equal(repeated.receiptId, receipt.receiptId);
});

test("rejects any local audit that claims public reachability", () => {
  assert.throws(() => validateLocalFleetAudit(auditInput({
    public_reachability_proven: true
  })), /never claim public reachability/i);
  assert.throws(() => validateLocalFleetAudit(auditInput({
    probe: { ...auditInput().probe, externally_reachable: true }
  })), /external-proof boundary/i);
});

test("rejects a single listener owner masquerading as two lanes", () => {
  const audit = auditInput();
  audit.listeners[1].OwningProcess = audit.listeners[0].OwningProcess;
  assert.throws(() => validateLocalFleetAudit(audit), /independent ports and process owners/i);
});

test("rejects non-loopback and credential-bearing endpoint URLs", () => {
  const publicEndpoint = auditInput();
  publicEndpoint.probe.endpoints[0].public_base_url = "https://seed.example.test/models/a/";
  assert.throws(() => validateLocalFleetAudit(publicEndpoint), /IPv4 loopback/i);

  const credentialEndpoint = auditInput();
  credentialEndpoint.probe.endpoints[0].local_status_url =
    "http://user:secret@127.0.0.1:18571/models/a/status.json";
  assert.throws(() => validateLocalFleetAudit(credentialEndpoint), /IPv4 loopback/i);
});

test("rejects local evidence without explicit external blockers", () => {
  assert.throws(() => validateLocalFleetAudit(auditInput({
    blockers: ["outside_network_observer_absent"]
  })), /missing blocker public_endpoint_configuration_absent/i);
});
