import { v } from 'convex/values'

import { action } from './_generated/server'
import { internal } from './_generated/api'
import {
  buildCrosswordDefinitionsPrompt,
  generateGeminiCrosswordDefinitionsJson,
} from './lib/geminiText'

const vocabEntryValidator = v.object({
  word: v.string(),
  definition: v.optional(v.string()),
  definition2: v.optional(v.string()),
})

const tierValidator = v.object({
  gradeLevel: v.string(),
})

function normalizeDefinitions(definitions: string[]): string[] {
  return definitions
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2)
}

export const generateDefinitions = action({
  args: {
    entries: v.array(vocabEntryValidator),
    tiers: v.array(tierValidator),
    mode: v.union(v.literal('fill-missing'), v.literal('all')),
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
    const defaultGrade = gradeLevels[0]!

    const entriesNeedingAi = args.entries.filter((entry) => {
      const hasTeacherDefinition =
        Boolean(entry.definition?.trim()) || Boolean(entry.definition2?.trim())
      return args.mode === 'all' || !hasTeacherDefinition
    })

    const aiByGrade = new Map<string, Map<string, { definitions: string[] }>>()

    if (entriesNeedingAi.length > 0) {
      const prompt = buildCrosswordDefinitionsPrompt({
        gradeLevels,
        entries: entriesNeedingAi.map((entry) => ({
          word: entry.word,
          definition: entry.definition,
        })),
      })
      const response = await generateGeminiCrosswordDefinitionsJson(prompt)

      for (const expectedGrade of gradeLevels) {
        const gradeGroup = response.grades.find(
          (group) => group.gradeLevel === expectedGrade,
        )
        if (!gradeGroup) {
          throw new Error(
            `Gemini response missing grade level ${expectedGrade}`,
          )
        }
        if (gradeGroup.words.length !== entriesNeedingAi.length) {
          throw new Error(
            `Expected ${entriesNeedingAi.length} crossword words for grade ${expectedGrade}, got ${gradeGroup.words.length}`,
          )
        }

        const byWord = new Map<string, { definitions: string[] }>()
        for (const [index, item] of gradeGroup.words.entries()) {
          const expectedWord = entriesNeedingAi[index]?.word ?? item.word
          byWord.set(expectedWord.toLowerCase(), {
            definitions: normalizeDefinitions(item.definitions),
          })
        }
        aiByGrade.set(expectedGrade, byWord)
      }
    }

    const results: Array<{
      word: string
      gradeLevel: string
      definitions: string[]
      source: 'ai' | 'manual'
    }> = []

    for (const gradeLevel of gradeLevels) {
      const gradeAi = aiByGrade.get(gradeLevel) ?? new Map()

      for (const entry of args.entries) {
        const teacherDefinitions = normalizeDefinitions([
          entry.definition ?? '',
          entry.definition2 ?? '',
        ])
        const hasTeacherDefinitions = teacherDefinitions.length > 0
        const shouldUseTeacher =
          hasTeacherDefinitions && args.mode === 'fill-missing'

        if (shouldUseTeacher) {
          results.push({
            word: entry.word,
            gradeLevel,
            definitions: teacherDefinitions,
            source: 'manual',
          })
          continue
        }

        const aiDefinitions = gradeAi.get(entry.word.toLowerCase())?.definitions
        if (aiDefinitions && aiDefinitions.length > 0) {
          results.push({
            word: entry.word,
            gradeLevel,
            definitions: aiDefinitions,
            source: 'ai',
          })
          continue
        }

        if (hasTeacherDefinitions) {
          results.push({
            word: entry.word,
            gradeLevel,
            definitions: teacherDefinitions,
            source: 'manual',
          })
          continue
        }

        if (gradeLevel === defaultGrade) {
          throw new Error(`No definitions available for "${entry.word}"`)
        }
      }
    }

    return results
  },
})
