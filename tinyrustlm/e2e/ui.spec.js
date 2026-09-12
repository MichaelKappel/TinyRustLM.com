"use strict";

const { test, expect } = require("@playwright/test");

const publicPort = Number.parseInt(process.env.TINYRUSTLM_PLAYWRIGHT_PORT || "8187", 10);
const miniModelCatalogUrl = "https://minimodel.org/catalog/compositions.v1.json";
const miniModelPeerFeedUrl = "https://minimodel.org/catalog/peer-announcements.v1.json";

async function routeEmptyMiniModelCatalog(page) {
  const now = Math.floor(Date.now() / 1000) * 1000;
  const generatedAtUtc = new Date(now - 60_000).toISOString().replace(".000Z", "Z");
  const validUntilUtc = new Date(now + 60 * 60_000).toISOString().replace(".000Z", "Z");
  const responseOptions = (body) => ({
    status: 200,
    contentType: "application/json",
    headers: { "Access-Control-Allow-Origin": "*" },
    body: `${JSON.stringify(body)}\n`
  });
  await page.route(miniModelCatalogUrl, (route) => route.fulfill(responseOptions({
    schema: "minimodel.slm2_catalog.v1",
    catalog_id: "playwright.empty",
    revision: 1,
    generated_at_utc: generatedAtUtc,
    valid_until_utc: validUntilUtc,
    project_server_serves_model_bytes: false,
    project_server_proxies_model_bytes: false,
    project_server_runs_inference: false,
    qualification_policy: "exact-current-evidence-required",
    qualification_receipt_schema: "tinyrustlm.qualification-receipt/1",
    browser_admission_schema: "tinyrustlm.browser-composition-admission/1",
    peer_verification_keys: [],
    revoked_qualification_receipt_ids: [],
    supersessions: [],
    entries: []
  })));
  await page.route(miniModelPeerFeedUrl, (route) => route.fulfill(responseOptions({
    schema: "minimodel.slm2_peer_announcements.v1",
    feed_id: "playwright.empty",
    revision: 1,
    generated_at_utc: generatedAtUtc,
    valid_until_utc: validUntilUtc,
    project_server_serves_model_bytes: false,
    project_server_proxies_model_bytes: false,
    announcements: []
  })));
}

async function expectTruthfulEmptyMiniModelCatalog(page) {
  const status = page.locator("#simpleModelPickerStatus");
  await expect(status).toHaveText("No models are listed yet.");
  await expect(status).not.toHaveClass(/error/);
  await expect(page.locator("#simpleModelList .simple-model-empty")).toHaveText(
    "No models are listed yet."
  );
  await expect(page.locator("#simpleModelList [data-composition-id]")).toHaveCount(0);
}

async function routeLocalSourceAsPublicHttps(page) {
  await page.route(`https://tinyrustlm.com:${publicPort}/**`, async (route) => {
    const requestUrl = new URL(route.request().url());
    const localUrl = new URL(
      `${requestUrl.pathname}${requestUrl.search}`,
      `http://127.0.0.1:${publicPort}`
    );
    const response = await route.fetch({ url: localUrl.href });
    await route.fulfill({ response });
  });
}

async function openApplication(page) {
  await routeEmptyMiniModelCatalog(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".app-shell")).toHaveAttribute("data-conversation-state", "empty");
  await expect(page.locator("#simpleExperience")).toBeVisible();
}

async function openAdvancedModelOptions(page) {
  const chooser = page.locator("#simpleDiscoveryPanel");
  await expect(chooser).toBeVisible({ timeout: 30000 });
  await chooser.locator("#simpleOpenAdvancedDiscoveryButton").click();
  await expect(chooser).toBeHidden();
  await expect(page.locator(".app-shell")).toHaveAttribute("data-mode", "advanced");
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
    await routeEmptyMiniModelCatalog(page);
    await routeLocalSourceAsPublicHttps(page);

    await page.goto(`https://tinyrustlm.com:${publicPort}/`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#wasmState")).toHaveText("verified", { timeout: 30000 });
    await expect(page.locator("#runtimeStatus")).toHaveText(
      "Runtime verified; choose a qualified composition",
      { timeout: 30000 }
    );
    await expectTruthfulEmptyMiniModelCatalog(page);
    expect(modelRequests).toEqual([]);
    expect(unexpectedDeviceRequests, "page load must not probe a program on this device").toEqual([]);
    expect(startupMemoryRequests, "hosted memory is opt-in and must not connect on page load").toEqual([]);
  });

  test("keeps the approved empty state usable at every supported viewport", async ({ page }) => {
    await openApplication(page);
    await expectTruthfulEmptyMiniModelCatalog(page);
    await page.getByRole("button", { name: "Close model chooser", exact: true }).click();
    await expect(page.locator("#simpleDiscoveryPanel")).toBeHidden();

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

    // Mobile intentionally omits the notice; its last starter must remain reachable instead.
    const conversationPanel = page.locator(".conversation-panel");
    const tail = layout.viewportWidth > 560
      ? page.locator("#conversation .empty-message")
      : page.locator(".starter-action").last();
    if (layout.viewportWidth <= 560) await expect(conversationPanel).toBeHidden();
    await expect(tail).toBeVisible();
    await tail.scrollIntoViewIfNeeded();
    const reachable = await tail.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const composer = document.getElementById("chatForm").getBoundingClientRect();
      const workspace = document.querySelector(".main-workspace").getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      return {
        tail: rect.toJSON(),
        composer: composer.toJSON(),
        workspace: workspace.toJSON(),
        viewportHeight: document.documentElement.clientHeight,
        unobscured: [rect.top + 2, rect.top + rect.height / 2, rect.bottom - 2]
          .every((y) => element.contains(document.elementFromPoint(centerX, y)))
      };
    });
    expect(reachable.tail.top).toBeGreaterThanOrEqual(0);
    expect(reachable.tail.bottom).toBeLessThanOrEqual(reachable.composer.top);
    expect(reachable.unobscured, "empty-state content must not sit behind the composer").toBe(true);
    expect(reachable.composer.bottom).toBeLessThanOrEqual(reachable.viewportHeight);
    if (layout.viewportWidth >= 900 && layout.viewportWidth <= 1199) {
      expect(reachable.workspace.bottom).toBeLessThanOrEqual(reachable.composer.top);
      expect(reachable.tail.bottom).toBeLessThanOrEqual(reachable.workspace.bottom);
      expect(reachable.composer.top).toBe(layout.composer.top);
      expect(reachable.composer.height).toBe(layout.composer.height);
    }
  });

  test("explains offline readiness from the current model and memory setup", async ({ page }) => {
    await openApplication(page);
    await expect(page.locator("#wasmState")).toHaveText("verified", { timeout: 30000 });

    const privacyBadge = page.locator("#privacyBadge");
    await expect(privacyBadge).toHaveAttribute("data-offline-ready", "false");
    await expect(privacyBadge).toHaveAttribute(
      "title",
      /Load and verify a local or P2P model before disconnecting/
    );
    await expect(privacyBadge).toHaveAttribute("title", /No local memory deck is active/);
    await expect(privacyBadge).toHaveAttribute("title", /Local copied memory remains optional/i);
    await expect(privacyBadge).toHaveAttribute(
      "title",
      /recommends MemoryEndpoints\.com for memory available worldwide and across devices/i
    );

    await openAdvancedModelOptions(page);
    await expect(page.locator('details[data-panel-key="dashboard-model-source"]')).toHaveJSProperty(
      "open",
      true
    );
    await expect(page.locator("#memoryEndpointsEnabled")).toBeVisible();
    await page.locator("#memoryEndpointsEnabled").check();
    await expect(privacyBadge).toHaveAttribute(
      "title",
      /requires explicit MemoryEndpoints\.com sign-in and provider selection/
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
    await openAdvancedModelOptions(page);
    await expect(page.locator('details[data-panel-key="dashboard-model-source"]')).toHaveJSProperty(
      "open",
      true
    );
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
