import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SmartTerminal } from '../smart-terminal'

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(cleanup)

describe('build issue navigation', () => {
  it('opens the diagnostic file at its original source line', () => {
    const onJumpToLine = vi.fn()
    render(<SmartTerminal logs={[]} diagnostics={[{
      file: 'sections/methods.tex', line: 12, message: 'Undefined control sequence.',
      context: '\\unknown', severity: 'error',
    }]} isOpen isBuilding={false} onToggle={vi.fn()} onJumpToLine={onJumpToLine} />)
    fireEvent.click(screen.getByRole('button', { name: /Issues/ }))
    fireEvent.click(screen.getByRole('button', { name: /sections\/methods\.tex:12/ }))
    expect(onJumpToLine).toHaveBeenCalledWith(12, 'sections/methods.tex')
    expect(screen.getByText('Undefined control sequence.')).toBeInTheDocument()
    expect(screen.getByText('\\unknown')).toBeInTheDocument()
  })

  it('retains unlocated compiler failures without duplicating mapped errors', () => {
    render(<SmartTerminal logs={[
      { type: 'error', message: 'Undefined control sequence.', timestamp: '12:00' },
      { type: 'error', message: 'Generated preamble failed', timestamp: '12:00' },
    ]} diagnostics={[{ file: 'main.tex', line: 4, message: 'Undefined control sequence.', context: '', severity: 'error' }]}
      isOpen isBuilding={false} onToggle={vi.fn()} onJumpToLine={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Issues/ }))
    expect(screen.getAllByText('Undefined control sequence.')).toHaveLength(1)
    expect(screen.getByText('Generated preamble failed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /main\.tex:4/ })).toBeInTheDocument()
  })

  it('keeps legacy log line links working when structured diagnostics are absent', () => {
    const onJumpToLine = vi.fn()
    render(<SmartTerminal logs={[{ type: 'warning', message: 'Reference missing on line 7', timestamp: '12:00' }]}
      isOpen isBuilding={false} onToggle={vi.fn()} onJumpToLine={onJumpToLine} />)
    fireEvent.click(screen.getByRole('button', { name: 'line 7' }))
    expect(onJumpToLine).toHaveBeenCalledWith(7)
  })
})
