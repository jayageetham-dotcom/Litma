/**
 * Writing goals, streaks and statistics from the writer's writing days.
 * Dependency-free: shared by the web and desktop apps and the MCP server; the phone app ports it in
 * lib/data/goals.dart (keep the two in step, same cases in test/goals_test.dart).
 *
 * Days are the writer's own calendar days ("YYYY-MM-DD" in their time zone). The server keeps 90
 * days of rows, so the best streak is also remembered in the profile (preferences.goals.bestStreak).
 */

export interface WritingDay {
  day: string;
  words: number;
  minutes?: number;
  /** words per hour of the day, index 0 = 00:00 */
  hours?: number[];
}

export interface ReminderPrefs {
  on: boolean;
  /** "HH:MM", the writer's local time */
  time: string;
  /** days of the week it may ring, 0 = Sunday */
  days: number[];
}

export interface GoalPrefs {
  /** words a week (0 = none); the daily goal is the profile's daily_goal */
  weekly?: number;
  /** days a week that may pass without writing and still keep the streak (0–2) */
  restDays?: number;
  reminder?: ReminderPrefs;
  /** default writing timer, minutes */
  timer?: number;
  /** best streak seen, kept because the server forgets days older than 90 */
  bestStreak?: number;
}

export const DEFAULT_REMINDER: ReminderPrefs = { on: false, time: "19:30", days: [0, 1, 2, 3, 4, 5, 6] };
export const TIMER_CHOICES = [10, 15, 25, 45, 60];
export const KEEP_DAYS = 90;

const pad = (n: number) => String(n).padStart(2, "0");
/** The local calendar day of a date, "YYYY-MM-DD". */
export function localDay(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Parse "YYYY-MM-DD" as local midnight. */
export function parseDay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export function addDays(day: string, n: number): string {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return localDay(d);
}
/** Whole days from a to b (b later is positive). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400000);
}

export interface Streak {
  /** days in the current streak (writing days only; forgiven rest days don't add) */
  current: number;
  /** longest streak in the days given (and the remembered best) */
  best: number;
  /** wrote something today */
  today: boolean;
}

/**
 * Walk back from `today`: a day with words adds to the streak; a day without may be a rest day if no
 * more than `restDays` such days fall in any seven-day stretch; otherwise the streak ends. Today
 * without words yet doesn't end it.
 */
export function streak(days: WritingDay[], today = localDay(), restDays = 0, remembered = 0): Streak {
  const wrote = new Set(days.filter((d) => d.words > 0).map((d) => d.day));
  const rest = Math.max(0, Math.min(2, Math.floor(restDays)));
  const run = (from: string, stopBefore?: string) => {
    let n = 0;
    const misses: number[] = [];
    let d = from;
    for (let i = 0; i < 400; i++) {
      if (stopBefore && d < stopBefore) break;
      if (wrote.has(d)) n++;
      else {
        misses.push(i);
        while (misses.length && misses[0] <= i - 7) misses.shift();
        if (misses.length > rest) break;
      }
      d = addDays(d, -1);
    }
    return n;
  };
  const hasToday = wrote.has(today);
  const current = run(hasToday ? today : addDays(today, -1));
  // best: every day that ends a run (wrote that day, not the next), measured the same way
  let best = Math.max(current, remembered);
  const oldest = days.reduce((m, d) => (d.day < m ? d.day : m), today);
  for (const d of wrote) if (!wrote.has(addDays(d, 1))) best = Math.max(best, run(d, oldest));
  return { current, best, today: hasToday };
}

/** Words written on a day. */
export function wordsOn(days: WritingDay[], day: string): number {
  return days.find((d) => d.day === day)?.words ?? 0;
}

/** Monday of the week a day falls in (weeks start on Monday). */
export function weekStart(day: string): string {
  const d = parseDay(day);
  const back = (d.getDay() + 6) % 7;
  return addDays(day, -back);
}

/** Words this week so far (Monday to today). */
export function wordsThisWeek(days: WritingDay[], today = localDay()): number {
  const from = weekStart(today);
  return days.filter((d) => d.day >= from && d.day <= today).reduce((n, d) => n + d.words, 0);
}

/**
 * For a work with a word goal and a finish date: words still to write and how many a day that
 * needs, counting today. Null when there's no goal or date, or the date has passed.
 */
export function deadlinePace(words: number, goal: number, deadline: string | undefined, today = localDay()) {
  if (!goal || !deadline) return null;
  const left = Math.max(0, goal - words);
  const daysLeft = daysBetween(today, deadline) + 1;
  if (daysLeft <= 0) return { left, daysLeft: 0, perDay: left };
  return { left, daysLeft, perDay: Math.ceil(left / daysLeft) };
}

export interface Summary {
  words: number;
  minutes: number;
  writingDays: number;
  /** average words on the days the writer wrote */
  perWritingDay: number;
  /** words per hour of the day over the period */
  hours: number[];
  /** the hour with most words, or null */
  bestHour: number | null;
  /** most words in one day */
  bestDay: WritingDay | null;
}

/** Totals for the last `span` days, today included. */
export function summarise(days: WritingDay[], span: number, today = localDay()): Summary {
  const from = addDays(today, -(span - 1));
  const inRange = days.filter((d) => d.day >= from && d.day <= today);
  const hours = Array.from({ length: 24 }, () => 0);
  let words = 0;
  let minutes = 0;
  let writingDays = 0;
  let bestDay: WritingDay | null = null;
  for (const d of inRange) {
    words += d.words;
    minutes += d.minutes ?? 0;
    if (d.words > 0) writingDays++;
    if (!bestDay || d.words > bestDay.words) bestDay = d;
    d.hours?.forEach((w, i) => i < 24 && (hours[i] += w || 0));
  }
  const top = Math.max(...hours);
  return {
    words,
    minutes,
    writingDays,
    perWritingDay: writingDays ? Math.round(words / writingDays) : 0,
    hours,
    bestHour: top > 0 ? hours.indexOf(top) : null,
    bestDay: bestDay && bestDay.words > 0 ? bestDay : null,
  };
}

/** Should today's reminder ring now? Only on the chosen days, at or after its time, while today's goal isn't met. */
export function reminderDue(r: ReminderPrefs | undefined, now: Date, wordsToday: number, dailyGoal: number): boolean {
  if (!r?.on || !r.days.includes(now.getDay())) return false;
  const [h, m] = r.time.split(":").map(Number);
  if (now.getHours() * 60 + now.getMinutes() < h * 60 + (m || 0)) return false;
  return dailyGoal > 0 ? wordsToday < dailyGoal : wordsToday === 0;
}
