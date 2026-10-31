"use client";
import { useEffect, useRef, useState } from "react";
import { BookA, Check, FileDown, Sparkles } from "lucide-react";

/**
 * "How it works" — four tiny looping demos of what happens inside the editor.
 * Each runs only while on screen; with reduced motion each shows its finished state.
 */

/** Step through `durations` (ms) in a loop while `ref` is visible. */
function useTimeline(durations: number[]) {
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const [visible, setVisible] = useState(false);
  const [still, setStill] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setStill(mq.matches);
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (still || !visible) return;
    const t = setTimeout(() => setI((n) => (n + 1) % durations.length), durations[i]);
    return () => clearTimeout(t);
  }, [i, visible, still, durations]);
  return { ref, step: still ? durations.length - 1 : i };
}

/* ─────────── 1 · Manglish suggestions ─────────── */
const WORDS: { latin: string; options: string[]; pick: number }[] = [
  { latin: "nammude", options: ["നമ്മുടെ", "നമ്മുടേ", "നമ്മൂടെ"], pick: 0 },
  { latin: "naadu", options: ["നാട്", "നാടു", "നാഡു"], pick: 0 },
  { latin: "pachappu", options: ["പച്ചപ്പ്", "പച്ചപ്പു", "പാച്ചപ്പ്"], pick: 0 },
];
type MFrame = { done: string[]; comp: string; popup: boolean; active: number; d: number };
const M_FRAMES: MFrame[] = (() => {
  const f: MFrame[] = [];
  const done: string[] = [];
  f.push({ done: [], comp: "", popup: false, active: 0, d: 700 });
  for (const w of WORDS) {
    for (let k = 1; k <= w.latin.length; k++) f.push({ done: [...done], comp: w.latin.slice(0, k), popup: k > 2, active: 0, d: 120 });
    f.push({ done: [...done], comp: w.latin, popup: true, active: 1, d: 450 });
    f.push({ done: [...done], comp: w.latin, popup: true, active: w.pick, d: 500 });
    done.push(w.options[w.pick]);
    f.push({ done: [...done], comp: "", popup: false, active: 0, d: 650 });
  }
  f.push({ done: [...done], comp: "", popup: false, active: 0, d: 1800 });
  return f;
})();

function ManglishDemo() {
  const { ref, step } = useTimeline(M_FRAMES.map((x) => x.d));
  const fr = M_FRAMES[step];
  const w = WORDS[fr.done.length] ?? WORDS[0];
  return (
    <div ref={ref} aria-hidden className="demo-stage grid place-items-center px-6">
      <div className="relative w-full max-w-[19rem] rounded-md bg-paper px-5 py-6 shadow-[var(--sheet-shadow)]" style={{ fontFamily: "'Noto Serif Malayalam'" }}>
        <p className="text-[17px] leading-relaxed text-ink">
          {fr.done.join(" ")}
          {fr.done.length > 0 && " "}
          {fr.comp && <span className="rounded-sm bg-accent-soft px-0.5 font-sans text-[15px] text-accent underline decoration-dotted underline-offset-4">{fr.comp}</span>}
          <span className="demo-caret" aria-hidden />
        </p>
        <ul
          className={`demo-fade absolute left-5 top-[4.1rem] z-10 w-40 overflow-hidden rounded-lg border border-line bg-surface py-1 text-[15px] shadow-[var(--pop-shadow)] ${fr.popup ? "opacity-100" : "pointer-events-none translate-y-1 opacity-0"}`}
          aria-hidden
        >
          {w.options.map((o, k) => (
            <li key={o} className={`flex items-center gap-2 px-2.5 py-1 ${k === fr.active ? "bg-accent-soft text-accent" : ""}`}>
              <span className="w-3 font-sans text-[10px] text-muted">{k + 1}</span>
              {o}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ─────────── 2 · A4 pagination ─────────── */
const LINE_W = [92, 100, 96, 100, 88, 100, 97, 60, 100, 94, 100, 72];
const PER_PAGE = 8;
const P_FRAMES = [600, ...LINE_W.map(() => 260), 2200];

function PagesDemo() {
  const { ref, step } = useTimeline(P_FRAMES);
  const n = Math.min(step, LINE_W.length);
  const pages = n > PER_PAGE ? 2 : 1;
  const page = (from: number, to: number, num: number, show: boolean) => (
    <div className={`demo-fade relative h-[170px] w-[120px] rounded-[3px] bg-paper px-3 pt-4 shadow-[var(--sheet-shadow)] ${show ? "opacity-100" : "translate-x-3 opacity-0"}`}>
      {LINE_W.slice(from, to).map((w, k) => (
        <div key={k} className="mb-[7px] h-[5px] rounded-full bg-ink/70" style={{ width: `${w}%`, animation: "litma-line 0.25s ease-out both" }} />
      ))}
      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[8px] text-muted">{num}</span>
    </div>
  );
  return (
    <div ref={ref} aria-hidden className="demo-stage flex flex-col items-center justify-center gap-3">
      <div className="flex items-start gap-4">
        {page(0, Math.min(n, PER_PAGE), 1, true)}
        {page(PER_PAGE, Math.max(PER_PAGE, n), 2, pages === 2)}
      </div>
      <span className="rounded-full bg-surface px-2.5 py-0.5 text-[11px] text-muted shadow-sm">
        A4 · {pages} {pages === 1 ? "page" : "pages"}
      </span>
    </div>
  );
}

/* ─────────── 3 · Screenplay formatting ─────────── */
const S_FRAMES = [700, 1100, 900, 1000, 900, 1100, 2400];

function ScreenplayDemo() {
  const { ref, step } = useTimeline(S_FRAMES);
  const sceneTyped = step >= 1;
  const sceneSet = step >= 2;
  const cueTyped = step >= 3;
  const cueSet = step >= 4;
  const speech = step >= 5;
  return (
    <div ref={ref} aria-hidden className="demo-stage grid place-items-center px-6">
      <div className="w-full max-w-[19rem] rounded-md bg-paper px-5 py-5 text-[13px] shadow-[var(--sheet-shadow)]" style={{ fontFamily: "'Noto Sans Malayalam'" }}>
        <div className="h-6">
          {sceneTyped && !sceneSet && (
            <span className="font-mono text-[12px] text-muted">
              int resort pakal<span className="demo-caret" />
            </span>
          )}
          <div className={`demo-fade flex items-baseline justify-between ${sceneSet ? "opacity-100" : "-translate-y-1 opacity-0"}`} style={{ display: sceneSet ? "flex" : "none" }}>
            <b className="underline underline-offset-2">Int./Resort</b>
            <span className="text-muted">പകൽ</span>
          </div>
        </div>
        <p className={`demo-fade mt-2 text-[12px] text-muted ${sceneSet ? "opacity-100" : "opacity-0"}`}>മുറിയുടെ ജനലിലൂടെ കടൽ.</p>
        <div className="mt-3 grid min-h-12 grid-cols-[5.5rem_1fr] gap-3">
          <div className={`demo-fade text-right font-semibold ${cueSet ? "translate-x-0 opacity-100" : cueTyped ? "translate-x-24 opacity-100" : "opacity-0"}`}>
            ഡെന്നി{cueTyped && !cueSet && <span className="demo-caret" />}
          </div>
          <div className={`demo-fade ${speech ? "opacity-100" : "translate-y-1 opacity-0"}`}>
            സമയമെത്രായടാ?
            {speech && <span className="demo-caret" />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── 4 · Works become a book ─────────── */
const B_FRAMES = [600, 500, 500, 500, 900, 900, 2200];

function BookDemo() {
  const { ref, step } = useTimeline(B_FRAMES);
  const chapters = ["അദ്ധ്യായം 1", "അദ്ധ്യായം 2", "അദ്ധ്യായം 3"];
  const bound = step >= 4;
  return (
    <div ref={ref} aria-hidden className="demo-stage grid place-items-center">
      <div className="relative h-[150px] w-[108px]">
        {chapters.map((c, k) => {
          const shown = step >= k + 1;
          const fan = bound ? 0 : (k - 1) * 70;
          return (
            <div
              key={c}
              className="demo-fade absolute inset-0 rounded-[3px] bg-paper px-2 pt-3 shadow-[var(--sheet-shadow)]"
              style={{ transform: `translateX(${shown ? fan : fan + 30}px) rotate(${bound ? 0 : (k - 1) * 4}deg)`, opacity: shown ? 1 : 0 }}
            >
              <div className="text-[9px] font-semibold text-highlight">{c}</div>
              {[90, 100, 84, 100, 70].map((w, j) => (
                <div key={j} className="mt-[6px] h-[3px] rounded-full bg-ink/50" style={{ width: `${w}%` }} />
              ))}
            </div>
          );
        })}
        <div
          className="demo-fade absolute inset-0 flex flex-col justify-end rounded-[3px] bg-primary p-2.5 text-primary-ink shadow-[var(--pop-shadow)]"
          style={{ opacity: step >= 5 ? 1 : 0, transform: step >= 5 ? "none" : "translateY(14px)" }}
        >
          <div className="text-[11px] font-bold leading-tight" style={{ fontFamily: "'Anek Malayalam'" }}>
            കടൽ കാണാത്ത വീട്
          </div>
          <div className="mt-0.5 text-[8px] opacity-80">അനു മേനോൻ</div>
        </div>
      </div>
      <span
        className={`demo-fade absolute bottom-4 right-4 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-ink ${step >= 6 ? "opacity-100" : "translate-y-2 opacity-0"}`}
      >
        <FileDown size={12} /> PDF ready <Check size={12} />
      </span>
    </div>
  );
}


/* ─────────── 5 · AI companion ─────────── */
const AI_BEFORE = "അവൾ പതുക്കെ നടന്നു പോയി.";
const AI_AFTER = "ഒച്ചയുണ്ടാക്കാതെ അവൾ ഇടവഴിയിലൂടെ നടന്നകന്നു.";
const AI_STREAM = Array.from({ length: 12 }, (_, k) => k);
const AI_FRAMES = [700, 700, 600, ...AI_STREAM.map(() => 110), 900, 700, 2200];

function AIDemo() {
  const { ref, step } = useTimeline(AI_FRAMES);
  const selected = step >= 1;
  const asked = step >= 2;
  const streamed = Math.max(0, Math.min(AI_STREAM.length, step - 2));
  const shown = AI_AFTER.slice(0, Math.ceil((AI_AFTER.length * streamed) / AI_STREAM.length));
  const ready = step >= 3 + AI_STREAM.length;
  const accepted = step >= 4 + AI_STREAM.length;
  return (
    <div ref={ref} aria-hidden className="demo-stage grid place-items-center px-5">
      <div className="w-full max-w-[20rem]">
        <div className="rounded-md bg-paper px-4 py-3 text-[14px] leading-relaxed shadow-[var(--sheet-shadow)]" style={{ fontFamily: "'Noto Serif Malayalam'" }}>
          പടിവാതിൽ ചാരി.{" "}
          <span className={`rounded-sm transition-colors duration-300 ${accepted ? "bg-highlight-soft" : selected ? "bg-accent-soft" : ""}`}>{accepted ? AI_AFTER : AI_BEFORE}</span>
        </div>
        <div className={`demo-fade mt-2.5 rounded-lg border border-line bg-surface p-2.5 text-[12px] shadow-[var(--sheet-shadow)] ${asked && !accepted ? "opacity-100" : "translate-y-1 opacity-0"}`}>
          <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-accent">
            <Sparkles size={12} /> മിനുക്കുക · Polish
          </div>
          <p className="min-h-9 leading-relaxed" style={{ fontFamily: "'Noto Serif Malayalam'" }}>
            {shown}
            {asked && !ready && <span className="demo-caret" />}
          </p>
          <div className={`demo-fade mt-1.5 flex gap-1.5 ${ready ? "opacity-100" : "opacity-0"}`}>
            <span className={`rounded-md px-2 py-0.5 font-semibold ${step >= 3 + AI_STREAM.length ? "bg-primary text-primary-ink" : ""}`}>Replace</span>
            <span className="rounded-md border border-line px-2 py-0.5">Insert below</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── 6 · Dictionary ─────────── */
const SYN = ["വർഷം", "മാരി", "വൃഷ്ടി"];
const D_FRAMES = [700, 800, 500, 400, 400, 400, 900, 900, 2000];

function DictionaryDemo() {
  const { ref, step } = useTimeline(D_FRAMES);
  const selected = step >= 1;
  const open = step >= 2 && step < 7;
  const syn = Math.max(0, Math.min(SYN.length, step - 2));
  const picking = step === 6;
  const swapped = step >= 7;
  return (
    <div ref={ref} aria-hidden className="demo-stage grid place-items-center px-5">
      <div className="relative w-full max-w-[20rem]">
        <div className="rounded-md bg-paper px-4 py-3 text-[15px] leading-relaxed shadow-[var(--sheet-shadow)]" style={{ fontFamily: "'Noto Serif Malayalam'" }}>
          രാത്രി മുഴുവൻ{" "}
          <span className={`rounded-sm px-0.5 transition-colors duration-300 ${swapped ? "bg-highlight-soft" : selected ? "bg-accent-soft" : ""}`}>{swapped ? "മാരി" : "മഴ"}</span> പെയ്തു.
        </div>
        <div className={`demo-fade absolute left-4 right-4 top-[3.6rem] z-10 rounded-lg border border-line bg-surface p-3 text-[12px] shadow-[var(--pop-shadow)] ${open ? "opacity-100" : "pointer-events-none translate-y-1 opacity-0"}`}>
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] font-bold" style={{ fontFamily: "'Noto Serif Malayalam'" }}>
              മഴ <span className="text-[11px] font-normal text-muted">നാമം</span>
            </span>
            <span className="flex items-center gap-1 text-muted">
              <BookA size={12} /> rain
            </span>
          </div>
          <p className="mt-1 text-muted" style={{ fontFamily: "'Noto Serif Malayalam'" }}>
            ആകാശത്തുനിന്നു പെയ്യുന്ന വെള്ളം
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="text-[11px] text-muted">പര്യായം:</span>
            {SYN.slice(0, syn).map((w) => (
              <span key={w} className={`rise-in rounded-full border px-2 py-px ${picking && w === "മാരി" ? "border-accent bg-accent-soft text-accent" : "border-line"}`} style={{ fontFamily: "'Noto Serif Malayalam'" }}>
                {w}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const DEMOS = [
  { title: "Pick the right word", body: "Type Manglish; Litma offers the Malayalam spellings as you go. Space takes the first, 1–7 picks another.", Demo: ManglishDemo },
  { title: "Pages fill like paper", body: "Text flows onto real A4 sheets with page numbers, so you always know how long the work really is.", Demo: PagesDemo },
  { title: "Scripts set themselves", body: "Scene headings, cast and two-column dialogue snap into the Malayalam screenplay layout as you type.", Demo: ScreenplayDemo },
  { title: "An AI companion beside you", body: "Select a passage and ask to continue, polish or translate. The answer streams in, and you choose whether it replaces your text — with your own Claude, GPT or Gemini key, or any AI assistant over MCP.", Demo: AIDemo },
  { title: "Dictionary one click away", body: "Select a word for its meaning, English sense and synonyms from Olam’s open datasets — tap a synonym to swap it in.", Demo: DictionaryDemo },
  { title: "Works become a book", body: "Gather chapters, add a cover and front pages, and export one print-ready PDF.", Demo: BookDemo },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16" aria-labelledby="how-title">
      <h2 id="how-title" className="text-2xl font-bold">
        എങ്ങനെ? · How it works
      </h2>
      <p className="mt-2 max-w-2xl text-muted">A look inside the desk — the small things Litma does while you write.</p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {DEMOS.map(({ title, body, Demo }) => (
          <article key={title} className="demo-card">
            <Demo />
            <div className="p-5">
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
