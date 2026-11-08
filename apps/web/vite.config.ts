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
      // Workbox generates sw.js from config; no hand-written worker (ADR 007).
      strategies: 'generateSW',
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
      // A file over Workbox's 2 MiB per-file limit is otherwise dropped from the precache silently.
      showMaximumFileSizeToCacheInBytesWarning: true,
      // Whole-library precache (ADR 007, offline option "b"): app shell, fonts, dictionary data,
      // the story manifest and every story. Budget ≤ 10 MB — enforced by e2e-pwa/precache.spec.ts.
      // Large optional assets are opt-in downloads outside the precache; never widen these globs for them.
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico,webmanifest,json}'],
        // Deep links (/read/:storyId) open offline; /_vercel/* (Analytics, Speed Insights) stays on the network.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/_vercel\//],
        // Never set skipWaiting / clientsClaim: updates wait for the reader (FR47, se4-3).
      },
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
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '**/e2e-pwa/**'],
  },
})
