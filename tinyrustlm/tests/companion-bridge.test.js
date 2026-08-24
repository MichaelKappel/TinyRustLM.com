"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const bridge = require("../app/companion-bridge.js");

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

test("companion controls are wired through the exact DOM element identities", () => {
  const appSource = fs.readFileSync(
    path.join(__dirname, "..", "app", "app.js"),
    "utf8"
  );
  const shellSource = fs.readFileSync(
    path.join(__dirname, "..", "app", "index.html"),
    "utf8"
  );
  assert.match(
    appSource,
    /el\.companionPairingCode\.addEventListener\("keydown"/
  );
  assert.match(
    appSource,
    /el\.companionCancelImportButton\.addEventListener\("click"/
  );
  assert.doesNotMatch(appSource, /el\.companionPairingCodeInput/);
  assert.doesNotMatch(appSource, /el\.companionCancelButton/);
  assert.match(shellSource, /id="companionSharingConsent"/);
  assert.match(shellSource, /id="companionSharingControls"/);
  assert.match(shellSource, /id="companionSharingAdmitButton"/);
  assert.match(appSource, /requestedScopes\.push\("sharing_manage"\)/);
  assert.match(appSource, /companion\.client\.admitImportForSharing/);
});

test("client accepts only an exact credential-free IPv4 loopback endpoint", () => {
  assert.equal(
    new bridge.CompanionBridgeClient().endpoint,
    "http://127.0.0.1:43127/"
  );
  assert.throws(
    () => new bridge.CompanionBridgeClient({ endpoint: "http://localhost:43127/" }),
    /IPv4 loopback/
  );
  assert.throws(
    () => new bridge.CompanionBridgeClient({ endpoint: "https://example.com/" }),
    /IPv4 loopback/
  );
  assert.throws(
    () => new bridge.CompanionBridgeClient({ endpoint: "http://user:secret@127.0.0.1:43127/" }),
    /credentials/
  );
  assert.throws(
    () => new bridge.CompanionBridgeClient({ endpoint: "http://127.0.0.1:43127/?token=x" }),
    /query/
  );
});

test("pairing capability stays in memory and never enters cross-tab state messages", async () => {
  const calls = [];
  const channel = {
    messages: [],
    postMessage(value) { this.messages.push(value); },
    close() {}
  };
  const responses = [
    jsonResponse({ service: "tinyrustlm-companion-bridge" }),
    jsonResponse({
      capability: "volatile-super-secret-capability",
      origin: "https://tinyrustlm.com",
      scopes: ["status", "models_read"],
      expires_utc: "2099-07-13T20:00:00Z"
    }),
    jsonResponse({ state: "ready", native_abi_version: 2, model_count: 0 })
  ];
  const client = new bridge.CompanionBridgeClient({
    channel,
    fetch: async (url, options) => {
      calls.push({ url, options });
      return responses.shift();
    }
  });

  await client.detect();
  assert.equal(calls[0].options.headers[bridge.CAPABILITY_HEADER], undefined);
  assert.equal(calls[0].options.headers["X-TinyRustLM-Bridge-Version"], undefined);
  await client.pair("one-time-code", ["status", "models_read"]);
  assert.equal(client.isPaired, true);
  await client.status();
  assert.equal(
    calls[2].options.headers[bridge.CAPABILITY_HEADER],
    "volatile-super-secret-capability"
  );
  assert.doesNotMatch(JSON.stringify(client), /volatile-super-secret-capability/);
  assert.doesNotMatch(JSON.stringify(channel.messages), /volatile-super-secret-capability/);
  assert.deepEqual(
    channel.messages.map((message) => message.state),
    ["detected", "paired", "ready"]
  );
  assert.deepEqual(
    [...new Set(channel.messages.map((message) => message.kind))],
    ["tinyrustlm.companion_state"]
  );
});

test("near-expiry capability rotates in memory before the next operation", async () => {
  const calls = [];
  const channel = {
    messages: [],
    postMessage(value) { this.messages.push(value); },
    close() {}
  };
  const client = new bridge.CompanionBridgeClient({
    channel,
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith("/pair")) {
        return jsonResponse({
          capability: "near-expiry-capability",
          origin: "https://tinyrustlm.com",
          scopes: ["status"],
          expires_utc: new Date(Date.now() + 30_000).toISOString()
        });
      }
      if (url.endsWith("/session/rotate")) {
        assert.equal(
          options.headers[bridge.CAPABILITY_HEADER],
          "near-expiry-capability"
        );
        return jsonResponse({
          capability: "rotated-capability",
          origin: "https://tinyrustlm.com",
          scopes: ["status"],
          expires_utc: new Date(Date.now() + 15 * 60_000).toISOString()
        });
      }
      assert.equal(options.headers[bridge.CAPABILITY_HEADER], "rotated-capability");
      return jsonResponse({ state: "ready", native_abi_version: 2, model_count: 0 });
    }
  });

  await client.pair("pair-code", ["status"]);
  await client.status();

  assert.deepEqual(
    calls.map((call) => new URL(call.url).pathname),
    ["/pair", "/session/rotate", "/status"]
  );
  assert.doesNotMatch(JSON.stringify(client), /rotated-capability/);
  assert.doesNotMatch(JSON.stringify(channel.messages), /rotated-capability/);
  assert.equal(channel.messages.at(-1).state, "ready");
});

test("companion restart clears the volatile session without hiding detection", async () => {
  let call = 0;
  const client = new bridge.CompanionBridgeClient({
    fetch: async () => {
      call += 1;
      if (call === 1) {
        return jsonResponse({
          capability: "pre-restart-capability",
          origin: "https://tinyrustlm.com",
          scopes: ["status"],
          expires_utc: "2099-07-13T20:00:00Z"
        });
      }
      return jsonResponse({
        service: "tinyrustlm-companion-bridge",
        pairing_state: "unpaired"
      });
    }
  });

  await client.pair("pair-code", ["status"]);
  assert.equal(client.isPaired, true);
  const health = await client.detect();
  assert.equal(health.pairing_state, "unpaired");
  assert.equal(client.isPaired, false);
});

test("imports use unique mutation identities and fixed canonical routes", async () => {
  const calls = [];
  const client = new bridge.CompanionBridgeClient({
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith("/pair")) {
        return jsonResponse({
          capability: "capability",
          origin: "https://tinyrustlm.com",
          scopes: bridge.DEFAULT_SCOPES,
          expires_utc: "2099-07-13T20:00:00Z"
        });
      }
      return jsonResponse({
        operation_id: "import-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        state: "queued"
      }, 202);
    }
  });
  await client.pair("pair-code");
  assert.equal(
    JSON.parse(calls[0].options.body).requested_scopes.includes("sharing_manage"),
    false
  );
  await client.startImport("manifest", ["{\"peer\":1}"]);
  await client.startImport("manifest", ["{\"peer\":1}"]);

  const mutations = calls.filter((call) => call.url.endsWith("/imports"));
  assert.equal(mutations.length, 2);
  assert.notEqual(
    mutations[0].options.headers[bridge.REQUEST_ID_HEADER],
    mutations[1].options.headers[bridge.REQUEST_ID_HEADER]
  );
  assert.equal(mutations[0].options.method, "POST");
  assert.equal(mutations[0].options.credentials, "omit");
  assert.equal(
    JSON.parse(mutations[0].options.body).peer_import_requests[0],
    "{\"peer\":1}"
  );
});

test("conversion stays on loopback and uses fixed canonical lifecycle routes", async () => {
  const calls = [];
  const operationId = `conversion-${"b".repeat(64)}`;
  const client = new bridge.CompanionBridgeClient({
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith("/pair")) {
        return jsonResponse({
          capability: "capability",
          origin: "https://tinyrustlm.com",
          scopes: bridge.DEFAULT_SCOPES,
          expires_utc: "2099-07-13T20:00:00Z"
        });
      }
      return jsonResponse({ operation_id: operationId, state: "queued" }, 202);
    }
  });
  await client.pair("pair-code");
  const request = "{\n  \"request_kind\": \"minimodel.huggingface_conversion_request.v1\"\n}\n";
  await client.startConversion(request);
  await client.getConversion(operationId);
  await client.cancelConversion(operationId);

  assert.deepEqual(calls.slice(1).map((call) => new URL(call.url).pathname), [
    "/conversions",
    `/conversions/${operationId}`,
    `/conversions/${operationId}/cancel`
  ]);
  const body = JSON.parse(calls[1].options.body);
  assert.equal(body.conversion_request_text, request);
  assert.equal(body.review_accepted, true);
  assert.equal(calls[1].options.credentials, "omit");
  assert.ok(calls[1].options.headers[bridge.REQUEST_ID_HEADER]);
  assert.ok(calls[3].options.headers[bridge.REQUEST_ID_HEADER]);
});

test("imports accept bounded multiline UTF-8 documents but reject unsafe controls", async () => {
  const calls = [];
  const client = new bridge.CompanionBridgeClient({
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith("/pair")) {
        return jsonResponse({
          capability: "capability",
          origin: "https://tinyrustlm.com",
          scopes: bridge.DEFAULT_SCOPES,
          expires_utc: "2099-07-13T20:00:00Z"
        });
      }
      return jsonResponse({
        operation_id: "import-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        state: "queued"
      }, 202);
    }
  });
  await client.pair("pair-code");
  const manifest = "manifest.version=0\r\nmodel.id=tinyrustlm/test\n\tartifact.kind=slm\n";
  const request = "{\n  \"request_kind\": \"minimodel.peer_import_request.v0\"\n}\n";
  await client.startImport(manifest, [request]);
  const body = JSON.parse(calls.at(-1).options.body);
  assert.equal(body.manifest_text, manifest);
  assert.equal(body.peer_import_requests[0], request);
  await assert.rejects(
    client.startImport("manifest.version=0\u0000model.id=bad", [request]),
    /MiniModel manifest is invalid/
  );
});

test("large import envelopes are bounded before loopback transport", async () => {
  const calls = [];
  const client = new bridge.CompanionBridgeClient({
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith("/pair")) {
        return jsonResponse({
          capability: "capability",
          origin: "https://tinyrustlm.com",
          scopes: bridge.DEFAULT_SCOPES,
          expires_utc: "2099-07-13T20:00:00Z"
        });
      }
      return jsonResponse({
        operation_id: "import-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        state: "queued"
      }, 202);
    }
  });
  await client.pair("pair-code");

  const representativeManifest = "m".repeat(136737);
  const representativePeerRequest = "p".repeat(8192);
  await client.startImport(
    representativeManifest,
    [representativePeerRequest, representativePeerRequest]
  );
  const requestBytes = Buffer.byteLength(calls.at(-1).options.body, "utf8");
  assert.ok(requestBytes > 64 * 1024);
  assert.ok(requestBytes < bridge.MAXIMUM_REQUEST_JSON_BYTES);

  const fetchCount = calls.length;
  await assert.rejects(
    client.startImport("\\".repeat(4 * 1024 * 1024), ["p"]),
    (error) => error && error.code === "bridge_request_too_large"
  );
  assert.equal(calls.length, fetchCount);
});

test("sharing requires an explicit scope and uses only closed fleet routes", async () => {
  const calls = [];
  const scopes = [...bridge.DEFAULT_SCOPES, "sharing_manage"];
  const status = {
    sharing_enabled: true,
    initialized: true,
    fleet_id: "browser-seed-fleet",
    target_model_count: 20,
    admitted_model_count: 1,
    remaining_model_capacity: 19,
    replica_lane_count: 2,
    advertisement_status: "not-advertised",
    models: [{
      operation_id: "import-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      model_id: "example/model",
      enabled: false,
      announcement_state: "external-proof-required"
    }]
  };
  const client = new bridge.CompanionBridgeClient({
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith("/pair")) {
        return jsonResponse({
          capability: "sharing-capability",
          origin: "https://tinyrustlm.com",
          scopes,
          expires_utc: "2099-07-13T20:00:00Z"
        });
      }
      if (url.endsWith("/sharing") && options.method === "GET") {
        return jsonResponse({
          sharing_enabled: true,
          initialized: false,
          target_model_count: 20,
          admitted_model_count: 0,
          remaining_model_capacity: 20,
          replica_lane_count: 2,
          advertisement_status: "not-initialized",
          models: []
        });
      }
      return jsonResponse(status);
    }
  });

  assert.equal(client.hasScope("sharing_manage"), false);
  await client.pair("pair-code", scopes);
  assert.equal(client.hasScope("sharing_manage"), true);
  await client.getSharing();
  await client.initializeSharing("browser-seed-fleet");
  await client.admitImportForSharing(
    "import-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    [
      { laneId: "seed-a", bindAddress: "0.0.0.0:18123", publicBaseUrl: "http://peer.example:18123/model/" },
      { laneId: "seed-b", bindAddress: "0.0.0.0:18124", publicBaseUrl: "http://peer.example:18124/model/" }
    ]
  );
  await client.setImportSharingEnabled(
    "import-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    true
  );
  await client.setImportSharingEnabled(
    "import-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    false
  );
  await client.removeImportFromSharing(
    "import-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  );

  assert.deepEqual(
    calls.map((call) => new URL(call.url).pathname),
    [
      "/pair",
      "/sharing",
      "/sharing/initialize",
      "/sharing/imports/import-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/admit",
      "/sharing/imports/import-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/enable",
      "/sharing/imports/import-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/disable",
      "/sharing/imports/import-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/remove"
    ]
  );
  const mutations = calls.slice(2);
  assert.equal(new Set(mutations.map((call) =>
    call.options.headers[bridge.REQUEST_ID_HEADER])).size, mutations.length);
  assert.deepEqual(JSON.parse(calls[3].options.body).lane_endpoints, [
    { lane_id: "seed-a", bind_address: "0.0.0.0:18123", public_base_url: "http://peer.example:18123/model/" },
    { lane_id: "seed-b", bind_address: "0.0.0.0:18124", public_base_url: "http://peer.example:18124/model/" }
  ]);
  assert.doesNotMatch(JSON.stringify(status), /manifest_path|piece_dir|state_path|public_base_url/);
});

test("model streaming enforces receipt identity headers and exact byte count", async () => {
  const bytes = new Uint8Array([0x53, 0x4c, 0x4d, 0x32, 1, 2, 3, 4]);
  const client = new bridge.CompanionBridgeClient({
    fetch: async (url) => {
      if (url.endsWith("/pair")) {
        return jsonResponse({
          capability: "capability",
          origin: "https://tinyrustlm.com",
          scopes: bridge.DEFAULT_SCOPES,
          expires_utc: "2099-07-13T20:00:00Z"
        });
      }
      return new Response(bytes, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": String(bytes.length),
          "X-TinyRustLM-Model-Id": "example/model",
          "X-TinyRustLM-Artifact-Sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        }
      });
    }
  });
  await client.pair("pair-code");
  const received = [];
  const result = await client.streamModel(
    "import-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    {
      expectedByteCount: bytes.length,
      expectedArtifactSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      onChunk(chunk, offset) {
        received.push({ chunk: Array.from(chunk), offset });
      }
    }
  );
  assert.equal(result.byteCount, bytes.length);
  assert.equal(result.modelId, "example/model");
  assert.deepEqual(received.flatMap((value) => value.chunk), Array.from(bytes));

  let truncatedCall = 0;
  const truncated = new bridge.CompanionBridgeClient({
    fetch: async () => {
      truncatedCall += 1;
      if (truncatedCall === 1) {
        return jsonResponse({
          capability: "capability",
          origin: "https://tinyrustlm.com",
          scopes: bridge.DEFAULT_SCOPES,
          expires_utc: "2099-07-13T20:00:00Z"
        });
      }
      return new Response(bytes.slice(0, 4), {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": "4",
          "X-TinyRustLM-Model-Id": "example/model",
          "X-TinyRustLM-Artifact-Sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        }
      });
    }
  });
  await truncated.pair("pair-code");
  await assert.rejects(
    () => truncated.streamModel(
      "import-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      {
        expectedByteCount: bytes.length,
        expectedArtifactSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        onChunk() {}
      }
    ),
    /byte count/
  );
});

test("model streaming uses a bounded large-transfer deadline instead of the control deadline", () => {
  assert.equal(
    bridge.modelStreamTimeoutMilliseconds(8 * 1024),
    bridge.MINIMUM_MODEL_STREAM_TIMEOUT_MILLISECONDS
  );
  const productionModelDeadline = bridge.modelStreamTimeoutMilliseconds(969648576);
  assert.ok(productionModelDeadline > 15 * 60 * 1000);
  assert.ok(productionModelDeadline <= bridge.MAXIMUM_MODEL_STREAM_TIMEOUT_MILLISECONDS);
  assert.equal(
    bridge.modelStreamTimeoutMilliseconds(bridge.MAXIMUM_MODEL_STREAM_BYTES),
    17 * 60 * 1000 + 34 * 1000
  );
  assert.throws(
    () => bridge.modelStreamTimeoutMilliseconds(bridge.MAXIMUM_MODEL_STREAM_BYTES + 1),
    /byte count/
  );
});

test("composition streaming enforces its receipt identity and conversion operation", async () => {
  const bytes = new Uint8Array([0x41, 0x43, 0x47, 0x31, 5, 6, 7, 8]);
  const digest = "c".repeat(64);
  const operationId = `conversion-${"d".repeat(64)}`;
  const client = new bridge.CompanionBridgeClient({
    fetch: async (url) => {
      if (url.endsWith("/pair")) {
        return jsonResponse({
          capability: "capability",
          origin: "https://tinyrustlm.com",
          scopes: bridge.DEFAULT_SCOPES,
          expires_utc: "2099-07-13T20:00:00Z"
        });
      }
      assert.ok(url.endsWith(`/models/${operationId}/composition`));
      return new Response(bytes, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": String(bytes.length),
          "X-TinyRustLM-Composition-Sha256": digest
        }
      });
    }
  });
  await client.pair("pair-code");
  const received = new Uint8Array(bytes.length);
  const result = await client.streamComposition(operationId, {
    expectedByteCount: bytes.length,
    expectedSha256: digest,
    onChunk(chunk, offset) { received.set(chunk, offset); }
  });
  assert.equal(result.sha256, digest);
  assert.deepEqual(received, bytes);
});
