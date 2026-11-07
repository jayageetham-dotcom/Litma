import Link from "next/link";
import { LandingFooter, LandingNav } from "@/components/landing/LandingChrome";

export type LegalSection = { id: string; title: string; body: React.ReactNode };

/** Privacy Policy and Terms: a calm reading page in the public pages' light style. */
export function LegalPage({ title, updated, intro, sections, other }: { title: string; updated: string; intro: React.ReactNode; sections: LegalSection[]; other: { href: string; label: string } }) {
  return (
    <div className="landing min-h-dvh bg-canvas text-ink">
      <LandingNav />
      <main className="mx-auto max-w-3xl px-5 pb-20 pt-32 md:px-10 md:pt-36">
        <p className="text-sm font-semibold text-accent">Litma</p>
        <h1 className="mt-1 text-4xl font-bold tracking-tight md:text-5xl" style={{ fontFamily: "var(--font-landing)" }}>
          {title}
        </h1>
        <p className="mt-3 text-sm text-muted">Last updated: {updated}</p>
        <div className="legal mt-8 text-[16px] leading-relaxed">{intro}</div>

        <nav aria-label="On this page" className="mt-8 rounded-[14px] border border-line bg-surface p-5">
          <p className="text-sm font-semibold">On this page</p>
          <ol className="mt-2 grid gap-1 text-sm text-muted sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="hover:text-accent">
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="mt-10 scroll-mt-28">
            <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-landing)" }}>
              {i + 1}. {s.title}
            </h2>
            <div className="legal mt-3 text-[16px] leading-relaxed">{s.body}</div>
          </section>
        ))}

        <p className="mt-12 border-t border-line pt-6 text-sm text-muted">
          See also our{" "}
          <Link href={other.href} className="font-semibold text-accent underline underline-offset-2">
            {other.label}
          </Link>
          . Questions: <a href="mailto:support@getlitma.in" className="font-semibold text-accent underline underline-offset-2">support@getlitma.in</a>
        </p>
      </main>
      <LandingFooter />
    </div>
  );
}
