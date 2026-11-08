// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { describe, it, expect, afterEach, vi } from 'vitest'
import type { RegisterSWOptions } from 'vite-plugin-pwa/types'
import { registerServiceWorker } from '@/lib/pwa'
import { usePwaStore } from '@/stores/pwaStore'

// ─── mocks ───────────────────────────────────────────────────────────────────

const { registerSW, updateSW } = vi.hoisted(() => {
  const updateSW = vi.fn(async () => {})
  return { updateSW, registerSW: vi.fn((_options?: RegisterSWOptions) => updateSW) }
})
vi.mock('virtual:pwa-register', () => ({ registerSW }))

/** jsdom has no navigator.serviceWorker; give the guard something to find. */
function stubServiceWorkerSupport() {
  Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true })
}

const INITIAL_STATE = { needRefresh: false, offlineReady: false, updateServiceWorker: null }

afterEach(() => {
  vi.unstubAllEnvs()
  // Restore spies (console.warn) even when a test fails before its own cleanup.
  vi.restoreAllMocks()
  // mockReset drops any unconsumed mockImplementationOnce and restores the default implementation.
  registerSW.mockReset()
  updateSW.mockClear()
  usePwaStore.getState()._reset()
  Reflect.deleteProperty(navigator, 'serviceWorker')
})

// ─── tests ───────────────────────────────────────────────────────────────────

describe('registerServiceWorker', () => {
  it('is a no-op outside production builds', async () => {
    stubServiceWorkerSupport()
    expect(import.meta.env.PROD).toBe(false)

    await registerServiceWorker()

    expect(registerSW).not.toHaveBeenCalled()
    expect(usePwaStore.getState()).toMatchObject(INITIAL_STATE)
  })

  it('is a no-op when the browser has no service worker support', async () => {
    vi.stubEnv('PROD', true)

    await registerServiceWorker()

    expect(registerSW).not.toHaveBeenCalled()
    expect(usePwaStore.getState()).toMatchObject(INITIAL_STATE)
  })

  it('registers once in production and stores the update handle', async () => {
    vi.stubEnv('PROD', true)
    stubServiceWorkerSupport()

    await registerServiceWorker()

    expect(registerSW).toHaveBeenCalledTimes(1)
    // Default (non-immediate) registration: precaching waits for the load event.
    expect(registerSW.mock.calls[0]![0]).not.toHaveProperty('immediate', true)
    expect(usePwaStore.getState().updateServiceWorker).toBe(updateSW)
  })

  it('wires onNeedRefresh and onOfflineReady to the store', async () => {
    vi.stubEnv('PROD', true)
    stubServiceWorkerSupport()

    await registerServiceWorker()
    const options = registerSW.mock.calls[0]![0]!

    options.onNeedRefresh?.()
    expect(usePwaStore.getState().needRefresh).toBe(true)
    options.onOfflineReady?.()
    expect(usePwaStore.getState().offlineReady).toBe(true)
  })

  it('swallows a synchronous registration failure so the app runs without a service worker', async () => {
    vi.stubEnv('PROD', true)
    stubServiceWorkerSupport()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    registerSW.mockImplementationOnce(() => {
      throw new Error('boom')
    })

    await expect(registerServiceWorker()).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalled()
    expect(usePwaStore.getState().updateServiceWorker).toBeNull()
  })

  it('logs asynchronous registration failures reported through onRegisterError', async () => {
    vi.stubEnv('PROD', true)
    stubServiceWorkerSupport()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await registerServiceWorker()
    const error = new Error('register rejected')
    // vite-plugin-pwa reports workbox-window import and wb.register() failures here, after registerSW returns.
    registerSW.mock.calls[0]![0]!.onRegisterError?.(error)

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[pwa]'), error)
    expect(usePwaStore.getState()).toMatchObject({ needRefresh: false, offlineReady: false })
  })
})
