import { useEditorStore } from './store'

export interface EditorCommand {
  type: 'command'
  id: string
  action: string
  args: Record<string, unknown>
  expires_at: number
}

export function editorSnapshot() {
  const s = useEditorStore.getState()
  return { workspace_root: s.workspaceRoot || null, path: s.activeFilePath, content: s.content,
    revision: s.revision, is_modified: s.isModified, mode: s.activeEditorTab,
    is_building: s.isBuilding, is_saving: s.isSaving, is_navigating: s.isNavigating,
    has_pending_draft: !!s.pendingDraft, can_undo: s.canUndo, can_redo: s.canRedo,
    pdf_url: s.pdfUrl, last_error: s.lastError, has_error: s.hasError,
    build_logs: s.buildLogs, error_lines: s.errorLines }
}

const actions = new Set(['read', 'open', 'set_content', 'save', 'save_as', 'build', 'undo', 'redo', 'set_mode'])

function notExpired(command: EditorCommand) {
  if (!Number.isFinite(command.expires_at) || command.expires_at <= Date.now())
    throw new Error('Editor command expired. Read the editor again before retrying.')
}

export async function executeEditorCommand(command: EditorCommand) {
  if (!actions.has(command.action)) throw new Error('Unsupported editor command')
  notExpired(command)
  if (command.action === 'read') return editorSnapshot()
  const before = useEditorStore.getState()
  const args = command.args
  const stale = () => new Error('The editor document or source changed. Read the editor again before retrying.')
  if (!before.workspaceRoot || args.expected_workspace_root !== before.workspaceRoot ||
      args.expected_path !== before.activeFilePath) throw stale()
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(before.content))
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  const current = useEditorStore.getState()
  // Hashing yields to user input. Recheck identity and source immediately before
  // calling the store, so a concurrent keystroke cannot be overwritten.
  if (hash !== args.expected_content_sha256 || current.content !== before.content ||
      current.activeFilePath !== before.activeFilePath || current.workspaceRoot !== before.workspaceRoot) throw stale()
  notExpired(command)
  if (current.pendingDraft) throw new Error('Recover or discard the available draft in NexTex first.')
  if (current.isNavigating || current.isSaving || current.isBuilding)
    throw new Error('The editor is busy saving, opening or building. Read its state and retry when idle.')
  switch (command.action) {
    case 'set_content':
      if (typeof args.content !== 'string') throw new Error('content must be a string')
      if (new TextEncoder().encode(args.content).length > 8 * 1024 * 1024)
        throw new Error('Editor source exceeds the 8 MiB bridge limit')
      current.setContent(args.content)
      break
    case 'open':
    case 'save_as':
      if (typeof args.path !== 'string' || !args.path.trim()) throw new Error('path is required')
      if (command.action === 'open') {
        await current.refreshFiles()
        // refreshFiles awaits I/O; openFile then owns navigation/save guards.
        const after = useEditorStore.getState()
        if (after.workspaceRoot !== before.workspaceRoot || after.activeFilePath !== before.activeFilePath ||
            after.content !== before.content) throw stale()
        notExpired(command)
        await after.openFile(args.path, args.path)
      } else await current.saveAs(args.path)
      break
    case 'save':
      if (!current.activeFilePath) throw new Error('Use save_as with a path for this document.')
      await current.saveActiveFile()
      break
    case 'build':
      if (!current.activeFilePath) throw new Error('Use save_as with a path before building.')
      await current.compileActiveFile()
      if (useEditorStore.getState().hasError)
        throw new Error(useEditorStore.getState().lastError || 'LaTeX compilation failed; inspect build_logs and error_lines.')
      break
    case 'undo':
      if (!current.canUndo) throw new Error('There is no edit to undo.')
      current.undo()
      break
    case 'redo':
      if (!current.canRedo) throw new Error('There is no edit to redo.')
      current.redo()
      break
    case 'set_mode':
      if (args.mode !== 'text' && args.mode !== 'visual') throw new Error('mode must be text or visual')
      current.setActiveEditorTab(args.mode)
      break
  }
  return editorSnapshot()
}
