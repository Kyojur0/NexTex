"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface FindReplaceProps {
  content: string
  showReplace: boolean
  focusRequest: number
  initialQuery?: string
  getSelection: () => { start: number; end: number }
  select: (start: number, end: number) => void
  replace: (content: string, start: number, end: number) => void
  onClose: () => void
}

export function FindReplace({ content, showReplace, focusRequest, initialQuery = '', getSelection, select, replace, onClose }: FindReplaceProps) {
  const [query, setQuery] = useState(initialQuery)
  const [replacement, setReplacement] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select() }, [focusRequest])

  const matches = useMemo(() => {
    if (!query) return []
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return Array.from(content.matchAll(new RegExp(escaped, matchCase ? 'g' : 'gi')), (match) => ({ start: match.index!, end: match.index! + match[0].length }))
  }, [content, query, matchCase])

  const nextMatch = (backward = false) => {
    if (!matches.length) return
    const current = getSelection()
    const match = backward
      ? [...matches].reverse().find((item) => item.start < current.start) ?? matches[matches.length - 1]
      : matches.find((item) => item.start >= current.end) ?? matches[0]
    select(match.start, match.end)
  }

  const replaceOne = () => {
    if (!matches.length) return
    const current = getSelection()
    const match = matches.find((item) => item.start === current.start && item.end === current.end)
      ?? matches.find((item) => item.start >= current.end) ?? matches[0]
    replace(content.slice(0, match.start) + replacement + content.slice(match.end), match.start, match.start + replacement.length)
  }

  const replaceAll = () => {
    if (!matches.length) return
    let next = ''
    let offset = 0
    for (const match of matches) {
      next += content.slice(offset, match.start) + replacement
      offset = match.end
    }
    next += content.slice(offset)
    replace(next, matches[0].start, matches[0].start + replacement.length)
  }

  return (
    <div role="search" aria-label="Find and replace" className="border-b border-border bg-muted/50 p-2 space-y-2"
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
        if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); nextMatch(event.shiftKey) }
      }}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Input ref={inputRef} aria-label="Find text" placeholder="Find in document" value={query}
          onChange={(e) => setQuery(e.target.value)} className="h-8 flex-1 min-w-32 text-xs" />
        <span role="status" aria-live="polite" className="text-xs text-muted-foreground tabular-nums">
          {query ? `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}` : 'Enter search text'}
        </span>
        <Button size="icon" variant="ghost" className="size-8" disabled={!matches.length} aria-label="Previous match" onClick={() => nextMatch(true)}><ArrowUp className="size-3.5" /></Button>
        <Button size="icon" variant="ghost" className="size-8" disabled={!matches.length} aria-label="Next match" onClick={() => nextMatch()}><ArrowDown className="size-3.5" /></Button>
        <label className="text-xs flex items-center gap-1.5 whitespace-nowrap"><input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} />Match case</label>
        <Button size="icon" variant="ghost" className="size-8" aria-label="Close find and replace" onClick={onClose}><X className="size-3.5" /></Button>
      </div>
      {showReplace && <div className="flex flex-wrap items-center gap-1.5">
        <Input aria-label="Replace with" placeholder="Replace with" value={replacement} onChange={(e) => setReplacement(e.target.value)} className="h-8 flex-1 min-w-32 text-xs" />
        <Button size="sm" variant="outline" disabled={!matches.length} onClick={replaceOne}>Replace</Button>
        <Button size="sm" variant="outline" disabled={!matches.length} onClick={replaceAll}>Replace all</Button>
      </div>}
    </div>
  )
}
