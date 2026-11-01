"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Apple, ArrowRight, Check, Download, Globe, Monitor, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HomeNav } from "@/components/HomeActions";
import { MobileNav } from "@/components/MobileNav";
import { StoreBadges } from "@/components/StoreBadges";
import { Skeleton } from "@/components/ui/Skeleton";
import { RELEASES_PAGE, downloadsFor, formatSize, useInDesktopApp, usePlatform, useRelease, type Platform } from "@/lib/release";
import { useT } from "@/i18n/react";

/**
 * /download: finds the visitor's operating system and offers the right Litma first
 * (Mac, Windows, or the app stores on phones), with every other platform below and
 * install steps that appear as soon as a download starts.
 */
export default function DownloadPage() {
  const t = useT();
  const platform = usePlatform();
  const release = useRelease();
  const inApp = useInDesktopApp();
  const links = downloadsFor(release);
  const [started, setStarted] = useState<"mac" | "win" | null>(null);
  const [helpFor, setHelpFor] = useState<"mac" | "win">("mac");
  const helpRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (platform === "win") setHelpFor("win");
  }, [platform]);

  const start = (p: "mac" | "win") => {
    setStarted(p);
    setHelpFor(p);
    setTimeout(() => helpRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
  };
  const date = release?.date ? new Date(release.date).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "";
  const desktopOs = platform === "mac" || platform === "win" ? platform : null;
  const name: Record<Platform, string> = {
    mac: "Mac",
    win: "Windows",
    ios: "iPhone & iPad",
    android: "Android",
    linux: "Linux",
    other: t("download.yourDevice"),
  };

  return (
    <div className="min-h-dvh">
      <header className="app-bar">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-5 py-2.5">
          <Logo />
          <nav className="flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <HomeNav />
          </nav>
        </div>
      </header>

      <main>
        {/* ── Hero: the right download for this device ── */}
        <section className="mx-auto max-w-6xl px-5 pb-14 pt-12 text-center md:pt-20">
          <p className="text-sm font-semibold text-highlight">{t("download.kicker")}</p>
          <h1 className="mx-auto mt-3 max-w-3xl text-[2.6rem] font-extrabold leading-[1.1] tracking-tight md:text-6xl">
            {platform ? t("download.heroTitle", { platform: name[platform] }) : t("download.heroTitleAny")}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted">{t("download.heroBody")}</p>

          <div className="mt-9 flex min-h-[72px] flex-col items-center gap-3">
            {inApp ? (
              <p className="flex items-center gap-2 rounded-full bg-accent-soft px-4 py-2 text-sm font-medium text-accent">
                <Check size={16} aria-hidden /> {t("download.inApp")}
              </p>
            ) : platform === null || release === undefined ? (
              <Skeleton className="h-14 w-72 rounded-xl" />
            ) : desktopOs ? (
              links[desktopOs] ? (
                <>
                  <a href={links[desktopOs]!} onClick={() => start(desktopOs)} className="btn btn-primary !rounded-xl !px-7 !py-4 !text-lg">
                    <Download size={22} aria-hidden /> {t(desktopOs === "mac" ? "download.mac" : "download.windows")}
                  </a>
                  <p className="text-sm text-muted">
                    {t("download.versionLine", { version: release?.version ?? "", date })}
                    {formatSize(desktopOs === "mac" ? links.macSize : links.winSize) && ` · ${formatSize(desktopOs === "mac" ? links.macSize : links.winSize)}`}
                    {" · "}
                    {desktopOs === "mac" ? t("download.macHint") : t("download.windowsHint")}
                  </p>
                </>
              ) : (
                <p className="text-muted">{t("download.soon")}</p>
              )
            ) : platform === "ios" || platform === "android" ? (
              <>
                <StoreBadges only={platform} />
                <p className="text-sm text-muted">{t("download.mobileSoon")}</p>
                <Link href="/desk/" className="btn btn-outline mt-1">
                  <Globe size={16} aria-hidden /> {t("download.useWeb")}
                </Link>
              </>
            ) : (
              <>
                <p className="max-w-md text-muted">{t("download.linuxSoon")}</p>
                <Link href="/desk/" className="btn btn-primary !rounded-xl !px-6 !py-3.5">
                  <Globe size={18} aria-hidden /> {t("download.useWeb")}
                </Link>
              </>
            )}
            {started && (
              <p className="pop-in mt-2 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-sm font-medium text-accent" role="status">
                <Check size={16} aria-hidden /> {t("download.started")}
                <a
                  href="#install"
                  onClick={(e) => {
                    e.preventDefault();
                    helpRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="inline-flex items-center gap-1 underline underline-offset-4 hover:no-underline"
                >
                  {t("download.startedLink")} <ArrowRight size={14} className="rotate-90" aria-hidden />
                </a>
              </p>
            )}
          </div>
        </section>

        {/* ── Every platform ── */}
        <section className="border-y border-line bg-surface py-14">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="text-2xl font-bold">{t("download.allTitle")}</h2>
            <p className="mt-1 text-muted">{t("download.allBody")}</p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <PlatformCard
                icon={Apple}
                title="Mac"
                detail={t("download.macReq")}
                current={platform === "mac"}
                loading={release === undefined}
                action={links.mac ? <a href={links.mac} onClick={() => start("mac")} className="btn btn-primary w-full justify-center"><Download size={16} aria-hidden /> {t("download.dmg")}</a> : null}
                youLabel={t("download.yourDevice")}
                soon={t("download.soon")}
              />
              <PlatformCard
                icon={Monitor}
                title="Windows"
                detail={t("download.winReq")}
                current={platform === "win"}
                loading={release === undefined}
                action={links.win ? <a href={links.win} onClick={() => start("win")} className="btn btn-primary w-full justify-center"><Download size={16} aria-hidden /> {t("download.exe")}</a> : null}
                youLabel={t("download.yourDevice")}
                soon={t("download.soon")}
              />
              <PlatformCard
                icon={Smartphone}
                title="iPhone & iPad"
                detail={t("download.iosReq")}
                current={platform === "ios"}
                action={<StoreBadges only="ios" className="[&>*]:w-full" />}
                youLabel={t("download.yourDevice")}
                soon={t("download.soon")}
              />
              <PlatformCard
                icon={Smartphone}
                title="Android"
                detail={t("download.androidReq")}
                current={platform === "android"}
                action={<StoreBadges only="android" className="[&>*]:w-full" />}
                youLabel={t("download.yourDevice")}
                soon={t("download.soon")}
              />
            </ul>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-paper px-5 py-4">
              <div className="flex items-center gap-3">
                <Globe size={20} className="text-accent" aria-hidden />
                <div>
                  <div className="font-semibold">{t("download.webTitle")}</div>
                  <div className="text-sm text-muted">{t("download.webBody")}</div>
                </div>
              </div>
              <Link href="/desk/" className="btn btn-outline">
                {t("download.useWeb")} <ArrowRight size={16} aria-hidden />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Install steps (follows the download) ── */}
        <section ref={helpRef} id="install" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-14">
          <div className="grid gap-10 md:grid-cols-[1.2fr_1fr]">
            <div>
              <h2 className="text-2xl font-bold">{t("download.installTitle")}</h2>
              <div className="mt-4 inline-flex rounded-lg bg-subtle p-0.5 text-sm" role="tablist">
                {(["mac", "win"] as const).map((p) => (
                  <button key={p} role="tab" aria-selected={helpFor === p} onClick={() => setHelpFor(p)} className={`rounded-md px-3.5 py-1.5 ${helpFor === p ? "bg-paper font-semibold text-accent shadow-sm" : "text-muted hover:text-ink"}`}>
                    {p === "mac" ? "Mac" : "Windows"}
                  </button>
                ))}
              </div>
              <ol className="mt-6 space-y-4">
                {(helpFor === "mac" ? ["mac1", "mac2", "mac3"] : ["win1", "win2", "win3"]).map((k, i) => (
                  <li key={k} className="fade-in flex gap-4" style={{ animationDelay: `${i * 60}ms` }}>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent">{i + 1}</span>
                    <p className="pt-1 leading-relaxed">{t(`download.steps.${k}` as "download.steps.mac1")}</p>
                  </li>
                ))}
              </ol>
              <p className="mt-6 flex items-start gap-2 rounded-xl bg-highlight-soft px-4 py-3 text-sm leading-relaxed">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-highlight" aria-hidden />
                {t("download.unsignedNote")}
              </p>
            </div>
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-bold">
                <RefreshCw size={20} className="text-accent" aria-hidden /> {t("download.newTitle")}
              </h2>
              <p className="mt-1 text-sm text-muted">{t("download.autoUpdate")}</p>
              {release?.notes && release.notes.length > 0 ? (
                <ul className="mt-5 space-y-2.5">
                  {release.notes.slice(0, 8).map((n) => (
                    <li key={n} className="flex gap-2.5 text-[15px] leading-snug">
                      <Check size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden /> {n}
                    </li>
                  ))}
                </ul>
              ) : release === undefined ? (
                <div className="mt-5 space-y-3">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : null}
              <a href={RELEASES_PAGE} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-accent underline underline-offset-2">
                {t("download.allReleases")} ↗
              </a>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-line py-8 text-center text-sm text-muted">Litma · മലയാളം എഴുത്തുമേശ</footer>
      <MobileNav />
    </div>
  );
}

function PlatformCard({
  icon: Icon,
  title,
  detail,
  current,
  action,
  loading,
  youLabel,
  soon,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  detail: string;
  current: boolean;
  action: React.ReactNode;
  loading?: boolean;
  youLabel: string;
  soon: string;
}) {
  return (
    <li className={`relative flex flex-col rounded-2xl border bg-paper p-5 transition-shadow ${current ? "border-accent shadow-[var(--pop-shadow)]" : "border-line"}`}>
      {current && <span className="absolute right-4 top-4 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-ink">{youLabel}</span>}
      <Icon size={28} className="text-ink" aria-hidden />
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-1 flex-1 text-sm leading-relaxed text-muted">{detail}</p>
      <div className="mt-5">{loading ? <Skeleton className="h-10 w-full rounded-lg" /> : action ?? <span className="text-sm text-muted">{soon}</span>}</div>
    </li>
  );
}
