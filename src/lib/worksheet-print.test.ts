// @vitest-environment jsdom

import { describe, expect, it } from 'vite-plus/test'

import { buildPrintUnits, packSectionsByHeight } from '@/lib/worksheet-print'

describe('packSectionsByHeight', () => {
  it('packs sections that fit within the body budget', () => {
    const buckets = packSectionsByHeight([100, 120, 80], 250, 10)
    expect(buckets).toEqual([[0, 1], [2]])
  })

  it('isolates oversized sections in their own bucket', () => {
    const buckets = packSectionsByHeight([100, 500, 80], 250, 10)
    expect(buckets).toEqual([[0], [1], [2]])
  })

  it('returns empty array when there are no sections', () => {
    expect(packSectionsByHeight([], 250, 10)).toEqual([])
  })
})

describe('buildPrintUnits', () => {
  it('subdivides sections with multiple worksheet-pdf-unit children', () => {
    const section = document.createElement('div')
    section.className = 'worksheet-section'
    section.setAttribute('data-section-id', 'word-stories-cloze')

    const prefix = document.createElement('div')
    prefix.className = 'worksheet-section-prefix'
    prefix.textContent = 'Part 2: Cloze Stories'
    section.appendChild(prefix)

    const article1 = document.createElement('article')
    article1.className = 'worksheet-pdf-unit'
    article1.textContent = 'Story 1'
    const article2 = document.createElement('article')
    article2.className = 'worksheet-pdf-unit'
    article2.textContent = 'Story 2'
    section.appendChild(article1)
    section.appendChild(article2)
    document.body.appendChild(section)

    Object.defineProperty(prefix, 'offsetHeight', {
      configurable: true,
      value: 40,
    })
    Object.defineProperty(article1, 'offsetHeight', {
      configurable: true,
      value: 300,
    })
    Object.defineProperty(article2, 'offsetHeight', {
      configurable: true,
      value: 300,
    })

    const units = buildPrintUnits([section], 250)

    expect(units).toHaveLength(2)
    const first = units[0]
    const second = units[1]
    if (!first || !second) {
      throw new Error('expected two print units')
    }
    if (first.kind !== 'units' || second.kind !== 'units') {
      throw new Error('expected both print units to be of kind "units"')
    }
    expect(first.prefix).toBeTruthy()
    expect(second.prefix).toBeUndefined()
    expect(first.units).toHaveLength(1)
    expect(second.units).toHaveLength(1)
  })

  it('treats sections without pdf units as full sections', () => {
    const section = document.createElement('div')
    section.className = 'worksheet-section'
    section.textContent = 'Monolithic content'
    Object.defineProperty(section, 'offsetHeight', {
      configurable: true,
      value: 400,
    })

    const units = buildPrintUnits([section], 250)

    expect(units).toHaveLength(1)
    expect(units[0]?.kind).toBe('full')
  })
})
