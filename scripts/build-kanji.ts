/**
 * One-time data script: fetches the kyouiku kanji set from kanjiapi.dev
 * and writes apps/web/public/kanji-data.json.
 *
 * The output is committed to the repo (not gitignored) — run this script
 * only when refreshing the kanji data file.
 *
 * Usage (from repo root):
 *   pnpm run build-kanji
 *
 * Note: kanji-data.json intentionally covers only the 1026 kyouiku kanji.
 * kanjiService.ts returns null for any character not in the file — components
 * must handle this gracefully (show the character, omit the keyword label).
 */
import { writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'

interface KanjiApiCharacter {
  kanji: string
  grade: number | null
  stroke_count: number
  meanings: string[]
  kun_readings: string[]
  on_readings: string[]
  name_readings: string[]
  jlpt: number | null
  unicode: string
  heisig_en: string | null
}

interface KanjiEntry {
  char: string
  kw: string | null
  m: string[]
  onY: string[]
  kunY: string[]
}

const KANJI_LIST_URL = 'https://kanjiapi.dev/v1/kanji/kyouiku'
const KANJI_URL = (char: string) => `https://kanjiapi.dev/v1/kanji/${encodeURIComponent(char)}`
const DELAY_MS = 100

const outPath = resolve(process.cwd(), 'apps/web/public/kanji-data.json')

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`)
  return res.json() as Promise<T>
}

async function main(): Promise<void> {
  console.log('build-kanji: fetching kyouiku kanji list...')
  const characters = await fetchJson<string[]>(KANJI_LIST_URL)
  console.log(`build-kanji: ${characters.length} kanji to fetch`)

  const result: Record<string, KanjiEntry> = {}
  let fetched = 0
  let errors = 0

  for (const char of characters) {
    try {
      const data = await fetchJson<KanjiApiCharacter>(KANJI_URL(char))
      result[char] = {
        char,
        kw: data.heisig_en ?? null,
        m: data.meanings,
        onY: data.on_readings,
        kunY: data.kun_readings,
      }
      fetched++
      if (fetched % 100 === 0) {
        console.log(`build-kanji: ${fetched}/${characters.length} fetched...`)
      }
    } catch (err) {
      console.warn(`build-kanji: failed to fetch "${char}": ${err}`)
      errors++
    }
    await sleep(DELAY_MS)
  }

  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(result, null, 2))
  console.log(`build-kanji: wrote ${fetched} entries to ${outPath}`)
  if (errors > 0) {
    console.warn(`build-kanji: ${errors} characters failed — review warnings above`)
  }
}

main().catch(err => {
  console.error('build-kanji: fatal error', err)
  process.exit(1)
})
