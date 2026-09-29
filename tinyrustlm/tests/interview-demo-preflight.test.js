"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const catalogApi = require("../app/minimodel-catalog-v1.js");
const preflight = require("../tools/interview-demo-preflight.js");
const scratch = require("../tools/canonical-operation-scratch.js");

// All synthetic inputs stay within one marked canonical operation and retain ownership.
function ownedFixture(context) {
  const owned = scratch.createOwnedTemporaryDirectory({
    temporaryParent: path.resolve(__dirname, "../../artifacts/tests/preflight-fixtures")
  });
  context.after(() => scratch.removeOwnedTemporaryDirectory(owned));
  return owned.rootPath;
}

function sha(character) {
  return `sha256:${character.repeat(64)}`;
}

const TEST_NOW = new Date(Math.floor(Date.now() / 1000) * 1000);
const utc = (offsetMilliseconds) =>
  new Date(TEST_NOW.getTime() + offsetMilliseconds).toISOString().replace(".000Z", "Z");
const PEER_KEY_ID = sha("9");
const PEER_PUBLIC_KEY = Buffer.alloc(32, 9).toString("base64url");

function qualifiedEntry(options = {}) {
  const peerIds = options.peerIds || [];
  return {
    entry_id: "qwen/qwen3-0.6b-interview",
    display_name: "Qwen3 0.6B interview model",
    description: "One strictly qualified six-member composition.",
    source: {
      repository: "Qwen/Qwen3-0.6B",
      revision: "a".repeat(40),
      source_lock_sha256: sha("b")
    },
    license: {
      route: "/licenses/qwen3-0.6b.txt",
      review_status: "reviewed"
    },
    composition: {
      composition_id: sha("c"),
      member_count: 6,
      members: catalogApi.MEMBER_NAMES.map((name, index) => ({
        name,
        bytes: index + 1,
        sha256: sha(String(index + 1)),
        schema: `tinyrustlm.member.${index + 1}.v1`
      }))
    },
    browser_admission: {
      route: "/catalog/browser-admissions/qwen3-interview.json",
      bytes: 4096,
      sha256: sha("f")
    },
    profiles: {
      conversion: "tinyrustlm.converter.v1",
      quantization: "tinyrustlm.mixed-q8.v1",
      runtime: "tinyrustlm.browser.v1"
    },
    qualification: {
      status: "qualified",
      receipt_id: sha("d"),
      receipt_route: "/catalog/qualification-receipts/qwen3-interview.json",
      receipt_bytes: 4096,
      receipt_sha256: sha("d"),
      numerical_status: "passed",
      browser_status: "passed",
      quality_status: "qualified"
    },
    peer_announcement_ids: peerIds
  };
}

function catalog(entries) {
  return {
    schema: catalogApi.CATALOG_SCHEMA,
    catalog_id: "minimodel.org/interview-current",
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

function announcement(options = {}) {
  return {
    announcement_id: "peer/qwen3/interview-1",
    composition_id: sha("c"),
    piece_set_sha256: sha("e"),
    peer_base_url: options.peerBaseUrl ||
      "https://8.8.8.8/",
    protocol_profile: catalogApi.DIRECT_COMPOSITION_PROTOCOL_PROFILE,
    consent_status: "explicit",
    consent_receipt_sha256: sha("6"),
    outside_proof_status: options.outsideProofStatus || "current-passed",
    outside_proof_receipt_sha256: Object.hasOwn(options, "outsideProofReceiptSha256")
      ? options.outsideProofReceiptSha256 : sha("7"),
    issued_at_utc: utc(-60_000),
    expires_utc: options.expiresUtc || utc(30 * 60_000),
    verification_key_id: PEER_KEY_ID,
    signature: Buffer.alloc(64, 7).toString("base64url")
  };
}

function peerFeed(announcements) {
  return {
    schema: catalogApi.PEER_SCHEMA,
    feed_id: "minimodel.org/interview-peers",
    revision: 1,
    generated_at_utc: utc(-60_000),
    valid_until_utc: utc(60 * 60_000),
    project_server_serves_model_bytes: false,
    project_server_proxies_model_bytes: false,
    announcements
  };
}

function loaded(catalogDocument, peerFeedDocument, signaturesVerified = true) {
  const views = catalogDocument.entries.map((entry) => {
    const peers = peerFeedDocument.announcements
      .filter((item) =>
        entry.peer_announcement_ids.includes(item.announcement_id) &&
        item.composition_id === entry.composition.composition_id)
      .map((item) => ({
        announcementId: item.announcement_id,
        compositionId: item.composition_id,
        pieceSetSha256: item.piece_set_sha256,
        peerBaseUrl: item.peer_base_url,
        protocolProfile: item.protocol_profile,
        consentStatus: item.consent_status,
        consentReceiptSha256: item.consent_receipt_sha256,
        outsideProofStatus: item.outside_proof_status,
        outsideProofReceiptSha256: item.outside_proof_receipt_sha256,
        issuedAtUtc: item.issued_at_utc,
        expiresUtc: item.expires_utc,
        verificationKeyId: item.verification_key_id,
        signature: item.signature,
        signatureVerified: signaturesVerified,
        feedId: peerFeedDocument.feed_id,
        feedRevision: peerFeedDocument.revision,
        feedGeneratedAtUtc: peerFeedDocument.generated_at_utc
      }));
    return {
      entryId: entry.entry_id,
      composition: { compositionId: entry.composition.composition_id },
      peers
    };
  });
  return {
    catalog: {
      type: catalogApi.SOURCE_TYPES.CATALOG,
      status: catalogApi.SOURCE_STATUSES.VALID,
      document: catalogDocument,
      error: null
    },
    peerFeed: {
      type: catalogApi.SOURCE_TYPES.PEER_FEED,
      status: catalogApi.SOURCE_STATUSES.VALID,
      document: peerFeedDocument,
      error: null
    },
    views
  };
}

function readyCatalog() {
  const peerId = "peer/qwen3/interview-1";
  return loaded(
    catalog([qualifiedEntry({ peerIds: [peerId] })]),
    peerFeed([announcement()])
  );
}

function passingDependencies(overrides = {}) {
  return {
    verifyCanonicalSource: async () => true,
    verifyStaticShell: () => true,
    verifyDeploymentClosure: () => true,
    verifyBrowserModules: () => true,
    verifyCompanionModules: () => true,
    verifyNoStaleBridge: () => true,
    loadCurrentCatalog: async () => readyCatalog(),
    verifyCompanionHost: () => true,
    ...overrides
  };
}

function codes(report) {
  return report.checks
    .filter((check) => check.status === "fail")
    .map((check) => check.code);
}

function capture() {
  let text = "";
  return {
    stream: { write: (chunk) => { text += chunk; } },
    read: () => text
  };
}

// Creates one schema-shaped manifest with exactly one obsolete-bridge retirement.
function bridgeRetirementManifest() {
  return {
    schema: "tinyrustlm.web_deployment_manifest.v2",
    publicOrigin: "https://tinyrustlm.com",
    deploymentScope: "browser-runtime-no-model-bytes",
    releaseLedger: "release/site-release-ledger.v1.json",
    publish: [{ source: "source", local: "app/app.js", remote: "app/app.js" }],
    retire: [
      { remote: "app/companion-bridge.js" },
      { remote: "app/other-retired-file.js" }
    ]
  };
}

// Materializes the exact shell, package, and deployment files read by the bridge check.
function createBridgeRetirementFixture(context, manifest = bridgeRetirementManifest()) {
  const root = ownedFixture(context);
  for (const relativePath of [
    "app/index.html",
    "companion/index.html",
    "index.html",
    "package.json",
    "updates/index.html"
  ]) {
    const filePath = path.join(root, ...relativePath.split("/"));
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "current shell without retired bridge\n", "utf8");
  }
  const manifestPath = path.join(root, "deploy", "web-deployment-manifest.v2.json");
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, typeof manifest === "string"
    ? manifest
    : `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { root, manifestPath };
}

test("accepts exactly the two explicit CLI modes", () => {
  assert.equal(preflight.parseArguments(["--ui"]), preflight.MODES.UI);
  assert.equal(
    preflight.parseArguments(["--live-model"]),
    preflight.MODES.LIVE_MODEL
  );
  for (const argumentsList of [[], ["--json"], ["--ui", "--live-model"]]) {
    assert.throws(
      () => preflight.parseArguments(argumentsList),
      (error) => error.code === preflight.FAILURE_CODES.ARGUMENTS_INVALID
    );
  }
});

test("UI mode is independently useful and never invokes live-model checks", async () => {
  let liveCalls = 0;
  const report = await preflight.runPreflight({
    mode: preflight.MODES.UI,
    dependencies: passingDependencies({
      loadCurrentCatalog: async () => {
        liveCalls += 1;
        throw new Error("live catalog should not run");
      },
      verifyCompanionHost: () => {
        liveCalls += 1;
        return false;
      }
    })
  });

  assert.equal(report.ready, true, JSON.stringify(report));
  assert.equal(report.status, "ready");
  assert.equal(report.mode, "ui");
  assert.equal(report.checks.length, 6);
  assert.equal(report.live, undefined);
  assert.equal(liveCalls, 0);
});

test("UI failures after source admission use stable codes and hide underlying paths", async () => {
  const report = await preflight.runPreflight({
    mode: preflight.MODES.UI,
    dependencies: passingDependencies({
      verifyStaticShell: () => {
        throw new Error("E:\\private-source\\operator-name\\workspace");
      },
      verifyDeploymentClosure: () => false,
      verifyNoStaleBridge: () => false
    })
  });

  assert.equal(report.ready, false);
  assert.deepEqual(codes(report), [
    preflight.FAILURE_CODES.STATIC_SHELL,
    preflight.FAILURE_CODES.DEPLOYMENT_CLOSURE,
    preflight.FAILURE_CODES.STALE_BRIDGE
  ]);
  const publicOutput = JSON.stringify(report) + preflight.renderHumanSummary(report);
  assert.doesNotMatch(publicOutput, /private-source|operator-name|[A-Za-z]:\\/u);
});

test("stale bridge check accepts one exact retirement and the current site", (context) => {
  const fixture = createBridgeRetirementFixture(context);
  assert.equal(preflight.hasNoStaleBridgePath(fixture.root), true);
  assert.equal(preflight.hasNoStaleBridgePath(path.resolve(__dirname, "..")), true);
});

test("stale bridge check rejects every physical entry and active surface reference", async (context) => {
  await context.test("empty physical file", (subtest) => {
    const fixture = createBridgeRetirementFixture(subtest);
    fs.writeFileSync(path.join(fixture.root, "app", "companion-bridge.js"), "");
    assert.equal(preflight.hasNoStaleBridgePath(fixture.root), false);
  });
  await context.test("physical directory", (subtest) => {
    const fixture = createBridgeRetirementFixture(subtest);
    fs.mkdirSync(path.join(fixture.root, "app", "companion-bridge.js"));
    assert.equal(preflight.hasNoStaleBridgePath(fixture.root), false);
  });
  for (const relativePath of [
    "app/index.html",
    "companion/index.html",
    "index.html",
    "package.json",
    "updates/index.html"
  ]) {
    await context.test(`active reference in ${relativePath}`, (subtest) => {
      const fixture = createBridgeRetirementFixture(subtest);
      fs.writeFileSync(
        path.join(fixture.root, ...relativePath.split("/")),
        "./Companion-Bridge.js\n",
        "utf8"
      );
      assert.equal(preflight.hasNoStaleBridgePath(fixture.root), false);
    });
  }
});

test("stale bridge retirement manifest is exact, strict, and bounded", async (context) => {
  const mutations = [
    ["missing retirement", (manifest) => {
      manifest.retire = manifest.retire.filter((entry) =>
        entry.remote !== "app/companion-bridge.js");
    }],
    ["duplicate retirement", (manifest) => {
      manifest.retire.push({ remote: "app/companion-bridge.js" });
    }],
    ["wrong retirement key", (manifest) => {
      manifest.retire[0] = { path: "app/companion-bridge.js" };
    }],
    ["extra retirement key", (manifest) => {
      manifest.retire[0].reason = "obsolete";
    }],
    ["publish and retire overlap", (manifest) => {
      manifest.publish.push({
        source: "source",
        local: "app/companion-bridge.js",
        remote: "app/companion-bridge.js"
      });
    }],
    ["publish alias", (manifest) => {
      manifest.publish[0].local = "app\\companion-bridge.js";
    }],
    ["noncanonical retirement case", (manifest) => {
      manifest.retire[0].remote = "app/Companion-Bridge.js";
    }],
    ["extra stale reference", (manifest) => {
      manifest.note = "retired companion-bridge.js";
    }],
    ["missing publish array", (manifest) => {
      delete manifest.publish;
    }]
  ];
  for (const [name, mutate] of mutations) {
    await context.test(name, (subtest) => {
      const manifest = bridgeRetirementManifest();
      mutate(manifest);
      const fixture = createBridgeRetirementFixture(subtest, manifest);
      assert.equal(preflight.hasNoStaleBridgePath(fixture.root), false);
    });
  }

  await context.test("duplicate JSON key", (subtest) => {
    const fixture = createBridgeRetirementFixture(
      subtest,
      '{"publish":[],"retire":[],"retire":[{"remote":"app/companion-bridge.js"}]}'
    );
    assert.equal(preflight.hasNoStaleBridgePath(fixture.root), false);
  });
  await context.test("malformed JSON", (subtest) => {
    const fixture = createBridgeRetirementFixture(subtest, "{\"publish\":[");
    assert.equal(preflight.hasNoStaleBridgePath(fixture.root), false);
  });
  await context.test("oversized manifest", (subtest) => {
    const fixture = createBridgeRetirementFixture(subtest);
    fs.writeFileSync(fixture.manifestPath, Buffer.alloc(1024 * 1024 + 1, 0x20));
    assert.equal(preflight.hasNoStaleBridgePath(fixture.root), false);
  });
});

test("a current external announcement never proves live peer reachability", async () => {
  assert.deepEqual(
    preflight.evaluateLiveCatalog(
      readyCatalog(),
      TEST_NOW
    ),
    {
      catalogAvailable: true,
      peerFeedAvailable: true,
      qualifiedEntryCount: 1,
      announcedExternalPeerCount: 1
    }
  );
  const report = await preflight.runPreflight({
    mode: preflight.MODES.LIVE_MODEL,
    now: TEST_NOW.toISOString(),
    dependencies: passingDependencies()
  });

  assert.equal(report.ready, false, JSON.stringify(report));
  assert.equal(report.checks.length, 9);
  assert.deepEqual(report.live, {
    qualifiedCatalogEntryCount: 1,
    announcedExternalPeerCount: 1,
    provenReachableExternalPeerCount: 0,
    companionHostOutputAvailable: true
  });
  assert.deepEqual(codes(report), [preflight.FAILURE_CODES.EXTERNAL_PEER]);
  assert.equal(
    report.checks.find((check) =>
      check.id === "external-direct-peer-reachability").status,
    "fail"
  );
  const summary = preflight.renderHumanSummary(report);
  assert.match(summary, /live model preflight: BLOCKED/u);
  assert.match(summary, /announced external direct peers: 1/u);
  assert.match(summary, /proven reachable external direct peers: 0/u);
});

test("truthful empty catalog and feeds never count as live readiness", async () => {
  const report = await preflight.runPreflight({
    mode: preflight.MODES.LIVE_MODEL,
    dependencies: passingDependencies({
      loadCurrentCatalog: async () => loaded(catalog([]), peerFeed([]))
    })
  });

  assert.equal(report.ready, false);
  assert.deepEqual(codes(report), [
    preflight.FAILURE_CODES.CATALOG_EMPTY,
    preflight.FAILURE_CODES.EXTERNAL_PEER
  ]);
  assert.equal(report.live.qualifiedCatalogEntryCount, 0);
  assert.equal(report.live.announcedExternalPeerCount, 0);
  assert.equal(report.live.provenReachableExternalPeerCount, 0);
});

test("a qualified local-conversion entry does not invent a live peer", async () => {
  const report = await preflight.runPreflight({
    mode: preflight.MODES.LIVE_MODEL,
    dependencies: passingDependencies({
      loadCurrentCatalog: async () => loaded(
        catalog([qualifiedEntry()]),
        peerFeed([])
      )
    })
  });

  assert.equal(report.checks.find((check) =>
    check.id === "qualified-catalog").status, "pass");
  assert.deepEqual(codes(report), [preflight.FAILURE_CODES.EXTERNAL_PEER]);
});

test("loopback, private, and reserved hosts cannot qualify as external peers", async () => {
  for (const url of [
    "http://127.0.0.1:43127/",
    "http://localhost:43127/",
    "https://10.10.0.5/models/",
    "https://192.168.1.20/models/",
    "http://[::1]:43127/",
    "https://peer.example.net/models/",
    "https://peer.interview-demo.net/"
  ]) {
    assert.equal(preflight.isPublicDirectPeerUrl(url), false, url);
  }
  assert.equal(
    preflight.isPublicDirectPeerUrl("https://8.8.8.8/"),
    true
  );

  const peerId = "peer/qwen3/interview-1";
  const report = await preflight.runPreflight({
    mode: preflight.MODES.LIVE_MODEL,
    dependencies: passingDependencies({
      loadCurrentCatalog: async () => loaded(
        catalog([qualifiedEntry({ peerIds: [peerId] })]),
        peerFeed([announcement({ peerBaseUrl: "http://127.0.0.1:43127/" })])
      )
    })
  });
  assert.equal(report.live.announcedExternalPeerCount, 0);
  assert.equal(report.live.provenReachableExternalPeerCount, 0);
  assert.ok(report.failureCodes.includes(preflight.FAILURE_CODES.EXTERNAL_PEER));
});

test("operator seed discovery requires its exact origin and explicit null-proof disposition", async () => {
  for (const [peerBaseUrl, status, digest, expectedCount] of [
    ["https://minimodel.org/", "not-required-operator-seed", null, 1],
    ["https://minimodel.org/", "current-passed", sha("7"), 0],
    ["https://minimodel.org/", "not-required-operator-seed", sha("7"), 0],
    ["https://8.8.8.8/", "not-required-operator-seed", null, 0]
  ]) {
    const item = announcement({ peerBaseUrl, outsideProofStatus: status, outsideProofReceiptSha256: digest });
    const report = await preflight.runPreflight({
      mode: preflight.MODES.LIVE_MODEL, now: TEST_NOW.toISOString(),
      dependencies: passingDependencies({ loadCurrentCatalog: async () => loaded(
        catalog([qualifiedEntry({ peerIds: [item.announcement_id] })]), peerFeed([item])
      ) })
    });
    assert.equal(report.live.announcedExternalPeerCount, expectedCount);
    assert.equal(report.live.provenReachableExternalPeerCount, 0);
  }
});

test("expired or non-current outside proof cannot qualify a peer", async (t) => {
  const peerId = "peer/qwen3/interview-1";
  for (const [name, hostileAnnouncement] of [
    ["expired", announcement({ expiresUtc: utc(-1_000) })],
    ["stale proof", announcement({ outsideProofStatus: "stale" })]
  ]) {
    await t.test(name, async () => {
      const report = await preflight.runPreflight({
        mode: preflight.MODES.LIVE_MODEL,
        now: TEST_NOW.toISOString(),
        dependencies: passingDependencies({
          loadCurrentCatalog: async () => loaded(
            catalog([qualifiedEntry({ peerIds: [peerId] })]),
            peerFeed([hostileAnnouncement])
          )
        })
      });
      assert.equal(report.live.announcedExternalPeerCount, 0);
      assert.equal(report.live.provenReachableExternalPeerCount, 0);
      assert.ok(report.failureCodes.includes(preflight.FAILURE_CODES.EXTERNAL_PEER));
    });
  }
});

test("companion host output is an independent live-model requirement", async () => {
  const report = await preflight.runPreflight({
    mode: preflight.MODES.LIVE_MODEL,
    dependencies: passingDependencies({ verifyCompanionHost: () => false })
  });
  assert.deepEqual(codes(report), [
    preflight.FAILURE_CODES.EXTERNAL_PEER,
    preflight.FAILURE_CODES.COMPANION_HOST
  ]);
  assert.equal(report.live.companionHostOutputAvailable, false);
});

test("dependency timeouts are bounded and map to deterministic codes", async () => {
  const started = Date.now();
  const report = await preflight.runPreflight({
    mode: preflight.MODES.UI,
    timeouts: { checkMilliseconds: 20, catalogMilliseconds: 20 },
    dependencies: passingDependencies({
      verifyCanonicalSource: () => new Promise(() => {})
    })
  });
  assert.ok(Date.now() - started < 1000);
  assert.deepEqual(codes(report), [preflight.FAILURE_CODES.SOURCE_AUTHORITY]);
});

test("a stalled live catalog maps to the catalog timeout code", async () => {
  const started = Date.now();
  const report = await preflight.runPreflight({
    mode: preflight.MODES.LIVE_MODEL,
    timeouts: { checkMilliseconds: 20, catalogMilliseconds: 20 },
    dependencies: passingDependencies({
      loadCurrentCatalog: () => new Promise(() => {})
    })
  });
  assert.ok(Date.now() - started < 1000);
  assert.deepEqual(codes(report), [
    preflight.FAILURE_CODES.CATALOG_TIMEOUT,
    preflight.FAILURE_CODES.EXTERNAL_PEER
  ]);
});

test("host output scan requires the complete canonical build-output set", (context) => {
  const root = ownedFixture(context);
  const output = path.join(
    root,
    "dotnet",
    "tools",
    "TinyRustLM.CompanionHost",
    "bin",
    "Debug",
    "net8.0"
  );
  fs.mkdirSync(output, { recursive: true });
  for (const name of [
    "TinyRustLM.CompanionHost.deps.json",
    "TinyRustLM.CompanionHost.dll",
    "TinyRustLM.CompanionHost.runtimeconfig.json",
    "TinyRustLM.Companion.dll"
  ]) {
    fs.writeFileSync(path.join(output, name), "build-output\n", "utf8");
  }
  assert.equal(preflight.hasCompanionHostOutput(root), true);
  fs.truncateSync(path.join(output, "TinyRustLM.Companion.dll"), 0);
  assert.equal(preflight.hasCompanionHostOutput(root), false);
});

test("source admission precedes every other check and permits work only on success", async (context) => {
  for (const mode of Object.values(preflight.MODES)) {
    for (const admitted of [true, false]) {
      await context.test(`${mode}: ${admitted}`, async () => {
        let settle;
        const calls = [];
        const dependencies = passingDependencies();
        for (const [name, operation] of Object.entries(dependencies)) {
          dependencies[name] = (...args) => { calls.push(name); return operation(...args); };
        }
        dependencies.verifyCanonicalSource = () => new Promise((resolve) => { settle = resolve; });
        const pending = preflight.runPreflight({ mode, dependencies });
        await new Promise((resolve) => setImmediate(resolve));
        const premature = [...calls];
        settle(admitted);
        const report = await pending;
        assert.deepEqual(premature, [], "checks ran before source admission");
        if (admitted) {
          assert.ok(calls.includes("verifyDeploymentClosure"));
        } else {
          assert.deepEqual(calls, []);
          assert.deepEqual(report.failureCodes, [preflight.FAILURE_CODES.SOURCE_AUTHORITY]);
          assert.equal(report.checks.length, mode === preflight.MODES.UI ? 6 : 9);
          assert.ok(report.checks.slice(1).every((check) => check.status === "skipped"));
          assert.equal(report.ready, false);
        }
      });
    }
  }
});

test("a source timeout aborts admission without starting later checks", async () => {
  let observedSignal;
  let calls = 0;
  const report = await preflight.runPreflight({
    mode: preflight.MODES.LIVE_MODEL,
    timeouts: { checkMilliseconds: 10 },
    dependencies: Object.fromEntries(Object.keys(passingDependencies()).map((name) => [name,
      name === "verifyCanonicalSource" ? (context) => {
        observedSignal = context.signal;
        return new Promise(() => {});
      } : () => { calls += 1; return true; }
    ]))
  });
  assert.equal(observedSignal.aborted, true);
  assert.equal(calls, 0);
  assert.deepEqual(report.failureCodes, [preflight.FAILURE_CODES.SOURCE_AUTHORITY]);
});

test("default deployment closure uses and removes one owned canonical directory", async (context) => {
  const created = [];
  const create = fs.mkdtempSync;
  context.mock.method(fs, "mkdtempSync", (...args) => {
    const root = create(...args);
    created.push(root);
    return root;
  });
  const dependencies = passingDependencies();
  delete dependencies.verifyDeploymentClosure;
  const report = await preflight.runPreflight({ mode: preflight.MODES.UI, dependencies });
  assert.equal(report.ready, true);
  assert.equal(created.length, 1);
  assert.equal(path.dirname(created[0]),
    path.resolve(__dirname, "../../artifacts/verification/interview-preflight"));
  assert.equal(fs.existsSync(created[0]), false);
  assert.equal(fs.existsSync(created[0] + ".owner.v2"), false);
});

test("deployment read failures clean owned output before reporting failure", async (context) => {
  for (const relative of ["release/site-release-ledger.v1.json", "deploy/web-deployment-manifest.v2.json"]) {
    await context.test(relative, async (subtest) => {
      const created = [];
      const create = fs.mkdtempSync;
      const read = fs.readFileSync;
      const failPath = path.resolve(__dirname, "..", relative);
      subtest.mock.method(fs, "mkdtempSync", (...args) => {
        const root = create(...args); created.push(root); return root;
      });
      subtest.mock.method(fs, "readFileSync", (file, ...args) => {
        if (typeof file === "string" && path.resolve(file) === failPath) {
          throw new Error("injected read failure");
        }
        return read(file, ...args);
      });
      const dependencies = passingDependencies();
      delete dependencies.verifyDeploymentClosure;
      const report = await preflight.runPreflight({ mode: preflight.MODES.UI, dependencies });
      assert.deepEqual(report.failureCodes, [preflight.FAILURE_CODES.DEPLOYMENT_CLOSURE]);
      assert.equal(created.length, 1);
      assert.equal(fs.existsSync(created[0]), false);
      assert.equal(fs.existsSync(created[0] + ".owner.v2"), false);
    });
  }
});

test("default execution and materialization reject alternate roots before side effects", async (context) => {
  for (const changedRoot of ["siteRoot", "repositoryRoot"]) {
    for (const dependency of ["verifyCanonicalSource", "verifyDeploymentClosure"]) {
      await context.test(`${changedRoot}: ${dependency}`, async (subtest) => {
        let childCalls = 0;
        let directoryCalls = 0;
        subtest.mock.method(childProcess, "execFile", () => { childCalls += 1; throw new Error("unexpected child"); });
        subtest.mock.method(fs, "mkdtempSync", () => { directoryCalls += 1; throw new Error("unexpected write"); });
        const dependencies = passingDependencies();
        delete dependencies[dependency];
        const report = await preflight.runPreflight({ mode: preflight.MODES.UI,
          dependencies, [changedRoot]: path.resolve(__dirname, "alternate-root") });
        assert.deepEqual(report.failureCodes, [dependency === "verifyCanonicalSource"
          ? preflight.FAILURE_CODES.SOURCE_AUTHORITY : preflight.FAILURE_CODES.DEPLOYMENT_CLOSURE]);
        assert.equal(childCalls, 0);
        assert.equal(directoryCalls, 0);
      });
    }
  }
});

test("CLI keeps JSON on stdout and a public-safe human summary on stderr", async () => {
  const stdout = capture();
  const stderr = capture();
  const exitCode = await preflight.runCli({
    argv: ["--ui"],
    dependencies: passingDependencies(),
    stdout: stdout.stream,
    stderr: stderr.stream
  });
  const report = JSON.parse(stdout.read());
  assert.equal(exitCode, 0);
  assert.equal(report.ready, true);
  assert.match(stderr.read(), /interview UI preflight: READY/u);
  assert.doesNotMatch(stdout.read() + stderr.read(), /[A-Za-z]:\\|\/Users\//u);

  const invalidOut = capture();
  const invalidErr = capture();
  assert.equal(await preflight.runCli({
    argv: ["--fixture"],
    stdout: invalidOut.stream,
    stderr: invalidErr.stream
  }), 1);
  assert.deepEqual(
    JSON.parse(invalidOut.read()).failureCodes,
    [preflight.FAILURE_CODES.ARGUMENTS_INVALID]
  );
});
