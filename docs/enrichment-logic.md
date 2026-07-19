---
generated: 2026-07-19
part: story-generator-backend
status: specification
---

# Enrichment Logic — Language Processing Specification

This document specifies how a finished Japanese sentence should be processed into an annotated
reader form: where to split it into words, how to generate ruby (furigana) for kanji, how to choose
the dictionary form of each word, and how to classify its part of speech. It describes the intended
**linguistic behaviour** only.

Worked examples throughout use the sentence 私は毎朝六時に起きます。 ("I get up at six every morning").

---

## 1. Word segmentation — where to split

A sentence is partitioned into **surface tokens**: contiguous slices of the original text, taken
exactly as written, with nothing added, removed, or normalised. Concatenating the tokens back
together (no spaces) must reproduce the sentence character-for-character.

### Principle A — the split test

Every rule below is one test: **split at a boundary only when doing so leaves a unit the
learner can recognise on each side; otherwise keep the token whole.** A recognisable unit is,
in order of strength:

1. **A free-standing word** as the vocabulary list teaches it — a noun, a fully-conjugated verb
   or adjective, the copula, a te-form helper, a particle. Splitting a free-standing word off is
   always preferred, so it appears exactly as it was studied.
2. **A bound stem that still reads as a lexical unit** — chiefly the honorific お+stem nominal
   (お待ち · お読み · お会い). Not a complete word, but recognisable, and isolating it lets the free
   word after it (ください · になる · する) stand alone (rule 8). Here clarity for the learner
   outweighs strict completeness.

What is **never** left stranded is a bare inflectional stem — 食べ · 行き · 大き · 寒く — the residue
of pulling a tense, polarity, or politeness ending off a word; the inflected word stays whole
instead (rules 1–4). The token boundaries fixed here feed the base-word lemma of §3: a conjugated
or derived token still resolves to the plain dictionary form of its head word, so it binds to the
vocabulary entry the learner studied, whatever grammar is wrapped around it.

### Rules

1. **A conjugated verb or adjective stays whole.** The word is one token together with *all* of its
   inflection — every tense, plain or polite, affirmative or negative — because splitting an ending
   off would leave a bare stem that is not itself a word (食べ, 行き, 大き, 寒く):
   - Verbs: 食べます · 食べる · 食べた · 食べない · 食べなかった · 食べて · 行きましょう · 食べよう ·
     食べませんでした → one token each
   - i-adjectives: 大きい · 大きかった · 大きくない · 大きくなかった · 早く → one token each
2. **A sentence-final copula or presumptive auxiliary is its own token.** Each attaches to an
   already-complete word, so splitting it off leaves that word bare, exactly as the vocabulary list
   teaches it. Three groups:
   - **The copula** — です · でした · だ · だった — predicating a noun or na-adjective (and です also
     politeness-marking an i-adjective):
     - 大きいです → 大きい · です
     - 大きかったです → 大きかった · です
     - 学生です → 学生 · です
     - 学生でした → 学生 · でした
     - 静かです → 静か · です
     - 学生だ → 学生 · だ
     - 学生だった → 学生 · だった
     - 静かだった → 静か · だった
   - **The negative copula** — じゃない · じゃありません · ではない · ではありません, and the past
     じゃなかった · じゃありませんでした — the negative of だ / です. It splits off the noun or
     na-adjective it negates just as the plain copula does, and takes だ as its lemma (§3 rule 5). A
     fused polite negative (…ありません / …ありませんでした) stays whole, exactly as ませんでした does
     (rule 1); a plain じゃない / じゃなかった is followed by the politeness です, which splits:
     - 学生じゃないです → 学生 · じゃない · です
     - 学生じゃありません → 学生 · じゃありません
     - 学生じゃなかったです → 学生 · じゃなかった · です
     - 学生じゃありませんでした → 学生 · じゃありませんでした
   - **The presumptive でしょう · だろう** ("probably") — which attaches to a fully-formed word of
     *any* class, verbs and i-adjectives included, and always splits:
     - 大きいでしょう → 大きい · でしょう
     - 行くでしょう → 行く · でしょう
     - 学生だろう → 学生 · だろう
     - 大きかっただろう → 大きかった · だろう
     - 行くでしょうか → 行く · でしょう · か (the question particle か splits, rule 5)

   A でした that is merely *part of* a verb conjugation does not split: ませんでした stays whole
   (食べませんでした is one token — that でした is verb inflection, not a sentence-final copula).
3. **A helper verb following a te-form is its own token.** The te-form is already a complete word
   (rule 1), so the verb that follows it — いる · ある · おく · しまう · みる · いく · くる · あげる ·
   くれる · もらう — and the request word ください stand as separate tokens, exactly as Genki teaches
   each pattern (te-form + helper):
   - 食べています → 食べて · います
   - 食べてしまいました → 食べて · しまいました
   - 読んでいる → 読んで · いる
   - 書いてください → 書いて · ください

   Each helper is a fully conjugated word and so stays whole within its own token (rule 1):
   しまいました is one token, not しまい · ました. A particle inside a pattern still splits (rule 5), so
   the pieces fall out on their own: 食べてもいいです → 食べて · も · いい · です.
4. **A na-adjective before a noun keeps its attributive な.** The な marking a na-adjective that
   modifies a noun is part of the adjective's attributive form and stays inside its token — it is
   *not* split off the way the predicative copula です is (rule 2):
   - 静かな公園 → 静かな · 公園
   - 有名な建物 → 有名な · 建物
   - きれいな花 → きれいな · 花

   The predicative copula still splits, leaving the adjective bare: 静かです → 静か · です,
   静かだった → 静か · だった.
5. **Each particle is its own token**, including sentence-final and question particles:
   は を に で へ が と も の から まで か ね よ … — one token each. **Multi-character conjunctive
   particles are single tokens, never split into their kana** — ので · のに · けど · けれど · し are
   one token each, not の · で or の · に (they are conjunctive particles, not the possessive の plus
   a copula or particle). Like から, they are tagged `prt` and, as function words, carry no gloss (§5).
6. **Each punctuation mark is its own token.** 。 、 ？ stand alone.
7. **A proper name is split from its honorific.** the proper noun and the honorific are separate tokens. The proper noun is tagged using the `name` Part of Speech tag.
- たろうさん → たろう · さん
8. **An honorific stem frame splits off its free word.** The polite お+stem constructions of Genki
   ch.19–20 — お + stem + ください, お + stem + になる, お + stem + する — split into the honorific stem
   and the free word that follows it, because that word (ください · になる · する) is complete on its
   own, exactly as with a te-form helper (rule 3). The お+stem nominal is a recognisable unit and
   stands as its own token even though it is not a full word (Principle A):
   - お待ちください → お待ち · ください
   - お読みになります → お読み · になります
   - お会いしました → お会い · しました

   The honorific stem token takes the base verb as its lemma (お待ち → 待つ, §3 rule 7), so it still
   binds to the vocabulary the learner studied. Special honorific and humble verbs that are single
   lexical words — いらっしゃる · なさる · おっしゃる · 申す · 参る — are one token each, not a frame,
   and are not split.
9. **The tokens tile the sentence exactly.** Together they are a partition of the sentence, never a
   paraphrase of it — no gaps, no overlaps, no reordering.

### What the rules imply

- A token is the *inflected word*, not its dictionary lemma. All verb and adjective conjugation —
  past ~た / ~かった, negative ~ない / ~くない, past-negative ~なかった / ~くなかった, te-form ~て,
  volitional ~ましょう / ~よう, and the polite ending ます — stays inside the token, because the stem
  left behind (食べ, 大き, 寒く) is not a word.
- **The exception is a sentence-final copula (including its negative じゃない / じゃありません) or
  presumptive auxiliary** — です / でした / だ / だった / でしょう / だろう — split off (rule 2) so the
  complete word before it appears bare, as the vocabulary
  list teaches it. Each follows an already-complete word (でしょう / だろう even a full verb), so the
  split never strands a fragment. Every fused conjugation ending — past ~かった, negative ~なかった,
  the polite ます — stays attached instead, because removing it would leave a bare stem (食べ, 大き)
  that is not a word.
- A te-form links to a following helper verb across a token boundary: 食べています → 食べて · います,
  書いてください → 書いて · ください (rule 3). The attributive な, by contrast, stays *inside* the
  na-adjective: 静かな公園 → 静かな · 公園 (rule 4).
- Lexical compounds that read as a single unit stay whole: 毎朝 · 六時 · 月曜日 · 日本語 · 図書館 ·
  週末. Do not break 日本語 into 日本 + 語.
- A word written in mixed kanji and kana is still one token: 朝ごはん · 友だち · おふろ.

For 私は毎朝六時に起きます。 the split is: 私 · は · 毎朝 · 六時 · に · 起きます · 。
For 大学はとても大きいです。 the split is: 大学 · は · とても · 大きい · です · 。
For 私は本を読んでいます。 the split is: 私 · は · 本 · を · 読んで · います · 。
For 静かな公園を歩きます。 the split is: 静かな · 公園 · を · 歩きます · 。

---

## 2. Ruby (furigana) — kanji only

Ruby is a reading annotation attached to a token, written `kanji-run[reading]`, with any trailing
kana (okurigana) left bare, outside the brackets:

```
食べて       → 食[た]べて
勉強します    → 勉強[べんきょう]します
起きます      → 起[お]きます
帰っ         → 帰[かえ]っ
朝ごはん      → 朝[あさ]ごはん
六時         → 六時[ろくじ]
```

### The rules that define it

1. **Only tokens that contain a kanji are annotated.** A token with no kanji carries ruby equal to
   its own surface — no brackets. This covers particles (は を に), kana adverbs (とても · ときどき),
   kana nouns (テレビ · クラス · おふろ), kana adjectives (おもしろい), the copula です · だ, and the
   presumptive でしょう · だろう. "Kanji" here means a CJK ideograph or one of the iteration marks
   々 〻 〃.
2. **Okurigana stays outside the brackets.** Trailing kana that are shared between the word and its
   reading are matched off the end and kept bare; only the kanji run and the reading of *that run* go
   inside the brackets. 食べて has shared tail べて → 食 + [た] + べて.
3. **A word ending in kanji puts its whole reading in the brackets.** 勉強 → 勉強[べんきょう];
   六時 → 六時[ろくじ].
4. **Reading is resolved per kanji run, then joined.** When a token has more than one kanji run
   separated by kana, each run is annotated with its own reading and the pieces are concatenated —
   e.g. 朝ごはん → 朝[あさ] + ごはん.

Readings are the contextually correct on/kun reading for the word as used — homographs (e.g. 今日
きょう vs こんにち) take the reading the sentence calls for.

Every occurence of kanji is annotated, including where the same word appears multiple times in a story. The decision on how kanji are presented is deferred to the reader application, so all kanji are annotated in the story file. 

---

## 3. Dictionary form — the lemma of each word

Every token resolves to the dictionary (lemma) form of its **head word** — the meaning-bearing core,
with inflection removed:

1. **Inflection inside a token is stripped.** The polite ending ます, past-tense た, te-form て and
   similar suffixes are removed to reach the lemma; the word underneath them is the head.
2. **A verb or adjective resolves to its plain dictionary form, whatever its tense or polarity.**
   食べて → 食べる · 行きます → 行く · 食べなかった → 食べる · 行きましょう → 行く · 大きい → 大きい ·
   大きかった → 大きい · 大きくなかった → 大きい · 早く → 早い · 疲れた → 疲れる.
3. **A noun + する compound resolves to `noun + する`.** 勉強します → 勉強する.
4. **A plain noun, pronoun, or adverb is its own lemma.** 私 → 私 · 大学 → 大学 · とても → とても.
5. **The split auxiliaries are their own lemma** — です · でした → です; だ · だった → だ;
   the negative copula じゃない · じゃありません · ではありません → だ; でしょう → でしょう; だろう → だろう
   — and particles and punctuation are their own lemma (は → は · 。 → 。).
6. **A split te-form helper verb resolves to its own dictionary form** — います → いる; しまいました →
   しまう; ください → くださる (§1 rule 3). An **attributive na-adjective** drops its な to reach the
   bare lemma the vocabulary list teaches: 静かな → 静か; 有名な → 有名 (§1 rule 4).
7. **A derived or honorific form resolves to its base word.** Derivational morphology —
   causative (食べさせる → 食べる), potential (行ける → 行く), passive (食べられる → 食べる), desiderative
   たい (食べたい → 食べる), and stem suffixes such as すぎる · やすい · にくい (食べすぎる → 食べる) —
   reports the plain dictionary form of the base word, not the derived stem, so the token binds to
   the vocabulary entry the learner studied. The derived construction is carried by the token's POS
   class (§4) and by the sentence's grammar tags, not by its lemma. An honorific stem frame likewise
   reports its base verb: お待ち → 待つ (§1 rule 8).

Because です is a separate token (§1), the adjective or noun before it stands alone: 大きいです is two
tokens — 大きい (lemma 大きい) and です (lemma です) — so the adjective appears exactly as the
vocabulary list teaches it, with no ending attached.

---

## 4. Part of speech

Each token is classified by the part of speech of its head word. Verbs additionally carry their
conjugation class, because it governs how they inflect:

| Tag | Meaning |
|-----|---------|
| `n` | noun |
| `pron` | pronoun |
| `v1` | ichidan verb (一段) |
| `v5` | godan verb (五段) |
| `v-irr` | irregular verb — する / くる, and noun + する compounds |
| `adj-i` | i-adjective |
| `adj-na` | na-adjective |
| `adv` | adverb |
| `conj` | conjunction |
| `prt` | particle |
| `aux` | copula (incl. negative) & presumptive — です · でした · だ · だった · じゃない · じゃありません · でしょう · だろう |
| `punct` | punctuation |
| `name` | proper noun, including names (people, places, business etc) |

The split copula, negative copula, and presumptive auxiliaries (です · でした · だ · だった · じゃない ·
じゃありません · でしょう · だろう) are all `aux`; the complete word each follows is tagged independently
by its own class (行くでしょう → 行く `v5` · でしょう `aux`).

A split te-form helper verb is a separate token carrying its own verb class — います `v1` ·
しまいました `v5` · ください `v5` (§1 rule 3). The attributive な stays inside the na-adjective, which
keeps its `adj-na` tag (静かな `adj-na`, §1 rule 4).

A derived form (causative, potential, passive, desiderative たい, ～すぎる …) carries the POS of the
form **as it inflects** — a causative or potential in せる/させる/られる is `v1`, because those endings
inflect ichidan — while its lemma is the base verb (§3 rule 7). An honorific stem token carries its
base verb's own class (お待ち → 待つ, `v5`).

The classification is scoped by need: the dictionary form matters for content words; ruby matters for
kanji-bearing tokens; a definition is looked up for content words and for the presumptive でしょう · だろう.

---

## 5. Glossing — which words get a definition

A short English definition is attached to **content words** — nouns, verbs, adjectives, adverbs,
pronouns, conjunctions — and to the **presumptive auxiliary でしょう · だろう** ("probably; I suppose"),
which carries meaning worth looking up. Pure function words — particles, punctuation, and the copula
です · だ and its negative じゃない · じゃありません — are never glossed. A word whose meaning cannot be found is simply left without a definition,
rather than given an empty or guessed one.

Whether a split te-form helper verb (います · しまう · ください) should be glossed like any other verb,
or left bare because its meaning is bleached in these patterns, is unsettled — see §8.

---

## 6. Invariants

These hold for every processed sentence:

- **Partition.** The tokens joined with no spaces equal the original sentence exactly.
- **One annotation per token.** Segmentation fixes the tokens; annotation adds ruby, lemma, and POS
  to each — it never merges or re-splits them.
- **Ruby reconstructs the surface.** Removing the `[reading]` brackets from a token's ruby returns its
  surface exactly (okurigana bare, each kanji run back in place). Pure-kana tokens: ruby = surface.
- **Determinism.** The same sentence, segmented the same way, always yields the same ruby, lemma, and
  POS.

---

## 7. Worked example

私は毎朝六時に起きます。

| Token | Has kanji? | Ruby | Dictionary form | POS |
|-------|------------|------|-----------------|-----|
| 私 | yes | 私[わたし] | 私 | pron |
| は | no | は | は | prt |
| 毎朝 | yes | 毎朝[まいあさ] | 毎朝 | n |
| 六時 | yes | 六時[ろくじ] | 六時 | n |
| に | no | に | に | prt |
| 起きます | yes | 起[お]きます | 起きる | v1 |
| 。 | no | 。 | 。 | punct |

起きます is **one** token (stem + polite ending, §1 rule 1), ruby-annotated with okurigana き left bare
(§2 rule 2), lemma 起きる (§3 rule 2), classed `v1` as an ichidan verb (§4).

A sentence with です — 大学はとても大きいです。 — splits the copula off:

| Token | Has kanji? | Ruby | Dictionary form | POS |
|-------|------------|------|-----------------|-----|
| 大学 | yes | 大学[だいがく] | 大学 | n |
| は | no | は | は | prt |
| とても | no | とても | とても | adv |
| 大きい | yes | 大[おお]きい | 大きい | adj-i |
| です | no | です | です | aux |
| 。 | no | 。 | 。 | punct |

大きいです is **two** tokens: 大きい (the adjective, exactly as the vocabulary list teaches it) and です
(the copula, §1 rule 2). です carries no ruby (no kanji) and no gloss (function word).

Conjugated short forms stay fused to their word — 週末はとても楽しかったです。 for example:

| Token | Has kanji? | Ruby | Dictionary form | POS |
|-------|------------|------|-----------------|-----|
| 週末 | yes | 週末[しゅうまつ] | 週末 | n |
| は | no | は | は | prt |
| とても | no | とても | とても | adv |
| 楽しかった | yes | 楽[たの]しかった | 楽しい | adj-i |
| です | no | です | です | aux |
| 。 | no | 。 | 。 | punct |

楽しかった (plain past) is **one** token — the ~かった ending stays attached (§1 rule 1), okurigana
しかった left bare (§2 rule 2), lemma 楽しい (§3 rule 2). Only the trailing polite です splits (§1
rule 2). For reference, how the copula and other endings fall out:

- 学生です → 学生 · です and 学生だった → 学生 · だった (all four copula forms split alike, §1 rule 2)
- 学生じゃないです → 学生 · じゃない · です and 学生じゃありません → 学生 · じゃありません (negative copula, §1 rule 2; lemma だ)
- 大きいでしょう → 大きい · でしょう and 行くでしょうか → 行く · でしょう · か (presumptive splits off any complete
  word; でしょう is `aux`, glossed "probably"; the question か splits, rule 5)
- 大きくなかった → 大きくなかった (one token; lemma 大きい)
- 食べませんでした → 食べませんでした (one token; lemma 食べる — the でした is verb conjugation, not a copula)
- 行きましょう → 行きましょう (one token; lemma 行く)

A te-form helper splits into its own token — 私は本を読んでいます。 for example:

| Token | Has kanji? | Ruby | Dictionary form | POS |
|-------|------------|------|-----------------|-----|
| 私 | yes | 私[わたし] | 私 | pron |
| は | no | は | は | prt |
| 本 | yes | 本[ほん] | 本 | n |
| を | no | を | を | prt |
| 読んで | yes | 読[よ]んで | 読む | v5 |
| います | no | います | いる | v1 |
| 。 | no | 。 | 。 | punct |

読んでいます is **two** tokens (§1 rule 3): 読んで (the te-form, lemma 読む) and います (the helper verb
いる, kept whole by §1 rule 1). います carries no ruby (no kanji); whether it is glossed is open (§8).

An attributive na-adjective keeps its な — the phrase 静かな公園:

| Token | Has kanji? | Ruby | Dictionary form | POS |
|-------|------------|------|-----------------|-----|
| 静かな | yes | 静[しず]かな | 静か | adj-na |
| 公園 | yes | 公園[こうえん] | 公園 | n |

静かな is **one** token (§1 rule 4): the な stays attached, ruby annotates only the kanji run
(静[しず]かな, §2 rule 2), and the lemma is the bare 静か as the vocabulary list teaches it (§3 rule 6).

An honorific stem frame splits off its free word — 少々お待ちください。

| Token | Has kanji? | Ruby | Dictionary form | POS |
|-------|------------|------|-----------------|-----|
| 少々 | yes | 少々[しょうしょう] | 少々 | adv |
| お待ち | yes | お待[ま]ち | 待つ | v5 |
| ください | no | ください | くださる | v5 |
| 。 | no | 。 | 。 | punct |

お待ちください is **three** tokens (§1 rule 8): the honorific stem お待ち — lemma the base verb 待つ
(§3 rule 7), classed `v5` after 待つ (§4) — and the free word ください (lemma くださる) each stand
alone, exactly as a te-form helper splits (§1 rule 3). The お+stem nominal is kept as its own token
by Principle A even though it is not a full word.

---

## 8. Open questions

Some matters are still to be decided. If in doubt, following the Genki approach is recommended. Cases this specification deliberately leaves unresolved:

- **Glossing te-form helper verbs.** A helper verb split off a te-form — います · しまう · ください
  (§1 rule 3) — is a verb, so §5 as written attaches an English definition to it. In these patterns
  the helper's lexical meaning is bleached (います is progressive aspect, not "to exist"), so the
  gloss can mislead. Open: leave helpers glossed for consistency with §5, or add a carve-out that
  suppresses the gloss on a helper verb following a te-form.
- **Derivational morphology.** Potential (食べられる · 行ける), passive (食べられる), causative
  (食べさせる), and desiderative 〜たい (食べたい) each stay one token — no bare stem may be stranded
  (§1 rule 1). **Resolved:** the lemma is the base verb (§3 rule 7) and the POS is the derived
  form's inflection class (§4) — e.g. 食べさせる → lemma 食べる, `v1`.
- **Adverbial に of na-adjectives.** The mirror of the attributive な (§1 rule 4): 静かに ("quietly").
  Whether 静かに is one adverbial token or splits 静か · に (particle, §1 rule 5) is not yet decided.
- **Stem-attaching auxiliaries and suffixes.** ～ながら (Ch18.5, 聞きながら), ～たり…～たりする
  (Ch11.2, 食べたり), the noun-forming ～方 (Ch23.6, 泳ぎ方), and the そう / みたい auxiliaries in
  ～そうです / ～みたいです (Ch13.3 / 17.1 / 17.5) each attach to a stem or short form. Their
  segmentation (fused vs. split) and POS are not yet fixed; where a form derives from a base word,
  the lemma follows §3 rule 7.
- **そうです — visual guess vs. hearsay.** The same surface splits two ways by attachment:
  高そうです ("looks expensive", Ch13.3) fuses the stem (高そう · です), while 高いそうです
  ("I hear it's expensive", Ch17.1) follows a complete word and splits (高い · そう · です). Whether
  to encode that distinction, and how to gloss each そう, is open.
- **Conditionals.** ～たら (Ch17.3), ～ば (Ch22.4), ～なら (Ch13.5), and conditional ～と (Ch18.4).
  たら / ば look inflectional (stay whole, lemma = base verb); なら / と follow a complete word and
  look like post-word particles (split) — but this is not yet ratified.
- **Causative-passive** (Ch23.1, 待たされる · 待たせられる). The causative is settled (§3 rule 7,
  gold notes below); the causative-passive is not yet stated, though it would follow the same
  base-word lemma.
- **Honorific prefix お / ご on nouns** (お名前, ご家族). Whether お / ご stays inside the noun token
  (lemma = the bare noun) or splits is undecided — distinct from the honorific *verb* frames now
  covered by §1 rule 8.
- **Set phrases** like ありがとうございます / すみません — treated as unsettled.

In creating the 10 gold eval stories, some judgement calls were made that need review and decisions made:

- んです (Ch12) → split ん(prt, dict ん) + です(aux), treating ん as contracted explanatory の.
- かもしれません (Ch14) → split か(prt) + も(prt) + しれません(v1, dict しれる), per the "each particle its own token" rule.
- なければいけません (Ch12) → 飲まなければ(v5, dict 飲む) + いけません(v1, dict いける).
- causatives (Ch22) → kept whole, tagged v1 since せる/させる inflect ichidan; dict = the **base verb** (待たせる → 待つ, 食べさせる → 食べる, そうじさせる → そうじする), per the base-word lemma policy (§3 rule 7). The gold causative tokens (eval-genki22) and the ～すぎる case (eval-genki12) now encode the base-verb dict to match.
- potential いただけません (Ch16/22) → dict = base いただく (v5); ないで → ～ない + で(prt).
- number+counter (何枚, 一時間, 三つ) kept as single tokens like 六時 in the seed file.