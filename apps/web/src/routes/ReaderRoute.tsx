import { useLoaderData, useRouteError, isRouteErrorResponse, Link } from 'react-router-dom'
import type { LoaderFunctionArgs } from 'react-router-dom'
import { loadStory } from '@nihonnohon/story-loader'
import { initVocab } from '@/services/vocabService'
import { initKanji } from '@/services/kanjiService'
import { fetchManifest } from '@/utils/storyManifest'
import { AppBar } from '@/components/AppBar'
import { InfoPanel } from '@/components/InfoPanel'
import { ToolBar } from '@/components/ToolBar'
import { SentenceBlock } from '@/components/SentenceBlock'
import type { StoryModel, VocabEntry, VocabSupplementEntry } from '@nihonnohon/schema'

/** Converts vocab supplement entries to VocabEntry shape for lookup store compatibility. */
function buildSupplementMap(supplement: VocabSupplementEntry[]): Map<string, VocabEntry> {
  const map = new Map<string, VocabEntry>()
  supplement.forEach((entry, i) => {
    map.set(entry.word, {
      id: -(i + 1),
      word: entry.word,
      reading: entry.hiragana,
      meaning: entry.translation,
      lesson: 'supplement',
    })
  })
  return map
}

/** React Router loader — looks up storyId in manifest then fetches and parses the story file. */
export async function loader({ params }: LoaderFunctionArgs): Promise<StoryModel> {
  if (!params.storyId) throw new Response('Not Found', { status: 404 })
  const storyId = params.storyId
  await Promise.all([initVocab(), initKanji()])
  const manifest = await fetchManifest()
  const entry = manifest.find(e => e.id === storyId)
  if (!entry) throw new Response('Not Found', { status: 404 })
  const res = await fetch(`/stories/${entry.filename}`)
  if (!res.ok) throw new Error(`Failed to load story: ${res.status}`)
  return loadStory(await res.json())
}

/** Error element for the reader route — shown when the loader throws (story not found or load failure). */
export function ReaderError() {
  const error = useRouteError()
  const isNotFound = isRouteErrorResponse(error) && error.status === 404

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-paper-bg p-8 text-center">
      <h1 className="text-paper-text font-semibold mb-2">
        {isNotFound ? 'Story not found.' : 'Failed to load this story.'}
      </h1>
      <Link to="/" className="text-sm underline text-muted">
        ← Back to library
      </Link>
    </div>
  )
}

/** Full reader view — displays all sentences with word lookup, ruby and translation toggles. */
export function ReaderRoute() {
  const story = useLoaderData() as StoryModel
  const supplementMap = buildSupplementMap(story.vocabSupplement)

  return (
    <div className="flex flex-col h-dvh bg-paper-bg">
      <AppBar />
      <InfoPanel story={story} />
      <ToolBar language={story.language} />
      <div
        className="flex-1 overflow-y-auto p-4"
        style={{ fontSize: 'var(--story-font-size, 1.25rem)' }}
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
    </div>
  )
}
