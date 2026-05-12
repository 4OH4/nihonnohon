import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { DifficultyBadge } from '@/components/DifficultyBadge'
import type { ManifestEntry } from '@/utils/storyManifest'

interface StoryCardProps {
  entry: ManifestEntry
}

/** Library card for a single story — links to the reader and displays title, difficulty, and description. */
export function StoryCard({ entry }: StoryCardProps) {
  return (
    <Link
      to={`/read/${entry.id}`}
      className={cn(
        'block p-4 rounded border border-border hover:border-accent',
        'transition-colors bg-surface text-paper-text no-underline',
      )}
    >
      <p className="font-bold text-paper-text">{entry.title}</p>
      <p className="font-ja text-sm text-muted" lang="ja">{entry.titleJa}</p>
      {entry.difficulty && <DifficultyBadge difficulty={entry.difficulty} />}
      <p className="text-sm text-muted line-clamp-2 mt-1">{entry.description}</p>
    </Link>
  )
}
