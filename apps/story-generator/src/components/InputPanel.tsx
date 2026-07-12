// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useAuthoringStore, selectCanGenerate } from '@/stores/authoringStore'
import { useBackendStatus } from '@/hooks/useBackendStatus'
import { ScopeChip, CHAPTER_SCOPE } from './ScopeChip'
import { TopicTextarea } from './TopicTextarea'

/** Ordered chapter options derived from the scope data — single source of truth. */
const CHAPTER_OPTIONS = Object.keys(CHAPTER_SCOPE)

interface ValidationHints {
  story: boolean
  chapter: boolean
  topic: boolean
}

/**
 * Input section — English story textarea, chapter selector, ScopeChip, optional steering
 * instructions collapsible, and a phase-aware Generate/Stop button.
 *
 * Collapses to a summary row during generation; re-expands automatically on idle/error.
 * "Edit inputs" ghost button allows manual re-expansion while generating.
 */
export function InputPanel() {
  const inputText               = useAuthoringStore(s => s.inputText)
  const topicText               = useAuthoringStore(s => s.topicText)
  const chapterTarget           = useAuthoringStore(s => s.chapterTarget)
  const steeringInstructions    = useAuthoringStore(s => s.steeringInstructions)
  const pathMode                = useAuthoringStore(s => s.pathMode)
  const phase                   = useAuthoringStore(s => s.phase)
  const storedInputs            = useAuthoringStore(s => s.storedInputs)
  const sessionRestored         = useAuthoringStore(s => s.sessionRestored)
  const setInputText            = useAuthoringStore(s => s.setInputText)
  const setChapterTarget        = useAuthoringStore(s => s.setChapterTarget)
  const setSteeringInstructions = useAuthoringStore(s => s.setSteeringInstructions)
  const _setSessionRestored     = useAuthoringStore(s => s._setSessionRestored)
  const generate                = useAuthoringStore(s => s.generate)
  const cancel                  = useAuthoringStore(s => s.cancel)
  const clear                   = useAuthoringStore(s => s.clear)
  const canGenerate             = useAuthoringStore(selectCanGenerate)
  const backendStatus           = useBackendStatus()

  const [steeringOpen, setSteeringOpen] = useState(false)
  const [hints, setHints] = useState<ValidationHints>({ story: false, chapter: false, topic: false })
  const [manualExpanded, setManualExpanded] = useState(false)
  // Tracks whether TopicTextarea's SuggestConfirm strip is open (to disable Generate)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const steeringToggleRef = useRef<HTMLButtonElement>(null)

  // Collapse during generation, cancellation, and proposal review
  const isCollapsedPhase = phase === 'generating' || phase === 'cancelling' || phase === 'proposal'
  const isCollapsed = isCollapsedPhase && !manualExpanded

  // Reset confirm-open gate when leaving Path B so Generate button never stays disabled after mode switch
  useEffect(() => {
    if (pathMode !== 'B') setIsConfirmOpen(false)
  }, [pathMode])

  // Auto-reset manual expansion when leaving collapsed phases
  useEffect(() => {
    if (!isCollapsedPhase) setManualExpanded(false)
  }, [isCollapsedPhase])

  const handleInputChange = (v: string) => {
    setInputText(v)
    if (hints.story && v.trim() !== '') setHints(h => ({ ...h, story: false }))
    if (sessionRestored) _setSessionRestored(false)
  }

  const handleChapterChange = (v: string) => {
    setChapterTarget(v)
    if (hints.chapter && v !== '') setHints(h => ({ ...h, chapter: false }))
    if (sessionRestored) _setSessionRestored(false)
  }

  const handleGenerate = () => {
    if (pathMode === 'B') {
      const missingTopic   = topicText.trim() === ''
      const missingChapter = chapterTarget === ''
      if (missingTopic || missingChapter) {
        setHints({ story: false, chapter: missingChapter, topic: missingTopic })
        return
      }
    } else {
      const missingStory   = inputText.trim() === ''
      const missingChapter = chapterTarget === ''
      if (missingStory || missingChapter) {
        setHints({ story: missingStory, chapter: missingChapter, topic: false })
        return
      }
    }
    setHints({ story: false, chapter: false, topic: false })
    generate()
  }

  const isGenerateDisabled = !canGenerate || backendStatus === 'unavailable' || isConfirmOpen

  return (
    <section aria-label="Story inputs" className="space-y-3">

      {/* Session restore banner — shown above all other content after session hydration */}
      {sessionRestored && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm">
          <span className="text-muted">Restored from previous session</span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={clear}
            className={cn(
              'text-accent hover:text-accent/80',
              'focus-visible:ring-2 ring-accent outline-none rounded',
            )}
          >
            Clear
          </button>
        </div>
      )}

      {/* Collapsed summary row */}
      {isCollapsed && (
        <div className="flex items-center gap-3 py-1 text-sm flex-wrap">
          <span className="text-muted shrink-0">
            {storedInputs?.pathMode === 'B'
              ? 'Generate from topic'
              : storedInputs?.pathMode === 'C'
                ? 'Japanese story'
                : 'Convert a story'}
          </span>
          {storedInputs?.chapterTarget && (
            <span className="text-muted shrink-0">
              · {storedInputs.chapterTarget === 'unspecified' ? 'Unspecified' : storedInputs.chapterTarget}
            </span>
          )}
          {/* Path B shows topic; Path A shows inputText */}
          {storedInputs?.pathMode === 'B' ? (
            storedInputs?.topicText && (
              <span className="text-paper-text truncate flex-1 min-w-0">
                {storedInputs.topicText.length > 60
                  ? storedInputs.topicText.slice(0, 60) + '…'
                  : storedInputs.topicText}
              </span>
            )
          ) : (
            storedInputs?.inputText && (
              <span
                className={cn(
                  'text-paper-text truncate flex-1 min-w-0',
                  storedInputs?.pathMode === 'C' && 'font-ja',
                )}
              >
                {storedInputs.inputText.length > 60
                  ? storedInputs.inputText.slice(0, 60) + '…'
                  : storedInputs.inputText}
              </span>
            )
          )}
          <button
            type="button"
            onClick={() => setManualExpanded(true)}
            className={cn(
              'text-accent text-sm hover:text-accent/80 shrink-0',
              'focus-visible:ring-2 ring-accent outline-none rounded',
            )}
          >
            Edit inputs
          </button>
        </div>
      )}

      {/* Full form — hidden when collapsed */}
      {!isCollapsed && (
        <>
          {/* Input branch: Path A → English textarea, Path C → Japanese (font-ja) textarea,
              Path B → TopicTextarea. A and C share the inputText binding; only the label,
              placeholder, and font differ. */}
          {pathMode === 'A' ? (
            <div>
              <label
                htmlFor="input-text"
                className="block text-sm font-medium text-paper-text mb-1"
              >
                English story
              </label>
              <textarea
                id="input-text"
                value={inputText}
                onChange={e => handleInputChange(e.target.value)}
                placeholder="Paste your English story here…"
                className={cn(
                  'w-full min-h-[200px] max-h-[400px] overflow-y-auto resize-none',
                  'px-3 py-2 text-sm border rounded-md bg-surface-subtle text-paper-text',
                  'focus-visible:ring-2 ring-accent outline-none transition-colors',
                  hints.story ? 'border-error' : 'border-border',
                )}
              />
              {hints.story && (
                <p className="text-xs text-error mt-1">
                  Enter your English story before generating.
                </p>
              )}
              <p className="text-xs text-muted mt-1">
                English source material must be original or appropriately licensed.
              </p>
            </div>
          ) : pathMode === 'C' ? (
            <div>
              <label
                htmlFor="input-text"
                className="block text-sm font-medium text-paper-text mb-1"
              >
                Japanese story
              </label>
              <textarea
                id="input-text"
                value={inputText}
                onChange={e => handleInputChange(e.target.value)}
                placeholder="Paste your finished Japanese story here…"
                className={cn(
                  'font-ja',
                  'w-full min-h-[200px] max-h-[400px] overflow-y-auto resize-none',
                  'px-3 py-2 text-sm border rounded-md bg-surface-subtle text-paper-text',
                  'focus-visible:ring-2 ring-accent outline-none transition-colors',
                  hints.story ? 'border-error' : 'border-border',
                )}
              />
              {hints.story && (
                <p className="text-xs text-error mt-1">
                  Enter your Japanese story before generating.
                </p>
              )}
              <p className="text-xs text-muted mt-1">
                Japanese source material must be original or appropriately licensed.
              </p>
            </div>
          ) : (
            <TopicTextarea
              hint={hints.topic}
              onConfirmOpen={open => {
                setIsConfirmOpen(open)
                if (!open && sessionRestored) _setSessionRestored(false)
              }}
            />
          )}

          {/* Chapter selector */}
          <div>
            <label
              htmlFor="chapter-select"
              className="block text-sm font-medium text-paper-text mb-1"
            >
              Genki chapter
            </label>
            <select
              id="chapter-select"
              value={chapterTarget}
              onChange={e => handleChapterChange(e.target.value)}
              className={cn(
                'w-full px-3 py-2 text-sm border rounded-md bg-surface text-paper-text',
                'focus-visible:ring-2 ring-accent outline-none',
                hints.chapter ? 'border-error' : 'border-border',
              )}
            >
              <option value="">Select a chapter…</option>
              {/* Optional target difficulty — offered for the full-story inputs (A and C) only,
                  not topic mode (B). Value is the exact "unspecified" backend sentinel (se3-4). */}
              {(pathMode === 'A' || pathMode === 'C') && (
                <option value="unspecified">Unspecified — keep original difficulty</option>
              )}
              {CHAPTER_OPTIONS.map(ch => (
                <option key={ch} value={ch}>{ch}</option>
              ))}
            </select>
            {hints.chapter && (
              <p className="text-xs text-error mt-1">
                Select a chapter before generating.
              </p>
            )}
            {/* Unspecified → explanatory helper text (no ScopeChip); a recognised chapter → ScopeChip */}
            {chapterTarget === 'unspecified' ? (
              <p className="text-xs text-muted mt-1">
                The story keeps its natural difficulty — vocabulary and grammar are not constrained
                to a Genki chapter.
              </p>
            ) : (
              chapterTarget && <ScopeChip chapter={chapterTarget} className="mt-2" />
            )}
          </div>

          {/* Steering instructions collapsible */}
          <div>
            <button
              ref={steeringToggleRef}
              type="button"
              aria-label="Steering instructions"
              aria-expanded={steeringOpen}
              onClick={() => setSteeringOpen(o => {
                if (o) steeringToggleRef.current?.focus()
                return !o
              })}
              className={cn(
                'text-sm text-muted hover:text-paper-text transition-colors',
                'focus-visible:ring-2 ring-accent outline-none rounded',
              )}
            >
              Steering instructions <span aria-hidden="true">{steeringOpen ? '▾' : '▸'}</span>
            </button>
            {steeringOpen && (
              <div className="mt-2">
                <label
                  htmlFor="steering-input"
                  className="block text-xs text-muted mb-1"
                >
                  Optional guidance for the LLM
                </label>
                <textarea
                  id="steering-input"
                  value={steeringInstructions}
                  onChange={e => {
                    setSteeringInstructions(e.target.value)
                    if (sessionRestored) _setSessionRestored(false)
                  }}
                  rows={3}
                  className={cn(
                    'w-full px-3 py-2 text-sm border border-border rounded-md',
                    'bg-surface-subtle text-paper-text resize-none',
                    'focus-visible:ring-2 ring-accent outline-none',
                  )}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* Phase-aware Generate / Stop / Stopping button */}
      <div>
        {(phase === 'idle' || phase === 'error') && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerateDisabled}
            aria-disabled={isGenerateDisabled}
            className={cn(
              'px-6 py-2 rounded-md text-sm font-medium transition-colors',
              'bg-accent text-white hover:bg-accent/90',
              'focus-visible:ring-2 ring-accent focus-visible:ring-offset-2 outline-none',
              isGenerateDisabled && 'opacity-[0.45] cursor-not-allowed pointer-events-none',
            )}
          >
            {pathMode === 'A' ? 'Convert to Japanese' : pathMode === 'C' ? 'Create story' : 'Generate'}
          </button>
        )}

        {phase === 'generating' && (
          <button
            type="button"
            onClick={cancel}
            className={cn(
              'px-6 py-2 rounded-md text-sm font-medium transition-colors',
              'bg-surface border border-error text-error hover:bg-error/10',
              'focus-visible:ring-2 ring-accent focus-visible:ring-offset-2 outline-none',
            )}
          >
            Stop
          </button>
        )}

        {phase === 'cancelling' && (
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="px-6 py-2 rounded-md text-sm font-medium bg-surface border border-error text-error opacity-[0.45] cursor-not-allowed pointer-events-none"
          >
            Stopping…
          </button>
        )}

        {backendStatus === 'unavailable' && (phase === 'idle' || phase === 'error') && (
          <p className="text-xs text-muted mt-1">
            Backend unavailable — check the server is running.
          </p>
        )}
      </div>
    </section>
  )
}
