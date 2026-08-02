"use strict";

const path = require("path");
const { defineConfig } = require("@playwright/test");

const port = Number.parseInt(process.env.TINYRUSTLM_PLAYWRIGHT_PORT || "8187", 10);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("TINYRUSTLM_PLAYWRIGHT_PORT must be an unprivileged TCP port");
}

const applicationOrigin = `http://127.0.0.1:${port}`;

module.exports = defineConfig({
  testDir: path.join(__dirname, "e2e"),
  outputDir: path.join(__dirname, "artifacts", "playwright", "test-results"),
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["line"],
    ["json", {
      outputFile: path.join(__dirname, "artifacts", "playwright", "results.json")
    }],
    ["html", {
      open: "never",
      outputFolder: path.join(__dirname, "artifacts", "playwright", "report")
    }]
  ],
  expect: {
    timeout: 10000
  },
  use: {
    baseURL: applicationOrigin,
    colorScheme: "dark",
    locale: "en-US",
    launchOptions: {
      args: ["--host-resolver-rules=MAP tinyrustlm.com 127.0.0.1"]
    },
    actionTimeout: 10000,
    navigationTimeout: 30000,
    screenshot: "only-on-failure",
    trace: "off",
    video: "off"
  },
  webServer: {
    command: `node tools/static-server.js . ${port}`,
    cwd: __dirname,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 30000
  },
  projects: [
    {
      name: "desktop",
      use: { viewport: { width: 1365, height: 768 } }
    },
    {
      name: "narrow-desktop",
      testIgnore: /companion\.spec\.js/,
      use: { viewport: { width: 1024, height: 768 } }
    },
    {
      name: "mobile",
      testIgnore: /companion\.spec\.js/,
      use: {
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true
      }
    },
    {
      name: "reduced-motion",
      testIgnore: /companion\.spec\.js/,
      use: {
        viewport: { width: 1365, height: 768 },
        reducedMotion: "reduce"
      }
    }
  ]
});
