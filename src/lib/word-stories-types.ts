import type { GradeLevel } from '@/lib/differentiation-types'
import { formatGradeLabel } from '@/lib/differentiation-types'
import { seededShuffle } from '@/lib/word-order'

export type WordStorySettings = {
  storyCount: number
  allowRepeatAcrossStories: boolean
  allowRepeatWithinStory: boolean
  includeDefinitionMatch: boolean
  includeClozeStories: boolean
}

export const DEFAULT_WORD_STORY_SETTINGS: WordStorySettings = {
  storyCount: 1,
  allowRepeatAcrossStories: false,
  allowRepeatWithinStory: false,
  includeDefinitionMatch: true,
  includeClozeStories: true,
}

export type WordStory = {
  id: string
  gradeLevel: GradeLevel
  storyIndex: number
  title: string
  storyText: string
  clozeText: string
  words: string[]
  clozeWords: string[]
  source: 'ai' | 'manual'
}

export type WordStoryDefinition = {
  word: string
  definition: string
  source: 'teacher' | 'ai'
}

export type WordStorySegment =
  | { type: 'text'; value: string }
  | { type: 'word'; value: string }

const WORD_TOKEN_REGEX = /\{\{([^}]+)\}\}/g
export const CLOZE_ASSIGNMENT_SEED_OFFSET = 10007
export const PART2_ORDER_SEED_OFFSET = 20011
export const PART2_WORD_BANK_SEED_OFFSET = 30013

export type StoryWordAssignment = {
  storyIndex: number
  words: string[]
}

export function createWordStoryId(): string {
  return crypto.randomUUID()
}

export function createManualWordStory(input: {
  gradeLevel: GradeLevel
  storyIndex: number
  title?: string
  words: string[]
  clozeWords?: string[]
}): WordStory {
  const placeholderWords = input.words.map((word) => `{{${word}}}`).join(' ')
  const clozeWords = input.clozeWords ?? [...input.words]
  const clozePlaceholderWords = clozeWords
    .map((word) => `{{${word}}}`)
    .join(' ')
  return {
    id: createWordStoryId(),
    gradeLevel: input.gradeLevel,
    storyIndex: input.storyIndex,
    title: input.title ?? `Story ${input.storyIndex + 1}`,
    storyText: placeholderWords
      ? `Once upon a time, ${placeholderWords} appeared in a story.`
      : '',
    clozeText: clozePlaceholderWords
      ? `Once upon a time, ${clozePlaceholderWords} appeared in another story.`
      : '',
    words: input.words,
    clozeWords,
    source: 'manual',
  }
}

export function wordStoriesHeading(
  gradeLevel: GradeLevel,
  count: number,
): string {
  return `${formatGradeLabel(gradeLevel)} — ${count} stor${count === 1 ? 'y' : 'ies'}`
}

export function splitWordsIntoStories(
  words: readonly string[],
  settings: Pick<WordStorySettings, 'storyCount' | 'allowRepeatAcrossStories'>,
  seed: number,
): string[][] {
  const maxStories = Math.max(1, words.length || 1)
  const storyCount = Math.max(1, Math.min(settings.storyCount, maxStories))

  if (words.length === 0) {
    return Array.from({ length: storyCount }, () => [])
  }

  if (settings.allowRepeatAcrossStories) {
    return Array.from({ length: storyCount }, () => [...words])
  }

  const shuffled = seededShuffle(words, seed)
  const groups: string[][] = Array.from({ length: storyCount }, () => [])

  for (let index = 0; index < shuffled.length; index++) {
    const group = groups[index % storyCount]
    const word = shuffled[index]
    if (group && word) {
      group.push(word)
    }
  }

  return groups.filter((group) => group.length > 0)
}

export function buildStoryAssignments(
  words: readonly string[],
  settings: Pick<WordStorySettings, 'storyCount' | 'allowRepeatAcrossStories'>,
  seed: number,
): StoryWordAssignment[] {
  return splitWordsIntoStories(words, settings, seed).map(
    (groupWords, storyIndex) => ({
      storyIndex,
      words: groupWords,
    }),
  )
}

export function buildClozeAssignments(
  words: readonly string[],
  settings: Pick<WordStorySettings, 'storyCount' | 'allowRepeatAcrossStories'>,
  seed: number,
): StoryWordAssignment[] {
  const groups = splitWordsIntoStories(
    words,
    settings,
    seed + CLOZE_ASSIGNMENT_SEED_OFFSET,
  )

  return groups.map((groupWords, storyIndex) => ({
    storyIndex,
    words:
      settings.allowRepeatAcrossStories || groups.length <= 1
        ? seededShuffle(groupWords, seed + storyIndex + 1)
        : groupWords,
  }))
}

export function buildPart2ClozeOrder(
  storyCount: number,
  seed: number,
): number[] {
  if (storyCount <= 1) {
    return [0]
  }

  const indices = Array.from({ length: storyCount }, (_, index) => index)
  for (let attempt = 0; attempt < 20; attempt++) {
    const shuffled = seededShuffle(
      indices,
      seed + PART2_ORDER_SEED_OFFSET + attempt,
    )
    if (!shuffled.some((value, index) => value === index)) {
      return shuffled
    }
  }

  return indices.map((_, index) => (index + 1) % storyCount)
}

export function orderStoriesForPart2(
  stories: readonly WordStory[],
  seed: number,
): WordStory[] {
  const sortedStories = [...stories].sort(
    (left, right) => left.storyIndex - right.storyIndex,
  )
  if (sortedStories.length <= 1) {
    return sortedStories
  }

  const order = buildPart2ClozeOrder(sortedStories.length, seed)
  return order.map((index) => sortedStories[index]!).filter(Boolean)
}

export function buildClozeWordBank(
  stories: readonly WordStory[],
  seed: number,
): string[] {
  const words: string[] = []
  const seen = new Set<string>()

  for (const story of stories) {
    for (const word of story.clozeWords) {
      const key = word.trim().toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        words.push(word)
      }
    }
  }

  return seededShuffle(words, seed + PART2_WORD_BANK_SEED_OFFSET)
}

export function parseWordTokens(text: string): WordStorySegment[] {
  const segments: WordStorySegment[] = []
  let lastIndex = 0

  for (const match of text.matchAll(WORD_TOKEN_REGEX)) {
    const matchIndex = match.index
    if (matchIndex > lastIndex) {
      segments.push({
        type: 'text',
        value: text.slice(lastIndex, matchIndex),
      })
    }
    segments.push({
      type: 'word',
      value: (match[1] ?? '').trim(),
    })
    lastIndex = matchIndex + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      value: text.slice(lastIndex),
    })
  }

  return segments
}

export function renderStoryTextForStudent(text: string): string {
  return text.replace(WORD_TOKEN_REGEX, '_____')
}

export function renderStoryTextWithAnswers(text: string): string {
  return text.replace(WORD_TOKEN_REGEX, (_match, word: string) => word.trim())
}

export function buildDefinitionList(
  stories: WordStory[],
  definitions: WordStoryDefinition[],
  seed: number,
): WordStoryDefinition[] {
  const wordOrder: string[] = []
  const seen = new Set<string>()
  for (const story of stories) {
    for (const word of story.words) {
      const key = word.trim().toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        wordOrder.push(word)
      }
    }
  }

  const definitionByWord = new Map<string, WordStoryDefinition>()
  for (const item of definitions) {
    const key = item.word.trim().toLowerCase()
    if (!definitionByWord.has(key)) {
      definitionByWord.set(key, item)
    }
  }

  const items: WordStoryDefinition[] = []
  for (const word of wordOrder) {
    const existing = definitionByWord.get(word.trim().toLowerCase())
    if (existing) {
      items.push(existing)
    }
  }

  return seededShuffle(items, seed)
}
