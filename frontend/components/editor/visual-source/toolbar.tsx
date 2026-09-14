'use client'

import { Bold, Italic, Underline, Strikethrough, List, ListOrdered, Undo2, Redo2, Search, Sigma, Image, Table2, Link, Quote, Hash, Omega, Plus, ChevronDown } from 'lucide-react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import type { VisualToolbarProps } from './contracts'
import type { InlineFormat, InsertKind } from '@/lib/visual-source/types'

export function VisualToolbar(props: VisualToolbarProps) {
  const formats: [InlineFormat,typeof Bold,string][] = [['bold',Bold,'Bold (Ctrl+B)'],['italic',Italic,'Italic (Ctrl+I)'],['underline',Underline,'Underline (Ctrl+U)'],['strike',Strikethrough,'Strikethrough']]
  const inserts: [InsertKind,typeof Bold,string][] = [['math',Sigma,'Equation'],['image',Image,'Image'],['table',Table2,'Table'],['link',Link,'Link'],['citation',Quote,'Citation'],['reference',Hash,'Cross-reference'],['symbol',Omega,'Symbol']]
  return <div className="visual-source-toolbar" role="toolbar" aria-label="Visual formatting">
    <div className="visual-toolbar-history visual-toolbar-group">
      <button type="button" title="Undo" aria-label="Undo" disabled={props.disabled || !props.canUndo} onMouseDown={e=>e.preventDefault()} onClick={props.onUndo}><Undo2 size={15}/></button>
      <button type="button" title="Redo" aria-label="Redo" disabled={props.disabled || !props.canRedo} onMouseDown={e=>e.preventDefault()} onClick={props.onRedo}><Redo2 size={15}/></button>
      <span className="visual-tool-separator"/>
    </div>
    <select aria-label="Paragraph style" value={props.heading} disabled={props.disabled} onChange={e=>props.onHeading(Number(e.target.value))}>
      <option value={0}>Normal text</option><option value={1}>Section</option><option value={2}>Subsection</option><option value={3}>Subsubsection</option>
    </select>
    <span className="visual-tool-separator"/>
    <div className="visual-toolbar-group">{formats.map(([key,Icon,label])=><button key={key} type="button" className={key==='strike'?'visual-toolbar-extra-format':undefined} title={label} aria-label={label} aria-pressed={props.formats.includes(key)} disabled={props.disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>props.onFormat(key)}><Icon size={15}/></button>)}</div>
    <div className="visual-toolbar-lists visual-toolbar-group">
      <span className="visual-tool-separator"/>
      <button type="button" title="Bullet list" aria-label="Bullet list" aria-pressed={props.list==='unordered'} disabled={props.disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>props.onList(false)}><List size={16}/></button>
      <button type="button" title="Numbered list" aria-label="Numbered list" aria-pressed={props.list==='ordered'} disabled={props.disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>props.onList(true)}><ListOrdered size={16}/></button>
    </div>
    <div className="visual-toolbar-insert">
      <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="visual-insert-trigger" aria-label="Insert" disabled={props.disabled}><Plus size={14}/><span>Insert</span><ChevronDown size={11}/></button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 p-1.5" onCloseAutoFocus={e=>e.preventDefault()}>
          {inserts.map(([kind,Icon,label])=><DropdownMenuItem key={kind} className="gap-2.5 rounded px-2.5 py-2" onSelect={()=>props.onInsert(kind)}><Icon size={15}/>{label}</DropdownMenuItem>)}
          <DropdownMenuSeparator/>
          <DropdownMenuItem onSelect={()=>props.onList(false)}><List size={15}/>Bullet list</DropdownMenuItem>
          <DropdownMenuItem onSelect={()=>props.onList(true)}><ListOrdered size={15}/>Numbered list</DropdownMenuItem>
          <DropdownMenuItem onSelect={()=>props.onFormat('strike')}><Strikethrough size={15}/>Strikethrough</DropdownMenuItem>
          <DropdownMenuSeparator/>
          <DropdownMenuItem disabled={!props.canUndo} onSelect={props.onUndo}><Undo2 size={15}/>Undo</DropdownMenuItem>
          <DropdownMenuItem disabled={!props.canRedo} onSelect={props.onRedo}><Redo2 size={15}/>Redo</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <button type="button" title="Find and replace" aria-label="Find and replace" onMouseDown={e=>e.preventDefault()} onClick={props.onFind}><Search size={15}/></button>
    </div>
  </div>
}
