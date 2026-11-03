import { TryManglish } from "@/components/TryManglish";
import { TypesShowcase } from "@/components/landing/TypesShowcase";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Marquee } from "@/components/landing/Marquee";
import { HeroActions } from "@/components/HomeActions";
import { ColourField, LandingFooter, LandingNav } from "@/components/landing/LandingChrome";
import { DesktopDownload } from "@/components/landing/DesktopDownload";
import { DEFAULT_DESCRIPTION, SITE, SITE_NAME, SITE_NAME_ML, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ path: "/" });

/** Structured data so search engines know Litma is a writing app, who makes it and in which languages. */
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE}/#organization`,
      name: SITE_NAME,
      alternateName: SITE_NAME_ML,
      url: `${SITE}/`,
      logo: `${SITE}/icons/icon-512.png`,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE}/#website`,
      name: SITE_NAME,
      alternateName: SITE_NAME_ML,
      url: `${SITE}/`,
      inLanguage: ["ml", "en"],
      publisher: { "@id": `${SITE}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE}/#app`,
      name: SITE_NAME,
      alternateName: SITE_NAME_ML,
      description: DEFAULT_DESCRIPTION,
      url: `${SITE}/`,
      image: `${SITE}/og-image.jpg`,
      applicationCategory: "LifestyleApplication",
      applicationSubCategory: "Writing",
      operatingSystem: "Web, macOS, Windows",
      inLanguage: ["ml", "en"],
      downloadUrl: `${SITE}/download/`,
      publisher: { "@id": `${SITE}/#organization` },
    },
  ],
};

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

export default function Home() {
  return (
    <div className="landing min-h-dvh overflow-x-clip bg-mist">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA).replace(/</g, "\\u003c") }} />
      <LandingNav />

      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden pb-24 pt-32 md:pb-32 md:pt-44">
          <ColourField />

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
                  <span aria-hidden className="absolute inset-x-[-0.08em] bottom-[0.12em] -z-10 h-[0.32em] -rotate-1 rounded-[0.12em] bg-lime" />
                  മലയാളത്തിൽ
                </span>
                <span className="sr-only">.</span>
                <span aria-hidden className="ml-[0.16em] inline-block size-[0.17em] rounded-full bg-coral align-baseline" />
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

      <LandingFooter />
    </div>
  );
}
