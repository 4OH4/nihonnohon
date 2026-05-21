// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useRef, useState } from 'react'

/** Backend health states. */
export type BackendStatusState = 'checking' | 'connected' | 'unavailable'

/** Poll /health and return the current backend connection state.
 *
 * Re-checks every 60 s when connected, every 10 s when unavailable.
 * Performs an immediate check on mount.
 */
export function useBackendStatus(): BackendStatusState {
  const [status, setStatus] = useState<BackendStatusState>('checking')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const check = useCallback(async () => {
    try {
      const res = await fetch('/health', { signal: AbortSignal.timeout(5_000) })
      setStatus(res.ok ? 'connected' : 'unavailable')
    } catch {
      setStatus('unavailable')
    }
  }, [])

  // Initial check on mount only
  useEffect(() => {
    void check()
  }, [check])

  // Reschedule interval whenever status changes
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    const interval = status === 'connected' ? 60_000 : 10_000
    intervalRef.current = setInterval(() => void check(), interval)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [status, check])

  return status
}
