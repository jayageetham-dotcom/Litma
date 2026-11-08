"use client";
/**
 * The writing timer (a sprint): pick 10–60 minutes, write, and hear a soft chime at the end with
 * how many words came in that time. One timer at a time, kept in localStorage so a reload or a
 * second tab shows the same one. `components/Reminders.tsx` watches it and announces the end.
 */
export interface TimerState {
  minutes: number;
  /** when it ends (running), or null while paused */
  endsAt: number | null;
  /** ms left while paused */
  left: number | null;
  docId?: string;
  /** the work's word count when it started, and the latest one */
  startWords: number;
  words: number;
  /** the end has been announced */
  done?: boolean;
}

const KEY = "litma:timer";
export const TIMER_EVENT = "litma:timer";

export function getTimer(): TimerState | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
}
function put(s: TimerState | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the timer lasts this page */
  }
  memory = s;
  window.dispatchEvent(new Event(TIMER_EVENT));
}
let memory: TimerState | null = null;
const read = () => getTimer() ?? memory;

export function startTimer(minutes: number, docId: string | undefined, words: number) {
  put({ minutes, endsAt: Date.now() + minutes * 60_000, left: null, docId, startWords: words, words });
}
export function pauseTimer() {
  const s = read();
  if (!s?.endsAt) return;
  put({ ...s, left: Math.max(0, s.endsAt - Date.now()), endsAt: null });
}
export function resumeTimer() {
  const s = read();
  if (!s || s.endsAt || s.left == null) return;
  put({ ...s, endsAt: Date.now() + s.left, left: null });
}
export function stopTimer() {
  put(null);
}
/** The editor reports the work's word count so the timer can say how many words came. */
export function timerWords(docId: string, words: number) {
  const s = read();
  if (!s || s.done || s.docId !== docId || s.words === words) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, words }));
  } catch {
    memory = { ...s, words };
  }
}
export function markTimerDone() {
  const s = read();
  if (s) put({ ...s, done: true, endsAt: null, left: 0 });
}
export const timerLeft = (s: TimerState | null, now = Date.now()) => (!s ? 0 : s.endsAt ? Math.max(0, s.endsAt - now) : (s.left ?? 0));
export const timerWritten = (s: TimerState | null) => (s ? Math.max(0, s.words - s.startWords) : 0);
export const clock = (ms: number) => {
  const t = Math.ceil(ms / 1000);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

/** A soft two-note chime (no sound file to download). */
export function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t0 = ctx.currentTime + i * 0.28;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
      o.connect(g).connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + 1);
    });
    setTimeout(() => ctx.close().catch(() => {}), 2000);
  } catch {
    /* no audio */
  }
}
