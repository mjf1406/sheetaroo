import { snapdom } from '@zumer/snapdom'
import { jsPDF } from 'jspdf'

import { type PageSize, sanitizeFilename } from '@/lib/worksheet-preview'
import { WORKSHEET_LABELS } from '@/lib/vocabulary-types'

const EXPORT_SCALE = 2
const SECTION_GAP_PX = 32
const PDF_UNIT_GAP_PX = 12
const PREFIX_LIST_GAP_PX = 12

const CONTINUED_SECTION_LABELS: Record<string, string> = {
  'word-forms': WORKSHEET_LABELS['word-forms'],
  'word-stories-part-1': WORKSHEET_LABELS['word-stories'],
  'word-stories-definitions': 'Part 1B: Definition Match',
  'word-stories-cloze': 'Part 2: Cloze Stories',
  'answer-word-stories-part-1': `${WORKSHEET_LABELS['word-stories']} — Answers`,
  'answer-word-stories-definitions': 'Part 1B: Definition Match — Answers',
  'answer-word-stories-cloze': 'Part 2: Cloze Stories — Answers',
}

function getContinuedSectionLabel(sectionId: string): string | null {
  return CONTINUED_SECTION_LABELS[sectionId] ?? null
}

const PDF_PAGE_MARGIN_IN = {
  top: 0.35,
  right: 0.45,
  bottom: 0.5,
  left: 0.45,
} as const

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

function waitForLayout(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

function pageHeightPx(pageSize: PageSize): number {
  if (pageSize === 'letter') {
    return 11 * 96
  }
  return 297 * (96 / 25.4)
}

function pageMarginsPx(): { top: number; right: number; bottom: number; left: number } {
  const dpi = 96
  return {
    top: PDF_PAGE_MARGIN_IN.top * dpi,
    right: PDF_PAGE_MARGIN_IN.right * dpi,
    bottom: PDF_PAGE_MARGIN_IN.bottom * dpi,
    left: PDF_PAGE_MARGIN_IN.left * dpi,
  }
}

function getVerticalPadding(element: HTMLElement): number {
  const style = getComputedStyle(element)
  return parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
}

export function packSectionsByHeight(
  sectionHeights: readonly number[],
  bodyBudget: number,
  sectionGap: number,
): number[][] {
  const buckets: number[][] = []
  let current: number[] = []
  let currentHeight = 0

  for (let index = 0; index < sectionHeights.length; index++) {
    const height = sectionHeights[index]!

    if (height > bodyBudget) {
      if (current.length > 0) {
        buckets.push(current)
        current = []
        currentHeight = 0
      }
      buckets.push([index])
      continue
    }

    const gap = current.length > 0 ? sectionGap : 0
    if (currentHeight + gap + height > bodyBudget && current.length > 0) {
      buckets.push(current)
      current = [index]
      currentHeight = height
    } else {
      current.push(index)
      currentHeight += gap + height
    }
  }

  if (current.length > 0) {
    buckets.push(current)
  }

  return buckets
}

function addCanvasToPdf(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  dataUrl: string,
  pageWidth: number,
  pageHeight: number,
  addPageFirst: boolean,
): number {
  const contentWidth = pageWidth - PDF_PAGE_MARGIN_IN.left - PDF_PAGE_MARGIN_IN.right
  const contentHeight =
    pageHeight - PDF_PAGE_MARGIN_IN.top - PDF_PAGE_MARGIN_IN.bottom
  const imageHeight = (contentWidth * canvas.height) / canvas.width

  if (imageHeight <= contentHeight) {
    if (addPageFirst) {
      pdf.addPage()
    }
    pdf.addImage(
      dataUrl,
      'JPEG',
      PDF_PAGE_MARGIN_IN.left,
      PDF_PAGE_MARGIN_IN.top,
      contentWidth,
      imageHeight,
    )
    return 1
  }

  let heightLeft = imageHeight
  let position = 0
  let pagesAdded = 0

  while (heightLeft > 0) {
    if (addPageFirst || pagesAdded > 0) {
      pdf.addPage()
    }
    pdf.addImage(
      dataUrl,
      'JPEG',
      PDF_PAGE_MARGIN_IN.left,
      PDF_PAGE_MARGIN_IN.top + position,
      contentWidth,
      imageHeight,
    )
    heightLeft -= contentHeight
    position -= contentHeight
    pagesAdded++
  }

  return pagesAdded
}

type PaginatedExportConfig = {
  sourcePage: HTMLElement
  headerSelector: string
  bodySelector: string | null
  sectionSelector: string
  footerSelector: string
  pageSize: PageSize
}

type PrintUnit =
  | { kind: 'full'; section: HTMLElement; height: number }
  | {
      kind: 'units'
      section: HTMLElement
      units: HTMLElement[]
      height: number
      prefix?: HTMLElement
    }

function getSectionPrefix(section: HTMLElement): HTMLElement | null {
  return section.querySelector<HTMLElement>(':scope .worksheet-section-prefix')
}

export function buildPrintUnits(
  sections: HTMLElement[],
  bodyBudget: number,
): PrintUnit[] {
  const printUnits: PrintUnit[] = []

  for (const section of sections) {
    const pdfUnits = Array.from(
      section.querySelectorAll<HTMLElement>(':scope .worksheet-pdf-unit'),
    )

    if (pdfUnits.length === 0) {
      printUnits.push({
        kind: 'full',
        section,
        height: section.offsetHeight,
      })
      continue
    }

    const prefix = getSectionPrefix(section)
    const prefixHeight = prefix
      ? prefix.offsetHeight + PREFIX_LIST_GAP_PX
      : 0

    let group: HTMLElement[] = []
    let groupHeight = 0
    let isFirstGroup = true

    const flushGroup = () => {
      if (group.length === 0) return

      const includePrefix = isFirstGroup && prefix !== null
      printUnits.push({
        kind: 'units',
        section,
        units: group,
        height: (includePrefix ? prefixHeight : 0) + groupHeight,
        prefix: includePrefix ? prefix : undefined,
      })
      isFirstGroup = false
      group = []
      groupHeight = 0
    }

    for (const unit of pdfUnits) {
      const unitHeight = unit.offsetHeight
      const gap = group.length > 0 ? PDF_UNIT_GAP_PX : 0
      const budget =
        isFirstGroup && prefix ? bodyBudget - prefixHeight : bodyBudget

      if (group.length > 0 && groupHeight + gap + unitHeight > budget) {
        flushGroup()
        group = [unit]
        groupHeight = unitHeight
      } else {
        group.push(unit)
        groupHeight += gap + unitHeight
      }
    }

    flushGroup()
  }

  return printUnits
}

function renderPrintUnit(
  unit: PrintUnit,
  isFirstInBucket: boolean,
): HTMLElement {
  if (unit.kind === 'full') {
    return unit.section.cloneNode(true) as HTMLElement
  }

  const wrapper = document.createElement('div')
  wrapper.className = unit.section.className
  wrapper.setAttribute(
    'data-section-id',
    unit.section.getAttribute('data-section-id') ?? '',
  )

  const inner = document.createElement('section')
  inner.className = 'space-y-3'

  if (unit.prefix) {
    inner.appendChild(unit.prefix.cloneNode(true))
  }

  const firstNumber = Number(
    unit.units[0]?.getAttribute('data-sentence-number') ?? '1',
  )
  const sectionId = unit.section.getAttribute('data-section-id') ?? ''
  const continuedLabel = getContinuedSectionLabel(sectionId)
  const isListUnit = unit.units[0]?.tagName === 'LI'
  const shouldShowContinued =
    !unit.prefix &&
    isFirstInBucket &&
    continuedLabel !== null &&
    (firstNumber > 1 || !isListUnit)

  if (shouldShowContinued) {
    const heading = document.createElement('h2')
    heading.className = 'text-sm font-semibold'
    heading.textContent = `${continuedLabel} (continued)`
    inner.appendChild(heading)
  }

  const useListLayout = unit.units.every((pdfUnit) => pdfUnit.tagName === 'LI')
  if (useListLayout) {
    const list = document.createElement('ol')
    list.className = 'space-y-3'
    for (const pdfUnit of unit.units) {
      list.appendChild(pdfUnit.cloneNode(true))
    }
    inner.appendChild(list)
  } else {
    const container = document.createElement('div')
    container.className = 'space-y-4'
    for (const pdfUnit of unit.units) {
      container.appendChild(pdfUnit.cloneNode(true))
    }
    inner.appendChild(container)
  }
  wrapper.appendChild(inner)
  return wrapper
}

async function captureElementToPdf(
  element: HTMLElement,
  pdf: jsPDF,
  pageWidth: number,
  pageHeight: number,
  addPageFirst: boolean,
): Promise<number> {
  const canvas = await snapdom.toCanvas(element, {
    scale: EXPORT_SCALE,
    backgroundColor: '#ffffff',
    embedFonts: true,
  })
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
  const pagesAdded = addCanvasToPdf(
    pdf,
    canvas,
    dataUrl,
    pageWidth,
    pageHeight,
    addPageFirst,
  )
  canvas.width = 0
  canvas.height = 0
  return pagesAdded
}

function createStagingContainer(printRoot: HTMLElement): HTMLElement {
  const staging = document.createElement('div')
  staging.setAttribute('aria-hidden', 'true')
  staging.style.position = 'fixed'
  staging.style.left = '0'
  staging.style.top = '0'
  staging.style.visibility = 'hidden'
  staging.style.pointerEvents = 'none'
  staging.style.zIndex = '-1'
  staging.style.overflow = 'hidden'
  printRoot.appendChild(staging)
  return staging
}

async function exportPaginatedSource(
  config: PaginatedExportConfig,
  pdf: jsPDF,
  pageWidth: number,
  pageHeight: number,
  pdfPageCount: number,
  staging: HTMLElement,
): Promise<number> {
  const { sourcePage, headerSelector, bodySelector, sectionSelector, footerSelector } =
    config

  const header = sourcePage.querySelector<HTMLElement>(headerSelector)
  const footer = sourcePage.querySelector<HTMLElement>(footerSelector)
  const bodyRoot = bodySelector
    ? sourcePage.querySelector<HTMLElement>(bodySelector)
    : sourcePage
  const sections = bodyRoot
    ? Array.from(bodyRoot.querySelectorAll<HTMLElement>(sectionSelector))
    : []

  if (sections.length === 0) {
    return captureElementToPdf(
      sourcePage,
      pdf,
      pageWidth,
      pageHeight,
      pdfPageCount > 0,
    )
  }

  const pageWidthPx = sourcePage.offsetWidth
  const totalPageHeightPx = pageHeightPx(config.pageSize)
  const marginsPx = pageMarginsPx()
  const paddingY = getVerticalPadding(sourcePage)
  const headerHeight = header?.offsetHeight ?? 0
  const headerStyle = header ? getComputedStyle(header) : null
  const headerMarginBottom = headerStyle
    ? parseFloat(headerStyle.marginBottom)
    : 0
  const footerHeight = footer?.offsetHeight ?? 0
  const footerStyle = footer ? getComputedStyle(footer) : null
  const footerMarginTop = footerStyle ? parseFloat(footerStyle.marginTop) : 0
  const bodyBudget =
    totalPageHeightPx -
    paddingY -
    headerHeight -
    headerMarginBottom -
    footerHeight -
    footerMarginTop -
    marginsPx.top -
    marginsPx.bottom

  const printUnits = buildPrintUnits(sections, bodyBudget)
  const unitHeights = printUnits.map((unit) => unit.height)
  const buckets = packSectionsByHeight(unitHeights, bodyBudget, SECTION_GAP_PX)

  let pagesAdded = 0

  for (const bucket of buckets) {
    const pageEl = document.createElement('div')
    pageEl.className = sourcePage.className
    pageEl.style.width = `${pageWidthPx}px`
    pageEl.style.minHeight = `${totalPageHeightPx}px`
    pageEl.style.background = '#ffffff'
    pageEl.style.boxSizing = 'border-box'
    pageEl.style.visibility = 'visible'

    if (header) {
      pageEl.appendChild(header.cloneNode(true))
    }

    const bodyEl = document.createElement('div')
    bodyEl.className = `${bodyRoot?.className ?? 'worksheet-page-body'} flex-1 min-h-0`

    const bodyWrapper = document.createElement('div')
    bodyWrapper.className = 'space-y-8'
    for (let bucketIndex = 0; bucketIndex < bucket.length; bucketIndex++) {
      const unit = printUnits[bucket[bucketIndex]!]!
      bodyWrapper.appendChild(
        renderPrintUnit(unit, bucketIndex === 0),
      )
    }
    bodyEl.appendChild(bodyWrapper)
    pageEl.appendChild(bodyEl)

    if (footer) {
      const footerClone = footer.cloneNode(true) as HTMLElement
      footerClone.classList.add('mt-auto', 'shrink-0')
      pageEl.appendChild(footerClone)
    }

    staging.appendChild(pageEl)
    await document.fonts.ready
    await waitForLayout()

    pagesAdded += await captureElementToPdf(
      pageEl,
      pdf,
      pageWidth,
      pageHeight,
      pdfPageCount + pagesAdded > 0,
    )
    staging.removeChild(pageEl)
    await yieldToEventLoop()
  }

  return pagesAdded
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
  const pageHeight = pdf.internal.pageSize.getHeight()

  const staging = createStagingContainer(root)

  let pdfPageCount = 0

  try {
    for (let index = 0; index < pages.length; index++) {
      const sourcePage = pages[index]!
      const isAnswerKey = sourcePage.classList.contains('answer-key-section')

      const pagesAdded = await exportPaginatedSource(
        {
          sourcePage,
          headerSelector: isAnswerKey
            ? '.answer-key-header'
            : '.worksheet-page-header',
          bodySelector: isAnswerKey ? '.answer-key-body' : '.worksheet-page-body',
          sectionSelector: '.worksheet-section',
          footerSelector: '.worksheet-page-footer',
          pageSize,
        },
        pdf,
        pageWidth,
        pageHeight,
        pdfPageCount,
        staging,
      )
      pdfPageCount += pagesAdded

      onProgress?.(Math.round(((index + 1) / pages.length) * 95))
      await yieldToEventLoop()
    }
  } finally {
    root.removeChild(staging)
  }

  onProgress?.(95)
  pdf.save(`${sanitizeFilename(title)}.pdf`)
  onProgress?.(100)
}
