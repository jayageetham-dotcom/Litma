"use client";
import { useId } from "react";
import type { Profile } from "@/lib/types";

/** Drawn avatars: generic characters (no gender), two colours each so they suit any theme. */
type Paint = { fg: string; bg: string };
type Art = { id: string; label: string; draw: (p: Paint) => React.ReactNode };

const person = ({ fg, bg }: Paint, extra?: React.ReactNode, behind?: React.ReactNode) => (
  <>
    {behind}
    <path d="M12 64C12 49 21 42 32 42S52 49 52 64Z" fill={fg} />
    <circle cx="32" cy="26" r="12" fill={fg} />
    <circle cx="27.5" cy="26" r="1.7" fill={bg} />
    <circle cx="36.5" cy="26" r="1.7" fill={bg} />
    <path d="M28 31q4 3 8 0" stroke={bg} strokeWidth="1.7" strokeLinecap="round" fill="none" />
    {extra}
  </>
);

export const AVATAR_ART: Art[] = [
  { id: "person", label: "Person", draw: (p) => person(p) },
  {
    id: "glasses",
    label: "Glasses",
    draw: (p) =>
      person(
        p,
        <g stroke={p.bg} strokeWidth="1.5" fill="none">
          <circle cx="27.5" cy="26" r="4" />
          <circle cx="36.5" cy="26" r="4" />
          <path d="M31.5 26h1" />
        </g>,
      ),
  },
  {
    id: "curls",
    label: "Curls",
    draw: (p) =>
      person(
        p,
        undefined,
        <g fill={p.fg} opacity="0.5">
          {[
            [21, 21, 6],
            [27, 15, 6],
            [37, 15, 6],
            [43, 21, 6],
            [19.5, 29, 5],
            [44.5, 29, 5],
          ].map(([x, y, r]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r={r} />
          ))}
        </g>,
      ),
  },
  {
    id: "beanie",
    label: "Woolly hat",
    draw: (p) =>
      person(
        p,
        <g>
          <path d="M19 24q0-13 13-13t13 13z" fill={p.bg} stroke={p.fg} strokeWidth="2" strokeLinejoin="round" />
          <path d="M18 24h28" stroke={p.fg} strokeWidth="3" strokeLinecap="round" />
          <circle cx="32" cy="9.5" r="3" fill={p.fg} />
        </g>,
      ),
  },
  {
    id: "reader",
    label: "Reader",
    draw: (p) =>
      person(
        p,
        <g>
          <path d="M16 52l16 4 16-4v10l-16 4-16-4z" fill={p.bg} stroke={p.fg} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M32 56v10" stroke={p.fg} strokeWidth="1.8" />
        </g>,
      ),
  },
  {
    id: "owl",
    label: "Owl",
    draw: ({ fg, bg }) => (
      <>
        <path d="M18 20l5 8M46 20l-5 8" stroke={fg} strokeWidth="4" strokeLinecap="round" />
        <ellipse cx="32" cy="39" rx="16" ry="19" fill={fg} />
        <circle cx="26" cy="33" r="6" fill={bg} />
        <circle cx="38" cy="33" r="6" fill={bg} />
        <circle cx="26" cy="33" r="2.5" fill={fg} />
        <circle cx="38" cy="33" r="2.5" fill={fg} />
        <path d="M30 39h4l-2 4z" fill={bg} />
        <path d="M25 49q7 4 14 0" stroke={bg} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.7" />
      </>
    ),
  },
  {
    id: "cat",
    label: "Cat",
    draw: ({ fg, bg }) => (
      <>
        <path d="M17 32l3-17 11 8zM47 32l-3-17-11 8z" fill={fg} strokeLinejoin="round" />
        <circle cx="32" cy="37" r="16" fill={fg} />
        <ellipse cx="26" cy="35" rx="2" ry="3" fill={bg} />
        <ellipse cx="38" cy="35" rx="2" ry="3" fill={bg} />
        <path d="M30.5 41h3l-1.5 2z" fill={bg} />
        <g stroke={bg} strokeWidth="1.2" strokeLinecap="round">
          <path d="M23 42l-7-1M23 44l-7 2M41 42l7-1M41 44l7 2" />
        </g>
      </>
    ),
  },
  {
    id: "tortoise",
    label: "Tortoise",
    draw: ({ fg, bg }) => (
      <>
        <circle cx="53" cy="38" r="5" fill={fg} />
        <circle cx="54.5" cy="37" r="1.2" fill={bg} />
        <rect x="16" y="42" width="7" height="8" rx="3" fill={fg} />
        <rect x="39" y="42" width="7" height="8" rx="3" fill={fg} />
        <path d="M11 45a20 18 0 0 1 40 0z" fill={fg} />
        <g stroke={bg} strokeWidth="1.5" fill="none" strokeLinejoin="round">
          <path d="M24 45l2-8h10l2 8M26 37l-5-6M36 37l5-6M31 37v-9" />
        </g>
      </>
    ),
  },
  {
    id: "fish",
    label: "Fish",
    draw: ({ fg, bg }) => (
      <>
        <path d="M43 34l13-11v22z" fill={fg} />
        <ellipse cx="29" cy="34" rx="17" ry="11" fill={fg} />
        <circle cx="20" cy="31.5" r="2.2" fill={bg} />
        <path d="M27 26q3 8 0 16" stroke={bg} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <g fill="none" stroke={fg} strokeWidth="1.5">
          <circle cx="12" cy="16" r="2.5" />
          <circle cx="18" cy="10" r="1.6" />
        </g>
      </>
    ),
  },
  {
    id: "parrot",
    label: "Parrot",
    draw: ({ fg, bg }) => (
      <>
        <path d="M29 52l-5 10M35 52l3 10" stroke={fg} strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="32" cy="42" rx="11" ry="13" fill={fg} />
        <circle cx="32" cy="24" r="11" fill={fg} />
        <path d="M39 20q9 0 7 10-3-3-7-2z" fill={fg} opacity="0.55" />
        <circle cx="34" cy="21" r="2" fill={bg} />
        <path d="M24 38q6 10 14 6" stroke={bg} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  {
    id: "elephant",
    label: "Elephant",
    draw: ({ fg, bg }) => (
      <>
        <ellipse cx="16" cy="30" rx="9" ry="12" fill={fg} opacity="0.55" />
        <ellipse cx="48" cy="30" rx="9" ry="12" fill={fg} opacity="0.55" />
        <circle cx="32" cy="30" r="14" fill={fg} />
        <path d="M32 38q-2 14 7 16" stroke={fg} strokeWidth="7" strokeLinecap="round" fill="none" />
        <circle cx="26.5" cy="28" r="1.8" fill={bg} />
        <circle cx="37.5" cy="28" r="1.8" fill={bg} />
      </>
    ),
  },
  {
    id: "butterfly",
    label: "Butterfly",
    draw: ({ fg, bg }) => (
      <>
        <ellipse cx="21" cy="25" rx="10" ry="12" fill={fg} />
        <ellipse cx="43" cy="25" rx="10" ry="12" fill={fg} />
        <ellipse cx="23" cy="44" rx="8" ry="9" fill={fg} opacity="0.6" />
        <ellipse cx="41" cy="44" rx="8" ry="9" fill={fg} opacity="0.6" />
        <circle cx="20" cy="24" r="3" fill={bg} />
        <circle cx="44" cy="24" r="3" fill={bg} />
        <rect x="30" y="18" width="4" height="34" rx="2" fill={fg} stroke={bg} strokeWidth="1" />
        <path d="M31 18q-3-7-7-8M33 18q3-7 7-8" stroke={fg} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  {
    id: "moon",
    label: "Moon",
    draw: ({ fg, bg }) => (
      <>
        <circle cx="29" cy="34" r="18" fill={fg} />
        <circle cx="38" cy="27" r="15" fill={bg} />
        <path d="M18 36q2.5 2 5 0" stroke={bg} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <g fill={fg}>
          <circle cx="46" cy="44" r="1.8" />
          <circle cx="52" cy="34" r="1.2" />
          <circle cx="44" cy="14" r="1.4" />
        </g>
      </>
    ),
  },
];

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
 * One avatar: `id` is "letter" or a drawn character from AVATAR_ART. Colours come from a theme tint,
 * or pass `paint` for fixed colours (book covers, which print).
 */
export function AvatarArt({ id, name, tint, paint, size = 32, className = "", title }: { id?: string | null; name?: string | null; tint?: AvatarTint; paint?: Paint; size?: number | string; className?: string; title?: string }) {
  const p = paint ?? tintPaint(tint ?? tintFor(name));
  const art = AVATAR_ART.find((a) => a.id === id);
  const dim = typeof size === "number" ? `${size}px` : size;
  const clip = `av${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg viewBox="0 0 64 64" width={dim} height={dim} className={`shrink-0 rounded-full ${className}`} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} style={{ width: dim, height: dim }}>
      <defs>
        <clipPath id={clip}>
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>
      <circle cx="32" cy="32" r="32" fill={p.bg} />
      {art ? (
        <g clipPath={`url(#${clip})`}>{art.draw(p)}</g>
      ) : (
        <text x="32" y="33" textAnchor="middle" dominantBaseline="central" fill={p.fg} fontSize="28" fontWeight="700" fontFamily="'Anek Malayalam', Inter, sans-serif">
          {firstLetter(name)}
        </text>
      )}
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
