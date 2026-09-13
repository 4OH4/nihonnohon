# InfoPanel — UI design and layout contract

Hand-written reference for the reader's word-lookup panel: the constraints its layout
rests on, why each one is there, and what will break if it changes.

The **intent** behind the panel (what it is for, how it should feel) lives in
[`ux-design-specification.md`](../_bmad-output/planning-artifacts/ux-design-specification.md),
under *InfoPanel*. This document is the **implementation contract** — the numbers, the
measured browser behaviour, and the decisions that are not obvious from reading the
component. Where the two disagree, the divergences are listed at the end.

Source: [`InfoPanel.tsx`](../apps/web/src/components/InfoPanel.tsx) ·
[`KanjiBreakdown.tsx`](../apps/web/src/components/KanjiBreakdown.tsx) ·
[`textSize.ts`](../apps/web/src/utils/textSize.ts) ·
tests in [`infopanel-layout.spec.ts`](../apps/web/e2e/infopanel-layout.spec.ts)

---

## 1. Why this panel is hard

The panel is a dense reference card in a **fixed-height box** whose font size the user
controls. Every constraint below follows from those two facts pulling against each
other: at the largest text size on a narrow phone, there is barely enough room, and
the content is variable-length dictionary data.

It has regressed repeatedly, because on a desktop viewport the panel is ~64em wide and
*any* arrangement fits. The failures only appear at ~15em. **Verify changes at 412px,
not by eye on desktop.**

---

## 2. The layout contract

### Fixed height, expressed in `em`

```
h-[5.5em] lg:h-[4.5em]   +  style={{ fontSize: 'var(--story-font-size)' }}
```

The height is **hard-fixed, not `min-h`**. The panel sits above the story text, so a
panel that grows on lookup pushes the story down and the reader loses their place.
Expressing it in `em` against `--story-font-size` means it scales with the chosen text
size instead of clipping more at larger sizes.

Content that exceeds it **scrolls** inside `overflow-y-auto`, under a gradient fade
hint that appears only when there is more to see (`canScrollDown`). Clipping silently
is not acceptable; scrolling with an affordance is.

### Two columns, with the width as an input

```
[ reading / translation  flex-1 min-w-0 ]  [ KanjiBreakdown  w-[45%] shrink-0 ]
```

The breakdown's width is an **input, not an output of its own text**. This is the fix
for [issue #19](https://github.com/4OH4/nihonnohon/issues/19): sized to content, a cell
takes its keyword's max-content width — `"public chamber/hall"` on one unbreakable
line — which both crowds out the translation column and stops the keyword ever
wrapping. The cell's width came from the very text it was meant to wrap.

It is **fixed at 45%, not merely capped**, so characters keep the same screen position
between lookups. Under a cap the column is as wide as its widest keyword, so characters
jump ~80px sideways when you tap a word with shorter keywords — which reads as the
panel lurching under your thumb.

The cost is deliberate: a word with short keywords leaves whitespace beside them, and
the translation column, now a fixed 55%, wraps sooner than it strictly needs to.

### `leading-tight` throughout

The default 1.5 line-height spends a third of every line on whitespace and pushes the
translation out of view on mobile. At `leading-tight` (1.25) one line is
`1.25 × font-size`.

---

## 3. The height budget, with numbers

At a 412px viewport and the `large` text size — the worst supported case:

| Quantity | Value | Where from |
|---|---|---|
| `--story-font-size` | **27.88px** | `clamp(1.5rem, calc(2rem - 1vw), 2rem)` at 412px |
| Panel height (`5.5em`) | **153px** | `5.5 × 27.88` |
| Vertical padding (`py-2`) | 16px | `0.5rem × 2` |
| **Usable height** | **~137px** | what content must fit in |
| One line (`leading-tight`) | **34.85px** | `1.25 × 27.88` |

So the panel holds **three lines comfortably and four only just**. A single extra
wrapped line is the difference between fitting and scrolling — which is exactly what
section 4 is about.

Measured for comparison: the kanji breakdown is **121.41px** tall for a two-kanji word,
so it is *not* the column that overflows. The reading/translation column is.

---

## 4. Hyphenation — the engine divergence

**This is the least obvious thing about the panel, so it is documented in full.**

The meaning paragraph carries `hyphens-auto break-words`:

```tsx
<p lang="en" className="text-paper-text hyphens-auto break-words">
```

### What was measured

`hyphens: auto` **works on Chromium and Firefox and does nothing on WebKit and Mobile
Safari** on the Linux CI runner (the Playwright WebKit build has no hyphenation
dictionaries). For the vocab entry 食堂 / しょくどう / "cafeteria; dining commons" at
412px and `large`:

| | Chromium | Firefox | WebKit | Mobile Safari |
|---|---|---|---|---|
| Meaning paragraph | 69.69 (2 lines) | 69.70 | **104.53 (3 lines)** | **104.53** |
| …with `hyphens: none` | **104.53** | 104.55 | 104.53 *(no change)* | 104.53 |
| …with the POS pill hidden | 69.69 | 69.70 | 104.53 | 104.53 |
| …with `overflow-wrap: normal` | 69.69 | 69.70 | 104.53 | 104.53 |
| Left column total | 135.02 | 135.05 | **169.86** | **169.86** |
| Overflow (`clippedBy`) | 0 | 0 | **33px** | **33px** |

Chromium and Firefox hyphenate to fit two lines. WebKit cannot, so it needs three.
Disabling hyphens moves Chromium to 104.53 — WebKit's number exactly. The
part-of-speech pill and `overflow-wrap` are both innocent.

`169.86 − 137 = 32.86` accounts for the 33px overflow to the pixel.

### It is *not* a typeface difference

Worth stating plainly, because it was assumed to be one and a whole remediation plan
was built on that premise. All engines resolve the same face at the same metrics:

| | Chromium | Firefox | WebKit | Mobile Safari |
|---|---|---|---|---|
| Probe width, panel's own font | 372.99 | 374.70 | 372.99 | 372.99 |
| Same probe in DejaVu Sans | 372.99 | 374.70 | 372.99 | 372.99 |
| Resolved font size | 27.88px | 27.88px | 27.88px | 27.88px |
| Column width | 197.00px | 197.00px | 197.00px | 197.00px |

Same box, same font, same text — **one extra line**. Declaring a `font-family` stack
cannot converge this.

### How to measure which face an engine actually chose

`getComputedStyle(el).fontFamily` returns the **author's declared list**, not the
resolved face. Every engine echoes back the same `ui-sans-serif, system-ui, …` string,
so it cannot answer "do these two engines agree?" — it will look like convergence when
there is none.

Use a canvas metric fingerprint instead: measure one probe string with the element's
own computed font spec, then under named candidate families, and compare widths. Named
candidates only discriminate where those faces are installed (the CI runner, not a
Windows dev box).

### What we do about it

**Accept it.** A WebKit or Mobile Safari reader at the largest text size scrolls the
last line of a long translation under the fade hint. Nothing the app declares can fix a
missing browser capability, and this trade-off was already accepted when the panel was
given a fixed height.

The test bound reflects that: 食堂 is allowed **one wrapped line** (`lineH + 4`) while
高校生 keeps `<= 4`. Quantised as a *line* rather than a pixel constant, because one
wrapped line is the smallest non-zero overflow text can produce and two would mean a
real regression — and because a pixel constant would be hostage to runner font changes.

**The cost, stated:** at `lineH + 4`, a genuine one-line regression on Chromium or
Firefox would pass unnoticed for that word. No engine-free bound avoids this, since the
assertion has to admit the loosest engine. The `[panel-metrics]` line logged on every
CI run is what makes that visible if it happens.

**Trigger to re-tighten:** if WebKit ever gains hyphenation, its `meaningH` drops to
~69.7 in that log, and the bound can go back to `<= 4` for both words.

### What not to do

- **Don't remove `hyphens-auto` to get cross-engine parity.** It would take Chromium
  and Firefox to three lines too — parity by making the common case worse.
- **Don't deepen the panel or shrink the meaning text** to make it fit. That is a
  product change against a deliberate constraint, and it would change every engine to
  accommodate one. Escalate rather than silently reverse it.
- **Don't branch the assertion on `browserName`.** It normalises divergence and invites
  a second branch later. Split by *content* instead, as the current test does.

---

## 5. Fonts

### Japanese — Noto Sans JP, self-hosted

Imported in [`main.tsx`](../apps/web/src/main.tsx) from `@fontsource/noto-sans-jp`, and
applied through the Tailwind `font-ja` family. **Always apply `font-ja` to Japanese
text.**

Two axes are narrowed deliberately:

- **Weights: 400 and 600 only** — the two Japanese text actually renders at (400
  throughout; 600 for the looked-up word). The Google Fonts link this replaced requested
  400/500/700, shipping a weight nothing used and omitting the one used most, so 600 was
  being synthesised from a neighbour.
- **Subsets: consolidated `japanese` + `latin`** — not the all-subsets entry point,
  which splits CJK into 120 numbered chunks per weight and also pulls in cyrillic, greek
  and vietnamese. Measured on the built output: **12.96MB** of emitted font files that
  way against **2.08MB** this way. `latin` is 13KB and keeps digits and romaji inside a
  `font-ja` element in the same face as the Japanese around them.

`dist` is **6.71MB**, up from 1.83MB. Of that increase, 2.80MB is the legacy `.woff`
fallback that no woff2-capable browser requests; it is retained deliberately.

**Why self-hosted rather than a CDN.** It kept a third party inside the pixel-snapshot
suite (seven of nine baselines render Japanese, and with `display=swap` a slow response
captures a fallback face — which CI would then regenerate and commit as the baseline);
it degraded a Japanese *reading* app wherever Google Fonts is blocked; and it disclosed
every reader's IP on each page load. Switching produced **no pixel change** to any
baseline.

Bundling the font files is redistribution, so the SIL Open Font License attribution
lives on the Credits page.

### Latin — no declared family

**There is no `font-family` declared for Latin text anywhere in the app.**
[`index.css`](../apps/web/src/index.css) declares none, and
[`tailwind.config.ts`](../apps/web/tailwind.config.ts) extends `fontFamily` with `ja`
only — it never defines `sans`.

So the meaning paragraph inherits Tailwind Preflight's default, which begins
`ui-sans-serif, system-ui, …`. Both are *generic keywords*, not family names: each
browser resolves them to "the OS UI font" through its own path. On the CI runner all
engines land on DejaVu Sans metrics (measured above), so this is **not** currently a
source of divergence — but it is undeclared, and that is worth knowing before assuming
it is stable.

### Guards

[`fonts.spec.ts`](../apps/web/e2e/fonts.spec.ts) asserts no request reaches
`fonts.googleapis.com`/`fonts.gstatic.com`, that the story body really renders in the
face rather than a fallback, and that every declared weight is served. The **sample text
in `fonts.check()` is load-bearing** — the face is split by `unicode-range`, so checking
without it passes on the latin subset alone while every kanji is in a fallback. The nine
snapshot captures also await `document.fonts.ready`, so a capture cannot land mid-swap.

---

## 6. The tested invariants

From [`infopanel-layout.spec.ts`](../apps/web/e2e/infopanel-layout.spec.ts), measured at
412×915 unless noted. These encode the contract above; read them before changing the
layout.

| Invariant | Assertion |
|---|---|
| The panel really is narrow at this size | `panelW < 500` |
| Breakdown holds its share, no more | `breakdownPct <= 46` |
| Translation column keeps its share | `leftPct >= 45` |
| Characters don't move between lookups | `b.charX === a.charX` |
| Breakdown stacks one kanji per row on mobile | distinct `rowTops` |
| Long keyword wraps rather than widening its cell | taller cell for 堂 than 食 |
| Content fits — one wrapped line allowed for 食堂 | `clippedBy <= lineH + 4` / `<= 4` |
| A 330px phone degrades to scrolling, not clipping | `clippedBy < panelH * 0.4` |
| Desktop keeps the breakdown on one row | one distinct `rowTop`, `clippedBy <= 2` |

Two testing notes that cost real time to learn:

- **Only CI can confirm these pixel numbers.** `useCssViewport` compensates for WebKit
  on Windows laying out at the host's display-scaling factor, but it does so by
  enlarging the viewport — which grows `1vw`, so `--story-font-size` resolves to 26.85px
  locally where a true 412px viewport gives 27.88px. It is inert on the Linux runner.
- **Pixel baselines are linux-only** and skipped elsewhere; font rasterisation and
  hinting differ per OS well beyond the 2% diff ratio.

---

## 7. Known divergences from the UX specification

| Spec says | Implementation | Why |
|---|---|---|
| UI text in `Inter` | No Latin family declared at all | Never implemented; see §5 |
| InfoPanel height "fixed with `min-h`" | Hard `h-[5.5em]` | `min-h` lets the panel grow and push the story text |
| Height "approx 110–140px on mobile" | 153px at `large` | Height is `em`-relative, so it scales with text size |
| Lookup anatomy: word → translation → reading → breakdown | word → reading → translation | Reading sits with the word; both are `font-ja` |

---

## 8. Changing this safely

1. **Measure at 412px**, and at the `large` text size. Desktop tells you nothing here.
2. **Verify in a real browser** (`pnpm dev`) for anything touching CSS visibility,
   spacing or layout — a store-only test cannot catch a setter with no consumer.
3. **Read the `[panel-metrics]` line** from the CI run for per-engine numbers, rather
   than reasoning about what the engines "should" do. That habit is the only reason the
   hyphenation cause in §4 is known.
4. **Don't write a justification into a comment until it has been measured** on the
   platform the assertion runs on. A confidently-worded comment asserting an unmeasured
   premise is what put the 33px overflow into CI for five weeks.
