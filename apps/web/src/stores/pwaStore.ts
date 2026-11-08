// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { create } from 'zustand'

/** Activates the waiting service worker and (by default) reloads the page once. */
type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>

interface PwaStoreState {
  /** A new service worker is installed and waiting (se4-3 shows UpdatePrompt). */
  needRefresh: boolean
  /** The app shell has been precached for offline use (first install). */
  offlineReady: boolean
  /** Handle from registerSW; null until registered (and always null outside production builds). */
  updateServiceWorker: UpdateServiceWorker | null
  setNeedRefresh: (v: boolean) => void
  setOfflineReady: (v: boolean) => void
  setUpdateServiceWorker: (fn: UpdateServiceWorker) => void
  reset: () => void
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
  reset: () => set(initialState),
  _reset: () => set(initialState),
}))
