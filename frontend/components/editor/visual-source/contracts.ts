import type { InlineFormat, InsertKind, SourceDialogRequest } from '@/lib/visual-source/types'

export interface VisualToolbarProps {
  formats: InlineFormat[]
  heading: number
  list: 'ordered' | 'unordered' | null
  canUndo: boolean
  canRedo: boolean
  disabled?: boolean
  onFormat: (format: InlineFormat) => void
  onHeading: (level: number) => void
  onList: (ordered: boolean) => void
  onInsert: (kind: InsertKind) => void
  onUndo: () => void
  onRedo: () => void
  onFind: () => void
}

export interface InsertDialogProps {
  request: SourceDialogRequest | null
  onApply: (latex: string) => void
  onClose: () => void
}
