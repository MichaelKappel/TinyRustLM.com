"use strict";
// Protocol-only child fixture. It never loads a native library or model and cannot qualify one.
const readline = require("node:readline");
const { parseRequest } = require("../../tools/prompt2-reference.js");
const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
let plan, index = 0;
const cases = [];

/** Emit bytes through real child pipes, including a split UTF-8 code point. */
function emit(value) {
  const bytes = Buffer.from(JSON.stringify(value) + "\n");
  const split = bytes.indexOf(Buffer.from("🦀")) + 1;
  if (split > 0) { process.stdout.write(bytes.subarray(0, split)); process.stdout.write(bytes.subarray(split)); }
  else process.stdout.write(bytes);
}

lines.on("line", (line) => {
  const value = JSON.parse(line);
  if (!plan) {
    plan = value;
    if (process.env.TINYRUSTLM_PROBE_FIXTURE_MODE === "early") { process.exitCode = 1; lines.close(); process.stdin.destroy(); return; }
    emit({ kind: "ready" }); return;
  }
  const item = plan.cases[index++];
  emit({ kind: "case-started", id: item.id });
  if (process.env.TINYRUSTLM_PROBE_FIXTURE_MODE === "timeout") return;
  if (process.env.TINYRUSTLM_PROBE_FIXTURE_MODE === "stderr-limit") { process.stderr.write(Buffer.alloc(65537, 120)); return; }
  if (process.env.TINYRUSTLM_PROBE_FIXTURE_MODE === "malformed") { process.stdout.write("not json\n"); return; }
  const wire = parseRequest(Buffer.from(value.requestBase64, "base64"));
  const failure = process.env.TINYRUSTLM_PROBE_FIXTURE_MODE === "failure";
  const capture = { id: item.id, status: failure ? "failed" : "captured", errorCode: failure ? "fixture-failed" : null,
    output: failure ? null : { text: index === 1 ? "raw\nNóra 🦀" : wire.messages[1].content,
      tokenIds: [4], status: { kind: "stop-token" } } };
  cases.push(capture); emit({ kind: "case", value: capture });
  if (failure || index === plan.cases.length) {
    emit({ kind: "terminal", value: { schema: "fixture-only", status: failure ? "failed" : "captured",
      modelQualified: false, activations: [], cases } });
    process.exitCode = failure ? 1 : 0; lines.close(); process.stdin.destroy();
  }
});
