import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

/** Helper: click upload button, wait for filechooser, set files. */
async function uploadBuffer(page: Page, name: string, content: Buffer | string) {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Load a story from your device' }).click(),
  ])
  await chooser.setFiles({
    name,
    mimeType: 'application/json',
    buffer: typeof content === 'string' ? Buffer.from(content) : content,
  })
}

test.describe('File upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('valid story file — reader loads', async ({ page }) => {
    const file = readFileSync(join(FIXTURE_DIR, 'valid-optional-absent.json'))
    await uploadBuffer(page, 'valid-optional-absent.json', file)
    // Reader should load — look for a sentence from the fixture
    await expect(page.getByRole('button', { name: 'こんにちは' })).toBeVisible()
  })

  test('invalid story (missing required field) — inline error with spec link', async ({ page }) => {
    const invalid = JSON.stringify({ schema_version: '1', id: 'x', title: 'T', title_ja: 'T', language: 'ja', description: 'd' })
    await uploadBuffer(page, 'invalid.json', invalid)
    await expect(page.getByText("This doesn't look like a valid Nihon no Hon story.")).toBeVisible()
    await expect(page.getByRole('link', { name: 'View the story format documentation' })).toBeVisible()
  })

  test('unsupported schema version — inline error', async ({ page }) => {
    const unsupported = JSON.stringify({
      schema_version: '99',
      id: 'x',
      title: 'T',
      title_ja: 'T',
      language: 'ja',
      description: 'd',
      sentences: [{ id: 's1', words: ['hi'], vocab_keys: [null] }],
      metadata: {},
    })
    await uploadBuffer(page, 'unsupported.json', unsupported)
    await expect(page.getByText("This story uses a format version this app doesn't support.")).toBeVisible()
  })

  test('malformed JSON — inline error', async ({ page }) => {
    await uploadBuffer(page, 'malformed.json', 'this is not json at all')
    await expect(page.getByText("This file couldn't be read as a story.")).toBeVisible()
  })

  test('optional-fields-absent story — reader loads normally', async ({ page }) => {
    const file = readFileSync(join(FIXTURE_DIR, 'valid-optional-absent.json'))
    await uploadBuffer(page, 'valid-optional-absent.json', file)
    // Reader should load — difficulty badge absent, ruby toggle visible but no-op
    await expect(page.getByRole('button', { name: 'こんにちは' })).toBeVisible()
    // No difficulty badge (story has no difficulty field)
    await expect(page.getByText('Genki')).not.toBeVisible()
  })
})
