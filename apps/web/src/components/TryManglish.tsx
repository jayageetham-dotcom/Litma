"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { manglish } from "@litma/shared/manglish";
import { transliterate } from "@/lib/functions";

type Word = { m: string; ml: string[] };

/** The self-typing demo: each word shows the suggestions a writer would see. */
const PHRASES: Word[][] = [
  [
    { m: "ente", ml: ["എന്റെ", "എന്തേ", "എണ്ടെ"] },
    { m: "kadha", ml: ["കഥ", "കധ", "കദ"] },
    { m: "ivide", ml: ["ഇവിടെ", "ഇവിടേ"] },
    { m: "thudangunnu.", ml: ["തുടങ്ങുന്നു.", "തുടങുന്നു."] },
  ],
  [
    { m: "puzhayude", ml: ["പുഴയുടെ", "പുഴയൂടെ"] },
    { m: "theerathe", ml: ["തീരത്തെ", "തീരതെ"] },
    { m: "oru", ml: ["ഒരു", "ഒരൂ"] },
    { m: "cheriya", ml: ["ചെറിയ", "ചേരിയ"] },
    { m: "veedu.", ml: ["വീട്.", "വീടു."] },
  ],
];

function useTypingDemo(running: boolean) {
  const [p, setP] = useState(0);
  const [w, setW] = useState(0);
  const [c, setC] = useState(0);

  useEffect(() => {
    if (!running) return;
    const words = PHRASES[p];
    let t: number;
    if (w >= words.length) {
      t = window.setTimeout(() => {
        setP((p + 1) % PHRASES.length);
        setW(0);
        setC(0);
      }, 2600);
    } else if (c < words[w].m.length) {
      t = window.setTimeout(() => setC(c + 1), c === 0 && w === 0 ? 700 : 75 + Math.random() * 70);
    } else {
      t = window.setTimeout(() => {
        setW(w + 1);
        setC(0);
      }, 520);
    }
    return () => clearTimeout(t);
  }, [p, w, c, running]);

  const words = PHRASES[p];
  const done = words.slice(0, w);
  const current = w < words.length ? words[w] : null;
  const partial = current ? current.m.slice(0, c) : "";
  const typed = [...done.map((x) => x.m), partial].filter(Boolean).join(" ");
  const output = done.map((x) => x.ml[0]).join(" ");
  return { typed, output, partial, suggestions: current && c >= 2 ? current.ml : null };
}

/** Real transliteration for what the visitor types: Google Input Tools when reachable, the offline engine otherwise. */
function useLiveManglish(input: string, on: boolean) {
  const [cands, setCands] = useState<Record<string, string[]>>({});
  const asked = useRef(new Set<string>());
  useEffect(() => {
    if (!on) return;
    const words = Array.from(new Set(input.match(/[A-Za-z]+/g) ?? [])).filter((w) => !asked.current.has(w));
    if (!words.length) return;
    const t = setTimeout(async () => {
      const found: Record<string, string[]> = {};
      await Promise.all(
        words.slice(-6).map(async (w) => {
          asked.current.add(w);
          const j = await transliterate(w, 3);
          if (j.source !== "offline" && j.candidates?.length) found[w] = j.candidates.slice(0, 3);
        })
      );
      if (Object.keys(found).length) setCands((g) => ({ ...g, ...found }));
    }, 220);
    return () => clearTimeout(t);
  }, [input, on]);

  const best = (w: string) => cands[w]?.[0] ?? manglish(w);
  // the word under the cursor stays Manglish with suggestions, like in the editor
  const m = input.match(/^(.*?)([A-Za-z]+)$/s);
  const head = m ? m[1] : input;
  const partial = m ? m[2] : "";
  const output = head.replace(/[A-Za-z~_^]+/g, best).trimEnd();
  const suggestions = partial.length >= 2 ? (cands[partial] ?? [manglish(partial)]) : null;
  return { output, partial, suggestions };
}

/** Home page hero: a work open on the desk. Manglish types itself until the visitor clicks in and tries it. */
export function TryManglish() {
  const [touched, setTouched] = useState(false);
  const [text, setText] = useState("");
  const demo = useTypingDemo(!touched);
  const live = useLiveManglish(text, touched);
  const view = touched ? live : demo;
  const input = touched ? text : demo.typed;

  // keep the suggestion popup inside the page: shift it left near the right edge, open upwards when there is no room below
  const pageRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLSpanElement>(null);
  const [pop, setPop] = useState({ x: 0, up: false });
  const hasPop = !!(view.partial && view.suggestions);
  useLayoutEffect(() => {
    const page = pageRef.current;
    const el = popRef.current;
    if (!hasPop || !page || !el) return;
    const anchor = el.parentElement!.getBoundingClientRect();
    const box = page.getBoundingClientRect();
    const pad = 8;
    const x = Math.min(0, box.right - pad - (anchor.left + el.offsetWidth));
    const up = anchor.bottom + 8 + el.offsetHeight > box.bottom - pad && anchor.top - 8 - el.offsetHeight > box.top + pad;
    setPop((p) => (p.x === x && p.up === up ? p : { x, up }));
  }, [hasPop, view.output, view.partial]);

  return (
    <div className="relative">
      {/* two coloured sheets under the card */}
      <div aria-hidden className="absolute inset-0 translate-x-5 translate-y-6 rotate-3 rounded-[2rem] bg-lime" />
      <div aria-hidden className="absolute inset-0 -translate-x-3 translate-y-3 -rotate-2 rounded-[2rem] bg-violet" />

      <div className="relative rounded-[2rem] bg-surface p-3 shadow-[var(--pop-lift-shadow)]">
        <div className="flex items-center justify-between gap-3 px-3 pb-3 pt-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 rounded-lg bg-coral/15 px-2 py-1 text-[11px] font-bold text-coral-text" style={{ fontFamily: "var(--font-display)" }}>
              നോവൽ
            </span>
            <span className="truncate text-sm font-semibold text-ink" style={{ fontFamily: "var(--font-display)" }}>
              കടൽ കാണാത്ത വീട്
            </span>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-muted">
            <span className="size-1.5 rounded-full bg-violet" aria-hidden /> Saved
          </span>
        </div>

        <label htmlFor="try-manglish" className="block cursor-text rounded-2xl bg-night p-4">
          <span className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.16em] text-night-ink/70">
            Type Manglish
            <span className="rounded-md bg-night-ink/10 px-1.5 py-0.5 normal-case tracking-normal">{touched ? "your turn" : "try it: click here"}</span>
          </span>
          <span className="relative block">
            {!touched && (
              <span aria-hidden className="pointer-events-none block min-h-[1.6rem] break-words font-mono text-[15px] leading-[1.6rem] text-lime">
                {input}
                <span className="typing-caret" />
              </span>
            )}
            <input
              id="try-manglish"
              value={touched ? text : ""}
              onFocus={() => {
                if (!touched) {
                  setTouched(true);
                  setText(demo.typed ? demo.typed + " " : "");
                }
              }}
              onChange={(e) => setText(e.target.value)}
              placeholder={touched ? "ente kadha…" : ""}
              aria-label="Type Manglish to see it in Malayalam"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className={`${touched ? "block" : "absolute inset-0"} w-full bg-transparent font-mono text-[16px] leading-[1.6rem] caret-lime outline-none placeholder:text-night-ink/35 md:text-[15px] ${touched ? "text-lime" : "text-transparent"}`}
            />
          </span>
        </label>

        <div ref={pageRef} className="relative mt-3 min-h-[12rem] rounded-2xl border border-line bg-paper px-6 pb-10 pt-6" aria-live="polite">
          <p className="text-[1.45rem] font-medium leading-[1.7] text-ink md:text-[1.55rem]" style={{ fontFamily: "var(--font-display)" }}>
            {view.output}
            {view.partial && (
              <span className="relative ml-1.5 inline-block">
                <span className="rounded bg-violet/10 px-1 font-mono text-base text-violet-text underline decoration-dotted underline-offset-4">{view.partial}</span>
                {view.suggestions && (
                  <span
                    ref={popRef}
                    style={{ translate: `${pop.x}px 0` }}
                    className={`rise-in absolute left-0 z-10 w-44 ${pop.up ? "bottom-full mb-2" : "top-full mt-2"} rounded-xl bg-surface p-1.5 shadow-[var(--pop-chip-shadow)] ring-1 ring-line`}
                  >
                    {view.suggestions.map((s, i) => (
                      <span key={s + i} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-base ${i === 0 ? "bg-violet text-night-ink" : "text-ink"}`}>
                        <span className={`font-mono text-[10px] ${i === 0 ? "text-night-ink/75" : "text-muted"}`}>{i + 1}</span>
                        {s}
                      </span>
                    ))}
                    <span className="block px-2 pb-0.5 pt-1 text-[10px] font-semibold text-muted" style={{ fontFamily: "var(--font-landing)" }}>
                      Space picks 1 · 1–7 picks another
                    </span>
                  </span>
                )}
              </span>
            )}
            {!view.output && !view.partial && <span className="text-muted">ente kadha… → എന്റെ കഥ…</span>}
          </p>
          <span className="absolute bottom-3 right-4 font-mono text-[11px] text-muted">A4 · 1</span>
        </div>
      </div>

      {/* floating stickers */}
      <span
        aria-hidden
        style={{ ["--r" as string]: "-8deg" }}
        className="float-a absolute -left-4 -top-6 hidden rounded-full bg-coral px-4 py-2 text-sm font-extrabold text-on-pop shadow-lg sm:block"
      >
        Manglish → മലയാളം
      </span>
      <span
        aria-hidden
        style={{ ["--r" as string]: "6deg" }}
        className="float-b absolute -bottom-8 -right-3 hidden rounded-full bg-sky px-4 py-2 text-sm font-extrabold text-on-pop shadow-lg sm:block"
      >
        9 writing types
      </span>
    </div>
  );
}
