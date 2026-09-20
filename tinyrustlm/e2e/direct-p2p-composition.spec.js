"use strict";

const crypto = require("node:crypto");
const http = require("node:http");
const { createOwnedBrowserProfile, removeOwnedBrowserProfile } = require("./owned-browser-profile.js");
const { chromium, expect, test } = require("@playwright/test");

const admissionAuthority = require("../app/browser-model-admission.js");
const catalogAuthority = require("../app/minimodel-catalog-v1.js");
const runtimeManifest = require("../browser-runtime/tinyrustlm-browser-runtime.wasm.manifest.json");

const TEST_ONLY_CLASSIFICATION = "synthetic-test-only-never-live-model";
const TEST_ONLY_SCOPE = "test-only/never-live/e2e/direct-p2p-composition";
const CATALOG_URL = catalogAuthority.CATALOG_URL;
const PEER_FEED_URL = catalogAuthority.PEER_FEED_URL;
const PROTOCOL_PROFILE = catalogAuthority.DIRECT_COMPOSITION_PROTOCOL_PROFILE;
const ROUTE_PREFIX = "/tinyrustlm/direct-composition/v1";
const OPFS_ROOT_NAME = "tinyrustlm-model-compositions-v2";
const STORE_MANIFEST_SCHEMA = "tinyrustlm.model-composition-store.manifest/2";
const STORE_POINTER_SCHEMA = "tinyrustlm.model-composition-store.active-pointer/2";
const STORE_CHUNK_BYTES = 128;
const SERVER_CHUNK_BYTES = 128;
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
const TEST_NOW = new Date(Math.floor(Date.now() / 1000) * 1000);
const PEER_KEY_PAIR = crypto.generateKeyPairSync("ed25519");
const PEER_PUBLIC_KEY_BYTES = PEER_KEY_PAIR.publicKey
  .export({ type: "spki", format: "der" })
  .subarray(-32);
const PEER_PUBLIC_KEY_BASE64URL = PEER_PUBLIC_KEY_BYTES.toString("base64url");
const PEER_KEY_ID = `sha256:${sha256(PEER_PUBLIC_KEY_BYTES)}`;

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

function peerAnnouncementIds(fixture) {
  return {
    selected: `test-only/peer/${fixture.label}/ipv4`,
    later: `test-only/peer/${fixture.label}/later-ipv4`
  };
}

function syntheticBytes(label, byteLength) {
  const value = Buffer.allocUnsafe(byteLength);
  const seed = Buffer.from(`SYNTHETIC TEST ONLY NEVER LIVE:${label}`, "utf8");
  for (let index = 0; index < value.length; index += 1) {
    value[index] = (seed[index % seed.length] + index * 31 + (index >>> 5)) & 0xff;
  }
  return value;
}

function compositionIdentity(artifacts) {
  const resolved = artifacts.slice(0, 5);
  const memberTable = Buffer.alloc(5 * 128);
  for (const [index, artifact] of resolved.entries()) {
    const offset = index * 128;
    memberTable.writeUInt16LE(1, offset);
    memberTable.writeUInt16LE(index + 1, offset + 2);
    memberTable.writeUInt16LE(index + 1, offset + 4);
    memberTable.writeUInt32LE(index, offset + 8);
    memberTable.writeBigUInt64LE(BigInt(artifact.byteCount), offset + 16);
    Buffer.from(artifact.sha256, "hex").copy(memberTable, offset + 24);
    Buffer.from(artifact.formatProfileSha256, "hex").copy(memberTable, offset + 56);
  }
  const resolvedMemberBytes = resolved.reduce(
    (total, artifact) => total + artifact.byteCount,
    0
  );
  const framing = Buffer.alloc(17);
  framing.writeUInt16LE(2, 0);
  framing.writeUInt16LE(0, 2);
  framing.writeUInt8(1, 4);
  framing.writeUInt32LE(5, 5);
  framing.writeBigUInt64LE(BigInt(resolvedMemberBytes), 9);
  const graphInput = Buffer.concat([
    Buffer.from("tinyrustlm.acg2.champion-graph.v1\0", "utf8"),
    framing,
    memberTable
  ]);
  return {
    graphIdentitySha256: sha256(graphInput),
    memberTableSha256: sha256(memberTable),
    resolvedMemberBytes
  };
}

function createCatalogDocument(fixture) {
  const announcementIds = peerAnnouncementIds(fixture);
  const catalogEntry = {
    entry_id: `test-only/direct-p2p-${fixture.label}`,
    display_name: `TEST ONLY synthetic direct P2P ${fixture.label}`,
    description: "Synthetic bytes for a browser test only; never a live model or evidence claim.",
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
      sha256: fixture.admissionSha256
    },
    profiles: {
      conversion: "tinyrustlm.synthetic-test-only.conversion.v1",
      quantization: "tinyrustlm.synthetic-test-only.quantization.v1",
      runtime: "tinyrustlm.synthetic-test-only.browser.v1"
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
    peer_announcement_ids: [announcementIds.later, announcementIds.selected]
  };
  return {
    schema: catalogAuthority.CATALOG_SCHEMA,
    catalog_id: `test-only/direct-p2p-${fixture.label}`,
    revision: 1,
    generated_at_utc: utc(-60_000),
    valid_until_utc: utc(60 * 60_000),
    project_server_serves_model_bytes: false,
    project_server_proxies_model_bytes: false,
    project_server_runs_inference: false,
    qualification_policy: "exact-current-evidence-required",
    qualification_receipt_schema: catalogAuthority.QUALIFICATION_RECEIPT_SCHEMA,
    browser_admission_schema: catalogAuthority.BROWSER_ADMISSION_SCHEMA,
    peer_verification_keys: [{
      key_id: PEER_KEY_ID,
      algorithm: "Ed25519",
      public_key_base64url: PEER_PUBLIC_KEY_BASE64URL,
      not_before_utc: utc(-60 * 60_000),
      not_after_utc: utc(2 * 60 * 60_000)
    }],
    revoked_qualification_receipt_ids: [],
    supersessions: [],
    entries: [catalogEntry]
  };
}

function createSyntheticFixture(label, lengths, responseDelayMilliseconds) {
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
  const composition = compositionIdentity(artifacts);
  const resolvedMemberBytes = composition.resolvedMemberBytes;
  const residentDependencyBytes = artifacts.slice(1, 5)
    .reduce((total, artifact) => total + artifact.byteCount, 0);
  const qualificationReceiptId = `sha256:${identity(`${label}:qualification-receipt-id`)}`;
  const admission = admissionAuthority.normalizeAdmission({
    schema: admissionAuthority.schema,
    modelId: `test-only/direct-p2p-${label}`,
    operationId: identity(`${label}:operation`),
    artifacts,
    composition,
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
      wasmByteCount: runtimeManifest.byteCount,
      wasmSha256: runtimeManifest.sha256,
      policy: {
        maximumModelBytes: artifacts[0].byteCount,
        maximumSequenceTokens: 128,
        maximumKvBytes: 1024 * 1024,
        maximumScratchBytes: 1024 * 1024,
        maximumResolvedMemberBytes: resolvedMemberBytes,
        maximumResidentDependencyBytes: residentDependencyBytes,
        maximumRequestBytes: 1_054_848,
        maximumLinearMemoryBytes: runtimeManifest.maximumMemoryBytes
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
  });
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
  const members = artifacts.map((artifact) => ({
    fileName: artifact.fileName,
    byteLength: artifact.byteCount,
    sha256: artifact.sha256
  }));
  const fixture = {
    classification: TEST_ONLY_CLASSIFICATION,
    testOnly: true,
    eligibleAsLiveModel: false,
    label,
    modelId: admission.modelId,
    compositionId: `sha256:${admission.composition.graphIdentitySha256}`,
    admissionText,
    admissionSha256: `sha256:${sha256(admissionBytes)}`,
    qualificationReceipt,
    qualificationReceiptText,
    qualificationReceiptSha256: `sha256:${sha256(qualificationReceiptBytes)}`,
    members,
    memberBuffers,
    responseDelayMilliseconds
  };
  const catalog = createCatalogDocument(fixture);
  const catalogText = `${JSON.stringify(catalog)}\n`;
  const catalogBytes = Buffer.from(catalogText, "utf8");
  const p2pPieceSetSha256 = pieceSetSha256(fixture, "selected");
  const catalogAuthorityRecord = {
    id: catalog.catalog_id,
    revision: catalog.revision,
    generatedAtUtc: catalog.generated_at_utc,
    validUntilUtc: catalog.valid_until_utc,
    sha256: `sha256:${sha256(catalogBytes)}`
  };
  const manifest = {
    schema: STORE_MANIFEST_SCHEMA,
    admissionAuthority: {
      admission: {
        byteLength: admissionBytes.byteLength,
        sha256: sha256(admissionBytes)
      },
      qualificationReceipt: {
        byteLength: qualificationReceiptBytes.byteLength,
        sha256: sha256(qualificationReceiptBytes)
      },
      catalog: {
        byteLength: catalogBytes.byteLength,
        sha256: sha256(catalogBytes)
      },
      p2pPieceSetSha256
    },
    members
  };
  const manifestSha256 = sha256(Buffer.from(`${JSON.stringify(manifest)}\n`, "utf8"));
  const admissionAuthoritySha256 = sha256(Buffer.from(
    `${JSON.stringify(manifest.admissionAuthority)}\n`,
    "utf8"
  ));

  return {
    ...fixture,
    catalog,
    catalogText,
    catalogAuthority: catalogAuthorityRecord,
    p2pPieceSetSha256,
    admissionAuthority: {
      admissionText,
      qualificationReceiptText,
      catalogText,
      catalogAuthority: catalogAuthorityRecord,
      p2pPieceSetSha256
    },
    manifest,
    manifestSha256,
    admissionAuthoritySha256
  };
}

function createDocuments(fixture, port) {
  const announcementIds = peerAnnouncementIds(fixture);
  const selectedPeerBaseUrl = `https://1.1.1.1:${port}/`;
  const laterPeerBaseUrl = `https://9.9.9.9:${port}/`;
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

  return {
    catalog: fixture.catalog,
    peerFeed: {
      schema: catalogAuthority.PEER_SCHEMA,
      feed_id: `test-only/direct-p2p-${fixture.label}`,
      revision: 1,
      generated_at_utc: utc(-60_000),
      valid_until_utc: utc(60 * 60_000),
      project_server_serves_model_bytes: false,
      project_server_proxies_model_bytes: false,
      announcements: [
        announcement(announcementIds.later, laterPeerBaseUrl, "later"),
        announcement(announcementIds.selected, selectedPeerBaseUrl, "selected")
      ]
    },
    selectedPeerBaseUrl,
    laterPeerBaseUrl,
    validationNowUtc: utc(0)
  };
}

function browserFixture(fixture, documents) {
  return {
    classification: fixture.classification,
    testOnly: fixture.testOnly,
    eligibleAsLiveModel: fixture.eligibleAsLiveModel,
    admissionText: fixture.admissionText,
    admissionSha256: fixture.admissionSha256,
    qualificationReceiptText: fixture.qualificationReceiptText,
    qualificationReceiptSha256: fixture.qualificationReceiptSha256,
    admissionAuthority: fixture.admissionAuthority,
    manifest: fixture.manifest,
    manifestSha256: fixture.manifestSha256,
    catalog: documents.catalog,
    peerFeed: documents.peerFeed,
    validationNowUtc: documents.validationNowUtc
  };
}

function expectedOpenedAdmissionAuthority(fixture) {
  return {
    admission: admissionAuthority.parseAdmissionText(fixture.admissionText),
    admissionText: fixture.admissionText,
    admissionSha256: fixture.admissionSha256,
    qualificationReceipt: fixture.qualificationReceipt,
    qualificationReceiptText: fixture.qualificationReceiptText,
    qualificationReceiptSha256: fixture.qualificationReceiptSha256,
    catalogDocument: fixture.catalog,
    catalogText: fixture.catalogText,
    catalogAuthority: fixture.catalogAuthority,
    p2pPieceSetSha256: fixture.p2pPieceSetSha256
  };
}

function fakeRuntimeClientSource(fixture) {
  const admission = admissionAuthority.parseAdmissionText(fixture.admissionText);
  const expected = {
    operationId: admission.operationId,
    graphIdentitySha256: admission.composition.graphIdentitySha256,
    memberTableSha256: admission.composition.memberTableSha256,
    compositionSha256: admission.artifacts[5].sha256,
    compositionBytes: admission.artifacts[5].byteCount
  };
  return `(() => {
    "use strict";
    const expected = ${JSON.stringify(expected)};
    const roles = ${JSON.stringify(admissionAuthority.artifactSpecs.map((item) => item.role))};
    const observations = { initializeCalls: 0, activationCalls: 0, roles: [], bytes: 0 };
    globalThis.__testOnlyActivationObservations = observations;
    class TestOnlyRuntimeClient {
      constructor() {
        this.status = "idle";
        this.operationId = "";
        this.compositionId = "";
      }
      async initialize(value) {
        observations.initializeCalls += 1;
        if (value.operationId !== expected.operationId ||
            value.compositionId !== expected.graphIdentitySha256) {
          throw new Error("test-only runtime initialization identity drift");
        }
        this.operationId = value.operationId;
        this.compositionId = value.compositionId;
        this.status = "active";
        return { state: "initialized", operationId: this.operationId };
      }
      async activate(artifacts, onProgress) {
        observations.activationCalls += 1;
        const totalBytes = artifacts.reduce((total, item) => total + item.byteLength, 0);
        let completedBytes = 0;
        for (const artifact of artifacts) {
          let artifactBytes = 0;
          for await (const chunk of artifact.chunks) {
            if (!chunk || chunk.offset !== artifactBytes ||
                !(chunk.bytes instanceof ArrayBuffer) || chunk.bytes.byteLength < 1) {
              throw new Error("test-only activation chunk drift");
            }
            artifactBytes += chunk.bytes.byteLength;
            completedBytes += chunk.bytes.byteLength;
            onProgress({ role: artifact.role, completedBytes, totalBytes });
          }
          if (artifactBytes !== artifact.byteLength) {
            throw new Error("test-only activation length drift");
          }
          observations.roles.push(artifact.role);
          observations.bytes += artifactBytes;
        }
        if (JSON.stringify(observations.roles) !== JSON.stringify(roles)) {
          throw new Error("test-only activation role drift");
        }
        return {
          state: "active-idle",
          operationId: this.operationId,
          activeComposition: {
            graphIdentitySha256: expected.graphIdentitySha256,
            memberTableSha256: expected.memberTableSha256,
            artifactSha256: expected.compositionSha256,
            artifactBytes: expected.compositionBytes
          },
          committedKvBytes: 0
        };
      }
      async advanceOperation(value) {
        this.operationId = value.operationId;
        this.compositionId = value.compositionId;
      }
      requestCancellation() {}
      terminate() { this.status = "terminated"; }
    }
    globalThis.TinyRustLMModelRuntimeClient = Object.freeze({
      ACTIVATION_ROLES: Object.freeze(roles),
      MAXIMUM_BINARY_CHUNK_BYTES: 4 * 1024 * 1024,
      createBrowserClient() { return new TestOnlyRuntimeClient(); },
      async identityFromText() { return "test-only-never-live"; },
      async *chunksFromBlob(blob) { yield { offset: 0, bytes: await blob.arrayBuffer() }; }
    });
  })();`;
}

function memberRoute(fixture, fileName) {
  return `${ROUTE_PREFIX}/compositions/${fixture.compositionId}/members/${fileName}`;
}

// Starts one owned peer and optionally holds an exact member before its first body byte.
async function startPeerServer(fixtures, applicationOrigin, responseHold = null) {
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
  const server = http.createServer(async (request, response) => {
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
      completed: false,
      closed: false,
      closedEarly: false,
      requestAborted: false,
      heldBeforeBody: false
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

    if (!route || request.method !== "GET" || request.headers.origin !== applicationOrigin) {
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

    if (responseHold &&
        responseHold.fixtureLabel === route.fixture.label &&
        responseHold.fileName === route.fileName) {
      record.heldBeforeBody = true;
      responseHold.notifyEntered(record);
      await responseHold.untilReleased;
      if (response.destroyed) return;
    }

    let offset = 0;
    const schedule = () => {
      setTimeout(writeNext, route.fixture.responseDelayMilliseconds);
    };
    const writeNext = () => {
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
      if (response.write(chunk)) schedule();
      else response.once("drain", schedule);
    };
    writeNext();
  });

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
  if (!address || typeof address === "string") {
    throw new Error("The test-owned loopback peer did not expose a TCP port");
  }

  return {
    port: address.port,
    requests,
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  };
}


async function launchProfile(profileRoot) {
  return chromium.launchPersistentContext(profileRoot, {
    channel: process.env.TINYRUSTLM_PLAYWRIGHT_CHANNEL || undefined,
    headless: true,
    viewport: { width: 1365, height: 768 },
    colorScheme: "dark",
    locale: "en-US"
  });
}

async function installTestOnlyPeerFetchBridge(page, peerBaseUrls, localPeerPort) {
  await page.addInitScript(({ advertisedPeerBaseUrls, peerPort, routePrefix }) => {
    const nativeFetch = globalThis.fetch.bind(globalThis);
    const advertisedOrigins = new Set(advertisedPeerBaseUrls.map(
      (peerBaseUrl) => new URL(peerBaseUrl).origin
    ));
    globalThis.fetch = async (input, init) => {
      const requestedUrl = new URL(
        input instanceof Request ? input.url : String(input),
        globalThis.location.href
      );
      if (!advertisedOrigins.has(requestedUrl.origin)) {
        return nativeFetch(input, init);
      }
      if (!requestedUrl.pathname.startsWith(`${routePrefix}/compositions/`)) {
        throw new Error("The test-only peer bridge refused an unexpected public-IP route");
      }
      const localUrl = new URL(requestedUrl.href);
      localUrl.protocol = "http:";
      localUrl.hostname = "127.0.0.1";
      localUrl.port = String(peerPort);
      const response = await nativeFetch(localUrl.href, init);
      return new Proxy(response, {
        get(target, property) {
          if (property === "url") return requestedUrl.href;
          const value = Reflect.get(target, property, target);
          return typeof value === "function" ? value.bind(target) : value;
        }
      });
    };
  }, {
    advertisedPeerBaseUrls: peerBaseUrls,
    peerPort: localPeerPort,
    routePrefix: ROUTE_PREFIX
  });
}

async function openRuntimePage(context, baseURL, requests, peerBaseUrls, localPeerPort) {
  const page = context.pages()[0] || await context.newPage();
  await installTestOnlyPeerFetchBridge(page, peerBaseUrls, localPeerPort);
  page.on("request", (request) => {
    requests.push({
      method: request.method(),
      resourceType: request.resourceType(),
      url: request.url()
    });
  });
  await page.goto(new URL("/app/browser-model-admission.js", baseURL).href, {
    waitUntil: "domcontentloaded"
  });
  for (const scriptName of RUNTIME_SCRIPTS) {
    await page.addScriptTag({
      url: new URL(`/app/${scriptName}`, baseURL).href
    });
  }
  return page;
}

test("one basic click verifies caches and activates a listed P2P composition", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The full one-click storage path runs in desktop Chromium");
  test.setTimeout(120_000);

  const applicationOrigin = new URL(String(testInfo.project.use.baseURL)).origin;
  const fixture = createSyntheticFixture(
    "basic-one-click",
    [65549, 32771, 16381, 65800, 512, 896],
    2
  );
  let notifyHeldRequest;
  const heldRequestEntered = new Promise((resolve) => {
    notifyHeldRequest = resolve;
  });
  let resolveHeldResponse;
  const heldResponseReleased = new Promise((resolve) => {
    resolveHeldResponse = resolve;
  });
  let heldResponseWasReleased = false;
  // Releases the held response exactly once so failed assertions cannot strand the listener.
  const releaseHeldResponse = () => {
    if (heldResponseWasReleased) return;
    heldResponseWasReleased = true;
    resolveHeldResponse();
  };
  let peer = null;
  let huggingFaceRequests = 0;
  let directSeedRequests = 0;
  let catalogMode = "listed";
  try {
    peer = await startPeerServer([fixture], applicationOrigin, {
      fixtureLabel: fixture.label,
      fileName: "model.slm2",
      notifyEntered: notifyHeldRequest,
      untilReleased: heldResponseReleased
    });
    const documents = createDocuments(fixture, peer.port);
    const admissionRoute = documents.catalog.entries[0].browser_admission.route;
    const admissionUrl = new URL(admissionRoute, CATALOG_URL).href;
    const qualificationReceiptRoute =
      documents.catalog.entries[0].qualification.receipt_route;
    const qualificationReceiptUrl = new URL(qualificationReceiptRoute, CATALOG_URL).href;

    await installTestOnlyPeerFetchBridge(page, [
      documents.selectedPeerBaseUrl,
      documents.laterPeerBaseUrl
    ], peer.port);

    await page.route(CATALOG_URL, (route) => route.fulfill({
      status: catalogMode === "unavailable" ? 503 : 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: `${JSON.stringify(catalogMode === "empty"
        ? { ...documents.catalog, entries: [] }
        : documents.catalog)}\n`
    }));
    await page.route(PEER_FEED_URL, (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: `${JSON.stringify(catalogMode === "listed"
        ? documents.peerFeed
        : { ...documents.peerFeed, announcements: [] })}\n`
    }));
    await page.route(qualificationReceiptUrl, (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Length": String(Buffer.byteLength(fixture.qualificationReceiptText, "utf8"))
      },
      body: fixture.qualificationReceiptText
    }));
    await page.route(admissionUrl, (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Length": String(Buffer.byteLength(fixture.admissionText, "utf8"))
      },
      body: fixture.admissionText
    }));
    await page.route("**/app/model-runtime-client.js*", (route) => route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: fakeRuntimeClientSource(fixture)
    }));
    await page.route("https://huggingface.co/api/models**", (route) => {
      huggingFaceRequests += 1;
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.includes("/v1/direct-composition-seeds")) {
        directSeedRequests += 1;
      }
    });

    await page.goto("/app/", { waitUntil: "domcontentloaded" });
    const chooser = page.locator("#simpleDiscoveryPanel");
    const card = chooser.locator(`[data-composition-id="${fixture.compositionId}"]`);
    const advancedDrawer = page.locator('details[data-panel-key="dashboard-model-source"]');
    await expect(chooser).toBeVisible();
    await expect(card).toHaveAttribute("data-route", "qualified-p2p");
    await expect(card).toHaveAttribute("data-default", "true");
    await expect(card).toContainText("P2P download");
    await expect(page.locator("#simpleModelPickerStatus")).toHaveText(
      "1 model found. 1 listed for P2P download."
    );
    await expect(page.locator(".app-shell")).toHaveAttribute("data-mode", "simple");
    await expect(page.locator(".app-shell")).toHaveAttribute("data-rail-collapsed", "true");
    await expect(advancedDrawer).toHaveJSProperty("open", false);
    await expect(page.locator("#hfSearchInput")).toHaveValue("");
    expect(huggingFaceRequests).toBe(0);

    await card.click();
    const heldRequest = await heldRequestEntered;
    expect(heldRequest).toMatchObject({
      fixtureLabel: fixture.label,
      fileName: "model.slm2",
      heldBeforeBody: true,
      bytesWritten: 0,
      completed: false
    });
    await expect(page.locator("#simpleModelList")).toHaveAttribute("aria-busy", "true");
    await expect(chooser).toHaveAttribute("aria-busy", "false");
    await expect(chooser.getByRole("button", { name: "Cancel model acquisition" })).toBeVisible();
    await expect(page.locator("#simpleModelPickerStatus")).toContainText(
      /Preparing|Downloading|Saving/u
    );
    releaseHeldResponse();

    await expect.poll(async () => {
      const runtimeStatus = await page.locator("#runtimeStatus").textContent();
      if (runtimeStatus === "Composition rejected") {
        return `${runtimeStatus}: ${await page.locator("#errorState").textContent()}`;
      }
      return runtimeStatus;
    }, { timeout: 90_000 }).toBe("Ready");
    await expect(chooser).toBeHidden();
    await expect(page.locator("html")).toHaveAttribute("data-active-model", "__local_slm_file");
    await expect(page.locator(".app-shell")).toHaveAttribute("data-mode", "simple");
    await expect(page.locator(".app-shell")).toHaveAttribute("data-rail-collapsed", "true");
    await expect(advancedDrawer).toHaveJSProperty("open", false);
    await expect(page.locator("#simpleModelList")).toHaveAttribute("aria-busy", "false");
    await expect(chooser).toHaveAttribute("aria-busy", "false");
    await expect(page.locator("#simpleModelActionButton")).toBeHidden();
    await expect(page.locator("#simpleModelActionButton")).toBeDisabled();
    expect(huggingFaceRequests).toBe(0);
    expect(directSeedRequests).toBe(0);

    const result = await page.evaluate(async () => {
      const api = globalThis.TinyRustLMModelCompositionStore;
      const adapter = api.createOpfsAdapter({
        createSha256: globalThis.TinyRustLMIncrementalSha256.createSha256
      });
      const store = api.createModelCompositionStore({
        adapter,
        maximumCompositionBytes: 4 * 1024 * 1024
      });
      const active = await store.openActive();
      return {
        activation: globalThis.__testOnlyActivationObservations,
        manifestSha256: active.manifestSha256,
        admissionAuthoritySha256: active.admissionAuthoritySha256,
        admissionAuthority: active.admissionAuthority,
        members: active.manifest.members.map((member) => ({
          fileName: member.fileName,
          byteLength: member.byteLength,
          sha256: member.sha256
        }))
      };
    });
    expect(result.activation).toEqual({
      initializeCalls: 1,
      activationCalls: 1,
      roles: admissionAuthority.artifactSpecs.map((item) => item.role),
      bytes: fixture.manifest.members.reduce((total, member) => total + member.byteLength, 0)
    });
    expect(result).toMatchObject({
      manifestSha256: fixture.manifestSha256,
      admissionAuthoritySha256: fixture.admissionAuthoritySha256,
      admissionAuthority: expectedOpenedAdmissionAuthority(fixture),
      members: fixture.manifest.members
    });
    expect(peer.requests.filter((request) => request.completed).map(
      (request) => request.fileName
    )).toEqual(MEMBER_NAMES);

    for (const mode of ["empty", "unavailable"]) {
      catalogMode = mode;
      // A returning user must retire interrupted storage without starting another acquisition.
      await page.evaluate(async mode => {
        const root = await (await navigator.storage.getDirectory()).getDirectoryHandle("tinyrustlm-model-compositions-v2");
        const stagingId = (mode === "empty" ? "b" : "c").repeat(64);
        const manifestSha256 = (mode === "empty" ? "d" : "e").repeat(64);
        await (await root.getDirectoryHandle("installed")).getDirectoryHandle(manifestSha256, { create: true });
        const writer = await (await (await root.getDirectoryHandle("staging"))
          .getFileHandle(`${stagingId}.json`, { create: true })).createWritable();
        await writer.write(`${JSON.stringify({ schema: "tinyrustlm.model-composition-store.staging/2",
          stagingId, manifestSha256 })}\n`);
        await writer.close();
      }, mode);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator("#runtimeStatus")).toHaveText("Ready", { timeout: 90_000 });
      await expect.poll(async () => JSON.parse(await page.locator("#diagnostics").textContent()).cache_cleanup)
        .toEqual({ status: "complete", passes: 1, removed_installed: 1, removed_staging: 1, error: null });
      const retained = await page.evaluate(async () => {
        const root = await (await navigator.storage.getDirectory()).getDirectoryHandle("tinyrustlm-model-compositions-v2");
        const installed = [], staging = [];
        for await (const name of (await root.getDirectoryHandle("installed")).keys()) installed.push(name);
        for await (const name of (await root.getDirectoryHandle("staging")).keys()) staging.push(name);
        return { installed, staging };
      });
      expect(retained).toEqual({ installed: [fixture.manifestSha256], staging: [] });
      await page.locator("#modelEditButton").click();
      const installedCard = page.locator(
        `#simpleModelList [data-composition-id="${fixture.compositionId}"]`
      );
      await expect(installedCard).toHaveCount(1);
      await expect(installedCard).toHaveAttribute("data-route", "installed");
      await expect(installedCard).toHaveAttribute("data-default", "true");
      await expect(installedCard).toHaveAttribute("data-recovery", "false");
      await expect(installedCard).toBeEnabled();
      await expect(installedCard).toContainText("Ready to use");
      await expect(installedCard).not.toContainText(/P2P copy|prepare on this device/iu);
      await expect(page.locator("#simpleModelPickerStatus")).toContainText(
        /saved model is (?:verified and )?ready/iu
      );
      await expect(advancedDrawer).toHaveJSProperty("open", false);
      await expect(page.locator("#hfSearchInput")).toHaveValue("");
      await expect(page.locator("#hfSearchInput")).not.toHaveAttribute("placeholder", /.+/u);
      await expect(page.locator("#hfResults > *")).toHaveCount(0);
      expect(huggingFaceRequests).toBe(0);
      await installedCard.click();
      await expect(chooser).toBeHidden();
    }
  } finally {
    releaseHeldResponse();
    if (peer) await peer.close();
  }
});

test("metadata cancellation leaves browser storage untouched before peer transfer", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const fixture = createSyntheticFixture(
    "metadata-cancellation", [37, 43, 31, 65800, 512, 896], 1
  );
  const documents = createDocuments(fixture, 40253);
  await page.goto("/app/browser-model-admission.js", { waitUntil: "domcontentloaded" });
  for (const scriptName of RUNTIME_SCRIPTS) {
    await page.addScriptTag({ url: `/app/${scriptName}` });
  }
  const observed = await page.evaluate(async (fixture) => {
    const admissionApi = globalThis.TinyRustLMBrowserModelAdmission;
    const catalogApi = globalThis.TinyRustLMMiniModelCatalogV1;
    const storeApi = globalThis.TinyRustLMModelCompositionStore;
    const p2pApi = globalThis.TinyRustLMP2PCompositionInstall;
    const entries = await catalogApi.buildVerifiedCatalogView(
      fixture.catalog, fixture.peerFeed, { now: new Date(fixture.validationNowUtc) }
    );
    const admissionRecord = Object.freeze({
      admission: admissionApi.parseAdmissionText(fixture.admissionText),
      admissionText: fixture.admissionText,
      admissionSha256: fixture.admissionSha256,
      qualificationReceipt: Object.freeze(JSON.parse(fixture.qualificationReceiptText)),
      qualificationReceiptText: fixture.qualificationReceiptText,
      qualificationReceiptSha256: fixture.qualificationReceiptSha256
    });
    const actualStore = storeApi.createModelCompositionStore({
      adapter: storeApi.createOpfsAdapter({
        createSha256: globalThis.TinyRustLMIncrementalSha256.createSha256
      }),
      maximumCompositionBytes: 4 * 1024 * 1024
    });
    const storageRoot = await navigator.storage.getDirectory();
    const before = [];
    for await (const name of storageRoot.keys()) before.push(name);
    const nativeDigest = crypto.subtle.digest;
    const schedule = globalThis.setTimeout;
    const results = [];
    for (const ordinal of [1, 2, 3, 4]) {
      for (const mode of ["cancel", "deadline"]) {
        const entered = Promise.withResolvers();
        const held = Promise.withResolvers();
        const parent = new AbortController();
        let digests = 0;
        let storeCalls = 0;
        let fetchCalls = 0;
        let expire;
        let observationTimer;
        crypto.subtle.digest = (algorithm, bytes) => {
          digests += 1;
          if (digests !== ordinal) return nativeDigest.call(crypto.subtle, algorithm, bytes);
          entered.resolve();
          return held.promise;
        };
        globalThis.setTimeout = (callback, delay, ...args) => {
          if (delay === 7777) expire = callback;
          return schedule(callback, delay, ...args);
        };
        const pending = p2pApi.installP2pComposition({
          entry: entries[0], admissionRecord,
          manifest: fixture.manifest, admissionAuthority: fixture.admissionAuthority,
          signal: parent.signal, timeoutMilliseconds: 7777,
          store: { install(options) { storeCalls += 1; return actualStore.install(options); } },
          fetch() { fetchCalls += 1; throw new Error("unexpected model transfer"); }
        }).then(() => "unexpected-success", (error) => error.code);
        try {
          await entered.promise;
          if (mode === "cancel") parent.abort();
          else expire();
          const result = await Promise.race([
            pending,
            new Promise((resolve) => {
              observationTimer = schedule(() => resolve("still-pending"), 250);
            })
          ]);
          held.reject(new Error("late browser digest failure"));
          await new Promise((resolve) => schedule(resolve, 0));
          results.push({ ordinal, mode, result, digests, storeCalls, fetchCalls });
        } finally {
          clearTimeout(observationTimer);
          held.reject(new Error("browser fixture cleanup"));
          await pending;
          crypto.subtle.digest = nativeDigest;
          globalThis.setTimeout = schedule;
        }
      }
    }
    const after = [];
    for await (const name of storageRoot.keys()) after.push(name);
    return { results, before: before.sort(), after: after.sort() };
  }, browserFixture(fixture, documents));
  expect(pageErrors).toEqual([]);
  expect(observed.after).toEqual(observed.before);
  expect(observed.results).toHaveLength(8);
  for (const result of observed.results) {
    expect(result).toEqual({
      ordinal: result.ordinal, mode: result.mode,
      result: result.mode === "cancel"
        ? "p2p-composition-install-aborted" : "p2p-composition-install-timeout",
      digests: result.ordinal, storeCalls: 0, fetchCalls: 0
    });
  }
});

test("direct P2P streams six members into persistent OPFS and cancels atomically", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The direct P2P proof runs in desktop Chromium");
  test.setTimeout(180_000);

  expect(admissionAuthority.artifactSpecs.map((spec) => spec.fileName)).toEqual(MEMBER_NAMES);
  const applicationOrigin = new URL(String(testInfo.project.use.baseURL)).origin;
  const activeFixture = createSyntheticFixture(
    "active",
    [131101, 73717, 69643, 65800, 512, 896],
    3
  );
  const cancelledFixture = createSyntheticFixture(
    "cancelled",
    [196613, 81929, 77801, 65800, 512, 896],
    25
  );
  const profileRoot = createOwnedBrowserProfile("direct-peer");
  const browserRequests = [];
  let peer = null;
  let context = null;

  try {
    peer = await startPeerServer([activeFixture, cancelledFixture], applicationOrigin);
    const activeDocuments = createDocuments(activeFixture, peer.port);
    const cancelledDocuments = createDocuments(cancelledFixture, peer.port);

    context = await launchProfile(profileRoot);
    const peerBaseUrls = [
      activeDocuments.selectedPeerBaseUrl,
      activeDocuments.laterPeerBaseUrl
    ];
    const installPage = await openRuntimePage(
      context,
      applicationOrigin,
      browserRequests,
      peerBaseUrls,
      peer.port
    );
    const installed = await installPage.evaluate(async ({ fixture, storeChunkBytes }) => {
      const admissionApi = globalThis.TinyRustLMBrowserModelAdmission;
      const catalogApi = globalThis.TinyRustLMMiniModelCatalogV1;
      const incrementalShaApi = globalThis.TinyRustLMIncrementalSha256;
      const storeApi = globalThis.TinyRustLMModelCompositionStore;
      const p2pApi = globalThis.TinyRustLMP2PCompositionInstall;
      const capabilities = {
        secureContext: isSecureContext,
        opfs: Boolean(navigator.storage && navigator.storage.getDirectory),
        catalogProjection: Boolean(catalogApi && catalogApi.buildVerifiedCatalogView),
        admissionParser: Boolean(admissionApi && admissionApi.parseAdmissionText),
        directInstaller: Boolean(p2pApi && p2pApi.installP2pComposition),
        incrementalSha: Boolean(incrementalShaApi && incrementalShaApi.createSha256),
        compositionStore: Boolean(storeApi && storeApi.createOpfsAdapter)
      };
      const admission = admissionApi.parseAdmissionText(fixture.admissionText);
      const qualificationReceipt = Object.freeze(
        JSON.parse(fixture.qualificationReceiptText)
      );
      const admissionRecord = Object.freeze({
        admission,
        admissionText: fixture.admissionText,
        admissionSha256: fixture.admissionSha256,
        qualificationReceipt,
        qualificationReceiptText: fixture.qualificationReceiptText,
        qualificationReceiptSha256: fixture.qualificationReceiptSha256
      });
      const entries = await catalogApi.buildVerifiedCatalogView(
        fixture.catalog,
        fixture.peerFeed,
        {
          now: new Date(fixture.validationNowUtc)
        }
      );
      const entry = entries[0];
      const shaObservations = {
        instances: 0,
        updates: 0,
        digests: 0,
        maximumUpdateBytes: 0
      };
      const createSha256 = () => {
        const hasher = incrementalShaApi.createSha256();
        shaObservations.instances += 1;
        return {
          update(bytes) {
            shaObservations.updates += 1;
            shaObservations.maximumUpdateBytes = Math.max(
              shaObservations.maximumUpdateBytes,
              bytes.byteLength
            );
            return hasher.update(bytes);
          },
          digest() {
            shaObservations.digests += 1;
            return hasher.digest();
          }
        };
      };
      const adapter = storeApi.createOpfsAdapter({ createSha256 });
      const actualStore = storeApi.createModelCompositionStore({
        adapter,
        chunkBytes: storeChunkBytes,
        maximumCompositionBytes: 4 * 1024 * 1024
      });
      let activationCalls = 0;
      const activationEvents = [];
      const store = Object.freeze({
        ...actualStore,
        install(value) {
          return actualStore.install({
            ...value,
            activate: async (candidate) => {
              activationCalls += 1;
              activationEvents.push("activate");
              if (candidate.manifestSha256 !== fixture.manifestSha256) {
                throw new Error(
                  `candidate=${candidate.manifestSha256}; fixture=${fixture.manifestSha256}`
                );
              }
              return true;
            },
            // This is synthetic activation authorization, not a real runtime/model proof.
            authorizeCommit: async (candidate, context) => {
              activationEvents.push("authorizeCommit");
              const currentEntries = await catalogApi.buildVerifiedCatalogView(
                fixture.catalog,
                fixture.peerFeed,
                { now: new Date() }
              );
              const currentPeer = currentEntries[0]?.peers[0];
              const disposition = catalogApi.qualificationDisposition(
                candidate.admissionAuthority.catalogDocument,
                candidate.admissionAuthority.admission,
                { now: new Date() }
              );
              return activationCalls === 1 && context.previousComposition === null &&
                context.signal === value.signal && !context.signal.aborted &&
                candidate.manifestSha256 === fixture.manifestSha256 &&
                candidate.admissionAuthority.admissionText === fixture.admissionText &&
                candidate.admissionAuthority.catalogText === fixture.admissionAuthority.catalogText &&
                disposition.status === "current" &&
                currentPeer?.signatureVerified === true &&
                currentPeer.peerBaseUrl === entry.peers[0].peerBaseUrl &&
                currentPeer.pieceSetSha256 === candidate.admissionAuthority.p2pPieceSetSha256;
            }
          });
        }
      });
      const progressByMember = Object.fromEntries(storeApi.memberNames.map((fileName) => [
        fileName,
        {
          updates: 0,
          lastMemberBytes: 0,
          memberTotalBytes: 0,
          maximumNetworkChunkBytes: 0
        }
      ]));
      const progressPeers = new Set();
      let previousCompletedBytes = 0;
      let progressMonotonic = true;
      let progressFrozen = true;
      let active;
      try {
        active = await p2pApi.installP2pComposition({
          entry,
          admissionRecord,
          manifest: fixture.manifest,
          admissionAuthority: fixture.admissionAuthority,
          store,
          onProgress(update) {
            progressFrozen = progressFrozen && Object.isFrozen(update);
            progressMonotonic = progressMonotonic &&
              update.completedBytes > previousCompletedBytes;
            previousCompletedBytes = update.completedBytes;
            progressPeers.add(update.peerBaseUrl);
            const summary = progressByMember[update.memberName];
            const networkChunkBytes = update.memberCompletedBytes - summary.lastMemberBytes;
            summary.updates += 1;
            summary.lastMemberBytes = update.memberCompletedBytes;
            summary.memberTotalBytes = update.memberTotalBytes;
            summary.maximumNetworkChunkBytes = Math.max(
              summary.maximumNetworkChunkBytes,
              networkChunkBytes
            );
          }
        });
      } catch (error) {
        const chain = [];
        for (let current = error; current && chain.length < 8; current = current.cause) {
          chain.push({
            name: current.name || null,
            code: current.code || null,
            message: current.message || null,
            memberName: current.memberName || null
          });
        }
        throw new Error(JSON.stringify(chain));
      }

      return {
        capabilities,
        classification: fixture.classification,
        testOnly: fixture.testOnly,
        eligibleAsLiveModel: fixture.eligibleAsLiveModel,
        protocol: {
          profile: p2pApi.protocolProfile,
          routePrefix: p2pApi.routePrefix,
          memberNames: p2pApi.memberNames
        },
        catalogProjection: {
          count: entries.length,
          frozen: Object.isFrozen(entry) && Object.isFrozen(entry.peers) &&
            entry.peers.every((candidate) => Object.isFrozen(candidate)),
          signaturesVerified: entry.peers.every(
            (candidate) => candidate.signatureVerified === true
          ),
          availability: entry.availability,
          peerBaseUrls: entry.peers.map((candidate) => candidate.peerBaseUrl)
        },
        admission: {
          canonical: admissionApi.serializeAdmission(admission) === fixture.admissionText,
          modelId: admission.modelId,
          qualificationReceiptSchema: qualificationReceipt.schema,
          qualityScope: admission.qualification.qualityScope,
          memberNames: admission.artifacts.map((artifact) => artifact.fileName)
        },
        active: {
          manifestSha256: active.manifestSha256,
          admissionAuthoritySha256: active.admissionAuthoritySha256,
          activationId: active.activationId,
          admissionAuthority: active.admissionAuthority,
          manifest: active.manifest
        },
        progress: {
          frozen: progressFrozen,
          monotonic: progressMonotonic,
          completedBytes: previousCompletedBytes,
          peerBaseUrls: [...progressPeers],
          byMember: progressByMember
        },
        shaObservations,
        activationCalls,
        activationEvents
      };
    }, {
      fixture: browserFixture(activeFixture, activeDocuments),
      storeChunkBytes: STORE_CHUNK_BYTES
    });

    expect(installed.capabilities).toEqual({
      secureContext: true,
      opfs: true,
      catalogProjection: true,
      admissionParser: true,
      directInstaller: true,
      incrementalSha: true,
      compositionStore: true
    });
    expect(installed).toMatchObject({
      classification: TEST_ONLY_CLASSIFICATION,
      testOnly: true,
      eligibleAsLiveModel: false
    });
    expect(installed.protocol).toEqual({
      profile: PROTOCOL_PROFILE,
      routePrefix: ROUTE_PREFIX,
      memberNames: MEMBER_NAMES
    });
    expect(installed.catalogProjection).toEqual({
      count: 1,
      frozen: true,
      signaturesVerified: true,
      availability: "peer",
      peerBaseUrls: [
        activeDocuments.selectedPeerBaseUrl,
        activeDocuments.laterPeerBaseUrl
      ]
    });
    expect(installed.admission).toEqual({
      canonical: true,
      modelId: activeFixture.modelId,
      qualificationReceiptSchema: catalogAuthority.QUALIFICATION_RECEIPT_SCHEMA,
      qualityScope: TEST_ONLY_SCOPE,
      memberNames: MEMBER_NAMES
    });
    expect(installed.active).toEqual({
      manifestSha256: activeFixture.manifestSha256,
      admissionAuthoritySha256: activeFixture.admissionAuthoritySha256,
      activationId: installed.active.activationId,
      admissionAuthority: expectedOpenedAdmissionAuthority(activeFixture),
      manifest: activeFixture.manifest
    });
    expect(installed.active.activationId).toMatch(/^[0-9a-f]{64}$/u);
    expect(installed.progress).toMatchObject({
      frozen: true,
      monotonic: true,
      completedBytes: activeFixture.manifest.members.reduce(
        (total, member) => total + member.byteLength,
        0
      ),
      peerBaseUrls: [activeDocuments.selectedPeerBaseUrl]
    });
    for (const member of activeFixture.manifest.members) {
      const progress = installed.progress.byMember[member.fileName];
      expect(progress.updates).toBeGreaterThan(0);
      expect(progress.lastMemberBytes).toBe(member.byteLength);
      expect(progress.memberTotalBytes).toBe(member.byteLength);
      expect(progress.maximumNetworkChunkBytes).toBeGreaterThan(0);
      expect(progress.maximumNetworkChunkBytes).toBeLessThanOrEqual(member.byteLength);
      if (member.byteLength > 1024) {
        expect(progress.updates).toBeGreaterThan(1);
        expect(progress.maximumNetworkChunkBytes).toBeLessThan(member.byteLength);
      }
    }
    expect(installed.shaObservations.instances).toBeGreaterThan(MEMBER_NAMES.length);
    expect(installed.shaObservations.updates).toBeGreaterThan(installed.shaObservations.instances);
    expect(installed.shaObservations.digests).toBe(installed.shaObservations.instances);
    expect(installed.activationCalls).toBe(1);
    expect(installed.activationEvents).toEqual(["activate", "authorizeCommit"]);
    expect(installed.shaObservations.maximumUpdateBytes).toBeLessThan(
      Math.min(...activeFixture.manifest.members.slice(0, 4).map(
        (member) => member.byteLength
      ))
    );

    await context.close();
    context = null;

    context = await launchProfile(profileRoot);
    const reopenPage = await openRuntimePage(
      context,
      applicationOrigin,
      browserRequests,
      peerBaseUrls,
      peer.port
    );
    const reopened = await reopenPage.evaluate(async ({
      cancelledFixture: fixture,
      opfsRootName,
      storeChunkBytes
    }) => {
      const admissionApi = globalThis.TinyRustLMBrowserModelAdmission;
      const catalogApi = globalThis.TinyRustLMMiniModelCatalogV1;
      const incrementalShaApi = globalThis.TinyRustLMIncrementalSha256;
      const storeApi = globalThis.TinyRustLMModelCompositionStore;
      const p2pApi = globalThis.TinyRustLMP2PCompositionInstall;

      function hex(bytes) {
        let value = "";
        for (const byte of bytes) value += byte.toString(16).padStart(2, "0");
        return value;
      }

      async function storeRoot() {
        const root = await navigator.storage.getDirectory();
        return root.getDirectoryHandle(opfsRootName, { create: false });
      }

      async function activePointerText() {
        const root = await storeRoot();
        const handle = await root.getFileHandle("active.json", { create: false });
        return (await handle.getFile()).text();
      }

      async function installedEntries() {
        const root = await storeRoot();
        const installed = await root.getDirectoryHandle("installed", { create: false });
        const entries = [];
        for await (const [name, handle] of installed.entries()) {
          entries.push({ name, kind: handle.kind });
        }
        return entries.sort((left, right) => left.name.localeCompare(right.name));
      }

      async function installedMetadataText(manifestSha256, fileName) {
        const root = await storeRoot();
        const installed = await root.getDirectoryHandle("installed", { create: false });
        const composition = await installed.getDirectoryHandle(manifestSha256, {
          create: false
        });
        const handle = await composition.getFileHandle(fileName, { create: false });
        return (await handle.getFile()).text();
      }

      const shaObservations = {
        instances: 0,
        updates: 0,
        digests: 0,
        maximumUpdateBytes: 0
      };
      const createSha256 = () => {
        const hasher = incrementalShaApi.createSha256();
        shaObservations.instances += 1;
        return {
          update(bytes) {
            shaObservations.updates += 1;
            shaObservations.maximumUpdateBytes = Math.max(
              shaObservations.maximumUpdateBytes,
              bytes.byteLength
            );
            return hasher.update(bytes);
          },
          digest() {
            shaObservations.digests += 1;
            return hasher.digest();
          }
        };
      };
      const adapter = storeApi.createOpfsAdapter({ createSha256 });
      const actualStore = storeApi.createModelCompositionStore({
        adapter,
        chunkBytes: storeChunkBytes,
        maximumCompositionBytes: 4 * 1024 * 1024
      });
      const unexpectedInstallEvents = [];
      const store = Object.freeze({
        ...actualStore,
        install(value) {
          return actualStore.install({
            ...value,
            activate: async () => {
              unexpectedInstallEvents.push("activate");
              return false;
            },
            authorizeCommit: async () => {
              unexpectedInstallEvents.push("authorizeCommit");
              return false;
            }
          });
        }
      });
      const active = await store.openActive();
      const parsedAdmission = admissionApi.parseAdmissionText(
        active.admissionAuthority.admissionText
      );
      const installedMetadata = {
        manifestText: await installedMetadataText(active.manifestSha256, "manifest.json"),
        admissionText: await installedMetadataText(active.manifestSha256, "admission.json"),
        qualificationReceiptText: await installedMetadataText(
          active.manifestSha256,
          "qualification-receipt.json"
        ),
        catalogText: await installedMetadataText(active.manifestSha256, "catalog.json")
      };
      const memberStreams = {};
      for (const fileName of storeApi.memberNames) {
        const hasher = incrementalShaApi.createSha256();
        let byteLength = 0;
        let chunks = 0;
        let maximumChunkBytes = 0;
        for await (const chunk of active.streamMember(fileName)) {
          hasher.update(chunk);
          byteLength += chunk.byteLength;
          chunks += 1;
          maximumChunkBytes = Math.max(maximumChunkBytes, chunk.byteLength);
        }
        memberStreams[fileName] = {
          byteLength,
          chunks,
          maximumChunkBytes,
          sha256: hex(hasher.digest())
        };
      }

      const pointerBeforeCancellation = await activePointerText();
      const cancellationAdmission = admissionApi.parseAdmissionText(fixture.admissionText);
      const cancellationQualificationReceipt = Object.freeze(
        JSON.parse(fixture.qualificationReceiptText)
      );
      const cancellationAdmissionRecord = Object.freeze({
        admission: cancellationAdmission,
        admissionText: fixture.admissionText,
        admissionSha256: fixture.admissionSha256,
        qualificationReceipt: cancellationQualificationReceipt,
        qualificationReceiptText: fixture.qualificationReceiptText,
        qualificationReceiptSha256: fixture.qualificationReceiptSha256
      });
      const cancellationEntries = await catalogApi.buildVerifiedCatalogView(
        fixture.catalog,
        fixture.peerFeed,
        { now: new Date(fixture.validationNowUtc) }
      );
      const cancellationEntry = cancellationEntries[0];
      const controller = new AbortController();
      const cancellationProgress = [];
      let cancellationError = null;
      try {
        await p2pApi.installP2pComposition({
          entry: cancellationEntry,
          admissionRecord: cancellationAdmissionRecord,
          manifest: fixture.manifest,
          admissionAuthority: fixture.admissionAuthority,
          store,
          signal: controller.signal,
          onProgress(update) {
            cancellationProgress.push({
              peerBaseUrl: update.peerBaseUrl,
              memberName: update.memberName,
              memberCompletedBytes: update.memberCompletedBytes,
              completedBytes: update.completedBytes
            });
            controller.abort();
          }
        });
      } catch (error) {
        cancellationError = {
          name: error && error.name,
          code: error && error.code,
          memberName: error && error.memberName ? error.memberName : null,
          peerBaseUrl: error && error.peerBaseUrl ? error.peerBaseUrl : null
        };
      }
      const pointerAfterCancellation = await activePointerText();
      const activeAfterCancellation = await store.openActive();

      return {
        active: {
          manifestSha256: active.manifestSha256,
          admissionAuthoritySha256: active.admissionAuthoritySha256,
          activationId: active.activationId,
          admissionAuthority: active.admissionAuthority,
          manifest: active.manifest
        },
        parsedAdmission: {
          canonical: admissionApi.serializeAdmission(parsedAdmission) ===
            active.admissionAuthority.admissionText,
          modelId: parsedAdmission.modelId,
          qualityScope: parsedAdmission.qualification.qualityScope,
          memberNames: parsedAdmission.artifacts.map((artifact) => artifact.fileName)
        },
        installedMetadata,
        memberStreams,
        cancellationProjection: {
          frozen: Object.isFrozen(cancellationEntry) &&
            Object.isFrozen(cancellationEntry.peers),
          signaturesVerified: cancellationEntry.peers.every(
            (candidate) => candidate.signatureVerified === true
          ),
          peerBaseUrls: cancellationEntry.peers.map((peer) => peer.peerBaseUrl)
        },
        cancellationError,
        unexpectedInstallEvents,
        cancellationProgress,
        pointerBeforeCancellation,
        pointerAfterCancellation,
        activeAfterCancellation: {
          manifestSha256: activeAfterCancellation.manifestSha256,
          admissionAuthoritySha256: activeAfterCancellation.admissionAuthoritySha256,
          activationId: activeAfterCancellation.activationId
        },
        installedEntries: await installedEntries(),
        shaObservations
      };
    }, {
      cancelledFixture: browserFixture(cancelledFixture, cancelledDocuments),
      opfsRootName: OPFS_ROOT_NAME,
      storeChunkBytes: STORE_CHUNK_BYTES
    });

    expect(reopened.active).toEqual(installed.active);
    expect(reopened.parsedAdmission).toEqual({
      canonical: true,
      modelId: activeFixture.modelId,
      qualityScope: TEST_ONLY_SCOPE,
      memberNames: MEMBER_NAMES
    });
    expect(reopened.installedMetadata).toEqual({
      manifestText: `${JSON.stringify(activeFixture.manifest)}\n`,
      admissionText: activeFixture.admissionText,
      qualificationReceiptText: activeFixture.qualificationReceiptText,
      catalogText: activeFixture.catalogText
    });
    for (const member of activeFixture.manifest.members) {
      expect(reopened.memberStreams[member.fileName]).toEqual({
        byteLength: member.byteLength,
        chunks: reopened.memberStreams[member.fileName].chunks,
        maximumChunkBytes: reopened.memberStreams[member.fileName].maximumChunkBytes,
        sha256: member.sha256
      });
      expect(reopened.memberStreams[member.fileName].chunks).toBeGreaterThan(1);
      expect(reopened.memberStreams[member.fileName].maximumChunkBytes)
        .toBeLessThanOrEqual(STORE_CHUNK_BYTES);
    }
    expect(JSON.parse(reopened.pointerBeforeCancellation)).toEqual({
      schema: STORE_POINTER_SCHEMA,
      stagingId: installed.active.activationId,
      manifestSha256: activeFixture.manifestSha256,
      admissionAuthoritySha256: activeFixture.admissionAuthoritySha256
    });
    expect(reopened.cancellationProjection).toEqual({
      frozen: true,
      signaturesVerified: true,
      peerBaseUrls: [
        cancelledDocuments.selectedPeerBaseUrl,
        cancelledDocuments.laterPeerBaseUrl
      ]
    });
    expect(reopened.cancellationError).toEqual({
      name: "P2pCompositionInstallError",
      code: "p2p-composition-install-aborted",
      memberName: null,
      peerBaseUrl: null
    });
    expect(reopened.unexpectedInstallEvents).toEqual([]);
    expect(reopened.cancellationProgress).toHaveLength(1);
    expect(reopened.cancellationProgress[0]).toMatchObject({
      peerBaseUrl: cancelledDocuments.selectedPeerBaseUrl,
      memberName: "model.slm2"
    });
    expect(reopened.cancellationProgress[0].memberCompletedBytes).toBeGreaterThan(0);
    expect(reopened.cancellationProgress[0].memberCompletedBytes)
      .toBeLessThan(cancelledFixture.manifest.members[0].byteLength);
    expect(reopened.pointerAfterCancellation).toBe(reopened.pointerBeforeCancellation);
    expect(reopened.activeAfterCancellation).toEqual({
      manifestSha256: installed.active.manifestSha256,
      admissionAuthoritySha256: installed.active.admissionAuthoritySha256,
      activationId: installed.active.activationId
    });
    expect(reopened.installedEntries).toEqual([{
      name: activeFixture.manifestSha256,
      kind: "directory"
    }]);
    expect(reopened.shaObservations.instances).toBeGreaterThan(MEMBER_NAMES.length * 2);
    expect(reopened.shaObservations.updates).toBeGreaterThan(reopened.shaObservations.instances);
    expect(reopened.shaObservations.maximumUpdateBytes).toBeLessThan(
      Math.min(...activeFixture.manifest.members.slice(0, 4).map(
        (member) => member.byteLength
      ))
    );

    await expect.poll(() => {
      const request = peer.requests.find((candidate) =>
        candidate.fixtureLabel === cancelledFixture.label);
      return Boolean(request && request.closed);
    }).toBe(true);

    const activePeerRequests = peer.requests.filter(
      (request) => request.fixtureLabel === activeFixture.label
    );
    expect(activePeerRequests.map((request) => request.fileName)).toEqual(MEMBER_NAMES);
    for (const [index, request] of activePeerRequests.entries()) {
      const member = activeFixture.manifest.members[index];
      expect(request).toMatchObject({
        method: "GET",
        path: memberRoute(activeFixture, member.fileName),
        host: `127.0.0.1:${peer.port}`,
        origin: applicationOrigin,
        referer: null,
        cookie: null,
        completed: true,
        closedEarly: false,
        bytesWritten: member.byteLength
      });
      expect(request.writeSizes.length).toBeGreaterThan(1);
      expect(Math.max(...request.writeSizes)).toBeLessThanOrEqual(SERVER_CHUNK_BYTES);
      expect(request.responseHeaders).toEqual({
        "Access-Control-Allow-Origin": applicationOrigin,
        "Access-Control-Expose-Headers": EXPOSED_HEADERS,
        "Cache-Control": "no-store",
        "Content-Length": String(member.byteLength),
        "Content-Type": "application/octet-stream",
        "X-TinyRustLM-Composition-Id": activeFixture.compositionId,
        "X-TinyRustLM-Piece-Set-Id": pieceSetSha256(activeFixture, "selected"),
        "X-TinyRustLM-Member-Name": member.fileName,
        "X-TinyRustLM-Member-Id": `sha256:${member.sha256}`
      });
    }

    const cancelledPeerRequests = peer.requests.filter(
      (request) => request.fixtureLabel === cancelledFixture.label
    );
    expect(cancelledPeerRequests).toHaveLength(1);
    expect(cancelledPeerRequests[0]).toMatchObject({
      method: "GET",
      path: memberRoute(cancelledFixture, "model.slm2"),
      host: `127.0.0.1:${peer.port}`,
      origin: applicationOrigin,
      referer: null,
      cookie: null,
      fileName: "model.slm2",
      closedEarly: true
    });
    expect(cancelledPeerRequests[0].bytesWritten)
      .toBeLessThan(cancelledFixture.manifest.members[0].byteLength);
    expect(peer.requests.every((request) => request.fixtureLabel !== null)).toBe(true);
    expect(peer.requests.every((request) => request.method === "GET")).toBe(true);
    expect(peer.requests.some((request) => request.host === `localhost:${peer.port}`)).toBe(false);

    const browserMemberRequests = browserRequests.filter((request) =>
      new URL(request.url).pathname.startsWith(`${ROUTE_PREFIX}/compositions/`)
    );
    expect(browserMemberRequests).toHaveLength(MEMBER_NAMES.length + 1);
    expect(browserMemberRequests.every((request) => request.method === "GET")).toBe(true);
    expect(browserMemberRequests.every((request) =>
      new URL(request.url).origin === `http://127.0.0.1:${peer.port}`
    )).toBe(true);
    expect(browserMemberRequests.filter((request) =>
      new URL(request.url).origin === applicationOrigin
    )).toEqual([]);
    expect([...new Set(browserRequests.map((request) => new URL(request.url).origin))].sort())
      .toEqual([applicationOrigin, `http://127.0.0.1:${peer.port}`].sort());
  } finally {
    if (context !== null) await context.close();
    if (peer !== null) await peer.close();
    removeOwnedBrowserProfile(profileRoot);
  }
});
