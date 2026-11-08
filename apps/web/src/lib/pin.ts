"use client";
/**
 * The pinned work: one work the writer keeps at the top of the desk, so the work in progress is
 * always the first thing they see. Saved in the profile (preferences.pinnedWork), so it follows the
 * writer to every device and the phone app; a single id means only one work can be pinned. Local
 * mode keeps it on this device. A pinned work that is trashed or deleted is simply not shown.
 */
import { useEffect, useState } from "react";
import { store } from "./store";

export const PIN_EVENT = "litma:pinned";
const LS_PIN = "litma:pinned";

export async function getPinned(): Promise<string | null> {
  if (!store.isCloud()) {
    try {
      return localStorage.getItem(LS_PIN);
    } catch {
      return null;
    }
  }
  const p = await store.getProfile().catch(() => null);
  const id = p?.preferences?.pinnedWork;
  return typeof id === "string" && id ? id : null;
}

/** Pin a work (replacing the one pinned before), or unpin with null. */
export async function setPinned(id: string | null): Promise<void> {
  if (!store.isCloud()) {
    try {
      if (id) localStorage.setItem(LS_PIN, id);
      else localStorage.removeItem(LS_PIN);
    } catch {
      /* storage blocked */
    }
  } else {
    const p = await store.getProfile();
    if (p) await store.updateProfile({ preferences: { ...(p.preferences ?? {}), pinnedWork: id } });
  }
  window.dispatchEvent(new CustomEvent(PIN_EVENT, { detail: id }));
}

/** The pinned work's id, kept in step with every change on this device. */
export function usePinned(): [string | null, (id: string | null) => Promise<void>] {
  const [pinned, set] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    getPinned().then((id) => live && set(id));
    const on = (e: Event) => set((e as CustomEvent<string | null>).detail ?? null);
    window.addEventListener(PIN_EVENT, on);
    return () => {
      live = false;
      window.removeEventListener(PIN_EVENT, on);
    };
  }, []);
  return [
    pinned,
    async (id) => {
      set(id); // show it at once; saved (or queued offline) in the background
      await setPinned(id);
    },
  ];
}
