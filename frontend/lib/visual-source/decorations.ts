import { StateEffect, StateField, type Extension, type Range } from '@codemirror/state'
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view'
import katex from 'katex'
import { scanVisualSource } from './scanner'
import type { VisualSpan } from './types'
import { parseLaTeXToBlocks } from '../visual-editor/parser'
import { renderInlineLaTeX } from '../visual-editor/inline'
import type { TableData } from '../visual-editor/plugins/table'
import type { FigureData } from '../visual-editor/plugins/figure'
import { getAssetUrl } from '../api'

export const revealSource = StateEffect.define<{ from: number; to: number } | null>()
export interface VisualDecorationOptions {
  assetDirectory: string
  activate: (span: VisualSpan, view: EditorView) => void
}

class PreviewWidget extends WidgetType {
  constructor(readonly span: VisualSpan, readonly source: string, readonly options: VisualDecorationOptions) { super() }
  eq(other: PreviewWidget) { return this.source === other.source && JSON.stringify(this.span) === JSON.stringify(other.span) }
  toDOM(view: EditorView) {
    const {span} = this
    const element = document.createElement(span.block ? 'div' : 'span')
    element.className = `visual-preview visual-preview-${span.kind}`
    element.dataset.visualFrom = String(span.from)
    element.dataset.visualTo = String(span.to)
    const activate = () => this.options.activate(span, view)
    if (span.kind === 'math') {
      katex.render(span.value || '', element, { throwOnError:false, trust:false, displayMode:!!span.block, strict:'ignore' })
    } else if (span.kind === 'table') {
      const block = parseLaTeXToBlocks(this.source).find(block => block.type === 'table')
      if (block) {
        const data = block.data as TableData
        const table = document.createElement('table')
        for (const row of data.rows) {
          const tr = table.insertRow()
          for (const cell of row) {
            if (cell.hidden) continue
            const td = tr.insertCell(); td.colSpan = cell.colspan; td.rowSpan = cell.rowspan
            td.append(renderInlineLaTeX(cell.content || '\u00a0'))
          }
        }
        element.append(table)
        if (data.caption) { const caption = document.createElement('div'); caption.className = 'visual-preview-caption'; caption.append(renderInlineLaTeX(data.caption)); element.append(caption) }
      } else { element.classList.add('visual-source-fallback'); element.textContent = this.source }
    } else if (span.kind === 'figure') {
      const block = parseLaTeXToBlocks(this.source).find(block => block.type === 'figure')
      const data = block?.data as FigureData | undefined
      if (data?.src) {
        if (/\.(png|jpe?g|gif|webp|svg)$/i.test(data.src)) {
          const image = document.createElement('img'); image.src = getAssetUrl(this.options.assetDirectory + data.src); image.alt = data.caption || data.src; if(data.hasWidth!==false && Number.isFinite(Number(data.width)))image.style.width=`${Number(data.width)*100}%`
          image.addEventListener('error', () => { image.hidden = true; const message = document.createElement('span'); message.textContent = `Image: ${data.src}`; element.prepend(message) }, {once:true})
          element.append(image)
        } else { const label = document.createElement('span'); label.textContent = `Image: ${data.src}`; element.append(label) }
        if (data.caption) { const caption = document.createElement('div'); caption.className = 'visual-preview-caption'; caption.append(renderInlineLaTeX(data.caption)); element.append(caption) }
      } else { element.classList.add('visual-source-fallback'); element.textContent = this.source }
    } else if (span.kind === 'title') {
      element.append(renderInlineLaTeX(span.value || 'Document title'))
    } else if (span.kind === 'list-marker') {
      element.textContent = span.value || '•'; element.style.marginLeft=`${(span.level || 1)*18}px`
    } else if (span.kind === 'reference') {
      element.textContent = `[${span.value || '?'}]`
    } else if (span.kind === 'preamble') {
      element.textContent = '⌘  Preamble'
    } else if (span.kind === 'environment') {
      element.textContent = span.value === 'document' ? 'End of document' : span.value || ''
    }
    if (!['list-marker','title'].includes(span.kind)) {
      element.tabIndex = 0; element.setAttribute('role','button')
      const label = span.kind === 'preamble' ? 'Edit preamble' : span.kind === 'environment' ? 'Show LaTeX source' : `Edit ${span.kind === 'figure' ? 'image' : span.kind}`
      element.setAttribute('aria-label',label); element.title = label
      element.addEventListener('mousedown',event => event.preventDefault())
      element.addEventListener('click',activate)
      element.addEventListener('keydown',rawEvent => { const event = rawEvent as KeyboardEvent; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate() } })
    }
    return element
  }
  ignoreEvent() { return true }
}

export interface VisualFieldValue { decorations: DecorationSet; atomic: DecorationSet; spans: VisualSpan[]; revealed: {from:number;to:number} | null }
export function visualDecorations(options: VisualDecorationOptions) {
  const build = (source:string, revealed:VisualFieldValue['revealed']):VisualFieldValue => {
    const spans = scanVisualSource(source), ranges:Range<Decoration>[] = [], atomic:Range<Decoration>[] = []
    for (const span of spans) {
      if (span.from >= span.to || span.from < 0 || span.to > source.length) continue
      if (revealed && span.from < revealed.to && span.to > revealed.from) continue
      if (['bold','italic','underline','strike','heading','comment','code'].includes(span.kind)) {
        ranges.push(Decoration.mark({class:`visual-${span.kind}${span.kind === 'heading' ? ` visual-heading-${span.level || 1}` : ''}`}).range(span.from,span.to))
      } else if (span.kind === 'hidden' || (span.kind === 'environment' && ['itemize','enumerate'].includes(span.value || ''))) {
        const decoration = Decoration.replace({}).range(span.from,span.to)
        ranges.push(decoration); atomic.push(decoration)
      } else {
        const decoration = Decoration.replace({ widget:new PreviewWidget(span,source.slice(span.from,span.to),options),block:!!span.block }).range(span.from,span.to)
        ranges.push(decoration); atomic.push(decoration)
      }
    }
    return {spans,decorations:Decoration.set(ranges,true),atomic:Decoration.set(atomic,true),revealed}
  }
  const field = StateField.define<VisualFieldValue>({
    create(state) { return build(state.doc.toString(),null) },
    update(value,transaction) {
      let revealed = value.revealed
      if (revealed && transaction.docChanged) revealed = {from:transaction.changes.mapPos(revealed.from,-1),to:transaction.changes.mapPos(revealed.to,1)}
      for (const effect of transaction.effects) if (effect.is(revealSource)) revealed = effect.value
      if (!transaction.docChanged && revealed === value.revealed) return value
      return build(transaction.newDoc.toString(),revealed)
    },
    provide: field => [EditorView.decorations.from(field,value => value.decorations),EditorView.atomicRanges.of(view => view.state.field(field).atomic)],
  })
  return {field,extension:field as Extension}
}
