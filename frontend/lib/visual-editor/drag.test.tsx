import { render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DndContext, useDndContext } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { BlockRenderer } from '@/components/editor/block-renderer'
import { createBlock } from './types'

describe('visual drag registration', () => {
  it('keeps original drag geometry when the visual overlay mounts and excludes document boundaries', async () => {
    const block = createBlock('paragraph',{text:'Movable paragraph.'})
    const boundary = {...createBlock('raw',{latex:'\\begin{document}'}),boundary:'start' as const}
    let context: ReturnType<typeof useDndContext>
    function Probe() { context = useDndContext(); return null }
    const handlers = {onChange:vi.fn(),onDelete:vi.fn(),onDuplicate:vi.fn(),onFocus:vi.fn(),onBlur:vi.fn()}
    const {container} = render(<DndContext><SortableContext items={[boundary.id,block.id]}>
      <div data-testid="original"><BlockRenderer block={block} isActive={false} index={1} total={2} {...handlers}/></div>
      <BlockRenderer block={boundary} isActive={false} index={0} total={2} {...handlers}/>
      <BlockRenderer block={block} isActive={false} isOverlay index={0} total={1} {...handlers}/>
      <Probe/>
    </SortableContext></DndContext>)
    await waitFor(() => {
      const original = container.querySelector('[data-testid="original"]')!
      expect(original.contains(context.draggableNodes.get(block.id)!.node.current)).toBe(true)
      expect(context.droppableContainers.get(boundary.id)?.disabled).toBe(true)
    })
  })
})
