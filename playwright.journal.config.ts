import { defineConfig } from '@playwright/test';
import config from './playwright.config';

export default defineConfig(config, {
  testMatch: '**/journal-content.spec.ts',
  testIgnore: [],
  outputDir: 'test-results/journal',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/journal' }]],
  use: { ...config.use, baseURL: 'http://127.0.0.1:4331' },
  webServer: {
    command: 'npm run build -- --force && npm run preview -- --host 127.0.0.1 --port 4331 --ignore-lock',
    env: { JOURNAL_TEST_DATA: '1' },
    url: 'http://127.0.0.1:4331',
    reuseExistingServer: false,
    timeout: 60_000
  }
});
