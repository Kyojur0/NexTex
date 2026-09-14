import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TemplateModal } from '../template-modal'

const { createDocument } = vi.hoisted(() => ({ createDocument: vi.fn() }))
vi.mock('@/lib/store', () => ({ useEditorStore: (select: (state: unknown) => unknown) => select({ createDocument }) }))

describe('template creation', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('creates a named standalone document before closing', async () => {
    const close = vi.fn()
    createDocument.mockResolvedValue(undefined)
    render(<TemplateModal open onOpenChange={close} />)
    fireEvent.click(screen.getByRole('button', { name: /Minimal/ }))
    fireEvent.change(screen.getByLabelText('File name'), { target: { value: 'my-resume.tex' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create from Template' }))
    await waitFor(() => expect(createDocument).toHaveBeenCalledWith('my-resume.tex', expect.stringContaining('\\begin{document}')))
    expect(createDocument.mock.calls[0][1]).toContain('\\end{document}')
    await waitFor(() => expect(close).toHaveBeenCalledWith(false))
  })

  it('keeps the dialog open and displays a creation failure', async () => {
    createDocument.mockRejectedValue(new Error('File already exists'))
    const close = vi.fn()
    render(<TemplateModal open onOpenChange={close} />)
    fireEvent.click(screen.getByRole('button', { name: /Academic/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Create from Template' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('File already exists')
    expect(close).not.toHaveBeenCalled()
  })
})
