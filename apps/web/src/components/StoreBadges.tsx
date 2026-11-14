"use client";
import Link from "next/link";
import { APP_STORE_BADGE, GOOGLE_PLAY_BADGE, MS_STORE_BADGE, STORE_LINKS } from "@/lib/release";
import { useT } from "@/i18n/react";

/**
 * The stores' own badges, shown exactly as Apple, Google and Microsoft serve them (never redrawn,
 * recoloured or faded; see public/brands/README.md). With a store link the badge opens the listing;
 * without one it opens `fallback` (the home page sends visitors to /download/), or is shown unlinked
 * with "Coming soon" under it.
 */
type Store = "ios" | "android" | "windows";
const BADGE: Record<Store, { src: string; ratio: number; pad: number; alt: "download.appStoreAlt" | "download.playAlt" | "download.msStore"; track: string }> = {
  // ratio = width / height of the visible badge; pad = height of the image file / height of the visible badge
  // (Google's PNG carries Google's own clear space around the badge, so it is drawn larger to match)
  ios: { src: APP_STORE_BADGE, ratio: 120 / 40, pad: 1, alt: "download.appStoreAlt", track: "App Store" },
  android: { src: GOOGLE_PLAY_BADGE, ratio: 564 / 168, pad: 250 / 168, alt: "download.playAlt", track: "Google Play" },
  windows: { src: MS_STORE_BADGE, ratio: 161 / 44, pad: 1, alt: "download.msStore", track: "Microsoft Store" },
};

export function StoreBadge({ store, height = 44, className = "", fallback }: { store: Store; height?: number; className?: string; fallback?: string }) {
  const t = useT();
  const b = BADGE[store];
  const href = STORE_LINKS[store];
  const h = Math.round(height * b.pad);
  const img = <img src={b.src} alt={t(b.alt)} draggable={false} height={h} style={{ height: h, width: "auto", margin: b.pad > 1 ? `${-(h - height) / 2}px ${-(h - height) / 2}px` : undefined }} />;
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" data-track={b.track} className={`inline-flex items-center justify-center transition-opacity hover:opacity-90 ${className}`}>
      {img}
    </a>
  ) : fallback ? (
    <Link href={fallback} data-track={b.track} className={`inline-flex items-center justify-center transition-opacity hover:opacity-90 ${className}`}>
      {img}
    </Link>
  ) : (
    <span aria-disabled="true" title={t("download.mobileSoon")} className={`inline-flex flex-col items-center gap-1.5 ${className}`}>
      {img}
      <span className="text-xs font-semibold opacity-80">{t("download.storeSoon")}</span>
    </span>
  );
}

/** App Store / Google Play badges for the phone app. */
export function StoreBadges({ only, className = "", height = 44 }: { only?: "ios" | "android"; className?: string; height?: number }) {
  const stores = (["ios", "android"] as const).filter((s) => !only || s === only);
  return (
    <div className={`flex flex-wrap items-start justify-center gap-3 ${className}`}>
      {stores.map((s) => (
        <StoreBadge key={s} store={s} height={height} />
      ))}
    </div>
  );
}
