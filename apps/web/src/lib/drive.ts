"use client";
/**
 * Google Drive backup for the website. Uses Google's own sign-in popup (Google Identity Services)
 * with the drive.file permission: Litma sees only the files it makes (a "Litma backup" folder),
 * never the rest of the writer's Drive. The access token stays in this tab's memory, nothing is
 * stored on Litma's server. Needs NEXT_PUBLIC_GOOGLE_CLIENT_ID (a free Google Cloud OAuth client);
 * without it the Drive button is hidden. The desktop app backs up into a folder instead, and the
 * phone app signs in to Drive with the phone's own Google account.
 */
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const FOLDER = "Litma backup";
/** backups kept in Drive; older ones are deleted */
export const KEEP_BACKUPS = 14;

interface TokenClient {
  requestAccessToken: (o?: { prompt?: string }) => void;
}
interface GoogleOAuth {
  accounts: { oauth2: { initTokenClient: (o: { client_id: string; scope: string; callback: (r: { access_token?: string; expires_in?: number; error?: string }) => void; error_callback?: (e: { type: string }) => void }) => TokenClient } };
}
declare global {
  interface Window {
    google?: GoogleOAuth;
  }
}

export const driveAvailable = () => !!GOOGLE_CLIENT_ID && typeof window !== "undefined" && !window.litmaDesktop;

let script: Promise<void> | null = null;
function loadGis(): Promise<void> {
  script ??= new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      script = null;
      reject(new Error("offline"));
    };
    document.head.appendChild(s);
  });
  return script;
}

let token: { value: string; until: number } | null = null;

/** Load Google's sign-in early, so the popup opens straight from the click (browsers block late popups). */
export function prepareDrive() {
  if (driveAvailable()) loadGis().catch(() => {});
}

/** An access token, asking Google (a popup) when there's none yet. Call from a click. */
export function driveToken(): Promise<string> {
  if (token && token.until > Date.now() + 60_000) return Promise.resolve(token.value);
  return new Promise((resolve, reject) => {
    const go = () => {
      const client = window.google!.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPE,
        callback: (r) => {
          if (!r.access_token) return reject(new Error(r.error || "denied"));
          token = { value: r.access_token, until: Date.now() + (r.expires_in ?? 3600) * 1000 };
          resolve(r.access_token);
        },
        error_callback: (e) => reject(new Error(e.type || "closed")),
      });
      client.requestAccessToken({ prompt: token ? "" : undefined });
    };
    if (window.google?.accounts?.oauth2) go();
    else loadGis().then(go, reject);
  });
}

async function api<T>(t: string, url: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${t}`, ...(init.headers ?? {}) } });
  if (r.status === 401) token = null;
  if (!r.ok) throw new Error(`drive-${r.status}`);
  return (r.status === 204 ? null : await r.json()) as T;
}

async function folderId(t: string): Promise<string> {
  const q = encodeURIComponent(`name='${FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const found = await api<{ files: { id: string }[] }>(t, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&spaces=drive`);
  if (found.files[0]) return found.files[0].id;
  const made = await api<{ id: string }>(t, "https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: FOLDER, mimeType: "application/vnd.google-apps.folder" }),
  });
  return made.id;
}

/** Upload a backup to the "Litma backup" folder and keep the newest KEEP_BACKUPS there. */
export async function uploadToDrive(name: string, blob: Blob): Promise<void> {
  const t = await driveToken();
  const parent = await folderId(t);
  const meta = { name, parents: [parent], mimeType: "application/zip" };
  const body = new FormData();
  body.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
  body.append("file", blob);
  await api(t, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", { method: "POST", body });
  const q = encodeURIComponent(`'${parent}' in parents and trashed=false`);
  const list = await api<{ files: { id: string }[] }>(t, `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime desc&fields=files(id)&pageSize=100`);
  for (const f of list.files.slice(KEEP_BACKUPS)) await api(t, `https://www.googleapis.com/drive/v3/files/${f.id}`, { method: "DELETE" }).catch(() => {});
}
