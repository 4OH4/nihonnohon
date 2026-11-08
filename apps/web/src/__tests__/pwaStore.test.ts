// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { describe, it, expect, afterEach, vi } from 'vitest'
import { usePwaStore, selectInstallOption, type BeforeInstallPromptEvent } from '@/stores/pwaStore'

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

  it('reset clears the flags but keeps the update handle', () => {
    const { setNeedRefresh, setOfflineReady, setUpdateServiceWorker } = usePwaStore.getState()
    const updateSW = vi.fn(async () => {})

    setNeedRefresh(true)
    setOfflineReady(true)
    setUpdateServiceWorker(updateSW)
    usePwaStore.getState().reset()

    expect(usePwaStore.getState()).toMatchObject({ needRefresh: false, offlineReady: false, updateServiceWorker: updateSW })
  })

  it('_reset restores the full initial state, including the update handle', () => {
    const { setNeedRefresh, setOfflineReady, setUpdateServiceWorker } = usePwaStore.getState()

    setNeedRefresh(true)
    setOfflineReady(true)
    setUpdateServiceWorker(vi.fn(async () => {}))
    usePwaStore.getState()._reset()

    expect(usePwaStore.getState()).toMatchObject({ needRefresh: false, offlineReady: false, updateServiceWorker: null })
  })

  // ─── se4-3: update dismiss and install state ───────────────────────────────

  it('starts with the update not dismissed, no install prompt, not standalone and not iOS-installable', () => {
    expect(usePwaStore.getState()).toMatchObject({
      updateDismissed: false,
      installPrompt: null,
      standalone: false,
      iosInstallable: false,
    })
  })

  it('dismissUpdate sets updateDismissed without clearing needRefresh', () => {
    usePwaStore.getState().setNeedRefresh(true)
    usePwaStore.getState().dismissUpdate()
    expect(usePwaStore.getState()).toMatchObject({ needRefresh: true, updateDismissed: true })
  })

  it('setNeedRefresh(true) clears updateDismissed so a newer worker shows the toast again', () => {
    usePwaStore.getState().setNeedRefresh(true)
    usePwaStore.getState().dismissUpdate()
    usePwaStore.getState().setNeedRefresh(true)
    expect(usePwaStore.getState().updateDismissed).toBe(false)
  })

  it('setNeedRefresh(false) leaves updateDismissed alone', () => {
    usePwaStore.getState().dismissUpdate()
    usePwaStore.getState().setNeedRefresh(false)
    expect(usePwaStore.getState()).toMatchObject({ needRefresh: false, updateDismissed: true })
  })

  it('setInstallPrompt stores and clears the deferred event', () => {
    const event = fakeInstallEvent()
    usePwaStore.getState().setInstallPrompt(event)
    expect(usePwaStore.getState().installPrompt).toBe(event)
    usePwaStore.getState().setInstallPrompt(null)
    expect(usePwaStore.getState().installPrompt).toBeNull()
  })

  it('setInstallContext records standalone and iosInstallable', () => {
    usePwaStore.getState().setInstallContext({ standalone: true, iosInstallable: false })
    expect(usePwaStore.getState()).toMatchObject({ standalone: true, iosInstallable: false })
    usePwaStore.getState().setInstallContext({ standalone: false, iosInstallable: true })
    expect(usePwaStore.getState()).toMatchObject({ standalone: false, iosInstallable: true })
  })

  it('reset clears updateDismissed but keeps the install fields', () => {
    const event = fakeInstallEvent()
    const s = usePwaStore.getState()
    s.dismissUpdate()
    s.setInstallPrompt(event)
    s.setInstallContext({ standalone: true, iosInstallable: true })
    usePwaStore.getState().reset()

    expect(usePwaStore.getState()).toMatchObject({
      updateDismissed: false,
      installPrompt: event,
      standalone: true,
      iosInstallable: true,
    })
  })

  it('_reset restores the install fields and updateDismissed', () => {
    const s = usePwaStore.getState()
    s.dismissUpdate()
    s.setInstallPrompt(fakeInstallEvent())
    s.setInstallContext({ standalone: true, iosInstallable: true })
    usePwaStore.getState()._reset()

    expect(usePwaStore.getState()).toMatchObject({
      updateDismissed: false,
      installPrompt: null,
      standalone: false,
      iosInstallable: false,
    })
  })
})

describe('selectInstallOption', () => {
  const base = usePwaStore.getState()

  it.each([
    { standalone: false, prompt: false, ios: false, expected: null },
    { standalone: false, prompt: true, ios: false, expected: 'prompt' },
    { standalone: false, prompt: false, ios: true, expected: 'ios' },
    // A deferred install event wins over the iOS instruction.
    { standalone: false, prompt: true, ios: true, expected: 'prompt' },
    // Installed: nothing, whatever else is set.
    { standalone: true, prompt: true, ios: true, expected: null },
    { standalone: true, prompt: false, ios: true, expected: null },
    { standalone: true, prompt: true, ios: false, expected: null },
  ])('standalone=$standalone prompt=$prompt ios=$ios → $expected', ({ standalone, prompt, ios, expected }) => {
    const state = {
      ...base,
      standalone,
      iosInstallable: ios,
      installPrompt: prompt ? fakeInstallEvent() : null,
    }
    expect(selectInstallOption(state)).toBe(expected)
  })
})

/** A stand-in for Chromium's BeforeInstallPromptEvent. */
function fakeInstallEvent(): BeforeInstallPromptEvent {
  return Object.assign(new Event('beforeinstallprompt'), {
    prompt: vi.fn(async () => {}),
    userChoice: Promise.resolve({ outcome: 'dismissed' as const, platform: '' }),
  })
}
