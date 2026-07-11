"use client"

import { useRef, useCallback, useState } from "react"
import { Type } from "lucide-react"
import { cn } from "@/lib/utils"
import type { BlockPlugin, BlockType } from "../types"
import { InlineText } from "../components/inline-text"
import { SlashCommandMenu } from "../components/slash-command"

export interface ParagraphData {
  text: string
}

export const paragraphPlugin: BlockPlugin<ParagraphData> = {
  type: "paragraph",
  label: "Paragraph",
  icon: Type,
  color: "#64748b",
  defaultData: { text: "" },
  isText: true,
  renderEditor: ({ block, isActive, onChange, onSplit, onMergeUp, onInsertAfter, onFocus, onBlur }) => {
    const ref = useRef<HTMLDivElement>(null)
    const [slashState, setSlashState] = useState<{ active: boolean; query: string } | null>(null)

    const handleChange = useCallback((text: string) => onChange({ text }), [onChange])

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        const el = ref.current
        if (!el) return
        const sel = window.getSelection()
        const isAtStart =
          sel && sel.rangeCount > 0
            ? sel.getRangeAt(0).startOffset === 0 &&
              sel.getRangeAt(0).startContainer === el.firstChild
            : false

        if (e.key === "Enter" && !e.shiftKey && onSplit) {
          e.preventDefault()
          const text = el.innerText
          const offset = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).startOffset : text.length
          onSplit({ text: text.slice(0, offset) }, { text: text.slice(offset) })
          return
        }
        if (e.key === "Backspace" && isAtStart && onMergeUp) {
          e.preventDefault()
          onMergeUp()
          return
        }
        if (e.key === "/") setSlashState({ active: true, query: "" })
        if (slashState?.active) {
          if (e.key === "Escape") setSlashState(null)
          else if (e.key === "Backspace") {
            const q = slashState.query.slice(0, -1)
            setSlashState(q ? { active: true, query: q } : null)
          } else if (e.key.length === 1) {
            setSlashState({ active: true, query: slashState.query + e.key })
          }
        }
      },
      [block.data, onSplit, onMergeUp, slashState],
    )

    const handleInsert = useCallback(
      (type: BlockType) => { setSlashState(null); onInsertAfter?.(type) },
      [onInsertAfter],
    )

    return (
      <div className="relative">
        <InlineText
          ref={ref}
          value={block.data.text}
          onChange={handleChange}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
          placeholder="Start typing or press '/' for commands…"
          /* Fable5: Georgia serif 16.5px / 1.68 */
          className="outline-none"
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "16.5px",
            lineHeight: "1.68",
            color: "var(--visual-editor-text)",
            caretColor: "var(--primary)",
          }}
          multiline
        />
        {slashState?.active && (
          <div className="absolute left-0 top-full mt-1 z-20 rounded-xl border border-[var(--visual-editor-toolbar-border)] bg-[var(--visual-editor-toolbar)] shadow-floating overflow-hidden">
            <SlashCommandMenu query={slashState.query} onSelect={handleInsert} onClose={() => setSlashState(null)} />
          </div>
        )}
      </div>
    )
  },
  toLaTeX: (data) => data.text?.trim() || "",
}
