import { BASE } from "@/lib/config";

/**
 * Platform and store logos for download links. These show the original logo files from the
 * open `logos` collection (public/brands, see its README) exactly as published: they are
 * trademarks of Apple, Microsoft and Google and must not be redrawn or recoloured here.
 * The one exception is Apple's mark, which Apple publishes in black or white: `onDark` shows
 * the white version (the same file, inverted) on dark buttons.
 */
export type BrandIconProps = { size?: number; className?: string; onDark?: boolean };

function Logo({ file, size = 24, className = "", invert = false }: { file: string; size?: number; className?: string; invert?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static export, tiny SVGs
    <img src={`${BASE}/brands/${file}.svg`} alt="" aria-hidden draggable={false} className={`inline-block shrink-0 object-contain ${invert ? "invert" : ""} ${className}`} style={{ width: size, height: size }} />
  );
}

/** Apple logo (Mac, iPhone and iPad, App Store). */
export const AppleLogo = (p: BrandIconProps) => <Logo file="apple" size={p.size} className={p.className} invert={p.onDark} />;
/** Windows logo. */
export const WindowsLogo = (p: BrandIconProps) => <Logo file="windows" size={p.size} className={p.className} />;
/** Android logo. */
export const AndroidLogo = (p: BrandIconProps) => <Logo file="android" size={p.size} className={p.className} />;
/** Linux (Tux). */
export const LinuxLogo = (p: BrandIconProps) => <Logo file="linux" size={p.size} className={p.className} />;
/** Google Play logo. */
export const GooglePlayLogo = (p: BrandIconProps) => <Logo file="google-play" size={p.size} className={p.className} />;
