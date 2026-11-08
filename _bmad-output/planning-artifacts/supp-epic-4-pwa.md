---
status: backlog
type: supplemental-epic
epic_id: supp-epic-4
created: "2026-11-08"
---

# Supplemental Epic 4: Installable PWA and Offline Library

## Overview

This epic makes the web reader (`apps/web`, deployed at www.nihonnohon.com) an
**installable Progressive Web App that works fully offline**, including the entire bundled
story library. After one online visit, a reader can launch the app from the home screen,
open any bundled story and look up words with no network connection.

It reverses the v1 decision to defer offline support to future native apps. A PWA delivers
the offline goal of the PRD's "mobile app wrappers" Growth item at a fraction of the cost.
A native wrapper (Capacitor) is not ruled out and stays an optional later layer over the
same build.

**References:**
- Change proposal: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-11-08.md`
- Decision record: `docs/adr/007-pwa-offline.md`
- Requirements: PRD FR45–FR47, NFR6 (amended 2026-11-08)
- UX: `ux-design-specification.md` → *Platform Strategy* and *App Install & Updates*
- Agent rules: `project-context.md` → *PWA & Offline*

---

## Background and Motivation

PRD NFR6 and Journey 5 already require the app to stay usable without a network. Today
that holds only while the tab stays alive. A reload, a closed tab, or opening a story that
was never fetched all fail offline. Installation (FR45) does not exist at all: there is no
manifest, no icons and no `theme-color`.

The alternative, Capacitor, needs App Store and Play accounts, a Mac for iOS builds (development
is on Windows), app review, and a store release for every content change. The PWA needs none
of those, and nearly all of it carries over if a native wrapper is ever added.

---

## Design Decisions

### Tooling

- **vite-plugin-pwa** with Workbox `generateSW` mode. It generates the service worker, the
  precache manifest (per-file revision hashes) and the web manifest from `vite.config.ts`.
- `registerType: 'prompt'`. A new version waits until the reader chooses to reload (FR47).
- `devOptions` stays **disabled**. There is no service worker under `vite` dev, so the existing
  Playwright suite (which runs on `vite`) is unaffected.

### Precache: the whole library (offline option "b")

- Globs: `**/*.{js,css,html,woff2,png,svg,ico,webmanifest,json}`. This covers the app shell,
  the Noto Sans JP woff2 files, `vocab.json`, `kanji-data.json`, `stories/manifest.json` and
  every `stories/*.json`.
- `navigateFallback: '/index.html'`, so deep links such as `/read/:storyId` work offline.
  `navigateFallbackDenylist: [/^\/_vercel\//]` keeps Vercel Analytics and Speed Insights
  out of it.
- Measured size on 2026-11-08 is about **4 MB**: JS 458 KB, fonts 2.08 MB, kanji-data 529 KB,
  vocab 167 KB, 31 stories 732 KB. Every file is under Workbox's 2 MiB per-file default.
- **Budget: ≤ 10 MB for the default precache.** If the library outgrows it, move
  `stories/*.json` to runtime `CacheFirst` caching. **Large optional assets** (for example a
  future full dictionary) are opt-in downloads stored outside the precache, never added to
  the globs.
- Content consistency: precached files are revisioned per deploy, so a story and the
  `vocab.json` it references always come from the same build. New or changed stories reach
  installed users through the normal update prompt.

### Constraints that keep a future native wrapper cheap

1. **The service worker is a transparent cache only.** App code keeps using plain `fetch()`
   and behaves identically without a service worker. It never reads Cache Storage and never
   messages the service worker for app logic.
2. **One guarded registration point:** `registerServiceWorker()` in `src/lib/pwa.ts`. It
   no-ops outside production builds (`import.meta.env.PROD`) and is the only place that
   touches `navigator.serviceWorker`. A native build or a test can disable it.
3. **Persistence stays behind `indexedDbService`**, so a native storage backend can replace it.

### Web manifest

| Field | Value |
|---|---|
| `name` / `short_name` | "Nihon no Hon" / "Nihon no Hon" |
| `description` | Same as the `index.html` meta description |
| `start_url` / `scope` | `/` / `/` |
| `display` | `standalone` |
| `theme_color` / `background_color` | `#FFFFFF` (`surface` token — matches the AppBar and mobile tab bar that the Android status and navigation bars border; changed from `paper-bg` 2026-11-08 after on-device testing) |
| `icons` | 192×192, 512×512, 512×512 `purpose: maskable` |
| `lang` | `en` |

### Vercel

- **No rewrite change.** Vercel serves real static files before the SPA catch-all rewrite.
  This was verified in production: `/vocab.json` returns `application/json`.
- Add a `headers` entry for `/sw.js` with `Cache-Control: no-cache`. Vercel already sends
  `max-age=0, must-revalidate`, and the header pins that behaviour against future defaults.

### Icons

No brand asset exists. Default artwork: the kanji **本** in `paper-text` (#1C1C1C) on a
`paper-bg` square with an `accent` (#C8A85A) rule beneath, drawn as SVG **paths** (not
live text) so it renders without the font. Keep it within the maskable safe zone (the
central 80%). The icon set is generated from that one source SVG with
`@vite-pwa/assets-generator`, so RT can swap the artwork later and regenerate.

---

## Components Affected

| Area | File(s) | Change |
|---|---|---|
| Build | `apps/web/vite.config.ts`, `apps/web/package.json` | Add `VitePWA({...})`; dev deps `vite-plugin-pwa`, `@vite-pwa/assets-generator` |
| HTML shell | `apps/web/index.html` | `theme-color`, `apple-touch-icon`, favicon, `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`, `apple-mobile-web-app-status-bar-style` |
| Icons | `apps/web/public/` (+ source SVG, e.g. `apps/web/pwa-assets/icon.svg`) | Generated icon set |
| Registration | `apps/web/src/lib/pwa.ts` (new), `apps/web/src/main.tsx` | Guarded registration; exposes update and install state to UI |
| UI | `apps/web/src/components/UpdatePrompt.tsx` (new), `SettingsMenu.tsx` | Update toast; install item |
| Deploy | `vercel.json` | `/sw.js` header |
| Tests | `apps/web/playwright.pwa.config.ts` (new), `apps/web/e2e-pwa/*.spec.ts` (new), `.github/workflows/ci.yml` | Offline E2E against `vite preview` (Chromium) |
| Docs | `docs/architecture-web.md`, `docs/development-guide.md` | Service worker overview; how to test a PWA locally |

---

## Story List

| Story ID | Title | Depends on | Can parallel |
|---|---|---|---|
| se4-1 | Web manifest, icons and service worker registration | — | — |
| se4-2 | Offline library precache and offline E2E | se4-1 | se4-3 |
| se4-3 | Update prompt and install entry point | se4-1 | se4-2 |

---

## Stories

---

### Story se4-1: Web Manifest, Icons and Service Worker Registration

As a **reader**,
I want to install Nihon no Hon to my home screen and launch it like an app,
So that the reader is one tap away and opens without browser chrome.

**Acceptance Criteria**

**Given** `vite-plugin-pwa` is configured in `apps/web/vite.config.ts`
**When** `pnpm build` runs
**Then** `dist/` contains `sw.js`, a Workbox runtime file and `manifest.webmanifest` with the
fields in *Web manifest* above, and the build log reports the precache entries and size

**Given** the icon source SVG
**When** the icon generator runs
**Then** `public/` contains 192, 512 and maskable-512 PNGs, a 180×180 `apple-touch-icon.png`
and a favicon, and the maskable icon keeps the glyph inside the central 80% safe zone

**Given** `index.html`
**Then** it links the manifest (injected by the plugin), favicon and apple-touch-icon, and
sets `theme-color` `#FDF6E3` and the `apple-mobile-web-app-*` meta tags

**Given** `src/lib/pwa.ts` exports `registerServiceWorker()`
**When** it is called from `main.tsx`
**Then** it registers the service worker only when `import.meta.env.PROD` is true, and no
other module references `navigator.serviceWorker`

**Given** `pnpm build && pnpm preview`
**When** opened in Chrome
**Then** DevTools → Application shows a valid manifest, an activated service worker and no
installability errors, and installing launches the app in a standalone window

**Given** the existing test suites
**Then** `pnpm test:unit` and `pnpm test:e2e` pass unchanged (no service worker under `vite` dev)

**Notes:** `registerServiceWorker()` should use `virtual:pwa-register` (`registerSW`) and keep
the `needRefresh` / `updateSW` handles available for se4-3, for example through a tiny Zustand
store `pwaStore.ts` following store conventions. Add the `vite-plugin-pwa/client` types
reference. Include a unit test that the guard no-ops when not in production.

---

### Story se4-2: Offline Library Precache and Offline E2E

As a **reader on patchy mobile signal**,
I want every bundled story and the dictionary available offline after my first visit,
So that I can open and read any story on a train or plane.

**Acceptance Criteria**

**Given** the Workbox config
**Then** `globPatterns` cover `**/*.{js,css,html,woff2,png,svg,ico,webmanifest,json}`,
`navigateFallback` is `/index.html` and `navigateFallbackDenylist` includes `/^\/_vercel\//`

**Given** `pnpm build`
**Then** the precache includes `vocab.json`, `kanji-data.json`, `stories/manifest.json`, every
`stories/*.json` and the Noto Sans JP woff2 files, and the total precache size is ≤ 10 MB

**Given** `vercel.json`
**Then** it contains a `headers` rule setting `Cache-Control: no-cache` on `/sw.js`, and the
SPA rewrite is unchanged

**Given** a Playwright config `playwright.pwa.config.ts` that builds and serves with
`vite preview`, with specs in `apps/web/e2e-pwa/`
**When** the spec loads `/` online, waits for the service worker to activate and control the
page, then calls `context.setOffline(true)`
**Then**, offline:
- reloading `/` renders the library listing every manifest story
- opening a story **never opened before** renders its sentences
- tapping a word updates the InfoPanel with translation and kanji breakdown
- a hard navigation straight to `/read/<storyId>` renders the reader (navigation fallback)
- a story uploaded earlier (IndexedDB) still opens

**Given** CI (`.github/workflows/ci.yml`)
**Then** the PWA spec runs on Chromium only, after the build step, and the default
`pnpm test:e2e` suite does not pick up `e2e-pwa/`

**Given** `docs/architecture-web.md` and `docs/development-guide.md`
**Then** they describe the service worker, the precache budget, the opt-in rule for large
assets, and how to test offline locally (`pnpm build && pnpm preview`, DevTools → Network →
Offline)

**Notes:** WebKit in Playwright has limited service worker support, so Chromium is enough for
CI. Do manual spot checks on real iOS Safari and Android Chrome before closing the story.
See the memory notes on WebKit and Windows DPI quirks if measuring layout.

---

### Story se4-3: Update Prompt and Install Entry Point

As a **reader using the installed app**,
I want to know when a new version or new stories are available and choose when to reload,
So that I get updates without losing my place mid-story.

**Acceptance Criteria**

**Given** a new service worker has installed and is waiting
**Then** `UpdatePrompt` shows a non-modal toast at the bottom of the viewport (above the
mobile tab bar) reading "New version available", with a **Reload** action and a dismiss (×)
button, and nothing reloads automatically

**When** the reader taps **Reload**
**Then** the waiting service worker activates and the page reloads exactly once on the new version

**When** the reader taps ×
**Then** the toast hides for the current session and reappears on the next launch if the
update is still waiting

**Given** a Chromium browser fires `beforeinstallprompt`
**Then** SettingsMenu shows an "Install app" item, and choosing it calls `prompt()` on the
deferred event and hides the item after the user's choice

**Given** iOS Safari, not standalone
**Then** SettingsMenu shows "Add to Home Screen", which reveals the instruction "Tap Share,
then Add to Home Screen"

**Given** the app is running standalone (`display-mode: standalone` or `navigator.standalone`)
**Then** no install item is shown

**Given** the toast and the menu item
**Then** they use only design tokens (`surface`, `border`, `paper-text`, `accent`), are
keyboard accessible, pass axe (WCAG 2.1 AA tags), and are browser-verified at 412px and at
desktop width

**Notes:** Drive the toast from the `needRefresh` state exposed by se4-1. A test hook can
force `needRefresh` true for unit and E2E tests. Optionally add an e2e-pwa spec that serves
two builds to exercise a real update. A unit test with a mocked store is the minimum.

---

## Risks and Notes

- **Stale-version trap:** the classic PWA failure. Mitigated by `prompt` updates, no-cache on
  `sw.js`, and the update toast reappearing every launch until accepted.
- **First-visit data cost:** every visitor, installed or not, downloads about 4 MB in the
  background after first render. This is acceptable at today's size and bounded by the 10 MB budget.
- **iOS limits:** no install prompt (manual Add to Home Screen) and no Web Share Target.
  Storage for installed web apps is exempt from Safari's 7-day eviction but can still be
  cleared under disk pressure. These are triggers for revisiting a native wrapper, not
  blockers.
- **Analytics offline:** `@vercel/analytics` and `@vercel/speed-insights` calls fail silently
  offline. The denylist keeps `/_vercel/*` out of the navigation fallback.
- **Unknown paths return HTML** on Vercel (`200 text/html` SPA fallback). Precache URLs come
  from the build output, so this only matters if a referenced asset is deleted. The build would
  then produce an inconsistent precache, which is caught by the offline E2E.
