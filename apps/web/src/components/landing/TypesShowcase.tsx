"use client";
import { useEffect, useRef, useState } from "react";
import { TemplatePreview } from "@/components/TemplatePreview";
import { TEMPLATES } from "@/lib/templates";

const TYPES = TEMPLATES.filter((t) => t.kind !== "blank");
const DWELL = 4200;

/** Each writing type gets a colour from the home palette. `ink` is the text colour on that fill (AA contrast). */
const COLOURS = [
  { fill: "bg-violet", glow: "bg-violet", text: "text-violet", ink: "text-night-ink", soft: "text-night-ink/70" },
  { fill: "bg-coral", glow: "bg-coral", text: "text-coral", ink: "text-on-pop", soft: "text-on-pop/70" },
  { fill: "bg-sky", glow: "bg-sky", text: "text-sky", ink: "text-on-pop", soft: "text-on-pop/70" },
  { fill: "bg-lime", glow: "bg-lime", text: "text-lime", ink: "text-on-pop", soft: "text-on-pop/70" },
  { fill: "bg-tangerine", glow: "bg-tangerine", text: "text-tangerine", ink: "text-on-pop", soft: "text-on-pop/70" },
];
const colourOf = (i: number) => COLOURS[i % COLOURS.length];

/**
 * "Nine writing types": a grid of coloured cards on the night band, with a real first page
 * (rendered with the editor's own CSS) for the chosen type. Hover, tap or use the arrow keys;
 * while nobody touches it, it steps through the types on its own.
 */
export function TypesShowcase() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [visible, setVisible] = useState(false);
  const [still, setStill] = useState(false);
  const [width, setWidth] = useState(330);
  const root = useRef<HTMLElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const fit = () => setWidth(Math.min(340, window.innerWidth - 72));
    fit();
    window.addEventListener("resize", fit);
    const el = root.current;
    const io = el ? new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.25 }) : null;
    if (el) io!.observe(el);
    return () => {
      window.removeEventListener("resize", fit);
      io?.disconnect();
    };
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
    if (k === "ArrowRight") (e.preventDefault(), pick((active + 1) % n, true));
    else if (k === "ArrowLeft") (e.preventDefault(), pick((active - 1 + n) % n, true));
    else if (k === "ArrowDown") (e.preventDefault(), pick(Math.min(n - 1, active + 3), true));
    else if (k === "ArrowUp") (e.preventDefault(), pick(Math.max(0, active - 3), true));
    else if (k === "Home") (e.preventDefault(), pick(0, true));
    else if (k === "End") (e.preventDefault(), pick(n - 1, true));
  };
  const t = TYPES[active];
  const c = colourOf(active);

  return (
    <section ref={root} id="types" className="relative overflow-hidden bg-night py-24 text-night-ink md:py-32">
      <div aria-hidden className="dot-grid pointer-events-none absolute inset-0 text-night-ink/[0.05]" />
      <div aria-hidden className={`pointer-events-none absolute right-[-8rem] top-1/3 size-[32rem] rounded-full opacity-30 blur-[120px] transition-colors duration-700 ${c.glow}`} />

      <div className="relative mx-auto max-w-7xl px-5 md:px-10">
        <div className="on-night flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl">
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-lime">01 · Writing types</p>
            <h2 className="text-4xl font-extrabold leading-[1.15] md:text-6xl" style={{ fontFamily: "var(--font-display)" }}>
              ഒൻപത് സാഹിത്യരൂപങ്ങൾ.
              <span className="mt-1 block text-muted">Nine writing types, each set the way it is printed.</span>
            </h2>
          </div>
          <p className="max-w-sm text-muted">Pick a സാഹിത്യരൂപം (writing type) and Litma sets up the page, the typeface and the toolbar for it.</p>
        </div>

        <div className="mt-16 grid items-start gap-12 lg:grid-cols-[1fr_auto] lg:gap-16" onMouseLeave={() => setAuto(true)}>
          <div role="tablist" aria-label="Writing types" onKeyDown={onKey} className="on-night grid grid-cols-3 gap-2 sm:gap-3">
            {TYPES.map((k, i) => {
              const on = i === active;
              const col = colourOf(i);
              return (
                <button
                  key={k.kind}
                  ref={(el) => {
                    tabs.current[i] = el;
                  }}
                  role="tab"
                  id={`type-tab-${k.kind}`}
                  aria-selected={on}
                  aria-controls="type-panel"
                  tabIndex={on ? 0 : -1}
                  onClick={() => pick(i)}
                  onMouseEnter={() => pick(i)}
                  className={`relative overflow-hidden rounded-2xl border p-3 text-left sm:p-5 transition duration-300 ${on ? `${col.fill} border-transparent ${col.ink} -translate-y-0.5 shadow-[var(--pop-lift-shadow)]` : "border-line bg-night-ink/[0.03] hover:border-night-ink/25 hover:bg-night-ink/[0.06]"}`}
                >
                  <span className={`font-mono text-[11px] font-bold ${on ? col.soft : "text-night-ink/45"}`}>0{i + 1}</span>
                  <span className="mt-3 block text-lg font-extrabold leading-tight sm:mt-6 sm:text-2xl md:text-3xl" style={{ fontFamily: "var(--font-display)" }}>
                    {k.ml}
                  </span>
                  <span className={`block text-xs font-semibold sm:text-sm ${on ? col.soft : "text-muted"}`}>{k.en}</span>
                  {on && auto && visible && !still && (
                    <span key={active} aria-hidden className="absolute inset-x-3 bottom-1.5 h-0.5 sm:inset-x-5 sm:bottom-2 origin-left rounded-full bg-current opacity-40" style={{ animation: `litma-progress ${DWELL}ms linear both` }} />
                  )}
                </button>
              );
            })}
          </div>

          <div id="type-panel" role="tabpanel" aria-labelledby={`type-tab-${t.kind}`} className="mx-auto w-full" style={{ maxWidth: width + 16 }}>
            <div className="relative" style={{ width }}>
              <div aria-hidden className={`absolute inset-0 translate-x-4 translate-y-4 rounded-xl transition-colors duration-500 ${c.fill}`} />
              <div key={t.kind} className="rise-in relative overflow-hidden rounded-xl">
                <TemplatePreview kind={t.kind} width={width} />
              </div>
            </div>
            <div key={`d${t.kind}`} className="on-night rise-in mt-10">
              <p className="flex items-baseline gap-3">
                <span className={`text-2xl font-extrabold ${c.text}`} style={{ fontFamily: "var(--font-display)" }}>
                  {t.ml}
                </span>
                <span className="font-semibold text-ink/80">{t.en}</span>
              </p>
              <p className="mt-1 text-muted">{t.blurb}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
