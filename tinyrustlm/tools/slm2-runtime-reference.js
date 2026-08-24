"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const q8WeightVectorPath = path.join(
  repositoryRoot,
  "contracts/vnext/slm2-q8-weight-vectors.v1.json"
);
const runtimeVectorPath = path.join(
  repositoryRoot,
  "contracts/vnext/slm2-runtime-q8-vectors.v1.json"
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
  qkNormalization: true,
  qkvBias: true,
  ropeThetaBits: "461c4000",
  tiedEmbeddings: false,
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
  const document = parseStrictJson(fs.readFileSync(q8WeightVectorPath));
  invariant(document.schema === "tinyrustlm.slm2-q8-weight-vectors.v1",
    "unexpected Q8 weight-vector schema");
  const vector = document.canonical;
  invariant(vector !== null && typeof vector === "object" && !Array.isArray(vector),
    "canonical Q8 weight vector is absent");
  const artifact = Buffer.from(vector.artifactHex, "hex");
  invariant(artifact.length === vector.artifactByteLength,
    "canonical artifact byte length drifted");
  invariant(sha256(artifact) === vector.artifactSha256,
    "canonical artifact identity drifted");

  const tensors = new Map();
  for (const metadata of vector.tensors) {
    invariant(!tensors.has(tensorKey(metadata.canonicalName)),
      "duplicate canonical tensor name");
    const logicalElements = product(metadata.shape);
    if (metadata.elementType === 1) {
      invariant(metadata.payloadLength === logicalElements * 4,
        "F32 tensor payload length does not match its shape");
    } else {
      invariant(metadata.elementType === 2 && metadata.shape.length === 2
        && metadata.payloadLength === metadata.shape[0] * (metadata.shape[1] + 4),
      "Q8 tensor payload length does not match its shape");
    }
    const start = vector.header.payloadOffset + metadata.payloadRelativeOffset;
    const end = start + metadata.payloadLength;
    invariant(start >= vector.header.payloadOffset && end <= artifact.length,
      "tensor payload lies outside the artifact");
    tensors.set(tensorKey(metadata.canonicalName), {
      bytes: Buffer.from(artifact.subarray(start, end)),
      elementType: metadata.elementType,
      shape: [...metadata.shape],
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
  return tensor;
}

function tensorElement(tensor, index) {
  const logicalElements = product(tensor.shape);
  invariant(Number.isInteger(index) && index >= 0 && index < logicalElements,
    "tensor element lies outside its shape");
  if (tensor.elementType === 1) {
    return finite(tensor.bytes.readFloatLE(index * 4));
  }
  invariant(tensor.elementType === 2 && tensor.shape.length === 2,
    "matrix tensor has an unsupported encoding");
  const columns = tensor.shape[1];
  const row = Math.floor(index / columns);
  const column = index % columns;
  const rowOffset = row * (columns + 4);
  const scale = finite(tensor.bytes.readFloatLE(rowOffset));
  const code = tensor.bytes.readInt8(rowOffset + 4 + column);
  invariant(scale > 0 && code !== -128, "Q8 tensor payload is invalid");
  return multiply(scale, code);
}

function matrixVector(tensor, rows, columns, input) {
  invariant(tensor.shape.length === 2 && tensor.shape[0] === rows
    && tensor.shape[1] === columns && input.length === columns,
    "matrix-vector shape mismatch");
  const output = new Array(rows);
  for (let row = 0; row < rows; row += 1) {
    let sum = 0;
    for (let column = 0; column < columns; column += 1) {
      sum = add(sum, multiply(tensorElement(tensor, row * columns + column), input[column]));
    }
    output[row] = sum;
  }
  return output;
}

function rmsNorm(input, weights, epsilon) {
  invariant(input.length > 0 && weights.shape.length === 1
    && weights.shape[0] === input.length,
    "RMS normalization shape mismatch");
  let sum = 0;
  for (const value of input) sum = add(sum, multiply(value, value));
  const mean = divide(sum, input.length);
  const scale = divide(1, finite(Math.sqrt(add(mean, epsilon))));
  return input.map((value, index) =>
    multiply(multiply(value, scale), tensorElement(weights, index)));
}

function addTensorVector(values, tensor) {
  invariant(tensor.shape.length === 1 && tensor.shape[0] === values.length,
    "bias shape mismatch");
  return values.map((value, index) => add(value, tensorElement(tensor, index)));
}

function normalizeHeads(values, weights, headCount, headDimension, epsilon) {
  invariant(values.length === headCount * headDimension
    && weights.shape.length === 1 && weights.shape[0] === headDimension,
  "head normalization shape mismatch");
  const output = [...values];
  for (let head = 0; head < headCount; head += 1) {
    const start = head * headDimension;
    let sum = finite(0);
    for (let offset = 0; offset < headDimension; offset += 1) {
      const value = values[start + offset];
      sum = add(sum, multiply(value, value));
    }
    const scale = divide(1, finite(Math.sqrt(add(divide(sum, headDimension), epsilon))));
    for (let offset = 0; offset < headDimension; offset += 1) {
      output[start + offset] = multiply(
        multiply(values[start + offset], scale),
        tensorElement(weights, offset)
      );
    }
  }
  return output;
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
  const outputProjection = requireTensor(model, "model.output-projection.weight",
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
    let hidden = Array.from({ length: spec.embeddingSize }, (_, column) =>
      tensorElement(embedding, tokenId * spec.embeddingSize + column));
    const trace = { embedding: encodeF32(hidden), layers: [] };
    for (let layer = 0; layer < spec.layerCount; layer += 1) {
      const prefix = `model.layers.${layer}`;
      const attentionNormalized = rmsNorm(hidden,
        requireTensor(model, `${prefix}.attention-normalization.weight`, [spec.embeddingSize]),
        spec.normalizationEpsilon);
      let query = matrixVector(
        requireTensor(model, `${prefix}.attention.query-projection.weight`,
          [queryWidth, spec.embeddingSize]),
        queryWidth,
        spec.embeddingSize,
        attentionNormalized
      );
      let key = matrixVector(
        requireTensor(model, `${prefix}.attention.key-projection.weight`,
          [kvWidth, spec.embeddingSize]),
        kvWidth,
        spec.embeddingSize,
        attentionNormalized
      );
      let value = matrixVector(
        requireTensor(model, `${prefix}.attention.value-projection.weight`,
          [kvWidth, spec.embeddingSize]),
        kvWidth,
        spec.embeddingSize,
        attentionNormalized
      );
      query = addTensorVector(query,
        requireTensor(model, `${prefix}.attention.query-projection.bias`, [queryWidth]));
      key = addTensorVector(key,
        requireTensor(model, `${prefix}.attention.key-projection.bias`, [kvWidth]));
      value = addTensorVector(value,
        requireTensor(model, `${prefix}.attention.value-projection.bias`, [kvWidth]));
      query = normalizeHeads(query,
        requireTensor(model, `${prefix}.attention.query-normalization.weight`,
          [spec.headDimension]),
        spec.headCount, spec.headDimension, spec.normalizationEpsilon);
      key = normalizeHeads(key,
        requireTensor(model, `${prefix}.attention.key-normalization.weight`,
          [spec.headDimension]),
        spec.kvHeadCount, spec.headDimension, spec.normalizationEpsilon);
      query = applyRope(query, spec.headCount, spec.headDimension, position, spec.ropeTheta);
      key = applyRope(key, spec.kvHeadCount, spec.headDimension, position, spec.ropeTheta);
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
    const logits = matrixVector(outputProjection, spec.vocabularySize, spec.embeddingSize,
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
    arithmeticProfile: "tinyrustlm.runtime-q8-scalar-f32-ordered/1",
    modelSpec,
    numericalTolerance: {
      absolute: 0.002,
      relative: 0.00002
    },
    oracle: {
      implementation: "tinyrustlm/tools/slm2-runtime-reference.js",
      sourceSha256: sha256(sourceBytes)
    },
    schema: "tinyrustlm.slm2-runtime-q8-vectors.v1",
    sourceQ8WeightVector: {
      artifactByteLength: model.vector.artifactByteLength,
      artifactSha256: model.vector.artifactSha256,
      formatProfileSha256: model.document.formatProfile.sha256,
      id: model.vector.id,
      weightProfileSha256: model.document.weightProfile.sha256
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
  q8WeightVectorPath,
  renderRuntimeVectors,
  runtimeVectorPath
};
