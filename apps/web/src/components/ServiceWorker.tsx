"use client";
import { useEffect } from "react";
import { BASE } from "@/lib/config";

/**
 * Registers the website's offline service worker (out/sw.js, written by scripts/write-sw.mjs),
 * so getlitma.in opens and works without a connection after one visit.
 * Not in the desktop app (it serves its own bundled copy) or in `next dev`.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DESKTOP === "1") return;
    if (!("serviceWorker" in navigator) || location.protocol === "app:") return;
    const register = () => navigator.serviceWorker.register(`${BASE}/sw.js`, { scope: `${BASE}/` }).catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
