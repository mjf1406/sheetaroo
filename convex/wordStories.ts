import { v } from 'convex/values'

import { action } from './_generated/server'
import { internal } from './_generated/api'
import {
  buildWordStoriesBatchPrompt,
  buildWordStoryRegeneratePrompt,
  generateGeminiWordStoriesJson,
} from './lib/geminiText'
import type { GeminiWordStoryGradeBatch } from './lib/geminiText'

const vocabEntryValidator = v.object({
  word: v.string(),
  definition: v.optional(v.string()),
})

const tierValidator = v.object({
  gradeLevel: v.string(),
})

const storyAssignmentValidator = v.object({
  storyIndex: v.number(),
  words: v.array(v.string()),
})

type StoryAssignment = {
  storyIndex: number
  words: string[]
}

function normalizeWords(words: string[]): string[] {
  return words.map((word) => word.trim())
}

function wordSet(words: string[]): Set<string> {
  return new Set(words.map((word) => word.toLowerCase()))
}

function validateAssignmentWords(
  label: string,
  gradeLevel: string,
  storyIndex: number,
  expectedWords: string[],
  actualWords: string[],
) {
  const expected = wordSet(expectedWords)
  const actual = wordSet(actualWords)

  for (const word of expected) {
    if (!actual.has(word)) {
      throw new Error(
        `${label} story ${storyIndex} for grade ${gradeLevel} is missing word "${word}"`,
      )
    }
  }
}

function mapGradeResults(
  gradeLevels: string[],
  assignments: StoryAssignment[],
  clozeAssignments: StoryAssignment[],
  response: Awaited<ReturnType<typeof generateGeminiWordStoriesJson>>,
) {
  const stories: Array<{
    storyIndex: number
    gradeLevel: string
    title: string
    storyText: string
    clozeText: string
    words: string[]
    clozeWords: string[]
  }> = []
  const definitions: Array<{
    word: string
    definition: string
  }> = []

  for (const expectedGrade of gradeLevels) {
    const gradeGroup = response.grades.find(
      (group) => group.gradeLevel === expectedGrade,
    )
    if (!gradeGroup) {
      throw new Error(`Gemini response missing grade level ${expectedGrade}`)
    }
    validateGradeStories(
      expectedGrade,
      assignments,
      clozeAssignments,
      gradeGroup,
    )

    for (const story of gradeGroup.stories) {
      stories.push({
        storyIndex: story.storyIndex,
        gradeLevel: expectedGrade,
        title: story.title.trim(),
        storyText: story.storyText.trim(),
        clozeText: story.clozeText.trim(),
        words: normalizeWords(story.words),
        clozeWords: normalizeWords(story.clozeWords),
      })
    }

    for (const definition of gradeGroup.definitions) {
      definitions.push({
        word: definition.word.trim(),
        definition: definition.definition.trim(),
      })
    }
  }

  return { stories, definitions }
}

function validateGradeStories(
  gradeLevel: string,
  assignments: StoryAssignment[],
  clozeAssignments: StoryAssignment[],
  gradeGroup: GeminiWordStoryGradeBatch,
) {
  if (gradeGroup.stories.length !== assignments.length) {
    throw new Error(
      `Expected ${assignments.length} stories for grade ${gradeLevel}, got ${gradeGroup.stories.length}`,
    )
  }

  for (const assignment of assignments) {
    const story = gradeGroup.stories.find(
      (item) => item.storyIndex === assignment.storyIndex,
    )
    if (!story) {
      throw new Error(
        `Gemini response missing story index ${assignment.storyIndex} for grade ${gradeLevel}`,
      )
    }

    const clozeAssignment = clozeAssignments.find(
      (item) => item.storyIndex === assignment.storyIndex,
    )
    if (!clozeAssignment) {
      throw new Error(
        `Missing cloze assignment for story index ${assignment.storyIndex}`,
      )
    }

    validateAssignmentWords(
      'Context',
      gradeLevel,
      assignment.storyIndex,
      assignment.words,
      story.words,
    )
    validateAssignmentWords(
      'Cloze',
      gradeLevel,
      assignment.storyIndex,
      clozeAssignment.words,
      story.clozeWords,
    )
  }
}

export const generateBatch = action({
  args: {
    entries: v.array(vocabEntryValidator),
    tiers: v.array(tierValidator),
    assignments: v.array(storyAssignmentValidator),
    clozeAssignments: v.array(storyAssignmentValidator),
    allowRepeatWithinStory: v.boolean(),
  },
  returns: v.object({
    stories: v.array(
      v.object({
        storyIndex: v.number(),
        gradeLevel: v.string(),
        title: v.string(),
        storyText: v.string(),
        clozeText: v.string(),
        words: v.array(v.string()),
        clozeWords: v.array(v.string()),
      }),
    ),
    definitions: v.array(
      v.object({
        word: v.string(),
        definition: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.lib.auth.requireUserQuery)

    if (args.entries.length === 0) {
      throw new Error('Add at least one vocabulary word')
    }
    if (args.tiers.length === 0) {
      throw new Error('Add at least one grade level')
    }
    if (args.assignments.length === 0) {
      throw new Error('Add at least one story assignment')
    }
    if (args.clozeAssignments.length !== args.assignments.length) {
      throw new Error('Cloze assignments must match story assignments')
    }

    const gradeLevels = args.tiers.map((tier) => tier.gradeLevel)
    const prompt = buildWordStoriesBatchPrompt({
      gradeLevels,
      assignments: args.assignments,
      clozeAssignments: args.clozeAssignments,
      allowRepeatWithinStory: args.allowRepeatWithinStory,
      entries: args.entries,
    })
    const response = await generateGeminiWordStoriesJson(prompt)

    if (response.grades.length !== gradeLevels.length) {
      throw new Error(
        `Expected ${gradeLevels.length} grade groups, got ${response.grades.length}`,
      )
    }

    return mapGradeResults(
      gradeLevels,
      args.assignments,
      args.clozeAssignments,
      response,
    )
  },
})

export const regenerateStory = action({
  args: {
    entries: v.array(vocabEntryValidator),
    gradeLevel: v.string(),
    storyIndex: v.number(),
    words: v.array(v.string()),
    clozeWords: v.array(v.string()),
    allowRepeatWithinStory: v.boolean(),
    currentStoryText: v.optional(v.string()),
    currentClozeText: v.optional(v.string()),
  },
  returns: v.object({
    storyIndex: v.number(),
    gradeLevel: v.string(),
    title: v.string(),
    storyText: v.string(),
    clozeText: v.string(),
    words: v.array(v.string()),
    clozeWords: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.lib.auth.requireUserQuery)

    if (args.words.length === 0) {
      throw new Error('Story must include at least one vocabulary word')
    }
    if (args.clozeWords.length === 0) {
      throw new Error('Cloze story must include at least one vocabulary word')
    }

    const prompt = buildWordStoryRegeneratePrompt({
      gradeLevel: args.gradeLevel,
      storyIndex: args.storyIndex,
      words: args.words,
      clozeWords: args.clozeWords,
      allowRepeatWithinStory: args.allowRepeatWithinStory,
      entries: args.entries,
      currentStoryText: args.currentStoryText,
      currentClozeText: args.currentClozeText,
    })
    const response = await generateGeminiWordStoriesJson(prompt)

    const gradeGroup = response.grades.find(
      (group) => group.gradeLevel === args.gradeLevel,
    )
    if (!gradeGroup) {
      throw new Error(`Gemini response missing grade level ${args.gradeLevel}`)
    }

    validateGradeStories(
      args.gradeLevel,
      [{ storyIndex: args.storyIndex, words: args.words }],
      [{ storyIndex: args.storyIndex, words: args.clozeWords }],
      gradeGroup,
    )

    const story = gradeGroup.stories.find(
      (item) => item.storyIndex === args.storyIndex,
    )
    if (!story) {
      throw new Error('Gemini returned no story')
    }

    return {
      storyIndex: story.storyIndex,
      gradeLevel: args.gradeLevel,
      title: story.title.trim(),
      storyText: story.storyText.trim(),
      clozeText: story.clozeText.trim(),
      words: normalizeWords(story.words),
      clozeWords: normalizeWords(story.clozeWords),
    }
  },
})
