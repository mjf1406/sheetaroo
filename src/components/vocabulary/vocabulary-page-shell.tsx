import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { DifferentiationCard } from '@/components/vocabulary/differentiation-card'
import { PrintableWorksheet } from '@/components/vocabulary/printable-worksheet'
import { useVocabularyBuilder } from '@/components/vocabulary/vocabulary-builder-context'
import { BUILDER_COMPONENTS } from '@/components/vocabulary/vocabulary-builders'
import { VocabularyWordInput } from '@/components/vocabulary/vocabulary-word-input'
import { WorksheetCard } from '@/components/vocabulary/worksheet-card'
import { WorksheetChecklist } from '@/components/vocabulary/worksheet-checklist'
import { WorksheetPreviewPanel } from '@/components/vocabulary/worksheet-preview-panel'
import { WorksheetPreviewSheet } from '@/components/vocabulary/worksheet-preview-sheet'
import {
  DEFAULT_WORKSHEET_ORDER,
  getOrderedBuilderWorksheets,
} from '@/lib/worksheet-preview'
import {
  WORKSHEET_IDS,
  WORKSHEET_LABELS,
  worksheetSelectionFromView,
} from '@/lib/vocabulary-types'
import type { WorksheetId } from '@/lib/vocabulary-types'

type VocabularyPageShellProps = {
  mode: 'combined' | WorksheetId
}

export function VocabularyPageShell({ mode }: VocabularyPageShellProps) {
  const {
    rows,
    setRows,
    worksheetTitle,
    setWorksheetTitle,
    entries,
    tiers,
    setTiers,
    differentiationEnabled,
    setDifferentiationEnabled,
    builderProps,
    getPrintableProps,
    getPreviewProps,
  } = useVocabularyBuilder()

  const [checked, setChecked] = useState(() =>
    mode === 'combined'
      ? worksheetSelectionFromView('all')
      : worksheetSelectionFromView(mode),
  )
  const [worksheetOrder, setWorksheetOrder] = useState<WorksheetId[]>(
    DEFAULT_WORKSHEET_ORDER,
  )

  const effectiveChecked = useMemo(() => {
    if (mode === 'combined') return checked
    return Object.fromEntries(
      WORKSHEET_IDS.map((id) => [id, id === mode]),
    ) as Record<WorksheetId, boolean>
  }, [mode, checked])

  const orderedBuilders = useMemo(
    () => getOrderedBuilderWorksheets(worksheetOrder, effectiveChecked),
    [worksheetOrder, effectiveChecked],
  )

  const printableProps = getPrintableProps(effectiveChecked, worksheetOrder)
  const previewProps = getPreviewProps(effectiveChecked, worksheetOrder)

  function handleCheckedChange(id: WorksheetId, value: boolean) {
    setChecked((current) => ({ ...current, [id]: value }))
  }

  const isCombined = mode === 'combined'
  const title = isCombined ? 'Vocabulary' : WORKSHEET_LABELS[mode]
  const description = isCombined
    ? 'Enter words and definitions, choose worksheets, and generate materials for your students.'
    : `Build ${WORKSHEET_LABELS[mode].toLowerCase()} worksheets from your word list.`

  return (
    <>
      <div className="mx-auto max-w-screen-2xl space-y-8 px-8 py-8 print:hidden">
        <header>
          <h1 className="text-4xl font-bold">{title}</h1>
          <p className="mt-2 text-muted-foreground">{description}</p>
          {!isCombined ? (
            <p className="mt-2 text-sm">
              <Link
                to="/vocabulary"
                className="text-primary underline-offset-4 hover:underline"
              >
                Combine with other worksheets
              </Link>
            </p>
          ) : null}
        </header>

        <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_min(480px,38%)] xl:items-start xl:gap-10">
          <div className="vocabulary-builder min-w-0 space-y-8">
            <div
              className={
                isCombined
                  ? 'grid gap-6 lg:grid-cols-3'
                  : 'grid gap-6 lg:grid-cols-2'
              }
            >
              <VocabularyWordInput
                rows={rows}
                onRowsChange={setRows}
                title={worksheetTitle}
                onTitleChange={setWorksheetTitle}
                entries={entries}
              />
              {isCombined ? (
                <WorksheetChecklist
                  checked={checked}
                  order={worksheetOrder}
                  onCheckedChange={handleCheckedChange}
                  onOrderChange={setWorksheetOrder}
                />
              ) : null}
              <DifferentiationCard
                tiers={tiers}
                onChange={setTiers}
                enabled={differentiationEnabled}
                onEnabledChange={setDifferentiationEnabled}
              />
            </div>

            <div className="space-y-6">
              {orderedBuilders.map((id) => (
                <WorksheetCard key={id} id={id}>
                  {BUILDER_COMPONENTS[id](builderProps)}
                </WorksheetCard>
              ))}
            </div>
          </div>

          <div className="worksheet-preview-sidebar hidden min-w-0 xl:block">
            <WorksheetPreviewPanel {...previewProps} className="sticky top-8" />
          </div>
        </div>

        <WorksheetPreviewSheet {...previewProps} />
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-50 overflow-hidden opacity-0"
      >
        <PrintableWorksheet {...printableProps} isPrintRoot />
      </div>
    </>
  )
}
