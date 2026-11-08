# ADR 007: Installable PWA with Full Offline Precache

**Status:** Accepted
**Date:** 2026-11-08
**Supersedes:** the "Offline capability: not supported in v1" decision in
`_bmad-output/planning-artifacts/architecture.md`

## Context

v1 deferred offline support to "future mobile app iterations", with the PRD naming
Capacitor-style native wrappers as the Growth route. The same PRD asks for the opposite:
NFR6 requires the app to stay fully functional regardless of network state, and Journey 5
describes reading through a tunnel. In practice the web app worked offline only while its
tab stayed alive. A reload, a closed tab or an unopened story all failed.

The native route has real costs for a solo, open-source project:
- an Apple developer account at $99 a year, plus Play
- a Mac for iOS builds, while development happens on Windows
- app review, including the risk of rejection under guideline 4.2 ("minimum functionality")
- a store release for every content or code change, where merging to `main` deploys today

The whole offline payload is small, about 4 MB including fonts, dictionary data and all 31
stories, and every content file is static JSON served from `public/`.

## Decision

Make `apps/web` an **installable PWA** using **vite-plugin-pwa** (Workbox `generateSW`):

- **Precache everything**: app shell, fonts, `vocab.json`, `kanji-data.json`,
  `stories/manifest.json` and every story file. The whole library is available offline after
  the first online visit.
- **Navigation fallback** to `/index.html`, so deep links work offline. `/_vercel/*` is
  denylisted.
- **`registerType: 'prompt'`.** Updates wait for the reader's choice and are never applied
  by an automatic reload.
- **Budget:** the default precache stays at or under 10 MB. Beyond that, stories move to
  runtime `CacheFirst` caching. **Large optional assets** (for example a future full
  dictionary) must be **opt-in downloads stored outside the Workbox precache**, so they don't
  burden every visitor.
- **Constraints that keep a native wrapper cheap later:**
  1. The service worker is a transparent cache only. App code uses plain `fetch()` and
     works identically without it.
  2. Registration happens only in `registerServiceWorker()` (`src/lib/pwa.ts`), in
     production builds only.
  3. Persistence stays behind `indexedDbService`.
- No `vercel.json` rewrite change is needed, because Vercel serves static files before the
  SPA rewrite. An explicit `Cache-Control: no-cache` header on `/sw.js` pins update behaviour.

## Consequences

**Positive**
- NFR6 and Journey 5 are met properly, including across reloads and app restarts.
- The app is installable on Android, desktop Chromium and iOS (Add to Home Screen).
- No store accounts, no Mac and no review. Deploys stay "merge to `main`".
- Content updates arrive with app updates and stay consistent: per-file revision hashes
  ensure a story and the vocabulary it references come from the same deploy.

**Negative / accepted trade-offs**
- Every visitor downloads about 4 MB in the background after first render, whether or not
  they install.
- iOS has no install prompt, no Web Share Target and no local scheduled notifications, and
  background audio is unreliable there.
- A stale-version risk is inherent to service workers. It is mitigated by the update prompt
  and the `sw.js` header.

**Revisit a native wrapper (Capacitor) when any of these become real needs:**
- App Store or Play distribution. Play alone could use a Trusted Web Activity instead.
- iOS "Open in…" or share-sheet handling of story files.
- Local reading reminders without a push backend.
- Reliable background audio with lock-screen controls, for the planned audio feature.
- A downloaded library large enough that browser storage eviction matters.

A wrapper reuses the same build. Its service worker registration is disabled through the
guard above, because the binary ships the assets.

## References

- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-11-08.md`
- `_bmad-output/planning-artifacts/supp-epic-4-pwa.md`
- PRD FR45–FR47, NFR6
