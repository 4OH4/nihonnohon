import { useLoaderData } from 'react-router-dom'
import { loadStory } from '@nihonnohon/story-loader'
import { initVocab } from '@/services/vocabService'
import { initKanji } from '@/services/kanjiService'
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

/** React Router loader: initialises data services and fetches the story. Epic 3 replaces the loader body, not this pattern. */
export async function loader(): Promise<StoryModel> {
  await Promise.all([initVocab(), initKanji()])
  const res = await fetch('/stories/genki-i-ch6-tanaka-letter.json')
  if (!res.ok) throw new Error(`Failed to load story: ${res.status}`)
  return loadStory(await res.json())
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
