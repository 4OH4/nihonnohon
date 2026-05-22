// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { cn } from '@/lib/utils'
import { useAuthoringStore } from '@/stores/authoringStore'

/**
 * English proposal review panel for Path B.
 *
 * Always mounted; height:0/overflow:hidden outside proposal phase (no layout shift).
 * Provides an editable English draft, "Convert to Japanese" (approve), and "Regenerate"
 * (restart phase 1 from the original topic).
 */
export function ProposalPanel() {
  const phase           = useAuthoringStore(s => s.phase)
  const proposalText    = useAuthoringStore(s => s.proposalText)
  const errorCode       = useAuthoringStore(s => s.errorCode)
  const errorMessage    = useAuthoringStore(s => s.errorMessage)
  const setProposalText = useAuthoringStore(s => s.setProposalText)
  const approve         = useAuthoringStore(s => s.approve)
  const generate        = useAuthoringStore(s => s.generate)

  const isVisible  = phase === 'proposal'
  const textValue  = proposalText ?? ''
  const canConvert = textValue.trim() !== ''

  return (
    <section
      aria-label="English story proposal"
      className={cn('mt-4 overflow-hidden', !isVisible && 'h-0')}
    >
      {isVisible && (
        <div className="space-y-3">
          <div>
            <label htmlFor="proposal-text" className="block text-sm font-medium text-paper-text mb-1">
              English story proposal
            </label>
            <p className="text-xs text-muted mb-2">
              Review and edit the English story below, then convert it to Japanese.
            </p>
            <textarea
              id="proposal-text"
              value={textValue}
              onChange={e => setProposalText(e.target.value)}
              className={cn(
                'w-full min-h-[200px] max-h-[500px] overflow-y-auto resize-none',
                'px-3 py-2 text-sm border border-border rounded-md',
                'bg-surface-subtle text-paper-text',
                'focus-visible:ring-2 ring-accent outline-none transition-colors',
              )}
            />
          </div>

          {/* Inline error note when a previous conversion attempt failed */}
          {errorCode && (
            <p role="alert" className="text-xs text-error">
              {errorMessage ?? 'Conversion failed — your draft is preserved. Try again.'}
            </p>
          )}

          {/* Action row */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={approve}
              disabled={!canConvert}
              aria-disabled={!canConvert}
              className={cn(
                'px-6 py-2 rounded-md text-sm font-medium transition-colors',
                'bg-accent text-white hover:bg-accent/90',
                'focus-visible:ring-2 ring-accent focus-visible:ring-offset-2 outline-none',
                !canConvert && 'opacity-[0.45] cursor-not-allowed pointer-events-none',
              )}
            >
              Convert to Japanese
            </button>

            <button
              type="button"
              onClick={generate}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                'bg-surface border border-border text-muted hover:text-paper-text',
                'focus-visible:ring-2 ring-accent outline-none',
              )}
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
