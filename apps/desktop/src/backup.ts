import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Daily backups for the desktop app, written into a folder the writer picks. Choosing the folder of
 * Google Drive for desktop, iCloud Drive, OneDrive or Dropbox puts the backups in that cloud too,
 * with nothing to sign in to in Litma. The web app builds the zip (lib/backup.ts); this writes it
 * and keeps the newest KEEP files named "Litma backup …zip" in the folder.
 */
const KEEP = 14;
const file = () => join(app.getPath("userData"), "backup.json");

function folder(): string | null {
  try {
    if (existsSync(file())) return JSON.parse(readFileSync(file(), "utf8")).folder ?? null;
  } catch {
    /* unreadable: no folder */
  }
  return null;
}
function setFolder(f: string | null) {
  try {
    writeFileSync(file(), JSON.stringify({ folder: f }));
  } catch {
    /* read-only profile */
  }
}

export function registerBackup() {
  ipcMain.handle("litma:backup:folder", () => folder());
  ipcMain.handle("litma:backup:choose", async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined;
    const r = await (win ? dialog.showOpenDialog(win, { properties: ["openDirectory", "createDirectory"], defaultPath: folder() ?? app.getPath("documents") }) : dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] }));
    if (r.canceled || !r.filePaths[0]) return folder();
    setFolder(r.filePaths[0]);
    return r.filePaths[0];
  });
  ipcMain.handle("litma:backup:forget", () => setFolder(null));
  ipcMain.handle("litma:backup:open", () => {
    const f = folder();
    if (f) shell.openPath(f);
  });
  ipcMain.handle("litma:backup:write", async (_e, name: string, bytes: ArrayBuffer) => {
    const f = folder();
    if (!f) throw new Error("no-folder");
    const safe = String(name).replace(/[\\/:*?"<>|]+/g, " ").trim() || "Litma backup.zip";
    await mkdir(f, { recursive: true });
    const path = join(f, safe);
    await writeFile(path, Buffer.from(bytes));
    const mine = (await readdir(f)).filter((n) => /^Litma backup .*\.zip$/.test(n)).sort().reverse();
    for (const old of mine.slice(KEEP)) await unlink(join(f, old)).catch(() => {});
    return path;
  });
}
