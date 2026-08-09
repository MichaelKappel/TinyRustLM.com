"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { canonicalizeVnextJcsBytes } = require("../tools/vnext-jcs.js");
const readback = require("../tools/vnext-public-https-readback.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const profilePath = path.join(repositoryRoot, "contracts", "vnext",
  "public-https-readback-profile.v1.json");

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function securityProfile(overrides = {}) {
  const value = {
    schema: "tinyrustlm.web_security_header_profile.v1",
    status: "frozen",
    headers: [
      {
        name: "content-security-policy",
        value: "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self' https://memoryendpoints.com"
      },
      { name: "cross-origin-embedder-policy", value: "require-corp" },
      { name: "cross-origin-opener-policy", value: "same-origin" },
      { name: "cross-origin-resource-policy", value: "same-origin" },
      {
        name: "permissions-policy",
        value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()"
      },
      { name: "referrer-policy", value: "no-referrer" },
      {
        name: "strict-transport-security",
        value: "max-age=63072000; includeSubDomains; preload"
      },
      { name: "x-content-type-options", value: "nosniff" },
      { name: "x-frame-options", value: "DENY" }
    ],
    cacheControlByPolicy: [
      {
        cachePolicy: "immutable",
        value: "public, max-age=31536000, immutable"
      },
      { cachePolicy: "no-cache", value: "no-cache" },
      { cachePolicy: "no-store", value: "no-store" }
    ],
    forbiddenResponseHeaders: [
      "content-encoding",
      "content-range",
      "location",
      "refresh",
      "set-cookie",
      "transfer-encoding"
    ],
    contentTypeParameterPolicy:
      "optional-charset-utf-8-only-for-text-json-javascript-or-xml",
    ...overrides
  };
  return Buffer.concat([canonicalizeVnextJcsBytes(value), Buffer.from("\n", "utf8")]);
}

function asset(body = Buffer.from("<!doctype html><title>TinyRustLM</title>", "utf8"),
  overrides = {}) {
  const securityBytes = securityProfile();
  return {
    path: "/",
    role: "bootstrap",
    byteLength: body.length,
    sha256: sha256(body),
    contentType: "text/html",
    cachePolicy: "no-store",
    securityHeaderProfileSha256: sha256(securityBytes),
    ...overrides
  };
}

function rawHeaders(inputAsset = asset(), overrides = {}) {
  const profile = readback.validateVnextWebSecurityHeaderProfileBytes(
    securityProfile()
  );
  const values = {
    "cache-control": profile.cacheControlByPolicy[inputAsset.cachePolicy],
    "content-length": String(inputAsset.byteLength),
    "content-type": `${inputAsset.contentType}; charset=utf-8`,
    ...profile.headersByName,
    ...overrides
  };
  return Object.entries(values).flatMap(([name, value]) => [name, value]);
}

function errorCode(code) {
  return (error) => error?.code === code;
}

test("freezes one production-only HTTPS readback profile", () => {
  const bytes = fs.readFileSync(profilePath);
  assert.equal(readback.publicHttpsReadbackProfileSha256, sha256(bytes));
  assert.equal(readback.publicHttpsReadbackProfileSha256,
    "0cfeb00065d45fd860813f501d6c07417f8a6e6587dd524a81e5be426a84c419");
  assert.equal(readback.publicHttpsReadbackProfile.profileId,
    "tinyrustlm.vnext.public-https-readback.v1");
  assert.equal(readback.publicHttpsReadbackProfile.resultSchema,
    "tinyrustlm.vnext.public_https_readback_result.v1");
  assert.equal(readback.publicHttpsReadbackProfile.callerTransportPolicy,
    "forbidden");
  assert.equal(readback.publicHttpsReadbackProfile.request.redirectPolicy,
    "forbidden");
  assert.equal(readback.publicHttpsReadbackProfile.response.contentEncodingPolicy,
    "header-forbidden-even-identity");
  assert.deepEqual(Object.keys(readback).sort(), [
    "isVnextPublicNetworkAddress",
    "normalizeVnextPublicHttpsOrigin",
    "performVnextPublicHttpsReadback",
    "publicHttpsReadbackProfile",
    "publicHttpsReadbackProfileSha256",
    "validateVnextWebSecurityHeaderProfileBytes",
    "verifyVnextReadbackBodyChunks",
    "verifyVnextReadbackResponseMetadata"
  ]);
});

test("accepts only canonical strong web security-header profiles", () => {
  const bytes = securityProfile();
  const result = readback.validateVnextWebSecurityHeaderProfileBytes(bytes);
  assert.equal(result.profileSha256, sha256(bytes));
  assert.equal(result.headersByName["x-content-type-options"], "nosniff");
  assert.equal(result.cacheControlByPolicy.immutable,
    "public, max-age=31536000, immutable");
  const first = result.bytes;
  first.fill(0);
  assert.equal(result.bytes.equals(first), false);

  const parsed = JSON.parse(bytes.toString("utf8"));
  const pretty = Buffer.from(`${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  assert.throws(() => readback.validateVnextWebSecurityHeaderProfileBytes(pretty),
    errorCode("public_readback_security_profile_invalid"));

  const missingHeader = securityProfile({
    headers: parsed.headers.filter((entry) => entry.name !== "permissions-policy")
  });
  assert.throws(() => readback.validateVnextWebSecurityHeaderProfileBytes(
    missingHeader), errorCode("public_readback_security_profile_baseline_missing"));

  const weakHsts = securityProfile({
    headers: parsed.headers.map((entry) => entry.name === "strict-transport-security"
      ? { ...entry, value: "max-age=60" }
      : entry)
  });
  assert.throws(() => readback.validateVnextWebSecurityHeaderProfileBytes(weakHsts),
    errorCode("public_readback_security_profile_baseline_invalid"));

  const weakPermissions = securityProfile({
    headers: parsed.headers.map((entry) => entry.name === "permissions-policy"
      ? { ...entry, value: "camera=()" }
      : entry)
  });
  assert.throws(() => readback.validateVnextWebSecurityHeaderProfileBytes(
    weakPermissions), errorCode("public_readback_security_profile_permissions_invalid"));

  const duplicateHeader = securityProfile({
    headers: [...parsed.headers, { ...parsed.headers.at(-1) }]
  });
  assert.throws(() => readback.validateVnextWebSecurityHeaderProfileBytes(
    duplicateHeader), errorCode("public_readback_security_profile_invalid"));
});

test("classifies only globally routable literal addresses as public", () => {
  for (const address of [
    "0.0.0.0", "10.0.0.1", "100.64.0.1", "127.0.0.1", "169.254.1.1",
    "172.16.0.1", "192.0.2.1", "192.168.1.1", "198.18.0.1",
    "198.51.100.1", "203.0.113.1", "224.0.0.1", "255.255.255.255",
    "::", "::1", "::ffff:8.8.8.8", "::ffff:127.0.0.1",
    "64:ff9b::1", "100::1",
    "2001:db8::1", "2002::1", "fc00::1", "fe80::1", "ff00::1"
  ]) {
    assert.equal(readback.isVnextPublicNetworkAddress(address), false, address);
  }
  for (const address of [
    "1.1.1.1", "8.8.8.8", "93.184.216.34", "2606:4700:4700::1111",
    "2001:4860:4860::8888"
  ]) {
    assert.equal(readback.isVnextPublicNetworkAddress(address), true, address);
  }
  assert.equal(readback.isVnextPublicNetworkAddress("example.com"), false);
  assert.equal(readback.isVnextPublicNetworkAddress({ toString: () => "8.8.8.8" }),
    false);
});

test("normalizes only canonical public HTTPS root origins", () => {
  assert.deepEqual(readback.normalizeVnextPublicHttpsOrigin(
    "https://example.com/"), {
    href: "https://example.com/",
    hostname: "example.com",
    origin: "https://example.com",
    port: 443
  });
  assert.equal(readback.normalizeVnextPublicHttpsOrigin(
    "https://example.com:8443/").port, 8443);
  for (const origin of [
    "http://example.com/", "https://example.com", "https://example.com/path",
    "https://example.com/?a=1", "https://user@example.com/",
    "https://localhost/", "https://service.local/", "https://10.0.0.1/",
    "https://127.0.0.1/", "https://93.184.216.34/", "https://[::1]/",
    "https://[2606:4700:4700::1111]/", "https://example.com./",
    "https://\u00e9xample.com/"
  ]) {
    assert.throws(() => readback.normalizeVnextPublicHttpsOrigin(origin),
      errorCode("public_readback_origin_invalid"), origin);
  }
});

test("requires exact status, metadata, cache, and security response headers", () => {
  const inputAsset = asset();
  const valid = {
    asset: inputAsset,
    rawHeaders: rawHeaders(inputAsset),
    securityHeaderProfileBytes: securityProfile(),
    statusCode: 200
  };
  const result = readback.verifyVnextReadbackResponseMetadata(valid);
  assert.equal(result.path, "/");
  assert.equal(result.byteLength, inputAsset.byteLength);
  assert.equal(result.cacheControl, "no-store");
  assert.equal(Object.isFrozen(result), true);

  assert.throws(() => readback.verifyVnextReadbackResponseMetadata({
    ...valid,
    statusCode: 302
  }), errorCode("public_readback_status_invalid"));
  assert.throws(() => readback.verifyVnextReadbackResponseMetadata({
    ...valid,
    rawHeaders: [...valid.rawHeaders, "Content-Encoding", "identity"]
  }), errorCode("public_readback_forbidden_header"));
  assert.throws(() => readback.verifyVnextReadbackResponseMetadata({
    ...valid,
    rawHeaders: [...valid.rawHeaders, "Cache-Control", "no-store"]
  }), errorCode("public_readback_cache_control_invalid"));
  assert.throws(() => readback.verifyVnextReadbackResponseMetadata({
    ...valid,
    rawHeaders: rawHeaders(inputAsset, { "content-length": `0${inputAsset.byteLength}` })
  }), errorCode("public_readback_content_length_invalid"));
  assert.throws(() => readback.verifyVnextReadbackResponseMetadata({
    ...valid,
    rawHeaders: rawHeaders(inputAsset, { "content-type": "text/html; charset=latin1" })
  }), errorCode("public_readback_content_type_invalid"));
  assert.throws(() => readback.verifyVnextReadbackResponseMetadata({
    ...valid,
    rawHeaders: rawHeaders(inputAsset, { "x-frame-options": "SAMEORIGIN" })
  }), errorCode("public_readback_security_header_invalid"));
});

test("accepts only release-contract asset roles, media types, and safe paths", () => {
  const inputAsset = asset();
  const valid = {
    asset: inputAsset,
    rawHeaders: rawHeaders(inputAsset),
    securityHeaderProfileBytes: securityProfile(),
    statusCode: 200
  };
  for (const overrides of [
    { role: "custom" },
    { contentType: "text/x-custom" },
    { path: "/docs/../index.html" },
    { path: "/docs/%2e%2e/index.html" },
    { path: "/models%2fsecret.slm" },
    { path: `/${"a".repeat(2048)}` }
  ]) {
    assert.throws(() => readback.verifyVnextReadbackResponseMetadata({
      ...valid,
      asset: { ...inputAsset, ...overrides }
    }), errorCode("public_readback_asset_invalid"));
  }
});

test("rejects an invalid release web graph before DNS access", async () => {
  const root = asset();
  const securityBytes = securityProfile();
  const securitySha256 = sha256(securityBytes);
  const graphInput = (webAssets) => ({
    publicOrigin: "https://example.com/",
    webAssets,
    webSecurityHeaderProfileBytes: securityBytes
  });
  const derived = (pathValue, role, contentType, cachePolicy) => {
    const body = Buffer.from(pathValue, "utf8");
    return {
      path: pathValue,
      role,
      byteLength: body.length,
      sha256: sha256(body),
      contentType,
      cachePolicy,
      securityHeaderProfileSha256: securitySha256
    };
  };
  const cases = [
    [],
    [{ ...root, cachePolicy: "no-cache" }],
    [root, derived("/other.html", "bootstrap", "text/html", "no-store")],
    [root, derived("/worker.js", "service-worker", "application/javascript",
      "no-store")],
    [root,
      derived("/a-worker.js", "service-worker", "application/javascript", "no-cache"),
      derived("/b-worker.js", "service-worker", "application/javascript", "no-cache")],
    [root, derived("/models/model.bin", "runtime", "application/octet-stream",
      "no-store")],
    [root, derived("/runtime.js", "runtime", "application/javascript", "immutable")]
  ];
  for (const webAssets of cases) {
    await assert.rejects(readback.performVnextPublicHttpsReadback(
      graphInput(webAssets)), (error) => [
      "public_readback_asset_invalid",
      "public_readback_web_graph_invalid"
    ].includes(error?.code));
  }
});

test("streams exact body bytes once and rejects overflow, truncation, and hash drift", () => {
  const body = Buffer.from("exact streamed body", "utf8");
  const inputAsset = asset(body);
  const result = readback.verifyVnextReadbackBodyChunks({
    asset: inputAsset,
    chunks: [body.subarray(0, 5), body.subarray(5)]
  });
  assert.deepEqual(result, { byteLength: body.length, sha256: sha256(body) });

  assert.throws(() => readback.verifyVnextReadbackBodyChunks({
    asset: inputAsset,
    chunks: [body, Buffer.from("x", "utf8")]
  }), errorCode("public_readback_body_overflow"));
  assert.throws(() => readback.verifyVnextReadbackBodyChunks({
    asset: inputAsset,
    chunks: [body.subarray(0, body.length - 1)]
  }), errorCode("public_readback_body_length_mismatch"));
  const changed = Buffer.from(body);
  changed[0] ^= 0x01;
  assert.throws(() => readback.verifyVnextReadbackBodyChunks({
    asset: inputAsset,
    chunks: [changed]
  }), errorCode("public_readback_body_hash_mismatch"));
  assert.throws(() => readback.verifyVnextReadbackBodyChunks({
    asset: inputAsset,
    chunks: ["not-bytes"]
  }), errorCode("public_readback_body_chunk_invalid"));
});

test("exposes no caller transport or response injection path", async () => {
  const inputAsset = asset();
  const valid = {
    publicOrigin: "https://example.com/",
    webAssets: [inputAsset],
    webSecurityHeaderProfileBytes: securityProfile()
  };
  await assert.rejects(readback.performVnextPublicHttpsReadback({
    ...valid,
    transport: async () => ({ statusCode: 200 })
  }), errorCode("public_readback_input_invalid"));

  const hostile = { ...valid };
  Object.defineProperty(hostile, "publicOrigin", {
    enumerable: true,
    get() {
      return "https://example.com/";
    }
  });
  await assert.rejects(readback.performVnextPublicHttpsReadback(hostile),
    errorCode("public_readback_input_invalid_accessor"));
});
