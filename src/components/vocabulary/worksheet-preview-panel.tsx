import { Download, Shuffle } from 'lucide-react'
import { useState } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
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
  type PreviewableWorksheetId,
} from '@/lib/worksheet-preview'
import { downloadWorksheetPdf } from '@/lib/worksheet-print'
import type { WorksheetId } from '@/lib/vocabulary-types'
import type { ShuffleSeeds } from '@/lib/word-order'

type WorksheetPreviewPanelProps = {
  title: string
  orderedWordsByWorksheet: Record<PreviewableWorksheetId, string[]>
  checked: Record<WorksheetId, boolean>
  worksheetOrder: WorksheetId[]
  tiers: DifferentiationTier[]
  differentiationEnabled: boolean
  sentences: FillInBlankSentence[]
  pageSize: PageSize
  onPageSizeChange: (pageSize: PageSize) => void
  fillInBlankWordBank: boolean
  onShuffleApply: () => void
  needsShuffleAudioWarning: boolean
  dictationAudioVoiceSource: 'ai' | 'own' | null
  shuffleSeeds: ShuffleSeeds
  wordCount: number
  embedded?: boolean
  className?: string
}

export function WorksheetPreviewPanel({
  title,
  orderedWordsByWorksheet,
  checked,
  worksheetOrder,
  tiers,
  differentiationEnabled,
  sentences,
  pageSize,
  onPageSizeChange,
  fillInBlankWordBank,
  onShuffleApply,
  needsShuffleAudioWarning,
  dictationAudioVoiceSource,
  shuffleSeeds,
  wordCount,
  embedded = false,
  className,
}: WorksheetPreviewPanelProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportError, setExportError] = useState<string | null>(null)
  const [shuffleDialogOpen, setShuffleDialogOpen] = useState(false)

  const previewableSections = getOrderedPreviewableWorksheets(
    worksheetOrder,
    checked,
  )
  const displayTitle = defaultWorksheetTitle(title)
  const canPreview = previewableSections.length > 0 && wordCount > 0

  async function handleDownloadPdf() {
    setIsExporting(true)
    setExportProgress(0)
    setExportError(null)
    try {
      await downloadWorksheetPdf(displayTitle, pageSize, setExportProgress)
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : 'Failed to generate PDF',
      )
    } finally {
      setIsExporting(false)
      setExportProgress(0)
    }
  }

  function handleShuffleClick() {
    if (needsShuffleAudioWarning) {
      setShuffleDialogOpen(true)
      return
    }
    onShuffleApply()
  }

  function handleShuffleConfirm() {
    setShuffleDialogOpen(false)
    onShuffleApply()
  }

  const toolbar = (
    <div className="worksheet-preview-toolbar flex flex-wrap items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="worksheet-page-size">Page size</Label>
        <Select
          value={pageSize}
          disabled={isExporting}
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
      {isExporting ? (
        <div className="flex h-7 min-w-36 flex-col justify-center gap-1">
          <Progress value={exportProgress} className="h-1.5" />
          <span className="text-xs text-muted-foreground">
            {exportProgress >= 95 && exportProgress < 100
              ? 'Finalizing PDF…'
              : `Generating PDF… ${exportProgress}%`}
          </span>
        </div>
      ) : (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canPreview}
            onClick={handleShuffleClick}
          >
            <Shuffle className="size-4" />
            Shuffle order
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canPreview}
            onClick={() => void handleDownloadPdf()}
          >
            <Download className="size-4" />
            Download PDF
          </Button>
        </>
      )}
      {exportError ? (
        <p className="text-xs text-destructive">{exportError}</p>
      ) : null}
    </div>
  )

  const previewContent = (
    <div className="overflow-x-hidden overflow-y-auto rounded-lg border bg-muted/30 p-3">
      {previewableSections.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Select Dictation or Fill-in-the-Blank to preview.
        </p>
      ) : wordCount === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Add words to preview your worksheet.
        </p>
      ) : (
        <WorksheetPreviewScaler
          measureKey={`${pageSize}:${JSON.stringify(shuffleSeeds)}:${wordCount}:${sentences.length}:${fillInBlankWordBank}:${worksheetOrder.join(',')}:${JSON.stringify(checked)}:${differentiationEnabled}:${JSON.stringify(tiers)}`}
        >
          <PrintableWorksheet
            title={title}
            orderedWordsByWorksheet={orderedWordsByWorksheet}
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

  const shuffleDialog = (
    <AlertDialog open={shuffleDialogOpen} onOpenChange={setShuffleDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Regenerate dictation audio?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-left text-sm text-muted-foreground">
              <p>
                Word order will change. Existing audio will no longer match the
                worksheet, and you will need to regenerate dictation audio.
              </p>
              {dictationAudioVoiceSource === 'ai' ? (
                <p>Regenerating uses additional ElevenLabs API credits.</p>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleShuffleConfirm}>
            Shuffle anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  if (embedded) {
    return (
      <div className={className}>
        {toolbar}
        <div className="mt-4 max-h-[calc(100vh-14rem)]">{previewContent}</div>
        {shuffleDialog}
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
      {shuffleDialog}
    </Card>
  )
}
