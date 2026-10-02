import type { ReactNode } from 'react'

import { CrosswordWorksheet } from '@/components/vocabulary/crossword-worksheet'
import { DictationAudioWorksheet } from '@/components/vocabulary/dictation-audio-worksheet'
import { DrawOneWordWorksheet } from '@/components/vocabulary/draw-one-word-worksheet'
import { FillInBlankWorksheet } from '@/components/vocabulary/fill-in-blank-worksheet'
import { WordFormsWorksheet } from '@/components/vocabulary/word-forms-worksheet'
import { WordSearchWorksheet } from '@/components/vocabulary/word-search-worksheet'
import { WordStoriesWorksheet } from '@/components/vocabulary/word-stories-worksheet'
import type { CrosswordClue } from '@/lib/crossword-types'
import type { DifferentiationTier } from '@/lib/differentiation-types'
import type { FillInBlankSentence } from '@/lib/fill-in-blank-types'
import type { parseVocabularyText, WorksheetId } from '@/lib/vocabulary-types'
import type { WordSearchSettings } from '@/lib/word-search-types'
import type { WordFormEntry, WordFormSentence } from '@/lib/word-forms-types'
import type {
  WordStory,
  WordStoryDefinition,
  WordStorySettings,
} from '@/lib/word-stories-types'

export type BuilderSectionProps = {
  entries: ReturnType<typeof parseVocabularyText>
  tiers: DifferentiationTier[]
  sentences: FillInBlankSentence[]
  onSentencesChange: (sentences: FillInBlankSentence[]) => void
  fillInBlankWordBank: boolean
  onFillInBlankWordBankChange: (wordBank: boolean) => void
  dictationWords: string[]
  dictationSeed: number
  dictationAudioStale: boolean
  keepDictationOrder: boolean
  listOrderWords: string[]
  onKeepDictationOrderChange: (keep: boolean) => void
  onUseDictationListOrder: () => void
  onShuffleDictationOrder: () => void
  onDictationAudioGenerated: (meta: {
    seed: number
    voiceSource: 'ai' | 'own'
  }) => void
  onRestoreDictationOrder: () => void
  wordSearchSettings: WordSearchSettings
  onWordSearchSettingsChange: (settings: WordSearchSettings) => void
  wordSearchWords: string[]
  wordForms: WordFormEntry[]
  onWordFormsChange: (wordForms: WordFormEntry[]) => void
  wordFormSentences: WordFormSentence[]
  onWordFormSentencesChange: (sentences: WordFormSentence[]) => void
  crosswordClues: CrosswordClue[]
  onCrosswordCluesChange: (clues: CrosswordClue[]) => void
  crosswordWords: string[]
  crosswordSeed: number
  wordStories: WordStory[]
  onWordStoriesChange: (stories: WordStory[]) => void
  wordStoryDefinitions: WordStoryDefinition[]
  onWordStoryDefinitionsChange: (definitions: WordStoryDefinition[]) => void
  wordStorySettings: WordStorySettings
  onWordStorySettingsChange: (settings: WordStorySettings) => void
  wordStoryAssignmentSeed: number
}

export const BUILDER_COMPONENTS: Record<
  WorksheetId,
  (props: BuilderSectionProps) => ReactNode
> = {
  'dictation-audio': ({
    dictationWords,
    dictationSeed,
    dictationAudioStale,
    keepDictationOrder,
    listOrderWords,
    onKeepDictationOrderChange,
    onUseDictationListOrder,
    onShuffleDictationOrder,
    onDictationAudioGenerated,
    onRestoreDictationOrder,
  }) => (
    <DictationAudioWorksheet
      words={dictationWords}
      listOrderWords={listOrderWords}
      dictationSeed={dictationSeed}
      audioStale={dictationAudioStale}
      keepOrder={keepDictationOrder}
      onKeepOrderChange={onKeepDictationOrderChange}
      onUseListOrder={onUseDictationListOrder}
      onShuffleOrder={onShuffleDictationOrder}
      onAudioGenerated={onDictationAudioGenerated}
      onRestoreOrder={onRestoreDictationOrder}
    />
  ),
  'draw-one-word': () => <DrawOneWordWorksheet />,
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
  'word-search': ({
    wordSearchSettings,
    onWordSearchSettingsChange,
    wordSearchWords,
  }) => (
    <WordSearchWorksheet
      words={wordSearchWords}
      settings={wordSearchSettings}
      onSettingsChange={onWordSearchSettingsChange}
    />
  ),
  'crossword-puzzle': ({
    entries,
    tiers,
    crosswordClues,
    onCrosswordCluesChange,
    crosswordWords,
    crosswordSeed,
  }) => (
    <CrosswordWorksheet
      entries={entries}
      tiers={tiers}
      crosswordClues={crosswordClues}
      onCrosswordCluesChange={onCrosswordCluesChange}
      crosswordWords={crosswordWords}
      crosswordSeed={crosswordSeed}
    />
  ),
  'word-forms': ({
    entries,
    tiers,
    wordForms,
    onWordFormsChange,
    wordFormSentences,
    onWordFormSentencesChange,
  }) => (
    <WordFormsWorksheet
      entries={entries}
      tiers={tiers}
      wordForms={wordForms}
      onWordFormsChange={onWordFormsChange}
      wordFormSentences={wordFormSentences}
      onWordFormSentencesChange={onWordFormSentencesChange}
    />
  ),
  'word-stories': ({
    entries,
    tiers,
    wordStories,
    onWordStoriesChange,
    wordStoryDefinitions,
    onWordStoryDefinitionsChange,
    wordStorySettings,
    onWordStorySettingsChange,
    wordStoryAssignmentSeed,
  }) => (
    <WordStoriesWorksheet
      entries={entries}
      tiers={tiers}
      wordStories={wordStories}
      onWordStoriesChange={onWordStoriesChange}
      wordStoryDefinitions={wordStoryDefinitions}
      onWordStoryDefinitionsChange={onWordStoryDefinitionsChange}
      wordStorySettings={wordStorySettings}
      onWordStorySettingsChange={onWordStorySettingsChange}
      wordStoryAssignmentSeed={wordStoryAssignmentSeed}
    />
  ),
}
