#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("@playwright/test");

const admissionAuthority = require("../app/browser-model-admission.js");
const browserRuntimeAuthority = require("../app/browser-runtime-loader.js");
const currentRuntimeManifest = browserRuntimeAuthority.parseManifestBytes(fs.readFileSync(
  path.resolve(__dirname, "../browser-runtime/tinyrustlm-browser-runtime.wasm.manifest.json")
));
const catalogAuthority = require("../app/minimodel-catalog-v1.js");
const directPeerUrlAuthority = catalogAuthority.directPeerUrlAuthority;
const {
  assertOwnedProfileFresh,
  createOwnedBrowserProfile,
  createOwnedProfileRoot,
  deleteOwnedBrowserProfile,
  removeOwnedProfileRoot
} = require("./owned-browser-profile.js");
const { startSourceServer } = require("./static-server.js");

const DEMO_LABEL = "SYNTHETIC FIXTURE DEMO - NOT LIVE MODEL EVIDENCE";
const DEMO_SCHEMA = "tinyrustlm.synthetic_p2p_interview_demo.v5";
const INTERACTIVE_DEMO_SCHEMA = "tinyrustlm.synthetic_p2p_interactive_demo.v3";
const SYNTHETIC_MECHANICS_VERDICT = "synthetic-fixture-mechanics-pass";
const TEST_ONLY_CLASSIFICATION = "synthetic-test-only-never-live-model";
const TEST_ONLY_SCOPE = "test-only/never-live/interview-demo/synthetic-p2p";
const PROTOCOL_PROFILE = "tinyrustlm.direct-composition-http.v1";
const ROUTE_PREFIX = "/tinyrustlm/direct-composition/v1";
const COMPANION_SEED_AUDIT_KEY = "__tinyrustlmSyntheticCompanionSeedAudit";
const COMPANION_SEED_BINDING = "__tinyrustlmRecordSyntheticCompanionSeedStatus";
const COMPANION_SEED_OBSERVATION_LIMIT = 128;
const RUNTIME_ERROR_AUDIT_KEY = "__tinyrustlmSyntheticRuntimeErrors";
const EXPECTED_CACHE_REJECTION = "model-catalog-delisted";
const EXPECTED_CANDIDATE_REJECTION = "acg2-header";
const OPFS_ROOT_NAME = "tinyrustlm-model-compositions-v2";
const STORE_MANIFEST_SCHEMA = "tinyrustlm.model-composition-store.manifest/2";
const ACG2_MEMBER_COUNT = 5;
const ACG2_MEMBER_RECORD_BYTES = 128;
const ACG2_GRAPH_DOMAIN = "tinyrustlm.acg2.champion-graph.v1\0";
const STORE_CHUNK_BYTES = 128;
const SERVER_CHUNK_BYTES = 128;
const CATALOG_URL = "https://minimodel.org/catalog/compositions.v1.json";
const PEER_FEED_URL = "https://minimodel.org/catalog/peer-announcements.v1.json";
const MEMBER_NAMES = Object.freeze([
  "model.slm2",
  "tokenizer.tokenizer2",
  "template.template2",
  "sampling.sampling2",
  "prompt.prompt2",
  "composition.acg2"
]);
const RUNTIME_SCRIPTS = Object.freeze([
  "browser-model-admission.js",
  "minimodel-catalog-v1.js",
  "incremental-sha256.js",
  "model-composition-store.js",
  "p2p-composition-install.js"
]);
const EXPOSED_HEADERS = [
  "Content-Length",
  "Content-Type",
  "X-TinyRustLM-Composition-Id",
  "X-TinyRustLM-Piece-Set-Id",
  "X-TinyRustLM-Member-Name",
  "X-TinyRustLM-Member-Id"
].join(", ");
const operationScratch = require("./canonical-operation-scratch.js");
const DEFAULT_TEMP_ROOT = path.resolve(__dirname, "../../artifacts/synthetic-p2p-demo");
// Keep Chromium's Windows OPFS paths short even when the report parent is deeply nested.
const BROWSER_SCRATCH_ROOT = path.resolve(__dirname, "../../artifacts/browser-demo");
const NOTICE_FILE = "SYNTHETIC-FIXTURE-DEMO-NOT-LIVE-MODEL-EVIDENCE.txt";
const DESKTOP_VIEWPORT = Object.freeze({ width: 1440, height: 900 });
const NARROW_VIEWPORT = Object.freeze({ width: 390, height: 844 });
const SCREENSHOT_EVIDENCE = Object.freeze([
  ["01-compact-chooser.png", "application", "chooser", DESKTOP_VIEWPORT],
  ["02-direct-peer-progress.png", "application", "direct-transfer", DESKTOP_VIEWPORT],
  ["03-rejected-candidate-prior-preserved.png", "fixture-evidence", "activation-rejection",
    DESKTOP_VIEWPORT],
  ["04-opfs-reopen-verified.png", "fixture-evidence", "opfs-reopen", DESKTOP_VIEWPORT],
  ["05-cancellation-in-progress.png", "fixture-evidence", "cancellation-progress",
    DESKTOP_VIEWPORT],
  ["06-cancellation-atomic.png", "fixture-evidence", "cancellation-atomic",
    DESKTOP_VIEWPORT],
  ["07-acquisition-evidence-narrow.png", "fixture-evidence", "activation-rejection",
    NARROW_VIEWPORT],
  ["08-cancellation-evidence-narrow.png", "fixture-evidence", "cancellation-atomic",
    NARROW_VIEWPORT]
].map(([fileName, surface, scope, viewport]) => Object.freeze({
  fileName,
  surface,
  scope,
  width: viewport.width,
  height: viewport.height
})));
const SCREENSHOTS = Object.freeze(SCREENSHOT_EVIDENCE.map((entry) => entry.fileName));
const TRACES = Object.freeze([
  "01-rejected-candidate-transfer-trace.zip",
  "02-preserved-prior-reopen-cancel-trace.zip"
]);
const PRESERVED_PRIOR_LENGTHS = Object.freeze([131101, 73717, 69643, 65800, 512, 896]);
const REJECTED_CANDIDATE_LENGTHS = Object.freeze([131101, 73717, 69643, 65800, 512, 896]);
const CANCELLED_CANDIDATE_LENGTHS = Object.freeze([196613, 81929, 77801, 65800, 512, 896]);
const FALSE_LIVE_CLAIMS = Object.freeze({
  liveModel: false,
  liveModelInstallation: false,
  liveModelActivation: false,
  qualificationEvidence: false,
  inference: false,
  deployment: false,
  externalPeerReachability: false,
  catalogPublication: false,
  campaignProgress: false
});
const TEST_NOW = new Date(Math.floor(Date.now() / 1000) * 1000);
const PEER_KEY_PAIR = crypto.generateKeyPairSync("ed25519");
const PEER_PUBLIC_KEY_BYTES = PEER_KEY_PAIR.publicKey
  .export({ type: "spki", format: "der" })
  .subarray(-32);
const PEER_PUBLIC_KEY_BASE64URL = PEER_PUBLIC_KEY_BYTES.toString("base64url");
const PEER_KEY_ID = `sha256:${sha256(PEER_PUBLIC_KEY_BYTES)}`;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function identity(label) {
  return sha256(Buffer.from(`synthetic-test-only:${label}`, "utf8"));
}

function utc(offsetMilliseconds) {
  return new Date(TEST_NOW.getTime() + offsetMilliseconds)
    .toISOString()
    .replace(".000Z", "Z");
}

function pieceSetSha256(fixture, suffix) {
  return `sha256:${identity(`${fixture.label}:piece-set:${suffix}`)}`;
}

// This is the deterministic byte builder used by direct-p2p-composition.spec.js.
function syntheticBytes(label, byteLength) {
  const value = Buffer.allocUnsafe(byteLength);
  const seed = Buffer.from(`SYNTHETIC TEST ONLY NEVER LIVE:${label}`, "utf8");
  for (let index = 0; index < value.length; index += 1) {
    value[index] = (seed[index % seed.length] + index * 31 + (index >>> 5)) & 0xff;
  }
  return value;
}

function writeSafeUint64(view, offset, value) {
  invariant(Number.isSafeInteger(value) && value >= 0,
    "Synthetic fixture uint64 value is invalid");
  const radix = 0x100000000;
  view.setUint32(offset, value % radix, true);
  view.setUint32(offset + 4, Math.floor(value / radix), true);
}

function hexBytes(value) {
  invariant(typeof value === "string" && /^[0-9a-f]{64}$/u.test(value),
    "Synthetic fixture SHA-256 is invalid");
  return Buffer.from(value, "hex");
}

function acg2MemberTable(artifacts) {
  const bytes = Buffer.alloc(ACG2_MEMBER_COUNT * ACG2_MEMBER_RECORD_BYTES);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let index = 0; index < ACG2_MEMBER_COUNT; index += 1) {
    const artifact = artifacts[index];
    const offset = index * ACG2_MEMBER_RECORD_BYTES;
    view.setUint16(offset, 1, true);
    view.setUint16(offset + 2, index + 1, true);
    view.setUint16(offset + 4, index + 1, true);
    view.setUint32(offset + 8, index, true);
    writeSafeUint64(view, offset + 16, artifact.byteCount);
    bytes.set(hexBytes(artifact.sha256), offset + 24);
    bytes.set(hexBytes(artifact.formatProfileSha256), offset + 56);
  }
  return bytes;
}

function acg2GraphInput(memberTable, resolvedMemberBytes) {
  const domain = Buffer.from(ACG2_GRAPH_DOMAIN, "utf8");
  const framing = Buffer.alloc(17);
  const view = new DataView(framing.buffer, framing.byteOffset, framing.byteLength);
  view.setUint16(0, 2, true);
  view.setUint16(2, 0, true);
  view.setUint8(4, 1);
  view.setUint32(5, ACG2_MEMBER_COUNT, true);
  writeSafeUint64(view, 9, resolvedMemberBytes);
  return Buffer.concat([domain, framing, memberTable]);
}

// Keep this fixture shape aligned with direct-p2p-composition.spec.js. Its
// qualification-shaped fields exist only because the production parser is the subject of the demo.
function createSyntheticFixture(label, lengths, responseDelayMilliseconds) {
  invariant(typeof label === "string" && /^[a-z][a-z0-9-]{0,31}$/u.test(label),
    "Synthetic fixture label is invalid");
  invariant(Array.isArray(lengths) && lengths.length === MEMBER_NAMES.length &&
    lengths.every((value) => Number.isSafeInteger(value) && value > 0),
  "Synthetic fixture lengths are invalid");
  invariant(Number.isSafeInteger(responseDelayMilliseconds) &&
    responseDelayMilliseconds >= 0 && responseDelayMilliseconds <= 100,
  "Synthetic fixture response delay is invalid");

  const memberBuffers = Object.fromEntries(MEMBER_NAMES.map((fileName, index) => [
    fileName,
    syntheticBytes(`${label}:${fileName}`, lengths[index])
  ]));
  const artifacts = admissionAuthority.artifactSpecs.map((spec) => ({
    role: spec.role,
    format: spec.format,
    fileName: spec.fileName,
    byteCount: memberBuffers[spec.fileName].byteLength,
    sha256: sha256(memberBuffers[spec.fileName]),
    formatProfileSha256: spec.profileSha256
  }));
  const resolvedMemberBytes = artifacts.slice(0, 5)
    .reduce((total, artifact) => total + artifact.byteCount, 0);
  const residentDependencyBytes = artifacts.slice(1, 5)
    .reduce((total, artifact) => total + artifact.byteCount, 0);
  const qualificationReceiptId = `sha256:${identity(`${label}:qualification-receipt-id`)}`;
  const memberTable = acg2MemberTable(artifacts);
  const memberTableSha256 = sha256(memberTable);
  const graphIdentitySha256 = sha256(acg2GraphInput(
    memberTable,
    resolvedMemberBytes
  ));
  const admission = {
    schema: admissionAuthority.schema,
    modelId: `test-only/direct-p2p-${label}`,
    operationId: identity(`${label}:operation`),
    artifacts,
    composition: {
      graphIdentitySha256,
      memberTableSha256,
      resolvedMemberBytes
    },
    qualification: {
      receiptId: qualificationReceiptId,
      sourceEvidenceSha256: identity(`${label}:source-evidence`),
      structuralEvidenceSha256: identity(`${label}:structural-evidence`),
      numericalEvidenceSha256: identity(`${label}:numerical-evidence`),
      qualityEvidenceSha256: identity(`${label}:quality-evidence`),
      evalCasesSha256: identity(`${label}:eval-cases`),
      qualityClaim: "task-specific-qualified",
      qualityScope: TEST_ONLY_SCOPE
    },
    runtime: {
      workerProtocol: admissionAuthority.workerProtocol,
      wasmByteCount: currentRuntimeManifest.byteCount,
      wasmSha256: currentRuntimeManifest.sha256,
      policy: {
        maximumModelBytes: artifacts[0].byteCount,
        maximumSequenceTokens: 128,
        maximumKvBytes: 1024 * 1024,
        maximumScratchBytes: 1024 * 1024,
        maximumResolvedMemberBytes: resolvedMemberBytes,
        maximumResidentDependencyBytes: residentDependencyBytes,
        maximumRequestBytes: 1_054_848,
        maximumLinearMemoryBytes: currentRuntimeManifest.maximumMemoryBytes
      },
      defaultSampling: {
        temperatureMillionths: 600_000,
        topK: 20,
        topPMillionths: 950_000,
        repetitionPenaltyMillionths: 1_000_000,
        repetitionWindow: 32,
        maximumNewTokens: 64
      }
    }
  };
  const admissionText = admissionAuthority.serializeAdmission(admission);
  const admissionBytes = Buffer.from(admissionText, "utf8");
  const qualificationReceipt = Object.freeze({
    schema: catalogAuthority.QUALIFICATION_RECEIPT_SCHEMA,
    receiptId: admission.qualification.receiptId,
    modelId: admission.modelId,
    operationId: admission.operationId,
    compositionId: `sha256:${admission.composition.graphIdentitySha256}`,
    sourceEvidenceSha256: admission.qualification.sourceEvidenceSha256,
    structuralEvidenceSha256: admission.qualification.structuralEvidenceSha256,
    numericalEvidenceSha256: admission.qualification.numericalEvidenceSha256,
    qualityEvidenceSha256: admission.qualification.qualityEvidenceSha256,
    evalCasesSha256: admission.qualification.evalCasesSha256,
    qualityClaim: admission.qualification.qualityClaim,
    qualityScope: admission.qualification.qualityScope,
    numericalStatus: "passed",
    browserStatus: "passed",
    qualityStatus: "qualified",
    issuedAtUtc: utc(-2 * 60_000)
  });
  const qualificationReceiptText = `${JSON.stringify(qualificationReceipt)}\n`;
  const qualificationReceiptBytes = Buffer.from(qualificationReceiptText, "utf8");
  const members = Object.freeze(artifacts.map((artifact) => Object.freeze({
      fileName: artifact.fileName,
      byteLength: artifact.byteCount,
      sha256: artifact.sha256
    })));
  const fixture = Object.freeze({
    classification: TEST_ONLY_CLASSIFICATION,
    testOnly: true,
    eligibleAsLiveModel: false,
    label,
    modelId: admission.modelId,
    compositionId: `sha256:${admission.composition.graphIdentitySha256}`,
    qualificationReceipt,
    qualificationReceiptText,
    qualificationReceiptSha256: `sha256:${sha256(qualificationReceiptBytes)}`,
    admissionText,
    admissionSha256: sha256(admissionBytes),
    members,
    memberBuffers: Object.freeze(memberBuffers),
    responseDelayMilliseconds
  });
  const fixtureCatalog = createCatalogDocument([
    createDocuments(fixture, 48123).catalogEntry
  ]);
  return bindFixtureToCatalog(fixture, fixtureCatalog);
}

function createDocuments(fixture, port) {
  const selectedAnnouncementId = `test-only/peer/${fixture.label}/ipv4`;
  const laterAnnouncementId = `test-only/peer/${fixture.label}/localhost`;
  const selectedPeerBaseUrl = directPeerUrlAuthority.normalizeBaseUrl(
    `http://127.0.0.1:${port}/`
  );
  const laterPeerBaseUrl = directPeerUrlAuthority.normalizeBaseUrl(
    `http://127.0.0.1:${port}/`
  );
  const catalogEntry = {
    entry_id: `test-only/direct-p2p-${fixture.label}`,
    display_name: `${DEMO_LABEL} / ${fixture.label}`,
    description: `${DEMO_LABEL}. Synthetic bytes exercise browser mechanics only.`,
    source: {
      repository: fixture.modelId,
      revision: identity(`${fixture.label}:source-revision`).slice(0, 40),
      source_lock_sha256: `sha256:${identity(`${fixture.label}:source-lock`)}`
    },
    license: {
      route: `/test-only/licenses/direct-p2p-${fixture.label}.txt`,
      review_status: "reviewed"
    },
    composition: {
      composition_id: fixture.compositionId,
      member_count: MEMBER_NAMES.length,
      members: fixture.members.map((member, index) => ({
        name: member.fileName,
        bytes: member.byteLength,
        sha256: `sha256:${member.sha256}`,
        schema: `tinyrustlm.synthetic-test-only.member-${index + 1}.v1`
      }))
    },
    browser_admission: {
      route: `/test-only/admissions/direct-p2p-${fixture.label}.json`,
      bytes: Buffer.byteLength(fixture.admissionText, "utf8"),
      sha256: `sha256:${fixture.admissionSha256}`
    },
    profiles: {
      conversion: "test-only/conversion",
      quantization: "test-only/quantization",
      runtime: "test-only/browser"
    },
    qualification: {
      status: "qualified",
      receipt_id: fixture.qualificationReceipt.receiptId,
      receipt_route: `/test-only/qualification-receipts/direct-p2p-${fixture.label}.json`,
      receipt_bytes: Buffer.byteLength(fixture.qualificationReceiptText, "utf8"),
      receipt_sha256: fixture.qualificationReceiptSha256,
      numerical_status: "passed",
      browser_status: "passed",
      quality_status: "qualified"
    },
    peer_announcement_ids: [laterAnnouncementId, selectedAnnouncementId]
  };
  const announcement = (announcementId, peerBaseUrl, suffix) => {
    const value = {
      announcement_id: announcementId,
      composition_id: fixture.compositionId,
      piece_set_sha256: pieceSetSha256(fixture, suffix),
      peer_base_url: peerBaseUrl,
      protocol_profile: PROTOCOL_PROFILE,
      consent_status: "explicit",
      consent_receipt_sha256: `sha256:${identity(`${fixture.label}:consent:${suffix}`)}`,
      outside_proof_status: "current-passed",
      outside_proof_receipt_sha256:
        `sha256:${identity(`${fixture.label}:outside-proof:${suffix}`)}`,
      issued_at_utc: utc(-60_000),
      expires_utc: utc(30 * 60_000),
      verification_key_id: PEER_KEY_ID,
      signature: Buffer.alloc(64).toString("base64url")
    };
    value.signature = crypto.sign(
      null,
      Buffer.from(catalogAuthority.peerAnnouncementSigningBytes(value)),
      PEER_KEY_PAIR.privateKey
    ).toString("base64url");
    return value;
  };

  return Object.freeze({
    catalogEntry,
    announcements: Object.freeze([
      announcement(laterAnnouncementId, laterPeerBaseUrl, "later"),
      announcement(selectedAnnouncementId, selectedPeerBaseUrl, "selected")
    ]),
    selectedPeerBaseUrl,
    laterPeerBaseUrl
  });
}

function createCatalogDocument(entries, options = {}) {
  const revision = options.revision === undefined ? 1 : options.revision;
  const generatedAtOffsetMilliseconds =
    options.generatedAtOffsetMilliseconds === undefined
      ? -90_000
      : options.generatedAtOffsetMilliseconds;
  return Object.freeze({
    schema: catalogAuthority.CATALOG_SCHEMA,
    catalog_id: "synthetic-fixture-demo-never-live",
    revision,
    generated_at_utc: utc(generatedAtOffsetMilliseconds),
    valid_until_utc: utc(60 * 60_000),
    project_server_serves_model_bytes: false,
    project_server_proxies_model_bytes: false,
    project_server_runs_inference: false,
    qualification_policy: "exact-current-evidence-required",
    qualification_receipt_schema: catalogAuthority.QUALIFICATION_RECEIPT_SCHEMA,
    browser_admission_schema: catalogAuthority.BROWSER_ADMISSION_SCHEMA,
    peer_verification_keys: Object.freeze([Object.freeze({
      key_id: PEER_KEY_ID,
      algorithm: "Ed25519",
      public_key_base64url: PEER_PUBLIC_KEY_BASE64URL,
      not_before_utc: utc(-60 * 60_000),
      not_after_utc: utc(2 * 60 * 60_000)
    })]),
    revoked_qualification_receipt_ids: Object.freeze([]),
    supersessions: Object.freeze([]),
    entries: Object.freeze([...entries])
  });
}

function bindFixtureToCatalog(fixture, catalog) {
  const admissionBytes = Buffer.from(fixture.admissionText, "utf8");
  const qualificationReceiptBytes = Buffer.from(
    fixture.qualificationReceiptText,
    "utf8"
  );
  const catalogText = `${JSON.stringify(catalog)}\n`;
  const catalogBytes = Buffer.from(catalogText, "utf8");
  const p2pPieceSetSha256 = pieceSetSha256(fixture, "selected");
  const catalogAuthorityValue = Object.freeze({
    id: catalog.catalog_id,
    revision: catalog.revision,
    generatedAtUtc: catalog.generated_at_utc,
    validUntilUtc: catalog.valid_until_utc,
    sha256: `sha256:${sha256(catalogBytes)}`
  });
  const manifest = Object.freeze({
    schema: STORE_MANIFEST_SCHEMA,
    admissionAuthority: Object.freeze({
      admission: Object.freeze({
        byteLength: admissionBytes.byteLength,
        sha256: fixture.admissionSha256
      }),
      qualificationReceipt: Object.freeze({
        byteLength: qualificationReceiptBytes.byteLength,
        sha256: fixture.qualificationReceiptSha256.slice("sha256:".length)
      }),
      catalog: Object.freeze({
        byteLength: catalogBytes.byteLength,
        sha256: catalogAuthorityValue.sha256.slice("sha256:".length)
      }),
      p2pPieceSetSha256
    }),
    members: fixture.members
  });
  return Object.freeze({
    ...fixture,
    manifest,
    manifestSha256: sha256(Buffer.from(`${JSON.stringify(manifest)}\n`, "utf8")),
    admissionAuthority: Object.freeze({
      admissionText: fixture.admissionText,
      qualificationReceiptText: fixture.qualificationReceiptText,
      catalogText,
      catalogAuthority: catalogAuthorityValue,
      p2pPieceSetSha256
    })
  });
}

function createDemoDocuments(fixtures, port) {
  const perFixture = fixtures.map((fixture) => createDocuments(fixture, port));
  const catalog = createCatalogDocument(
    perFixture.map((value) => value.catalogEntry),
    { revision: 2, generatedAtOffsetMilliseconds: -60_000 }
  );
  const boundFixtures = Object.freeze(fixtures.map((fixture) =>
    bindFixtureToCatalog(fixture, catalog)));
  const admissions = new Map();
  const qualificationReceipts = new Map();
  for (let index = 0; index < fixtures.length; index += 1) {
    const route = perFixture[index].catalogEntry.browser_admission.route;
    admissions.set(new URL(route, CATALOG_URL).href, fixtures[index].admissionText);
    const receiptRoute = perFixture[index].catalogEntry.qualification.receipt_route;
    qualificationReceipts.set(
      new URL(receiptRoute, CATALOG_URL).href,
      fixtures[index].qualificationReceiptText
    );
  }
  return Object.freeze({
    catalog,
    peerFeed: {
      schema: catalogAuthority.PEER_SCHEMA,
      feed_id: "synthetic-fixture-demo-never-live",
      revision: 1,
      generated_at_utc: utc(-60_000),
      valid_until_utc: utc(60 * 60_000),
      project_server_serves_model_bytes: false,
      project_server_proxies_model_bytes: false,
      announcements: perFixture.flatMap((value) => value.announcements)
    },
    admissions,
    qualificationReceipts,
    perFixture: Object.freeze(perFixture),
    fixtures: boundFixtures
  });
}

function memberRoute(fixture, fileName) {
  return `${ROUTE_PREFIX}/compositions/${fixture.compositionId}/members/${fileName}`;
}

async function startSyntheticPeerServer(fixtures, applicationOrigin, options = {}) {
  const parsedApplicationOrigin = new URL(applicationOrigin);
  invariant(parsedApplicationOrigin.protocol === "http:" &&
    parsedApplicationOrigin.hostname === "127.0.0.1" &&
    parsedApplicationOrigin.origin === applicationOrigin,
  "Synthetic peer requires an exact loopback application origin");
  invariant(options && typeof options === "object" && !Array.isArray(options),
    "Synthetic peer options are invalid");
  invariant(Object.keys(options).every((key) => key === "pauseFixtureLabels"),
    "Synthetic peer option is not supported");
  const pauseFixtureLabels = options.pauseFixtureLabels || [];
  invariant(Array.isArray(pauseFixtureLabels) &&
    new Set(pauseFixtureLabels).size === pauseFixtureLabels.length &&
    pauseFixtureLabels.every((label) => fixtures.some((fixture) => fixture.label === label)),
  "Synthetic peer pause fixtures are invalid");
  const pauseGates = new Map(pauseFixtureLabels.map((label) => {
    const fixture = fixtures.find((candidate) => candidate.label === label);
    const totalBytes = fixture.manifest.members.reduce(
      (total, member) => total + member.byteLength,
      0
    );
    return [label, {
      thresholdBytes: Math.ceil(totalBytes / 100),
      released: false,
      resume: null
    }];
  }));
  const routes = new Map();
  for (const fixture of fixtures) {
    for (const fileName of MEMBER_NAMES) {
      routes.set(memberRoute(fixture, fileName), {
        fixture,
        fileName,
        bytes: fixture.memberBuffers[fileName]
      });
    }
  }
  const requests = [];
  let expectedHost = null;
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url, "http://loopback.invalid");
    const route = routes.get(requestUrl.pathname) || null;
    const record = {
      method: request.method,
      path: requestUrl.pathname,
      host: request.headers.host || null,
      origin: request.headers.origin || null,
      referer: request.headers.referer || null,
      cookie: request.headers.cookie || null,
      fixtureLabel: route ? route.fixture.label : null,
      fileName: route ? route.fileName : null,
      responseHeaders: null,
      writeSizes: [],
      bytesWritten: 0,
      paused: false,
      completed: false,
      closed: false,
      closedEarly: false,
      requestAborted: false
    };
    requests.push(record);
    request.on("aborted", () => {
      record.requestAborted = true;
    });
    response.on("close", () => {
      record.closed = true;
      record.closedEarly = !record.completed;
    });
    response.on("error", () => {});

    if (!route || requestUrl.search !== "" || request.method !== "GET" ||
        request.headers.origin !== applicationOrigin || request.headers.host !== expectedHost) {
      response.writeHead(403, {
        "Access-Control-Allow-Origin": applicationOrigin,
        "Cache-Control": "no-store",
        "Content-Length": "0"
      });
      response.end();
      return;
    }

    const member = route.fixture.manifest.members.find(
      (candidate) => candidate.fileName === route.fileName
    );
    const responseHeaders = {
      "Access-Control-Allow-Origin": applicationOrigin,
      "Access-Control-Expose-Headers": EXPOSED_HEADERS,
      "Cache-Control": "no-store",
      "Content-Length": String(route.bytes.byteLength),
      "Content-Type": "application/octet-stream",
      "X-TinyRustLM-Composition-Id": route.fixture.compositionId,
      "X-TinyRustLM-Piece-Set-Id": pieceSetSha256(route.fixture, "selected"),
      "X-TinyRustLM-Member-Name": route.fileName,
      "X-TinyRustLM-Member-Id": `sha256:${member.sha256}`
    };
    record.responseHeaders = responseHeaders;
    response.writeHead(200, responseHeaders);

    let offset = 0;
    let timer = null;
    const schedule = () => {
      timer = setTimeout(writeNext, route.fixture.responseDelayMilliseconds);
    };
    const writeNext = () => {
      timer = null;
      if (response.destroyed) return;
      if (offset === route.bytes.byteLength) {
        record.completed = true;
        response.end();
        return;
      }
      const next = Math.min(offset + SERVER_CHUNK_BYTES, route.bytes.byteLength);
      const chunk = route.bytes.subarray(offset, next);
      offset = next;
      record.writeSizes.push(chunk.byteLength);
      record.bytesWritten += chunk.byteLength;
      const writable = response.write(chunk);
      const gate = pauseGates.get(route.fixture.label);
      const fixtureBytesWritten = requests
        .filter((candidate) => candidate.fixtureLabel === route.fixture.label)
        .reduce((total, candidate) => total + candidate.bytesWritten, 0);
      if (gate && !gate.released && fixtureBytesWritten >= gate.thresholdBytes) {
        record.paused = true;
        gate.resume = () => {
          gate.resume = null;
          record.paused = false;
          if (!response.destroyed) {
            if (writable || !response.writableNeedDrain) schedule();
            else response.once("drain", schedule);
          }
        };
        return;
      }
      if (writable) schedule();
      else response.once("drain", schedule);
    };
    response.once("close", () => {
      if (timer !== null) clearTimeout(timer);
      const gate = route && pauseGates.get(route.fixture.label);
      if (gate && record.paused) gate.resume = null;
    });
    writeNext();
  });
  server.on("clientError", (_error, socket) => socket.destroy());
  server.keepAliveTimeout = 1_000;
  server.maxConnections = 8;

  await new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(0, "127.0.0.1");
  });
  const address = server.address();
  invariant(address && typeof address === "object" && address.address === "127.0.0.1",
    "Synthetic peer did not bind to IPv4 loopback");
  expectedHost = `127.0.0.1:${address.port}`;

  let closePromise = null;
  return Object.freeze({
    origin: `http://${expectedHost}`,
    port: address.port,
    requests,
    releaseFixture(label) {
      const gate = pauseGates.get(label);
      invariant(gate && !gate.released, "Synthetic peer pause release is invalid");
      gate.released = true;
      const resume = gate.resume;
      gate.resume = null;
      if (resume) resume();
    },
    close() {
      if (closePromise) return closePromise;
      for (const gate of pauseGates.values()) {
        gate.released = true;
        const resume = gate.resume;
        gate.resume = null;
        if (resume) resume();
      }
      closePromise = new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
        server.closeAllConnections();
      });
      return closePromise;
    }
  });
}

function bannerInitScript(contextLabel) {
  return `(() => {
    "use strict";
    const label = ${JSON.stringify(DEMO_LABEL)};
    const contextLabel = ${JSON.stringify(contextLabel)};
    const bannerId = "tinyrustlm-synthetic-fixture-demo-banner";
    const styleId = "tinyrustlm-synthetic-fixture-demo-style";
    const seedAuditKey = ${JSON.stringify(COMPANION_SEED_AUDIT_KEY)};
    const seedBinding = ${JSON.stringify(COMPANION_SEED_BINDING)};
    const seedObservationLimit = ${COMPANION_SEED_OBSERVATION_LIMIT};
    const documentId = globalThis.crypto.randomUUID();
    const seedAudit = {
      contextLabel,
      overflowed: false,
      observations: []
    };
    globalThis[seedAuditKey] = seedAudit;
    const runtimeErrorAudit = { overflowed: false, errors: [], workerRejections: [] };
    globalThis[${JSON.stringify(RUNTIME_ERROR_AUDIT_KEY)}] = runtimeErrorAudit;

    // Observe real diagnostic changes without suppressing or replacing an application error.
    function retainRuntimeError(value) {
      const text = String(value || "").trim();
      if (!text || text === "none" || runtimeErrorAudit.errors.at(-1) === text) return;
      if (text.length > 1024 || runtimeErrorAudit.errors.length >= 32) {
        runtimeErrorAudit.overflowed = true;
        return;
      }
      runtimeErrorAudit.errors.push(text);
    }

    // Observe the genuine worker response before store callbacks wrap its error; never modify it.
    const BrowserWorker = globalThis.Worker;
    if (typeof BrowserWorker === "function") {
      globalThis.Worker = class extends BrowserWorker {
        constructor(scriptUrl, options) {
          super(scriptUrl, options);
          const url = new URL(scriptUrl, location.href);
          if (url.origin !== location.origin || url.pathname !== "/app/model-runtime-worker.js") return;
          this.addEventListener("message", ({ data }) => {
            if (!data || data.schema !== ${JSON.stringify(admissionAuthority.workerProtocol)} ||
                data.kind !== "command-rejected") return;
            const payload = data.payload;
            if (!payload || typeof payload.code !== "string" || payload.code.length > 128 ||
                typeof data.operationId !== "string" || data.operationId.length !== 64 ||
                typeof data.compositionId !== "string" || data.compositionId.length !== 64 ||
                runtimeErrorAudit.workerRejections.length >= 16) {
              runtimeErrorAudit.overflowed = true;
              return;
            }
            runtimeErrorAudit.workerRejections.push({ code: payload.code,
              operationId: data.operationId, compositionId: data.compositionId });
          });
        }
      };
    }

    // Retain and relay a bounded snapshot before app code can hide a non-idle transition.
    function recordCompanionSeedStatus(source, state, code) {
      const normalizedState = String(state || "");
      const normalizedCode = String(code || "");
      const previous = seedAudit.observations[seedAudit.observations.length - 1];
      if (previous && previous.state === normalizedState &&
          previous.code === normalizedCode) return;
      if (seedAudit.observations.length >= seedObservationLimit) {
        if (!seedAudit.overflowed) {
          seedAudit.overflowed = true;
          const reporter = globalThis[seedBinding];
          if (typeof reporter === "function") {
            void reporter({ contextLabel, documentId, overflowed: true });
          }
        }
        return;
      }
      const observation = {
        contextLabel,
        documentId,
        sequence: seedAudit.observations.length + 1,
        source,
        state: normalizedState,
        code: normalizedCode
      };
      seedAudit.observations.push(observation);
      const reporter = globalThis[seedBinding];
      if (typeof reporter === "function") void reporter(observation);
    }

    // Capture the status currently exposed by the direct-seed UI surface.
    function captureCurrentCompanionSeedStatus(source) {
      const status = document.getElementById("companionSeedStatus");
      if (!status) return;
      recordCompanionSeedStatus(
        source,
        status.getAttribute("data-state"),
        status.getAttribute("data-code")
      );
    }

    const install = () => {
      if (!document.documentElement) return;
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = [
          "html { padding-top: 82px !important; box-sizing: border-box !important; }",
          "body { min-height: calc(100vh - 82px) !important; }",
          "#" + bannerId + " { position: fixed; inset: 0 0 auto 0; z-index: 2147483647; min-height: 82px; box-sizing: border-box; padding: 10px 18px; border-bottom: 4px solid #fff; background: #b00020; color: #fff; font: 700 16px/1.25 Arial, sans-serif; letter-spacing: 0; text-align: center; pointer-events: none; }",
          "#" + bannerId + " small { display: block; margin-top: 4px; color: #fff; font-size: 12px; letter-spacing: 0; }",
          "#" + bannerId + " [data-demo-boundary-mobile] { display: none; }",
          "#" + bannerId + " [data-demo-stage] { display: inline-block; margin-left: 8px; padding: 2px 6px; border: 1px solid #fff; background: #111; color: #fff; font-size: 12px; letter-spacing: 0; }",
          "@media (max-width: 640px) { html { padding-top: 118px !important; } body { min-height: calc(100vh - 118px) !important; } #" + bannerId + " { min-height: 118px; padding: 7px 9px; } #" + bannerId + " > div { font-size: 15px !important; } #" + bannerId + " small { margin-top: 3px; font-size: 10px; } #" + bannerId + " [data-demo-boundary] { display: none; } #" + bannerId + " [data-demo-boundary-mobile] { display: block; } #" + bannerId + " [data-demo-stage] { display: block; width: fit-content; max-width: 100%; margin: 4px auto 0; box-sizing: border-box; overflow-wrap: anywhere; font-size: 10px; } }"
        ].join("\\n");
        document.documentElement.append(style);
      }
      if (document.body && !document.getElementById(bannerId)) {
        const banner = document.createElement("aside");
        banner.id = bannerId;
        banner.setAttribute("role", "note");
        banner.setAttribute("aria-label", label);
        const title = document.createElement("div");
        title.textContent = label;
        title.style.cssText = "display: block !important; color: #fff !important; font: 700 19px/1.25 Arial, sans-serif !important; letter-spacing: 0 !important;";
        const detail = document.createElement("small");
        const boundary = document.createElement("span");
        boundary.dataset.demoBoundary = "";
        boundary.textContent = "Parser-required qualification-shaped fixture fields are not qualification evidence. Synthetic loopback bytes only.";
        const mobileBoundary = document.createElement("span");
        mobileBoundary.dataset.demoBoundaryMobile = "";
        mobileBoundary.textContent = "SYNTHETIC LOOPBACK FIXTURE ONLY";
        const stage = document.createElement("span");
        stage.dataset.demoStage = "";
        stage.textContent = "STARTING";
        detail.append(boundary, mobileBoundary, stage);
        banner.append(title, detail);
        document.body.prepend(banner);
      }
      if (!document.title.startsWith("[SYNTHETIC FIXTURE] ")) {
        document.title = "[SYNTHETIC FIXTURE] " + document.title;
      }
    };

    // Preserve both prior and current attribute values so a quick non-idle pulse cannot vanish.
    function observeDocumentMutations(mutations) {
      install();
      for (const mutation of mutations) {
        if (mutation.type === "childList" && mutation.target.id === "errorState") {
          for (const node of mutation.removedNodes) retainRuntimeError(node.textContent);
          for (const node of mutation.addedNodes) retainRuntimeError(node.textContent);
        }
        if (mutation.type !== "attributes" ||
            mutation.target.id !== "companionSeedStatus") continue;
        const currentState = mutation.target.getAttribute("data-state");
        const currentCode = mutation.target.getAttribute("data-code");
        recordCompanionSeedStatus(
          "attribute-previous",
          mutation.attributeName === "data-state" ? mutation.oldValue : currentState,
          mutation.attributeName === "data-code" ? mutation.oldValue : currentCode
        );
      }
      captureCurrentCompanionSeedStatus("mutation-current");
    }

    new MutationObserver(observeDocumentMutations).observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ["data-state", "data-code"]
    });
    document.addEventListener("DOMContentLoaded", install, { once: true });
    install();
    captureCurrentCompanionSeedStatus("initial-current");
  })();`;
}

// Allocate a host-side, bounded audit shared by every direct-P2P app context in one run.
function createCompanionSeedAudit() {
  return {
    observations: [],
    observationKeys: new Set(),
    overflowed: false
  };
}

// Merge one browser observation without allowing duplicates or an unbounded host queue.
function recordCompanionSeedObservation(audit, observation) {
  invariant(audit && Array.isArray(audit.observations) && audit.observationKeys instanceof Set,
    "Synthetic companion-seed audit is invalid");
  invariant(observation && typeof observation === "object" && !Array.isArray(observation),
    "Synthetic companion-seed observation is invalid");
  invariant(typeof observation.contextLabel === "string" && observation.contextLabel !== "",
    "Synthetic companion-seed context is invalid");
  invariant(typeof observation.documentId === "string" && observation.documentId !== "",
    "Synthetic companion-seed document identity is invalid");
  if (observation.overflowed === true) {
    audit.overflowed = true;
    return;
  }
  invariant(Number.isSafeInteger(observation.sequence) && observation.sequence > 0 &&
    observation.sequence <= COMPANION_SEED_OBSERVATION_LIMIT,
  "Synthetic companion-seed sequence is invalid");
  invariant(typeof observation.source === "string" &&
    typeof observation.state === "string" && typeof observation.code === "string",
  "Synthetic companion-seed values are invalid");
  const key = `${observation.contextLabel}\0${observation.documentId}\0${observation.sequence}`;
  if (audit.observationKeys.has(key)) return;
  if (audit.observations.length >= COMPANION_SEED_OBSERVATION_LIMIT) {
    audit.overflowed = true;
    return;
  }
  audit.observationKeys.add(key);
  audit.observations.push(Object.freeze({
    contextLabel: observation.contextLabel,
    documentId: observation.documentId,
    sequence: observation.sequence,
    source: observation.source,
    state: observation.state,
    code: observation.code
  }));
}

// Flush the browser-local audit before a live page is closed, preserving every prior pulse.
async function flushCompanionSeedAudit(page, audit) {
  const snapshot = await page.evaluate((auditKey) => globalThis[auditKey] || null,
    COMPANION_SEED_AUDIT_KEY);
  invariant(snapshot && Array.isArray(snapshot.observations),
    "Synthetic companion-seed browser audit is missing");
  if (snapshot.overflowed === true) audit.overflowed = true;
  for (const observation of snapshot.observations) {
    recordCompanionSeedObservation(audit, observation);
  }
}

// Convert the bounded status history into a fail-closed, public-safe direct-P2P fact.
function summarizeCompanionSeedAudit(audit, expectedContextLabels) {
  invariant(Array.isArray(expectedContextLabels) && expectedContextLabels.length > 0,
    "Synthetic companion-seed expected contexts are invalid");
  invariant(audit.overflowed === false,
    "Synthetic companion-seed audit exceeded its observation bound");
  invariant(audit.observations.length > 0,
    "Synthetic companion-seed status was never observed");
  const observedContextLabels = [...new Set(audit.observations.map(
    (observation) => observation.contextLabel
  ))].sort();
  const requiredContextLabels = [...new Set(expectedContextLabels)].sort();
  invariant(JSON.stringify(observedContextLabels) === JSON.stringify(requiredContextLabels),
    "Synthetic companion-seed context coverage is incomplete or unexpected");
  const nonIdleObservations = audit.observations.filter((observation) =>
    observation.state !== "idle" || observation.code !== "none");
  invariant(nonIdleObservations.length === 0,
    "Direct-P2P synthetic flow changed companionSeedStatus away from idle/none");
  return Object.freeze({
    elementId: "companionSeedStatus",
    requiredState: "idle",
    requiredCode: "none",
    observationLimit: COMPANION_SEED_OBSERVATION_LIMIT,
    observationCount: audit.observations.length,
    nonIdleObservationCount: nonIdleObservations.length,
    observedStates: [...new Set(audit.observations.map(
      (observation) => observation.state
    ))].sort(),
    observedCodes: [...new Set(audit.observations.map(
      (observation) => observation.code
    ))].sort(),
    observedContextLabels,
    remainedIdleThroughoutDirectP2P: true
  });
}

// Count every denied origin class so success cannot hide an unowned loopback request.
function summarizeBlockedRequests(network) {
  invariant(Array.isArray(network), "Synthetic network observation list is invalid");
  const blockedExternalOrigins = new Set();
  const blockedUnownedLoopbackOrigins = new Set();
  let blockedExternalRequestCount = 0;
  let blockedUnownedLoopbackRequestCount = 0;
  for (const entry of network) {
    if (entry.action !== "blocked-external" &&
        entry.action !== "blocked-unowned-loopback") continue;
    const origin = new URL(entry.url).origin;
    if (entry.action === "blocked-unowned-loopback") {
      blockedUnownedLoopbackRequestCount += 1;
      blockedUnownedLoopbackOrigins.add(origin);
    } else {
      blockedExternalRequestCount += 1;
      blockedExternalOrigins.add(origin);
    }
  }
  return Object.freeze({
    blockedRequestCount:
      blockedExternalRequestCount + blockedUnownedLoopbackRequestCount,
    blockedExternalRequestCount,
    blockedUnownedLoopbackRequestCount,
    blockedExternalOrigins: [...blockedExternalOrigins].sort(),
    blockedUnownedLoopbackOrigins: [...blockedUnownedLoopbackOrigins].sort()
  });
}

// Reduce page exceptions and console errors to counts without publishing raw browser text.
function summarizeBrowserErrors(observations) {
  invariant(observations && Array.isArray(observations.pageErrors) &&
    Array.isArray(observations.consoleErrors),
  "Synthetic browser observation list is invalid");
  const pageErrorCount = observations.pageErrors.length;
  const consoleErrorCount = observations.consoleErrors.length;
  return Object.freeze({
    pageErrorCount,
    consoleErrorCount,
    errorFree: pageErrorCount === 0 && consoleErrorCount === 0
  });
}

// Enforce the shared synthetic success boundary and return its bounded report facts.
function verifySyntheticSafety(network, observations, companionSeedAudit,
  expectedContextLabels, modeLabel) {
  const traffic = summarizeBlockedRequests(network);
  invariant(traffic.blockedUnownedLoopbackRequestCount === 0,
    `${modeLabel} observed a blocked request to an unowned loopback origin`);
  invariant(traffic.blockedExternalRequestCount === 0,
    `${modeLabel} observed a blocked request to an external origin`);
  invariant(traffic.blockedRequestCount === 0,
    `${modeLabel} observed a blocked request`);
  const browser = summarizeBrowserErrors(observations);
  invariant(browser.pageErrorCount === 0,
    `${modeLabel} observed a browser page error: ${String(
      observations.pageErrors[0] || "unknown"
    ).slice(0, 300)}`);
  invariant(browser.consoleErrorCount === 0,
    `${modeLabel} observed a browser console error: ${String(
      observations.consoleErrors[0] || "unknown"
    ).slice(0, 300)}`);
  const companionSeedStatus = summarizeCompanionSeedAudit(
    companionSeedAudit,
    expectedContextLabels
  );
  return Object.freeze({ traffic, browser, companionSeedStatus });
}

function isStrictChild(parentPath, candidatePath) {
  const relative = path.relative(parentPath, candidatePath);
  return relative !== "" && relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

// Admit a canonical artifact parent and separate retained evidence from disposable scratch.
function createOwnedRunDirectory(tempRoot = DEFAULT_TEMP_ROOT) {
  const retainedRun = operationScratch.createOwnedTemporaryDirectory({ temporaryParent: tempRoot });
  let scratch = null;
  try {
    const runRoot = retainedRun.rootPath;
    const outputDirectory = path.join(runRoot, "artifacts");
    fs.mkdirSync(outputDirectory);
    scratch = operationScratch.createOwnedTemporaryDirectory({ temporaryParent: BROWSER_SCRATCH_ROOT });
    const profileParent = scratch.rootPath;
    return Object.freeze({ realRoot: retainedRun.temporaryParent, runRoot,
      outputDirectory, profileParent, retainedRun, scratch });
  } catch (error) {
    if (scratch) operationScratch.removeOwnedTemporaryDirectory(scratch);
    operationScratch.removeOwnedTemporaryDirectory(retainedRun);
    throw error;
  }
}

// Keep browser temporary output in the disposable owned tree and restore the caller's values.
function setOwnedTemporaryEnvironment(runRoot) {
  const previous = Object.freeze({
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    TMPDIR: process.env.TMPDIR
  });
  process.env.TEMP = runRoot;
  process.env.TMP = runRoot;
  process.env.TMPDIR = runRoot;
  return () => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
}

// Remove only the marked scratch allocation; retained evidence stays bound to its own owner.
function cleanOwnedRunResidue(ownedRun) {
  operationScratch.verifyOwnedTemporaryDirectory(ownedRun.retainedRun);
  operationScratch.removeOwnedTemporaryDirectory(ownedRun.scratch);
  operationScratch.verifyOwnedTemporaryDirectory(ownedRun.retainedRun);
  invariant(fs.readdirSync(ownedRun.runRoot).every((entry) => entry === "artifacts"),
    "Synthetic demo run root retained non-artifact residue");
}

function writeNotice(outputDirectory) {
  const lines = [
    DEMO_LABEL,
    "",
    "These files demonstrate compact chooser, direct loopback transfer, OPFS cache/reopen,",
    "progress, and cancellation mechanics with deterministic synthetic fixture bytes.",
    "The app's real rejection of the non-executable fixtures is recorded, not hidden or",
    "relabeled as runtime success. No inference is attempted.",
    "They are not live model, qualification, inference, deployment, or P2P reachability evidence.",
    "No production MiniModel catalog or model file is read or changed by this walkthrough.",
    ""
  ];
  fs.writeFileSync(path.join(outputDirectory, NOTICE_FILE), lines.join("\n"), {
    encoding: "utf8",
    flag: "wx"
  });
}

function fulfillJson(route, body) {
  const bytes = Buffer.from(`${JSON.stringify(body)}\n`, "utf8");
  return route.fulfill({
    status: 200,
    contentType: "application/json; charset=utf-8",
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
      "Content-Length": String(bytes.byteLength)
    },
    body: bytes
  });
}

async function configureContext(context, options) {
  invariant(typeof options.contextLabel === "string" && options.contextLabel !== "",
    "Synthetic browser context label is invalid");
  invariant(options.companionSeedAudit &&
    Array.isArray(options.companionSeedAudit.observations),
  "Synthetic companion-seed audit is missing");
  const network = options.network;

  // Relay each browser-side seed-status transition into the bounded host audit.
  function receiveCompanionSeedStatus(_source, observation) {
    recordCompanionSeedObservation(options.companionSeedAudit, observation);
  }

  await context.exposeBinding(COMPANION_SEED_BINDING, receiveCompanionSeedStatus);
  const bannerScript = bannerInitScript(options.contextLabel);
  Function(bannerScript);
  await context.addInitScript({ content: bannerScript });
  context.on("request", (request) => {
    const url = request.url();
    try {
      const origin = new URL(url).origin;
      if (origin === options.applicationOrigin || origin === options.peerOrigin) {
        network.push({
          action: origin === options.peerOrigin ? "loopback-peer" : "loopback-app",
          method: request.method(),
          url
        });
      }
    } catch (_error) {
      // Non-network browser URLs carry no model bytes.
    }
  });
  // This first-registered fallback lets later fixture routes fulfill catalog data while
  // admitting ordinary traffic only to the two exact owned loopback origins.
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = request.url();
    let origin = null;
    try {
      origin = new URL(url).origin;
    } catch (_error) {
      // An unparseable network target is outside the synthetic fixture contract.
    }
    if (origin === options.applicationOrigin || origin === options.peerOrigin) {
      await route.continue();
      return;
    }
    const action = origin && /^(?:http|https):\/\/(?:127\.0\.0\.1|localhost)(?::|$)/u
      .test(origin)
      ? "blocked-unowned-loopback"
      : "blocked-external";
    network.push({ action, method: request.method(), url });
    await route.abort("blockedbyclient");
  });
  const siteReleaseUrl = new URL(
    "/.well-known/site-release.json",
    options.applicationOrigin
  ).href;
  // Return an unmistakably synthetic invalid placeholder; the app must show release unavailable.
  await context.route(siteReleaseUrl, async (route) => {
    const request = route.request();
    if (request.method() !== "GET") {
      await route.abort("blockedbyclient");
      return;
    }
    network.push({ action: "fixture-site-release-placeholder", method: "GET", url: request.url() });
    await fulfillJson(route, {
      schema: "tinyrustlm.synthetic_site_release_unavailable.v1",
      label: DEMO_LABEL,
      testOnly: true,
      deploymentEvidence: false
    });
  });
  await context.route(CATALOG_URL, async (route) => {
    const request = route.request();
    if (request.method() !== "GET") {
      await route.abort("blockedbyclient");
      return;
    }
    network.push({ action: "fixture-catalog", method: "GET", url: request.url() });
    await fulfillJson(route, options.documents.catalog);
  });
  await context.route(PEER_FEED_URL, async (route) => {
    const request = route.request();
    if (request.method() !== "GET") {
      await route.abort("blockedbyclient");
      return;
    }
    network.push({ action: "fixture-peer-feed", method: "GET", url: request.url() });
    await fulfillJson(route, options.documents.peerFeed);
  });
  for (const [url, admissionText] of options.documents.admissions) {
    await context.route(url, async (route) => {
      const request = route.request();
      if (request.method() !== "GET") {
        await route.abort("blockedbyclient");
        return;
      }
      const body = Buffer.from(admissionText, "utf8");
      network.push({ action: "fixture-admission", method: "GET", url: request.url() });
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
          "Content-Length": String(body.byteLength)
        },
        body
      });
    });
  }
  for (const [url, receiptText] of options.documents.qualificationReceipts) {
    await context.route(url, async (route) => {
      const request = route.request();
      if (request.method() !== "GET") {
        await route.abort("blockedbyclient");
        return;
      }
      const body = Buffer.from(receiptText, "utf8");
      network.push({ action: "fixture-qualification-receipt", method: "GET", url: request.url() });
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
          "Content-Length": String(body.byteLength)
        },
        body
      });
    });
  }
}

// Admit an explicitly requested installed Edge; absence keeps Playwright's pinned Chromium.
function requireBrowserChannel(channel) {
  invariant(channel === undefined || channel === "msedge",
    "Synthetic demo browser channel must be absent or msedge");
  return channel;
}

// Preserve the same owned profile and network controls for either explicit browser target.
async function launchOwnedContext(profilePath, headless, channel) {
  return chromium.launchPersistentContext(profilePath, {
    headless,
    channel,
    viewport: DESKTOP_VIEWPORT,
    colorScheme: "dark",
    locale: "en-US",
    serviceWorkers: "block",
    acceptDownloads: false,
    args: [
      "--disable-background-networking",
      "--disable-component-update",
      "--no-default-browser-check",
      "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost"
    ]
  });
}

async function waitForValue(read, accept, label, timeoutMilliseconds = 30_000) {
  const deadline = Date.now() + timeoutMilliseconds;
  let lastError = null;
  let lastValue;
  while (Date.now() <= deadline) {
    try {
      const value = await read();
      lastValue = value;
      if (accept(value)) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const detail = lastError instanceof Error ? `: ${lastError.message}` : "";
  const state = lastValue === undefined
    ? ""
    : `; last state: ${JSON.stringify(lastValue).slice(0, 500)}`;
  throw new Error(`${label} did not become ready${detail}${state}`);
}

async function readChooserActionState(action) {
  return action.evaluate((button) => ({
    hidden: button.hidden,
    disabled: button.disabled,
    ariaBusy: button.ownerDocument
      .getElementById("simpleModelList")
      ?.getAttribute("aria-busy") || null
  }));
}

async function setDemoStage(page, stage) {
  await waitForValue(
    () => page.evaluate(({ label, stageText }) => {
      const banner = document.getElementById("tinyrustlm-synthetic-fixture-demo-banner");
      const stageElement = banner && banner.querySelector("[data-demo-stage]");
      if (!banner || !stageElement) return null;
      stageElement.textContent = stageText;
      return banner.getAttribute("aria-label") + "\\n" + banner.textContent;
    }, { label: DEMO_LABEL, stageText: stage }),
    (value) => typeof value === "string" && value.includes(DEMO_LABEL) && value.includes(stage),
    "Synthetic demo banner"
  );
}

async function captureStage(page, outputDirectory, fileName, stage, delayMilliseconds) {
  const evidence = SCREENSHOT_EVIDENCE.find((entry) => entry.fileName === fileName);
  invariant(evidence, "Synthetic demo screenshot name is not registered");
  await page.setViewportSize({ width: evidence.width, height: evidence.height });
  await setDemoStage(page, stage);
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  await page.screenshot({
    path: path.join(outputDirectory, fileName),
    animations: "disabled"
  });
  if (delayMilliseconds > 0) await page.waitForTimeout(delayMilliseconds);
}

function observePage(page, observations) {
  // Preserve uncaught page exceptions so the run cannot report a clean browser falsely.
  page.on("pageerror", (error) => {
    observations.pageErrors.push(String(error && error.message || error));
  });
  // Preserve console errors separately while keeping their raw text out of success reports.
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location();
    observations.consoleErrors.push(
      `${message.text()}${location.url ? ` @ ${location.url}` : ""}`
    );
  });
}

// Read chooser semantics instead of coupling the demo to changing user-facing copy.
async function readSyntheticChooserCatalogState(page) {
  return page.evaluate(() => {
    const status = document.getElementById("simpleModelPickerStatus");
    const cards = [...document.querySelectorAll(".simple-model-option")];
    return {
      statusText: String(status?.textContent || ""),
      statusIsError: Boolean(status?.classList.contains("error")),
      errorState: String(document.getElementById("errorState")?.textContent || "").trim(),
      modelState: String(document.getElementById("modelState")?.textContent || "").trim(),
      runtimeStatus: String(document.getElementById("runtimeStatus")?.textContent || "").trim(),
      cardCount: cards.length,
      qualifiedP2pCardCount: cards.filter(
        (card) => card.dataset.route === "qualified-p2p"
      ).length
    };
  });
}

// Counts every observed request to Hugging Face or one of its subdomains.
function countHuggingFaceRequests(network) {
  return network.filter((entry) => {
    try {
      const hostname = new URL(entry.url).hostname.toLowerCase();
      return hostname === "huggingface.co" || hostname.endsWith(".huggingface.co");
    } catch (_error) {
      return false;
    }
  }).length;
}

// Reads the compact chooser's initial UX contract without activating any control.
async function readCompactChooserUxState(page) {
  return page.evaluate((label) => {
    const panel = document.getElementById("simpleDiscoveryPanel");
    const cards = [...document.querySelectorAll(".simple-model-option")];
    const defaults = cards.filter((card) => card.dataset.default === "true");
    const appShell = document.querySelector(".app-shell");
    const advancedMode = document.getElementById("advancedModeButton");
    const advancedRail = document.getElementById("diagnosticsRail");
    const hfSearch = document.getElementById("hfSearchInput");
    const hfResults = document.getElementById("hfResults");
    const banner = document.getElementById("tinyrustlm-synthetic-fixture-demo-banner");
    const bannerStyle = banner ? getComputedStyle(banner) : null;
    return {
      chooserVisible: Boolean(panel && !panel.hidden),
      defaultSelectionCount: defaults.length,
      defaultCompositionId: defaults[0]?.dataset.compositionId || "",
      defaultRoute: defaults[0]?.dataset.route || "",
      defaultFocused: defaults.length === 1 && document.activeElement === defaults[0],
      simpleMode: appShell?.dataset.mode === "simple" &&
        advancedMode?.getAttribute("aria-pressed") === "false",
      advancedCollapsed: appShell?.dataset.railCollapsed === "true",
      advancedInert: Boolean(advancedRail?.inert && advancedRail.hasAttribute("inert") &&
        advancedRail.getAttribute("aria-hidden") === "true"),
      focusOutsideAdvanced: Boolean(advancedRail && !advancedRail.contains(document.activeElement)),
      huggingFaceSearchEmpty: hfSearch?.value === "",
      huggingFaceResultsEmpty: hfResults?.childElementCount === 0,
      syntheticBannerExact: Boolean(banner && banner.getAttribute("aria-label") === label &&
        banner.firstElementChild?.textContent === label && !banner.hidden &&
        bannerStyle?.display !== "none" && bannerStyle?.visibility !== "hidden")
    };
  }, DEMO_LABEL);
}

// Requires the basic-user chooser state before any synthetic acquisition begins.
async function verifyCompactChooserUxState(page, admittedCompositionIds, network) {
  invariant(Array.isArray(admittedCompositionIds) && admittedCompositionIds.length === 2 &&
    new Set(admittedCompositionIds).size === 2,
  "Synthetic compact chooser admission identities are invalid");
  const observed = await waitForValue(
    () => readCompactChooserUxState(page),
    (value) => Boolean(value && value.chooserVisible &&
      value.defaultSelectionCount === 1 &&
      admittedCompositionIds.includes(value.defaultCompositionId) &&
      value.defaultRoute === "qualified-p2p" &&
      value.defaultFocused && value.simpleMode && value.advancedCollapsed &&
      value.advancedInert && value.focusOutsideAdvanced &&
      value.huggingFaceSearchEmpty && value.huggingFaceResultsEmpty &&
      value.syntheticBannerExact),
    "Synthetic compact chooser UX contract"
  );
  const huggingFaceRequestCount = countHuggingFaceRequests(network);
  invariant(huggingFaceRequestCount === 0,
    "Synthetic compact chooser made a Hugging Face request");
  return Object.freeze({
    defaultSelectionPreselected: observed.defaultSelectionCount === 1 &&
      admittedCompositionIds.includes(observed.defaultCompositionId),
    defaultSelectionQualifiedP2p: observed.defaultRoute === "qualified-p2p",
    defaultSelectionFocused: observed.defaultFocused,
    advancedCollapsed: observed.advancedCollapsed,
    advancedInert: observed.advancedInert,
    huggingFaceSearchEmpty: observed.huggingFaceSearchEmpty,
    huggingFaceResultsEmpty: observed.huggingFaceResultsEmpty,
    huggingFaceRequestCount,
    syntheticBannerExact: observed.syntheticBannerExact
  });
}

// A seeded fixture must show its exact catalog rejection; clean startup must have no error.
async function openApplication(context, applicationOrigin, observations, expectedCachedRejection = false) {
  const page = context.pages()[0] || await context.newPage();
  observePage(page, observations);
  await page.goto(new URL("/app/", applicationOrigin).href, {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  await page.locator(".app-shell").waitFor({ state: "visible", timeout: 30_000 });
  await waitForValue(
    () => readSyntheticChooserCatalogState(page),
    (value) => value.cardCount === 2 && value.qualifiedP2pCardCount === 2 &&
      (expectedCachedRejection
        ? value.statusIsError === true && value.errorState === EXPECTED_CACHE_REJECTION &&
          value.modelState === "browser cache unavailable" &&
          value.runtimeStatus === "Choose a qualified composition"
        : value.statusIsError === false),
    "Synthetic compact chooser catalog",
    30_000
  );
  return page;
}

// A wrapped install error counts only with the exact real-worker cause for this fixture identity.
function isExpectedFixtureRejection(value, expectedSurface, expectedIdentity) {
  if (!value || !value.runtimeErrors || value.runtimeErrors.overflowed ||
      !Array.isArray(value.runtimeErrors.workerRejections) ||
      !Array.isArray(value.runtimeErrors.errors)) return false;
  if (expectedSurface === "simple-model-picker") {
    const expectedErrors = [EXPECTED_CACHE_REJECTION, "model-composition-store-lock", value.errorState];
    return Boolean(expectedIdentity && value.pickerErrorVisible &&
      value.modelState === "P2P install stopped" &&
      value.errorState.endsWith("(p2p-composition-install-store)") &&
      value.runtimeErrors.errors.length === expectedErrors.length &&
      value.runtimeErrors.errors.every((error, index) => error === expectedErrors[index]) &&
      value.runtimeErrors.workerRejections.length === 1 &&
      value.runtimeErrors.workerRejections.some((rejection) =>
        rejection.code === EXPECTED_CANDIDATE_REJECTION &&
        rejection.operationId === expectedIdentity.operationId &&
        rejection.compositionId === expectedIdentity.compositionId));
  }
  return expectedSurface === "browser-cache" &&
    value.errorState === EXPECTED_CACHE_REJECTION &&
    value.runtimeStatus === "Choose a qualified composition" &&
    value.modelState === "browser cache unavailable" &&
    value.friendlyErrorVisible && value.pickerErrorVisible &&
    value.runtimeErrors.errors.length === 1 &&
    value.runtimeErrors.errors[0] === EXPECTED_CACHE_REJECTION &&
    value.runtimeErrors.workerRejections.length === 0;
}

// Record only exact observed rejection evidence, never reinterpret an arbitrary error as success.
async function waitForFixtureRejection(page, phase, expectedSurface, expectedFixture) {
  invariant(["simple-model-picker", "browser-cache"].includes(expectedSurface),
    "Synthetic rejection surface is invalid");
  const expectedIdentity = expectedFixture ? {
    operationId: JSON.parse(expectedFixture.admissionText).operationId,
    compositionId: expectedFixture.compositionId.slice("sha256:".length)
  } : null;
  const observed = await waitForValue(
    () => page.evaluate((auditKey) => {
      const text = (selector) => String(
        document.querySelector(selector)?.textContent || ""
      ).trim();
      const simpleErrorPanel = document.querySelector("#simpleErrorPanel");
      const pickerStatus = document.querySelector("#simpleModelPickerStatus");
      return {
        runtimeStatus: text("#runtimeStatus"),
        modelState: text("#modelState"),
        errorState: text("#errorState"),
        runtimeErrors: globalThis[auditKey] || null,
        pickerStatus: text("#simpleModelPickerStatus"),
        pickerErrorVisible: Boolean(
          pickerStatus && pickerStatus.classList.contains("error")
        ),
        friendlyErrorVisible: Boolean(simpleErrorPanel && !simpleErrorPanel.hidden),
        friendlyErrorMessage: text("#simpleErrorMessage")
      };
    }, RUNTIME_ERROR_AUDIT_KEY),
    (value) => isExpectedFixtureRejection(value, expectedSurface, expectedIdentity),
    `Synthetic ${phase} rejection`,
    90_000
  );
  const failureStatus = expectedSurface === "simple-model-picker"
    ? observed.pickerStatus
    : observed.modelState;
  const rejectionCode = expectedSurface === "simple-model-picker"
    ? EXPECTED_CANDIDATE_REJECTION : EXPECTED_CACHE_REJECTION;
  const failureText = rejectionCode;
  const rawError = Buffer.from(failureText, "utf8");
  return Object.freeze({
    phase,
    attempted: true,
    runtimeActivationAttempted: expectedSurface === "simple-model-picker",
    outcome: "rejected",
    fixtureExecutable: false,
    rejectionCode,
    rejectionEvidence: expectedSurface === "simple-model-picker"
      ? "identity-bound-worker-command-rejected" : "current-catalog-rejection",
    failureSurface: expectedSurface,
    failureStatus,
    runtimeStatus: observed.runtimeStatus,
    modelState: observed.modelState,
    pickerErrorVisible: observed.pickerErrorVisible,
    friendlyErrorVisible: observed.friendlyErrorVisible,
    friendlyErrorMessage: observed.friendlyErrorMessage,
    errorByteLength: rawError.byteLength,
    errorSha256: sha256(rawError),
    inferenceAttempted: false
  });
}

async function openChooser(page) {
  const chooser = page.locator("#simpleDiscoveryPanel");
  const opener = page.locator("#modelEditButton");
  let lastClickError = null;
  for (let attempt = 0; attempt < 4 && !await chooser.isVisible(); attempt += 1) {
    try {
      await opener.click({ timeout: 1_500 });
    } catch (error) {
      lastClickError = error;
    }
    if (!await chooser.isVisible()) await page.waitForTimeout(50);
  }
  if (!await chooser.isVisible() && lastClickError) throw lastClickError;
  await chooser.waitFor({ state: "visible" });
  await waitForValue(
    () => chooser.locator(".simple-model-option").count(),
    (value) => value === 2,
    "Synthetic chooser cards"
  );
  return chooser;
}

function peerTransferProgress(peer, fixture) {
  const requests = peer.requests.filter((request) => request.fixtureLabel === fixture.label);
  const bytesWritten = requests.reduce((total, request) => total + request.bytesWritten, 0);
  const totalBytes = fixture.manifest.members.reduce(
    (total, member) => total + member.byteLength,
    0
  );
  const percent = Math.floor((bytesWritten / totalBytes) * 100);
  return Object.freeze({
    bytesWritten,
    totalBytes,
    percent,
    requestCount: requests.length,
    text: `Peer transport ${fixture.label}: ${bytesWritten} / ${totalBytes} bytes (${percent}%)`
  });
}

async function waitForPeerTransferProgress(peer, fixture, label) {
  const threshold = Math.ceil(fixture.manifest.members.reduce(
    (total, member) => total + member.byteLength,
    0
  ) / 100);
  return waitForValue(
    () => peerTransferProgress(peer, fixture),
    (value) => value.bytesWritten >= threshold && value.bytesWritten < value.totalBytes &&
      value.percent >= 1 && value.percent < 100,
    label,
    30_000
  );
}

async function readOpfsInventory(page) {
  return page.evaluate(async (rootName) => {
    try {
      const storageRoot = await navigator.storage.getDirectory();
      const root = await storageRoot.getDirectoryHandle(rootName, { create: false });
      const pointerHandle = await root.getFileHandle("active.json", { create: false });
      const pointerText = await (await pointerHandle.getFile()).text();
      const list = async (name) => {
        try {
          const directory = await root.getDirectoryHandle(name, { create: false });
          const entries = [];
          for await (const [entryName, handle] of directory.entries()) {
            entries.push({ name: entryName, kind: handle.kind });
          }
          return entries.sort((left, right) => left.name.localeCompare(right.name));
        } catch (_error) {
          return [];
        }
      };
      return {
        pointerText,
        pointer: JSON.parse(pointerText),
        installedEntries: await list("installed"),
        stagingEntries: await list("staging")
      };
    } catch (_error) {
      return null;
    }
  }, OPFS_ROOT_NAME);
}

async function openRuntimePage(context, applicationOrigin, observations) {
  const page = context.pages()[0] || await context.newPage();
  observePage(page, observations);
  await page.goto(new URL("/app/browser-model-admission.js", applicationOrigin).href, {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  for (const scriptName of RUNTIME_SCRIPTS) {
    await page.addScriptTag({ url: new URL(`/app/${scriptName}`, applicationOrigin).href });
  }
  return page;
}

async function openEvidencePage(context, applicationOrigin, observations) {
  const page = await context.newPage();
  observePage(page, observations);
  await page.goto(new URL("/app/browser-model-admission.js", applicationOrigin).href, {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  return page;
}

async function seedSyntheticPrior(page, fixture) {
  const browserFixture = {
    admissionAuthority: fixture.admissionAuthority,
    manifest: fixture.manifest,
    manifestSha256: fixture.manifestSha256,
    members: Object.fromEntries(MEMBER_NAMES.map((fileName) => [
      fileName,
      fixture.memberBuffers[fileName].toString("base64")
    ]))
  };
  return page.evaluate(async ({ value, storeChunkBytes }) => {
    const incrementalShaApi = globalThis.TinyRustLMIncrementalSha256;
    const storeApi = globalThis.TinyRustLMModelCompositionStore;
    const decode = (encoded) => {
      const binary = atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return bytes;
    };
    const sources = Object.fromEntries(storeApi.memberNames.map((fileName) => [
      fileName,
      {
        async *[Symbol.asyncIterator]() {
          yield decode(value.members[fileName]);
        }
      }
    ]));
    const store = storeApi.createModelCompositionStore({
      adapter: storeApi.createOpfsAdapter({
        createSha256: () => incrementalShaApi.createSha256()
      }),
      chunkBytes: storeChunkBytes,
      maximumCompositionBytes: 4 * 1024 * 1024
    });
    const installed = await store.install({
      manifest: value.manifest,
      admissionAuthority: value.admissionAuthority,
      sources,
      activate: async (candidate, context) =>
        context.previousComposition === null &&
        candidate.manifestSha256 === value.manifestSha256,
      authorizeCommit: async (candidate, context) =>
        context.previousComposition === null &&
        candidate.manifestSha256 === value.manifestSha256
    });
    return {
      manifestSha256: installed.manifestSha256,
      admissionSha256: installed.admissionAuthority.admissionSha256,
      activationId: installed.activationId
    };
  }, { value: browserFixture, storeChunkBytes: STORE_CHUNK_BYTES });
}

async function verifyCachedComposition(page) {
  return page.evaluate(async ({ storeChunkBytes }) => {
    const incrementalShaApi = globalThis.TinyRustLMIncrementalSha256;
    const storeApi = globalThis.TinyRustLMModelCompositionStore;
    const hex = (bytes) => Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const store = storeApi.createModelCompositionStore({
      adapter: storeApi.createOpfsAdapter({
        createSha256: () => incrementalShaApi.createSha256()
      }),
      chunkBytes: storeChunkBytes,
      maximumCompositionBytes: 4 * 1024 * 1024
    });
    const active = await store.openActive();
    const members = {};
    for (const fileName of storeApi.memberNames) {
      const hasher = incrementalShaApi.createSha256();
      let byteLength = 0;
      let chunks = 0;
      for await (const chunk of active.streamMember(fileName)) {
        hasher.update(chunk);
        byteLength += chunk.byteLength;
        chunks += 1;
      }
      members[fileName] = {
        byteLength,
        chunks,
        sha256: hex(hasher.digest())
      };
    }
    return {
      manifestSha256: active.manifestSha256,
      admissionSha256: active.admissionAuthority.admissionSha256,
      activationId: active.activationId,
      members
    };
  }, { storeChunkBytes: STORE_CHUNK_BYTES });
}

async function renderFixtureEvidence(page, evidence) {
  await page.evaluate(({ label, evidenceValue }) => {
    document.title = `[SYNTHETIC FIXTURE EVIDENCE] ${evidenceValue.heading}`;
    document.body.replaceChildren();
    document.body.style.margin = "0";
    document.body.style.background = "#101216";
    document.body.style.color = "#f5f7fa";
    document.body.style.fontFamily = "Arial, sans-serif";

    const oldStyle = document.getElementById("tinyrustlm-fixture-evidence-style");
    if (oldStyle) oldStyle.remove();
    const style = document.createElement("style");
    style.id = "tinyrustlm-fixture-evidence-style";
    style.textContent = [
      ".fixture-evidence { max-width: 1120px; margin: 24px auto; padding: 22px; box-sizing: border-box; }",
      ".fixture-evidence * { box-sizing: border-box; letter-spacing: 0; }",
      ".fixture-evidence .eyebrow { margin: 0 0 8px; color: #7eb8ff; font-size: 12px; font-weight: 700; text-transform: uppercase; }",
      ".fixture-evidence h1 { margin: 0; font-size: 30px; line-height: 1.15; }",
      ".fixture-evidence .scope { margin: 14px 0 18px; padding: 12px 14px; border-left: 4px solid #f4c95d; background: #1a1f27; line-height: 1.45; }",
      ".fixture-evidence .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 0 0 20px; }",
      ".fixture-evidence .metric { min-height: 82px; padding: 12px 0; border-top: 2px solid #4f6075; border-bottom: 1px solid #343a43; }",
      ".fixture-evidence .metric[data-tone='verified'] { border-top-color: #39d98a; }",
      ".fixture-evidence .metric[data-tone='boundary'] { border-top-color: #f4c95d; }",
      ".fixture-evidence .metric span { display: block; color: #aeb8c5; font-size: 12px; }",
      ".fixture-evidence .metric strong { display: block; margin-top: 7px; font-size: 16px; line-height: 1.3; overflow-wrap: anywhere; }",
      ".fixture-evidence dl { display: grid; grid-template-columns: 210px minmax(0, 1fr); gap: 8px 16px; margin: 0; padding: 14px 0; border-top: 1px solid #343a43; border-bottom: 1px solid #343a43; }",
      ".fixture-evidence dt { color: #aeb8c5; }",
      ".fixture-evidence dd { margin: 0; overflow-wrap: anywhere; }",
      ".fixture-evidence code { color: #d8e7ff; font: 12px/1.4 Consolas, monospace; }",
      ".fixture-evidence .members { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 16px; }",
      ".fixture-evidence .member { padding: 5px 7px; border: 1px solid #4f6075; color: #d8e7ff; font: 12px/1.2 Consolas, monospace; }",
      ".fixture-evidence .footnote { margin: 16px 0 0; color: #aeb8c5; font-size: 12px; line-height: 1.4; }",
      "@media (max-width: 640px) { .fixture-evidence { margin: 0; padding: 14px 13px; } .fixture-evidence .eyebrow { font-size: 10px; } .fixture-evidence h1 { font-size: 24px; } .fixture-evidence .scope { margin: 10px 0 12px; padding: 9px 10px; font-size: 13px; } .fixture-evidence .metrics { display: block; margin-bottom: 12px; } .fixture-evidence .metric { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; min-height: 0; padding: 7px 0; } .fixture-evidence .metric strong { margin-top: 0; text-align: right; font-size: 13px; } .fixture-evidence dl { display: block; padding: 9px 0; font-size: 12px; } .fixture-evidence dt { margin-top: 7px; } .fixture-evidence dd { margin-top: 2px; } .fixture-evidence .members { gap: 5px; margin-top: 10px; } .fixture-evidence .member { padding: 3px 5px; font-size: 10px; } .fixture-evidence .footnote { margin-top: 10px; font-size: 10px; } }"
    ].join("\n");
    document.head.append(style);

    const main = document.createElement("main");
    main.className = "fixture-evidence";
    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "Acquisition-only fixture evidence";
    const heading = document.createElement("h1");
    heading.textContent = evidenceValue.heading;
    const scope = document.createElement("p");
    scope.className = "scope";
    scope.textContent = `${label}. ${evidenceValue.scope}`;
    const metrics = document.createElement("section");
    metrics.className = "metrics";
    metrics.setAttribute("aria-label", "Measured fixture outcomes");
    for (const metricValue of evidenceValue.metrics) {
      const metric = document.createElement("div");
      metric.className = "metric";
      metric.dataset.tone = metricValue.tone;
      const metricLabel = document.createElement("span");
      metricLabel.textContent = metricValue.label;
      const value = document.createElement("strong");
      value.textContent = metricValue.value;
      metric.append(metricLabel, value);
      metrics.append(metric);
    }
    const details = document.createElement("dl");
    for (const detail of evidenceValue.details) {
      const term = document.createElement("dt");
      term.textContent = detail.label;
      const value = document.createElement("dd");
      if (detail.code) {
        const code = document.createElement("code");
        code.textContent = detail.value;
        value.append(code);
      } else {
        value.textContent = detail.value;
      }
      details.append(term, value);
    }
    const members = document.createElement("div");
    members.className = "members";
    members.setAttribute("aria-label", "Six synthetic composition members");
    for (const memberName of evidenceValue.memberNames) {
      const member = document.createElement("span");
      member.className = "member";
      member.textContent = memberName;
      members.append(member);
    }
    const footnote = document.createElement("p");
    footnote.className = "footnote";
    footnote.textContent = "Measured browser state only. No runtime success or generated response is represented.";
    main.append(eyebrow, heading, scope, metrics, details, members, footnote);
    document.body.append(main);
  }, { label: DEMO_LABEL, evidenceValue: evidence });
}

function runtimeFailureIdentity(runtime) {
  return `sha256:${runtime.errorSha256} / ${runtime.errorByteLength} bytes`;
}

function rejectedCandidateEvidence(
  rejectedCandidateFixture,
  preservedPriorFixture,
  inventory,
  runtime
) {
  return Object.freeze({
    heading: "Synthetic candidate rejected atomically",
    scope: "The direct transfer completed, worker activation rejected the synthetic " +
      "candidate, and OPFS retained the prior pointer and bytes.",
    metrics: Object.freeze([
      Object.freeze({
        label: "Direct transfer",
        value: "6 / 6 members complete",
        tone: "verified"
      }),
      Object.freeze({
        label: "Active pointer",
        value: "Prior pointer retained",
        tone: "verified"
      }),
      Object.freeze({
        label: "Staging",
        value: `${inventory.stagingEntries.length} entries remain`,
        tone: "verified"
      }),
      Object.freeze({
        label: "Runtime activation",
        value: "Rejected (recorded)",
        tone: "boundary"
      })
    ]),
    details: Object.freeze([
      Object.freeze({
        label: "Rejected manifest SHA-256",
        value: rejectedCandidateFixture.manifestSha256,
        code: true
      }),
      Object.freeze({
        label: "Preserved prior manifest SHA-256",
        value: preservedPriorFixture.manifestSha256,
        code: true
      }),
      Object.freeze({
        label: "App failure status",
        value: runtime.failureStatus,
        code: false
      }),
      Object.freeze({
        label: "Runtime failure evidence",
        value: runtimeFailureIdentity(runtime),
        code: true
      }),
      Object.freeze({ label: "Fixture executable", value: "No", code: false }),
      Object.freeze({ label: "Inference attempted", value: "No", code: false })
    ]),
    memberNames: MEMBER_NAMES
  });
}

function cancellationProgressEvidence(progress, preservedPriorFixture, runtime) {
  return Object.freeze({
    heading: "Synthetic cancellation control armed",
    scope: "A second loopback transfer is paused after measured progress. The cached " +
      "fixture's catalog revalidation rejection is unrelated to cancellation proof.",
    metrics: Object.freeze([
      Object.freeze({
        label: "Peer progress",
        value: `${progress.bytesWritten} / ${progress.totalBytes} bytes`,
        tone: "verified"
      }),
      Object.freeze({ label: "App control observed", value: "Cancel", tone: "verified" }),
      Object.freeze({
        label: "Active pointer",
        value: "Prior pointer retained",
        tone: "verified"
      }),
      Object.freeze({
        label: "Cached composition",
        value: `${runtime.failureStatus} / rejected before runtime`,
        tone: "boundary"
      })
    ]),
    details: Object.freeze([
      Object.freeze({
        label: "Preserved prior manifest",
        value: preservedPriorFixture.manifestSha256,
        code: true
      }),
      Object.freeze({
        label: "Cache rejection evidence",
        value: runtimeFailureIdentity(runtime),
        code: true
      }),
      Object.freeze({ label: "Inference attempted", value: "No", code: false })
    ]),
    memberNames: MEMBER_NAMES
  });
}

function cancellationResultEvidence(preservedPriorFixture, inventory, request, runtime) {
  return Object.freeze({
    heading: "Synthetic cancellation remained atomic",
    scope: "The in-flight response closed early, staging was removed, and the prior active " +
      "pointer remained unchanged. Runtime success and inference are not claimed.",
    metrics: Object.freeze([
      Object.freeze({
        label: "Peer response",
        value: request.closedEarly ? "Closed early" : "Not closed",
        tone: "verified"
      }),
      Object.freeze({
        label: "Staging",
        value: `${inventory.stagingEntries.length} entries remain`,
        tone: "verified"
      }),
      Object.freeze({
        label: "Active pointer",
        value: "Unchanged",
        tone: "verified"
      }),
      Object.freeze({
        label: "Cache boundary",
        value: `${runtime.failureStatus} / rejected before runtime`,
        tone: "boundary"
      })
    ]),
    details: Object.freeze([
      Object.freeze({
        label: "Preserved prior manifest",
        value: preservedPriorFixture.manifestSha256,
        code: true
      }),
      Object.freeze({
        label: "Cancelled member bytes",
        value: `${request.bytesWritten} before close`,
        code: false
      }),
      Object.freeze({
        label: "Cache rejection evidence",
        value: runtimeFailureIdentity(runtime),
        code: true
      }),
      Object.freeze({ label: "Inference attempted", value: "No", code: false })
    ]),
    memberNames: MEMBER_NAMES
  });
}

async function renderCacheSummary(page, cache) {
  await page.evaluate(({ label, cacheValue }) => {
    document.body.replaceChildren();
    document.body.style.margin = "0";
    document.body.style.background = "#101216";
    document.body.style.color = "#f5f7fa";
    document.body.style.fontFamily = "Arial, sans-serif";
    const main = document.createElement("main");
    main.style.maxWidth = "1100px";
    main.style.margin = "28px auto";
    main.style.padding = "24px";
    const heading = document.createElement("h1");
    heading.textContent = "OPFS cache reopened and reverified";
    heading.style.fontSize = "30px";
    heading.style.letterSpacing = "0";
    const boundary = document.createElement("p");
    boundary.textContent = `${label}. Acquisition storage evidence only; runtime outcomes are recorded separately and inference is not claimed.`;
    boundary.style.padding = "12px";
    boundary.style.border = "2px solid #f4c95d";
    const pointer = document.createElement("p");
    pointer.textContent = `Preserved prior manifest: ${cacheValue.manifestSha256}`;
    pointer.style.fontFamily = "Consolas, monospace";
    pointer.style.overflowWrap = "anywhere";
    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    const header = document.createElement("tr");
    for (const value of ["Synthetic member", "Bytes", "Reopen chunks", "SHA-256 fixture match"]) {
      const cell = document.createElement("th");
      cell.textContent = value;
      cell.style.padding = "8px";
      cell.style.borderBottom = "1px solid #8892a0";
      cell.style.textAlign = "left";
      header.append(cell);
    }
    table.append(header);
    for (const [fileName, member] of Object.entries(cacheValue.members)) {
      const row = document.createElement("tr");
      for (const value of [fileName, String(member.byteLength), String(member.chunks), member.sha256]) {
        const cell = document.createElement("td");
        cell.textContent = value;
        cell.style.padding = "8px";
        cell.style.borderBottom = "1px solid #343a43";
        cell.style.fontFamily = value === member.sha256 ? "Consolas, monospace" : "inherit";
        cell.style.fontSize = value === member.sha256 ? "12px" : "14px";
        row.append(cell);
      }
      table.append(row);
    }
    main.append(heading, boundary, pointer, table);
    document.body.append(main);
  }, { label: DEMO_LABEL, cacheValue: cache });
}

function validateCache(cache, fixture) {
  invariant(cache.manifestSha256 === fixture.manifestSha256,
    "Reopened synthetic manifest identity changed");
  invariant(cache.admissionSha256 ===
      `sha256:${fixture.manifest.admissionAuthority.admission.sha256}`,
    "Reopened synthetic admission identity changed");
  invariant(/^[0-9a-f]{64}$/u.test(cache.activationId),
    "Reopened synthetic activation identity is invalid");
  for (const member of fixture.manifest.members) {
    const observed = cache.members[member.fileName];
    invariant(observed && observed.byteLength === member.byteLength &&
      observed.sha256 === member.sha256 && observed.chunks > 1,
    `Reopened synthetic member failed verification: ${member.fileName}`);
  }
}

function validatePeerRequests(
  peer,
  rejectedCandidateFixture,
  cancelledCandidateFixture,
  applicationOrigin
) {
  const rejectedCandidateRequests = peer.requests.filter(
    (request) => request.fixtureLabel === rejectedCandidateFixture.label
  );
  invariant(rejectedCandidateRequests.length === MEMBER_NAMES.length,
    "Synthetic rejected-candidate transfer did not request exactly six members");
  for (const fileName of MEMBER_NAMES) {
    const request = rejectedCandidateRequests.find(
      (candidate) => candidate.fileName === fileName
    );
    invariant(request && request.method === "GET" && request.completed &&
      request.origin === applicationOrigin && request.cookie === null &&
      request.host === `127.0.0.1:${peer.port}` &&
      request.path === memberRoute(rejectedCandidateFixture, fileName) &&
      request.writeSizes.every((size) => size > 0 && size <= SERVER_CHUNK_BYTES),
    `Synthetic rejected-candidate peer request was invalid: ${fileName}`);
  }
  const cancelledRequests = peer.requests.filter(
    (request) => request.fixtureLabel === cancelledCandidateFixture.label
  );
  invariant(cancelledRequests.length === 1,
    "Synthetic cancellation requested more than the first member");
  const cancelled = cancelledRequests[0];
  invariant(cancelled.method === "GET" && cancelled.fileName === MEMBER_NAMES[0] &&
    cancelled.origin === applicationOrigin && cancelled.cookie === null &&
    cancelled.host === `127.0.0.1:${peer.port}` &&
    cancelled.path === memberRoute(cancelledCandidateFixture, MEMBER_NAMES[0]) &&
    cancelled.bytesWritten > 0 &&
    cancelled.bytesWritten < cancelledCandidateFixture.manifest.members[0].byteLength &&
    cancelled.closedEarly,
  "Synthetic cancellation did not stop the first direct-peer response early");
  invariant(peer.requests.every((request) => request.fixtureLabel !== null),
    "Synthetic peer received an arbitrary route");
  return Object.freeze({
    rejectedCandidateRequests,
    cancelledCandidateRequest: cancelled
  });
}

function parseArguments(argv) {
  invariant(Array.isArray(argv), "Synthetic demo arguments are invalid");
  if (argv.length === 0) return Object.freeze({ headed: false });
  if (argv.length === 1 && argv[0] === "--headed") {
    return Object.freeze({ headed: true });
  }
  if (argv.length === 1 && argv[0] === "--interactive") {
    return Object.freeze({ headed: true, interactive: true });
  }
  throw new Error(
    "Usage: npm --prefix .\\tinyrustlm run demo:p2p:synthetic -- " +
      "[--headed|--interactive]"
  );
}

async function runSyntheticP2pDemo(options = {}) {
  const browserChannel = requireBrowserChannel(options.browserChannel);
  const headless = options.headless !== false;
  const browserTarget = Object.freeze({ channel: browserChannel || "playwright-chromium", headless });
  const stepDelayMilliseconds = options.stepDelayMilliseconds === undefined
    ? (headless ? 0 : 1_200)
    : options.stepDelayMilliseconds;
  invariant(Number.isSafeInteger(stepDelayMilliseconds) &&
    stepDelayMilliseconds >= 0 && stepDelayMilliseconds <= 10_000,
  "Synthetic demo step delay is invalid");
  const preservedPriorFixture = createSyntheticFixture(
    "preserved-prior",
    PRESERVED_PRIOR_LENGTHS,
    0
  );
  let rejectedCandidateFixture = createSyntheticFixture(
    "rejected-candidate",
    REJECTED_CANDIDATE_LENGTHS,
    0
  );
  let cancelledCandidateFixture = createSyntheticFixture(
    "cancelled-candidate",
    CANCELLED_CANDIDATE_LENGTHS,
    0
  );
  const ownedRun = createOwnedRunDirectory(options.tempRoot);
  const outputDirectory = ownedRun.outputDirectory;
  const restoreTemporaryEnvironment = setOwnedTemporaryEnvironment(ownedRun.scratch.rootPath);
  const observations = { pageErrors: [], consoleErrors: [] };
  const network = [];
  const companionSeedAudit = createCompanionSeedAudit();
  const companionSeedContexts = Object.freeze([
    "rejected-candidate-direct-p2p",
    "cancelled-candidate-direct-p2p"
  ]);
  const resources = {
    browserContextsClosed: 0,
    applicationServerClosed: false,
    peerServerClosed: false,
    ownedProfileDeleted: false,
    ownedRunResidueCleaned: false,
    temporaryEnvironmentRestored: false
  };

  let profileRoot = null;
  let profile = null;
  let applicationServer = null;
  let peer = null;
  let context = null;
  let traceStarted = false;
  let runError = null;
  let resultData = null;
  let safety = null;
  const cleanupErrors = [];
  const closeContext = async () => {
    if (!context) return;
    const ownedContext = context;
    context = null;
    try {
      await ownedContext.close();
      resources.browserContextsClosed += 1;
    } catch (error) {
      cleanupErrors.push(error);
    }
  };
  const onAbort = () => {
    if (context) void context.close().catch(() => {});
  };
  if (options.signal) options.signal.addEventListener("abort", onAbort, { once: true });

  try {
    invariant(!options.signal || !options.signal.aborted, "Synthetic demo was cancelled");
    writeNotice(outputDirectory);
    profileRoot = createOwnedProfileRoot({
      campaignId: "synthetic-p2p-interview-demo",
      parentDirectory: ownedRun.profileParent
    });
    profile = createOwnedBrowserProfile(profileRoot, {
      round: 1,
      role: "walkthrough"
    });
    assertOwnedProfileFresh(profileRoot, profile);
    invariant(isStrictChild(ownedRun.scratch.rootPath, profile.profilePath),
      "Synthetic browser profile escaped its owned canonical scratch root");
    applicationServer = await startSourceServer({
      siteRoot: path.resolve(__dirname, ".."),
      port: 0
    });
    invariant(new URL(applicationServer.origin).hostname === "127.0.0.1",
      "Synthetic application server escaped loopback");
    peer = await startSyntheticPeerServer(
      [rejectedCandidateFixture, cancelledCandidateFixture],
      applicationServer.origin,
      {
        pauseFixtureLabels: [
          rejectedCandidateFixture.label,
          cancelledCandidateFixture.label
        ]
      }
    );
    const documents = createDemoDocuments(
      [rejectedCandidateFixture, cancelledCandidateFixture],
      peer.port
    );
    [rejectedCandidateFixture, cancelledCandidateFixture] = documents.fixtures;
    invariant(
      preservedPriorFixture.manifestSha256 !== rejectedCandidateFixture.manifestSha256 &&
        preservedPriorFixture.manifestSha256 !== cancelledCandidateFixture.manifestSha256 &&
        rejectedCandidateFixture.manifestSha256 !== cancelledCandidateFixture.manifestSha256,
      "Synthetic fixture roles must have distinct content identities"
    );
    const contextOptions = {
      applicationOrigin: applicationServer.origin,
      peerOrigin: peer.origin,
      documents,
      network,
      companionSeedAudit
    };

    context = await launchOwnedContext(profile.profilePath, headless, browserChannel);
    await configureContext(context, {
      ...contextOptions,
      contextLabel: companionSeedContexts[0]
    });
    const seedPage = await openRuntimePage(
      context,
      applicationServer.origin,
      observations
    );
    const seededPrior = await seedSyntheticPrior(seedPage, preservedPriorFixture);
    invariant(seededPrior.manifestSha256 === preservedPriorFixture.manifestSha256,
      "Synthetic prior composition seed identity changed");
    await context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: false,
      title: DEMO_LABEL
    });
    traceStarted = true;
    const installPage = await openApplication(
      context,
      applicationServer.origin,
      observations,
      true
    );
    const initialPriorCacheRejection = await waitForFixtureRejection(
      installPage, "initial prior cache revalidation", "browser-cache"
    );
    await installPage.setViewportSize(NARROW_VIEWPORT);
    const chooser = await openChooser(installPage);
    const compactChooserUx = await verifyCompactChooserUxState(
      installPage,
      [
        rejectedCandidateFixture.compositionId,
        cancelledCandidateFixture.compositionId
      ],
      network
    );
    const rejectedCandidateCard = chooser.locator(
      `.simple-model-option[data-composition-id="${rejectedCandidateFixture.compositionId}"]`
    );
    await rejectedCandidateCard.waitFor({ state: "visible", timeout: 30_000 });
    const acquisitionAction = chooser.locator("#simpleModelActionButton");
    await waitForValue(
      () => readChooserActionState(acquisitionAction),
      (value) => value.hidden && value.disabled && value.ariaBusy === "false",
      "Synthetic chooser direct-peer action",
      30_000
    );
    await captureStage(
      installPage,
      outputDirectory,
      SCREENSHOTS[0],
      "COMPACT CHOOSER / SYNTHETIC CARDS",
      stepDelayMilliseconds
    );

    await rejectedCandidateCard.click();
    const rejectedCandidateProgress = await waitForPeerTransferProgress(
      peer,
      rejectedCandidateFixture,
      "Synthetic direct-peer transport progress"
    );
    await waitForValue(
      () => readChooserActionState(acquisitionAction),
      (value) => !value.hidden && !value.disabled && value.ariaBusy === "true",
      "Synthetic direct-peer cancellation control"
    );
    await captureStage(
      installPage,
      outputDirectory,
      SCREENSHOTS[1],
      `ONE-CLICK DIRECT PEER TRANSFER / ${rejectedCandidateProgress.text}`,
      stepDelayMilliseconds
    );
    peer.releaseFixture(rejectedCandidateFixture.label);

    const rejectedCandidateRuntime = await waitForFixtureRejection(
      installPage,
      "rejected candidate activation",
      "simple-model-picker",
      rejectedCandidateFixture
    );
    const preservedPriorInventory = await waitForValue(
      () => readOpfsInventory(installPage),
      (value) => Boolean(value && value.pointer &&
        value.pointer.manifestSha256 === preservedPriorFixture.manifestSha256 &&
        value.stagingEntries.length === 0 && value.installedEntries.length === 1 &&
        value.installedEntries[0].name === preservedPriorFixture.manifestSha256),
      "Synthetic OPFS prior-pointer preservation",
      90_000
    );
    invariant(preservedPriorInventory.installedEntries.length === 1 &&
      preservedPriorInventory.installedEntries[0].name ===
        preservedPriorFixture.manifestSha256,
    "Synthetic OPFS inventory did not preserve the prior composition");
    const installEvidencePage = await openEvidencePage(
      context,
      applicationServer.origin,
      observations
    );
    await renderFixtureEvidence(
      installEvidencePage,
      rejectedCandidateEvidence(
        rejectedCandidateFixture,
        preservedPriorFixture,
        preservedPriorInventory,
        rejectedCandidateRuntime
      )
    );
    await captureStage(
      installEvidencePage,
      outputDirectory,
      SCREENSHOTS[2],
      "CANDIDATE REJECTED / PRIOR POINTER PRESERVED",
      stepDelayMilliseconds
    );
    await captureStage(
      installEvidencePage,
      outputDirectory,
      SCREENSHOTS[6],
      "ATOMIC REJECTION / PRIOR BYTES PRESERVED",
      stepDelayMilliseconds
    );
    await installEvidencePage.close();
    await flushCompanionSeedAudit(installPage, companionSeedAudit);
    await context.tracing.stop({ path: path.join(outputDirectory, TRACES[0]) });
    traceStarted = false;
    await closeContext();

    invariant(!options.signal || !options.signal.aborted, "Synthetic demo was cancelled");
    context = await launchOwnedContext(profile.profilePath, headless, browserChannel);
    await configureContext(context, {
      ...contextOptions,
      contextLabel: companionSeedContexts[1]
    });
    await context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: false,
      title: DEMO_LABEL
    });
    traceStarted = true;
    const reopenPage = await openRuntimePage(
      context,
      applicationServer.origin,
      observations
    );
    const preservedPriorReopen = await verifyCachedComposition(reopenPage);
    validateCache(preservedPriorReopen, preservedPriorFixture);
    await renderCacheSummary(reopenPage, preservedPriorReopen);
    await captureStage(
      reopenPage,
      outputDirectory,
      SCREENSHOTS[3],
      "PERSISTENT PROFILE REOPEN / SIX HASHES VERIFIED",
      stepDelayMilliseconds
    );

    const cancellationPage = await context.newPage();
    observePage(cancellationPage, observations);
    await cancellationPage.goto(new URL("/app/", applicationServer.origin).href, {
      waitUntil: "domcontentloaded",
      timeout: 30_000
    });
    await cancellationPage.locator(".app-shell").waitFor({ state: "visible" });
    await waitForValue(
      () => readSyntheticChooserCatalogState(cancellationPage),
      (value) => value.cardCount === 2 && value.qualifiedP2pCardCount === 2 &&
        value.statusIsError && value.errorState === EXPECTED_CACHE_REJECTION &&
        value.modelState === "browser cache unavailable",
      "Synthetic cancellation catalog",
      30_000
    );
    const cancellationChooser = await openChooser(cancellationPage);
    const cancelledCandidateCard = cancellationChooser.locator(
      `.simple-model-option[data-composition-id="${cancelledCandidateFixture.compositionId}"]`
    );
    const cancellationAction = cancellationChooser.locator("#simpleModelActionButton");
    await waitForValue(
      () => readChooserActionState(cancellationAction),
      (value) => value.hidden && value.disabled && value.ariaBusy === "false",
      "Synthetic cached activation settlement",
      30_000
    );
    const preservedPriorCacheRevalidation = await waitForFixtureRejection(
      cancellationPage,
      "preserved prior cache revalidation",
      "browser-cache"
    );
    const pointerBeforeCancellation = (await readOpfsInventory(cancellationPage)).pointerText;
    await cancelledCandidateCard.focus();
    invariant(await cancelledCandidateCard.evaluate(
      (button) => document.activeElement === button
    ), "Synthetic keyboard activation target did not receive focus");
    await cancellationPage.keyboard.press("Enter");
    const cancellationProgress = await waitForPeerTransferProgress(
      peer,
      cancelledCandidateFixture,
      "Synthetic cancellation transport progress"
    );
    await waitForValue(
      () => readChooserActionState(cancellationAction),
      (value) => !value.hidden && !value.disabled && value.ariaBusy === "true",
      "Synthetic cancellation control"
    );
    const cancellationEvidencePage = await openEvidencePage(
      context,
      applicationServer.origin,
      observations
    );
    await renderFixtureEvidence(
      cancellationEvidencePage,
      cancellationProgressEvidence(
        cancellationProgress,
        preservedPriorFixture,
        preservedPriorCacheRevalidation
      )
    );
    await captureStage(
      cancellationEvidencePage,
      outputDirectory,
      SCREENSHOTS[4],
      `CANCELLATION ARMED / ${cancellationProgress.text}`,
      stepDelayMilliseconds
    );
    await cancellationAction.click();
    await waitForValue(
      () => cancellationChooser.locator("#simpleModelPickerStatus").textContent(),
      (value) => value === "Model acquisition cancelled.",
      "Synthetic transfer cancellation",
      30_000
    );
    const cancelledInventory = await waitForValue(
      () => readOpfsInventory(cancellationPage),
      (value) => Boolean(value && value.pointerText === pointerBeforeCancellation &&
        value.stagingEntries.length === 0 && value.installedEntries.length === 1 &&
        value.installedEntries[0].name === preservedPriorFixture.manifestSha256),
      "Synthetic cancellation cleanup",
      30_000
    );
    const cancelledCandidateRequest = await waitForValue(
      () => peer.requests.find((request) =>
        request.fixtureLabel === cancelledCandidateFixture.label) || null,
      (value) => Boolean(value && value.closedEarly),
      "Synthetic peer cancellation close",
      30_000
    );
    await renderFixtureEvidence(
      cancellationEvidencePage,
      cancellationResultEvidence(
        preservedPriorFixture,
        cancelledInventory,
        cancelledCandidateRequest,
        preservedPriorCacheRevalidation
      )
    );
    await captureStage(
      cancellationEvidencePage,
      outputDirectory,
      SCREENSHOTS[5],
      "CANCELLED / ACTIVE POINTER UNCHANGED / NO INFERENCE",
      stepDelayMilliseconds
    );
    await captureStage(
      cancellationEvidencePage,
      outputDirectory,
      SCREENSHOTS[7],
      "CANCEL ATOMIC / POINTER UNCHANGED",
      stepDelayMilliseconds
    );
    await cancellationEvidencePage.close();
    await flushCompanionSeedAudit(cancellationPage, companionSeedAudit);
    const requestProof = validatePeerRequests(
      peer,
      rejectedCandidateFixture,
      cancelledCandidateFixture,
      applicationServer.origin
    );

    resultData = {
      applicationOrigin: applicationServer.origin,
      peerOrigin: peer.origin,
      rejectedCandidateProgress: rejectedCandidateProgress.text,
      cancellationProgress: cancellationProgress.text,
      initialPriorCacheRejection,
      rejectedCandidateRuntime,
      preservedPriorCacheRevalidation,
      preservedPriorInventory,
      preservedPriorReopen,
      cancelledInventory,
      compactChooserUx,
      rejectedCandidateRequests: requestProof.rejectedCandidateRequests,
      cancelledCandidateRequest: requestProof.cancelledCandidateRequest
    };
    await context.tracing.stop({ path: path.join(outputDirectory, TRACES[1]) });
    traceStarted = false;
  } catch (error) {
    runError = error;
  } finally {
    if (traceStarted && context) {
      try {
        await context.tracing.stop({
          path: path.join(outputDirectory, "failure-trace.zip")
        });
      } catch (_error) {
        // Browser closure can race an interviewer's Ctrl+C.
      }
      traceStarted = false;
    }
    await closeContext();
    if (peer) {
      try {
        await peer.close();
        resources.peerServerClosed = true;
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (applicationServer) {
      try {
        await applicationServer.close();
        resources.applicationServerClosed = true;
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (profileRoot && profile) {
      try {
        deleteOwnedBrowserProfile(profileRoot, profile);
        removeOwnedProfileRoot(profileRoot);
        resources.ownedProfileDeleted = true;
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (options.signal) options.signal.removeEventListener("abort", onAbort);
    try {
      cleanOwnedRunResidue(ownedRun);
      resources.ownedRunResidueCleaned = true;
    } catch (error) {
      cleanupErrors.push(error);
    }
    restoreTemporaryEnvironment();
    resources.temporaryEnvironmentRestored = true;
  }

  if (!runError && cleanupErrors.length === 0) {
    try {
      invariant(resources.browserContextsClosed === 2 &&
        resources.applicationServerClosed && resources.peerServerClosed &&
        resources.ownedProfileDeleted && resources.ownedRunResidueCleaned &&
        resources.temporaryEnvironmentRestored,
      "Synthetic walkthrough did not clean every owned resource");
      invariant(countHuggingFaceRequests(network) === 0,
        "Synthetic walkthrough observed a Hugging Face request");
      safety = verifySyntheticSafety(
        network,
        observations,
        companionSeedAudit,
        companionSeedContexts,
        "Synthetic walkthrough"
      );
    } catch (error) {
      runError = error;
    }
  }

  if (runError || cleanupErrors.length > 0) {
    const failure = runError || cleanupErrors[0];
    fs.writeFileSync(path.join(outputDirectory, "failure.json"), `${JSON.stringify({
      schema: DEMO_SCHEMA,
      label: DEMO_LABEL,
      status: "failed",
      browserTarget,
      error: String(failure && failure.message || failure),
      resources
    }, null, 2)}\n`, "utf8");
    throw failure;
  }

  const report = {
    schema: DEMO_SCHEMA,
    verdict: SYNTHETIC_MECHANICS_VERDICT,
    label: DEMO_LABEL,
    classification: TEST_ONLY_CLASSIFICATION,
    testOnly: true,
    eligibleAsLiveModel: false,
    claims: FALSE_LIVE_CLAIMS,
    browserTarget,
    browser: safety.browser,
    companionSeedStatus: safety.companionSeedStatus,
    fixtures: {
      preservedPrior: {
        role: "preserved-prior",
        manifestSha256: preservedPriorFixture.manifestSha256,
        presentBeforeWalkthrough: true,
        remainsActivePointer: true,
        executable: false,
        liveEvidence: false
      },
      rejectedCandidate: {
        role: "rejected-candidate",
        manifestSha256: rejectedCandidateFixture.manifestSha256,
        transferCompleted: true,
        activationOutcome: "rejected",
        becameActive: false,
        retainedAfterRejection: false,
        executable: false,
        liveEvidence: false
      },
      cancelledCandidate: {
        role: "cancelled-candidate",
        manifestSha256: cancelledCandidateFixture.manifestSha256,
        transferCompleted: false,
        cancellationOutcome: "cancelled",
        becameActive: false,
        retainedAfterCancellation: false,
        executable: false,
        liveEvidence: false
      }
    },
    transport: {
      applicationOrigin: resultData.applicationOrigin,
      peerOrigin: resultData.peerOrigin,
      peerBaseUrl: directPeerUrlAuthority.normalizeBaseUrl(resultData.peerOrigin),
      loopbackOnly: true,
      projectSiteMemberBytesRelayed: 0,
      blockedRequestCount: safety.traffic.blockedRequestCount,
      blockedExternalRequestCount: safety.traffic.blockedExternalRequestCount,
      blockedUnownedLoopbackRequestCount:
        safety.traffic.blockedUnownedLoopbackRequestCount,
      blockedExternalOrigins: safety.traffic.blockedExternalOrigins,
      blockedUnownedLoopbackOrigins: safety.traffic.blockedUnownedLoopbackOrigins,
      huggingFaceRequestCount: countHuggingFaceRequests(network),
      rejectedCandidateMemberRequests: resultData.rejectedCandidateRequests.length,
      cancelledCandidateMemberRequests: 1
    },
    ownership: {
      tempRoot: ownedRun.realRoot,
      runRoot: ownedRun.runRoot,
      outputDirectory,
      artifactsContained: isStrictChild(ownedRun.runRoot, outputDirectory)
    },
    walkthrough: {
      runtimeBoundary: {
        fixtureExecutable: false,
        inferenceAttempted: false,
        initialPriorCacheRevalidation: resultData.initialPriorCacheRejection,
        rejectedCandidateActivation: resultData.rejectedCandidateRuntime,
        preservedPriorCacheRevalidation:
          resultData.preservedPriorCacheRevalidation
      },
      compactChooser: {
        syntheticCards: 2,
        directPeerAction: "Get from P2P",
        pointerActivation: "playwright-click",
        keyboardActivation: "enter",
        ...resultData.compactChooserUx
      },
      rejectedCandidateTransfer: {
        progressText: resultData.rejectedCandidateProgress,
        manifestSha256: rejectedCandidateFixture.manifestSha256,
        memberNames: MEMBER_NAMES,
        completedMemberRequests: resultData.rejectedCandidateRequests.length,
        peerBytesSent: resultData.rejectedCandidateRequests.reduce(
          (total, request) => total + request.bytesWritten,
          0
        ),
        activationOutcome: "rejected",
        becameActive: false
      },
      preservedPriorCache: {
        manifestSha256: preservedPriorFixture.manifestSha256,
        pointer: resultData.preservedPriorInventory.pointer,
        installedEntries: resultData.preservedPriorInventory.installedEntries,
        stagingEntries: resultData.preservedPriorInventory.stagingEntries
      },
      preservedPriorReopen: resultData.preservedPriorReopen,
      cancellation: {
        progressText: resultData.cancellationProgress,
        pointerUnchanged: resultData.cancelledInventory.pointerText ===
          resultData.preservedPriorInventory.pointerText,
        cancelledCandidateManifestSha256: cancelledCandidateFixture.manifestSha256,
        preservedPriorManifestSha256:
          resultData.cancelledInventory.pointer.manifestSha256,
        candidateBecameActive: false,
        stagingEntries: resultData.cancelledInventory.stagingEntries,
        request: {
          path: resultData.cancelledCandidateRequest.path,
          bytesWritten: resultData.cancelledCandidateRequest.bytesWritten,
          completed: resultData.cancelledCandidateRequest.completed,
          closedEarly: resultData.cancelledCandidateRequest.closedEarly
        }
      }
    },
    artifacts: {
      notice: NOTICE_FILE,
      screenshots: SCREENSHOTS,
      screenshotEvidence: SCREENSHOT_EVIDENCE,
      traces: TRACES
    },
    resources
  };
  const reportPath = path.join(outputDirectory, "walkthrough.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx"
  });
  return Object.freeze({
    outputDirectory,
    ownedRunRoot: ownedRun.runRoot,
    reportPath,
    profileRootPath: profileRoot ? profileRoot.rootPath : null,
    report: Object.freeze(report)
  });
}

// Hold an interactive session until the operator interrupts the CLI or closes the browser.
function waitForInteractiveShutdown(context, signal) {
  return new Promise((resolve) => {
    let settled = false;

    // Resolve exactly once and detach both shutdown observers before cleanup begins.
    function finish(reason) {
      if (settled) return;
      settled = true;
      context.off("close", onContextClose);
      if (signal) signal.removeEventListener("abort", onAbort);
      resolve(reason);
    }

    // Treat browser-window closure as an explicit end to the operator-held session.
    function onContextClose() {
      finish("browser-context-closed");
    }

    // Treat Ctrl+C/SIGTERM, relayed through the AbortSignal, as normal operator shutdown.
    function onAbort() {
      finish("operator-signal");
    }

    context.once("close", onContextClose);
    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) finish("operator-signal");
    }
  });
}

// Open a fresh, synthetic-only chooser for manual clicks without producing automated evidence.
async function runInteractiveSyntheticP2pDemo(options = {}) {
  invariant(options && typeof options === "object" && !Array.isArray(options),
    "Interactive synthetic demo options are invalid");
  invariant(options.onReady === undefined || typeof options.onReady === "function",
    "Interactive synthetic demo readiness callback is invalid");
  const browserChannel = requireBrowserChannel(options.browserChannel);
  const headless = options.headless === true;
  const browserTarget = Object.freeze({ channel: browserChannel || "playwright-chromium", headless });
  let rejectedCandidateFixture = createSyntheticFixture(
    "rejected-candidate",
    REJECTED_CANDIDATE_LENGTHS,
    0
  );
  let cancelledCandidateFixture = createSyntheticFixture(
    "cancelled-candidate",
    CANCELLED_CANDIDATE_LENGTHS,
    0
  );
  const ownedRun = createOwnedRunDirectory(options.tempRoot);
  const outputDirectory = ownedRun.outputDirectory;
  const restoreTemporaryEnvironment = setOwnedTemporaryEnvironment(ownedRun.scratch.rootPath);
  const network = [];
  const companionSeedAudit = createCompanionSeedAudit();
  const companionSeedContexts = Object.freeze(["interactive-direct-p2p"]);
  const resources = {
    browserContextsClosed: 0,
    applicationServerClosed: false,
    peerServerClosed: false,
    ownedProfileDeleted: false,
    ownedRunResidueCleaned: false,
    temporaryEnvironmentRestored: false
  };
  const observations = { pageErrors: [], consoleErrors: [] };
  const cleanupErrors = [];
  let profileRoot = null;
  let profile = null;
  let applicationServer = null;
  let peer = null;
  let context = null;
  let page = null;
  let runError = null;
  let readyState = null;
  let shutdownReason = null;
  let safety = null;
  let invalidPeerRequests = [];

  try {
    invariant(!options.signal || !options.signal.aborted,
      "Interactive synthetic demo stopped before startup");
    writeNotice(outputDirectory);
    profileRoot = createOwnedProfileRoot({
      campaignId: "synthetic-p2p-interview-interactive",
      parentDirectory: ownedRun.profileParent
    });
    profile = createOwnedBrowserProfile(profileRoot, {
      round: 1,
      role: "interactive"
    });
    assertOwnedProfileFresh(profileRoot, profile);
    invariant(isStrictChild(ownedRun.scratch.rootPath, profile.profilePath),
      "Interactive browser profile escaped its owned canonical scratch root");
    applicationServer = await startSourceServer({
      siteRoot: path.resolve(__dirname, ".."),
      port: 0
    });
    invariant(new URL(applicationServer.origin).hostname === "127.0.0.1",
      "Interactive application server escaped loopback");
    peer = await startSyntheticPeerServer(
      [rejectedCandidateFixture, cancelledCandidateFixture],
      applicationServer.origin,
      { pauseFixtureLabels: [cancelledCandidateFixture.label] }
    );
    const documents = createDemoDocuments(
      [rejectedCandidateFixture, cancelledCandidateFixture],
      peer.port
    );
    [rejectedCandidateFixture, cancelledCandidateFixture] = documents.fixtures;
    context = await launchOwnedContext(profile.profilePath, headless, browserChannel);
    await configureContext(context, {
      applicationOrigin: applicationServer.origin,
      peerOrigin: peer.origin,
      documents,
      network,
      companionSeedAudit,
      contextLabel: companionSeedContexts[0]
    });
    page = await openApplication(context, applicationServer.origin, observations);
    const chooser = await openChooser(page);
    await setDemoStage(page, "INTERACTIVE / SYNTHETIC CARDS / CTRL+C TO CLOSE");
    await page.bringToFront();
    readyState = await page.evaluate(({ label, expectedCards }) => {
      const banner = document.getElementById("tinyrustlm-synthetic-fixture-demo-banner");
      const panel = document.getElementById("simpleDiscoveryPanel");
      const cards = [...document.querySelectorAll(".simple-model-option")];
      return {
        label,
        bannerVisible: Boolean(banner && banner.getBoundingClientRect().height > 0),
        bannerText: String(banner?.textContent || "").trim(),
        chooserVisible: Boolean(panel && !panel.hidden),
        cardCount: cards.length,
        cardsSynthetic: cards.length === expectedCards && cards.every(
          (card) => String(card.textContent || "").includes(label)
        )
      };
    }, { label: DEMO_LABEL, expectedCards: 2 });
    invariant(readyState.bannerVisible && readyState.bannerText.includes(DEMO_LABEL) &&
      readyState.chooserVisible && readyState.cardCount === 2 && readyState.cardsSynthetic,
    "Interactive synthetic chooser did not reach its labeled ready state");
    readyState = Object.freeze({
      ...readyState,
      applicationOrigin: applicationServer.origin,
      peerBaseUrl: directPeerUrlAuthority.normalizeBaseUrl(peer.origin),
      fixtureTrafficOnly: true,
      automatedEvidence: false
    });
    await flushCompanionSeedAudit(page, companionSeedAudit);
    const shutdown = waitForInteractiveShutdown(context, options.signal);
    if (options.onReady) await options.onReady(readyState);
    shutdownReason = await shutdown;
    if (!page.isClosed()) await flushCompanionSeedAudit(page, companionSeedAudit);
  } catch (error) {
    runError = error;
  } finally {
    if (context) {
      try {
        await context.close();
        resources.browserContextsClosed = 1;
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (peer) {
      try {
        await peer.close();
        resources.peerServerClosed = true;
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (applicationServer) {
      try {
        await applicationServer.close();
        resources.applicationServerClosed = true;
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (profileRoot && profile) {
      try {
        deleteOwnedBrowserProfile(profileRoot, profile);
        removeOwnedProfileRoot(profileRoot);
        resources.ownedProfileDeleted = true;
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    try {
      cleanOwnedRunResidue(ownedRun);
      resources.ownedRunResidueCleaned = true;
    } catch (error) {
      cleanupErrors.push(error);
    }
    restoreTemporaryEnvironment();
    resources.temporaryEnvironmentRestored = true;
  }

  if (!runError && cleanupErrors.length === 0) {
    try {
      invalidPeerRequests = peer.requests.filter((request) =>
        request.fixtureLabel === null || request.origin !== applicationServer.origin ||
          request.host !== `127.0.0.1:${peer.port}`);
      invariant(invalidPeerRequests.length === 0,
        "Interactive session observed a peer request outside the exact fixture protocol");
      safety = verifySyntheticSafety(
        network,
        observations,
        companionSeedAudit,
        companionSeedContexts,
        "Interactive synthetic session"
      );
    } catch (error) {
      runError = error;
    }
  }

  if (runError || cleanupErrors.length > 0) {
    const failure = runError || cleanupErrors[0];
    fs.writeFileSync(path.join(outputDirectory, "interactive-failure.json"),
      `${JSON.stringify({
        schema: INTERACTIVE_DEMO_SCHEMA,
        label: DEMO_LABEL,
        status: "failed",
        browserTarget,
        error: String(failure && failure.message || failure),
        resources
      }, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    throw failure;
  }

  const report = {
    schema: INTERACTIVE_DEMO_SCHEMA,
    verdict: SYNTHETIC_MECHANICS_VERDICT,
    label: DEMO_LABEL,
    mode: "interactive-operator-held",
    classification: TEST_ONLY_CLASSIFICATION,
    testOnly: true,
    automatedEvidence: false,
    eligibleAsLiveModel: false,
    claims: FALSE_LIVE_CLAIMS,
    browserTarget,
    browser: safety.browser,
    companionSeedStatus: safety.companionSeedStatus,
    ready: readyState,
    operatorShutdown: shutdownReason,
    fixtures: {
      rejectedCandidate: {
        role: "rejected-candidate",
        manifestSha256: rejectedCandidateFixture.manifestSha256,
        executable: false,
        liveEvidence: false
      },
      cancelledCandidate: {
        role: "cancelled-candidate",
        manifestSha256: cancelledCandidateFixture.manifestSha256,
        executable: false,
        liveEvidence: false
      }
    },
    traffic: {
      applicationOrigin: applicationServer.origin,
      peerBaseUrl: directPeerUrlAuthority.normalizeBaseUrl(peer.origin),
      policy: "owned-loopback-or-intercepted-fixture-only",
      loopbackOnly: true,
      projectSiteMemberBytesRelayed: 0,
      blockedRequestCount: safety.traffic.blockedRequestCount,
      blockedExternalRequestCount: safety.traffic.blockedExternalRequestCount,
      blockedUnownedLoopbackRequestCount:
        safety.traffic.blockedUnownedLoopbackRequestCount,
      blockedExternalOrigins: safety.traffic.blockedExternalOrigins,
      blockedUnownedLoopbackOrigins: safety.traffic.blockedUnownedLoopbackOrigins,
      invalidPeerRequestCount: invalidPeerRequests.length,
      peerMemberRequests: peer.requests.map((request) => ({
        fixtureRole: request.fixtureLabel,
        memberName: request.fileName,
        bytesWritten: request.bytesWritten,
        completed: request.completed,
        closedEarly: request.closedEarly
      }))
    },
    resources
  };
  const reportPath = path.join(outputDirectory, "interactive-session.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx"
  });
  return Object.freeze({
    outputDirectory,
    ownedRunRoot: ownedRun.runRoot,
    reportPath,
    profileRootPath: profileRoot ? profileRoot.rootPath : null,
    report: Object.freeze(report)
  });
}

async function runCli(argv = process.argv.slice(2)) {
  let parsed;
  try {
    parsed = parseArguments(argv);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }
  const controller = new AbortController();
  const onInterrupt = () => controller.abort();
  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onInterrupt);
  const interactive = parsed.interactive === true;
  process.stdout.write(`${DEMO_LABEL}\n${interactive
    ? "Starting operator-held synthetic chooser..."
    : parsed.headed
      ? "Starting headed owned-loopback walkthrough; headed is presentation mode only."
      : "Starting headless owned-loopback walkthrough."}\n`);

  // Announce readiness only after the red banner, chooser, and exact fixture routes are active.
  function announceInteractiveReady(ready) {
    process.stdout.write([
      "INTERACTIVE READY: the synthetic chooser is open for manual card clicks.",
      `Application: ${ready.applicationOrigin}/app/`,
      `Synthetic peer base: ${ready.peerBaseUrl}`,
      "Press Ctrl+C in this terminal or close the browser window to shut down and clean up.",
      "This mode creates no automated evidence and makes no live or inference claim.",
      ""
    ].join("\n"));
  }

  try {
    const result = interactive
      ? await runInteractiveSyntheticP2pDemo({
        headless: false,
        browserChannel: process.env.TINYRUSTLM_PLAYWRIGHT_CHANNEL || undefined,
        signal: controller.signal,
        onReady: announceInteractiveReady
      })
      : await runSyntheticP2pDemo({
        headless: !parsed.headed,
        browserChannel: process.env.TINYRUSTLM_PLAYWRIGHT_CHANNEL || undefined,
        signal: controller.signal
      });
    process.stdout.write([
      `${DEMO_LABEL}`,
      `Artifacts: ${result.outputDirectory}`,
      `Report: ${result.reportPath}`,
      "Owned browser, profile, application server, and peer server: CLOSED.",
      ...(interactive ? ["Interactive mode produced no automated acceptance evidence."] : []),
      "No live model, qualification, inference, deployment, or external peer claim was made.",
      ""
    ].join("\n"));
    return 0;
  } catch (error) {
    process.stderr.write(
      `${DEMO_LABEL}\n${interactive ? "Interactive session" : "Walkthrough"} failed: ` +
        `${String(error && error.message || error)}\n`
    );
    return controller.signal.aborted ? 130 : 1;
  } finally {
    process.removeListener("SIGINT", onInterrupt);
    process.removeListener("SIGTERM", onInterrupt);
  }
}

if (require.main === module) {
  runCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}

module.exports = Object.freeze({
  CANCELLED_CANDIDATE_LENGTHS,
  CATALOG_URL,
  DEFAULT_TEMP_ROOT,
  DESKTOP_VIEWPORT,
  DEMO_LABEL,
  DEMO_SCHEMA,
  INTERACTIVE_DEMO_SCHEMA,
  MEMBER_NAMES,
  NARROW_VIEWPORT,
  NOTICE_FILE,
  PEER_FEED_URL,
  PROTOCOL_PROFILE,
  PRESERVED_PRIOR_LENGTHS,
  REJECTED_CANDIDATE_LENGTHS,
  ROUTE_PREFIX,
  SCREENSHOT_EVIDENCE,
  SCREENSHOTS,
  SERVER_CHUNK_BYTES,
  SYNTHETIC_MECHANICS_VERDICT,
  TEST_ONLY_CLASSIFICATION,
  TEST_ONLY_SCOPE,
  TRACES,
  createCompanionSeedAudit,
  createDemoDocuments,
  createDocuments,
  createSyntheticFixture,
  isExpectedFixtureRejection,
  memberRoute,
  parseArguments,
  recordCompanionSeedObservation,
  runCli,
  runInteractiveSyntheticP2pDemo,
  runSyntheticP2pDemo,
  startSyntheticPeerServer,
  syntheticBytes,
  verifySyntheticSafety
});
