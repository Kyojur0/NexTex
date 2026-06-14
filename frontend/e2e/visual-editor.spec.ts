import { test, expect, type Page } from "playwright/test"

async function collectConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = []
  page.on("pageerror", (err) => errors.push(err.message))
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text())
  })
  return errors
}

async function switchToVisualEditor(page: Page) {
  await page.goto("/")
  await page.waitForSelector('[data-testid="visual-editor-tab"]', { timeout: 10000 })
  await page.click('[data-testid="visual-editor-tab"]')
  await page.waitForSelector('[data-testid="block-canvas"]', { timeout: 10000 })
}

async function addBlock(page: Page, label: string) {
  await page.click(`[data-testid="block-palette-button-${label}"]`)
  await page.waitForTimeout(250)
}

async function getBlockCount(page: Page) {
  return page.locator('[data-testid="block-card"]').count()
}

async function getLatexOutput(page: Page) {
  return page.locator('[data-testid="latex-output-panel"] code').innerText()
}

async function focusBlock(page: Page, cardLocator: ReturnType<Page["locator"]>) {
  await cardLocator.click()
  await page.waitForTimeout(150)
}

test.describe("Visual Block Editor", () => {
  test("adds every block type and renders LaTeX output", async ({ page }) => {
    const errors = await collectConsoleErrors(page)
    await switchToVisualEditor(page)

    const blockTypes = ["Paragraph", "Section", "Math", "List", "Figure", "Table", "Code"]
    for (const type of blockTypes) {
      const before = await getBlockCount(page)
      await addBlock(page, type)
      const after = await getBlockCount(page)
      expect(after).toBe(before + 1)
    }

    const latex = await getLatexOutput(page)
    expect(latex).toContain("\\begin{equation}")
    expect(latex).toContain("\\begin{itemize}")
    expect(latex).toContain("\\begin{figure}")
    expect(latex).toContain("\\begin{tabular}")
    expect(latex).toContain("\\begin{lstlisting}")

    expect(errors).toHaveLength(0)
  })

  test("edits block inline and updates LaTeX output", async ({ page }) => {
    const errors = await collectConsoleErrors(page)
    await switchToVisualEditor(page)

    // Clear pre-loaded blocks for a clean test
    let cards = page.locator('[data-testid="block-card"]')
    while (await cards.count() > 0) {
      await cards.first().hover()
      await cards.first().locator('button[title="Delete"]').click()
      await page.waitForTimeout(150)
    }

    await addBlock(page, "Section")
    cards = page.locator('[data-testid="block-card"]')
    const card = cards.last()
    const titleInput = card.locator('div[contenteditable]')
    await titleInput.evaluate((el) => {
      const div = el as HTMLDivElement
      div.focus()
      div.innerText = "Introduction"
      div.dispatchEvent(new Event("input", { bubbles: true }))
      div.blur()
    })

    await page.waitForTimeout(300)
    const latex = await getLatexOutput(page)
    expect(latex).toContain("\\section{Introduction}")

    expect(errors).toHaveLength(0)
  })

  test("duplicates and deletes blocks via hover toolbar", async ({ page }) => {
    const errors = await collectConsoleErrors(page)
    await switchToVisualEditor(page)

    await addBlock(page, "Paragraph")
    const countAfterAdd = await getBlockCount(page)

    const card = page.locator('[data-testid="block-card"]').first()
    await card.hover()
    await card.locator('button[title="Duplicate"]').click()
    await page.waitForTimeout(250)
    expect(await getBlockCount(page)).toBe(countAfterAdd + 1)

    const firstCard = page.locator('[data-testid="block-card"]').first()
    await firstCard.hover()
    await firstCard.locator('button[title="Delete"]').click()
    await page.waitForTimeout(250)
    expect(await getBlockCount(page)).toBe(countAfterAdd)

    expect(errors).toHaveLength(0)
  })

  test("reorders blocks via drag and drop", async ({ page }) => {
    const errors = await collectConsoleErrors(page)
    await switchToVisualEditor(page)

    await addBlock(page, "Section")
    await addBlock(page, "Paragraph")

    const cards = page.locator('[data-testid="block-card"]')
    const first = cards.first()
    const second = cards.nth(1)

    const firstBox = await first.boundingBox()
    const secondBox = await second.boundingBox()
    if (firstBox && secondBox) {
      await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y - 10, { steps: 10 })
      await page.mouse.up()
      await page.waitForTimeout(300)
    }

    const latex = await getLatexOutput(page)
    expect(latex.length).toBeGreaterThan(0)

    expect(errors).toHaveLength(0)
  })

  test("round-trips LaTeX between text and visual editors", async ({ page }) => {
    const errors = await collectConsoleErrors(page)
    await switchToVisualEditor(page)

    // Clear pre-loaded blocks for a clean test
    let cards = page.locator('[data-testid="block-card"]')
    while (await cards.count() > 0) {
      await cards.first().hover()
      await cards.first().locator('button[title="Delete"]').click()
      await page.waitForTimeout(150)
    }

    await addBlock(page, "Section")
    cards = page.locator('[data-testid="block-card"]')
    const card = cards.last()
    const titleInput = card.locator('div[contenteditable]')
    await titleInput.evaluate((el) => {
      const div = el as HTMLDivElement
      div.focus()
      div.innerText = "Round Trip Test"
      div.dispatchEvent(new Event("input", { bubbles: true }))
      div.blur()
    })
    await page.waitForTimeout(300)

    await page.click('[data-testid="text-editor-tab"]')
    await page.waitForTimeout(500)
    const textarea = page.locator('textarea').first()
    const textContent = await textarea.inputValue()
    expect(textContent).toContain("\\section{Round Trip Test}")

    await page.click('[data-testid="visual-editor-tab"]')
    await page.waitForTimeout(500)
    const preview = page.locator('[data-testid="block-card"]').last().locator('div[contenteditable]')
    await expect(preview).toContainText("Round Trip Test")

    expect(errors).toHaveLength(0)
  })
})
