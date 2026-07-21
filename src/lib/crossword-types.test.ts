import { describe, expect, it } from 'vite-plus/test'

import {
  buildEffectiveCrosswordClues,
  formatCrosswordClueText,
} from '@/lib/crossword-types'

describe('formatCrosswordClueText', () => {
  it('returns a single definition unchanged', () => {
    expect(formatCrosswordClueText(['to examine likenesses'])).toBe(
      'to examine likenesses',
    )
  })
})

describe('buildEffectiveCrosswordClues', () => {
  it('falls back to vocabulary entry definitions', () => {
    const clues = buildEffectiveCrosswordClues(
      [{ word: 'compare', definition: 'to examine likenesses' }],
      [],
      '5',
    )

    expect(clues).toHaveLength(1)
    expect(formatCrosswordClueText(clues[0].definitions)).toBe(
      'to examine likenesses',
    )
  })
})
