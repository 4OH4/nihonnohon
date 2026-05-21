// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { test, expect } from '@playwright/test'

test('app loads with non-empty title', async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.status()).toBe(200)
  const title = await page.title()
  expect(title.length).toBeGreaterThan(0)
})
