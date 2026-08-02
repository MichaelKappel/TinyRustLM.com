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
  return Object.freeze({ references, rootShell: expectedRootShell, appShell });
}

function writeShells(root) {
  const locations = shellPaths(root);
  const appShell = stampCanonicalShell(readShell(locations.appIndexPath), locations.appRoot);
  const rootShell = renderRootShell(appShell);
  atomicReplace(locations.appIndexPath, appShell);
  atomicReplace(locations.rootIndexPath, rootShell);
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
  renderRootShell,
  stampCanonicalShell,
  verifyShells,
  writeShells
});
