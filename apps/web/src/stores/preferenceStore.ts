import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PreferenceStoreState {
  rubyVisible: boolean
  spacingVisible: boolean
  transVisible: boolean
  textSize: 'small' | 'medium' | 'large'
  activeTab: 'story' | 'vocabulary' | 'grammar'
  setRubyVisible: (v: boolean) => void
  setSpacingVisible: (v: boolean) => void
  setTransVisible: (v: boolean) => void
  setTextSize: (size: 'small' | 'medium' | 'large') => void
  setActiveTab: (tab: 'story' | 'vocabulary' | 'grammar') => void
}

export const usePreferenceStore = create<PreferenceStoreState>()(
  persist(
    (set): PreferenceStoreState => ({
      rubyVisible: true,
      spacingVisible: false,
      transVisible: false,
      textSize: 'medium',
      activeTab: 'story',
      setRubyVisible: (v) => set({ rubyVisible: v }),
      setSpacingVisible: (v) => set({ spacingVisible: v }),
      setTransVisible: (v) => set({ transVisible: v }),
      setTextSize: (size) => set({ textSize: size }),
      setActiveTab: (tab) => set({ activeTab: tab }),
    }),
    {
      name: 'nihonnohon-preferences',
      partialize: (state) => ({
        rubyVisible: state.rubyVisible,
        spacingVisible: state.spacingVisible,
        transVisible: state.transVisible,
        textSize: state.textSize,
        activeTab: state.activeTab,
      }),
    },
  ),
)
