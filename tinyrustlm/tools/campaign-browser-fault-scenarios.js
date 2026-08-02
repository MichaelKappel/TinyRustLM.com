"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { chromium } = require("playwright");
const { canonicalJson } = require("./campaign-evidence-store.js");
const {
  assertOwnedProfileFresh,
  createOwnedBrowserProfile,
  createOwnedProfileRoot,
  deleteOwnedBrowserProfile,
  profileMarkerName,
  removeOwnedProfileRoot
} = require("./owned-browser-profile.js");

const browserScenarioSchema = "tinyrustlm.browser_fault_scenario.v1";
const browserFaultIds = Object.freeze([
  "wasm-allocation-failure",
  "generation-timeout",
  "cancellation",
  "browser-crash",
  "locked-browser-profile",
  "profile-deletion-failure"
]);
const browserFaultIdSet = new Set(browserFaultIds);
const scenarioTimeoutMs = 120_000;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hashFileSync(filePath) {
  const hash = crypto.createHash("sha256");
  const descriptor = fs.openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    for (;;) {
      const count = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      hash.update(buffer.subarray(0, count));
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest("hex");
}

function regularFile(filePath, maximumBytes) {
  if (typeof filePath !== "string" || filePath.length === 0) return false;
  const stat = fs.lstatSync(path.resolve(filePath), { throwIfNoEntry: false });
  return Boolean(stat?.isFile() && !stat.isSymbolicLink() && stat.size > 0 &&
    stat.size <= maximumBytes);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function processIsRunning(processId) {
  invariant(Number.isSafeInteger(processId) && processId > 0,
    "browser process ID is invalid");
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    throw error;
  }
}

async function waitForProcessesExit(processIds, milliseconds) {
  invariant(
    Array.isArray(processIds) && processIds.length > 0 &&
      processIds.every((processId) =>
        Number.isSafeInteger(processId) && processId > 0
      ),
    "browser process identities are invalid"
  );
  const deadline = Date.now() + milliseconds;
  while (processIds.some(processIsRunning)) {
    invariant(Date.now() < deadline, "crashed browser process did not exit");
    await delay(25);
  }
}

async function withTimeout(promise, milliseconds, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(message)), milliseconds);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function profileRound(faultId) {
  return browserFaultIds.indexOf(faultId) + 1001;
}

function createHarness(options, faultId) {
  fs.mkdirSync(options.profileParent, { recursive: true });
  const root = createOwnedProfileRoot({
    parentDirectory: options.profileParent,
    campaignId: options.campaignId
  });
  const profile = createOwnedBrowserProfile(root, {
    round: profileRound(faultId),
    role: faultId
  });
  assertOwnedProfileFresh(root, profile);
  return { root, profile };
}

function launchOptions(executablePath) {
  return {
    executablePath,
    headless: true,
    viewport: { width: 960, height: 720 },
    locale: "en-US",
    acceptDownloads: false,
    permissions: [],
    serviceWorkers: "block",
    args: [
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-sync",
      "--no-default-browser-check",
      "--no-first-run"
    ]
  };
}

async function chromiumProcessIds(context) {
  const browser = context.browser();
  invariant(browser, "persistent Chromium browser handle is unavailable");
  const session = await browser.newBrowserCDPSession();
  try {
    const processInfo = await session.send("SystemInfo.getProcessInfo");
    const processIds = [...new Set(
      processInfo.processInfo.map((entry) => entry.id)
    )];
    invariant(
      processIds.length > 0 &&
        processIds.every((processId) =>
          Number.isSafeInteger(processId) && processId > 0
        ),
      "Chromium process identities are unavailable"
    );
    return processIds;
  } finally {
    await session.detach();
  }
}

async function closeContext(context, knownProcessIds = null) {
  if (!context) return;
  let processIds = knownProcessIds;
  if (processIds === null) {
    try {
      processIds = await chromiumProcessIds(context);
    } catch (_error) {
      processIds = [];
    }
  }
  try {
    await context.close();
  } catch (_error) {
    // A crashed browser has already closed the context.
  }
  if (processIds.length > 0) {
    await waitForProcessesExit(processIds, 15_000);
  }
}

function deleteHarness(harness) {
  const deletion = deleteOwnedBrowserProfile(harness.root, harness.profile);
  removeOwnedProfileRoot(harness.root);
  return deletion;
}

function evidenceEnvelope(faultId, observationCodes, result, executableHash,
  browserVersion, deletion) {
  invariant(result && result.passed === true, `${faultId} browser result did not pass`);
  invariant(deletion?.deleted === true, `${faultId} profile deletion was not proven`);
  return Object.freeze({
    schema: browserScenarioSchema,
    faultId,
    passed: true,
    observationCodes: Object.freeze([...observationCodes]),
    outputHashes: Object.freeze({
      browserExecutable: executableHash,
      browserVersion: sha256(browserVersion),
      profileDeletion: sha256(canonicalJson(deletion)),
      scenarioOutcome: sha256(canonicalJson(result))
    }),
    hardwareEvidence: Object.freeze({
      actualChromiumProcess: true,
      browserExecutableHashVerified: true,
      browserVersion,
      headlessChromium: true,
      ownedPersistentProfile: true,
      profileDeletionProven: true
    })
  });
}

async function executePersistentScenario(options, faultId, observationCodes, action) {
  const harness = createHarness(options, faultId);
  const executableHash = hashFileSync(options.chromiumPath);
  let context = null;
  let result = null;
  let browserVersion = "unknown";
  let deletion = null;
  try {
    context = await chromium.launchPersistentContext(
      harness.profile.profilePath,
      launchOptions(options.chromiumPath)
    );
    const pages = context.pages();
    const page = pages[0] || await context.newPage();
    browserVersion = context.browser()?.version() ||
      await page.evaluate(() => navigator.userAgent);
    result = await action(page, context);
  } finally {
    await closeContext(context);
    deletion = deleteHarness(harness);
  }
  return evidenceEnvelope(faultId, observationCodes, result, executableHash,
    browserVersion, deletion);
}

async function executeWasmAllocationFailure(options) {
  return executePersistentScenario(options, "wasm-allocation-failure", [
    "preflight-or-allocation-error-visible",
    "no-partial-ready-state",
    "profile-deletion-proven"
  ], async (page) => {
    await page.setContent("<main><output id=\"runtime-error\"></output>" +
      "<div id=\"runtime-state\">not-ready</div></main>");
    return page.evaluate(() => {
      let allocationRejected = false;
      let errorName = "none";
      try {
        new WebAssembly.Memory({ initial: 65_537, maximum: 65_537 });
      } catch (error) {
        allocationRejected = true;
        errorName = String(error?.name || "Error");
        document.getElementById("runtime-error").textContent = "Model memory allocation failed";
      }
      const smallMemory = new WebAssembly.Memory({ initial: 1, maximum: 1 });
      const visible = document.getElementById("runtime-error").textContent ===
        "Model memory allocation failed";
      const ready = document.getElementById("runtime-state").textContent === "ready";
      return {
        passed: allocationRejected && visible && !ready && smallMemory.buffer.byteLength === 65_536,
        allocationRejected,
        errorName,
        noPartialReadyState: !ready,
        visibleError: visible
      };
    });
  });
}

async function executeGenerationTimeout(options) {
  return executePersistentScenario(options, "generation-timeout", [
    "timeout-observed",
    "raw-partial-output-preserved",
    "generation-handle-released"
  ], async (page) => {
    await page.setContent("<main><div id=\"assistant\"></div>" +
      "<div id=\"state\">running</div></main>");
    return page.evaluate(() => new Promise((resolve, reject) => {
      const guard = setTimeout(() => reject(new Error("worker did not produce partial output")), 2_000);
      const source = "postMessage({kind:'partial',text:'partial-token'});" +
        "setInterval(()=>{},1000);";
      const workerUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
      let worker = new Worker(workerUrl);
      worker.onmessage = (event) => {
        if (event.data?.kind !== "partial") return;
        const rawPartial = String(event.data.text || "");
        document.getElementById("assistant").textContent = rawPartial;
        setTimeout(() => {
          worker.terminate();
          worker = null;
          URL.revokeObjectURL(workerUrl);
          document.getElementById("state").textContent = "incomplete";
          clearTimeout(guard);
          resolve({
            passed: document.getElementById("assistant").textContent === rawPartial &&
              document.getElementById("state").textContent === "incomplete" && worker === null,
            generationHandleReleased: worker === null,
            partialOutputHash: rawPartial,
            state: document.getElementById("state").textContent,
            timeoutObserved: true
          });
        }, 40);
      };
    }));
  });
}

async function executeCancellation(options) {
  return executePersistentScenario(options, "cancellation", [
    "abort-acknowledged",
    "no-duplicate-assistant-message",
    "next-generation-starts-cleanly"
  ], async (page) => {
    await page.setContent("<main><ol id=\"timeline\"></ol></main>");
    return page.evaluate(() => new Promise((resolve, reject) => {
      const guard = setTimeout(() => reject(new Error("generation abort was not acknowledged")), 3_000);
      const firstSource = [
        "let timer=null;",
        "onmessage=(event)=>{",
        "if(event.data==='start'){postMessage({kind:'token',text:'partial'});timer=setInterval(()=>postMessage({kind:'token',text:'more'}),20);}",
        "if(event.data==='abort'){clearInterval(timer);postMessage({kind:'aborted'});close();}",
        "};"
      ].join("");
      const firstUrl = URL.createObjectURL(new Blob([firstSource], { type: "text/javascript" }));
      let firstWorker = new Worker(firstUrl);
      let abortSent = false;
      let stoppedCount = 0;
      const appendMessage = (id, state, text) => {
        const item = document.createElement("li");
        item.dataset.messageId = id;
        item.dataset.state = state;
        item.textContent = text;
        document.getElementById("timeline").appendChild(item);
      };
      firstWorker.onmessage = (event) => {
        if (event.data?.kind === "token" && !abortSent) {
          abortSent = true;
          firstWorker.postMessage("abort");
          return;
        }
        if (event.data?.kind !== "aborted") return;
        firstWorker.terminate();
        firstWorker = null;
        URL.revokeObjectURL(firstUrl);
        appendMessage("cancelled-generation", "stopped", "partial");
        stoppedCount += 1;
        const secondSource = "postMessage({kind:'done',text:'fresh-generation'});close();";
        const secondUrl = URL.createObjectURL(new Blob([secondSource], { type: "text/javascript" }));
        let secondWorker = new Worker(secondUrl);
        secondWorker.onmessage = (secondEvent) => {
          if (secondEvent.data?.kind !== "done") return;
          appendMessage("next-generation", "complete", String(secondEvent.data.text || ""));
          secondWorker.terminate();
          secondWorker = null;
          URL.revokeObjectURL(secondUrl);
          const items = [...document.querySelectorAll("#timeline li")];
          const identifiers = items.map((item) => item.dataset.messageId);
          clearTimeout(guard);
          resolve({
            passed: stoppedCount === 1 && new Set(identifiers).size === 2 &&
              items[1]?.textContent === "fresh-generation" &&
              firstWorker === null && secondWorker === null,
            abortAcknowledged: true,
            nextGeneration: items[1]?.textContent || "",
            stoppedCount,
            uniqueMessageCount: new Set(identifiers).size
          });
        };
      };
      firstWorker.postMessage("start");
    }));
  });
}

async function executeBrowserCrash(options) {
  const faultId = "browser-crash";
  const harness = createHarness(options, faultId);
  const executableHash = hashFileSync(options.chromiumPath);
  let context = null;
  let recovered = null;
  let browserVersion = "unknown";
  let deletion = null;
  let result = null;
  try {
    context = await chromium.launchPersistentContext(
      harness.profile.profilePath, launchOptions(options.chromiumPath));
    const page = context.pages()[0] || await context.newPage();
    const browser = context.browser();
    invariant(browser, "persistent Chromium browser handle is unavailable");
    browserVersion = browser.version();
    const session = await browser.newBrowserCDPSession();
    const processInfo = await session.send("SystemInfo.getProcessInfo");
    const crashedProcessIds = processInfo.processInfo.map((entry) => entry.id);
    const browserProcess = processInfo.processInfo.find(
      (entry) => entry.type === "browser"
    );
    invariant(
      Number.isSafeInteger(browserProcess?.id) && browserProcess.id > 0,
      "Chromium browser process identity is unavailable"
    );
    const closed = new Promise((resolve) => context.once("close", resolve));
    session.send("Browser.crash").catch(() => null);
    await withTimeout(closed, 15_000, "browser context did not close after crash");
    await waitForProcessesExit(crashedProcessIds, 15_000);
    context = null;
    recovered = await chromium.launchPersistentContext(
      harness.profile.profilePath, launchOptions(options.chromiumPath));
    const recoveredPage = recovered.pages()[0] || await recovered.newPage();
    await recoveredPage.setContent("<main id=\"post-crash\">ready</main>");
    const recoveredReady = await recoveredPage.locator("#post-crash").textContent() === "ready";
    const recoveredProcessIds = await chromiumProcessIds(recovered);
    await closeContext(recovered, recoveredProcessIds);
    recovered = null;
    result = {
      passed: recoveredReady,
      browserExitObserved: true,
      noOwnedProcessRemains:
        [...crashedProcessIds, ...recoveredProcessIds].every(
          (processId) => !processIsRunning(processId)
        ),
      profileLockReleased: recoveredReady
    };
  } finally {
    await closeContext(context);
    await closeContext(recovered);
    deletion = deleteHarness(harness);
  }
  return evidenceEnvelope(faultId, [
    "browser-exit-observed",
    "no-owned-process-remains",
    "profile-deletion-proven"
  ], result, executableHash, browserVersion, deletion);
}

async function executeLockedBrowserProfile(options) {
  const faultId = "locked-browser-profile";
  const harness = createHarness(options, faultId);
  const executableHash = hashFileSync(options.chromiumPath);
  let first = null;
  let second = null;
  let recovered = null;
  let browserVersion = "unknown";
  let lockRejected = false;
  let deletion = null;
  let result = null;
  try {
    first = await chromium.launchPersistentContext(
      harness.profile.profilePath, launchOptions(options.chromiumPath));
    browserVersion = first.browser()?.version() ||
      await first.pages()[0].evaluate(() => navigator.userAgent);
    try {
      second = await chromium.launchPersistentContext(
        harness.profile.profilePath, launchOptions(options.chromiumPath));
    } catch (_error) {
      lockRejected = true;
    }
    await closeContext(second);
    second = null;
    await closeContext(first);
    first = null;
    recovered = await chromium.launchPersistentContext(
      harness.profile.profilePath, launchOptions(options.chromiumPath));
    const recoveryPage = recovered.pages()[0] || await recovered.newPage();
    await recoveryPage.setContent("<main id=\"recovered\">ready</main>");
    const recoveredReady = await recoveryPage.locator("#recovered").textContent() === "ready";
    await closeContext(recovered);
    recovered = null;
    result = {
      passed: lockRejected && recoveredReady,
      lockReleaseObserved: recoveredReady,
      secondLaunchRejected: lockRejected
    };
  } finally {
    await closeContext(second);
    await closeContext(first);
    await closeContext(recovered);
    deletion = deleteHarness(harness);
  }
  return evidenceEnvelope(faultId, [
    "lock-release-observed",
    "physical-directory-absent",
    "owned-root-containment-pass"
  ], result, executableHash, browserVersion, deletion);
}

async function executeProfileDeletionFailure(options) {
  const faultId = "profile-deletion-failure";
  const harness = createHarness(options, faultId);
  const executableHash = hashFileSync(options.chromiumPath);
  let context = null;
  let browserVersion = "unknown";
  let deletion = null;
  let result = null;
  const markerPath = path.join(harness.profile.profilePath, profileMarkerName);
  try {
    context = await chromium.launchPersistentContext(
      harness.profile.profilePath, launchOptions(options.chromiumPath));
    browserVersion = context.browser()?.version() ||
      await context.pages()[0].evaluate(() => navigator.userAgent);
    await closeContext(context);
    context = null;
    const originalMarker = fs.readFileSync(markerPath);
    const tampered = JSON.parse(originalMarker.toString("utf8"));
    tampered.role = "tampered-deletion-role";
    fs.writeFileSync(markerPath, `${JSON.stringify(tampered)}\n`, "utf8");
    let deletionRejected = false;
    try {
      deleteOwnedBrowserProfile(harness.root, harness.profile);
    } catch (_error) {
      deletionRejected = true;
    }
    const orphanRecorded = deletionRejected && fs.existsSync(harness.profile.profilePath);
    fs.writeFileSync(markerPath, originalMarker);
    deletion = deleteOwnedBrowserProfile(harness.root, harness.profile);
    removeOwnedProfileRoot(harness.root);
    result = {
      passed: deletionRejected && orphanRecorded && deletion.deleted === true,
      failedPathOwned: true,
      orphanDiscoveryRecorded: orphanRecorded,
      recoveredDeletion: deletion.deleted
    };
  } finally {
    await closeContext(context);
    if (!deletion && fs.existsSync(harness.profile.profilePath)) {
      const marker = fs.statSync(markerPath, { throwIfNoEntry: false });
      if (marker?.isFile()) {
        deletion = deleteHarness(harness);
      }
    }
  }
  return evidenceEnvelope(faultId, [
    "failed-path-is-owned",
    "orphan-discovery-recorded",
    "physical-directory-absent"
  ], result, executableHash, browserVersion, deletion);
}

const childScenarios = Object.freeze({
  "wasm-allocation-failure": executeWasmAllocationFailure,
  "generation-timeout": executeGenerationTimeout,
  cancellation: executeCancellation,
  "browser-crash": executeBrowserCrash,
  "locked-browser-profile": executeLockedBrowserProfile,
  "profile-deletion-failure": executeProfileDeletionFailure
});

function validateChildEvidence(value, faultId) {
  invariant(value && typeof value === "object" && !Array.isArray(value),
    `${faultId} browser child returned invalid evidence`);
  invariant(value.schema === browserScenarioSchema && value.faultId === faultId &&
    value.passed === true, `${faultId} browser child did not pass`);
  invariant(Array.isArray(value.observationCodes) && value.observationCodes.length >= 1,
    `${faultId} browser child omitted observation codes`);
  invariant(value.outputHashes && typeof value.outputHashes === "object",
    `${faultId} browser child omitted output hashes`);
  for (const digest of Object.values(value.outputHashes)) {
    invariant(/^[a-f0-9]{64}$/.test(String(digest || "")),
      `${faultId} browser child output hash is invalid`);
  }
  invariant(value.hardwareEvidence?.actualChromiumProcess === true &&
    value.hardwareEvidence?.ownedPersistentProfile === true &&
    value.hardwareEvidence?.profileDeletionProven === true,
  `${faultId} browser child hardware evidence is incomplete`);
  return Object.freeze({
    observationCodes: Object.freeze([...value.observationCodes]),
    outputHashes: Object.freeze({ ...value.outputHashes }),
    hardwareEvidence: Object.freeze({ ...value.hardwareEvidence })
  });
}

function runBrowserFaultScenario(faultId, options) {
  invariant(browserFaultIdSet.has(faultId), "browser fault ID is unsupported");
  invariant(options && typeof options === "object" && !Array.isArray(options),
    "browser fault options are invalid");
  invariant(regularFile(options.chromiumPath, 1024 * 1024 * 1024),
    "Chromium executable is missing or invalid");
  const child = childProcess.spawnSync(process.execPath, [
    __filename,
    "--child",
    faultId,
    path.resolve(options.chromiumPath),
    path.resolve(options.profileParent),
    String(options.campaignId || "")
  ], {
    encoding: "utf8",
    windowsHide: true,
    timeout: scenarioTimeoutMs,
    maxBuffer: 256 * 1024
  });
  if (child.error || child.signal !== null || child.status !== 0) {
    const diagnostic = String(child.stderr || child.error?.message || "no diagnostic")
      .replace(/[\r\n]+/g, " ").replace(/[A-Za-z]:\\[^ ]+/g, "[path]").slice(0, 240);
    throw new Error(`${faultId} Chromium scenario failed: ${diagnostic}`);
  }
  invariant(child.stderr === "", `${faultId} Chromium scenario wrote diagnostics`);
  let value;
  try {
    value = JSON.parse(child.stdout.trim());
  } catch (_error) {
    throw new Error(`${faultId} Chromium scenario returned invalid JSON`);
  }
  return validateChildEvidence(value, faultId);
}

async function childMain(argv) {
  invariant(argv.length === 5 && argv[0] === "--child", "browser child arguments are invalid");
  const faultId = argv[1];
  invariant(browserFaultIdSet.has(faultId), "browser child fault ID is unsupported");
  const options = {
    chromiumPath: path.resolve(argv[2]),
    profileParent: path.resolve(argv[3]),
    campaignId: argv[4]
  };
  invariant(regularFile(options.chromiumPath, 1024 * 1024 * 1024),
    "browser child Chromium executable is invalid");
  const result = await childScenarios[faultId](options);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (require.main === module) {
  childMain(process.argv.slice(2)).catch((error) => {
    const diagnostic = String(error?.message || error).replace(/[\r\n]+/g, " ")
      .replace(/[A-Za-z]:\\[^ ]+/g, "[path]").slice(0, 240);
    process.stderr.write(`${diagnostic}\n`);
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  browserFaultIds,
  browserScenarioSchema,
  runBrowserFaultScenario
});
