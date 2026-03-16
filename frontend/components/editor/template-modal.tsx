"use client"

import { memo, useState, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FileText, Check } from "lucide-react"
import { cn } from "@/lib/utils"

const TEMPLATES = [
  {
    id: "minimal",
    name: "Minimal",
    description: "Clean and simple, perfect for tech roles",
    icon: "📄",
  },
  {
    id: "professional",
    name: "Professional",
    description: "Traditional format for corporate positions",
    icon: "💼",
  },
  {
    id: "modern",
    name: "Modern",
    description: "Contemporary design with elegant typography",
    icon: "✨",
  },
  {
    id: "academic",
    name: "Academic",
    description: "Structured format for research positions",
    icon: "🎓",
  },
  {
    id: "creative",
    name: "Creative",
    description: "Unique layout for design and creative roles",
    icon: "🎨",
  },
]

interface TemplateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const TemplateModal = memo(function TemplateModal({
  open,
  onOpenChange,
}: TemplateModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  const handleSelect = useCallback((templateId: string) => {
    setSelectedTemplate(templateId)
  }, [])

  const handleCreate = useCallback(() => {
    if (selectedTemplate) {
      // In real app: create new project from template
      console.log(`Creating project from template: ${selectedTemplate}`)
      onOpenChange(false)
      setSelectedTemplate(null)
    }
  }, [selectedTemplate, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
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

        <div className="flex justify-end gap-2 border-t pt-4 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!selectedTemplate}
          >
            <FileText className="mr-2 h-4 w-4" />
            Create from Template
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
})
