import { app, BrowserWindow, shell, ipcMain, Tray, Menu, nativeImage, Notification } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
let win: BrowserWindow | null = null
let tray: Tray | null = null

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: true,
      contextIsolation: true
    }
  })
  const publicDirProd = path.join(process.resourcesPath, 'public')
  const indexProd = path.join(publicDirProd, 'index.html')
  const indexDev = path.resolve(__dirname, '../../dist/public/index.html')
  const indexFile = indexDev
  win.loadFile(indexFile)
  win.on('closed', () => { win = null })
}

function createTray() {
  try {
    const icon = nativeImage.createEmpty()
    tray = new Tray(icon)
    const menu = Menu.buildFromTemplate([
      { label: 'Open Inbox', click: () => win?.show() },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ])
    tray.setToolTip('Ibiki SMS')
    tray.setContextMenu(menu)
  } catch {}
}

app.whenReady().then(() => {
  createWindow()
  createTray()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

ipcMain.handle('desktop:notify', (_e, title: string, body: string) => {
  try { new Notification({ title, body }).show() } catch {}
})
