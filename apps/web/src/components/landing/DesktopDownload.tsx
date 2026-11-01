"use client";
import Link from "next/link";
import { Apple, ArrowRight, Download, Monitor } from "lucide-react";
import { downloadsFor, useInDesktopApp, usePlatform, useRelease } from "@/lib/release";
import { StoreBadges } from "@/components/StoreBadges";
import { useT } from "@/i18n/react";

/**
 * "Litma for your computer": the home page section (variant "section") and a slim card on the
 * desk for signed-in writers (variant "card"). The visitor's own system comes first; /download has
 * everything else. Hidden inside the desktop app.
 */
export function DesktopDownload({ variant = "section" }: { variant?: "section" | "card" }) {
  const t = useT();
  const release = useRelease();
  const platform = usePlatform();
  const inApp = useInDesktopApp();
  if (inApp) return null;
  const links = downloadsFor(release);
  const items = [
    { id: "mac" as const, icon: Apple, label: t("download.mac"), hint: t("download.macHint"), href: links.mac },
    { id: "win" as const, icon: Monitor, label: t("download.windows"), hint: t("download.windowsHint"), href: links.win },
  ].sort((a, b) => (a.id === platform ? -1 : b.id === platform ? 1 : 0));

  const buttons = (
    <div className={`flex flex-col gap-3 sm:flex-row ${variant === "section" ? "md:justify-end" : ""}`}>
      {items.map((it, i) =>
        it.href ? (
          <a
            key={it.id}
            href={it.href}
            className={`btn justify-start !rounded-xl !px-4 !py-3 ${i === 0 && (platform === "mac" || platform === "win") ? "btn-primary" : "btn-outline"}`}
          >
            <it.icon size={20} aria-hidden />
            <span className="text-left">
              <span className="block">{it.label}</span>
              <span className="block text-xs font-normal opacity-75">{it.hint}</span>
            </span>
            <Download size={16} className="ml-auto opacity-70" aria-hidden />
          </a>
        ) : (
          <span key={it.id} className="btn btn-outline justify-start !rounded-xl !px-4 !py-3" aria-disabled="true">
            <it.icon size={20} aria-hidden />
            <span className="text-left">
              <span className="block">{it.label}</span>
              <span className="block text-xs font-normal text-muted">{release === undefined ? t("common.loading") : t("download.soon")}</span>
            </span>
          </span>
        )
      )}
    </div>
  );

  if (variant === "card")
    return (
      <section className="mt-12 flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-line bg-surface p-5 sm:p-6" aria-label={t("download.deskTitle")}>
        <div className="min-w-0 max-w-md">
          <h2 className="text-lg font-semibold">{t("download.deskTitle")}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">{t("download.deskBody")}</p>
          <Link href="/download/" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
            {t("download.deskMore")} <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
        {buttons}
      </section>
    );

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
          <StoreBadges className="mt-5" />
        </div>
        <div className="flex flex-col gap-3">
          {buttons}
          <Link href="/download/" className="text-sm font-medium text-accent hover:underline md:text-right">
            {t("download.deskMore")} →
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Small "Download" link for top bars (hidden inside the desktop app). */
export function DownloadNavLink({ className = "" }: { className?: string }) {
  const t = useT();
  const inApp = useInDesktopApp();
  if (inApp) return null;
  return (
    <Link href="/download/" className={`btn btn-ghost !px-2.5 text-sm ${className}`} title={t("download.navTitle")}>
      <Download size={17} aria-hidden /> <span className="hidden md:inline">{t("download.nav")}</span>
    </Link>
  );
}
