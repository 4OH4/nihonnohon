import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PreferenceStoreState {
  rubyVisible: boolean
  spacingVisible: boolean
  transVisible: boolean
  textSize: 'small' | 'medium' | 'large'
  activeTab: 'story' | 'vocabulary' | 'grammar'
}

export const usePreferenceStore = create<PreferenceStoreState>()(
  persist(
    (): PreferenceStoreState => ({
      rubyVisible: true,
      spacingVisible: false,
      transVisible: false,
      textSize: 'medium',
      activeTab: 'story',
    }),
    { name: 'nihonnohon-preferences' },
  ),
)
