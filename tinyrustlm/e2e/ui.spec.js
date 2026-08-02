"use strict";

const { test, expect } = require("@playwright/test");

const publicPort = Number.parseInt(process.env.TINYRUSTLM_PLAYWRIGHT_PORT || "8187", 10);

async function openApplication(page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".app-shell")).toHaveAttribute("data-conversation-state", "empty");
  await expect(page.locator("#simpleExperience")).toBeVisible();
}

test.describe("locked TinyRustLM shell", () => {
  test("boots on the public hostname without requesting project-hosted model bytes", async ({ page }) => {
    const modelRequests = [];
    const unexpectedDeviceRequests = [];
    const startupMemoryRequests = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      const host = url.hostname.toLowerCase();
      if (
        ["localhost", "::1"].includes(host) ||
        /^127(?:\.\d{1,3}){3}$/.test(host) ||
        !["http:", "https:", "data:", "blob:"].includes(url.protocol)
      ) {
        unexpectedDeviceRequests.push(request.url());
      }
      if (["memoryendpoints.com", "www.memoryendpoints.com"].includes(host)) {
        startupMemoryRequests.push(request.url());
      }
      if (
        ["tinyrustlm.com", "minimodel.org", "uaix.org", "memoryendpoints.com"].includes(
          host
        ) && /\.(?:slm|gguf|safetensors|onnx)(?:$|[?#])/i.test(url.pathname)
      ) {
        modelRequests.push(request.url());
      }
    });
    await page.route("https://minimodel.org/catalog/default-demo.v0.json", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          demo_version: 0,
          demo_kind: "minimodel.public_demo_model.v0",
          demo_status: "public-demo-autoload-ready",
          project_server_serves_model_bytes: true,
          project_server_runs_model_bytes: false,
          project_server_proxies_model_bytes: false,
          artifact_project_server_url: "../artifacts/demo/forbidden-test-model.slm",
          artifact_kind: "slm",
          artifact_byte_count: 8832,
          artifact_sha256: `sha256:${"a".repeat(64)}`,
          artifact_byte_checksum: "0x0000000000000000",
          model_id: "test/forbidden-project-model",
          display_name: "Forbidden project model",
          manifest_route: "../examples/forbidden.manifest.v0"
        })
      });
    });
    await page.route("https://minimodel.org/artifacts/demo/forbidden-test-model.slm", async (route) => {
      await route.fulfill({ status: 404, body: "model bytes are forbidden on project hosts" });
    });

    await page.goto(`http://tinyrustlm.com:${publicPort}/`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#wasmState")).toHaveText("loaded", { timeout: 30000 });
    await expect(page.locator("#runtimeStatus")).toHaveText("Runtime ready", { timeout: 30000 });
    expect(modelRequests).toEqual([]);
    expect(unexpectedDeviceRequests, "page load must not probe a program on this device").toEqual([]);
    expect(startupMemoryRequests, "hosted memory is opt-in and must not connect on page load").toEqual([]);
  });

  test("keeps the approved empty state usable at every supported viewport", async ({ page }) => {
    await openApplication(page);

    await expect(page.locator(".starter-grid")).toBeVisible();
    await expect(page.locator("#conversationHeader")).toBeHidden();
    await expect(page.locator("#conversation .message")).toHaveCount(0);
    await expect(page.locator("#chatForm")).toBeVisible();

    const layout = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      documentHeight: document.documentElement.scrollHeight,
      viewportHeight: document.documentElement.clientHeight,
      composer: document.getElementById("chatForm").getBoundingClientRect().toJSON(),
      stage: document.getElementById("simpleExperience").getBoundingClientRect().toJSON()
    }));
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(layout.composer.width).toBeGreaterThan(240);
    expect(layout.composer.left).toBeGreaterThanOrEqual(0);
    expect(layout.composer.right).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(layout.stage.bottom).toBeLessThanOrEqual(layout.composer.top + 1);
  });

  test("explains offline readiness from the current model and memory setup", async ({ page }) => {
    await openApplication(page);

    const privacyBadge = page.locator("#privacyBadge");
    await expect(privacyBadge).toHaveAttribute("data-offline-ready", "false");
    await expect(privacyBadge).toHaveAttribute(
      "title",
      /Load and verify a local or P2P model before disconnecting/
    );
    await expect(privacyBadge).toHaveAttribute("title", /No local memory deck is active/);
    await expect(privacyBadge).toHaveAttribute("title", /local sync queue remain optional/i);
    await expect(privacyBadge).toHaveAttribute(
      "title",
      /MemoryEndpoints\.com is recommended for memory available worldwide/i
    );

    await page.locator("#modelEditButton").click();
    await page.locator("#simpleLocalSourceButton").click();
    await page.locator("#simpleMemoryEndpointsSettingsButton").click();
    await expect(page.locator("#memoryEndpointsEnabled")).toBeVisible();
    await page.locator("#memoryEndpointsEnabled").check();
    await expect(privacyBadge).toHaveAttribute(
      "title",
      /MemoryEndpoints\.com requires internet and explicit opt-in setup/
    );
    await expect(privacyBadge).toHaveAttribute(
      "title",
      /load a local UAIX Memory Deck before going offline/i
    );
  });

  test("keeps a deliberately long model name contained", async ({ page }) => {
    await openApplication(page);
    const containment = await page.evaluate(() => {
      const name = document.getElementById("modelToolbarName");
      const control = document.getElementById("modelEditButton");
      name.textContent = "A very long verified conversational model name that must remain inside the model toolbar without covering adjacent controls";
      const nameRect = name.getBoundingClientRect();
      const controlRect = control.getBoundingClientRect();
      return {
        nameLeft: nameRect.left,
        nameRight: nameRect.right,
        controlLeft: controlRect.left,
        controlRight: controlRect.right,
        scrollWidth: name.scrollWidth,
        clientWidth: name.clientWidth
      };
    });
    expect(containment.nameLeft).toBeGreaterThanOrEqual(containment.controlLeft - 1);
    expect(containment.nameRight).toBeLessThanOrEqual(containment.controlRight + 1);
    expect(containment.clientWidth).toBeGreaterThan(80);
  });

  test("exposes companion pairing and revocation as keyboard-reachable controls", async ({ page }) => {
    await openApplication(page);
    await page.locator("#modelEditButton").click();
    await page.locator("#simpleP2pSourceButton").click();
    await expect(page.locator("#simpleP2pSourcePanel")).toBeVisible();
    await expect(page.locator("#companionDetectButton")).toBeVisible();
    await expect(page.locator("#companionForgetButton")).toHaveCount(1);
    await expect(page.locator("#companionForgetButton")).toHaveAttribute("type", "button");

    await expect(page.locator("#companionDetectButton")).toBeEnabled();
    await page.locator("#companionDetectButton").focus();
    await expect(page.locator("#companionDetectButton")).toBeFocused();
    await page.keyboard.press("Tab");
    const activeId = await page.evaluate(() => document.activeElement && document.activeElement.id);
    expect(["companionForgetButton", "companionPairingCode", "simplePeerBaseUrlInput"]).toContain(activeId);
  });

  test("honors reduced-motion preference without hiding functionality", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openApplication(page);
    const result = await page.evaluate(() => ({
      preference: matchMedia("(prefers-reduced-motion: reduce)").matches,
      sendVisible: getComputedStyle(document.getElementById("generateButton")).display !== "none",
      starterVisible: getComputedStyle(document.querySelector(".starter-grid")).display !== "none"
    }));
    expect(result.preference).toBe(true);
    expect(result.sendVisible).toBe(true);
    expect(result.starterVisible).toBe(true);
  });
});
