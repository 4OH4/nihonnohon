import { cn } from '@/lib/utils'
import { useAuthoringStore } from '@/stores/authoringStore'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
}

/** Grammar distribution hint text per 3-position slider value. */
const GRAMMAR_HINTS: Record<number, string> = {
  0: 'Fewer patterns — simpler sentence structures',
  1: 'Balanced variety',
  2: 'Maximum grammar variety',
}

/**
 * Sliding settings panel (right Sheet) for generation configuration.
 * In-scope: temperature slider, grammar distribution slider.
 * Stub (disabled): story length controls (M3 scope).
 */
export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const temperature = useAuthoringStore(s => s.temperature)
  const grammarDist  = useAuthoringStore(s => s.grammarDist)
  const setTemperature = useAuthoringStore(s => s.setTemperature)
  const setGrammarDist = useAuthoringStore(s => s.setGrammarDist)

  const handleTempRange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    if (!isNaN(v)) setTemperature(Math.min(2, Math.max(0, v)))
  }

  const handleTempNumber = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    if (!isNaN(v)) setTemperature(Math.min(2, Math.max(0, v)))
  }

  const handleGrammarDist = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10)
    if (v === 0 || v === 1 || v === 2) setGrammarDist(v)
  }

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-80 bg-surface border-l border-border">
        <SheetHeader>
          <SheetTitle className="text-paper-text">Generation Settings</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-8 px-1">
          {/* Temperature */}
          <section>
            <label className="block text-sm font-medium text-paper-text mb-3">
              Temperature
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={handleTempRange}
                aria-label="Temperature"
                className="flex-1 accent-accent"
              />
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={temperature.toFixed(1)}
                onChange={handleTempNumber}
                aria-label="Temperature value"
                className={cn(
                  'w-16 px-2 py-1 text-sm border border-border rounded text-paper-text bg-surface',
                  'focus-visible:ring-2 ring-accent outline-none',
                )}
              />
            </div>
          </section>

          {/* Grammar Distribution */}
          <section>
            <label className="block text-sm font-medium text-paper-text mb-3">
              Grammar Distribution
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="1"
              value={grammarDist}
              onChange={handleGrammarDist}
              aria-label="Grammar distribution"
              className="w-full accent-accent"
            />
            <p className="text-xs text-muted mt-2">
              {GRAMMAR_HINTS[grammarDist]}
            </p>
          </section>

          {/* Story Length — disabled stub (M3) */}
          <section aria-label="Story length settings">
            <label className="block text-sm font-medium text-paper-text mb-3">
              Story Length
            </label>
            <div className="opacity-[0.38] cursor-not-allowed space-y-2" aria-disabled="true">
              <div className="flex gap-2">
                {(['Short', 'Medium', 'Long', 'Custom'] as const).map(preset => (
                  <button
                    key={preset}
                    disabled
                    className="px-3 py-1 text-xs border border-border rounded bg-surface text-muted cursor-not-allowed"
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <input
                type="number"
                disabled
                placeholder="Word count"
                className="w-full px-2 py-1 text-sm border border-border rounded bg-surface text-muted cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-muted mt-2">
              Available in Generate from topic mode
            </p>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
