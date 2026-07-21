import { describe, expect, it } from 'vite-plus/test'

import { generateCrossword } from '@/lib/crossword-generator'

describe('generateCrossword', () => {
  it('returns the same layout for the same seed', () => {
    const words = ['cat', 'car', 'art', 'rat']
    const first = generateCrossword(words, 42)
    const second = generateCrossword(words, 42)

    expect(first.grid).toEqual(second.grid)
    expect(first.placements).toEqual(second.placements)
  })

  it('places intersecting words on a simple set', () => {
    const result = generateCrossword(['cat', 'act', 'fact'], 42)

    expect(result.unplaced).toEqual([])
    expect(result.placements.length).toBe(3)
    expect(result.grid.length).toBeGreaterThan(0)
    expect(result.across.length + result.down.length).toBe(3)
  })

  it('assigns clue numbers in reading order', () => {
    const result = generateCrossword(['cat', 'act', 'fact'], 42)
    const numbers = result.placements.map((placement) => placement.number)

    expect(numbers.every((number) => number > 0)).toBe(true)
    expect(new Set(numbers).size).toBe(numbers.length)
    expect(Math.min(...numbers)).toBe(1)
  })

  it('reports words that cannot intersect', () => {
    const result = generateCrossword(['abc', 'xyz'], 1)

    expect(result.unplaced.length).toBeGreaterThan(0)
  })
})
