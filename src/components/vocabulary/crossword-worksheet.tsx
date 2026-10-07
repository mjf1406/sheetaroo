import { useAction } from 'convex/react'
import { Loader2, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'

import { CustomizeSectionCollapsible } from '@/components/vocabulary/customize-section-collapsible'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { actionErrorMessage } from '@/lib/action-error-message'
import { generateCrossword } from '@/lib/crossword-generator'
import {
  createCrosswordClueId,
  createManualCrosswordClue,
  crosswordClueHeading,
  formatCrosswordClueText,
} from '@/lib/crossword-types'
import type { CrosswordClue } from '@/lib/crossword-types'
import type {
  DifferentiationTier,
  GradeLevel,
} from '@/lib/differentiation-types'
import type { VocabEntry } from '@/lib/vocabulary-types'
import { WORKSHEET_LABELS } from '@/lib/vocabulary-types'

import { api } from '../../../convex/_generated/api'

type CrosswordWorksheetProps = {
  entries: VocabEntry[]
  tiers: DifferentiationTier[]
  crosswordClues: CrosswordClue[]
  onCrosswordCluesChange: (clues: CrosswordClue[]) => void
  crosswordWords: string[]
  crosswordSeed: number
}

function normalizeWord(word: string): string {
  return word.trim().toLowerCase()
}

function upsertClue(
  clues: CrosswordClue[],
  input: {
    word: string
    gradeLevel: GradeLevel
    definitions: string[]
    source: 'ai' | 'manual'
  },
): CrosswordClue[] {
  const existing = clues.find(
    (clue) =>
      normalizeWord(clue.word) === normalizeWord(input.word) &&
      clue.gradeLevel === input.gradeLevel,
  )

  if (existing) {
    return clues.map((clue) =>
      clue.id === existing.id
        ? {
            ...clue,
            definitions: input.definitions,
            source: input.source,
          }
        : clue,
    )
  }

  return [
    ...clues,
    createManualCrosswordClue({
      word: input.word,
      gradeLevel: input.gradeLevel,
      definitions: input.definitions,
    }),
  ]
}

export function CrosswordWorksheet({
  entries,
  tiers,
  crosswordClues,
  onCrosswordCluesChange,
  crosswordWords,
  crosswordSeed,
}: CrosswordWorksheetProps) {
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [differentiateDefinitions, setDifferentiateDefinitions] =
    useState(false)
  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null)

  const generateDefinitions = useAction(api.crossword.generateDefinitions)
  const defaultGrade = tiers[0]?.gradeLevel ?? '5'

  const crosswordPreview = useMemo(
    () => generateCrossword(crosswordWords, crosswordSeed),
    [crosswordWords, crosswordSeed],
  )

  const cluesByGrade = useMemo(() => {
    const grouped = new Map<GradeLevel, CrosswordClue[]>()
    for (const clue of crosswordClues) {
      const existing = grouped.get(clue.gradeLevel) ?? []
      existing.push(clue)
      grouped.set(clue.gradeLevel, existing)
    }
    return grouped
  }, [crosswordClues])

  function getDefinitionsForWord(
    word: string,
    gradeLevel: GradeLevel,
  ): string[] {
    const clue = crosswordClues.find(
      (item) =>
        normalizeWord(item.word) === normalizeWord(word) &&
        item.gradeLevel === gradeLevel,
    )
    if (clue) return [clue.definitions[0] ?? '', clue.definitions[1] ?? '']
    const entry = entries.find(
      (item) => normalizeWord(item.word) === normalizeWord(word),
    )
    return [entry?.definitions[0] ?? '', entry?.definitions[1] ?? '']
  }

  function updateWordDefinitions(
    word: string,
    gradeLevel: GradeLevel,
    definition1: string,
    definition2: string,
  ) {
    const definitions = [definition1, definition2]
      .map((item) => item.trim())
      .filter(Boolean)

    if (definitions.length === 0) {
      onCrosswordCluesChange(
        crosswordClues.filter(
          (clue) =>
            !(
              normalizeWord(clue.word) === normalizeWord(word) &&
              clue.gradeLevel === gradeLevel
            ),
        ),
      )
      return
    }

    onCrosswordCluesChange(
      upsertClue(crosswordClues, {
        word,
        gradeLevel,
        definitions,
        source: 'manual',
      }),
    )
  }

  function buildCluesFromTeacherInput(gradeLevel: GradeLevel): CrosswordClue[] {
    return entries
      .map((entry) => {
        const editorDefinitions = getDefinitionsForWord(entry.word, gradeLevel)
          .map((item) => item.trim())
          .filter(Boolean)

        if (editorDefinitions.length === 0) return null

        return createManualCrosswordClue({
          word: entry.word,
          gradeLevel,
          definitions: editorDefinitions,
        })
      })
      .filter((item): item is CrosswordClue => item !== null)
  }

  function allWordsHaveDefinitions(): boolean {
    return entries.every((entry) => {
      const defs = getDefinitionsForWord(entry.word, defaultGrade)
        .map((item) => item.trim())
        .filter(Boolean)
      return defs.length > 0
    })
  }

  async function handleGenerate() {
    if (entries.length === 0) {
      setError('Add at least one vocabulary word.')
      setInfo(null)
      return
    }
    if (tiers.length === 0) {
      setError('Add at least one grade level in Differentiation.')
      setInfo(null)
      return
    }

    if (!differentiateDefinitions && allWordsHaveDefinitions()) {
      onCrosswordCluesChange(buildCluesFromTeacherInput(defaultGrade))
      setError(null)
      setInfo('Using your definitions for the crossword clues.')
      return
    }

    setError(null)
    setInfo(null)
    setIsGenerating(true)

    try {
      const gradeLevels = differentiateDefinitions
        ? tiers.map((tier) => tier.gradeLevel)
        : [defaultGrade]

      const results = await generateDefinitions({
        entries: entries.map((entry) => {
          const editorDefs = getDefinitionsForWord(entry.word, defaultGrade)
          return {
            word: entry.word,
            definition: editorDefs[0]?.trim() || entry.definitions[0],
            definition2: editorDefs[1]?.trim() || entry.definitions[1],
          }
        }),
        tiers: gradeLevels.map((gradeLevel) => ({ gradeLevel })),
        mode: differentiateDefinitions ? 'all' : 'fill-missing',
      })

      const generated = results.map((item) => ({
        id: createCrosswordClueId(),
        word: item.word,
        gradeLevel: item.gradeLevel as GradeLevel,
        definitions: item.definitions,
        source: item.source,
      }))

      if (differentiateDefinitions) {
        onCrosswordCluesChange(generated)
      } else {
        const otherGrades = crosswordClues.filter(
          (clue) => clue.gradeLevel !== defaultGrade,
        )
        onCrosswordCluesChange([...otherGrades, ...generated])
      }
    } catch (err) {
      setError(actionErrorMessage(err, 'Generation failed'))
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleRegenerate(word: string, gradeLevel: GradeLevel) {
    const entry = entries.find(
      (item) => normalizeWord(item.word) === normalizeWord(word),
    )
    if (!entry) return

    const key = `${word}:${gradeLevel}`
    setRegeneratingKey(key)
    setError(null)

    try {
      const results = await generateDefinitions({
        entries: [
          {
            word: entry.word,
            definition: entry.definitions[0],
            definition2: entry.definitions[1],
          },
        ],
        tiers: [{ gradeLevel }],
        mode: 'all',
      })

      const generated = results[0]
      if (!generated) {
        throw new Error('Gemini returned no definitions')
      }

      onCrosswordCluesChange(
        upsertClue(crosswordClues, {
          word,
          gradeLevel,
          definitions: generated.definitions,
          source: 'ai',
        }),
      )
    } catch (err) {
      setError(actionErrorMessage(err, 'Regeneration failed'))
    } finally {
      setRegeneratingKey(null)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-4">
        <Switch
          id="crossword-differentiate-definitions"
          checked={differentiateDefinitions}
          onCheckedChange={setDifferentiateDefinitions}
          aria-label="AI generate or differentiate definitions by grade"
        />
        <Label
          htmlFor="crossword-differentiate-definitions"
          className="font-normal"
        >
          AI generate / differentiate definitions by grade
        </Label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={isGenerating || entries.length === 0 || tiers.length === 0}
        >
          {isGenerating ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Generating…
            </>
          ) : (
            'Generate definitions'
          )}
        </Button>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add vocabulary words above to create crossword clues.
        </p>
      ) : null}

      <CustomizeSectionCollapsible
        sectionName={WORKSHEET_LABELS['crossword-puzzle']}
        show={entries.length > 0}
      >
        <div className="space-y-4">
          {entries.map((entry) => {
            const definitions = getDefinitionsForWord(entry.word, defaultGrade)
            const definition1 = definitions[0] ?? ''
            const definition2 = definitions[1] ?? ''

            return (
              <div key={entry.word} className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium">{entry.word}</p>
                <div className="space-y-2">
                  <Label htmlFor={`crossword-def1-${entry.word}`}>
                    Definition 1
                  </Label>
                  <Textarea
                    id={`crossword-def1-${entry.word}`}
                    value={definition1}
                    onChange={(event) =>
                      updateWordDefinitions(
                        entry.word,
                        defaultGrade,
                        event.target.value,
                        definition2,
                      )
                    }
                    rows={2}
                    placeholder="Enter a student-friendly definition"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`crossword-def2-${entry.word}`}>
                    Definition 2 (optional)
                  </Label>
                  <Textarea
                    id={`crossword-def2-${entry.word}`}
                    value={definition2}
                    onChange={(event) =>
                      updateWordDefinitions(
                        entry.word,
                        defaultGrade,
                        definition1,
                        event.target.value,
                      )
                    }
                    rows={2}
                    placeholder="Optional second definition"
                  />
                </div>
              </div>
            )
          })}
        </div>

        {differentiateDefinitions && cluesByGrade.size > 0 ? (
          <div className="space-y-6">
            {tiers.map((tier) => {
              const tierClues = cluesByGrade.get(tier.gradeLevel) ?? []
              if (tierClues.length === 0) return null

              return (
                <div key={tier.id} className="space-y-3">
                  <h3 className="text-sm font-medium">
                    {crosswordClueHeading(tier.gradeLevel, tierClues.length)}
                  </h3>
                  {tierClues.map((clue) => (
                    <div
                      key={clue.id}
                      className="flex items-start gap-2 rounded-md border p-3"
                    >
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          {clue.word}
                        </p>
                        <Input
                          value={formatCrosswordClueText(clue.definitions)}
                          onChange={(event) => {
                            const parts = event.target.value
                              .split(';')
                              .map((item) => item.trim())
                              .filter(Boolean)
                            onCrosswordCluesChange(
                              upsertClue(crosswordClues, {
                                word: clue.word,
                                gradeLevel: clue.gradeLevel,
                                definitions: parts,
                                source: 'manual',
                              }),
                            )
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        aria-label={`Regenerate definitions for ${clue.word}`}
                        disabled={
                          regeneratingKey === `${clue.word}:${clue.gradeLevel}`
                        }
                        onClick={() =>
                          void handleRegenerate(clue.word, clue.gradeLevel)
                        }
                      >
                        {regeneratingKey ===
                        `${clue.word}:${clue.gradeLevel}` ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <RefreshCw className="size-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        ) : null}
      </CustomizeSectionCollapsible>

      {crosswordPreview.unplaced.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Could not place in crossword grid:{' '}
          {crosswordPreview.unplaced.join(', ')}
        </p>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {info ? <p className="text-sm text-muted-foreground">{info}</p> : null}
    </>
  )
}
