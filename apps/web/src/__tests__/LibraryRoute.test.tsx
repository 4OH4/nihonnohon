// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LibraryRoute, LibraryError } from '@/routes/LibraryRoute'
import type { ManifestEntry } from '@/utils/storyManifest'
import type { StoryModel } from '@nihonnohon/schema'

// ─── AC Tracking ─────────────────────────────────────────────────────────────
// PRESERVED (Story 3.2 — all 10 tests unchanged):
//   - renders all manifest entries as story cards
//   - source filter narrows results to matching stories
//   - chapter filter further narrows within a source
//   - selecting All source shows all stories
//   - hides the chapter filter when source is All
//   - shows the chapter filter when a specific source is selected
//   - resets chapter to All when source changes
//   - shows empty state when no stories match the filter
//   - reset filter button shows all stories again
//   - LibraryError renders the error message
//
// NEW (Story 3.4):
//   - "Load a story from your device" button is always visible (not just in empty state)
//   - valid file upload: calls saveStory and navigates to /read/:uuid
//   - SCHEMA_INVALID shows inline error with hint and spec link
//   - UNSUPPORTED_VERSION shows inline error
//   - PARSE_FAILED shows inline error
//
// NEW (se4-3 — install link above the upload button):
//   - 'prompt': "Install app" shows before "Load a story from your device"; click prompts once, then hides
//   - 'prompt': after a cancel, Chrome's fresh event shows it again and is never cleared by the old one
//   - 'prompt': a rejected prompt() also hides the link
//   - 'ios': "Add to Home Screen" toggles the instruction and aria-expanded
//   - standalone: no install link, even with a deferred event stored
//   - none: no install link; the upload button is still present

// ─── Mock react-router-dom ────────────────────────────────────────────────────

vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...mod,
    useLoaderData: vi.fn(),
    useRouteError: vi.fn(),
    useRevalidator: vi.fn(),
    useNavigate: vi.fn(),
  }
})

// ─── Mock story-loader ────────────────────────────────────────────────────────

vi.mock('@nihonnohon/story-loader', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@nihonnohon/story-loader')>()
  return { ...mod, loadStory: vi.fn() }
})

// ─── Mock indexedDbService ────────────────────────────────────────────────────

vi.mock('@/services/indexedDbService', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/services/indexedDbService')>()
  return { ...mod, saveStory: vi.fn().mockResolvedValue(undefined) }
})

// ─── Mock FileReader ──────────────────────────────────────────────────────────

const mockFileReader = {
  readAsText: vi.fn(),
  onload: null as ((e: ProgressEvent<FileReader>) => void) | null,
  result: null as string | null,
}
vi.stubGlobal('FileReader', vi.fn(() => mockFileReader))

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { useLoaderData, useRouteError, useRevalidator, useNavigate } from 'react-router-dom'
import { loadStory, LoaderError } from '@nihonnohon/story-loader'
import { saveStory } from '@/services/indexedDbService'
import { usePwaStore, type BeforeInstallPromptEvent } from '@/stores/pwaStore'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const fixtures: ManifestEntry[] = [
  {
    id: 'story-a',
    filename: 'a.json',
    title: 'Story A',
    titleJa: 'A',
    language: 'Japanese',
    description: 'Description A.',
    difficulty: 'Genki I Ch.6',
  },
  {
    id: 'story-b',
    filename: 'b.json',
    title: 'Story B',
    titleJa: 'B',
    language: 'Japanese',
    description: 'Description B.',
    difficulty: 'Genki I Ch.7',
  },
  {
    id: 'story-c',
    filename: 'c.json',
    title: 'Story C',
    titleJa: 'C',
    language: 'Japanese',
    description: 'Description C.',
    difficulty: 'JLPT N4',
  },
]

const baseStory: StoryModel = {
  schemaVersion: '1',
  id: 'test',
  title: 'Test',
  titleJa: 'テスト',
  language: 'Japanese',
  difficulty: null,
  description: 'Test story.',
  keywords: [],
  grammar: [],
  vocabSupplement: [],
  metadata: {},
  sentences: [],
}

function renderLibrary(entries: ManifestEntry[] = fixtures, navigate = vi.fn()) {
  vi.mocked(useLoaderData).mockReturnValue(entries)
  vi.mocked(useRevalidator).mockReturnValue({ revalidate: vi.fn(), state: 'idle' })
  vi.mocked(useNavigate).mockReturnValue(navigate)
  return render(
    <MemoryRouter>
      <LibraryRoute />
    </MemoryRouter>,
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function simulateFileLoad(text: string) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  const file = new File([text], 'story.json', { type: 'application/json' })
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  fireEvent.change(input)
  await act(async () => {
    mockFileReader.result = text
    if (mockFileReader.onload) {
      await mockFileReader.onload({ target: mockFileReader } as unknown as ProgressEvent<FileReader>)
    }
  })
}

// ─── Setup / Teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  mockFileReader.readAsText.mockReset()
  mockFileReader.onload = null
  mockFileReader.result = null
  // Capture onload when readAsText is called
  mockFileReader.readAsText.mockImplementation(() => {
    // onload will be called by simulateFileLoad
  })
})

afterEach(() => {
  vi.clearAllMocks()
  usePwaStore.getState()._reset()
})

// ─── LibraryRoute — Existing Tests (PRESERVED from Story 3.2) ────────────────

describe('LibraryRoute', () => {
  it('renders all manifest entries as story cards', () => {
    renderLibrary()
    expect(screen.getByText('Story A')).toBeInTheDocument()
    expect(screen.getByText('Story B')).toBeInTheDocument()
    expect(screen.getByText('Story C')).toBeInTheDocument()
  })

  it('source filter narrows results to matching stories', () => {
    renderLibrary()
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'JLPT' } })
    expect(screen.getByText('Story C')).toBeInTheDocument()
    expect(screen.queryByText('Story A')).not.toBeInTheDocument()
    expect(screen.queryByText('Story B')).not.toBeInTheDocument()
  })

  it('chapter filter further narrows within a source', () => {
    renderLibrary()
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'Genki I' } })
    fireEvent.change(screen.getByLabelText('Chapter'), { target: { value: 'Ch.7' } })
    expect(screen.getByText('Story B')).toBeInTheDocument()
    expect(screen.queryByText('Story A')).not.toBeInTheDocument()
  })

  it('selecting All source shows all stories', () => {
    renderLibrary()
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'JLPT' } })
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'All' } })
    expect(screen.getByText('Story A')).toBeInTheDocument()
    expect(screen.getByText('Story B')).toBeInTheDocument()
    expect(screen.getByText('Story C')).toBeInTheDocument()
  })

  it('hides the chapter filter when source is All', () => {
    renderLibrary()
    expect(screen.queryByLabelText('Chapter')).not.toBeInTheDocument()
  })

  it('shows the chapter filter when a specific source is selected', () => {
    renderLibrary()
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'Genki I' } })
    expect(screen.getByLabelText('Chapter')).toBeInTheDocument()
  })

  it('resets chapter to All when source changes', () => {
    renderLibrary()
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'Genki I' } })
    fireEvent.change(screen.getByLabelText('Chapter'), { target: { value: 'Ch.7' } })
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'Genki I' } })
    expect(screen.getByText('Story A')).toBeInTheDocument()
    expect(screen.getByText('Story B')).toBeInTheDocument()
  })

  it('shows empty state when no stories match the filter', () => {
    const single: ManifestEntry[] = [
      {
        id: 'only',
        filename: 'only.json',
        title: 'Only Story',
        titleJa: 'オンリー',
        language: 'Japanese',
        description: 'The only story.',
        difficulty: 'Genki I Ch.1',
      },
    ]
    renderLibrary(single)
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'Genki I' } })
    fireEvent.change(screen.getByLabelText('Chapter'), { target: { value: 'Ch.6' } })
    expect(screen.getByText('No stories found for this selection.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset filter' })).toBeInTheDocument()
    // Upload button is always visible (below the conditional block)
    expect(screen.getByRole('button', { name: 'Load a story from your device' })).toBeInTheDocument()
  })

  it('reset filter button shows all stories again', () => {
    renderLibrary()
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'JLPT' } })
    fireEvent.change(screen.getByLabelText('Chapter'), { target: { value: 'N5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reset filter' }))
    expect(screen.getByText('Story A')).toBeInTheDocument()
    expect(screen.getByText('Story B')).toBeInTheDocument()
    expect(screen.getByText('Story C')).toBeInTheDocument()
  })
})

// ─── LibraryError ─────────────────────────────────────────────────────────────

describe('LibraryError', () => {
  it('renders the error message', () => {
    vi.mocked(useRouteError).mockReturnValue(new Error('Network error'))
    vi.mocked(useRevalidator).mockReturnValue({ revalidate: vi.fn(), state: 'idle' })
    render(
      <MemoryRouter>
        <LibraryError />
      </MemoryRouter>,
    )
    expect(screen.getByText(/Couldn't load the story library/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

// ─── File Upload Tests (NEW — Story 3.4) ─────────────────────────────────────

describe('LibraryRoute — file upload', () => {
  it('"Load a story from your device" button is always visible when stories are present', () => {
    renderLibrary()
    expect(screen.getByRole('button', { name: 'Load a story from your device' })).toBeInTheDocument()
  })

  it('valid file upload: calls saveStory and navigates to /read/:uuid', async () => {
    const mockNavigate = vi.fn()
    vi.mocked(loadStory).mockReturnValue(baseStory)

    renderLibrary(fixtures, mockNavigate)
    await simulateFileLoad('{"schema_version":"1","id":"t"}')

    expect(vi.mocked(saveStory)).toHaveBeenCalledWith(
      expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-/),
      expect.any(Object),
    )
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/^\/read\//))
  })

  it('SCHEMA_INVALID: shows inline error with title, AJV hint, and spec link', async () => {
    vi.mocked(loadStory).mockImplementation(() => {
      throw new LoaderError(
        'SCHEMA_INVALID',
        'Story JSON failed schema validation: data/sentences/0/words must be array',
      )
    })

    renderLibrary()
    await simulateFileLoad('{"schema_version":"1"}')

    expect(screen.getByText("This doesn't look like a valid Nihon no Hon story.")).toBeInTheDocument()
    expect(screen.getByText(/data\/sentences\/0\/words must be array/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View the story format documentation' })).toBeInTheDocument()
  })

  it('UNSUPPORTED_VERSION: shows inline error', async () => {
    vi.mocked(loadStory).mockImplementation(() => {
      throw new LoaderError('UNSUPPORTED_VERSION', 'Unsupported schema version: "99".')
    })

    renderLibrary()
    await simulateFileLoad('{"schema_version":"99"}')

    expect(screen.getByText("This story uses a format version this app doesn't support.")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View the story format documentation' })).toBeInTheDocument()
  })

  it('PARSE_FAILED: shows inline error', async () => {
    vi.mocked(loadStory).mockImplementation(() => {
      throw new LoaderError('PARSE_FAILED', 'Story JSON could not be parsed.')
    })

    renderLibrary()
    await simulateFileLoad('not valid json {{{')

    expect(screen.getByText("This file couldn't be read as a story.")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View the story format documentation' })).toBeInTheDocument()
  })
})

// ─── LibraryRoute — install link (NEW in se4-3) ──────────────────────────────

/** A stand-in for Chromium's deferred BeforeInstallPromptEvent. */
function fakeInstallEvent(prompt: () => Promise<void> = async () => {}) {
  let resolveChoice!: (choice: { outcome: 'accepted' | 'dismissed'; platform: string }) => void
  const userChoice = new Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>((r) => {
    resolveChoice = r
  })
  const event = Object.assign(new Event('beforeinstallprompt'), {
    prompt: vi.fn(prompt),
    userChoice,
  }) as BeforeInstallPromptEvent & { prompt: ReturnType<typeof vi.fn> }
  return { event, resolveChoice }
}

const UPLOAD_BUTTON = { name: 'Load a story from your device' }

describe('LibraryRoute — install link', () => {
  it("'prompt': shows Install app above the upload button; prompts once and hides after the choice", async () => {
    const { event, resolveChoice } = fakeInstallEvent()
    usePwaStore.setState({ installPrompt: event })
    renderLibrary()

    const install = screen.getByRole('button', { name: 'Install app' })
    const upload = screen.getByRole('button', UPLOAD_BUTTON)
    expect(install.compareDocumentPosition(upload) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(install).toHaveClass('text-sm', 'underline', 'text-muted')

    fireEvent.click(install)
    // prompt() runs synchronously inside the click, before any await.
    expect(event.prompt).toHaveBeenCalledTimes(1)

    await act(async () => resolveChoice({ outcome: 'dismissed', platform: '' }))

    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument()
    expect(usePwaStore.getState().installPrompt).toBeNull()
    expect(screen.getByRole('button', UPLOAD_BUTTON)).toBeInTheDocument()
  })

  it("'prompt': after a cancel, Chrome's fresh install event keeps the link", async () => {
    const { event, resolveChoice } = fakeInstallEvent()
    usePwaStore.setState({ installPrompt: event })
    renderLibrary()

    fireEvent.click(screen.getByRole('button', { name: 'Install app' }))
    await act(async () => resolveChoice({ outcome: 'dismissed', platform: '' }))
    const fresh = fakeInstallEvent().event
    act(() => usePwaStore.getState().setInstallPrompt(fresh))

    expect(screen.getByRole('button', { name: 'Install app' })).toBeInTheDocument()
    expect(usePwaStore.getState().installPrompt).toBe(fresh)
  })

  it("'prompt': a fresh event that arrives before the choice settles is not cleared", async () => {
    const { event, resolveChoice } = fakeInstallEvent()
    usePwaStore.setState({ installPrompt: event })
    renderLibrary()

    fireEvent.click(screen.getByRole('button', { name: 'Install app' }))
    const fresh = fakeInstallEvent().event
    act(() => usePwaStore.getState().setInstallPrompt(fresh))
    await act(async () => resolveChoice({ outcome: 'dismissed', platform: '' }))

    expect(usePwaStore.getState().installPrompt).toBe(fresh)
    expect(screen.getByRole('button', { name: 'Install app' })).toBeInTheDocument()
  })

  it("'prompt': a rejected prompt() also hides the link", async () => {
    const { event } = fakeInstallEvent(async () => {
      throw new DOMException('already used', 'InvalidStateError')
    })
    usePwaStore.setState({ installPrompt: event })
    renderLibrary()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Install app' }))
    })

    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument()
    expect(usePwaStore.getState().installPrompt).toBeNull()
  })

  it("'ios': Add to Home Screen toggles the instruction and aria-expanded", () => {
    usePwaStore.setState({ iosInstallable: true })
    renderLibrary()

    const link = screen.getByRole('button', { name: 'Add to Home Screen' })
    expect(link.compareDocumentPosition(screen.getByRole('button', UPLOAD_BUTTON)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(link).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Tap Share, then Add to Home Screen')).not.toBeInTheDocument()

    fireEvent.click(link)
    expect(link).toHaveAttribute('aria-expanded', 'true')
    const help = screen.getByText('Tap Share, then Add to Home Screen')
    expect(link).toHaveAttribute('aria-controls', help.id)

    fireEvent.click(link)
    expect(link).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Tap Share, then Add to Home Screen')).not.toBeInTheDocument()
  })

  it('standalone: no install link, even with a deferred event stored', () => {
    usePwaStore.setState({ standalone: true, installPrompt: fakeInstallEvent().event, iosInstallable: true })
    renderLibrary()

    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add to Home Screen' })).not.toBeInTheDocument()
  })

  it('none: no install link, and the upload button is still the first control in its block', () => {
    renderLibrary()

    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add to Home Screen' })).not.toBeInTheDocument()
    const upload = screen.getByRole('button', UPLOAD_BUTTON)
    // No empty wrapper is left behind: the upload button opens the mt-8 footer block, as before.
    expect(upload.parentElement).toHaveClass('mt-8')
    expect(upload.parentElement!.firstElementChild).toBe(upload)
  })
})
