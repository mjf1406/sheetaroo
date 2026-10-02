import { useAction } from 'convex/react'
import { Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { CustomizeSectionCollapsible } from '@/components/vocabulary/customize-section-collapsible'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { actionErrorMessage } from '@/lib/action-error-message'
import type {
  DifferentiationTier,
  GradeLevel,
} from '@/lib/differentiation-types'
import {
  createAiWordFormEntry,
  createManualWordFormEntry,
  createWordFormSentenceId,
  wordFormSentenceHeading,
} from '@/lib/word-forms-types'
import type {
  WordFormEntry,
  WordFormItem,
  WordFormSentence,
} from '@/lib/word-forms-types'
import type { VocabEntry } from '@/lib/vocabulary-types'
import { WORKSHEET_LABELS } from '@/lib/vocabulary-types'

import { api } from '../../../convex/_generated/api'

type WordFormsWorksheetProps = {
  entries: VocabEntry[]
  tiers: DifferentiationTier[]
  wordForms: WordFormEntry[]
  onWordFormsChange: (wordForms: WordFormEntry[]) => void
  wordFormSentences: WordFormSentence[]
  onWordFormSentencesChange: (sentences: WordFormSentence[]) => void
}

export function WordFormsWorksheet({
  entries,
  tiers,
  wordForms,
  onWordFormsChange,
  wordFormSentences,
  onWordFormSentencesChange,
}: WordFormsWorksheetProps) {
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [isGeneratingAll, setIsGeneratingAll] = useState(false)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [regeneratingSentenceId, setRegeneratingSentenceId] = useState<
    string | null
  >(null)

  const generateBatch = useAction(api.wordForms.generateBatch)
  const regenerateOne = useAction(api.wordForms.regenerateOne)
  const regenerateSentence = useAction(api.wordForms.regenerateSentence)

  const generatedBaseWords = useMemo(
    () => new Set(wordForms.map((entry) => entry.baseWord.toLowerCase())),
    [wordForms],
  )

  const aiSentencesByGrade = useMemo(() => {
    const grouped = new Map<GradeLevel, WordFormSentence[]>()
    for (const sentence of wordFormSentences) {
      if (sentence.source !== 'ai') continue
      const existing = grouped.get(sentence.gradeLevel) ?? []
      existing.push(sentence)
      grouped.set(sentence.gradeLevel, existing)
    }
    return grouped
  }, [wordFormSentences])

  const manualWordForms = useMemo(
    () => wordForms.filter((entry) => entry.source === 'manual'),
    [wordForms],
  )

  const aiWordForms = useMemo(
    () => wordForms.filter((entry) => entry.source === 'ai'),
    [wordForms],
  )

  const hasAiGeneratedContent =
    aiWordForms.length > 0 ||
    wordFormSentences.some((sentence) => sentence.source === 'ai')

  function updateEntry(id: string, patch: Partial<WordFormEntry>) {
    onWordFormsChange(
      wordForms.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    )
  }

  function updateFormItem(
    entryId: string,
    formIndex: number,
    patch: Partial<WordFormItem>,
  ) {
    onWordFormsChange(
      wordForms.map((entry) => {
        if (entry.id !== entryId) return entry
        const forms = entry.forms.map((item, index) =>
          index === formIndex ? { ...item, ...patch } : item,
        )
        return { ...entry, forms }
      }),
    )
  }

  function updateSentence(id: string, sentence: string) {
    onWordFormSentencesChange(
      wordFormSentences.map((item) =>
        item.id === id ? { ...item, sentence } : item,
      ),
    )
  }

  function addFormItem(entryId: string) {
    onWordFormsChange(
      wordForms.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              forms: [...entry.forms, { label: 'Form', form: '' }],
            }
          : entry,
      ),
    )
  }

  function removeFormItem(entryId: string, formIndex: number) {
    onWordFormsChange(
      wordForms.map((entry) => {
        if (entry.id !== entryId) return entry
        if (entry.forms.length <= 1) return entry
        return {
          ...entry,
          forms: entry.forms.filter((_, index) => index !== formIndex),
        }
      }),
    )
  }

  function removeEntry(id: string) {
    const entry = wordForms.find((item) => item.id === id)
    onWordFormsChange(wordForms.filter((item) => item.id !== id))
    if (entry) {
      onWordFormSentencesChange(
        wordFormSentences.filter(
          (sentence) =>
            sentence.baseWord.toLowerCase() !== entry.baseWord.toLowerCase(),
        ),
      )
    }
  }

  function addManualEntry() {
    const baseWord = entries[0]?.word ?? 'word'
    onWordFormsChange([...wordForms, createManualWordFormEntry({ baseWord })])
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

    const entriesToGenerate = entries.filter(
      (entry) => !generatedBaseWords.has(entry.word.toLowerCase()),
    )

    if (entriesToGenerate.length === 0) {
      setError(null)
      setInfo(
        'All vocabulary words already have word forms. Remove an entry or add new words to generate more.',
      )
      return
    }

    setError(null)
    setInfo(null)
    setIsGeneratingAll(true)
    try {
      const result = await generateBatch({
        entries: entriesToGenerate.map((entry) => ({
          word: entry.word,
          definition: entry.definition,
        })),
        tiers: tiers.map((tier) => ({ gradeLevel: tier.gradeLevel })),
      })

      const newEntries = result.words.map((word) =>
        createAiWordFormEntry({
          baseWord: word.baseWord,
          forms: word.forms,
        }),
      )
      const newSentences = result.sentences.map((item) => ({
        id: createWordFormSentenceId(),
        baseWord: item.baseWord,
        form: item.form,
        label: item.label,
        gradeLevel: item.gradeLevel as GradeLevel,
        sentence: item.sentence,
        source: 'ai' as const,
      }))

      onWordFormsChange([...wordForms, ...newEntries])
      onWordFormSentencesChange([...wordFormSentences, ...newSentences])
    } catch (err) {
      setError(actionErrorMessage(err, 'Generation failed'))
    } finally {
      setIsGeneratingAll(false)
    }
  }

  async function handleRegenerate(entry: WordFormEntry) {
    const vocabEntry = entries.find(
      (item) => item.word.toLowerCase() === entry.baseWord.toLowerCase(),
    )

    setRegeneratingId(entry.id)
    setError(null)
    try {
      const result = await regenerateOne({
        word: entry.baseWord,
        definition: vocabEntry?.definition,
        tiers: tiers.map((tier) => ({ gradeLevel: tier.gradeLevel })),
      })

      updateEntry(entry.id, {
        forms: result.forms,
        source: 'ai',
      })

      const remaining = wordFormSentences.filter(
        (sentence) =>
          sentence.baseWord.toLowerCase() !== entry.baseWord.toLowerCase(),
      )
      const newSentences = result.sentences.map((item) => ({
        id: createWordFormSentenceId(),
        baseWord: item.baseWord,
        form: item.form,
        label: item.label,
        gradeLevel: item.gradeLevel as GradeLevel,
        sentence: item.sentence,
        source: 'ai' as const,
      }))
      onWordFormSentencesChange([...remaining, ...newSentences])
    } catch (err) {
      setError(actionErrorMessage(err, 'Regeneration failed'))
    } finally {
      setRegeneratingId(null)
    }
  }

  async function handleRegenerateSentence(sentence: WordFormSentence) {
    const vocabEntry = entries.find(
      (item) => item.word.toLowerCase() === sentence.baseWord.toLowerCase(),
    )

    setRegeneratingSentenceId(sentence.id)
    setError(null)
    try {
      const result = await regenerateSentence({
        baseWord: sentence.baseWord,
        form: sentence.form,
        label: sentence.label,
        definition: vocabEntry?.definition,
        gradeLevel: sentence.gradeLevel,
        currentSentence: sentence.sentence,
      })

      onWordFormSentencesChange(
        wordFormSentences.map((item) =>
          item.id === sentence.id
            ? { ...item, sentence: result.sentence }
            : item,
        ),
      )
    } catch (err) {
      setError(actionErrorMessage(err, 'Regeneration failed'))
    } finally {
      setRegeneratingSentenceId(null)
    }
  }

  function renderWordFormEntry(entry: WordFormEntry, showRegenerate: boolean) {
    return (
      <div key={entry.id} className="space-y-3 rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <Label htmlFor={`word-form-base-${entry.id}`}>Base word</Label>
            <Input
              id={`word-form-base-${entry.id}`}
              value={entry.baseWord}
              onChange={(event) =>
                updateEntry(entry.id, { baseWord: event.target.value })
              }
              className="max-w-xs"
            />
          </div>
          <div className="flex gap-2">
            {showRegenerate ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={regeneratingId === entry.id}
                onClick={() => void handleRegenerate(entry)}
              >
                {regeneratingId === entry.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Regenerate
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove ${entry.baseWord}`}
              onClick={() => removeEntry(entry.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {entry.forms.map((formItem, formIndex) => (
            <div
              key={`${entry.id}-${formIndex}`}
              className="flex flex-wrap items-end gap-2"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <Label
                  htmlFor={`form-label-${entry.id}-${formIndex}`}
                  className="text-xs text-muted-foreground"
                >
                  Label
                </Label>
                <Input
                  id={`form-label-${entry.id}-${formIndex}`}
                  value={formItem.label}
                  onChange={(event) =>
                    updateFormItem(entry.id, formIndex, {
                      label: event.target.value,
                    })
                  }
                  placeholder="verb (-ing)"
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <Label
                  htmlFor={`form-value-${entry.id}-${formIndex}`}
                  className="text-xs text-muted-foreground"
                >
                  Form
                </Label>
                <Input
                  id={`form-value-${entry.id}-${formIndex}`}
                  value={formItem.form}
                  onChange={(event) =>
                    updateFormItem(entry.id, formIndex, {
                      form: event.target.value,
                    })
                  }
                  placeholder="comparing"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label="Remove form"
                disabled={entry.forms.length <= 1}
                onClick={() => removeFormItem(entry.id, formIndex)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addFormItem(entry.id)}
        >
          <Plus className="size-4" />
          Add form
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => void handleGenerateAll()}
          disabled={
            isGeneratingAll || entries.length === 0 || tiers.length === 0
          }
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addManualEntry}
        >
          <Plus className="size-4" />
          Add word manually
        </Button>
      </div>

      {wordForms.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Generate word forms from your vocabulary list or add entries manually.
        </p>
      ) : null}

      {manualWordForms.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Word forms</h3>
          {manualWordForms.map((entry) => renderWordFormEntry(entry, false))}
        </div>
      ) : null}

      <CustomizeSectionCollapsible
        sectionName={WORKSHEET_LABELS['word-forms']}
        show={hasAiGeneratedContent}
      >
        {aiWordForms.length > 0 ? (
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Word forms</h3>
            {aiWordForms.map((entry) => renderWordFormEntry(entry, true))}
          </div>
        ) : null}

        {aiSentencesByGrade.size > 0 ? (
          <div className="space-y-6">
            <h3 className="text-sm font-medium">Sentences</h3>
            {tiers.map((tier) => {
              const tierSentences =
                aiSentencesByGrade.get(tier.gradeLevel) ?? []
              if (tierSentences.length === 0) return null

              return (
                <div key={tier.id} className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    {wordFormSentenceHeading(
                      tier.gradeLevel,
                      tierSentences.length,
                    )}
                  </h4>
                  {tierSentences.map((sentence) => (
                    <div key={sentence.id} className="flex items-start gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <Label
                          htmlFor={`wf-sentence-${sentence.id}`}
                          className="text-xs text-muted-foreground"
                        >
                          {sentence.baseWord} — {sentence.label} (
                          {sentence.form})
                        </Label>
                        <Input
                          id={`wf-sentence-${sentence.id}`}
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
                        aria-label={`Regenerate sentence for ${sentence.form}`}
                        disabled={regeneratingSentenceId === sentence.id}
                        onClick={() => void handleRegenerateSentence(sentence)}
                      >
                        {regeneratingSentenceId === sentence.id ? (
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

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {info ? <p className="text-sm text-muted-foreground">{info}</p> : null}
    </>
  )
}
