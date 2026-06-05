// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { useRef, useState, useEffect, useMemo } from 'react'
import { useLoaderData, useRouteError, isRouteErrorResponse, Link } from 'react-router-dom'
import type { LoaderFunctionArgs } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { loadStory } from '@nihonnohon/story-loader'
import { initVocab } from '@/services/vocabService'
import { initKanji } from '@/services/kanjiService'
import { fetchManifest } from '@/utils/storyManifest'
import { getStory } from '@/services/indexedDbService'
import { TEXT_SIZE_VALUES } from '@/utils/textSize'
import { cn } from '@/lib/utils'
import { AppBar } from '@/components/AppBar'
import { InfoPanel } from '@/components/InfoPanel'
import { ToolBar } from '@/components/ToolBar'
import { SettingsMenu } from '@/components/SettingsMenu'
import { SentenceBlock } from '@/components/SentenceBlock'
import { VocabPanel } from '@/components/VocabPanel'
import { GrammarPanel } from '@/components/GrammarPanel'
import { usePreferenceStore } from '@/stores/preferenceStore'
import type { StoryModel, VocabSupplementEntry } from '@nihonnohon/schema'

/** Returns raw supplement entries keyed by word; adaptation to display shape happens in WordToken. */
function buildSupplementMap(supplement: VocabSupplementEntry[]): Map<string, VocabSupplementEntry> {
  const map = new Map<string, VocabSupplementEntry>()
  supplement.forEach((entry) => {
    map.set(entry.word, entry)
  })
  return map
}

/** React Router loader — manifest lookup, then IndexedDB fallback for locally-uploaded stories. */
export async function loader({ params }: LoaderFunctionArgs): Promise<StoryModel> {
  if (!params.storyId) throw new Response('Not Found', { status: 404 })
  const storyId = params.storyId
  await Promise.all([initVocab(), initKanji()])

  // Path 1: manifest lookup for library stories
  const manifest = await fetchManifest()
  const entry = manifest.find(e => e.id === storyId)
  if (entry) {
    const res = await fetch(`/stories/${entry.filename}`)
    if (!res.ok) throw new Error(`Failed to load story: ${res.status}`)
    return loadStory(await res.json())
  }

  // Path 2: IndexedDB fallback for locally-uploaded stories (UUIDs)
  const rawJson = await getStory(storyId)
  if (rawJson !== null) {
    return loadStory(rawJson)
  }

  // Path 3: Not found in either source
  throw new Response('Gone', { status: 410 })
}

/** Error element for the reader route — shown when the loader throws. */
export function ReaderError() {
  const error = useRouteError()
  const isManifestNotFound = isRouteErrorResponse(error) && error.status === 404
  const isStorageNotFound = isRouteErrorResponse(error) && error.status === 410

  let message: string
  if (isManifestNotFound) {
    message = 'Story not found.'
  } else if (isStorageNotFound) {
    message = 'This story is not available on this device.'
  } else {
    message = 'Failed to load this story.'
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-paper-bg p-8 text-center">
      <h1 className="text-paper-text font-semibold mb-2">{message}</h1>
      <Link to="/" className="text-sm underline text-muted">
        ← Back to library
      </Link>
    </div>
  )
}

type Tab = 'story' | 'vocabulary' | 'grammar'

const TABS: { id: Tab; label: string }[] = [
  { id: 'story', label: 'Story' },
  { id: 'vocabulary', label: 'Vocabulary' },
  { id: 'grammar', label: 'Grammar' },
]

/** Full reader view — story text with word lookup, panels, and responsive two-column layout. */
export function ReaderRoute() {
  const story = useLoaderData() as StoryModel
  const supplementMap = useMemo(() => buildSupplementMap(story.vocabSupplement), [story.vocabSupplement])

  const { textSize, activeTab, setActiveTab } = usePreferenceStore(
    useShallow(s => ({
      textSize: s.textSize,
      activeTab: s.activeTab,
      setActiveTab: s.setActiveTab,
    }))
  )

  // Save and restore story area scroll position when switching away from / back to story tab
  const storyScrollRef = useRef<HTMLDivElement>(null)
  const [savedScrollTop, setSavedScrollTop] = useState(0)

  const switchTab = (tab: Tab) => {
    if (activeTab === 'story' && tab !== 'story' && storyScrollRef.current) {
      setSavedScrollTop(storyScrollRef.current.scrollTop)
    }
    setActiveTab(tab)
  }

  useEffect(() => {
    if (activeTab === 'story' && storyScrollRef.current) {
      storyScrollRef.current.scrollTop = savedScrollTop
    }
  }, [activeTab]) // intentionally omits savedScrollTop — only fires when tab changes TO story

  // Draggable desktop split: story column width as a percentage of the content area.
  // Clamped to [30, 80] so neither panel can collapse below a usable size.
  const contentAreaRef = useRef<HTMLDivElement>(null)
  const [storyWidthPercent, setStoryWidthPercent] = useState(60)
  const isDraggingRef = useRef(false)

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingRef.current = true
  }

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !contentAreaRef.current) return
      const rect = contentAreaRef.current.getBoundingClientRect()
      const pct = ((e.clientX - rect.left) / rect.width) * 100
      setStoryWidthPercent(Math.max(30, Math.min(80, pct)))
    }
    const handleUp = () => { isDraggingRef.current = false }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [])

  return (
    <div
      className="flex flex-col h-dvh bg-paper-bg"
      style={{ '--story-font-size': TEXT_SIZE_VALUES[textSize] } as React.CSSProperties}
    >
      <AppBar rightSlot={<SettingsMenu />} />
      <div className="flex items-stretch border-b border-border">
        <InfoPanel story={story} />
        <ToolBar language={story.language} />
      </div>

      {/* Content area: single column on mobile, two-column on desktop (lg+) */}
      <div ref={contentAreaRef} className="flex-1 flex overflow-hidden">

        {/* Story column: full width on mobile (story tab), left column on desktop (resizable via splitter). */}
        <div
          ref={storyScrollRef}
          className={cn(
            'overflow-y-auto p-4 w-full',
            activeTab !== 'story' ? 'hidden lg:block' : 'block',
            'lg:max-w-none lg:shrink-0 lg:w-[var(--story-pct)]',
          )}
          style={{
            '--story-pct': `${storyWidthPercent}%`,
            fontSize: 'var(--story-font-size)',
          } as React.CSSProperties}
        >
          {story.sentences.map((sentence, i) => (
            <SentenceBlock
              key={sentence.id}
              sentence={sentence}
              sentenceIndex={i}
              supplementMap={supplementMap}
            />
          ))}
        </div>

        {/* Resize splitter: desktop-only, drag to adjust the story / right-panel split. */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize reading area"
          onMouseDown={handleResizeStart}
          className="hidden lg:block w-1 shrink-0 cursor-col-resize bg-border hover:bg-accent active:bg-accent transition-colors"
        />

        {/* Desktop right panel: Vocabulary/Grammar tabs — hidden on mobile */}
        <div className="hidden lg:flex lg:flex-col lg:flex-1 lg:overflow-hidden lg:min-w-0">
          <div className="flex border-b border-border bg-surface">
            {(['vocabulary', 'grammar'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 py-2 text-sm capitalize',
                  (activeTab === tab || (activeTab === 'story' && tab === 'vocabulary'))
                    ? 'border-b-2 border-accent text-paper-text'
                    : 'text-muted',
                )}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto w-full">
            {activeTab === 'grammar'
              ? <GrammarPanel grammar={story.grammar} sentences={story.sentences} />
              : <VocabPanel keywords={story.keywords} vocabSupplement={story.vocabSupplement} />
            }
          </div>
        </div>

        {/* Mobile-only: vocabulary panel (hidden on desktop since it's in right panel) */}
        <div className={cn('w-full overflow-y-auto', activeTab === 'vocabulary' ? 'block lg:hidden' : 'hidden')} tabIndex={0}>
          <VocabPanel keywords={story.keywords} vocabSupplement={story.vocabSupplement} />
        </div>

        {/* Mobile-only: grammar panel */}
        <div className={cn('w-full overflow-y-auto', activeTab === 'grammar' ? 'block lg:hidden' : 'hidden')} tabIndex={0}>
          <GrammarPanel grammar={story.grammar} sentences={story.sentences} />
        </div>
      </div>

      {/* Mobile bottom tab bar — hidden on desktop */}
      <div className="lg:hidden flex border-t border-border bg-surface" role="tablist" aria-label="Content tabs">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => switchTab(id)}
            className={cn(
              'flex-1 py-3 text-sm',
              activeTab === id
                ? 'border-b-2 border-accent text-paper-text'
                : 'text-muted',
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
