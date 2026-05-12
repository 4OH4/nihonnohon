import { cn } from '@/lib/utils'

interface DifficultyBadgeProps {
  difficulty: string
}

/** Rounded pill badge displaying a story difficulty label (e.g. "Genki I Ch.6", "JLPT N4"). */
export function DifficultyBadge({ difficulty }: DifficultyBadgeProps) {
  return (
    <span
      aria-label={difficulty}
      className={cn(
        'inline-block rounded-full px-2 py-0.5 text-xs',
        'bg-accent-subtle border border-accent text-paper-text',
      )}
    >
      {difficulty}
    </span>
  )
}
