"use client"

import { memo, useState, useCallback, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { TEMPLATES } from "@/lib/templates"
import { useEditorStore } from "@/lib/store"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface TemplateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const TemplateModal = memo(function TemplateModal({
  open,
  onOpenChange,
}: TemplateModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [fileName, setFileName] = useState('resume.tex')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const creatingRef = useRef(false)
  const createDocument = useEditorStore((s) => s.createDocument)

  useEffect(() => {
    if (open) {
      setSelectedTemplate(null)
      setFileName('resume.tex')
      setError('')
    }
  }, [open])

  const handleSelect = useCallback((templateId: string) => {
    setSelectedTemplate(templateId)
  }, [])

  const handleCreate = useCallback(async () => {
    const template = TEMPLATES.find((item) => item.id === selectedTemplate)
    if (!template || creatingRef.current) return
    const name = fileName.trim()
    if (!name || /[\\/\x00-\x1f]/.test(name) || name.startsWith('.')) {
      setError('Enter a file name without folders, such as resume.tex.')
      return
    }
    if (!name.toLowerCase().endsWith('.tex')) {
      setError('The file name must end in .tex.')
      return
    }
    creatingRef.current = true
    setCreating(true)
    setError('')
    try {
      await createDocument(name, template.content)
      onOpenChange(false)
      setSelectedTemplate(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the document.')
    } finally {
      creatingRef.current = false
      setCreating(false)
    }
  }, [selectedTemplate, fileName, createDocument, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!creatingRef.current) onOpenChange(next) }}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choose a Resume Template</DialogTitle>
          <DialogDescription>
            Select a template to get started with a professionally designed resume.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              aria-pressed={selectedTemplate === template.id}
              disabled={creating}
              onClick={() => handleSelect(template.id)}
              className={cn(
                "p-4 rounded-lg border-2 transition-all text-left",
                selectedTemplate === template.id
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div className="text-2xl mb-2">{template.icon}</div>
              <h3 className="font-semibold text-sm">{template.name}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {template.description}
              </p>
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="template-file-name">File name</Label>
          <Input id="template-file-name" value={fileName} disabled={creating}
            onChange={(e) => setFileName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleCreate() } }} />
          <p className="text-xs text-muted-foreground">Creates a .tex file in your current workspace.</p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t pt-4 mt-4">
          <Button variant="outline" disabled={creating} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!selectedTemplate || creating}
          >
            <FileText className="mr-2 h-4 w-4" />
            {creating ? 'Creating…' : 'Create from Template'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
})
