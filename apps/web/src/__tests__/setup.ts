// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import '@testing-library/jest-dom'

// Radix UI components use ResizeObserver internally; mock it for jsdom
global.ResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))
