import Link from "next/link";
import { Logo } from "@/components/Logo";
import { FooterCta, HomeNav } from "@/components/HomeActions";

const NAV = [
  { href: "/#types", label: "Writing types" },
  { href: "/#how", label: "How it works" },
  { href: "/#desk", label: "Features" },
];

/**
 * Floating pill nav for the public pages (home, download). `right` replaces the
 * session-aware buttons, e.g. on sign-in and sign-up screens.
 */
export function LandingNav({ right, links = true }: { right?: React.ReactNode; links?: boolean }) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:px-4 sm:pt-[calc(env(safe-area-inset-top)+1rem)]">
      <nav aria-label="Main" className="bg-header mx-auto flex max-w-6xl items-center justify-between gap-2 rounded-full border border-line py-1.5 pl-4 pr-1.5 shadow-[var(--pop-chip-shadow)] sm:py-2 sm:pl-5 sm:pr-2">
        <Logo />
        {links && (
          <div className="hidden items-center gap-7 text-sm font-semibold text-muted lg:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="transition hover:text-ink">
                {n.label}
              </Link>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1 sm:gap-1.5">{right ?? <HomeNav />}</div>
      </nav>
    </header>
  );
}

/** Soft colour fields and a dot grid behind a hero. */
export function ColourField() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-32 -top-40 size-[34rem] rounded-full bg-violet/30 blur-[110px]" />
      <div className="absolute right-[-10rem] top-20 size-[30rem] rounded-full bg-coral/30 blur-[110px]" />
      <div className="absolute bottom-[-12rem] left-1/3 size-[28rem] rounded-full bg-lime/50 blur-[120px]" />
      <div className="dot-grid absolute inset-0 text-ink/[0.06] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
    </div>
  );
}

/** Night footer with the big gradient line. */
export function LandingFooter() {
  return (
    <footer className="on-night bg-night">
      <div className="mx-auto max-w-7xl px-5 pb-10 pt-20 md:px-10">
        <FooterCta />
        <div className="mt-16 flex flex-wrap items-end justify-between gap-6 border-t border-line pt-8">
          <div>
            <Logo />
            <p className="mt-2 text-sm text-muted" style={{ fontFamily: "var(--font-display)" }}>
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
          </nav>
        </div>
      </div>
    </footer>
  );
}
