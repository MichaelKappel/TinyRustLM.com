"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const {
  PhysicalPortfolio,
  baseDependentAdapter,
  composition,
  compositionMember,
  decodeTypedId,
  encodeTypedId,
  executionBindings,
  kvCacheKey,
  kvFormat,
  requiredByteFields,
  retrievalIndex,
  routePolicy,
  sharedChunk,
  standaloneModel,
  storageLayout,
  verifyReconstruction
} = require("../tools/content-identity.js");

/** Returns one repeated-byte lowercase SHA-256 test value. */
function digest(byte) {
  return byte.toString(16).padStart(2, "0").repeat(32);
}

/** Computes lowercase SHA-256 for exact fixture bytes. */
function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/** Returns the frozen-vector execution profiles. */
function bindings() {
  return executionBindings({
    tokenizerSha256: digest(0x22),
    chatTemplateSha256: digest(0x33),
    tensorLayoutSha256: digest(0x44),
    quantizationProfileSha256: digest(0x55),
    executionProfileSha256: digest(0x66)
  });
}

/** Returns the frozen-vector standalone model. */
function model() {
  return standaloneModel({
    modelBytes: 1024,
    modelSha256: digest(0x11),
    bindings: bindings()
  });
}

/** Returns one adapter with the requested digest byte and semantic. */
function adapter(base, byte, semantics) {
  return baseDependentAdapter({
    adapterBytes: 128,
    adapterSha256: digest(byte),
    base,
    semantics
  });
}

/** Returns the champion and one additive frozen-vector specialist. */
function compositions() {
  const base = model();
  const delta = adapter(base, 0x77, "additive");
  return {
    base,
    delta,
    champion: composition({
      base,
      semantics: "base-only",
      members: []
    }),
    specialist: composition({
      base,
      semantics: "additive",
      members: [
        compositionMember({ adapter: delta, dependencies: [] })
      ]
    })
  };
}

test("matches every frozen Rust and preregistration identity vector", () => {
  const { base, delta, champion, specialist } = compositions();
  assert.equal(
    base.id.digest,
    "83d45410e3001af2e476fe0ec9e3b24ce25da89ff764984bf8113d17c6e70712"
  );
  assert.equal(
    delta.id.digest,
    "0d36e52ccbfa3d41b4186d1a3a2d9adeda28f41a0ae40d7fc184763fd20ac9f6"
  );
  assert.equal(
    champion.id.digest,
    "217a076597ef9e5ecbd5c7152cf20b5d4158db4b0faadf9ac4e3cef42ab9bb59"
  );
  assert.equal(
    specialist.id.digest,
    "c7a1d4b8586cee3f9d8d284dd7bbc5f555bc8be620a766f5120dcfbfb7d41e20"
  );

  const chunkOne = sharedChunk({
    chunkBytes: 512,
    chunkSha256: digest(0x88)
  });
  const chunkTwo = sharedChunk({
    chunkBytes: 512,
    chunkSha256: digest(0x99)
  });
  assert.equal(
    chunkOne.id.digest,
    "f79a22b124d46f5d8516b581d3bb84a5d9e652a6002ff47c03d482b19309f3a6"
  );
  assert.equal(
    chunkTwo.id.digest,
    "46432c105cdeab0fdc64bbdddf32aee4132a6ebefd166f9f481ea81fa2c0eba0"
  );
  const layout = storageLayout({
    target: base,
    chunks: [chunkOne, chunkTwo]
  });
  assert.equal(
    layout.digest,
    "210193d2db2f3bf84dce1d7390ab8be25e92d3a4b518ede1ac5bb9498f662db9"
  );

  const format = kvFormat({
    descriptorBytes: 64,
    descriptorSha256: digest(0xaa)
  });
  assert.equal(
    format.id.digest,
    "8108d7a2bda41c88d3e541f47b17be789462b7360c391a7ebbe9264408322430"
  );
  const retrieval = retrievalIndex({
    indexBytes: 256,
    indexSha256: digest(0xbb),
    embeddingModel: base,
    embeddingProfileSha256: digest(0xcc),
    vectorDimension: 64,
    metric: "cosine"
  });
  assert.equal(
    retrieval.id.digest,
    "b5b59c101fd6ce1245c94043665db7616c217359208e99a1461a5906ed899a59"
  );
  const route = routePolicy({
    policyBytes: 96,
    policySha256: digest(0xdd),
    champion,
    specialists: [specialist],
    selectors: [retrieval.id]
  });
  assert.equal(
    route.id.digest,
    "f33ccf5198a97517a07bc68408aa7784bdefe5d779532f4ffedd612ae08dccfe"
  );
  assert.equal(
    kvCacheKey({
      composition: specialist,
      positionPolicySha256: digest(0x11),
      kvFormat: format,
      promptTokenSha256: digest(0x44)
    }),
    "be74ec931c3fa92500ba6f292d046789c61324ce712636476a45aec9758d0f51"
  );
});

test("canonicalizes additive order while preserving sequential order", () => {
  const base = model();
  const additiveLeft = adapter(base, 0x70, "additive");
  const additiveRight = adapter(base, 0x71, "additive");
  const additiveOne = composition({
    base,
    semantics: "additive",
    members: [
      compositionMember({ adapter: additiveLeft, dependencies: [] }),
      compositionMember({ adapter: additiveRight, dependencies: [] })
    ]
  });
  const additiveTwo = composition({
    base,
    semantics: "additive",
    members: [
      compositionMember({ adapter: additiveRight, dependencies: [] }),
      compositionMember({ adapter: additiveLeft, dependencies: [] })
    ]
  });
  assert.equal(additiveOne.id.display, additiveTwo.id.display);

  const sequentialLeft = adapter(base, 0x70, "sequential");
  const sequentialRight = adapter(base, 0x71, "sequential");
  const sequentialOne = composition({
    base,
    semantics: "sequential",
    members: [
      compositionMember({ adapter: sequentialLeft, dependencies: [] }),
      compositionMember({ adapter: sequentialRight, dependencies: [] })
    ]
  });
  const sequentialTwo = composition({
    base,
    semantics: "sequential",
    members: [
      compositionMember({ adapter: sequentialRight, dependencies: [] }),
      compositionMember({ adapter: sequentialLeft, dependencies: [] })
    ]
  });
  assert.notEqual(sequentialOne.id.display, sequentialTwo.id.display);
});

test("rejects member, binding, duplicate, and dependency violations", () => {
  const base = model();
  const other = standaloneModel({
    modelBytes: 1024,
    modelSha256: digest(0x12),
    bindings: bindings()
  });
  const wrongBase = adapter(other, 0x70, "additive");
  assert.throws(() => composition({
    base,
    semantics: "additive",
    members: [
      compositionMember({ adapter: wrongBase, dependencies: [] })
    ]
  }), /base does not match/u);

  const additive = adapter(base, 0x70, "additive");
  const member = compositionMember({ adapter: additive, dependencies: [] });
  assert.throws(() => composition({
    base,
    semantics: "additive",
    members: Array.from({ length: 1025 }, () => member)
  }), /member limit/u);
  assert.throws(() => composition({
    base,
    semantics: "additive",
    members: [member, member]
  }), /duplicate member/u);
  assert.throws(() => composition({
    base,
    semantics: "replacement",
    members: []
  }), /member count/u);
  assert.throws(() => composition({
    base,
    semantics: "additive",
    members: [
      compositionMember({
        adapter: additive,
        dependencies: [additive.id]
      })
    ]
  }), /cannot declare dependencies/u);

  const first = adapter(base, 0x70, "dependent");
  const second = adapter(base, 0x71, "dependent");
  assert.throws(() => composition({
    base,
    semantics: "dependent",
    members: [
      compositionMember({
        adapter: first,
        dependencies: [second.id]
      }),
      compositionMember({ adapter: second, dependencies: [] })
    ]
  }), /non-earlier member/u);
});

test("strictly parses typed identities and rejects unknown or trailing data", () => {
  const id = model().id;
  const encoded = encodeTypedId(id);
  const decoded = decodeTypedId(encoded);
  assert.deepEqual(decoded, id);
  assert.equal(decoded.display, id.display);

  const unknown = Buffer.from(encoded);
  unknown[0] = 255;
  assert.throws(() => decodeTypedId(unknown), /kind tag is unknown/u);
  assert.throws(() =>
    decodeTypedId(Buffer.concat([encoded, Buffer.from([0])])),
  /exactly 33 bytes/u);
  assert.throws(() =>
    decodeTypedId(Buffer.concat([Buffer.from([1]), Buffer.alloc(32)])),
  /all-zero sentinel/u);
});

test("verifies ordered chunks and complete reconstruction", () => {
  const left = Buffer.from("left");
  const right = Buffer.from("right");
  const whole = Buffer.concat([left, right]);
  const target = standaloneModel({
    modelBytes: whole.length,
    modelSha256: sha256(whole),
    bindings: bindings()
  });
  const leftChunk = sharedChunk({
    chunkBytes: left.length,
    chunkSha256: sha256(left)
  });
  const rightChunk = sharedChunk({
    chunkBytes: right.length,
    chunkSha256: sha256(right)
  });
  const layout = storageLayout({
    target,
    chunks: [leftChunk, rightChunk]
  });
  assert.doesNotThrow(() =>
    verifyReconstruction(layout, [left, right]));

  const changed = Buffer.from(right);
  changed[0] ^= 1;
  assert.throws(() =>
    verifyReconstruction(layout, [left, changed]),
  /chunk digest/u);
  assert.throws(() => storageLayout({
    target,
    chunks: [leftChunk, leftChunk]
  }), /duplicate chunk|do not match/u);
});

test("binds routes and KV keys to exact semantic roles", () => {
  const { base, champion, specialist } = compositions();
  const format = kvFormat({
    descriptorBytes: 64,
    descriptorSha256: digest(0xaa)
  });
  const firstKey = kvCacheKey({
    composition: specialist,
    positionPolicySha256: digest(0x11),
    kvFormat: format,
    promptTokenSha256: digest(0x44)
  });
  const championKey = kvCacheKey({
    composition: champion,
    positionPolicySha256: digest(0x11),
    kvFormat: format,
    promptTokenSha256: digest(0x44)
  });
  assert.notEqual(firstKey, championKey);

  assert.throws(() => routePolicy({
    policyBytes: 96,
    policySha256: digest(0xdd),
    champion,
    specialists: [specialist],
    selectors: [specialist.id]
  }), /selector kind/u);
  assert.throws(() => routePolicy({
    policyBytes: 96,
    policySha256: digest(0xdd),
    champion: specialist,
    specialists: [champion],
    selectors: [base.id]
  }), /base-only/u);
});

test("keeps all byte categories separate and deduplicates physical bytes", () => {
  const { base, delta, champion, specialist } = compositions();
  const retrieval = retrievalIndex({
    indexBytes: 256,
    indexSha256: digest(0xbb),
    embeddingModel: base,
    embeddingProfileSha256: digest(0xcc),
    vectorDimension: 64,
    metric: "cosine"
  });
  const route = routePolicy({
    policyBytes: 96,
    policySha256: digest(0xdd),
    champion,
    specialists: [specialist],
    selectors: [retrieval.id]
  });
  const format = kvFormat({
    descriptorBytes: 64,
    descriptorSha256: digest(0xaa)
  });
  const portfolio = new PhysicalPortfolio()
    .addStandalone(base)
    .addStandalone(base)
    .addAdapter(delta)
    .addAdapter(delta)
    .addRoutePolicy(route)
    .addRetrievalIndex(retrieval)
    .addKvFormat(format);
  const accounting = portfolio.account(specialist, {
    kvAllocatedBytes: 50,
    kvCommittedBytes: 40,
    kvPeakBytes: 60,
    activationScratchBytes: 70,
    decodedTemporaryBytes: 80,
    peakResidentBytes: 100
  });
  assert.deepEqual(Object.keys(accounting), requiredByteFields);
  assert.deepEqual(accounting, {
    standaloneArtifactBytes: 1024n,
    logicalCompositionBytes: 1152n,
    incrementalSpecialistBytes: 128n,
    physicalPortfolioBytes: 1568n,
    routePolicyBytes: 96n,
    retrievalIndexBytes: 256n,
    kvFormatDescriptorBytes: 64n,
    kvAllocatedBytes: 50n,
    kvCommittedBytes: 40n,
    kvPeakBytes: 60n,
    activationScratchBytes: 70n,
    decodedTemporaryBytes: 80n,
    peakResidentBytes: 100n
  });

  assert.throws(() =>
    new PhysicalPortfolio().addStandalone(base).account(specialist, {
      kvAllocatedBytes: 0,
      kvCommittedBytes: 0,
      kvPeakBytes: 0,
      activationScratchBytes: 0,
      decodedTemporaryBytes: 0,
      peakResidentBytes: 0
    }),
  /adapter is missing/u);
});

test("rejects zero, overflow, unknown fields, and impossible memory peaks", () => {
  assert.throws(() => standaloneModel({
    modelBytes: 0,
    modelSha256: digest(0x11),
    bindings: bindings()
  }), /positive u64/u);
  assert.throws(() => standaloneModel({
    modelBytes: 1,
    modelSha256: digest(0x11),
    bindings: bindings(),
    alias: "mutable-name"
  }), /fields are invalid/u);

  const hugeBase = standaloneModel({
    modelBytes: (1n << 64n) - 1n,
    modelSha256: digest(0x11),
    bindings: bindings()
  });
  const delta = baseDependentAdapter({
    adapterBytes: 1,
    adapterSha256: digest(0x77),
    base: hugeBase,
    semantics: "additive"
  });
  assert.throws(() => composition({
    base: hugeBase,
    semantics: "additive",
    members: [
      compositionMember({ adapter: delta, dependencies: [] })
    ]
  }), /overflows u64/u);

  const { base } = compositions();
  assert.throws(() =>
    new PhysicalPortfolio().addStandalone(base).account(
      composition({ base, semantics: "base-only", members: [] }),
      {
        kvAllocatedBytes: 10,
        kvCommittedBytes: 11,
        kvPeakBytes: 12,
        activationScratchBytes: 0,
        decodedTemporaryBytes: 0,
        peakResidentBytes: 20
      }
    ),
  /committed KV bytes/u);
});
