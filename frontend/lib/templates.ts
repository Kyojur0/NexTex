export const BLANK_DOCUMENT = String.raw`\documentclass[11pt]{article}
\usepackage[margin=1in]{geometry}
\begin{document}

Start writing here.

\end{document}
`

const document = (body: string, preamble = '') => String.raw`\documentclass[11pt]{article}
\usepackage[margin=1in]{geometry}
\usepackage[T1]{fontenc}
\setlength{\parindent}{0pt}
\setlength{\parskip}{6pt}
\pagestyle{empty}
${preamble}
\begin{document}
${body}
\end{document}
`

export const TEMPLATES = [
  {
    id: 'minimal', name: 'Minimal', icon: '📄',
    description: 'Clean and simple, perfect for tech roles',
    content: document(String.raw`{\LARGE\bfseries Your Name}

you@example.com \quad City, Country

\section*{Profile}
A concise introduction to your experience and the work you want to do.

\section*{Experience}
\textbf{Role --- Company} \hfill 2024--Present
\begin{itemize}
  \item Describe an achievement and its impact.
  \item Explain a project, your contribution, and the result.
\end{itemize}

\section*{Education}
\textbf{Degree, University} \hfill 2020--2024

\section*{Skills}
Python, TypeScript, data analysis, technical writing.`),
  },
  {
    id: 'professional', name: 'Professional', icon: '💼',
    description: 'Traditional format for corporate positions',
    content: document(String.raw`\begin{center}
{\LARGE\bfseries Your Name}\\[6pt]
City, Country \quad you@example.com \quad +44 0000 000000
\end{center}
\hrule

\section*{Professional Summary}
An experienced professional with expertise in your field and a record of delivering results.

\section*{Employment History}
\textbf{Job Title, Organisation} \hfill 2023--Present
\begin{itemize}
  \item Led a project that improved an important business outcome.
  \item Worked with colleagues to deliver a measurable result.
\end{itemize}
\textbf{Previous Role, Organisation} \hfill 2021--2023
\begin{itemize}
  \item Describe the scope of your work and an achievement.
\end{itemize}

\section*{Education and Qualifications}
Degree or qualification, Institution \hfill 2021

\section*{Core Competencies}
Project management, stakeholder communication, analysis, leadership.`),
  },
  {
    id: 'modern', name: 'Modern', icon: '✨',
    description: 'Contemporary design with elegant typography',
    content: document(String.raw`{\Huge\bfseries Your Name}\\[5pt]
{\large Your professional headline}

you@example.com \quad portfolio.example.com \quad City
\vspace{8pt}\hrule

\section*{About}
A short overview of what you build, the problems you solve, and what motivates you.

\section*{Selected Experience}
\textbf{Role at Company} \hfill 2024--Present
\begin{itemize}
  \item Built a product or service that helped a specific audience.
  \item Improved a process and measured the benefit.
\end{itemize}

\section*{Projects}
\textbf{Project name} --- Explain the problem, approach, and outcome.

\section*{Education}
Degree, Institution \hfill 2024

\section*{Tools and Skills}
Design systems \quad Software development \quad Research`, String.raw`\renewcommand{\familydefault}{\sfdefault}`),
  },
  {
    id: 'academic', name: 'Academic', icon: '🎓',
    description: 'Structured format for research positions',
    content: document(String.raw`{\LARGE\bfseries Your Name}

Department, Institution \quad you@example.edu

\section*{Research Interests}
Your research areas, methods, and current questions.

\section*{Education}
\textbf{PhD in Subject}, University \hfill 2022--Present

Thesis: Your thesis title. Supervisor: Supervisor Name.

\textbf{MSc in Subject}, University \hfill 2020--2022

\section*{Research Experience}
\textbf{Research Assistant}, Laboratory \hfill 2021--2022
\begin{itemize}
  \item Investigated a research question using a named method.
  \item Published or presented findings to a relevant audience.
\end{itemize}

\section*{Selected Publications}
\begin{enumerate}
  \item Your Name and Collaborator. Paper title. \textit{Journal or Conference}, 2025.
\end{enumerate}

\section*{Teaching and Service}
Teaching Assistant, Course title \hfill 2024

\section*{Awards}
Award name, Awarding institution \hfill 2024`),
  },
  {
    id: 'creative', name: 'Creative', icon: '🎨',
    description: 'Portfolio-led layout for design and creative roles',
    content: document(String.raw`{\Huge\bfseries Your Name}

{\Large Designer / Writer / Creative}

portfolio.example.com \quad you@example.com
\vspace{8pt}\hrule

\section*{Creative Practice}
Describe your approach, the audiences you work with, and the stories you tell.

\section*{Selected Work}
\textbf{Project One} \hfill 2025

The brief, your creative direction, and the finished outcome.

\textbf{Project Two} \hfill 2024

An example of collaboration, experimentation, or a new medium.

\section*{Experience}
\textbf{Creative Role, Studio} \hfill 2023--Present
\begin{itemize}
  \item Developed a campaign, identity, or publication for a client.
  \item Collaborated with a team to bring an idea to life.
\end{itemize}

\section*{Education}
Degree or programme, Institution \hfill 2023

\section*{Capabilities}
Art direction, illustration, typography, storytelling, prototyping.`),
  },
] as const
