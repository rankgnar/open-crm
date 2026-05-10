import { ipcMain } from 'electron'
import workflowsSource from './workflows.ts?raw'

function extractNodeSources(src: string): Record<string, string> {
  const result: Record<string, string> = {}
  const lines = src.split('\n')
  let i = 0
  while (i < lines.length) {
    const m = lines[i].match(/^  '([^']+)': async /)
    if (!m) { i++; continue }
    const type = m[1]
    const startLine = i
    i++
    while (i < lines.length && lines[i] !== '  },') i++
    if (i < lines.length) {
      result[type] = lines.slice(startLine, i + 1).join('\n')
    }
    i++
  }
  return result
}

const SOURCES = extractNodeSources(workflowsSource)

export function registerWorkflowNodeHandlers(): void {
  ipcMain.removeHandler('db:workflow-nodes:list')
  ipcMain.handle('db:workflow-nodes:list', async () => SOURCES)
}
