import { useMemo } from 'react'

import { Label } from '@/components/ui/label'
import { NumberInput } from '@/components/ui/number-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  getWordsTooLongForGrid,
  sanitizeWordForSearch,
} from '@/lib/word-search-generator'
import {
  DEFAULT_WORD_SEARCH_SETTINGS,
  WORD_SEARCH_CASE_OPTIONS,
  WORD_SEARCH_MAX_SIZE,
  WORD_SEARCH_MIN_SIZE,
} from '@/lib/word-search-types'
import type { WordSearchSettings } from '@/lib/word-search-types'

type WordSearchWorksheetProps = {
  words: string[]
  settings: WordSearchSettings
  onSettingsChange: (settings: WordSearchSettings) => void
}

export function WordSearchWorksheet({
  words,
  settings,
  onSettingsChange,
}: WordSearchWorksheetProps) {
  const tooLong = useMemo(
    () => getWordsTooLongForGrid(words, settings.width, settings.height),
    [words, settings.width, settings.height],
  )

  const emptyAfterSanitize = useMemo(
    () => words.filter((word) => sanitizeWordForSearch(word).length === 0),
    [words],
  )

  function updateSettings(patch: Partial<WordSearchSettings>) {
    onSettingsChange({ ...settings, ...patch })
  }

  function updateDirection(
    key: keyof WordSearchSettings['directions'],
    value: boolean,
  ) {
    onSettingsChange({
      ...settings,
      directions: { ...settings.directions, [key]: value },
    })
  }

  function clampSize(value: number | ''): number {
    if (value === '') return DEFAULT_WORD_SEARCH_SETTINGS.width
    return Math.min(WORD_SEARCH_MAX_SIZE, Math.max(WORD_SEARCH_MIN_SIZE, value))
  }

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="word-search-width">Width (columns)</Label>
          <NumberInput
            id="word-search-width"
            value={settings.width}
            min={WORD_SEARCH_MIN_SIZE}
            max={WORD_SEARCH_MAX_SIZE}
            onValueChange={(value) =>
              updateSettings({ width: clampSize(value) })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="word-search-height">Height (rows)</Label>
          <NumberInput
            id="word-search-height"
            value={settings.height}
            min={WORD_SEARCH_MIN_SIZE}
            max={WORD_SEARCH_MAX_SIZE}
            onValueChange={(value) =>
              updateSettings({ height: clampSize(value) })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="word-search-case">Letter case</Label>
          <Select
            value={settings.letterCase}
            onValueChange={(value) =>
              updateSettings({
                letterCase: value as WordSearchSettings['letterCase'],
              })
            }
          >
            <SelectTrigger id="word-search-case" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {WORD_SEARCH_CASE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Word directions</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <Switch
              id="word-search-horizontal"
              checked={settings.directions.horizontal}
              onCheckedChange={(checked) =>
                updateDirection('horizontal', checked)
              }
            />
            <Label htmlFor="word-search-horizontal" className="font-normal">
              Horizontal
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="word-search-vertical"
              checked={settings.directions.vertical}
              onCheckedChange={(checked) =>
                updateDirection('vertical', checked)
              }
            />
            <Label htmlFor="word-search-vertical" className="font-normal">
              Vertical
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="word-search-diagonal"
              checked={settings.directions.diagonal}
              onCheckedChange={(checked) =>
                updateDirection('diagonal', checked)
              }
            />
            <Label htmlFor="word-search-diagonal" className="font-normal">
              Diagonal
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="word-search-backwards"
              checked={settings.directions.backwards}
              onCheckedChange={(checked) =>
                updateDirection('backwards', checked)
              }
            />
            <Label htmlFor="word-search-backwards" className="font-normal">
              Backwards
            </Label>
          </div>
        </div>
      </div>

      {words.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add vocabulary words above to include them in the word search.
        </p>
      ) : null}

      {tooLong.length > 0 ? (
        <p className="text-sm text-destructive">
          These words are longer than the grid and may not fit:{' '}
          {tooLong.join(', ')}. Increase width or height, or shorten the words.
        </p>
      ) : null}

      {emptyAfterSanitize.length > 0 ? (
        <p className="text-sm text-destructive">
          These entries have no letters after removing spaces and punctuation:{' '}
          {emptyAfterSanitize.join(', ')}.
        </p>
      ) : null}

      {!settings.directions.horizontal &&
      !settings.directions.vertical &&
      !settings.directions.diagonal ? (
        <p className="text-sm text-destructive">
          Enable at least one direction so words can be placed in the grid.
        </p>
      ) : null}
    </>
  )
}
