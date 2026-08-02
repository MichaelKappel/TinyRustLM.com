(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.TinyRustLMSiteRelease = api;
    if (root.document && typeof root.fetch === "function") {
      api.loadAndRender({ document: root.document, fetch: root.fetch.bind(root) });
    }
  }
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  const schema = "uaix.site_release.v1";
  const maximumRecordBytes = 512 * 1024;
  const fields = Object.freeze([
    "canonicalOrigin",
    "changes",
    "name",
    "publicationId",
    "publishedAt",
    "releaseDate",
    "releaseEntrySha256",
    "releaseId",
    "schema",
    "siteId",
    "sourceLedgerSha256",
    "sourceRevision",
    "summary",
    "updatesUrl",
    "version"
  ]);
  const changeFields = Object.freeze(["summary", "type"]);
  const changeTypes = new Set([
    "added",
    "changed",
    "documentation",
    "fixed",
    "performance",
    "removed",
    "security"
  ]);

  function invariant(condition, message) {
    if (!condition) throw new Error(message);
  }

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function requireExactKeys(value, expected, label) {
    invariant(isPlainObject(value), `${label} must be an object`);
    invariant(
      JSON.stringify(Object.keys(value).sort()) === JSON.stringify(Array.from(expected).sort()),
      `${label} fields are invalid`
    );
  }

  function requireText(value, label, maximumLength) {
    invariant(
      typeof value === "string" &&
        value.length > 0 &&
        value.length <= maximumLength &&
        value === value.trim() &&
        !/[\u0000-\u001f\u007f]/u.test(value),
      `${label} is invalid`
    );
  }

  function requireSemVer(value) {
    const match = String(value).match(
      /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u
    );
    invariant(match, "Release record version is invalid");
    for (const identifier of match[4]?.split(".") || []) {
      invariant(
        !/^\d+$/u.test(identifier) || identifier === "0" || !identifier.startsWith("0"),
        "Release record version is invalid"
      );
    }
  }

  function requireIsoDate(value) {
    invariant(/^\d{4}-\d{2}-\d{2}$/u.test(String(value)), "Release date is invalid");
    const date = new Date(`${value}T00:00:00.000Z`);
    invariant(
      !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value,
      "Release date is invalid"
    );
  }

  function validateReleaseRecord(record, expectedOrigin = "https://tinyrustlm.com") {
    requireExactKeys(record, fields, "Release record");
    invariant(record.schema === schema, "Release record schema is invalid");
    invariant(record.siteId === "tinyrustlm.com", "Release record site is invalid");
    invariant(record.name === "TinyRustLM", "Release record name is invalid");
    invariant(record.canonicalOrigin === expectedOrigin, "Release record origin is invalid");
    invariant(
      record.updatesUrl === `${expectedOrigin}/updates/`,
      "Release record updates URL is invalid"
    );
    requireSemVer(record.version);
    invariant(record.releaseId === `tinyrustlm.com@${record.version}`, "Release ID is invalid");
    requireIsoDate(record.releaseDate);
    invariant(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(record.publishedAt) &&
        new Date(record.publishedAt).toISOString() === record.publishedAt,
      "Publication instant is invalid"
    );
    invariant(/^[a-f0-9]{40}$/u.test(record.sourceRevision), "Source revision is invalid");
    for (const key of [
      "publicationId",
      "releaseEntrySha256",
      "sourceLedgerSha256"
    ]) {
      invariant(/^[a-f0-9]{64}$/u.test(record[key]), `${key} is invalid`);
    }
    requireText(record.summary, "Release summary", 500);
    invariant(
      Array.isArray(record.changes) && record.changes.length > 0 && record.changes.length <= 64,
      "Release changes are invalid"
    );
    record.changes.forEach((change, index) => {
      requireExactKeys(change, changeFields, `Release change ${index}`);
      invariant(changeTypes.has(change.type), `Release change ${index} type is invalid`);
      requireText(change.summary, `Release change ${index} summary`, 500);
    });
    return record;
  }

  function formatPublishedAt(value) {
    invariant(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value),
      "Publication instant is invalid"
    );
    return `${value.slice(0, 10)} ${value.slice(11, 16)} UTC`;
  }

  function setText(document, selector, value) {
    for (const node of document.querySelectorAll(selector)) {
      node.textContent = value;
    }
  }

  function applyReleaseRecord(document, record) {
    validateReleaseRecord(record);
    setText(document, "[data-release-version]", record.version);
    setText(document, "[data-release-date]", record.releaseDate);
    setText(document, "[data-release-published-at]", formatPublishedAt(record.publishedAt));
    for (const node of document.querySelectorAll("[data-release-date]")) {
      if (node.tagName === "TIME") node.dateTime = record.releaseDate;
    }
    for (const node of document.querySelectorAll("[data-release-published-at]")) {
      if (node.tagName === "TIME") node.dateTime = record.publishedAt;
    }
    for (const node of document.querySelectorAll("[data-site-release]")) {
      node.dataset.releaseState = "verified";
    }
    return record;
  }

  async function readBoundedJson(response) {
    invariant(response && response.ok === true, "Release record request failed");
    invariant(response.redirected !== true, "Release record redirected");
    const contentType = String(response.headers?.get?.("content-type") || "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    invariant(contentType === "application/json", "Release record content type is invalid");
    const bytes = new Uint8Array(await response.arrayBuffer());
    invariant(
      bytes.byteLength > 0 && bytes.byteLength <= maximumRecordBytes,
      "Release record byte length is invalid"
    );
    let text;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new Error("Release record encoding is invalid");
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Release record JSON is invalid");
    }
  }

  async function loadAndRender(options) {
    const document = options?.document;
    const fetchImpl = options?.fetch;
    invariant(document && typeof document.querySelectorAll === "function", "Document is required");
    invariant(typeof fetchImpl === "function", "Fetch is required");
    try {
      const response = await fetchImpl("/.well-known/site-release.json", {
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer"
      });
      return applyReleaseRecord(document, await readBoundedJson(response));
    } catch {
      for (const node of document.querySelectorAll("[data-site-release]")) {
        node.dataset.releaseState = "unavailable";
      }
      setText(document, "[data-release-published-at]", "Unavailable");
      return null;
    }
  }

  return Object.freeze({
    applyReleaseRecord,
    formatPublishedAt,
    loadAndRender,
    maximumRecordBytes,
    readBoundedJson,
    schema,
    validateReleaseRecord
  });
});
