"use client"

import { memo } from "react"
import { AnimatePresence, motion } from "framer-motion"
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
import type { AnyVisualBlock } from "@/lib/visual-editor/types"
import { BlockRenderer } from "./block-renderer"
import { cn } from "@/lib/utils"
import { LayoutTemplate, MousePointer2 } from "lucide-react"

interface BlockCanvasProps {
  blocks: AnyVisualBlock[]
  activeId: string | null
  activeBlock: AnyVisualBlock | null
  onReorder: (blocks: AnyVisualBlock[]) => void
  onChange: (id: string, data: unknown) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onDragStart: (id: string | null) => void
}

export const BlockCanvas = memo(function BlockCanvas({
  blocks,
  activeId,
  activeBlock,
  onReorder,
  onChange,
  onDelete,
  onDuplicate,
  onDragStart,
}: BlockCanvasProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
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
            "flex-1 overflow-y-auto px-5 py-5 space-y-4",
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
                  Select a block from the palette on the left to start building your document.
                </p>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <MousePointer2 className="h-3 w-3" />
                <span>Drag blocks to reorder</span>
              </div>
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              {blocks.map((block) => (
                <BlockRenderer
                  key={block.id}
                  block={block}
                  onChange={onChange}
                  onDelete={onDelete}
                  onDuplicate={onDuplicate}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </SortableContext>

      <DragOverlay dropAnimation={null}>
        {activeBlock ? (
          <BlockRenderer
            block={activeBlock}
            isOverlay
            onChange={() => {}}
            onDelete={() => {}}
            onDuplicate={() => {}}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
})
