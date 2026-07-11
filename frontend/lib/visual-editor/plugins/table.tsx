"use client"

import { useCallback, useState } from "react"
import { Table as TableIcon } from "lucide-react"
import type { BlockPlugin } from "../types"
import { InlineText } from "../components/inline-text"

export interface TableCell {
  content: string
  colspan: number   // ≥1
  rowspan: number   // ≥1
  hidden?: boolean  // true = absorbed by a neighbouring merge
}

export interface TableData {
  rows: TableCell[][]
  caption: string
}

function makeCell(content = ""): TableCell {
  return { content, colspan: 1, rowspan: 1 }
}

function makeRow(cols: number): TableCell[] {
  return Array.from({ length: cols }, () => makeCell())
}

/** Count logical columns in the first non-empty row */
function colCount(rows: TableCell[][]): number {
  for (const row of rows) {
    const n = row.reduce((s, c) => s + (c.hidden ? 0 : c.colspan), 0)
    if (n > 0) return n
  }
  return 1
}

/** True if cell (r,c) is logically occupied by the merge rooted at (tr,tc) */
function isCoveredBy(tr: number, tc: number, cell: TableCell, r: number, c: number) {
  return r >= tr && r < tr + cell.rowspan && c >= tc && c < tc + cell.colspan
}

const ACCENT = "var(--primary)"
const DIM = "var(--visual-editor-text-dim)"
const TOOLBAR_BG = "var(--visual-editor-toolbar)"
const TOOLBAR_BORDER = "var(--visual-editor-toolbar-border)"
const CANVAS = "var(--visual-editor-canvas)"

/* ─── tiny icon helpers ─────────────────────────────── */
function IconPlus() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
function IconMinus() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
function IconMerge() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="1" y="1" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
      <rect x="7" y="1" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
      <rect x="1" y="7" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
      <rect x="7" y="7" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
      <path d="M5 3h2M5 9h2M3 5v2M9 5v2" stroke={ACCENT} strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  )
}

/* ─── Ctrl button ────────────────────────────────────── */
function Btn({
  onClick, title, children, danger = false, disabled = false,
}: {
  onClick: (e: React.MouseEvent) => void
  title?: string
  children: React.ReactNode
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
      onClick={(e) => { e.stopPropagation(); onClick(e) }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "4px",
        height: "22px",
        padding: "0 7px",
        borderRadius: "4px",
        border: `1px solid ${TOOLBAR_BORDER}`,
        background: "transparent",
        fontSize: "11px",
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.35 : 1,
        color: danger ? "var(--error)" : DIM,
        transition: "all 0.1s",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => {
        if (disabled) return
        const el = e.currentTarget as HTMLButtonElement
        el.style.borderColor = danger ? "var(--error)" : ACCENT
        el.style.color = danger ? "var(--error)" : ACCENT
        el.style.background = danger ? "rgba(196,69,40,0.08)" : "rgba(196,69,40,0.06)"
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.borderColor = TOOLBAR_BORDER
        el.style.color = danger ? "var(--error)" : DIM
        el.style.background = "transparent"
      }}
    >
      {children}
    </button>
  )
}

/* ─── Main plugin ────────────────────────────────────── */
export const tablePlugin: BlockPlugin<TableData> = {
  type: "table",
  label: "Table",
  icon: TableIcon,
  color: "#f59e0b",
  defaultData: {
    rows: [
      [makeCell("Header A"), makeCell("Header B"), makeCell("Header C")],
      [makeCell("Row 1, A"), makeCell("Row 1, B"), makeCell("Row 1, C")],
      [makeCell("Row 2, A"), makeCell("Row 2, B"), makeCell("Row 2, C")],
    ],
    caption: "",
  },
  isText: false,

  renderEditor: ({ block, isActive, onChange, onFocus, onBlur }) => {
    const { rows, caption } = block.data
    const numCols = colCount(rows)

    // Selection: anchor + head cell indices [row, col]
    const [selAnchor, setSelAnchor] = useState<[number, number] | null>(null)
    const [selHead, setSelHead] = useState<[number, number] | null>(null)

    const commit = useCallback(
      (newRows: TableCell[][], newCaption = caption) =>
        onChange({ rows: newRows, caption: newCaption }),
      [caption, onChange],
    )

    // ── Cell content update
    const updateCell = useCallback(
      (ri: number, ci: number, value: string) => {
        const next = rows.map((row, r) =>
          row.map((cell, c) => (r === ri && c === ci ? { ...cell, content: value } : cell)),
        )
        commit(next)
      },
      [rows, commit],
    )

    // ── Add row after index ri
    const addRow = useCallback(
      (ri: number) => {
        const next = [...rows]
        next.splice(ri + 1, 0, makeRow(rows[0]?.length ?? numCols))
        commit(next)
      },
      [rows, numCols, commit],
    )

    // ── Delete row ri
    const deleteRow = useCallback(
      (ri: number) => {
        if (rows.length <= 1) return
        commit(rows.filter((_, i) => i !== ri))
        setSelAnchor(null); setSelHead(null)
      },
      [rows, commit],
    )

    // ── Add column after ci
    const addCol = useCallback(
      (ci: number) => {
        const next = rows.map((row) => {
          const r = [...row]
          r.splice(ci + 1, 0, makeCell())
          return r
        })
        commit(next)
      },
      [rows, commit],
    )

    // ── Delete column ci
    const deleteCol = useCallback(
      (ci: number) => {
        if (numCols <= 1) return
        const next = rows.map((row) => row.filter((_, i) => i !== ci))
        commit(next)
        setSelAnchor(null); setSelHead(null)
      },
      [rows, numCols, commit],
    )

    // ── Determine selected bounding box
    const selBox = (() => {
      if (!selAnchor || !selHead) return null
      const rMin = Math.min(selAnchor[0], selHead[0])
      const rMax = Math.max(selAnchor[0], selHead[0])
      const cMin = Math.min(selAnchor[1], selHead[1])
      const cMax = Math.max(selAnchor[1], selHead[1])
      return { rMin, rMax, cMin, cMax }
    })()

    const cellInSel = (ri: number, ci: number) =>
      selBox
        ? ri >= selBox.rMin && ri <= selBox.rMax && ci >= selBox.cMin && ci <= selBox.cMax
        : false

    const canMerge = selBox
      ? selBox.rMax > selBox.rMin || selBox.cMax > selBox.cMin
      : false

    // ── Merge selected cells
    const mergeCells = useCallback(() => {
      if (!selBox) return
      const { rMin, rMax, cMin, cMax } = selBox
      // collect content
      const content = rows
        .slice(rMin, rMax + 1)
        .flatMap((row) => row.slice(cMin, cMax + 1).map((c) => c.content))
        .filter(Boolean)
        .join(" ")

      const next = rows.map((row, ri) =>
        row.map((cell, ci) => {
          if (ri === rMin && ci === cMin) {
            return {
              ...cell,
              content,
              colspan: cMax - cMin + 1,
              rowspan: rMax - rMin + 1,
              hidden: false,
            }
          }
          if (ri >= rMin && ri <= rMax && ci >= cMin && ci <= cMax) {
            return { ...cell, content: "", colspan: 1, rowspan: 1, hidden: true }
          }
          return cell
        }),
      )
      commit(next)
      setSelAnchor(null); setSelHead(null)
    }, [rows, selBox, commit])

    // ── Unmerge a cell
    const unmergeCell = useCallback(
      (ri: number, ci: number) => {
        const cell = rows[ri]?.[ci]
        if (!cell || (cell.colspan === 1 && cell.rowspan === 1)) return
        const next = rows.map((row, r) =>
          row.map((c, col) => {
            if (r === ri && col === ci) return { ...c, colspan: 1, rowspan: 1 }
            // unhide cells that were covered
            if (
              c.hidden &&
              r >= ri && r < ri + cell.rowspan &&
              col >= ci && col < ci + cell.colspan
            ) {
              return { ...c, hidden: false, content: "", colspan: 1, rowspan: 1 }
            }
            return c
          }),
        )
        commit(next)
      },
      [rows, commit],
    )

    const isMerged = (ri: number, ci: number) => {
      const c = rows[ri]?.[ci]
      return c && (c.colspan > 1 || c.rowspan > 1)
    }

    return (
      <div style={{ padding: "4px 0" }} onFocus={onFocus} onBlur={onBlur}>

        {/* ── Table ── */}
        <div style={{ overflowX: "auto" }}>
          {/* Column header controls */}
          {isActive && (
            <div style={{ display: "flex", marginBottom: "4px", paddingLeft: "32px" }}>
              {Array.from({ length: numCols }).map((_, ci) => (
                <div
                  key={ci}
                  style={{ flex: 1, display: "flex", justifyContent: "center", gap: "3px", minWidth: "80px" }}
                >
                  <Btn onClick={() => addCol(ci - 1)} title={`Add column before col ${ci + 1}`}>
                    <IconPlus />
                  </Btn>
                  <Btn onClick={() => deleteCol(ci)} title={`Delete column ${ci + 1}`} danger disabled={numCols <= 1}>
                    <IconMinus />
                  </Btn>
                </div>
              ))}
              {/* "Add last col" button */}
              <Btn onClick={() => addCol(numCols - 1)} title="Add column at end">
                <IconPlus />
              </Btn>
            </div>
          )}

          <div style={{ display: "flex" }}>
            {/* Row controls */}
            {isActive && (
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-around", gap: "0", marginRight: "4px", flexShrink: 0 }}>
                {rows.map((_, ri) => (
                  <div
                    key={ri}
                    style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "2px", padding: "2px 0" }}
                  >
                    <Btn onClick={() => addRow(ri - 1)} title={`Add row above row ${ri + 1}`}>
                      <IconPlus />
                    </Btn>
                    <Btn onClick={() => deleteRow(ri)} title={`Delete row ${ri + 1}`} danger disabled={rows.length <= 1}>
                      <IconMinus />
                    </Btn>
                  </div>
                ))}
                <Btn onClick={() => addRow(rows.length - 1)} title="Add row at bottom">
                  <IconPlus />
                </Btn>
              </div>
            )}

            {/* The actual table */}
            <table
              style={{
                flex: 1,
                borderCollapse: "collapse",
                width: "100%",
                fontSize: "14px",
                fontFamily: "Georgia, serif",
              }}
            >
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => {
                      if (cell.hidden) return null
                      const inSel = cellInSel(ri, ci)
                      const merged = isMerged(ri, ci)
                      return (
                        <td
                          key={ci}
                          colSpan={cell.colspan}
                          rowSpan={cell.rowspan}
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            if (e.shiftKey && selAnchor) {
                              setSelHead([ri, ci])
                            } else {
                              setSelAnchor([ri, ci])
                              setSelHead([ri, ci])
                            }
                          }}
                          style={{
                            border: `1px solid var(--visual-editor-canvas-border)`,
                            padding: 0,
                            minWidth: "80px",
                            position: "relative",
                            background: inSel
                              ? "rgba(196,69,40,0.08)"
                              : ri === 0
                              ? "var(--visual-editor-bg)"
                              : CANVAS,
                            outline: inSel ? `2px solid rgba(196,69,40,0.35)` : "none",
                            outlineOffset: "-1px",
                            transition: "background 0.1s",
                            cursor: "cell",
                          }}
                        >
                          <InlineText
                            value={cell.content}
                            onChange={(v) => updateCell(ri, ci, v)}
                            className="outline-none"
                            style={{
                              display: "block",
                              padding: "6px 10px",
                              fontFamily: "Georgia, serif",
                              fontSize: ri === 0 ? "13px" : "13.5px",
                              fontWeight: ri === 0 ? 600 : 400,
                              color: "var(--visual-editor-text)",
                              caretColor: "var(--primary)",
                              minHeight: "30px",
                              cursor: "text",
                            }}
                            multiline={false}
                          />
                          {/* Unmerge button on merged cell */}
                          {isActive && merged && (
                            <button
                              type="button"
                              title="Unmerge cells"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => { e.stopPropagation(); unmergeCell(ri, ci) }}
                              style={{
                                position: "absolute",
                                top: "2px",
                                right: "2px",
                                width: "16px",
                                height: "16px",
                                borderRadius: "3px",
                                border: `1px solid ${TOOLBAR_BORDER}`,
                                background: CANVAS,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "8px",
                                color: DIM,
                              }}
                            >
                              ✕
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Merge / selection toolbar ── */}
        {isActive && canMerge && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "8px",
              padding: "5px 10px",
              background: TOOLBAR_BG,
              border: `1px solid ${TOOLBAR_BORDER}`,
              borderRadius: "6px",
              fontSize: "11px",
              color: DIM,
            }}
          >
            <IconMerge />
            <span>
              {selBox
                ? `${selBox.rMax - selBox.rMin + 1} × ${selBox.cMax - selBox.cMin + 1} cells selected`
                : "Select cells to merge"}
            </span>
            <Btn onClick={mergeCells} title="Merge selected cells">
              Merge cells
            </Btn>
            <Btn onClick={() => { setSelAnchor(null); setSelHead(null) }} title="Clear selection">
              Clear
            </Btn>
          </div>
        )}

        {/* ── Caption ── */}
        <div style={{ marginTop: "10px", textAlign: "center" }}>
          <InlineText
            value={caption}
            onChange={(v) => commit(rows, v)}
            placeholder="Table caption"
            className="outline-none text-center w-full"
            style={{
              fontFamily: "Georgia, serif",
              fontSize: "13px",
              fontStyle: "italic",
              color: DIM,
              caretColor: "var(--primary)",
              textAlign: "center",
            }}
            multiline={false}
          />
        </div>
      </div>
    )
  },

  toLaTeX: (data) => {
    if (!data.rows.length) return ""
    const cols = data.rows[0]
      .filter((c) => !c.hidden)
      .map(() => "l")
      .join("|")
    const body = data.rows
      .map((row) =>
        row
          .filter((c) => !c.hidden)
          .map((c) => {
            let cell = c.content
            if (c.colspan > 1) cell = `\\multicolumn{${c.colspan}}{l}{${cell}}`
            if (c.rowspan > 1) cell = `\\multirow{${c.rowspan}}{*}{${cell}}`
            return cell
          })
          .join(" & "),
      )
      .join(" \\\\\n")
    return `\\begin{table}[h]\n\\centering\n\\begin{tabular}{${cols}}\n\\hline\n${body}\n\\hline\n\\end{tabular}\n\\caption{${data.caption}}\n\\end{table}`
  },
}
