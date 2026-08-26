#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ledgerSchema = "uaix.site_release_ledger.v1";
const currentReleaseSchema = "uaix.site_release.v1";
const releaseHistorySchema = "uaix.site_release_history.v1";
const maximumLedgerBytes = 256 * 1024;
const maximumPublicRecordBytes = 512 * 1024;
const changeTypes = Object.freeze(new Set([
  "added",
  "changed",
  "documentation",
  "fixed",
  "performance",
  "removed",
  "security"
]));

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
  const actual = Object.keys(value).sort();
  const required = Array.from(expected).sort();
  invariant(
    JSON.stringify(actual) === JSON.stringify(required),
    `${label} fields are invalid`
  );
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function decodeJsonBytes(input, maximumBytes, label) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(String(input), "utf8");
  invariant(bytes.length > 0 && bytes.length <= maximumBytes, `${label} byte length is invalid`);
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label} is not valid UTF-8`);
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
  return Object.freeze({ bytes, text, value });
}

function requireBoundedText(value, label, maximumLength = 500) {
  invariant(
    typeof value === "string" &&
      value.length > 0 &&
      value.length <= maximumLength &&
      value === value.trim() &&
      !/[\u0000-\u001f\u007f]/u.test(value),
    `${label} is invalid`
  );
  return value;
}

function requireIsoDate(value, label) {
  invariant(/^\d{4}-\d{2}-\d{2}$/u.test(String(value)), `${label} is not an ISO date`);
  const date = new Date(`${value}T00:00:00.000Z`);
  invariant(
    !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value,
    `${label} is not a real calendar date`
  );
  return value;
}

function requireUtcInstant(value, label) {
  invariant(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(String(value)),
    `${label} is not a canonical UTC millisecond instant`
  );
  const date = new Date(value);
  invariant(!Number.isNaN(date.valueOf()) && date.toISOString() === value, `${label} is invalid`);
  return value;
}

function requireSourceRevision(value, label = "source revision") {
  invariant(/^[a-f0-9]{40}$/u.test(String(value)), `${label} is invalid`);
  return value;
}

function parseSemVer(value, label) {
  const match = String(value).match(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u
  );
  invariant(match, `${label} is not strict SemVer`);
  const prerelease = match[4] ? match[4].split(".") : [];
  for (const identifier of prerelease) {
    invariant(
      !/^\d+$/u.test(identifier) || identifier === "0" || !identifier.startsWith("0"),
      `${label} has a noncanonical SemVer prerelease identifier`
    );
  }
  return Object.freeze({
    value: String(value),
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease
  });
}

function compareSemVer(left, right) {
  for (const key of ["major", "minor", "patch"]) {
    if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1;
  }
  if (!left.prerelease.length && !right.prerelease.length) return 0;
  if (!left.prerelease.length) return 1;
  if (!right.prerelease.length) return -1;
  const count = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < count; index += 1) {
    const l = left.prerelease[index];
    const r = right.prerelease[index];
    if (l === undefined) return -1;
    if (r === undefined) return 1;
    if (l === r) continue;
    const lNumber = /^\d+$/u.test(l);
    const rNumber = /^\d+$/u.test(r);
    if (lNumber && rNumber) return Number(l) < Number(r) ? -1 : 1;
    if (lNumber !== rNumber) return lNumber ? -1 : 1;
    return l < r ? -1 : 1;
  }
  return 0;
}

function validateChange(change, label) {
  requireExactKeys(change, ["summary", "type"], label);
  invariant(changeTypes.has(change.type), `${label}.type is invalid`);
  requireBoundedText(change.summary, `${label}.summary`, 500);
  return change;
}

function validateRelease(release, siteId, label) {
  requireExactKeys(
    release,
    ["changes", "releaseDate", "releaseId", "summary", "version"],
    label
  );
  const version = parseSemVer(release.version, `${label}.version`);
  invariant(release.releaseId === `${siteId}@${release.version}`, `${label}.releaseId is invalid`);
  requireIsoDate(release.releaseDate, `${label}.releaseDate`);
  requireBoundedText(release.summary, `${label}.summary`, 500);
  invariant(
    Array.isArray(release.changes) && release.changes.length > 0 && release.changes.length <= 64,
    `${label}.changes is invalid`
  );
  release.changes.forEach((change, index) => validateChange(change, `${label}.changes[${index}]`));
  return version;
}

function releaseEntrySha256(release) {
  return sha256(Buffer.from(canonicalJson(release), "utf8"));
}

function publicationIdentity({ siteId, releaseId, releaseSha256, sourceRevision, publishedAt }) {
  return sha256(Buffer.from([
    currentReleaseSchema,
    siteId,
    releaseId,
    releaseSha256,
    sourceRevision,
    publishedAt
  ].join("\0"), "utf8"));
}

function validatePublication(publication, releasesById, siteId, label) {
  requireExactKeys(
    publication,
    [
      "publicationId",
      "publishedAt",
      "releaseId",
      "sourceLedgerSha256",
      "sourceRevision"
    ],
    label
  );
  const release = releasesById.get(publication.releaseId);
  invariant(release, `${label}.releaseId does not identify a release`);
  requireUtcInstant(publication.publishedAt, `${label}.publishedAt`);
  requireSourceRevision(publication.sourceRevision, `${label}.sourceRevision`);
  invariant(
    /^[a-f0-9]{64}$/u.test(String(publication.sourceLedgerSha256)),
    `${label}.sourceLedgerSha256 is invalid`
  );
  const expectedId = publicationIdentity({
    siteId,
    releaseId: release.releaseId,
    releaseSha256: releaseEntrySha256(release),
    sourceRevision: publication.sourceRevision,
    publishedAt: publication.publishedAt
  });
  invariant(publication.publicationId === expectedId, `${label}.publicationId is invalid`);
}

function parseReleaseLedger(input) {
  const decoded = decodeJsonBytes(input, maximumLedgerBytes, "Site release ledger");
  const ledger = decoded.value;
  requireExactKeys(ledger, ["publications", "releases", "schema", "site"], "Site release ledger");
  invariant(ledger.schema === ledgerSchema, "Site release ledger schema is invalid");
  requireExactKeys(
    ledger.site,
    ["canonicalOrigin", "name", "siteId", "updatesPath"],
    "Site release ledger site"
  );
  invariant(
    /^[a-z0-9](?:[a-z0-9.-]{1,251}[a-z0-9])?$/u.test(String(ledger.site.siteId)),
    "Site release ledger siteId is invalid"
  );
  requireBoundedText(ledger.site.name, "Site release ledger site name", 100);
  invariant(
    ledger.site.canonicalOrigin === `https://${ledger.site.siteId}`,
    "Site release ledger canonical origin is invalid"
  );
  invariant(
    /^\/(?:[a-z0-9-]+\/)*$/u.test(String(ledger.site.updatesPath)),
    "Site release ledger updates path is invalid"
  );
  invariant(
    Array.isArray(ledger.releases) && ledger.releases.length > 0 && ledger.releases.length <= 1000,
    "Site release ledger releases are invalid"
  );
  invariant(
    Array.isArray(ledger.publications) && ledger.publications.length <= ledger.releases.length,
    "Site release ledger publications are invalid"
  );

  const releasesById = new Map();
  let previousVersion = null;
  let previousDate = null;
  ledger.releases.forEach((release, index) => {
    const version = validateRelease(release, ledger.site.siteId, `releases[${index}]`);
    invariant(!releasesById.has(release.releaseId), "Release identities must be unique");
    if (previousVersion) {
      invariant(compareSemVer(previousVersion, version) < 0, "Release versions must strictly increase");
      invariant(previousDate <= release.releaseDate, "Release dates must not move backward");
    }
    previousVersion = version;
    previousDate = release.releaseDate;
    releasesById.set(release.releaseId, release);
  });

  const publicationByRelease = new Map();
  let previousPublishedAt = null;
  ledger.publications.forEach((publication, index) => {
    validatePublication(
      publication,
      releasesById,
      ledger.site.siteId,
      `publications[${index}]`
    );
    invariant(
      !publicationByRelease.has(publication.releaseId),
      "A release may have only one immutable publication identity"
    );
    invariant(
      publication.releaseId === ledger.releases[index].releaseId,
      "Publication records must follow release order without gaps"
    );
    if (previousPublishedAt) {
      invariant(
        previousPublishedAt < publication.publishedAt,
        "Publication instants must strictly increase"
      );
    }
    previousPublishedAt = publication.publishedAt;
    publicationByRelease.set(publication.releaseId, publication);
  });

  const pending = ledger.releases.filter((release) => !publicationByRelease.has(release.releaseId));
  invariant(pending.length <= 1, "Ledger must have exactly one latest release without publication evidence");
  if (pending.length === 1) {
    invariant(
      pending[0] === ledger.releases.at(-1),
      "Only the latest release may lack publication evidence"
    );
  }

  invariant(decoded.text === canonicalJson(ledger), "Site release ledger JSON is not canonical");
  return Object.freeze({
    ledger: Object.freeze(ledger),
    ledgerSha256: sha256(decoded.bytes),
    pendingRelease: pending[0] || null,
    publicationByRelease
  });
}

function publicReleaseRecord({ ledgerResult, release, publication }) {
  return Object.freeze({
    schema: currentReleaseSchema,
    siteId: ledgerResult.ledger.site.siteId,
    name: ledgerResult.ledger.site.name,
    canonicalOrigin: ledgerResult.ledger.site.canonicalOrigin,
    releaseId: release.releaseId,
    version: release.version,
    releaseDate: release.releaseDate,
    publishedAt: publication.publishedAt,
    sourceRevision: publication.sourceRevision,
    sourceLedgerSha256: publication.sourceLedgerSha256,
    releaseEntrySha256: releaseEntrySha256(release),
    publicationId: publication.publicationId,
    updatesUrl: `${ledgerResult.ledger.site.canonicalOrigin}${ledgerResult.ledger.site.updatesPath}`,
    summary: release.summary,
    changes: release.changes
  });
}

function buildPublicationRecords({ ledgerResult, sourceRevision, publishedAt }) {
  requireSourceRevision(sourceRevision);
  requireUtcInstant(publishedAt, "publishedAt");
  invariant(ledgerResult.pendingRelease, "Release ledger has no pending release to publish");
  const pending = ledgerResult.pendingRelease;
  const releaseSha256 = releaseEntrySha256(pending);
  const publication = Object.freeze({
    publicationId: publicationIdentity({
      siteId: ledgerResult.ledger.site.siteId,
      releaseId: pending.releaseId,
      releaseSha256,
      sourceRevision,
      publishedAt
    }),
    releaseId: pending.releaseId,
    publishedAt,
    sourceRevision,
    sourceLedgerSha256: ledgerResult.ledgerSha256
  });
  const allPublications = new Map(ledgerResult.publicationByRelease);
  allPublications.set(pending.releaseId, publication);
  const releases = ledgerResult.ledger.releases.map((release) => publicReleaseRecord({
    ledgerResult,
    release,
    publication: allPublications.get(release.releaseId)
  }));
  const current = releases.at(-1);
  const history = Object.freeze({
    schema: releaseHistorySchema,
    siteId: ledgerResult.ledger.site.siteId,
    name: ledgerResult.ledger.site.name,
    canonicalOrigin: ledgerResult.ledger.site.canonicalOrigin,
    generatedAt: publishedAt,
    releases
  });
  return Object.freeze({ current, history, publication });
}

function buildFinalizedReleaseRecords({ ledgerResult }) {
  invariant(!ledgerResult.pendingRelease, "Release ledger still has a pending publication");
  const releases = ledgerResult.ledger.releases.map((release) => {
    const publication = ledgerResult.publicationByRelease.get(release.releaseId);
    invariant(publication, "Finalized release is missing publication evidence");
    return publicReleaseRecord({ ledgerResult, release, publication });
  });
  const current = releases.at(-1);
  const publication = ledgerResult.publicationByRelease.get(current.releaseId);
  const history = Object.freeze({
    schema: releaseHistorySchema,
    siteId: ledgerResult.ledger.site.siteId,
    name: ledgerResult.ledger.site.name,
    canonicalOrigin: ledgerResult.ledger.site.canonicalOrigin,
    generatedAt: current.publishedAt,
    releases
  });
  return Object.freeze({ current, history, publication });
}

function ensureOutputDirectory(outputRoot) {
  invariant(path.isAbsolute(String(outputRoot || "")), "Release output root must be absolute");
  const root = path.resolve(outputRoot);
  if (fs.existsSync(root)) {
    const stat = fs.lstatSync(root);
    invariant(stat.isDirectory() && !stat.isSymbolicLink(), "Release output root is unsafe");
  } else {
    fs.mkdirSync(root, { recursive: true });
  }
  const directory = path.join(root, ".well-known");
  if (fs.existsSync(directory)) {
    const stat = fs.lstatSync(directory);
    invariant(stat.isDirectory() && !stat.isSymbolicLink(), "Release output directory is unsafe");
  } else {
    fs.mkdirSync(directory);
  }
  return Object.freeze({ root, directory });
}

function writeExclusiveJson(filePath, value) {
  const bytes = Buffer.from(canonicalJson(value), "utf8");
  const descriptor = fs.openSync(filePath, "wx", 0o600);
  try {
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  const reopened = fs.readFileSync(filePath);
  invariant(reopened.equals(bytes), "Release artifact failed reopen verification");
  return Object.freeze({
    filePath,
    byteCount: reopened.length,
    sha256: sha256(reopened)
  });
}

function writeReleaseRecords(outputRoot, records, ledgerSha256) {
  const output = ensureOutputDirectory(outputRoot);
  const history = writeExclusiveJson(
    path.join(output.directory, "site-release-history.json"),
    records.history
  );
  const current = writeExclusiveJson(
    path.join(output.directory, "site-release.json"),
    records.current
  );
  const files = Object.freeze([
    Object.freeze({
      ...history,
      relativePath: ".well-known/site-release-history.json"
    }),
    Object.freeze({
      ...current,
      relativePath: ".well-known/site-release.json"
    })
  ]);
  return Object.freeze({ ...records, files, ledgerSha256 });
}

function materializeReleasePublication(options = {}) {
  const ledgerPath = path.resolve(String(options.ledgerPath || ""));
  invariant(fs.existsSync(ledgerPath), "Release ledger is unavailable");
  const ledgerStat = fs.lstatSync(ledgerPath);
  invariant(ledgerStat.isFile() && !ledgerStat.isSymbolicLink(), "Release ledger is unsafe");
  const ledgerResult = parseReleaseLedger(fs.readFileSync(ledgerPath));
  const records = buildPublicationRecords({
    ledgerResult,
    sourceRevision: String(options.sourceRevision || ""),
    publishedAt: String(options.publishedAt || "")
  });
  return writeReleaseRecords(options.outputRoot, records, ledgerResult.ledgerSha256);
}

function materializeReleaseState(options = {}) {
  const ledgerPath = path.resolve(String(options.ledgerPath || ""));
  invariant(fs.existsSync(ledgerPath), "Release ledger is unavailable");
  const ledgerStat = fs.lstatSync(ledgerPath);
  invariant(ledgerStat.isFile() && !ledgerStat.isSymbolicLink(), "Release ledger is unsafe");
  const ledgerResult = parseReleaseLedger(fs.readFileSync(ledgerPath));
  if (!ledgerResult.pendingRelease) {
    invariant(
      options.sourceRevision === undefined && options.publishedAt === undefined,
      "Finalized release materialization does not accept candidate publication identity"
    );
  }
  const records = ledgerResult.pendingRelease
    ? buildPublicationRecords({
        ledgerResult,
        sourceRevision: String(options.sourceRevision || ""),
        publishedAt: String(options.publishedAt || "")
      })
    : buildFinalizedReleaseRecords({ ledgerResult });
  return writeReleaseRecords(options.outputRoot, records, ledgerResult.ledgerSha256);
}

function parseCanonicalPublicFile(filePath, expectedSchema, label) {
  const stat = fs.lstatSync(filePath);
  invariant(stat.isFile() && !stat.isSymbolicLink(), `${label} is unsafe`);
  const decoded = decodeJsonBytes(fs.readFileSync(filePath), maximumPublicRecordBytes, label);
  invariant(isPlainObject(decoded.value), `${label} must be an object`);
  invariant(decoded.value.schema === expectedSchema, `${label} schema is invalid`);
  invariant(decoded.text === canonicalJson(decoded.value), `${label} JSON is not canonical`);
  return decoded.value;
}

function validatePublicReleaseFiles(options = {}) {
  const ledgerPath = path.resolve(String(options.ledgerPath || ""));
  const outputRoot = path.resolve(String(options.outputRoot || ""));
  const currentPath = path.join(outputRoot, ".well-known", "site-release.json");
  const historyPath = path.join(outputRoot, ".well-known", "site-release-history.json");
  const current = parseCanonicalPublicFile(currentPath, currentReleaseSchema, "Current release record");
  const history = parseCanonicalPublicFile(historyPath, releaseHistorySchema, "Release history record");
  invariant(
    Array.isArray(history.releases) && history.releases.length > 0,
    "Release history releases are invalid"
  );
  invariant(
    JSON.stringify(history.releases.at(-1)) === JSON.stringify(current),
    "Current release does not match release history"
  );
  const ledgerResult = parseReleaseLedger(fs.readFileSync(ledgerPath));
  const expected = ledgerResult.pendingRelease
    ? buildPublicationRecords({
        ledgerResult,
        sourceRevision: current.sourceRevision,
        publishedAt: current.publishedAt
      })
    : buildFinalizedReleaseRecords({ ledgerResult });
  invariant(
    JSON.stringify(current) === JSON.stringify(expected.current),
    "Current release record does not match its source ledger"
  );
  invariant(
    JSON.stringify(history) === JSON.stringify(expected.history),
    "Release history record does not match its source ledger"
  );
  return Object.freeze({ current, history, files: Object.freeze([historyPath, currentPath]) });
}

function finalizeReleaseLedger(options = {}) {
  const ledgerPath = path.resolve(String(options.ledgerPath || ""));
  const outputPath = path.resolve(String(options.outputPath || ""));
  invariant(outputPath !== ledgerPath, "Finalized ledger output must not overwrite source evidence");
  const outputParent = path.dirname(outputPath);
  const parentStat = fs.lstatSync(outputParent, { throwIfNoEntry: false });
  invariant(
    parentStat?.isDirectory() && !parentStat.isSymbolicLink(),
    "Finalized ledger output directory is unsafe"
  );

  const ledgerResult = parseReleaseLedger(fs.readFileSync(ledgerPath));
  invariant(ledgerResult.pendingRelease, "Release ledger has no pending publication to finalize");
  const publicRecords = validatePublicReleaseFiles({
    ledgerPath,
    outputRoot: options.publicOutputRoot
  });
  const publication = buildPublicationRecords({
    ledgerResult,
    sourceRevision: publicRecords.current.sourceRevision,
    publishedAt: publicRecords.current.publishedAt
  }).publication;
  invariant(
    publication.publicationId === publicRecords.current.publicationId,
    "Public release publication identity is inconsistent"
  );

  const finalizedLedger = Object.freeze({
    schema: ledgerResult.ledger.schema,
    site: ledgerResult.ledger.site,
    releases: ledgerResult.ledger.releases,
    publications: Object.freeze([...ledgerResult.ledger.publications, publication])
  });
  const finalized = parseReleaseLedger(Buffer.from(canonicalJson(finalizedLedger), "utf8"));
  invariant(!finalized.pendingRelease, "Finalized ledger still contains a pending release");
  const file = writeExclusiveJson(outputPath, finalizedLedger);
  return Object.freeze({
    file,
    ledger: finalized.ledger,
    ledgerSha256: finalized.ledgerSha256,
    publication
  });
}

function assertHistoryExtension(previous, next) {
  invariant(isPlainObject(previous) && isPlainObject(next), "Release histories must be objects");
  for (const key of ["schema", "siteId", "name", "canonicalOrigin"]) {
    invariant(previous[key] === next[key], `Release history ${key} changed`);
  }
  invariant(
    Array.isArray(previous.releases) && Array.isArray(next.releases),
    "Release history releases are invalid"
  );
  invariant(
    next.releases.length >= previous.releases.length,
    "Release history cannot remove releases"
  );
  previous.releases.forEach((release, index) => {
    invariant(
      JSON.stringify(release) === JSON.stringify(next.releases[index]),
      "Release history rewrites an existing release"
    );
  });
  for (let index = Math.max(1, previous.releases.length); index < next.releases.length; index += 1) {
    const prior = parseSemVer(next.releases[index - 1].version, "Prior history version");
    const candidate = parseSemVer(next.releases[index].version, "Appended history version");
    invariant(compareSemVer(prior, candidate) < 0, "Appended release versions must strictly increase");
    invariant(
      next.releases[index - 1].publishedAt < next.releases[index].publishedAt,
      "Appended publication instants must strictly increase"
    );
  }
  return true;
}

function usage() {
  return "Usage: site-release-contract.js validate <ledger> | " +
    "materialize <ledger> <output-root> <source-revision> <published-at> | " +
    "materialize-finalized <ledger> <output-root> | " +
    "validate-public <ledger> <output-root> | " +
    "finalize <ledger> <public-output-root> <candidate-ledger-output>";
}

function main(argv) {
  const [command, ...args] = argv;
  if (command === "validate" && args.length === 1) {
    const result = parseReleaseLedger(fs.readFileSync(path.resolve(args[0])));
    process.stdout.write(`${JSON.stringify({
      schema: ledgerSchema,
      status: "pass",
      ledgerSha256: result.ledgerSha256,
      pendingReleaseId: result.pendingRelease?.releaseId || null
    })}\n`);
    return;
  }
  if (command === "materialize" && args.length === 4) {
    const result = materializeReleasePublication({
      ledgerPath: args[0],
      outputRoot: args[1],
      sourceRevision: args[2],
      publishedAt: args[3]
    });
    process.stdout.write(`${JSON.stringify({
      schema: currentReleaseSchema,
      status: "pass",
      releaseId: result.current.releaseId,
      version: result.current.version,
      publicationId: result.current.publicationId,
      ledgerSha256: result.ledgerSha256,
      files: result.files.map(({ relativePath, byteCount, sha256 }) => ({
        relativePath,
        byteCount,
        sha256
      }))
    })}\n`);
    return;
  }
  if (command === "materialize-finalized" && args.length === 2) {
    const result = materializeReleaseState({
      ledgerPath: args[0],
      outputRoot: args[1]
    });
    process.stdout.write(`${JSON.stringify({
      schema: currentReleaseSchema,
      status: "pass",
      releaseId: result.current.releaseId,
      version: result.current.version,
      publicationId: result.current.publicationId,
      ledgerSha256: result.ledgerSha256,
      files: result.files.map(({ relativePath, byteCount, sha256 }) => ({
        relativePath,
        byteCount,
        sha256
      }))
    })}\n`);
    return;
  }
  if (command === "validate-public" && args.length === 2) {
    const result = validatePublicReleaseFiles({ ledgerPath: args[0], outputRoot: args[1] });
    process.stdout.write(`${JSON.stringify({
      schema: currentReleaseSchema,
      status: "pass",
      releaseId: result.current.releaseId,
      publicationId: result.current.publicationId
    })}\n`);
    return;
  }
  if (command === "finalize" && args.length === 3) {
    const result = finalizeReleaseLedger({
      ledgerPath: args[0],
      publicOutputRoot: args[1],
      outputPath: args[2]
    });
    process.stdout.write(`${JSON.stringify({
      schema: ledgerSchema,
      status: "pass",
      publicationId: result.publication.publicationId,
      ledgerSha256: result.ledgerSha256,
      outputPath: result.file.filePath,
      byteCount: result.file.byteCount,
      sha256: result.file.sha256
    })}\n`);
    return;
  }
  throw new Error(usage());
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch {
    process.stderr.write("Site release contract validation failed\n");
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  assertHistoryExtension,
  buildPublicationRecords,
  canonicalJson,
  changeTypes,
  currentReleaseSchema,
  finalizeReleaseLedger,
  ledgerSchema,
  materializeReleasePublication,
  materializeReleaseState,
  parseReleaseLedger,
  releaseHistorySchema,
  validatePublicReleaseFiles
});
