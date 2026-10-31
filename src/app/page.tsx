import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TryManglish } from "@/components/TryManglish";
import { TemplatePreview } from "@/components/TemplatePreview";
import { TEMPLATES } from "@/lib/templates";

const FEATURES = [
  ["Manglish or Malayalam", "Type “nammude naadu” and get നമ്മുടെ നാട്. Google Input Tools predictions, an offline engine, and your own keyboard all work."],
  ["Real A4 pages", "Text flows onto separate printed-size pages with page numbers and running heads. What you see is what prints and exports."],
  ["Forms that know their craft", "Screenplays in the Malayalam two-column layout, poems with വൃത്തം metre marks, novels with chapters, features with pull quotes."],
  ["AI that reads along", "Ask Claude or GPT to continue, polish or translate. Or connect Claude, ChatGPT or IBM Bob over MCP and let them leave suggestions in your inbox."],
  ["Never lose a line", "Autosave, version history, writing goals, focus and typewriter modes, export to PDF, Word, Markdown and text."],
];

export default function Home() {
  return (
    <div className="min-h-dvh">
      <div className="kasavu-rule" />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login/" className="btn btn-ghost">
            Sign in
          </Link>
          <Link href="/signup/" className="btn btn-outline hidden sm:inline-flex">
            Create account
          </Link>
          <Link href="/desk/" className="btn btn-primary">
            Start writing
          </Link>
        </nav>
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
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/desk/" className="btn btn-primary !px-5 !py-3 !text-base">
                Open your desk
              </Link>
              <Link href="#forms" className="btn btn-outline !px-5 !py-3 !text-base">
                See the forms
              </Link>
            </div>
          </div>
          <TryManglish />
        </section>

        <section id="forms" className="border-y border-line bg-desk-2/60 py-16">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="text-2xl font-bold">Nine forms, each set the way it is printed</h2>
            <p className="mt-2 max-w-2xl text-muted">Pick a form and Litma sets up the page, the typeface and the toolbar for it.</p>
            <div className="scrollbar-thin mt-8 flex gap-6 overflow-x-auto pb-4">
              {TEMPLATES.filter((t) => t.kind !== "blank").map((t) => (
                <div key={t.kind} className="shrink-0">
                  <TemplatePreview kind={t.kind} width={168} />
                  <div className="mt-3 font-semibold">{t.ml}</div>
                  <div className="text-sm text-muted">{t.en}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <dl className="grid gap-x-12 gap-y-9 md:grid-cols-2">
            {FEATURES.map(([t, d]) => (
              <div key={t} className="border-l-2 border-kasavu pl-5">
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
