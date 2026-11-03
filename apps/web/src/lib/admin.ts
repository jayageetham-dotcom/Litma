"use client";
/**
 * The owner's /admin/ page talks to the litma-admin Edge Function, which checks app_admins and runs
 * the report functions in the admin_analytics migration. In local mode (no Supabase) the page shows
 * made-up sample numbers so the layout can be checked.
 */
import { FUNCTIONS_URL, anonHeaders } from "./config";
import { getSupabase } from "./supabase/client";
import { isSupabaseConfigured } from "./supabase/config";

export type Row = { key: string; n: number };
export type Kpi = {
  visitors: number; visitors_prev: number;
  sessions: number; sessions_prev: number;
  page_views: number; page_views_prev: number;
  active_writers: number; active_writers_prev: number;
  writers_total: number;
  new_writers: number; new_writers_prev: number;
  words: number; words_prev: number;
  works: number; works_prev: number;
  engaged_seconds: number; engaged_seconds_prev: number;
  returning_visitors: number;
  online_now: number;
};
export type Daily = { day: string; visitors: number; page_views: number; active_writers: number; signups: number; words: number };
export type Dashboard = {
  days: number;
  generated_at: string;
  kpi: Kpi;
  daily: Daily[];
  hours: { dow: number; hour: number; n: number }[];
  breakdown: Partial<Record<"platform" | "device" | "os" | "browser" | "country" | "locale" | "lang" | "app_version" | "referrer", Row[]>>;
  pages: { path: string; views: number; visitors: number }[];
  clicks: { label: string; n: number; visitors: number; path: string | null }[];
  features: { name: string; label: string; n: number; people: number }[];
  kinds: { kind: string; works: number; writers: number; words: number }[];
  providers: Row[];
  funnel: { visitors: number; signed_up: number; started_a_work: number; wrote: number };
};
export type AdminUser = {
  id: string; email: string | null; name: string | null; location: string | null; provider: string;
  joined: string; confirmed: boolean; last_sign_in: string | null; last_seen: string | null; is_admin: boolean;
  sessions: number; events: number; page_views: number; active_days: number; engaged_seconds: number;
  ai_requests: number; mcp_calls: number; words: number; writing_days: number; works: number; books: number;
  country: string | null; platform: string | null; device: string | null; os: string | null; locale: string | null;
};
export type UserEvent = {
  created_at: string; name: string; path: string | null; label: string | null; props: Record<string, unknown>;
  platform: string | null; device: string | null; os: string | null; browser: string | null; country: string | null;
  session_id: string; before_sign_in: boolean;
};
export type UserActivity = {
  daily: { day: string; events: number; words: number }[];
  devices: { platform: string | null; device: string | null; os: string | null; browser: string | null; country: string | null; app_version: string | null; sessions: number; last_seen: string }[];
  events: UserEvent[];
};

export const isDemo = () => !isSupabaseConfigured;

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const sb = getSupabase();
  const token = (await sb?.auth.getSession())?.data.session?.access_token;
  const r = await fetch(`${FUNCTIONS_URL}/litma-admin`, {
    method: "POST",
    headers: { ...anonHeaders(), "content-type": "application/json", authorization: `Bearer ${token ?? ""}` },
    body: JSON.stringify(body),
  });
  if (r.status === 403) throw new AdminDenied();
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? `HTTP ${r.status}`);
  return r.json();
}
export class AdminDenied extends Error {
  constructor() {
    super("not admin");
  }
}

export const admin = {
  async check(): Promise<boolean> {
    if (isDemo()) return true;
    try {
      return (await call<{ admin: boolean }>({ op: "check" })).admin;
    } catch {
      return false;
    }
  },
  dashboard: (days: number, includeAdmins: boolean) => (isDemo() ? Promise.resolve(demoDashboard(days)) : call<Dashboard>({ op: "dashboard", days, includeAdmins })),
  users: (includeAdmins: boolean) => (isDemo() ? Promise.resolve(demoUsers()) : call<AdminUser[]>({ op: "users", includeAdmins })),
  user: (id: string) => (isDemo() ? Promise.resolve(demoActivity()) : call<UserActivity>({ op: "user", id })),
};

// ── sample numbers for local mode (deterministic, clearly not real) ──

function rnd(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

function demoDashboard(days: number): Dashboard {
  const r = rnd(7 + days);
  const daily: Daily[] = Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * 864e5);
    const wave = 1 + 0.35 * Math.sin(i / 3.2) + i / days / 2;
    const visitors = Math.round((40 + r() * 25) * wave);
    return { day: iso(d), visitors, page_views: Math.round(visitors * (3 + r() * 2)), active_writers: Math.round(visitors * 0.32), signups: Math.round(r() * 5 * wave), words: Math.round(visitors * (90 + r() * 120)) };
  });
  const sum = (k: keyof Daily) => daily.reduce((a, d) => a + (d[k] as number), 0);
  const hours = [];
  for (let dow = 1; dow <= 7; dow++)
    for (let hour = 0; hour < 24; hour++) {
      const evening = Math.exp(-((hour - 21) ** 2) / 10) + 0.6 * Math.exp(-((hour - 7) ** 2) / 6) + 0.3 * Math.exp(-((hour - 14) ** 2) / 8);
      hours.push({ dow, hour, n: Math.round(evening * (dow >= 6 ? 160 : 110) * (0.8 + r() * 0.4)) });
    }
  const v = sum("visitors");
  return {
    days,
    generated_at: new Date().toISOString(),
    kpi: {
      visitors: Math.round(v * 0.55), visitors_prev: Math.round(v * 0.46), sessions: Math.round(v * 0.9), sessions_prev: Math.round(v * 0.78),
      page_views: sum("page_views"), page_views_prev: Math.round(sum("page_views") * 0.8), active_writers: Math.round(v * 0.12), active_writers_prev: Math.round(v * 0.1),
      writers_total: 1240, new_writers: sum("signups"), new_writers_prev: Math.round(sum("signups") * 0.85), words: sum("words"), words_prev: Math.round(sum("words") * 0.9),
      works: Math.round(sum("signups") * 2.4), works_prev: Math.round(sum("signups") * 2.1), engaged_seconds: v * 520, engaged_seconds_prev: v * 470, returning_visitors: Math.round(v * 0.21), online_now: 7,
    },
    daily,
    hours,
    breakdown: {
      platform: [{ key: "web", n: 610 }, { key: "desktop", n: 214 }, { key: "installed", n: 58 }],
      device: [{ key: "phone", n: 452 }, { key: "computer", n: 381 }, { key: "tablet", n: 49 }],
      os: [{ key: "Android", n: 331 }, { key: "Windows", n: 228 }, { key: "macOS", n: 142 }, { key: "iOS", n: 151 }, { key: "Linux", n: 30 }],
      browser: [{ key: "Chrome", n: 498 }, { key: "Litma desktop", n: 214 }, { key: "Safari", n: 121 }, { key: "Edge", n: 31 }, { key: "Firefox", n: 18 }],
      country: [{ key: "IN", n: 571 }, { key: "AE", n: 104 }, { key: "SA", n: 52 }, { key: "QA", n: 33 }, { key: "US", n: 41 }, { key: "GB", n: 38 }, { key: "OM", n: 21 }, { key: "KW", n: 14 }, { key: "AU", n: 8 }],
      locale: [{ key: "ml", n: 512 }, { key: "en", n: 370 }],
      lang: [{ key: "en", n: 701 }, { key: "ml", n: 168 }, { key: "ar", n: 13 }],
      app_version: [{ key: "0.7.6", n: 160 }, { key: "0.7.5", n: 41 }, { key: "0.7.4", n: 13 }],
      referrer: [{ key: "(direct)", n: 402 }, { key: "google.com", n: 211 }, { key: "facebook.com", n: 88 }, { key: "whatsapp", n: 71 }, { key: "instagram.com", n: 49 }, { key: "t.co", n: 12 }],
    },
    pages: [
      { path: "/write/", views: 4120, visitors: 290 }, { path: "/desk/", views: 2210, visitors: 330 }, { path: "/", views: 1630, visitors: 702 },
      { path: "/dictionary/", views: 980, visitors: 211 }, { path: "/book/", views: 410, visitors: 66 }, { path: "/download/", views: 302, visitors: 190 },
      { path: "/signup/", views: 280, visitors: 240 }, { path: "/settings/", views: 140, visitors: 72 }, { path: "/read/", views: 120, visitors: 94 },
    ],
    clicks: [
      { label: "New work", n: 412, visitors: 201, path: "/desk/" }, { label: "Insert page", n: 233, visitors: 61, path: "/write/" }, { label: "Bold", n: 218, visitors: 92, path: "/write/" },
      { label: "Story World", n: 167, visitors: 80, path: "/write/" }, { label: "AI companion", n: 120, visitors: 57, path: "/write/" }, { label: "Dictionary", n: 116, visitors: 88, path: "/write/" },
      { label: "Get the app for Mac and Windows", n: 92, visitors: 85, path: "/" }, { label: "Preview and export PDF", n: 74, visitors: 40, path: "/write/" },
    ],
    features: [
      { name: "work_created", label: "", n: 402, people: 198 }, { name: "dictionary_lookup", label: "", n: 1290, people: 211 }, { name: "export", label: "", n: 160, people: 81 },
      { name: "ai_request", label: "continue", n: 140, people: 37 }, { name: "ai_request", label: "polish", n: 96, people: 31 }, { name: "mcp_call", label: "read_document", n: 61, people: 9 },
      { name: "book_created", label: "", n: 34, people: 29 }, { name: "sign_up", label: "", n: 140, people: 140 },
    ],
    kinds: [
      { kind: "story", works: 512, writers: 301, words: 812000 }, { kind: "poem", works: 488, writers: 240, words: 121000 }, { kind: "novel", works: 140, writers: 96, words: 1430000 },
      { kind: "screenplay", works: 92, writers: 51, words: 402000 }, { kind: "feature", works: 81, writers: 60, words: 140000 }, { kind: "lyrics", works: 64, writers: 41, words: 22000 },
      { kind: "diary", works: 60, writers: 44, words: 51000 }, { kind: "essay", works: 38, writers: 30, words: 77000 }, { kind: "drama", works: 12, writers: 9, words: 41000 },
    ],
    providers: [{ key: "email", n: 780 }, { key: "google", n: 460 }],
    funnel: { visitors: Math.round(v * 0.55), signed_up: sum("signups"), started_a_work: Math.round(sum("signups") * 0.74), wrote: Math.round(sum("signups") * 0.51) },
  };
}

function demoUsers(): AdminUser[] {
  const r = rnd(3);
  const names = ["Sample writer 1", "Sample writer 2", "Sample writer 3", "Sample writer 4", "Sample writer 5", "Sample writer 6"];
  const places = [["IN", "Android", "phone"], ["AE", "Windows", "computer"], ["IN", "macOS", "computer"], ["SA", "Android", "phone"], ["GB", "iOS", "phone"], ["IN", "Windows", "computer"]];
  return names.map((name, i) => ({
    id: `00000000-0000-4000-8000-00000000000${i}`, email: `writer${i + 1}@example.com`, name, location: null, provider: i % 2 ? "google" : "email",
    joined: new Date(Date.now() - (60 - i * 9) * 864e5).toISOString(), confirmed: true, last_sign_in: new Date(Date.now() - i * 36e5 * 7).toISOString(),
    last_seen: new Date(Date.now() - i * 36e5 * 5).toISOString(), is_admin: false, sessions: Math.round(4 + r() * 60), events: Math.round(50 + r() * 900),
    page_views: Math.round(20 + r() * 300), active_days: Math.round(2 + r() * 40), engaged_seconds: Math.round(r() * 90000), ai_requests: Math.round(r() * 30),
    mcp_calls: i === 2 ? 41 : 0, words: Math.round(r() * 60000), writing_days: Math.round(r() * 30), works: Math.round(1 + r() * 12), books: Math.round(r() * 2),
    country: places[i][0], platform: i === 1 ? "desktop" : "web", device: places[i][2], os: places[i][1], locale: i % 3 ? "ml" : "en",
  }));
}

function demoActivity(): UserActivity {
  const r = rnd(11);
  const daily = Array.from({ length: 90 }, (_, i) => {
    const on = r() > 0.45;
    return { day: iso(new Date(Date.now() - (89 - i) * 864e5)), events: on ? Math.round(5 + r() * 60) : 0, words: on ? Math.round(r() * 1400) : 0 };
  });
  const evs: [string, string | null, string | null][] = [
    ["page_view", "/desk/", null], ["click", "/desk/", "New work"], ["work_created", "/desk/", null], ["page_view", "/write/", null], ["click", "/write/", "Bold"],
    ["click", "/write/", "Story World"], ["dictionary_lookup", "/write/", null], ["ai_request", null, "continue"], ["click", "/write/", "Preview and export PDF"], ["export", "/print/", null],
  ];
  return {
    daily,
    devices: [{ platform: "web", device: "phone", os: "Android", browser: "Chrome", country: "IN", app_version: "0.7.6", sessions: 31, last_seen: new Date().toISOString() }],
    events: evs.reverse().map(([name, path, label], i) => ({
      created_at: new Date(Date.now() - i * 4 * 6e4).toISOString(), name, path, label, props: name === "work_created" ? { kind: "story" } : name === "export" ? { format: "pdf" } : {},
      platform: name === "ai_request" ? "server" : "web", device: "phone", os: "Android", browser: "Chrome", country: "IN", session_id: "demo", before_sign_in: false,
    })),
  };
}
