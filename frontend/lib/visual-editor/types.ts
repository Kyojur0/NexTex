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
  renderConfig: (props: {
    block: VisualBlock<T>
    onChange: (data: T) => void
  }) => React.ReactNode
  renderPreview: (props: { block: VisualBlock<T> }) => React.ReactNode
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
