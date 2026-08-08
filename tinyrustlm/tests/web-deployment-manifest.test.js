"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  retiredPublicPaths,
  validateHostPolicy,
  validateWebDeploymentManifest
} = require("../tools/web-deployment-manifest.js");
const {
  materializeReleaseState
} = require("../tools/site-release-contract.js");

const siteRoot = path.resolve(__dirname, "..");
const deploymentManifestPath = path.join(
  siteRoot,
  "deploy",
  "web-deployment-manifest.v2.json"
);
const ledgerPath = path.join(siteRoot, "release", "site-release-ledger.v1.json");
const candidateSourceRevision = "a".repeat(40);
const candidatePublishedAt = "2026-08-08T22:15:30.000Z";

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function materializedRelease(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-generated-release-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  materializeReleaseState({
    ledgerPath,
    outputRoot: root,
    sourceRevision: candidateSourceRevision,
    publishedAt: candidatePublishedAt
  });
  return root;
}

test("web deployment manifest is the exact no-model publication closure", (context) => {
  const result = validateWebDeploymentManifest({
    siteRoot,
    generatedRoot: materializedRelease(context)
  });
  const paths = new Set(result.files.map((file) => file.remote));
  assert.equal(result.files.length, 22);
  assert.ok(paths.has("app/browser-model-admission.js"));
  assert.ok(paths.has("app/memory-endpoints-enrollment.js"));
  assert.ok(paths.has("app/site-release.js"));
  assert.ok(paths.has("updates/index.html"));
  assert.ok(paths.has(".well-known/site-release.json"));
  assert.ok(paths.has(".well-known/site-release-history.json"));
  assert.ok(paths.has("runtime/tinyrustlm.wasm"));
  assert.ok(paths.has("runtime/tinyrustlm-simd.wasm"));
  assert.equal(Array.from(paths).some((entry) => /\.slm(?:\.|$)/i.test(entry)), false);
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-deploy-manifest-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const generatedRoot = materializedRelease(context);
  const baseline = JSON.parse(fs.readFileSync(deploymentManifestPath, "utf8"));

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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-manifest-link-"));
  const target = path.join(root, "target");
  const junction = path.join(root, "junction");
  context.after(() => {
    fs.rmSync(junction, { force: true });
    fs.rmSync(root, { recursive: true, force: true });
  });
  fs.mkdirSync(target);
  fs.copyFileSync(deploymentManifestPath, path.join(target, "manifest.json"));
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
    /outside the source worktree/
  );
});
