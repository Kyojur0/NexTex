"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import type { BlockType } from "../types"
import { getAllPlugins } from "../plugins"

interface InsertLineProps {
  onInsert: (type: BlockType) => void
}

export function InsertLine({ onInsert }: InsertLineProps) {
  const [open, setOpen] = useState(false)
  const plugins = getAllPlugins()

  return (
    <div
      /* Fable5: 20px tall, flex row, cursor pointer */
      style={{ height: "20px", display: "flex", alignItems: "center", cursor: "pointer", margin: "0 -14px" }}
      className="group/iline"
      onMouseLeave={() => setOpen(false)}
    >
      {/* Left rule */}
      <div
        style={{ flex: 1, height: "1px", background: "transparent", transition: "background 0.12s" }}
        className="group-hover/iline:![background:var(--visual-editor-insert-line)]"
      />

      {/* + button — center */}
      <div
        style={{ position: "relative", margin: "0 6px" }}
        className={cn(
          "opacity-0 group-hover/iline:opacity-100 transition-opacity duration-150",
          open && "!opacity-100",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: open ? "var(--primary)" : "var(--visual-editor-bg)",
            color: open ? "#FFF" : "var(--visual-editor-text-dim)",
            boxShadow: open ? "0 1px 3px rgba(196,69,40,0.4)" : "none",
            transition: "all 0.12s",
            border: "none",
            cursor: "pointer",
            flexShrink: 0,
          }}
          className={cn(
            "group-hover/iline:![background:var(--primary)]",
            "group-hover/iline:![color:#FFF]",
            "group-hover/iline:![box-shadow:0_1px_3px_rgba(196,69,40,0.4)]",
          )}
          title="Insert block"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M4 1V7M1 4H7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>

        {/* Block type popup */}
        {open && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              top: "calc(100% + 8px)",
              zIndex: 50,
              background: "var(--visual-editor-canvas)",
              border: "1px solid var(--visual-editor-toolbar-border)",
              borderRadius: "10px",
              boxShadow: "var(--shadow-elevation-3)",
              padding: "6px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            {plugins.map((plugin) => {
              const Icon = plugin.icon
              return (
                <button
                  key={plugin.type}
                  type="button"
                  onClick={() => { onInsert(plugin.type); setOpen(false) }}
                  title={plugin.label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "4px",
                    padding: "8px",
                    borderRadius: "7px",
                    minWidth: "56px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    transition: "background 0.1s",
                  }}
                  className="hover:![background:var(--visual-editor-tool-hover)]"
                >
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "7px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: `${plugin.color}20`,
                      color: plugin.color,
                    }}
                  >
                    <Icon style={{ width: "14px", height: "14px" }} />
                  </div>
                  <span
                    style={{
                      fontSize: "9px",
                      fontWeight: 500,
                      color: "var(--visual-editor-text-dim)",
                    }}
                  >
                    {plugin.label}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Right rule */}
      <div
        style={{ flex: 1, height: "1px", background: "transparent", transition: "background 0.12s" }}
        className="group-hover/iline:![background:var(--visual-editor-insert-line)]"
      />
    </div>
  )
}
