"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "../..");
const outputPath = path.join(
  repositoryRoot,
  "contracts/vnext/template2-source-oracle-environment-lock.v1.json"
);
const packageRoots = Object.freeze([
  "Lib/site-packages/jinja2",
  "Lib/site-packages/jinja2-3.1.6.dist-info",
  "Lib/site-packages/markupsafe",
  "Lib/site-packages/markupsafe-3.0.3.dist-info"
]);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function regularDirectFile(filePath, maximumBytes, code) {
  let stat;
  let real;
  try {
    stat = fs.lstatSync(filePath);
    real = fs.realpathSync.native(filePath);
  } catch {
    fail(code);
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maximumBytes ||
      path.normalize(real).toLowerCase() !==
        path.normalize(filePath).toLowerCase()) {
    fail(code);
  }
  return stat;
}

function directDirectory(directoryPath, code) {
  let stat;
  let real;
  try {
    stat = fs.lstatSync(directoryPath);
    real = fs.realpathSync.native(directoryPath);
  } catch {
    fail(code);
  }
  if (!stat.isDirectory() || stat.isSymbolicLink() ||
      path.normalize(real).toLowerCase() !== path.normalize(directoryPath).toLowerCase()) {
    fail(code);
  }
}

function normalizeEnvironmentRoot(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 4096 ||
      value.includes("\0") || !path.isAbsolute(value)) {
    fail("template2-environment-root-invalid");
  }
  const normalized = path.normalize(value);
  if (normalized !== path.resolve(value)) fail("template2-environment-root-invalid");
  directDirectory(normalized, "template2-environment-root-invalid");
  return normalized;
}

function baseExecutable(environmentRoot) {
  const configPath = path.join(environmentRoot, "pyvenv.cfg");
  regularDirectFile(configPath, 64 * 1024, "template2-environment-config-invalid");
  const text = fs.readFileSync(configPath, "utf8");
  const homes = text.split(/\r?\n/u)
    .map((line) => line.match(/^home\s*=\s*(.+)$/u))
    .filter(Boolean);
  if (homes.length !== 1 || !path.isAbsolute(homes[0][1])) {
    fail("template2-environment-config-invalid");
  }
  const executable = path.join(homes[0][1], "python.exe");
  regularDirectFile(executable, 16 * 1024 * 1024, "template2-environment-python-invalid");
  return executable;
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function walkFiles(environmentRoot, relativeRoot) {
  const root = path.join(environmentRoot, ...relativeRoot.split("/"));
  directDirectory(root, "template2-environment-package-invalid");
  const pending = [root];
  const files = [];
  while (pending.length > 0) {
    const current = pending.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true })
      .sort((left, right) => compareUtf8(left.name, right.name));
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      const stat = fs.lstatSync(entryPath);
      if (entry.isSymbolicLink() || stat.isSymbolicLink()) {
        fail("template2-environment-package-link");
      }
      if (entry.isDirectory()) {
        if (entry.name !== "__pycache__") pending.push(entryPath);
      } else if (entry.isFile() && path.extname(entry.name).toLowerCase() !== ".pyc") {
        regularDirectFile(entryPath, 32 * 1024 * 1024, "template2-environment-package-invalid");
        const relative = path.relative(environmentRoot, entryPath).split(path.sep).join("/");
        const bytes = fs.readFileSync(entryPath);
        files.push(Object.freeze({
          path: relative,
          byteLength: bytes.length,
          sha256: sha256(bytes)
        }));
      }
    }
  }
  return files;
}

function closureSha256(files) {
  const hash = crypto.createHash("sha256");
  for (const file of files) {
    hash.update(file.path, "utf8");
    hash.update(Buffer.from([0]));
    hash.update(String(file.byteLength), "ascii");
    hash.update(Buffer.from([0]));
    hash.update(file.sha256, "ascii");
    hash.update(Buffer.from([0x0a]));
  }
  return hash.digest("hex");
}

function renderLock(environmentRoot) {
  const launcherPath = path.join(environmentRoot, "Scripts/python.exe");
  const launcher = regularDirectFile(
    launcherPath,
    16 * 1024 * 1024,
    "template2-environment-python-invalid"
  );
  const basePath = baseExecutable(environmentRoot);
  const base = fs.statSync(basePath);
  const files = packageRoots.flatMap((relativeRoot) => walkFiles(environmentRoot, relativeRoot))
    .sort((left, right) => compareUtf8(left.path, right.path));
  if (files.length !== 44 || new Set(files.map((file) => file.path)).size !== files.length) {
    fail("template2-environment-package-inventory-invalid");
  }
  const document = {
    schema: "tinyrustlm.template2_source_oracle_environment_lock.v1",
    profileId: "tinyrustlm.template2-source-oracle-python/1",
    platform: "win-x64",
    pythonVersion: "3.12.10",
    launcher: {
      relativePath: "Scripts/python.exe",
      byteLength: launcher.size,
      sha256: sha256(fs.readFileSync(launcherPath))
    },
    baseInterpreter: {
      basename: "python.exe",
      byteLength: base.size,
      sha256: sha256(fs.readFileSync(basePath))
    },
    packages: [
      { name: "Jinja2", version: "3.1.6" },
      { name: "MarkupSafe", version: "3.0.3" }
    ],
    packageRoots,
    exclusions: [
      "__pycache__-directories",
      "pyc-files"
    ],
    execution: {
      isolatedMode: true,
      bytecodeWrites: false,
      dedicatedEmptyPycachePrefix: true,
      networkAllowed: false,
      childProcessAllowed: false
    },
    sourceClosureSha256: closureSha256(files),
    fileCount: files.length,
    files
  };
  return Buffer.from(`${JSON.stringify(document, null, 2)}\n`, "utf8");
}

function main() {
  const [operation, rawEnvironmentRoot, ...extra] = process.argv.slice(2);
  if ((operation !== "--write" && operation !== "--check") ||
      rawEnvironmentRoot === undefined || extra.length !== 0) {
    fail("template2-environment-arguments-invalid");
  }
  const environmentRoot = normalizeEnvironmentRoot(rawEnvironmentRoot);
  const rendered = renderLock(environmentRoot);
  if (operation === "--write") {
    fs.writeFileSync(outputPath, rendered, { flag: "w" });
    process.stdout.write(`${JSON.stringify({
      status: "written",
      byteLength: rendered.length,
      sha256: sha256(rendered)
    })}\n`);
  } else {
    if (!fs.readFileSync(outputPath).equals(rendered)) {
      fail("template2-environment-lock-drift");
    }
    process.stdout.write(`${JSON.stringify({
      status: "pass",
      byteLength: rendered.length,
      sha256: sha256(rendered)
    })}\n`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error?.code || "template2-environment-failed"}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({ renderLock });
