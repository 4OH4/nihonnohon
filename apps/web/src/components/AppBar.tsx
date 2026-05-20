import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface AppBarProps {
  /** 'reader' shows the back link; 'library' shows logo only. Defaults to 'reader'. */
  variant?: 'reader' | 'library'
  /** Optional content rendered in the right cell of the header grid. */
  rightSlot?: React.ReactNode
}

/** Application header bar. Three-column grid: back link | centred title | rightSlot. */
export function AppBar({ variant = 'reader', rightSlot }: AppBarProps) {
  return (
    <header className={cn('grid grid-cols-3 items-center min-h-12 bg-surface px-4 py-1 border-b border-border')}>
      {variant === 'reader' ? (
        <Link
          to="/"
          aria-label="Back to library"
          className="text-sm text-muted hover:text-paper-text transition-colors"
        >
          ← Library
        </Link>
      ) : (
        <span />
      )}
      <span className="font-ja text-sm text-muted justify-self-center" lang="ja">
        日本の本
      </span>
      <div className="flex justify-end">{rightSlot}</div>
    </header>
  )
}
