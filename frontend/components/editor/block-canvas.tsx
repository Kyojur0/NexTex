"use client"

import { memo } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { AnimatePresence, motion } from "framer-motion"
import type { AnyVisualBlock, BlockType } from "@/lib/visual-editor/types"
import { BlockRenderer } from "./block-renderer"
import { InsertLine } from "@/lib/visual-editor/components/insert-line"
import { cn } from "@/lib/utils"
import { FileText } from "lucide-react"

interface BlockCanvasProps {
  blocks: AnyVisualBlock[]
  activeId: string | null
  activeBlock: AnyVisualBlock | null
  focusedBlockId: string | null
  onReorder: (blocks: AnyVisualBlock[]) => void
  onChange: (id: string, data: unknown) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onFocus: (id: string) => void
  onBlur: () => void
  onDragStart: (id: string | null) => void
  onSplit: (id: string, beforeData: unknown, afterData: unknown) => void
  onMergeUp: (id: string) => void
  onInsertAfter: (id: string, type: BlockType) => void
  onInsertAt: (index: number, type: BlockType) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

export const BlockCanvas = memo(function BlockCanvas({
  blocks,
  activeId,
  activeBlock,
  focusedBlockId,
  onReorder,
  onChange,
  onDelete,
  onDuplicate,
  onFocus,
  onBlur,
  onDragStart,
  onSplit,
  onMergeUp,
  onInsertAfter,
  onInsertAt,
  onMoveUp,
  onMoveDown,
}: BlockCanvasProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    onDragStart(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id)
      const newIndex = blocks.findIndex((b) => b.id === over.id)
      onReorder(arrayMove(blocks, oldIndex, newIndex))
    }
    onDragStart(null)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <div
          data-testid="block-canvas"
          className="flex-1 overflow-y-auto px-4 py-8 bg-[var(--visual-editor-bg)]"
        >
          <div
            className={cn(
              "max-w-[850px] w-full mx-auto min-h-[calc(100%-4rem)]",
              "bg-[var(--visual-editor-canvas)] border border-[var(--visual-editor-canvas-border)] rounded-lg shadow-2xl",
              "px-16 py-16"
            )}
          >
            {blocks.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center text-center gap-4 text-[var(--visual-editor-text-dim)] max-w-xs mx-auto py-20"
              >
                <div className="w-16 h-16 rounded-2xl bg-[var(--visual-editor-tool-hover)] flex items-center justify-center">
                  <FileText className="h-8 w-8 opacity-50" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--visual-editor-text)]">Your document is empty</p>
                  <p className="text-xs mt-1 leading-relaxed">
                    Type below or use the Insert menu to start building your document.
                  </p>
                </div>
              </motion.div>
            ) : (
              <AnimatePresence mode="popLayout">
                {blocks.map((block, idx) => (
                  <div key={block.id}>
                    <BlockRenderer
                      block={block}
                      isActive={focusedBlockId === block.id}
                      index={idx}
                      total={blocks.length}
                      onChange={onChange}
                      onDelete={onDelete}
                      onDuplicate={onDuplicate}
                      onFocus={onFocus}
                      onBlur={onBlur}
                      onSplit={onSplit}
                      onMergeUp={onMergeUp}
                      onInsertAfter={onInsertAfter}
                      onMoveUp={onMoveUp}
                      onMoveDown={onMoveDown}
                    />
                    <InsertLine onInsert={(type) => onInsertAt(idx + 1, type)} />
                  </div>
                ))}
              </AnimatePresence>
            )}

            {blocks.length === 0 && (
              <div className="mt-4">
                <InsertLine onInsert={(type) => onInsertAt(0, type)} />
              </div>
            )}
          </div>
        </div>
      </SortableContext>

      <DragOverlay dropAnimation={null}>
        {activeBlock ? (
          <BlockRenderer
            block={activeBlock}
            isActive={false}
            isOverlay
            index={0}
            total={1}
            onChange={() => {}}
            onDelete={() => {}}
            onDuplicate={() => {}}
            onFocus={() => {}}
            onBlur={() => {}}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
})
