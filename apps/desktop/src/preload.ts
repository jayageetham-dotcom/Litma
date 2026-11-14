import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

const version = process.argv.find((a) => a.startsWith("--litma-version="))?.split("=")[1] ?? "";
/** "mas", "msstore" or "snap" when an app store updates this copy (main process store.ts), else "" */
const store = process.argv.find((a) => a.startsWith("--litma-store="))?.split("=")[1] ?? "";

// a store copy gets no update functions, so the web app shows no update card or "Check for updates"
const updates = store
  ? {}
  : {
      checkForUpdates: () => ipcRenderer.invoke("litma:update:check"),
      updateState: () => ipcRenderer.invoke("litma:update:state"),
      downloadUpdate: () => ipcRenderer.invoke("litma:update:download"),
      installUpdate: () => ipcRenderer.invoke("litma:update:install"),
      onUpdate: (cb: (state: unknown) => void) => {
        const h = (_e: IpcRendererEvent, s: unknown) => cb(s);
        ipcRenderer.on("litma:update", h);
        return () => ipcRenderer.removeListener("litma:update", h);
      },
    };

/**
 * Lets the web app know it runs inside the desktop app (it hides the download links)
 * and drives updates (see updater.ts and the web app's DesktopUpdate component).
 */
contextBridge.exposeInMainWorld("litmaDesktop", {
  platform: process.platform,
  version,
  store: store || null,
  ...updates,
  // writing reminders and timer alerts as system notifications (reminders.ts)
  setReminder: (state: unknown) => ipcRenderer.invoke("litma:reminder:set", state),
  reminderRang: (day: string) => ipcRenderer.invoke("litma:reminder:rang", day),
  notify: (title: string, body: string) => ipcRenderer.invoke("litma:notify", title, body),
  // daily backups into a folder the writer picks (backup.ts)
  backupFolder: () => ipcRenderer.invoke("litma:backup:folder"),
  chooseBackupFolder: () => ipcRenderer.invoke("litma:backup:choose"),
  forgetBackupFolder: () => ipcRenderer.invoke("litma:backup:forget"),
  openBackupFolder: () => ipcRenderer.invoke("litma:backup:open"),
  writeBackup: (name: string, bytes: ArrayBuffer) => ipcRenderer.invoke("litma:backup:write", name, bytes),
});
