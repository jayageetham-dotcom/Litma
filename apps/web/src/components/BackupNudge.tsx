"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CloudUpload, X } from "lucide-react";
import { useT } from "@/i18n/react";
import { autoBackup, backupDue, backupName } from "@/lib/backup-state";

const buildBackup = async () => (await import("@/lib/backup")).buildBackup();
import { prepareDrive, uploadToDrive } from "@/lib/drive";

const APP_PAGES = ["/desk/", "/write/", "/book/", "/dictionary/", "/profile/", "/goals/", "/settings/"];

/**
 * The daily backup. The desktop app writes it into the chosen folder by itself, a minute after
 * opening. On the website a browser won't open Google's sign-in without a click, so a small card
 * offers "Back up now" once a day instead.
 */
export function BackupNudge() {
  const t = useT();
  const path = usePathname();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const inApp = APP_PAGES.includes(path);

  useEffect(() => {
    if (!inApp) return;
    const timer = setTimeout(async () => {
      if (!backupDue()) return;
      const mode = autoBackup();
      const d = window.litmaDesktop;
      if (mode === "folder" && d?.writeBackup) {
        try {
          if (!(await d.backupFolder?.())) return;
          const { blob } = await buildBackup();
          await d.writeBackup(backupName(), await blob.arrayBuffer());
        } catch {
          /* tried again next start */
        }
      } else if (mode === "drive") {
        prepareDrive();
        setShow(true);
      }
    }, 60_000);
    return () => clearTimeout(timer);
  }, [inApp]);

  if (!show || !inApp) return null;
  const now = async () => {
    setBusy(true);
    setErr(false);
    try {
      const { blob } = await buildBackup();
      await uploadToDrive(backupName(), blob);
      setShow(false);
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div role="status" className="no-print pop-in dialog fixed bottom-20 right-4 z-[55] max-w-xs rounded-2xl p-4 shadow-lg">
      <button type="button" onClick={() => setShow(false)} className="absolute right-2 top-2 rounded-full p-1.5 text-muted hover:bg-subtle hover:text-ink" aria-label={t("common.close")}>
        <X size={15} />
      </button>
      <p className="flex items-center gap-2 pr-6 font-semibold">
        <CloudUpload size={17} className="text-tint-sky" aria-hidden /> {t("backup.nudgeTitle")}
      </p>
      <p className="mt-1 text-sm text-muted">{err ? t("backup.error.any") : t("backup.nudgeBody")}</p>
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn btn-primary !py-1.5 text-sm" disabled={busy} onClick={now}>
          {busy ? t("backup.working") : t("backup.nudgeNow")}
        </button>
        <button type="button" className="btn btn-ghost !py-1.5 text-sm" onClick={() => setShow(false)}>
          {t("goals.reminder.later")}
        </button>
      </div>
    </div>
  );
}
