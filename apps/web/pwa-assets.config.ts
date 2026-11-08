// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

/** Generates the PWA icon set into public/ from the single source SVG (run: pnpm generate-pwa-assets). */
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // The source is already a full-bleed paper-bg square with the glyph inside the safe zone,
    // so maskable/apple need no extra padding; background matches paper-bg in case of any edge.
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#FDF6E3' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#FDF6E3' } },
  },
  images: ['public/favicon.svg'],
})
