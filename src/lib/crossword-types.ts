import type { GradeLevel } from '@/lib/differentiation-types'
import { formatGradeLabel } from '@/lib/differentiation-types'

export type CrosswordClue = {
  id: string
  word: string
  gradeLevel: GradeLevel
  definitions: string[]
  source: 'ai' | 'manual'
}

export type CrosswordCell = {
  letter: string
  number?: number
} | null

export type CrosswordDirection = 'across' | 'down'

export type CrosswordPlacement = {
  word: string
  row: number
  col: number
  direction: CrosswordDirection
  number: number
}

export type CrosswordResult = {
  grid: CrosswordCell[][]
  placements: CrosswordPlacement[]
  across: CrosswordPlacement[]
  down: CrosswordPlacement[]
  unplaced: string[]
}

export function createCrosswordClueId(): string {
  return crypto.randomUUID()
}

export function createManualCrosswordClue(input: {
  word: string
  gradeLevel: GradeLevel
  definitions: string[]
}): CrosswordClue {
  const definitions = input.definitions
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2)

  return {
    id: createCrosswordClueId(),
    word: input.word,
    gradeLevel: input.gradeLevel,
    definitions: definitions.length > 0 ? definitions : [''],
    source: 'manual',
  }
}

export function crosswordClueHeading(
  gradeLevel: GradeLevel,
  count: number,
): string {
  return `${formatGradeLabel(gradeLevel)} — ${count} clue${count === 1 ? '' : 's'}`
}

export function formatCrosswordClueText(definitions: string[]): string {
  const trimmed = definitions.map((item) => item.trim()).filter(Boolean)
  if (trimmed.length === 0) return ''
  if (trimmed.length === 1) return trimmed[0]!
  return `${trimmed[0]}; ${trimmed[1]}`
}

function normalizeCrosswordWordKey(word: string): string {
  return word.trim().toLowerCase()
}

export function buildEffectiveCrosswordClues(
  entries: Array<{ word: string; definition?: string }>,
  clues: CrosswordClue[],
  defaultGrade: GradeLevel,
): CrosswordClue[] {
  const result = [...clues]

  for (const entry of entries) {
    const wordKey = normalizeCrosswordWordKey(entry.word)
    const gradeClue = result.find(
      (clue) =>
        normalizeCrosswordWordKey(clue.word) === wordKey &&
        clue.gradeLevel === defaultGrade,
    )

    if (gradeClue) {
      if (formatCrosswordClueText(gradeClue.definitions).length > 0) continue

      const definition = entry.definition?.trim()
      if (!definition) continue

      const index = result.findIndex((clue) => clue.id === gradeClue.id)
      if (index >= 0) {
        result[index] = {
          ...gradeClue,
          definitions: [definition],
          source: 'manual',
        }
      }
      continue
    }

    const hasClueForWord = result.some(
      (clue) => normalizeCrosswordWordKey(clue.word) === wordKey,
    )
    if (hasClueForWord) continue

    const definition = entry.definition?.trim()
    if (!definition) continue

    result.push(
      createManualCrosswordClue({
        word: entry.word,
        gradeLevel: defaultGrade,
        definitions: [definition],
      }),
    )
  }

  return result
}

export function sanitizeWordForCrossword(word: string): string {
  return word.replace(/[^a-zA-Z]/g, '').toUpperCase()
}
