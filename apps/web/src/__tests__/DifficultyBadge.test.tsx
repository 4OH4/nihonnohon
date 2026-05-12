import { render, screen } from '@testing-library/react'
import { DifficultyBadge } from '@/components/DifficultyBadge'

describe('DifficultyBadge', () => {
  it('renders the difficulty string as text content', () => {
    render(<DifficultyBadge difficulty="Genki I Ch.6" />)
    expect(screen.getByText('Genki I Ch.6')).toBeInTheDocument()
  })

  it('has aria-label matching the difficulty string', () => {
    render(<DifficultyBadge difficulty="JLPT N4" />)
    expect(screen.getByLabelText('JLPT N4')).toBeInTheDocument()
  })

  it('applies accent-subtle background and accent border styling', () => {
    render(<DifficultyBadge difficulty="Genki I Ch.6" />)
    const badge = screen.getByText('Genki I Ch.6')
    expect(badge).toHaveClass('bg-accent-subtle')
    expect(badge).toHaveClass('border-accent')
  })

  it('renders as a rounded pill (rounded-full)', () => {
    render(<DifficultyBadge difficulty="JLPT N3" />)
    const badge = screen.getByText('JLPT N3')
    expect(badge).toHaveClass('rounded-full')
  })
})
