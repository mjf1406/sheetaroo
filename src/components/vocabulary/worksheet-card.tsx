import type { ReactNode } from 'react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { WORKSHEET_ICONS } from '@/lib/tool-sections'
import {
  WORKSHEET_DESCRIPTIONS,
  WORKSHEET_LABELS,
} from '@/lib/vocabulary-types'
import type { WorksheetId } from '@/lib/vocabulary-types'

type WorksheetCardProps = {
  id: WorksheetId
  children: ReactNode
}

export function WorksheetCard({ id, children }: WorksheetCardProps) {
  const Icon = WORKSHEET_ICONS[id]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 space-y-1">
            <CardTitle>{WORKSHEET_LABELS[id]}</CardTitle>
            <CardDescription>{WORKSHEET_DESCRIPTIONS[id]}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">{children}</CardContent>
    </Card>
  )
}
