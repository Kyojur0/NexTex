"use client"

import { useCallback } from "react"
import { List as ListIcon } from "lucide-react"
import type { BlockPlugin } from "../types"
import { InlineText } from "../components/inline-text"

export interface ListData {
  kind: "itemize" | "enumerate"
  items: string[]
}

export const listPlugin: BlockPlugin<ListData> = {
  type: "list",
  label: "List",
  icon: ListIcon,
  color: "#10b981",
  defaultData: { kind: "itemize", items: [""] },
  isText: false,
  renderEditor: ({ block, isActive, onChange, onFocus, onBlur }) => {
    const { kind, items } = block.data

    const updateItem = useCallback(
      (idx: number, value: string) => {
        const next = [...items]
        next[idx] = value
        onChange({ ...block.data, items: next })
      },
      [items, block.data, onChange],
    )

    const addItem = useCallback(
      (e: React.MouseEvent, idx: number) => {
        e.preventDefault()
        e.stopPropagation()
        const next = [...items]
        next.splice(idx + 1, 0, "")
        onChange({ ...block.data, items: next })
      },
      [items, block.data, onChange],
    )

    const removeItem = useCallback(
      (e: React.MouseEvent, idx: number) => {
        e.preventDefault()
        e.stopPropagation()
        if (items.length <= 1) {
          onChange({ ...block.data, items: [""] })
          return
        }
        const next = items.filter((_, i) => i !== idx)
        onChange({ ...block.data, items: next })
      },
      [items, block.data, onChange],
    )

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>, idx: number) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault()
          const fakeEvent = { stopPropagation: () => {} } as unknown as React.MouseEvent
          const next = [...items]
          next.splice(idx + 1, 0, "")
          onChange({ ...block.data, items: next })
        }
        if (e.key === "Backspace" && items[idx] === "" && items.length > 1) {
          e.preventDefault()
          const next = items.filter((_, i) => i !== idx)
          onChange({ ...block.data, items: next })
        }
      },
      [items, block.data, onChange],
    )

    return (
      <div
        style={{ padding: "2px 0", fontSize: "16px", lineHeight: "1.62" }}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        {items.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              marginBottom: idx < items.length - 1 ? "7px" : 0,
            }}
          >
            {/* Accent bullet / number */}
            <span
              style={{
                color: "var(--primary)",
                flexShrink: 0,
                fontFamily: "Georgia, serif",
                userSelect: "none",
                minWidth: "18px",
                paddingTop: "1px",
              }}
            >
              {kind === "enumerate" ? `${idx + 1}.` : "•"}
            </span>

            {/* Editable text */}
            <InlineText
              value={item}
              onChange={(value) => updateItem(idx, value)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              placeholder="List item"
              className="flex-1 outline-none"
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "16px",
                lineHeight: "1.62",
                color: "var(--visual-editor-text)",
                caretColor: "var(--primary)",
              }}
              multiline={false}
            />

            {/* +/− controls — always shown when active */}
            {isActive && (
              <div style={{ display: "flex", gap: "4px", flexShrink: 0, paddingTop: "2px" }}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
                  onClick={(e) => addItem(e, idx)}
                  title="Add item below"
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "5px",
                    border: "1px solid var(--visual-editor-toolbar-border)",
                    background: "transparent",
                    cursor: "pointer",
                    color: "var(--visual-editor-text-dim)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "14px",
                    fontWeight: 600,
                    lineHeight: 1,
                    transition: "all 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = "var(--primary)"
                    ;(e.currentTarget as HTMLButtonElement).style.color = "var(--primary)"
                    ;(e.currentTarget as HTMLButtonElement).style.background = "rgba(196,69,40,0.08)"
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = "var(--visual-editor-toolbar-border)"
                    ;(e.currentTarget as HTMLButtonElement).style.color = "var(--visual-editor-text-dim)"
                    ;(e.currentTarget as HTMLButtonElement).style.background = "transparent"
                  }}
                >
                  +
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
                  onClick={(e) => removeItem(e, idx)}
                  disabled={items.length <= 1}
                  title="Remove item"
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "5px",
                    border: "1px solid var(--visual-editor-toolbar-border)",
                    background: "transparent",
                    cursor: items.length <= 1 ? "not-allowed" : "pointer",
                    color: "var(--visual-editor-text-dim)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                    fontWeight: 400,
                    lineHeight: 1,
                    opacity: items.length <= 1 ? 0.3 : 1,
                    transition: "all 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    if (items.length <= 1) return
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = "var(--error)"
                    ;(e.currentTarget as HTMLButtonElement).style.color = "var(--error)"
                    ;(e.currentTarget as HTMLButtonElement).style.background = "rgba(196,69,40,0.08)"
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = "var(--visual-editor-toolbar-border)"
                    ;(e.currentTarget as HTMLButtonElement).style.color = "var(--visual-editor-text-dim)"
                    ;(e.currentTarget as HTMLButtonElement).style.background = "transparent"
                  }}
                >
                  −
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Add first/new item button at the bottom when active */}
        {isActive && (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
            onClick={(e) => addItem(e, items.length - 1)}
            style={{
              marginTop: "10px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              color: "var(--visual-editor-text-dim)",
              background: "transparent",
              border: "1px dashed var(--visual-editor-toolbar-border)",
              borderRadius: "5px",
              padding: "4px 10px",
              cursor: "pointer",
              transition: "all 0.1s",
              width: "100%",
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = "var(--primary)"
              ;(e.currentTarget as HTMLButtonElement).style.color = "var(--primary)"
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = "var(--visual-editor-toolbar-border)"
              ;(e.currentTarget as HTMLButtonElement).style.color = "var(--visual-editor-text-dim)"
            }}
          >
            <span style={{ fontSize: "14px", fontWeight: 600 }}>+</span> Add item
          </button>
        )}
      </div>
    )
  },
  toLaTeX: (data) => {
    const body = data.items.map((i) => `  \\item ${i.trim()}`).join("\n")
    return `\\begin{${data.kind}}\n${body || "  \\item"}\n\\end{${data.kind}}`
  },
}
