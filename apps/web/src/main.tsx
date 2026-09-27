// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import React from 'react'
import ReactDOM from 'react-dom/client'
// Noto Sans JP, self-hosted, replacing a runtime Google Fonts <link>.
//
// Two axes are deliberately narrowed, both on measured numbers.
//
// Weights: only 400 and 600 — the two Japanese text actually renders at (400
// throughout, 600 for the looked-up word in InfoPanel). The link this replaces
// asked for 400/500/700: it shipped a weight nothing uses and omitted the one used
// most, leaving 600 to be synthesised from a neighbour.
//
// Subsets: the consolidated 'japanese' and 'latin' ranges rather than the
// all-subsets entry point. That one splits CJK into 120 numbered chunks per weight
// and pulls in cyrillic, greek and vietnamese as well — 12.96MB of emitted font
// files against 2.08MB for these four, for a reading app that needs neither those
// scripts nor 120 round trips to cover a story. 'latin' is 13KB and keeps digits
// and romaji inside a font-ja element in the same face as the Japanese around them.
import '@fontsource/noto-sans-jp/japanese-400.css'
import '@fontsource/noto-sans-jp/latin-400.css'
import '@fontsource/noto-sans-jp/japanese-600.css'
import '@fontsource/noto-sans-jp/latin-600.css'
import App from '@/App'
import '@/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
