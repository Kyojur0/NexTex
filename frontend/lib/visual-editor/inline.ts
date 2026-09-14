import katex from 'katex'
import { readGroup } from './parser'

const tags: Record<string,string> = {
  textbf:'strong',textit:'em',emph:'em',underline:'u',sout:'s',texttt:'code',
  textsuperscript:'sup',textsubscript:'sub',href:'a',
}
const commands: Record<string,string> = {
  STRONG:'textbf',B:'textbf',EM:'textit',I:'textit',U:'underline',S:'sout',STRIKE:'sout',DEL:'sout',
  CODE:'texttt',SUP:'textsuperscript',SUB:'textsubscript',
}
const literalCommands: Record<string,string> = {textbackslash:'\\',textasciitilde:'~',textasciicircum:'^'}
const caretPlaceholders = new WeakSet<Node>()
function caretPlaceholder(): Text {
  const text = document.createTextNode('\u200b')
  caretPlaceholders.add(text)
  return text
}
export function clearCaretPlaceholders(root: Node) {
  const walker = document.createTreeWalker(root,NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) {
    if (!caretPlaceholders.has(node)) continue
    const text = node as Text, at = text.data.indexOf('\u200b')
    if (at >= 0) text.deleteData(at,1)
    caretPlaceholders.delete(node)
  }
}
export function escapeLaTeX(text: string): string {
  return text.replace(/[\\&%$#_{}~^]/g, ch => ({'\\':'\\textbackslash{}','~':'\\textasciitilde{}','^':'\\textasciicircum{}'}[ch] || `\\${ch}`))
}
function safeHref(value: string) { return /^(?:https?:|mailto:|#)/i.test(value) ? value : '#' }

/** Build nodes instead of interpolating user content into HTML. */
export function renderInlineLaTeX(text: string): DocumentFragment {
  const fragment = document.createDocumentFragment()
  let plain = ''
  const flush = () => { if (plain) fragment.append(document.createTextNode(plain)); plain = '' }
  for (let i = 0; i < text.length;) {
    if (text[i] === '$') {
      let end = i + 1
      while (end < text.length && (text[end] !== '$' || text[end - 1] === '\\')) end++
      if (end < text.length) {
        flush(); const node = document.createElement('span')
        node.dataset.latexMath = text.slice(i + 1,end)
        node.contentEditable = 'false'
        katex.render(node.dataset.latexMath,node,{throwOnError:false,trust:false})
        fragment.append(node); i = end + 1; continue
      }
    }
    if (text[i] === '\\') {
      const escaped = text[i + 1]
      if (escaped && '&%$#_{}~^'.includes(escaped)) { plain += escaped; i += 2; continue }
      if (escaped === '\\') { flush(); fragment.append(document.createElement('br')); i += text[i+2] === '\n' ? 3 : 2; continue }
      const match = text.slice(i).match(/^\\([A-Za-z]+)\b/)
      const group = match && readGroup(text,i + match[0].length)
      if (match && group && literalCommands[match[1]]) { plain += literalCommands[match[1]]; i = group.end; continue }
      if (match && group && tags[match[1]]) {
        flush(); const node = document.createElement(tags[match[1]])
        if (match[1] === 'href') {
          const label = readGroup(text,group.end)
          if (label) {
            node.setAttribute('href',safeHref(group.value.replace(/\\([{}%#])/g,'$1')))
            node.dataset.latexHref = group.value
            node.append(renderInlineLaTeX(label.value)); i = label.end
          } else { plain += text[i++]; continue }
        } else { node.append(renderInlineLaTeX(group.value)); i = group.end }
        fragment.append(node); continue
      }
    }
    plain += text[i++]
  }
  flush(); return fragment
}

export function inlineDOMToLaTeX(root: Node): string {
  const visit = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeLaTeX(caretPlaceholders.has(node) ? (node.textContent || '').replace('\u200b','') : node.textContent || '')
    if (!(node instanceof Element)) return Array.from(node.childNodes).map(visit).join('')
    if (node instanceof HTMLElement && node.dataset.latexMath !== undefined) return `$${node.dataset.latexMath}$`
    if (node.tagName === 'BR') return '\\\\\n'
    if (['SCRIPT','STYLE'].includes(node.tagName)) return ''
    const content = Array.from(node.childNodes).map(visit).join('')
    const command = commands[node.tagName]
    if (command) return content ? `\\${command}{${content}}` : ''
    if (node.tagName === 'A') {
      const href = (node as HTMLElement).dataset.latexHref ?? (node.getAttribute('href') || '').replace(/[{}%#]/g, value => `\\${value}`)
      return `\\href{${href}}{${content}}`
    }
    if (node !== root && ['DIV','P'].includes(node.tagName)) return content + (node.nextSibling ? '\n' : '')
    return content
  }
  return visit(root)
}

export function selectionEditor(): HTMLElement | null {
  const selection = window.getSelection()
  if (!selection?.rangeCount) return null
  const node = selection.getRangeAt(0).commonAncestorContainer
  return (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>('[data-latex-editor]') || null
}

export function applyInlineFormat(kind: string, argument?: string): boolean {
  const selection = window.getSelection(), editor = selectionEditor()
  if (!selection?.rangeCount || !editor) return false
  const range = selection.getRangeAt(0)
  clearCaretPlaceholders(editor)
  const collapsed = range.collapsed
  if (collapsed && kind === 'math') return false
  const names: Record<string,string> = {bold:'strong',italic:'em',underline:'u',strikethrough:'s',code:'code',superscript:'sup',subscript:'sub',link:'a',math:'span'}
  const tag = names[kind]
  if (!tag) return false
  const ancestor = (range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement)?.closest(tag)
  if (ancestor && editor.contains(ancestor) && ancestor.contains(range.endContainer) && !['link','math'].includes(kind)) {
    const before = document.createRange(); before.selectNodeContents(ancestor); before.setEnd(range.startContainer,range.startOffset)
    const after = document.createRange(); after.selectNodeContents(ancestor); after.setStart(range.endContainer,range.endOffset)
    let middle: Node = range.cloneContents()
    const placeholder = collapsed ? caretPlaceholder() : null
    if (placeholder) middle.appendChild(placeholder)
    let context = range.commonAncestorContainer instanceof Element ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement
    while (context && context !== ancestor) {
      const wrapper = context.cloneNode(false); wrapper.appendChild(middle); middle = wrapper; context = context.parentElement
    }
    const replacement = document.createDocumentFragment(), start = document.createTextNode(''), end = document.createTextNode('')
    const beforeWrapper = ancestor.cloneNode(false), afterWrapper = ancestor.cloneNode(false)
    beforeWrapper.appendChild(before.cloneContents()); afterWrapper.appendChild(after.cloneContents())
    replacement.append(beforeWrapper,start,middle,end,afterWrapper)
    ancestor.replaceWith(replacement)
    if (placeholder) { range.setStart(placeholder,1); range.collapse(true) }
    else { range.setStartAfter(start); range.setEndBefore(end) }
    start.remove(); end.remove(); selection.removeAllRanges(); selection.addRange(range)
  } else {
    const node = document.createElement(tag)
    if (kind === 'link') { node.setAttribute('href',safeHref(argument || '')); node.dataset.latexHref = (argument || '').replace(/[{}%#]/g, value => `\\${value}`) }
    if (kind === 'math') {
      node.dataset.latexMath = selection.toString(); node.contentEditable = 'false'
      katex.render(node.dataset.latexMath,node,{throwOnError:false,trust:false})
      range.deleteContents()
    } else node.append(collapsed ? caretPlaceholder() : range.extractContents())
    range.insertNode(node)
    if (collapsed) { range.setStart(node.firstChild!,1); range.collapse(true) }
    else range.selectNodeContents(node)
    selection.removeAllRanges(); selection.addRange(range)
  }
  if (!collapsed) editor.dispatchEvent(new Event('input',{bubbles:true}))
  document.dispatchEvent(new Event('selectionchange'))
  return true
}

export function splitInlineSelection(editor: HTMLElement): [string,string] {
  clearCaretPlaceholders(editor)
  const selection = window.getSelection()
  if (!selection?.rangeCount || !editor.contains(selection.getRangeAt(0).startContainer)) return [inlineDOMToLaTeX(editor),'']
  const current = selection.getRangeAt(0)
  const before = document.createRange(); before.selectNodeContents(editor); before.setEnd(current.startContainer,current.startOffset)
  const after = document.createRange(); after.selectNodeContents(editor); after.setStart(current.endContainer,current.endOffset)
  return [inlineDOMToLaTeX(before.cloneContents()),inlineDOMToLaTeX(after.cloneContents())]
}
