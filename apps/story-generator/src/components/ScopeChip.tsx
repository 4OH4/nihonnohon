import { cn } from '@/lib/utils'

/** Cumulative curriculum scope for one Genki chapter. */
export interface ChapterScope {
  vocab: number
  grammar: number
  /** 2–3 key Japanese grammar forms; rendered with font-ja. */
  highlights: string[]
}

/**
 * Hardcoded cumulative scope data for Genki I (Ch.1–12) and Genki II (Ch.13–23).
 * Vocab counts are cumulative from Ch.1–N (Ch.0 greetings excluded — not in generation context).
 * Grammar counts are cumulative from Ch.1–N.
 */
export const CHAPTER_SCOPE: Record<string, ChapterScope> = {
  'Genki I Ch.1':  { vocab:   56, grammar:   3, highlights: ['X は Y です', '～か', 'N の N'] },
  'Genki I Ch.2':  { vocab:  104, grammar:  10, highlights: ['これ・それ・あれ', 'この・その・あの', '～も'] },
  'Genki I Ch.3':  { vocab:  159, grammar:  16, highlights: ['～ます・ません', 'を・で・に・へ'] },
  'Genki I Ch.4':  { vocab:  222, grammar:  22, highlights: ['あります・います', '～でした・ではありません'] },
  'Genki I Ch.5':  { vocab:  276, grammar:  27, highlights: ['い形容詞', 'な形容詞'] },
  'Genki I Ch.6':  { vocab:  325, grammar:  33, highlights: ['て形', '～てください'] },
  'Genki I Ch.7':  { vocab:  375, grammar:  38, highlights: ['～ている'] },
  'Genki I Ch.8':  { vocab:  421, grammar:  46, highlights: ['普通形', '～と思います'] },
  'Genki I Ch.9':  { vocab:  469, grammar:  49, highlights: ['名詞修飾', 'もう・まだ'] },
  'Genki I Ch.10': { vocab:  512, grammar:  54, highlights: ['A のほうが B より', '一番'] },
  'Genki I Ch.11': { vocab:  555, grammar:  58, highlights: ['～たい', '～たことがある'] },
  'Genki I Ch.12': { vocab:  602, grammar:  64, highlights: ['～んです', '～すぎる', '～ほうがいい'] },
  'Genki II Ch.13': { vocab:  657, grammar:  70, highlights: ['可能動詞', '～し', '～そうです'] },
  'Genki II Ch.14': { vocab:  705, grammar:  75, highlights: ['ほしい', '～かもしれない', 'あげる・くれる・もらう'] },
  'Genki II Ch.15': { vocab:  746, grammar:  79, highlights: ['意向形', '～ておく'] },
  'Genki II Ch.16': { vocab:  788, grammar:  84, highlights: ['～てあげる・くれる・もらう', '～といい'] },
  'Genki II Ch.17': { vocab:  835, grammar:  90, highlights: ['～そうです（伝聞）', '～たら'] },
  'Genki II Ch.18': { vocab:  883, grammar:  96, highlights: ['他動詞・自動詞', '～てしまう'] },
  'Genki II Ch.19': { vocab:  934, grammar: 101, highlights: ['尊敬動詞', 'お〜ください'] },
  'Genki II Ch.20': { vocab:  984, grammar: 107, highlights: ['謙譲語', 'お〜する'] },
  'Genki II Ch.21': { vocab: 1040, grammar: 112, highlights: ['受身形', '～てある'] },
  'Genki II Ch.22': { vocab: 1095, grammar: 118, highlights: ['使役形', '使役 + くれる'] },
  'Genki II Ch.23': { vocab: 1138, grammar: 124, highlights: ['使役受身形', '～ても', '～ことにする'] },
}

interface ScopeChipProps {
  chapter: string
  className?: string
}

/** Displays cumulative vocab/grammar scope for the selected Genki chapter. Hidden when chapter is unrecognised. */
export function ScopeChip({ chapter, className }: ScopeChipProps) {
  const scope = CHAPTER_SCOPE[chapter]
  if (!scope) return null

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs',
        'bg-accent-subtle border border-accent',
        className,
      )}
    >
      <span className="text-muted font-medium">Scope:</span>
      <span className="text-paper-text">{scope.vocab} vocab</span>
      <span className="text-muted">·</span>
      <span className="text-paper-text">{scope.grammar} grammar</span>
      <span className="text-muted">·</span>
      <span className="font-ja text-paper-text">
        {scope.highlights.join('、')}
      </span>
    </div>
  )
}
