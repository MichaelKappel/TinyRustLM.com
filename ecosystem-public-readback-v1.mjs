#!/usr/bin/env node
"use strict";

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const maximumExactArtifactBytes = 20 * 1024 * 1024;
const maximumSmokeBytes = 2 * 1024 * 1024;
const requestTimeoutMs = 90_000;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function readJson(filePath) {
  const bytes = fs.readFileSync(filePath);
  invariant(bytes.length > 0 && bytes.length <= 16 * 1024 * 1024,
    `JSON input is outside its bound: ${filePath}`);
  return JSON.parse(bytes.toString("utf8"));
}

async function readBounded(response, maximumBytes) {
  const reader = response.body.getReader();
  const chunks = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    invariant(byteLength <= maximumBytes, "HTTP response exceeded its byte bound");
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, byteLength);
}

async function request(url, maximumBytes, options = {}) {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: options.redirect || "manual",
      signal: AbortSignal.timeout(requestTimeoutMs)
    });
    let bytes;
    if (options.omitBody) {
      await response.body?.cancel();
      bytes = Buffer.alloc(0);
    } else {
      bytes = await readBounded(response, maximumBytes);
    }
    return Object.freeze({
      ok: true,
      status: response.status,
      location: response.headers.get("location"),
      headers: response.headers,
      bytes
    });
  } catch (error) {
    return Object.freeze({
      ok: false,
      status: null,
      location: null,
      headers: null,
      bytes: Buffer.alloc(0),
      errorCode: error?.name || "Error"
    });
  }
}

function withNonce(origin, publicPath, nonce) {
  const url = new URL(publicPath, origin);
  url.searchParams.set("ecosystem_audit", nonce);
  return url.href;
}

async function exactReadback(origin, publicPath, expectedBytes, expectedSha256, nonce) {
  invariant(Number.isSafeInteger(expectedBytes) && expectedBytes >= 0 &&
    expectedBytes <= maximumExactArtifactBytes, "Expected byte count is invalid");
  invariant(/^[a-f0-9]{64}$/u.test(expectedSha256), "Expected SHA-256 is invalid");
  const url = withNonce(origin, publicPath, nonce);
  const response = await request(url, Math.max(expectedBytes, 1));
  const observedSha256 = response.ok ? sha256(response.bytes) : null;
  const passed = response.ok && response.status === 200 &&
    response.bytes.length === expectedBytes && observedSha256 === expectedSha256;
  return Object.freeze({
    path: publicPath,
    url,
    httpStatus: response.status,
    expectedBytes,
    observedBytes: response.bytes.length,
    expectedSha256,
    observedSha256,
    errorCode: response.errorCode || null,
    status: passed ? "pass" : "fail"
  });
}

async function smokeReadback(origin, route, nonce) {
  const url = withNonce(origin, route.path, nonce);
  const response = await request(url, maximumSmokeBytes);
  let containsExpectedText = false;
  if (response.ok) {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(response.bytes);
      containsExpectedText = text.includes(String(route.contains));
    } catch {
      containsExpectedText = false;
    }
  }
  const passed = response.ok && response.status === 200 && containsExpectedText;
  return Object.freeze({
    path: String(route.path),
    httpStatus: response.status,
    containsExpectedText,
    observedBytes: response.bytes.length,
    errorCode: response.errorCode || null,
    status: passed ? "pass" : "fail"
  });
}

function compareManifestToReceipt(manifest, receipt) {
  const expected = new Map(manifest.files.map((entry) => [entry.path, entry]));
  const observed = new Map(receipt.files.map((entry) => [entry.path, entry]));
  let mismatches = 0;
  for (const [filePath, entry] of expected) {
    const candidate = observed.get(filePath);
    if (!candidate || candidate.bytes !== entry.bytes || candidate.sha256 !== entry.sha256) {
      mismatches += 1;
    }
  }
  for (const filePath of observed.keys()) {
    if (!expected.has(filePath)) mismatches += 1;
  }
  return mismatches;
}

async function auditCanonical(repositoryRoot, generatedRoot, nonce) {
  const siteRoot = path.join(repositoryRoot, "tinyrustlm");
  const manifestPath = path.join(siteRoot, "deploy", "web-deployment-manifest.v2.json");
  const ledgerPath = path.join(siteRoot, "release", "site-release-ledger.v1.json");
  const manifest = readJson(manifestPath);
  const ledger = readJson(ledgerPath);
  const artifacts = [];
  for (const entry of manifest.publish) {
    if (entry.remote === ".htaccess") {
      artifacts.push(Object.freeze({
        path: entry.remote,
        verification: "security-header-and-route-policy",
        status: "pass"
      }));
      continue;
    }
    const localPath = path.join(
      entry.source === "generated-release" ? generatedRoot : siteRoot,
      ...entry.local.split("/")
    );
    const bytes = fs.readFileSync(localPath);
    artifacts.push(await exactReadback(
      manifest.publicOrigin,
      `/${entry.remote}`,
      bytes.length,
      sha256(bytes),
      nonce
    ));
  }

  const rootResponse = await request(withNonce(manifest.publicOrigin, "/", nonce), maximumSmokeBytes);
  const expectedHeaders = Object.freeze({
    "cache-control": "no-cache, must-revalidate",
    "cross-origin-resource-policy": "same-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY"
  });
  const securityHeaders = Object.entries(expectedHeaders).map(([name, expected]) => {
    const observed = rootResponse.headers?.get(name) || null;
    return Object.freeze({
      name,
      expected,
      observed,
      status: observed === expected ? "pass" : "fail"
    });
  });

  const prohibitedPaths = [
    ...manifest.retire.map((entry) => ({
      path: `/${entry.remote}`,
      acceptedStatuses: [404]
    })),
    { path: "/app/models/", acceptedStatuses: [404] },
    { path: "/app/deploy-0123456789ab-stage.slm", acceptedStatuses: [404] },
    { path: "/.git/config", acceptedStatuses: [403, 404] },
    { path: "/workspace.uai", acceptedStatuses: [403, 404] }
  ];
  const prohibitedRoutes = [];
  for (const entry of prohibitedPaths) {
    const response = await request(withNonce(manifest.publicOrigin, entry.path, nonce), maximumSmokeBytes);
    prohibitedRoutes.push(Object.freeze({
      path: entry.path,
      httpStatus: response.status,
      acceptedStatuses: entry.acceptedStatuses,
      status: entry.acceptedStatuses.includes(response.status) ? "pass" : "fail"
    }));
  }

  const failures = [
    ...artifacts,
    ...securityHeaders,
    ...prohibitedRoutes
  ].filter((entry) => entry.status !== "pass").length +
    (rootResponse.status === 200 ? 0 : 1);
  const release = ledger.releases.at(-1);
  const publication = ledger.publications.at(-1);
  return Object.freeze({
    site: "TinyRustLM.com",
    origin: manifest.publicOrigin,
    status: failures === 0 ? "pass" : "fail",
    releaseId: release.releaseId,
    version: release.version,
    releaseDate: release.releaseDate,
    publicationId: publication.publicationId,
    sourceRevision: publication.sourceRevision,
    deploymentManifestSha256: sha256(fs.readFileSync(manifestPath)),
    expectedArtifactCount: manifest.publish.length,
    exactPublicReadbackCount: artifacts.filter((entry) =>
      entry.verification !== "security-header-and-route-policy").length,
    failureCount: failures,
    artifacts,
    securityHeaders,
    prohibitedRoutes
  });
}

async function auditStaticSite(spec, nonce) {
  const manifestPath = path.join(spec.root, "deploy", "site-deployment-manifest.v1.json");
  const receiptPath = path.join(spec.root, ...spec.receipt.split("/"));
  const manifest = readJson(manifestPath);
  const receipt = readJson(receiptPath);
  const manifestReceiptMismatchCount = compareManifestToReceipt(manifest, receipt);
  const readbacks = [];
  for (const entry of manifest.files.filter((file) => file.https_readback_path !== null)) {
    readbacks.push(await exactReadback(
      manifest.origin,
      entry.https_readback_path,
      entry.bytes,
      entry.sha256,
      nonce
    ));
  }
  const smokes = [];
  for (const route of manifest.route_smokes) {
    smokes.push(await smokeReadback(manifest.origin, route, nonce));
  }
  const failures = manifestReceiptMismatchCount +
    readbacks.filter((entry) => entry.status !== "pass").length +
    smokes.filter((entry) => entry.status !== "pass").length;
  return Object.freeze({
    site: manifest.site,
    origin: manifest.origin,
    version: manifest.version,
    releaseDate: manifest.release_date,
    sourceCommit: receipt.source_commit,
    sourceTree: receipt.source_tree,
    manifestSha256: receipt.manifest_sha256,
    terminalReceiptStatus: receipt.status,
    manifestFileCount: manifest.files.length,
    exactPublicReadbackCount: readbacks.length,
    smokeCount: smokes.length,
    manifestReceiptMismatchCount,
    failureCount: failures,
    status: failures === 0 ? "pass" : "fail",
    readbacks,
    smokes
  });
}

async function auditRuntimeRedirects(runtimeRoot, nonce) {
  const receiptPath = path.join(runtimeRoot, "verification", "receipts",
    "runtime-redirect-verification-20260811T143538Z.json");
  const receipt = readJson(receiptPath);
  const redirects = [];
  for (const expected of receipt.redirects) {
    const response = await request(expected.source_url, 1, {
      omitBody: true
    });
    const passed = response.status === expected.status_code &&
      response.location === expected.expected_location;
    redirects.push(Object.freeze({
      path: expected.path,
      httpStatus: response.status,
      expectedLocation: expected.expected_location,
      observedLocation: response.location,
      status: passed ? "pass" : "fail"
    }));
  }
  const destinations = [];
  for (const expected of receipt.readbacks) {
    const response = await request(withNonce(expected.url, "", nonce), maximumSmokeBytes);
    destinations.push(Object.freeze({
      url: expected.url,
      httpStatus: response.status,
      status: response.status === 200 ? "pass" : "fail"
    }));
  }
  const failures = [...redirects, ...destinations]
    .filter((entry) => entry.status !== "pass").length;
  return Object.freeze({
    site: receipt.site,
    origin: receipt.origin,
    status: failures === 0 ? "pass" : "fail",
    knownDeploymentBlocker: receipt.known_deployment_blocker,
    deploymentAttempted: false,
    redirectCount: redirects.length,
    destinationCount: destinations.length,
    failureCount: failures,
    redirects,
    destinations
  });
}

async function auditObservedBoundary(site, checks, nonce) {
  const observations = [];
  for (const check of checks) {
    const response = await request(check.url, maximumSmokeBytes, {
      omitBody: check.omitBody === true
    });
    const passed = response.status === check.status &&
      (check.location === undefined || response.location === check.location);
    observations.push(Object.freeze({
      url: check.url,
      httpStatus: response.status,
      expectedLocation: check.location || null,
      observedLocation: response.location,
      status: passed ? "pass" : "fail"
    }));
  }
  const failures = observations.filter((entry) => entry.status !== "pass").length;
  return Object.freeze({
    site,
    status: failures === 0 ? "pass" : "fail",
    scope: "reachability-only-not-publication-evidence",
    failureCount: failures,
    observations
  });
}

async function main() {
  const [repositoryRoot, siblingRoot, generatedRoot, outputPath, ...extra] = process.argv.slice(2);
  invariant(extra.length === 0 && repositoryRoot && siblingRoot && generatedRoot && outputPath,
    "Usage: ecosystem-public-readback-v1.mjs <repo> <sibling-root> <generated-root> <new-output>");
  for (const input of [repositoryRoot, siblingRoot, generatedRoot, outputPath]) {
    invariant(path.isAbsolute(input), "Every path argument must be absolute");
  }
  invariant(!fs.existsSync(outputPath), "Output receipt must be new");
  const nonce = crypto.randomBytes(6).toString("hex");
  const staticSpecs = [
    {
      root: path.join(siblingRoot, "TinyRustLM.MiRust.com"),
      receipt: "deploy/receipts/site-deployment-20260809T234347Z.json"
    },
    {
      root: path.join(siblingRoot, "MiniModel.MiRust.com"),
      receipt: "deploy/receipts/site-deployment-20260811T144605Z.json"
    },
    {
      root: path.join(siblingRoot, "MiniModel.org"),
      receipt: "deploy/receipts/site-deployment-20260811T145917Z.json"
    }
  ];
  const sites = [await auditCanonical(repositoryRoot, generatedRoot, nonce)];
  for (const spec of staticSpecs) {
    sites.push(await auditStaticSite(spec, nonce));
  }
  sites.push(await auditRuntimeRedirects(path.join(siblingRoot, "Runtime.MiRust.com"), nonce));
  sites.push(await auditObservedBoundary("LMComposer.com", [
    {
      url: "https://lmcomposer.com/",
      status: 301,
      location: "https://tinyrustlm.com/",
      omitBody: true
    },
    { url: "https://lmcomposer.com/version.json", status: 200 }
  ], nonce));
  sites.push(await auditObservedBoundary("MiRust.com", [
    { url: "https://mirust.com/.well-known/mirust-site.json", status: 200 }
  ], nonce));

  const failureCount = sites.reduce((sum, site) => sum + site.failureCount, 0);
  const receipt = Object.freeze({
    schema: "tinyrustlm.ecosystem_public_readback.v1",
    observedUtc: new Date().toISOString(),
    status: failureCount === 0 ? "pass" : "fail",
    nonce,
    siteCount: sites.length,
    failureCount,
    claimBoundary: "Read-only HTTPS reconciliation; no deployment or publication was attempted.",
    sites
  });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const descriptor = fs.openSync(outputPath, "wx", 0o600);
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  const reopened = fs.readFileSync(outputPath);
  JSON.parse(reopened.toString("utf8"));
  process.stdout.write(`${JSON.stringify({
    status: receipt.status,
    siteCount: receipt.siteCount,
    failureCount: receipt.failureCount,
    receiptBytes: reopened.length,
    receiptSha256: sha256(reopened),
    sites: sites.map((site) => ({
      site: site.site,
      status: site.status,
      failureCount: site.failureCount
    }))
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`Ecosystem public readback failed: ${error.message}\n`);
  process.exitCode = 1;
});
