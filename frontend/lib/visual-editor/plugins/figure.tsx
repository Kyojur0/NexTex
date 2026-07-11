"use client"

import { useCallback, useRef, useState } from "react"
import { Image } from "lucide-react"
import type { BlockPlugin } from "../types"
import { InlineText } from "../components/inline-text"

export interface FigureData {
  src: string       // filename for LaTeX export
  caption: string
  width: string
}

export const figurePlugin: BlockPlugin<FigureData> = {
  type: "figure",
  label: "Figure",
  icon: Image,
  color: "#0ea5e9",
  defaultData: { src: "", caption: "Figure caption", width: "0.8" },
  isText: false,
  renderEditor: ({ block, isActive, onChange, onFocus, onBlur }) => {
    // preview URL lives in component state — not persisted, just for display
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const objectUrlRef = useRef<string | null>(null)

    const handleChange = useCallback(
      (patch: Partial<FigureData>) => onChange({ ...block.data, ...patch }),
      [block.data, onChange],
    )

    const handleFileChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        // revoke old object URL to avoid memory leak
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
        const url = URL.createObjectURL(file)
        objectUrlRef.current = url
        setPreviewUrl(url)
        handleChange({ src: file.name })
        // reset so the same file can be picked again
        e.target.value = ""
      },
      [handleChange],
    )

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
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

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
            <img
              src={previewUrl}
              alt={block.data.caption || "figure"}
              style={{
                maxWidth: "100%",
                maxHeight: "360px",
                objectFit: "contain",
                display: "block",
                margin: "0 auto",
              }}
            />
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
              if (!file || !file.type.startsWith("image/")) return
              if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
              const url = URL.createObjectURL(file)
              objectUrlRef.current = url
              setPreviewUrl(url)
              handleChange({ src: file.name })
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
              PNG, JPG, SVG, PDF
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
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
          >
            <span style={{ fontSize: "11px", color: "var(--visual-editor-text-dim)", flexShrink: 0 }}>
              Width
            </span>
            <input
              type="range"
              min="0.2" max="1" step="0.05"
              value={block.data.width}
              onChange={(e) => handleChange({ width: e.target.value })}
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
    `\\begin{figure}[h]\n\\centering\n\\includegraphics[width=${data.width}\\textwidth]{${data.src || "image.png"}}\n\\caption{${data.caption}}\n\\end{figure}`,
}
