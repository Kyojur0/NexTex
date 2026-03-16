const API_BASE = "http://127.0.0.1:8000";

export interface FileNode {
  id: string;
  name: string;
  type: "file" | "folder";
  path: string;
  children?: FileNode[];
}

export interface CompileResult {
  build_id: string;
  success: boolean;
  logs: Array<{ type: string; message: string }>;
  pdf_available: boolean;
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

export async function writeFile(path: string, content: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/files/write`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content }),
  });
  if (!res.ok) throw new Error(`Failed to write file: ${res.statusText}`);
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
  if (!res.ok) throw new Error(`Failed to rename: ${res.statusText}`);
}

export async function deleteItem(path: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/files/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error(`Failed to delete: ${res.statusText}`);
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
