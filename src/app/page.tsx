import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TryManglish } from "@/components/TryManglish";
import { TypesShowcase } from "@/components/landing/TypesShowcase";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { HeroActions, HomeNav } from "@/components/HomeActions";

const FEATURES: [string, React.ReactNode][] = [
  ["Manglish or Malayalam", "Type “nammude naadu” and get നമ്മുടെ നാട്. Google Input Tools predictions, an offline engine, and your own keyboard all work."],
  ["Real A4 pages", "Text flows onto separate printed-size pages with page numbers and running heads. Export print-ready PDFs."],
  ["സാഹിത്യരൂപങ്ങൾ — each set its own way", "Screenplays in the Malayalam two-column layout, poems with വൃത്തം metre marks, novels with chapters, features with pull quotes."],
  ["Story World", "Characters, locations, props, a drag-and-drop beat board, timeline, research notes and scene and character reports for every work."],
  [
    "Dictionary built in",
    <>
      Malayalam–Malayalam, English–Malayalam, synonyms and opposites from{" "}
      <a href="https://olam.in/p/open" target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
        Olam’s open datasets
      </a>
      , one click from your text.
    </>,
  ],
  ["Make it a book", "Gather works into a book with covers, title and copyright pages, a contents page with real page numbers, and export one PDF."],
  ["Never lose a line", "Every keystroke is saved on your device at once and synced to the cloud within seconds, even through a dropped connection."],
  ["AI that reads along", "Ask Claude, GPT or Gemini to continue, polish or translate — or connect any AI assistant over MCP."],
];

export default function Home() {
  return (
    <div className="min-h-dvh">
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
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 md:grid-cols-[1.05fr_1fr] md:pt-16">
          <div>
            <h1 className="text-[3.2rem] font-extrabold leading-[1.15] text-ink md:text-[4.4rem]" style={{ fontFamily: "'Anek Malayalam'" }}>
              എഴുതൂ,
              <br />
              മലയാളത്തിൽ.
            </h1>
            <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-muted">
              Litma is a writing desk for Malayalam literature. Write novels, short stories, poems, screenplays and features on real A4 pages, in Manglish or Malayalam.
            </p>
            <HeroActions />
          </div>
          <TryManglish />
        </section>

        <section id="types" className="border-y border-line bg-subtle/50 py-16">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="text-2xl font-bold">ഒൻപത് സാഹിത്യരൂപങ്ങൾ · Nine writing types, each set the way it is printed</h2>
            <p className="mt-2 max-w-2xl text-muted">Pick a സാഹിത്യരൂപം (writing type) and Litma sets up the page, the typeface and the toolbar for it.</p>
            <div className="mt-10">
              <TypesShowcase />
            </div>
          </div>
        </section>

        <HowItWorks />

        <section className="mx-auto max-w-6xl border-t border-line px-5 py-16">
          <dl className="grid gap-x-12 gap-y-9 md:grid-cols-2">
            {FEATURES.map(([t, d]) => (
              <div key={t} className="border-l-2 border-highlight pl-5">
                <dt className="text-lg font-semibold">{t}</dt>
                <dd className="mt-1.5 leading-relaxed text-muted">{d}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
      <footer className="border-t border-line py-8 text-center text-sm text-muted">Litma · മലയാളം എഴുത്തുമേശ</footer>
    </div>
  );
}
