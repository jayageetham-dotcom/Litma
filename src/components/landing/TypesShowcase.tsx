"use client";
import { useEffect, useRef, useState } from "react";
import { TemplatePreview } from "@/components/TemplatePreview";
import { TEMPLATES } from "@/lib/templates";

const TYPES = TEMPLATES.filter((t) => t.kind !== "blank");
const DWELL = 3800;

/**
 * All nine writing types as a list, with one large page preview that changes as you
 * hover or tap a type. While nobody touches it, it steps through the types on its own
 * (a thin progress line shows the timing). Tabs pattern: ←/→ ↑/↓ Home End move between types.
 */
export function TypesShowcase() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [visible, setVisible] = useState(false);
  const [still, setStill] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!auto || !visible || still) return;
    const t = setTimeout(() => setActive((i) => (i + 1) % TYPES.length), DWELL);
    return () => clearTimeout(t);
  }, [active, auto, visible, still]);

  const pick = (i: number, focus = false) => {
    setAuto(false);
    setActive(i);
    if (focus) tabs.current[i]?.focus();
  };
  const onKey = (e: React.KeyboardEvent) => {
    const n = TYPES.length;
    const k = e.key;
    if (["ArrowDown", "ArrowRight"].includes(k)) (e.preventDefault(), pick((active + 1) % n, true));
    else if (["ArrowUp", "ArrowLeft"].includes(k)) (e.preventDefault(), pick((active - 1 + n) % n, true));
    else if (k === "Home") (e.preventDefault(), pick(0, true));
    else if (k === "End") (e.preventDefault(), pick(n - 1, true));
  };
  const t = TYPES[active];

  return (
    <div ref={root} className="grid items-center justify-center gap-8 md:grid-cols-[minmax(0,24rem)_auto] md:gap-16 lg:gap-24" onMouseLeave={() => setAuto(true)}>
      <div role="tablist" aria-label="Writing types" aria-orientation="vertical" onKeyDown={onKey} className="scrollbar-none -mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:grid md:grid-cols-1 md:gap-1 md:overflow-visible md:px-0 lg:grid-cols-1">
        {TYPES.map((x, i) => {
          const on = i === active;
          return (
            <button
              key={x.kind}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              role="tab"
              id={`type-tab-${x.kind}`}
              aria-selected={on}
              aria-controls="type-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => pick(i)}
              onMouseEnter={() => pick(i)}
              className={`relative shrink-0 overflow-hidden rounded-xl px-4 py-2.5 text-left transition-colors md:py-3 ${on ? "bg-surface shadow-[var(--sheet-shadow)]" : "hover:bg-surface/60"}`}
            >
              <span className="flex items-baseline gap-2 whitespace-nowrap">
                <span className={`font-semibold ${on ? "text-ink" : "text-ink/80"}`} style={{ fontFamily: "var(--font-display)" }}>
                  {x.ml}
                </span>
                <span className="text-sm text-muted">{x.en}</span>
              </span>
              <span className={`hidden overflow-hidden text-sm leading-snug text-muted transition-[max-height,opacity] duration-300 md:block ${on ? "mt-1 max-h-16 opacity-100" : "max-h-0 opacity-0"}`}>{x.blurb}</span>
              {on && auto && visible && !still && (
                <span key={active} className="absolute inset-x-4 bottom-0 h-0.5 origin-left rounded-full bg-[var(--brand-mark)]" style={{ animation: `litma-progress ${DWELL}ms linear both` }} aria-hidden />
              )}
            </button>
          );
        })}
      </div>

      <div id="type-panel" role="tabpanel" aria-labelledby={`type-tab-${t.kind}`} className="mx-auto md:sticky md:top-24">
        <div key={t.kind} className="rise-in">
          <TemplatePreview kind={t.kind} width={300} />
        </div>
        <p className="mt-3 text-center text-sm text-muted md:hidden">{t.blurb}</p>
      </div>
    </div>
  );
}
