import { cn } from '@/lib/utils'
import { usePreferenceStore } from '@/stores/preferenceStore'
import { useShallow } from 'zustand/react/shallow'
import { SettingsMenu } from '@/components/SettingsMenu'

interface ToolBarProps {
  language: string
}

/** Reader toolbar with 3 interactive controls: ruby toggle, translation toggle, settings. */
export function ToolBar({ language }: ToolBarProps) {
  const { rubyVisible, transVisible, setRubyVisible, setTransVisible } = usePreferenceStore(
    useShallow((s) => ({
      rubyVisible: s.rubyVisible,
      transVisible: s.transVisible,
      setRubyVisible: s.setRubyVisible,
      setTransVisible: s.setTransVisible,
    }))
  )

  const rubyLabel = language === 'Japanese' ? 'ルビ' : 'Ruby'

  return (
    <div role="toolbar" aria-label="Reading controls" className="flex gap-2 px-4 py-2 bg-surface border-b border-border">
      <button
        type="button"
        aria-pressed={rubyVisible}
        onClick={() => setRubyVisible(!rubyVisible)}
        className={cn(
          'px-3 py-1 rounded text-sm font-ja border transition-colors',
          rubyVisible
            ? 'bg-accent-subtle border-accent text-paper-text'
            : 'bg-surface border-border text-muted',
        )}
      >
        {rubyLabel}
      </button>
      <button
        type="button"
        aria-pressed={transVisible}
        onClick={() => setTransVisible(!transVisible)}
        className={cn(
          'px-3 py-1 rounded text-sm border transition-colors',
          transVisible
            ? 'bg-accent-subtle border-accent text-paper-text'
            : 'bg-surface border-border text-muted',
        )}
      >
        Trans
      </button>
      <SettingsMenu />
    </div>
  )
}
