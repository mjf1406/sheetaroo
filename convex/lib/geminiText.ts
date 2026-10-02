import { throwProviderError } from './providerError'

/** Cheapest GA model — used for fill-in-the-blank, word forms, and other high-volume tasks. */
export const GEMINI_MODEL = 'gemini-3.1-flash-lite'

/** Reserved for future higher-quality tasks (e.g. crossword). Not currently used. */
export const GEMINI_MODEL_PREMIUM = 'gemini-3.5-flash'

function geminiApiUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
}

export type GeminiSentence = {
  word: string
  sentence: string
}

type GeminiResponse = {
  sentences: GeminiSentence[]
}

export type GeminiGradeBatch = {
  gradeLevel: string
  sentences: GeminiSentence[]
}

type GeminiMultiGradeResponse = {
  grades: GeminiGradeBatch[]
}

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured')
  }
  return apiKey
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readUnknownArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null
}

function validateSentence(item: unknown): item is GeminiSentence {
  if (
    typeof item !== 'object' ||
    item === null ||
    typeof (item as GeminiSentence).word !== 'string' ||
    typeof (item as GeminiSentence).sentence !== 'string'
  ) {
    return false
  }
  if (!(item as GeminiSentence).sentence.includes('_____')) {
    throw new Error(
      `Sentence for "${(item as GeminiSentence).word}" must include a _____ blank`,
    )
  }
  return true
}

function parseGeminiJson(text: string): GeminiResponse {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Gemini returned invalid JSON')
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('sentences' in parsed) ||
    !Array.isArray((parsed as GeminiResponse).sentences)
  ) {
    throw new Error('Gemini response missing sentences array')
  }

  const sentences = (parsed as GeminiResponse).sentences
  for (const item of sentences) {
    if (!validateSentence(item)) {
      throw new Error('Gemini response has invalid sentence shape')
    }
  }

  return parsed as GeminiResponse
}

function parseMultiGradeGeminiJson(text: string): GeminiMultiGradeResponse {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Gemini returned invalid JSON')
  }

  const grades = isRecord(parsed) ? readUnknownArray(parsed.grades) : null
  if (!grades) {
    throw new Error('Gemini response missing grades array')
  }

  for (const grade of grades) {
    if (
      !isRecord(grade) ||
      typeof grade.gradeLevel !== 'string' ||
      !Array.isArray(grade.sentences)
    ) {
      throw new Error('Gemini response has invalid grade shape')
    }
    for (const item of grade.sentences) {
      if (!validateSentence(item)) {
        throw new Error('Gemini response has invalid sentence shape')
      }
    }
  }

  return parsed as GeminiMultiGradeResponse
}

const GEMINI_BUSY_FALLBACK =
  'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.'

function geminiProviderMessage(body: string): string | null {
  try {
    const parsed: unknown = JSON.parse(body)
    if (typeof parsed !== 'object' || parsed === null || !('error' in parsed)) {
      return null
    }
    const error: unknown = (parsed as { error?: unknown }).error
    if (typeof error !== 'object' || error === null || !('message' in error)) {
      return null
    }
    if (typeof error.message !== 'string') return null
    const message = error.message.trim()
    return message.length > 0 ? message : null
  } catch {
    return null
  }
}

function geminiErrorMessage(status: number, body: string): string {
  const providerMessage = geminiProviderMessage(body)
  if (status === 503) {
    return `Gemini is busy right now, not this site. ${providerMessage ?? GEMINI_BUSY_FALLBACK}`
  }
  if (status === 429) {
    const detail =
      providerMessage ??
      'Wait a minute and try again, or check usage at aistudio.google.com.'
    return `Gemini rate limit reached (Google AI quota, not this site). ${detail}`
  }
  if (providerMessage) {
    return `Gemini error (${status}): ${providerMessage}`
  }
  return `Gemini API error (${status}).`
}

function rethrowGeminiFailure(error: Error): never {
  const status = (error as Error & { status?: number }).status
  if (status !== undefined) {
    throwProviderError('gemini', error.message)
  }
  throw error
}

const RETRYABLE_GEMINI_STATUSES = new Set([429, 500, 503])
const GEMINI_MAX_ATTEMPTS = 3

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchGeminiJsonOnce(
  prompt: string,
  model: string,
): Promise<string> {
  const apiKey = getApiKey()
  const response = await fetch(`${geminiApiUrl(model)}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.8,
      },
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    const error = new Error(
      geminiErrorMessage(response.status, body),
    ) as Error & {
      status?: number
    }
    error.status = response.status
    throw error
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error('Gemini returned an empty response')
  }

  return text
}

async function fetchGeminiJson(
  prompt: string,
  model = GEMINI_MODEL,
): Promise<string> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt < GEMINI_MAX_ATTEMPTS; attempt++) {
    try {
      return await fetchGeminiJsonOnce(prompt, model)
    } catch (error) {
      if (!(error instanceof Error)) throw error
      lastError = error

      const status = (error as Error & { status?: number }).status
      const isLastAttempt = attempt === GEMINI_MAX_ATTEMPTS - 1
      if (
        status === undefined ||
        !RETRYABLE_GEMINI_STATUSES.has(status) ||
        isLastAttempt
      ) {
        rethrowGeminiFailure(error)
      }

      await sleep(1000 * 2 ** attempt)
    }
  }

  if (lastError) {
    rethrowGeminiFailure(lastError)
  }
  throw new Error('Gemini request failed')
}

export async function generateGeminiJson(
  prompt: string,
): Promise<GeminiResponse> {
  const text = await fetchGeminiJson(prompt)
  return parseGeminiJson(text)
}

export async function generateGeminiMultiGradeJson(
  prompt: string,
): Promise<GeminiMultiGradeResponse> {
  const text = await fetchGeminiJson(prompt)
  return parseMultiGradeGeminiJson(text)
}

export function formatGradeForPrompt(gradeLevel: string): string {
  return gradeLevel === 'K' ? 'Kindergarten' : `Grade ${gradeLevel}`
}

function formatWordList(
  entries: Array<{ word: string; definition?: string }>,
): string {
  return entries
    .map((entry, index) => {
      const definition = entry.definition ? ` (${entry.definition})` : ''
      return `${index + 1}. ${entry.word}${definition}`
    })
    .join('\n')
}

function sentenceRulesForGrade(
  gradeLabel: string,
  entries: Array<{ word: string; definition?: string }>,
): string {
  return `Write exactly ${entries.length} sentences — one for each vocabulary word. Each sentence must:
- Use the matching vocabulary word (${entries.map((entry, index) => `sentence ${index + 1} uses "${entry.word}"`).join(', ')})
- Replace that vocabulary word with exactly five underscores: _____
- Be age-appropriate for ${gradeLabel}
- Be a complete, natural English sentence
- Contain only one blank`
}

export function buildMultiGradeBatchPrompt(input: {
  gradeLevels: string[]
  entries: Array<{ word: string; definition?: string }>
}): string {
  const wordList = formatWordList(input.entries)
  const gradeSections = input.gradeLevels
    .map((gradeLevel) => {
      const gradeLabel = formatGradeForPrompt(gradeLevel)
      return `### ${gradeLabel} (gradeLevel: "${gradeLevel}")
${sentenceRulesForGrade(gradeLabel, input.entries)}`
    })
    .join('\n\n')

  return `You are a teacher creating fill-in-the-blank vocabulary sentences for multiple grade levels.

Vocabulary words (same list for every grade; use each in order, one sentence per word):
${wordList}

Generate sentences for each grade level below. Sentences should differ by grade-appropriate vocabulary and complexity.

${gradeSections}

Return JSON only in this shape:
{
  "grades": [
    {
      "gradeLevel": "5",
      "sentences": [{ "word": "compare", "sentence": "We _____ the two texts." }]
    }
  ]
}`
}

export function buildRegeneratePrompt(input: {
  gradeLevel: string
  word: string
  definition?: string
  currentSentence?: string
}): string {
  const gradeLabel = formatGradeForPrompt(input.gradeLevel)
  const definitionLine = input.definition
    ? `\nDefinition: ${input.definition}`
    : ''
  const avoidLine = input.currentSentence
    ? `\nWrite a different sentence than this one: "${input.currentSentence}"`
    : ''

  return `You are a teacher creating one fill-in-the-blank vocabulary sentence.

Grade level: ${gradeLabel}
Vocabulary word: ${input.word}${definitionLine}${avoidLine}

Write one sentence that:
- Uses the vocabulary word "${input.word}" but replaces it with exactly five underscores: _____
- Is age-appropriate for ${gradeLabel}
- Is a complete, natural English sentence
- Contains only one blank

Return JSON only in this shape:
{ "sentences": [{ "word": "${input.word}", "sentence": "..." }] }`
}

export type GeminiWordFormItem = {
  label: string
  form: string
}

export type GeminiWordFormGroup = {
  baseWord: string
  forms: GeminiWordFormItem[]
}

type GeminiWordFormsResponse = {
  words: GeminiWordFormGroup[]
}

function validateWordFormItem(item: unknown): item is GeminiWordFormItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof (item as GeminiWordFormItem).label === 'string' &&
    typeof (item as GeminiWordFormItem).form === 'string' &&
    (item as GeminiWordFormItem).label.trim().length > 0 &&
    (item as GeminiWordFormItem).form.trim().length > 0
  )
}

function parseWordFormsGeminiJson(text: string): GeminiWordFormsResponse {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Gemini returned invalid JSON')
  }

  const words = isRecord(parsed) ? readUnknownArray(parsed.words) : null
  if (!words) {
    throw new Error('Gemini response missing words array')
  }

  for (const group of words) {
    if (
      !isRecord(group) ||
      typeof group.baseWord !== 'string' ||
      !Array.isArray(group.forms) ||
      group.forms.length === 0
    ) {
      throw new Error('Gemini response has invalid word form group shape')
    }
    for (const item of group.forms) {
      if (!validateWordFormItem(item)) {
        throw new Error('Gemini response has invalid word form item shape')
      }
    }
  }

  return parsed as GeminiWordFormsResponse
}

export async function generateGeminiWordFormsJson(
  prompt: string,
): Promise<GeminiWordFormsResponse> {
  const text = await fetchGeminiJson(prompt)
  return parseWordFormsGeminiJson(text)
}

export function buildWordFormsBatchPrompt(input: {
  entries: Array<{ word: string; definition?: string }>
}): string {
  const wordList = formatWordList(input.entries)

  return `You are a teacher creating vocabulary word-form activities for English learners.

For each vocabulary word below, list common related word forms (inflections, derivatives, and parts of speech) that students should know. Include forms such as:
- verb: base, -ing, past tense, past participle (when applicable)
- noun forms (e.g. comparison, comparer)
- adjective/adverb forms when they exist

Use clear short labels (e.g. "verb (-ing)", "past tense", "noun", "adjective"). Provide 3–6 forms per word when possible. Only include real English forms of the same word family.

Vocabulary words:
${wordList}

Return JSON only in this shape:
{
  "words": [
    {
      "baseWord": "compare",
      "forms": [
        { "label": "verb (-ing)", "form": "comparing" },
        { "label": "past tense", "form": "compared" },
        { "label": "noun (person)", "form": "comparer" },
        { "label": "noun", "form": "comparison" },
        { "label": "adjective", "form": "comparable" }
      ]
    }
  ]
}`
}

export function buildWordFormsRegeneratePrompt(input: {
  word: string
  definition?: string
}): string {
  const definitionLine = input.definition
    ? `\nDefinition: ${input.definition}`
    : ''

  return `You are a teacher creating vocabulary word-form activities for English learners.

Vocabulary word: ${input.word}${definitionLine}

List common related word forms (inflections, derivatives, and parts of speech) for this word. Include forms such as verb tenses, nouns, adjectives, and adverbs when they exist. Use clear short labels. Provide 3–6 forms when possible.

Return JSON only in this shape:
{
  "words": [
    {
      "baseWord": "${input.word}",
      "forms": [
        { "label": "verb (-ing)", "form": "..." },
        { "label": "past tense", "form": "..." }
      ]
    }
  ]
}`
}

export type GeminiWordFormSentence = {
  baseWord: string
  form: string
  label: string
  sentence: string
}

export type GeminiWordFormSentenceGradeBatch = {
  gradeLevel: string
  sentences: GeminiWordFormSentence[]
}

type GeminiWordFormSentencesResponse = {
  grades: GeminiWordFormSentenceGradeBatch[]
}

function validateWordFormSentence(
  item: unknown,
): item is GeminiWordFormSentence {
  if (
    typeof item !== 'object' ||
    item === null ||
    typeof (item as GeminiWordFormSentence).baseWord !== 'string' ||
    typeof (item as GeminiWordFormSentence).form !== 'string' ||
    typeof (item as GeminiWordFormSentence).label !== 'string' ||
    typeof (item as GeminiWordFormSentence).sentence !== 'string'
  ) {
    return false
  }
  if (!(item as GeminiWordFormSentence).sentence.includes('_____')) {
    throw new Error(
      `Sentence for "${(item as GeminiWordFormSentence).form}" must include a _____ blank`,
    )
  }
  return true
}

function parseWordFormSentencesGeminiJson(
  text: string,
): GeminiWordFormSentencesResponse {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Gemini returned invalid JSON')
  }

  const grades = isRecord(parsed) ? readUnknownArray(parsed.grades) : null
  if (!grades) {
    throw new Error('Gemini response missing grades array')
  }

  for (const grade of grades) {
    if (
      !isRecord(grade) ||
      typeof grade.gradeLevel !== 'string' ||
      !Array.isArray(grade.sentences)
    ) {
      throw new Error(
        'Gemini response has invalid word form sentence grade shape',
      )
    }
    for (const item of grade.sentences) {
      if (!validateWordFormSentence(item)) {
        throw new Error('Gemini response has invalid word form sentence shape')
      }
    }
  }

  return parsed as GeminiWordFormSentencesResponse
}

export async function generateGeminiWordFormSentencesJson(
  prompt: string,
): Promise<GeminiWordFormSentencesResponse> {
  const text = await fetchGeminiJson(prompt)
  return parseWordFormSentencesGeminiJson(text)
}

function formatWordFormsForPrompt(
  words: Array<{
    baseWord: string
    forms: Array<{ label: string; form: string }>
  }>,
): string {
  return words
    .map((word) => {
      const forms = word.forms
        .map((item) => `  - ${item.label}: ${item.form}`)
        .join('\n')
      return `${word.baseWord}:\n${forms}`
    })
    .join('\n\n')
}

function wordFormSentenceRulesForGrade(
  gradeLabel: string,
  words: Array<{
    baseWord: string
    forms: Array<{ label: string; form: string }>
  }>,
): string {
  const totalSentences = words.reduce((sum, word) => sum + word.forms.length, 0)
  const formList = words
    .flatMap((word) =>
      word.forms.map(
        (item) => `"${item.form}" (${word.baseWord}, ${item.label})`,
      ),
    )
    .join(', ')

  return `Write exactly ${totalSentences} sentences — one for each word form listed below. Each sentence must:
- Use the matching word form (${formList})
- Replace that word form with exactly five underscores: _____
- Include the form in parentheses after the blank, e.g. _____ (compared)
- Be age-appropriate for ${gradeLabel}
- Be a complete, natural English sentence
- Contain only one blank`
}

export function buildWordFormsSentencesBatchPrompt(input: {
  gradeLevels: string[]
  words: Array<{
    baseWord: string
    forms: Array<{ label: string; form: string }>
  }>
}): string {
  const wordFormsList = formatWordFormsForPrompt(input.words)
  const gradeSections = input.gradeLevels
    .map((gradeLevel) => {
      const gradeLabel = formatGradeForPrompt(gradeLevel)
      return `### ${gradeLabel} (gradeLevel: "${gradeLevel}")
${wordFormSentenceRulesForGrade(gradeLabel, input.words)}`
    })
    .join('\n\n')

  return `You are a teacher creating fill-in-the-blank sentences for vocabulary word forms.

Word forms (write one sentence per form for each grade level):
${wordFormsList}

Generate sentences for each grade level below. Sentences should differ by grade-appropriate vocabulary and complexity.

${gradeSections}

Return JSON only in this shape:
{
  "grades": [
    {
      "gradeLevel": "5",
      "sentences": [
        {
          "baseWord": "compare",
          "form": "compared",
          "label": "past tense",
          "sentence": "We _____ (compared) the two stories."
        }
      ]
    }
  ]
}`
}

export function buildWordFormsSentenceRegeneratePrompt(input: {
  gradeLevel: string
  baseWord: string
  form: string
  label: string
  definition?: string
  currentSentence?: string
}): string {
  const gradeLabel = formatGradeForPrompt(input.gradeLevel)
  const definitionLine = input.definition
    ? `\nDefinition: ${input.definition}`
    : ''
  const avoidLine = input.currentSentence
    ? `\nWrite a different sentence than this one: "${input.currentSentence}"`
    : ''

  return `You are a teacher creating one fill-in-the-blank sentence for a vocabulary word form.

Grade level: ${gradeLabel}
Base word: ${input.baseWord}${definitionLine}
Word form: ${input.form} (${input.label})${avoidLine}

Write one sentence that:
- Uses the word form "${input.form}" but replaces it with exactly five underscores: _____
- Includes the form in parentheses after the blank: _____ (${input.form})
- Is age-appropriate for ${gradeLabel}
- Is a complete, natural English sentence
- Contains only one blank

Return JSON only in this shape:
{
  "grades": [
    {
      "gradeLevel": "${input.gradeLevel}",
      "sentences": [
        {
          "baseWord": "${input.baseWord}",
          "form": "${input.form}",
          "label": "${input.label}",
          "sentence": "..."
        }
      ]
    }
  ]
}`
}

export function buildWordFormsSentencesForWordPrompt(input: {
  gradeLevels: string[]
  baseWord: string
  definition?: string
  forms: Array<{ label: string; form: string }>
}): string {
  return buildWordFormsSentencesBatchPrompt({
    gradeLevels: input.gradeLevels,
    words: [{ baseWord: input.baseWord, forms: input.forms }],
  })
}

export type GeminiCrosswordWord = {
  word: string
  definitions: string[]
}

export type GeminiCrosswordGradeBatch = {
  gradeLevel: string
  words: GeminiCrosswordWord[]
}

type GeminiCrosswordDefinitionsResponse = {
  grades: GeminiCrosswordGradeBatch[]
}

function validateCrosswordDefinitionItem(
  item: unknown,
  word: string,
): item is GeminiCrosswordWord {
  if (
    typeof item !== 'object' ||
    item === null ||
    typeof (item as GeminiCrosswordWord).word !== 'string' ||
    !Array.isArray((item as GeminiCrosswordWord).definitions)
  ) {
    return false
  }

  const definitions = (item as GeminiCrosswordWord).definitions
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)

  if (definitions.length === 0 || definitions.length > 2) {
    throw new Error(
      `Crossword definitions for "${word}" must include 1–2 items`,
    )
  }

  const normalizedWord = word.toLowerCase()
  for (const definition of definitions) {
    if (definition.toLowerCase().includes(normalizedWord)) {
      throw new Error(
        `Crossword definition for "${word}" must not contain the vocabulary word`,
      )
    }
  }

  return true
}

function parseCrosswordDefinitionsGeminiJson(
  text: string,
): GeminiCrosswordDefinitionsResponse {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Gemini returned invalid JSON')
  }

  const grades = isRecord(parsed) ? readUnknownArray(parsed.grades) : null
  if (!grades) {
    throw new Error('Gemini response missing grades array')
  }

  for (const grade of grades) {
    const words = isRecord(grade) ? readUnknownArray(grade.words) : null
    if (!isRecord(grade) || typeof grade.gradeLevel !== 'string' || !words) {
      throw new Error('Gemini response has invalid crossword grade shape')
    }
    for (const item of words) {
      const word =
        isRecord(item) && typeof item.word === 'string' ? item.word : 'word'
      if (!validateCrosswordDefinitionItem(item, word)) {
        throw new Error('Gemini response has invalid crossword word shape')
      }
    }
  }

  return parsed as GeminiCrosswordDefinitionsResponse
}

export async function generateGeminiCrosswordDefinitionsJson(
  prompt: string,
): Promise<GeminiCrosswordDefinitionsResponse> {
  const text = await fetchGeminiJson(prompt)
  return parseCrosswordDefinitionsGeminiJson(text)
}

function crosswordDefinitionRulesForGrade(
  gradeLabel: string,
  entries: Array<{ word: string; definition?: string }>,
): string {
  return `Write definitions for exactly ${entries.length} vocabulary words (${entries.map((entry, index) => `item ${index + 1}: "${entry.word}"`).join(', ')}).
For each word, provide 1–2 short, student-friendly definitions appropriate for ${gradeLabel}.
- Do not use the vocabulary word in any definition
- Keep each definition concise (one sentence or phrase)
- When two definitions are provided, they should offer different angles on meaning`
}

export function buildCrosswordDefinitionsPrompt(input: {
  gradeLevels: string[]
  entries: Array<{ word: string; definition?: string }>
}): string {
  const wordList = formatWordList(input.entries)
  const gradeSections = input.gradeLevels
    .map((gradeLevel) => {
      const gradeLabel = formatGradeForPrompt(gradeLevel)
      return `### ${gradeLabel} (gradeLevel: "${gradeLevel}")
${crosswordDefinitionRulesForGrade(gradeLabel, input.entries)}`
    })
    .join('\n\n')

  return `You are a teacher creating crossword puzzle clues (definitions) for English learners.

Vocabulary words (same list for every grade):
${wordList}

Generate crossword definitions for each grade level below. Definitions should differ by grade-appropriate vocabulary and complexity when multiple grades are requested.

${gradeSections}

Return JSON only in this shape:
{
  "grades": [
    {
      "gradeLevel": "5",
      "words": [
        {
          "word": "compare",
          "definitions": ["to examine how things are alike and different", "to look at two or more things side by side"]
        }
      ]
    }
  ]
}`
}

export type GeminiWordStoryItem = {
  storyIndex: number
  title: string
  storyText: string
  clozeText: string
  words: string[]
  clozeWords: string[]
}

export type GeminiWordStoryDefinition = {
  word: string
  definition: string
}

export type GeminiWordStoryGradeBatch = {
  gradeLevel: string
  stories: GeminiWordStoryItem[]
  definitions: GeminiWordStoryDefinition[]
}

type GeminiWordStoriesResponse = {
  grades: GeminiWordStoryGradeBatch[]
}

function validateWordStoryItem(item: unknown): item is GeminiWordStoryItem {
  if (
    typeof item !== 'object' ||
    item === null ||
    typeof (item as GeminiWordStoryItem).storyIndex !== 'number' ||
    typeof (item as GeminiWordStoryItem).title !== 'string' ||
    typeof (item as GeminiWordStoryItem).storyText !== 'string' ||
    typeof (item as GeminiWordStoryItem).clozeText !== 'string' ||
    !Array.isArray((item as GeminiWordStoryItem).words) ||
    !Array.isArray((item as GeminiWordStoryItem).clozeWords)
  ) {
    return false
  }

  const story = item as GeminiWordStoryItem
  if (
    story.title.trim().length === 0 ||
    story.storyText.trim().length === 0 ||
    story.clozeText.trim().length === 0
  ) {
    return false
  }

  return (
    story.words.every(
      (word) => typeof word === 'string' && word.trim().length > 0,
    ) &&
    story.clozeWords.every(
      (word) => typeof word === 'string' && word.trim().length > 0,
    )
  )
}

function validateWordStoryDefinition(
  item: unknown,
): item is GeminiWordStoryDefinition {
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof (item as GeminiWordStoryDefinition).word === 'string' &&
    typeof (item as GeminiWordStoryDefinition).definition === 'string' &&
    (item as GeminiWordStoryDefinition).word.trim().length > 0 &&
    (item as GeminiWordStoryDefinition).definition.trim().length > 0
  )
}

function parseWordStoriesGeminiJson(text: string): GeminiWordStoriesResponse {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Gemini returned invalid JSON')
  }

  const grades = isRecord(parsed) ? readUnknownArray(parsed.grades) : null
  if (!grades) {
    throw new Error('Gemini response missing grades array')
  }

  for (const grade of grades) {
    if (
      !isRecord(grade) ||
      typeof grade.gradeLevel !== 'string' ||
      !Array.isArray(grade.stories) ||
      !Array.isArray(grade.definitions)
    ) {
      throw new Error('Gemini response has invalid word story grade shape')
    }
    for (const story of grade.stories) {
      if (!validateWordStoryItem(story)) {
        throw new Error('Gemini response has invalid word story item shape')
      }
    }
    for (const definition of grade.definitions) {
      if (!validateWordStoryDefinition(definition)) {
        throw new Error(
          'Gemini response has invalid word story definition shape',
        )
      }
    }
  }

  return parsed as GeminiWordStoriesResponse
}

export async function generateGeminiWordStoriesJson(
  prompt: string,
): Promise<GeminiWordStoriesResponse> {
  const text = await fetchGeminiJson(prompt)
  return parseWordStoriesGeminiJson(text)
}

function formatStoryPairAssignments(
  assignments: Array<{ storyIndex: number; words: string[] }>,
  clozeAssignments: Array<{ storyIndex: number; words: string[] }>,
): string {
  return assignments
    .map((assignment) => {
      const clozeAssignment = clozeAssignments.find(
        (item) => item.storyIndex === assignment.storyIndex,
      )
      const clozeWords = clozeAssignment?.words ?? assignment.words
      return `Story ${assignment.storyIndex + 1} (storyIndex: ${assignment.storyIndex}):
  Part 1 context words: ${assignment.words.join(', ')}
  Part 2 cloze words: ${clozeWords.join(', ')}`
    })
    .join('\n')
}

function wordStoryRulesForGrade(
  gradeLabel: string,
  assignments: Array<{ storyIndex: number; words: string[] }>,
  clozeAssignments: Array<{ storyIndex: number; words: string[] }>,
  allowRepeatWithinStory: boolean,
  wordsNeedingDefinitions: Array<{ word: string }>,
): string {
  const repeatRule = allowRepeatWithinStory
    ? 'You may use each assigned word more than once within a story if it fits naturally.'
    : 'Use each assigned vocabulary word at least once and do not repeat words within the same story.'

  const definitionRule =
    wordsNeedingDefinitions.length > 0
      ? `\nAlso write student-friendly definitions for these words (do not include the vocabulary word in the definition): ${wordsNeedingDefinitions.map((entry) => `"${entry.word}"`).join(', ')}`
      : ''

  return `Write exactly ${assignments.length} story pairs for ${gradeLabel}.

Story assignments:
${formatStoryPairAssignments(assignments, clozeAssignments)}

For each story:
- Write a short, engaging Part 1 context story (3–8 sentences) titled appropriately for ${gradeLabel}
- Use only the Part 1 context words in the context story
- Mark each vocabulary word occurrence with double curly braces, e.g. {{compare}}
- ${repeatRule}
- Write a separate NEW Part 2 cloze story (different plot and sentences) using only the Part 2 cloze words
- Part 2 should use a different mix of vocabulary words than Part 1 when possible so students cannot match by story order
- Mark each vocabulary word in the cloze story with {{word}} as well
- The cloze story must be different from the context story${definitionRule}`
}

export function buildWordStoriesBatchPrompt(input: {
  gradeLevels: string[]
  assignments: Array<{ storyIndex: number; words: string[] }>
  clozeAssignments: Array<{ storyIndex: number; words: string[] }>
  allowRepeatWithinStory: boolean
  entries: Array<{ word: string; definition?: string }>
}): string {
  const wordsNeedingDefinitions = input.entries.filter(
    (entry) => !entry.definition?.trim(),
  )
  const wordList = formatWordList(input.entries)
  const gradeSections = input.gradeLevels
    .map((gradeLevel) => {
      const gradeLabel = formatGradeForPrompt(gradeLevel)
      return `### ${gradeLabel} (gradeLevel: "${gradeLevel}")
${wordStoryRulesForGrade(
  gradeLabel,
  input.assignments,
  input.clozeAssignments,
  input.allowRepeatWithinStory,
  wordsNeedingDefinitions,
)}`
    })
    .join('\n\n')

  return `You are a teacher creating vocabulary word story worksheets for English learners.

Vocabulary words:
${wordList}

Generate stories for each grade level below. Stories should differ by grade-appropriate vocabulary, sentence length, and complexity.

${gradeSections}

Return JSON only in this shape:
{
  "grades": [
    {
      "gradeLevel": "5",
      "stories": [
        {
          "storyIndex": 0,
          "title": "A Day at the Market",
          "storyText": "Maya went to the market to {{compare}} prices.",
          "clozeText": "At the store, she needed to {{observe}} two fruits.",
          "words": ["compare"],
          "clozeWords": ["observe"]
        }
      ],
      "definitions": [
        { "word": "compare", "definition": "to look at two or more things to see how they are alike or different" }
      ]
    }
  ]
}`
}

export function buildWordStoryRegeneratePrompt(input: {
  gradeLevel: string
  storyIndex: number
  title?: string
  words: string[]
  clozeWords: string[]
  allowRepeatWithinStory: boolean
  entries: Array<{ word: string; definition?: string }>
  currentStoryText?: string
  currentClozeText?: string
}): string {
  const gradeLabel = formatGradeForPrompt(input.gradeLevel)
  const definitionList = formatWordList(
    input.entries.filter(
      (entry) =>
        input.words.includes(entry.word) ||
        input.clozeWords.includes(entry.word),
    ),
  )
  const repeatRule = input.allowRepeatWithinStory
    ? 'You may use each assigned word more than once within a story if it fits naturally.'
    : 'Use each assigned vocabulary word at least once and do not repeat words within the same story.'
  const avoidLine =
    input.currentStoryText && input.currentClozeText
      ? `\nWrite different stories than these:\nContext story: "${input.currentStoryText}"\nCloze story: "${input.currentClozeText}"`
      : ''

  return `You are a teacher creating one vocabulary word story pair for English learners.

Grade level: ${gradeLabel}
Story index: ${input.storyIndex}
Part 1 context words: ${input.words.join(', ')}
Part 2 cloze words: ${input.clozeWords.join(', ')}
Vocabulary details:
${definitionList}${avoidLine}

Write one story pair:
- A short, engaging Part 1 context story with a title appropriate for ${gradeLabel}
- A separate NEW Part 2 cloze story (different plot) using only the Part 2 cloze words
- Mark each vocabulary word with {{word}} in the matching story only
- ${repeatRule}

Return JSON only in this shape:
{
  "grades": [
    {
      "gradeLevel": "${input.gradeLevel}",
      "stories": [
        {
          "storyIndex": ${input.storyIndex},
          "title": "...",
          "storyText": "...",
          "clozeText": "...",
          "words": [${input.words.map((word) => `"${word}"`).join(', ')}],
          "clozeWords": [${input.clozeWords.map((word) => `"${word}"`).join(', ')}]
        }
      ],
      "definitions": []
    }
  ]
}`
}
