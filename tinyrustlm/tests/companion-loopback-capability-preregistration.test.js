"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");
const test = require("node:test");

const { parseStrictJson } = require("../tools/strict-json.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot,
  "contracts/vnext/companion-loopback-capability-preregistration.v1.json");
const decisionPath = path.join(repositoryRoot,
  "docs/architecture/2026-08-24-companion-loopback-capability-preregistration.md");
const profileBytes = fs.readFileSync(profilePath);
const decisionBytes = fs.readFileSync(decisionPath);
const profile = parseStrictJson(profileBytes, { maximumBytes: 64 * 1024 });

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function gitBytesAt(commit, filePath) {
  return childProcess.execFileSync("git", ["show", `${commit}:${filePath}`], {
    cwd: repositoryRoot,
    encoding: "buffer",
    maxBuffer: 2 * 1024 * 1024
  });
}

function parentPathExists(commit, filePath) {
  const result = childProcess.spawnSync("git",
    ["cat-file", "-e", `${commit}:${filePath}`], {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true
    });
  return result.status === 0;
}

test("pins the output-free loopback capability registration", () => {
  assert.equal(profileBytes.length, 39311);
  assert.equal(sha256(profileBytes),
    "81e3f2f3795a51c0bce86e1aca66f6a7234608a3dd044cd7a9b1cbbf90c9ba77");
  assert.equal(decisionBytes.length, 23557);
  assert.equal(sha256(decisionBytes),
    "0c6708baec6f1cdbf401b2da5d4fa35372acaf126389c04f36384b3f6d4bc242");
  assert.equal(profile.schema,
    "tinyrustlm.companion-loopback-capability-preregistration.v1");
  assert.equal(profile.profileId,
    "tinyrustlm.companion.loopback-capability/1");
  assert.equal(profile.status,
    "registered-before-loopback-listener-browser-client-or-protocol-output");
  assert.equal(profile.registrationParentCommit,
    "480a22c58d1acedcb5e83d36bfa0ea75e43041b6");
  assert.equal(profile.registrationParentTree,
    "46f15125f6d9b02a6582dcdb78b0dd5641cc884b");
});

test("reconstructs every registered source byte from the parent commit", () => {
  assert.equal(profile.registeredSourceClosure.length, 18);
  for (const entry of profile.registeredSourceClosure) {
    const bytes = gitBytesAt(profile.registrationParentCommit, entry.path);
    assert.equal(bytes.length, entry.byteLength, entry.path);
    assert.equal(sha256(bytes), entry.sha256, entry.path);
  }
});

test("proves all registered implementation paths were absent before registration", () => {
  assert.equal(profile.implementationPlan.newPaths.length, 12);
  for (const filePath of profile.implementationPlan.newPaths) {
    assert.equal(parentPathExists(profile.registrationParentCommit, filePath), false,
      filePath);
  }
});

test("registers clean replacement of the superseded browser bridge", () => {
  assert.deepEqual(profile.implementationPlan.deletedSupersededPaths, [
    "tinyrustlm/app/companion-bridge.js",
    "tinyrustlm/tests/companion-bridge.test.js"
  ]);
  for (const filePath of profile.implementationPlan.deletedSupersededPaths) {
    assert.equal(parentPathExists(profile.registrationParentCommit, filePath), true,
      filePath);
  }
  for (const field of [
    "fixedPort43127Retained",
    "healthProbeRetained",
    "bearerCapabilityRetained",
    "broadcastChannelStateRetained",
    "oldRouteRetained",
    "oldGlobalApiRetained",
    "compatibilityAdapterRetained"
  ]) assert.equal(profile.implementationPlan[field], false, field);
});

test("freezes one exact numeric-loopback HTTP transport", () => {
  assert.equal(profile.transport.server, "ASP.NET-Core-8-Kestrel");
  assert.equal(profile.transport.wireProtocol, "HTTP/1.1");
  assert.equal(profile.transport.bindAddress, "127.0.0.1");
  assert.equal(profile.transport.bindPortSelection,
    "operating-system-assigned-ephemeral-port-zero");
  assert.equal(profile.transport.productionHostFormat,
    "127.0.0.1:{bound-port}");
  for (const field of [
    "http2Allowed", "http3Allowed", "webSocketAllowed",
    "webTransportAllowed", "tlsEnabled", "proxyModeAllowed",
    "forwardedHeadersAllowed", "responseCompressionAllowed",
    "serverHeaderAllowed", "ipv6Enabled", "localhostNameAllowed",
    "wildcardBindAllowed", "lanBindAllowed", "publicBindAllowed",
    "portScanAllowed", "fixedPortAllowed", "queryAllowed",
    "fragmentAllowed", "percentEncodedPathAllowed"
  ]) assert.equal(profile.transport[field], false, field);
  assert.equal(profile.transport.connectionCloseAfterEveryResponse, true);
});

test("keeps the pairing secret out of HTTP and durable state", () => {
  assert.equal(profile.endpointDiscovery.pairingCodeGrammar,
    "TRLC1:{decimal-port}:{base64url-no-padding-32-byte-secret}");
  assert.equal(profile.endpointDiscovery.pairingSecretBytes, 32);
  assert.equal(profile.endpointDiscovery.pairingCodeLifetimeSeconds, 300);
  for (const field of [
    "pairingSecretDurable", "pairingSecretSentInRequest",
    "pairingSecretSentInResponse", "pairingSecretInUrl",
    "pairingSecretInCommandLine", "pairingSecretInEnvironment",
    "pairingSecretInLog", "pairingSecretInBrowserStorage",
    "codeNormalizationAllowed", "dnsDiscoveryAllowed",
    "wellKnownPortAllowed", "browserLoopbackProbeBeforeUserActionAllowed",
    "browserStartupLoopbackRequestAllowed"
  ]) assert.equal(profile.endpointDiscovery[field], false, field);
});

test("freezes proof-of-possession pairing and session-key nontransmission", () => {
  assert.equal(profile.cryptography.digest, "SHA-256");
  assert.equal(profile.cryptography.messageAuthentication, "HMAC-SHA-256");
  assert.equal(profile.cryptography.keyDerivation, "HKDF-SHA-256-RFC5869");
  assert.equal(profile.cryptography.transcriptEncoding,
    "domain-separated-u32-big-endian-length-prefixed-utf8-fields");
  assert.equal(profile.cryptography.secretOrSessionKeyEverTransmitted, false);
  assert.equal(profile.pairing.unauthenticatedBeginMayConsumePairingSecret, false);
  assert.equal(profile.pairing.invalidBrowserProofMayConsumePairingSecret, false);
  assert.equal(profile.pairing.browserMustVerifyPairingProofBeforeComplete, true);
  assert.equal(profile.pairing.browserMustVerifyCompletionProofBeforeConnected, true);
  assert.equal(profile.session.bearerTokenAllowed, false);
  assert.equal(profile.session.httpAuthorizationHeaderAllowed, false);
  assert.equal(profile.session.sessionKeyDurable, false);
  assert.equal(profile.session.sessionKeyBrowserStorage,
    "javascript-private-memory-only");
});

test("binds every request and response to exact authority body and sequence", () => {
  assert.deepEqual(profile.session.requestProofFieldsInOrder, [
    "request-proof-domain", "protocol-id", "installation-id",
    "process-instance-id", "session-id", "key-epoch-decimal",
    "sequence-decimal", "method", "host", "origin", "path",
    "content-type-or-empty", "content-length-decimal", "content-sha256"
  ]);
  assert.deepEqual(profile.session.responseProofFieldsInOrder, [
    "response-proof-domain", "protocol-id", "installation-id",
    "process-instance-id", "session-id", "key-epoch-decimal",
    "sequence-decimal", "request-method", "request-path", "status-decimal",
    "content-type", "content-length-decimal", "content-sha256"
  ]);
  assert.equal(profile.session.sequenceAcceptance, "exact-next-sequence-only");
  assert.equal(profile.session.requestProofReplayAllowed, false);
  assert.equal(profile.session.unprovedAuthenticatedResponseTrustedByBrowser, false);
});

test("has one closed route family and no generic health or file route", () => {
  const routes = profile.routeTable.map(({ method, template }) =>
    `${method} ${template}`);
  assert.deepEqual(routes, [
    "POST /tinyrustlm-companion/1/pairings/begin",
    "POST /tinyrustlm-companion/1/pairings/complete",
    "GET /tinyrustlm-companion/1/session",
    "POST /tinyrustlm-companion/1/session/rotation/begin",
    "POST /tinyrustlm-companion/1/session/rotation/commit",
    "POST /tinyrustlm-companion/1/session/revoke",
    "POST /tinyrustlm-companion/1/operations",
    "GET /tinyrustlm-companion/1/operations/{operation-id}",
    "POST /tinyrustlm-companion/1/operations/{operation-id}/cancel",
    "GET /tinyrustlm-companion/1/operations/{operation-id}/artifacts/{artifact-role}/chunks/{chunk-index}"
  ]);
  assert.equal(new Set(routes).size, routes.length);
  assert.doesNotMatch(routes.join("\n"), /health|files?|directories|commands?/iu);
});

test("allows only six journal-bound fixed-chunk artifacts", () => {
  assert.deepEqual(profile.artifactTransfer.artifactRolesInOrder, [
    "composition", "model", "tokenizer", "template", "sampling", "prompt"
  ]);
  assert.equal(profile.artifactTransfer.admittedOperationState, "Available");
  assert.equal(profile.artifactTransfer.chunkSizeBytes, 4 * 1024 * 1024);
  assert.equal(profile.artifactTransfer.pathResolution,
    "only-from-validated-journal-artifact-identity");
  assert.equal(profile.artifactTransfer.rangeHeaderAllowed, false);
  assert.equal(profile.artifactTransfer.headMethodAllowed, false);
  assert.equal(profile.artifactTransfer.browserHashesEveryChunk, true);
  assert.equal(profile.artifactTransfer.browserHashesCompleteArtifact, true);
  assert.equal(profile.artifactTransfer.partialArtifactMayActivate, false);
  assert.equal(profile.artifactTransfer.allSixArtifactsRequiredBeforeAtomicActivation,
    true);
});

test("uses current Local Network Access and exact production authority", () => {
  assert.equal(profile.corsAndLocalNetwork.requiredOrigin,
    "https://tinyrustlm.com");
  assert.equal(profile.corsAndLocalNetwork.requiredSitePermissionsPolicy,
    "loopback-network=(self)");
  assert.equal(profile.corsAndLocalNetwork.requiredSiteConnectSrc,
    "http://127.0.0.1:*");
  assert.equal(profile.corsAndLocalNetwork.localNetworkAccessPermissionIsBrowserMediated,
    true);
  assert.equal(profile.corsAndLocalNetwork.legacyPrivateNetworkAccessRequestHeaderAccepted,
    false);
  assert.equal(profile.corsAndLocalNetwork.legacyPrivateNetworkAccessResponseHeaderEmitted,
    false);
  assert.equal(profile.corsAndLocalNetwork.unsupportedBrowserGetsAlternateProtocol,
    false);
  assert.equal(profile.browserFetch.executionOwner,
    "top-level-window-after-explicit-user-action");
  assert.deepEqual({
    mode: profile.browserFetch.mode,
    credentials: profile.browserFetch.credentials,
    cache: profile.browserFetch.cache,
    redirect: profile.browserFetch.redirect,
    referrerPolicy: profile.browserFetch.referrerPolicy,
    keepalive: profile.browserFetch.keepalive
  }, {
    mode: "cors", credentials: "omit", cache: "no-store",
    redirect: "error", referrerPolicy: "no-referrer", keepalive: false
  });
});

test("rejects ambiguous HTTP framing and bounds resources", () => {
  assert.equal(profile.httpLimits.maximumRequestLineBytes, 2048);
  assert.equal(profile.httpLimits.maximumRequestHeaderCount, 32);
  assert.equal(profile.httpLimits.maximumRequestHeaderBytes, 16384);
  assert.equal(profile.httpLimits.maximumRequestBodyBytes, 65536);
  assert.equal(profile.httpLimits.maximumConcurrentConnections, 8);
  for (const field of [
    "transferEncodingAllowed", "contentLengthAndTransferEncodingAllowed",
    "obsFoldAllowed", "trailerAllowed", "upgradeAllowed", "expectAllowed",
    "absoluteFormAllowed", "authorityFormAllowed", "asteriskFormAllowed",
    "duplicateSecurityHeaderAllowed"
  ]) assert.equal(profile.httpLimits[field], false, field);
  assert.equal(profile.responsePolicy.errorReflectsInput, false);
  assert.equal(profile.responsePolicy.rawExceptionAllowed, false);
  assert.equal(profile.responsePolicy.privatePathAllowed, false);
  assert.equal(profile.responsePolicy.credentialAllowed, false);
  assert.equal(profile.responsePolicy.promptAllowed, false);
});

test("requires the complete adversarial and physical test boundary", () => {
  assert.equal(profile.requiredTests.length, 59);
  for (const required of [
    "listener-binds-only-exact-127.0.0.1",
    "port-squatter-without-secret-cannot-prove-server-identity",
    "session-key-never-crosses-wire",
    "replayed-request-proof-rejects",
    "raw-socket-content-length-plus-transfer-encoding-rejects",
    "all-six-complete-browser-hashes-precede-one-atomic-rust-activation",
    "clean-profile-current-chromium-lna-grant-connects-and-denial-never-connects",
    "csp-and-permissions-policy-production-headers-are-read-back-before-enabling-connect",
    "no-old-bridge-file-global-api-fixed-port-health-route-or-bearer-header-remains",
    "campaign-counters-remain-zero"
  ]) assert.ok(profile.requiredTests.includes(required), required);
});

test("keeps registration and campaign claims at zero", () => {
  assert.ok(Object.values(profile.registrationOutputBoundary)
    .every((value) => value === false));
  assert.equal(profile.claimBoundary.registrationIsImplementation, false);
  assert.equal(profile.claimBoundary.unitTestIsPhysicalBrowserProof, false);
  assert.equal(profile.claimBoundary.loopbackIsPublicP2p, false);
  assert.equal(profile.claimBoundary.fixtureIsRealModel, false);
  assert.equal(profile.claimBoundary.structuralCompositionIsQuality, false);
  assert.deepEqual(profile.campaignCounters, {
    qualifiedModels: "0/20",
    deletionBackedBrowserRounds: "0/50",
    authorizedLiveMemoryRounds: "0/25",
    currentOutsideNetworkLaneProofs: "0/40",
    liveCatalogAnnouncements: "0/20"
  });
});

test("contains no credential or forbidden private drive reference", () => {
  const text = Buffer.concat([profileBytes, decisionBytes]).toString("utf8");
  assert.doesNotMatch(text,
    /authorization:\s*bearer\s+|[?&](token|secret|key)=[^&\s"]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/iu);
  assert.doesNotMatch(text, /[CD]:[\\/]/u);
});
