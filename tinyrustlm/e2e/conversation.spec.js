"use strict";

const path = require("path");
const { test, expect } = require("@playwright/test");

const projectHosts = new Set([
  "tinyrustlm.com",
  "www.tinyrustlm.com",
  "minimodel.org",
  "www.minimodel.org",
  "uaix.org",
  "www.uaix.org",
  "memoryendpoints.com",
  "www.memoryendpoints.com"
]);

async function loadLocalRuntimeFixture(page) {
  const fixturePath = path.join(__dirname, "..", "models", "tiny-test-model-q8.slm");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#wasmState")).toHaveText("loaded", { timeout: 30000 });
  await expect(page.locator("#runtimeStatus")).not.toHaveText("Loading default model", {
    timeout: 30000
  });
  await page.locator("#modelEditButton").click();
  await page.locator("#simpleLocalSourceButton").click();
  await page.locator("#localModelFile").setInputFiles(fixturePath);
  await expect.poll(() => page.locator("#localModelFile").evaluate((input) => input.files.length)).toBe(1);
  await expect(page.locator("#simpleImportLocalModelButton")).toBeEnabled();
  await page.locator("#simpleImportLocalModelButton").click();
  try {
    await expect(page.locator("#runtimeStatus")).toHaveText("Ready", { timeout: 30000 });
  } catch (_error) {
    const diagnostics = await page.evaluate(() => ({
      selectedFiles: Array.from(document.getElementById("localModelFile").files || []).map((file) => ({
        name: file.name,
        size: file.size
      })),
      runtimeStatus: document.getElementById("runtimeStatus").textContent,
      localModelState: document.getElementById("localModelState").textContent,
      modelState: document.getElementById("modelState").textContent,
      errorState: document.getElementById("errorState").textContent
    }));
    throw new Error(`Local fixture did not load: ${JSON.stringify(diagnostics)}`);
  }
  await expect(page.locator("#localModelState")).toContainText("loaded", { timeout: 90000 });
  await expect(page.locator("#generateButton")).toBeEnabled();
  await expect(page.locator("#privacyBadge")).toHaveAttribute("data-offline-ready", "true");
  await expect(page.locator("#privacyBadge")).toHaveAttribute(
    "title",
    /You can disconnect from the internet and keep chatting in this open tab/
  );
}

async function submitPrompt(page, prompt) {
  await page.locator("#prompt").fill(prompt);
  await page.locator("#prompt").press("Enter");
}

async function waitForIdleTurn(page, expectedMessages) {
  await expect(page.locator(".app-shell")).toHaveAttribute("data-generation-state", "idle", {
    timeout: 90000
  });
  await expect(page.locator("#conversation .message")).toHaveCount(expectedMessages, {
    timeout: 90000
  });
}

test.describe("active browser-local conversation", () => {
  test("uses one response renderer and keeps model bytes and prompts off project domains", async ({ page }) => {
    test.slow();
    const observedRequests = [];
    page.on("request", (request) => {
      observedRequests.push({
        url: request.url(),
        method: request.method(),
        postData: request.postData() || ""
      });
    });

    await loadLocalRuntimeFixture(page);
    await expect(page.locator("#simpleExperience")).toBeVisible();
    await expect(page.locator(".starter-grid")).toBeVisible();

    const firstPrompt = "First local browser-only conversation turn";
    await submitPrompt(page, firstPrompt);
    await waitForIdleTurn(page, 2);

    await expect(page.locator(".app-shell")).toHaveAttribute("data-conversation-state", "active");
    await expect(page.locator("#simpleExperience")).toBeHidden();
    await expect(page.locator(".starter-grid")).toBeHidden();
    await expect(page.locator("#simpleDiscoveryPanel")).toBeHidden();
    await expect(page.locator("#modelEditButton")).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#conversationHeader")).toBeVisible();
    await expect(page.locator("#conversation .message-user")).toHaveCount(1);
    await expect(page.locator("#conversation .message-assistant")).toHaveCount(1);
    await expect(page.locator("#conversation #response")).toHaveCount(1);
    await expect(page.locator(".response-sentinel#response")).toHaveCount(0);
    const firstAssistant = page.locator("#conversation .message-assistant").first();
    await expect(firstAssistant.locator('[data-message-action="copy"]')).toHaveCount(1);
    await expect(firstAssistant.locator('[data-message-action="retry"]')).toHaveCount(1);
    await expect(firstAssistant.locator('[data-message-action="inspect"]')).toHaveCount(1);

    const secondPrompt = "Second local turn must also produce exactly one assistant message";
    await submitPrompt(page, secondPrompt);
    await waitForIdleTurn(page, 4);
    await expect(page.locator("#conversation .message-user")).toHaveCount(2);
    await expect(page.locator("#conversation .message-assistant")).toHaveCount(2);
    await expect(page.locator("#conversation #response")).toHaveCount(1);

    const geometry = await page.evaluate(() => {
      const conversation = document.querySelector(".conversation-panel").getBoundingClientRect();
      const composer = document.getElementById("chatForm").getBoundingClientRect();
      return {
        conversationBottom: conversation.bottom,
        composerTop: composer.top,
        composerBottom: composer.bottom,
        viewportHeight: innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth
      };
    });
    expect(geometry.conversationBottom).toBeLessThanOrEqual(geometry.composerTop + 1);
    expect(geometry.composerBottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);

    const publicModelRequests = observedRequests.filter((entry) => {
      const url = new URL(entry.url);
      return projectHosts.has(url.hostname.toLowerCase()) && /\.slm(?:$|[?#])/i.test(url.pathname);
    });
    expect(publicModelRequests, "project domains must never serve model bytes").toEqual([]);

    const promptLeaks = observedRequests.filter((entry) => {
      const url = new URL(entry.url);
      return projectHosts.has(url.hostname.toLowerCase()) &&
        (entry.postData.includes(firstPrompt) || entry.postData.includes(secondPrompt));
    });
    expect(promptLeaks, "prompts must remain browser-local").toEqual([]);
  });
});
