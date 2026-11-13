import { defineConfig, devices } from '@playwright/test';

import { AUTH_FILE, BASE_URL } from './support/constants';

/**
 * The suite runs against a built webapp served by `wrangler dev`, not the Vite
 * dev server. That keeps `ASSETS`, `run_worker_first`, and the SPA fallback in
 * the test path, and keeps the development-only Agentation toolbar out of the
 * DOM (see plans/003-e2e-playwright.md).
 */
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(BASE_URL)) {
   throw new Error(`Refusing to run e2e against ${BASE_URL}. Only localhost is allowed.`);
}

export default defineConfig({
   testDir: './tests',
   outputDir: './.artifacts/test-results',
   globalSetup: './support/global-setup.ts',
   fullyParallel: false,
   // One Worker, one owner account: tests are isolated by unique data, not by
   // users or databases. Parallel workers would still share the session limits
   // and the rate-limit table.
   workers: 1,
   retries: 0,
   forbidOnly: Boolean(process.env.CI),
   timeout: 30_000,
   expect: { timeout: 5_000 },
   reporter: [
      ['list'],
      ['html', { outputFolder: './.artifacts/report', open: 'never' }],
      ...(process.env.CI ? ([['github']] as const) : []),
   ],
   use: {
      baseURL: BASE_URL,
      locale: 'en-US',
      timezoneId: 'UTC',
      colorScheme: 'light',
      reducedMotion: 'reduce',
      trace: 'retain-on-failure',
      screenshot: 'only-on-failure',
      video: 'off',
   },
   projects: [
      {
         name: 'chromium',
         use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE },
      },
   ],
   webServer: {
      command: 'node scripts/serve.mjs',
      url: `${BASE_URL}/api/v1/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
   },
});
