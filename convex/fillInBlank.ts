import { v } from 'convex/values'

import { action } from './_generated/server'
import { internal } from './_generated/api'
import {
  buildMultiGradeBatchPrompt,
  buildRegeneratePrompt,
  generateGeminiJson,
  generateGeminiMultiGradeJson,
} from './lib/geminiText'

const vocabEntryValidator = v.object({
  word: v.string(),
  definition: v.optional(v.string()),
})

const tierValidator = v.object({
  gradeLevel: v.string(),
})

export const generateBatch = action({
  args: {
    entries: v.array(vocabEntryValidator),
    tiers: v.array(tierValidator),
  },
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.lib.auth.requireUserQuery)

    if (args.entries.length === 0) {
      throw new Error('Add at least one vocabulary word')
    }
    if (args.tiers.length === 0) {
      throw new Error('Add at least one grade level')
    }

    const gradeLevels = args.tiers.map((tier) => tier.gradeLevel)
    const prompt = buildMultiGradeBatchPrompt({
      gradeLevels,
      entries: args.entries,
    })
    const response = await generateGeminiMultiGradeJson(prompt)

    if (response.grades.length !== gradeLevels.length) {
      throw new Error(
        `Expected ${gradeLevels.length} grade groups, got ${response.grades.length}`,
      )
    }

    const results: Array<{ word: string; gradeLevel: string; sentence: string }> = []

    for (const expectedGrade of gradeLevels) {
      const gradeGroup = response.grades.find((group) => group.gradeLevel === expectedGrade)
      if (!gradeGroup) {
        throw new Error(`Gemini response missing grade level ${expectedGrade}`)
      }
      if (gradeGroup.sentences.length !== args.entries.length) {
        throw new Error(
          `Expected ${args.entries.length} sentences for grade ${expectedGrade}, got ${gradeGroup.sentences.length}`,
        )
      }

      for (let index = 0; index < gradeGroup.sentences.length; index++) {
        const item = gradeGroup.sentences[index]!
        results.push({
          word: args.entries[index]?.word ?? item.word,
          gradeLevel: expectedGrade,
          sentence: item.sentence,
        })
      }
    }

    return results
  },
})

export const regenerateOne = action({
  args: {
    word: v.string(),
    definition: v.optional(v.string()),
    gradeLevel: v.string(),
    currentSentence: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.lib.auth.requireUserQuery)

    const prompt = buildRegeneratePrompt({
      gradeLevel: args.gradeLevel,
      word: args.word,
      definition: args.definition,
      currentSentence: args.currentSentence,
    })
    const response = await generateGeminiJson(prompt)

    const sentence = response.sentences[0]
    if (!sentence) {
      throw new Error('Gemini returned no sentence')
    }

    return {
      word: sentence.word,
      sentence: sentence.sentence,
    }
  },
})
