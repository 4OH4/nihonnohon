import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

/** Application header bar. In the reader view shows a back link and the app logo. */
export function AppBar() {
  return (
    <header className={cn('flex items-center justify-between bg-surface px-4 py-2 border-b border-border')}>
      <Link
        to="/"
        aria-label="Back to library"
        className="text-sm text-muted hover:text-paper-text transition-colors"
      >
        ← Library
      </Link>
      <span className="font-ja text-sm text-muted" lang="ja">
        日本の本
      </span>
    </header>
  )
}
