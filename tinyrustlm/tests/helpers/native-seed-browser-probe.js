"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright-core");
const { requireCanonicalArtifactPath } = require("../../tools/canonical-operation-scratch.js");

/** Establish a real loopback page origin; an intercepted navigation has no local socket. */
async function pageHost(port) {
  const server = http.createServer((request, response) => {
    if (request.method !== "GET" || request.url !== "/") {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html", "Connection": "close" });
    response.end("<!doctype html><title>Seed CORS probe</title>");
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return server;
}

/** Probe six tiny Rust-owned fixtures through real Edge CORS, without mocking seed bytes. */
async function main() {
  assert.equal(process.argv.length, 4);
  const peer = new URL(process.argv[2]);
  assert.equal(peer.protocol, "http:");
  assert.equal(peer.hostname, "127.0.0.1");
  assert.equal(peer.origin, process.argv[2]);
  assert.ok(peer.port);
  const descriptorPath = path.resolve(process.argv[3]);
  requireCanonicalArtifactPath(path.dirname(descriptorPath));
  // Playwright profiles and artifacts must inherit the test harness's owned scratch.
  requireCanonicalArtifactPath(process.env.TEMP);
  const stat = fs.lstatSync(descriptorPath);
  assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 8192);
  const raw = fs.readFileSync(descriptorPath);
  const descriptor = JSON.parse(raw);
  const names = ["model.slm2", "tokenizer.tokenizer2", "template.template2",
    "sampling.sampling2", "prompt.prompt2", "composition.acg2"];
  assert.deepEqual(descriptor.members.map((member) => member.name), names);
  assert.match(descriptor.compositionId, /^sha256:[a-f0-9]{64}$/);
  for (const member of descriptor.members) {
    assert.ok(Number.isSafeInteger(member.bytes) && member.bytes > 0 && member.bytes <= 8192);
    assert.match(member.sha256, /^[a-f0-9]{64}$/);
  }
  const pieceSetId = `sha256:${crypto.createHash("sha256").update(raw).digest("hex")}`;
  const memberUrls = names.map((name) =>
    `${peer.origin}/tinyrustlm/direct-composition/v1/compositions/${descriptor.compositionId}/members/${name}`);
  const hosts = [];
  let browser;
  let watchdog;
  try {
    hosts.push(await pageHost(4173));
    hosts.push(await pageHost(4174));
    browser = await chromium.launch({ channel: "msedge", headless: true, timeout: 15000 });
    watchdog = setTimeout(() => browser.close().catch(() => {}), 25000);
    const context = await browser.newContext({ serviceWorkers: "block" });
    await context.route("**/*", (route) => {
      const url = route.request().url();
      if (["http://127.0.0.1:4173/", "http://127.0.0.1:4174/"].includes(url)) {
        return route.continue();
      }
      return memberUrls.includes(url) ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") process.stderr.write(`${message.text()}\n`);
    });
    page.on("requestfailed", (request) => {
      process.stderr.write(`${request.method()} ${request.url()}: ${request.failure()?.errorText}\n`);
    });
    await page.goto("http://127.0.0.1:4173/");
    // These are browser Fetch responses with the browser's CORS-filtered Headers object.
    const observed = await page.evaluate(async (urls) => {
      const results = [];
      for (const url of urls) {
        const response = await fetch(url, { mode: "cors", credentials: "omit", redirect: "error" });
        const bytes = await response.arrayBuffer();
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
          (byte) => byte.toString(16).padStart(2, "0")).join("");
        results.push({ status: response.status, url: response.url, redirected: response.redirected,
          headers: Object.fromEntries(response.headers), bytes: bytes.byteLength, digest });
      }
      return results;
    }, memberUrls);
    for (let index = 0; index < names.length; index += 1) {
      const actual = observed[index];
      const member = descriptor.members[index];
      assert.equal(actual.status, 200);
      assert.equal(actual.url, memberUrls[index]);
      assert.equal(actual.redirected, false);
      assert.equal(actual.headers["content-type"], "application/octet-stream");
      assert.equal(actual.headers["content-length"], String(member.bytes));
      assert.equal(actual.headers["content-encoding"], undefined);
      assert.equal(actual.headers["x-tinyrustlm-composition-id"], descriptor.compositionId);
      assert.equal(actual.headers["x-tinyrustlm-piece-set-id"], pieceSetId);
      assert.equal(actual.headers["x-tinyrustlm-member-name"], member.name);
      assert.equal(actual.headers["x-tinyrustlm-member-id"], `sha256:${member.sha256}`);
      assert.equal(actual.bytes, member.bytes);
      assert.equal(actual.digest, member.sha256);
    }
    await page.goto("http://127.0.0.1:4174/");
    const rejectedForeignOrigin = await page.evaluate(async (url) => {
      try {
        await fetch(url, { mode: "cors", credentials: "omit", redirect: "error" });
        return false;
      } catch { return true; }
    }, memberUrls[0]);
    assert.equal(rejectedForeignOrigin, true);
    process.stdout.write(`${JSON.stringify({ verifiedMembers: observed.length,
      rejectedForeignOrigin, browserVersion: browser.version() })}\n`);
  } finally {
    clearTimeout(watchdog);
    try { if (browser) await browser.close(); }
    finally {
      await Promise.all(hosts.map((server) => new Promise((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => error ? reject(error) : resolve());
      })));
    }
  }
}

main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
