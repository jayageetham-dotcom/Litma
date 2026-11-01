import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TryManglish } from "@/components/TryManglish";
import { TypesShowcase } from "@/components/landing/TypesShowcase";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { HeroActions, HomeNav } from "@/components/HomeActions";
import { DesktopDownload } from "@/components/landing/DesktopDownload";

/** Each feature carries the Malayalam word a writer would use for it. */
const FEATURES: { ml: string; title: string; body: React.ReactNode }[] = [
  { ml: "എഴുത്ത്", title: "Manglish or Malayalam", body: "Type “nammude naadu” and get നമ്മുടെ നാട്. Google Input Tools predictions, an offline engine, and your own keyboard all work." },
  { ml: "താൾ", title: "Real A4 pages", body: "Text flows onto separate printed-size pages with page numbers and running heads. Export print-ready PDFs." },
  { ml: "രൂപം", title: "സാഹിത്യരൂപങ്ങൾ, each set its own way", body: "Screenplays in the Malayalam two-column layout, poems with വൃത്തം metre marks, novels with chapters, features with pull quotes." },
  { ml: "കഥാലോകം", title: "Story World", body: "Characters, locations, props, a drag-and-drop beat board, timeline, research notes and scene and character reports for every work." },
  {
    ml: "നിഘണ്ടു",
    title: "Dictionary built in",
    body: (
      <>
        Malayalam–Malayalam, English–Malayalam, synonyms and opposites from{" "}
        <a href="https://olam.in/p/open" target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
          Olam’s open datasets
        </a>
        , one click from your text.
      </>
    ),
  },
  { ml: "പുസ്തകം", title: "Make it a book", body: "Gather works into a book with covers, title and copyright pages, a contents page with real page numbers, and export one PDF." },
  { ml: "കരുതൽ", title: "Never lose a line", body: "Every keystroke is saved on your device at once and synced to the cloud within seconds, even through a dropped connection." },
  { ml: "കൂട്ട്", title: "AI that reads along", body: "Ask Claude, GPT or Gemini to continue, polish or translate, or connect any AI assistant over MCP." },
];

export default function Home() {
  return (
    <div className="min-h-dvh overflow-x-clip">
      <header className="app-bar">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-5 py-2.5">
          <Logo />
          <nav className="flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <HomeNav />
          </nav>
        </div>
      </header>

      <main>
        {/* ── Hero: the headline is the page's one bold move; it settles like ink ── */}
        <section className="mx-auto max-w-6xl px-5 pb-24 pt-14 md:pb-32 md:pt-20">
          {/* the headline gets the full width; text and the live sheet sit side by side below it */}
          <h1 className="hero-ink text-ink" style={{ fontFamily: "var(--font-display)" }}>
            <span className="hero-line">എഴുതൂ,</span>
            <span className="hero-line" style={{ animationDelay: "140ms" }}>
              മലയാളത്തിൽ.
            </span>
          </h1>
          <div className="mt-10 grid items-start gap-14 md:mt-12 md:grid-cols-[1fr_1.05fr] md:gap-16">
          <div>
            <p className="max-w-[32rem] text-lg leading-relaxed text-muted">
              Litma is a writing desk for Malayalam literature. Write novels, short stories, poems, screenplays and features on real A4 pages, in Manglish or Malayalam.
            </p>
            <HeroActions />
          </div>

          {/* the live demo sits on the desk as a real sheet, with the next page peeking out behind it */}
          <div className="relative md:pl-6">
            <div aria-hidden className="absolute inset-x-10 -bottom-5 top-16 rotate-[3deg] rounded-sm bg-paper opacity-80 shadow-[var(--sheet-shadow)] max-md:hidden" />
            <div className="relative md:-rotate-[1.5deg] md:transition-transform md:duration-500 md:hover:rotate-0">
              <TryManglish />
            </div>
          </div>
          </div>
        </section>

        <section id="types" className="border-y border-line bg-surface py-20">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="max-w-3xl text-3xl font-bold leading-tight md:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
              ഒൻപത് സാഹിത്യരൂപങ്ങൾ · Nine writing types, each set the way it is printed
            </h2>
            <p className="mt-3 max-w-2xl text-muted">Pick a സാഹിത്യരൂപം (writing type) and Litma sets up the page, the typeface and the toolbar for it.</p>
            <div className="mt-12">
              <TypesShowcase />
            </div>
          </div>
        </section>

        <HowItWorks />

        {/* ── Features: the Malayalam word first, then what it means on the desk ── */}
        <section className="border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <h2 className="text-3xl font-bold md:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
              മേശപ്പുറത്ത് · On the desk
            </h2>
            <dl className="mt-12 grid gap-x-16 md:grid-cols-2">
              {FEATURES.map((f) => (
                <div key={f.title} className="grid gap-x-6 gap-y-2 border-t border-line py-7 sm:grid-cols-[10.5rem_1fr]">
                  <span aria-hidden className="text-[1.6rem] font-bold leading-tight text-ink" style={{ fontFamily: "var(--font-display)" }}>
                    {f.ml}
                  </span>
                  <div>
                    <dt className="text-lg font-semibold">{f.title}</dt>
                    <dd className="mt-1.5 leading-relaxed text-muted">{f.body}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <DesktopDownload variant="band" />
      </main>

      <footer className="border-t border-line bg-canvas">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-5 py-10">
          <div>
            <Logo />
            <div className="mt-1 text-sm text-muted">മലയാളം എഴുത്തുമേശ</div>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Footer">
            <Link href="/download/" className="text-muted hover:text-ink">
              Download
            </Link>
            <Link href="/dictionary/" className="text-muted hover:text-ink">
              Dictionary
            </Link>
            <Link href="/login/" className="text-muted hover:text-ink">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
