"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { chromium } = require("@playwright/test");
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
} = require("../tools/vnext-campaign-plan-wasm-codegen.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const draftPath = path.join(
  repositoryRoot,
  "contracts/vnext/campaign-plan-draft-parity-fixture.v1.json"
);
const planPath = path.join(
  repositoryRoot,
  "contracts/vnext/campaign-plan-parity-fixture.v1.json"
);
const wasmPath = path.join(
  repositoryRoot,
  "target/wasm32-unknown-unknown/release/tinyrustlm_evidence_wasm.wasm"
);

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
  const stat = fs.lstatSync(wasmPath);
  assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 && stat.size <= 4 * 1024 * 1024);
  compiledWasmBytes = fs.readFileSync(wasmPath);
  return compiledWasmBytes;
}

function toBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

function moduleShape(bytes) {
  const module = new WebAssembly.Module(bytes);
  return {
    module,
    imports: WebAssembly.Module.imports(module),
    exports: WebAssembly.Module.exports(module)
  };
}

test("freezes one generated Rust and browser campaign-plan WASM boundary", () => {
  const profile = loadInterfaceProfile();
  assert.equal(profile.schema, "tinyrustlm.vnext.campaign_plan_wasm_interface.v1");
  assert.equal(profile.profileId, "tinyrustlm.vnext.campaign-plan-wasm.v1");
  assert.equal(profile.abiVersion, 1);
  assert.equal(profile.maximumInputBytes, 1_048_576);
  assert.equal(
    crypto.createHash("sha256").update(fs.readFileSync(interfaceProfilePath)).digest("hex"),
    "ea7c4de88bb40247b8c65594005a4964b4fd03937d00c6a865563b4f1a46f7ad"
  );
  assert.ok(Object.isFrozen(profile) && Object.isFrozen(profile.exports) &&
    Object.isFrozen(profile.requiredExports));
  assert.deepEqual(fs.readFileSync(rustExportsPath), renderGeneratedRustExports(profile));
  assert.deepEqual(fs.readFileSync(browserAdapterPath), renderGeneratedBrowserAdapter(profile));
  assert.ok(fs.lstatSync(interfaceProfilePath).isFile());

  const accessor = { ...profile };
  Object.defineProperty(accessor, "schema", {
    enumerable: true,
    get() {
      throw new Error("accessor must not execute");
    }
  });
  assert.throws(
    () => validateInterfaceProfile(accessor),
    (error) => error?.code === "campaign_plan_wasm_profile_invalid" &&
      /data property/u.test(error.message)
  );
});

test("builds an import-free WASM module with the exact frozen export surface", () => {
  const profile = loadInterfaceProfile();
  const shape = moduleShape(buildWasm());
  assert.deepEqual(shape.imports, profile.requiredImports);
  assert.deepEqual(shape.exports, profile.requiredExports);

  const instance = new WebAssembly.Instance(shape.module, {});
  assert.equal(instance.exports.trlm_campaign_plan_finalize(1, 8),
    profile.statusCodes.boundaryError);
  const pointer = instance.exports.trlm_evidence_allocate(16) >>> 0;
  assert.notEqual(pointer, 0);
  assert.equal(instance.exports.trlm_campaign_plan_validate(pointer, 15),
    profile.statusCodes.boundaryError);
  assert.equal(instance.exports.trlm_evidence_release(pointer, 16), profile.statusCodes.ok);
  assert.equal(instance.exports.trlm_evidence_release(pointer, 16),
    profile.statusCodes.boundaryError);
});

test("the generated adapter preserves exact Node and Rust bytes and stable failures", async () => {
  const adapter = require(browserAdapterPath);
  const verifier = await adapter.instantiateCampaignPlanVerifier(buildWasm());
  const draft = fs.readFileSync(draftPath);
  const plan = fs.readFileSync(planPath);

  const finalized = verifier.finalizeCampaignPlan(draft);
  assert.deepEqual(Buffer.from(finalized), plan);
  assert.deepEqual(Buffer.from(verifier.validateCampaignPlan(plan)), plan);

  finalized.fill(0);
  assert.deepEqual(Buffer.from(verifier.finalizeCampaignPlan(draft)), plan);
  assert.throws(
    () => verifier.validateCampaignPlan(Buffer.concat([plan, Buffer.from("\n")])),
    (error) => error?.name === "CampaignPlanVerificationError" &&
      error.code === "campaign_plan_identity_mismatch"
  );
  assert.throws(
    () => verifier.finalizeCampaignPlan(new Uint8Array(adapter.maximumInputBytes + 1)),
    (error) => error?.name === "CampaignPlanBoundaryError" &&
      error.code === "campaign_plan_byte_limit"
  );
  const duplicateSchema = Buffer.concat([
    draft.subarray(0, draft.length - 1),
    Buffer.from(',"schema":"tinyrustlm.vnext.campaign_plan.v1"}', "utf8")
  ]);
  assert.throws(
    () => verifier.finalizeCampaignPlan(duplicateSchema),
    (error) => error?.name === "CampaignPlanVerificationError" &&
      error.code === "campaign_plan_invalid"
  );
  assert.throws(
    () => verifier.finalizeCampaignPlan(Uint8Array.from([0xff, 0xfe, 0xfd])),
    (error) => error?.name === "CampaignPlanVerificationError" &&
      error.code === "campaign_plan_invalid"
  );

  const unrelatedModule = fs.readFileSync(path.join(repositoryRoot, "tinyrustlm/runtime/tinyrustlm.wasm"));
  await assert.rejects(
    adapter.instantiateCampaignPlanVerifier(unrelatedModule),
    (error) => error?.name === "CampaignPlanBoundaryError" &&
      [
        "campaign_plan_wasm_import_surface_invalid",
        "campaign_plan_wasm_export_surface_invalid"
      ].includes(error.code)
  );
});

test("executes exact plan finalization and validation in two deleted Chromium profiles", {
  timeout: 120_000
}, async () => {
  const profileParent = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-plan-wasm-parent-"));
  const root = createOwnedProfileRoot({
    parentDirectory: profileParent,
    campaignId: "campaign-plan-wasm-browser-parity"
  });
  const wasmBase64 = toBase64(buildWasm());
  const adapterSource = fs.readFileSync(browserAdapterPath, "utf8");
  const draftBase64 = toBase64(fs.readFileSync(draftPath));
  const planBase64 = toBase64(fs.readFileSync(planPath));
  const deletionReceipts = [];
  try {
    for (let round = 1; round <= 2; round += 1) {
      const ownedProfile = createOwnedBrowserProfile(root, {
        round,
        role: "campaign-plan-wasm-parity"
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
          const api = globalThis.TinyRustLMCampaignPlanVerifier;
          const verifier = await api.instantiateCampaignPlanVerifier(decode(input.wasmBase64));
          const finalized = verifier.finalizeCampaignPlan(decode(input.draftBase64));
          const validated = verifier.validateCampaignPlan(finalized);
          let decoratedFailure = null;
          try {
            const plan = decode(input.planBase64);
            const decorated = new Uint8Array(plan.length + 1);
            decorated.set(plan);
            decorated[plan.length] = 10;
            verifier.validateCampaignPlan(decorated);
          } catch (error) {
            decoratedFailure = { name: error.name, code: error.code };
          }
          return {
            profileId: api.profileId,
            finalizedBase64: encode(finalized),
            validatedBase64: encode(validated),
            decoratedFailure
          };
        }, { wasmBase64, draftBase64, planBase64 });
        assert.equal(observed.profileId, "tinyrustlm.vnext.campaign-plan-wasm.v1");
        assert.equal(observed.finalizedBase64, planBase64);
        assert.equal(observed.validatedBase64, planBase64);
        assert.deepEqual(observed.decoratedFailure, {
          name: "CampaignPlanVerificationError",
          code: "campaign_plan_identity_mismatch"
        });
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
