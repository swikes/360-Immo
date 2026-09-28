// Tests automatiques du nouveau site (Playwright).
// D'abord construire le site : npm run build   ·   puis : npm test   ·   rapport : npm run rapport
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 6_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["github"], ["list"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Chaque test tourne sur ordinateur et sur téléphone (iPhone 13 simulé dans Chromium)
  projects: [
    { name: "ordinateur", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 800 } } },
    { name: "telephone", use: { ...devices["iPhone 13"], browserName: "chromium" } },
  ],
  // Le site construit (npm run build), servi comme il le sera en ligne
  webServer: {
    command: `npx next start -p ${PORT} -H 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
