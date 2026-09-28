// Configuration des tests automatiques (Playwright).
// Lancer : npm test   ·   Rapport : npm run rapport
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 6_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:8765/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Chaque test tourne sur ordinateur et sur téléphone (iPhone 13 simulé dans Chromium)
  projects: [
    { name: 'ordinateur', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 800 } } },
    { name: 'telephone', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
  ],
  // Petit serveur local qui sert les pages, comme GitHub Pages
  webServer: {
    command: 'python3 -m http.server 8765 --bind 127.0.0.1',
    url: 'http://127.0.0.1:8765/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    stderr: 'ignore',   // journal des requêtes du serveur local
  },
});
