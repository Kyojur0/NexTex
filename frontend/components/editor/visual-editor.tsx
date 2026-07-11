"use client"

import { memo, useState, useEffect, useCallback, useRef } from "react"
import { useEditorStore } from "@/lib/store"
import { parseLaTeXToBlocks } from "@/lib/visual-editor/parser"
import { blocksToLaTeX } from "@/lib/visual-editor/serializer"
import { getPlugin } from "@/lib/visual-editor/plugins"
import type { AnyVisualBlock, BlockType } from "@/lib/visual-editor/types"
import { createBlock } from "@/lib/visual-editor/types"
import type { SectionData } from "@/lib/visual-editor/plugins/section"
import { BlockCanvas } from "./block-canvas"
import { LatexOutputPanel } from "./latex-output-panel"
import { FormattingToolbar, type FormatState, type ParagraphStyle } from "@/lib/visual-editor/components/formatting-toolbar"

const defaultFormat: FormatState = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  superscript: false,
  subscript: false,
  code: false,
}

function detectFormatFromSelection(): FormatState {
  if (typeof document === "undefined") return defaultFormat
  const formats = { ...defaultFormat }
  try {
    formats.bold = document.queryCommandState("bold")
    formats.italic = document.queryCommandState("italic")
    formats.underline = document.queryCommandState("underline")
    formats.strikethrough = document.queryCommandState("strikeThrough")
    formats.superscript = document.queryCommandState("superscript")
    formats.subscript = document.queryCommandState("subscript")
  } catch {
    // ignore
  }
  return formats
}

function getParagraphStyleForBlock(block: AnyVisualBlock | null | undefined): ParagraphStyle {
  if (!block) return "normal"
  if (block.type === "section") {
    const level = (block.data as { level?: string }).level
    if (level === "subsection") return "heading-2"
    if (level === "subsubsection") return "heading-3"
    return "heading-1"
  }
  return "normal"
}

export const VisualEditor = memo(function VisualEditor() {
  const content = useEditorStore((s) => s.content)
  const setContent = useEditorStore((s) => s.setContent)
  const setIsModified = useEditorStore((s) => s.setIsModified)
  const setActiveEditorTab = useEditorStore((s) => s.setActiveEditorTab)
  const showVisualLatexPanel = useEditorStore((s) => s.showVisualLatexPanel)
  const setShowVisualLatexPanel = useEditorStore((s) => s.setShowVisualLatexPanel)

  const [blocks, setBlocks] = useState<AnyVisualBlock[]>(() => parseLaTeXToBlocks(content))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [format, setFormat] = useState<FormatState>(defaultFormat)

  const contentRef = useRef(content)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blockRefs = useRef<Record<string, HTMLElement>>({})

  const focusedBlock = blocks.find((b) => b.id === focusedBlockId)
  const paragraphStyle = getParagraphStyleForBlock(focusedBlock)

  useEffect(() => {
    if (content !== contentRef.current) {
      setBlocks(parseLaTeXToBlocks(content))
      contentRef.current = content
      setDirty(false)
    }
  }, [content])

  useEffect(() => {
    const handleSelectionChange = () => {
      setFormat(detectFormatFromSelection())
    }
    document.addEventListener("selectionchange", handleSelectionChange)
    return () => document.removeEventListener("selectionchange", handleSelectionChange)
  }, [])

  const syncToContent = useCallback(
    (newBlocks: AnyVisualBlock[]) => {
      const latex = blocksToLaTeX(newBlocks)
      contentRef.current = latex
      setContent(latex)
      setIsModified(true)
      setDirty(true)
    },
    [setContent, setIsModified]
  )

  const scheduleSync = useCallback(
    (newBlocks: AnyVisualBlock[]) => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
      syncTimerRef.current = setTimeout(() => syncToContent(newBlocks), 150)
    },
    [syncToContent]
  )

  useEffect(() => {
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    }
  }, [])

  const handleAdd = useCallback(
    (type: BlockType) => {
      const plugin = getPlugin(type)
      const newBlock = createBlock(type, structuredClone(plugin.defaultData))
      const next = [...blocks, newBlock]
      setBlocks(next)
      syncToContent(next)
      setFocusedBlockId(newBlock.id)
    },
    [blocks, syncToContent]
  )

  const handleInsertAt = useCallback(
    (index: number, type: BlockType) => {
      const plugin = getPlugin(type)
      const newBlock = createBlock(type, structuredClone(plugin.defaultData))
      const next = [...blocks]
      next.splice(index, 0, newBlock)
      setBlocks(next)
      syncToContent(next)
      setFocusedBlockId(newBlock.id)
    },
    [blocks, syncToContent]
  )

  const handleChange = useCallback(
    (id: string, data: unknown) => {
      const next = blocks.map((b) => (b.id === id ? ({ ...b, data } as AnyVisualBlock) : b))
      setBlocks(next)
      scheduleSync(next)
    },
    [blocks, scheduleSync]
  )

  const handleReorder = useCallback(
    (next: AnyVisualBlock[]) => {
      setBlocks(next)
      syncToContent(next)
    },
    [syncToContent]
  )

  const handleDelete = useCallback(
    (id: string) => {
      const idx = blocks.findIndex((b) => b.id === id)
      const next = blocks.filter((b) => b.id !== id)
      setBlocks(next)
      syncToContent(next)
      if (focusedBlockId === id) {
        const nextFocus = next[Math.min(idx, next.length - 1)]
        setFocusedBlockId(nextFocus?.id || null)
      }
    },
    [blocks, focusedBlockId, syncToContent]
  )

  const handleDuplicate = useCallback(
    (id: string) => {
      const idx = blocks.findIndex((b) => b.id === id)
      if (idx === -1) return
      const original = blocks[idx] as AnyVisualBlock
      const plugin = getPlugin(original.type)
      const copy: AnyVisualBlock = createBlock(original.type, structuredClone(original.data))
      const next = [...blocks]
      next.splice(idx + 1, 0, copy)
      setBlocks(next)
      syncToContent(next)
      setFocusedBlockId(copy.id)
    },
    [blocks, syncToContent]
  )

  const handleMoveUp = useCallback(
    (id: string) => {
      const idx = blocks.findIndex((b) => b.id === id)
      if (idx <= 0) return
      const next = [...blocks]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      setBlocks(next)
      syncToContent(next)
    },
    [blocks, syncToContent]
  )

  const handleMoveDown = useCallback(
    (id: string) => {
      const idx = blocks.findIndex((b) => b.id === id)
      if (idx === -1 || idx >= blocks.length - 1) return
      const next = [...blocks]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      setBlocks(next)
      syncToContent(next)
    },
    [blocks, syncToContent]
  )

  const handleSplit = useCallback(
    (id: string, beforeData: unknown, afterData: unknown) => {
      const idx = blocks.findIndex((b) => b.id === id)
      if (idx === -1) return
      const original = blocks[idx] as AnyVisualBlock
      const next = [...blocks]
      next[idx] = { ...original, data: beforeData } as AnyVisualBlock
      const newBlock = createBlock(original.type, afterData)
      next.splice(idx + 1, 0, newBlock)
      setBlocks(next)
      syncToContent(next)
      setFocusedBlockId(newBlock.id)
    },
    [blocks, syncToContent]
  )

  const handleMergeUp = useCallback(
    (id: string) => {
      const idx = blocks.findIndex((b) => b.id === id)
      if (idx <= 0) return
      const current = blocks[idx] as AnyVisualBlock
      const prev = blocks[idx - 1] as AnyVisualBlock
      const currentPlugin = getPlugin(current.type)
      const prevPlugin = getPlugin(prev.type)
      if (!prevPlugin.isText || !currentPlugin.isText) return

      const prevText = (prev.data as { text: string }).text
      const currentText = (current.data as { text: string }).text
      const mergedText = prevText + (currentText ? " " + currentText : "")
      const next = [...blocks]
      const mergedData = { ...(prev.data as object), text: mergedText }
      next[idx - 1] = { ...prev, data: mergedData } as AnyVisualBlock
      next.splice(idx, 1)
      setBlocks(next)
      syncToContent(next)
      setFocusedBlockId(prev.id)
    },
    [blocks, syncToContent]
  )

  const handleInsertAfter = useCallback(
    (id: string, type: BlockType) => {
      const idx = blocks.findIndex((b) => b.id === id)
      if (idx === -1) return
      const plugin = getPlugin(type)
      const newBlock = createBlock(type, structuredClone(plugin.defaultData))
      const next = [...blocks]
      next.splice(idx + 1, 0, newBlock)
      setBlocks(next)
      syncToContent(next)
      setFocusedBlockId(newBlock.id)
    },
    [blocks, syncToContent]
  )

  const handleFocus = useCallback((id: string) => setFocusedBlockId(id), [])
  const handleBlur = useCallback(() => setFocusedBlockId(null), [])
  const handleDragStart = useCallback((id: string | null) => setActiveId(id), [])

  const activeBlock = activeId ? blocks.find((b) => b.id === activeId) || null : null
  const latex = blocksToLaTeX(blocks)

  const handleFormatToggle = useCallback((key: keyof FormatState) => {
    const commandMap: Record<string, string> = {
      bold: "bold",
      italic: "italic",
      underline: "underline",
      strikethrough: "strikeThrough",
      superscript: "superscript",
      subscript: "subscript",
    }
    const command = commandMap[key]
    if (command) {
      document.execCommand(command, false)
    }
    if (key === "code") {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const html = `<code class="font-mono text-sm bg-[var(--visual-editor-tool-hover)] px-1 rounded">${selection.toString()}</code>`
        document.execCommand("insertHTML", false, html)
      }
    }
    setFormat(detectFormatFromSelection())
  }, [])

  const handleInlineMath = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    const text = selection.toString()
    const html = `<span data-math="true">$${text}$</span>`
    document.execCommand("insertHTML", false, html)
  }, [])

  const handleLink = useCallback(() => {
    const url = window.prompt("Enter URL")
    if (!url) return
    document.execCommand("createLink", false, url)
  }, [])

  const handleParagraphStyleChange = useCallback(
    (style: ParagraphStyle) => {
      if (!focusedBlock) return
      if (focusedBlock.type === "section") {
        const levelMap: Record<string, SectionData["level"]> = {
          "heading-1": "section",
          "heading-2": "subsection",
          "heading-3": "subsubsection",
        }
        const level = levelMap[style]
        if (level) {
          handleChange(focusedBlock.id, { ...(focusedBlock.data as object), level })
        }
      }
    },
    [focusedBlock, handleChange]
  )

  const handleListToggle = useCallback(
    (kind: "itemize" | "enumerate") => {
      if (!focusedBlock) return
      if (focusedBlock.type === "list") {
        handleChange(focusedBlock.id, { ...(focusedBlock.data as object), kind })
      } else {
        handleInsertAfter(focusedBlock.id, "list")
      }
    },
    [focusedBlock, handleChange, handleInsertAfter]
  )

  const handleIndent = useCallback((direction: "in" | "out") => {
    // Placeholder: actual indentation requires richer paragraph data model
  }, [])

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[var(--visual-editor-bg)]">
      {/* Formatting toolbar */}
      <FormattingToolbar
        paragraphStyle={paragraphStyle}
        format={format}
        isVisual={true}
        latexPanelOpen={showVisualLatexPanel}
        canUndo={false}
        canRedo={false}
        onParagraphStyleChange={handleParagraphStyleChange}
        onFormatToggle={handleFormatToggle}
        onInlineMath={handleInlineMath}
        onLink={handleLink}
        onListToggle={handleListToggle}
        onIndent={handleIndent}
        onInsert={handleAdd}
        onToggleLatexPanel={() => setShowVisualLatexPanel(!showVisualLatexPanel)}
        onToggleView={() => setActiveEditorTab("text")}
        onUndo={() => {}}
        onRedo={() => {}}
      />

      {/* Main workspace */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          <BlockCanvas
            blocks={blocks}
            activeId={activeId}
            activeBlock={activeBlock}
            focusedBlockId={focusedBlockId}
            onReorder={handleReorder}
            onChange={handleChange}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onDragStart={handleDragStart}
            onSplit={handleSplit}
            onMergeUp={handleMergeUp}
            onInsertAfter={handleInsertAfter}
            onInsertAt={handleInsertAt}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
          />

          {showVisualLatexPanel && (
            <>
              <div className="w-px bg-[var(--visual-editor-toolbar-border)] shrink-0" />
              <div className="w-72 shrink-0 bg-[var(--visual-editor-toolbar)] transition-all duration-200 ease-in-out">
                <LatexOutputPanel latex={latex} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status bar — Fable5 style, 34px */}
      <div
        className="shrink-0 h-[34px] flex items-center px-4 text-[11.5px]"
        style={{
          borderTop: "1px solid var(--visual-editor-toolbar-border)",
          background: "var(--visual-editor-toolbar)",
          color: "var(--visual-editor-text-dim)",
        }}
      >
        <span className="font-medium" style={{ color: "var(--visual-editor-text)" }}>
          {blocks.length} {blocks.length === 1 ? "block" : "blocks"}
        </span>
        <span className="mx-1.5">·</span>
        <span>{blocks.reduce((n, b) => {
          const text = (b.data as { text?: string })?.text || ""
          return n + (text.match(/\S+/g)?.length || 0)
        }, 0)} words</span>

        <span className="mx-3" style={{ color: "var(--visual-editor-toolbar-border)" }}>|</span>

        {/* Saved indicator */}
        <span className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "var(--saved)" }}
          />
          <span>{dirty ? "Saving…" : "Saved"}</span>
        </span>

        <span className="ml-auto">
          Click a block to select · Drag handle to reorder · Hover between blocks to insert
        </span>
      </div>
    </div>
  )
})
