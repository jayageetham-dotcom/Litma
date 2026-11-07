"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookA, LifeBuoy, LogOut, Settings, User } from "lucide-react";
import { Logo } from "./Logo";
import { AvatarArt, profileAvatar } from "./art/Avatars";
import { DownloadNavLink } from "./landing/DesktopDownload";
import { ThemeToggle } from "./ThemeToggle";
import { useHelpHref } from "./HelpLink";
import { store } from "@/lib/store";
import { getSupabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { useT } from "@/i18n/react";

export function Avatar({ profile, size = 32 }: { profile: (Pick<Profile, "avatar_url" | "display_name" | "pen_name"> & { preferences?: Profile["preferences"] }) | null; size?: number }) {
  const a = profileAvatar(profile);
  return a.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={a.photo} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <AvatarArt id={a.id} name={a.name} tint={a.tint} size={size} />
  );
}

/** Top bar for signed-in pages: logo, theme, and the account menu. */
export function AppHeader({ children }: { children?: React.ReactNode }) {
  const router = useRouter();
  const t = useT();
  const helpHref = useHelpHref();
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
      <header className="app-bar">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-2.5">
        <div className="flex items-center gap-2">
          {children}
          <Logo href="/desk/" />
        </div>
        <div className="flex items-center gap-1">
          <DownloadNavLink className="max-sm:!hidden" />
          <Link href="/dictionary/" className="btn btn-ghost !px-2.5 text-sm" title={t("nav.dictionaryTitle")}>
            <BookA size={17} /> <span className="hidden sm:inline">നിഘണ്ടു</span>
          </Link>
          <ThemeToggle />
          {store.isCloud() ? (
            <div className="relative" ref={ref}>
              <button className="ml-1 rounded-full ring-offset-2 ring-offset-canvas hover:ring-2 hover:ring-accent" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={t("nav.accountMenu")}>
                <Avatar profile={profile} size={34} />
              </button>
              {open && (
                <div className="pop-in absolute right-0 top-11 z-50 w-60 origin-top-right rounded-xl border border-line bg-surface p-1.5 shadow-[var(--pop-shadow)]" role="menu">
                  <div className="mb-1.5 border-b border-line px-2.5 pb-2.5 pt-1">
                    <div className="truncate font-semibold">{profile?.pen_name || profile?.display_name || t("nav.writer")}</div>
                    <div className="truncate text-xs text-muted">{profile?.email}</div>
                  </div>
                  <Link role="menuitem" href="/profile/" className="mt-0.5 flex items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-sm hover:bg-subtle">
                    <User size={15} /> {t("nav.profile")}
                  </Link>
                  <Link role="menuitem" href="/settings/" className="mt-0.5 flex items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-sm hover:bg-subtle">
                    <Settings size={15} /> {t("nav.settings")}
                  </Link>
                  <a role="menuitem" href={helpHref} target="_blank" rel="noreferrer" data-track="Help and guide" className="mt-0.5 flex items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-sm hover:bg-subtle">
                    <LifeBuoy size={15} /> {t("settings.help")}
                  </a>
                  <button
                    role="menuitem"
                    className="mt-0.5 flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-left text-sm hover:bg-subtle"
                    onClick={async () => {
                      await getSupabase()?.auth.signOut();
                      router.replace("/login/");
                    }}
                  >
                    <LogOut size={15} /> {t("nav.signOut")}
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
        </div>
      </header>
    </>
  );
}
