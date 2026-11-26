/** The bridge the desktop app's preload script exposes (apps/desktop/src/preload.ts). */
export type DesktopUpdateState =
  | { status: "idle" | "checking" | "none"; current: string }
  | { status: "available" | "ready"; current: string; version: string; notes: string[]; required: boolean }
  | { status: "downloading"; current: string; version: string; notes: string[]; required: boolean; progress: number }
  | { status: "error"; current: string; message: string };

export interface LitmaDesktop {
  platform: string;
  version: string;
  /** set when an app store updates this copy (Mac App Store, Microsoft Store, Snap Store): no update card then */
  store?: "mas" | "msstore" | "snap" | null;
  checkForUpdates?: () => Promise<DesktopUpdateState>;
  updateState?: () => Promise<DesktopUpdateState>;
  downloadUpdate?: () => Promise<DesktopUpdateState>;
  installUpdate?: () => Promise<boolean>;
  onUpdate?: (cb: (s: DesktopUpdateState) => void) => () => void;
  /** newer desktop builds: daily reminder kept by the main process, so it rings with the window closed */
  setReminder?: (s: { on: boolean; time: string; days: number[]; day: string; done: boolean; title: string; body: string }) => Promise<void>;
  reminderRang?: (day: string) => Promise<void>;
  /** a system notification (writing timer) */
  notify?: (title: string, body: string) => Promise<void>;
  /** newer desktop builds: paste (or paste without formatting) into the focused editor */
  edit?: (role: "paste" | "pasteAndMatchStyle") => Promise<void>;
  /** daily backups into a folder the writer picks (apps/desktop/src/backup.ts) */
  backupFolder?: () => Promise<string | null>;
  chooseBackupFolder?: () => Promise<string | null>;
  forgetBackupFolder?: () => Promise<void>;
  openBackupFolder?: () => Promise<void>;
  writeBackup?: (name: string, bytes: ArrayBuffer) => Promise<string>;
}

declare global {
  interface Window {
    litmaDesktop?: LitmaDesktop;
  }
}

export const desktop = (): LitmaDesktop | undefined => (typeof window === "undefined" ? undefined : window.litmaDesktop);
