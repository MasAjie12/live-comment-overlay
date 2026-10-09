import { contextBridge, ipcRenderer } from 'electron'
import type { Batch, OverlayApi, Settings, StatusPayload } from '../shared/types'

function listen<T>(channel: string, cb: (v: T) => void): () => void {
  const handler = (_e: unknown, v: T) => cb(v)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: OverlayApi = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: Partial<Settings>) => ipcRenderer.invoke('settings:set', patch),
  connect: (username: string) => ipcRenderer.invoke('tiktok:connect', username),
  disconnect: () => ipcRenderer.invoke('tiktok:disconnect'),
  connectYoutube: (input: string) => ipcRenderer.invoke('youtube:connect', input),
  disconnectYoutube: () => ipcRenderer.invoke('youtube:disconnect'),
  getMemory: () => ipcRenderer.invoke('app:memory'),
  getDiag: () => ipcRenderer.invoke('app:diag'),
  getYoutubeReport: () => ipcRenderer.invoke('youtube:report'),
  restart: () => ipcRenderer.invoke('app:restart'),
  quit: () => ipcRenderer.invoke('app:quit'),
  openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
  minimize: () => ipcRenderer.invoke('app:minimize'),
  onBatch: (cb: (b: Batch) => void) => listen<Batch>('live:batch', cb),
  onStatus: (cb: (s: StatusPayload) => void) => listen<StatusPayload>('live:status', cb),
  onClickThrough: (cb: (on: boolean) => void) => listen<boolean>('overlay:clickthrough', cb)
}

contextBridge.exposeInMainWorld('overlay', api)
