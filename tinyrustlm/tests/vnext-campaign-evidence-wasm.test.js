"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { chromium } = require("@playwright/test");
const { resolveCargoTargetRoot } = require("./helpers/cargo-target-root.js");
const {
  assertOwnedProfileFresh,
  createOwnedBrowserProfile,
  createOwnedProfileRoot,
  deleteOwnedBrowserProfile,
  removeOwnedProfileRoot
} = require("../tools/owned-browser-profile.js");
const {
  browserAdapterPath,
  interfaceProfilePath,
  loadInterfaceProfile,
  renderGeneratedBrowserAdapter,
  renderGeneratedRustExports,
  rustExportsPath,
  validateInterfaceProfile
} = require("../tools/vnext-campaign-evidence-wasm-codegen.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const draftPath = path.join(
  repositoryRoot,
  "contracts/vnext/campaign-plan-draft-parity-fixture.v1.json"
);
const planPath = path.join(
  repositoryRoot,
  "contracts/vnext/campaign-plan-parity-fixture.v1.json"
);
const phaseVectorsPath = path.join(
  repositoryRoot,
  "contracts/vnext/phase-invalidation-rust-vectors.v1.json"
);
const projectionVectorsPath = path.join(
  repositoryRoot,
  "contracts/vnext/campaign-projection-rust-vectors.v1.json"
);
const wasmPath = path.join(
  resolveCargoTargetRoot(repositoryRoot, process.env.CARGO_TARGET_DIR),
  "wasm32-unknown-unknown",
  "release",
  "tinyrustlm_evidence_wasm.wasm"
);
const boundaryDocumentPath = path.join(
  repositoryRoot,
  "docs/architecture/vnext-campaign-evidence-wasm-boundary.md"
);
const decisionPath = path.join(
  repositoryRoot,
  "docs/architecture/adr/ADR-011-campaign-evidence-browser-boundary.md"
);
const retiredPaths = [
  "contracts/vnext/campaign-plan-wasm-interface.v1.json",
  "docs/architecture/vnext-campaign-plan-wasm-boundary.md",
  "tinyrustlm/tests/vnext-campaign-plan-wasm.test.js",
  "tinyrustlm/tools/vnext-campaign-plan-wasm-codegen.js",
  "tinyrustlm/tools/generated/vnext-campaign-plan-wasm.js"
];

let compiledWasmBytes;

function cargoExecutable() {
  if (process.env.CARGO) return process.env.CARGO;
  const candidate = process.platform === "win32" && process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, ".cargo/bin/cargo.exe")
    : "cargo";
  return fs.existsSync(candidate) ? candidate : "cargo";
}

function buildWasm() {
  if (compiledWasmBytes) return compiledWasmBytes;
  const result = childProcess.spawnSync(cargoExecutable(), [
    "build",
    "-p",
    "tinyrustlm-evidence-wasm",
    "--release",
    "--target",
    "wasm32-unknown-unknown",
    "--locked",
    "--offline"
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
    windowsHide: true
  });
  assert.equal(result.error, undefined, `WASM build spawn failed: ${result.error?.code}`);
  assert.equal(result.status, 0, `WASM build failed:\n${result.stdout}\n${result.stderr}`);
  const profile = loadInterfaceProfile();
  const stat = fs.lstatSync(wasmPath);
  assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 &&
    stat.size <= profile.limits.maximumModuleBytes);
  compiledWasmBytes = fs.readFileSync(wasmPath);
  return compiledWasmBytes;
}

function toBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

function fromBase64(text) {
  return Buffer.from(text, "base64");
}

function moduleShape(bytes) {
  const module = new WebAssembly.Module(bytes);
  return {
    module,
    imports: WebAssembly.Module.imports(module),
    exports: WebAssembly.Module.exports(module)
  };
}

function projectionMetadataBytes(entry) {
  return Buffer.from(JSON.stringify({
    expectedCampaignId: entry.expectedCampaignId,
    expectedCampaignPlanSha256: entry.expectedCampaignPlanSha256,
    expectedEnvironment: entry.expectedEnvironment,
    expectedTerminalRegistryReceiptId: entry.expectedTerminalRegistryReceiptId,
    trustedRootRegistryReceiptId: entry.trustedRootRegistryReceiptId,
    verificationTimeUtc: entry.verificationTimeUtc
  }), "utf8");
}

function planBytes(vectors, entry) {
  const wire = vectors.planWires.find((candidate) => candidate.name === entry.planWireName);
  assert.ok(wire, `missing plan wire ${entry.planWireName}`);
  return fromBase64(wire.bytesBase64);
}

function projectionArguments(vectors, entry) {
  const receipts = new Map(vectors.receipts.map((value) => [
    value.receiptId,
    fromBase64(value.bytesBase64)
  ]));
  const subjects = new Map(vectors.subjects.map((value) => [
    value.subjectId,
    fromBase64(value.bytesBase64)
  ]));
  return {
    metadataBytes: projectionMetadataBytes(entry),
    campaignPlanBytes: planBytes(vectors, entry),
    receiptBytes: [
      ...entry.receiptIds.map((id) => receipts.get(id)),
      ...entry.receiptBytesBase64.map(fromBase64)
    ],
    subjectBytes: [
      ...entry.subjectIds.map((id) => subjects.get(id)),
      ...entry.subjectBytesBase64.map(fromBase64)
    ]
  };
}

function allocateAndWrite(instance, bytes) {
  const pointer = instance.exports.trlm_campaign_evidence_allocate(bytes.length) >>> 0;
  assert.notEqual(pointer, 0);
  new Uint8Array(instance.exports.memory.buffer, pointer, bytes.length).set(bytes);
  return pointer;
}

function release(instance, pointer, length) {
  assert.equal(
    instance.exports.trlm_campaign_evidence_release(pointer, length),
    loadInterfaceProfile().statusCodes.ok
  );
}

test("freezes one generated campaign-evidence WASM boundary and deletes the old profile", () => {
  const profile = loadInterfaceProfile();
  assert.equal(profile.schema, "tinyrustlm.vnext.campaign_evidence_wasm_interface.v1");
  assert.equal(profile.profileId, "tinyrustlm.vnext.campaign-evidence-wasm.v1");
  assert.equal(profile.abiVersion, 1);
  assert.deepEqual(profile.projectionMetadataFields, [
    "expectedCampaignId",
    "expectedCampaignPlanSha256",
    "expectedEnvironment",
    "expectedTerminalRegistryReceiptId",
    "trustedRootRegistryReceiptId",
    "verificationTimeUtc"
  ]);
  assert.equal(profile.limits.maximumTransferBytes, 4_194_304);
  assert.equal(profile.limits.maximumReceiptInputs, 2_048);
  assert.equal(profile.limits.maximumSubjectInputs, 2_048);
  assert.equal(
    crypto.createHash("sha256").update(fs.readFileSync(interfaceProfilePath)).digest("hex"),
    "173fed5fadd66f5ca56f57e5a9718f27bf03d8671c3d98047b5c9ec473a2071d"
  );
  assert.ok(Object.isFrozen(profile) && Object.isFrozen(profile.exports) &&
    Object.isFrozen(profile.requiredExports) && Object.isFrozen(profile.limits));
  assert.deepEqual(fs.readFileSync(rustExportsPath), renderGeneratedRustExports(profile));
  assert.deepEqual(fs.readFileSync(browserAdapterPath), renderGeneratedBrowserAdapter(profile));
  for (const retiredPath of retiredPaths) {
    assert.equal(fs.existsSync(path.join(repositoryRoot, retiredPath)), false, retiredPath);
  }

  const boundaryDocument = fs.readFileSync(boundaryDocumentPath, "utf8");
  const decision = fs.readFileSync(decisionPath, "utf8");
  for (const currentDocumentPath of [
    "contracts/vnext/README.md",
    "docs/architecture/vnext-campaign-plan-projection.md",
    "docs/architecture/vnext-contract-inventory.md",
    "docs/architecture/vnext-phase-invalidation.md",
    "docs/architecture/vnext-rust-campaign-plan-parity.md",
    "docs/architecture/vnext-rust-campaign-projection-parity.md",
    "docs/architecture/vnext-rust-offline-bundle-parity.md",
    "docs/architecture/vnext-rust-phase-invalidation-parity.md"
  ]) {
    const currentDocument = fs.readFileSync(
      path.join(repositoryRoot, currentDocumentPath),
      "utf8"
    );
    assert.match(currentDocument, /vnext-campaign-evidence-wasm-boundary\.md/u,
      currentDocumentPath);
  }
  assert.match(boundaryDocument,
    /173fed5fadd66f5ca56f57e5a9718f27bf03d8671c3d98047b5c9ec473a2071d/u);
  assert.match(boundaryDocument,
    /8f5bc4c025c6403865d5f3e93c50a824b44d110c9e4c3004cf03de6f755472ef/u);
  assert.match(boundaryDocument, /changes no production deployment-manifest member/u);
  assert.match(boundaryDocument,
    /Campaign counters remain 0\/20, 0\/50, 0\/25, 0\/40, and 0\/20/u);
  assert.match(decision, /Accepted and implemented at the current source checkpoint/u);
  assert.match(decision, /superseded plan-only profile is deleted/u);

  const accessor = { ...profile };
  Object.defineProperty(accessor, "schema", {
    enumerable: true,
    get() {
      throw new Error("accessor must not execute");
    }
  });
  assert.throws(
    () => validateInterfaceProfile(accessor),
    (error) => error?.code === "campaign_evidence_wasm_profile_invalid" &&
      /data property/u.test(error.message)
  );
});

test("builds an import-free module with bounded allocations and destructive stage failures", () => {
  const profile = loadInterfaceProfile();
  const shape = moduleShape(buildWasm());
  assert.deepEqual(shape.imports, profile.requiredImports);
  assert.deepEqual(shape.exports, profile.requiredExports);
  const instance = new WebAssembly.Instance(shape.module, {});
  const { exports } = instance;

  assert.equal(
    exports.trlm_phase_invalidation_begin(1, 8, 1),
    profile.statusCodes.boundaryError
  );
  assert.equal(exports.trlm_campaign_evidence_execute(), profile.statusCodes.boundaryError);
  assert.equal(exports.trlm_campaign_evidence_allocate(0) >>> 0, 0);
  assert.equal(
    exports.trlm_campaign_evidence_allocate(profile.limits.maximumTransferBytes + 1) >>> 0,
    0
  );

  const oneBytePointers = [];
  for (let index = 0; index < profile.limits.maximumLiveAllocations; index += 1) {
    const pointer = exports.trlm_campaign_evidence_allocate(1) >>> 0;
    assert.notEqual(pointer, 0);
    oneBytePointers.push(pointer);
  }
  assert.equal(exports.trlm_campaign_evidence_allocate(1) >>> 0, 0);
  for (const pointer of oneBytePointers) release(instance, pointer, 1);

  const phaseVectors = JSON.parse(fs.readFileSync(phaseVectorsPath, "utf8"));
  const campaignBytes = Buffer.from(phaseVectors.campaignId, "utf8");
  const receipt = fromBase64(phaseVectors.cases[0].receiptBytesBase64[0]);
  const campaignPointer = allocateAndWrite(instance, campaignBytes);
  assert.equal(
    exports.trlm_phase_invalidation_begin(campaignPointer, campaignBytes.length, 2),
    profile.statusCodes.ok
  );
  release(instance, campaignPointer, campaignBytes.length);
  const receiptPointer = allocateAndWrite(instance, receipt);
  assert.equal(
    exports.trlm_campaign_evidence_append_receipt(receiptPointer, receipt.length),
    profile.statusCodes.ok
  );
  release(instance, receiptPointer, receipt.length);
  assert.equal(exports.trlm_campaign_evidence_execute(), profile.statusCodes.boundaryError);
  assert.equal(exports.trlm_campaign_evidence_execute(), profile.statusCodes.boundaryError);

  const campaignPointer2 = allocateAndWrite(instance, campaignBytes);
  assert.equal(
    exports.trlm_phase_invalidation_begin(campaignPointer2, campaignBytes.length, 1),
    profile.statusCodes.ok
  );
  release(instance, campaignPointer2, campaignBytes.length);
  assert.equal(
    exports.trlm_campaign_evidence_append_subject(1, 8),
    profile.statusCodes.boundaryError
  );
  assert.equal(exports.trlm_campaign_evidence_execute(), profile.statusCodes.boundaryError);
  assert.equal(exports.trlm_campaign_evidence_reset(), profile.statusCodes.ok);
});

test("the generated adapter preserves plan, currentness, projection, and result bytes", {
  timeout: 120_000
}, async () => {
  const adapter = require(browserAdapterPath);
  const verifier = await adapter.instantiateCampaignEvidence(buildWasm());
  const draft = fs.readFileSync(draftPath);
  const plan = fs.readFileSync(planPath);
  const phaseVectors = JSON.parse(fs.readFileSync(phaseVectorsPath, "utf8"));
  const projectionVectors = JSON.parse(fs.readFileSync(projectionVectorsPath, "utf8"));

  const finalized = verifier.finalizeCampaignPlan(draft);
  assert.deepEqual(Buffer.from(finalized), plan);
  assert.deepEqual(Buffer.from(verifier.validateCampaignPlan(plan)), plan);
  const phaseCase = phaseVectors.cases[0];
  assert.deepEqual(Buffer.from(verifier.classifyPhaseReceipts(
    Buffer.from(phaseVectors.campaignId, "utf8"),
    phaseCase.receiptBytesBase64.map(fromBase64)
  )), fromBase64(phaseCase.resultBytesBase64));

  for (const name of ["honest-zero", "complete-capacity"]) {
    const entry = projectionVectors.acceptedCases.find((candidate) => candidate.name === name);
    assert.ok(entry);
    const projected = verifier.projectCampaign(projectionArguments(projectionVectors, entry));
    assert.deepEqual(Buffer.from(projected), fromBase64(entry.resultBytesBase64));
    assert.deepEqual(Buffer.from(verifier.validateCampaignProjectionResult(
      projected,
      planBytes(projectionVectors, entry)
    )), fromBase64(entry.resultBytesBase64));
  }

  finalized.fill(0);
  assert.deepEqual(Buffer.from(verifier.finalizeCampaignPlan(draft)), plan);
  const rejected = projectionVectors.rejectionCases.find(
    (entry) => entry.name === "phase-parent-missing"
  );
  assert.throws(
    () => verifier.projectCampaign(projectionArguments(projectionVectors, rejected)),
    (error) => error?.name === "CampaignEvidenceVerificationError" &&
      error.code === rejected.expectedErrorCode
  );
  const resultRejected = projectionVectors.resultRejectionCases.find(
    (entry) => entry.name === "result-count-drift"
  );
  const honestZero = projectionVectors.acceptedCases.find(
    (entry) => entry.name === "honest-zero"
  );
  assert.throws(
    () => verifier.validateCampaignProjectionResult(
      fromBase64(resultRejected.resultBytesBase64),
      planBytes(projectionVectors, honestZero)
    ),
    (error) => error?.name === "CampaignEvidenceVerificationError" &&
      error.code === resultRejected.expectedErrorCode
  );
  assert.throws(
    () => verifier.classifyPhaseReceipts(Buffer.from(phaseVectors.campaignId), []),
    (error) => error?.name === "CampaignEvidenceVerificationError" &&
      error.code === "phase_receipt_count_invalid"
  );

  const unrelatedModule = fs.readFileSync(
    path.join(repositoryRoot,
      "tinyrustlm/browser-runtime/tinyrustlm-browser-runtime.wasm")
  );
  await assert.rejects(
    adapter.instantiateCampaignEvidence(unrelatedModule),
    (error) => error?.name === "CampaignEvidenceBoundaryError" &&
      [
        "campaign_evidence_wasm_import_surface_invalid",
        "campaign_evidence_wasm_export_surface_invalid"
      ].includes(error.code)
  );
});

test("executes exact Rust campaign evidence in two deleted Chromium profiles", {
  timeout: 180_000
}, async () => {
  const profileParent = fs.mkdtempSync(
    path.join(os.tmpdir(), "tinyrustlm-campaign-evidence-wasm-parent-")
  );
  const root = createOwnedProfileRoot({
    parentDirectory: profileParent,
    campaignId: "campaign-evidence-wasm-browser-parity"
  });
  const wasmBase64 = toBase64(buildWasm());
  const adapterSource = fs.readFileSync(browserAdapterPath, "utf8");
  const draftBase64 = toBase64(fs.readFileSync(draftPath));
  const planBase64 = toBase64(fs.readFileSync(planPath));
  const phaseVectors = JSON.parse(fs.readFileSync(phaseVectorsPath, "utf8"));
  const phaseCase = phaseVectors.cases[0];
  const projectionVectors = JSON.parse(fs.readFileSync(projectionVectorsPath, "utf8"));
  const projectionCases = ["honest-zero", "partial-dependency-chain"].map((name) => {
    const entry = projectionVectors.acceptedCases.find((candidate) => candidate.name === name);
    assert.ok(entry);
    const input = projectionArguments(projectionVectors, entry);
    return {
      name,
      metadataBase64: toBase64(input.metadataBytes),
      planBase64: toBase64(input.campaignPlanBytes),
      receiptBase64: input.receiptBytes.map(toBase64),
      subjectBase64: input.subjectBytes.map(toBase64),
      resultBase64: entry.resultBytesBase64
    };
  });
  const deletionReceipts = [];
  try {
    for (let round = 1; round <= 2; round += 1) {
      const ownedProfile = createOwnedBrowserProfile(root, {
        round,
        role: "campaign-evidence-wasm-parity"
      });
      assert.equal(assertOwnedProfileFresh(root, ownedProfile), true);
      let context;
      try {
        context = await chromium.launchPersistentContext(ownedProfile.profilePath, {
          headless: true,
          serviceWorkers: "block",
          locale: "en-US",
          viewport: { width: 960, height: 720 },
          args: [
            "--disable-background-networking",
            "--disable-component-update",
            "--disable-default-apps",
            "--disable-extensions",
            "--disable-sync",
            "--no-default-browser-check",
            "--no-first-run"
          ]
        });
        const page = context.pages()[0] || await context.newPage();
        const requests = [];
        const consoleErrors = [];
        const pageErrors = [];
        page.on("request", (request) => requests.push(request.url()));
        page.on("console", (message) => {
          if (message.type() === "error") consoleErrors.push(message.text());
        });
        page.on("pageerror", (error) => pageErrors.push(error.name));
        await page.addScriptTag({ content: adapterSource });
        const observed = await page.evaluate(async (input) => {
          const decode = (text) => {
            const binary = atob(text);
            const bytes = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index += 1) {
              bytes[index] = binary.charCodeAt(index);
            }
            return bytes;
          };
          const encode = (bytes) => {
            let binary = "";
            for (const byte of bytes) binary += String.fromCharCode(byte);
            return btoa(binary);
          };
          const api = globalThis.TinyRustLMCampaignEvidence;
          const verifier = await api.instantiateCampaignEvidence(decode(input.wasmBase64));
          const finalized = verifier.finalizeCampaignPlan(decode(input.draftBase64));
          const phase = verifier.classifyPhaseReceipts(
            decode(input.phaseCampaignBase64),
            input.phaseReceiptBase64.map(decode)
          );
          const projections = input.projectionCases.map((entry) => {
            const result = verifier.projectCampaign({
              metadataBytes: decode(entry.metadataBase64),
              campaignPlanBytes: decode(entry.planBase64),
              receiptBytes: entry.receiptBase64.map(decode),
              subjectBytes: entry.subjectBase64.map(decode)
            });
            return {
              name: entry.name,
              resultBase64: encode(result),
              validatedBase64: encode(verifier.validateCampaignProjectionResult(
                result,
                decode(entry.planBase64)
              ))
            };
          });
          return {
            profileId: api.profileId,
            finalizedBase64: encode(finalized),
            phaseBase64: encode(phase),
            projections
          };
        }, {
          wasmBase64,
          draftBase64,
          planBase64,
          phaseCampaignBase64: toBase64(Buffer.from(phaseVectors.campaignId, "utf8")),
          phaseReceiptBase64: phaseCase.receiptBytesBase64,
          projectionCases
        });
        assert.equal(observed.profileId, "tinyrustlm.vnext.campaign-evidence-wasm.v1");
        assert.equal(observed.finalizedBase64, planBase64);
        assert.equal(observed.phaseBase64, phaseCase.resultBytesBase64);
        for (const result of observed.projections) {
          const expected = projectionCases.find((entry) => entry.name === result.name);
          assert.equal(result.resultBase64, expected.resultBase64);
          assert.equal(result.validatedBase64, expected.resultBase64);
        }
        assert.deepEqual(requests, []);
        assert.deepEqual(consoleErrors, []);
        assert.deepEqual(pageErrors, []);
      } finally {
        try {
          if (context) await context.close();
        } finally {
          deletionReceipts.push(deleteOwnedBrowserProfile(root, ownedProfile));
        }
      }
    }
    assert.equal(new Set(deletionReceipts.map((receipt) => receipt.profileMarkerHash)).size, 2);
    assert.ok(deletionReceipts.every((receipt) => receipt.deleted));
  } finally {
    removeOwnedProfileRoot(root);
    fs.rmdirSync(profileParent);
  }
});
