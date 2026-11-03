"use client";
/**
 * Drawn cover illustrations (no uploads). Each is painted in the cover's own three colours, so every
 * palette works. Drawn on an A4 canvas (210 × 297) and cropped to fit any box. Kerala's land, water and
 * sky, plus a few abstract patterns: nothing tied to one community.
 */
type Paint = { bg: string; fg: string; accent: string };
type Art = { id: string; label: string; draw: (p: Paint) => React.ReactNode };

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

export const COVER_ART: Art[] = [
  {
    id: "backwaters",
    label: "Backwaters",
    draw: ({ fg, accent }) => (
      <>
        <circle cx="150" cy="118" r="30" fill={accent} opacity="0.9" />
        <path d="M0 176q30-14 60-6t60-2 50-8 40 4v133H0z" fill={fg} opacity="0.12" />
        <g fill={fg}>
          <path d="M28 182c4-26 8-40 16-52M44 130q-14-2-24 6m24-6q-6-12-18-14m18 14q4-14 16-18m-16 18q14-4 22 4" stroke={fg} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M58 188c2-20 6-32 12-42M70 146q-10-2-18 4m18-4q-4-10-14-11m14 11q4-11 13-13m-13 13q11-3 17 3" stroke={fg} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7" />
        </g>
        <path d="M70 214q40 10 78 0l-6 9q-33 7-66 0z" fill={fg} />
        <path d="M92 214v-24q14 4 18 24" fill={fg} opacity="0.75" />
        <path d="M128 194l-8 32" stroke={fg} strokeWidth="2" strokeLinecap="round" />
        {range(6).map((i) => (
          <path key={i} d={`M${-10 + (i % 2) * 18} ${236 + i * 11}q26-7 52 0t52 0 52 0 52 0 52 0`} stroke={fg} strokeWidth="1.6" fill="none" opacity={0.45 - i * 0.05} />
        ))}
      </>
    ),
  },
  {
    id: "palms",
    label: "Coconut palms",
    draw: ({ fg, accent }) => {
      const palm = (x: number, base: number, h: number, lean: number, o: number) => {
        const tx = x + lean,
          ty = base - h;
        return (
          <g opacity={o} key={x}>
            <path d={`M${x} ${base}q${lean * 0.2} ${-h * 0.6} ${lean} ${-h}`} stroke={fg} strokeWidth="4" fill="none" strokeLinecap="round" />
            {[
              [-34, 8],
              [-26, -12],
              [-6, -22],
              [16, -18],
              [32, -4],
              [34, 12],
            ].map(([dx, dy], i) => (
              <path key={i} d={`M${tx} ${ty}q${dx * 0.5} ${dy - 10} ${dx} ${dy + 6}`} stroke={fg} strokeWidth="3" fill="none" strokeLinecap="round" />
            ))}
          </g>
        );
      };
      return (
        <>
          <circle cx="70" cy="150" r="38" fill={accent} opacity="0.85" />
          <path d="M0 214h210v83H0z" fill={fg} opacity="0.1" />
          {palm(150, 230, 120, -18, 1)}
          {palm(182, 226, 92, 10, 0.6)}
          {palm(34, 232, 70, 14, 0.45)}
          {range(4).map((i) => (
            <path key={i} d={`M${20 + i * 12} ${240 + i * 12}h${170 - i * 24}`} stroke={fg} strokeWidth="1.4" opacity={0.35 - i * 0.06} strokeLinecap="round" />
          ))}
        </>
      );
    },
  },
  {
    id: "monsoon",
    label: "Monsoon",
    draw: ({ fg, accent }) => (
      <>
        <g fill={fg} opacity="0.16">
          <circle cx="60" cy="70" r="34" />
          <circle cx="100" cy="56" r="40" />
          <circle cx="146" cy="72" r="30" />
          <rect x="30" y="70" width="146" height="34" rx="17" />
        </g>
        {range(26).map((i) => {
          const x = 14 + ((i * 37) % 190),
            y = 116 + ((i * 53) % 110);
          return <path key={i} d={`M${x} ${y}l-6 18`} stroke={i % 4 === 0 ? accent : fg} strokeWidth="2" strokeLinecap="round" opacity={i % 4 === 0 ? 0.9 : 0.45} />;
        })}
        {[
          [56, 262, 26],
          [140, 248, 18],
          [118, 280, 12],
        ].map(([x, y, r], i) => (
          <g key={i} fill="none" stroke={fg} strokeWidth="1.4">
            <ellipse cx={x} cy={y} rx={r} ry={r / 4} opacity="0.5" />
            <ellipse cx={x} cy={y} rx={r * 0.55} ry={r / 7} opacity="0.7" />
          </g>
        ))}
      </>
    ),
  },
  {
    id: "hills",
    label: "Hills",
    draw: ({ fg, accent }) => (
      <>
        <circle cx="150" cy="96" r="22" fill={accent} opacity="0.9" />
        <path d="M0 170l40-30 34 18 46-44 44 34 46-22v171H0z" fill={fg} opacity="0.14" />
        <path d="M0 200l52-34 40 22 50-36 68 40v105H0z" fill={fg} opacity="0.28" />
        <path d="M0 236l60-28 54 20 46-18 50 16v71H0z" fill={fg} opacity="0.5" />
        <g stroke={fg} strokeWidth="1.2" opacity="0.5">
          {range(5).map((i) => (
            <path key={i} d={`M${10 + i * 10} ${258 + i * 7}q${30 - i * 2} -8 ${60 + i * 10} 0`} fill="none" />
          ))}
        </g>
        <g stroke={fg} strokeWidth="2" fill="none" strokeLinecap="round">
          <path d="M44 84q5-5 10 0q5-5 10 0" />
          <path d="M72 70q4-4 8 0q4-4 8 0" opacity="0.7" />
        </g>
      </>
    ),
  },
  {
    id: "night",
    label: "Moonlit night",
    draw: ({ fg, accent, bg }) => (
      <>
        <circle cx="146" cy="84" r="34" fill={accent} />
        <circle cx="160" cy="74" r="30" fill={bg} />
        {range(30).map((i) => (
          <circle key={i} cx={(i * 47) % 206 + 2} cy={(i * 29) % 190 + 8} r={i % 5 === 0 ? 1.8 : 1} fill={fg} opacity={i % 3 === 0 ? 0.9 : 0.5} />
        ))}
        <path d="M0 246q52-16 105-4t105-6v61H0z" fill={fg} opacity="0.18" />
        <g stroke={accent} strokeWidth="1.6" opacity="0.6" strokeLinecap="round">
          <path d="M120 258h40M128 266h24M134 274h12" />
        </g>
      </>
    ),
  },
  {
    id: "leaves",
    label: "Leaves",
    draw: ({ fg, accent, bg }) => {
      const leaf = (x: number, y: number, rot: number, s: number, c: string, o: number, k: number) => (
        <g key={k} transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} opacity={o}>
          <path d="M0 0q40-30 120 0q-80 30-120 0z" fill={c} />
          <path d="M4 0h112" stroke={bg} strokeWidth="1.4" opacity="0.7" />
          {range(7).map((i) => (
            <path key={i} d={`M${16 + i * 14} 0l10 ${i % 2 ? -10 : 10}`} stroke={bg} strokeWidth="1" opacity="0.5" />
          ))}
        </g>
      );
      return (
        <>
          {leaf(-30, 40, 30, 1.3, fg, 0.22, 1)}
          {leaf(-20, 80, 12, 1, accent, 0.85, 2)}
          {leaf(240, 230, 200, 1.4, fg, 0.25, 3)}
          {leaf(230, 270, 190, 1, accent, 0.8, 4)}
          {leaf(160, 300, 240, 0.9, fg, 0.18, 5)}
        </>
      );
    },
  },
  {
    id: "birds",
    label: "Birds",
    draw: ({ fg, accent }) => (
      <>
        {range(4).map((i) => (
          <path key={i} d={`M0 ${190 + i * 16}q105 -${30 - i * 5} 210 0`} stroke={fg} strokeWidth="1.2" fill="none" opacity={0.25 + i * 0.05} />
        ))}
        {[
          [40, 140, 1.4, fg],
          [72, 120, 1, fg],
          [100, 150, 1.2, accent],
          [128, 112, 0.8, fg],
          [150, 136, 1.1, fg],
          [176, 104, 0.7, accent],
          [88, 92, 0.6, fg],
        ].map(([x, y, s, c], i) => (
          <path key={i} transform={`translate(${x} ${y}) scale(${s})`} d="M-14 0q7-9 14 0q7-9 14 0q-7-4-14 2q-7-6-14-2z" fill={c as string} opacity={0.85} />
        ))}
      </>
    ),
  },
  {
    id: "quill",
    label: "Pen and ink",
    draw: ({ fg, accent }) => (
      <>
        <g transform="translate(118 56) rotate(28)">
          <path d="M0 0q34 40 10 150l-10 20-10-20q-24-110 10-150z" fill={fg} opacity="0.2" />
          <path d="M0 6v164" stroke={fg} strokeWidth="2" />
          {range(9).map((i) => (
            <path key={i} d={`M0 ${24 + i * 14}l${i % 2 ? 14 : -14} -10`} stroke={fg} strokeWidth="1" opacity="0.5" />
          ))}
        </g>
        <path d="M20 250q30-16 58-2t56-4 56 6" stroke={accent} strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M30 266q26-10 52 0t52-2" stroke={fg} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.5" />
        <circle cx="64" cy="236" r="4" fill={accent} />
      </>
    ),
  },
  {
    id: "circles",
    label: "Circles",
    draw: ({ fg, accent }) => (
      <>
        <circle cx="150" cy="190" r="92" fill={fg} opacity="0.1" />
        <circle cx="54" cy="240" r="60" fill={accent} opacity="0.75" />
        <circle cx="160" cy="96" r="34" fill="none" stroke={accent} strokeWidth="3" />
        {range(5).map((i) => (
          <circle key={i} cx="150" cy="190" r={30 + i * 14} fill="none" stroke={fg} strokeWidth="1" opacity={0.4 - i * 0.06} />
        ))}
      </>
    ),
  },
  {
    id: "weave",
    label: "Weave",
    draw: ({ fg, accent }) => (
      <>
        {range(7).map((r) =>
          range(5).map((c) => {
            const x = 6 + c * 42 + (r % 2) * 21,
              y = 150 + r * 21;
            return <path key={`${r}-${c}`} d={`M${x} ${y}l21-21 21 21-21 21z`} fill={(r + c) % 3 === 0 ? accent : fg} opacity={(r + c) % 3 === 0 ? 0.8 : 0.12 + (r % 3) * 0.06} />;
          }),
        )}
        <path d="M0 136h210" stroke={accent} strokeWidth="2" />
      </>
    ),
  },
];

/** A cover illustration filling its box (cropped to cover it). `mirror` flips it for the back cover. */
export function CoverArtSvg({ id, paint, className = "", style, mirror = false }: { id?: string | null; paint: Paint; className?: string; style?: React.CSSProperties; mirror?: boolean }) {
  const art = COVER_ART.find((a) => a.id === id);
  if (!art) return null;
  return (
    <svg viewBox="0 0 210 297" preserveAspectRatio="xMidYMid slice" className={className} style={style} aria-hidden>
      <g transform={mirror ? "translate(210 0) scale(-1 1)" : undefined}>{art.draw(paint)}</g>
    </svg>
  );
}
