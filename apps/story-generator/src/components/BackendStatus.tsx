import { cn } from '@/lib/utils'
import { useBackendStatus } from '@/hooks/useBackendStatus'

const DOT_CLASS: Record<string, string> = {
  checking:    'bg-muted animate-pulse',
  connected:   'bg-success',
  unavailable: 'bg-warning',
}

const LABEL: Record<string, string> = {
  checking:    'Checking…',
  connected:   'Backend connected',
  unavailable: 'Backend unavailable',
}

/** Displays a status dot and label showing backend health. */
export function BackendStatus() {
  const status = useBackendStatus()

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn('w-2 h-2 rounded-full flex-shrink-0', DOT_CLASS[status])}
        aria-hidden="true"
      />
      <span aria-live="polite" className="text-sm text-muted">
        {LABEL[status]}
      </span>
    </div>
  )
}
