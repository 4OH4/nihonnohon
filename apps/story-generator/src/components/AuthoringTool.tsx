import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useAgUiRun } from '@/hooks/useAgUiRun'
import { BackendStatus } from './BackendStatus'
import { GenerationProgress } from './GenerationProgress'
import { InputPanel } from './InputPanel'
import { ModeToggle } from './ModeToggle'
import { SettingsPanel } from './SettingsPanel'

/** Root layout component for the Story Authoring Tool.
 *
 * Mounts the SSE lifecycle hook once so it is active for all child components.
 */
export function AuthoringTool() {
  useAgUiRun()

  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border">
        <div className="max-w-[860px] mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-paper-text">
            nihonnohon Story Authoring Tool
          </h1>
          <div className="flex items-center gap-4">
            <BackendStatus />
            <button
              onClick={() => setSettingsOpen(true)}
              aria-label="Open settings"
              className={cn(
                'p-2 rounded-md text-muted hover:text-paper-text hover:bg-surface-subtle',
                'focus-visible:ring-2 ring-accent outline-none transition-colors',
              )}
            >
              <span aria-hidden="true">⚙</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[860px] mx-auto px-4 py-8">
        <div className="mb-6">
          <ModeToggle />
        </div>
        <InputPanel />
        <GenerationProgress />
        {/* Story 2.7: OutputPanel */}
      </main>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
