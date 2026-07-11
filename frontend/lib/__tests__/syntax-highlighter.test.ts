import { describe, expect, it } from 'vitest'
import { tokenizeLaTeX } from '../syntax-highlighter'

describe('tokenizeLaTeX', () => {
  it('terminates on escaped symbols and line-break commands', () => {
    const input = String.raw`\begin{center}
Name \\[4pt]
100\% complete \& ready
\end{center}`

    const startedAt = performance.now()
    const tokens = tokenizeLaTeX(input)
    const elapsed = performance.now() - startedAt

    expect(tokens.length).toBeGreaterThan(0)
    expect(tokens.map((token) => token.content)).toContain(String.raw`\\`)
    expect(tokens.map((token) => token.content)).toContain(String.raw`\%`)
    expect(elapsed).toBeLessThan(50)
  })
})
