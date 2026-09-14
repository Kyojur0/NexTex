# Overleaf-style visual editing

The user's latest preference is to keep NexTex styling and match Overleaf's editing behavior. The visual pane will become a continuous, source-backed editor, with a compact NexTex toolbar, serif writing surface, inline formatting, headings, lists, rendered mathematics, and structured insert/edit dialogs. The PDF remains the typeset result in the adjacent pane.

Use CodeMirror 6 to retain a single LaTeX document and decorate recognized syntax. Never serialize the whole document from HTML. Unknown commands stay available as source; comments, macros, whitespace and preamble must survive unrelated edits exactly. Inline formatting, heading changes and list editing change only selected ranges. Math, table and image previews provide edit actions and source fallback.

Keep Zustand as the document authority, including save/build, recovery, global undo/redo, revision conflicts and MCP edits. External changes update the editor without feedback loops. Preserve existing user documents. Scope styles to the visual pane and its controls; retain NexTex identity and existing project navigation.

Primary references: Overleaf's redesigned editor guide and table guide at docs.overleaf.com; its public source editor extension establishes the source-backed architecture. CodeMirror documentation provides the decoration implementation pattern. Implement independently rather than copying Overleaf code.

Acceptance: continuous typing and selection across paragraphs; keyboard formatting and lists; source-preserving mode switches; editable math/image/table insertions; working find/undo/redo/save/MCP; safe unsupported LaTeX; desktop and narrow-pane visual checks. Exact typesetting belongs to the existing TeX compiler, and advanced package-specific syntax may remain source.
