import { getPlugin } from "./plugins"
import type { AnyVisualBlock } from "./types"

export function blocksToLaTeX(blocks: AnyVisualBlock[]): string {
  let result = ""
  blocks.forEach((block,index) => {
    let output = block.source && block.source.data === JSON.stringify(block.data)
      ? block.source.latex
      : (block.source?.prefix || "") + getPlugin(block.type).toLaTeX(block.data) + (block.source?.suffix || "")
    const originalNeighbor = block.source && block.source.previousId === blocks[index - 1]?.id
    if (index > 0 && !originalNeighbor && !/\n\s*$/.test(result) && !/^\s*\n/.test(output)) output = "\n\n" + output
    // A new block needs a separator on both sides; existing lexemes stay unchanged.
    if (!block.source && !output.endsWith("\n") && index < blocks.length - 1) output += "\n\n"
    result += output
  })
  return result
}
