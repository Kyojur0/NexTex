import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FileTree } from '../file-tree'
import { useEditorStore } from '@/lib/store'

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => <button onClick={onClick}>{children}</button>,
  DropdownMenuSeparator: () => null,
}))

const files = [{ id: 'file-untitled.tex', name: 'untitled.tex', type: 'file' as const, path: 'untitled.tex' }]

describe('file operations', () => {
  afterEach(cleanup)
  it('uses a unique new name and shows operation errors', async () => {
    const createFile = vi.fn().mockRejectedValue(new Error('Permission denied'))
    useEditorStore.setState({ files, createFile })
    render(<FileTree files={files} activeFileId={null} onFileSelect={() => {}} onShowHistory={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'New File' }))
    await waitFor(() => expect(createFile).toHaveBeenCalledWith(null, 'untitled-2.tex', 'file'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Permission denied')
  })

  it('asks before deleting a file and awaits the actual operation', async () => {
    const deleteFile = vi.fn().mockResolvedValue(undefined)
    useEditorStore.setState({ files, deleteFile })
    render(<FileTree files={files} activeFileId={null} onFileSelect={() => {}} onShowHistory={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(deleteFile).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))
    await waitFor(() => expect(deleteFile).toHaveBeenCalledWith('file-untitled.tex'))
  })
})
