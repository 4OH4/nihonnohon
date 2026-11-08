// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { describe, it, expect, afterEach, vi } from 'vitest'
import type { RegisterSWOptions } from 'vite-plugin-pwa/types'
import {
  registerServiceWorker,
  initInstallPrompt,
  isStandalone,
  isIosDevice,
  canAddToHomeScreen,
} from '@/lib/pwa'
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

/** Cleanup returned by initInstallPrompt in the current test, run in afterEach. */
let removeInstallListeners: (() => void) | null = null

afterEach(() => {
  removeInstallListeners?.()
  removeInstallListeners = null
  vi.useRealTimers()
  vi.unstubAllEnvs()
  // Restore spies (console.warn) even when a test fails before its own cleanup.
  vi.restoreAllMocks()
  // mockReset drops any unconsumed mockImplementationOnce and restores the default implementation.
  registerSW.mockReset()
  updateSW.mockClear()
  usePwaStore.getState()._reset()
  Reflect.deleteProperty(navigator, 'serviceWorker')
  Reflect.deleteProperty(navigator, 'standalone')
  Reflect.deleteProperty(navigator, 'maxTouchPoints')
  Reflect.deleteProperty(window, 'matchMedia')
  Reflect.deleteProperty(document, 'visibilityState')
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

// ─── periodic update check ─────────────────────────────────────────────────

describe('periodic update check (onRegisteredSW)', () => {
  const HOUR = 60 * 60 * 1000

  /** A fresh registration per test, so a listener left by an earlier test can only call an old mock. */
  function fakeRegistration() {
    return {
      installing: null as object | null,
      update: vi.fn(async (): Promise<unknown> => undefined),
    }
  }

  /** Registers with fake timers and hands the registration to onRegisteredSW. */
  async function registerWith(registration: ReturnType<typeof fakeRegistration> | undefined) {
    vi.useFakeTimers()
    vi.stubEnv('PROD', true)
    stubServiceWorkerSupport()
    await registerServiceWorker()
    const options = registerSW.mock.calls[0]![0]!
    options.onRegisteredSW?.('/sw.js', registration as unknown as ServiceWorkerRegistration)
  }

  function setVisibility(state: DocumentVisibilityState) {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  }

  it('passes onRegisteredSW and keeps the other callbacks', async () => {
    vi.stubEnv('PROD', true)
    stubServiceWorkerSupport()
    await registerServiceWorker()
    const options = registerSW.mock.calls[0]![0]!
    expect(options.onRegisteredSW).toBeTypeOf('function')
    expect(options.onNeedRefresh).toBeTypeOf('function')
    expect(options.onOfflineReady).toBeTypeOf('function')
    expect(options.onRegisterError).toBeTypeOf('function')
  })

  it('checks for an update every 60 minutes', async () => {
    const registration = fakeRegistration()
    await registerWith(registration)

    await vi.advanceTimersByTimeAsync(HOUR - 1)
    expect(registration.update).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(registration.update).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(HOUR)
    expect(registration.update).toHaveBeenCalledTimes(2)
  })

  it('checks when the document becomes visible, but not within 60 seconds of the last check', async () => {
    const registration = fakeRegistration()
    await registerWith(registration)

    // Registration has just fetched sw.js, so an immediate refocus is too soon.
    setVisibility('visible')
    expect(registration.update).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(60 * 1000)
    setVisibility('visible')
    expect(registration.update).toHaveBeenCalledTimes(1)

    // A second refocus straight after the first is throttled.
    await vi.advanceTimersByTimeAsync(59 * 1000)
    setVisibility('visible')
    expect(registration.update).toHaveBeenCalledTimes(1)
  })

  it('does not check when the document becomes hidden', async () => {
    const registration = fakeRegistration()
    await registerWith(registration)
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000)

    setVisibility('hidden')
    expect(registration.update).not.toHaveBeenCalled()
  })

  it('skips the check while offline', async () => {
    const registration = fakeRegistration()
    await registerWith(registration)
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

    await vi.advanceTimersByTimeAsync(HOUR)
    expect(registration.update).not.toHaveBeenCalled()
  })

  it('skips the check while a worker is already installing', async () => {
    const registration = fakeRegistration()
    registration.installing = {}
    await registerWith(registration)

    await vi.advanceTimersByTimeAsync(HOUR)
    expect(registration.update).not.toHaveBeenCalled()
  })

  it('swallows a rejected update() and tries again next time', async () => {
    const registration = fakeRegistration()
    registration.update.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await registerWith(registration)

    await vi.advanceTimersByTimeAsync(HOUR)
    await vi.advanceTimersByTimeAsync(HOUR)
    expect(registration.update).toHaveBeenCalledTimes(2)
  })

  it('tolerates an undefined registration', async () => {
    await expect(registerWith(undefined)).resolves.toBeUndefined()
    await vi.advanceTimersByTimeAsync(HOUR)
  })
})

// ─── platform detection ──────────────────────────────────────────────────────

const UA = {
  iphoneSafari15:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
  iphoneChrome163:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/110.0.5481.83 Mobile/15E148 Safari/604.1',
  iphoneChrome164:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/112.0.5615.46 Mobile/15E148 Safari/604.1',
  iphoneFirefox17:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/118.0 Mobile/15E148 Safari/605.1.15',
  iphoneEdge15:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 EdgiOS/100.1185.50 Mobile/15E148 Safari/605.1.15',
  ipadChrome162:
    'Mozilla/5.0 (iPad; CPU OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/108.0.5359.112 Mobile/15E148 Safari/604.1',
  ipadDesktopSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15',
  ipadDesktopChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/119.0.6045.169 Safari/604.1',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
}

function stubUserAgent(ua: string, maxTouchPoints = 0) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua)
  // jsdom has no maxTouchPoints, so define it (removed in afterEach) rather than spy on it.
  Object.defineProperty(navigator, 'maxTouchPoints', { value: maxTouchPoints, configurable: true })
}

function stubMatchMedia(standalone: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({ matches: standalone && query === '(display-mode: standalone)' })),
  })
}

describe('isStandalone', () => {
  it('is false in a browser tab (jsdom has no matchMedia)', () => {
    expect(isStandalone()).toBe(false)
  })

  it('is true when display-mode is standalone', () => {
    stubMatchMedia(true)
    expect(isStandalone()).toBe(true)
  })

  it('is false when display-mode is not standalone', () => {
    stubMatchMedia(false)
    expect(isStandalone()).toBe(false)
  })

  it('is true when iOS reports navigator.standalone', () => {
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
    expect(isStandalone()).toBe(true)
  })
})

describe('isIosDevice', () => {
  it.each([
    ['iPhone', UA.iphoneSafari15, 5, true],
    ['iPad', UA.ipadChrome162, 5, true],
    ['iPadOS desktop mode (Macintosh with touch)', UA.ipadDesktopSafari, 5, true],
    ['macOS Safari (Macintosh without touch)', UA.macSafari, 0, false],
    ['Android', UA.androidChrome, 5, false],
  ])('%s → %s', (_label, ua, touch, expected) => {
    stubUserAgent(ua, touch)
    expect(isIosDevice()).toBe(expected)
  })
})

describe('canAddToHomeScreen', () => {
  it.each([
    ['iPhone Safari on iOS 15', UA.iphoneSafari15, 5, true],
    ['iPhone Chrome on iOS 16.3', UA.iphoneChrome163, 5, false],
    ['iPhone Chrome on iOS 16.4', UA.iphoneChrome164, 5, true],
    ['iPhone Firefox on iOS 17', UA.iphoneFirefox17, 5, true],
    ['iPhone Edge on iOS 15', UA.iphoneEdge15, 5, false],
    ['iPad Chrome on iPadOS 16.2', UA.ipadChrome162, 5, false],
    ['iPadOS desktop-mode Safari (no OS version)', UA.ipadDesktopSafari, 5, true],
    ['iPadOS desktop-mode Chrome (no OS version)', UA.ipadDesktopChrome, 5, true],
    ['macOS Safari', UA.macSafari, 0, false],
    ['Android Chrome (not iOS)', UA.androidChrome, 5, false],
  ])('%s → %s', (_label, ua, touch, expected) => {
    stubUserAgent(ua, touch)
    expect(canAddToHomeScreen()).toBe(expected)
  })
})

// ─── install capture ─────────────────────────────────────────────────────────

describe('initInstallPrompt', () => {
  function installEvent() {
    return Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: vi.fn(async () => {}),
      userChoice: Promise.resolve({ outcome: 'dismissed' as const, platform: '' }),
    })
  }

  it('records a browser tab on a non-iOS device as neither standalone nor iOS-installable', () => {
    stubUserAgent(UA.androidChrome, 5)
    removeInstallListeners = initInstallPrompt()
    expect(usePwaStore.getState()).toMatchObject({ standalone: false, iosInstallable: false })
  })

  it('records an iOS Safari tab as iOS-installable', () => {
    stubUserAgent(UA.iphoneSafari15, 5)
    removeInstallListeners = initInstallPrompt()
    expect(usePwaStore.getState()).toMatchObject({ standalone: false, iosInstallable: true })
  })

  it('records an iOS home-screen app as standalone and not iOS-installable', () => {
    stubUserAgent(UA.iphoneSafari15, 5)
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
    removeInstallListeners = initInstallPrompt()
    expect(usePwaStore.getState()).toMatchObject({ standalone: true, iosInstallable: false })
  })

  it('captures beforeinstallprompt, suppresses the mini-infobar and stores the event', () => {
    removeInstallListeners = initInstallPrompt()
    const event = installEvent()

    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(usePwaStore.getState().installPrompt).toBe(event)
  })

  it('clears the stored event on appinstalled', () => {
    removeInstallListeners = initInstallPrompt()
    window.dispatchEvent(installEvent())

    window.dispatchEvent(new Event('appinstalled'))

    expect(usePwaStore.getState().installPrompt).toBeNull()
  })

  it('returns a cleanup function that removes both listeners', () => {
    const cleanup = initInstallPrompt()
    cleanup()

    const event = installEvent()
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(usePwaStore.getState().installPrompt).toBeNull()

    // appinstalled no longer clears a prompt set some other way.
    const stored = installEvent()
    usePwaStore.getState().setInstallPrompt(stored)
    window.dispatchEvent(new Event('appinstalled'))
    expect(usePwaStore.getState().installPrompt).toBe(stored)
  })
})
