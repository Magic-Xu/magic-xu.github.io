import { defineConfig } from '@playwright/test';
import process from 'node:process';

export default defineConfig({
  testDir: './tests',
  testIgnore: '**/journal-content.spec.ts',
  timeout: process.env.CI ? 180_000 : 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // WebGL tests share a GPU; parallel pages would distort timing.
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/report.json' }]],
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://127.0.0.1:4330',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium',
    deviceScaleFactor: process.env.CI ? .2 : 1,
    launchOptions: process.env.CI ? { args: ['--enable-unsafe-swiftshader'] } : undefined,
    viewport: { width: 1440, height: 960 },
    trace: 'retain-on-failure', screenshot: 'only-on-failure'
  },
  webServer: process.env.TEST_BASE_URL ? undefined : {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4330 --ignore-lock',
    url: 'http://127.0.0.1:4330', reuseExistingServer: false, timeout: 60_000
  }
});
