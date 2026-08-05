// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import type { Page } from '@playwright/test'

/**
 * Resizes until the page actually lays out at `width` CSS pixels.
 *
 * WebKit on Windows lays out at the host's display-scaling factor rather than the
 * requested viewport — at 125% a 412px viewport becomes 330 CSS px, and
 * `deviceScaleFactor` does not override it. Left uncompensated, a test describes one
 * width while measuring another, and narrow-viewport assertions fail locally for a
 * reason that has nothing to do with the code under test.
 *
 * Measured via getBoundingClientRect, not documentElement.clientWidth: under mobile
 * emulation the latter reports the scaled *visual* viewport while the page genuinely
 * lays out at the requested width, so it would provoke a correction that is not
 * needed and overshoot.
 *
 * Call after the page has loaded — it measures the live document.
 */
export async function useCssViewport(page: Page, width: number, height: number) {
  const layoutWidth = () => page.evaluate(() => document.documentElement.getBoundingClientRect().width)
  const actual = await layoutWidth()
  if (Math.abs(actual - width) <= 2) return
  const scale = width / actual
  await page.setViewportSize({ width: Math.round(width * scale), height: Math.round(height * scale) })
}
