import type {
  WordSearchCase,
  WordSearchDirections,
  WordSearchPlacement,
  WordSearchResult,
  WordSearchSettings,
} from '@/lib/word-search-types'

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

function randomInt(random: () => number, max: number): number {
  return Math.floor(random() * max)
}

function randomLetter(random: () => number): string {
  return String.fromCharCode(65 + randomInt(random, 26))
}

export function sanitizeWordForSearch(word: string): string {
  return word.replace(/[^a-zA-Z]/g, '').toUpperCase()
}

export function getDirectionVectors(
  directions: WordSearchDirections,
): Array<[number, number]> {
  const vectors: Array<[number, number]> = []

  if (directions.horizontal) vectors.push([0, 1])
  if (directions.vertical) vectors.push([1, 0])
  if (directions.diagonal) {
    vectors.push([1, 1])
    vectors.push([1, -1])
  }

  if (directions.backwards) {
    const base = [...vectors]
    for (const [dr, dc] of base) {
      vectors.push([-dr, -dc])
    }
  }

  const seen = new Set<string>()
  return vectors.filter(([dr, dc]) => {
    const key = `${dr},${dc}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function canPlaceWord(
  grid: Array<Array<string | null>>,
  word: string,
  row: number,
  col: number,
  dr: number,
  dc: number,
): boolean {
  const height = grid.length
  const width = grid[0]?.length ?? 0

  for (let index = 0; index < word.length; index++) {
    const r = row + dr * index
    const c = col + dc * index
    if (r < 0 || r >= height || c < 0 || c >= width) return false
    const existing = grid[r]?.[c]
    if (existing !== null && existing !== word[index]) return false
  }

  return true
}

function placeWord(
  grid: Array<Array<string | null>>,
  word: string,
  row: number,
  col: number,
  dr: number,
  dc: number,
): void {
  for (let index = 0; index < word.length; index++) {
    const r = row + dr * index
    const c = col + dc * index
    grid[r]![c] = word[index]!
  }
}

function applyLetterCase(
  grid: string[][],
  letterCase: WordSearchCase,
  random: () => number,
): string[][] {
  return grid.map((row) =>
    row.map((letter) => {
      if (letterCase === 'upper') return letter.toUpperCase()
      if (letterCase === 'lower') return letter.toLowerCase()
      return random() < 0.5 ? letter.toUpperCase() : letter.toLowerCase()
    }),
  )
}

const MAX_PLACEMENT_ATTEMPTS = 200

export function generateWordSearch(
  words: readonly string[],
  settings: WordSearchSettings,
  seed: number,
): WordSearchResult {
  const random = mulberry32(seed)
  const { width, height } = settings
  const directionVectors = getDirectionVectors(settings.directions)

  if (directionVectors.length === 0) {
    return {
      grid: Array.from({ length: height }, () =>
        Array.from({ length: width }, () => ''),
      ),
      placements: [],
      unplaced: [...words],
    }
  }

  const sanitized = words
    .map((word) => ({ original: word, cleaned: sanitizeWordForSearch(word) }))
    .filter((item) => item.cleaned.length > 0)

  const sorted = [...sanitized].sort(
    (left, right) => right.cleaned.length - left.cleaned.length,
  )

  const grid: Array<Array<string | null>> = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => null),
  )
  const placements: WordSearchPlacement[] = []
  const unplaced: string[] = []

  for (const { original, cleaned } of sorted) {
    if (cleaned.length > width && cleaned.length > height) {
      unplaced.push(original)
      continue
    }

    let placed = false

    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
      const [dr, dc] =
        directionVectors[randomInt(random, directionVectors.length)]!
      const row = randomInt(random, height)
      const col = randomInt(random, width)

      if (!canPlaceWord(grid, cleaned, row, col, dr, dc)) continue

      placeWord(grid, cleaned, row, col, dr, dc)
      placements.push({ word: original, row, col, dr, dc })
      placed = true
      break
    }

    if (!placed) {
      unplaced.push(original)
    }
  }

  const filledGrid = grid.map((row) =>
    row.map((cell) => cell ?? randomLetter(random)),
  )

  return {
    grid: applyLetterCase(filledGrid, settings.letterCase, random),
    placements,
    unplaced,
  }
}

export function getWordsTooLongForGrid(
  words: readonly string[],
  width: number,
  height: number,
): string[] {
  const maxDimension = Math.max(width, height)
  return words.filter(
    (word) => sanitizeWordForSearch(word).length > maxDimension,
  )
}
