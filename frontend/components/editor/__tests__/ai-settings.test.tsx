import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AdvancedSettings } from '../advanced-settings'
import { useEditorStore } from '@/lib/store'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('shows configuration guidance and stores a custom AI model ID', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ configured: false, message: 'Set AI_GATEWAY_API_KEY in frontend/.env.local and restart.' })))
  render(<AdvancedSettings open onOpenChange={vi.fn()} />)
  expect(await screen.findByText(/Set AI_GATEWAY_API_KEY/)).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Model ID'), { target: { value: 'local-model:latest' } })
  expect(useEditorStore.getState().settings.aiModel).toBe('local-model:latest')
})
