"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  auditMemoryEndpointsContract,
  contractUrl,
  inspectContract
} = require("../tools/memory-endpoints-contract-audit.js");

function contract(overrides = {}) {
  return {
    ok: true,
    data: {
      schemaVersion: "memoryendpoints.connector_pairing.v1",
      contractRevision: "1.0",
      status: "public_safe_contract",
      generatedAt: "2026-07-15T06:17:51.026572Z",
      issuer: "https://memoryendpoints.com",
      serviceRoot: {
        exact: "https://memoryendpoints.com",
        userinfoAllowed: false,
        queryAllowed: false,
        fragmentAllowed: false
      },
      security: {
        autoWakeAllowed: false,
        wakeUpRequiresExplicitHumanAction: true,
        credentialStorage: "operating_system_credential_vault"
      },
      authorizationUi: {
        explicitUserActivationRequired: true,
        automaticNavigationAllowed: false
      },
      clients: [{
        clientId: "localendpoint-connect",
        registeredRedirectUris: ["localendpoint-connect://memoryendpoints/callback"]
      }],
      endpoints: {
        pairingRequest: "/api/matm/connector-pairings/requests",
        authorizationCodeClaim: "/api/matm/connector-pairings/authorization-code-claims",
        token: "/api/matm/connector-pairings/token"
      },
      operations: {},
      memoryOperations: {
        publicSafeSubmit: { route: "/api/matm/memory-events/submit" },
        search: { route: "/api/matm/search" }
      },
      ...overrides
    }
  };
}

function fixtureFetch(value) {
  return async () => {
    const response = new Response(`${JSON.stringify(value)}\n`, {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
    Object.defineProperty(response, "url", { value: contractUrl });
    return response;
  };
}

test("identifies explicit desktop pairing while blocking invented browser and company routes", () => {
  const inspected = inspectContract(contract());
  assert.equal(inspected.browserOnlyDefaultProtected, true);
  assert.equal(inspected.automaticLocalAppWakeAllowed, false);
  assert.equal(inspected.explicitDesktopPairingAdvertised, true);
  assert.equal(inspected.hostedMemoryRoutesAdvertised, true);
  assert.equal(inspected.browserClientAdvertised, false);
  assert.equal(inspected.singleAgentEnrollmentAdvertised, false);
  assert.equal(inspected.automatedCompanyLifecycleAdvertised, false);
  assert.equal(inspected.compatibleWithRequiredLiveCampaign, false);
  assert.deepEqual(inspected.blockers, [
    "memory_endpoints_browser_client_not_advertised",
    "memory_endpoints_single_agent_enrollment_not_advertised",
    "memory_endpoints_company_lifecycle_not_advertised"
  ]);
});

test("persists an injected contract only as blocked fixture evidence", async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-memory-contract-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const result = await auditMemoryEndpointsContract({
    campaignId: "memory-contract-test-20260715",
    evidenceRoot: root,
    fetchImpl: fixtureFetch(contract())
  });
  assert.equal(result.receipt.status, "blocked");
  assert.equal(result.receipt.evidenceClass, "fixture");
  assert.equal(result.receipt.blockerCode, "memory_endpoints_live_contract_incompatible");
  assert.equal(result.receipt.hardwareEvidence.authorizationUsed, false);
  assert.equal(result.receipt.publicSafeParameters.automaticLocalAppWakeAllowed, false);
  assert.deepEqual(result.receipt.externalEvidenceReferences, [contractUrl]);

  const repeated = await auditMemoryEndpointsContract({
    campaignId: "memory-contract-test-20260715",
    evidenceRoot: root,
    fetchImpl: fixtureFetch(contract())
  });
  assert.equal(repeated.receipt.receiptId, result.receipt.receiptId);
});

test("fails closed if the public contract permits automatic local app wake", () => {
  const changed = contract();
  changed.data.security.autoWakeAllowed = true;
  assert.throws(() => inspectContract(changed), /explicit connector-consent boundary changed/i);
});

test("recognizes required capabilities only when explicitly advertised", () => {
  const advertised = contract({
    clients: [
      {
        clientId: "localendpoint-connect",
        registeredRedirectUris: ["localendpoint-connect://memoryendpoints/callback"]
      },
      {
        clientId: "tinyrustlm-browser",
        registeredRedirectUris: ["https://tinyrustlm.com/memory/callback"]
      }
    ],
    singleAgentEnrollment: { schemaVersion: "memoryendpoints.single_agent.v1" },
    operations: {
      createCompany: { method: "POST" },
      deleteCompany: { method: "POST" }
    }
  });
  const inspected = inspectContract(advertised);
  assert.equal(inspected.browserClientAdvertised, true);
  assert.equal(inspected.singleAgentEnrollmentAdvertised, true);
  assert.equal(inspected.automatedCompanyLifecycleAdvertised, true);
  assert.equal(inspected.compatibleWithRequiredLiveCampaign, true);
  assert.deepEqual(inspected.blockers, []);
});
