---
type: sprint-change-proposal
date: "2026-11-08"
author: RT (with Developer agent)
mode: batch
status: approved
approved: "2026-11-08"
scope: moderate
introduces: supp-epic-4
---

# Sprint Change Proposal — Installable PWA with Offline Library

## 1. Issue Summary

**Change trigger.** New requirement, raised by the product owner after v1 shipped. It is
not a defect, and no in-flight story revealed it. The web reader at www.nihonnohon.com
should be **installable to the home screen and fully usable offline, including the entire
bundled story library**. That reverses the v1 decision "offline explicitly deferred to
future mobile apps".

**Category:** new requirement / strategic adjustment. It brings forward, by a cheaper
route, the "mobile app with offline stories" goal that the PRD lists as a v2 Growth
feature.

**Why now.**

- The v1 planning documents are inconsistent. PRD NFR6 says *"the app remains fully
  functional once loaded, regardless of network state"*, Journey 5 has Yuki reading in a
  tunnel, and the product brief says *"fully offline-capable"*. Architecture and
  `project-context.md`, however, forbid offline and PWA support. Today NFR6 holds only
  while the tab stays alive. A reload, a closed tab or an opened story that isn't cached
  all fail without a network.
- The PRD's planned route to offline is Capacitor wrappers. That carries real costs: App
  Store accounts and review, a Mac for iOS builds while development happens on Windows,
  and store releases for every content change. A PWA delivers most of the offline value
  with none of those costs, and it does not rule Capacitor out (see §3).

**Evidence.**

| Source | Statement |
|---|---|
| `prd.md:499` (NFR6) | "The app remains fully functional once loaded, regardless of network state" |
| `prd.md:193–209` (Journey 5) | Offline resilience mid-story |
| `product-brief-nihonnohon.md:64` | "fully offline-capable" |
| `architecture.md:30, :56, :1083` | Offline "explicitly out of scope for v1", "deferred to mobile iteration" |
| `project-context.md:308` | "Never add offline/PWA support in v1" |
| `prd.md:110, :378` | Growth: "Mobile app wrappers with offline story downloading (Capacitor or similar)" |

**Technical findings (verified 2026-11-08).**

- Production on Vercel serves static files ahead of the SPA catch-all rewrite. `/vocab.json`
  and `/stories/manifest.json` return `application/json`, and every response carries
  `Cache-Control: public, max-age=0, must-revalidate`. **`vercel.json` therefore needs no
  rewrite change** for `sw.js` or the web manifest. An explicit `sw.js` header is optional.
- An unknown path such as `/does-not-exist.json` returns `200 text/html`, the SPA fallback.
  This matters for the service worker only as a failure mode, covered in §4.
- Offline payload for "whole library on install": JS about 458 KB, Noto Sans JP (four
  woff2 files) 2.08 MB, `kanji-data.json` 529 KB, `vocab.json` 167 KB, and 31 stories about
  732 KB. **Total about 4 MB.** Every file is under Workbox's default 2 MiB per-file
  precache limit.
- Playwright's `webServer` runs `vite` (dev). vite-plugin-pwa does not register a service
  worker in dev by default, so **the existing E2E suite is unaffected without changes**.
  Offline behaviour needs its own spec against `vite preview`.
- No logo or icon asset exists anywhere in the repo, and `index.html` has no favicon,
  `theme-color` or manifest link.
- Fetch sites that need offline coverage: `/stories/manifest.json`,
  `/stories/<filename>`, `/vocab.json` and `/kanji-data.json`. Uploaded stories already
  persist in IndexedDB (`indexedDbService.ts`).
- `@vercel/analytics` and `@vercel/speed-insights` post to `/_vercel/*`. Those paths must
  be excluded from the navigation fallback, and fail silently offline.

---

## 2. Impact Analysis

### Change checklist results

| # | Item | Status | Finding |
|---|---|---|---|
| 1.1 | Triggering story | N/A | New requirement; no story triggered it |
| 1.2 | Core problem | [x] | Installable PWA with whole-library offline; reverses the v1 offline deferral |
| 1.3 | Evidence | [x] | See §1 table and technical findings |
| 2.1 | Current epic | N/A | Epics 1–4, supp-epic-1 and supp-epic-2 are all done (closed 2026-11-08) |
| 2.2 | Epic-level changes | [!] | **Add supp-epic-4 (PWA).** `supp-epic-3` is already used informally for the staged generation pipeline (commit `759857e`, story `se3-1`) |
| 2.3 | Remaining epics | [x] | supp-epic-3 (story generator) is unaffected: different app, no shared code |
| 2.4 | Obsoleted or new epics | [x] | Nothing obsoleted. PRD Growth item "Capacitor wrappers" becomes optional and conditional |
| 2.5 | Ordering | [x] | supp-epic-4 is independent and can run in parallel with supp-epic-3 |
| 3.1 | PRD | [!] | Growth features (2 places), new FR45–FR47, NFR6 restated, project classification |
| 3.2 | Architecture | [!] | Offline decision (3 places), Infrastructure & Deployment, Testing Strategy, `vercel.json` row note |
| 3.3 | UX spec | [!] | Platform Strategy (offline, native), plus new update-prompt and install patterns |
| 3.4 | Other artifacts | [!] | `project-context.md` (remove anti-pattern, add PWA rules); new ADR 007; `docs/architecture-web.md` and `docs/development-guide.md` (handled in stories); CI needs no change |
| 4.1 | Option 1: Direct adjustment (new supp-epic) | Viable | Effort **low** (about 3 small stories); risk **low to medium** (caching and update bugs are the main risk) |
| 4.2 | Option 2: Rollback | Not viable | Nothing to roll back |
| 4.3 | Option 3: MVP review | Not needed | v1 MVP is shipped. This only adds capability |
| 4.4 | Selected path | [x] | **Option 1:** new supplemental epic supp-epic-4 |

### Epic impact

- **New:** `supp-epic-4`, Installable PWA and Offline Library, with three stories (§4.5).
- **Existing epics:** none modified.

### Artifact conflicts

- **PRD:** the conflict is narrow. NFR6 already asks for this, and only the Growth roadmap
  item and the absence of install or offline FRs need changing.
- **Architecture:** the explicit "offline not supported" decision is reversed. A new
  component is added: a Workbox service worker generated by vite-plugin-pwa.
- **UX:** two small new patterns, the update-available prompt and an install entry point.
  Neither interrupts the core reading loop.
- **project-context.md:** an anti-pattern must be removed. Otherwise any dev agent
  following the rules file would refuse the work.

### Technical impact

- New dev dependency `vite-plugin-pwa`, plus `@vite-pwa/assets-generator` for icons.
- New files: icon set in `apps/web/public/`, `src/lib/pwa.ts` (registration guard),
  `UpdatePrompt` component, and an offline E2E spec with a preview-server Playwright config.
- Changed files: `vite.config.ts`, `index.html` (meta tags), `main.tsx` (call the guarded
  registration), `SettingsMenu` (install entry), and `vercel.json` (optional `sw.js` header).
- Deployment: no pipeline change. Merging to `main` still deploys, and new content reaches
  installed users through the service worker update flow.

---

## 3. Recommended Approach

**Direct adjustment: add supplemental epic supp-epic-4.**

**PWA now, Capacitor later only if needed.** A PWA does not close off a native wrapper.
Capacitor wraps the same `dist/` build, so the reader, stores, IndexedDB layer and icons
carry over. Inside Capacitor the service worker is redundant, because assets ship in the
binary, and it is switched off by one guard. The only work discarded is the caching
configuration and the update prompt.

What a PWA cannot do, so the triggers for revisiting Capacitor:

- App Store / Play Store presence. On iOS there is no install prompt, only Share → Add to
  Home Screen.
- iOS "Open in…" and share-sheet handling for story files. Web Share Target is Android-only.
- Local scheduled notifications (reading reminders) without a push backend.
- Reliable background audio with lock-screen controls on iOS. This becomes relevant when
  the planned audio feature lands.
- Storage durability guarantees for a library much larger than today's 4 MB.

**Design constraints that keep the Capacitor route cheap** (written into the epic):

1. The service worker is a **transparent cache only**. App code keeps using plain
   `fetch()` and never depends on the service worker's presence or messages for
   correctness.
2. Persistence stays behind `indexedDbService`, so a native storage backend can replace it
   without touching components.
3. Service worker registration lives in **one guarded function** (`registerServiceWorker()`
   in `src/lib/pwa.ts`), so a native build or test can disable it.

**Effort:** low, about 1–2 dev sessions across 3 stories.
**Risk:** low to medium. The classic PWA failure is users stuck on a stale version. It is
mitigated by `registerType: 'prompt'` with a visible update prompt, by Vercel's existing
`max-age=0, must-revalidate` on `sw.js`, and by an offline E2E test.
**Timeline:** no impact on other work.

**Alternatives considered:**

- **Capacitor first:** rejected for now because of cost and release friction (§1).
- **TWA (Bubblewrap/PWABuilder) to the Play Store:** possible later on top of this PWA,
  with no rework. Not in scope.
- **Runtime stale-while-revalidate caching of content (offline option a):** rejected in
  favour of **precaching the whole library (option b)**, chosen by RT. Precache with
  Workbox revision hashes also keeps content versions consistent: a story and the
  `vocab.json` it references always come from the same deploy.

---

## 4. Detailed Change Proposals

### 4.1 PRD — `prd.md`

**P1. Project classification (line 52)**

OLD:
```
| Project Type | Web App (SPA, internet-required; offline-capable once loaded, no backend) |
```
NEW:
```
| Project Type | Web App (installable PWA, no backend; internet required for first visit, fully offline thereafter) |
```
Rationale: reflects the new capability. The old wording contradicted itself.

**P2. Growth features (line 110), and the same item in Post-MVP Features (line 378)**

OLD:
```
- Mobile app wrappers with offline story downloading (Capacitor or similar — not a rebuild)
```
NEW:
```
- ~~Mobile app wrappers with offline story downloading~~ → delivered as an installable PWA (supp-epic-4, see ADR 007)
- Native app wrapper (Capacitor or similar — not a rebuild) — optional; revisit only for app-store distribution or native-only features (iOS file "Open in…", local reminders, background audio)
```
Rationale: the PWA supersedes the offline motivation for Capacitor. Capacitor stays on the
roadmap with explicit triggers.

**P3. New functional requirements, appended to "Application & Platform" after FR44**

NEW:
```
- **FR45:** Reader can install the app to their device home screen / app launcher and launch it in a standalone window (no browser chrome)
- **FR46:** Once the app has been loaded online once, the reader can open the library, open any bundled story, and perform word lookups with no network connection
- **FR47:** When a new version of the app or story library has been deployed, the reader is informed non-intrusively and can choose when to reload; reading is never interrupted by an automatic reload
```

**P4. NFR6 (line 499)**

OLD:
```
- **NFR6:** The app remains fully functional once loaded, regardless of network state
```
NEW:
```
- **NFR6:** The app remains fully functional once loaded, regardless of network state — including across reloads, app restarts, and opening bundled stories not previously viewed (offline payload target: ≤ 10 MB precache; current ≈ 4 MB)
```
Rationale: makes NFR6 testable and sets a budget that, if exceeded, triggers moving
stories from precache to runtime caching.

### 4.2 Architecture — `architecture.md`

**A1. Requirements overview (line 30)**

OLD:
```
- **Offline capability** is explicitly out of scope for v1. The app is a hosted web page requiring an internet connection to access. Offline support is deferred to future mobile app iterations.
```
NEW:
```
- **Offline capability** was out of scope for v1. **Amended 2026-11-08 (supp-epic-4, ADR 007):** the app is an installable PWA; a Workbox service worker precaches the app shell, fonts, dictionary data and the full bundled story library, so the app works offline after the first online visit.
```

**A2. Context-stage decisions table (line 56)**

OLD:
```
| Offline capability | Not supported in v1 | Web app requires internet to load; offline deferred to future mobile apps |
```
NEW:
```
| Offline capability | Installable PWA with full precache (amended 2026-11-08, ADR 007) | Delivers NFR6 and Journey 5 without native wrappers; Capacitor remains an optional later layer over the same build |
```

**A3. Infrastructure & Deployment table (after the "Font loading" row, about line 301), new rows**

NEW:
```
| Service worker | **vite-plugin-pwa** (Workbox `generateSW`), `registerType: 'prompt'`; registered only via `registerServiceWorker()` in `src/lib/pwa.ts`, production builds only | Generated precache manifest with per-file revision hashes; one guarded entry point so tests and a future native wrapper can disable it |
| Offline caching | Precache `**/*.{js,css,html,woff2,png,svg,ico,webmanifest,json}` — includes `vocab.json`, `kanji-data.json`, `stories/manifest.json` and every `stories/*.json`; `navigateFallback: '/index.html'` with denylist `/_vercel/` | Whole library offline from install; content versions stay consistent per deploy; budget ≤ 10 MB for the default precache, beyond which stories move to runtime `CacheFirst` caching. Large optional assets (e.g. a full dictionary) are opt-in downloads stored outside the precache, never precached |
| Web app manifest | Generated by vite-plugin-pwa: `name` "Nihon no Hon", `short_name` "Nihon no Hon", `display: standalone`, `start_url: /`, `theme_color`/`background_color` = `paper-bg` (#FDF6E3), icons 192/512 + maskable 512 | FR45 installability |
| Vercel caching | No rewrite change needed — Vercel serves static files before the SPA rewrite, and already sends `max-age=0, must-revalidate`. Add an explicit `headers` entry for `/sw.js` (`Cache-Control: no-cache`) to pin the behaviour | Prevents a stale service worker if Vercel defaults change |
```

**A4. Testing Strategy table (about line 307), new row**

NEW:
```
| Offline E2E | **Playwright**, separate config against `vite preview` (production build, service worker active) | Install SW → go offline (`context.setOffline(true)`) → reload → open a story never visited → word lookup works; update-prompt appears when a new SW is waiting |
```

**A5. NFR coverage table (line 1083)**

OLD:
```
| NFR6 | Functional once loaded | Static SPA; offline explicitly deferred to mobile iteration |
```
NEW:
```
| NFR6 | Functional once loaded | PWA precache of shell, fonts, dictionary data and full story library (supp-epic-4); verified by offline E2E spec |
```

### 4.3 UX Design Specification — `ux-design-specification.md`

**U1. Platform Strategy (lines 70–71)**

OLD:
```
- **Offline behaviour:** Fully functional once loaded — dictionary data bundled client-side; no network dependency during a reading session
- **Native mobile:** Out of scope for v1; web-first with responsive layout covering both form factors
```
NEW:
```
- **Offline behaviour:** Installable PWA — after the first online visit the whole app, dictionary data and bundled story library work with no network, across reloads and restarts. There is no offline indicator: offline should feel identical to online
- **Native mobile:** Not planned; the installed PWA launches standalone from the home screen. A native wrapper may follow later over the same build (ADR 007)
```

**U2. New subsection after "Platform Strategy": "App Install & Updates"**

NEW:
```
### App Install & Updates

- **Update available:** when a new version has been downloaded, show a small non-modal
  toast at the bottom of the viewport (above the mobile tab bar): "New version available"
  + **Reload** + dismiss (×). Never auto-reload — the reader may be mid-sentence. Dismissed
  toasts reappear on the next app launch. Uses existing tokens only (`surface`, `border`,
  `paper-text`, `accent` for the action).
- **Install entry point:** a "Install app" item in the SettingsMenu, shown only when the
  browser has offered an install prompt (`beforeinstallprompt`, Chromium) — it triggers the
  native prompt. On iOS Safari (no install API) the item reads "Add to Home Screen" and
  opens a one-line instruction: "Tap Share, then Add to Home Screen". Hidden entirely when
  already running standalone.
- No install banners or interstitials on first visit — the reading surface stays clean.
```

### 4.4 Agent rules — `project-context.md`

**C1. Remove the anti-pattern (line 308)**

OLD:
```
- **Never add offline/PWA support in v1.** The app requires an internet connection; offline is explicitly deferred
```
NEW: *(line removed)*, replaced by the rules in C2.

**C2. New section "PWA & Offline", inserted after "Data Loading"**

NEW:
```
### PWA & Offline

- The app is an installable PWA (vite-plugin-pwa, Workbox `generateSW`, `registerType: 'prompt'`). See ADR 007
- **The service worker is a transparent cache only.** App code uses plain `fetch()` and must work identically with no service worker — never read caches directly, never message the SW for app logic
- Register the SW **only** through `registerServiceWorker()` in `src/lib/pwa.ts`; it no-ops outside production builds. Do not call `navigator.serviceWorker` anywhere else
- Everything under `public/` matching the precache globs is cached at install — a new file in `public/stories/` is offline automatically; keep the precache under 10 MB (check the build log)
- The 10 MB budget applies to the **default precache**, which every visitor downloads. Large optional assets (e.g. a future full dictionary) must be **opt-in downloads stored outside the Workbox precache** (e.g. imported into IndexedDB) — never add them to the precache globs
- Never auto-reload on SW update — surface it through `UpdatePrompt` and let the reader choose
- The default E2E suite runs on `vite` (dev) with **no** service worker; offline behaviour is tested only in the preview-server spec (`e2e-pwa/`). Do not enable `devOptions` in the PWA plugin
- Persistence goes through `indexedDbService` — keep storage behind that service so a native backend can replace it
```

**C3. Technology Stack:** add under Frontend app:
```
- vite-plugin-pwa (Workbox) — service worker + web manifest
```

### 4.5 New epic document — `supp-epic-4-pwa.md`

Created on approval, following the `supp-epic-2` format: overview, background, design
decisions (the §3 constraints and the §4.2 A3 decisions), components affected, story list,
stories with acceptance criteria, and risks. Story outline:

| Story | Title | Depends on | Summary |
|---|---|---|---|
| se4-1 | Web manifest, icons and service worker registration | — | Add vite-plugin-pwa; manifest per A3; icon set (192, 512, maskable 512, `apple-touch-icon` 180, favicon) generated from one SVG source; `index.html` gets `theme-color`, `apple-touch-icon`, `apple-mobile-web-app-*` meta; `registerServiceWorker()` guard in `src/lib/pwa.ts` called from `main.tsx`. **AC:** `pnpm build && pnpm preview` passes Chrome's installability check; app launches standalone; existing unit and E2E suites pass unchanged (no SW in dev) |
| se4-2 | Offline library precache and offline E2E | se4-1 | Precache globs and `navigateFallback` with `/_vercel/` denylist per A3; `vercel.json` `sw.js` header; Playwright config `playwright.pwa.config.ts` on `vite preview` with spec in `e2e-pwa/`. **AC:** after one online load, offline: reload works, library lists all stories, a never-opened story opens, word lookup and kanji breakdown work, uploaded (IndexedDB) story still opens; build log shows precache ≤ 10 MB; CI runs the PWA spec (Chromium only) |
| se4-3 | Update prompt and install entry point | se4-1 | `UpdatePrompt` toast and SettingsMenu install item per U2. **AC:** a waiting SW shows the toast; Reload activates the new SW and reloads once; × dismisses; the install item appears only when installable, triggers the native prompt, shows the iOS instruction on Safari, and is hidden in standalone; browser-verified at 412px and desktop; axe clean |

Stories se4-2 and se4-3 can run in parallel after se4-1. Documentation updates to
`docs/architecture-web.md` and `docs/development-guide.md` (SW, preview testing) go with
se4-2.

### 4.6 New ADR — `docs/adr/007-pwa-offline.md`

Created on approval. **Status:** Accepted. **Context:** the NFR6 and Journey 5 gap; the
cost of Capacitor (accounts, Mac requirement, review, release friction). **Decision:**
installable PWA with full precache, `prompt` updates, and the three Capacitor-friendly
constraints. The 10 MB budget covers the default precache only; large optional assets
(e.g. a future full dictionary) must be opt-in downloads stored outside the Workbox
precache. **Consequences:** about 4 MB first-visit background download; content updates
ride service worker updates; triggers for revisiting a native wrapper (as listed in §3);
supersedes the offline rows in architecture.md.

### 4.7 Sprint tracking — `sprint-status.yaml`

NEW block appended:
```yaml
  # Supplemental Epic 4: Installable PWA and Offline Library
  # Planning: _bmad-output/planning-artifacts/supp-epic-4-pwa.md
  # ADR: docs/adr/007-pwa-offline.md
  # Change proposal: _bmad-output/planning-artifacts/sprint-change-proposal-2026-11-08.md
  supp-epic-4: backlog
  se4-1-web-manifest-icons-and-sw-registration: backlog
  se4-2-offline-library-precache-and-offline-e2e: backlog
  se4-3-update-prompt-and-install-entry-point: backlog
  supp-epic-4-retrospective: optional
```

### Open decision (non-blocking)

- **App icon artwork.** No logo exists. Default for se4-1: the kanji **本** in `paper-text`
  on a `paper-bg` square with an `accent` rule beneath it, drawn as SVG paths (not live
  text) so it renders without the font. RT can swap the source SVG at any time, and the
  icon set regenerates from it.

---

## 5. Implementation Handoff

**Scope classification: Moderate.** A new epic plus planning-artifact amendments. No
fundamental replan is needed. The architectural reversal is small and recorded in an ADR.

| Role | Responsibility |
|---|---|
| Developer agent (this session, on approval) | Apply §4.1–4.4 edits; create `supp-epic-4-pwa.md` and ADR 007; append the §4.7 sprint-status block; commit on a feature branch |
| Scrum Master / Developer (`bmad-create-story`) | Create story files se4-1, then se4-2 and se4-3 |
| Developer agent (`bmad-dev-story`) | Implement each story; browser-verify UI per project rules |
| Reviewer (`bmad-code-review`, fresh context) | Review each story before `done` |

**Success criteria**

1. The production site passes Chrome's installability check and installs on Android
   Chrome, desktop Chrome/Edge and iOS Safari (Add to Home Screen).
2. After one online visit, in airplane mode: the app launches, the library lists all
   stories, any bundled story opens, and lookups work (FR46, NFR6).
3. Deploying a change shows the update toast in an installed app, and Reload picks up the
   new version (FR47).
4. The existing unit and E2E suites pass unchanged, and the offline E2E spec passes in CI.
5. Precache stays at or under 10 MB.
