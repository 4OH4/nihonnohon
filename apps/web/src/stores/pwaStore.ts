// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { create } from 'zustand'

/**
 * Tells the waiting service worker to skip waiting; the page then reloads once it takes control.
 * With no waiting worker (its update already activated), it reloads the page directly.
 * vite-plugin-pwa 2.0 ignores `reloadPage` in prompt mode — the reload always happens
 * (registerServiceWorker passes no onNeedReload), so callers cannot suppress it.
 */
type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>

/** Chromium's deferred install prompt (not in lib.dom). */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export interface PwaStoreState {
  /** A new service worker is installed and waiting; UpdatePrompt shows the toast. */
  needRefresh: boolean
  /** The app shell has been precached for offline use (first install). */
  offlineReady: boolean
  /**
   * Handle from registerSW, stored as soon as registration *starts* (always null outside
   * production builds). Non-null does not mean a worker exists — gate UI on needRefresh.
   */
  updateServiceWorker: UpdateServiceWorker | null
  /** The reader dismissed the update toast; in memory only, so it returns on the next launch. */
  updateDismissed: boolean
  /** Deferred `beforeinstallprompt` event; null when the browser has not offered install (or it was used). */
  installPrompt: BeforeInstallPromptEvent | null
  /** Running as an installed app (display-mode standalone, or iOS navigator.standalone). Set once at startup. */
  standalone: boolean
  /** iOS/iPadOS browser tab that can Add to Home Screen (no install API), so the library shows the instruction. */
  iosInstallable: boolean
  /** Setting true also clears updateDismissed, so a newer waiting worker shows the toast again. */
  setNeedRefresh: (v: boolean) => void
  setOfflineReady: (v: boolean) => void
  setUpdateServiceWorker: (fn: UpdateServiceWorker) => void
  dismissUpdate: () => void
  setInstallPrompt: (e: BeforeInstallPromptEvent | null) => void
  setInstallContext: (ctx: { standalone: boolean; iosInstallable: boolean }) => void
  /**
   * Clears the update/offline/dismiss flags but keeps the update handle (registerSW runs once
   * per page) and the install fields (they describe the browser, captured once per page).
   */
  reset: () => void
  /** Test teardown: restores the full initial state, including the update handle. */
  _reset: () => void
}

const initialState = {
  needRefresh: false,
  offlineReady: false,
  updateServiceWorker: null as UpdateServiceWorker | null,
  updateDismissed: false,
  installPrompt: null as BeforeInstallPromptEvent | null,
  standalone: false,
  iosInstallable: false,
}

/**
 * Runtime service worker and install state, written by src/lib/pwa.ts — except that
 * UpdatePrompt calls dismissUpdate and the library's install link calls
 * setInstallPrompt(null) after the reader's choice. Not persisted: it describes the current page.
 */
export const usePwaStore = create<PwaStoreState>()((set) => ({
  ...initialState,
  setNeedRefresh: (v) => set(v ? { needRefresh: true, updateDismissed: false } : { needRefresh: false }),
  setOfflineReady: (v) => set({ offlineReady: v }),
  setUpdateServiceWorker: (fn) => set({ updateServiceWorker: fn }),
  dismissUpdate: () => set({ updateDismissed: true }),
  setInstallPrompt: (e) => set({ installPrompt: e }),
  setInstallContext: ({ standalone, iosInstallable }) => set({ standalone, iosInstallable }),
  reset: () => set({ needRefresh: false, offlineReady: false, updateDismissed: false }),
  _reset: () => set(initialState),
}))

/** Which install affordance the library shows: the native prompt, the iOS instruction, or none. */
export function selectInstallOption(s: PwaStoreState): 'prompt' | 'ios' | null {
  if (s.standalone) return null
  if (s.installPrompt) return 'prompt'
  return s.iosInstallable ? 'ios' : null
}

// ─── test hook ───────────────────────────────────────────────────────────────
// Dev builds only (stripped from production): lets the default Playwright suite, which runs on
// `vite` dev with no service worker, show UpdatePrompt by driving the store directly.
declare global {
  interface Window {
    __PWA_STORE__?: typeof usePwaStore
  }
}
if (import.meta.env.DEV) window.__PWA_STORE__ = usePwaStore
