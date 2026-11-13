/**
 * A small rate limiter for the Edge Functions: a fixed window per key (a hashed IP address or a user
 * id), kept in the memory of each running instance. Supabase runs a few instances, so the real limit
 * is a little higher than the number here, but a script hammering a function is stopped at once,
 * with no database round trip on every call. Raw IP addresses are never kept: only a short hash
 * that lives for the length of the window.
 */
import { cors } from "./cors.ts";

type Hit = { n: number; until: number };
const buckets = new Map<string, Map<string, Hit>>();

/** The caller's address from the edge headers, or "unknown". */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
}

/** A short, one-way key for an IP address (never stored as it is). */
export async function ipKey(req: Request): Promise<string> {
  const data = new TextEncoder().encode(`litma:${clientIp(req)}`);
  const sum = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return Array.from(sum.subarray(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Counts one call for `key` in the named limit. Returns null while the caller is within `max` calls
 * per `windowS` seconds, otherwise the seconds to wait.
 */
export function hit(name: string, key: string, max: number, windowS: number): number | null {
  let map = buckets.get(name);
  if (!map) buckets.set(name, (map = new Map()));
  const now = Date.now();
  const h = map.get(key);
  if (!h || h.until <= now) {
    map.set(key, { n: 1, until: now + windowS * 1000 });
    // keep memory small: forget finished windows now and then
    if (map.size > 20000) for (const [k, v] of map) if (v.until <= now) map.delete(k);
    return null;
  }
  h.n++;
  return h.n > max ? Math.ceil((h.until - now) / 1000) : null;
}

/** The 429 answer, with Retry-After. */
export function tooMany(wait: number): Response {
  return new Response(JSON.stringify({ error: "Too many requests. Please wait a moment and try again.", retryAfter: wait }), {
    status: 429,
    headers: { ...cors, "content-type": "application/json", "retry-after": String(wait) },
  });
}

/** The signed-in user's id from a verified JWT (the gateway checked it when verify_jwt is on). */
export function userIdFromJwt(req: Request): string | null {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const part = token?.split(".")[1];
  if (!part) return null;
  try {
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.sub === "string" ? json.sub : null;
  } catch {
    return null;
  }
}
