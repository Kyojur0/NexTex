// Types for the editor state
export interface EditorFile {
  id: string
  name: string
  path: string
  content: string
  isModified: boolean
  isMain?: boolean
}

export interface ProjectFolder {
  name: string
  path: string
  files: EditorFile[]
}

export interface RecentProject {
  name: string
  path: string
  lastOpened: Date
}

export interface EditorSettings {
  fontSize: number
  tabSize: number
  wordWrap: boolean
  autoSave: boolean
  buildOnSave: boolean
  theme: 'dark' | 'light' | 'system'
  mainFile: string | null
  compiler: 'pdflatex' | 'xelatex' | 'lualatex'
}

export const defaultSettings: EditorSettings = {
  fontSize: 14,
  tabSize: 2,
  wordWrap: true,
  autoSave: true,
  buildOnSave: false,
  theme: 'dark',
  mainFile: null,
  compiler: 'pdflatex'
}

// Sample LaTeX content for demo
export const sampleResumeContent = `\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=1in]{geometry}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage{hyperref}

% Custom section formatting
\\titleformat{\\section}{\\large\\bfseries}{}{0em}{}[\\titlerule]
\\titlespacing{\\section}{0pt}{12pt}{6pt}

\\begin{document}

% Header
\\begin{center}
    {\\Huge\\bfseries John Doe}\\\\[4pt]
    \\href{mailto:john@email.com}{john@email.com} $\\cdot$
    (555) 123-4567 $\\cdot$
    San Francisco, CA $\\cdot$
    \\href{https://linkedin.com/in/johndoe}{LinkedIn}
\\end{center}

\\section{Experience}

\\textbf{Senior Software Engineer} \\hfill 2021 -- Present\\\\
\\textit{Tech Company Inc.} \\hfill San Francisco, CA
\\begin{itemize}[leftmargin=*, nosep]
    \\item Led development of microservices architecture
    \\item Improved system performance by 40\\%
    \\item Mentored team of 5 junior developers
\\end{itemize}

\\section{Education}

\\textbf{Bachelor of Science in Computer Science} \\hfill 2017\\\\
\\textit{University of California, Berkeley}

\\section{Skills}

\\textbf{Languages:} JavaScript, TypeScript, Python, Go\\\\
\\textbf{Frameworks:} React, Node.js, Next.js, FastAPI\\\\
\\textbf{Tools:} Git, Docker, Kubernetes, AWS

\\end{document}
`

// Resume templates
export const resumeTemplates = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean and simple, perfect for tech roles',
    preview: '/templates/minimal.png'
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Traditional format for corporate positions',
    preview: '/templates/professional.png'
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Contemporary design with accent colors',
    preview: '/templates/modern.png'
  },
  {
    id: 'academic',
    name: 'Academic',
    description: 'Structured format for research positions',
    preview: '/templates/academic.png'
  },
  {
    id: 'creative',
    name: 'Creative',
    description: 'Unique layout for design roles',
    preview: '/templates/creative.png'
  }
]

// Snippets for quick insertion
export const latexSnippets = [
  { label: 'Section', trigger: 'sec', content: '\\section{$1}\n$0' },
  { label: 'Subsection', trigger: 'sub', content: '\\subsection{$1}\n$0' },
  { label: 'Item List', trigger: 'item', content: '\\begin{itemize}\n    \\item $1\n\\end{itemize}$0' },
  { label: 'Bold', trigger: 'bf', content: '\\textbf{$1}$0' },
  { label: 'Italic', trigger: 'it', content: '\\textit{$1}$0' },
  { label: 'Experience Entry', trigger: 'exp', content: '\\textbf{$1} \\hfill $2\\\\\n\\textit{$3} \\hfill $4\n\\begin{itemize}[leftmargin=*, nosep]\n    \\item $5\n\\end{itemize}$0' },
  { label: 'Education Entry', trigger: 'edu', content: '\\textbf{$1} \\hfill $2\\\\\n\\textit{$3}$0' },
  { label: 'Skills Row', trigger: 'skill', content: '\\textbf{$1:} $2\\\\$0' },
]
