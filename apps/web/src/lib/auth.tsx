"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "./supabase/client";
import { isSupabaseConfigured } from "./supabase/config";
import { BASE, appUrl } from "./config";
import { isNetworkError, rememberUser, rememberedUser } from "./offline";
import { InkLoader } from "@/components/ui/Skeleton";

/**
 * Current Supabase user (null when signed out; undefined while loading). Local mode returns null.
 * Offline, an expired session can't be refreshed; the writer stays signed in on this device
 * (remembered in lib/offline.ts) and the session refreshes when the connection returns.
 */
export function useUser() {
  const [user, setUser] = useState<User | null | undefined>(isSupabaseConfigured ? undefined : null);
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    const offlineUser = (error: unknown) => (error && isNetworkError(error) ? rememberedUser() : null);
    // an expired session is refreshed first, which can take up to 30 s when the server is
    // unreachable: meanwhile the writer remembered on this device goes ahead
    const slow = setTimeout(() => {
      const known = rememberedUser();
      if (known) setUser((u) => (u === undefined ? known : u));
    }, 1500);
    sb.auth
      .getSession()
      .then(({ data, error }) => {
        if (data.session) rememberUser(data.session.user);
        setUser(data.session?.user ?? offlineUser(error));
      })
      .catch((e) => setUser(offlineUser(e)))
      .finally(() => clearTimeout(slow));
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      if (session) {
        rememberUser(session.user);
        setUser(session.user);
      } else if (event === "SIGNED_OUT") {
        rememberUser(null);
        setUser(null);
      }
    });
    return () => {
      clearTimeout(slow);
      data.subscription.unsubscribe();
    };
  }, []);
  return user;
}

/** Gate for signed-in pages. In local mode (no Supabase) it lets everyone through. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useUser();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (isSupabaseConfigured && user === null) {
      const here = typeof window !== "undefined" ? window.location.pathname.replace(BASE, "") + window.location.search : path;
      router.replace(`/login/?next=${encodeURIComponent(here)}`);
    }
  }, [user, router, path]);
  if (isSupabaseConfigured && !user)
    return <InkLoader />;
  return <>{children}</>;
}

/** Where Supabase should send people back to after email links / OAuth. */
export const authRedirect = (next = "/desk/") => appUrl(`/auth/callback/?next=${encodeURIComponent(next)}`);

/** Only allow in-app relative redirects. */
export function safeNext(next: string | null, fallback = "/desk/") {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

/** Plain-language auth errors. */
export function authMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e ?? "");
  if (/invalid login credentials/i.test(m)) return "That email and password don't match. Check them, or reset your password.";
  if (/email not confirmed/i.test(m)) return "Confirm your email first. Open the link we sent you, then sign in.";
  if (/already registered|already exists/i.test(m)) return "An account with this email already exists. Sign in instead.";
  if (/password should be at least/i.test(m)) return "Use a password of at least 8 characters.";
  if (/rate limit|too many/i.test(m)) return "Too many attempts. Wait a minute, then try again.";
  if (/network|fetch/i.test(m)) return "Can't reach the server. Check your connection and try again.";
  return m || "Something went wrong. Try again.";
}

/** On sign-in/sign-up screens: a writer who is already signed in goes straight on to `next`. */
export function useRedirectIfSignedIn(next: string) {
  const user = useUser();
  const router = useRouter();
  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);
  return user;
}
