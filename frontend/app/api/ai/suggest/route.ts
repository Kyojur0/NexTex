import { generateText } from "ai"

export async function POST(req: Request) {
  const { prompt, code, model } = await req.json()

  if (!prompt || !code) {
    return Response.json({ error: "prompt and code are required" }, { status: 400 })
  }

  const selectedModel = model || "openai/gpt-4o-mini"

  const systemPrompt = `You are an expert LaTeX editor specializing in professional resumes and academic documents. 
Your job is to apply the user's requested change to the provided LaTeX code.
Return ONLY the modified LaTeX code - no explanations, no markdown code blocks, no extra text.
Preserve the document structure, indentation, and formatting conventions.
Only make the specific changes requested.`

  const userPrompt = `Here is the LaTeX code:
\`\`\`latex
${code}
\`\`\`

User request: ${prompt}

Return only the modified LaTeX code.`

  try {
    const { text } = await generateText({
      model: selectedModel,
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: 4000,
      temperature: 0.3,
    })

    // Strip any accidental markdown code fences the model might add
    const cleaned = text
      .replace(/^```(?:latex|tex)?\n?/i, "")
      .replace(/\n?```$/, "")
      .trim()

    return Response.json({ suggestion: cleaned })
  } catch (err: any) {
    return Response.json({ error: err?.message || "AI request failed" }, { status: 500 })
  }
}
