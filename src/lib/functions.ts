"use client";
import { FUNCTIONS_URL, anonHeaders } from "./config";
import { getSupabase } from "./supabase/client";
import { manglishWord } from "@/shared/manglish";

/** Malayalam candidates for a Manglish word. Falls back to the offline engine. */
export async function transliterate(word: string, num = 6): Promise<{ candidates: string[]; source: string }> {
  if (!FUNCTIONS_URL) return { candidates: [manglishWord(word)], source: "offline" };
  try {
    const r = await fetch(`${FUNCTIONS_URL}/litma-transliterate?text=${encodeURIComponent(word)}&num=${num}`, { headers: anonHeaders() });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } catch {
    return { candidates: [manglishWord(word)], source: "offline" };
  }
}

/** Stream text from the AI Edge Function (requires a signed-in user). */
export async function aiStream(body: Record<string, unknown>, signal: AbortSignal): Promise<Response> {
  const sb = getSupabase();
  if (!sb || !FUNCTIONS_URL) return new Response("AI needs a Supabase connection.", { status: 400 });
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return new Response("Sign in to use the AI companion.", { status: 401 });
  return fetch(`${FUNCTIONS_URL}/litma-ai`, {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...anonHeaders() },
    body: JSON.stringify(body),
  });
}
