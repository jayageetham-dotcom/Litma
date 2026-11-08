"use client";
/**
 * Writing goals on the web and desktop apps: the writer's goals (daily words from the profile,
 * the rest in preferences.goals), their writing days and streak. Shared maths in
 * packages/shared/src/goals.ts; the phone app mirrors this in lib/data/goals.dart.
 */
import { useCallback, useEffect, useState } from "react";
import { store, WRITING_EVENT } from "./store";
import { BASE } from "./config";
import { DEFAULT_REMINDER, localDay, streak, wordsOn, wordsThisWeek, type GoalPrefs, type Streak, type WritingDay } from "@litma/shared/goals";

export const GOALS_EVENT = "litma:goals";
const LS_LOCAL = "litma:goals";

export interface Goals extends GoalPrefs {
  /** words a day (the profile's daily_goal) */
  daily: number;
}

const DEFAULT_DAILY = 500;

/** The writer's goals (local mode keeps them on this device). */
export async function loadGoals(): Promise<Goals> {
  if (!store.isCloud()) {
    try {
      const j = JSON.parse(localStorage.getItem(LS_LOCAL) ?? "null");
      if (j) return { daily: DEFAULT_DAILY, ...j };
    } catch {
      /* storage blocked */
    }
    return { daily: DEFAULT_DAILY };
  }
  const p = await store.getProfile().catch(() => null);
  const g = (p?.preferences?.goals ?? {}) as GoalPrefs;
  return { ...g, daily: p?.daily_goal ?? DEFAULT_DAILY };
}

/** Change some goals; the daily goal goes to the profile's daily_goal. */
export async function saveGoals(patch: Partial<Goals>): Promise<Goals> {
  const cur = await loadGoals();
  const next: Goals = { ...cur, ...patch };
  const { daily, ...prefs } = next;
  if (!store.isCloud()) {
    try {
      localStorage.setItem(LS_LOCAL, JSON.stringify(next));
    } catch {
      /* storage blocked */
    }
  } else {
    const p = await store.getProfile();
    if (p) await store.updateProfile({ daily_goal: Math.max(0, Math.round(daily || 0)), preferences: { ...(p.preferences ?? {}), goals: prefs } });
  }
  window.dispatchEvent(new Event(GOALS_EVENT));
  return next;
}

export interface WritingState {
  goals: Goals | null;
  days: WritingDay[];
  today: number;
  week: number;
  streak: Streak;
  reload: () => void;
}

/** Goals, days and streak, refreshed whenever words are counted or goals change. */
export function useWriting(): WritingState {
  const [goals, setGoals] = useState<Goals | null>(null);
  const [days, setDays] = useState<WritingDay[]>([]);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    let live = true;
    Promise.all([loadGoals(), store.wordsByDay()]).then(([g, d]) => {
      if (!live) return;
      setGoals(g);
      setDays(d);
      // remember the best streak: the server forgets days after 90
      const s = streak(d, localDay(), g.restDays ?? 0, g.bestStreak ?? 0);
      if (s.best > (g.bestStreak ?? 0)) saveGoals({ bestStreak: s.best }).catch(() => {});
    });
    return () => {
      live = false;
    };
  }, [tick]);
  useEffect(() => {
    window.addEventListener(WRITING_EVENT, reload);
    window.addEventListener(GOALS_EVENT, reload);
    return () => {
      window.removeEventListener(WRITING_EVENT, reload);
      window.removeEventListener(GOALS_EVENT, reload);
    };
  }, [reload]);
  const today = localDay();
  return {
    goals,
    days,
    today: wordsOn(days, today),
    week: wordsThisWeek(days, today),
    streak: streak(days, today, goals?.restDays ?? 0, goals?.bestStreak ?? 0),
    reload,
  };
}

export const reminderOf = (g: Goals | null) => g?.reminder ?? DEFAULT_REMINDER;

// ── notifications on this device ──

const LS_DEVICE = "litma:reminders";

/** Writer allowed reminders and timer alerts on this device. */
export function notificationsOn(): boolean {
  try {
    return localStorage.getItem(LS_DEVICE) === "on";
  } catch {
    return false;
  }
}
export function setNotificationsOn(on: boolean) {
  try {
    localStorage.setItem(LS_DEVICE, on ? "on" : "off");
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new Event(GOALS_EVENT));
}
/** Ask the browser for permission (the desktop app always may). */
export async function askNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.litmaDesktop?.notify) return true;
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}
export const notificationsBlocked = () => typeof window !== "undefined" && !window.litmaDesktop?.notify && "Notification" in window && Notification.permission === "denied";
export const notificationsSupported = () => typeof window !== "undefined" && (!!window.litmaDesktop?.notify || "Notification" in window);

/** A system notification when allowed, through the desktop app when there. */
export function systemNotify(title: string, body: string, tag?: string): boolean {
  if (!notificationsOn()) return false;
  const d = window.litmaDesktop;
  if (d?.notify) {
    d.notify(title, body).catch(() => {});
    return true;
  }
  if (!("Notification" in window) || Notification.permission !== "granted") return false;
  const icon = `${BASE}/icons/icon-192.png`;
  try {
    const n = new Notification(title, { body, tag, icon });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return true;
  } catch {
    // Android Chrome shows notifications only through the service worker
    navigator.serviceWorker?.ready.then((r) => r.showNotification(title, { body, tag, icon })).catch(() => {});
    return true;
  }
}
