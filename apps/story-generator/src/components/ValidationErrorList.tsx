// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import type { ValidationError } from '@/stores/authoringStore'
import { cn } from '@/lib/utils'

interface ValidationErrorListProps {
  errors: ValidationError[]
}

/**
 * Displays client-side validation errors that block story download.
 *
 * Renders nothing when the errors array is empty.
 */
export function ValidationErrorList({ errors }: ValidationErrorListProps) {
  if (errors.length === 0) return null

  const label = errors.length === 1 ? 'error' : 'errors'

  return (
    <div
      role="alert"
      className="mt-3 rounded-md border border-error bg-error/5 p-3 flex flex-col gap-1"
    >
      {/* Header */}
      <p className="text-sm font-medium text-error">
        {errors.length} validation {label} — download blocked
      </p>

      {/* Error rows */}
      {errors.map((error, i) => (
        <div key={i} className="flex items-start gap-2 mt-1 flex-wrap">
          {/* Rule badge */}
          <span className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-xs font-mono',
            'bg-error/10 border border-error text-error',
          )}>
            {error.rule}
          </span>

          {/* JSON path */}
          {error.path && (
            <span className="font-mono text-xs text-muted shrink-0">{error.path}</span>
          )}

          {/* Human-readable message */}
          <span className="text-xs text-paper-text">{error.message}</span>
        </div>
      ))}
    </div>
  )
}
