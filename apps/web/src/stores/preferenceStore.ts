// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Furigana display mode.
 * - `all` — ruby above every annotated word
 * - `supplement` — ruby only above words in the story's vocab supplement, i.e. words outside
 *   the standard Genki curriculum
 * - `none` — no ruby (the selected word still shows its own; see WordToken)
 */
export type RubyMode = 'all' | 'supplement' | 'none'

interface PreferenceStoreState {
  rubyMode: RubyMode
  spacingVisible: boolean
  transVisible: boolean
  textSize: 'small' | 'medium' | 'large'
  activeTab: 'story' | 'vocabulary' | 'grammar'
  setRubyMode: (mode: RubyMode) => void
  setSpacingVisible: (v: boolean) => void
  setTransVisible: (v: boolean) => void
  setTextSize: (size: 'small' | 'medium' | 'large') => void
  setActiveTab: (tab: 'story' | 'vocabulary' | 'grammar') => void
}

export const usePreferenceStore = create<PreferenceStoreState>()(
  persist(
    (set): PreferenceStoreState => ({
      // Default to 'supplement': readers working at their own level know the Genki vocab and
      // mainly need readings for words outside it (issue #33).
      rubyMode: 'supplement',
      spacingVisible: false,
      transVisible: false,
      textSize: 'medium',
      activeTab: 'story',
      setRubyMode: (mode) => set({ rubyMode: mode }),
      setSpacingVisible: (v) => set({ spacingVisible: v }),
      setTransVisible: (v) => set({ transVisible: v }),
      setTextSize: (size) => set({ textSize: size }),
      setActiveTab: (tab) => set({ activeTab: tab }),
    }),
    {
      name: 'nihonnohon-preferences',
      partialize: (state) => ({
        rubyMode: state.rubyMode,
        spacingVisible: state.spacingVisible,
        transVisible: state.transVisible,
        textSize: state.textSize,
        activeTab: state.activeTab,
      }),
    },
  ),
)
