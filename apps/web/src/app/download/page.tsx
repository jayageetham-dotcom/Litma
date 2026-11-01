"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Apple, ArrowRight, Check, Download, Globe, Monitor, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { ColourField, LandingFooter, LandingNav } from "@/components/landing/LandingChrome";
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
    <div className="landing min-h-dvh overflow-x-clip bg-mist">
      <LandingNav />

      <main>
        {/* ── Hero: the right download for this device ── */}
        <section className="relative overflow-hidden pb-24 pt-32 text-center md:pt-44">
          <ColourField />
          <div className="relative mx-auto max-w-6xl px-5">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 py-1.5 pl-1.5 pr-4 text-xs font-bold uppercase tracking-[0.16em] text-muted backdrop-blur">
            <span className="grid size-6 place-items-center rounded-full bg-lime text-on-pop">
              <Download size={13} aria-hidden />
            </span>
            {t("download.kicker")}
          </p>
          <h1 className="mx-auto mt-6 max-w-4xl text-[2.8rem] font-extrabold leading-[1.05] tracking-tight md:text-7xl" style={{ fontFamily: "var(--font-display)" }}>
            {platform ? t("download.heroTitle", { platform: name[platform] }) : t("download.heroTitleAny")}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted md:text-xl">{t("download.heroBody")}</p>

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
                  <a href={links[desktopOs]!} onClick={() => start(desktopOs)} className="btn btn-primary !px-8 !py-4 !text-lg">
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
                <Link href="/desk/" className="btn btn-primary !px-7 !py-3.5">
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
          </div>
        </section>

        {/* ── Every platform ── */}
        <section className="bg-surface py-24 md:py-28">
          <div className="mx-auto max-w-7xl px-5 md:px-10">
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-violet-text">{t("download.allTitle")}</p>
            <h2 className="text-4xl font-extrabold leading-[1.15] md:text-5xl" style={{ fontFamily: "var(--font-display)" }}>
              എല്ലായിടത്തും. <span className="text-ink/40">{t("download.allBody")}</span>
            </h2>
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <PlatformCard
                icon={Apple}
                title="Mac"
                fill="bg-violet text-night-ink"
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
                fill="bg-sky text-on-pop"
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
                fill="bg-coral text-on-pop"
                detail={t("download.iosReq")}
                current={platform === "ios"}
                action={<StoreBadges only="ios" className="[&>*]:w-full" />}
                youLabel={t("download.yourDevice")}
                soon={t("download.soon")}
              />
              <PlatformCard
                icon={Smartphone}
                title="Android"
                fill="bg-lime text-on-pop"
                detail={t("download.androidReq")}
                current={platform === "android"}
                action={<StoreBadges only="android" className="[&>*]:w-full" />}
                youLabel={t("download.yourDevice")}
                soon={t("download.soon")}
              />
            </ul>
            <div className="on-night relative mt-5 flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-[2rem] bg-night px-6 py-6 sm:px-8">
              <div aria-hidden className="dot-grid absolute inset-0 text-night-ink/[0.06]" />
              <div className="relative flex items-center gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime text-on-pop">
                  <Globe size={22} aria-hidden />
                </span>
                <div>
                  <div className="text-lg font-extrabold">{t("download.webTitle")}</div>
                  <div className="text-sm text-muted">{t("download.webBody")}</div>
                </div>
              </div>
              <Link href="/desk/" className="btn relative bg-night-ink !px-5 !py-3 text-on-pop hover:bg-lime">
                {t("download.useWeb")} <ArrowRight size={16} aria-hidden />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Install steps (follows the download) ── */}
        <section ref={helpRef} id="install" className="mx-auto max-w-7xl scroll-mt-28 px-5 py-24 md:px-10 md:py-28">
          <div className="grid gap-14 md:grid-cols-[1.2fr_1fr]">
            <div>
              <h2 className="text-3xl font-extrabold md:text-4xl" style={{ fontFamily: "var(--font-display)" }}>{t("download.installTitle")}</h2>
              <div className="mt-5 inline-flex rounded-full border border-line bg-surface p-1 text-sm" role="tablist">
                {(["mac", "win"] as const).map((p) => (
                  <button key={p} role="tab" aria-selected={helpFor === p} onClick={() => setHelpFor(p)} className={`rounded-full px-4 py-1.5 font-semibold ${helpFor === p ? "bg-night text-night-ink" : "text-muted hover:text-ink"}`}>
                    {p === "mac" ? "Mac" : "Windows"}
                  </button>
                ))}
              </div>
              <ol className="mt-6 space-y-4">
                {(helpFor === "mac" ? ["mac1", "mac2", "mac3"] : ["win1", "win2", "win3"]).map((k, i) => (
                  <li key={k} className="fade-in flex gap-4" style={{ animationDelay: `${i * 60}ms` }}>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lime text-sm font-extrabold text-on-pop">{i + 1}</span>
                    <p className="pt-1 leading-relaxed">{t(`download.steps.${k}` as "download.steps.mac1")}</p>
                  </li>
                ))}
              </ol>
              <p className="mt-8 flex items-start gap-3 rounded-2xl bg-tangerine/15 px-5 py-4 text-sm leading-relaxed">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-highlight" aria-hidden />
                {t("download.unsignedNote")}
              </p>
            </div>
            <div>
              <h2 className="flex items-center gap-3 text-3xl font-extrabold md:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
                <span className="grid size-10 place-items-center rounded-2xl bg-violet text-night-ink"><RefreshCw size={18} aria-hidden /></span> {t("download.newTitle")}
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
      <LandingFooter />
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
  fill,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  detail: string;
  current: boolean;
  action: React.ReactNode;
  loading?: boolean;
  youLabel: string;
  soon: string;
  /** background and text colour classes from the home palette */
  fill: string;
}) {
  return (
    <li className={`relative flex flex-col overflow-hidden rounded-[2rem] p-6 transition duration-300 hover:-translate-y-1 ${fill} ${current ? "shadow-[var(--pop-lift-shadow)] ring-4 ring-night" : ""}`}>
      <div aria-hidden className="dot-grid absolute inset-0 opacity-10" />
      {current && <span className="absolute right-5 top-5 rounded-full bg-night px-2.5 py-1 text-[11px] font-bold text-night-ink">{youLabel}</span>}
      <span className="relative grid size-12 place-items-center rounded-2xl bg-night text-night-ink">
        <Icon size={24} aria-hidden />
      </span>
      <h3 className="relative mt-6 text-2xl font-extrabold">{title}</h3>
      <p className="relative mt-1.5 flex-1 text-sm leading-relaxed opacity-80">{detail}</p>
      <div className="relative mt-6">{loading ? <Skeleton className="h-11 w-full rounded-full" /> : action ?? <span className="text-sm font-semibold opacity-80">{soon}</span>}</div>
    </li>
  );
}
