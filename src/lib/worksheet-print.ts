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

export async function downloadWorksheetPdf(
  title: string,
  pageSize: PageSize,
): Promise<void> {
  const root = getPrintRoot()
  if (!root) return

  const pages = getPageElements(root)
  if (pages.length === 0) return

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
    })
    const dataUrl = canvas.toDataURL('image/png')
    const imageHeight = (pageWidth * canvas.height) / canvas.width

    if (index > 0) {
      pdf.addPage()
    }

    pdf.addImage(dataUrl, 'PNG', 0, 0, pageWidth, imageHeight)
  }

  pdf.save(`${sanitizeFilename(title)}.pdf`)
}
