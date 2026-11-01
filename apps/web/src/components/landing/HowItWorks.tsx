import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

/** A coloured bento card: a small stage with a demo on top, the title and text below. */
function Card({ fill, title, body, children, className = "", dark = false }: { fill: string; title: string; body: ReactNode; children: ReactNode; className?: string; dark?: boolean }) {
  return (
    <article className={`group flex flex-col overflow-hidden rounded-[2rem] p-3 transition duration-300 hover:-translate-y-1 ${fill} ${className}`}>
      <div className="relative grid min-h-[15rem] flex-1 place-items-center overflow-hidden rounded-[1.5rem] p-6">
        <div aria-hidden className={`dot-grid absolute inset-0 ${dark ? "text-night-ink/10" : "text-on-pop/10"}`} />
        <div className="relative w-full" aria-hidden>
          {children}
        </div>
      </div>
      <div className={`px-4 pb-5 pt-3 ${dark ? "text-night-ink" : "text-on-pop"}`}>
        <h3 className="text-xl font-extrabold tracking-tight">{title}</h3>
        <p className={`mt-1.5 leading-relaxed ${dark ? "text-night-ink/75" : "text-on-pop/75"}`}>{body}</p>
      </div>
    </article>
  );
}

/** a floating white slip inside a demo */
const chip = "rounded-2xl bg-surface text-ink shadow-[var(--pop-chip-shadow)]";
const ml = { fontFamily: "var(--font-display)" };

export function HowItWorks() {
  return (
    <section id="how" className="py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-5 md:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-violet-text">02 · How it works</p>
            <h2 className="text-4xl font-extrabold leading-[1.15] md:text-6xl" style={ml}>
              എങ്ങനെ? <span className="text-ink/40">A look inside the desk.</span>
            </h2>
          </div>
          <p className="max-w-sm text-muted">The small things Litma does while you write, so you can keep your eyes on the story.</p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-6">
          <Card className="md:col-span-3" fill="bg-violet" dark title="Pick the right word" body="Type Manglish; Litma offers the Malayalam spellings as you go. Space takes the first, 1–7 picks another.">
            <div className="mx-auto max-w-xs">
              <div className="rounded-2xl bg-night px-4 py-3 font-mono text-sm text-lime">
                nammude
                <span className="typing-caret" />
              </div>
              <div className={`${chip} ml-8 mt-2 w-48 p-1.5 text-lg transition group-hover:translate-x-2`} style={ml}>
                {["നമ്മുടെ", "നമ്മൂടെ", "നമുടെ"].map((w, i) => (
                  <div key={w} className={`flex items-center gap-3 rounded-xl px-3 py-1.5 ${i === 0 ? "bg-lime text-on-pop" : ""}`}>
                    <span className={`font-mono text-[10px] ${i === 0 ? "text-on-pop/60" : "text-muted"}`}>{i + 1}</span>
                    {w}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="md:col-span-3" fill="bg-lime" title="Pages fill like paper" body="Text flows onto real A4 sheets with page numbers, so you always know how long the work really is.">
            <div className="relative mx-auto h-48 w-64 [--spread:70px] [--tilt:6deg] group-hover:[--spread:86px] group-hover:[--tilt:9deg]">
              {[2, 1, 0].map((n) => (
                <div
                  key={n}
                  className="absolute left-1/2 top-0 flex h-44 w-32 flex-col gap-1.5 rounded-lg bg-paper p-4 shadow-xl transition-transform duration-500 [transform:translateX(calc(-50%_+_var(--i)*var(--spread)))_rotate(calc(var(--i)*var(--tilt)))]"
                  style={{ ["--i" as string]: n - 1 }}
                >
                  {Array.from({ length: 9 }).map((_, k) => (
                    <div key={k} className="h-1 rounded-full bg-ink/15" style={{ width: k === 8 ? "50%" : "100%" }} />
                  ))}
                  <span className="mt-auto text-center font-mono text-[9px] text-muted">{3 - n}</span>
                </div>
              ))}
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-night px-3 py-1 font-mono text-[11px] text-night-ink">A4 · 3 pages</span>
            </div>
          </Card>

          <Card className="md:col-span-2" fill="bg-sky" title="Scripts set themselves" body="Scene headings, cast and two-column dialogue snap into the Malayalam screenplay layout as you type.">
            <div className={`${chip} p-4 text-[13px]`} style={ml}>
              <p className="mb-3 inline-block rounded-md bg-night px-2 py-0.5 text-[11px] font-bold text-night-ink">രംഗം 4 · കടൽത്തീരം · പകൽ</p>
              <div className="grid grid-cols-[3.5rem_1fr] gap-x-2 gap-y-2">
                <span className="font-bold">മീര</span>
                <span>നോക്ക്, തിര!</span>
                <span className="font-bold">അരുൺ</span>
                <span>ഞാൻ കണ്ടു.</span>
              </div>
            </div>
          </Card>

          <Card
            className="md:col-span-2"
            fill="bg-night"
            dark
            title="An AI companion beside you"
            body="Select a passage and ask to continue, polish or translate. You choose whether the answer replaces your text. Use your own Claude, GPT or Gemini key, or any AI assistant over MCP."
          >
            <div className={`${chip} p-4 text-[14px]`} style={ml}>
              <p>
                <mark className="rounded bg-coral/25 px-0.5 text-ink">പടിവാതിൽ ചാരി. അവൾ പതുക്കെ നടന്നു പോയി.</mark>
              </p>
              <div className="mt-3 flex gap-1.5 text-[11px] font-bold" style={{ fontFamily: "var(--font-landing)" }}>
                {["Continue", "Polish", "Translate"].map((a, i) => (
                  <span key={a} className={`flex items-center gap-1 rounded-full px-2.5 py-1 ${i === 0 ? "bg-coral text-on-pop" : "bg-subtle text-muted"}`}>
                    {i === 0 && <Sparkles size={12} />}
                    {a}
                  </span>
                ))}
              </div>
            </div>
          </Card>

          <Card className="md:col-span-2" fill="bg-coral" title="Dictionary one click away" body="Select a word for its meaning, English sense and synonyms from Olam's open datasets. Tap a synonym to swap it in.">
            <div style={ml}>
              <div className={`${chip} px-4 py-3 text-[15px]`}>
                രാത്രി മുഴുവൻ <span className="rounded bg-lime px-1 font-bold text-on-pop">മഴ</span> പെയ്തു.
              </div>
              <div className={`${chip} ml-10 mt-2 p-4 transition group-hover:-translate-y-1`}>
                <p className="flex items-baseline gap-2">
                  <span className="text-xl font-extrabold">മഴ</span>
                  <span className="text-[11px] font-semibold text-muted" style={{ fontFamily: "var(--font-landing)" }}>
                    noun · rain
                  </span>
                </p>
                <div className="mt-2 flex gap-1.5 text-[13px]">
                  {["വർഷം", "വൃഷ്ടി"].map((s) => (
                    <span key={s} className="rounded-full bg-sky/50 px-2.5 py-0.5">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card className="md:col-span-6" fill="bg-tangerine" title="Works become a book" body="Gather chapters, add a cover and front pages, and export one print-ready PDF with a real contents page.">
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
              {["Cover", "Title page", "Contents", "Chapter 1", "Chapter 2"].map((l, i) => (
                <div key={l} className="flex flex-col items-center gap-2">
                  <div
                    className={`grid h-28 w-20 place-items-center rounded-md shadow-lg transition duration-300 group-hover:-translate-y-1 ${i === 0 ? "bg-night text-night-ink" : "bg-paper text-ink"}`}
                    style={{ transitionDelay: `${i * 50}ms` }}
                  >
                    {i === 0 ? (
                      <span className="px-2 text-center text-sm font-extrabold leading-tight" style={ml}>
                        കടൽ
                        <br />
                        <span className="text-lime">കാണാത്ത</span>
                        <br />
                        വീട്
                      </span>
                    ) : (
                      <div className="w-12 space-y-1">
                        {Array.from({ length: 6 }).map((_, k) => (
                          <div key={k} className="h-1 rounded-full bg-ink/15" />
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-on-pop/75">{l}</span>
                </div>
              ))}
              <span className="rounded-full bg-night px-4 py-2 font-mono text-xs text-night-ink">→ book.pdf</span>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
