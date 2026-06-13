// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { useCallback, useRef } from 'react'

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
 */
export function useLongPress(
  callback: () => void,
  { delay = 500, moveThreshold = 10 }: LongPressOptions = {},
): LongPressHandlers {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const triggered = useRef(false)

  const clear = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
    start.current = null
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      triggered.current = false
      start.current = { x: e.clientX, y: e.clientY }
      timer.current = setTimeout(() => {
        triggered.current = true
        callback()
      }, delay)
    },
    [callback, delay],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (start.current === null) return
      const dx = e.clientX - start.current.x
      const dy = e.clientY - start.current.y
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

  return {
    onPointerDown,
    onPointerUp: clear,
    onPointerMove,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onClickCapture,
  }
}
