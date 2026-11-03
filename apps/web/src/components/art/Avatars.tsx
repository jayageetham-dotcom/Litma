"use client";
import type { Profile } from "@/lib/types";
import { BASE } from "@/lib/config";

type Paint = { fg: string; bg: string };

/**
 * Avatar pictures (public/avatars/avatar-<id>.svg, listed in avatars.json for the desktop and phone apps).
 * Shown alternating, side by side as equals. Any other saved id (older drawn avatars) shows the first letter.
 */
export const AVATAR_IMAGES = ["f-1", "m-1", "f-2", "m-2", "f-3", "m-3", "f-4", "m-4", "f-5", "m-5", "m-6", "m-7"];
export const avatarImageUrl = (id: string) => `${BASE}/avatars/avatar-${id}.svg`;
/** Everything the pickers offer after "letter". */
export const AVATAR_CHOICES = AVATAR_IMAGES;
export const isAvatarImage = (id?: string | null) => !!id && AVATAR_IMAGES.includes(id);

export const AVATAR_TINTS = ["violet", "coral", "sky", "lime", "tangerine"] as const;
export type AvatarTint = (typeof AVATAR_TINTS)[number];

/** First written letter of a name: a whole Malayalam akshara (ക്ഷ, not ക), or an uppercase Latin letter. */
export function firstLetter(name: string | null | undefined, fallback = "ല") {
  const s = (name ?? "").trim();
  if (!s) return fallback;
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: "grapheme" }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  let g = s.slice(0, 1);
  if (Seg) for (const x of new Seg(undefined, { granularity: "grapheme" }).segment(s)) {
    g = x.segment;
    break;
  }
  // ക + ് + ഷ… : keep a conjunct together
  const m = s.match(/^(?:[ക-ഹ]്)+[ക-ഹ][ാ-ൌൗ]?/);
  return (m ? m[0] : g).toUpperCase();
}

/** A steady tint per name, so a writer who never picks one still keeps the same colour. */
export function tintFor(name: string | null | undefined): AvatarTint {
  let h = 0;
  for (const ch of name ?? "") h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

export const tintPaint = (t: AvatarTint): Paint => ({ fg: `var(--tint-${t})`, bg: `color-mix(in srgb, var(--tint-${t}) 16%, var(--surface))` });

/**
 * One avatar: `id` is one of AVATAR_IMAGES, otherwise the first letter of `name`. The letter takes a theme
 * tint, or pass `paint` for fixed colours (book covers, which print).
 */
export function AvatarArt({ id, name, tint, paint, size = 32, className = "", title, square = false }: { id?: string | null; name?: string | null; tint?: AvatarTint; paint?: Paint; size?: number | string; className?: string; title?: string; square?: boolean }) {
  const dim = typeof size === "number" ? `${size}px` : size;
  if (isAvatarImage(id))
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarImageUrl(id!)} alt={title ?? ""} title={title} draggable={false} className={`shrink-0 object-cover ${square ? "" : "rounded-full"} ${className}`} style={{ width: dim, height: dim }} />
    );
  const p = paint ?? tintPaint(tint ?? tintFor(name));
  return (
    <svg viewBox="0 0 64 64" preserveAspectRatio={square ? "xMidYMid slice" : undefined} width={dim} height={dim} className={`shrink-0 ${square ? "" : "rounded-full"} ${className}`} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} style={{ width: dim, height: dim }}>
      {square ? <rect width="64" height="64" fill={p.bg} /> : <circle cx="32" cy="32" r="32" fill={p.bg} />}
      <text x="32" y="33" textAnchor="middle" dominantBaseline="central" fill={p.fg} fontSize="28" fontWeight="700" fontFamily="'Anek Malayalam', Inter, sans-serif">
        {firstLetter(name)}
      </text>
    </svg>
  );
}

/** What a profile shows: its chosen avatar, else an earlier uploaded photo, else its first letter. */
export function profileAvatar(profile: (Pick<Profile, "avatar_url" | "display_name" | "pen_name"> & { preferences?: Profile["preferences"] }) | null) {
  const name = profile?.pen_name || profile?.display_name || "";
  const id = (profile?.preferences?.avatar as string | undefined) ?? null;
  const tint = AVATAR_TINTS.includes(profile?.preferences?.avatarTint as AvatarTint) ? (profile!.preferences!.avatarTint as AvatarTint) : tintFor(name);
  return { name, id, tint, photo: !id ? profile?.avatar_url ?? null : null };
}
