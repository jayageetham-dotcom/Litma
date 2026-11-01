"use client";
import { Apple, Play } from "lucide-react";
import { STORE_LINKS } from "@/lib/release";
import { useT } from "@/i18n/react";

/** App Store / Google Play buttons. Until the mobile app ships they are shown as "Coming soon". */
export function StoreBadges({ only, className = "" }: { only?: "ios" | "android"; className?: string }) {
  const t = useT();
  const items = [
    { id: "ios" as const, icon: Apple, small: t("download.appStoreSmall"), big: "App Store", href: STORE_LINKS.ios },
    { id: "android" as const, icon: Play, small: t("download.playSmall"), big: "Google Play", href: STORE_LINKS.android },
  ].filter((x) => !only || x.id === only);
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {items.map((it) => {
        const body = (
          <>
            <it.icon size={26} aria-hidden className={it.id === "android" ? "fill-current" : ""} />
            <span className="text-left leading-tight">
              <span className="block text-[10.5px] opacity-80">{it.href ? it.small : t("download.comingSoon")}</span>
              <span className="block text-[17px] font-semibold tracking-tight">{it.big}</span>
            </span>
          </>
        );
        return it.href ? (
          <a key={it.id} href={it.href} target="_blank" rel="noreferrer" className="flex h-14 min-w-44 items-center gap-2.5 rounded-xl bg-primary px-4 text-primary-ink transition-opacity hover:opacity-90">
            {body}
          </a>
        ) : (
          <span
            key={it.id}
            aria-disabled="true"
            title={t("download.mobileSoon")}
            className="flex h-14 min-w-44 cursor-not-allowed items-center gap-2.5 rounded-xl border border-line-strong bg-surface px-4 text-muted"
          >
            {body}
          </span>
        );
      })}
    </div>
  );
}
