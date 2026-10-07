import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { VocabEntry } from '@/lib/vocabulary-types'

type WorksheetPlaceholderProps = {
  title: string
  entries: VocabEntry[]
}

export function WorksheetPlaceholder({
  title,
  entries,
}: WorksheetPlaceholderProps) {
  const withDefinitions = entries.filter(
    (entry) => entry.definitions.length > 0,
  ).length

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Coming soon.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            This worksheet will use your vocabulary list when it is ready.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {entries.length} word{entries.length === 1 ? '' : 's'}
            {withDefinitions > 0
              ? ` (${withDefinitions} with definition${withDefinitions === 1 ? '' : 's'})`
              : ''}
          </p>
        </CardContent>
      </Card>
    </section>
  )
}
