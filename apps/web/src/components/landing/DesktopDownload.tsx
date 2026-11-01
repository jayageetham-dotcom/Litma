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
export function DesktopDownload({ variant = "section" }: { variant?: "section" | "card" | "band" | "pop" }) {
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

  if (variant === "pop")
    // home page close: the violet card from the colourful landing, with the visitor's system first
    return (
      <section id="download" className="px-4 py-24 md:py-32">
        <div className="relative isolate mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-violet px-6 py-14 text-night-ink sm:px-10 md:px-16 md:py-20">
          <div aria-hidden className="absolute -bottom-24 -right-20 size-96 rounded-full bg-lime/40 blur-3xl" />
          <div aria-hidden className="absolute -left-20 -top-24 size-80 rounded-full bg-sky/40 blur-3xl" />
          <div aria-hidden className="dot-grid absolute inset-0 text-night-ink/10" />
          <span aria-hidden className="pointer-events-none absolute -bottom-16 -right-6 select-none text-[16rem] font-extrabold leading-none text-night-ink/10 md:text-[22rem]" style={{ fontFamily: "var(--font-display)" }}>
            അ
          </span>

          <div className="relative grid items-center gap-12 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <p className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em]">
                <span className="size-2 rounded-full bg-lime" aria-hidden />
                {t("download.kicker")}
              </p>
              <h2 className="text-5xl font-extrabold leading-[1.05] md:text-7xl" style={{ fontFamily: "var(--font-display)" }}>
                {t("download.title")}.
              </h2>
              <p className="mt-6 max-w-lg text-lg text-night-ink/85">{t("download.body")}</p>
              {release?.version && <p className="mt-3 font-mono text-sm text-night-ink/75">v{release.version}</p>}
            </div>

            <div className="space-y-3">
              {items.map((it) => {
                const inner = (
                  <>
                    <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-night text-night-ink">
                      <it.icon size={22} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-extrabold">{it.label}</span>
                      <span className="block text-sm text-muted group-hover:text-on-pop/70">{it.href ? it.hint : release === undefined ? t("common.loading") : t("download.soon")}</span>
                    </span>
                  </>
                );
                const card = "group flex items-center gap-4 rounded-2xl bg-surface p-4 text-ink shadow-xl transition";
                return it.href ? (
                  <a key={it.id} href={it.href} className={`${card} hover:-translate-y-0.5 hover:bg-lime hover:text-on-pop`}>
                    {inner}
                    <Download size={20} className="mr-1 shrink-0 transition group-hover:translate-y-0.5" aria-hidden />
                  </a>
                ) : (
                  <span key={it.id} className={card} aria-disabled="true">
                    {inner}
                    <span className="rounded-full bg-subtle px-2.5 py-1 text-[11px] font-bold text-muted">{t("download.soonBadge")}</span>
                  </span>
                );
              })}
              <Link href="/download/" className="inline-block pt-2 text-sm font-semibold text-night-ink/90 underline decoration-lime decoration-2 underline-offset-4 hover:text-lime">
                {t("download.deskMore")}: iPhone, Android
              </Link>
            </div>
          </div>
        </div>
      </section>
    );

  if (variant === "band")
    // home page close: a solid ink band (inverts in dark mode) with the app icon
    return (
      <section id="download" className="bg-primary text-primary-ink">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 md:grid-cols-[1fr_auto] md:gap-12">
          <div className="max-w-xl">
            <h2 className="text-3xl font-bold md:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
              {t("download.title")}
            </h2>
            <p className="mt-3 text-lg leading-relaxed opacity-80">{t("download.body")}</p>
            {release?.version && <p className="mt-3 text-sm opacity-70">v{release.version}</p>}
          </div>
          <div className="flex flex-col gap-3">
            {items.map((it, i) =>
              it.href ? (
                <a
                  key={it.id}
                  href={it.href}
                  className={`btn justify-start !rounded-xl !px-5 !py-3.5 ${i === 0 ? "bg-primary-ink text-primary hover:opacity-90" : "border border-primary-ink/30 text-primary-ink hover:bg-primary-ink/10"}`}
                >
                  <it.icon size={20} aria-hidden />
                  <span className="text-left">
                    <span className="block">{it.label}</span>
                    <span className="block text-xs font-normal opacity-75">{it.hint}</span>
                  </span>
                </a>
              ) : (
                <span key={it.id} className="btn justify-start border border-primary-ink/30 !rounded-xl !px-5 !py-3.5 opacity-70" aria-disabled="true">
                  <it.icon size={20} aria-hidden />
                  <span className="text-left">
                    <span className="block">{it.label}</span>
                    <span className="block text-xs font-normal">{release === undefined ? t("common.loading") : t("download.soon")}</span>
                  </span>
                </span>
              )
            )}
            <Link href="/download/" className="mt-1 text-sm font-medium underline-offset-4 opacity-80 hover:underline hover:opacity-100">
              {t("download.deskMore")}: iPhone, Android
            </Link>
          </div>
        </div>
      </section>
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
