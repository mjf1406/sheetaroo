import { sanitizeWordForCrossword } from '@/lib/crossword-types'
import type {
  CrosswordCell,
  CrosswordDirection,
  CrosswordPlacement,
  CrosswordResult,
} from '@/lib/crossword-types'

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

function directionDelta(direction: CrosswordDirection): [number, number] {
  return direction === 'across' ? [0, 1] : [1, 0]
}

function perpendicularDelta(
  direction: CrosswordDirection,
): Array<[number, number]> {
  return direction === 'across'
    ? [
        [1, 0],
        [-1, 0],
      ]
    : [
        [0, 1],
        [0, -1],
      ]
}

function cellKey(row: number, col: number): string {
  return `${row},${col}`
}

type LetterGrid = Map<string, string>

function canPlaceWord(
  grid: LetterGrid,
  word: string,
  row: number,
  col: number,
  direction: CrosswordDirection,
): boolean {
  const [dr, dc] = directionDelta(direction)
  const beforeKey = cellKey(row - dr, col - dc)
  if (grid.has(beforeKey)) return false

  const afterKey = cellKey(row + dr * word.length, col + dc * word.length)
  if (grid.has(afterKey)) return false

  for (let index = 0; index < word.length; index++) {
    const r = row + dr * index
    const c = col + dc * index
    const key = cellKey(r, c)
    const existing = grid.get(key)
    const letter = word[index]!

    if (existing !== undefined && existing !== letter) return false

    if (existing === undefined) {
      for (const [pdr, pdc] of perpendicularDelta(direction)) {
        if (grid.has(cellKey(r + pdr, c + pdc))) return false
      }
    }
  }

  return true
}

function placeWord(
  grid: LetterGrid,
  word: string,
  row: number,
  col: number,
  direction: CrosswordDirection,
): void {
  const [dr, dc] = directionDelta(direction)
  for (let index = 0; index < word.length; index++) {
    grid.set(cellKey(row + dr * index, col + dc * index), word[index]!)
  }
}

type RawPlacement = {
  word: string
  original: string
  row: number
  col: number
  direction: CrosswordDirection
}

function findPlacementCandidates(
  word: string,
  existingPlacements: RawPlacement[],
): Array<{ row: number; col: number; direction: CrosswordDirection }> {
  const candidates: Array<{
    row: number
    col: number
    direction: CrosswordDirection
  }> = []

  for (const placement of existingPlacements) {
    const placedDirection = placement.direction
    const newDirection: CrosswordDirection =
      placedDirection === 'across' ? 'down' : 'across'
    const [pdr, pdc] = directionDelta(placedDirection)

    for (
      let placedIndex = 0;
      placedIndex < placement.word.length;
      placedIndex++
    ) {
      const placedLetter = placement.word[placedIndex]!
      for (let wordIndex = 0; wordIndex < word.length; wordIndex++) {
        if (word[wordIndex] !== placedLetter) continue

        const intersectionRow = placement.row + pdr * placedIndex
        const intersectionCol = placement.col + pdc * placedIndex
        const [ndr, ndc] = directionDelta(newDirection)
        const startRow = intersectionRow - ndr * wordIndex
        const startCol = intersectionCol - ndc * wordIndex

        candidates.push({
          row: startRow,
          col: startCol,
          direction: newDirection,
        })
      }
    }
  }

  return candidates
}

function assignNumbers(
  grid: LetterGrid,
  placements: RawPlacement[],
): {
  numberedGrid: CrosswordCell[][]
  numberedPlacements: CrosswordPlacement[]
  across: CrosswordPlacement[]
  down: CrosswordPlacement[]
} {
  const rows = [...grid.keys()].map((key) => Number(key.split(',')[0]))
  const cols = [...grid.keys()].map((key) => Number(key.split(',')[1]))
  const minRow = Math.min(...rows)
  const maxRow = Math.max(...rows)
  const minCol = Math.min(...cols)
  const maxCol = Math.max(...cols)

  const height = maxRow - minRow + 1
  const width = maxCol - minCol + 1
  const numbers = new Map<string, number>()
  let nextNumber = 1

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const key = cellKey(row, col)
      if (!grid.has(key)) continue

      const normalizedRow = row - minRow
      const normalizedCol = col - minCol
      const leftEmpty = !grid.has(cellKey(row, col - 1))
      const rightHasLetter = grid.has(cellKey(row, col + 1))
      const topEmpty = !grid.has(cellKey(row - 1, col))
      const bottomHasLetter = grid.has(cellKey(row + 1, col))

      const startsAcross = leftEmpty && rightHasLetter
      const startsDown = topEmpty && bottomHasLetter
      if (!startsAcross && !startsDown) continue

      numbers.set(`${normalizedRow},${normalizedCol}`, nextNumber)
      nextNumber++
    }
  }

  const numberedGrid: CrosswordCell[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => null),
  )

  for (const [key, letter] of grid.entries()) {
    const [row, col] = key.split(',').map(Number)
    if (row === undefined || col === undefined) continue
    const normalizedRow = row - minRow
    const normalizedCol = col - minCol
    numberedGrid[normalizedRow]![normalizedCol] = {
      letter,
      number: numbers.get(`${normalizedRow},${normalizedCol}`),
    }
  }

  const numberedPlacements: CrosswordPlacement[] = placements.map(
    (placement) => {
      const normalizedRow = placement.row - minRow
      const normalizedCol = placement.col - minCol
      const number = numbers.get(`${normalizedRow},${normalizedCol}`) ?? 0
      return {
        word: placement.original,
        row: normalizedRow,
        col: normalizedCol,
        direction: placement.direction,
        number,
      }
    },
  )

  return {
    numberedGrid,
    numberedPlacements,
    across: numberedPlacements.filter((item) => item.direction === 'across'),
    down: numberedPlacements.filter((item) => item.direction === 'down'),
  }
}

const MAX_PLACEMENT_ATTEMPTS = 300

export function generateCrossword(
  words: readonly string[],
  seed: number,
): CrosswordResult {
  const random = mulberry32(seed)
  const sanitized = words
    .map((original) => ({
      original,
      cleaned: sanitizeWordForCrossword(original),
    }))
    .filter((item) => item.cleaned.length > 0)

  if (sanitized.length === 0) {
    return {
      grid: [],
      placements: [],
      across: [],
      down: [],
      unplaced: [],
    }
  }

  const sorted = [...sanitized].sort(
    (left, right) => right.cleaned.length - left.cleaned.length,
  )

  const grid: LetterGrid = new Map()
  const rawPlacements: RawPlacement[] = []
  const unplaced: string[] = []

  const first = sorted[0]!
  const firstRow = 50
  const firstCol = 50
  placeWord(grid, first.cleaned, firstRow, firstCol, 'across')
  rawPlacements.push({
    word: first.cleaned,
    original: first.original,
    row: firstRow,
    col: firstCol,
    direction: 'across',
  })

  for (const item of sorted.slice(1)) {
    const candidates = findPlacementCandidates(item.cleaned, rawPlacements)
    if (candidates.length === 0) {
      unplaced.push(item.original)
      continue
    }

    const shuffled = [...candidates]
    for (let index = shuffled.length - 1; index > 0; index--) {
      const swapIndex = randomInt(random, index + 1)
      ;[shuffled[index], shuffled[swapIndex]] = [
        shuffled[swapIndex]!,
        shuffled[index]!,
      ]
    }

    let placed = false
    const attempts = Math.min(MAX_PLACEMENT_ATTEMPTS, shuffled.length)

    for (let attempt = 0; attempt < attempts; attempt++) {
      const candidate = shuffled[attempt]!
      if (
        !canPlaceWord(
          grid,
          item.cleaned,
          candidate.row,
          candidate.col,
          candidate.direction,
        )
      ) {
        continue
      }

      placeWord(
        grid,
        item.cleaned,
        candidate.row,
        candidate.col,
        candidate.direction,
      )
      rawPlacements.push({
        word: item.cleaned,
        original: item.original,
        row: candidate.row,
        col: candidate.col,
        direction: candidate.direction,
      })
      placed = true
      break
    }

    if (!placed) {
      unplaced.push(item.original)
    }
  }

  const { numberedGrid, numberedPlacements, across, down } = assignNumbers(
    grid,
    rawPlacements,
  )

  return {
    grid: numberedGrid,
    placements: numberedPlacements,
    across,
    down,
    unplaced,
  }
}

export function findPlacementForClue(
  result: CrosswordResult,
  word: string,
): CrosswordPlacement | undefined {
  const cleaned = sanitizeWordForCrossword(word)
  return result.placements.find(
    (placement) => sanitizeWordForCrossword(placement.word) === cleaned,
  )
}
