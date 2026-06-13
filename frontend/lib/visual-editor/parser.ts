import type { AnyVisualBlock, BlockType } from "./types"
import { createBlock } from "./types"
import type { SectionData } from "./plugins/section"
import type { MathData } from "./plugins/math"
import type { ListData } from "./plugins/list"
import type { FigureData } from "./plugins/figure"
import type { TableData } from "./plugins/table"
import type { CodeData } from "./plugins/code"
import type { ParagraphData } from "./plugins/paragraph"

export function parseLaTeXToBlocks(latex: string): AnyVisualBlock[] {
  const lines = latex.split("\n")
  const blocks: AnyVisualBlock[] = []
  let i = 0

  function isEmpty(line: string) {
    return line.trim().length === 0
  }

  function isEnvStart(line: string) {
    return /^\\begin\{([^}]+)\}/.test(line.trim())
  }

  function getEnvName(line: string): string | null {
    const match = line.trim().match(/^\\begin\{([^}]+)\}/)
    return match ? match[1] : null
  }

  function isEnvEnd(line: string, envName: string) {
    return line.trim() === `\\end{${envName}}`
  }

  function isSection(line: string) {
    return /^\\(section|subsection|subsubsection)\{/.test(line.trim())
  }

  function consumeEnvironment(startIdx: number, envName: string): { inner: string[]; endIdx: number } {
    const inner: string[] = []
    let depth = 1
    let j = startIdx + 1
    while (j < lines.length && depth > 0) {
      const innerLine = lines[j]
      const innerEnv = getEnvName(innerLine)
      if (innerEnv && innerEnv === envName) depth++
      if (isEnvEnd(innerLine, envName)) depth--
      if (depth > 0) inner.push(innerLine)
      j++
    }
    return { inner, endIdx: j }
  }

  while (i < lines.length) {
    const line = lines[i]

    if (isEmpty(line) && blocks.length === 0) {
      i++
      continue
    }

    // Section headings
    if (isSection(line)) {
      const match = line.trim().match(/^\\(section|subsection|subsubsection)\{([^}]*)\}/)
      if (match) {
        const data: SectionData = {
          level: match[1] as SectionData["level"],
          title: match[2],
        }
        blocks.push(createBlock("section", data))
        i++
        continue
      }
    }

    // Environments
    if (isEnvStart(line)) {
      const envName = getEnvName(line)
      if (envName) {
        const { inner, endIdx } = consumeEnvironment(i, envName)
        i = endIdx

        const content = inner.join("\n").trim()

        if (envName === "equation") {
          const data: MathData = { latex: content }
          blocks.push(createBlock("math", data))
          continue
        }

        if (envName === "itemize" || envName === "enumerate") {
          const items = content
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.startsWith("\\item"))
            .map((l) => l.replace(/^\\item\s*/, "").trim())
          const data: ListData = { kind: envName, items }
          blocks.push(createBlock("list", data))
          continue
        }

        if (envName === "figure") {
          const srcMatch = content.match(/\\includegraphics\[[^\]]*\]\{([^}]+)\}/)
          const captionMatch = content.match(/\\caption\{([^}]*)\}/)
          const widthMatch = content.match(/width=([0-9.]+)\\textwidth/)
          const data: FigureData = {
            src: srcMatch ? srcMatch[1] : "image.png",
            caption: captionMatch ? captionMatch[1] : "",
            width: widthMatch ? widthMatch[1] : "0.8",
          }
          blocks.push(createBlock("figure", data))
          continue
        }

        if (envName === "table") {
          const tabularMatch = content.match(/\\begin\{tabular\}\{([^}]*)\}([\s\S]*)\\end\{tabular\}/)
          const captionMatch = content.match(/\\caption\{([^}]*)\}/)
          let rows: string[][] = []
          if (tabularMatch) {
            const body = tabularMatch[2].trim()
            rows = body
              .split("\\\\")
              .map((row) =>
                row
                  .split("&")
                  .map((cell) => cell.trim())
                  .filter((cell) => cell.length > 0)
              )
              .filter((row) => row.length > 0)
          }
          const data: TableData = {
            rows,
            caption: captionMatch ? captionMatch[1] : "",
          }
          blocks.push(createBlock("table", data))
          continue
        }

        if (envName === "lstlisting") {
          const optsMatch = line.match(/\\begin\{lstlisting\}(?:\[([^\]]*)\])?/)
          const language = optsMatch && optsMatch[1] ? optsMatch[1].replace(/language=/, "") : ""
          const data: CodeData = { language, code: content }
          blocks.push(createBlock("code", data))
          continue
        }

        // Unknown environment -> paragraph
        const data: ParagraphData = { text: `\\begin{${envName}}\n${content}\n\\end{${envName}}` }
        blocks.push(createBlock("paragraph", data))
        continue
      }
    }

    // Plain paragraph: collect consecutive non-empty, non-special lines
    if (!isEmpty(line) && !isSpecialLine(line)) {
      const textLines: string[] = []
      while (i < lines.length && !isEmpty(lines[i]) && !isSpecialLine(lines[i])) {
        textLines.push(lines[i])
        i++
      }
      const data: ParagraphData = { text: textLines.join("\n") }
      blocks.push(createBlock("paragraph", data))
      continue
    }

    i++
  }

  if (blocks.length === 0 && latex.trim()) {
    blocks.push(createBlock("paragraph", { text: latex.trim() }))
  }

  return blocks
}

function isSpecialLine(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length === 0) return false
  if (/^\\(section|subsection|subsubsection)\{/.test(trimmed)) return true
  if (/^\\begin\{/.test(trimmed)) return true
  if (/^\\end\{/.test(trimmed)) return true
  return false
}
