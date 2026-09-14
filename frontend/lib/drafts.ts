export function documentKey(workspace: string, path: string): string {
  return JSON.stringify([workspace, path])
}

export interface Draft { content: string; revision: string | null; updatedAt: number }
const prefix = 'nextex-draft:'

export function readDraft(workspace: string, path: string): Draft | null {
  try {
    const raw = localStorage.getItem(prefix + documentKey(workspace, path))
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const candidate = value as Partial<Draft>
    if (typeof candidate.content !== 'string' ||
        !(candidate.revision === null || typeof candidate.revision === 'string') ||
        typeof candidate.updatedAt !== 'number' || !Number.isFinite(candidate.updatedAt) || candidate.updatedAt < 0) return null
    return { content: candidate.content, revision: candidate.revision, updatedAt: candidate.updatedAt }
  } catch { return null }
}

export function writeDraft(workspace: string, path: string, content: string, revision: string | null): void {
  localStorage.setItem(prefix + documentKey(workspace, path), JSON.stringify({ content, revision, updatedAt: Date.now() }))
}

export function removeDraft(workspace: string, path: string): void {
  try { localStorage.removeItem(prefix + documentKey(workspace, path)) } catch { /* disk save remains authoritative */ }
}
