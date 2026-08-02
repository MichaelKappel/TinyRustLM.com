"use strict";

const crypto = require("node:crypto");
const http = require("node:http");

const routes = Object.freeze({
  createCompany: "/api/matm/test/companies/create",
  issueInvitation: "/api/matm/test/enrollment/issue",
  claimInvitation: "/api/matm/test/enrollment/claim",
  reconnect: "/api/matm/test/enrollment/reconnect",
  closeCompany: "/api/matm/test/companies/close",
  deleteCompany: "/api/matm/test/companies/delete"
});

function randomId(prefix) {
  return `${prefix}-${crypto.randomBytes(12).toString("hex")}`;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function responseHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Idempotency-Key",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8"
  };
}

function writeJson(response, status, body) {
  response.writeHead(status, responseHeaders());
  response.end(JSON.stringify(body));
}

function safeFailure(code, status = 409) {
  return {
    status,
    body: {
      ok: false,
      safeNoOp: true,
      valuesRedacted: true,
      rawCredentialExposed: false,
      rawPayloadExposed: false,
      error: { code, safeNoOp: true, valuesRedacted: true }
    }
  };
}

async function readJson(request) {
  const chunks = [];
  let byteCount = 0;
  for await (const chunk of request) {
    byteCount += chunk.length;
    if (byteCount > 256 * 1024) {
      throw new Error("request_too_large");
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function bearerToken(request) {
  const match = /^Bearer\s+(.+)$/i.exec(String(request.headers.authorization || ""));
  return match ? match[1] : "";
}

function connectorContract() {
  return {
    data: {
      singleAgentEnrollment: {
        schemaVersion: "memoryendpoints.single_agent_enrollment_contract.v1",
        status: "live",
        singleUseUrl: true,
        postClaimOnly: true,
        atomicOneWinner: true,
        lostResponseIdempotentRecovery: true,
        agentScopedToken: true,
        workspaceHiddenOnReconnect: true,
        virtualUaiStartupRestore: true,
        shortTermRestore: true,
        longTermRestore: true,
        routes
      }
    },
    valuesRedacted: true,
    rawCredentialExposed: false,
    rawPayloadExposed: false
  };
}

function createMemoryEndpointsEnrollmentFixture() {
  const ownerToken = `fixture_owner_${crypto.randomBytes(32).toString("base64url")}`;
  const companies = new Map();
  const invitations = new Map();
  const agentsByTokenHash = new Map();
  const agentsByName = new Map();
  const claimIdempotency = new Map();
  const eventIdempotency = new Map();
  const eventsByWorkspace = new Map();
  const audit = [];
  let server = null;
  let baseUrl = "";
  let nextSequence = 1;

  function ownerAuthorized(request) {
    return bearerToken(request) === ownerToken;
  }

  function agentForRequest(request) {
    return agentsByTokenHash.get(sha256(bearerToken(request))) || null;
  }

  function companyForBody(body) {
    return companies.get(String(body.companyId || "")) || null;
  }

  function activeCompany(companyId) {
    const company = companies.get(companyId);
    return company && company.status === "active" ? company : null;
  }

  async function routeRequest(request, response) {
    const url = new URL(request.url, "http://fixture.invalid");
    if (request.method === "OPTIONS") {
      response.writeHead(204, responseHeaders());
      response.end();
      return;
    }
    if (url.pathname === "/api/matm/connector-contract" && request.method === "GET") {
      writeJson(response, 200, connectorContract());
      return;
    }

    const body = request.method === "POST" ? await readJson(request) : {};

    if (url.pathname === routes.createCompany && request.method === "POST") {
      if (!ownerAuthorized(request)) {
        const failure = safeFailure("owner_auth_required", 401);
        writeJson(response, failure.status, failure.body);
        return;
      }
      const companyId = randomId("company");
      const workspaceId = randomId("workspace");
      companies.set(companyId, {
        companyId,
        workspaceId,
        displayName: String(body.displayName || "TinyRustLM dogfood company").slice(0, 128),
        status: "active"
      });
      eventsByWorkspace.set(workspaceId, []);
      audit.push({ operation: "company_created", companyId });
      writeJson(response, 201, {
        ok: true,
        persisted: true,
        companyId,
        workspaceId,
        valuesRedacted: true,
        rawCredentialExposed: false,
        rawPayloadExposed: false
      });
      return;
    }

    if (url.pathname === routes.issueInvitation && request.method === "POST") {
      if (!ownerAuthorized(request)) {
        const failure = safeFailure("owner_auth_required", 401);
        writeJson(response, failure.status, failure.body);
        return;
      }
      const company = companyForBody(body);
      if (!company || company.status !== "active") {
        const failure = safeFailure("company_not_active", 409);
        writeJson(response, failure.status, failure.body);
        return;
      }
      const invitationSecret = crypto.randomBytes(32).toString("base64url");
      const invitationUrl = `${baseUrl}/enroll/${invitationSecret}`;
      invitations.set(sha256(invitationUrl), {
        companyId: company.companyId,
        consumed: false
      });
      audit.push({ operation: "invitation_issued", companyId: company.companyId });
      writeJson(response, 201, {
        ok: true,
        persisted: true,
        invitationUrl,
        singleUse: true,
        valuesRedacted: true,
        rawCredentialExposed: false,
        rawPayloadExposed: false
      });
      return;
    }

    if (url.pathname === routes.claimInvitation && request.method === "POST") {
      const idempotencyKey = String(request.headers["idempotency-key"] || "");
      const requestHash = sha256(JSON.stringify(body));
      const prior = claimIdempotency.get(idempotencyKey);
      if (prior) {
        if (prior.requestHash !== requestHash) {
          const failure = safeFailure("idempotency_conflict", 409);
          writeJson(response, failure.status, failure.body);
          return;
        }
        writeJson(response, 201, prior.response);
        return;
      }
      const invitation = invitations.get(sha256(String(body.invitationUrl || "")));
      if (!invitation || invitation.consumed || !activeCompany(invitation.companyId)) {
        const failure = safeFailure("enrollment_url_consumed", 410);
        writeJson(response, failure.status, failure.body);
        return;
      }
      const requestedName = String(body.agreedAgentName || "");
      if (!/^[A-Za-z0-9._-]{1,96}$/.test(requestedName)) {
        const failure = safeFailure("invalid_agent_name", 400);
        writeJson(response, failure.status, failure.body);
        return;
      }
      const company = companies.get(invitation.companyId);
      const scopedName = `${company.companyId}:${requestedName}`;
      if (agentsByName.has(scopedName)) {
        const failure = safeFailure("agent_name_unavailable", 409);
        writeJson(response, failure.status, failure.body);
        return;
      }
      const agentToken = `agent_${crypto.randomBytes(32).toString("base64url")}`;
      const agent = {
        canonicalAgentName: requestedName,
        companyId: company.companyId,
        workspaceId: company.workspaceId,
        tokenHash: sha256(agentToken)
      };
      agentsByName.set(scopedName, agent);
      agentsByTokenHash.set(agent.tokenHash, agent);
      invitation.consumed = true;
      const claimResponse = {
        ok: true,
        persisted: true,
        urlConsumed: true,
        canonicalAgentName: requestedName,
        agentToken,
        claimReceiptId: randomId("claim"),
        valuesRedacted: true,
        rawCredentialExposed: false,
        rawPayloadExposed: false
      };
      claimIdempotency.set(idempotencyKey, { requestHash, response: claimResponse });
      audit.push({ operation: "invitation_claimed", companyId: company.companyId, agentName: requestedName });
      writeJson(response, 201, claimResponse);
      return;
    }

    if (url.pathname === routes.reconnect && request.method === "POST") {
      const agent = agentForRequest(request);
      const company = agent ? activeCompany(agent.companyId) : null;
      if (!agent || !company || body.agentName !== agent.canonicalAgentName) {
        const failure = safeFailure("agent_authentication_failed", 401);
        writeJson(response, failure.status, failure.body);
        return;
      }
      writeJson(response, 200, {
        ok: true,
        canonicalAgentName: agent.canonicalAgentName,
        workspaceId: agent.workspaceId,
        readyForStartup: true,
        shortTermRestored: true,
        longTermRestored: true,
        valuesRedacted: true,
        rawCredentialExposed: false,
        rawPayloadExposed: false
      });
      return;
    }

    if (url.pathname === "/api/matm/memory-events" && request.method === "GET") {
      const agent = agentForRequest(request);
      if (!agent || !activeCompany(agent.companyId) || url.searchParams.get("workspaceId") !== agent.workspaceId) {
        const failure = safeFailure("agent_authentication_failed", 401);
        writeJson(response, failure.status, failure.body);
        return;
      }
      const events = eventsByWorkspace.get(agent.workspaceId) || [];
      writeJson(response, 200, {
        ok: true,
        count: events.length,
        items: events.map((event) => ({
          eventId: event.eventId,
          bodyHash: event.bodyHash,
          createdAt: event.createdAt,
          revision: event.revision,
          status: "active",
          memoryType: event.payload.memoryType,
          scope: event.payload.scope,
          scopeId: event.payload.scopeId,
          actorAgentId: event.payload.actorAgentId
        })),
        valuesRedacted: true,
        rawCredentialExposed: false,
        rawPayloadExposed: false
      });
      return;
    }

    if (url.pathname === "/api/matm/memory-events/submit" && request.method === "POST") {
      const agent = agentForRequest(request);
      if (!agent || !activeCompany(agent.companyId) || body.workspaceId !== agent.workspaceId ||
          body.agentId !== agent.canonicalAgentName) {
        const failure = safeFailure("agent_authentication_failed", 401);
        writeJson(response, failure.status, failure.body);
        return;
      }
      const idempotencyKey = String(request.headers["idempotency-key"] || "");
      const requestHash = sha256(JSON.stringify(body));
      const prior = eventIdempotency.get(idempotencyKey);
      if (prior) {
        if (prior.requestHash !== requestHash) {
          const failure = safeFailure("idempotency_conflict", 409);
          writeJson(response, failure.status, failure.body);
          return;
        }
        writeJson(response, 200, prior.response);
        return;
      }
      const sequence = nextSequence++;
      const eventId = `memory-${String(sequence).padStart(8, "0")}`;
      const event = {
        eventId,
        revisionId: `revision-${String(sequence).padStart(8, "0")}`,
        revision: 1,
        serverSequence: sequence,
        bodyHash: requestHash,
        createdAt: new Date().toISOString(),
        payload: JSON.parse(JSON.stringify(body))
      };
      eventsByWorkspace.get(agent.workspaceId).push(event);
      const submitResponse = {
        ok: true,
        persisted: true,
        canonicalMemoryEventId: eventId,
        revisionId: event.revisionId,
        receiptId: `receipt-${String(sequence).padStart(8, "0")}`,
        serverSequence: sequence,
        valuesRedacted: true,
        rawCredentialExposed: false,
        rawPayloadExposed: false
      };
      eventIdempotency.set(idempotencyKey, { requestHash, response: submitResponse });
      audit.push({ operation: "memory_persisted", companyId: agent.companyId, tier: body.tinyrustlmMemoryTier });
      writeJson(response, 202, submitResponse);
      return;
    }

    if (url.pathname === "/api/matm/search" && request.method === "GET") {
      const agent = agentForRequest(request);
      if (!agent || !activeCompany(agent.companyId) || url.searchParams.get("workspaceId") !== agent.workspaceId) {
        const failure = safeFailure("agent_authentication_failed", 401);
        writeJson(response, failure.status, failure.body);
        return;
      }
      const query = String(url.searchParams.get("query") || "").toLowerCase();
      const memoryType = String(url.searchParams.get("memory_type") || "");
      const items = (eventsByWorkspace.get(agent.workspaceId) || [])
        .filter((event) => !memoryType || event.payload.memoryType === memoryType)
        .filter((event) => !query || event.payload.safeSummary.toLowerCase().includes(query) ||
          event.payload.title.toLowerCase().includes(query))
        .map((event) => ({
          memoryId: event.eventId,
          revisionId: event.revisionId,
          title: event.payload.title,
          safeSummary: event.payload.safeSummary,
          scope: event.payload.scope,
          scopeId: event.payload.scopeId,
          memoryType: event.payload.memoryType,
          tinyrustlmMemoryTier: event.payload.tinyrustlmMemoryTier,
          uaiReferences: event.payload.uaiReferences,
          score: 1,
          serverSequence: event.serverSequence,
          createdAtUnixMs: Date.parse(event.createdAt),
          bodyHash: event.bodyHash,
          status: "active",
          reviewed: true,
          reviewStatus: "promoted",
          publicSafe: true,
          valuesRedacted: true,
          rawCredentialExposed: false,
          rawPayloadExposed: false
        }));
      writeJson(response, 200, {
        ok: true,
        count: items.length,
        items,
        valuesRedacted: true,
        rawCredentialExposed: false,
        rawPayloadExposed: false
      });
      return;
    }

    if (url.pathname === routes.closeCompany && request.method === "POST") {
      if (!ownerAuthorized(request)) {
        const failure = safeFailure("owner_auth_required", 401);
        writeJson(response, failure.status, failure.body);
        return;
      }
      const company = companyForBody(body);
      if (!company) {
        const failure = safeFailure("company_not_found", 404);
        writeJson(response, failure.status, failure.body);
        return;
      }
      company.status = "closed";
      audit.push({ operation: "company_closed", companyId: company.companyId });
      writeJson(response, 200, {
        ok: true,
        persisted: true,
        companyId: company.companyId,
        status: "closed",
        valuesRedacted: true,
        rawCredentialExposed: false,
        rawPayloadExposed: false
      });
      return;
    }

    if (url.pathname === routes.deleteCompany && request.method === "POST") {
      if (!ownerAuthorized(request)) {
        const failure = safeFailure("owner_auth_required", 401);
        writeJson(response, failure.status, failure.body);
        return;
      }
      const company = companyForBody(body);
      if (!company || company.status !== "closed") {
        const failure = safeFailure("company_must_be_closed", 409);
        writeJson(response, failure.status, failure.body);
        return;
      }
      companies.delete(company.companyId);
      eventsByWorkspace.delete(company.workspaceId);
      for (const [key, agent] of agentsByTokenHash) {
        if (agent.companyId === company.companyId) agentsByTokenHash.delete(key);
      }
      for (const [key, agent] of agentsByName) {
        if (agent.companyId === company.companyId) agentsByName.delete(key);
      }
      for (const [key, invitation] of invitations) {
        if (invitation.companyId === company.companyId) invitations.delete(key);
      }
      audit.push({ operation: "company_deleted", companyId: company.companyId });
      writeJson(response, 200, {
        ok: true,
        persisted: true,
        companyId: company.companyId,
        deleted: true,
        valuesRedacted: true,
        rawCredentialExposed: false,
        rawPayloadExposed: false
      });
      return;
    }

    const failure = safeFailure("route_not_found", 404);
    writeJson(response, failure.status, failure.body);
  }

  async function ownerPost(route, payload) {
    const response = await fetch(`${baseUrl}${route}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": randomId("owner")
      },
      body: JSON.stringify(payload)
    });
    const value = await response.json();
    if (!response.ok) throw new Error(`Fixture owner operation failed with HTTP ${response.status}`);
    return value;
  }

  return {
    routes,
    async listen() {
      server = http.createServer((request, response) => {
        routeRequest(request, response).catch(() => {
          const failure = safeFailure("fixture_internal_error", 500);
          writeJson(response, failure.status, failure.body);
        });
      });
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      const address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
      return baseUrl;
    },
    get baseUrl() {
      return baseUrl;
    },
    createCompany(displayName) {
      return ownerPost(routes.createCompany, { displayName });
    },
    issueInvitation(companyId) {
      return ownerPost(routes.issueInvitation, { companyId });
    },
    closeCompany(companyId) {
      return ownerPost(routes.closeCompany, { companyId });
    },
    deleteCompany(companyId) {
      return ownerPost(routes.deleteCompany, { companyId });
    },
    snapshot() {
      return {
        companyCount: companies.size,
        invitationCount: invitations.size,
        agentCount: agentsByTokenHash.size,
        eventCount: Array.from(eventsByWorkspace.values()).reduce((sum, events) => sum + events.length, 0),
        audit: audit.map((entry) => ({ ...entry })),
        rawCredentialStoredInAudit: /fixture_owner_|agent_|\/enroll\//.test(JSON.stringify(audit))
      };
    },
    async close() {
      if (server) {
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      }
    }
  };
}

module.exports = Object.freeze({ createMemoryEndpointsEnrollmentFixture });
