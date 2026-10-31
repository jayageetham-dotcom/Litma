import { TemplatePreview } from "@/components/TemplatePreview";
import { TEMPLATES } from "@/lib/templates";

/**
 * All nine writing types drift past slowly, like pages on a desk.
 * Pauses on hover/focus; with reduced motion it becomes a plain scrollable row.
 */
export function TypesMarquee() {
  const types = TEMPLATES.filter((t) => t.kind !== "blank");
  const card = (t: (typeof types)[number], i: number, hidden = false) => (
    <li key={`${t.kind}-${hidden ? "b" : "a"}`} className="marquee-card shrink-0" aria-hidden={hidden || undefined} style={{ "--i": i } as React.CSSProperties}>
      <div className="marquee-sheet">
        <TemplatePreview kind={t.kind} width={168} />
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          {t.ml}
        </span>
        <span className="text-sm text-muted">{t.en}</span>
      </div>
      <p className="mt-0.5 w-[168px] text-xs leading-snug text-muted">{t.blurb}</p>
    </li>
  );
  return (
    <div className="marquee" role="region" aria-label={`${types.length} writing types`}>
      <ul className="marquee-track">
        {types.map((t, i) => card(t, i))}
        {types.map((t, i) => card(t, i, true))}
      </ul>
    </div>
  );
}
