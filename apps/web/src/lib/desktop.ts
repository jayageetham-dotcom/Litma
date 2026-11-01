/** The bridge the desktop app's preload script exposes (apps/desktop/src/preload.ts). */
export type DesktopUpdateState =
  | { status: "idle" | "checking" | "none"; current: string }
  | { status: "available" | "ready"; current: string; version: string; notes: string[]; required: boolean }
  | { status: "downloading"; current: string; version: string; notes: string[]; required: boolean; progress: number }
  | { status: "error"; current: string; message: string };

export interface LitmaDesktop {
  platform: string;
  version: string;
  checkForUpdates?: () => Promise<DesktopUpdateState>;
  updateState?: () => Promise<DesktopUpdateState>;
  downloadUpdate?: () => Promise<DesktopUpdateState>;
  installUpdate?: () => Promise<boolean>;
  onUpdate?: (cb: (s: DesktopUpdateState) => void) => () => void;
}

declare global {
  interface Window {
    litmaDesktop?: LitmaDesktop;
  }
}

export const desktop = (): LitmaDesktop | undefined => (typeof window === "undefined" ? undefined : window.litmaDesktop);
