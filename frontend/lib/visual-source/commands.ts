import type { InlineFormat, SourceEdit, SourceSelection } from './types'

type Change = SourceEdit['changes'][number]
type Range = { from: number; to: number }
type Guard = Range & { kind: 'opaque' | 'syntax' | 'structural' }
type GroupCommand = Range & { name: string; nameTo: number; contentFrom: number; contentTo: number }
type List = { open: GroupCommand; close: GroupCommand; items: (Range & { label: boolean })[] }
type Index = { formats: GroupCommand[]; headings: GroupCommand[]; lists: List[]; guards: Guard[] }

const formatCommands: Record<InlineFormat,string> = { bold:'textbf', italic:'textit', underline:'underline', strike:'sout' }
const commandFormats: Record<string,InlineFormat> = { textbf:'bold', textit:'italic', emph:'italic', underline:'underline', sout:'strike' }
const headingCommands = ['', 'section', 'subsection', 'subsubsection']

function normalize(source:string, selection:SourceSelection):SourceSelection {
  const position = (value:number) => Math.max(0,Math.min(source.length,Number.isFinite(value) ? Math.trunc(value) : 0))
  const a=position(selection.from), b=position(selection.to)
  return {from:Math.min(a,b),to:Math.max(a,b)}
}
function unchanged(selection:SourceSelection):SourceEdit {
  return {changes:[],selection:selection.from === selection.to ? {anchor:selection.from} : {anchor:selection.from,head:selection.to}}
}
function mapPosition(position:number, changes:Change[]) {
  let offset=0
  for (const change of changes) {
    if (position < change.from) break
    if (position <= change.to) return change.from + offset + Math.min(position-change.from,change.insert.length)
    offset += change.insert.length-(change.to-change.from)
  }
  return position+offset
}
function mappedEdit(changes:Change[],selection:SourceSelection):SourceEdit {
  changes.sort((a,b) => a.from-b.from)
  const anchor=mapPosition(selection.from,changes)
  return {changes,selection:selection.from === selection.to ? {anchor} : {anchor,head:mapPosition(selection.to,changes)}}
}
function lineRange(source:string,at:number):Range {
  const from=at ? source.lastIndexOf('\n',at-1)+1 : 0
  let to=source.indexOf('\n',at)
  if (to < 0) to=source.length
  if (source[to-1] === '\r') to--
  return {from,to}
}
function trimRange(source:string,range:Range):Range {
  const text=source.slice(range.from,range.to)
  const leading=text.match(/^\s*/)?.[0].length ?? 0
  const trailing=text.match(/\s*$/)?.[0].length ?? 0
  return {from:range.from+leading,to:Math.max(range.from+leading,range.to-trailing)}
}
const lineEnding = (source:string) => source.includes('\r\n') ? '\r\n' : '\n'

/** Find a balanced argument while respecting escaped delimiters and TeX comments. */
function groupEnd(source:string,start:number,limit=source.length):number | null {
  const open=source[start], close=open === '[' ? ']' : '}'
  if (open !== '{' && open !== '[') return null
  let depth=1, braces=0
  for (let at=start+1;at<limit;at++) {
    const char=source[at]
    if (char === '\\') { at++; continue }
    if (char === '%') {
      const end=source.indexOf('\n',at)
      if (end < 0) return null
      at=end; continue
    }
    if (open === '[') {
      if (char === '{') braces++
      if (char === '}') braces--
      if (braces) continue
    }
    if (char === open) depth++
    if (char === close) { depth--; if (depth === 0) return at }
  }
  return null
}

/** Unknown macro invocations stay opaque; commands never reinterpret their arguments. */
function indexSource(source:string):Index {
  const index:Index={formats:[],headings:[],lists:[],guards:[]}
  const environments:{open:GroupCommand;items:List['items']}[]=[]
  const guard=(from:number,to:number,kind:Guard['kind']='opaque') => index.guards.push({from,to,kind})
  const scan=(from:number,to:number) => {
    for (let at=from;at<to;) {
      if (source[at] === '%') {
        const newline=source.indexOf('\n',at)
        const end=newline < 0 ? to : Math.min(newline,to)
        guard(at,end); at=end; continue
      }
      if (source[at] === '$') {
        const delimiter=source[at+1] === '$' ? '$$' : '$'
        let end=at+delimiter.length
        while (end<to && (source.slice(end,end+delimiter.length) !== delimiter || source[end-1] === '\\')) end++
        end=Math.min(to,end+delimiter.length)
        guard(at,end); at=end; continue
      }
      if (source[at] !== '\\') { at++; continue }
      const token=source.slice(at,to).match(/^\\([A-Za-z@]+|[^\r\n])/)
      if (!token) { guard(at,to); break }
      const name=token[1], nameTo=at+token[0].length
      if (name === 'verb') {
        const delimiterAt=source[nameTo] === '*' ? nameTo+1 : nameTo
        const delimiter=source[delimiterAt]
        const close=delimiter ? source.indexOf(delimiter,delimiterAt+1) : -1
        const end=close < 0 ? to : Math.min(to,close+1)
        guard(at,end); at=end; continue
      }
      if (name === '(' || name === '[') {
        const endToken=name === '(' ? '\\)' : '\\]'
        const close=source.indexOf(endToken,nameTo)
        const end=close < 0 ? to : Math.min(to,close+2)
        guard(at,end); at=end; continue
      }
      if (!/^[A-Za-z@]+$/.test(name)) { guard(at,nameTo,'syntax'); at=nameTo; continue }
      let argument=nameTo
      if (source[argument] === '*') argument++
      const argumentSpace=name === 'item' ? /[ \t]/ : /\s/
      while (argument<to && argumentSpace.test(source[argument])) argument++
      let optional=false
      if (source[argument] === '[') {
        optional=true
        const end=groupEnd(source,argument,to)
        if (end === null) { guard(at,to); break }
        argument=end+1
        while (argument<to && argumentSpace.test(source[argument])) argument++
      }
      if (name === 'item') {
        const parent=environments[environments.length-1]
        if (parent && /^(itemize|enumerate)$/.test(parent.open.name)) parent.items.push({from:at,to:argument,label:optional})
        guard(at,argument,'structural'); at=argument; continue
      }
      const closing=source[argument] === '{' ? groupEnd(source,argument,to) : null
      if (commandFormats[name] || headingCommands.includes(name)) {
        if (closing === null) { guard(at,to); break }
        const node={from:at,to:closing+1,name,nameTo,contentFrom:argument+1,contentTo:closing}
        const heading=headingCommands.includes(name)
        ;(heading ? index.headings : index.formats).push(node)
        guard(at,argument+1,heading ? 'structural' : 'syntax')
        guard(closing,closing+1,'syntax')
        scan(argument+1,closing); at=closing+1; continue
      }
      if ((name === 'begin' || name === 'end') && closing !== null) {
        const environment=source.slice(argument+1,closing)
        const node={from:at,to:closing+1,name:environment,nameTo,contentFrom:argument+1,contentTo:closing}
        if (name === 'begin' && /^(verbatim\*?|Verbatim|lstlisting|minted)$/.test(environment)) {
          const endToken=`\\end{${environment}}`, close=source.indexOf(endToken,closing+1)
          const end=close < 0 ? to : Math.min(to,close+endToken.length)
          guard(at,end); at=end; continue
        }
        guard(at,closing+1,'structural')
        if (name === 'begin') environments.push({open:node,items:[]})
        else {
          const parent=environments[environments.length-1]
          if (parent?.open.name === environment) {
            environments.pop()
            if (/^(itemize|enumerate)$/.test(environment)) index.lists.push({...parent,close:node})
            else if (environment !== 'document') guard(parent.open.from,node.to)
          }
        }
        at=closing+1; continue
      }
      // Keep every argument of an unknown macro together, including definitions.
      let end=closing === null ? argument : closing+1
      while (end<to) {
        let next=end
        while (next<to && /\s/.test(source[next])) next++
        if (source[next] !== '{' && source[next] !== '[') break
        const close=groupEnd(source,next,to)
        if (close === null) { end=to; break }
        end=close+1
      }
      guard(at,Math.max(nameTo,end)); at=Math.max(nameTo,end)
    }
  }
  scan(0,source.length)
  for (const environment of environments) guard(environment.open.from,source.length)
  return index
}

function overlaps(range:Range,guard:Guard) {
  return range.from === range.to
    ? guard.kind === 'opaque' ? guard.from <= range.from && range.from < guard.to : guard.from < range.from && range.from < guard.to
    : range.from < guard.to && range.to > guard.from
}
function balanced(source:string) {
  let depth=0
  for (let at=0;at<source.length;at++) {
    if (source[at] === '\\') { at++; continue }
    if (source[at] === '%') {
      const newline=source.indexOf('\n',at)
      if (newline < 0) break
      at=newline; continue
    }
    if (source[at] === '{') depth++
    if (source[at] === '}') { depth--; if (depth < 0) return false }
  }
  return depth === 0
}
function safeRange(source:string,index:Index,range:Range) {
  return !index.guards.some(guard => {
    if (guard.kind !== 'syntax') return overlaps(range,guard)
    return (range.from > guard.from && range.from < guard.to) || (range.to > guard.from && range.to < guard.to)
  }) && balanced(source.slice(range.from,range.to))
}
function enclosing(nodes:GroupCommand[],range:Range) {
  return nodes.filter(node => (range.from >= node.contentFrom && range.to <= node.contentTo) || (range.from === node.from && range.to === node.to))
    .sort((a,b) => (a.to-a.from)-(b.to-b.from))[0]
}
function currentList(index:Index,selection:SourceSelection) {
  return index.lists.filter(list => (selection.from >= list.open.to && selection.to <= list.close.from) || (selection.from === list.open.from && selection.to === list.close.to))
    .sort((a,b) => (a.close.to-a.open.from)-(b.close.to-b.open.from))[0]
}

function formattedParagraphs(source:string,index:Index,range:Range,format:InlineFormat):GroupCommand[] {
  if (range.from === range.to) return []
  const candidates=index.formats.filter(node => commandFormats[node.name] === format && node.contentFrom >= range.from && node.contentTo <= range.to)
  const nodes=candidates.filter(node => !candidates.some(parent => parent !== node && parent.from <= node.from && parent.to >= node.to)).sort((a,b) => a.from-b.from)
  if (!nodes.length) return []
  const first=nodes[0], last=nodes[nodes.length-1]
  if (![first.from,first.contentFrom].includes(range.from) || ![last.to,last.contentTo].includes(range.to)) return []
  for (let i=1;i<nodes.length;i++) if (source.slice(nodes[i-1].to,nodes[i].from).trim()) return []
  return nodes
}

export function insertSource(source:string,selection:SourceSelection,latex:string):SourceEdit {
  const range=normalize(source,selection)
  return {changes:[{...range,insert:latex}],selection:{anchor:range.from+latex.length}}
}

export function formatSource(source:string,selection:SourceSelection,format:InlineFormat):SourceEdit {
  const range=normalize(source,selection), index=indexSource(source)
  if (index.guards.some(guard => guard.kind === 'opaque' && overlaps(range,guard))) return unchanged(range)
  const paragraphs=formattedParagraphs(source,index,range,format)
  if (paragraphs.length>1) return mappedEdit(paragraphs.flatMap(node => [
    {from:node.from,to:node.contentFrom,insert:''}, {from:node.contentTo,to:node.to,insert:''},
  ]),range)
  if (!safeRange(source,index,range)) return unchanged(range)
  const active=enclosing(index.formats.filter(node => commandFormats[node.name] === format),range)
  if (active) {
    const body=source.slice(active.contentFrom,active.contentTo)
    if (range.from === range.to) {
      const before=source.slice(active.contentFrom,range.from), after=source.slice(range.from,active.contentTo)
      if (!balanced(before) || !balanced(after)) return unchanged(range)
      const prefix=source.slice(active.from,active.contentFrom), suffix=source.slice(active.contentTo,active.to)
      const left=before ? prefix+before+suffix : '', right=after ? prefix+after+suffix : ''
      return {changes:[{from:active.from,to:active.to,insert:left+right}],selection:{anchor:active.from+left.length}}
    }
    if (range.from <= active.contentFrom && range.to >= active.contentTo) {
      const anchor=active.from+Math.max(0,Math.min(body.length,range.from-active.contentFrom))
      return {changes:[{from:active.from,to:active.to,insert:body}],selection:range.from === range.to ? {anchor} : {anchor,head:active.from+Math.min(body.length,range.to-active.contentFrom)}}
    }
    const before=source.slice(active.contentFrom,range.from), after=source.slice(range.to,active.contentTo)
    if (!balanced(before) || !balanced(after)) return unchanged(range)
    const prefix=source.slice(active.from,active.contentFrom), suffix=source.slice(active.contentTo,active.to)
    const left=before ? prefix+before+suffix : '', middle=source.slice(range.from,range.to)
    const insert=left+middle+(after ? prefix+after+suffix : '')
    return {changes:[{from:active.from,to:active.to,insert}],selection:{anchor:active.from+left.length,head:active.from+left.length+middle.length}}
  }
  const prefix=`\\${formatCommands[format]}{`
  if (range.from === range.to) return {changes:[{...range,insert:prefix+'}'}],selection:{anchor:range.from+prefix.length}}
  const changes:Change[]=[]
  let offset=range.from
  for (const part of source.slice(range.from,range.to).split(/((?:\r?\n[ \t]*){2,})/)) {
    const paragraph=trimRange(source,{from:offset,to:offset+part.length})
    if (paragraph.to > paragraph.from) changes.push({...paragraph,insert:prefix+source.slice(paragraph.from,paragraph.to)+'}'})
    offset+=part.length
  }
  if (!changes.length) return unchanged(range)
  const last=changes[changes.length-1]
  const priorDelta=changes.slice(0,-1).reduce((total,change) => total+change.insert.length-(change.to-change.from),0)
  return {changes,selection:{anchor:changes[0].from+prefix.length,head:last.to+priorDelta+prefix.length}}
}

export function setHeading(source:string,selection:SourceSelection,level:number):SourceEdit {
  const range=normalize(source,selection), index=indexSource(source)
  if (!Number.isInteger(level) || level<0 || level>3) return unchanged(range)
  if (index.guards.some(guard => guard.kind === 'opaque' && overlaps(range,guard))) return unchanged(range)
  const heading=enclosing(index.headings,range)
  if (heading) {
    if (level) return mappedEdit([{from:heading.from+1,to:heading.nameTo,insert:headingCommands[level]}],range)
    return mappedEdit([{from:heading.from,to:heading.contentFrom,insert:''},{from:heading.contentTo,to:heading.to,insert:''}],range)
  }
  if (!level) return unchanged(range)
  const target=trimRange(source,range.from === range.to ? lineRange(source,range.from) : range)
  if (!safeRange(source,index,target) || /\r?\n[ \t]*\r?\n/.test(source.slice(target.from,target.to))) return unchanged(range)
  const prefix=`\\${headingCommands[level]}{`
  return {changes:[{...target,insert:prefix+source.slice(target.from,target.to)+'}'}],selection:range.from === range.to
    ? {anchor:Math.min(target.to,Math.max(target.from,range.from))+prefix.length}
    : {anchor:target.from+prefix.length,head:target.to+prefix.length}}
}

export function toggleList(source:string,selection:SourceSelection,ordered:boolean):SourceEdit {
  const range=normalize(source,selection), index=indexSource(source), list=currentList(index,range)
  const environment=ordered ? 'enumerate' : 'itemize', eol=lineEnding(source)
  if (index.guards.some(guard => guard.kind === 'opaque' && overlaps(range,guard))) return unchanged(range)
  if (list) {
    if (list.open.name !== environment) return mappedEdit([
      {from:list.open.contentFrom,to:list.open.contentTo,insert:environment},
      {from:list.close.contentFrom,to:list.close.contentTo,insert:environment},
    ],range)
    if (index.guards.some(guard => guard.kind === 'opaque' && overlaps({from:list.open.from,to:list.close.to},guard))) return unchanged(range)
    if (list.items.some(item => item.label) || source.slice(list.open.to,list.items[0]?.from ?? list.close.from).trim()) return unchanged(range)
    const paragraphs=list.items.map((item,i) => source.slice(item.to,list.items[i+1]?.from ?? list.close.from).trim())
    const insert=paragraphs.join(eol+eol)
    return {changes:[{from:list.open.from,to:list.close.to,insert}],selection:{anchor:list.open.from,head:list.open.from+insert.length}}
  }
  const target=range.from === range.to ? lineRange(source,range.from) : range
  if (!safeRange(source,index,target)) return unchanged(range)
  const body=source.slice(target.from,target.to), lines=body.split(/(\r?\n)/)
  let firstItem=-1, consumed=0
  const items=lines.map(line => {
    if (/^\r?\n$/.test(line)) { consumed+=line.length; return line }
    if (!line.trim() && body.trim()) { consumed+=line.length; return line }
    const indentation=line.match(/^[ \t]*/)?.[0] ?? ''
    if (firstItem < 0) firstItem=consumed+indentation.length+6
    consumed+=line.length+6
    return indentation+'\\item '+line.slice(indentation.length)
  }).join('')
  const prefix=`\\begin{${environment}}${eol}`, insert=prefix+items+eol+`\\end{${environment}}`
  return {changes:[{...target,insert}],selection:range.from === range.to
    ? {anchor:target.from+prefix.length+Math.max(firstItem,range.from-target.from+6)}
    : {anchor:target.from+prefix.length,head:target.from+prefix.length+items.length}}
}

export function continueList(source:string,selection:SourceSelection):SourceEdit|null {
  const range=normalize(source,selection)
  if (range.from !== range.to) return null
  const index=indexSource(source), list=currentList(index,range)
  if (!list || index.guards.some(guard => guard.kind === 'opaque' && overlaps(range,guard))) return null
  let position=-1
  for (let i=0;i<list.items.length;i++) if (list.items[i].to <= range.from) position=i
  if (position < 0) return null
  const item=list.items[position], next=list.items[position+1], end=next?.from ?? list.close.from
  if (!balanced(source.slice(item.to,range.from))) return null
  const line=lineRange(source,item.from), indentation=source.slice(line.from,item.from)
  if (!/^[ \t]*$/.test(indentation)) return null
  const eol=lineEnding(source)
  if (!source.slice(item.to,end).trim()) {
    if (item.label) return null
    if (list.items.length === 1) return {changes:[{from:list.open.from,to:list.close.to,insert:''}],selection:{anchor:list.open.from}}
    const closing=source.slice(list.close.from,list.close.to)
    if (!next) return {changes:[{from:line.from,to:list.close.to,insert:closing+eol}],selection:{anchor:line.from+closing.length+eol.length}}
    const insert=closing+eol+eol+source.slice(list.open.from,list.open.to)+eol
    return {changes:[{from:line.from,to:next.from,insert}],selection:{anchor:line.from+closing.length+eol.length}}
  }
  return insertSource(source,range,eol+indentation+'\\item ')
}

/** Enter leaves a heading or splits styled prose without putting paragraphs inside TeX arguments. */
export function continueVisualParagraph(source:string,selection:SourceSelection):SourceEdit|null {
  const range=normalize(source,selection), index=indexSource(source)
  if(range.from!==range.to || !safeRange(source,index,range))return null
  const heading=enclosing(index.headings,range)
  const active=index.formats.filter(node=>node.contentFrom<=range.from && node.contentTo>=range.to).sort((a,b)=>a.from-b.from)
  if(heading) {
    const before=source.slice(heading.contentFrom,range.from),after=source.slice(range.to,heading.contentTo)
    if(!balanced(before)||!balanced(after))return null
    const first=source.slice(heading.from,heading.contentFrom)+before+source.slice(heading.contentTo,heading.to)
    const insert=first+lineEnding(source)+lineEnding(source)+after
    return {changes:[{from:heading.from,to:heading.to,insert}],selection:{anchor:heading.from+first.length+lineEnding(source).length*2}}
  }
  if(!active.length)return null
  const closing=active.slice().reverse().map(node=>source.slice(node.contentTo,node.to)).join('')
  const opening=active.map(node=>source.slice(node.from,node.contentFrom)).join('')
  const insert=closing+lineEnding(source)+lineEnding(source)+opening
  return {changes:[{...range,insert}],selection:{anchor:range.from+insert.length}}
}

export interface SourceFormatting {
  formats: Record<InlineFormat,boolean>
  heading: number
  list: 'ordered' | 'unordered' | null
}

export function getSourceFormatting(source:string,selection:SourceSelection):SourceFormatting {
  const range=normalize(source,selection), index=indexSource(source)
  const state:SourceFormatting={formats:{bold:false,italic:false,underline:false,strike:false},heading:0,list:null}
  if (index.guards.some(guard => guard.kind === 'opaque' && overlaps(range,guard))) return state
  for (const format of Object.keys(state.formats) as InlineFormat[]) state.formats[format]=Boolean(enclosing(index.formats.filter(node => commandFormats[node.name] === format),range)) || formattedParagraphs(source,index,range,format).length>0
  const heading=enclosing(index.headings,range)
  if (heading) state.heading=headingCommands.indexOf(heading.name)
  const list=currentList(index,range)
  if (list) state.list=list.open.name === 'enumerate' ? 'ordered' : 'unordered'
  return state
}
