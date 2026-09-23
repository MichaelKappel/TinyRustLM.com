"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const siteRoot = path.resolve(__dirname, "..");
const repositoryRoot = path.resolve(siteRoot, "..");
const expectedCommand = [
  "playwright test",
  "--config=playwright.config.js",
  "--workers=1",
  "--retries=0",
  "--forbid-only",
  "e2e/model-chooser.spec.js",
  "e2e/composition-cache.spec.js",
  "e2e/direct-p2p-composition.spec.js"
].join(" ");

// Keep the operator commands aligned with the shared UI gate and evidence boundary.
test("runbook and UI gates expose the launcher without model claims", () => {
  const runbook = fs.readFileSync(path.join(siteRoot, "docs", "interview-demo.md"),
    "utf8");
  assert.match(runbook,
    /npm --prefix \.\\tinyrustlm run demo:interview(?:\r?\n|`)/u);
  assert.match(runbook, /Synthetic P2P walkthrough is not\s+started/u);
  assert.match(runbook, /does not claim that a model is\s+live/u);
  assert.match(runbook, /npm ci --prefix \.\\tinyrustlm/u);
  assert.match(runbook, /Playwright's pinned\s+Chromium/u);
  assert.match(runbook, /local UI shell\s+and loopback HTTP readiness only/u);
  assert.match(runbook, /catalog entry or peer announcement is metadata/u);
  assert.match(runbook,
    /npm --prefix \.\\tinyrustlm run demo:preflight:live/u);
  assert.match(runbook, /current truthful status is `BLOCKED`/u);
  assert.match(runbook, /standalone\s+headless invocation, without `--headed`/u);
  assert.match(runbook, /npm --prefix \.\\tinyrustlm run test:demo:interview:no-browser/u);
  assert.match(runbook, /37 unreadable entries/u);
  assert.match(runbook, /artifacts\/synthetic-p2p-demo\//u);
  assert.match(runbook, /separately marked scratch root/u);

  for (const relativePath of [
    "../eng/verify-tinyrustlm-ui.ps1",
    "../eng/verify-tinyrustlm-ui.sh"
  ]) {
    const gate = fs.readFileSync(path.resolve(siteRoot, relativePath), "utf8");
    assert.match(gate, /tools\/verify-ui\.js/u, relativePath);
    assert.doesNotMatch(gate, /demo:p2p:synthetic|demo:preflight:live/u,
      relativePath);
  }
  const owner = fs.readFileSync(path.join(siteRoot, "tools/verify-ui.js"), "utf8");
  assert.match(owner, /test:demo:interview:no-browser/u);
  assert.match(owner, /interview_demo_no_browser/u);
});

test("package exposes one exact no-retry acquisition Playwright command", () => {
  const packageDocument = JSON.parse(fs.readFileSync(
    path.join(siteRoot, "package.json"), "utf8"));
  const command = packageDocument.scripts["test:e2e:acquisition"];

  assert.equal(packageDocument.scripts["pretest:e2e:acquisition"],
    "npm run verify:source-authority");
  assert.equal(command, expectedCommand);
  assert.doesNotMatch(command, /(?:^|\s)e2e(?:\s|$)|\*|synthetic|live-model/iu);

  const namedSpecs = command.match(/e2e\/[a-z0-9-]+\.spec\.js/gu) || [];
  assert.deepEqual(namedSpecs, [
    "e2e/model-chooser.spec.js",
    "e2e/composition-cache.spec.js",
    "e2e/direct-p2p-composition.spec.js"
  ]);
  for (const relativePath of namedSpecs) {
    assert.equal(fs.statSync(path.join(siteRoot, relativePath)).isFile(), true, relativePath);
  }
});

test("PowerShell and Bash browser-smoke gates invoke the same acquisition command", () => {
  const powershell = fs.readFileSync(
    path.join(repositoryRoot, "eng", "verify-tinyrustlm-ui.ps1"), "utf8");
  const bash = fs.readFileSync(
    path.join(repositoryRoot, "eng", "verify-tinyrustlm-ui.sh"), "utf8");

  for (const [name, source] of [["PowerShell", powershell], ["Bash", bash]]) {
    assert.match(source, /tools\/verify-ui\.js/u, name);
    assert.match(source, /--browser/u, name);
    assert.match(source, /--deep/u, name);
  }
  const owner = fs.readFileSync(path.join(siteRoot, "tools/verify-ui.js"), "utf8");
  assert.equal((owner.match(/packageArguments\("test:e2e:acquisition"\)/gu) || []).length, 1);
  assert.match(owner, /currentGate = "acquisition_playwright"/u);
});

test("runbook keeps acquisition browser contracts separate from live evidence", () => {
  const runbook = fs.readFileSync(
    path.join(siteRoot, "docs", "interview-demo.md"), "utf8");

  assert.match(runbook, /npm --prefix \.\\tinyrustlm run test:e2e:acquisition/u);
  assert.match(runbook, /`acquisition_playwright` gate/u);
  assert.match(runbook,
    /direct-P2P spec advertises signed public-IP URL fixtures,\s+then a test-only fetch bridge maps those fixture requests to an owned loopback\s+peer/u);
  assert.match(runbook, /does not contact or prove either advertised public IP/u);
  assert.match(runbook, /do not\s+run the synthetic\s+interview walkthrough/u);
  assert.match(runbook,
    /do not\s+run the synthetic\s+interview walkthrough, inspect or qualify a real composition/u);
});
