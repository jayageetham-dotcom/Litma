import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

const version = process.argv.find((a) => a.startsWith("--litma-version="))?.split("=")[1] ?? "";

/**
 * Lets the web app know it runs inside the desktop app (it hides the download links)
 * and drives updates (see updater.ts and the web app's DesktopUpdate component).
 */
contextBridge.exposeInMainWorld("litmaDesktop", {
  platform: process.platform,
  version,
  checkForUpdates: () => ipcRenderer.invoke("litma:update:check"),
  updateState: () => ipcRenderer.invoke("litma:update:state"),
  downloadUpdate: () => ipcRenderer.invoke("litma:update:download"),
  installUpdate: () => ipcRenderer.invoke("litma:update:install"),
  onUpdate: (cb: (state: unknown) => void) => {
    const h = (_e: IpcRendererEvent, s: unknown) => cb(s);
    ipcRenderer.on("litma:update", h);
    return () => ipcRenderer.removeListener("litma:update", h);
  },
});
