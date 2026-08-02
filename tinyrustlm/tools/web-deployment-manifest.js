#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const {
  assertSafeDirectoryAncestry,
  assertSafeRegularFile
} = require("./immutable-publication-files.js");
const { verifyShells } = require("./static-shell-parity.js");

const manifestSchema = "tinyrustlm.web_deployment_manifest.v1";
const publicOrigin = "https://tinyrustlm.com";
const deploymentScope = "browser-runtime-no-model-bytes";
const retiredPublicPaths = Object.freeze([
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
      !/^[A-Za-z]:/.test(relativePath),
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
    containment &&
      !containment.startsWith("..") &&
      !path.isAbsolute(containment),
    `${label} escapes the TinyRustLM site root`
  );
  try {
    return assertSafeRegularFile(filePath);
  } catch {
    throw new Error(`${label} is missing or unsafe`);
  }
}

function listRegularFiles(directory, predicate) {
  assertSafeDirectoryAncestry(directory);
  const directoryStat = fs.lstatSync(directory);
  invariant(
    directoryStat.isDirectory() && !directoryStat.isSymbolicLink(),
    "Web deployment source directory is missing or unsafe"
  );
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function expectedPublishPaths(siteRoot) {
  const appFiles = listRegularFiles(
    path.join(siteRoot, "app"),
    (name) => /\.(?:css|html|js)$/.test(name)
  ).map((name) => `app/${name}`);
  const runtimeFiles = listRegularFiles(
    path.join(siteRoot, "runtime"),
    (name) => /^tinyrustlm(?:-simd)?\.wasm(?:\.manifest)?$/.test(name)
  ).map((name) => `runtime/${name}`);
  return Object.freeze([".htaccess", ...appFiles, "index.html", ...runtimeFiles].sort());
}

function requireExactSet(actualValues, expectedValues, label) {
  const actual = Array.from(actualValues).sort();
  const expected = Array.from(expectedValues).sort();
  invariant(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label} is incomplete or contains an undeclared path\n` +
      `actual: ${JSON.stringify(actual)}\nexpected: ${JSON.stringify(expected)}`
  );
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
    /Header set Cache-Control "no-cache, must-revalidate"/.test(hostPolicy),
    "Web host policy must revalidate mutable public paths"
  );
  invariant(
    /RewriteRule \(\^\|\/\)\.\*\\\.slm\$ - \[R=404,L,NC\]/.test(hostPolicy) &&
      /RewriteRule \(\^\|\/\)models\(\/\|\$\) - \[R=404,L,NC\]/.test(hostPolicy),
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

function validateWebDeploymentManifest(options = {}) {
  const siteRoot = path.resolve(options.siteRoot || path.join(__dirname, ".."));
  const manifestPath = path.resolve(
    options.manifestPath ||
      path.join(siteRoot, "deploy", "web-deployment-manifest.v1.json")
  );
  assertSafeDirectoryAncestry(siteRoot);
  const siteStat = fs.lstatSync(siteRoot);
  invariant(
    siteStat.isDirectory() && !siteStat.isSymbolicLink(),
    "TinyRustLM site root is missing or unsafe"
  );
  let manifestBytes;
  try {
    manifestBytes = fs.readFileSync(assertSafeRegularFile(manifestPath).filePath);
  } catch {
    throw new Error("Web deployment manifest is unavailable");
  }
  let manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString("utf8"));
  } catch (error) {
    throw new Error(`Web deployment manifest is not valid JSON: ${error.message}`);
  }

  invariant(isPlainObject(manifest), "Web deployment manifest must be an object");
  requireExactSet(
    Object.keys(manifest),
    ["deploymentScope", "publicOrigin", "publish", "retire", "schema"],
    "Web deployment manifest fields"
  );
  invariant(manifest.schema === manifestSchema, "Web deployment manifest schema is invalid");
  invariant(manifest.publicOrigin === publicOrigin, "Web deployment public origin is invalid");
  invariant(
    manifest.deploymentScope === deploymentScope,
    "Web deployment scope is invalid"
  );
  invariant(
    Array.isArray(manifest.publish) && manifest.publish.length > 0 && manifest.publish.length <= 64,
    "Web deployment publish list is invalid"
  );
  invariant(
    Array.isArray(manifest.retire) && manifest.retire.length > 0 && manifest.retire.length <= 64,
    "Web deployment retirement list is invalid"
  );

  const publishPaths = new Set();
  const remotePaths = new Set();
  const files = manifest.publish.map((entry, index) => {
    invariant(isPlainObject(entry), `publish[${index}] must be an object`);
    requireExactSet(Object.keys(entry), ["local", "remote"], `publish[${index}] fields`);
    const local = requireRelativePath(entry.local, `publish[${index}].local`);
    const remote = requireRelativePath(entry.remote, `publish[${index}].remote`);
    invariant(local === remote, `publish[${index}] must preserve its canonical path`);
    invariant(!publishPaths.has(local), `Web deployment local path is duplicated: ${local}`);
    invariant(!remotePaths.has(remote), `Web deployment remote path is duplicated: ${remote}`);
    invariant(!/(?:^|\/)models(?:\/|$)/i.test(remote), `Model path cannot be published: ${remote}`);
    invariant(!/\.slm(?:\.|$)/i.test(remote), `Model bytes cannot be published: ${remote}`);
    publishPaths.add(local);
    remotePaths.add(remote);
    const { filePath, stat } = containedFile(siteRoot, local, `publish[${index}].local`);
    const bytes = fs.readFileSync(filePath);
    return Object.freeze({
      local,
      remote,
      byteCount: stat.size,
      sha256: sha256(bytes)
    });
  });

  requireExactSet(publishPaths, expectedPublishPaths(siteRoot), "Web deployment publication closure");

  const shell = verifyShells(siteRoot);
  const shellAssetPaths = shell.references.map(
    (reference) => `app/${reference.reference.slice(2)}`
  );
  for (const shellAssetPath of shellAssetPaths) {
    invariant(
      publishPaths.has(shellAssetPath),
      `Static shell asset is absent from the deployment: ${shellAssetPath}`
    );
  }
  for (const requiredPath of [
    "app/browser-model-admission.js",
    "app/memory-endpoints-enrollment.js",
    "runtime/tinyrustlm.wasm",
    "runtime/tinyrustlm-simd.wasm",
    "runtime/tinyrustlm.wasm.manifest",
    "runtime/tinyrustlm-simd.wasm.manifest"
  ]) {
    invariant(publishPaths.has(requiredPath), `Required web artifact is absent: ${requiredPath}`);
  }
  const orderedPaths = manifest.publish.map((entry) => entry.remote);
  invariant(orderedPaths[0] === ".htaccess", "Web deployment must publish host policy first");
  invariant(
    orderedPaths.at(-2) === "app/index.html" && orderedPaths.at(-1) === "index.html",
    "Web deployment must publish both HTML entry points last"
  );
  const appIndexPosition = orderedPaths.indexOf("app/index.html");
  for (const assetPath of [
    ...shellAssetPaths,
    "runtime/tinyrustlm.wasm",
    "runtime/tinyrustlm-simd.wasm",
    "runtime/tinyrustlm.wasm.manifest",
    "runtime/tinyrustlm-simd.wasm.manifest"
  ]) {
    invariant(
      orderedPaths.indexOf(assetPath) > 0 &&
        orderedPaths.indexOf(assetPath) < appIndexPosition,
      `Web dependency must be published before HTML: ${assetPath}`
    );
  }
  const hostPolicy = fs.readFileSync(
    containedFile(siteRoot, ".htaccess", "Web host policy").filePath,
    "utf8"
  );
  validateHostPolicy(hostPolicy);

  const retirePaths = new Set();
  manifest.retire.forEach((entry, index) => {
    invariant(isPlainObject(entry), `retire[${index}] must be an object`);
    requireExactSet(Object.keys(entry), ["remote"], `retire[${index}] fields`);
    const remote = requireRelativePath(entry.remote, `retire[${index}].remote`);
    invariant(!retirePaths.has(remote), `Retired public path is duplicated: ${remote}`);
    invariant(!remotePaths.has(remote), `Published and retired paths overlap: ${remote}`);
    retirePaths.add(remote);
  });
  requireExactSet(retirePaths, retiredPublicPaths, "Web deployment retired-path closure");

  return Object.freeze({
    manifest: Object.freeze(manifest),
    manifestPath,
    manifestSha256: sha256(manifestBytes),
    siteRoot,
    files: Object.freeze(files),
    totalByteCount: files.reduce((total, file) => total + file.byteCount, 0)
  });
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const positional = args.filter((argument) => argument !== "--json");
  invariant(positional.length <= 2, "Usage: web-deployment-manifest.js [site-root] [manifest] [--json]");
  const result = validateWebDeploymentManifest({
    siteRoot: positional[0],
    manifestPath: positional[1]
  });
  if (json) {
    process.stdout.write(`${JSON.stringify({
      schema: manifestSchema,
      status: "pass",
      deploymentScope,
      publicOrigin,
      manifestSha256: result.manifestSha256,
      fileCount: result.files.length,
      totalByteCount: result.totalByteCount,
      files: result.files
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
  } catch (error) {
    process.stderr.write("TinyRustLM web deployment manifest validation failed\n");
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  deploymentScope,
  manifestSchema,
  publicOrigin,
  retiredPublicPaths,
  validateHostPolicy,
  validateWebDeploymentManifest
});
