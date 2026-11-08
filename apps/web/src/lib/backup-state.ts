"use client";
/** Backup settings and the last backup time on this device (light: no export code). */
export const BACKUP_EVENT = "litma:backup";

const pad = (n: number) => String(n).padStart(2, "0");
export const backupName = (d = new Date()) => `Litma backup ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.zip`;

// ── when the last backup was made (this device) ──

const LS_LAST = "litma:backup-last";
const LS_AUTO = "litma:backup-auto";

export function lastBackup(): number {
  try {
    return Number(localStorage.getItem(LS_LAST)) || 0;
  } catch {
    return 0;
  }
}
export function markBackedUp() {
  try {
    localStorage.setItem(LS_LAST, String(Date.now()));
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new Event(BACKUP_EVENT));
}

/** Daily backup on this device: "drive" (website, reminds with one click), "folder" (desktop app, automatic), or off. */
export type AutoBackup = "off" | "drive" | "folder";
export function autoBackup(): AutoBackup {
  try {
    const v = localStorage.getItem(LS_AUTO);
    return v === "drive" || v === "folder" ? v : "off";
  } catch {
    return "off";
  }
}
export function setAutoBackup(v: AutoBackup) {
  try {
    localStorage.setItem(LS_AUTO, v);
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new Event(BACKUP_EVENT));
}
export const backupDue = () => autoBackup() !== "off" && Date.now() - lastBackup() > 22 * 3600_000;
