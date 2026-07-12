// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

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

/** Settings popover containing the reading toggles and text size controls. */
export function SettingsMenu() {
  const {
    spacingVisible, rubyVisible, transVisible, textSize,
    setSpacingVisible, setRubyVisible, setTransVisible, setTextSize,
  } = usePreferenceStore(
    useShallow(s => ({
      spacingVisible: s.spacingVisible,
      rubyVisible: s.rubyVisible,
      transVisible: s.transVisible,
      textSize: s.textSize,
      setSpacingVisible: s.setSpacingVisible,
      setRubyVisible: s.setRubyVisible,
      setTransVisible: s.setTransVisible,
      setTextSize: s.setTextSize,
    }))
  )

  const toggles = [
    { label: 'Spaces', value: spacingVisible, set: setSpacingVisible },
    { label: 'Ruby', value: rubyVisible, set: setRubyVisible },
    { label: 'Trans.', value: transVisible, set: setTransVisible },
  ]

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Settings"
          // py-1.5 keeps the (larger) icon within the AppBar's min-h-12 height
          className="px-3 py-1.5 rounded text-lg text-muted"
        >
          ⚙
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="bg-surface border border-border rounded shadow-md p-3 flex flex-col gap-3 z-50 min-w-[160px]"
          sideOffset={5}
        >
          {/* On/off reading toggles */}
          {toggles.map(({ label, value, set }) => (
            <div key={label} className="flex items-center justify-between gap-4">
              <span className="text-sm text-paper-text">{label}</span>
              <button
                type="button"
                aria-label={label}
                aria-pressed={value}
                onClick={() => set(!value)}
                className={cn(
                  'px-3 py-1 rounded text-sm border',
                  value
                    ? 'bg-accent-subtle border-accent text-paper-text'
                    : 'bg-surface border-border text-muted',
                )}
              >
                {value ? 'On' : 'Off'}
              </button>
            </div>
          ))}

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
