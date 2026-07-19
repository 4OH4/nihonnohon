// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: 'html',
  // Pixel snapshots are inherently sensitive to sub-pixel / anti-aliasing
  // rendering noise, which varies run-to-run in CI. Allow a small fraction of
  // differing pixels so baselines don't thrash, while still catching real UI
  // changes (a genuine toggle change alters far more than 2% of the image).
  expect: {
    toMatchSnapshot: { maxDiffPixelRatio: 0.02 },
  },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: 'vite',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env['CI'],
  },
})
