import type { ClipboardEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { SAMPLE_VOCABULARY } from '@/lib/vocabulary-sample'
import {
  appendVocabRows,
  createVocabRow,
  ensureTrailingBlankRow,
  isBlankVocabRow,
} from '@/lib/vocabulary-types'
import type { VocabEntry, VocabRow } from '@/lib/vocabulary-types'
import {
  applyVocabularyPaste,
  parseVocabularyPaste,
} from '@/lib/vocabulary-paste'

type VocabularyWordInputProps = {
  rows: VocabRow[]
  onRowsChange: (rows: VocabRow[]) => void
  title: string
  onTitleChange: (title: string) => void
  entries: VocabEntry[]
}

export function VocabularyWordInput({
  rows,
  onRowsChange,
  title,
  onTitleChange,
  entries,
}: VocabularyWordInputProps) {
  const withDefinitions = entries.filter(
    (entry) => entry.definitions.length > 0,
  ).length

  function updateRow(rowIndex: number, next: VocabRow) {
    onRowsChange(
      ensureTrailingBlankRow(
        rows.map((row, index) => (index === rowIndex ? next : row)),
      ),
    )
  }

  function addSampleWords(withSampleDefinitions: boolean) {
    onRowsChange(
      appendVocabRows(
        rows,
        SAMPLE_VOCABULARY.map((entry) =>
          createVocabRow(
            entry.word,
            withSampleDefinitions ? [entry.definition] : [''],
          ),
        ),
      ),
    )
  }

  function handlePaste(
    event: ClipboardEvent<HTMLInputElement>,
    rowIndex: number,
  ) {
    const parsed = parseVocabularyPaste(
      event.clipboardData.getData('text/plain'),
    )
    if (!parsed) return
    event.preventDefault()
    onRowsChange(applyVocabularyPaste(rows, rowIndex, parsed))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Word list</CardTitle>
        <CardDescription>
          Type each word in its own row. Definitions are optional.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="worksheet-title">Worksheet title</Label>
          <Input
            id="worksheet-title"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Vocabulary Worksheet"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addSampleWords(false)}
          >
            Add sample words
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addSampleWords(true)}
          >
            Add sample words & definitions
          </Button>
        </div>
        <div className="space-y-3">
          {rows.map((row, rowIndex) => {
            const wordLabel = row.word.trim() || `word ${rowIndex + 1}`
            return (
              <div key={row.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Input
                    aria-label={`Word ${rowIndex + 1}`}
                    value={row.word}
                    onChange={(event) =>
                      updateRow(rowIndex, { ...row, word: event.target.value })
                    }
                    onPaste={(event) => handlePaste(event, rowIndex)}
                    placeholder="Word"
                    className="min-w-0 flex-1"
                  />
                  {isBlankVocabRow(row) ? null : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${wordLabel}`}
                      onClick={() =>
                        onRowsChange(
                          ensureTrailingBlankRow(
                            rows.filter((_, index) => index !== rowIndex),
                          ),
                        )
                      }
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
                {row.definitions.map((definition, definitionIndex) => (
                  <div
                    key={`${row.id}-definition-${definitionIndex}`}
                    className="flex items-center gap-2"
                  >
                    <Input
                      aria-label={`Definition ${definitionIndex + 1} for ${wordLabel}`}
                      value={definition}
                      onChange={(event) =>
                        updateRow(rowIndex, {
                          ...row,
                          definitions: row.definitions.map((item, index) =>
                            index === definitionIndex
                              ? event.target.value
                              : item,
                          ),
                        })
                      }
                      onPaste={(event) => handlePaste(event, rowIndex)}
                      placeholder="Definition (optional)"
                      className="min-w-0 flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove definition ${definitionIndex + 1} for ${wordLabel}`}
                      onClick={() => {
                        const nextDefinitions =
                          row.definitions.length <= 1
                            ? ['']
                            : row.definitions.filter(
                                (_, index) => index !== definitionIndex,
                              )
                        updateRow(rowIndex, {
                          ...row,
                          definitions: nextDefinitions,
                        })
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    updateRow(rowIndex, {
                      ...row,
                      definitions: [...row.definitions, ''],
                    })
                  }
                >
                  <Plus />
                  Add definition
                </Button>
              </div>
            )
          })}
        </div>
        <p className="text-sm text-muted-foreground">
          Paste from a spreadsheet into any field. The first column is the word.
          Following columns are definitions.
        </p>
        <p className="text-sm text-muted-foreground">
          {entries.length} word{entries.length === 1 ? '' : 's'}
          {withDefinitions > 0
            ? ` · ${withDefinitions} with definition${withDefinitions === 1 ? '' : 's'}`
            : ''}
        </p>
      </CardContent>
    </Card>
  )
}
