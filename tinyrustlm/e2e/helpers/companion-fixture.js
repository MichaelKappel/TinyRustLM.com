"use strict";

const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");

const tinyRustLmWebRoot = path.resolve(__dirname, "..", "..");
const tinyRustLmRepository = path.resolve(tinyRustLmWebRoot, "..");
const miniModelRepository = path.resolve(tinyRustLmRepository, "..", "MiniModel.org");
const qwenShareRoot = path.join(
  tinyRustLmRepository,
  "artifacts",
  "seed-host-evidence",
  "qwen-production-fleet",
  "shares",
  "tinyrustlm-qwen2-5-1-5b-instruct-q4-dc24eb832e8b"
);

const paths = Object.freeze({
  artifact: path.join(tinyRustLmWebRoot, "models", "tiny-test-model-q8.slm"),
  mismatchArtifact: path.join(tinyRustLmWebRoot, "models", "tiny-test-model-q4.slm"),
  bridgeTool: path.join(
    tinyRustLmRepository,
    "dotnet",
    "tools",
    "TinyRustLM.SeedHost.Tool",
    "bin",
    "Debug",
    "net8.0",
    "uaix-p2p-seed.exe"
  ),
  catalogEntry: path.join(miniModelRepository, "examples", "catalog-entry.v0.json"),
  manifest: path.join(miniModelRepository, "examples", "tiny-test-model-q8.minimodel.manifest.v0"),
  miniModelCli: path.join(miniModelRepository, "target", "release", "minimodel.exe"),
  miniModelNative: path.join(miniModelRepository, "target", "release", "minimodel_native.dll"),
  qwenArtifact: path.join(
    tinyRustLmRepository,
    "artifacts",
    "performance",
    "qwen2.5-1.5b-instruct-q4.slm"
  ),
  qwenCatalogEntry: path.join(qwenShareRoot, "qwen2.5-1.5b-instruct-q4.catalog-entry.v0.json"),
  qwenManifest: path.join(qwenShareRoot, "qwen2.5-1.5b-instruct-q4.minimodel.manifest.v0"),
  qwenPieceDirectory: path.join(qwenShareRoot, "qwen2.5-1.5b-instruct-q4.peer-pieces"),
  qwenUsageContract: path.join(
    tinyRustLmRepository,
    "artifacts",
    "performance",
    "qwen2.5-1.5b-instruct-q4.slm.manifest"
  )
});

function requireFixtureFiles() {
  for (const [label, filePath] of Object.entries(paths)) {
    const stat = fs.statSync(filePath, { throwIfNoEntry: false });
    const expectedDirectory = label.endsWith("Directory");
    if (!stat || (expectedDirectory ? !stat.isDirectory() : !stat.isFile())) {
      throw new Error(`Required ${label} fixture is missing`);
    }
  }
}

function fixtureDescriptor(options) {
  const model = options && options.model ? String(options.model) : "fixture";
  if (model === "fixture") {
    const catalogEntry = JSON.parse(fs.readFileSync(paths.catalogEntry, "utf8"));
    return {
      artifactPath: paths.artifact,
      catalogEntryPath: paths.catalogEntry,
      manifestPath: paths.manifest,
      modelId: catalogEntry.model_id,
      pieceDirectory: "",
      preparePieces: true,
      usageContractPath: ""
    };
  }
  if (model === "qwen") {
    const catalogEntry = JSON.parse(fs.readFileSync(paths.qwenCatalogEntry, "utf8"));
    return {
      artifactPath: paths.qwenArtifact,
      catalogEntryPath: paths.qwenCatalogEntry,
      manifestPath: paths.qwenManifest,
      modelId: catalogEntry.model_id,
      pieceDirectory: paths.qwenPieceDirectory,
      preparePieces: false,
      usageContractPath: paths.qwenUsageContract
    };
  }
  throw new Error("Companion fixture model must be fixture or qwen");
}

function readKeyValueDocument(filePath) {
  const values = new Map();
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator > 0) {
      values.set(line.slice(0, separator), line.slice(separator + 1));
    }
  }
  return values;
}

function runMiniModel(arguments_) {
  childProcess.execFileSync(paths.miniModelCli, arguments_, {
    cwd: miniModelRepository,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30000,
    windowsHide: true
  });
}

function launch(file, arguments_, options) {
  const child = childProcess.spawn(file, arguments_, {
    cwd: options && options.cwd ? options.cwd : tinyRustLmRepository,
    env: options && options.env ? options.env : process.env,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout = boundedTail(stdout + chunk.toString("utf8"));
  });
  child.stderr.on("data", (chunk) => {
    stderr = boundedTail(stderr + chunk.toString("utf8"));
  });
  return {
    child,
    readStdout: () => stdout,
    clearOutput: () => {
      stdout = "";
      stderr = "";
    },
    async stop() {
      if (child.exitCode !== null) {
        return;
      }
      terminateProcessTree(child, false);
      await Promise.race([
        new Promise((resolve) => child.once("exit", resolve)),
        sleep(3000)
      ]);
      if (child.exitCode === null) {
        terminateProcessTree(child, true);
        await Promise.race([
          new Promise((resolve) => child.once("exit", resolve)),
          sleep(3000)
        ]);
      }
    }
  };
}

function terminateProcessTree(child, force) {
  if (!child || !Number.isInteger(child.pid) || child.pid < 1) {
    return;
  }
  if (process.platform === "win32") {
    childProcess.spawnSync(
      "taskkill.exe",
      ["/PID", String(child.pid), "/T", "/F"],
      {
        encoding: "utf8",
        stdio: "ignore",
        timeout: 10000,
        windowsHide: true
      }
    );
    return;
  }
  try {
    process.kill(-child.pid, force ? "SIGKILL" : "SIGTERM");
  } catch (error) {
    if (!error || error.code !== "ESRCH") {
      throw error;
    }
  }
}

function boundedTail(value) {
  return value.length <= 65536 ? value : value.slice(value.length - 65536);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address && typeof address === "object" ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function requirePortAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => reject(new Error(`Required loopback port ${port} is already in use`)));
    server.listen(port, "127.0.0.1", () => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });
}

async function waitForHttp(url, processHandle, timeoutMilliseconds = 10000, headers = undefined) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    if (processHandle && processHandle.child.exitCode !== null) {
      throw new Error("Fixture process exited before its HTTP endpoint became ready");
    }
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers,
        signal: AbortSignal.timeout(500)
      });
      if (response.ok) {
        return;
      }
    } catch (_error) {
      // Listener startup is asynchronous.
    }
    await sleep(50);
  }
  throw new Error("Fixture HTTP endpoint did not become ready before its deadline");
}

async function waitForPairingCode(bridgeProcess) {
  const deadline = Date.now() + 10000;
  const pattern = /One-time pairing code:\s*([A-Za-z0-9_-]{16,128})/;
  while (Date.now() < deadline) {
    if (bridgeProcess.child.exitCode !== null) {
      throw new Error("Companion bridge exited before producing a pairing code");
    }
    const match = pattern.exec(bridgeProcess.readStdout());
    if (match) {
      const code = match[1];
      bridgeProcess.clearOutput();
      return code;
    }
    await sleep(25);
  }
  throw new Error("Companion bridge did not produce a pairing code before its deadline");
}

function writeJsonResponse(request, response, status, value, applicationOrigin) {
  const body = `${JSON.stringify(value, null, 2)}\n`;
  response.writeHead(status, {
    "Access-Control-Allow-Origin": applicationOrigin,
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin"
  });
  response.end(request.method === "HEAD" ? "" : body);
}

function writeTextResponse(request, response, status, value, applicationOrigin) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": applicationOrigin,
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(value),
    "Content-Type": "text/plain; charset=utf-8",
    "Vary": "Origin"
  });
  response.end(request.method === "HEAD" ? "" : value);
}

async function startMetadataServer(applicationOrigin, descriptor, peerBaseUrls) {
  const catalogEntry = JSON.parse(fs.readFileSync(descriptor.catalogEntryPath, "utf8"));
  if (descriptor.usageContractPath) {
    const usage = readKeyValueDocument(descriptor.usageContractPath);
    const contextLength = Number(usage.get("context_length"));
    if (!Number.isSafeInteger(contextLength) || contextLength < 1) {
      throw new Error("Controlled model usage contract omitted a valid context length");
    }
    catalogEntry.slm_tokenizer = usage.get("tokenizer");
    catalogEntry.slm_context_length = contextLength;
    catalogEntry.slm_output_contract = usage.get("output_contract");
    catalogEntry.prompt_format = usage.get("prompt_format");
    catalogEntry.intended_use = usage.get("intended_use");
    catalogEntry.evidence_admission_route = catalogEntry.evaluation_evidence_route;
  }
  catalogEntry.peer_source_count = peerBaseUrls.length;
  catalogEntry.peer_sources = peerBaseUrls.map((peerBaseUrl) => ({
    source_kind: "known-direct-http-peer-v0",
    transport: "direct-http-piece-server-v0",
    peer_base_url: peerBaseUrl,
    consent_status: "publisher-declared-consenting-peer",
    project_server_serves_model_bytes: false,
    project_server_runs_model_bytes: false,
    project_server_proxies_model_bytes: false
  }));
  const manifest = fs.readFileSync(descriptor.manifestPath, "utf8");
  const port = await freePort();
  const metadataBaseUrl = `http://127.0.0.1:${port}/models.v0.json`;
  const routePath = (route) => new URL(String(route || ""), metadataBaseUrl).pathname;
  const manifestRoute = routePath(catalogEntry.manifest_route);
  const peerOfferRoute = routePath(catalogEntry.peer_offer_route);
  const modelCardRoute = routePath(catalogEntry.model_card_route);
  const licenseRoute = routePath(catalogEntry.license_route);
  const server = http.createServer((request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      writeTextResponse(request, response, 405, "method not allowed", applicationOrigin);
      return;
    }
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    if (url.pathname === "/models.v0.json") {
      writeJsonResponse(request, response, 200, { catalog_version: 0, entries: [catalogEntry] }, applicationOrigin);
      return;
    }
    if (url.pathname === manifestRoute) {
      writeTextResponse(request, response, 200, manifest, applicationOrigin);
      return;
    }
    if (url.pathname === peerOfferRoute) {
      writeTextResponse(request, response, 404, "peer offer is identity metadata only", applicationOrigin);
      return;
    }
    if (url.pathname === modelCardRoute || url.pathname === licenseRoute) {
      writeTextResponse(
        request,
        response,
        200,
        `${descriptor.modelId} controlled test metadata.\n`,
        applicationOrigin
      );
      return;
    }
    writeTextResponse(request, response, 404, "not found", applicationOrigin);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    catalogUrl: metadataBaseUrl,
    async stop() {
      await new Promise((resolve) => server.close(resolve));
    }
  };
}

async function startThrottledPeerProxy(listenPort, targetBaseUrl, initialDelayMilliseconds) {
  let delayMilliseconds = Math.max(0, Number(initialDelayMilliseconds) || 0);
  let startedPieceResponses = 0;
  let completedPieceResponses = 0;
  const sockets = new Set();
  const target = new URL(targetBaseUrl);
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url, `http://127.0.0.1:${listenPort}`);
    const isPiece = /\/piece-\d{8}\.bin$/i.test(requestUrl.pathname);
    if (isPiece) {
      startedPieceResponses += 1;
    }
    const upstream = http.request({
      hostname: target.hostname,
      port: Number(target.port),
      method: request.method,
      path: `${requestUrl.pathname}${requestUrl.search}`,
      headers: {
        Accept: request.headers.accept || "*/*",
        Connection: "close"
      }
    });
    upstream.on("response", (upstreamResponse) => {
      const headers = {};
      for (const name of [
        "access-control-allow-origin",
        "cache-control",
        "content-length",
        "content-type",
        "vary"
      ]) {
        const value = upstreamResponse.headers[name];
        if (value !== undefined) {
          headers[name] = value;
        }
      }
      response.writeHead(upstreamResponse.statusCode || 502, headers);
      void (async () => {
        let completed = false;
        try {
          for await (const chunk of upstreamResponse) {
            if (isPiece && delayMilliseconds > 0) {
              await sleep(delayMilliseconds);
            }
            if (!response.write(chunk)) {
              await new Promise((resolve) => response.once("drain", resolve));
            }
          }
          completed = true;
          response.end();
        } catch (_error) {
          response.destroy();
        } finally {
          if (isPiece && completed) {
            completedPieceResponses += 1;
          }
        }
      })();
    });
    upstream.on("error", () => {
      if (!response.headersSent) {
        response.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
      }
      response.end("controlled peer proxy failed");
    });
    request.on("aborted", () => upstream.destroy());
    response.on("close", () => {
      if (!response.writableEnded) {
        upstream.destroy();
      }
    });
    upstream.end();
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(listenPort, "127.0.0.1", resolve);
  });
  return {
    setDelay(value) {
      delayMilliseconds = Math.max(0, Number(value) || 0);
    },
    stats() {
      return { startedPieceResponses, completedPieceResponses, delayMilliseconds };
    },
    async stop() {
      for (const socket of sockets) {
        socket.destroy();
      }
      await new Promise((resolve) => server.close(resolve));
    }
  };
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function findFiles(root, predicate) {
  const matches = [];
  if (!fs.existsSync(root)) {
    return matches;
  }
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      matches.push(...findFiles(fullPath, predicate));
    } else if (entry.isFile() && predicate(fullPath, entry.name)) {
      matches.push(fullPath);
    }
  }
  return matches;
}

function safeRemoveTestRoot(root) {
  const resolved = path.resolve(root);
  const temporaryRoot = path.resolve(os.tmpdir());
  if (
    !resolved.startsWith(`${temporaryRoot}${path.sep}`) ||
    !path.basename(resolved).startsWith("tinyrustlm-playwright-companion-")
  ) {
    throw new Error("Refusing to remove a directory outside the owned Playwright fixture root");
  }
  fs.rmSync(resolved, {
    recursive: true,
    force: true,
    maxRetries: 20,
    retryDelay: 100
  });
}

async function createCompanionFixture(applicationOrigin, options = {}) {
  requireFixtureFiles();
  const descriptor = fixtureDescriptor(options);
  const secondPeerMismatch = options && options.secondPeerMismatch === true;
  if (secondPeerMismatch && descriptor.modelId !== "tinyrustlm/tiny-test-model-q8") {
    throw new Error("The controlled peer-mismatch lane is defined only for the q8 fixture");
  }
  const throttlePieceMilliseconds = Math.max(
    0,
    Number(options && options.throttlePieceMilliseconds) || 0
  );
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-playwright-companion-"));
  const bridgeRoot = path.join(root, "bridge");
  const pieceDirectory = descriptor.preparePieces
    ? path.join(root, "peer-pieces")
    : descriptor.pieceDirectory;
  const peerProcesses = [];
  const peerProxies = [];
  let bridgeProcess = null;
  let metadataServer = null;
  try {
    if (descriptor.preparePieces) {
      runMiniModel([
        "export-peer-pieces",
        descriptor.manifestPath,
        descriptor.artifactPath,
        pieceDirectory
      ]);
    }
    let mismatchManifest = "";
    let mismatchPieceDirectory = "";
    if (secondPeerMismatch) {
      const mismatchShareDirectory = path.join(root, "mismatch-share");
      runMiniModel([
        "prepare-peer-share",
        paths.mismatchArtifact,
        mismatchShareDirectory,
        "tinyrustlm/mismatch-q4"
      ]);
      mismatchManifest = path.join(
        mismatchShareDirectory,
        "tiny-test-model-q4.minimodel.manifest.v0"
      );
      mismatchPieceDirectory = path.join(
        mismatchShareDirectory,
        "tiny-test-model-q4.peer-pieces"
      );
    }
    const peerBaseUrls = [];
    for (const lane of ["a", "b"]) {
      const peerPort = await freePort();
      let proxyPort = 0;
      if (lane === "a" && throttlePieceMilliseconds > 0) {
        do {
          proxyPort = await freePort();
        } while (proxyPort === peerPort);
      }
      const bindAddress = `127.0.0.1:${peerPort}`;
      const targetPeerBaseUrl = `http://${bindAddress}/peer/`;
      const peerBaseUrl = proxyPort
        ? `http://127.0.0.1:${proxyPort}/peer/`
        : targetPeerBaseUrl;
      const statePath = path.join(root, `peer-${lane}-state.json`);
      const laneManifest = secondPeerMismatch && lane === "b"
        ? mismatchManifest
        : descriptor.manifestPath;
      const lanePieceDirectory = secondPeerMismatch && lane === "b"
        ? mismatchPieceDirectory
        : pieceDirectory;
      runMiniModel([
        "write-peer-companion-state",
        laneManifest,
        lanePieceDirectory,
        statePath,
        peerBaseUrl
      ]);
      const peerProcess = launch(paths.miniModelCli, [
        "serve-peer-companion",
        statePath,
        laneManifest,
        lanePieceDirectory,
        bindAddress
      ], { cwd: miniModelRepository });
      peerProcesses.push(peerProcess);
      await waitForHttp(`${targetPeerBaseUrl}minimodel.peer_status.v0.json`, peerProcess, 30000);
      if (proxyPort) {
        const proxy = await startThrottledPeerProxy(
          proxyPort,
          targetPeerBaseUrl,
          throttlePieceMilliseconds
        );
        peerProxies.push(proxy);
        await waitForHttp(`${peerBaseUrl}minimodel.peer_status.v0.json`, null, 10000);
      }
      peerBaseUrls.push(peerBaseUrl);
    }
    const peerContactCards = peerBaseUrls.map((peerBaseUrl, index) => {
      const cardPath = path.join(root, `peer-${index + 1}.contact-card.json`);
      runMiniModel([
        "write-peer-contact-card",
        cardPath,
        peerBaseUrl,
        `Controlled peer ${index + 1}`
      ]);
      return cardPath;
    });
    const peerContactBookPath = path.join(root, "controlled-peers.contact-book.json");
    runMiniModel([
      "write-peer-contact-book",
      peerContactBookPath,
      ...peerContactCards
    ]);
    runMiniModel(["inspect-peer-contact-book", peerContactBookPath]);
    metadataServer = await startMetadataServer(applicationOrigin, descriptor, peerBaseUrls);
    await requirePortAvailable(43127);

    const startBridge = async () => {
      bridgeProcess = launch(paths.bridgeTool, [
        "bridge",
        "--root", bridgeRoot,
        "--origin", applicationOrigin,
        "--port", "43127",
        "--minimodel", paths.miniModelCli,
        "--allow-sharing"
      ], {
        cwd: tinyRustLmRepository,
        env: {
          ...process.env,
          MINIMODEL_NATIVE_PATH: paths.miniModelNative
        }
      });
      const pairingCode = await waitForPairingCode(bridgeProcess);
      await waitForHttp(
        "http://127.0.0.1:43127/v1/health",
        bridgeProcess,
        10000,
        {
          Origin: applicationOrigin,
          "X-TinyRustLM-Bridge-Version": "1"
        }
      );
      return pairingCode;
    };

    const pairingCode = await startBridge();
    const catalogEntry = JSON.parse(fs.readFileSync(descriptor.catalogEntryPath, "utf8"));
    return {
      applicationOrigin,
      artifactPath: descriptor.artifactPath,
      artifactByteCount: catalogEntry.artifact_byte_count,
      artifactSha256: String(catalogEntry.artifact_sha256).replace(/^sha256:/, ""),
      bridgeRoot,
      catalogUrl: metadataServer.catalogUrl,
      modelId: descriptor.modelId,
      pairingCode,
      peerBaseUrls,
      peerContactBookPath,
      async restartBridge() {
        await bridgeProcess.stop();
        await requirePortAvailable(43127);
        return startBridge();
      },
      setPeerThrottle(delayMilliseconds) {
        for (const proxy of peerProxies) {
          proxy.setDelay(delayMilliseconds);
        }
      },
      peerProxyStats() {
        return peerProxies.map((proxy) => proxy.stats());
      },
      async waitForStartedPieceResponseCount(expectedCount, timeoutMilliseconds) {
        const deadline = Date.now() + timeoutMilliseconds;
        while (Date.now() < deadline) {
          const started = this.peerProxyStats().reduce(
            (total, value) => total + value.startedPieceResponses,
            0
          );
          if (started >= expectedCount) {
            return;
          }
          if (bridgeProcess && bridgeProcess.child.exitCode !== null) {
            throw new Error("Companion bridge exited before starting the expected piece response");
          }
          await sleep(25);
        }
        throw new Error(
          `Companion started fewer than ${expectedCount} piece responses before the deadline`
        );
      },
      stagedPieceEvidence() {
        return findFiles(bridgeRoot, (_filePath, name) => /^piece-\d{8}\.bin$/i.test(name))
          .sort((left, right) => left.localeCompare(right))
          .map((filePath) => {
            const stat = fs.statSync(filePath);
            return {
              relativePath: path.relative(bridgeRoot, filePath).replaceAll(path.sep, "/"),
              byteCount: stat.size,
              sha256: sha256File(filePath),
              modifiedMilliseconds: stat.mtimeMs
            };
          });
      },
      async waitForStagedPieceCount(expectedCount, timeoutMilliseconds) {
        const deadline = Date.now() + timeoutMilliseconds;
        while (Date.now() < deadline) {
          if (this.stagedPieceEvidence().length >= expectedCount) {
            return;
          }
          if (bridgeProcess && bridgeProcess.child.exitCode !== null) {
            throw new Error("Companion bridge exited before staging the expected verified pieces");
          }
          await sleep(50);
        }
        throw new Error(
          `Companion staged fewer than ${expectedCount} verified pieces before the deadline`
        );
      },
      importedArtifacts() {
        return findFiles(bridgeRoot, (filePath) => filePath.toLowerCase().endsWith(".slm"));
      },
      persistedStates() {
        return findFiles(bridgeRoot, (_filePath, name) => name === "bridge-import-state.v1.json");
      },
      importStateSummaries() {
        return this.persistedStates().map((statePath) => {
          const value = JSON.parse(fs.readFileSync(statePath, "utf8"));
          return {
            operationId: value.operation_id || value.operationId || "",
            state: value.state || "",
            errorCode: value.error_code || value.errorCode || "",
            modelId: value.model_id || value.modelId || "",
            artifactByteCount: value.artifact_byte_count || value.artifactByteCount || 0,
            pieceCount: value.piece_count || value.pieceCount || 0,
            downloadedPieceCount: value.downloaded_piece_count ?? value.downloadedPieceCount ?? 0,
            reusedPieceCount: value.reused_piece_count ?? value.reusedPieceCount ?? 0,
            refetchedCorruptPieceCount:
              value.refetched_corrupt_piece_count ?? value.refetchedCorruptPieceCount ?? 0,
            networkRetryCount: value.network_retry_count ?? value.networkRetryCount ?? 0,
            wasResumed: value.was_resumed ?? value.wasResumed ?? false
          };
        });
      },
      importReceiptTexts() {
        return findFiles(
          bridgeRoot,
          (_filePath, name) => name.toLowerCase().endsWith(".minimodel-receipt")
        ).map((filePath) => fs.readFileSync(filePath, "utf8"));
      },
      async dispose() {
        if (bridgeProcess) {
          await bridgeProcess.stop();
        }
        if (metadataServer) {
          await metadataServer.stop();
        }
        for (const proxy of peerProxies.reverse()) {
          await proxy.stop();
        }
        for (const peerProcess of peerProcesses.reverse()) {
          await peerProcess.stop();
        }
        safeRemoveTestRoot(root);
      }
    };
  } catch (error) {
    if (bridgeProcess) {
      await bridgeProcess.stop();
    }
    if (metadataServer) {
      await metadataServer.stop();
    }
    for (const proxy of peerProxies.reverse()) {
      await proxy.stop();
    }
    for (const peerProcess of peerProcesses.reverse()) {
      await peerProcess.stop();
    }
    safeRemoveTestRoot(root);
    throw error;
  }
}

module.exports = Object.freeze({
  createCompanionFixture,
  sha256File
});
