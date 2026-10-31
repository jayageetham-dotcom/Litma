"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings, User } from "lucide-react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { store } from "@/lib/store";
import { getSupabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export function Avatar({ profile, size = 32 }: { profile: Pick<Profile, "avatar_url" | "display_name" | "pen_name"> | null; size?: number }) {
  const name = profile?.pen_name || profile?.display_name || "";
  const initial = name.trim().slice(0, 1).toUpperCase() || "ല";
  return profile?.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={profile.avatar_url} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="grid place-items-center rounded-full bg-kayal font-semibold text-kayal-ink" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden>
      {initial}
    </span>
  );
}

/** Top bar for signed-in pages: logo, theme, and the account menu. */
export function AppHeader({ children }: { children?: React.ReactNode }) {
  const router = useRouter();
  const [profile, setProfile] = useState<(Profile & { email?: string }) | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () => store.getProfile().then(setProfile).catch(() => {});
    load();
    window.addEventListener("litma:profile", load);
    return () => window.removeEventListener("litma:profile", load);
  }, []);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, [open]);

  return (
    <>
      <div className="kasavu-rule" />
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-2">
          {children}
          <Logo href="/desk/" />
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {store.isCloud() ? (
            <div className="relative" ref={ref}>
              <button className="ml-1 rounded-full ring-offset-2 ring-offset-desk hover:ring-2 hover:ring-kayal" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Account menu">
                <Avatar profile={profile} size={34} />
              </button>
              {open && (
                <div className="absolute right-0 top-11 z-50 w-60 rounded-xl border border-line bg-paper py-1.5 shadow-xl" role="menu">
                  <div className="border-b border-line px-4 pb-2.5 pt-1.5">
                    <div className="truncate font-semibold">{profile?.pen_name || profile?.display_name || "Writer"}</div>
                    <div className="truncate text-xs text-muted">{profile?.email}</div>
                  </div>
                  <Link role="menuitem" href="/profile/" className="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-desk-2">
                    <User size={15} /> Profile
                  </Link>
                  <Link role="menuitem" href="/settings/" className="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-desk-2">
                    <Settings size={15} /> Settings &amp; AI
                  </Link>
                  <button
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm hover:bg-desk-2"
                    onClick={async () => {
                      await getSupabase()?.auth.signOut();
                      router.replace("/login/");
                    }}
                  >
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/settings/" className="btn btn-ghost !p-2" title="Settings" aria-label="Settings">
              <Settings size={17} />
            </Link>
          )}
        </div>
      </header>
    </>
  );
}
