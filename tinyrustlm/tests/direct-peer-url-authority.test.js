"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const catalogApi = require("../app/minimodel-catalog-v1.js");
const p2pInstallApi = require("../app/p2p-composition-install.js");

const authority = catalogApi.directPeerUrlAuthority;
const appSource = fs.readFileSync(path.join(__dirname, "..", "app", "app.js"), "utf8");

function appNormalizer() {
  const start = appSource.indexOf("  function normalizedPeerBaseUrl");
  const end = appSource.indexOf("  function updatePeerUrlStatus", start);
  assert.ok(start >= 0 && end > start);
  const source = appSource.slice(start, end);
  return Function(
    "directPeerUrlAuthority",
    `"use strict";\n${source}\nreturn normalizedPeerBaseUrl;`
  )(authority);
}

function verdict(normalize, value) {
  try {
    return Object.freeze({ accepted: true, value: normalize(value), code: null });
  } catch (error) {
    return Object.freeze({
      accepted: false,
      value: null,
      code: error && typeof error.code === "string" ? error.code : "error"
    });
  }
}

const normalizers = Object.freeze({
  catalog: authority.normalizeBaseUrl,
  p2p: p2pInstallApi.normalizePeerBaseUrl,
  app: appNormalizer()
});

test("all acquisition consumers use one direct-peer URL verdict authority", () => {
  assert.strictEqual(normalizers.p2p, normalizers.catalog);
  assert.match(appSource, /return directPeerUrlAuthority\.normalizeBaseUrl\(value\);/u);

  const accepted = [
    ["https://minimodel.org/", "https://minimodel.org/"],
    ["https://minimodel.org:443", "https://minimodel.org/"],
    ["https://8.8.8.8/", "https://8.8.8.8/"],
    ["https://8.8.4.4:8443/", "https://8.8.4.4:8443/"],
    ["https://[2606:4700:4700::1111]/", "https://[2606:4700:4700::1111]/"],
    ["http://127.0.0.1:8123/", "http://127.0.0.1:8123/"],
    ["http://[::1]:8123/", "http://[::1]:8123/"],
  ];
  for (const [input, expected] of accepted) {
    const expectedVerdict = verdict(normalizers.catalog, input);
    assert.deepEqual(expectedVerdict, { accepted: true, value: expected, code: null });
    for (const [consumer, normalize] of Object.entries(normalizers)) {
      assert.deepEqual(verdict(normalize, input), expectedVerdict, `${consumer}: ${input}`);
    }
  }
});

test("all acquisition consumers reject DNS names that a browser cannot resolution-pin", () => {
  for (const input of [
    "https://peer.direct-model.net/",
    "https://peer.direct-model.net:8443/"
  ]) {
    const expectedVerdict = {
      accepted: false,
      value: null,
      code: "peer-url-dns-unverifiable"
    };
    for (const [consumer, normalize] of Object.entries(normalizers)) {
      assert.deepEqual(verdict(normalize, input), expectedVerdict, `${consumer}: ${input}`);
    }
  }
});

test("all acquisition consumers reject the same hostile host and URL corpus", () => {
  const deniedServices = [
    "tinyrustlm.com",
    "slmcomposer.com",
    "lmcomposer.com",
    "mirust.com",
    "uaix.org",
    "memoryendpoints.com",
    "huggingface.co"
  ];
  const hostile = deniedServices.flatMap((host) => [
    `https://${host}/`,
    `https://seed.${host}/`
  ]).concat([
    "http://minimodel.org/",
    "https://minimodel.org:8443/",
    "https://seed.minimodel.org/",
    "https://minimodel.org.example.com/",
    "https://minimodel.org./",
    "http://localhost/",
    "http://127.0.0.1:0/",
    "http://127.0.0.1:65536/",
    "http://127.0.0.1:08123/",
    "http://[0:0:0:0:0:0:0:1]:8123/",
    "https://peer.direct-model.net./",
    "https://user:secret@peer.direct-model.net/",
    "https://peer.direct-model.net/?lane=one",
    "https://peer.direct-model.net/#lane",
    "https://peer.direct-model.net/model/",
    "https://peer.direct-model.net//",
    "https://peer.direct-model.net/%2e%2e/",
    "https://%74inyrustlm.com/",
    "https://2130706433/",
    "https://127.1/",
    "https://0177.0.0.1/",
    "https://0x7f000001/",
    "https://10.0.0.1/",
    "https://100.64.0.1/",
    "https://169.254.1.1/",
    "https://172.16.0.1/",
    "https://192.0.2.1/",
    "https://192.168.1.1/",
    "https://198.18.0.1/",
    "https://198.51.100.1/",
    "https://203.0.113.1/",
    "https://224.0.0.1/",
    "https://[2001:db8::1]/",
    "https://[2002::1]/",
    "https://[fc00::1]/",
    "https://[fe80::1]/",
    "https://[ff00::1]/",
    "https://peer.local/",
    "https://peer.example.net/"
  ]);

  hostile.push("http://8.8.8.8:8123/");

  for (const input of hostile) {
    const expectedVerdict = verdict(normalizers.catalog, input);
    assert.deepEqual(expectedVerdict, { accepted: false, value: null, code: "peer-url" });
    for (const [consumer, normalize] of Object.entries(normalizers)) {
      assert.deepEqual(verdict(normalize, input), expectedVerdict, `${consumer}: ${input}`);
    }
  }
});

test("the shared authority constructs only exact direct-peer protocol paths", () => {
  const baseUrl = "https://8.8.8.8/";
  const parsedBaseUrl = new URL(authority.normalizeBaseUrl(baseUrl));
  assert.equal(parsedBaseUrl.href, `${parsedBaseUrl.origin}/`);
  assert.equal(parsedBaseUrl.pathname, "/");
  assert.equal(parsedBaseUrl.search, "");
  assert.equal(parsedBaseUrl.hash, "");
  assert.equal("buildMetadataUrl" in authority, false);
  const compositionId = `sha256:${"a".repeat(64)}`;
  const memberUrls = p2pInstallApi.memberNames.map((memberName) =>
    authority.buildCompositionMemberUrl(baseUrl, compositionId, memberName));
  assert.deepEqual(memberUrls, p2pInstallApi.memberNames.map((memberName) =>
    `https://8.8.8.8${p2pInstallApi.routePrefix}/compositions/` +
      `${compositionId}/members/${memberName}`));
  assert.equal(new Set(memberUrls).size, 6);
  for (const memberUrl of memberUrls) {
    const parsedMemberUrl = new URL(memberUrl);
    assert.equal(parsedMemberUrl.search, "");
    assert.equal(parsedMemberUrl.hash, "");
  }
  assert.throws(
    () => authority.buildCompositionMemberUrl(baseUrl, compositionId, "../model.slm2"),
    (error) => error && error.code === "peer-url"
  );
  assert.doesNotMatch(appSource, /directPeerUrlAuthority\.buildMetadataUrl\(/u);
  assert.doesNotMatch(appSource, /new URL\(peerStatusRoute, peerBaseUrl\)/u);
});
