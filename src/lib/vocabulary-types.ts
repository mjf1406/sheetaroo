export const WORKSHEET_IDS = [
  'dictation-audio',
  'draw-one-word',
  'crossword-puzzle',
  'word-search',
  'fill-in-the-blank',
  'word-forms',
  'word-stories',
] as const

export type WorksheetId = (typeof WORKSHEET_IDS)[number]
export type WorksheetView = 'all' | WorksheetId

export type VocabEntry = { word: string; definition?: string }

export const WORKSHEET_LABELS: Record<WorksheetId, string> = {
  'dictation-audio': 'Dictation',
  'draw-one-word': 'Draw One Word',
  'fill-in-the-blank': 'Fill-in-the-Blank',
  'word-search': 'Word Search',
  'crossword-puzzle': 'Crossword Puzzle',
  'word-forms': 'Word Forms',
  'word-stories': 'Word Stories',
}

export const WORKSHEET_IDS_BY_LABEL: WorksheetId[] = [...WORKSHEET_IDS].sort(
  (left, right) => WORKSHEET_LABELS[left].localeCompare(WORKSHEET_LABELS[right]),
)

export const WORKSHEET_DESCRIPTIONS: Record<WorksheetId, string> = {
  'dictation-audio': 'Generate dictation audio and a matching worksheet',
  'draw-one-word': 'Students draw a picture for each vocabulary word',
  'crossword-puzzle': 'AI-generated crossword clues from your word list',
  'word-search': 'Customizable word search puzzle',
  'fill-in-the-blank': 'Sentences with blanks for vocabulary practice',
  'word-forms': 'Practice different forms of each word',
  'word-stories': 'Stories using vocabulary words with definition matching and cloze practice',
}

export function getWorksheetPath(id: WorksheetId): string {
  return `/vocabulary/${id}`
}

export function parseWorksheetId(slug: string): WorksheetId | null {
  if ((WORKSHEET_IDS as readonly string[]).includes(slug)) {
    return slug as WorksheetId
  }
  return null
}

export const VOCABULARY_NAV_ITEMS: Array<{ label: string; view: WorksheetView }> = [
  { label: 'All', view: 'all' },
  ...WORKSHEET_IDS_BY_LABEL.map((id) => ({ label: WORKSHEET_LABELS[id], view: id })),
]

const VALID_VIEWS = new Set<string>(['all', ...WORKSHEET_IDS])

export function parseWorksheetView(value: unknown): WorksheetView {
  if (typeof value === 'string' && VALID_VIEWS.has(value)) {
    return value as WorksheetView
  }
  return 'all'
}

export function parseVocabularyText(text: string): VocabEntry[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const colonIndex = line.indexOf(':')
      if (colonIndex === -1) {
        return { word: line }
      }
      const word = line.slice(0, colonIndex).trim()
      const definition = line.slice(colonIndex + 1).trim()
      return definition ? { word, definition } : { word }
    })
}

export function getWords(entries: VocabEntry[]): string[] {
  return entries.map((entry) => entry.word)
}

export function worksheetSelectionFromView(view: WorksheetView): Record<WorksheetId, boolean> {
  if (view === 'all') {
    return Object.fromEntries(WORKSHEET_IDS.map((id) => [id, true])) as Record<
      WorksheetId,
      boolean
    >
  }
  return Object.fromEntries(
    WORKSHEET_IDS.map((id) => [id, id === view]),
  ) as Record<WorksheetId, boolean>
}
