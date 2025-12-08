import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('ibiki', {
  desktop: {
    notify: (title: string, body: string) => ipcRenderer.invoke('desktop:notify', title, body),
    isDesktop: true
  }
})

