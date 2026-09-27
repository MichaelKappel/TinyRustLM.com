#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const {
  assertSafeDirectoryAncestry,
  assertSafeRegularFile
} = require("./immutable-publication-files.js");
const {
  canonicalJson,
  materializeReleaseState,
  parseReleaseLedger,
  validatePublicReleaseFiles
} = require("./site-release-contract.js");
const { verifyReleaseSurfaces } = require("./site-release-page.js");
const { verifyShells } = require("./static-shell-parity.js");
const { requireCanonicalSiteRoot, requireCanonicalArtifactPath } =
  require("./canonical-operation-scratch.js");

const manifestSchema = "tinyrustlm.web_deployment_manifest.v2";
const publicOrigin = "https://tinyrustlm.com";
const deploymentScope = "browser-runtime-no-model-bytes";
const deploymentInputSchema = "tinyrustlm.web_deployment_input.v1";
const operationOwnerSchema = "tinyrustlm.deployment_operation_owner.v1";
const operationOwnerFileName = "operation-owner.v1.json";
const releaseLedgerRelativePath = "release/site-release-ledger.v1.json";
const maximumDeploymentFileBytes = 256 * 1024 * 1024;
const maximumDeploymentTotalBytes = 512 * 1024 * 1024;
const maximumDeploymentFiles = 96;
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

function sameFileSystemIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function relativeOperationPath(operationRoot, candidatePath, label) {
  const absolute = path.resolve(candidatePath);
  const relative = path.relative(operationRoot, absolute);
  invariant(
    relative && !relative.startsWith("..") && !path.isAbsolute(relative),
    `${label} escaped its operation-owned root`
  );
  return relative.split(path.sep).join("/");
}

function operationOwnerRecord(operationRoot, prefix, operationKind) {
  const leaf = path.basename(operationRoot);
  invariant(
    new RegExp(`^${prefix}[0-9a-f]{32}$`, "u").test(leaf),
    "Deployment operation owner identity is invalid"
  );
  return Object.freeze({
    schema: operationOwnerSchema,
    operationKind,
    operationId: leaf.slice(prefix.length)
  });
}

function verifyOperationOwner(operationRoot, prefix, operationKind) {
  requireSafeDirectory(operationRoot, "Deployment operation root");
  const expected = operationOwnerRecord(operationRoot, prefix, operationKind);
  const ownerPath = path.join(operationRoot, operationOwnerFileName);
  const ownerFile = readSafeRegularFile(ownerPath, 4096);
  invariant(ownerFile.stat.size > 0,
  "Deployment operation owner marker is unsafe");
  invariant(ownerFile.bytes.equals(Buffer.from(canonicalJson(expected), "utf8")),
    "Deployment operation owner marker changed");
  return Object.freeze({
    ...expected,
    filePath: ownerFile.filePath,
    byteCount: ownerFile.bytes.length,
    sha256: ownerFile.sha256,
    stat: ownerFile.stat
  });
}

function listRegularFiles(directory, predicate) {
  requireSafeDirectory(directory, "Web deployment source directory");
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => entry.name)
    .sort();
}

/** Inventory current web assets while keeping explicitly retired files out of publication. */
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
  const siteRoot = requireCanonicalSiteRoot(options.siteRoot);
  const manifestPath = path.resolve(
    options.manifestPath || path.join(siteRoot, "deploy", "web-deployment-manifest.v2.json")
  );
  const generatedRoot = requireCanonicalArtifactPath(options.generatedRoot);
  requireSafeDirectory(siteRoot, "TinyRustLM site root");
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
    const observed = sha256File(filePath, maximumDeploymentFileBytes, stat);
    return Object.freeze({
      source: entry.source,
      local,
      remote,
      filePath,
      byteCount: observed.byteCount,
      sha256: observed.sha256
    });
  });

  requireExactSet(staticPaths, expectedStaticPaths(siteRoot), "Web deployment source closure");
  requireExactSet(generatedPaths, generatedReleasePaths, "Generated release closure");
  validateRetirementClosure(manifest.retire, remotePaths);

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

/** Bind canonical publication identities in memory without copying any source files. */
function bindDeploymentInput(options = {}) {
  invariant(isPlainObject(options) && Object.keys(options).every((key) =>
    ["siteRoot", "manifestPath", "generatedRoot"].includes(key)),
  "Deployment input options are invalid");
  const validation = validateWebDeploymentManifest(options);
  invariant(validation.files.length <= maximumDeploymentFiles &&
    validation.totalByteCount <= maximumDeploymentTotalBytes &&
    validation.files.every((file) => file.byteCount > 0),
  "Deployment input exceeds its publication bounds");
  const body = {
    schema: deploymentInputSchema,
    deploymentScope,
    publicOrigin,
    manifestSha256: validation.manifestSha256,
    releaseId: validation.currentRelease.releaseId,
    publicationId: validation.currentRelease.publicationId,
    fileCount: validation.files.length,
    totalByteCount: validation.totalByteCount,
    files: validation.files.map(({ source, local, remote, byteCount, sha256: digest }) =>
      Object.freeze({ source, local, remote, byteCount, sha256: digest }))
  };
  const inputId = sha256(Buffer.from(canonicalJson(body), "utf8"));
  return Object.freeze({ validation, input: Object.freeze({ ...body,
    files: Object.freeze(body.files), inputId, status: "pass" }) });
}

/** Re-read the canonical closure and reject changes to its previously bound identity. */
function verifyDeploymentInput(options = {}) {
  const { expectedInputId, ...inputOptions } = options;
  invariant(/^[0-9a-f]{64}$/u.test(String(expectedInputId)),
    "Deployment input identity is invalid");
  const result = bindDeploymentInput(inputOptions);
  invariant(result.input.inputId === expectedInputId,
    "Deployment input changed after binding");
  return result;
}

function openBoundRegularFile(filePath, expectedStat = null) {
  const inspected = assertSafeRegularFile(path.resolve(filePath));
  invariant(inspected.stat.nlink === 1, "Deployment file is not independently owned");
  const descriptor = fs.openSync(inspected.filePath, "r");
  try {
    const openedStat = fs.fstatSync(descriptor);
    invariant(openedStat.isFile() && openedStat.nlink === 1 &&
      sameFileSystemIdentity(openedStat, inspected.stat) &&
      (!expectedStat || sameFileSystemIdentity(openedStat, expectedStat)),
    "Deployment file identity changed while opening");
    return Object.freeze({ descriptor, filePath: inspected.filePath, stat: openedStat });
  } catch (error) {
    fs.closeSync(descriptor);
    throw error;
  }
}

function sha256File(filePath, maximumBytes = maximumDeploymentFileBytes, expectedStat = null) {
  const opened = openBoundRegularFile(filePath, expectedStat);
  const { descriptor } = opened;
  const hash = crypto.createHash("sha256");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  let byteCount = 0;
  try {
    invariant(opened.stat.size >= 0 && opened.stat.size <= maximumBytes,
      "Deployment file exceeds its byte limit");
    for (;;) {
      const count = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      byteCount += count;
      invariant(byteCount <= maximumBytes, "Deployment operation file exceeds its byte limit");
      hash.update(buffer.subarray(0, count));
    }
    const finalDescriptorStat = fs.fstatSync(descriptor);
    const finalPath = assertSafeRegularFile(opened.filePath);
    invariant(finalDescriptorStat.isFile() && finalDescriptorStat.nlink === 1 &&
      finalDescriptorStat.size === byteCount &&
      sameFileSystemIdentity(finalDescriptorStat, opened.stat) &&
      sameFileSystemIdentity(finalPath.stat, opened.stat),
    "Deployment file identity changed while reading");
  } finally {
    fs.closeSync(descriptor);
  }
  return Object.freeze({
    filePath: opened.filePath,
    stat: opened.stat,
    byteCount,
    sha256: hash.digest("hex")
  });
}

function readSafeRegularFile(filePath, maximumBytes) {
  const identity = sha256File(filePath, maximumBytes);
  const opened = openBoundRegularFile(identity.filePath, identity.stat);
  try {
    const bytes = Buffer.alloc(identity.byteCount);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(
        opened.descriptor,
        bytes,
        offset,
        bytes.length - offset,
        offset
      );
      invariant(count > 0, "Deployment file became truncated while reading");
      offset += count;
    }
    invariant(sha256(bytes) === identity.sha256,
      "Deployment file changed between bounded reads");
    const finalStat = fs.fstatSync(opened.descriptor);
    const finalPath = assertSafeRegularFile(opened.filePath);
    invariant(finalStat.size === identity.byteCount && finalStat.nlink === 1 &&
      sameFileSystemIdentity(finalStat, identity.stat) &&
      sameFileSystemIdentity(finalPath.stat, identity.stat),
    "Deployment file identity changed during bounded read");
    return Object.freeze({
      filePath: opened.filePath,
      stat: finalStat,
      bytes,
      byteCount: bytes.length,
      sha256: identity.sha256
    });
  } finally {
    fs.closeSync(opened.descriptor);
  }
}

function requireOperationRoot({ repositoryRoot, operationRoot, prefix, label }) {
  invariant(path.isAbsolute(String(repositoryRoot || "")), `${label} repository root is invalid`);
  invariant(path.isAbsolute(String(operationRoot || "")), `${label} root must be absolute`);
  const canonicalRepository = path.resolve(repositoryRoot);
  const canonicalOperation = path.resolve(operationRoot);
  requireCanonicalSiteRoot(path.join(canonicalRepository, "tinyrustlm"));
  requireSafeDirectory(canonicalRepository, `${label} repository root`);
  requireCanonicalArtifactPath(canonicalOperation);
  invariant(
    new RegExp(`^${prefix}[0-9a-f]{32}$`, "u").test(path.basename(canonicalOperation)),
    `${label} root is not operation-owned`
  );
  assertSafeDirectoryAncestry(path.dirname(canonicalOperation));
  return Object.freeze({
    repositoryRoot: canonicalRepository,
    operationRoot: canonicalOperation
  });
}

function createOwnedOperationRoot(operationRoot, prefix, operationKind) {
  invariant(!fs.existsSync(operationRoot), "Operation-owned deployment root already exists");
  fs.mkdirSync(operationRoot, { mode: 0o700 });
  const rootStat = fs.lstatSync(operationRoot);
  try {
    requireSafeDirectory(operationRoot, "Operation-owned deployment root");
    const owner = operationOwnerRecord(operationRoot, prefix, operationKind);
    const ownerPath = path.join(operationRoot, operationOwnerFileName);
    const descriptor = fs.openSync(ownerPath, "wx", 0o400);
    try {
      fs.writeFileSync(descriptor, Buffer.from(canonicalJson(owner), "utf8"));
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    fs.chmodSync(ownerPath, 0o400);
    return verifyOperationOwner(operationRoot, prefix, operationKind);
  } catch (error) {
    try {
      const currentRoot = fs.lstatSync(operationRoot);
      invariant(currentRoot.isDirectory() && !currentRoot.isSymbolicLink() &&
        sameFileSystemIdentity(currentRoot, rootStat),
      "Operation-owned deployment root changed during owner creation");
      const entries = fs.readdirSync(operationRoot);
      invariant(entries.length === 0 ||
        (entries.length === 1 && entries[0] === operationOwnerFileName),
      "Operation-owned deployment root gained unexpected content");
      if (entries.length === 1) {
        const ownerPath = path.join(operationRoot, operationOwnerFileName);
        const ownerStat = fs.lstatSync(ownerPath);
        invariant(ownerStat.isFile() && !ownerStat.isSymbolicLink() && ownerStat.nlink === 1,
          "Operation owner marker changed during creation cleanup");
        fs.chmodSync(ownerPath, 0o600);
        fs.unlinkSync(ownerPath);
      }
      const deletionRoot = fs.lstatSync(operationRoot);
      invariant(sameFileSystemIdentity(deletionRoot, rootStat) &&
        fs.readdirSync(operationRoot).length === 0,
      "Operation-owned deployment root changed before cleanup");
      fs.rmdirSync(operationRoot);
    } catch {
      throw new Error("Deployment operation owner creation cleanup failed", { cause: error });
    }
    throw error;
  }
}

function walkOwnedTree(root) {
  const files = new Map();
  const directories = new Set();
  const directoryStats = new Map();
  let entryCount = 0;
  function visit(directoryPath, relativeDirectory) {
    const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
    for (const entry of entries) {
      entryCount += 1;
      invariant(entryCount <= 512, "Deployment operation inventory exceeds its entry limit");
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      const absolutePath = path.join(directoryPath, entry.name);
      const stat = fs.lstatSync(absolutePath);
      invariant(!stat.isSymbolicLink(), "Deployment operation contains a symbolic link");
      if (stat.isDirectory()) {
        directories.add(relativePath);
        directoryStats.set(relativePath, stat);
        visit(absolutePath, relativePath);
      } else {
        invariant(stat.isFile() && stat.nlink === 1,
          "Deployment operation contains a non-owned file");
        files.set(relativePath, Object.freeze({ filePath: absolutePath, stat }));
      }
    }
  }
  visit(root, "");
  return Object.freeze({ files, directories, directoryStats });
}

function assertExactOwnedInventory(operationRoot, expectedFiles, expectedDirectories, label) {
  requireSafeDirectory(operationRoot, `${label} root`);
  const inventory = walkOwnedTree(operationRoot);
  requireExactSet(inventory.files.keys(), expectedFiles, `${label} file inventory`);
  requireExactSet(
    inventory.directories,
    expectedDirectories,
    `${label} directory inventory`
  );
  return inventory;
}

function assertOwnedFileAtDeletion(operationRoot, relativePath, expected, label) {
  requireSafeDirectory(operationRoot, `${label} root`);
  const candidate = path.join(operationRoot, ...relativePath.split("/"));
  invariant(
    relativeOperationPath(operationRoot, candidate, label) === relativePath,
    `${label} path identity changed`
  );
  const file = assertSafeRegularFile(candidate);
  invariant(file.stat.nlink === 1, `${label} is not independently owned`);
  if (expected.stat) {
    invariant(sameFileSystemIdentity(file.stat, expected.stat),
      `${label} filesystem identity changed`);
  }
  if (expected.byteCount !== undefined || expected.sha256 !== undefined) {
    const identity = sha256File(file.filePath);
    invariant(expected.byteCount === undefined || identity.byteCount === expected.byteCount,
      `${label} byte count changed`);
    invariant(expected.sha256 === undefined || identity.sha256 === expected.sha256,
      `${label} hash changed`);
  }
  requireSafeDirectory(operationRoot, `${label} root`);
  const deletionStat = fs.lstatSync(file.filePath);
  invariant(deletionStat.isFile() && !deletionStat.isSymbolicLink() &&
    deletionStat.nlink === 1 && sameFileSystemIdentity(deletionStat, file.stat),
  `${label} changed at deletion time`);
  return file.filePath;
}

function assertOwnedDirectoryAtDeletion(operationRoot, relativePath, expectedStat, label) {
  requireSafeDirectory(operationRoot, `${label} root`);
  const candidate = path.join(operationRoot, ...relativePath.split("/"));
  invariant(
    relativeOperationPath(operationRoot, candidate, label) === relativePath,
    `${label} path identity changed`
  );
  assertSafeDirectoryAncestry(candidate);
  const stat = fs.lstatSync(candidate);
  invariant(stat.isDirectory() && !stat.isSymbolicLink() &&
    (!expectedStat || sameFileSystemIdentity(stat, expectedStat)) &&
    fs.readdirSync(candidate).length === 0,
  `${label} changed at deletion time`);
  return candidate;
}

// Materialize the latest recorded publication from the canonical ledger, pending or finalized.
function materializeExpectedPublicPredecessor(options = {}) {
  const roots = requireOperationRoot({
    repositoryRoot: options.repositoryRoot,
    operationRoot: options.outputRoot,
    prefix: "tinyrustlm-web-predecessor-",
    label: "Public predecessor oracle"
  });
  invariant(!fs.existsSync(roots.operationRoot), "Public predecessor oracle root already exists");
  const canonicalLedgerPath = path.join(
    roots.repositoryRoot,
    "tinyrustlm",
    releaseLedgerRelativePath.replace(/\//g, path.sep)
  );
  invariant(path.resolve(String(options.ledgerPath || "")) === canonicalLedgerPath,
    "Public predecessor oracle requires the canonical release ledger");
  const ledgerFile = assertSafeRegularFile(canonicalLedgerPath);
  invariant(ledgerFile.stat.size > 0 && ledgerFile.stat.size <= 1024 * 1024,
    "Public predecessor release ledger is oversized");
  const ledgerBytes = readSafeRegularFile(canonicalLedgerPath, 1024 * 1024);
  invariant(sameFileSystemIdentity(ledgerBytes.stat, ledgerFile.stat),
    "Public predecessor release ledger identity changed");
  const ledgerResult = parseReleaseLedger(ledgerBytes.bytes);
  const pending = ledgerResult.pendingRelease;
  const predecessor = ledgerResult.ledger.releases.at(pending ? -2 : -1);
  const publication = ledgerResult.ledger.publications.at(-1);
  invariant(predecessor && publication?.releaseId === predecessor.releaseId &&
    ledgerResult.ledger.publications.length ===
      ledgerResult.ledger.releases.length - (pending ? 1 : 0),
  "Public predecessor publication sequence is invalid");
  const predecessorLedger = Object.freeze({
    schema: ledgerResult.ledger.schema,
    site: ledgerResult.ledger.site,
    releases: Object.freeze(pending ? ledgerResult.ledger.releases.slice(0, -1)
      : ledgerResult.ledger.releases),
    publications: ledgerResult.ledger.publications
  });
  const predecessorLedgerBytes = Buffer.from(canonicalJson(predecessorLedger), "utf8");
  const predecessorLedgerSha256 = sha256(predecessorLedgerBytes);
  let operationOwner;
  let rootStat;

  try {
    operationOwner = createOwnedOperationRoot(
      roots.operationRoot,
      "tinyrustlm-web-predecessor-",
      "public-predecessor-oracle"
    );
    rootStat = fs.lstatSync(roots.operationRoot);
    const ledgerPrefixPath = path.join(roots.operationRoot, "predecessor-ledger.v1.json");
    fs.writeFileSync(ledgerPrefixPath, predecessorLedgerBytes, { flag: "wx", mode: 0o600 });
    const publicRoot = path.join(roots.operationRoot, "public");
    const materialized = materializeReleaseState({
      ledgerPath: ledgerPrefixPath,
      outputRoot: publicRoot
    });
    fs.unlinkSync(ledgerPrefixPath);
    invariant(materialized.current.releaseId === predecessor.releaseId &&
      materialized.current.version === predecessor.version &&
      materialized.history.releases.at(-1).publicationId === publication.publicationId,
    "Materialized public predecessor identity is invalid");
    const files = Object.freeze(materialized.files.map((entry) => Object.freeze({
      relativePath: entry.relativePath,
      filePath: entry.filePath,
      byteCount: entry.byteCount,
      sha256: entry.sha256
    })));
    return Object.freeze({
      predecessorReleaseId: predecessor.releaseId,
      predecessorVersion: predecessor.version,
      predecessorPublicationId: publication.publicationId,
      pendingReleaseId: pending?.releaseId || null,
      pendingVersion: pending?.version || null,
      predecessorLedgerSha256,
      outputRoot: roots.operationRoot,
      files
    });
  } catch (error) {
    const knownFiles = [
      path.join(roots.operationRoot, "predecessor-ledger.v1.json"),
      path.join(roots.operationRoot, "public", ".well-known", "site-release-history.json"),
      path.join(roots.operationRoot, "public", ".well-known", "site-release.json")
    ];
    try {
      if (operationOwner) {
        const verifiedOwner = verifyOperationOwner(
          roots.operationRoot,
          "tinyrustlm-web-predecessor-",
          "public-predecessor-oracle"
        );
        invariant(sameFileSystemIdentity(verifiedOwner.stat, operationOwner.stat),
          "Public predecessor oracle owner identity changed during partial cleanup");
        const inventory = walkOwnedTree(roots.operationRoot);
        const allowedFiles = new Set([
          operationOwnerFileName,
          "predecessor-ledger.v1.json",
          "public/.well-known/site-release-history.json",
          "public/.well-known/site-release.json"
        ]);
        const allowedDirectories = new Set(["public", "public/.well-known"]);
        invariant(Array.from(inventory.files.keys()).every((entry) => allowedFiles.has(entry)) &&
          Array.from(inventory.directories).every((entry) => allowedDirectories.has(entry)),
        "Public predecessor oracle partial inventory is unexpected");
        for (const filePath of knownFiles) {
          if (!fs.existsSync(filePath)) continue;
          const relativePath = relativeOperationPath(
            roots.operationRoot,
            filePath,
            "Public predecessor oracle partial file"
          );
          const observed = inventory.files.get(relativePath);
          invariant(observed, "Public predecessor oracle partial file changed");
          fs.unlinkSync(assertOwnedFileAtDeletion(
            roots.operationRoot,
            relativePath,
            { stat: observed.stat },
            "Public predecessor oracle partial file"
          ));
        }
        const ownerPath = assertOwnedFileAtDeletion(
          roots.operationRoot,
          operationOwnerFileName,
          operationOwner,
          "Public predecessor oracle owner marker"
        );
        fs.chmodSync(ownerPath, 0o600);
        fs.unlinkSync(ownerPath);
        for (const relativeDirectory of ["public/.well-known", "public"]) {
          const directoryPath = path.join(
            roots.operationRoot,
            ...relativeDirectory.split("/")
          );
          if (!fs.existsSync(directoryPath)) continue;
          fs.rmdirSync(assertOwnedDirectoryAtDeletion(
            roots.operationRoot,
            relativeDirectory,
            inventory.directoryStats.get(relativeDirectory),
            "Public predecessor oracle partial directory"
          ));
        }
        const deletionRoot = fs.lstatSync(roots.operationRoot);
        invariant(sameFileSystemIdentity(deletionRoot, rootStat) &&
          fs.readdirSync(roots.operationRoot).length === 0,
        "Public predecessor oracle root changed at deletion time");
        fs.rmdirSync(roots.operationRoot);
      }
    } catch {
      throw new Error("Public predecessor oracle partial cleanup failed", { cause: error });
    }
    throw error;
  }
}

function inspectExpectedPublicPredecessor({ repositoryRoot, outputRoot, expectedFiles }) {
  const { operationRoot } = requireOperationRoot({
    repositoryRoot,
    operationRoot: outputRoot,
    prefix: "tinyrustlm-web-predecessor-",
    label: "Public predecessor oracle"
  });
  requireSafeDirectory(operationRoot, "Public predecessor oracle root");
  const owner = verifyOperationOwner(
    operationRoot,
    "tinyrustlm-web-predecessor-",
    "public-predecessor-oracle"
  );
  invariant(Array.isArray(expectedFiles) && expectedFiles.length === 2,
    "Public predecessor oracle file closure is invalid");
  const expectedPaths = new Set(generatedReleasePaths);
  const actualPaths = new Set();
  const files = expectedFiles.map((entry) => {
    const relativePath = requireRelativePath(entry.relativePath,
      "Public predecessor oracle relative path");
    invariant(expectedPaths.has(relativePath) && !actualPaths.has(relativePath),
      "Public predecessor oracle path closure is invalid");
    const filePath = path.join(operationRoot, "public", relativePath.replace(/\//g, path.sep));
    const file = assertSafeRegularFile(filePath);
    const identity = sha256File(file.filePath, 1024 * 1024);
    invariant(identity.byteCount === entry.byteCount && identity.sha256 === entry.sha256,
      "Public predecessor oracle bytes changed");
    actualPaths.add(relativePath);
    return Object.freeze({ ...entry, filePath: file.filePath });
  });
  requireExactSet(actualPaths, expectedPaths, "Public predecessor oracle file closure");
  const inventory = walkOwnedTree(operationRoot);
  requireExactSet(
    inventory.files.keys(),
    [
      operationOwnerFileName,
      ...generatedReleasePaths.map((entry) => `public/${entry}`)
    ],
    "Public predecessor oracle inventory"
  );
  requireExactSet(
    inventory.directories,
    ["public", "public/.well-known"],
    "Public predecessor oracle directory inventory"
  );
  return Object.freeze({
    operationRoot,
    operationOwner: owner,
    files: Object.freeze(files),
    inventory
  });
}

function removeExpectedPublicPredecessor(options = {}) {
  const oracle = inspectExpectedPublicPredecessor(options);
  const rootStat = fs.lstatSync(oracle.operationRoot);
  const expectedFiles = new Set(oracle.inventory.files.keys());
  const expectedDirectories = new Set(oracle.inventory.directories);
  for (const entry of oracle.files) {
    assertExactOwnedInventory(
      oracle.operationRoot,
      expectedFiles,
      expectedDirectories,
      "Public predecessor oracle cleanup"
    );
    const relativePath = `public/${entry.relativePath}`;
    const observed = oracle.inventory.files.get(relativePath);
    const filePath = assertOwnedFileAtDeletion(
      oracle.operationRoot,
      relativePath,
      {
        stat: observed.stat,
        byteCount: entry.byteCount,
        sha256: entry.sha256
      },
      "Public predecessor oracle cleanup file"
    );
    fs.chmodSync(filePath, 0o600);
    fs.unlinkSync(filePath);
    expectedFiles.delete(relativePath);
  }
  assertExactOwnedInventory(
    oracle.operationRoot,
    expectedFiles,
    expectedDirectories,
    "Public predecessor oracle cleanup"
  );
  const ownerPath = assertOwnedFileAtDeletion(
    oracle.operationRoot,
    operationOwnerFileName,
    oracle.operationOwner,
    "Public predecessor oracle owner marker"
  );
  fs.chmodSync(ownerPath, 0o600);
  fs.unlinkSync(ownerPath);
  expectedFiles.delete(operationOwnerFileName);
  for (const relativeDirectory of ["public/.well-known", "public"]) {
    assertExactOwnedInventory(
      oracle.operationRoot,
      expectedFiles,
      expectedDirectories,
      "Public predecessor oracle cleanup"
    );
    fs.rmdirSync(assertOwnedDirectoryAtDeletion(
      oracle.operationRoot,
      relativeDirectory,
      oracle.inventory.directoryStats.get(relativeDirectory),
      "Public predecessor oracle cleanup directory"
    ));
    expectedDirectories.delete(relativeDirectory);
  }
  assertExactOwnedInventory(
    oracle.operationRoot,
    expectedFiles,
    expectedDirectories,
    "Public predecessor oracle cleanup"
  );
  const deletionRoot = fs.lstatSync(oracle.operationRoot);
  invariant(deletionRoot.isDirectory() && !deletionRoot.isSymbolicLink() &&
    sameFileSystemIdentity(deletionRoot, rootStat) &&
    fs.readdirSync(oracle.operationRoot).length === 0,
  "Public predecessor oracle root changed at deletion time");
  fs.rmdirSync(oracle.operationRoot);
  invariant(!fs.existsSync(oracle.operationRoot), "Public predecessor oracle cleanup is incomplete");
  return Object.freeze({ cleanupVerified: true, fileCount: 2 });
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const positional = args.filter((argument) => argument !== "--json");
  if (positional[0] === "bind-input" && positional.length === 4) {
    const result = bindDeploymentInput({ siteRoot: positional[1],
      manifestPath: positional[2], generatedRoot: positional[3] });
    process.stdout.write(`${JSON.stringify(result.input)}\n`);
    return;
  }
  if (positional[0] === "verify-input" && positional.length === 5) {
    const result = verifyDeploymentInput({ siteRoot: positional[1],
      manifestPath: positional[2], generatedRoot: positional[3], expectedInputId: positional[4] });
    process.stdout.write(`${JSON.stringify(result.input)}\n`);
    return;
  }
  if (positional[0] === "predecessor" && positional.length === 4) {
    const result = materializeExpectedPublicPredecessor({
      repositoryRoot: positional[1],
      ledgerPath: positional[2],
      outputRoot: positional[3]
    });
    process.stdout.write(`${JSON.stringify({
      status: "pass",
      predecessorReleaseId: result.predecessorReleaseId,
      predecessorVersion: result.predecessorVersion,
      predecessorPublicationId: result.predecessorPublicationId,
      pendingReleaseId: result.pendingReleaseId,
      pendingVersion: result.pendingVersion,
      predecessorLedgerSha256: result.predecessorLedgerSha256,
      files: result.files.map(({ relativePath, byteCount, sha256: digest }) => ({
        relativePath,
        byteCount,
        sha256: digest
      }))
    })}\n`);
    return;
  }
  if (positional[0] === "remove-predecessor" && positional.length === 7) {
    invariant(/^[1-9][0-9]*$/u.test(positional[3]) &&
      /^[0-9a-f]{64}$/u.test(positional[4]) &&
      /^[1-9][0-9]*$/u.test(positional[5]) &&
      /^[0-9a-f]{64}$/u.test(positional[6]),
    "Public predecessor cleanup identities are invalid");
    const currentByteCount = Number(positional[3]);
    const historyByteCount = Number(positional[5]);
    invariant(Number.isSafeInteger(currentByteCount) && currentByteCount <= 1024 * 1024 &&
      Number.isSafeInteger(historyByteCount) && historyByteCount <= 1024 * 1024,
    "Public predecessor cleanup byte counts are invalid");
    const result = removeExpectedPublicPredecessor({
      repositoryRoot: positional[1],
      outputRoot: positional[2],
      expectedFiles: [
        Object.freeze({
          relativePath: ".well-known/site-release.json",
          byteCount: currentByteCount,
          sha256: positional[4]
        }),
        Object.freeze({
          relativePath: ".well-known/site-release-history.json",
          byteCount: historyByteCount,
          sha256: positional[6]
        })
      ]
    });
    process.stdout.write(`${JSON.stringify({
      status: "pass",
      cleanupVerified: result.cleanupVerified,
      fileCount: result.fileCount
    })}\n`);
    return;
  }
  invariant(
    positional.length === 3,
    "Usage: web-deployment-manifest.js <site-root> <manifest> " +
      "<generated-release-root> [--json]"
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
  bindDeploymentInput,
  deploymentInputSchema,
  verifyDeploymentInput,
  deploymentScope,
  generatedReleasePaths,
  manifestSchema,
  materializeExpectedPublicPredecessor,
  publicOrigin,
  releaseLedgerRelativePath,
  removeExpectedPublicPredecessor,
  retiredPublicPaths,
  validateRetirementClosure,
  validateHostPolicy,
  validateWebDeploymentManifest,
});
