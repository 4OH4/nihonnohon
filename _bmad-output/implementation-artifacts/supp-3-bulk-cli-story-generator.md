# Story Supp-3: Bulk CLI Story Generator Script

Status: done

## Story

As a content author (RT),
I want a command-line TypeScript script that bulk-generates stories by calling the backend sequentially without UI interaction,
so that I can populate the story library for multiple Genki chapters in one unattended run.

## Acceptance Criteria

**AC1 — Interactive configuration with defaults:**
Given `pnpm bulk-generate` is run from the monorepo root,
when the script starts,
then it prompts for each option in order — pressing Enter accepts the default in brackets:
- `Stories per chapter [1]:`
- `Highest chapter [23]:`
- `Author name []:`
- `License [CC BY 4.0]:`
- `Target word count [300]:`
- `Grammar distribution (0=limited, 1=balanced, 2=use many) [2]:`
- `Temperature [1.0]:`
- `Output directory [apps/web/public/stories]:`
- `Backend URL [http://localhost:8000]:`

After all prompts the script prints a one-line summary and generation begins (no further input required).

**AC2 — Sequential generation via Path B:**
Given configuration is accepted,
when the generation loop runs,
then for each (chapter × story-number) combination in order:
1. `POST /suggest-topic` with `{ "chapter": "Genki I Ch.N" }` — if 429 (cooldown), waits 3 seconds and retries once; any other error marks the story as failed and continues.
2. `GET /run_sse` (phase 1) with `pathMode=B`, `topic`, `chapter`, `temperature`, `grammar_distribution`, `target_word_count` — streams until `RUN_FINISHED(resultType='proposal')`, `ERROR`, or `RUN_CANCELLED`; `AGENT_STATUS` events are silently consumed.
3. `GET /run_sse` (phase 2) with `pathMode=B`, `englishDraft`, `chapter`, `temperature`, `grammar_distribution` — streams until `RUN_FINISHED(resultType='story')`, `ERROR`, or `RUN_CANCELLED`.

If any step produces an error event or throws, the story is marked failed and the loop continues.

**AC3 — Attribution injection:**
Given `RUN_FINISHED(resultType='story')` content is received,
when the story JSON is post-processed,
then these fields are injected before validation:
- `author` — configured author if non-empty
- `source` — always `"Generated using the 日本の本 AI Story Authoring Tool"`
- `license` — configured license name if non-empty
- `license_url` — resolved from the built-in preset map: `"CC BY 4.0"` → `https://creativecommons.org/licenses/by/4.0/`; `"CC BY-NC 4.0"` → `https://creativecommons.org/licenses/by-nc/4.0/`; other values leave `license_url` unset

The re-serialised JSON (indent 2, no ASCII escaping) is what is validated and saved.

**AC4 — Validation via imported function:**
Given the story JSON with attribution injected,
when `validateStoryJson(json)` is called (imported from `apps/story-generator/src/lib/validateStoryJson.ts`),
then any returned errors cause the story to be marked failed; up to 3 errors are printed; the loop continues.

**AC5 — loadStory contract test (optional):**
Given validation passes,
when `loadStory` from `@nihonnohon/story-loader` is available (package already built),
then `loadStory(json)` is called; a `LoaderError` marks the story as failed with the error message printed; if the import fails (package not built), the contract test is silently skipped with a one-time startup warning.

**AC6 — File save (UTF-8 no BOM):**
Given validation (and optional contract test) passes,
when the file is written,
then it is saved to `{outputDir}/{id}.json` as UTF-8 without BOM via `fs.writeFileSync(path, content, 'utf8')`; if the filename already exists, the suffix `-2`, `-3` etc. is appended until an unused name is found.

**AC7 — Progress display and graceful cancellation:**
Given generation is running,
when the user watches the terminal,
then:
- Each story attempt prints its prefix `[N/T — Ch.X story Y]` followed by the current action (`Suggesting topic...`, `Generating English story...`, `Converting to Japanese...`).
- Outcome is printed as `✓ {filename} ({X}s)` on success or `✗ {short error}` on failure.
- After each story a compact progress bar is printed: `█████░░░░░ 42% (5/12) — ETA 3m 10s`.
- `Ctrl+C` sets a cancellation flag; the current story completes normally; the loop stops before starting the next story.
- A final summary is printed: `Done. ✓ N saved  ✗ N failed  Total time: Xm Ys`.

**AC8 — No backend changes, one package.json change:**
The script is a pure HTTP client; it only calls existing `/suggest-topic`, `/run_sse`, and (optionally at startup) `/health` endpoints. The only repo change beyond the new script is adding `"bulk-generate": "tsx scripts/bulk_generate.ts"` to the root `package.json` scripts.

## Tasks / Subtasks

- [ ] Add `"bulk-generate": "tsx scripts/bulk_generate.ts"` to root `package.json` scripts
- [ ] Create `scripts/bulk_generate.ts` (see Dev Notes for complete implementation)
  - [ ] Config prompt loop using `readline/promises`
  - [ ] Startup health check and optional `loadStory` availability check
  - [ ] `streamSSE(url, timeoutMs)` — native fetch + ReadableStream SSE parser
  - [ ] `injectAttribution(raw, author, licenseName)` — inline 10-line helper
  - [ ] Validation via imported `validateStoryJson` (no porting required)
  - [ ] Optional `loadStory` contract test
  - [ ] `saveStory(json, outputDir)` — UTF-8 no BOM, collision suffix
  - [ ] Generation loop with `process.on('SIGINT', ...)` cancellation handler
  - [ ] Progress bar and ETA display
  - [ ] Summary output

---

## Dev Notes

### Why TypeScript (not Python)

The validation logic already exists as `validateStoryJson.ts` — importing it eliminates a parallel implementation that could drift. `loadStory()` from `@nihonnohon/story-loader` is available to run the real NFR11 contract test. `tsx` is already in root devDependencies (`^4.0.0`) and the `build-vocab` / `build-kanji` scripts already use the same pattern. Node 18+ ships native `fetch` — no extra packages needed at all.

---

### Invocation

```bash
# From monorepo root — after adding the script to package.json:
pnpm bulk-generate

# Or directly without the script alias:
pnpm tsx scripts/bulk_generate.ts
```

No new packages. `tsx` resolves `.ts` imports at runtime; `fetch` is native in Node 18+.

---

### File location and pattern

```
scripts/
  build-vocab.ts       ← existing pattern
  build-kanji.ts       ← existing pattern
  bulk_generate.ts     ← new file, same pattern
```

---

### Imports

```typescript
// Node stdlib — no extra packages
import * as readline from 'node:readline/promises'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { stdin as input, stdout as output } from 'node:process'

// Imported from app source — tsx resolves .ts directly, no build step needed
// validateStoryJson.ts has zero imports itself (pure TypeScript logic)
import { validateStoryJson, type ValidationError } from '../apps/story-generator/src/lib/validateStoryJson.js'
```

`validateStoryJson.ts` imports nothing — it is a pure TypeScript module. tsx resolves the `.js` extension to the `.ts` source at runtime (standard tsx convention; use `.js` extension in the import even though the file is `.ts`).

---

### loadStory — optional contract test

`@nihonnohon/story-loader` exports from `dist/` (built by tsup). Import it dynamically so the script degrades gracefully if the package hasn't been built yet:

```typescript
type LoadStoryFn = (json: string) => unknown

let loadStory: LoadStoryFn | null = null
try {
  const mod = await import('@nihonnohon/story-loader')
  loadStory = mod.loadStory as LoadStoryFn
} catch {
  console.warn('  ⚠  @nihonnohon/story-loader not available — skipping loadStory contract test')
  console.warn('     Run `pnpm build --filter @nihonnohon/story-loader` to enable it.\n')
}
```

This check happens once at startup. When `loadStory` is available, call it after `validateStoryJson` passes:

```typescript
if (loadStory) {
  try {
    loadStory(storyJson)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log(`${prefix}  ✗ loadStory contract: ${msg}`)
    failed++
    continue
  }
}
```

---

### Config prompts

```typescript
const rl = readline.createInterface({ input, output })

async function prompt(question: string, defaultVal: string): Promise<string> {
  const answer = (await rl.question(`  ${question} [${defaultVal}]: `)).trim()
  return answer || defaultVal
}

// Numeric helpers with re-prompt on bad input
async function promptInt(question: string, defaultVal: number): Promise<number> {
  while (true) {
    const raw = await prompt(question, String(defaultVal))
    const n = parseInt(raw, 10)
    if (!isNaN(n) && n > 0) return n
    console.log('  Please enter a positive integer.')
  }
}

async function promptFloat(question: string, defaultVal: number): Promise<number> {
  while (true) {
    const raw = await prompt(question, String(defaultVal))
    const n = parseFloat(raw)
    if (!isNaN(n) && n >= 0) return n
    console.log('  Please enter a number ≥ 0.')
  }
}
```

Close the interface before generation starts: `rl.close()`.

---

### SSE streaming with native fetch

```typescript
interface SSEEvent { type: string; [key: string]: unknown }

async function streamSSE(url: string, timeoutMs = 120_000): Promise<SSEEvent[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const resp = await fetch(url, { signal: controller.signal })
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`)
    if (!resp.body) throw new Error('No response body')

    const events: SSEEvent[] = []
    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    outer: while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''   // keep incomplete last line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const event = JSON.parse(line.slice(6)) as SSEEvent
          events.push(event)
          if (['RUN_FINISHED', 'ERROR', 'RUN_CANCELLED'].includes(event.type)) {
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
```

`timeout=(10, 120)` equivalent here: the `AbortController` covers the total stream duration. The `fetch` connection timeout is handled by the underlying Node HTTP stack (5 s default in Node 22+; adequate for localhost).

---

### SSE URL construction

```typescript
function buildSSEUrl(backendUrl: string, params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString()
  return `${backendUrl}/run_sse?${qs}`
}

// Phase 1 params
const phase1Params: Record<string, string> = {
  runId: crypto.randomUUID(),
  chapter: chapterStr,
  pathMode: 'B',
  topic,
  steeringInstructions: '',
  temperature: String(temperature),
  grammar_distribution: String(grammarDist),
  target_word_count: String(targetWordCount),
}

// Phase 2 params
const phase2Params: Record<string, string> = {
  runId: crypto.randomUUID(),
  chapter: chapterStr,
  pathMode: 'B',
  englishDraft: proposalText,
  steeringInstructions: '',
  temperature: String(temperature),
  grammar_distribution: String(grammarDist),
}
```

`crypto.randomUUID()` is available globally in Node 18+.

---

### Attribution injection

Mirrors `injectAttribution()` in `authoringStore.ts` — inline, no import needed (the store has React deps we want to avoid):

```typescript
const LICENSE_URL_MAP: Record<string, string> = {
  'CC BY 4.0':    'https://creativecommons.org/licenses/by/4.0/',
  'CC BY-NC 4.0': 'https://creativecommons.org/licenses/by-nc/4.0/',
}
const ATTRIBUTION_SOURCE = 'Generated using the 日本の本 AI Story Authoring Tool'

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
```

(Cannot import directly from `authoringStore.ts` — it pulls in Zustand, React, and Vite-specific code.)

---

### File save

```typescript
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
  // Node writeFileSync with 'utf8' writes no BOM on any platform
  writeFileSync(outPath, storyJson + '\n', 'utf8')
  return outPath
}
```

---

### Cancellation

```typescript
let cancelled = false
process.on('SIGINT', () => {
  cancelled = true
  process.stdout.write(
    '\n  Cancellation requested — completing current story then stopping...\n'
  )
})
```

Check `cancelled` at the top of the inner loop before starting a new story. Never interrupt mid-story — let each story run to completion (or error).

---

### Progress bar

```typescript
function progressBar(done: number, total: number, elapsedS: number): string {
  const BAR = 38
  const filled = total > 0 ? Math.floor(BAR * done / total) : 0
  const bar = '█'.repeat(filled) + '░'.repeat(BAR - filled)
  const pct = total > 0 ? Math.round(done / total * 100) : 0
  let eta = '—'
  if (elapsedS > 0 && done > 0 && done < total) {
    const etaS = (total - done) / (done / elapsedS)
    eta = `${Math.floor(etaS / 60)}m ${Math.floor(etaS % 60)}s`
  }
  return `  ${bar} ${pct}% (${done}/${total}) — ETA ${eta}`
}
```

---

### Complete script skeleton

```typescript
#!/usr/bin/env tsx
// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT
/**
 * Bulk story generator for nihonnohon.
 *
 * Calls the story-generator backend sequentially via Path B (topic →
 * English proposal → Japanese story) for every Genki chapter up to a
 * configured maximum.
 *
 * Usage:
 *   pnpm bulk-generate
 *   pnpm tsx scripts/bulk_generate.ts
 *
 * Requires: pnpm build --filter @nihonnohon/story-loader  (for loadStory contract test; optional)
 */
import * as readline from 'node:readline/promises'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { stdin as input, stdout as output } from 'node:process'

import { validateStoryJson, type ValidationError } from '../apps/story-generator/src/lib/validateStoryJson.js'

// ── Types ────────────────────────────────────────────────────────────────────

interface SSEEvent { type: string; [key: string]: unknown }
type LoadStoryFn = (json: string) => unknown

// ── Constants ────────────────────────────────────────────────────────────────

const LICENSE_URL_MAP: Record<string, string> = {
  'CC BY 4.0':    'https://creativecommons.org/licenses/by/4.0/',
  'CC BY-NC 4.0': 'https://creativecommons.org/licenses/by-nc/4.0/',
}
const ATTRIBUTION_SOURCE = 'Generated using the 日本の本 AI Story Authoring Tool'

// ── Cancellation ─────────────────────────────────────────────────────────────

let cancelled = false
process.on('SIGINT', () => {
  cancelled = true
  process.stdout.write('\n  Cancellation requested — completing current story then stopping...\n')
})

// ── Helpers: prompts ─────────────────────────────────────────────────────────

// (promptInt, promptFloat, prompt — as shown in Dev Notes above)

// ── Helpers: SSE ─────────────────────────────────────────────────────────────

// (streamSSE — as shown in Dev Notes above)

// ── Helpers: attribution ─────────────────────────────────────────────────────

// (injectAttribution — as shown in Dev Notes above)

// ── Helpers: save ────────────────────────────────────────────────────────────

// (saveStory — as shown in Dev Notes above)

// ── Helpers: progress ────────────────────────────────────────────────────────

// (progressBar — as shown in Dev Notes above)

function printProgress(completed: number, failed: number, total: number, startMs: number): void {
  const elapsed = (Date.now() - startMs) / 1000
  console.log(progressBar(completed + failed, total, elapsed))
  console.log()
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n=== nihonnohon Bulk Story Generator ===\n')
  console.log('Press Enter to accept defaults.\n')

  const rl = readline.createInterface({ input, output })
  // (config prompts — as shown in Dev Notes above)
  rl.close()

  // Optional loadStory contract test
  let loadStory: LoadStoryFn | null = null
  // (dynamic import with try/catch — as shown in Dev Notes above)

  // Optional health check
  try {
    const hr = await fetch(`${backendUrl}/health`, { signal: AbortSignal.timeout(5000) })
    if (!hr.ok) console.warn(`  ⚠  Backend responded ${hr.status} — proceeding anyway.\n`)
  } catch {
    console.warn('  ⚠  Backend unreachable at startup — proceeding anyway.\n')
  }

  mkdirSync(outputDir, { recursive: true })

  const total = storiesPerChapter * highestChapter
  console.log(`\nWill generate ${total} stories (${storiesPerChapter} × Ch.1–${highestChapter}).`)
  console.log(`Output → ${outputDir}\n`)
  console.log('Ctrl+C to cancel gracefully after current story.\n')
  console.log('-'.repeat(60))

  let completed = 0
  let failed = 0
  const startMs = Date.now()
  let storyIdx = 0

  for (let chapter = 1; chapter <= highestChapter; chapter++) {
    const chapterStr = `Genki I Ch.${chapter}`

    for (let storyNum = 1; storyNum <= storiesPerChapter; storyNum++) {
      storyIdx++
      if (cancelled) break

      const prefix = `[${storyIdx}/${total} — Ch.${chapter} story ${storyNum}]`
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
          await new Promise(r => setTimeout(r, 3000))
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
        console.log(`  "${topic.slice(0, 70)}"`)
      } catch (e) {
        console.log(`\n${prefix}  ✗ suggest-topic: ${e instanceof Error ? e.message : e}`)
        failed++
        printProgress(completed, failed, total, startMs)
        continue
      }

      // Step 2: phase 1 — English proposal
      console.log(`${prefix}  Generating English story...`)
      let proposalText: string
      try {
        const url1 = `${backendUrl}/run_sse?` + new URLSearchParams({
          runId: crypto.randomUUID(),
          chapter: chapterStr, pathMode: 'B', topic,
          steeringInstructions: '',
          temperature: String(temperature),
          grammar_distribution: String(grammarDist),
          target_word_count: String(targetWordCount),
        }).toString()
        const events1 = await streamSSE(url1)
        const finished1 = events1.find(e => e.type === 'RUN_FINISHED' && e.resultType === 'proposal')
        if (!finished1) {
          const errEv = events1.find(e => e.type === 'ERROR')
          throw new Error((errEv?.message as string | undefined) ?? 'no proposal received')
        }
        proposalText = (finished1.content as string | undefined) ?? ''
        if (!proposalText) throw new Error('Empty proposal content')
      } catch (e) {
        console.log(`${prefix}  ✗ phase 1: ${e instanceof Error ? e.message : e}`)
        failed++
        printProgress(completed, failed, total, startMs)
        continue
      }

      // Step 3: phase 2 — Japanese conversion
      console.log(`${prefix}  Converting to Japanese...`)
      let storyJsonRaw: string
      try {
        const url2 = `${backendUrl}/run_sse?` + new URLSearchParams({
          runId: crypto.randomUUID(),
          chapter: chapterStr, pathMode: 'B',
          englishDraft: proposalText,
          steeringInstructions: '',
          temperature: String(temperature),
          grammar_distribution: String(grammarDist),
        }).toString()
        const events2 = await streamSSE(url2)
        const finished2 = events2.find(e => e.type === 'RUN_FINISHED' && e.resultType === 'story')
        if (!finished2) {
          const errEv = events2.find(e => e.type === 'ERROR')
          throw new Error((errEv?.message as string | undefined) ?? 'no story received')
        }
        storyJsonRaw = (finished2.content as string | undefined) ?? ''
        if (!storyJsonRaw) throw new Error('Empty story content')
      } catch (e) {
        console.log(`${prefix}  ✗ phase 2: ${e instanceof Error ? e.message : e}`)
        failed++
        printProgress(completed, failed, total, startMs)
        continue
      }

      // Step 4: inject attribution
      const storyJson = injectAttribution(storyJsonRaw, author, licenseName)

      // Step 5: validate (imported function — no port required)
      const validationErrors: ValidationError[] = validateStoryJson(storyJson)
      if (validationErrors.length > 0) {
        console.log(`${prefix}  ✗ validation failed (${validationErrors.length} errors):`)
        for (const err of validationErrors.slice(0, 3)) {
          const si = err.sentenceIndex !== undefined ? ` [sentence ${err.sentenceIndex}]` : ''
          console.log(`     • ${err.rule}${si}: ${err.message}`)
        }
        failed++
        printProgress(completed, failed, total, startMs)
        continue
      }

      // Step 6: loadStory contract test (if available)
      if (loadStory) {
        try {
          loadStory(storyJson)
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          console.log(`${prefix}  ✗ loadStory contract: ${msg}`)
          failed++
          printProgress(completed, failed, total, startMs)
          continue
        }
      }

      // Step 7: save
      try {
        const outPath = saveStory(storyJson, outputDir)
        const elapsed = ((Date.now() - t0) / 1000).toFixed(0)
        console.log(`${prefix}  ✓ ${outPath.split(/[\\/]/).pop()} (${elapsed}s)`)
        completed++
      } catch (e) {
        console.log(`${prefix}  ✗ save failed: ${e instanceof Error ? e.message : e}`)
        failed++
      }

      printProgress(completed, failed, total, startMs)
    }

    if (cancelled) break
  }

  // Summary
  const totalS = ((Date.now() - startMs) / 1000)
  console.log('\n' + '='.repeat(60))
  console.log(`Done.  ✓ ${completed} saved   ✗ ${failed} failed`)
  console.log(`Total time: ${Math.floor(totalS / 60)}m ${Math.floor(totalS % 60)}s`)
  console.log(`Output:     ${outputDir}`)
}

main().catch(e => { console.error(e); process.exit(1) })
```

---

### What the dev agent must fill in

The skeleton uses named variables that must be declared from the config prompts block:
- `storiesPerChapter`, `highestChapter`, `author`, `licenseName`, `targetWordCount`, `grammarDist`, `temperature`, `outputDir`, `backendUrl`

All helper functions (prompt, streamSSE, injectAttribution, saveStory, progressBar) are fully specified above and should be pasted in directly. The skeleton is pseudocode for structure; the Dev Notes sections contain the final implementations.

---

### Edge cases

- **EOF / non-TTY input**: wrap `rl.question()` in a try/catch for `EOFError` (e.g. piped input) — if caught, accept the default and close.
- **Windows terminal**: `process.stdout.write` with Unicode block characters (`█`, `░`) works in Windows Terminal and VS Code integrated terminal. Falls back to ASCII boxes in legacy `cmd.exe` — acceptable for a developer tool.
- **`outputDir` relative path**: `join(outputDir, ...)` resolves relative to `process.cwd()`. Document in the script header that it should be run from the monorepo root.
- **Node version**: requires Node 18+ for native `fetch` and `crypto.randomUUID()`. The monorepo already runs on Node 18+ (Vite 5 requires it).

---

### What this story does NOT do

- No `manifest.json` update — manual step after reviewing generated stories.
- No retry on generation failure — one attempt per story; failures are counted.
- No parallel generation — sequential only, consistent with the backend's single-worker model.

---

### References

- `scripts/build-vocab.ts` — existing script pattern (tsx, Node stdlib, same directory)
- `apps/story-generator/src/lib/validateStoryJson.ts` — imported directly (no porting)
- `apps/story-generator/src/stores/authoringStore.ts` — `LICENSE_PRESETS`, `injectAttribution` (inlined, not imported — Zustand/React deps)
- `apps/story-generator-backend/src/story_generator/main.py` — `/suggest-topic`, `/run_sse` params, SSE event shapes
- `apps/story-generator-backend/src/story_generator/agent.py` — `RUN_FINISHED.resultType` values, `AGENT_STATUS` event type
- `packages/schema/schemas/story.v1.json` — `author`, `source`, `license`, `license_url` as optional schema properties
- `apps/web/public/stories/genki-i-ch6-konbini-adventure.json` — example with attribution fields
- `docs/adr/004-agui-event-types.md` — AG-UI event contract
