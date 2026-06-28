import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SAMPLE_VOCABULARY } from '@/lib/vocabulary-sample'
import type { VocabEntry } from '@/lib/vocabulary-types'

function appendLines(current: string, lines: string[]) {
  const block = lines.join('\n')
  const trimmed = current.trimEnd()
  return trimmed ? `${trimmed}\n${block}` : block
}

type VocabularyWordInputProps = {
  value: string
  onChange: (value: string) => void
  title: string
  onTitleChange: (title: string) => void
  entries: VocabEntry[]
}

export function VocabularyWordInput({
  value,
  onChange,
  title,
  onTitleChange,
  entries,
}: VocabularyWordInputProps) {
  const withDefinitions = entries.filter((entry) => entry.definition).length

  function addSampleWords() {
    onChange(
      appendLines(
        value,
        SAMPLE_VOCABULARY.map((entry) => entry.word),
      ),
    )
  }

  function addSampleWordsWithDefinitions() {
    onChange(
      appendLines(
        value,
        SAMPLE_VOCABULARY.map((entry) => `${entry.word}: ${entry.definition}`),
      ),
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Word list</CardTitle>
        <CardDescription>
          One entry per line. Add a definition after a colon, or enter a word only.
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
        <div className="space-y-2">
          <Label htmlFor="vocabulary-text">Words</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSampleWords}
            >
              Add sample words
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSampleWordsWithDefinitions}
            >
              Add sample words & definitions
            </Button>
          </div>
          <Textarea
            id="vocabulary-text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={
              'compare: to examine likenesses\nculture: shared beliefs and practices\nidentity'
            }
            rows={8}
            className="min-h-48 font-mono text-sm"
          />
        </div>
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
