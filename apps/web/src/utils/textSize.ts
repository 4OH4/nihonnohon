// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

/**
 * Font size values for each textSize preference setting.
 * Uses clamp() so text is larger on narrow mobile viewports and collapses to
 * the desktop-floor value (min) above ~800px viewport width.
 */
export const TEXT_SIZE_VALUES = {
  small: 'clamp(1rem, calc(1.5rem - 1vw), 1.5rem)',
  medium: 'clamp(1.25rem, calc(1.75rem - 1vw), 1.75rem)',
  large: 'clamp(1.5rem, calc(2rem - 1vw), 2rem)',
} as const
