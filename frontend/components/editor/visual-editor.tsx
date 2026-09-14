"use client"

import { memo, useState, useEffect, useLayoutEffect, useCallback, useRef } from "react"
import { useEditorStore } from "@/lib/store"
import { parseLaTeXToBlocks } from "@/lib/visual-editor/parser"
import { blocksToLaTeX } from "@/lib/visual-editor/serializer"
import { getPlugin } from "@/lib/visual-editor/plugins"
import type { AnyVisualBlock, BlockType } from "@/lib/visual-editor/types"
import { createBlock } from "@/lib/visual-editor/types"
import { applyInlineFormat, selectionEditor } from "@/lib/visual-editor/inline"
import { BlockCanvas } from "./block-canvas"
import { LatexOutputPanel } from "./latex-output-panel"
import { FormattingToolbar, type FormatState, type ParagraphStyle } from "@/lib/visual-editor/components/formatting-toolbar"

const defaultFormat: FormatState = { bold:false,italic:false,underline:false,strikethrough:false,superscript:false,subscript:false,code:false }

function addRequiredPackages(blocks: AnyVisualBlock[]): AnyVisualBlock[] {
  const start = blocks.findIndex(block => block.boundary === 'start')
  if (start < 0) return blocks
  const changed = blocks.filter(block => !block.source || block.source.data !== JSON.stringify(block.data))
  const text = changed.map(block => getPlugin(block.type).toLaTeX(block.data)).join('\n')
  const packages = [
    [/\\includegraphics\b/, 'graphicx'], [/\\begin\{lstlisting\}/, 'listings'],
    [/\\multirow\b/, 'multirow'], [/\\sout\b/, 'ulem'], [/\\begin\{equation\*\}|\\begin\{aligned\}/, 'amsmath'],
    [/\\href\b/, 'hyperref'],
  ] as const
  const original = blocks[start].data as {latex:string}
  let preamble = original.latex
  for (const [pattern,name] of packages) {
    const activePreamble = preamble.replace(/\\[^\r\n]|%[^\r\n]*/g, token => token.startsWith('%') ? '' : token)
    if (!pattern.test(text) || new RegExp('\\\\(?:usepackage|RequirePackage)(?:\\[[^\\]]*\\])?\\{[^}]*\\b' + name + '\\b[^}]*\\}').test(activePreamble)) continue
    // The protected start block ends at the real document marker; earlier copies can be comments.
    const insertion = preamble.lastIndexOf('\\begin{document}')
    if (insertion < 0) continue
    preamble = preamble.slice(0,insertion) + `\\usepackage${name === 'ulem' ? '[normalem]' : ''}{${name}}\n` + preamble.slice(insertion)
  }
  if (preamble === original.latex) return blocks
  return blocks.map((block,index) => index === start ? {...block,data:{latex:preamble}} : block)
}

export const VisualEditor = memo(function VisualEditor() {
  const content = useEditorStore(state => state.content)
  const activeFilePath = useEditorStore(state => state.activeFilePath)
  const workspaceRoot = useEditorStore(state => state.workspaceRoot)
  const isModified = useEditorStore(state => state.isModified)
  const isSaving = useEditorStore(state => state.isSaving)
  const setContent = useEditorStore(state => state.setContent)
  const undo = useEditorStore(state => state.undo)
  const redo = useEditorStore(state => state.redo)
  const canUndo = useEditorStore(state => state.canUndo)
  const canRedo = useEditorStore(state => state.canRedo)
  const setActiveEditorTab = useEditorStore(state => state.setActiveEditorTab)
  const showVisualLatexPanel = useEditorStore(state => state.showVisualLatexPanel)
  const setShowVisualLatexPanel = useEditorStore(state => state.setShowVisualLatexPanel)
  const [blocks,setBlocks] = useState<AnyVisualBlock[]>(() => parseLaTeXToBlocks(content))
  const blocksRef = useRef(blocks)
  const sourceRef = useRef(content)
  const identity = `${workspaceRoot || ''}\0${activeFilePath || ''}`
  const identityRef = useRef(identity)
  const [activeId,setActiveId] = useState<string | null>(null)
  const [focusedBlockId,setFocusedBlockId] = useState<string | null>(null)
  const [format,setFormat] = useState<FormatState>(defaultFormat)
  const [searchMode,setSearchMode] = useState<'find'|'replace'|null>(null)
  const [query,setQuery] = useState('')
  const [replacement,setReplacement] = useState('')
  const [searchIndex,setSearchIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    if (sourceRef.current === content && identityRef.current === identity) return
    const parsed = parseLaTeXToBlocks(content)
    sourceRef.current = content; identityRef.current = identity; blocksRef.current = parsed
    setBlocks(parsed); setFocusedBlockId(null); setActiveId(null)
  },[content,identity])

  const publish = useCallback((next: AnyVisualBlock[], source = blocksToLaTeX(next)) => {
    sourceRef.current = source; blocksRef.current = next
    setBlocks(next); setContent(source)
  },[setContent])

  const commit = useCallback((next: AnyVisualBlock[]) => {
    next = addRequiredPackages(next)
    const source = blocksToLaTeX(next)
    if (source === sourceRef.current && JSON.stringify(next) === JSON.stringify(blocksRef.current)) return
    publish(next,source)
  },[publish])

  const focus = useCallback((id:string, end=false) => {
    setFocusedBlockId(id)
    requestAnimationFrame(() => {
      const element = rootRef.current?.querySelector<HTMLElement>(`[data-block-id="${id}"] [contenteditable], [data-block-id="${id}"] textarea, [data-block-id="${id}"] input`)
      element?.focus()
      if (end && element?.hasAttribute('contenteditable')) {
        const range = document.createRange(); range.selectNodeContents(element); range.collapse(false)
        const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range)
      }
    })
  },[])

  const insertBlocks = useCallback((index:number, additions:AnyVisualBlock[]) => {
    const current = blocksRef.current
    const first = current[0]?.boundary === 'start' ? 1 : 0
    const last = current[current.length - 1]?.boundary === 'end' ? current.length - 1 : current.length
    const next = [...current]
    next.splice(Math.max(first,Math.min(last,index)),0,...additions)
    commit(next)
    if (additions[0]) focus(additions[0].id)
  },[commit,focus])
  const handleInsertAt = useCallback((index:number,type:BlockType) => {
    insertBlocks(index,[createBlock(type,structuredClone(getPlugin(type).defaultData))])
  },[insertBlocks])
  const handleAdd = useCallback((type:BlockType) => handleInsertAt(blocksRef.current.length,type),[handleInsertAt])
  const handleInsertAfter = useCallback((id:string,type:BlockType) => {
    handleInsertAt(blocksRef.current.findIndex(block => block.id === id) + 1,type)
  },[handleInsertAt])
  const handleChange = useCallback((id:string,data:unknown) => {
    if (!blocksRef.current.some(block => block.id === id && JSON.stringify(block.data) !== JSON.stringify(data))) return
    commit(blocksRef.current.map(block => block.id === id ? {...block,data} : block))
  },[commit])
  const handleReorder = useCallback((next:AnyVisualBlock[]) => {
    const current = blocksRef.current
    if (current.some((block,index) => block.boundary && next[index]?.id !== block.id)) return
    commit(next)
  },[commit])
  const handleDelete = useCallback((id:string) => {
    if (blocksRef.current.find(block => block.id === id)?.boundary) return
    const next = blocksRef.current.filter(block => block.id !== id)
    commit(next); setFocusedBlockId(null)
  },[commit])
  const handleDuplicate = useCallback((id:string) => {
    const current = blocksRef.current, index = current.findIndex(block => block.id === id), original = current[index]
    if (!original || original.boundary) return
    insertBlocks(index + 1,[createBlock(original.type,structuredClone(original.data))])
  },[insertBlocks])
  const move = useCallback((id:string,direction:number) => {
    const next = [...blocksRef.current], index = next.findIndex(block => block.id === id), target = index + direction
    if (index < 0 || target < 0 || target >= next.length || next[index].boundary || next[target].boundary) return
    ;[next[index],next[target]] = [next[target],next[index]]; commit(next)
  },[commit])
  const handleMoveUp = useCallback((id:string) => move(id,-1),[move])
  const handleMoveDown = useCallback((id:string) => move(id,1),[move])
  const handleSplit = useCallback((id:string,beforeData:unknown,afterData:unknown) => {
    const next = [...blocksRef.current], index = next.findIndex(block => block.id === id)
    if (index < 0) return
    const original = next[index]
    next[index] = {...original,data:beforeData}
    const after = original.type === 'section'
      ? createBlock('paragraph',{text:(afterData as {title:string}).title})
      : createBlock(original.type,afterData)
    next.splice(index + 1,0,after); commit(next); focus(after.id)
  },[commit,focus])
  const handleMergeUp = useCallback((id:string) => {
    const next = [...blocksRef.current], index = next.findIndex(block => block.id === id)
    if (index <= 0) return
    const previous = next[index - 1], current = next[index]
    if (!getPlugin(previous.type).isText || !getPlugin(current.type).isText) return
    const previousKey = previous.type === 'section' ? 'title' : 'text', currentKey = current.type === 'section' ? 'title' : 'text'
    const text = (previous.data as Record<string,string>)[previousKey] + (current.data as Record<string,string>)[currentKey]
    next[index - 1] = {...previous,data:{...(previous.data as object),[previousKey]:text}}
    next.splice(index,1); commit(next); focus(previous.id,true)
  },[commit,focus])
  const handleFocus = useCallback((id:string) => setFocusedBlockId(id),[])
  const handleBlur = useCallback(() => {},[])
  const handleDragStart = useCallback((id:string | null) => setActiveId(id),[])
  const focusedBlock = blocks.find(block => block.id === focusedBlockId)
  const activeBlock = blocks.find(block => block.id === activeId) || null
  const paragraphStyle: ParagraphStyle = focusedBlock?.type === 'section'
    ? ({section:'heading-1',subsection:'heading-2',subsubsection:'heading-3'} as const)[(focusedBlock.data as {level:'section'|'subsection'|'subsubsection'}).level]
    : 'normal'
  const latex = blocksToLaTeX(blocks)

  useEffect(() => {
    const changed = () => {
      const selection = window.getSelection(), editor = selectionEditor()
      if (!editor || !rootRef.current?.contains(editor)) return
      const node = selection?.anchorNode
      const element = node instanceof Element ? node : node?.parentElement
      const selectors: Record<keyof FormatState,string> = {bold:'strong,b',italic:'em,i',underline:'u',strikethrough:'s,strike,del',code:'code',superscript:'sup',subscript:'sub'}
      setFormat(Object.fromEntries(Object.entries(selectors).map(([key,selector]) => [key,Boolean(element?.closest(selector))])) as unknown as FormatState)
    }
    document.addEventListener('selectionchange',changed)
    return () => document.removeEventListener('selectionchange',changed)
  },[])
  const handleFormatToggle = useCallback((key:keyof FormatState) => { applyInlineFormat(key) },[])
  const handleInlineMath = useCallback(() => { applyInlineFormat('math') },[])
  const handleLink = useCallback(() => {
    const url = window.prompt('Enter URL')
    if (url) applyInlineFormat('link',url)
  },[])
  const handleParagraphStyleChange = useCallback((style:ParagraphStyle) => {
    const current = blocksRef.current.find(block => block.id === focusedBlockId)
    if (!current || !['paragraph','section'].includes(current.type)) return
    const text = (current.data as {text?:string;title?:string}).text ?? (current.data as {title:string}).title
    const levels = {'heading-1':'section','heading-2':'subsection','heading-3':'subsubsection'}
    const replacement = style === 'normal' ? createBlock('paragraph',{text}) : createBlock('section',{level:levels[style],title:text})
    if (current.source) replacement.source = {...current.source,data:''}
    commit(blocksRef.current.map(block => block.id === current.id ? replacement : block)); focus(replacement.id)
  },[focusedBlockId,commit,focus])
  const handleListToggle = useCallback((kind:'itemize'|'enumerate') => {
    const current = blocksRef.current.find(block => block.id === focusedBlockId)
    if (current?.type === 'list') handleChange(current.id,{...(current.data as object),kind})
    else {
      const index = current ? blocksRef.current.indexOf(current) + 1 : blocksRef.current.length
      insertBlocks(index,[createBlock('list',{kind,items:['']})])
    }
  },[focusedBlockId,handleChange,insertBlocks])
  const handleIndent = useCallback((direction:'in'|'out') => {
    const current = blocksRef.current.find(block => block.id === focusedBlockId)
    if (!current || current.boundary) return
    if (current.type === 'section') {
      const levels = ['section','subsection','subsubsection'], data = current.data as {level:string}
      handleChange(current.id,{...data,level:levels[Math.max(0,Math.min(2,levels.indexOf(data.level) + (direction === 'in' ? 1 : -1)))]})
      return
    }
    if (current.type === 'raw') {
      const data = current.data as {latex:string}
      if (direction === 'out' && /^\\begin\{quote\}\s*[\s\S]*\\end\{quote\}$/.test(data.latex)) {
        const inner = data.latex.replace(/^\\begin\{quote\}\s*/, '').replace(/\s*\\end\{quote\}$/, '')
        const parsed = parseLaTeXToBlocks(inner)
        const index = blocksRef.current.indexOf(current), next = [...blocksRef.current]
        next.splice(index,1,...parsed); commit(next); if (parsed[0]) focus(parsed[0].id)
      }
      return
    }
    if (direction === 'in') {
      const replacement = createBlock('raw',{latex:`\\begin{quote}\n${getPlugin(current.type).toLaTeX(current.data)}\n\\end{quote}`})
      if (current.source) replacement.source = {...current.source,data:''}
      commit(blocksRef.current.map(block => block.id === current.id ? replacement : block)); focus(replacement.id)
    }
  },[focusedBlockId,handleChange,commit,focus])

  useEffect(() => {
    const command = (event:Event) => {
      const detail = (event as CustomEvent<{command:string;text?:string}>).detail
      if (!detail) return
      if (detail.command === 'undo') undo()
      if (detail.command === 'redo') redo()
      if (detail.command === 'find' || detail.command === 'replace') setSearchMode(detail.command)
      if (detail.command === 'insert' && detail.text) {
        const index = blocksRef.current.findIndex(block => block.id === focusedBlockId)
        const additions = parseLaTeXToBlocks(detail.text).map(block => createBlock(block.type,block.data))
        insertBlocks(index < 0 ? blocksRef.current.length : index + 1,additions)
      }
    }
    window.addEventListener('editor:command',command)
    return () => window.removeEventListener('editor:command',command)
  },[undo,redo,focusedBlockId,insertBlocks])
  useEffect(() => { if (searchMode) searchRef.current?.focus() },[searchMode])
  const replaceAll = () => { if (query) commit(parseLaTeXToBlocks(sourceRef.current.split(query).join(replacement))) }
  const positions: number[] = []
  if (query) {
    let at = latex.indexOf(query)
    while (at >= 0) { positions.push(at); at = latex.indexOf(query,at + query.length) }
  }
  const matches = positions.length
  const selectedIndex = matches ? searchIndex % matches : 0
  const replaceMatch = () => {
    const at = positions[selectedIndex]
    if (at === undefined) return
    commit(parseLaTeXToBlocks(latex.slice(0,at) + replacement + latex.slice(at + query.length)))
  }
  const selectedPosition = positions[selectedIndex] ?? -1
  useEffect(() => {
    const elements = rootRef.current?.querySelectorAll<HTMLElement>('[data-block-id]')
    elements?.forEach(element => { element.style.outline = '' })
    if (!searchMode || selectedPosition < 0) return
    let index = blocks.length - 1
    for (let i=0;i<blocks.length;i++) {
      if (blocksToLaTeX(blocks.slice(0,i+1)).length > selectedPosition) { index = i; break }
    }
    const element = elements?.[index]
    if (element) { element.style.outline = '2px solid var(--primary)'; element.scrollIntoView?.({block:'nearest'}) }
  },[blocks,selectedPosition,searchMode])
  return (
    <div ref={rootRef} className="h-full flex flex-col overflow-hidden bg-[var(--visual-editor-bg)]" onKeyDown={event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault(); event.stopPropagation(); if (event.shiftKey) redo(); else undo()
      }
    }}>
      {/* Formatting toolbar */}
      <FormattingToolbar
        paragraphStyle={paragraphStyle}
        format={format}
        isVisual={true}
        latexPanelOpen={showVisualLatexPanel}
        canUndo={canUndo}
        canRedo={canRedo}
        onParagraphStyleChange={handleParagraphStyleChange}
        onFormatToggle={handleFormatToggle}
        onInlineMath={handleInlineMath}
        onLink={handleLink}
        onListToggle={handleListToggle}
        onIndent={handleIndent}
        onInsert={handleAdd}
        onToggleLatexPanel={() => setShowVisualLatexPanel(!showVisualLatexPanel)}
        onToggleView={() => setActiveEditorTab("text")}
        onUndo={undo}
        onRedo={redo}
      />

      {searchMode && <div className="flex gap-2 items-center p-2 border-b text-xs bg-[var(--visual-editor-toolbar)]">
        <input ref={searchRef} aria-label="Find LaTeX" placeholder="Find in LaTeX" value={query} onChange={event => {setQuery(event.target.value);setSearchIndex(0)}} onKeyDown={event => {if (event.key === 'Enter') setSearchIndex(value => value + 1)}} className="border rounded px-2 py-1 bg-transparent" />
        <button onClick={() => setSearchIndex(value => value + Math.max(matches - 1,0))} disabled={!matches}>Previous match</button>
        <button onClick={() => setSearchIndex(value => value + 1)} disabled={!matches}>Next match</button>
        {searchMode === 'replace' && <><input aria-label="Replacement" placeholder="Replace with" value={replacement} onChange={event => setReplacement(event.target.value)} className="border rounded px-2 py-1 bg-transparent" /><button onClick={replaceMatch} disabled={!matches}>Replace match</button><button onClick={replaceAll} disabled={!matches}>Replace all</button></>}
        <span role="status">{matches ? selectedIndex + 1 : 0} of {matches}</span><button onClick={() => setSearchMode(null)} className="ml-auto">Close search</button>
      </div>}
      {/* Main workspace */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          <BlockCanvas
            blocks={blocks}
            activeId={activeId}
            activeBlock={activeBlock}
            focusedBlockId={focusedBlockId}
            onReorder={handleReorder}
            onChange={handleChange}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onDragStart={handleDragStart}
            onSplit={handleSplit}
            onMergeUp={handleMergeUp}
            onInsertAfter={handleInsertAfter}
            onInsertAt={handleInsertAt}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
          />

          {showVisualLatexPanel && (
            <>
              <div className="w-px bg-[var(--visual-editor-toolbar-border)] shrink-0" />
              <div className="w-72 shrink-0 bg-[var(--visual-editor-toolbar)] transition-all duration-200 ease-in-out">
                <LatexOutputPanel latex={latex} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status bar — Fable5 style, 34px */}
      <div
        className="shrink-0 h-[34px] flex items-center px-4 text-[11.5px]"
        style={{
          borderTop: "1px solid var(--visual-editor-toolbar-border)",
          background: "var(--visual-editor-toolbar)",
          color: "var(--visual-editor-text-dim)",
        }}
      >
        <span className="font-medium" style={{ color: "var(--visual-editor-text)" }}>
          {blocks.length} {blocks.length === 1 ? "block" : "blocks"}
        </span>
        <span className="mx-1.5">·</span>
        <span>{blocks.reduce((n, b) => {
          const text = (b.data as { text?: string })?.text || ""
          return n + (text.match(/\S+/g)?.length || 0)
        }, 0)} words</span>

        <span className="mx-3" style={{ color: "var(--visual-editor-toolbar-border)" }}>|</span>

        {/* Saved indicator */}
        <span className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "var(--saved)" }}
          />
          <span>{isSaving ? "Saving…" : isModified ? "Unsaved changes" : "Saved"}</span>
        </span>

        <span className="ml-auto">
          Click a block to select · Drag handle to reorder · Hover between blocks to insert
        </span>
      </div>
    </div>
  )
})
