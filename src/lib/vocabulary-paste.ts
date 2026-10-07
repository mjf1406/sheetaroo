import type { VocabEntry, VocabRow } from '@/lib/vocabulary-types'
import {
  createVocabRow,
  ensureTrailingBlankRow,
  parseVocabularyText,
} from '@/lib/vocabulary-types'

function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char ?? ''
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }
    if (char === delimiter) {
      row.push(field)
      field = ''
      continue
    }
    if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      continue
    }
    field += char ?? ''
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

function entriesFromCells(rows: string[][]): VocabEntry[] | null {
  const entries = rows.flatMap((cells) => {
    const [rawWord, ...rest] = cells
    const word = rawWord?.trim() ?? ''
    if (!word) return []
    return [
      {
        word,
        definitions: rest.map((cell) => cell.trim()).filter(Boolean),
      },
    ]
  })
  return entries.length > 0 ? entries : null
}

function isColonLineList(text: string): boolean {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return false
  return lines.every((line) => {
    const colon = line.indexOf(':')
    const comma = line.indexOf(',')
    if (comma === -1) return true
    return colon !== -1 && colon < comma
  })
}

export function parseVocabularyPaste(text: string): VocabEntry[] | null {
  const normalized = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')

  if (normalized.includes('\t')) {
    return entriesFromCells(parseDelimited(normalized, '\t'))
  }
  if (!normalized.includes('\n')) return null

  if (isColonLineList(normalized)) {
    const lines = parseVocabularyText(normalized)
    return lines.length > 0 ? lines : null
  }

  const cells = parseDelimited(normalized, ',').filter((row) =>
    row.some((cell) => cell.trim()),
  )
  if (cells.length === 1 && (cells[0]?.length ?? 0) <= 1) return null
  if (cells.some((row) => row.filter((cell) => cell.trim()).length >= 2)) {
    return entriesFromCells(cells)
  }

  const lines = parseVocabularyText(normalized)
  return lines.length > 0 ? lines : null
}

export function applyVocabularyPaste(
  rows: VocabRow[],
  startIndex: number,
  pasted: VocabEntry[],
): VocabRow[] {
  const next = rows.map((row) => ({
    ...row,
    definitions: [...row.definitions],
  }))
  const index = Math.min(Math.max(startIndex, 0), next.length)

  for (const [offset, entry] of pasted.entries()) {
    const target = index + offset
    const definitions =
      entry.definitions.length > 0 ? [...entry.definitions] : ['']
    const existing = next[target]
    const row: VocabRow = {
      id: existing?.id ?? createVocabRow().id,
      word: entry.word,
      definitions,
    }
    if (existing) next[target] = row
    else next.push(row)
  }

  return ensureTrailingBlankRow(next)
}
