'use client'

import { useEffect, useRef, useState } from 'react'
import katex from 'katex'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { parseLaTeXToBlocks } from '@/lib/visual-editor/parser'
import { figurePlugin, type FigureData } from '@/lib/visual-editor/plugins/figure'
import { tablePlugin, type TableData } from '@/lib/visual-editor/plugins/table'
import { scanVisualSource } from '@/lib/visual-source/scanner'
import { escapeLaTeX } from '@/lib/visual-editor/inline'
import type { InsertDialogProps } from './contracts'
import type { SourceDialogRequest } from '@/lib/visual-source/types'

const labels = {math:'equation',image:'image',table:'table',link:'link',citation:'citation',reference:'reference',symbol:'symbol'}
const symbols = [['α','\\alpha'],['β','\\beta'],['γ','\\gamma'],['δ','\\delta'],['θ','\\theta'],['λ','\\lambda'],['π','\\pi'],['σ','\\sigma'],['Σ','\\Sigma'],['∞','\\infty'],['≤','\\leq'],['≥','\\geq'],['≠','\\neq'],['±','\\pm'],['×','\\times'],['→','\\rightarrow']]

export function InsertDialog(props: InsertDialogProps) {
  return props.request ? <DialogBody key={`${props.request.kind}:${props.request.from}:${props.request.to}:${props.request.latex}`} {...props} request={props.request}/> : null
}
function DialogBody({request,onApply,onClose}: InsertDialogProps & {request:SourceDialogRequest}) {
  const original = request.latex
  const editing = request.to > request.from && (request.kind === 'math' ? /^(?:\$|\\[([]|\\begin\{)/.test(original) : request.kind === 'image' ? /^\\begin\{figure\}/.test(original) : request.kind === 'table' ? /^\\begin\{(?:table|tabular)\}/.test(original) : ['citation','reference'].includes(request.kind) && /^\\[a-zA-Z]+/.test(original))
  const block = useState(() => parseLaTeXToBlocks(original).find(b => b.type === (request.kind === 'image' ? 'figure' : request.kind)))[0]
  const [sourceMode,setSourceMode] = useState(editing && ['image','table'].includes(request.kind) && !block)
  const [source,setSource] = useState(original)
  const [sourceEdited,setSourceEdited] = useState(false)
  const [dirty,setDirty] = useState(false)
  const [figure,setFigure] = useState<FigureData>(() => block?.type === 'figure' ? block.data as FigureData : {...figurePlugin.defaultData})
  const [table,setTable] = useState<TableData>(() => block?.type === 'table' ? block.data as TableData : structuredClone(tablePlugin.defaultData))
  const mathParts = useState(() => {
    const span=scanVisualSource(original).find(span=>span.kind==='math' && span.from===0 && span.to===original.length)
    return span?.contentFrom!==undefined && span.contentTo!==undefined ? ['',original.slice(0,span.contentFrom),original.slice(span.contentFrom,span.contentTo),original.slice(span.contentTo)] : null
  })[0]
  const [expression,setExpression] = useState(mathParts?.[2].trim() || original || 'E = mc^2')
  const [display,setDisplay] = useState(mathParts ? !['$','\\('].includes(mathParts[1]) : true)
  const [url,setUrl] = useState('https://')
  const [text,setText] = useState(request.kind === 'link' ? original : '')
  const [key,setKey] = useState(() => scanVisualSource(original).find(span=>span.kind==='reference' && span.from===0 && span.to===original.length)?.value || '')
  const [symbol,setSymbol] = useState('\\alpha')
  const preview = useRef<HTMLDivElement>(null)
  useEffect(() => { if (preview.current) katex.render(expression,preview.current,{displayMode:display,throwOnError:false,trust:false}) },[expression,display])
  const update = <T,>(setter:(value:T)=>void,value:T) => {setDirty(true);setter(value)}
  const mathLatex = () => mathParts && display === !['$','\\('].includes(mathParts[1]) ? `${mathParts[1]}${expression}${mathParts[3]}` : display ? `\\[\n${expression}\n\\]` : `$${expression}$`
  const keyLatex = editing ? original.slice(0,original.lastIndexOf('{')+1)+key+'}' : `\\${request.kind === 'citation' ? 'cite' : 'ref'}{${key}}`
  const output = sourceMode ? source : !dirty && editing && ['math','image','table','citation','reference'].includes(request.kind) ? original : request.kind === 'math' ? mathLatex() : request.kind === 'image' ? figurePlugin.toLaTeX(figure) : request.kind === 'table' ? tablePlugin.toLaTeX(table) : request.kind === 'link' ? `\\href{${url.replace(/[{}%#]/g,c => '\\'+c)}}{${escapeLaTeX(text || url)}}` : ['citation','reference'].includes(request.kind) ? keyLatex : `$${symbol}$`
  const field = 'w-full rounded border bg-transparent px-3 py-2 text-sm'
  return <Dialog open onOpenChange={open => {if (!open) onClose()}}><DialogContent className="visual-insert-dialog sm:max-w-2xl max-h-[85vh] overflow-y-auto" onCloseAutoFocus={e=>e.preventDefault()}>
    <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Insert'} {labels[request.kind]}</DialogTitle><DialogDescription>{request.kind === 'table' ? 'Edit cells, add rows and columns, or select cells to merge.' : 'Changes apply to this part of your document.'}</DialogDescription></DialogHeader>
    {['math','image','table','citation','reference'].includes(request.kind) && <div className="flex gap-2 text-xs"><button className={!sourceMode ? 'font-semibold text-primary' : ''} type="button" disabled={sourceEdited || (editing && ['image','table'].includes(request.kind) && !block)} onClick={()=>setSourceMode(false)}>Visual</button><button className={sourceMode ? 'font-semibold text-primary' : ''} type="button" onClick={()=>{setSource(output);setSourceMode(true)}}>LaTeX source</button></div>}
    {sourceMode ? <label className="grid gap-2 text-sm">LaTeX source<textarea className={`${field} font-mono min-h-44`} value={source} onChange={e=>{setSource(e.target.value);setSourceEdited(true)}}/></label> : <>
      {request.kind === 'math' && <><label className="grid gap-2 text-sm">Equation<textarea autoFocus aria-label="Equation" className={`${field} font-mono min-h-24`} value={expression} onChange={e=>update(setExpression,e.target.value)}/></label><label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={display} onChange={e=>update(setDisplay,e.target.checked)}/>Display equation on its own line</label><div ref={preview} className="overflow-x-auto rounded bg-muted/40 p-5"/></>}
      {request.kind === 'image' && <figurePlugin.renderEditor block={{id:'dialog-figure',type:'figure',data:figure}} isActive onChange={data=>update(setFigure,data)} onFocus={()=>{}} onBlur={()=>{}}/>}
      {request.kind === 'table' && <tablePlugin.renderEditor block={{id:'dialog-table',type:'table',data:table}} isActive onChange={data=>update(setTable,data)} onFocus={()=>{}} onBlur={()=>{}}/>}
      {request.kind === 'link' && <><label className="grid gap-2 text-sm">Link text<input autoFocus className={field} value={text} onChange={e=>setText(e.target.value)}/></label><label className="grid gap-2 text-sm">URL<input className={field} value={url} onChange={e=>setUrl(e.target.value)}/></label></>}
      {['citation','reference'].includes(request.kind) && <label className="grid gap-2 text-sm">{request.kind === 'citation' ? 'Citation key' : 'Reference label'}<input autoFocus className={field} value={key} onChange={e=>update(setKey,e.target.value)} placeholder={request.kind === 'citation' ? 'author2026' : 'sec:introduction'}/></label>}
      {request.kind === 'symbol' && <div className="grid grid-cols-8 gap-2">{symbols.map(([label,value])=><button key={value} type="button" aria-label={value} aria-pressed={symbol===value} className={`rounded border p-3 text-xl ${symbol===value ? 'border-primary bg-primary/10' : ''}`} onClick={()=>setSymbol(value)}>{label}</button>)}</div>}
    </>}
    <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={()=>onApply(output)} disabled={!output || (!sourceMode && ['citation','reference'].includes(request.kind) && (!key.trim() || /[{}\\%\s]/.test(key))) || (!sourceMode && request.kind==='image' && !figure.src)}>Apply</Button></DialogFooter>
  </DialogContent></Dialog>
}
