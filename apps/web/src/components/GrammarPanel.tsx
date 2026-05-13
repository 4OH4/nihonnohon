import { useLookupStore } from '@/stores/lookupStore'
import type { SentenceModel } from '@nihonnohon/schema'
import { cn } from '@/lib/utils'

interface GrammarPanelProps {
  grammar: string[]
  sentences: SentenceModel[]
}

/** Displays story grammar points, highlighting those used in the currently selected sentence. */
export function GrammarPanel({ grammar, sentences }: GrammarPanelProps) {
  const selectedSentenceId = useLookupStore(s => s.selectedSentenceId)

  // Derive index set for the selected sentence (SentenceModel.grammar: number[] → indices into StoryModel.grammar)
  const activeSentence = selectedSentenceId !== null
    ? (sentences.find(s => s.id === selectedSentenceId) ?? null)
    : null
  const highlightedIndices = new Set(activeSentence?.grammar ?? [])

  if (grammar.length === 0) {
    return (
      <div className="flex justify-center items-center p-4">
        <p className="text-muted text-center text-sm">No grammar notes for this story.</p>
      </div>
    )
  }

  return (
    <ul className="p-4 space-y-2">
      {grammar.map((point, i) => {
        const isHighlighted = selectedSentenceId !== null && highlightedIndices.has(i)
        const isMuted = selectedSentenceId !== null && !highlightedIndices.has(i)

        return (
          <li
            key={i}
            className={cn(
              'px-3 py-2 rounded text-sm text-paper-text',
              isHighlighted && 'bg-accent-subtle border border-accent',
              isMuted && 'text-muted',
            )}
          >
            {point}
          </li>
        )
      })}
    </ul>
  )
}
