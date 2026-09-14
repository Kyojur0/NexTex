import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AISpotlight } from '../ai-spotlight'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('AI review', () => {
  it('prevents acceptance when the original document changes after requesting', async () => {
    const fetchMock = vi.fn().mockImplementation((_url, options) => Promise.resolve(Response.json(options?.method === 'POST' ? { suggestion: 'Improved' } : { configured: true, provider: 'gateway', message: 'Ready' })))
    vi.stubGlobal('fetch', fetchMock)
    const accept = vi.fn()
    const props = { selectedCode: '', currentContent: 'Original', documentId: 'workspace/a.tex', onAccept: accept, onClose: vi.fn(), aiModel: 'provider/model' }
    const view = render(<AISpotlight {...props} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Fix grammar and improve clarity' })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: 'Fix grammar and improve clarity' }))
    await screen.findByRole('button', { name: 'Accept changes' })
    view.rerender(<AISpotlight {...props} currentContent="New edit" />)
    expect(screen.getByRole('button', { name: 'Accept changes' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent(/changed/)
    expect(accept).not.toHaveBeenCalled()
  })

  it('shows configuration guidance and does not submit when AI is unavailable', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ configured: false, provider: null, message: 'Set AI_GATEWAY_API_KEY in frontend/.env.local and restart.' }))
    vi.stubGlobal('fetch', fetchMock)
    render(<AISpotlight selectedCode="" currentContent="Original" documentId="a" onAccept={vi.fn()} onClose={vi.fn()} aiModel="provider/model" />)
    await screen.findByText(/Set AI_GATEWAY_API_KEY/)
    expect(screen.getByRole('button', { name: 'Fix grammar and improve clarity' })).toBeDisabled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not apply a suggestion to a different file containing identical text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, options) => Promise.resolve(Response.json(options?.method === 'POST' ? { suggestion: 'Improved' } : { configured: true, provider: 'gateway', message: 'Ready' }))))
    const accept = vi.fn()
    const props = { selectedCode: '', currentContent: 'Original', documentId: 'workspace/a.tex', onAccept: accept, onClose: vi.fn(), aiModel: 'provider/model' }
    const view = render(<AISpotlight {...props} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Fix grammar and improve clarity' })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: 'Fix grammar and improve clarity' }))
    await screen.findByRole('button', { name: 'Accept changes' })
    view.rerender(<AISpotlight {...props} documentId="workspace/b.tex" />)
    expect(screen.getByRole('button', { name: 'Accept changes' })).toBeDisabled()
    expect(accept).not.toHaveBeenCalled()
  })

  it('applies a reviewed selection to its exact range, preserving the rest of the source', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, options) => Promise.resolve(Response.json(options?.method === 'POST' ? { suggestion: 'new' } : { configured: true, provider: 'compatible', local: true, message: 'Ready' }))))
    const accept = vi.fn()
    render(<AISpotlight selectedCode="old" selectedRange={{ start: 4, end: 7 }} currentContent="old old" documentId="a" onAccept={accept} onClose={vi.fn()} aiModel="local" />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Fix grammar and improve clarity' })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: 'Fix grammar and improve clarity' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Accept changes' }))
    expect(accept).toHaveBeenCalledWith('old new')
  })
})
