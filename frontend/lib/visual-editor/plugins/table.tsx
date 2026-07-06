"use client"

import { useCallback } from "react"
import { Table as TableIcon } from "lucide-react"
import type { BlockPlugin } from "../types"
import { InlineText } from "../components/inline-text"

export interface TableData {
  rows: string[][]
  caption: string
}

export const tablePlugin: BlockPlugin<TableData> = {
  type: "table",
  label: "Table",
  icon: TableIcon,
  color: "#f59e0b",
  defaultData: {
    rows: [
      ["A", "B", "C"],
      ["1", "2", "3"],
    ],
    caption: "",
  },
  isText: false,
  renderEditor: ({ block, isActive, onChange, onFocus, onBlur }) => {
    const { rows, caption } = block.data
    const colCount = Math.max(1, ...rows.map((r) => r.length))

    const updateCell = useCallback(
      (ri: number, ci: number, value: string) => {
        const next = rows.map((row, i) =>
          i === ri ? row.map((cell, j) => (j === ci ? value : cell)) : row
        )
        onChange({ ...block.data, rows: next })
      },
      [rows, block.data, onChange]
    )

    const addRow = useCallback(
      (afterIdx: number) => {
        const next = [...rows]
        next.splice(afterIdx + 1, 0, Array.from({ length: colCount }, () => ""))
        onChange({ ...block.data, rows: next })
      },
      [rows, colCount, block.data, onChange]
    )

    const addCol = useCallback(() => {
      onChange({ ...block.data, rows: rows.map((row) => [...row, ""]) })
    }, [rows, block.data, onChange])

    const removeRow = useCallback(
      (idx: number) => {
        const next = rows.filter((_, i) => i !== idx)
        onChange({ ...block.data, rows: next.length ? next : [[""]] })
      },
      [rows, block.data, onChange]
    )

    const removeCol = useCallback(() => {
      const next = rows.map((row) => row.slice(0, -1)).filter((row) => row.length > 0)
      onChange({ ...block.data, rows: next.length ? next : [[""]] })
    }, [rows, block.data, onChange])

    const updateCaption = useCallback(
      (caption: string) => onChange({ ...block.data, caption }),
      [block.data, onChange]
    )

    return (
      <div className="py-2" onFocus={onFocus} onBlur={onBlur}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse border border-[var(--visual-editor-canvas-border)]">
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-b border-[var(--visual-editor-canvas-border)] last:border-b-0">
                  {Array.from({ length: colCount }).map((_, ci) => (
                    <td
                      key={ci}
                      className="p-0 min-w-[80px] border-r border-[var(--visual-editor-canvas-border)] last:border-r-0"
                    >
                      <InlineText
                        value={row[ci] || ""}
                        onChange={(value) => updateCell(ri, ci, value)}
                        className="px-3 py-2 text-[var(--visual-editor-text)] text-sm font-serif outline-none focus:bg-[var(--visual-editor-block-hover)]"
                        placeholder=""
                        multiline={false}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isActive && (
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={() => addRow(rows.length - 1)}
              className="text-[11px] px-2 py-1 rounded-md border border-[var(--visual-editor-toolbar-border)] text-[var(--visual-editor-text-dim)] hover:text-[var(--visual-editor-text)] hover:bg-[var(--visual-editor-tool-hover)] transition-colors"
            >
              + Row
            </button>
            <button
              type="button"
              onClick={addCol}
              className="text-[11px] px-2 py-1 rounded-md border border-[var(--visual-editor-toolbar-border)] text-[var(--visual-editor-text-dim)] hover:text-[var(--visual-editor-text)] hover:bg-[var(--visual-editor-tool-hover)] transition-colors"
            >
              + Column
            </button>
            <button
              type="button"
              onClick={removeCol}
              disabled={colCount <= 1}
              className="text-[11px] px-2 py-1 rounded-md border border-[var(--visual-editor-toolbar-border)] text-[var(--visual-editor-text-dim)] hover:text-[var(--visual-editor-text)] hover:bg-[var(--visual-editor-tool-hover)] transition-colors disabled:opacity-40"
            >
              - Column
            </button>
            {rows.map((_, ri) => (
              <button
                key={ri}
                type="button"
                onClick={() => removeRow(ri)}
                disabled={rows.length <= 1}
                className="text-[11px] px-2 py-1 rounded-md border border-[var(--visual-editor-toolbar-border)] text-[var(--visual-editor-text-dim)] hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
              >
                - R{ri + 1}
              </button>
            ))}
          </div>
        )}

        <InlineText
          value={caption}
          onChange={updateCaption}
          className="mt-2 text-sm italic text-center text-[var(--visual-editor-text-dim)] font-serif"
          placeholder="Table caption"
          multiline={false}
        />
      </div>
    )
  },
  toLaTeX: (data) => {
    if (data.rows.length === 0) {
      return `\\begin{table}[h]\n\\centering\n\\begin{tabular}{l}\n\\end{tabular}\n\\caption{${data.caption}}\n\\end{table}`
    }
    const colCount = Math.max(1, ...data.rows.map((r) => r.length))
    const cols = "l".repeat(colCount)
    const body = data.rows
      .map((row) =>
        Array.from({ length: colCount })
          .map((_, i) => row[i] || "")
          .join(" & ")
      )
      .join(" \\\\\n")
    return `\\begin{table}[h]\n\\centering\n\\begin{tabular}{${cols}}\n${body}\n\\end{tabular}\n\\caption{${data.caption}}\n\\end{table}`
  },
}
