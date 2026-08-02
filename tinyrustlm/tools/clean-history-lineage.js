"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const schema = "tinyrustlm.clean_history_lineage_witness.v1";
const repositoryRoot = path.resolve(__dirname, "../..");
const defaultWitnessPath = path.join(
  repositoryRoot,
  "tinyrustlm/history/clean-history-lineage/witness.v1.json"
);
const defaultSecretScanAdjudicationPath = path.join(
  repositoryRoot,
  "tinyrustlm/history/clean-history-lineage/secret-scan-adjudication.v1.json"
);
const productionWitnessSha256 =
  "e630c7c30e91493033fa12acc6522d0ba50930c0253a19334184130c12fcb0b8";
const productionSecretScanAdjudicationSha256 =
  "2c504078a08e68246781c232980f1d800afb69ea7afc58b1d709d843176c8d0a";
const absoluteMaximumWitnessBytes = 16 * 1024 * 1024;
const absoluteMaximumAdjudicationBytes = 64 * 1024;
const absoluteMaximumBlobBytes = 16 * 1024 * 1024;
const absoluteMaximumSourceFileBytes = 64 * 1024 * 1024;
const absoluteMaximumBlobCount = 1024;
const revisionPattern = /^[a-f0-9]{40}$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const relativePathPattern =
  /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u;
const forbiddenHistoricalPathPattern =
  /(?:^|\/)(?:\.env(?:\.|$)|[^/]*(?:credential|password|private[-_]?key|secret|token)[^/]*)|\.(?:7z|bin|ckpt|gguf|gz|onnx|p12|pem|pfx|pt|pth|rar|safetensors|slm|tar|tgz|zip)$/iu;
const utcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function isPlainObject(value) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value, expected, label) {
  invariant(isPlainObject(value), `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  invariant(
    actual.length === sortedExpected.length &&
      actual.every((key, index) => key === sortedExpected[index]),
    `${label} fields are invalid`
  );
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function canonicalWitnessBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function validateUtc(value) {
  invariant(utcPattern.test(value), "witness observation time is invalid");
  const milliseconds = Date.parse(value);
  invariant(
    Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value,
    "witness observation time is invalid"
  );
}

function validateRevision(value, label) {
  invariant(revisionPattern.test(value), `${label} is invalid`);
}

function validateSha256(value, label) {
  invariant(sha256Pattern.test(value), `${label} is invalid`);
}

function validateHistoricalPath(value) {
  invariant(relativePathPattern.test(value), "historical path is unsafe");
  invariant(
    !forbiddenHistoricalPathPattern.test(value),
    "historical path is forbidden"
  );
}

function canonicalPathSet(paths) {
  invariant(Array.isArray(paths) && paths.length > 0, "historical paths are invalid");
  const normalized = paths.map((value) => {
    validateHistoricalPath(value);
    return value;
  }).sort();
  invariant(
    new Set(normalized).size === normalized.length,
    "historical paths contain duplicates"
  );
  return Object.freeze(normalized);
}

function pairKey(left, right) {
  return `${left}\u0000${right}`;
}

function pathSetKey(atRevision, paths) {
  return `${atRevision}\u0000${paths.join("\u0000")}`;
}

function runGit(root, argumentsList, options = {}) {
  const result = childProcess.spawnSync("git", argumentsList, {
    cwd: root,
    encoding: options.binary === true ? null : "utf8",
    maxBuffer: (options.maximumBytes ?? 4 * 1024 * 1024) + 1024 * 1024,
    shell: false,
    timeout: 30_000,
    windowsHide: true
  });
  invariant(result.error === undefined, `${options.label ?? "Git"} did not spawn`);
  invariant(result.signal === null, `${options.label ?? "Git"} received a signal`);
  if (options.allowFailure !== true) {
    invariant(result.status === 0, `${options.label ?? "Git"} failed`);
    invariant(result.stderr.length === 0, `${options.label ?? "Git"} wrote stderr`);
  }
  return result;
}

function validateSortedUnique(records, key, label) {
  const keys = records.map(key);
  invariant(new Set(keys).size === keys.length, `${label} contains duplicates`);
  invariant(
    keys.every((value, index) => index === 0 || keys[index - 1] < value),
    `${label} is not canonically sorted`
  );
}

function validateWitnessBlobClosure(lineageRoot, blobs) {
  const expectedPaths = [...new Set(
    blobs
      .filter((entry) => entry.storageKind === "witness-blob")
      .map((entry) => entry.storagePath)
  )].sort();
  const storageRoot = path.join(lineageRoot, "blobs", "sha256");
  if (expectedPaths.length === 0) {
    invariant(
      !fs.existsSync(storageRoot),
      "historical blob storage closure is invalid"
    );
    return;
  }

  const rootStat = fs.lstatSync(storageRoot);
  invariant(
    rootStat.isDirectory() && !rootStat.isSymbolicLink(),
    "historical blob storage closure is invalid"
  );
  const expectedDirectories = [...new Set(
    expectedPaths.map((value) => value.split("/")[2])
  )].sort();
  const rootEntries = fs.readdirSync(storageRoot, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  invariant(
    rootEntries.length === expectedDirectories.length &&
      rootEntries.every((entry, index) =>
        entry.isDirectory() &&
        !entry.isSymbolicLink() &&
        entry.name === expectedDirectories[index]),
    "historical blob storage closure is invalid"
  );

  const actualPaths = [];
  for (const directory of rootEntries) {
    invariant(
      /^[a-f0-9]{2}$/u.test(directory.name),
      "historical blob storage closure is invalid"
    );
    const directoryPath = path.join(storageRoot, directory.name);
    const directoryStat = fs.lstatSync(directoryPath);
    invariant(
      directoryStat.isDirectory() && !directoryStat.isSymbolicLink(),
      "historical blob storage closure is invalid"
    );
    const entries = fs.readdirSync(directoryPath, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      invariant(
        entry.isFile() &&
          !entry.isSymbolicLink() &&
          /^[a-f0-9]{64}\.blob$/u.test(entry.name) &&
          entry.name.startsWith(directory.name),
        "historical blob storage closure is invalid"
      );
      actualPaths.push(`blobs/sha256/${directory.name}/${entry.name}`);
    }
  }
  actualPaths.sort();
  invariant(
    actualPaths.length === expectedPaths.length &&
      actualPaths.every((value, index) => value === expectedPaths[index]),
    "historical blob storage closure is invalid"
  );
}

function validateSecretScanAdjudication(
  adjudicationPath,
  expectedAdjudicationSha256,
  expectedWitnessSha256
) {
  invariant(path.isAbsolute(adjudicationPath), "adjudication path must be absolute");
  validateSha256(expectedAdjudicationSha256, "expected adjudication hash");
  validateSha256(expectedWitnessSha256, "adjudicated witness hash");
  const stat = fs.lstatSync(adjudicationPath);
  invariant(
    stat.isFile() &&
      !stat.isSymbolicLink() &&
      stat.size > 0 &&
      stat.size <= absoluteMaximumAdjudicationBytes,
    "secret-scan adjudication file is invalid"
  );
  const bytes = fs.readFileSync(adjudicationPath);
  invariant(
    sha256(bytes) === expectedAdjudicationSha256,
    "secret-scan adjudication hash is invalid"
  );
  const value = JSON.parse(bytes.toString("utf8"));
  invariant(
    bytes.equals(canonicalWitnessBytes(value)),
    "secret-scan adjudication bytes are not canonical"
  );
  exactKeys(value, [
    "schema",
    "adjudicationId",
    "observedAtUtc",
    "witness",
    "scan",
    "findings",
    "authority",
    "remainingRisks",
    "status"
  ], "secret-scan adjudication");
  invariant(
    value.schema === "tinyrustlm.clean_history_secret_scan_adjudication.v1" &&
      value.adjudicationId ===
        "tinyrustlm-clean-history-secret-scan-20260802" &&
      value.status === "accepted-for-source-control",
    "secret-scan adjudication identity is invalid"
  );
  validateUtc(value.observedAtUtc);

  exactKeys(value.witness, ["path", "sha256"], "adjudicated witness");
  invariant(
    value.witness.path ===
      "tinyrustlm/history/clean-history-lineage/witness.v1.json" &&
      value.witness.sha256 === expectedWitnessSha256,
    "secret-scan witness binding is invalid"
  );

  exactKeys(value.scan, [
    "reportSchema",
    "reportSha256",
    "scannerRuleVersion",
    "scopeManifestSha256",
    "scannedArtifactCount",
    "scannedContentByteCount",
    "rawStatus",
    "findingCount",
    "knownSecretEqualityScanPerformed"
  ], "secret-scan result");
  invariant(
    value.scan.reportSchema === "tinyrustlm.public_artifact_secret_scan.v2" &&
      value.scan.reportSha256 ===
        "81df24504f3d80bdfc5abbcd648da9869d87b0a1c9ce7e31922649d08322fb74" &&
      value.scan.scannerRuleVersion ===
        "tinyrustlm-public-artifact-secret-rules-v1" &&
      value.scan.scopeManifestSha256 ===
        "611d7b694449dfcfb9fe9f7a85b539c980c3318716b1cec09fe7d7073a5dc0b8" &&
      value.scan.scannedArtifactCount === 136 &&
      value.scan.scannedContentByteCount === 29975209 &&
      value.scan.rawStatus === "fail" &&
      value.scan.findingCount === 2 &&
      value.scan.knownSecretEqualityScanPerformed === false,
    "secret-scan result is invalid"
  );

  const expectedFindings = [
    {
      code: "credential_url_userinfo",
      artifactSha256:
        "00f32ff48ebaa3ae4cd69380ba8f07c4c0f6ff4e6c72c8f029a5d43be2f65cf7",
      sourcePath: "tinyrustlm/tests/campaign-evidence-store.test.js",
      disposition: "synthetic-negative-test-fixture"
    },
    {
      code: "bearer_credential",
      artifactSha256:
        "14d789cf244ec854cfd93921c638f6844ed99634e09e7a9cc4fd1cad6a3bd10a",
      sourcePath:
        "tinyrustlm/tests/vector-baseline-evidence-observation.test.js",
      disposition: "synthetic-negative-test-fixture"
    }
  ];
  invariant(
    JSON.stringify(value.findings) === JSON.stringify(expectedFindings),
    "secret-scan findings are invalid"
  );
  exactKeys(value.authority, [
    "sourceControlAdmission",
    "publicWebPublication",
    "credentialAbsenceBeyondConfiguredRules"
  ], "secret-scan authority");
  invariant(
    value.authority.sourceControlAdmission === true &&
      value.authority.publicWebPublication === false &&
      value.authority.credentialAbsenceBeyondConfiguredRules === false,
    "secret-scan authority is invalid"
  );
  invariant(
    JSON.stringify(value.remainingRisks) ===
      JSON.stringify(["known-secret-equality-list-not-supplied"]),
    "secret-scan remaining risks are invalid"
  );
  return Object.freeze({ bytes, value });
}

function parseWitness(witnessPath, expectedWitnessSha256) {
  invariant(path.isAbsolute(witnessPath), "witness path must be absolute");
  validateSha256(expectedWitnessSha256, "expected witness hash");
  const stat = fs.lstatSync(witnessPath);
  invariant(
    stat.isFile() &&
      !stat.isSymbolicLink() &&
      stat.size > 0 &&
      stat.size <= absoluteMaximumWitnessBytes,
    "witness file is invalid"
  );
  const bytes = fs.readFileSync(witnessPath);
  invariant(sha256(bytes) === expectedWitnessSha256, "witness hash is invalid");
  const witness = JSON.parse(bytes.toString("utf8"));
  invariant(
    bytes.equals(canonicalWitnessBytes(witness)),
    "witness bytes are not canonical"
  );
  exactKeys(witness, [
    "schema",
    "witnessId",
    "observedAtUtc",
    "bridge",
    "limits",
    "revisionParents",
    "ancestry",
    "pathAdditions",
    "pathStates",
    "lastChanges",
    "blobs"
  ], "witness");
  invariant(witness.schema === schema, "witness schema is invalid");
  invariant(
    witness.witnessId ===
      "tinyrustlm-retained-evidence-clean-history-20260802",
    "witness identity is invalid"
  );
  validateUtc(witness.observedAtUtc);

  exactKeys(witness.bridge, [
    "historicalTipRevision",
    "historicalTipTree",
    "cleanRootRevision",
    "cleanRootTree",
    "sourceArchiveSha256",
    "sourceSecretScanAdjudicationSha256"
  ], "witness bridge");
  validateRevision(witness.bridge.historicalTipRevision, "historical tip revision");
  validateRevision(witness.bridge.historicalTipTree, "historical tip tree");
  validateRevision(witness.bridge.cleanRootRevision, "clean root revision");
  validateRevision(witness.bridge.cleanRootTree, "clean root tree");
  validateSha256(witness.bridge.sourceArchiveSha256, "source archive hash");
  validateSha256(
    witness.bridge.sourceSecretScanAdjudicationSha256,
    "source secret-scan adjudication hash"
  );
  invariant(
    witness.bridge.historicalTipTree === witness.bridge.cleanRootTree,
    "history bridge trees are not identical"
  );

  exactKeys(witness.limits, [
    "maximumBlobBytes",
    "maximumBlobCount",
    "maximumSourceFileBytes",
    "maximumWitnessBytes"
  ], "witness limits");
  invariant(
    Number.isSafeInteger(witness.limits.maximumSourceFileBytes) &&
      witness.limits.maximumSourceFileBytes > 0 &&
      witness.limits.maximumSourceFileBytes <= absoluteMaximumSourceFileBytes,
    "maximum historical source-file size is invalid"
  );
  invariant(
    Number.isSafeInteger(witness.limits.maximumBlobBytes) &&
      witness.limits.maximumBlobBytes > 0 &&
      witness.limits.maximumBlobBytes <= absoluteMaximumBlobBytes,
    "maximum historical blob size is invalid"
  );
  invariant(
    Number.isSafeInteger(witness.limits.maximumBlobCount) &&
      witness.limits.maximumBlobCount > 0 &&
      witness.limits.maximumBlobCount <= absoluteMaximumBlobCount,
    "maximum historical blob count is invalid"
  );
  invariant(
    Number.isSafeInteger(witness.limits.maximumWitnessBytes) &&
      witness.limits.maximumWitnessBytes > 0 &&
      witness.limits.maximumWitnessBytes <= absoluteMaximumWitnessBytes &&
      bytes.length <= witness.limits.maximumWitnessBytes,
    "maximum witness size is invalid"
  );

  invariant(Array.isArray(witness.revisionParents), "revision parents are invalid");
  witness.revisionParents.forEach((entry) => {
    exactKeys(entry, ["revision", "parent"], "revision parent");
    validateRevision(entry.revision, "revision parent revision");
    validateRevision(entry.parent, "revision parent value");
    invariant(entry.revision !== entry.parent, "revision parent is self-referential");
  });
  validateSortedUnique(
    witness.revisionParents,
    (entry) => entry.revision,
    "revision parents"
  );

  invariant(Array.isArray(witness.ancestry), "ancestry evidence is invalid");
  witness.ancestry.forEach((entry) => {
    exactKeys(entry, ["ancestor", "descendant"], "ancestry entry");
    validateRevision(entry.ancestor, "ancestor revision");
    validateRevision(entry.descendant, "descendant revision");
    invariant(entry.ancestor !== entry.descendant, "ancestry entry is reflexive");
  });
  validateSortedUnique(
    witness.ancestry,
    (entry) => pairKey(entry.ancestor, entry.descendant),
    "ancestry evidence"
  );

  invariant(Array.isArray(witness.pathAdditions), "path additions are invalid");
  witness.pathAdditions.forEach((entry) => {
    exactKeys(entry, ["path", "revision"], "path addition");
    validateHistoricalPath(entry.path);
    validateRevision(entry.revision, "path addition revision");
  });
  validateSortedUnique(
    witness.pathAdditions,
    (entry) => entry.path,
    "path additions"
  );

  invariant(Array.isArray(witness.pathStates), "path states are invalid");
  witness.pathStates.forEach((entry) => {
    exactKeys(entry, ["revision", "path", "present"], "path state");
    validateRevision(entry.revision, "path-state revision");
    validateHistoricalPath(entry.path);
    invariant(typeof entry.present === "boolean", "path-state value is invalid");
  });
  validateSortedUnique(
    witness.pathStates,
    (entry) => pairKey(entry.revision, entry.path),
    "path states"
  );

  invariant(Array.isArray(witness.lastChanges), "last-change evidence is invalid");
  witness.lastChanges.forEach((entry) => {
    exactKeys(entry, ["atRevision", "paths", "revision"], "last-change entry");
    validateRevision(entry.atRevision, "last-change boundary revision");
    validateRevision(entry.revision, "last-change revision");
    const normalized = canonicalPathSet(entry.paths);
    invariant(
      JSON.stringify(entry.paths) === JSON.stringify(normalized),
      "last-change paths are not canonically sorted"
    );
  });
  validateSortedUnique(
    witness.lastChanges,
    (entry) => pathSetKey(entry.atRevision, entry.paths),
    "last-change evidence"
  );

  invariant(
    Array.isArray(witness.blobs) &&
      witness.blobs.length > 0 &&
      witness.blobs.length <= witness.limits.maximumBlobCount,
    "historical blobs are invalid"
  );
  witness.blobs.forEach((entry) => {
    exactKeys(entry, [
      "revision", "path", "bytes", "sha256", "storageKind", "storagePath"
    ], "historical blob");
    validateRevision(entry.revision, "historical blob revision");
    validateHistoricalPath(entry.path);
    invariant(
      Number.isSafeInteger(entry.bytes) &&
        entry.bytes > 0 &&
        entry.bytes <= (entry.storageKind === "witness-blob"
          ? witness.limits.maximumBlobBytes
          : witness.limits.maximumSourceFileBytes),
      "historical blob size is invalid"
    );
    validateSha256(entry.sha256, "historical blob hash");
    invariant(
      entry.storageKind === "witness-blob" ||
        entry.storageKind === "source-file",
      "historical blob storage kind is invalid"
    );
    if (entry.storageKind === "witness-blob") {
      invariant(
        entry.storagePath ===
          `blobs/sha256/${entry.sha256.slice(0, 2)}/${entry.sha256}.blob`,
        "historical blob storage path is invalid"
      );
    } else {
      validateHistoricalPath(entry.storagePath);
      invariant(
        entry.storagePath === entry.path,
        "historical source-file storage path is invalid"
      );
    }
  });
  validateSortedUnique(
    witness.blobs,
    (entry) => pairKey(entry.revision, entry.path),
    "historical blobs"
  );

  return Object.freeze({ bytes, witness });
}

function createLineageReader({
  repositoryRoot: requestedRepositoryRoot,
  witnessPath,
  expectedWitnessSha256,
  secretScanAdjudicationPath = null,
  expectedSecretScanAdjudicationSha256 = null
}) {
  invariant(
    typeof requestedRepositoryRoot === "string" &&
      path.isAbsolute(requestedRepositoryRoot),
    "repository root must be absolute"
  );
  const root = path.resolve(requestedRepositoryRoot);
  const resolvedWitnessPath = path.resolve(witnessPath);
  const { witness } = parseWitness(resolvedWitnessPath, expectedWitnessSha256);
  invariant(
    (secretScanAdjudicationPath === null) ===
      (expectedSecretScanAdjudicationSha256 === null),
    "secret-scan adjudication configuration is incomplete"
  );
  const adjudication = secretScanAdjudicationPath === null
    ? null
    : validateSecretScanAdjudication(
      path.resolve(secretScanAdjudicationPath),
      expectedSecretScanAdjudicationSha256,
      expectedWitnessSha256
    ).value;
  const cleanRoot = witness.bridge.cleanRootRevision;
  const historicalTip = witness.bridge.historicalTipRevision;
  const actualCleanRootTree = runGit(
    root,
    ["rev-parse", `${cleanRoot}^{tree}`],
    { label: "clean root tree" }
  ).stdout.trim();
  invariant(
    actualCleanRootTree === witness.bridge.cleanRootTree,
    "clean root tree does not match the history bridge"
  );

  const parentMap = new Map(
    witness.revisionParents.map((entry) => [entry.revision, entry.parent])
  );
  const ancestrySet = new Set(
    witness.ancestry.map((entry) => pairKey(entry.ancestor, entry.descendant))
  );
  const additionMap = new Map(
    witness.pathAdditions.map((entry) => [entry.path, entry.revision])
  );
  const pathStateMap = new Map(
    witness.pathStates.map((entry) => [
      pairKey(entry.revision, entry.path),
      entry.present
    ])
  );
  const lastChangeMap = new Map(
    witness.lastChanges.map((entry) => [
      pathSetKey(entry.atRevision, entry.paths),
      entry.revision
    ])
  );
  const blobMap = new Map(
    witness.blobs.map((entry) => [pairKey(entry.revision, entry.path), entry])
  );
  const historicalRevisionSet = new Set([
    historicalTip,
    ...witness.revisionParents.flatMap((entry) => [entry.revision, entry.parent]),
    ...witness.ancestry.flatMap((entry) => [entry.ancestor, entry.descendant]),
    ...witness.pathAdditions.map((entry) => entry.revision),
    ...witness.pathStates.map((entry) => entry.revision),
    ...witness.lastChanges.flatMap((entry) => [entry.atRevision, entry.revision]),
    ...witness.blobs.map((entry) => entry.revision)
  ]);
  const blobCache = new Map();
  const lineageRoot = path.dirname(resolvedWitnessPath);
  validateWitnessBlobClosure(lineageRoot, witness.blobs);
  for (const entry of witness.blobs) {
    const storageRoot = entry.storageKind === "witness-blob"
      ? lineageRoot
      : root;
    const blobPath = path.resolve(
      storageRoot,
      ...entry.storagePath.split("/")
    );
    const relative = path.relative(storageRoot, blobPath);
    invariant(
      relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative),
      "historical blob storage escaped its declared root"
    );
    const stat = fs.lstatSync(blobPath);
    invariant(
      stat.isFile() &&
        !stat.isSymbolicLink() &&
        stat.size === entry.bytes &&
        stat.size <= (entry.storageKind === "witness-blob"
          ? witness.limits.maximumBlobBytes
          : witness.limits.maximumSourceFileBytes),
      "historical blob bytes are invalid"
    );
    const bytes = fs.readFileSync(blobPath);
    invariant(sha256(bytes) === entry.sha256, "historical blob bytes are invalid");
    const existing = blobCache.get(entry.sha256);
    invariant(
      existing === undefined || existing.equals(bytes),
      "historical blob hash collision detected"
    );
    blobCache.set(entry.sha256, Buffer.from(bytes));
  }

  function isCleanRevision(revision) {
    validateRevision(revision, "source revision");
    const result = runGit(
      root,
      ["merge-base", "--is-ancestor", cleanRoot, revision],
      { allowFailure: true, label: "clean-history ancestry" }
    );
    invariant(
      result.status === 0 || result.status === 1 || result.status === 128,
      "clean-history ancestry check failed"
    );
    return result.status === 0;
  }

  function requireHistoricalRevision(revision) {
    invariant(
      historicalRevisionSet.has(revision),
      `historical revision is not witnessed: ${revision}`
    );
  }

  function headRevision() {
    const value = runGit(root, ["rev-parse", "HEAD"], {
      label: "source revision"
    }).stdout.trim();
    validateRevision(value, "source revision");
    invariant(isCleanRevision(value), "HEAD is outside clean history");
    return value;
  }

  function hasRevision(revision) {
    validateRevision(revision, "source revision");
    return isCleanRevision(revision) || historicalRevisionSet.has(revision);
  }

  function readBlob(revision, relativePath, maximumBytes = absoluteMaximumBlobBytes) {
    validateRevision(revision, "historical revision");
    validateHistoricalPath(relativePath);
    invariant(
      Number.isSafeInteger(maximumBytes) && maximumBytes > 0,
      "historical byte limit is invalid"
    );
    if (isCleanRevision(revision)) {
      const result = runGit(
        root,
        ["cat-file", "blob", `${revision}:${relativePath}`],
        {
          binary: true,
          label: `clean-history blob ${relativePath}`,
          maximumBytes
        }
      );
      invariant(
        Buffer.isBuffer(result.stdout) &&
          result.stdout.length > 0 &&
          result.stdout.length <= maximumBytes,
        `clean-history blob size is invalid: ${relativePath}`
      );
      return Buffer.from(result.stdout);
    }
    requireHistoricalRevision(revision);
    const key = pairKey(revision, relativePath);
    const entry = blobMap.get(key);
    invariant(entry !== undefined, `historical blob is not witnessed: ${relativePath}`);
    invariant(entry.bytes <= maximumBytes, `historical blob size is invalid: ${relativePath}`);
    const cached = blobCache.get(entry.sha256);
    invariant(cached !== undefined, "historical blob cache is incomplete");
    return Buffer.from(cached);
  }

  function parentRevision(revision) {
    validateRevision(revision, "source revision");
    if (isCleanRevision(revision)) {
      if (revision === cleanRoot) return null;
      const value = runGit(root, ["rev-parse", `${revision}^`], {
        label: "clean-history parent"
      }).stdout.trim();
      validateRevision(value, "clean-history parent");
      return value;
    }
    requireHistoricalRevision(revision);
    const value = parentMap.get(revision);
    invariant(value !== undefined, "historical revision parent is not witnessed");
    return value;
  }

  function historicalAncestor(ancestor, descendant) {
    if (ancestor === descendant) return true;
    if (ancestrySet.has(pairKey(ancestor, descendant))) return true;
    const visited = new Set();
    let cursor = descendant;
    while (parentMap.has(cursor) && !visited.has(cursor)) {
      visited.add(cursor);
      cursor = parentMap.get(cursor);
      if (cursor === ancestor) return true;
    }
    return false;
  }

  function isAncestor(ancestor, descendant) {
    validateRevision(ancestor, "ancestor revision");
    validateRevision(descendant, "descendant revision");
    const ancestorIsClean = isCleanRevision(ancestor);
    const descendantIsClean = ancestor === descendant
      ? ancestorIsClean
      : isCleanRevision(descendant);
    if (!ancestorIsClean) requireHistoricalRevision(ancestor);
    if (!descendantIsClean) requireHistoricalRevision(descendant);
    if (ancestor === descendant) return true;
    if (ancestorIsClean && descendantIsClean) {
      return runGit(
        root,
        ["merge-base", "--is-ancestor", ancestor, descendant],
        { allowFailure: true, label: "clean-history lineage" }
      ).status === 0;
    }
    if (ancestorIsClean) {
      return false;
    }
    if (!descendantIsClean) {
      return historicalAncestor(ancestor, descendant);
    }
    return historicalAncestor(ancestor, historicalTip);
  }

  function pathAdditionCommit(relativePath) {
    validateHistoricalPath(relativePath);
    const witnessed = additionMap.get(relativePath);
    if (witnessed !== undefined) return witnessed;
    const existedAtCleanRoot = runGit(
      root,
      ["cat-file", "-e", `${cleanRoot}:${relativePath}`],
      { allowFailure: true, label: "clean-root path check" }
    );
    invariant(
      existedAtCleanRoot.status === 0 || existedAtCleanRoot.status === 128,
      "clean-root path check failed"
    );
    invariant(
      existedAtCleanRoot.status !== 0,
      `path addition is not witnessed: ${relativePath}`
    );
    const result = runGit(
      root,
      ["log", "--diff-filter=A", "--format=%H", "--", relativePath],
      { label: "clean-history path addition" }
    );
    const revisions = result.stdout.trim().split(/\r?\n/u).filter(Boolean);
    invariant(revisions.length <= 1, "path has multiple addition commits");
    return revisions[0] ?? null;
  }

  function pathExistsAtRevision(revision, relativePath) {
    validateRevision(revision, "source revision");
    validateHistoricalPath(relativePath);
    if (isCleanRevision(revision)) {
      const result = runGit(
        root,
        ["cat-file", "-e", `${revision}:${relativePath}`],
        { allowFailure: true, label: "clean-history path check" }
      );
      invariant(
        result.status === 0 || result.status === 128,
        "clean-history path check failed"
      );
      return result.status === 0;
    }
    requireHistoricalRevision(revision);
    const key = pairKey(revision, relativePath);
    invariant(
      pathStateMap.has(key),
      `historical path state is not witnessed: ${relativePath}`
    );
    return pathStateMap.get(key);
  }

  function lastChangeCommit(paths, atRevision = headRevision()) {
    const normalizedPaths = canonicalPathSet(paths);
    validateRevision(atRevision, "last-change boundary revision");
    if (!isCleanRevision(atRevision)) {
      requireHistoricalRevision(atRevision);
      const historical = lastChangeMap.get(pathSetKey(atRevision, normalizedPaths));
      invariant(historical !== undefined, "historical last change is not witnessed");
      return historical;
    }
    const postMigration = runGit(
      root,
      [
        "log",
        "-1",
        "--format=%H",
        `${cleanRoot}..${atRevision}`,
        "--",
        ...normalizedPaths
      ],
      { label: "post-migration last change" }
    ).stdout.trim();
    if (postMigration !== "") {
      validateRevision(postMigration, "post-migration last change");
      return postMigration;
    }
    const historical = lastChangeMap.get(
      pathSetKey(historicalTip, normalizedPaths)
    );
    invariant(historical !== undefined, "historical last change is not witnessed");
    return historical;
  }

  return Object.freeze({
    cleanRootRevision: cleanRoot,
    expectedWitnessSha256,
    hasRevision,
    headRevision,
    historicalTipRevision: historicalTip,
    isAncestor,
    lastChangeCommit,
    parentRevision,
    pathAdditionCommit,
    pathExistsAtRevision,
    readBlob,
    secretScanAdjudicationId: adjudication?.adjudicationId ?? null,
    witnessId: witness.witnessId
  });
}

let productionReader = null;

function productionLineageReader() {
  invariant(
    productionWitnessSha256 !== null,
    "production history witness is not configured"
  );
  if (productionReader === null) {
    productionReader = createLineageReader({
      repositoryRoot,
      witnessPath: defaultWitnessPath,
      expectedWitnessSha256: productionWitnessSha256,
      secretScanAdjudicationPath: defaultSecretScanAdjudicationPath,
      expectedSecretScanAdjudicationSha256:
        productionSecretScanAdjudicationSha256
    });
  }
  return productionReader;
}

module.exports = Object.freeze({
  canonicalWitnessBytes,
  createLineageReader,
  defaultSecretScanAdjudicationPath,
  defaultWitnessPath,
  productionLineageReader,
  productionSecretScanAdjudicationSha256,
  productionWitnessSha256,
  relativePathPattern,
  revisionPattern,
  schema,
  sha256,
  validateSecretScanAdjudication
});
