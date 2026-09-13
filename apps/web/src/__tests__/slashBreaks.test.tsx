// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

// Issue #27 — "/" is not a line-break opportunity in CSS, so glosses like
// "cold (thing/people)" used to break mid-word. withSlashBreaks inserts <wbr> to give
// the browser somewhere better to break.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { withSlashBreaks } from '@/lib/slashBreaks'

function renderGloss(text: string) {
  return render(<span>{withSlashBreaks(text)}</span>)
}

describe('withSlashBreaks', () => {
  // The identity fast path is what keeps ~98% of glosses rendering an identical DOM,
  // which is why the existing pixel baselines and panel measurements do not move.
  describe('returns the string unchanged when no slash qualifies', () => {
    it.each([
      ['a gloss with no slash at all', 'cafeteria; dining commons'],
      ['an empty string (KanjiBreakdown\'s ?? "" fallback)', ''],
      ['a slash with nothing before it', '/leading'],
      ['a slash with nothing after it', 'trailing/'],
    ])('%s', (_label, text) => {
      expect(withSlashBreaks(text)).toBe(text)
    })

    // Fractions read as a single token — "1/" + "10 bu" would be worse than not wrapping.
    it.each(['1/10 bu', 'second (1/60 minute)', '8 1/3lbs', 'division (x/3)', 'shaku/100'])(
      'leaves the fraction %s intact',
      (text) => {
        expect(withSlashBreaks(text)).toBe(text)
      },
    )

    // A space is already a break opportunity, so a <wbr> beside one is a node that can
    // never be used. vocab.json's only spaced slash.
    it('skips a slash that already has whitespace beside it', () => {
      const text = 'to take (amount of time / money)'
      expect(withSlashBreaks(text)).toBe(text)
    })
  })

  describe('inserts a break opportunity after a qualifying slash', () => {
    it('breaks the longest slashed kanji keyword', () => {
      const { container } = renderGloss('mountain peak/mountain pass')
      expect(container.querySelectorAll('wbr')).toHaveLength(1)
    })

    it('breaks after punctuation as well as letters', () => {
      const { container } = renderGloss('Mr./Ms....')
      expect(container.querySelectorAll('wbr')).toHaveLength(1)
    })

    it('breaks at every qualifying slash', () => {
      const { container } = renderGloss('one/two/three')
      expect(container.querySelectorAll('wbr')).toHaveLength(2)
    })

    it('keeps the slash on the line above the break', () => {
      const { container } = renderGloss('public chamber/hall')
      const wbr = container.querySelector('wbr') as HTMLElement
      expect(wbr.previousSibling?.textContent).toBe('public chamber/')
      expect(wbr.nextSibling?.textContent).toBe('hall')
    })
  })

  // The regression test for the constraint that makes this safe to drop into existing
  // components: <wbr> contributes no characters, and Testing Library's getNodeText joins
  // only *direct* child text nodes. Wrapping a segment in an element would keep the page
  // looking right while silently breaking every getByText() on a slashed gloss.
  it('stays queryable by its full text, with the segments as direct children', () => {
    const { container } = renderGloss('cold (thing/people)')
    expect(screen.getByText('cold (thing/people)')).toBeInTheDocument()
    expect(container.querySelector('wbr')).toBeInTheDocument()
    expect(container.firstChild?.textContent).toBe('cold (thing/people)')
    // No element between the text and its parent.
    expect(container.querySelector('span > span')).toBeNull()
  })
})
