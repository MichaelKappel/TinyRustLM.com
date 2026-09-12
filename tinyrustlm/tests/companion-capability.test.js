"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const capability = require("../app/companion-capability.js");

const encoder = new TextEncoder();
const installationId = "11".repeat(16);
const processInstanceId = "22".repeat(16);
const sessionId = "33".repeat(16);
const serverNonce = capability.encodeBase64Url(new Uint8Array(32).fill(0x44));
const secret = new Uint8Array(32).fill(0x55);
const pairingCode = `TRLC1:54321:${capability.encodeBase64Url(secret)}`;
const host = "127.0.0.1:54321";

function bytes(value) {
  return value instanceof Uint8Array ? value : encoder.encode(value);
}

function jsonBody(value) {
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(value));
}

function requestHeaders(options) {
  return new Headers(options.headers || {});
}

function response(body, status, headers = {}) {
  const value = bytes(body);
  return new Response(value, {
    status,
    headers: {
      "Content-Length": String(value.byteLength),
      "Content-Type": "application/json",
      ...headers
    }
  });
}

function hostileBodyResponse(honestResponse, options) {
  const headers = new Headers(honestResponse.headers);
  headers.set("Content-Length", String(options.declaredBytes));
  const chunks = (options.chunks || []).map(bytes);
  const state = {
    arrayBufferCalls: 0,
    cancelled: false,
    readCount: 0,
    released: false
  };
  let chunkIndex = 0;
  let resolveReadStarted;
  const readStarted = new Promise((resolve) => {
    resolveReadStarted = resolve;
  });
  const reader = {
    read() {
      state.readCount += 1;
      if (state.readCount === 1) resolveReadStarted();
      if (chunkIndex < chunks.length) {
        const value = chunks[chunkIndex];
        chunkIndex += 1;
        return Promise.resolve({ done: false, value });
      }
      if (options.stall === true) {
        return new Promise(() => {});
      }
      return Promise.resolve({ done: true, value: undefined });
    },
    cancel() {
      state.cancelled = true;
      return Promise.resolve();
    },
    releaseLock() {
      state.released = true;
    }
  };
  return {
    readStarted,
    response: {
      status: honestResponse.status,
      headers,
      body: {
        getReader() {
          return reader;
        }
      },
      arrayBuffer() {
        state.arrayBufferCalls += 1;
        throw new Error("arrayBuffer must not be called");
      }
    },
    state
  };
}

class FakeCompanion {
  constructor() {
    this.calls = [];
    this.context = null;
    this.sessionKey = null;
    this.epoch = 1;
    this.nextSequence = 1;
    this.operation = null;
    this.seedLifecycles = new Map();
    this.seedLaunchCounts = new Map();
    this.seedError = null;
    this.seedResponseOperationId = null;
    this.failNextFetch = false;
    this.dropResponseAfterPath = null;
    this.pairingCompleteBodies = [];
    this.rotationBeginCount = 0;
    this.rotationReplay = null;
    this.fetch = this.fetch.bind(this);
  }

  async fetch(url, options) {
    this.calls.push({ url, options });
    if (this.failNextFetch) {
      this.failNextFetch = false;
      throw new TypeError("simulated network loss");
    }
    const parsed = new URL(url);
    assert.equal(parsed.origin, "http://127.0.0.1:54321");
    const path = parsed.pathname;
    let result;
    if (path === capability.ROUTES.pairingBegin) {
      result = await this.begin(options);
    } else if (path === capability.ROUTES.pairingComplete) {
      result = await this.complete(options);
    } else {
      result = await this.authenticated(path, options);
    }
    if (this.dropResponseAfterPath === path) {
      this.dropResponseAfterPath = null;
      throw new TypeError("simulated lost committed response");
    }
    return result;
  }

  async begin(options) {
    assert.equal(options.method, "POST");
    const request = jsonBody(options.body);
    assert.deepEqual(
      new Uint8Array(options.body),
      capability.encodePairingBeginRequest(request)
    );
    this.context = {
      installationId,
      processInstanceId,
      claimId: request.claimId,
      browserNonce: request.browserNonce,
      serverNonce,
      sessionId,
      keyEpoch: 1,
      host,
      origin: capability.PRODUCTION_ORIGIN,
      sessionExpiresAtUtc: "2026-08-28T08:00:00Z",
      idleTimeoutSeconds: 900
    };
    const begin = {
      schema: capability.SCHEMAS.pairingBeginResponse,
      protocolId: capability.PROTOCOL_ID,
      installationId,
      processInstanceId,
      claimId: request.claimId,
      browserNonce: request.browserNonce,
      serverNonce,
      sessionId,
      keyEpoch: 1,
      sessionExpiresAtUtc: this.context.sessionExpiresAtUtc,
      idleTimeoutSeconds: 900,
      pairingProof: await capability.computePairingServerProof(secret, this.context)
    };
    return response(capability.encodePairingBeginResponse(begin), 200);
  }

  async complete(options) {
    this.pairingCompleteBodies.push(Buffer.from(options.body).toString("hex"));
    const request = jsonBody(options.body);
    this.sessionKey = await capability.deriveSessionKey(secret, this.context);
    assert.equal(await capability.verifyPairingBrowserProof(
      this.sessionKey,
      this.context,
      request.browserProof
    ), true);
    const complete = {
      schema: capability.SCHEMAS.pairingCompleteResponse,
      protocolId: capability.PROTOCOL_ID,
      installationId,
      processInstanceId,
      sessionId,
      keyEpoch: 1,
      sessionExpiresAtUtc: this.context.sessionExpiresAtUtc,
      idleTimeoutSeconds: 900,
      completionProof: await capability.computePairingCompletionProof(
        this.sessionKey,
        this.context,
        await capability.sha256Hex(new Uint8Array(options.body))
      )
    };
    return response(capability.encodePairingCompleteResponse(complete), 200);
  }

  async authenticated(path, options) {
    const headers = requestHeaders(options);
    const sequence = Number(headers.get("x-tinyrustlm-sequence"));
    const epoch = Number(headers.get("x-tinyrustlm-epoch"));
    const body = options.method === "GET"
      ? new Uint8Array()
      : new Uint8Array(options.body);
    if (this.rotationReplay && epoch < this.epoch) {
      assert.equal(path, this.rotationReplay.path);
      assert.equal(options.method, this.rotationReplay.method);
      assert.equal(Buffer.from(body).toString("hex"), this.rotationReplay.bodyHex);
      for (const [name, value] of Object.entries(this.rotationReplay.headers)) {
        assert.equal(headers.get(name), value);
      }
      return this.rotationReplay.response.clone();
    }
    const requestContext = {
      installationId,
      processInstanceId,
      sessionId,
      keyEpoch: epoch,
      sequence,
      method: options.method,
      host,
      origin: capability.PRODUCTION_ORIGIN,
      path,
      contentType: options.method === "POST" ? "application/json" : "",
      contentLength: body.byteLength,
      contentSha256: await capability.sha256Hex(body)
    };
    assert.equal(sequence, this.nextSequence);
    assert.equal(epoch, this.epoch);
    assert.equal(headers.get("x-tinyrustlm-content-sha256"),
      requestContext.contentSha256);
    assert.equal(await capability.verifyRequestProof(
      this.sessionKey,
      requestContext,
      headers.get("x-tinyrustlm-request-proof")
    ), true);

    let result;
    if (path === capability.ROUTES.session) {
      result = {
        status: 200,
        body: capability.encodeSessionStatus({
          schema: capability.SCHEMAS.sessionStatus,
          protocolId: capability.PROTOCOL_ID,
          installationId,
          processInstanceId,
          sessionId,
          keyEpoch: this.epoch,
          acceptedSequence: sequence,
          nextSequence: sequence + 1,
          sessionExpiresAtUtc: "2026-08-28T08:00:00Z",
          keyExpiresAtUtc: "2026-08-28T00:15:00Z",
          idleTimeoutSeconds: 900
        })
      };
    } else if (path === capability.ROUTES.rotationBegin) {
      this.rotationBeginCount += 1;
      const request = jsonBody(body);
      this.rotation = {
        rotationId: request.rotationId,
        browserNonce: request.browserNonce,
        serverNonce: capability.encodeBase64Url(new Uint8Array(32).fill(0x66)),
        currentEpoch: this.epoch,
        nextEpoch: this.epoch + 1
      };
      result = {
        status: 200,
        body: capability.encodeRotationChallenge({
          schema: capability.SCHEMAS.rotationChallenge,
          ...this.rotation,
          pendingExpiresAtUtc: "2026-08-28T00:02:00Z"
        })
      };
    } else if (path === capability.ROUTES.rotationCommit) {
      const request = jsonBody(body);
      const rotationContext = {
        installationId,
        processInstanceId,
        sessionId,
        ...this.rotation,
        host,
        origin: capability.PRODUCTION_ORIGIN
      };
      const nextKey = await capability.deriveRotatedSessionKey(
        this.sessionKey,
        rotationContext
      );
      assert.equal(await capability.verifyRotationNewKeyProof(
        nextKey,
        rotationContext,
        request.newKeyProof
      ), true);
      result = {
        status: 200,
        proofKey: nextKey,
        body: capability.encodeRotationCommitted({
          schema: capability.SCHEMAS.rotationCommitted,
          rotationId: request.rotationId,
          keyEpoch: request.nextEpoch,
          keyExpiresAtUtc: "2026-08-28T00:30:00Z",
          completionProof: await capability.computeRotationCompletionProof(
            nextKey,
            rotationContext,
            await capability.sha256Hex(body)
          )
        }),
        after: () => {
          this.sessionKey.fill(0);
          this.sessionKey = nextKey;
          this.epoch = request.nextEpoch;
          this.nextSequence = 1;
        },
        retainRotationReplay: true
      };
    } else if (path === capability.ROUTES.revoke) {
      const request = jsonBody(body);
      result = {
        status: 200,
        body: capability.encodeRevokedResponse({
          schema: capability.SCHEMAS.revokedResponse,
          revocationId: request.revocationId,
          revoked: true
        })
      };
    } else if (path === capability.ROUTES.operations && options.method === "POST") {
      const request = jsonBody(body);
      const operationId = await capability.computeOperationId(request);
      this.operation = projection(operationId, "queued");
      result = { status: 200, body: capability.encodeOperationProjection(this.operation) };
    } else if (this.operation &&
        path === `${capability.ROUTES.operations}/${this.operation.operationId}`) {
      result = { status: 200, body: capability.encodeOperationProjection(this.operation) };
    } else if (this.operation &&
        path === `${capability.ROUTES.operations}/${this.operation.operationId}/cancel`) {
      this.operation = projection(this.operation.operationId, "cancelled", 1);
      result = { status: 200, body: capability.encodeOperationProjection(this.operation) };
    } else if (this.operation && path.includes("/artifacts/model/chunks/0")) {
      const chunk = new Uint8Array([1, 2, 3, 4]);
      const metadata = {
        operationId: this.operation.operationId,
        artifactRole: "model",
        artifactId: `sha256:${"a".repeat(64)}`,
        artifactSha256: "a".repeat(64),
        artifactBytes: 4,
        chunkIndex: 0,
        chunkCount: 1,
        chunkOffset: 0,
        chunkBytes: 4
      };
      result = {
        status: 200,
        contentType: "application/octet-stream",
        body: chunk,
        metadata,
        metadataSha256: await capability.computeArtifactMetadataSha256(metadata)
      };
    } else if (path === capability.ROUTES.directCompositionSeeds &&
        options.method === "POST") {
      if (this.seedError) {
        result = {
          status: this.seedError.status,
          body: capability.encodeErrorResponse({
            schema: capability.SCHEMAS.error,
            code: this.seedError.code
          })
        };
        this.seedError = null;
      } else {
        const request = capability.decodeDirectCompositionSeedStartRequest(body);
        const responseOperationId = this.seedResponseOperationId || request.operationId;
        let seed = this.seedLifecycles.get(request.operationId) || null;
        if (!seed && this.seedLifecycles.size >= 4) {
          result = {
            status: 409,
            body: capability.encodeErrorResponse({
              schema: capability.SCHEMAS.error,
              code: "direct-composition-seed-resource-limit"
            })
          };
        } else {
          if (!seed) {
            seed = directSeedProjection(responseOperationId, "ready");
            if (responseOperationId === request.operationId) {
              this.seedLifecycles.set(request.operationId, seed);
              this.seedLaunchCounts.set(
                request.operationId,
                (this.seedLaunchCounts.get(request.operationId) || 0) + 1
              );
            }
          }
          result = {
            status: 200,
            body: capability.encodeDirectCompositionSeedProjection(seed)
          };
        }
      }
    } else {
      const seedPath = path.startsWith(`${capability.ROUTES.directCompositionSeeds}/`)
        ? path.slice(capability.ROUTES.directCompositionSeeds.length + 1)
        : "";
      const seedParts = seedPath.split("/");
      const seedOperationId = seedParts[0] || "";
      const seed = this.seedLifecycles.get(seedOperationId) || null;
      if (seed && seedParts.length === 1 && options.method === "GET") {
        result = {
          status: 200,
          body: capability.encodeDirectCompositionSeedProjection(seed)
        };
      } else if (seed && seedParts.length === 2 && seedParts[1] === "stop" &&
          options.method === "POST") {
        capability.decodeDirectCompositionSeedStopRequest(body);
        const stopped = seed.state === "ready"
          ? directSeedProjection(seed.operationId, "stopped", seed.sequence + 1, {
            compositionId: seed.compositionId,
            terminalCode: "direct-composition-seed-launch-stopped"
          })
          : seed;
        this.seedLifecycles.set(seedOperationId, stopped);
        result = {
          status: 200,
          body: capability.encodeDirectCompositionSeedProjection(stopped)
        };
      } else if (/^[0-9a-f]{64}$/u.test(seedOperationId)) {
        result = {
          status: 404,
          body: capability.encodeErrorResponse({
            schema: capability.SCHEMAS.error,
            code: "direct-composition-seed-not-found"
          })
        };
      } else {
        result = {
          status: 409,
          body: capability.encodeErrorResponse({
            schema: capability.SCHEMAS.error,
            code: "operation-not-available"
          })
        };
      }
    }

    const responseValue = await this.provenResponse(
      requestContext,
      result.status,
      result.body,
      result.contentType || "application/json",
      result.metadataSha256 || capability.EMPTY_SHA256,
      result.proofKey || this.sessionKey,
      result.metadata
    );
    if (result.retainRotationReplay) {
      this.rotationReplay = {
        path,
        method: options.method,
        bodyHex: Buffer.from(body).toString("hex"),
        headers: Object.fromEntries([
          "x-tinyrustlm-session",
          "x-tinyrustlm-epoch",
          "x-tinyrustlm-sequence",
          "x-tinyrustlm-content-sha256",
          "x-tinyrustlm-request-proof"
        ].map((name) => [name, headers.get(name)])),
        response: responseValue.clone()
      };
    }
    if (result.after) {
      result.after();
    } else {
      this.nextSequence += 1;
    }
    return responseValue;
  }

  async provenResponse(
    requestContext,
    status,
    body,
    contentType,
    responseMetadataSha256,
    proofKey,
    metadata
  ) {
    const value = bytes(body);
    const contentSha256 = await capability.sha256Hex(value);
    const responseContext = {
      installationId,
      processInstanceId,
      sessionId,
      keyEpoch: requestContext.keyEpoch,
      sequence: requestContext.sequence,
      requestMethod: requestContext.method,
      requestPath: requestContext.path,
      status,
      contentType,
      contentLength: value.byteLength,
      responseMetadataSha256,
      contentSha256
    };
    const headers = {
      "Content-Length": String(value.byteLength),
      "Content-Type": contentType,
      "X-TinyRustLM-Session": sessionId,
      "X-TinyRustLM-Epoch": String(requestContext.keyEpoch),
      "X-TinyRustLM-Sequence": String(requestContext.sequence),
      "X-TinyRustLM-Content-SHA256": contentSha256,
      "X-TinyRustLM-Response-Metadata-SHA256": responseMetadataSha256,
      "X-TinyRustLM-Response-Proof": await capability.computeResponseProof(
        proofKey,
        responseContext
      )
    };
    if (metadata) {
      Object.assign(headers, {
        "X-TinyRustLM-Artifact-Role": metadata.artifactRole,
        "X-TinyRustLM-Artifact-Id": metadata.artifactId,
        "X-TinyRustLM-Artifact-SHA256": metadata.artifactSha256,
        "X-TinyRustLM-Artifact-Bytes": String(metadata.artifactBytes),
        "X-TinyRustLM-Chunk-Index": String(metadata.chunkIndex),
        "X-TinyRustLM-Chunk-Count": String(metadata.chunkCount),
        "X-TinyRustLM-Chunk-Offset": String(metadata.chunkOffset),
        "X-TinyRustLM-Chunk-Bytes": String(metadata.chunkBytes)
      });
    }
    return new Response(value, { status, headers });
  }
}

function projection(operationId, state, sequence = 0) {
  return {
    schema: capability.SCHEMAS.operationProjection,
    operationId,
    sequence,
    state,
    route: "source",
    phaseCompletedBytes: 0,
    phaseTotalBytes: null,
    artifacts: null,
    errorCode: null
  };
}

function directSeedProjection(operationId, state = "ready", sequence = 1, overrides = {}) {
  const ready = state === "ready";
  return {
    schema: capability.SCHEMAS.directCompositionSeedProjection,
    operationId,
    sequence,
    state,
    compositionId: overrides.compositionId || `sha256:${"9".repeat(64)}`,
    protocol: ready ? capability.DIRECT_COMPOSITION_SEED_PROTOCOL : null,
    boundOrigin: ready ? "http://127.0.0.1:18123" : null,
    allowedBrowserOrigin: ready ? capability.PRODUCTION_ORIGIN : null,
    terminalCode: ready ? null : (overrides.terminalCode ||
      "direct-composition-seed-launch-process-exit")
  };
}

function availableArtifacts(byteCount = 1) {
  return Object.fromEntries([
    ["composition", "acg2"],
    ["model", "slm2"],
    ["tokenizer", "tokenizer2"],
    ["template", "template2"],
    ["sampling", "sampling2"],
    ["prompt", "prompt2"]
  ].map(([role, kind], index) => [role, {
    kind,
    artifactId: `sha256:${String(index + 1).repeat(64)}`,
    sha256: String(index + 1).repeat(64),
    byteCount
  }]));
}

function acquireRequest() {
  return {
    schema: capability.SCHEMAS.acquire,
    attemptId: "01".repeat(16),
    route: "source",
    modelId: "qwen3-0.6b",
    sourceRepository: "Qwen/Qwen3-0.6B",
    sourceRevision: "c1899de289a04d12100db370d81485cdf75e47ca",
    modelSourceLockSha256:
      "e24bf9d95a5631e0b7c44c192e4ec6b7ec4b8793e1597f9dad99f1257ecf582d",
    tokenizerSourceLockSha256:
      "1641e8d4ab1fe9e4b6b3d24918c394fcf8d6e60d204be1f4c821f0f6570b1c70",
    compositionProfileSha256:
      "19e43c7ae532e7bc1822cbdcf179ee9bf1ed111298d3c6e5b13d37d990ee47e8",
    sourceAcquisitionApproved: true,
    maximumSourceBytes: 1519207688
  };
}

test("pairing code is exact and causes no port scan or startup fetch", async () => {
  const fake = new FakeCompanion();
  const client = new capability.CompanionCapabilityClient({ fetch: fake.fetch });
  assert.equal(fake.calls.length, 0);
  for (const invalid of [
    ` ${pairingCode}`,
    `${pairingCode}\n`,
    pairingCode.replace("54321", "80"),
    pairingCode.replace("TRLC1", "trlc1")
  ]) {
    await assert.rejects(client.pair(invalid), (error) =>
      error.code === "pairing-code-invalid");
  }
  assert.equal(fake.calls.length, 0);
});

test("pre-auth pairing cancellation owns the stalled response body", async () => {
  const fake = new FakeCompanion();
  let hostile = null;
  let stallPairingBegin = true;
  const fetch = async (url, options) => {
    const honest = await fake.fetch(url, options);
    if (stallPairingBegin && new URL(url).pathname === capability.ROUTES.pairingBegin) {
      hostile = hostileBodyResponse(honest, {
        declaredBytes: Number(honest.headers.get("content-length")),
        stall: true
      });
      return hostile.response;
    }
    return honest;
  };
  const client = new capability.CompanionCapabilityClient({ fetch });
  const controller = new AbortController();
  const pending = client.pair(pairingCode, controller.signal);
  while (!hostile) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  await hostile.readStarted;
  await assert.rejects(
    client.pair(pairingCode),
    (error) => error.code === "client-state"
  );
  controller.abort();
  await assert.rejects(
    pending,
    (error) => error instanceof capability.CompanionCapabilityError &&
      error.code === "companion-request-aborted" && error.status === 0
  );
  assert.equal(hostile.state.arrayBufferCalls, 0);
  assert.equal(hostile.state.cancelled, true);
  assert.equal(hostile.state.released, true);
  assert.equal(client.isPaired, false);
  assert.equal(client.recoveryState, null);
  assert.equal(fake.calls.length, 1);

  stallPairingBegin = false;
  assert.equal((await client.pair(pairingCode)).sessionId, sessionId);
  client.close();
});

test("proof-bound pairing, status, rotation, and revocation remain memory only", async () => {
  const fake = new FakeCompanion();
  const client = new capability.CompanionCapabilityClient({ fetch: fake.fetch });
  const paired = await client.pair(pairingCode);
  assert.equal(paired.sessionId, sessionId);
  assert.equal(paired.nextSequence, 1);
  assert.equal(fake.calls.length, 2);
  const status = await client.status();
  assert.equal(status.acceptedSequence, 1);
  assert.equal(client.session.nextSequence, 2);
  const rotated = await client.rotate();
  assert.equal(rotated.keyEpoch, 2);
  assert.equal(rotated.nextSequence, 1);
  assert.equal((await client.status()).keyEpoch, 2);
  assert.equal(await client.revoke(), true);
  assert.equal(client.isPaired, false);
  assert.equal(client.session, null);
});

test("lost pairing completion recovers only by exact completion replay", async () => {
  const fake = new FakeCompanion();
  const client = new capability.CompanionCapabilityClient({ fetch: fake.fetch });
  fake.dropResponseAfterPath = capability.ROUTES.pairingComplete;
  await assert.rejects(client.pair(pairingCode), (error) =>
    error.code === "pairing-outcome-unknown");
  assert.equal(client.recoveryState, "pairing");
  assert.equal(client.isPaired, false);
  const session = await client.recoverPairing();
  assert.equal(session.sessionId, sessionId);
  assert.equal(client.recoveryState, null);
  assert.equal(fake.pairingCompleteBodies.length, 2);
  assert.equal(fake.pairingCompleteBodies[0], fake.pairingCompleteBodies[1]);
  assert.equal(fake.calls.filter((call) =>
    new URL(call.url).pathname === capability.ROUTES.pairingBegin).length, 1);
});

test("lost rotation commit retains both keys and exact-replays without a new rotation", async () => {
  const fake = new FakeCompanion();
  const client = new capability.CompanionCapabilityClient({ fetch: fake.fetch });
  await client.pair(pairingCode);
  fake.dropResponseAfterPath = capability.ROUTES.rotationCommit;
  await assert.rejects(client.rotate(), (error) =>
    error.code === "rotation-outcome-unknown");
  assert.equal(client.recoveryState, "rotation");
  assert.equal(client.session.keyEpoch, 1);
  await assert.rejects(client.status(), (error) =>
    error.code === "capability-invalid");
  const recovered = await client.recoverRotation();
  assert.equal(recovered.keyEpoch, 2);
  assert.equal(recovered.nextSequence, 1);
  assert.equal(client.recoveryState, null);
  assert.equal(fake.rotationBeginCount, 1);
  assert.equal((await client.status()).keyEpoch, 2);
});

test("direct composition seed request codecs require exact canonical keys", () => {
  const operationId = "a".repeat(64);
  const start = {
    schema: capability.SCHEMAS.directCompositionSeedStartRequest,
    operationId
  };
  const startWire = capability.encodeDirectCompositionSeedStartRequest(start);
  assert.equal(
    Buffer.from(startWire).toString("utf8"),
    `{"schema":"${capability.SCHEMAS.directCompositionSeedStartRequest}","operationId":"${operationId}"}`
  );
  assert.deepEqual(capability.decodeDirectCompositionSeedStartRequest(startWire), start);
  assert.throws(
    () => capability.encodeDirectCompositionSeedStartRequest({ ...start, extra: true }),
    (error) => error.code === "direct-composition-seed-start-request"
  );
  assert.throws(
    () => capability.decodeDirectCompositionSeedStartRequest(bytes(
      `{"operationId":"${operationId}","schema":"${start.schema}"}`
    )),
    (error) => error.code === "direct-composition-seed-start-request-wire-canonical"
  );

  const stop = { schema: capability.SCHEMAS.directCompositionSeedStopRequest };
  const stopWire = capability.encodeDirectCompositionSeedStopRequest(stop);
  assert.equal(
    Buffer.from(stopWire).toString("utf8"),
    `{"schema":"${capability.SCHEMAS.directCompositionSeedStopRequest}"}`
  );
  assert.deepEqual(capability.decodeDirectCompositionSeedStopRequest(stopWire), stop);
  assert.throws(
    () => capability.encodeDirectCompositionSeedStopRequest({ ...stop, operationId }),
    (error) => error.code === "direct-composition-seed-stop-request"
  );
  assert.throws(
    () => capability.decodeDirectCompositionSeedStopRequest(new Uint8Array(513)),
    (error) => error.code === "direct-composition-seed-stop-request-wire"
  );
});

test("direct composition seed projection enforces bounds and state-dependent fields", () => {
  const operationId = "b".repeat(64);
  const ready = directSeedProjection(operationId);
  const readyWire = capability.encodeDirectCompositionSeedProjection(ready);
  assert.deepEqual(capability.decodeDirectCompositionSeedProjection(readyWire), ready);
  assert.equal(Object.isFrozen(capability.decodeDirectCompositionSeedProjection(readyWire)), true);

  for (const state of ["stopped", "failed"]) {
    const terminal = directSeedProjection(operationId, state, 2);
    assert.deepEqual(
      capability.decodeDirectCompositionSeedProjection(
        capability.encodeDirectCompositionSeedProjection(terminal)
      ),
      terminal
    );
  }
  for (const mutation of [
    { ...ready, sequence: 0 },
    { ...ready, sequence: Number.MAX_SAFE_INTEGER + 1 },
    { ...ready, state: "starting" },
    { ...ready, operationId: "B".repeat(64) },
    { ...ready, compositionId: `sha256:${"A".repeat(64)}` },
    { ...ready, protocol: "tinyrustlm.direct-composition-http.v2" },
    { ...ready, boundOrigin: "http://127.0.0.1:1023" },
    { ...ready, boundOrigin: "http://127.0.0.1:18123/" },
    { ...ready, boundOrigin: "http://localhost:18123" },
    { ...ready, allowedBrowserOrigin: "https://www.tinyrustlm.com" },
    { ...ready, terminalCode: "unexpected" },
    { ...ready, extra: null },
    { ...directSeedProjection(operationId, "failed"), terminalCode: null }
  ]) {
    assert.throws(
      () => capability.encodeDirectCompositionSeedProjection(mutation),
      (error) => error instanceof capability.CompanionCapabilityError
    );
  }
  assert.throws(
    () => capability.decodeDirectCompositionSeedProjection(new Uint8Array(2049)),
    (error) => error.code === "direct-composition-seed-projection-wire"
  );
  const reordered = Buffer.from(readyWire).toString("utf8")
    .replace(/^\{"schema":([^,]+),"operationId":([^,]+),/, "{\"operationId\":$2,\"schema\":$1,");
  assert.throws(
    () => capability.decodeDirectCompositionSeedProjection(bytes(reordered)),
    (error) => error.code === "direct-composition-seed-projection-wire-canonical"
  );
});

test("direct composition seed client start read and stop preserve identity and typed errors", async () => {
  const operationId = "c".repeat(64);
  const fake = new FakeCompanion();
  const client = new capability.CompanionCapabilityClient({ fetch: fake.fetch });
  await client.pair(pairingCode);
  const started = await client.startDirectCompositionSeed(operationId);
  assert.equal(started.operationId, operationId);
  assert.equal(started.state, "ready");
  assert.deepEqual(await client.readDirectCompositionSeed(operationId), started);
  const stopped = await client.stopDirectCompositionSeed(operationId);
  assert.equal(stopped.operationId, operationId);
  assert.equal(stopped.state, "stopped");
  assert.deepEqual(fake.calls.slice(-3).map((call) => ({
    method: call.options.method,
    path: new URL(call.url).pathname
  })), [
    { method: "POST", path: capability.ROUTES.directCompositionSeeds },
    { method: "GET", path: `${capability.ROUTES.directCompositionSeeds}/${operationId}` },
    { method: "POST", path: `${capability.ROUTES.directCompositionSeeds}/${operationId}/stop` }
  ]);

  const rejectingFake = new FakeCompanion();
  const rejectingClient = new capability.CompanionCapabilityClient({ fetch: rejectingFake.fetch });
  await rejectingClient.pair(pairingCode);
  rejectingFake.seedError = { status: 409, code: "direct-composition-seed-conflict" };
  await assert.rejects(
    rejectingClient.startDirectCompositionSeed(operationId),
    (error) => error instanceof capability.CompanionCapabilityError &&
      error.code === "direct-composition-seed-conflict" && error.status === 409
  );

  const driftingFake = new FakeCompanion();
  const driftingClient = new capability.CompanionCapabilityClient({ fetch: driftingFake.fetch });
  await driftingClient.pair(pairingCode);
  driftingFake.seedResponseOperationId = "d".repeat(64);
  await assert.rejects(
    driftingClient.startDirectCompositionSeed(operationId),
    (error) => error.code === "direct-composition-seed-identity-drift"
  );
});

test("direct composition seed fake retains four independent lifecycle records", async () => {
  const operationIds = ["1", "2", "3", "4"].map((value) => value.repeat(64));
  const fake = new FakeCompanion();
  const client = new capability.CompanionCapabilityClient({ fetch: fake.fetch });
  await client.pair(pairingCode);

  const started = [];
  for (const operationId of operationIds) {
    started.push(await client.startDirectCompositionSeed(operationId));
  }
  assert.deepEqual(started.map((projectionValue) => projectionValue.state), [
    "ready", "ready", "ready", "ready"
  ]);
  assert.deepEqual(Array.from(fake.seedLifecycles.keys()), operationIds);

  const duplicate = await client.startDirectCompositionSeed(operationIds[0]);
  assert.deepEqual(duplicate, started[0]);
  assert.equal(fake.seedLaunchCounts.get(operationIds[0]), 1);

  const fifthOperationId = "5".repeat(64);
  await assert.rejects(
    client.startDirectCompositionSeed(fifthOperationId),
    (error) => error.code === "direct-composition-seed-resource-limit" &&
      error.status === 409
  );
  assert.deepEqual(Array.from(fake.seedLifecycles.keys()), operationIds);

  const failedOperationId = operationIds[1];
  const failedSeed = directSeedProjection(failedOperationId, "failed", 2, {
    compositionId: started[1].compositionId,
    terminalCode: "direct-composition-seed-launch-process-exit"
  });
  fake.seedLifecycles.set(failedOperationId, failedSeed);
  assert.deepEqual(await client.readDirectCompositionSeed(failedOperationId), failedSeed);
  assert.equal((await client.readDirectCompositionSeed(operationIds[2])).state, "ready");

  const stopped = await client.stopDirectCompositionSeed(operationIds[0]);
  assert.equal(stopped.state, "stopped");
  assert.deepEqual(await client.stopDirectCompositionSeed(operationIds[0]), stopped);
  assert.equal((await client.readDirectCompositionSeed(operationIds[3])).state, "ready");
});

test("direct composition seed calls share the authenticated single-flight gate", async () => {
  const operationId = "e".repeat(64);
  const fake = new FakeCompanion();
  let releaseSeed;
  let markSeedStarted;
  const seedStarted = new Promise((resolve) => { markSeedStarted = resolve; });
  const seedRelease = new Promise((resolve) => { releaseSeed = resolve; });
  let stallSeed = false;
  const fetch = async (url, options) => {
    if (stallSeed && new URL(url).pathname === capability.ROUTES.directCompositionSeeds) {
      markSeedStarted();
      await seedRelease;
    }
    return fake.fetch(url, options);
  };
  const client = new capability.CompanionCapabilityClient({ fetch });
  await client.pair(pairingCode);
  stallSeed = true;
  const pending = client.startDirectCompositionSeed(operationId);
  await seedStarted;
  await assert.rejects(
    client.readDirectCompositionSeed(operationId),
    (error) => error.code === "session-request-in-flight"
  );
  releaseSeed();
  assert.equal((await pending).state, "ready");
  assert.equal((await client.readDirectCompositionSeed(operationId)).state, "ready");
});

test("deterministic operation API and fixed artifact chunk verify every identity", async () => {
  const fake = new FakeCompanion();
  const client = new capability.CompanionCapabilityClient({ fetch: fake.fetch });
  await client.pair(pairingCode);
  const request = acquireRequest();
  const created = await client.createOperation(request);
  assert.equal(created.operationId, await capability.computeOperationId(request));
  assert.equal((await client.getOperation(created.operationId)).operationId,
    created.operationId);
  const cancelled = await client.cancelOperation(created.operationId, "ab".repeat(16));
  assert.equal(cancelled.state, "cancelled");

  fake.operation = projection(created.operationId, "available", 2);
  const chunk = await client.getArtifactChunk(
    created.operationId,
    "model",
    0,
    {
      artifactId: `sha256:${"a".repeat(64)}`,
      sha256: "a".repeat(64),
      byteCount: 4
    }
  );
  assert.deepEqual(Array.from(chunk.bytes), [1, 2, 3, 4]);
  assert.equal(chunk.metadata.chunkCount, 1);
});

test("timeout remains authoritative after headers and clears single flight", async () => {
  const fake = new FakeCompanion();
  let hostile = null;
  let stallStatusBody = false;
  const fetch = async (url, options) => {
    const honest = await fake.fetch(url, options);
    if (stallStatusBody && new URL(url).pathname === capability.ROUTES.session) {
      hostile = hostileBodyResponse(honest, {
        declaredBytes: Number(honest.headers.get("content-length")),
        stall: true
      });
      return hostile.response;
    }
    return honest;
  };
  const client = new capability.CompanionCapabilityClient({
    fetch,
    timeoutMilliseconds: 1000
  });
  await client.pair(pairingCode);
  stallStatusBody = true;
  const pending = client.status();
  while (!hostile) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  await hostile.readStarted;
  await assert.rejects(
    client.status(),
    (error) => error.code === "session-request-in-flight"
  );
  await assert.rejects(
    pending,
    (error) => error instanceof capability.CompanionCapabilityError &&
      error.code === "companion-timeout" && error.status === 0
  );
  const requestCall = fake.calls.findLast((call) =>
    new URL(call.url).pathname === capability.ROUTES.session);
  assert.equal(requestCall.options.signal.aborted, true);
  assert.equal(hostile.state.arrayBufferCalls, 0);
  assert.equal(hostile.state.cancelled, true);
  assert.equal(hostile.state.released, true);
  assert.equal(client.isPaired, false);
  await assert.rejects(
    client.status(),
    (error) => error.code === "capability-invalid"
  );
});

test("dishonest short, empty and oversized bodies fail framing before growth", async () => {
  for (const hostileCase of [
    {
      name: "empty-progress",
      declaredBytes: 1,
      chunks: [new Uint8Array(0)],
      cancelled: true,
      readCount: 1
    },
    {
      name: "short",
      declaredBytes: 2,
      chunks: [new Uint8Array([1])],
      cancelled: false,
      readCount: 2
    },
    {
      name: "oversized",
      declaredBytes: 1,
      chunks: [new Uint8Array([1, 2])],
      cancelled: true,
      readCount: 1
    }
  ]) {
    const fake = new FakeCompanion();
    let corruptStatusBody = false;
    let hostile = null;
    const fetch = async (url, options) => {
      const honest = await fake.fetch(url, options);
      if (corruptStatusBody && new URL(url).pathname === capability.ROUTES.session) {
        hostile = hostileBodyResponse(honest, hostileCase);
        return hostile.response;
      }
      return honest;
    };
    const client = new capability.CompanionCapabilityClient({ fetch });
    await client.pair(pairingCode);
    corruptStatusBody = true;
    await assert.rejects(
      client.status(),
      (error) => error instanceof capability.CompanionCapabilityError &&
        error.code === "response-framing" && error.status === 0,
      hostileCase.name
    );
    assert.equal(hostile.state.arrayBufferCalls, 0, hostileCase.name);
    assert.equal(hostile.state.cancelled, hostileCase.cancelled, hostileCase.name);
    assert.equal(hostile.state.readCount, hostileCase.readCount, hostileCase.name);
    assert.equal(hostile.state.released, true, hostileCase.name);
    assert.equal(client.isPaired, false, hostileCase.name);
  }
});

test("artifact parent cancellation aborts a post-header body and session", async () => {
  const fake = new FakeCompanion();
  let hostile = null;
  let stallArtifactBody = false;
  const fetch = async (url, options) => {
    const honest = await fake.fetch(url, options);
    if (stallArtifactBody && new URL(url).pathname.includes("/artifacts/")) {
      hostile = hostileBodyResponse(honest, {
        declaredBytes: Number(honest.headers.get("content-length")),
        stall: true
      });
      return hostile.response;
    }
    return honest;
  };
  const client = new capability.CompanionCapabilityClient({ fetch });
  await client.pair(pairingCode);
  const request = acquireRequest();
  const operationId = await capability.computeOperationId(request);
  fake.operation = projection(operationId, "available", 1);
  stallArtifactBody = true;
  const controller = new AbortController();
  const pending = client.getArtifactChunk(
    operationId,
    "model",
    0,
    {
      artifactId: `sha256:${"a".repeat(64)}`,
      sha256: "a".repeat(64),
      byteCount: 4
    },
    controller.signal
  );
  while (!hostile) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  await hostile.readStarted;
  controller.abort();
  await assert.rejects(pending, (error) =>
    error.code === "companion-request-aborted");
  const requestCall = fake.calls.find((call) =>
    new URL(call.url).pathname.includes("/artifacts/"));
  assert.equal(requestCall.options.signal.aborted, true);
  assert.equal(hostile.state.arrayBufferCalls, 0);
  assert.equal(hostile.state.cancelled, true);
  assert.equal(hostile.state.released, true);
  assert.equal(client.isPaired, false);
});

test("a proven typed error consumes one sequence without corrupting the session", async () => {
  const fake = new FakeCompanion();
  const client = new capability.CompanionCapabilityClient({ fetch: fake.fetch });
  await client.pair(pairingCode);
  await assert.rejects(
    client.getOperation("f".repeat(64)),
    (error) => error.code === "operation-not-available" && error.status === 409
  );
  assert.equal(client.isPaired, true);
  assert.equal((await client.status()).acceptedSequence, 2);
});

test("an ambiguous transport failure destroys the unsynchronized browser key", async () => {
  const fake = new FakeCompanion();
  const client = new capability.CompanionCapabilityClient({ fetch: fake.fetch });
  await client.pair(pairingCode);
  fake.failNextFetch = true;
  await assert.rejects(client.status(), (error) =>
    error.code === "companion-unavailable");
  assert.equal(client.isPaired, false);
  await assert.rejects(client.status(), (error) =>
    error.code === "capability-invalid");
});

test("canonical acquisition rejects aliases, unsupported routes, and unapproved source", () => {
  const request = acquireRequest();
  assert.deepEqual(jsonBody(capability.encodeAcquireRequest(request)), request);
  assert.throws(
    () => capability.encodeAcquireRequest({ ...request, legacyArtifact: "model.slm" }),
    (error) => error.code === "acquire-request"
  );
  assert.throws(
    () => capability.encodeAcquireRequest({
      ...request,
      sourceAcquisitionApproved: false
    }),
    (error) => error.code === "acquire-source-approval"
  );
  assert.throws(
    () => capability.encodeAcquireRequest({
      ...request,
      route: "peer"
    }),
    (error) => error.code === "acquire-route"
  );
  for (const mutation of [
    { modelId: "qwen3-1.7b" },
    { sourceRepository: "Qwen/Qwen3-1.7B" },
    { sourceRevision: "1".repeat(40) },
    { modelSourceLockSha256: "1".repeat(64) },
    { tokenizerSourceLockSha256: "2".repeat(64) },
    { compositionProfileSha256: "3".repeat(64) },
    { maximumSourceBytes: request.maximumSourceBytes + 1 }
  ]) {
    assert.throws(
      () => capability.encodeAcquireRequest({ ...request, ...mutation }),
      (error) => error.code === "acquire-source-unsupported"
    );
  }
});

test("available projection enforces the aggregate six-member composition ceiling", () => {
  const value = projection("f".repeat(64), "available");
  value.artifacts = availableArtifacts(12 * 1024 * 1024 * 1024);
  value.phaseTotalBytes = 72 * 1024 * 1024 * 1024;
  assert.throws(
    () => capability.encodeOperationProjection(value),
    (error) => error.code === "operation-artifact-total"
  );
});

test("artifact identities are exactly their prefixed content digests", async () => {
  const value = projection("f".repeat(64), "available");
  value.artifacts = availableArtifacts();
  value.artifacts.model.artifactId = `sha256:${"f".repeat(64)}`;
  assert.throws(
    () => capability.encodeOperationProjection(value),
    (error) => error.code === "operation-artifact-model"
  );

  await assert.rejects(
    capability.computeArtifactMetadataSha256({
      operationId: "1".repeat(64),
      artifactRole: "model",
      artifactId: `sha256:${"2".repeat(64)}`,
      artifactSha256: "3".repeat(64),
      artifactBytes: 4,
      chunkIndex: 0,
      chunkCount: 1,
      chunkOffset: 0,
      chunkBytes: 4
    }),
    (error) => error.code === "artifact-id"
  );
});


test("fragmented artifact bodies stop at a finite chunk budget and invalidate the session", async () => {
  const fake = new FakeCompanion();
  let hostile;
  let fragment = false;
  const client = new capability.CompanionCapabilityClient({ fetch: async (url, options) => {
    const honest = await fake.fetch(url, options);
    if (fragment && new URL(url).pathname.includes("/artifacts/")) {
      hostile = hostileBodyResponse(honest, {
        declaredBytes: 65537,
        chunks: Array(65537).fill(new Uint8Array([1])),
      });
      return hostile.response;
    }
    return honest;
  } });
  await client.pair(pairingCode);
  const operationId = await capability.computeOperationId(acquireRequest());
  fake.operation = projection(operationId, "available", 1);
  fragment = true;
  await assert.rejects(client.getArtifactChunk(operationId, "model", 0, {
    artifactId: "sha256:" + "a".repeat(64), sha256: "a".repeat(64), byteCount: 65537,
  }), (error) => error.code === "response-framing");
  assert.equal(hostile.state.readCount, 65537);
  assert.equal(hostile.state.cancelled, true);
  assert.equal(hostile.state.released, true);
  assert.equal(client.isPaired, false);
});
