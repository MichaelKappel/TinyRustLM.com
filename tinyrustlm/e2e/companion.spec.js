"use strict";

const fs = require("fs");
const { test, expect } = require("@playwright/test");
const { createCompanionFixture, sha256File } = require("./helpers/companion-fixture");

const playwrightPort = Number.parseInt(process.env.TINYRUSTLM_PLAYWRIGHT_PORT || "8187", 10);
const applicationOrigin = `http://127.0.0.1:${playwrightPort}`;
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

async function openP2pPanel(page) {
  await page.locator("#modelEditButton").click();
  await page.locator("#simpleP2pSourceButton").click();
  await expect(page.locator("#simpleP2pSourcePanel")).toBeVisible();
}

async function pairBrowser(page, pairingCode) {
  await openP2pPanel(page);
  await page.locator("#companionDetectButton").click();
  await expect(page.locator("#companionPairingControls")).toBeVisible({ timeout: 15000 });
  await page.locator("#companionPairingCode").fill(pairingCode);
  await page.locator("#companionPairButton").click();
  await expect(page.locator("#companionStatus")).toContainText("Connected", { timeout: 15000 });
  await expect(page.locator("#companionForgetButton")).toBeVisible();
}

async function loadCatalog(
  page,
  catalogUrl,
  expectedModelId = "tinyrustlm/tiny-test-model-q8"
) {
  await page.locator("#sidebarAdvancedToolsButton").click();
  const modelSource = page.locator('details[data-panel-key="dashboard-model-source"]');
  if (!await modelSource.evaluate((details) => details.open)) {
    await modelSource.locator("summary").click();
  }
  await page.locator("#catalogUrlInput").fill(catalogUrl);
  await page.locator("#catalogLoadButton").click();
  await expect(page.locator("#catalogStatus")).toContainText("1 metadata entries", {
    timeout: 15000
  });
  await page.locator("#sidebarP2pSetupButton").click();
  await expect(page.locator("#simpleCatalogResults")).toContainText(expectedModelId);
}

async function loadPeerContactBook(page, peerContactBookPath) {
  await page.locator("#simplePeerContactBookFile").setInputFiles(peerContactBookPath);
  await page.locator("#simpleApplyPeerContactBookButton").click();
  await expect(page.locator("#simplePeerUrlStatus")).toContainText("2 peers", {
    timeout: 15000
  });
}

test.describe("real web-to-companion boundary", () => {
  test("stays browser-only until the user explicitly chooses the desktop companion", async ({
    page
  }, testInfo) => {
    expect(testInfo.project.name).toBe("desktop");
    const companionRequests = [];
    page.on("request", (request) => {
      if (request.url().startsWith("http://127.0.0.1:43127/")) {
        companionRequests.push(request.url());
      }
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(750);
    expect(companionRequests).toEqual([]);

    await openP2pPanel(page);
    await expect(page.locator("#companionAccessNotice")).toContainText(
      "TinyRustLM works entirely in your browser"
    );
    await expect(page.locator("#companionAccessNotice")).toContainText(
      "access prompt"
    );
    await expect(page.locator("#companionDetectButton")).toHaveText(
      "Connect desktop companion"
    );

    const firstCompanionRequest = page.waitForRequest(
      (request) => request.url() === "http://127.0.0.1:43127/v1/health"
    );
    await page.locator("#companionDetectButton").click();
    await firstCompanionRequest;
  });

  test("rejects two Rust peers that disagree before model bytes become available", async ({
    page
  }, testInfo) => {
    expect(testInfo.project.name).toBe("desktop");
    test.setTimeout(90000);
    const fixture = await createCompanionFixture(applicationOrigin, {
      secondPeerMismatch: true
    });
    const modelStreamRequests = [];
    page.on("request", (request) => {
      if (
        request.url().startsWith("http://127.0.0.1:43127/v1/models/") &&
        request.url().endsWith("/content")
      ) {
        modelStreamRequests.push(request.url());
      }
    });
    try {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await pairBrowser(page, fixture.pairingCode);
      await loadCatalog(page, fixture.catalogUrl);
      await loadPeerContactBook(page, fixture.peerContactBookPath);
      const result = page.locator("#simpleCatalogResults li").filter({
        hasText: "tinyrustlm/tiny-test-model-q8"
      });
      const importRequestPromise = page.waitForRequest((request) =>
        request.method() === "POST" &&
        request.url() === "http://127.0.0.1:43127/v1/imports"
      );
      await result.getByRole("button", { name: "Import & load" }).click();
      const importRequest = await importRequestPromise;
      const importBody = importRequest.postDataJSON();
      expect(importBody.peer_import_requests).toHaveLength(2);
      expect(importBody.peer_import_requests.map((value) => JSON.parse(value)
        .local_peer_piece_contract.expected_peer_base_url)).toEqual(fixture.peerBaseUrls);

      await expect(page.locator("#companionImportProgress")).toBeVisible({ timeout: 15000 });
      await expect.poll(
        () => page.locator("#companionImportStage").textContent(),
        { timeout: 30000 }
      ).toContain("Import rejected");
      await expect(page.locator("#companionImportStage")).toContainText(
        "bridge_peer_preflight_rejected"
      );
      expect(fixture.importedArtifacts()).toEqual([]);
      expect(fixture.importStateSummaries()).toEqual([
        expect.objectContaining({
          state: "failed",
          errorCode: "bridge_peer_preflight_rejected"
        })
      ]);
      await expect(page.locator("#largeModelDialog")).toBeHidden();
      await expect(page.locator("#modelToolbarName")).not.toContainText("tiny-test-model-q8");
      expect(modelStreamRequests).toEqual([]);
    } finally {
      await fixture.dispose();
    }
  });

  test("pairs once, imports from two Rust peers, reconnects, and revokes", async ({
    browser,
    context,
    page
  }, testInfo) => {
    expect(testInfo.project.name).toBe("desktop");
    test.setTimeout(180000);
    const fixture = await createCompanionFixture(applicationOrigin);
    const requests = [];
    const bridgeErrors = [];
    page.on("request", (request) => {
      requests.push({
        url: request.url(),
        method: request.method(),
        postData: request.postData() || ""
      });
    });
    page.on("response", async (response) => {
      if (
        response.status() >= 400 &&
        response.url() === "http://127.0.0.1:43127/v1/imports"
      ) {
        try {
          const value = await response.json();
          bridgeErrors.push({
            status: response.status(),
            code: String(value.code || ""),
            message: String(value.message || "").slice(0, 512)
          });
        } catch (_error) {
          bridgeErrors.push({ status: response.status(), code: "invalid-error-body", message: "" });
        }
      }
    });

    let secondProfile = null;
    let secondTab = null;
    try {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await pairBrowser(page, fixture.pairingCode);

      secondProfile = await browser.newContext({
        baseURL: applicationOrigin,
        colorScheme: "dark",
        viewport: { width: 1100, height: 760 }
      });
      const profilePage = await secondProfile.newPage();
      await profilePage.goto("/", { waitUntil: "domcontentloaded" });
      await openP2pPanel(profilePage);
      await profilePage.locator("#companionDetectButton").click();
      await expect(profilePage.locator("#companionPairingControls")).toBeVisible({ timeout: 15000 });
      await profilePage.locator("#companionPairingCode").fill(fixture.pairingCode);
      await profilePage.locator("#companionPairButton").click();
      await expect(profilePage.locator("#companionStatus")).toHaveClass(/error/);
      await expect(profilePage.locator("#companionStatus")).not.toContainText("Connected");
      await secondProfile.close();
      secondProfile = null;

      secondTab = await context.newPage();
      await secondTab.goto("/", { waitUntil: "domcontentloaded" });
      await openP2pPanel(secondTab);
      await secondTab.locator("#companionDetectButton").click();
      await expect(secondTab.locator("#companionPairingControls")).toBeVisible({ timeout: 15000 });
      await expect(secondTab.locator("#companionStatus")).not.toContainText("Connected");
      await secondTab.close();
      secondTab = null;

      await loadCatalog(page, fixture.catalogUrl);
      await loadPeerContactBook(page, fixture.peerContactBookPath);
      const result = page.locator("#simpleCatalogResults li").filter({
        hasText: "tinyrustlm/tiny-test-model-q8"
      });
      await expect(result).toHaveCount(1);
      await expect(result.getByRole("button", { name: "Import & load" })).toBeVisible();
      await result.getByRole("button", { name: "Import & load" }).click();

      await expect(page.locator("#companionImportProgress")).toBeVisible({ timeout: 15000 });
      await expect.poll(
        () => page.locator("#companionImportStage").textContent(),
        { timeout: 60000 }
      ).toMatch(/^(Verified model ready|Import rejected|Paused safely)/);
      if (!String(await page.locator("#companionImportStage").textContent()).startsWith("Verified model ready")) {
        await page.waitForTimeout(100);
        const diagnostics = await page.evaluate(() => ({
          companionStatus: document.getElementById("companionStatus").textContent,
          importStage: document.getElementById("companionImportStage").textContent,
          catalogStatus: document.getElementById("catalogStatus").textContent,
          runtimeStatus: document.getElementById("runtimeStatus").textContent,
          localModelState: document.getElementById("localModelState").textContent,
          errorState: document.getElementById("errorState").textContent
        }));
        throw new Error(`Companion import did not become available: ${JSON.stringify({
          ...diagnostics,
          importStates: fixture.importStateSummaries(),
          bridgeErrors,
          requestSummary: requests.map((entry) => ({ method: entry.method, url: entry.url }))
        })}`);
      }
      await expect(page.locator("#largeModelDialog")).toBeVisible({ timeout: 15000 });
      await expect(page.locator("#largeModelDialogDownload")).toContainText("KiB");
      await page.locator("#largeModelConfirmButton").click();
      await expect(page.locator("#runtimeStatus")).toHaveText("Ready", { timeout: 60000 });
      await expect(page.locator("#localModelState")).toContainText(
        "loaded from a receipt-verified companion import",
        { timeout: 60000 }
      );
      await expect(page.locator("#modelToolbarName")).toContainText("tiny-test-model-q8");

      const importedArtifacts = fixture.importedArtifacts();
      expect(importedArtifacts).toHaveLength(1);
      expect(fs.statSync(importedArtifacts[0]).size).toBe(8832);
      expect(sha256File(importedArtifacts[0])).toBe(fixture.artifactSha256);
      const persistedStates = fixture.persistedStates();
      expect(persistedStates).toHaveLength(1);
      const persistedStateText = fs.readFileSync(persistedStates[0], "utf8");
      expect(persistedStateText).toContain('"state": "available"');
      expect(persistedStateText).not.toMatch(/authorization|bearer|password|private_key|secret|token/i);

      const prompt = "Companion-imported model must answer only inside this browser";
      await expect(page.locator("#generateButton")).toBeEnabled();
      await page.keyboard.press("Escape");
      await page.locator("#prompt").fill(prompt);
      await page.locator("#prompt").press("Enter");
      await expect(page.locator("#conversation .message-user")).toHaveCount(1, {
        timeout: 15000
      });
      await expect(page.locator(".app-shell")).toHaveAttribute("data-generation-state", "idle", {
        timeout: 30000
      });
      await expect(page.locator("#conversation .message-assistant")).toHaveCount(1);
      await expect(page.locator("#conversation #response")).toHaveCount(1);

      await context.setOffline(true);
      await page.locator("#modelEditButton").click();
      await page.locator("#simpleP2pSourceButton").click();
      await page.locator("#companionDetectButton").click();
      await expect(page.locator("#companionStatus")).toContainText("not detected", { timeout: 15000 });
      await context.setOffline(false);
      await page.locator("#companionDetectButton").click();
      await expect(page.locator("#companionStatus")).toContainText("Connected", { timeout: 15000 });

      const restartPairingCode = await fixture.restartBridge();
      await page.locator("#companionDetectButton").click();
      await expect(page.locator("#companionPairingControls")).toBeVisible({ timeout: 15000 });
      await expect(page.locator("#companionStatus")).toContainText("pairing required");
      await page.locator("#companionPairingCode").fill(restartPairingCode);
      await page.locator("#companionPairButton").click();
      await expect(page.locator("#companionStatus")).toContainText("1 verified local model", {
        timeout: 15000
      });

      await page.locator("#companionForgetButton").click();
      await expect(page.locator("#companionStatus")).toContainText("Pairing revoked", {
        timeout: 15000
      });
      await expect(page.locator("#companionForgetButton")).toBeHidden();
      await expect(page.locator("#companionPairingControls")).toBeVisible();

      const browserModelStreams = requests.filter((entry) =>
        entry.url.startsWith("http://127.0.0.1:43127/v1/models/") &&
        entry.url.endsWith("/content")
      );
      expect(browserModelStreams).toHaveLength(1);
      const publicModelRequests = requests.filter((entry) => {
        const url = new URL(entry.url);
        return projectHosts.has(url.hostname.toLowerCase()) && /\.slm$/i.test(url.pathname);
      });
      expect(publicModelRequests).toEqual([]);
      const promptLeaks = requests.filter((entry) => {
        const url = new URL(entry.url);
        return projectHosts.has(url.hostname.toLowerCase()) && entry.postData.includes(prompt);
      });
      expect(promptLeaks).toEqual([]);
    } finally {
      await context.setOffline(false);
      if (secondTab) {
        await secondTab.close();
      }
      if (secondProfile) {
        await secondProfile.close();
      }
      await fixture.dispose();
    }
  });

  test("restarts the owned worker tree during a Rust piece fetch and resumes", async ({
    page
  }, testInfo) => {
    expect(testInfo.project.name).toBe("desktop");
    test.setTimeout(120000);
    const fixture = await createCompanionFixture(applicationOrigin, {
      throttlePieceMilliseconds: 5000
    });
    try {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await pairBrowser(page, fixture.pairingCode);
      await loadCatalog(page, fixture.catalogUrl, fixture.modelId);
      await loadPeerContactBook(page, fixture.peerContactBookPath);
      const result = page.locator("#simpleCatalogResults li").filter({
        hasText: fixture.modelId
      });
      await result.getByRole("button", { name: "Import & load" }).click();
      await expect(page.locator("#companionImportStage")).toContainText(
        "Downloading and verifying peer pieces",
        { timeout: 30000 }
      );
      await fixture.waitForStartedPieceResponseCount(1, 30000);

      const restartPairingCode = await fixture.restartBridge();
      await page.locator("#companionDetectButton").click();
      await expect(page.locator("#companionPairingControls")).toBeVisible({ timeout: 15000 });
      await page.locator("#companionPairingCode").fill(restartPairingCode);
      await page.locator("#companionPairButton").click();
      await expect(page.locator("#companionImportStage")).toContainText("Paused safely", {
        timeout: 15000
      });
      await expect(result.getByRole("button", { name: "Resume & load" })).toBeVisible();

      fixture.setPeerThrottle(0);
      await result.getByRole("button", { name: "Resume & load" }).click();
      await expect(page.locator("#companionImportStage")).toContainText("Verified model ready", {
        timeout: 60000
      });
      expect(fixture.importedArtifacts()).toHaveLength(1);
      const [completedState] = fixture.importStateSummaries();
      expect(completedState.wasResumed).toBe(true);
      expect(completedState.downloadedPieceCount + completedState.reusedPieceCount).toBe(1);
      await expect(page.locator("#largeModelDialog")).toBeVisible({ timeout: 15000 });
      await page.locator("#largeModelConfirmButton").click();
      await expect(page.locator("#runtimeStatus")).toHaveText("Ready", { timeout: 60000 });
    } finally {
      fixture.setPeerThrottle(0);
      await fixture.dispose();
    }
  });

  test("restarts, resumes, and chats with the real 969648576-byte model", async ({
    page
  }, testInfo) => {
    expect(testInfo.project.name).toBe("desktop");
    test.setTimeout(600000);
    const fixture = await createCompanionFixture(applicationOrigin, {
      model: "qwen",
      throttlePieceMilliseconds: 12
    });
    const requests = [];
    page.on("request", (request) => {
      requests.push({
        url: request.url(),
        method: request.method(),
        postData: request.postData() || ""
      });
    });
    try {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await pairBrowser(page, fixture.pairingCode);
      await loadCatalog(page, fixture.catalogUrl, fixture.modelId);
      await loadPeerContactBook(page, fixture.peerContactBookPath);
      const result = page.locator("#simpleCatalogResults li").filter({
        hasText: fixture.modelId
      });
      const firstImportRequest = page.waitForRequest((request) =>
        request.method() === "POST" &&
        request.url() === "http://127.0.0.1:43127/v1/imports"
      );
      await result.getByRole("button", { name: "Import & load" }).click();
      const firstImportBody = (await firstImportRequest).postDataJSON();
      expect(firstImportBody.peer_import_requests).toHaveLength(2);
      await expect(page.locator("#companionImportStage")).toContainText(
        "Downloading and verifying peer pieces",
        { timeout: 60000 }
      );
      await fixture.waitForStagedPieceCount(3, 120000);
      const preservedPieces = fixture.stagedPieceEvidence().slice(0, 3);
      expect(preservedPieces).toHaveLength(3);

      const restartPairingCode = await fixture.restartBridge();
      await page.locator("#companionDetectButton").click();
      await expect(page.locator("#companionPairingControls")).toBeVisible({ timeout: 15000 });
      await page.locator("#companionPairingCode").fill(restartPairingCode);
      await page.locator("#companionPairButton").click();
      await expect(page.locator("#companionImportStage")).toContainText("Paused safely", {
        timeout: 15000
      });
      await expect(result.getByRole("button", { name: "Resume & load" })).toBeVisible();

      fixture.setPeerThrottle(0);
      await result.getByRole("button", { name: "Resume & load" }).click();
      await expect.poll(
        () => page.locator("#companionImportStage").textContent(),
        { timeout: 300000 }
      ).toContain("Verified model ready");
      await expect(page.locator("#largeModelDialog")).toBeVisible({ timeout: 30000 });
      await expect(page.locator("#largeModelDialogDownload")).toContainText("924.73 MiB");

      const importedArtifacts = fixture.importedArtifacts();
      expect(importedArtifacts).toHaveLength(1);
      expect(fs.statSync(importedArtifacts[0]).size).toBe(969648576);
      expect(sha256File(importedArtifacts[0])).toBe(fixture.artifactSha256);
      expect(fixture.stagedPieceEvidence().slice(0, 3)).toEqual(preservedPieces);
      const [completedState] = fixture.importStateSummaries();
      expect(completedState.wasResumed).toBe(true);
      expect(completedState.reusedPieceCount).toBeGreaterThanOrEqual(preservedPieces.length);
      expect(completedState.downloadedPieceCount + completedState.reusedPieceCount).toBe(925);

      await page.locator("#largeModelConfirmButton").click();
      await expect(page.locator("#runtimeStatus")).toHaveText("Ready", { timeout: 180000 });
      await expect(page.locator("#localModelState")).toContainText(
        "loaded from a receipt-verified companion import",
        { timeout: 180000 }
      );
      const prompt = "Reply with one short sentence confirming this resumed local model works.";
      await page.locator("#prompt").fill(prompt);
      await page.locator("#prompt").press("Enter", { timeout: 180000 });
      await expect(page.locator(".app-shell")).toHaveAttribute("data-generation-state", "idle", {
        timeout: 180000
      });
      await expect(page.locator("#conversation .message-user")).toHaveCount(1);
      await expect(page.locator("#conversation .message-assistant")).toHaveCount(1);
      await expect(page.locator("#conversation #response")).toHaveCount(1);

      const browserModelStreams = requests.filter((entry) =>
        entry.url.startsWith("http://127.0.0.1:43127/v1/models/") &&
        entry.url.endsWith("/content")
      );
      expect(browserModelStreams).toHaveLength(1);
      expect(requests.filter((entry) => {
        const url = new URL(entry.url);
        return projectHosts.has(url.hostname.toLowerCase()) && /\.slm$/i.test(url.pathname);
      })).toEqual([]);
      expect(requests.filter((entry) => {
        const url = new URL(entry.url);
        return projectHosts.has(url.hostname.toLowerCase()) && entry.postData.includes(prompt);
      })).toEqual([]);
    } finally {
      fixture.setPeerThrottle(0);
      await fixture.dispose();
    }
  });
});
