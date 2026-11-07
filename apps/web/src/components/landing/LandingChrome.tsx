import Link from "next/link";
import { Logo } from "@/components/Logo";
import { FooterCta, HomeNav } from "@/components/HomeActions";

const NAV = [
  { href: "/#types", label: "Writing types" },
  { href: "/#how", label: "How it works" },
  { href: "/#desk", label: "Features" },
  { href: "/help/", label: "Help" },
];

/**
 * Floating pill nav for the public pages (home, download). `right` replaces the
 * session-aware buttons, e.g. on sign-in and sign-up screens.
 */
export function LandingNav({ right, links = true }: { right?: React.ReactNode; links?: boolean }) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:pt-[calc(env(safe-area-inset-top)+1rem)]">
      {/* same width and side padding as the page content (max-w-7xl, px-5 / md:px-10), so the pill lines up with the text below */}
      <div className="mx-auto max-w-7xl px-3 sm:px-5 md:px-10">
      <nav aria-label="Main" className="landing-nav flex items-center justify-between gap-2 rounded-full border border-line py-1.5 pl-4 pr-1.5 shadow-[var(--pop-chip-shadow)] sm:py-2 sm:pl-5 sm:pr-2">
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
      </div>
    </header>
  );
}

/** Soft colour fields and a dot grid behind a hero. */
export function ColourField() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="glow -left-56 -top-64 size-[48rem] [--glow:color-mix(in_srgb,var(--violet)_30%,transparent)]" />
      <div className="glow right-[-17rem] -top-4 size-[44rem] [--glow:color-mix(in_srgb,var(--coral)_30%,transparent)]" />
      <div className="glow bottom-[-19rem] left-[calc(33%-7rem)] size-[42rem] [--glow:color-mix(in_srgb,var(--lime)_50%,transparent)]" />
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
            <Link href="/help/" className="hover:text-lime">
              Help
            </Link>
            <Link href="/login/" className="hover:text-lime">
              Sign in
            </Link>
            <Link href="/privacy/" className="hover:text-lime">
              Privacy
            </Link>
            <Link href="/terms/" className="hover:text-lime">
              Terms
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
