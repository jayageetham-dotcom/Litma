/**
 * Litma desktop updates.
 *
 * Every release publishes downloads/latest.json on the website (see .github/workflows/desktop.yml).
 * The app checks it shortly after launch and every few hours. When a newer version exists it tells
 * the window (an in-app card offers "Update and restart"), downloads the installer for this platform,
 * checks its SHA-256 and installs it:
 *   - Windows: runs the NSIS installer silently (/S) and reopens Litma (--force-run)
 *   - macOS:   mounts the .dmg, replaces Litma.app in place and reopens it
 * This needs no code-signing certificate. If the app can't replace itself (run from the disk image or
 * the Downloads folder), it opens the new .dmg so the writer can drag Litma to Applications.
 * A release can set desktop.minimumVersion; older apps then show the update as required.
 */
import { app, BrowserWindow, dialog, net, shell } from "electron";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// LITMA_UPDATE_FEED / LITMA_UPDATE_PLATFORM exist for testing the updater against a local server
const FEED = process.env.LITMA_UPDATE_FEED || "https://www.jayageetham.com/litma/downloads";
const PLATFORM = process.env.LITMA_UPDATE_PLATFORM || process.platform;
const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;

type FileInfo = { file: string; sha256: string; size: number };
type Latest = { version: string; notes?: string[]; desktop?: { version: string; minimumVersion?: string | null; mac?: FileInfo; win?: FileInfo } };

export type UpdateState =
  | { status: "idle" | "checking" | "none"; current: string }
  | { status: "available"; current: string; version: string; notes: string[]; required: boolean }
  | { status: "downloading"; current: string; version: string; notes: string[]; required: boolean; progress: number }
  | { status: "ready"; current: string; version: string; notes: string[]; required: boolean }
  | { status: "error"; current: string; message: string };

const SEMVER = /^(\d+)\.(\d+)\.(\d+)/;
export function newer(a: string, b: string) {
  const x = a.match(SEMVER)?.slice(1).map(Number);
  const y = b.match(SEMVER)?.slice(1).map(Number);
  if (!x || !y) return false;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}

let state: UpdateState = { status: "idle", current: app.getVersion() };
let latest: Latest | null = null;
let downloaded: string | null = null;

function broadcast(next: UpdateState) {
  state = next;
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send("litma:update", state);
}
export const currentState = () => state;

function platformFile(): FileInfo | undefined {
  if (PLATFORM === "darwin") return latest?.desktop?.mac;
  if (PLATFORM === "win32") return latest?.desktop?.win;
  return undefined;
}

export async function checkForUpdates(manual = false) {
  if (state.status === "downloading" || state.status === "ready") return state;
  broadcast({ status: "checking", current: app.getVersion() });
  try {
    const res = await net.fetch(`${FEED}/latest.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`The update server answered ${res.status}`);
    latest = (await res.json()) as Latest;
    const v = latest.desktop?.version ?? latest.version;
    const current = app.getVersion();
    if (v && newer(v, current) && platformFile()) {
      const min = latest.desktop?.minimumVersion;
      broadcast({ status: "available", current, version: v, notes: latest.notes ?? [], required: !!min && newer(min, current) });
    } else {
      broadcast({ status: "none", current });
      if (manual) dialog.showMessageBox({ type: "info", message: "Litma is up to date", detail: `You have the latest version (${current}).`, buttons: ["OK"] });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    broadcast({ status: "error", current: app.getVersion(), message });
    if (manual) dialog.showMessageBox({ type: "warning", message: "Couldn't check for updates", detail: `${message}\n\nCheck your connection and try again.`, buttons: ["OK"] });
  }
  return state;
}

export async function downloadUpdate() {
  const f = platformFile();
  if (!f || (state.status !== "available" && state.status !== "error")) return state;
  const base = state.status === "available" ? state : null;
  const info = { current: app.getVersion(), version: latest!.desktop?.version ?? latest!.version, notes: latest!.notes ?? [], required: base?.required ?? false };
  try {
    const dir = join(tmpdir(), "litma-update");
    mkdirSync(dir, { recursive: true });
    const target = join(dir, f.file);
    broadcast({ status: "downloading", ...info, progress: 0 });
    const res = await net.fetch(`${FEED}/${encodeURIComponent(f.file)}`, { cache: "no-store" });
    if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);
    const total = Number(res.headers.get("content-length")) || f.size || 0;
    const hash = createHash("sha256");
    const out = createWriteStream(target);
    const reader = res.body.getReader();
    let got = 0;
    let lastSent = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      hash.update(value);
      out.write(Buffer.from(value));
      got += value.length;
      const p = total ? got / total : 0;
      if (p - lastSent > 0.02) {
        lastSent = p;
        broadcast({ status: "downloading", ...info, progress: p });
      }
    }
    await new Promise<void>((r, j) => out.end((err?: Error | null) => (err ? j(err) : r())));
    if (f.sha256 && hash.digest("hex") !== f.sha256) throw new Error("The downloaded file didn't match its checksum. Try again.");
    downloaded = target;
    broadcast({ status: "ready", ...info });
  } catch (e) {
    broadcast({ status: "error", current: app.getVersion(), message: e instanceof Error ? e.message : String(e) });
  }
  return state;
}

/** Path of the running Litma.app on macOS, or null when it can't be replaced in place. */
function macAppBundle(): string | null {
  const bundle = app.getPath("exe").replace(/\/Contents\/MacOS\/[^/]+$/, "");
  if (!bundle.endsWith(".app")) return null;
  // Gatekeeper runs unsigned apps from Downloads in a read-only copy; a mounted .dmg is read-only too
  if (bundle.includes("/AppTranslocation/") || bundle.startsWith("/Volumes/")) return null;
  return bundle;
}

export function installUpdate() {
  if (!downloaded || !existsSync(downloaded)) return false;
  if (process.platform === "win32") {
    spawn(downloaded, ["/S", "--force-run"], { detached: true, stdio: "ignore" }).unref();
    setTimeout(() => app.quit(), 300);
    return true;
  }
  if (process.platform === "darwin") {
    const bundle = macAppBundle();
    if (!bundle) {
      shell.openPath(downloaded);
      dialog.showMessageBox({
        type: "info",
        message: "Drag Litma to Applications",
        detail: "The new version is open in Finder. Drag Litma into the Applications folder and replace the old one. Next time Litma can update itself.",
        buttons: ["OK"],
      });
      return false;
    }
    const script = join(tmpdir(), "litma-update", "install.sh");
    writeFileSync(
      script,
      `#!/bin/bash
# waits for Litma to quit, swaps in the new app from the disk image, opens it again
PID=${process.pid}
DMG="$1"; APP="$2"
while kill -0 $PID 2>/dev/null; do sleep 0.3; done
MNT=$(mktemp -d /tmp/litma-dmg.XXXX)
hdiutil attach -nobrowse -noautoopen -quiet -mountpoint "$MNT" "$DMG" || { open "$DMG"; exit 1; }
NEW=$(ls -d "$MNT"/*.app | head -n 1)
if [ -z "$NEW" ]; then hdiutil detach "$MNT" -quiet; open "$APP"; exit 1; fi
rm -rf "$APP.old"
if mv "$APP" "$APP.old"; then
  if ditto "$NEW" "$APP"; then
    rm -rf "$APP.old"
    xattr -dr com.apple.quarantine "$APP" 2>/dev/null
  else
    rm -rf "$APP"; mv "$APP.old" "$APP"
  fi
  hdiutil detach "$MNT" -quiet
  open "$APP"
else
  # no permission to replace the app: show the new one so it can be dragged to Applications
  hdiutil detach "$MNT" -quiet
  open "$DMG"
fi
`,
      { mode: 0o755 }
    );
    spawn("/bin/bash", [script, downloaded, bundle], { detached: true, stdio: "ignore" }).unref();
    setTimeout(() => app.quit(), 300);
    return true;
  }
  shell.openPath(downloaded);
  return false;
}

/** Background checks: soon after launch, then every few hours. Only in packaged builds. */
export function startUpdateChecks() {
  if (!app.isPackaged && !process.env.LITMA_UPDATE_FEED) return;
  setTimeout(() => checkForUpdates(false), 8000);
  setInterval(() => checkForUpdates(false), CHECK_EVERY_MS);
}
