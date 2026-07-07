import type { DifferentiationTier, GradeLevel } from '@/lib/differentiation-types'
import { formatGradeLabel } from '@/lib/differentiation-types'
import type { FillInBlankSentence } from '@/lib/fill-in-blank-types'
import { WORKSHEET_IDS, type WorksheetId } from '@/lib/vocabulary-types'

export const PREVIEWABLE_WORKSHEETS = [
  'dictation-audio',
  'draw-one-word',
  'fill-in-the-blank',
  'word-search',
  'crossword-puzzle',
  'word-forms',
  'word-stories',
] as const
export type PreviewableWorksheetId = (typeof PREVIEWABLE_WORKSHEETS)[number]

export type WorksheetVariant = {
  gradeLevel: GradeLevel
  copyIndex: number
  totalCopies: number
}

export function getWorksheetVariants(
  tiers: DifferentiationTier[],
  differentiationEnabled: boolean,
): WorksheetVariant[] {
  if (tiers.length === 0) {
    return [{ gradeLevel: '5', copyIndex: 1, totalCopies: 1 }]
  }

  if (!differentiationEnabled) {
    return [{ gradeLevel: tiers[0].gradeLevel, copyIndex: 1, totalCopies: 1 }]
  }

  return tiers.flatMap((tier) =>
    Array.from({ length: tier.copies }, (_, index) => ({
      gradeLevel: tier.gradeLevel,
      copyIndex: index + 1,
      totalCopies: tier.copies,
    })),
  )
}

export function getOrderedPreviewableWorksheets(
  order: WorksheetId[],
  checked: Record<WorksheetId, boolean>,
): PreviewableWorksheetId[] {
  return order.filter(
    (id): id is PreviewableWorksheetId =>
      PREVIEWABLE_WORKSHEETS.includes(id as PreviewableWorksheetId) && checked[id],
  )
}

export function getOrderedBuilderWorksheets(
  order: WorksheetId[],
  checked: Record<WorksheetId, boolean>,
): WorksheetId[] {
  return order.filter((id) => checked[id])
}

export function defaultWorksheetTitle(title: string): string {
  const trimmed = title.trim()
  return trimmed || 'Vocabulary Worksheet'
}

export function formatStudentSentence(sentence: string): string {
  return sentence.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
}

export function fillAnswerInSentence(sentence: string, word: string): string {
  const cleaned = formatStudentSentence(sentence)
  if (cleaned.includes('_____')) {
    return cleaned.replace('_____', word)
  }
  return `${cleaned} ${word}`
}

export function getSentencesForGrade<T extends { gradeLevel: GradeLevel }>(
  sentences: T[],
  gradeLevel: GradeLevel,
  differentiationEnabled: boolean,
  defaultGrade: GradeLevel,
): T[] {
  const activeGrade = differentiationEnabled ? gradeLevel : defaultGrade

  return sentences.filter((sentence) => sentence.gradeLevel === activeGrade)
}

export function variantLabel(
  variant: WorksheetVariant,
  differentiationEnabled: boolean,
  multipleGrades: boolean,
): string | null {
  if (!differentiationEnabled) return null
  const grade = formatGradeLabel(variant.gradeLevel)
  if (variant.totalCopies > 1) {
    return `${grade} — Copy ${variant.copyIndex} of ${variant.totalCopies}`
  }
  if (multipleGrades) return grade
  return null
}

export const DEFAULT_WORKSHEET_ORDER: WorksheetId[] = [...WORKSHEET_IDS]

export type PageSize = 'letter' | 'a4'

export const PAGE_SIZE_OPTIONS: Array<{ value: PageSize; label: string }> = [
  { value: 'letter', label: 'Letter' },
  { value: 'a4', label: 'A4' },
]

export function sanitizeFilename(title: string): string {
  return title
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase() || 'worksheet'
}

export function drawOneWordInstructions(dictationIncluded: boolean): string {
  if (dictationIncluded) {
    return 'Choose one word from the Dictation list. Write the word on the line below. Draw a picture that shows what the word means.'
  }
  return 'Choose one vocabulary word. Write the word on the line below. Draw a picture that shows what the word means.'
}

export function fillInBlankInstructions(
  showWordBank: boolean,
  dictationIncluded: boolean,
): string {
  if (showWordBank) {
    return 'Read each sentence and fill in the blank using a word from the word bank below. Each word is used exactly once.'
  }
  if (dictationIncluded) {
    return 'Read each sentence and fill in the blank using the words from the Dictation section as your word bank. Each word is used exactly once.'
  }
  return 'Read each sentence and fill in the blank using your vocabulary words. Each word is used exactly once.'
}

export function wordSearchInstructions(
  showWordBank: boolean,
  dictationIncluded: boolean,
): string {
  if (showWordBank) {
    return 'Find and circle each word in the grid using the word bank below. Words may run horizontally, vertically, or diagonally, and may read forwards or backwards.'
  }
  if (dictationIncluded) {
    return 'Find and circle each word in the grid using the words from the Dictation section as your word bank. Words may run horizontally, vertically, or diagonally, and may read forwards or backwards.'
  }
  return 'Find and circle each vocabulary word in the grid. Words may run horizontally, vertically, or diagonally, and may read forwards or backwards.'
}

export function crosswordInstructions(
  showWordBank: boolean,
  dictationIncluded: boolean,
): string {
  if (showWordBank) {
    return 'Read each clue and write the matching vocabulary word in the crossword grid. Use the word bank below if needed. You may also write your answer on the line next to each clue.'
  }
  if (dictationIncluded) {
    return 'Read each clue and write the matching vocabulary word in the crossword grid. Use the words from the Dictation section as your word bank. You may also write your answer on the line next to each clue.'
  }
  return 'Read each clue and write the matching vocabulary word in the crossword grid. You may also write your answer on the line next to each clue.'
}

export function wordFormInstructionSteps(
  showWordBank: boolean,
  dictationIncluded: boolean,
): string[] {
  if (dictationIncluded) {
    return [
      'Look at the Dictation section. The words are in order — the first word you wrote is word 1, the second is word 2, and so on.',
      'In the Word Forms table, write those same words in the same order in the Base word column (row 1 = word 1, row 2 = word 2, and so on).',
      'For each word, write the other forms in the row (like -ing, past tense, or noun). If that word does not have that form, write X in that box.',
      'Read each sentence below. Fill in each blank with the correct word form.',
    ]
  }
  if (showWordBank) {
    return [
      'Use the word bank to find each base word. Write the base word in the Base word column of the table.',
      'For each word, write the other forms in the row (like -ing, past tense, or noun). If that word does not have that form, write X in that box.',
      'Read each sentence below. Fill in each blank with the correct word form. Use the word bank if you need help.',
    ]
  }
  return [
    'Write each vocabulary word in the Base word column of the table.',
    'For each word, write the other forms in the row (like -ing, past tense, or noun). If that word does not have that form, write X in that box.',
    'Read each sentence below. Fill in each blank with the correct word form.',
  ]
}

/** @deprecated Use wordFormInstructionSteps for printable worksheets */
export function wordFormInstructions(
  showWordBank: boolean,
  dictationIncluded: boolean,
): string {
  return wordFormInstructionSteps(showWordBank, dictationIncluded).join(' ')
}

export function wordStoriesPart1Instructions(): string {
  return 'Read each story below. The vocabulary words are underlined. After reading, match each definition in Part 1B to the correct word.'
}

export function wordStoriesDefinitionMatchInstructions(): string {
  return 'Read the definitions below. Write the correct vocabulary word on the line next to each definition.'
}

export function wordStoriesClozeInstructions(): string {
  return 'Read each new story below. The stories use a different mix of vocabulary words than Part 1 and appear in a different order. Fill in each blank with the correct word from the word bank.'
}
