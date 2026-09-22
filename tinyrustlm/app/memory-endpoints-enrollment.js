(function (root, factory) {
  "use strict";

  const lifetimeApi = typeof module === "object" && module.exports
    ? require("./operation-lifetime.js") : root.TinyRustLMOperationLifetime;
  const httpApi = typeof module === "object" && module.exports
    ? require("./memory-endpoints-http.js") : root.TinyRustLMMemoryEndpointsHttp;
  const api = factory(lifetimeApi, httpApi);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.TinyRustLMMemoryEndpointsEnrollment = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (lifetimeApi, httpApi) {
  "use strict";

  const contractSchema = "memoryendpoints.single_agent_enrollment_contract.v1";
  const connectorContractPath = "/api/matm/connector-contract";
  const maximumResponseBytes = 1024 * 1024;
  const maximumResponseChunks = 4096;
  const defaultTimeoutMilliseconds = 30_000;
  const maximumTimeoutMilliseconds = 120_000;
  const requiredFlags = Object.freeze([
    "singleUseUrl",
    "postClaimOnly",
    "atomicOneWinner",
    "lostResponseIdempotentRecovery",
    "agentScopedToken",
    "workspaceHiddenOnReconnect",
    "virtualUaiStartupRestore",
    "shortTermRestore",
    "longTermRestore"
  ]);
  const requiredRoutes = Object.freeze([
    "createCompany",
    "issueInvitation",
    "claimInvitation",
    "reconnect",
    "closeCompany",
    "deleteCompany"
  ]);

  class MemoryEndpointsEnrollmentError extends Error {
    constructor(code, message, options) {
      super(message);
      this.name = "MemoryEndpointsEnrollmentError";
      this.code = code;
      this.status = options && Number.isInteger(options.status) ? options.status : 0;
      this.safeNoOp = Boolean(options && options.safeNoOp);
      this.externalPrerequisite = Boolean(options && options.externalPrerequisite);
    }
  }

  function enrollmentError(code, message, options) {
    return new MemoryEndpointsEnrollmentError(code, message, options);
  }

  function normalizeBaseUrl(value) {
    let url;
    try {
      url = new URL(String(value || "").trim());
    } catch (_error) {
      throw enrollmentError("invalid_service_url", "MemoryEndpoints URL must be absolute");
    }
    const loopbackHttp = url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "::1" || url.hostname === "localhost");
    if (url.protocol !== "https:" && !loopbackHttp) {
      throw enrollmentError(
        "invalid_service_url",
        "MemoryEndpoints URL must use HTTPS except for a loopback test service"
      );
    }
    if (url.username || url.password || url.search || url.hash) {
      throw enrollmentError(
        "invalid_service_url",
        "MemoryEndpoints URL must not contain credentials, query, or fragment data"
      );
    }
    return url.origin;
  }

  function normalizeIdentifier(value, label, maximumLength) {
    const text = String(value || "").trim();
    if (!text || text.length > maximumLength || !/^[A-Za-z0-9._-]+$/.test(text)) {
      throw enrollmentError("invalid_identity", `${label} is invalid`);
    }
    return text;
  }

  function normalizeIdempotencyKey(value) {
    const text = String(value || "").trim();
    if (!text || text.length > 200 || !/^[A-Za-z0-9._:-]+$/.test(text)) {
      throw enrollmentError("invalid_idempotency_key", "Idempotency key is invalid");
    }
    return text;
  }

  function resolveRoute(baseUrl, route, label) {
    const text = String(route || "");
    if (
      !text.startsWith("/api/matm/") ||
      text.includes("\\") ||
      text.includes("?") ||
      text.includes("#") ||
      text.split("/").includes("..")
    ) {
      throw enrollmentError("unsafe_contract_route", `${label} is not a safe MATM route`);
    }
    const resolved = new URL(text, baseUrl);
    if (resolved.origin !== baseUrl) {
      throw enrollmentError("unsafe_contract_route", `${label} is not a safe MATM route`);
    }
    return text;
  }

  function requireObject(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw enrollmentError("invalid_response", `${label} is missing a JSON object`);
    }
    return value;
  }

  function assertRedacted(value, label) {
    const object = requireObject(value, label);
    if (object.rawCredentialExposed === true || object.rawPayloadExposed === true) {
      throw enrollmentError("enrollment_redaction_failed", `${label} failed its redaction contract`);
    }
  }

  function responseErrorCode(value, fallback) {
    if (value && value.error && typeof value.error.code === "string" && value.error.code.trim()) {
      return value.error.code.trim().slice(0, 128);
    }
    if (value && typeof value.code === "string" && value.code.trim()) {
      return value.code.trim().slice(0, 128);
    }
    return fallback;
  }

  function safeResponseErrorMessage(code, status) {
    if (code === "enrollment_url_consumed" || code === "enrollment_url_expired") {
      return "This one-time agent URL has already been used or expired";
    }
    if (code === "agent_authentication_failed" || status === 401 || status === 403) {
      return "The agent name or token was not accepted";
    }
    return `MemoryEndpoints enrollment returned HTTP ${status}`;
  }

  const cancelBody = httpApi.cancelBody;

  /** Keep enrollment's public error contract and one-MiB limit on the shared reader. */
  function boundedJson(response, label, lifetime) {
    return httpApi.readJsonResponse(response, { label, lifetime, error: enrollmentError,
      maximumResponseBytes, maximumResponseChunks });
  }

  function normalizeContract(payload, baseUrl) {
    assertRedacted(payload, "connector contract");
    const data = requireObject(payload.data, "connector contract data");
    if (!data.singleAgentEnrollment) {
      throw enrollmentError(
        "enrollment_contract_missing",
        "MemoryEndpoints does not currently advertise single-agent enrollment",
        { externalPrerequisite: true }
      );
    }
    const contract = requireObject(data.singleAgentEnrollment, "single-agent enrollment contract");
    if (contract.schemaVersion !== contractSchema || contract.status !== "live") {
      throw enrollmentError(
        "enrollment_contract_not_live",
        "MemoryEndpoints single-agent enrollment is not live",
        { externalPrerequisite: true }
      );
    }
    for (const flag of requiredFlags) {
      if (contract[flag] !== true) {
        throw enrollmentError(
          "enrollment_contract_incomplete",
          `MemoryEndpoints enrollment contract is missing ${flag}`,
          { externalPrerequisite: true }
        );
      }
    }
    const advertisedRoutes = requireObject(contract.routes, "single-agent enrollment routes");
    const routes = {};
    for (const name of requiredRoutes) {
      routes[name] = resolveRoute(baseUrl, advertisedRoutes[name], `${name} route`);
    }
    return Object.freeze({
      schemaVersion: contract.schemaVersion,
      status: contract.status,
      routes: Object.freeze(routes)
    });
  }

  function normalizeInvitationUrl(value, baseUrl) {
    let url;
    try {
      url = new URL(String(value || "").trim());
    } catch (_error) {
      throw enrollmentError("invalid_invitation_url", "Enrollment URL is invalid");
    }
    if (url.origin !== baseUrl || (url.protocol !== "https:" && !url.hostname.match(/^(127\.0\.0\.1|localhost|::1)$/))) {
      throw enrollmentError("invalid_invitation_url", "Enrollment URL must come from this MemoryEndpoints service");
    }
    if (url.username || url.password || url.hash || url.href.length < 32 || url.href.length > 4096) {
      throw enrollmentError("invalid_invitation_url", "Enrollment URL is invalid");
    }
    return url.href;
  }

  class MemoryEndpointsEnrollmentClient {
    /** Bind the service, Fetch implementation and finite budget; retain only a completed contract. */
    constructor(options) {
      const settings = options || {};
      this.baseUrl = normalizeBaseUrl(settings.baseUrl);
      this.fetch = settings.fetch || (typeof fetch === "function" ? fetch.bind(globalThis) : null);
      if (typeof this.fetch !== "function") {
        throw enrollmentError("fetch_unavailable", "Fetch is required for MemoryEndpoints enrollment");
      }
      this.timeoutMilliseconds = settings.timeoutMilliseconds === undefined
        ? defaultTimeoutMilliseconds : settings.timeoutMilliseconds;
      if (!Number.isInteger(this.timeoutMilliseconds) || this.timeoutMilliseconds < 1 ||
          this.timeoutMilliseconds > maximumTimeoutMilliseconds) {
        throw enrollmentError("invalid_timeout", "Enrollment timeout must be between 1 and 120000 milliseconds");
      }
      this.contract = null;
    }

    /** Keep discovery and its dependent mutation under the same cancellation/deadline owner. */
    async #operation(options, action) {
      const signal = options && options.signal;
      if (signal !== undefined && (!signal || typeof signal.aborted !== "boolean" ||
          typeof signal.addEventListener !== "function" || typeof signal.removeEventListener !== "function")) {
        throw enrollmentError("invalid_signal", "Enrollment cancellation signal is invalid");
      }
      const unavailable = enrollmentError("enrollment_unavailable", "Enrollment request lifetime is unavailable");
      if (!lifetimeApi || typeof lifetimeApi.create !== "function") throw unavailable;
      const lifetime = lifetimeApi.create({ signal, timeoutMilliseconds: this.timeoutMilliseconds,
        optionsError: unavailable,
        abortError: enrollmentError("enrollment_cancelled", "MemoryEndpoints enrollment was cancelled"),
        timeoutError: enrollmentError("enrollment_timeout", "MemoryEndpoints enrollment timed out") });
      let failure;
      try { return await lifetime.wait(() => action(lifetime)); }
      catch (error) {
        failure = error instanceof MemoryEndpointsEnrollmentError ? error
          : enrollmentError("enrollment_network_error", "MemoryEndpoints enrollment request failed");
        throw failure;
      } finally { lifetime.dispose(failure); }
    }

    /** Expose a finite request for callers that already know their current enrollment route. */
    async request(method, route, options) {
      return this.#operation(options, lifetime => this.#requestWithin(method, route, options, lifetime));
    }

    /** Transfer and validate one response; discard a late Fetch response after cancellation. */
    async #requestWithin(method, route, options, lifetime) {
      const settings = options || {};
      const headers = {
        Accept: "application/json",
        ...(settings.headers || {})
      };
      let body;
      if (settings.payload !== undefined) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(settings.payload);
      }
      let response;
      try {
        response = await lifetime.wait(() => Promise.resolve(this.fetch(`${this.baseUrl}${route}`, {
          method,
          cache: "no-store",
          credentials: "omit",
          redirect: "error",
          headers,
          body,
          signal: lifetime.signal
        })).then(value => {
          if (lifetime.signal.aborted) cancelBody(value && value.body);
          return value;
        }));
      } catch (error) {
        if (error instanceof MemoryEndpointsEnrollmentError) throw error;
        throw enrollmentError("enrollment_network_error", "MemoryEndpoints enrollment request failed");
      }
      const payload = await boundedJson(response, settings.label || "MemoryEndpoints enrollment", lifetime);
      assertRedacted(payload, settings.label || "MemoryEndpoints enrollment");
      const allowed = Array.isArray(settings.allowedStatuses)
        ? settings.allowedStatuses
        : [200];
      if (!allowed.includes(response.status)) {
        const code = responseErrorCode(payload, "enrollment_request_failed");
        throw enrollmentError(code, safeResponseErrorMessage(code, response.status), {
          status: response.status,
          safeNoOp: payload.safeNoOp === true
        });
      }
      return Object.freeze({ status: response.status, payload });
    }

    /** Cache successful discovery only; concurrent callers own independent cancellable requests. */
    async #discoverWithin(lifetime) {
      if (!this.contract) {
        const result = await this.#requestWithin("GET", connectorContractPath, {
          label: "connector contract",
          allowedStatuses: [200]
        }, lifetime);
        this.contract = await lifetime.wait(() => normalizeContract(result.payload, this.baseUrl));
      }
      return this.contract;
    }

    /** Discover without starting an enrollment mutation. */
    async discover(options) {
      return this.#operation(options, lifetime => this.#discoverWithin(lifetime));
    }

    /** Claim at most once in this call; cancellation never retries a possibly committed POST. */
    async claim(options) {
      const settings = options || {};
      return this.#operation(settings, lifetime => this.#claimWithin(settings, lifetime));
    }

    /** Validate the caller before discovery and accept only the server's persisted claim. */
    async #claimWithin(settings, lifetime) {
      const invitationUrl = normalizeInvitationUrl(settings.invitationUrl, this.baseUrl);
      const agreedAgentName = normalizeIdentifier(settings.agreedAgentName, "Agent name", 96);
      const idempotencyKey = normalizeIdempotencyKey(settings.idempotencyKey);
      const contract = await this.#discoverWithin(lifetime);
      const result = await this.#requestWithin("POST", contract.routes.claimInvitation, {
        label: "enrollment claim",
        headers: { "Idempotency-Key": idempotencyKey },
        payload: { invitationUrl, agreedAgentName },
        allowedStatuses: [200, 201]
      }, lifetime);
      const value = result.payload;
      if (value.persisted !== true || value.urlConsumed !== true) {
        throw enrollmentError("claim_not_persisted", "Enrollment claim was not atomically persisted");
      }
      const canonicalAgentName = normalizeIdentifier(
        value.canonicalAgentName,
        "Canonical agent name",
        96
      );
      const agentToken = String(value.agentToken || "");
      if (agentToken.length < 24 || agentToken.length > 4096 || /\s/.test(agentToken)) {
        throw enrollmentError("invalid_agent_token", "Enrollment returned an invalid agent token");
      }
      return Object.freeze({
        canonicalAgentName,
        agentToken,
        claimReceiptId: String(value.claimReceiptId || value.receiptId || "").slice(0, 128)
      });
    }

    /** Reconnect by the selected agent identity under one finite discovery/restore operation. */
    async reconnect(options) {
      const settings = options || {};
      return this.#operation(settings, lifetime => this.#reconnectWithin(settings, lifetime));
    }

    /** Validate agent/token input and require a complete restore bound to that same agent. */
    async #reconnectWithin(settings, lifetime) {
      const canonicalAgentName = normalizeIdentifier(
        settings.canonicalAgentName,
        "Canonical agent name",
        96
      );
      const agentToken = String(settings.agentToken || "").trim();
      if (agentToken.length < 24 || agentToken.length > 4096 || /\s/.test(agentToken)) {
        throw enrollmentError("invalid_agent_token", "Agent token is invalid");
      }
      const contract = await this.#discoverWithin(lifetime);
      const result = await this.#requestWithin("POST", contract.routes.reconnect, {
        label: "agent reconnect",
        headers: { Authorization: `Bearer ${agentToken}` },
        payload: { agentName: canonicalAgentName },
        allowedStatuses: [200]
      }, lifetime);
      const value = result.payload;
      const returnedAgentName = normalizeIdentifier(
        value.canonicalAgentName,
        "Canonical agent name",
        96
      );
      const workspaceId = normalizeIdentifier(value.workspaceId, "Workspace identity", 128);
      if (returnedAgentName !== canonicalAgentName) {
        throw enrollmentError("agent_binding_mismatch", "Reconnect returned a different agent identity");
      }
      if (
        value.readyForStartup !== true ||
        value.shortTermRestored !== true ||
        value.longTermRestored !== true
      ) {
        throw enrollmentError("memory_restore_incomplete", "Reconnect did not restore short- and long-term memory");
      }
      return Object.freeze({
        canonicalAgentName: returnedAgentName,
        workspaceId,
        readyForStartup: true,
        shortTermRestored: true,
        longTermRestored: true
      });
    }
  }

  /** Own one browser-session enrollment attempt; no credentials or retry keys are persisted. */
  class MemoryEndpointsEnrollmentFlow {
    #client;
    #createKey;
    #pending = null;
    #controller = null;

    /** Bind a client and key factory without starting discovery or generating a claim key. */
    constructor({ client, createIdempotencyKey }) {
      if (!client || typeof client.claim !== "function" || typeof client.reconnect !== "function" ||
          typeof createIdempotencyKey !== "function") {
        throw enrollmentError("invalid_enrollment_flow", "Enrollment recovery support is unavailable");
      }
      this.#client = client;
      this.#createKey = createIdempotencyKey;
    }

    /** Both claim and reconnect controls share the same exclusive operation. */
    get busy() { return this.#controller !== null; }

    /** Discard session-only recovery on disconnect, authority changes or page exit. */
    cancel() {
      if (this.#controller) this.#controller.abort();
      this.#controller = null;
      this.#pending = null;
    }

    /** Reject obsolete completions before any credential or application-state mutation. */
    #check(signal) {
      if (signal.aborted) throw enrollmentError("enrollment_cancelled", "Enrollment was cancelled");
    }

    /** Serialize user actions and keep cancellation ownership through the activation callback. */
    async #run(action) {
      if (this.busy) throw enrollmentError("enrollment_busy", "Enrollment is already in progress");
      const controller = new AbortController();
      this.#controller = controller;
      try {
        await action(controller.signal);
        this.#check(controller.signal);
      } catch (error) {
        this.#check(controller.signal);
        throw error;
      } finally {
        if (this.#controller === controller) this.#controller = null;
      }
    }

    /** Retry explicitly with the exact original body/key; reuse credentials once claim succeeded. */
    async claim(settings) {
      return this.#run(async signal => {
        const name = normalizeIdentifier(settings.agreedAgentName, "Agent name", 96);
        const pending = this.#pending;
        if (pending) {
          if (pending.kind !== "claim" || pending.agreedAgentName !== name ||
              (settings.invitationUrl && normalizeInvitationUrl(settings.invitationUrl, this.#client.baseUrl) !== pending.invitationUrl)) {
            throw enrollmentError("pending_claim_mismatch", "Retry the original agent claim or clear web memory settings before starting another");
          }
        } else {
          this.#pending = {
            kind: "claim",
            invitationUrl: normalizeInvitationUrl(settings.invitationUrl, this.#client.baseUrl),
            agreedAgentName: name,
            idempotencyKey: normalizeIdempotencyKey(this.#createKey()),
            credentials: null
          };
        }
        const attempt = this.#pending;
        if (!attempt.credentials) {
          const credentials = await this.#client.claim({ invitationUrl: attempt.invitationUrl,
            agreedAgentName: attempt.agreedAgentName, idempotencyKey: attempt.idempotencyKey, signal });
          this.#check(signal);
          attempt.credentials = credentials;
        }
        if (settings.onCredentials) settings.onCredentials(attempt.credentials);
        this.#check(signal);
        await this.#restore(attempt.credentials, settings.onReady, signal);
        this.#check(signal);
        this.#pending = null;
      });
    }

    /** An explicit reconnect switches identity; a blank token retries that same pending reconnect. */
    async reconnect(settings) {
      return this.#run(async signal => {
        const canonicalAgentName = normalizeIdentifier(settings.canonicalAgentName, "Canonical agent name", 96);
        const agentToken = String(settings.agentToken || "").trim();
        if (agentToken) {
          if (agentToken.length < 24 || agentToken.length > 4096 || /\s/.test(agentToken)) {
            throw enrollmentError("invalid_agent_token", "Agent token is invalid");
          }
          this.#pending = { kind: "reconnect", credentials: { canonicalAgentName, agentToken } };
        } else if (!this.#pending || this.#pending.kind !== "reconnect" ||
                   this.#pending.credentials.canonicalAgentName !== canonicalAgentName) {
          throw enrollmentError("invalid_agent_token", "Agent token is required");
        }
        await this.#restore(this.#pending.credentials, settings.onReady, signal);
        this.#check(signal);
        this.#pending = null;
      });
    }

    /** Keep the caller's activation in the operation and check ownership on both sides of its await. */
    async #restore(credentials, onReady, signal) {
      const restored = await this.#client.reconnect({ ...credentials, signal });
      this.#check(signal);
      if (onReady) await onReady(Object.freeze({ ...restored, agentToken: credentials.agentToken }), signal);
      this.#check(signal);
    }
  }

  return Object.freeze({
    MemoryEndpointsEnrollmentClient,
    MemoryEndpointsEnrollmentFlow,
    MemoryEndpointsEnrollmentError,
    contractSchema,
    connectorContractPath,
    maximumResponseBytes,
    maximumResponseChunks,
    defaultTimeoutMilliseconds,
    maximumTimeoutMilliseconds,
    normalizeBaseUrl
  });
});
