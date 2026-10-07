import { describe, expect, it } from 'vite-plus/test'

import { createVocabRow } from '@/lib/vocabulary-types'
import {
  applyVocabularyPaste,
  parseVocabularyPaste,
} from '@/lib/vocabulary-paste'

describe('parseVocabularyPaste', () => {
  it('reads a spreadsheet row as a word and definitions', () => {
    expect(
      parseVocabularyPaste('compare\tto examine\tto look side by side'),
    ).toEqual([
      {
        word: 'compare',
        definitions: ['to examine', 'to look side by side'],
      },
    ])
  })

  it('keeps commas and quotes inside a tab-separated definition', () => {
    expect(
      parseVocabularyPaste(
        '"Main Idea"\t"The big picture, or central point"\t"say ""hello"""',
      ),
    ).toEqual([
      {
        word: 'Main Idea',
        definitions: ['The big picture, or central point', 'say "hello"'],
      },
    ])
  })

  it('reads comma-separated rows', () => {
    expect(
      parseVocabularyPaste(
        'compare,"to examine, likenesses"\nculture,shared beliefs',
      ),
    ).toEqual([
      { word: 'compare', definitions: ['to examine, likenesses'] },
      { word: 'culture', definitions: ['shared beliefs'] },
    ])
  })

  it('keeps colon lines with commas as one definition', () => {
    expect(
      parseVocabularyPaste('compare: to examine, likenesses\nidentity'),
    ).toEqual([
      { word: 'compare', definitions: ['to examine, likenesses'] },
      { word: 'identity', definitions: [] },
    ])
  })

  it('leaves a single sentence in the field', () => {
    expect(parseVocabularyPaste('to examine, likenesses')).toBeNull()
  })

  it('leaves one quoted cell with a line break in the field', () => {
    expect(parseVocabularyPaste('"line one,\nline two"')).toBeNull()
  })
})

describe('applyVocabularyPaste', () => {
  it('replaces rows from the focused row and keeps a blank row', () => {
    const rows = [createVocabRow('keep', ['old']), createVocabRow()]
    const next = applyVocabularyPaste(rows, 0, [
      { word: 'compare', definitions: ['to examine'] },
      { word: 'culture', definitions: ['shared beliefs', 'a way of life'] },
    ])

    expect(next.map((row) => row.word)).toEqual(['compare', 'culture', ''])
    expect(next[0]?.id).toBe(rows[0]?.id)
    expect(next[1]?.definitions).toEqual(['shared beliefs', 'a way of life'])
    expect(next.at(-1)?.definitions).toEqual([''])
  })

  it('fills from the blank row and adds another blank row', () => {
    const rows = [createVocabRow('keep', ['old']), createVocabRow()]
    const next = applyVocabularyPaste(rows, 1, [
      { word: 'compare', definitions: [] },
      { word: 'culture', definitions: ['shared beliefs'] },
    ])

    expect(next.map((row) => row.word)).toEqual([
      'keep',
      'compare',
      'culture',
      '',
    ])
    expect(next[2]?.definitions).toEqual(['shared beliefs'])
    expect(next[1]?.definitions).toEqual([''])
  })
})
