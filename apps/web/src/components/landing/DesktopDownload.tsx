"use client";
import { useEffect, useState } from "react";
import { Apple, Download, Monitor } from "lucide-react";
import { BASE } from "@/lib/config";
import { useT } from "@/i18n/react";

type Release = { version: string; date?: string; mac?: string; win?: string };

declare global {
  interface Window {
    litmaDesktop?: { platform: string; version: string };
  }
}

/** Home page: download the desktop app. Reads downloads/latest.json, written by the desktop release workflow. */
export function DesktopDownload() {
  const t = useT();
  const [release, setRelease] = useState<Release | null | undefined>(undefined);
  const [os, setOs] = useState<"mac" | "win" | "other">("other");
  const [inApp, setInApp] = useState(false);

  useEffect(() => {
    setInApp(!!window.litmaDesktop);
    const ua = navigator.userAgent;
    setOs(/Mac/i.test(ua) && !/iPhone|iPad/i.test(ua) ? "mac" : /Windows/i.test(ua) ? "win" : "other");
    fetch(`${BASE}/downloads/latest.json`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Release | null) => setRelease(j))
      .catch(() => setRelease(null));
  }, []);

  if (inApp) return null;
  const href = (file?: string, fallback?: string) => `${BASE}/downloads/${file ?? fallback}`;
  const ready = !!release;
  const items = [
    { id: "mac" as const, icon: Apple, label: t("download.mac"), hint: t("download.macHint"), href: href(release?.mac, "Litma-mac.dmg") },
    { id: "win" as const, icon: Monitor, label: t("download.windows"), hint: t("download.windowsHint"), href: href(release?.win, "Litma-win.exe") },
  ].sort((a, b) => (a.id === os ? -1 : b.id === os ? 1 : 0));

  return (
    <section id="download" className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-14 md:grid-cols-[1.1fr_1fr]">
        <div>
          <h2 className="text-2xl font-bold">{t("download.title")}</h2>
          <p className="mt-2 max-w-lg leading-relaxed text-muted">{t("download.body")}</p>
          {release?.version && (
            <p className="mt-3 text-xs text-muted">
              v{release.version}
              {release.date ? ` · ${new Date(release.date).toLocaleDateString("en-IN", { dateStyle: "medium" })}` : ""}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row md:justify-end">
          {items.map((it, i) =>
            ready ? (
              <a
                key={it.id}
                href={it.href}
                download
                className={`btn justify-start !rounded-xl !px-4 !py-3 ${i === 0 && os !== "other" ? "btn-primary" : "btn-outline"}`}
              >
                <it.icon size={20} aria-hidden />
                <span className="text-left">
                  <span className="block">{it.label}</span>
                  <span className="block text-xs font-normal opacity-75">{it.hint}</span>
                </span>
                <Download size={16} className="ml-auto opacity-70" aria-hidden />
              </a>
            ) : (
              <span key={it.id} className="btn btn-outline justify-start !rounded-xl !px-4 !py-3" aria-disabled="true" title={t("download.soon")}>
                <it.icon size={20} aria-hidden />
                <span className="text-left">
                  <span className="block">{it.label}</span>
                  <span className="block text-xs font-normal text-muted">{release === undefined ? t("common.loading") : t("download.soon")}</span>
                </span>
              </span>
            )
          )}
        </div>
      </div>
    </section>
  );
}
