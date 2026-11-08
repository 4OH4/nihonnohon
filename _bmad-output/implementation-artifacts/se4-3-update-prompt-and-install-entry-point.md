# Story se4-3: Update Prompt and Install Entry Point

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **reader using the installed app**,
I want to know when a new version or new stories are available and choose when to reload,
So that I get updates without losing my place mid-story.

This story implements PRD **FR47** and finishes the in-app half of **FR45** (the install entry point). It builds on two earlier stories:
- se4-1 added the registration, `usePwaStore`, `needRefresh` and the `updateServiceWorker` handle.
- se4-2 (done) owns the precache, `vercel.json`, the `e2e-pwa` offline suite and CI.

Epic: `_bmad-output/planning-artifacts/supp-epic-4-pwa.md`. Decision record: `docs/adr/007-pwa-offline.md`. UX: `ux-design-specification.md` → *App Install & Updates*.

This is the **last story in supp-epic-4**. Until it ships, a deployed update waits unseen until every tab of the app is closed. RT's rule: supp-epic-4 reaches `main` only as a whole.

### Decisions by RT (2026-11-08), which replace the epic and UX spec text where they differ

1. **The install entry point is a small text link at the bottom of the library page**, directly **above** "Load a story from your device". It is **not** in SettingsMenu. RT wants the reading interface kept clean, so SettingsMenu is not modified at all. The epic's ACs and the UX spec's "Install entry point" bullet both say "SettingsMenu". Task 8 amends both documents to match.
2. **The iOS variant uses the same spot.** On iPhone or iPad, the link reads "Add to Home Screen" and reveals the instruction "Tap Share, then Add to Home Screen" directly beneath it.
   - It shows in Safari on any iOS version.
   - It shows in other iOS browsers (Chrome, Edge, Firefox) on **iOS 16.4 or later**. Those browsers gained Add to Home Screen only in 16.4, so on older iOS the link is hidden.
   - In-app browsers (Instagram, Facebook and so on) are **not** detected. Accepted by RT, because no reliable signal exists.
3. **The real-update E2E (`e2e-pwa/update.spec.ts`) is mandatory**, not optional as the epic says.

## Acceptance Criteria

1. **AC1: Update toast appears when a new service worker is waiting**
   - A new `UpdatePrompt` component (`src/components/UpdatePrompt.tsx`) is mounted **once**, in `App.tsx`, so it shows on every route.
   - It is visible when `needRefresh && !updateDismissed`. It is a non-modal toast fixed at the bottom of the viewport and centred horizontally. It contains:
     - the text "New version available"
     - a **Reload** button
     - a dismiss button that shows "×" and has the accessible name "Dismiss"
   - Below `lg`, the toast sits **above the reader's mobile tab bar**: its bottom edge must not overlap the `role="tablist"` "Content tabs" bar. At `lg` and wider there is no tab bar, so it sits near the bottom edge.
   - Nothing reloads automatically, and the toast never takes focus.
   - Story text outside the toast stays clickable. The full-width positioning wrapper is `pointer-events-none`, and only the toast itself takes pointer events.
   - Screen readers announce the toast politely: its container is a `role="status"` live region that is always in the DOM, and only its contents are rendered conditionally.

2. **AC2: Reload applies the update exactly once**
   - Tapping **Reload** calls `usePwaStore.getState().updateServiceWorker()`. The waiting worker receives `SKIP_WAITING`, activates and takes control, and vite-plugin-pwa reloads the page once, on its `controlling` event.
   - The button is disabled after the first tap, so a double tap cannot send a second message or reload twice.
   - If the handle is unexpectedly `null`, the button falls back to `window.location.reload()`. A visible Reload button must never do nothing.

3. **AC3: Dismiss hides the toast until the next launch**
   - Tapping × sets `updateDismissed`, and the toast hides.
   - The flag lives **in memory only**: no `persist`, no `sessionStorage`, no `localStorage`.
   - On the next page load or app launch, the still-waiting worker fires `waiting` again during registration. That sets `needRefresh` again, so the toast reappears.
   - If a *newer* worker arrives in the same session, `setNeedRefresh(true)` clears `updateDismissed`, and the toast reappears.

4. **AC4: Long-lived sessions find updates (deferred from se4-1)**
   - `registerServiceWorker()` passes `onRegisteredSW` and starts a periodic update check on the returned registration. It calls `registration.update()`:
     - every **60 minutes**
     - when the document becomes **visible** again (`visibilitychange`)
     - never twice within **60 seconds**
   - A check is skipped when `navigator.onLine === false` or when `registration.installing` is set. A rejected `update()` (for example, the server is unreachable) is caught silently.
   - All of this lives in `src/lib/pwa.ts`; the boundary test enforces that.
   - The se4-1 deferred item in `deferred-work.md` is marked resolved.

5. **AC5: Install link on Chromium**
   - `src/lib/pwa.ts` exports `initInstallPrompt()`, which is called **once from `main.tsx`, before render**.
     - It listens for `beforeinstallprompt`. The handler calls `preventDefault()`, which suppresses the browser's mini-infobar, in line with the UX rule against banners on the first visit. It then stores the event in `usePwaStore.installPrompt`.
     - It also listens for `appinstalled`, which clears `installPrompt`.
   - When the install option is `'prompt'`, the library shows an **"Install app"** text link directly above "Load a story from your device". Choosing it:
     - calls `prompt()` on the deferred event **synchronously in the click handler**, because the browser requires a user gesture
     - then awaits `userChoice`
     - then clears `installPrompt`, but only if it still holds the event that was used
   - A rejected `prompt()` (for example, the event was already used) also clears it.
   - _Amended after RT's cancel decision (2026-11-08):_ after a cancel, Chrome fires a fresh `beforeinstallprompt` straight away, so the link stays. The handler never clears a newer event.

6. **AC6: Add to Home Screen link on iOS**
   - On an iOS or iPadOS device that is not running standalone, the same spot in the library shows an **"Add to Home Screen"** text link, provided the browser can add to the home screen:
     - Safari: any version.
     - Chrome (`CriOS`), Firefox (`FxiOS`) or Edge (`EdgiOS`): only when the UA reports iOS ≥ 16.4.
     - If the iOS version cannot be read from the UA (for example, an iPad requesting the desktop site), the link is shown.
   - The link toggles (`aria-expanded`, `aria-controls`) a one-line instruction directly beneath it: "Tap Share, then Add to Home Screen".

7. **AC7: Hidden when installed or not installable**
   - When the app runs standalone, the library shows **no** install link. Standalone means `matchMedia('(display-mode: standalone)').matches` or `navigator.standalone === true`.
   - The library also shows no install link when neither an install prompt nor iOS applies (desktop Firefox, macOS Safari, a Chromium tab after install). It leaves no extra gap in that case: the "Load a story from your device" block keeps its current spacing.
   - **SettingsMenu and the reader are unchanged.** `SettingsMenu.tsx`, `ReaderRoute.tsx`, `SettingsMenu.test.tsx` and every committed pixel baseline are untouched.

8. **AC8: Design, accessibility and browser verification**
   - The toast and the install link use only design tokens: `surface`, `border`, `paper-text`, `accent`, plus `muted` for secondary text.
   - **`accent` is never used as a text colour on `surface`.** It reaches only 2.3:1, which fails AA. Use it as a fill behind `paper-text` (7.5:1) or as a border.
   - The install link uses the same style as the neighbouring "Load a story from your device" button (`text-sm underline text-muted`), so it reads as one of the page's quiet footer links.
   - Both elements are keyboard-operable: they are native `<button>`s with a visible focus.
   - Both pass axe (WCAG 2.1 AA tags) in a new E2E spec.
   - Both are browser-verified with `pnpm dev` at **412 px** and at **desktop width**.
   - The real update flow is browser-verified with `pnpm preview` (see Task 9).

9. **AC9: Tests**
   - Unit tests:
     - `pwaStore.test.ts`: the new state and actions.
     - `pwa.test.ts`: `onRegisteredSW` and the periodic check (with fake timers), `initInstallPrompt()`, and platform detection.
     - `UpdatePrompt.test.tsx`: the store is set through `setState`.
     - `LibraryRoute.test.tsx`: all three install states and the link's position.
   - Default E2E suite: `e2e/pwa-ui.spec.ts`, running on `vite` dev in all four projects. It:
     - forces the toast through the dev-only test hook
     - checks the toast against the tab bar at 412 px
     - dispatches a synthetic `beforeinstallprompt` on the library page
     - runs axe on the toast and on the library with the install link showing
   - PWA suite, **mandatory**: `e2e-pwa/update.spec.ts` exercises a **real** update:
     - prime a worker and serve a changed `sw.js`
     - the toast appears
     - tap Reload; exactly one navigation follows
     - afterwards there is no waiting worker and no toast
   - Regression gates: `pnpm typecheck`, `pnpm run lint`, `pnpm test:unit`, `pnpm test:e2e` (all four projects) and `pnpm test:e2e:pwa` all pass.

10. **AC10: Docs and planning amendments**
    - `docs/architecture-web.md` → *Offline & Service Worker*:
      - The *Updates* row describes the actual behaviour: the toast, the in-memory dismiss, the 60-minute and on-visible checks, and Reload → `SKIP_WAITING` → one reload.
      - Add an *Install* row covering the library footer link, Chromium vs iOS, and that it is hidden when standalone.
    - `docs/development-guide.md` → *PWA / Offline Tests* gains a short recipe for testing the update prompt: `pnpm build`, preview, prime, rebuild, then refocus the tab or reload. It names the dev-only test hook.
    - Amend the planning documents to match RT's decision (see Task 8):
      - the UX spec's *App Install & Updates* "Install entry point" bullet
      - the epic's se4-3 ACs and its *Components Affected* row

## Tasks / Subtasks

- [x] **Task 1: Store** (AC: 1, 3, 5, 6, 7, 9)
  - [x] Extend `src/stores/pwaStore.ts` (see *pwaStore additions*) with:
    - state: `updateDismissed`, `installPrompt`, `standalone`, `iosInstallable`
    - actions: `dismissUpdate`, `setInstallPrompt`, `setInstallContext`
    - the exported `selectInstallOption` selector and the `BeforeInstallPromptEvent` type
  - [x] Change `setNeedRefresh(true)` so it also clears `updateDismissed`.
  - [x] Extend `reset()` and `_reset()` as specified.
  - [x] Add the dev-only test hook (see *Test hook*).
  - [x] Extend `pwaStore.test.ts`, writing the tests first.
- [x] **Task 2: Registration and update check** (AC: 4, 9)
  - [x] In `src/lib/pwa.ts`, pass `onRegisteredSW` to `registerSW` and add the internal `watchForUpdates(registration)` (see *Periodic update check*).
  - [x] Keep these unchanged: the existing guards, the `try/catch`, `onNeedRefresh`, `onOfflineReady` and `onRegisterError`.
  - [x] Extend `pwa.test.ts`:
    - Use fake timers for the 60-minute interval.
    - Dispatch `visibilitychange` with `document.visibilityState` stubbed.
    - Cover the offline skip, the installing skip, the 60-second gap and a swallowed rejection.
- [x] **Task 3: Install capture** (AC: 5, 6, 7, 9)
  - [x] Add `initInstallPrompt()`, `isStandalone()`, `isIosDevice()` and `canAddToHomeScreen()` to `src/lib/pwa.ts` (see *Install capture*).
  - [x] In `main.tsx`, call `initInstallPrompt()` **before** `ReactDOM.createRoot(...)`. Keep the font comment block and the existing `void registerServiceWorker()` after render.
  - [x] Unit tests:
    - platform detection, with UA, touch-point and matchMedia stubs
    - `canAddToHomeScreen()` as a table-driven test over real UA strings:
      - iPhone Safari on iOS 15 → true
      - iPhone Chrome (`CriOS`) on iOS 16.3 → false
      - iPhone Chrome on iOS 16.4 → true
      - iPhone Firefox (`FxiOS`) on iOS 17 → true
      - iPhone Edge (`EdgiOS`) on iOS 15 → false
      - iPad `CPU OS 16_2` Chrome → false
      - iPadOS desktop-mode Macintosh UA with no OS version → true
      - Android Chrome → false (not iOS)
    - the event is captured and `preventDefault`ed
    - `appinstalled` clears it
    - the cleanup function removes both listeners
- [x] **Task 4: UpdatePrompt** (AC: 1, 2, 3, 8, 9)
  - [x] Create `src/components/UpdatePrompt.tsx` (see *UpdatePrompt*). Mount `<UpdatePrompt />` in `App.tsx` after `<Router />`, and leave the analytics block unchanged.
  - [x] Create `src/__tests__/UpdatePrompt.test.tsx`, covering:
    - hidden by default, while the live region is present
    - shown when `needRefresh` is true
    - hidden after dismiss
    - shown again after `setNeedRefresh(true)`
    - Reload calls the handle once and is then disabled, so a second click makes no call
    - with a `null` handle, Reload falls back to `location.reload`
- [x] **Task 5: Library install link** (AC: 5, 6, 7, 8, 9)
  - [x] Add the install link to `src/routes/LibraryRoute.tsx` (see *Library install link*), directly above the "Load a story from your device" button and inside the same footer block.
  - [x] Leave the filters, the story list, the upload flow and its error display, and the Credits link untouched.
  - [x] Extend `LibraryRoute.test.tsx`:
    - Add `usePwaStore.getState()._reset()` to its `afterEach`.
    - Add the new tests to the file's "AC Tracking" comment block under a `NEW (se4-3)` heading. That block lists preserved and new tests per story, so follow the pattern.
  - [x] Cases to cover:
    - `'prompt'`: "Install app" is shown and comes **before** "Load a story from your device" in document order (`compareDocumentPosition`). Clicking it calls `prompt` once. Once `userChoice` resolves, the link is gone and `installPrompt` is null.
    - A rejected `prompt()` clears the link.
    - `'ios'`: the instruction is hidden at first, then shown after a click, and `aria-expanded` toggles.
    - Standalone: no link, even when a deferred event is stored.
    - None: no install link at all, and the upload button is still present.
- [x] **Task 6: Default-suite E2E** (AC: 8, 9)
  - [x] Create `e2e/pwa-ui.spec.ts` (see *E2E: pwa-ui.spec.ts*).
- [x] **Task 7: Real update E2E, mandatory** (AC: 2, 9)
  - [x] Create `e2e-pwa/update.spec.ts` (see *E2E: update.spec.ts*).
  - [x] Mutation-check it, restoring the code after each step:
    - Temporarily make Reload a no-op, and confirm the spec fails.
    - Make the toast render without `needRefresh`, and confirm the spec fails.
- [x] **Task 8: Docs, planning amendments and deferred work** (AC: 4, 10)
  - [x] `docs/architecture-web.md`: update the *Updates* row and add an *Install* row.
  - [x] `docs/development-guide.md`: add an "Update prompt" paragraph under *PWA / Offline Tests*.
  - [x] `_bmad-output/planning-artifacts/ux-design-specification.md` → *App Install & Updates*: rewrite the "Install entry point" bullet to say:
    - a small "Install app" text link at the bottom of the library, above "Load a story from your device"
    - it is shown only when the browser has offered an install prompt
    - on iOS it reads "Add to Home Screen" and reveals "Tap Share, then Add to Home Screen" (Safari on any version; Chrome, Edge and Firefox on iOS 16.4+)
    - it is hidden when running standalone
    - the reading interface (SettingsMenu) carries no install item, per RT's 2026-11-08 decision

    Leave the toast bullet and the "no install banners" bullet unchanged.
  - [x] `_bmad-output/planning-artifacts/supp-epic-4-pwa.md`:
    - In the *Components Affected* UI row, replace `SettingsMenu.tsx` / "install item" with `LibraryRoute.tsx` / "install link".
    - In the se4-3 ACs, replace "SettingsMenu shows …" with the library link wording.
    - Change the Notes line "Optionally add an e2e-pwa spec…" to say the real-update spec is required (RT, 2026-11-08).
  - [x] `deferred-work.md`: mark the se4-1 item *No periodic service worker update check (for se4-3)* with "**→ resolved in se4-3:**" plus one line on how it was resolved.
- [x] **Task 9: Browser verification** (AC: 8; CLAUDE.md requires it)
  - [x] **`pnpm dev`, at 412 px and at desktop width (≥ 1280):**
    - **Toast:** open a story and force the toast from the DevTools console with the test hook. Check that:
      - at 412 px it sits above the tab bar
      - story text around it still responds to taps
      - × and Reload work from the keyboard (Tab, then Enter)
    - **Install link:** on the library, dispatch a synthetic `beforeinstallprompt` (snippet in *E2E: pwa-ui.spec.ts*). Check that "Install app" appears directly above "Load a story from your device" in the same style, and that nothing shifts when it is absent.
    - **iOS link:** use DevTools device emulation (iPhone) and reload to see "Add to Home Screen" and its instruction.
    - Note from memory: WebKit on Windows lays out at the display scaling factor. Judge the 412 px layout in Chromium device mode, not in local WebKit.
  - [x] **Real update with `pnpm preview`:**
    1. `pnpm build`, then `pnpm preview` (apps/web), then open Chrome on `localhost:4173`. Reload once so the page is controlled.
    2. Make a visible change temporarily (e.g. a word in the library upload link), then run `pnpm build` again without stopping preview (`vite preview` serves `dist/` from disk).
    3. Switch to another tab and back (visibility check), or reload. The toast should appear.
    4. Click **Reload**. Expect one reload, with the change visible.
    5. Repeat, but this time click ×, then reload the page. The toast should reappear.
    6. Revert the temporary change. Clear site data for `localhost:4173`.
  - [x] **Install (Chrome)** on `localhost:4173`:
    1. The library shows "Install app". Click it: the native dialog opens.
    2. Cancel. The link stays, because Chrome fires a fresh `beforeinstallprompt` (RT's decision, 2026-11-08; originally "The link should hide").
    3. Install from the omnibox and open the standalone window. The library should show no install link.
    4. Uninstall.
  - [x] Record what you saw in Completion Notes.
- [x] **Task 10: Regression gates** (AC: 9)
  - [x] `pnpm typecheck`, `pnpm run lint`, `pnpm test:unit` (root), `pnpm test:e2e` (apps/web, all four browser projects installed) and `pnpm test:e2e:pwa` (apps/web).
  - [x] No pixel baseline should change. The library has no snapshot, and SettingsMenu is untouched. If one changes, find out why before accepting it.
  - [x] The mobile-safari project uses an iPhone UA, so its library page now shows "Add to Home Screen". The existing `accessibility.spec.ts` "library view" axe test must still pass there. `golden-path`, `file-upload` and `smoke` must be unaffected: they locate the upload button by its exact name.

### Review Findings

_Code review 2026-11-08, range `e4715c8..419a558`. Layers: Blind Hunter, Edge Case Hunter and Acceptance Auditor. Library behaviour was checked against the workbox-window 7.4.1 and vite-plugin-pwa 2.0.0 source._

- [x] [Review][Decision] **Accepted by RT (2026-11-08): no change.** Reload in one tab force-reloads every other open tab. In prompt mode the plugin adds a `controlling` listener in each tab that saw the waiting worker, and it calls `location.reload()` when there is no `onNeedReload`. Tab A's Reload therefore activates the worker, and tab B reloads even if its reader dismissed the toast. That breaks "Never auto-reload on SW update". Options: (a) accept; (b) pass `onNeedReload` so only the tab that asked reloads, while the others re-show the toast to finish updating. With (b), those tabs run old JS under the new worker, and their old lazy chunks have left the precache.
- [x] [Review][Decision] **Accepted by RT (2026-11-08): no change, the toast can be dismissed.** Below `lg`, the toast hides the bottom of the page. On the library, the toast (64–108px from the bottom) covers the centred "Install app" and "Load a story" links when scrolled to the end, and `main` has only `p-4`, so it cannot scroll past them. On the reader, the last sentence's words sit under the `pointer-events-auto` toast. Options: (a) accept, since the toast can be dismissed; (b) add bottom padding to the library `main` and the story column while the toast is visible.
- [x] [Review][Patch] Android's install sheet shows no screenshots [apps/web/vite.config.ts:48]. Both entries are `form_factor: 'wide'`, which only desktop Chrome uses. RT (2026-11-08): the images are phone-sized, so reuse them. Fix: list each file a second time with `form_factor: 'narrow'` and keep the `wide` entries for desktop. Update the comment, and confirm `pwaManifest.test.ts` still matches every entry.
- [x] [Review][Patch] Reload can do nothing and stay disabled for good [apps/web/src/components/UpdatePrompt.tsx:17]. Scenario: a first-visit tab is never controlled (no `clientsClaim`), and the hourly or on-visible check finds a deploy. The plugin raises the toast for the external `installed` event, but the new worker activates at once because nothing waits on it. `messageSkipWaiting()` finds no `registration.waiting`, and `controlling` never fires. `reloading` is also never reset, so after a dismiss and a newer worker the toast returns with Reload disabled, and a rejected `update()` goes unhandled. Fix: in `pwa.ts`, the stored handle calls `location.reload()` when `registration.waiting` is absent; reset `reloading` when the toast is re-shown; catch the rejection.
- [x] [Review][Patch] A second deploy in the same page never re-raises a dismissed toast [apps/web/src/lib/pwa.ts:57]. workbox-window 7.4.1 removes its `updatefound` listener after the first externally triggered update, so the periodic check's later finds go unseen. That breaks AC3's "a newer waiting worker shows the toast again" within the page's lifetime. Fix: `watchForUpdates` adds its own `updatefound` → `statechange` listener and calls `setNeedRefresh(true)` when the worker is `installed`, `registration.waiting === sw` and the page has a controller.
- [x] [Review][Patch] The update check doesn't run on reconnect [apps/web/src/lib/pwa.ts:66]. A check skipped while offline waits up to an hour after the connection returns. Fix: `window.addEventListener('online', check)`.
- [x] [Review][Patch] The screenshot precache exclusion is undocumented [docs/architecture-web.md:187]. The Precache row and the Budget paragraph (line 193) still say everything the globs match is precached. Also update the PWA bullet in `_bmad-output/project-context.md`.
- [x] [Review][Patch] AC5 and Task 9 still say the install link hides after a cancel [_bmad-output/implementation-artifacts/se4-3-update-prompt-and-install-entry-point.md:218]. This contradicts RT's cancel decision, which the code (commit 11bd995), the epic and the architecture doc follow. Amend AC5 and Task 9 step 2.
- [x] [Review][Patch] The epic's se4-3 AC token list omits `muted` [_bmad-output/planning-artifacts/supp-epic-4-pwa.md]. The × button and the install link use `text-muted`, as story AC8 allows.
- [x] [Review][Patch] The screenshot-size test can silently skip entries [apps/web/src/__tests__/pwaManifest.test.ts]. The regex depends on quote style and key order, and the test only checks that at least one entry matched. Fix: assert the matched count equals the number of `screenshots/` entries in `vite.config.ts`.
- [x] [Review][Patch] The "never takes focus" test doesn't exercise the real transition [apps/web/src/__tests__/UpdatePrompt.test.tsx]. It renders with `needRefresh` already true. Fix: render hidden, then flip `needRefresh` to true and assert focus did not move.

## Dev Notes

### Scope boundary

| Item | Owner |
|---|---|
| `UpdatePrompt`, library install link, install capture, periodic update check, `pwaStore`/`pwa.ts` extensions, `e2e/pwa-ui.spec.ts`, `e2e-pwa/update.spec.ts`, UX spec and epic amendments | **se4-3 (this story)** |
| `SettingsMenu.tsx`, `ReaderRoute.tsx` | **Do not modify** (RT decision 1) |
| Precache globs, navigation fallback, `vercel.json`, `playwright.pwa.config.ts`, `offline.spec.ts`, `precache.spec.ts`, CI step | se4-2. **Do not modify**, except that `update.spec.ts` goes in the existing `e2e-pwa/` and runs under the existing config and CI step |
| An "offline ready" toast or an offline indicator | **Not built.** The UX spec says offline should feel identical to online. `offlineReady` stays in the store, unused by the UI |

### Current state of files being modified

- **`src/stores/pwaStore.ts`**
  - **Today:**
    - fields: `needRefresh`, `offlineReady`, `updateServiceWorker` (`UpdateServiceWorker | null`)
    - setters: `setNeedRefresh`, `setOfflineReady`, `setUpdateServiceWorker`
    - `reset()` clears the two flags but **keeps the handle**, so Reload keeps working (an RT decision from the se4-1 review). `_reset()` restores everything.
    - Not persisted.
    - The docstrings record that `reloadPage` is ignored in prompt mode, and that a non-null handle does **not** mean a worker exists.
  - **Preserve** all of this.
- **`src/lib/pwa.ts`**
  - **Today,** `registerServiceWorker()`:
    1. guards on `import.meta.env.PROD`, then on `'serviceWorker' in navigator`
    2. dynamically imports `virtual:pwa-register`
    3. calls `registerSW({ onNeedRefresh, onOfflineReady, onRegisterError })` through `usePwaStore.getState()`
    4. stores the returned handle
  - Everything is wrapped in a `try/catch` that only calls `console.warn`.
  - Registration is non-immediate. Do **not** add `immediate: true`.
- **`src/main.tsx`**
  - **Today:** font imports with a long rationale comment, then `App`, `registerServiceWorker` and `index.css`, then render, then `void registerServiceWorker()`.
- **`src/App.tsx`**
  - **Today:** `<Router />` plus PROD-gated `<Analytics />` and `<SpeedInsights />`.
  - `App` sits outside the router, so `UpdatePrompt` must not use router hooks. It doesn't need any.
- **`src/routes/LibraryRoute.tsx`**
  - **Today:** `min-h-dvh` column → `<AppBar variant="library" />` (no right slot) → `<main className="flex-1 p-4 max-w-2xl mx-auto w-full">`. Inside `<main>`:
    - the filter row
    - the story list or empty state
    - the **upload footer block**, `<div className="mt-8 text-center">`, which contains:
      - the `<button>` "Load a story from your device" (`text-sm underline text-muted`)
      - the conditional upload error
    - the hidden file `<input>`
    - the Credits block (`mt-6 text-center`, `text-xs text-muted underline` link)
  - **Change:** the install link goes inside the upload footer block, *before* the upload button. The block keeps its `mt-8`.
  - **Preserve:** everything else, including the upload button's exact accessible name. Unit and E2E tests locate it by name.
- **`src/__tests__/LibraryRoute.test.tsx`**
  - **Today:** it mocks `react-router-dom` (`useLoaderData`, `useNavigate`, …), story-loader, `indexedDbService` and `FileReader`. It starts with an "AC Tracking" comment that lists tests per story.
  - **Change:** add the se4-3 cases and the `_reset()` teardown.
- **`src/routes/ReaderRoute.tsx`** (read only)
  - **Today:** an `h-dvh` flex column: AppBar, InfoPanel, content, then the mobile tab bar.
  - The tab bar is `lg:hidden flex border-t border-border bg-surface` with `py-3 text-sm` tabs. It is **in flow**, not fixed, and about 45 px tall.
  - The toast's offset is designed around it.
- **`src/__tests__/serviceWorkerBoundary.test.ts`**
  - It fails if any `src/` file other than `lib/pwa.ts` contains the word-bounded identifier `serviceWorker`, or `virtual:pwa-register`, or `workbox-window`. **Comments count.**
  - In `UpdatePrompt.tsx`, `LibraryRoute.tsx`, `App.tsx`, `main.tsx` and `pwaStore.ts`, write "service worker" (two words) in comments, never `serviceWorker`.
  - `updateServiceWorker` and `registerServiceWorker` are fine: the capital S plus the word boundary mean they don't match.

### How vite-plugin-pwa 2.0 prompt mode actually behaves

Source: `node_modules/vite-plugin-pwa/dist/client/build/register.js`.

- **Toast trigger.**
  - `onNeedRefresh` fires on workbox-window's `waiting` event, or on an external `installed` event.
  - `waiting` also fires during `register()` when a worker was **already waiting** before this page loaded. That is why an in-memory dismiss is enough for "reappears on next launch".
- **Reload path.**
  - When `onNeedRefresh` fires, the library also adds a `controlling` listener. Because no `onNeedReload` is passed, that listener calls `window.location.reload()` when `event.isUpdate`.
  - `updateServiceWorker()` awaits registration, then calls `wb.messageSkipWaiting()`, which posts `SKIP_WAITING` only if `registration.waiting` exists.
  - So the full sequence is: tap → `SKIP_WAITING` → the new worker activates and claims → `controlling` → one reload.
  - `reloadPage` is ignored. Disabling the button covers double taps.
- **Second update in one session.** Each `onNeedRefresh` call adds another `controlling` listener. Several `reload()` calls in the same task still produce one navigation, so this is harmless.
- **Registration object.** `onRegisteredSW(swUrl, registration)` is called after `wb.register()` resolves. When it is supplied, `onRegistered` is not called. `registration` can be `undefined`, so guard for that.
- **`sw.js`.** `skipWaiting()` runs only inside the `SKIP_WAITING` message handler, and `clientsClaim` is absent (verified in se4-1 and se4-2). Never add either.

### pwaStore additions

```ts
/** Chromium's deferred install prompt (not in lib.dom). */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

// added to PwaStoreState:
/** The reader dismissed the update toast; in memory only, so it returns on the next launch. */
updateDismissed: boolean
/** Deferred `beforeinstallprompt` event; null when the browser has not offered install (or it was used). */
installPrompt: BeforeInstallPromptEvent | null
/** Running as an installed app (display-mode standalone, or iOS navigator.standalone). Set once at startup. */
standalone: boolean
/** iOS/iPadOS browser tab that can Add to Home Screen (no install API), so the library shows the instruction. */
iosInstallable: boolean
dismissUpdate: () => void
setInstallPrompt: (e: BeforeInstallPromptEvent | null) => void
setInstallContext: (ctx: { standalone: boolean; iosInstallable: boolean }) => void
```

- `setNeedRefresh`: `(v) => set(v ? { needRefresh: true, updateDismissed: false } : { needRefresh: false })`.
- `reset()` clears `needRefresh`, `offlineReady` and `updateDismissed`. It keeps `updateServiceWorker` and the install fields: those describe the browser and are captured once per page.
- `_reset()` restores the full initial state: all flags false, `installPrompt` null, the handle null.
- Export a pure selector next to the store, so the UI and the tests share one rule. Export the `PwaStoreState` type, or type the parameter with `Pick`.
  ```ts
  /** Which install affordance the library shows: the native prompt, the iOS instruction, or none. */
  export function selectInstallOption(s: PwaStoreState): 'prompt' | 'ios' | null {
    if (s.standalone) return null
    if (s.installPrompt) return 'prompt'
    return s.iosInstallable ? 'ios' : null
  }
  ```
- Update the store docstring. Only `src/lib/pwa.ts` writes state, with two exceptions: `UpdatePrompt` calls `dismissUpdate`, and the library link calls `setInstallPrompt(null)` after the reader's choice.

### Test hook

The default E2E suite runs on `vite` dev, where there is no service worker, so `needRefresh` can never become true on its own. Add this at the bottom of `pwaStore.ts`:

```ts
// ─── test hook ───────────────────────────────────────────────────────────────
// Dev builds only (stripped from production): lets the default Playwright suite, which runs on
// `vite` dev with no service worker, show UpdatePrompt by driving the store directly.
declare global {
  interface Window { __PWA_STORE__?: typeof usePwaStore }
}
if (import.meta.env.DEV) window.__PWA_STORE__ = usePwaStore
```

- `vite build` replaces `import.meta.env.DEV` with `false`, which makes the assignment dead code. After building, confirm that `dist/assets/index-*.js` does not contain `__PWA_STORE__`, and record the result in Completion Notes.
- The install link needs no hook. A synthetic `beforeinstallprompt` reaches the real listener because `initInstallPrompt()` is not PROD-gated.

### Periodic update check (in `src/lib/pwa.ts`)

```ts
const UPDATE_INTERVAL_MS = 60 * 60 * 1000
const MIN_CHECK_GAP_MS = 60 * 1000

/**
 * Asks the browser to re-check sw.js hourly and whenever the app returns to the foreground.
 * An installed app is usually resumed, not relaunched, and client-side navigation never
 * triggers the browser's own update check, so without this a deploy would go unseen.
 */
function watchForUpdates(registration: ServiceWorkerRegistration): void {
  let lastCheck = Date.now()
  const check = () => {
    if (Date.now() - lastCheck < MIN_CHECK_GAP_MS) return
    if (navigator.onLine === false || registration.installing) return
    lastCheck = Date.now()
    registration.update().catch(() => {}) // offline or server down: try again next time
  }
  setInterval(check, UPDATE_INTERVAL_MS)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
}
```

- Wire it as `onRegisteredSW: (_swUrl, registration) => { if (registration) watchForUpdates(registration) }`.
- `lastCheck` starts at registration time, because registration has just fetched `sw.js`.
- The listeners last for the page's lifetime (registration runs once per page), so they need no cleanup.
- For tests, either export `watchForUpdates` (the boundary rule restricts other *files*, not exports) or drive it through the mocked `registerSW` options. Pick one and note which.
- Do **not** use the vite-pwa docs variant that first `fetch`es `swUrl` with `cache: 'no-store'`. `registration.update()` already bypasses the HTTP cache for the script (`updateViaCache: 'imports'` is the default), and `vercel.json` sets `no-cache` on `/sw.js`.

### Install capture (in `src/lib/pwa.ts`)

```ts
declare global {
  interface Navigator { standalone?: boolean } // iOS Safari only
  interface WindowEventMap { beforeinstallprompt: BeforeInstallPromptEvent }
}

/** True when running as an installed app rather than in a browser tab. */
export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches === true || navigator.standalone === true
}

/** iPhone/iPod/iPad, including iPadOS 13+ which reports a Macintosh UA but has touch. */
export function isIosDevice(): boolean {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

/** iOS major/minor from "CPU iPhone OS 16_4" / "CPU OS 16_4" UAs; null when absent (iPadOS desktop mode). */
function iosVersion(ua: string): [number, number] | null {
  const m = /\bOS (\d+)_(\d+)/.exec(ua)
  return m ? [Number(m[1]), Number(m[2])] : null
}

/**
 * Whether this iOS browser offers Add to Home Screen. Safari always has; Chrome, Firefox and
 * Edge on iOS gained it in iOS 16.4. Unknown version → assume yes. In-app browsers are not
 * detectable and are accepted as a known gap (RT, 2026-11-08).
 */
export function canAddToHomeScreen(): boolean {
  if (!isIosDevice()) return false
  const ua = navigator.userAgent
  if (!/CriOS|FxiOS|EdgiOS/.test(ua)) return true // Safari (or a browser indistinguishable from it)
  const v = iosVersion(ua)
  return v === null || v[0] > 16 || (v[0] === 16 && v[1] >= 4)
}

/**
 * Captures Chromium's install prompt for the library's "Install app" link and records the
 * install context. Not PROD-gated: the event only fires for an installable production build,
 * and tests dispatch it synthetically. Returns a cleanup function (used by tests).
 */
export function initInstallPrompt(): () => void { … }
```

- `initInstallPrompt`:
  1. calls `setInstallContext({ standalone: isStandalone(), iosInstallable: canAddToHomeScreen() && !isStandalone() })`
  2. adds the two `window` listeners
  3. returns a function that removes them
- **The event must be captured at startup, not in `LibraryRoute`.** The browser can fire `beforeinstallprompt` before the library mounts, for example when the reader enters through a `/read/...` deep link. The library may also unmount and remount as the reader navigates. The store keeps the event across both.
- **iOS detection is by device plus browser capability** (RT decision 2):
  - Every iOS browser uses WebKit.
  - Safari has always offered Add to Home Screen. Chrome, Edge and Firefox on iOS gained it from their share menu in iOS 16.4, so `canAddToHomeScreen()` hides the link for those three on older iOS.
  - The version comes from the UA's `OS 16_4` token. A UA without that token (iPadOS "desktop website" mode, which reports Macintosh) counts as capable.
  - Brave and other browsers whose UA is identical to Safari's count as Safari. This is acceptable, since all current ones support the feature.
  - In-app browsers remain a known, accepted gap.
  - Playwright's mobile-safari project (iPhone 14 UA, Safari, iOS 16+) therefore still shows the link.
  - **Do not key iOS detection off `navigator.standalone !== undefined`.** Playwright's WebKit (the mobile-safari project) does not define it, and macOS Safari's support has been inconsistent. Use it only as a positive "is standalone" signal.
- **macOS Safari** (File → Add to Dock) gets no link. That is out of scope.
- jsdom has no `matchMedia`. The optional call `window.matchMedia?.(…)` keeps unit tests safe. Stub `window.matchMedia` in the tests that need `true`.
- The `WindowEventMap` augmentation types `addEventListener('beforeinstallprompt', …)` without casts. Keep the `BeforeInstallPromptEvent` interface in `pwaStore.ts` and import the type here.

### UpdatePrompt (`src/components/UpdatePrompt.tsx`)

```tsx
/** Non-modal "New version available" toast (FR47). Never reloads on its own; the reader chooses. */
export function UpdatePrompt() {
  const { needRefresh, updateDismissed, dismissUpdate } = usePwaStore(useShallow(s => ({ … })))
  const [reloading, setReloading] = useState(false)
  const visible = needRefresh && !updateDismissed

  const reload = () => {
    setReloading(true)
    const update = usePwaStore.getState().updateServiceWorker
    // vite-plugin-pwa reloads the page once the new worker takes control.
    if (update) void update()
    else window.location.reload()
  }

  return (
    // Positioning layer: full width but click-through, so story text beside the toast stays tappable.
    // bottom-16 clears the reader's ~45px mobile tab bar; lg+ has no tab bar.
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-40 flex justify-center px-4 lg:bottom-6">
      {/* Live region stays mounted so the message is announced when it appears. */}
      <div role="status" aria-live="polite">
        {visible && (
          <div className="pointer-events-auto flex flex-wrap items-center gap-3 rounded border border-border bg-surface px-4 py-2 text-sm text-paper-text shadow-md">
            <span>New version available</span>
            <button type="button" onClick={reload} disabled={reloading}
              className="rounded border border-accent bg-accent px-3 py-1 text-paper-text disabled:opacity-60">
              Reload
            </button>
            <button type="button" aria-label="Dismiss" onClick={dismissUpdate}
              className="rounded px-2 py-1 text-muted hover:text-paper-text">
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- `z-40` sits below the reader's SettingsMenu popover (`z-50`), so an open menu covers the toast and not the other way round.
- The offset is fixed (`bottom-16` = 64 px) rather than measured from the tab bar. That leaves about 19 px of clearance in the reader below `lg`, and an unremarkable gap on the library page. Do not make `UpdatePrompt` route-aware.
- On the library page, the toast can float over the footer links (including the install link) while it is showing. That is acceptable: the toast is dismissible and the page scrolls.
- Safe areas: `index.html` has no `viewport-fit=cover` and the status bar style is `default`, so `env(safe-area-inset-bottom)` is 0 and iOS letterboxes the page above the home indicator. Add no safe-area padding.
- At 412 px the text and both buttons fit on one line at `text-sm`. If they wrap, `flex-wrap` lets them; never truncate.
- Disabled state: axe does not check contrast on disabled controls, and the disabled state lasts only until the reload.
- Comments follow `feedback_comment_style`. Use `cn()` only if a class becomes conditional.

### Library install link (in `src/routes/LibraryRoute.tsx`)

Put it inside the existing upload footer block, before the upload button:

```tsx
{/* File upload CTA — always visible at bottom of list.
    The install link (FR45) sits above it: native prompt on Chromium, instruction on iOS,
    nothing when installed. */}
<div className="mt-8 text-center">
  {installOption && (
    <div className="mb-3">
      {installOption === 'prompt' ? (
        <button type="button" onClick={install} className="text-sm underline text-muted">
          Install app
        </button>
      ) : (
        <>
          <button type="button" aria-expanded={iosHelpOpen} aria-controls={iosHelpId}
            onClick={() => setIosHelpOpen(o => !o)} className="text-sm underline text-muted">
            Add to Home Screen
          </button>
          {iosHelpOpen && <p id={iosHelpId} className="mt-1 text-sm text-muted">Tap Share, then Add to Home Screen</p>}
        </>
      )}
    </div>
  )}
  <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm underline text-muted">
    Load a story from your device
  </button>
  {/* …existing upload error, unchanged… */}
</div>
```

- `const installOption = usePwaStore(selectInstallOption)`. The selector returns a primitive, so no `useShallow` is needed. `iosHelpId` comes from `useId()`; `iosHelpOpen` is local `useState(false)`.
- It is a `<button>` styled as a link, the same as the existing upload "link", because it triggers an action rather than navigating. Do not use `<a href>`.
- `install`:
  ```ts
  const install = () => {
    const event = usePwaStore.getState().installPrompt
    if (!event) return
    // prompt() must run inside the click's user activation, before any await.
    event.prompt()
      .then(() => event.userChoice)
      .catch(() => undefined) // already used, or the browser refused
      .finally(() => usePwaStore.getState().setInstallPrompt(null)) // an event can prompt only once
  }
  ```
  - Clearing in `finally` hides the link after **either** outcome, as AC5 requires.
  - Chromium may fire `beforeinstallprompt` again after a dismissal cooldown. The link then returns, which is correct.
- When nothing applies, the wrapper is not rendered, so the footer looks exactly as it does today (AC7).
- If axe flags `aria-controls` pointing at an element that isn't rendered (it normally does not for a collapsed target), always render the `<p>` and toggle the `hidden` attribute instead.
- `muted` (#6B6B6B) on `paper-bg` (#FDF6E3) is about 5.0:1, which passes AA for `text-sm`. The existing upload link already relies on this.
- LibraryRoute is a large route component with upload logic. Keep the addition small. If it grows beyond about 20 lines of JSX plus the handler, extract an `InstallLink` component into `src/components/InstallLink.tsx` (PascalCase named export) and test it directly. Either way is acceptable; note which you chose.

### E2E: `e2e/pwa-ui.spec.ts` (default suite, `vite` dev, all four projects)

- **Toast, desktop:**
  1. `page.goto('/read/genki-i-ch6-tanaka-letter')`.
  2. `page.evaluate(() => window.__PWA_STORE__!.getState().setNeedRefresh(true))`.
  3. `getByRole('status')` contains "New version available".
  4. axe (WCAG tags, same `withTags` helper as `accessibility.spec.ts`) reports no violations.
  5. × hides the toast.
- **Toast, mobile geometry:**
  1. `page.setViewportSize({ width: 412, height: 915 })`, then force the toast.
  2. Assert `toast.boundingBox().y + height <= tablist.boundingBox().y`, using `getByRole('tablist', { name: 'Content tabs' })`. Both boxes come from the same layout, so the Windows display-scaling quirk (memory `project_playwright_snapshots_local`) cannot break this.
  3. Tab focus reaches Reload and Dismiss, and Enter on Dismiss hides the toast.
- **Reload wiring (no worker in dev):**
  1. Before clicking, inject a stub handle with `getState().setUpdateServiceWorker(async () => { (window as any).__updateCalls = ((window as any).__updateCalls ?? 0) + 1 })`.
  2. Click Reload twice.
  3. Assert `__updateCalls === 1` and that the button is disabled.
- **Install link (library):**
  1. `page.goto('/')` and wait for the story cards.
  2. Dispatch a synthetic install event:
     ```ts
     const e = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
       prompt: async () => { (window as any).__prompted = true },
       userChoice: Promise.resolve({ outcome: 'dismissed', platform: '' }),
     })
     window.dispatchEvent(e)
     ```
  3. "Install app" is visible, and its bounding box is **above** the "Load a story from your device" button.
  4. axe the page.
  5. Click "Install app". `__prompted` is true and the link disappears.
  6. The synthetic event behaves the same in every engine, so this test runs in all four projects. In mobile-safari it replaces the iOS link: the deferred event wins in `selectInstallOption`.
- **iOS link:**
  - Runs only in the `mobile-safari` project: `test.skip(testInfo.project.name !== 'mobile-safari')`.
  - On `/`, "Add to Home Screen" is visible above the upload button.
  - Click it: the instruction appears and `aria-expanded` becomes `true`.
  - axe the page.
- **Negative:**
  - In `chromium` with no synthetic event, `/` has no "Install app" and no "Add to Home Screen".
  - Open a story and ⚙: the menu contains neither, which guards RT decision 1.
- Keep `test.use()` out of `describe` blocks (project-context). Add no pixel snapshots (`feedback_visual_regression_tests`).

### E2E: `e2e-pwa/update.spec.ts` (mandatory; real update, Chromium, preview build)

Playwright **cannot route requests for an updated service worker main script** (known limitation, playwright#14711). So the test serves its own copy of the build, which it can change:

1. In `beforeAll`, copy `dist/` (already built by the config's `webServer`) to a temp directory under `os.tmpdir()` with `fs.cpSync(DIST, tmp, { recursive: true })`.
2. Start a tiny `node:http` static server on port **4175** (not 4173 or 4174) that serves `tmp`:
   - correct `Content-Type` for `.js`, `.json`, `.html`, `.css`, `.woff2`, `.png`, `.svg`, `.ico` and `.webmanifest`
   - `Cache-Control: no-cache` for `sw.js`
   - `/` → `index.html`; anything else missing → 404
   - Only `/` is ever navigated, so no SPA fallback is needed.
   - In `afterAll`, close the server and remove `tmp`.
3. Prime the worker the same way as `offline.spec.ts`'s `primeServiceWorker`: goto, `serviceWorker.ready`, reload, then confirm a controller is set. Copy the helper; do not import across spec files.
4. Append `\n// update ${Date.now()}` to `tmp/sw.js`. Different bytes make it a new worker. Its precache revisions are identical, so it installs quickly.
5. Trigger an update check by reloading the page (navigations check for updates). Prefer this over `registration.update()`, because it also exercises "the toast reappears on launch".
6. `expect(page.getByRole('status')).toContainText('New version available')`.
7. Count loads with `let loads = 0; page.on('load', () => loads++)`. Click **Reload**, wait for `load`, then poll for about 2 s and assert `loads === 1`.
8. Assert the toast is not shown, `registration.waiting === null`, and a controller is active.
9. Second test: dismiss, then reload. The toast reappears.

- The config's `baseURL` is 4173, so use absolute `http://localhost:4175/` URLs throughout this spec.
- Use `test.describe.configure({ mode: 'serial' })` in this file, because its tests share one server and one temp copy. `fullyParallel` runs the other e2e-pwa files alongside; the separate port and the temp copy keep this spec from changing what the 4173 preview serves.
- If the update never arrives, the likely causes are:
  - `sw.js` was cached (check the response header)
  - the page was not controlled before the change
- RT has made this spec mandatory. If it proves infeasible (for example, a CI-only flake you cannot fix), stop and ask RT. Do not drop it or mark it `skip`.

### Testing standards (project-context.md)

- Unit tests go in `src/__tests__/`. Globals are on and the environment is jsdom. Add the SPDX header to every new file.
- `pwa.test.ts` already mocks `virtual:pwa-register` with `vi.hoisted` and stubs `navigator.serviceWorker`. Extend that file; do not create a second one.
  - Its `afterEach` order is `unstubAllEnvs`, `restoreAllMocks`, `registerSW.mockReset()`, then `_reset()`.
  - Add `vi.useRealTimers()`, and call the cleanup returned by `initInstallPrompt` to remove its listeners.
  - `watchForUpdates` intervals and listeners live for the page's lifetime by design. Use fake timers and a fresh `registration` mock per test, so a leftover listener can only call an old mock.
- Stubbing browser state in unit tests:
  - `navigator.onLine`: `vi.spyOn(navigator, 'onLine', 'get')`
  - `document.visibilityState`: `Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })`
  - `window.location.reload` is not configurable in jsdom. For the `null`-handle fallback, use `vi.stubGlobal('location', { ...window.location, reload: vi.fn() })`, or a spied wrapper. Pick whichever works in Vitest 3 and jsdom, and note it.
- `LibraryRoute.test.tsx` already follows the route-component pattern from project-context: mocked router hooks and `MemoryRouter`. Reuse its render helper; set the install state with `usePwaStore.setState` before rendering.
- `pnpm test:e2e` needs chromium, firefox, webkit and mobile-safari. `pnpm test:e2e:pwa` needs only chromium.
- `pnpm test:e2e:pwa` builds and serves on port 4173. If 4173 is busy (for example, a leftover `vite preview`), stop that process first. se4-2 needed a temporary 4174 config; avoid repeating that.

### Previous story intelligence

- **se4-1:**
  - In prompt mode the first visit is never controlled; reload to get control.
  - `reset()` keeps the update handle on purpose.
  - The boundary test matches any `serviceWorker` identifier.
  - `registerSW` is mocked with `vi.hoisted`, and `vi.stubEnv('PROD', true)` turns on the registration path.
  - The deferred hourly-update item is this story's AC4.
- **se4-2 (done):**
  - The e2e-pwa suite runs `vite build && vite preview --port 4173 --strictPort` with `fullyParallel`, 2 retries on CI, `outputDir: test-results-pwa`, and the `chromium` project only.
  - If a test navigates while font loads are in flight, the loads fail as `net::ERR_ABORTED`. Wait for `document.fonts.ready` after the cards are visible before navigating.
  - The CI step "PWA offline E2E (Chromium)" already runs `test:e2e:pwa`, so `update.spec.ts` is picked up with no CI change.
- **Review lessons from both:**
  - Assert the whole contract, not a sample.
  - Guard tests must not be bypassable.
  - Mutation-check new specs.
  - Verify in a real browser. A `needRefresh` flag that nothing reads is exactly the "setter without consumer" bug this story exists to close.
- **Recent commits:**
  - `76c7211`: the icon's accent rule was dropped
  - `a448d38`: theme colour is now `surface` #FFFFFF
  - `1b62ee3`: se4-2
  - `fcaf04f`: se4-1 review patches
  - `e9f3704`: se4-1

### Project structure notes

- **New:**
  - `src/components/UpdatePrompt.tsx` (feature component, PascalCase named export)
  - `src/__tests__/UpdatePrompt.test.tsx`
  - `e2e/pwa-ui.spec.ts`
  - `e2e-pwa/update.spec.ts`
  - optionally `src/components/InstallLink.tsx` with its test (see *Library install link*)
- **Modified:**
  - `src/stores/pwaStore.ts`, `src/lib/pwa.ts`, `src/main.tsx`, `src/App.tsx`, `src/routes/LibraryRoute.tsx`
  - `src/__tests__/pwaStore.test.ts`, `pwa.test.ts`, `LibraryRoute.test.tsx`
  - `docs/architecture-web.md`, `docs/development-guide.md`
  - `_bmad-output/planning-artifacts/ux-design-specification.md`, `_bmad-output/planning-artifacts/supp-epic-4-pwa.md`
  - `_bmad-output/implementation-artifacts/deferred-work.md`
- **Not modified:** `SettingsMenu.tsx`, `ReaderRoute.tsx`, `SettingsMenu.test.tsx`, any Playwright config, CI.
- There is no `src/hooks/` folder. The install and platform helpers go in `src/lib/pwa.ts`, which the epic's *Components Affected* table already describes as "exposes update and install state to UI".
- Use the `@/` alias and `cn()` for conditional classes. No arbitrary colours.

### References

- [Source: _bmad-output/planning-artifacts/supp-epic-4-pwa.md#Story se4-3]: original ACs and notes (amended by RT decisions 1–3 above)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#App Install & Updates]: toast UX, no first-visit banners
- [Source: _bmad-output/planning-artifacts/prd.md]: FR45, FR47
- [Source: docs/adr/007-pwa-offline.md]: prompt updates, single registration point
- [Source: _bmad-output/project-context.md#PWA & Offline]: never auto-reload; `navigator.serviceWorker` only in `pwa.ts`
- [Source: _bmad-output/implementation-artifacts/se4-1-web-manifest-icons-and-sw-registration.md]: store design, review decisions, deferred update-check item
- [Source: _bmad-output/implementation-artifacts/se4-2-offline-library-precache-and-offline-e2e.md]: PWA suite config, priming helper, font-abort lesson
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#se4-1]: periodic update check
- [Source: apps/web/node_modules/vite-plugin-pwa/dist/client/build/register.js]: prompt-mode event wiring
- [Source: apps/web/src/routes/LibraryRoute.tsx]: upload footer block (install link goes above the upload button)
- [Source: apps/web/src/routes/ReaderRoute.tsx]: mobile tab bar (in flow, `lg:hidden`, about 45 px)
- [Source: apps/web/e2e/accessibility.spec.ts]: axe helper
- [Source: apps/web/tailwind.config.ts]: token values used in the contrast figures
- [Source: playwright.dev/docs/service-workers; github.com/microsoft/playwright/issues/14711]: updated SW main-script requests cannot be routed

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- `pwa.test.ts`: jsdom has no `navigator.maxTouchPoints`, so `vi.spyOn(..., 'get')` threw "maxTouchPoints does not exist". It is now defined with `Object.defineProperty` and deleted in `afterEach`.
- `pnpm test:e2e:pwa` could not start: port 4173 was held by a leftover `vite preview` (PID 53132, started 13:57 today). Stopping it was not permitted from this session. The identical suite ran through a throwaway copy of `playwright.pwa.config.ts` on port 4174, which has since been deleted.
- The browser-verification script first missed the temporary `Credits` edit because `LibraryRoute.tsx` uses CRLF. Fixed with a line-ending-agnostic regex. The source was restored and verified (`git diff` shows only the se4-3 change).

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- **Store (Task 1):** `pwaStore.ts` gained `updateDismissed`, `installPrompt`, `standalone`, `iosInstallable`, the actions `dismissUpdate`, `setInstallPrompt` and `setInstallContext`, the exported `PwaStoreState`, `BeforeInstallPromptEvent` and `selectInstallOption`, and the DEV-only `window.__PWA_STORE__` hook. `setNeedRefresh(true)` clears `updateDismissed`. `reset()` keeps the handle and the install fields; `_reset()` restores everything. 15 new unit tests, including a table over `selectInstallOption`.
- **Update check (Task 2):** `registerServiceWorker()` passes `onRegisteredSW` to the internal `watchForUpdates()`. That calls `registration.update()` hourly and on becoming visible, never twice within 60 s, skips when offline or installing, and swallows rejections. It is **not exported**: tests drive it through the mocked `registerSW` options, which also checks the wiring. Fake timers are used.
- **Install capture (Task 3):** `initInstallPrompt()`, `isStandalone()`, `isIosDevice()` and `canAddToHomeScreen()` are in `pwa.ts`. `main.tsx` calls `initInstallPrompt()` before `createRoot`. The UA table covers all 8 specified cases plus iPadOS desktop-mode Chrome and macOS Safari.
- **UpdatePrompt (Task 4):** built as specified and mounted after `<Router />` in `App.tsx`. The `null`-handle fallback test uses `vi.stubGlobal('location', { ...window.location, reload })`, which works in Vitest 3 with jsdom.
- **Install link (Task 5):** **inline in `LibraryRoute.tsx`**, with no `InstallLink` extraction: about 25 lines of JSX plus the handler, close to the threshold. 5 new tests, listed under "NEW (se4-3)" in the AC Tracking block.
- **E2E (Tasks 6-7):** `e2e/pwa-ui.spec.ts` gives 18 passes and 6 by-design skips across the four projects. The keyboard check passes in WebKit and mobile-safari too. `e2e-pwa/update.spec.ts` passes 2/2. **Mutation checks:** with Reload made a no-op, the spec failed (timed out waiting for `load`). With the toast no longer gated on `needRefresh`, the spec failed ("Expected: empty", after priming). The code was restored byte-identical each time.
- **Docs (Task 8):** updated the *Updates* row and added an *Install* row in `architecture-web.md`; added an "Update prompt" recipe to `development-guide.md`; amended the UX spec bullet and the epic (Components row, ACs, Notes); marked the deferred-work item resolved.
- **Browser verification (Task 9), Playwright-driven Chromium, `pnpm dev`:**
  - At 412 px (Pixel UA, DPR 2.625), the toast's bottom edge is 17 px above the tab bar.
  - A tap point beside the toast hits the story sentence (`div[role=group]`).
  - Tab moves Reload → Dismiss, and Enter hides the toast. The focus ring is visible (screenshot checked).
  - At 1280 the toast sits centred, 24 px from the bottom.
  - The synthetic `beforeinstallprompt` showed "Install app" 16 px above the upload link. Both are 14 px, `rgb(107,107,107)`, underlined, at 412 and 1280.
  - With no link, the footer is unchanged: the upload button is the first child of `mt-8`.
  - iPhone 14 emulation shows "Add to Home Screen", which reveals the instruction.
- **Real update, `vite preview` (port 4177, because 4173 was busy):**
  - The temporary label "Credits (v2)" was rebuilt into `dist/`.
  - After 65 s, a visibility change made the toast appear **without a reload**.
  - Reload gave `loads=1`. The new label was visible, no worker was waiting, and the toast had cleared.
  - For v3, a reload brought the toast; × hid it; another reload brought it back while the page still showed v2.
  - The source was reverted and `dist/` rebuilt.
- **Cancel behaviour (found in RT's manual Chrome check):** after Cancel, Chrome fires a fresh `beforeinstallprompt` straight away (RT confirmed it in the console), so the link stays visible. A session-only `installDeclined` flag to hide it was built, then removed at RT's request: **RT decided the link may stay after a cancel.** This supersedes Task 9's "Cancel. The link should hide." Kept from that work: the install handler now clears only the event it used (`installPrompt === event`), so a fresh event arriving before `userChoice` settles is never wiped. 2 new LibraryRoute tests (fresh event after cancel keeps the link; fresh event before the choice is not cleared). Mutation check: with the guard removed, the second test fails. Updated the `architecture-web.md` Install row and annotated the epic AC.
- **Install (Chrome), verified by RT:** the native dialog opens from "Install app"; Cancel leaves the link showing (Chrome re-offers install; accepted by RT, see above); omnibox install, standalone window and uninstall all checked. A stale service worker from earlier testing first served a pre-se4-3 build: *Clear site data* fixed it. The real update toast was also seen when the fix was rebuilt under a running preview.
- **Install dialog content (RT's request, beyond the story ACs):** Chrome's install dialog text cannot be changed, but a manifest with `screenshots` gets the richer dialog, which also shows the manifest description. Added two screenshots from RT (`public/screenshots/library.png`, `reader.png`, 713×808, title bar and window border cropped), marked `form_factor: 'wide'` so the desktop dialog shows them side by side; RT checked the dialog. They are kept out of the precache (`workbox.globIgnores`). RT reworded the description, changed in `vite.config.ts` and the `index.html` meta description together. New tests: `pwaManifest.test.ts` checks each screenshot's declared size against the PNG; `precache.spec.ts` checks screenshots are built but not precached.
- **Hook stripped:** after `vite build`, no file in `dist/assets/*.js` contains `__PWA_STORE__`.
- **Gates (Task 10):** `pnpm typecheck` ✓; `pnpm run lint` ✓; `pnpm test:unit` (root) ✓ (web 352, story-loader 34, story-generator 280). `pnpm test:e2e` ✓: 142 passed, 42 skipped (Linux-only pixel snapshots plus project-gated cases), 0 failed. The mobile-safari library axe test and golden-path, file-upload and smoke all pass. No baselines changed. The PWA suite first passed 17/17 on port 4174 while 4173 was busy; after RT approved force-stopping the leftover preview, `pnpm test:e2e:pwa` passed 17/17 on 4173.

### File List

- `apps/web/src/stores/pwaStore.ts` (modified)
- `apps/web/src/lib/pwa.ts` (modified)
- `apps/web/src/main.tsx` (modified)
- `apps/web/src/App.tsx` (modified)
- `apps/web/src/routes/LibraryRoute.tsx` (modified)
- `apps/web/src/components/UpdatePrompt.tsx` (new)
- `apps/web/src/__tests__/pwaStore.test.ts` (modified)
- `apps/web/src/__tests__/pwa.test.ts` (modified)
- `apps/web/src/__tests__/LibraryRoute.test.tsx` (modified)
- `apps/web/src/__tests__/UpdatePrompt.test.tsx` (new)
- `apps/web/e2e/pwa-ui.spec.ts` (new)
- `apps/web/e2e-pwa/update.spec.ts` (new)
- `apps/web/e2e-pwa/precache.spec.ts` (modified)
- `apps/web/src/__tests__/pwaManifest.test.ts` (modified)
- `apps/web/vite.config.ts` (modified)
- `apps/web/index.html` (modified)
- `apps/web/public/screenshots/library.png` (new)
- `apps/web/public/screenshots/reader.png` (new)
- `docs/architecture-web.md` (modified)
- `docs/development-guide.md` (modified)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (modified)
- `_bmad-output/planning-artifacts/supp-epic-4-pwa.md` (modified)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

## Change Log

- 2026-11-08: Implemented se4-3. Added the update toast, the library install link, install capture, the periodic update check, unit and E2E tests (including the real-update spec, mutation-checked), and the docs and planning amendments. Pending RT: the manual Chrome install check.
- 2026-11-08: `pnpm test:e2e:pwa` run on port 4173 (17/17) after the leftover preview was stopped; Task 10 complete.
- 2026-11-08: Install link after Cancel: a hide-for-the-session fix was tried and reverted; RT decided the link may stay (Chrome re-offers install). Kept a guard so the handler never clears a newer event.
- 2026-11-08: RT completed the manual Chrome install check; Task 9 complete. Status → review.
- 2026-11-08: Added install-dialog screenshots and RT's new app description (manifest and meta description).
- 2026-11-08: Code review (e4715c8..419a558): 3 decisions (2 accepted by RT, 1 became a patch), 9 patches applied — Reload fallback when no worker waits and re-enable after re-show, own updatefound listener for later deploys, online-triggered check, narrow install screenshots, docs and test hardening. Unit 364/364, `test:e2e:pwa` 18/18 (port 4179; 4173 held by a manual preview), `pwa-ui.spec` 18 passed / 6 skipped by design. Status → done.
