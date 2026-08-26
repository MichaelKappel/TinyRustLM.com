"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const custodyOwner = require("./build-custody-owner.js");

const intentSchema = "tinyrustlm.build-custody-request-materialization-intent.v1";
const summarySchema = "tinyrustlm.build-custody-request-materialization-summary.v1";
const errorSchema = "tinyrustlm.build-custody-request-materialization-error.v1";
const profileId = "tinyrustlm.build-custody-request-materializer/1";
const profilePath = path.resolve(__dirname, "..", "..", "contracts", "vnext",
  "build-custody-request-materializer-profile.v1.json");
const profileByteLength = 6327;
const profileSha256 = "450e1300eb80fe15bcb058713a16fd517a7f4206a4ef420995ac0ea4f4cae041";
const maximumIntentBytes = 262144;
const maximumRequestBytes = 262144;
const maximumErrorCodeBytes = 160;

function invariant(condition, code) {
  if (!condition) throw new Error(code);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

function requireExactKeys(value, keys, code) {
  invariant(isPlainObject(value), code);
  const actual = Object.keys(value);
  invariant(actual.length === keys.length &&
    actual.every((entry, index) => entry === keys[index]), code);
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function requireCanonicalAbsolutePath(value, code) {
  invariant(typeof value === "string" && value.length > 0 &&
    !value.includes("\u0000") && path.isAbsolute(value) && path.resolve(value) === value,
  code);
  return value;
}

function readCanonicalJson(filePath, maximumBytes, code) {
  const resolved = requireCanonicalAbsolutePath(filePath, `${code}-path`);
  const entry = fs.lstatSync(resolved);
  invariant(entry.isFile() && !entry.isSymbolicLink() && entry.size > 0 &&
    entry.size <= maximumBytes, code);
  const bytes = fs.readFileSync(resolved);
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error(code);
  }
  invariant(isPlainObject(value) && bytes.equals(Buffer.from(canonicalJson(value), "utf8")),
    code);
  return Object.freeze({
    artifact: Object.freeze({ byteLength: bytes.length, sha256: sha256(bytes) }),
    bytes,
    value
  });
}

function copyArtifact(value, code) {
  requireExactKeys(value, ["path", "byteLength", "sha256"], code);
  return Object.freeze({
    path: value.path,
    byteLength: value.byteLength,
    sha256: value.sha256
  });
}

function copyProfileReference(value, code) {
  requireExactKeys(value, ["path", "byteLength", "sha256", "profileId"], code);
  return Object.freeze({
    path: value.path,
    byteLength: value.byteLength,
    sha256: value.sha256,
    profileId: value.profileId
  });
}

function copySource(value) {
  requireExactKeys(value, ["repositoryRoot", "commit", "tree", "branch", "git",
    "owner"], "request-materializer-intent-source-fields");
  const git = copyArtifact(value.git, "request-materializer-intent-source-git-fields");
  const owner = copyArtifact(value.owner,
    "request-materializer-intent-source-owner-fields");
  return Object.freeze({
    repositoryRoot: value.repositoryRoot,
    commit: value.commit,
    tree: value.tree,
    branch: value.branch,
    gitPath: git.path,
    gitByteLength: git.byteLength,
    gitSha256: git.sha256,
    ownerPath: owner.path,
    ownerByteLength: owner.byteLength,
    ownerSha256: owner.sha256
  });
}

function copyRuntime(value) {
  requireExactKeys(value, ["node", "nodeVersion", "platform", "architecture"],
    "request-materializer-intent-runtime-fields");
  const node = copyArtifact(value.node, "request-materializer-intent-runtime-node-fields");
  return Object.freeze({
    nodePath: node.path,
    nodeByteLength: node.byteLength,
    nodeSha256: node.sha256,
    nodeVersion: value.nodeVersion,
    platform: value.platform,
    architecture: value.architecture
  });
}

function copyEnvironmentAuthority(value) {
  requireExactKeys(value, ["owner", "profile", "request", "privateBinding",
    "publicLock", "terminal"], "request-materializer-intent-environment-fields");
  return Object.freeze({
    owner: copyArtifact(value.owner,
      "request-materializer-intent-environment-owner-fields"),
    profile: copyProfileReference(value.profile,
      "request-materializer-intent-environment-profile-fields"),
    request: copyArtifact(value.request,
      "request-materializer-intent-environment-request-fields"),
    privateBinding: copyArtifact(value.privateBinding,
      "request-materializer-intent-environment-private-binding-fields"),
    publicLock: copyArtifact(value.publicLock,
      "request-materializer-intent-environment-public-lock-fields"),
    terminal: copyArtifact(value.terminal,
      "request-materializer-intent-environment-terminal-fields")
  });
}

function copyScratchInspection(value) {
  requireExactKeys(value, ["profile", "executableRelativePath", "operationId",
    "maximumDurationMilliseconds", "maximumStdoutBytes"],
  "request-materializer-intent-scratch-fields");
  return Object.freeze({
    profile: copyProfileReference(value.profile,
      "request-materializer-intent-scratch-profile-fields"),
    executableRelativePath: value.executableRelativePath,
    operationId: value.operationId,
    maximumDurationMilliseconds: value.maximumDurationMilliseconds,
    maximumStdoutBytes: value.maximumStdoutBytes
  });
}

function copyStringArray(value, code) {
  invariant(Array.isArray(value), code);
  return Object.freeze(value.map((entry) => {
    invariant(typeof entry === "string", code);
    return entry;
  }));
}

function copyEnvironmentEntries(value) {
  invariant(Array.isArray(value), "request-materializer-intent-command-environment");
  return Object.freeze(value.map((entry) => {
    requireExactKeys(entry, ["name", "value"],
      "request-materializer-intent-command-environment-entry-fields");
    return Object.freeze({ name: entry.name, value: entry.value });
  }));
}

function copyCommand(value) {
  requireExactKeys(value, ["executable", "arguments", "workingDirectory",
    "supplementalEnvironment"], "request-materializer-intent-command-fields");
  const executable = copyArtifact(value.executable,
    "request-materializer-intent-command-executable-fields");
  return Object.freeze({
    executablePath: executable.path,
    executableByteLength: executable.byteLength,
    executableSha256: executable.sha256,
    arguments: copyStringArray(value.arguments,
      "request-materializer-intent-command-arguments"),
    workingDirectory: value.workingDirectory,
    supplementalEnvironment: copyEnvironmentEntries(value.supplementalEnvironment)
  });
}

function copyRoots(value) {
  requireExactKeys(value, ["controlRoot", "targetRoot", "environmentRoot"],
    "request-materializer-intent-root-fields");
  return Object.freeze({
    controlRoot: value.controlRoot,
    targetRoot: value.targetRoot,
    environmentRoot: value.environmentRoot
  });
}

function copyCapture(value) {
  requireExactKeys(value, ["maximumDurationMilliseconds", "maximumStdoutBytes",
    "maximumStderrBytes"], "request-materializer-intent-capture-fields");
  return Object.freeze({
    maximumDurationMilliseconds: value.maximumDurationMilliseconds,
    maximumStdoutBytes: value.maximumStdoutBytes,
    maximumStderrBytes: value.maximumStderrBytes
  });
}

function copyTermination(value) {
  requireExactKeys(value, ["strategy", "executable"],
    "request-materializer-intent-termination-fields");
  const executable = copyArtifact(value.executable,
    "request-materializer-intent-termination-executable-fields");
  return Object.freeze({
    strategy: value.strategy,
    executablePath: executable.path,
    executableByteLength: executable.byteLength,
    executableSha256: executable.sha256
  });
}

function copyRequiredOutputs(value) {
  invariant(Array.isArray(value), "request-materializer-intent-required-outputs");
  return Object.freeze(value.map((entry) => {
    requireExactKeys(entry, ["relativePath", "maximumByteLength", "kind"],
      "request-materializer-intent-required-output-fields");
    return Object.freeze({
      relativePath: entry.relativePath,
      maximumByteLength: entry.maximumByteLength,
      kind: entry.kind
    });
  }));
}

function copyOutputs(value) {
  requireExactKeys(value, ["maximumEntryCount", "maximumAggregateBytes",
    "maximumEnvironmentEntryCount", "maximumEnvironmentAggregateBytes",
    "maximumEnvironmentJunctionCount", "required"],
  "request-materializer-intent-output-fields");
  return Object.freeze({
    maximumEntryCount: value.maximumEntryCount,
    maximumAggregateBytes: value.maximumAggregateBytes,
    maximumEnvironmentEntryCount: value.maximumEnvironmentEntryCount,
    maximumEnvironmentAggregateBytes: value.maximumEnvironmentAggregateBytes,
    maximumEnvironmentJunctionCount: value.maximumEnvironmentJunctionCount,
    required: copyRequiredOutputs(value.required)
  });
}

function validateProfile() {
  const document = readCanonicalJson(profilePath, maximumIntentBytes,
    "request-materializer-profile-json");
  invariant(document.artifact.byteLength === profileByteLength &&
    document.artifact.sha256 === profileSha256,
  "request-materializer-profile-identity");
  requireExactKeys(document.value, ["schema", "profileId", "status", "authority",
    "schemas", "limits", "canonicalEncoding", "intentFieldOrder", "sourceIntent",
    "runtimeIntent", "copiedClosedObjects", "materialization", "failurePolicy",
    "regressions", "claimBoundary"], "request-materializer-profile-fields");
  invariant(document.value.schema ===
    "tinyrustlm.build-custody-request-materializer-profile.v1" &&
    document.value.profileId === profileId &&
    document.value.status === "current-prelaunch-only" &&
    document.value.schemas.intent === intentSchema &&
    document.value.schemas.request === custodyOwner.requestSchema &&
    document.value.limits.maximumIntentBytes === maximumIntentBytes &&
    document.value.limits.maximumRequestBytes === maximumRequestBytes &&
    document.value.materialization.pureNamedMappingBeforeWrite === true &&
    document.value.materialization.inputObjectSpreads === false &&
    document.value.materialization.outputObjectSpreads === false &&
    document.value.materialization.recursiveStringReplacement === false &&
    document.value.materialization.writeMode === "create-only" &&
    document.value.failurePolicy.automaticRetry === false &&
    document.value.claimBoundary.custodyPreflightPassed === false,
  "request-materializer-profile-contract");
  return document;
}

function buildRequest(intent) {
  requireExactKeys(intent, ["schema", "operationId", "profile", "source", "runtime",
    "environmentAuthority", "scratchInspection", "command", "roots", "capture",
    "termination", "outputs"], "request-materializer-intent-fields");
  invariant(intent.schema === intentSchema, "request-materializer-intent-schema");
  const request = Object.freeze({
    schema: custodyOwner.requestSchema,
    operationId: intent.operationId,
    profile: copyProfileReference(intent.profile,
      "request-materializer-intent-profile-fields"),
    source: copySource(intent.source),
    runtime: copyRuntime(intent.runtime),
    environmentAuthority: copyEnvironmentAuthority(intent.environmentAuthority),
    scratchInspection: copyScratchInspection(intent.scratchInspection),
    command: copyCommand(intent.command),
    roots: copyRoots(intent.roots),
    capture: copyCapture(intent.capture),
    termination: copyTermination(intent.termination),
    outputs: copyOutputs(intent.outputs)
  });
  custodyOwner.validateRequestShape(request);
  return request;
}

function inspectOutputParent(outputPath) {
  const resolved = requireCanonicalAbsolutePath(outputPath,
    "request-materializer-output-path");
  const parent = path.dirname(resolved);
  const parentEntry = fs.lstatSync(parent);
  invariant(parentEntry.isDirectory() && !parentEntry.isSymbolicLink(),
    "request-materializer-output-parent");
  invariant(!fs.existsSync(resolved), "request-materializer-output-exists");
  return resolved;
}

function materialize(intentPath, outputPath) {
  const profile = validateProfile();
  const intentDocument = readCanonicalJson(requireCanonicalAbsolutePath(intentPath,
    "request-materializer-intent-path"), maximumIntentBytes,
  "request-materializer-intent-json");
  const request = buildRequest(intentDocument.value);
  const requestBytes = Buffer.from(canonicalJson(request), "utf8");
  invariant(requestBytes.length > 0 && requestBytes.length <= maximumRequestBytes,
    "request-materializer-request-size");
  const resolvedOutput = inspectOutputParent(outputPath);
  const requestArtifact = custodyOwner.writeNewDurable(resolvedOutput, requestBytes,
    maximumRequestBytes);
  return Object.freeze({
    schema: summarySchema,
    operationId: request.operationId,
    status: "pass",
    code: "build-custody-request-materialized",
    profile: Object.freeze({
      profileId,
      byteLength: profile.artifact.byteLength,
      sha256: profile.artifact.sha256
    }),
    intent: intentDocument.artifact,
    request: requestArtifact,
    outputBasename: path.basename(resolvedOutput),
    outputCreated: true,
    outputPrivatePathPublished: false,
    custodyPreflightPassed: false,
    custodyExecuted: false,
    retryAllowed: false,
    campaignCreditAuthorized: false
  });
}

function safeErrorCode(error) {
  const value = error instanceof Error && typeof error.message === "string"
    ? error.message
    : "request-materializer-unknown";
  if (Buffer.byteLength(value, "utf8") > maximumErrorCodeBytes ||
      !/^[a-z0-9-]+$/u.test(value)) return "request-materializer-failure";
  return value;
}

function main(argv) {
  invariant(argv.length === 3 && argv[0] === "materialize",
    "request-materializer-arguments");
  const summary = materialize(path.resolve(argv[1]), path.resolve(argv[2]));
  process.stdout.write(canonicalJson(summary));
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(canonicalJson({
      schema: errorSchema,
      status: "error",
      code: safeErrorCode(error),
      retryAllowed: false,
      campaignCreditAuthorized: false
    }));
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  buildRequest,
  canonicalJson,
  errorSchema,
  intentSchema,
  materialize,
  maximumIntentBytes,
  maximumRequestBytes,
  profileByteLength,
  profileId,
  profilePath,
  profileSha256,
  safeErrorCode,
  summarySchema,
  validateProfile
});
