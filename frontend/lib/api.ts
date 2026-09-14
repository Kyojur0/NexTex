const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export function getEditorSocketUrl(): string {
  const url = new URL('/api/editor/connect', API_BASE)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = 'ApiError' }
}

async function checkResponse(res: Response): Promise<void> {
  if (res.ok) return;
  const data = await res.json().catch(() => ({}));
  const detail = data.detail;
  const message = typeof detail === 'string' ? detail : detail?.message;
  throw new ApiError(message || data.error || `Request failed (${res.status} ${res.statusText})`, res.status);
}

export interface DocumentData { content: string; revision: string }

export async function readDocument(path: string): Promise<DocumentData> {
  const res = await fetch(`${API_BASE}/api/files/read?path=${encodeURIComponent(path)}`);
  await checkResponse(res);
  return res.json();
}

export async function createDocumentFile(path: string, content: string): Promise<{ revision: string }> {
  const res = await fetch(`${API_BASE}/api/files/create`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, type: 'file', content }),
  });
  await checkResponse(res);
  return res.json();
}

export async function uploadAsset(path: string, base64: string): Promise<{ path: string }> {
  const res = await fetch(`${API_BASE}/api/assets/upload`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content_base64: base64 }),
  });
  await checkResponse(res);
  return res.json();
}

export function getAssetUrl(path: string): string {
  return `${API_BASE}/api/assets?path=${encodeURIComponent(path)}`;
}

export interface FileNode {
  id: string;
  name: string;
  type: "file" | "folder";
  path: string;
  children?: FileNode[];
}

export interface WorkspaceInfo {
  workspace_root: string;
  trusted_local_mode: boolean;
  source: string;
}

export interface CompileResult {
  build_id: string;
  success: boolean;
  logs: Array<{ type: string; message: string }>;
  error_lines: Array<{ line: number; message: string; context: string; severity: string; file?: string }>;
  pdf_available: boolean;
  pdf_url: string | null;
  build_dir: string | null;
}

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

export async function getWorkspace(): Promise<WorkspaceInfo> {
  const res = await fetch(`${API_BASE}/api/workspace`);
  if (!res.ok) throw new Error(`Failed to get workspace: ${res.statusText}`);
  return res.json();
}

export async function selectWorkspace(path: string, trusted: boolean): Promise<WorkspaceInfo> {
  const res = await fetch(`${API_BASE}/api/workspace/select`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, trusted }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to select workspace: ${res.statusText}`);
  }
  return res.json();
}

export async function resetWorkspace(): Promise<WorkspaceInfo> {
  const res = await fetch(`${API_BASE}/api/workspace/reset`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to reset workspace: ${res.statusText}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// File-system
// ---------------------------------------------------------------------------

export async function fetchFileTree(path: string = ""): Promise<FileNode[]> {
  const res = await fetch(`${API_BASE}/api/files?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(`Failed to list files: ${res.statusText}`);
  return res.json();
}

export async function readFile(path: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/files/read?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(`Failed to read file: ${res.statusText}`);
  const data = await res.json();
  return data.content;
}

export async function writeFile(path: string, content: string, expectedRevision?: string | null): Promise<{ revision: string }> {
  const res = await fetch(`${API_BASE}/api/files/write`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content, ...(expectedRevision != null ? { expected_revision: expectedRevision } : {}) }),
  });
  await checkResponse(res);
  return res.json();
}

export async function createItem(path: string, type: "file" | "folder"): Promise<void> {
  const res = await fetch(`${API_BASE}/api/files/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, type }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to create item: ${res.statusText}`);
  }
}

export async function renameItem(oldPath: string, newPath: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/files/rename`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ old_path: oldPath, new_path: newPath }),
  });
  await checkResponse(res);
}

export async function deleteItem(path: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/files/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  await checkResponse(res);
}

// ---------------------------------------------------------------------------
// LaTeX compilation
// ---------------------------------------------------------------------------

export async function compileLaTeX(
  filePath: string,
  compiler: string = "pdflatex"
): Promise<CompileResult> {
  const res = await fetch(`${API_BASE}/api/compile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_path: filePath, compiler }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Compilation failed: ${res.statusText}`);
  }
  return res.json();
}

export function getPdfUrl(buildId: string): string {
  return `${API_BASE}/api/compile/${buildId}/pdf`;
}
