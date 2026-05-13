import { cn } from '@/lib/utils'
import { useLookupStore } from '@/stores/lookupStore'
import type { VocabEntry } from '@nihonnohon/schema'

/** Single row in the vocabulary panel — shows word, reading, and translation with lookup on tap. */
export function VocabItem({ entry }: { entry: VocabEntry }) {
  const lookup = useLookupStore((s) => s.lookup)
  const lookupState = useLookupStore((s) => s.lookupState)
  const isActive = lookupState.status === 'found' && lookupState.word === entry.word

  const handleActivate = () => {
    // sentenceId is null — vocab panel taps do not select or highlight a sentence
    lookup(entry.word, entry, null)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleActivate()
        }
      }}
      className={cn(
        'flex flex-col px-3 py-2 cursor-pointer rounded',
        isActive ? 'bg-accent-subtle' : 'hover:bg-accent-subtle',
      )}
    >
      <span className="font-ja text-paper-text text-base" lang="ja">{entry.word}</span>
      <span className="font-ja text-muted text-sm" lang="ja">{entry.reading}</span>
      <span className="text-paper-text text-sm">{entry.meaning}</span>
    </div>
  )
}
