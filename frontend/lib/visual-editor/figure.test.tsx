import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { figurePlugin, type FigureData } from './plugins/figure'
import { parseLaTeXToBlocks } from './parser'
function FigureHarness() {
  const content=useEditorStore(state=>state.content)
  const data=parseLaTeXToBlocks(content).find(block=>block.type==='figure')!.data as FigureData
  return <figurePlugin.renderEditor block={{id:'figure',type:'figure',data}} isActive onChange={next=>useEditorStore.getState().setContent(figurePlugin.toLaTeX(next))} onFocus={()=>{}} onBlur={()=>{}}/>
}
import { useEditorStore } from '@/lib/store'
import * as api from '@/lib/api'

beforeEach(() => { useEditorStore.setState({content:'\\begin{figure}[h]\n\\centering\n\\includegraphics[width=0.8\\textwidth]{existing.png}\n\\caption{Example}\n\\end{figure}',activeFilePath:'project/main.tex',isModified:false}); useEditorStore.getState().resetSourceHistory() })
afterEach(() => vi.restoreAllMocks())
describe('figure workspace assets', () => {
  it('previews saved asset paths from the active document directory', () => {
    const {container} = render(<FigureHarness />)
    expect(container.querySelector('img')).toHaveAttribute('src',api.getAssetUrl('project/existing.png'))
  })
  it('uploads an image to workspace assets and stores its relative LaTeX path', async () => {
    const upload = vi.spyOn(api,'uploadAsset').mockImplementation(async (path) => ({path}))
    useEditorStore.setState({refreshFiles:async () => {}})
    const {container} = render(<FigureHarness />)
    const file = new File(['image bytes'],'diagram.png',{type:'image/png'})
    fireEvent.change(container.querySelector('input[type=file]')!,{target:{files:[file]}})
    await waitFor(() => expect(useEditorStore.getState().content).toMatch(/\\includegraphics\[width=0.8\\textwidth\]\{assets\/[^}]+diagram\.png\}/))
    expect(upload.mock.calls[0][0]).toMatch(/^project\/assets\//)
    expect(atob(upload.mock.calls[0][1])).toBe('image bytes')
    upload.mockRestore()
  })
  it('uses the normalized image path returned by the server', async () => {
    const upload = vi.spyOn(api,'uploadAsset').mockResolvedValue({path:'project/assets/converted.png'})
    useEditorStore.setState({refreshFiles:async () => {}})
    const {container} = render(<FigureHarness />)
    fireEvent.change(container.querySelector('input[type=file]')!,{target:{files:[new File(['gif'],'image.gif',{type:'image/gif'})]}})
    await waitFor(() => expect(useEditorStore.getState().content).toContain('{assets/converted.png}'))
    upload.mockRestore()
  })
  it('preserves caption edits made while an upload is pending', async () => {
    let finish!: (result:{path:string}) => void
    const upload = vi.spyOn(api,'uploadAsset').mockImplementation(() => new Promise(resolve => {finish = resolve}))
    useEditorStore.setState({refreshFiles:async () => {}})
    const {container} = render(<FigureHarness />)
    fireEvent.change(container.querySelector('input[type=file]')!,{target:{files:[new File(['png'],'image.png',{type:'image/png'})]}})
    await waitFor(() => expect(finish).toBeDefined())
    const caption = container.querySelector<HTMLElement>('[data-latex-editor]')!
    caption.textContent = 'Updated caption'; fireEvent.input(caption)
    await act(async () => finish({path:'project/assets/imported.png'}))
    expect(useEditorStore.getState().content).toContain('\\caption{Updated caption}')
    upload.mockRestore()
  })
  it('keeps the latest chosen image when uploads finish out of order', async () => {
    const finish: ((result:{path:string}) => void)[] = []
    vi.spyOn(api,'uploadAsset').mockImplementation(() => new Promise(resolve => {finish.push(resolve)}))
    useEditorStore.setState({refreshFiles:async () => {}})
    const {container} = render(<FigureHarness />)
    const input = container.querySelector('input[type=file]')!
    fireEvent.change(input,{target:{files:[new File(['png'],'first.png',{type:'image/png'})]}})
    await waitFor(() => expect(finish).toHaveLength(1))
    fireEvent.change(input,{target:{files:[new File(['png'],'second.png',{type:'image/png'})]}})
    await waitFor(() => expect(finish).toHaveLength(2))
    await act(async () => finish[1]({path:'project/assets/second.png'}))
    await act(async () => finish[0]({path:'project/assets/first.png'}))
    expect(useEditorStore.getState().content).toContain('{assets/second.png}')
  })
  it('reflects width changes in the image preview', () => {
    const {container} = render(<FigureHarness />)
    fireEvent.change(container.querySelector('input[type=range]')!,{target:{value:'0.6'}})
    expect(container.querySelector('img')).toHaveStyle({width:'60%'})
  })
})
