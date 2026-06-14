"use client"

import { memo, useState, useEffect, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import { useEditorStore } from "@/lib/store"
import { parseLaTeXToBlocks } from "@/lib/visual-editor/parser"
import { blocksToLaTeX } from "@/lib/visual-editor/serializer"
import { getPlugin } from "@/lib/visual-editor/plugins"
import type { AnyVisualBlock, BlockType } from "@/lib/visual-editor/types"
import { createBlock } from "@/lib/visual-editor/types"
import { BlockSidebar } from "./block-sidebar"
import { BlockCanvas } from "./block-canvas"
import { LatexOutputPanel } from "./latex-output-panel"
import { Check, Pencil, Code2, Eye, LayoutTemplate } from "lucide-react"

export const VisualEditor = memo(function VisualEditor() {
  const content = useEditorStore((s) => s.content)
  const setContent = useEditorStore((s) => s.setContent)
  const setIsModified = useEditorStore((s) => s.setIsModified)

  const [blocks, setBlocks] = useState<AnyVisualBlock[]>(() => parseLaTeXToBlocks(content))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null)
  const [showOutput, setShowOutput] = useState(true)
  const [dirty, setDirty] = useState(false)

  const contentRef = useRef(content)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blockRefs = useRef<Record<string, HTMLElement>>({})

  useEffect(() => {
    if (content !== contentRef.current) {
      setBlocks(parseLaTeXToBlocks(content))
      contentRef.current = content
      setDirty(false)
    }
  }, [content])

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

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-foreground/90">
            <LayoutTemplate className="h-4 w-4 text-primary/80" />
            <span className="text-sm font-medium">Visual Editor</span>
          </div>
          {dirty && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-600 dark:text-amber-400">
              <Pencil className="h-2.5 w-2.5" />
              Unsaved
            </span>
          )}
          {!dirty && blocks.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3" />
              Synced
            </span>
          )}
        </div>
        <button
          onClick={() => setShowOutput((s) => !s)}
          className={cn(
            "inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg transition-all",
            showOutput
              ? "bg-foreground text-background shadow-elevated"
              : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
          )}
        >
          {showOutput ? <Eye className="h-3 w-3" /> : <Code2 className="h-3 w-3" />}
          {showOutput ? "Hide LaTeX" : "Show LaTeX"}
        </button>
      </div>

      {/* Main workspace */}
      <div className="flex-1 flex overflow-hidden">
        <BlockSidebar onAdd={handleAdd} />

        <div className="flex-1 flex overflow-hidden bg-muted/10">
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

          {showOutput && (
            <>
              <div className="w-px bg-border/40 shrink-0" />
              <div className="w-72 shrink-0">
                <LatexOutputPanel latex={latex} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-t border-border/60 bg-muted/30 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="tabular-nums">{blocks.length} blocks</span>
          <span className="text-border">•</span>
          <span>Click any block to edit inline</span>
        </div>
        <span>Changes sync to the text editor automatically</span>
      </div>
    </div>
  )
})
