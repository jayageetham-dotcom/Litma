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

/**
 * The chosen folder. In the Mac App Store copy the app is sandboxed: a folder the writer picked can be
 * used again later only through the security-scoped bookmark macOS gave for it, so that is kept too.
 */
type Saved = { folder: string | null; bookmark?: string };

function saved(): Saved {
  try {
    if (existsSync(file())) {
      const j = JSON.parse(readFileSync(file(), "utf8"));
      return { folder: j.folder ?? null, bookmark: typeof j.bookmark === "string" ? j.bookmark : undefined };
    }
  } catch {
    /* unreadable: no folder */
  }
  return { folder: null };
}
const folder = () => saved().folder;

function setFolder(f: string | null, bookmark?: string) {
  try {
    writeFileSync(file(), JSON.stringify(f ? { folder: f, bookmark } : { folder: null }));
  } catch {
    /* read-only profile */
  }
}

/** Run [fn] with the folder, opened for the sandbox in the Mac App Store copy. */
async function withFolder<T>(fn: (f: string) => Promise<T> | T): Promise<T> {
  const s = saved();
  if (!s.folder) throw new Error("no-folder");
  const stop = process.mas && s.bookmark ? app.startAccessingSecurityScopedResource(s.bookmark) : null;
  try {
    return await fn(s.folder);
  } finally {
    if (typeof stop === "function") stop();
  }
}

export function registerBackup() {
  ipcMain.handle("litma:backup:folder", () => folder());
  ipcMain.handle("litma:backup:choose", async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined;
    const opts = { properties: ["openDirectory", "createDirectory"] as ("openDirectory" | "createDirectory")[], defaultPath: folder() ?? app.getPath("documents"), securityScopedBookmarks: !!process.mas };
    const r = await (win ? dialog.showOpenDialog(win, opts) : dialog.showOpenDialog(opts));
    if (r.canceled || !r.filePaths[0]) return folder();
    setFolder(r.filePaths[0], r.bookmarks?.[0]);
    return r.filePaths[0];
  });
  ipcMain.handle("litma:backup:forget", () => setFolder(null));
  ipcMain.handle("litma:backup:open", () => {
    if (folder()) return withFolder((f) => shell.openPath(f)).catch(() => {});
  });
  ipcMain.handle("litma:backup:write", (_e, name: string, bytes: ArrayBuffer) =>
    withFolder(async (f) => {
      const safe = String(name).replace(/[\\/:*?"<>|]+/g, " ").trim() || "Litma backup.zip";
      await mkdir(f, { recursive: true });
      const path = join(f, safe);
      await writeFile(path, Buffer.from(bytes));
      const mine = (await readdir(f)).filter((n) => /^Litma backup .*\.zip$/.test(n)).sort().reverse();
      for (const old of mine.slice(KEEP)) await unlink(join(f, old)).catch(() => {});
      return path;
    }),
  );
}
