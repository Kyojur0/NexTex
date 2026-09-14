'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useEditorStore, type FileItem } from '@/lib/store'

export const BLANK_DOCUMENT = '\\documentclass[11pt]{article}\n\\usepackage[margin=1in]{geometry}\n\\usepackage{amsmath}\n\n\\begin{document}\n\n\\section{Untitled}\nStart writing here.\n\n\\end{document}\n'
export type FileDialogMode = 'new' | 'open' | 'save-as' | null

function flatten(files: FileItem[]): FileItem[] {
  return files.flatMap((file) => file.type === 'folder' ? flatten(file.children || []) : [file])
}

export function FileDialogs({ mode, onClose }: { mode: FileDialogMode; onClose: () => void }) {
  const files = useEditorStore((s) => s.files)
  const activePath = useEditorStore((s) => s.activeFilePath)
  const [path, setPath] = useState(() => mode === 'save-as' ? (activePath || 'untitled.tex').replace(/(\.[^/.]+)?$/, '-copy$1') : mode === 'new' ? 'untitled.tex' : '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (chosenPath = path.trim()) => {
    if (!chosenPath) return
    setBusy(true); setError(null)
    try {
      const state = useEditorStore.getState()
      if (mode === 'open') await state.openFile(`file-${chosenPath}`, chosenPath)
      if (mode === 'new') await state.createDocument(chosenPath, BLANK_DOCUMENT)
      if (mode === 'save-as') await state.saveAs(chosenPath)
      onClose()
    } catch (error) { setError(error instanceof Error ? error.message : 'File operation failed') }
    finally { setBusy(false) }
  }
  const candidates = flatten(files).filter((file) => file.path.toLowerCase().includes(path.toLowerCase()))
  return <Dialog open={mode !== null} onOpenChange={(open) => { if (!open && !busy) onClose() }}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{mode === 'open' ? 'Open File' : mode === 'new' ? 'New Document' : 'Save As'}</DialogTitle>
        <DialogDescription>{mode === 'open' ? 'Choose a file in the current workspace.' : 'Enter a path relative to the current workspace. Existing files will not be overwritten.'}</DialogDescription>
      </DialogHeader>
      <form onSubmit={(event) => { event.preventDefault(); void submit() }} className="space-y-4">
        <Label htmlFor="document-path">{mode === 'open' ? 'Search files or enter a path' : 'File path'}</Label>
        <Input id="document-path" value={path} onChange={(event) => setPath(event.target.value)} autoFocus disabled={busy} />
        {mode === 'open' && <div className="max-h-64 overflow-auto space-y-1" aria-label="Workspace files">
          {candidates.length ? candidates.map((file) => <button key={file.id} type="button" disabled={busy}
            className="block text-sm text-left w-full rounded px-3 py-2 hover:bg-muted" onClick={() => void submit(file.path)}>{file.path}</button>) : <p className="text-sm text-muted-foreground">No matching files.</p>}
        </div>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || !path.trim()}>{busy ? 'Working…' : mode === 'open' ? 'Open' : mode === 'new' ? 'Create Document' : 'Save Copy'}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
