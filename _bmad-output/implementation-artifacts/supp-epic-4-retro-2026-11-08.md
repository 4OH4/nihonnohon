# Supplemental Epic 4 Retrospective: Installable PWA and Offline Library

**Date:** 2026-11-08
**Epic:** supp-epic-4, Installable PWA and Offline Library
**Status:** All 3 stories done (100%)
**Participants:** RT (Project Lead), Amelia (Developer, facilitating), John (Product Manager), Winston (Architect), Sally (UX Designer), Paige (Tech Writer), Dana (QA Engineer)

**References:** epic `_bmad-output/planning-artifacts/supp-epic-4-pwa.md` · ADR `docs/adr/007-pwa-offline.md` · change proposal `_bmad-output/planning-artifacts/sprint-change-proposal-2026-11-08.md`

---

## Epic Summary

| Story | Delivered | Code review |
|---|---|---|
| se4-1 Web manifest, icons, SW registration | vite-plugin-pwa (prompt mode), icon set from one SVG, guarded `registerServiceWorker()`, `usePwaStore`, SW boundary test | 2 decisions, 9 patches, 2 deferred (both resolved later in the epic) |
| se4-2 Offline library precache and offline E2E | Whole-library precache (3.9 MB of 10 MB budget, 50 URLs, all 30 stories), `/sw.js` no-cache header, Chromium `e2e-pwa` suite in CI, docs | 6 patches, 1 deferred (E2E type-checking) |
| se4-3 Update prompt and install entry point | `UpdatePrompt` toast, periodic and on-visible update check, library install link (Chromium and iOS), install-dialog screenshots, real-update E2E | 3 decisions (2 accepted unchanged, 1 became a patch), 9 patches |

- Requirements met: FR45, FR46, FR47 and the amended NFR6.
- Planned, implemented and reviewed on 2026-11-08: 12 commits on `feat/pwa-planning`.
- Tests: web unit 284 → 364; default E2E 124 → 142 passing; new PWA suite 18 tests, in CI.
- Real devices: Android Chrome passed offline checks on the Vercel preview. RT checked the Chrome desktop install. iOS Safari is not checked (accepted at risk).
- Production incidents: 0. The epic has not been deployed yet.

---

## What Went Well

- **The process was smooth overall** (RT).
- **The architecture constraints held.** The service worker is a transparent cache only, there is one guarded registration point, and storage stays behind `indexedDbService`. A future native wrapper stays cheap.
- **On-device testing improved the product.**
  - The theme colour moved from `paper-bg` to `surface`.
  - The accent rule was dropped from the icon.
  - The install entry moved from SettingsMenu to the library footer.
  - The install link stays after a cancel.
  - The install dialog gained screenshots and a rewritten description.
- **The three-layer code review was an effective safety net.** Every library-behaviour bug and every test that proved nothing was caught before `done`. The reviews that read the vite-plugin-pwa and workbox-window source were the most valuable.
- **Mutation checks were used in every story**, and they confirmed that the key specs fail when the guarded behaviour is removed.
- **All Epic 4 retro actions were closed:**
  - setter-and-consumer rule
  - Playwright pre-flight
  - visual-verification reminder
  - `FORMAT_SPEC_URL`
  - CC BY-SA 4.0

## Challenges

1. **Browser-owned UI gives no preview.**
   - Getting Chrome's install dialog right was painful, mainly because "not knowing what the output would be" (RT).
   - Every change needed a build, a preview, a manual install and a site-data reset.
   - Chrome's dialog text cannot be changed.
   - The `wide`-only screenshots would never have appeared on Android. Review caught it.
2. **Our picture of the library was wrong (all 3 stories).**
   - `reloadPage` is ignored in prompt mode.
   - The update handle is stored before a worker exists.
   - The first visit is never controlled.
   - workbox-window drops its `updatefound` listener after the first external update.
   - Reload in one tab reloads all the others.
3. **Tests passed against our assumptions, not against ground truth (all 3 stories).** Examples:
   - The SW boundary test could be bypassed.
   - The precache spec did not detect files Workbox silently drops when they exceed 2 MiB.
   - The offline checks could pass without the files being requested.
   - A doc claimed scenario (f) was "enforced" when no test ran it.
   - The focus test did not exercise the transition.
   RT saw these only in reviews.
4. **Planning docs drifted after mid-story decisions.** The epic, the story ACs and the UX spec contradicted the code until review patched them (AC5 cancel behaviour, the token list, the precache numbers).
5. **Environment friction.**
   - A leftover `vite preview` held port 4173, so runs used temporary configs on other ports. RT: acceptable, no action.
   - A stale service worker served an old build during manual testing: the stale-version trap, hit in-house.

## Key Insight

Every finding traces back to trusting a model of something we had not checked: a library, a test or a document. Reading the library source (se4-3 Dev Notes) and asserting against independent ground truth (se4-2 review patches) were what fixed it.

---

## Previous Retro Follow-Through (Epic 4, 2026-05-13)

| # | Action | Status |
|---|---|---|
| 1 | Setter-and-consumer CSS rule in `project-context.md` | ✅ Done |
| 2 | Playwright browser pre-flight in `project-context.md` | ✅ Done |
| 3 | Visual-verification reminder in `project-context.md` | ✅ Done |
| 4 | Update `FORMAT_SPEC_URL` | ✅ Done |
| 5 | CC BY-SA 4.0 in `CreditsRoute.tsx` | ✅ Done |
| 6 | Push to origin | ✅ Done |

---

## Action Items

### Process and documentation

| # | Action | Owner | Done when |
|---|---|---|---|
| 1 | **Install-dialog recipe** in `docs/development-guide.md`: what the richer install UI requires (`screenshots` with both `narrow` and `wide` form factors, plus `description`), checking it in DevTools → Application → Manifest (including the "Richer PWA Install UI" warnings), resetting between tries (unregister the SW, clear site data), and keeping screenshots out of the precache | Paige | The section exists and links from the PWA tests section |
| 2 | **Assert against ground truth**, added to Testing Rules in `project-context.md`. When a test guards against a tool failing silently, compare against an independent source (e.g. files on disk vs the precache list), not the tool's own report. Any doc claiming "enforced by X" must name a test that fails when the guarded behaviour is removed | Dana | The rule is in `project-context.md` |
| 3 | **Read the library source before writing the story.** When a story depends on third-party runtime behaviour, its Dev Notes include a "How \<lib\> actually behaves" section taken from the installed source, as in se4-3 | Winston (via `create-story`) | The rule is in `project-context.md` |
| 4 | **Amend decisions in the same commit.** When RT changes a design decision mid-story, the epic, the story ACs and the UX spec are updated in the same commit as the code | John | Recorded as a team agreement in `project-context.md` |

### Technical debt

| # | Item | Owner | Priority |
|---|---|---|---|
| 5 | **iOS Safari offline and install check** on a real iPhone: one online visit, Add to Home Screen, airplane mode, relaunch from the home screen, then check the library, a story never opened before, and a lookup with kanji. **Not a merge gate (RT decision): follow-up after release.** Tracked in `deferred-work.md` | RT | Medium |
| 6 | **Type-check the E2E specs** (`e2e/`, `e2e-pwa/`) with a `tsconfig.e2e.json` | Amelia | Low (predates se4) |

### Accepted behaviours (RT decisions, no action)

- Reload in one tab force-reloads other open tabs of the app (plugin prompt-mode behaviour).
- Below `lg`, the update toast covers the bottom of the page until it is dismissed.
- The install link stays visible after a cancelled install (Chrome re-offers install immediately).

---

## Next Epic

No Supplemental Epic 5 is defined. No significant discoveries require changes to existing plans.

New stories added to `public/stories/` are now precached automatically, so keep watching the 10 MB default-precache budget as the library grows (already a rule in `project-context.md`).

## Readiness Assessment

| Area | Status |
|---|---|
| Testing and quality | ✅ Unit, default E2E and PWA suites green. Android Chrome and Chrome desktop install verified. iOS accepted at risk |
| Deployment | ⏳ PR `feat/pwa-planning` → `dev` opened at retro close. RT handles the merge to `main` (se4 ships as a whole) |
| Stakeholder acceptance | ✅ Accepted by RT |
| Technical health | ✅ RT: all good |
| Unresolved blockers | ✅ None |

**Conclusion:** se4 is complete and cleared to ship. The action items above apply to the next piece of work.
