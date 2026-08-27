"use strict";

const http = require("node:http");

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_WORKSPACE_ID = "fixture-workspace-id";
const DEFAULT_WORKSPACE_KEY = "fixture-workspace-key";
const MAX_BODY_BYTES = 64 * 1024;
const RELAY_PREFIX = "/api/memoryendpoints";
const MEMORY_EVENT_KEYS = new Set([
  "workspaceId", "actorAgentId", "kind", "version", "scope", "scopeId", "memoryType",
  "subject", "title", "summary", "source", "confidence", "uaiReferences", "tags",
  "tinyrustlmMemoryTier", "sourceSha256",
]);

function hasOnlyOwnKeys(value, allowed) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).every((key) => allowed.has(key));
}

function parsePort(value) {
  const port = Number.parseInt(String(value || ""), 10);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("Usage: node memory-endpoints-relay-fixture-server.js <port>");
  }
  return port;
}

function responseHeaders(contentType = "application/json; charset=utf-8") {
  return {
    "Access-Control-Allow-Headers": "Authorization, X-MemoryEndpoints-Key, Content-Type, Idempotency-Key",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
    "Content-Type": contentType,
  };
}

function sendJson(response, statusCode, payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  response.writeHead(statusCode, {
    ...responseHeaders(),
    "Content-Length": body.length,
  });
  response.end(body);
}

function sendEmpty(response, statusCode) {
  response.writeHead(statusCode, responseHeaders("text/plain; charset=utf-8"));
  response.end();
}

function hasFixtureAuthorization(request, workspaceKey) {
  const bearer = request.headers.authorization === `Bearer ${workspaceKey}`;
  const alternate = request.headers["x-memoryendpoints-key"] === workspaceKey;
  return bearer || alternate;
}

async function readJsonBody(request) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_BODY_BYTES) {
      const error = new Error("request body exceeds fixture limit");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("request body is not valid JSON");
    error.statusCode = 400;
    throw error;
  }
}

function createFixtureServer({ workspaceId, workspaceKey }) {
  const memories = [];

  return http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || "/", `http://${DEFAULT_HOST}`);
      const path = requestUrl.pathname;

      if (path === "/health" && request.method === "GET") {
        sendJson(response, 200, { status: "ready" });
        return;
      }

      if (request.method === "OPTIONS" && path.startsWith(`${RELAY_PREFIX}/api/matm/`)) {
        sendEmpty(response, 204);
        return;
      }

      if (path === `${RELAY_PREFIX}/models/probe.slm`) {
        sendJson(response, 404, { error: "route rejected" });
        return;
      }

      if (!path.startsWith(`${RELAY_PREFIX}/api/matm/`)) {
        sendJson(response, 404, { error: "route rejected" });
        return;
      }

      if (!hasFixtureAuthorization(request, workspaceKey)) {
        sendJson(response, 401, { error: "unauthorized" });
        return;
      }

      if (path === `${RELAY_PREFIX}/api/matm/agents/register` && request.method === "POST") {
        const payload = await readJsonBody(request);
        if (payload.workspaceId !== workspaceId || typeof payload.agentId !== "string") {
          sendJson(response, 400, { error: "invalid registration" });
          return;
        }
        sendJson(response, 200, { workspaceId, agentId: payload.agentId, registered: true });
        return;
      }

      if (path === `${RELAY_PREFIX}/api/matm/memory-events/submit` && request.method === "POST") {
        const payload = await readJsonBody(request);
        if (
          !hasOnlyOwnKeys(payload, MEMORY_EVENT_KEYS) ||
          payload.workspaceId !== workspaceId ||
          typeof payload.actorAgentId !== "string" ||
          payload.kind !== "tinyrustlm.memory_endpoints.memory_record.v1" ||
          payload.version !== 1 ||
          payload.scope !== "project" ||
          payload.scopeId !== "tinyrustlm.com" ||
          !["status", "handoff"].includes(payload.memoryType) ||
          typeof payload.summary !== "string"
        ) {
          sendJson(response, 400, { error: "invalid memory event" });
          return;
        }
        const item = { ...payload, id: `fixture-memory-${memories.length + 1}` };
        memories.push(item);
        sendJson(response, 201, { item });
        return;
      }

      if (path === `${RELAY_PREFIX}/api/matm/search` && request.method === "GET") {
        const requestedWorkspaceId = requestUrl.searchParams.get("workspaceId");
        const memoryType = requestUrl.searchParams.get("memory_type");
        const query = requestUrl.searchParams.get("query") || "";
        if (requestedWorkspaceId !== workspaceId || !["status", "handoff"].includes(memoryType)) {
          sendJson(response, 400, { error: "invalid search" });
          return;
        }
        const items = memories.filter(
          (item) => item.memoryType === memoryType && JSON.stringify(item).includes(query),
        );
        sendJson(response, 200, { items });
        return;
      }

      sendJson(response, 405, { error: "method not allowed" });
    } catch (error) {
      sendJson(response, Number(error.statusCode) || 500, { error: String(error.message || error) });
    }
  });
}

const port = parsePort(process.argv[2]);
const workspaceId = process.env.MEMORYENDPOINTS_FIXTURE_WORKSPACE_ID || DEFAULT_WORKSPACE_ID;
const workspaceKey = process.env.MEMORYENDPOINTS_FIXTURE_WORKSPACE_KEY || DEFAULT_WORKSPACE_KEY;
const server = createFixtureServer({ workspaceId, workspaceKey });

server.listen(port, DEFAULT_HOST, () => {
  process.stdout.write(`TinyRustLM MemoryEndpoints relay fixture ready at http://${DEFAULT_HOST}:${port}\n`);
});

function closeServer() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", closeServer);
process.on("SIGTERM", closeServer);
