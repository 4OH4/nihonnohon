import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'paper-bg':       '#FDF6E3',
        'paper-text':     '#1C1C1C',
        surface:          '#FFFFFF',
        'surface-subtle': '#F5F5F0',
        accent:           '#C8A85A',
        'accent-subtle':  '#F5EDD6',
        muted:            '#6B6B6B',
        border:           '#E0D8C8',
        error:            '#C0392B',
        translation:      '#4A7B9D',
        success:          '#22C55E',
        warning:          '#F59E0B',
      },
      fontFamily: {
        ja: ['Noto Sans JP', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
