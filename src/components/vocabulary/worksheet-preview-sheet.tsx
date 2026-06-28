import { Eye } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { WorksheetPreviewPanel } from '@/components/vocabulary/worksheet-preview-panel'
import type { DifferentiationTier } from '@/lib/differentiation-types'
import type { FillInBlankSentence } from '@/lib/fill-in-blank-types'
import type { PageSize } from '@/lib/worksheet-preview'
import type { WorksheetId } from '@/lib/vocabulary-types'

type WorksheetPreviewSheetProps = {
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
}

export function WorksheetPreviewSheet({
  pageSize,
  onPageSizeChange,
  ...props
}: WorksheetPreviewSheetProps) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          className="fixed right-4 bottom-4 z-40 shadow-lg print:hidden xl:hidden"
          size="lg"
        >
          <Eye className="size-4" />
          Preview worksheet
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-2xl"
      >
        <SheetHeader>
          <SheetTitle>Worksheet preview</SheetTitle>
          <SheetDescription>
            Preview or download your worksheet.
          </SheetDescription>
        </SheetHeader>
        <WorksheetPreviewPanel
          {...props}
          pageSize={pageSize}
          onPageSizeChange={onPageSizeChange}
          embedded
        />
      </SheetContent>
    </Sheet>
  )
}
