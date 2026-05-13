import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LibraryRoute, LibraryError } from '@/routes/LibraryRoute'
import type { ManifestEntry } from '@/utils/storyManifest'

// ─── Mock react-router-dom ────────────────────────────────────────────────────

vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...mod,
    useLoaderData: vi.fn(),
    useRouteError: vi.fn(),
    useRevalidator: vi.fn(),
  }
})

import { useLoaderData, useRouteError, useRevalidator } from 'react-router-dom'

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

function renderLibrary(entries: ManifestEntry[] = fixtures) {
  vi.mocked(useLoaderData).mockReturnValue(entries)
  return render(
    <MemoryRouter>
      <LibraryRoute />
    </MemoryRouter>,
  )
}

// ─── LibraryRoute ─────────────────────────────────────────────────────────────

describe('LibraryRoute', () => {
  beforeEach(() => {
    vi.mocked(useRevalidator).mockReturnValue({ revalidate: vi.fn(), state: 'idle' })
  })

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
    // First narrow to JLPT, then reset to All
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
    // Change source — chapter should reset and both Genki I stories shown
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'Genki I' } })
    expect(screen.getByText('Story A')).toBeInTheDocument()
    expect(screen.getByText('Story B')).toBeInTheDocument()
  })

  it('shows empty state when no stories match the filter', () => {
    // Single-story manifest — select a different source
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
    expect(screen.getByRole('button', { name: 'Load a story from your device' })).toBeInTheDocument()
  })

  it('reset filter button shows all stories again', () => {
    renderLibrary()
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'JLPT' } })
    fireEvent.change(screen.getByLabelText('Chapter'), { target: { value: 'N5' } }) // no match
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
