import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TryManglish } from "@/components/TryManglish";
import { TypesShowcase } from "@/components/landing/TypesShowcase";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Marquee } from "@/components/landing/Marquee";
import { FooterCta, HeroActions, HomeNav } from "@/components/HomeActions";
import { DesktopDownload } from "@/components/landing/DesktopDownload";

const display = { fontFamily: "var(--font-display)" };

/** Each feature carries the Malayalam word a writer would use for it, and a colour from the home palette. */
const FEATURES: { ml: string; title: string; body: React.ReactNode; dot: string; hover: string }[] = [
  { ml: "എഴുത്ത്", title: "Manglish or Malayalam", dot: "bg-violet", hover: "group-hover:text-violet", body: "Type “nammude naadu” and get നമ്മുടെ നാട്. Google Input Tools predictions, an offline engine, and your own keyboard all work." },
  { ml: "താൾ", title: "Real A4 pages", dot: "bg-coral", hover: "group-hover:text-coral", body: "Text flows onto separate printed-size pages with page numbers and running heads. Export print-ready PDFs." },
  { ml: "രൂപം", title: "സാഹിത്യരൂപങ്ങൾ, each set its own way", dot: "bg-sky", hover: "group-hover:text-sky", body: "Screenplays in the Malayalam two-column layout, poems with വൃത്തം metre marks, novels with chapters, features with pull quotes." },
  { ml: "കഥാലോകം", title: "Story World", dot: "bg-lime", hover: "group-hover:text-lime", body: "Characters, locations, props, a drag-and-drop beat board, timeline, research notes and scene and character reports for every work." },
  {
    ml: "നിഘണ്ടു",
    title: "Dictionary built in",
    dot: "bg-tangerine",
    hover: "group-hover:text-tangerine",
    body: (
      <>
        Malayalam–Malayalam, English–Malayalam, synonyms and opposites from{" "}
        <a href="https://olam.in/p/open" target="_blank" rel="noreferrer" className="font-semibold text-violet-text underline underline-offset-2 group-hover:text-lime">
          Olam’s open datasets
        </a>
        , one click from your text.
      </>
    ),
  },
  { ml: "പുസ്തകം", title: "Make it a book", dot: "bg-violet", hover: "group-hover:text-violet", body: "Gather works into a book with covers, title and copyright pages, a contents page with real page numbers, and export one PDF." },
  { ml: "കരുതൽ", title: "Never lose a line", dot: "bg-coral", hover: "group-hover:text-coral", body: "Every keystroke is saved on your device at once and synced to the cloud within seconds, even through a dropped connection." },
  { ml: "കൂട്ട്", title: "AI that reads along", dot: "bg-sky", hover: "group-hover:text-sky", body: "Ask Claude, GPT or Gemini to continue, polish or translate, or connect any AI assistant over MCP." },
];

const NAV = [
  { href: "#types", label: "Writing types" },
  { href: "#how", label: "How it works" },
  { href: "#desk", label: "Features" },
];

export default function Home() {
  return (
    <div className="landing min-h-dvh overflow-x-clip bg-mist" style={{ fontFamily: "var(--font-landing)" }}>
      {/* ── floating pill nav ── */}
      <header className="fixed inset-x-0 top-0 z-40 px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:px-4 sm:pt-[calc(env(safe-area-inset-top)+1rem)]">
        <nav aria-label="Main" className="bg-header mx-auto flex max-w-6xl items-center justify-between gap-2 rounded-full border border-line py-1.5 pl-4 pr-1.5 shadow-[var(--pop-chip-shadow)] sm:py-2 sm:pl-5 sm:pr-2 [&_.btn]:!rounded-full">
          <Logo />
          <div className="hidden items-center gap-7 text-sm font-semibold text-muted lg:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="transition hover:text-ink">
                {n.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5">
            <ThemeToggle className="max-sm:!hidden" />
            <HomeNav />
          </div>
        </nav>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden pb-24 pt-32 md:pb-32 md:pt-44">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -left-32 -top-40 size-[34rem] rounded-full bg-violet/30 blur-[110px]" />
            <div className="absolute right-[-10rem] top-20 size-[30rem] rounded-full bg-coral/30 blur-[110px]" />
            <div className="absolute bottom-[-12rem] left-1/3 size-[28rem] rounded-full bg-lime/50 blur-[120px] dark:bg-lime/20" />
            <div className="dot-grid absolute inset-0 text-ink/[0.06] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
          </div>

          <div className="relative mx-auto max-w-7xl px-5 md:px-10">
            <p className="mb-8 inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 py-1.5 pl-1.5 pr-4 text-xs font-bold text-muted backdrop-blur">
              <span className="rounded-full bg-lime px-2.5 py-1 text-on-pop" style={display}>
                മലയാളം
              </span>
              A writing desk for Malayalam literature
            </p>

            <h1 className="hero-ink font-extrabold tracking-tight text-ink" style={display}>
              <span className="hero-line">എഴുതൂ,</span>
              <span className="hero-line pb-2" style={{ animationDelay: "140ms" }}>
                <span className="relative isolate inline-block text-violet-text">
                  <span aria-hidden className="absolute inset-x-[-0.08em] bottom-[0.12em] -z-10 h-[0.32em] -rotate-1 rounded-[0.12em] bg-lime dark:bg-lime/35" />
                  മലയാളത്തിൽ
                </span>
                <span className="text-coral">.</span>
              </span>
            </h1>

            <div className="mt-10 grid items-start gap-16 lg:grid-cols-[1fr_1.05fr]">
              <div className="max-w-xl">
                <p className="text-lg leading-relaxed text-muted md:text-xl">
                  Litma is a writing desk for Malayalam literature. Write novels, short stories, poems, screenplays and features on <span className="font-bold text-ink">real A4 pages</span>, in Manglish or Malayalam.
                </p>
                <HeroActions />
              </div>
              <TryManglish />
            </div>
          </div>
        </section>

        <Marquee />

        <TypesShowcase />

        <HowItWorks />

        {/* ── Features: the Malayalam word first, then what it means on the desk ── */}
        <section id="desk" className="bg-surface py-24 md:py-32">
          <div className="mx-auto max-w-7xl px-5 md:px-10">
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-coral-text">03 · On the desk</p>
            <h2 className="text-4xl font-extrabold leading-[1.15] md:text-6xl" style={display}>
              മേശപ്പുറത്ത്. <span className="text-ink/40">Everything you need.</span>
            </h2>

            <div className="mt-14 grid gap-px overflow-hidden rounded-[2rem] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f, i) => (
                <article key={f.ml} className="group relative bg-surface p-7 transition-colors duration-300 hover:bg-night">
                  <div className="flex items-center justify-between">
                    <span aria-hidden className={`size-3 rounded-full ${f.dot} transition-transform duration-300 group-hover:scale-[2.2]`} />
                    <span aria-hidden className="font-mono text-xs text-muted group-hover:text-night-ink/50">
                      0{i + 1}
                    </span>
                  </div>
                  <p aria-hidden className={`mt-10 text-4xl font-extrabold text-ink transition-colors ${f.hover}`} style={display}>
                    {f.ml}
                  </p>
                  <h3 className="mt-3 font-bold text-ink group-hover:text-night-ink">{f.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted group-hover:text-night-ink/70">{f.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <DesktopDownload variant="pop" />
      </main>

      <footer className="on-night bg-night">
        <div className="mx-auto max-w-7xl px-5 pb-10 pt-20 md:px-10">
          <FooterCta />
          <div className="mt-16 flex flex-wrap items-end justify-between gap-6 border-t border-line pt-8">
            <div>
              <Logo />
              <p className="mt-2 text-sm text-muted" style={display}>
                മലയാളം എഴുത്തുമേശ
              </p>
            </div>
            <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold text-muted" aria-label="Footer">
              <Link href="/download/" className="hover:text-lime">
                Download
              </Link>
              <Link href="/dictionary/" className="hover:text-lime">
                Dictionary
              </Link>
              <Link href="/login/" className="hover:text-lime">
                Sign in
              </Link>
              <ThemeToggle />
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
