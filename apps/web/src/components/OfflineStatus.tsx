"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CloudOff, RefreshCw, Check } from "lucide-react";
import { useT } from "@/i18n/react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { SYNC_EVENT, pendingCount, startSync, type SyncState } from "@/lib/offline";

/** Public pages (home, sign in, download…) don't use the writer's data. */
const PUBLIC = ["/", "/login/", "/signup/", "/forgot-password/", "/reset-password/", "/auth/callback/", "/download/"];

/**
 * Starts the offline outbox (lib/offline.ts) and shows a small pill while the app is offline,
 * while waiting changes are being sent, and briefly once everything has synced.
 */
export function OfflineStatus() {
  const t = useT();
  const path = usePathname();
  const [online, setOnline] = useState(true);
  const [reachable, setReachable] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [done, setDone] = useState(false);
  const hadPending = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return; // local mode: everything already lives on this device
    startSync();
    const net = () => setOnline(navigator.onLine);
    net();
    pendingCount().then(setPending).catch(() => {});
    let hide: ReturnType<typeof setTimeout> | undefined;
    const onSync = (e: Event) => {
      const s = (e as CustomEvent<SyncState>).detail;
      setPending(s.pending);
      setSyncing(s.syncing);
      setReachable(!s.offline);
      if (s.pending > 0) hadPending.current = true;
      else if (hadPending.current && !s.offline) {
        hadPending.current = false;
        setDone(true);
        clearTimeout(hide);
        hide = setTimeout(() => setDone(false), 3000);
      }
    };
    window.addEventListener("online", net);
    window.addEventListener("offline", net);
    window.addEventListener(SYNC_EVENT, onSync);
    return () => {
      clearTimeout(hide);
      window.removeEventListener("online", net);
      window.removeEventListener("offline", net);
      window.removeEventListener(SYNC_EVENT, onSync);
    };
  }, []);

  const p = path.endsWith("/") ? path : `${path}/`;
  if (PUBLIC.includes(p) || !isSupabaseConfigured) return null;

  let icon: React.ReactNode;
  let text: string;
  if (!online || !reachable) {
    icon = <CloudOff size={14} className="shrink-0 text-highlight" />;
    text = pending > 0 ? `${t("offline.offline")} ${t("offline.pending", { count: pending })}` : t("offline.offline");
  } else if (pending > 0 && syncing) {
    icon = <RefreshCw size={14} className="shrink-0 animate-spin text-accent" />;
    text = t("offline.syncing");
  } else if (done) {
    icon = <Check size={14} className="shrink-0 text-accent" />;
    text = t("offline.synced");
  } else return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pop-in no-print pointer-events-none fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 z-[64] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] text-ink shadow-[var(--pop-shadow)] md:bottom-12 md:left-4 md:translate-x-0"
    >
      {icon}
      <span className="truncate">{text}</span>
    </div>
  );
}
