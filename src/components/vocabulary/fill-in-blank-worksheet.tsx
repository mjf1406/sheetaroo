import { useAction } from 'convex/react'
import { Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { type DifferentiationTier, type GradeLevel } from '@/lib/differentiation-types'
import {
  createManualSentence,
  createSentenceId,
  gradeHeading,
  type FillInBlankSentence,
} from '@/lib/fill-in-blank-types'
import type { VocabEntry } from '@/lib/vocabulary-types'
import { WORKSHEET_LABELS } from '@/lib/vocabulary-types'

import { api } from '../../../convex/_generated/api'

type FillInBlankWorksheetProps = {
  entries: VocabEntry[]
  tiers: DifferentiationTier[]
  sentences: FillInBlankSentence[]
  onSentencesChange: (sentences: FillInBlankSentence[]) => void
  wordBank: boolean
  onWordBankChange: (wordBank: boolean) => void
}

type WorksheetMode = 'manual' | 'ai'

export function FillInBlankWorksheet({
  entries,
  tiers,
  sentences,
  onSentencesChange,
  wordBank,
  onWordBankChange,
}: FillInBlankWorksheetProps) {
  const [mode, setMode] = useState<WorksheetMode>('ai')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [isGeneratingAll, setIsGeneratingAll] = useState(false)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)

  const generateBatch = useAction(api.fillInBlank.generateBatch)
  const regenerateOne = useAction(api.fillInBlank.regenerateOne)

  const defaultGrade = tiers[0]?.gradeLevel ?? '5'

  const aiSentencesByGrade = useMemo(() => {
    const grouped = new Map<GradeLevel, FillInBlankSentence[]>()
    for (const sentence of sentences) {
      if (sentence.source !== 'ai') continue
      const existing = grouped.get(sentence.gradeLevel) ?? []
      existing.push(sentence)
      grouped.set(sentence.gradeLevel, existing)
    }
    return grouped
  }, [sentences])

  const manualSentences = useMemo(
    () => sentences.filter((sentence) => sentence.source === 'manual'),
    [sentences],
  )

  function updateSentence(id: string, sentence: string) {
    onSentencesChange(
      sentences.map((item) => (item.id === id ? { ...item, sentence } : item)),
    )
  }

  function removeSentence(id: string) {
    onSentencesChange(sentences.filter((item) => item.id !== id))
  }

  function addManualSentence() {
    const word = entries[0]?.word ?? 'word'
    onSentencesChange([
      ...sentences,
      createManualSentence({ word, gradeLevel: defaultGrade }),
    ])
  }

  function addOnePerWord() {
    if (entries.length === 0) {
      setError('Add vocabulary words above first.')
      return
    }
    setError(null)
    onSentencesChange([
      ...sentences,
      ...entries.map((entry) =>
        createManualSentence({
          word: entry.word,
          gradeLevel: defaultGrade,
          sentence: `The _____ (${entry.word})`,
        }),
      ),
    ])
  }

  async function handleGenerateAll() {
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

    const tiersToGenerate = tiers.filter((tier) => !aiSentencesByGrade.has(tier.gradeLevel))
    if (tiersToGenerate.length === 0) {
      setError(null)
      setInfo(
        'All grade levels already have AI sentences. Add a new grade in Differentiation to generate more.',
      )
      return
    }

    setError(null)
    setInfo(null)
    setIsGeneratingAll(true)
    try {
      const results = await generateBatch({
        entries: entries.map((entry) => ({
          word: entry.word,
          definition: entry.definition,
        })),
        tiers: tiersToGenerate.map((tier) => ({
          gradeLevel: tier.gradeLevel,
        })),
      })

      const generatedGrades = new Set(tiersToGenerate.map((tier) => tier.gradeLevel))

      const manual = sentences.filter((sentence) => sentence.source === 'manual')
      const existingAi = sentences.filter(
        (sentence) => sentence.source === 'ai' && !generatedGrades.has(sentence.gradeLevel),
      )
      const newAi = results.map((result) => ({
        id: createSentenceId(),
        word: result.word,
        gradeLevel: result.gradeLevel as GradeLevel,
        sentence: result.sentence,
        source: 'ai' as const,
      }))
      onSentencesChange([...manual, ...existingAi, ...newAi])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setIsGeneratingAll(false)
    }
  }

  async function handleRegenerate(sentence: FillInBlankSentence) {
    const entry = entries.find(
      (item) => item.word.toLowerCase() === sentence.word.toLowerCase(),
    )

    setRegeneratingId(sentence.id)
    setError(null)
    try {
      const result = await regenerateOne({
        word: sentence.word,
        definition: entry?.definition,
        gradeLevel: sentence.gradeLevel,
        currentSentence: sentence.sentence,
      })

      onSentencesChange(
        sentences.map((item) =>
          item.id === sentence.id ? { ...item, sentence: result.sentence } : item,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Regeneration failed')
    } finally {
      setRegeneratingId(null)
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">{WORKSHEET_LABELS['fill-in-the-blank']}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create sentences with blanks, or let AI generate grade-level versions you can edit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="fill-in-blank-word-bank"
            checked={wordBank}
            onCheckedChange={onWordBankChange}
            aria-label="Include word bank on worksheet"
          />
          <Label htmlFor="fill-in-blank-word-bank" className="font-normal">
            Include word bank
          </Label>
        </div>
      </div>

      <Tabs value={mode} onValueChange={(value) => setMode(value as WorksheetMode)}>
        <TabsList>
          <TabsTrigger value="manual">Create your own</TabsTrigger>
          <TabsTrigger value="ai">AI generate</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addManualSentence}>
              <Plus className="size-4" />
              Add sentence
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addOnePerWord}
              disabled={entries.length === 0}
            >
              Add one per word
            </Button>
          </div>

          {manualSentences.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add sentences manually using the buttons above.
            </p>
          ) : (
            <div className="space-y-3">
              {manualSentences.map((sentence) => (
                <div key={sentence.id} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label htmlFor={`manual-${sentence.id}`} className="text-xs text-muted-foreground">
                      {sentence.word}
                    </Label>
                    <Input
                      id={`manual-${sentence.id}`}
                      value={sentence.sentence}
                      onChange={(event) => updateSentence(sentence.id, event.target.value)}
                      placeholder="The _____ was interesting."
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-6 shrink-0"
                    aria-label="Remove sentence"
                    onClick={() => removeSentence(sentence.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ai" className="mt-4 space-y-4">
          <Button
            type="button"
            onClick={() => void handleGenerateAll()}
            disabled={isGeneratingAll || entries.length === 0 || tiers.length === 0}
          >
            {isGeneratingAll ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Generating…
              </>
            ) : (
              'Generate all'
            )}
          </Button>

          {aiSentencesByGrade.size === 0 ? (
            <p className="text-sm text-muted-foreground">
              Generate grade-level sentences from your vocabulary list and differentiation settings.
            </p>
          ) : (
            <div className="space-y-6">
              {tiers.map((tier) => {
                const tierSentences = aiSentencesByGrade.get(tier.gradeLevel) ?? []
                if (tierSentences.length === 0) return null

                return (
                  <div key={tier.id} className="space-y-3">
                    <h3 className="text-sm font-medium">
                      {gradeHeading(tier.gradeLevel, tierSentences.length)}
                    </h3>
                    {tierSentences.map((sentence) => (
                      <div key={sentence.id} className="flex items-start gap-2">
                        <div className="min-w-0 flex-1 space-y-1">
                          <Label
                            htmlFor={`ai-${sentence.id}`}
                            className="text-xs text-muted-foreground"
                          >
                            {sentence.word}
                          </Label>
                          <Input
                            id={`ai-${sentence.id}`}
                            value={sentence.sentence}
                            onChange={(event) =>
                              updateSentence(sentence.id, event.target.value)
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="mt-6 shrink-0"
                          aria-label={`Regenerate sentence for ${sentence.word}`}
                          disabled={regeneratingId === sentence.id}
                          onClick={() => void handleRegenerate(sentence)}
                        >
                          {regeneratingId === sentence.id ? (
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
          )}
        </TabsContent>
      </Tabs>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {info ? <p className="text-sm text-muted-foreground">{info}</p> : null}
    </section>
  )
}
