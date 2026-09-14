"use client"

import { memo, useState, useRef } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen, Plus, Trash2, Edit2, MoreVertical, Clock } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useEditorStore, FileItem } from "@/lib/store"

function uniqueName(items: FileItem[], base: string): string {
  const used = new Set(items.map((item) => item.name.toLowerCase()))
  if (!used.has(base.toLowerCase())) return base
  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.slice(0, dot) : base
  const extension = dot > 0 ? base.slice(dot) : ''
  let suffix = 2
  while (used.has(`${stem}-${suffix}${extension}`.toLowerCase())) suffix += 1
  return `${stem}-${suffix}${extension}`
}

interface ItemProps {
  item: FileItem
  depth: number
  activeFileId: string | null
  busy: boolean
  onSelect: (item: FileItem) => void
  onRename: (item: FileItem) => void
  onDelete: (item: FileItem) => void
  onCreate: (parent: FileItem | null, type: 'file' | 'folder') => void
}

const FileTreeItem = memo(function FileTreeItem(props: ItemProps) {
  const { item, depth, activeFileId, busy, onSelect, onRename, onDelete, onCreate } = props
  const [expanded, setExpanded] = useState(true)
  const folder = item.type === 'folder'
  const active = activeFileId === item.id
  return <div>
    <div className={cn('group flex items-center h-8 mx-1.5 px-2 rounded-lg transition-colors', active ? 'bg-sidebar-primary/10 text-sidebar-primary' : 'hover:bg-sidebar-accent/60 text-sidebar-foreground/70')}
      style={{ paddingLeft: `${depth * 14 + 12}px` }}>
      <button type="button" disabled={busy} aria-expanded={folder ? expanded : undefined}
        aria-current={active ? 'page' : undefined}
        onClick={() => folder ? setExpanded(!expanded) : onSelect(item)}
        className="min-w-0 flex-1 flex items-center gap-1.5 h-full text-left rounded focus-visible:outline-2 focus-visible:outline-primary">
        {folder ? <>{expanded ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}{expanded ? <FolderOpen className="size-3.5 shrink-0 text-primary/80" /> : <Folder className="size-3.5 shrink-0 text-primary/80" />}</>
          : <><span className="w-3.5 shrink-0" /><FileText className="size-3.5 shrink-0" /></>}
        <span className={cn('truncate text-xs', active && 'font-medium')}>{item.name}</span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button aria-label={`Actions for ${item.name}`} disabled={busy} variant="ghost" size="sm"
            className="size-6 p-0 opacity-60 group-hover:opacity-100 focus-visible:opacity-100"><MoreVertical className="size-3" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40 rounded-xl shadow-floating">
          <DropdownMenuItem onClick={() => onRename(item)}><Edit2 className="mr-2 size-3" />Rename</DropdownMenuItem>
          {folder && <><DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onCreate(item, 'file')}><FileText className="mr-2 size-3" />New File</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCreate(item, 'folder')}><Folder className="mr-2 size-3" />New Folder</DropdownMenuItem>
          </>}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onClick={() => onDelete(item)}><Trash2 className="mr-2 size-3" />Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    {folder && expanded && item.children?.map((child) => <FileTreeItem key={child.id} {...props} item={child} depth={depth + 1} />)}
  </div>
})

interface FileTreeProps {
  files: FileItem[]
  activeFileId: string | null
  onFileSelect: (id: string, path: string) => void | Promise<void>
  onShowHistory: () => void
}

export const FileTree = memo(function FileTree({ files, activeFileId, onFileSelect, onShowHistory }: FileTreeProps) {
  const projectName = useEditorStore((s) => s.projectName)
  const createFile = useEditorStore((s) => s.createFile)
  const renameFile = useEditorStore((s) => s.renameFile)
  const deleteFile = useEditorStore((s) => s.deleteFile)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState<{ mode: 'rename' | 'delete'; item: FileItem } | null>(null)
  const [name, setName] = useState('')

  const run = async (operation: () => void | Promise<void>, close = false) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      await operation()
      if (close) setDialog(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The file operation failed. Please try again.')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const create = (parent: FileItem | null, type: 'file' | 'folder') => {
    const newName = uniqueName(parent ? parent.children ?? [] : files, type === 'file' ? 'untitled.tex' : 'New Folder')
    void run(() => createFile(parent?.id ?? null, newName, type))
  }

  const confirmOperation = () => {
    if (!dialog) return
    if (dialog.mode === 'delete') {
      void run(() => deleteFile(dialog.item.id), true)
      return
    }
    const trimmed = name.trim()
    if (!trimmed || trimmed === '.' || trimmed === '..' || /[\\/\x00-\x1f]/.test(trimmed)) {
      setError('Enter a name without folder separators.')
      return
    }
    if (trimmed === dialog.item.name) { setDialog(null); return }
    void run(() => renameFile(dialog.item.id, trimmed), true)
  }

  return <div className="flex flex-col h-full bg-sidebar/80 border-r border-sidebar-border/60 backdrop-blur-sm">
    <div className="h-10 border-b border-sidebar-border/60 px-3 flex items-center justify-between">
      <span className="text-[11px] font-semibold text-sidebar-foreground/80 uppercase tracking-wider truncate">{projectName}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button aria-label="Create file or folder" disabled={busy} variant="ghost" size="sm" className="size-6 p-0"><Plus className="size-3.5" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40 rounded-xl shadow-floating">
          <DropdownMenuItem onClick={() => create(null, 'file')}><FileText className="mr-2 size-3" />New File</DropdownMenuItem>
          <DropdownMenuItem onClick={() => create(null, 'folder')}><Folder className="mr-2 size-3" />New Folder</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    {error && !dialog && <p role="alert" className="p-3 text-xs text-destructive break-words">{error}</p>}
    <div className="flex-1 overflow-y-auto scrollbar-thin py-1.5" aria-busy={busy}>
      {files.length === 0 ? <div className="p-4 text-xs text-muted-foreground text-center leading-relaxed">No files yet.<br />Create a new file to get started.</div>
        : files.map((item) => <FileTreeItem key={item.id} item={item} depth={0} activeFileId={activeFileId} busy={busy}
          onSelect={(selected) => { void run(() => onFileSelect(selected.id, selected.path)) }}
          onRename={(selected) => { setError(''); setName(selected.name); setDialog({ mode: 'rename', item: selected }) }}
          onDelete={(selected) => { setError(''); setDialog({ mode: 'delete', item: selected }) }}
          onCreate={create} />)}
    </div>
    <div className="shrink-0 border-t border-sidebar-border/60 p-1.5">
      <button onClick={onShowHistory} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"><Clock className="size-3.5 shrink-0" />Version History</button>
    </div>
    <Dialog open={!!dialog} onOpenChange={(open) => { if (!open && !busyRef.current) { setDialog(null); setError('') } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialog?.mode === 'delete' ? 'Delete permanently?' : 'Rename item'}</DialogTitle>
          <DialogDescription>{dialog?.mode === 'delete'
            ? `Delete “${dialog.item.name}”${dialog.item.type === 'folder' ? ' and everything inside it' : ''}? This cannot be undone.`
            : 'Choose a new name in the same folder.'}</DialogDescription>
        </DialogHeader>
        {dialog?.mode === 'rename' && <div className="space-y-2"><Label htmlFor="rename-item">New name</Label><Input id="rename-item" autoFocus disabled={busy} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmOperation() } }} /></div>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={() => { setDialog(null); setError('') }}>Cancel</Button>
          <Button variant={dialog?.mode === 'delete' ? 'destructive' : 'default'} disabled={busy} onClick={confirmOperation}>
            {busy ? 'Working…' : dialog?.mode === 'delete' ? 'Delete permanently' : 'Rename'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
})
