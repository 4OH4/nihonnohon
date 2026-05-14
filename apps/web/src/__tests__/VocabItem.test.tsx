import { describe, it, expect, afterEach } from 'vitest'
import { render, fireEvent, screen, act } from '@testing-library/react'
import { VocabItem } from '@/components/VocabItem'
import { VocabPanel } from '@/components/VocabPanel'
import { useLookupStore } from '@/stores/lookupStore'
import type { VocabEntry, VocabSupplementEntry } from '@nihonnohon/schema'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const entry: VocabEntry = {
  id: -1,
  word: '食べ物',
  reading: 'たべもの',
  meaning: 'food',
  lesson: 'supplement',
}

const otherEntry: VocabEntry = {
  id: -2,
  word: '水',
  reading: 'みず',
  meaning: 'water',
  lesson: 'supplement',
}

afterEach(() => {
  act(() => { useLookupStore.getState()._reset() })
})

// ─── VocabItem ────────────────────────────────────────────────────────────────

describe('VocabItem', () => {
  it('renders word, reading, and translation', () => {
    render(<VocabItem entry={entry} />)
    expect(screen.getByText('食べ物')).toBeInTheDocument()
    expect(screen.getByText('たべもの')).toBeInTheDocument()
    expect(screen.getByText('food')).toBeInTheDocument()
  })

  it('tap calls lookup with entry and sentenceId=null', () => {
    render(<VocabItem entry={entry} />)
    fireEvent.click(screen.getByRole('button'))
    const state = useLookupStore.getState()
    expect(state.lookupState).toEqual({ status: 'found', word: '食べ物', entry })
    expect(state.selectedSentenceId).toBeNull()
  })

  it('Enter key triggers lookup', () => {
    render(<VocabItem entry={entry} />)
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' })
    expect(useLookupStore.getState().lookupState).toEqual({
      status: 'found', word: '食べ物', entry,
    })
  })

  it('Space key triggers lookup', () => {
    render(<VocabItem entry={entry} />)
    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' })
    expect(useLookupStore.getState().lookupState).toEqual({
      status: 'found', word: '食べ物', entry,
    })
  })

  it('applies accent-subtle bg when this word is active', () => {
    act(() => { useLookupStore.getState().lookup('食べ物', entry, null) })
    const { container } = render(<VocabItem entry={entry} />)
    expect(container.firstChild).toHaveClass('bg-accent-subtle')
  })

  it('does not apply active bg when a different word is in lookupState', () => {
    act(() => { useLookupStore.getState().lookup('水', otherEntry, null) })
    const { container } = render(<VocabItem entry={entry} />)
    expect(container.firstChild).not.toHaveClass('bg-accent-subtle')
  })

  it('does not apply active bg in idle state', () => {
    const { container } = render(<VocabItem entry={entry} />)
    expect(container.firstChild).not.toHaveClass('bg-accent-subtle')
  })
})

// ─── VocabPanel ──────────────────────────────────────────────────────────────

describe('VocabPanel', () => {
  const keywords: VocabSupplementEntry[] = [
    { key: 1000, word: '猫', hiragana: 'ねこ', translation: 'cat' },
    { key: 1001, word: '犬', hiragana: 'いぬ', translation: 'dog' },
  ]
  const supplement: VocabSupplementEntry[] = [
    { key: 1002, word: '魚', hiragana: 'さかな', translation: 'fish' },
  ]

  it('shows empty state when both keywords and supplement are empty', () => {
    render(<VocabPanel keywords={undefined} vocabSupplement={[]} />)
    expect(screen.getByText('No vocabulary defined for this story.')).toBeInTheDocument()
  })

  it('shows empty state when keywords is empty array and supplement is empty', () => {
    render(<VocabPanel keywords={[]} vocabSupplement={[]} />)
    expect(screen.getByText('No vocabulary defined for this story.')).toBeInTheDocument()
  })

  it('renders keyword entries', () => {
    render(<VocabPanel keywords={keywords} vocabSupplement={[]} />)
    expect(screen.getByText('猫')).toBeInTheDocument()
    expect(screen.getByText('犬')).toBeInTheDocument()
  })

  it('renders supplement entries', () => {
    render(<VocabPanel keywords={undefined} vocabSupplement={supplement} />)
    expect(screen.getByText('魚')).toBeInTheDocument()
  })

  it('keywords appear before supplement entries', () => {
    render(<VocabPanel keywords={keywords} vocabSupplement={supplement} />)
    const buttons = screen.getAllByRole('button')
    // First two rows are keywords, third is supplement
    expect(buttons[0]).toHaveTextContent('猫')
    expect(buttons[1]).toHaveTextContent('犬')
    expect(buttons[2]).toHaveTextContent('魚')
  })

  it('tapping a keyword entry updates InfoPanel (sentenceId is null)', () => {
    render(<VocabPanel keywords={keywords} vocabSupplement={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /猫/ }))
    const state = useLookupStore.getState()
    expect(state.lookupState.status).toBe('found')
    expect(state.selectedSentenceId).toBeNull()
  })
})
