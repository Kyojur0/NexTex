// LaTeX Syntax Highlighter
export type TokenType = 'command' | 'environment' | 'comment' | 'string' | 'bracket' | 'text'

export interface Token {
  type: TokenType
  content: string
  start: number
  end: number
}

export function tokenizeLaTeX(text: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < text.length) {
    const char = text[i]

    // Comments
    if (char === '%') {
      const endOfLine = text.indexOf('\n', i)
      const end = endOfLine === -1 ? text.length : endOfLine
      tokens.push({
        type: 'comment',
        content: text.slice(i, end),
        start: i,
        end,
      })
      i = end
      continue
    }

    // LaTeX Commands (\command)
    if (char === '\\' && i + 1 < text.length && /[a-zA-Z]/.test(text[i + 1])) {
      let j = i + 1
      while (j < text.length && /[a-zA-Z*]/.test(text[j])) {
        j++
      }
      tokens.push({
        type: 'command',
        content: text.slice(i, j),
        start: i,
        end: j,
      })
      i = j
      continue
    }

    // Environments (\begin{...} and \end{...})
    if (text.startsWith('\\begin{', i) || text.startsWith('\\end{', i)) {
      const braceStart = text.indexOf('{', i)
      const braceEnd = text.indexOf('}', braceStart)
      if (braceEnd !== -1) {
        tokens.push({
          type: 'environment',
          content: text.slice(i, braceEnd + 1),
          start: i,
          end: braceEnd + 1,
        })
        i = braceEnd + 1
        continue
      }
    }

    // Brackets
    if (char === '{' || char === '}' || char === '[' || char === ']' || char === '(' || char === ')') {
      tokens.push({
        type: 'bracket',
        content: char,
        start: i,
        end: i + 1,
      })
      i++
      continue
    }

    // String content (regular text)
    let j = i
    while (j < text.length && text[j] !== '\\' && text[j] !== '%' && text[j] !== '{' && text[j] !== '}' && text[j] !== '[' && text[j] !== ']') {
      j++
    }
    if (j > i) {
      tokens.push({
        type: 'text',
        content: text.slice(i, j),
        start: i,
        end: j,
      })
    }
    i = j
  }

  return tokens
}

export function getTokenColor(type: TokenType, isDark: boolean): string {
  if (isDark) {
    switch (type) {
      case 'command':
        return 'text-[var(--syntax-command)]'
      case 'environment':
        return 'text-[var(--syntax-keyword)]'
      case 'comment':
        return 'text-[var(--syntax-comment)]'
      case 'bracket':
        return 'text-[var(--syntax-bracket)]'
      case 'string':
        return 'text-[var(--syntax-string)]'
      default:
        return 'text-foreground'
    }
  } else {
    switch (type) {
      case 'command':
        return 'text-[#2563eb]' // Blue
      case 'environment':
        return 'text-[#7c3aed]' // Purple
      case 'comment':
        return 'text-[#6b7280]' // Gray
      case 'bracket':
        return 'text-[#059669]' // Green
      case 'string':
        return 'text-[#dc2626]' // Red
      default:
        return 'text-foreground'
    }
  }
}
