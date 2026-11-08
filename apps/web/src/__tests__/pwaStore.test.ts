// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { describe, it, expect, afterEach, vi } from 'vitest'
import { usePwaStore } from '@/stores/pwaStore'

afterEach(() => usePwaStore.getState()._reset())

describe('usePwaStore', () => {
  it('starts with no pending update, not offline-ready and no update handle', () => {
    const state = usePwaStore.getState()
    expect(state.needRefresh).toBe(false)
    expect(state.offlineReady).toBe(false)
    expect(state.updateServiceWorker).toBeNull()
  })

  it('setNeedRefresh toggles needRefresh', () => {
    usePwaStore.getState().setNeedRefresh(true)
    expect(usePwaStore.getState().needRefresh).toBe(true)
    usePwaStore.getState().setNeedRefresh(false)
    expect(usePwaStore.getState().needRefresh).toBe(false)
  })

  it('setOfflineReady sets offlineReady', () => {
    usePwaStore.getState().setOfflineReady(true)
    expect(usePwaStore.getState().offlineReady).toBe(true)
  })

  it('setUpdateServiceWorker stores the handle', () => {
    const updateSW = vi.fn(async () => {})
    usePwaStore.getState().setUpdateServiceWorker(updateSW)
    expect(usePwaStore.getState().updateServiceWorker).toBe(updateSW)
  })

  it('reset and _reset restore the initial state', () => {
    const { setNeedRefresh, setOfflineReady, setUpdateServiceWorker } = usePwaStore.getState()

    setNeedRefresh(true)
    setOfflineReady(true)
    setUpdateServiceWorker(vi.fn(async () => {}))
    usePwaStore.getState().reset()
    expect(usePwaStore.getState()).toMatchObject({ needRefresh: false, offlineReady: false, updateServiceWorker: null })

    setNeedRefresh(true)
    usePwaStore.getState()._reset()
    expect(usePwaStore.getState().needRefresh).toBe(false)
  })
})
