import * as Popover from '@radix-ui/react-popover'
import { cn } from '@/lib/utils'
import { usePreferenceStore } from '@/stores/preferenceStore'
import { useShallow } from 'zustand/react/shallow'
import { TEXT_SIZE_VALUES } from '@/utils/textSize'

const SIZE_CONFIG = [
  { size: 'small', label: 'A−', ariaLabel: 'Smaller text' },
  { size: 'medium', label: 'A', ariaLabel: 'Medium text (reset)' },
  { size: 'large', label: 'A+', ariaLabel: 'Larger text' },
] as const

/** Settings popover containing spacing toggle and text size controls. */
export function SettingsMenu() {
  const { spacingVisible, textSize, setSpacingVisible, setTextSize } = usePreferenceStore(
    useShallow(s => ({
      spacingVisible: s.spacingVisible,
      textSize: s.textSize,
      setSpacingVisible: s.setSpacingVisible,
      setTextSize: s.setTextSize,
    }))
  )

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Settings"
          className="px-3 py-2 rounded text-base text-muted"
        >
          ⚙
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="bg-surface border border-border rounded shadow-md p-3 flex flex-col gap-3 z-50 min-w-[160px]"
          sideOffset={5}
        >
          {/* Spaces toggle */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-paper-text">Spaces</span>
            <button
              type="button"
              aria-pressed={spacingVisible}
              onClick={() => setSpacingVisible(!spacingVisible)}
              className={cn(
                'px-3 py-1 rounded text-sm border',
                spacingVisible
                  ? 'bg-accent-subtle border-accent text-paper-text'
                  : 'bg-surface border-border text-muted',
              )}
            >
              {spacingVisible ? 'On' : 'Off'}
            </button>
          </div>

          {/* Text size controls */}
          <div className="flex items-center gap-1">
            {SIZE_CONFIG.map(({ size, label, ariaLabel }) => (
              <button
                key={size}
                type="button"
                aria-label={ariaLabel}
                aria-pressed={textSize === size}
                onClick={() => setTextSize(size)}
                className={cn(
                  'px-2 py-1 rounded text-sm border flex-1',
                  textSize === size
                    ? 'bg-accent-subtle border-accent text-paper-text'
                    : 'bg-surface border-border text-muted',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
