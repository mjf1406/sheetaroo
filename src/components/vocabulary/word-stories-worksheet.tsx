import { useAction } from 'convex/react'
import { Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { CustomizeSectionCollapsible } from '@/components/vocabulary/customize-section-collapsible'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { actionErrorMessage } from '@/lib/action-error-message'
import type {
  DifferentiationTier,
  GradeLevel,
} from '@/lib/differentiation-types'
import type { VocabEntry } from '@/lib/vocabulary-types'
import { getWords, WORKSHEET_LABELS } from '@/lib/vocabulary-types'
import {
  buildClozeAssignments,
  buildStoryAssignments,
  createManualWordStory,
  createWordStoryId,
  wordStoriesHeading,
} from '@/lib/word-stories-types'
import type {
  WordStory,
  WordStoryDefinition,
  WordStorySettings,
} from '@/lib/word-stories-types'

import { api } from '../../../convex/_generated/api'

type WordStoriesWorksheetProps = {
  entries: VocabEntry[]
  tiers: DifferentiationTier[]
  wordStories: WordStory[]
  onWordStoriesChange: (stories: WordStory[]) => void
  wordStoryDefinitions: WordStoryDefinition[]
  onWordStoryDefinitionsChange: (definitions: WordStoryDefinition[]) => void
  wordStorySettings: WordStorySettings
  onWordStorySettingsChange: (settings: WordStorySettings) => void
  wordStoryAssignmentSeed: number
}

type WorksheetMode = 'manual' | 'ai'

function mergeDefinitions(
  entries: VocabEntry[],
  aiDefinitions: Array<{ word: string; definition: string }>,
): WordStoryDefinition[] {
  const aiByWord = new Map(
    aiDefinitions.map((item) => [
      item.word.trim().toLowerCase(),
      item.definition,
    ]),
  )

  return entries
    .map((entry) => {
      const teacherDefinition = entry.definition?.trim()
      if (teacherDefinition) {
        return {
          word: entry.word,
          definition: teacherDefinition,
          source: 'teacher' as const,
        }
      }

      const aiDefinition = aiByWord.get(entry.word.trim().toLowerCase())
      if (aiDefinition) {
        return {
          word: entry.word,
          definition: aiDefinition,
          source: 'ai' as const,
        }
      }

      return null
    })
    .filter((item): item is WordStoryDefinition => item !== null)
}

function buildAssignments(
  words: string[],
  settings: WordStorySettings,
  seed: number,
) {
  return buildStoryAssignments(words, settings, seed)
}

export function WordStoriesWorksheet({
  entries,
  tiers,
  wordStories,
  onWordStoriesChange,
  wordStoryDefinitions,
  onWordStoryDefinitionsChange,
  wordStorySettings,
  onWordStorySettingsChange,
  wordStoryAssignmentSeed,
}: WordStoriesWorksheetProps) {
  const [mode, setMode] = useState<WorksheetMode>('ai')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [isGeneratingAll, setIsGeneratingAll] = useState(false)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)

  const generateBatch = useAction(api.wordStories.generateBatch)
  const regenerateStory = useAction(api.wordStories.regenerateStory)

  const words = useMemo(() => getWords(entries), [entries])
  const defaultGrade = tiers[0]?.gradeLevel ?? '5'
  const maxStoryCount = Math.max(1, words.length)

  const assignments = useMemo(
    () => buildAssignments(words, wordStorySettings, wordStoryAssignmentSeed),
    [words, wordStorySettings, wordStoryAssignmentSeed],
  )

  const clozeAssignments = useMemo(
    () =>
      wordStorySettings.includeClozeStories
        ? buildClozeAssignments(
            words,
            wordStorySettings,
            wordStoryAssignmentSeed,
          )
        : assignments,
    [words, wordStorySettings, wordStoryAssignmentSeed, assignments],
  )

  const aiStoriesByGrade = useMemo(() => {
    const grouped = new Map<GradeLevel, WordStory[]>()
    for (const story of wordStories) {
      if (story.source !== 'ai') continue
      const existing = grouped.get(story.gradeLevel) ?? []
      existing.push(story)
      grouped.set(story.gradeLevel, existing)
    }
    for (const [gradeLevel, stories] of grouped) {
      grouped.set(
        gradeLevel,
        [...stories].sort((left, right) => left.storyIndex - right.storyIndex),
      )
    }
    return grouped
  }, [wordStories])

  const manualStories = useMemo(
    () => wordStories.filter((story) => story.source === 'manual'),
    [wordStories],
  )

  function updateSettings(patch: Partial<WordStorySettings>) {
    onWordStorySettingsChange({ ...wordStorySettings, ...patch })
  }

  function updateStory(id: string, patch: Partial<WordStory>) {
    onWordStoriesChange(
      wordStories.map((story) =>
        story.id === id ? { ...story, ...patch } : story,
      ),
    )
  }

  function removeStory(id: string) {
    onWordStoriesChange(wordStories.filter((story) => story.id !== id))
  }

  function addManualStory() {
    const assignment = assignments[0] ?? {
      storyIndex: 0,
      words: words.slice(0, 1),
    }
    const clozeAssignment = clozeAssignments.find(
      (item) => item.storyIndex === assignment.storyIndex,
    )
    onWordStoriesChange([
      ...wordStories,
      createManualWordStory({
        gradeLevel: defaultGrade,
        storyIndex: assignment.storyIndex,
        words: assignment.words,
        clozeWords: clozeAssignment?.words ?? assignment.words,
      }),
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
    if (assignments.every((item) => item.words.length === 0)) {
      setError('Add vocabulary words to assign to stories.')
      setInfo(null)
      return
    }

    const tiersToGenerate = tiers.filter(
      (tier) => !aiStoriesByGrade.has(tier.gradeLevel),
    )
    if (tiersToGenerate.length === 0) {
      setError(null)
      setInfo(
        'All grade levels already have AI stories. Add a new grade in Differentiation to generate more.',
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
        assignments,
        clozeAssignments,
        allowRepeatWithinStory: wordStorySettings.allowRepeatWithinStory,
      })

      const generatedGrades = new Set(
        tiersToGenerate.map((tier) => tier.gradeLevel),
      )
      const manual = wordStories.filter((story) => story.source === 'manual')
      const existingAi = wordStories.filter(
        (story) =>
          story.source === 'ai' && !generatedGrades.has(story.gradeLevel),
      )
      const newAi = results.stories.map((story) => ({
        id: createWordStoryId(),
        gradeLevel: story.gradeLevel as GradeLevel,
        storyIndex: story.storyIndex,
        title: story.title,
        storyText: story.storyText,
        clozeText: story.clozeText,
        words: story.words,
        clozeWords: story.clozeWords,
        source: 'ai' as const,
      }))

      onWordStoriesChange([...manual, ...existingAi, ...newAi])
      onWordStoryDefinitionsChange(
        mergeDefinitions(entries, results.definitions),
      )
    } catch (err) {
      setError(actionErrorMessage(err, 'Generation failed'))
    } finally {
      setIsGeneratingAll(false)
    }
  }

  async function handleRegenerate(story: WordStory) {
    setRegeneratingId(story.id)
    setError(null)
    try {
      const result = await regenerateStory({
        entries: entries.map((entry) => ({
          word: entry.word,
          definition: entry.definition,
        })),
        gradeLevel: story.gradeLevel,
        storyIndex: story.storyIndex,
        words: story.words,
        clozeWords: story.clozeWords,
        allowRepeatWithinStory: wordStorySettings.allowRepeatWithinStory,
        currentStoryText: story.storyText,
        currentClozeText: story.clozeText,
      })

      onWordStoriesChange(
        wordStories.map((item) =>
          item.id === story.id
            ? {
                ...item,
                title: result.title,
                storyText: result.storyText,
                clozeText: result.clozeText,
                words: result.words,
                clozeWords: result.clozeWords,
              }
            : item,
        ),
      )
    } catch (err) {
      setError(actionErrorMessage(err, 'Regeneration failed'))
    } finally {
      setRegeneratingId(null)
    }
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="word-stories-count">Number of stories</Label>
          <Input
            id="word-stories-count"
            type="number"
            min={1}
            max={maxStoryCount}
            value={wordStorySettings.storyCount}
            onChange={(event) =>
              updateSettings({
                storyCount: Math.max(
                  1,
                  Math.min(maxStoryCount, Number(event.target.value) || 1),
                ),
              })
            }
          />
          <p className="text-xs text-muted-foreground">
            Split vocabulary across up to {maxStoryCount} stor
            {maxStoryCount === 1 ? 'y' : 'ies'}.
          </p>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="word-stories-repeat-across">
              Repeat words across stories
            </Label>
            <Switch
              id="word-stories-repeat-across"
              checked={wordStorySettings.allowRepeatAcrossStories}
              onCheckedChange={(checked) =>
                updateSettings({ allowRepeatAcrossStories: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="word-stories-repeat-within">
              Repeat words within stories
            </Label>
            <Switch
              id="word-stories-repeat-within"
              checked={wordStorySettings.allowRepeatWithinStory}
              onCheckedChange={(checked) =>
                updateSettings({ allowRepeatWithinStory: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="word-stories-definition-match">
              Include definition matching
            </Label>
            <Switch
              id="word-stories-definition-match"
              checked={wordStorySettings.includeDefinitionMatch}
              onCheckedChange={(checked) =>
                updateSettings({ includeDefinitionMatch: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="word-stories-cloze">
              Include Part 2 cloze stories
            </Label>
            <Switch
              id="word-stories-cloze"
              checked={wordStorySettings.includeClozeStories}
              onCheckedChange={(checked) =>
                updateSettings({ includeClozeStories: checked })
              }
            />
          </div>
        </div>
      </div>

      {assignments.length > 0 ? (
        <div className="rounded-md border p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Word assignments</p>
          <ul className="mt-2 space-y-1">
            {assignments.map((assignment) => {
              const clozeAssignment = clozeAssignments.find(
                (item) => item.storyIndex === assignment.storyIndex,
              )
              return (
                <li key={assignment.storyIndex}>
                  Story {assignment.storyIndex + 1}: Part 1 —{' '}
                  {assignment.words.length > 0
                    ? assignment.words.join(', ')
                    : 'No words assigned'}
                  {wordStorySettings.includeClozeStories ? (
                    <>
                      {' '}
                      | Part 2 —{' '}
                      {clozeAssignment && clozeAssignment.words.length > 0
                        ? clozeAssignment.words.join(', ')
                        : 'No words assigned'}
                    </>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      <Tabs
        value={mode}
        onValueChange={(value) => setMode(value as WorksheetMode)}
      >
        <TabsList>
          <TabsTrigger value="manual">Create your own</TabsTrigger>
          <TabsTrigger value="ai">AI generate</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="mt-4 space-y-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addManualStory}
          >
            <Plus className="size-4" />
            Add story
          </Button>

          {manualStories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add stories manually using the button above.
            </p>
          ) : (
            <div className="space-y-4">
              {manualStories.map((story) => (
                <div key={story.id} className="space-y-3 rounded-md border p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor={`manual-title-${story.id}`}>
                          Title
                        </Label>
                        <Input
                          id={`manual-title-${story.id}`}
                          value={story.title}
                          onChange={(event) =>
                            updateStory(story.id, { title: event.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`manual-story-${story.id}`}>
                          Part 1 story (use {'{{word}}'} for vocabulary words)
                        </Label>
                        <Textarea
                          id={`manual-story-${story.id}`}
                          value={story.storyText}
                          onChange={(event) =>
                            updateStory(story.id, {
                              storyText: event.target.value,
                            })
                          }
                          rows={4}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`manual-cloze-${story.id}`}>
                          Part 2 cloze story
                        </Label>
                        <Textarea
                          id={`manual-cloze-${story.id}`}
                          value={story.clozeText}
                          onChange={(event) =>
                            updateStory(story.id, {
                              clozeText: event.target.value,
                            })
                          }
                          rows={4}
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      aria-label="Remove story"
                      onClick={() => removeStory(story.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ai" className="mt-4 space-y-4">
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

          {aiStoriesByGrade.size === 0 ? (
            <p className="text-sm text-muted-foreground">
              Generate grade-level stories from your vocabulary list and
              differentiation settings.
            </p>
          ) : null}

          <CustomizeSectionCollapsible
            sectionName={WORKSHEET_LABELS['word-stories']}
            show={aiStoriesByGrade.size > 0}
          >
            {tiers.map((tier) => {
              const tierStories = aiStoriesByGrade.get(tier.gradeLevel) ?? []
              if (tierStories.length === 0) return null

              return (
                <div key={tier.id} className="space-y-4">
                  <h3 className="text-sm font-medium">
                    {wordStoriesHeading(tier.gradeLevel, tierStories.length)}
                  </h3>
                  {tierStories.map((story) => (
                    <div
                      key={story.id}
                      className="space-y-3 rounded-md border p-3"
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="space-y-1">
                            <Label htmlFor={`ai-title-${story.id}`}>
                              Title
                            </Label>
                            <Input
                              id={`ai-title-${story.id}`}
                              value={story.title}
                              onChange={(event) =>
                                updateStory(story.id, {
                                  title: event.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`ai-story-${story.id}`}>
                              Part 1 story
                            </Label>
                            <Textarea
                              id={`ai-story-${story.id}`}
                              value={story.storyText}
                              onChange={(event) =>
                                updateStory(story.id, {
                                  storyText: event.target.value,
                                })
                              }
                              rows={4}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`ai-cloze-${story.id}`}>
                              Part 2 cloze story
                            </Label>
                            <Textarea
                              id={`ai-cloze-${story.id}`}
                              value={story.clozeText}
                              onChange={(event) =>
                                updateStory(story.id, {
                                  clozeText: event.target.value,
                                })
                              }
                              rows={4}
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                          aria-label={`Regenerate story ${story.storyIndex + 1}`}
                          disabled={regeneratingId === story.id}
                          onClick={() => void handleRegenerate(story)}
                        >
                          {regeneratingId === story.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <RefreshCw className="size-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </CustomizeSectionCollapsible>
        </TabsContent>
      </Tabs>

      {wordStoryDefinitions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Definitions preview</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {wordStoryDefinitions.map((item) => (
              <li key={item.word}>
                <span className="font-medium text-foreground">
                  {item.word}:
                </span>{' '}
                {item.definition}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {info ? <p className="text-sm text-muted-foreground">{info}</p> : null}
    </>
  )
}
