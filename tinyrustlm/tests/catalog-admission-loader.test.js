"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const nodeCrypto = require("node:crypto");
const test = require("node:test");
const vm = require("node:vm");

const admissionApi = require("../app/browser-model-admission.js");
const loader = require("../app/catalog-admission-loader.js");
const catalogApi = require("../app/minimodel-catalog-v1.js");

const encoder = new TextEncoder();

function rawSha256(value) {
  return nodeCrypto.createHash("sha256").update(value).digest("hex");
}

function prefixedSha256(value) {
  return `sha256:${rawSha256(value)}`;
}

const QUALIFICATION_RECEIPT_ID_A = prefixedSha256("qualification-receipt-id-A");
const TEST_NOW = new Date(Math.floor(Date.now() / 1000) * 1000);
const utc = (offsetMilliseconds) =>
  new Date(TEST_NOW.getTime() + offsetMilliseconds).toISOString().replace(".000Z", "Z");

function artifact(spec, byteCount) {
  return {
    role: spec.role,
    format: spec.format,
    fileName: spec.fileName,
    byteCount,
    sha256: rawSha256(`artifact-${spec.role}`),
    formatProfileSha256: spec.profileSha256
  };
}

function compositionIdentities(artifacts) {
  const memberCount = 5;
  const recordBytes = 128;
  const table = Buffer.alloc(memberCount * recordBytes);
  let resolvedMemberBytes = 0;

  for (let index = 0; index < memberCount; index += 1) {
    const value = artifacts[index];
    const offset = index * recordBytes;
    table.writeUInt16LE(1, offset);
    table.writeUInt16LE(index + 1, offset + 2);
    table.writeUInt16LE(index + 1, offset + 4);
    table.writeUInt32LE(index, offset + 8);
    table.writeBigUInt64LE(BigInt(value.byteCount), offset + 16);
    table.set(Buffer.from(value.sha256, "hex"), offset + 24);
    table.set(Buffer.from(value.formatProfileSha256, "hex"), offset + 56);
    resolvedMemberBytes += value.byteCount;
  }

  const framing = Buffer.alloc(17);
  framing.writeUInt16LE(2, 0);
  framing.writeUInt16LE(0, 2);
  framing.writeUInt8(1, 4);
  framing.writeUInt32LE(memberCount, 5);
  framing.writeBigUInt64LE(BigInt(resolvedMemberBytes), 9);
  const domain = Buffer.from("tinyrustlm.acg2.champion-graph.v1\0", "ascii");

  return {
    graphIdentitySha256: rawSha256(Buffer.concat([domain, framing, table])),
    memberTableSha256: rawSha256(table),
    resolvedMemberBytes
  };
}

function validAdmission() {
  const sizes = [1_048_576, 7_038_773, 1_403, 65_800, 512, 896];
  const artifacts = admissionApi.artifactSpecs.map((spec, index) =>
    artifact(spec, sizes[index])
  );
  const composition = compositionIdentities(artifacts);
  return {
    schema: admissionApi.schema,
    modelId: "Qwen/Qwen3-0.6B",
    operationId: rawSha256("browser-operation"),
    artifacts,
    composition,
    qualification: {
      receiptId: QUALIFICATION_RECEIPT_ID_A,
      sourceEvidenceSha256: rawSha256("source"),
      structuralEvidenceSha256: rawSha256("structure"),
      numericalEvidenceSha256: rawSha256("numerical"),
      qualityEvidenceSha256: rawSha256("quality"),
      evalCasesSha256: rawSha256("eval-cases"),
      qualityClaim: "general-assistant-qualified",
      qualityScope: "general-assistant"
    },
    runtime: {
      workerProtocol: admissionApi.workerProtocol,
      wasmByteCount: 676_916,
      wasmSha256: rawSha256("runtime-wasm"),
      policy: {
        maximumModelBytes: artifacts[0].byteCount,
        maximumSequenceTokens: 4096,
        maximumKvBytes: 256 * 1024 * 1024,
        maximumScratchBytes: 128 * 1024 * 1024,
        maximumResolvedMemberBytes: composition.resolvedMemberBytes,
        maximumResidentDependencyBytes:
          composition.resolvedMemberBytes - artifacts[0].byteCount,
        maximumRequestBytes: 1_054_848,
        maximumLinearMemoryBytes: 1536 * 1024 * 1024
      },
      defaultSampling: {
        temperatureMillionths: 600_000,
        topK: 20,
        topPMillionths: 950_000,
        repetitionPenaltyMillionths: 1_000_000,
        repetitionWindow: 64,
        maximumNewTokens: 512
      }
    }
  };
}

function validCatalogView(admissionValue = validAdmission()) {
  const admissionText = admissionApi.serializeAdmission(admissionValue);
  const admissionBytes = encoder.encode(admissionText);
  const qualificationReceipt = {
    schema: loader.qualificationReceiptSchema,
    receiptId: admissionValue.qualification.receiptId,
    modelId: admissionValue.modelId,
    operationId: admissionValue.operationId,
    compositionId: `sha256:${admissionValue.composition.graphIdentitySha256}`,
    sourceEvidenceSha256: admissionValue.qualification.sourceEvidenceSha256,
    structuralEvidenceSha256: admissionValue.qualification.structuralEvidenceSha256,
    numericalEvidenceSha256: admissionValue.qualification.numericalEvidenceSha256,
    qualityEvidenceSha256: admissionValue.qualification.qualityEvidenceSha256,
    evalCasesSha256: admissionValue.qualification.evalCasesSha256,
    qualityClaim: admissionValue.qualification.qualityClaim,
    qualityScope: admissionValue.qualification.qualityScope,
    numericalStatus: "passed",
    browserStatus: "passed",
    qualityStatus: "qualified",
    issuedAtUtc: utc(-2 * 60_000)
  };
  const qualificationReceiptText = `${JSON.stringify(qualificationReceipt)}\n`;
  const qualificationReceiptBytes = encoder.encode(qualificationReceiptText);
  const qualificationReceiptSha256 = prefixedSha256(qualificationReceiptBytes);
  const entry = {
    entry_id: "qwen/qwen3-0.6b",
    display_name: "Qwen3 0.6B",
    description: "One exact qualified six-member SLM2 composition.",
    source: {
      repository: admissionValue.modelId,
      revision: "a".repeat(40),
      source_lock_sha256: prefixedSha256("source-lock")
    },
    license: {
      route: "/licenses/qwen3-0.6b.txt",
      review_status: "reviewed"
    },
    composition: {
      composition_id: `sha256:${admissionValue.composition.graphIdentitySha256}`,
      member_count: 6,
      members: admissionValue.artifacts.map((value, index) => ({
        name: value.fileName,
        bytes: value.byteCount,
        sha256: `sha256:${value.sha256}`,
        schema: `tinyrustlm.member.${index + 1}.v1`
      }))
    },
    browser_admission: {
      route: "/catalog/browser-admissions/qwen3-0.6b.browser-composition-admission.json",
      bytes: admissionBytes.byteLength,
      sha256: prefixedSha256(admissionBytes)
    },
    profiles: {
      conversion: "tinyrustlm.converter.v1",
      quantization: "tinyrustlm.mixed-q8.v1",
      runtime: "tinyrustlm.browser.v1"
    },
    qualification: {
      status: "qualified",
      receipt_id: QUALIFICATION_RECEIPT_ID_A,
      receipt_route: "/catalog/qualification-receipts/qwen3-0.6b.json",
      receipt_bytes: qualificationReceiptBytes.byteLength,
      receipt_sha256: qualificationReceiptSha256,
      numerical_status: "passed",
      browser_status: "passed",
      quality_status: "qualified"
    },
    peer_announcement_ids: []
  };
  const catalog = {
    schema: catalogApi.CATALOG_SCHEMA,
    catalog_id: "minimodel.org/prelaunch",
    revision: 1,
    generated_at_utc: utc(-60_000),
    valid_until_utc: utc(60 * 60_000),
    project_server_serves_model_bytes: false,
    project_server_proxies_model_bytes: false,
    project_server_runs_inference: false,
    qualification_policy: "exact-current-evidence-required",
    qualification_receipt_schema: catalogApi.QUALIFICATION_RECEIPT_SCHEMA,
    browser_admission_schema: catalogApi.BROWSER_ADMISSION_SCHEMA,
    peer_verification_keys: [],
    revoked_qualification_receipt_ids: [],
    supersessions: [],
    entries: [entry]
  };
  const peerFeed = {
    schema: catalogApi.PEER_SCHEMA,
    feed_id: "minimodel.org/prelaunch-peers",
    revision: 1,
    generated_at_utc: utc(-60_000),
    valid_until_utc: utc(60 * 60_000),
    project_server_serves_model_bytes: false,
    project_server_proxies_model_bytes: false,
    announcements: []
  };
  const [view] = catalogApi.buildCatalogView(catalog, peerFeed);
  return {
    admissionValue,
    admissionText,
    admissionBytes,
    qualificationReceipt,
    qualificationReceiptText,
    qualificationReceiptBytes,
    qualificationReceiptSha256,
    view
  };
}

function arrayBufferResponse(bytes, options = {}) {
  const body = Uint8Array.from(bytes);
  let consumed = false;
  const declaredLength = options.declaredLength === undefined
    ? String(body.byteLength)
    : options.declaredLength;
  return {
    ok: options.ok === undefined ? true : options.ok,
    status: options.status === undefined ? 200 : options.status,
    redirected: options.redirected === true,
    headers: {
      get(name) {
        return name.toLowerCase() === "content-length" ? declaredLength : null;
      }
    },
    body: {
      getReader() {
        return {
          async read() {
            if (consumed) return { done: true, value: undefined };
            consumed = true;
            return { done: false, value: body.slice() };
          },
          cancel() {
            consumed = true;
            return Promise.resolve();
          }
        };
      }
    },
    arrayBuffer: async () => body.slice().buffer
  };
}

function streamResponse(bytes, chunkSize = 257) {
  const body = Uint8Array.from(bytes);
  let offset = 0;
  let canceled = false;
  return {
    response: {
      ok: true,
      status: 200,
      redirected: false,
      headers: {
        get(name) {
          return name.toLowerCase() === "content-length"
            ? String(body.byteLength)
            : null;
        }
      },
      body: {
        getReader() {
          return {
            read: async () => {
              if (offset >= body.byteLength) {
                return { done: true, value: undefined };
              }
              const end = Math.min(offset + chunkSize, body.byteLength);
              const value = body.slice(offset, end);
              offset = end;
              return { done: false, value };
            },
            cancel() {
              canceled = true;
              return Promise.resolve();
            }
          };
        }
      }
    },
    wasCanceled: () => canceled
  };
}

function hashFunction(bytes) {
  return rawSha256(bytes);
}

function loadOptions(fixture, fetch, extra = {}) {
  const { qualificationFetch, ...loaderExtra } = extra;
  const receiptUrl = new URL(
    fixture.view.qualification.receiptRoute,
    "https://minimodel.org/catalog/compositions.v1.json"
  ).toString();
  return {
    catalogView: fixture.view,
    catalogBaseUrl: "https://minimodel.org/catalog/compositions.v1.json",
    fetch: (url, options) => url === receiptUrl
      ? (qualificationFetch
        ? qualificationFetch(url, options)
        : arrayBufferResponse(fixture.qualificationReceiptBytes))
      : fetch(url, options),
    admissionParser: admissionApi,
    hash: hashFunction,
    ...loaderExtra
  };
}

function withDescriptorForText(view, text) {
  const copy = structuredClone(view);
  const bytes = encoder.encode(text);
  copy.browserAdmission.bytes = bytes.byteLength;
  copy.browserAdmission.sha256 = prefixedSha256(bytes);
  return { view: copy, bytes };
}

function errorCode(code) {
  return (error) => {
    assert.ok(error instanceof loader.CatalogAdmissionLoaderError);
    assert.equal(error.code, code);
    return true;
  };
}

test("loads one exact canonical catalog admission with a body-free request", async () => {
  const fixture = validCatalogView();
  const requests = [];
  const result = await loader.load(loadOptions(
    fixture,
    async (url, options) => {
      requests.push({ url, options });
      return arrayBufferResponse(fixture.admissionBytes);
    }
  ));

  assert.equal(requests.length, 1);
  assert.equal(
    requests[0].url,
    "https://minimodel.org/catalog/browser-admissions/" +
      "qwen3-0.6b.browser-composition-admission.json"
  );
  assert.deepEqual(requests[0].options, {
    method: "GET",
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer"
  });
  assert.equal(Object.hasOwn(requests[0].options, "body"), false);
  assert.equal(result.admissionText, fixture.admissionText);
  assert.equal(result.admissionSha256, prefixedSha256(fixture.admissionBytes));
  assert.deepEqual(result.admission, admissionApi.parseAdmissionText(fixture.admissionText));
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.admission));
  assert.ok(Object.isFrozen(result.admission.artifacts));
  assert.ok(Object.isFrozen(result.admission.qualification));
});

test("binds receipt identity A independently from receipt bytes digest B", async () => {
  const fixture = validCatalogView();

  assert.equal(fixture.view.qualification.receiptId, QUALIFICATION_RECEIPT_ID_A);
  assert.equal(
    fixture.view.qualification.receiptSha256,
    fixture.qualificationReceiptSha256
  );
  assert.notEqual(
    fixture.view.qualification.receiptId,
    fixture.view.qualification.receiptSha256
  );

  const result = await loader.load(loadOptions(
    fixture,
    async () => arrayBufferResponse(fixture.admissionBytes)
  ));

  assert.equal(
    result.admission.qualification.receiptId,
    QUALIFICATION_RECEIPT_ID_A
  );
  assert.deepEqual(result.qualificationReceipt, fixture.qualificationReceipt);
  assert.equal(result.qualificationReceiptSha256, fixture.qualificationReceiptSha256);
});

test("rejects a nonstreaming response before invoking an unbounded body reader", async () => {
  const fixture = validCatalogView();
  let arrayBufferCalled = false;
  await assert.rejects(
    loader.load(loadOptions(fixture, async () => ({
      ok: true,
      status: 200,
      redirected: false,
      headers: {
        get(name) {
          return name.toLowerCase() === "content-length"
            ? String(fixture.admissionBytes.byteLength)
            : null;
        }
      },
      async arrayBuffer() {
        arrayBufferCalled = true;
        return fixture.admissionBytes.buffer;
      }
    }))),
    errorCode("catalog-admission-stream-required")
  );
  assert.equal(arrayBufferCalled, false);
});

test("snapshots catalog, dependencies, and parser output before awaited binding", async () => {
  const fixture = validCatalogView();
  const view = structuredClone(fixture.view);
  let hashCalls = 0;
  let parserOutput;
  const parser = {
    schema: admissionApi.schema,
    parseAdmissionText(text) {
      parserOutput = structuredClone(admissionApi.parseAdmissionText(text));
      return parserOutput;
    }
  };
  const options = {
    catalogView: view,
    catalogBaseUrl: "https://minimodel.org/catalog/compositions.v1.json",
    admissionParser: parser,
    async hash(bytes) {
      hashCalls += 1;
      if (hashCalls === 3) {
        parserOutput.modelId = "Qwen/Changed-After-Parse";
        parserOutput.artifacts[0].byteCount = 1;
      }
      return hashFunction(bytes);
    },
    async fetch(url) {
      view.source.repository = "Qwen/Changed-During-Fetch";
      view.composition.members[0].bytes = 1;
      view.browserAdmission.sha256 = prefixedSha256("changed-descriptor");
      view.qualification.receiptSha256 = prefixedSha256("changed-receipt");
      options.hash = async () => "0".repeat(64);
      options.admissionParser = { schema: "changed", parseAdmissionText() {} };
      return arrayBufferResponse(url.includes("qualification-receipts")
        ? fixture.qualificationReceiptBytes
        : fixture.admissionBytes);
    }
  };

  const result = await loader.load(options);

  assert.equal(hashCalls, 4);
  assert.equal(parserOutput.modelId, "Qwen/Changed-After-Parse");
  assert.equal(result.admission.modelId, fixture.admissionValue.modelId);
  assert.equal(
    result.admission.artifacts[0].byteCount,
    fixture.admissionValue.artifacts[0].byteCount
  );
  assert.notEqual(result.admission, parserOutput);
  assert.ok(Object.isFrozen(result.admission.runtime.policy));
});

test("supports injected Web Crypto while enforcing streamed actual length", async () => {
  const fixture = validCatalogView();
  const streamed = streamResponse(fixture.admissionBytes);
  const options = loadOptions(fixture, async () => streamed.response, {
    crypto: nodeCrypto.webcrypto
  });
  delete options.hash;

  const result = await loader.load(options);
  assert.equal(result.admission.modelId, fixture.view.source.repository);
  assert.equal(streamed.wasCanceled(), false);
});

test("resolves only a safe route against the catalog origin", async () => {
  const fixture = validCatalogView();
  let requests = 0;
  const fetch = async () => {
    requests += 1;
    return arrayBufferResponse(fixture.admissionBytes);
  };

  for (const route of [
    "https://other.example/admission.json",
    "//other.example/admission.json",
    "/catalog/../admission.json",
    "/catalog/./admission.json"
  ]) {
    const view = structuredClone(fixture.view);
    view.browserAdmission.route = route;
    await assert.rejects(
      loader.load(loadOptions({ ...fixture, view }, fetch)),
      errorCode("catalog-admission-route")
    );
  }

  await assert.rejects(
    loader.load({
      ...loadOptions(fixture, fetch),
      catalogBaseUrl: "https://user:secret@minimodel.org/catalog/compositions.v1.json"
    }),
    errorCode("catalog-admission-origin")
  );
  assert.equal(requests, 0);
});

test("requires exact declared and actual response lengths", async (t) => {
  const fixture = validCatalogView();

  await t.test("missing declaration", async () => {
    await assert.rejects(
      loader.load(loadOptions(
        fixture,
        async () => arrayBufferResponse(fixture.admissionBytes, {
          declaredLength: null
        })
      )),
      errorCode("catalog-admission-declared-length")
    );
  });

  await t.test("declaration differs from descriptor", async () => {
    await assert.rejects(
      loader.load(loadOptions(
        fixture,
        async () => arrayBufferResponse(fixture.admissionBytes, {
          declaredLength: String(fixture.admissionBytes.byteLength - 1)
        })
      )),
      errorCode("catalog-admission-declared-length")
    );
  });

  await t.test("actual bytes are short", async () => {
    const short = fixture.admissionBytes.slice(0, -1);
    const response = arrayBufferResponse(short, {
      declaredLength: String(fixture.admissionBytes.byteLength)
    });
    await assert.rejects(
      loader.load(loadOptions(fixture, async () => response)),
      errorCode("catalog-admission-actual-length")
    );
  });

  await t.test("stream cannot exceed the descriptor", async () => {
    const extra = new Uint8Array(fixture.admissionBytes.byteLength + 1);
    extra.set(fixture.admissionBytes);
    const streamed = streamResponse(extra, extra.byteLength);
    streamed.response.headers.get = (name) => name.toLowerCase() === "content-length"
      ? String(fixture.admissionBytes.byteLength)
      : null;
    await assert.rejects(
      loader.load(loadOptions(fixture, async () => streamed.response)),
      errorCode("catalog-admission-actual-length")
    );
    assert.equal(streamed.wasCanceled(), true);
  });
});

test("rejects descriptor, content digest, UTF-8, and canonical-byte drift", async (t) => {
  const fixture = validCatalogView();

  await t.test("descriptor byte bounds", async () => {
    let requests = 0;
    for (const bytes of [0, 65_537]) {
      const view = structuredClone(fixture.view);
      view.browserAdmission.bytes = bytes;
      await assert.rejects(
        loader.load(loadOptions({ ...fixture, view }, async () => {
          requests += 1;
          return arrayBufferResponse(fixture.admissionBytes);
        })),
        errorCode("catalog-admission-descriptor")
      );
    }
    assert.equal(requests, 0);
  });

  await t.test("descriptor digest form", async () => {
    const view = structuredClone(fixture.view);
    view.browserAdmission.sha256 = view.browserAdmission.sha256.toUpperCase();
    await assert.rejects(
      loader.load(loadOptions({ ...fixture, view }, async () => {
        throw new Error("must not fetch");
      })),
      errorCode("catalog-admission-descriptor")
    );
  });

  await t.test("computed digest form", async () => {
    let hashCalls = 0;
    await assert.rejects(
      loader.load({
        ...loadOptions(
          fixture,
          async () => arrayBufferResponse(fixture.admissionBytes)
        ),
        hash: async (bytes) => {
          hashCalls += 1;
          const digest = hashFunction(bytes);
          return hashCalls === 1 ? digest : digest.toUpperCase();
        }
      }),
      errorCode("catalog-admission-sha256")
    );
  });

  await t.test("content digest", async () => {
    const drifted = fixture.admissionBytes.slice();
    drifted[0] ^= 1;
    await assert.rejects(
      loader.load(loadOptions(
        fixture,
        async () => arrayBufferResponse(drifted)
      )),
      errorCode("catalog-admission-sha256")
    );
  });

  await t.test("fatal UTF-8", async () => {
    const invalid = Uint8Array.of(0xc3, 0x28);
    const view = structuredClone(fixture.view);
    view.browserAdmission.bytes = invalid.byteLength;
    view.browserAdmission.sha256 = prefixedSha256(invalid);
    await assert.rejects(
      loader.load(loadOptions(
        { ...fixture, view },
        async () => arrayBufferResponse(invalid)
      )),
      errorCode("catalog-admission-utf8")
    );
  });

  await t.test("noncanonical JSON", async () => {
    const text = JSON.stringify(JSON.parse(fixture.admissionText), null, 2);
    const drifted = withDescriptorForText(fixture.view, text);
    await assert.rejects(
      loader.load(loadOptions(
        { ...fixture, view: drifted.view },
        async () => arrayBufferResponse(drifted.bytes)
      )),
      errorCode("catalog-admission-canonical")
    );
  });
});

test("binds model, all six members, composition, and receipt to the catalog view", async (t) => {
  const fixture = validCatalogView();

  async function rejectsChangedAdmission(value, code) {
    const text = admissionApi.serializeAdmission(value);
    const bound = withDescriptorForText(fixture.view, text);
    await assert.rejects(
      loader.load(loadOptions(
        { ...fixture, view: bound.view },
        async () => arrayBufferResponse(bound.bytes)
      )),
      errorCode(code)
    );
  }

  await t.test("model ID", async () => {
    const value = structuredClone(fixture.admissionValue);
    value.modelId = "Qwen/Other-0.6B";
    await rejectsChangedAdmission(value, "catalog-admission-model");
  });

  await t.test("member size", async () => {
    const value = structuredClone(fixture.admissionValue);
    value.artifacts[0].byteCount -= 1;
    value.composition.resolvedMemberBytes -= 1;
    await rejectsChangedAdmission(value, "catalog-admission-members");
  });

  await t.test("member digest", async () => {
    const value = structuredClone(fixture.admissionValue);
    value.artifacts[4].sha256 = rawSha256("alternate-prompt");
    await rejectsChangedAdmission(value, "catalog-admission-members");
  });

  await t.test("composition identity", async () => {
    const value = structuredClone(fixture.admissionValue);
    value.composition.graphIdentitySha256 = rawSha256("alternate-graph");
    await rejectsChangedAdmission(value, "catalog-admission-composition");
  });

  await t.test("composition member table", async () => {
    const value = structuredClone(fixture.admissionValue);
    value.composition.memberTableSha256 = rawSha256("alternate-member-table");
    await rejectsChangedAdmission(value, "catalog-admission-composition");
  });

  await t.test("qualification receipt", async () => {
    const value = structuredClone(fixture.admissionValue);
    value.qualification.receiptId = prefixedSha256("alternate-receipt");
    await rejectsChangedAdmission(value, "catalog-admission-qualification");
  });

  await t.test("catalog qualification receipt ID", async () => {
    const view = structuredClone(fixture.view);
    view.qualification.receiptId = prefixedSha256("alternate-catalog-receipt");
    await assert.rejects(
      loader.load(loadOptions(
        { ...fixture, view },
        async () => arrayBufferResponse(fixture.admissionBytes)
      )),
      errorCode("catalog-admission-qualification")
    );
  });
});

test("the descriptor content-addresses member-table and quality-claim bytes", async (t) => {
  const fixture = validCatalogView();

  await t.test("member table", async () => {
    const value = structuredClone(fixture.admissionValue);
    value.composition.memberTableSha256 = rawSha256("alternate-member-table");
    const bytes = encoder.encode(admissionApi.serializeAdmission(value));
    assert.equal(bytes.byteLength, fixture.admissionBytes.byteLength);
    await assert.rejects(
      loader.load(loadOptions(
        fixture,
        async () => arrayBufferResponse(bytes)
      )),
      errorCode("catalog-admission-sha256")
    );
  });

  await t.test("quality claim", async () => {
    const value = structuredClone(fixture.admissionValue);
    value.qualification.qualityClaim = "task-specific-qualified";
    value.qualification.qualityScope = "code-explanation/rust";
    const bytes = encoder.encode(admissionApi.serializeAdmission(value));
    assert.equal(bytes.byteLength, fixture.admissionBytes.byteLength);
    await assert.rejects(
      loader.load(loadOptions(
        fixture,
        async () => arrayBufferResponse(bytes)
      )),
      errorCode("catalog-admission-sha256")
    );
  });
});

test("rejects missing, competing, or unknown injected dependencies", async () => {
  const fixture = validCatalogView();
  const fetch = async () => arrayBufferResponse(fixture.admissionBytes);

  const missingHash = loadOptions(fixture, fetch);
  delete missingHash.hash;
  await assert.rejects(
    loader.load(missingHash),
    errorCode("catalog-admission-loader-options")
  );

  await assert.rejects(
    loader.load({
      ...loadOptions(fixture, fetch),
      crypto: nodeCrypto.webcrypto
    }),
    errorCode("catalog-admission-loader-options")
  );

  await assert.rejects(
    loader.load({
      ...loadOptions(fixture, fetch),
      fallback: true
    }),
    errorCode("catalog-admission-loader-options")
  );
});

test("publishes the frozen UMD browser API when CommonJS is absent", () => {
  const context = vm.createContext({});
  vm.runInContext(
    fs.readFileSync(require.resolve("../app/catalog-admission-loader.js"), "utf8"),
    context
  );

  const browserApi = context.TinyRustLMCatalogAdmissionLoader;
  assert.equal(typeof browserApi.load, "function");
  assert.equal(browserApi.admissionSchema, admissionApi.schema);
  assert.equal(browserApi.maximumAdmissionBytes, 65_536);
  assert.ok(Object.isFrozen(browserApi));
});
