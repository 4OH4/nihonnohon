// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { usePwaStore, type BeforeInstallPromptEvent } from '@/stores/pwaStore'

declare global {
  interface Navigator {
    /** iOS Safari only: true when launched from the home screen. */
    standalone?: boolean
  }
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
  }
}

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
      onRegisteredSW: (_swUrl, registration) => {
        if (registration) watchForUpdates(registration)
      },
      onRegisterError: (error) => console.warn('[pwa] service worker registration failed', error),
    })
    store.setUpdateServiceWorker(updateSW)
  } catch (error) {
    // The app must work identically without a service worker — never surface this to the reader.
    console.warn('[pwa] service worker unavailable', error)
  }
}

// ─── periodic update check ───────────────────────────────────────────────────

const UPDATE_INTERVAL_MS = 60 * 60 * 1000
const MIN_CHECK_GAP_MS = 60 * 1000

/**
 * Asks the browser to re-check sw.js hourly and whenever the app returns to the foreground.
 * An installed app is usually resumed, not relaunched, and client-side navigation never
 * triggers the browser's own update check, so without this a deploy would go unseen.
 * Listeners live for the page's lifetime (registration runs once per page).
 */
function watchForUpdates(registration: ServiceWorkerRegistration): void {
  // Registration has just fetched sw.js, so the gap starts now.
  let lastCheck = Date.now()
  const check = () => {
    if (Date.now() - lastCheck < MIN_CHECK_GAP_MS) return
    if (navigator.onLine === false || registration.installing) return
    lastCheck = Date.now()
    registration.update().catch(() => {}) // offline or server down: try again next time
  }
  setInterval(check, UPDATE_INTERVAL_MS)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
}

// ─── install capture ─────────────────────────────────────────────────────────

/** True when running as an installed app rather than in a browser tab. */
export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches === true || navigator.standalone === true
}

/** iPhone/iPod/iPad, including iPadOS 13+ which reports a Macintosh UA but has touch. */
export function isIosDevice(): boolean {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

/** iOS major/minor from "CPU iPhone OS 16_4" / "CPU OS 16_4" UAs; null when absent (iPadOS desktop mode). */
function iosVersion(ua: string): [number, number] | null {
  const m = /\bOS (\d+)_(\d+)/.exec(ua)
  return m ? [Number(m[1]), Number(m[2])] : null
}

/**
 * Whether this iOS browser offers Add to Home Screen. Safari always has; Chrome, Firefox and
 * Edge on iOS gained it in iOS 16.4. Unknown version → assume yes. In-app browsers are not
 * detectable and are accepted as a known gap (RT, 2026-11-08).
 */
export function canAddToHomeScreen(): boolean {
  if (!isIosDevice()) return false
  const ua = navigator.userAgent
  if (!/CriOS|FxiOS|EdgiOS/.test(ua)) return true // Safari (or a browser indistinguishable from it)
  const v = iosVersion(ua)
  return v === null || v[0] > 16 || (v[0] === 16 && v[1] >= 4)
}

/**
 * Captures Chromium's install prompt for the library's "Install app" link and records the
 * install context. Not PROD-gated: the event only fires for an installable production build,
 * and tests dispatch it synthetically. Returns a cleanup function (used by tests).
 */
export function initInstallPrompt(): () => void {
  const store = usePwaStore.getState()

  // ─── install context (once per page) ───────────────────────────────────────
  const standalone = isStandalone()
  store.setInstallContext({ standalone, iosInstallable: !standalone && canAddToHomeScreen() })

  // ─── listeners ─────────────────────────────────────────────────────────────
  // Captured at startup, not in the library: the event can fire before the library mounts
  // (a /read/... deep link), and the store keeps it across the library's remounts.
  const onBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
    event.preventDefault() // no mini-infobar: the UX rules out first-visit banners
    store.setInstallPrompt(event)
  }
  const onAppInstalled = () => store.setInstallPrompt(null)

  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  window.addEventListener('appinstalled', onAppInstalled)
  return () => {
    window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.removeEventListener('appinstalled', onAppInstalled)
  }
}
