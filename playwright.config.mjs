// Playwright configuration for the real-browser smoke tests. Run: npm run test:e2e
import { defineConfig, devices } from '@playwright/test';

const chromiumArgs = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--ignore-gpu-blocklist',
  '--enable-unsafe-swiftshader',
];

// Dedicated port 5183 and no reuse of an existing server: avoids testing a different dev server
// that happens to be running on 5173.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.mjs',
  timeout: 90_000,
  retries: 0,
  workers: 1,
  outputDir: 'test-results',
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5183',
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: 'npm run dev -- --port 5183 --strictPort',
    url: 'http://localhost:5183',
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: { args: chromiumArgs } },
    },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
