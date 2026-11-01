import type { DocKind } from "@/lib/types";

/**
 * The home page gives each writing type a colour (violet, coral, sky, lime, tangerine in turn).
 * Inside the app that colour appears only as a small dot or icon tint, so the chrome stays calm.
 */
const ORDER: DocKind[] = ["novel", "story", "poem", "screenplay", "feature", "essay", "drama", "lyrics", "diary"];
const DOTS = ["bg-tint-violet", "bg-tint-coral", "bg-tint-sky", "bg-tint-lime", "bg-tint-tangerine"];

/** bg-* class for a writing type's dot */
export function kindDot(kind: DocKind): string {
  const i = ORDER.indexOf(kind);
  return i < 0 ? "bg-line-strong" : DOTS[i % DOTS.length];
}
