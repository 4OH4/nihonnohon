#!/usr/bin/env tsx
// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT
/**
 * Bulk story generator for nihonnohon.
 *
 * Calls the story-generator backend sequentially via Path B (suggest topic →
 * English proposal → Japanese story) for every Genki chapter up to a
 * configured maximum, validates output, and saves JSON files.
 *
 * Usage:
 *   pnpm bulk-generate
 *   pnpm tsx scripts/bulk_generate.ts
 *
 * Run from the monorepo root so that relative paths resolve correctly.
 */

import * as readline from 'node:readline/promises'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { stdin as input, stdout as output } from 'node:process'

// Imported from workspace source — tsx resolves .ts directly, no build step needed
import { validateStoryJson, type ValidationError } from '../apps/story-generator/src/lib/validateStoryJson.ts'
import { loadStory, LoaderError } from '../packages/story-loader/src/index.ts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SSEEvent {
  type: string
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LICENSE_URL_MAP: Record<string, string> = {
  'CC BY 4.0':    'https://creativecommons.org/licenses/by/4.0/',
  'CC BY-NC 4.0': 'https://creativecommons.org/licenses/by-nc/4.0/',
}

const ATTRIBUTION_SOURCE = 'Generated using the 日本の本 AI Story Authoring Tool'

// ---------------------------------------------------------------------------
// Cancellation
// ---------------------------------------------------------------------------

let cancelled = false

process.on('SIGINT', () => {
  cancelled = true
  console.log('\n  Cancellation requested — completing current story then stopping...')
})

// ---------------------------------------------------------------------------
// Interactive prompts
// ---------------------------------------------------------------------------

/** Prompt with a default; returns trimmed input or the default on empty Enter. */
async function prompt(rl: readline.Interface, question: string, defaultVal: string): Promise<string> {
  try {
    const answer = (await rl.question(`  ${question} [${defaultVal}]: `)).trim()
    return answer || defaultVal
  } catch {
    return defaultVal
  }
}

/** Prompt for a positive integer, re-asking on bad input. */
async function promptInt(rl: readline.Interface, question: string, defaultVal: number): Promise<number> {
  while (true) {
    const raw = await prompt(rl, question, String(defaultVal))
    const n = parseInt(raw, 10)
    if (!isNaN(n) && n > 0) return n
    console.log('    Please enter a positive integer.')
  }
}

/** Prompt for a non-negative float, re-asking on bad input. */
async function promptFloat(rl: readline.Interface, question: string, defaultVal: number): Promise<number> {
  while (true) {
    const raw = await prompt(rl, question, String(defaultVal))
    const n = parseFloat(raw)
    if (!isNaN(n) && n >= 0) return n
    console.log('    Please enter a number ≥ 0.')
  }
}

// ---------------------------------------------------------------------------
// SSE streaming
// ---------------------------------------------------------------------------

/**
 * Open a GET SSE stream and collect events until RUN_FINISHED, ERROR, or
 * RUN_CANCELLED. AGENT_STATUS events are included but callers ignore them.
 */
async function streamSSE(url: string, timeoutMs = 120_000): Promise<SSEEvent[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const resp = await fetch(url, { signal: controller.signal })
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`)
    if (!resp.body) throw new Error('No response body from SSE endpoint')

    const events: SSEEvent[] = []
    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    outer: while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const event = JSON.parse(line.slice(6)) as SSEEvent
          events.push(event)
          const t = event.type
          if (t === 'RUN_FINISHED' || t === 'ERROR' || t === 'RUN_CANCELLED') {
            reader.cancel()
            break outer
          }
        } catch {
          // skip malformed event line
        }
      }
    }
    return events
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// Attribution injection
// ---------------------------------------------------------------------------

/**
 * Inject author / source / license fields into a raw story JSON string.
 * Mirrors injectAttribution() from authoringStore.ts (cannot import that
 * directly — it carries Zustand and React dependencies).
 */
function injectAttribution(raw: string, author: string, licenseName: string): string {
  try {
    const story = JSON.parse(raw) as Record<string, unknown>
    if (author) story.author = author
    story.source = ATTRIBUTION_SOURCE
    if (licenseName) {
      story.license = licenseName
      const url = LICENSE_URL_MAP[licenseName]
      if (url) story.license_url = url
    }
    return JSON.stringify(story, null, 2)
  } catch {
    return raw
  }
}

// ---------------------------------------------------------------------------
// File save
// ---------------------------------------------------------------------------

/**
 * Write story JSON as UTF-8 without BOM, appending -2/-3/… on collision.
 * Returns the path of the written file.
 */
function saveStory(storyJson: string, outputDir: string): string {
  const story = JSON.parse(storyJson) as Record<string, unknown>
  const baseId = (story.id as string | undefined) ?? 'story-unknown'
  let filename = `${baseId}.json`
  let outPath = join(outputDir, filename)
  if (existsSync(outPath)) {
    let suffix = 2
    while (existsSync(join(outputDir, `${baseId}-${suffix}.json`))) suffix++
    filename = `${baseId}-${suffix}.json`
    outPath = join(outputDir, filename)
  }
  writeFileSync(outPath, storyJson + '\n', 'utf8')
  return outPath
}


// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('\n=== nihonnohon Bulk Story Generator ===\n')
  console.log('Press Enter to accept defaults.\n')

  const rl = readline.createInterface({ input, output })

  const storiesPerChapter = await promptInt(rl, 'Stories per chapter', 1)
  const lowestChapter     = await promptInt(rl, 'Lowest chapter', 1)
  const highestChapter    = await promptInt(rl, 'Highest chapter', 23)
  const author            = await prompt(rl, 'Author name', '')
  const licenseName       = await prompt(rl, 'License', 'CC BY 4.0')
  const targetWordCount   = await promptInt(rl, 'Target word count', 300)
  const grammarDist       = await promptInt(rl, 'Grammar distribution (0=limited, 1=balanced, 2=use many)', 2)
  const temperature       = await promptFloat(rl, 'Temperature', 1.0)
  const outputDir         = await prompt(rl, 'Output directory', 'apps/web/public/stories')
  const backendUrl        = (await prompt(rl, 'Backend URL', 'http://localhost:8000')).replace(/\/$/, '')

  rl.close()
  console.log()

  // Optional health check — warn but do not abort
  try {
    const hr = await fetch(`${backendUrl}/health`, { signal: AbortSignal.timeout(5_000) })
    if (!hr.ok) console.warn(`  ⚠  Backend health check returned ${hr.status} — proceeding anyway.\n`)
  } catch {
    console.warn('  ⚠  Backend unreachable at startup — proceeding anyway.\n')
  }

  mkdirSync(outputDir, { recursive: true })

  const chapterCount = highestChapter - lowestChapter + 1
  const total        = storiesPerChapter * chapterCount
  const MAX_ATTEMPTS = 3
  console.log(`Will generate ${total} stories (${storiesPerChapter} × Ch.${lowestChapter}–${highestChapter}, up to ${MAX_ATTEMPTS} attempts each).`)
  console.log(`Output → ${outputDir}\n`)
  console.log('Ctrl+C to cancel gracefully after the current story completes.\n')
  console.log('-'.repeat(60))

  let completed = 0
  let failed = 0
  const startMs = Date.now()
  let storyIdx = 0

  for (let chapter = lowestChapter; chapter <= highestChapter; chapter++) {
    const chapterStr = `Genki I Ch.${chapter}`

    for (let storyNum = 1; storyNum <= storiesPerChapter; storyNum++) {
      storyIdx++
      if (cancelled) break

      let saved = false

      for (let attempt = 1; attempt <= MAX_ATTEMPTS && !saved && !cancelled; attempt++) {
        const attemptTag = attempt > 1 ? ` [retry ${attempt - 1}/${MAX_ATTEMPTS - 1}]` : ''
        const prefix = `[${storyIdx}/${total} — Ch.${chapter} story ${storyNum}${attemptTag}]`
        const t0 = Date.now()

        // Step 1: suggest topic
        process.stdout.write(`${prefix}  Suggesting topic...`)
        let topic: string
        try {
          let resp = await fetch(`${backendUrl}/suggest-topic`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chapter: chapterStr }),
            signal: AbortSignal.timeout(15_000),
          })
          if (resp.status === 429) {
            process.stdout.write(' (cooldown, retrying in 3s...)')
            await new Promise(r => setTimeout(r, 3_000))
            resp = await fetch(`${backendUrl}/suggest-topic`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chapter: chapterStr }),
              signal: AbortSignal.timeout(15_000),
            })
          }
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
          const data = await resp.json() as { topic: string }
          topic = data.topic?.trim() ?? ''
          if (!topic) throw new Error('Empty topic returned')
          process.stdout.write(`  "${topic.slice(0, 70)}"\n`)
        } catch (e) {
          process.stdout.write('\n')
          console.log(`${prefix}  ✗ suggest-topic: ${e instanceof Error ? e.message : e}`)
          continue
        }

        // Step 2: phase 1 — English proposal
        console.log(`${prefix}  Generating English story...`)
        let proposalText: string
        try {
          const url1 = `${backendUrl}/run_sse?` + new URLSearchParams({
            runId: crypto.randomUUID(),
            chapter: chapterStr,
            pathMode: 'B',
            topic,
            steeringInstructions: '',
            temperature: String(temperature),
            grammar_distribution: String(grammarDist),
            target_word_count: String(targetWordCount),
          }).toString()

          const events1 = await streamSSE(url1)
          const finished1 = events1.find(e => e.type === 'RUN_FINISHED' && e.resultType === 'proposal')
          if (!finished1) {
            const errEv = events1.find(e => e.type === 'ERROR')
            throw new Error((errEv?.message as string | undefined) ?? 'no RUN_FINISHED(proposal) received')
          }
          proposalText = (finished1.content as string | undefined) ?? ''
          if (!proposalText) throw new Error('Empty proposal content')
        } catch (e) {
          console.log(`${prefix}  ✗ phase 1: ${e instanceof Error ? e.message : e}`)
          continue
        }

        // Step 3: phase 2 — Japanese conversion
        console.log(`${prefix}  Converting to Japanese...`)
        let storyJsonRaw: string
        try {
          const url2 = `${backendUrl}/run_sse?` + new URLSearchParams({
            runId: crypto.randomUUID(),
            chapter: chapterStr,
            pathMode: 'B',
            englishDraft: proposalText,
            steeringInstructions: '',
            temperature: String(temperature),
            grammar_distribution: String(grammarDist),
          }).toString()

          const events2 = await streamSSE(url2)
          const finished2 = events2.find(e => e.type === 'RUN_FINISHED' && e.resultType === 'story')
          if (!finished2) {
            const errEv = events2.find(e => e.type === 'ERROR')
            throw new Error((errEv?.message as string | undefined) ?? 'no RUN_FINISHED(story) received')
          }
          storyJsonRaw = (finished2.content as string | undefined) ?? ''
          if (!storyJsonRaw) throw new Error('Empty story content')
        } catch (e) {
          console.log(`${prefix}  ✗ phase 2: ${e instanceof Error ? e.message : e}`)
          continue
        }

        // Step 4: inject attribution
        const storyJson = injectAttribution(storyJsonRaw, author, licenseName)

        // Step 5: 8-stage client-side validation
        const validationErrors: ValidationError[] = validateStoryJson(storyJson)
        if (validationErrors.length > 0) {
          console.log(`${prefix}  ✗ validation failed (${validationErrors.length} error${validationErrors.length === 1 ? '' : 's'}):`)
          for (const err of validationErrors.slice(0, 3)) {
            const si = err.sentenceIndex !== undefined ? ` [sentence ${err.sentenceIndex}]` : ''
            console.log(`     • ${err.rule}${si}: ${err.message}`)
          }
          continue
        }

        // Step 6: loadStory contract test (NFR11)
        try {
          loadStory(storyJson)
        } catch (e) {
          const msg = e instanceof LoaderError ? e.message : String(e)
          console.log(`${prefix}  ✗ loadStory contract: ${msg}`)
          continue
        }

        // Step 7: save
        try {
          const outPath = saveStory(storyJson, outputDir)
          const elapsed = ((Date.now() - t0) / 1000).toFixed(0)
          console.log(`${prefix}  ✓ ${outPath.split(/[\\/]/).pop()} (${elapsed}s)`)
          saved = true
        } catch (e) {
          console.log(`${prefix}  ✗ save failed: ${e instanceof Error ? e.message : e}`)
          continue
        }
      }

      if (saved) completed++
      else failed++
    }

    if (cancelled) break
  }

  // Final summary
  const totalS = (Date.now() - startMs) / 1000
  console.log('='.repeat(60))
  console.log(`Done.  ✓ ${completed} saved   ✗ ${failed} failed`)
  console.log(`Total time: ${Math.floor(totalS / 60)}m ${Math.floor(totalS % 60)}s`)
  console.log(`Output:     ${outputDir}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
