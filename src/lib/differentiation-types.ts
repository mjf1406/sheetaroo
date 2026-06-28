export const GRADE_LEVELS = [
  'K',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
] as const

export type GradeLevel = (typeof GRADE_LEVELS)[number]

export type DifferentiationTier = {
  id: string
  gradeLevel: GradeLevel
  copies: number
}

export function formatGradeLabel(gradeLevel: GradeLevel): string {
  return gradeLevel === 'K' ? 'Kindergarten' : `Grade ${gradeLevel}`
}

export function createTierId(): string {
  return crypto.randomUUID()
}

export function getFirstUnusedGrade(tiers: DifferentiationTier[]): GradeLevel | null {
  const used = new Set(tiers.map((tier) => tier.gradeLevel))
  return GRADE_LEVELS.find((grade) => !used.has(grade)) ?? null
}

export function createDefaultTier(): DifferentiationTier {
  return {
    id: createTierId(),
    gradeLevel: '5',
    copies: 1,
  }
}

export function getUsedGrades(
  tiers: DifferentiationTier[],
  excludeId?: string,
): Set<GradeLevel> {
  return new Set(
    tiers.filter((tier) => tier.id !== excludeId).map((tier) => tier.gradeLevel),
  )
}
