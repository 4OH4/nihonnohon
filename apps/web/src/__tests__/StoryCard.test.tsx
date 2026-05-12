import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { StoryCard } from '@/components/StoryCard'
import type { ManifestEntry } from '@/utils/storyManifest'

const entry: ManifestEntry = {
  id: 'test-story',
  filename: 'test-story.json',
  title: 'Test Story',
  titleJa: 'テスト',
  difficulty: 'Genki I Ch.6',
  language: 'Japanese',
  description: 'A test description for this story.',
}

function renderCard(e: ManifestEntry) {
  return render(
    <MemoryRouter>
      <StoryCard entry={e} />
    </MemoryRouter>,
  )
}

describe('StoryCard', () => {
  it('renders the English title', () => {
    renderCard(entry)
    expect(screen.getByText('Test Story')).toBeInTheDocument()
  })

  it('renders the Japanese title with lang="ja"', () => {
    renderCard(entry)
    const titleJa = screen.getByText('テスト')
    expect(titleJa).toBeInTheDocument()
    expect(titleJa).toHaveAttribute('lang', 'ja')
  })

  it('renders the description', () => {
    renderCard(entry)
    expect(screen.getByText('A test description for this story.')).toBeInTheDocument()
  })

  it('links to /read/:id', () => {
    renderCard(entry)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/read/test-story')
  })

  it('renders DifficultyBadge when difficulty is present', () => {
    renderCard(entry)
    expect(screen.getByText('Genki I Ch.6')).toBeInTheDocument()
  })

  it('does not render DifficultyBadge when difficulty is null', () => {
    renderCard({ ...entry, difficulty: null })
    expect(screen.queryByText('Genki I Ch.6')).not.toBeInTheDocument()
  })

  it('does not render DifficultyBadge when difficulty is undefined', () => {
    const { difficulty: _d, ...entryNoDiff } = entry
    renderCard(entryNoDiff as ManifestEntry)
    expect(screen.queryByText('Genki I Ch.6')).not.toBeInTheDocument()
  })
})
