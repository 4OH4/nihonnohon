import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface AppBarProps {
  /** 'reader' shows the back link; 'library' shows logo only. Defaults to 'reader'. */
  variant?: 'reader' | 'library'
}

/** Application header bar. Reader variant shows a back link; library variant shows logo only. */
export function AppBar({ variant = 'reader' }: AppBarProps) {
  return (
    <header className={cn('flex items-center justify-between bg-surface px-4 py-2 border-b border-border')}>
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
      <span className="font-ja text-sm text-muted" lang="ja">
        日本の本
      </span>
    </header>
  )
}
