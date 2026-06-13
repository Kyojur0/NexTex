import type { BlockPlugin, BlockType } from "../types"
import { paragraphPlugin } from "./paragraph"
import { sectionPlugin } from "./section"
import { mathPlugin } from "./math"
import { listPlugin } from "./list"
import { figurePlugin } from "./figure"
import { tablePlugin } from "./table"
import { codePlugin } from "./code"

export * from "./paragraph"
export * from "./section"
export * from "./math"
export * from "./list"
export * from "./figure"
export * from "./table"
export * from "./code"

const registry = new Map<BlockType, BlockPlugin<unknown>>([
  [paragraphPlugin.type, paragraphPlugin as BlockPlugin<unknown>],
  [sectionPlugin.type, sectionPlugin as BlockPlugin<unknown>],
  [mathPlugin.type, mathPlugin as BlockPlugin<unknown>],
  [listPlugin.type, listPlugin as BlockPlugin<unknown>],
  [figurePlugin.type, figurePlugin as BlockPlugin<unknown>],
  [tablePlugin.type, tablePlugin as BlockPlugin<unknown>],
  [codePlugin.type, codePlugin as BlockPlugin<unknown>],
])

export function getPlugin<T>(type: BlockType): BlockPlugin<T> {
  const plugin = registry.get(type)
  if (!plugin) {
    throw new Error(`No plugin registered for block type: ${type}`)
  }
  return plugin as BlockPlugin<T>
}

export function getAllPlugins(): BlockPlugin<unknown>[] {
  return Array.from(registry.values())
}
