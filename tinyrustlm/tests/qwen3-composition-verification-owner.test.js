"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  bindingSchema,
  canonicalJson,
  canonicalWindowsPath,
  createManagedInspectionIntent,
  deriveDecision,
  executePrepared,
  finalVerificationSchema,
  inspectCanonicalJsonBytes,
  processTerminalSchema,
  requestSchema,
  runCapturedProcess,
  sha256File,
  startSchema,
  validateRequestShape,
  verifyEvidenceInventory,
  writeNewDurable
} = require("../tools/qwen3-composition-verification-owner.js");

const digest = (character) => character.repeat(64);
const commit = (character) => character.repeat(40);

function fixtureRequest(root = path.resolve("C:\\private")) {
  const repositoryRoot = path.resolve("C:\\repo");
  const evidenceRoot = path.join(root, "evidence");
  const outputRoot = path.join(root, "output");
  const managedRoot = path.join(root, "managed-build");
  const converterPath = path.join(root, "rust-build", "tinyrustlm-convert.exe");
  const inspectorAssemblyPath = path.join(
    managedRoot,
    "TinyRustLM.CompositionInspector.dll"
  );
  return {
    schema: requestSchema,
    executionId: "qwen3-composition-verification-test",
    registration: {
      repositoryRoot,
      profilePath: path.join(repositoryRoot, "contracts", "registration.json"),
      profileByteLength: 1,
      profileSha256: digest("a"),
      profileId: "tinyrustlm.qwen3-real-composition-execution/10",
      commit: commit("b"),
      tree: commit("c"),
      branch: "codex/model-acquisition-v2",
      ownerProfilePath: path.join(repositoryRoot, "contracts", "owner-profile.json"),
      ownerProfileByteLength: 1,
      ownerProfileSha256: digest("c"),
      ownerProfileId: "tinyrustlm.qwen3-composition-verification-owner/1",
      ownerPath: path.join(repositoryRoot, "tinyrustlm", "tools", "owner.js"),
      ownerByteLength: 1,
      ownerSha256: digest("d"),
      ownerRuntimePath: path.join(root, "node.exe"),
      ownerRuntimeByteLength: 1,
      ownerRuntimeSha256: digest("e"),
      ownerRuntimeVersion: "v24.0.0",
      ownerRuntimePlatform: "win32",
      ownerRuntimeArchitecture: "x64",
      terminationToolPath: path.join(root, "taskkill.exe"),
      terminationToolByteLength: 1,
      terminationToolSha256: digest("f")
    },
    custody: {
      rust: {
        summaryPath: path.join(root, "rust-custody", "summary.json"),
        summaryByteLength: 1,
        summarySha256: digest("0"),
        summarySchema: "tinyrustlm.build-custody-summary.v4",
        operationId: "qwen3-composition-rust-build",
        sourceCommit: commit("b"),
        sourceTree: commit("c"),
        executablePath: converterPath,
        executableByteLength: 1,
        executableSha256: digest("1"),
        executablePeMachine: "0x8664"
      },
      managed: {
        summaryPath: path.join(root, "managed-custody", "summary.json"),
        summaryByteLength: 1,
        summarySha256: digest("2"),
        summarySchema: "tinyrustlm.build-custody-summary.v4",
        operationId: "qwen3-composition-managed-build",
        sourceCommit: commit("b"),
        sourceTree: commit("c"),
        runtimePath: path.join(root, "dotnet.exe"),
        runtimeByteLength: 1,
        runtimeSha256: digest("3"),
        runtimeVersion: "10.0.11",
        inspectorAssemblyPath,
        inspectorAssemblyByteLength: 1,
        inspectorAssemblySha256: digest("4"),
        outputInventory: [
          {
            path: path.join(managedRoot, "TinyRustLM.CompositionInspector.deps.json"),
            byteLength: 1,
            sha256: digest("5")
          },
          {
            path: inspectorAssemblyPath,
            byteLength: 1,
            sha256: digest("4")
          },
          {
            path: path.join(managedRoot,
              "TinyRustLM.CompositionInspector.runtimeconfig.json"),
            byteLength: 1,
            sha256: digest("6")
          },
          {
            path: path.join(managedRoot, "TinyRustLM.Conversion.dll"),
            byteLength: 1,
            sha256: digest("7")
          },
          {
            path: path.join(managedRoot, "tinyrustlm-build-scratch-inspect.exe"),
            byteLength: 1,
            sha256: digest("8")
          }
        ]
      }
    },
    inputs: {
      modelSourceLockPath: path.join(repositoryRoot, "contracts", "model-lock.json"),
      modelSourceLockSha256: digest("9"),
      modelSourceDirectory: path.join(root, "model-source"),
      tokenizerSourceLockPath: path.join(repositoryRoot, "contracts", "tokenizer-lock.json"),
      tokenizerSourceLockSha256: digest("a"),
      tokenizerSourceDirectory: path.join(root, "tokenizer-source"),
      compositionProfilePath: path.join(repositoryRoot, "contracts", "composition.json"),
      compositionProfileSha256: digest("b")
    },
    invocation: {
      evidenceRoot,
      outputRoot,
      workingDirectory: repositoryRoot,
      converterArguments: [
        "qwen3-composition",
        path.join(repositoryRoot, "contracts", "model-lock.json"),
        path.join(root, "model-source"),
        path.join(repositoryRoot, "contracts", "tokenizer-lock.json"),
        path.join(root, "tokenizer-source"),
        outputRoot
      ],
      managedArgumentsPrefix: [inspectorAssemblyPath, "inspect"],
      converterMaximumDurationMilliseconds: 1_000,
      converterMaximumStdoutBytes: 65_536,
      converterMaximumStderrBytes: 4_096,
      managedMaximumDurationMilliseconds: 1_000,
      managedMaximumStdoutBytes: 1_048_576,
      managedMaximumStderrBytes: 65_536,
      maximumOutputFiles: 10,
      maximumOutputAggregateBytes: 1_073_741_824,
      compositionTerminalRule: "existing-output-root-is-never-resumed",
      operationTerminalRule:
        "existing-evidence-or-output-root-is-terminal-and-never-resumed"
    }
  };
}

test("exports one incompatible sole-owner schema family", () => {
  assert.equal(requestSchema,
    "tinyrustlm.qwen3-composition-verification-request.v1");
  assert.equal(bindingSchema,
    "tinyrustlm.qwen3-composition-verification-binding.v1");
  assert.equal(startSchema,
    "tinyrustlm.qwen3-composition-verification-start.v1");
  assert.equal(processTerminalSchema,
    "tinyrustlm.qwen3-composition-verification-process-terminal.v1");
  assert.equal(finalVerificationSchema,
    "tinyrustlm.qwen3-composition-execution-verification.v6");
});

test("accepts only one ordered closed request with converter and inspector custody", () => {
  const request = fixtureRequest();
  assert.doesNotThrow(() => validateRequestShape(request));

  const extended = structuredClone(request);
  extended.retry = true;
  assert.throws(() => validateRequestShape(extended), /verification-request-fields/u);

  const reordered = {
    executionId: request.executionId,
    schema: request.schema,
    registration: request.registration,
    custody: request.custody,
    inputs: request.inputs,
    invocation: request.invocation
  };
  assert.throws(() => validateRequestShape(reordered), /verification-request-fields/u);

  const missingInspector = structuredClone(request);
  missingInspector.custody.managed.outputInventory.splice(3, 1);
  assert.throws(() => validateRequestShape(missingInspector),
    /verification-managed-inventory-names/u);

  const repair = structuredClone(request);
  repair.invocation.repair = true;
  assert.throws(() => validateRequestShape(repair), /verification-invocation-fields/u);
});

test("canonicalizes every child path to exact native Windows spelling", () => {
  assert.equal(canonicalWindowsPath("C:/private/evidence/managed-inspection.intent.json"),
    "C:\\private\\evidence\\managed-inspection.intent.json");
  assert.equal(canonicalWindowsPath("c:\\private\\..\\private\\intent.json"),
    "C:\\private\\intent.json");
  assert.throws(() => canonicalWindowsPath("relative/intent.json"),
    /verification-child-path/u);
  assert.throws(() => canonicalWindowsPath("\\\\server\\share\\intent.json"),
    /verification-child-path/u);
});

test("creates the managed intent from owner-observed identities, never caller JSON", () => {
  const request = fixtureRequest();
  const intent = createManagedInspectionIntent(request);
  assert.deepEqual(Object.keys(intent), [
    "schema",
    "modelSourceLockPath",
    "modelSourceLockSha256",
    "modelSourceDirectory",
    "tokenizerSourceLockPath",
    "tokenizerSourceLockSha256",
    "tokenizerSourceDirectory",
    "compositionProfileSha256",
    "outputRoot",
    "converterExecutablePath",
    "converterExecutableSha256",
    "maximumDurationMilliseconds",
    "maximumSummaryBytes",
    "maximumErrorBytes",
    "terminalRule"
  ]);
  assert.equal(intent.schema, "tinyrustlm.qwen3-composition-conversion-intent.v1");
  assert.equal(intent.outputRoot, canonicalWindowsPath(request.invocation.outputRoot));
  assert.equal(intent.converterExecutablePath,
    canonicalWindowsPath(request.custody.rust.executablePath));
  assert.equal(intent.maximumDurationMilliseconds,
    request.invocation.converterMaximumDurationMilliseconds);
  assert.equal(intent.maximumSummaryBytes,
    request.invocation.converterMaximumStdoutBytes);
  assert.equal(intent.maximumErrorBytes,
    request.invocation.converterMaximumStderrBytes);
  assert.equal(intent.terminalRule, "existing-output-root-is-never-resumed");
  assert.equal(canonicalJson(intent), `${JSON.stringify(intent, null, 2)}\n`);
});

test("writes create-only durable evidence and refuses overwrite", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-verification-write-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const target = path.join(root, "operation.binding.json");
  const bytes = Buffer.from(canonicalJson({ schema: bindingSchema }), "utf8");

  writeNewDurable(target, bytes, 4_096);

  assert.deepEqual(fs.readFileSync(target), bytes);
  assert.throws(() => writeNewDurable(target, bytes, 4_096), /EEXIST/u);
});

test("captures exact separate child streams before launch and reports identity", async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-verification-process-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const script = path.join(root, "fixture.js");
  const stdoutPath = path.join(root, "stdout.bin");
  const stderrPath = path.join(root, "stderr.bin");
  fs.writeFileSync(script,
    "process.stdout.write(Buffer.from([0, 65, 10])); process.stderr.write('note');\n");

  const result = await runCapturedProcess(process.execPath, [script], {
    stage: "converter",
    workingDirectory: root,
    stdoutPath,
    stderrPath,
    maximumDurationMilliseconds: 30_000,
    maximumStdoutBytes: 16,
    maximumStderrBytes: 16
  });

  assert.equal(result.stage, "converter");
  assert.equal(result.processStarted, true);
  assert.equal(result.exitCode, 0);
  assert.equal(result.signal, null);
  assert.equal(result.timedOut, false);
  assert.equal(result.killedForOverflow, false);
  assert.deepEqual(fs.readFileSync(stdoutPath), Buffer.from([0, 65, 10]));
  assert.deepEqual(fs.readFileSync(stderrPath), Buffer.from("note"));
  assert.deepEqual({ byteLength: result.stdout.byteLength, sha256: result.stdout.sha256 },
    sha256File(stdoutPath, 17, true));
  assert.deepEqual({ byteLength: result.stderr.byteLength, sha256: result.stderr.sha256 },
    sha256File(stderrPath, 17, true));
  assert.equal(result.stdout.overflow, false);
  assert.equal(result.stderr.overflow, false);
});

test("terminates only the owned child when a raw stream exceeds its bound", async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-verification-overflow-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const script = path.join(root, "overflow.js");
  const stdoutPath = path.join(root, "stdout.bin");
  const stderrPath = path.join(root, "stderr.bin");
  fs.writeFileSync(script,
    "process.stdout.write('x'.repeat(4096)); setTimeout(() => {}, 30000);\n");

  const result = await runCapturedProcess(process.execPath, [script], {
    stage: "converter",
    workingDirectory: root,
    stdoutPath,
    stderrPath,
    maximumDurationMilliseconds: 30_000,
    maximumStdoutBytes: 32,
    maximumStderrBytes: 32
  });

  assert.equal(result.processStarted, true);
  assert.equal(result.killedForOverflow, true);
  assert.equal(result.stdout.overflow, true);
  assert.equal(result.stdout.byteLength, 33);
  assert.equal(fs.lstatSync(stdoutPath).size, 33);
  assert.equal(result.termination.requested, true);
  assert.equal(result.termination.method, "direct-child-termination");
});

test("rejects noncanonical, non-object, and trailing JSON bytes", () => {
  const value = { schema: "test", status: "pass" };
  const canonical = Buffer.from(canonicalJson(value), "utf8");
  assert.deepEqual(inspectCanonicalJsonBytes(canonical, 4_096,
    "verification-json"), value);
  assert.throws(() => inspectCanonicalJsonBytes(
    Buffer.from(JSON.stringify(value), "utf8"), 4_096, "verification-json"),
  /verification-json/u);
  assert.throws(() => inspectCanonicalJsonBytes(Buffer.from("[]\n", "utf8"),
    4_096, "verification-json"), /verification-json/u);
  assert.throws(() => inspectCanonicalJsonBytes(Buffer.concat([canonical,
    Buffer.from("x")]), 4_096, "verification-json"), /verification-json/u);
});

test("rehashes a closed evidence inventory and detects missing or changed bytes", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-verification-inventory-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const names = ["converter.stdout.bin", "converter.stderr.bin"];
  fs.writeFileSync(path.join(root, names[0]), Buffer.from("ok\n"));
  fs.writeFileSync(path.join(root, names[1]), Buffer.alloc(0));
  const expected = names.map((file) => ({
    file,
    ...sha256File(path.join(root, file), 4_096, true)
  }));

  assert.deepEqual(verifyEvidenceInventory(root, expected), expected);
  fs.appendFileSync(path.join(root, names[0]), "drift");
  assert.throws(() => verifyEvidenceInventory(root, expected),
    /verification-evidence-identity/u);
  fs.writeFileSync(path.join(root, names[0]), Buffer.from("ok\n"));
  fs.rmSync(path.join(root, names[1]));
  assert.throws(() => verifyEvidenceInventory(root, expected),
    /verification-evidence-file/u);
});

test("streams multi-megabyte hashes without text decoding", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-verification-hash-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const target = path.join(root, "candidate.bin");
  const bytes = Buffer.alloc(3 * 1024 * 1024 + 17, 0xa5);
  fs.writeFileSync(target, bytes);
  assert.deepEqual(sha256File(target, bytes.length, false), {
    byteLength: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex")
  });
});

test("owns converter, managed inspection, and final verification end to end", async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-verification-owner-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const request = fixtureRequest(root);
  const exactExecutable = path.resolve(process.env.SystemRoot,
    "System32", "taskkill.exe");
  const executableIdentity = sha256File(exactExecutable);
  request.custody.rust.executablePath = exactExecutable;
  request.custody.rust.executableByteLength = executableIdentity.byteLength;
  request.custody.rust.executableSha256 = executableIdentity.sha256;
  request.custody.managed.runtimePath = exactExecutable;
  request.custody.managed.runtimeByteLength = executableIdentity.byteLength;
  request.custody.managed.runtimeSha256 = executableIdentity.sha256;
  request.registration.terminationToolPath = exactExecutable;
  request.registration.terminationToolByteLength = executableIdentity.byteLength;
  request.registration.terminationToolSha256 = executableIdentity.sha256;
  const managedRoot = path.join(root, "managed-build");
  fs.mkdirSync(managedRoot);
  const inspectorPath = path.join(managedRoot, "TinyRustLM.CompositionInspector.dll");
  fs.writeFileSync(inspectorPath, "inspector");
  const inspectorIdentity = sha256File(inspectorPath);
  request.custody.managed.inspectorAssemblyPath = inspectorPath;
  request.custody.managed.inspectorAssemblyByteLength = inspectorIdentity.byteLength;
  request.custody.managed.inspectorAssemblySha256 = inspectorIdentity.sha256;
  request.invocation.managedArgumentsPrefix = [inspectorPath, "inspect"];
  request.custody.managed.outputInventory = [
    "TinyRustLM.CompositionInspector.deps.json",
    "TinyRustLM.CompositionInspector.dll",
    "TinyRustLM.CompositionInspector.runtimeconfig.json",
    "TinyRustLM.Conversion.dll",
    "tinyrustlm-build-scratch-inspect.exe"
  ].map((name) => {
    const target = path.join(managedRoot, name);
    if (!fs.existsSync(target)) fs.writeFileSync(target, name);
    return { path: target, ...sha256File(target) };
  });
  request.invocation.evidenceRoot = path.join(root, "evidence");
  request.invocation.outputRoot = path.join(root, "output");
  request.invocation.converterArguments = [
    "qwen3-composition",
    request.inputs.modelSourceLockPath,
    request.inputs.modelSourceDirectory,
    request.inputs.tokenizerSourceLockPath,
    request.inputs.tokenizerSourceDirectory,
    request.invocation.outputRoot
  ];
  const requestBytes = Buffer.from(canonicalJson(request), "utf8");
  const prepared = {
    request,
    requestDocument: {
      artifact: {
        byteLength: requestBytes.length,
        sha256: crypto.createHash("sha256").update(requestBytes).digest("hex")
      }
    },
    bindingBytes: Buffer.from(canonicalJson({
      schema: bindingSchema,
      executionId: request.executionId
    }), "utf8")
  };
  const outputContents = new Map([
    ["composition.acg2", "composition"],
    ["composition.attempt.json", "attempt"],
    ["composition.conversion-receipt.json", "receipt"],
    ["model.slm2", "model"],
    ["model.slm2.conversion-receipt.json", "model receipt"],
    ["prompt.prompt2", "prompt"],
    ["sampling.sampling2", "sampling"],
    ["template.template2", "template"],
    ["tokenizer.tokenizer2", "tokenizer"],
    ["tokenizer.tokenizer2.conversion-receipt.json", "tokenizer receipt"]
  ]);
  const graphIdentitySha256 = digest("c");
  const operationId = "qwen3-composition-unit";
  const processOutcome = (stage, stdoutPath, stderrPath) => ({
    stage,
    startedAtUtc: "2026-08-25T00:00:00.000Z",
    finishedAtUtc: "2026-08-25T00:00:01.000Z",
    durationMilliseconds: 1000,
    processStarted: true,
    processIdObserved: true,
    exitCode: 0,
    signal: null,
    timedOut: false,
    killedForOverflow: false,
    spawnCode: null,
    termination: {
      requested: false,
      method: null,
      toolExitCode: null,
      stdout: null,
      stderr: null
    },
    stdout: { ...sha256File(stdoutPath, 1_048_577, true), overflow: false },
    stderr: { ...sha256File(stderrPath, 65_537, true), overflow: false }
  });
  const runProcess = async (_executable, argumentsList, options) => {
    assert.equal(fs.existsSync(options.stdoutPath), false);
    assert.equal(fs.existsSync(options.stderrPath), false);
    if (options.stage === "converter") {
      fs.mkdirSync(request.invocation.outputRoot);
      for (const [name, contents] of outputContents) {
        fs.writeFileSync(path.join(request.invocation.outputRoot, name), contents,
          { flag: "wx" });
      }
      const artifacts = [
        ["model", "model.slm2"],
        ["tokenizer", "tokenizer.tokenizer2"],
        ["template", "template.template2"],
        ["sampling", "sampling.sampling2"],
        ["prompt", "prompt.prompt2"],
        ["composition", "composition.acg2"]
      ].map(([kind, file]) => ({
        byteLength: fs.lstatSync(path.join(request.invocation.outputRoot, file)).size,
        file,
        kind,
        sha256: sha256File(path.join(request.invocation.outputRoot, file)).sha256
      }));
      const summary = {
        artifacts,
        graphIdentitySha256,
        operationId,
        outputDirectory: path.basename(request.invocation.outputRoot),
        receiptFile: "composition.conversion-receipt.json",
        requiredNextGate:
          "source-native-browser-numerical-parity-untouched-quality-and-product-chat",
        schema: "tinyrustlm.qwen3_composition_conversion_cli_summary.v1",
        status: "pass"
      };
      fs.writeFileSync(options.stdoutPath, canonicalJson(summary), { flag: "wx" });
      fs.writeFileSync(options.stderrPath, Buffer.alloc(0), { flag: "wx" });
      return processOutcome(options.stage, options.stdoutPath, options.stderrPath);
    }
    assert.equal(options.stage, "managed-inspection");
    assert.equal(argumentsList.length, 3);
    assert.equal(argumentsList[0], canonicalWindowsPath(inspectorPath));
    assert.equal(argumentsList[1], "inspect");
    assert.equal(argumentsList[2], canonicalWindowsPath(path.join(
      request.invocation.evidenceRoot, "managed-inspection.intent.json")));
    const outputByName = new Map([...outputContents.keys()].map((file) =>
      [file, sha256File(path.join(request.invocation.outputRoot, file))]));
    const artifact = (kind, fileName) => ({
      kind,
      fileName,
      path: canonicalWindowsPath(path.join(request.invocation.outputRoot, fileName)),
      byteLength: outputByName.get(fileName).byteLength,
      sha256: outputByName.get(fileName).sha256
    });
    const result = {
      schema: "tinyrustlm.qwen3-composition-managed-inspection.v1",
      status: "pass",
      composition: {
        schema: "tinyrustlm.verified-composition.v1",
        operationId,
        outputRoot: canonicalWindowsPath(request.invocation.outputRoot),
        receiptPath: canonicalWindowsPath(path.join(request.invocation.outputRoot,
          "composition.conversion-receipt.json")),
        receiptSha256: outputByName.get("composition.conversion-receipt.json").sha256,
        artifacts: {
          model: artifact("model", "model.slm2"),
          tokenizer: artifact("tokenizer", "tokenizer.tokenizer2"),
          template: artifact("template", "template.template2"),
          sampling: artifact("sampling", "sampling.sampling2"),
          prompt: artifact("prompt", "prompt.prompt2"),
          composition: artifact("composition", "composition.acg2")
        },
        graphIdentitySha256,
        modelSourceLockSha256: request.inputs.modelSourceLockSha256,
        tokenizerSourceLockSha256: request.inputs.tokenizerSourceLockSha256,
        converterVersion: "0.0.0-prelaunch",
        converterExecutableSha256: request.custody.rust.executableSha256,
        requiredNextGate:
          "source-native-browser-numerical-parity-untouched-quality-and-product-chat"
      },
      errorCode: null,
      operation: "read-only-no-converter-launch"
    };
    fs.writeFileSync(options.stdoutPath, canonicalJson(result), { flag: "wx" });
    fs.writeFileSync(options.stderrPath, Buffer.alloc(0), { flag: "wx" });
    return processOutcome(options.stage, options.stdoutPath, options.stderrPath);
  };

  const result = await executePrepared(prepared, { runCapturedProcess: runProcess });

  assert.equal(result.record.decision.status, "pass");
  assert.equal(result.record.decision.structuralCompositionVerified, true);
  assert.equal(result.record.evidence.length, 9);
  assert.equal(result.record.outputInventory.length, 10);
  assert.equal(deriveDecision(prepared).status, "pass");
  assert.deepEqual(fs.readdirSync(request.invocation.evidenceRoot).sort(), [
    "converter.process-terminal.json",
    "converter.stderr.bin",
    "converter.stdout.bin",
    "execution.verification.json",
    "managed-inspection.intent.json",
    "managed-inspection.process-terminal.json",
    "managed-inspection.stderr.bin",
    "managed-inspection.stdout.bin",
    "operation.binding.json",
    "operation.start.json"
  ]);
  const finalBefore = sha256File(path.join(request.invocation.evidenceRoot,
    "execution.verification.json"));
  await assert.rejects(() => executePrepared(prepared,
    { runCapturedProcess: runProcess }), /EEXIST/u);
  assert.deepEqual(sha256File(path.join(request.invocation.evidenceRoot,
    "execution.verification.json")), finalBefore);
});
