"use strict";

const crypto = require("node:crypto");
const dns = require("node:dns");
const fs = require("node:fs");
const https = require("node:https");
const net = require("node:net");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");
const { canonicalizeVnextJcsBytes } = require("./vnext-jcs.js");
const { VnextEvidenceError, failEvidence } = require("./vnext-evidence-error.js");
const { domainSeparatedDigest } = require("./vnext-receipt-identity.js");

const contractRoot = path.resolve(__dirname, "../../contracts/vnext");
const profilePath = path.join(contractRoot, "public-https-readback-profile.v1.json");
const profileBytes = fs.readFileSync(profilePath);
const parsedProfile = parseStrictJson(profileBytes);
const publicHttpsReadbackProfileSha256 = sha256(profileBytes);
const sourceSha256 = sha256(fs.readFileSync(__filename));
const dnsLookup = dns.promises.lookup.bind(dns.promises);
const httpsRequest = https.request.bind(https);

const digestPattern = /^[a-f0-9]{64}$/u;
const headerNamePattern = /^[!#$%&'*+.^_`|~0-9a-z-]+$/u;
const publicPathPattern = /^\/(?!\/)[\x21-\x3e\x40-\x5a\x5e-\x7e]*$/u;
const webCachePolicies = Object.freeze(["immutable", "no-cache", "no-store"]);
const webAssetRoles = Object.freeze([
  "application", "bootstrap", "current-release-pointer", "documentation",
  "release-history", "runtime", "runtime-metadata", "service-worker", "style"
]);
const webContentTypes = Object.freeze([
  "application/javascript", "application/json", "application/manifest+json",
  "application/octet-stream", "application/wasm", "font/woff2", "image/avif",
  "image/png", "image/svg+xml", "image/webp", "text/css", "text/html",
  "text/plain"
]);
const assetFields = Object.freeze([
  "byteLength", "cachePolicy", "contentType", "path", "role",
  "securityHeaderProfileSha256", "sha256"
]);
const inputFields = Object.freeze([
  "publicOrigin", "webAssets", "webSecurityHeaderProfileBytes"
]);
const securityProfileFields = Object.freeze([
  "cacheControlByPolicy", "contentTypeParameterPolicy",
  "forbiddenResponseHeaders", "headers", "schema", "status"
]);
const securityHeaderFields = Object.freeze(["name", "value"]);
const cacheControlFields = Object.freeze(["cachePolicy", "value"]);
const responseMetadataFields = Object.freeze([
  "asset", "rawHeaders", "securityHeaderProfileBytes", "statusCode"
]);
const bodyVerificationFields = Object.freeze(["asset", "chunks"]);
const profileFields = Object.freeze([
  "schema", "profileId", "resultSchema", "resultWirePolicy", "status",
  "versionPolicy", "canonicalJsonProfile", "hashAlgorithm", "networkAccess",
  "callerTransportPolicy", "originPolicy", "dnsPolicy", "tlsPolicy", "request",
  "response", "securityHeaderProfile", "observation", "limits"
]);
const requestFields = Object.freeze([
  "method", "redirectPolicy", "connectionPolicy", "headers"
]);
const responseFields = Object.freeze([
  "requiredStatus", "contentLengthPolicy", "contentEncodingPolicy",
  "transferEncodingPolicy", "contentTypePolicy", "cacheControlPolicy",
  "securityHeaderPolicy", "forbiddenHeaderPolicy", "bodyPolicy"
]);
const securityContractFields = Object.freeze([
  "schema", "status", "wirePolicy", "requiredBaselineHeaders",
  "requiredExactBaselineValues", "requiredCspDirectives",
  "requiredPermissionsPolicyFeatures", "cachePolicies",
  "forbiddenResponseHeaders"
]);
const observationFields = Object.freeze([
  "inventoryIdentityDomain", "dnsIdentityDomain", "pinnedAddressIdentityDomain",
  "certificateIdentityDomain", "addressDisclosure", "certificateDisclosure",
  "rawBodyPersistence", "rawHeaderPersistence"
]);
const limitFields = Object.freeze([
  "maximumAssets", "maximumAssetBytes", "maximumTotalBytes",
  "maximumDnsAddresses", "maximumCertificates", "maximumSecurityHeaders",
  "maximumForbiddenHeaders", "maximumHeaderCount", "maximumHeaderBytes",
  "maximumUrlBytes", "maximumRequestMilliseconds",
  "maximumOperationMilliseconds", "maximumResultBytes"
]);

// Keep address families in separate lists. Node maps IPv4 addresses into IPv6
// for a mixed BlockList, which would make ::ffff:0:0/96 reject every IPv4 host.
const nonPublicIpv4Addresses = new net.BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10],
  ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]
]) {
  nonPublicIpv4Addresses.addSubnet(address, prefix, "ipv4");
}
const nonPublicIpv6Addresses = new net.BlockList();
for (const [address, prefix] of [
  ["::", 96], ["::1", 128], ["::ffff:0:0", 96], ["64:ff9b::", 96],
  ["64:ff9b:1::", 48], ["100::", 64], ["2001::", 32],
  ["2001:2::", 48], ["2001:10::", 28], ["2001:20::", 28],
  ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20],
  ["5f00::", 16], ["fc00::", 7], ["fe80::", 10], ["fec0::", 10],
  ["ff00::", 8]
]) {
  nonPublicIpv6Addresses.addSubnet(address, prefix, "ipv6");
}

class AddressTransportError extends Error {
  constructor() {
    super("public HTTPS address transport failed");
    this.name = "AddressTransportError";
  }
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactDataObject(value, fields, code, step) {
  if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length !== 0) {
    failEvidence(code, step);
  }
  const names = Object.getOwnPropertyNames(value).sort();
  const expected = [...fields].sort();
  if (names.length !== expected.length || names.some((name, index) =>
    name !== expected[index])) {
    failEvidence(code, step);
  }
  const result = {};
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence(`${code}_accessor`, step);
    }
    result[name] = descriptor.value;
  }
  return Object.freeze(result);
}

function dataArray(value, maximum, code, step) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
      Object.getOwnPropertySymbols(value).length !== 0 || value.length > maximum ||
      Object.getOwnPropertyNames(value).length !== value.length + 1) {
    failEvidence(code, step);
  }
  const result = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      failEvidence(`${code}_accessor`, step);
    }
    result.push(descriptor.value);
  }
  return Object.freeze(result);
}

function sameStrings(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
    left.every((entry, index) => entry === right[index]);
}

function deepFreeze(value) {
  if (Buffer.isBuffer(value) || ArrayBuffer.isView(value)) return value;
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value)) deepFreeze(entry);
    if (!Object.isFrozen(value)) Object.freeze(value);
  }
  return value;
}

function exactStringArray(value, maximum, code, step) {
  const entries = dataArray(value, maximum, code, step);
  if (entries.some((entry, index) => typeof entry !== "string" ||
      index > 0 && entries[index - 1] >= entry)) {
    failEvidence(code, step);
  }
  return Object.freeze([...entries]);
}

function validateInstalledProfile() {
  const step = "public-https-readback-profile";
  exactDataObject(parsedProfile, profileFields, "public_readback_profile_invalid", step);
  exactDataObject(parsedProfile.request, requestFields,
    "public_readback_profile_invalid", step);
  exactDataObject(parsedProfile.response, responseFields,
    "public_readback_profile_invalid", step);
  exactDataObject(parsedProfile.securityHeaderProfile, securityContractFields,
    "public_readback_profile_invalid", step);
  exactDataObject(parsedProfile.observation, observationFields,
    "public_readback_profile_invalid", step);
  exactDataObject(parsedProfile.limits, limitFields,
    "public_readback_profile_invalid", step);
  const requestHeaders = dataArray(parsedProfile.request.headers, 16,
    "public_readback_profile_invalid", step).map((entry) =>
    exactDataObject(entry, securityHeaderFields,
      "public_readback_profile_invalid", step));
  const requiredBaselineHeaders = exactStringArray(
    parsedProfile.securityHeaderProfile.requiredBaselineHeaders,
    parsedProfile.limits.maximumSecurityHeaders,
    "public_readback_profile_invalid",
    step
  );
  const exactBaselineValues = dataArray(
    parsedProfile.securityHeaderProfile.requiredExactBaselineValues,
    parsedProfile.limits.maximumSecurityHeaders,
    "public_readback_profile_invalid",
    step
  ).map((entry) => exactDataObject(entry, securityHeaderFields,
    "public_readback_profile_invalid", step));
  const requiredCspDirectives = dataArray(
    parsedProfile.securityHeaderProfile.requiredCspDirectives,
    32,
    "public_readback_profile_invalid",
    step
  ).map((entry) => exactDataObject(entry, securityHeaderFields,
    "public_readback_profile_invalid", step));
  const requiredPermissions = exactStringArray(
    parsedProfile.securityHeaderProfile.requiredPermissionsPolicyFeatures,
    32,
    "public_readback_profile_invalid",
    step
  );
  const cachePolicies = exactStringArray(
    parsedProfile.securityHeaderProfile.cachePolicies,
    8,
    "public_readback_profile_invalid",
    step
  );
  const forbiddenHeaders = exactStringArray(
    parsedProfile.securityHeaderProfile.forbiddenResponseHeaders,
    parsedProfile.limits.maximumForbiddenHeaders,
    "public_readback_profile_invalid",
    step
  );
  const limitsValid = Object.values(parsedProfile.limits).every((value) =>
    Number.isSafeInteger(value) && value > 0);
  if (parsedProfile.schema !==
        "tinyrustlm.vnext.public_https_readback_profile.v1" ||
      parsedProfile.profileId !== "tinyrustlm.vnext.public-https-readback.v1" ||
      parsedProfile.resultSchema !==
        "tinyrustlm.vnext.public_https_readback_result.v1" ||
      parsedProfile.resultWirePolicy !==
        "rfc8785-jcs-content-with-sha256-wrapper" ||
      parsedProfile.status !== "frozen" ||
      parsedProfile.versionPolicy !== "single-current-profile-no-compatibility-reader" ||
      parsedProfile.canonicalJsonProfile !==
        "rfc8785-jcs+tinyrustlm.strict-json.v1" ||
      parsedProfile.hashAlgorithm !== "sha256" ||
      parsedProfile.networkAccess !== "production-public-https-get-only" ||
      parsedProfile.callerTransportPolicy !== "forbidden" ||
      parsedProfile.originPolicy !==
        "canonical-public-https-dns-origin-root-without-credentials-query-or-fragment" ||
      parsedProfile.dnsPolicy !==
        "resolve-once-reject-any-nonpublic-result-first-successful-public-address-pinned-for-complete-operation" ||
      parsedProfile.tlsPolicy !==
        "system-trust-normal-hostname-verification-sni-original-host-minimum-tls1.2" ||
      parsedProfile.request.method !== "GET" ||
      parsedProfile.request.redirectPolicy !== "forbidden" ||
      parsedProfile.request.connectionPolicy !==
        "one-connection-per-response-close-after-body" ||
      !sameStrings(requestHeaders.map((entry) => entry.name), [
        "accept", "accept-encoding", "cache-control", "connection", "pragma",
        "user-agent"
      ]) ||
      requestHeaders[0].value !== "*/*" ||
      requestHeaders[1].value !== "identity" ||
      requestHeaders[2].value !== "no-cache" ||
      requestHeaders[3].value !== "close" ||
      requestHeaders[4].value !== "no-cache" ||
      requestHeaders[5].value !== "TinyRustLM-Public-Readback/1.0" ||
      parsedProfile.response.requiredStatus !== 200 ||
      parsedProfile.response.contentLengthPolicy !==
        "one-canonical-decimal-header-equal-manifest-and-stream-count" ||
      parsedProfile.response.contentEncodingPolicy !==
        "header-forbidden-even-identity" ||
      parsedProfile.response.transferEncodingPolicy !== "header-forbidden" ||
      parsedProfile.response.contentTypePolicy !==
        "exact-media-type-with-optional-utf-8-charset-only-for-text-json-javascript-or-xml" ||
      parsedProfile.response.cacheControlPolicy !==
        "exact-value-selected-by-manifest-cache-policy" ||
      parsedProfile.response.securityHeaderPolicy !==
        "all-profile-headers-exactly-once-and-exact-value" ||
      parsedProfile.response.forbiddenHeaderPolicy !==
        "all-profile-forbidden-headers-absent" ||
      parsedProfile.response.bodyPolicy !==
        "stream-once-sha256-and-count-abort-immediately-after-expected-length" ||
      parsedProfile.securityHeaderProfile.schema !==
        "tinyrustlm.web_security_header_profile.v1" ||
      parsedProfile.securityHeaderProfile.status !== "frozen" ||
      parsedProfile.securityHeaderProfile.wirePolicy !== "rfc8785-jcs-plus-lf" ||
      !sameStrings(requiredBaselineHeaders, [
        "content-security-policy", "cross-origin-embedder-policy",
        "cross-origin-opener-policy", "cross-origin-resource-policy",
        "permissions-policy", "referrer-policy", "strict-transport-security",
        "x-content-type-options", "x-frame-options"
      ]) ||
      !sameStrings(exactBaselineValues.map((entry) => entry.name), [
        "cross-origin-embedder-policy", "cross-origin-opener-policy",
        "cross-origin-resource-policy", "referrer-policy",
        "strict-transport-security", "x-content-type-options", "x-frame-options"
      ]) ||
      exactBaselineValues[0].value !== "require-corp" ||
      exactBaselineValues[1].value !== "same-origin" ||
      exactBaselineValues[2].value !== "same-origin" ||
      exactBaselineValues[3].value !== "no-referrer" ||
      exactBaselineValues[4].value !==
        "max-age=63072000; includeSubDomains; preload" ||
      exactBaselineValues[5].value !== "nosniff" ||
      exactBaselineValues[6].value !== "DENY" ||
      !sameStrings(requiredCspDirectives.map((entry) => entry.name), [
        "base-uri", "default-src", "frame-ancestors", "object-src"
      ]) ||
      requiredCspDirectives.some((entry, index) => entry.value !==
        ["'none'", "'self'", "'none'", "'none'"][index]) ||
      !sameStrings(requiredPermissions, [
        "camera=()", "geolocation=()", "microphone=()", "payment=()", "usb=()"
      ]) ||
      !sameStrings(cachePolicies, webCachePolicies) ||
      !sameStrings(forbiddenHeaders, [
        "content-encoding", "content-range", "location", "refresh",
        "set-cookie", "transfer-encoding"
      ]) ||
      parsedProfile.observation.inventoryIdentityDomain !==
        "tinyrustlm.public-https-readback-observation-inventory.v1" ||
      parsedProfile.observation.dnsIdentityDomain !==
        "tinyrustlm.public-https-readback-dns-address-set.v1" ||
      parsedProfile.observation.pinnedAddressIdentityDomain !==
        "tinyrustlm.public-https-readback-pinned-address.v1" ||
      parsedProfile.observation.certificateIdentityDomain !==
        "tinyrustlm.public-https-readback-certificate-set.v1" ||
      parsedProfile.observation.addressDisclosure !== "sha256-set-identity-only" ||
      parsedProfile.observation.certificateDisclosure !==
        "sha256-set-identity-only" ||
      parsedProfile.observation.rawBodyPersistence !== "forbidden" ||
      parsedProfile.observation.rawHeaderPersistence !== "forbidden" ||
      !limitsValid || parsedProfile.limits.maximumAssets !== 514 ||
      parsedProfile.limits.maximumAssetBytes !== 8_589_934_592 ||
      parsedProfile.limits.maximumTotalBytes !== 68_723_933_184 ||
      parsedProfile.limits.maximumDnsAddresses !== 32 ||
      parsedProfile.limits.maximumCertificates !== 32 ||
      parsedProfile.limits.maximumSecurityHeaders !== 32 ||
      parsedProfile.limits.maximumForbiddenHeaders !== 32 ||
      parsedProfile.limits.maximumHeaderCount !== 128 ||
      parsedProfile.limits.maximumHeaderBytes !== 32_768 ||
      parsedProfile.limits.maximumUrlBytes !== 2_048 ||
      parsedProfile.limits.maximumRequestMilliseconds !== 1_800_000 ||
      parsedProfile.limits.maximumOperationMilliseconds !== 14_400_000 ||
      parsedProfile.limits.maximumResultBytes !== 4_194_304) {
    failEvidence("public_readback_profile_invalid", step);
  }
}

validateInstalledProfile();

const publicHttpsReadbackProfile = deepFreeze({ ...parsedProfile });
const requestHeaders = Object.freeze(Object.fromEntries(
  parsedProfile.request.headers.map((entry) => [entry.name, entry.value])
));

function isVnextPublicNetworkAddress(address) {
  if (typeof address !== "string") return false;
  const family = net.isIP(address);
  if (family === 4) return !nonPublicIpv4Addresses.check(address, "ipv4");
  if (family === 6) return !nonPublicIpv6Addresses.check(address, "ipv6");
  return false;
}

function normalizeVnextPublicHttpsOrigin(value) {
  const step = "public-readback-origin";
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") === 0 ||
      Buffer.byteLength(value, "utf8") > parsedProfile.limits.maximumUrlBytes) {
    failEvidence("public_readback_origin_invalid", step);
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    failEvidence("public_readback_origin_invalid", step);
  }
  const rawHostname = url.hostname.toLowerCase();
  const hostname = rawHostname.replace(/^\[|\]$/gu, "");
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "" ||
      url.pathname !== "/" || url.search !== "" || url.hash !== "" ||
      url.href !== value || hostname.length === 0 || hostname.endsWith(".") ||
      hostname === "localhost" ||
      hostname.endsWith(".localhost") || hostname.endsWith(".local") ||
      hostname.endsWith(".internal") || hostname.endsWith(".home") ||
      net.isIP(hostname) !== 0) {
    failEvidence("public_readback_origin_invalid", step);
  }
  return Object.freeze({
    href: url.href,
    hostname,
    port: url.port === "" ? 443 : Number(url.port),
    origin: url.origin
  });
}

function normalizeAsset(rawAsset, headerProfileSha256, step) {
  const asset = exactDataObject(rawAsset, assetFields,
    "public_readback_asset_invalid", step);
  if (typeof asset.path !== "string" ||
      Buffer.byteLength(asset.path, "utf8") > parsedProfile.limits.maximumUrlBytes ||
      !publicPathPattern.test(asset.path) || /[?#\\]/u.test(asset.path) ||
      /%(?:2e|2f|5c)/iu.test(asset.path) || asset.path.split("/").some((segment) =>
        segment === "." || segment === "..") ||
      !webAssetRoles.includes(asset.role) ||
      !Number.isSafeInteger(asset.byteLength) || asset.byteLength <= 0 ||
      asset.byteLength > parsedProfile.limits.maximumAssetBytes ||
      !digestPattern.test(asset.sha256) ||
      !webContentTypes.includes(asset.contentType) ||
      !webCachePolicies.includes(asset.cachePolicy) ||
      asset.securityHeaderProfileSha256 !== headerProfileSha256) {
    failEvidence("public_readback_asset_invalid", step);
  }
  return Object.freeze({ ...asset });
}

function parseCanonicalControlJson(bytes, code, step) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 3 || bytes.at(-1) !== 0x0a ||
      bytes.includes(0x0d) || bytes[0] === 0xef && bytes[1] === 0xbb &&
        bytes[2] === 0xbf) {
    failEvidence(code, step);
  }
  const payload = bytes.subarray(0, bytes.length - 1);
  let value;
  try {
    value = parseStrictJson(payload);
  } catch {
    failEvidence(code, step);
  }
  let canonical;
  try {
    canonical = canonicalizeVnextJcsBytes(value);
  } catch {
    failEvidence(code, step);
  }
  if (!canonical.equals(payload)) failEvidence(code, step);
  return value;
}

function parseCsp(value, step) {
  const directives = new Map();
  for (const rawDirective of value.split(";")) {
    const directive = rawDirective.trim();
    if (directive === "") continue;
    const separator = directive.search(/\s/u);
    const name = (separator === -1 ? directive : directive.slice(0, separator))
      .toLowerCase();
    const directiveValue = separator === -1 ? "" : directive.slice(separator).trim();
    if (!headerNamePattern.test(name) || directives.has(name)) {
      failEvidence("public_readback_security_profile_csp_invalid", step);
    }
    directives.set(name, directiveValue);
  }
  return directives;
}

function immutableSecurityResult(value, bytes) {
  const result = { ...value };
  Object.defineProperty(result, "bytes", {
    enumerable: true,
    get() {
      return Buffer.from(bytes);
    }
  });
  return deepFreeze(result);
}

function validateVnextWebSecurityHeaderProfileBytes(rawBytes) {
  const step = "public-readback-security-profile";
  if (!Buffer.isBuffer(rawBytes) || rawBytes.length > 1_048_576) {
    failEvidence("public_readback_security_profile_invalid", step);
  }
  const bytes = Buffer.from(rawBytes);
  const parsed = parseCanonicalControlJson(
    bytes,
    "public_readback_security_profile_invalid",
    step
  );
  const profile = exactDataObject(parsed, securityProfileFields,
    "public_readback_security_profile_invalid", step);
  const headers = dataArray(profile.headers,
    parsedProfile.limits.maximumSecurityHeaders,
    "public_readback_security_profile_invalid", step).map((entry) =>
    exactDataObject(entry, securityHeaderFields,
      "public_readback_security_profile_invalid", step));
  const cacheControls = dataArray(profile.cacheControlByPolicy,
    webCachePolicies.length,
    "public_readback_security_profile_invalid", step).map((entry) =>
    exactDataObject(entry, cacheControlFields,
      "public_readback_security_profile_invalid", step));
  const forbiddenHeaders = exactStringArray(
    profile.forbiddenResponseHeaders,
    parsedProfile.limits.maximumForbiddenHeaders,
    "public_readback_security_profile_invalid",
    step
  );
  if (profile.schema !== parsedProfile.securityHeaderProfile.schema ||
      profile.status !== parsedProfile.securityHeaderProfile.status ||
      profile.contentTypeParameterPolicy !==
        "optional-charset-utf-8-only-for-text-json-javascript-or-xml" ||
      headers.some((entry, index) =>
        typeof entry.name !== "string" || entry.name !== entry.name.toLowerCase() ||
          !headerNamePattern.test(entry.name) || typeof entry.value !== "string" ||
          entry.value.length === 0 || entry.value.length > 2_048 ||
          entry.value !== entry.value.trim() || !/^[\x20-\x7e]+$/u.test(entry.value) ||
          index > 0 && headers[index - 1].name >= entry.name) ||
      !sameStrings(cacheControls.map((entry) => entry.cachePolicy),
        webCachePolicies) ||
      cacheControls[0].value !== "public, max-age=31536000, immutable" ||
      cacheControls[1].value !== "no-cache" ||
      cacheControls[2].value !== "no-store" ||
      !sameStrings(forbiddenHeaders,
        parsedProfile.securityHeaderProfile.forbiddenResponseHeaders)) {
    failEvidence("public_readback_security_profile_invalid", step);
  }
  const byName = new Map(headers.map((entry) => [entry.name, entry.value]));
  for (const required of parsedProfile.securityHeaderProfile
    .requiredBaselineHeaders) {
    if (!byName.has(required)) {
      failEvidence("public_readback_security_profile_baseline_missing", step);
    }
  }
  for (const required of parsedProfile.securityHeaderProfile
    .requiredExactBaselineValues) {
    if (byName.get(required.name) !== required.value) {
      failEvidence("public_readback_security_profile_baseline_invalid", step);
    }
  }
  const csp = parseCsp(byName.get("content-security-policy"), step);
  for (const required of parsedProfile.securityHeaderProfile
    .requiredCspDirectives) {
    if (csp.get(required.name) !== required.value) {
      failEvidence("public_readback_security_profile_csp_invalid", step);
    }
  }
  const permissions = new Set(byName.get("permissions-policy").split(",")
    .map((entry) => entry.trim()).filter(Boolean));
  if (parsedProfile.securityHeaderProfile.requiredPermissionsPolicyFeatures
    .some((entry) => !permissions.has(entry))) {
    failEvidence("public_readback_security_profile_permissions_invalid", step);
  }
  return immutableSecurityResult({
    profile: {
      ...profile,
      cacheControlByPolicy: cacheControls.map((entry) => ({ ...entry })),
      forbiddenResponseHeaders: [...forbiddenHeaders],
      headers: headers.map((entry) => ({ ...entry }))
    },
    profileSha256: sha256(bytes),
    cacheControlByPolicy: Object.fromEntries(cacheControls.map((entry) =>
      [entry.cachePolicy, entry.value])),
    headersByName: Object.fromEntries(headers.map((entry) =>
      [entry.name, entry.value]))
  }, bytes);
}

function normalizeInput(rawInput) {
  const step = "public-readback-input";
  const input = exactDataObject(rawInput, inputFields,
    "public_readback_input_invalid", step);
  const origin = normalizeVnextPublicHttpsOrigin(input.publicOrigin);
  const security = validateVnextWebSecurityHeaderProfileBytes(
    input.webSecurityHeaderProfileBytes
  );
  const entries = dataArray(input.webAssets, parsedProfile.limits.maximumAssets,
    "public_readback_asset_invalid", step);
  if (entries.length === 0) failEvidence("public_readback_asset_invalid", step);
  const assets = entries.map((entry) => normalizeAsset(
    entry,
    security.profileSha256,
    step
  ));
  let totalBytes = 0;
  for (let index = 0; index < assets.length; index += 1) {
    if (index > 0 && assets[index - 1].path >= assets[index].path) {
      failEvidence("public_readback_asset_order_invalid", step);
    }
    let url;
    try {
      url = new URL(assets[index].path, origin.href);
    } catch {
      failEvidence("public_readback_asset_path_invalid", step);
    }
    if (url.origin !== origin.origin || url.pathname !== assets[index].path ||
        url.search !== "" || url.hash !== "") {
      failEvidence("public_readback_asset_path_invalid", step);
    }
    totalBytes += assets[index].byteLength;
    if (!Number.isSafeInteger(totalBytes) ||
        totalBytes > parsedProfile.limits.maximumTotalBytes) {
      failEvidence("public_readback_total_byte_limit", step);
    }
  }
  const bootstraps = assets.filter((entry) => entry.role === "bootstrap");
  const workers = assets.filter((entry) => entry.role === "service-worker");
  const modelPath = (entry) => entry.toLowerCase().includes("/models/") ||
    /\.(?:acg2|gguf|prompt2|safetensors|sampling2|slm|slm2|template2|tokenizer2)$/u
      .test(entry.toLowerCase());
  if (bootstraps.length !== 1 || bootstraps[0].path !== "/" ||
      bootstraps[0].contentType !== "text/html" ||
      bootstraps[0].cachePolicy !== "no-store" || workers.length > 1 ||
      workers.some((entry) => entry.contentType !== "application/javascript" ||
        entry.cachePolicy !== "no-cache") || assets.some((entry) =>
        modelPath(entry.path) || entry.cachePolicy === "immutable" &&
          !entry.path.includes(entry.sha256))) {
    failEvidence("public_readback_web_graph_invalid", step);
  }
  return Object.freeze({ assets: Object.freeze(assets), origin, security, totalBytes });
}

function parseRawHeaders(rawHeaders) {
  const step = "public-readback-response-headers";
  const entries = dataArray(rawHeaders,
    parsedProfile.limits.maximumHeaderCount * 2,
    "public_readback_headers_invalid", step);
  if (entries.length % 2 !== 0 ||
      entries.length / 2 > parsedProfile.limits.maximumHeaderCount) {
    failEvidence("public_readback_headers_invalid", step);
  }
  let totalBytes = 0;
  const headers = new Map();
  for (let index = 0; index < entries.length; index += 2) {
    const rawName = entries[index];
    const value = entries[index + 1];
    if (typeof rawName !== "string" || typeof value !== "string") {
      failEvidence("public_readback_headers_invalid", step);
    }
    const name = rawName.toLowerCase();
    if (!headerNamePattern.test(name) || value !== value.trim() ||
        !/^[\x20-\x7e]*$/u.test(value)) {
      failEvidence("public_readback_headers_invalid", step);
    }
    totalBytes += Buffer.byteLength(rawName, "latin1") +
      Buffer.byteLength(value, "latin1") + 4;
    if (totalBytes > parsedProfile.limits.maximumHeaderBytes) {
      failEvidence("public_readback_header_byte_limit", step);
    }
    if (!headers.has(name)) headers.set(name, []);
    headers.get(name).push(value);
  }
  return headers;
}

function exactlyOneHeader(headers, name, code, step) {
  const values = headers.get(name);
  if (!values || values.length !== 1) failEvidence(code, step);
  return values[0];
}

function contentTypeMatches(value, expected) {
  const parts = value.split(";").map((entry) => entry.trim());
  const mediaType = parts.shift().toLowerCase();
  if (mediaType !== expected) return false;
  if (parts.length === 0) return true;
  const parameterEligible = expected.startsWith("text/") ||
    expected === "application/json" || expected === "application/javascript" ||
    expected === "application/manifest+json" || expected.endsWith("+json") ||
    expected.endsWith("+xml");
  return parameterEligible && parts.length === 1 &&
    parts[0].toLowerCase() === "charset=utf-8";
}

function verifyVnextReadbackResponseMetadata(rawInput) {
  const step = "public-readback-response-metadata";
  const input = exactDataObject(rawInput, responseMetadataFields,
    "public_readback_response_input_invalid", step);
  const security = validateVnextWebSecurityHeaderProfileBytes(
    input.securityHeaderProfileBytes
  );
  const asset = normalizeAsset(input.asset, security.profileSha256, step);
  if (!Number.isSafeInteger(input.statusCode) ||
      input.statusCode !== parsedProfile.response.requiredStatus) {
    failEvidence("public_readback_status_invalid", step);
  }
  const headers = parseRawHeaders(input.rawHeaders);
  for (const forbidden of security.profile.forbiddenResponseHeaders) {
    if (headers.has(forbidden)) {
      failEvidence("public_readback_forbidden_header", step);
    }
  }
  const contentLength = exactlyOneHeader(headers, "content-length",
    "public_readback_content_length_invalid", step);
  if (!/^(?:0|[1-9]\d*)$/u.test(contentLength) ||
      Number(contentLength) !== asset.byteLength) {
    failEvidence("public_readback_content_length_invalid", step);
  }
  const contentType = exactlyOneHeader(headers, "content-type",
    "public_readback_content_type_invalid", step);
  if (!contentTypeMatches(contentType, asset.contentType)) {
    failEvidence("public_readback_content_type_invalid", step);
  }
  const cacheControl = exactlyOneHeader(headers, "cache-control",
    "public_readback_cache_control_invalid", step);
  if (cacheControl !== security.cacheControlByPolicy[asset.cachePolicy]) {
    failEvidence("public_readback_cache_control_invalid", step);
  }
  for (const [name, expected] of Object.entries(security.headersByName)) {
    const actual = exactlyOneHeader(headers, name,
      "public_readback_security_header_invalid", step);
    if (actual !== expected) {
      failEvidence("public_readback_security_header_invalid", step);
    }
  }
  return deepFreeze({
    byteLength: asset.byteLength,
    cacheControl,
    contentType: asset.contentType,
    path: asset.path,
    securityHeaderProfileSha256: security.profileSha256,
    sha256: asset.sha256,
    statusCode: input.statusCode
  });
}

function createBodyAccumulator(asset) {
  const hash = crypto.createHash("sha256");
  let byteLength = 0;
  let finished = false;
  return Object.freeze({
    write(chunk) {
      if (finished || !Buffer.isBuffer(chunk)) {
        failEvidence("public_readback_body_chunk_invalid", "public-readback-body");
      }
      byteLength += chunk.length;
      if (!Number.isSafeInteger(byteLength) || byteLength > asset.byteLength) {
        failEvidence("public_readback_body_overflow", "public-readback-body");
      }
      hash.update(chunk);
    },
    finish() {
      if (finished) {
        failEvidence("public_readback_body_already_finished", "public-readback-body");
      }
      finished = true;
      const bodySha256 = hash.digest("hex");
      if (byteLength !== asset.byteLength) {
        failEvidence("public_readback_body_length_mismatch", "public-readback-body");
      }
      if (bodySha256 !== asset.sha256) {
        failEvidence("public_readback_body_hash_mismatch", "public-readback-body");
      }
      return Object.freeze({ byteLength, sha256: bodySha256 });
    }
  });
}

function verifyVnextReadbackBodyChunks(rawInput) {
  const step = "public-readback-body-fixture";
  const input = exactDataObject(rawInput, bodyVerificationFields,
    "public_readback_body_input_invalid", step);
  const asset = exactDataObject(input.asset, assetFields,
    "public_readback_body_input_invalid", step);
  if (!Number.isSafeInteger(asset.byteLength) || asset.byteLength <= 0 ||
      !digestPattern.test(asset.sha256)) {
    failEvidence("public_readback_body_input_invalid", step);
  }
  const chunks = dataArray(input.chunks, 65_536,
    "public_readback_body_input_invalid", step);
  const accumulator = createBodyAccumulator(asset);
  for (const chunk of chunks) accumulator.write(chunk);
  return accumulator.finish();
}

async function resolvePublicAddresses(hostname) {
  const step = "public-readback-dns";
  let resolved;
  try {
    resolved = await dnsLookup(hostname, { all: true, verbatim: true });
  } catch {
    failEvidence("public_readback_dns_failed", step);
  }
  if (!Array.isArray(resolved) || resolved.length === 0 ||
      resolved.length > parsedProfile.limits.maximumDnsAddresses) {
    failEvidence("public_readback_dns_result_invalid", step);
  }
  const unique = new Map();
  for (const rawEntry of resolved) {
    const entry = exactDataObject(rawEntry, ["address", "family"],
      "public_readback_dns_result_invalid", step);
    const canonicalAddress = canonicalNetworkAddress(entry.address);
    if (typeof entry.address !== "string" || ![4, 6].includes(entry.family) ||
        net.isIP(entry.address) !== entry.family ||
        canonicalAddress === null || net.isIP(canonicalAddress) !== entry.family ||
        !isVnextPublicNetworkAddress(canonicalAddress)) {
      failEvidence("public_readback_dns_nonpublic", step);
    }
    unique.set(`${entry.family}:${canonicalAddress}`, Object.freeze({
      address: canonicalAddress,
      family: entry.family
    }));
  }
  const addresses = [...unique.values()].sort((left, right) =>
    left.family - right.family || left.address.localeCompare(right.address));
  if (addresses.length === 0) failEvidence("public_readback_dns_result_invalid", step);
  return Object.freeze(addresses);
}

function normalizedRemoteAddress(value) {
  if (typeof value !== "string") return null;
  const match = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/iu.exec(value);
  return match ? match[1] : value;
}

function canonicalNetworkAddress(value) {
  const normalized = normalizedRemoteAddress(value);
  const family = net.isIP(normalized);
  if (family === 0) return null;
  try {
    return new net.SocketAddress({
      address: normalized,
      family: family === 4 ? "ipv4" : "ipv6",
      port: 443
    }).address;
  } catch {
    return null;
  }
}

function openPinnedResponse(origin, asset, address, signal) {
  return new Promise((resolve, reject) => {
    let responseStarted = false;
    let settled = false;
    const request = httpsRequest({
      protocol: "https:",
      hostname: origin.hostname,
      port: origin.port,
      path: asset.path,
      method: parsedProfile.request.method,
      headers: requestHeaders,
      agent: false,
      maxHeaderSize: parsedProfile.limits.maximumHeaderBytes,
      minVersion: "TLSv1.2",
      rejectUnauthorized: true,
      servername: origin.hostname,
      signal,
      lookup(_hostname, _options, callback) {
        callback(null, address.address, address.family);
      }
    }, (response) => {
      responseStarted = true;
      if (!settled) {
        settled = true;
        resolve(response);
      }
    });
    request.setTimeout(parsedProfile.limits.maximumRequestMilliseconds, () => {
      request.destroy(new AddressTransportError());
    });
    request.once("error", () => {
      if (!settled) {
        settled = true;
        reject(responseStarted ? new Error("response stream failed") :
          new AddressTransportError());
      }
    });
    request.end();
  });
}

async function fetchPinnedAsset(origin, asset, address, security, signal) {
  const response = await openPinnedResponse(origin, asset, address, signal);
  let metadata;
  try {
    metadata = verifyVnextReadbackResponseMetadata({
      asset,
      rawHeaders: response.rawHeaders,
      securityHeaderProfileBytes: security.bytes,
      statusCode: response.statusCode
    });
  } catch (error) {
    response.destroy();
    throw error;
  }
  const socket = response.socket;
  const remoteAddress = canonicalNetworkAddress(socket?.remoteAddress);
  const expectedAddress = canonicalNetworkAddress(address.address);
  const protocol = socket?.getProtocol?.();
  const certificate = socket?.getPeerCertificate?.(true);
  if (socket?.authorized !== true || socket.authorizationError != null ||
      remoteAddress === null || remoteAddress !== expectedAddress ||
      !isVnextPublicNetworkAddress(remoteAddress) ||
      !["TLSv1.2", "TLSv1.3"].includes(protocol) ||
      !certificate || !Buffer.isBuffer(certificate.raw) || certificate.raw.length === 0) {
    response.destroy();
    failEvidence("public_readback_tls_binding_invalid", "public-readback-tls");
  }
  const accumulator = createBodyAccumulator(asset);
  try {
    for await (const chunk of response) {
      accumulator.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
  } catch (error) {
    response.destroy();
    if (error instanceof VnextEvidenceError) throw error;
    failEvidence("public_readback_body_stream_failed", "public-readback-body");
  }
  if (response.complete !== true) {
    failEvidence("public_readback_body_incomplete", "public-readback-body");
  }
  const body = accumulator.finish();
  return Object.freeze({
    certificateSha256: sha256(certificate.raw),
    observation: Object.freeze({
      ...metadata,
      byteLength: body.byteLength,
      sha256: body.sha256,
      tlsProtocol: protocol
    })
  });
}

function immutableResult(value, bytes) {
  const result = { ...value };
  Object.defineProperty(result, "resultBytes", {
    enumerable: true,
    get() {
      return Buffer.from(bytes);
    }
  });
  return Object.freeze(result);
}

async function performVnextPublicHttpsReadback(rawInput) {
  const input = normalizeInput(rawInput);
  const addresses = await resolvePublicAddresses(input.origin.hostname);
  const controller = new AbortController();
  const operationTimer = setTimeout(() => controller.abort(),
    parsedProfile.limits.maximumOperationMilliseconds);
  operationTimer.unref?.();
  const observations = [];
  const certificateHashes = new Set();
  let selectedAddress = null;
  const bootstrap = input.assets.find((asset) => asset.path === "/");
  try {
    for (const address of addresses) {
      try {
        const result = await fetchPinnedAsset(
          input.origin,
          bootstrap,
          address,
          input.security,
          controller.signal
        );
        selectedAddress = address;
        observations.push(result.observation);
        certificateHashes.add(result.certificateSha256);
        break;
      } catch (error) {
        if (controller.signal.aborted) {
          failEvidence("public_readback_operation_timeout", "public-readback-timeout");
        }
        if (!(error instanceof AddressTransportError)) throw error;
      }
    }
    if (selectedAddress === null) {
      failEvidence("public_readback_origin_unreachable", "public-readback-connect");
    }
    for (const asset of input.assets) {
      if (asset.path === "/") continue;
      let result;
      try {
        result = await fetchPinnedAsset(
          input.origin,
          asset,
          selectedAddress,
          input.security,
          controller.signal
        );
      } catch (error) {
        if (controller.signal.aborted) {
          failEvidence("public_readback_operation_timeout", "public-readback-timeout");
        }
        if (error instanceof AddressTransportError) {
          failEvidence("public_readback_pinned_address_unreachable",
            "public-readback-connect");
        }
        throw error;
      }
      observations.push(result.observation);
      certificateHashes.add(result.certificateSha256);
      if (certificateHashes.size > parsedProfile.limits.maximumCertificates) {
        failEvidence("public_readback_certificate_limit", "public-readback-tls");
      }
    }
    if (controller.signal.aborted) {
      failEvidence("public_readback_operation_timeout", "public-readback-timeout");
    }
  } finally {
    clearTimeout(operationTimer);
  }
  observations.sort((left, right) => left.path.localeCompare(right.path));
  const dnsSet = addresses.map((entry) => `${entry.family}:${entry.address}`).sort();
  const certificateSet = [...certificateHashes].sort();
  const result = deepFreeze({
    schema: parsedProfile.resultSchema,
    profileId: parsedProfile.profileId,
    profileSha256: publicHttpsReadbackProfileSha256,
    verifierSourceSha256: sourceSha256,
    publicOrigin: input.origin.href,
    assetCount: observations.length,
    totalBytes: observations.reduce((total, entry) => total + entry.byteLength, 0),
    dnsAddressCount: addresses.length,
    certificateCount: certificateSet.length,
    observationInventorySha256: domainSeparatedDigest(
      parsedProfile.observation.inventoryIdentityDomain,
      observations
    ),
    dnsAddressSetSha256: domainSeparatedDigest(
      parsedProfile.observation.dnsIdentityDomain,
      dnsSet
    ),
    pinnedAddressSha256: domainSeparatedDigest(
      parsedProfile.observation.pinnedAddressIdentityDomain,
      `${selectedAddress.family}:${selectedAddress.address}`
    ),
    certificateSetSha256: domainSeparatedDigest(
      parsedProfile.observation.certificateIdentityDomain,
      certificateSet
    ),
    securityHeaderProfileSha256: input.security.profileSha256,
    observations
  });
  if (result.assetCount !== input.assets.length ||
      result.totalBytes !== input.totalBytes) {
    failEvidence("public_readback_observation_closure_invalid",
      "public-readback-result");
  }
  const resultBytes = canonicalizeVnextJcsBytes(result);
  if (resultBytes.length > parsedProfile.limits.maximumResultBytes) {
    failEvidence("public_readback_result_byte_limit", "public-readback-result");
  }
  return immutableResult({
    ...result,
    resultSha256: sha256(resultBytes)
  }, resultBytes);
}

module.exports = Object.freeze({
  isVnextPublicNetworkAddress,
  normalizeVnextPublicHttpsOrigin,
  performVnextPublicHttpsReadback,
  publicHttpsReadbackProfile,
  publicHttpsReadbackProfileSha256,
  validateVnextWebSecurityHeaderProfileBytes,
  verifyVnextReadbackBodyChunks,
  verifyVnextReadbackResponseMetadata
});
