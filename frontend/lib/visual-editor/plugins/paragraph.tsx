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

    const handleChange = useCallback(
      (text: string) => {
        onChange({ ...block.data, text })
      },
      [block.data, onChange]
    )

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        const el = ref.current
        if (!el) return

        const selection = window.getSelection()
        const isAtStart =
          selection && selection.rangeCount > 0
            ? selection.getRangeAt(0).startOffset === 0 && selection.getRangeAt(0).startContainer === el.firstChild
            : false
        const isAtEnd =
          selection && selection.rangeCount > 0
            ? selection.getRangeAt(0).endOffset === (el.lastChild?.textContent?.length ?? 0) &&
              selection.getRangeAt(0).endContainer === el.lastChild
            : false

        if (e.key === "Enter" && !e.shiftKey && onSplit) {
          e.preventDefault()
          const text = el.innerText
          const sel = window.getSelection()
          const offset = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).startOffset : text.length
          const before = text.slice(0, offset)
          const after = text.slice(offset)
          onSplit({ ...block.data, text: before }, { ...block.data, text: after })
          return
        }

        if (e.key === "Backspace" && isAtStart && onMergeUp) {
          e.preventDefault()
          onMergeUp()
          return
        }

        if (e.key === "/") {
          setSlashState({ active: true, query: "" })
        }

        if (slashState?.active) {
          if (e.key === "Escape") {
            setSlashState(null)
          } else if (e.key === "Backspace") {
            const newQuery = slashState.query.slice(0, -1)
            setSlashState(newQuery ? { active: true, query: newQuery } : null)
          } else if (e.key.length === 1) {
            setSlashState({ active: true, query: slashState.query + e.key })
          }
        }
      },
      [block.data, onSplit, onMergeUp, slashState]
    )

    const handleInsert = useCallback(
      (type: BlockType) => {
        setSlashState(null)
        onInsertAfter?.(type)
      },
      [onInsertAfter]
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
          placeholder="Type '/' for commands..."
          className={cn(
            "text-sm text-foreground/90 leading-relaxed min-h-[1.5em]",
            isActive && "text-foreground"
          )}
          multiline
        />
        {slashState?.active && (
          <div className="absolute left-0 top-full mt-1 z-20 rounded-xl border border-border/60 bg-card shadow-floating overflow-hidden">
            <SlashCommandMenu query={slashState.query} onSelect={handleInsert} onClose={() => setSlashState(null)} />
          </div>
        )}
      </div>
    )
  },
  toLaTeX: (data) => data.text.trim(),
}
