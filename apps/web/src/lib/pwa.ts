// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { usePwaStore } from '@/stores/pwaStore'

/**
 * Registers the Workbox service worker — the app's only touch-point with
 * navigator.serviceWorker (ADR 007). No-ops outside production builds, so the
 * dev server, unit tests and a future native wrapper run without a service worker.
 */
export async function registerServiceWorker(): Promise<void> {
  // ─── guards ────────────────────────────────────────────────────────────────
  if (!import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) return

  // ─── registration ──────────────────────────────────────────────────────────
  try {
    // Dynamic import keeps workbox-window out of dev and out of the main chunk.
    const { registerSW } = await import('virtual:pwa-register')
    const store = usePwaStore.getState()
    const updateSW = registerSW({
      onNeedRefresh: () => store.setNeedRefresh(true),
      onOfflineReady: () => store.setOfflineReady(true),
      onRegisterError: (error) => console.warn('[pwa] service worker registration failed', error),
    })
    store.setUpdateServiceWorker(updateSW)
  } catch (error) {
    // The app must work identically without a service worker — never surface this to the reader.
    console.warn('[pwa] service worker unavailable', error)
  }
}
