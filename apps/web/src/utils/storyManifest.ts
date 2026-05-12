/** A single entry in the story manifest. */
export interface ManifestEntry {
  id: string
  filename: string
  title: string
  titleJa: string
  difficulty?: string | null
  language: string
  description: string
}

/** Type guard — returns true when obj has all required ManifestEntry fields. */
export function isManifestEntry(obj: unknown): obj is ManifestEntry {
  if (typeof obj !== 'object' || obj === null) return false
  const e = obj as Record<string, unknown>
  return (
    typeof e.id === 'string' &&
    e.id.length > 0 &&
    typeof e.filename === 'string' &&
    typeof e.title === 'string' &&
    typeof e.titleJa === 'string' &&
    typeof e.language === 'string' &&
    typeof e.description === 'string' &&
    (!('difficulty' in e) || e.difficulty === null || typeof e.difficulty === 'string')
  )
}
