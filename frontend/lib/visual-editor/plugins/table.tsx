"use client"

import { Table } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  color: "#f59e0b",
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
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Cells (rows separated by newlines, columns by |)</Label>
          <Textarea
            value={value}
            onChange={(e) =>
              onChange({
                ...block.data,
                rows: parseTableText(e.target.value),
              })
            }
            rows={5}
            className="font-mono text-sm resize-y"
            placeholder="A | B | C&#10;1 | 2 | 3"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Caption</Label>
          <Input
            type="text"
            value={block.data.caption}
            onChange={(e) => onChange({ ...block.data, caption: e.target.value })}
            placeholder="Table caption"
            className="text-sm"
          />
        </div>
      </div>
    )
  },
  renderPreview: ({ block }) => {
    const rows = block.data.rows
    if (rows.length === 0) {
      return <p className="text-sm italic text-muted-foreground/70">Empty table</p>
    }
    const colCount = Math.max(1, ...rows.map((r) => r.length))
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-border/60 last:border-0">
                {Array.from({ length: colCount }).map((_, ci) => (
                  <td key={ci} className="px-2 py-1 text-foreground/85">
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
