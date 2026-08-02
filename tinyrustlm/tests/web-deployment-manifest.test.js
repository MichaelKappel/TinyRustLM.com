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

const siteRoot = path.resolve(__dirname, "..");
const deploymentManifestPath = path.join(
  siteRoot,
  "deploy",
  "web-deployment-manifest.v1.json"
);

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

test("web deployment manifest is the exact no-model publication closure", () => {
  const result = validateWebDeploymentManifest({ siteRoot });
  const paths = new Set(result.files.map((file) => file.remote));
  assert.equal(result.files.length, 17);
  assert.ok(paths.has("app/browser-model-admission.js"));
  assert.ok(paths.has("app/memory-endpoints-enrollment.js"));
  assert.ok(paths.has("runtime/tinyrustlm.wasm"));
  assert.ok(paths.has("runtime/tinyrustlm-simd.wasm"));
  assert.equal(Array.from(paths).some((entry) => /\.slm(?:\.|$)/i.test(entry)), false);
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

test("web deployment manifest fails closed on omitted or hosted model paths", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-deploy-manifest-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const baseline = JSON.parse(fs.readFileSync(deploymentManifestPath, "utf8"));

  const omittedPath = path.join(root, "omitted.json");
  const omitted = structuredClone(baseline);
  omitted.publish = omitted.publish.filter(
    (entry) => entry.local !== "app/browser-model-admission.js"
  );
  writeJson(omittedPath, omitted);
  assert.throws(
    () => validateWebDeploymentManifest({ siteRoot, manifestPath: omittedPath }),
    /publication closure is incomplete/
  );

  const hostedModelPath = path.join(root, "hosted-model.json");
  const hostedModel = structuredClone(baseline);
  hostedModel.publish.splice(1, 0, {
    local: "models/quality-model.slm",
    remote: "models/quality-model.slm"
  });
  writeJson(hostedModelPath, hostedModel);
  assert.throws(
    () => validateWebDeploymentManifest({ siteRoot, manifestPath: hostedModelPath }),
    /Model path cannot be published/
  );

  const incompleteRetirementPath = path.join(root, "retirement.json");
  const incompleteRetirement = structuredClone(baseline);
  incompleteRetirement.retire.pop();
  writeJson(incompleteRetirementPath, incompleteRetirement);
  assert.throws(
    () => validateWebDeploymentManifest({
      siteRoot,
      manifestPath: incompleteRetirementPath
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
  assert.throws(
    () => validateWebDeploymentManifest({
      siteRoot,
      manifestPath: path.join(junction, "manifest.json")
    }),
    /manifest is unavailable/
  );
});
