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

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current)
  return fields
}

const scriptDir = resolve(process.cwd(), 'scripts')
const csvPath = resolve(scriptDir, 'data/genki-vocab.csv')
const outPath = resolve(process.cwd(), 'apps/web/public/vocab.json')

const csv = readFileSync(csvPath, 'utf-8')
const lines = csv.split('\n').filter(line => line.trim().length > 0)

const entries: VocabEntry[] = lines.map((line, index) => {
  const parts = parseCSVLine(line)
  if (parts.length !== 5) {
    console.warn(`build-vocab: unexpected column count (${parts.length}) at line ${index + 1}: ${line.slice(0, 60)}`)
  }
  const id = parseInt(parts[0]?.trim() ?? '0', 10)
  const rawReading = parts[1]?.trim() ?? ''
  const rawKanji = parts[2]?.trim() ?? ''
  const meaning = parts[3]?.trim() ?? ''
  const lessonNum = parseInt(parts[4]?.trim() ?? '0', 10)

  if (isNaN(id)) {
    console.warn(`build-vocab: invalid id at line ${index + 1}: "${parts[0]?.trim()}"`)
  }
  if (isNaN(lessonNum)) {
    console.warn(`build-vocab: invalid lesson number at line ${index + 1}, defaulting to 0: "${parts[4]?.trim()}"`)
  }

  const reading = firstPart(rawReading)
  const word = rawKanji.length > 0 ? firstPart(rawKanji) : reading

  return {
    id: isNaN(id) ? index + 1 : id,
    word,
    reading,
    meaning,
    lesson: formatLesson(isNaN(lessonNum) ? 0 : lessonNum),
  }
})

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(entries, null, 2))
console.log(`build-vocab: wrote ${entries.length} entries to ${outPath}`)
