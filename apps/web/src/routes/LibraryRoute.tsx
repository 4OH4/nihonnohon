import { useState, useMemo, useRef, useEffect } from 'react'
import { useLoaderData, useRevalidator, useNavigate, Link } from 'react-router-dom'
import { loadStory, LoaderError } from '@nihonnohon/story-loader'
import { AppBar } from '@/components/AppBar'
import { StoryCard } from '@/components/StoryCard'
import { cn } from '@/lib/utils'
import { saveStory } from '@/services/indexedDbService'
import {
  fetchManifest,
  parseDifficultySource,
  parseDifficultyChapter,
  type ManifestEntry,
  type DifficultySource,
} from '@/utils/storyManifest'

const FORMAT_SPEC_URL =
  'https://github.com/rupertthomas/nihonnohon/blob/main/schemas/story.v1.json'

/** User-facing first line of the upload error message. */
function errorTitle(code: LoaderError['code']): string {
  switch (code) {
    case 'SCHEMA_INVALID':
      return "This doesn't look like a valid Nihon no Hon story."
    case 'UNSUPPORTED_VERSION':
      return "This story uses a format version this app doesn't support."
    case 'PARSE_FAILED':
      return "This file couldn't be read as a story."
  }
}

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
  const navigate = useNavigate()
  const [source, setSource] = useState<DifficultySource | 'All'>('All')
  const [chapter, setChapter] = useState<string>('All')
  const [uploadError, setUploadError] = useState<LoaderError | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Dismiss upload error when user clicks anywhere outside the error panel
  useEffect(() => {
    if (!uploadError) return
    const dismiss = () => setUploadError(null)
    document.addEventListener('click', dismiss)
    return () => document.removeEventListener('click', dismiss)
  }, [uploadError])

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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadError(null)
    const file = e.target.files?.[0]
    // Reset so re-selecting the same file fires onChange again
    e.target.value = ''
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const text = event.target?.result as string
      try {
        // loadStory handles JSON.parse internally — throws LoaderError on any failure
        loadStory(text)
        // Parse again to get the object for IndexedDB storage
        const rawJson = JSON.parse(text) as unknown
        const uuid = crypto.randomUUID()
        await saveStory(uuid, rawJson)
        navigate(`/read/${uuid}`)
      } catch (err) {
        if (err instanceof LoaderError) {
          setUploadError(err)
        } else {
          setUploadError(new LoaderError('PARSE_FAILED', 'An unexpected error occurred. Please try again.'))
        }
      }
    }
    reader.readAsText(file)
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
          </div>
        )}

        {/* File upload CTA — always visible at bottom of list */}
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-sm underline text-muted"
          >
            Load a story from your device
          </button>
          {uploadError && (
            <div className="mt-3 text-left max-w-sm mx-auto" onClick={e => e.stopPropagation()}>
              <p className="text-error text-sm">{errorTitle(uploadError.code)}</p>
              {uploadError.code === 'SCHEMA_INVALID' && (
                <p className="text-error text-xs mt-1 font-mono">{uploadError.message}</p>
              )}
              <a
                href={FORMAT_SPEC_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline text-muted mt-1 inline-block"
              >
                View the story format documentation
              </a>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Credits link */}
        <div className="mt-6 text-center">
          <Link to="/credits" className="text-xs text-muted underline">
            Credits
          </Link>
        </div>
      </main>
    </div>
  )
}
