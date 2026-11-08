"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CloudUpload, Download, FolderOpen, RotateCcw, Target } from "lucide-react";
import { useT } from "@/i18n/react";
import { Notice } from "@/components/AuthShell";
import { BACKUP_EVENT, autoBackup, backupName, lastBackup, setAutoBackup, type AutoBackup } from "@/lib/backup-state";

/** the backup code (and the Word export it uses) loads only when a backup runs */
const backupLib = () => import("@/lib/backup");
import { driveAvailable, prepareDrive, uploadToDrive } from "@/lib/drive";

/** Settings → Goals: a link to the goals page. */
export function GoalsCard() {
  const t = useT();
  return (
    <section>
      <h2 className="text-xl font-semibold">{t("goals.title")}</h2>
      <p className="mt-1 text-sm text-muted">{t("goals.settingsIntro")}</p>
      <Link href="/goals/" className="btn btn-outline mt-4">
        <Target size={16} /> {t("goals.open")}
      </Link>
    </section>
  );
}

/** Settings → Backup: download everything, save it to Google Drive or a folder, daily backups, restore. */
export function BackupSettings() {
  const t = useT();
  const desktop = typeof window !== "undefined" ? window.litmaDesktop : undefined;
  const folderApp = !!desktop?.writeBackup;
  const drive = driveAvailable();
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [msg, setMsg] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [last, setLast] = useState(0);
  const [auto, setAuto] = useState<AutoBackup>("off");
  const [folder, setFolder] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const read = () => {
      setLast(lastBackup());
      setAuto(autoBackup());
    };
    read();
    prepareDrive();
    desktop?.backupFolder?.().then(setFolder).catch(() => {});
    window.addEventListener(BACKUP_EVENT, read);
    return () => window.removeEventListener(BACKUP_EVENT, read);
  }, [desktop]);

  const run = async (kind: "download" | "drive" | "folder") => {
    setMsg(null);
    setBusy(kind);
    try {
      const lib = await backupLib();
      const { blob, works } = await lib.buildBackup((d, n) => setProgress([d, n]));
      const name = backupName();
      if (kind === "download") (await import("@/lib/export")).download(name, blob);
      else if (kind === "drive") await uploadToDrive(name, blob);
      else await desktop!.writeBackup!(name, await blob.arrayBuffer());
      setMsg({ kind: "info", text: t(`backup.done.${kind}`, { count: works }) });
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      setMsg({ kind: "error", text: /denied|closed|popup/.test(m) ? t("backup.error.google") : /offline|fetch|drive-/.test(m) ? t("backup.error.offline") : t("backup.error.any") });
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const restore = async (f: File | undefined) => {
    if (!f) return;
    setMsg(null);
    setBusy("restore");
    try {
      const lib = await backupLib();
      const data = await lib.readBackup(f);
      const r = await lib.restoreBackup(data, (d, n) => setProgress([d, n]));
      setMsg({ kind: "info", text: t("backup.restored", { count: r.restored, skipped: r.skipped }) });
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error && e.message === "not-backup" ? t("backup.error.notBackup") : t("backup.error.any") });
    } finally {
      setBusy(null);
      setProgress(null);
      if (file.current) file.current.value = "";
    }
  };

  const choose = async () => {
    const f = await desktop?.chooseBackupFolder?.();
    setFolder(f ?? null);
    if (f && auto === "off") setAutoBackup("folder");
  };

  return (
    <section>
      <h2 className="text-xl font-semibold">{t("backup.title")}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">{t("backup.intro")}</p>
      <div className="mt-5 space-y-4 rounded-xl bg-paper p-5" style={{ boxShadow: "var(--sheet-shadow)" }}>
        <p className="text-sm text-muted">{last ? t("backup.last", { when: new Date(last).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) }) : t("backup.never")}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => run("download")}>
            <Download size={16} /> {t("backup.download")}
          </button>
          {drive && (
            <button type="button" className="btn btn-outline" disabled={!!busy} onClick={() => run("drive")}>
              <CloudUpload size={16} /> {t("backup.drive")}
            </button>
          )}
          {folderApp && folder && (
            <button type="button" className="btn btn-outline" disabled={!!busy} onClick={() => run("folder")}>
              <CloudUpload size={16} /> {t("backup.folderNow")}
            </button>
          )}
        </div>
        {progress && <p className="text-xs text-muted">{t("backup.progress", { n: progress[0], total: progress[1] })}</p>}
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}

        {folderApp && (
          <div className="border-t border-line pt-4 text-sm">
            <p className="font-medium">{t("backup.folder")}</p>
            <p className="mt-1 text-xs text-muted">{t("backup.folderHint")}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-outline !py-1.5" onClick={choose}>
                <FolderOpen size={15} /> {folder ? t("backup.folderChange") : t("backup.folderChoose")}
              </button>
              {folder && (
                <button type="button" className="truncate text-xs text-accent hover:underline" onClick={() => desktop?.openBackupFolder?.()} data-private>
                  {folder}
                </button>
              )}
            </div>
          </div>
        )}

        {(drive || (folderApp && folder)) && (
          <label className="flex items-start gap-2 border-t border-line pt-4 text-sm">
            <input type="checkbox" className="mt-0.5 accent-[var(--accent)]" checked={auto !== "off"} onChange={(e) => setAutoBackup(e.target.checked ? (folderApp ? "folder" : "drive") : "off")} />
            <span>
              {t("backup.daily")}
              <span className="block text-xs text-muted">{t(folderApp ? "backup.dailyFolder" : "backup.dailyDrive")}</span>
            </span>
          </label>
        )}

        <div className="border-t border-line pt-4 text-sm">
          <p className="font-medium">{t("backup.restore")}</p>
          <p className="mt-1 text-xs text-muted">{t("backup.restoreHint")}</p>
          <input ref={file} type="file" accept=".zip,.json,application/zip,application/json" className="hidden" onChange={(e) => restore(e.target.files?.[0])} />
          <button type="button" className="btn btn-outline mt-2 !py-1.5" disabled={!!busy} onClick={() => file.current?.click()}>
            <RotateCcw size={15} /> {t("backup.restoreButton")}
          </button>
        </div>
      </div>
    </section>
  );
}
