import { v } from 'convex/values'

import { action } from './_generated/server'
import { internal } from './_generated/api'
import {
  buildWordFormsBatchPrompt,
  buildWordFormsRegeneratePrompt,
  buildWordFormsSentenceRegeneratePrompt,
  buildWordFormsSentencesBatchPrompt,
  buildWordFormsSentencesForWordPrompt,
  generateGeminiWordFormsJson,
  generateGeminiWordFormSentencesJson,
} from './lib/geminiText'
import type { GeminiWordFormGroup } from './lib/geminiText'

const vocabEntryValidator = v.object({
  word: v.string(),
  definition: v.optional(v.string()),
})

const tierValidator = v.object({
  gradeLevel: v.string(),
})

function normalizeForms(words: GeminiWordFormGroup[]) {
  return words.map((group) => ({
    baseWord: group.baseWord,
    forms: group.forms.map((item) => ({
      label: item.label.trim(),
      form: item.form.trim(),
    })),
  }))
}

function expectedSentenceCount(
  words: Array<{ forms: Array<{ label: string; form: string }> }>,
): number {
  return words.reduce((sum, word) => sum + word.forms.length, 0)
}

function mapSentencesFromResponse(
  gradeLevels: string[],
  words: Array<{
    baseWord: string
    forms: Array<{ label: string; form: string }>
  }>,
  response: Awaited<ReturnType<typeof generateGeminiWordFormSentencesJson>>,
) {
  const results: Array<{
    baseWord: string
    form: string
    label: string
    gradeLevel: string
    sentence: string
  }> = []

  const expectedPerGrade = expectedSentenceCount(words)

  for (const expectedGrade of gradeLevels) {
    const gradeGroup = response.grades.find(
      (group) => group.gradeLevel === expectedGrade,
    )
    if (!gradeGroup) {
      throw new Error(`Gemini response missing grade level ${expectedGrade}`)
    }
    if (gradeGroup.sentences.length !== expectedPerGrade) {
      throw new Error(
        `Expected ${expectedPerGrade} sentences for grade ${expectedGrade}, got ${gradeGroup.sentences.length}`,
      )
    }

    for (const item of gradeGroup.sentences) {
      results.push({
        baseWord: item.baseWord,
        form: item.form,
        label: item.label,
        gradeLevel: expectedGrade,
        sentence: item.sentence,
      })
    }
  }

  return results
}

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

    const formsPrompt = buildWordFormsBatchPrompt({ entries: args.entries })
    const formsResponse = await generateGeminiWordFormsJson(formsPrompt)

    if (formsResponse.words.length !== args.entries.length) {
      throw new Error(
        `Expected ${args.entries.length} word groups, got ${formsResponse.words.length}`,
      )
    }

    const words = normalizeForms(
      formsResponse.words.map((group, index) => ({
        ...group,
        baseWord: args.entries[index]?.word ?? group.baseWord,
      })),
    )

    const gradeLevels = args.tiers.map((tier) => tier.gradeLevel)
    const sentencesPrompt = buildWordFormsSentencesBatchPrompt({
      gradeLevels,
      words,
    })
    const sentencesResponse =
      await generateGeminiWordFormSentencesJson(sentencesPrompt)

    return {
      words,
      sentences: mapSentencesFromResponse(
        gradeLevels,
        words,
        sentencesResponse,
      ),
    }
  },
})

export const regenerateOne = action({
  args: {
    word: v.string(),
    definition: v.optional(v.string()),
    tiers: v.array(tierValidator),
  },
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.lib.auth.requireUserQuery)

    if (args.tiers.length === 0) {
      throw new Error('Add at least one grade level')
    }

    const formsPrompt = buildWordFormsRegeneratePrompt({
      word: args.word,
      definition: args.definition,
    })
    const formsResponse = await generateGeminiWordFormsJson(formsPrompt)

    const group = formsResponse.words[0]
    if (!group) {
      throw new Error('Gemini returned no word forms')
    }

    const word = {
      baseWord: args.word,
      forms: group.forms.map((item) => ({
        label: item.label.trim(),
        form: item.form.trim(),
      })),
    }

    const gradeLevels = args.tiers.map((tier) => tier.gradeLevel)
    const sentencesPrompt = buildWordFormsSentencesForWordPrompt({
      gradeLevels,
      baseWord: args.word,
      definition: args.definition,
      forms: word.forms,
    })
    const sentencesResponse =
      await generateGeminiWordFormSentencesJson(sentencesPrompt)

    return {
      ...word,
      sentences: mapSentencesFromResponse(
        gradeLevels,
        [word],
        sentencesResponse,
      ),
    }
  },
})

export const regenerateSentence = action({
  args: {
    baseWord: v.string(),
    form: v.string(),
    label: v.string(),
    definition: v.optional(v.string()),
    gradeLevel: v.string(),
    currentSentence: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.lib.auth.requireUserQuery)

    const prompt = buildWordFormsSentenceRegeneratePrompt({
      gradeLevel: args.gradeLevel,
      baseWord: args.baseWord,
      form: args.form,
      label: args.label,
      definition: args.definition,
      currentSentence: args.currentSentence,
    })
    const response = await generateGeminiWordFormSentencesJson(prompt)

    const gradeGroup = response.grades.find(
      (group) => group.gradeLevel === args.gradeLevel,
    )
    const sentence = gradeGroup?.sentences[0]
    if (!sentence) {
      throw new Error('Gemini returned no sentence')
    }

    return {
      baseWord: sentence.baseWord,
      form: sentence.form,
      label: sentence.label,
      gradeLevel: args.gradeLevel,
      sentence: sentence.sentence,
    }
  },
})
