---
title: "Product Brief: nihonnohon"
status: "complete"
created: "2026-05-07"
updated: "2026-05-08"
inputs: []
---

# Product Brief: Nihon no Hon

## Executive Summary

Nihon no Hon ("Japan's Book") is an open-source Japanese reading application for language learners. It addresses a specific, widely-felt problem: the gap between knowing vocabulary and grammar in isolation, and being able to actually read Japanese text. Reading is one of the most effective paths to fluency, but no open-source reader exists that delivers curriculum-aligned content, in-context word lookup, and a portable story format in one coherent tool.

Inspired by Anki's community model — where millions of learners share and benefit from each other's decks — Nihon no Hon brings the same ethos to reading. A purpose-built open document format makes stories shareable and portable, just like Anki decks. Difficulty labels tied to specific Genki textbook chapters and JLPT levels ensure learners always read at the right level for what they've actually studied. A clean reading experience — tap any word for its translation, hiragana pronunciation, and kanji breakdown; toggle furigana on or off — removes friction without removing the learning challenge.

The first version ships as a web app with local story loading. Future phases add community story sharing, an AI pipeline to simplify any native text down to a target proficiency level, and a vocabulary study system to close the loop from reading to retention.

## The Problem

Learning to read Japanese is hard in a specific way. Even committed students who have worked through several Genki chapters or are preparing for JLPT N4 find that available reading material is either too elementary or far beyond their current vocabulary. The "comprehensible input" zone — text that stretches you just enough — is hard to find and harder to trust.

Current tools have real gaps:

- **Generic language apps** (Duolingo, LingoDeer) include reading exercises but are not extensible readers you can bring your own stories to.
- **Manga-focused tools** (Mokuro) use OCR to overlay dictionary lookups on images — effective for manga, but not built for prose text stories.
- **Browser dictionary extensions** (Yomitan) add pop-up lookups to any webpage but require native-difficulty source material, with no curriculum alignment and no curated library.
- **Commercial platforms** (Migaku, Shinobi Japanese) are paid and closed — not community-extendable, not forkable.

The specific gap: no open-source tool offers curriculum-aligned story difficulty, a portable shareable story format, and a focused prose reading experience in one package.

## The Solution

Nihon no Hon is a web-first reading application built around three interlocking elements:

**The Reader.** Stories are displayed sentence by sentence. Tap any word to see its English translation, hiragana pronunciation, and a breakdown of any kanji it contains. Furigana (reading aids above kanji) can be toggled on or off. Audio playback of individual sentences or full stories is a planned follow-on feature.

**The Story Format.** A well-defined JSON document format stores stories as structured sentence lists with optional audio links per sentence, a story-level vocabulary supplement for proper nouns and unusual terms, and difficulty metadata. This is the Anki deck equivalent for reading: open, portable, and community-extensible. Core linguistic data (vocabulary meanings, kanji readings) lives in the app's dictionary, sourced from open data such as JMdict/EDICT; story files carry only their exceptions.

**Difficulty-Aligned Library.** Stories carry difficulty labels expressed as either a Genki chapter reference (e.g. "Genki I Ch.5") or a JLPT level (N5–N1). This gives learners on either curriculum a fine-grained filter to find texts matched to what they have actually studied — not just a coarse beginner/intermediate/advanced bucket.

A personal study list lets users flag words and kanji they find difficult, building the foundation for a future quiz and memory system with image-based mnemonics.

## What Makes This Different

- **Curriculum-granular difficulty.** No existing open-source reader aligns content to Genki chapters. For learners mid-textbook, this is the difference between useful practice and discouraging overload.
- **Open story format.** Like Anki decks, the story format is designed to be shared, extended, and adopted beyond the app itself. Authors can create and distribute stories without depending on a platform.
- **Prose-first.** Existing open tools are optimised for manga (Mokuro) or general web browsing (Yomitan). Nihon no Hon is built specifically for reading text stories.
- **Community-extensible from day one.** Open source under a permissive licence, documented for contribution, with a format designed to grow a community library.
- **AI simplification pipeline (future).** A planned generative AI feature will ingest any Japanese text and rewrite it to a target proficiency level using curriculum vocabulary lists — a capability with no direct open-source equivalent.

## Who This Serves

**Primary user:** The intermediate-beginner Japanese learner (Genki I/II level, JLPT N5–N3) who has moved past kana basics but finds native-difficulty reading material overwhelming. They study consistently and want reading practice that matches their current level.

**Secondary community:** The self-study Japanese learning ecosystem — a large, technically literate audience active on r/LearnJapanese, WaniKani forums, and Discord servers — already comfortable with open-source tooling and accustomed to the Anki community model.

## Success Criteria

- The app is used regularly by RT for personal Japanese reading practice
- Ships with a small number of example stories demonstrating the format and difficulty labelling (bulk story creation is a separate activity)
- At least one external contributor or story submission within six months of public release
- Codebase is clean and documented enough to be cited as a portfolio piece
- Stories load and display correctly without any backend infrastructure (fully offline-capable)

## Scope

**In (v1):**
- Web app reader: sentence display, tap-to-translate, furigana toggle
- JSON story format with difficulty metadata and vocabulary supplement
- App-level dictionary using open data (JMdict/EDICT)
- Local story loading (file-based, no backend required)
- Personal study list (flag unknown words/kanji)

**Out of v1 — planned later:**
- Audio playback per sentence and full story
- Community story-sharing hub and upload/download platform
- Generative AI simplification pipeline
- Quiz and study mode with image mnemonics
- Mobile app wrappers

## Vision

In two to three years, Nihon no Hon is the open-source standard for Japanese reading practice — the reader equivalent of Anki. A community library of hundreds of curriculum-aligned stories spans Genki I through advanced JLPT N1 material. An AI simplification pipeline lets any learner drop in a native news article, novel excerpt, or blog post and receive a version calibrated to their current level. A vocabulary study loop — reading, flagging, quizzing, remembering — closes the gap between passive reading and active retention. The open story format is referenced and consumed by other tools in the Japanese learning ecosystem, not just this app.
