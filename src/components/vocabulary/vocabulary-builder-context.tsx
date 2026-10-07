import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import type { CrosswordClue } from '@/lib/crossword-types'
import { buildEffectiveCrosswordClues } from '@/lib/crossword-types'
import type { DifferentiationTier } from '@/lib/differentiation-types'
import { createDefaultTier } from '@/lib/differentiation-types'
import type { FillInBlankSentence } from '@/lib/fill-in-blank-types'
import type { VocabEntry, VocabRow, WorksheetId } from '@/lib/vocabulary-types'
import { createVocabRow, getWords, rowsToEntries } from '@/lib/vocabulary-types'
import type { WordSearchSettings } from '@/lib/word-search-types'
import { DEFAULT_WORD_SEARCH_SETTINGS } from '@/lib/word-search-types'
import type { WordFormEntry, WordFormSentence } from '@/lib/word-forms-types'
import type {
  WordStory,
  WordStoryDefinition,
  WordStorySettings,
} from '@/lib/word-stories-types'
import { DEFAULT_WORD_STORY_SETTINGS } from '@/lib/word-stories-types'
import type { PageSize } from '@/lib/worksheet-preview'
import { PREVIEWABLE_WORKSHEETS } from '@/lib/worksheet-preview'
import type { ShuffleSeeds } from '@/lib/word-order'
import {
  buildOrderedWordsByWorksheet,
  createDefaultShuffleSeeds,
  createShuffleSeed,
  reconcileKeptWordOrder,
  seededShuffle,
  wordListsEqual,
} from '@/lib/word-order'

import type { BuilderSectionProps } from '@/components/vocabulary/vocabulary-builders'

type VocabularyBuilderContextValue = {
  rows: VocabRow[]
  setRows: (rows: VocabRow[]) => void
  worksheetTitle: string
  setWorksheetTitle: (title: string) => void
  entries: VocabEntry[]
  words: string[]
  orderedWordsByWorksheet: ReturnType<typeof buildOrderedWordsByWorksheet>
  tiers: DifferentiationTier[]
  setTiers: (tiers: DifferentiationTier[]) => void
  differentiationEnabled: boolean
  setDifferentiationEnabled: (enabled: boolean) => void
  builderProps: BuilderSectionProps
  getPrintableProps: (
    checked: Record<WorksheetId, boolean>,
    worksheetOrder: WorksheetId[],
  ) => {
    title: string
    orderedWordsByWorksheet: ReturnType<typeof buildOrderedWordsByWorksheet>
    checked: Record<WorksheetId, boolean>
    worksheetOrder: WorksheetId[]
    tiers: DifferentiationTier[]
    differentiationEnabled: boolean
    sentences: FillInBlankSentence[]
    pageSize: PageSize
    fillInBlankWordBank: boolean
    wordSearchSettings: WordSearchSettings
    wordSearchSeed: number
    wordFormSentences: WordFormSentence[]
    wordFormShuffleSeed: number
    wordForms: WordFormEntry[]
    crosswordClues: CrosswordClue[]
    crosswordSeed: number
    wordStories: WordStory[]
    wordStoryDefinitions: WordStoryDefinition[]
    wordStorySettings: WordStorySettings
    wordStoryAssignmentSeed: number
    wordStoryDefinitionSeed: number
  }
  getPreviewProps: (
    checked: Record<WorksheetId, boolean>,
    worksheetOrder: WorksheetId[],
  ) => ReturnType<VocabularyBuilderContextValue['getPrintableProps']> & {
    onPageSizeChange: (size: PageSize) => void
    onShuffleApply: () => void
    needsShuffleAudioWarning: boolean
    canShuffle: boolean
    dictationAudioVoiceSource: 'ai' | 'own' | null
    shuffleSeeds: ShuffleSeeds
    wordCount: number
  }
  applyShuffle: (checked: Record<WorksheetId, boolean>) => void
}

const VocabularyBuilderContext =
  createContext<VocabularyBuilderContextValue | null>(null)

export function VocabularyBuilderProvider({
  children,
}: {
  children: ReactNode
}) {
  const [rows, setRows] = useState<VocabRow[]>(() => [createVocabRow()])
  const [worksheetTitle, setWorksheetTitle] = useState('')
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
  const [keepDictationOrder, setKeepDictationOrder] = useState(true)
  const [dictationOrder, setDictationOrder] = useState<string[]>([])
  const [dictationAudioSeed, setDictationAudioSeed] = useState<number | null>(
    null,
  )
  const [dictationAudioWords, setDictationAudioWords] = useState<
    string[] | null
  >(null)
  const [dictationAudioVoiceSource, setDictationAudioVoiceSource] = useState<
    'ai' | 'own' | null
  >(null)
  const [wordSearchSettings, setWordSearchSettings] = useState(
    DEFAULT_WORD_SEARCH_SETTINGS,
  )
  const [wordForms, setWordForms] = useState<WordFormEntry[]>([])
  const [wordFormSentences, setWordFormSentences] = useState<
    WordFormSentence[]
  >([])
  const [crosswordClues, setCrosswordClues] = useState<CrosswordClue[]>([])
  const [wordStories, setWordStories] = useState<WordStory[]>([])
  const [wordStoryDefinitions, setWordStoryDefinitions] = useState<
    WordStoryDefinition[]
  >([])
  const [wordStorySettings, setWordStorySettings] = useState(
    DEFAULT_WORD_STORY_SETTINGS,
  )
  const [wordStoryAssignmentSeed, setWordStoryAssignmentSeed] = useState(() =>
    createShuffleSeed(),
  )

  const entries = useMemo(() => rowsToEntries(rows), [rows])
  const words = useMemo(() => getWords(entries), [entries])
  const wordListKey = JSON.stringify(words)
  const orderedWordsByWorksheet = useMemo(() => {
    const ordered = buildOrderedWordsByWorksheet(words, shuffleSeeds)
    ordered['dictation-audio'] = reconcileKeptWordOrder(dictationOrder, words)
    return ordered
  }, [words, shuffleSeeds, dictationOrder])
  const defaultGrade = tiers[0]?.gradeLevel ?? '5'
  const effectiveCrosswordClues = useMemo(
    () => buildEffectiveCrosswordClues(entries, crosswordClues, defaultGrade),
    [entries, crosswordClues, defaultGrade],
  )

  const dictationWords = orderedWordsByWorksheet['dictation-audio']
  const dictationAudioStale =
    dictationAudioWords !== null &&
    !wordListsEqual(dictationAudioWords, dictationWords)

  useEffect(() => {
    const currentWords = JSON.parse(wordListKey) as string[]
    setDictationOrder((current) => {
      const next = reconcileKeptWordOrder(current, currentWords)
      if (
        current.length === next.length &&
        current.every((word, index) => word === next[index])
      ) {
        return current
      }
      return next
    })
    setDictationAudioSeed(null)
    setDictationAudioWords(null)
    setDictationAudioVoiceSource(null)
    setWordForms([])
    setWordFormSentences([])
    setCrosswordClues([])
    setWordStories([])
    setWordStoryDefinitions([])
    setWordStoryAssignmentSeed(createShuffleSeed())
  }, [wordListKey])

  function applyShuffle(checked: Record<WorksheetId, boolean>) {
    const next: ShuffleSeeds = { ...shuffleSeeds }
    let nextDictationOrder: string[] | null = null

    for (const id of PREVIEWABLE_WORKSHEETS) {
      if (!checked[id]) continue
      if (id === 'dictation-audio' && keepDictationOrder) continue
      next[id] = createShuffleSeed()
      if (id === 'dictation-audio') {
        nextDictationOrder = seededShuffle(words, next[id])
      }
    }

    setShuffleSeeds(next)
    if (nextDictationOrder) {
      setDictationOrder(nextDictationOrder)
    }
  }

  function restoreDictationOrder() {
    if (dictationAudioWords === null) return
    setDictationOrder(dictationAudioWords)
    setKeepDictationOrder(true)
    if (dictationAudioSeed !== null) {
      setShuffleSeeds((current) => ({
        ...current,
        'dictation-audio': dictationAudioSeed,
      }))
    }
  }

  function handleDictationAudioGenerated(meta: {
    seed: number
    voiceSource: 'ai' | 'own'
  }) {
    setDictationAudioSeed(meta.seed)
    setDictationAudioWords([...dictationWords])
    setDictationAudioVoiceSource(meta.voiceSource)
    setKeepDictationOrder(true)
  }

  function handleKeepDictationOrderChange(keep: boolean) {
    setKeepDictationOrder(keep)
    if (keep) {
      setDictationOrder(dictationWords)
    }
  }

  function handleUseDictationListOrder() {
    setDictationOrder([...words])
    setKeepDictationOrder(true)
  }

  function handleShuffleDictationOrder() {
    const seed = createShuffleSeed()
    setShuffleSeeds((current) => ({
      ...current,
      'dictation-audio': seed,
    }))
    setDictationOrder(seededShuffle(words, seed))
    setKeepDictationOrder(true)
  }

  const builderProps: BuilderSectionProps = {
    entries,
    tiers,
    sentences: fillInBlankSentences,
    onSentencesChange: setFillInBlankSentences,
    fillInBlankWordBank,
    onFillInBlankWordBankChange: setFillInBlankWordBank,
    dictationWords,
    dictationSeed: shuffleSeeds['dictation-audio'],
    dictationAudioStale,
    keepDictationOrder,
    listOrderWords: words,
    onKeepDictationOrderChange: handleKeepDictationOrderChange,
    onUseDictationListOrder: handleUseDictationListOrder,
    onShuffleDictationOrder: handleShuffleDictationOrder,
    onDictationAudioGenerated: handleDictationAudioGenerated,
    onRestoreDictationOrder: restoreDictationOrder,
    wordSearchSettings,
    onWordSearchSettingsChange: setWordSearchSettings,
    wordSearchWords: orderedWordsByWorksheet['word-search'],
    wordForms,
    onWordFormsChange: setWordForms,
    wordFormSentences,
    onWordFormSentencesChange: setWordFormSentences,
    crosswordClues,
    onCrosswordCluesChange: setCrosswordClues,
    crosswordWords: orderedWordsByWorksheet['crossword-puzzle'],
    crosswordSeed: shuffleSeeds['crossword-puzzle'],
    wordStories,
    onWordStoriesChange: setWordStories,
    wordStoryDefinitions,
    onWordStoryDefinitionsChange: setWordStoryDefinitions,
    wordStorySettings,
    onWordStorySettingsChange: setWordStorySettings,
    wordStoryAssignmentSeed,
  }

  function getPrintableProps(
    checked: Record<WorksheetId, boolean>,
    worksheetOrder: WorksheetId[],
  ) {
    return {
      title: worksheetTitle,
      orderedWordsByWorksheet,
      checked,
      worksheetOrder,
      tiers,
      differentiationEnabled,
      sentences: fillInBlankSentences,
      pageSize,
      fillInBlankWordBank,
      wordSearchSettings,
      wordSearchSeed: shuffleSeeds['word-search'],
      wordFormSentences,
      wordFormShuffleSeed: shuffleSeeds['word-forms'],
      wordForms,
      crosswordClues: effectiveCrosswordClues,
      crosswordSeed: shuffleSeeds['crossword-puzzle'],
      wordStories,
      wordStoryDefinitions,
      wordStorySettings,
      wordStoryAssignmentSeed,
      wordStoryDefinitionSeed: wordStoryAssignmentSeed,
    }
  }

  function getPreviewProps(
    checked: Record<WorksheetId, boolean>,
    worksheetOrder: WorksheetId[],
  ) {
    return {
      ...getPrintableProps(checked, worksheetOrder),
      onPageSizeChange: setPageSize,
      onShuffleApply: () => applyShuffle(checked),
      needsShuffleAudioWarning:
        checked['dictation-audio'] &&
        dictationAudioWords !== null &&
        !keepDictationOrder,
      canShuffle: PREVIEWABLE_WORKSHEETS.some(
        (id) =>
          checked[id] && !(id === 'dictation-audio' && keepDictationOrder),
      ),
      dictationAudioVoiceSource,
      shuffleSeeds,
      wordCount: words.length,
    }
  }

  const value: VocabularyBuilderContextValue = {
    rows,
    setRows,
    worksheetTitle,
    setWorksheetTitle,
    entries,
    words,
    orderedWordsByWorksheet,
    tiers,
    setTiers,
    differentiationEnabled,
    setDifferentiationEnabled,
    builderProps,
    getPrintableProps,
    getPreviewProps,
    applyShuffle,
  }

  return (
    <VocabularyBuilderContext.Provider value={value}>
      {children}
    </VocabularyBuilderContext.Provider>
  )
}

export function useVocabularyBuilder() {
  const context = useContext(VocabularyBuilderContext)
  if (!context) {
    throw new Error(
      'useVocabularyBuilder must be used within VocabularyBuilderProvider',
    )
  }
  return context
}
