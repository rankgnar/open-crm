import { ipcMain, dialog, shell, BrowserWindow, app } from 'electron'
import { writeFile, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { supabase } from '../supabase'

export function registerPdfHandlers(): void {
  ipcMain.handle('db:pdf-mall:list', async () => {
    const { data, error } = await supabase
      .from('pdf_mallar')
      .select('*')
      .order('skapad_at')
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:pdf-mall:get', async (_, typ: string) => {
    const { data, error } = await supabase
      .from('pdf_mallar')
      .select('*')
      .eq('typ', typ)
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:pdf-mall:upsert', async (_, mall: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from('pdf_mallar')
      .upsert({ ...mall, uppdaterad_at: new Date().toISOString() }, { onConflict: 'typ' })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  // Generate PDF from HTML string using Electron's printToPDF
  ipcMain.handle('pdf:generate-html', async (_, { html, name, save, landscape }: { html: string; name: string; save?: boolean; landscape?: boolean }) => {
    const win = new BrowserWindow({
      show: false,
      width: landscape ? 1200 : 800,
      height: landscape ? 850 : 1131,
      webPreferences: { sandbox: false }
    })

    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

    const buffer = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      landscape: landscape ?? false,
      margins: { top: 0, bottom: 0, left: 0, right: 0 }
    })

    win.close()

    if (save) {
      const { filePath, canceled } = await dialog.showSaveDialog({
        defaultPath: join(app.getPath('downloads'), `${name}.pdf`),
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      })
      if (canceled || !filePath) return null
      await writeFile(filePath, buffer)
      return filePath
    }

    const tmpPath = join(tmpdir(), `open-crm-${name}-${Date.now()}.pdf`)
    await writeFile(tmpPath, buffer)
    await shell.openPath(tmpPath)
    return tmpPath
  })

  // Generate one or more HTMLs as PDFs and merge them into a single
  // file before showing a save dialog. Used when the user wants
  // (e.g.) the förslag and the landscape tidplan as a single document.
  ipcMain.handle('pdf:generate-merged', async (_, args: {
    parts: { html: string; landscape?: boolean }[]
    name: string
  }) => {
    if (!args.parts || args.parts.length === 0) return null

    const buffers: Buffer[] = []
    for (const part of args.parts) {
      const win = new BrowserWindow({
        show: false,
        width: part.landscape ? 1200 : 800,
        height: part.landscape ? 850 : 1131,
        webPreferences: { sandbox: false }
      })
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(part.html)}`)
      const buf = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        landscape: part.landscape ?? false,
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
      })
      win.close()
      buffers.push(buf)
    }

    let finalBytes: Uint8Array
    if (buffers.length === 1) {
      finalBytes = buffers[0]
    } else {
      const { PDFDocument } = await import('pdf-lib')
      const merged = await PDFDocument.create()
      for (const buf of buffers) {
        const doc = await PDFDocument.load(buf)
        const pages = await merged.copyPages(doc, doc.getPageIndices())
        pages.forEach(p => merged.addPage(p))
      }
      finalBytes = await merged.save()
    }

    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath: join(app.getPath('downloads'), `${args.name}.pdf`),
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (canceled || !filePath) return null
    await writeFile(filePath, Buffer.from(finalBytes))
    return filePath
  })

  // Generate a PDF from HTML and return base64 bytes.
  // Used when the caller needs the PDF as data (e.g. attaching to an
  // outgoing email) rather than saving to disk or opening it.
  ipcMain.handle('pdf:generate-buffer', async (_, { html, landscape }: { html: string; landscape?: boolean }) => {
    const win = new BrowserWindow({
      show: false,
      width: landscape ? 1200 : 800,
      height: landscape ? 850 : 1131,
      webPreferences: { sandbox: false }
    })

    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

    const buffer = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      landscape: landscape ?? false,
      margins: { top: 0, bottom: 0, left: 0, right: 0 }
    })

    win.close()
    return buffer.toString('base64')
  })

  // Pick image file and return as base64 data URL
  ipcMain.handle('pdf:pick-logo', async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Välj logotyp',
      filters: [{ name: 'Bilder', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp'] }],
      properties: ['openFile'],
    })
    if (canceled || filePaths.length === 0) return null
    const filePath = filePaths[0]
    const buffer = await readFile(filePath)
    const ext = filePath.split('.').pop()?.toLowerCase() ?? 'png'
    const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`
    return `data:${mime};base64,${buffer.toString('base64')}`
  })

  // Legacy: save buffer received from renderer to user-chosen location
  ipcMain.handle('pdf:save-file', async (_, { buffer, defaultName }: { buffer: number[]; defaultName: string }) => {
    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath: join(app.getPath('downloads'), defaultName),
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (canceled || !filePath) return null
    await writeFile(filePath, Buffer.from(buffer))
    return filePath
  })
}
