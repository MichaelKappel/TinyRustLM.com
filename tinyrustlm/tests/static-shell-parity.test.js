"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  verifyShells,
  writeShells
} = require("../tools/static-shell-parity.js");

const siteRoot = path.resolve(__dirname, "..");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

test("canonical app shell deterministically generates the public root shell", () => {
  const result = verifyShells(siteRoot);
  assert.match(result.appShell, /<main class="app-shell"/);
  const references = new Set(result.references.map((entry) => entry.reference));
  assert.equal(result.references.length, 14);
  assert.ok(references.has("./browser-model-admission.js"));
  assert.ok(references.has("./browser-runtime-loader.js"));
  assert.ok(references.has("./prompt2-request.js"));
  assert.ok(references.has("./model-runtime-client.js"));
  assert.ok(references.has("./memory-endpoints-enrollment.js"));
  assert.ok(references.has("./site-release.js"));
  assert.ok(references.has("./app.js"));
  for (const reference of result.references) {
    assert.equal(reference.version, `sha256-${reference.sha256}`);
  }
});

test("public and loopback release hosts require the sole six-member worker admission path", () => {
  const source = fs.readFileSync(path.join(siteRoot, "app", "app.js"), "utf8");
  for (const host of [
    "127.0.0.1",
    "::1",
    "localhost",
    "tinyrustlm.com",
    "www.tinyrustlm.com"
  ]) {
    assert.match(source, new RegExp(`"${host.replaceAll(".", "\\.")}"`));
  }
  assert.match(source, /models:\s*Object\.create\(null\)/);
  assert.match(
    source,
    /if \(!isPublicLocalOnlyHost\(\)\) \{\s+Object\.assign\(result, modelsWithoutLocalModel\(models\)\);\s+\}/
  );
  assert.match(source, /activateBrowserComposition\(model, loadId\)/);
  assert.doesNotMatch(source, /WebAssembly\.instantiate/);
  assert.doesNotMatch(source, /tinyrustlm(?:-simd)?\.wasm/);
});

test("narrow desktop reserves a fixed empty-state composer", () => {
  const source = fs.readFileSync(path.join(siteRoot, "app", "app.css"), "utf8");
  assert.match(
    source,
    /@media \(min-width: 900px\) and \(max-width: 1199px\)[\s\S]*?data-conversation-state="empty"[\s\S]*?left: calc\(var\(--left-width\) \+ 18px\);[\s\S]*?bottom: 12px;[\s\S]*?justify-self: stretch;/
  );
});

test("shell writer repairs stale paths and content identities", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-shell-"));
  const appRoot = path.join(root, "app");
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(appRoot, { recursive: true });
  fs.writeFileSync(path.join(appRoot, "app.css"), "body { color: black; }\n");
  fs.writeFileSync(path.join(appRoot, "app.js"), "\"use strict\";\n");
  fs.writeFileSync(
    path.join(appRoot, "index.html"),
    [
      "<!doctype html>",
      "<link rel=\"stylesheet\" href=\"./app.css?v=stale\">",
      "<script src=\"./app.js?v=stale\"></script>",
      ""
    ].join("\n")
  );
  fs.writeFileSync(path.join(root, "index.html"), "stale root\n");

  const result = writeShells(root);
  const cssHash = sha256(fs.readFileSync(path.join(appRoot, "app.css")));
  const jsHash = sha256(fs.readFileSync(path.join(appRoot, "app.js")));
  assert.match(result.appShell, new RegExp(`app\\.css\\?v=sha256-${cssHash}`));
  assert.match(result.appShell, new RegExp(`app\\.js\\?v=sha256-${jsHash}`));
  assert.match(result.rootShell, new RegExp(`\\.\\/app\\/app\\.css\\?v=sha256-${cssHash}`));
  assert.match(result.rootShell, new RegExp(`\\.\\/app\\/app\\.js\\?v=sha256-${jsHash}`));

  fs.appendFileSync(path.join(appRoot, "app.js"), "window.changed = true;\n");
  assert.throws(() => verifyShells(root), /stale asset identity/);
});

test("shell verification rejects an asset reached through a directory junction", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-shell-link-"));
  const appRoot = path.join(root, "app");
  const externalRoot = path.join(root, "external");
  const junctionPath = path.join(appRoot, "linked");
  context.after(() => {
    fs.rmSync(junctionPath, { force: true });
    fs.rmSync(root, { recursive: true, force: true });
  });
  fs.mkdirSync(appRoot, { recursive: true });
  fs.mkdirSync(externalRoot);
  fs.writeFileSync(path.join(externalRoot, "app.js"), "\"use strict\";\n");
  fs.symlinkSync(externalRoot, junctionPath, "junction");
  fs.writeFileSync(
    path.join(appRoot, "index.html"),
    "<script src=\"./linked/app.js?v=stale\"></script>\n"
  );
  fs.writeFileSync(path.join(root, "index.html"), "stale\n");
  assert.throws(() => verifyShells(root), /missing or unsafe|ancestry/);
});
