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
import { InsertBlockButton } from "@/lib/visual-editor/components/insert-block-button"
import { cn } from "@/lib/utils"
import { LayoutTemplate, MousePointer2 } from "lucide-react"

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
      <SortableContext
        items={blocks.map((b) => b.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          data-testid="block-canvas"
          className={cn(
            "flex-1 overflow-y-auto px-5 py-5 space-y-1",
            blocks.length === 0 && "flex items-center justify-center"
          )}
        >
          {blocks.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center text-center gap-4 text-muted-foreground/60 max-w-xs"
            >
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                <LayoutTemplate className="h-8 w-8 opacity-50" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground/70">Your document is empty</p>
                <p className="text-xs mt-1 leading-relaxed">
                  Select a block from the palette or click + to start building.
                </p>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <MousePointer2 className="h-3 w-3" />
                <span>Drag blocks to reorder</span>
              </div>
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              {blocks.map((block, idx) => (
                <div key={block.id} className="space-y-1">
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
                  <InsertBlockButton onInsert={(type) => onInsertAt(idx + 1, type)} />
                </div>
              ))}
            </AnimatePresence>
          )}
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
