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

/** Accept canonical origin-form paths before WHATWG URL normalization can hide aliases. */
function canonicalRequestPath(requestUrl) {
  invariant(
    typeof requestUrl === "string" &&
      requestUrl.startsWith("/") &&
      requestUrl.length <= 2048 &&
      !/[\\#\u0000-\u0020\u007f]/u.test(requestUrl) &&
      !requestUrl.split("?", 1)[0].includes("%") &&
      !requestUrl.split("?", 1)[0].includes("//") &&
      requestUrl.split("?", 1)[0].split("/").every((part) => part !== "." && part !== ".."),
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

/** Bind a development asset's cache key to the exact bytes returned now. */
function validateSourceVersionQuery(searchParams, file, bytes) {
  return validateVersionQuery(searchParams, { remote: file.remote, sha256: sha256(bytes) });
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

/** Resolve one declared source file through direct ancestors inside the site. */
function sourceFile(siteRoot, relativePath) {
  invariant(
    typeof relativePath === "string" &&
      relativePath.length > 0 &&
      relativePath.length <= 512 &&
      !relativePath.startsWith("/") &&
      !relativePath.includes("\\") &&
      !relativePath.includes("//") &&
      !/[%:?#\u0000-\u0020\u007f]/u.test(relativePath) &&
      relativePath.split("/").every((part) =>
        part.length > 0 && part !== "." && part !== ".."),
    "Loopback source artifact path is invalid"
  );
  const filePath = path.resolve(siteRoot, ...relativePath.split("/"));
  const relative = path.relative(siteRoot, filePath);
  invariant(
    relative.length > 0 &&
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative),
    "Loopback source artifact escapes the site root"
  );
  return assertSafeRegularFile(filePath).filePath;
}

/** Use only the bounded current public declaration, without claiming release validation. */
function buildSourceFileMap(siteRoot) {
  const deploymentManifestPath = sourceFile(
    siteRoot,
    "deploy/web-deployment-manifest.v2.json"
  );
  let manifest;
  try {
    invariant(fs.statSync(deploymentManifestPath).size <= 256 * 1024,
      "Loopback source manifest is too large");
    manifest = JSON.parse(fs.readFileSync(deploymentManifestPath, "utf8"));
  } catch (error) {
    throw new Error("Loopback source manifest is unavailable");
  }
  invariant(manifest && typeof manifest === "object" && !Array.isArray(manifest),
    "Loopback source manifest is invalid");
  invariant(manifest.schema === "tinyrustlm.web_deployment_manifest.v2" &&
    manifest.publicOrigin === "https://tinyrustlm.com" &&
    manifest.deploymentScope === "browser-runtime-no-model-bytes",
    "Loopback source manifest identity is invalid");
  invariant(Array.isArray(manifest.publish) && manifest.publish.length > 0 && manifest.publish.length <= 96,
    "Loopback source manifest publish list is invalid");

  const files = new Map();
  for (const entry of manifest.publish) {
    invariant(entry && typeof entry === "object" && !Array.isArray(entry),
      "Loopback source manifest entry is invalid");
    const keys = Object.keys(entry);
    invariant(
      keys.length === 3 &&
        ["local", "remote", "source"].every((key) => Object.hasOwn(entry, key)),
      "Loopback source manifest entry fields are invalid"
    );
    invariant(entry.source === "source" || entry.source === "generated-release",
      "Loopback source manifest entry source is invalid");
    if (entry.source !== "source") continue;
    invariant(entry.local === entry.remote,
      "Loopback source manifest paths must preserve identity");
    invariant(
      !/(?:^|\/)models(?:\/|$)/iu.test(entry.remote) &&
        !/\.(?:slm\d*|gguf|safetensors|tokenizer2|template2|sampling2|prompt2|acg2|tensor2)(?:\.|$)/iu.test(entry.remote),
      "Loopback source manifest cannot expose model bytes"
    );
    const filePath = sourceFile(siteRoot, entry.local);
    if (entry.remote === ".htaccess") continue;
    const requestPath = `/${entry.remote}`;
    invariant(!files.has(requestPath), "Loopback source manifest path is duplicated");
    files.set(requestPath, Object.freeze({ filePath, remote: entry.remote }));
  }
  invariant(files.has("/index.html") && files.has("/app/index.html"),
    "Loopback source manifest omits an application shell");
  return files;
}

/** Recheck source-file ancestry on each request, including replacements after startup. */
function readSourceFile(file) {
  try {
    return fs.readFileSync(assertSafeRegularFile(file.filePath).filePath);
  } catch (error) {
    throw new Error("Loopback source artifact is unavailable");
  }
}

/** Share loopback HTTP policy while retaining distinct source and release byte checks. */
function createLoopbackServer(fileMap, readFile, validateQuery) {
  const server = http.createServer((request, response) => {
    try {
      const authority = request.headers.host;
      const port = request.socket.localPort;
      if (authority !== `127.0.0.1:${port}` && authority !== `localhost:${port}`) {
        writeResponse(request, response, 421, "misdirected request");
        return;
      }
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
      if (!file) {
        writeResponse(request, response, 404, "not found");
        return;
      }
      const bytes = readFile(file);
      if (!validateQuery(target.searchParams, file, bytes)) {
        writeResponse(request, response, 404, "not found");
        return;
      }
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
  return server;
}

/** Bind the requested loopback port and expose an idempotent owned shutdown. */
async function listenLoopback(server, port, fileCount) {
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
    fileCount,
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

/** Serve a validated release and reject bytes that change after validation. */
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
  return listenLoopback(
    createLoopbackServer(fileMap, readValidatedFile, validateVersionQuery),
    port,
    fileMap.size
  );
}

/** Preview current declared source files at an ephemeral or explicit loopback port. */
async function startSourceServer(options = {}) {
  const siteRoot = path.resolve(options.siteRoot || path.join(__dirname, ".."));
  const port = options.port === undefined ? 0 : Number(options.port);
  invariant(Number.isInteger(port) && port >= 0 && port <= 65535,
    "Loopback source server port is invalid");
  const fileMap = buildSourceFileMap(siteRoot);
  return listenLoopback(
    createLoopbackServer(fileMap, readSourceFile, validateSourceVersionQuery),
    port,
    fileMap.size
  );
}

/** Select explicit source preview or release mode and close only this process's listener. */
async function main() {
  const args = process.argv.slice(2);
  let instance;
  if (args[0] === "--source") {
    const [, siteRoot, portValue, ...extra] = args;
    invariant(
      siteRoot && extra.length === 0,
      "Usage: static-server.js --source <site-root> [port]"
    );
    const port = portValue === undefined ? 0 : Number(portValue);
    instance = await startSourceServer({ siteRoot, port });
  } else {
    const [siteRoot, generatedRoot, portValue, ...extra] = args;
    invariant(
      siteRoot && generatedRoot && extra.length === 0,
      "Usage: static-server.js <site-root> <generated-release-root> [port]"
    );
    const port = portValue === undefined ? 0 : Number(portValue);
    instance = await startStaticServer({ siteRoot, generatedRoot, port });
  }
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
  startSourceServer,
  startStaticServer,
  validateVersionQuery
});
