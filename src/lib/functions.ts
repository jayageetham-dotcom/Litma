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
    body: JSON.stringify({ op: "chat", ...body }),
  });
}

export type AIProvider = "anthropic" | "openai" | "gemini";
export interface StoredKey {
  provider: AIProvider;
  last4: string;
  model: string | null;
  updated_at: string;
}

async function aiCall<T>(body: Record<string, unknown>): Promise<T> {
  const sb = getSupabase();
  if (!sb || !FUNCTIONS_URL) throw new Error("AI keys need a Supabase connection.");
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in first.");
  const r = await fetch(`${FUNCTIONS_URL}/litma-ai`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...anonHeaders() },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/** The writer's saved AI keys (only the last 4 characters ever come back). */
export const listAiKeys = () => aiCall<StoredKey[]>({ op: "keys" });
export const saveAiKey = (provider: AIProvider, key: string, model?: string) => aiCall<{ ok: boolean }>({ op: "set_key", provider, key, model });
export const deleteAiKey = (provider: AIProvider) => aiCall<{ ok: boolean }>({ op: "delete_key", provider });
