import { Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PrintableWorksheet } from '@/components/vocabulary/printable-worksheet'
import { WorksheetPreviewScaler } from '@/components/vocabulary/worksheet-preview-scaler'
import type { DifferentiationTier } from '@/lib/differentiation-types'
import type { FillInBlankSentence } from '@/lib/fill-in-blank-types'
import {
  PAGE_SIZE_OPTIONS,
  defaultWorksheetTitle,
  getOrderedPreviewableWorksheets,
  type PageSize,
} from '@/lib/worksheet-preview'
import { downloadWorksheetPdf } from '@/lib/worksheet-print'
import type { WorksheetId } from '@/lib/vocabulary-types'

type WorksheetPreviewPanelProps = {
  title: string
  words: string[]
  checked: Record<WorksheetId, boolean>
  worksheetOrder: WorksheetId[]
  tiers: DifferentiationTier[]
  differentiationEnabled: boolean
  sentences: FillInBlankSentence[]
  pageSize: PageSize
  onPageSizeChange: (pageSize: PageSize) => void
  fillInBlankWordBank: boolean
  embedded?: boolean
  className?: string
}

export function WorksheetPreviewPanel({
  title,
  words,
  checked,
  worksheetOrder,
  tiers,
  differentiationEnabled,
  sentences,
  pageSize,
  onPageSizeChange,
  fillInBlankWordBank,
  embedded = false,
  className,
}: WorksheetPreviewPanelProps) {
  const previewableSections = getOrderedPreviewableWorksheets(
    worksheetOrder,
    checked,
  )
  const displayTitle = defaultWorksheetTitle(title)
  const canPreview = previewableSections.length > 0 && words.length > 0

  const toolbar = (
    <div className="worksheet-preview-toolbar space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="worksheet-page-size">Page size</Label>
          <Select
            value={pageSize}
            onValueChange={(value) => onPageSizeChange(value as PageSize)}
          >
            <SelectTrigger id="worksheet-page-size" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {PAGE_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canPreview}
          onClick={() => void downloadWorksheetPdf(displayTitle, pageSize)}
        >
          <Download className="size-4" />
          Download PDF
        </Button>
      </div>
    </div>
  )

  const previewContent = (
    <div className="overflow-x-hidden overflow-y-auto rounded-lg border bg-muted/30 p-3">
      {previewableSections.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Select Dictation or Fill-in-the-Blank to preview.
        </p>
      ) : words.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Add words to preview your worksheet.
        </p>
      ) : (
        <WorksheetPreviewScaler
          measureKey={`${pageSize}:${words.join('|')}:${sentences.length}:${fillInBlankWordBank}:${worksheetOrder.join(',')}:${JSON.stringify(checked)}`}
        >
          <PrintableWorksheet
            title={title}
            words={words}
            checked={checked}
            worksheetOrder={worksheetOrder}
            tiers={tiers}
            differentiationEnabled={differentiationEnabled}
            sentences={sentences}
            pageSize={pageSize}
            fillInBlankWordBank={fillInBlankWordBank}
          />
        </WorksheetPreviewScaler>
      )}
    </div>
  )

  if (embedded) {
    return (
      <div className={className}>
        {toolbar}
        <div className="mt-4 max-h-[calc(100vh-14rem)]">{previewContent}</div>
      </div>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle>Preview</CardTitle>
        <CardDescription>
          Live preview of your printable worksheet.
        </CardDescription>
        <div className="pt-2">{toolbar}</div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[calc(100vh-12rem)]">{previewContent}</div>
      </CardContent>
    </Card>
  )
}
