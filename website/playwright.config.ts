import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const external = process.env.WEBSITE_BASE_URL;
export default defineConfig({
  testDir: './tests',
  reporter: 'line',
  outputDir: '../test-results/website',
  workers: 1,
  use: { baseURL: external || 'http://127.0.0.1:4321', headless: true },
  webServer: external ? undefined : {
    // Keep the preview in Playwright's process tree rather than Astro's
    // agent-detected background mode or a stale preview lock.
    command: 'npm run preview -- --ignore-lock',
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
