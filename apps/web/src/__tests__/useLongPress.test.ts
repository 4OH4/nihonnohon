// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useLongPress } from '@/lib/useLongPress'

/** Minimal pointer-event stand-in — only the fields the hook reads. */
function pointer(x: number, y: number, pointerType: 'touch' | 'mouse' = 'touch') {
  return { clientX: x, clientY: y, pointerType } as unknown as React.PointerEvent
}

function fireSelectStart(): boolean {
  const e = new Event('selectstart', { cancelable: true, bubbles: true })
  document.dispatchEvent(e)
  return e.defaultPrevented
}

function fireContextMenu(): boolean {
  const e = new Event('contextmenu', { cancelable: true, bubbles: true })
  document.dispatchEvent(e)
  return e.defaultPrevented
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useLongPress', () => {
  it('fires the callback after the delay when held still', () => {
    const cb = vi.fn()
    const { result } = renderHook(() => useLongPress(cb, { delay: 500 }))
    result.current.onPointerDown(pointer(0, 0))
    expect(cb).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('cancels when the pointer moves past the threshold (scroll / drag-select)', () => {
    const cb = vi.fn()
    const { result } = renderHook(() => useLongPress(cb, { delay: 500, moveThreshold: 10 }))
    result.current.onPointerDown(pointer(0, 0))
    result.current.onPointerMove(pointer(0, 40))
    vi.advanceTimersByTime(500)
    expect(cb).not.toHaveBeenCalled()
  })

  it('touch press: suppresses the context menu and blocks selection once fired', () => {
    const cb = vi.fn()
    const { result } = renderHook(() => useLongPress(cb))
    result.current.onPointerDown(pointer(0, 0, 'touch'))
    // Context menu is suppressed for the whole touch press...
    expect(fireContextMenu()).toBe(true)
    // ...but selection is only blocked after the long press actually fires.
    expect(fireSelectStart()).toBe(false)
    vi.advanceTimersByTime(500)
    expect(cb).toHaveBeenCalledTimes(1)
    expect(fireSelectStart()).toBe(true)
    // Release lifts both suppressions.
    result.current.onPointerUp()
    expect(fireSelectStart()).toBe(false)
    expect(fireContextMenu()).toBe(false)
  })

  it('mouse press: never touches selection or the context menu (desktop unaffected)', () => {
    const cb = vi.fn()
    const { result } = renderHook(() => useLongPress(cb))
    result.current.onPointerDown(pointer(0, 0, 'mouse'))
    vi.advanceTimersByTime(500)
    expect(cb).toHaveBeenCalledTimes(1)
    expect(fireSelectStart()).toBe(false)
    expect(fireContextMenu()).toBe(false)
    result.current.onPointerUp()
  })

  it('onClickCapture swallows the click only after a completed long press', () => {
    const cb = vi.fn()
    const { result } = renderHook(() => useLongPress(cb))
    const stop = vi.fn()
    const click = { stopPropagation: stop } as unknown as React.MouseEvent

    // No long press yet → click passes through.
    result.current.onClickCapture(click)
    expect(stop).not.toHaveBeenCalled()

    // After a fired long press → the trailing click is swallowed once.
    result.current.onPointerDown(pointer(0, 0, 'mouse'))
    vi.advanceTimersByTime(500)
    result.current.onClickCapture(click)
    expect(stop).toHaveBeenCalledTimes(1)
  })
})
