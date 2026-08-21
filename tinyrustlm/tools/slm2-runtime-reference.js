"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const formatVectorPath = path.join(
  repositoryRoot,
  "contracts/vnext/slm2-format-vectors.v1.json"
);
const runtimeVectorPath = path.join(
  repositoryRoot,
  "contracts/vnext/slm2-runtime-vectors.v1.json"
);

const modelSpec = Object.freeze({
  contextLength: 128,
  embeddingSize: 8,
  feedForwardSize: 16,
  headCount: 2,
  headDimension: 8,
  kvHeadCount: 1,
  layerCount: 1,
  normalizationEpsilonBits: "3727c5ac",
  qkNormalization: false,
  qkvBias: false,
  ropeThetaBits: "461c4000",
  tiedEmbeddings: true,
  vocabularySize: 32
});

function invariant(condition, message) {
  if (!condition) {
    const error = new Error(message);
    error.code = "slm2_runtime_reference_failed";
    throw error;
  }
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function decodeFloatBits(hex) {
  invariant(/^[0-9a-f]{8}$/u.test(hex), "float bits must be lowercase hexadecimal");
  return Buffer.from(hex, "hex").readFloatBE(0);
}

function finite(value) {
  const rounded = Math.fround(value);
  invariant(Number.isFinite(rounded), "reference arithmetic became non-finite");
  return rounded;
}

function add(left, right) {
  return finite(finite(left) + finite(right));
}

function multiply(left, right) {
  return finite(finite(left) * finite(right));
}

function divide(left, right) {
  return finite(finite(left) / finite(right));
}

function tensorKey(name) {
  return name;
}

function product(values) {
  return values.reduce((result, value) => result * value, 1);
}

function loadCanonicalModel() {
  const document = parseStrictJson(fs.readFileSync(formatVectorPath));
  invariant(document.schema === "tinyrustlm.vnext.slm2-format-vectors.v1",
    "unexpected format-vector schema");
  invariant(Array.isArray(document.vectors) && document.vectors.length > 0,
    "format-vector corpus is empty");
  const vector = document.vectors.find((entry) =>
    entry.id === "base-model-required-f32-tensor-registry");
  invariant(vector !== undefined, "canonical base-model vector is absent");
  const artifact = Buffer.from(vector.artifactHex, "hex");
  invariant(artifact.length === vector.artifactByteLength,
    "canonical artifact byte length drifted");
  invariant(sha256(artifact) === vector.artifactSha256,
    "canonical artifact identity drifted");

  const tensors = new Map();
  for (const metadata of vector.tensors) {
    invariant(!tensors.has(tensorKey(metadata.canonicalName)),
      "duplicate canonical tensor name");
    invariant(metadata.payloadLength === product(metadata.shape) * 4,
      "tensor payload length does not match its shape");
    const start = vector.header.payloadOffset + metadata.payloadRelativeOffset;
    const end = start + metadata.payloadLength;
    invariant(start >= vector.header.payloadOffset && end <= artifact.length,
      "tensor payload lies outside the artifact");
    const values = [];
    for (let offset = start; offset < end; offset += 4) {
      values.push(finite(artifact.readFloatLE(offset)));
    }
    tensors.set(tensorKey(metadata.canonicalName), {
      shape: [...metadata.shape],
      values
    });
  }
  return { artifact, document, tensors, vector };
}

function requireTensor(model, name, shape) {
  const tensor = model.tensors.get(tensorKey(name));
  invariant(tensor !== undefined, `required tensor is absent: ${name}`);
  invariant(tensor.shape.length === shape.length
    && tensor.shape.every((value, index) => value === shape[index]),
  `required tensor shape drifted: ${name}`);
  return tensor.values;
}

function matrixVector(weights, rows, columns, input) {
  invariant(weights.length === rows * columns && input.length === columns,
    "matrix-vector shape mismatch");
  const output = new Array(rows);
  for (let row = 0; row < rows; row += 1) {
    let sum = 0;
    for (let column = 0; column < columns; column += 1) {
      sum = add(sum, multiply(weights[row * columns + column], input[column]));
    }
    output[row] = sum;
  }
  return output;
}

function rmsNorm(input, weights, epsilon) {
  invariant(input.length > 0 && weights.length === input.length,
    "RMS normalization shape mismatch");
  let sum = 0;
  for (const value of input) sum = add(sum, multiply(value, value));
  const mean = divide(sum, input.length);
  const scale = divide(1, finite(Math.sqrt(add(mean, epsilon))));
  return input.map((value, index) => multiply(multiply(value, scale), weights[index]));
}

function applyRope(input, headCount, headDimension, position, theta) {
  invariant(headDimension > 0 && headDimension % 2 === 0
    && input.length === headCount * headDimension, "RoPE shape mismatch");
  const output = [...input];
  const half = headDimension / 2;
  for (let head = 0; head < headCount; head += 1) {
    const base = head * headDimension;
    for (let index = 0; index < half; index += 1) {
      const exponent = divide(2 * index, headDimension);
      const denominator = finite(Math.pow(theta, exponent));
      const angle = divide(position, denominator);
      const sine = finite(Math.sin(angle));
      const cosine = finite(Math.cos(angle));
      const first = input[base + index];
      const second = input[base + index + half];
      output[base + index] = add(multiply(first, cosine), -multiply(second, sine));
      output[base + index + half] = add(multiply(second, cosine), multiply(first, sine));
    }
  }
  return output;
}

function softmax(input) {
  invariant(input.length > 0, "softmax input is empty");
  const maximum = Math.max(...input);
  const output = input.map((value) => finite(Math.exp(add(value, -maximum))));
  let sum = 0;
  for (const value of output) sum = add(sum, value);
  return output.map((value) => divide(value, sum));
}

function groupedQueryAttention(query, cache, spec, position) {
  const queryWidth = spec.headCount * spec.headDimension;
  const kvWidth = spec.kvHeadCount * spec.headDimension;
  const tokenCount = position + 1;
  invariant(query.length === queryWidth
    && cache.keys.length === tokenCount * kvWidth
    && cache.values.length === cache.keys.length, "attention cache shape mismatch");
  const output = new Array(queryWidth).fill(0);
  const queriesPerKv = spec.headCount / spec.kvHeadCount;
  const scale = divide(1, finite(Math.sqrt(spec.headDimension)));
  for (let queryHead = 0; queryHead < spec.headCount; queryHead += 1) {
    const kvHead = Math.floor(queryHead / queriesPerKv);
    const queryStart = queryHead * spec.headDimension;
    const scores = [];
    for (let token = 0; token < tokenCount; token += 1) {
      const keyStart = token * kvWidth + kvHead * spec.headDimension;
      let score = 0;
      for (let offset = 0; offset < spec.headDimension; offset += 1) {
        score = add(score, multiply(query[queryStart + offset], cache.keys[keyStart + offset]));
      }
      scores.push(multiply(score, scale));
    }
    const probabilities = softmax(scores);
    for (let token = 0; token < tokenCount; token += 1) {
      const valueStart = token * kvWidth + kvHead * spec.headDimension;
      for (let offset = 0; offset < spec.headDimension; offset += 1) {
        const outputIndex = queryStart + offset;
        output[outputIndex] = add(
          output[outputIndex],
          multiply(probabilities[token], cache.values[valueStart + offset])
        );
      }
    }
  }
  return output;
}

function residualAdd(left, right) {
  invariant(left.length === right.length, "residual shape mismatch");
  return left.map((value, index) => add(value, right[index]));
}

function silu(value) {
  return divide(value, add(1, finite(Math.exp(-value))));
}

function encodeF32(values) {
  const bytes = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => bytes.writeFloatLE(finite(value), index * 4));
  return {
    f32LeSha256: sha256(bytes),
    values: values.map(finite)
  };
}

function selectGreedy(logits) {
  invariant(logits.length > 0, "cannot select from empty logits");
  let selected = 0;
  for (let index = 1; index < logits.length; index += 1) {
    if (logits[index] > logits[selected]) selected = index;
  }
  return selected;
}

function createReference(model) {
  const spec = {
    ...modelSpec,
    normalizationEpsilon: decodeFloatBits(modelSpec.normalizationEpsilonBits),
    ropeTheta: decodeFloatBits(modelSpec.ropeThetaBits)
  };
  const queryWidth = spec.headCount * spec.headDimension;
  const kvWidth = spec.kvHeadCount * spec.headDimension;
  const embedding = requireTensor(model, "model.token-embedding.weight",
    [spec.vocabularySize, spec.embeddingSize]);
  const finalNorm = requireTensor(model, "model.final-normalization.weight",
    [spec.embeddingSize]);
  const caches = Array.from({ length: spec.layerCount }, () => ({ keys: [], values: [] }));
  let position = 0;

  function reset() {
    for (const cache of caches) {
      cache.keys.length = 0;
      cache.values.length = 0;
    }
    position = 0;
  }

  function forwardToken(tokenId) {
    invariant(Number.isInteger(tokenId) && tokenId >= 0 && tokenId < spec.vocabularySize,
      "token lies outside the vocabulary");
    invariant(position < spec.contextLength, "sequence exceeds context length");
    let hidden = embedding.slice(
      tokenId * spec.embeddingSize,
      (tokenId + 1) * spec.embeddingSize
    );
    const trace = { embedding: encodeF32(hidden), layers: [] };
    for (let layer = 0; layer < spec.layerCount; layer += 1) {
      const prefix = `model.layers.${layer}`;
      const attentionNormalized = rmsNorm(hidden,
        requireTensor(model, `${prefix}.attention-normalization.weight`, [spec.embeddingSize]),
        spec.normalizationEpsilon);
      const query = applyRope(matrixVector(
        requireTensor(model, `${prefix}.attention.query-projection.weight`,
          [queryWidth, spec.embeddingSize]),
        queryWidth,
        spec.embeddingSize,
        attentionNormalized
      ), spec.headCount, spec.headDimension, position, spec.ropeTheta);
      const key = applyRope(matrixVector(
        requireTensor(model, `${prefix}.attention.key-projection.weight`,
          [kvWidth, spec.embeddingSize]),
        kvWidth,
        spec.embeddingSize,
        attentionNormalized
      ), spec.kvHeadCount, spec.headDimension, position, spec.ropeTheta);
      const value = matrixVector(
        requireTensor(model, `${prefix}.attention.value-projection.weight`,
          [kvWidth, spec.embeddingSize]),
        kvWidth,
        spec.embeddingSize,
        attentionNormalized
      );
      caches[layer].keys.push(...key);
      caches[layer].values.push(...value);
      const attention = groupedQueryAttention(query, caches[layer], spec, position);
      const attentionProjected = matrixVector(
        requireTensor(model, `${prefix}.attention.output-projection.weight`,
          [spec.embeddingSize, queryWidth]),
        spec.embeddingSize,
        queryWidth,
        attention
      );
      const postAttention = residualAdd(hidden, attentionProjected);
      const feedForwardNormalized = rmsNorm(postAttention,
        requireTensor(model, `${prefix}.feed-forward-normalization.weight`,
          [spec.embeddingSize]), spec.normalizationEpsilon);
      const gate = matrixVector(
        requireTensor(model, `${prefix}.feed-forward.gate-projection.weight`,
          [spec.feedForwardSize, spec.embeddingSize]),
        spec.feedForwardSize,
        spec.embeddingSize,
        feedForwardNormalized
      );
      const up = matrixVector(
        requireTensor(model, `${prefix}.feed-forward.up-projection.weight`,
          [spec.feedForwardSize, spec.embeddingSize]),
        spec.feedForwardSize,
        spec.embeddingSize,
        feedForwardNormalized
      );
      const feedForwardActivated = gate.map((valueAtIndex, index) =>
        multiply(silu(valueAtIndex), up[index]));
      const feedForwardProjected = matrixVector(
        requireTensor(model, `${prefix}.feed-forward.down-projection.weight`,
          [spec.embeddingSize, spec.feedForwardSize]),
        spec.embeddingSize,
        spec.feedForwardSize,
        feedForwardActivated
      );
      hidden = residualAdd(postAttention, feedForwardProjected);
      trace.layers.push({
        attention: encodeF32(attention),
        attentionNormalized: encodeF32(attentionNormalized),
        feedForwardActivated: encodeF32(feedForwardActivated),
        feedForwardNormalized: encodeF32(feedForwardNormalized),
        keyAfterRope: encodeF32(key),
        postAttentionResidual: encodeF32(postAttention),
        postFeedForwardResidual: encodeF32(hidden),
        queryAfterRope: encodeF32(query),
        value: encodeF32(value)
      });
    }
    const finalNormalized = rmsNorm(hidden, finalNorm, spec.normalizationEpsilon);
    const logits = matrixVector(embedding, spec.vocabularySize, spec.embeddingSize,
      finalNormalized);
    position += 1;
    return {
      committedKvBytes: position * spec.layerCount * 2 * kvWidth * 4,
      greedyToken: selectGreedy(logits),
      logits: encodeF32(logits),
      positionAfter: position,
      positionBefore: position - 1,
      tokenId,
      trace: { ...trace, finalNormalized: encodeF32(finalNormalized) }
    };
  }

  return {
    forwardToken,
    position: () => position,
    reset
  };
}

function sequenceCase(model, id, inputTokens) {
  const runtime = createReference(model);
  return {
    id,
    inputTokens,
    steps: inputTokens.map((token) => runtime.forwardToken(token))
  };
}

function generationCase(model, id, promptTokens, maximumNewTokens, stopTokens) {
  const runtime = createReference(model);
  let decision;
  for (const token of promptTokens) decision = runtime.forwardToken(token);
  const outputTokens = [];
  for (let index = 0; index < maximumNewTokens; index += 1) {
    invariant(decision !== undefined, "generation requires at least one prompt token");
    const selected = decision.greedyToken;
    outputTokens.push(selected);
    decision = runtime.forwardToken(selected);
    if (stopTokens.includes(selected)) break;
  }
  return {
    finalPosition: runtime.position(),
    id,
    maximumNewTokens,
    outputTokens,
    promptTokens,
    requiredMaximumPosition: promptTokens.length + maximumNewTokens,
    stopTokens
  };
}

function buildRuntimeVectorDocument() {
  const model = loadCanonicalModel();
  const sourceBytes = fs.readFileSync(__filename);
  const firstDecision = sequenceCase(model, "decision-for-stop-case", [1]).steps[0].greedyToken;
  return {
    arithmeticProfile: "explicit-ieee754-f32-rounding-after-each-scalar-operation",
    modelSpec,
    numericalTolerance: {
      absolute: 0.002,
      relative: 0.00002
    },
    oracle: {
      implementation: "tinyrustlm/tools/slm2-runtime-reference.js",
      sourceSha256: sha256(sourceBytes)
    },
    schema: "tinyrustlm.vnext.slm2-runtime-vectors.v1",
    sourceFormatVector: {
      artifactByteLength: model.vector.artifactByteLength,
      artifactSha256: model.vector.artifactSha256,
      formatProfileSha256: model.document.profileSha256,
      id: model.vector.id
    },
    sequences: [
      sequenceCase(model, "single-token-zero-position", [0]),
      sequenceCase(model, "two-token-kv-history", [1, 2]),
      sequenceCase(model, "three-token-maximum-and-repeat", [31, 0, 31])
    ],
    generationCases: [
      generationCase(model, "bounded-three-token-generation", [1], 3, []),
      generationCase(model, "first-generated-token-is-stop", [1], 3, [firstDecision])
    ]
  };
}

function renderRuntimeVectors() {
  return Buffer.from(`${JSON.stringify(buildRuntimeVectorDocument(), null, 2)}\n`, "utf8");
}

function runCli() {
  invariant(process.argv.length === 3 && ["--check", "--write"].includes(process.argv[2]),
    "usage: node slm2-runtime-reference.js --check|--write");
  const rendered = renderRuntimeVectors();
  if (process.argv[2] === "--write") {
    fs.writeFileSync(runtimeVectorPath, rendered, { flag: "w" });
    return;
  }
  invariant(fs.existsSync(runtimeVectorPath), "runtime vector contract is absent");
  invariant(fs.readFileSync(runtimeVectorPath).equals(rendered),
    "runtime vector contract is stale");
}

if (require.main === module) runCli();

module.exports = {
  buildRuntimeVectorDocument,
  formatVectorPath,
  renderRuntimeVectors,
  runtimeVectorPath
};
