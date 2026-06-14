"use client"

import { useCallback } from "react"
import { Table, Plus, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import type { BlockPlugin } from "../types"

export interface TableData {
  rows: string[][]
  caption: string
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

    return (
      <div className="space-y-3" onFocus={onFocus} onBlur={onBlur}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-b border-border/40 last:border-0">
                  {Array.from({ length: colCount }).map((_, ci) => (
                    <td key={ci} className="p-0 min-w-[80px]">
                      <Input
                        value={row[ci] || ""}
                        onChange={(e) => updateCell(ri, ci, e.target.value)}
                        className="h-8 text-sm border-0 bg-transparent rounded-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/20"
                        placeholder=""
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isActive && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => addRow(rows.length - 1)}>
              <Plus className="h-3 w-3 mr-1" /> Row
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addCol}>
              <Plus className="h-3 w-3 mr-1" /> Column
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={removeCol} disabled={colCount <= 1}>
              <Trash2 className="h-3 w-3 mr-1" /> Col
            </Button>
          </div>
        )}
        {isActive && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Caption</Label>
            <Input
              value={caption}
              onChange={(e) => onChange({ ...block.data, caption: e.target.value })}
              placeholder="Table caption"
              className="text-sm"
            />
          </div>
        )}
        {!isActive && caption && <p className="text-xs text-center text-muted-foreground italic">{caption}</p>}
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
