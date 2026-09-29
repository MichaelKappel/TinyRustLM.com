#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const {
  assertSafeDirectoryAncestry,
  assertSafeRegularFile
} = require("./immutable-publication-files.js");
const { atomicReplace } = require("./durable-files.js");

const assetReferencePattern =
  /\b(href|src)="(\.\/[^"?]+\.(?:css|js))(?:\?v=([^"]+))?"/g;

/** Runs only in the generated service worker; the closed asset list contains no user/model data. */
function offlineWorkerRuntime(assets, cacheName) {
  "use strict";
  const byPath = new Map(assets.map(asset => [asset.path, asset]));
  const origin = self.location.origin;

  /** Stream and hash every decoded response, including cached bytes, before exposing it. */
  async function verifiedResponse(response, asset) {
    if (!response || response.status !== 200 || !response.body) {
      throw new Error("offline-static-response");
    }
    const reader = response.body.getReader();
    const bytes = new Uint8Array(asset.bytes);
    let offset = 0;
    let complete = false;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!(value instanceof Uint8Array) || value.byteLength > bytes.length - offset) {
          throw new Error("offline-static-length");
        }
        bytes.set(value, offset);
        offset += value.byteLength;
      }
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
        value => value.toString(16).padStart(2, "0")).join("");
      if (offset !== asset.bytes || digest !== asset.sha256) {
        throw new Error("offline-static-identity");
      }
      const headers = new Headers(response.headers);
      headers.delete("content-encoding");
      headers.set("content-length", String(bytes.byteLength));
      complete = true;
      return new Response(bytes, { status: 200, headers });
    } finally {
      if (!complete) {
        bytes.fill(0);
        await reader.cancel().catch(() => {});
      }
      reader.releaseLock();
    }
  }

  /** Fetch only a generated same-origin public asset, with no cookies, redirects, or HTTP cache. */
  async function fetchAsset(asset, signal) {
    return verifiedResponse(await fetch(new URL(asset.path, origin), {
      credentials: "omit", cache: "no-store", redirect: "error", signal
    }), asset);
  }

  /** Installation becomes usable only after the entire exact closure is in its own cache. */
  async function installAssets() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const cache = await caches.open(cacheName);
      for (const asset of assets) {
        await cache.put(new URL(asset.path, origin), await fetchAsset(asset, controller.signal));
      }
    } catch (error) {
      await caches.delete(cacheName);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Normal activation waits for previous clients; retire only our own obsolete static caches. */
  async function activateAssets() {
    for (const name of await caches.keys()) {
      if (/^tinyrustlm-static-v1-[a-f0-9]{64}$/.test(name) && name !== cacheName) {
        await caches.delete(name);
      }
    }
    await self.clients.claim();
  }

  /** Restrict handling to generated paths and exact asset versions; never intercept live metadata. */
  function selectedAsset(request) {
    if (request.method !== "GET" || request.headers.has("authorization") || request.headers.has("range")) {
      return null;
    }
    const url = new URL(request.url);
    if (url.origin !== origin) return null;
    const pathname = url.pathname === "/" ? "/index.html"
      : url.pathname === "/app/" ? "/app/index.html" : url.pathname;
    const asset = byPath.get(pathname);
    if (!asset) return null;
    if (url.search && (!/\.(?:js|css)$/.test(pathname) ||
        url.search !== `?v=sha256-${asset.sha256}`)) return null;
    return asset;
  }

  /** Reject corrupt bytes now and evict only that entry; an explicit later reload may fetch its pinned bytes. */
  async function respond(asset) {
    const cache = await caches.open(cacheName);
    const key = new URL(asset.path, origin);
    const cached = await cache.match(key);
    if (cached) {
      try { return await verifiedResponse(cached, asset); }
      catch (error) {
        await cache.delete(key);
        throw error;
      }
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetchAsset(asset, controller.signal);
      await cache.put(key, response.clone());
      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  self.addEventListener("install", event => event.waitUntil(installAssets()));
  self.addEventListener("activate", event => event.waitUntil(activateAssets()));
  self.addEventListener("fetch", event => {
    const asset = selectedAsset(event.request);
    if (asset) event.respondWith(respond(asset));
  });
}

/** Generate the worker from the same shell/dependency bytes checked for publication. */
function renderOfflineWorker(root, references) {
  const paths = ["index.html", "app/index.html", "app/model-runtime-worker.js",
    "browser-runtime/tinyrustlm-browser-runtime.wasm",
    "browser-runtime/tinyrustlm-browser-runtime.wasm.manifest.json",
    ...references.map(reference => `app/${reference.reference.slice(2)}`)];
  const assets = Array.from(new Set(paths)).sort().map(relative => {
    const file = assertSafeRegularFile(path.join(root, relative));
    const size = fs.statSync(file.filePath).size;
    invariant(size > 0 && size <= 16 * 1024 * 1024, "Offline static asset size is invalid");
    return { path: `/${relative}`, bytes: size, sha256: sha256File(file.filePath) };
  });
  invariant(assets.length <= 64 && assets.reduce((sum, asset) => sum + asset.bytes, 0) <= 32 * 1024 * 1024,
    "Offline static closure exceeds its bound");
  const body = offlineWorkerRuntime.toString().replace(/\r\n/g, "\n");
  const json = JSON.stringify(assets, null, 2);
  const identity = crypto.createHash("sha256").update(body).update(json).digest("hex");
  return `// Generated by tools/static-shell-parity.js --write. Public static assets only.\n` +
    `(${body})(${json}, "tinyrustlm-static-v1-${identity}");\n`;
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function readShell(filePath) {
  try {
    return fs.readFileSync(assertSafeRegularFile(filePath).filePath, "utf8")
      .replace(/\r\n/g, "\n");
  } catch {
    throw new Error("Required static shell is unavailable");
  }
}

function sha256File(filePath) {
  const safeFile = assertSafeRegularFile(filePath);
  return crypto.createHash("sha256").update(fs.readFileSync(safeFile.filePath)).digest("hex");
}

function containedAssetPath(appRoot, reference) {
  const relative = reference.slice(2).replace(/\//g, path.sep);
  const candidate = path.resolve(appRoot, relative);
  const containment = path.relative(appRoot, candidate);
  invariant(
    containment &&
      !containment.startsWith("..") &&
      !path.isAbsolute(containment),
    `Static shell asset escapes the app root: ${reference}`
  );
  try {
    return assertSafeRegularFile(candidate).filePath;
  } catch {
    throw new Error(`Static shell asset is missing or unsafe: ${reference}`);
  }
}

function collectStaticAssetReferences(html, appRoot) {
  const references = [];
  const seen = new Set();
  for (const match of html.matchAll(assetReferencePattern)) {
    const reference = match[2];
    invariant(!seen.has(reference), `Static shell asset is referenced twice: ${reference}`);
    seen.add(reference);
    const filePath = containedAssetPath(appRoot, reference);
    references.push(Object.freeze({
      attribute: match[1],
      reference,
      version: match[3] || "",
      sha256: sha256File(filePath)
    }));
  }
  invariant(references.length > 0, "Static shell does not reference any local assets");
  return Object.freeze(references);
}

function stampCanonicalShell(html, appRoot) {
  return html.replace(assetReferencePattern, (_whole, attribute, reference) => {
    const filePath = containedAssetPath(appRoot, reference);
    return `${attribute}="${reference}?v=sha256-${sha256File(filePath)}"`;
  });
}

function renderRootShell(appHtml) {
  return appHtml.replace(
    /\b(href|src)="\.\/([^"?]+\.(?:css|js))(\?v=[^"]+)?"/g,
    (_whole, attribute, relativePath, query = "") =>
      `${attribute}="./app/${relativePath}${query}"`
  );
}

function firstMismatch(left, right) {
  const leftLines = left.split("\n");
  const rightLines = right.split("\n");
  const maximum = Math.max(leftLines.length, rightLines.length);
  for (let index = 0; index < maximum; index += 1) {
    const leftLine = leftLines[index] || "";
    const rightLine = rightLines[index] || "";
    if (leftLine !== rightLine) {
      return Object.freeze({ line: index + 1, left: leftLine, right: rightLine });
    }
  }
  return null;
}

function shellPaths(root) {
  const resolvedRoot = path.resolve(root);
  assertSafeDirectoryAncestry(resolvedRoot);
  return Object.freeze({
    root: resolvedRoot,
    rootIndexPath: path.join(resolvedRoot, "index.html"),
    appRoot: path.join(resolvedRoot, "app"),
    appIndexPath: path.join(resolvedRoot, "app", "index.html")
  });
}

function verifyShells(root) {
  const locations = shellPaths(root);
  const appShell = readShell(locations.appIndexPath);
  const stampedAppShell = stampCanonicalShell(appShell, locations.appRoot);
  const stampMismatch = firstMismatch(appShell, stampedAppShell);
  if (stampMismatch) {
    throw new Error(
      `TinyRustLM canonical app shell has stale asset identity at line ` +
      `${stampMismatch.line}\nactual:   ${stampMismatch.left}\nexpected: ${stampMismatch.right}`
    );
  }

  const references = collectStaticAssetReferences(appShell, locations.appRoot);
  for (const reference of references) {
    invariant(
      reference.version === `sha256-${reference.sha256}`,
      `Static shell asset identity is stale: ${reference.reference}`
    );
  }

  const expectedRootShell = renderRootShell(appShell);
  const rootShell = readShell(locations.rootIndexPath);
  const rootMismatch = firstMismatch(rootShell, expectedRootShell);
  if (rootMismatch) {
    throw new Error(
      `TinyRustLM root shell drift at line ${rootMismatch.line}\n` +
      `actual:   ${rootMismatch.left}\nexpected: ${rootMismatch.right}`
    );
  }
  const offlineWorker = renderOfflineWorker(locations.root, references);
  invariant(readShell(path.join(locations.root, "offline-worker.js")) === offlineWorker,
    "TinyRustLM offline static worker has stale asset identity");
  return Object.freeze({ references, rootShell: expectedRootShell, appShell, offlineWorker });
}

function writeShells(root) {
  const locations = shellPaths(root);
  const appShell = stampCanonicalShell(readShell(locations.appIndexPath), locations.appRoot);
  const rootShell = renderRootShell(appShell);
  atomicReplace(locations.appIndexPath, appShell);
  atomicReplace(locations.rootIndexPath, rootShell);
  atomicReplace(path.join(locations.root, "offline-worker.js"), renderOfflineWorker(
    locations.root, collectStaticAssetReferences(appShell, locations.appRoot)
  ));
  return verifyShells(root);
}

function parseArguments(argv) {
  let root = path.join(__dirname, "..");
  let write = false;
  for (const argument of argv) {
    if (argument === "--write") {
      write = true;
    } else {
      invariant(!argument.startsWith("-"), `Unknown option: ${argument}`);
      root = argument;
    }
  }
  return Object.freeze({ root: path.resolve(root), write });
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = options.write ? writeShells(options.root) : verifyShells(options.root);
  process.stdout.write(
    `TinyRustLM root/app shell parity passed for ${result.references.length} content-bound assets\n`
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  collectStaticAssetReferences,
  offlineWorkerRuntime,
  renderOfflineWorker,
  renderRootShell,
  stampCanonicalShell,
  verifyShells,
  writeShells
});
