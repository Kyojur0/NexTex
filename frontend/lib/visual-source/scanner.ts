import { parseLaTeXToBlocks } from '../visual-editor/parser'
import type { VisualSpan } from './types'

interface Group { from:number; to:number; contentFrom:number; contentTo:number }
interface Command { name:string; from:number; to:number }
interface Environment extends Command { name:string; opening:boolean }

const styles: Record<string,VisualSpan['kind']> = {textbf:'bold',textit:'italic',emph:'italic',underline:'underline',sout:'strike'}
const headings: Record<string,number> = {section:1,subsection:2,subsubsection:3,paragraph:4,subparagraph:5}
const references = new Set(['cite','citep','citet','parencite','textcite','autocite','ref','eqref','pageref','autoref','cref','Cref','label'])
const verbatimEnvironments = new Set(['verbatim','verbatim*','lstlisting','minted'])
const mathEnvironments = new Set(['equation','equation*','align','align*','gather','gather*','multline','multline*','displaymath'])
const whitespace = (source:string, at:number, end:number) => { while (at < end && /\s/.test(source[at])) at++; return at }
const lineEnd = (source:string, at:number, end:number) => { while (at < end && !/[\r\n]/.test(source[at])) at++; return at }

/** A lexical group, not an evaluation of TeX. Escapes/comments cannot close it. */
function groupAt(source:string, from:number, end:number): Group | null {
  if (source[from] !== '{' && source[from] !== '[') return null
  const stack = [source[from] === '{' ? '}' : ']']
  for (let at=from+1;at<end;at++) {
    const char = source[at]
    if (char === '\\') { at++; continue }
    if (char === '%') { at = lineEnd(source,at,end)-1; continue }
    if (char === '{') stack.push('}')
    else if (char === '[' && stack[stack.length-1] === ']') stack.push(']')
    else if (char === stack[stack.length-1]) {
      stack.pop()
      if (!stack.length) return {from,to:at+1,contentFrom:from+1,contentTo:at}
    } else if (char === '}') return null
  }
  return null
}

function commandAt(source:string, from:number, end:number): Command | null {
  if (source[from] !== '\\' || from+1 >= end) return null
  const match = source.slice(from+1,end).match(/^[A-Za-z@]+/)
  return {name:match?.[0] || source[from+1],from,to:from+1+(match?.[0].length || 1)}
}

function environmentAt(source:string, command:Command, end:number): Environment | null {
  if (command.name !== 'begin' && command.name !== 'end') return null
  const group = groupAt(source,whitespace(source,command.to,end),end)
  if (!group || source[group.from] !== '{') return null
  const name = source.slice(group.contentFrom,group.contentTo)
  if (!/^[A-Za-z*]+$/.test(name)) return null
  return {from:command.from,to:group.to,name,opening:command.name === 'begin'}
}

function verbEnd(source:string, command:Command, end:number): number {
  let at = command.to
  if (source[at] === '*') at++
  if (at >= end || /\s/.test(source[at])) return lineEnd(source,at,end)
  const closing = source.indexOf(source[at],at+1)
  const newline = lineEnd(source,at,end)
  return closing < 0 || closing >= newline ? newline : closing+1
}

/** Treat unknown commands and all their balanced arguments as opaque source. */
function opaqueEnd(source:string, command:Command, end:number): number {
  let at = command.to
  if (source[at] === '*') at++
  while (at < end) {
    const next = whitespace(source,at,end)
    if (source[next] !== '{' && source[next] !== '[') break
    const group = groupAt(source,next,end)
    if (!group) return end
    at = group.to
  }
  return at
}

function closingEnvironment(source:string, opening:Environment, end:number): Environment | null {
  const stack = [opening.name]
  let at = opening.to
  if (verbatimEnvironments.has(opening.name)) {
    const closing = `\\end{${opening.name}}`, index = source.indexOf(closing,at)
    return index < 0 || index+closing.length > end ? null : {from:index,to:index+closing.length,name:opening.name,opening:false}
  }
  while (at < end) {
    if (source[at] === '%') { at = lineEnd(source,at,end); continue }
    if (source[at] === '{') { const group = groupAt(source,at,end); if (!group) return null; at = group.to; continue }
    const command = commandAt(source,at,end)
    if (!command) { at++; continue }
    if (command.name === 'verb') { at = verbEnd(source,command,end); continue }
    const environment = environmentAt(source,command,end)
    if (!environment) { at = opaqueEnd(source,command,end); continue }
    if (environment.opening) {
      if (verbatimEnvironments.has(environment.name)) {
        const close = closingEnvironment(source,environment,end)
        if (!close) return null
        at = close.to; continue
      }
      stack.push(environment.name)
    } else {
      if (stack.pop() !== environment.name) return null
      if (!stack.length) return environment
    }
    at = environment.to
  }
  return null
}

function mathAt(source:string, from:number, end:number): Group | null {
  const start = source.startsWith('$$',from) ? '$$' : source[from] === '$' ? '$' : source.slice(from,from+2)
  const close = start === '\\(' ? '\\)' : start === '\\[' ? '\\]' : start
  if (!['$','$$','\\(','\\['].includes(start)) return null
  for (let at=from+start.length;at<end;) {
    if (source[at] === '%') { at = lineEnd(source,at,end); continue }
    if (source.startsWith(close,at)) return {from,to:at+close.length,contentFrom:from+start.length,contentTo:at}
    at += source[at] === '\\' ? 2 : 1
  }
  return null
}

function standaloneMultiline(source:string, from:number, to:number): boolean {
  return /[\r\n]/.test(source.slice(from,to)) &&
    /^\s*$/.test(source.slice(source.lastIndexOf('\n',from-1)+1,from)) &&
    /^\s*$/.test(source.slice(to,lineEnd(source,to,source.length)))
}

function knownInline(source:string, depth=0): boolean {
  if (depth >= 64) return false
  for (let at=0;at<source.length;) {
    if (source[at] === '%') { at = lineEnd(source,at,source.length); continue }
    if (source[at] === '$' || source.startsWith('\\(',at)) {
      const math = mathAt(source,at,source.length); if (!math) return false; at = math.to; continue
    }
    const command = commandAt(source,at,source.length)
    if (command) {
      if (/^[%$&#_{}\\ ]$/.test(command.name)) { at = command.to; continue }
      if (!styles[command.name] && !references.has(command.name) && !['texttt','textsuperscript','textsubscript'].includes(command.name)) return false
      const group = groupAt(source,whitespace(source,command.to,source.length),source.length)
      if (!group || source[group.from] !== '{' || !knownInline(source.slice(group.contentFrom,group.contentTo),depth+1)) return false
      at = group.to; continue
    }
    if ('{}^_'.includes(source[at])) return false
    at++
  }
  return true
}

function simpleFigure(source:string, from:number, to:number): boolean {
  let graphics = 0, caption = 0, label = 0
  for (let at=from;at<to;) {
    at = whitespace(source,at,to); if (at === to) break
    if (source[at] === '%') { at = lineEnd(source,at,to); continue }
    const command = commandAt(source,at,to)
    if (!command) return false
    at = command.to
    if (command.name === 'centering') continue
    if (!['includegraphics','caption','label'].includes(command.name)) return false
    at = whitespace(source,at,to)
    if (source[at] === '[') {
      const options = groupAt(source,at,to)
      if (command.name !== 'includegraphics' || !options || !/^width=(?:\d*\.)?\d+\\(?:textwidth|linewidth)$/.test(source.slice(options.contentFrom,options.contentTo))) return false
      at = whitespace(source,options.to,to)
    }
    const group = groupAt(source,at,to)
    if (!group || source[at] !== '{') return false
    const value = source.slice(group.contentFrom,group.contentTo)
    if (command.name === 'includegraphics') { if (++graphics > 1 || !value || /[\\{}%]/.test(value)) return false }
    if (command.name === 'caption') { if (++caption > 1 || !knownInline(value)) return false }
    if (command.name === 'label') { if (++label > 1 || !/^[\w:./-]+$/.test(value)) return false }
    at = group.to
  }
  return graphics === 1
}

function simpleTabular(source:string, opening:Environment, closing:Environment): boolean {
  const format = groupAt(source,whitespace(source,opening.to,closing.from),closing.from)
  if (!format || source[format.from] !== '{' || !/^[lcr|]+$/.test(source.slice(format.contentFrom,format.contentTo))) return false
  const cols = source.slice(format.contentFrom,format.contentTo).replace(/\|/g,'').length
  if (!cols) return false
  const content = source.slice(format.to,closing.from)
  let row = '', columnCount = 1
  for (let at=0;at<content.length;) {
    if (content[at] === '%') { at = lineEnd(content,at,content.length); continue }
    if (content.startsWith('\\hline',at) && !/[A-Za-z]/.test(content[at+6] || '')) { at += 6; continue }
    if (content.startsWith('\\\\',at)) {
      if (columnCount !== cols || !knownInline(row)) return false
      row = ''; columnCount = 1; at += 2; continue
    }
    if (content[at] === '&') { columnCount++; row += ' '; at++; continue }
    const command = commandAt(content,at,content.length)
    if (command) { const next = opaqueEnd(content,command,content.length); row += content.slice(at,next); at = next; continue }
    if (content[at] === '{' || content[at] === '}') return false
    row += content[at++]
  }
  return (!row.trim() && columnCount === 1) || (columnCount === cols && knownInline(row))
}

function simpleTable(source:string, opening:Environment, closing:Environment, bodyFrom:number): boolean {
  if (opening.name === 'tabular') return simpleTabular(source,opening,closing)
  let table = false, caption = false, label = false
  for (let at=bodyFrom;at<closing.from;) {
    at = whitespace(source,at,closing.from); if (at === closing.from) break
    if (source[at] === '%') { at = lineEnd(source,at,closing.from); continue }
    const command = commandAt(source,at,closing.from)
    if (!command) return false
    at = command.to
    if (command.name === 'centering') continue
    const environment = environmentAt(source,command,closing.from)
    if (environment?.opening && environment.name === 'tabular' && !table) {
      const end = closingEnvironment(source,environment,closing.from)
      if (!end || !simpleTabular(source,environment,end)) return false
      table = true; at = end.to; continue
    }
    if (!['caption','label'].includes(command.name)) return false
    const group = groupAt(source,whitespace(source,at,closing.from),closing.from)
    if (!group || source[group.from] !== '{' || !knownInline(source.slice(group.contentFrom,group.contentTo))) return false
    if (command.name === 'caption') { if (caption) return false; caption = true }
    else { if (label) return false; label = true }
    at = group.to
  }
  return table
}

/** Scan original text into decoration ranges. Unknown syntax is opaque, never rewritten. */
export function scanVisualSource(source: string): VisualSpan[] {
  const spans: VisualSpan[] = []
  const code = (from:number,to:number) => { if (to > from) spans.push({kind:'code',from,to}) }
  const widget = (kind:VisualSpan['kind'],from:number,to:number,value:string,content?:Group) => spans.push({kind,from,to,value,block:standaloneMultiline(source,from,to) || (kind==='title' && /^\s*$/.test(source.slice(source.lastIndexOf('\n',from-1)+1,from)) && /^\s*$/.test(source.slice(to,lineEnd(source,to,source.length)))),...(content ? {contentFrom:content.contentFrom,contentTo:content.contentTo} : {})})
  let documentTitle = '', documentStart:Environment|null = null, documentEnd:Environment|null = null

  // Locate real document markers without interpreting macro arguments or verbatim content.
  for (let at=0;at<source.length;) {
    if (source[at] === '%') { at = lineEnd(source,at,source.length); continue }
    if (source[at] === '{') { const group = groupAt(source,at,source.length); if (!group) break; at = group.to; continue }
    const command = commandAt(source,at,source.length)
    if (!command) { at++; continue }
    if (command.name === 'verb') { at = verbEnd(source,command,source.length); continue }
    const environment = environmentAt(source,command,source.length)
    if (environment?.opening) {
      const closing = closingEnvironment(source,environment,source.length)
      if (environment.name === 'document') {
        if (!closing) return [{kind:'code',from:0,to:source.length}]
        documentStart = environment; documentEnd = closing; break
      }
      if (!closing) break
      at = closing.to; continue
    }
    if (command.name === 'title') {
      const group = groupAt(source,whitespace(source,command.to,source.length),source.length)
      if (group && source[group.from] === '{') documentTitle = source.slice(group.contentFrom,group.contentTo)
    }
    at = opaqueEnd(source,command,source.length)
  }

  interface List { ordered:boolean; item:number }
  function scan(from:number,to:number,lists:List[] = [],depth=0) {
    if (depth >= 64) { code(from,to); return }
    for (let at=from;at<to;) {
      if (source[at] === '%') { const end = lineEnd(source,at,to); spans.push({kind:'comment',from:at,to:end}); at = end; continue }
      if (source[at] === '$' || source.startsWith('\\(',at) || source.startsWith('\\[',at)) {
        const math = mathAt(source,at,to)
        if (!math) { code(at,to); return }
        widget('math',at,math.to,source.slice(math.contentFrom,math.contentTo),math); at = math.to; continue
      }
      if (source[at] === '{') {
        const group = groupAt(source,at,to); code(at,group?.to ?? to); at = group?.to ?? to; continue
      }
      const command = commandAt(source,at,to)
      if (!command) { at++; continue }
      if (command.name === 'verb') { const end = verbEnd(source,command,to); code(at,end); at = end; continue }
      const opening = environmentAt(source,command,to)
      if (opening?.opening) {
        const closing = closingEnvironment(source,opening,to)
        if (!closing) { code(at,to); return }
        let bodyFrom = whitespace(source,opening.to,closing.from)
        const options = source[bodyFrom] === '[' ? groupAt(source,bodyFrom,closing.from) : null
        if (source[bodyFrom] === '[' && !options) { code(at,closing.to); at = closing.to; continue }
        const optionEnd = options?.to ?? opening.to
        bodyFrom = options?.to ?? opening.to
        const floatOptions = !options || /^[htbpH!]+$/.test(source.slice(options.contentFrom,options.contentTo))
        if (!options && mathEnvironments.has(opening.name)) {
          widget('math',at,closing.to,source.slice(bodyFrom,closing.from),{from:at,to:closing.to,contentFrom:bodyFrom,contentTo:closing.from})
        } else if (!options && ['itemize','enumerate'].includes(opening.name)) {
          widget('environment',at,optionEnd,opening.name)
          scan(bodyFrom,closing.from,[...lists,{ordered:opening.name === 'enumerate',item:0}],depth+1)
          widget('environment',closing.from,closing.to,opening.name)
        } else if (opening.name === 'figure' && floatOptions && simpleFigure(source,bodyFrom,closing.from)) {
          widget('figure',at,closing.to,source.slice(at,closing.to),{from:at,to:closing.to,contentFrom:bodyFrom,contentTo:closing.from})
        } else if (['table','tabular'].includes(opening.name) && floatOptions && (simpleTable(source,opening,closing,bodyFrom) || (opening.name === 'table' && parseLaTeXToBlocks(source.slice(at,closing.to)).some(block => block.type === 'table')))) {
          widget('table',at,closing.to,source.slice(at,closing.to),{from:at,to:closing.to,contentFrom:bodyFrom,contentTo:closing.from})
        } else code(at,closing.to)
        at = closing.to; continue
      }
      if (command.name === 'item' && lists.length) {
        const next = whitespace(source,command.to,to)
        if (source[next] === '[') { const end = opaqueEnd(source,command,to); code(at,end); at = end; continue }
        const list = lists[lists.length-1]
        spans.push({kind:'list-marker',from:at,to:command.to,value:list.ordered ? `${++list.item}.` : '•',level:lists.length,block:false})
        at = command.to; continue
      }
      if (command.name === 'maketitle' && documentTitle) { widget('title',at,command.to,documentTitle); at = command.to; continue }
      if (styles[command.name] || headings[command.name]) {
        let argumentAt = command.to
        if (headings[command.name] && source[argumentAt] === '*') argumentAt++
        const group = groupAt(source,whitespace(source,argumentAt,to),to)
        if (group && source[group.from] === '{') {
          spans.push({kind:'hidden',from:at,to:group.contentFrom})
          if (group.contentFrom < group.contentTo) spans.push({kind:headings[command.name] ? 'heading' : styles[command.name],from:group.contentFrom,to:group.contentTo,...(headings[command.name] ? {level:headings[command.name]} : {})})
          scan(group.contentFrom,group.contentTo,lists,depth+1)
          spans.push({kind:'hidden',from:group.contentTo,to:group.to})
          at = group.to; continue
        }
      }
      if (references.has(command.name)) {
        let next = whitespace(source,command.to,to)
        for (let index=0;index<2 && source[next] === '[';index++) { const option = groupAt(source,next,to); if (!option) break; next = whitespace(source,option.to,to) }
        const group = groupAt(source,next,to)
        if (group && source[group.from] === '{' && /^[\w:.,/\s-]+$/.test(source.slice(group.contentFrom,group.contentTo))) {
          widget('reference',at,group.to,source.slice(group.contentFrom,group.contentTo),group); at = group.to; continue
        }
      }
      const end = opaqueEnd(source,command,to)
      if (/^[A-Za-z@]+$/.test(command.name)) code(at,end)
      at = end
    }
  }

  if (documentStart && documentEnd) {
    widget('preamble',0,documentStart.to,source.slice(0,documentStart.to))
    scan(documentStart.to,documentEnd.from)
    widget('environment',documentEnd.from,documentEnd.to,'document')
    scan(documentEnd.to,source.length)
  } else scan(0,source.length)
  return spans.sort((a,b) => a.from-b.from || b.to-a.to)
}
