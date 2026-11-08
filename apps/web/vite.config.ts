// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// Mirrors the meta description in index.html — keep the two identical.
const APP_DESCRIPTION =
  'Nihon no Hon — read Japanese stories at your level with instant word lookup and kanji breakdown.'

export default defineConfig({
  plugins: [
    react(),
    // Installable PWA (ADR 007). See project-context.md → PWA & Offline.
    VitePWA({
      // Updates wait for the reader's choice (FR47); se4-3 surfaces them via UpdatePrompt.
      registerType: 'prompt',
      // Registration happens only in src/lib/pwa.ts — never an injected registerSW.js.
      injectRegister: false,
      // No service worker under `vite` dev: keeps the default Playwright suite SW-free.
      devOptions: { enabled: false },
      manifest: {
        id: '/',
        name: 'Nihon no Hon',
        short_name: 'Nihon no Hon',
        description: APP_DESCRIPTION,
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#FDF6E3', // paper-bg token
        background_color: '#FDF6E3', // paper-bg token
        lang: 'en',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // workbox: intentionally left at plugin defaults — se4-2 owns globPatterns / navigateFallback.
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
  },
})
