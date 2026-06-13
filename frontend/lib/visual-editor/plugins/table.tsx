"use client"

import { Table } from "lucide-react"
import type { BlockPlugin } from "../types"

export interface TableData {
  rows: string[][]
  caption: string
}

function parseTableText(text: string): string[][] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) =>
      line
        .split("|")
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0)
    )
}

function rowsToText(rows: string[][]): string {
  return rows.map((row) => row.join(" | ")).join("\n")
}

export const tablePlugin: BlockPlugin<TableData> = {
  type: "table",
  label: "Table",
  icon: Table,
  defaultData: {
    rows: [
      ["A", "B", "C"],
      ["1", "2", "3"],
    ],
    caption: "Table caption",
  },
  renderConfig: ({ block, onChange }) => {
    const value = rowsToText(block.data.rows)
    return (
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Cells (rows separated by newlines, columns by |)</label>
          <textarea
            value={value}
            onChange={(e) =>
              onChange({
                ...block.data,
                rows: parseTableText(e.target.value),
              })
            }
            rows={5}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="A | B | C&#10;1 | 2 | 3"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Caption</label>
          <input
            type="text"
            value={block.data.caption}
            onChange={(e) => onChange({ ...block.data, caption: e.target.value })}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Table caption"
          />
        </div>
      </div>
    )
  },
  renderPreview: ({ block }) => {
    const rows = block.data.rows
    if (rows.length === 0) {
      return <p className="text-sm italic text-muted-foreground">Empty table</p>
    }
    const colCount = Math.max(1, ...rows.map((r) => r.length))
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-border/60 last:border-0">
                {Array.from({ length: colCount }).map((_, ci) => (
                  <td key={ci} className="px-2 py-1 text-foreground/90">
                    {row[ci] || "\u00A0"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {block.data.caption && (
          <p className="text-xs text-center text-muted-foreground mt-2 italic">
            {block.data.caption}
          </p>
        )}
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
