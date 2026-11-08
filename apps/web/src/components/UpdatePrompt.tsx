// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { usePwaStore } from '@/stores/pwaStore'

/** Non-modal "New version available" toast (FR47). Never reloads on its own; the reader chooses. */
export function UpdatePrompt() {
  const { needRefresh, updateDismissed, dismissUpdate } = usePwaStore(
    useShallow((s) => ({
      needRefresh: s.needRefresh,
      updateDismissed: s.updateDismissed,
      dismissUpdate: s.dismissUpdate,
    })),
  )
  const [reloading, setReloading] = useState(false)
  const visible = needRefresh && !updateDismissed

  // The component never unmounts, so re-enable Reload when the toast hides (a newer worker re-shows it).
  useEffect(() => {
    if (!visible) setReloading(false)
  }, [visible])

  const reload = () => {
    setReloading(true)
    const update = usePwaStore.getState().updateServiceWorker
    // vite-plugin-pwa reloads the page once the new service worker takes control.
    if (update) update().catch(() => window.location.reload())
    else window.location.reload()
  }

  return (
    // Positioning layer: full width but click-through, so story text beside the toast stays tappable.
    // bottom-16 clears the reader's ~45px mobile tab bar; lg+ has no tab bar.
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-40 flex justify-center px-4 lg:bottom-6">
      {/* Live region stays mounted so the message is announced when it appears. */}
      <div role="status" aria-live="polite">
        {visible && (
          <div className="pointer-events-auto flex flex-wrap items-center gap-3 rounded border border-border bg-surface px-4 py-2 text-sm text-paper-text shadow-md">
            <span>New version available</span>
            <button
              type="button"
              onClick={reload}
              disabled={reloading}
              className="rounded border border-accent bg-accent px-3 py-1 text-paper-text disabled:opacity-60"
            >
              Reload
            </button>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={dismissUpdate}
              className="rounded px-2 py-1 text-muted hover:text-paper-text"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
