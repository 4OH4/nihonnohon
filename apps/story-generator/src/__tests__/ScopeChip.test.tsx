import { render, screen } from '@testing-library/react'
import { ScopeChip } from '../components/ScopeChip'

describe('ScopeChip', () => {
  it('renders nothing when chapter is empty string', () => {
    const { container } = render(<ScopeChip chapter="" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for an unknown chapter key', () => {
    const { container } = render(<ScopeChip chapter="Genki I Ch.99" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders vocab count for a known chapter', () => {
    render(<ScopeChip chapter="Genki I Ch.6" />)
    expect(screen.getByText('325 vocab')).toBeInTheDocument()
  })

  it('renders grammar count for a known chapter', () => {
    render(<ScopeChip chapter="Genki I Ch.6" />)
    expect(screen.getByText('33 grammar')).toBeInTheDocument()
  })

  it('grammar highlights span uses font-ja class', () => {
    const { container } = render(<ScopeChip chapter="Genki I Ch.6" />)
    const highlightsEl = container.querySelector('.font-ja')
    expect(highlightsEl).toBeInTheDocument()
    expect(highlightsEl?.textContent).toContain('て形')
  })

  it('renders correctly for Genki II chapters', () => {
    render(<ScopeChip chapter="Genki II Ch.13" />)
    expect(screen.getByText('657 vocab')).toBeInTheDocument()
    expect(screen.getByText('70 grammar')).toBeInTheDocument()
  })

  it('updates immediately when chapter prop changes', () => {
    const { rerender } = render(<ScopeChip chapter="Genki I Ch.1" />)
    expect(screen.getByText('56 vocab')).toBeInTheDocument()
    rerender(<ScopeChip chapter="Genki I Ch.12" />)
    expect(screen.getByText('602 vocab')).toBeInTheDocument()
  })
})
