import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import type { CrosswordClue } from '@/lib/crossword-types'
import { buildEffectiveCrosswordClues } from '@/lib/crossword-types'
import {
  createDefaultTier,
  type DifferentiationTier,
} from '@/lib/differentiation-types'
import type { FillInBlankSentence } from '@/lib/fill-in-blank-types'
import {
  getWords,
  parseVocabularyText,
  type WorksheetId,
} from '@/lib/vocabulary-types'
import { DEFAULT_WORD_SEARCH_SETTINGS } from '@/lib/word-search-types'
import type { WordSearchSettings } from '@/lib/word-search-types'
import type { WordFormEntry, WordFormSentence } from '@/lib/word-forms-types'
import {
  DEFAULT_WORD_STORY_SETTINGS,
  type WordStory,
  type WordStoryDefinition,
  type WordStorySettings,
} from '@/lib/word-stories-types'
import {
  PREVIEWABLE_WORKSHEETS,
  type PageSize,
} from '@/lib/worksheet-preview'
import {
  buildOrderedWordsByWorksheet,
  createDefaultShuffleSeeds,
  createShuffleSeed,
  type ShuffleSeeds,
} from '@/lib/word-order'

import type { BuilderSectionProps } from '@/components/vocabulary/vocabulary-builders'

type VocabularyBuilderContextValue = {
  wordText: string
  setWordText: (text: string) => void
  worksheetTitle: string
  setWorksheetTitle: (title: string) => void
  entries: ReturnType<typeof parseVocabularyText>
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
    dictationAudioVoiceSource: 'ai' | 'own' | null
    shuffleSeeds: ShuffleSeeds
    wordCount: number
  }
  applyShuffle: (checked: Record<WorksheetId, boolean>) => void
}

const VocabularyBuilderContext =
  createContext<VocabularyBuilderContextValue | null>(null)

export function VocabularyBuilderProvider({ children }: { children: ReactNode }) {
  const [wordText, setWordText] = useState('')
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
  const [dictationAudioSeed, setDictationAudioSeed] = useState<number | null>(
    null,
  )
  const [dictationAudioVoiceSource, setDictationAudioVoiceSource] = useState<
    'ai' | 'own' | null
  >(null)
  const [wordSearchSettings, setWordSearchSettings] = useState(
    DEFAULT_WORD_SEARCH_SETTINGS,
  )
  const [wordForms, setWordForms] = useState<WordFormEntry[]>([])
  const [wordFormSentences, setWordFormSentences] = useState<WordFormSentence[]>(
    [],
  )
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

  const entries = useMemo(() => parseVocabularyText(wordText), [wordText])
  const words = useMemo(() => getWords(entries), [entries])
  const orderedWordsByWorksheet = useMemo(
    () => buildOrderedWordsByWorksheet(words, shuffleSeeds),
    [words, shuffleSeeds],
  )
  const defaultGrade = tiers[0]?.gradeLevel ?? '5'
  const effectiveCrosswordClues = useMemo(
    () => buildEffectiveCrosswordClues(entries, crosswordClues, defaultGrade),
    [entries, crosswordClues, defaultGrade],
  )

  const dictationAudioStale =
    dictationAudioSeed !== null &&
    shuffleSeeds['dictation-audio'] !== dictationAudioSeed

  useEffect(() => {
    setDictationAudioSeed(null)
    setDictationAudioVoiceSource(null)
    setWordForms([])
    setWordFormSentences([])
    setCrosswordClues([])
    setWordStories([])
    setWordStoryDefinitions([])
    setWordStoryAssignmentSeed(createShuffleSeed())
  }, [words])

  function applyShuffle(checked: Record<WorksheetId, boolean>) {
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
        checked['dictation-audio'] && dictationAudioSeed !== null,
      dictationAudioVoiceSource,
      shuffleSeeds,
      wordCount: words.length,
    }
  }

  const value: VocabularyBuilderContextValue = {
    wordText,
    setWordText,
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
