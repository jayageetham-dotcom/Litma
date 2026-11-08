import { app, BrowserWindow, Notification } from "electron";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Daily writing reminder for the desktop app. The web app (renderer) sends the writer's reminder
 * settings and whether today's goal is met (`litma:reminder:set`); this checks every minute and
 * shows a system notification once a day while the goal isn't met. It runs in the main process,
 * so on macOS it still rings with every window closed. Clicking it opens the desk.
 */
export interface ReminderState {
  on: boolean;
  /** "HH:MM" local time */
  time: string;
  /** 0 = Sunday */
  days: number[];
  /** "YYYY-MM-DD": the day `done` refers to */
  day: string;
  /** today's goal is met (or the writer wrote, when there's no goal) */
  done: boolean;
  title: string;
  body: string;
}

const file = () => join(app.getPath("userData"), "reminder.json");
let state: ReminderState | null = null;
let rangOn = "";
let timer: ReturnType<typeof setInterval> | undefined;

const pad = (n: number) => String(n).padStart(2, "0");
const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function load() {
  try {
    if (existsSync(file())) {
      const j = JSON.parse(readFileSync(file(), "utf8"));
      state = j.state ?? null;
      rangOn = j.rangOn ?? "";
    }
  } catch {
    state = null;
  }
}
function persist() {
  try {
    writeFileSync(file(), JSON.stringify({ state, rangOn }));
  } catch {
    /* read-only profile: the reminder still works this session */
  }
}

export function showNotification(title: string, body: string, open?: (url?: string) => void, url?: string) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, silent: false });
  n.on("click", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    } else open?.(url);
  });
  n.show();
}

function check(open: (url?: string) => void) {
  const s = state;
  if (!s?.on) return;
  const now = new Date();
  const today = localDay(now);
  if (rangOn === today || !s.days.includes(now.getDay())) return;
  const [h, m] = s.time.split(":").map(Number);
  if (now.getHours() * 60 + now.getMinutes() < h * 60 + (m || 0)) return;
  if (s.day === today && s.done) return;
  rangOn = today;
  persist();
  showNotification(s.title, s.body, open);
}

export function setReminder(next: ReminderState) {
  state = next;
  persist();
}

/** The renderer showed the reminder itself (or the writer saw it in the app): don't ring again today. */
export function markRang(day: string) {
  rangOn = day;
  persist();
}

export function startReminders(open: (url?: string) => void) {
  load();
  clearInterval(timer);
  timer = setInterval(() => check(open), 60_000);
  setTimeout(() => check(open), 15_000);
}
