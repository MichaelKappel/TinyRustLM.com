#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const {
  assertSafeDirectoryAncestry,
  assertSafeRegularFile
} = require("./immutable-publication-files.js");
const { validatePublicReleaseFiles } = require("./site-release-contract.js");
const { verifyReleaseSurfaces } = require("./site-release-page.js");
const { verifyShells } = require("./static-shell-parity.js");

const manifestSchema = "tinyrustlm.web_deployment_manifest.v2";
const publicOrigin = "https://tinyrustlm.com";
const deploymentScope = "browser-runtime-no-model-bytes";
const releaseLedgerRelativePath = "release/site-release-ledger.v1.json";
const generatedReleasePaths = Object.freeze([
  ".well-known/site-release-history.json",
  ".well-known/site-release.json"
]);
const retiredPublicPaths = Object.freeze([
  "app/minimodel-announcement.js",
  "app/companion-bridge.js",
  "app/models/Qwen2.5-1.5B-Instruct.LICENSE.txt",
  "app/models/Qwen2.5-1.5B-Instruct.NOTICE.md",
  "app/models/qwen2.5-1.5b-instruct-q4.conversation",
  "app/models/qwen2.5-1.5b-instruct-q4.slm",
  "app/models/qwen2.5-1.5b-instruct-q4.slm.manifest"
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function requireExactSet(actualValues, expectedValues, label) {
  const actual = Array.from(actualValues).sort();
  const expected = Array.from(expectedValues).sort();
  invariant(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label} is incomplete or contains an undeclared value\n` +
      `actual: ${JSON.stringify(actual)}\nexpected: ${JSON.stringify(expected)}`
  );
}

function requireRelativePath(value, label) {
  const relativePath = String(value || "");
  invariant(
    relativePath.length > 0 &&
      relativePath.length <= 512 &&
      !relativePath.includes("\\") &&
      !relativePath.includes("\0") &&
      !relativePath.includes("?") &&
      !relativePath.includes("#") &&
      !relativePath.startsWith("/") &&
      !/^[A-Za-z]:/u.test(relativePath),
    `${label} is not a canonical relative path`
  );
  const segments = relativePath.split("/");
  invariant(
    segments.every((segment) => segment && segment !== "." && segment !== ".."),
    `${label} contains an unsafe path segment`
  );
  return relativePath;
}

function containedFile(root, relativePath, label) {
  const filePath = path.resolve(root, relativePath.replace(/\//g, path.sep));
  const containment = path.relative(root, filePath);
  invariant(
    containment && !containment.startsWith("..") && !path.isAbsolute(containment),
    `${label} escapes its declared source root`
  );
  try {
    return assertSafeRegularFile(filePath);
  } catch {
    throw new Error(`${label} is missing or unsafe`);
  }
}

function requireSafeDirectory(directory, label) {
  assertSafeDirectoryAncestry(directory);
  const stat = fs.lstatSync(directory);
  invariant(stat.isDirectory() && !stat.isSymbolicLink(), `${label} is missing or unsafe`);
  return directory;
}

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function listRegularFiles(directory, predicate) {
  requireSafeDirectory(directory, "Web deployment source directory");
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function expectedStaticPaths(siteRoot) {
  const appFiles = listRegularFiles(
    path.join(siteRoot, "app"),
    (name) => /\.(?:css|html|js)$/u.test(name)
  ).map((name) => `app/${name}`);
  const browserRuntimeFiles = listRegularFiles(
    path.join(siteRoot, "browser-runtime"),
    (name) => /^tinyrustlm-browser-runtime\.wasm(?:\.manifest\.json)?$/u.test(name)
  ).map((name) => `browser-runtime/${name}`);
  const updateFiles = listRegularFiles(
    path.join(siteRoot, "updates"),
    (name) => /^(?:index\.html|updates\.css)$/u.test(name)
  ).map((name) => `updates/${name}`);
  const companionFiles = listRegularFiles(
    path.join(siteRoot, "companion"),
    (name) => name === "index.html"
  ).map((name) => `companion/${name}`);
  return Object.freeze([
    ".htaccess",
    ...appFiles,
    ...companionFiles,
    "index.html",
    ...browserRuntimeFiles,
    ...updateFiles
  ].filter((file) => !retiredPublicPaths.includes(file)).sort());
}

// Validates the public Apache policy required before any web bytes may ship.
function validateHostPolicy(hostPolicy) {
  for (const requiredHeader of [
    'Header always set X-Content-Type-Options "nosniff"',
    'Header always set X-Frame-Options "DENY"',
    'Header always set Referrer-Policy "no-referrer"',
    'Header always set Cross-Origin-Resource-Policy "same-origin"',
    'Header always set Permissions-Policy ' +
      '"camera=(), microphone=(), geolocation=(), payment=(), usb=()"'
  ]) {
    invariant(
      hostPolicy.includes(requiredHeader),
      `Web host policy is missing required security header: ${requiredHeader}`
    );
  }
  invariant(
    hostPolicy.includes("AddType application/json .json"),
    "Web host policy must declare JSON release metadata"
  );
  invariant(
    /<FilesMatch "\\\.\(html\|css\|js\|json\|wasm\|manifest\)\$">[\s\S]*Header set Cache-Control "no-cache, must-revalidate"/u.test(hostPolicy),
    "Web host policy must revalidate mutable public and release paths"
  );
  invariant(
    /RewriteRule \(\^\|\/\)\.\*\\\.slm\$ - \[R=404,L,NC\]/u.test(hostPolicy) &&
      /RewriteRule \(\^\|\/\)models\(\/\|\$\) - \[R=404,L,NC\]/u.test(hostPolicy),
    "Web host policy must block project-hosted model routes"
  );
  invariant(
    hostPolicy.includes(
      "RewriteRule (^|/)(deploy-[0-9a-f]{12}-stage[^/]*|" +
        "backup-[0-9a-f]{12}\\.(tmp|slm))$ - [R=404,L,NC]"
    ),
    "Web host policy must block deployment stage and backup routes"
  );
  invariant(
    hostPolicy.includes(
      "RewriteRule (^|/)(\\.git|\\.uai|agent-file-handoff)(/|$) - [R=404,L,NC]"
    ),
    "Web host policy must conceal source-control and agent-memory routes"
  );
  return true;
}

// Validate the exact removal plan and forbid overlap with current publication.
function validateRetirementClosure(retire, publishedRemotePaths = new Set()) {
  invariant(Array.isArray(retire) && retire.length > 0 && retire.length <= 64,
    "Web deployment retirement list is invalid");
  const remotePaths = publishedRemotePaths instanceof Set
    ? publishedRemotePaths
    : new Set(publishedRemotePaths);
  const retirePaths = new Set();
  retire.forEach((entry, index) => {
    invariant(isPlainObject(entry), `retire[${index}] must be an object`);
    requireExactSet(Object.keys(entry), ["remote"], `retire[${index}] fields`);
    const remote = requireRelativePath(entry.remote, `retire[${index}].remote`);
    invariant(!retirePaths.has(remote), `Retired public path is duplicated: ${remote}`);
    invariant(!remotePaths.has(remote), `Published and retired paths overlap: ${remote}`);
    retirePaths.add(remote);
  });
  requireExactSet(retirePaths, retiredPublicPaths, "Web deployment retired-path closure");
  return retirePaths;
}


function readManifest(manifestPath) {
  let bytes;
  try {
    bytes = fs.readFileSync(assertSafeRegularFile(manifestPath).filePath);
  } catch {
    throw new Error("Web deployment manifest is unavailable");
  }
  let manifest;
  try {
    manifest = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error("Web deployment manifest is not valid UTF-8 JSON");
  }
  return Object.freeze({ bytes, manifest });
}

function validateWebDeploymentManifest(options = {}) {
  const siteRoot = path.resolve(options.siteRoot || path.join(__dirname, ".."));
  const manifestPath = path.resolve(
    options.manifestPath || path.join(siteRoot, "deploy", "web-deployment-manifest.v2.json")
  );
  const generatedRoot = path.resolve(String(options.generatedRoot || ""));
  requireSafeDirectory(siteRoot, "TinyRustLM site root");
  // Release metadata is bounded operation output, owned by this canonical repository.
  const artifactParents = [path.resolve(__dirname, "../artifacts"), path.resolve(__dirname, "../../artifacts")];
  invariant(
    path.isAbsolute(String(options.generatedRoot || "")) &&
      artifactParents.some((parent) => generatedRoot !== parent && isWithin(parent, generatedRoot)),
    "Generated release root must be an absolute child of canonical project artifacts"
  );
  requireSafeDirectory(generatedRoot, "Generated release root");

  const { bytes: manifestBytes, manifest } = readManifest(manifestPath);
  invariant(isPlainObject(manifest), "Web deployment manifest must be an object");
  requireExactSet(
    Object.keys(manifest),
    ["deploymentScope", "publicOrigin", "publish", "releaseLedger", "retire", "schema"],
    "Web deployment manifest fields"
  );
  invariant(manifest.schema === manifestSchema, "Web deployment manifest schema is invalid");
  invariant(manifest.publicOrigin === publicOrigin, "Web deployment public origin is invalid");
  invariant(manifest.deploymentScope === deploymentScope, "Web deployment scope is invalid");
  invariant(
    manifest.releaseLedger === releaseLedgerRelativePath,
    "Web deployment release ledger path is invalid"
  );
  invariant(
    Array.isArray(manifest.publish) && manifest.publish.length > 0 && manifest.publish.length <= 96,
    "Web deployment publish list is invalid"
  );
  invariant(
    Array.isArray(manifest.retire) && manifest.retire.length > 0 && manifest.retire.length <= 64,
    "Web deployment retirement list is invalid"
  );

  const releaseLedgerPath = containedFile(
    siteRoot,
    releaseLedgerRelativePath,
    "Web release ledger"
  ).filePath;
  const releaseSurfaces = verifyReleaseSurfaces(siteRoot);
  const publicRelease = validatePublicReleaseFiles({ ledgerPath: releaseLedgerPath, outputRoot: generatedRoot });
  invariant(
    releaseSurfaces.ledger.releases.at(-1).releaseId === publicRelease.current.releaseId,
    "Visible and generated release identities disagree"
  );

  const publishPaths = new Set();
  const staticPaths = new Set();
  const generatedPaths = new Set();
  const remotePaths = new Set();
  const files = manifest.publish.map((entry, index) => {
    invariant(isPlainObject(entry), `publish[${index}] must be an object`);
    requireExactSet(
      Object.keys(entry),
      ["local", "remote", "source"],
      `publish[${index}] fields`
    );
    invariant(
      entry.source === "source" || entry.source === "generated-release",
      `publish[${index}].source is invalid`
    );
    const local = requireRelativePath(entry.local, `publish[${index}].local`);
    const remote = requireRelativePath(entry.remote, `publish[${index}].remote`);
    invariant(local === remote, `publish[${index}] must preserve its canonical path`);
    invariant(!publishPaths.has(local), `Web deployment local path is duplicated: ${local}`);
    invariant(!remotePaths.has(remote), `Web deployment remote path is duplicated: ${remote}`);
    invariant(!/(?:^|\/)models(?:\/|$)/iu.test(remote), `Model path cannot be published: ${remote}`);
    invariant(!/\.slm(?:\.|$)/iu.test(remote), `Model bytes cannot be published: ${remote}`);
    publishPaths.add(local);
    remotePaths.add(remote);
    const sourceRoot = entry.source === "source" ? siteRoot : generatedRoot;
    const sourceSet = entry.source === "source" ? staticPaths : generatedPaths;
    sourceSet.add(local);
    const { filePath, stat } = containedFile(sourceRoot, local, `publish[${index}].local`);
    const fileBytes = fs.readFileSync(filePath);
    return Object.freeze({
      source: entry.source,
      local,
      remote,
      filePath,
      byteCount: stat.size,
      sha256: sha256(fileBytes)
    });
  });

  requireExactSet(staticPaths, expectedStaticPaths(siteRoot), "Web deployment source closure");
  requireExactSet(generatedPaths, generatedReleasePaths, "Generated release closure");

  const shell = verifyShells(siteRoot);
  const shellAssetPaths = shell.references.map(
    (reference) => `app/${reference.reference.slice(2)}`
  );
  for (const requiredPath of [
    ...shellAssetPaths,
    "app/browser-model-admission.js",
    "app/memory-endpoints-enrollment.js",
    "app/site-release.js",
    "browser-runtime/tinyrustlm-browser-runtime.wasm",
    "browser-runtime/tinyrustlm-browser-runtime.wasm.manifest.json",
    "updates/updates.css",
    "companion/index.html",
    "updates/index.html",
    ...generatedReleasePaths
  ]) {
    invariant(publishPaths.has(requiredPath), `Required web artifact is absent: ${requiredPath}`);
  }

  const orderedPaths = manifest.publish.map((entry) => entry.remote);
  invariant(orderedPaths[0] === ".htaccess", "Web deployment must publish host policy first");
  invariant(
    JSON.stringify(orderedPaths.slice(-5)) ===
      JSON.stringify([
        "updates/index.html",
        "app/index.html",
        "index.html",
        generatedReleasePaths[0],
        generatedReleasePaths[1]
      ]),
    "Web deployment must finish with HTML, release history, and the current-release marker"
  );
  const firstHtmlPosition = Math.min(
    orderedPaths.indexOf("companion/index.html"),
    orderedPaths.indexOf("updates/index.html")
  );
  for (const dependency of [
    ...shellAssetPaths,
    "browser-runtime/tinyrustlm-browser-runtime.wasm",
    "browser-runtime/tinyrustlm-browser-runtime.wasm.manifest.json",
    "updates/updates.css"
  ]) {
    invariant(
      orderedPaths.indexOf(dependency) > 0 && orderedPaths.indexOf(dependency) < firstHtmlPosition,
      `Web dependency must be published before HTML: ${dependency}`
    );
  }
  invariant(
    orderedPaths.at(-2) === generatedReleasePaths[0] &&
      orderedPaths.at(-1) === generatedReleasePaths[1],
    "Current-release JSON must be the final publication commit marker"
  );

  const hostPolicy = fs.readFileSync(
    containedFile(siteRoot, ".htaccess", "Web host policy").filePath,
    "utf8"
  );
  validateHostPolicy(hostPolicy);

  validateRetirementClosure(manifest.retire, remotePaths);

  return Object.freeze({
    manifest: Object.freeze(manifest),
    manifestPath,
    manifestSha256: sha256(manifestBytes),
    siteRoot,
    generatedRoot,
    releaseLedgerPath,
    currentRelease: publicRelease.current,
    releaseHistory: publicRelease.history,
    files: Object.freeze(files),
    totalByteCount: files.reduce((total, file) => total + file.byteCount, 0)
  });
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const positional = args.filter((argument) => argument !== "--json");
  invariant(
    positional.length === 3,
    "Usage: web-deployment-manifest.js <site-root> <manifest> <generated-release-root> [--json]"
  );
  const result = validateWebDeploymentManifest({
    siteRoot: positional[0],
    manifestPath: positional[1],
    generatedRoot: positional[2]
  });
  if (json) {
    process.stdout.write(`${JSON.stringify({
      schema: manifestSchema,
      status: "pass",
      deploymentScope,
      publicOrigin,
      manifestSha256: result.manifestSha256,
      releaseId: result.currentRelease.releaseId,
      publicationId: result.currentRelease.publicationId,
      fileCount: result.files.length,
      totalByteCount: result.totalByteCount,
      files: result.files.map(({ source, local, remote, byteCount, sha256: digest }) => ({
        source,
        local,
        remote,
        byteCount,
        sha256: digest
      }))
    })}\n`);
  } else {
    process.stdout.write(
      `TinyRustLM web deployment closure passed for ${result.files.length} files ` +
        `(${result.totalByteCount} bytes)\n`
    );
  }
}

if (require.main === module) {
  try {
    main();
  } catch {
    process.stderr.write("TinyRustLM web deployment manifest validation failed\n");
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  deploymentScope,
  generatedReleasePaths,
  manifestSchema,
  publicOrigin,
  releaseLedgerRelativePath,
  retiredPublicPaths,
  validateHostPolicy,
  validateRetirementClosure,
  validateWebDeploymentManifest
});
