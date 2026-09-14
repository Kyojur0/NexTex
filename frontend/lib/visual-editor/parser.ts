import type { AnyVisualBlock, BlockType } from './types'
import { createBlock } from './types'
import type { TableData, TableCell } from './plugins/table'

/** Balanced TeX group reader. Escaped braces do not change nesting. */
export function readGroup(text: string, at: number): { value: string; end: number } | null {
  if (text[at] !== '{') return null
  let depth = 1
  for (let i = at + 1; i < text.length; i++) {
    if (text[i] === '\\') { i++; continue }
    if (text[i] === '{') depth++
    if (text[i] === '}' && --depth === 0) return { value: text.slice(at + 1, i), end: i + 1 }
  }
  return null
}

// Tokens in comments or verbatim bodies cannot act as document boundaries.
function environmentTokens(text: string) {
  const tokens: { kind: string; name: string; start: number; end: number }[] = []
  const re = /%[^\r\n]*|\\\\|\\%|\\(begin|end)\{([^}]+)\}/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    if (!match[1]) continue
    tokens.push({ kind: match[1], name: match[2], start: match.index, end: re.lastIndex })
    if (match[1] === 'begin' && ['verbatim', 'verbatim*', 'lstlisting', 'minted'].includes(match[2])) {
      const closing = `\\end{${match[2]}}`
      const end = text.indexOf(closing, re.lastIndex)
      if (end < 0) break
      tokens.push({ kind: 'end', name: match[2], start: end, end: end + closing.length })
      re.lastIndex = end + closing.length
    }
  }
  return tokens
}

function matchingEnd(text: string): { start: number; end: number } | null {
  const stack: string[] = []
  for (const token of environmentTokens(text)) {
    if (token.kind === 'begin') stack.push(token.name)
    else {
      if (stack.pop() !== token.name) return null
      if (!stack.length) return token
    }
  }
  return null
}

/** Only supported inline commands enter rich text; everything else stays raw. */
export function isSupportedInline(text: string): boolean {
  let i = 0
  while (i < text.length) {
    if (text[i] === '%') return false
    if (text[i] === '$') {
      const closing = text.indexOf('$', i + 1)
      if (closing < 0) return false
      i = closing + 1; continue
    }
    if (text[i] !== '\\') { if ('{}^_'.includes(text[i])) return false; i++; continue }
    if (/[&%$#_{}~^\\]/.test(text[i + 1] || '')) { i += 2; continue }
    const command = text.slice(i).match(/^\\(textbf|textit|emph|underline|sout|texttt|textsuperscript|textsubscript|href|textbackslash|textasciitilde|textasciicircum)\b/)
    if (!command) return false
    i += command[0].length
    const group = readGroup(text, i)
    if (!group) return false
    if (command[1] === 'href') {
      const label = readGroup(text, group.end)
      if (!label || !isSupportedInline(label.value)) return false
      i = label.end
    } else {
      if (!isSupportedInline(group.value)) return false
      i = group.end
    }
  }
  return true
}

function sourceBlock(type: BlockType, data: unknown, lexeme: string, prefix = '', suffix = ''): AnyVisualBlock {
  return { ...createBlock(type, data), source: { latex: lexeme, data: JSON.stringify(data), prefix, suffix } }
}

function parseTable(content: string): TableData | null {
  const tabular = content.match(/^\s*(?:\\centering\s*)?\\begin\{tabular\}\{([lcr|]+)\}([\s\S]*?)\\end\{tabular\}\s*([\s\S]*)$/)
  if (!tabular) return null
  const tail = tabular[3].trim()
  let caption = ''
  if (tail.startsWith('\\caption')) {
    const group = readGroup(tail, 8)
    if (!group || tail.slice(group.end).trim()) return null
    caption = group.value
  } else if (tail) return null
  if (!isSupportedInline(caption)) return null
  const cols = tabular[1].replace(/\|/g, '').length
  const body = tabular[2].trim().replace(/^\\hline\s*/, '').replace(/\\hline\s*$/, '').trim()
  const rawRows = splitTopLevel(body, '\\\\').filter((row, index, all) => row.trim() || index < all.length - 1)
  if (rawRows.some(row => /\\(?:hline|cline|toprule|midrule|bottomrule)/.test(row))) return null
  const rows: TableCell[][] = rawRows.map(() => Array.from({length:cols}, () => ({content:'',colspan:1,rowspan:1})))
  for (let r = 0; r < rawRows.length; r++) {
    const cells = splitTopLevel(rawRows[r], '&')
    let c = 0
    for (let cell of cells) {
      if (c >= cols) return null
      cell = cell.trim()
      if (rows[r][c].hidden) {
        if (cell) return null
        c++; continue
      }
      let colspan = 1, rowspan = 1, alignment: string | undefined
      for (let pass = 0; pass < 2; pass++) {
        const command = cell.match(/^\\(multicolumn|multirow)/)
        if (!command) break
        const amount = readGroup(cell, command[0].length)
        const format = amount && readGroup(cell, amount.end)
        const value = format && readGroup(cell, format.end)
        if (!amount || !format || !value || cell.slice(value.end).trim()) return null
        const n = Number(amount.value)
        if (!Number.isInteger(n) || n < 1) return null
        if (command[1] === 'multicolumn') { if (!/^[lcr|]+$/.test(format.value)) return null; colspan = n; alignment = format.value }
        else { if (format.value !== '*') return null; rowspan = n }
        cell = value.value
      }
      if (c + colspan > cols || r + rowspan > rows.length || !isSupportedInline(cell)) return null
      rows[r][c] = {content:cell,colspan,rowspan,...(alignment ? {alignment} : {})}
      for (let rr = r; rr < r + rowspan; rr++) for (let cc = c; cc < c + colspan; cc++) {
        if (rr === r && cc === c) continue
        if (rows[rr][cc].hidden) return null
        rows[rr][cc] = {content:'',colspan:1,rowspan:1,hidden:true}
      }
      c += colspan
    }
    if (c !== cols) return null
  }
  return { rows, caption, alignment: tabular[1], centered: /^\s*\\centering\b/.test(content), hasCaption: Boolean(tail), topRule: /^\s*\\hline\b/.test(tabular[2]), bottomRule: /\\hline\s*$/.test(tabular[2]) }
}

function splitTopLevel(text: string, separator: string): string[] {
  const result: string[] = []; let start = 0, depth = 0
  for (let i = 0; i < text.length; i++) {
    if (depth === 0 && text.startsWith(separator, i)) { result.push(text.slice(start, i)); i += separator.length - 1; start = i + 1; continue }
    if (text[i] === '\\') { i++; continue }
    if (text[i] === '{') depth++
    if (text[i] === '}') depth--
  }
  result.push(text.slice(start)); return result
}

function classify(core: string): { type: BlockType; data: unknown } {
  const raw = { type: 'raw' as const, data: { latex: core } }
  const heading = core.match(/^\\(section|subsection|subsubsection)(\*)?/)
  if (heading) {
    const group = readGroup(core, heading[0].length)
    if (!group || core.slice(group.end).trim() || !isSupportedInline(group.value)) return raw
    return {type:'section',data:{level:heading[1],title:group.value,...(heading[2] ? {starred:true} : {})}}
  }
  const begin = core.match(/^\\begin\{([^}]+)\}(\[[^\]]*\])?\s*/)
  if (begin) {
    const ending = matchingEnd(core)
    if (!ending || core.slice(ending.end).trim()) return raw
    const body = core.slice(begin[0].length, ending.start).trim()
    const name = begin[1]
    if ((name === 'equation' || name === 'equation*') && !begin[2]) return {type:'math',data:{latex:body,numbered:name === 'equation'}}
    if ((name === 'itemize' || name === 'enumerate') && !/\\(?:begin|end)\{|\\item\[/.test(body)) {
      const pieces = body.split(/\\item\b/)
      if (pieces[0].trim()) return raw
      const items = pieces.slice(1).map(item => item.trim())
      if (!items.every(isSupportedInline)) return raw
      return {type:'list',data:{kind:name,items,options:begin[2] || ''}}
    }
    if (name === 'lstlisting' && (!begin[2] || /^\[language=[\w+-]+\]$/.test(begin[2]))) {
      const code = core.slice(begin[0].trimEnd().length,ending.start).replace(/^\r?\n/, '').replace(/\r?\n$/, '')
      return {type:'code',data:{language:begin[2]?.slice(10,-1) || '',code}}
    }
    if (name === 'table') {
      const data = parseTable(body)
      if (data) return {type:'table',data:{...data,placement:begin[2] || ''}}
    }
    if (name === 'figure') {
      const figure = body.match(/^(?:\\centering\s*)?\\includegraphics(?:\[width=([\d.]+)\\textwidth\])?\{([^{}]+)\}\s*/)
      if (!figure) return raw
      const tail = body.slice(figure[0].length)
      const caption = tail.startsWith('\\caption') ? readGroup(tail,8) : null
      if (tail && (!caption || tail.slice(caption.end).trim())) return raw
      if (caption && !isSupportedInline(caption.value)) return raw
      return {type:'figure',data:{src:figure[2],width:figure[1] || '1',caption:caption?.value || '',placement:begin[2] || '',hasWidth:Boolean(figure[1]),centered:/^\\centering\b/.test(body),hasCaption:Boolean(caption)}}
    }
    return raw
  }
  if (isSupportedInline(core)) return {type:'paragraph',data:{text:core}}
  return raw
}

/** Conservative parser: any construct that cannot be represented remains editable source. */
export function parseLaTeXToBlocks(latex: string): AnyVisualBlock[] {
  const finish = (blocks: AnyVisualBlock[]) => {
    blocks.forEach((block,index) => { if (block.source) block.source.previousId = blocks[index - 1]?.id })
    return blocks
  }
  const tokens = environmentTokens(latex)
  const doc = tokens.find(token => token.kind === 'begin' && token.name === 'document')
  if (doc) {
    const end = matchingEnd(latex.slice(doc.start))
    if (end) {
      const bodyEnd = doc.start + end.start
      const start = sourceBlock('raw',{latex:latex.slice(0,doc.end)},latex.slice(0,doc.end))
      start.boundary = 'start'
      const ending = sourceBlock('raw',{latex:latex.slice(bodyEnd)},latex.slice(bodyEnd))
      ending.boundary = 'end'
      return finish([start,...parseFragment(latex.slice(doc.end,bodyEnd)),ending])
    }
    return finish([sourceBlock('raw',{latex},latex)])
  }
  return finish(parseFragment(latex))
}

function parseFragment(latex: string): AnyVisualBlock[] {
  const blocks: AnyVisualBlock[] = []
  let at = 0
  while (at < latex.length) {
    const start = at
    const whitespace = latex.slice(at).match(/^\s*/)?.[0] || ''
    at += whitespace.length
    if (at === latex.length) {
      if (blocks.length) {
        const previous = blocks[blocks.length - 1].source!
        previous.latex += whitespace; previous.suffix += whitespace
      } else if (whitespace) blocks.push(sourceBlock('raw',{latex:''},whitespace,whitespace))
      break
    }
    const rest = latex.slice(at)
    let length: number
    if (rest.startsWith('\\begin{')) {
      const end = matchingEnd(rest)
      length = end?.end ?? rest.length
      // Keep trailing same-line commands attached; classify conservatively.
      const after = rest.slice(length).match(/^[^\r\n]*/)?.[0] || ''
      length += after.length
    } else if (/^\\(?:section|subsection|subsubsection)\b/.test(rest)) {
      const first = rest.indexOf('\n')
      length = first < 0 ? rest.length : first
    } else {
      const boundary = rest.search(/\r?\n(?:[ \t]*\r?\n|[ \t]*\\(?:begin|end|section|subsection|subsubsection)\b)/)
      length = boundary < 0 ? rest.length : boundary
    }
    const chunk = rest.slice(0,length)
    const core = chunk.trimEnd()
    const suffix = chunk.slice(core.length)
    const parsed = classify(core)
    blocks.push(sourceBlock(parsed.type,parsed.data,latex.slice(start,at + length),whitespace,suffix))
    at += length
  }
  return blocks
}
