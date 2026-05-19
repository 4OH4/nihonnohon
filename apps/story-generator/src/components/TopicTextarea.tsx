import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useAuthoringStore } from '@/stores/authoringStore'

interface TopicTextareaProps {
  /** Show error border when pre-flight validation fires for empty topic. */
  hint?: boolean
  disabled?: boolean
  /** Notify InputPanel when the SuggestConfirm strip opens/closes (to disable Generate). */
  onConfirmOpen?: (open: boolean) => void
}

/**
 * Path B topic input with an overlay "Suggest a topic" / "Replace topic" button.
 * Manages suggest-topic UI state locally — debounce, loading spinner, SuggestConfirm strip.
 */
export function TopicTextarea({ hint = false, disabled = false, onConfirmOpen }: TopicTextareaProps) {
  const topicText          = useAuthoringStore(s => s.topicText)
  const chapterTarget      = useAuthoringStore(s => s.chapterTarget)
  const sessionRestored    = useAuthoringStore(s => s.sessionRestored)
  const setTopicText       = useAuthoringStore(s => s.setTopicText)
  const _setSessionRestored = useAuthoringStore(s => s._setSessionRestored)

  const [isSuggesting, setIsSuggesting] = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)
  const [toastText, setToastText]       = useState<string | null>(null)

  const confirmRef   = useRef<HTMLButtonElement>(null)
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Focus [Yes, replace] when confirm strip appears
  useEffect(() => {
    if (showConfirm) confirmRef.current?.focus()
  }, [showConfirm])

  // Escape dismisses confirm strip
  useEffect(() => {
    if (!showConfirm) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissConfirm()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showConfirm]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  const dismissConfirm = () => {
    setShowConfirm(false)
    onConfirmOpen?.(false)
  }

  const showToast = (msg: string) => {
    setToastText(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToastText(null), 4000)
  }

  const doSuggest = async () => {
    if (isSuggesting) return
    setIsSuggesting(true)
    try {
      const res = await fetch('/suggest-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapter: chapterTarget }),
      })
      if (!res.ok) throw new Error('Request failed')
      const data = await res.json() as { topic: string }
      setTopicText(data.topic)
    } catch {
      showToast('Could not fetch suggestion')
    } finally {
      setIsSuggesting(false)
    }
  }

  const handleSuggestClick = () => {
    if (isSuggesting) return
    // 300ms debounce: ignore rapid re-clicks within the window
    if (debounceRef.current) return
    debounceRef.current = setTimeout(() => { debounceRef.current = null }, 300)

    if (topicText) {
      setShowConfirm(true)
      onConfirmOpen?.(true)
    } else {
      void doSuggest()
    }
  }

  const handleConfirmReplace = () => {
    dismissConfirm()
    void doSuggest()
  }

  return (
    <div>
      <label htmlFor="topic-input" className="block text-sm font-medium text-paper-text mb-1">
        Topic
      </label>

      {/* Relative wrapper for the overlay button (UX-DR8) */}
      <div className="relative">
        <textarea
          id="topic-input"
          value={topicText}
          onChange={e => {
            setTopicText(e.target.value)
            if (sessionRestored) _setSessionRestored(false)
          }}
          placeholder="Describe the topic or setting for your story…"
          disabled={disabled}
          rows={4}
          className={cn(
            'w-full resize-none px-3 py-2 pb-10 text-sm border rounded-md',
            'bg-surface-subtle text-paper-text',
            'focus-visible:ring-2 ring-accent outline-none transition-colors',
            hint ? 'border-error' : 'border-border',
            disabled && 'opacity-[0.45] cursor-not-allowed',
          )}
        />

        {/* Overlay suggest button — disabled when no chapter selected (backend needs it for calibration) */}
        <button
          type="button"
          aria-busy={isSuggesting}
          disabled={isSuggesting || disabled || !chapterTarget}
          onClick={handleSuggestClick}
          style={{ pointerEvents: isSuggesting || disabled || !chapterTarget ? 'none' : 'auto' }}
          className={cn(
            'absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 text-xs rounded border',
            'transition-colors focus-visible:ring-2 ring-accent outline-none',
            isSuggesting && 'opacity-[0.45]',
            topicText && !isSuggesting
              ? 'border-accent text-accent hover:bg-accent/10'
              : 'border-border text-muted hover:text-paper-text',
          )}
        >
          {isSuggesting
            ? <span aria-label="Loading…" className="inline-block animate-spin">⟳</span>
            : topicText ? 'Replace topic' : '✦ Suggest a topic'
          }
        </button>
      </div>

      {hint && (
        <p className="text-xs text-error mt-1">Enter a topic before generating.</p>
      )}

      {/* SuggestConfirm strip — inline below textarea (UX-DR9) */}
      {showConfirm && (
        <div
          role="alert"
          className={cn(
            'mt-2 flex items-center gap-2 flex-wrap',
            'rounded-md border border-accent bg-accent-subtle px-3 py-2 text-sm',
          )}
        >
          <span className="flex-1 text-paper-text">Replace your current topic with a suggested one?</span>
          <button
            ref={confirmRef}
            type="button"
            onClick={handleConfirmReplace}
            className={cn(
              'font-medium text-accent hover:text-accent/80',
              'focus-visible:ring-2 ring-accent outline-none rounded',
            )}
          >
            Yes, replace
          </button>
          <button
            type="button"
            onClick={dismissConfirm}
            className={cn(
              'text-muted hover:text-paper-text',
              'focus-visible:ring-2 ring-accent outline-none rounded',
            )}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Error toast — same pattern as OutputPanel download toast */}
      {toastText && (
        <div
          role="status"
          aria-live="polite"
          className="mt-2 rounded-md bg-surface border border-border px-3 py-2 text-sm text-paper-text shadow-sm"
        >
          {toastText}
        </div>
      )}
    </div>
  )
}
