"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  applyReleaseRecord,
  formatPublishedAt,
  loadAndRender,
  readBoundedJson,
  validateReleaseRecord
} = require("../app/site-release.js");
const {
  materializeReleasePublication
} = require("../tools/site-release-contract.js");
const {
  verifyUpdatesPage,
  writeUpdatesPage
} = require("../tools/site-release-page.js");

const siteRoot = path.resolve(__dirname, "..");
const ledgerPath = path.join(siteRoot, "release", "site-release-ledger.v1.json");

function generatedRecord(context) {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-browser-release-"));
  context.after(() => fs.rmSync(outputRoot, { recursive: true, force: true }));
  return materializeReleasePublication({
    ledgerPath,
    outputRoot,
    sourceRevision: "d".repeat(40),
    publishedAt: "2026-08-02T21:22:23.000Z"
  }).current;
}

function fakeDocument() {
  const selectors = new Map();
  function nodes(selector, values) {
    const list = values.map((tagName) => ({
      tagName,
      textContent: "",
      dateTime: "",
      dataset: {}
    }));
    selectors.set(selector, list);
    return list;
  }
  const version = nodes("[data-release-version]", ["SPAN"]);
  const date = nodes("[data-release-date]", ["TIME"]);
  const published = nodes("[data-release-published-at]", ["TIME"]);
  const containers = nodes("[data-site-release]", ["DIV"]);
  return {
    document: {
      querySelectorAll(selector) {
        return selectors.get(selector) || [];
      }
    },
    version,
    date,
    published,
    containers
  };
}

test("browser release validator accepts only the exact bounded public schema", (context) => {
  const record = generatedRecord(context);
  assert.equal(validateReleaseRecord(record), record);
  assert.equal(formatPublishedAt(record.publishedAt), "2026-08-02 21:22 UTC");

  const unknown = structuredClone(record);
  unknown.extra = true;
  assert.throws(() => validateReleaseRecord(unknown), /fields are invalid/);

  const wrongOrigin = structuredClone(record);
  wrongOrigin.canonicalOrigin = "https://example.com";
  assert.throws(() => validateReleaseRecord(wrongOrigin), /origin is invalid/);

  const noncanonicalVersion = structuredClone(record);
  noncanonicalVersion.version = "0.1.0-01";
  noncanonicalVersion.releaseId = "tinyrustlm.com@0.1.0-01";
  assert.throws(() => validateReleaseRecord(noncanonicalVersion), /version is invalid/);

  const impossibleDate = structuredClone(record);
  impossibleDate.releaseDate = "2026-02-30";
  assert.throws(() => validateReleaseRecord(impossibleDate), /date is invalid/);
});

test("browser release renderer updates all visible facts without injecting markup", (context) => {
  const record = generatedRecord(context);
  const view = fakeDocument();
  applyReleaseRecord(view.document, record);
  assert.equal(view.version[0].textContent, "0.1.1");
  assert.equal(view.date[0].textContent, "2026-08-02");
  assert.equal(view.date[0].dateTime, "2026-08-02");
  assert.equal(view.published[0].textContent, "2026-08-02 21:22 UTC");
  assert.equal(view.published[0].dateTime, "2026-08-02T21:22:23.000Z");
  assert.equal(view.containers[0].dataset.releaseState, "verified");
});

test("bounded JSON reader requires successful nonredirected application/json", async (context) => {
  const record = generatedRecord(context);
  const bytes = Buffer.from(JSON.stringify(record), "utf8");
  const response = {
    ok: true,
    redirected: false,
    headers: { get: () => "application/json; charset=utf-8" },
    arrayBuffer: async () => bytes
  };
  assert.deepEqual(await readBoundedJson(response), record);
  await assert.rejects(
    () => readBoundedJson({ ...response, redirected: true }),
    /redirected/
  );
  await assert.rejects(
    () => readBoundedJson({ ...response, headers: { get: () => "text/html" } }),
    /content type/
  );
});

test("failed live metadata leaves static release facts and marks last publish unavailable", async () => {
  const view = fakeDocument();
  view.version[0].textContent = "0.1.1";
  view.date[0].textContent = "2026-08-02";
  const result = await loadAndRender({
    document: view.document,
    fetch: async () => { throw new Error("offline"); }
  });
  assert.equal(result, null);
  assert.equal(view.version[0].textContent, "0.1.1");
  assert.equal(view.date[0].textContent, "2026-08-02");
  assert.equal(view.published[0].textContent, "Unavailable");
  assert.equal(view.containers[0].dataset.releaseState, "unavailable");
});

test("updates page is generated exactly from the release ledger and content-bound assets", (context) => {
  const outputPath = path.join(siteRoot, "updates", "index.html");
  const existed = fs.existsSync(outputPath);
  const original = existed ? fs.readFileSync(outputPath) : null;
  context.after(() => {
    if (existed) fs.writeFileSync(outputPath, original);
    else fs.rmSync(outputPath, { force: true });
  });
  const result = writeUpdatesPage(siteRoot);
  assert.equal(result.ledger.releases.length, 2);
  assert.match(result.html, /Version <span data-release-version>0\.1\.1<\/span>/);
  assert.match(result.html, /\.well-known\/site-release-history\.json/);
  assert.doesNotMatch(result.html, /<script>[^<]/);
  assert.equal(verifyUpdatesPage(siteRoot).html, result.html);
});

test("canonical app shell exposes the exact ledger version, dates, records, and updates route", () => {
  const html = fs.readFileSync(path.join(siteRoot, "app", "index.html"), "utf8");
  assert.match(html, /<meta name="application-version" content="0\.1\.1">/);
  assert.match(html, /<meta name="release-date" content="2026-08-02">/);
  assert.match(html, /href="\/\.well-known\/site-release\.json"/);
  assert.match(html, /href="\/\.well-known\/site-release-history\.json"/);
  assert.match(html, /href="\/updates\/" aria-label="Updates and release history"/);
  assert.match(html, /data-release-version>0\.1\.1<\/span>/);
  assert.match(html, /data-release-date datetime="2026-08-02">2026-08-02<\/time>/);
  assert.match(html, /data-release-published-at>Awaiting live verification<\/time>/);
  assert.match(html, /src="\.\/site-release\.js\?v=sha256-[a-f0-9]{64}"/);
});
