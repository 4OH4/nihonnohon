import { useRef } from 'react'

interface JsonOutputProps {
  value: string
  onChange: (v: string) => void
}

/** Monospace JSON display with a line-number gutter and inline editing. */
export function JsonOutput({ value, onChange }: JsonOutputProps) {
  const lineCount = value.split('\n').length
  const gutterRef = useRef<HTMLDivElement>(null)

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = e.currentTarget.scrollTop
    }
  }

  return (
    <div className="border border-border rounded-md overflow-hidden min-h-[300px] flex bg-surface-subtle">
      <div
        ref={gutterRef}
        className="w-11 shrink-0 overflow-hidden select-none text-right font-mono text-xs text-muted bg-surface border-r border-border py-2"
        aria-hidden="true"
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} className="px-2 leading-5">{i + 1}</div>
        ))}
      </div>
      <textarea
        aria-label="Generated story JSON"
        value={value}
        onChange={e => onChange(e.target.value)}
        onScroll={handleScroll}
        spellCheck={false}
        className="flex-1 font-mono text-xs p-2 resize-none bg-transparent text-paper-text focus-visible:outline-none leading-5 overflow-y-auto"
      />
    </div>
  )
}
