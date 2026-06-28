/** Cheapest GA model — used for fill-in-the-blank and other high-volume tasks. */
export const GEMINI_MODEL = 'gemini-3.1-flash-lite'

/** Reserved for future higher-quality tasks (crossword, word forms, etc.). Not used yet. */
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
    throw new Error(`Sentence for "${(item as GeminiSentence).word}" must include a _____ blank`)
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

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('grades' in parsed) ||
    !Array.isArray((parsed as GeminiMultiGradeResponse).grades)
  ) {
    throw new Error('Gemini response missing grades array')
  }

  for (const grade of (parsed as GeminiMultiGradeResponse).grades) {
    if (
      typeof grade !== 'object' ||
      grade === null ||
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

function geminiErrorMessage(status: number, body: string): string {
  if (status === 429) {
    return 'Gemini API rate limit reached (this is your Google AI quota, not Convex). Wait a minute and try again, or check usage at aistudio.google.com.'
  }
  return `Gemini API error (${status}): ${body.slice(0, 200)}`
}

async function fetchGeminiJson(prompt: string, model = GEMINI_MODEL): Promise<string> {
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
    throw new Error(geminiErrorMessage(response.status, body))
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

export async function generateGeminiJson(prompt: string): Promise<GeminiResponse> {
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

function formatWordList(entries: Array<{ word: string; definition?: string }>): string {
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
  const definitionLine = input.definition ? `\nDefinition: ${input.definition}` : ''
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
