/**
 * POST /functions/v1/litma-track: usage events from the web, desktop and phone apps.
 *
 * Body: { vid, sid, ctx: { platform, lang, locale, tz, screen, v, ref, device? }, events: [{ n, p?, l?, props?, t? }] }
 * The phone app (platform ios/android) sends no browser user agent, so it names its device (phone or tablet).
 * Optional Authorization: Bearer <the writer's access token> ties events to their account.
 *
 * Stores no IP address and no writing: the apps send page paths without query strings and button
 * labels only from Litma's own interface (see apps/web/src/lib/analytics.ts). The country comes from
 * the network edge's country header when there is one, else from the device's time zone.
 * Rows go to analytics_events, which only the service role can touch (see the admin_analytics migration).
 */
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { cors, preflight } from "../_shared/cors.ts";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const db = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const NAME = /^[a-z][a-z0-9_]{1,39}$/;
const ID = /^[A-Za-z0-9_-]{6,64}$/;
const MAX_EVENTS = 60;

type Json = Record<string, unknown>;
const str = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);
const noContent = () => new Response(null, { status: 204, headers: cors });

/** Page path only: no query string or hash, no ids. */
function cleanPath(v: unknown) {
  const s = str(v, 200);
  if (!s || !s.startsWith("/")) return null;
  return s.split(/[?#]/)[0].replace(/\/{2,}/g, "/");
}

/** Up to 10 simple values; strings stay short. */
function cleanProps(v: unknown): Json {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Json = {};
  for (const [k, val] of Object.entries(v as Json).slice(0, 10)) {
    if (!/^[a-z][a-zA-Z0-9_]{0,30}$/.test(k)) continue;
    if (typeof val === "number" && Number.isFinite(val)) out[k] = Math.round(val * 100) / 100;
    else if (typeof val === "boolean") out[k] = val;
    else if (typeof val === "string") out[k] = val.slice(0, 60);
  }
  return out;
}

function parseUA(ua: string) {
  const device = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua) ? "tablet" : /Mobi|iPhone|iPod|Android/i.test(ua) ? "phone" : "computer";
  const os = /Windows/i.test(ua)
    ? "Windows"
    : /iPhone|iPad|iPod/i.test(ua)
      ? "iOS"
      : /Android/i.test(ua)
        ? "Android"
        : /CrOS/i.test(ua)
          ? "ChromeOS"
          : /Mac OS X|Macintosh/i.test(ua)
            ? "macOS"
            : /Linux/i.test(ua)
              ? "Linux"
              : "Other";
  const browser = /Electron\//.test(ua)
    ? "Litma desktop"
    : /Edg(e|A|iOS)?\//.test(ua)
      ? "Edge"
      : /OPR\/|Opera/.test(ua)
        ? "Opera"
        : /SamsungBrowser/.test(ua)
          ? "Samsung Internet"
          : /Firefox|FxiOS/.test(ua)
            ? "Firefox"
            : /CriOS|Chrome\//.test(ua)
              ? "Chrome"
              : /Safari\//.test(ua)
                ? "Safari"
                : "Other";
  return { device, os, browser };
}

/** Time zone → country, for the places Malayalam writers most often live. Others fall back to the language's region. */
const TZ_COUNTRY: Record<string, string> = {
  "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Dubai": "AE", "Asia/Muscat": "OM", "Asia/Qatar": "QA", "Asia/Bahrain": "BH",
  "Asia/Kuwait": "KW", "Asia/Riyadh": "SA", "Asia/Singapore": "SG", "Asia/Kuala_Lumpur": "MY", "Asia/Colombo": "LK", "Asia/Kathmandu": "NP",
  "Asia/Dhaka": "BD", "Asia/Karachi": "PK", "Asia/Tokyo": "JP", "Asia/Hong_Kong": "HK", "Asia/Shanghai": "CN", "Asia/Bangkok": "TH",
  "Asia/Jakarta": "ID", "Asia/Manila": "PH", "Asia/Seoul": "KR", "Asia/Jerusalem": "IL",
  "Indian/Maldives": "MV", "Europe/London": "GB", "Europe/Dublin": "IE", "Europe/Berlin": "DE", "Europe/Paris": "FR", "Europe/Amsterdam": "NL",
  "Europe/Rome": "IT", "Europe/Madrid": "ES", "Europe/Zurich": "CH", "Europe/Vienna": "AT", "Europe/Brussels": "BE", "Europe/Stockholm": "SE",
  "Europe/Oslo": "NO", "Europe/Copenhagen": "DK", "Europe/Helsinki": "FI", "Europe/Warsaw": "PL", "Europe/Prague": "CZ", "Europe/Lisbon": "PT",
  "Europe/Malta": "MT", "Europe/Moscow": "RU", "Europe/Istanbul": "TR", "Africa/Johannesburg": "ZA", "Africa/Nairobi": "KE", "Africa/Lagos": "NG",
  "Africa/Cairo": "EG", "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Australia/Brisbane": "AU", "Australia/Perth": "AU",
  "Australia/Adelaide": "AU", "Pacific/Auckland": "NZ", "America/Toronto": "CA", "America/Vancouver": "CA", "America/Edmonton": "CA",
  "America/Winnipeg": "CA", "America/Halifax": "CA", "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US",
  "America/Phoenix": "US", "America/Los_Angeles": "US", "America/Anchorage": "US", "Pacific/Honolulu": "US", "America/Detroit": "US",
  "America/Sao_Paulo": "BR", "America/Mexico_City": "MX", "America/Argentina/Buenos_Aires": "AR",
};

function country(req: Request, tz: string | null, lang: string | null) {
  const h = (req.headers.get("cf-ipcountry") ?? req.headers.get("x-country") ?? req.headers.get("x-vercel-ip-country") ?? "").toUpperCase();
  if (/^[A-Z]{2}$/.test(h) && h !== "XX" && h !== "T1") return h;
  if (tz && TZ_COUNTRY[tz]) return TZ_COUNTRY[tz];
  const region = lang?.split("-")[1]?.toUpperCase();
  return region && /^[A-Z]{2}$/.test(region) ? region : null;
}

/** Referrer host, without "www." (and nothing at all for links inside Litma). */
function refHost(v: unknown) {
  const s = str(v, 300);
  if (!s) return null;
  try {
    const h = new URL(s).hostname.replace(/^www\./, "");
    return /(^|\.)getlitma\.in$|jayageetham\.com$|^litma$/.test(h) ? null : h.slice(0, 120);
  } catch {
    return /^[a-z0-9.-]{2,60}$/i.test(s) ? s.toLowerCase() : null;
  }
}

// access token → user id, cached for a few minutes on this instance
const seen = new Map<string, { id: string | null; until: number }>();
async function userId(req: Request): Promise<string | null> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token || token === ANON || token.split(".").length !== 3) return null;
  const hit = seen.get(token);
  if (hit && hit.until > Date.now()) return hit.id;
  const { data } = await db.auth.getUser(token);
  const id = data.user?.id ?? null;
  if (seen.size > 5000) seen.clear();
  seen.set(token, { id, until: Date.now() + 5 * 60 * 1000 });
  return id;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return new Response("POST only", { status: 405, headers: cors });

  let body: Json;
  try {
    // sendBeacon posts text/plain; both are JSON
    body = JSON.parse(await req.text());
  } catch {
    return new Response("Bad JSON", { status: 400, headers: cors });
  }
  const vid = str(body.vid, 64);
  const sid = str(body.sid, 64);
  if (!vid || !sid || !ID.test(vid) || !ID.test(sid)) return new Response("Missing ids", { status: 400, headers: cors });
  const events = Array.isArray(body.events) ? (body.events as Json[]).slice(0, MAX_EVENTS) : [];
  if (!events.length) return noContent();

  const ctx = (body.ctx && typeof body.ctx === "object" ? body.ctx : {}) as Json;
  const ua = parseUA(req.headers.get("user-agent") ?? "");
  const tz = str(ctx.tz, 60);
  const lang = str(ctx.lang, 20);
  const platform = ["web", "desktop", "installed", "android", "ios"].includes(String(ctx.platform)) ? String(ctx.platform) : "web";
  const native = platform === "android" || platform === "ios";
  const base = {
    user_id: await userId(req).catch(() => null),
    visitor_id: vid,
    session_id: sid,
    source: "app",
    referrer: refHost(ctx.ref),
    platform,
    device: platform === "desktop" ? "computer" : native ? (ctx.device === "tablet" ? "tablet" : "phone") : ua.device,
    os: native ? (platform === "ios" ? "iOS" : "Android") : ua.os,
    browser: native ? "Litma app" : ua.browser,
    lang,
    locale: str(ctx.locale, 10),
    tz,
    country: country(req, tz, lang),
    screen: str(ctx.screen, 20),
    app_version: str(ctx.v, 30),
  };

  const now = Date.now();
  const rows = events
    .filter((e) => e && typeof e === "object" && NAME.test(String(e.n)))
    .map((e) => {
      const t = typeof e.t === "number" ? Math.min(now, Math.max(now - 6 * 60 * 60 * 1000, e.t)) : now;
      return { ...base, created_at: new Date(t).toISOString(), name: String(e.n), path: cleanPath(e.p), label: str(e.l, 120), props: cleanProps(e.props) };
    });
  if (!rows.length) return noContent();
  const { error } = await db.from("analytics_events").insert(rows);
  if (error) console.error("litma-track insert", error.message);
  return noContent();
});
