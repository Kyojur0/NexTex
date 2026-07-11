import { getPlugin } from "./plugins"
import type { AnyVisualBlock } from "./types"

export function blocksToLaTeX(blocks: AnyVisualBlock[]): string {
  const parts = blocks.map((block) => {
    const plugin = getPlugin(block.type)
    return plugin.toLaTeX(block.data)
  })
  return parts.join("\n\n")
}
