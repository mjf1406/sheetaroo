import { describe, expect, it } from 'vite-plus/test'

import {
  buildOrderedWordsByWorksheet,
  orderSentencesByWords,
  reconcileKeptWordOrder,
  seededShuffle,
  wordListsEqual,
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

describe('wordListsEqual', () => {
  it('matches lists case-insensitively', () => {
    expect(wordListsEqual(['Cat', 'Dog'], ['cat', 'dog'])).toBe(true)
  })

  it('rejects different order', () => {
    expect(wordListsEqual(['cat', 'dog'], ['dog', 'cat'])).toBe(false)
  })
})

describe('reconcileKeptWordOrder', () => {
  it('keeps the previous relative order and appends new words', () => {
    expect(
      reconcileKeptWordOrder(['dog', 'cat'], ['cat', 'bird', 'dog']),
    ).toEqual(['dog', 'cat', 'bird'])
  })

  it('drops words that were removed from the list', () => {
    expect(
      reconcileKeptWordOrder(['dog', 'cat', 'bird'], ['bird', 'dog']),
    ).toEqual(['dog', 'bird'])
  })

  it('uses the current spelling of kept words', () => {
    expect(reconcileKeptWordOrder(['cat'], ['Cat'])).toEqual(['Cat'])
  })

  it('preserves duplicate words as a multiset', () => {
    expect(reconcileKeptWordOrder(['a', 'b', 'a'], ['a', 'a', 'b'])).toEqual([
      'a',
      'b',
      'a',
    ])
  })

  it('returns the current list when nothing was kept', () => {
    expect(reconcileKeptWordOrder([], ['one', 'two'])).toEqual(['one', 'two'])
  })
})
