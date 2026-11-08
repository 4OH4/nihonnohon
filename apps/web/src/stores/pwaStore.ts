// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { create } from 'zustand'

/**
 * Tells the waiting service worker to skip waiting; the page then reloads once it takes control.
 * vite-plugin-pwa 2.0 ignores `reloadPage` in prompt mode — the reload always happens
 * (registerServiceWorker passes no onNeedReload), so callers cannot suppress it.
 */
type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>

interface PwaStoreState {
  /** A new service worker is installed and waiting (se4-3 shows UpdatePrompt). */
  needRefresh: boolean
  /** The app shell has been precached for offline use (first install). */
  offlineReady: boolean
  /**
   * Handle from registerSW, stored as soon as registration *starts* (always null outside
   * production builds). Non-null does not mean a worker exists — gate UI on needRefresh.
   */
  updateServiceWorker: UpdateServiceWorker | null
  setNeedRefresh: (v: boolean) => void
  setOfflineReady: (v: boolean) => void
  setUpdateServiceWorker: (fn: UpdateServiceWorker) => void
  /** Clears the update/offline flags but keeps the update handle (registerSW runs once per page). */
  reset: () => void
  /** Test teardown: restores the full initial state, including the update handle. */
  _reset: () => void
}

const initialState = {
  needRefresh: false,
  offlineReady: false,
  updateServiceWorker: null as UpdateServiceWorker | null,
}

/**
 * Runtime service-worker state, written only by registerServiceWorker() in
 * src/lib/pwa.ts. Not persisted: it describes the current page's worker.
 */
export const usePwaStore = create<PwaStoreState>()((set) => ({
  ...initialState,
  setNeedRefresh: (v) => set({ needRefresh: v }),
  setOfflineReady: (v) => set({ offlineReady: v }),
  setUpdateServiceWorker: (fn) => set({ updateServiceWorker: fn }),
  reset: () => set({ needRefresh: false, offlineReady: false }),
  _reset: () => set(initialState),
}))
