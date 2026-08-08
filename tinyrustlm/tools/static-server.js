#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const {
  assertSafeRegularFile
} = require("./immutable-publication-files.js");
const {
  validateWebDeploymentManifest
} = require("./web-deployment-manifest.js");

const contentTypes = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".manifest": "application/json; charset=utf-8",
  ".wasm": "application/wasm"
});

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function writeResponse(request, response, statusCode, body, contentType, extraHeaders = {}) {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(String(body), "utf8");
  response.writeHead(statusCode, {
    "cache-control": "no-store",
    "cross-origin-resource-policy": "same-origin",
    "content-length": bytes.length,
    "content-type": contentType || "text/plain; charset=utf-8",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    ...extraHeaders
  });
  response.end(request.method === "HEAD" ? undefined : bytes);
}

function canonicalRequestPath(requestUrl) {
  invariant(
    typeof requestUrl === "string" &&
      requestUrl.startsWith("/") &&
      !/%2f|%5c/i.test(requestUrl),
    "Loopback static request target is invalid"
  );
  let url;
  try {
    url = new URL(requestUrl, "http://127.0.0.1");
  } catch {
    throw new Error("Loopback static request target is invalid");
  }
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    throw new Error("Loopback static request target is invalid");
  }
  invariant(
    pathname.startsWith("/") &&
      !pathname.includes("\\") &&
      !pathname.includes("\0") &&
      !pathname.includes("//"),
    "Loopback static request path is invalid"
  );
  if (pathname === "/") pathname = "/index.html";
  if (pathname === "/app/") pathname = "/app/index.html";
  if (pathname === "/companion/") pathname = "/companion/index.html";
  if (pathname === "/updates/") pathname = "/updates/index.html";
  return Object.freeze({ pathname, searchParams: url.searchParams });
}

function validateVersionQuery(searchParams, file) {
  const entries = Array.from(searchParams.entries());
  if (entries.length === 0) return true;
  return (
    entries.length === 1 &&
    entries[0][0] === "v" &&
    entries[0][1] === `sha256-${file.sha256}` &&
    /\.(?:css|js)$/i.test(file.remote)
  );
}

function readValidatedFile(file) {
  let bytes;
  try {
    const safeFile = assertSafeRegularFile(file.filePath);
    bytes = fs.readFileSync(safeFile.filePath);
  } catch (error) {
    throw new Error("Loopback release artifact is unavailable");
  }
  invariant(
    bytes.length === file.byteCount && sha256(bytes) === file.sha256,
    "Loopback release artifact changed after manifest validation"
  );
  return bytes;
}

function buildFileMap(validation) {
  return new Map(
    validation.files
      .filter((file) => file.remote !== ".htaccess")
      .map((file) => [
        `/${file.remote}`,
        file
      ])
  );
}

async function startStaticServer(options = {}) {
  const siteRoot = path.resolve(options.siteRoot || path.join(__dirname, ".."));
  const port = options.port === undefined ? 0 : Number(options.port);
  invariant(Number.isInteger(port) && port >= 0 && port <= 65535,
    "Loopback static server port is invalid");
  const validation = validateWebDeploymentManifest({
    siteRoot,
    manifestPath: options.manifestPath,
    generatedRoot: options.generatedRoot
  });
  const fileMap = buildFileMap(validation);
  const server = http.createServer((request, response) => {
    try {
      if (request.method !== "GET" && request.method !== "HEAD") {
        writeResponse(
          request,
          response,
          405,
          "method not allowed",
          undefined,
          { allow: "GET, HEAD" }
        );
        return;
      }
      const target = canonicalRequestPath(request.url);
      const file = fileMap.get(target.pathname);
      if (!file || !validateVersionQuery(target.searchParams, file)) {
        writeResponse(request, response, 404, "not found");
        return;
      }
      const bytes = readValidatedFile(file);
      writeResponse(
        request,
        response,
        200,
        bytes,
        contentTypes[path.extname(file.remote).toLowerCase()] ||
          "application/octet-stream"
      );
    } catch {
      writeResponse(request, response, 400, "bad request");
    }
  });
  server.maxHeadersCount = 32;
  server.headersTimeout = 5_000;
  server.requestTimeout = 15_000;
  server.keepAliveTimeout = 1_000;
  server.maxRequestsPerSocket = 100;
  server.maxConnections = 32;

  await new Promise((resolve, reject) => {
    const onError = () => reject(new Error("Loopback static server failed to bind"));
    server.once("error", onError);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", onError);
      resolve();
    });
  });
  const address = server.address();
  invariant(address && typeof address === "object", "Loopback static server address is unavailable");
  let closed = false;
  return Object.freeze({
    origin: `http://127.0.0.1:${address.port}`,
    fileCount: fileMap.size,
    async close() {
      if (closed) return;
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(new Error("Loopback static server failed to close"));
          else resolve();
        });
        server.closeAllConnections();
      });
      closed = true;
    }
  });
}

async function main() {
  const [siteRoot, generatedRoot, portValue, ...extra] = process.argv.slice(2);
  invariant(
    siteRoot && generatedRoot && extra.length === 0,
    "Usage: static-server.js <site-root> <generated-release-root> [port]"
  );
  const port = portValue === undefined ? 0 : Number(portValue);
  const instance = await startStaticServer({ siteRoot, generatedRoot, port });
  process.stdout.write(`${JSON.stringify({
    status: "ready",
    origin: instance.origin,
    fileCount: instance.fileCount
  })}\n`);
  const close = async () => {
    await instance.close();
    process.exitCode = 0;
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

if (require.main === module) {
  main().catch(() => {
    process.stderr.write("TinyRustLM loopback static server failed\n");
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  canonicalRequestPath,
  startStaticServer,
  validateVersionQuery
});
