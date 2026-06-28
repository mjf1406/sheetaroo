import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { DifferentiationCard } from '@/components/vocabulary/differentiation-card'
import { DictationAudioWorksheet } from '@/components/vocabulary/dictation-audio-worksheet'
import { FillInBlankWorksheet } from '@/components/vocabulary/fill-in-blank-worksheet'
import { PrintableWorksheet } from '@/components/vocabulary/printable-worksheet'
import { VocabularyWordInput } from '@/components/vocabulary/vocabulary-word-input'
import { WorksheetChecklist } from '@/components/vocabulary/worksheet-checklist'
import { WorksheetPlaceholder } from '@/components/vocabulary/worksheet-placeholder'
import { WorksheetPreviewPanel } from '@/components/vocabulary/worksheet-preview-panel'
import { WorksheetPreviewSheet } from '@/components/vocabulary/worksheet-preview-sheet'
import {
  createDefaultTier,
  type DifferentiationTier,
} from '@/lib/differentiation-types'
import type { FillInBlankSentence } from '@/lib/fill-in-blank-types'
import { requireAuth } from '@/lib/auth-guard'
import {
  DEFAULT_WORKSHEET_ORDER,
  getOrderedBuilderWorksheets,
  PREVIEWABLE_WORKSHEETS,
  type PageSize,
} from '@/lib/worksheet-preview'
import {
  WORKSHEET_LABELS,
  getWords,
  parseVocabularyText,
  parseWorksheetView,
  worksheetSelectionFromView,
  type WorksheetId,
  type WorksheetView,
} from '@/lib/vocabulary-types'
import {
  buildOrderedWordsByWorksheet,
  createDefaultShuffleSeeds,
  createShuffleSeed,
  type ShuffleSeeds,
} from '@/lib/word-order'

type VocabularySearch = {
  worksheet: WorksheetView
}

type BuilderSectionProps = {
  entries: ReturnType<typeof parseVocabularyText>
  tiers: DifferentiationTier[]
  sentences: FillInBlankSentence[]
  onSentencesChange: (sentences: FillInBlankSentence[]) => void
  fillInBlankWordBank: boolean
  onFillInBlankWordBankChange: (wordBank: boolean) => void
  dictationWords: string[]
  dictationSeed: number
  dictationAudioStale: boolean
  onDictationAudioGenerated: (meta: {
    seed: number
    voiceSource: 'ai' | 'own'
  }) => void
  onRestoreDictationOrder: () => void
}

const BUILDER_COMPONENTS: Record<
  WorksheetId,
  (props: BuilderSectionProps) => ReactNode
> = {
  'dictation-audio': ({
    dictationWords,
    dictationSeed,
    dictationAudioStale,
    onDictationAudioGenerated,
    onRestoreDictationOrder,
  }) => (
    <DictationAudioWorksheet
      words={dictationWords}
      dictationSeed={dictationSeed}
      audioStale={dictationAudioStale}
      onAudioGenerated={onDictationAudioGenerated}
      onRestoreOrder={onRestoreDictationOrder}
    />
  ),
  'fill-in-the-blank': ({
    entries,
    tiers,
    sentences,
    onSentencesChange,
    fillInBlankWordBank,
    onFillInBlankWordBankChange,
  }) => (
    <FillInBlankWorksheet
      entries={entries}
      tiers={tiers}
      sentences={sentences}
      onSentencesChange={onSentencesChange}
      wordBank={fillInBlankWordBank}
      onWordBankChange={onFillInBlankWordBankChange}
    />
  ),
  'word-search': ({ entries }) => (
    <WorksheetPlaceholder
      title={WORKSHEET_LABELS['word-search']}
      entries={entries}
    />
  ),
  'crossword-puzzle': ({ entries }) => (
    <WorksheetPlaceholder
      title={WORKSHEET_LABELS['crossword-puzzle']}
      entries={entries}
    />
  ),
  'word-forms': ({ entries }) => (
    <WorksheetPlaceholder
      title={WORKSHEET_LABELS['word-forms']}
      entries={entries}
    />
  ),
}

export const Route = createFileRoute('/vocabulary')({
  validateSearch: (search: Record<string, unknown>): VocabularySearch => ({
    worksheet: parseWorksheetView(search.worksheet),
  }),
  beforeLoad: requireAuth,
  component: VocabularyPage,
})

function VocabularyPage() {
  const { worksheet } = Route.useSearch()
  const [wordText, setWordText] = useState('')
  const [worksheetTitle, setWorksheetTitle] = useState('')
  const [checked, setChecked] = useState(() =>
    worksheetSelectionFromView(worksheet),
  )
  const [worksheetOrder, setWorksheetOrder] = useState<WorksheetId[]>(
    DEFAULT_WORKSHEET_ORDER,
  )
  const [tiers, setTiers] = useState<DifferentiationTier[]>(() => [
    createDefaultTier(),
  ])
  const [differentiationEnabled, setDifferentiationEnabled] = useState(false)
  const [fillInBlankSentences, setFillInBlankSentences] = useState<
    FillInBlankSentence[]
  >([])
  const [fillInBlankWordBank, setFillInBlankWordBank] = useState(false)
  const [pageSize, setPageSize] = useState<PageSize>('letter')
  const [shuffleSeeds, setShuffleSeeds] = useState(createDefaultShuffleSeeds)
  const [dictationAudioSeed, setDictationAudioSeed] = useState<number | null>(
    null,
  )
  const [dictationAudioVoiceSource, setDictationAudioVoiceSource] = useState<
    'ai' | 'own' | null
  >(null)

  useEffect(() => {
    setChecked(worksheetSelectionFromView(worksheet))
  }, [worksheet])

  const entries = useMemo(() => parseVocabularyText(wordText), [wordText])
  const words = useMemo(() => getWords(entries), [entries])
  const orderedWordsByWorksheet = useMemo(
    () => buildOrderedWordsByWorksheet(words, shuffleSeeds),
    [words, shuffleSeeds],
  )
  const orderedBuilders = useMemo(
    () => getOrderedBuilderWorksheets(worksheetOrder, checked),
    [worksheetOrder, checked],
  )

  const dictationAudioStale =
    dictationAudioSeed !== null &&
    shuffleSeeds['dictation-audio'] !== dictationAudioSeed

  useEffect(() => {
    setDictationAudioSeed(null)
    setDictationAudioVoiceSource(null)
  }, [words])

  function applyShuffle() {
    setShuffleSeeds((current) => {
      const next: ShuffleSeeds = { ...current }
      for (const id of PREVIEWABLE_WORKSHEETS) {
        if (checked[id]) {
          next[id] = createShuffleSeed()
        }
      }
      return next
    })
  }

  function restoreDictationOrder() {
    if (dictationAudioSeed === null) return
    setShuffleSeeds((current) => ({
      ...current,
      'dictation-audio': dictationAudioSeed,
    }))
  }

  function handleDictationAudioGenerated(meta: {
    seed: number
    voiceSource: 'ai' | 'own'
  }) {
    setDictationAudioSeed(meta.seed)
    setDictationAudioVoiceSource(meta.voiceSource)
  }

  const printableProps = {
    title: worksheetTitle,
    orderedWordsByWorksheet,
    checked,
    worksheetOrder,
    tiers,
    differentiationEnabled,
    sentences: fillInBlankSentences,
    pageSize,
    fillInBlankWordBank,
  }

  const previewProps = {
    ...printableProps,
    onPageSizeChange: setPageSize,
    onShuffleApply: applyShuffle,
    needsShuffleAudioWarning:
      checked['dictation-audio'] && dictationAudioSeed !== null,
    dictationAudioVoiceSource,
    shuffleSeeds,
    wordCount: words.length,
  }

  const builderProps: BuilderSectionProps = {
    entries,
    tiers,
    sentences: fillInBlankSentences,
    onSentencesChange: setFillInBlankSentences,
    fillInBlankWordBank,
    onFillInBlankWordBankChange: setFillInBlankWordBank,
    dictationWords: orderedWordsByWorksheet['dictation-audio'],
    dictationSeed: shuffleSeeds['dictation-audio'],
    dictationAudioStale,
    onDictationAudioGenerated: handleDictationAudioGenerated,
    onRestoreDictationOrder: restoreDictationOrder,
  }

  function handleCheckedChange(id: WorksheetId, value: boolean) {
    setChecked((current) => ({ ...current, [id]: value }))
  }

  return (
    <>
      <div className="mx-auto max-w-screen-2xl space-y-8 px-8 py-8 print:hidden">
        <header>
          <h1 className="text-4xl font-bold">Vocabulary</h1>
          <p className="mt-2 text-muted-foreground">
            Enter words and definitions, choose worksheets, and generate
            materials for your students.
          </p>
        </header>

        <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_min(480px,38%)] xl:items-start xl:gap-10">
          <div className="vocabulary-builder min-w-0 space-y-8">
            <div className="grid gap-6 lg:grid-cols-3">
              <VocabularyWordInput
                value={wordText}
                onChange={setWordText}
                title={worksheetTitle}
                onTitleChange={setWorksheetTitle}
                entries={entries}
              />
              <WorksheetChecklist
                checked={checked}
                order={worksheetOrder}
                onCheckedChange={handleCheckedChange}
                onOrderChange={setWorksheetOrder}
              />
              <DifferentiationCard
                tiers={tiers}
                onChange={setTiers}
                enabled={differentiationEnabled}
                onEnabledChange={setDifferentiationEnabled}
              />
            </div>

            <div className="space-y-10">
              {orderedBuilders.map((id) => (
                <div key={id}>{BUILDER_COMPONENTS[id](builderProps)}</div>
              ))}
            </div>
          </div>

          <div className="worksheet-preview-sidebar hidden min-w-0 xl:block">
            <WorksheetPreviewPanel {...previewProps} className="sticky top-8" />
          </div>
        </div>

        <WorksheetPreviewSheet {...previewProps} />
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed -left-[9999px] top-0"
      >
        <PrintableWorksheet {...printableProps} isPrintRoot />
      </div>
    </>
  )
}
