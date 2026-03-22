// IndexedDB-backed version history store

export interface Version {
  id: string
  fileId: string
  content: string
  label: string
  isStarred: boolean
  isAuto: boolean
  createdAt: number // Unix ms timestamp
}

const DB_NAME = "texpress-versions"
const DB_VERSION = 1
const STORE_NAME = "versions"

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" })
        store.createIndex("fileId", "fileId", { unique: false })
        store.createIndex("createdAt", "createdAt", { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveVersion(version: Omit<Version, "id">): Promise<Version> {
  const db = await openDB()
  const id = `v-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const full: Version = { ...version, id }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    store.add(full)
    tx.oncomplete = () => resolve(full)
    tx.onerror = () => reject(tx.error)
  })
}

export async function getVersionsForFile(fileId: string): Promise<Version[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    const index = store.index("fileId")
    const req = index.getAll(fileId)
    req.onsuccess = () => {
      const versions: Version[] = req.result
      // Sort newest first
      versions.sort((a, b) => b.createdAt - a.createdAt)
      resolve(versions)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function updateVersion(id: string, updates: Partial<Pick<Version, "label" | "isStarred">>): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(id)
    req.onsuccess = () => {
      const existing = req.result as Version
      if (!existing) { resolve(); return }
      const updated = { ...existing, ...updates }
      store.put(updated)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function deleteVersion(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    store.delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function pruneOldAutoVersions(fileId: string, keepCount = 30): Promise<void> {
  const all = await getVersionsForFile(fileId)
  const autoVersions = all.filter(v => v.isAuto && !v.isStarred)
  // autoVersions is already sorted newest-first from getVersionsForFile
  if (autoVersions.length > keepCount) {
    const toDelete = autoVersions.slice(keepCount)
    await Promise.all(toDelete.map(v => deleteVersion(v.id)))
  }
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 5) return "Just now"
  if (seconds < 60) return `${seconds}s ago`
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`
  return new Date(timestamp).toLocaleDateString()
}
