"use client";
import { BASE } from "@/lib/config";

/**
 * Cover backgrounds: eight print-ready genre artworks in `public/covers/<id>.svg` (6 × 9 in with
 * 0.125 in bleed, pure vector, no text). The top 30% stays calm for the title and the bottom 15% clear
 * for the author. Each lists the text and accent colours that read well on it; picking one applies them.
 */
export type CoverBackground = { id: string; bg: string; fg: string; accent: string };

export const COVER_ART: CoverBackground[] = [
  { id: "fantasy", bg: "#0b2f3a", fg: "#fdf6e3", accent: "#e9c46a" },
  { id: "thriller", bg: "#0a0e13", fg: "#e8eef5", accent: "#c8102e" },
  { id: "romance", bg: "#f6c9cf", fg: "#6b2f45", accent: "#b5546f" },
  { id: "scifi", bg: "#050a1f", fg: "#e9fbff", accent: "#4fe3ff" },
  { id: "horror", bg: "#151b18", fg: "#e9e6d6", accent: "#d9c45a" },
  { id: "literary", bg: "#efe9dc", fg: "#3d4232", accent: "#a8875a" },
  { id: "historical", bg: "#1d2a44", fg: "#fbecd0", accent: "#e7a85a" },
  { id: "selfhelp", bg: "#0b2350", fg: "#ffffff", accent: "#ffb15a" },
];

/** Drawings from the first version of cover art, mapped to the closest new background. */
const MOVED: Record<string, string> = {
  backwaters: "literary",
  palms: "romance",
  monsoon: "thriller",
  hills: "fantasy",
  night: "scifi",
  leaves: "literary",
  birds: "selfhelp",
  quill: "literary",
  circles: "selfhelp",
  weave: "selfhelp",
};

export const coverArtId = (id?: string | null) => (id ? (COVER_ART.some((a) => a.id === id) ? id : MOVED[id] ?? null) : null);
export const coverArtUrl = (id: string) => `${BASE}/covers/${id}.svg`;

/** A cover background filling its box (cropped to cover it). `mirror` flips it for the back cover. */
export function CoverArtSvg({ id, className = "", style, mirror = false }: { id?: string | null; className?: string; style?: React.CSSProperties; mirror?: boolean }) {
  const art = coverArtId(id);
  if (!art) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={coverArtUrl(art)} alt="" draggable={false} className={`object-cover ${className}`} style={{ ...style, transform: mirror ? "scaleX(-1)" : style?.transform }} />
  );
}
