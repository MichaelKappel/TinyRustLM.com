"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const [targetRoot, mode, ...argumentsList] = process.argv.slice(2);

function target(relativePath) {
  return path.join(targetRoot, ...relativePath.split("/"));
}

function write(relativePath, bytes) {
  const outputPath = target(relativePath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, bytes, { flag: "wx" });
}

switch (mode) {
  case "success":
    process.stdout.write("fixture-stdout");
    process.stderr.write("fixture-stderr");
    write("artifact.bin", Buffer.from("custodied-build-output", "utf8"));
    break;
  case "nonzero":
    process.stderr.write("registered-build-failure");
    process.exitCode = 23;
    break;
  case "stdout-overflow":
    process.stdout.write(Buffer.alloc(Number(argumentsList[0]), 0x61));
    break;
  case "environment":
    {
      const entries = Object.entries(process.env)
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
    write("environment.json", Buffer.from(
      `${JSON.stringify({ names: entries.map(([name]) => name),
        values: Object.fromEntries(entries) })}\n`, "utf8"));
    }
    break;
  case "copy-pe":
    fs.copyFileSync(argumentsList[0], target("artifact.exe"), fs.constants.COPYFILE_EXCL);
    break;
  case "delayed-success":
    setTimeout(() => {
      write("artifact.bin", Buffer.from("detached-owner-completed", "utf8"));
    }, Number(argumentsList[0]));
    break;
  case "timeout-tree": {
    const markerPath = argumentsList[0];
    childProcess.spawn(process.execPath,
      [__filename, targetRoot, "grandchild-marker", markerPath, argumentsList[1]], {
        env: process.env,
        shell: false,
        stdio: "ignore",
        windowsHide: true
      });
    setInterval(() => {}, 1000);
    break;
  }
  case "grandchild-marker":
    setTimeout(() => {
      fs.writeFileSync(argumentsList[0], "survived", { flag: "wx" });
    }, Number(argumentsList[1]));
    break;
  case "many-entries":
    for (let index = 0; index < Number(argumentsList[0]); index += 1) {
      fs.mkdirSync(target(`entry-${String(index).padStart(3, "0")}`));
    }
    break;
  case "missing-output":
    break;
  default:
    throw new Error("build-custody-fixture-mode-invalid");
}
