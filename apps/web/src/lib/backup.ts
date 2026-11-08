"use client";
/**
 * Backups of everything a writer has in Litma: one zip with
 *   litma-backup.json   every work (full text), its Story World, books and saved words, restorable
 *   works/*.docx        each work as a Word file, readable anywhere
 *   README.txt          what the files are
 * Made on the device (no server work, nothing to pay for). Saved as a download, to Google Drive
 * (lib/drive.ts, the website), or into a folder the writer picks (the desktop app does it daily).
 * The phone app writes the same format (lib/data/backup.dart).
 */
import { bookmarks, store } from "./store";
import { docxBlob, safe } from "./export";
import { zip, unzip } from "./zip";
import { APP_VERSION } from "./version";
import type { Book, LitmaDoc, WordBookmark } from "./types";
import type { StoryItem } from "./story";
import { markBackedUp } from "./backup-state";

export { BACKUP_EVENT, backupName } from "./backup-state";

export const BACKUP_FORMAT = "litma-backup";

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: 1;
  made: string;
  app: string;
  works: (LitmaDoc & { story?: StoryItem[] })[];
  books: Book[];
  savedWords: WordBookmark[];
}


/** Build the backup zip. `onProgress(done, total)` while the works are read. */
export async function buildBackup(onProgress?: (done: number, total: number) => void): Promise<{ blob: Blob; works: number }> {
  const listed = [...(await store.listDocs()), ...(await store.listDocs({ trash: true }).catch(() => []))];
  const works: BackupFile["works"] = [];
  const files: { name: string; data: string | Blob }[] = [];
  const used = new Set<string>();
  let n = 0;
  for (const d of listed) {
    onProgress?.(n++, listed.length);
    const full = await store.getDoc(d.id).catch(() => null);
    if (!full || full.settings?.pristine) continue;
    const story = await store.listStory(d.id).catch(() => []);
    works.push({ ...full, story });
    let name = safe(full.title || "Untitled");
    for (let i = 2; used.has(name); i++) name = `${safe(full.title || "Untitled")} (${i})`;
    used.add(name);
    try {
      files.push({ name: `works/${name}.docx`, data: await docxBlob(full) });
    } catch {
      /* the JSON copy still has it */
    }
  }
  onProgress?.(listed.length, listed.length);
  const data: BackupFile = {
    format: BACKUP_FORMAT,
    version: 1,
    made: new Date().toISOString(),
    app: APP_VERSION,
    works,
    books: await store.listBooks().catch(() => []),
    savedWords: await bookmarks.list().catch(() => []),
  };
  const readme = [
    "Litma backup",
    "",
    `Made ${new Date().toLocaleString("en-IN")} with ${works.length} works.`,
    "",
    "works/ has each work as a Word file you can open anywhere.",
    "litma-backup.json has everything (full text, Story World, books, saved words).",
    "To bring works back into Litma: Settings, Backup, Restore from a backup file.",
    "",
  ].join("\n");
  const blob = await zip([{ name: "README.txt", data: readme }, { name: "litma-backup.json", data: JSON.stringify(data) }, ...files]);
  markBackedUp();
  return { blob, works: works.length };
}

/** Read a backup zip (or its litma-backup.json alone). */
export async function readBackup(file: Blob): Promise<BackupFile> {
  let text: string;
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  if (head[0] === 0x50 && head[1] === 0x4b) {
    const files = await unzip(file);
    const json = files.get("litma-backup.json");
    if (!json) throw new Error("not-backup");
    text = new TextDecoder().decode(json);
  } else text = await file.text();
  const data = JSON.parse(text) as BackupFile;
  if (data?.format !== BACKUP_FORMAT || !Array.isArray(data.works)) throw new Error("not-backup");
  return data;
}

/**
 * Bring works back from a backup. A work that is still in Litma (same id) is left alone; the others
 * come back as new works with their Story World. Nothing already here is changed or deleted.
 */
export async function restoreBackup(data: BackupFile, onProgress?: (done: number, total: number) => void): Promise<{ restored: number; skipped: number }> {
  const here = new Set([...(await store.listDocs()), ...(await store.listDocs({ trash: true }).catch(() => []))].map((d) => d.id));
  let restored = 0;
  let skipped = 0;
  let i = 0;
  for (const w of data.works) {
    onProgress?.(i++, data.works.length);
    if (here.has(w.id)) {
      skipped++;
      continue;
    }
    const doc = await store.createDoc(w.kind, w.title);
    const settings = { ...doc.settings, ...w.settings, pristine: false };
    await store.updateDoc(doc.id, { content: w.content, word_count: w.word_count, settings, title: w.title });
    for (const s of w.story ?? []) {
      const { id: _id, created_at: _c, updated_at: _u, ...rest } = s as StoryItem & { created_at?: string; updated_at?: string };
      void _id;
      void _c;
      void _u;
      await store.saveStory({ ...rest, document_id: doc.id }).catch(() => {});
    }
    restored++;
  }
  onProgress?.(data.works.length, data.works.length);
  return { restored, skipped };
}

