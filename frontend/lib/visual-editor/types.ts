import type { LucideIcon } from "lucide-react"

export type BlockType =
  | "paragraph"
  | "section"
  | "math"
  | "list"
  | "figure"
  | "table"
  | "code"

export interface VisualBlock<T = unknown> {
  id: string
  type: BlockType
  data: T
}

export interface BlockPlugin<T = unknown> {
  type: BlockType
  label: string
  icon: LucideIcon
  color: string
  defaultData: T
  /**
   * Text-like blocks support cursor-based operations:
   - Enter to split / create new block
   - Backspace at start to merge with previous block
   - Arrow up/down to navigate blocks
   - Slash commands
   */
  isText: boolean
  renderEditor: (props: {
    block: VisualBlock<T>
    isActive: boolean
    onChange: (data: T) => void
    onSplit?: (beforeData: T, afterData: T) => void
    onMergeUp?: () => void
    onInsertAfter?: (type: BlockType) => void
    onFocus: () => void
    onBlur: () => void
  }) => React.ReactNode
  toLaTeX: (data: T) => string
}

export type AnyVisualBlock = VisualBlock<unknown>
export type AnyBlockPlugin = BlockPlugin<unknown>

let _idCounter = 0
export function genBlockId(): string {
  return `vb-${Date.now()}-${++_idCounter}`
}

export function createBlock<T>(type: BlockType, data: T): VisualBlock<T> {
  return {
    id: genBlockId(),
    type,
    data,
  }
}
