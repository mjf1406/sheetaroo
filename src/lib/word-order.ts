import type { PreviewableWorksheetId } from '@/lib/worksheet-preview'
import { PREVIEWABLE_WORKSHEETS } from '@/lib/worksheet-preview'

export type ShuffleSeeds = Record<PreviewableWorksheetId, number>

function normalizeWord(word: string): string {
  return word.trim().toLowerCase()
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  if (items.length <= 1) {
    return [...items]
  }

  const result = [...items]
  const random = mulberry32(seed)

  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!]
  }

  return result
}

export function orderSentencesByWords<T extends { word: string }>(
  sentences: readonly T[],
  words: readonly string[],
): T[] {
  const wordIndex = new Map(
    words.map((word, index) => [normalizeWord(word), index]),
  )

  return [...sentences].sort((left, right) => {
    const leftIndex =
      wordIndex.get(normalizeWord(left.word)) ?? Number.MAX_SAFE_INTEGER
    const rightIndex =
      wordIndex.get(normalizeWord(right.word)) ?? Number.MAX_SAFE_INTEGER
    return leftIndex - rightIndex
  })
}

export function createShuffleSeed(): number {
  return Math.floor(Math.random() * 0xffffffff)
}

export function createDefaultShuffleSeeds(): ShuffleSeeds {
  return Object.fromEntries(
    PREVIEWABLE_WORKSHEETS.map((id) => [id, createShuffleSeed()]),
  ) as ShuffleSeeds
}

export function buildOrderedWordsByWorksheet(
  words: readonly string[],
  seeds: ShuffleSeeds,
  worksheetIds: readonly PreviewableWorksheetId[] = PREVIEWABLE_WORKSHEETS,
): Record<PreviewableWorksheetId, string[]> {
  const result = {} as Record<PreviewableWorksheetId, string[]>
  for (const id of worksheetIds) {
    result[id] = seededShuffle(words, seeds[id])
  }
  return result
}
