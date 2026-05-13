import { useState, useMemo } from 'react'
import { useLoaderData, useRevalidator } from 'react-router-dom'
import { AppBar } from '@/components/AppBar'
import { StoryCard } from '@/components/StoryCard'
import { cn } from '@/lib/utils'
import {
  fetchManifest,
  parseDifficultySource,
  parseDifficultyChapter,
  type ManifestEntry,
  type DifficultySource,
} from '@/utils/storyManifest'

/** React Router loader — fetches and validates the story manifest. */
export async function loader(): Promise<ManifestEntry[]> {
  return fetchManifest()
}

/** Error element rendered by React Router when the library loader throws. */
export function LibraryError() {
  const revalidator = useRevalidator()
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-paper-bg p-8 text-center">
      <p className="text-error mb-4">Couldn't load the story library.</p>
      <button
        type="button"
        onClick={() => revalidator.revalidate()}
        className="text-sm underline text-paper-text"
      >
        Try again
      </button>
    </div>
  )
}

function selectClass(active: boolean) {
  return cn(
    'rounded border text-paper-text text-sm px-2 py-1 focus:outline-none',
    active ? 'bg-accent-subtle border-accent' : 'bg-surface border-border focus:border-accent',
  )
}

/** Library landing page — displays all stories with source and chapter difficulty filters. */
export function LibraryRoute() {
  const entries = useLoaderData() as ManifestEntry[]
  const [source, setSource] = useState<DifficultySource | 'All'>('All')
  const [chapter, setChapter] = useState<string>('All')

  // Unique sources present in the manifest, sorted alphabetically
  const availableSources = useMemo<DifficultySource[]>(() => {
    const seen = new Set<DifficultySource>()
    entries.forEach(e => {
      if (e.difficulty) {
        const s = parseDifficultySource(e.difficulty)
        if (s) seen.add(s)
      }
    })
    return ([...seen] as DifficultySource[]).sort()
  }, [entries])

  // Unique chapters for the selected source, sorted
  const availableChapters = useMemo<string[]>(() => {
    if (source === 'All') return []
    return [
      ...new Set(
        entries
          .filter(e => e.difficulty && parseDifficultySource(e.difficulty) === source)
          .map(e => parseDifficultyChapter(e.difficulty!, source as DifficultySource)),
      ),
    ].sort()
  }, [entries, source])

  // Stories matching the current source + chapter selection
  const filteredEntries = useMemo(() => {
    if (source === 'All') return entries
    return entries.filter(e => {
      if (!e.difficulty) return false
      const s = parseDifficultySource(e.difficulty)
      if (s !== source) return false
      if (chapter === 'All') return true
      return parseDifficultyChapter(e.difficulty, s) === chapter
    })
  }, [entries, source, chapter])

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSource(e.target.value as DifficultySource | 'All')
    setChapter('All')
  }

  const resetFilter = () => {
    setSource('All')
    setChapter('All')
  }

  return (
    <div className="flex flex-col min-h-dvh bg-paper-bg">
      <AppBar variant="library" />
      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
        {/* Difficulty filter row */}
        <div className="flex gap-4 mb-6 flex-wrap items-center">
          <div className="flex items-center gap-2">
            <label htmlFor="source-filter" className="text-sm text-muted">
              Source
            </label>
            <select
              id="source-filter"
              value={source}
              onChange={handleSourceChange}
              className={selectClass(source !== 'All')}
            >
              <option value="All">All</option>
              {availableSources.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          {source !== 'All' && (
            <div className="flex items-center gap-2">
              <label htmlFor="chapter-filter" className="text-sm text-muted">
                Chapter
              </label>
              <select
                id="chapter-filter"
                value={chapter}
                onChange={e => setChapter(e.target.value)}
                className={selectClass(chapter !== 'All')}
              >
                <option value="All">All</option>
                {availableChapters.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Story list or empty state */}
        {filteredEntries.length > 0 ? (
          <ul className="space-y-3 list-none p-0 m-0">
            {filteredEntries.map(e => (
              <li key={e.id}>
                <StoryCard entry={e} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted mb-4">No stories found for this selection.</p>
            <button
              type="button"
              onClick={resetFilter}
              className="text-sm underline text-paper-text mr-4"
            >
              Reset filter
            </button>
            {/* Placeholder — Story 3.4 wires the file picker */}
            <button type="button" className="text-sm underline text-muted">
              Load a story from your device
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
