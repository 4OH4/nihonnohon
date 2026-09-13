// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { describe, it, expect, beforeEach } from 'vitest'
import { usePreferenceStore } from '@/stores/preferenceStore'

/**
 * The store's pristine defaults, captured at import time before any beforeEach mutates them.
 * localStorage is empty at module load, so this is the real out-of-the-box state.
 */
const INITIAL_STATE = { ...usePreferenceStore.getState() }

/**
 * Per-test baseline. Deliberately `rubyMode: 'all'` rather than the store's `'supplement'`
 * default: assertions here are about the setters, and 'all' keeps them independent of which
 * mode ships as the default.
 */
const DEFAULT_STATE = {
  rubyMode: 'all' as const,
  spacingVisible: false,
  transVisible: false,
  textSize: 'medium' as const,
  activeTab: 'story' as const,
}

beforeEach(() => {
  localStorage.clear()
  usePreferenceStore.setState(DEFAULT_STATE)
})

describe('usePreferenceStore', () => {
  // Asserted against the import-time capture, not getState(): beforeEach has already
  // overwritten the live state with DEFAULT_STATE by the time this runs.
  it('has correct default values, with ruby defaulting to supplement', () => {
    expect(INITIAL_STATE.rubyMode).toBe('supplement')
    expect(INITIAL_STATE.spacingVisible).toBe(false)
    expect(INITIAL_STATE.transVisible).toBe(false)
    expect(INITIAL_STATE.textSize).toBe('medium')
    expect(INITIAL_STATE.activeTab).toBe('story')
  })

  it('setRubyMode updates only rubyMode', () => {
    usePreferenceStore.getState().setRubyMode('none')
    const state = usePreferenceStore.getState()
    expect(state.rubyMode).toBe('none')
    // Other fields unchanged
    expect(state.spacingVisible).toBe(false)
    expect(state.transVisible).toBe(false)
    expect(state.textSize).toBe('medium')
    expect(state.activeTab).toBe('story')
  })

  it('setRubyMode accepts all three modes', () => {
    for (const mode of ['all', 'supplement', 'none'] as const) {
      usePreferenceStore.getState().setRubyMode(mode)
      expect(usePreferenceStore.getState().rubyMode).toBe(mode)
    }
  })

  it('setSpacingVisible updates only spacingVisible', () => {
    usePreferenceStore.getState().setSpacingVisible(true)
    expect(usePreferenceStore.getState().spacingVisible).toBe(true)
    expect(usePreferenceStore.getState().rubyMode).toBe('all')
  })

  it('setTransVisible updates only transVisible', () => {
    usePreferenceStore.getState().setTransVisible(true)
    expect(usePreferenceStore.getState().transVisible).toBe(true)
    expect(usePreferenceStore.getState().rubyMode).toBe('all')
  })

  it('setTextSize accepts small, medium, and large', () => {
    usePreferenceStore.getState().setTextSize('small')
    expect(usePreferenceStore.getState().textSize).toBe('small')
    usePreferenceStore.getState().setTextSize('large')
    expect(usePreferenceStore.getState().textSize).toBe('large')
    usePreferenceStore.getState().setTextSize('medium')
    expect(usePreferenceStore.getState().textSize).toBe('medium')
  })

  it('setActiveTab accepts all three tab values', () => {
    usePreferenceStore.getState().setActiveTab('vocabulary')
    expect(usePreferenceStore.getState().activeTab).toBe('vocabulary')
    usePreferenceStore.getState().setActiveTab('grammar')
    expect(usePreferenceStore.getState().activeTab).toBe('grammar')
    usePreferenceStore.getState().setActiveTab('story')
    expect(usePreferenceStore.getState().activeTab).toBe('story')
  })

  it('changed preference is written to localStorage', () => {
    usePreferenceStore.getState().setRubyMode('none')
    const stored = JSON.parse(localStorage.getItem('nihonnohon-preferences')!)
    expect(stored.state.rubyMode).toBe('none')
  })

  it('localStorage contains only state fields, not setter functions', () => {
    usePreferenceStore.getState().setRubyMode('none')
    const stored = JSON.parse(localStorage.getItem('nihonnohon-preferences')!)
    expect(typeof stored.state.setRubyMode).not.toBe('function')
    expect(Object.keys(stored.state)).toEqual(
      expect.arrayContaining(['rubyMode', 'spacingVisible', 'transVisible', 'textSize', 'activeTab'])
    )
    // Still 5 — also guards that the legacy `rubyVisible` key is really gone.
    expect(Object.keys(stored.state)).toHaveLength(5)
  })
})
