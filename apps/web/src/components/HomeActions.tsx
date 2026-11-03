"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Download, PenLine } from "lucide-react";
import { useUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { store } from "@/lib/store";
import type { Profile } from "@/lib/types";
import { Avatar } from "./AppHeader";
import { DownloadNavLink } from "./landing/DesktopDownload";
import { useInDesktopApp } from "@/lib/release";
import { useT } from "@/i18n/react";

/**
 * Landing-page buttons that know who is looking:
 *  - signed out: one clear path in (Create account), with Sign in for returning writers
 *  - signed in: straight back to the desk — no sign-in buttons
 *  - local mode (no Supabase): open the desk
 */
type State = "loading" | "guest" | "writer" | "local";

function useVisitor(): [State, Profile | null] {
  const user = useUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    if (user) store.getProfile().then(setProfile).catch(() => {});
  }, [user]);
  if (!isSupabaseConfigured) return ["local", null];
  if (user === undefined) return ["loading", null];
  return [user ? "writer" : "guest", profile];
}

export function HomeNav() {
  const [state, profile] = useVisitor();
  const router = useRouter();
  // If Supabase falls back to the Site URL (redirect URL not allow-listed), a sign-in link
  // lands here with ?code= or #access_token. Finish signing in and go to the desk.
  useEffect(() => {
    const { search, hash } = window.location;
    if (/[?&]code=/.test(search) || /access_token=|error_description=/.test(hash)) {
      const q = new URLSearchParams(search);
      if (!q.has("next")) q.set("next", "/desk/");
      router.replace(`/auth/callback/?${q.toString()}${hash}`);
    }
  }, [router]);
  if (state === "loading") return <div className="h-10 w-40" aria-hidden />;
  if (state === "guest")
    return (
      <>
        <DownloadNavLink className="max-sm:!hidden" />
        <Link href="/login/" className="btn btn-ghost">
          Sign in
        </Link>
        <Link href="/signup/" className="btn btn-primary">
          Create account
        </Link>
      </>
    );
  return (
    <>
      <DownloadNavLink />
      <Link href="/desk/" className="btn btn-primary">
        <PenLine size={16} /> <span className="hidden sm:inline">Open desk</span>
        <span className="sm:hidden">Desk</span>
      </Link>
      {state === "writer" && (
        <Link href="/profile/" className="ml-1 rounded-full ring-offset-2 ring-offset-canvas hover:ring-2 hover:ring-accent" aria-label="Your profile">
          <Avatar profile={profile} size={34} />
        </Link>
      )}
    </>
  );
}

/** "Get the app" card under the hero buttons (hidden inside the desktop app). */
function HeroDownload() {
  const t = useT();
  const inApp = useInDesktopApp();
  if (inApp) return null;
  return (
    <Link
      href="/download/"
      className="group mt-8 inline-flex items-center gap-3 rounded-2xl border border-line bg-surface/90 px-4 py-3 text-sm font-bold text-ink transition hover:border-violet/40 hover:bg-surface"
    >
      <span className="grid size-8 place-items-center rounded-xl bg-violet text-night-ink">
        <Download size={16} aria-hidden />
      </span>
      {t("download.heroLink")}
      <ArrowRight size={16} className="transition group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

const PERKS = ["Free to use", "Syncs on all your devices", "Saves every keystroke"];

export function HeroActions() {
  const [state, profile] = useVisitor();
  const big =
    "group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-4 text-base font-bold text-primary-ink shadow-[var(--cta-shadow)] transition hover:-translate-y-0.5 hover:bg-violet hover:text-night-ink";
  if (state === "loading") return <div className="mt-9 h-[58px]" aria-hidden />;
  if (state === "guest")
    return (
      <div className="mt-9">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <Link href="/signup/" className={big}>
            Start writing for free <ArrowRight size={18} className="transition group-hover:translate-x-1" aria-hidden />
          </Link>
          <Link href="/login/" className="text-sm font-semibold text-muted hover:text-ink">
            Already have an account? <span className="text-violet-text underline decoration-2 underline-offset-4">Sign in</span>
          </Link>
        </div>
        <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-muted">
          {PERKS.map((p) => (
            <li key={p} className="flex items-center gap-1.5">
              <span className="grid size-5 place-items-center rounded-full bg-lime text-on-pop">
                <Check size={12} strokeWidth={3} aria-hidden />
              </span>
              {p}
            </li>
          ))}
        </ul>
        <div>
          <HeroDownload />
        </div>
      </div>
    );
  const name = profile?.pen_name || profile?.display_name;
  return (
    <div className="mt-9">
      {name && <p className="mb-4 text-base font-semibold text-muted">Welcome back, {name}.</p>}
      <Link href="/desk/" className={big}>
        Continue writing <ArrowRight size={18} className="transition group-hover:translate-x-1" aria-hidden />
      </Link>
      <div>
        <HeroDownload />
      </div>
    </div>
  );
}

/** The big closing line in the footer: starts a new writer, or takes a signed-in one back to the desk. */
export function FooterCta() {
  const [state] = useVisitor();
  const writer = state === "writer" || state === "local";
  const href = writer ? "/desk/" : "/signup/";
  return (
    <Link href={href} className="group inline-block" style={{ fontFamily: "var(--font-display)" }}>
      <span className="inline-block bg-linear-to-r from-lime via-sky to-violet bg-clip-text pb-3 text-[clamp(3rem,10vw,8rem)] font-extrabold leading-none tracking-tight text-transparent">
        എഴുതി തുടങ്ങാം.
      </span>
      <span className="mt-2 flex items-center gap-2 text-base font-bold text-muted transition group-hover:text-ink" style={{ fontFamily: "var(--font-landing)" }}>
        {writer ? "Open your desk" : "Start writing for free"}
        <ArrowRight size={18} className="transition group-hover:translate-x-1" aria-hidden />
      </span>
    </Link>
  );
}
