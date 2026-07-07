import { describe, expect, it } from 'vitest'

import {
  buildClozeAssignments,
  buildDefinitionList,
  buildPart2ClozeOrder,
  buildClozeWordBank,
  buildStoryAssignments,
  parseWordTokens,
  renderStoryTextForStudent,
  splitWordsIntoStories,
} from '@/lib/word-stories-types'

describe('splitWordsIntoStories', () => {
  it('splits words across stories without repetition', () => {
    const groups = splitWordsIntoStories(
      ['a', 'b', 'c', 'd'],
      { storyCount: 2, allowRepeatAcrossStories: false },
      42,
    )

    expect(groups).toHaveLength(2)
    expect(groups.flat().sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('repeats words across stories when enabled', () => {
    const groups = splitWordsIntoStories(
      ['a', 'b'],
      { storyCount: 2, allowRepeatAcrossStories: true },
      42,
    )

    expect(groups).toEqual([
      ['a', 'b'],
      ['a', 'b'],
    ])
  })
})

describe('parseWordTokens', () => {
  it('parses marked vocabulary words', () => {
    expect(parseWordTokens('Maya went to {{compare}} prices.')).toEqual([
      { type: 'text', value: 'Maya went to ' },
      { type: 'word', value: 'compare' },
      { type: 'text', value: ' prices.' },
    ])
  })
})

describe('renderStoryTextForStudent', () => {
  it('replaces tokens with blanks', () => {
    expect(renderStoryTextForStudent('Use {{compare}} here.')).toBe(
      'Use _____ here.',
    )
  })
})

describe('buildDefinitionList', () => {
  it('shuffles definitions deterministically', () => {
    const stories = [
      {
        id: '1',
        gradeLevel: '5' as const,
        storyIndex: 0,
        title: 'Story',
        storyText: '{{alpha}}',
        clozeText: '{{beta}}',
        words: ['alpha', 'beta'],
        clozeWords: ['beta', 'alpha'],
        source: 'ai' as const,
      },
    ]
    const definitions = [
      { word: 'alpha', definition: 'first', source: 'teacher' as const },
      { word: 'beta', definition: 'second', source: 'ai' as const },
    ]

    const first = buildDefinitionList(stories, definitions, 7)
    const second = buildDefinitionList(stories, definitions, 7)

    expect(first).toEqual(second)
    expect(first).toHaveLength(2)
  })
})

describe('buildClozeAssignments', () => {
  it('uses a different split than Part 1 when possible', () => {
    const settings = { storyCount: 2, allowRepeatAcrossStories: false }
    const words = ['a', 'b', 'c', 'd']
    const part1 = buildStoryAssignments(words, settings, 42)
    const part2 = buildClozeAssignments(words, settings, 42)

    expect(part1).toHaveLength(2)
    expect(part2).toHaveLength(2)
    expect(part1.flatMap((item) => item.words).sort()).toEqual(['a', 'b', 'c', 'd'])
    expect(part2.flatMap((item) => item.words).sort()).toEqual(['a', 'b', 'c', 'd'])
    expect(part1).not.toEqual(part2)
  })
})

describe('buildPart2ClozeOrder', () => {
  it('deranges story order when there are multiple stories', () => {
    const order = buildPart2ClozeOrder(3, 99)
    expect(order).toHaveLength(3)
    expect(order.some((value, index) => value !== index)).toBe(true)
  })
})

describe('buildClozeWordBank', () => {
  it('includes all cloze words', () => {
    const stories = [
      {
        id: '1',
        gradeLevel: '5' as const,
        storyIndex: 0,
        title: 'One',
        storyText: '{{alpha}}',
        clozeText: '{{alpha}}',
        words: ['alpha'],
        clozeWords: ['alpha'],
        source: 'ai' as const,
      },
      {
        id: '2',
        gradeLevel: '5' as const,
        storyIndex: 1,
        title: 'Two',
        storyText: '{{beta}}',
        clozeText: '{{beta}}',
        words: ['beta'],
        clozeWords: ['beta'],
        source: 'ai' as const,
      },
    ]

    const bank = buildClozeWordBank(stories, 7)
    expect(bank.sort()).toEqual(['alpha', 'beta'])
  })
})
