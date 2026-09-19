"use strict";

const nodeCrypto = require("node:crypto");
const { test, expect } = require("@playwright/test");
const admissionApi = require("../app/browser-model-admission.js");
const catalogApi = require("../app/minimodel-catalog-v1.js");

const catalogUrl = "https://minimodel.org/catalog/compositions.v1.json";
const peerFeedUrl = "https://minimodel.org/catalog/peer-announcements.v1.json";
const supportedSourceRepository = "Qwen/Qwen3-0.6B";
const supportedSourceRevision = "c1899de289a04d12100db370d81485cdf75e47ca";
const fixtureNow = new Date(Math.floor(Date.now() / 1000) * 1000);
const utc = (offsetMilliseconds) =>
  new Date(fixtureNow.getTime() + offsetMilliseconds).toISOString().replace(".000Z", "Z");
const catalogGeneratedAtUtc = utc(-60_000);
const catalogValidUntilUtc = utc(60 * 60_000);
const peerIssuedAtUtc = catalogGeneratedAtUtc;
const peerExpiresUtc = utc(30 * 60_000);
const peerKeyPair = nodeCrypto.generateKeyPairSync("ed25519");
const peerPublicKey = peerKeyPair.publicKey
  .export({ type: "spki", format: "der" })
  .subarray(-32)
  .toString("base64url");
const peerKeyId = "sha256:9999999999999999999999999999999999999999999999999999999999999999";
const publicPeerBaseUrl = "https://8.8.8.8/";
const memberNames = Object.freeze([
  "model.slm2",
  "tokenizer.tokenizer2",
  "template.template2",
  "sampling.sampling2",
  "prompt.prompt2",
  "composition.acg2"
]);

// Produces deterministic schema-shaped digest identities without implying real evidence.
function sha256(character) {
  return `sha256:${character.repeat(64)}`;
}

function canonicalJson(value) {
  return `${JSON.stringify(value)}\n`;
}

function contentSha256(value) {
  return `sha256:${nodeCrypto.createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function compositionIdentities(artifacts) {
  const memberCount = 5;
  const recordBytes = 128;
  const table = Buffer.alloc(memberCount * recordBytes);
  let resolvedMemberBytes = 0;
  for (let index = 0; index < memberCount; index += 1) {
    const artifact = artifacts[index];
    const offset = index * recordBytes;
    table.writeUInt16LE(1, offset);
    table.writeUInt16LE(index + 1, offset + 2);
    table.writeUInt16LE(index + 1, offset + 4);
    table.writeUInt32LE(index, offset + 8);
    table.writeBigUInt64LE(BigInt(artifact.byteCount), offset + 16);
    table.set(Buffer.from(artifact.sha256, "hex"), offset + 24);
    table.set(Buffer.from(artifact.formatProfileSha256, "hex"), offset + 56);
    resolvedMemberBytes += artifact.byteCount;
  }
  const framing = Buffer.alloc(17);
  framing.writeUInt16LE(2, 0);
  framing.writeUInt16LE(0, 2);
  framing.writeUInt8(1, 4);
  framing.writeUInt32LE(memberCount, 5);
  framing.writeBigUInt64LE(BigInt(resolvedMemberBytes), 9);
  const domain = Buffer.from("tinyrustlm.acg2.champion-graph.v1\0", "ascii");
  return {
    graphIdentitySha256: nodeCrypto.createHash("sha256")
      .update(Buffer.concat([domain, framing, table]))
      .digest("hex"),
    memberTableSha256: nodeCrypto.createHash("sha256").update(table).digest("hex"),
    resolvedMemberBytes
  };
}

function qualificationReceiptFixture({ receiptId, modelId, operationId, compositionId }) {
  return {
    schema: catalogApi.QUALIFICATION_RECEIPT_SCHEMA,
    receiptId,
    modelId,
    operationId,
    compositionId,
    sourceEvidenceSha256: "1111111111111111111111111111111111111111111111111111111111111111",
    structuralEvidenceSha256: "2222222222222222222222222222222222222222222222222222222222222222",
    numericalEvidenceSha256: "3333333333333333333333333333333333333333333333333333333333333333",
    qualityEvidenceSha256: "4444444444444444444444444444444444444444444444444444444444444444",
    evalCasesSha256: "5555555555555555555555555555555555555555555555555555555555555555",
    qualityClaim: "general-assistant-qualified",
    qualityScope: "general-assistant",
    numericalStatus: "passed",
    browserStatus: "passed",
    qualityStatus: "qualified",
    issuedAtUtc: utc(-2 * 60_000)
  };
}

function qualificationReceiptForEntry(entry) {
  return qualificationReceiptFixture({
    receiptId: entry.qualification.receipt_id,
    modelId: entry.source.repository,
    operationId: entry.qualification.receipt_id.slice("sha256:".length),
    compositionId: entry.composition.composition_id
  });
}

function peerAnnouncementFixture({
  announcementId,
  compositionId,
  pieceSetSha256,
  issuedAtUtc = peerIssuedAtUtc,
  expiresUtc = peerExpiresUtc
}) {
  const announcement = {
    announcement_id: announcementId,
    composition_id: compositionId,
    piece_set_sha256: pieceSetSha256,
    peer_base_url: publicPeerBaseUrl,
    protocol_profile: catalogApi.DIRECT_COMPOSITION_PROTOCOL_PROFILE,
    consent_status: "explicit",
    consent_receipt_sha256: sha256("6"),
    outside_proof_status: "current-passed",
    outside_proof_receipt_sha256: sha256("7"),
    issued_at_utc: issuedAtUtc,
    expires_utc: expiresUtc,
    verification_key_id: peerKeyId,
    signature: Buffer.alloc(64).toString("base64url")
  };
  announcement.signature = nodeCrypto.sign(
    null,
    Buffer.from(catalogApi.peerAnnouncementSigningBytes(announcement)),
    peerKeyPair.privateKey
  ).toString("base64url");
  return announcement;
}

// Builds one qualified catalog fixture with an optional announcement identity.
function catalogEntry({
  entryId,
  displayName,
  compositionSha,
  revisionCharacter,
  peerId = null,
  repository = supportedSourceRepository,
  revision = supportedSourceRevision
}) {
  const receiptId = sha256(revisionCharacter);
  const qualificationReceiptText = canonicalJson(qualificationReceiptFixture({
    receiptId,
    modelId: repository,
    operationId: revisionCharacter.repeat(64),
    compositionId: compositionSha
  }));
  return {
    entry_id: entryId,
    display_name: displayName,
    description: `${displayName} Playwright fixture`,
    source: {
      repository,
      revision,
      source_lock_sha256: sha256(revisionCharacter)
    },
    license: {
      route: `/licenses/${entryId}.txt`,
      review_status: "reviewed"
    },
    composition: {
      composition_id: compositionSha,
      member_count: memberNames.length,
      members: memberNames.map((name, index) => ({
        name,
        bytes: 1024 + index,
        sha256: sha256(((index + 1) % 10).toString()),
        schema: "minimodel.member.v1"
      }))
    },
    browser_admission: {
      route: `/admissions/${entryId}.browser-composition-admission.json`,
      bytes: 1024,
      sha256: sha256(revisionCharacter)
    },
    profiles: {
      conversion: "playwright.conversion.v1",
      quantization: "q8_0",
      runtime: "playwright.browser.v1"
    },
    qualification: {
      status: "qualified",
      receipt_id: receiptId,
      receipt_route: `/catalog/qualification-receipts/${entryId}.json`,
      receipt_bytes: Buffer.byteLength(qualificationReceiptText, "utf8"),
      receipt_sha256: contentSha256(qualificationReceiptText),
      numerical_status: "passed",
      browser_status: "passed",
      quality_status: "qualified"
    },
    peer_announcement_ids: peerId ? [peerId] : []
  };
}

// Binds one canonical browser admission to an existing qualified catalog entry.
function browserAdmissionFixture(entry) {
  const byteCounts = [37, 43, 31, 65_800, 512, 896];
  entry.composition.members.forEach((member, index) => {
    member.bytes = byteCounts[index];
  });
  const artifacts = admissionApi.artifactSpecs.map((spec, index) => ({
    role: spec.role,
    format: spec.format,
    fileName: spec.fileName,
    byteCount: entry.composition.members[index].bytes,
    sha256: entry.composition.members[index].sha256.slice("sha256:".length),
    formatProfileSha256: spec.profileSha256
  }));
  const composition = compositionIdentities(artifacts);
  entry.composition.composition_id = `sha256:${composition.graphIdentitySha256}`;
  const residentDependencyBytes = artifacts.slice(1, 5)
    .reduce((total, artifact) => total + artifact.byteCount, 0);
  const receipt = qualificationReceiptForEntry(entry);
  const receiptText = canonicalJson(receipt);
  entry.qualification.receipt_bytes = Buffer.byteLength(receiptText, "utf8");
  entry.qualification.receipt_sha256 = contentSha256(receiptText);
  const admission = admissionApi.normalizeAdmission({
    schema: admissionApi.schema,
    modelId: receipt.modelId,
    operationId: receipt.operationId,
    artifacts,
    composition: {
      graphIdentitySha256: composition.graphIdentitySha256,
      memberTableSha256: composition.memberTableSha256,
      resolvedMemberBytes: composition.resolvedMemberBytes
    },
    qualification: {
      receiptId: receipt.receiptId,
      sourceEvidenceSha256: receipt.sourceEvidenceSha256,
      structuralEvidenceSha256: receipt.structuralEvidenceSha256,
      numericalEvidenceSha256: receipt.numericalEvidenceSha256,
      qualityEvidenceSha256: receipt.qualityEvidenceSha256,
      evalCasesSha256: receipt.evalCasesSha256,
      qualityClaim: receipt.qualityClaim,
      qualityScope: receipt.qualityScope
    },
    runtime: {
      workerProtocol: admissionApi.workerProtocol,
      wasmByteCount: 8,
      wasmSha256: "b".repeat(64),
      policy: {
        maximumModelBytes: artifacts[0].byteCount,
        maximumSequenceTokens: 4096,
        maximumKvBytes: 64 * 1024 * 1024,
        maximumScratchBytes: 32 * 1024 * 1024,
        maximumResolvedMemberBytes: composition.resolvedMemberBytes,
        maximumResidentDependencyBytes: residentDependencyBytes,
        maximumRequestBytes: 1_054_848,
        maximumLinearMemoryBytes: 128 * 1024 * 1024
      },
      defaultSampling: {
        temperatureMillionths: 600_000,
        topK: 20,
        topPMillionths: 950_000,
        repetitionPenaltyMillionths: 1_000_000,
        repetitionWindow: 64,
        maximumNewTokens: 512
      }
    }
  });
  const admissionText = admissionApi.serializeAdmission(admission);
  entry.browser_admission.bytes = Buffer.byteLength(admissionText, "utf8");
  entry.browser_admission.sha256 = contentSha256(admissionText);
  return admissionText;
}

// Wraps entries in the strict current catalog envelope used by the application loader.
function catalogFixture(entries = []) {
  return {
    schema: catalogApi.CATALOG_SCHEMA,
    catalog_id: "playwright.compact-chooser",
    revision: 1,
    generated_at_utc: catalogGeneratedAtUtc,
    valid_until_utc: catalogValidUntilUtc,
    project_server_serves_model_bytes: false,
    project_server_proxies_model_bytes: false,
    project_server_runs_inference: false,
    qualification_policy: "exact-current-evidence-required",
    qualification_receipt_schema: catalogApi.QUALIFICATION_RECEIPT_SCHEMA,
    browser_admission_schema: catalogApi.BROWSER_ADMISSION_SCHEMA,
    peer_verification_keys: [{
      key_id: peerKeyId,
      algorithm: "Ed25519",
      public_key_base64url: peerPublicKey,
      not_before_utc: utc(-60 * 60_000),
      not_after_utc: utc(2 * 60 * 60_000)
    }],
    revoked_qualification_receipt_ids: [],
    supersessions: [],
    entries
  };
}

// Wraps announcement metadata without representing a live peer reachability probe.
function peerFeedFixture(announcements = [], {
  validUntilUtc = catalogValidUntilUtc
} = {}) {
  return {
    schema: catalogApi.PEER_SCHEMA,
    feed_id: "playwright.compact-chooser",
    revision: 1,
    generated_at_utc: catalogGeneratedAtUtc,
    valid_until_utc: validUntilUtc,
    project_server_serves_model_bytes: false,
    project_server_proxies_model_bytes: false,
    announcements
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

// Stubs catalog and announcement outcomes independently for truthful-state coverage.
async function routeCatalog(page, {
  entries = [],
  announcements = [],
  catalogBody = null,
  catalogStatus = 200,
  catalogGate = null,
  peerFeedBody = null,
  peerFeedStatus = 200
} = {}) {
  for (const entry of entries) {
    const receiptText = canonicalJson(qualificationReceiptForEntry(entry));
    await page.route(`**${entry.qualification.receipt_route}`, (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Length": String(Buffer.byteLength(receiptText, "utf8"))
      },
      body: receiptText
    }));
  }
  await page.route(catalogUrl, async (route) => {
    if (catalogGate) {
      await catalogGate;
    }
    return route.fulfill({
      status: catalogStatus,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: canonicalJson(catalogBody || catalogFixture(entries))
    });
  });
  await page.route(peerFeedUrl, (route) => route.fulfill({
    status: peerFeedStatus,
    contentType: "application/json",
    headers: { "Access-Control-Allow-Origin": "*" },
    body: canonicalJson(peerFeedBody || peerFeedFixture(announcements))
  }));
}

// Boots a fresh app page and establishes the compact auto-chooser baseline for each test.
async function openApplication(page, routes = {}) {
  await routeCatalog(page, routes);
  await page.goto("/app/", { waitUntil: "domcontentloaded" });
  const shell = page.locator(".app-shell");
  const advancedModelDrawer = page.locator('details[data-panel-key="dashboard-model-source"]');
  await expect(shell).toHaveAttribute("data-conversation-state", "empty");
  await expect(shell).toHaveAttribute("data-mode", "simple");
  await expect(shell).toHaveAttribute("data-rail-collapsed", "true");
  await expect(page.locator("#diagnosticsRail .advanced-scroll")).toBeHidden();
  await expect(advancedModelDrawer).toHaveJSProperty("open", false);
  await expect(page.locator("#hfSearchInput")).toHaveValue("");
  await expect(page.locator("#modelToolbarName")).toHaveText("Choose a model");
  await expect(page.locator("#simpleDiscoveryPanel")).toBeVisible();
  if (routes.advanced) await openAdvancedChooser(page);
}

// Exercises explicit Advanced entry before testing optional conversion workflows.
async function openAdvancedChooser(page) {
  await page.locator("#simpleOpenAdvancedDiscoveryButton").click();
  await page.locator('details[data-panel-key="dashboard-model-source"] > summary').click();
  await page.locator("#diagnosticsRailToggle").click();
  await page.locator("#modelEditButton").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-mode", "advanced");
}

async function expectNoHorizontalOverflow(locator) {
  const metrics = await locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const panel = element.closest("#simpleDiscoveryPanel");
    const panelBounds = panel ? panel.getBoundingClientRect() : bounds;
    const activeElement = document.activeElement;
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      left: bounds.left,
      right: bounds.right,
      panelLeft: panelBounds.left,
      panelRight: panelBounds.right,
      containsFocusedDescendant: Boolean(
        activeElement && activeElement !== element && element.contains(activeElement)
      ),
      viewportWidth: window.innerWidth
    };
  });
  if (!metrics.containsFocusedDescendant) {
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  }
  expect(metrics.left).toBeGreaterThanOrEqual(-1);
  expect(metrics.right).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.left).toBeGreaterThanOrEqual(metrics.panelLeft - 1);
  expect(metrics.right).toBeLessThanOrEqual(metrics.panelRight + 1);
}

// Proves hostile chooser content stays inside both its own box and the viewport.
async function expectChooserContentContained(page, selectors) {
  const metrics = await page.evaluate((targets) => targets.map((selector) => {
    const element = document.querySelector(selector);
    if (!element) {
      return { selector, missing: true };
    }
    const bounds = element.getBoundingClientRect();
    const overflowingDescendants = Array.from(element.querySelectorAll("*"))
      .filter((candidate) => {
        const candidateBounds = candidate.getBoundingClientRect();
        return candidate.scrollWidth > candidate.clientWidth + 1 ||
          candidateBounds.left < bounds.left - 1 ||
          candidateBounds.right > bounds.right + 1;
      })
      .slice(0, 8)
      .map((candidate) => ({
        id: candidate.id,
        className: typeof candidate.className === "string" ? candidate.className : "",
        clientWidth: candidate.clientWidth,
        scrollWidth: candidate.scrollWidth,
        left: candidate.getBoundingClientRect().left,
        right: candidate.getBoundingClientRect().right
      }));
    return {
      selector,
      missing: false,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      left: bounds.left,
      right: bounds.right,
      viewportWidth: window.innerWidth,
      overflowingDescendants
    };
  }), selectors);
  for (const metric of metrics) {
    expect(metric.missing, `${metric.selector} must exist`).toBe(false);
    expect(
      metric.scrollWidth,
      `${metric.selector} must not scroll horizontally: ${JSON.stringify(metric.overflowingDescendants)}`
    )
      .toBeLessThanOrEqual(metric.clientWidth + 1);
    expect(metric.left, `${metric.selector} must stay inside the viewport`)
      .toBeGreaterThanOrEqual(-1);
    expect(metric.right, `${metric.selector} must stay inside the viewport`)
      .toBeLessThanOrEqual(metric.viewportWidth + 1);
  }
}

test.describe("compact model chooser", () => {
  test("bootstrap starts the server-seeded model without a chooser click and can cancel", async ({ page }) => {
    const entry = catalogEntry({ entryId: "bootstrap", displayName: "Starter",
      compositionSha: sha256("5"), revisionCharacter: "5", peerId: "bootstrap-peer" });
    browserAdmissionFixture(entry);
    const announcement = peerAnnouncementFixture({ announcementId: "bootstrap-peer",
      compositionId: entry.composition.composition_id, pieceSetSha256: sha256("8") });
    announcement.peer_base_url = "https://minimodel.org/";
    announcement.signature = nodeCrypto.sign(null,
      Buffer.from(catalogApi.peerAnnouncementSigningBytes(announcement)),
      peerKeyPair.privateKey).toString("base64url");
    const gate = deferred();
    let admissionRequests = 0;
    await page.route(`**${entry.browser_admission.route}`, async (route) => {
      admissionRequests += 1;
      await gate.promise;
      await route.abort();
    });
    try {
      await routeCatalog(page, { entries: [entry], announcements: [announcement] });
      await page.goto("/app/", { waitUntil: "domcontentloaded" });
      await expect.poll(() => admissionRequests).toBe(1);
      await expect(page.locator("#simpleModelActionButton")).toBeVisible();
      await page.locator("#simpleModelActionButton").click();
      await expect(page.locator("#simpleModelPickerStatus")).toHaveText("Model acquisition cancelled.");
      await expect(page.locator("#generateButton")).toBeDisabled();
    } finally {
      gate.resolve();
    }
  });

  test("Chat hides source conversion and manual peers until Advanced is opened", async ({ page }) => {
    const entry = catalogEntry({ entryId: "advanced-source", displayName: "Advanced Source",
      compositionSha: sha256("5"), revisionCharacter: "5" });
    await openApplication(page, { entries: [entry] });
    await expect(page.locator('.simple-model-option')).toHaveCount(0);
    await expect(page.locator('#simplePeerBaseUrlInput')).toBeHidden();
    await expect(page.locator('#localModelFile')).toBeHidden();
    await page.locator('#simpleOpenAdvancedDiscoveryButton').click();
    await expect(page.locator('.app-shell')).toHaveAttribute('data-mode', 'advanced');
    await expect(page.locator('#hfSearchInput')).toBeVisible();
  });

  test("opens automatically and closes explicitly without basic technical controls", async ({ page }, testInfo) => {
    await openApplication(page);
    const opener = page.locator("#modelEditButton");
    const chooser = page.locator("#simpleDiscoveryPanel");
    const heroHeading = page.locator("#simpleExperience > h2");
    const heroDescription = page.locator("#simpleExperience > p");
    const usesCompactChooser = (page.viewportSize()?.width ?? Number.POSITIVE_INFINITY) <= 899;

    await expect(chooser).toBeVisible();
    if (usesCompactChooser) {
      await expect(heroHeading).toHaveCSS("opacity", "0");
      await expect(heroDescription).toHaveCSS("opacity", "0");
    }
    await expect(opener).toHaveAttribute("aria-expanded", "true");
    await expect(chooser).toHaveAttribute("role", "dialog");
    await expect(chooser).toHaveAttribute("aria-modal", "false");
    await expect(chooser).toHaveAttribute("aria-busy", "false");
    await expect(chooser).toHaveAttribute("aria-describedby", "simpleModelPickerDescription");
    await expect(chooser.locator("#simpleModelPickerDescription")).toHaveText(
      "Your starter model downloads from MiniModel.org and runs privately in this browser. You can choose another model here."
    );
    await expect(chooser.locator("#simpleDiscoveryStatus")).toHaveText(
      "Choose a model to continue."
    );
    await expect(opener).toHaveAttribute("aria-controls", "simpleDiscoveryPanel");
    await expect(chooser.getByRole("button", { name: "Close model chooser" })).toBeVisible();
    await expect(chooser.locator("input")).toHaveCount(1);
    await expect(chooser.locator("#simpleLocalCompositionFile, #simpleChooseLocalButton"))
      .toHaveCount(0);
    await expect(chooser.locator("#simpleCompanionPairing")).toBeHidden();
    await expect(chooser.locator("#simpleCompanionPairingCode")).toBeHidden();
    await expect(chooser.locator(
      "#hfSearchInput, #simplePeerBaseUrlInput, #localModelFile, #modelSelect, select, textarea"
    ))
      .toHaveCount(0);
    await expect(chooser).not.toContainText(/Hugging Face|Known peer URL|receipt ledger|Pair companion/i);
    await expect(chooser.locator("#simpleModelPickerStatus")).not.toHaveAttribute("aria-live");
    await expect(chooser.getByRole("status")).toHaveCount(1);
    await expect(chooser.locator("#simpleModelActionButton")).toHaveAttribute(
      "aria-describedby",
      "simpleModelPickerStatus"
    );
    await expect(page.locator("#generateButton")).toBeDisabled();
    await expectNoHorizontalOverflow(chooser);
    await page.screenshot({
      path: testInfo.outputPath(`model-chooser-empty-${testInfo.project.name}.png`)
    });

    await chooser.getByRole("button", { name: "Close model chooser" }).click();
    await expect(chooser).toBeHidden();
    await expect(opener).toHaveAttribute("aria-expanded", "false");
    await expect(opener).toBeFocused();
    if (usesCompactChooser) {
      await expect(heroHeading).toHaveCSS("opacity", "1");
      await expect(heroDescription).toHaveCSS("opacity", "1");
    }

    await opener.click();
    await page.keyboard.press("Escape");
    await expect(chooser).toBeHidden();
    await expect(opener).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(".app-shell")).toHaveAttribute("data-mode", "simple");
    await expect(page.locator("#diagnosticsRail .advanced-scroll")).toBeHidden();
  });

  test("dedupes re-entrant P2P intent and reserves cancellation for Cancel", async ({ page }) => {
    const admissionGate = deferred();
    const admissionServed = deferred();
    const entryId = "busy-p2p-choice";
    const peerId = "playwright.busy-p2p-choice";
    const entry = catalogEntry({
      entryId,
      displayName: "Busy P2P Choice",
      compositionSha: sha256("5"),
      revisionCharacter: "5",
      peerId
    });
    const admissionText = browserAdmissionFixture(entry);
    const compositionId = entry.composition.composition_id;
    let admissionRequests = 0;
    const peerRequestUrls = [];
    await page.route(`${publicPeerBaseUrl}**`, (route) => {
      peerRequestUrls.push(route.request().url());
      return route.abort();
    });
    await page.route(`**${entry.browser_admission.route}`, async (route) => {
      admissionRequests += 1;
      await admissionGate.promise;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Length": String(Buffer.byteLength(admissionText, "utf8"))
        },
        body: admissionText
      });
      admissionServed.resolve();
    });
    await openApplication(page, {
      entries: [entry],
      announcements: [peerAnnouncementFixture({
        announcementId: peerId,
        compositionId,
        pieceSetSha256: sha256("4")
      })]
    });

    const chooser = page.locator("#simpleDiscoveryPanel");
    const card = chooser.locator(`[data-composition-id="${compositionId}"]`);
    const action = chooser.getByRole("button", { name: "Cancel model acquisition" });
    await expect(card).toHaveAttribute("data-route", "qualified-p2p");
    await card.click();
    await expect.poll(() => admissionRequests).toBe(1);
    await expect(page.locator("#simpleModelList")).toHaveAttribute("aria-busy", "true");
    await expect(chooser).toHaveAttribute("aria-busy", "false");
    await expect(card).toBeDisabled();
    await expect(action).toBeVisible();
    await expect(action).toBeEnabled();
    await expect(action).toHaveAttribute("aria-describedby", "simpleModelPickerStatus");
    await expect(action).toBeFocused();

    await card.dispatchEvent("click");
    await card.dispatchEvent("click");
    await page.evaluate(() => new Promise((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
    }));
    expect(admissionRequests).toBe(1);
    await expect(action).toBeVisible();
    await expect(page.locator("#simpleModelList")).toHaveAttribute("aria-busy", "true");
    await expect(page.locator("#simpleModelPickerStatus")).not.toContainText(/cancel/iu);

    try {
      await action.click();
      // Cancellation must settle even while the verified admission response is still held.
      await expect(action).toBeHidden();
      await expect(page.locator("#simpleModelPickerStatus")).toHaveText(
        "Model acquisition cancelled."
      );
      await expect(card).toBeFocused();
      await expect(card).toBeEnabled();
      await expect(page.locator("#simpleModelList")).toHaveAttribute("aria-busy", "false");
    } finally {
      admissionGate.resolve();
    }
    await admissionServed.promise;
    await page.evaluate(() => new Promise((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
    }));
    await expect(page.locator("#simpleModelPickerStatus")).toHaveText(
      "Model acquisition cancelled."
    );
    await expect(card).toHaveAttribute("data-route", "qualified-p2p");
    await expect(card).toHaveAttribute("data-recovery", "false");
    await expect(chooser.locator("#simpleCompanionPairing")).toBeHidden();
    await expect(page.locator("#generateButton")).toBeDisabled();
    expect(peerRequestUrls).toEqual([]);
    expect(admissionRequests).toBe(1);
  });

  for (const stage of ["qualification", "admission"]) {
    test("stops a stalled " + stage + " document before model transfer", async ({ page }) => {
      const gate = deferred();
      const served = deferred();
      const peerId = "playwright.metadata-deadline";
      const entry = catalogEntry({
        entryId: "metadata-deadline",
        displayName: "Metadata Deadline Fixture",
        compositionSha: sha256("5"),
        revisionCharacter: "5",
        peerId
      });
      const admissionText = browserAdmissionFixture(entry);
      let metadataRequests = 0;
      let peerRequests = 0;
      await page.clock.install({ time: fixtureNow });
      await page.route(`${publicPeerBaseUrl}**`, route => {
        peerRequests += 1;
        return route.abort();
      });
      await openApplication(page, {
        entries: [entry],
        announcements: [peerAnnouncementFixture({
          announcementId: peerId,
          compositionId: entry.composition.composition_id,
          pieceSetSha256: sha256("4")
        })]
      });
      const routePath = stage === "qualification"
        ? entry.qualification.receipt_route : entry.browser_admission.route;
      const body = stage === "qualification"
        ? canonicalJson(qualificationReceiptForEntry(entry)) : admissionText;
      await page.route(`**${routePath}`, async route => {
        metadataRequests += 1;
        await gate.promise;
        try {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Content-Length": String(Buffer.byteLength(body))
            },
            body
          });
        } finally {
          served.resolve();
        }
      });
      const card = page.locator("#simpleModelList [data-composition-id]");
      await card.click();
      await expect.poll(() => metadataRequests).toBe(1);
      await expect(page.locator("#simpleModelList")).toHaveAttribute("aria-busy", "true");
      try {
        await page.clock.fastForward(31_000);
        await expect(page.locator("#simpleModelPickerStatus")).toHaveText(
          "P2P install stopped: Checking the model took too long. Check your connection and try again."
        );
        await expect(page.locator("#errorState")).toContainText("(catalog-admission-timeout)");
        await expect(card).toBeEnabled();
        await expect(page.locator("#simpleModelList")).toHaveAttribute("aria-busy", "false");
        await expect(page.getByRole("button", { name: "Cancel model acquisition" })).toBeHidden();
        await expect(page.locator("#generateButton")).toBeDisabled();
      } finally {
        gate.resolve();
      }
      await served.promise;
      expect(metadataRequests).toBe(1);
      expect(peerRequests).toBe(0);
    });
  }

  test("keeps chooser focus stable across an explicit catalog refresh", async ({ page }) => {
    await openApplication(page);
    const gate = deferred();
    await page.unroute(catalogUrl);
    await page.route(catalogUrl, async (route) => {
      await gate.promise;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: canonicalJson(catalogFixture([]))
      });
    });

    const refresh = page.locator("#simpleModelRefreshButton");
    const close = page.locator("#simpleModelCloseButton");
    await expect(refresh).toBeFocused();
    await refresh.click();
    await expect(refresh).toBeDisabled();
    await expect(close).toBeFocused();

    gate.resolve();
    await expect(refresh).toBeEnabled();
    await expect(refresh).toBeFocused();
  });

  test("contains valid 160-character model names and status text at every chooser viewport", async ({ page }) => {
    const hostileName = "M".repeat(160);
    const compositionId = sha256("3");
    await page.setViewportSize({ width: 390, height: 844 });
    await openApplication(page, { advanced: true,
      entries: [catalogEntry({
        entryId: "hostile-unbroken-model-name",
        displayName: hostileName,
        compositionSha: compositionId,
        revisionCharacter: "3"
      })]
    });

    const card = page.locator(`[data-composition-id="${compositionId}"]`);
    await expect(card).toContainText(hostileName);
    await card.click();
    await expect(page.locator("#simpleModelPickerStatus")).toContainText(hostileName);

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 900 },
      { width: 1280, height: 900 }
    ]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => new Promise((resolve) => {
        window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
      }));
      await expectChooserContentContained(page, [
        "#simpleDiscoveryPanel",
        "#simpleModelPickerStatus",
        "#simpleModelList",
        `[data-composition-id="${compositionId}"]`,
        `[data-composition-id="${compositionId}"] .simple-model-identity strong`
      ]);
    }
  });

  test("offers explicit local conversion only after a typed P2P failure", async ({ page }) => {
    const entryId = "typed-p2p-recovery";
    const peerId = "playwright.typed-p2p-recovery";
    const entry = catalogEntry({
      entryId,
      displayName: "Typed Recovery Model",
      compositionSha: sha256("e"),
      revisionCharacter: "e",
      peerId
    });
    const admissionText = browserAdmissionFixture(entry);
    const compositionId = entry.composition.composition_id;
    let admissionRequests = 0;
    const peerRequestUrls = [];
    let huggingFaceRequests = 0;
    await page.route(`**${entry.browser_admission.route}`, (route) => {
      admissionRequests += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Length": String(Buffer.byteLength(admissionText, "utf8"))
        },
        body: admissionText
      });
    });
    await page.route(`${publicPeerBaseUrl}**`, (route) => {
      peerRequestUrls.push(route.request().url());
      return route.fulfill({
        status: 503,
        contentType: "application/octet-stream",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: ""
      });
    });
    await page.route("https://huggingface.co/api/models**", (route) => {
      huggingFaceRequests += 1;
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });
    await openApplication(page, { advanced: true,
      entries: [entry],
      announcements: [peerAnnouncementFixture({
        announcementId: peerId,
        compositionId,
        pieceSetSha256: sha256("1")
      })]
    });

    const chooser = page.locator("#simpleDiscoveryPanel");
    const card = chooser.locator(`[data-composition-id="${compositionId}"]`);
    const pairing = chooser.locator("#simpleCompanionPairing");
    const advancedDrawer = page.locator('details[data-panel-key="dashboard-model-source"]');
    await expect(card).toHaveAttribute("data-route", "qualified-p2p");
    await expect(card).toHaveAttribute("data-recovery", "false");
    await card.click();
    await expect.poll(() => admissionRequests).toBe(1);
    await expect.poll(() => peerRequestUrls.length).toBe(1);

    await expect(page.locator("#simpleModelPickerStatus")).toHaveText(
      "P2P download stopped. Select Typed Recovery Model again to prepare it on this device."
    );
    await expect(card).toHaveAttribute("data-route", "supported-local-conversion");
    await expect(card).toHaveAttribute("data-recovery", "true");
    await expect(card).toContainText("P2P stopped - prepare on this device");
    await expect(pairing).toBeHidden();
    await expect(advancedDrawer).toHaveJSProperty("open", false);
    await expect(page.locator("#hfSearchInput")).toHaveValue("");
    await expect(page.locator("#hfResults > *")).toHaveCount(0);
    expect(admissionRequests).toBe(1);
    expect(peerRequestUrls).toEqual([
      catalogApi.directPeerUrlAuthority.buildCompositionMemberUrl(
        publicPeerBaseUrl,
        compositionId,
        "model.slm2"
      )
    ]);
    expect(huggingFaceRequests).toBe(0);

    await card.click();
    await expect(pairing).toBeVisible();
    await expect(page.locator("#simpleModelPickerStatus")).toHaveText(
      "Connect the desktop companion once to get Typed Recovery Model."
    );
    await expect(chooser.getByLabel("One-time companion pairing code")).toBeFocused();
    await expect(advancedDrawer).toHaveJSProperty("open", false);
    expect(admissionRequests).toBe(1);
    expect(huggingFaceRequests).toBe(0);
  });

  test("expires a displayed signed P2P listing before stale click dispatch", async ({ page }) => {
    const expiryOffsetMilliseconds = 60_000;
    const expiresUtc = utc(expiryOffsetMilliseconds);
    const entryId = "expiring-signed-p2p-choice";
    const peerId = "playwright.expiring-signed-p2p-choice";
    const compositionId = sha256("8");
    const entry = catalogEntry({
      entryId,
      displayName: "Expiring Signed P2P Choice",
      compositionSha: compositionId,
      revisionCharacter: "8",
      peerId
    });
    const announcement = peerAnnouncementFixture({
      announcementId: peerId,
      compositionId,
      pieceSetSha256: sha256("2"),
      expiresUtc
    });
    const peerFeed = peerFeedFixture([announcement], { validUntilUtc: expiresUtc });
    const verifiedFixtureView = await catalogApi.buildVerifiedCatalogView(
      catalogFixture([entry]),
      peerFeed,
      { crypto: nodeCrypto.webcrypto, now: fixtureNow }
    );
    expect(verifiedFixtureView).toHaveLength(1);
    expect(verifiedFixtureView[0].availability).toBe("peer");
    expect(verifiedFixtureView[0].peerCount).toBe(1);
    expect(verifiedFixtureView[0].peers[0].feedValidUntilUtc).toBe(expiresUtc);
    expect(verifiedFixtureView[0]).not.toHaveProperty("feedValidUntilUtc");
    expect(verifiedFixtureView[0].peers[0].expiresUtc).toBe(expiresUtc);
    let peerRequestCount = 0;
    await page.clock.install({ time: fixtureNow });
    await page.route(`${publicPeerBaseUrl}**`, (route) => {
      peerRequestCount += 1;
      return route.abort();
    });
    await openApplication(page, { advanced: true,
      entries: [entry],
      peerFeedBody: peerFeed
    });

    const chooser = page.locator("#simpleDiscoveryPanel");
    const card = chooser.locator(`[data-composition-id="${compositionId}"]`);
    const advancedDrawer = page.locator('details[data-panel-key="dashboard-model-source"]');
    await expect(card).toHaveAttribute("data-route", "qualified-p2p");
    await expect(card).toHaveAttribute("data-default", "true");
    await expect(card).toContainText("P2P download");
    await expect(card).toBeFocused();
    expect(peerRequestCount).toBe(0);

    await page.clock.fastForward(expiryOffsetMilliseconds + 1_000);

    await expect(page.locator("#simpleModelPickerStatus")).toHaveText(
      "Signed P2P listings expired. Refresh the model list before trying a peer; supported on-device preparation remains available."
    );
    await expect(card).toHaveAttribute("data-route", "supported-local-conversion");
    await expect(card).not.toHaveAttribute("data-route", "qualified-p2p");
    await expect(card).toHaveAttribute("data-default", "true");
    await expect(card).toContainText("Prepare on this device");
    await expect(card).toHaveAccessibleName(
      /Expiring Signed P2P Choice.*Prepare on this device.*Select to convert/u
    );
    await expect(card).toBeEnabled();
    await expect(advancedDrawer).toHaveJSProperty("open", false);
    expect(peerRequestCount).toBe(0);

    await card.click();

    await expect(chooser.locator("#simpleCompanionPairing")).toBeVisible();
    await expect(page.locator("#simpleModelPickerStatus")).toHaveText(
      "Connect the desktop companion once to get Expiring Signed P2P Choice."
    );
    await expect(chooser.getByLabel("One-time companion pairing code")).toBeFocused();
    await expect(advancedDrawer).toHaveJSProperty("open", false);
    expect(peerRequestCount).toBe(0);
  });

  test("rechecks a peer announcement deadline at click time while its feed stays current", async ({ page }) => {
    const peerId = "playwright.expired-announcement";
    const entry = catalogEntry({
      entryId: "expired-announcement",
      displayName: "Expired Announcement Model",
      compositionSha: sha256("7"),
      revisionCharacter: "7",
      peerId
    });
    const admissionText = browserAdmissionFixture(entry);
    const compositionId = entry.composition.composition_id;
    const announcement = peerAnnouncementFixture({
      announcementId: peerId,
      compositionId,
      pieceSetSha256: sha256("6"),
      expiresUtc: utc(60_000)
    });
    const peerFeed = peerFeedFixture([announcement]);
    const verified = await catalogApi.buildVerifiedCatalogView(
      catalogFixture([entry]),
      peerFeed,
      { crypto: nodeCrypto.webcrypto, now: fixtureNow }
    );
    expect(verified[0].peers[0].signatureVerified).toBe(true);
    expect(verified[0].peers[0].feedValidUntilUtc).toBe(catalogValidUntilUtc);
    const requestUrls = [];
    await page.route(`**${entry.browser_admission.route}`, (route) => {
      requestUrls.push(route.request().url());
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Length": String(Buffer.byteLength(admissionText, "utf8"))
        },
        body: admissionText
      });
    });
    await page.route(`${publicPeerBaseUrl}**`, (route) => {
      requestUrls.push(route.request().url());
      return route.abort();
    });
    await page.clock.install({ time: fixtureNow });
    await openApplication(page, { advanced: true, entries: [entry], peerFeedBody: peerFeed });
    const chooser = page.locator("#simpleDiscoveryPanel");
    const card = chooser.locator(`[data-composition-id="${compositionId}"]`);
    await expect(card).toHaveAttribute("data-route", "qualified-p2p");
    expect(requestUrls).toEqual([]);

    // A wall-clock jump leaves the rendered card stale without firing the feed timer.
    await page.clock.setFixedTime(new Date(utc(61_000)));
    await card.click();
    await expect(chooser.locator("#simpleCompanionPairing")).toBeVisible();
    await expect(page.locator("#simpleModelPickerStatus")).toHaveText(
      "Connect the desktop companion once to get Expired Announcement Model."
    );
    await expect(card).toHaveAttribute("data-route", "supported-local-conversion");
    await expect(card).toHaveAttribute("data-recovery", "false");
    await expect(page.locator("#generateButton")).toBeDisabled();
    expect(requestUrls).toEqual([]);
  });

  test("discloses Advanced model options with an empty Hugging Face search", async ({ page }) => {
    let huggingFaceRequestCount = 0;
    await page.route("https://huggingface.co/api/models**", (route) => {
      huggingFaceRequestCount += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]"
      });
    });
    await openApplication(page);
    const chooser = page.locator("#simpleDiscoveryPanel");
    const drawer = page.locator('details[data-panel-key="dashboard-model-source"]');

    await expect(page.locator("#simpleModelList")).toHaveAttribute("aria-busy", "false");
    await page.evaluate(() => new Promise((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
    }));
    expect(huggingFaceRequestCount).toBe(0);
    await expect(drawer).toHaveJSProperty("open", false);
    await expect(page.locator("#hfSearchInput")).toHaveValue("");
    await expect(page.locator("#hfSearchInput")).not.toHaveAttribute("placeholder", /.+/u);
    await expect(page.locator("#hfResults > *")).toHaveCount(0);

    await page.locator("#simpleOpenAdvancedDiscoveryButton").click();

    await expect(chooser).toBeHidden();
    await expect(page.locator("#modelEditButton")).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(".app-shell")).toHaveAttribute("data-mode", "advanced");
    await expect(page.locator(".app-shell")).toHaveAttribute("data-rail-collapsed", "false");
    await expect(page.locator("#diagnosticsRail .advanced-scroll")).toBeVisible();
    await expect(drawer).toHaveJSProperty("open", true);
    await expect(page.locator("#localModelFile")).toBeVisible();
    await expect(page.locator("#simplePeerBaseUrlInput")).toBeVisible();
    await expect(page.locator("#hfSearchInput")).toBeVisible();
    await expect(page.locator("#hfSearchInput")).toHaveValue("");
    await expect(page.locator("#companionSeedStatus")).toHaveText(
      "Local direct sharing has not started. No public reachability or announcement is claimed."
    );
    await expect(page.locator("#companionSeedStatus")).toHaveAttribute("data-state", "idle");
    await expect(page.locator("#companionSeedStatus")).toHaveAttribute("data-code", "none");
    await expect(drawer.locator(":scope > summary")).toBeFocused();
    await page.evaluate(() => new Promise((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
    }));
    expect(huggingFaceRequestCount).toBe(0);

    const modelOpener = page.locator("#modelEditButton");
    await modelOpener.focus();
    await expect(modelOpener).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(chooser).toBeVisible();
    await expect(page.locator(".app-shell")).toHaveAttribute("data-mode", "advanced");
    await expect(page.locator(".app-shell")).toHaveAttribute("data-rail-collapsed", "true");
    await expect(page.locator("#diagnosticsRail .advanced-scroll")).toBeHidden();
  });

  test("does not steal focus or reopen after Advanced is chosen while the catalog is delayed", async ({ page }) => {
    const gate = deferred();
    await page.setViewportSize({ width: 390, height: 844 });
    await routeCatalog(page, {
      catalogGate: gate.promise,
      entries: [catalogEntry({
        entryId: "delayed-supported-choice",
        displayName: "Delayed Supported Choice",
        compositionSha: sha256("6"),
        revisionCharacter: "6"
      })]
    });
    await page.goto("/app/", { waitUntil: "domcontentloaded" });

    const chooser = page.locator("#simpleDiscoveryPanel");
    const advancedButton = page.locator("#mobileAdvancedButton");
    const drawer = page.locator('details[data-panel-key="dashboard-model-source"]');
    const drawerSummary = drawer.locator(":scope > summary");
    await expect(chooser).toBeHidden();
    await expect(page.locator("#simpleModelList")).toHaveAttribute("aria-busy", "true");
    await expect(chooser).toHaveAttribute("aria-busy", "false");

    await advancedButton.click();
    await expect(drawer).toHaveJSProperty("open", true);
    await expect(drawerSummary).toBeFocused();
    gate.resolve();

    await expect(page.locator("#simpleModelPickerStatus")).toContainText("1 model found");
    await expect(chooser).toBeHidden();
    await expect(page.locator(".app-shell")).toHaveAttribute("data-mode", "advanced");
    await expect(page.locator(".app-shell")).toHaveAttribute("data-rail-collapsed", "false");
    await expect(drawerSummary).toBeFocused();
  });

  test("keyboard selection preserves supported companion intent across reload", async ({ page }) => {
    let huggingFaceRequestCount = 0;
    await page.route("https://huggingface.co/api/models**", (route) => {
      huggingFaceRequestCount += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]"
      });
    });
    const compositionId = sha256("7");
    await openApplication(page, { advanced: true,
      entries: [catalogEntry({
        entryId: "supported-keyboard-choice",
        displayName: "Supported Keyboard Choice",
        compositionSha: compositionId,
        revisionCharacter: "7"
      })]
    });

    const chooser = page.locator("#simpleDiscoveryPanel");
    const card = chooser.locator(`[data-composition-id="${compositionId}"]`);
    const drawer = page.locator('details[data-panel-key="dashboard-model-source"]');
    await expect(card).toHaveAttribute("data-route", "supported-local-conversion");
    await expect(card).toHaveAttribute("data-default", "true");
    await expect(card).toBeFocused();
    await expect(drawer).toHaveJSProperty("open", false);
    await expect(page.locator("#hfSearchInput")).toHaveValue("");
    expect(huggingFaceRequestCount).toBe(0);

    await page.keyboard.press("Enter");
    await expect(chooser.locator("#simpleCompanionPairing")).toBeVisible();
    await expect(page.locator("#simpleModelPickerStatus")).toHaveText(
      "Connect the desktop companion once to get Supported Keyboard Choice."
    );
    await expect(chooser.getByLabel("One-time companion pairing code")).toBeFocused();
    await expect.poll(() => page.evaluate(() => (
      window.sessionStorage.getItem("tinyrustlm.session.pendingModelAcquisitionComposition")
    ))).toBe(compositionId);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#simpleDiscoveryPanel")).toBeVisible();
    await openAdvancedChooser(page);
    const restoredChooser = page.locator("#simpleDiscoveryPanel");
    const restoredCard = restoredChooser.locator(`[data-composition-id="${compositionId}"]`);
    await expect(restoredChooser).toBeVisible();
    await expect(restoredCard).toHaveAttribute("data-default", "true");
    await expect(restoredCard).toHaveAttribute("data-route", "supported-local-conversion");
    await expect(restoredChooser.locator("#simpleCompanionPairing")).toBeVisible();
    await expect(page.locator("#simpleModelPickerStatus")).toHaveText(
      "Connect the desktop companion to continue with Supported Keyboard Choice."
    );
    await expect(restoredChooser.getByLabel("One-time companion pairing code")).toBeFocused();
    await expect(page.locator(".app-shell")).toHaveAttribute("data-mode", "advanced");
    await expect(page.locator(".app-shell")).toHaveAttribute("data-rail-collapsed", "true");
    await expect(drawer).toHaveJSProperty("open", false);
    await expect(page.locator("#hfSearchInput")).toHaveValue("");
    expect(huggingFaceRequestCount).toBe(0);
  });

  test("restores the pairing command after a companion pairing failure", async ({ page }) => {
    const compositionId = sha256("9");
    await openApplication(page, { advanced: true,
      entries: [catalogEntry({
        entryId: "pairing-focus-choice",
        displayName: "Pairing Focus Choice",
        compositionSha: compositionId,
        revisionCharacter: "9"
      })]
    });

    await page.locator(`[data-composition-id="${compositionId}"]`).click();
    const chooser = page.locator("#simpleDiscoveryPanel");
    const code = chooser.getByLabel("One-time companion pairing code");
    const pair = chooser.getByRole("button", { name: "Connect and continue" });
    await code.fill("invalid-pairing-code");
    await pair.click();

    await expect(page.locator("#simpleModelPickerStatus")).toContainText(
      "Companion connection failed"
    );
    await expect(pair).toBeEnabled();
    await expect(pair).toBeFocused();
  });

  test("shows the truthful empty-catalog state", async ({ page }) => {
    await openApplication(page);
    await expect(page.locator("#simpleModelPickerStatus")).toHaveText(
      "No models are listed yet."
    );

    await expect(page.locator("#simpleModelPickerStatus")).not.toHaveClass(/error/);
    await expect(page.locator("#simpleModelList .simple-model-empty")).toHaveText(
      "No models are listed yet."
    );
    await expect(page.locator("#simpleModelActionButton")).toBeHidden();
    await expect(page.locator("#simpleChooseLocalButton, #simpleLocalCompositionFile"))
      .toHaveCount(0);
    await expect(page.locator("#simpleModelRefreshButton")).toBeEnabled();
    await expect(page.locator("#simpleModelRefreshButton")).toBeFocused();
  });

  test("distinguishes invalid and unavailable catalog results from valid empty", async ({ browser }) => {
    const invalidPage = await browser.newPage();
    await openApplication(invalidPage, { catalogBody: { schema: "invalid-fixture" } });
    await expect(invalidPage.locator("#simpleModelPickerStatus")).toHaveText(
      "The model list could not be verified, so no model was opened."
    );
    await expect(invalidPage.locator("#simpleModelPickerStatus")).toHaveClass(/error/);
    await expect(invalidPage.locator("#simpleModelList .simple-model-empty")).toHaveText(
      "The model list could not be verified, so no models were loaded."
    );
    await expect(invalidPage.locator("#simpleModelRefreshButton")).toBeFocused();
    await invalidPage.close();

    const unavailablePage = await browser.newPage();
    await openApplication(unavailablePage, { catalogStatus: 503 });
    await expect(unavailablePage.locator("#simpleModelPickerStatus")).toHaveText(
      "Models are unavailable right now. A saved model will not open until its qualification can be reconciled."
    );
    await expect(unavailablePage.locator("#simpleModelPickerStatus")).toHaveClass(/error/);
    await expect(unavailablePage.locator("#simpleModelList .simple-model-empty")).toHaveText(
      "The model list is unavailable right now. Check your connection and refresh."
    );
    await expect(unavailablePage.locator("#simpleModelRefreshButton")).toBeFocused();
    await unavailablePage.close();
  });

  test("labels announcement metadata separately from live reachability", async ({ page }) => {
    const peerId = "playwright.peer-not-live-probed";
    await openApplication(page, { advanced: true,
      entries: [catalogEntry({
        entryId: "announcement-only",
        displayName: "Announcement Only",
        compositionSha: sha256("f"),
        revisionCharacter: "f",
        peerId
      })],
      peerFeedStatus: 503
    });

    await expect(page.locator("#simpleModelPickerStatus")).toHaveText(
      "1 model found. The signed P2P listing feed could not be checked. 1 can be prepared on this device."
    );
    const card = page.locator("#simpleModelList [data-composition-id]");
    await expect(card).toHaveCount(1);
    await expect(card).toContainText("Prepare on this device");
    await expect(card).not.toContainText(/ready|reachable|available/iu);
  });

  test("rejects a stale catalog before offering any acquisition", async ({ page }) => {
    const entry = catalogEntry({
      entryId: "stale-catalog",
      displayName: "Stale Catalog Fixture",
      compositionSha: sha256("a"),
      revisionCharacter: "a"
    });
    const catalog = catalogFixture([entry]);
    catalog.generated_at_utc = utc(-2 * 60 * 60_000);
    catalog.valid_until_utc = utc(-60_000);
    const acquisitionRequests = [];
    await page.route("**/admissions/**", (route) => {
      acquisitionRequests.push(route.request().url());
      return route.abort();
    });
    await openApplication(page, { entries: [entry], catalogBody: catalog });
    await expect(page.locator("#simpleModelPickerStatus")).toHaveText(
      "The model list could not be verified, so no model was opened."
    );
    await expect(page.locator("#simpleModelList [data-composition-id]")).toHaveCount(0);
    await expect(page.locator("#simpleModelActionButton")).toBeHidden();
    await expect(page.locator("#simpleCompanionPairing")).toBeHidden();
    await expect(page.locator("#generateButton")).toBeDisabled();
    expect(acquisitionRequests).toEqual([]);
  });

  for (const invalidPeer of ["tampered-signature", "signed-unpinned-dns"]) {
    test(`does not offer or contact a ${invalidPeer} peer`, async ({ page }) => {
      const peerId = `playwright.${invalidPeer}`;
      const entry = catalogEntry({
        entryId: invalidPeer,
        displayName: "Untrusted Peer Fixture",
        compositionSha: sha256("b"),
        revisionCharacter: "b",
        peerId
      });
      const announcement = peerAnnouncementFixture({
        announcementId: peerId,
        compositionId: entry.composition.composition_id,
        pieceSetSha256: sha256("c")
      });
      if (invalidPeer === "signed-unpinned-dns") {
        announcement.peer_base_url = "https://peer.example.com/";
        // A valid signature cannot authorize a browser URL whose DNS cannot be pinned.
        announcement.signature = nodeCrypto.sign(null,
          Buffer.from(catalogApi.peerAnnouncementSigningBytes(announcement)),
          peerKeyPair.privateKey).toString("base64url");
      } else {
        const signature = Buffer.from(announcement.signature, "base64url");
        signature[0] ^= 1;
        announcement.signature = signature.toString("base64url");
      }
      const acquisitionRequests = [];
      await page.route(/https:\/\/(?:8\.8\.8\.8|peer\.example\.com)\//u, (route) => {
        acquisitionRequests.push(route.request().url());
        return route.abort();
      });
      await page.route("**/admissions/**", (route) => {
        acquisitionRequests.push(route.request().url());
        return route.abort();
      });
      await openApplication(page, { advanced: true, entries: [entry], announcements: [announcement] });
      await expect(page.locator("#simpleModelPickerStatus")).toHaveText(
        "1 model found. The signed P2P listing feed could not be verified. 1 can be prepared on this device."
      );
      const card = page.locator("#simpleModelList [data-composition-id]");
      await expect(card).toHaveAttribute("data-route", "supported-local-conversion");
      await expect(card).toHaveAttribute("data-recovery", "false");
      await expect(card).not.toContainText(/P2P download|signed P2P listing|reachable|ready/iu);
      await expect(page.locator("#simpleCompanionPairing")).toBeHidden();
      await card.click();
      await expect(page.locator("#simpleCompanionPairing")).toBeVisible();
      await expect(page.locator("#diagnosticsRail .advanced-scroll")).toBeHidden();
      await expect(page.locator("#generateButton")).toBeDisabled();
      expect(acquisitionRequests).toEqual([]);
    });
  }

  test("rejects altered receipt bytes before any peer download or automatic conversion", async ({ page }) => {
    const peerId = "playwright.receipt-custody";
    const entry = catalogEntry({
      entryId: "receipt-custody",
      displayName: "Receipt Custody Fixture",
      compositionSha: sha256("d"),
      revisionCharacter: "d",
      peerId
    });
    const admissionText = browserAdmissionFixture(entry);
    const receipt = qualificationReceiptForEntry(entry);
    const receiptText = canonicalJson(receipt);
    receipt.qualityEvidenceSha256 = "e".repeat(64);
    const alteredReceiptText = canonicalJson(receipt);
    // Same-size, schema-valid JSON must still fail the catalog's exact byte digest.
    expect(Buffer.byteLength(alteredReceiptText)).toBe(Buffer.byteLength(receiptText));
    expect(contentSha256(alteredReceiptText)).not.toBe(entry.qualification.receipt_sha256);
    let receiptRequests = 0;
    let admissionRequests = 0;
    const peerRequests = [];
    await page.route(`**${entry.browser_admission.route}`, (route) => {
      admissionRequests += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: admissionText
      });
    });
    await page.route(`${publicPeerBaseUrl}**`, (route) => {
      peerRequests.push(route.request().url());
      return route.abort();
    });
    await openApplication(page, {
      entries: [entry],
      announcements: [peerAnnouncementFixture({
        announcementId: peerId,
        compositionId: entry.composition.composition_id,
        pieceSetSha256: sha256("f")
      })]
    });
    await page.route(`**${entry.qualification.receipt_route}`, (route) => {
      receiptRequests += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: alteredReceiptText
      });
    });
    const card = page.locator("#simpleModelList [data-composition-id]");
    await expect(card).toHaveAttribute("data-route", "qualified-p2p");
    await card.click();
    await expect(page.locator("#simpleModelPickerStatus")).toHaveText(
      "P2P install stopped: The model list could not be loaded. Check the URL or try a local JSON list."
    );
    await expect(page.locator("#errorState")).toContainText("(catalog-qualification-sha256)");
    await expect(page.locator("#simpleModelPickerStatus")).toHaveClass(/error/u);
    await expect(card).toHaveAttribute("data-route", "qualified-p2p");
    await expect(card).toHaveAttribute("data-recovery", "false");
    await expect(page.locator("#simpleCompanionPairing")).toBeHidden();
    await expect(page.locator("#simpleModelActionButton")).toBeHidden();
    await expect(page.locator("#generateButton")).toBeDisabled();
    await expect(page.locator("#modelToolbarName")).toHaveText("Choose a model");
    expect(receiptRequests).toBe(1);
    expect(admissionRequests).toBe(0);
    expect(peerRequests).toEqual([]);
  });

  test("disables a catalog source without a signed peer listing or exact conversion support", async ({ page }) => {
    const compositionId = sha256("9");
    await openApplication(page, { advanced: true,
      entries: [catalogEntry({
        entryId: "unsupported-source",
        displayName: "Unsupported Source",
        compositionSha: compositionId,
        revisionCharacter: "9",
        repository: "playwright/unsupported-source",
        revision: "9".repeat(40)
      })]
    });

    await expect(page.locator("#simpleModelPickerStatus")).toHaveText(
      "1 model found. It has no signed P2P listing and cannot be prepared on this device."
    );
    const card = page.locator("#simpleModelList [data-composition-id]");
    await expect(card).toHaveAttribute("data-composition-id", compositionId);
    await expect(card).toHaveAttribute("data-route", "unsupported-source");
    await expect(card).toHaveAttribute("data-default", "false");
    await expect(card).toBeDisabled();
    await expect(card).toContainText("Not available yet");
    await expect(page.locator("#simpleCompanionPairing")).toBeHidden();
    await expect(page.locator("#simpleModelRefreshButton")).toBeFocused();

    await card.dispatchEvent("click");
    await expect(page.locator("#simpleModelPickerStatus")).toHaveText(
      "Unsupported Source is not available on P2P and cannot be prepared on this device."
    );
    await expect(page.locator("#simpleModelPickerStatus")).toHaveClass(/error/);
    await expect(page.locator("#simpleCompanionPairing")).toBeHidden();
  });

  test("keeps the collapsed Advanced rail out of narrow keyboard navigation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openApplication(page);
    const rail = page.locator("#diagnosticsRail");
    const mobileAdvanced = page.locator("#mobileAdvancedButton");

    await expect(rail).toHaveAttribute("inert", "");
    await expect(rail).toHaveAttribute("aria-hidden", "true");
    await page.locator("#simpleOpenAdvancedDiscoveryButton").click();
    await expect(rail).not.toHaveAttribute("inert", "");
    await expect(rail).toHaveAttribute("aria-hidden", "false");
    await expect(rail.locator('details[data-panel-key="dashboard-model-source"] > summary')).toBeFocused();

    await page.locator("#diagnosticsRailToggle").click();
    await expect(rail).toHaveAttribute("inert", "");
    await expect(rail).toHaveAttribute("aria-hidden", "true");
    await expect(mobileAdvanced).toBeFocused();
  });

  test("traps focus at both chooser boundaries and returns it on Escape", async ({ page }) => {
    await openApplication(page, {
      entries: [catalogEntry({
        entryId: "compact-keyboard-choice",
        displayName: "Compact Keyboard Choice",
        compositionSha: sha256("8"),
        revisionCharacter: "8"
      })]
    });
    const chooser = page.locator("#simpleDiscoveryPanel");
    const opener = page.locator("#modelEditButton");
    const firstControl = page.locator("#simpleModelRefreshButton");
    const lastControl = page.locator("#simpleOpenAdvancedDiscoveryButton");

    await lastControl.focus();
    await page.keyboard.press("Tab");
    await expect(chooser).toBeVisible();
    await expect(firstControl).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect(chooser).toBeVisible();
    await expect(lastControl).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(chooser).toBeHidden();
    await expect(opener).toBeFocused();
    await expect(opener).toHaveAttribute("aria-expanded", "false");
  });

  test("orders accessible one-click model cards P2P first and reveals local pairing", async ({ page }, testInfo) => {
    const peerComposition = sha256("a");
    const localComposition = sha256("b");
    const peerId = "playwright.peer-ready";
    const entries = [
      catalogEntry({
        entryId: "alpha-local",
        displayName: "Alpha Local Conversion",
        compositionSha: localComposition,
        revisionCharacter: "c"
      }),
      catalogEntry({
        entryId: "zeta-peer",
        displayName: "Zeta Peer Model",
        compositionSha: peerComposition,
        revisionCharacter: "d",
        peerId
      })
    ];
    const announcements = [peerAnnouncementFixture({
      announcementId: peerId,
      compositionId: peerComposition,
      pieceSetSha256: sha256("e")
    })];
    await openApplication(page, { advanced: true, entries, announcements });
    await expect(page.locator("#simpleModelPickerStatus")).toHaveText(
      "2 models found. 1 listed for P2P download."
    );

    const chooser = page.getByRole("dialog", { name: "Choose a model" });
    const modelGroup = chooser.getByRole("group", {
      name: "Qualified catalog models and models open in this browser"
    });
    const cards = modelGroup.getByRole("button");
    const peerCard = cards.nth(0);
    const localCard = cards.nth(1);
    const pairing = chooser.locator("#simpleCompanionPairing");

    await expect(modelGroup).toHaveAttribute("role", "group");
    await expect(cards).toHaveCount(2);
    await expectNoHorizontalOverflow(chooser);
    await expectNoHorizontalOverflow(modelGroup);
    await expect(peerCard).toHaveAttribute("data-composition-id", peerComposition);
    await expect(peerCard).toHaveAttribute("data-route", "qualified-p2p");
    await expect(peerCard).toHaveAttribute("data-default", "true");
    await expect(peerCard).toHaveAccessibleName(
      /Zeta Peer Model.*P2P download.*Default choice.*Select to download from P2P and open this model\./u
    );
    await expect(peerCard.locator(".simple-model-identity small")).toHaveText(/KiB$/u);
    await expect(peerCard).not.toContainText(supportedSourceRepository);
    await expect(peerCard).not.toContainText("q8_0");
    await expect(peerCard).toBeFocused();
    await expect(peerCard).toHaveCSS("outline-width", "3px");
    await expect(localCard).toHaveAttribute("data-composition-id", localComposition);
    await expect(localCard).toHaveAttribute("data-route", "supported-local-conversion");
    await expect(localCard).toHaveAttribute("data-default", "false");
    await expect(localCard).toHaveAccessibleName(
      /Alpha Local Conversion.*Prepare on this device.*Select to convert/u
    );
    await expect(localCard.locator(".simple-model-identity small")).toHaveText(/KiB$/u);
    await expect(localCard).not.toContainText(supportedSourceRepository);
    await expect(localCard).not.toContainText("q8_0");
    await expectNoHorizontalOverflow(peerCard);
    await expectNoHorizontalOverflow(localCard);
    await expect(pairing).toBeHidden();
    const action = chooser.locator("#simpleModelActionButton");
    await expect(action).toBeHidden();
    // This screenshot proves fixture-driven chooser rendering, not a live model listing.
    await page.screenshot({
      path: testInfo.outputPath(`model-chooser-fixture-list-${testInfo.project.name}.png`)
    });

    await localCard.click();

    await expect(peerCard).toHaveAttribute("data-default", "false");
    await expect(localCard).toHaveAttribute("data-default", "true");
    await expect(pairing).toBeVisible();
    await expect(page.locator("#simpleModelPickerStatus")).toHaveText(
      "Connect the desktop companion once to get Alpha Local Conversion."
    );
    await expect(action).toBeHidden();
    await expect(chooser.getByLabel("One-time companion pairing code")).toBeVisible();
    await expect(chooser.getByLabel("One-time companion pairing code")).toBeFocused();
    await expect(chooser.getByRole("button", { name: "Connect and continue" })).toBeVisible();
    await expect(page.locator(".app-shell")).toHaveAttribute("data-mode", "advanced");
    await expect(page.locator(".app-shell")).toHaveAttribute("data-rail-collapsed", "true");
    await expect(page.locator('details[data-panel-key="dashboard-model-source"]'))
      .toHaveJSProperty("open", false);
    await expect(page.locator("#hfSearchInput")).toHaveValue("");
  });

  test("keeps the local composition picker in Advanced without claiming an import", async ({ page }) => {
    await openApplication(page);
    await page.locator("#simpleOpenAdvancedDiscoveryButton").click();
    await expect(page.locator('details[data-panel-key="dashboard-model-source"]'))
      .toHaveJSProperty("open", true);

    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.locator("#localModelFile").click()
    ]);
    const input = fileChooser.element();
    expect(fileChooser.isMultiple()).toBe(true);
    expect(await input.getAttribute("id")).toBe("localModelFile");
    await fileChooser.setFiles({
      name: "model.slm2",
      mimeType: "application/octet-stream",
      buffer: Buffer.from([0])
    });

    await expect.poll(() => input.evaluate((element) => Array.from(element.files || []).map(
      (file) => file.name
    ))).toEqual(["model.slm2"]);
    await expect(page.locator("#localModelState")).toHaveText(
      "Select the canonical browser composition admission"
    );
    await expect(page.locator("#modelToolbarName")).toHaveText("Choose a model");
    await expect(page.locator("#modelLoadPill")).toContainText("No model imported");
  });
});
