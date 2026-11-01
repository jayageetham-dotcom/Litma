"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { ColourField, LandingNav } from "./landing/LandingChrome";
import { DownloadNavLink } from "./landing/DesktopDownload";

const LINES: { ml: string; en?: string; by?: string }[] = [
  {
    ml: "“ഒരു എഴുത്തുകാരൻ എന്നാൽ തന്റെ സ്വന്തം ഏകാന്തതകളെ സാഹിത്യമാക്കുന്നവനാണ്. ആ ഏകാന്തതയിൽ നിന്നാണ് ഏറ്റവും തീവ്രമായ കഥകൾ ജനിക്കുന്നത്.”",
    by: "എം. ടി. വാസുദേവൻ നായർ",
  },
  {
    ml: "“എഴുത്തുകാരനാവുക. വലിയ ബുദ്ധിയൊന്നും വേണ്ട. ചുമ്മാ എവിടെയെങ്കിലും കുത്തിയിരുന്ന് എഴുതിയാൽ മതി. അനുഭവങ്ങൾ ഇച്ചിരിപ്പിടിയോളം ഉണ്ടല്ലോ. അവനെയൊക്കെ കാച്ചിയാൽ മതി, എഴുതി. അങ്ങനെ ഞാൻ എഴുത്തുകാരനായി.”",
    by: "വൈക്കം മുഹമ്മദ് ബഷീർ",
  },
];

/** Shared frame for sign-in, sign-up and password screens, in the home page's colourful style (always light). */
export function AuthShell({
  children,
  line = 0,
  switchTo,
  quote = true,
}: {
  children: React.ReactNode;
  line?: number;
  /** the other way in, shown in the nav pill (e.g. Create account on the sign-in screen) */
  switchTo?: { href: string; label: string };
  /** false: one centred card, no quote (callback, password reset) */
  quote?: boolean;
}) {
  const l = LINES[line % LINES.length];
  const display = { fontFamily: "var(--font-display)" };
  return (
    <div className="landing relative min-h-dvh overflow-x-clip bg-mist">
      <ColourField />
      <LandingNav
        links={false}
        right={
          <>
            <DownloadNavLink className="max-sm:!hidden" />
            {switchTo && (
              <Link href={switchTo.href} className="btn btn-ghost">
                {switchTo.label}
              </Link>
            )}
          </>
        }
      />
      <main className={`relative mx-auto grid items-center gap-14 px-5 pb-20 pt-28 md:pt-36 ${quote ? "max-w-6xl lg:grid-cols-[minmax(0,27rem)_1fr] lg:gap-20" : "max-w-md"}`}>
        {/* the form sits on a little stack of coloured sheets, like the demo on the home page */}
        <div className="relative w-full">
          <div aria-hidden className="absolute inset-0 translate-x-3 translate-y-4 rotate-2 rounded-[2rem] bg-lime" />
          <div aria-hidden className="absolute inset-0 -translate-x-2 translate-y-2 -rotate-1 rounded-[2rem] bg-violet" />
          <div className="relative rounded-[2rem] bg-surface p-7 shadow-[var(--pop-lift-shadow)] sm:p-9 [&_h1]:text-[2rem] [&_h1]:font-extrabold [&_h1]:leading-tight [&_h1]:tracking-tight [&_h1]:[font-family:var(--font-display)]">
            {children}
          </div>
        </div>

        {quote && (
          <aside aria-hidden className="relative hidden overflow-hidden rounded-[2.5rem] bg-night px-12 pb-14 pt-16 text-night-ink lg:block">
            <div className="dot-grid absolute inset-0 text-night-ink/[0.04]" />
            <div className={`absolute -right-32 -top-32 size-72 rounded-full blur-3xl ${line % 2 ? "bg-coral/15" : "bg-violet/25"}`} />
            <div className="absolute -bottom-36 -left-28 size-72 rounded-full bg-lime/10 blur-3xl" />
            <span className="relative block select-none text-[7rem] font-extrabold leading-[0.6] text-coral" style={display}>
              “
            </span>
            <p className={`relative mt-6 ${l.ml.length > 80 ? "text-[1.35rem] leading-[1.75]" : "text-[1.9rem] leading-[1.6]"} font-medium`} style={display}>
              {l.ml.replace(/^“|”$/g, "")}
            </p>
            {l.by && (
              <p className="relative mt-8 flex items-center gap-3 text-lg font-bold text-lime" style={display}>
                <span className="h-0.5 w-10 rounded-full bg-lime" />
                {l.by}
              </p>
            )}
            {l.en && <p className="relative mt-3 text-sm text-night-ink/70">{l.en}</p>}
          </aside>
        )}
      </main>
    </div>
  );
}

export function Field({ label, hint, type, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const [shown, setShown] = useState(false);
  const isPassword = type === "password";
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {isPassword ? (
        <span className="relative block">
          <input className="field !pr-11" type={shown ? "text" : "password"} {...props} />
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
            aria-pressed={shown}
            title={shown ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-1.5 my-auto grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-subtle hover:text-ink"
          >
            {shown ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </span>
      ) : (
        <input className="field" type={type} {...props} />
      )}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Notice({ kind, children }: { kind: "error" | "info"; children: React.ReactNode }) {
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`rounded-2xl px-4 py-2.5 text-sm ${kind === "error" ? "bg-danger/10 text-danger" : "bg-accent-soft text-accent"}`}>
      {children}
    </p>
  );
}

export function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="btn btn-outline w-full justify-center !py-3">
      <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      Continue with Google
    </button>
  );
}
