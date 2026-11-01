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

export function downloadsFor(r: Release | null | undefined) {
  if (!r) return { mac: null, win: null, macSize: null, winSize: null };
  return {
    mac: toUrl(r.desktop?.mac ?? r.mac),
    win: toUrl(r.desktop?.win ?? r.win),
    macSize: r.desktop?.mac?.size ?? null,
    winSize: r.desktop?.win?.size ?? null,
  };
}

/** latest.json from the website, with the releases repository as a fallback. undefined while loading, null if none. */
export function useRelease() {
  const [release, setRelease] = useState<Release | null | undefined>(undefined);
  useEffect(() => {
    let off = false;
    (async () => {
      for (const url of [`${BASE}/downloads/latest.json`, `https://github.com/${RELEASES_REPO}/releases/latest/download/latest.json`]) {
        try {
          const r = await fetch(url, { cache: "no-store" });
          if (r.ok) {
            const j = (await r.json()) as Release;
            if (!off) setRelease(j);
            return;
          }
        } catch {
          /* try the next one */
        }
      }
      if (!off) setRelease(null);
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
