/** All offsets refer to the original LaTeX document, never rendered text. */
export interface VisualSpan {
  from: number
  to: number
  kind: 'bold' | 'italic' | 'underline' | 'strike' | 'heading' | 'comment' | 'code' | 'hidden' | 'math' | 'reference' | 'preamble' | 'figure' | 'table' | 'list-marker' | 'environment' | 'title'
  contentFrom?: number
  contentTo?: number
  value?: string
  level?: number
  block?: boolean
}

export interface SourceSelection { from: number; to: number }
export interface SourceEdit {
  changes: { from: number; to: number; insert: string }[]
  selection: { anchor: number; head?: number }
}

export type InlineFormat = 'bold' | 'italic' | 'underline' | 'strike'
export type InsertKind = 'math' | 'image' | 'table' | 'link' | 'citation' | 'reference' | 'symbol'
export interface SourceDialogRequest {
  kind: InsertKind
  from: number
  to: number
  latex: string
}
