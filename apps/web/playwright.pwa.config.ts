// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { defineConfig, devices } from '@playwright/test'

/**
 * Offline / service-worker suite (se4-2). Runs against a production build on `vite preview`,
 * because no service worker exists under `vite` dev. Chromium only: Playwright's WebKit and
 * Firefox service worker support is too limited to be meaningful here.
 */
export default defineConfig({
  testDir: './e2e-pwa',
  // Kept apart from the default suite: CI's snapshot-mismatch detection scans test-results/.
  outputDir: './test-results-pwa',
  reporter: [['html', { outputFolder: 'playwright-report-pwa', open: 'never' }], ['list']],
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  use: {
    baseURL: 'http://localhost:4173',
    serviceWorkers: 'allow',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Always build: the specs must exercise the sw.js being served. `vite build` skips `tsc -b`,
    // which the typecheck step already covers. Needs vocab.json and built workspace packages.
    command: 'vite build && vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    // Never reuse: a stale preview would serve an old precache.
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
