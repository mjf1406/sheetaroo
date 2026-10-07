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
      [{ word: 'compare', definitions: ['to examine likenesses'] }],
      [],
      '5',
    )

    expect(clues).toHaveLength(1)
    const clue = clues[0]
    if (!clue) throw new Error('expected a crossword clue')
    expect(formatCrosswordClueText(clue.definitions)).toBe(
      'to examine likenesses',
    )
  })

  it('uses the first two vocabulary definitions', () => {
    const clues = buildEffectiveCrosswordClues(
      [
        {
          word: 'compare',
          definitions: [
            'to examine likenesses',
            'to look side by side',
            'a third definition',
          ],
        },
      ],
      [],
      '5',
    )

    const clue = clues[0]
    if (!clue) throw new Error('expected a crossword clue')
    expect(clue.definitions).toEqual([
      'to examine likenesses',
      'to look side by side',
    ])
  })
})
