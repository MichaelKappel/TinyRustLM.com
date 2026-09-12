"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const appPath = path.join(root, "app", "app.js");
const indexPath = path.join(root, "app", "index.html");
const apacheRulesPath = path.join(root, ".htaccess");

test("browser starts without a built-in product model or model-byte route", () => {
  const app = fs.readFileSync(appPath, "utf8");
  const html = fs.readFileSync(indexPath, "utf8");
  const rejectedBuiltIns = [
    "qwen25q4",
    "smollm2q4",
    "smollm2q8",
    "tinylm16f32",
    "tinylm16q8",
    "tinylm16q4",
    "../models/tinylm16",
    "../models/smollm2"
  ];

  assert.match(app, /models:\s*Object\.create\(null\)/);
  assert.doesNotMatch(app, /const initialModels = paths\.models/);
  assert.match(app, /choose a local or P2P composition/i);
  assert.doesNotMatch(app, /choose a local or P2P \.slm/i);
  assert.match(
    html,
    /<option value="" selected disabled>Choose a local or P2P model<\/option>/
  );
  assert.match(
    html,
    /<input id="localModelFile" type="file" accept="\.slm2,\.tokenizer2,\.template2,\.sampling2,\.prompt2,\.acg2,[^"]+" multiple>/
  );
  for (const value of rejectedBuiltIns) {
    assert.doesNotMatch(app, new RegExp(value, "i"));
    assert.doesNotMatch(html, new RegExp(value, "i"));
  }
  assert.doesNotMatch(app, /publicHosted:\s*true/);
  assert.doesNotMatch(app, /defaultDemoModelUrl/);
  assert.doesNotMatch(app, /autoLoadDefaultMiniModelDemo/);
  assert.doesNotMatch(app, /artifactProjectServerUrl/);
});

test("public site configuration returns 404 for every slm route", () => {
  const apacheRules = fs.readFileSync(apacheRulesPath, "utf8");
  assert.match(apacheRules, /RewriteRule \(\^\|\/\)\.\*\\\.slm\$ - \[R=404,L,NC\]/);
});

test("browser binds the admitted Sampling2 repetition penalty into Prompt2", () => {
  const app = fs.readFileSync(appPath, "utf8");

  assert.match(app, /const defaults = admission\.runtime\.defaultSampling/);
  assert.match(
    app,
    /repetitionPenaltyMillionths:\s*defaults\.repetitionPenaltyMillionths/
  );
  assert.match(app, /sampling:\s*prompt2Sampling\(admission\)/);
  assert.doesNotMatch(app, /set_sampling_config_v2/);
  assert.doesNotMatch(app, /state\.exports/);
});
