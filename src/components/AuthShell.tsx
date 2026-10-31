import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const LINES: { ml: string; en?: string; by?: string }[] = [
  { ml: "ഓരോ വാക്കും ഒരു വാതിലാണ്.", en: "Every word is a door." },
  {
    ml: "“എഴുത്തുകാരനാവുക. വലിയ ബുദ്ധിയൊന്നും വേണ്ട. ചുമ്മാ എവിടെയെങ്കിലും കുത്തിയിരുന്ന് എഴുതിയാൽ മതി. അനുഭവങ്ങൾ ഇച്ചിരിപ്പിടിയോളം ഉണ്ടല്ലോ. അവനെയൊക്കെ കാച്ചിയാൽ മതി, എഴുതി. അങ്ങനെ ഞാൻ എഴുത്തുകാരനായി.”",
    by: "വൈക്കം മുഹമ്മദ് ബഷീർ",
  },
];

/** Shared frame for sign-in, sign-up and password screens. */
export function AuthShell({ children, line = 0 }: { children: React.ReactNode; line?: number }) {
  const l = LINES[line % LINES.length];
  return (
    <div className="min-h-dvh">
      <div className="kasavu-rule" />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="mx-auto grid max-w-6xl items-start gap-12 px-5 pb-16 pt-6 md:grid-cols-[minmax(0,26rem)_1fr] md:pt-12">
        <div className="rounded-xl bg-paper p-7" style={{ boxShadow: "var(--sheet-shadow)" }}>
          {children}
        </div>
        <aside className="relative hidden aspect-[210/297] max-h-[560px] justify-self-center bg-paper px-10 pt-14 md:block" style={{ boxShadow: "var(--sheet-shadow)" }} aria-hidden>
          <div className="kasavu-rule absolute inset-x-0 top-0" />
          <p className={`${l.ml.length > 80 ? "text-[1.15rem] leading-[1.9]" : "text-[1.6rem] leading-[1.7]"} text-ink`} style={{ fontFamily: "'Noto Serif Malayalam'" }}>
            {l.ml}
          </p>
          {l.by && (
            <p className="mt-5 text-right text-[0.95rem] font-semibold text-kasavu" style={{ fontFamily: "'Noto Serif Malayalam'" }}>
              — {l.by}
            </p>
          )}
          {l.en && <p className="mt-3 text-sm text-muted">{l.en}</p>}
          <span className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xs text-muted">1</span>
        </aside>
      </main>
    </div>
  );
}

export function Field({ label, hint, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm">{label}</span>
      <input className="field" {...props} />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Notice({ kind, children }: { kind: "error" | "info"; children: React.ReactNode }) {
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`rounded-lg px-3 py-2 text-sm ${kind === "error" ? "bg-danger/10 text-danger" : "bg-kayal-soft text-kayal"}`}>
      {children}
    </p>
  );
}

export function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="btn btn-outline w-full justify-center !py-2.5">
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
