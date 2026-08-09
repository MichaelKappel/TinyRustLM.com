"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");
const { canonicalizeVnextJcsBytes } = require("./vnext-jcs.js");
const { finalizeVnextReceipt } = require("./vnext-receipt-identity.js");
const {
  verifyVnextAuthorityGraph
} = require("./vnext-signature-authority.js");
const {
  signatureProfile,
  signatureProfileSha256
} = require("./vnext-signature-payload.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const seedPath = path.join(
  repositoryRoot,
  "contracts/vnext/authority-graph-public-seed.v1.json"
);
const vectorPath = path.join(
  repositoryRoot,
  "contracts/vnext/authority-graph-rust-vectors.v1.json"
);

const inputFields = Object.freeze([
  "campaignId",
  "environment",
  "expectedTerminalRegistryReceiptId",
  "receiptBytesBase64",
  "subjectBytesBase64",
  "trustedRootRegistryReceiptId",
  "verificationTimeUtc"
].sort());

function invariant(condition, message) {
  if (!condition) {
    const error = new Error(message);
    error.code = "authority_rust_vector_generation_failed";
    throw error;
  }
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function canonicalBytes(value) {
  return canonicalizeVnextJcsBytes(value);
}

function decodeCanonical(value) {
  invariant(typeof value === "string", "vector byte value must be a string");
  const bytes = Buffer.from(value, "base64");
  invariant(bytes.toString("base64") === value, "vector byte value is not canonical base64");
  return bytes;
}

function exactInput(entry) {
  invariant(entry !== null && typeof entry === "object" && !Array.isArray(entry),
    "authority seed entry must be an object");
  const names = Object.keys(entry).filter((name) =>
    name !== "name" && name !== "expectedErrorCode").sort();
  invariant(names.length === inputFields.length &&
    names.every((name, index) => name === inputFields[index]),
  "authority seed input fields changed");
  invariant(Array.isArray(entry.receiptBytesBase64) &&
    Array.isArray(entry.subjectBytesBase64), "authority seed byte arrays changed");
  return {
    campaignId: entry.campaignId,
    environment: entry.environment,
    verificationTimeUtc: entry.verificationTimeUtc,
    trustedRootRegistryReceiptId: entry.trustedRootRegistryReceiptId,
    expectedTerminalRegistryReceiptId: entry.expectedTerminalRegistryReceiptId,
    receiptBytes: entry.receiptBytesBase64.map(decodeCanonical),
    subjectBytes: entry.subjectBytesBase64.map(decodeCanonical)
  };
}

function encodeInput(input) {
  return {
    campaignId: input.campaignId,
    environment: input.environment,
    verificationTimeUtc: input.verificationTimeUtc,
    trustedRootRegistryReceiptId: input.trustedRootRegistryReceiptId,
    expectedTerminalRegistryReceiptId: input.expectedTerminalRegistryReceiptId,
    receiptBytesBase64: input.receiptBytes.map((bytes) => bytes.toString("base64")),
    subjectBytesBase64: input.subjectBytes.map((bytes) => bytes.toString("base64"))
  };
}

function copyInput(input, overrides = {}) {
  return {
    campaignId: input.campaignId,
    environment: input.environment,
    verificationTimeUtc: input.verificationTimeUtc,
    trustedRootRegistryReceiptId: input.trustedRootRegistryReceiptId,
    expectedTerminalRegistryReceiptId: input.expectedTerminalRegistryReceiptId,
    receiptBytes: input.receiptBytes.map((bytes) => Buffer.from(bytes)),
    subjectBytes: input.subjectBytes.map((bytes) => Buffer.from(bytes)),
    ...overrides
  };
}

function parseReceipt(bytes) {
  return parseStrictJson(bytes);
}

function receiptType(bytes) {
  return parseReceipt(bytes).receiptType;
}

function signatureScope(bytes) {
  const receipt = parseReceipt(bytes);
  return receipt.receiptType === "signature-envelope"
    ? receipt.signatureEnvelope.scope
    : null;
}

function mutateReceipt(bytes, mutate) {
  const draft = parseReceipt(bytes);
  delete draft.receiptId;
  delete draft.canonicalContentSha256;
  mutate(draft);
  return finalizeVnextReceipt(draft).bytes;
}

function acceptedCase(name, input) {
  const result = verifyVnextAuthorityGraph(input);
  const resultBytes = canonicalBytes(result);
  return {
    name,
    ...encodeInput(input),
    resultBytesBase64: resultBytes.toString("base64"),
    resultSha256: sha256(resultBytes)
  };
}

function rejectionCase(name, input, expectedErrorCode = null) {
  let actualErrorCode = null;
  try {
    verifyVnextAuthorityGraph(input);
  } catch (error) {
    actualErrorCode = error?.code ?? null;
  }
  invariant(typeof actualErrorCode === "string", `${name} did not reject`);
  invariant(expectedErrorCode === null || expectedErrorCode === actualErrorCode,
    `${name} rejection changed from ${expectedErrorCode} to ${actualErrorCode}`);
  return {
    name,
    ...encodeInput(input),
    expectedErrorCode: actualErrorCode
  };
}

function seedCorpus() {
  const bytes = fs.readFileSync(seedPath);
  const corpus = parseStrictJson(bytes);
  invariant(corpus.schema === "tinyrustlm.vnext.authority_graph_public_seed.v1",
    "authority public seed schema changed");
  invariant(corpus.profileId === signatureProfile.profileId,
    "authority public seed profile changed");
  invariant(corpus.profileSha256 === signatureProfileSha256,
    "authority public seed profile hash changed");
  invariant(Array.isArray(corpus.acceptedCases) && corpus.acceptedCases.length === 7,
    "authority public accepted seed count changed");
  invariant(Array.isArray(corpus.rejectionCases) && corpus.rejectionCases.length === 6,
    "authority public rejection seed count changed");
  return { bytes, corpus };
}

function namedCases(cases) {
  return new Map(cases.map((entry) => [entry.name, exactInput(entry)]));
}

function buildAcceptedCases(acceptedSeeds) {
  const accepted = [...acceptedSeeds].map(([name, input]) =>
    acceptedCase(name, input));
  const revoked = acceptedSeeds.get("revoked-after-issue");
  accepted.push(acceptedCase("revoked-transport-order-reversed", copyInput(revoked, {
    receiptBytes: [...revoked.receiptBytes].reverse(),
    subjectBytes: [...revoked.subjectBytes].reverse()
  })));
  const successor = acceptedSeeds.get("successor-current");
  accepted.push(acceptedCase("terminal-registry-stale", copyInput(successor, {
    verificationTimeUtc: "2028-08-01T00:00:00Z"
  })));
  return accepted.sort((left, right) => left.name.localeCompare(right.name));
}

function buildDerivedRejections(acceptedSeeds) {
  const root = acceptedSeeds.get("root-current");
  const successor = acceptedSeeds.get("successor-current");
  const revoked = acceptedSeeds.get("revoked-after-issue");
  const absent = `sha256:${"f".repeat(64)}`;
  const rootRegistry = root.receiptBytes.find((bytes) =>
    receiptType(bytes) === "authority-registry");
  const rootSignature = root.receiptBytes.find((bytes) =>
    receiptType(bytes) === "signature-envelope");
  const successorRegistry = successor.receiptBytes.find((bytes) => {
    const receipt = parseReceipt(bytes);
    return receipt.receiptType === "authority-registry" &&
      receipt.authorityRegistry.previousRegistryReceiptId !== null;
  });
  const successorRootRegistry = successor.receiptBytes.find((bytes) => {
    const receipt = parseReceipt(bytes);
    return receipt.receiptType === "authority-registry" &&
      receipt.authorityRegistry.previousRegistryReceiptId === null;
  });

  const missingGovernance = successor.receiptBytes.filter((bytes) =>
    signatureScope(bytes) !== "authority-registry");
  const missingRevocation = revoked.receiptBytes.filter((bytes) =>
    receiptType(bytes) !== "key-revocation" &&
    signatureScope(bytes) !== "key-revocation");
  const missingRevocationSignature = revoked.receiptBytes.filter((bytes) =>
    signatureScope(bytes) !== "key-revocation");

  const registryInputMissing = mutateReceipt(rootSignature, (draft) => {
    draft.inputReceiptIds = [];
  });
  const outsideBindingInvalid = mutateReceipt(rootSignature, (draft) => {
    draft.signatureEnvelope.nonceHash = "f".repeat(64);
  });
  const issueOutsideReceipt = mutateReceipt(rootSignature, (draft) => {
    draft.startedAtUtc = "2026-08-09T00:00:02Z";
    draft.completedAtUtc = "2026-08-09T00:00:02Z";
  });

  const successorGovernanceIndex = successor.receiptBytes.findIndex((bytes) =>
    signatureScope(bytes) === "authority-registry");
  const signerMismatch = mutateReceipt(
    successor.receiptBytes[successorGovernanceIndex],
    (draft) => {
      draft.signatureEnvelope.signerId = "release-authorizer-999";
    }
  );
  const signerMismatchReceipts = successor.receiptBytes.map((bytes, index) =>
    index === successorGovernanceIndex ? signerMismatch : bytes);

  const fork = mutateReceipt(successorRegistry, (draft) => {
    draft.attemptId = "registry-fork-vector";
    draft.startedAtUtc = "2026-08-11T00:00:00Z";
    draft.completedAtUtc = "2026-08-11T00:00:00Z";
    draft.authorityRegistry.effectiveAtUtc = "2026-08-11T00:00:00Z";
  });
  const rollback = mutateReceipt(successorRegistry, (draft) => {
    draft.attemptId = "registry-rollback-vector";
    draft.startedAtUtc = "2026-08-01T00:00:00Z";
    draft.completedAtUtc = "2026-08-01T00:00:00Z";
    draft.authorityRegistry.effectiveAtUtc = "2026-08-01T00:00:00Z";
  });
  const gap = mutateReceipt(successorRegistry, (draft) => {
    draft.attemptId = "registry-gap-vector";
    draft.startedAtUtc = "2027-08-02T00:00:00Z";
    draft.completedAtUtc = "2027-08-02T00:00:00Z";
    draft.authorityRegistry.effectiveAtUtc = "2027-08-02T00:00:00Z";
    draft.authorityRegistry.expiresAtUtc = "2028-07-31T00:00:00Z";
  });
  const rollbackId = parseReceipt(rollback).receiptId;
  const gapId = parseReceipt(gap).receiptId;

  return [
    rejectionCase("authority-registry-count-empty", copyInput(root, {
      receiptBytes: []
    })),
    rejectionCase("authority-receipt-duplicate", copyInput(root, {
      receiptBytes: [...root.receiptBytes, rootRegistry]
    })),
    rejectionCase("signature-subject-missing", copyInput(root, {
      subjectBytes: []
    })),
    rejectionCase("trusted-root-missing", copyInput(root, {
      trustedRootRegistryReceiptId: absent
    })),
    rejectionCase("terminal-registry-missing", copyInput(root, {
      expectedTerminalRegistryReceiptId: absent
    })),
    rejectionCase("authority-campaign-mismatch", copyInput(root, {
      campaignId: "campaign-vnext-002"
    })),
    rejectionCase("authority-environment-mismatch", copyInput(root, {
      environment: "staging"
    })),
    rejectionCase("authority-verification-time-invalid", copyInput(root, {
      verificationTimeUtc: "2026-02-29T00:00:00Z"
    })),
    rejectionCase("registry-successor-signature-missing", copyInput(successor, {
      receiptBytes: missingGovernance
    })),
    rejectionCase("authority-registry-unlinked", copyInput(successor, {
      expectedTerminalRegistryReceiptId: successor.trustedRootRegistryReceiptId
    })),
    rejectionCase("trusted-root-not-root", copyInput(successor, {
      trustedRootRegistryReceiptId: successor.expectedTerminalRegistryReceiptId
    })),
    rejectionCase("registry-revocation-receipt-missing", copyInput(revoked, {
      receiptBytes: missingRevocation
    })),
    rejectionCase("revocation-signature-missing", copyInput(revoked, {
      receiptBytes: missingRevocationSignature
    })),
    rejectionCase("signature-registry-input-missing", copyInput(root, {
      receiptBytes: [rootRegistry, registryInputMissing]
    })),
    rejectionCase("outside-proof-binding-invalid", copyInput(root, {
      receiptBytes: [rootRegistry, outsideBindingInvalid]
    })),
    rejectionCase("signature-issue-outside-receipt-time", copyInput(root, {
      receiptBytes: [rootRegistry, issueOutsideReceipt]
    })),
    rejectionCase("signature-key-signer-mismatch", copyInput(successor, {
      receiptBytes: signerMismatchReceipts
    })),
    rejectionCase("authority-registry-fork", copyInput(successor, {
      receiptBytes: [...successor.receiptBytes, fork]
    })),
    rejectionCase("authority-registry-rollback", copyInput(successor, {
      expectedTerminalRegistryReceiptId: rollbackId,
      receiptBytes: [successorRootRegistry, rollback]
    })),
    rejectionCase("authority-registry-gap", copyInput(successor, {
      expectedTerminalRegistryReceiptId: gapId,
      receiptBytes: [successorRootRegistry, gap]
    }))
  ];
}

function renderVectorCorpus() {
  const seed = seedCorpus();
  const acceptedSeeds = namedCases(seed.corpus.acceptedCases);
  const seededRejections = seed.corpus.rejectionCases.map((entry) =>
    rejectionCase(entry.name, exactInput(entry), entry.expectedErrorCode));
  const corpus = {
    schema: "tinyrustlm.vnext.authority_graph_rust_vectors.v1",
    profileId: signatureProfile.profileId,
    profileSha256: signatureProfileSha256,
    publicSeedSha256: sha256(seed.bytes),
    acceptedCases: buildAcceptedCases(acceptedSeeds),
    rejectionCases: [...seededRejections, ...buildDerivedRejections(acceptedSeeds)]
      .sort((left, right) => left.name.localeCompare(right.name))
  };
  return Buffer.from(`${JSON.stringify(corpus, null, 2)}\n`, "utf8");
}

function writeVectorCorpus() {
  const bytes = renderVectorCorpus();
  fs.writeFileSync(vectorPath, bytes);
  return Object.freeze({ bytes: Buffer.from(bytes), vectorPath });
}

function main(argumentsList) {
  invariant(argumentsList.length === 1 && argumentsList[0] === "--write",
    "usage: node vnext-authority-rust-vectors.js --write");
  writeVectorCorpus();
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Authority Rust vector generation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  renderVectorCorpus,
  seedPath,
  vectorPath,
  writeVectorCorpus
});
