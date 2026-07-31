/**
 * One-time data script: fetches the jouyou kanji set from kanjiapi.dev
 * and writes apps/web/public/kanji-data.json.
 *
 * The output is committed to the repo (not gitignored) — run this script
 * only when refreshing the kanji data file.
 *
 * Usage (from repo root):
 *   pnpm run build-kanji
 *
 * Note: kanji-data.json covers the 2140 jouyou kanji kanjiapi.dev lists — the set
 * taught through secondary school, which spans the vocabulary the stories draw
 * on. It was previously limited to the 1006 kyouiku (grade 1-6) kanji, which
 * silently dropped common characters such as the 喫 of 喫茶店 from the breakdown.
 *
 * kanjiService.ts returns null for any character not in the file, and
 * KanjiBreakdown omits those characters from the breakdown entirely — a bare
 * character with no keyword only repeats what the word already shows. Anything
 * outside jouyou (jinmeiyou, hyougai) therefore degrades to no cell at all,
 * which is intended; components must not throw on a missing character.
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

const KANJI_LIST_URL = 'https://kanjiapi.dev/v1/kanji/jouyou'
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
  console.log('build-kanji: fetching jouyou kanji list...')
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
