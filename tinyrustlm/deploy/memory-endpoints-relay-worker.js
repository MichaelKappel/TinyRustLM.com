const DEFAULT_MEMORY_ENDPOINTS_BASE_URL = "https://memoryendpoints.com";
const RELAY_PREFIX = "/api/memoryendpoints";
const MATM_PREFIX = "/api/matm/";
const MAX_REQUEST_BYTES = 256 * 1024;

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function normalizedUpstreamBase(env) {
  const configured = env && typeof env.MEMORYENDPOINTS_BASE_URL === "string"
    ? env.MEMORYENDPOINTS_BASE_URL.trim()
    : "";
  const raw = configured || DEFAULT_MEMORY_ENDPOINTS_BASE_URL;
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("invalid upstream MemoryEndpoints base URL");
  }
  url.pathname = url.pathname.replace(/\/+$/g, "");
  return url;
}

function appendUpstreamPath(upstream, matmPath) {
  const basePath = upstream.pathname === "/" ? "" : upstream.pathname.replace(/\/+$/g, "");
  upstream.pathname = `${basePath}${matmPath}`;
  return upstream;
}

function relayTargetUrl(requestUrl, env) {
  const source = new URL(requestUrl);
  if (!source.pathname.startsWith(`${RELAY_PREFIX}${MATM_PREFIX}`)) {
    return null;
  }
  if (source.pathname.includes("..") || source.pathname.includes("\\") || source.pathname.includes("/models/")) {
    return null;
  }
  const upstream = normalizedUpstreamBase(env);
  appendUpstreamPath(upstream, source.pathname.slice(RELAY_PREFIX.length));
  upstream.search = source.search;
  return upstream;
}

function hasWorkspaceKey(request) {
  const authorization = request.headers.get("authorization") || "";
  const workspaceKey = request.headers.get("x-memoryendpoints-key") || "";
  return /^Bearer\s+\S{8,}$/i.test(authorization) || workspaceKey.trim().length >= 8;
}

function requestByteLength(request) {
  const contentLength = request.headers.get("content-length");
  if (!contentLength) {
    return 0;
  }
  const parsed = Number(contentLength);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : MAX_REQUEST_BYTES + 1;
}

function upstreamHeaders(request) {
  const headers = new Headers();
  const authorization = request.headers.get("authorization");
  const workspaceKey = request.headers.get("x-memoryendpoints-key");
  const idempotencyKey = request.headers.get("idempotency-key");
  if (authorization) {
    headers.set("authorization", authorization);
  }
  if (workspaceKey) {
    headers.set("x-memoryendpoints-key", workspaceKey);
  }
  if (idempotencyKey) {
    headers.set("idempotency-key", idempotencyKey);
  }
  headers.set("accept", "application/json");
  if (request.method === "POST") {
    headers.set("content-type", "application/json");
  }
  return headers;
}

function relayResponseHeaders(upstreamResponse) {
  const headers = new Headers();
  headers.set("cache-control", "no-store");
  const contentType = upstreamResponse.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  } else {
    headers.set("content-type", "application/json; charset=utf-8");
  }
  return headers;
}

export default {
  async fetch(request, env) {
    try {
      const method = request.method.toUpperCase();
      const targetUrl = relayTargetUrl(request.url, env);
      if (!targetUrl) {
        return jsonResponse(404, { ok: false, error: "unknown MemoryEndpoints relay route" });
      }
      if (method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "cache-control": "no-store"
          }
        });
      }
      if (method !== "GET" && method !== "POST") {
        return jsonResponse(405, { ok: false, error: "method not allowed" });
      }
      if (!hasWorkspaceKey(request)) {
        return jsonResponse(401, { ok: false, error: "workspace key required" });
      }
      if (method === "POST" && requestByteLength(request) > MAX_REQUEST_BYTES) {
        return jsonResponse(413, { ok: false, error: "public-safe memory payload too large" });
      }

      const upstreamResponse = await fetch(targetUrl.toString(), {
        method,
        headers: upstreamHeaders(request),
        body: method === "POST" ? request.body : undefined,
        redirect: "manual"
      });
      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: relayResponseHeaders(upstreamResponse)
      });
    } catch (_error) {
      return jsonResponse(502, { ok: false, error: "MemoryEndpoints relay failed" });
    }
  }
};
