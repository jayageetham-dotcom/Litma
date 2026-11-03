"use client";
/**
 * Usage statistics for the owner's /admin/ page (web, desktop; the phone app sends the same events).
 *
 * What is sent: page paths without query strings, clicks on Litma's own buttons and links (the label
 * only when it is one of the app's interface strings, see scripts/build-track-labels.mjs), a few named
 * actions (new work, new book, export, dictionary lookup, sign-in), time spent active, and the device
 * context (app, browser, OS, screen size, language, time zone). Never sent: writing, titles, names,
 * search words, document ids, IP addresses. Writers can switch it off in Settings → Usage statistics.
 */
import { BASE, FUNCTIONS_URL } from "./config";
import { SUPABASE_ANON_KEY, isSupabaseConfigured } from "./supabase/config";

const OPT_OUT = "litma:usage-stats";
const VID = "litma:vid";
const SID = "litma:sid";
const SID_AT = "litma:sid-at";
const REF = "litma:ref";
const SESSION_IDLE_MS = 30 * 60 * 1000;
const ACTIVE_WINDOW_MS = 60 * 1000;

type Props = Record<string, string | number | boolean>;
type Ev = { n: string; p?: string; l?: string; props?: Props; t: number };

let queue: Ev[] = [];
let token: string | null = null;
let engaged = 0;
let lastInput = Date.now();
let started = false;
let labels: Set<string> | null = null;
let labelsLoading: Promise<void> | null = null;

const safe = <T,>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

export const usageStatsOn = () => safe(() => localStorage.getItem(OPT_OUT) !== "off", true);
export function setUsageStatsOn(on: boolean) {
  safe(() => (on ? localStorage.removeItem(OPT_OUT) : localStorage.setItem(OPT_OUT, "off")), undefined);
  if (!on) queue = [];
}

const enabled = () => typeof window !== "undefined" && isSupabaseConfigured && !!FUNCTIONS_URL && usageStatsOn();

const randomId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);

function visitorId() {
  return safe(() => {
    let v = localStorage.getItem(VID);
    if (!v) localStorage.setItem(VID, (v = randomId()));
    return v;
  }, "anon-" + randomId());
}

/** A visit ends after 30 minutes without activity; the referrer is kept for the whole visit. */
function sessionId() {
  return safe(() => {
    const now = Date.now();
    let s = sessionStorage.getItem(SID);
    const at = Number(sessionStorage.getItem(SID_AT) || 0);
    if (!s || now - at > SESSION_IDLE_MS) {
      s = randomId();
      sessionStorage.setItem(SID, s);
      const utm = new URLSearchParams(location.search).get("utm_source");
      sessionStorage.setItem(REF, utm || document.referrer || "");
    }
    sessionStorage.setItem(SID_AT, String(now));
    return s;
  }, "session");
}

const path = () => {
  const p = location.pathname;
  return (BASE && p.startsWith(BASE) ? p.slice(BASE.length) : p) || "/";
};

function context() {
  const standalone = safe(() => matchMedia("(display-mode: standalone)").matches, false);
  return {
    platform: process.env.NEXT_PUBLIC_DESKTOP === "1" || location.protocol === "app:" ? "desktop" : standalone ? "installed" : "web",
    lang: navigator.language,
    locale: document.documentElement.dataset.uiLocale ?? "en",
    tz: safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone, ""),
    screen: `${screen.width}x${screen.height}`,
    v: process.env.NEXT_PUBLIC_APP_VERSION ?? "",
    ref: safe(() => sessionStorage.getItem(REF) ?? "", ""),
  };
}

/** Record one event. `name` is snake_case; props are small values (never writing). */
export function track(name: string, props?: Props, label?: string) {
  if (!enabled()) return;
  sessionId(); // starts the visit on its first event, so the landing page's referrer and utm_source are kept
  queue.push({ n: name, p: path(), l: label, props, t: Date.now() });
  if (queue.length >= 40) flush();
}

function flush(leaving = false) {
  if (!enabled()) return;
  const seconds = Math.round(engaged);
  if (seconds >= 5) {
    queue.push({ n: "engagement", p: path(), props: { seconds }, t: Date.now() });
    engaged = 0;
  }
  if (!queue.length) return;
  const events = queue.splice(0, 60);
  const body = JSON.stringify({ vid: visitorId(), sid: sessionId(), ctx: context(), events });
  fetch(`${FUNCTIONS_URL}/litma-track`, {
    method: "POST",
    keepalive: leaving || body.length < 60000,
    headers: { "content-type": "application/json", apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${token ?? SUPABASE_ANON_KEY}` },
    body,
  }).catch(() => {
    /* statistics are best-effort */
  });
}

// ── click labels: only Litma's own interface strings ──

/** Same rule as normalise() in scripts/build-track-labels.mjs. */
export const normaliseLabel = (s: string) =>
  s
    .replace(/\s+/g, " ")
    .replace(/\s*\((?:Ctrl|⌘|Cmd|Alt|Shift|Esc|Enter|Tab)[^)]*\)\s*$/i, "")
    .replace(/[\s:…·.,]+$/u, "")
    .trim();

function loadLabels() {
  labelsLoading ??= fetch(`${BASE}/track-labels.json`)
    .then((r) => (r.ok ? r.json() : []))
    .then((list: string[]) => {
      labels = new Set(list);
    })
    .catch(() => {
      labels = new Set();
    });
  return labelsLoading;
}

/** The interface string this text is, or starts with ("Delete ‹a title›" → "Delete"); otherwise nothing. */
function knownLabel(text: string | null | undefined) {
  if (!text || !labels) return null;
  const v = normaliseLabel(text).slice(0, 120);
  if (labels.has(v)) return v;
  const words = v.split(" ");
  for (let k = words.length - 1; k >= 1; k--) {
    const head = normaliseLabel(words.slice(0, k).join(" "));
    if (labels.has(head)) return head;
  }
  return null;
}

const CLICKABLE = "button, a[href], [role=button], [role=tab], [role=menuitem], [role=menuitemradio], [role=option], [role=switch], [role=checkbox], summary";
const PRIVATE = ".ProseMirror, [contenteditable=true], [data-private], input, textarea";

function onClick(e: MouseEvent) {
  const el = (e.target as Element | null)?.closest?.(CLICKABLE) as HTMLElement | null;
  if (!el || el.closest(PRIVATE)) return;
  const record = () => {
    const label =
      el.dataset.track ||
      knownLabel(el.getAttribute("aria-label")) ||
      knownLabel(el.getAttribute("title")) ||
      knownLabel(el.textContent?.trim().slice(0, 80));
    const props: Props = { el: el.getAttribute("role") || el.tagName.toLowerCase() };
    if (el instanceof HTMLAnchorElement) {
      const url = safe(() => new URL(el.href), null);
      if (url) props.to = url.origin === location.origin ? (url.pathname.slice(BASE.length) || "/") : url.hostname.replace(/^www\./, "");
    }
    if (!label && !props.to) return;
    track("click", props, label ?? undefined);
  };
  if (labels) record();
  else loadLabels().then(record);
}

/** Start once (the root layout's <Analytics /> does it). Returns a cleanup. */
export function startAnalytics(getToken: () => Promise<string | null>) {
  if (started || typeof window === "undefined" || !isSupabaseConfigured) return () => {};
  started = true;
  getToken().then((t) => (token = t));
  void loadLabels();
  const input = () => {
    lastInput = Date.now();
  };
  const tick = setInterval(() => {
    if (document.visibilityState === "visible" && Date.now() - lastInput < ACTIVE_WINDOW_MS) engaged += 5;
  }, 5000);
  const send = setInterval(() => {
    if (queue.length || engaged >= 120) flush();
  }, 20000);
  const hidden = () => {
    if (document.visibilityState === "hidden") flush(true);
  };
  const leave = () => flush(true);
  document.addEventListener("click", onClick, true);
  for (const ev of ["keydown", "pointerdown", "scroll", "wheel", "touchstart"]) window.addEventListener(ev, input, { passive: true, capture: true });
  document.addEventListener("visibilitychange", hidden);
  window.addEventListener("pagehide", leave);
  return () => {
    started = false;
    clearInterval(tick);
    clearInterval(send);
    document.removeEventListener("click", onClick, true);
    for (const ev of ["keydown", "pointerdown", "scroll", "wheel", "touchstart"]) window.removeEventListener(ev, input, true);
    document.removeEventListener("visibilitychange", hidden);
    window.removeEventListener("pagehide", leave);
  };
}

/** Keep the account link up to date after sign-in / sign-out. */
export function setAnalyticsToken(t: string | null) {
  token = t;
}
