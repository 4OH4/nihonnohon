// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AppBar } from '@/components/AppBar'

/** Credits and data attribution page. */
export function CreditsRoute() {
  useEffect(() => {
    const prev = document.title
    document.title = 'Credits — Nihon no Hon'
    return () => { document.title = prev }
  }, [])

  return (
    <div className="flex flex-col min-h-dvh bg-paper-bg">
      <AppBar variant="library" />
      <main className="flex-1 p-6 max-w-2xl mx-auto w-full">
        <h1 className="text-paper-text text-xl font-semibold mb-6">Credits</h1>

        <section className="mb-8">
          <h2 className="text-paper-text font-semibold mb-2">Vocabulary Data</h2>
          <p className="text-muted text-sm leading-relaxed">
            Vocabulary data is derived from{' '}
            <em>Genki: An Integrated Course in Elementary Japanese</em>{' '}
            by Eri Banno, Yoko Ikeda, Yutaka Ohno, Chikako Shinagawa, and Kyoko Tokashiki,
            published by The Japan Times. All rights remain with the original copyright holders.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-paper-text font-semibold mb-2">Kanji Data</h2>
          <p className="text-muted text-sm leading-relaxed">
            Kanji data sourced from{' '}
            <a
              href="https://kanjiapi.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              kanjiapi.dev
            </a>
            , which aggregates data from the KANJIDIC2 project.
            KANJIDIC2 is released under a Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0) licence.
          </p>
        </section>

        <Link to="/" className="text-sm text-muted underline">
          ← Back to library
        </Link>
      </main>
    </div>
  )
}
