"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  bindDeploymentInput,
  verifyDeploymentInput,
  retiredPublicPaths,
  validateHostPolicy,
  validateRetirementClosure,
  validateWebDeploymentManifest
} = require("../tools/web-deployment-manifest.js");
const { materializeSourceReleaseState, writePendingLedger, temporaryDirectory } =
  require("./site-release-test-fixture.js");
const { materializeReleasePublication } = require("../tools/site-release-contract.js");

const siteRoot = path.resolve(__dirname, "..");
const deploymentManifestPath = path.join(
  siteRoot,
  "deploy",
  "web-deployment-manifest.v2.json"
);

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function materializedRelease(context) {
  return materializeSourceReleaseState(
    context,
    "tinyrustlm-generated-release-"
  ).outputRoot;
}

test("deployment input binds real canonical files without a source snapshot", (context) => {
  const generatedRoot = materializedRelease(context);
  const before = fs.readdirSync(generatedRoot).sort();
  const { input, validation } = bindDeploymentInput({ siteRoot, generatedRoot });
  assert.equal(input.schema, "tinyrustlm.web_deployment_input.v1");
  assert.equal(input.fileCount, validation.files.length);
  assert.equal(input.totalByteCount, validation.totalByteCount);
  assert.equal(input.files.some((file) => Object.hasOwn(file, "filePath")), false);
  assert.equal(JSON.stringify(input).includes(JSON.stringify(path.dirname(siteRoot)).slice(1, -1)), false);
  assert.deepEqual(verifyDeploymentInput({ siteRoot, generatedRoot,
    expectedInputId: input.inputId }).input, input);
  assert.deepEqual(fs.readdirSync(generatedRoot).sort(), before);
  assert.throws(() => bindDeploymentInput({ siteRoot, generatedRoot, snapshotRoot: generatedRoot }),
    /options are invalid/);
  assert.throws(() => bindDeploymentInput({ siteRoot: path.dirname(siteRoot), generatedRoot }),
    /canonical site root/);
  assert.throws(() => verifyDeploymentInput({ siteRoot, generatedRoot, expectedInputId: "bad" }),
    /identity is invalid/);
  assert.throws(() => verifyDeploymentInput({ siteRoot, generatedRoot,
    expectedInputId: "0".repeat(64) }), /changed after binding/);
});

test("finalized deployment input rejects a different valid candidate publication", (context) => {
  const initialRoot = materializedRelease(context);
  const { input } = bindDeploymentInput({ siteRoot, generatedRoot: initialRoot });
  const changedRoot = temporaryDirectory(context, "tinyrustlm-changed-publication-");
  materializeReleasePublication({ ledgerPath: writePendingLedger(context),
    outputRoot: changedRoot, sourceRevision: "b".repeat(40),
    publishedAt: "2026-08-31T23:16:30.000Z" });
  const changed = JSON.parse(fs.readFileSync(path.join(changedRoot,
    ".well-known/site-release.json"), "utf8"));
  assert.notEqual(changed.publicationId, input.publicationId);
  assert.throws(() => bindDeploymentInput({ siteRoot, generatedRoot: changedRoot }),
    /Current release record does not match its source ledger/);
  assert.throws(() => verifyDeploymentInput({ siteRoot, generatedRoot: changedRoot,
    expectedInputId: input.inputId }), /Current release record does not match its source ledger/);
});

test("web deployment manifest is the exact no-model publication closure", (context) => {
  const result = validateWebDeploymentManifest({
    siteRoot,
    generatedRoot: materializedRelease(context)
  });
  const paths = new Set(result.files.map((file) => file.remote));
  assert.equal(result.files.length, 32);
  assert.equal(paths.has("app/minimodel-announcement.js"), false);
  assert.ok(retiredPublicPaths.includes("app/minimodel-announcement.js"));
  assert.ok(paths.has("app/browser-model-admission.js"));
  assert.ok(paths.has("app/browser-runtime-loader.js"));
  assert.ok(paths.has("app/operation-lifetime.js"));
  assert.ok(paths.has("app/prompt2-request.js"));
  assert.ok(paths.has("app/model-runtime-client.js"));
  assert.ok(paths.has("app/model-runtime-worker.js"));
  assert.ok(paths.has("app/memory-endpoints-enrollment.js"));
  assert.ok(paths.has("app/memory-endpoints-http.js"));
  assert.ok(paths.has("app/companion-capability.js"));
  assert.ok(paths.has("app/minimodel-catalog-v1.js"));
  assert.ok(paths.has("app/incremental-sha256.js"));
  assert.ok(paths.has("app/catalog-admission-loader.js"));
  assert.ok(paths.has("app/model-composition-store.js"));
  assert.ok(paths.has("app/companion-composition-install.js"));
  assert.ok(paths.has("app/p2p-composition-install.js"));
  assert.equal(paths.has("app/companion-bridge.js"), false);
  assert.ok(paths.has("app/site-release.js"));
  assert.ok(paths.has("updates/index.html"));
  assert.ok(paths.has("companion/index.html"));
  assert.ok(paths.has(".well-known/site-release.json"));
  assert.ok(paths.has(".well-known/site-release-history.json"));
  assert.ok(paths.has("browser-runtime/tinyrustlm-browser-runtime.wasm"));
  assert.ok(paths.has("browser-runtime/tinyrustlm-browser-runtime.wasm.manifest.json"));
  assert.equal(paths.has("runtime/tinyrustlm.wasm"), false);
  assert.equal(paths.has("runtime/tinyrustlm-simd.wasm"), false);
  assert.equal(Array.from(paths).some((entry) => /\.slm(?:\.|$)/i.test(entry)), false);
  const orderedPaths = result.manifest.publish.map((entry) => entry.remote);
  assert.deepEqual(
    orderedPaths.filter((entry) => /(?:sha256|admission-loader|composition-(?:store|install))\.js$/u
      .test(entry)),
    [
      "app/incremental-sha256.js",
      "app/catalog-admission-loader.js",
      "app/model-composition-store.js",
      "app/companion-composition-install.js",
      "app/p2p-composition-install.js"
    ]
  );
  assert.deepEqual(
    result.manifest.publish.slice(-5).map((entry) => entry.remote),
    [
      "updates/index.html",
      "app/index.html",
      "index.html",
      ".well-known/site-release-history.json",
      ".well-known/site-release.json"
    ]
  );
  assert.deepEqual(
    result.manifest.retire.map((entry) => entry.remote).sort(),
    Array.from(retiredPublicPaths).sort()
  );
  assert.ok(retiredPublicPaths.includes("app/companion-bridge.js"));
  assert.ok(
    result.manifest.retire.some((entry) => entry.remote === "app/companion-bridge.js")
  );
});

test("retirement closure requires companion bridge absence evidence", () => {
  const exactRetirement = retiredPublicPaths.map((remote) => ({ remote }));
  assert.equal(
    validateRetirementClosure(exactRetirement).has("app/companion-bridge.js"),
    true
  );
  const missingBridge = exactRetirement.filter(
    (entry) => entry.remote !== "app/companion-bridge.js"
  );
  assert.throws(
    () => validateRetirementClosure(missingBridge),
    /retired-path closure is incomplete/
  );
  assert.throws(
    () => validateRetirementClosure(
      exactRetirement,
      new Set(["app/companion-bridge.js"])
    ),
    /Published and retired paths overlap/
  );
});

test("web host policy blocks nested models, staging, backup, and source routes", () => {
  const hostPolicy = fs.readFileSync(path.join(siteRoot, ".htaccess"), "utf8");
  assert.equal(validateHostPolicy(hostPolicy), true);
  assert.throws(
    () => validateHostPolicy(
      hostPolicy.replace(
        /^.*deploy-\[0-9a-f\].*backup-\[0-9a-f\].*\r?\n/m,
        ""
      )
    ),
    /must block deployment stage and backup routes/
  );
  assert.throws(
    () => validateHostPolicy(
      hostPolicy.replace(
        "RewriteRule (^|/)models(/|$) - [R=404,L,NC]",
        "RewriteRule ^models(/|$) - [R=404,L]"
      )
    ),
    /must block project-hosted model routes/
  );
  assert.throws(
    () => validateHostPolicy(
      hostPolicy.replace('Header always set Referrer-Policy "no-referrer"', "")
    ),
    /missing required security header/
  );
});

test("web deployment manifest fails closed on omitted, generated, or hosted model paths", (context) => {
  const root = temporaryDirectory(context, "tinyrustlm-deploy-manifest-");
  const generatedRoot = materializedRelease(context);
  const baseline = JSON.parse(fs.readFileSync(deploymentManifestPath, "utf8"));
  if (!baseline.retire.some((entry) => entry.remote === "app/companion-bridge.js")) {
    baseline.retire.unshift({ remote: "app/companion-bridge.js" });
  }

  const omittedPath = path.join(root, "omitted.json");
  const omitted = structuredClone(baseline);
  omitted.publish = omitted.publish.filter(
    (entry) => entry.local !== "app/browser-model-admission.js"
  );
  writeJson(omittedPath, omitted);
  assert.throws(
    () => validateWebDeploymentManifest({ siteRoot, manifestPath: omittedPath, generatedRoot }),
    /source closure is incomplete/
  );

  const omittedGeneratedPath = path.join(root, "omitted-generated.json");
  const omittedGenerated = structuredClone(baseline);
  omittedGenerated.publish = omittedGenerated.publish.filter(
    (entry) => entry.local !== ".well-known/site-release.json"
  );
  writeJson(omittedGeneratedPath, omittedGenerated);
  assert.throws(
    () => validateWebDeploymentManifest({
      siteRoot,
      manifestPath: omittedGeneratedPath,
      generatedRoot
    }),
    /Generated release closure is incomplete/
  );

  const hostedModelPath = path.join(root, "hosted-model.json");
  const hostedModel = structuredClone(baseline);
  hostedModel.publish.splice(1, 0, {
    source: "source",
    local: "models/quality-model.slm",
    remote: "models/quality-model.slm"
  });
  writeJson(hostedModelPath, hostedModel);
  assert.throws(
    () => validateWebDeploymentManifest({ siteRoot, manifestPath: hostedModelPath, generatedRoot }),
    /Model path cannot be published/
  );

  const earlyCommitMarkerPath = path.join(root, "early-commit-marker.json");
  const earlyCommitMarker = structuredClone(baseline);
  const currentReleaseIndex = earlyCommitMarker.publish.findIndex(
    (entry) => entry.remote === ".well-known/site-release.json"
  );
  const [currentRelease] = earlyCommitMarker.publish.splice(currentReleaseIndex, 1);
  earlyCommitMarker.publish.splice(-2, 0, currentRelease);
  writeJson(earlyCommitMarkerPath, earlyCommitMarker);
  assert.throws(
    () => validateWebDeploymentManifest({
      siteRoot,
      manifestPath: earlyCommitMarkerPath,
      generatedRoot
    }),
    /current-release marker|publication commit marker/i
  );

  const incompleteRetirementPath = path.join(root, "retirement.json");
  const incompleteRetirement = structuredClone(baseline);
  incompleteRetirement.retire.pop();
  writeJson(incompleteRetirementPath, incompleteRetirement);
  assert.throws(
    () => validateWebDeploymentManifest({
      siteRoot,
      manifestPath: incompleteRetirementPath,
      generatedRoot
    }),
    /retired-path closure is incomplete/
  );
});

test("web deployment manifest rejects a manifest reached through a junction", (context) => {
  const root = temporaryDirectory(context, "tinyrustlm-manifest-link-");
  const target = path.join(root, "target");
  const junction = path.join(root, "junction");
  context.after(() => {
    fs.rmSync(junction, { force: true });
  });
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, "manifest.json"), "{}\n");
  fs.symlinkSync(target, junction, "junction");
  const generatedRoot = materializedRelease(context);
  assert.throws(
    () => validateWebDeploymentManifest({
      siteRoot,
      manifestPath: path.join(junction, "manifest.json"),
      generatedRoot
    }),
    /manifest is unavailable/
  );
});

test("web deployment manifest rejects generated release bytes inside source", () => {
  assert.throws(
    () => validateWebDeploymentManifest({
      siteRoot,
      generatedRoot: path.join(siteRoot, "release")
    }),
    /absolute child of canonical project artifacts/
  );
});

test("generated release output refuses artifacts parents, drive-root scratch and relative paths", () => {
  for (const generatedRoot of ["relative", siteRoot, path.resolve(siteRoot, "artifacts"), path.resolve(siteRoot, "../artifacts"), path.resolve(siteRoot, "../../scratch")]) {
    assert.throws(() => validateWebDeploymentManifest({ siteRoot, generatedRoot }), /absolute child of canonical project artifacts/);
  }
});
