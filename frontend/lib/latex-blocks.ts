/**
 * LaTeX block model — bidirectional conversion between visual blocks and LaTeX source.
 * This is intentionally simple/line-based rather than a full AST parser.
 */

export type BlockType =
  | 'heading'
  | 'paragraph'
  | 'equation'
  | 'figure'
  | 'table'
  | 'quote'
  | 'code'
  | 'list'
  | 'separator'

export interface DocumentBlock {
  id: string
  type: BlockType
  content: string
  label?: string
  collapsed?: boolean
  locked?: boolean
  meta?: Record<string, string>
}

let _idCounter = 0
function genId(): string {
  return `blk-${Date.now()}-${++_idCounter}`
}

// ---------------------------------------------------------------------------
// Block factory — creates a new block with sensible defaults
// ---------------------------------------------------------------------------

export function createBlock(type: BlockType, overrides?: Partial<DocumentBlock>): DocumentBlock {
  const defaults: Record<BlockType, Omit<DocumentBlock, 'id' | 'type'>> = {
    heading: { content: 'New Section', label: '\\section{...}' },
    paragraph: { content: 'Enter your text here...', label: '\\paragraph{}' },
    equation: { content: 'E = mc^2', label: '\\begin{equation}' },
    figure: { content: 'image.png', label: '\\begin{figure}[h]', meta: { caption: 'Figure caption' } },
    table: {
      content: '\\begin{tabular}{lll}\nA & B & C \\\\\n1 & 2 & 3 \\\\\n\\end{tabular}',
      label: '\\begin{table}[h]',
    },
    quote: { content: 'A famous quote goes here.', label: '\\begin{quote}' },
    code: { content: 'console.log("hello")', label: '\\begin{lstlisting}' },
    list: {
      content: '\\begin{itemize}\n\\item First item\n\\item Second item\n\\end{itemize}',
      label: '\\begin{itemize}',
    },
    separator: { content: '', label: '\\hline' },
  }
  const base = defaults[type]
  return {
    id: genId(),
    type,
    ...base,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Parser: LaTeX source → DocumentBlocks
// ---------------------------------------------------------------------------

export function parseLaTeXToBlocks(latex: string): DocumentBlock[] {
  const lines = latex.split('\n')
  const blocks: DocumentBlock[] = []
  let i = 0

  function isEmpty(line: string) {
    return line.trim().length === 0
  }

  function isEnvStart(line: string) {
    return /^\\begin\{([^}]+)\}/.test(line.trim())
  }

  function isEnvEnd(line: string, envName: string) {
    return line.trim() === `\\end{${envName}}`
  }

  function isSection(line: string) {
    return /^\\(section|subsection|subsubsection|paragraph)\{/.test(line.trim())
  }

  function isHLine(line: string) {
    return line.trim() === '\\hline' || line.trim() === '\\vspace' || line.trim().startsWith('\\vspace{')
  }

  while (i < lines.length) {
    const line = lines[i]

    // Skip leading empty lines
    if (isEmpty(line) && blocks.length === 0) {
      i++
      continue
    }

    // Section headings
    if (isSection(line)) {
      const match = line.trim().match(/^\\(section|subsection|subsubsection|paragraph)\{([^}]*)\}/)
      if (match) {
        blocks.push({
          id: genId(),
          type: 'heading',
          content: match[2],
          label: `\\${match[1]}{...}`,
        })
        i++
        continue
      }
    }

    // Environments
    if (isEnvStart(line)) {
      const startMatch = line.trim().match(/^\\begin\{([^}]+)\}/)
      if (startMatch) {
        const envName = startMatch[1]
        const startIdx = i
        let depth = 1
        i++
        while (i < lines.length && depth > 0) {
          const inner = lines[i]
          if (isEnvStart(inner)) depth++
          if (isEnvEnd(inner, envName)) depth--
          i++
        }
        const innerLines = lines.slice(startIdx + 1, i - 1)
        const innerContent = innerLines.join('\n')

        let type: BlockType = 'paragraph'
        if (envName === 'equation' || envName === 'align' || envName === 'eqnarray') type = 'equation'
        else if (envName === 'figure' || envName === 'figure*') type = 'figure'
        else if (envName === 'table' || envName === 'table*') type = 'table'
        else if (envName === 'quote' || envName === 'quotation') type = 'quote'
        else if (envName === 'lstlisting' || envName === 'verbatim' || envName === 'minted') type = 'code'
        else if (envName === 'itemize' || envName === 'enumerate' || envName === 'description') type = 'list'

        blocks.push({
          id: genId(),
          type,
          content: innerContent,
          label: `\\begin{${envName}}`,
        })
        continue
      }
    }

    // Horizontal rule / separator
    if (isHLine(line)) {
      blocks.push({ id: genId(), type: 'separator', content: '', label: '\\hline' })
      i++
      continue
    }

    // Collect consecutive plain text lines into a paragraph
    if (!isEmpty(line) && !isSpecialLine(line)) {
      const textLines: string[] = []
      while (i < lines.length && !isEmpty(lines[i]) && !isSpecialLine(lines[i])) {
        textLines.push(lines[i])
        i++
      }
      blocks.push({
        id: genId(),
        type: 'paragraph',
        content: textLines.join('\n'),
        label: '\\paragraph{}',
      })
      continue
    }

    // Empty line — skip
    i++
  }

  if (blocks.length === 0 && latex.trim()) {
    // Fallback: if nothing parsed but there is content, treat as one big paragraph
    blocks.push({ id: genId(), type: 'paragraph', content: latex, label: '\\paragraph{}' })
  }

  return blocks
}

function isSpecialLine(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length === 0) return false
  if (/^\\(section|subsection|subsubsection|paragraph)\{/.test(trimmed)) return true
  if (/^\\begin\{/.test(trimmed)) return true
  if (/^\\end\{/.test(trimmed)) return true
  if (trimmed === '\\hline') return true
  if (trimmed.startsWith('\\vspace')) return true
  return false
}

// ---------------------------------------------------------------------------
// Generator: DocumentBlocks → LaTeX source
// ---------------------------------------------------------------------------

export function blocksToLaTeX(blocks: DocumentBlock[]): string {
  const parts: string[] = []

  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
        parts.push(`\\section{${block.content}}`)
        break
      case 'paragraph':
        parts.push(block.content)
        break
      case 'equation':
        parts.push(`\\begin{equation}\n${block.content}\n\\end{equation}`)
        break
      case 'figure':
        parts.push(
          `\\begin{figure}[h]\n\\centering\n\\includegraphics[width=0.8\\textwidth]{${block.content || 'placeholder.png'}}\n\\caption{${block.meta?.caption || 'Figure caption'}}\n\\end{figure}`
        )
        break
      case 'table':
        if (block.content.trim().startsWith('\\begin{tabular}')) {
          parts.push(`\\begin{table}[h]\n\\centering\n${block.content}\n\\end{table}`)
        } else {
          parts.push(`\\begin{table}[h]\n\\centering\n\\begin{tabular}{lll}\n${block.content}\n\\end{tabular}\n\\end{table}`)
        }
        break
      case 'quote':
        parts.push(`\\begin{quote}\n${block.content}\n\\end{quote}`)
        break
      case 'code':
        parts.push(`\\begin{lstlisting}\n${block.content}\n\\end{lstlisting}`)
        break
      case 'list':
        if (block.content.trim().startsWith('\\begin{')) {
          parts.push(block.content)
        } else {
          const items = block.content
            .split('\n')
            .filter((l) => l.trim())
            .map((l) => `\\item ${l.trim()}`)
            .join('\n')
          parts.push(`\\begin{itemize}\n${items}\n\\end{itemize}`)
        }
        break
      case 'separator':
        parts.push('\\hline')
        break
      default:
        parts.push(block.content)
    }
  }

  return parts.join('\n\n')
}

// ---------------------------------------------------------------------------
// Block helpers
// ---------------------------------------------------------------------------

export function moveBlock(blocks: DocumentBlock[], id: string, direction: 'up' | 'down'): DocumentBlock[] {
  const idx = blocks.findIndex((b) => b.id === id)
  if (idx === -1) return blocks
  const newIdx = direction === 'up' ? idx - 1 : idx + 1
  if (newIdx < 0 || newIdx >= blocks.length) return blocks
  const copy = [...blocks]
  const [moved] = copy.splice(idx, 1)
  copy.splice(newIdx, 0, moved)
  return copy
}

export function duplicateBlock(blocks: DocumentBlock[], id: string): DocumentBlock[] {
  const idx = blocks.findIndex((b) => b.id === id)
  if (idx === -1) return blocks
  const copy = [...blocks]
  const original = copy[idx]
  copy.splice(idx + 1, 0, {
    ...original,
    id: genId(),
    collapsed: false,
  })
  return copy
}

export function deleteBlock(blocks: DocumentBlock[], id: string): DocumentBlock[] {
  return blocks.filter((b) => b.id !== id)
}

export function updateBlock(blocks: DocumentBlock[], id: string, updates: Partial<DocumentBlock>): DocumentBlock[] {
  return blocks.map((b) => (b.id === id ? { ...b, ...updates } : b))
}

export function insertBlockAfter(blocks: DocumentBlock[], afterId: string | null, block: DocumentBlock): DocumentBlock[] {
  if (!afterId) return [...blocks, block]
  const idx = blocks.findIndex((b) => b.id === afterId)
  if (idx === -1) return [...blocks, block]
  const copy = [...blocks]
  copy.splice(idx + 1, 0, block)
  return copy
}
