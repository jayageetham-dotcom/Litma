"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Download, PenLine } from "lucide-react";
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
        <DownloadNavLink />
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

/** "Get the app" link under the hero buttons (hidden inside the desktop app). */
function HeroDownload() {
  const t = useT();
  const inApp = useInDesktopApp();
  if (inApp) return null;
  return (
    <Link href="/download/" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-ink hover:text-accent">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-accent-soft text-accent">
        <Download size={14} aria-hidden />
      </span>
      {t("download.heroLink")} <ArrowRight size={14} aria-hidden />
    </Link>
  );
}

export function HeroActions() {
  const [state, profile] = useVisitor();
  const big = "btn !px-5 !py-3 !text-base";
  if (state === "loading") return <div className="mt-8 h-[52px]" aria-hidden />;
  if (state === "guest")
    return (
      <div className="mt-8">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link href="/signup/" className={`${big} btn-primary`}>
            Start writing for free <ArrowRight size={18} />
          </Link>
          <Link href="/login/" className="text-sm font-medium text-accent underline-offset-4 hover:underline">
            Already have an account? Sign in
          </Link>
        </div>
        <p className="mt-3 text-xs text-muted">Free to use. Your works stay in sync on all your devices.</p>
        <HeroDownload />
      </div>
    );
  const name = profile?.pen_name || profile?.display_name;
  return (
    <div className="mt-8">
      {name && <p className="mb-3 text-sm text-muted">Welcome back, {name}.</p>}
      <Link href="/desk/" className={`${big} btn-primary`}>
        Continue writing <ArrowRight size={18} />
      </Link>
      <div>
        <HeroDownload />
      </div>
    </div>
  );
}
