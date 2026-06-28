import { snapdom } from '@zumer/snapdom'
import { jsPDF } from 'jspdf'

import { type PageSize, sanitizeFilename } from '@/lib/worksheet-preview'

function getPrintRoot(): HTMLElement | null {
  return document.getElementById('worksheet-print-root')
}

function getPageElements(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      '.worksheet-page, .answer-key-section',
    ),
  )
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

export async function downloadWorksheetPdf(
  title: string,
  pageSize: PageSize,
  onProgress?: (progress: number) => void,
): Promise<void> {
  const root = getPrintRoot()
  if (!root) return

  const pages = getPageElements(root)
  if (pages.length === 0) return

  onProgress?.(0)

  await document.fonts.ready

  const pdf = new jsPDF({
    unit: 'in',
    format: pageSize,
    orientation: 'portrait',
  })
  const pageWidth = pdf.internal.pageSize.getWidth()

  for (let index = 0; index < pages.length; index++) {
    const canvas = await snapdom.toCanvas(pages[index], {
      scale: 2,
      backgroundColor: '#ffffff',
      embedFonts: true,
    })
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    const imageHeight = (pageWidth * canvas.height) / canvas.width

    canvas.width = 0
    canvas.height = 0

    if (index > 0) {
      pdf.addPage()
    }

    pdf.addImage(dataUrl, 'JPEG', 0, 0, pageWidth, imageHeight)
    onProgress?.(
      Math.round(((index + 1) / pages.length) * 95),
    )

    await yieldToEventLoop()
  }

  onProgress?.(95)
  pdf.save(`${sanitizeFilename(title)}.pdf`)
  onProgress?.(100)
}
