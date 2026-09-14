'use client'

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Annotation, Compartment, EditorSelection, EditorState, Transaction } from '@codemirror/state'
import { EditorView, keymap, drawSelection, highlightSpecialChars, placeholder } from '@codemirror/view'
import { defaultKeymap, deleteCharBackward, deleteCharForward } from '@codemirror/commands'
import { search, searchKeymap, openSearchPanel } from '@codemirror/search'
import { Code2, Eye } from 'lucide-react'
import { useEditorStore } from '@/lib/store'
import { formatSource, setHeading, toggleList, continueList, continueVisualParagraph, insertSource, getSourceFormatting } from '@/lib/visual-source/commands'
import { visualDecorations, revealSource } from '@/lib/visual-source/decorations'
import { guardVisualChange } from '@/lib/visual-source/edit-guard'
import { scanVisualSource } from '@/lib/visual-source/scanner'
import type { InlineFormat, InsertKind, SourceDialogRequest, SourceEdit, VisualSpan } from '@/lib/visual-source/types'
import { VisualToolbar } from './visual-source/toolbar'
import { InsertDialog } from './visual-source/insert-dialog'
import { LatexOutputPanel } from './latex-output-panel'
import 'katex/dist/katex.min.css'

const externalChange = Annotation.define<boolean>()
const structuredChange = Annotation.define<boolean>()
const selections = new Map<string,{source:string;anchor:number;head:number}>()
type DialogSession = SourceDialogRequest & {snapshot:string;identity:string}
const documentIdentity = () => {const state=useEditorStore.getState(); return `${state.workspaceRoot}\0${state.activeFilePath || ''}`}
function firstPosition(source:string) {
  const spans=scanVisualSource(source), preamble=spans.find(span=>span.kind==='preamble')
  let at=preamble?.to || 0
  while (/\s/.test(source[at] || '') && at < source.length) at++
  for (const span of spans) if (span.from === at && span.kind==='hidden') at=span.to
  return at
}
function bodySelection(view:EditorView) {
  const source=view.state.doc.toString(),spans=scanVisualSource(source),selection=view.state.selection.main
  const start=spans.find(span=>span.kind==='preamble')?.to ?? 0
  const end=spans.find(span=>span.kind==='environment' && span.value==='document')?.from ?? source.length
  return {from:Math.max(start,Math.min(end,selection.from)),to:Math.max(start,Math.min(end,selection.to))}
}
function guardedInsert(source:string,selection:{from:number;to:number},latex:string):SourceEdit {
  const guarded=guardVisualChange(source,selection.from,selection.to,latex,scanVisualSource(source))
  if(!guarded)return {changes:[],selection:{anchor:selection.from}}
  return {...insertSource(source,guarded,guarded.insert),selection:{anchor:guarded.cursor}}
}
function difference(before:string,after:string) {
  let from=0, endBefore=before.length,endAfter=after.length
  while (from < endBefore && from < endAfter && before[from]===after[from]) from++
  while (endBefore > from && endAfter > from && before[endBefore-1]===after[endAfter-1]) {endBefore--;endAfter--}
  return {from,to:endBefore,insert:after.slice(from,endAfter)}
}
function requiredPackages(source:string,addition:string) {
  const preamble=scanVisualSource(source).find(span=>span.kind==='preamble')
  if (!preamble) return source
  const active=source.slice(0,preamble.to).replace(/\\[^\r\n]|%[^\r\n]*/g,token=>token.startsWith('%') ? '' : token)
  let packages=''
  for (const [pattern,name,options] of [[/\\includegraphics\b/,'graphicx',''],[/\\multirow\b/,'multirow',''],[/\\sout\b/,'ulem','[normalem]'],[/\\href\b/,'hyperref',''],[/\\begin\{(?:equation\*|align\*?|aligned|gather\*?)\}/,'amsmath','']] as const) {
    if (pattern.test(addition) && !new RegExp('\\\\(?:usepackage|RequirePackage)(?:\\[[^\\]]*\\])?\\{[^}]*\\b'+name+'\\b[^}]*\\}').test(active)) packages+=`\\usepackage${options}{${name}}\n`
  }
  const at=source.lastIndexOf('\\begin',preamble.to-1)
  return packages && at>=0 ? source.slice(0,at)+packages+source.slice(at) : source
}

export const VisualEditor = memo(function VisualEditor() {
  const content=useEditorStore(state=>state.content)
  const path=useEditorStore(state=>state.activeFilePath)
  const workspace=useEditorStore(state=>state.workspaceRoot)
  const isModified=useEditorStore(state=>state.isModified)
  const isSaving=useEditorStore(state=>state.isSaving)
  const blocked=useEditorStore(state=>state.isNavigating || !!state.pendingDraft)
  const canUndo=useEditorStore(state=>state.canUndo),canRedo=useEditorStore(state=>state.canRedo)
  const [latexPanel,setLatexPanel]=useState(false)
  const [formatting,setFormatting]=useState(()=>getSourceFormatting(content,{from:firstPosition(content),to:firstPosition(content)}))
  const [dialog,setDialog]=useState<DialogSession|null>(null)
  const [revealed,setRevealed]=useState(false)
  const [notice,setNotice]=useState('')
  const host=useRef<HTMLDivElement>(null),viewRef=useRef<EditorView|null>(null)
  const editable=useRef(new Compartment())
  const identity=`${workspace}\0${path || ''}`

  const apply = useCallback((view:EditorView,edit:SourceEdit) => {
    if (!edit.changes.length) {setNotice('Select plain text, or edit this LaTeX directly in Code view.');view.focus();return}
    setNotice('')
    const transaction=view.state.update({...edit,selection:EditorSelection.single(edit.selection.anchor,edit.selection.head ?? edit.selection.anchor),userEvent:'input',annotations:structuredChange.of(true)})
    const changed=transaction.newDoc.toString(),withPackages=requiredPackages(changed,edit.changes.map(change=>change.insert).join('\n'))
    if (withPackages !== changed) {
      const extra=difference(changed,withPackages), delta=extra.insert.length-(extra.to-extra.from)
      const selection=transaction.newSelection.main
      view.dispatch({changes:difference(view.state.doc.toString(),withPackages),selection:{anchor:selection.anchor+(selection.anchor>=extra.from?delta:0),head:selection.head+(selection.head>=extra.from?delta:0)},userEvent:'input',annotations:structuredChange.of(true)})
    } else view.dispatch(transaction)
    view.focus()
  },[])
  const insert = useCallback((kind:InsertKind,span?:VisualSpan) => {
    const view=viewRef.current
    if (!view) return
    const source=view.state.doc.toString(),selection=bodySelection(view)
    const from=span?.from ?? selection.from,to=span?.to ?? selection.to
    if(!span) {
      const guarded=guardVisualChange(source,from,to,'',scanVisualSource(source))
      if(!guarded || guarded.insert || guarded.from!==from || guarded.to!==to) {
        setNotice('This selection crosses a formatting boundary. Select text within one format, or use Code view.');view.focus();return
      }
    }
    setNotice('')
    setDialog({kind,from,to,latex:source.slice(from,to),snapshot:source,identity:documentIdentity()})
  },[])
  const format = useCallback((kind:InlineFormat) => {const view=viewRef.current;if(view) apply(view,formatSource(view.state.doc.toString(),bodySelection(view),kind))},[apply])

  useLayoutEffect(() => {
    if (!host.current) return
    const current=useEditorStore.getState(), initial=current.content, saved=selections.get(identity)
    const decoration=visualDecorations({assetDirectory:path?.includes('/') ? path.slice(0,path.lastIndexOf('/')+1) : '',activate:(span,view)=>{
      if (['math','figure','table','reference'].includes(span.kind)) {
        const kind:InsertKind=span.kind==='figure'?'image':span.kind==='reference' ? (/^\\(?:cite|parencite|textcite|autocite)/.test(view.state.sliceDoc(span.from,span.to))?'citation':'reference') : span.kind as InsertKind
        insert(kind,span)
      } else {
        view.dispatch({effects:revealSource.of({from:span.from,to:span.to}),selection:{anchor:span.from}});view.focus();setRevealed(true)
      }
    }})
    const undo=()=>{useEditorStore.getState().undo();return true},redo=()=>{useEditorStore.getState().redo();return true}
    const editor=new EditorView({parent:host.current,state:EditorState.create({doc:initial,selection:saved?.source===initial ? {anchor:saved.anchor,head:saved.head} : {anchor:firstPosition(initial)},extensions:[
      decoration.extension,EditorView.lineWrapping,drawSelection(),highlightSpecialChars(),placeholder('Start writing…'),search({top:true}),
      editable.current.of(EditorState.readOnly.of(current.isNavigating || !!current.pendingDraft)),
      EditorView.contentAttributes.of({'aria-label':'Visual document','data-testid':'visual-document','spellcheck':'true'}),
      EditorState.transactionFilter.of(transaction=>{
        const state=useEditorStore.getState()
        if (transaction.docChanged && !transaction.annotation(externalChange) && (state.isNavigating || state.pendingDraft)) return []
        if (transaction.docChanged && !transaction.annotation(externalChange) && !transaction.annotation(structuredChange) && !transaction.startState.field(decoration.field).revealed) {
          const changes: {from:number;to:number;insert:string}[]=[]
          let altered=false,cursor=0
          transaction.changes.iterChanges((from,to,_a,_b,text)=>{
            const insert=text.toString(),guarded=guardVisualChange(transaction.startState.doc.toString(),from,to,insert,transaction.startState.field(decoration.field).spans)
            if(!guarded){altered=true;return}
            if(guarded.from!==from || guarded.to!==to || guarded.insert!==insert)altered=true
            changes.push(guarded);cursor=guarded.cursor
          })
          if(altered)return {changes,selection:{anchor:cursor},userEvent:transaction.annotation(Transaction.userEvent)}
        }
        return transaction
      }),
      keymap.of([
        {key:'Mod-z',run:undo},{key:'Mod-Shift-z',run:redo},{key:'Mod-y',run:redo},
        ...(['Ctrl','Meta'] as const).flatMap(modifier=>([['b','bold'],['i','italic'],['u','underline']] as const).map(([key,style])=>({key:`${modifier}-${key}`,run:()=>{format(style);return true}}))),
        ...(['Backspace','Delete'] as const).map(key=>({key,run:(view:EditorView)=>{
          const state=view.state.field(decoration.field),selection=view.state.selection.main
          if(!selection.empty || state.revealed)return false
          let at=selection.head,previous=-1
          while(previous!==at) {previous=at;for(const span of state.spans)if(span.kind==='hidden' && (key==='Backspace'?span.to===at:span.from===at))at=key==='Backspace'?span.from:span.to}
          if(at===selection.head)return false
          view.dispatch({selection:{anchor:at}})
          return key==='Backspace'?deleteCharBackward(view):deleteCharForward(view)
        }})),
        {key:'Enter',run:view=>{const edit=continueList(view.state.doc.toString(),view.state.selection.main) ?? continueVisualParagraph(view.state.doc.toString(),view.state.selection.main);if(!edit)return false;apply(view,edit);return true}},
        {key:'Escape',run:view=>{if(!view.state.field(decoration.field).revealed)return false;view.dispatch({effects:revealSource.of(null)});setRevealed(false);return true}},
        ...searchKeymap,...defaultKeymap,
      ]),
      EditorView.updateListener.of(update=>{
        const source=update.state.doc.toString(),selection=update.state.selection.main
        if (update.docChanged && !update.transactions.every(transaction=>transaction.annotation(externalChange))) useEditorStore.getState().setContent(source)
        if(update.docChanged || update.selectionSet) {
          selections.set(identity,{source,anchor:selection.anchor,head:selection.head})
          if(selections.size>20) selections.delete(selections.keys().next().value!)
          setFormatting(getSourceFormatting(source,selection))
        }
      }),
    ]})})
    viewRef.current=editor
    return ()=>{viewRef.current=null;editor.destroy()}
  },[identity,path,apply,insert,format])
  useLayoutEffect(()=>{
    const view=viewRef.current;if(!view)return
    if(view.state.doc.toString()!==content) view.dispatch({changes:difference(view.state.doc.toString(),content),annotations:externalChange.of(true)})
  },[content])
  useEffect(()=>{viewRef.current?.dispatch({effects:editable.current.reconfigure(EditorState.readOnly.of(blocked))})},[blocked])
  useEffect(()=>{
    const command=(event:Event)=>{
      const detail=(event as CustomEvent<{command:string;text?:string}>).detail,view=viewRef.current
      if(!view || !detail)return
      if(detail.command==='undo')useEditorStore.getState().undo()
      if(detail.command==='redo')useEditorStore.getState().redo()
      if(['find','replace'].includes(detail.command))openSearchPanel(view)
      if(detail.command==='insert' && detail.text)apply(view,guardedInsert(view.state.doc.toString(),view.state.selection.main,detail.text))
    }
    window.addEventListener('editor:command',command);return()=>window.removeEventListener('editor:command',command)
  },[apply])
  const closeDialog=()=>{setDialog(null);viewRef.current?.focus()}
  const applyDialog=(latex:string)=>{
    const view=viewRef.current
    if(!dialog || !view)return
    if(dialog.identity!==documentIdentity() || dialog.snapshot!==view.state.doc.toString()) {setNotice('The document changed while this editor was open. Reopen it to apply your changes.');setDialog(null);return}
    if(latex!==dialog.latex) {
      const block=['table','image'].includes(dialog.kind) || (dialog.kind==='math' && /^(?:\\\[|\\begin|\$\$)/.test(latex))
      if(dialog.from===dialog.to && block)latex=`${dialog.from && view.state.sliceDoc(dialog.from-1,dialog.from)!=='\n'?'\n\n':''}${latex}${view.state.sliceDoc(dialog.to,dialog.to+1)!=='\n'?'\n\n':''}`
      apply(view,guardedInsert(view.state.doc.toString(),{from:dialog.from,to:dialog.to},latex))
    }
    closeDialog()
  }
  return <div className="visual-source-editor h-full flex flex-col overflow-hidden" data-testid="visual-editor">
    <div className="visual-source-modebar"><div className="flex items-center gap-1"><button type="button" data-testid="visual-toolbar-code-tab" onClick={()=>useEditorStore.getState().setActiveEditorTab('text')}><Code2 size={13}/>Code</button><button type="button" aria-pressed="true"><Eye size={13}/>Visual</button></div><button type="button" aria-pressed={latexPanel} onClick={()=>setLatexPanel(value=>!value)} title="Show LaTeX alongside the visual editor">{'{ }'} LaTeX</button></div>
    <VisualToolbar formats={(Object.keys(formatting.formats) as InlineFormat[]).filter(key=>formatting.formats[key])} heading={formatting.heading} list={formatting.list} canUndo={canUndo} canRedo={canRedo} disabled={blocked} onFormat={format} onHeading={level=>{const view=viewRef.current;if(view)apply(view,setHeading(view.state.doc.toString(),bodySelection(view),level))}} onList={ordered=>{const view=viewRef.current;if(view)apply(view,toggleList(view.state.doc.toString(),bodySelection(view),ordered))}} onInsert={insert} onUndo={()=>useEditorStore.getState().undo()} onRedo={()=>useEditorStore.getState().redo()} onFind={()=>{if(viewRef.current)openSearchPanel(viewRef.current)}}/>
    {notice && <div role="status" className="visual-source-notice">{notice}<button aria-label="Dismiss message" onClick={()=>setNotice('')}>×</button></div>}
    {revealed && <div className="visual-source-notice">Editing LaTeX source<button onClick={()=>{viewRef.current?.dispatch({effects:revealSource.of(null)});setRevealed(false);viewRef.current?.focus()}}>Done</button></div>}
    <div className="flex flex-1 min-h-0 overflow-hidden"><div ref={host} className="visual-source-host flex-1 min-w-0"/>{latexPanel && <div className="w-64 max-w-[45%] shrink-0 border-l overflow-hidden"><LatexOutputPanel latex={content}/></div>}</div>
    <div className="visual-source-status"><span>{isSaving?'Saving…':isModified?'Unsaved changes':'Saved'}</span><span>LaTeX stays in sync</span></div>
    <InsertDialog request={dialog} onApply={applyDialog} onClose={closeDialog}/>
  </div>
})
