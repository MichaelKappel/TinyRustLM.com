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

class FakeCompanion {
  constructor() {
    this.calls = [];
    this.context = null;
    this.sessionKey = null;
    this.epoch = 1;
    this.nextSequence = 1;
    this.operation = null;
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
      this.operation = projection(operationId, "queued", "undecided");
      result = { status: 200, body: capability.encodeOperationProjection(this.operation) };
    } else if (this.operation &&
        path === `${capability.ROUTES.operations}/${this.operation.operationId}`) {
      result = { status: 200, body: capability.encodeOperationProjection(this.operation) };
    } else if (this.operation &&
        path === `${capability.ROUTES.operations}/${this.operation.operationId}/cancel`) {
      this.operation = projection(this.operation.operationId, "cancelled", "none", 1);
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
    } else {
      result = {
        status: 409,
        body: capability.encodeErrorResponse({
          schema: capability.SCHEMAS.error,
          code: "operation-not-available"
        })
      };
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

function projection(operationId, state, branch, sequence = 0) {
  return {
    schema: capability.SCHEMAS.operationProjection,
    operationId,
    sequence,
    state,
    branch,
    completedBytes: 0,
    totalBytes: null,
    artifacts: null,
    errorCode: null
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
    modelId: "qwen3-0.6b",
    sourceRepository: "Qwen/Qwen3-0.6B",
    sourceRevision: "c1899de289a04d12100db370d81485cdf75e47ca",
    modelSourceLockSha256: "7".repeat(64),
    tokenizerSourceLockSha256: "8".repeat(64),
    compositionProfileSha256: "9".repeat(64),
    sourceAcquisitionApproved: true,
    maximumSourceBytes: 1024 * 1024 * 1024,
    peerCandidates: []
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

  fake.operation = projection(created.operationId, "available", "source", 2);
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

test("canonical acquisition rejects aliases, unknown fields, and unapproved empty routes", () => {
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
    (error) => error.code === "acquire-no-authorized-branch"
  );
  assert.throws(
    () => capability.encodeAcquireRequest({
      ...request,
      peerCandidates: [{
        manifestUri: "https://127.0.0.1/model/manifest",
        manifestId: `sha256:${"a".repeat(64)}`
      }]
    }),
    (error) => error.code === "acquire-peer-uri"
  );
});

test("available projection enforces the aggregate six-member composition ceiling", () => {
  const value = projection("f".repeat(64), "available", "source");
  value.artifacts = availableArtifacts(12 * 1024 * 1024 * 1024);
  value.totalBytes = 72 * 1024 * 1024 * 1024;
  assert.throws(
    () => capability.encodeOperationProjection(value),
    (error) => error.code === "operation-artifact-total"
  );
});
