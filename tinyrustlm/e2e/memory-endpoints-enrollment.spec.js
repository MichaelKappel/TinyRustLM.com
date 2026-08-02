"use strict";

const fs = require("node:fs");
const crypto = require("node:crypto");
const os = require("node:os");
const path = require("node:path");
const { chromium, test, expect } = require("@playwright/test");
const {
  createMemoryEndpointsEnrollmentFixture
} = require("./helpers/memory-endpoints-enrollment-fixture.js");

function removeOwnedRoot(root) {
  const resolved = path.resolve(root);
  const temporaryRoot = path.resolve(os.tmpdir());
  if (!resolved.startsWith(`${temporaryRoot}${path.sep}`) ||
      !path.basename(resolved).startsWith("tinyrustlm-memory-profile-")) {
    throw new Error("Refusing to remove a directory outside the owned memory-profile root");
  }
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}

function secretOccurrences(root, secrets) {
  const needles = secrets.flatMap((secret) => [
    { secret, encoding: "utf8", bytes: Buffer.from(secret, "utf8") },
    { secret, encoding: "utf16le", bytes: Buffer.from(secret, "utf16le") }
  ]);
  const matches = [];
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const bytes = fs.readFileSync(fullPath);
      for (const needle of needles) {
        if (bytes.indexOf(needle.bytes) !== -1) {
          matches.push({
            relativePath: path.relative(root, fullPath).replaceAll(path.sep, "/"),
            encoding: needle.encoding
          });
        }
      }
    }
  };
  visit(root);
  return matches;
}

async function openMemorySettings(page) {
  await page.locator("#sidebarAdvancedToolsButton").click();
  const drawer = page.locator('details[data-panel-key="dashboard-model-source"]');
  if (!(await drawer.evaluate((element) => element.open))) {
    await drawer.locator("summary").click();
  }
  await page.locator("#memoryEndpointsEnrollmentUrl").scrollIntoViewIfNeeded();
  await expect(page.locator("#memoryEndpointsEnrollmentUrl")).toBeVisible();
}

async function loadConversationFixture(page) {
  const fixturePath = path.join(__dirname, "..", "models", "tiny-test-model-q8.slm");
  await page.locator("#modelEditButton").click();
  await page.locator("#simpleLocalSourceButton").click();
  await page.locator("#localModelFile").setInputFiles(fixturePath);
  await page.locator("#simpleImportLocalModelButton").click();
  await expect(page.locator("#runtimeStatus")).toHaveText("Ready", { timeout: 30000 });
  await expect(page.locator("#generateButton")).toBeEnabled();
}

async function sendTurn(page, prompt, expectedMessageCount) {
  await page.locator("#prompt").fill(prompt);
  await page.locator("#prompt").press("Enter");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-generation-state", "idle", {
    timeout: 90000
  });
  await expect(page.locator("#conversation .message")).toHaveCount(expectedMessageCount, {
    timeout: 90000
  });
}

async function browserStorageContains(page, values) {
  return page.evaluate(async (protectedValues) => {
    const serialized = [
      JSON.stringify(Object.fromEntries(Object.entries(localStorage))),
      JSON.stringify(Object.fromEntries(Object.entries(sessionStorage)))
    ];
    if (indexedDB.databases) {
      for (const database of await indexedDB.databases()) {
        if (!database.name) continue;
        const contents = await new Promise((resolve) => {
          const request = indexedDB.open(database.name, database.version);
          request.onerror = () => resolve([]);
          request.onsuccess = () => {
            const db = request.result;
            const names = Array.from(db.objectStoreNames);
            if (!names.length) {
              db.close();
              resolve([]);
              return;
            }
            const transaction = db.transaction(names, "readonly");
            const rows = [];
            let remaining = names.length;
            for (const name of names) {
              const getAll = transaction.objectStore(name).getAll();
              getAll.onsuccess = () => {
                rows.push(getAll.result);
                remaining -= 1;
                if (remaining === 0) {
                  db.close();
                  resolve(rows);
                }
              };
              getAll.onerror = () => {
                remaining -= 1;
                if (remaining === 0) {
                  db.close();
                  resolve(rows);
                }
              };
            }
          };
        });
        serialized.push(JSON.stringify(contents));
      }
    }
    const haystack = serialized.join("\n");
    return protectedValues.filter((value) => haystack.includes(value));
  }, values);
}

test.describe("one-time MemoryEndpoints agent continuity", () => {
  test("deletes one browser profile, restores both memory tiers, rejects URL replay, and deletes its company", async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Persistent-profile continuity runs once on desktop");
    test.slow();

    const applicationOrigin = String(testInfo.project.use.baseURL);
    const service = createMemoryEndpointsEnrollmentFixture();
    const profileRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-memory-profile-"));
    const firstProfile = path.join(profileRoot, "browser-a");
    const secondProfile = path.join(profileRoot, "browser-b");
    let company = null;
    let firstContext = null;
    let secondContext = null;
    let cleanupReceipts = null;

    try {
      await service.listen();
      company = await service.createCompany(`TinyRustLM dogfood ${crypto.randomUUID()}`);
      const invitation = await service.issueInvitation(company.companyId);
      const oneTimeUrl = invitation.invitationUrl;
      const shortMarker = `short-memory-${crypto.randomUUID()}`;
      const longMarker = `long-memory-${crypto.randomUUID()}`;

      firstContext = await chromium.launchPersistentContext(firstProfile, {
        headless: true,
        colorScheme: "dark",
        locale: "en-US",
        viewport: { width: 1365, height: 768 }
      });
      const firstPage = await firstContext.newPage();
      await firstPage.goto(applicationOrigin, { waitUntil: "domcontentloaded" });
      await expect(firstPage.locator("#wasmState")).toHaveText("loaded", { timeout: 30000 });
      await loadConversationFixture(firstPage);
      await openMemorySettings(firstPage);
      await firstPage.locator("#memoryEndpointsBaseUrl").fill(service.baseUrl);
      await firstPage.locator("#memoryEndpointsEnrollmentUrl").fill(oneTimeUrl);
      await firstPage.locator("#memoryEndpointsRequestedAgentName").fill("tinyrustlm-dogfood-agent");
      await firstPage.locator("#memoryEndpointsClaimButton").click();
      await expect(firstPage.locator("#memoryEndpointsEnrollmentUrl")).toHaveValue("");
      await expect(firstPage.locator("#memoryEndpointsStatus")).toContainText("agent created", {
        timeout: 30000
      });
      const canonicalAgentName = await firstPage.locator("#memoryEndpointsCanonicalAgentName").inputValue();
      const agentToken = await firstPage.locator("#memoryEndpointsAgentToken").inputValue();
      expect(canonicalAgentName).toBe("tinyrustlm-dogfood-agent");
      expect(agentToken.length).toBeGreaterThan(24);

      await sendTurn(firstPage, `Remember this short-term marker exactly: ${shortMarker}`, 2);
      await openMemorySettings(firstPage);
      await firstPage.locator("#memoryEndpointsSaveShortTermButton").click();
      await expect(firstPage.locator("#memoryEndpointsStatus")).toContainText("short-term web memory synchronized", {
        timeout: 30000
      });

      await sendTurn(firstPage, `Remember this durable long-term marker exactly: ${longMarker}`, 4);
      await openMemorySettings(firstPage);
      await firstPage.locator("#memoryEndpointsSaveLongTermButton").click();
      await expect(firstPage.locator("#memoryEndpointsStatus")).toContainText("long-term web memory synchronized", {
        timeout: 30000
      });
      expect(await browserStorageContains(firstPage, [oneTimeUrl, agentToken])).toEqual([]);

      await firstContext.close();
      firstContext = null;
      expect(secretOccurrences(firstProfile, [oneTimeUrl, agentToken])).toEqual([]);
      fs.rmSync(firstProfile, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
      expect(fs.existsSync(firstProfile)).toBe(false);

      secondContext = await chromium.launchPersistentContext(secondProfile, {
        headless: true,
        colorScheme: "dark",
        locale: "en-US",
        viewport: { width: 1365, height: 768 }
      });
      const secondPage = await secondContext.newPage();
      await secondPage.goto(applicationOrigin, { waitUntil: "domcontentloaded" });
      await expect(secondPage.locator("#wasmState")).toHaveText("loaded", { timeout: 30000 });
      await openMemorySettings(secondPage);
      await secondPage.locator("#memoryEndpointsBaseUrl").fill(service.baseUrl);
      await secondPage.locator("#memoryEndpointsReconnectName").fill(canonicalAgentName);
      await secondPage.locator("#memoryEndpointsReconnectToken").fill(agentToken);
      await secondPage.locator("#memoryEndpointsReconnectButton").click();
      await expect(secondPage.locator("#memoryEndpointsReconnectToken")).toHaveValue("");
      await expect(secondPage.locator("#memoryEndpointsStatus")).toContainText("agent memory restored", {
        timeout: 30000
      });

      await secondPage.locator("#memoryEndpointsSearchQuery").fill("memory");
      await secondPage.locator("#memoryEndpointsSearchButton").click();
      await expect(secondPage.locator("#memoryEndpointsStatus")).toContainText("2 hosted memory results loaded", {
        timeout: 30000
      });
      await expect(secondPage.locator("#memoryEndpointsSearchResults")).toContainText(shortMarker);
      await expect(secondPage.locator("#memoryEndpointsSearchResults")).toContainText(longMarker);

      await secondPage.locator("#memoryEndpointsEnrollmentUrl").fill(oneTimeUrl);
      await secondPage.locator("#memoryEndpointsRequestedAgentName").fill(canonicalAgentName);
      await secondPage.locator("#memoryEndpointsClaimButton").click();
      await expect(secondPage.locator("#memoryEndpointsEnrollmentUrl")).toHaveValue("");
      await expect(secondPage.locator("#memoryEndpointsStatus")).toContainText("already been used or expired", {
        timeout: 30000
      });
      await expect(secondPage.locator("#memoryEndpointsStatus")).not.toContainText(oneTimeUrl);
      expect(await browserStorageContains(secondPage, [oneTimeUrl, agentToken])).toEqual([]);

      const beforeCleanup = service.snapshot();
      expect(beforeCleanup.companyCount).toBe(1);
      expect(beforeCleanup.agentCount).toBe(1);
      expect(beforeCleanup.eventCount).toBe(2);
      expect(beforeCleanup.rawCredentialStoredInAudit).toBe(false);

      await secondContext.close();
      secondContext = null;
      expect(secretOccurrences(secondProfile, [oneTimeUrl, agentToken])).toEqual([]);
      fs.rmSync(secondProfile, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
      expect(fs.existsSync(secondProfile)).toBe(false);
    } finally {
      if (firstContext) await firstContext.close().catch(() => {});
      if (secondContext) await secondContext.close().catch(() => {});
      if (company) {
        const closed = await service.closeCompany(company.companyId).catch(() => null);
        const deleted = closed
          ? await service.deleteCompany(company.companyId).catch(() => null)
          : null;
        cleanupReceipts = { closed, deleted };
      }
      const finalSnapshot = service.snapshot();
      await service.close().catch(() => {});
      removeOwnedRoot(profileRoot);
      if (company) {
        expect(cleanupReceipts && cleanupReceipts.closed && cleanupReceipts.closed.status).toBe("closed");
        expect(cleanupReceipts && cleanupReceipts.deleted && cleanupReceipts.deleted.deleted).toBe(true);
        expect(finalSnapshot.companyCount).toBe(0);
        expect(finalSnapshot.agentCount).toBe(0);
        expect(finalSnapshot.eventCount).toBe(0);
      }
    }
  });
});
