"use client"

import { useCallback, useLayoutEffect, useRef, useState } from "react"
import { useEditorStore } from "@/lib/store"
import * as api from "@/lib/api"
import { Image } from "lucide-react"
import type { BlockPlugin } from "../types"
import { InlineText } from "../components/inline-text"

export interface FigureData {
  src: string       // filename for LaTeX export
  caption: string
  width: string
  placement?: string
  hasWidth?: boolean
  centered?: boolean
  hasCaption?: boolean
}

export const figurePlugin: BlockPlugin<FigureData> = {
  type: "figure",
  label: "Figure",
  icon: Image,
  color: "#0ea5e9",
  defaultData: { src: "", caption: "Figure caption", width: "0.8" },
  isText: false,
  renderEditor: function FigureEditor({ block, isActive, onChange, onFocus, onBlur }) {
    const activeFilePath = useEditorStore(state => state.activeFilePath)
    const workspaceRoot = useEditorStore(state => state.workspaceRoot)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const dataRef = useRef(block.data)
    const uploadSequence = useRef(0)
    useLayoutEffect(() => { dataRef.current = block.data },[block.data])
    useLayoutEffect(() => () => { uploadSequence.current++ },[])
    const [uploading,setUploading] = useState(false)
    const [error,setError] = useState<string | null>(null)
    const directory = activeFilePath?.includes('/') ? activeFilePath.slice(0,activeFilePath.lastIndexOf('/') + 1) : ''
    const assetPath = block.data.src ? directory + block.data.src : ''
    const previewUrl = assetPath ? api.getAssetUrl(assetPath) : null
    const handleChange = useCallback(
      (patch: Partial<FigureData>) => onChange({ ...dataRef.current, ...patch }),
      [onChange],
    )
    const importImage = async (file:File) => {
      if (!activeFilePath) { setError('Save the document before importing an image.'); return }
      if (!['image/png','image/jpeg','image/gif','image/webp'].includes(file.type)) { setError('Choose a PNG, JPEG, GIF, or WebP image.'); return }
      const sequence = ++uploadSequence.current
      setUploading(true); setError(null)
      try {
        const base64 = await new Promise<string>((resolve,reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result).split(',')[1])
          reader.onerror = () => reject(new Error('Could not read the selected file.'))
          reader.readAsDataURL(file)
        })
        const relative = `assets/${crypto.randomUUID()}-${file.name.replace(/[^A-Za-z0-9._-]/g,'_')}`
        const uploaded = await api.uploadAsset(directory + relative,base64)
        const current = useEditorStore.getState()
        if (sequence !== uploadSequence.current || current.activeFilePath !== activeFilePath || current.workspaceRoot !== workspaceRoot) return
        handleChange({src:uploaded.path.startsWith(directory) ? uploaded.path.slice(directory.length) : uploaded.path})
        await current.refreshFiles()
      } catch (err) { if (sequence === uploadSequence.current) setError(err instanceof Error ? err.message : 'Image import failed.') }
      finally { if (sequence === uploadSequence.current) setUploading(false) }
    }
    const handleFileChange = (event:React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) void importImage(file)
      event.target.value = ''
    }

    const openPicker = useCallback((e: React.MouseEvent) => {
      e.stopPropagation()
      fileInputRef.current?.click()
    }, [])

    return (
      <div style={{ padding: "4px 0" }} onFocus={onFocus} onBlur={onBlur}>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        {uploading && <p role="status" className="text-xs">Importing image…</p>}
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        {/* Image area */}
        {previewUrl ? (
          /* ── Actual image preview ── */
          <div
            style={{
              position: "relative",
              border: "1px solid var(--visual-editor-canvas-border)",
              borderRadius: "6px",
              overflow: "hidden",
              background: "var(--visual-editor-bg)",
              textAlign: "center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {block.data.src.toLowerCase().endsWith('.pdf') ? <p className="block p-8">PDF figure: {block.data.src}</p> : <img
              src={previewUrl}
              onError={() => setError("Image unavailable. Check that the asset exists in this workspace.")}
              alt={block.data.caption || "figure"}
              style={{
                maxWidth: "100%",
                width: block.data.hasWidth === false ? undefined : `${Number(block.data.width) * 100}%`,
                maxHeight: "360px",
                objectFit: "contain",
                display: "block",
                margin: "0 auto",
              }}
            />}
            {/* Replace button on hover */}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
              onClick={openPicker}
              style={{
                position: "absolute",
                top: "8px",
                right: "8px",
                background: "rgba(0,0,0,0.55)",
                color: "#fff",
                border: "none",
                borderRadius: "5px",
                padding: "4px 10px",
                fontSize: "11px",
                fontWeight: 500,
                cursor: "pointer",
                backdropFilter: "blur(4px)",
              }}
            >
              Replace image
            </button>
          </div>
        ) : (
          /* ── Placeholder card ── */
          <div
            style={{
              border: "1.5px dashed var(--visual-editor-canvas-border)",
              borderRadius: "6px",
              padding: "32px 20px 24px",
              textAlign: "center",
              background: "var(--visual-editor-bg)",
              color: "var(--visual-editor-text-dim)",
              cursor: "pointer",
              transition: "border-color 0.15s",
            }}
            onClick={openPicker}
            onDragOver={(e) => {
              e.preventDefault()
              e.currentTarget.style.borderColor = "var(--primary)"
            }}
            onDragLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--visual-editor-canvas-border)"
            }}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              e.currentTarget.style.borderColor = "var(--visual-editor-canvas-border)"
              const file = e.dataTransfer.files?.[0]
              if (file) void importImage(file)
            }}
          >
            {/* SVG image icon */}
            <svg
              width="28" height="28" viewBox="0 0 24 24" fill="none"
              style={{ opacity: 0.55, display: "inline-block" }}
            >
              <rect x="2.5" y="3.5" width="19" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="8.5" cy="9" r="1.8" stroke="currentColor" strokeWidth="1.5" />
              <path d="M4 17.5L9.5 12.5L13 15.5L16.5 12L21 16.5"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>

            <div style={{ fontSize: "13px", fontWeight: 500, marginTop: "10px" }}>
              Drop an image or{" "}
              <span
                style={{ color: "var(--primary)", fontWeight: 600, cursor: "pointer" }}
                onClick={openPicker}
              >
                browse files
              </span>
            </div>
            <div style={{ fontSize: "11px", marginTop: "4px", opacity: 0.6 }}>
              PNG, JPEG, GIF, WebP
            </div>
          </div>
        )}

        {/* Width slider — shown when active */}
        {isActive && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginTop: "8px",
              padding: "6px 10px",
              background: "var(--visual-editor-bg)",
              borderRadius: "6px",
              border: "1px solid var(--visual-editor-toolbar-border)",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <span style={{ fontSize: "11px", color: "var(--visual-editor-text-dim)", flexShrink: 0 }}>
              Width
            </span>
            <input
              type="range"
              min="0.2" max="1" step="0.05"
              value={block.data.width}
              onChange={(e) => handleChange({ width: e.target.value, hasWidth:true })}
              style={{ flex: 1, accentColor: "var(--primary)" }}
            />
            <span
              style={{
                fontSize: "11px",
                fontFamily: "'JetBrains Mono', monospace",
                color: "var(--visual-editor-text-dim)",
                minWidth: "32px",
                textAlign: "right",
              }}
            >
              {Math.round(parseFloat(block.data.width) * 100)}%
            </span>
          </div>
        )}

        {/* Caption */}
        <div style={{ marginTop: "12px", textAlign: "center" }}>
          <InlineText
            value={block.data.caption}
            onChange={(caption) => handleChange({ caption })}
            placeholder="Figure caption"
            className="outline-none text-center w-full"
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "13.5px",
              fontStyle: "italic",
              color: "var(--visual-editor-text-dim)",
              caretColor: "var(--primary)",
              textAlign: "center",
            }}
            multiline={false}
          />
        </div>
      </div>
    )
  },
  toLaTeX: (data) =>
    `\\begin{figure}${data.placement ?? "[h]"}\n${data.centered === false ? "" : "\\centering\n"}\\includegraphics${data.hasWidth === false ? "" : `[width=${data.width}\\textwidth]`}{${data.src || "image.png"}}\n${data.hasCaption !== false || data.caption ? `\\caption{${data.caption}}\n` : ""}\\end{figure}`,
}
