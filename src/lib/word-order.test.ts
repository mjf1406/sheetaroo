import { describe, expect, it } from 'vite-plus/test'

import {
  buildOrderedWordsByWorksheet,
  orderSentencesByWords,
  seededShuffle,
} from '@/lib/word-order'

describe('seededShuffle', () => {
  it('returns the same order for the same seed', () => {
    const items = ['a', 'b', 'c', 'd', 'e']
    expect(seededShuffle(items, 42)).toEqual(seededShuffle(items, 42))
  })

  it('returns a different order for a different seed', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    expect(seededShuffle(items, 1)).not.toEqual(seededShuffle(items, 2))
  })

  it('preserves all items', () => {
    const items = ['one', 'two', 'three', 'four']
    const shuffled = seededShuffle(items, 99)
    expect(shuffled.sort()).toEqual(items.sort())
  })
})

describe('orderSentencesByWords', () => {
  it('orders sentences to match the word list', () => {
    const sentences = [
      { id: '1', word: 'cat', sentence: 'The _____ (cat) sat.' },
      { id: '2', word: 'dog', sentence: 'The _____ (dog) ran.' },
      { id: '3', word: 'bird', sentence: 'The _____ (bird) flew.' },
    ]
    const words = ['bird', 'cat', 'dog']

    expect(orderSentencesByWords(sentences, words).map((s) => s.word)).toEqual([
      'bird',
      'cat',
      'dog',
    ])
  })

  it('matches words case-insensitively', () => {
    const sentences = [
      { id: '1', word: 'Compare', sentence: 'We _____ the texts.' },
      { id: '2', word: 'Detail', sentence: 'Every _____ matters.' },
    ]
    const words = ['detail', 'compare']

    expect(orderSentencesByWords(sentences, words).map((s) => s.word)).toEqual([
      'Detail',
      'Compare',
    ])
  })
})

describe('buildOrderedWordsByWorksheet', () => {
  it('produces different orders for different worksheet seeds', () => {
    const words = ['a', 'b', 'c', 'd', 'e', 'f']
    const seeds = {
      'dictation-audio': 1,
      'draw-one-word': 6,
      'fill-in-the-blank': 2,
      'word-search': 3,
      'crossword-puzzle': 4,
      'word-forms': 5,
      'word-stories': 7,
    } as const

    const ordered = buildOrderedWordsByWorksheet(words, seeds)

    expect(ordered['dictation-audio']).not.toEqual(ordered['fill-in-the-blank'])
  })
})
