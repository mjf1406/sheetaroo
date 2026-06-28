import type { DifferentiationTier, GradeLevel } from '@/lib/differentiation-types'
import { formatGradeLabel } from '@/lib/differentiation-types'
import type { FillInBlankSentence } from '@/lib/fill-in-blank-types'
import { WORKSHEET_IDS, type WorksheetId } from '@/lib/vocabulary-types'

export const PREVIEWABLE_WORKSHEETS = ['dictation-audio', 'fill-in-the-blank'] as const
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

export function getSentencesForGrade(
  sentences: FillInBlankSentence[],
  gradeLevel: GradeLevel,
  differentiationEnabled: boolean,
  defaultGrade: GradeLevel,
): FillInBlankSentence[] {
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

export function fillInBlankInstructions(
  showWordBank: boolean,
  dictationIncluded: boolean,
): string {
  if (showWordBank) {
    return 'Read each sentence and fill in the blank using a word from the word bank below. Each word may be used once.'
  }
  if (dictationIncluded) {
    return 'Read each sentence and fill in the blank using the words from the Dictation section as your word bank.'
  }
  return 'Read each sentence and fill in the blank using your vocabulary words.'
}
