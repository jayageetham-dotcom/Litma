"use client";
import { useEffect, useState } from "react";
import { BASE } from "@/lib/config";
import "@/lib/desktop";

/** Public repository whose GitHub Releases hold the installers (see apps/desktop/README.md → Publishing). */
export const RELEASES_REPO = "jayageetham-dotcom/litma-releases";
export const RELEASES_PAGE = `https://github.com/${RELEASES_REPO}/releases`;
/** Placeholder store links until the mobile app ships (the download page shows them as "Coming soon"). */
export const STORE_LINKS = { ios: null as string | null, android: null as string | null };

type FileInfo = { file: string; url?: string; sha256?: string; size?: number };
export type Release = {
  version: string;
  date?: string;
  notes?: string[];
  mac?: string;
  win?: string;
  desktop?: { version: string; mac?: FileInfo; win?: FileInfo };
  mobile?: { version: string | null; ios: string | null; android: string | null };
};

/** Full download URL for a manifest entry (old manifests used bare file names next to latest.json). */
const toUrl = (f?: string | FileInfo) => {
  if (!f) return null;
  const v = typeof f === "string" ? f : f.url ?? f.file;
  return /^https?:/.test(v) ? v : `${BASE}/downloads/${v}`;
};

/**
 * Download links for a release. While it loads (undefined) there are none; if no release
 * could be read at all (null) both buttons open the latest release on GitHub instead of
 * dead-ending, and `viaGithub` tells the page not to claim a download has started.
 */
export function downloadsFor(r: Release | null | undefined) {
  if (r === undefined) return { mac: null, win: null, macSize: null, winSize: null, viaGithub: false };
  if (r === null) return { mac: `${RELEASES_PAGE}/latest`, win: `${RELEASES_PAGE}/latest`, macSize: null, winSize: null, viaGithub: true };
  return {
    viaGithub: false,
    mac: toUrl(r.desktop?.mac ?? r.mac),
    win: toUrl(r.desktop?.win ?? r.win),
    macSize: r.desktop?.mac?.size ?? null,
    winSize: r.desktop?.win?.size ?? null,
  };
}

/** Builds a Release from GitHub's API (the browser can read it; github.com download links have no CORS headers). */
async function fromGithubApi(): Promise<Release | null> {
  const r = await fetch(`https://api.github.com/repos/${RELEASES_REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" } });
  if (!r.ok) return null;
  const j = (await r.json()) as { tag_name: string; published_at?: string; body?: string; assets?: { name: string; browser_download_url: string; size?: number }[] };
  const asset = (re: RegExp): FileInfo | undefined => {
    const a = j.assets?.find((x) => re.test(x.name));
    return a ? { file: a.name, url: a.browser_download_url, size: a.size } : undefined;
  };
  const version = j.tag_name.replace(/^v/, "");
  const mac = asset(/mac\.dmg$/i);
  const win = asset(/win\.exe$/i);
  if (!mac && !win) return null;
  const notes = (j.body ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[-*] /.test(l))
    .map((l) => l.slice(2).trim());
  return { version, date: j.published_at, notes, desktop: { version, mac, win } };
}

/**
 * latest.json from the website, then GitHub's API for the releases repository.
 * undefined while loading, null if neither could be read (buttons then open the releases page).
 */
export function useRelease() {
  const [release, setRelease] = useState<Release | null | undefined>(undefined);
  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const r = await fetch(`${BASE}/downloads/latest.json`, { cache: "no-store" });
        if (r.ok) {
          const j = (await r.json()) as Release;
          if (downloadsFor(j).mac || downloadsFor(j).win) {
            if (!off) setRelease(j);
            return;
          }
        }
      } catch {
        /* not on this server (local preview) or unreadable: ask GitHub */
      }
      let fallback: Release | null = null;
      try {
        fallback = await fromGithubApi();
      } catch {
        /* offline or rate-limited */
      }
      if (!off) setRelease(fallback);
    })();
    return () => {
      off = true;
    };
  }, []);
  return release;
}

export type Platform = "mac" | "win" | "ios" | "android" | "linux" | "other";

/** The visitor's operating system (iPadOS reports itself as a Mac, so touch points tell them apart). */
export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const ua = navigator.userAgent;
  const p = (nav.userAgentData?.platform || navigator.platform || "").toLowerCase();
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua) || (/mac/.test(p) && navigator.maxTouchPoints > 1)) return "ios";
  if (/mac/.test(p) || /Macintosh/.test(ua)) return "mac";
  if (/win/.test(p) || /Windows/.test(ua)) return "win";
  if (/linux|cros/.test(p) || /Linux|CrOS/.test(ua)) return "linux";
  return "other";
}

export function usePlatform() {
  const [p, setP] = useState<Platform | null>(null);
  useEffect(() => setP(detectPlatform()), []);
  return p;
}

/** true inside the desktop app (download prompts are hidden there) */
export function useInDesktopApp() {
  const [inApp, setInApp] = useState(false);
  useEffect(() => setInApp(!!window.litmaDesktop), []);
  return inApp;
}

export const formatSize = (bytes: number | null) => (bytes ? `${Math.round(bytes / 1024 / 1024)} MB` : "");
