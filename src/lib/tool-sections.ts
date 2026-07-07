import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  BookText,
  FileText,
  Grid3x3,
  Headphones,
  LayoutGrid,
  Pencil,
  Search,
} from 'lucide-react'

import {
  getWorksheetPath,
  WORKSHEET_DESCRIPTIONS,
  WORKSHEET_IDS_BY_LABEL,
  WORKSHEET_LABELS,
  type WorksheetId,
} from '@/lib/vocabulary-types'

export type ToolCardConfig = {
  title: string
  description: string
  to: string
  icon: LucideIcon
}

export type ToolSectionConfig = {
  title: string
  description?: string
  items: ToolCardConfig[]
}

export const WORKSHEET_ICONS: Record<WorksheetId, LucideIcon> = {
  'dictation-audio': Headphones,
  'draw-one-word': Pencil,
  'crossword-puzzle': Grid3x3,
  'word-search': Search,
  'fill-in-the-blank': FileText,
  'word-forms': LayoutGrid,
  'word-stories': BookText,
}

export const TOOL_SECTIONS: ToolSectionConfig[] = [
  {
    title: 'Vocabulary',
    description: 'Build worksheets and dictation audio from your word lists',
    items: [
      {
        title: 'All worksheets',
        description: 'Combine multiple worksheet types on one page',
        to: '/vocabulary',
        icon: BookOpen,
      },
      ...WORKSHEET_IDS_BY_LABEL.map((id) => ({
        title: WORKSHEET_LABELS[id],
        description: WORKSHEET_DESCRIPTIONS[id],
        to: getWorksheetPath(id),
        icon: WORKSHEET_ICONS[id],
      })),
    ],
  },
]
