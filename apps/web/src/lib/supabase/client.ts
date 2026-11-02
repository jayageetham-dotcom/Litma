"use client";
import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

let client: SupabaseClient | null = null;

/**
 * The desktop app runs from app://litma/, where Electron keeps no cookies, so the cookie-based
 * browser client would drop the session right after sign-in. There the session lives in localStorage.
 */
const inDesktop = () => process.env.NEXT_PUBLIC_DESKTOP === "1" || (typeof window !== "undefined" && window.location.protocol === "app:");

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client)
    client = inDesktop()
      ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storage: typeof window !== "undefined" ? window.localStorage : undefined, storageKey: "litma-auth" },
        })
      : createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}
