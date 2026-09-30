(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.TinyRustLMMiniModelCatalogV1 = factory();
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CATALOG_SCHEMA = "minimodel.slm2_catalog.v1";
  const PEER_SCHEMA = "minimodel.slm2_peer_announcements.v1";
  const BROWSER_ADMISSION_SCHEMA = "tinyrustlm.browser-composition-admission/1";
  const QUALIFICATION_RECEIPT_SCHEMA = "tinyrustlm.qualification-receipt/1";
  const PEER_PROOF_SCHEMA = "tinyrustlm.peer-announcement-proof/1";
  const PIECE_SET_SCHEMA = "tinyrustlm.direct-composition-piece-set/1";
  const DIRECT_COMPOSITION_PROTOCOL_PROFILE =
    "tinyrustlm.direct-composition-http.v1";
  const CATALOG_URL = "https://minimodel.org/catalog/compositions.v1.json";
  const PEER_FEED_URL = "https://minimodel.org/catalog/peer-announcements.v1.json";
  const MAXIMUM_METADATA_BYTES = 1024 * 1024;
  const MAXIMUM_METADATA_CHUNKS = 4096;
  const MAXIMUM_JSON_DEPTH = 32;
  const MAXIMUM_JSON_VALUES = 65536;
  const MAXIMUM_JSON_STRING_LENGTH = 256 * 1024;
  const MAXIMUM_BROWSER_ADMISSION_BYTES = 64 * 1024;
  const MAXIMUM_QUALIFICATION_RECEIPT_BYTES = 128 * 1024;
  const DEFAULT_TIMEOUT_MILLISECONDS = 10000;
  const MAXIMUM_TIMEOUT_MILLISECONDS = 60000;
  const MAXIMUM_SOURCE_AGE_MILLISECONDS = 24 * 60 * 60 * 1000;
  const MAXIMUM_FUTURE_SKEW_MILLISECONDS = 5 * 60 * 1000;
  const MAXIMUM_SOURCE_LIFETIME_MILLISECONDS = 24 * 60 * 60 * 1000;
  const MAXIMUM_ENTRIES = 128;
  const MAXIMUM_ANNOUNCEMENTS = 512;
  const MAXIMUM_VERIFICATION_KEYS = 32;
  const MAXIMUM_REVOCATIONS = 1024;
  const MAXIMUM_SUPERSESSIONS = 1024;
  const DOCUMENT_METADATA = new WeakMap();
  const SOURCE_TYPES = Object.freeze({
    CATALOG: "catalog",
    PEER_FEED: "peer-feed"
  });
  const SOURCE_STATUSES = Object.freeze({
    VALID: "valid",
    INVALID: "invalid"
  });
  // Catalog wire order is canonical and matches the direct P2P installer.
  const MEMBER_NAMES = Object.freeze([
    "model.slm2",
    "tokenizer.tokenizer2",
    "template.template2",
    "sampling.sampling2",
    "prompt.prompt2",
    "composition.acg2"
  ]);
  const DIRECT_COMPOSITION_ROUTE_PREFIX = "/tinyrustlm/direct-composition/v1";

  const DIRECT_PEER_DENIED_HOSTS = Object.freeze([
    "tinyrustlm.com",
    "minimodel.org",
    "slmcomposer.com",
    "lmcomposer.com",
    "mirust.com",
    "uaix.org",
    "memoryendpoints.com",
    "huggingface.co"
  ]);

  class MiniModelCatalogError extends Error {
    constructor(code, message) {
      super(message || code);
      this.name = "MiniModelCatalogError";
      this.code = code;
    }
  }

  function reject(code, message) {
    throw new MiniModelCatalogError(code, message);
  }

  // Parses bounded canonical JSON without JSON.parse, duplicate-key collapse, or revivers.
  function parseCanonicalJsonText(value, maximumBytes = MAXIMUM_METADATA_BYTES) {
    if (typeof value !== "string" || !Number.isSafeInteger(maximumBytes) ||
        maximumBytes < 1 || maximumBytes > MAXIMUM_METADATA_BYTES) {
      reject("json", "canonical JSON input was invalid");
    }
    let encodedLength;
    try {
      encodedLength = new TextEncoder().encode(value).byteLength;
    } catch (_error) {
      reject("json", "canonical JSON text encoding was unavailable");
    }
    if (encodedLength < 2 || encodedLength > maximumBytes || !value.endsWith("\n")) {
      reject("json", "metadata was not bounded canonical JSON");
    }

    let index = 0;
    let values = 0;
    const end = value.length - 1;

    // Reads one JSON string and rejects malformed escapes and unpaired surrogates.
    function parseString() {
      if (value[index] !== "\"") reject("json", "metadata JSON string was invalid");
      index += 1;
      let result = "";
      while (index < end) {
        const character = value[index];
        index += 1;
        if (character === "\"") {
          if (result.length > MAXIMUM_JSON_STRING_LENGTH) {
            reject("json", "metadata JSON string exceeded its limit");
          }
          return result;
        }
        if (character === "\\") {
          if (index >= end) reject("json", "metadata JSON escape was truncated");
          const escape = value[index];
          index += 1;
          const simple = Object.freeze({
            "\"": "\"", "\\": "\\", "/": "/", b: "\b", f: "\f",
            n: "\n", r: "\r", t: "\t"
          });
          if (Object.hasOwn(simple, escape)) {
            result += simple[escape];
            continue;
          }
          if (escape !== "u" || index + 4 > end) {
            reject("json", "metadata JSON escape was invalid");
          }
          const digits = value.slice(index, index + 4);
          if (!/^[0-9a-fA-F]{4}$/u.test(digits)) {
            reject("json", "metadata JSON Unicode escape was invalid");
          }
          index += 4;
          const first = Number.parseInt(digits, 16);
          if (first >= 0xd800 && first <= 0xdbff) {
            if (value.slice(index, index + 2) !== "\\u" || index + 6 > end) {
              reject("json", "metadata JSON surrogate pair was invalid");
            }
            const trailingDigits = value.slice(index + 2, index + 6);
            if (!/^[dD][c-fC-F][0-9a-fA-F]{2}$/u.test(trailingDigits)) {
              reject("json", "metadata JSON surrogate pair was invalid");
            }
            result += String.fromCodePoint(
              0x10000 + ((first - 0xd800) << 10) +
              (Number.parseInt(trailingDigits, 16) - 0xdc00)
            );
            index += 6;
          } else if (first >= 0xdc00 && first <= 0xdfff) {
            reject("json", "metadata JSON surrogate pair was invalid");
          } else {
            result += String.fromCharCode(first);
          }
          continue;
        }
        const codeUnit = character.charCodeAt(0);
        if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
          // A literal scalar above U+FFFF occupies two UTF-16 code units.
          const trailing = value.charCodeAt(index);
          if (index >= end || !(trailing >= 0xdc00 && trailing <= 0xdfff)) {
            reject("json", "metadata JSON surrogate pair was invalid");
          }
          result += character + value[index++];
          continue;
        }
        if (codeUnit < 0x20 || (codeUnit >= 0xdc00 && codeUnit <= 0xdfff)) {
          reject("json", "metadata JSON string contained an invalid character");
        }
        result += character;
      }
      reject("json", "metadata JSON string was unterminated");
    }

    // Reads one canonical JSON value under explicit depth and value-count ceilings.
    function parseValue(depth) {
      values += 1;
      if (depth > MAXIMUM_JSON_DEPTH || values > MAXIMUM_JSON_VALUES || index >= end) {
        reject("json", "metadata JSON exceeded its structural limits");
      }
      const character = value[index];
      if (character === "\"") return parseString();
      if (character === "{") {
        index += 1;
        const result = Object.create(null);
        const keys = new Set();
        if (value[index] === "}") {
          index += 1;
          return result;
        }
        while (index < end) {
          const key = parseString();
          if (keys.has(key)) reject("json-duplicate-key", "metadata JSON repeated an object key");
          keys.add(key);
          if (value[index] !== ":") reject("json", "metadata JSON object was invalid");
          index += 1;
          result[key] = parseValue(depth + 1);
          if (value[index] === "}") {
            index += 1;
            return result;
          }
          if (value[index] !== ",") reject("json", "metadata JSON object was invalid");
          index += 1;
        }
        reject("json", "metadata JSON object was unterminated");
      }
      if (character === "[") {
        index += 1;
        const result = [];
        if (value[index] === "]") {
          index += 1;
          return result;
        }
        while (index < end) {
          result.push(parseValue(depth + 1));
          if (value[index] === "]") {
            index += 1;
            return result;
          }
          if (value[index] !== ",") reject("json", "metadata JSON array was invalid");
          index += 1;
        }
        reject("json", "metadata JSON array was unterminated");
      }
      for (const [token, parsed] of [["true", true], ["false", false], ["null", null]]) {
        if (value.startsWith(token, index)) {
          index += token.length;
          return parsed;
        }
      }
      const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/u.exec(
        value.slice(index, end)
      );
      if (!match) reject("json", "metadata JSON value was invalid");
      index += match[0].length;
      const number = Number(match[0]);
      if (!Number.isFinite(number)) reject("json", "metadata JSON number was invalid");
      return number;
    }

    const parsed = parseValue(0);
    if (index !== end) reject("json", "metadata JSON had trailing content");
    let canonical;
    try {
      canonical = `${JSON.stringify(parsed)}\n`;
    } catch (_error) {
      reject("json", "metadata JSON could not be canonicalized");
    }
    if (canonical !== value) reject("json-canonical", "metadata JSON bytes were not canonical");
    return parsed;
  }

  // Incrementally decodes bounded UTF-8 and parses only after the complete stream closes.
  function createCanonicalJsonStreamParser(maximumBytes = MAXIMUM_METADATA_BYTES) {
    if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1 ||
        maximumBytes > MAXIMUM_METADATA_BYTES) {
      reject("json", "canonical JSON byte limit was invalid");
    }
    let decoder;
    try {
      // Preserve a leading BOM so canonical parsing rejects it instead of repairing bytes.
      decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
    } catch (_error) {
      reject("json", "metadata UTF-8 decoder was unavailable");
    }
    let byteLength = 0;
    let text = "";
    let finished = false;
    return Object.freeze({
      push(chunk) {
        if (finished || !(chunk instanceof Uint8Array) || chunk.byteLength < 1 ||
            chunk.byteLength > maximumBytes - byteLength) {
          reject("metadata-size", "metadata response exceeded the byte limit");
        }
        byteLength += chunk.byteLength;
        try {
          text += decoder.decode(chunk, { stream: true });
        } catch (_error) {
          reject("json", "metadata response was not valid UTF-8");
        }
      },
      finish() {
        if (finished) reject("json", "metadata parser was already finished");
        finished = true;
        try {
          text += decoder.decode();
        } catch (_error) {
          reject("json", "metadata response was not valid UTF-8");
        }
        return Object.freeze({
          value: parseCanonicalJsonText(text, maximumBytes),
          text,
          byteLength
        });
      }
    });
  }

  function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function requireObject(value, label) {
    if (!isObject(value)) {
      reject("object", `${label} must be an object`);
    }
    return value;
  }

  function requireExactKeys(value, expected, label) {
    const actual = Object.keys(requireObject(value, label)).sort();
    const wanted = [...expected].sort();
    if (actual.length !== wanted.length ||
        actual.some((key, index) => key !== wanted[index])) {
      reject("fields", `${label} has an unknown or missing field`);
    }
  }

  function requireString(value, label, maximum = 512) {
    if (typeof value !== "string" || value.length < 1 || value.length > maximum ||
        value !== value.trim() || /[\u0000-\u001f\u007f\ud800-\udfff]/u.test(value)) {
      reject("string", `${label} must be a bounded printable string`);
    }
    return value;
  }

  function strictIpv4Octets(hostname) {
    const parts = String(hostname || "").split(".");
    if (parts.length !== 4 || parts.some((part) =>
      !/^(?:0|[1-9][0-9]{0,2})$/u.test(part))) {
      return null;
    }
    const octets = parts.map(Number);
    return octets.some((octet) => octet > 255) ? null : octets;
  }

  function isPublicIpv4(octets) {
    const [first, second, third] = octets;
    return !(first === 0 || first === 10 || first === 127 || first >= 224 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 0) ||
      (first === 192 && second === 168) ||
      (first === 198 && (second === 18 || second === 19)) ||
      (first === 198 && second === 51 && third === 100) ||
      (first === 203 && second === 0 && third === 113));
  }

  function ipv6Words(hostname) {
    const host = String(hostname || "").replace(/^\[|\]$/gu, "").toLowerCase();
    if (!host || host.includes("%") || host.includes(".")) return null;
    const halves = host.split("::");
    if (halves.length > 2) return null;
    const parseHalf = (half) => half
      ? half.split(":").map((part) =>
        /^[0-9a-f]{1,4}$/u.test(part) ? Number.parseInt(part, 16) : NaN)
      : [];
    const left = parseHalf(halves[0]);
    const right = halves.length === 2 ? parseHalf(halves[1]) : [];
    if (left.some(Number.isNaN) || right.some(Number.isNaN)) return null;
    if (halves.length === 1) return left.length === 8 ? left : null;
    const omitted = 8 - left.length - right.length;
    return omitted > 0
      ? [...left, ...new Array(omitted).fill(0), ...right]
      : null;
  }

  function isPublicIpv6(words) {
    if (!words || (words[0] & 0xe000) !== 0x2000) return false;
    if (words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff) {
      return false;
    }
    if (words[0] === 0x2002 || words[0] === 0x3ffe) return false;
    if (words[0] !== 0x2001) return true;
    if (words[1] === 0 || words[1] === 0x0db8) return false;
    if (words[1] === 2 && words[2] === 0) return false;
    return (words[1] & 0xfff0) !== 0x0010 &&
      (words[1] & 0xfff0) !== 0x0020;
  }

  function isDeniedDirectPeerHost(hostname) {
    const host = String(hostname || "").toLowerCase();
    return DIRECT_PEER_DENIED_HOSTS.some((denied) =>
      host === denied || host.endsWith(`.${denied}`)
    );
  }

  function requirePublicDnsName(hostname) {
    if (hostname.length > 253 || !hostname.includes(".") ||
        !/^[a-z0-9.-]+$/u.test(hostname) || hostname.includes("..") ||
        hostname.split(".").some((label) =>
          !label || label.length > 63 || label.startsWith("-") || label.endsWith("-"))) {
      reject("peer-url", "direct peer host must be public DNS or a supported IP literal");
    }
    if (/(?:^|\.)(?:example|internal|invalid|lan|local|localhost|test)$/u.test(hostname) ||
        hostname.endsWith(".home.arpa") ||
        ["example.com", "example.net", "example.org"].some((reserved) =>
          hostname === reserved || hostname.endsWith(`.${reserved}`))) {
      reject("peer-url", "direct peer host must not use a local or reserved DNS name");
    }
  }

  function splitDirectPeerAuthority(authority) {
    if (!authority || /[%@\\\s\u0000-\u001f\u007f]/u.test(authority)) {
      reject("peer-url", "direct peer URL authority contains an encoded or unsafe alias");
    }
    let host;
    let portText = "";
    if (authority.startsWith("[")) {
      const closing = authority.indexOf("]");
      if (closing < 0) {
        reject("peer-url", "direct peer IPv6 host must be bracketed");
      }
      host = authority.slice(0, closing + 1);
      const suffix = authority.slice(closing + 1);
      if (suffix) {
        if (!/^:[0-9]{1,5}$/u.test(suffix)) {
          reject("peer-url", "direct peer port is invalid");
        }
        portText = suffix.slice(1);
      }
    } else {
      if ((authority.match(/:/gu) || []).length > 1) {
        reject("peer-url", "direct peer IPv6 host must be bracketed");
      }
      const separator = authority.lastIndexOf(":");
      if (separator >= 0) {
        host = authority.slice(0, separator);
        portText = authority.slice(separator + 1);
        if (!/^[0-9]{1,5}$/u.test(portText)) {
          reject("peer-url", "direct peer port is invalid");
        }
      } else {
        host = authority;
      }
    }
    if (!host || host.endsWith(".")) {
      reject("peer-url", "direct peer host must not be empty or end in a dot");
    }
    if (portText) {
      const port = Number(portText);
      if (!Number.isInteger(port) || port < 1 || port > 65535 || String(port) !== portText) {
        reject("peer-url", "direct peer port must be an integer from 1 through 65535");
      }
    }
    return Object.freeze({ host, portText });
  }

  // Admits a public HTTPS IP literal or one exact loopback origin for local transfer.
  function normalizeDirectPeerBaseUrl(value, options = {}) {
    const raw = requireString(value, "direct peer URL", 512);
    const match = /^(https?):\/\/([^/?#]+)(\/?)$/iu.exec(raw);
    if (!match) {
      reject("peer-url", "direct peer URL must be an absolute root HTTP(S) origin");
    }
    const rawProtocol = `${match[1].toLowerCase()}:`;
    const authority = splitDirectPeerAuthority(match[2]);
    let parsed;
    try {
      parsed = new URL(raw);
    } catch (_error) {
      reject("peer-url", "direct peer URL must be an absolute root HTTP(S) origin");
    }
    if (parsed.protocol !== rawProtocol || parsed.username || parsed.password ||
        parsed.search || parsed.hash || parsed.pathname !== "/") {
      reject("peer-url", "direct peer URL contains credentials or an unexpected endpoint path");
    }

    const rawHost = authority.host.toLowerCase();
    const parsedHost = parsed.hostname.toLowerCase();
    const bareHost = parsedHost.replace(/^\[|\]$/gu, "");
    // The operator-owned bootstrap seed uses normal HTTPS certificate validation.
    const bootstrapSeed = rawHost === "minimodel.org" &&
      parsed.origin === "https://minimodel.org";
    const exactLoopback =
      (rawHost === "127.0.0.1" && parsedHost === "127.0.0.1") ||
      (rawHost === "[::1]" && parsedHost === "[::1]");
    if (rawProtocol !== "https:" && !exactLoopback) {
      reject("peer-url", "direct peer HTTP requires an exact loopback IP literal");
    }
    if (!bootstrapSeed && isDeniedDirectPeerHost(bareHost)) {
      reject("peer-url", "project and service hosts cannot serve direct peer model bytes");
    }
    if (exactLoopback || bootstrapSeed) {
      // Exact textual matching above rejects numeric aliases and noncanonical IPv6 forms.
    } else if (parsedHost.startsWith("[")) {
      if (!isPublicIpv6(ipv6Words(parsedHost))) {
        reject("peer-url", "direct peer IPv6 address must be public and non-reserved");
      }
    } else {
      const ipv4 = strictIpv4Octets(parsedHost);
      if (ipv4) {
        if (rawHost !== parsedHost) {
          reject("peer-url", "direct peer IPv4 host must not use a numeric alias");
        }
        if (!isPublicIpv4(ipv4)) {
          reject("peer-url", "direct peer IPv4 address must be public and non-reserved");
        }
      } else {
        requirePublicDnsName(parsedHost);
        reject(
          "peer-url-dns-unverifiable",
          "browser peer routes cannot pin DNS resolution and therefore require a public or loopback IP literal"
        );
      }
    }
    const normalized = `${parsed.origin}/`;
    let applicationOrigin = options && options.applicationOrigin;
    if (applicationOrigin === undefined && typeof globalThis === "object" &&
        globalThis.location && typeof globalThis.location.origin === "string") {
      applicationOrigin = globalThis.location.origin;
    }
    if (applicationOrigin !== undefined && applicationOrigin !== null) {
      let parsedApplicationOrigin;
      try {
        parsedApplicationOrigin = new URL(applicationOrigin);
      } catch (_error) {
        reject("peer-url", "application origin was invalid");
      }
      if (!/^https?:$/u.test(parsedApplicationOrigin.protocol) ||
          parsedApplicationOrigin.origin === "null" ||
          (!bootstrapSeed && parsedApplicationOrigin.origin === parsed.origin)) {
        reject("peer-url-app-origin", "the application origin cannot serve direct peer bytes");
      }
    }
    return normalized;
  }



  function buildDirectCompositionMemberUrl(peerBaseUrl, compositionId, fileName) {
    const baseUrl = normalizeDirectPeerBaseUrl(peerBaseUrl);
    if (!/^sha256:[a-f0-9]{64}$/u.test(compositionId) || !MEMBER_NAMES.includes(fileName)) {
      reject("peer-url", "direct composition member identity is invalid");
    }
    const path = `${DIRECT_COMPOSITION_ROUTE_PREFIX}/compositions/${compositionId}/members/${fileName}`;
    const endpoint = new URL(path, baseUrl);
    if (endpoint.pathname !== path || endpoint.search || endpoint.hash) {
      reject("peer-url", "direct composition member endpoint path is invalid");
    }
    return endpoint.toString();
  }

  /** Binds proof disposition to the admitted origin; operator renewal makes no outside-observation claim. */
  function requireDirectPeerProof(peerBaseUrl, status, receiptSha256) {
    const normalized = normalizeDirectPeerBaseUrl(peerBaseUrl);
    if (normalized === "https://minimodel.org/") {
      if (status !== "not-required-operator-seed" || receiptSha256 !== null) {
        reject("peer-proof", "operator seed requires its explicit disposition and a null outside-proof receipt");
      }
      return null;
    }
    if (status !== "current-passed") {
      reject("peer-proof", "third-party peer requires current outside proof");
    }
    return requireSha256(receiptSha256, "peer announcement.outside_proof_receipt_sha256");
  }

  const directPeerUrlAuthority = Object.freeze({
    buildCompositionMemberUrl: buildDirectCompositionMemberUrl,
    compositionRoutePrefix: DIRECT_COMPOSITION_ROUTE_PREFIX,
    normalizeBaseUrl: normalizeDirectPeerBaseUrl,
    requireProof: requireDirectPeerProof
  });

  function requireId(value, label) {
    const normalized = requireString(value, label, 128);
    if (!/^[a-z0-9][a-z0-9._/-]*$/u.test(normalized)) {
      reject("id", `${label} must be lower-case route-safe ASCII`);
    }
    return normalized;
  }

  function requireSha256(value, label) {
    const normalized = requireString(value, label, 71);
    if (!/^sha256:[a-f0-9]{64}$/u.test(normalized)) {
      reject("sha256", `${label} must be a lower-case prefixed SHA-256 identity`);
    }
    return normalized;
  }

  function requireUtc(value, label) {
    const normalized = requireString(value, label, 20);
    const milliseconds = Date.parse(normalized);
    const canonical = Number.isFinite(milliseconds)
      ? new Date(milliseconds).toISOString().replace(".000Z", "Z")
      : "";
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(normalized) ||
        !Number.isFinite(milliseconds) ||
        canonical !== normalized) {
      reject("timestamp", `${label} must be a UTC timestamp with second precision`);
    }
    return normalized;
  }

  // Requires one positive monotonic document revision.
  function requireRevision(value, label) {
    if (!Number.isSafeInteger(value) || value < 1 || value > Number.MAX_SAFE_INTEGER) {
      reject("revision", `${label} must be a positive safe integer`);
    }
    return value;
  }

  // Requires a canonical unpadded base64url value with an exact decoded length.
  function requireBase64Url(value, byteLength, label) {
    const expectedLength = Math.ceil(byteLength * 4 / 3);
    if (typeof value !== "string" || value.length !== expectedLength ||
        !/^[A-Za-z0-9_-]+$/u.test(value)) {
      reject("base64url", `${label} must be canonical unpadded base64url`);
    }
    const padding = "=".repeat((4 - (value.length % 4)) % 4);
    let decoded;
    try {
      if (typeof globalThis !== "object" || typeof globalThis.atob !== "function") {
        reject("base64url", `${label} decoder is unavailable`);
      }
      const binary = globalThis.atob(value.replaceAll("-", "+").replaceAll("_", "/") + padding);
      decoded = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    } catch (error) {
      if (error instanceof MiniModelCatalogError) throw error;
      reject("base64url", `${label} must be canonical unpadded base64url`);
    }
    if (decoded.byteLength !== byteLength) {
      reject("base64url", `${label} must have the required decoded length`);
    }
    let binary = "";
    for (const byte of decoded) binary += String.fromCharCode(byte);
    const canonical = globalThis.btoa(binary)
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/u, "");
    if (canonical !== value) {
      reject("base64url", `${label} must be canonical unpadded base64url`);
    }
    return value;
  }

  function decodeBase64Url(value, byteLength, label) {
    requireBase64Url(value, byteLength, label);
    const padding = "=".repeat((4 - (value.length % 4)) % 4);
    const binary = globalThis.atob(
      value.replaceAll("-", "+").replaceAll("_", "/") + padding
    );
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  // Enforces bounded current validity instead of treating any parseable date as fresh.
  function requireFreshWindow(generatedAtUtc, validUntilUtc, now, label) {
    const generated = Date.parse(requireUtc(generatedAtUtc, `${label}.generated_at_utc`));
    const validUntil = Date.parse(requireUtc(validUntilUtc, `${label}.valid_until_utc`));
    if (generated > now + MAXIMUM_FUTURE_SKEW_MILLISECONDS ||
        generated < now - MAXIMUM_SOURCE_AGE_MILLISECONDS ||
        validUntil <= now || validUntil <= generated ||
        validUntil - generated > MAXIMUM_SOURCE_LIFETIME_MILLISECONDS) {
      reject("freshness", `${label} is stale, future-dated, or has an excessive lifetime`);
    }
    return Object.freeze({ generated, validUntil });
  }

  function requireLocalRoute(value, label) {
    const route = requireString(value, label, 256);
    if (!/^\/[A-Za-z0-9._/-]+$/u.test(route) || route.includes("//") ||
        route.split("/").includes("..")) {
      reject("route", `${label} must be a safe same-origin route`);
    }
    return route;
  }

  function validateBrowserAdmission(value, label) {
    requireExactKeys(value, ["route", "bytes", "sha256"], label);
    requireLocalRoute(value.route, `${label}.route`);
    if (!Number.isSafeInteger(value.bytes) || value.bytes < 1 ||
        value.bytes > MAXIMUM_BROWSER_ADMISSION_BYTES) {
      reject(
        "browser-admission-bytes",
        `${label}.bytes must be a positive bounded safe integer`
      );
    }
    requireSha256(value.sha256, `${label}.sha256`);
    return value;
  }

  function requireProjectBoundary(value, includeInference, label) {
    if (typeof value.project_server_serves_model_bytes !== "boolean" ||
        value.project_server_proxies_model_bytes !== false ||
        (includeInference && value.project_server_runs_inference !== false)) {
      reject("project-boundary", `${label} must declare seed hosting and keep proxying and inference off project servers`);
    }
  }

  function validateMember(value, label) {
    requireExactKeys(value, ["name", "bytes", "sha256", "schema"], label);
    const name = requireString(value.name, `${label}.name`, 64);
    if (!MEMBER_NAMES.includes(name)) {
      reject("member-name", `${label}.name is not a current SLM2 member`);
    }
    if (!Number.isSafeInteger(value.bytes) || value.bytes <= 0) {
      reject("member-bytes", `${label}.bytes must be a positive safe integer`);
    }
    requireSha256(value.sha256, `${label}.sha256`);
    requireId(value.schema, `${label}.schema`);
    return value;
  }

  function validateCatalogEntry(value, label) {
    requireExactKeys(value, [
      "entry_id",
      "display_name",
      "description",
      "source",
      "license",
      "composition",
      "browser_admission",
      "profiles",
      "qualification",
      "peer_announcement_ids"
    ], label);
    requireId(value.entry_id, `${label}.entry_id`);
    requireString(value.display_name, `${label}.display_name`, 160);
    requireString(value.description, `${label}.description`, 1000);

    requireExactKeys(value.source, [
      "repository",
      "revision",
      "source_lock_sha256"
    ], `${label}.source`);
    if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/u.test(
      requireString(value.source.repository, `${label}.source.repository`, 160)
    )) {
      reject("source-repository", `${label}.source.repository must be an owner/model identity`);
    }
    if (!/^[a-f0-9]{40}$/u.test(
      requireString(value.source.revision, `${label}.source.revision`, 40)
    )) {
      reject("source-revision", `${label}.source.revision must be an immutable lower-case revision`);
    }
    requireSha256(value.source.source_lock_sha256, `${label}.source.source_lock_sha256`);

    requireExactKeys(value.license, ["route", "review_status"], `${label}.license`);
    requireLocalRoute(value.license.route, `${label}.license.route`);
    if (value.license.review_status !== "reviewed") {
      reject("license", `${label}.license.review_status must be reviewed`);
    }

    requireExactKeys(value.composition, [
      "composition_id",
      "member_count",
      "members"
    ], `${label}.composition`);
    requireSha256(value.composition.composition_id, `${label}.composition.composition_id`);
    if (value.composition.member_count !== MEMBER_NAMES.length ||
        !Array.isArray(value.composition.members) ||
        value.composition.members.length !== MEMBER_NAMES.length) {
      reject("member-count", `${label}.composition must contain exactly six members`);
    }
    value.composition.members.forEach((member, index) => {
      validateMember(member, `${label}.composition.members[${index}]`);
    });
    const expectedNames = [...MEMBER_NAMES].sort();
    const wireNames = value.composition.members.map((member) => member.name);
    const actualNames = [...wireNames].sort();
    if (actualNames.some((name, index) => name !== expectedNames[index])) {
      reject("member-set", `${label}.composition member set is not closed`);
    }
    if (wireNames.some((name, index) => name !== MEMBER_NAMES[index])) {
      reject(
        "member-order",
        `${label}.composition members must use canonical P2P six-member wire order`
      );
    }

    validateBrowserAdmission(value.browser_admission, `${label}.browser_admission`);

    requireExactKeys(value.profiles, [
      "conversion",
      "quantization",
      "runtime"
    ], `${label}.profiles`);
    requireId(value.profiles.conversion, `${label}.profiles.conversion`);
    requireId(value.profiles.quantization, `${label}.profiles.quantization`);
    requireId(value.profiles.runtime, `${label}.profiles.runtime`);

    requireExactKeys(value.qualification, [
      "status",
      "receipt_id",
      "receipt_route",
      "receipt_bytes",
      "receipt_sha256",
      "numerical_status",
      "browser_status",
      "quality_status"
    ], `${label}.qualification`);
    if (value.qualification.status !== "qualified" ||
        value.qualification.numerical_status !== "passed" ||
        value.qualification.browser_status !== "passed" ||
        value.qualification.quality_status !== "qualified") {
      reject("qualification", `${label}.qualification is incomplete`);
    }
    requireSha256(value.qualification.receipt_id, `${label}.qualification.receipt_id`);
    requireLocalRoute(value.qualification.receipt_route, `${label}.qualification.receipt_route`);
    if (!Number.isSafeInteger(value.qualification.receipt_bytes) ||
        value.qualification.receipt_bytes < 2 ||
        value.qualification.receipt_bytes > MAXIMUM_QUALIFICATION_RECEIPT_BYTES) {
      reject("qualification", `${label}.qualification.receipt_bytes is outside its bound`);
    }
    requireSha256(value.qualification.receipt_sha256, `${label}.qualification.receipt_sha256`);

    if (!Array.isArray(value.peer_announcement_ids) ||
        value.peer_announcement_ids.length > MAXIMUM_ANNOUNCEMENTS ||
        new Set(value.peer_announcement_ids).size !== value.peer_announcement_ids.length) {
      reject("peer-ids", `${label}.peer_announcement_ids must be a bounded unique array`);
    }
    value.peer_announcement_ids.forEach((item, index) => {
      requireId(item, `${label}.peer_announcement_ids[${index}]`);
    });
    return value;
  }

  function snapshotCatalogEntry(value) {
    return Object.freeze({
      entry_id: value.entry_id,
      display_name: value.display_name,
      description: value.description,
      source: Object.freeze({
        repository: value.source.repository,
        revision: value.source.revision,
        source_lock_sha256: value.source.source_lock_sha256
      }),
      license: Object.freeze({
        route: value.license.route,
        review_status: value.license.review_status
      }),
      composition: Object.freeze({
        composition_id: value.composition.composition_id,
        member_count: value.composition.member_count,
        members: Object.freeze(value.composition.members.map((member) => Object.freeze({
          name: member.name,
          bytes: member.bytes,
          sha256: member.sha256,
          schema: member.schema
        })))
      }),
      browser_admission: Object.freeze({
        route: value.browser_admission.route,
        bytes: value.browser_admission.bytes,
        sha256: value.browser_admission.sha256
      }),
      profiles: Object.freeze({
        conversion: value.profiles.conversion,
        quantization: value.profiles.quantization,
        runtime: value.profiles.runtime
      }),
      qualification: Object.freeze({
        status: value.qualification.status,
        receipt_id: value.qualification.receipt_id,
        receipt_route: value.qualification.receipt_route,
        receipt_bytes: value.qualification.receipt_bytes,
        receipt_sha256: value.qualification.receipt_sha256,
        numerical_status: value.qualification.numerical_status,
        browser_status: value.qualification.browser_status,
        quality_status: value.qualification.quality_status
      }),
      peer_announcement_ids: Object.freeze([...value.peer_announcement_ids])
    });
  }

  // Validates and snapshots one catalog-authorized Ed25519 peer verifier.
  function validatePeerVerificationKey(value, label, now) {
    requireExactKeys(value, [
      "key_id", "algorithm", "public_key_base64url", "not_before_utc", "not_after_utc"
    ], label);
    const keyId = requireSha256(value.key_id, `${label}.key_id`);
    if (value.algorithm !== "Ed25519") {
      reject("peer-key", `${label}.algorithm is unsupported`);
    }
    const notBeforeUtc = requireUtc(value.not_before_utc, `${label}.not_before_utc`);
    const notAfterUtc = requireUtc(value.not_after_utc, `${label}.not_after_utc`);
    if (Date.parse(notBeforeUtc) > now + MAXIMUM_FUTURE_SKEW_MILLISECONDS ||
        Date.parse(notAfterUtc) <= now || Date.parse(notAfterUtc) <= Date.parse(notBeforeUtc)) {
      reject("peer-key", `${label} is not currently valid`);
    }
    return Object.freeze({
      key_id: keyId,
      algorithm: value.algorithm,
      public_key_base64url: requireBase64Url(
        value.public_key_base64url,
        32,
        `${label}.public_key_base64url`
      ),
      not_before_utc: notBeforeUtc,
      not_after_utc: notAfterUtc
    });
  }

  // Validates an immutable composition supersession edge.
  function validateSupersession(value, label) {
    requireExactKeys(value, [
      "superseded_composition_id", "replacement_composition_id", "effective_at_utc"
    ], label);
    const superseded = requireSha256(
      value.superseded_composition_id,
      `${label}.superseded_composition_id`
    );
    const replacement = requireSha256(
      value.replacement_composition_id,
      `${label}.replacement_composition_id`
    );
    if (superseded === replacement) {
      reject("supersession", `${label} must replace a different composition`);
    }
    return Object.freeze({
      superseded_composition_id: superseded,
      replacement_composition_id: replacement,
      effective_at_utc: requireUtc(value.effective_at_utc, `${label}.effective_at_utc`)
    });
  }

  function validateCatalog(value, options = {}) {
    requireExactKeys(value, [
      "schema",
      "catalog_id",
      "revision",
      "generated_at_utc",
      "valid_until_utc",
      "project_server_serves_model_bytes",
      "project_server_proxies_model_bytes",
      "project_server_runs_inference",
      "qualification_policy",
      "qualification_receipt_schema",
      "browser_admission_schema",
      "peer_verification_keys",
      "revoked_qualification_receipt_ids",
      "supersessions",
      "entries"
    ], "catalog");
    if (value.schema !== CATALOG_SCHEMA ||
        value.qualification_policy !== "exact-current-evidence-required") {
      reject("catalog-schema", "catalog schema or qualification policy is unsupported");
    }
    if (value.browser_admission_schema !== BROWSER_ADMISSION_SCHEMA) {
      reject(
        "browser-admission-schema",
        "catalog browser admission schema is unsupported"
      );
    }
    if (value.qualification_receipt_schema !== QUALIFICATION_RECEIPT_SCHEMA) {
      reject("qualification-receipt-schema", "catalog qualification receipt schema is unsupported");
    }
    const now = validationNow(options);
    requireId(value.catalog_id, "catalog.catalog_id");
    requireRevision(value.revision, "catalog.revision");
    requireFreshWindow(value.generated_at_utc, value.valid_until_utc, now, "catalog");
    requireProjectBoundary(value, true, "catalog");
    if (!Array.isArray(value.peer_verification_keys) ||
        value.peer_verification_keys.length > MAXIMUM_VERIFICATION_KEYS) {
      reject("peer-key", "catalog.peer_verification_keys must be a bounded array");
    }
    const peerKeys = value.peer_verification_keys.map((key, index) =>
      validatePeerVerificationKey(key, `catalog.peer_verification_keys[${index}]`, now)
    );
    if (new Set(peerKeys.map((key) => key.key_id)).size !== peerKeys.length) {
      reject("peer-key", "catalog contains a duplicate peer verification key");
    }
    if (!Array.isArray(value.revoked_qualification_receipt_ids) ||
        value.revoked_qualification_receipt_ids.length > MAXIMUM_REVOCATIONS) {
      reject("revocation", "catalog revocation set must be a bounded array");
    }
    const revocations = value.revoked_qualification_receipt_ids.map((receiptId, index) =>
      requireSha256(receiptId, `catalog.revoked_qualification_receipt_ids[${index}]`)
    );
    if (new Set(revocations).size !== revocations.length) {
      reject("revocation", "catalog contains a duplicate qualification revocation");
    }
    if (!Array.isArray(value.supersessions) ||
        value.supersessions.length > MAXIMUM_SUPERSESSIONS) {
      reject("supersession", "catalog supersession set must be a bounded array");
    }
    const supersessions = value.supersessions.map((edge, index) =>
      validateSupersession(edge, `catalog.supersessions[${index}]`)
    );
    if (new Set(supersessions.map((edge) => edge.superseded_composition_id)).size !==
        supersessions.length) {
      reject("supersession", "catalog supersedes one composition more than once");
    }
    if (!Array.isArray(value.entries) || value.entries.length > MAXIMUM_ENTRIES) {
      reject("catalog-entries", "catalog.entries must be a bounded array");
    }
    const ids = new Set();
    const compositions = new Set();
    value.entries.forEach((entry, index) => {
      validateCatalogEntry(entry, `catalog.entries[${index}]`);
      if (ids.has(entry.entry_id) || compositions.has(entry.composition.composition_id)) {
        reject("catalog-duplicate", "catalog contains a duplicate entry or composition identity");
      }
      ids.add(entry.entry_id);
      compositions.add(entry.composition.composition_id);
      if (revocations.includes(entry.qualification.receipt_id) ||
          supersessions.some((edge) =>
            edge.superseded_composition_id === entry.composition.composition_id &&
            Date.parse(edge.effective_at_utc) <= Date.parse(value.generated_at_utc))) {
        reject("qualification-current", "catalog publishes a revoked or superseded entry as current");
      }
    });
    return Object.freeze({
      schema: value.schema,
      catalog_id: value.catalog_id,
      revision: value.revision,
      generated_at_utc: value.generated_at_utc,
      valid_until_utc: value.valid_until_utc,
      project_server_serves_model_bytes: value.project_server_serves_model_bytes,
      project_server_proxies_model_bytes: value.project_server_proxies_model_bytes,
      project_server_runs_inference: value.project_server_runs_inference,
      qualification_policy: value.qualification_policy,
      qualification_receipt_schema: value.qualification_receipt_schema,
      browser_admission_schema: value.browser_admission_schema,
      peer_verification_keys: Object.freeze(peerKeys),
      revoked_qualification_receipt_ids: Object.freeze(revocations),
      supersessions: Object.freeze(supersessions),
      entries: Object.freeze(value.entries.map(snapshotCatalogEntry))
    });
  }

  function validationNow(options) {
    const now = options.now instanceof Date ? options.now.getTime() : Date.now();
    if (!Number.isFinite(now)) {
      reject("peer-now", "peer validation time is invalid");
    }
    return now;
  }

  function validatePeerAnnouncementDocument(value, now, label, options = {}) {
    requireExactKeys(value, [
      "announcement_id",
      "composition_id",
      "piece_set_sha256",
      "peer_base_url",
      "protocol_profile",
      "consent_status",
      "consent_receipt_sha256",
      "outside_proof_status",
      "outside_proof_receipt_sha256",
      "issued_at_utc",
      "expires_utc",
      "verification_key_id",
      "signature"
    ], label);
    const id = requireId(value.announcement_id, `${label}.announcement_id`);
    const compositionId = requireSha256(value.composition_id, `${label}.composition_id`);
    const pieceSetSha256 = requireSha256(
      value.piece_set_sha256,
      `${label}.piece_set_sha256`
    );
    const protocolProfile = requireId(
      value.protocol_profile,
      `${label}.protocol_profile`
    );
    if (protocolProfile !== DIRECT_COMPOSITION_PROTOCOL_PROFILE) {
      reject("peer-protocol", "peer announcement protocol is unsupported");
    }
    if (value.consent_status !== "explicit") {
      reject("peer-proof", "peer announcement lacks explicit consent");
    }
    const consentReceiptSha256 = requireSha256(
      value.consent_receipt_sha256,
      `${label}.consent_receipt_sha256`
    );
    const peerBaseUrl = normalizeDirectPeerBaseUrl(value.peer_base_url, {
      applicationOrigin: options.applicationOrigin
    });
    const outsideProofReceiptSha256 = requireDirectPeerProof(
      peerBaseUrl, value.outside_proof_status, value.outside_proof_receipt_sha256
    );
    const issuedAtUtc = requireUtc(value.issued_at_utc, `${label}.issued_at_utc`);
    const expiresUtc = requireUtc(value.expires_utc, "peer announcement.expires_utc");
    if (Date.parse(issuedAtUtc) > now + MAXIMUM_FUTURE_SKEW_MILLISECONDS ||
        Date.parse(issuedAtUtc) < now - MAXIMUM_SOURCE_AGE_MILLISECONDS ||
        Date.parse(expiresUtc) <= now || Date.parse(expiresUtc) <= Date.parse(issuedAtUtc) ||
        Date.parse(expiresUtc) - Date.parse(issuedAtUtc) >
          MAXIMUM_SOURCE_LIFETIME_MILLISECONDS) {
      reject("peer-expired", "peer announcement is stale, future-dated, or expired");
    }
    return Object.freeze({
      announcement_id: id,
      composition_id: compositionId,
      piece_set_sha256: pieceSetSha256,
      peer_base_url: peerBaseUrl,
      protocol_profile: protocolProfile,
      consent_status: value.consent_status,
      consent_receipt_sha256: consentReceiptSha256,
      outside_proof_status: value.outside_proof_status,
      outside_proof_receipt_sha256: outsideProofReceiptSha256,
      issued_at_utc: issuedAtUtc,
      expires_utc: expiresUtc,
      verification_key_id: requireSha256(
        value.verification_key_id,
        `${label}.verification_key_id`
      ),
      signature: requireBase64Url(value.signature, 64, `${label}.signature`)
    });
  }

  function validatePeerFeedDocument(value, options = {}) {
    requireExactKeys(value, [
      "schema",
      "feed_id",
      "revision",
      "generated_at_utc",
      "valid_until_utc",
      "project_server_serves_model_bytes",
      "project_server_proxies_model_bytes",
      "announcements"
    ], "peer feed");
    if (value.schema !== PEER_SCHEMA) {
      reject("peer-schema", "peer feed schema is unsupported");
    }
    requireId(value.feed_id, "peer feed.feed_id");
    requireRevision(value.revision, "peer feed.revision");
    requireProjectBoundary(value, false, "peer feed");
    if (!Array.isArray(value.announcements) ||
        value.announcements.length > MAXIMUM_ANNOUNCEMENTS) {
      reject("peer-announcements", "peer feed.announcements must be a bounded array");
    }
    const now = validationNow(options);
    const freshness = requireFreshWindow(
      value.generated_at_utc,
      value.valid_until_utc,
      now,
      "peer feed"
    );
    const ids = new Set();
    const announcements = value.announcements.map((announcement, index) => {
      const validated = validatePeerAnnouncementDocument(
        announcement,
        now,
        `peer feed.announcements[${index}]`,
        options
      );
      if (Date.parse(validated.issued_at_utc) > freshness.generated ||
          Date.parse(validated.expires_utc) > freshness.validUntil) {
        reject("peer-freshness", "peer announcement lies outside its feed validity window");
      }
      if (ids.has(validated.announcement_id)) {
        reject("peer-duplicate", "peer feed contains a duplicate announcement");
      }
      ids.add(validated.announcement_id);
      return validated;
    });
    return Object.freeze({
      schema: value.schema,
      feed_id: value.feed_id,
      revision: value.revision,
      generated_at_utc: value.generated_at_utc,
      valid_until_utc: value.valid_until_utc,
      project_server_serves_model_bytes: value.project_server_serves_model_bytes,
      project_server_proxies_model_bytes: value.project_server_proxies_model_bytes,
      announcements: Object.freeze(announcements)
    });
  }

  // Produces the exact detached-signature payload for one peer announcement.
  function peerAnnouncementSigningBytes(announcement) {
    requireExactKeys(announcement, [
      "announcement_id",
      "composition_id",
      "piece_set_sha256",
      "peer_base_url",
      "protocol_profile",
      "consent_status",
      "consent_receipt_sha256",
      "outside_proof_status",
      "outside_proof_receipt_sha256",
      "issued_at_utc",
      "expires_utc",
      "verification_key_id",
      "signature"
    ], "peer announcement signing input");
    const payload = {
      schema: PEER_PROOF_SCHEMA,
      announcement_id: announcement.announcement_id,
      composition_id: announcement.composition_id,
      piece_set_sha256: announcement.piece_set_sha256,
      peer_base_url: announcement.peer_base_url,
      protocol_profile: announcement.protocol_profile,
      consent_status: announcement.consent_status,
      consent_receipt_sha256: announcement.consent_receipt_sha256,
      outside_proof_status: announcement.outside_proof_status,
      outside_proof_receipt_sha256: announcement.outside_proof_receipt_sha256,
      issued_at_utc: announcement.issued_at_utc,
      expires_utc: announcement.expires_utc,
      verification_key_id: announcement.verification_key_id
    };
    try {
      return new TextEncoder().encode(`${JSON.stringify(payload)}\n`);
    } catch (_error) {
      reject("peer-signature", "peer announcement signing bytes were unavailable");
    }
  }

  function signatureCrypto(options) {
    const cryptoValue = options.crypto ||
      (typeof globalThis === "object" ? globalThis.crypto : null);
    if (!cryptoValue || !cryptoValue.subtle ||
        typeof cryptoValue.subtle.importKey !== "function" ||
        typeof cryptoValue.subtle.verify !== "function") {
      reject("peer-signature-authority", "Ed25519 verification is unavailable");
    }
    return cryptoValue.subtle;
  }

  // Verifies every detached Ed25519 signature before its announcement can back an acquisition attempt.
  async function verifyBoundPeerAnnouncements(catalog, peerFeed, announcements, options = {}) {
    if (announcements.length === 0) return announcements;
    const subtle = signatureCrypto(options);
    const verified = [];
    for (const peer of announcements) {
      const announcement = peerFeed.announcements.find((candidate) =>
        candidate.announcement_id === peer.announcementId
      );
      const publicKey = decodeBase64Url(
        peer.verificationPublicKey,
        32,
        "peer verification public key"
      );
      const signature = decodeBase64Url(peer.signature, 64, "peer announcement signature");
      let key;
      let valid;
      try {
        key = await subtle.importKey(
          "raw",
          publicKey,
          { name: "Ed25519" },
          false,
          ["verify"]
        );
        valid = await subtle.verify(
          { name: "Ed25519" },
          key,
          signature,
          peerAnnouncementSigningBytes(announcement)
        );
      } catch (_error) {
        reject("peer-signature", "peer announcement signature verification failed");
      }
      if (valid !== true) {
        reject("peer-signature", "peer announcement signature is invalid");
      }
      verified.push(Object.freeze({ ...peer, signatureVerified: true }));
    }
    return Object.freeze(verified);
  }

  function bindPeerFeed(catalog, peerFeed) {
    if (Date.parse(peerFeed.generated_at_utc) < Date.parse(catalog.generated_at_utc) ||
        Date.parse(peerFeed.valid_until_utc) > Date.parse(catalog.valid_until_utc)) {
      reject("peer-freshness", "peer feed is not bounded by the current catalog window");
    }
    const catalogByComposition = new Map(catalog.entries.map((entry) => [
      entry.composition.composition_id,
      entry
    ]));
    const catalogByPeerId = new Map();
    for (const entry of catalog.entries) {
      for (const peerId of entry.peer_announcement_ids) {
        if (catalogByPeerId.has(peerId)) {
          reject("peer-binding", "catalog declares one peer announcement more than once");
        }
        catalogByPeerId.set(peerId, entry.composition.composition_id);
      }
    }
    const ids = new Set(peerFeed.announcements.map((announcement) =>
      announcement.announcement_id
    ));
    const announcements = peerFeed.announcements.map((announcement) => {
      const compositionId = announcement.composition_id;
      if (!catalogByComposition.has(compositionId)) {
        reject("peer-composition", "peer announcement references an unknown composition");
      }
      if (catalogByPeerId.get(announcement.announcement_id) !== compositionId) {
        reject("peer-binding", "peer announcement is not declared by its catalog entry");
      }
      const verificationKey = catalog.peer_verification_keys.find((key) =>
        key.key_id === announcement.verification_key_id
      );
      if (!verificationKey ||
          Date.parse(verificationKey.not_before_utc) > Date.parse(announcement.issued_at_utc) ||
          Date.parse(verificationKey.not_after_utc) < Date.parse(announcement.expires_utc)) {
        reject("peer-key", "peer announcement is not covered by a current catalog verifier");
      }
      return Object.freeze({
        announcementId: announcement.announcement_id,
        compositionId,
        pieceSetSha256: announcement.piece_set_sha256,
        peerBaseUrl: announcement.peer_base_url,
        protocolProfile: announcement.protocol_profile,
        consentStatus: announcement.consent_status,
        consentReceiptSha256: announcement.consent_receipt_sha256,
        outsideProofStatus: announcement.outside_proof_status,
        outsideProofReceiptSha256: announcement.outside_proof_receipt_sha256,
        issuedAtUtc: announcement.issued_at_utc,
        expiresUtc: announcement.expires_utc,
        verificationKeyId: announcement.verification_key_id,
        verificationPublicKey: verificationKey.public_key_base64url,
        signature: announcement.signature,
        signatureVerified: false,
        feedId: peerFeed.feed_id,
        feedRevision: peerFeed.revision,
        feedGeneratedAtUtc: peerFeed.generated_at_utc,
        feedValidUntilUtc: peerFeed.valid_until_utc
      });
    });
    if (ids.size !== catalogByPeerId.size ||
        [...catalogByPeerId.keys()].some((id) => !ids.has(id))) {
      reject("peer-closure", "catalog and peer feed announcement identities are not closed");
    }
    return Object.freeze(announcements);
  }

  function validatePeerFeed(value, catalogValue, options = {}) {
    const catalog = validateCatalog(catalogValue, options);
    const peerFeed = validatePeerFeedDocument(value, options);
    return bindPeerFeed(catalog, peerFeed);
  }

  function copyMember(member) {
    return Object.freeze({
      name: member.name,
      bytes: member.bytes,
      sha256: member.sha256,
      schema: member.schema
    });
  }

  function compareText(left, right) {
    return left < right ? -1 : (left > right ? 1 : 0);
  }

  function copyPeer(peer) {
    return Object.freeze({
      announcementId: peer.announcementId,
      compositionId: peer.compositionId,
      pieceSetSha256: peer.pieceSetSha256,
      peerBaseUrl: peer.peerBaseUrl,
      protocolProfile: peer.protocolProfile,
      consentStatus: peer.consentStatus,
      consentReceiptSha256: peer.consentReceiptSha256,
      outsideProofStatus: peer.outsideProofStatus,
      outsideProofReceiptSha256: peer.outsideProofReceiptSha256,
      issuedAtUtc: peer.issuedAtUtc,
      expiresUtc: peer.expiresUtc,
      verificationKeyId: peer.verificationKeyId,
      verificationPublicKey: peer.verificationPublicKey,
      signature: peer.signature,
      signatureVerified: peer.signatureVerified,
      feedId: peer.feedId,
      feedRevision: peer.feedRevision,
      feedGeneratedAtUtc: peer.feedGeneratedAtUtc,
      feedValidUntilUtc: peer.feedValidUntilUtc
    });
  }

  function projectEntry(entry, peers, catalog) {
    const sortedPeers = [...peers].sort((left, right) =>
      Number(right.peerBaseUrl === "https://minimodel.org/") -
        Number(left.peerBaseUrl === "https://minimodel.org/") ||
      compareText(left.peerBaseUrl, right.peerBaseUrl) ||
      compareText(left.announcementId, right.announcementId)
    ).map(copyPeer);
    return Object.freeze({
      entryId: entry.entry_id,
      displayName: entry.display_name,
      description: entry.description,
      source: Object.freeze({
        repository: entry.source.repository,
        revision: entry.source.revision,
        sourceLockSha256: entry.source.source_lock_sha256
      }),
      license: Object.freeze({
        route: entry.license.route,
        reviewStatus: entry.license.review_status
      }),
      composition: Object.freeze({
        compositionId: entry.composition.composition_id,
        memberCount: entry.composition.member_count,
        members: Object.freeze(entry.composition.members.map(copyMember))
      }),
      browserAdmission: Object.freeze({
        schema: BROWSER_ADMISSION_SCHEMA,
        route: entry.browser_admission.route,
        bytes: entry.browser_admission.bytes,
        sha256: entry.browser_admission.sha256
      }),
      profiles: Object.freeze({
        conversion: entry.profiles.conversion,
        quantization: entry.profiles.quantization,
        runtime: entry.profiles.runtime
      }),
      qualification: Object.freeze({
        status: entry.qualification.status,
        receiptId: entry.qualification.receipt_id,
        receiptRoute: entry.qualification.receipt_route,
        receiptBytes: entry.qualification.receipt_bytes,
        receiptSha256: entry.qualification.receipt_sha256,
        numericalStatus: entry.qualification.numerical_status,
        browserStatus: entry.qualification.browser_status,
        qualityStatus: entry.qualification.quality_status
      }),
      catalogAuthority: Object.freeze({
        catalogId: catalog.catalog_id,
        revision: catalog.revision,
        generatedAtUtc: catalog.generated_at_utc,
        validUntilUtc: catalog.valid_until_utc
      }),
      availability: sortedPeers.length ? "peer" : "local-conversion",
      availabilityLabel: sortedPeers.length
        ? `Qualified composition; ${sortedPeers.length} current signed peer ${
          sortedPeers.length === 1 ? "announcement" : "announcements"
        } listed; reachability not proven`
        : "Local conversion",
      peerCount: sortedPeers.length,
      peers: Object.freeze(sortedPeers)
    });
  }

  function buildCatalogViewFromValidated(catalog, announcements) {
    const peersByComposition = new Map();
    for (const announcement of announcements) {
      const peers = peersByComposition.get(announcement.compositionId) || [];
      peers.push(announcement);
      peersByComposition.set(announcement.compositionId, peers);
    }
    return Object.freeze(catalog.entries
      .map((entry) => projectEntry(
        entry,
        peersByComposition.get(entry.composition.composition_id) || [],
        catalog
      ))
      .sort((left, right) => {
        const availabilityOrder = Number(right.availability === "peer") -
          Number(left.availability === "peer");
        return availabilityOrder ||
          compareText(left.displayName, right.displayName) ||
          compareText(left.entryId, right.entryId);
      }));
  }

  function buildCatalogView(catalogValue, peerFeedValue, options = {}) {
    const catalog = validateCatalog(catalogValue, options);
    const peerFeed = validatePeerFeedDocument(peerFeedValue, options);
    const announcements = bindPeerFeed(catalog, peerFeed);
    if (announcements.length !== 0) {
      reject(
        "peer-signature-required",
        "peer-backed views require asynchronous Ed25519 verification"
      );
    }
    return buildCatalogViewFromValidated(catalog, announcements);
  }

  // A saved catalog grants no peer transport permission; only current entries are projected.
  function buildCatalogViewWithoutPeers(catalogValue, options = {}) {
    return buildCatalogViewFromValidated(validateCatalog(catalogValue, options), []);
  }

  async function buildVerifiedCatalogView(catalogValue, peerFeedValue, options = {}) {
    const catalog = validateCatalog(catalogValue, options);
    const peerFeed = validatePeerFeedDocument(peerFeedValue, options);
    const bound = bindPeerFeed(catalog, peerFeed);
    const verified = await verifyBoundPeerAnnouncements(catalog, peerFeed, bound, options);
    return buildCatalogViewFromValidated(catalog, verified);
  }

  function requestTimeout(options) {
    const timeout = options.timeoutMilliseconds === undefined
      ? DEFAULT_TIMEOUT_MILLISECONDS
      : options.timeoutMilliseconds;
    if (!Number.isSafeInteger(timeout) || timeout < 1 ||
        timeout > MAXIMUM_TIMEOUT_MILLISECONDS) {
      reject("timeout-setting", "metadata timeout is outside the supported range");
    }
    return timeout;
  }

  function abortReason(signal) {
    if (signal && signal.reason instanceof Error) {
      return signal.reason;
    }
    const error = new Error("The operation was aborted");
    error.name = "AbortError";
    return error;
  }

  function abortable(promise, signal) {
    if (signal.aborted) {
      return Promise.reject(abortReason(signal));
    }
    return new Promise((resolve, rejectPromise) => {
      let settled = false;
      const finish = (callback, value) => {
        if (settled) {
          return;
        }
        settled = true;
        signal.removeEventListener("abort", onAbort);
        callback(value);
      };
      const onAbort = () => finish(rejectPromise, abortReason(signal));
      signal.addEventListener("abort", onAbort, { once: true });
      Promise.resolve(promise).then(
        (value) => finish(resolve, value),
        (error) => finish(rejectPromise, error)
      );
    });
  }

  function cancelReader(reader) {
    try {
      const cancellation = reader.cancel();
      if (cancellation && typeof cancellation.catch === "function") {
        cancellation.catch(() => {});
      }
    } catch (_error) {
      // Cancellation is best-effort after the response has already failed closed.
    }
  }

  function declaredResponseLength(response) {
    let header = null;
    try {
      header = response.headers && typeof response.headers.get === "function"
        ? response.headers.get("content-length")
        : null;
    } catch (_error) {
      reject("response-headers", "metadata response headers were unavailable");
    }
    if (header === null || header === undefined) {
      return null;
    }
    if (typeof header !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(header)) {
      reject("response-headers", "metadata response content length was invalid");
    }
    const length = Number(header);
    if (!Number.isSafeInteger(length) || length > MAXIMUM_METADATA_BYTES) {
      reject("metadata-size", "metadata response exceeded the byte limit");
    }
    return length;
  }

  async function readBoundedResponseJson(response, signal) {
    const declaredLength = declaredResponseLength(response);
    if (!response.body || typeof response.body.getReader !== "function") {
      reject("response-stream-required", "metadata requires a bounded byte stream");
    }
    const reader = response.body.getReader();
    const parser = createCanonicalJsonStreamParser(MAXIMUM_METADATA_BYTES);
    let byteLength = 0;
    let chunkCount = 0;
    try {
      while (true) {
        const item = await abortable(
          Promise.resolve().then(() => reader.read()),
          signal
        );
        if (!isObject(item) || typeof item.done !== "boolean") {
          reject("response-body", "metadata response stream was invalid");
        }
        if (item.done) break;
        if (!ArrayBuffer.isView(item.value)) {
          reject("response-body", "metadata response stream contained a non-byte chunk");
        }
        chunkCount += 1;
        if (chunkCount > MAXIMUM_METADATA_CHUNKS) {
          reject("metadata-size", "metadata response exceeded the chunk limit");
        }
        const chunk = new Uint8Array(
          item.value.buffer,
          item.value.byteOffset,
          item.value.byteLength
        );
        if (chunk.byteLength < 1 || chunk.byteLength > MAXIMUM_METADATA_BYTES - byteLength) {
          reject("metadata-size", "metadata response exceeded the byte limit");
        }
        parser.push(chunk);
        byteLength += chunk.byteLength;
      }
      if (declaredLength !== null && declaredLength !== byteLength) {
        reject("response-headers", "metadata content length did not match its stream");
      }
      return parser.finish();
    } catch (error) {
      cancelReader(reader);
      throw error;
    }
  }

  // Computes the canonical metadata byte digest through an injected or Web Crypto authority.
  async function metadataSha256(text, options) {
    const bytes = new TextEncoder().encode(text);
    if (typeof options.hash === "function") {
      let value;
      try {
        value = await options.hash(bytes.slice());
      } catch (_error) {
        reject("metadata-sha256", "metadata digest failed");
      }
      const normalized = typeof value === "string" && value.startsWith("sha256:")
        ? value
        : `sha256:${value}`;
      return requireSha256(normalized, "metadata SHA-256");
    }
    const cryptoValue = options.crypto ||
      (typeof globalThis === "object" ? globalThis.crypto : null);
    if (!cryptoValue || !cryptoValue.subtle ||
        typeof cryptoValue.subtle.digest !== "function") {
      reject("metadata-sha256", "metadata digest authority is unavailable");
    }
    let digest;
    try {
      digest = new Uint8Array(await cryptoValue.subtle.digest("SHA-256", bytes));
    } catch (_error) {
      reject("metadata-sha256", "metadata digest failed");
    }
    if (digest.byteLength !== 32) reject("metadata-sha256", "metadata digest was invalid");
    let hex = "";
    for (const byte of digest) hex += byte.toString(16).padStart(2, "0");
    return `sha256:${hex}`;
  }

  async function fetchJson(url, options = {}) {
    const fetchImplementation = options.fetch ||
      (typeof globalThis === "object" ? globalThis.fetch : null);
    if (typeof fetchImplementation !== "function") {
      reject("fetch", "catalog fetch is unavailable");
    }
    if (typeof AbortController !== "function") {
      reject("fetch", "bounded catalog fetch is unavailable");
    }
    const parentSignal = options.signal;
    if (parentSignal !== undefined && parentSignal !== null &&
        (typeof parentSignal.addEventListener !== "function" ||
        typeof parentSignal.removeEventListener !== "function" ||
        typeof parentSignal.aborted !== "boolean")) {
      reject("signal", "metadata request signal is invalid");
    }
    if (parentSignal && parentSignal.aborted) {
      throw abortReason(parentSignal);
    }

    const timeoutMilliseconds = requestTimeout(options);
    const controller = new AbortController();
    let timedOut = false;
    const onParentAbort = () => controller.abort(abortReason(parentSignal));
    if (parentSignal) {
      parentSignal.addEventListener("abort", onParentAbort, { once: true });
    }
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMilliseconds);

    try {
      const response = await abortable(
        Promise.resolve().then(() => fetchImplementation(url, {
          method: "GET",
          cache: "no-store",
          credentials: "omit",
          redirect: "error",
          referrerPolicy: "no-referrer",
          signal: controller.signal
        })),
        controller.signal
      );
      if (!response || response.ok !== true) {
        const status = response && Number.isSafeInteger(response.status)
          ? response.status
          : 0;
        reject("fetch", `metadata request failed with HTTP ${status}`);
      }
      const parsed = await readBoundedResponseJson(response, controller.signal);
      DOCUMENT_METADATA.set(parsed.value, Object.freeze({
        byteLength: parsed.byteLength,
        sha256: await metadataSha256(parsed.text, options),
        text: parsed.text
      }));
      return parsed.value;
    } catch (error) {
      if (parentSignal && parentSignal.aborted) {
        throw abortReason(parentSignal);
      }
      if (timedOut) {
        reject("timeout", "metadata request exceeded its time limit");
      }
      if (error instanceof MiniModelCatalogError) {
        throw error;
      }
      reject("fetch", "metadata request failed");
    } finally {
      clearTimeout(timeout);
      if (parentSignal) {
        parentSignal.removeEventListener("abort", onParentAbort);
      }
    }
  }

  function sourceFailure(type, stage, error) {
    const typedError = error instanceof MiniModelCatalogError
      ? error
      : new MiniModelCatalogError(
        stage === "fetch" ? "fetch" : "validation",
        stage === "fetch" ? "metadata request failed" : "metadata validation failed"
      );
    return Object.freeze({
      type,
      status: SOURCE_STATUSES.INVALID,
      document: null,
      error: Object.freeze({
        type: stage,
        code: typedError.code,
        message: typedError.message
      })
    });
  }

  function sourceSuccess(type, document, metadata) {
    return Object.freeze({
      type,
      status: SOURCE_STATUSES.VALID,
      document,
      text: metadata.text,
      sha256: metadata.sha256,
      error: null
    });
  }

  // Rejects rollback and same-revision equivocation against the caller's last accepted source.
  function requireMonotonicSource(type, document, metadata, previousAuthority) {
    if (previousAuthority === undefined || previousAuthority === null) return;
    if (!isObject(previousAuthority)) {
      reject("monotonic", "previous catalog authority was invalid");
    }
    const previous = type === SOURCE_TYPES.CATALOG
      ? previousAuthority.catalog
      : previousAuthority.peerFeed;
    if (previous === null || previous === undefined) return;
    const id = type === SOURCE_TYPES.CATALOG ? document.catalog_id : document.feed_id;
    const generatedAtUtc = document.generated_at_utc;
    if (!isObject(previous) || previous.id !== id ||
        !Number.isSafeInteger(previous.revision) ||
        typeof previous.sha256 !== "string" ||
        typeof previous.generatedAtUtc !== "string" ||
        document.revision < previous.revision ||
        Date.parse(generatedAtUtc) < Date.parse(previous.generatedAtUtc) ||
        (document.revision === previous.revision && metadata.sha256 !== previous.sha256) ||
        (document.revision > previous.revision &&
          Date.parse(generatedAtUtc) <= Date.parse(previous.generatedAtUtc))) {
      reject("monotonic", `${type} rolled back or equivocated`);
    }
  }

  async function loadSource(type, url, validate, options) {
    let value;
    try {
      value = await fetchJson(url, options);
    } catch (error) {
      if (options.signal && options.signal.aborted) {
        throw abortReason(options.signal);
      }
      return sourceFailure(type, "fetch", error);
    }
    try {
      const metadata = DOCUMENT_METADATA.get(value);
      if (!metadata) reject("metadata-sha256", "metadata source identity was unavailable");
      const document = validate(value);
      requireMonotonicSource(type, document, metadata, options.previousAuthority);
      return sourceSuccess(type, document, metadata);
    } catch (error) {
      return sourceFailure(type, "validation", error);
    }
  }

  // Reuse the live-source rollback rule for an already validated durable catalog and digest.
  function assertCatalogAuthorityProgression(catalog, sha256, previousAuthority) {
    requireMonotonicSource(SOURCE_TYPES.CATALOG, catalog, { sha256 },
      { catalog: previousAuthority });
  }

  async function loadCurrentCatalog(options = {}) {
    return loadCurrentCatalogAttempt(options, false);
  }

  // One bounded reload handles renewal between the two independent metadata GETs.
  async function loadCurrentCatalogAttempt(options, pairReloaded) {
    const catalogUrl = options.catalogUrl || CATALOG_URL;
    const peerFeedUrl = options.peerFeedUrl || PEER_FEED_URL;
    const settled = await Promise.allSettled([
      loadSource(
        SOURCE_TYPES.CATALOG,
        catalogUrl,
        (value) => validateCatalog(value, options),
        options
      ),
      loadSource(
        SOURCE_TYPES.PEER_FEED,
        peerFeedUrl,
        (value) => validatePeerFeedDocument(value, options),
        options
      )
    ]);
    const rejected = settled.find((item) => item.status === "rejected");
    if (rejected) {
      throw rejected.reason;
    }

    const catalog = settled[0].value;
    let peerFeed = settled[1].value;
    let views = Object.freeze([]);
    if (catalog.status === SOURCE_STATUSES.VALID) {
      let announcements = Object.freeze([]);
      if (peerFeed.status === SOURCE_STATUSES.VALID) {
        try {
          const bound = bindPeerFeed(catalog.document, peerFeed.document);
          announcements = await verifyBoundPeerAnnouncements(
            catalog.document,
            peerFeed.document,
            bound,
            options
          );
        } catch (error) {
          if (!pairReloaded && error instanceof MiniModelCatalogError &&
              error.code === "peer-freshness") {
            // Both documents passed their own validation and rollback checks. Carry
            // those revisions forward so recovery cannot accept an older pair.
            const previousAuthority = {};
            for (const source of [catalog, peerFeed]) {
              const isCatalog = source.type === SOURCE_TYPES.CATALOG;
              previousAuthority[isCatalog ? "catalog" : "peerFeed"] = {
                id: isCatalog ? source.document.catalog_id : source.document.feed_id,
                revision: source.document.revision,
                generatedAtUtc: source.document.generated_at_utc,
                validUntilUtc: source.document.valid_until_utc,
                sha256: source.sha256
              };
            }
            return loadCurrentCatalogAttempt({ ...options, previousAuthority }, true);
          }
          const stage = error instanceof MiniModelCatalogError &&
            ["peer-signature", "peer-signature-authority"].includes(error.code)
            ? "signature"
            : "binding";
          peerFeed = sourceFailure(SOURCE_TYPES.PEER_FEED, stage, error);
        }
      }
      views = buildCatalogViewFromValidated(catalog.document, announcements);
    }
    const authority = catalog.status === SOURCE_STATUSES.VALID
      ? Object.freeze({
        catalog: Object.freeze({
          id: catalog.document.catalog_id,
          revision: catalog.document.revision,
          generatedAtUtc: catalog.document.generated_at_utc,
          validUntilUtc: catalog.document.valid_until_utc,
          sha256: catalog.sha256
        }),
        peerFeed: peerFeed.status === SOURCE_STATUSES.VALID
          ? Object.freeze({
            id: peerFeed.document.feed_id,
            revision: peerFeed.document.revision,
            generatedAtUtc: peerFeed.document.generated_at_utc,
            validUntilUtc: peerFeed.document.valid_until_utc,
            sha256: peerFeed.sha256
          })
          : null
      })
      : null;
    return Object.freeze({ catalog, peerFeed, views, authority, metadataPairReloaded: pairReloaded });
  }

  // Classifies one cached admission against an already validated current catalog.
  function qualificationDisposition(catalogValue, admission, options = {}) {
    const catalog = validateCatalog(catalogValue, options);
    if (!isObject(admission) || !isObject(admission.composition) ||
        !isObject(admission.qualification)) {
      reject("qualification-current", "cached admission identity was invalid");
    }
    const compositionId = requireSha256(
      `sha256:${String(admission.composition.graphIdentitySha256 || "")}`,
      "cached admission composition"
    );
    const receiptId = requireSha256(
      admission.qualification.receiptId,
      "cached admission qualification receipt"
    );
    const revoked = catalog.revoked_qualification_receipt_ids.includes(receiptId);
    const supersession = catalog.supersessions.find((edge) =>
      edge.superseded_composition_id === compositionId &&
      Date.parse(edge.effective_at_utc) <= Date.parse(catalog.generated_at_utc)
    );
    const entry = catalog.entries.find((candidate) =>
      candidate.composition.composition_id === compositionId
    ) || null;
    let status = "current";
    let reason = "current";
    if (revoked) {
      status = "quarantined";
      reason = "qualification-revoked";
    } else if (supersession) {
      status = "quarantined";
      reason = "composition-superseded";
    } else if (!entry) {
      status = "quarantined";
      reason = catalog.entries.some((candidate) =>
        candidate.source.repository === admission.modelId
      ) ? "composition-superseded" : "catalog-delisted";
    } else if (entry.qualification.receipt_id !== receiptId) {
      status = "quarantined";
      reason = "qualification-replaced";
    }
    return Object.freeze({
      status,
      reason,
      compositionId,
      receiptId,
      replacementCompositionId: supersession
        ? supersession.replacement_composition_id
        : null,
      entry: status === "current" ? projectEntry(entry, [], catalog) : null,
      catalogId: catalog.catalog_id,
      catalogRevision: catalog.revision
    });
  }

  return Object.freeze({
    CATALOG_SCHEMA,
    PEER_SCHEMA,
    BROWSER_ADMISSION_SCHEMA,
    QUALIFICATION_RECEIPT_SCHEMA,
    PEER_PROOF_SCHEMA,
    PIECE_SET_SCHEMA,
    DIRECT_COMPOSITION_PROTOCOL_PROFILE,
    CATALOG_URL,
    PEER_FEED_URL,
    MAXIMUM_METADATA_BYTES,
    MAXIMUM_BROWSER_ADMISSION_BYTES,
    MAXIMUM_QUALIFICATION_RECEIPT_BYTES,
    DEFAULT_TIMEOUT_MILLISECONDS,
    MAXIMUM_TIMEOUT_MILLISECONDS,
    MAXIMUM_ENTRIES,
    MAXIMUM_ANNOUNCEMENTS,
    SOURCE_TYPES,
    SOURCE_STATUSES,
    MEMBER_NAMES,
    directPeerUrlAuthority,
    MiniModelCatalogError,
    parseCanonicalJsonText,
    createCanonicalJsonStreamParser,
    validateCatalog,
    validatePeerFeedDocument,
    validatePeerFeed,
    buildCatalogView,
    buildCatalogViewWithoutPeers,
    buildVerifiedCatalogView,
    peerAnnouncementSigningBytes,
    fetchJson,
    loadCurrentCatalog,
    assertCatalogAuthorityProgression,
    qualificationDisposition
  });
}));
