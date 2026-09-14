import type { VisualSpan } from './types'

interface Range { from:number; to:number }
const replacementKinds = new Set<VisualSpan['kind']>(['hidden','math','reference','preamble','figure','table','list-marker','environment','title'])

function lineStart(source:string,at:number):number { return source.lastIndexOf('\n',at-1)+1 }
function lineEnd(source:string,at:number):number { const end = source.indexOf('\n',at); return end < 0 ? source.length : end }

/** Only scanner-confirmed, balanced top-level lists form an indivisible block. */
function listRanges(source:string,spans:VisualSpan[]):Range[] {
  const result:Range[] = [], stack:{from:number;name:string}[] = []
  for (const span of spans) {
    if (span.kind !== 'environment' || !['itemize','enumerate'].includes(span.value || '')) continue
    const match = source.slice(span.from,span.to).match(/^\\(begin|end)\s*\{(itemize|enumerate)\}$/)
    if (!match) continue
    if (match[1] === 'begin') stack.push({from:span.from,name:match[2]})
    else {
      const opening = stack.pop()
      if (!opening || opening.name !== match[2]) { stack.length = 0; continue }
      if (!stack.length) result.push({from:opening.from,to:span.to})
    }
  }
  return result
}

/** Original-source line starts for separators; this never edits or serializes the document. */
export function getVisualBlockStarts(source:string,spans:VisualSpan[]):number[] {
  const ordered = [...spans].sort((a,b) => a.from-b.from || b.to-a.to)
  const ignored = ordered.filter(span => span.kind === 'comment' || span.kind === 'preamble' || (span.kind === 'environment' && span.value === 'document'))
  const lists = listRanges(source,ordered)
  const hiddenBefore = new Map(ordered.filter(span => span.kind === 'hidden').map(span => [span.to,span.from]))
  const hiddenAfter = new Map(ordered.filter(span => span.kind === 'hidden').map(span => [span.from,span.to]))
  const headings = ordered.filter(span => span.kind === 'heading').map(span => ({from:hiddenBefore.get(span.from) ?? span.from,to:hiddenAfter.get(span.to) ?? span.to}))
  const protectedRanges:Range[] = [...lists,...headings,...ordered.filter(span => span.kind === 'code' || replacementKinds.has(span.kind))]
    .sort((a,b) => a.from-b.from || b.to-a.to)
  const withoutComments = (from:number,to:number) => {
    let text = '', at = from
    for (const span of ignored) {
      if (span.to <= at || span.from >= to) continue
      text += source.slice(at,Math.max(at,span.from)); at = Math.max(at,span.to)
    }
    return text+source.slice(Math.min(at,to),to)
  }
  const standalone = (range:Range) => !source.slice(lineStart(source,range.from),range.from).trim() && !withoutComments(range.to,lineEnd(source,range.to)).trim()
  const atomic = [...lists,...ordered.filter(span => ['figure','table'].includes(span.kind) || (span.kind === 'math' && /^(?:\$\$|\\\[|\\begin\b)/.test(source.slice(span.from,span.to))))].filter(standalone)
  const atomicStarts = new Set(atomic.map(range => range.from))
  const headingStarts = new Set([...headings.map(range => range.from),...ordered.filter(span => span.kind === 'title').map(span => span.from)])
  const starts = new Set<number>()
  let seenContent = false, blank = false, afterAtomic = false, protectedIndex = 0, protectedThrough = 0
  for (let start=0;start<source.length;) {
    const end = lineEnd(source,start), next = end+1
    while (protectedIndex < protectedRanges.length && protectedRanges[protectedIndex].from < start) {
      protectedThrough = Math.max(protectedThrough,protectedRanges[protectedIndex++].to)
    }
    // Skipping whole continuation lines also prevents blank lines inside widgets becoming paragraphs.
    if (protectedThrough > start) { start = next; continue }
    const rawLine = source.slice(start,end)
    if (!rawLine.trim()) { blank = true; start = next; continue }
    if (!withoutComments(start,end).trim()) { start = next; continue }
    let content = start
    while (content < end) {
      if (/\s/.test(source[content])) { content++; continue }
      const skip = ignored.find(span => span.from <= content && span.to > content)
      if (!skip) break
      content = skip.to
    }
    const structural = atomicStarts.has(content)
    const heading = headingStarts.has(content)
    if (seenContent && (blank || afterAtomic || structural || heading)) starts.add(start)
    seenContent = true; blank = false; afterAtomic = Boolean(structural)
    start = next
  }
  return [...starts]
}
