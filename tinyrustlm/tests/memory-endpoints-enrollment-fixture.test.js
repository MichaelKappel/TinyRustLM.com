"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { MemoryEndpointsEnrollmentClient } = require("../app/memory-endpoints-enrollment.js");
const {
  createMemoryEndpointsEnrollmentFixture
} = require("../e2e/helpers/memory-endpoints-enrollment-fixture.js");

/** Enroll through the real client against loopback; bind company and server cleanup to the test. */
async function enrolledFixture(t) {
  const service = createMemoryEndpointsEnrollmentFixture();
  await service.listen();
  let company;
  t.after(async () => {
    try {
      if (company) {
        await service.closeCompany(company.companyId);
        await service.deleteCompany(company.companyId);
        assert.equal(service.snapshot().eventCount, 0);
      }
    } finally {
      await service.close();
    }
  });
  company = await service.createCompany("Test-only contract company");
  const invitation = await service.issueInvitation(company.companyId);
  const client = new MemoryEndpointsEnrollmentClient({ baseUrl: service.baseUrl, fetch });
  const agent = await client.claim({
    invitationUrl: invitation.invitationUrl,
    agreedAgentName: "test-only-memory-agent",
    idempotencyKey: "test-only-claim"
  });
  const restored = await client.reconnect(agent);
  return { service, agent, workspaceId: restored.workspaceId };
}

/** Exercise the fixture HTTP boundary using the selected actor, payload and idempotency key. */
async function submit(fixture, body, idempotencyKey = "test-only-submit") {
  const response = await fetch(`${fixture.service.baseUrl}/api/matm/memory-events/submit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${fixture.agent.agentToken}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey
    },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

/** Provide public-safe fixture text in the current submit fields, distinct from search output. */
function payload(fixture) {
  return {
    workspaceId: fixture.workspaceId,
    actorAgentId: fixture.agent.canonicalAgentName,
    summary: "A unique test-only summary marker",
    title: "Fixture memory",
    memoryType: "handoff",
    tinyrustlmMemoryTier: "long_term",
    scope: "project",
    scopeId: "tinyrustlm.com",
    uaiReferences: [".uai/long-term-memory.uai"]
  };
}

test("current actor and summary fields survive submit, idempotency and search", async (t) => {
  const fixture = await enrolledFixture(t);
  const body = payload(fixture);
  const first = await submit(fixture, body);
  assert.equal(first.status, 202);
  assert.equal(first.body.persisted, true);
  const repeated = await submit(fixture, body);
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.canonicalMemoryEventId, first.body.canonicalMemoryEventId);
  assert.equal((await submit(fixture, { ...body, summary: "changed" })).status, 409);
  assert.equal(fixture.service.snapshot().eventCount, 1);

  const query = new URLSearchParams({ workspaceId: fixture.workspaceId, query: "summary marker" });
  const response = await fetch(`${fixture.service.baseUrl}/api/matm/search?${query}`, {
    headers: { Authorization: `Bearer ${fixture.agent.agentToken}` }
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].safeSummary, body.summary);
  assert.equal(result.items[0].tinyrustlmMemoryTier, "long_term");
});

for (const [name, mutate] of [
  ["retired agentId field", (body) => { body.agentId = body.actorAgentId; delete body.actorAgentId; }],
  ["retired alias alongside current actor", (body) => { body.agentId = body.actorAgentId; }],
  ["another actor", (body) => { body.actorAgentId = "another-agent"; }],
  ["another workspace", (body) => { body.workspaceId = "another-workspace"; }]
]) {
  test(`rejects ${name} before storing an event`, async (t) => {
    const fixture = await enrolledFixture(t);
    const body = payload(fixture);
    mutate(body);
    const rejected = await submit(fixture, body);
    assert.equal(rejected.status, 401);
    assert.equal(rejected.body.error.code, "agent_authentication_failed");
    assert.equal(fixture.service.snapshot().eventCount, 0);
  });
}
