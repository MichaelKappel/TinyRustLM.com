#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { atomicReplace } = require("./durable-files.js");
const { parseReleaseLedger } = require("./site-release-contract.js");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function releaseEntryHtml(release, latestReleaseId) {
  const latest = release.releaseId === latestReleaseId;
  const changes = release.changes.map((change) => `          <li><span class="change-type">${escapeHtml(change.type)}</span><span>${escapeHtml(change.summary)}</span></li>`).join("\n");
  return `      <article class="release-entry" id="${escapeHtml(release.version)}">
        <div class="release-entry-header">
          <h3>Version <span${latest ? " data-release-version" : ""}>${escapeHtml(release.version)}</span></h3>
          <time${latest ? " data-release-date" : ""} datetime="${escapeHtml(release.releaseDate)}">${escapeHtml(release.releaseDate)}</time>
        </div>
        <p>${escapeHtml(release.summary)}</p>
        <ul class="change-list">
${changes}
        </ul>
      </article>`;
}

// Render ledger content with an explicit prepared or published status.
function renderUpdatesPage({ ledger, cssSha256, scriptSha256, releaseLabel }) {
  invariant(
    releaseLabel === "Prepared" || releaseLabel === "Released",
    "Release label must match publication state"
  );
  const latest = ledger.releases.at(-1);
  const entries = Array.from(ledger.releases)
    .reverse()
    .map((release) => releaseEntryHtml(release, latest.releaseId))
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="application-version" content="${escapeHtml(latest.version)}">
  <meta name="release-date" content="${escapeHtml(latest.releaseDate)}">
  <title>Updates | ${escapeHtml(ledger.site.name)}</title>
  <link rel="icon" href="data:,">
  <link rel="alternate" type="application/json" href="/.well-known/site-release.json" title="Current release">
  <link rel="alternate" type="application/json" href="/.well-known/site-release-history.json" title="Release history">
  <link rel="stylesheet" href="./updates.css?v=sha256-${cssSha256}">
</head>
<body>
  <header class="site-header">
    <div class="site-header-inner">
      <a class="brand" href="/">${escapeHtml(ledger.site.name)}</a>
      <a class="back-link" href="/">Return to local chat</a>
    </div>
  </header>
  <main>
    <section class="release-band" aria-labelledby="updates-title" data-site-release data-release-state="pending">
      <div class="release-band-inner">
        <p class="eyebrow">Release record</p>
        <h1 id="updates-title">TinyRustLM updates</h1>
        <p class="release-summary">${escapeHtml(latest.summary)}</p>
        <p class="release-facts">
          <span>Version <strong data-release-version>${escapeHtml(latest.version)}</strong></span>
          <span>${releaseLabel} <strong><time data-release-date datetime="${escapeHtml(latest.releaseDate)}">${escapeHtml(latest.releaseDate)}</time></strong></span>
          <span>Last published <strong><time data-release-published-at>Awaiting live verification</time></strong></span>
        </p>
      </div>
    </section>
    <section class="history" aria-labelledby="history-title">
      <div class="history-inner">
        <h2 id="history-title">Release history</h2>
${entries}
      </div>
    </section>
  </main>
  <footer class="site-footer">
    <div class="site-footer-inner">
      <span>${escapeHtml(ledger.site.name)} release information</span>
      <nav class="machine-links" aria-label="Machine-readable release records">
        <a href="/.well-known/site-release.json">Current release JSON</a>
        <a href="/.well-known/site-release-history.json">Release history JSON</a>
      </nav>
    </div>
  </footer>
  <script src="../app/site-release.js?v=sha256-${scriptSha256}"></script>
</body>
</html>
`;
}

function releasePaths(siteRoot) {
  const root = path.resolve(siteRoot);
  return Object.freeze({
    root,
    ledgerPath: path.join(root, "release", "site-release-ledger.v1.json"),
    cssPath: path.join(root, "updates", "updates.css"),
    scriptPath: path.join(root, "app", "site-release.js"),
    outputPath: path.join(root, "updates", "index.html"),
    companionPath: path.join(root, "companion", "index.html")
  });
}

// Derive public labels and asset identities from the current ledger.
function expectedPage(siteRoot) {
  const locations = releasePaths(siteRoot);
  const parsedLedger = parseReleaseLedger(fs.readFileSync(locations.ledgerPath));
  const ledger = parsedLedger.ledger;
  const releaseLabel = parsedLedger.pendingRelease ? "Prepared" : "Released";
  const cssSha256 = sha256File(locations.cssPath);
  const scriptSha256 = sha256File(locations.scriptPath);
  return Object.freeze({
    html: renderUpdatesPage({
      ledger,
      cssSha256,
      scriptSha256,
      releaseLabel
    }),
    cssSha256,
    scriptSha256,
    releaseLabel,
    locations,
    ledger
  });
}

function verifyUpdatesPage(siteRoot) {
  const expected = expectedPage(siteRoot);
  invariant(fs.existsSync(expected.locations.outputPath), "Updates page is missing");
  invariant(
    fs.readFileSync(expected.locations.outputPath, "utf8").replace(/\r\n/g, "\n") === expected.html,
    "Updates page has drifted from the release ledger"
  );
  return expected;
}

function requireOne(source, pattern, label) {
  const matches = source.match(pattern) || [];
  invariant(matches.length === 1, `${label} is missing or duplicated`);
}

// Update each unique companion release field without treating a candidate as published.
function stampCompanionPage(source, latest, cssSha256, scriptSha256, releaseLabel) {
  const normalized = source.replace(/\r\n/gu, "\n");
  const versionMetaPattern = /<meta name="application-version" content="[^"]+">/gu;
  const dateMetaPattern = /<meta name="release-date" content="[^"]+">/gu;
  const versionPattern = /data-release-version>[^<]+<\/span>/gu;
  const datePattern = /data-release-date datetime="[^"]+">[^<]+<\/time>/gu;
  const releaseLabelPattern = /<span>(?:Prepared|Released) <strong><time data-release-date/gu;
  const cssPattern = /\.\.\/updates\/updates\.css\?v=sha256-[a-f0-9]{64}/gu;
  const scriptPattern = /\.\.\/app\/site-release\.js\?v=sha256-[a-f0-9]{64}/gu;
  requireOne(normalized, versionMetaPattern, "Companion application version metadata");
  requireOne(normalized, dateMetaPattern, "Companion release date metadata");
  requireOne(normalized, versionPattern, "Companion visible release version");
  requireOne(normalized, datePattern, "Companion visible release date");
  requireOne(normalized, releaseLabelPattern, "Companion release status label");
  requireOne(normalized, cssPattern, "Companion updates stylesheet identity");
  requireOne(normalized, scriptPattern, "Companion release script identity");
  return normalized
    .replace(
      versionMetaPattern,
      `<meta name="application-version" content="${escapeHtml(latest.version)}">`
    )
    .replace(
      dateMetaPattern,
      `<meta name="release-date" content="${escapeHtml(latest.releaseDate)}">`
    )
    .replace(versionPattern, `data-release-version>${escapeHtml(latest.version)}</span>`)
    .replace(
      datePattern,
      `data-release-date datetime="${escapeHtml(latest.releaseDate)}">` +
        `${escapeHtml(latest.releaseDate)}</time>`
    )
    .replace(
      releaseLabelPattern,
      `<span>${releaseLabel} <strong><time data-release-date`
    )
    .replace(cssPattern, `../updates/updates.css?v=sha256-${cssSha256}`)
    .replace(scriptPattern, `../app/site-release.js?v=sha256-${scriptSha256}`);
}

// Prepare coherent updates and companion views before either is written.
function expectedReleaseSurfaces(siteRoot) {
  const updates = expectedPage(siteRoot);
  invariant(fs.existsSync(updates.locations.companionPath), "Companion page is missing");
  return Object.freeze({
    ...updates,
    companionHtml: stampCompanionPage(
      fs.readFileSync(updates.locations.companionPath, "utf8"),
      updates.ledger.releases.at(-1),
      updates.cssSha256,
      updates.scriptSha256,
      updates.releaseLabel
    )
  });
}

// Require matching versions, dates, labels and asset identities across all release surfaces.
function verifyReleaseSurfaces(siteRoot) {
  const updates = expectedReleaseSurfaces(siteRoot);
  invariant(fs.existsSync(updates.locations.outputPath), "Updates page is missing");
  invariant(
    fs.readFileSync(updates.locations.outputPath, "utf8").replace(/\r\n/gu, "\n") ===
      updates.html,
    "Updates page has drifted from the release ledger"
  );
  invariant(
    fs.readFileSync(updates.locations.companionPath, "utf8").replace(/\r\n/gu, "\n") ===
      updates.companionHtml,
    "Companion page has stale release metadata or asset identities"
  );
  const latest = updates.ledger.releases.at(-1);
  const appShell = fs.readFileSync(path.join(updates.locations.root, "app", "index.html"), "utf8");
  requireOne(
    appShell,
    new RegExp(`<meta name="application-version" content="${latest.version.replaceAll(".", "\\.")}">`, "g"),
    "Application version metadata"
  );
  requireOne(
    appShell,
    new RegExp(`<meta name="release-date" content="${latest.releaseDate}">`, "g"),
    "Release date metadata"
  );
  for (const fragment of [
    'href="/.well-known/site-release.json"',
    'href="/.well-known/site-release-history.json"',
    'href="/updates/" aria-label="Updates and release history"',
    `data-release-version>${latest.version}</span>`,
    `data-release-date datetime="${latest.releaseDate}">${latest.releaseDate}</time>`,
    "data-release-published-at>Awaiting live verification</time>"
  ]) {
    invariant(appShell.includes(fragment), `Release surface is missing: ${fragment}`);
  }
  const releaseLabelPattern = new RegExp(
    `<span>${updates.releaseLabel} <time data-release-date datetime="${latest.releaseDate}">`,
    "g"
  );
  invariant(
    (appShell.match(releaseLabelPattern) || []).length === 2,
    `Application release surfaces must be labeled ${updates.releaseLabel}`
  );
  const oppositeLabel = updates.releaseLabel === "Prepared" ? "Released" : "Prepared";
  invariant(
    !appShell.includes(
      `<span>${oppositeLabel} <time data-release-date datetime="${latest.releaseDate}">`
    ),
    `Application release surfaces contain the misleading ${oppositeLabel} label`
  );
  requireOne(
    appShell,
    /src="\.\/site-release\.js\?v=sha256-[a-f0-9]{64}"/gu,
    "Release metadata reader"
  );
  return updates;
}

function writeUpdatesPage(siteRoot) {
  const expected = expectedPage(siteRoot);
  atomicReplace(expected.locations.outputPath, expected.html);
  return verifyUpdatesPage(siteRoot);
}

function writeReleaseSurfaces(siteRoot) {
  const expected = expectedReleaseSurfaces(siteRoot);
  atomicReplace(expected.locations.outputPath, expected.html);
  atomicReplace(expected.locations.companionPath, expected.companionHtml);
  return verifyReleaseSurfaces(siteRoot);
}

function main(argv) {
  let siteRoot = path.join(__dirname, "..");
  let write = false;
  for (const argument of argv) {
    if (argument === "--write") {
      write = true;
    } else {
      invariant(!argument.startsWith("-"), `Unknown option: ${argument}`);
      siteRoot = argument;
    }
  }
  const result = write ? writeReleaseSurfaces(siteRoot) : verifyReleaseSurfaces(siteRoot);
  process.stdout.write(
    `TinyRustLM updates page ${write ? "generated" : "verified"} for ` +
      `${result.ledger.releases.length} release entries\n`
  );
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  escapeHtml,
  renderUpdatesPage,
  verifyReleaseSurfaces,
  verifyUpdatesPage,
  writeReleaseSurfaces,
  writeUpdatesPage
});
