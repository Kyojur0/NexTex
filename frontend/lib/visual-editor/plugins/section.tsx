"use client"

import { useRef, useCallback, useState } from "react"
import { Heading1 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { BlockPlugin, BlockType } from "../types"
import { InlineText } from "../components/inline-text"
import { SlashCommandMenu } from "../components/slash-command"

export interface SectionData {
  level: "section" | "subsection" | "subsubsection"
  title: string
}

/* Fable5 heading sizes */
const LEVEL_STYLE: Record<SectionData["level"], React.CSSProperties> = {
  section:        { fontSize: "25px",  fontWeight: 700, lineHeight: 1.3,  letterSpacing: "-0.01em" },
  subsection:     { fontSize: "20px",  fontWeight: 700, lineHeight: 1.35 },
  subsubsection:  { fontSize: "17px",  fontWeight: 700, lineHeight: 1.4  },
}

export const sectionPlugin: BlockPlugin<SectionData> = {
  type: "section",
  label: "Section",
  icon: Heading1,
  color: "#6366f1",
  defaultData: { level: "section", title: "" },
  isText: true,
  renderEditor: ({ block, isActive, onChange, onSplit, onMergeUp, onInsertAfter, onFocus, onBlur }) => {
    const ref = useRef<HTMLDivElement>(null)
    const [slashState, setSlashState] = useState<{ active: boolean; query: string } | null>(null)

    const handleChange = useCallback(
      (title: string) => onChange({ ...block.data, title }),
      [block.data, onChange],
    )

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        const el = ref.current
        if (!el) return
        const text = el.innerText
        const sel = window.getSelection()
        const offset = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).startOffset : text.length
        const isAtStart = offset === 0

        if (e.key === "Enter" && !e.shiftKey && onSplit) {
          e.preventDefault()
          onSplit(
            { ...block.data, title: text.slice(0, offset) },
            { ...block.data, title: text.slice(offset) },
          )
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

    const levelStyle = LEVEL_STYLE[block.data.level]

    return (
      <div className="relative">
        <InlineText
          ref={ref}
          value={block.data.title}
          onChange={handleChange}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
          placeholder={
            block.data.level === "section"
              ? "Section title"
              : block.data.level === "subsection"
              ? "Subsection title"
              : "Subsubsection title"
          }
          className="outline-none"
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            color: "var(--visual-editor-text)",
            caretColor: "var(--primary)",
            ...levelStyle,
          }}
          multiline={false}
        />
        {slashState?.active && (
          <div className="absolute left-0 top-full mt-1 z-20 rounded-xl border border-[var(--visual-editor-toolbar-border)] bg-[var(--visual-editor-toolbar)] shadow-floating overflow-hidden">
            <SlashCommandMenu
              query={slashState.query}
              onSelect={handleInsert}
              onClose={() => setSlashState(null)}
            />
          </div>
        )}
      </div>
    )
  },
  toLaTeX: (data) => `\\${data.level}{${data.title.trim()}}`,
}
