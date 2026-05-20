import { contextBridge, ipcRenderer } from 'electron'

// Track the anonymous wrappers so off() can remove the right function
const wrappers = new Map<string, Map<(...args: unknown[]) => void, (...args: unknown[]) => void>>()

const api = {
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    return ipcRenderer.invoke(channel, ...args)
  },
  on: (channel: string, listener: (...args: unknown[]) => void): void => {
    const wrapper = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => listener(...args)
    if (!wrappers.has(channel)) wrappers.set(channel, new Map())
    wrappers.get(channel)!.set(listener, wrapper as unknown as (...args: unknown[]) => void)
    ipcRenderer.on(channel, wrapper)
  },
  off: (channel: string, listener: (...args: unknown[]) => void): void => {
    const wrapper = wrappers.get(channel)?.get(listener)
    if (wrapper) {
      ipcRenderer.removeListener(channel, wrapper)
      wrappers.get(channel)!.delete(listener)
    }
  },
}

contextBridge.exposeInMainWorld('api', api)

export type API = typeof api
