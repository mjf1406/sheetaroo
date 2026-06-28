import { Plus, Trash2 } from 'lucide-react'
import { useEffect } from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
  GRADE_LEVELS,
  createDefaultTier,
  createTierId,
  formatGradeLabel,
  getFirstUnusedGrade,
  getUsedGrades,
  type DifferentiationTier,
  type GradeLevel,
} from '@/lib/differentiation-types'

type DifferentiationCardProps = {
  tiers: DifferentiationTier[]
  onChange: (tiers: DifferentiationTier[]) => void
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
}

type TierRowProps = {
  tier: DifferentiationTier
  tiers: DifferentiationTier[]
  onUpdate: (id: string, patch: Partial<DifferentiationTier>) => void
  onRemove?: (id: string) => void
  showDelete?: boolean
  showCopies?: boolean
}

function TierRow({
  tier,
  tiers,
  onUpdate,
  onRemove,
  showDelete = false,
  showCopies = true,
}: TierRowProps) {
  const usedGrades = getUsedGrades(tiers, tier.id)

  return (
    <div className="flex flex-nowrap items-end gap-3 rounded-lg border p-3">
      <div className="w-20 shrink-0 space-y-2">
        <Label htmlFor={`grade-${tier.id}`}>Grade</Label>
        <Select
          value={tier.gradeLevel}
          onValueChange={(value) => onUpdate(tier.id, { gradeLevel: value as GradeLevel })}
        >
          <SelectTrigger id={`grade-${tier.id}`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            {GRADE_LEVELS.map((grade) => (
              <SelectItem key={grade} value={grade} disabled={usedGrades.has(grade)}>
                {grade}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {showCopies ? (
        <div className="shrink-0 space-y-2">
          <Label htmlFor={`copies-${tier.id}`}>Copies</Label>
          <NumberInput
            id={`copies-${tier.id}`}
            value={tier.copies}
            onValueChange={(value) => onUpdate(tier.id, { copies: value === '' ? 1 : value })}
            min={1}
            max={30}
          />
        </div>
      ) : null}
      {showDelete && onRemove ? (
        <Button
          type="button"
          variant="destructive"
          size="icon"
          aria-label={`Remove ${formatGradeLabel(tier.gradeLevel)}`}
          onClick={() => onRemove(tier.id)}
        >
          <Trash2 className="size-4" />
        </Button>
      ) : null}
    </div>
  )
}

export function DifferentiationCard({
  tiers,
  onChange,
  enabled,
  onEnabledChange,
}: DifferentiationCardProps) {
  const nextGrade = getFirstUnusedGrade(tiers)

  useEffect(() => {
    if (tiers.length === 0) {
      onChange([createDefaultTier()])
    }
  }, [tiers.length, onChange])

  function updateTier(id: string, patch: Partial<DifferentiationTier>) {
    onChange(tiers.map((tier) => (tier.id === id ? { ...tier, ...patch } : tier)))
  }

  function removeTier(id: string) {
    onChange(tiers.filter((tier) => tier.id !== id))
  }

  function addTier() {
    if (!nextGrade) return
    onChange([
      ...tiers,
      {
        id: createTierId(),
        gradeLevel: nextGrade,
        copies: 1,
      },
    ])
  }

  function handleToggle(checked: boolean) {
    onEnabledChange(checked)
    if (!checked && tiers.length > 1) {
      onChange([tiers[0]])
    }
  }

  const singleTier = tiers[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Differentiation</CardTitle>
        <CardAction>
          <Switch
            id="differentiation-enabled"
            checked={enabled}
            onCheckedChange={handleToggle}
            aria-label="Enable differentiation by grade"
          />
        </CardAction>
        <CardDescription>
          {enabled
            ? 'Add grade levels and set how many worksheet copies to include in the preview for each grade.'
            : 'Select below the one grade level to use for all worksheets. Toggle on to enable differentiation.'}        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {enabled ? (
          <>
            {tiers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add at least one grade level to differentiate worksheets.
              </p>
            ) : (
              <div className="space-y-3">
                {tiers.map((tier) => (
                  <TierRow
                    key={tier.id}
                    tier={tier}
                    tiers={tiers}
                    onUpdate={updateTier}
                    onRemove={removeTier}
                    showDelete
                  />
                ))}
              </div>
            )}

            <Button type="button" variant="outline" size="sm" onClick={addTier} disabled={!nextGrade}>
              <Plus className="size-4" />
              Add grade level
            </Button>
          </>
        ) : singleTier ? (
          <TierRow tier={singleTier} tiers={tiers} onUpdate={updateTier} showCopies={false} />
        ) : null}
      </CardContent>
    </Card>
  )
}
