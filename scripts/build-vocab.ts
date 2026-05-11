import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'

interface VocabEntry {
  id: number
  word: string
  reading: string
  meaning: string
  lesson: string
}

function formatLesson(lessonNum: number): string {
  if (lessonNum === 0) return 'Genki I Intro'
  if (lessonNum <= 12) return `Genki I Ch.${lessonNum}`
  return `Genki II Ch.${lessonNum}`
}

function firstPart(value: string): string {
  return value.split(/[;/]/)[0].trim()
}

const scriptDir = resolve(process.cwd(), 'scripts')
const csvPath = resolve(scriptDir, 'data/genki-vocab.csv')
const outPath = resolve(process.cwd(), 'apps/web/public/vocab.json')

const csv = readFileSync(csvPath, 'utf-8')
const lines = csv.split('\n').filter(line => line.trim().length > 0)

const entries: VocabEntry[] = lines.map((line, index) => {
  const parts = line.split(',')
  const rawReading = parts[0]?.trim() ?? ''
  const rawKanji = parts[1]?.trim() ?? ''
  const meaning = parts[2]?.trim() ?? ''
  const lessonNum = parseInt(parts[3]?.trim() ?? '0', 10)

  const reading = firstPart(rawReading)
  const word = rawKanji.length > 0 ? firstPart(rawKanji) : reading

  return {
    id: index + 1,
    word,
    reading,
    meaning,
    lesson: formatLesson(isNaN(lessonNum) ? 0 : lessonNum),
  }
})

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(entries, null, 2))
console.log(`build-vocab: wrote ${entries.length} entries to ${outPath}`)
