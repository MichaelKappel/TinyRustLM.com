"use strict";

const assert = require("node:assert/strict");
const nodeCrypto = require("node:crypto");
const test = require("node:test");

const catalogApi = require("../app/minimodel-catalog-v1.js");
const p2pInstallApi = require("../app/p2p-composition-install.js");

test("canonical strings preserve Unicode scalar pairs, keys and normalization", () => {
  for (const value of ["plain", "e\u0301", "\u00e9", "\ud7ff", "\ue000", "\ufffd",
    "\u{10000}", "\u{1f680}", "\u{1f469}\u200d\u{1f4bb}", "\u{20000}", "\u{10ffff}", "x\ufeffy"]) {
    const input = { [value]: [value, { text: value }] };
    const text = JSON.stringify(input) + "\n";
    assert.equal(JSON.stringify(catalogApi.parseCanonicalJsonText(text)) + "\n", text);
    const parser = catalogApi.createCanonicalJsonStreamParser();
    for (const byte of Buffer.from(text)) parser.push(Uint8Array.of(byte));
    const result = parser.finish();
    assert.equal(result.text, text);
    assert.equal(result.byteLength, Buffer.byteLength(text));
    assert.equal(JSON.stringify(result.value) + "\n", text);
  }
});

test("canonical strings reject lone surrogates and escaped alternate spellings", () => {
  for (const value of ["\ud800", "\udbff", "\udc00", "\udfff", "\ud800x", "\ud800\ud800", "\udc00\ud800"]) {
    for (const text of [JSON.stringify({ value }) + "\n", '{"value":"' + value + '"}\n',
      JSON.stringify({ [value]: 1 }) + "\n"]) {
      assert.throws(() => catalogApi.parseCanonicalJsonText(text), error => error.code === "json");
    }
    assert.throws(() => catalogApi.validateCatalog(validCatalog([validEntry({ displayName: value })])));
  }
  for (const text of ['{"x":"\\ud83d\\ude80"}\n', '{"x":"\\u0061"}\n', '{"x":"\\/"}\n']) {
    assert.throws(() => catalogApi.parseCanonicalJsonText(text), error => error.code === "json-canonical");
  }
  assert.throws(() => catalogApi.parseCanonicalJsonText('{"\u{1f680}":1,"\u{1f680}":2}\n'),
    error => error.code === "json-duplicate-key");
});

test("canonical streams reject leading BOM bytes across every split", () => {
  const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('{}\n')]);
  for (let split = 1; split < bytes.length; split++) {
    const parser = catalogApi.createCanonicalJsonStreamParser();
    parser.push(bytes.subarray(0, split));
    parser.push(bytes.subarray(split));
    assert.throws(() => parser.finish(), error => error.code === "json");
  }
  for (const invalid of [[0xf0, 0x9f, 0x9a], [0xed, 0xa0, 0x80], [0xf4, 0x90, 0x80, 0x80]]) {
    assert.throws(() => {
      const parser = catalogApi.createCanonicalJsonStreamParser();
      for (const byte of invalid) parser.push(Uint8Array.of(byte));
      parser.finish();
    }, error => error.code === "json");
  }
});

test("supplementary Unicode retains code-unit string limits", () => {
  const text = "\u{1f680}".repeat(128 * 1024);
  assert.equal(catalogApi.parseCanonicalJsonText(JSON.stringify(text) + "\n"), text);
  assert.throws(() => catalogApi.parseCanonicalJsonText(JSON.stringify(text + "\u{1f680}") + "\n"), /string exceeded/);
  assert.throws(() => catalogApi.parseCanonicalJsonText('"\ud800\n'), /surrogate pair/);
  assert.doesNotThrow(() => catalogApi.validateCatalog(validCatalog([validEntry({ displayName: "\u{1f680}".repeat(80) })])));
  assert.throws(() => catalogApi.validateCatalog(validCatalog([validEntry({ displayName: "\u{1f680}".repeat(81) })])));
});

const CANONICAL_MEMBER_NAMES = Object.freeze([
  "model.slm2",
  "tokenizer.tokenizer2",
  "template.template2",
  "sampling.sampling2",
  "prompt.prompt2",
  "composition.acg2"
]);

function sha(character) {
  return `sha256:${character.repeat(64)}`;
}

const TEST_NOW = new Date(Math.floor(Date.now() / 1000) * 1000);
const utc = (offsetMilliseconds) =>
  new Date(TEST_NOW.getTime() + offsetMilliseconds).toISOString().replace(".000Z", "Z");
const PEER_KEY_PAIR = nodeCrypto.generateKeyPairSync("ed25519");
const PEER_PUBLIC_KEY = PEER_KEY_PAIR.publicKey
  .export({ type: "spki", format: "der" })
  .subarray(-32)
  .toString("base64url");
const PEER_KEY_ID = sha("9");

function canonicalMemberFixture() {
  return CANONICAL_MEMBER_NAMES.map((name, index) => ({
    name,
    bytes: index + 1,
    sha256: sha(String(index + 1)),
    schema: `tinyrustlm.member.${index + 1}.v1`
  }));
}

function shuffledMemberFixture() {
  const members = canonicalMemberFixture();
  [members[1], members[2]] = [members[2], members[1]];
  return members;
}

function validEntry(options = {}) {
  const suffix = options.suffix || "qwen3-0.6b";
  const compositionCharacter = options.compositionCharacter || "c";
  return {
    entry_id: `qwen/${suffix}`,
    display_name: options.displayName || "Qwen3 0.6B",
    description: "One exact qualified six-member SLM2 composition.",
    source: {
      repository: options.repository || "Qwen/Qwen3-0.6B",
      revision: options.revision || "a".repeat(40),
      source_lock_sha256: sha("b")
    },
    license: {
      route: `/licenses/${suffix}.txt`,
      review_status: "reviewed"
    },
    composition: {
      composition_id: sha(compositionCharacter),
      member_count: 6,
      members: options.members || canonicalMemberFixture()
    },
    browser_admission: {
      route: options.admissionRoute ||
        `/catalog/browser-admissions/${suffix}.browser-composition-admission.json`,
      bytes: options.admissionBytes ?? 4096,
      sha256: options.admissionSha256 || sha("f")
    },
    profiles: {
      conversion: "tinyrustlm.converter.v1",
      quantization: "tinyrustlm.mixed-q8.v1",
      runtime: "tinyrustlm.browser.v1"
    },
    qualification: {
      status: "qualified",
      receipt_id: sha("d"),
      receipt_route: `/catalog/qualification-receipts/${suffix}.json`,
      receipt_bytes: 4096,
      receipt_sha256: sha("d"),
      numerical_status: "passed",
      browser_status: "passed",
      quality_status: "qualified"
    },
    peer_announcement_ids: options.peerIds || []
  };
}

function validCatalog(entries = []) {
  return {
    schema: catalogApi.CATALOG_SCHEMA,
    catalog_id: "minimodel.org/prelaunch",
    revision: 1,
    generated_at_utc: utc(-60_000),
    valid_until_utc: utc(60 * 60_000),
    project_server_serves_model_bytes: false,
    project_server_proxies_model_bytes: false,
    project_server_runs_inference: false,
    qualification_policy: "exact-current-evidence-required",
    qualification_receipt_schema: catalogApi.QUALIFICATION_RECEIPT_SCHEMA,
    browser_admission_schema: catalogApi.BROWSER_ADMISSION_SCHEMA,
    peer_verification_keys: [{
      key_id: PEER_KEY_ID,
      algorithm: "Ed25519",
      public_key_base64url: PEER_PUBLIC_KEY,
      not_before_utc: utc(-60 * 60_000),
      not_after_utc: utc(2 * 60 * 60_000)
    }],
    revoked_qualification_receipt_ids: [],
    supersessions: [],
    entries
  };
}

function validPeerFeed(announcements = []) {
  return {
    schema: catalogApi.PEER_SCHEMA,
    feed_id: "minimodel.org/prelaunch-peers",
    revision: 1,
    generated_at_utc: utc(-60_000),
    valid_until_utc: utc(60 * 60_000),
    project_server_serves_model_bytes: false,
    project_server_proxies_model_bytes: false,
    announcements
  };
}

function validAnnouncement(options = {}) {
  const announcement = {
    announcement_id: options.id || "peer/qwen3/lane-1",
    composition_id: options.compositionId || sha("c"),
    piece_set_sha256: options.pieceSetSha256 || sha("e"),
    peer_base_url: options.peerBaseUrl || "https://8.8.8.8/",
    protocol_profile: catalogApi.DIRECT_COMPOSITION_PROTOCOL_PROFILE,
    consent_status: "explicit",
    consent_receipt_sha256: sha("6"),
    outside_proof_status: "current-passed",
    outside_proof_receipt_sha256: sha("7"),
    issued_at_utc: utc(-60_000),
    expires_utc: options.expiresUtc || utc(30 * 60_000),
    verification_key_id: PEER_KEY_ID,
    signature: Buffer.alloc(64).toString("base64url")
  };
  announcement.signature = nodeCrypto.sign(
    null,
    Buffer.from(catalogApi.peerAnnouncementSigningBytes(announcement)),
    PEER_KEY_PAIR.privateKey
  ).toString("base64url");
  return announcement;
}

function jsonResponse(value, options = {}) {
  const text = typeof value === "string" ? value : `${JSON.stringify(value)}\n`;
  const bytes = new TextEncoder().encode(text);
  const status = options.status === undefined ? 200 : options.status;
  const contentLength = options.contentLength === undefined
    ? null
    : String(options.contentLength);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return name.toLowerCase() === "content-length" ? contentLength : null;
      }
    },
    body: {
      getReader() {
        let consumed = false;
        return {
          async read() {
            if (consumed) return { done: true, value: undefined };
            consumed = true;
            return { done: false, value: bytes.slice() };
          },
          cancel() {
            consumed = true;
            return Promise.resolve();
          }
        };
      }
    },
    text: async () => text
  };
}

test("accepts the truthful empty current catalog and peer feed", () => {
  const catalog = validCatalog();
  const peers = validPeerFeed();
  const catalogSnapshot = catalogApi.validateCatalog(catalog);
  const peerSnapshot = catalogApi.validatePeerFeedDocument(peers);
  assert.deepEqual(catalogSnapshot, catalog);
  assert.deepEqual(peerSnapshot, peers);
  assert.notEqual(catalogSnapshot, catalog);
  assert.notEqual(peerSnapshot, peers);
  assert.ok(Object.isFrozen(catalogSnapshot));
  assert.ok(Object.isFrozen(catalogSnapshot.entries));
  assert.ok(Object.isFrozen(peerSnapshot));
  assert.ok(Object.isFrozen(peerSnapshot.announcements));
  assert.deepEqual(catalogApi.validatePeerFeed(peers, catalog), []);
  assert.deepEqual(catalogApi.buildCatalogView(catalog, peers), []);
});

test("projects qualified entries without treating signed announcements as reachable peers", async () => {
  const peerEntry = validEntry({ peerIds: ["peer/qwen3/lane-1"] });
  const localEntry = validEntry({
    suffix: "qwen3-0.6b-local",
    displayName: "A local conversion",
    repository: "Qwen/Qwen3-0.6B-local",
    compositionCharacter: "f"
  });
  const catalog = validCatalog([localEntry, peerEntry]);
  const peers = validPeerFeed([validAnnouncement()]);
  const views = await catalogApi.buildVerifiedCatalogView(catalog, peers, {
    now: TEST_NOW,
    crypto: nodeCrypto.webcrypto
  });
  assert.equal(views[0].entryId, peerEntry.entry_id);
  assert.equal(views[0].availability, "peer");
  assert.equal(
    views[0].availabilityLabel,
    "Qualified composition; 1 current signed peer announcement listed; reachability not proven"
  );
  assert.equal(views[0].peerCount, 1);
  assert.equal(views[0].peers[0].signatureVerified, true);
  assert.equal(views[0].peers[0].feedValidUntilUtc, peers.valid_until_utc);
  assert.deepEqual(Object.keys(views[0].peers[0]), [
    "announcementId",
    "compositionId",
    "pieceSetSha256",
    "peerBaseUrl",
    "protocolProfile",
    "consentStatus",
    "consentReceiptSha256",
    "outsideProofStatus",
    "outsideProofReceiptSha256",
    "issuedAtUtc",
    "expiresUtc",
    "verificationKeyId",
    "verificationPublicKey",
    "signature",
    "signatureVerified",
    "feedId",
    "feedRevision",
    "feedGeneratedAtUtc",
    "feedValidUntilUtc"
  ]);
  assert.equal(views[1].availability, "local-conversion");
  assert.equal(views[1].availabilityLabel, "Local conversion");
  assert.equal(views[1].peerCount, 0);
  assert.equal(views[0].composition.members.length, 6);
  assert.deepEqual(views[0].browserAdmission, {
    schema: catalogApi.BROWSER_ADMISSION_SCHEMA,
    route: peerEntry.browser_admission.route,
    bytes: peerEntry.browser_admission.bytes,
    sha256: peerEntry.browser_admission.sha256
  });
  assert.ok(Object.isFrozen(views[0].browserAdmission));
});

test("catalog pass and peer validation failure preserves local conversion choices", async () => {
  const entry = validEntry({ peerIds: ["peer/qwen3/lane-1"] });
  const invalidAnnouncement = validAnnouncement();
  invalidAnnouncement.outside_proof_status = "stale";
  const requested = [];
  const fetch = async (url) => {
    requested.push(url);
    return url === catalogApi.CATALOG_URL
      ? jsonResponse(validCatalog([entry]))
      : jsonResponse(validPeerFeed([invalidAnnouncement]));
  };

  const result = await catalogApi.loadCurrentCatalog({
    fetch,
    now: TEST_NOW,
    crypto: nodeCrypto.webcrypto
  });

  assert.deepEqual(requested.sort(), [
    catalogApi.CATALOG_URL,
    catalogApi.PEER_FEED_URL
  ].sort());
  assert.equal(result.catalog.type, catalogApi.SOURCE_TYPES.CATALOG);
  assert.equal(result.catalog.status, catalogApi.SOURCE_STATUSES.VALID);
  assert.equal(result.catalog.error, null);
  assert.equal(result.peerFeed.type, catalogApi.SOURCE_TYPES.PEER_FEED);
  assert.equal(result.peerFeed.status, catalogApi.SOURCE_STATUSES.INVALID);
  assert.equal(result.peerFeed.error.type, "validation");
  assert.equal(result.peerFeed.error.code, "peer-proof");
  assert.equal(result.views.length, 1);
  assert.equal(result.views[0].entryId, entry.entry_id);
  assert.equal(result.views[0].availability, "local-conversion");
  assert.equal(result.views[0].peerCount, 0);
});

test("peer binding failure also degrades a valid catalog to local conversion", async () => {
  const entry = validEntry({ peerIds: ["peer/qwen3/lane-1"] });
  const fetch = async (url) => url === catalogApi.CATALOG_URL
    ? jsonResponse(validCatalog([entry]))
    : jsonResponse(validPeerFeed());

  const result = await catalogApi.loadCurrentCatalog({ fetch });

  assert.equal(result.catalog.status, catalogApi.SOURCE_STATUSES.VALID);
  assert.equal(result.peerFeed.status, catalogApi.SOURCE_STATUSES.INVALID);
  assert.equal(result.peerFeed.error.type, "binding");
  assert.equal(result.peerFeed.error.code, "peer-closure");
  assert.equal(result.views.length, 1);
  assert.equal(result.views[0].availability, "local-conversion");
});

test("catalog validation failure does not suppress a valid peer source status", async () => {
  const invalidEntry = validEntry({ peerIds: ["peer/qwen3/lane-1"] });
  invalidEntry.qualification.quality_status = "unreviewed";
  const fetch = async (url) => url === catalogApi.CATALOG_URL
    ? jsonResponse(validCatalog([invalidEntry]))
    : jsonResponse(validPeerFeed([validAnnouncement()]));

  const result = await catalogApi.loadCurrentCatalog({
    fetch,
    now: TEST_NOW,
    crypto: nodeCrypto.webcrypto
  });

  assert.equal(result.catalog.status, catalogApi.SOURCE_STATUSES.INVALID);
  assert.equal(result.catalog.error.type, "validation");
  assert.equal(result.catalog.error.code, "qualification");
  assert.equal(result.catalog.document, null);
  assert.equal(result.peerFeed.status, catalogApi.SOURCE_STATUSES.VALID);
  assert.equal(result.peerFeed.error, null);
  assert.equal(result.peerFeed.document.announcements.length, 1);
  assert.deepEqual(result.views, []);
});

test("requires exact catalog and six-member fields", () => {
  assert.throws(
    () => catalogApi.validateCatalog({ ...validCatalog(), legacy_alias: true }),
    /unknown or missing field/u
  );

  const missingMember = validEntry();
  missingMember.composition.members.pop();
  missingMember.composition.member_count = 5;
  assert.throws(
    () => catalogApi.validateCatalog(validCatalog([missingMember])),
    /exactly six members/u
  );

  const duplicateMember = validEntry();
  duplicateMember.composition.members[5].name = duplicateMember.composition.members[0].name;
  assert.throws(
    () => catalogApi.validateCatalog(validCatalog([duplicateMember])),
    /member set is not closed/u
  );
});

test("requires the canonical P2P six-member wire order before projection", () => {
  assert.deepEqual(catalogApi.MEMBER_NAMES, CANONICAL_MEMBER_NAMES);
  assert.deepEqual(catalogApi.MEMBER_NAMES, p2pInstallApi.memberNames);

  const canonicalEntry = validEntry({ members: canonicalMemberFixture() });
  const canonicalCatalog = validCatalog([canonicalEntry]);
  const admitted = catalogApi.validateCatalog(canonicalCatalog);
  const projected = catalogApi.buildCatalogView(canonicalCatalog, validPeerFeed());

  assert.deepEqual(
    admitted.entries[0].composition.members.map((member) => member.name),
    CANONICAL_MEMBER_NAMES
  );
  assert.deepEqual(
    projected[0].composition.members.map((member) => member.name),
    CANONICAL_MEMBER_NAMES
  );

  const shuffledCatalog = validCatalog([
    validEntry({ members: shuffledMemberFixture() })
  ]);
  const rejectsShuffledWireOrder = (error) => {
    assert.ok(error instanceof catalogApi.MiniModelCatalogError);
    assert.equal(error.code, "member-order");
    assert.match(error.message, /canonical P2P six-member wire order/u);
    return true;
  };

  assert.throws(
    () => catalogApi.validateCatalog(shuffledCatalog),
    rejectsShuffledWireOrder
  );
  assert.throws(
    () => catalogApi.buildCatalogView(shuffledCatalog, validPeerFeed()),
    rejectsShuffledWireOrder
  );
});

test("requires a safe exact browser admission descriptor with current schema identity", () => {
  const missing = validEntry();
  delete missing.browser_admission;
  assert.throws(
    () => catalogApi.validateCatalog(validCatalog([missing])),
    /unknown or missing field/u
  );

  for (const route of [
    "https://minimodel.org/catalog/admission.json",
    "//other.example/admission.json",
    "/catalog/../admission.json"
  ]) {
    const unsafe = validEntry({ admissionRoute: route });
    assert.throws(
      () => catalogApi.validateCatalog(validCatalog([unsafe])),
      /safe same-origin route/u
    );
  }

  const oversized = validEntry({
    admissionBytes: catalogApi.MAXIMUM_BROWSER_ADMISSION_BYTES + 1
  });
  assert.throws(
    () => catalogApi.validateCatalog(validCatalog([oversized])),
    /positive bounded safe integer/u
  );

  const unprefixed = validEntry({ admissionSha256: "f".repeat(64) });
  assert.throws(
    () => catalogApi.validateCatalog(validCatalog([unprefixed])),
    /prefixed SHA-256/u
  );

  const unknown = validEntry();
  unknown.browser_admission.media_type = "application/json";
  assert.throws(
    () => catalogApi.validateCatalog(validCatalog([unknown])),
    /unknown or missing field/u
  );

  const driftedSchema = validCatalog([validEntry()]);
  driftedSchema.browser_admission_schema = "tinyrustlm.browser-composition-admission/2";
  assert.throws(
    () => catalogApi.validateCatalog(driftedSchema),
    /browser admission schema is unsupported/u
  );
});

test("rejects incomplete qualification and noncanonical digests", () => {
  const unqualified = validEntry();
  unqualified.qualification.browser_status = "untested";
  assert.throws(
    () => catalogApi.validateCatalog(validCatalog([unqualified])),
    /qualification is incomplete/u
  );

  const upperDigest = validEntry();
  upperDigest.composition.composition_id = sha("a").toUpperCase();
  assert.throws(
    () => catalogApi.validateCatalog(validCatalog([upperDigest])),
    /lower-case prefixed SHA-256/u
  );
});

test("requires exact catalog-to-peer closure", () => {
  const entry = validEntry({ peerIds: ["peer/qwen3/lane-1"] });
  const catalog = validCatalog([entry]);
  assert.throws(
    () => catalogApi.validatePeerFeed(validPeerFeed(), catalog, {
      now: TEST_NOW
    }),
    /identities are not closed/u
  );

  const undeclaredCatalog = validCatalog([validEntry()]);
  assert.throws(
    () => catalogApi.validatePeerFeed(
      validPeerFeed([validAnnouncement()]),
      undeclaredCatalog,
      { now: TEST_NOW }
    ),
    /not declared/u
  );
});

test("rejects expired, project-hosted, and credential-bearing peers", () => {
  const entry = validEntry({ peerIds: ["peer/qwen3/lane-1"] });
  const catalog = validCatalog([entry]);
  for (const [announcement, pattern] of [
    [validAnnouncement({ expiresUtc: "2026-08-29T00:00:00Z" }), /expired/u],
    [validAnnouncement({ peerBaseUrl: "https://cdn.minimodel.org/" }), /project and service/u],
    [validAnnouncement({ peerBaseUrl: "https://user:secret@peer.direct-model.net/" }), /encoded or unsafe/u],
    [{ ...validAnnouncement(), protocol_profile: "minimodel.direct-piece.v1" }, /unsupported/u]
  ]) {
    assert.throws(
      () => catalogApi.validatePeerFeed(validPeerFeed([announcement]), catalog, {
        now: TEST_NOW
      }),
      pattern
    );
  }
});

test("both valid sources produce P2P views with body-free no-store requests", async () => {
  const entry = validEntry({ peerIds: ["peer/qwen3/lane-1"] });
  const requests = [];
  const fetch = async (url, options) => {
    requests.push({ url, options });
    const body = url.includes("peer-announcements")
      ? validPeerFeed([validAnnouncement()])
      : validCatalog([entry]);
    return jsonResponse(body);
  };
  const result = await catalogApi.loadCurrentCatalog({
    fetch,
    now: TEST_NOW,
    crypto: nodeCrypto.webcrypto
  });

  assert.equal(result.catalog.status, catalogApi.SOURCE_STATUSES.VALID);
  assert.equal(result.peerFeed.status, catalogApi.SOURCE_STATUSES.VALID);
  assert.equal(result.views.length, 1);
  assert.equal(result.views[0].availability, "peer");
  assert.equal(result.views[0].peerCount, 1);
  assert.deepEqual(requests.map((request) => request.url), [
    catalogApi.CATALOG_URL,
    catalogApi.PEER_FEED_URL
  ]);
  for (const request of requests) {
    assert.equal(request.options.method, "GET");
    assert.equal(request.options.cache, "no-store");
    assert.equal(request.options.credentials, "omit");
    assert.equal(request.options.redirect, "error");
    assert.equal(request.options.referrerPolicy, "no-referrer");
    assert.equal(Object.hasOwn(request.options, "body"), false);
    assert.ok(request.options.signal instanceof AbortSignal);
  }
  assert.notEqual(requests[0].options, requests[1].options);
  assert.notEqual(requests[0].options.signal, requests[1].options.signal);
});

test("a peer cannot become selectable until its detached Ed25519 signature verifies", async () => {
  const entry = validEntry({ peerIds: ["peer/qwen3/lane-1"] });
  const announcement = validAnnouncement();
  announcement.signature = `${announcement.signature[0] === "A" ? "B" : "A"}${
    announcement.signature.slice(1)
  }`;
  assert.throws(
    () => catalogApi.buildCatalogView(
      validCatalog([entry]),
      validPeerFeed([announcement]),
      { now: TEST_NOW }
    ),
    (error) => error && error.code === "peer-signature-required"
  );
  const result = await catalogApi.loadCurrentCatalog({
    now: TEST_NOW,
    crypto: nodeCrypto.webcrypto,
    fetch: async (url) => url === catalogApi.CATALOG_URL
      ? jsonResponse(validCatalog([entry]))
      : jsonResponse(validPeerFeed([announcement]))
  });
  assert.equal(result.catalog.status, catalogApi.SOURCE_STATUSES.VALID);
  assert.equal(result.peerFeed.status, catalogApi.SOURCE_STATUSES.INVALID);
  assert.equal(result.peerFeed.error.type, "signature");
  assert.equal(result.peerFeed.error.code, "peer-signature");
  assert.equal(result.views[0].availability, "local-conversion");
  assert.equal(result.views[0].peerCount, 0);
});

test("peer timeout is isolated and leaves the current catalog locally available", async () => {
  const entry = validEntry({ peerIds: ["peer/qwen3/lane-1"] });
  let peerSignal = null;
  const fetch = (url, options) => {
    if (url === catalogApi.CATALOG_URL) {
      return Promise.resolve(jsonResponse(validCatalog([entry])));
    }
    peerSignal = options.signal;
    return new Promise(() => {});
  };

  const result = await catalogApi.loadCurrentCatalog({
    fetch,
    timeoutMilliseconds: 20,
    now: TEST_NOW
  });

  assert.equal(result.catalog.status, catalogApi.SOURCE_STATUSES.VALID);
  assert.equal(result.peerFeed.status, catalogApi.SOURCE_STATUSES.INVALID);
  assert.equal(result.peerFeed.error.type, "fetch");
  assert.equal(result.peerFeed.error.code, "timeout");
  assert.equal(result.views.length, 1);
  assert.equal(result.views[0].availability, "local-conversion");
  assert.equal(peerSignal.aborted, true);
});

test("declared and streamed oversized responses fail their source closed", async (t) => {
  const entry = validEntry({ peerIds: ["peer/qwen3/lane-1"] });

  await t.test("declared length", async () => {
    let bodyRead = false;
    const fetch = async (url) => {
      if (url === catalogApi.CATALOG_URL) {
        return jsonResponse(validCatalog([entry]));
      }
      const response = jsonResponse(validPeerFeed(), {
        contentLength: catalogApi.MAXIMUM_METADATA_BYTES + 1
      });
      response.text = async () => {
        bodyRead = true;
        return "";
      };
      return response;
    };
    const result = await catalogApi.loadCurrentCatalog({ fetch });
    assert.equal(result.peerFeed.status, catalogApi.SOURCE_STATUSES.INVALID);
    assert.equal(result.peerFeed.error.code, "metadata-size");
    assert.equal(result.views[0].availability, "local-conversion");
    assert.equal(bodyRead, false);
  });

  await t.test("streamed length", async () => {
    let canceled = false;
    const chunks = [
      new Uint8Array(catalogApi.MAXIMUM_METADATA_BYTES),
      new Uint8Array(1)
    ];
    const fetch = async (url) => {
      if (url === catalogApi.CATALOG_URL) {
        return jsonResponse(validCatalog([entry]));
      }
      let index = 0;
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        body: {
          getReader() {
            return {
              read: async () => index < chunks.length
                ? { done: false, value: chunks[index++] }
                : { done: true, value: undefined },
              cancel() {
                canceled = true;
                return Promise.resolve();
              }
            };
          }
        }
      };
    };
    const result = await catalogApi.loadCurrentCatalog({ fetch });
    assert.equal(result.peerFeed.status, catalogApi.SOURCE_STATUSES.INVALID);
    assert.equal(result.peerFeed.error.code, "metadata-size");
    assert.equal(result.views[0].availability, "local-conversion");
    assert.equal(canceled, true);
  });
});

test("orders P2P entries and peers deterministically before local entries", async () => {
  const peerAlpha = validEntry({
    suffix: "a-peer",
    displayName: "Alpha",
    repository: "Models/APeer",
    compositionCharacter: "a",
    peerIds: ["peer/alpha/lane"]
  });
  const peerZulu = validEntry({
    suffix: "z-peer",
    displayName: "Zulu",
    repository: "Models/ZPeer",
    compositionCharacter: "b",
    peerIds: ["peer/zulu/lane-z", "peer/zulu/lane-a"]
  });
  const localAlphaOne = validEntry({
    suffix: "a-local-1",
    displayName: "Alpha",
    repository: "Models/ALocalOne",
    compositionCharacter: "c"
  });
  const localAlphaTwo = validEntry({
    suffix: "a-local-2",
    displayName: "Alpha",
    repository: "Models/ALocalTwo",
    compositionCharacter: "d"
  });
  const localZulu = validEntry({
    suffix: "z-local",
    displayName: "Zulu",
    repository: "Models/ZLocal",
    compositionCharacter: "e"
  });
  const entries = [localZulu, peerZulu, localAlphaTwo, peerAlpha, localAlphaOne];
  const announcements = [
    validAnnouncement({
      id: "peer/zulu/lane-z",
      compositionId: sha("b"),
      peerBaseUrl: "https://9.9.9.9/"
    }),
    validAnnouncement({
      id: "peer/alpha/lane",
      compositionId: sha("a"),
      peerBaseUrl: "https://8.8.4.4/"
    }),
    validAnnouncement({
      id: "peer/zulu/lane-a",
      compositionId: sha("b"),
      peerBaseUrl: "https://1.1.1.1/"
    })
  ];
  const options = { now: TEST_NOW, crypto: nodeCrypto.webcrypto };
  const forward = await catalogApi.buildVerifiedCatalogView(
    validCatalog(entries),
    validPeerFeed(announcements),
    options
  );
  const reversed = await catalogApi.buildVerifiedCatalogView(
    validCatalog([...entries].reverse()),
    validPeerFeed([...announcements].reverse()),
    options
  );

  assert.deepEqual(forward, reversed);
  assert.deepEqual(forward.map((entry) => entry.entryId), [
    "qwen/a-peer",
    "qwen/z-peer",
    "qwen/a-local-1",
    "qwen/a-local-2",
    "qwen/z-local"
  ]);
  assert.deepEqual(forward.map((entry) => entry.availability), [
    "peer",
    "peer",
    "local-conversion",
    "local-conversion",
    "local-conversion"
  ]);
  assert.deepEqual(forward[1].peers.map((peer) => peer.peerBaseUrl), [
    "https://1.1.1.1/",
    "https://9.9.9.9/"
  ]);
  assert.equal(
    forward[1].availabilityLabel,
    "Qualified composition; 2 current signed peer announcements listed; reachability not proven"
  );
});

test("successive loads return fresh owned snapshots without stale reuse", async () => {
  let displayName = "First catalog";
  const fetch = async (url) => {
    if (url === catalogApi.CATALOG_URL) {
      return jsonResponse(validCatalog([validEntry({ displayName })]));
    }
    return jsonResponse(validPeerFeed());
  };

  const first = await catalogApi.loadCurrentCatalog({ fetch });
  displayName = "Second catalog";
  const second = await catalogApi.loadCurrentCatalog({ fetch });

  assert.equal(first.views[0].displayName, "First catalog");
  assert.equal(second.views[0].displayName, "Second catalog");
  assert.notEqual(first.catalog, second.catalog);
  assert.notEqual(first.catalog.document, second.catalog.document);
  assert.notEqual(first.views[0], second.views[0]);
  assert.ok(Object.isFrozen(first.catalog.document.entries[0]));
  assert.ok(Object.isFrozen(first.catalog.document.entries[0].browser_admission));
  assert.ok(Object.isFrozen(first.views[0].browserAdmission));
  assert.ok(Object.isFrozen(first.views));
  assert.throws(() => {
    first.catalog.document.entries[0].display_name = "mutated";
  }, TypeError);
});
