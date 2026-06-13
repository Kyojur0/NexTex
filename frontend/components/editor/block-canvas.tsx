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
import type { AnyVisualBlock } from "@/lib/visual-editor/types"
import { BlockRenderer } from "./block-renderer"
import { cn } from "@/lib/utils"

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
            "flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-muted/10",
            blocks.length === 0 && "flex items-center justify-center"
          )}
        >
          {blocks.length === 0 ? (
            <div className="text-center text-muted-foreground/60">
              <p className="text-sm">Your document is empty.</p>
              <p className="text-xs mt-1">
                Select a block from the palette to get started.
              </p>
            </div>
          ) : (
            blocks.map((block) => (
              <BlockRenderer
                key={block.id}
                block={block}
                onChange={onChange}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
              />
            ))
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
