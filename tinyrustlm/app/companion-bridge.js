(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.TinyRustLMCompanionBridge = factory();
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_ENDPOINT = "http://127.0.0.1:43127/";
  const PROTOCOL_VERSION = "1";
  const PROTOCOL_HEADER = "X-TinyRustLM-Bridge-Version";
  const CAPABILITY_HEADER = "X-TinyRustLM-Bridge-Capability";
  const REQUEST_ID_HEADER = "X-TinyRustLM-Bridge-Request-Id";
  const MAXIMUM_JSON_BYTES = 1024 * 1024;
  const MAXIMUM_REQUEST_JSON_BYTES = 8 * 1024 * 1024;
  const MAXIMUM_MANIFEST_BYTES = 4 * 1024 * 1024;
  const MAXIMUM_PEER_REQUEST_BYTES = 256 * 1024;
  const MAXIMUM_MODEL_STREAM_BYTES = 1024 * 1024 * 1024;
  const MINIMUM_MODEL_STREAM_TIMEOUT_MILLISECONDS = 2 * 60 * 1000;
  const MAXIMUM_MODEL_STREAM_TIMEOUT_MILLISECONDS = 20 * 60 * 1000;
  const MODEL_STREAM_STARTUP_ALLOWANCE_MILLISECONDS = 30 * 1000;
  const MODEL_STREAM_MINIMUM_BYTES_PER_SECOND = 1024 * 1024;
  const CAPABILITY_ROTATION_WINDOW_MILLISECONDS = 2 * 60 * 1000;
  const DEFAULT_SCOPES = Object.freeze([
    "status",
    "models_read",
    "imports_create",
    "imports_read",
    "imports_cancel",
    "models_stream"
  ]);
  const operationIdPattern = /^import-[0-9a-f]{64}$/;
  const privateState = new WeakMap();

  class CompanionBridgeError extends Error {
    constructor(code, message, status) {
      super(message);
      this.name = "CompanionBridgeError";
      this.code = code;
      this.status = Number.isInteger(status) ? status : 0;
    }
  }

  class CompanionBridgeClient {
    constructor(options) {
      const source = options && typeof options === "object" ? options : {};
      const endpoint = normalizeEndpoint(source.endpoint || DEFAULT_ENDPOINT);
      const fetchImplementation = source.fetch ||
        (typeof fetch === "function" ? fetch.bind(globalThis) : null);
      if (typeof fetchImplementation !== "function") {
        throw new TypeError("companion bridge requires fetch");
      }
      let channel = source.channel || null;
      let ownsChannel = false;
      if (
        !channel &&
        typeof window === "object" &&
        typeof BroadcastChannel === "function"
      ) {
        channel = new BroadcastChannel("tinyrustlm-companion-bridge-v1");
        ownsChannel = true;
      }
      privateState.set(this, {
        endpoint,
        fetch: fetchImplementation,
        capability: "",
        capabilityExpiresUtc: "",
        scopes: [],
        rotationPromise: null,
        channel,
        ownsChannel,
        timeoutMilliseconds: boundedTimeout(source.timeoutMilliseconds)
      });
    }

    get endpoint() {
      return stateOf(this).endpoint;
    }

    get isPaired() {
      const state = stateOf(this);
      if (!state.capability) {
        return false;
      }
      const expires = Date.parse(state.capabilityExpiresUtc);
      if (Number.isFinite(expires) && expires <= Date.now()) {
        clearCapability(state);
        return false;
      }
      return true;
    }

    hasScope(scope) {
      const value = requireText(scope, "companion scope", 64);
      return this.isPaired && stateOf(this).scopes.includes(value);
    }

    async detect(options) {
      const value = await requestJson(this, "/v1/health", {
        method: "GET",
        authenticated: false,
        signal: options && options.signal
      });
      if (
        !value ||
        value.service !== "tinyrustlm-seed-host-bridge" ||
        Number(value.protocol_version) !== Number(PROTOCOL_VERSION)
      ) {
        throw new CompanionBridgeError(
          "bridge_identity_invalid",
          "The loopback service did not identify as the TinyRustLM companion bridge."
        );
      }
      const state = stateOf(this);
      if (value.pairing_state === "unpaired") {
        clearCapability(state);
      }
      broadcastState(state, "detected");
      return value;
    }

    async pair(code, requestedScopes, options) {
      const pairingCode = requireText(code, "pairing code", 1024);
      const scopes = normalizeScopes(requestedScopes || DEFAULT_SCOPES);
      const value = await requestJson(this, "/v1/pair", {
        method: "POST",
        authenticated: false,
        body: {
          code: pairingCode,
          requested_scopes: scopes
        },
        signal: options && options.signal
      });
      const capability = requireText(value && value.capability, "bridge capability", 2048);
      const expiresUtc = requireText(value && value.expires_utc, "capability expiry", 64);
      if (!Number.isFinite(Date.parse(expiresUtc))) {
        throw new CompanionBridgeError(
          "bridge_capability_invalid",
          "The companion returned an invalid capability expiry."
        );
      }
      const grantedScopes = normalizeScopes(value.scopes || []);
      if (scopes.some((scope) => !grantedScopes.includes(scope))) {
        throw new CompanionBridgeError(
          "bridge_scope_mismatch",
          "The companion did not grant every requested browser scope."
        );
      }
      const state = stateOf(this);
      state.capability = capability;
      state.capabilityExpiresUtc = expiresUtc;
      state.scopes = grantedScopes;
      broadcastState(state, "paired");
      return {
        origin: String(value.origin || ""),
        scopes: grantedScopes.slice(),
        expiresUtc
      };
    }

    async status(options) {
      const value = await requestJson(this, "/v1/status", {
        method: "GET",
        signal: options && options.signal
      });
      broadcastState(stateOf(this), "ready");
      return value;
    }

    async listModels(options) {
      const value = await requestJson(this, "/v1/models", {
        method: "GET",
        signal: options && options.signal
      });
      if (!value || !Array.isArray(value.models)) {
        throw new CompanionBridgeError(
          "bridge_response_invalid",
          "The companion model list was invalid."
        );
      }
      return value.models;
    }

    async startImport(manifestText, peerImportRequests, options) {
      const manifest = requireUtf8Text(
        manifestText,
        "MiniModel manifest",
        MAXIMUM_MANIFEST_BYTES
      );
      if (!Array.isArray(peerImportRequests) || peerImportRequests.length < 1 || peerImportRequests.length > 2) {
        throw new TypeError("companion import requires one or two peer request documents");
      }
      const requests = peerImportRequests.map((value) =>
        requireUtf8Text(value, "peer import request", MAXIMUM_PEER_REQUEST_BYTES)
      );
      return requestJson(this, "/v1/imports", {
        method: "POST",
        mutation: true,
        body: {
          manifest_text: manifest,
          peer_import_requests: requests
        },
        signal: options && options.signal
      });
    }

    async getImport(operationId, options) {
      const id = requireOperationId(operationId);
      return requestJson(this, `/v1/imports/${id}`, {
        method: "GET",
        signal: options && options.signal
      });
    }

    async cancelImport(operationId, options) {
      const id = requireOperationId(operationId);
      return requestJson(this, `/v1/imports/${id}/cancel`, {
        method: "POST",
        mutation: true,
        body: {},
        signal: options && options.signal
      });
    }

    async getSharing(options) {
      requireGrantedScope(this, "sharing_manage");
      const value = await requestJson(this, "/v1/sharing", {
        method: "GET",
        signal: options && options.signal
      });
      return validateSharingStatus(value);
    }

    async initializeSharing(fleetId, options) {
      requireGrantedScope(this, "sharing_manage");
      const id = requireStableId(fleetId, "sharing fleet ID");
      const value = await requestJson(this, "/v1/sharing/initialize", {
        method: "POST",
        mutation: true,
        body: { fleet_id: id },
        signal: options && options.signal
      });
      return validateSharingStatus(value);
    }

    async admitImportForSharing(operationId, laneEndpoints, options) {
      requireGrantedScope(this, "sharing_manage");
      const id = requireOperationId(operationId);
      const endpoints = normalizeSharingEndpoints(laneEndpoints);
      const value = await requestJson(this, `/v1/sharing/imports/${id}/admit`, {
        method: "POST",
        mutation: true,
        body: { lane_endpoints: endpoints },
        signal: options && options.signal
      });
      return validateSharingStatus(value);
    }

    async setImportSharingEnabled(operationId, enabled, options) {
      requireGrantedScope(this, "sharing_manage");
      const id = requireOperationId(operationId);
      if (typeof enabled !== "boolean") {
        throw new TypeError("sharing enabled state is invalid");
      }
      const action = enabled ? "enable" : "disable";
      const value = await requestJson(this, `/v1/sharing/imports/${id}/${action}`, {
        method: "POST",
        mutation: true,
        body: {},
        signal: options && options.signal
      });
      return validateSharingStatus(value);
    }

    async removeImportFromSharing(operationId, options) {
      requireGrantedScope(this, "sharing_manage");
      const id = requireOperationId(operationId);
      const value = await requestJson(this, `/v1/sharing/imports/${id}/remove`, {
        method: "POST",
        mutation: true,
        body: {},
        signal: options && options.signal
      });
      return validateSharingStatus(value);
    }

    async streamModel(operationId, options) {
      const id = requireOperationId(operationId);
      const source = options && typeof options === "object" ? options : {};
      const expectedByteCount = Number(source.expectedByteCount);
      if (
        !Number.isSafeInteger(expectedByteCount) ||
        expectedByteCount <= 0 ||
        expectedByteCount > MAXIMUM_MODEL_STREAM_BYTES
      ) {
        throw new TypeError("expected model byte count is invalid");
      }
      const expectedArtifactSha256 = requireText(
        source.expectedArtifactSha256,
        "expected artifact SHA-256",
        96
      ).toLowerCase();
      if (typeof source.onChunk !== "function") {
        throw new TypeError("model stream requires an onChunk function");
      }
      const response = await sendRequest(this, `/v1/models/${id}/content`, {
        method: "GET",
        signal: source.signal,
        timeoutMilliseconds: modelStreamTimeoutMilliseconds(expectedByteCount)
      });
      await requireSuccess(this, response);
      const contentType = String(response.headers.get("Content-Type") || "").toLowerCase();
      const contentLength = Number(response.headers.get("Content-Length"));
      const artifactSha256 = String(
        response.headers.get("X-TinyRustLM-Artifact-Sha256") || ""
      ).toLowerCase();
      const modelId = requireText(
        response.headers.get("X-TinyRustLM-Model-Id"),
        "streamed model identity",
        180
      );
      if (!contentType.startsWith("application/octet-stream")) {
        throw new CompanionBridgeError(
          "bridge_model_content_type_invalid",
          "The companion model stream had an invalid content type."
        );
      }
      if (contentLength !== expectedByteCount) {
        throw new CompanionBridgeError(
          "bridge_model_byte_count_mismatch",
          "The companion model byte count disagreed with the selected catalog identity."
        );
      }
      if (artifactSha256 !== expectedArtifactSha256) {
        throw new CompanionBridgeError(
          "bridge_model_identity_mismatch",
          "The companion model SHA-256 identity disagreed with the selected catalog model."
        );
      }
      let offset = 0;
      if (response.body && typeof response.body.getReader === "function") {
        const reader = response.body.getReader();
        try {
          while (true) {
            const result = await reader.read();
            if (result.done) {
              break;
            }
            const chunk = result.value instanceof Uint8Array
              ? result.value
              : new Uint8Array(result.value);
            if (offset + chunk.byteLength > expectedByteCount) {
              throw new CompanionBridgeError(
                "bridge_model_byte_count_mismatch",
                "The companion model stream exceeded its receipt byte count."
              );
            }
            await source.onChunk(chunk, offset);
            offset += chunk.byteLength;
          }
        } finally {
          reader.releaseLock();
        }
      } else {
        const chunk = new Uint8Array(await response.arrayBuffer());
        if (chunk.byteLength > expectedByteCount) {
          throw new CompanionBridgeError(
            "bridge_model_byte_count_mismatch",
            "The companion model stream exceeded its receipt byte count."
          );
        }
        await source.onChunk(chunk, 0);
        offset = chunk.byteLength;
      }
      if (offset !== expectedByteCount) {
        throw new CompanionBridgeError(
          "bridge_model_byte_count_mismatch",
          "The companion model stream ended before its receipt byte count."
        );
      }
      return { operationId: id, modelId, artifactSha256, byteCount: offset };
    }

    async revoke(options) {
      if (!this.isPaired) {
        return false;
      }
      try {
        await requestEmpty(this, "/v1/session/revoke", {
          method: "POST",
          mutation: true,
          body: {},
          signal: options && options.signal
        });
      } finally {
        const state = stateOf(this);
        clearCapability(state);
        broadcastState(state, "unpaired");
      }
      return true;
    }

    close() {
      const state = stateOf(this);
      clearCapability(state);
      if (state.ownsChannel && state.channel && typeof state.channel.close === "function") {
        state.channel.close();
      }
      state.channel = null;
    }
  }

  async function requestJson(client, path, options) {
    const response = await sendRequest(client, path, options);
    await requireSuccess(client, response);
    return readJsonResponse(response);
  }

  async function readJsonResponse(response) {
    const length = Number(response.headers.get("Content-Length"));
    if (Number.isFinite(length) && length > MAXIMUM_JSON_BYTES) {
      throw new CompanionBridgeError(
        "bridge_response_too_large",
        "The companion JSON response exceeded its browser boundary."
      );
    }
    const text = await response.text();
    if (utf8Length(text) > MAXIMUM_JSON_BYTES) {
      throw new CompanionBridgeError(
        "bridge_response_too_large",
        "The companion JSON response exceeded its browser boundary."
      );
    }
    try {
      return JSON.parse(text);
    } catch (_error) {
      throw new CompanionBridgeError(
        "bridge_response_invalid",
        "The companion returned invalid JSON."
      );
    }
  }

  async function requestEmpty(client, path, options) {
    const response = await sendRequest(client, path, options);
    await requireSuccess(client, response);
    return true;
  }

  async function sendRequest(client, path, options) {
    const state = stateOf(client);
    const source = options && typeof options === "object" ? options : {};
    const authenticated = source.authenticated !== false;
    if (authenticated && !client.isPaired) {
      throw new CompanionBridgeError(
        "bridge_pairing_required",
        "Pair this browser with the local companion before continuing."
      );
    }
    if (authenticated && !source.skipRotation) {
      await ensureRotated(client, source.signal);
    }
    const headers = { [PROTOCOL_HEADER]: PROTOCOL_VERSION };
    if (authenticated) {
      headers[CAPABILITY_HEADER] = state.capability;
    }
    if (source.mutation) {
      headers[REQUEST_ID_HEADER] = createRequestId();
    }
    let body;
    if (Object.prototype.hasOwnProperty.call(source, "body")) {
      body = JSON.stringify(source.body);
      if (utf8Length(body) > MAXIMUM_REQUEST_JSON_BYTES) {
        throw new CompanionBridgeError(
          "bridge_request_too_large",
          "The companion request exceeded its browser byte boundary."
        );
      }
      headers["Content-Type"] = "application/json";
    }
    const timeoutMilliseconds = Object.prototype.hasOwnProperty.call(source, "timeoutMilliseconds")
      ? boundedOperationTimeout(source.timeoutMilliseconds)
      : state.timeoutMilliseconds;
    const requestSignal = timeoutSignal(source.signal, timeoutMilliseconds);
    try {
      return await state.fetch(new URL(path.replace(/^\/+/, ""), state.endpoint).toString(), {
        method: source.method || "GET",
        headers,
        body,
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal: requestSignal.signal
      });
    } catch (error) {
      if (requestSignal.signal.aborted) {
        throw new CompanionBridgeError(
          "bridge_request_cancelled",
          "The local companion request was cancelled or timed out."
        );
      }
      throw new CompanionBridgeError(
        "bridge_unavailable",
        "The TinyRustLM companion is not reachable on IPv4 loopback."
      );
    } finally {
      requestSignal.dispose();
    }
  }

  async function ensureRotated(client, signal) {
    const state = stateOf(client);
    const expires = Date.parse(state.capabilityExpiresUtc);
    if (
      !Number.isFinite(expires) ||
      expires - Date.now() > CAPABILITY_ROTATION_WINDOW_MILLISECONDS
    ) {
      return;
    }
    if (!state.rotationPromise) {
      state.rotationPromise = rotateCapability(client, signal).finally(() => {
        state.rotationPromise = null;
      });
    }
    await state.rotationPromise;
  }

  async function rotateCapability(client, signal) {
    const state = stateOf(client);
    const previousScopes = state.scopes.slice();
    const response = await sendRequest(client, "/v1/session/rotate", {
      method: "POST",
      mutation: true,
      body: {},
      signal,
      skipRotation: true
    });
    await requireSuccess(client, response);
    const value = await readJsonResponse(response);
    const capability = requireText(value && value.capability, "bridge capability", 2048);
    const expiresUtc = requireText(value && value.expires_utc, "capability expiry", 64);
    const scopes = normalizeScopes(value && value.scopes || []);
    if (
      !Number.isFinite(Date.parse(expiresUtc)) ||
      scopes.length !== previousScopes.length ||
      previousScopes.some((scope) => !scopes.includes(scope))
    ) {
      clearCapability(state);
      throw new CompanionBridgeError(
        "bridge_rotation_invalid",
        "The companion returned an invalid rotated capability."
      );
    }
    state.capability = capability;
    state.capabilityExpiresUtc = expiresUtc;
    state.scopes = scopes;
    broadcastState(state, "rotated");
  }

  async function requireSuccess(client, response) {
    if (response && response.ok) {
      return;
    }
    const status = response && Number(response.status) || 0;
    let code = "bridge_request_failed";
    let message = `The local companion request failed${status ? ` with HTTP ${status}` : ""}.`;
    try {
      const text = await response.text();
      if (utf8Length(text) <= MAXIMUM_JSON_BYTES) {
        const value = JSON.parse(text);
        if (value && value.error) {
          code = String(value.error.code || code).slice(0, 128);
          message = String(value.error.message || message).slice(0, 1024);
        }
      }
    } catch (_error) {
      // Keep the bounded generic error; never echo arbitrary non-JSON loopback content.
    }
    if (status === 401) {
      clearCapability(stateOf(client));
    }
    throw new CompanionBridgeError(code, message, status);
  }

  function timeoutSignal(parent, timeoutMilliseconds) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (parent) {
      if (parent.aborted) {
        controller.abort();
      } else {
        parent.addEventListener("abort", abort, { once: true });
      }
    }
    const timer = setTimeout(abort, timeoutMilliseconds);
    return {
      signal: controller.signal,
      dispose() {
        clearTimeout(timer);
        if (parent) {
          parent.removeEventListener("abort", abort);
        }
      }
    };
  }

  function normalizeEndpoint(value) {
    let url;
    try {
      url = new URL(String(value || ""));
    } catch (_error) {
      throw new TypeError("companion endpoint is invalid");
    }
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1") {
      throw new TypeError("companion endpoint must use exact HTTP IPv4 loopback");
    }
    if (url.username || url.password) {
      throw new TypeError("companion endpoint must not contain credentials");
    }
    if (url.search) {
      throw new TypeError("companion endpoint must not contain a query");
    }
    if (url.hash || url.pathname !== "/" || !url.port) {
      throw new TypeError("companion endpoint must use one explicit root port without a fragment");
    }
    const port = Number(url.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new TypeError("companion endpoint port is invalid");
    }
    return url.toString();
  }

  function normalizeScopes(values) {
    if (!Array.isArray(values) || !values.length || values.length > 16) {
      throw new TypeError("companion scopes are invalid");
    }
    const allowed = new Set([...DEFAULT_SCOPES, "sharing_manage"]);
    const result = [];
    for (const value of values) {
      const scope = requireText(value, "companion scope", 64);
      if (!allowed.has(scope) || result.includes(scope)) {
        throw new TypeError("companion scopes are invalid");
      }
      result.push(scope);
    }
    return result;
  }

  function requireGrantedScope(client, scope) {
    if (!client.hasScope(scope)) {
      throw new CompanionBridgeError(
        "bridge_scope_not_granted",
        "Pair this browser again and explicitly approve local P2P sharing control."
      );
    }
  }

  function requireStableId(value, label) {
    const result = requireText(value, label, 64);
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(result)) {
      throw new TypeError(`${label} is invalid`);
    }
    return result;
  }

  function normalizeSharingEndpoints(values) {
    if (!Array.isArray(values) || values.length !== 2) {
      throw new TypeError("sharing requires exactly two lane endpoints");
    }
    const laneIds = new Set();
    return values.map((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError("sharing lane endpoint is invalid");
      }
      const laneId = requireStableId(value.laneId, "sharing lane ID");
      if (laneIds.has(laneId)) {
        throw new TypeError("sharing lane IDs must be unique");
      }
      laneIds.add(laneId);
      const bindAddress = requireText(value.bindAddress, "sharing bind address", 128);
      const publicBaseUrl = normalizePeerEndpoint(value.publicBaseUrl);
      return {
        lane_id: laneId,
        bind_address: bindAddress,
        public_base_url: publicBaseUrl
      };
    });
  }

  function normalizePeerEndpoint(value) {
    let url;
    try {
      url = new URL(requireText(value, "sharing public peer URL", 2048));
    } catch (error) {
      if (error instanceof TypeError && /sharing public peer URL/.test(error.message)) {
        throw error;
      }
      throw new TypeError("sharing public peer URL is invalid");
    }
    if (
      url.protocol !== "http:" ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new TypeError("sharing public peer URL must be credential-free direct HTTP");
    }
    const host = url.hostname.replace(/\.$/, "").toLowerCase();
    const forbidden = [
      "tinyrustlm.com",
      "minimodel.org",
      "uaix.org",
      "memoryendpoints.com",
      "huggingface.co",
      "mirust.com",
      "slmcomposer.com",
      "lmcomposer.com"
    ];
    if (forbidden.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
      throw new TypeError("project and model hosts cannot be model-byte peer endpoints");
    }
    return url.toString();
  }

  function validateSharingStatus(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new CompanionBridgeError(
        "bridge_response_invalid",
        "The companion sharing response was invalid."
      );
    }
    const allowedRootKeys = new Set([
      "sharing_enabled",
      "initialized",
      "fleet_id",
      "target_model_count",
      "admitted_model_count",
      "remaining_model_capacity",
      "replica_lane_count",
      "advertisement_status",
      "models"
    ]);
    const allowedModelKeys = new Set([
      "operation_id",
      "model_id",
      "enabled",
      "announcement_state"
    ]);
    const models = value.models;
    const integers = [
      value.target_model_count,
      value.admitted_model_count,
      value.remaining_model_capacity,
      value.replica_lane_count
    ];
    if (
      Object.keys(value).some((key) => !allowedRootKeys.has(key)) ||
      typeof value.sharing_enabled !== "boolean" ||
      typeof value.initialized !== "boolean" ||
      !integers.every((item) => Number.isSafeInteger(item) && item >= 0) ||
      value.target_model_count !== 20 ||
      value.replica_lane_count !== 2 ||
      !Array.isArray(models) ||
      models.length > 20 ||
      value.admitted_model_count !== models.length ||
      value.remaining_model_capacity !== 20 - models.length
    ) {
      throw new CompanionBridgeError(
        "bridge_response_invalid",
        "The companion sharing response failed its bounded fleet contract."
      );
    }
    if (value.initialized) {
      requireStableId(value.fleet_id, "sharing fleet ID");
    } else if (value.fleet_id !== null && value.fleet_id !== undefined) {
      throw new CompanionBridgeError(
        "bridge_response_invalid",
        "An uninitialized sharing response named a fleet identity."
      );
    }
    requireText(value.advertisement_status, "sharing advertisement status", 96);
    for (const model of models) {
      if (
        !model ||
        typeof model !== "object" ||
        Array.isArray(model) ||
        Object.keys(model).some((key) => !allowedModelKeys.has(key)) ||
        typeof model.enabled !== "boolean"
      ) {
        throw new CompanionBridgeError(
          "bridge_response_invalid",
          "A companion sharing model entry was invalid."
        );
      }
      if (model.operation_id !== null && model.operation_id !== undefined) {
        requireOperationId(model.operation_id);
      }
      requireText(model.model_id, "sharing model ID", 180);
      requireText(model.announcement_state, "sharing announcement state", 96);
    }
    return value;
  }

  function requireOperationId(value) {
    const result = String(value || "");
    if (!operationIdPattern.test(result)) {
      throw new TypeError("companion import operation ID is invalid");
    }
    return result;
  }

  function requireText(value, label, maximumCharacters) {
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value.length > maximumCharacters ||
      /[\u0000-\u001f\u007f]/.test(value)
    ) {
      throw new TypeError(`${label} is invalid`);
    }
    return value;
  }

  function requireUtf8Text(value, label, maximumBytes) {
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value.length > maximumBytes ||
      /[\u0000\u000b\u000c\u000e-\u001f\u007f]/.test(value)
    ) {
      throw new TypeError(`${label} is invalid`);
    }
    const result = value;
    if (utf8Length(result) > maximumBytes) {
      throw new RangeError(`${label} exceeds its UTF-8 byte boundary`);
    }
    return result;
  }

  function utf8Length(value) {
    if (typeof TextEncoder === "function") {
      return new TextEncoder().encode(value).byteLength;
    }
    return unescape(encodeURIComponent(value)).length;
  }

  function createRequestId() {
    const cryptoApi = typeof globalThis !== "undefined" ? globalThis.crypto : null;
    if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
      return cryptoApi.randomUUID();
    }
    if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      cryptoApi.getRandomValues(bytes);
      return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
    }
    throw new CompanionBridgeError(
      "bridge_secure_random_unavailable",
      "Secure random request identities are unavailable in this browser."
    );
  }

  function boundedTimeout(value) {
    if (value === undefined || value === null) {
      return 10000;
    }
    const result = Number(value);
    if (!Number.isInteger(result) || result < 1000 || result > 120000) {
      throw new TypeError("companion request timeout is invalid");
    }
    return result;
  }

  function boundedOperationTimeout(value) {
    const result = Number(value);
    if (
      !Number.isInteger(result) ||
      result < 1000 ||
      result > MAXIMUM_MODEL_STREAM_TIMEOUT_MILLISECONDS
    ) {
      throw new TypeError("companion operation timeout is invalid");
    }
    return result;
  }

  function modelStreamTimeoutMilliseconds(byteCount) {
    const bytes = Number(byteCount);
    if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > MAXIMUM_MODEL_STREAM_BYTES) {
      throw new TypeError("expected model byte count is invalid");
    }
    const transferMilliseconds = Math.ceil(
      bytes * 1000 / MODEL_STREAM_MINIMUM_BYTES_PER_SECOND
    );
    return Math.max(
      MINIMUM_MODEL_STREAM_TIMEOUT_MILLISECONDS,
      Math.min(
        MAXIMUM_MODEL_STREAM_TIMEOUT_MILLISECONDS,
        MODEL_STREAM_STARTUP_ALLOWANCE_MILLISECONDS + transferMilliseconds
      )
    );
  }

  function broadcastState(state, nextState) {
    if (!state.channel || typeof state.channel.postMessage !== "function") {
      return;
    }
    state.channel.postMessage({
      kind: "tinyrustlm.companion_state.v1",
      state: nextState,
      at: new Date().toISOString()
    });
  }

  function clearCapability(state) {
    state.capability = "";
    state.capabilityExpiresUtc = "";
    state.scopes = [];
  }

  function stateOf(client) {
    const value = privateState.get(client);
    if (!value) {
      throw new TypeError("invalid companion bridge client");
    }
    return value;
  }

  return Object.freeze({
    CompanionBridgeClient,
    CompanionBridgeError,
    DEFAULT_ENDPOINT,
    DEFAULT_SCOPES,
    MAXIMUM_REQUEST_JSON_BYTES,
    MAXIMUM_MODEL_STREAM_BYTES,
    MINIMUM_MODEL_STREAM_TIMEOUT_MILLISECONDS,
    MAXIMUM_MODEL_STREAM_TIMEOUT_MILLISECONDS,
    modelStreamTimeoutMilliseconds,
    PROTOCOL_HEADER,
    CAPABILITY_HEADER,
    REQUEST_ID_HEADER
  });
}));
