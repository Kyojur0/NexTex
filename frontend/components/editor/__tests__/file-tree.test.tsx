import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileTree } from '../file-tree'
import { useEditorStore } from '@/lib/store'

// Mock lucide-react icons to keep tests lightweight
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual('lucide-react')
  return {
    ...actual,
    ChevronRight: () => <span data-testid="chevron-right">&gt;</span>,
    ChevronDown: () => <span data-testid="chevron-down">v</span>,
    FileText: () => <span data-testid="file-icon">F</span>,
    Folder: () => <span data-testid="folder-icon">D</span>,
    FolderOpen: () => <span data-testid="folder-open-icon">O</span>,
    Plus: () => <span>+</span>,
    Clock: () => <span>C</span>,
    MoreVertical: () => <span>M</span>,
    Trash2: () => <span>T</span>,
    Edit2: () => <span>E</span>,
  }
})

describe('FileTree', () => {
  beforeEach(() => {
    useEditorStore.setState({
      projectName: 'Test Project',
      files: [],
      activeFileId: null,
    })
  })

  it('renders empty state when no files', () => {
    render(
      <FileTree
        files={[]}
        activeFileId={null}
        onFileSelect={() => {}}
        onShowHistory={() => {}}
      />
    )
    expect(screen.getByText(/No files/i)).toBeInTheDocument()
  })

  it('renders file items', () => {
    const files = [
      { id: 'file-resume.tex', name: 'resume.tex', type: 'file' as const, path: 'resume.tex' },
      { id: 'file-cover.tex', name: 'cover.tex', type: 'file' as const, path: 'cover.tex' },
    ]
    render(
      <FileTree
        files={files}
        activeFileId={null}
        onFileSelect={() => {}}
        onShowHistory={() => {}}
      />
    )
    expect(screen.getByText('resume.tex')).toBeInTheDocument()
    expect(screen.getByText('cover.tex')).toBeInTheDocument()
  })

  it('renders folder with children', () => {
    const files = [
      {
        id: 'folder-sections',
        name: 'sections',
        type: 'folder' as const,
        path: 'sections',
        children: [
          { id: 'file-sections/experience.tex', name: 'experience.tex', type: 'file' as const, path: 'sections/experience.tex' },
        ],
      },
    ]
    render(
      <FileTree
        files={files}
        activeFileId={null}
        onFileSelect={() => {}}
        onShowHistory={() => {}}
      />
    )
    expect(screen.getByText('sections')).toBeInTheDocument()
    expect(screen.getByText('experience.tex')).toBeInTheDocument()
  })

  it('calls onFileSelect when clicking a file', () => {
    const handleSelect = vi.fn()
    const files = [
      { id: 'file-resume.tex', name: 'resume.tex', type: 'file' as const, path: 'resume.tex' },
    ]
    render(
      <FileTree
        files={files}
        activeFileId={null}
        onFileSelect={handleSelect}
        onShowHistory={() => {}}
      />
    )
    fireEvent.click(screen.getByText('resume.tex'))
    expect(handleSelect).toHaveBeenCalledWith('file-resume.tex', 'resume.tex')
  })
})
