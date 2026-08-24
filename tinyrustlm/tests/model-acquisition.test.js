"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = fs.readFileSync(path.join(__dirname, "..", "app", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "app", "index.html"), "utf8");
const bridge = fs.readFileSync(
  path.join(__dirname, "..", "app", "companion-bridge.js"),
  "utf8"
);
const companionGuide = fs.readFileSync(
  path.join(__dirname, "..", "..", "docs", "companion", "README.md"),
  "utf8"
);
const companionPage = fs.readFileSync(
  path.join(__dirname, "..", "companion", "index.html"),
  "utf8"
);
const updatesCss = fs.readFileSync(
  path.join(__dirname, "..", "updates", "updates.css")
);
const siteReleaseScript = fs.readFileSync(
  path.join(__dirname, "..", "app", "site-release.js")
);

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

test("Get model is P2P-first and conversion is companion-managed", () => {
  assert.match(app, /actionButton\("Get model", \(\) => getHfModel\(entry\)/);
  assert.match(
    app,
    /if \(view\.p2pMatch && canStartP2pImport\(view\.p2pMatch\)\) \{\s*return startCompanionImport\(view\.p2pMatch\);/
  );
  assert.match(app, /return startCompanionConversion\(entry\);/);
  assert.match(app, /client\.startConversion\(`\$\{JSON\.stringify\(request\)\}\\n`\)/);
  assert.match(app, /request_kind: "minimodel\.huggingface_conversion_request\.v1"/);
  assert.match(app, /url\.searchParams\.set\("blobs", "true"\)/);
  assert.match(app, /const revision = String\(detail\.sha\)\.toLowerCase\(\)/);
  assert.match(app, /sibling && sibling\.lfs && sibling\.lfs\.sha256/);
});

test("retired text and script handoffs cannot return to the chooser", () => {
  assert.doesNotMatch(app, /\.tinyrustlm-convert\.ps1/);
  assert.doesNotMatch(app, /\.tinyrustlm-conversion\.README\.txt/);
  assert.doesNotMatch(app, /Save P2P Import Kit/);
  assert.doesNotMatch(app, /Save P2P Share Kit/);
  assert.doesNotMatch(app, /minimodel-share-kit\.ps1/);
  assert.doesNotMatch(app, /minimodel-serve-peer-pieces\.ps1/);
  assert.doesNotMatch(app, /minimodel-peer-import\.ps1/);
  assert.doesNotMatch(app, /function hfConversionScript/);
  assert.doesNotMatch(app, /function saveHfConversionRequest/);
  assert.doesNotMatch(app, /minimodel\.huggingface_conversion_request\.v0/);
  assert.doesNotMatch(app, /importConversionRequestFile/);
  assert.doesNotMatch(app, /ShareMetadata|share metadata|share-metadata/);
  assert.doesNotMatch(html, /Share Metadata|share metadata|share-metadata/);
});

test("the browser routes companion acquisition to a truthful unavailable release", () => {
  assert.match(html, /id="companionPackageLink"[^>]+href="\/companion\/"/);
  assert.match(html, /id="companionPackageLink"[^>]+target="_blank"[^>]+rel="noopener noreferrer"/);
  assert.match(companionPage, /sole TinyRustLM companion is being rebuilt around SLM2/);
  assert.match(companionPage, /id="companionPackageStatus"[^>]*>Companion unavailable/);
  assert.match(companionPage, /id="companionDeploymentStatus"[^>]*>Release gate open/);
  assert.doesNotMatch(companionPage, /www\.nuget\.org\/packages\//);
  assert.doesNotMatch(companionPage, /dotnet\s+(?:add\s+package|tool\s+install)/i);
  assert.match(
    companionPage,
    new RegExp(`updates\\.css\\?v=sha256-${sha256(updatesCss)}`)
  );
  assert.match(
    companionPage,
    new RegExp(`site-release\\.js\\?v=sha256-${sha256(siteReleaseScript)}`)
  );
  assert.doesNotMatch(companionPage, /\.txt|\.ps1|conversion-request|share-kit/i);
  assert.match(companionGuide, /prelaunch and unavailable for installation/);
  assert.match(companionGuide, /No package URL, archive URL, tool command, or install command/);
  assert.match(companionGuide, /old public-package lane has been deleted/);
  assert.match(companionGuide, /canonical `tinyrustlm-convert` executable/);
  assert.doesNotMatch(companionGuide, /www\.nuget\.org\/packages\//);
  assert.doesNotMatch(companionGuide, /dotnet (?:add package|tool install)/);
  assert.doesNotMatch(companionGuide, /tinyrustlm-slm-pack/);
  assert.doesNotMatch(companionGuide, /existing Qwen q4 artifact is classified/);
  assert.doesNotMatch(companionGuide, /UAIX_NUGET_FEED|reviewed folder feed/);
});

test("the canonical bridge streams both receipt-checked runtime artifacts", () => {
  assert.match(bridge, /\/models\/\$\{id\}\/content/);
  assert.match(bridge, /\/models\/\$\{id\}\/composition/);
  assert.doesNotMatch(bridge, /\/v[0-9]+\//);
  assert.doesNotMatch(bridge, /X-TinyRustLM-Bridge-Version/);
  assert.match(bridge, /X-TinyRustLM-Artifact-Sha256/);
  assert.match(bridge, /X-TinyRustLM-Composition-Sha256/);
  assert.match(bridge, /expectedByteCount/);
});

test("P2P eligibility includes an immutable activation graph", () => {
  assert.match(
    app,
    /entry\.peerOfferRoute &&\s*entry\.composition &&\s*p2pImportBaseUrl\(entry\)/
  );
  assert.match(app, /catalogCompositionFromRaw/);
  assert.match(app, /composition_graph_sha256/);
});
