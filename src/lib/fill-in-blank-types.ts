import type { GradeLevel } from '@/lib/differentiation-types'
import { formatGradeLabel } from '@/lib/differentiation-types'

export type FillInBlankSentence = {
  id: string
  word: string
  gradeLevel: GradeLevel
  sentence: string
  source: 'manual' | 'ai'
}

export function createSentenceId(): string {
  return crypto.randomUUID()
}

export function createManualSentence(input: {
  word: string
  gradeLevel: GradeLevel
  sentence?: string
}): FillInBlankSentence {
  return {
    id: createSentenceId(),
    word: input.word,
    gradeLevel: input.gradeLevel,
    sentence: input.sentence ?? `The _____ (${input.word})`,
    source: 'manual',
  }
}

export function gradeHeading(gradeLevel: GradeLevel, count: number): string {
  return `${formatGradeLabel(gradeLevel)} — ${count} sentence${count === 1 ? '' : 's'}`
}
