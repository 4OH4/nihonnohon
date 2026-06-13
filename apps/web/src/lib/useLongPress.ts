// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useRef } from 'react'

interface LongPressOptions {
  /** Hold duration in ms before the press is treated as "long". */
  delay?: number
  /** Pointer travel in px that cancels the press (so scrolling never triggers it). */
  moveThreshold?: number
}

/** Pointer-event handlers wiring up the long press; spread onto the target element. */
export interface LongPressHandlers {
  onPointerDown: (e: React.PointerEvent) => void
  onPointerUp: () => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerLeave: () => void
  onPointerCancel: () => void
  onClickCapture: (e: React.MouseEvent) => void
}

/**
 * Fires `callback` when the pointer is held still on the element for `delay` ms.
 * Cancels on release, leave, pointer-cancel, or movement past `moveThreshold`,
 * and swallows the trailing click so a completed long press does not also fire
 * the element's `onClick`.
 *
 * For touch presses only, it also tames the browser's native long-press
 * behaviour: the context-menu/callout is suppressed for the duration of the
 * press, and once the long press fires any stray text selection is cleared and
 * further selection blocked until release. The mouse path is left untouched, so
 * desktop text selection keeps working exactly as before.
 */
export function useLongPress(
  callback: () => void,
  { delay = 500, moveThreshold = 10 }: LongPressOptions = {},
): LongPressHandlers {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const triggered = useRef(false)
  const touchActive = useRef(false)

  // Stable handlers so add/removeEventListener pair up. Attached only while a
  // touch press is in flight, so they can preventDefault unconditionally.
  const preventDefault = useRef((e: Event) => e.preventDefault()).current

  const clear = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
    start.current = null
    if (touchActive.current) {
      touchActive.current = false
      document.removeEventListener('contextmenu', preventDefault, true)
      document.removeEventListener('selectstart', preventDefault, true)
    }
  }, [preventDefault])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      triggered.current = false
      start.current = { x: e.clientX, y: e.clientY }
      if (e.pointerType === 'touch') {
        touchActive.current = true
        // Kill the Android long-press context menu for the whole press.
        document.addEventListener('contextmenu', preventDefault, true)
      }
      timer.current = setTimeout(() => {
        triggered.current = true
        if (touchActive.current) {
          // Block any further selection while the finger stays down, then drop
          // the selection the browser may have made during the hold.
          document.addEventListener('selectstart', preventDefault, true)
          window.getSelection()?.removeAllRanges()
        }
        callback()
      }, delay)
    },
    [callback, delay, preventDefault],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (start.current === null) return
      const dx = e.clientX - start.current.x
      const dy = e.clientY - start.current.y
      // Movement means a scroll or a deliberate drag-select — bail out and let
      // the browser handle selection normally.
      if (Math.hypot(dx, dy) > moveThreshold) clear()
    },
    [clear, moveThreshold],
  )

  // Suppress the click emitted after a completed long press so the element's
  // own onClick (e.g. sentence-select) does not immediately undo it.
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (triggered.current) {
      e.stopPropagation()
      triggered.current = false
    }
  }, [])

  // Detach any lingering listeners if we unmount mid-press.
  useEffect(() => clear, [clear])

  return {
    onPointerDown,
    onPointerUp: clear,
    onPointerMove,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onClickCapture,
  }
}
