// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { describe, it, expect, beforeEach } from 'vitest'
import { usePreferenceStore } from '@/stores/preferenceStore'

const DEFAULT_STATE = {
  rubyVisible: true,
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
  it('has correct default values', () => {
    const state = usePreferenceStore.getState()
    expect(state.rubyVisible).toBe(true)
    expect(state.spacingVisible).toBe(false)
    expect(state.transVisible).toBe(false)
    expect(state.textSize).toBe('medium')
    expect(state.activeTab).toBe('story')
  })

  it('setRubyVisible updates only rubyVisible', () => {
    usePreferenceStore.getState().setRubyVisible(false)
    const state = usePreferenceStore.getState()
    expect(state.rubyVisible).toBe(false)
    // Other fields unchanged
    expect(state.spacingVisible).toBe(false)
    expect(state.transVisible).toBe(false)
    expect(state.textSize).toBe('medium')
    expect(state.activeTab).toBe('story')
  })

  it('setSpacingVisible updates only spacingVisible', () => {
    usePreferenceStore.getState().setSpacingVisible(true)
    expect(usePreferenceStore.getState().spacingVisible).toBe(true)
    expect(usePreferenceStore.getState().rubyVisible).toBe(true)
  })

  it('setTransVisible updates only transVisible', () => {
    usePreferenceStore.getState().setTransVisible(true)
    expect(usePreferenceStore.getState().transVisible).toBe(true)
    expect(usePreferenceStore.getState().rubyVisible).toBe(true)
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
    usePreferenceStore.getState().setRubyVisible(false)
    const stored = JSON.parse(localStorage.getItem('nihonnohon-preferences')!)
    expect(stored.state.rubyVisible).toBe(false)
  })

  it('localStorage contains only state fields, not setter functions', () => {
    usePreferenceStore.getState().setRubyVisible(false)
    const stored = JSON.parse(localStorage.getItem('nihonnohon-preferences')!)
    expect(typeof stored.state.setRubyVisible).not.toBe('function')
    expect(Object.keys(stored.state)).toEqual(
      expect.arrayContaining(['rubyVisible', 'spacingVisible', 'transVisible', 'textSize', 'activeTab'])
    )
    expect(Object.keys(stored.state)).toHaveLength(5)
  })
})
