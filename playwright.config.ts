import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
const chrome =
  process.env.CHROME_PATH ??
  [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].find((path) => existsSync(path));

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  outputDir: ".cache/browser-results",
  reporter: [["list"], ["json", { outputFile: ".cache/browser-results.json" }]],
  use: {
    baseURL: "http://127.0.0.1:5323",
    headless: true,
    launchOptions: {
      executablePath: chrome,
    },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node tests/fixtures/server.ts",
    url: "http://127.0.0.1:5323/api/health",
    reuseExistingServer: false,
    timeout: 20000,
  },
});
