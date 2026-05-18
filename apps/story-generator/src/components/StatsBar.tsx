interface StatsBarProps {
  outputJson: string | null
}

/**
 * Displays a summary of story structure counts above the output textarea.
 *
 * Shows: sentence count · unique non-null vocab items · grammar patterns.
 * Hidden when no output has been generated yet.
 */
export function StatsBar({ outputJson }: StatsBarProps) {
  if (!outputJson) return null

  let sentenceCount = 0
  let vocabItems = 0
  let grammarPatterns = 0

  try {
    const story = JSON.parse(outputJson) as Record<string, unknown>

    // Sentence count
    sentenceCount = Array.isArray(story.sentences) ? story.sentences.length : 0

    // Unique non-null vocab_keys across all sentences
    const uniqueKeys = new Set<number>()
    if (Array.isArray(story.sentences)) {
      for (const sentence of story.sentences as Record<string, unknown>[]) {
        if (Array.isArray(sentence.vocab_keys)) {
          for (const key of sentence.vocab_keys as (number | null)[]) {
            if (key !== null) uniqueKeys.add(key)
          }
        }
      }
    }
    vocabItems = uniqueKeys.size

    // Grammar pattern count
    grammarPatterns = Array.isArray(story.grammar) ? story.grammar.length : 0
  } catch {
    // Parse failure — hide gracefully
    return null
  }

  return (
    <p className="text-xs text-muted mb-2">
      {sentenceCount} sentences · {vocabItems} vocab items · {grammarPatterns} grammar patterns
    </p>
  )
}
