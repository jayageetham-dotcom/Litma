"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, RefreshCw, Sparkles, X } from "lucide-react";
import { BASE } from "@/lib/config";
import { BUILD_ID } from "@/lib/version";
import { desktop, type DesktopUpdateState } from "@/lib/desktop";
import { useT } from "@/i18n/react";

const POLL_MS = 15 * 60 * 1000;

/**
 * Keeps every copy of Litma current.
 *  - Website: polls version.json (written at build time); when a newer build is live, offers a reload.
 *    Writing is journalled on the device, so reloading never loses text.
 *  - Desktop app: shows the update the app found (apps/desktop/src/updater.ts) with "Update and restart".
 */
/** Public pages (home, sign in, download…) are for visitors; the reload offer only matters inside the app. */
const PUBLIC = ["/", "/login/", "/signup/", "/forgot-password/", "/reset-password/", "/auth/callback/", "/download/"];

export function UpdateNotice() {
  const [desk, setDesk] = useState(false);
  const path = usePathname();
  useEffect(() => setDesk(!!desktop()?.onUpdate), []);
  if (desk) return <DesktopUpdate />;
  const p = path.endsWith("/") ? path : `${path}/`;
  return PUBLIC.includes(p) ? null : <WebUpdate />;
}

function Card({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div className="pop-in no-print fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-4 right-4 z-[65] mx-auto max-w-sm rounded-2xl border border-line bg-surface p-4 shadow-[var(--pop-shadow)] md:bottom-6 md:left-auto md:right-6 md:mx-0" role="status" aria-live="polite">
      {onClose && (
        <button type="button" onClick={onClose} className="absolute right-2.5 top-2.5 rounded-md p-1 text-muted hover:bg-subtle hover:text-ink" aria-label="Close">
          <X size={15} />
        </button>
      )}
      {children}
    </div>
  );
}

function WebUpdate() {
  const t = useT();
  const [next, setNext] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const check = useCallback(async () => {
    if (BUILD_ID === "dev" || process.env.NODE_ENV !== "production") return;
    try {
      const r = await fetch(`${BASE}/version.json`, { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { version: string; build: string };
      if (j.build && j.build !== BUILD_ID) setNext(j.version);
    } catch {
      /* offline */
    }
  }, []);
  useEffect(() => {
    const first = setTimeout(check, 20_000);
    const every = setInterval(check, POLL_MS);
    const vis = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearTimeout(first);
      clearInterval(every);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [check]);
  if (!next || hidden) return null;
  return (
    <Card onClose={() => setHidden(true)}>
      <div className="flex items-start gap-3 pr-5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <Sparkles size={17} aria-hidden />
        </span>
        <div>
          <p className="font-semibold">{t("update.webTitle", { version: next })}</p>
          <p className="mt-0.5 text-sm text-muted">{t("update.webBody")}</p>
          <button type="button" className="btn btn-primary mt-3 !py-1.5 !text-sm" onClick={() => window.location.reload()}>
            <RefreshCw size={14} aria-hidden /> {t("update.reload")}
          </button>
        </div>
      </div>
    </Card>
  );
}

function DesktopUpdate() {
  const t = useT();
  const [s, setS] = useState<DesktopUpdateState | null>(null);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const d = desktop();
    d?.updateState?.().then(setS);
    return d?.onUpdate?.((x) => {
      setS(x);
      if (x.status === "available") setHidden(false);
    });
  }, []);
  if (!s || hidden || !["available", "downloading", "ready", "error"].includes(s.status)) return null;
  if (s.status === "error") return null; // background check failures stay quiet; the menu check reports them
  const required = "required" in s && s.required;
  return (
    <Card onClose={required ? undefined : () => setHidden(true)}>
      <div className="flex items-start gap-3 pr-5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <Download size={17} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{t("update.desktopTitle", { version: "version" in s ? s.version : "" })}</p>
          <p className="mt-0.5 text-sm text-muted">{required ? t("update.required") : t("update.desktopBody", { current: s.current })}</p>
          {"notes" in s && s.notes.length > 0 && (
            <ul className="mt-2 max-h-28 list-disc space-y-0.5 overflow-y-auto pl-4 text-[13px] text-muted">
              {s.notes.slice(0, 5).map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          {s.status === "downloading" ? (
            <div className="mt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuenow={Math.round(s.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${Math.max(4, s.progress * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted">{t("update.downloading", { n: Math.round(s.progress * 100) })}</p>
            </div>
          ) : s.status === "ready" ? (
            <button type="button" className="btn btn-primary mt-3 !py-1.5 !text-sm" onClick={() => desktop()?.installUpdate?.()}>
              <RefreshCw size={14} aria-hidden /> {t("update.restart")}
            </button>
          ) : (
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn btn-primary !py-1.5 !text-sm" onClick={() => desktop()?.downloadUpdate?.()}>
                <Download size={14} aria-hidden /> {t("update.updateNow")}
              </button>
              {!required && (
                <button type="button" className="btn btn-ghost !py-1.5 !text-sm" onClick={() => setHidden(true)}>
                  {t("update.later")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/** Settings → About: the version, and on the desktop a "Check for updates" button. */
export function AboutLitma() {
  const t = useT();
  const [d, setD] = useState<ReturnType<typeof desktop>>(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => setD(desktop()), []);
  return (
    <section>
      <h2 className="text-xl font-semibold">{t("update.about")}</h2>
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-paper p-4" style={{ boxShadow: "var(--sheet-shadow)" }}>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">
            Litma {process.env.NEXT_PUBLIC_APP_VERSION}
            {d ? ` · ${t("update.desktopApp")}` : ""}
          </div>
          <div className="text-xs text-muted">{d ? t("update.desktopAuto") : t("update.webAuto")}</div>
        </div>
        {d?.checkForUpdates && (
          <button
            type="button"
            className="btn btn-outline !py-1.5 !text-sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await d.checkForUpdates?.().finally(() => setBusy(false));
            }}
          >
            {busy ? <span className="ink-spinner" aria-hidden /> : <RefreshCw size={14} aria-hidden />} {t("update.check")}
          </button>
        )}
      </div>
    </section>
  );
}
