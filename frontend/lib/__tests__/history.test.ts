import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { documentKey, readDraft, writeDraft } from '../drafts'
import { getVersionsForFile, recordSnapshot, moveFileHistory, saveVersion, pruneOldAutoVersions } from '../version-db'

describe('workspace-scoped history and recovery', () => {
  it('does not mix identically named documents from different workspaces', async () => {
    await recordSnapshot('/first', 'resume.tex', 'first contents')
    await recordSnapshot('/second', 'resume.tex', 'second contents')
    expect((await getVersionsForFile(documentKey('/first', 'resume.tex'))).map(v => v.content)).toEqual(['first contents'])
    writeDraft('/first', 'resume.tex', 'draft', 'r0')
    expect(readDraft('/second', 'resume.tex')).toBeNull()
  })
  it('deduplicates simultaneous automatic snapshots', async () => {
    await Promise.all([recordSnapshot('/dedupe', 'a.tex', 'same'), recordSnapshot('/dedupe', 'a.tex', 'same')])
    expect(await getVersionsForFile(documentKey('/dedupe', 'a.tex'))).toHaveLength(1)
  })
  it('retains descendant history after a folder rename without moving another workspace', async () => {
    await recordSnapshot('/move', 'old/chapter.tex', 'chapter')
    await recordSnapshot('/other', 'old/chapter.tex', 'other')
    await moveFileHistory('/move', 'old', 'new')
    expect(await getVersionsForFile(documentKey('/move', 'old/chapter.tex'))).toHaveLength(0)
    expect((await getVersionsForFile(documentKey('/move', 'new/chapter.tex')))[0].content).toBe('chapter')
    expect(await getVersionsForFile(documentKey('/other', 'old/chapter.tex'))).toHaveLength(1)
  })
  it('prunes old automatic versions but retains starred and manual snapshots', async () => {
    const fileId = documentKey('/prune', 'a.tex')
    for (let i = 0; i < 5; i++) await saveVersion({ fileId, content: String(i), label: '', isStarred: i === 0, isAuto: i !== 1, createdAt: i })
    await pruneOldAutoVersions(fileId, 1)
    expect((await getVersionsForFile(fileId)).map(v => v.content)).toEqual(['4', '1', '0'])
  })
})
