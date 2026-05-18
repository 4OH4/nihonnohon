import { cn } from '@/lib/utils'
import { useAuthoringStore, STORY_LENGTH_WORD_COUNTS, MAX_TARGET_WORD_COUNT } from '@/stores/authoringStore'
import type { StoryLengthPreset } from '@/stores/authoringStore'
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
  0: 'Fewer patterns - simpler sentence structures',
  1: 'Balanced variety',
  2: 'Maximum grammar variety',
}

const LENGTH_PRESETS: StoryLengthPreset[] = ['short', 'medium', 'long', 'custom']

const PRESET_LABELS: Record<StoryLengthPreset, string> = {
  short: 'Short',
  medium: 'Medium',
  long: 'Long',
  custom: 'Custom',
}

/**
 * Sliding settings panel (right Sheet) for generation configuration.
 * Controls: temperature, grammar distribution, story length (Path B only).
 */
export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const temperature          = useAuthoringStore(s => s.temperature)
  const grammarDist          = useAuthoringStore(s => s.grammarDist)
  const pathMode             = useAuthoringStore(s => s.pathMode)
  const storyLengthPreset    = useAuthoringStore(s => s.storyLengthPreset)
  const targetWordCount      = useAuthoringStore(s => s.targetWordCount)
  const setTemperature       = useAuthoringStore(s => s.setTemperature)
  const setGrammarDist       = useAuthoringStore(s => s.setGrammarDist)
  const setStoryLengthPreset = useAuthoringStore(s => s.setStoryLengthPreset)
  const setTargetWordCount   = useAuthoringStore(s => s.setTargetWordCount)

  const lengthEnabled = pathMode === 'B'

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

          {/* Story Length — active in Path B (Generate from topic) */}
          <section aria-label="Story length settings">
            <label
              className={cn(
                'block text-sm font-medium mb-3',
                lengthEnabled ? 'text-paper-text' : 'text-muted',
              )}
            >
              Story Length
            </label>
            <div
              className={cn(
                'space-y-2',
                !lengthEnabled && 'opacity-[0.38] cursor-not-allowed',
              )}
              aria-disabled={!lengthEnabled}
            >
              <div className="flex gap-2">
                {LENGTH_PRESETS.map(preset => (
                  <button
                    key={preset}
                    disabled={!lengthEnabled}
                    onClick={() => setStoryLengthPreset(preset)}
                    className={cn(
                      'px-3 py-1 text-xs border rounded',
                      lengthEnabled ? 'cursor-pointer' : 'cursor-not-allowed',
                      storyLengthPreset === preset && lengthEnabled
                        ? 'border-accent bg-accent text-white'
                        : 'border-border bg-surface text-muted',
                    )}
                  >
                    {PRESET_LABELS[preset]}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                max={MAX_TARGET_WORD_COUNT}
                disabled={!lengthEnabled || storyLengthPreset !== 'custom'}
                value={targetWordCount}
                onChange={e => {
                  const v = parseInt(e.target.value, 10)
                  if (!isNaN(v) && v > 0) setTargetWordCount(v)
                }}
                placeholder="Word count"
                className={cn(
                  'w-full px-2 py-1 text-sm border border-border rounded bg-surface',
                  lengthEnabled && storyLengthPreset === 'custom'
                    ? 'text-paper-text focus-visible:ring-2 ring-accent outline-none'
                    : 'text-muted cursor-not-allowed',
                )}
              />
            </div>
            {!lengthEnabled && (
              <p className="text-xs text-muted mt-2">
                Available in Generate from topic mode
              </p>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
